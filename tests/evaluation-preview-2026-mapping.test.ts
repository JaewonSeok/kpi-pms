import './register-path-aliases'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { AppError } from '../src/lib/utils'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'

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

async function run(name: string, fn: () => Promise<void> | void) {
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

function makeSession(role = 'ROLE_ADMIN', id = 'admin-1') {
  return {
    user: {
      id,
      name: role === 'ROLE_ADMIN' ? 'HR Admin' : 'Member User',
      role,
    },
  } as any
}

function makeItem(overrides: Partial<any> = {}) {
  const personalKpi = {
    id: overrides.personalKpiId ?? `kpi-${overrides.id ?? 'org'}`,
    kpiName: '본부 KPI 연계 목표',
    definition: null,
    formula: null,
    tags: null,
    policyCategory: 'ORG_GOAL',
    kpiType: 'QUANTITATIVE',
    weight: 100,
    linkedOrgKpiId: 'org-1',
    linkedOrgKpi: {
      id: 'org-1',
      kpiName: '본부 성장',
      department: {
        deptName: '영업본부',
      },
    },
    ...(overrides.personalKpi ?? {}),
  }

  return {
    id: overrides.id ?? 'eval-item-org',
    evaluationId: 'eval-1',
    personalKpiId: personalKpi.id,
    policyCategory: 'ORG_GOAL',
    scoreContributionType: null,
    policyFormulaVersion: null,
    basePolicyScore: null,
    adjustmentScore: null,
    adjustmentGroupKey: null,
    targetAchievementLevel: 'TARGET',
    quantScore: 90,
    qualScore: null,
    planScore: null,
    doScore: null,
    checkScore: null,
    actScore: null,
    weightedScore: 90,
    personalKpi,
    ...overrides,
  }
}

function makeEvaluation(overrides: Partial<any> = {}) {
  const evalCycle = {
    id: overrides.evalCycleId ?? 'cycle-2026',
    cycleName: '2026 상반기',
    evalYear: 2026,
    performanceDesignConfig: null as any,
    ...(overrides.evalCycle ?? {}),
  }
  const target = {
    id: overrides.targetId ?? 'emp-target',
    empName: 'Target Employee',
    position: 'MEMBER',
    role: 'ROLE_MEMBER',
    deptId: 'dept-team',
    jobTitle: '백오피스',
    teamName: '인사팀',
    department: {
      id: 'dept-team',
      deptName: '인사팀',
      parentDeptId: 'dept-division',
    },
    ...(overrides.target ?? {}),
  }

  return {
    id: overrides.id ?? 'eval-1',
    evalCycleId: evalCycle.id,
    targetId: target.id,
    evaluatorId: 'leader-1',
    evalStage: 'FIRST',
    totalScore: 88,
    gradeId: 'grade-official',
    evalCycle,
    target,
    items: overrides.items ?? [
      makeItem({
        id: 'missing-policy-category',
        policyCategory: null,
        personalKpi: {
          id: 'kpi-missing',
          kpiName: '정책 카테고리 미분류 KPI',
          policyCategory: null,
          linkedOrgKpiId: 'org-1',
        },
      }),
      makeItem({
        id: 'daily-work',
        policyCategory: 'DAILY_WORK',
        targetAchievementLevel: null,
        quantScore: null,
        qualScore: 80,
        personalKpi: {
          id: 'kpi-daily',
          kpiName: '일상업무 운영',
          policyCategory: 'DAILY_WORK',
          kpiType: 'QUALITATIVE',
          weight: 40,
          linkedOrgKpiId: null,
          linkedOrgKpi: null,
        },
      }),
    ],
  }
}

function makeDb(
  evaluations: any[],
  options: {
    departments?: any[]
    employees?: any[]
    personalKpis?: any[]
    auditLogs?: any[]
  } = {}
) {
  const cycles = new Map<string, any>()
  const evaluationsById = new Map<string, any>()
  const itemsById = new Map<string, any>()
  const personalKpisById = new Map<string, any>()
  const departmentsById = new Map<string, any>([
    ['dept-division', { id: 'dept-division', deptName: '경영지원본부', parentDeptId: null }],
    ['dept-team', { id: 'dept-team', deptName: '인사팀', parentDeptId: 'dept-division' }],
    ['dept-sales-division', { id: 'dept-sales-division', deptName: '영업본부', parentDeptId: null }],
    ['dept-sales-team', { id: 'dept-sales-team', deptName: '영업팀', parentDeptId: 'dept-sales-division' }],
  ])
  for (const department of options.departments ?? []) {
    departmentsById.set(department.id, department)
  }
  const employeesById = new Map<string, any>()
  const writes = {
    evaluation: 0,
    evaluationItem: 0,
    personalKpi: 0,
    evalCycle: 0,
    audit: 0,
  }

  for (const evaluation of evaluations) {
    evaluationsById.set(evaluation.id, evaluation)
    cycles.set(evaluation.evalCycleId, evaluation.evalCycle)
    if (evaluation.target?.department?.id) {
      departmentsById.set(evaluation.target.department.id, evaluation.target.department)
    }
    employeesById.set(evaluation.target.id, {
      id: evaluation.target.id,
      empName: evaluation.target.empName,
      deptId: evaluation.target.deptId,
      status: 'ACTIVE',
      ...evaluation.target,
    })
    for (const item of evaluation.items) {
      item.evaluationId = evaluation.id
      item.personalKpiId = item.personalKpi.id
      item.personalKpi.employeeId = item.personalKpi.employeeId ?? evaluation.targetId
      item.personalKpi.evalYear = item.personalKpi.evalYear ?? evaluation.evalCycle.evalYear
      itemsById.set(item.id, item)
      personalKpisById.set(item.personalKpi.id, item.personalKpi)
    }
  }
  for (const employee of options.employees ?? []) {
    employeesById.set(employee.id, employee)
  }
  for (const personalKpi of options.personalKpis ?? []) {
    personalKpisById.set(personalKpi.id, personalKpi)
  }

  const db = {
    evaluation: {
      findMany: async (args: any) => {
        const rows = evaluations.filter((evaluation) => {
          if (args?.where?.evalCycleId) return evaluation.evalCycleId === args.where.evalCycleId
          if (args?.where?.evalCycle?.evalYear) return evaluation.evalCycle.evalYear === args.where.evalCycle.evalYear
          return true
        })
        if (args?.select?.id && !args.include) return rows.map((evaluation) => ({ id: evaluation.id }))
        return rows
      },
      findUnique: async (args: any) => evaluationsById.get(args?.where?.id) ?? null,
      count: async (args: any) =>
        evaluations.filter((evaluation) => {
          if (args?.where?.evalCycleId && evaluation.evalCycleId !== args.where.evalCycleId) return false
          if (args?.where?.targetId && evaluation.targetId !== args.where.targetId) return false
          return true
        }).length,
      update: async () => {
        writes.evaluation += 1
        throw new Error('official evaluation result must not be written')
      },
    },
    evaluationItem: {
      findUnique: async (args: any) => {
        const item = itemsById.get(args?.where?.id)
        if (!item) return null
        const evaluation = evaluationsById.get(item.evaluationId)
        return {
          ...item,
          evaluation: {
            id: evaluation.id,
            evalCycleId: evaluation.evalCycleId,
            totalScore: evaluation.totalScore,
            gradeId: evaluation.gradeId,
          },
        }
      },
      update: async (args: any) => {
        writes.evaluationItem += 1
        const item = itemsById.get(args.where.id)
        Object.assign(item, args.data)
        return item
      },
    },
    personalKpi: {
      findMany: async (args: any) =>
        Array.from(personalKpisById.values())
          .filter((personalKpi) => {
            if (args?.where?.evalYear && personalKpi.evalYear !== args.where.evalYear) return false
            const employeeIds = args?.where?.employeeId?.in
            if (Array.isArray(employeeIds) && !employeeIds.includes(personalKpi.employeeId)) return false
            return true
          })
          .map((personalKpi) => ({
            ...personalKpi,
            employee: employeesById.get(personalKpi.employeeId),
            evaluationItems: Array.from(itemsById.values())
              .filter((item) => item.personalKpiId === personalKpi.id)
              .map((item) => {
                const evaluation = evaluationsById.get(item.evaluationId)
                return {
                  id: item.id,
                  evaluationId: item.evaluationId,
                  policyCategory: item.policyCategory,
                  scoreContributionType: item.scoreContributionType ?? null,
                  policyFormulaVersion: item.policyFormulaVersion ?? null,
                  evaluation: evaluation
                    ? {
                        id: evaluation.id,
                        evalCycleId: evaluation.evalCycleId,
                        evalStage: evaluation.evalStage,
                        targetId: evaluation.targetId,
                      }
                    : null,
                }
              }),
          })),
      findUnique: async (args: any) => {
        const personalKpi = personalKpisById.get(args?.where?.id)
        return personalKpi
          ? {
              id: personalKpi.id,
              policyCategory: personalKpi.policyCategory ?? null,
              policyCategoryConfidence: personalKpi.policyCategoryConfidence ?? null,
              policyCategorySource: personalKpi.policyCategorySource ?? null,
              policyCategoryReviewNote: personalKpi.policyCategoryReviewNote ?? null,
            }
          : null
      },
      update: async (args: any) => {
        writes.personalKpi += 1
        const personalKpi = personalKpisById.get(args.where.id)
        Object.assign(personalKpi, args.data)
        return personalKpi
      },
    },
    evalCycle: {
      findUnique: async (args: any) => cycles.get(args?.where?.id) ?? null,
      findMany: async (args: any) =>
        Array.from(cycles.values()).filter((cycle) => {
          if (args?.where?.evalYear && cycle.evalYear !== args.where.evalYear) return false
          return true
        }),
      update: async (args: any) => {
        writes.evalCycle += 1
        const cycle = cycles.get(args.where.id)
        Object.assign(cycle, args.data)
        return cycle
      },
    },
    department: {
      findMany: async () => Array.from(departmentsById.values()),
      findUnique: async (args: any) => departmentsById.get(args?.where?.id) ?? null,
    },
    employee: {
      findMany: async (args: any) =>
        Array.from(employeesById.values()).filter((employee) => {
          if (args?.where?.status && employee.status !== args.where.status) return false
          return true
        }),
    },
    aiCompetencyGateAssignment: {
      findFirst: async () => null,
    },
    auditLog: {
      findMany: async () => options.auditLogs ?? [],
    },
  } as any

  return {
    db,
    writes,
    audit: async () => {
      writes.audit += 1
    },
    getEvaluation: (id: string) => evaluationsById.get(id),
    getPersonalKpi: (id: string) => personalKpisById.get(id),
  }
}

async function main() {
  const {
    resolvePolicy2026PreviewSalesGroup,
  } = await import('../src/lib/evaluation-policy-2026-preview-metadata')
  const {
    getEvaluationPolicy2026MappingCandidatesForSession,
    updateEvaluationPolicy2026MetadataForSession,
  } = await import('../src/server/evaluation-preview-2026-mapping')
  const {
    getEvaluationPreviewReadinessSummary2026,
  } = await import('../src/server/evaluation-preview-2026-readiness')

  await run('division-level SALES mapping resolves employee sales group', () => {
    const salesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {
            'dept-sales-division': { salesGroup: 'SALES' },
          },
          salesGroupsByDepartmentId: {},
          salesGroupsByEmployeeId: {},
        },
      },
      employeeId: 'emp-target',
      divisionId: 'dept-sales-division',
      employee: { department: { deptName: '인사팀' }, teamName: '인사팀', jobTitle: '백오피스' },
    })

    assert.equal(salesGroup, 'SALES')
  })

  await run('division-level NON_SALES mapping resolves employee sales group', () => {
    const salesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {
            'dept-division': { salesGroup: 'NON_SALES' },
          },
          salesGroupsByDepartmentId: {},
          salesGroupsByEmployeeId: {},
        },
      },
      employeeId: 'emp-target',
      divisionId: 'dept-division',
      employee: { department: { deptName: '영업팀' }, teamName: '영업팀', jobTitle: '영업 담당' },
    })

    assert.equal(salesGroup, 'NON_SALES')
  })

  await run('department NON_SALES override inside SALES division resolves employee to NON_SALES', () => {
    const salesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {
            'dept-sales-division': { salesGroup: 'SALES' },
          },
          salesGroupsByDepartmentId: {
            'dept-sales-marketing-team': { salesGroup: 'NON_SALES' },
          },
          salesGroupsByEmployeeId: {},
        },
      },
      employeeId: 'emp-target',
      departmentId: 'dept-sales-marketing-team',
      departmentAncestorIds: ['dept-sales-marketing-team'],
      divisionId: 'dept-sales-division',
      employee: { department: { deptName: '세일즈마케팅팀' }, teamName: '세일즈마케팅팀', jobTitle: '마케팅 담당' },
    })

    assert.equal(salesGroup, 'NON_SALES')
  })

  await run('employee override wins over division sales group mapping', () => {
    const salesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {
            'dept-sales-division': { salesGroup: 'SALES' },
          },
          salesGroupsByDepartmentId: {
            'dept-sales-marketing-team': { salesGroup: 'NON_SALES' },
          },
          salesGroupsByEmployeeId: {
            'emp-target': { salesGroup: 'SALES' },
          },
        },
      },
      employeeId: 'emp-target',
      departmentId: 'dept-sales-marketing-team',
      departmentAncestorIds: ['dept-sales-marketing-team'],
      divisionId: 'dept-sales-division',
      employee: { department: { deptName: '영업팀' }, teamName: '영업팀', jobTitle: '영업 담당' },
    })

    assert.equal(salesGroup, 'SALES')
  })

  await run('department override wins over division sales group mapping', () => {
    const salesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {
            'dept-sales-division': { salesGroup: 'SALES' },
          },
          salesGroupsByDepartmentId: {
            'dept-sales-marketing-team': { salesGroup: 'NON_SALES' },
          },
          salesGroupsByEmployeeId: {},
        },
      },
      employeeId: 'emp-target',
      departmentId: 'dept-sales-marketing-team',
      departmentAncestorIds: ['dept-sales-marketing-team'],
      divisionId: 'dept-sales-division',
      employee: { department: { deptName: '세일즈마케팅팀' }, teamName: '세일즈마케팅팀', jobTitle: '마케팅 담당' },
    })

    assert.equal(salesGroup, 'NON_SALES')
  })

  await run('department override wins over division mapping in readiness preview', async () => {
    const evaluation = makeEvaluation({
      evalCycle: {
        performanceDesignConfig: {
          policy2026PreviewMappings: {
            salesGroupsByDivisionId: {
              'dept-sales-division': { salesGroup: 'SALES' },
            },
            salesGroupsByDepartmentId: {
              'dept-sales-marketing-team': { salesGroup: 'NON_SALES' },
            },
            salesGroupsByEmployeeId: {},
          },
        },
      },
      target: {
        id: 'emp-sales-marketing',
        empName: 'Sales Marketing',
        deptId: 'dept-sales-marketing-team',
        jobTitle: '마케팅 담당',
        teamName: '세일즈마케팅팀',
        department: {
          id: 'dept-sales-marketing-team',
          deptName: '세일즈마케팅팀',
          parentDeptId: 'dept-sales-division',
        },
      },
    })
    const fake = makeDb(
      [evaluation],
      {
        departments: [
          { id: 'dept-sales-marketing-team', deptName: '세일즈마케팅팀', parentDeptId: 'dept-sales-division' },
        ],
      }
    )

    const summary = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })

    assert.equal(summary.missingSalesClassificationCount, 0)
    assert.equal(summary.ambiguousThresholdCount, 0)
  })

  await run('missing division mapping remains unresolved despite text suggestion', () => {
    const salesGroup = resolvePolicy2026PreviewSalesGroup({
      evalCycleConfig: {
        policy2026PreviewMappings: {
          salesGroupsByDivisionId: {},
          salesGroupsByDepartmentId: {},
          salesGroupsByEmployeeId: {},
        },
      },
      employeeId: 'emp-target',
      divisionId: 'dept-sales-division',
      employee: { department: { deptName: '영업팀' }, teamName: '영업팀', jobTitle: '영업 담당' },
    })

    assert.equal(salesGroup, null)
  })

  await run('admin can list 2026 policy mapping candidates', async () => {
    const fake = makeDb([makeEvaluation()])
    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )

    assert.equal(payload.policyCategoryCandidates.length, 1)
    assert.equal(payload.policyCategoryCandidates[0].evaluationItemId, 'missing-policy-category')
    assert.equal(payload.divisionSalesGroupCandidates.length, 2)
    assert.equal(payload.divisionSalesGroupCandidates.some((candidate) => candidate.divisionId === 'dept-division'), true)
    assert.equal(payload.divisionSalesGroupCandidates.some((candidate) => candidate.divisionId === 'dept-sales-division'), true)
    assert.equal(payload.departmentSalesGroupCandidates.some((candidate) => candidate.departmentId === 'dept-team'), true)
    assert.equal(payload.salesGroupCandidates.length, 0)
    assert.equal(payload.policyCategoryWorkbenchItems.length >= 1, true)
    assert.equal(payload.policyCategoryWorkbenchItems[0]?.personalKpiId, 'kpi-missing')
    assert.equal(payload.policyCategoryWorkbenchItems[0]?.itemSource, 'EvaluationItem')
    assert.equal(payload.persistence.divisionSalesGroup.includes('salesGroupsByDivisionId'), true)
    assert.equal(payload.persistence.departmentSalesGroup.includes('salesGroupsByDepartmentId'), true)
  })

  await run('policyCategory workbench includes current evaluation candidates even when PersonalKpi scan is empty', async () => {
    const evaluation = makeEvaluation({
      target: {
        status: 'INACTIVE',
      },
    })
    const fake = makeDb([evaluation], {
      employees: [
        {
          id: 'emp-target',
          empName: 'Target Employee',
          empId: 'E-001',
          deptId: 'dept-team',
          managerId: 'leader-1',
          status: 'INACTIVE',
        },
      ],
    })

    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )

    assert.equal(payload.policyCategoryCandidates.length, 1)
    const row = payload.policyCategoryWorkbenchItems.find((item) => item.evaluationItemId === 'missing-policy-category')
    assert.equal(row?.itemSource, 'EvaluationItem')
    assert.equal(row?.personalKpiId, 'kpi-missing')
    assert.equal(row?.employeeName, 'Target Employee')
  })

  await run('policyCategory workbench suggests ORG_GOAL for linked division KPI', async () => {
    const evaluation = makeEvaluation({
      items: [
        makeItem({
          id: 'division-linked-item',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-division-linked',
            kpiName: '본부 성장 연계 목표',
            policyCategory: null,
            linkedOrgKpiId: 'org-division',
            linkedOrgKpi: {
              id: 'org-division',
              kpiName: '본부 성장',
              department: { id: 'dept-division', deptName: '경영지원본부', parentDeptId: null },
            },
          },
        }),
      ],
    })
    const fake = makeDb([evaluation])
    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      { session: makeSession('ROLE_ADMIN'), cycleId: 'cycle-2026' },
      { db: fake.db }
    )
    const row = payload.policyCategoryWorkbenchItems.find((item) => item.personalKpiId === 'kpi-division-linked')
    assert.equal(row?.suggestedPolicyCategory, 'ORG_GOAL')
    assert.equal(row?.sourceConfidence, 'HIGH')
    assert.equal(row?.hasHrApprovedSource, true)
  })

  await run('policyCategory workbench reflects team KPI HR decisions', async () => {
    const evaluation = makeEvaluation({
      items: [
        makeItem({
          id: 'team-approved',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-team-approved',
            kpiName: '팀 승인 KPI 연계',
            policyCategory: null,
            linkedOrgKpiId: 'team-approved-org',
            linkedOrgKpi: {
              id: 'team-approved-org',
              kpiName: '승인 팀 KPI',
              department: { id: 'dept-team', deptName: '인사팀', parentDeptId: 'dept-division' },
              teamKpiReviewItems: [{ verdict: 'ADEQUATE' }],
            },
          },
        }),
        makeItem({
          id: 'team-excluded',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-team-excluded',
            kpiName: '제외 팀 KPI 연계',
            policyCategory: null,
            linkedOrgKpiId: 'team-excluded-org',
            linkedOrgKpi: {
              id: 'team-excluded-org',
              kpiName: '제외 팀 KPI',
              department: { id: 'dept-team', deptName: '인사팀', parentDeptId: 'dept-division' },
              teamKpiReviewItems: [{ verdict: 'INSUFFICIENT' }],
            },
          },
        }),
        makeItem({
          id: 'team-discussion',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-team-discussion',
            kpiName: '논의 팀 KPI 연계',
            policyCategory: null,
            linkedOrgKpiId: 'team-discussion-org',
            linkedOrgKpi: {
              id: 'team-discussion-org',
              kpiName: '논의 팀 KPI',
              department: { id: 'dept-team', deptName: '인사팀', parentDeptId: 'dept-division' },
              teamKpiReviewItems: [{ verdict: 'CAUTION' }],
            },
          },
        }),
        makeItem({
          id: 'no-signal',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-no-signal',
            kpiName: '새로운 목표',
            policyCategory: null,
            linkedOrgKpiId: null,
            linkedOrgKpi: null,
          },
        }),
      ],
    })
    const fake = makeDb([evaluation])
    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      { session: makeSession('ROLE_ADMIN'), cycleId: 'cycle-2026' },
      { db: fake.db }
    )
    const byKpi = new Map(payload.policyCategoryWorkbenchItems.map((item) => [item.personalKpiId, item]))
    assert.equal(byKpi.get('kpi-team-approved')?.suggestedPolicyCategory, 'ORG_GOAL')
    assert.equal(byKpi.get('kpi-team-approved')?.hasHrApprovedSource, true)
    assert.equal(byKpi.get('kpi-team-excluded')?.suggestedPolicyCategory, 'DAILY_WORK')
    assert.equal(byKpi.get('kpi-team-discussion')?.suggestedPolicyCategory, 'MANUAL_REVIEW')
    assert.equal(byKpi.get('kpi-no-signal')?.suggestedPolicyCategory, 'MANUAL_REVIEW')
  })

  await run('all active divisions appear in mapping candidates even when current cycle targets one division', async () => {
    const evaluation = makeEvaluation()
    const fake = makeDb(
      [evaluation],
      {
        departments: [
          { id: 'dept-rnd-division', deptName: '연구개발본부', parentDeptId: null },
          { id: 'dept-rnd-team', deptName: 'AI팀', parentDeptId: 'dept-rnd-division' },
        ],
        employees: [
          { id: 'emp-rnd-1', empName: 'R&D Member', deptId: 'dept-rnd-team', status: 'ACTIVE' },
        ],
      }
    )

    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )

    const rndCandidate = payload.divisionSalesGroupCandidates.find(
      (candidate) => candidate.divisionId === 'dept-rnd-division'
    )
    const supportCandidate = payload.divisionSalesGroupCandidates.find(
      (candidate) => candidate.divisionId === 'dept-division'
    )

    assert.ok(rndCandidate)
    assert.equal(rndCandidate.activeEmployeeCount, 1)
    assert.equal(rndCandidate.currentCycleTargetCount, 0)
    assert.ok(supportCandidate)
    assert.equal(supportCandidate.currentCycleTargetCount, 1)
    assert.equal(payload.divisionMappingSummary.hasPartialCurrentCycleTargets, true)
    assert.equal(Boolean(payload.divisionMappingSummary.warning), true)
  })

  await run('full path labels are used for duplicate department names', async () => {
    const fake = makeDb(
      [makeEvaluation()],
      {
        departments: [
          { id: 'dept-global-division', deptName: '글로벌기술지원본부', parentDeptId: null },
          { id: 'dept-sales-marketing-team', deptName: '세일즈마케팅팀', parentDeptId: 'dept-sales-division' },
          { id: 'dept-global-sales-marketing-team', deptName: '세일즈마케팅팀', parentDeptId: 'dept-global-division' },
        ],
        employees: [
          { id: 'emp-sales-marketing-1', empName: 'Sales Marketing', deptId: 'dept-sales-marketing-team', status: 'ACTIVE' },
          { id: 'emp-global-marketing-1', empName: 'Global Marketing', deptId: 'dept-global-sales-marketing-team', status: 'ACTIVE' },
        ],
      }
    )

    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )

    const paths = payload.departmentSalesGroupCandidates.map((candidate) => candidate.departmentPath)
    assert.equal(paths.includes('영업본부 > 세일즈마케팅팀'), true)
    assert.equal(paths.includes('글로벌기술지원본부 > 세일즈마케팅팀'), true)
  })

  await run('division with zero current eval targets can still be mapped as metadata', async () => {
    const fake = makeDb(
      [makeEvaluation()],
      {
        departments: [
          { id: 'dept-rnd-division', deptName: '연구개발본부', parentDeptId: null },
          { id: 'dept-rnd-team', deptName: 'AI팀', parentDeptId: 'dept-rnd-division' },
        ],
        employees: [
          { id: 'emp-rnd-1', empName: 'R&D Member', deptId: 'dept-rnd-team', status: 'ACTIVE' },
        ],
      }
    )

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [],
          policyCategoryMappings: [],
          divisionSalesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              divisionId: 'dept-rnd-division',
              salesGroup: 'NON_SALES',
            },
          ],
          departmentSalesGroupMappings: [],
          salesGroupMappings: [],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )
    const rndCandidate = payload.divisionSalesGroupCandidates.find(
      (candidate) => candidate.divisionId === 'dept-rnd-division'
    )

    assert.ok(rndCandidate)
    assert.equal(rndCandidate.currentSalesGroup, 'NON_SALES')
    assert.equal(rndCandidate.currentCycleTargetCount, 0)
    assert.equal(fake.writes.evalCycle, 1)
    assert.equal(fake.writes.evaluation, 0)
  })

  await run('department override can be saved for team with zero current eval targets', async () => {
    const fake = makeDb(
      [makeEvaluation()],
      {
        departments: [
          { id: 'dept-sales-marketing-team', deptName: '세일즈마케팅팀', parentDeptId: 'dept-sales-division' },
        ],
        employees: [
          { id: 'emp-sales-marketing-1', empName: 'Sales Marketing', deptId: 'dept-sales-marketing-team', status: 'ACTIVE' },
        ],
      }
    )

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [],
          policyCategoryMappings: [],
          divisionSalesGroupMappings: [],
          departmentSalesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              departmentId: 'dept-sales-marketing-team',
              salesGroup: 'NON_SALES',
            },
          ],
          salesGroupMappings: [],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )
    const candidate = payload.departmentSalesGroupCandidates.find(
      (entry) => entry.departmentId === 'dept-sales-marketing-team'
    )

    assert.ok(candidate)
    assert.equal(candidate.departmentPath, '영업본부 > 세일즈마케팅팀')
    assert.equal(candidate.currentSalesGroup, 'NON_SALES')
    assert.equal(candidate.currentCycleTargetCount, 0)
    assert.equal(fake.writes.evalCycle, 1)
    assert.equal(fake.writes.evaluation, 0)
  })

  await run('suggestion-only division value does not count as saved mapping', async () => {
    const fake = makeDb([makeEvaluation()])
    const payload = await getEvaluationPolicy2026MappingCandidatesForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        cycleId: 'cycle-2026',
      },
      { db: fake.db }
    )
    const salesDivision = payload.divisionSalesGroupCandidates.find(
      (candidate) => candidate.divisionId === 'dept-sales-division'
    )

    assert.ok(salesDivision)
    assert.equal(salesDivision.suggestedSalesGroup, 'SALES')
    assert.equal(salesDivision.currentSalesGroup, null)
    assert.equal(payload.divisionMappingSummary.unmappedDivisions, payload.divisionSalesGroupCandidates.length)
  })

  await run('ordinary member cannot list mapping candidates', async () => {
    const fake = makeDb([makeEvaluation()])
    await assert.rejects(
      () =>
        getEvaluationPolicy2026MappingCandidatesForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            cycleId: 'cycle-2026',
          },
          { db: fake.db }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
  })

  await run('admin can update policy metadata without changing official totalScore or grade', async () => {
    const evaluation = makeEvaluation()
    const fake = makeDb([evaluation])
    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [
            {
              evaluationItemId: 'missing-policy-category',
              personalKpiId: 'kpi-missing',
              category: 'ORG_GOAL',
              note: 'HR confirmed as organization goal',
            },
          ],
          policyCategoryMappings: [],
          divisionSalesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              divisionId: 'dept-division',
              salesGroup: 'NON_SALES',
              note: 'HR confirmed non-sales division',
            },
          ],
          departmentSalesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              departmentId: 'dept-team',
              salesGroup: 'NON_SALES',
              note: 'HR confirmed non-sales team override',
            },
          ],
          salesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              employeeId: 'emp-target',
              salesGroup: 'NON_SALES',
              note: 'HR confirmed non-sales',
            },
          ],
          thresholdDecisions: [],
        },
      },
      {
        db: fake.db,
        audit: fake.audit,
      }
    )

    const updated = fake.getEvaluation('eval-1')
    assert.equal(updated.totalScore, 88)
    assert.equal(updated.gradeId, 'grade-official')
    assert.equal(updated.items[0].policyCategory, 'ORG_GOAL')
    assert.equal(updated.items[0].scoreContributionType, 'ORGANIZATION')
    assert.equal(updated.items[0].personalKpi.policyCategory, 'ORG_GOAL')
    assert.equal(fake.writes.evaluation, 0)
    assert.equal(fake.writes.evaluationItem, 1)
    assert.equal(fake.writes.personalKpi, 1)
    assert.equal(fake.writes.evalCycle, 3)
    assert.equal(fake.writes.audit, 4)
  })

  await run('ordinary member cannot update metadata', async () => {
    const fake = makeDb([makeEvaluation()])
    await assert.rejects(
      () =>
        updateEvaluationPolicy2026MetadataForSession(
          {
            session: makeSession('ROLE_MEMBER', 'member-1'),
            input: {
              itemMappings: [
                {
                  evaluationItemId: 'missing-policy-category',
                  category: 'ORG_GOAL',
                },
              ],
              policyCategoryMappings: [],
              divisionSalesGroupMappings: [],
              departmentSalesGroupMappings: [],
              salesGroupMappings: [],
              thresholdDecisions: [],
            },
          },
          { db: fake.db, audit: fake.audit }
        ),
      (error) => error instanceof AppError && error.statusCode === 403
    )
    assert.equal(fake.writes.evaluationItem, 0)
    assert.equal(fake.writes.personalKpi, 0)
  })

  await run('admin can bulk-save policyCategory metadata for PersonalKpi and EvaluationItem without creating evaluations', async () => {
    const evaluation = makeEvaluation({
      items: [
        makeItem({
          id: 'bulk-eval-item',
          policyCategory: null,
          personalKpi: {
            id: 'kpi-bulk-eval',
            kpiName: '프로젝트 T 전환',
            policyCategory: null,
            linkedOrgKpiId: null,
            linkedOrgKpi: null,
          },
        }),
      ],
    })
    const personalOnly = {
      id: 'kpi-personal-only',
      employeeId: 'emp-target',
      evalYear: 2026,
      kpiName: '운영 업무',
      definition: '정기 운영 업무',
      formula: null,
      tags: null,
      policyCategory: null,
      kpiType: 'QUALITATIVE',
      weight: 20,
      linkedOrgKpiId: null,
      linkedOrgKpi: null,
    }
    const fake = makeDb([evaluation], { personalKpis: [personalOnly] })
    assert.equal(fake.getPersonalKpi('kpi-bulk-eval').policyCategory, null)

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [],
          policyCategoryMappings: [
            {
              personalKpiId: 'kpi-bulk-eval',
              evaluationItemId: 'bulk-eval-item',
              category: 'PROJECT_T',
              scoreContributionType: 'PERSONAL',
              note: 'bulk HR mapping',
            },
            {
              personalKpiId: 'kpi-personal-only',
              category: 'DAILY_WORK',
              note: 'personal KPI only mapping',
            },
          ],
          divisionSalesGroupMappings: [],
          departmentSalesGroupMappings: [],
          salesGroupMappings: [],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const updated = fake.getEvaluation('eval-1')
    assert.equal(updated.totalScore, 88)
    assert.equal(updated.gradeId, 'grade-official')
    assert.equal(updated.items[0].policyCategory, 'PROJECT_T')
    assert.equal(updated.items[0].scoreContributionType, 'PERSONAL')
    assert.equal(fake.getPersonalKpi('kpi-bulk-eval').policyCategory, 'PROJECT_T')
    assert.equal(personalOnly.policyCategory, 'DAILY_WORK')
    assert.equal(fake.writes.evaluation, 0)
    assert.equal(fake.writes.evaluationItem, 1)
    assert.equal(fake.writes.personalKpi, 2)
    assert.equal(fake.writes.audit, 2)
  })

  await run('invalid bulk policyCategory fails validation', async () => {
    const { EvaluationPolicy2026MetadataPatchSchema } = await import('../src/server/evaluation-preview-2026-mapping')
    const parsed = EvaluationPolicy2026MetadataPatchSchema.safeParse({
      itemMappings: [],
      policyCategoryMappings: [
        {
          personalKpiId: 'kpi-1',
          category: 'INVALID_CATEGORY',
        },
      ],
      divisionSalesGroupMappings: [],
      departmentSalesGroupMappings: [],
      salesGroupMappings: [],
      thresholdDecisions: [],
    })
    assert.equal(parsed.success, false)
  })

  await run('UNKNOWN remains unresolved unless HR explicitly maps it', async () => {
    const fake = makeDb([makeEvaluation()])
    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [
            {
              evaluationItemId: 'missing-policy-category',
              personalKpiId: 'kpi-missing',
              category: 'KEEP_UNCLASSIFIED',
            },
          ],
          policyCategoryMappings: [],
          divisionSalesGroupMappings: [],
          departmentSalesGroupMappings: [],
          salesGroupMappings: [],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const updated = fake.getEvaluation('eval-1')
    assert.equal(updated.items[0].policyCategory, null)
    assert.equal(updated.items[0].personalKpi.policyCategory, null)
  })

  await run('sales/non-sales is not defaulted silently and readiness improves after explicit mapping', async () => {
    const evaluation = makeEvaluation()
    const fake = makeDb([evaluation])
    const before = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(before.missingPolicyCategoryCount, 1)
    assert.equal(before.missingSalesClassificationCount, 1)

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [
            {
              evaluationItemId: 'missing-policy-category',
              personalKpiId: 'kpi-missing',
              category: 'ORG_GOAL',
            },
          ],
          policyCategoryMappings: [],
          divisionSalesGroupMappings: [
            {
              evalCycleId: 'cycle-2026',
              divisionId: 'dept-division',
              salesGroup: 'NON_SALES',
            },
          ],
          departmentSalesGroupMappings: [],
          salesGroupMappings: [],
          thresholdDecisions: [],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const after = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(after.missingPolicyCategoryCount, 0)
    assert.equal(after.missingSalesClassificationCount, 0)
  })

  await run('threshold decision resolves sales member Super/Outstanding ambiguity for preview only', async () => {
    const evaluation = makeEvaluation({
      id: 'eval-sales',
      target: {
        id: 'emp-sales',
        empName: 'Sales Member',
        deptId: 'dept-sales-team',
        jobTitle: '영업 담당',
        teamName: '영업팀',
        department: { id: 'dept-sales-team', deptName: '영업팀', parentDeptId: 'dept-sales-division' },
      },
      evalCycle: {
        performanceDesignConfig: {
          policy2026PreviewMappings: {
            salesGroupsByDivisionId: {
              'dept-sales-division': { salesGroup: 'SALES' },
            },
            salesGroupsByEmployeeId: {},
          },
        },
      },
      items: [
        makeItem(),
        makeItem({
          id: 'project-t',
          policyCategory: 'PROJECT_T',
          targetAchievementLevel: 'EXCELLENT',
          personalKpi: {
            id: 'kpi-project',
            kpiName: '프로젝트 T',
            policyCategory: 'PROJECT_T',
            kpiType: 'QUANTITATIVE',
            weight: 60,
            linkedOrgKpiId: null,
            linkedOrgKpi: null,
          },
        }),
        makeItem({
          id: 'daily',
          policyCategory: 'DAILY_WORK',
          targetAchievementLevel: null,
          quantScore: null,
          qualScore: 80,
          personalKpi: {
            id: 'kpi-daily-sales',
            kpiName: '일상업무',
            policyCategory: 'DAILY_WORK',
            kpiType: 'QUALITATIVE',
            weight: 40,
            linkedOrgKpiId: null,
            linkedOrgKpi: null,
          },
        }),
      ],
    })
    const fake = makeDb([evaluation])
    const before = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(before.ambiguousThresholdCount, 1)

    await updateEvaluationPolicy2026MetadataForSession(
      {
        session: makeSession('ROLE_ADMIN'),
        input: {
          itemMappings: [],
          policyCategoryMappings: [],
          divisionSalesGroupMappings: [],
          departmentSalesGroupMappings: [],
          salesGroupMappings: [],
          thresholdDecisions: [
            {
              evalCycleId: 'cycle-2026',
              decision: 'SUPER_PRIORITY',
            },
          ],
        },
      },
      { db: fake.db, audit: fake.audit }
    )

    const after = await getEvaluationPreviewReadinessSummary2026({
      db: fake.db,
      cycleId: 'cycle-2026',
    })
    assert.equal(after.ambiguousThresholdCount, 0)
    assert.equal(fake.writes.evaluation, 0)
  })

  await run('mapping APIs and UI remain preview-only and admin-gated', () => {
    const candidatesRoute = read('src/app/api/evaluation/preview-2026/mapping-candidates/route.ts')
    const metadataRoute = read('src/app/api/evaluation/preview-2026/policy-metadata/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationWorkbenchClient.tsx')
    const liveRouteSource = read('src/app/api/evaluation/[id]/route.ts')
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(candidatesRoute.includes('export async function GET'), true)
    assert.equal(candidatesRoute.includes('getEvaluationPolicy2026MappingCandidatesForSession'), true)
    assert.equal(metadataRoute.includes('export async function PATCH'), true)
    assert.equal(metadataRoute.includes('EvaluationPolicy2026MetadataPatchSchema'), true)
    assert.equal(clientSource.includes('2026 정책 매핑 관리'), true)
    assert.equal(clientSource.includes('공식 평가 결과에는 반영되지 않습니다.'), true)
    assert.equal(clientSource.includes('type PolicyMappingTab2026'), true)
    assert.equal(clientSource.includes('카테고리 매핑'), true)
    assert.equal(clientSource.includes('본부 영업/비영업'), true)
    assert.equal(clientSource.includes('부서/팀 예외'), true)
    assert.equal(clientSource.includes('직원별 예외'), true)
    assert.equal(clientSource.includes('HR 확인 필요'), true)
    assert.equal(clientSource.includes('부서/팀 override'), true)
    assert.equal(clientSource.includes('본부 기본값과 다른 팀만 예외로 지정합니다.'), true)
    assert.equal(clientSource.includes("departmentOverrideFilter === 'ALL' ? 120 : 30"), true)
    assert.equal(clientSource.includes('세일즈마케팅팀'), true)
    assert.equal(clientSource.includes('후보 다시 조회'), true)
    assert.equal(clientSource.includes('선택 metadata 저장'), true)
    assert.equal(clientSource.includes('departmentSalesGroupMappings'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/mapping-candidates'), true)
    assert.equal(clientSource.includes('/api/evaluation/preview-2026/policy-metadata'), true)
    assert.equal(liveRouteSource.includes('policy-metadata'), false)
    assert.equal(submitRouteSource.includes('policy-metadata'), false)
  })

  console.log('2026 evaluation preview mapping tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
