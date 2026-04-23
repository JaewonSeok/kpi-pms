import assert from 'node:assert/strict'
import {
  formatCountWithUnit,
  formatEntityCount,
  formatExplicitRatio,
  formatRateBaseCopy,
  joinHierarchyParts,
  joinInlineParts,
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

run('joinInlineParts uses the approved inline separator and skips empty values', () => {
  assert.equal(joinInlineParts(['인사팀', '비용절감 및 이익 창출']), '인사팀 · 비용절감 및 이익 창출')
  assert.equal(joinInlineParts(['경영지원본부', '', '전사 영업이익율 개선']), '경영지원본부 · 전사 영업이익율 개선')
  assert.equal(joinInlineParts(['인사팀', undefined]), '인사팀')
})

run('joinHierarchyParts uses the approved path separator and skips empty values', () => {
  assert.equal(joinHierarchyParts(['본부 KPI', '팀 KPI']), '본부 KPI → 팀 KPI')
  assert.equal(joinHierarchyParts(['초안', '', '확정']), '초안 → 확정')
  assert.equal(joinHierarchyParts([undefined, '팀 KPI']), '팀 KPI')
})

console.log('Metric copy tests completed')
