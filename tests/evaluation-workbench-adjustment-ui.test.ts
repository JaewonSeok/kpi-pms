import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import {
  ALLOWED_ADJUSTMENT_CATEGORIES_2026,
  buildAdjustmentPayloadFromDraft,
  deriveAdjustmentGroupKey,
  resolveAdjustmentFieldVisibility,
  validateAdjustmentClientUx,
} from '../src/lib/evaluation-adjustment-2026-ui'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  // ────────────────────────────────────────────
  // ALLOWED 카테고리 set
  // ────────────────────────────────────────────
  await run('ALLOWED_ADJUSTMENT_CATEGORIES_2026 = {ORG_GOAL, PROJECT_T, PROJECT_K} 3개', () => {
    assert.equal(ALLOWED_ADJUSTMENT_CATEGORIES_2026.size, 3)
    assert.ok(ALLOWED_ADJUSTMENT_CATEGORIES_2026.has('ORG_GOAL'))
    assert.ok(ALLOWED_ADJUSTMENT_CATEGORIES_2026.has('PROJECT_T'))
    assert.ok(ALLOWED_ADJUSTMENT_CATEGORIES_2026.has('PROJECT_K'))
    assert.equal(ALLOWED_ADJUSTMENT_CATEGORIES_2026.has('DAILY_WORK'), false)
  })

  // ────────────────────────────────────────────
  // deriveAdjustmentGroupKey
  // ────────────────────────────────────────────
  await run('groupKey: ORG_GOAL + linkedOrgKpiId → linkedOrgKpiId 반환', () => {
    assert.equal(
      deriveAdjustmentGroupKey({ category: 'ORG_GOAL', linkedOrgKpiId: 'org-1' }),
      'org-1'
    )
  })

  await run('groupKey: ORG_GOAL + linkedOrgKpiId null → null', () => {
    assert.equal(deriveAdjustmentGroupKey({ category: 'ORG_GOAL', linkedOrgKpiId: null }), null)
  })

  await run('groupKey: PROJECT_T → null (스키마에 공유 프로젝트 id 없음, TODO)', () => {
    assert.equal(deriveAdjustmentGroupKey({ category: 'PROJECT_T', linkedOrgKpiId: 'org-1' }), null)
  })

  await run('groupKey: PROJECT_K → null (스키마에 공유 프로젝트 id 없음, TODO)', () => {
    assert.equal(deriveAdjustmentGroupKey({ category: 'PROJECT_K', linkedOrgKpiId: 'org-1' }), null)
  })

  await run('groupKey: DAILY_WORK → null', () => {
    assert.equal(deriveAdjustmentGroupKey({ category: 'DAILY_WORK', linkedOrgKpiId: 'x' }), null)
  })

  await run('groupKey: category=null → null', () => {
    assert.equal(deriveAdjustmentGroupKey({ category: null, linkedOrgKpiId: 'x' }), null)
  })

  // ────────────────────────────────────────────
  // resolveAdjustmentFieldVisibility
  // ────────────────────────────────────────────
  await run('visibility: canAdjustScore=false → false', () => {
    assert.equal(
      resolveAdjustmentFieldVisibility({
        canAdjustScore: false,
        policyCategory: 'ORG_GOAL',
        groupKey: 'org-1',
      }).visible,
      false
    )
  })

  await run('visibility: canAdjustScore=true + DAILY_WORK → false', () => {
    assert.equal(
      resolveAdjustmentFieldVisibility({
        canAdjustScore: true,
        policyCategory: 'DAILY_WORK',
        groupKey: 'x',
      }).visible,
      false
    )
  })

  await run('visibility: canAdjustScore=true + policyCategory=null → false', () => {
    assert.equal(
      resolveAdjustmentFieldVisibility({
        canAdjustScore: true,
        policyCategory: null,
        groupKey: 'x',
      }).visible,
      false
    )
  })

  await run('visibility: canAdjustScore=true + ORG_GOAL + groupKey=null → false (dormant v1)', () => {
    assert.equal(
      resolveAdjustmentFieldVisibility({
        canAdjustScore: true,
        policyCategory: 'ORG_GOAL',
        groupKey: null,
      }).visible,
      false
    )
  })

  await run('visibility: canAdjustScore=true + ORG_GOAL + groupKey → true', () => {
    assert.equal(
      resolveAdjustmentFieldVisibility({
        canAdjustScore: true,
        policyCategory: 'ORG_GOAL',
        groupKey: 'org-1',
      }).visible,
      true
    )
  })

  await run('visibility: canAdjustScore=true + PROJECT_T → false (groupKey null, dormant v1)', () => {
    // PROJECT는 스키마 보완 전까지 groupKey null이므로 무조건 invisible.
    const groupKey = deriveAdjustmentGroupKey({ category: 'PROJECT_T', linkedOrgKpiId: 'org-1' })
    assert.equal(groupKey, null)
    assert.equal(
      resolveAdjustmentFieldVisibility({
        canAdjustScore: true,
        policyCategory: 'PROJECT_T',
        groupKey,
      }).visible,
      false
    )
  })

  // ────────────────────────────────────────────
  // buildAdjustmentPayloadFromDraft
  // ────────────────────────────────────────────
  await run('payload: visibility=false → 3필드 모두 null', () => {
    const result = buildAdjustmentPayloadFromDraft({
      draft: { adjustmentScore: 3, adjustmentReason: 'r' },
      item: { policyCategory: 'DAILY_WORK', linkedOrgKpiId: 'org-1' },
      canAdjustScore: true,
    })
    assert.deepEqual(result, {
      adjustmentScore: null,
      adjustmentGroupKey: null,
      adjustmentReason: null,
    })
  })

  await run('payload: visible + score=0 → 3필드 null (가감점 의도 없음)', () => {
    const result = buildAdjustmentPayloadFromDraft({
      draft: { adjustmentScore: 0, adjustmentReason: '' },
      item: { policyCategory: 'ORG_GOAL', linkedOrgKpiId: 'org-1' },
      canAdjustScore: true,
    })
    assert.deepEqual(result, {
      adjustmentScore: null,
      adjustmentGroupKey: null,
      adjustmentReason: null,
    })
  })

  await run('payload: visible + score=undefined → 3필드 null', () => {
    const result = buildAdjustmentPayloadFromDraft({
      draft: {},
      item: { policyCategory: 'ORG_GOAL', linkedOrgKpiId: 'org-1' },
      canAdjustScore: true,
    })
    assert.deepEqual(result, {
      adjustmentScore: null,
      adjustmentGroupKey: null,
      adjustmentReason: null,
    })
  })

  await run('payload: ORG_GOAL + score=3 + reason → 3필드 채움 (groupKey=linkedOrgKpiId)', () => {
    const result = buildAdjustmentPayloadFromDraft({
      draft: { adjustmentScore: 3, adjustmentReason: '핵심 기여' },
      item: { policyCategory: 'ORG_GOAL', linkedOrgKpiId: 'org-1' },
      canAdjustScore: true,
    })
    assert.deepEqual(result, {
      adjustmentScore: 3,
      adjustmentGroupKey: 'org-1',
      adjustmentReason: '핵심 기여',
    })
  })

  await run('payload: ORG_GOAL + score=-5 + reason trim 처리 → reason 공백 제거', () => {
    const result = buildAdjustmentPayloadFromDraft({
      draft: { adjustmentScore: -5, adjustmentReason: '  미흡  ' },
      item: { policyCategory: 'ORG_GOAL', linkedOrgKpiId: 'org-1' },
      canAdjustScore: true,
    })
    assert.deepEqual(result, {
      adjustmentScore: -5,
      adjustmentGroupKey: 'org-1',
      adjustmentReason: '미흡',
    })
  })

  await run('payload: PROJECT_T → visibility=false 경로 → 3필드 null', () => {
    const result = buildAdjustmentPayloadFromDraft({
      draft: { adjustmentScore: 2, adjustmentReason: 'r' },
      item: { policyCategory: 'PROJECT_T', linkedOrgKpiId: 'org-1' },
      canAdjustScore: true,
    })
    assert.deepEqual(result, {
      adjustmentScore: null,
      adjustmentGroupKey: null,
      adjustmentReason: null,
    })
  })

  // ────────────────────────────────────────────
  // validateAdjustmentClientUx (DRY: schema superRefine과 동일 출처)
  // ────────────────────────────────────────────
  await run('UX: score=0 → ok=true', () => {
    const r = validateAdjustmentClientUx({ adjustmentScore: 0 })
    assert.equal(r.ok, true)
  })

  await run('UX: score=undefined → ok=true', () => {
    const r = validateAdjustmentClientUx({})
    assert.equal(r.ok, true)
  })

  await run('UX: score=3 + reason 공백만 → ok=false', () => {
    const r = validateAdjustmentClientUx({ adjustmentScore: 3, adjustmentReason: '   ' })
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.match(r.message, /사유/)
    }
  })

  await run('UX: score=3 + reason 정상 → ok=true', () => {
    const r = validateAdjustmentClientUx({ adjustmentScore: 3, adjustmentReason: '핵심 기여' })
    assert.equal(r.ok, true)
  })

  await run('UX: score=-5 + reason 정상 → ok=true', () => {
    const r = validateAdjustmentClientUx({ adjustmentScore: -5, adjustmentReason: 'ok' })
    assert.equal(r.ok, true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
