import { Fragment, useMemo, useState } from 'react'
import { getRegions } from '../engine/triage'

/**
 * Inline 1–10 severity tap-scale shown under a checked symptom chip.
 * Ten buttons beat a slider on mobile: one tap, no drag precision needed.
 * Untouched = 5, which the engine treats as "no effect".
 */
function SeverityScale({ symptom, value, onChange }) {
  return (
    <div className="w-full rounded-xl bg-blue-50/70 px-3 py-2 ring-1 ring-blue-100">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium">How bad is “{symptom.label}”?</span>
        <span className="text-slate-400">1 annoying · 10 agonizing</span>
      </div>
      <div className="mt-1.5 grid grid-cols-10 gap-1" role="radiogroup" aria-label={`Severity for ${symptom.label}`}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`Severity ${n} of 10`}
            onClick={() => onChange(n)}
            className={`min-h-11 rounded-lg text-sm font-semibold transition ${
              n === value
                ? n >= 8
                  ? 'bg-orange-600 text-white'
                  : 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 active:bg-blue-100'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Step 2 of intake: pick symptoms. Shows the chosen region's symptoms by
 * default; the search box searches EVERY symptom in the knowledge base so
 * users aren't boxed in by their region choice. Checked symptoms reveal an
 * inline severity scale (defaults to 5 if never touched).
 */
export default function SymptomPicker({ region, selected, severity, onSeverityChange, onToggle, onBack, onContinue }) {
  const [query, setQuery] = useState('')

  // Flatten all region symptom lists into one searchable, de-duplicated list.
  const allSymptoms = useMemo(() => {
    const seen = new Map()
    for (const r of getRegions()) {
      for (const s of r.symptoms) {
        if (!seen.has(s.id)) seen.set(s.id, { ...s, regionLabel: r.label })
      }
    }
    return [...seen.values()]
  }, [])

  const q = query.trim().toLowerCase()
  const visible = q
    ? allSymptoms.filter((s) => s.label.toLowerCase().includes(q))
    : region.symptoms

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {region.icon} {region.label}
          </h2>
          <p className="mt-1 text-sm text-slate-600">Select everything that applies.</p>
        </div>
        <button onClick={onBack} className="min-h-11 rounded-xl px-3 text-sm font-medium text-blue-700 active:bg-blue-50">
          ← Back
        </button>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search all symptoms…"
        aria-label="Search all symptoms"
        className="w-full min-h-12 rounded-2xl border-0 bg-white px-4 py-3 text-base shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Symptoms">
        {visible.map((s) => {
          const isOn = selected.has(s.id)
          return (
            <Fragment key={s.id}>
              <button
                onClick={() => onToggle(s.id)}
                aria-pressed={isOn}
                className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition ring-1 ${
                  isOn
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-slate-700 ring-slate-200 active:bg-blue-50'
                }`}
              >
                {s.label}
                {q && <span className={`ml-1.5 text-xs ${isOn ? 'text-blue-100' : 'text-slate-400'}`}>· {s.regionLabel}</span>}
              </button>
              {isOn && (
                <SeverityScale
                  symptom={s}
                  value={severity[s.id] ?? 5}
                  onChange={(n) => onSeverityChange(s.id, n)}
                />
              )}
            </Fragment>
          )
        })}
        {visible.length === 0 && (
          <p className="py-4 text-sm text-slate-500">No symptoms match "{query}".</p>
        )}
      </div>

      <div className="sticky bottom-20 pt-2">
        <button
          onClick={onContinue}
          disabled={selected.size === 0}
          className="w-full min-h-14 rounded-2xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-md transition active:bg-blue-700 disabled:bg-slate-300"
        >
          Continue ({selected.size} selected)
        </button>
      </div>
    </div>
  )
}
