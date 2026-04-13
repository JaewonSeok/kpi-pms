import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import { flattenNavigationItems, filterNavigationItemsByRole, NAV_ITEMS } from '../src/lib/navigation'
import {
  canViewUpwardResults,
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

  await run('response page source includes list, draft, submit, and read-only flow', () => {
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
    const loader = read('src/server/upward-review.ts')

    assert.equal(client.includes('내 응답 대상'), true)
    assert.equal(client.includes('초안 저장'), true)
    assert.equal(client.includes('최종 제출'), true)
    assert.equal(client.includes('이 상향 평가는 이미 최종 제출되어 읽기 전용 상태입니다.'), true)
    assert.equal(client.includes('현재 배정된 상향 평가가 없습니다.'), true)
    assert.equal(loader.includes('이 평가는 리더의 운영 방식과 리더십을 더 잘 이해하고 개선하기 위한 참고 자료로 활용됩니다.'), true)
    assert.equal(loader.includes('구체적인 관찰과 경험을 바탕으로 작성해 주세요.'), true)
    assert.equal(loader.includes('감정적 표현보다 사실과 행동 중심으로 작성해 주세요.'), true)
    assert.equal(loader.includes('익명 기준을 충족한 경우에만 결과가 공개됩니다.'), true)
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
    assert.equal(route.includes('최종 제출된 상향 평가는 수정할 수 없습니다.'), true)
    assert.equal(route.includes('필수 문항에 응답해 주세요.'), true)
    assert.equal(feedbackRoute.includes('상향 평가는 상향 평가 응답 화면에서 제출해 주세요.'), true)
    assert.equal(loader.includes('if (feedback.giverId !== employee.id)'), true)
  })

  await run('results page source includes visibility guidance and audit logging', () => {
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
    const loader = read('src/server/upward-review.ts')

    assert.equal(client.includes('상향 평가는 리더의 운영 방식과 개선 방향을 이해하기 위한 참고 자료입니다.'), true)
    assert.equal(client.includes('집계 결과만 제공되며, 개별 평가자 정보는 공개되지 않습니다.'), true)
    assert.equal(client.includes('결과 비공개'), true)
    assert.equal(client.includes('관리자용 원문 응답'), true)
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
      assert.equal(messages.includes('척도형 응답은 1점 이상이어야 합니다.'), true)
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

    assert.equal(validationMessage, '자기 자신을 상향 평가 대상으로 지정할 수 없습니다.')
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
