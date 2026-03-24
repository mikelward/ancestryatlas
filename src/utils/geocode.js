const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const GEONAMES_USERNAME = import.meta.env.VITE_GEONAMES_USERNAME

const cache = new Map()

// GeoNames specificity by feature code prefix — lower = more specific.
// Historical codes (ending in H) get the same rank as their modern equivalents.
function geonamesSpecificity(fcode) {
  if (!fcode) return 5
  const code = fcode.replace(/H$/, '') // treat historical same as modern
  if (code === 'PPL' || code === 'PPLA4' || code === 'PPLA3') return 1
  if (code.startsWith('PPL')) return 2 // PPLA, PPLA2, PPLC, etc.
  if (code.startsWith('ADM3') || code.startsWith('ADM4')) return 3
  if (code.startsWith('ADM2')) return 4
  if (code.startsWith('ADM1')) return 5
  if (code === 'RGN') return 6
  if (code.startsWith('PCL')) return 7 // country-level
  return 5
}

// Query GeoNames searchJSON endpoint. Returns array of result objects.
async function geonamesSearch(query, { fuzzy = 1, maxRows = 3 } = {}) {
  if (!GEONAMES_USERNAME) return []
  const params = new URLSearchParams({
    q: query,
    maxRows: String(maxRows),
    style: 'FULL',
    fuzzy: String(fuzzy),
    featureClass: 'P',
    username: GEONAMES_USERNAME,
  })
  // Also include admin/political features
  params.append('featureClass', 'A')
  const url = `https://secure.geonames.org/searchJSON?${params}`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return data.geonames || []
  } catch {
    return []
  }
}

// Query Mapbox geocoding v6. Returns a single feature or null.
async function mapboxSearch(query) {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}&limit=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data.features?.[0] || null
  } catch {
    return null
  }
}

// Pick the best GeoNames result from a list, preferring more specific features.
function pickBestGeonames(results) {
  if (results.length === 0) return null
  let best = results[0]
  let bestScore = geonamesSpecificity(best.fcode)
  for (let i = 1; i < results.length; i++) {
    const score = geonamesSpecificity(results[i].fcode)
    if (score < bestScore) {
      best = results[i]
      bestScore = score
    }
  }
  return best
}

// Try progressively broader queries against GeoNames.
// "Lessen, Elchniederung, Prussia" → try full string, then drop the leftmost
// part each time. GeoNames knows historical names natively, so "Prussia" and
// "Elchniederung" can match without any hardcoded mapping.
async function tryGeonames(parts) {
  for (let i = 0; i < parts.length; i++) {
    const query = parts.slice(i).join(' ')
    const results = await geonamesSearch(query, { fuzzy: 0.8 })
    const best = pickBestGeonames(results)
    if (best && best.lat && best.lng) {
      return {
        lat: parseFloat(best.lat),
        lng: parseFloat(best.lng),
        country: best.countryName || parts[parts.length - 1] || 'Unknown',
        source: 'geonames',
        specificity: geonamesSpecificity(best.fcode),
      }
    }
  }
  return null
}

// Mapbox specificity by feature_type — lower = more specific.
const MAPBOX_SPECIFICITY = {
  address: 0,
  street: 1,
  neighborhood: 2,
  locality: 3,
  place: 4,
  postcode: 5,
  district: 6,
  region: 7,
  country: 8,
}

// Try progressively broader queries against Mapbox.
async function tryMapbox(parts) {
  let bestFeature = null
  let bestSpecificity = Infinity

  for (let i = 0; i < parts.length; i++) {
    const query = parts.slice(i).join(', ')
    const feature = await mapboxSearch(query)
    if (!feature) continue

    const featureType = feature.properties?.feature_type
    const specificity = MAPBOX_SPECIFICITY[featureType] ?? 4

    if (!bestFeature || specificity < bestSpecificity) {
      bestFeature = feature
      bestSpecificity = specificity
    }

    if (specificity <= 3) break
  }

  if (!bestFeature) return null

  const [lng, lat] = bestFeature.geometry.coordinates
  const country =
    bestFeature.properties?.context?.country?.name ||
    parts[parts.length - 1] ||
    'Unknown'

  return { lat, lng, country, source: 'mapbox', specificity: bestSpecificity }
}

async function geocodePlace(place) {
  if (cache.has(place)) return cache.get(place)

  // GEDCOM places are hierarchical: "Lessen, Elchniederung, Prussia"
  // Split into parts and try each geocoder with progressively broader queries.
  const parts = place.split(',').map((s) => s.trim())

  // Also try without commas — some GEDCOM files use spaces instead:
  // "Malmesbury Wiltshire" should still work.
  const spaceParts = place.includes(',') ? null : place.split(/\s+/)

  // 1. GeoNames first — it knows historical places natively
  let result = await tryGeonames(parts)
  if (!result && spaceParts) {
    result = await tryGeonames(spaceParts)
  }

  // 2. Mapbox fallback — better for modern addresses & precise locations
  if (!result) {
    result = await tryMapbox(parts)
    if (!result && spaceParts) {
      result = await tryMapbox(spaceParts)
    }
  }

  // 3. If both returned results, prefer whichever is more specific.
  // (In practice we take GeoNames if it found anything, since it
  // handles historical names correctly and Mapbox may hallucinate.)

  if (!result) {
    cache.set(place, null)
    return null
  }

  const cached = { lat: result.lat, lng: result.lng, country: result.country }
  cache.set(place, cached)
  return cached
}

export async function geocodeAncestors(ancestors, onProgress) {
  const geocoded = []
  const geocodeFailed = []

  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = ancestors[i]

    try {
      const coords = await geocodePlace(ancestor.birthPlace)

      if (coords) {
        geocoded.push({
          ...ancestor,
          lat: coords.lat,
          lng: coords.lng,
          country: coords.country,
        })
      } else {
        geocodeFailed.push(ancestor)
      }
    } catch {
      geocodeFailed.push(ancestor)
    }

    onProgress(i + 1)
  }

  return { geocoded, geocodeFailed }
}
