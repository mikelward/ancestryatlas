import { useState, useMemo } from 'react'

export default function PersonPicker({ allPeople, defaultRootId, onSelect }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return allPeople
    const q = search.toLowerCase()
    return allPeople.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.birthPlace?.toLowerCase().includes(q) ||
        p.birthDate?.toLowerCase().includes(q)
    )
  }, [allPeople, search])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
          Choose a starting person
        </h1>
        <p className="text-gray-400 text-sm">
          {allPeople.length} people in file — pick who to map ancestors for
        </p>
      </div>

      <div className="w-full max-w-md mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or place..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-gray-900 text-white text-sm rounded-xl pl-9 pr-4 py-3
                       placeholder-gray-500 border border-gray-700 focus:border-amber-400
                       focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="w-full max-w-md flex-1 overflow-y-auto rounded-xl border border-gray-800
                      bg-gray-900/50 max-h-[60vh]">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm p-6 text-center">No matches</p>
        )}
        {filtered.map((person) => (
          <button
            key={person.id}
            onClick={() => onSelect(person.id)}
            className={`w-full text-left px-4 py-3 text-sm transition-colors
              hover:bg-gray-800/60 border-b border-gray-800/50 last:border-b-0
              ${person.id === defaultRootId ? 'bg-amber-400/5' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-white truncate">{person.name}</div>
                <div className="text-[11px] text-gray-500 truncate">
                  {[person.birthDate, person.birthPlace].filter(Boolean).join(' — ') || 'No details'}
                </div>
              </div>
              {person.id === defaultRootId && (
                <span className="text-[10px] text-amber-400 shrink-0 border border-amber-400/30
                                 rounded px-1.5 py-0.5">
                  Default
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <p className="text-gray-600 text-xs mt-4">
        {filtered.length} of {allPeople.length} people shown
      </p>
    </div>
  )
}
