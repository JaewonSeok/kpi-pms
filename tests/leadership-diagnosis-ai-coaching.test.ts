import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildLeadershipDiagnosisAiCoachingPrompt,
  buildLeadershipDiagnosisAiCoachingPromptInput,
  LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT,
  validateLeadershipDiagnosisAiCoachingResult,
} from '../src/components/evaluation/upward/leadershipDiagnosisAiCoachingPrompt'
import { UpwardReviewAICoachingRequestSchema } from '../src/lib/validations'
import type { UpwardReviewPageData } from '../src/server/upward-review'

type ResultsData = NonNullable<UpwardReviewPageData['results']>

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

function buildResults(overrides: Partial<ResultsData> = {}): ResultsData {
  return {
    roundId: 'round-1',
    roundName: '2026년 상반기 리더십 진단',
    released: true,
    thresholdMet: true,
    minRaters: 3,
    feedbackCount: 4,
    visible: true,
    canViewRaw: false,
    selectedTargetId: 'target-001',
    targets: [],
    targetEmployee: {
      id: 'target-001',
      name: '김리더',
      department: '인사팀',
      position: '팀장',
      email: 'leader@example.com',
    },
    strengths: ['의사소통에서 명확한 기준 제시가 반복적으로 확인됩니다.'],
    improvements: ['피드백/코칭에서 후속 확인 루틴을 강화할 필요가 있습니다.'],
    questionSummaries: [
      {
        questionId: 'q1',
        category: '의사소통',
        questionText: '나의 리더는 목표와 요구사항을 명확하고 구체적으로 설명한다.',
        questionType: 'RATING_SCALE',
        averageScore: 5.2,
        responseCount: 4,
        textResponses: [
          '구체적인 기준을 자주 공유합니다.',
          'reviewer@example.com이 아니라 익명 의견으로만 다뤄야 합니다.',
        ],
        choiceCounts: [],
      },
      {
        questionId: 'q2',
        category: '피드백/코칭',
        questionText: '나의 리더는 구성원의 성장을 돕는 피드백을 제공한다.',
        questionType: 'RATING_SCALE',
        averageScore: 3.1,
        responseCount: 4,
        textResponses: ['후속 확인이 더 자주 있으면 좋겠습니다.'],
        choiceCounts: [],
      },
    ],
    rawResponses: [
      {
        giverId: 'giver-123',
        giverName: '박응답',
        relationship: 'SUBORDINATE',
        overallComment: '010-1234-5678 연락처나 사번 0955는 prompt에서 제거되어야 합니다.',
        answers: [
          {
            questionId: 'q1',
            questionText: '나의 리더는 목표와 요구사항을 명확하고 구체적으로 설명한다.',
            ratingValue: 5,
            textValue: '명확한 공유가 장점입니다.',
          },
        ],
      },
    ],
    ...overrides,
  }
}

async function main() {
  await run('prompt input minimizes respondent identity and internal identifiers', () => {
    const input = buildLeadershipDiagnosisAiCoachingPromptInput(buildResults())
    const prompt = buildLeadershipDiagnosisAiCoachingPrompt(input)
    const combined = `${prompt.system}\n${prompt.user}`

    assert.equal(combined.includes('giver-123'), false)
    assert.equal(combined.includes('박응답'), false)
    assert.equal(combined.includes('target-001'), false)
    assert.equal(combined.includes('leader@example.com'), false)
    assert.equal(combined.includes('reviewer@example.com'), false)
    assert.equal(combined.includes('010-1234-5678'), false)
    assert.equal(combined.includes('0955'), false)
    assert.equal(combined.includes('[이메일 제거]'), true)
    assert.equal(combined.includes('[연락처 제거]'), true)
    assert.equal(combined.includes('[식별번호 제거]'), true)
  })

  await run('prompt includes official scoring, reward, anonymity, hallucination guardrails', () => {
    assert.equal(LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT.includes('공식 평가 점수, 등급, 보상, 승진, 인사 판단을 산정하지 않는다.'), true)
    assert.equal(LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT.includes('응답자/평가자의 신원, 이름, 이메일, 사번'), true)
    assert.equal(LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT.includes('입력 데이터에 없는 사실을 만들지 않는다.'), true)
    assert.equal(LEADERSHIP_DIAGNOSIS_AI_COACHING_SYSTEM_PROMPT.includes('JSON'), true)
  })

  await run('result schema accepts coaching structure without score or grade fields', () => {
    const parsed = validateLeadershipDiagnosisAiCoachingResult({
      summary: '반복적으로 관찰된 강점과 보완점을 바탕으로 실행 계획을 제안합니다.',
      confidenceLevel: 'MEDIUM',
      dataLimitations: ['응답 수가 제한적이면 해석을 보수적으로 봅니다.'],
      leadershipStrengths: [
        {
          title: '명확한 의사소통',
          category: '의사소통',
          observedBehavior: '목표와 기준을 구체적으로 공유하는 행동이 관찰됩니다.',
          evidence: ['의사소통 평균이 상대적으로 높습니다.'],
          keepDoing: ['업무 요청 시 기대 결과와 마감을 함께 적습니다.'],
          teamImpact: '협업 예측 가능성이 높아집니다.',
        },
      ],
      developmentAreas: [
        {
          title: '후속 코칭 루틴',
          category: '피드백/코칭',
          observedPattern: '피드백 이후 후속 확인이 부족할 수 있습니다.',
          impact: '구성원이 개선 방향을 지속하기 어렵습니다.',
          recommendedActions: ['2주 단위 체크인을 예약합니다.'],
        },
      ],
      blindSpots: [],
      actionPlan30Days: ['핵심 개선 행동 하나를 팀과 공유합니다.'],
      actionPlan60Days: ['반복 루틴으로 회의 아젠다에 넣습니다.'],
      actionPlan90Days: ['변화 체감을 다시 점검합니다.'],
      coachingQuestions: {
        selfReflection: ['내가 반복해서 놓치는 장면은 무엇인가요?'],
        teamConversation: ['팀이 기대하는 리더 행동은 무엇인가요?'],
        nextCheckIn: ['다음 점검 전 확인할 신호는 무엇인가요?'],
      },
      managerHrGuide: {
        recognize: ['유지할 강점을 인정합니다.'],
        ask: ['보완 행동을 구체 사례로 질문합니다.'],
        agree: ['실행할 행동 하나를 합의합니다.'],
        followUp: ['다음 체크인 일정을 정합니다.'],
      },
      safetyNote: '이 내용은 성장 참고용이며 공식 평가 점수나 등급을 자동 산정하지 않습니다.',
    })

    assert.equal(parsed.confidenceLevel, 'MEDIUM')
    assert.equal('score' in parsed, false)
    assert.equal('grade' in parsed, false)
  })

  await run('API route keeps session guard, safe provider and anonymity handling', () => {
    const route = read('src/app/api/feedback/upward/results/ai-coaching/route.ts')
    const server = read('src/server/ai/upward-review-coaching.ts')
    const valid = UpwardReviewAICoachingRequestSchema.safeParse({
      cycleId: 'cycle-1',
      roundId: 'round-1',
      empId: 'emp-1',
      mode: 'HR',
    })

    assert.equal(valid.success, true)
    assert.equal(route.includes('getServerSession(authOptions)'), true)
    assert.equal(route.includes('로그인이 필요합니다.'), true)
    assert.equal(route.includes('UpwardReviewAICoachingRequestSchema'), true)
    assert.equal(server.includes('AI_PROVIDER_UNAVAILABLE'), true)
    assert.equal(server.includes('AI 코칭 설정이 완료되지 않았습니다.'), true)
    assert.equal(server.includes('ANONYMITY_THRESHOLD_NOT_MET'), true)
    assert.equal(server.includes('응답 수와 익명 기준이 충족되면 AI 코칭을 생성할 수 있습니다.'), true)
    assert.equal(server.includes('skipResultsAuditLog: true'), true)
  })

  await run('AI coaching UI exposes disabled states and safety copy without PDF or official actions', () => {
    const panel = read('src/components/evaluation/upward/LeadershipDiagnosisAiCoachingPanel.tsx')
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')

    assert.equal(panel.includes('AI 리더십 코칭'), true)
    assert.equal(panel.includes('AI 코칭 설정이 완료되지 않아 현재는 결과 요약과 후속 액션만 확인할 수 있습니다.'), true)
    assert.equal(panel.includes('응답 수와 익명 기준이 충족되면 AI 코칭을 생성할 수 있습니다.'), true)
    assert.equal(panel.includes('공식 평가 점수나 등급을 자동 산정하지 않습니다.'), true)
    assert.equal(panel.includes('개별 응답자를 추정하거나 공개하지 않습니다.'), true)
    assert.equal(panel.includes('전체 복사'), true)
    assert.equal(panel.includes('실행 계획 복사'), true)
    assert.equal(panel.includes('저장'), false)
    assert.equal(panel.includes('공식 반영'), false)
    assert.equal(client.includes('PDF 다운로드'), false)
  })

  await run('server helper has no DB write, raw prompt logging, score or grade writes', () => {
    const server = read('src/server/ai/upward-review-coaching.ts')
    const prompt = read('src/components/evaluation/upward/leadershipDiagnosisAiCoachingPrompt.ts')

    assert.equal(server.includes('prisma'), false)
    assert.equal(server.includes('aiRequestLog'), false)
    assert.equal(server.includes('recordOperationalEvent'), false)
    assert.equal(server.includes('createAuditLog'), false)
    assert.equal(server.includes('console.log'), false)
    assert.equal(server.includes('console.error'), false)
    assert.equal(server.includes('Evaluation.totalScore'), false)
    assert.equal(server.includes('gradeId'), false)
    assert.equal(server.includes('EvaluationItem'), false)
    assert.equal(prompt.includes('feedbackId'), false)
    assert.equal(prompt.includes('employeeId'), false)
    assert.equal(prompt.includes('giverName'), false)
    assert.equal(prompt.includes('giverId'), false)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
