import assert from 'node:assert/strict'
import { MonthlyRecordSchema, UpdateMonthlyRecordSchema } from '@/lib/validations'
import { calcSalesScore } from '@/lib/sales-score-policy-2026'

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

  // ── MonthlyRecordSchema: actualAmount ──────────────────────────────────────

  test('MonthlyRecordSchema accepts valid actualAmount and transforms to BigInt', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-1',
      yearMonth: '2026-07',
      actualAmount: '150000000',
      isDraft: true,
    })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualAmount, BigInt(150000000))
  })

  test('MonthlyRecordSchema rejects non-digit actualAmount', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-1',
      yearMonth: '2026-07',
      actualAmount: '150,000,000',
      isDraft: true,
    })
    assert.equal(result.success, false)
  })

  test('MonthlyRecordSchema rejects decimal actualAmount', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-1',
      yearMonth: '2026-07',
      actualAmount: '1500.50',
      isDraft: true,
    })
    assert.equal(result.success, false)
  })

  test('MonthlyRecordSchema accepts omitted actualAmount (optional)', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-1',
      yearMonth: '2026-07',
      actualValue: 80,
      isDraft: true,
    })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualAmount, undefined)
  })

  test('MonthlyRecordSchema accepts actualAmount = "0"', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-1',
      yearMonth: '2026-07',
      actualAmount: '0',
      isDraft: true,
    })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualAmount, BigInt(0))
  })

  // ── UpdateMonthlyRecordSchema: actualAmount ────────────────────────────────

  test('UpdateMonthlyRecordSchema accepts valid actualAmount', () => {
    const result = UpdateMonthlyRecordSchema.safeParse({ actualAmount: '999999999' })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualAmount, BigInt(999999999))
  })

  test('UpdateMonthlyRecordSchema rejects non-digit actualAmount', () => {
    const result = UpdateMonthlyRecordSchema.safeParse({ actualAmount: 'abc' })
    assert.equal(result.success, false)
  })

  // ── achievementRate bp calculation ────────────────────────────────────────

  test('achievementRate: 100% (actual == target)', () => {
    const target = BigInt(10_000_000)
    const actual = BigInt(10_000_000)
    const bp = Number((actual * BigInt(10000)) / target)
    const rate = bp / 100
    assert.equal(rate, 100)
  })

  test('achievementRate: 110% (actual 10% over target)', () => {
    const target = BigInt(10_000_000)
    const actual = BigInt(11_000_000)
    const bp = Number((actual * BigInt(10000)) / target)
    const rate = bp / 100
    assert.equal(rate, 110)
  })

  test('achievementRate: 90% (actual 10% under)', () => {
    const target = BigInt(10_000_000)
    const actual = BigInt(9_000_000)
    const bp = Number((actual * BigInt(10000)) / target)
    const rate = bp / 100
    assert.equal(rate, 90)
  })

  test('achievementRate: 70% (actual 30% under)', () => {
    const target = BigInt(10_000_000)
    const actual = BigInt(7_000_000)
    const bp = Number((actual * BigInt(10000)) / target)
    const rate = bp / 100
    assert.equal(rate, 70)
  })

  test('achievementRate truncates fractional bp (109.99% → score 100)', () => {
    const target = BigInt(10_000_000)
    // 10_999_000 / 10_000_000 = 109.99% — floor via BigInt division
    const actual = BigInt(10_999_000)
    const bp = Number((actual * BigInt(10000)) / target)
    // Should be 10999 bp, below 11000 threshold
    assert.equal(bp, 10999)
    const score = calcSalesScore(target, actual)
    assert.equal(score, 100)
  })

  // ── calcSalesScore integration ─────────────────────────────────────────────

  test('calcSalesScore: >= 110% → score 110', () => {
    assert.equal(calcSalesScore(BigInt(100), BigInt(110)), 110)
  })

  test('calcSalesScore: 100% exactly → score 100', () => {
    assert.equal(calcSalesScore(BigInt(100), BigInt(100)), 100)
  })

  test('calcSalesScore: 95% → score 90', () => {
    assert.equal(calcSalesScore(BigInt(100), BigInt(95)), 90)
  })

  test('calcSalesScore: 80% exactly → score 80', () => {
    assert.equal(calcSalesScore(BigInt(100), BigInt(80)), 80)
  })

  test('calcSalesScore: 79% → score 70', () => {
    assert.equal(calcSalesScore(BigInt(100), BigInt(79)), 70)
  })

  test('calcSalesScore: 0 actual → score 70', () => {
    assert.equal(calcSalesScore(BigInt(100), BigInt(0)), 70)
  })

  // ── summary ───────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
