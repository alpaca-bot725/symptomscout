import { useState } from 'react'

const DURATION_OPTIONS = [
  { label: 'Today', days: 0.5 },
  { label: '1–3 days', days: 2 },
  { label: '4–10 days', days: 7 },
  { label: '11–21 days', days: 14 },
  { label: 'Over 3 weeks', days: 28 },
]

const FEVER_OPTIONS = [
  { value: 'none', label: 'No fever' },
  { value: 'fever', label: 'Yes (100.4–103.9°F)' },
  { value: 'high', label: 'High (104°F or more)' },
]

/** Step 3 of intake: follow-up questions the engine uses to refine urgency. */
export default function FollowUpForm({ onBack, onSubmit }) {
  const [durationDays, setDurationDays] = useState(null)
  const [severity, setSeverity] = useState(5)
  const [age, setAge] = useState('')
  const [fever, setFever] = useState(null)
  const [recentInjury, setRecentInjury] = useState(null)

  const complete = durationDays !== null && fever !== null && recentInjury !== null && age !== ''

  const pill = (active) =>
    `min-h-12 rounded-2xl px-4 py-3 text-sm font-medium transition ring-1 ${
      active ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-700 ring-slate-200 active:bg-blue-50'
    }`

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">A few more questions</h2>
          <p className="mt-1 text-sm text-slate-600">These help judge how urgent things are.</p>
        </div>
        <button onClick={onBack} className="min-h-11 rounded-xl px-3 text-sm font-medium text-blue-700 active:bg-blue-50">
          ← Back
        </button>
      </header>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">How long have you had these symptoms?</legend>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button key={opt.label} onClick={() => setDurationDays(opt.days)} aria-pressed={durationDays === opt.days} className={pill(durationDays === opt.days)}>
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">
          How severe does it feel? <span className="font-bold text-blue-700">{severity}/10</span>
        </legend>
        <input
          type="range"
          min="1"
          max="10"
          value={severity}
          onChange={(e) => setSeverity(Number(e.target.value))}
          aria-label="Severity from 1 to 10"
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Barely notice it</span>
          <span>Worst imaginable</span>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Your age</legend>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="120"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="e.g. 20"
          className="w-full min-h-12 rounded-2xl border-0 bg-white px-4 py-3 text-base shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Do you have a fever?</legend>
        <div className="flex flex-wrap gap-2">
          {FEVER_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setFever(opt.value)} aria-pressed={fever === opt.value} className={pill(fever === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Any recent injury (fall, hit, twist)?</legend>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setRecentInjury(true)} aria-pressed={recentInjury === true} className={pill(recentInjury === true)}>Yes</button>
          <button onClick={() => setRecentInjury(false)} aria-pressed={recentInjury === false} className={pill(recentInjury === false)}>No</button>
        </div>
      </fieldset>

      <button
        onClick={() => onSubmit({ durationDays, severity, age: Number(age), fever, recentInjury })}
        disabled={!complete}
        className="w-full min-h-14 rounded-2xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-md transition active:bg-blue-700 disabled:bg-slate-300"
      >
        See results
      </button>
    </div>
  )
}
