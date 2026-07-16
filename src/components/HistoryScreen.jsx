import { useState } from 'react'
import { URGENCY_INFO } from '../engine/triage'
import { loadHistory, updateEpisode, deleteEpisode, clearHistory, buildDoctorSummary, downloadSummary, describeOutcome } from '../lib/history'
import OutcomeForm from './OutcomeForm'
import kb from '../data/conditions.json'

const conditionNameById = Object.fromEntries(kb.conditions.map((c) => [c.id, c.name]))

/** Episode log stored on-device, with a doctor-friendly export. */
export default function HistoryScreen() {
  const [history, setHistory] = useState(loadHistory)
  const [copied, setCopied] = useState(false)
  const [editingOutcomeId, setEditingOutcomeId] = useState(null)

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildDoctorSummary(history, conditionNameById))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveOutcome = (episodeId, outcome) => {
    setHistory(updateEpisode(episodeId, { outcome }))
    setEditingOutcomeId(null)
  }

  if (history.length === 0) {
    return (
      <div className="frosted-panel rounded-2xl p-6 text-center shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="text-3xl" aria-hidden="true">📋</div>
        <h2 className="mt-2 font-bold text-slate-900 dark:text-slate-100">No episodes yet</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Each symptom check you complete is saved here (only on this device),
          so you can track episodes over time and share them with a doctor.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Your symptom history</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {history.length} episode{history.length === 1 ? '' : 's'}, stored only on this device.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => downloadSummary(history, conditionNameById)} className="min-h-12 rounded-2xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600">
          ⬇ Download summary
        </button>
        <button onClick={copySummary} className="min-h-12 rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 active:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:ring-slate-700 dark:active:bg-blue-950/40">
          {copied ? '✓ Copied!' : '⧉ Copy for doctor'}
        </button>
      </div>

      {history.map((ep) => (
        <div key={ep.id} className="frosted-panel rounded-2xl p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {new Date(ep.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              <h3 className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">{ep.regionLabel}</h3>
            </div>
            <button
              onClick={() => setHistory(deleteEpisode(ep.id))}
              aria-label="Delete episode"
              className="min-h-11 min-w-11 rounded-xl text-slate-400 active:bg-red-50 active:text-red-600 dark:text-slate-500 dark:active:bg-red-950/40 dark:active:text-red-400"
            >
              🗑
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{ep.symptomLabels.join(', ')}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Severity {ep.answers.severity}/10 · {ep.answers.durationDays < 1 ? 'started today' : `~${ep.answers.durationDays} day(s)`}
          </p>
          {ep.emergency ? (
            <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">Red flag — emergency guidance shown</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ep.topResults.map((r) => (
                <span key={r.name} className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-900 dark:bg-sky-500/15 dark:text-sky-300">
                  {r.name} {r.percent}%
                </span>
              ))}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {URGENCY_INFO[ep.overallUrgency]?.label}
              </span>
            </div>
          )}

          {/* Outcome feedback — optional, low-pressure, editable forever.
              Not shown for emergency episodes: those users were told to call 911,
              not to come back and fill in forms. */}
          {!ep.emergency && (
            editingOutcomeId === ep.id ? (
              <OutcomeForm
                initial={ep.outcome}
                onSave={(outcome) => saveOutcome(ep.id, outcome)}
                onCancel={() => setEditingOutcomeId(null)}
              />
            ) : ep.outcome ? (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-800/60">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">{describeOutcome(ep.outcome, conditionNameById)}</p>
                <button
                  onClick={() => setEditingOutcomeId(ep.id)}
                  className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-emerald-700 active:bg-emerald-100 dark:text-emerald-300 dark:active:bg-emerald-500/20"
                >
                  Edit
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingOutcomeId(ep.id)}
                className="mt-3 w-full min-h-11 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 active:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:ring-slate-700 dark:active:bg-blue-950/40"
              >
                ＋ Add outcome
              </button>
            )
          )}
        </div>
      ))}

      <button
        onClick={() => { if (confirm('Delete ALL saved episodes? This cannot be undone.')) setHistory(clearHistory()) }}
        className="w-full min-h-12 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-950/40"
      >
        Clear all history
      </button>
    </div>
  )
}
