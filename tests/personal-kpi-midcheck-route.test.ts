import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AIApprovalStatus, AIRequestStatus, AIRequestType } from '@prisma/client'
import { AppError } from '../src/lib/utils'
import {
  generatePersonalKpiMidcheckCoach,
  loadPersonalKpiMidcheckCoachContext,
  requestPersonalKpiMidcheckCoachFromOpenAI,
} from '../src/server/ai/personal-kpi-midcheck-coach'

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

function makeLeaderSession(overrides?: Partial<Record<string, unknown>>) {
  return {
    user: {
      id: 'leader-1',
      role: 'ROLE_TEAM_LEADER',
      name: 'Leader One',
      ...overrides,
    },
  } as never
}

function makeMemberSession(overrides?: Partial<Record<string, unknown>>) {
  return {
    user: {
      id: 'member-1',
      role: 'ROLE_MEMBER',
      name: 'Member One',
      ...overrides,
    },
  } as never
}

function makePersonalKpiRecord(overrides?: Record<string, unknown>) {
  return {
    id: 'pk-1',
    employeeId: 'member-1',
    kpiName: '고객 응답률 향상',
    status: 'CONFIRMED',
    definition: '응답 고객 비율을 높이는 KPI',
    formula: '응답 고객 수 / 전체 고객 수',
    targetValue: 95,
    linkedOrgKpiId: 'org-1',
    linkedOrgKpi: {
      kpiName: '고객 경험 개선',
    },
    employee: {
      id: 'member-1',
      deptId: 'dept-1',
      teamLeaderId: 'leader-1',
      sectionChiefId: 'section-1',
      divisionHeadId: 'division-1',
      department: {
        deptName: '사업운영팀',
      },
    },
    monthlyRecords: [
      {
        id: 'mr-1',
        yearMonth: '2026-04',
        achievementRate: 82,
        activities: '4월 고객 follow-up',
        obstacles: '일정 지연',
        evidenceComment: '4월 핵심 근거 정리',
      },
    ],
    ...overrides,
  }
}

function makeDb(overrides?: {
  personalKpiFindUnique?: () => Promise<unknown>
}) {
  const logs: Array<Record<string, unknown>> = []
  return {
    logs,
    personalKpi: {
      findUnique: overrides?.personalKpiFindUnique ?? (async () => makePersonalKpiRecord()),
    },
    aiRequestLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data)
        return { id: `ai-log-${logs.length}` }
      },
    },
  } as {
    logs: Array<Record<string, unknown>>
    personalKpi: {
      findUnique: () => Promise<unknown>
    }
    aiRequestLog: {
      create: (params: { data: Record<string, unknown> }) => Promise<{ id: string }>
    }
  }
}

async function main() {
  await run('midcheck coach route source keeps server session enforcement and dedicated generation helper usage', () => {
    const source = read('src/app/api/kpi/personal/[id]/midcheck-coach/route.ts')

    assert.equal(source.includes("export const runtime = 'nodejs'"), true)
    assert.equal(source.includes('getServerSession(authOptions)'), true)
    assert.equal(source.includes('resolvePersonalKpiAiAccess'), true)
    assert.equal(source.includes('generatePersonalKpiMidcheckCoach'), true)
  })

  await run('midcheck coach service source now enforces leadership coaching scope', () => {
    const source = read('src/server/ai/personal-kpi-midcheck-coach.ts')

    assert.equal(source.includes('canCoachPersonalKpiTarget'), true)
    assert.equal(source.includes('팀원 코칭 범위를 벗어난 개인 KPI입니다.'), true)
    assert.equal(source.includes('getPersonalKpiScopeDepartmentIds'), false)
  })

  await run('context loader blocks ordinary member self access', async () => {
    await assert.rejects(
      () =>
        loadPersonalKpiMidcheckCoachContext({
          session: makeMemberSession(),
          personalKpiId: 'pk-1',
        }, makeDb() as never),
      (error: unknown) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('context loader blocks leader outside coaching scope', async () => {
    const db = makeDb({
      personalKpiFindUnique: async () =>
        makePersonalKpiRecord({
          employeeId: 'member-2',
          employee: {
            id: 'member-2',
            deptId: 'dept-9',
            teamLeaderId: 'other-leader',
            sectionChiefId: 'other-section',
            divisionHeadId: 'other-division',
            department: {
              deptName: '재무팀',
            },
          },
        }),
    })

    await assert.rejects(
      () =>
        loadPersonalKpiMidcheckCoachContext(
          {
            session: makeLeaderSession(),
            personalKpiId: 'pk-2',
          },
          db as never
        ),
      (error: unknown) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('authorized leader coach request returns structured AI result on success', async () => {
    const db = makeDb()
    const response = await generatePersonalKpiMidcheckCoach(
      {
        session: makeLeaderSession(),
        personalKpiId: 'pk-1',
        input: {
          yearMonth: '2026-04',
          evidenceComment: '4월 증빙 정리',
          attachments: [
            {
              id: 'link-1',
              type: 'LINK',
              name: 'Google Docs 링크',
              kind: 'OTHER',
              comment: '상세 설명',
              uploadedAt: '2026-04-20T09:00:00.000Z',
              uploadedBy: 'Leader One',
              url: 'https://docs.google.com/document/d/123/edit',
            },
          ],
        },
      },
      {
        db: db as never,
        env: {
          AI_ASSIST_ENABLED: 'true',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_MIDCHECK_COACH: 'gpt-5.4-mini',
        },
        fetcher: async () =>
          ({
            ok: true,
            json: async () => ({
              output_text: JSON.stringify({
                status: 'watch',
                headline: '보완이 필요한 상태입니다.',
                summary: '최근 증빙을 기준으로 우선순위 재정리가 필요합니다.',
                strengths: ['상위 목표 연결은 명확합니다.'],
                gaps: ['최근 증빙 설명이 부족합니다.'],
                risk_signals: ['일정 지연 변경 근거가 포함됩니다.'],
                next_actions: [
                  {
                    title: '주간 기준 정리',
                    reason: '남은 기간 동안 확인할 기준을 맞춰야 합니다.',
                    priority: 'high',
                    due_hint: '이번 주',
                  },
                ],
                coaching_questions: ['현재 목표가 사전에 중요했나요?'],
                employee_update_draft: '현재 상황과 다음 액션을 정리했습니다.',
                manager_share_draft: '관리자 공유용 중간 점검 문안입니다.',
                evidence_feedback: {
                  sufficiency: 'partial',
                  cited_evidence: ['4월 활동 메모'],
                  missing_items: ['최근 제출물 링크'],
                },
                disclaimer: '증빙 보강이 필요할 수 있습니다.',
              }),
              usage: {
                input_tokens: 100,
                output_tokens: 50,
              },
              model: 'gpt-5.4-mini',
            }),
          }) as Response,
      }
    )

    assert.equal(response.source, 'ai')
    assert.equal(response.result.status, 'watch')
    assert.equal(db.logs.length, 1)
    assert.equal(db.logs[0]?.requestType, AIRequestType.MID_REVIEW_ASSIST)
    assert.equal(db.logs[0]?.requestStatus, AIRequestStatus.SUCCESS)
    assert.equal(db.logs[0]?.approvalStatus, AIApprovalStatus.APPROVED)
  })

  await run('invalid midcheck payload is rejected before provider call', async () => {
    const db = makeDb()

    await assert.rejects(
      () =>
        generatePersonalKpiMidcheckCoach(
          {
            session: makeLeaderSession(),
            personalKpiId: 'pk-1',
            input: {
              yearMonth: '2026/04',
              attachments: [],
            },
          },
          {
            db: db as never,
          }
        ),
      (error: unknown) => error instanceof AppError && error.statusCode === 400
    )
  })

  await run('OpenAI provider failure degrades into fallback without crashing the page flow', async () => {
    const db = makeDb()
    const response = await generatePersonalKpiMidcheckCoach(
      {
        session: makeLeaderSession(),
        personalKpiId: 'pk-1',
        input: {
          yearMonth: '2026-04',
          evidenceComment: '4월 증빙 정리',
          attachments: [],
        },
      },
      {
        db: db as never,
        env: {
          AI_ASSIST_ENABLED: 'true',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_MIDCHECK_COACH: 'gpt-5.4-mini',
        },
        fetcher: async () => {
          throw new Error('provider down')
        },
      }
    )

    assert.equal(response.source, 'fallback')
    assert.equal(typeof response.result.summary, 'string')
    assert.equal(db.logs[0]?.requestStatus, AIRequestStatus.FALLBACK)
  })

  await run('invalid structured AI schema also falls back safely', async () => {
    const db = makeDb()
    const response = await generatePersonalKpiMidcheckCoach(
      {
        session: makeLeaderSession(),
        personalKpiId: 'pk-1',
        input: {
          yearMonth: '2026-04',
          evidenceComment: '4월 증빙 정리',
          attachments: [],
        },
      },
      {
        db: db as never,
        env: {
          AI_ASSIST_ENABLED: 'true',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_MIDCHECK_COACH: 'gpt-5.4-mini',
        },
        fetcher: async () =>
          ({
            ok: true,
            json: async () => ({
              output_text: JSON.stringify({
                headline: '형식 오류',
              }),
              model: 'gpt-5.4-mini',
            }),
          }) as Response,
      }
    )

    assert.equal(response.source, 'fallback')
    assert.equal(db.logs[0]?.requestStatus, AIRequestStatus.FALLBACK)
  })

  await run('Responses API helper uses strict json_schema and store false', async () => {
    const response = await requestPersonalKpiMidcheckCoachFromOpenAI(
      {
        ...(await loadPersonalKpiMidcheckCoachContext(
          {
            session: makeLeaderSession(),
            personalKpiId: 'pk-1',
          },
          makeDb() as never
        )),
        yearMonth: '2026-04',
        evidenceComment: '4월 증빙 정리',
        attachments: [],
      },
      {
        env: {
          AI_ASSIST_ENABLED: 'true',
          OPENAI_API_KEY: 'test-key',
          OPENAI_MODEL_MIDCHECK_COACH: 'gpt-5.4-mini',
        },
        fetcher: async (_url, init) => {
          const body = JSON.parse(String(init?.body))
          assert.equal(body.store, false)
          assert.equal(body.text?.format?.type, 'json_schema')
          assert.equal(body.text?.format?.strict, true)
          assert.equal(body.model, 'gpt-5.4-mini')

          return {
            ok: true,
            json: async () => ({
              output_text: JSON.stringify({
                status: 'on_track',
                headline: '현재 흐름은 안정적입니다.',
                summary: '입력된 정보 범위에서는 큰 이슈가 없습니다.',
                strengths: ['상위 목표 연결은 명확합니다.'],
                gaps: [],
                risk_signals: [],
                next_actions: [],
                coaching_questions: ['다음 기간엔 무엇을 더 확인해야 하나요?'],
                employee_update_draft: '업데이트 초안입니다.',
                manager_share_draft: '관리자 공유 초안입니다.',
                evidence_feedback: {
                  sufficiency: 'sufficient',
                  cited_evidence: ['4월 활동 메모'],
                  missing_items: [],
                },
                disclaimer: '입력된 증빙 기준으로 정리했습니다.',
              }),
              usage: {
                input_tokens: 20,
                output_tokens: 20,
              },
              model: 'gpt-5.4-mini',
            }),
          } as Response
        },
      }
    )

    assert.equal(response.result.status, 'on_track')
  })

  console.log('Personal KPI midcheck route tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
