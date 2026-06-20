import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { flattenNavigationItems, filterNavigationItemsByRole, NAV_ITEMS } from '../src/lib/navigation'
import {
  buildUpwardSuggestions,
  canViewUpwardResults,
  DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS,
  getLeadershipEvaluateeIdsForEvaluator,
  getUpwardRoundResponseGate,
  parseChoiceOptions,
  parseUpwardReviewSettings,
  summarizeUpwardResults,
  validateUpwardAssignment,
} from '../src/lib/upward-review'
import { UpwardReviewResponseSchema } from '../src/lib/validations'

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

function hrefsForRole(role: string) {
  return flattenNavigationItems(filterNavigationItemsByRole(NAV_ITEMS, role)).map((item) => item.href)
}

async function main() {
  await run('upward response and results routes exist', () => {
    const requiredPages = [
      'src/app/(main)/evaluation/upward/admin/page.tsx',
      'src/app/(main)/evaluation/upward/respond/page.tsx',
      'src/app/(main)/evaluation/upward/respond/[feedbackId]/page.tsx',
      'src/app/(main)/evaluation/upward/results/page.tsx',
      'src/app/api/feedback/upward/admin/route.ts',
      'src/app/api/feedback/upward/responses/[feedbackId]/route.ts',
    ]

    for (const file of requiredPages) {
      assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
    }
  })

  await run('upward response navigation is visible to members and admin console stays restricted', () => {
    const memberHrefs = hrefsForRole('ROLE_MEMBER')
    const adminHrefs = hrefsForRole('ROLE_ADMIN')

    assert.equal(memberHrefs.includes('/evaluation/upward/respond'), true)
    assert.equal(memberHrefs.includes('/evaluation/upward/admin'), false)
    assert.equal(adminHrefs.includes('/evaluation/upward/respond'), true)
    assert.equal(adminHrefs.includes('/evaluation/upward/admin'), true)
    assert.equal(resolveMenuFromPath('/evaluation/upward/respond'), 'FEEDBACK_360')
    assert.equal(resolveMenuFromPath('/evaluation/upward/respond/feedback-1'), 'FEEDBACK_360')
    assert.equal(resolveMenuFromPath('/evaluation/upward/results'), 'FEEDBACK_360')
    assert.equal(resolveMenuFromPath('/api/feedback/upward/responses/feedback-1'), 'FEEDBACK_360')
  })

  await run('leadership response page source includes list, draft, submit, and read-only flow', () => {
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
    const loader = read('src/server/upward-review.ts')

    assert.equal(client.includes('내가 평가할 사람'), true)
    assert.equal(client.includes('임시 저장'), true)
    assert.equal(client.includes('제출하기'), true)
    assert.equal(loader.includes('이 리더십 진단은 이미 최종 제출되어 읽기 전용 상태입니다.'), true)
    assert.equal(client.includes("respondData.readOnlyReason === 'SUBMITTED'"), true)
    assert.equal(client.includes("respondData.readOnlyReason && respondData.readOnlyReason !== 'SUBMITTED'"), true)
    assert.equal(client.includes('진단 운영에서 시작하기'), true)
    assert.equal(loader.includes('getUpwardRoundResponseGate(feedback.round)'), true)
    assert.equal(loader.includes('진단 시작일 전이라 아직 응답할 수 없습니다.'), true)
    assert.equal(loader.includes('진단 기간이 마감되어 응답할 수 없습니다.'), true)
    assert.equal(client.includes('현재 배정된 리더십 진단이 없습니다.'), true)
    assert.equal(client.includes('리더십 진단 운영 열기'), true)
    assert.equal(client.includes('문항 세트 작성 → 진단 기간 생성 → 대상자 매핑'), true)
    assert.equal(loader.includes('이 평가는 리더의 운영 방식과 리더십을 더 잘 이해하고 개선하기 위한 참고 자료로 활용됩니다.'), true)
    assert.equal(loader.includes('구체적인 관찰과 경험을 바탕으로 작성해 주세요.'), true)
    assert.equal(loader.includes('감정적 표현보다 사실과 행동 중심으로 작성해 주세요.'), true)
    assert.equal(loader.includes('익명 기준을 충족한 경우에만 결과가 공개됩니다.'), true)
    assert.equal(client.includes('sectionCommentState'), true)
    assert.equal(client.includes('parseLeadershipSectionComments'), true)
    assert.equal(client.includes('serializeLeadershipSectionComments'), true)
    assert.equal(client.includes('value={sectionComment}'), true)
    assert.equal(client.includes('value={overallComment}'), false)
    assert.equal(client.includes('setOverallComment'), false)
    assert.equal(client.includes('getLeadershipProgressQuestions'), true)
    assert.equal(client.includes('isLeadershipQuestionAnswered(question, questionState[question.id])'), true)
    assert.equal(client.includes('responseQuestionTotal'), true)
    assert.equal(client.includes('previous = current[question.id] ?? currentState'), true)
  })

  await run('response api route supports draft save and final submit with assignment ownership guard', () => {
    const route = read('src/app/api/feedback/upward/responses/[feedbackId]/route.ts')
    const feedbackRoute = read('src/app/api/feedback/route.ts')
    const loader = read('src/server/upward-review.ts')

    assert.equal(route.includes('export async function PATCH'), true)
    assert.equal(route.includes('export async function POST'), true)
    assert.equal(route.includes('UPWARD_REVIEW_DRAFT_SAVED'), true)
    assert.equal(route.includes('UPWARD_REVIEW_SUBMITTED'), true)
    assert.equal(route.includes('giverId: actorId'), true)
    assert.equal(route.includes('최종 제출된 리더십 진단은 수정할 수 없습니다.'), true)
    assert.equal(route.includes('assertRoundAcceptsResponses'), true)
    assert.equal(route.includes('getUpwardRoundResponseGate(round)'), true)
    assert.equal(route.includes('진단 시작일 전이라 아직 응답할 수 없습니다.'), true)
    assert.equal(route.includes('진단 기간이 마감되어 응답할 수 없습니다.'), true)
    assert.equal(route.includes('필수 문항에 응답해 주세요.'), true)
    assert.equal(feedbackRoute.includes('리더십 진단은 리더십 진단 응답 화면에서 제출해 주세요.'), true)
    assert.equal(loader.includes('if (feedback.giverId !== employee.id)'), true)
  })

  await run('results page source includes visibility guidance and audit logging', () => {
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
    const loader = read('src/server/upward-review.ts')

    assert.equal(client.includes('리더십 진단은 리더의 운영 방식과 개선 방향을 이해하기 위한 참고 자료입니다.'), true)
    assert.equal(client.includes('집계 결과만 제공되며, 개별 평가자 정보는 공개되지 않습니다.'), true)
    assert.equal(client.includes('결과 비공개'), true)
    assert.equal(client.includes('종합 강점 및 보완 영역'), true)
    assert.equal(client.includes('개발 제안'), true)
    assert.equal(loader.includes('UPWARD_REVIEW_RESULTS_VIEWED'), true)
    assert.equal(loader.includes("visibilityMode: rawResponsePolicyAllows ? 'ADMIN_RAW' : visible ? 'AGGREGATED' : 'HIDDEN'"), true)
    assert.equal(loader.includes('targets: accessibleTargets.map((target) => {'), true)
  })

  await run('response validation schema uses korean messages and accepts draft payloads', () => {
    const valid = UpwardReviewResponseSchema.safeParse({
      overallComment: '리더십 방향성이 명확했습니다.',
      responses: [
        {
          questionId: 'question-1',
          ratingValue: 4,
          textValue: '상황에 맞는 피드백을 주었습니다.',
        },
      ],
    })

    assert.equal(valid.success, true)

    const invalid = UpwardReviewResponseSchema.safeParse({
      overallComment: 'x'.repeat(1001),
      responses: [
        {
          questionId: '',
          ratingValue: 0,
          textValue: 'y'.repeat(4001),
        },
      ],
    })

    assert.equal(invalid.success, false)
    if (!invalid.success) {
      const messages = invalid.error.issues.map((issue) => issue.message).join('\n')
      assert.equal(messages.includes('공통 의견은 1000자 이내로 입력해 주세요.'), true)
      assert.equal(messages.includes('문항 정보가 올바르지 않습니다.'), true)
      assert.equal(messages.includes('척도형 응답은 1 이상이어야 합니다.'), true)
      assert.equal(messages.includes('서술형 응답은 4000자 이내로 입력해 주세요.'), true)
    }
  })

  await run('shared upward helpers keep choice parsing and self-review guard intact', () => {
    assert.deepEqual(parseChoiceOptions([' 명확한 목표 ', '', '빠른 피드백 ']), [
      '명확한 목표',
      '빠른 피드백',
    ])

    const validationMessage = validateUpwardAssignment({
      evaluator: {
        id: 'emp-1',
        empName: '홍길동',
        teamLeaderId: 'leader-1',
        sectionChiefId: 'leader-2',
        divisionHeadId: 'leader-3',
      },
      evaluatee: {
        id: 'emp-1',
        empName: '홍길동',
      },
      relationship: 'SUBORDINATE',
    })

    assert.equal(validationMessage, '자기 자신을 리더십 진단 대상으로 지정할 수 없습니다.')

    assert.deepEqual(
      getUpwardRoundResponseGate(
        {
          status: 'DRAFT',
          startDate: '2026-06-19T00:00:00.000Z',
          endDate: '2026-06-30T23:59:59.000Z',
        },
        new Date('2026-06-20T00:00:00.000Z')
      ),
      { open: true, reason: 'OPEN' }
    )
    assert.deepEqual(
      getUpwardRoundResponseGate(
        {
          status: 'DRAFT',
          startDate: '2026-06-21T00:00:00.000Z',
          endDate: '2026-06-30T23:59:59.000Z',
        },
        new Date('2026-06-20T00:00:00.000Z')
      ),
      { open: false, reason: 'ROUND_NOT_STARTED' }
    )
    assert.deepEqual(
      getUpwardRoundResponseGate(
        {
          status: 'COMPLETED',
          startDate: '2026-06-19T00:00:00.000Z',
          endDate: '2026-06-30T23:59:59.000Z',
        },
        new Date('2026-06-20T00:00:00.000Z')
      ),
      { open: false, reason: 'ROUND_CLOSED' }
    )
  })

  await run('leadership diagnosis default questions and operation labels are ready to edit', () => {
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
    const route = read('src/app/api/feedback/upward/admin/route.ts')
    const shell = read('src/components/layout/MainShell.tsx')

    assert.equal(DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS.length, 24)
    assert.equal(DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS[0].category, '바른생각 (커뮤니케이션)')
    assert.equal(DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS.some((question) => question.category === '혁신'), true)
    assert.equal(route.includes('DEFAULT_LEADERSHIP_DIAGNOSIS_QUESTIONS.map'), true)
    assert.equal(route.includes('기본 문항 24개가 함께 추가되었습니다.'), true)
    assert.equal(route.includes("action === 'seedDefaultQuestions'"), true)
    assert.equal(route.includes('기본 리더십 진단 문항'), true)
    assert.equal(client.includes('문항 세트'), true)
    assert.equal(client.includes('진단 기간 설정'), true)
    assert.equal(client.includes('새 문항 세트'), true)
    assert.equal(client.includes('새 진단 기간'), true)
    assert.equal(client.includes('기존 진단 기간 불러오기'), true)
    assert.equal(client.includes('새 진단 기간 작성'), true)
    assert.equal(client.includes('저장된 진단 기간이 없습니다. 아래 항목을 입력하면 바로 첫 진단 기간을 만들 수 있습니다.'), true)
    assert.equal(client.includes('handleStartNewRound'), true)
    assert.equal(client.includes("const hasRoundId = Object.prototype.hasOwnProperty.call(params, 'roundId')"), true)
    assert.equal(client.includes('buildLeadershipPeriodName(cycleName)'), true)
    assert.equal(client.includes('리더십 진단 기간명'), false)
    assert.equal(client.includes('명 이상 응답 시 결과 공개'), true)
    assert.equal(client.includes('진단 대상자별 응답자가 이 기준보다 적으면 결과를 공개하지 않습니다.'), true)
    assert.equal(client.includes('round.startDate} ~ {round.endDate}'), true)
    assert.equal(client.includes('기본 24문항으로 문항 세트 생성'), true)
    assert.equal(client.includes('기본 24문항 채우기'), true)
    assert.equal(client.includes('저장하면 기본 리더십 진단 문항 24개가 문항 직접 관리에 자동으로 생성됩니다.'), true)
    assert.equal(client.includes('문항 내용과 척도를 한 화면에서 넓게 입력합니다.'), true)
    assert.equal(client.includes('조직도 추천 매핑'), true)
    assert.equal(client.includes('전체 추천 매핑 추가'), true)
    assert.equal(client.includes('추천 대상 리더'), true)
    assert.equal(client.includes('suggestionTargetOptions'), true)
    assert.equal(client.includes('전체 추천 보기 · {adminData.suggestions.length}건'), true)
    assert.equal(client.includes('조직도 추천은 현재 직원 조직도에서 팀원은 팀장/PM'), true)
    assert.equal(client.includes('라운드 설정'), false)
    assert.equal(client.includes('템플릿 라이브러리'), false)
    assert.equal(client.includes('max-w-[1500px]'), false)
    assert.equal(client.includes('mx-auto w-full max-w'), false)
    assert.equal(client.includes('max-w-none'), true)
    assert.equal(client.includes("props.data.state === 'ready' && props.data.mode === 'overview'"), true)
    assert.equal(client.includes("props.data.state === 'ready' && props.data.mode === 'respond'"), true)
    assert.equal(client.includes("props.data.state === 'ready' && props.data.mode === 'results'"), true)
    assert.equal(shell.includes('useWideEvaluationCanvas'), true)
    assert.equal(shell.includes("pathname?.startsWith('/evaluation/360')"), true)
    assert.equal(shell.includes("pathname?.startsWith('/evaluation/upward')"), true)
    assert.equal(shell.includes("pathname?.startsWith('/evaluation/upward')"), true)
    assert.equal(shell.includes('usePageNativeHeader'), true)
  })

  await run('leadership assignment helpers follow member, pm, team leader, and division flow', () => {
    const employees = [
      {
        id: 'member-1',
        empName: '팀원',
        role: 'ROLE_MEMBER' as const,
        position: 'MEMBER',
        deptId: 'dept-1',
        deptName: '인사팀',
        jobTitle: '구성원',
        teamName: '인사팀',
        teamLeaderId: 'team-leader-1',
        sectionChiefId: 'section-chief-1',
        divisionHeadId: 'division-head-1',
      },
      {
        id: 'pm-1',
        empName: 'PM',
        role: 'ROLE_MEMBER' as const,
        position: 'MEMBER',
        deptId: 'dept-1',
        deptName: '인사팀',
        jobTitle: 'PM',
        teamName: '인사팀',
        teamLeaderId: 'team-leader-1',
        sectionChiefId: 'section-chief-1',
        divisionHeadId: 'division-head-1',
      },
      {
        id: 'team-leader-1',
        empName: '팀장',
        role: 'ROLE_TEAM_LEADER' as const,
        position: 'TEAM_LEADER',
        deptId: 'dept-1',
        deptName: '인사팀',
        jobTitle: '팀장',
        teamName: '인사팀',
        teamLeaderId: null,
        sectionChiefId: 'section-chief-1',
        divisionHeadId: 'division-head-1',
      },
      {
        id: 'team-leader-no-section',
        empName: '실장 없는 팀장',
        role: 'ROLE_TEAM_LEADER' as const,
        position: 'TEAM_LEADER',
        deptId: 'dept-2',
        deptName: '전략팀',
        jobTitle: '팀장',
        teamName: '전략팀',
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: 'division-head-1',
      },
      {
        id: 'section-chief-1',
        empName: '실장',
        role: 'ROLE_SECTION_CHIEF' as const,
        position: 'SECTION_CHIEF',
        deptId: 'dept-1',
        deptName: '인사실',
        jobTitle: '실장',
        teamName: null,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: 'division-head-1',
      },
      {
        id: 'division-head-1',
        empName: '본부장',
        role: 'ROLE_DIV_HEAD' as const,
        position: 'DIV_HEAD',
        deptId: 'dept-3',
        deptName: '경영본부',
        jobTitle: '본부장',
        teamName: null,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
    ]

    assert.deepEqual(
      Array.from(getLeadershipEvaluateeIdsForEvaluator(employees[0], employees)).sort(),
      ['pm-1', 'team-leader-1']
    )
    assert.deepEqual(Array.from(getLeadershipEvaluateeIdsForEvaluator(employees[2], employees)), ['section-chief-1'])
    assert.deepEqual(Array.from(getLeadershipEvaluateeIdsForEvaluator(employees[3], employees)), ['division-head-1'])
    assert.deepEqual(Array.from(getLeadershipEvaluateeIdsForEvaluator(employees[4], employees)), ['division-head-1'])

    const suggestions = buildUpwardSuggestions({
      employees,
      targetTypes: ['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM'],
    })
    const pairs = suggestions.map((suggestion) => `${suggestion.evaluatorId}:${suggestion.evaluateeId}:${suggestion.relationship}`)

    assert.equal(pairs.includes('member-1:team-leader-1:SUBORDINATE'), true)
    assert.equal(pairs.includes('member-1:pm-1:PEER'), true)
    assert.equal(pairs.includes('team-leader-1:section-chief-1:SUBORDINATE'), true)
    assert.equal(pairs.includes('team-leader-no-section:division-head-1:SUBORDINATE'), true)
    assert.equal(pairs.includes('section-chief-1:division-head-1:SUBORDINATE'), true)
  })

  await run('upward results aggregation groups rating and text answers', () => {
    const summary = summarizeUpwardResults({
      submittedFeedbacks: [
        {
          giverId: 'giver-1',
          giverName: '평가자1',
          relationship: 'SUBORDINATE',
          overallComment: '전반적으로 명확했습니다.',
          responses: [
            {
              questionId: 'q-rating',
              ratingValue: 4,
              textValue: null,
              question: {
                questionText: '목표를 명확하게 제시하나요?',
                category: '방향성',
                questionType: 'RATING_SCALE',
                choiceOptions: null,
              },
            },
            {
              questionId: 'q-text',
              ratingValue: null,
              textValue: '상황 설명이 구체적이었습니다.',
              question: {
                questionText: '강점은 무엇인가요?',
                category: '소통',
                questionType: 'TEXT',
                choiceOptions: null,
              },
            },
          ],
        },
        {
          giverId: 'giver-2',
          giverName: '평가자2',
          relationship: 'SUBORDINATE',
          overallComment: '우선순위 정리가 좋았습니다.',
          responses: [
            {
              questionId: 'q-rating',
              ratingValue: 5,
              textValue: null,
              question: {
                questionText: '목표를 명확하게 제시하나요?',
                category: '방향성',
                questionType: 'RATING_SCALE',
                choiceOptions: null,
              },
            },
            {
              questionId: 'q-text',
              ratingValue: null,
              textValue: '후속 조치가 빠릅니다.',
              question: {
                questionText: '강점은 무엇인가요?',
                category: '소통',
                questionType: 'TEXT',
                choiceOptions: null,
              },
            },
          ],
        },
      ],
      questions: [
        {
          id: 'q-rating',
          category: '방향성',
          questionText: '목표를 명확하게 제시하나요?',
          questionType: 'RATING_SCALE',
          choiceOptions: null,
        },
        {
          id: 'q-text',
          category: '소통',
          questionText: '강점은 무엇인가요?',
          questionType: 'TEXT',
          choiceOptions: null,
        },
      ],
    })

    const ratingQuestion = summary.questionSummaries.find((item) => item.questionId === 'q-rating')
    const textQuestion = summary.questionSummaries.find((item) => item.questionId === 'q-text')

    assert.equal(ratingQuestion?.averageScore, 4.5)
    assert.equal(ratingQuestion?.responseCount, 2)
    assert.deepEqual(textQuestion?.textResponses, ['상황 설명이 구체적이었습니다.', '후속 조치가 빠릅니다.'])
  })

  await run('upward results visibility follows reviewee, manager, and admin policy', () => {
    const settings = parseUpwardReviewSettings({
      resultReleasedAt: '2026-04-13T09:00:00.000Z',
      resultViewerMode: 'TARGET_AND_PRIMARY_MANAGER',
      rawResponsePolicy: 'ADMIN_ONLY',
    })

    assert.equal(
      canViewUpwardResults({
        actorId: 'reviewee-1',
        actorRole: 'ROLE_MEMBER',
        targetId: 'reviewee-1',
        targetPrimaryLeaderId: 'leader-1',
        settings,
        thresholdMet: true,
        canManage: false,
        canReadRaw: false,
      }),
      true
    )

    assert.equal(
      canViewUpwardResults({
        actorId: 'reviewee-1',
        actorRole: 'ROLE_MEMBER',
        targetId: 'reviewee-1',
        targetPrimaryLeaderId: 'leader-1',
        settings,
        thresholdMet: false,
        canManage: false,
        canReadRaw: false,
      }),
      false
    )

    assert.equal(
      canViewUpwardResults({
        actorId: 'leader-1',
        actorRole: 'ROLE_TEAM_LEADER',
        targetId: 'reviewee-1',
        targetPrimaryLeaderId: 'leader-1',
        settings,
        thresholdMet: true,
        canManage: false,
        canReadRaw: false,
      }),
      true
    )

    assert.equal(
      canViewUpwardResults({
        actorId: 'admin-1',
        actorRole: 'ROLE_ADMIN',
        targetId: 'reviewee-1',
        targetPrimaryLeaderId: 'leader-1',
        settings,
        thresholdMet: false,
        canManage: true,
        canReadRaw: false,
      }),
      true
    )
  })

  console.log('Upward review tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
