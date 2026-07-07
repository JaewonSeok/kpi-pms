import assert from 'node:assert/strict'
import { MonthlyRecordSchema, UpdateMonthlyRecordSchema } from '@/lib/validations'
import { calcSalesScore } from '@/lib/sales-score-policy-2026'
import { calcAchievementRate } from '@/lib/utils'

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

  // ── MonthlyRecordSchema: actualAmount (SALES_REVENUE 경로) ────────────────

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

  // ── GENERAL 경로: MonthlyRecordSchema / UpdateMonthlyRecordSchema ──────────

  test('[GENERAL] MonthlyRecordSchema: actualValue=250, actualAmount 없음 → 성공', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-general-1',
      yearMonth: '2026-07',
      actualValue: 250,
      isDraft: true,
    })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualValue, 250)
    assert.equal(result.data?.actualAmount, undefined)
  })

  test('[GENERAL] MonthlyRecordSchema: actualAmount 미전송 → parsed.actualAmount undefined (SALES_REVENUE 분기 진입 불가)', () => {
    const result = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-general-1',
      yearMonth: '2026-07',
      actualValue: 297,
      isDraft: false,
    })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualAmount, undefined)
  })

  test('[GENERAL] UpdateMonthlyRecordSchema: actualValue=250, actualAmount 없음 → 성공', () => {
    const result = UpdateMonthlyRecordSchema.safeParse({ actualValue: 250 })
    assert.equal(result.success, true)
    assert.equal(result.data?.actualValue, 250)
    assert.equal(result.data?.actualAmount, undefined)
  })

  // ── GENERAL 달성률 계산 (calcAchievementRate) ────────────────────────────

  test('[GENERAL] calcAchievementRate: 250/297 = 84.2 (DB 확인 케이스)', () => {
    assert.equal(calcAchievementRate(250, 297), 84.2)
  })

  test('[GENERAL] calcAchievementRate: 100/100 = 100', () => {
    assert.equal(calcAchievementRate(100, 100), 100)
  })

  test('[GENERAL] calcAchievementRate: 80/100 = 80', () => {
    assert.equal(calcAchievementRate(80, 100), 80)
  })

  test('[GENERAL] calcAchievementRate: 0/100 = 0 (미시작)', () => {
    assert.equal(calcAchievementRate(0, 100), 0)
  })

  test('[GENERAL] calcAchievementRate: target=0 → 0 (0나누기 방어)', () => {
    assert.equal(calcAchievementRate(250, 0), 0)
  })

  // ── saveRecord 페이로드 분리 로직 (GENERAL vs SALES_REVENUE) ─────────────
  // MonthlyKpiManagementClient.saveRecord 내 isSalesRevenue 분기를 재현.
  // union 파라미터 함수로 감싸야 TypeScript const-narrowing 오류를 피할 수 있음.

  function resolvePayload(
    goalType: 'GENERAL' | 'SALES_REVENUE',
    kpiType: string,
    actualValueDraft: string,
    actualAmountDraft: string,
  ) {
    const isSalesRevenue = goalType === 'SALES_REVENUE'
    const actualValue =
      !isSalesRevenue && kpiType === 'QUANTITATIVE' && actualValueDraft.trim()
        ? Number(actualValueDraft)
        : undefined
    const actualAmountRaw = isSalesRevenue
      ? actualAmountDraft.replace(/,/g, '').trim()
      : undefined
    return { isSalesRevenue, actualValue, actualAmount: actualAmountRaw || undefined }
  }

  test('[GENERAL] saveRecord payload: isSalesRevenue=false → actualValue 세팅, actualAmount undefined', () => {
    const { isSalesRevenue, actualValue, actualAmount } = resolvePayload('GENERAL', 'QUANTITATIVE', '250', '')
    assert.equal(isSalesRevenue, false)
    assert.equal(actualValue, 250)
    assert.equal(actualAmount, undefined)
    const schema = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-g',
      yearMonth: '2026-07',
      actualValue,
      isDraft: true,
    })
    assert.equal(schema.success, true)
    assert.equal(schema.data?.actualAmount, undefined)
  })

  test('[SALES] saveRecord payload: isSalesRevenue=true → actualValue undefined, actualAmount 세팅', () => {
    const { isSalesRevenue, actualValue, actualAmount } = resolvePayload('SALES_REVENUE', 'QUANTITATIVE', '', '150,000,000')
    assert.equal(isSalesRevenue, true)
    assert.equal(actualValue, undefined)
    assert.equal(actualAmount, '150000000')
    const schema = MonthlyRecordSchema.safeParse({
      personalKpiId: 'kpi-s',
      yearMonth: '2026-07',
      actualAmount,
      isDraft: true,
    })
    assert.equal(schema.success, true)
    assert.equal(schema.data?.actualAmount, BigInt(150_000_000))
  })

  // ── selectedActualValue 표시값 선택 로직 ─────────────────────────────────
  // EntryTab 컴포넌트 내 selectedActualValue 계산을 재현.

  function formatAmountStr(raw: string): string {
    const digits = raw.replace(/[^0-9]/g, '')
    if (!digits) return ''
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function computeSelectedActualValue(params: {
    goalType: 'GENERAL' | 'SALES_REVENUE'
    draftActualValue: string
    draftActualAmount: string
    recordActualValue: number | string | undefined
    recordActualAmount: string | null
  }): string {
    const { goalType, draftActualValue, draftActualAmount, recordActualValue, recordActualAmount } = params
    if (goalType === 'SALES_REVENUE') {
      const draftAmt = draftActualAmount.trim()
      if (draftAmt) return draftAmt + ' 원'
      return recordActualAmount ? formatAmountStr(recordActualAmount) + ' 원' : '-'
    }
    return (
      draftActualValue.trim() ||
      (typeof recordActualValue === 'number' || typeof recordActualValue === 'string'
        ? String(recordActualValue)
        : '-')
    )
  }

  test('[GENERAL] selectedActualValue: draft "250" → "250"', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'GENERAL', draftActualValue: '250', draftActualAmount: '', recordActualValue: undefined, recordActualAmount: null }),
      '250'
    )
  })

  test('[GENERAL] selectedActualValue: draft 비어있고 record 250(number) → "250"', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'GENERAL', draftActualValue: '', draftActualAmount: '', recordActualValue: 250, recordActualAmount: null }),
      '250'
    )
  })

  test('[GENERAL] selectedActualValue: 둘 다 없으면 "-"', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'GENERAL', draftActualValue: '', draftActualAmount: '', recordActualValue: undefined, recordActualAmount: null }),
      '-'
    )
  })

  test('[GENERAL] selectedActualValue: goalType=GENERAL이면 actualAmount 있어도 actualValue만 본다', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'GENERAL', draftActualValue: '250', draftActualAmount: '150,000,000', recordActualValue: 250, recordActualAmount: '150000000' }),
      '250'
    )
  })

  test('[SALES] selectedActualValue: draft actualAmount "150,000,000" → "150,000,000 원"', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'SALES_REVENUE', draftActualValue: '', draftActualAmount: '150,000,000', recordActualValue: undefined, recordActualAmount: null }),
      '150,000,000 원'
    )
  })

  test('[SALES] selectedActualValue: draft 비어있고 record actualAmount → 포맷 + " 원"', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'SALES_REVENUE', draftActualValue: '', draftActualAmount: '', recordActualValue: undefined, recordActualAmount: '150000000' }),
      '150,000,000 원'
    )
  })

  test('[SALES] selectedActualValue: 둘 다 없으면 "-"', () => {
    assert.equal(
      computeSelectedActualValue({ goalType: 'SALES_REVENUE', draftActualValue: '', draftActualAmount: '', recordActualValue: undefined, recordActualAmount: null }),
      '-'
    )
  })

  // ── achievementRate bp calculation (SALES_REVENUE 경로) ──────────────────

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
    const actual = BigInt(10_999_000)
    const bp = Number((actual * BigInt(10000)) / target)
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
