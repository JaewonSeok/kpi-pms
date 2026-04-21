import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  determineEvaluationPerformanceBriefingAlignmentStatus,
  getEvaluationPerformanceBriefingAlignmentLabel,
  normalizeEvaluationPerformanceBriefingSnapshot,
} from '../src/lib/evaluation-performance-briefing'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

const routeSource = read('src/app/api/ai/evaluation-briefing/route.ts')
const serverSource = read('src/server/ai/evaluation-performance-briefing.ts')
const promptSource = read('src/lib/ai/executive-performance-briefing-prompt.ts')
const openAiSource = read('src/server/ai/executive-performance-briefing-openai.ts')
const loaderSource = read('src/server/evaluation-workbench.ts')
const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
const panelSource = read('src/components/evaluation/EvaluationPerformanceBriefingPanel.tsx')

run('alignment helper distinguishes matched, review-needed, and insufficient evidence cases', () => {
  assert.equal(
    determineEvaluationPerformanceBriefingAlignmentStatus({
      managerScore: 91,
      evidenceScore: 88,
      evidenceLevel: 'STRONG',
      evidenceCount: 10,
      managerCommentSupported: true,
    }),
    'MATCHED'
  )

  assert.equal(
    determineEvaluationPerformanceBriefingAlignmentStatus({
      managerScore: 97,
      evidenceScore: 76,
      evidenceLevel: 'PARTIAL',
      evidenceCount: 8,
      managerCommentSupported: true,
    }),
    'POSSIBLE_OVER_RATING'
  )

  assert.equal(
    determineEvaluationPerformanceBriefingAlignmentStatus({
      managerScore: 88,
      evidenceScore: 86,
      evidenceLevel: 'WEAK',
      evidenceCount: 3,
      managerCommentSupported: false,
    }),
    'INSUFFICIENT_EVIDENCE'
  )

  assert.equal(getEvaluationPerformanceBriefingAlignmentLabel('POSSIBLE_UNDER_RATING'), '과소평가 가능성')
})

run('snapshot schema requires evidence traceability and preserves stored metadata', () => {
  const snapshot = normalizeEvaluationPerformanceBriefingSnapshot({
    source: 'fallback',
    generatedAt: '2026-04-21T05:25:00.000Z',
    promptVersion: 'evaluation-performance-briefing-v1',
    model: null,
    stale: false,
    disclaimer: 'AI 브리핑은 최종 평가를 대체하지 않으며, 등록된 성과 근거를 요약해 검토를 지원합니다.',
    headline: '최근 12개월 성과 근거는 일부 충분하지만 추가 확인이 필요한 지점이 있습니다.',
    headlineEvidenceIds: ['evaluation:eval-1'],
    strengths: [{ text: '핵심 KPI 흐름이 유지되고 있습니다.', evidenceIds: ['kpi:k1'] }],
    kpiSummary: [{ text: '월간 실적 6건이 연결돼 있습니다.', evidenceIds: ['monthly:m1'] }],
    contributionSummary: [{ text: '체크인과 다면 피드백으로 협업 근거를 확인할 수 있습니다.', evidenceIds: ['checkin:c1'] }],
    risks: [{ text: '최근 한 KPI는 달성률이 낮아 추가 확인이 필요합니다.', evidenceIds: ['monthly:m2'] }],
    alignment: {
      status: 'REVIEW_NEEDED',
      reason: '점수 차이는 크지 않지만 코멘트의 근거 밀도가 더 필요합니다.',
      evidenceIds: ['evaluation:eval-1', 'monthly:m2'],
    },
    questions: ['최근 달성률 저하가 일시적 이슈인지 확인해 주세요.', '팀장 코멘트가 어떤 근거를 요약한 것인지 다시 확인해 주세요.'],
    evidenceCoverage: {
      evidenceLevel: 'PARTIAL',
      evidenceCount: 5,
      kpiCount: 3,
      monthlyRecordCount: 6,
      checkinCount: 2,
      feedbackRoundCount: 1,
      evaluationHistoryCount: 1,
    },
    evidence: [
      {
        id: 'evaluation:eval-1',
        sourceType: 'EVALUATION',
        sourceId: 'eval-1',
        title: '평가 의견',
        snippet: '근거 중심으로 다시 확인이 필요합니다.',
        href: '/evaluation/performance/eval-1?cycleId=c1',
      },
    ],
  })

  assert.equal(snapshot?.headlineEvidenceIds[0], 'evaluation:eval-1')
  assert.equal(snapshot?.alignment.status, 'REVIEW_NEEDED')
  assert.equal(snapshot?.evidence[0]?.href?.includes('/evaluation/performance/eval-1'), true)
})

run('workbench integrates a dedicated AI performance briefing tab and route without auto-grading', () => {
  assert.match(routeSource, /EvaluationPerformanceBriefingRequestSchema\.safeParse/)
  assert.match(routeSource, /generateEvaluationPerformanceBriefing/)
  assert.match(serverSource, /PERFORMANCE_BRIEFING_SOURCE_TYPE = 'EvaluationPerformanceBriefing'/)
  assert.match(serverSource, /requestType: AIRequestType\.EVAL_PERFORMANCE_BRIEFING/)
  assert.match(serverSource, /referenceEvaluation/)
  assert.match(serverSource, /requestExecutivePerformanceBriefingFromOpenAI/)
  assert.match(serverSource, /buildExecutivePerformanceBriefingInput/)
  assert.match(promptSource, /EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT/)
  assert.match(promptSource, /최종 등급, 점수 상향\/하향 제안, 보상 제안은 절대 포함하지 마세요/)
  assert.match(openAiSource, /buildExecutivePerformanceBriefingPrompt/)
  assert.match(openAiSource, /EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT/)
  assert.match(openAiSource, /ExecutivePerformanceBriefingSchema\.safeParse/)
  assert.match(openAiSource, /fetcher\(`\$\{env\.baseUrl\}\/responses`/)
  assert.match(loaderSource, /sourceType: 'EvaluationPerformanceBriefing'/)
  assert.match(loaderSource, /normalizeEvaluationPerformanceBriefingSnapshot/)
  assert.match(clientSource, /briefing: 'AI 성과 브리핑'/)
  assert.match(clientSource, /fetch\('\/api\/ai\/evaluation-briefing'/)
  assert.match(clientSource, /EvaluationPerformanceBriefingPanel/)
  assert.match(panelSource, /AI 브리핑은 최종 평가를 대체하지 않으며/)
  assert.match(panelSource, /근거 보기 \/ 원문 링크/)
})

console.log('Evaluation performance briefing tests completed')
