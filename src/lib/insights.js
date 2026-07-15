/**
 * Insights aggregation — reads outcome feedback from episode history and
 * produces the /insights dashboard data.
 *
 * HARD RULE: this module is read-only analysis. It produces advisory text
 * for a human to review; it never modifies conditions.json, never touches
 * the triage engine, and nothing here runs during scoring.
 *
 * Terminology:
 *   confirmed episode — outcome says "saw a doctor" AND the diagnosis was one
 *                       of the knowledge-base conditions (kind: 'condition').
 *   hit  — confirmed episode where the app ranked the true condition #1.
 *   miss — confirmed episode where the true condition ranked #2+, or didn't
 *          appear in the results at all.
 */

import kb from '../data/conditions.json'

/** Below this many confirmed outcomes, percentages mislead more than inform. */
export const MIN_SAMPLE = 5

const conditionById = Object.fromEntries(kb.conditions.map((c) => [c.id, c]))

export function conditionName(id) {
  return conditionById[id]?.name ?? id
}

/** Episodes that went through normal scoring (not the emergency override). */
function scoredEpisodes(history) {
  return history.filter((ep) => !ep.emergency && Array.isArray(ep.topResults))
}

/** Confirmed episodes that carry enough data (symptom ids) for analysis. */
function confirmedEpisodes(history) {
  return scoredEpisodes(history).filter(
    (ep) =>
      ep.outcome?.sawDoctor === 'yes' &&
      ep.outcome.diagnosis?.kind === 'condition' &&
      conditionById[ep.outcome.diagnosis.conditionId] &&
      Array.isArray(ep.symptomIds),
  )
}

/**
 * Per-condition scoreboard.
 * hitRate/missRate are null when confirmed < MIN_SAMPLE — the dashboard
 * shows "insufficient data" instead of a misleading percentage.
 */
export function conditionStats(history) {
  const scored = scoredEpisodes(history)
  const confirmed = confirmedEpisodes(history)

  return kb.conditions
    .map((c) => {
      const rankedFirst = scored.filter((ep) => ep.topResults[0]?.id === c.id).length
      const mine = confirmed.filter((ep) => ep.outcome.diagnosis.conditionId === c.id)
      const hits = mine.filter((ep) => ep.topResults[0]?.id === c.id).length
      const misses = mine.length - hits
      const enough = mine.length >= MIN_SAMPLE
      return {
        id: c.id,
        name: c.name,
        rankedFirst,
        confirmed: mine.length,
        hits,
        misses,
        hitRate: enough ? Math.round((hits / mine.length) * 100) : null,
        missRate: enough ? Math.round((misses / mine.length) * 100) : null,
        insufficientData: mine.length > 0 && !enough,
      }
    })
    .filter((s) => s.rankedFirst > 0 || s.confirmed > 0) // hide untouched conditions
    .sort((a, b) => b.confirmed - a.confirmed || b.rankedFirst - a.rankedFirst)
}

/**
 * Confusion list: "app said X, doctor said Y" pairs, most frequent first.
 * When nothing was ranked at all, X is reported as "(no match)".
 */
export function confusionPairs(history) {
  const counts = new Map()
  for (const ep of confirmedEpisodes(history)) {
    const actual = ep.outcome.diagnosis.conditionId
    const ranked = ep.topResults[0]?.id ?? null
    if (ranked === actual) continue // hits aren't confusion
    const key = `${ranked ?? '(none)'}→${actual}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [ranked, actual] = key.split('→')
      return {
        rankedId: ranked === '(none)' ? null : ranked,
        rankedName: ranked === '(none)' ? '(no match shown)' : conditionName(ranked),
        actualId: actual,
        actualName: conditionName(actual),
        count,
      }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * Detail for every miss: what the user reported vs. how the true condition
 * weighs its symptoms — so a human can see WHICH weight looks wrong.
 */
export function missDetails(history) {
  const misses = []
  for (const ep of confirmedEpisodes(history)) {
    const actualId = ep.outcome.diagnosis.conditionId
    if (ep.topResults[0]?.id === actualId) continue
    const truth = conditionById[actualId]
    const reported = new Set(ep.symptomIds)
    const rankOfTruth = ep.topResults.findIndex((r) => r.id === actualId)
    misses.push({
      episodeId: ep.id,
      date: ep.savedAt,
      actualId,
      actualName: truth.name,
      rankedFirstName: ep.topResults[0]?.name ?? '(no match shown)',
      truthRankLabel: rankOfTruth === -1 ? 'not in results' : `ranked #${rankOfTruth + 1}`,
      // Every weighted symptom of the true condition, flagged if reported:
      truthSymptoms: truth.symptoms.map((s) => ({
        ...s,
        reported: reported.has(s.id),
      })),
      // Reported symptoms the true condition does NOT list (possible additions):
      unlistedReported: ep.symptomIds
        .filter((id) => !truth.symptoms.some((s) => s.id === id))
        .map((id) => ({ id, label: ep.symptomLabels?.[ep.symptomIds.indexOf(id)] ?? id })),
      topResults: ep.topResults,
    })
  }
  return misses
}

/**
 * Advisory observations, generated per confirmed condition. NEVER auto-applied:
 * the output is plain language for a human who will decide whether to edit
 * conditions.json by hand (and record the change in its changelog).
 *
 * Heuristics (deliberately simple and transparent):
 *   - listed symptom reported in ≥75% of confirmed cases:
 *       weight 3 → confirmation ("no change needed")
 *       weight < 3 → "consider raising"
 *   - listed symptom with weight ≥ 2 reported in ≤25% of ≥4 cases → "consider lowering"
 *   - unlisted symptom reported in ≥75% of confirmed cases → "consider adding"
 * Raw counts are always cited so small samples stay honest.
 */
export function suggestions(history) {
  const confirmed = confirmedEpisodes(history)
  const byCondition = new Map()
  for (const ep of confirmed) {
    const id = ep.outcome.diagnosis.conditionId
    if (!byCondition.has(id)) byCondition.set(id, [])
    byCondition.get(id).push(ep)
  }

  const out = []
  for (const [conditionId, eps] of byCondition) {
    const condition = conditionById[conditionId]
    const N = eps.length
    if (N < 2) continue // one data point suggests nothing
    const small = N < MIN_SAMPLE
    const countReported = (symptomId) => eps.filter((ep) => ep.symptomIds.includes(symptomId)).length

    for (const s of condition.symptoms) {
      const n = countReported(s.id)
      const evidence = `${n} of ${N} confirmed ${condition.name} reports included "${s.label}"${small ? ' (small sample)' : ''}`
      if (n / N >= 0.75 && s.weight === 3) {
        out.push({ conditionId, type: 'confirm', text: `"${s.label}" is weighted 3 — no change needed.`, evidence })
      } else if (n / N >= 0.75 && s.weight < 3) {
        out.push({ conditionId, type: 'raise', text: `"${s.label}" is only weighted ${s.weight} — consider raising to ${s.weight + 1}.`, evidence })
      } else if (n / N <= 0.25 && s.weight >= 2 && N >= 4) {
        out.push({ conditionId, type: 'lower', text: `"${s.label}" is weighted ${s.weight} but rarely reported — consider lowering.`, evidence })
      }
    }

    // Symptoms users reported that the condition doesn't list at all
    const unlisted = new Map()
    for (const ep of eps) {
      for (const id of ep.symptomIds) {
        if (!condition.symptoms.some((s) => s.id === id)) {
          unlisted.set(id, (unlisted.get(id) ?? 0) + 1)
        }
      }
    }
    for (const [symptomId, n] of unlisted) {
      if (n / N >= 0.75) {
        out.push({
          conditionId,
          type: 'add',
          text: `"${symptomId.replaceAll('_', ' ')}" is not a weighted symptom of ${condition.name} — consider adding it (weight 1).`,
          evidence: `${n} of ${N} confirmed ${condition.name} reports included it${small ? ' (small sample)' : ''}`,
        })
      }
    }
  }
  return out
}

/** One-call summary used by the dashboard. */
export function analyze(history) {
  return {
    kbVersion: kb.version,
    changelog: kb.changelog ?? [],
    totalEpisodes: history.length,
    scoredCount: scoredEpisodes(history).length,
    outcomeCount: scoredEpisodes(history).filter((ep) => ep.outcome).length,
    confirmedCount: confirmedEpisodes(history).length,
    stats: conditionStats(history),
    confusion: confusionPairs(history),
    misses: missDetails(history),
    suggestions: suggestions(history),
  }
}
