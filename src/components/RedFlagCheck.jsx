import { getGlobalRedFlags } from '../engine/triage'

/**
 * Safety gate shown BEFORE the normal intake flow. If the user checks any
 * of these, we go straight to the emergency screen — no scoring, no results.
 */
export default function RedFlagCheck({ selected, onToggle, onContinue, onEmergency }) {
  const flags = getGlobalRedFlags()
  const anySelected = selected.size > 0
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-bold text-slate-900">First, a quick safety check</h2>
        <p className="mt-1 text-sm text-slate-600">
          Are you experiencing any of these right now?
        </p>
      </header>

      <div className="space-y-2">
        {flags.map((flag) => {
          const isOn = selected.has(flag.symptom)
          return (
            <button
              key={flag.symptom}
              onClick={() => onToggle(flag.symptom)}
              aria-pressed={isOn}
              className={`flex w-full min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ring-1 ${
                isOn
                  ? 'bg-red-600 text-white ring-red-600'
                  : 'bg-white text-slate-800 ring-slate-200 active:bg-red-50'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs ${
                  isOn ? 'border-white bg-white text-red-600' : 'border-slate-300'
                }`}
              >
                {isOn ? '✓' : ''}
              </span>
              {flag.label}
            </button>
          )
        })}
      </div>

      {anySelected ? (
        <button
          onClick={onEmergency}
          className="w-full min-h-14 rounded-2xl bg-red-600 px-4 py-4 text-lg font-bold text-white shadow-md active:bg-red-700"
        >
          Show emergency guidance
        </button>
      ) : (
        <button
          onClick={onContinue}
          className="w-full min-h-14 rounded-2xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-md active:bg-blue-700"
        >
          None of these — continue
        </button>
      )}
    </div>
  )
}
