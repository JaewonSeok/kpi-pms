import assert from 'node:assert/strict'
import './register-path-aliases'
import {
  buildFeedback360ResultPdf,
  buildFeedback360ResultPdfSections,
  type Feedback360ResultPdfModel,
} from '../src/server/feedback-360-result-pdf'
import {
  buildFeedbackReportAnalysis,
  parseFeedbackReportAnalysisSettings,
} from '../src/lib/feedback-report-analysis'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const analysis = buildFeedbackReportAnalysis({
  settings: parseFeedbackReportAnalysisSettings({
    overview: {
      companyMessage: '회사가 전하는 메시지',
      purposeMessage: '이 리포트는 성장 대화에 활용하기 위한 요약입니다.',
      acceptanceGuide: '차이가 큰 문항부터 확인하고 다음 액션으로 연결해 주세요.',
    },
  }),
  roundName: '2026 상반기 360 리뷰',
  recipientProfile: 'REVIEWEE',
  pdfHref: '/api/feedback/rounds/round-1/results-export?targetId=emp-1&profile=REVIEWEE',
  links: [
    {
      label: '리뷰 결과',
      href: '/evaluation/results',
      description: '기존 결과 화면으로 이동',
    },
  ],
  questions: [
    {
      id: 'q-rating',
      category: '리더십',
      questionText: '우선순위를 명확하게 정리합니다.',
      questionType: 'RATING_SCALE',
    },
    {
      id: 'q-choice',
      category: '강점 선택',
      questionText: '가장 자주 관찰되는 강점을 선택해 주세요.',
      questionType: 'MULTIPLE_CHOICE',
    },
  ],
  targetFeedbacks: [
    {
      id: 'fb-self',
      relationship: 'SELF',
      giverName: '본인',
      overallComment: '스스로도 우선순위 정리가 강점이라고 느낍니다.',
      submittedAt: '2026-04-02T09:00:00.000Z',
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 5,
          textValue: null,
          question: {
            category: '리더십',
            questionText: '우선순위를 명확하게 정리합니다.',
            questionType: 'RATING_SCALE',
          },
        },
        {
          questionId: 'q-choice',
          ratingValue: null,
          textValue: '["우선순위 정리","실행력"]',
          question: {
            category: '강점 선택',
            questionText: '가장 자주 관찰되는 강점을 선택해 주세요.',
            questionType: 'MULTIPLE_CHOICE',
          },
        },
      ],
    },
    {
      id: 'fb-peer',
      relationship: 'PEER',
      giverName: '동료',
      overallComment: 'response speed is high and priorities stay clear.',
      submittedAt: '2026-04-02T10:00:00.000Z',
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 4,
          textValue: null,
          question: {
            category: '리더십',
            questionText: '우선순위를 명확하게 정리합니다.',
            questionType: 'RATING_SCALE',
          },
        },
        {
          questionId: 'q-choice',
          ratingValue: null,
          textValue: '우선순위 정리',
          question: {
            category: '강점 선택',
            questionText: '가장 자주 관찰되는 강점을 선택해 주세요.',
            questionType: 'MULTIPLE_CHOICE',
          },
        },
      ],
    },
    {
      id: 'fb-supervisor',
      relationship: 'SUPERVISOR',
      giverName: '리더',
      overallComment: 'clear priorities help the team move faster.',
      submittedAt: '2026-04-02T11:00:00.000Z',
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 4,
          textValue: null,
          question: {
            category: '리더십',
            questionText: '우선순위를 명확하게 정리합니다.',
            questionType: 'RATING_SCALE',
          },
        },
        {
          questionId: 'q-choice',
          ratingValue: null,
          textValue: '실행력',
          question: {
            category: '강점 선택',
            questionText: '가장 자주 관찰되는 강점을 선택해 주세요.',
            questionType: 'MULTIPLE_CHOICE',
          },
        },
      ],
    },
  ],
  benchmarkFeedbacks: [
    {
      id: 'fb-benchmark-1',
      relationship: 'PEER',
      giverName: '비교군',
      overallComment: null,
      submittedAt: null,
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 3,
          textValue: null,
          question: {
            category: '리더십',
            questionText: '우선순위를 명확하게 정리합니다.',
            questionType: 'RATING_SCALE',
          },
        },
      ],
    },
  ],
})

const baseViewModel: Feedback360ResultPdfModel = {
  roundName: '2026 상반기 360 리뷰',
  targetEmployee: {
    id: 'emp-1',
    name: '김하늘',
    department: '제품본부',
    position: '매니저',
  },
  recipientProfile: 'REVIEWEE',
  availableProfiles: [{ value: 'REVIEWEE', label: '구성원용 결과지' }],
  presentationSettings: {
    showLeaderComment: true,
    showLeaderScore: false,
    showExecutiveComment: false,
    showExecutiveScore: false,
    showFinalScore: true,
    showFinalComment: true,
  },
  anonymityThreshold: 3,
  feedbackCount: 4,
  thresholdMet: true,
  roundWeight: 30,
  summaryCards: [
    {
      id: 'LEADER_REVIEW',
      title: '팀장 평가',
      reviewerName: '정지원',
      relationshipLabel: '직속 리더',
      totalScore: null,
      comment: 'clear priorities help the team move faster.',
      showScore: false,
      showComment: true,
    },
    {
      id: 'FINAL_RESULT',
      title: '최종 결과',
      relationshipLabel: '종합 결과',
      totalScore: 87.5,
      comment: '다음 반기에는 우선순위 변경 이유를 더 자주 공유하면 좋겠습니다.',
      showScore: true,
      showComment: true,
    },
  ],
  categoryScores: [
    { category: '리더십', average: 92.1, count: 4 },
    { category: '문제 해결', average: 88.4, count: 4 },
  ],
  strengths: ['이해관계자와 우선순위를 명확하게 맞추고 공유합니다.'],
  improvements: ['우선순위 변경 이유를 더 짧은 주기로 설명하면 좋습니다.'],
  anonymousSummary: '익명 요약',
  textHighlights: ['업무 강점', '우선순위 정렬 보완'],
  groupedResponses: [
    {
      questionId: 'q-1',
      category: '업무',
      questionText: '업무 수행 과정에서 가장 돋보였던 강점은 무엇인가요?',
      answers: [
        {
          feedbackId: 'feedback-1',
          relationship: 'LEADER',
          authorLabel: '리더 1차',
          ratingValue: 5,
          textValue: 'clear priorities help the team move faster.',
        },
        {
          feedbackId: 'feedback-2',
          relationship: 'PEER',
          authorLabel: '동료',
          ratingValue: 4,
          textValue: 'response speed is high and priorities stay clear.',
        },
      ],
    },
  ],
  warnings: ['익명 요약은 최소 응답 수를 충족한 항목만 공개됩니다.'],
  developmentPlan: {
    focusArea: '우선순위 정렬',
    actions: ['체크인에서 우선순위 변경 이유를 먼저 공유합니다.'],
    managerSupport: ['리더가 월 1회 피드백을 제공합니다.'],
    nextCheckinTopics: ['업무 우선순위 변경과 의사결정 기준'],
  },
  reportCache: {
    id: 'report-1',
    generatedAt: '2026-04-02',
    source: 'persisted',
  },
  developmentPlanRecord: {
    id: 'plan-1',
    title: '업무 리더십 강화',
    status: 'ACTIVE',
    updatedAt: '2026-04-02',
  },
  linkage: [
    {
      label: '평가 결과',
      href: '/evaluation/results',
      description: '결과 요약 화면',
    },
  ],
  pdfHref: '/api/feedback/rounds/round-1/results-export?targetId=emp-1&profile=REVIEWEE',
  analysis,
}

async function main() {
  await run('feedback result pdf sections include recipient-specific summary and grouped comments', () => {
    const sections = buildFeedback360ResultPdfSections(baseViewModel)

    assert.equal(sections.title.includes('360'), true)
    assert.equal(sections.fileName.endsWith('.pdf'), true)
    assert.equal(sections.summaryRows.length >= 4, true)
    assert.equal(
      sections.summaryCards.some(
        (card) =>
          card.relationshipLabel === '직속 리더' &&
          card.comment.includes('clear priorities')
      ),
      true
    )
    assert.equal(
      sections.groupedResponses.some(
        (group) =>
          group.questionText.includes('강점') &&
          group.answers.some((answer) => answer.comment.includes('response speed'))
      ),
      true
    )
  })

  await run('feedback result pdf builder emits a real pdf payload', async () => {
    const bytes = await buildFeedback360ResultPdf(baseViewModel)
    const header = Buffer.from(bytes).subarray(0, 4).toString('utf8')

    assert.equal(header, '%PDF')
    assert.equal(bytes.length > 1024, true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
