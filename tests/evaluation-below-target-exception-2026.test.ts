import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'
import {
  applyBelowTargetExceptionForPersistence2026,
  applyBelowTargetOrgGoalException2026,
  calculateEvaluationScore2026,
  calculateItemScore2026,
  shouldApplyBelowTargetException2026,
  type BelowTargetExceptionRuleOverride,
  type BelowTargetPersistenceItem2026,
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

  // ────────────────────────────────────────────
  // persistence helper — submit/draft 라우트 wiring 단위 검증
  // ★ dormant 무영향(=cutover 전 라우트 totalScore 비트단위 동일)이 가장 중요
  // ────────────────────────────────────────────
  await run('persistence helper: dormant default(rule 미주입) → Map 값 = 원본 normalizedScore', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: 70, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 95, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'TARGET' },
      { id: 'dw-1', category: 'DAILY_WORK', normalizedScore: 75, linkedOrgKpiId: null, achievementLevel: 'TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      // rule 미주입 → EVALUATION_POLICY_2026.belowTargetExceptionRule (현재 active=false dormant)
    })
    // dormant: 모든 항목의 effective = 원본 그대로
    assert.equal(effective.get('og-1'), 70, 'dormant이면 ORG_GOAL도 override 안 됨')
    assert.equal(effective.get('pt-1'), 95)
    assert.equal(effective.get('dw-1'), 75)
  })

  await run('persistence helper: active 주입 + ORG_GOAL BELOW_TARGET + PROJECT_T TARGET 매칭 → 80 override', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: 70, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 95, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(effective.get('og-1'), 80, 'active + 매칭 → ORG_GOAL 항목 80 override')
    assert.equal(effective.get('pt-1'), 95, 'PROJECT_T는 변경 없음')
  })

  await run('persistence helper: active이지만 PROJECT_T 미달성 → ORG_GOAL override 안 됨', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: 70, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 60, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(effective.get('og-1'), 70, '매칭 PROJECT_T가 BELOW_TARGET이면 ORG_GOAL 원본 유지')
  })

  await run('persistence helper: active이지만 다른 linkedOrgKpiId → override 안 됨', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: 70, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 95, linkedOrgKpiId: 'orgKpi-B', achievementLevel: 'TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(effective.get('og-1'), 70, '다른 OrgKpi 연결이면 매칭 안 됨')
  })

  await run('persistence helper: cycleYear !== 2026 → 모든 항목 원본 그대로', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: 70, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 95, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2025,
      rule: ACTIVE_RULE, // active이지만 cycleYear gate가 우선
    })
    assert.equal(effective.get('og-1'), 70)
    assert.equal(effective.get('pt-1'), 95)
  })

  await run('persistence helper: normalizedScore=null → Map에 미포함 (라우트 fallback에서 null 유지)', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: null, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 95, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(effective.has('og-1'), false, 'null score는 helper Map에 안 들어감 → 라우트의 ?? fallback에서 null 유지')
    assert.equal(effective.get('pt-1'), 95)
  })

  await run('persistence helper: category=null/UNKNOWN → Map은 원본 그대로(default 등록), override 미발동', () => {
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'unknown-1', category: null, normalizedScore: 50, linkedOrgKpiId: null, achievementLevel: null },
      { id: 'unknown-2', category: 'UNKNOWN', normalizedScore: 60, linkedOrgKpiId: 'orgKpi-A', achievementLevel: 'BELOW_TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    assert.equal(effective.get('unknown-1'), 50, 'category null도 default Map 등록은 됨 (원본)')
    assert.equal(effective.get('unknown-2'), 60, 'UNKNOWN도 동일')
  })

  // ────────────────────────────────────────────
  // ★ 결정적 검증: dormant에서 라우트 점수 계산 = PR 적용 전과 비트단위 동일
  // (라우트 직접 테스트는 NextAuth/Prisma 의존성 때문에 단위 회귀로 대체.
  //  helper Map.get(id) ?? normalizedScore 패턴이 dormant에서 원본 그대로임을 입증)
  // ────────────────────────────────────────────
  await run('★ dormant 라우트 회귀: helper로 계산한 effective와 원본이 모든 항목에서 정확히 동일', () => {
    // 실제 라우트가 보유할 법한 multi-category 시나리오 — 정책 상수 enforced=false 그대로
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'og-1', category: 'ORG_GOAL', normalizedScore: 65, linkedOrgKpiId: 'orgKpi-X', achievementLevel: 'BELOW_TARGET' },
      { id: 'og-2', category: 'ORG_GOAL', normalizedScore: 85, linkedOrgKpiId: 'orgKpi-Y', achievementLevel: 'TARGET' },
      { id: 'pt-1', category: 'PROJECT_T', normalizedScore: 92, linkedOrgKpiId: 'orgKpi-X', achievementLevel: 'EXCELLENT' },
      { id: 'pk-1', category: 'PROJECT_K', normalizedScore: 78, linkedOrgKpiId: null, achievementLevel: 'TARGET' },
      { id: 'dw-1', category: 'DAILY_WORK', normalizedScore: 73, linkedOrgKpiId: null, achievementLevel: 'TARGET' },
    ]
    const effective = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      // rule 미주입 = 현재 정책 상수(active=false)
    })
    // dormant: 모든 effective == 원본. 라우트의 ?? fallback이 무의미할 정도로 Map이 동일.
    for (const item of items) {
      assert.equal(
        effective.get(item.id),
        item.normalizedScore,
        `${item.id}: dormant이면 effective=${item.normalizedScore} (PR 적용 전과 동일)`,
      )
    }
  })

  await run('★ dormant 라우트 회귀: weightedScore 합산도 PR 적용 전과 동일 (calcWeightedScore 시뮬레이션)', () => {
    // 라우트 pass 2의 `effectiveScore = Map.get(id) ?? normalizedScore` 패턴 시뮬레이션
    const items: BelowTargetPersistenceItem2026[] = [
      { id: 'a', category: 'ORG_GOAL', normalizedScore: 65, linkedOrgKpiId: 'orgKpi-X', achievementLevel: 'BELOW_TARGET' },
      { id: 'b', category: 'PROJECT_T', normalizedScore: 92, linkedOrgKpiId: 'orgKpi-X', achievementLevel: 'EXCELLENT' },
    ]
    const weights = new Map<string, number>([['a', 50], ['b', 50]])

    // dormant: effective = 원본
    const effectiveDormant = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
    })
    let totalDormant = 0
    for (const item of items) {
      const effective = effectiveDormant.get(item.id) ?? item.normalizedScore
      if (effective != null) totalDormant += (effective * (weights.get(item.id) ?? 0)) / 100
    }
    // PR 적용 전 totalScore: (65*50 + 92*50)/100 = 78.5
    assert.equal(totalDormant, 78.5)

    // active 주입: ORG_GOAL 65 → 80으로 override → (80*50 + 92*50)/100 = 86
    const effectiveActive = applyBelowTargetExceptionForPersistence2026({
      items,
      cycleYear: 2026,
      rule: ACTIVE_RULE,
    })
    let totalActive = 0
    for (const item of items) {
      const effective = effectiveActive.get(item.id) ?? item.normalizedScore
      if (effective != null) totalActive += (effective * (weights.get(item.id) ?? 0)) / 100
    }
    assert.equal(totalActive, 86, 'active이면 ORG_GOAL이 80으로 override되어 합산 결과 변경')
    assert.notEqual(totalDormant, totalActive, 'dormant와 active 결과 다름 — wiring이 실제 작동한다는 증거')
  })

  await run('★ 정책 상수 sanity: belowTargetExceptionRule.active=false (cutover 전 dormant 확인)', () => {
    assert.equal(EVALUATION_POLICY_2026.belowTargetExceptionRule.active, false)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
