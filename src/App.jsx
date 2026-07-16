import { useState } from 'react'
import { runTriage, checkGlobalRedFlags, symptomLabel } from './engine/triage'
import { saveEpisode } from './lib/history'
import kb from './data/conditions.json'
import InsightsScreen from './components/InsightsScreen'
import DisclaimerBanner from './components/DisclaimerBanner'
import ThemeToggle from './components/ThemeToggle'
import HelixDecoration from './components/HelixDecoration'
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

// Linear order of the intake steps — used to decide slide direction.
const STEP_ORDER = ['home', 'redflags', 'region', 'symptoms', 'followups', 'results']

// Screen entrance class from the slide direction: forward → slide in from the
// right, back → from the left, tab switch (0) → cross-fade. The wrapper is
// keyed by step, so each navigation remounts it and re-runs the CSS animation.
const screenClass = (dir) => (dir > 0 ? 'screen-forward' : dir < 0 ? 'screen-back' : 'screen-fade')

export default function App() {
  const [tab, setTab] = useState('check') // 'check' | 'history'

  // Hidden admin route — not linked anywhere in the nav. Reads the same
  // localStorage history as the rest of the app; see vercel.json for the
  // SPA rewrite that makes this path work in production.
  const isInsights = window.location.pathname.replace(/\/+$/, '') === '/insights'
  const [step, setStep] = useState('home')
  // +1 forward, -1 back, 0 cross-fade (tab switch). Drives the slide direction.
  const [direction, setDirection] = useState(1)
  const [redFlagSelection, setRedFlagSelection] = useState(new Set())
  const [region, setRegion] = useState(null)
  const [symptoms, setSymptoms] = useState(new Set())
  // Per-symptom severity ratings, { symptomId: 1-10 }. Unrated = 5.
  const [symptomSeverity, setSymptomSeverity] = useState({})
  const [triage, setTriage] = useState(null)

  const toggle = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleSymptom = (id) => {
    // Deselecting a symptom also forgets its rating.
    if (symptoms.has(id)) {
      setSymptomSeverity(({ [id]: _removed, ...rest }) => rest)
    }
    toggle(setSymptoms)(id)
  }

  const rateSymptom = (id, value) =>
    setSymptomSeverity((prev) => ({ ...prev, [id]: value }))

  // Navigate between intake steps, inferring slide direction from STEP_ORDER
  // (unknown targets like 'emergency' count as forward).
  const go = (next) => {
    const from = STEP_ORDER.indexOf(step)
    const to = STEP_ORDER.indexOf(next)
    setDirection(from !== -1 && to !== -1 && to < from ? -1 : 1)
    setStep(next)
  }

  const switchTab = (id) => {
    setDirection(0) // tab changes cross-fade rather than slide
    setTab(id)
  }

  const startOver = () => {
    setDirection(-1)
    setStep('home')
    setRedFlagSelection(new Set())
    setRegion(null)
    setSymptoms(new Set())
    setSymptomSeverity({})
    setTriage(null)
  }

  const showEmergency = () => {
    setDirection(1)
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
    setDirection(1)
    const result = runTriage([...symptoms], { ...answers, symptomSeverity })
    setTriage(result)
    const symptomIds = [...symptoms]
    saveEpisode({
      emergency: false,
      regionLabel: region.label,
      // ids power the /insights miss analysis; labels stay for display/export
      symptomIds,
      symptomLabels: symptomIds.map((id) => symptomLabel(id)),
      symptomSeverity,
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
    <>
      {/* Rendered app-wide now (was home-only pre-v1.7), so it's visible
          behind the frosted panels everywhere — except the emergency step,
          which stays fully solid/opaque with nothing behind it (safety
          screens are not the place for any style risk, decorative or not). */}
      {step !== 'emergency' && <HelixDecoration />}
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-4 pb-24">
      <header className="mb-4 flex items-center gap-2">
        <span className="logo-beat grid size-10 place-items-center rounded-2xl bg-blue-600 text-xl text-white shadow-sm dark:bg-blue-500" aria-hidden="true">＋</span>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">SymptomScout</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Health education guide</p>
        </div>
        <ThemeToggle className="ml-auto" />
      </header>

      <main className="flex-1">
          <div key={tab === 'history' ? 'history' : step} className={screenClass(direction)}>
            {tab === 'history' ? (
              <HistoryScreen />
            ) : (
              <>
                {step === 'home' && (
                  <div className="space-y-4">
                    <div className="frosted-panel rounded-2xl p-6 text-center shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
                      <div className="text-4xl" aria-hidden="true">🔎</div>
                      <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">How are you feeling?</h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        Answer a few questions about your symptoms and get an educational
                        overview of what might be going on — and how soon to seek care.
                      </p>
                      <button
                        onClick={() => go('redflags')}
                        className="mt-4 w-full min-h-14 rounded-2xl bg-blue-600 px-4 py-4 text-lg font-semibold text-white shadow-md active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
                      >
                        Start symptom check
                      </button>
                    </div>
                    <div className="frosted-panel rounded-2xl p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 dark:text-slate-300 dark:ring-slate-700">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100">What this app does</h3>
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
                    onContinue={() => go('region')}
                    onEmergency={showEmergency}
                  />
                )}

                {step === 'region' && (
                  <RegionPicker onSelect={(r) => { setRegion(r); go('symptoms') }} />
                )}

                {step === 'symptoms' && (
                  <SymptomPicker
                    region={region}
                    selected={symptoms}
                    severity={symptomSeverity}
                    onSeverityChange={rateSymptom}
                    onToggle={toggleSymptom}
                    onBack={() => go('region')}
                    onContinue={() => go('followups')}
                  />
                )}

                {step === 'followups' && (
                  <FollowUpForm onBack={() => go('symptoms')} onSubmit={finishIntake} />
                )}

                {step === 'results' && triage && (
                  <ResultsScreen triage={triage} onStartOver={startOver} />
                )}

                {step === 'emergency' && triage && (
                  <EmergencyScreen redFlags={triage.redFlags} onStartOver={startOver} />
                )}
              </>
            )}
          </div>
      </main>

      <div className="mt-4 space-y-1">
        <DisclaimerBanner />
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">Knowledge base v{kb.version}</p>
      </div>

      {/* Bottom tab bar — fixed, thumb-reachable */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mx-auto grid max-w-md grid-cols-2">
          {[
            { id: 'check', label: 'Symptom check', icon: '🔎' },
            { id: 'history', label: 'History', icon: '📋' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                tab === t.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      </div>
    </>
  )
}
