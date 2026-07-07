import assert from 'node:assert/strict'
import { CreateOrgKpiSchema, UpdateOrgKpiSchema } from '../src/lib/validations'
import { canSetOrgKpiTargetAmount } from '../src/server/org-kpi-access'

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
  deptId: 'dept-001',
  evalYear: 2026,
  kpiType: 'QUANTITATIVE' as const,
  kpiCategory: '매출',
  kpiName: '팀 매출 목표',
  targetValueT: '1,000,000',
  weight: 30,
  difficulty: 'MEDIUM' as const,
}

// ── canSetOrgKpiTargetAmount ──────────────────────────────────────────────────

run('canSetOrgKpiTargetAmount: ROLE_ADMIN → true', () => {
  assert.ok(canSetOrgKpiTargetAmount('ROLE_ADMIN'))
})

run('canSetOrgKpiTargetAmount: ROLE_CEO → true', () => {
  assert.ok(canSetOrgKpiTargetAmount('ROLE_CEO'))
})

run('canSetOrgKpiTargetAmount: ROLE_MEMBER → false', () => {
  assert.ok(!canSetOrgKpiTargetAmount('ROLE_MEMBER'))
})

run('canSetOrgKpiTargetAmount: ROLE_TEAM_LEADER → false', () => {
  assert.ok(!canSetOrgKpiTargetAmount('ROLE_TEAM_LEADER'))
})

run('canSetOrgKpiTargetAmount: ROLE_SECTION_LEADER → false', () => {
  assert.ok(!canSetOrgKpiTargetAmount('ROLE_SECTION_LEADER'))
})

// ── CreateOrgKpiSchema: targetAmount ─────────────────────────────────────────

run('CREATE: targetAmount 미포함 → pass (optional)', () => {
  const result = CreateOrgKpiSchema.safeParse(BASE_CREATE)
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, undefined)
})

run('CREATE: targetAmount 유효한 정수 문자열 → pass, BigInt 변환', () => {
  const result = CreateOrgKpiSchema.safeParse({
    ...BASE_CREATE,
    targetAmount: '1000000000',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, BigInt(1_000_000_000))
})

run('CREATE: targetAmount 대액(1조) → pass, BigInt 정밀도 유지', () => {
  const result = CreateOrgKpiSchema.safeParse({
    ...BASE_CREATE,
    targetAmount: '1000000000000',
  })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, BigInt(1_000_000_000_000))
})

run('CREATE: targetAmount="0" → fail (양수 아님)', () => {
  const result = CreateOrgKpiSchema.safeParse({
    ...BASE_CREATE,
    targetAmount: '0',
  })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /양수/)
})

run('CREATE: targetAmount 소수점 포함 → fail', () => {
  const result = CreateOrgKpiSchema.safeParse({
    ...BASE_CREATE,
    targetAmount: '100.5',
  })
  assert.ok(!result.success)
})

run('CREATE: targetAmount 비숫자 문자열 → fail', () => {
  const result = CreateOrgKpiSchema.safeParse({
    ...BASE_CREATE,
    targetAmount: 'abc',
  })
  assert.ok(!result.success)
})

run('CREATE: targetAmount=null → fail (Create는 null 미허용)', () => {
  const result = CreateOrgKpiSchema.safeParse({
    ...BASE_CREATE,
    targetAmount: null,
  })
  assert.ok(!result.success)
})

// ── UpdateOrgKpiSchema: targetAmount ─────────────────────────────────────────

run('UPDATE: targetAmount 미포함 → pass (optional)', () => {
  const result = UpdateOrgKpiSchema.safeParse({ kpiName: '수정된 KPI명' })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, undefined)
})

run('UPDATE: targetAmount 유효한 정수 문자열 → pass, BigInt 변환', () => {
  const result = UpdateOrgKpiSchema.safeParse({ targetAmount: '500000000' })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, BigInt(500_000_000))
})

run('UPDATE: targetAmount=null → pass (클리어 허용)', () => {
  const result = UpdateOrgKpiSchema.safeParse({ targetAmount: null })
  assert.ok(result.success, result.success ? '' : JSON.stringify(result.error.issues))
  assert.equal(result.data?.targetAmount, null)
})

run('UPDATE: targetAmount="0" → fail (양수 아님)', () => {
  const result = UpdateOrgKpiSchema.safeParse({ targetAmount: '0' })
  assert.ok(!result.success)
  assert.match(result.error.issues[0].message, /양수/)
})

run('UPDATE: targetAmount 소수점 포함 → fail', () => {
  const result = UpdateOrgKpiSchema.safeParse({ targetAmount: '1000.5' })
  assert.ok(!result.success)
})
