import { useState, useCallback } from 'react'
import UploadScreen from './components/UploadScreen'
import LoadingScreen from './components/LoadingScreen'
import MapView from './components/MapView'
import { parseGedcom } from './utils/parseGedcom'
import { geocodeAncestors } from './utils/geocode'

function App() {
  const [state, setState] = useState('upload') // upload | loading | map
  const [ancestors, setAncestors] = useState([])
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 })
  const [unmapped, setUnmapped] = useState({ noPlace: [], geocodeFailed: [] })

  const [error, setError] = useState(null)

  const handleFileUpload = useCallback(async (file) => {
    try {
      const text = await file.text()
      const { withPlace, noPlace } = parseGedcom(text)

      if (withPlace.length === 0 && noPlace.length === 0) {
        setError('No ancestors found in this file.')
        return
      }

      setError(null)
      setState('loading')
      setGeocodeProgress({ done: 0, total: withPlace.length })

      const { geocoded, geocodeFailed } = await geocodeAncestors(withPlace, (done) => {
        setGeocodeProgress((prev) => ({ ...prev, done }))
      })

      setAncestors(geocoded)
      setUnmapped({ noPlace, geocodeFailed })
      setState('map')
    } catch (err) {
      console.error('Failed to process GEDCOM file:', err)
      setError('Failed to process file. Please check it is a valid GEDCOM file.')
      setState('upload')
    }
  }, [])

  const handleReset = useCallback(() => {
    setState('upload')
    setAncestors([])
    setGeocodeProgress({ done: 0, total: 0 })
    setUnmapped({ noPlace: [], geocodeFailed: [] })
  }, [])

  if (state === 'upload') {
    return <UploadScreen onFileUpload={handleFileUpload} appError={error} />
  }

  if (state === 'loading') {
    return (
      <LoadingScreen
        done={geocodeProgress.done}
        total={geocodeProgress.total}
      />
    )
  }

  return (
    <MapView
      ancestors={ancestors}
      unmapped={unmapped}
      onReset={handleReset}
    />
  )
}

export default App
