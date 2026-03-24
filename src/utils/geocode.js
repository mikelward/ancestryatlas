const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const cache = new Map()

// Feature types that are too broad — if Mapbox returns one of these,
// try again with fewer leading (most-local) parts of the place string.
const BROAD_TYPES = new Set([
  'country', 'region', 'district',
])

async function geocodeQuery(query) {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}&limit=1`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.features?.[0] || null
}

async function geocodePlace(place) {
  if (cache.has(place)) return cache.get(place)

  // Split into parts: "New Tiers, Mount Lofty, South Australia, Australia"
  // Try full string first, then drop the most-local part each time
  const parts = place.split(',').map((s) => s.trim())

  let bestFeature = null

  for (let i = 0; i < parts.length - 1; i++) {
    const query = parts.slice(i).join(', ')
    const feature = await geocodeQuery(query)
    if (!feature) continue

    bestFeature = feature
    const featureType = feature.properties?.feature_type
    if (!BROAD_TYPES.has(featureType)) {
      // Got a specific enough result, use it
      break
    }
    // Result is too broad (region/country level), try dropping the
    // most-local part and retrying with a shorter query
  }

  if (!bestFeature) {
    cache.set(place, null)
    return null
  }

  const [lng, lat] = bestFeature.geometry.coordinates
  const country =
    bestFeature.properties?.context?.country?.name ||
    parts[parts.length - 1] ||
    'Unknown'

  const result = { lat, lng, country }
  cache.set(place, result)
  return result
}

export async function geocodeAncestors(ancestors, onProgress) {
  const geocoded = []
  let failed = 0

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
        failed++
      }
    } catch {
      failed++
    }

    onProgress(i + 1)
  }

  return { geocoded, failed }
}
