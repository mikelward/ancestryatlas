export default function StatsOverlay({ ancestors, failedCount, onReset }) {
  const countries = new Set(ancestors.map((a) => a.country))

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between pointer-events-none">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-4 py-3 pointer-events-auto">
        <p className="text-white text-sm font-medium">
          {ancestors.length} ancestor{ancestors.length !== 1 ? 's' : ''} mapped
          across {countries.size} countr{countries.size !== 1 ? 'ies' : 'y'}
        </p>
        {failedCount > 0 && (
          <p className="text-gray-400 text-xs mt-1">
            {failedCount} ancestor{failedCount !== 1 ? 's' : ''} could not be
            mapped
          </p>
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
