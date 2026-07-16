import { getGlobalRedFlags, getRedFlagBenignContext } from '../engine/triage'

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
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">First, a quick safety check</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Are you experiencing any of these right now?
        </p>
      </header>

      <div className="space-y-2">
        {flags.map((flag) => {
          const isOn = selected.has(flag.symptom)
          const context = getRedFlagBenignContext(flag.symptom)
          return (
            <div key={flag.symptom}>
              <button
                onClick={() => onToggle(flag.symptom)}
                aria-pressed={isOn}
                className={`flex w-full min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ring-1 ${
                  isOn
                    ? 'bg-red-600 text-white ring-red-600 dark:bg-red-500 dark:ring-red-500'
                    : 'bg-white text-slate-800 ring-slate-200 active:bg-red-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:active:bg-red-950/40'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs ${
                    isOn ? 'border-white bg-white text-red-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {isOn ? '✓' : ''}
                </span>
                {flag.label}
              </button>

              {/* Benign-context pair — messaging only, never affects the hard
                  override above. Watch-for guidance always comes first and
                  is the more prominent line; reassurance is smaller and only
                  ever shown alongside it. */}
              {context && (
                <div className="mt-1.5 space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-800/50">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">⚠️ {context.watchFor}</p>
                  <p className="text-amber-800/90 dark:text-amber-300/80">{context.benignContext}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {anySelected ? (
        <button
          onClick={onEmergency}
          className="w-full min-h-14 rounded-2xl bg-red-600 px-4 py-4 text-lg font-bold text-white shadow-md active:bg-red-700 dark:bg-red-500 dark:active:bg-red-600"
        >
          Show emergency guidance
        </button>
      ) : (
        <button
          onClick={onContinue}
          className="w-full min-h-14 rounded-2xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-md active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
        >
          None of these — continue
        </button>
      )}
    </div>
  )
}
