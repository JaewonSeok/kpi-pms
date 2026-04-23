/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}
const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const { getMonthlyKpiPageData } = require('../src/server/monthly-kpi-page') as typeof import('../src/server/monthly-kpi-page')

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

type PrismaDelegateMethod = (...args: any[]) => any

type MonthlySnapshot = {
  employeeFindUnique: PrismaDelegateMethod
  employeeFindMany: PrismaDelegateMethod
  personalKpiFindMany: PrismaDelegateMethod
  auditLogFindMany: PrismaDelegateMethod
  aiRequestLogFindMany: PrismaDelegateMethod
  checkInFindMany: PrismaDelegateMethod
}

function captureSnapshot(): MonthlySnapshot {
  const prismaAny = prisma as any
  return {
    employeeFindUnique: prismaAny.employee.findUnique,
    employeeFindMany: prismaAny.employee.findMany,
    personalKpiFindMany: prismaAny.personalKpi.findMany,
    auditLogFindMany: prismaAny.auditLog.findMany,
    aiRequestLogFindMany: prismaAny.aiRequestLog.findMany,
    checkInFindMany: prismaAny.checkIn.findMany,
  }
}

function restoreSnapshot(snapshot: MonthlySnapshot) {
  const prismaAny = prisma as any
  prismaAny.employee.findUnique = snapshot.employeeFindUnique
  prismaAny.employee.findMany = snapshot.employeeFindMany
  prismaAny.personalKpi.findMany = snapshot.personalKpiFindMany
  prismaAny.auditLog.findMany = snapshot.auditLogFindMany
  prismaAny.aiRequestLog.findMany = snapshot.aiRequestLogFindMany
  prismaAny.checkIn.findMany = snapshot.checkInFindMany
}

function makeSession(overrides?: Partial<any>) {
  return {
    user: {
      id: 'emp-self',
      email: 'member1@rsupport.com',
      name: '구성원',
      role: 'ROLE_MEMBER',
      empId: 'EMP-001',
      position: 'STAFF',
      deptId: 'dept-1',
      deptName: '경영지원',
      accessibleDepartmentIds: ['dept-1'],
      ...overrides,
    },
  } as any
}

function makeEmployee(id: string, name: string, role: string, deptId = 'dept-1', deptName = '경영지원') {
  return {
    id,
    empId: id.toUpperCase(),
    empName: name,
    role,
    status: 'ACTIVE',
    position: role === 'ROLE_ADMIN' ? 'TEAM_LEADER' : 'STAFF',
    deptId,
    department: {
      id: deptId,
      deptName,
      orgId: 'org-1',
      organization: { id: 'org-1', name: 'RSUPPORT' },
    },
  }
}

function makePersonalKpi(params: {
  id: string
  employeeId: string
  name: string
  monthlyRecords?: Array<{
    id: string
    yearMonth: string
    actualValue?: number
    achievementRate?: number
    isDraft?: boolean
    submittedAt?: Date | null
    activities?: string | null
    obstacles?: string | null
    efforts?: string | null
    attachments?: unknown
  }>
}) {
  return {
    id: params.id,
    employeeId: params.employeeId,
    kpiName: params.name,
    kpiType: 'QUANTITATIVE',
    targetValue: 100,
    unit: '%',
    weight: 40,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    employee: makeEmployee(params.employeeId, params.employeeId === 'emp-2' ? '구성원2' : '구성원1', 'ROLE_MEMBER'),
    linkedOrgKpiId: 'org-kpi-1',
    linkedOrgKpi: {
      id: 'org-kpi-1',
      kpiName: '연결 조직 KPI',
      department: { deptName: '경영지원' },
    },
    monthlyRecords: (params.monthlyRecords ?? []).map((record) => ({
      id: record.id,
      yearMonth: record.yearMonth,
      actualValue: record.actualValue ?? null,
      achievementRate: record.achievementRate ?? null,
      activities: record.activities ?? null,
      obstacles: record.obstacles ?? null,
      efforts: record.efforts ?? null,
      attachments: record.attachments ?? [],
      isDraft: record.isDraft ?? true,
      submittedAt: record.submittedAt ?? null,
    })),
  }
}

async function withStubbedMonthlyData(
  overrides: Partial<Record<keyof MonthlySnapshot, PrismaDelegateMethod>>,
  fn: () => Promise<void>
) {
  const snapshot = captureSnapshot()
  const prismaAny = prisma as any

  prismaAny.employee.findUnique =
    overrides.employeeFindUnique ??
    (async ({ where }: { where: { id: string } }) => {
      if (where.id === 'admin-1') return null
      return makeEmployee(where.id, where.id === 'emp-2' ? '구성원2' : '구성원1', 'ROLE_MEMBER')
    })

  prismaAny.employee.findMany =
    overrides.employeeFindMany ??
    (async () => [
      makeEmployee('emp-self', '구성원1', 'ROLE_MEMBER'),
      makeEmployee('emp-2', '구성원2', 'ROLE_MEMBER', 'dept-2', '영업지원'),
    ])

  prismaAny.personalKpi.findMany =
    overrides.personalKpiFindMany ??
    (async (args?: any) => {
      if (args?.select?.evalYear) {
        return [{ evalYear: 2026 }]
      }

      if (args?.where?.employeeId === 'emp-2') {
        return [
          makePersonalKpi({
            id: 'pk-2',
            employeeId: 'emp-2',
            name: '고객 이슈 대응률',
            monthlyRecords: [
              {
                id: 'mr-2-03',
                yearMonth: '2026-03',
                actualValue: 44,
                achievementRate: 44,
                isDraft: false,
                submittedAt: new Date('2026-03-20T00:00:00.000Z'),
                activities: '3월 진행 메모',
              },
              {
                id: 'mr-2-04',
                yearMonth: '2026-04',
                actualValue: 62,
                achievementRate: 62,
                isDraft: true,
                submittedAt: null,
                activities: '4월 진행 메모',
              },
            ],
          }),
        ]
      }

      return [
        makePersonalKpi({
          id: 'pk-self',
          employeeId: 'emp-self',
          name: '회원 전환율',
          monthlyRecords: [
            {
              id: 'mr-self-03',
              yearMonth: '2026-03',
              actualValue: 51,
              achievementRate: 51,
              isDraft: true,
              submittedAt: null,
              activities: '3월 활동 요약',
            },
          ],
        }),
      ]
    })

  prismaAny.auditLog.findMany = overrides.auditLogFindMany ?? (async () => [])
  prismaAny.aiRequestLog.findMany = overrides.aiRequestLogFindMany ?? (async () => [])
  prismaAny.checkIn.findMany = overrides.checkInFindMany ?? (async () => [])

  try {
    await fn()
  } finally {
    restoreSnapshot(snapshot)
  }
}

async function main() {
  await run('admin with valid scope gets employee options and can target another employee monthly records', async () => {
    await withStubbedMonthlyData({}, async () => {
      const data = await getMonthlyKpiPageData({
        session: makeSession({
          id: 'admin-1',
          role: 'ROLE_ADMIN',
          name: '관리자',
          deptId: 'dept-1',
          deptName: '경영지원',
          accessibleDepartmentIds: ['dept-1', 'dept-2'],
        }),
        scope: 'employee',
        employeeId: 'emp-2',
        year: 2026,
        month: '2026-04',
      })

      assert.equal(data.state, 'ready')
      assert.equal(data.employeeOptions.length, 2)
      assert.equal(data.selectedEmployeeId, 'emp-2')
      assert.equal(data.records[0]?.employeeName, '구성원2')
      assert.equal(data.records[0]?.actualValue, 62)
      assert.equal(data.summary.totalKpiCount, 1)
    })
  })

  await run('invalid employeeId returns no-target instead of crashing the monthly page', async () => {
    await withStubbedMonthlyData({}, async () => {
      const data = await getMonthlyKpiPageData({
        session: makeSession({
          id: 'admin-1',
          role: 'ROLE_ADMIN',
          name: '관리자',
          accessibleDepartmentIds: ['dept-1', 'dept-2'],
        }),
        scope: 'employee',
        employeeId: 'missing-emp',
        year: 2026,
        month: '2026-03',
      })

      assert.equal(data.state, 'no-target')
      assert.equal(data.employeeOptions.length, 2)
    })
  })

  await run('no accessible employees returns setup-required instead of error', async () => {
    await withStubbedMonthlyData(
      {
        employeeFindMany: async () => [],
        employeeFindUnique: async () => null,
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession({
            id: 'admin-1',
            role: 'ROLE_ADMIN',
            name: '관리자',
            accessibleDepartmentIds: ['dept-1'],
          }),
          scope: 'employee',
          year: 2026,
          month: '2026-03',
        })

        assert.equal(data.state, 'setup-required')
        assert.equal(data.employeeOptions.length, 0)
      }
    )
  })

  await run('no monthly KPI rows returns empty state, not error', async () => {
    await withStubbedMonthlyData(
      {
        personalKpiFindMany: async (args?: any) => (args?.select?.evalYear ? [{ evalYear: 2026 }] : []),
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession(),
          year: 2026,
          month: '2026-03',
        })

        assert.equal(data.state, 'empty')
        assert.equal(data.records.length, 0)
      }
    )
  })

  await run('period selection returns the correct month data instead of stale records', async () => {
    await withStubbedMonthlyData({}, async () => {
      const march = await getMonthlyKpiPageData({
        session: makeSession({
          id: 'admin-1',
          role: 'ROLE_ADMIN',
          name: '관리자',
          accessibleDepartmentIds: ['dept-1', 'dept-2'],
        }),
        scope: 'employee',
        employeeId: 'emp-2',
        year: 2026,
        month: '2026-03',
      })
      const april = await getMonthlyKpiPageData({
        session: makeSession({
          id: 'admin-1',
          role: 'ROLE_ADMIN',
          name: '관리자',
          accessibleDepartmentIds: ['dept-1', 'dept-2'],
        }),
        scope: 'employee',
        employeeId: 'emp-2',
        year: 2026,
        month: '2026-04',
      })

      assert.equal(march.records[0]?.actualValue, 44)
      assert.equal(april.records[0]?.actualValue, 62)
      assert.notEqual(march.records[0]?.id, april.records[0]?.id)
    })
  })

  await run('mixed file and link evidence are restored from saved monthly attachments', async () => {
    await withStubbedMonthlyData(
      {
        personalKpiFindMany: async (args?: any) => {
          if (args?.select?.evalYear) {
            return [{ evalYear: 2026 }]
          }

          return [
            makePersonalKpi({
              id: 'pk-self',
              employeeId: 'emp-self',
              name: '회원 전환율',
              monthlyRecords: [
                {
                  id: 'mr-self-04',
                  yearMonth: '2026-04',
                  actualValue: 72,
                  achievementRate: 72,
                  isDraft: true,
                  attachments: [
                    {
                      id: 'legacy-file-1',
                      name: '실적 정리.pdf',
                      kind: 'REPORT',
                      uploadedAt: '2026-04-05T09:00:00.000Z',
                      uploadedBy: '구성원',
                      sizeLabel: '1.2MB',
                      dataUrl: 'data:application/pdf;base64,AAAA',
                      comment: '월간 실적 보고서',
                    },
                    {
                      id: 'drive-link-1',
                      type: 'LINK',
                      name: 'Google Docs 링크',
                      kind: 'OTHER',
                      uploadedAt: '2026-04-06T09:00:00.000Z',
                      uploadedBy: '구성원',
                      url: 'https://docs.google.com/document/d/123456789/edit',
                      comment: '실적 상세 설명 문서',
                    },
                  ],
                },
              ],
            }),
          ]
        },
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession(),
          year: 2026,
          month: '2026-04',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.records[0]?.attachments.length, 2)
        assert.equal(data.records[0]?.attachments[0]?.type, 'FILE')
        assert.equal(data.records[0]?.attachments[0]?.comment, '월간 실적 보고서')
        assert.equal(data.records[0]?.attachments[1]?.type, 'LINK')
        assert.equal(data.records[0]?.attachments[1]?.url, 'https://docs.google.com/document/d/123456789/edit')
        assert.equal(data.records[0]?.attachments[1]?.comment, '실적 상세 설명 문서')
        assert.equal(data.evidence.length, 2)
        assert.equal(data.evidence[1]?.type, 'LINK')
        assert.equal(data.evidence[1]?.comment, '실적 상세 설명 문서')
      }
    )
  })

  await run('secondary AI log helper failure does not kill the monthly page', async () => {
    await withStubbedMonthlyData(
      {
        aiRequestLogFindMany: async () => {
          throw new Error('ai logs unavailable')
        },
      },
      async () => {
        const data = await getMonthlyKpiPageData({
          session: makeSession(),
          year: 2026,
          month: '2026-03',
        })

        assert.equal(data.state, 'ready')
        assert.equal(data.records.length, 1)
        assert.equal(data.alerts?.some((item) => item.title.includes('AI')), true)
      }
    )
  })

  await run('monthly KPI client resets selection, filters, review note, and AI preview when employee or period changes', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('const previousContextRef = useRef<string | null>(null)'), true)
    assert.equal(source.includes("setTab('entry')"), true)
    assert.equal(source.includes("setFilters({ ...DEFAULT_FILTERS })"), true)
    assert.equal(source.includes("setReviewComment('')"), true)
    assert.equal(source.includes('setAiPreview(null)'), true)
    assert.equal(source.includes("handleRouteSelection({ year: Number(event.target.value), tab: 'entry', recordId: '' })"), true)
    assert.equal(source.includes("handleRouteSelection({ month: event.target.value, tab: 'entry', recordId: '' })"), true)
    assert.equal(source.includes("employeeId: event.target.value,"), true)
    assert.equal(source.includes("recordId: ''"), true)
  })

  await run('monthly KPI client keeps the created record selected after save refresh', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('setSelectedId(recordId)'), true)
    assert.equal(source.includes('handleRouteSelection({ recordId, tab })'), true)
  })

  await run('monthly KPI client gates review and AI actions with live state instead of dead-ending in the API', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('function getReviewActionState('), true)
    assert.equal(source.includes('const aiActionStates = Object.fromEntries('), true)
    assert.equal(source.includes('disabled={busy !== null || reviewActionState.disabled}'), true)
    assert.equal(source.includes('disabled={busy !== null || requestUpdateActionState.disabled}'), true)
    assert.equal(source.includes('disabled={busy !== null || generateSummaryActionState.disabled}'), true)
    assert.equal(source.includes('disabled={busy !== null || actionStates[action]?.disabled}'), true)
    assert.equal(source.includes('title={generateSummaryActionState.reason}'), true)
  })

  await run('monthly KPI client exposes mixed evidence controls and labels in the existing attachment section', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('구글 드라이브 링크'), true)
    assert.equal(source.includes('간단 코멘트'), true)
    assert.equal(source.includes('링크 추가'), true)
    assert.equal(source.includes("attachment.type === 'LINK'"), true)
    assert.equal(source.includes("evidenceComment: record.evidenceComment ?? ''"), true)
    assert.equal(source.includes("evidenceComment: selectedDraft.evidenceComment.trim() || undefined"), true)
    assert.equal(source.includes('증빙 코멘트'), true)
    assert.equal(source.includes('파일 첨부'), true)
    assert.equal(source.includes('openEvidenceLink'), true)
    assert.equal(source.includes('downloadEvidenceAttachment'), true)
    assert.equal(source.includes('증빙 변경 사항은 임시저장 또는 제출 시 반영됩니다.'), true)
  })

  console.log('Monthly KPI workspace tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
