import { URGENCY_INFO } from '../engine/triage'

const URGENCY_STYLES = {
  self_care: {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    banner: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-500/10 dark:text-emerald-200',
    icon: '🏠',
  },
  see_doctor: {
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    banner: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-200',
    icon: '🩺',
  },
  urgent_care: {
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
    banner: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800/60 dark:bg-orange-500/10 dark:text-orange-200',
    icon: '⏰',
  },
  emergency: {
    badge: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
    banner: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-500/10 dark:text-red-200',
    icon: '🚨',
  },
}

/**
 * Results: overall urgency banner + top condition matches, each with
 * plain-language reasoning (which symptoms matched and their weight).
 */
/**
 * "Consider seeking care" note shown when a chest/head symptom was rated 8+.
 * Messaging only — the urgency math for this lives in the engine.
 */
function SeverityAdvisory({ advisory }) {
  return (
    <div className="rounded-2xl bg-orange-50 p-4 text-sm leading-relaxed text-orange-900 ring-1 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-800/60">
      You rated <strong>{advisory.label.toLowerCase()}</strong> at{' '}
      <strong>{advisory.severity}/10</strong>. Intense chest or head symptoms are
      worth taking seriously — consider seeking care sooner rather than waiting.
    </div>
  )
}

export default function ResultsScreen({ triage, onStartOver }) {
  const { results, overallUrgency, severityAdvisory } = triage
  const banner = URGENCY_STYLES[overallUrgency]

  // With zero matches the engine's overallUrgency defaults to self_care, but
  // claiming "manage this at home" when nothing matched would overstate what
  // we know. Show a neutral "no clear match" banner instead.
  if (results.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-slate-300 bg-white p-5 text-center text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <div className="text-3xl" aria-hidden="true">🤔</div>
          <h2 className="mt-1 text-xl font-bold">No clear match</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Your combination of symptoms didn't clearly match anything in our
            knowledge base. That doesn't mean nothing is wrong — if you feel
            unwell, get worse, or symptoms persist, see a healthcare professional.
          </p>
        </div>
        {severityAdvisory && <SeverityAdvisory advisory={severityAdvisory} />}
        <button
          onClick={onStartOver}
          className="w-full min-h-13 rounded-2xl bg-blue-600 px-4 py-3.5 font-semibold text-white shadow-md active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
        >
          Start a new check
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 p-5 text-center ${banner.banner}`}>
        <div className="text-3xl" aria-hidden="true">{banner.icon}</div>
        <h2 className="mt-1 text-xl font-bold">{URGENCY_INFO[overallUrgency].label}</h2>
        <p className="mt-1 text-sm">{URGENCY_INFO[overallUrgency].detail}</p>
      </div>

      {severityAdvisory && <SeverityAdvisory advisory={severityAdvisory} />}

      <div className="space-y-4">
      {results.map((r, index) => {
        const style = URGENCY_STYLES[r.urgency]
        return (
          <details
            key={r.condition.id}
            open={index === 0}
            style={{ animationDelay: `${index * 60}ms` }}
            className="card-in group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{r.condition.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">{r.percent}% match</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                    {URGENCY_INFO[r.urgency].label}
                  </span>
                </div>
              </div>
              <span className="text-slate-400 transition group-open:rotate-180 dark:text-slate-500" aria-hidden="true">⌄</span>
            </summary>

            <div className="space-y-3 border-t border-slate-100 p-4 text-sm dark:border-slate-700">
              <p className="leading-relaxed text-slate-700 dark:text-slate-300">{r.condition.description}</p>

              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Why this matched</h4>
                <ul className="mt-1 space-y-1">
                  {r.matchedSymptoms.map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                      <span aria-hidden="true" className={s.hallmark ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}>
                        {s.hallmark ? '◆' : '◇'}
                      </span>
                      <span>
                        {s.label}
                        {s.hallmark && <span className="ml-1 text-xs font-medium text-blue-700 dark:text-blue-400">(hallmark symptom)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Matched {r.score} of {r.maxScore} symptom points.
                </p>
              </div>

              {r.triggeredFlags.length > 0 && (
                <div className="rounded-xl bg-orange-50 p-3 text-orange-900 ring-1 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-800/60">
                  <h4 className="font-semibold">Urgency was raised because you reported:</h4>
                  <ul className="mt-1 list-inside list-disc">
                    {r.triggeredFlags.map((f) => <li key={f.id}>{f.label}</li>)}
                  </ul>
                </div>
              )}

              {r.modifiers.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Urgency adjusted for: {r.modifiers.join('; ')}.</p>
              )}

              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">What helps</h4>
                <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">{r.condition.advice}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Typical duration: {r.condition.typical_duration_days}
                  {/^[\d.\-–]+$/.test(r.condition.typical_duration_days) ? ' days' : ''}.
                </p>
              </div>

              {r.watchFor.length > 0 && (
                <div className="rounded-xl bg-red-50 p-3 text-red-900 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-800/60">
                  <h4 className="font-semibold">Seek care immediately if you develop:</h4>
                  <ul className="mt-1 list-inside list-disc">
                    {r.watchFor.map((f) => <li key={f.id}>{f.label}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )
      })}
      </div>

      <p className="px-2 text-center text-xs text-slate-500 dark:text-slate-400">
        Saved to your history. Matches are ranked by how many of each
        condition's weighted symptoms you reported — not a diagnosis.
      </p>

      <button
        onClick={onStartOver}
        className="w-full min-h-13 rounded-2xl bg-blue-600 px-4 py-3.5 font-semibold text-white shadow-md active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
      >
        Start a new check
      </button>
    </div>
  )
}
