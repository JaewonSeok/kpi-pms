/**
 * shouldShowSalesBanner 단위 테스트.
 * SALES_REVENUE 다건 허용 후 배너 표시 조건 검증.
 */
import './register-path-aliases'
import assert from 'node:assert/strict'
import { shouldShowSalesBanner } from '../src/lib/personal-kpi-sales-banner'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

// ── 케이스 ④: SALES_REVENUE 보유 시에도 true ─────────────────────────────────
run('④ shouldShowSalesBanner: SALES_REVENUE 보유해도 true 반환', () => {
  const result = shouldShowSalesBanner({
    jobCategory: 'SALES',
    createDisabledReason: undefined,
    orgKpiOptions: [{ targetAmount: '500000000' }],
  })
  assert.equal(result, true)
})

// ── 케이스 ⑤: jobCategory가 'GENERAL' 이면 false ──────────────────────────────
run('⑤ shouldShowSalesBanner: GENERAL 직군 → false', () => {
  const result = shouldShowSalesBanner({
    jobCategory: 'GENERAL',
    createDisabledReason: undefined,
    orgKpiOptions: [{ targetAmount: '500000000' }],
  })
  assert.equal(result, false)
})

// ── 케이스 ⑥: orgKpiOptions에 targetAmount>0 없으면 false ────────────────────
run('⑥ shouldShowSalesBanner: targetAmount>0 없으면 false', () => {
  const result = shouldShowSalesBanner({
    jobCategory: 'SALES',
    createDisabledReason: undefined,
    orgKpiOptions: [{ targetAmount: null }, { targetAmount: '0' }],
  })
  assert.equal(result, false)
})
