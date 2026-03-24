import { useState } from 'react'

export default function StatsOverlay({ ancestors, unmapped, onReset, onSelectUnmapped }) {
  const [showUnmapped, setShowUnmapped] = useState(false)
  const countries = new Set(ancestors.map((a) => a.country))
  const { noPlace = [], geocodeFailed = [] } = unmapped
  const totalUnmapped = noPlace.length + geocodeFailed.length

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between pointer-events-none">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-4 py-3 pointer-events-auto max-w-sm">
        <p className="text-white text-sm font-medium">
          {ancestors.length} ancestor{ancestors.length !== 1 ? 's' : ''} mapped
          across {countries.size} countr{countries.size !== 1 ? 'ies' : 'y'}
        </p>
        {totalUnmapped > 0 && (
          <>
            <button
              onClick={() => setShowUnmapped(!showUnmapped)}
              className="text-gray-400 text-xs mt-1 hover:text-gray-300 transition-colors"
            >
              {totalUnmapped} not mapped {showUnmapped ? '▲' : '▼'}
            </button>
            {showUnmapped && (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-3">
                {noPlace.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      No birth place in file
                    </h4>
                    <ul className="space-y-0.5">
                      {noPlace.map((a) => (
                        <li key={a.id}>
                          <button
                            onClick={() => onSelectUnmapped(a)}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors text-left"
                          >
                            {a.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {geocodeFailed.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Location not found
                    </h4>
                    <ul className="space-y-0.5">
                      {geocodeFailed.map((a) => (
                        <li key={a.id}>
                          <button
                            onClick={() => onSelectUnmapped(a)}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors text-left"
                          >
                            {a.name}
                          </button>
                          <span className="text-[10px] text-gray-600 ml-1">
                            {a.birthPlace}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <button
        onClick={onReset}
        className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-3 py-3 pointer-events-auto
                   text-gray-400 hover:text-white transition-colors"
        title="Upload new file"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}
