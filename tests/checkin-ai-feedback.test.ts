import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { AppError } from '../src/lib/utils'
import {
  buildCheckinAiFeedbackFallbackResult,
  CheckinAiFeedbackResultSchema,
  normalizeCheckinAiFeedbackInput,
  type CheckinAiFeedbackContext,
} from '../src/lib/checkin-ai-feedback'

type ResolveFilename = (
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean,
  options?: unknown
) => string

const moduleLoader = Module as typeof Module & {
  _resolveFilename: ResolveFilename
}
const previousResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  const parentFilename = (parent as { filename?: string } | null | undefined)?.filename ?? ''
  const isPrismaRequest =
    request === '@/lib/prisma' ||
    ((request === './prisma' || request === '../prisma') &&
      parentFilename.includes(`${path.sep}src${path.sep}`))

  if (isPrismaRequest) {
    return path.resolve(process.cwd(), 'tests/stubs/prisma.js')
  }
  return previousResolveFilename.call(this, request, parent, isMain, options)
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function makeContext(overrides: Partial<CheckinAiFeedbackContext> = {}): CheckinAiFeedbackContext {
  return {
    employee: {
      departmentName: '인사팀',
      position: '구성원',
      roleLabel: '구성원',
    },
    kpis: [
      {
        title: '채용 프로세스 리드타임 개선',
        status: 'CONFIRMED',
        weight: 25,
        type: 'QUANTITATIVE',
        targetValue: 10,
        unit: '일',
        linkedOrgKpiTitle: '핵심 인재 확보',
        latestAchievementRate: 72,
        riskFlags: ['최근 달성률이 80% 미만입니다.'],
      },
    ],
    monthlyRecords: [
      {
        month: '2026-04',
        kpiTitle: '채용 프로세스 리드타임 개선',
        achievementRate: 72,
        activities: '면접 일정 조율 자동화 일부 적용',
        obstacles: '현업 면접 일정 확정 지연',
        efforts: '주간 리마인드 운영',
        evidenceComment: '4월 채용 운영표 기준',
        submitted: true,
      },
    ],
    checkins: [
      {
        date: '2026-04-20T09:00:00.000Z',
        type: 'WEEKLY',
        status: 'COMPLETED',
        agendaTopics: ['채용 병목 점검'],
        ownerNotes: '일정 확정이 지연되었습니다.',
        managerNotes: '현업 리더와 우선순위를 맞추기로 했습니다.',
        summary: '면접 일정 병목을 줄이기 위한 지원안을 합의했습니다.',
        energyLevel: 3,
        satisfactionLevel: 3,
        blockerCount: 1,
        actionItems: [
          {
            title: '현업 면접 가능 시간표 재정리',
            priority: 'HIGH',
            completed: false,
            dueDate: '2026-04-25',
          },
        ],
        kpiDiscussed: [
          {
            progress: '자동화 일부 적용',
            concern: '현업 일정 지연',
            support: '우선순위 조율 필요',
          },
        ],
      },
    ],
    feedbacks: [
      {
        date: '2026-04-18T09:00:00.000Z',
        relationship: 'PEER',
        comment: '협업 요청에 빠르게 대응합니다.',
      },
    ],
    openActions: [
      {
        title: '현업 면접 가능 시간표 재정리',
        priority: 'HIGH',
        dueDate: '2026-04-25',
        overdue: true,
        sourceDate: '2026-04-20T09:00:00.000Z',
      },
    ],
    generatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    employee: {
      findUnique: async () => ({
        id: 'emp-target',
        status: 'ACTIVE',
        position: 'MEMBER',
        role: 'ROLE_MEMBER',
        teamLeaderId: 'leader-1',
        sectionChiefId: 'section-1',
        divisionHeadId: 'division-1',
        department: {
          deptName: '인사팀',
        },
      }),
    },
    personalKpi: {
      findMany: async () => [
        {
          id: 'kpi-1',
          kpiName: '채용 프로세스 리드타임 개선',
          employeeId: 'emp-target',
          evalYear: 2026,
          status: 'CONFIRMED',
          weight: 25,
          kpiType: 'QUANTITATIVE',
          targetValue: 10,
          unit: '일',
          linkedOrgKpi: {
            kpiName: '핵심 인재 확보',
          },
        },
      ],
    },
    monthlyRecord: {
      findMany: async () => [
        {
          id: 'monthly-1',
          personalKpiId: 'kpi-1',
          employeeId: 'emp-target',
          yearMonth: '2026-04',
          achievementRate: 72,
          activities: '면접 일정 조율 자동화 일부 적용',
          obstacles: '현업 면접 일정 확정 지연',
          efforts: '주간 리마인드 운영',
          evidenceComment: '4월 채용 운영표 기준',
          isDraft: false,
          submittedAt: new Date('2026-04-30T09:00:00.000Z'),
          personalKpi: {
            kpiName: '채용 프로세스 리드타임 개선',
          },
        },
      ],
    },
    checkIn: {
      findMany: async () => [
        {
          id: 'checkin-1',
          ownerId: 'emp-target',
          checkInType: 'WEEKLY',
          scheduledDate: new Date('2026-04-20T09:00:00.000Z'),
          actualDate: new Date('2026-04-20T09:30:00.000Z'),
          status: 'COMPLETED',
          agendaItems: [{ topic: '채용 병목 점검' }],
          ownerNotes: '일정 확정이 지연되었습니다.',
          managerNotes: '현업 리더와 우선순위를 맞추기로 했습니다.',
          keyTakeaways: '면접 일정 병목을 줄이기 위한 지원안을 합의했습니다.',
          energyLevel: 3,
          satisfactionLevel: 3,
          blockerCount: 1,
          actionItems: [
            {
              action: '현업 면접 가능 시간표 재정리',
              priority: 'HIGH',
              completed: false,
              dueDate: '2026-04-25',
            },
          ],
          kpiDiscussed: [
            {
              progress: '자동화 일부 적용',
              concern: '현업 일정 지연',
              support: '우선순위 조율 필요',
            },
          ],
          createdAt: new Date('2026-04-19T09:00:00.000Z'),
        },
      ],
    },
    multiFeedback: {
      findMany: async () => [
        {
          relationship: 'PEER',
          overallComment: '협업 요청에 빠르게 대응합니다.',
          submittedAt: new Date('2026-04-18T09:00:00.000Z'),
          createdAt: new Date('2026-04-17T09:00:00.000Z'),
        },
      ],
    },
    aiRequestLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'ai-log-1',
        ...data,
      }),
    },
    ...overrides,
  }

  return db as never
}

const validAiResult = {
  status: 'watch',
  headline: '우선순위와 지원 범위를 점검해야 합니다.',
  summary: '최근 KPI와 체크인 기록을 기준으로 일부 실행 리스크가 확인됩니다.',
  strengths: ['상위 목표와 연결된 KPI가 확인됩니다.'],
  concerns: ['최근 달성률이 낮습니다.'],
  recommended_questions: ['현재 병목이 우선순위 문제인지 리소스 문제인지 확인해 주세요.'],
  next_actions: [
    {
      title: '병목 원인 정리',
      reason: '체크인에서 실행 지원 범위를 합의해야 합니다.',
      priority: 'high',
      owner_hint: '리더와 팀원이 함께',
      due_hint: '이번 체크인 중',
    },
  ],
  feedback_draft: '최근 진행과 병목을 함께 확인하고 다음 액션을 합의하겠습니다.',
  coaching_tone_tip: '단정하지 말고 지원이 필요한 지점을 먼저 물어보세요.',
  evidence_gaps: ['최근 산출물 링크가 부족합니다.'],
  disclaimer: '체크인 준비 초안이며 공식 평가가 아닙니다.',
}

async function main() {
  const {
    generateCheckinAiFeedback,
    requestCheckinAiFeedbackFromOpenAI,
  } = await import('../src/server/ai/checkin-feedback')

  await run('check-in AI schema validates strict structured output', () => {
    assert.equal(CheckinAiFeedbackResultSchema.safeParse(validAiResult).success, true)
    assert.equal(
      CheckinAiFeedbackResultSchema.safeParse({
        ...validAiResult,
        status: 'grade_a',
      }).success,
      false
    )
    assert.equal(
      CheckinAiFeedbackResultSchema.safeParse({
        ...validAiResult,
        extra: 'not allowed',
      }).success,
      false
    )
  })

  await run('normalization keeps bounded employee context without direct identity fields', () => {
    const normalized = normalizeCheckinAiFeedbackInput(makeContext())
    const serialized = JSON.stringify(normalized)

    assert.equal(serialized.includes('emp-target'), false)
    assert.equal(serialized.includes('홍길동'), false)
    assert.equal(serialized.includes('채용 프로세스 리드타임 개선'), true)
    assert.equal(normalized.evidence_counts.kpis, 1)
    assert.equal(normalized.recent_monthly_records[0]?.achievement_rate, 72)
  })

  await run('fallback marks missing data as insufficient_data instead of hallucinating', () => {
    const result = buildCheckinAiFeedbackFallbackResult(
      makeContext({
        kpis: [],
        monthlyRecords: [],
        checkins: [],
        feedbacks: [],
        openActions: [],
      })
    )

    assert.equal(result.status, 'insufficient_data')
    assert.equal(result.evidence_gaps.some((item) => item.includes('개인 KPI')), true)
    assert.equal(result.disclaimer.includes('데이터가 부족'), true)
  })

  await run('OpenAI response is parsed and Zod-validated before returning', async () => {
    let capturedBody = ''
    const response = await requestCheckinAiFeedbackFromOpenAI(makeContext(), {
      env: {
        AI_ASSIST_ENABLED: 'true',
        OPENAI_API_KEY: 'test-key',
        OPENAI_MODEL_MIDCHECK_COACH: 'gpt-test',
      },
      fetcher: async (_url, init) => {
        capturedBody = String(init?.body ?? '')
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify(validAiResult),
            usage: {
              input_tokens: 100,
              output_tokens: 80,
            },
            model: 'gpt-test',
          }),
          { status: 200 }
        )
      },
    })

    assert.equal(response.result.status, 'watch')
    assert.equal(capturedBody.includes('checkin_ai_feedback'), true)
    assert.equal(capturedBody.includes('emp-target'), false)
  })

  await run('invalid AI response shape fails safely', async () => {
    await assert.rejects(
      () =>
        requestCheckinAiFeedbackFromOpenAI(makeContext(), {
          env: {
            AI_ASSIST_ENABLED: 'true',
            OPENAI_API_KEY: 'test-key',
            OPENAI_MODEL_MIDCHECK_COACH: 'gpt-test',
          },
          fetcher: async () =>
            new Response(
              JSON.stringify({
                output_text: JSON.stringify({
                  status: 'watch',
                  headline: 'invalid missing fields',
                }),
              }),
              { status: 200 }
            ),
        }),
      (error) => error instanceof AppError && error.code === 'AI_INVALID_SHAPE'
    )
  })

  await run('authorized leader can generate in-scope disabled fallback without exposing API key', async () => {
    const result = await generateCheckinAiFeedback(
      {
        session: {
          user: {
            id: 'leader-1',
            role: 'ROLE_TEAM_LEADER',
          },
        },
        input: {
          employeeId: 'emp-target',
        },
      },
      {
        db: makeDb(),
        env: {
          AI_ASSIST_ENABLED: 'false',
        },
      }
    )

    assert.equal(result.source, 'disabled')
    assert.equal(result.requestLogId, 'ai-log-1')
    assert.equal(result.result.next_actions.length > 0, true)
  })

  await run('ordinary member cannot call API logic for another employee', async () => {
    await assert.rejects(
      () =>
        generateCheckinAiFeedback(
          {
            session: {
              user: {
                id: 'member-1',
                role: 'ROLE_MEMBER',
              },
            },
            input: {
              employeeId: 'emp-target',
            },
          },
          {
            db: makeDb(),
            env: {
              AI_ASSIST_ENABLED: 'false',
            },
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('forged out-of-scope employeeId is rejected server-side', async () => {
    await assert.rejects(
      () =>
        generateCheckinAiFeedback(
          {
            session: {
              user: {
                id: 'leader-2',
                role: 'ROLE_TEAM_LEADER',
              },
            },
            input: {
              employeeId: 'emp-target',
            },
          },
          {
            db: makeDb(),
            env: {
              AI_ASSIST_ENABLED: 'false',
            },
          }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('UI and route are wired to the check-in page without exposing the tab to ordinary members', () => {
    const clientSource = read('src/components/checkin/CheckinClient.tsx')
    const routeSource = read('src/app/api/checkin/ai-feedback/route.ts')
    const serverSource = read('src/server/ai/checkin-feedback.ts')

    assert.equal(clientSource.includes("aiFeedback: 'AI 피드백'"), true)
    assert.equal(clientSource.includes('팀원별 AI 피드백'), true)
    assert.equal(clientSource.includes('AI 피드백 생성'), true)
    assert.equal(clientSource.includes('다시 생성'), true)
    assert.equal(clientSource.includes('AI 피드백을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'), true)
    assert.equal(clientSource.includes('const canUseAiFeedback = Boolean(viewModel?.permissions.canManageTeam'), true)
    assert.equal(clientSource.includes("tabs.filter((tab) => tab !== 'aiFeedback')"), true)
    assert.equal(clientSource.includes("fetch('/api/checkin/ai-feedback'"), true)
    assert.equal(clientSource.includes('navigator.clipboard.writeText'), true)
    assert.equal(clientSource.includes('CheckinCalendarSection'), true)
    assert.equal(clientSource.includes('CheckinListSection'), true)
    assert.equal(clientSource.includes('CheckinActionsSection'), true)
    assert.equal(clientSource.includes('CheckinHistorySection'), true)
    assert.equal(clientSource.includes('CheckinPreparationSection'), true)
    assert.equal(routeSource.includes('generateCheckinAiFeedback'), true)
    assert.equal(serverSource.includes('canAccessManagedEmployeeContext(params.session.user.id'), true)
    assert.equal(serverSource.includes('CheckinAiFeedbackRequestSchema.safeParse'), true)
    assert.equal(serverSource.includes('CheckinAiFeedbackResultSchema.safeParse'), true)
    assert.equal(serverSource.includes("sourceType: 'checkin-ai-feedback'"), true)
  })

  console.log('Check-in AI feedback tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
