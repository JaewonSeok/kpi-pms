import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildFeedback360AiCoachingPrompt,
  buildFeedback360AiCoachingPromptInput,
  validateFeedback360AiCoachingResult,
} from '../src/components/evaluation/feedback360/ppt/feedback360AiCoachingPrompt'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function main() {
  await run('feedback 360 ai coaching prompt removes reviewer identity and requires safe JSON', () => {
    const results = {
      roundName: '2026년 상반기 360 다면평가',
      targetEmployee: {
        id: 'target-employee-id',
        name: '홍길동',
        department: '인사팀',
        position: '팀장',
      },
      anonymityThreshold: 3,
      feedbackCount: 4,
      thresholdMet: true,
      categoryScores: [
        { category: '팀워크', average: 4.5, count: 4 },
        { category: '소통', average: 3.8, count: 4 },
      ],
      strengths: ['팀워크 영역에서 반복적으로 강점이 확인됩니다.'],
      improvements: ['소통 방식은 더 구체적인 공유 루틴이 필요합니다.'],
      anonymousSummary: '익명 요약만 사용합니다.',
      textHighlights: ['협업 요청에 빠르게 대응했습니다. reviewer@example.com 0955'],
      groupedResponses: [
        {
          questionId: 'question-1',
          category: '팀워크',
          questionText: '협업에 기여했습니다.',
          answers: [
            {
              feedbackId: 'feedback-raw-id',
              relationship: 'PEER',
              authorLabel: 'Reviewer A',
              ratingValue: 5,
              textValue: '[선택 태그 요약]\n긍정: 협업 요청에 빠르게 응답해요\n보완: 업무 공유가 조금 더 필요해요\n\nReviewer A가 남긴 원문',
            },
          ],
        },
      ],
      developmentPlan: {
        nextCheckinTopics: ['다음 체크인에서 협업 루틴을 확인합니다.'],
      },
    } as never

    const input = buildFeedback360AiCoachingPromptInput(results)
    const prompt = buildFeedback360AiCoachingPrompt(input)
    const serialized = JSON.stringify({ input, prompt })

    for (const forbidden of [
      'Reviewer A',
      'reviewer@example.com',
      '0955',
      'feedback-raw-id',
      'PEER',
      'authorLabel',
      'relationship',
      'employeeId',
    ]) {
      assert.equal(serialized.includes(forbidden), false, `${forbidden} should not be present`)
    }

    assert.equal(prompt.system.includes('공식 평가 점수, 등급, 보상, 승진 판단을 산정하지 않는다.'), true)
    assert.equal(prompt.system.includes('출력은 반드시 JSON으로만 작성'), true)
    assert.equal(prompt.user.includes('개별 리뷰어를 추정하지 마세요.'), true)
    assert.equal(prompt.user.includes('공식 점수나 등급을 산정하지 마세요.'), true)
    assert.equal(input.positiveTags.some((tag) => tag.label === '협업 요청에 빠르게 응답해요'), true)
    assert.equal(input.improvementTags.some((tag) => tag.label === '업무 공유가 조금 더 필요해요'), true)
  })

  await run('feedback 360 ai coaching result schema validates structured output without OpenAI', () => {
    const parsed = validateFeedback360AiCoachingResult({
      summary: '반복적으로 확인된 강점과 보완 행동을 균형 있게 정리했습니다.',
      confidenceLevel: 'MEDIUM',
      dataLimitations: ['응답 수가 제한적이므로 단정적 해석은 피합니다.'],
      strengths: [
        {
          title: '협업 대응',
          evidence: ['협업 요청에 빠르게 대응해요'],
          coaching: '빠른 응답은 업무 예측 가능성을 높입니다.',
          keepDoing: ['요청 접수 후 기대 결과와 일정을 함께 확인합니다.'],
        },
      ],
      developmentAreas: [
        {
          title: '업무 공유',
          evidence: ['업무 공유가 부족해요'],
          impact: '정보 공유가 늦으면 의사결정 속도가 떨어질 수 있습니다.',
          recommendedActions: ['주요 결정 사항을 짧은 요약으로 공유합니다.'],
        },
      ],
      blindSpots: [],
      actionPlan30Days: ['공유 루틴 한 가지를 정합니다.'],
      actionPlan60Days: ['반복 회의에서 공유 기준을 점검합니다.'],
      actionPlan90Days: ['팀 성과 지표와 연결합니다.'],
      coachingQuestions: {
        selfReflection: ['최근 공유가 늦어진 장면은 무엇인가요?'],
        managerConversation: ['어떤 방식의 공유가 가장 도움이 되나요?'],
        nextCheckIn: ['2주 뒤 어떤 변화를 확인할까요?'],
      },
      managerGuide: {
        recognize: ['빠른 협업 대응을 인정합니다.'],
        ask: ['정보 공유가 막히는 순간을 묻습니다.'],
        agree: ['공유 기준을 하나 합의합니다.'],
        followUp: ['다음 체크인에서 반복 여부를 확인합니다.'],
      },
      safetyNote: '이 내용은 참고용 코칭 인사이트이며 공식 평가 결과가 아닙니다.',
    })

    assert.equal(parsed.confidenceLevel, 'MEDIUM')
    assert.equal(parsed.managerGuide.ask.length, 1)
  })

  await run('feedback 360 ai coaching route and UI keep safety boundaries', () => {
    const route = read('src/app/api/feedback/360/ai-coaching/route.ts')
    const server = read('src/server/ai/feedback360-ai-coaching.ts')
    const panel = read('src/components/evaluation/feedback360/ppt/Feedback360AiCoachingPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const feedbackServer = read('src/server/feedback-360.ts')

    for (const text of [
      'AI 코칭 인사이트',
      '다면평가 결과를 바탕으로 성장 대화와 실행 계획을 정리합니다.',
      '공식 평가 점수나 등급을 자동 산정하지 않습니다.',
      'AI 코칭을 사용하려면 AI 설정이 필요합니다.',
      '응답 수와 익명 기준이 충족되면 AI 코칭을 생성할 수 있습니다.',
      'AI 코칭 생성',
      '다시 생성',
      '복사',
    ]) {
      assert.equal(`${panel}\n${workspace}`.includes(text), true, `missing ${text}`)
    }

    for (const text of [
      'getServerSession',
      'Feedback360AiCoachingRequestSchema',
      'generateFeedback360AiCoaching',
      "mode: 'results'",
      'ANONYMITY_THRESHOLD_NOT_MET',
      'AI_PROVIDER_UNAVAILABLE',
      'json_schema',
      'validateFeedback360AiCoachingResult',
      'readAiAssistEnv',
    ]) {
      assert.equal(`${route}\n${server}\n${feedbackServer}`.includes(text), true, `missing ${text}`)
    }

    for (const forbidden of [
      'aiRequestLog.create',
      'recordOperationalEvent',
      'prisma.',
      'Evaluation.totalScore',
      'Evaluation.gradeId',
      'EvaluationItem',
      'feature flag',
      'PDF 다운로드',
      '워드클라우드',
      'NEEDS_BACKEND_FOLLOWUP',
      'console.log',
    ]) {
      assert.equal(`${route}\n${server}\n${panel}`.includes(forbidden), false, `${forbidden} should stay absent`)
    }

    assert.equal(workspace.includes('Feedback360AiCoachingPanel'), true)
    assert.equal(feedbackServer.includes('aiCoachingReadiness'), true)
    assert.equal(feedbackServer.includes('providerConfigured'), true)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
