import { useState } from 'react'
import { loadHistory } from '../lib/history'
import { analyze, MIN_SAMPLE, conditionName } from '../lib/insights'
import DisclaimerBanner from './DisclaimerBanner'

const SUGGESTION_STYLES = {
  confirm: 'bg-emerald-50 ring-emerald-200 text-emerald-900',
  raise: 'bg-amber-50 ring-amber-200 text-amber-900',
  lower: 'bg-amber-50 ring-amber-200 text-amber-900',
  add: 'bg-sky-50 ring-sky-200 text-sky-900',
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
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Insights</h1>
        <p className="mt-1 text-sm text-slate-600">
          Outcome feedback from this device only. Knowledge base v{report.kbVersion}.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {report.totalEpisodes} episodes · {report.outcomeCount} with outcomes · {report.confirmedCount} with a confirmed diagnosis.
          Suggestions below are advisory — apply changes manually in conditions.json and record them in its changelog.
        </p>
        <a href="/" className="mt-2 inline-block min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 active:bg-blue-50">
          ← Back to app
        </a>
      </header>

      {report.confirmedCount === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="font-semibold text-slate-800">No confirmed outcomes yet</p>
          <p className="mt-1 text-sm text-slate-600">
            Insights appear once episodes in the History tab have outcomes with a
            doctor-confirmed diagnosis.
          </p>
        </div>
      ) : (
        <>
          {/* Per-condition scoreboard */}
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Per-condition accuracy</h2>
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
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
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="p-3 font-medium text-slate-800">{s.name}</td>
                      <td className="p-3 text-right text-slate-600">{s.rankedFirst}</td>
                      <td className="p-3 text-right text-slate-600">{s.confirmed}</td>
                      <td className="p-3 text-right text-slate-600">{s.hits}</td>
                      <td className="p-3 text-right">
                        {s.confirmed === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : s.insufficientData ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            insufficient data (&lt;{MIN_SAMPLE})
                          </span>
                        ) : (
                          <span className={`font-semibold ${s.hitRate >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>
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
              <h2 className="mb-2 text-lg font-bold text-slate-900">Confusion list</h2>
              <div className="space-y-2">
                {report.confusion.map((c) => (
                  <div key={`${c.rankedId}-${c.actualId}`} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
                    Ranked <span className="font-semibold text-slate-900">{c.rankedName}</span> #1, actual diagnosis was{' '}
                    <span className="font-semibold text-slate-900">{c.actualName}</span>:{' '}
                    <span className="font-bold text-amber-700">{c.count}×</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Miss details */}
          {report.misses.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold text-slate-900">Miss details</h2>
              <p className="mb-2 text-xs text-slate-500">
                ✓ = the user reported this symptom. Compare against the weights to spot the one that looks wrong.
              </p>
              <div className="space-y-2">
                {report.misses.map((m) => (
                  <details key={m.episodeId} className="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="font-semibold text-slate-900">{m.actualName}</span>{' '}
                        <span className="text-slate-500">({m.truthRankLabel}; app ranked {m.rankedFirstName} #1)</span>
                      </span>
                      <span className="text-slate-400 transition group-open:rotate-180" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="space-y-2 border-t border-slate-100 p-3 text-sm">
                      <p className="text-xs text-slate-500">{new Date(m.date).toLocaleString()}</p>
                      <h3 className="font-semibold text-slate-800">Weighted symptoms of {m.actualName}:</h3>
                      <ul className="space-y-1">
                        {m.truthSymptoms.map((s) => (
                          <li key={s.id} className={s.reported ? 'text-emerald-800' : 'text-slate-400'}>
                            {s.reported ? '✓' : '✗'} {s.label} <span className="text-xs">(weight {s.weight})</span>
                          </li>
                        ))}
                      </ul>
                      {m.unlistedReported.length > 0 && (
                        <>
                          <h3 className="font-semibold text-slate-800">Also reported, but not weighted for this condition:</h3>
                          <ul className="space-y-1 text-slate-600">
                            {m.unlistedReported.map((s) => <li key={s.id}>• {s.label}</li>)}
                          </ul>
                        </>
                      )}
                      <h3 className="font-semibold text-slate-800">What the app ranked:</h3>
                      <ol className="list-inside list-decimal text-slate-600">
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
              <h2 className="mb-2 text-lg font-bold text-slate-900">Suggestions (advisory only)</h2>
              <p className="mb-2 text-xs text-slate-500">
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
        <h2 className="mb-2 text-lg font-bold text-slate-900">Knowledge base changelog</h2>
        <div className="space-y-2">
          {report.changelog.map((entry) => (
            <div key={entry.version} className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-900">v{entry.version} <span className="ml-1 text-xs font-normal text-slate-500">{entry.date}</span></p>
              <p className="mt-0.5 text-slate-700">{entry.change}</p>
              <p className="mt-0.5 text-xs text-slate-500">Evidence: {entry.evidence}</p>
            </div>
          ))}
        </div>
      </section>

      <DisclaimerBanner />
      <p className="pb-4 text-center text-[10px] text-slate-400">
        All feedback data is stored in this browser's localStorage only — it never leaves the device.
      </p>
    </div>
  )
}
