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
import {
  runTriage,
  deriveFlags,
  checkGlobalRedFlags,
  getRegions,
  getSymptomCatalog,
  URGENCY_ORDER,
} from './triage.js'
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

describe('per-symptom severity (v1.2): urgency messaging only', () => {
  // Mono set (all non-sensitive regions) + chest_tightness (chest = sensitive).
  const ids = [...monoSymptomIds, 'chest_tightness']
  const run = (symptomSeverity, extraAnswers = {}) =>
    runTriage(ids, { ...baseAnswers, ...extraAnswers, symptomSeverity })
  const monoOf = (out) => out.results.find((r) => r.condition.id === 'mononucleosis')
  const rank = (u) => URGENCY_ORDER.indexOf(u)

  it('a red flag at severity 1 is still a red flag — severity never routes around the override', () => {
    const out = runTriage([...monoSymptomIds, 'chest_pain_pressure'], {
      ...baseAnswers,
      symptomSeverity: { chest_pain_pressure: 1 },
    })
    expect(out.emergency).toBe(true)
    expect(out.overallUrgency).toBe('emergency')
    expect(out.results).toEqual([])
  })

  it('no severity map and an empty map behave identically to the pre-severity engine', () => {
    const baseline = runTriage(ids, baseAnswers)
    expect(run({})).toEqual(baseline)
    expect(baseline.severityAdvisory).toBeNull()
  })

  it('all ratings below 8 change nothing (unrated symptoms default to 5)', () => {
    const baseline = runTriage(ids, baseAnswers)
    const allOnes = Object.fromEntries(ids.map((id) => [id, 1]))
    expect(run(allOnes)).toEqual(baseline)
  })

  it('severity can NEVER lower any urgency below the baseline output', () => {
    const baseline = runTriage(ids, baseAnswers)
    const maps = [
      Object.fromEntries(ids.map((id) => [id, 1])),
      Object.fromEntries(ids.map((id) => [id, 10])),
      { chest_tightness: 8 },
      { body_aches: 10, chest_tightness: 1 },
    ]
    for (const m of maps) {
      const out = run(m)
      for (const r of out.results) {
        const base = baseline.results.find((b) => b.condition.id === r.condition.id)
        if (base) {
          expect(rank(r.urgency), `urgency for ${r.condition.id}`).toBeGreaterThanOrEqual(rank(base.urgency))
        }
      }
      expect(rank(out.overallUrgency)).toBeGreaterThanOrEqual(rank(baseline.overallUrgency))
    }
  })

  it('8+ on a sensitive-region symptom escalates one tier and surfaces the advisory', () => {
    const out = run({ chest_tightness: 9 })
    expect(monoOf(out).urgency).toBe('urgent_care') // see_doctor + 1
    expect(monoOf(out).modifiers.join(' ')).toMatch(/9\/10/)
    expect(out.severityAdvisory).toMatchObject({ id: 'chest_tightness', severity: 9 })
  })

  it('10/10 on a NON-sensitive symptom does not escalate', () => {
    const out = run({ body_aches: 10 })
    expect(monoOf(out).urgency).toBe(mono.urgency)
    expect(out.severityAdvisory).toBeNull()
  })

  it('severity bumps stack-cap at urgent_care — never emergency from ratings alone', () => {
    const out = run(Object.fromEntries(ids.map((id) => [id, 10])), { severity: 10, age: 80 })
    for (const r of out.results) {
      expect(r.urgency === 'emergency' && r.triggeredFlags.length === 0, `${r.condition.id} reached emergency without a red flag`).toBe(false)
    }
    expect(monoOf(out).urgency).toBe('urgent_care')
  })

  it('scoring is untouched — scores and percents are identical whatever the ratings say', () => {
    const baseline = runTriage(ids, baseAnswers)
    const out = run(Object.fromEntries(ids.map((id) => [id, 10])))
    expect(out.results.map((r) => [r.condition.id, r.score, r.percent])).toEqual(
      baseline.results.map((r) => [r.condition.id, r.score, r.percent]),
    )
  })
})

describe('escalation only raises urgency — property sweep across every condition', () => {
  // For each condition, select its OWN full symptom set (guarantees a hallmark
  // match, so every condition is a valid, present result) and assert that no
  // severity map — however extreme — can ever rank its urgency below the
  // severity-free baseline for that same symptom set.
  it.each(kb.conditions.map((c) => c.id))('%s: urgency never drops under any severity map', (conditionId) => {
    const condition = kb.conditions.find((c) => c.id === conditionId)
    const ids = condition.symptoms.map((s) => s.id)
    const baseline = runTriage(ids, baseAnswers).results.find((r) => r.condition.id === conditionId)
    expect(baseline, `${conditionId} must appear in its own baseline results`).toBeDefined()
    const baseRank = URGENCY_ORDER.indexOf(baseline.urgency)

    const severityMaps = [
      Object.fromEntries(ids.map((id) => [id, 1])),
      Object.fromEntries(ids.map((id) => [id, 10])),
      Object.fromEntries(ids.map((id, i) => [id, i % 2 === 0 ? 10 : 1])),
    ]
    for (const symptomSeverity of severityMaps) {
      for (const extraAnswers of [{}, { severity: 10, age: 80 }]) {
        const out = runTriage(ids, { ...baseAnswers, ...extraAnswers, symptomSeverity })
        const hit = out.results.find((r) => r.condition.id === conditionId)
        expect(hit, `${conditionId} must still appear under severity data`).toBeDefined()
        expect(
          URGENCY_ORDER.indexOf(hit.urgency),
          `${conditionId} urgency dropped below baseline (${baseline.urgency})`,
        ).toBeGreaterThanOrEqual(baseRank)
      }
    }
  })
})

describe('severity escalation — head region (chest already covered above)', () => {
  // migraine's hallmark light_sensitivity lives in the head region and its
  // baseline urgency is self_care (not already capped like concussion's
  // urgent_care), so a bump is actually observable here.
  it('8+/10 on a head-region symptom escalates one tier and surfaces the advisory', () => {
    const out = runTriage(['light_sensitivity'], { ...baseAnswers, symptomSeverity: { light_sensitivity: 9 } })
    const hit = out.results.find((r) => r.condition.id === 'migraine')
    expect(hit.urgency).toBe('see_doctor') // self_care + 1
    expect(hit.modifiers.join(' ')).toMatch(/9\/10/)
    expect(out.severityAdvisory).toMatchObject({ id: 'light_sensitivity', severity: 9 })
  })

  it('below the 8/10 threshold, a head-region symptom does not escalate', () => {
    const out = runTriage(['light_sensitivity'], { ...baseAnswers, symptomSeverity: { light_sensitivity: 7 } })
    const hit = out.results.find((r) => r.condition.id === 'migraine')
    expect(hit.urgency).toBe('self_care')
    expect(out.severityAdvisory).toBeNull()
  })
})

describe('40% + hallmark matching rule — boundary', () => {
  // low_back_strain: max=10, hallmarks are low_back_pain_movement (3) and
  // pain_after_lifting (3). muscle_spasm_back(2)+stiffness_morning(1)+
  // pain_better_rest(1) = 4/10 = exactly 40%, no hallmark among them.
  it('a hallmark-free set scoring EXACTLY 40% is included', () => {
    const out = runTriage(['muscle_spasm_back', 'stiffness_morning', 'pain_better_rest'], baseAnswers)
    const hit = out.results.find((r) => r.condition.id === 'low_back_strain')
    expect(hit).toBeDefined()
    expect(hit.percent).toBe(40)
    expect(hit.matchedSymptoms.some((s) => s.hallmark)).toBe(false)
  })

  // Closest achievable hallmark-free score below 40% for the same condition
  // (integer weights don't permit an exact 39% here — 3/10 = 30% is the
  // nearest below-threshold value): must be excluded.
  it('a hallmark-free set scoring 30% (the nearest below-threshold value) is excluded', () => {
    const out = runTriage(['muscle_spasm_back', 'stiffness_morning'], baseAnswers)
    expect(out.results.find((r) => r.condition.id === 'low_back_strain')).toBeUndefined()
  })

  // Corroborating exact-40% inclusions from two other conditions, found by
  // exhaustively searching the KB for hallmark-free subsets at the boundary.
  it.each([
    ['influenza', ['chills', 'dry_cough', 'headache', 'sore_throat']],
    ['migraine', ['sound_sensitivity', 'nausea', 'worse_with_activity']],
  ])('%s: an independent hallmark-free 40%% set is also included', (conditionId, ids) => {
    const out = runTriage(ids, baseAnswers)
    const hit = out.results.find((r) => r.condition.id === conditionId)
    expect(hit).toBeDefined()
    expect(hit.percent).toBe(40)
    expect(hit.matchedSymptoms.some((s) => s.hallmark)).toBe(false)
  })
})

describe('symptom catalog & regions — nothing silently vanishes from the intake UI', () => {
  const catalog = getSymptomCatalog()
  const regions = getRegions()
  const regionSymptomIds = new Set(regions.flatMap((r) => r.symptoms.map((s) => s.id)))
  const globalRedFlagIds = new Set(kb.global_red_flags.map((r) => r.symptom))

  it('every symptom referenced by any condition resolves in the catalog', () => {
    for (const condition of kb.conditions) {
      for (const s of condition.symptoms) {
        expect(catalog[s.id], `${condition.id}: symptom "${s.id}" missing from catalog`).toBe(s.label)
      }
    }
  })

  it('every non-red-flag catalog symptom appears in some region (its own, or "general" as a fallback)', () => {
    for (const id of Object.keys(catalog)) {
      if (globalRedFlagIds.has(id)) continue
      expect(regionSymptomIds.has(id), `"${id}" is in the catalog but not offered in any region`).toBe(true)
    }
  })

  it('global red flags are excluded from the region picker (asked on the safety screen instead)', () => {
    for (const id of globalRedFlagIds) {
      expect(regionSymptomIds.has(id), `red flag "${id}" leaked into the region picker`).toBe(false)
    }
  })
})

describe('conditions.json data integrity', () => {
  it('version matches the newest (first) changelog entry', () => {
    expect(kb.changelog[0].version).toBe(kb.version)
  })

  it.each(kb.conditions.map((c) => c.id))('%s: has at least one hallmark (weight-3) symptom', (conditionId) => {
    const condition = kb.conditions.find((c) => c.id === conditionId)
    expect(condition.symptoms.some((s) => s.weight === 3)).toBe(true)
  })

  it.each(kb.conditions.map((c) => c.id))('%s: every symptom weight is 1, 2, or 3', (conditionId) => {
    const condition = kb.conditions.find((c) => c.id === conditionId)
    for (const s of condition.symptoms) {
      expect([1, 2, 3], `${conditionId}.${s.id} has weight ${s.weight}`).toContain(s.weight)
    }
  })

  it('every condition_red_flags escalate_to is a real urgency level', () => {
    for (const condition of kb.conditions) {
      for (const rf of condition.condition_red_flags ?? []) {
        expect(URGENCY_ORDER, `${condition.id}: red flag "${rf.id}" escalates to unknown level "${rf.escalate_to}"`).toContain(rf.escalate_to)
      }
    }
  })

  it('global red flag symptom ids are unique', () => {
    const ids = kb.global_red_flags.map((r) => r.symptom)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('urgency ladder', () => {
  it('keeps the four levels in severity order — comparisons depend on the indexes', () => {
    expect(URGENCY_ORDER).toEqual(['self_care', 'see_doctor', 'urgent_care', 'emergency'])
  })
})
