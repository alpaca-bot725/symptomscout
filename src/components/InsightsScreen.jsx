import { useState } from 'react'
import { loadHistory } from '../lib/history'
import { analyze, MIN_SAMPLE, conditionName } from '../lib/insights'
import DisclaimerBanner from './DisclaimerBanner'
import ThemeToggle from './ThemeToggle'

const SUGGESTION_STYLES = {
  confirm: 'bg-emerald-50 ring-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:ring-emerald-800/60 dark:text-emerald-200',
  raise: 'bg-amber-50 ring-amber-200 text-amber-900 dark:bg-amber-500/10 dark:ring-amber-800/60 dark:text-amber-200',
  lower: 'bg-amber-50 ring-amber-200 text-amber-900 dark:bg-amber-500/10 dark:ring-amber-800/60 dark:text-amber-200',
  add: 'bg-sky-50 ring-sky-200 text-sky-900 dark:bg-sky-500/10 dark:ring-sky-800/60 dark:text-sky-200',
}

/**
 * Hidden admin dashboard at /insights (not linked in the nav).
 * Aggregates outcome feedback so a HUMAN can decide on knowledge-base edits.
 * Advisory only: nothing here writes anywhere or alters scoring.
 */
export default function InsightsScreen() {
  const [report] = useState(() => analyze(loadHistory()))

  return (
    <div className="mx-auto min-h-dvh max-w-2xl space-y-5 px-4 py-6">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Insights</h1>
          <ThemeToggle />
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Outcome feedback from this device only. Knowledge base v{report.kbVersion}.
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {report.totalEpisodes} episodes · {report.outcomeCount} with outcomes · {report.confirmedCount} with a confirmed diagnosis.
          Suggestions below are advisory — apply changes manually in conditions.json and record them in its changelog.
        </p>
        <a href="/" className="mt-2 inline-block min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 active:bg-blue-50 dark:text-blue-400 dark:ring-slate-700 dark:active:bg-blue-950/40">
          ← Back to app
        </a>
      </header>

      {report.confirmedCount === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <p className="font-semibold text-slate-800 dark:text-slate-200">No confirmed outcomes yet</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Insights appear once episodes in the History tab have outcomes with a
            doctor-confirmed diagnosis.
          </p>
        </div>
      ) : (
        <>
          {/* Per-condition scoreboard */}
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Per-condition accuracy</h2>
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Condition</th>
                    <th className="p-3 text-right">Ranked #1</th>
                    <th className="p-3 text-right">Confirmed</th>
                    <th className="p-3 text-right">Hits</th>
                    <th className="p-3 text-right">Hit rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report.stats.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0 dark:border-slate-700/50">
                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">{s.rankedFirst}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">{s.confirmed}</td>
                      <td className="p-3 text-right text-slate-600 dark:text-slate-400">{s.hits}</td>
                      <td className="p-3 text-right">
                        {s.confirmed === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        ) : s.insufficientData ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                            insufficient data (&lt;{MIN_SAMPLE})
                          </span>
                        ) : (
                          <span className={`font-semibold ${s.hitRate >= 70 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {s.hitRate}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Confusion pairs */}
          {report.confusion.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Confusion list</h2>
              <div className="space-y-2">
                {report.confusion.map((c) => (
                  <div key={`${c.rankedId}-${c.actualId}`} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    Ranked <span className="font-semibold text-slate-900 dark:text-slate-100">{c.rankedName}</span> #1, actual diagnosis was{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{c.actualName}</span>:{' '}
                    <span className="font-bold text-amber-700 dark:text-amber-400">{c.count}×</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Miss details */}
          {report.misses.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Miss details</h2>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                ✓ = the user reported this symptom. Compare against the weights to spot the one that looks wrong.
              </p>
              <div className="space-y-2">
                {report.misses.map((m) => (
                  <details key={m.episodeId} className="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{m.actualName}</span>{' '}
                        <span className="text-slate-500 dark:text-slate-400">({m.truthRankLabel}; app ranked {m.rankedFirstName} #1)</span>
                      </span>
                      <span className="text-slate-400 transition group-open:rotate-180 dark:text-slate-500" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="space-y-2 border-t border-slate-100 p-3 text-sm dark:border-slate-700">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(m.date).toLocaleString()}</p>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">Weighted symptoms of {m.actualName}:</h3>
                      <ul className="space-y-1">
                        {m.truthSymptoms.map((s) => (
                          <li key={s.id} className={s.reported ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}>
                            {s.reported ? '✓' : '✗'} {s.label} <span className="text-xs">(weight {s.weight})</span>
                          </li>
                        ))}
                      </ul>
                      {m.unlistedReported.length > 0 && (
                        <>
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Also reported, but not weighted for this condition:</h3>
                          <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                            {m.unlistedReported.map((s) => <li key={s.id}>• {s.label}</li>)}
                          </ul>
                        </>
                      )}
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">What the app ranked:</h3>
                      <ol className="list-inside list-decimal text-slate-600 dark:text-slate-400">
                        {m.topResults.map((r) => <li key={r.id}>{r.name} — {r.percent}%</li>)}
                      </ol>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Advisory suggestions */}
          {report.suggestions.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Suggestions (advisory only)</h2>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Observations for a human reviewer. Nothing is ever applied automatically.
              </p>
              <div className="space-y-2">
                {report.suggestions.map((s, i) => (
                  <div key={i} className={`rounded-2xl p-3 text-sm ring-1 ${SUGGESTION_STYLES[s.type]}`}>
                    <p className="font-medium">{conditionName(s.conditionId)}: {s.text}</p>
                    <p className="mt-0.5 text-xs opacity-80">Evidence: {s.evidence}.</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Changelog */}
      <section>
        <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">Knowledge base changelog</h2>
        <div className="space-y-2">
          {report.changelog.map((entry) => (
            <div key={entry.version} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <p className="font-semibold text-slate-900 dark:text-slate-100">v{entry.version} <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">{entry.date}</span></p>
              <p className="mt-0.5 text-slate-700 dark:text-slate-300">{entry.change}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Evidence: {entry.evidence}</p>
            </div>
          ))}
        </div>
      </section>

      <DisclaimerBanner />
      <p className="pb-4 text-center text-[10px] text-slate-400 dark:text-slate-500">
        All feedback data is stored in this browser's localStorage only — it never leaves the device.
      </p>
    </div>
  )
}
