import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  calculateEffectiveTotalScore,
  toWeightedScoredRows,
  weightedAverage,
} from '../src/server/evaluation-results-scoring'
import { buildEvaluationResultPdf, buildEvaluationResultPdfSections } from '../src/server/evaluation-results-pdf'
import type { EvaluationResultViewModel } from '../src/server/evaluation-results'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeViewModel(): EvaluationResultViewModel {
  return {
    cycle: {
      id: 'cycle-2026-h1',
      name: '2026 상반기 평가',
      year: 2026,
      status: 'PUBLISHED',
      rawStatus: 'RESULT_OPEN',
      organizationName: 'RSUPPORT',
      departmentScope: '성과관리팀',
    },
    employee: {
      id: 'emp-1',
      name: '김민서',
      department: '성과관리팀',
      title: '팀장',
    },
    summary: {
      acknowledged: false,
      finalGrade: 'A',
      totalScore: 87.5,
      performanceScore: 86.2,
      competencyScore: 89.4,
      calibrationAdjusted: false,
    },
    overview: {
      achievementRate: 92.3,
      completedCheckins: 4,
      feedbackCount: 5,
      evaluatorPreview: '핵심 과제 추진력이 좋고 협업 조율이 안정적입니다.',
      strengthsPreview: ['실행력', '협업', '고객 이해'],
      improvementsPreview: ['우선순위 조정', '위임', '리스크 공유'],
      interpretation: '성과와 역량 모두 안정적으로 높은 수준을 유지했습니다.',
    },
    scoreBreakdown: {
      performance: [
        {
          id: 'perf-1',
          title: '신규 고객 확보',
          score: 88,
          weight: 60,
          selfScore: 85,
          managerScore: 87,
          reviewerScore: 88,
          finalScore: 88,
          comment: '정량 목표를 초과 달성했습니다.',
        },
      ],
      competency: [
        {
          id: 'comp-1',
          title: '협업과 소통',
          score: 90,
          weight: 40,
          selfScore: 86,
          managerScore: 89,
          reviewerScore: 90,
          finalScore: 90,
          comment: '다양한 이해관계자와의 조율이 안정적입니다.',
        },
      ],
    },
    evidence: {
      kpis: [],
      monthlyRecords: [],
      checkins: [],
      feedbacks: [],
      attachments: [],
      highlights: [],
    },
    calibration: {
      adjusted: false,
      logs: [],
    },
    growth: {
      strengths: ['실행력이 높습니다.', '협업 조율이 좋습니다.'],
      improvements: ['리스크 공유를 조금 더 앞당길 필요가 있습니다.'],
      actions: ['주간 리스크 리뷰를 고정합니다.'],
      discussionQuestions: ['다음 반기 우선순위를 어떻게 압축할까요?'],
    },
    actions: {
      canAcknowledge: true,
      canExport: true,
    },
  }
}

async function main() {
  await run('weighted totals ignore unscored template rows and stay consistent for mixed structures', () => {
    const performanceRows = toWeightedScoredRows([
      { finalScore: 90, weight: 60 },
      { finalScore: null, weight: 20 },
      { finalScore: 75, weight: 40 },
    ])
    const competencyRows = toWeightedScoredRows([
      { finalScore: undefined, weight: 30 },
      { finalScore: 88, weight: 20 },
    ])

    assert.deepEqual(performanceRows, [
      { score: 90, weight: 60 },
      { score: 75, weight: 40 },
    ])
    assert.deepEqual(competencyRows, [{ score: 88, weight: 20 }])
    assert.equal(weightedAverage(performanceRows), 84)
    assert.equal(
      calculateEffectiveTotalScore({
        performanceRows,
        competencyRows,
        fallback: 0,
      }),
      84.7
    )
  })

  await run('evaluation result pdf builder returns a PDF and exposes score/comment sections', async () => {
    const viewModel = makeViewModel()
    const sections = buildEvaluationResultPdfSections(viewModel)
    const bytes = await buildEvaluationResultPdf(viewModel)

    assert.equal(sections.title, '성과 평가 결과지')
    assert.equal(sections.summaryRows.some((row) => row.label === '총점' && row.value.includes('87.5')), true)
    assert.equal(sections.detailRows.some((row) => row.metrics.includes('가중치 60%')), true)
    assert.equal(sections.detailRows.some((row) => row.comment.includes('초과 달성')), true)
    assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), '%PDF')
  })

  await run('evaluation result export route serves application/pdf and client keeps pdf download wiring', () => {
    const routeSource = read('src/app/api/evaluation/results/[cycleId]/export/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationResultsClient.tsx')

    assert.equal(routeSource.includes('application/pdf'), true)
    assert.equal(routeSource.includes('buildEvaluationResultPdf'), true)
    assert.equal(clientSource.includes('evaluation-result.pdf'), true)
    assert.equal(clientSource.includes('/api/evaluation/results/'), true)
    assert.equal(clientSource.includes('/export'), true)
  })

  console.log('Evaluation results PDF tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
