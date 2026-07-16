/**
 * Hard-override screen shown when any global red flag is reported.
 * Normal results are intentionally skipped — nothing here should
 * distract from getting help.
 */
export default function EmergencyScreen({ redFlags, onStartOver }) {
  const showCrisisLine = redFlags.some((r) => r.symptom === 'suicidal_thoughts')
  return (
    <div className="space-y-4">
      <div className="pop-in rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-center dark:border-red-800/70 dark:bg-red-950/40">
        <div className="text-4xl" aria-hidden="true">🚨</div>
        <h2 className="mt-2 text-2xl font-bold text-red-700 dark:text-red-300">Get help now</h2>
        <p className="mt-1 text-sm text-red-800 dark:text-red-200">
          What you reported can be a sign of a medical emergency. Skipping the
          normal results on purpose — please act on the guidance below first.
        </p>
      </div>

      {redFlags.map((flag) => (
        <div key={flag.symptom} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-red-200 dark:bg-slate-800 dark:ring-red-900/60">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{flag.label}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{flag.action}</p>
        </div>
      ))}

      <a
        href={showCrisisLine ? 'tel:988' : 'tel:911'}
        className="block min-h-14 rounded-2xl bg-red-600 px-4 py-4 text-center text-lg font-bold text-white shadow-md active:bg-red-700 dark:bg-red-500 dark:active:bg-red-600"
      >
        {showCrisisLine ? 'Call or text 988 now' : 'Call 911 now'}
      </a>

      <button
        onClick={onStartOver}
        className="block w-full min-h-12 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-600 ring-1 ring-slate-200 active:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:active:bg-slate-700"
      >
        Start over
      </button>
    </div>
  )
}
