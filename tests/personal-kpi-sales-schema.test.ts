import assert from 'node:assert/strict'
import { CreatePersonalKpiSchema, UpdatePersonalKpiSchema } from '../src/lib/validations'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const BASE_CREATE = {
  employeeId: 'emp-001',
  evalYear: 2026,
  kpiType: 'QUANTITATIVE' as const,
  kpiName: '매출 목표',
  weight: 30,
  difficulty: 'MEDIUM' as const,
}

// ── CreatePersonalKpiSchema: SALES_REVENUE ────────────────────────────────────

run('CREATE SALES_REVENUE 정상: targetAmount 있고 T/E/S 없음 → pass', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: '100000000',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(typeof result.data?.targetAmount, 'bigint')
  assert.equal(result.data?.targetAmount, BigInt(100_000_000))
})

run('CREATE SALES_REVENUE targetAmount 누락, linkedOrgKpiId도 없음 → fail (둘 다 없음)', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /조직 KPI/)
})

run('CREATE SALES_REVENUE targetAmount="0" → fail (양수 아님)', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: '0',
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /양수/)
})

run('CREATE SALES_REVENUE targetAmount 비숫자 문자열 → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: 'abc',
  })
  assert.ok(!result.success)
})

run('CREATE SALES_REVENUE targetAmount 소수점 포함 → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: '100.5',
  })
  assert.ok(!result.success)
})

run('CREATE SALES_REVENUE + targetValueT 동시 제출 → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: '100000000',
    targetValueT: 100,
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /targetValueT/)
})

run('CREATE SALES_REVENUE 대액: 1조 → pass, BigInt 정밀도 유지', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: '1000000000000',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, BigInt(1_000_000_000_000))
})

// ── CreatePersonalKpiSchema: GENERAL ─────────────────────────────────────────

run('CREATE GENERAL 정상: goalType 명시, targetValueT 있음 → pass', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'GENERAL',
    targetValueT: 100,
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.goalType, 'GENERAL')
})

run('CREATE GENERAL goalType 생략 → default GENERAL, targetValueT 필수', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    targetValueT: 50,
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.goalType, 'GENERAL')
})

run('CREATE GENERAL + targetAmount 포함 → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'GENERAL',
    targetValueT: 100,
    targetAmount: '5000',
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /GENERAL.*targetAmount/)
})

run('CREATE GENERAL targetValueT 누락 → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'GENERAL',
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /T 목표값/)
})

run('CREATE GENERAL T <= E <= S 정상 (T=80, E=90, S=110) → pass', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'GENERAL',
    targetValueT: 80,
    targetValueE: 90,
    targetValueS: 110,
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
})

run('CREATE GENERAL T > E 위반 (T=100, E=90) → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'GENERAL',
    targetValueT: 100,
    targetValueE: 90,
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /T <= E <= S/)
})

run('CREATE GENERAL E > S 위반 (T=80, E=110, S=100) → fail', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'GENERAL',
    targetValueT: 80,
    targetValueE: 110,
    targetValueS: 100,
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /T <= E <= S/)
})

// ── UpdatePersonalKpiSchema: SALES_REVENUE ────────────────────────────────────

run('UPDATE SALES_REVENUE: targetAmount 갱신 → pass, BigInt 변환', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'SALES_REVENUE',
    targetAmount: '200000000',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, BigInt(200_000_000))
})

run('UPDATE SALES_REVENUE targetAmount=0 → fail', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'SALES_REVENUE',
    targetAmount: '0',
  })
  assert.ok(!result.success)
})

run('UPDATE SALES_REVENUE + targetValueT → fail', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'SALES_REVENUE',
    targetAmount: '200000000',
    targetValueT: 100,
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /targetValueT/)
})

run('UPDATE GENERAL: targetAmount 포함 → fail', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'GENERAL',
    targetAmount: '5000',
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /GENERAL.*targetAmount/)
})

run('UPDATE goalType 미지정 + targetAmount만 → pass (서버가 현재 goalType으로 판단)', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    targetAmount: '300000000',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
})

run('UPDATE weight만 변경 → pass (기존 호환성)', () => {
  const result = UpdatePersonalKpiSchema.safeParse({ weight: 40 })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
})

// ── P3: 참조형 KPI — Create ───────────────────────────────────────────────────

run('CREATE SALES_REVENUE 참조형: targetAmount 없음 + linkedOrgKpiId 있음 → pass', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    linkedOrgKpiId: 'org-kpi-001',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, undefined)
  assert.equal(result.data?.linkedOrgKpiId, 'org-kpi-001')
})

run('CREATE SALES_REVENUE 직접형: targetAmount 있음 + linkedOrgKpiId 있음 → pass (직접 입력 우선)', () => {
  const result = CreatePersonalKpiSchema.safeParse({
    ...BASE_CREATE,
    goalType: 'SALES_REVENUE',
    targetAmount: '50000000',
    linkedOrgKpiId: 'org-kpi-001',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, BigInt(50_000_000))
})

// ── P3: 참조형 KPI — Update ───────────────────────────────────────────────────

run('UPDATE SALES_REVENUE targetAmount=null + linkedOrgKpiId 있음 → pass (직접→참조 전환)', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'SALES_REVENUE',
    targetAmount: null,
    linkedOrgKpiId: 'org-kpi-001',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, null)
})

run('UPDATE SALES_REVENUE targetAmount=null + linkedOrgKpiId=null → fail (둘 다 null)', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'SALES_REVENUE',
    targetAmount: null,
    linkedOrgKpiId: null,
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /조직 KPI/)
})

run('UPDATE SALES_REVENUE targetAmount=null, linkedOrgKpiId 미전송 → pass (route가 DB 상태로 결정)', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'SALES_REVENUE',
    targetAmount: null,
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, null)
})

run('UPDATE GENERAL T/E/S 순서 정상 → pass', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'GENERAL',
    targetValueT: 70,
    targetValueE: 85,
    targetValueS: 100,
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
})

run('UPDATE GENERAL T > E 위반 → fail', () => {
  const result = UpdatePersonalKpiSchema.safeParse({
    goalType: 'GENERAL',
    targetValueT: 100,
    targetValueE: 80,
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /T <= E <= S/)
})
