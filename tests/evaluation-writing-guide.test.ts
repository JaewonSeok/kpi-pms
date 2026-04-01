import assert from 'node:assert/strict'
import {
  buildEvaluationQualityWarnings,
  EVALUATION_GUIDE_EXAMPLES,
  EVALUATION_GUIDE_SECTIONS,
} from '../src/lib/evaluation-writing-guide'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('evaluation guide exposes checklist, continuous feedback, bias, and example sections', () => {
  const titles = EVALUATION_GUIDE_SECTIONS.map((section) => section.title)

  assert.equal(titles.some((title) => title.includes('체크리스트')), true)
  assert.equal(titles.some((title) => title.includes('피드백')), true)
  assert.equal(titles.some((title) => title.includes('편향')), true)
  assert.equal(titles.some((title) => title.includes('예시')), true)
})

run('evaluation guide examples render good versus bad comment patterns in Korean', () => {
  assert.equal(EVALUATION_GUIDE_EXAMPLES.length >= 3, true)
  assert.equal(EVALUATION_GUIDE_EXAMPLES.every((example) => example.bad.length > 0), true)
  assert.equal(EVALUATION_GUIDE_EXAMPLES.every((example) => example.good.length > 0), true)
  assert.equal(EVALUATION_GUIDE_EXAMPLES.some((example) => example.good.includes('다음')), true)
  assert.equal(EVALUATION_GUIDE_EXAMPLES.some((example) => example.bad.includes('전반적으로')), true)
})

run('quality warnings flag short and generic comments without blocking valid evaluation flow', () => {
  const warnings = buildEvaluationQualityWarnings({
    comment: '전반적으로 잘했습니다.',
    evidence: {
      kpiSummaries: ['매출 성장 / 가중치 40% / 최근 달성률 92%'],
      monthlySummaries: ['매출 성장 / 2026-03 / 달성률 92% / 고객사 납품을 마감했습니다.'],
      noteSummaries: ['체크인 / 2026-03-20 / 우선순위 조정이 필요합니다.'],
      keyPoints: ['매출 KPI 달성률 92%', '체크인에서 우선순위 합의 필요'],
      warnings: [],
      alerts: [],
      sufficiency: 'strong',
    },
    mode: 'draft',
  })

  assert.equal(warnings.some((warning) => warning.key === 'short-comment'), true)
  assert.equal(warnings.some((warning) => warning.key === 'generic-comment'), true)
  assert.equal(warnings.some((warning) => warning.key === 'missing-action'), true)
})

run('quality warnings surface bias, emotional tone, and insufficient evidence signals', () => {
  const warnings = buildEvaluationQualityWarnings({
    comment: '원래 커뮤니케이션이 부족하고 항상 답답한 편입니다.',
    evidence: {
      kpiSummaries: [],
      monthlySummaries: [],
      noteSummaries: [],
      keyPoints: ['체크인 메모 한 건만 확인'],
      warnings: ['근거가 충분하지 않아 초안 품질에 제한이 있습니다.'],
      alerts: [],
      sufficiency: 'weak',
    },
    mode: 'draft',
  })

  assert.equal(warnings.some((warning) => warning.key === 'missing-evidence'), true)
  assert.equal(warnings.some((warning) => warning.key === 'bias-risk'), true)
  assert.equal(warnings.some((warning) => warning.key === 'emotional-tone'), true)
})

console.log('Evaluation writing guide tests completed')
