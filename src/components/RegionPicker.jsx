import { getRegions } from '../engine/triage'

/** Step 1 of intake: where does it hurt? */
export default function RegionPicker({ onSelect }) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Where is the problem?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick the area that fits best — you can add symptoms from anywhere on the next step.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {getRegions().map((region) => (
          <button
            key={region.id}
            onClick={() => onSelect(region)}
            className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-slate-200 transition active:bg-blue-50 active:ring-blue-300"
          >
            <span className="text-3xl" aria-hidden="true">{region.icon}</span>
            <span className="text-sm font-semibold leading-tight text-slate-800">{region.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
