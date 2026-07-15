/**
 * Triage engine tests.
 *
 * Priority #1: prove the red-flag override cannot be bypassed — no symptom
 * combination, score, or answer may downgrade or suppress an emergency.
 * Priority #2: pin the safety invariants (escalation only raises, the
 * urgent_care cap on answer-based bumps) and the 40% + hallmark gate.
 *
 * Tests go through the public API only and read expectations from the
 * knowledge base where possible, so KB edits don't silently break them.
 */
import { describe, it, expect } from 'vitest'
import { runTriage, deriveFlags, checkGlobalRedFlags, URGENCY_ORDER } from './triage.js'
import kb from '../data/conditions.json'

/** Neutral answers: no fever, short duration, mild severity, adult age. */
const baseAnswers = { durationDays: 2, severity: 4, age: 20, fever: 'none', recentInjury: false }

const mono = kb.conditions.find((c) => c.id === 'mononucleosis')
const monoSymptomIds = mono.symptoms.map((s) => s.id)

describe('red-flag override cannot be bypassed', () => {
  it('a single global red flag with no other symptoms returns emergency', () => {
    const out = runTriage(['chest_pain_pressure'], baseAnswers)
    expect(out.emergency).toBe(true)
    expect(out.overallUrgency).toBe('emergency')
    expect(out.results).toEqual([])
  })

  it('every global red flag in the KB individually triggers the override', () => {
    for (const rf of kb.global_red_flags) {
      const out = runTriage([rf.symptom], baseAnswers)
      expect(out.emergency, `red flag ${rf.symptom} must trigger emergency`).toBe(true)
      expect(out.results).toEqual([])
    }
  })

  it('a 100% match on a benign condition cannot dilute or suppress the override', () => {
    // Full mono symptom set (a perfect non-emergency match) plus one red flag:
    // the emergency screen must still be the ONLY output.
    const out = runTriage(['chest_pain_pressure', ...monoSymptomIds], baseAnswers)
    expect(out.emergency).toBe(true)
    expect(out.overallUrgency).toBe('emergency')
    expect(out.results).toEqual([])
    expect(out.redFlags.map((r) => r.symptom)).toContain('chest_pain_pressure')
  })

  it('multiple red flags are all reported back', () => {
    const out = runTriage(['chest_pain_pressure', 'stroke_signs'], baseAnswers)
    expect(out.redFlags).toHaveLength(2)
  })

  it('checkGlobalRedFlags matches only exact symptom ids', () => {
    expect(checkGlobalRedFlags(['chest_pain', 'chest_pain_pressure_x'])).toEqual([])
  })
})

describe('matching rule: hallmark OR >= 40%', () => {
  it('a hallmark match surfaces a condition even far below 40%', () => {
    // Mono's hallmark alone is 3/12 = 25% — hallmark arm must admit it.
    const out = runTriage(['severe_fatigue_weeks'], baseAnswers)
    const hit = out.results.find((r) => r.condition.id === 'mononucleosis')
    expect(hit).toBeDefined()
    expect(hit.percent).toBeLessThan(40)
    expect(hit.matchedSymptoms.some((s) => s.hallmark)).toBe(true)
  })

  it('a lone supporting symptom below 40% with no hallmark is excluded', () => {
    // body_aches is weight 1 of mono's 12 (8%) — mono must not appear.
    const out = runTriage(['body_aches'], baseAnswers)
    expect(out.results.find((r) => r.condition.id === 'mononucleosis')).toBeUndefined()
  })

  it('v1.1 regression: the early-mono presentation now clears the 40% floor', () => {
    // The confirmed-miss case from the learning loop: no hallmark, so mono
    // relies on the 40% arm. Pre-v1.1 it scored 36% and vanished.
    const out = runTriage(
      ['fever', 'body_aches', 'chills', 'fatigue', 'loss_of_appetite'],
      { ...baseAnswers, fever: 'fever', durationDays: 7 },
    )
    const hit = out.results.find((r) => r.condition.id === 'mononucleosis')
    expect(hit).toBeDefined()
    expect(hit.percent).toBe(42) // 5/12
    expect(hit.matchedSymptoms.some((s) => s.hallmark)).toBe(false)
  })

  it('never returns more than 5 results', () => {
    const everySymptom = [...new Set(kb.conditions.flatMap((c) => c.symptoms.map((s) => s.id)))]
      .filter((id) => !kb.global_red_flags.some((r) => r.symptom === id))
    const out = runTriage(everySymptom, baseAnswers)
    expect(out.results.length).toBeLessThanOrEqual(5)
  })
})

describe('escalation only ever raises urgency', () => {
  const monoTriage = (extraIds = [], answers = {}) =>
    runTriage([...monoSymptomIds.filter((id) => id !== 'severe_fatigue_weeks'), 'severe_fatigue_weeks', ...extraIds], {
      ...baseAnswers,
      ...answers,
    }).results.find((r) => r.condition.id === 'mononucleosis')

  it('baseline urgency comes from the KB when nothing escalates', () => {
    expect(monoTriage().urgency).toBe(mono.urgency) // see_doctor
  })

  it('a condition red flag escalates to its escalate_to level', () => {
    const hit = monoTriage(['severe_left_upper_belly_pain'])
    expect(hit.urgency).toBe('emergency')
    expect(hit.triggeredFlags.map((f) => f.id)).toContain('severe_left_upper_belly_pain')
  })

  it('untriggered condition red flags come back as watchFor warnings', () => {
    const hit = monoTriage()
    expect(hit.watchFor.map((f) => f.id).sort()).toEqual(
      mono.condition_red_flags.map((f) => f.id).sort(),
    )
  })

  it('severity >= 8 bumps exactly one level', () => {
    expect(monoTriage([], { severity: 9 }).urgency).toBe('urgent_care')
  })

  it('age >= 65 bumps exactly one level', () => {
    expect(monoTriage([], { age: 70 }).urgency).toBe('urgent_care')
  })

  it('age < 2 bumps exactly one level', () => {
    expect(monoTriage([], { age: 1 }).urgency).toBe('urgent_care')
  })

  it('answer-based bumps are capped at urgent_care — arithmetic can never declare an emergency', () => {
    // Worst case stacking: severity 10 AND age 80. Two bumps from see_doctor
    // would reach emergency if uncapped; the cap must hold at urgent_care.
    expect(monoTriage([], { severity: 10, age: 80 }).urgency).toBe('urgent_care')
  })

  it('an emergency from a real red flag is not disturbed by answer modifiers', () => {
    const hit = monoTriage(['severe_left_upper_belly_pain'], { severity: 10, age: 80 })
    expect(hit.urgency).toBe('emergency')
  })

  it('overall banner shows the most urgent level among top matches', () => {
    const out = runTriage([...monoSymptomIds, 'severe_left_upper_belly_pain'], baseAnswers)
    expect(out.overallUrgency).toBe('emergency')
  })
})

describe('derived flags translate answers into symptom ids', () => {
  it('maps the fever answer to fever / fever_over_104', () => {
    expect(deriveFlags({ ...baseAnswers, fever: 'none' })).not.toContain('fever')
    expect(deriveFlags({ ...baseAnswers, fever: 'fever' })).toContain('fever')
    const high = deriveFlags({ ...baseAnswers, fever: 'high' })
    expect(high).toContain('fever')
    expect(high).toContain('fever_over_104')
  })

  it('duration thresholds stack instead of replacing each other', () => {
    const flags = deriveFlags({ ...baseAnswers, durationDays: 25 })
    expect(flags).toEqual(
      expect.arrayContaining(['symptoms_over_3_days', 'symptoms_over_10_days', 'cough_over_3_weeks']),
    )
  })

  it('maps recent injury', () => {
    expect(deriveFlags({ ...baseAnswers, recentInjury: true })).toContain('recent_injury')
  })
})

describe('urgency ladder', () => {
  it('keeps the four levels in severity order — comparisons depend on the indexes', () => {
    expect(URGENCY_ORDER).toEqual(['self_care', 'see_doctor', 'urgent_care', 'emergency'])
  })
})
