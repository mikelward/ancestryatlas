import { useState, useCallback, useRef } from 'react'

export default function UploadScreen({ onFileUpload, appError }) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback(
    (file) => {
      const name = file.name.toLowerCase()
      if (!name.endsWith('.ged') && !name.endsWith('.gedcom')) {
        setError('Please upload a .ged or .gedcom file')
        return
      }
      setError(null)
      onFileUpload(file)
    },
    [onFileUpload]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-3">
          AncestryAtlas
        </h1>
        <p className="text-lg text-gray-400">
          See where your family came from
        </p>
      </div>

      <div
        className={`
          w-full max-w-md rounded-2xl border-2 border-dashed p-12
          flex flex-col items-center justify-center gap-4 cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? 'border-amber-400 bg-amber-400/5'
              : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
          }
        `}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-medium">
            Drop your GEDCOM file here
          </p>
          <p className="text-gray-500 text-sm mt-1">or tap to browse</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ged,.gedcom"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>

      {(error || appError) && (
        <p className="text-red-400 text-sm mt-4">{error || appError}</p>
      )}

      <p className="text-gray-600 text-sm mt-8 max-w-sm text-center">
        Upload a GEDCOM file exported from Ancestry, MyHeritage, FamilySearch,
        or any genealogy app
      </p>
    </div>
  )
}
