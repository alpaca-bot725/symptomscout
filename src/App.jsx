import { useState } from 'react'
import { runTriage, checkGlobalRedFlags, symptomLabel } from './engine/triage'
import { saveEpisode } from './lib/history'
import kb from './data/conditions.json'
import InsightsScreen from './components/InsightsScreen'
import DisclaimerBanner from './components/DisclaimerBanner'
import RedFlagCheck from './components/RedFlagCheck'
import RegionPicker from './components/RegionPicker'
import SymptomPicker from './components/SymptomPicker'
import FollowUpForm from './components/FollowUpForm'
import ResultsScreen from './components/ResultsScreen'
import EmergencyScreen from './components/EmergencyScreen'
import HistoryScreen from './components/HistoryScreen'

/**
 * Intake flow state machine:
 *   home → redflags → region → symptoms → followups → results
 *                └────────────── any red flag ──────→ emergency
 */
export default function App() {
  const [tab, setTab] = useState('check') // 'check' | 'history'

  // Hidden admin route — not linked anywhere in the nav. Reads the same
  // localStorage history as the rest of the app; see vercel.json for the
  // SPA rewrite that makes this path work in production.
  const isInsights = window.location.pathname.replace(/\/+$/, '') === '/insights'
  const [step, setStep] = useState('home')
  const [redFlagSelection, setRedFlagSelection] = useState(new Set())
  const [region, setRegion] = useState(null)
  const [symptoms, setSymptoms] = useState(new Set())
  const [triage, setTriage] = useState(null)

  const toggle = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const startOver = () => {
    setStep('home')
    setRedFlagSelection(new Set())
    setRegion(null)
    setSymptoms(new Set())
    setTriage(null)
  }

  const showEmergency = () => {
    const redFlags = checkGlobalRedFlags([...redFlagSelection])
    setTriage({ emergency: true, redFlags, results: [], overallUrgency: 'emergency' })
    saveEpisode({
      emergency: true,
      regionLabel: 'Safety check',
      symptomLabels: redFlags.map((f) => f.label),
      answers: { durationDays: 0, severity: 10, age: '', fever: 'unknown', recentInjury: false },
      topResults: [],
      overallUrgency: 'emergency',
    })
    setStep('emergency')
  }

  const finishIntake = (answers) => {
    const result = runTriage([...symptoms], answers)
    setTriage(result)
    const symptomIds = [...symptoms]
    saveEpisode({
      emergency: false,
      regionLabel: region.label,
      // ids power the /insights miss analysis; labels stay for display/export
      symptomIds,
      symptomLabels: symptomIds.map((id) => symptomLabel(id)),
      answers,
      topResults: result.results.map((r) => ({
        id: r.condition.id,
        name: r.condition.name,
        percent: r.percent,
        score: r.score,
        maxScore: r.maxScore,
        urgency: r.urgency,
      })),
      overallUrgency: result.overallUrgency,
    })
    setStep('results')
  }

  if (isInsights) {
    return <InsightsScreen />
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-4 pb-24">
      <header className="mb-4 flex items-center gap-2">
        <span className="grid size-10 place-items-center rounded-2xl bg-blue-600 text-xl text-white shadow-sm" aria-hidden="true">＋</span>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900">SymptomScout</h1>
          <p className="text-xs text-slate-500">Health education guide</p>
        </div>
      </header>

      <main className="flex-1">
        {tab === 'history' ? (
          <HistoryScreen />
        ) : (
          <>
            {step === 'home' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
                  <div className="text-4xl" aria-hidden="true">🔎</div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">How are you feeling?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Answer a few questions about your symptoms and get an educational
                    overview of what might be going on — and how soon to seek care.
                  </p>
                  <button
                    onClick={() => setStep('redflags')}
                    className="mt-4 w-full min-h-14 rounded-2xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-md active:bg-blue-700"
                  >
                    Start symptom check
                  </button>
                </div>
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <h3 className="font-semibold text-slate-800">What this app does</h3>
                  <ul className="mt-2 space-y-1.5">
                    <li>✓ Screens for emergency warning signs first</li>
                    <li>✓ Compares your symptoms against 30 common conditions</li>
                    <li>✓ Explains its reasoning in plain language</li>
                    <li>✓ Keeps a private, on-device episode history</li>
                  </ul>
                </div>
              </div>
            )}

            {step === 'redflags' && (
              <RedFlagCheck
                selected={redFlagSelection}
                onToggle={toggle(setRedFlagSelection)}
                onContinue={() => setStep('region')}
                onEmergency={showEmergency}
              />
            )}

            {step === 'region' && (
              <RegionPicker onSelect={(r) => { setRegion(r); setStep('symptoms') }} />
            )}

            {step === 'symptoms' && (
              <SymptomPicker
                region={region}
                selected={symptoms}
                onToggle={toggle(setSymptoms)}
                onBack={() => setStep('region')}
                onContinue={() => setStep('followups')}
              />
            )}

            {step === 'followups' && (
              <FollowUpForm onBack={() => setStep('symptoms')} onSubmit={finishIntake} />
            )}

            {step === 'results' && triage && (
              <ResultsScreen triage={triage} onStartOver={startOver} />
            )}

            {step === 'emergency' && triage && (
              <EmergencyScreen redFlags={triage.redFlags} onStartOver={startOver} />
            )}
          </>
        )}
      </main>

      <div className="mt-4 space-y-1">
        <DisclaimerBanner />
        <p className="text-center text-[10px] text-slate-400">Knowledge base v{kb.version}</p>
      </div>

      {/* Bottom tab bar — fixed, thumb-reachable */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-2">
          {[
            { id: 'check', label: 'Symptom check', icon: '🔎' },
            { id: 'history', label: 'History', icon: '📋' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                tab === t.id ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
