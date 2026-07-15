/**
 * SymptomScout triage engine
 * --------------------------
 * Pure functions only — no React, no DOM. The knowledge base lives in
 * src/data/conditions.json; this file just interprets it. To add or edit
 * conditions you should never need to touch this file.
 *
 * PIPELINE (in priority order):
 *   1. RED FLAG CHECK — if any global red flag was reported, everything else
 *      is skipped and the app shows the emergency screen. Safety first.
 *   2. DERIVED FLAGS — follow-up answers (fever, duration, injury) are turned
 *      into synthetic symptom ids so the JSON red-flag rules can react to them.
 *   3. SCORING — every condition gets a weighted match score.
 *   4. ESCALATION — condition-level red flags and answer-based modifiers
 *      (including per-symptom severity ratings) can only ever RAISE urgency,
 *      never lower it. Severity never changes match scoring.
 */

import kb from '../data/conditions.json'

/* ------------------------------------------------------------------ */
/* Urgency levels                                                      */
/* ------------------------------------------------------------------ */

// Order matters: index = severity rank. Comparisons use this array.
export const URGENCY_ORDER = ['self_care', 'see_doctor', 'urgent_care', 'emergency']

export const URGENCY_INFO = {
  self_care: {
    label: 'Self-care',
    detail: 'This can usually be managed at home. See a doctor if it worsens or lasts longer than expected.',
  },
  see_doctor: {
    label: 'See a doctor within a few days',
    detail: 'Book an appointment with a doctor or clinic in the next few days.',
  },
  urgent_care: {
    label: 'Urgent care today',
    detail: 'Get seen today at an urgent care clinic or emergency department.',
  },
  emergency: {
    label: 'Call 911',
    detail: 'Call 911 or go to the nearest emergency department now.',
  },
}

/** Return the more severe of two urgency levels (never de-escalates). */
function maxUrgency(a, b) {
  return URGENCY_ORDER.indexOf(b) > URGENCY_ORDER.indexOf(a) ? b : a
}

/* ------------------------------------------------------------------ */
/* Symptom catalog & regions (drives the intake UI)                    */
/* ------------------------------------------------------------------ */

/**
 * Build { symptomId -> label } by scanning every condition in the JSON.
 * The first label wins; global red flag labels fill gaps. This means the
 * knowledge base is the single source of truth for symptom names.
 */
export function getSymptomCatalog() {
  const catalog = {}
  for (const condition of kb.conditions) {
    for (const s of condition.symptoms) {
      if (!catalog[s.id]) catalog[s.id] = s.label
    }
  }
  for (const rf of kb.global_red_flags) {
    if (!catalog[rf.symptom]) catalog[rf.symptom] = rf.label
  }
  return catalog
}

/** Fallback: turn an id like "swelling_behind_ear" into "Swelling behind ear". */
export function humanizeId(id) {
  const text = id.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function symptomLabel(id) {
  const catalog = getSymptomCatalog()
  if (catalog[id]) return catalog[id]
  const rf = kb.global_red_flags.find((r) => r.symptom === id)
  return rf ? rf.label : humanizeId(id)
}

/**
 * Regions for the intake flow. Each region's symptom ids come from the JSON;
 * any symptom used by a condition but not assigned to a region is appended to
 * the "general" region automatically, so new conditions can be added to the
 * JSON without editing region lists (or this code).
 */
export function getRegions() {
  const catalog = getSymptomCatalog()
  const assigned = new Set(kb.body_regions.flatMap((r) => r.symptoms))
  const unassigned = Object.keys(catalog).filter(
    (id) => !assigned.has(id) && !isGlobalRedFlag(id),
  )
  return kb.body_regions.map((region) => {
    const ids = region.id === 'general' ? [...region.symptoms, ...unassigned] : region.symptoms
    return {
      ...region,
      // Only offer symptoms that exist in the catalog (i.e. some condition
      // actually uses them) and that aren't global red flags — those are
      // asked separately on the safety screen.
      symptoms: ids
        .filter((id) => catalog[id] && !isGlobalRedFlag(id))
        .map((id) => ({ id, label: catalog[id] })),
    }
  })
}

/* ------------------------------------------------------------------ */
/* Step 1 — global red flags (hard override)                           */
/* ------------------------------------------------------------------ */

export function getGlobalRedFlags() {
  return kb.global_red_flags
}

function isGlobalRedFlag(id) {
  return kb.global_red_flags.some((r) => r.symptom === id)
}

/** Any reported global red flag short-circuits triage into emergency mode. */
export function checkGlobalRedFlags(reportedIds) {
  const reported = new Set(reportedIds)
  return kb.global_red_flags.filter((r) => reported.has(r.symptom))
}

/* ------------------------------------------------------------------ */
/* Per-symptom severity (urgency messaging only — never scoring)       */
/* ------------------------------------------------------------------ */

// Symptoms living in a region marked sensitive:true in the JSON (chest, head).
const SENSITIVE_SYMPTOM_IDS = new Set(
  kb.body_regions.filter((r) => r.sensitive).flatMap((r) => r.symptoms),
)

export const SEVERE_SYMPTOM_THRESHOLD = 8
const DEFAULT_SYMPTOM_SEVERITY = 5

/**
 * The user's selected symptoms that are BOTH in a sensitive region AND rated
 * >= 8/10. An unrated symptom defaults to 5, so users who skip the rating get
 * exactly the pre-severity behavior. Sorted worst-first.
 */
function severeSensitiveSymptoms(selectedIds, symptomSeverity = {}) {
  return [...selectedIds]
    .map((id) => ({ id, severity: symptomSeverity[id] ?? DEFAULT_SYMPTOM_SEVERITY }))
    .filter((s) => SENSITIVE_SYMPTOM_IDS.has(s.id) && s.severity >= SEVERE_SYMPTOM_THRESHOLD)
    .sort((a, b) => b.severity - a.severity)
}

/* ------------------------------------------------------------------ */
/* Step 2 — derived flags from follow-up answers                       */
/* ------------------------------------------------------------------ */

/**
 * Convert follow-up answers into synthetic symptom ids so JSON rules
 * (weights and condition_red_flags) can react to them.
 *
 * answers = {
 *   durationDays: number,            // how long symptoms have lasted
 *   severity: 1..10,                 // self-rated severity
 *   age: number,
 *   fever: 'none' | 'fever' | 'high',// 'high' = 104°F+
 *   recentInjury: boolean,
 * }
 */
export function deriveFlags(answers) {
  const flags = []
  if (answers.fever === 'fever' || answers.fever === 'high') flags.push('fever')
  if (answers.fever === 'high') flags.push('fever_over_104')
  if (answers.durationDays > 3) flags.push('symptoms_over_3_days')
  if (answers.durationDays > 10) flags.push('symptoms_over_10_days')
  if (answers.durationDays > 21) flags.push('cough_over_3_weeks')
  if (answers.recentInjury) flags.push('recent_injury')
  return flags
}

/* ------------------------------------------------------------------ */
/* Steps 3 & 4 — scoring and escalation                                */
/* ------------------------------------------------------------------ */

/**
 * SCORING ALGORITHM
 * -----------------
 * For each condition:
 *
 *   score     = sum of weights of the condition's symptoms the user reported
 *   maxScore  = sum of ALL the condition's symptom weights
 *   percent   = score / maxScore
 *
 * Weights (from the JSON _schema): 3 = hallmark, 2 = common, 1 = supporting.
 *
 * MATCHING RULE (from _schema.matching_rule): a condition only appears if the
 * user reported at least one weight-3 (hallmark) symptom for it, OR its
 * percent is >= 40%. This stops one vague symptom like "headache" from
 * surfacing every condition that merely lists it.
 *
 * ESCALATION (urgency can only go UP, never down):
 *   a) condition_red_flags: if a red flag id was reported or derived,
 *      escalate to its escalate_to level. Red flags NOT triggered are
 *      returned as "watchFor" warnings for the results screen.
 *   b) severity >= 8/10 escalates one level (capped at urgent_care —
 *      only explicit red flags may declare an emergency).
 *   c) age under 2 or 65+ escalates one level (same cap): the very young
 *      and older adults deteriorate faster and warrant earlier review.
 *   d) any selected symptom in a sensitive region (sensitive:true in the
 *      JSON: chest, head) rated >= 8/10 escalates one level (same cap) and
 *      surfaces a "consider seeking care" advisory. Per-symptom severity
 *      NEVER multiplies into match scores and NEVER touches red-flag logic —
 *      a red flag at severity 1 is still a red flag.
 *
 * Results are ranked by percent (tie-break: raw score), top 5 returned.
 */
export function runTriage(selectedIds, answers) {
  // Step 1: hard override — any global red flag ends triage immediately.
  const redFlags = checkGlobalRedFlags(selectedIds)
  if (redFlags.length > 0) {
    return { emergency: true, redFlags, results: [], overallUrgency: 'emergency' }
  }

  // Step 2: fold follow-up answers into the reported symptom set.
  const reported = new Set([...selectedIds, ...deriveFlags(answers)])

  // Per-symptom severity: computed once, applied as modifier (d) below.
  // Uses selectedIds (real user picks), not derived flags — only symptoms the
  // user rated can qualify.
  const severeSensitive = severeSensitiveSymptoms(selectedIds, answers.symptomSeverity)
  const severityAdvisory =
    severeSensitive.length > 0
      ? {
          id: severeSensitive[0].id,
          label: symptomLabel(severeSensitive[0].id),
          severity: severeSensitive[0].severity,
        }
      : null

  const results = []
  for (const condition of kb.conditions) {
    // --- score ---
    const matched = condition.symptoms.filter((s) => reported.has(s.id))
    const score = matched.reduce((sum, s) => sum + s.weight, 0)
    const maxScore = condition.symptoms.reduce((sum, s) => sum + s.weight, 0)
    const percent = maxScore > 0 ? score / maxScore : 0

    // --- matching rule ---
    const hasHallmark = matched.some((s) => s.weight === 3)
    if (!hasHallmark && percent < 0.4) continue
    if (matched.length === 0) continue

    // --- escalation (a): condition-level red flags ---
    let urgency = condition.urgency
    const triggeredFlags = []
    const watchFor = []
    for (const rf of condition.condition_red_flags ?? []) {
      if (reported.has(rf.id)) {
        urgency = maxUrgency(urgency, rf.escalate_to)
        triggeredFlags.push({ ...rf, label: symptomLabel(rf.id) })
      } else {
        watchFor.push({ ...rf, label: symptomLabel(rf.id) })
      }
    }

    // --- escalation (b) + (c): answer-based modifiers, capped below emergency ---
    const bumpOne = (level) =>
      maxUrgency(level, URGENCY_ORDER[Math.min(URGENCY_ORDER.indexOf(level) + 1, URGENCY_ORDER.indexOf('urgent_care'))])
    const modifiers = []
    if (answers.severity >= 8 && urgency !== 'emergency') {
      const bumped = bumpOne(urgency)
      if (bumped !== urgency) modifiers.push(`severity rated ${answers.severity}/10`)
      urgency = bumped
    }
    if ((answers.age < 2 || answers.age >= 65) && urgency !== 'emergency') {
      const bumped = bumpOne(urgency)
      if (bumped !== urgency) modifiers.push(`age ${answers.age}`)
      urgency = bumped
    }
    // (d) severe symptom in a sensitive region — one bump total, same cap.
    if (severityAdvisory && urgency !== 'emergency') {
      const bumped = bumpOne(urgency)
      if (bumped !== urgency)
        modifiers.push(`${severityAdvisory.label} rated ${severityAdvisory.severity}/10`)
      urgency = bumped
    }

    results.push({
      condition,
      score,
      maxScore,
      percent: Math.round(percent * 100),
      // "reasons" powers the plain-language explanation on the results screen.
      matchedSymptoms: matched.map((s) => ({
        ...s,
        hallmark: s.weight === 3,
      })),
      triggeredFlags,
      watchFor,
      modifiers,
      urgency,
    })
  }

  // Rank: best percentage first; raw score breaks ties.
  results.sort((a, b) => b.percent - a.percent || b.score - a.score)
  const top = results.slice(0, 5)

  // The banner shows the MOST urgent level among the top matches — if anything
  // plausible is serious, the user should hear about it.
  const overallUrgency = top.reduce((acc, r) => maxUrgency(acc, r.urgency), 'self_care')

  // severityAdvisory lets the results screen show a "consider seeking care"
  // note even when no condition matched (messaging only — no urgency value).
  return { emergency: false, redFlags: [], results: top, overallUrgency, severityAdvisory }
}
