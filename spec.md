# AncestryAtlas — Implementation Spec

## Overview

Client-side React app. Upload a GEDCOM file, see direct ancestors' birthplaces on a Mapbox map. No backend, no auth, no database.

**Domain:** ancestryatlas.app
**Deploy:** Vercel (auto-deploy on push)

---

## Tech Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | React 19 + Vite 8 | Fast dev/build, modern defaults |
| Map | Mapbox GL JS 3.x + react-map-gl 8.x | Best clustering support, dark styles |
| GEDCOM parsing | Custom parser | `parse-gedcom` npm crashes on CONC/CONT lines with pointer values |
| Styling | Tailwind CSS 4.x (@tailwindcss/vite plugin) | Utility-first, no separate CSS files |
| Bottom sheet | vaul 1.x | Native-feeling iOS/Android drawer |
| Geocoding | Mapbox Geocoding API v6 (forward) | Same provider as map, free tier sufficient |

---

## File Structure

```
src/
├── App.jsx                    # State machine: upload → loading → map
├── main.jsx                   # React 19 createRoot bootstrap
├── index.css                  # Tailwind + mapbox-gl CSS imports
├── components/
│   ├── UploadScreen.jsx       # Landing page, drag & drop file upload
│   ├── LoadingScreen.jsx      # Geocoding progress bar
│   ├── MapView.jsx            # Mapbox map, clustering, click handlers
│   ├── AncestorSheet.jsx      # Bottom sheet (mobile) / popup (desktop)
│   └── StatsOverlay.jsx       # "X ancestors across Y countries"
└── utils/
    ├── parseGedcom.js         # GEDCOM tokenizer, tree builder, ancestor filter
    └── geocode.js             # Mapbox geocoding with in-memory cache
```

---

## App State Machine

Three states, linear flow:

```
upload → loading → map
  ↑                  │
  └──── reset ───────┘
```

- **upload**: Show `UploadScreen`. On file selected, parse GEDCOM synchronously, then transition to loading.
- **loading**: Show `LoadingScreen` with progress. Geocode each ancestor sequentially, updating count.
- **map**: Show `MapView` with all geocoded ancestors. Reset button returns to upload.

Error handling: try/catch around parse + geocode. On failure, show error message on upload screen.

---

## GEDCOM Parsing

### Why Custom Parser

The `parse-gedcom` npm package throws `"Cannot concatenate a pointer"` when CONC/CONT continuation lines contain pointer-like values (`@...@`). Common in Ancestry.com exports. Replaced with a ~170-line custom parser.

### Tokenization

Each GEDCOM line has the format: `LEVEL [XREF] TAG [VALUE]`

```
0 @I123@ INDI              → level=0, xref=@I123@, tag=INDI
1 NAME John /Smith/         → level=1, tag=NAME, value="John /Smith/"
1 FAMC @F45@                → level=1, tag=FAMC, pointer=@F45@
```

Regex: `^(\d+)\s+(@[^@]+@\s+)?(\S+)\s?(.*)$`

Pointer values (matching `^@[^@]+@$`) are stored separately from string values.

### Tree Building

Stack-based: maintain a stack of nodes indexed by level. Each new node is added as a child of `stack[level]`.

**CONC/CONT handling:** These tags append to the *parent* node's value (not a sibling). CONT adds a newline; CONC concatenates directly.

### Root Person Selection

Use the **first INDI record** in the file. Ancestry, MyHeritage, and FamilySearch all export the "home person" first. No explicit marker exists in the GEDCOM spec.

### Ancestor Collection

BFS traversal up through `parentIds`, starting from root person. Collects up to 4 generations:

- Gen 0: root person (1)
- Gen 1: parents (up to 2)
- Gen 2: grandparents (up to 4)
- Gen 3: great-grandparents (up to 8)
- Gen 4: great-great-grandparents (up to 16)
- **Max ~31 people**

Only ancestors with a `birthPlace` are included in the final output. Parent/child references are filtered to only include people within the collected set.

### Extracted Fields

| Field | GEDCOM path | Notes |
|-------|-------------|-------|
| name | INDI > NAME | Slashes removed (GEDCOM wraps surname in //) |
| birthDate | INDI > BIRT > DATE | |
| birthPlace | INDI > BIRT > PLAC | Required for inclusion |
| deathDate | INDI > DEAT > DATE | Optional |
| deathPlace | INDI > DEAT > PLAC | Optional |
| photo | INDI > OBJE > FILE | Optional, rarely present |
| parentIds | Resolved via FAM > HUSB/WIFE where INDI > FAMC matches | |
| childIds | Resolved via FAM > CHIL where INDI > FAMS matches | |

---

## Geocoding

### API

Mapbox Geocoding v6 forward endpoint:
```
GET https://api.mapbox.com/search/geocode/v6/forward?q={place}&access_token={token}&limit=1
```

### Caching

In-memory `Map` keyed by place string. Caches both hits (coordinates + country) and misses (null). No TTL, lives for the session.

### Country Extraction

Priority order:
1. `feature.properties.context.country.name` from Mapbox response
2. Last comma-separated segment of the place string
3. `"Unknown"`

### Broad Result Fallback

GEDCOM place strings are hierarchical (e.g. "New Tiers, Mount Lofty, South Australia, Australia"). Mapbox often doesn't know the most local part and returns a broad region centroid instead.

Strategy: try the full string first. If the result's `feature_type` is broad (`country`, `region`, or `district`), drop the leftmost (most local) part and retry. Continue until we get a specific result or run out of parts.

Example for "New Tiers, Mount Lofty, South Australia, Australia":
1. Try "New Tiers, Mount Lofty, South Australia, Australia" → returns region (South Australia centroid)
2. Try "Mount Lofty, South Australia, Australia" → returns place-level result (Adelaide Hills area)
3. Use that.

### Processing

Sequential (one at a time), not parallel. Simpler and enables smooth progress updates. With ~30 max ancestors and cached duplicates, total time is acceptable.

### Error Handling

Failed geocodes increment a counter but don't block. The count is displayed in the stats overlay: "3 ancestors could not be mapped".

---

## Map View

### Style

`mapbox://styles/mapbox/dark-v11` — dark heritage feel.

### Clustering

Mapbox GL built-in GeoJSON clustering:
- `cluster: true` on the Source
- `clusterMaxZoom: 14`
- `clusterRadius: 50`

Three layers:
1. **clusters** — amber circles, size 20→30→40px based on point count
2. **cluster-count** — text labels showing abbreviated count
3. **unclustered-point** — amber circles (8px) with white stroke

### Click Handling

Priority order:
1. Cluster click → `getClusterExpansionZoom()` (promise-based) → `easeTo` that zoom level
2. Point click → select ancestor, show detail, `flyTo` with 1.5s animation
3. Empty area → deselect

### Initial Bounds

Calculated bounding box of all ancestor coordinates with 2-degree padding. Falls back to `[0, 30] zoom 2` if no ancestors.

### Import Note

react-map-gl v8 changed exports. Must import from `react-map-gl/mapbox`, not `react-map-gl`. The Map component is imported as `MapGL` to avoid shadowing JavaScript's `Map` constructor. Ancestor lookups use `globalThis.Map`.

---

## Ancestor Detail

### Responsive Behavior

| Viewport | Component | Behavior |
|----------|-----------|----------|
| < 768px | `MobileSheet` (vaul Drawer) | Slides up from bottom, draggable, max 85vh |
| >= 768px | `DesktopPopup` | Floating card positioned above click point |

Detection: `window.matchMedia('(max-width: 767px)')` with change listener.

### Content

Shared `AncestorDetail` component renders:
1. Photo (if available, circular crop)
2. Name (prominent)
3. Born: date + place
4. Died: date + place (if available)
5. Parents (tappable, navigates map)
6. Children (tappable, navigates map)

Tapping a parent/child calls `onNavigate(id)` → `flyTo` their pin + select them.

All tap targets: `min-h-[44px]` for mobile accessibility.

---

## Styling

- Dark theme throughout (gray-950 backgrounds, white/gray text, amber accents)
- Tailwind utility classes, no custom CSS files beyond index.css
- Mapbox GL CSS imported in index.css
- Vaul overlay opacity overridden to `rgba(0, 0, 0, 0.4)`
- `html, body, #root` set to 100% height for fullscreen app

---

## Environment Variables

```
VITE_MAPBOX_TOKEN=<public token>
```

Mapbox public tokens are safe to expose client-side. Set in `.env.local` (gitignored via `*.local` pattern).

---

## Known Limitations

- Root person detection assumes first INDI is the home person (works for Ancestry/MyHeritage/FamilySearch exports)
- Sequential geocoding (not parallelized)
- No offline/persistence — re-upload required each session
- Photos from GEDCOM OBJE > FILE are URLs that may not resolve (depend on source app)
- 4-generation depth is hardcoded (post-MVP: add slider)
