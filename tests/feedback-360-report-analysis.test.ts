import assert from 'node:assert/strict'
import {
  DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS,
  buildFeedbackReportAnalysis,
  describeFeedbackAnalysisStrength,
  getFeedbackReportAnalysisThreshold,
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

async function main() {
  await run('report analysis settings support overview, menu, wording, and strength overrides', () => {
    const parsed = parseFeedbackReportAnalysisSettings({
      overview: {
        companyMessage: '회사가 전하는 메시지',
      },
      menu: {
        overview: {
          label: '핵심 요약',
          visible: false,
        },
      },
      wording: {
        improvementLabel: '보완 포인트',
        balancedLabel: '안정',
      },
      strength: 'STRONG',
    })

    assert.equal(parsed.overview.companyMessage, '회사가 전하는 메시지')
    assert.equal(parsed.overview.purposeMessage, DEFAULT_FEEDBACK_REPORT_ANALYSIS_SETTINGS.overview.purposeMessage)
    assert.equal(parsed.menu.overview.label, '핵심 요약')
    assert.equal(parsed.menu.overview.visible, false)
    assert.equal(parsed.menu.questionScores.visible, true)
    assert.equal(parsed.wording.improvementLabel, '보완 포인트')
    assert.equal(parsed.wording.balancedLabel, '안정')
    assert.equal(parsed.strength, 'STRONG')
  })

  await run('analysis strength thresholds and descriptions stay distinct across three levels', () => {
    assert.deepEqual(getFeedbackReportAnalysisThreshold('LIGHT'), {
      benchmarkDelta: 4,
      selfAwarenessDelta: 5,
    })
    assert.deepEqual(getFeedbackReportAnalysisThreshold('DEFAULT'), {
      benchmarkDelta: 8,
      selfAwarenessDelta: 10,
    })
    assert.deepEqual(getFeedbackReportAnalysisThreshold('STRONG'), {
      benchmarkDelta: 12,
      selfAwarenessDelta: 14,
    })

    assert.equal(describeFeedbackAnalysisStrength('LIGHT').label.length > 0, true)
    assert.equal(describeFeedbackAnalysisStrength('DEFAULT').description.length > 0, true)
    assert.equal(describeFeedbackAnalysisStrength('STRONG').description.length > 0, true)
  })

  await run('build feedback report analysis returns score insights, detailed view data, and objective choice analysis', () => {
    const payload = buildFeedbackReportAnalysis({
      settings: parseFeedbackReportAnalysisSettings({
        menu: {
          resultLink: {
            label: '결과 바로가기',
            visible: true,
          },
        },
        wording: {
          strengthLabel: '강점',
          improvementLabel: '보완점',
          selfAwarenessLabel: '자기객관화',
          selfHighLabel: '자기 인식 높음',
          selfLowLabel: '자기 인식 낮음',
          balancedLabel: '균형',
        },
        strength: 'DEFAULT',
      }),
      roundName: '2026 상반기 360',
      recipientProfile: 'REVIEWEE',
      pdfHref: '/api/feedback/rounds/round-1/results-export?targetId=emp-1',
      links: [
        {
          label: '리뷰 결과',
          href: '/evaluation/results',
          description: '기존 평가 결과 화면',
        },
      ],
      questions: [
        {
          id: 'q-rating',
          category: '리더십',
          questionText: '변화를 주도합니다.',
          questionType: 'RATING_SCALE',
        },
        {
          id: 'q-choice',
          category: '강점 선택',
          questionText: '대표 강점을 선택해 주세요.',
          questionType: 'MULTIPLE_CHOICE',
        },
      ],
      targetFeedbacks: [
        {
          id: 'fb-self',
          relationship: 'SELF',
          giverName: '본인',
          overallComment: '스스로도 변화 실행력이 높다고 느꼈습니다.',
          submittedAt: '2026-06-15T00:00:00.000Z',
          responses: [
            {
              questionId: 'q-rating',
              ratingValue: 5,
              textValue: null,
              question: {
                category: '리더십',
                questionText: '변화를 주도합니다.',
                questionType: 'RATING_SCALE',
              },
            },
            {
              questionId: 'q-choice',
              ratingValue: null,
              textValue: '["전략적 사고","변화 관리"]',
              question: {
                category: '강점 선택',
                questionText: '대표 강점을 선택해 주세요.',
                questionType: 'MULTIPLE_CHOICE',
              },
            },
          ],
        },
        {
          id: 'fb-peer',
          relationship: 'PEER',
          giverName: '동료',
          overallComment: '실행은 강하지만 우선순위 정리가 더 필요합니다.',
          submittedAt: '2026-06-16T00:00:00.000Z',
          responses: [
            {
              questionId: 'q-rating',
              ratingValue: 4,
              textValue: null,
              question: {
                category: '리더십',
                questionText: '변화를 주도합니다.',
                questionType: 'RATING_SCALE',
              },
            },
            {
              questionId: 'q-choice',
              ratingValue: null,
              textValue: '전략적 사고',
              question: {
                category: '강점 선택',
                questionText: '대표 강점을 선택해 주세요.',
                questionType: 'MULTIPLE_CHOICE',
              },
            },
          ],
        },
        {
          id: 'fb-supervisor',
          relationship: 'SUPERVISOR',
          giverName: '리더',
          overallComment: '협업 정렬이 좋아졌습니다.',
          submittedAt: '2026-06-17T00:00:00.000Z',
          responses: [
            {
              questionId: 'q-rating',
              ratingValue: 3,
              textValue: null,
              question: {
                category: '리더십',
                questionText: '변화를 주도합니다.',
                questionType: 'RATING_SCALE',
              },
            },
            {
              questionId: 'q-choice',
              ratingValue: null,
              textValue: '변화 관리',
              question: {
                category: '강점 선택',
                questionText: '대표 강점을 선택해 주세요.',
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
                questionText: '변화를 주도합니다.',
                questionType: 'RATING_SCALE',
              },
            },
          ],
        },
        {
          id: 'fb-benchmark-2',
          relationship: 'SUPERVISOR',
          giverName: '비교군 리더',
          overallComment: null,
          submittedAt: null,
          responses: [
            {
              questionId: 'q-rating',
              ratingValue: 2,
              textValue: null,
              question: {
                category: '리더십',
                questionText: '변화를 주도합니다.',
                questionType: 'RATING_SCALE',
              },
            },
          ],
        },
      ],
    })

    assert.equal(payload.overview.companyMessage.length > 0, true)
    assert.equal(payload.menu.find((item) => item.key === 'resultLink')?.label, '결과 바로가기')
    assert.equal(payload.questionInsights.length, 1)
    assert.equal(payload.relativeComparisons.length, 1)
    assert.equal(payload.selfAwareness.length, 1)
    assert.equal(payload.reviewDetails.length, 3)
    assert.equal(payload.questionScoreCards.length, 1)
    assert.equal(payload.questionScoreCards[0].series.length >= 3, true)
    assert.equal(payload.objectiveAnswers.length, 1)
    assert.equal(payload.objectiveAnswers[0].selectionMode, 'MULTIPLE')
    assert.equal(payload.objectiveAnswers[0].options[0].count >= payload.objectiveAnswers[0].options[1].count, true)
    assert.equal(payload.objectiveAnswers[0].options.some((option) => option.label === '전략적 사고'), true)
    assert.equal(payload.resultLink.profileLabel.length > 0, true)
    assert.equal(payload.resultLink.pdfHref.includes('/results-export'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
