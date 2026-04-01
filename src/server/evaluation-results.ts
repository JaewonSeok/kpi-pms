import type {
  AppealStatus,
  CheckInStatus,
  CheckInType,
  CycleStatus,
  EvalStage,
  Position,
  Prisma,
  SystemRole,
} from '@prisma/client'
import { calcPdcaScore } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { normalizeAccessibleDepartmentIds } from '@/lib/personal-kpi-access'
import { loadAiCompetencySyncedResults } from '@/server/ai-competency'
import {
  calculateEffectiveTotalScore,
  toWeightedScoredRows,
  weightedAverage,
} from '@/server/evaluation-results-scoring'

export type ResultVisibilityState = 'ready' | 'empty' | 'unpublished' | 'permission-denied' | 'error'
export type ResultPublicationStatus = 'HIDDEN' | 'PUBLISHED' | 'APPEAL_OPEN' | 'APPEAL_CLOSED'

export type EvaluationResultPageAlert = {
  title: string
  description: string
}

export type EvaluationResultEmployeeOption = {
  id: string
  name: string
  departmentName: string
  title: string
}

export type EvaluationResultScopeOption = {
  id: string
  name: string
  year: number
  organizationName: string
  departmentName: string
  status: CycleStatus
}

export type EvaluationResultViewModel = {
  cycle: {
    id: string
    name: string
    year: number
    status: ResultPublicationStatus
    rawStatus: CycleStatus
    organizationName: string
    departmentScope: string
    publishedAt?: string
    appealDeadline?: string
    confirmedAt?: string
  }
  employee: {
    id: string
    name: string
    department: string
    title: string
  }
  summary: {
    acknowledged: boolean
    acknowledgedAt?: string
    finalGrade: string
    totalScore: number
    performanceScore: number
    competencyScore: number
    calibrationAdjusted: boolean
    previousGrade?: string
    previousScore?: number
    percentileLabel?: string
    deltaFromPrevious?: number
  }
  overview: {
    achievementRate: number
    completedCheckins: number
    feedbackCount: number
    evaluatorPreview: string
    strengthsPreview: string[]
    improvementsPreview: string[]
    interpretation: string
  }
  scoreBreakdown: {
    performance: Array<{
      id: string
      title: string
      score: number
      weight?: number
      selfScore?: number
      managerScore?: number
      reviewerScore?: number
      finalScore?: number
      comment?: string
      deltaFromSelf?: number
    }>
    competency: Array<{
      id: string
      title: string
      score: number
      weight?: number
      selfScore?: number
      reviewerScore?: number
      managerScore?: number
      finalScore?: number
      comment?: string
      deltaFromSelf?: number
    }>
  }
  evidence: {
    kpis: Array<{
      id: string
      title: string
      target?: number
      actual?: number
      achievementRate?: number
      unit?: string
      status?: string
    }>
    monthlyRecords: Array<{
      month: string
      achievementRate?: number
      comment?: string
    }>
    checkins: Array<{
      date: string
      type: CheckInType
      status: CheckInStatus
      summary: string
      actionItems?: string[]
    }>
    feedbacks: Array<{
      date: string
      author: string
      content: string
    }>
    attachments: Array<{
      label: string
      source: string
    }>
    highlights: Array<{
      title: string
      summary: string
      tone: 'positive' | 'neutral' | 'attention'
    }>
  }
  calibration: {
    draftGrade?: string
    finalGrade?: string
    adjusted: boolean
    reason?: string
    logs: Array<{
      date: string
      actor: string
      action: string
      detail?: string
    }>
  }
  growth: {
    strengths: string[]
    improvements: string[]
    actions: string[]
    discussionQuestions: string[]
  }
  actions: {
    canAcknowledge: boolean
    acknowledgeMessage?: string
    canExport: boolean
    exportMessage?: string
  }
}

export type EvaluationResultPageData = {
  state: ResultVisibilityState
  availableCycles: EvaluationResultScopeOption[]
  selectedCycleId?: string
  employeeOptions: EvaluationResultEmployeeOption[]
  selectedEmployeeId?: string
  canSelectEmployee: boolean
  viewModel?: EvaluationResultViewModel
  message?: string
  alerts?: EvaluationResultPageAlert[]
}

type EmployeeWithDepartment = Prisma.EmployeeGetPayload<{
  include: {
    department: {
      include: {
        organization: true
      }
    }
  }
}>

type EvaluationWithRelations = Prisma.EvaluationGetPayload<{
  include: {
    evaluator: {
      select: {
        empName: true
        position: true
      }
    }
    items: {
      include: {
        personalKpi: true
      }
    }
    appeals: true
  }
}>

type PersonalKpiWithRecords = Prisma.PersonalKpiGetPayload<{
  include: {
    monthlyRecords: true
  }
}>

type GradeSettingLite = {
  id: string
  gradeName: string
  minScore: number
  maxScore: number
}

type ResultsSession = {
  user: {
    id: string
    name: string
    deptId: string
    deptName: string
    role?: SystemRole
    accessibleDepartmentIds?: string[]
  }
}

type ResultScopeEmployee = Prisma.EmployeeGetPayload<{
  include: {
    department: {
      include: {
        organization: true
      }
    }
  }
}>

async function loadEvaluationResultSection<T>(params: {
  alerts: EvaluationResultPageAlert[]
  title: string
  description: string
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`[evaluation-results] ${params.title}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function resolveDepartmentLabel(department?: { deptName?: string | null } | null) {
  const name = department?.deptName?.trim()
  return name?.length ? name : '미지정 부서'
}

function canBrowseScopedEvaluationResults(role?: SystemRole) {
  return role === 'ROLE_ADMIN' || role === 'ROLE_CEO' || role === 'ROLE_DIV_HEAD' || role === 'ROLE_SECTION_CHIEF' || role === 'ROLE_TEAM_LEADER'
}

function getEvaluationResultScopeDepartmentIds(params: {
  role?: SystemRole
  deptId?: string | null
  accessibleDepartmentIds?: string[] | null
}) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  const normalizedIds = normalizeAccessibleDepartmentIds(params.accessibleDepartmentIds)
  if (normalizedIds.length) return normalizedIds
  if (params.deptId?.trim()) return [params.deptId]
  return []
}

export async function getEvaluationResultsPageData(params: {
  session: ResultsSession
  cycleId?: string
  employeeId?: string
}): Promise<EvaluationResultPageData> {
  try {
    const alerts: EvaluationResultPageAlert[] = []
    const actorRole = params.session.user.role ?? 'ROLE_MEMBER'
    const canSelectEmployee = canBrowseScopedEvaluationResults(actorRole)
    const employee = await prisma.employee.findUnique({
      where: { id: params.session.user.id },
      include: {
        department: {
          include: {
            organization: true,
          },
        },
      },
    })
    const sessionDepartment =
      !employee && params.session.user.deptId
        ? await prisma.department.findUnique({
            where: { id: params.session.user.deptId },
            include: {
              organization: true,
            },
          })
        : null
    const organizationId = employee?.department?.orgId ?? sessionDepartment?.orgId ?? null
    const scopeDepartmentName = resolveDepartmentLabel(employee?.department ?? sessionDepartment)

    if (!employee && !organizationId) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        employeeOptions: [],
        canSelectEmployee,
        message: '평가 결과를 확인할 수 있는 직원 정보를 찾지 못했습니다.',
        alerts,
      }
    }

    if (employee && !employee.department && !organizationId) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        employeeOptions: [],
        canSelectEmployee,
        message: '평가 결과를 조회할 부서 정보가 없어 관리자에게 설정 확인이 필요합니다.',
        alerts,
      }
    }

    const cycles = await prisma.evalCycle.findMany({
      where: {
        orgId: organizationId ?? undefined,
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
      departmentName: scopeDepartmentName,
      status: cycle.status,
    }))

    if (!cycles.length) {
      return {
        state: 'empty',
        availableCycles,
        employeeOptions: [],
        canSelectEmployee,
        message: '아직 생성된 평가 주기가 없습니다.',
        alerts,
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles.find((cycle) => cycle.status !== 'SETUP') ??
      cycles[0]

    if (!employee && !canSelectEmployee) {
      return {
        state: 'empty',
        availableCycles,
        employeeOptions: [],
        selectedCycleId: selectedCycle?.id,
        canSelectEmployee,
        alerts,
        message: '연결된 직원 평가 결과가 없어 현재 계정으로 확인할 결과가 없습니다.',
      }
    }

    const scopeDepartmentIds = getEvaluationResultScopeDepartmentIds({
      role: actorRole,
      deptId: params.session.user.deptId,
      accessibleDepartmentIds: params.session.user.accessibleDepartmentIds,
    })

    const scopedEmployees = await loadEvaluationResultSection({
      alerts,
      title: '?됯? 寃곌낵 議고쉶 ????곸옄 紐⑸줉???щ윭?ㅼ? 紐삵뻽?듬땲??',
      description: '??곸옄 ?꾪꽣???遺? ?곌낵 ?붾㈃?쇰줈 ?쒖떆?⑸땲??',
      fallback: [] as ResultScopeEmployee[],
      loader: () =>
        prisma.employee.findMany({
          where: {
            status: 'ACTIVE',
            ...(scopeDepartmentIds === null
              ? {
                  department: {
                    orgId: organizationId ?? undefined,
                  },
                }
              : {
                  deptId: {
                    in: scopeDepartmentIds,
                  },
                }),
          },
          include: {
            department: {
              include: {
                organization: true,
              },
            },
          },
          orderBy: [{ empName: 'asc' }],
        }),
    })

    const employeeOptions = scopedEmployees.map((item) => ({
      id: item.id,
      name: item.empName,
      departmentName: resolveDepartmentLabel(item.department),
      title: resolvePositionLabel(item.position),
    }))

    const defaultTargetEmployee = employee ?? (canSelectEmployee ? scopedEmployees[0] ?? null : null)
    const requestedEmployee =
      params.employeeId?.trim()
        ? scopedEmployees.find((item) => item.id === params.employeeId) ?? null
        : null

    if (params.employeeId?.trim() && !requestedEmployee) {
      return {
        state: 'permission-denied',
        availableCycles,
        employeeOptions,
        selectedCycleId: selectedCycle?.id,
        selectedEmployeeId: defaultTargetEmployee?.id,
        canSelectEmployee,
        alerts,
        message: '?붾㈃???뺤씤?????놁뒗 ??곸옄瑜?議고쉶?섍퀬 ?덉뒿?덈떎.',
      }
    }

    const targetEmployee = requestedEmployee ?? defaultTargetEmployee

    if (!targetEmployee) {
      return {
        state: 'empty',
        availableCycles,
        employeeOptions,
        selectedCycleId: selectedCycle?.id,
        selectedEmployeeId: undefined,
        canSelectEmployee,
        alerts,
        message: canSelectEmployee
          ? '?댁쓽 踰붿쐞?먯꽌 議고쉶?????덈뒗 ?됯? ??곸옄媛 ?놁뒿?덈떎.'
          : '?곌껐??吏곸썝 ?됯? 寃곌낵媛 ?놁뼱 ?꾩옱 怨꾩젙?쇰줈 ?뺤씤??寃곌낵媛 ?놁뒿?덈떎.',
      }
    }

    const baseEvaluations = await prisma.evaluation.findMany({
      where: {
        evalCycleId: selectedCycle.id,
        targetId: targetEmployee.id,
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
            personalKpi: true,
          },
        },
        appeals: true,
      },
    })

    if (!baseEvaluations.length) {
      const publicationStatus = resolvePublicationStatus(selectedCycle, false)
      return {
        state: publicationStatus === 'HIDDEN' ? 'unpublished' : 'empty',
        availableCycles,
        employeeOptions,
        selectedCycleId: selectedCycle.id,
        selectedEmployeeId: targetEmployee.id,
        canSelectEmployee,
        alerts,
        message:
          publicationStatus === 'HIDDEN'
            ? '평가 결과가 아직 공개되지 않았습니다. 결과 공개 일정 이후 다시 확인해 주세요.'
            : '이 주기에는 아직 확인 가능한 평가 결과가 없습니다.',
      }
    }

    const evaluationIds = baseEvaluations.map((evaluation) => evaluation.id)
    const appealIds = baseEvaluations.flatMap((evaluation) => evaluation.appeals.map((appeal) => appeal.id))

    const [
      gradeSettings,
      previousFinalEvaluations,
      cycleFinalEvaluations,
      personalKpis,
      checkIns,
      auditLogs,
      aiCompetencyResults,
    ] = await Promise.all([
      loadEvaluationResultSection({
        alerts,
        title: '등급 기준을 불러오지 못했습니다.',
        description: '등급은 등록된 최종 결과 또는 점수 기준으로만 표시합니다.',
        fallback: [] as GradeSettingLite[],
        loader: () =>
          prisma.gradeSetting.findMany({
            where: {
              orgId: selectedCycle.orgId,
              evalYear: selectedCycle.evalYear,
              isActive: true,
            },
            select: {
              id: true,
              gradeName: true,
              minScore: true,
              maxScore: true,
            },
            orderBy: {
              gradeOrder: 'asc',
            },
          }),
      }),
      loadEvaluationResultSection({
        alerts,
        title: '전년도 평가 이력을 불러오지 못했습니다.',
        description: '전년 비교 지표는 생략하고 현재 결과만 표시합니다.',
        fallback: [] as Array<{ totalScore: number | null; gradeId: string | null }>,
        loader: () =>
          prisma.evaluation.findMany({
            where: {
              targetId: targetEmployee.id,
              status: 'CONFIRMED',
              evalStage: {
                in: ['FINAL', 'CEO_ADJUST'],
              },
              evalCycle: {
                orgId: selectedCycle.orgId,
                evalYear: {
                  lt: selectedCycle.evalYear,
                },
              },
            },
            select: {
              totalScore: true,
              gradeId: true,
            },
            orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
            take: 4,
          }),
      }),
      loadEvaluationResultSection({
        alerts,
        title: '주기 분포 데이터를 불러오지 못했습니다.',
        description: '백분위 비교는 생략하고 개인 결과만 표시합니다.',
        fallback: [] as Array<{ targetId: string; totalScore: number | null }>,
        loader: () =>
          prisma.evaluation.findMany({
            where: {
              evalCycleId: selectedCycle.id,
              status: 'CONFIRMED',
              evalStage: {
                in: ['FINAL', 'CEO_ADJUST'],
              },
            },
            select: {
              targetId: true,
              totalScore: true,
            },
          }),
      }),
      loadEvaluationResultSection({
        alerts,
        title: '연결된 KPI 근거를 불러오지 못했습니다.',
        description: 'KPI 근거 표는 빈 상태로 표시합니다.',
        fallback: [] as PersonalKpiWithRecords[],
        loader: () =>
          prisma.personalKpi.findMany({
            where: {
              employeeId: targetEmployee.id,
              evalYear: selectedCycle.evalYear,
            },
            include: {
              monthlyRecords: {
                orderBy: {
                  yearMonth: 'asc',
                },
              },
            },
            orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
          }),
      }),
      loadEvaluationResultSection({
        alerts,
        title: '체크인 근거를 불러오지 못했습니다.',
        description: '체크인 증거는 빈 상태로 표시합니다.',
        fallback: [] as Array<{
          scheduledDate: Date
          actualDate: Date | null
          checkInType: CheckInType
          status: CheckInStatus
          keyTakeaways: string | null
          ownerNotes: string | null
          managerNotes: string | null
          actionItems: Prisma.JsonValue
        }>,
        loader: () =>
          prisma.checkIn.findMany({
            where: {
              ownerId: targetEmployee.id,
              scheduledDate: {
                gte: new Date(`${selectedCycle.evalYear}-01-01T00:00:00.000Z`),
                lte: new Date(`${selectedCycle.evalYear}-12-31T23:59:59.999Z`),
              },
            },
            orderBy: {
              scheduledDate: 'desc',
            },
            take: 6,
          }),
      }),
      loadEvaluationResultSection({
        alerts,
        title: '평가 공개/이력 로그를 불러오지 못했습니다.',
        description: '확인 이력과 캘리브레이션 로그는 축약해 표시합니다.',
        fallback: [] as Array<{
          action: string
          entityType: string
          entityId: string | null
          userId: string
          timestamp: Date
        }>,
        loader: () =>
          prisma.auditLog.findMany({
            where: {
              OR: [
                evaluationIds.length
                  ? {
                      entityType: 'Evaluation',
                      entityId: {
                        in: evaluationIds,
                      },
                    }
                  : undefined,
                {
                  entityType: 'EvalCycle',
                  entityId: selectedCycle.id,
                },
                appealIds.length
                  ? {
                      entityType: 'Appeal',
                      entityId: {
                        in: appealIds,
                      },
                    }
                  : undefined,
              ].filter(Boolean) as Prisma.AuditLogWhereInput[],
            },
            orderBy: {
              timestamp: 'desc',
            },
            take: 20,
          }),
      }),
      loadEvaluationResultSection({
        alerts,
        title: 'AI 활용능력 연동 점수를 불러오지 못했습니다.',
        description: 'AI 활용능력 가산/대체 점수 없이 기존 평가 결과만 표시합니다.',
        fallback: new Map() as Awaited<ReturnType<typeof loadAiCompetencySyncedResults>>,
        loader: () =>
          loadAiCompetencySyncedResults({
            evalCycleIds: [selectedCycle.id],
            employeeIds: [targetEmployee.id],
          }),
      }),
    ])

    const stageMap = new Map(baseEvaluations.map((evaluation) => [evaluation.evalStage, evaluation] as const))
    const finalEvaluation =
      stageMap.get('CEO_ADJUST') ??
      stageMap.get('FINAL') ??
      stageMap.get('SECOND') ??
      stageMap.get('FIRST') ??
      stageMap.get('SELF') ??
      null

    const hasConfirmedFinal = baseEvaluations.some(
      (evaluation) =>
        evaluation.status === 'CONFIRMED' &&
        (evaluation.evalStage === 'FINAL' || evaluation.evalStage === 'CEO_ADJUST')
    )

    const publicationStatus = resolvePublicationStatus(selectedCycle, hasConfirmedFinal)

    if (publicationStatus === 'HIDDEN' && !hasConfirmedFinal) {
      return {
        state: 'unpublished',
        availableCycles,
        employeeOptions,
        selectedCycleId: selectedCycle.id,
        selectedEmployeeId: targetEmployee.id,
        canSelectEmployee,
        alerts,
        message: '평가 결과가 아직 공개되지 않았습니다. 공개 일정과 마감 상태를 확인해 주세요.',
      }
    }

    const viewModel = buildEvaluationResultViewModel({
      employee: targetEmployee,
      cycle: selectedCycle,
      evaluations: baseEvaluations,
      finalEvaluation,
      gradeSettings,
      personalKpis,
      checkIns,
      previousEvaluation: previousFinalEvaluations.find((evaluation) => evaluation.totalScore !== null) ?? null,
      cycleFinalEvaluations,
      publicationStatus,
      auditLogs,
      aiCompetencyScore: aiCompetencyResults.get(`${selectedCycle.id}:${targetEmployee.id}`)?.finalScore,
      actorId: params.session.user.id,
      canExport: true,
    })

    return {
      state: 'ready',
      availableCycles,
      employeeOptions,
      selectedCycleId: selectedCycle.id,
      selectedEmployeeId: targetEmployee.id,
      canSelectEmployee,
      viewModel,
      alerts,
    }
  } catch (error) {
    console.error('[evaluation-results] failed to build page data', error)

    return {
      state: 'error',
      availableCycles: [],
      employeeOptions: [],
      canSelectEmployee: false,
      message: '평가 결과를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      alerts: [],
    }
  }
}

function buildEvaluationResultViewModel(params: {
  employee: EmployeeWithDepartment
  cycle: {
    id: string
    orgId: string
    evalYear: number
    cycleName: string
    status: CycleStatus
    resultOpenStart: Date | null
    appealDeadline: Date | null
    organization: {
      name: string
    }
  }
  evaluations: EvaluationWithRelations[]
  finalEvaluation: EvaluationWithRelations | null
  gradeSettings: GradeSettingLite[]
  personalKpis: PersonalKpiWithRecords[]
  checkIns: Array<{
    scheduledDate: Date
    actualDate: Date | null
    checkInType: CheckInType
    status: CheckInStatus
    keyTakeaways: string | null
    ownerNotes: string | null
    managerNotes: string | null
    actionItems: Prisma.JsonValue
  }>
  previousEvaluation: {
    totalScore: number | null
    gradeId: string | null
  } | null
  cycleFinalEvaluations: Array<{
    targetId: string
    totalScore: number | null
  }>
  publicationStatus: ResultPublicationStatus
  auditLogs: Array<{
    action: string
    entityType: string
    entityId: string | null
    userId: string
    timestamp: Date
  }>
  aiCompetencyScore?: number
  actorId: string
  canExport: boolean
}) {
  const stageMap = new Map<EvalStage, EvaluationWithRelations>()
  for (const evaluation of params.evaluations) {
    stageMap.set(evaluation.evalStage, evaluation)
  }

  const finalEvaluation = params.finalEvaluation
  const finalStage = finalEvaluation?.evalStage ?? 'FINAL'
  const draftEvaluation = stageMap.get('FINAL') ?? stageMap.get('SECOND') ?? finalEvaluation ?? null
  const draftGrade = resolveGradeName(
    draftEvaluation?.gradeId ?? null,
    draftEvaluation?.totalScore ?? null,
    params.gradeSettings
  )
  let finalGrade = resolveGradeName(
    typeof params.aiCompetencyScore === 'number' ? null : finalEvaluation?.gradeId ?? null,
    finalEvaluation?.totalScore ?? null,
    params.gradeSettings
  )
  const calibrationAdjusted =
    Boolean(stageMap.get('CEO_ADJUST')) ||
    (Boolean(draftGrade) && Boolean(finalGrade) && draftGrade !== finalGrade)

  const itemMaps = {
    SELF: buildItemMap(stageMap.get('SELF')),
    FIRST: buildItemMap(stageMap.get('FIRST')),
    SECOND: buildItemMap(stageMap.get('SECOND')),
    FINAL: buildItemMap(stageMap.get('FINAL')),
    CEO_ADJUST: buildItemMap(stageMap.get('CEO_ADJUST')),
  }

  const scoreRows = params.personalKpis.map((personalKpi) => {
    const finalItem =
      itemMaps.CEO_ADJUST.get(personalKpi.id) ??
      itemMaps.FINAL.get(personalKpi.id) ??
      itemMaps.SECOND.get(personalKpi.id) ??
      itemMaps.FIRST.get(personalKpi.id) ??
      itemMaps.SELF.get(personalKpi.id)

    const selfScore = getDisplayScore(itemMaps.SELF.get(personalKpi.id))
    const managerScore = getDisplayScore(itemMaps.FIRST.get(personalKpi.id))
    const reviewerScore = getDisplayScore(itemMaps.SECOND.get(personalKpi.id))
    const finalScore = getDisplayScore(finalItem)

    return {
      id: personalKpi.id,
      title: personalKpi.kpiName,
      score: finalScore ?? 0,
      weight: personalKpi.weight,
      selfScore: selfScore ?? undefined,
      managerScore: managerScore ?? undefined,
      reviewerScore: reviewerScore ?? undefined,
      finalScore: finalScore ?? undefined,
      comment: finalItem?.itemComment ?? undefined,
      deltaFromSelf:
        selfScore !== null && finalScore !== null ? roundToSingle(finalScore - selfScore) : undefined,
      kpiType: personalKpi.kpiType,
    }
  })

  const performanceRows = scoreRows.filter((row) => row.kpiType === 'QUANTITATIVE')
  const competencyRows = scoreRows.filter((row) => row.kpiType === 'QUALITATIVE')
  const weightedPerformanceRows = toWeightedScoredRows(performanceRows)
  const weightedCompetencyRows = toWeightedScoredRows(competencyRows)
  const performanceScore = weightedAverage(weightedPerformanceRows)
  const competencyScore =
    typeof params.aiCompetencyScore === 'number' ? params.aiCompetencyScore : weightedAverage(weightedCompetencyRows)
  const totalScore = calculateEffectiveTotalScore({
    performanceRows: weightedPerformanceRows,
    competencyRows:
      typeof params.aiCompetencyScore === 'number'
        ? competencyRows.map((row) => ({
            score: params.aiCompetencyScore!,
            weight: row.weight,
          }))
        : weightedCompetencyRows,
    fallback:
      finalEvaluation?.totalScore ??
      weightedAverage([...weightedPerformanceRows, ...weightedCompetencyRows]) ??
      0,
  })
  finalGrade = resolveGradeName(
    typeof params.aiCompetencyScore === 'number' ? null : finalEvaluation?.gradeId ?? null,
    totalScore,
    params.gradeSettings
  )

  const previousGrade = resolveGradeName(
    params.previousEvaluation?.gradeId ?? null,
    params.previousEvaluation?.totalScore ?? null,
    params.gradeSettings
  )
  const previousScore = params.previousEvaluation?.totalScore ?? undefined
  const feedbacks = buildFeedbackSummary(params.evaluations, params.checkIns)
  const strengths = buildStrengths(
    performanceRows
      .filter((row): row is typeof row & { finalScore: number } => typeof row.finalScore === 'number')
      .map((row) => ({
        title: row.title,
        score: row.finalScore,
      })),
    (typeof params.aiCompetencyScore === 'number'
      ? competencyRows.map((row) => ({
          title: row.title,
          score: params.aiCompetencyScore!,
        }))
      : competencyRows
          .filter((row): row is typeof row & { finalScore: number } => typeof row.finalScore === 'number')
          .map((row) => ({
            title: row.title,
            score: row.finalScore,
          })))
  )
  const improvements = buildImprovements(
    performanceRows
      .filter((row): row is typeof row & { finalScore: number } => typeof row.finalScore === 'number')
      .map((row) => ({
        title: row.title,
        score: row.finalScore,
      })),
    (typeof params.aiCompetencyScore === 'number'
      ? competencyRows.map((row) => ({
          title: row.title,
          score: params.aiCompetencyScore!,
        }))
      : competencyRows
          .filter((row): row is typeof row & { finalScore: number } => typeof row.finalScore === 'number')
          .map((row) => ({
            title: row.title,
            score: row.finalScore,
          })))
  )
  const acknowledgedLog = params.auditLogs.find(
    (log) =>
      log.action === 'EVALUATION_RESULT_ACKNOWLEDGED' &&
      log.entityType === 'EvalCycle' &&
      log.entityId === params.cycle.id &&
      log.userId === params.employee.id
  )
  const canAcknowledge = params.actorId === params.employee.id
  const acknowledgeMessage = canAcknowledge
    ? undefined
    : '??곸옄 蹂몄씤留??됯? 寃곌낵瑜??뺤씤 ?꾨즺濡?泥섎━?????덉뒿?덈떎.'
  const evaluatorPreview =
    finalEvaluation?.comment ||
    feedbacks.find((feedback) => feedback.author !== '시스템')?.content ||
    '최종 코멘트가 아직 등록되지 않았습니다.'

  return {
    cycle: {
      id: params.cycle.id,
      name: params.cycle.cycleName,
      year: params.cycle.evalYear,
      status: params.publicationStatus,
      rawStatus: params.cycle.status,
      organizationName: params.cycle.organization.name,
      departmentScope: resolveDepartmentLabel(params.employee.department),
      publishedAt: params.cycle.resultOpenStart?.toISOString() ?? undefined,
      appealDeadline: params.cycle.appealDeadline?.toISOString() ?? undefined,
      confirmedAt: finalEvaluation?.submittedAt?.toISOString() ?? undefined,
    },
    employee: {
      id: params.employee.id,
      name: params.employee.empName,
      department: resolveDepartmentLabel(params.employee.department),
      title: resolvePositionLabel(params.employee.position),
    },
    summary: {
      acknowledged: Boolean(acknowledgedLog),
      acknowledgedAt: acknowledgedLog?.timestamp.toISOString(),
      finalGrade: finalGrade ?? '미확정',
      totalScore,
      performanceScore: performanceScore ?? 0,
      competencyScore: competencyScore ?? 0,
      calibrationAdjusted,
      previousGrade: previousGrade ?? undefined,
      previousScore,
      percentileLabel: buildPercentileLabel(params.cycleFinalEvaluations, params.employee.id, totalScore),
      deltaFromPrevious:
        previousScore !== undefined ? roundToSingle(totalScore - previousScore) : undefined,
    },
    overview: {
      achievementRate: calcOverallAchievementRate(params.personalKpis),
      completedCheckins: params.checkIns.filter((item) => item.status === 'COMPLETED').length,
      feedbackCount: feedbacks.length,
      evaluatorPreview,
      strengthsPreview: strengths.slice(0, 3),
      improvementsPreview: improvements.slice(0, 3),
      interpretation: buildInterpretation({
        performanceScore: performanceScore ?? 0,
        competencyScore: competencyScore ?? 0,
        calibrationAdjusted,
      }),
    },
    scoreBreakdown: {
      performance: performanceRows.map((row) => {
        const { kpiType, ...rest } = row
        void kpiType
        return rest
      }),
      competency: competencyRows.map((row) => {
        const { kpiType, ...rest } = row
        void kpiType
        return rest
      }),
    },
    evidence: {
      kpis: params.personalKpis.map((kpi) => {
        const latestRecord = [...kpi.monthlyRecords].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]
        return {
          id: kpi.id,
          title: kpi.kpiName,
          target: kpi.targetValue ?? undefined,
          actual: latestRecord?.actualValue ?? undefined,
          achievementRate: latestRecord?.achievementRate ?? undefined,
          unit: kpi.unit ?? undefined,
          status: kpi.status,
        }
      }),
      monthlyRecords: buildMonthlySummary(params.personalKpis),
      checkins: params.checkIns.map((item) => ({
        date: (item.actualDate ?? item.scheduledDate).toISOString(),
        type: item.checkInType,
        status: item.status,
        summary: item.keyTakeaways || item.managerNotes || item.ownerNotes || '체크인 요약이 아직 없습니다.',
        actionItems: parseActionItems(item.actionItems),
      })),
      feedbacks,
      attachments: buildAttachmentSummary(params.personalKpis),
      highlights: buildEvidenceHighlights({
        kpis: params.personalKpis,
        checkIns: params.checkIns,
        feedbacks,
        calibrationAdjusted,
      }),
    },
    calibration: {
      draftGrade: draftGrade ?? undefined,
      finalGrade: finalGrade ?? undefined,
      adjusted: calibrationAdjusted,
      reason: calibrationAdjusted
        ? finalEvaluation?.comment || '캘리브레이션 회의 결과가 최종 평가에 반영되었습니다.'
        : '조정 없이 최종 등급이 확정되었습니다.',
      logs: buildCalibrationLogs({
        employeeName: params.employee.empName,
        finalStage,
        finalGrade,
        draftGrade,
        finalEvaluation,
        cycle: params.cycle,
        publicationStatus: params.publicationStatus,
        calibrationAdjusted,
        appealLogs: params.evaluations.flatMap((evaluation) => evaluation.appeals),
        auditLogs: params.auditLogs,
      }),
    },
    growth: {
      strengths,
      improvements,
      actions: buildGrowthActions(improvements),
      discussionQuestions: buildDiscussionQuestions(improvements, strengths),
    },
    actions: {
      canAcknowledge,
      acknowledgeMessage,
      canExport: params.canExport,
      exportMessage: params.canExport ? undefined : '?꾩옱 ?곹깭?먯꽌??由ы룷?몃? ?ㅼ슫濡쒕뱶?????놁뒿?덈떎.',
    },
  } satisfies EvaluationResultViewModel
}

function resolvePublicationStatus(
  cycle: {
    status: CycleStatus
    appealDeadline: Date | null
  },
  hasConfirmedFinal: boolean
): ResultPublicationStatus {
  const now = new Date()

  if (cycle.status === 'APPEAL') {
    if (cycle.appealDeadline && cycle.appealDeadline < now) return 'APPEAL_CLOSED'
    return 'APPEAL_OPEN'
  }

  if (cycle.status === 'RESULT_OPEN' || cycle.status === 'CLOSED') {
    if (cycle.appealDeadline && cycle.appealDeadline < now) return 'APPEAL_CLOSED'
    return 'PUBLISHED'
  }

  if (hasConfirmedFinal) {
    if (cycle.appealDeadline && cycle.appealDeadline >= now) return 'APPEAL_OPEN'
    return 'PUBLISHED'
  }

  return 'HIDDEN'
}

function resolveGradeName(
  gradeId: string | null,
  totalScore: number | null,
  gradeSettings: GradeSettingLite[]
) {
  if (gradeId) {
    const matched = gradeSettings.find((grade) => grade.id === gradeId)
    if (matched) return matched.gradeName
  }
  if (totalScore === null) return null

  return (
    gradeSettings.find((grade) => totalScore >= grade.minScore && totalScore <= grade.maxScore)?.gradeName ??
    null
  )
}

function buildItemMap(evaluation: EvaluationWithRelations | undefined) {
  return new Map((evaluation?.items ?? []).map((item) => [item.personalKpiId, item] as const))
}

function getDisplayScore(
  item:
    | {
        quantScore: number | null
        planScore: number | null
        doScore: number | null
        checkScore: number | null
        actScore: number | null
        qualScore: number | null
        weightedScore: number | null
        personalKpi: {
          weight: number
        }
      }
    | undefined
) {
  if (!item) return null
  if (item.quantScore !== null) return roundToSingle(item.quantScore)
  if (item.qualScore !== null) return roundToSingle(item.qualScore)

  const pdcaScores = [item.planScore, item.doScore, item.checkScore, item.actScore]
  if (pdcaScores.some((score) => score !== null)) {
    return roundToSingle(
      calcPdcaScore(item.planScore ?? 0, item.doScore ?? 0, item.checkScore ?? 0, item.actScore ?? 0)
    )
  }

  if (item.weightedScore !== null && item.personalKpi.weight > 0) {
    return roundToSingle((item.weightedScore * 100) / item.personalKpi.weight)
  }

  return null
}

function calcOverallAchievementRate(personalKpis: PersonalKpiWithRecords[]) {
  const values = personalKpis
    .map((kpi) => [...kpi.monthlyRecords].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]?.achievementRate)
    .filter((value): value is number => typeof value === 'number')

  if (!values.length) return 0
  return roundToSingle(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function buildMonthlySummary(personalKpis: PersonalKpiWithRecords[]) {
  const monthMap = new Map<string, { month: string; achievementRates: number[]; comments: string[] }>()

  for (const kpi of personalKpis) {
    for (const record of kpi.monthlyRecords) {
      const entry = monthMap.get(record.yearMonth) ?? {
        month: record.yearMonth,
        achievementRates: [],
        comments: [],
      }

      if (typeof record.achievementRate === 'number') entry.achievementRates.push(record.achievementRate)

      const comment = record.activities || record.obstacles || record.efforts
      if (comment) entry.comments.push(comment)

      monthMap.set(record.yearMonth, entry)
    }
  }

  return [...monthMap.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 6)
    .map((entry) => ({
      month: entry.month,
      achievementRate:
        entry.achievementRates.length > 0
          ? roundToSingle(entry.achievementRates.reduce((sum, value) => sum + value, 0) / entry.achievementRates.length)
          : undefined,
      comment: entry.comments[0] ?? undefined,
    }))
}

function buildFeedbackSummary(
  evaluations: EvaluationWithRelations[],
  checkIns: Array<{
    scheduledDate: Date
    actualDate: Date | null
    keyTakeaways: string | null
    ownerNotes: string | null
    managerNotes: string | null
  }>
) {
  const evaluationFeedback = evaluations
    .filter((evaluation) => Boolean(evaluation.comment))
    .map((evaluation) => ({
      date: (evaluation.submittedAt ?? evaluation.updatedAt ?? evaluation.createdAt).toISOString(),
      author: evaluation.evaluator.empName,
      content: evaluation.comment as string,
    }))

  const checkinFeedback = checkIns
    .filter((checkin) => Boolean(checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes))
    .map((checkin) => ({
      date: (checkin.actualDate ?? checkin.scheduledDate).toISOString(),
      author: '1:1 체크인',
      content: checkin.keyTakeaways || checkin.managerNotes || checkin.ownerNotes || '',
    }))

  return [...evaluationFeedback, ...checkinFeedback]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
}

function buildAttachmentSummary(personalKpis: PersonalKpiWithRecords[]) {
  const attachments: Array<{ label: string; source: string }> = []

  for (const kpi of personalKpis) {
    for (const record of kpi.monthlyRecords) {
      if (!Array.isArray(record.attachments)) continue

      record.attachments.forEach((item, index) => {
        attachments.push({
          label:
            typeof item === 'string'
              ? item
              : typeof item === 'object' && item && 'name' in item
                ? String(item.name)
                : `${kpi.kpiName} 첨부 ${index + 1}`,
          source: `${record.yearMonth} / ${kpi.kpiName}`,
        })
      })
    }
  }

  return attachments.slice(0, 8)
}

function buildEvidenceHighlights(params: {
  kpis: PersonalKpiWithRecords[]
  checkIns: Array<{
    status: CheckInStatus
    actualDate: Date | null
    scheduledDate: Date
    keyTakeaways: string | null
  }>
  feedbacks: Array<{
    content: string
  }>
  calibrationAdjusted: boolean
}) {
  const topKpi = params.kpis
    .map((kpi) => ({
      title: kpi.kpiName,
      latest: [...kpi.monthlyRecords].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0],
    }))
    .filter((item) => typeof item.latest?.achievementRate === 'number')
    .sort((a, b) => (b.latest?.achievementRate ?? 0) - (a.latest?.achievementRate ?? 0))[0]

  const recentCheckin = params.checkIns
    .filter((item) => item.status === 'COMPLETED')
    .sort(
      (a, b) =>
        (b.actualDate ?? b.scheduledDate).getTime() - (a.actualDate ?? a.scheduledDate).getTime()
    )[0]

  const highlights: Array<{
    title: string
    summary: string
    tone: 'positive' | 'neutral' | 'attention'
  }> = []

  if (topKpi?.latest) {
    highlights.push({
      title: '가장 큰 성과 기여 KPI',
      summary: `${topKpi.title}가 최근 ${roundToSingle(topKpi.latest.achievementRate ?? 0)}% 달성률을 기록했습니다.`,
      tone: 'positive',
    })
  }

  if (recentCheckin) {
    highlights.push({
      title: '최근 체크인 주요 포인트',
      summary: recentCheckin.keyTakeaways || '최근 체크인에서 성과 진행상황과 리스크가 논의되었습니다.',
      tone: 'neutral',
    })
  }

  if (params.feedbacks[0]) {
    highlights.push({
      title: params.calibrationAdjusted ? '조정에 반영된 코멘트' : '최근 평가 코멘트',
      summary: params.feedbacks[0].content,
      tone: params.calibrationAdjusted ? 'attention' : 'neutral',
    })
  }

  while (highlights.length < 3) {
    highlights.push({
      title: '추가 근거',
      summary: '월간 실적, 체크인 기록, 평가 코멘트가 결과 해석의 근거로 함께 반영됩니다.',
      tone: 'neutral',
    })
  }

  return highlights.slice(0, 3)
}

function buildStrengths(
  performanceRows: Array<{ title: string; score: number }>,
  competencyRows: Array<{ title: string; score: number }>
) {
  const ranked = [...performanceRows, ...competencyRows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.title)

  return ranked.length ? ranked : ['목표 실행력', '성과 추적 습관', '협업 커뮤니케이션']
}

function buildImprovements(
  performanceRows: Array<{ title: string; score: number }>,
  competencyRows: Array<{ title: string; score: number }>
) {
  const source = competencyRows.length ? competencyRows : [...performanceRows, ...competencyRows]
  const ranked = [...source]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((row) => row.title)

  return ranked.length ? ranked : ['우선순위 정렬', '피드백 반영 속도', '협업 리더십']
}

function buildGrowthActions(improvements: string[]) {
  return improvements.slice(0, 3).map((item, index) => {
    if (index === 0) return `${item}와 관련된 실행 사례를 다음 월간 체크인에서 1건 이상 공유하세요.`
    if (index === 1) return `${item} 향상을 위한 구체적 행동 목표를 다음 반기 KPI와 연결해 보세요.`
    return `${item}에 대한 피드백을 평가권자와 1:1에서 확인하고 보완 계획을 합의하세요.`
  })
}

function buildDiscussionQuestions(improvements: string[], strengths: string[]) {
  return [
    `${improvements[0] ?? '보완 역량'}을 개선하기 위해 다음 분기에 가장 먼저 바꿔야 할 일은 무엇인가요?`,
    `${strengths[0] ?? '강점'}을 팀 전체 성과로 확장하려면 어떤 지원이 필요할까요?`,
    '평가권자와의 1:1에서 확인하고 싶은 기준이나 기대치가 더 있나요?',
  ]
}

function buildInterpretation(params: {
  performanceScore: number
  competencyScore: number
  calibrationAdjusted: boolean
}) {
  if (params.performanceScore >= 90 && params.competencyScore >= 85) {
    return params.calibrationAdjusted
      ? '성과와 역량이 모두 안정적으로 높은 수준이며, 조직 간 형평성을 반영한 캘리브레이션이 최종 결과에 반영되었습니다.'
      : '성과 달성과 역량 모두 강하게 나타나며, 현재 역할에서 기대 이상의 안정적인 결과를 보여주고 있습니다.'
  }

  if (params.performanceScore > params.competencyScore + 6) {
    return '성과 달성은 높았지만 협업, 리더십, 실행 과정의 역량 요소는 추가 보완이 필요합니다.'
  }

  if (params.competencyScore > params.performanceScore + 6) {
    return '역량 기반 잠재력은 높게 평가되었지만, 목표 수치 달성 측면에서는 더 분명한 실행 결과가 필요합니다.'
  }

  return '성과와 역량이 전반적으로 균형을 이루고 있으며, 다음 반기에는 강점 유지와 핵심 개선 포인트의 집중 보완이 중요합니다.'
}

function buildPercentileLabel(
  evaluations: Array<{ targetId: string; totalScore: number | null }>,
  employeeId: string,
  totalScore: number
) {
  const scores = evaluations
    .map((item) => ({
      targetId: item.targetId,
      score: item.totalScore ?? 0,
    }))
    .sort((a, b) => b.score - a.score)

  if (!scores.length) return undefined

  const index = scores.findIndex((item) => item.targetId === employeeId || item.score === totalScore)
  if (index < 0) return undefined

  return `상위 ${Math.max(1, Math.round(((index + 1) / scores.length) * 100))}%`
}

function buildCalibrationLogs(params: {
  employeeName: string
  finalStage: EvalStage
  draftGrade: string | null
  finalGrade: string | null
  finalEvaluation: EvaluationWithRelations | null
  cycle: {
    cycleName: string
    resultOpenStart: Date | null
  }
  publicationStatus: ResultPublicationStatus
  calibrationAdjusted: boolean
  appealLogs: Array<{
    status: AppealStatus
    createdAt: Date
    resolvedAt: Date | null
    reason: string
    adminResponse: string | null
  }>
  auditLogs: Array<{
    action: string
    userId: string
    timestamp: Date
  }>
}) {
  const logs: Array<{
    date: string
    actor: string
    action: string
    detail?: string
  }> = []

  if (params.finalEvaluation?.submittedAt) {
    logs.push({
      date: params.finalEvaluation.submittedAt.toISOString(),
      actor: params.finalEvaluation.evaluator.empName,
      action: params.finalStage === 'CEO_ADJUST' ? '캘리브레이션 반영' : '최종 평가 제출',
      detail: params.calibrationAdjusted
        ? `${params.draftGrade ?? '초안'} → ${params.finalGrade ?? '최종'}로 확정`
        : `${params.finalGrade ?? '최종'} 등급으로 확정`,
    })
  }

  if (params.cycle.resultOpenStart) {
    logs.push({
      date: params.cycle.resultOpenStart.toISOString(),
      actor: params.cycle.cycleName,
      action: '결과 공개',
      detail:
        params.publicationStatus === 'APPEAL_OPEN'
          ? '이의 신청이 가능한 상태로 공개되었습니다.'
          : '최종 결과가 공개되었습니다.',
    })
  }

  for (const appeal of params.appealLogs) {
    logs.push({
      date: appeal.createdAt.toISOString(),
      actor: params.employeeName,
      action: '이의 신청 등록',
      detail: appeal.reason,
    })

    if (appeal.resolvedAt) {
      logs.push({
        date: appeal.resolvedAt.toISOString(),
        actor: '운영자',
        action: `이의 신청 ${appeal.status === 'ACCEPTED' ? '수용' : '처리 완료'}`,
        detail: appeal.adminResponse ?? undefined,
      })
    }
  }

  for (const auditLog of params.auditLogs.slice(0, 6)) {
    logs.push({
      date: auditLog.timestamp.toISOString(),
      actor: auditLog.userId,
      action: auditLog.action,
    })
  }

  if (!logs.length) {
    logs.push({
      date: new Date().toISOString(),
      actor: '시스템',
      action: '조정 없음',
      detail: '캘리브레이션 조정 기록이 없어 원안 기준으로 결과가 공개되었습니다.',
    })
  }

  return logs.sort((a, b) => b.date.localeCompare(a.date))
}

function parseActionItems(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'title' in item) return String(item.title)
      return null
    })
    .filter((item): item is string => Boolean(item))
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
