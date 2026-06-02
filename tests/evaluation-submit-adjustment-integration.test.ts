import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import { SubmitEvaluationSchema, SaveEvaluationDraftSchema } from '../src/lib/validations'
import {
  ALLOWED_ADJUSTMENT_STAGES_2026,
  shouldApplyAdjustmentRule2026,
  validateAdjustment2026,
} from '../src/server/evaluation-scoring-2026'
import { EVALUATION_POLICY_2026 } from '../src/lib/evaluation-policy-2026'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const validBody = {
  comment: '종합 의견 본문이 최소 50자 이상이어야 통과합니다. 이 문자열은 그 조건을 만족하도록 충분히 길게 작성되어 있습니다.',
  strengthComment: '강점을 잘 정리한 내용입니다.',
  improvementComment: '보완 포인트를 잘 정리한 내용입니다.',
}
const item = (overrides: Record<string, unknown> = {}) => ({ personalKpiId: 'pk-1', quantScore: 90, ...overrides })

async function main() {
  // ────────────────────────────────────────────
  // 분기 helper — shouldApplyAdjustmentRule2026
  // ────────────────────────────────────────────
  await run('현재 PR 상태(active=false) 확정', () => {
    assert.equal(EVALUATION_POLICY_2026.adjustmentRule.active, false)
  })

  await run('shouldApplyAdjustmentRule2026: active=false면 모든 case에서 false', () => {
    for (const stage of ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'] as const) {
      assert.equal(
        shouldApplyAdjustmentRule2026({ cycleYear: 2026, evalStage: stage }),
        false,
        `active=false인데 stage=${stage}에서 true 반환`,
      )
    }
  })

  await run('shouldApplyAdjustmentRule2026: cycleYear !== 2026이면 false', () => {
    assert.equal(shouldApplyAdjustmentRule2026({ cycleYear: 2025, evalStage: 'FIRST' }), false)
    assert.equal(shouldApplyAdjustmentRule2026({ cycleYear: 2027, evalStage: 'FIRST' }), false)
  })

  // ────────────────────────────────────────────
  // validateAdjustment2026 — submit 라우트 항목별 검증 (5케이스)
  // ────────────────────────────────────────────
  await run('① 정상: ORG_GOAL + TARGET + ±5 → 통과', () => {
    for (const score of [5, -5, 3, -2]) {
      const r = validateAdjustment2026({
        itemId: 'it-1',
        category: 'ORG_GOAL',
        achievementLevel: 'TARGET',
        baseScore: 90,
        adjustmentScore: score,
      })
      assert.equal(r.ok, true, `score=${score} 통과되어야 함`)
    }
  })

  await run('② 범위 밖: ±6 → ADJUSTMENT_OUT_OF_RANGE 거부', () => {
    for (const score of [6, -6, 10, -10]) {
      const r = validateAdjustment2026({
        itemId: 'it-2',
        category: 'PROJECT_T',
        achievementLevel: 'TARGET',
        baseScore: 90,
        adjustmentScore: score,
      })
      assert.equal(r.ok, false, `score=${score}는 거부되어야 함`)
      if (!r.ok) {
        assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_OUT_OF_RANGE'))
      }
    }
  })

  await run('③ DAILY_WORK: 가감점 비적용 카테고리 → ADJUSTMENT_CATEGORY_NOT_ALLOWED', () => {
    const r = validateAdjustment2026({
      itemId: 'it-3',
      category: 'DAILY_WORK',
      achievementLevel: 'TARGET',
      baseScore: 80,
      adjustmentScore: 3,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_CATEGORY_NOT_ALLOWED'))
    }
  })

  await run('④ Target 미만 — achievementLevel=BELOW_TARGET → ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED', () => {
    const r = validateAdjustment2026({
      itemId: 'it-4a',
      category: 'PROJECT_K',
      achievementLevel: 'BELOW_TARGET',
      baseScore: 79,
      adjustmentScore: 2,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED'))
    }
  })

  await run('④ Target 미만 — baseScore < target (정책 target 자동 비교) → 거부', () => {
    // ORG_GOAL target=90. baseScore=85면 below.
    const r = validateAdjustment2026({
      itemId: 'it-4b',
      category: 'ORG_GOAL',
      baseScore: 85,
      adjustmentScore: 2,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED'))
    }
  })

  await run('⑤ reason 누락 — Submit schema superRefine으로 거부', () => {
    const r = SubmitEvaluationSchema.safeParse({
      ...validBody,
      items: [item({ adjustmentScore: 3 })], // reason 없음
    })
    assert.equal(r.success, false)
    if (!r.success) {
      assert.ok(r.error.issues.some((i) => i.path.includes('adjustmentReason')))
    }
  })

  // ────────────────────────────────────────────
  // 전체 흐름 정상 케이스 (schema + validation 둘 다 통과)
  // ────────────────────────────────────────────
  await run('정상 시나리오: schema 통과 + validateAdjustment 통과 + groupKey 그대로 전달', () => {
    const body = {
      ...validBody,
      items: [
        item({
          adjustmentScore: 3,
          adjustmentGroupKey: 'proj-shared-123',
          adjustmentReason: '핵심 기여',
        }),
      ],
    }
    const schema = SubmitEvaluationSchema.safeParse(body)
    assert.equal(schema.success, true)

    const validation = validateAdjustment2026({
      itemId: 'it-ok',
      category: 'PROJECT_T',
      achievementLevel: 'TARGET',
      baseScore: 90,
      adjustmentScore: 3,
    })
    assert.equal(validation.ok, true)
  })

  await run('adjustmentScore=0 또는 누락 → validateAdjustment 즉시 통과 (검증 skip)', () => {
    assert.equal(
      validateAdjustment2026({
        itemId: 'it-zero',
        category: 'DAILY_WORK',
        baseScore: 80,
        adjustmentScore: 0,
      }).ok,
      true,
      'adjustmentScore=0이면 DAILY_WORK여도 통과 (검증 미진입)',
    )
    assert.equal(
      validateAdjustment2026({
        itemId: 'it-undef',
        category: 'DAILY_WORK',
        baseScore: 80,
      }).ok,
      true,
      'adjustmentScore 누락이면 통과 (검증 미진입)',
    )
  })

  // ────────────────────────────────────────────
  // ALLOWED set + 9단계 footgun 방어
  // ────────────────────────────────────────────
  await run('ALLOWED_ADJUSTMENT_STAGES_2026 = {FIRST, SECOND, FINAL} 3개', () => {
    assert.equal(ALLOWED_ADJUSTMENT_STAGES_2026.size, 3)
    assert.ok(ALLOWED_ADJUSTMENT_STAGES_2026.has('FIRST'))
    assert.ok(ALLOWED_ADJUSTMENT_STAGES_2026.has('SECOND'))
    assert.ok(ALLOWED_ADJUSTMENT_STAGES_2026.has('FINAL'))
    assert.equal(ALLOWED_ADJUSTMENT_STAGES_2026.has('SELF'), false)
    assert.equal(ALLOWED_ADJUSTMENT_STAGES_2026.has('CEO_ADJUST'), false)
  })

  // ────────────────────────────────────────────
  // enforceTargetGate = true (default, submit 라우트)
  // ────────────────────────────────────────────
  await run('enforceTargetGate=true(기본): basePolicyScore + achievementLevel 둘 다 없으면 PRECONDITION_MISSING', () => {
    const r = validateAdjustment2026({
      itemId: 'it-pre',
      category: 'ORG_GOAL',
      baseScore: null,
      achievementLevel: null,
      adjustmentScore: 3,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_PRECONDITION_MISSING'))
    }
  })

  await run('enforceTargetGate=true: achievementLevel만 있고 baseScore 없으면 BELOW_TARGET 첫째 분기 작동', () => {
    const r = validateAdjustment2026({
      itemId: 'it-al-only',
      category: 'PROJECT_T',
      achievementLevel: 'BELOW_TARGET',
      baseScore: null,
      adjustmentScore: 2,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_BELOW_TARGET_NOT_ALLOWED'))
    }
  })

  await run('enforceTargetGate=true: achievementLevel=TARGET + baseScore null → 통과 (precondition pass + below 아님)', () => {
    const r = validateAdjustment2026({
      itemId: 'it-target-only',
      category: 'ORG_GOAL',
      achievementLevel: 'TARGET',
      baseScore: null,
      adjustmentScore: 3,
    })
    assert.equal(r.ok, true)
  })

  // ────────────────────────────────────────────
  // enforceTargetGate = false (draft 라우트)
  // ────────────────────────────────────────────
  await run('enforceTargetGate=false: 둘 다 null이어도 PRECONDITION 미차단 (draft)', () => {
    const r = validateAdjustment2026({
      itemId: 'it-draft-pre',
      category: 'ORG_GOAL',
      baseScore: null,
      achievementLevel: null,
      adjustmentScore: 3,
      enforceTargetGate: false,
    })
    assert.equal(r.ok, true)
  })

  await run('enforceTargetGate=false: achievementLevel=BELOW_TARGET이어도 미차단 (draft, submit에 위임)', () => {
    const r = validateAdjustment2026({
      itemId: 'it-draft-below',
      category: 'PROJECT_T',
      achievementLevel: 'BELOW_TARGET',
      baseScore: 70,
      adjustmentScore: 2,
      enforceTargetGate: false,
    })
    assert.equal(r.ok, true)
  })

  await run('enforceTargetGate=false: ±5 범위 위반은 여전히 차단', () => {
    const r = validateAdjustment2026({
      itemId: 'it-draft-range',
      category: 'PROJECT_T',
      baseScore: null,
      adjustmentScore: 6,
      enforceTargetGate: false,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_OUT_OF_RANGE'))
    }
  })

  await run('enforceTargetGate=false: DAILY_WORK 카테고리는 여전히 차단', () => {
    const r = validateAdjustment2026({
      itemId: 'it-draft-cat',
      category: 'DAILY_WORK',
      baseScore: null,
      adjustmentScore: 2,
      enforceTargetGate: false,
    })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.ok(r.errors.some((e) => e.code === 'ADJUSTMENT_CATEGORY_NOT_ALLOWED'))
    }
  })

  // ────────────────────────────────────────────
  // draft schema (SaveEvaluationDraftSchema) + 통합
  // ────────────────────────────────────────────
  await run('Draft: ±6 → schema에서 거부 (라우트 도달 전)', () => {
    const r = SaveEvaluationDraftSchema.safeParse({
      items: [item({ adjustmentScore: 6, adjustmentReason: 'r' })],
    })
    assert.equal(r.success, false)
  })

  await run('Draft: reason 누락 → schema superRefine으로 거부', () => {
    const r = SaveEvaluationDraftSchema.safeParse({
      items: [item({ adjustmentScore: 2 })],
    })
    assert.equal(r.success, false)
  })

  await run('Draft: 정상 시나리오 schema 통과 + enforceTargetGate=false 검증 통과', () => {
    const schemaResult = SaveEvaluationDraftSchema.safeParse({
      items: [item({ adjustmentScore: 2, adjustmentGroupKey: 'proj-shared-1', adjustmentReason: 'r' })],
    })
    assert.equal(schemaResult.success, true)

    const validation = validateAdjustment2026({
      itemId: 'it-draft-ok',
      category: 'PROJECT_K',
      baseScore: null,
      adjustmentScore: 2,
      enforceTargetGate: false,
    })
    assert.equal(validation.ok, true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
