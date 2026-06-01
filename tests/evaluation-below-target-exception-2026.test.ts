import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'
import {
  applyBelowTargetOrgGoalException2026,
  calculateEvaluationScore2026,
  calculateItemScore2026,
  shouldApplyBelowTargetException2026,
  type BelowTargetExceptionRuleOverride,
  type EvaluationScore2026ItemInput,
  type EvaluationScore2026ItemScore,
} from '../src/server/evaluation-scoring-2026'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

// rule.active=true 시뮬레이션용 주입 객체 — 정책 상수는 손대지 않음.
const ACTIVE_RULE: BelowTargetExceptionRuleOverride = {
  active: true,
  exceptionScore: 80,
  cycleYear: 2026,
}

function buildScore(input: EvaluationScore2026ItemInput): EvaluationScore2026ItemScore {
  const result = calculateItemScore2026(input)
  if (!result.ok) {
    throw new Error(`buildScore failed: ${JSON.stringify(result.errors)}`)
  }
  return result.value
}

async function main() {
  // ────────────────────────────────────────────
  // 정책 상수 sanity
  // ────────────────────────────────────────────
  await run('정책 상수: belowTargetExceptionRule dormant (active=false), exceptionScore=80', () => {
    assert.equal(EVALUATION_POLICY_2026.belowTargetExceptionRule.active, false)
    assert.equal(EVALUATION_POLICY_2026.belowTargetExceptionRule.exceptionScore, 80)
    assert.equal(EVALUATION_POLICY_2026.belowTargetExceptionRule.appliesTo, 'ORG_GOAL')
    assert.equal(
      EVALUATION_POLICY_2026.belowTargetExceptionRule.requiresLinkedItemCategory,
      'PROJECT_T',
    )
    assert.equal(EVALUATION_POLICY_2026.belowTargetExceptionRule.cycleYear, 2026)
  })

  // ────────────────────────────────────────────
  // shouldApplyBelowTargetException2026 — 게이트
  // ────────────────────────────────────────────
  await run('shouldApply: dormant(active=false)면 모든 cycleYear에서 false', () => {
    assert.equal(shouldApplyBelowTargetException2026({ cycleYear: 2026 }), false)
    assert.equal(shouldApplyBelowTargetException2026({ cycleYear: 2025 }), false)
  })

  await run('shouldApply: 주입 rule.active=true + cycleYear=2026 → true', () => {
    assert.equal(
      shouldApplyBelowTargetException2026({ cycleYear: 2026, rule: ACTIVE_RULE }),
      true,
    )
  })

  await run('shouldApply: 주입 rule.active=true + cycleYear=2025 → false', () => {
    assert.equal(
      shouldApplyBelowTargetException2026({ cycleYear: 2025, rule: ACTIVE_RULE }),
      false,
    )
  })

  // ────────────────────────────────────────────
  // applyBelowTargetOrgGoalException2026 — pass 단독
  // ────────────────────────────────────────────
  await run('dormant(현재 정책): BELOW_TARGET ORG_GOAL + Target↑ PROJECT_T → 예외 미적용 (점수 그대로)', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1',
      category: 'ORG_GOAL',
      achievementLevel: 'BELOW_TARGET',
      score: 70,
      weight: 50,
      linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1',
      category: 'PROJECT_T',
      achievementLevel: 'TARGET',
      weight: 50,
      linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      // rule 미전달 = 정책 상수(dormant) 사용
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 70)
    assert.equal(og.finalScore, 70)
  })

  await run('주입 rule.active=true + cycleYear=2025: skip (비2026)', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2025,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 70)
    assert.equal(og.finalScore, 70)
  })

  await run('주입 active + 2026 + BELOW_TARGET ORG_GOAL + 매칭 PROJECT_T TARGET → 80점 override', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 80)
    assert.equal(og.finalScore, 80)
    assert.equal(og.achievementLevel, 'BELOW_TARGET') // 변경 안 함 (Q3 결정)
  })

  await run('주입 active + 2026 + BELOW_TARGET ORG_GOAL + 매칭 PROJECT_T EXCELLENT → 80점 override', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 65,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'EXCELLENT',
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 80)
    assert.equal(og.finalScore, 80)
  })

  await run('주입 active + 2026 + BELOW_TARGET ORG_GOAL + 매칭 PROJECT_T BELOW_TARGET → 예외 미적용', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'BELOW_TARGET', score: 75,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 70)
    assert.equal(og.finalScore, 70)
  })

  await run('주입 active + 2026 + TARGET ORG_GOAL → exception 무관 (target 이상이라 적용 자체 안 됨)', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'TARGET',
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'EXCELLENT',
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 90) // TARGET baseline 유지
    assert.equal(og.finalScore, 90)
  })

  await run('주입 active + 2026 + BELOW_TARGET ORG_GOAL + 매칭 PROJECT_T 없음 → 미적용', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const dailyItem: EvaluationScore2026ItemInput = {
      id: 'dw-1', category: 'DAILY_WORK', score: 70, weight: 50,
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, dailyItem],
      itemScores: [buildScore(orgItem), buildScore(dailyItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 70)
    assert.equal(og.finalScore, 70)
  })

  await run('매칭 키: ORG_GOAL은 orgKpi-A 링크, PROJECT_T는 orgKpi-B 링크 → 미적용 (다른 OrgKpi)', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
      weight: 50, linkedOrgKpiId: 'orgKpi-B', // 다른 OrgKpi
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 70)
    assert.equal(og.finalScore, 70)
  })

  await run('매칭 키: ORG_GOAL.linkedOrgKpiId가 null → 미적용', () => {
    const orgItem: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 50, linkedOrgKpiId: null,
    }
    const projItem: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
      weight: 50, linkedOrgKpiId: 'orgKpi-A',
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [orgItem, projItem],
      itemScores: [buildScore(orgItem), buildScore(projItem)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og = result.find((r) => r.id === 'og-1')!
    assert.equal(og.baseScore, 70)
  })

  // ────────────────────────────────────────────
  // 다중 ORG_GOAL 독립 처리
  // ────────────────────────────────────────────
  await run('다중 ORG_GOAL: 각각 자기 매칭으로 독립 처리', () => {
    const og1: EvaluationScore2026ItemInput = {
      id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 25, linkedOrgKpiId: 'orgKpi-A',
    }
    const og2: EvaluationScore2026ItemInput = {
      id: 'og-2', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 65,
      weight: 25, linkedOrgKpiId: 'orgKpi-B',
    }
    const pt1: EvaluationScore2026ItemInput = {
      id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
      weight: 25, linkedOrgKpiId: 'orgKpi-A', // og-1 매칭
    }
    const pt2: EvaluationScore2026ItemInput = {
      id: 'pt-2', category: 'PROJECT_T', achievementLevel: 'BELOW_TARGET', score: 70,
      weight: 25, linkedOrgKpiId: 'orgKpi-B', // og-2 매칭 (BELOW_TARGET이라 예외 미적용)
    }
    const result = applyBelowTargetOrgGoalException2026({
      items: [og1, og2, pt1, pt2],
      itemScores: [buildScore(og1), buildScore(og2), buildScore(pt1), buildScore(pt2)],
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    const og1Score = result.find((r) => r.id === 'og-1')!
    const og2Score = result.find((r) => r.id === 'og-2')!
    assert.equal(og1Score.baseScore, 80) // 적용
    assert.equal(og1Score.finalScore, 80)
    assert.equal(og2Score.baseScore, 65) // 미적용
    assert.equal(og2Score.finalScore, 65)
  })

  // ────────────────────────────────────────────
  // calculateEvaluationScore2026 통합 — 조직 가중 평균에 80이 반영되는지
  // ────────────────────────────────────────────
  await run('통합: 주입 active + 2026 + 예외 적용 시 organizationPerformanceScore에 80 반영', () => {
    const result = calculateEvaluationScore2026({
      items: [
        // ORG_GOAL 항목 (BELOW_TARGET, score 70, weight 100% within ORG group)
        {
          id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
          weight: 50, linkedOrgKpiId: 'orgKpi-A',
        },
        // 매칭 PROJECT_T (TARGET → 90점)
        {
          id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
          weight: 50, linkedOrgKpiId: 'orgKpi-A',
        },
      ],
      cycleYear: 2026,
      belowTargetExceptionRule: ACTIVE_RULE,
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      // ORG_GOAL=80(override), PROJECT_T=90, organization weighted = 80 (단일 ORG)
      assert.equal(result.value.organizationPerformanceScore, 80)
      assert.equal(result.value.personalPerformanceScore, 90)
      // itemScores도 override된 값으로 노출
      const og = result.value.itemScores.find((s) => s.id === 'og-1')!
      assert.equal(og.baseScore, 80)
      assert.equal(og.finalScore, 80)
    }
  })

  await run('통합 dormant(현재): rule.active=false → organization 점수 70 그대로', () => {
    const result = calculateEvaluationScore2026({
      items: [
        {
          id: 'og-1', category: 'ORG_GOAL', achievementLevel: 'BELOW_TARGET', score: 70,
          weight: 50, linkedOrgKpiId: 'orgKpi-A',
        },
        {
          id: 'pt-1', category: 'PROJECT_T', achievementLevel: 'TARGET',
          weight: 50, linkedOrgKpiId: 'orgKpi-A',
        },
      ],
      cycleYear: 2026,
      // rule 미전달 = dormant
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.value.organizationPerformanceScore, 70)
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
