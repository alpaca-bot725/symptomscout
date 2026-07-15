import { useState } from 'react'
import { URGENCY_INFO } from '../engine/triage'
import { loadHistory, deleteEpisode, clearHistory, buildDoctorSummary, downloadSummary } from '../lib/history'

/** Episode log stored on-device, with a doctor-friendly export. */
export default function HistoryScreen() {
  const [history, setHistory] = useState(loadHistory)
  const [copied, setCopied] = useState(false)

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildDoctorSummary(history))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <div className="text-3xl" aria-hidden="true">📋</div>
        <h2 className="mt-2 font-bold text-slate-900">No episodes yet</h2>
        <p className="mt-1 text-sm text-slate-600">
          Each symptom check you complete is saved here (only on this device),
          so you can track episodes over time and share them with a doctor.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Your symptom history</h2>
        <p className="mt-1 text-sm text-slate-600">
          {history.length} episode{history.length === 1 ? '' : 's'}, stored only on this device.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => downloadSummary(history)} className="min-h-12 rounded-2xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm active:bg-blue-700">
          ⬇ Download summary
        </button>
        <button onClick={copySummary} className="min-h-12 rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 active:bg-blue-50">
          {copied ? '✓ Copied!' : '⧉ Copy for doctor'}
        </button>
      </div>

      {history.map((ep) => (
        <div key={ep.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-slate-500">
                {new Date(ep.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              <h3 className="mt-0.5 font-semibold text-slate-900">{ep.regionLabel}</h3>
            </div>
            <button
              onClick={() => setHistory(deleteEpisode(ep.id))}
              aria-label="Delete episode"
              className="min-h-11 min-w-11 rounded-xl text-slate-400 active:bg-red-50 active:text-red-600"
            >
              🗑
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-600">{ep.symptomLabels.join(', ')}</p>
          <p className="mt-1 text-xs text-slate-500">
            Severity {ep.answers.severity}/10 · {ep.answers.durationDays < 1 ? 'started today' : `~${ep.answers.durationDays} day(s)`}
          </p>
          {ep.emergency ? (
            <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">Red flag — emergency guidance shown</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ep.topResults.map((r) => (
                <span key={r.name} className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-900">
                  {r.name} {r.percent}%
                </span>
              ))}
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                {URGENCY_INFO[ep.overallUrgency]?.label}
              </span>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => { if (confirm('Delete ALL saved episodes? This cannot be undone.')) setHistory(clearHistory()) }}
        className="w-full min-h-12 rounded-2xl px-4 py-3 text-sm font-medium text-red-600 active:bg-red-50"
      >
        Clear all history
      </button>
    </div>
  )
}
