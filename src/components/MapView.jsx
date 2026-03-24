import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import MapGL, { Source, Layer } from 'react-map-gl/mapbox'
import StatsOverlay from './StatsOverlay'
import { MobileSheet, DesktopPopup } from './AncestorSheet'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const clusterLayer = {
  id: 'clusters',
  type: 'circle',
  source: 'ancestors',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#f59e0b',
    'circle-radius': ['step', ['get', 'point_count'], 20, 5, 30, 10, 40],
    'circle-opacity': 0.8,
  },
}

const clusterCountLayer = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'ancestors',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 14,
  },
  paint: {
    'text-color': '#1f2937',
  },
}

const unclusteredPointLayer = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'ancestors',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#f59e0b',
    'circle-radius': 8,
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}

export default function MapView({ ancestors, failedCount, onReset }) {
  const mapRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [popupPos, setPopupPos] = useState(null)
  const isMobile = useIsMobile()

  const ancestorLookup = useMemo(() => {
    const lookup = new globalThis.Map()
    ancestors.forEach((a) => lookup.set(a.id, a))
    return lookup
  }, [ancestors])

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: ancestors.map((a) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
        properties: { id: a.id, name: a.name },
      })),
    }),
    [ancestors]
  )

  const initialBounds = useMemo(() => {
    if (ancestors.length === 0) return undefined
    const lngs = ancestors.map((a) => a.lng)
    const lats = ancestors.map((a) => a.lat)
    return [
      [Math.min(...lngs) - 2, Math.min(...lats) - 2],
      [Math.max(...lngs) + 2, Math.max(...lats) + 2],
    ]
  }, [ancestors])

  const flyTo = useCallback((lng, lat) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 8, duration: 1500 })
  }, [])

  const handleNavigate = useCallback(
    (id) => {
      const ancestor = ancestorLookup.get(id)
      if (!ancestor) return
      setSelected(ancestor)
      flyTo(ancestor.lng, ancestor.lat)
    },
    [ancestorLookup, flyTo]
  )

  const handleClick = useCallback(
    (e) => {
      const map = mapRef.current
      if (!map) return

      // Check for cluster clicks
      const clusterFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['clusters'],
      })
      if (clusterFeatures.length > 0) {
        const clusterId = clusterFeatures[0].properties.cluster_id
        const source = map.getSource('ancestors')
        source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({
              center: clusterFeatures[0].geometry.coordinates,
              zoom,
            })
          })
          .catch(() => {})
        return
      }

      // Check for point clicks
      const pointFeatures = map.queryRenderedFeatures(e.point, {
        layers: ['unclustered-point'],
      })
      if (pointFeatures.length > 0) {
        const id = pointFeatures[0].properties.id
        const ancestor = ancestorLookup.get(id)
        if (ancestor) {
          setSelected(ancestor)
          setPopupPos({ x: e.point.x, y: e.point.y })
          flyTo(ancestor.lng, ancestor.lat)
        }
        return
      }

      // Click on empty area
      setSelected(null)
    },
    [ancestorLookup, flyTo]
  )

  const handleClose = useCallback(() => setSelected(null), [])

  return (
    <div className="w-full h-screen relative">
      <StatsOverlay
        ancestors={ancestors}
        failedCount={failedCount}
        onReset={onReset}
      />

      <MapGL
        ref={mapRef}
        initialViewState={
          initialBounds
            ? { bounds: initialBounds, fitBoundsOptions: { padding: 60 } }
            : { longitude: 0, latitude: 30, zoom: 2 }
        }
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        onClick={handleClick}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        cursor="pointer"
      >
        <Source
          id="ancestors"
          type="geojson"
          data={geojson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>
      </MapGL>

      {isMobile ? (
        <MobileSheet
          ancestor={selected}
          open={!!selected}
          onClose={handleClose}
          onNavigate={handleNavigate}
        />
      ) : (
        <DesktopPopup
          ancestor={selected}
          position={popupPos}
          onClose={handleClose}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  )
}
