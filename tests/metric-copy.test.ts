import assert from 'node:assert/strict'
import {
  formatCountWithUnit,
  formatEntityCount,
  formatExplicitRatio,
  formatRateBaseCopy,
} from '../src/lib/metric-copy'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('formatCountWithUnit adds explicit Korean units', () => {
  assert.equal(formatCountWithUnit(4, '명'), '4명')
  assert.equal(formatCountWithUnit(7, '건'), '7건')
  assert.equal(formatCountWithUnit(3, '개'), '3개')
  assert.equal(formatCountWithUnit(undefined, '건'), '0건')
})

run('formatEntityCount prefixes entity labels consistently', () => {
  assert.equal(formatEntityCount({ label: '리스크 조직', value: 3, unit: '개' }), '리스크 조직 3개')
  assert.equal(formatEntityCount({ label: '첨부 자료', value: 2, unit: '건' }), '첨부 자료 2건')
})

run('formatExplicitRatio keeps numerator and denominator entities explicit', () => {
  assert.equal(
    formatExplicitRatio({
      numeratorLabel: '연결된 개인 KPI',
      numeratorValue: 2,
      numeratorUnit: '건',
      denominatorLabel: '대상 인원',
      denominatorValue: 4,
      denominatorUnit: '명',
      separator: ' · ',
    }),
    '연결된 개인 KPI 2건 · 대상 인원 4명'
  )
})

run('formatRateBaseCopy explains the denominator base', () => {
  assert.equal(formatRateBaseCopy('대상 인원'), '대상 인원 기준')
  assert.equal(formatRateBaseCopy('전체 KPI'), '전체 KPI 기준')
})

console.log('Metric copy tests completed')
