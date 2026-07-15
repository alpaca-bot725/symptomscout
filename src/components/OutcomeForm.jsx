import { useState } from 'react'
import kb from '../data/conditions.json'

/**
 * Outcome feedback form for one history episode. Users rarely know the real
 * diagnosis until days later, so this is reachable (and re-editable) from
 * every episode card forever. Entirely optional by design.
 *
 * The collected outcome only ever feeds the /insights dashboard, which
 * produces advisory text for MANUAL knowledge-base edits — it never touches
 * scoring at runtime.
 */
export default function OutcomeForm({ initial, onSave, onCancel }) {
  const [sawDoctor, setSawDoctor] = useState(initial?.sawDoctor ?? null)
  const [choice, setChoice] = useState(() => {
    const d = initial?.diagnosis
    if (!d) return ''
    if (d.kind === 'condition') return d.conditionId
    return d.kind // 'other' | 'unsure'
  })
  const [otherText, setOtherText] = useState(initial?.diagnosis?.text ?? '')

  const conditions = [...kb.conditions].sort((a, b) => a.name.localeCompare(b.name))

  const diagnosisNeeded = sawDoctor === 'yes'
  const diagnosisValid =
    !diagnosisNeeded || choice === 'unsure' || (choice === 'other' ? otherText.trim() !== '' : choice !== '')
  const canSave = sawDoctor !== null && diagnosisValid

  const save = () => {
    let diagnosis = null
    if (sawDoctor === 'yes') {
      if (choice === 'unsure') diagnosis = { kind: 'unsure' }
      else if (choice === 'other') diagnosis = { kind: 'other', text: otherText.trim() }
      else diagnosis = { kind: 'condition', conditionId: choice }
    }
    onSave({ sawDoctor, diagnosis, recordedAt: new Date().toISOString() })
  }

  const pill = (active) =>
    `min-h-11 rounded-xl px-3 py-2 text-sm font-medium transition ring-1 ${
      active ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 active:bg-blue-50'
    }`

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-sky-50 p-3 ring-1 ring-sky-200">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Did you end up seeing a doctor?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'not_yet', label: 'Not yet' },
          ].map((opt) => (
            <button key={opt.value} onClick={() => setSawDoctor(opt.value)} aria-pressed={sawDoctor === opt.value} className={pill(sawDoctor === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {sawDoctor === 'yes' && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">What was the diagnosis?</legend>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-label="Diagnosis"
            className="w-full min-h-11 rounded-xl border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="" disabled>Choose…</option>
            {conditions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="other">Something else…</option>
            <option value="unsure">Not sure</option>
          </select>
          {choice === 'other' && (
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="What did the doctor say?"
              aria-label="Diagnosis (free text)"
              className="mt-2 w-full min-h-11 rounded-xl border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          )}
        </fieldset>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        This helps improve the tool. Never share anything you're not comfortable with.
      </p>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!canSave}
          className="min-h-11 flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white active:bg-blue-700 disabled:bg-slate-300"
        >
          Save outcome
        </button>
        <button onClick={onCancel} className="min-h-11 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 active:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
