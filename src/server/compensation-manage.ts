import type {
  CompensationScenarioStatus,
  CycleStatus,
  Position,
  Prisma,
  SystemRole,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadAiCompetencySyncedResults } from '@/server/ai-competency'

export type CompensationManagePageState =
  | 'ready'
  | 'empty'
  | 'permission-denied'
  | 'error'

export type CompensationScenarioVisualStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'REVIEW_APPROVED'
  | 'REJECTED'
  | 'FINAL_APPROVED'
  | 'PUBLISHED'

export type CompensationManagePageData = {
  state: CompensationManagePageState
  availableCycles: Array<{
    id: string
    name: string
    year: number
    organizationName: string
    status: CycleStatus
  }>
  selectedYear?: number
  selectedCycleId?: string
  selectedScenarioId?: string
  viewModel?: CompensationManageViewModel
  message?: string
}

export type CompensationManageViewModel = {
  actorRole: 'ROLE_ADMIN' | 'ROLE_DIV_HEAD' | 'ROLE_CEO'
  cycle: {
    id: string
    name: string
    year: number
    rawStatus: CycleStatus
  }
  scenarioOptions: Array<{
    id: string
    name: string
    version: number
    status: CompensationScenarioVisualStatus
    needsRecalculation: boolean
    isLocked: boolean
    label: string
  }>
  scenario: {
    id: string
    name: string
    version: number
    status: CompensationScenarioVisualStatus
    rawStatus: CompensationScenarioStatus
    createdBy: string
    createdAt: string
    updatedAt: string
    budgetLimit: number
    totalCost: number
    budgetDelta: number
    needsRecalculation: boolean
    isLocked: boolean
    publishedAt?: string
    approvalStateLabel: string
    sourceScenarioLabel?: string
  } | null
  summary: {
    employeeCount: number
    impactedCount: number
    avgIncreaseRate: number
    totalSalaryIncrease: number
    totalBonus: number
    totalDelta: number
    overBudget: boolean
    overBudgetAmount: number
    remainingBudget: number
    approvalPendingLabel: string
    excludedCount: number
  }
  risks: {
    incompleteEvaluationCount: number
    missingRuleCount: number
    excludedCount: number
    staleCalculation: boolean
    lockConflict: boolean
  }
  comparison: {
    baselineLabel: string
    costDelta: number
    headcountDelta: number
  }
  rules: Array<{
    id: string
    gradeId?: string
    gradeName: string
    salaryIncreaseRate: number
    bonusRate: number
    active: boolean
    description?: string
    targetRatio?: number
  }>
  employees: Array<{
    id: string
    employeeId: string
    name: string
    departmentId: string
    department: string
    jobGroup?: string
    finalGrade: string
    currentSalary: number
    salaryIncreaseRate: number
    salaryIncreaseAmount: number
    bonusRate: number
    bonusAmount: number
    totalDelta: number
    projectedSalary: number
    projectedTotalCompensation: number
    excluded: boolean
    exclusionReason?: string
    ruleVersion: number
    evaluatorName?: string
    reviewerName?: string
    evaluationComment?: string
    performanceScore?: number
    competencyScore?: number
    calculationNote?: string
    kpiHighlights: Array<{
      id: string
      title: string
      achievementRate?: number
      target?: number
      actual?: number
      unit?: string
    }>
    monthlyHighlights: Array<{
      month: string
      achievementRate?: number
      comment?: string
    }>
  }>
  approvalTimeline: Array<{
    id: string
    at: string
    actor: string
    action: string
    note?: string
    fromStatus?: string
    toStatus?: string
    actionType: 'workflow' | 'publish' | 'system'
  }>
  publishChecklist: {
    approved: boolean
    recalculated: boolean
    budgetReviewed: boolean
    exceptionsReviewed: boolean
    readyToPublish: boolean
  }
  gradeOptions: Array<{
    id: string
    grade: string
    targetRatio?: number
  }>
}

type ScenarioListRecord = Prisma.CompensationScenarioGetPayload<{
  include: {
    evalCycle: {
      select: {
        id: true
        cycleName: true
        evalYear: true
      }
    }
    employees: {
      select: {
        id: true
      }
    }
  }
}>

type ScenarioDetailRecord = Prisma.CompensationScenarioGetPayload<{
  include: {
    evalCycle: {
      include: {
        organization: {
          select: {
            name: true
          }
        }
      }
    }
    ruleSet: {
      include: {
        rules: true
      }
    }
    approvals: {
      orderBy: {
        createdAt: 'desc'
      }
    }
    sourceScenario: {
      select: {
        scenarioName: true
        versionNo: true
      }
    }
    employees: {
      include: {
        employee: {
          include: {
            department: true
          }
        }
      }
      orderBy: [
        {
          bonusAmount: 'desc'
        }
      ]
    }
  }
}>

type EvaluationRecord = Prisma.EvaluationGetPayload<{
  include: {
    evaluator: {
      select: {
        empName: true
        position: true
      }
    }
    items: {
      include: {
        personalKpi: {
          include: {
            monthlyRecords: {
              orderBy: {
                yearMonth: 'desc'
              }
            }
          }
        }
      }
    }
  }
}>

export async function getCompensationManagePageData(params: {
  userId: string
  role: SystemRole
  year?: number
  cycleId?: string
  scenarioId?: string
}): Promise<CompensationManagePageData> {
  try {
    if (!['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(params.role)) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '보상 시뮬레이션 관리 화면은 관리자, 본부장, CEO만 접근할 수 있습니다.',
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.userId },
      include: {
        department: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!employee) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '현재 계정의 직원 정보를 찾을 수 없습니다.',
      }
    }

    const cycles = await prisma.evalCycle.findMany({
      where: {
        orgId: employee.department.orgId,
      },
      include: {
        organization: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
    })

    const availableCycles = cycles.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalYear,
      organizationName: cycle.organization.name,
      status: cycle.status,
    }))

    if (!cycles.length) {
      return {
        state: 'empty',
        availableCycles,
        message: '보상 시뮬레이션을 진행할 평가 주기가 아직 없습니다.',
      }
    }

    const selectedYear =
      params.year && cycles.some((cycle) => cycle.evalYear === params.year)
        ? params.year
        : cycles[0].evalYear

    const yearCycles = cycles.filter((cycle) => cycle.evalYear === selectedYear)
    const selectedCycle =
      yearCycles.find((cycle) => cycle.id === params.cycleId) ??
      yearCycles.find((cycle) => cycle.status !== 'SETUP') ??
      yearCycles[0]

    if (!selectedCycle) {
      return {
        state: 'empty',
        availableCycles,
        selectedYear,
        message: '선택한 연도에 사용할 평가 주기가 없습니다.',
      }
    }

    const [gradeSettings, activeEmployeesCount, activeRuleSet, scenarios] = await Promise.all([
      prisma.gradeSetting.findMany({
        where: {
          orgId: selectedCycle.orgId,
          evalYear: selectedCycle.evalYear,
          isActive: true,
        },
        select: {
          id: true,
          gradeName: true,
          targetDistRate: true,
          gradeOrder: true,
        },
        orderBy: {
          gradeOrder: 'asc',
        },
      }),
      prisma.employee.count({
        where: {
          status: 'ACTIVE',
          department: {
            orgId: selectedCycle.orgId,
          },
        },
      }),
      prisma.compensationRuleSet.findFirst({
        where: {
          orgId: selectedCycle.orgId,
          evalYear: selectedCycle.evalYear,
          isActive: true,
        },
        include: {
          rules: {
            orderBy: {
              gradeName: 'asc',
            },
          },
        },
      }),
      prisma.compensationScenario.findMany({
        where: {
          evalCycleId: selectedCycle.id,
        },
        include: {
          evalCycle: {
            select: {
              id: true,
              cycleName: true,
              evalYear: true,
            },
          },
          employees: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [{ versionNo: 'desc' }, { createdAt: 'desc' }],
      }),
    ])

    const selectedScenarioSummary =
      scenarios.find((scenario) => scenario.id === params.scenarioId) ?? scenarios[0] ?? null

    const selectedScenario = selectedScenarioSummary
      ? await prisma.compensationScenario.findUnique({
          where: { id: selectedScenarioSummary.id },
          include: {
            evalCycle: {
              include: {
                organization: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            ruleSet: {
              include: {
                rules: {
                  orderBy: {
                    gradeName: 'asc',
                  },
                },
              },
            },
            approvals: {
              orderBy: {
                createdAt: 'desc',
              },
            },
            sourceScenario: {
              select: {
                scenarioName: true,
                versionNo: true,
              },
            },
            employees: {
              include: {
                employee: {
                  include: {
                    department: true,
                  },
                },
              },
              orderBy: [{ bonusAmount: 'desc' }, { salaryIncreaseAmount: 'desc' }],
            },
          },
        })
      : null

    const evaluationIds = selectedScenario?.employees
      .map((row) => row.evaluationId)
      .filter((value): value is string => Boolean(value)) ?? []

    const scenarioEmployeeIds = selectedScenario?.employees.map((row) => row.employee.id) ?? []
    const aiCompetencyGateCycle = selectedScenario
      ? await prisma.aiCompetencyGateCycle.findUnique({
          where: { evalCycleId: selectedScenario.evalCycleId },
          select: { id: true },
        }).catch((error) => {
          console.error('[compensation-manage] AI competency gate cycle fallback', error)
          return null
        })
      : null

    const [evaluations, auditLogs, baselineScenario, aiCompetencyResults] = await Promise.all([
      evaluationIds.length
        ? prisma.evaluation.findMany({
            where: {
              id: {
                in: evaluationIds,
              },
            },
            include: {
              evaluator: {
                select: {
                  empName: true,
                  position: true,
                },
              },
              items: {
                include: {
                  personalKpi: {
                    include: {
                      monthlyRecords: {
                        orderBy: {
                          yearMonth: 'desc',
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([] as EvaluationRecord[]),
      selectedScenario
        ? prisma.auditLog.findMany({
            where: {
              entityType: 'CompensationScenario',
              entityId: selectedScenario.id,
            },
            orderBy: {
              timestamp: 'desc',
            },
            take: 20,
          })
        : Promise.resolve([]),
      selectedScenario?.sourceScenarioId
        ? prisma.compensationScenario.findUnique({
            where: {
              id: selectedScenario.sourceScenarioId,
            },
            select: {
              id: true,
              scenarioName: true,
              versionNo: true,
              totalCost: true,
              employees: {
                select: {
                  id: true,
                },
              },
            },
          })
        : selectedScenario
          ? prisma.compensationScenario.findFirst({
              where: {
                evalCycleId: selectedScenario.evalCycleId,
                versionNo: {
                  lt: selectedScenario.versionNo,
                },
              },
              orderBy: {
                versionNo: 'desc',
              },
              select: {
                id: true,
                scenarioName: true,
                versionNo: true,
                totalCost: true,
                employees: {
                  select: {
                    id: true,
                  },
                },
              },
            })
          : Promise.resolve(null),
      selectedScenario
        ? aiCompetencyGateCycle
          ? Promise.resolve(new Map())
          : loadAiCompetencySyncedResults({
              evalCycleIds: [selectedScenario.evalCycleId],
              employeeIds: scenarioEmployeeIds,
            }).catch((error) => {
              console.error('[compensation-manage] AI competency sync fallback', error)
              return new Map()
            })
        : Promise.resolve(new Map()),
    ])

    const viewModel = buildCompensationManageViewModel({
      role: params.role,
      cycle: selectedCycle,
      scenarios,
      selectedScenario,
      activeRuleSet,
      gradeSettings,
      activeEmployeesCount,
      evaluations,
      auditLogs,
      baselineScenario,
      aiCompetencyResults,
    })

    return {
      state: 'ready',
      availableCycles,
      selectedYear,
      selectedCycleId: selectedCycle.id,
      selectedScenarioId: selectedScenario?.id,
      viewModel,
    }
  } catch (error) {
    console.error('[compensation-manage] failed to build page data', error)

    return {
      state: 'error',
      availableCycles: [],
      message: '보상 시뮬레이션 화면을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
}

function buildCompensationManageViewModel(params: {
  role: SystemRole
  cycle: {
    id: string
    cycleName: string
    evalYear: number
    status: CycleStatus
  }
  scenarios: ScenarioListRecord[]
  selectedScenario: ScenarioDetailRecord | null
  activeRuleSet: {
    id: string
    versionNo: number
    rules: Array<{
      id: string
      gradeSettingId: string | null
      gradeName: string
      bonusRate: number
      salaryIncreaseRate: number
      description: string | null
    }>
  } | null
  gradeSettings: Array<{
    id: string
    gradeName: string
    targetDistRate: number | null
    gradeOrder: number
  }>
  activeEmployeesCount: number
  evaluations: EvaluationRecord[]
  auditLogs: Array<{
    id: string
    action: string
    userId: string
    timestamp: Date
    oldValue: Prisma.JsonValue | null
    newValue: Prisma.JsonValue | null
  }>
  baselineScenario: {
    id: string
    scenarioName: string
    versionNo: number
    totalCost: number
    employees: Array<{
      id: string
    }>
  } | null
  aiCompetencyResults: Map<
    string,
    {
      finalScore: number
      finalGrade: string
      certificationStatus: string
    }
  >
}) : CompensationManageViewModel {
  const visualStatus = getScenarioVisualStatus(
    params.selectedScenario?.status ?? null,
    params.selectedScenario?.publishedAt ?? null
  )

  const gradeSettingsMap = new Map(
    params.gradeSettings.map((grade) => [grade.gradeName, grade] as const)
  )
  const evaluationMap = new Map(params.evaluations.map((evaluation) => [evaluation.id, evaluation] as const))

  const scenarioRules =
    params.selectedScenario?.ruleSet.rules.map((rule) => ({
      id: rule.id,
      gradeId: rule.gradeSettingId ?? undefined,
      gradeName: rule.gradeName,
      salaryIncreaseRate: rule.salaryIncreaseRate,
      bonusRate: rule.bonusRate,
      active: true,
      description: rule.description ?? undefined,
      targetRatio: gradeSettingsMap.get(rule.gradeName)?.targetDistRate ?? undefined,
    })) ??
    params.activeRuleSet?.rules.map((rule) => ({
      id: rule.id,
      gradeId: rule.gradeSettingId ?? undefined,
      gradeName: rule.gradeName,
      salaryIncreaseRate: rule.salaryIncreaseRate,
      bonusRate: rule.bonusRate,
      active: true,
      description: rule.description ?? undefined,
      targetRatio: gradeSettingsMap.get(rule.gradeName)?.targetDistRate ?? undefined,
    })) ??
    params.gradeSettings.map((grade) => ({
      id: `fallback-${grade.id}`,
      gradeId: grade.id,
      gradeName: grade.gradeName,
      salaryIncreaseRate: 0,
      bonusRate: 0,
      active: true,
      description: `${grade.gradeName} 기본 보상 규칙`,
      targetRatio: grade.targetDistRate ?? undefined,
    }))

  const employeeRows =
    params.selectedScenario?.employees.map((row) => {
      const evaluation = row.evaluationId ? evaluationMap.get(row.evaluationId) : undefined
      const performanceScore = calculateAxisScore(evaluation, 'performance')
      const competencyScore =
        params.aiCompetencyResults.get(`${params.cycle.id}:${row.employee.id}`)?.finalScore ??
        calculateAxisScore(evaluation, 'competency')
      const excluded = row.calculationNote?.startsWith('EXCLUDED:') ?? false
      const exclusionReason = excluded
        ? row.calculationNote?.replace('EXCLUDED:', '').trim()
        : undefined

      return {
        id: row.id,
        employeeId: row.employee.empId,
        name: row.employee.empName,
        departmentId: row.employee.department.id,
        department: row.employee.department.deptName,
        jobGroup: resolvePositionLabel(row.employee.position),
        finalGrade: row.gradeName,
        currentSalary: row.currentSalary,
        salaryIncreaseRate: row.salaryIncreaseRate,
        salaryIncreaseAmount: row.salaryIncreaseAmount,
        bonusRate: row.bonusRate,
        bonusAmount: row.bonusAmount,
        totalDelta: row.salaryIncreaseAmount + row.bonusAmount,
        projectedSalary: row.projectedSalary,
        projectedTotalCompensation: row.projectedTotalCompensation,
        excluded,
        exclusionReason,
        ruleVersion: row.sourceRuleVersionNo,
        evaluatorName: evaluation?.evaluator.empName,
        reviewerName: undefined,
        evaluationComment: evaluation?.comment ?? undefined,
        performanceScore,
        competencyScore,
        calculationNote: row.calculationNote ?? undefined,
        kpiHighlights: (evaluation?.items ?? []).slice(0, 4).map((item) => {
          const latestRecord = item.personalKpi.monthlyRecords[0]
          return {
            id: item.personalKpi.id,
            title: item.personalKpi.kpiName,
            achievementRate: latestRecord?.achievementRate ?? undefined,
            target: item.personalKpi.targetValue ?? undefined,
            actual: latestRecord?.actualValue ?? undefined,
            unit: item.personalKpi.unit ?? undefined,
          }
        }),
        monthlyHighlights: buildMonthlyHighlights(evaluation),
      }
    }) ?? []

  const employeeCount = employeeRows.length
  const impactedCount = employeeRows.filter((row) => row.totalDelta > 0).length
  const totalSalaryIncrease = params.selectedScenario?.totalSalaryIncrease ?? 0
  const totalBonus = params.selectedScenario?.totalBonus ?? 0
  const totalDelta = totalSalaryIncrease + totalBonus
  const avgIncreaseRate = employeeCount
    ? roundToSingle(
        employeeRows.reduce((sum, row) => sum + row.salaryIncreaseRate, 0) / employeeCount
      )
    : 0
  const overBudgetAmount = params.selectedScenario?.overBudgetAmount ?? 0
  const remainingBudget = (params.selectedScenario?.budgetLimit ?? 0) - (params.selectedScenario?.totalCost ?? 0)
  const excludedCount = employeeRows.filter((row) => row.excluded).length
  const missingRuleCount = employeeRows.filter((row) =>
    row.calculationNote?.includes('MISSING_RULE:')
  ).length
  const incompleteEvaluationCount = Math.max(params.activeEmployeesCount - employeeCount, 0)
  const lockConflict =
    Boolean(params.selectedScenario?.isLocked) &&
    Boolean(params.selectedScenario?.needsRecalculation)
  const baselineLabel = params.baselineScenario
    ? `${params.baselineScenario.scenarioName} v${params.baselineScenario.versionNo}`
    : '비교 기준 없음'
  const comparison = {
    baselineLabel,
    costDelta: params.baselineScenario
      ? roundToSingle((params.selectedScenario?.totalCost ?? 0) - params.baselineScenario.totalCost)
      : 0,
    headcountDelta: params.baselineScenario
      ? employeeCount - params.baselineScenario.employees.length
      : 0,
  }

  const publishChecklist = {
    approved:
      visualStatus === 'FINAL_APPROVED' || visualStatus === 'PUBLISHED',
    recalculated: !(params.selectedScenario?.needsRecalculation ?? false),
    budgetReviewed:
      !(params.selectedScenario?.isOverBudget ?? false) ||
      visualStatus === 'FINAL_APPROVED' ||
      visualStatus === 'PUBLISHED',
    exceptionsReviewed:
      employeeRows.filter((row) => row.excluded && !row.exclusionReason).length === 0,
    readyToPublish: false,
  }
  publishChecklist.readyToPublish =
    publishChecklist.approved &&
    publishChecklist.recalculated &&
    publishChecklist.budgetReviewed &&
    publishChecklist.exceptionsReviewed &&
    visualStatus !== 'PUBLISHED'

  return {
    actorRole:
      params.role === 'ROLE_CEO'
        ? 'ROLE_CEO'
        : params.role === 'ROLE_DIV_HEAD'
          ? 'ROLE_DIV_HEAD'
          : 'ROLE_ADMIN',
    cycle: {
      id: params.cycle.id,
      name: params.cycle.cycleName,
      year: params.cycle.evalYear,
      rawStatus: params.cycle.status,
    },
    scenarioOptions: params.scenarios.map((scenario) => {
      const status = getScenarioVisualStatus(scenario.status, scenario.publishedAt)
      return {
        id: scenario.id,
        name: scenario.scenarioName,
        version: scenario.versionNo,
        status,
        needsRecalculation: scenario.needsRecalculation,
        isLocked: scenario.isLocked,
        label: `${scenario.scenarioName} v${scenario.versionNo}`,
      }
    }),
    scenario: params.selectedScenario
      ? {
          id: params.selectedScenario.id,
          name: params.selectedScenario.scenarioName,
          version: params.selectedScenario.versionNo,
          status: visualStatus,
          rawStatus: params.selectedScenario.status,
          createdBy: params.selectedScenario.createdById,
          createdAt: params.selectedScenario.createdAt.toISOString(),
          updatedAt: params.selectedScenario.updatedAt.toISOString(),
          budgetLimit: params.selectedScenario.budgetLimit,
          totalCost: params.selectedScenario.totalCost,
          budgetDelta: params.selectedScenario.totalCost - params.selectedScenario.budgetLimit,
          needsRecalculation: params.selectedScenario.needsRecalculation,
          isLocked: params.selectedScenario.isLocked,
          publishedAt: params.selectedScenario.publishedAt?.toISOString(),
          approvalStateLabel: getApprovalPendingLabel(visualStatus),
          sourceScenarioLabel: params.selectedScenario.sourceScenario
            ? `${params.selectedScenario.sourceScenario.scenarioName} v${params.selectedScenario.sourceScenario.versionNo}`
            : undefined,
        }
      : null,
    summary: {
      employeeCount,
      impactedCount,
      avgIncreaseRate,
      totalSalaryIncrease,
      totalBonus,
      totalDelta,
      overBudget: params.selectedScenario?.isOverBudget ?? false,
      overBudgetAmount,
      remainingBudget,
      approvalPendingLabel: getApprovalPendingLabel(visualStatus),
      excludedCount,
    },
    risks: {
      incompleteEvaluationCount,
      missingRuleCount,
      excludedCount,
      staleCalculation: params.selectedScenario?.needsRecalculation ?? false,
      lockConflict,
    },
    comparison,
    rules: scenarioRules,
    employees: employeeRows,
    approvalTimeline: buildApprovalTimeline(params.selectedScenario, params.auditLogs),
    publishChecklist,
    gradeOptions: params.gradeSettings.map((grade) => ({
      id: grade.id,
      grade: grade.gradeName,
      targetRatio: grade.targetDistRate ?? undefined,
    })),
  }
}

function buildApprovalTimeline(
  scenario: ScenarioDetailRecord | null,
  auditLogs: Array<{
    id: string
    action: string
    userId: string
    timestamp: Date
    oldValue: Prisma.JsonValue | null
    newValue: Prisma.JsonValue | null
  }>
) {
  const approvalEntries =
    scenario?.approvals.map((approval) => ({
      id: approval.id,
      at: approval.createdAt.toISOString(),
      actor: approval.actorRole,
      action: humanizeWorkflowAction(approval.action),
      note: approval.comment ?? undefined,
      fromStatus: approval.fromStatus,
      toStatus: approval.toStatus,
      actionType: 'workflow' as const,
    })) ?? []

  const publishEntries = auditLogs
    .filter((log) => log.action === 'COMPENSATION_PUBLISH')
    .map((log) => ({
      id: log.id,
      at: log.timestamp.toISOString(),
      actor: log.userId,
      action: '공개 처리',
      note: parseAuditNote(log.newValue) ?? undefined,
      fromStatus: parseAuditStatus(log.oldValue) ?? undefined,
      toStatus: 'PUBLISHED',
      actionType: 'publish' as const,
    }))

  const fallbackEntries =
    !approvalEntries.length && !publishEntries.length && scenario
      ? [
          {
            id: `${scenario.id}-created`,
            at: scenario.createdAt.toISOString(),
            actor: scenario.createdById,
            action: '시나리오 생성',
            note: `${scenario.scenarioName} v${scenario.versionNo}`,
            fromStatus: undefined,
            toStatus: scenario.status,
            actionType: 'system' as const,
          },
        ]
      : []

  return [...publishEntries, ...approvalEntries, ...fallbackEntries].sort((a, b) =>
    b.at.localeCompare(a.at)
  )
}

function buildMonthlyHighlights(evaluation?: EvaluationRecord) {
  if (!evaluation) return []

  const monthMap = new Map<string, { month: string; rates: number[]; comments: string[] }>()
  evaluation.items.forEach((item) => {
    item.personalKpi.monthlyRecords.forEach((record) => {
      const current = monthMap.get(record.yearMonth) ?? {
        month: record.yearMonth,
        rates: [],
        comments: [],
      }
      if (typeof record.achievementRate === 'number') current.rates.push(record.achievementRate)
      const comment = record.activities || record.obstacles || record.efforts
      if (comment) current.comments.push(comment)
      monthMap.set(record.yearMonth, current)
    })
  })

  return [...monthMap.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 4)
    .map((row) => ({
      month: row.month,
      achievementRate:
        row.rates.length > 0
          ? roundToSingle(row.rates.reduce((sum, value) => sum + value, 0) / row.rates.length)
          : undefined,
      comment: row.comments[0] ?? undefined,
    }))
}

function calculateAxisScore(
  evaluation: EvaluationRecord | undefined,
  axis: 'performance' | 'competency'
) {
  if (!evaluation) return undefined

  const rows = evaluation.items
    .map((item) => {
      const value = getItemScore(item)
      return {
        type: item.personalKpi.kpiType,
        value,
        weight: item.personalKpi.weight,
      }
    })
    .filter((row) =>
      axis === 'performance' ? row.type === 'QUANTITATIVE' : row.type === 'QUALITATIVE'
    )
    .filter(
      (
        row
      ): row is {
        type: EvaluationRecord['items'][number]['personalKpi']['kpiType']
        value: number
        weight: number
      } => typeof row.value === 'number'
    )

  if (!rows.length) return undefined

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0)
  if (totalWeight <= 0) {
    return roundToSingle(rows.reduce((sum, row) => sum + row.value, 0) / rows.length)
  }

  return roundToSingle(
    rows.reduce((sum, row) => sum + row.value * row.weight, 0) / totalWeight
  )
}

function getItemScore(item: EvaluationRecord['items'][number]) {
  if (item.quantScore !== null) return roundToSingle(item.quantScore)
  if (item.qualScore !== null) return roundToSingle(item.qualScore)
  if (item.weightedScore !== null && item.personalKpi.weight > 0) {
    return roundToSingle((item.weightedScore * 100) / item.personalKpi.weight)
  }
  return null
}

function getScenarioVisualStatus(
  status: CompensationScenarioStatus | null,
  publishedAt: Date | null
): CompensationScenarioVisualStatus {
  if (publishedAt) return 'PUBLISHED'
  return (status ?? 'DRAFT') as CompensationScenarioVisualStatus
}

function getApprovalPendingLabel(status: CompensationScenarioVisualStatus) {
  if (status === 'PUBLISHED') return '공개 완료'
  if (status === 'FINAL_APPROVED') return '공개 가능'
  if (status === 'REVIEW_APPROVED') return 'CEO 최종 승인 대기'
  if (status === 'UNDER_REVIEW') return '본부장 검토 대기'
  if (status === 'REJECTED') return '반려 후 재작성 필요'
  return '작성 및 계산 점검 필요'
}

function humanizeWorkflowAction(action: string) {
  switch (action) {
    case 'SUBMIT':
      return '승인 요청'
    case 'REVIEW_APPROVE':
      return '검토 승인'
    case 'FINAL_APPROVE':
      return '최종 승인'
    case 'REJECT':
      return '반려'
    case 'LOCK':
      return '잠금'
    case 'RECALCULATE':
      return '재계산'
    default:
      return action
  }
}

function parseAuditStatus(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const status = (value as Record<string, unknown>).status
  return typeof status === 'string' ? status : undefined
}

function parseAuditNote(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const comment = (value as Record<string, unknown>).comment
  if (typeof comment === 'string' && comment.trim()) return comment
  const publishedAt = (value as Record<string, unknown>).publishedAt
  return typeof publishedAt === 'string' ? `공개 시각 ${publishedAt}` : undefined
}

function resolvePositionLabel(position: Position) {
  switch (position) {
    case 'TEAM_LEADER':
      return '팀장'
    case 'SECTION_CHIEF':
      return '부서장'
    case 'DIV_HEAD':
      return '본부장'
    case 'CEO':
      return 'CEO'
    default:
      return '구성원'
  }
}

function roundToSingle(value: number) {
  return Math.round(value * 10) / 10
}
