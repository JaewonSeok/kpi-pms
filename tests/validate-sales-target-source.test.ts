import assert from 'node:assert/strict'
import { checkSalesKpiTargetSource } from '../src/lib/validate-sales-target-source'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

// ── 직접형 ───────────────────────────────────────────────────────────────────

run('직접형: personalTargetAmount > 0 → valid', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: BigInt(100_000_000),
    linkedOrgKpiId: null,
    orgKpiTargetAmount: null,
  })
  assert.ok(result.valid)
})

run('직접형: personalTargetAmount > 0, linkedOrgKpiId 있어도 → valid (개인 직접 입력 우선)', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: BigInt(50_000_000),
    linkedOrgKpiId: 'org-001',
    orgKpiTargetAmount: BigInt(200_000_000),
  })
  assert.ok(result.valid)
})

// ── 참조형 ───────────────────────────────────────────────────────────────────

run('참조형: personalTargetAmount=null + linkedOrgKpiId + orgKpiTargetAmount > 0 → valid', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: null,
    linkedOrgKpiId: 'org-001',
    orgKpiTargetAmount: BigInt(300_000_000),
  })
  assert.ok(result.valid)
})

// ── 거부 케이스 ───────────────────────────────────────────────────────────────

run('둘 다 없음: personalTargetAmount=null + linkedOrgKpiId=null → 거부', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: null,
    linkedOrgKpiId: null,
    orgKpiTargetAmount: null,
  })
  assert.ok(!result.valid)
  assert.equal(result.valid ? '' : result.code, 'SALES_KPI_NO_TARGET')
  assert.match(result.valid ? '' : result.message, /조직 KPI/)
})

run('연결 해제 거부: personalTargetAmount=null + linkedOrgKpiId=null (연결 제거 후 상태) → 거부', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: null,
    linkedOrgKpiId: null,
    orgKpiTargetAmount: null,
  })
  assert.ok(!result.valid)
  assert.equal(result.valid ? '' : result.code, 'SALES_KPI_NO_TARGET')
})

run('참조 대상 금액 없음: personalTargetAmount=null + linkedOrgKpiId 있음 + orgKpiTargetAmount=null → 거부', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: null,
    linkedOrgKpiId: 'org-001',
    orgKpiTargetAmount: null,
  })
  assert.ok(!result.valid)
  assert.equal(result.valid ? '' : result.code, 'ORG_KPI_NO_TARGET_AMOUNT')
  assert.match(result.valid ? '' : result.message, /매출 목표액/)
})

run('참조 대상 금액 0: orgKpiTargetAmount=0 → 거부', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: null,
    linkedOrgKpiId: 'org-001',
    orgKpiTargetAmount: BigInt(0),
  })
  assert.ok(!result.valid)
  assert.equal(result.valid ? '' : result.code, 'ORG_KPI_NO_TARGET_AMOUNT')
})

// ── 전환 케이스 ───────────────────────────────────────────────────────────────

run('직접→참조 전환: personalTargetAmount=null + linkedOrgKpiId + orgKpiTargetAmount 유효 → valid', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: null,
    linkedOrgKpiId: 'org-001',
    orgKpiTargetAmount: BigInt(5_000_000),
  })
  assert.ok(result.valid)
})

run('참조→직접 전환: personalTargetAmount > 0, orgKpiTargetAmount=null → valid (개인 값 우선)', () => {
  const result = checkSalesKpiTargetSource({
    personalTargetAmount: BigInt(80_000_000),
    linkedOrgKpiId: 'org-001',
    orgKpiTargetAmount: null,
  })
  assert.ok(result.valid)
})
