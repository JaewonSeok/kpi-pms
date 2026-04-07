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
      companyMessage: 'Company message',
      purposeMessage: 'Use this report to support growth conversations and follow-up actions.',
      acceptanceGuide: 'Review differences by question and connect them to the next action.',
    },
  }),
  roundName: '2026 H1 360 Review',
  recipientProfile: 'REVIEWEE',
  pdfHref: '/api/feedback/rounds/round-1/results-export?targetId=emp-1&profile=REVIEWEE',
  links: [
    {
      label: 'Evaluation result',
      href: '/evaluation/results',
      description: 'Go to the result summary page.',
    },
  ],
  questions: [
    {
      id: 'q-rating',
      category: 'Leadership',
      questionText: 'Clarifies priorities for the team.',
      questionType: 'RATING_SCALE',
    },
    {
      id: 'q-choice',
      category: 'Observed strengths',
      questionText: 'Select the strengths you observed most often.',
      questionType: 'MULTIPLE_CHOICE',
    },
  ],
  targetFeedbacks: [
    {
      id: 'fb-self',
      relationship: 'SELF',
      giverName: 'Self',
      overallComment: 'I believe priority alignment is one of my strengths.',
      submittedAt: '2026-04-02T09:00:00.000Z',
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 5,
          textValue: null,
          question: {
            category: 'Leadership',
            questionText: 'Clarifies priorities for the team.',
            questionType: 'RATING_SCALE',
          },
        },
        {
          questionId: 'q-choice',
          ratingValue: null,
          textValue: '["Priority alignment","Execution discipline"]',
          question: {
            category: 'Observed strengths',
            questionText: 'Select the strengths you observed most often.',
            questionType: 'MULTIPLE_CHOICE',
          },
        },
      ],
    },
    {
      id: 'fb-peer',
      relationship: 'PEER',
      giverName: 'Peer',
      overallComment: 'Response speed is high and priorities stay clear.',
      submittedAt: '2026-04-02T10:00:00.000Z',
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 4,
          textValue: null,
          question: {
            category: 'Leadership',
            questionText: 'Clarifies priorities for the team.',
            questionType: 'RATING_SCALE',
          },
        },
        {
          questionId: 'q-choice',
          ratingValue: null,
          textValue: 'Priority alignment',
          question: {
            category: 'Observed strengths',
            questionText: 'Select the strengths you observed most often.',
            questionType: 'MULTIPLE_CHOICE',
          },
        },
      ],
    },
    {
      id: 'fb-supervisor',
      relationship: 'SUPERVISOR',
      giverName: 'Leader',
      overallComment: 'Clear priorities help the team move faster.',
      submittedAt: '2026-04-02T11:00:00.000Z',
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 4,
          textValue: null,
          question: {
            category: 'Leadership',
            questionText: 'Clarifies priorities for the team.',
            questionType: 'RATING_SCALE',
          },
        },
        {
          questionId: 'q-choice',
          ratingValue: null,
          textValue: 'Execution discipline',
          question: {
            category: 'Observed strengths',
            questionText: 'Select the strengths you observed most often.',
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
      giverName: 'Benchmark peer',
      overallComment: null,
      submittedAt: null,
      responses: [
        {
          questionId: 'q-rating',
          ratingValue: 3,
          textValue: null,
          question: {
            category: 'Leadership',
            questionText: 'Clarifies priorities for the team.',
            questionType: 'RATING_SCALE',
          },
        },
      ],
    },
  ],
})

const baseViewModel: Feedback360ResultPdfModel = {
  roundName: '2026 H1 360 Review',
  targetEmployee: {
    id: 'emp-1',
    name: 'Kim Sky',
    department: 'Product',
    position: 'Manager',
  },
  recipientProfile: 'REVIEWEE',
  availableProfiles: [{ value: 'REVIEWEE', label: 'Reviewee result' }],
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
      title: 'Leader review',
      reviewerName: 'Manager',
      relationshipLabel: 'Direct leader',
      totalScore: null,
      comment: 'Clear priorities help the team move faster.',
      showScore: false,
      showComment: true,
    },
    {
      id: 'FINAL_RESULT',
      title: 'Final result',
      relationshipLabel: 'Overall result',
      totalScore: 87.5,
      comment: 'Next half, share the reasons behind priority changes more often.',
      showScore: true,
      showComment: true,
    },
  ],
  categoryScores: [
    { category: 'Leadership', average: 92.1, count: 4 },
    { category: 'Problem solving', average: 88.4, count: 4 },
  ],
  strengths: ['Aligns stakeholders around a clear priority order.'],
  improvements: ['Explain why priorities changed more explicitly.'],
  anonymousSummary: 'Anonymous summary',
  textHighlights: ['Leadership strength', 'Priority alignment follow-up'],
  groupedResponses: [
    {
      questionId: 'q-1',
      category: 'Work',
      questionText: 'What is the strongest observed behavior in day-to-day execution?',
      answers: [
        {
          feedbackId: 'feedback-1',
          relationship: 'LEADER',
          authorLabel: 'Leader 1st review',
          ratingValue: 5,
          textValue: 'Clear priorities help the team move faster.',
        },
        {
          feedbackId: 'feedback-2',
          relationship: 'PEER',
          authorLabel: 'Peer',
          ratingValue: 4,
          textValue: 'Response speed is high and priorities stay clear.',
        },
      ],
    },
  ],
  warnings: ['Anonymous summaries are shown only when the minimum response threshold is met.'],
  developmentPlan: {
    focusArea: 'Priority alignment',
    actions: ['Share the reason behind priority changes earlier in check-ins.'],
    recommendedCompetencies: ['Priority alignment', 'Feedback follow-through'],
    managerSupport: ['Leader provides weekly feedback.'],
    nextCheckinTopics: ['Priority changes and decision criteria'],
    linkedEvidence: [],
  },
  reportCache: {
    id: 'report-1',
    generatedAt: '2026-04-02',
    source: 'persisted',
  },
  developmentPlanRecord: {
    id: 'plan-1',
    title: 'Build a steadier work rhythm',
    status: 'ACTIVE',
    updatedAt: '2026-04-02',
    actions: [
      {
        id: 'action-1',
        title: 'Share priority changes with the team first.',
        status: 'IN_PROGRESS',
      },
    ],
    recommendedCompetencies: ['Priority alignment'],
    managerSupport: ['Leader gives weekly feedback.'],
    nextCheckinTopics: ['Decision criteria and priority changes'],
    linkedEvidence: [],
    note: null,
    dueDate: null,
    progressRate: 0,
  },
  linkage: [
    {
      label: 'Evaluation result',
      href: '/evaluation/results',
      description: 'Result summary',
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
      sections.summaryCards.some((card) => card.comment.toLowerCase().includes('clear priorities')),
      true
    )
    assert.equal(
      sections.groupedResponses.some(
        (group) =>
          group.questionText.includes('strongest') &&
          group.answers.some((answer) => answer.comment.includes('Response speed'))
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
