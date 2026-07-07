import assert from 'node:assert/strict'
import { resolveItemScore } from '@/lib/evaluation-item-score'
import { calcSalesScore } from '@/lib/sales-score-policy-2026'
import { calcPdcaScore } from '@/lib/utils'

async function run() {
  let passed = 0
  let failed = 0

  function test(name: string, fn: () => void) {
    try {
      fn()
      console.log(`  PASS  ${name}`)
      passed++
    } catch (err) {
      console.error(`  FAIL  ${name}`)
      console.error('        ', err instanceof Error ? err.message : err)
      failed++
    }
  }

  // ── SALES_REVENUE + 확정 실적 있음 → calcSalesScore 결과 채택 ─────────────

  test('[SALES_REVENUE] record 있음 (100%) → score 100', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: BigInt(10_000_000),
      salesActualAmount: BigInt(10_000_000),
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 100)
    assert.equal(result.score, calcSalesScore(BigInt(10_000_000), BigInt(10_000_000)))
  })

  test('[SALES_REVENUE] record 있음 (110% 초과) → score 110', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: BigInt(10_000_000),
      salesActualAmount: BigInt(12_000_000),
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 110)
  })

  test('[SALES_REVENUE] record 있음 (79%) → score 70', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: BigInt(10_000_000),
      salesActualAmount: BigInt(7_900_000),
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 70)
  })

  test('[SALES_REVENUE] quantScore 입력이 있어도 무시하고 calcSalesScore 사용', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: BigInt(10_000_000),
      salesActualAmount: BigInt(10_000_000),
      quantScore: 0,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 100)
  })

  // ── SALES_REVENUE + record 없음 → 제출 거부 ──────────────────────────────

  test('[SALES_REVENUE] salesActualAmount=null → 제출 거부', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: BigInt(10_000_000),
      salesActualAmount: null,
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, 'SALES_REVENUE_RECORD_REQUIRED')
    assert.ok(result.message.includes('매출 실적'))
  })

  test('[SALES_REVENUE] targetAmount=null → 제출 거부 (목표 미설정)', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: null,
      salesActualAmount: BigInt(10_000_000),
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, 'SALES_REVENUE_RECORD_REQUIRED')
  })

  test('[SALES_REVENUE] 둘 다 null → 제출 거부', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, 'SALES_REVENUE_RECORD_REQUIRED')
  })

  test('[SALES_REVENUE] targetAmount=0 → calcSalesScore가 throw → 제출 거부', () => {
    const result = resolveItemScore({
      goalType: 'SALES_REVENUE',
      kpiType: 'QUANTITATIVE',
      targetAmount: BigInt(0),
      salesActualAmount: BigInt(5_000_000),
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.code, 'SALES_REVENUE_SCORE_CALC_FAILED')
  })

  // ── GENERAL QUANTITATIVE → quantScore 경로 그대로 (회귀 확인) ────────────

  test('[GENERAL QUANTITATIVE] quantScore=85 → score 85', () => {
    const result = resolveItemScore({
      goalType: 'GENERAL',
      kpiType: 'QUANTITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: 85,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 85)
  })

  test('[GENERAL QUANTITATIVE] quantScore=0 → score 0 (zero는 유효)', () => {
    const result = resolveItemScore({
      goalType: 'GENERAL',
      kpiType: 'QUANTITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: 0,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 0)
  })

  test('[GENERAL QUANTITATIVE] quantScore=null → score 0 (falsy 폴백)', () => {
    const result = resolveItemScore({
      goalType: 'GENERAL',
      kpiType: 'QUANTITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, 0)
  })

  // ── QUALITATIVE → PDCA 경로 그대로 (회귀 확인) ───────────────────────────

  test('[QUALITATIVE] PDCA 80/80/80/80 → calcPdcaScore와 동일', () => {
    const result = resolveItemScore({
      goalType: 'GENERAL',
      kpiType: 'QUALITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: null,
      planScore: 80,
      doScore: 80,
      checkScore: 80,
      actScore: 80,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, calcPdcaScore(80, 80, 80, 80))
  })

  test('[QUALITATIVE] PDCA 모두 null → score 0', () => {
    const result = resolveItemScore({
      goalType: 'GENERAL',
      kpiType: 'QUALITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: null,
      planScore: null,
      doScore: null,
      checkScore: null,
      actScore: null,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, calcPdcaScore(0, 0, 0, 0))
  })

  test('[QUALITATIVE] PDCA 100/90/80/70 → calcPdcaScore 동일', () => {
    const result = resolveItemScore({
      goalType: 'GENERAL',
      kpiType: 'QUALITATIVE',
      targetAmount: null,
      salesActualAmount: null,
      quantScore: null,
      planScore: 100,
      doScore: 90,
      checkScore: 80,
      actScore: 70,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.score, calcPdcaScore(100, 90, 80, 70))
  })

  // ── summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
