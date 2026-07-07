import assert from 'node:assert/strict'
import { calcSalesScore, SALES_SCORE_BANDS_2026 } from '../src/lib/sales-score-policy-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

// ── 경계값: "이상" 규칙이므로 경계 자체는 위 구간 ──────────────────────────

run('boundary: exactly 110% → 110점', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(110_000_000)), 110)
})

run('boundary: exactly 100% → 100점', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(100_000_000)), 100)
})

run('boundary: exactly 90% → 90점', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(90_000_000)), 90)
})

run('boundary: exactly 80% → 80점', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(80_000_000)), 80)
})

// ── 경계 직전 ──────────────────────────────────────────────────────────────

run('boundary-1: 109.99% (10999 bp) → 100점', () => {
  // target=10000, actual=10999 → bp = (10999*10000)/10000 = 10999 → 100점
  assert.equal(calcSalesScore(BigInt(10_000), BigInt(10_999)), 100)
})

run('boundary-1: 99.99% (9999 bp) → 90점', () => {
  assert.equal(calcSalesScore(BigInt(10_000), BigInt(9_999)), 90)
})

run('boundary-1: 79.99% (7999 bp) → 70점', () => {
  assert.equal(calcSalesScore(BigInt(10_000), BigInt(7_999)), 70)
})

// ── 극단값 ──────────────────────────────────────────────────────────────────

run('extreme: actual=0 → 70점 (최저점)', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(0)), 70)
})

run('extreme: actual = target×2 (200%) → 110점 (캡 적용)', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(200_000_000)), 110)
})

run('extreme: actual = target×1.25 (125%) → 110점 (캡 적용)', () => {
  assert.equal(calcSalesScore(BigInt(100_000_000), BigInt(125_000_000)), 110)
})

// ── target 0 / 음수 → 에러 ──────────────────────────────────────────────────

run('error: target=0 throws', () => {
  assert.throws(
    () => calcSalesScore(BigInt(0), BigInt(50_000_000)),
    /targetAmount must be positive/,
  )
})

run('error: target=-1 throws', () => {
  assert.throws(
    () => calcSalesScore(BigInt(-1), BigInt(50_000_000)),
    /targetAmount must be positive/,
  )
})

// ── 큰 금액 BigInt 정밀도 ────────────────────────────────────────────────────

run('precision: 30억 목표 / 33억 실적 (110%) → 110점', () => {
  // (3_300_000_000 * 10000) / 3_000_000_000 = 11000 bp → 110점
  assert.equal(calcSalesScore(BigInt(3_000_000_000), BigInt(3_300_000_000)), 110)
})

run('precision: 30억 목표 / 29억 실적 (96.66%) → 90점', () => {
  // (2_900_000_000 * 10000) / 3_000_000_000 = 9666 bp (정수 truncate) → 90점
  assert.equal(calcSalesScore(BigInt(3_000_000_000), BigInt(2_900_000_000)), 90)
})

run('precision: 100억 목표 / 89.9억 실적 (89.9%) → 80점', () => {
  // (8_990_000_000 * 10000) / 10_000_000_000 = 8990 bp → 80점
  assert.equal(calcSalesScore(BigInt(10_000_000_000), BigInt(8_990_000_000)), 80)
})

run('precision: 1조 목표 / 1조1천억 실적 (110%) → 110점', () => {
  const target = BigInt(1_000_000_000_000)
  const actual  = BigInt(1_100_000_000_000)
  assert.equal(calcSalesScore(target, actual), 110)
})

run('precision: 1조 목표 / 7999억 실적 (79.99%) → 70점', () => {
  const target = BigInt(1_000_000_000_000)
  const actual  = BigInt(799_900_000_000) // 79.99%
  assert.equal(calcSalesScore(target, actual), 70)
})

// ── SALES_SCORE_BANDS_2026 상수 구조 검증 ────────────────────────────────────

run('bands: 5개 구간, 최고 110점 최저 70점', () => {
  assert.equal(SALES_SCORE_BANDS_2026.length, 5)
  assert.equal(SALES_SCORE_BANDS_2026[0].score, 110)
  assert.equal(SALES_SCORE_BANDS_2026[SALES_SCORE_BANDS_2026.length - 1].score, 70)
})

run('bands: 내림차순 minBp 정렬 확인', () => {
  for (let i = 0; i < SALES_SCORE_BANDS_2026.length - 1; i++) {
    assert.ok(
      SALES_SCORE_BANDS_2026[i].minBp > SALES_SCORE_BANDS_2026[i + 1].minBp,
      `band[${i}].minBp should be > band[${i + 1}].minBp`,
    )
  }
})
