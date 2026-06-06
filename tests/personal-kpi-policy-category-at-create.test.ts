import 'dotenv/config'
import './register-path-aliases'
import assert from 'node:assert/strict'
import {
  buildPolicyCategoryPersistenceAtCreate2026,
  POLICY_CATEGORY_SOURCE_2026,
} from '../src/lib/policy-category-sources-2026'
import { CreatePersonalKpiSchema } from '../src/lib/validations'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const FIXED_NOW = new Date('2026-06-07T01:23:45.000Z')

const BASE_VALID_KPI = {
  employeeId: 'emp-1',
  evalYear: 2026,
  kpiType: 'QUANTITATIVE' as const,
  kpiName: '테스트 KPI',
  targetValueT: 100,
  unit: '건',
  weight: 10,
  difficulty: 'MEDIUM' as const,
}

async function main() {
  // ────────────────────────────────────────────
  // helper — buildPolicyCategoryPersistenceAtCreate2026
  // ────────────────────────────────────────────

  await run('helper: source 상수 4종 정의 sanity', () => {
    assert.equal(POLICY_CATEGORY_SOURCE_2026.HR_MANUAL, '2026_POLICY_HR_MANUAL')
    assert.equal(POLICY_CATEGORY_SOURCE_2026.HR_KEEP_UNCLASSIFIED, '2026_POLICY_HR_KEEP_UNCLASSIFIED')
    assert.equal(POLICY_CATEGORY_SOURCE_2026.BACKFILL_AUTO_V1, '2026_POLICY_BACKFILL_AUTO_V1')
    assert.equal(POLICY_CATEGORY_SOURCE_2026.OWNER_AT_CREATE, '2026_POLICY_OWNER_AT_CREATE')
  })

  await run('helper: category=ORG_GOAL → 5 컬럼 정확히 set + source=OWNER_AT_CREATE + confidence=1', () => {
    const result = buildPolicyCategoryPersistenceAtCreate2026('ORG_GOAL', FIXED_NOW)
    assert.equal(result.policyCategory, 'ORG_GOAL')
    assert.equal(result.policyCategorySource, '2026_POLICY_OWNER_AT_CREATE')
    assert.equal(result.policyCategoryConfidence, 1)
    assert.equal(result.policyCategoryReviewedAt, FIXED_NOW)
    assert.equal(
      result.policyCategoryReviewNote,
      'Owner self-selected at personal KPI registration',
    )
  })

  await run('helper: category=PROJECT_T → policyCategory만 다르고 메타 4컬럼 동일', () => {
    const result = buildPolicyCategoryPersistenceAtCreate2026('PROJECT_T', FIXED_NOW)
    assert.equal(result.policyCategory, 'PROJECT_T')
    assert.equal(result.policyCategorySource, '2026_POLICY_OWNER_AT_CREATE')
    assert.equal(result.policyCategoryConfidence, 1)
    assert.equal(result.policyCategoryReviewedAt, FIXED_NOW)
  })

  await run('helper: category=PROJECT_K + DAILY_WORK 모두 정상 분류로 set', () => {
    for (const category of ['PROJECT_K', 'DAILY_WORK'] as const) {
      const result = buildPolicyCategoryPersistenceAtCreate2026(category, FIXED_NOW)
      assert.equal(result.policyCategory, category)
      assert.equal(result.policyCategorySource, '2026_POLICY_OWNER_AT_CREATE')
      assert.equal(result.policyCategoryConfidence, 1)
    }
  })

  await run('helper: category=null → 5 컬럼 전부 null (HR 사후 분류 흐름 유지)', () => {
    const result = buildPolicyCategoryPersistenceAtCreate2026(null, FIXED_NOW)
    assert.equal(result.policyCategory, null)
    assert.equal(result.policyCategorySource, null)
    assert.equal(result.policyCategoryConfidence, null)
    assert.equal(result.policyCategoryReviewedAt, null)
    assert.equal(result.policyCategoryReviewNote, null)
  })

  await run('helper: now 미주입 시 default new Date() 사용 (category non-null이면 reviewedAt instanceof Date)', () => {
    const before = Date.now()
    const result = buildPolicyCategoryPersistenceAtCreate2026('ORG_GOAL')
    const after = Date.now()
    assert.ok(result.policyCategoryReviewedAt instanceof Date)
    const reviewedMs = (result.policyCategoryReviewedAt as Date).getTime()
    assert.ok(reviewedMs >= before && reviewedMs <= after, 'default now는 호출 시각 범위 내')
  })

  // ────────────────────────────────────────────
  // schema — CreatePersonalKpiSchema.policyCategory
  // ────────────────────────────────────────────

  await run('schema: policyCategory 생략 통과 (optional)', () => {
    const result = CreatePersonalKpiSchema.safeParse(BASE_VALID_KPI)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.policyCategory, undefined)
    }
  })

  await run('schema: policyCategory=null 통과 (nullable)', () => {
    const result = CreatePersonalKpiSchema.safeParse({ ...BASE_VALID_KPI, policyCategory: null })
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.policyCategory, null)
    }
  })

  await run('schema: 유효 enum 4종 모두 통과', () => {
    for (const category of ['ORG_GOAL', 'PROJECT_T', 'PROJECT_K', 'DAILY_WORK']) {
      const result = CreatePersonalKpiSchema.safeParse({ ...BASE_VALID_KPI, policyCategory: category })
      assert.equal(result.success, true, `${category} 통과해야 함`)
      if (result.success) {
        assert.equal(result.data.policyCategory, category)
      }
    }
  })

  await run('schema: 잘못된 enum 값 거부', () => {
    for (const invalid of ['INVALID', 'org_goal', 'UNKNOWN', '', 'OWNER_AT_CREATE']) {
      const result = CreatePersonalKpiSchema.safeParse({ ...BASE_VALID_KPI, policyCategory: invalid })
      assert.equal(result.success, false, `${JSON.stringify(invalid)} 거부해야 함`)
    }
  })

  await run('schema: 잘못된 타입(number/object) 거부', () => {
    assert.equal(
      CreatePersonalKpiSchema.safeParse({ ...BASE_VALID_KPI, policyCategory: 1 }).success,
      false,
    )
    assert.equal(
      CreatePersonalKpiSchema.safeParse({ ...BASE_VALID_KPI, policyCategory: { code: 'ORG_GOAL' } }).success,
      false,
    )
  })

  await run('schema: 기존 필수 검증(refine T<=E<=S) 그대로 유효 — policyCategory 추가가 영향 X', () => {
    const ok = CreatePersonalKpiSchema.safeParse({
      ...BASE_VALID_KPI,
      targetValueT: 50,
      targetValueE: 70,
      targetValueS: 90,
      policyCategory: 'ORG_GOAL',
    })
    assert.equal(ok.success, true)

    const bad = CreatePersonalKpiSchema.safeParse({
      ...BASE_VALID_KPI,
      targetValueT: 90,
      targetValueE: 70, // T > E → 거부
      policyCategory: 'ORG_GOAL',
    })
    assert.equal(bad.success, false)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
