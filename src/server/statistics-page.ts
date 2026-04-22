import type {
  AIRequestType,
  AiCompetencyCertificationStatus,
  EvalStage,
  EvalStatus,
  Position,
  Prisma,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { buildEvaluationAssistEvidenceView } from '@/lib/evaluation-ai-assist'
import {
  getEvaluationPerformanceBriefingAlignmentLabel,
  normalizeEvaluationPerformanceBriefingSnapshot,
  type EvaluationPerformanceBriefingAlignmentStatus,
} from '@/lib/evaluation-performance-briefing'
import { prisma } from '@/lib/prisma'
import { POSITION_LABELS } from '@/lib/utils'
import { buildEvaluationQualityWarnings } from '@/lib/evaluation-writing-guide'
import { getDescendantDeptIds } from '@/server/auth/org-scope'
import {
  buildStatisticsStageFlow,
  parseStatisticsPeriod,
  pickBaselineEvaluationOutcome,
  pickEffectiveEvaluationOutcome,
  summarizeStatisticsAiAlignment,
  type StatisticsAlignmentSummary,
  type StatisticsPeriod,
} from '@/server/statistics-helpers'

export type StatisticsPageState = 'ready' | 'empty' | 'permission-denied' | 'error'
export type StatisticsSectionState = 'ready' | 'empty' | 'error'
export type StatisticsTone = 'success' | 'warn' | 'error' | 'neutral'

export type StatisticsMetricCard = {
  label: string
  value: string
  description: string
  tone: StatisticsTone
  href?: string
}

export type StatisticsPageAlert = {
  title: string
  description: string
  tone: StatisticsTone
}

type StatisticsSectionBase = {
  state?: StatisticsSectionState
  message?: string
}

type StatisticsEvaluationOperationsSection = StatisticsSectionBase & {
  progressRate?: number
  finalizedRate?: number
  stageStatus: Array<{
    stage: EvalStage
    label: string
    pending: number
    inProgress: number
    submitted: number
    rejected: number
    confirmed: number
  }>
  exceptionCards: StatisticsMetricCard[]
  departmentRows: Array<{
    departmentId: string
    departmentName: string
    targetCount: number
    progressRate: number
    returnedCount: number
    overdueCount: number
    finalizedCount: number
    filterHref: string
    detailHref: string
  }>
}

type StatisticsPerformanceDistributionSection = StatisticsSectionBase & {
  outlierDepartmentCount?: number
  missingAdjustmentReasonCount?: number
  cards: StatisticsMetricCard[]
  companyDistribution: Array<{
    grade: string
    count: number
    ratio: number
  }>
  beforeAfterDistribution: Array<{
    grade: string
    before: number
    after: number
  }>
  departmentRows: Array<{
    departmentId: string
    departmentName: string
    averageScore?: number
    highGradeRatio: number
    lowGradeRatio: number
    adjustedRate: number
    isOutlier: boolean
    href: string
  }>
  notice?: string
}

type StatisticsKpiExecutionSection = StatisticsSectionBase & {
  averageAchievementRate?: number
  trend: Array<{ label: string; value: number }>
  cards: StatisticsMetricCard[]
  departmentRows: Array<{
    departmentId: string
    departmentName: string
    activeEmployeeCount: number
    personalGoalSetupRate: number
    alignmentRate: number
    completedCheckInRate: number
    averageProgressRate: number
    riskCount: number
    href: string
  }>
  exceptions: Array<{
    departmentId: string
    departmentName: string
    averageProgressRate: number
    riskCount: number
    href: string
  }>
}

type StatisticsOrganizationRiskSection = StatisticsSectionBase & {
  riskDepartmentCount?: number
  cards: StatisticsMetricCard[]
  departmentRows: Array<{
    departmentId: string
    departmentName: string
    lowAchievementCount: number
    missingEvidenceCount: number
    rejectedEvaluationCount: number
    activeAppealCount: number
    riskScore: number
    href: string
  }>
}

type StatisticsReadinessProxySection = StatisticsSectionBase & {
  notice: string
  readyTalentCount?: number
  cards: StatisticsMetricCard[]
  trackDistribution: Array<{
    label: string
    averageScore: number
    count: number
    passRate: number
  }>
  departmentRows: Array<{
    departmentName: string
    averageScore: number
    count: number
  }>
  feederPool: Array<{
    positionLabel: string
    count: number
  }>
  href: string
}

type StatisticsFairnessSection = StatisticsSectionBase & {
  warningCount?: number
  cards: StatisticsMetricCard[]
  alignmentDistribution: Array<{
    label: string
    count: number
  }>
  qualityWarnings: Array<{
    label: string
    count: number
  }>
  coverageLabel: string
  notice?: string
  detailHref: string
}

export type StatisticsPageData = {
  state: StatisticsPageState
  message?: string
  alerts: StatisticsPageAlert[]
  generatedAt: string
  actor?: {
    name: string
    role: SystemRole
    departmentName: string
    organizationName: string
  }
  filters: {
    selectedCycleId?: string
    selectedPeriod: StatisticsPeriod
    selectedOrgId?: string
    selectedDepartmentId: string
    selectedPosition: 'ALL' | Position
    periodOptions: Array<{ value: StatisticsPeriod; label: string }>
    cycleOptions: Array<{ id: string; label: string; year: number; status: string }>
    orgOptions: Array<{ id: string; name: string }>
    departmentOptions: Array<{ id: string; name: string; level: number }>
    positionOptions: Array<{ value: 'ALL' | Position; label: string }>
    showOrgFilter: boolean
  }
  selectedCycle?: {
    id: string
    label: string
    year: number
    organizationName: string
  }
  summaryCards: StatisticsMetricCard[]
  sections?: {
    evaluationOperations: StatisticsEvaluationOperationsSection
    performanceDistribution: StatisticsPerformanceDistributionSection
    kpiExecution: StatisticsKpiExecutionSection
    organizationRisk: StatisticsOrganizationRiskSection
    readinessProxy: StatisticsReadinessProxySection
    fairness: StatisticsFairnessSection
  }
}

type StatisticsSearchParams = {
  cycleId?: string
  period?: string
  orgId?: string
  departmentId?: string
  position?: string
}

type StatisticsSessionUser = NonNullable<Session['user']> & {
  id: string
  role: SystemRole
}

const PERIOD_OPTIONS: StatisticsPageData['filters']['periodOptions'] = [
  { value: '6m', label: '최근 6개월' },
  { value: '12m', label: '최근 12개월' },
  { value: 'ytd', label: '해당 연도' },
]

const STAGE_LABELS: Record<EvalStage, string> = {
  SELF: '자기평가',
  FIRST: '1차 팀장평가',
  SECOND: '2차 상위검토',
  FINAL: '본부장 검토',
  CEO_ADJUST: '대표이사 확정',
}

const POSITION_ORDER: Position[] = ['MEMBER', 'TEAM_LEADER', 'SECTION_CHIEF', 'DIV_HEAD', 'CEO']

type StatisticsDepartmentLite = {
  id: string
  deptName: string
  deptCode: string
  parentDeptId: string | null
  orgId: string
}

async function loadStatisticsEvaluations(cycleId: string, targetIds: string[]) {
  if (!targetIds.length) return []

  return prisma.evaluation.findMany({
    where: {
      evalCycleId: cycleId,
      targetId: { in: targetIds },
      evalStage: {
        in: ['SELF', 'FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
      },
    },
    include: {
      target: {
        select: {
          id: true,
          deptId: true,
          empName: true,
          position: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
      items: {
        include: {
          personalKpi: {
            include: {
              linkedOrgKpi: {
                include: {
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                },
              },
              monthlyRecords: {
                orderBy: { yearMonth: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: [{ targetId: 'asc' }, { evalStage: 'asc' }, { updatedAt: 'desc' }],
  })
}

async function loadStatisticsAssignments(cycleId: string, targetIds: string[]) {
  if (!targetIds.length) return []

  return prisma.evaluationAssignment.findMany({
    where: {
      evalCycleId: cycleId,
      targetId: { in: targetIds },
      evalStage: {
        in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
      },
    },
    include: {
      evaluator: {
        select: {
          id: true,
          empName: true,
          role: true,
          position: true,
          status: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
    },
  })
}

async function loadStatisticsMonthlyRecords(
  employeeIds: string[],
  periodStartYearMonth: string,
  periodEndYearMonth: string
) {
  if (!employeeIds.length) return []

  return prisma.monthlyRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      yearMonth: {
        gte: periodStartYearMonth,
        lte: periodEndYearMonth,
      },
    },
    select: {
      id: true,
      employeeId: true,
      personalKpiId: true,
      yearMonth: true,
      achievementRate: true,
      obstacles: true,
      attachments: true,
      personalKpi: {
        select: {
          id: true,
          kpiName: true,
          employeeId: true,
          linkedOrgKpiId: true,
          employee: {
            select: {
              deptId: true,
            },
          },
        },
      },
    },
    orderBy: [{ yearMonth: 'asc' }],
  })
}

async function loadStatisticsPersonalKpis(employeeIds: string[], evalYear: number) {
  if (!employeeIds.length) return []

  return prisma.personalKpi.findMany({
    where: {
      employeeId: { in: employeeIds },
      evalYear,
      status: {
        not: 'ARCHIVED',
      },
    },
    select: {
      id: true,
      employeeId: true,
      linkedOrgKpiId: true,
      status: true,
      employee: {
        select: {
          deptId: true,
        },
      },
    },
  })
}

async function loadStatisticsOrgKpis(departmentIds: string[], evalYear: number) {
  if (!departmentIds.length) return []

  return prisma.orgKpi.findMany({
    where: {
      deptId: { in: departmentIds },
      evalYear,
      status: {
        not: 'ARCHIVED',
      },
    },
    select: {
      id: true,
      deptId: true,
      parentOrgKpiId: true,
      status: true,
    },
  })
}

async function loadStatisticsCheckIns(employeeIds: string[], startDate: Date, endDate: Date) {
  if (!employeeIds.length) return []

  return prisma.checkIn.findMany({
    where: {
      ownerId: { in: employeeIds },
      scheduledDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      ownerId: true,
      status: true,
    },
  })
}

async function loadStatisticsAppeals(cycleId: string, targetIds: string[]) {
  if (!targetIds.length) return []

  return prisma.appeal.findMany({
    where: {
      evaluation: {
        evalCycleId: cycleId,
        targetId: { in: targetIds },
      },
    },
    select: {
      id: true,
      status: true,
      evaluation: {
        select: {
          targetId: true,
          target: {
            select: {
              deptId: true,
              department: {
                select: {
                  deptName: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

type StatisticsEvaluationRecord = Awaited<ReturnType<typeof loadStatisticsEvaluations>>[number]
type StatisticsAssignmentRecord = Awaited<ReturnType<typeof loadStatisticsAssignments>>[number]
type StatisticsMonthlyRecord = Awaited<ReturnType<typeof loadStatisticsMonthlyRecords>>[number]
type StatisticsPersonalKpi = Awaited<ReturnType<typeof loadStatisticsPersonalKpis>>[number]
type StatisticsOrgKpi = Awaited<ReturnType<typeof loadStatisticsOrgKpis>>[number]
type StatisticsCheckIn = Awaited<ReturnType<typeof loadStatisticsCheckIns>>[number]
type StatisticsAppeal = Awaited<ReturnType<typeof loadStatisticsAppeals>>[number]

type StatisticsEmployeeScope = {
  id: string
  empName: string
  deptId: string
  position: Position
  role: SystemRole
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
  department: {
    deptName: string
  }
}

type StatisticsStageEntry = {
  stage: EvalStage
  status: EvalStatus
  evaluationId: string | null
  dueAt: Date | null
  isCompleted: boolean
}

type StatisticsActorSummary = NonNullable<StatisticsPageData['actor']>
type StatisticsCycleSummary = NonNullable<StatisticsPageData['selectedCycle']>

type StatisticsEvaluationOutcomeRow = {
  employee: StatisticsEmployeeScope
  evaluation: StatisticsEvaluationRecord
  baseline: StatisticsEvaluationRecord | null
}

type StatisticsEvaluationDomainData = {
  gradeSettings: ReturnType<typeof ensureGradeSettings>
  evaluations: StatisticsEvaluationRecord[]
  assignments: StatisticsAssignmentRecord[]
  evaluationsByTarget: Map<string, StatisticsEvaluationRecord[]>
  assignmentsByTarget: Map<string, StatisticsAssignmentRecord[]>
  evaluationStageMatrix: ReturnType<typeof buildEvaluationStageMatrix>
  effectiveOutcomeRows: StatisticsEvaluationOutcomeRow[]
}

type StatisticsKpiDomainData = {
  personalKpis: StatisticsPersonalKpi[]
  orgKpis: StatisticsOrgKpi[]
  monthlyRecords: StatisticsMonthlyRecord[]
  checkIns: StatisticsCheckIn[]
  latestMonthlyByKpi: Map<string, StatisticsMonthlyRecord>
}

type StatisticsLoadResult<T> = {
  state: 'ready' | 'error'
  data: T
  message?: string
}

type StatisticsDebugContext = {
  actorId: string
  role: SystemRole
  cycleId?: string
  period: StatisticsPeriod
  orgId?: string
  departmentId: string
  position: 'ALL' | Position
}

export async function getStatisticsPageData(
  session: Session,
  searchParams: StatisticsSearchParams = {}
): Promise<StatisticsPageData> {
  const alerts: StatisticsPageAlert[] = []
  const generatedAt = new Date().toISOString()
  const sessionUser = session.user as StatisticsSessionUser | undefined
  const requestedPeriod = parseStatisticsPeriod(searchParams.period)

  if (!sessionUser?.id || !sessionUser.role) {
    return {
      state: 'permission-denied',
      message: '통계 페이지에 접근할 권한이 없습니다.',
      alerts,
      generatedAt,
      filters: buildEmptyFilterState(),
      summaryCards: [],
    }
  }

  if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(sessionUser.role)) {
    return {
      state: 'permission-denied',
      message: '통계 페이지는 CEO 또는 관리자만 볼 수 있습니다.',
      alerts,
      generatedAt,
      filters: buildEmptyFilterState(),
      summaryCards: [],
    }
  }

  let actorSummary: StatisticsActorSummary | undefined
  let filters = buildEmptyFilterState()
  let selectedCycleSummary: StatisticsCycleSummary | undefined

  try {
    const actor = await prisma.employee.findUnique({
      where: { id: sessionUser.id },
      include: {
        department: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!actor) {
      return {
        state: 'permission-denied',
        message: '사용자 조직 정보를 찾을 수 없어 통계를 불러올 수 없습니다.',
        alerts,
        generatedAt,
        filters: buildEmptyFilterState(),
        summaryCards: [],
      }
    }

    actorSummary = {
      name: actor.empName,
      role: actor.role,
      departmentName: actor.department.deptName,
      organizationName: actor.department.organization.name,
    }

    const organizationOptions =
      sessionUser.role === 'ROLE_ADMIN'
        ? await prisma.organization.findMany({
            select: {
              id: true,
              name: true,
            },
            orderBy: {
              name: 'asc',
            },
          })
        : [
            {
              id: actor.department.orgId,
              name: actor.department.organization.name,
            },
          ]

    const selectedOrgId = resolveSelectedOrgId({
      actorOrgId: actor.department.orgId,
      requestedOrgId: searchParams.orgId,
      orgOptions: organizationOptions,
    })

    const [cycles, departments] = await Promise.all([
      prisma.evalCycle.findMany({
        where: {
          orgId: selectedOrgId,
        },
        include: {
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.department.findMany({
        where: {
          orgId: selectedOrgId,
        },
        select: {
          id: true,
          deptName: true,
          deptCode: true,
          parentDeptId: true,
          orgId: true,
        },
        orderBy: [{ deptCode: 'asc' }, { deptName: 'asc' }],
      }),
    ])

    filters = buildFilterState({
      cycles,
      orgOptions: organizationOptions,
      departments,
      selectedOrgId,
      selectedCycleId: undefined,
      selectedDepartmentId: 'ALL',
      selectedPeriod: requestedPeriod,
      selectedPosition: 'ALL',
      positionOptions: [{ value: 'ALL', label: '전체 직위' }],
      actorRole: sessionUser.role,
    })

    if (!cycles.length) {
      return {
        state: 'empty',
        message: '표시할 평가 주기가 없습니다.',
        alerts,
        generatedAt,
        actor: actorSummary,
        filters,
        summaryCards: [],
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === searchParams.cycleId) ??
      cycles.find((cycle) => cycle.status !== 'SETUP') ??
      cycles[0]

    const selectedDepartmentId = resolveSelectedDepartmentId({
      requestedDepartmentId: searchParams.departmentId,
      departments,
    })
    const scopedDepartmentIds =
      selectedDepartmentId === 'ALL'
        ? departments.map((department) => department.id)
        : [selectedDepartmentId, ...getDescendantDeptIds(selectedDepartmentId, departments)]

    const allScopeEmployees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        deptId: {
          in: scopedDepartmentIds,
        },
      },
      select: {
        id: true,
        empName: true,
        deptId: true,
        position: true,
        role: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
        department: {
          select: {
            deptName: true,
          },
        },
      },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    })

    const positionOptions = buildPositionOptions(allScopeEmployees)
    const selectedPosition = resolveSelectedPosition(searchParams.position, positionOptions)
    const scopedEmployees =
      selectedPosition === 'ALL'
        ? allScopeEmployees
        : allScopeEmployees.filter((employee) => employee.position === selectedPosition)

    filters = buildFilterState({
      cycles,
      orgOptions: organizationOptions,
      departments,
      selectedOrgId,
      selectedCycleId: selectedCycle.id,
      selectedDepartmentId,
      selectedPeriod: requestedPeriod,
      selectedPosition,
      positionOptions,
      actorRole: sessionUser.role,
    })
    selectedCycleSummary = {
      id: selectedCycle.id,
      label: `${selectedCycle.evalYear} ${selectedCycle.cycleName}`,
      year: selectedCycle.evalYear,
      organizationName: selectedCycle.organization.name,
    }

    appendNormalizedFilterAlerts({
      alerts,
      searchParams,
      filters,
      selectedCycleId: selectedCycle.id,
    })

    if (!scopedEmployees.length) {
      return {
        state: 'empty',
        message: '선택한 조건에 해당하는 인원이 없습니다.',
        alerts,
        generatedAt,
        actor: actorSummary,
        filters,
        selectedCycle: selectedCycleSummary,
        summaryCards: [],
      }
    }

    const periodRange = getStatisticsPeriodRange({
      period: filters.selectedPeriod,
      cycleYear: selectedCycle.evalYear,
      referenceDate:
        selectedCycle.ceoAdjustEnd ??
        selectedCycle.finalEvalEnd ??
        selectedCycle.secondEvalEnd ??
        selectedCycle.firstEvalEnd ??
        new Date(`${selectedCycle.evalYear}-12-31T23:59:59.999Z`),
    })
    const employeeIds = scopedEmployees.map((employee) => employee.id)
    const debugContext: StatisticsDebugContext = {
      actorId: sessionUser.id,
      role: sessionUser.role,
      cycleId: selectedCycle.id,
      period: filters.selectedPeriod,
      orgId: selectedOrgId,
      departmentId: selectedDepartmentId,
      position: selectedPosition,
    }

    const [evaluationDomain, kpiDomain, appealDomain] = await Promise.all([
      loadStatisticsResource({
        key: 'evaluation-domain',
        title: '성과평가 통계를 일부 불러오지 못했습니다.',
        description: '평가 진행과 분포는 가능한 범위의 데이터만 표시합니다.',
        message: '성과평가 데이터를 불러오지 못했습니다.',
        alerts,
        context: debugContext,
        fallback: buildEmptyEvaluationDomainData(),
        loader: async () => {
          const [gradeSettings, evaluations, assignments] = await Promise.all([
            prisma.gradeSetting.findMany({
              where: {
                orgId: selectedOrgId,
                evalYear: selectedCycle.evalYear,
                isActive: true,
              },
              select: {
                id: true,
                gradeName: true,
                minScore: true,
                maxScore: true,
                targetDistRate: true,
                gradeOrder: true,
              },
              orderBy: {
                gradeOrder: 'asc',
              },
            }),
            loadStatisticsEvaluations(selectedCycle.id, employeeIds),
            loadStatisticsAssignments(selectedCycle.id, employeeIds),
          ])

          const evaluationsByTarget = groupBy(evaluations, (evaluation) => evaluation.targetId)
          const assignmentsByTarget = groupBy(assignments, (assignment) => assignment.targetId)
          const evaluationStageMatrix = buildEvaluationStageMatrix({
            cycle: selectedCycle,
            employees: scopedEmployees,
            evaluationsByTarget,
            assignmentsByTarget,
          })
          const effectiveOutcomeRows = scopedEmployees.reduce<StatisticsEvaluationOutcomeRow[]>((rows, employee) => {
            const evaluation = pickEffectiveEvaluationOutcome(evaluationsByTarget.get(employee.id) ?? [])
            if (!evaluation) {
              return rows
            }

            rows.push({
              employee,
              evaluation,
              baseline: pickBaselineEvaluationOutcome(evaluationsByTarget.get(employee.id) ?? []),
            })
            return rows
          }, [])

          return {
            gradeSettings: ensureGradeSettings(gradeSettings),
            evaluations,
            assignments,
            evaluationsByTarget,
            assignmentsByTarget,
            evaluationStageMatrix,
            effectiveOutcomeRows,
          }
        },
      }),
      loadStatisticsResource({
        key: 'kpi-domain',
        title: 'KPI 실행 통계를 일부 불러오지 못했습니다.',
        description: '목표 정렬과 월간 기록은 가능한 범위의 데이터만 표시합니다.',
        message: 'KPI 데이터를 불러오지 못했습니다.',
        alerts,
        context: debugContext,
        fallback: buildEmptyKpiDomainData(),
        loader: async () => {
          const [personalKpis, orgKpis, monthlyRecords, checkIns] = await Promise.all([
            loadStatisticsPersonalKpis(employeeIds, selectedCycle.evalYear),
            loadStatisticsOrgKpis(scopedDepartmentIds, selectedCycle.evalYear),
            loadStatisticsMonthlyRecords(employeeIds, periodRange.startYearMonth, periodRange.endYearMonth),
            loadStatisticsCheckIns(employeeIds, periodRange.startDate, periodRange.endDate),
          ])

          return {
            personalKpis,
            orgKpis,
            monthlyRecords,
            checkIns,
            latestMonthlyByKpi: buildLatestMonthlyRecordMap(monthlyRecords),
          }
        },
      }),
      loadStatisticsResource({
        key: 'appeal-domain',
        title: '조직 리스크 통계를 일부 불러오지 못했습니다.',
        description: '이의제기와 리스크 예외는 가능한 범위의 데이터만 표시합니다.',
        message: '리스크 데이터를 불러오지 못했습니다.',
        alerts,
        context: debugContext,
        fallback: { appeals: [] },
        loader: async () => ({
          appeals: await loadStatisticsAppeals(selectedCycle.id, employeeIds),
        }),
      }),
    ])

    const evaluationOperations =
      evaluationDomain.state === 'error'
        ? buildEvaluationOperationsSection('error', evaluationDomain.message)
        : !evaluationDomain.data.evaluations.length && !evaluationDomain.data.assignments.length
          ? buildEvaluationOperationsSection('empty', '선택한 조건의 성과평가 진행 데이터가 아직 없습니다.')
          : buildEvaluationOperationsSection('ready', undefined, {
              progressRate: evaluationDomain.data.evaluationStageMatrix.progressRate,
              finalizedRate: evaluationDomain.data.evaluationStageMatrix.finalizedRate,
              stageStatus: evaluationDomain.data.evaluationStageMatrix.stageRows,
              exceptionCards: buildEvaluationExceptionCards({
                returnedCount: evaluationDomain.data.evaluationStageMatrix.returnedCount,
                unassignedCount: evaluationDomain.data.evaluationStageMatrix.unassignedCount,
                overdueCount: evaluationDomain.data.evaluationStageMatrix.overdueCount,
                pendingCalibrationCount: evaluationDomain.data.evaluationStageMatrix.pendingCalibrationCount,
                selectedCycleId: selectedCycle.id,
              }),
              departmentRows: evaluationDomain.data.evaluationStageMatrix.departmentRows,
            })

    const performanceDistribution =
      evaluationDomain.state === 'error'
        ? buildPerformanceDistributionSection('error', evaluationDomain.message)
        : (
            await loadStatisticsResource({
              key: 'performance-distribution',
              title: '성과 분포 통계를 일부 불러오지 못했습니다.',
              description: '성과 분포와 보정 비교는 가능한 범위의 데이터만 표시합니다.',
              message: '성과 수준과 분포를 계산하지 못했습니다.',
              alerts,
              context: debugContext,
              fallback: buildPerformanceDistributionSection('error', '성과 수준과 분포를 계산하지 못했습니다.'),
              loader: async () => {
                if (!evaluationDomain.data.effectiveOutcomeRows.length) {
                  return buildPerformanceDistributionSection(
                    'empty',
                    '선택한 조건의 성과 수준과 분포 데이터가 아직 없습니다.'
                  )
                }

                const performanceSummary = buildPerformanceSummary({
                  effectiveOutcomeRows: evaluationDomain.data.effectiveOutcomeRows,
                  gradeSettings: evaluationDomain.data.gradeSettings,
                  selectedCycleId: selectedCycle.id,
                  selectedDepartmentId,
                })

                return buildPerformanceDistributionSection('ready', undefined, {
                  outlierDepartmentCount: performanceSummary.outlierDepartmentCount,
                  missingAdjustmentReasonCount: performanceSummary.missingAdjustmentReasonCount,
                  cards: performanceSummary.cards,
                  companyDistribution: performanceSummary.companyDistribution,
                  beforeAfterDistribution: performanceSummary.beforeAfterDistribution,
                  departmentRows: performanceSummary.departmentRows,
                  notice: performanceSummary.notice,
                })
              },
            })
          ).data

    const kpiExecution =
      kpiDomain.state === 'error'
        ? buildKpiExecutionSection('error', kpiDomain.message)
        : (
            await loadStatisticsResource({
              key: 'kpi-execution',
              title: 'KPI 실행 통계를 일부 불러오지 못했습니다.',
              description: '목표 정렬과 월간 실행은 가능한 범위의 데이터만 표시합니다.',
              message: 'KPI 실행력을 계산하지 못했습니다.',
              alerts,
              context: debugContext,
              fallback: buildKpiExecutionSection('error', 'KPI 실행력을 계산하지 못했습니다.'),
              loader: async () => {
                if (!hasKpiSourceData(kpiDomain.data)) {
                  return buildKpiExecutionSection('empty', '선택한 기간의 KPI 실행 데이터가 아직 없습니다.')
                }

                const monthlySummary = buildMonthlyExecutionSummary({
                  employees: scopedEmployees,
                  personalKpis: kpiDomain.data.personalKpis,
                  orgKpis: kpiDomain.data.orgKpis,
                  monthlyRecords: kpiDomain.data.monthlyRecords,
                  latestMonthlyByKpi: kpiDomain.data.latestMonthlyByKpi,
                  checkIns: kpiDomain.data.checkIns,
                  selectedCycleId: selectedCycle.id,
                  selectedYear: selectedCycle.evalYear,
                  selectedDepartmentId,
                })

                return buildKpiExecutionSection('ready', undefined, {
                  averageAchievementRate: monthlySummary.averageAchievementRate,
                  trend: monthlySummary.trend,
                  cards: monthlySummary.cards,
                  departmentRows: monthlySummary.departmentRows,
                  exceptions: monthlySummary.exceptions,
                })
              },
            })
          ).data

    const organizationRisk = (
      await loadStatisticsResource({
        key: 'organization-risk',
        title: '조직 리스크 통계를 일부 불러오지 못했습니다.',
        description: '리스크 조직과 이의제기 현황은 가능한 범위의 데이터만 표시합니다.',
        message: '조직 리스크를 계산하지 못했습니다.',
        alerts,
        context: debugContext,
        fallback: buildOrganizationRiskSection('error', '조직 리스크를 계산하지 못했습니다.'),
        loader: async () => {
          const hasRiskSource =
            (kpiDomain.state === 'ready' && hasKpiSourceData(kpiDomain.data)) ||
            (evaluationDomain.state === 'ready' && evaluationDomain.data.evaluations.length > 0) ||
            (appealDomain.state === 'ready' && appealDomain.data.appeals.length > 0)

          if (!hasRiskSource) {
            return buildOrganizationRiskSection('empty', '선택한 조건의 조직 리스크 데이터가 아직 없습니다.')
          }

          const riskSummary = buildRiskSummary({
            departments,
            employees: scopedEmployees,
            latestMonthlyByKpi:
              kpiDomain.state === 'ready'
                ? kpiDomain.data.latestMonthlyByKpi
                : new Map<string, StatisticsMonthlyRecord>(),
            personalKpis: kpiDomain.state === 'ready' ? kpiDomain.data.personalKpis : [],
            evaluations: evaluationDomain.state === 'ready' ? evaluationDomain.data.evaluations : [],
            appeals: appealDomain.state === 'ready' ? appealDomain.data.appeals : [],
            selectedCycleId: selectedCycle.id,
            selectedYear: selectedCycle.evalYear,
            selectedDepartmentId,
          })

          if (!riskSummary.departmentRows.length && !riskSummary.cards.length) {
            return buildOrganizationRiskSection('empty', '선택한 조건의 조직 리스크 데이터가 아직 없습니다.')
          }

          return buildOrganizationRiskSection('ready', undefined, {
            riskDepartmentCount: riskSummary.riskDepartmentCount,
            cards: riskSummary.cards,
            departmentRows: riskSummary.departmentRows,
          })
        },
      })
    ).data

    const aiAlignmentSummary =
      evaluationDomain.state === 'error'
        ? summarizeStatisticsAiAlignment([])
        : (
            await loadStatisticsResource({
              key: 'ai-alignment-domain',
              title: 'AI 브리핑 정합성 통계를 일부 불러오지 못했습니다.',
              description: '생성된 AI 브리핑이 없어도 다른 통계는 계속 표시합니다.',
              message: 'AI 브리핑 정합성을 계산하지 못했습니다.',
              alerts,
              context: debugContext,
              fallback: summarizeStatisticsAiAlignment([]),
              loader: async () => {
                const evaluationIds = evaluationDomain.data.evaluations.map((evaluation) => evaluation.id)
                if (!evaluationIds.length) {
                  return summarizeStatisticsAiAlignment([])
                }

                const logs = await prisma.aiRequestLog.findMany({
                  where: {
                    requestType: 'EVAL_PERFORMANCE_BRIEFING' as AIRequestType,
                    sourceId: {
                      in: evaluationIds,
                    },
                  },
                  select: {
                    id: true,
                    sourceId: true,
                    createdAt: true,
                    responsePayload: true,
                  },
                  orderBy: [{ createdAt: 'desc' }],
                })

                const latestByEvaluation = new Map<string, EvaluationPerformanceBriefingAlignmentStatus>()
                for (const log of logs) {
                  if (!log.sourceId || latestByEvaluation.has(log.sourceId)) continue
                  const snapshot = normalizeEvaluationPerformanceBriefingSnapshot(log.responsePayload)
                  if (!snapshot) continue
                  latestByEvaluation.set(log.sourceId, snapshot.alignment.status)
                }

                return summarizeStatisticsAiAlignment([...latestByEvaluation.values()])
              },
            })
          ).data

    const readinessProxy =
      evaluationDomain.state === 'error'
        ? buildReadinessSection('error', evaluationDomain.message)
        : (
            await loadStatisticsResource({
              key: 'readiness-domain',
              title: '준비도 지표를 일부 불러오지 못했습니다.',
              description: 'AI 역량 평가 결과가 없어도 다른 통계는 계속 표시합니다.',
              message: '준비도 지표를 계산하지 못했습니다.',
              alerts,
              context: debugContext,
              fallback: buildReadinessSection('error', '준비도 지표를 계산하지 못했습니다.'),
              loader: async () => {
                const aiCycle = await prisma.aiCompetencyCycle.findFirst({
                  where: {
                    evalCycleId: selectedCycle.id,
                  },
                  select: {
                    id: true,
                    firstRoundPassThreshold: true,
                  },
                })

                if (!aiCycle) {
                  return toReadinessSection(
                    buildEmptyReadinessProxy('연결된 AI 역량 평가 결과가 없어 준비도 지표를 표시하지 않습니다.')
                  )
                }

                const [aiAssignments, aiAttempts, aiResults] = await Promise.all([
                  prisma.aiCompetencyAssignment.findMany({
                    where: {
                      cycleId: aiCycle.id,
                      employeeId: {
                        in: employeeIds,
                      },
                    },
                    include: {
                      employee: {
                        select: {
                          id: true,
                          position: true,
                          department: {
                            select: {
                              deptName: true,
                            },
                          },
                        },
                      },
                      result: true,
                    },
                  }),
                  prisma.aiCompetencyAttempt.findMany({
                    where: {
                      cycleId: aiCycle.id,
                      employeeId: {
                        in: employeeIds,
                      },
                    },
                    select: {
                      employeeId: true,
                      status: true,
                      passStatus: true,
                    },
                  }),
                  prisma.aiCompetencyResult.findMany({
                    where: {
                      cycleId: aiCycle.id,
                      employeeId: {
                        in: employeeIds,
                      },
                    },
                    include: {
                      employee: {
                        select: {
                          id: true,
                          position: true,
                          department: {
                            select: {
                              deptName: true,
                            },
                          },
                        },
                      },
                      assignment: {
                        select: {
                          track: true,
                        },
                      },
                    },
                  }),
                ])

                return toReadinessSection(
                  buildReadinessProxy({
                    aiCycleId: aiCycle.id,
                    passThreshold: aiCycle.firstRoundPassThreshold,
                    aiAssignments,
                    aiAttempts,
                    aiResults,
                    effectiveOutcomeRows: evaluationDomain.data.effectiveOutcomeRows,
                  })
                )
              },
            })
          ).data

    const fairness =
      evaluationDomain.state === 'error'
        ? buildFairnessSection(
            'error',
            evaluationDomain.message,
            buildCeoAdjustHref({
              cycleId: selectedCycle.id,
              departmentId: selectedDepartmentId === 'ALL' ? undefined : selectedDepartmentId,
            })
          )
        : (
            await loadStatisticsResource({
              key: 'fairness-section',
              title: '공정성 통계를 일부 불러오지 못했습니다.',
              description: '정합성 점검과 리뷰 품질 경고는 가능한 범위의 데이터만 표시합니다.',
              message: '공정성과 보정 필요 신호를 계산하지 못했습니다.',
              alerts,
              context: debugContext,
              fallback: buildFairnessSection(
                'error',
                '공정성과 보정 필요 신호를 계산하지 못했습니다.',
                buildCeoAdjustHref({
                  cycleId: selectedCycle.id,
                  departmentId: selectedDepartmentId === 'ALL' ? undefined : selectedDepartmentId,
                })
              ),
              loader: async () => {
                if (
                  performanceDistribution.state !== 'ready' ||
                  !evaluationDomain.data.evaluations.some((evaluation) => evaluation.evalStage !== 'SELF')
                ) {
                  return buildFairnessSection(
                    'empty',
                    '선택한 조건의 공정성 통계 데이터가 아직 없습니다.',
                    buildCeoAdjustHref({
                      cycleId: selectedCycle.id,
                      departmentId: selectedDepartmentId === 'ALL' ? undefined : selectedDepartmentId,
                    })
                  )
                }

                const qualitySummary = buildStatisticsQualitySummary(
                  evaluationDomain.data.evaluations.filter((evaluation) => evaluation.evalStage !== 'SELF')
                )

                const fairnessCards = buildFairnessCards({
                  performanceSummary: {
                    departmentRows: performanceDistribution.departmentRows,
                    outlierDepartmentCount: performanceDistribution.outlierDepartmentCount ?? 0,
                    missingAdjustmentReasonCount: performanceDistribution.missingAdjustmentReasonCount ?? 0,
                  },
                  qualitySummary,
                  aiAlignmentSummary,
                  selectedCycleId: selectedCycle.id,
                  selectedDepartmentId,
                })

                return buildFairnessSection(
                  'ready',
                  undefined,
                  buildCeoAdjustHref({
                    cycleId: selectedCycle.id,
                    departmentId: selectedDepartmentId === 'ALL' ? undefined : selectedDepartmentId,
                  }),
                  {
                    warningCount:
                      (performanceDistribution.outlierDepartmentCount ?? 0) +
                      (performanceDistribution.missingAdjustmentReasonCount ?? 0) +
                      aiAlignmentSummary.warningCount,
                    cards: fairnessCards,
                    alignmentDistribution: buildAlignmentDistributionRows(aiAlignmentSummary),
                    qualityWarnings: [
                      { label: '근거 부족', count: qualitySummary.insufficientEvidenceWarningCount },
                      { label: '편향 위험', count: qualitySummary.biasWarningCount },
                      { label: '코칭 가이드 누락', count: qualitySummary.coachingGapCount },
                    ],
                    coverageLabel:
                      aiAlignmentSummary.totalCount > 0
                        ? `AI 브리핑 ${aiAlignmentSummary.totalCount}건 기준`
                        : '생성된 AI 브리핑이 없어 정합성 통계를 표시하지 않습니다.',
                    notice: performanceDistribution.notice,
                  }
                )
              },
            })
          ).data

    const hasReadyPrimaryData =
      (evaluationDomain.state === 'ready' &&
        (evaluationDomain.data.evaluations.length > 0 || evaluationDomain.data.assignments.length > 0)) ||
      (kpiDomain.state === 'ready' && hasKpiSourceData(kpiDomain.data)) ||
      (appealDomain.state === 'ready' && appealDomain.data.appeals.length > 0) ||
      readinessProxy.state === 'ready'

    const hasDomainFailures =
      evaluationDomain.state === 'error' ||
      kpiDomain.state === 'error' ||
      appealDomain.state === 'error' ||
      performanceDistribution.state === 'error' ||
      kpiExecution.state === 'error' ||
      organizationRisk.state === 'error' ||
      readinessProxy.state === 'error' ||
      fairness.state === 'error'

    if (!hasReadyPrimaryData && !hasDomainFailures) {
      return {
        state: 'empty',
        message: '선택한 조건의 통계 데이터가 아직 없습니다.',
        alerts,
        generatedAt,
        actor: actorSummary,
        filters,
        selectedCycle: selectedCycleSummary,
        summaryCards: [],
      }
    }

    const summaryCards = buildStatisticsSummaryCards({
      evaluationProgressRate:
        evaluationOperations.state === 'ready' ? evaluationOperations.progressRate : undefined,
      finalizedRate: evaluationOperations.state === 'ready' ? evaluationOperations.finalizedRate : undefined,
      averageAchievementRate:
        kpiExecution.state === 'ready' ? kpiExecution.averageAchievementRate : undefined,
      riskDepartmentCount:
        organizationRisk.state === 'ready' ? organizationRisk.riskDepartmentCount : undefined,
      fairnessWarningCount: fairness.state === 'ready' ? fairness.warningCount : undefined,
      readinessReadyCount:
        readinessProxy.state === 'ready' ? readinessProxy.readyTalentCount : undefined,
      selectedCycleId: selectedCycle.id,
      aiCycleHref: readinessProxy.href,
      selectedYear: selectedCycle.evalYear,
      selectedDepartmentId,
    })

    return {
      state: 'ready',
      alerts,
      generatedAt,
      actor: actorSummary,
      filters,
      selectedCycle: selectedCycleSummary,
      summaryCards,
      sections: {
        evaluationOperations,
        performanceDistribution,
        kpiExecution,
        organizationRisk,
        readinessProxy,
        fairness,
      },
    }
  } catch (error) {
    console.error('[statistics-page] fatal', {
      actorId: sessionUser.id,
      role: sessionUser.role,
      cycleId: selectedCycleSummary?.id,
      period: filters.selectedPeriod,
      orgId: filters.selectedOrgId,
      departmentId: filters.selectedDepartmentId,
      position: filters.selectedPosition,
      error,
    })
    return {
      state: 'error',
      message: '통계 페이지를 불러오는 중 오류가 발생했습니다.',
      alerts,
      generatedAt,
      actor: actorSummary,
      filters,
      selectedCycle: selectedCycleSummary,
      summaryCards: [],
    }
  }
}

export async function getStatisticsPageDataLegacy(
  session: Session,
  searchParams: StatisticsSearchParams = {}
): Promise<StatisticsPageData> {
  const alerts: StatisticsPageAlert[] = []
  const generatedAt = new Date().toISOString()
  const sessionUser = session.user as StatisticsSessionUser | undefined

  if (!sessionUser?.id || !sessionUser.role) {
    return {
      state: 'permission-denied',
      message: '통계 페이지에 접근할 권한이 없습니다.',
      alerts,
      generatedAt,
      filters: buildEmptyFilterState(),
      summaryCards: [],
    }
  }

  if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(sessionUser.role)) {
    return {
      state: 'permission-denied',
      message: '통계 페이지는 CEO 또는 관리자만 볼 수 있습니다.',
      alerts,
      generatedAt,
      filters: buildEmptyFilterState(),
      summaryCards: [],
    }
  }

  try {
    const actor = await prisma.employee.findUnique({
      where: { id: sessionUser.id },
      include: {
        department: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!actor) {
      return {
        state: 'permission-denied',
        message: '사용자 조직 정보를 찾을 수 없어 통계를 불러올 수 없습니다.',
        alerts,
        generatedAt,
        filters: buildEmptyFilterState(),
        summaryCards: [],
      }
    }

    const organizationOptions =
      sessionUser.role === 'ROLE_ADMIN'
        ? await prisma.organization.findMany({
            select: {
              id: true,
              name: true,
            },
            orderBy: {
              name: 'asc',
            },
          })
        : [
            {
              id: actor.department.orgId,
              name: actor.department.organization.name,
            },
          ]

    const selectedOrgId = resolveSelectedOrgId({
      actorOrgId: actor.department.orgId,
      requestedOrgId: searchParams.orgId,
      orgOptions: organizationOptions,
    })

    const [cycles, departments] = await Promise.all([
      prisma.evalCycle.findMany({
        where: {
          orgId: selectedOrgId,
        },
        include: {
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.department.findMany({
        where: {
          orgId: selectedOrgId,
        },
        select: {
          id: true,
          deptName: true,
          deptCode: true,
          parentDeptId: true,
          orgId: true,
        },
        orderBy: [{ deptCode: 'asc' }, { deptName: 'asc' }],
      }),
    ])

    const filterBase = buildFilterState({
      cycles,
      orgOptions: organizationOptions,
      departments,
      selectedOrgId,
      selectedCycleId: undefined,
      selectedDepartmentId: 'ALL',
      selectedPeriod: parseStatisticsPeriod(searchParams.period),
      selectedPosition: 'ALL',
      positionOptions: [{ value: 'ALL', label: '전체 직위' }],
      actorRole: sessionUser.role,
    })

    if (!cycles.length) {
      return {
        state: 'empty',
        message: '표시할 평가 주기가 없습니다.',
        alerts,
        generatedAt,
        actor: {
          name: actor.empName,
          role: actor.role,
          departmentName: actor.department.deptName,
          organizationName: actor.department.organization.name,
        },
        filters: filterBase,
        summaryCards: [],
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === searchParams.cycleId) ??
      cycles.find((cycle) => cycle.status !== 'SETUP') ??
      cycles[0]

    const selectedDepartmentId = resolveSelectedDepartmentId({
      requestedDepartmentId: searchParams.departmentId,
      departments,
    })
    const scopedDepartmentIds =
      selectedDepartmentId === 'ALL'
        ? departments.map((department) => department.id)
        : [selectedDepartmentId, ...getDescendantDeptIds(selectedDepartmentId, departments)]

    const allScopeEmployees = await prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        deptId: {
          in: scopedDepartmentIds,
        },
      },
      select: {
        id: true,
        empName: true,
        deptId: true,
        position: true,
        role: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
        department: {
          select: {
            deptName: true,
          },
        },
      },
      orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
    })

    const positionOptions = buildPositionOptions(allScopeEmployees)
    const selectedPosition = resolveSelectedPosition(searchParams.position, positionOptions)
    const scopedEmployees =
      selectedPosition === 'ALL'
        ? allScopeEmployees
        : allScopeEmployees.filter((employee) => employee.position === selectedPosition)

    const filters = buildFilterState({
      cycles,
      orgOptions: organizationOptions,
      departments,
      selectedOrgId,
      selectedCycleId: selectedCycle.id,
      selectedDepartmentId,
      selectedPeriod: parseStatisticsPeriod(searchParams.period),
      selectedPosition,
      positionOptions,
      actorRole: sessionUser.role,
    })

    if (!scopedEmployees.length) {
      return {
        state: 'empty',
        message: '선택한 조건에 해당하는 인원이 없습니다.',
        alerts,
        generatedAt,
        actor: {
          name: actor.empName,
          role: actor.role,
          departmentName: actor.department.deptName,
          organizationName: actor.department.organization.name,
        },
        filters,
        selectedCycle: {
          id: selectedCycle.id,
          label: `${selectedCycle.evalYear} ${selectedCycle.cycleName}`,
          year: selectedCycle.evalYear,
          organizationName: selectedCycle.organization.name,
        },
        summaryCards: [],
      }
    }

    const periodRange = getStatisticsPeriodRange({
      period: filters.selectedPeriod,
      cycleYear: selectedCycle.evalYear,
      referenceDate:
        selectedCycle.ceoAdjustEnd ??
        selectedCycle.finalEvalEnd ??
        selectedCycle.secondEvalEnd ??
        selectedCycle.firstEvalEnd ??
        new Date(`${selectedCycle.evalYear}-12-31T23:59:59.999Z`),
    })
    const employeeIds = scopedEmployees.map((employee) => employee.id)

    const [gradeSettings, evaluations, assignments, personalKpis, orgKpis, monthlyRecords, checkIns, appeals] =
      await Promise.all([
        prisma.gradeSetting.findMany({
          where: {
            orgId: selectedOrgId,
            evalYear: selectedCycle.evalYear,
            isActive: true,
          },
          select: {
            id: true,
            gradeName: true,
            minScore: true,
            maxScore: true,
            targetDistRate: true,
            gradeOrder: true,
          },
          orderBy: {
            gradeOrder: 'asc',
          },
        }),
        loadStatisticsEvaluations(selectedCycle.id, employeeIds),
        loadStatisticsAssignments(selectedCycle.id, employeeIds),
        loadStatisticsPersonalKpis(employeeIds, selectedCycle.evalYear),
        loadStatisticsOrgKpis(scopedDepartmentIds, selectedCycle.evalYear),
        loadStatisticsMonthlyRecords(employeeIds, periodRange.startYearMonth, periodRange.endYearMonth),
        loadStatisticsCheckIns(employeeIds, periodRange.startDate, periodRange.endDate),
        loadStatisticsAppeals(selectedCycle.id, employeeIds),
      ])

    const gradeSettingsWithFallback = ensureGradeSettings(gradeSettings)
    const evaluationsByTarget = groupBy(evaluations, (evaluation) => evaluation.targetId)
    const assignmentsByTarget = groupBy(assignments, (assignment) => assignment.targetId)
    const latestMonthlyByKpi = buildLatestMonthlyRecordMap(monthlyRecords)
    const evaluationStageMatrix = buildEvaluationStageMatrix({
      cycle: selectedCycle,
      employees: scopedEmployees,
      evaluationsByTarget,
      assignmentsByTarget,
    })

    const effectiveOutcomeRows = scopedEmployees.reduce<
      Array<{
        employee: StatisticsEmployeeScope
        evaluation: StatisticsEvaluationRecord
        baseline: StatisticsEvaluationRecord | null
      }>
    >((rows, employee) => {
      const evaluation = pickEffectiveEvaluationOutcome(evaluationsByTarget.get(employee.id) ?? [])
      if (!evaluation) {
        return rows
      }

      rows.push({
        employee,
        evaluation,
        baseline: pickBaselineEvaluationOutcome(evaluationsByTarget.get(employee.id) ?? []),
      })
      return rows
    }, [])

    const aiAlignmentSummary = await loadStatisticsOptional({
      alerts,
      title: 'AI 브리핑 정합성 통계를 일부 불러오지 못했습니다.',
      description: '생성된 AI 브리핑이 없어도 핵심 통계는 계속 확인할 수 있습니다.',
      fallback: summarizeStatisticsAiAlignment([]),
      load: async () => {
        const evaluationIds = evaluations.map((evaluation) => evaluation.id)
        if (!evaluationIds.length) {
          return summarizeStatisticsAiAlignment([])
        }

        const logs = await prisma.aiRequestLog.findMany({
          where: {
            requestType: 'EVAL_PERFORMANCE_BRIEFING' as AIRequestType,
            sourceId: {
              in: evaluationIds,
            },
          },
          select: {
            id: true,
            sourceId: true,
            createdAt: true,
            responsePayload: true,
          },
          orderBy: [{ createdAt: 'desc' }],
        })

        const latestByEvaluation = new Map<string, EvaluationPerformanceBriefingAlignmentStatus>()
        for (const log of logs) {
          if (!log.sourceId || latestByEvaluation.has(log.sourceId)) continue
          const snapshot = normalizeEvaluationPerformanceBriefingSnapshot(log.responsePayload)
          if (!snapshot) continue
          latestByEvaluation.set(log.sourceId, snapshot.alignment.status)
        }

        return summarizeStatisticsAiAlignment([...latestByEvaluation.values()])
      },
    })

    const qualitySummary = buildStatisticsQualitySummary(
      evaluations.filter((evaluation) => evaluation.evalStage !== 'SELF')
    )

    const monthlySummary = buildMonthlyExecutionSummary({
      employees: scopedEmployees,
      personalKpis,
      orgKpis,
      monthlyRecords,
      latestMonthlyByKpi,
      checkIns,
      selectedCycleId: selectedCycle.id,
      selectedYear: selectedCycle.evalYear,
      selectedDepartmentId,
    })

    const performanceSummary = buildPerformanceSummary({
      effectiveOutcomeRows,
      gradeSettings: gradeSettingsWithFallback,
      selectedCycleId: selectedCycle.id,
      selectedDepartmentId,
    })

    const riskSummary = buildRiskSummary({
      departments,
      employees: scopedEmployees,
      latestMonthlyByKpi,
      personalKpis,
      evaluations,
      appeals,
      selectedCycleId: selectedCycle.id,
      selectedYear: selectedCycle.evalYear,
      selectedDepartmentId,
    })

    const readinessProxy = await loadStatisticsOptional({
      alerts,
      title: '준비도 지표를 일부 불러오지 못했습니다.',
      description: 'AI 역량 평가 결과가 없어도 다른 통계는 계속 볼 수 있습니다.',
      fallback: buildEmptyReadinessProxy(),
      load: async () => {
        const aiCycle = await prisma.aiCompetencyCycle.findFirst({
          where: {
            evalCycleId: selectedCycle.id,
          },
          select: {
            id: true,
            firstRoundPassThreshold: true,
          },
        })

        if (!aiCycle) {
          return buildEmptyReadinessProxy(
            '연결된 AI 역량 평가 결과가 없어 준비도 지표를 표시하지 않습니다.'
          )
        }

        const [aiAssignments, aiAttempts, aiResults] = await Promise.all([
          prisma.aiCompetencyAssignment.findMany({
            where: {
              cycleId: aiCycle.id,
              employeeId: {
                in: employeeIds,
              },
            },
            include: {
              employee: {
                select: {
                  id: true,
                  position: true,
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                },
              },
              result: true,
            },
          }),
          prisma.aiCompetencyAttempt.findMany({
            where: {
              cycleId: aiCycle.id,
              employeeId: {
                in: employeeIds,
              },
            },
            select: {
              employeeId: true,
              status: true,
              passStatus: true,
            },
          }),
          prisma.aiCompetencyResult.findMany({
            where: {
              cycleId: aiCycle.id,
              employeeId: {
                in: employeeIds,
              },
            },
            include: {
              employee: {
                select: {
                  id: true,
                  position: true,
                  department: {
                    select: {
                      deptName: true,
                    },
                  },
                },
              },
              assignment: {
                select: {
                  track: true,
                },
              },
            },
          }),
        ])

        return buildReadinessProxy({
          aiCycleId: aiCycle.id,
          passThreshold: aiCycle.firstRoundPassThreshold,
          aiAssignments,
          aiAttempts,
          aiResults,
          effectiveOutcomeRows,
        })
      },
    })

    const fairnessCards = buildFairnessCards({
      performanceSummary,
      qualitySummary,
      aiAlignmentSummary,
      selectedCycleId: selectedCycle.id,
      selectedDepartmentId,
    })

    const summaryCards = buildStatisticsSummaryCards({
      evaluationProgressRate: evaluationStageMatrix.progressRate,
      finalizedRate: evaluationStageMatrix.finalizedRate,
      averageAchievementRate: monthlySummary.averageAchievementRate,
      riskDepartmentCount: riskSummary.riskDepartmentCount,
      fairnessWarningCount:
        performanceSummary.outlierDepartmentCount +
        performanceSummary.missingAdjustmentReasonCount +
        aiAlignmentSummary.warningCount,
      readinessReadyCount: readinessProxy.readyTalentCount,
      selectedCycleId: selectedCycle.id,
      aiCycleHref: readinessProxy.href,
      selectedYear: selectedCycle.evalYear,
      selectedDepartmentId,
    })

    return {
      state: 'ready',
      alerts,
      generatedAt,
      actor: {
        name: actor.empName,
        role: actor.role,
        departmentName: actor.department.deptName,
        organizationName: actor.department.organization.name,
      },
      filters,
      selectedCycle: {
        id: selectedCycle.id,
        label: `${selectedCycle.evalYear} ${selectedCycle.cycleName}`,
        year: selectedCycle.evalYear,
        organizationName: selectedCycle.organization.name,
      },
      summaryCards,
      sections: {
        evaluationOperations: {
          stageStatus: evaluationStageMatrix.stageRows,
          exceptionCards: buildEvaluationExceptionCards({
            returnedCount: evaluationStageMatrix.returnedCount,
            unassignedCount: evaluationStageMatrix.unassignedCount,
            overdueCount: evaluationStageMatrix.overdueCount,
            pendingCalibrationCount: evaluationStageMatrix.pendingCalibrationCount,
            selectedCycleId: selectedCycle.id,
          }),
          departmentRows: evaluationStageMatrix.departmentRows,
        },
        performanceDistribution: {
          cards: performanceSummary.cards,
          companyDistribution: performanceSummary.companyDistribution,
          beforeAfterDistribution: performanceSummary.beforeAfterDistribution,
          departmentRows: performanceSummary.departmentRows,
          notice: performanceSummary.notice,
        },
        kpiExecution: {
          trend: monthlySummary.trend,
          cards: monthlySummary.cards,
          departmentRows: monthlySummary.departmentRows,
          exceptions: monthlySummary.exceptions,
        },
        organizationRisk: {
          cards: riskSummary.cards,
          departmentRows: riskSummary.departmentRows,
        },
        readinessProxy: readinessProxy.section,
        fairness: {
          cards: fairnessCards,
          alignmentDistribution: buildAlignmentDistributionRows(aiAlignmentSummary),
          qualityWarnings: [
            { label: '근거 부족', count: qualitySummary.insufficientEvidenceWarningCount },
            { label: '편향 위험', count: qualitySummary.biasWarningCount },
            { label: '코칭 가이드 누락', count: qualitySummary.coachingGapCount },
          ],
          coverageLabel:
            aiAlignmentSummary.totalCount > 0
              ? `AI 브리핑 ${aiAlignmentSummary.totalCount}건 기준`
              : '생성된 AI 브리핑이 없어 정합성 통계를 표시하지 않습니다.',
          notice: performanceSummary.notice,
          detailHref: buildCeoAdjustHref({
            cycleId: selectedCycle.id,
            departmentId: selectedDepartmentId === 'ALL' ? undefined : selectedDepartmentId,
          }),
        },
      },
    }
  } catch (error) {
    console.error('[statistics-page] fatal', error)
    return {
      state: 'error',
      message: '통계 페이지를 불러오는 중 오류가 발생했습니다.',
      alerts,
      generatedAt,
      filters: buildEmptyFilterState(),
      summaryCards: [],
    }
  }
}

function buildEmptyEvaluationDomainData(): StatisticsEvaluationDomainData {
  return {
    gradeSettings: ensureGradeSettings([]),
    evaluations: [],
    assignments: [],
    evaluationsByTarget: new Map(),
    assignmentsByTarget: new Map(),
    evaluationStageMatrix: {
      stageRows: [],
      progressRate: 0,
      finalizedRate: 0,
      returnedCount: 0,
      overdueCount: 0,
      unassignedCount: 0,
      pendingCalibrationCount: 0,
      departmentRows: [],
    },
    effectiveOutcomeRows: [],
  }
}

function buildEmptyKpiDomainData(): StatisticsKpiDomainData {
  return {
    personalKpis: [],
    orgKpis: [],
    monthlyRecords: [],
    checkIns: [],
    latestMonthlyByKpi: new Map(),
  }
}

function hasKpiSourceData(domain: StatisticsKpiDomainData) {
  return (
    domain.personalKpis.length > 0 ||
    domain.orgKpis.length > 0 ||
    domain.monthlyRecords.length > 0 ||
    domain.checkIns.length > 0
  )
}

function buildEvaluationOperationsSection(
  state: StatisticsSectionState,
  message?: string,
  overrides?: Partial<StatisticsEvaluationOperationsSection>
): StatisticsEvaluationOperationsSection {
  return {
    state,
    message,
    progressRate: overrides?.progressRate,
    finalizedRate: overrides?.finalizedRate,
    stageStatus: overrides?.stageStatus ?? [],
    exceptionCards: overrides?.exceptionCards ?? [],
    departmentRows: overrides?.departmentRows ?? [],
  }
}

function buildPerformanceDistributionSection(
  state: StatisticsSectionState,
  message?: string,
  overrides?: Partial<StatisticsPerformanceDistributionSection>
): StatisticsPerformanceDistributionSection {
  return {
    state,
    message,
    outlierDepartmentCount: overrides?.outlierDepartmentCount,
    missingAdjustmentReasonCount: overrides?.missingAdjustmentReasonCount,
    cards: overrides?.cards ?? [],
    companyDistribution: overrides?.companyDistribution ?? [],
    beforeAfterDistribution: overrides?.beforeAfterDistribution ?? [],
    departmentRows: overrides?.departmentRows ?? [],
    notice: overrides?.notice,
  }
}

function buildKpiExecutionSection(
  state: StatisticsSectionState,
  message?: string,
  overrides?: Partial<StatisticsKpiExecutionSection>
): StatisticsKpiExecutionSection {
  return {
    state,
    message,
    averageAchievementRate: overrides?.averageAchievementRate,
    trend: overrides?.trend ?? [],
    cards: overrides?.cards ?? [],
    departmentRows: overrides?.departmentRows ?? [],
    exceptions: overrides?.exceptions ?? [],
  }
}

function buildOrganizationRiskSection(
  state: StatisticsSectionState,
  message?: string,
  overrides?: Partial<StatisticsOrganizationRiskSection>
): StatisticsOrganizationRiskSection {
  return {
    state,
    message,
    riskDepartmentCount: overrides?.riskDepartmentCount,
    cards: overrides?.cards ?? [],
    departmentRows: overrides?.departmentRows ?? [],
  }
}

function getReadinessProxyNotice() {
  return '현재 성과와 AI 역량 결과를 함께 본 준비도 프록시이며 공식 승계 지표는 아닙니다.'
}

function buildReadinessSection(
  state: StatisticsSectionState,
  message?: string,
  overrides?: Partial<StatisticsReadinessProxySection>
): StatisticsReadinessProxySection {
  return {
    state,
    message,
    notice: overrides?.notice ?? getReadinessProxyNotice(),
    readyTalentCount: overrides?.readyTalentCount,
    cards: overrides?.cards ?? [],
    trackDistribution: overrides?.trackDistribution ?? [],
    departmentRows: overrides?.departmentRows ?? [],
    feederPool: overrides?.feederPool ?? [],
    href: overrides?.href ?? '/evaluation/ai-competency/admin',
  }
}

function buildFairnessSection(
  state: StatisticsSectionState,
  message: string | undefined,
  detailHref: string,
  overrides?: Partial<StatisticsFairnessSection>
): StatisticsFairnessSection {
  return {
    state,
    message,
    warningCount: overrides?.warningCount,
    cards: overrides?.cards ?? [],
    alignmentDistribution: overrides?.alignmentDistribution ?? [],
    qualityWarnings: overrides?.qualityWarnings ?? [],
    coverageLabel: overrides?.coverageLabel ?? '생성된 AI 브리핑이 없어 정합성 통계를 표시하지 않습니다.',
    notice: overrides?.notice,
    detailHref,
  }
}

function toReadinessSection(value:
  | StatisticsReadinessProxySection
  | {
      readyTalentCount: number
      section: Omit<StatisticsReadinessProxySection, 'readyTalentCount'>
    }): StatisticsReadinessProxySection {
  if ('section' in value) {
    return {
      ...value.section,
      readyTalentCount: value.readyTalentCount,
    }
  }

  return value
}

function appendNormalizedFilterAlerts(params: {
  alerts: StatisticsPageAlert[]
  searchParams: StatisticsSearchParams
  filters: StatisticsPageData['filters']
  selectedCycleId?: string
}) {
  const adjusted: string[] = []

  if (params.searchParams.period && params.searchParams.period !== params.filters.selectedPeriod) {
    adjusted.push('기간')
  }
  if (params.searchParams.cycleId && params.searchParams.cycleId !== params.selectedCycleId) {
    adjusted.push('평가 주기')
  }
  if (params.searchParams.orgId && params.searchParams.orgId !== params.filters.selectedOrgId) {
    adjusted.push('회사')
  }
  if (
    params.searchParams.departmentId &&
    params.searchParams.departmentId !== params.filters.selectedDepartmentId
  ) {
    adjusted.push('조직')
  }
  if (params.searchParams.position && params.searchParams.position !== params.filters.selectedPosition) {
    adjusted.push('직위')
  }

  if (!adjusted.length) {
    return
  }

  params.alerts.push({
    title: '일부 필터를 현재 사용 가능한 값으로 조정했습니다.',
    description: `${adjusted.join(', ')} 필터를 현재 범위에 맞게 다시 맞췄습니다.`,
    tone: 'neutral',
  })
}

async function loadStatisticsResource<T>(params: {
  key: string
  title: string
  description: string
  message?: string
  fallback: T
  alerts: StatisticsPageAlert[]
  context?: StatisticsDebugContext
  loader: () => Promise<T>
}): Promise<StatisticsLoadResult<T>> {
  try {
    return {
      state: 'ready',
      data: await params.loader(),
    }
  } catch (error) {
    console.error(`[statistics-page] ${params.key}`, {
      ...params.context,
      error,
    })
    params.alerts.push({
      title: params.title,
      description: params.description,
      tone: 'warn',
    })
    return {
      state: 'error',
      data: params.fallback,
      message: params.message,
    }
  }
}

function buildEmptyFilterState(): StatisticsPageData['filters'] {
  return {
    selectedCycleId: undefined,
    selectedPeriod: '12m',
    selectedOrgId: undefined,
    selectedDepartmentId: 'ALL',
    selectedPosition: 'ALL',
    periodOptions: PERIOD_OPTIONS,
    cycleOptions: [],
    orgOptions: [],
    departmentOptions: [{ id: 'ALL', name: '전체 조직', level: 0 }],
    positionOptions: [{ value: 'ALL', label: '전체 직위' }],
    showOrgFilter: false,
  }
}

function buildFilterState(params: {
  cycles: Array<{ id: string; evalYear: number; cycleName: string; status: string }>
  orgOptions: Array<{ id: string; name: string }>
  departments: StatisticsDepartmentLite[]
  selectedOrgId: string
  selectedCycleId?: string
  selectedDepartmentId: string
  selectedPeriod: StatisticsPeriod
  selectedPosition: 'ALL' | Position
  positionOptions: Array<{ value: 'ALL' | Position; label: string }>
  actorRole: SystemRole
}): StatisticsPageData['filters'] {
  return {
    selectedCycleId: params.selectedCycleId,
    selectedPeriod: params.selectedPeriod,
    selectedOrgId: params.selectedOrgId,
    selectedDepartmentId: params.selectedDepartmentId,
    selectedPosition: params.selectedPosition,
    periodOptions: PERIOD_OPTIONS,
    cycleOptions: params.cycles.map((cycle) => ({
      id: cycle.id,
      label: `${cycle.evalYear} ${cycle.cycleName}`,
      year: cycle.evalYear,
      status: cycle.status,
    })),
    orgOptions: params.orgOptions,
    departmentOptions: [
      { id: 'ALL', name: '전체 조직', level: 0 },
      ...params.departments.map((department) => ({
        id: department.id,
        name: department.deptName,
        level: countDepartmentDepth(department.id, params.departments),
      })),
    ],
    positionOptions: params.positionOptions,
    showOrgFilter: params.actorRole === 'ROLE_ADMIN' && params.orgOptions.length > 1,
  }
}

function countDepartmentDepth(departmentId: string, departments: StatisticsDepartmentLite[]) {
  const byId = new Map(departments.map((department) => [department.id, department]))
  let depth = 0
  let current = byId.get(departmentId)
  while (current?.parentDeptId) {
    depth += 1
    current = byId.get(current.parentDeptId)
  }
  return depth
}

function buildPositionOptions(employees: StatisticsEmployeeScope[]) {
  const positions = new Set(employees.map((employee) => employee.position))
  return [
    { value: 'ALL' as const, label: '전체 직위' },
    ...POSITION_ORDER.filter((position) => positions.has(position)).map((position) => ({
      value: position,
      label: POSITION_LABELS[position] ?? position,
    })),
  ]
}

function resolveSelectedPosition(
  value: string | undefined,
  positionOptions: Array<{ value: 'ALL' | Position }>
): 'ALL' | Position {
  const available = new Set(positionOptions.map((option) => option.value))
  if (value && available.has(value as 'ALL' | Position)) {
    return value as 'ALL' | Position
  }

  return 'ALL'
}

function resolveSelectedOrgId(params: {
  actorOrgId: string
  requestedOrgId?: string
  orgOptions: Array<{ id: string }>
}) {
  if (params.requestedOrgId && params.orgOptions.some((option) => option.id === params.requestedOrgId)) {
    return params.requestedOrgId
  }

  return params.actorOrgId
}

function resolveSelectedDepartmentId(params: {
  requestedDepartmentId?: string
  departments: StatisticsDepartmentLite[]
}) {
  if (
    params.requestedDepartmentId &&
    (params.requestedDepartmentId === 'ALL' ||
      params.departments.some((department) => department.id === params.requestedDepartmentId))
  ) {
    return params.requestedDepartmentId
  }

  return 'ALL'
}

function getStatisticsPeriodRange(params: {
  period: StatisticsPeriod
  cycleYear: number
  referenceDate: Date
}) {
  const reference =
    params.referenceDate.getFullYear() === params.cycleYear
      ? params.referenceDate
      : new Date(`${params.cycleYear}-12-31T23:59:59.999Z`)
  const cappedReference =
    params.cycleYear === new Date().getFullYear() && reference.getTime() > Date.now()
      ? new Date()
      : reference

  const end = new Date(
    Date.UTC(cappedReference.getFullYear(), cappedReference.getMonth(), cappedReference.getDate(), 23, 59, 59, 999)
  )
  const start = new Date(end)

  if (params.period === '6m') {
    start.setUTCMonth(start.getUTCMonth() - 5, 1)
  } else if (params.period === '12m') {
    start.setUTCMonth(start.getUTCMonth() - 11, 1)
  } else {
    start.setUTCFullYear(params.cycleYear, 0, 1)
  }

  start.setUTCHours(0, 0, 0, 0)

  return {
    startDate: start,
    endDate: end,
    startYearMonth: toYearMonth(start),
    endYearMonth: toYearMonth(end),
  }
}

function toYearMonth(value: Date) {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function groupBy<T, K extends string | number>(rows: T[], keyBuilder: (row: T) => K) {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const key = keyBuilder(row)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
  }
  return map
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function toPercent(value: number, total: number) {
  return total > 0 ? round((value / total) * 100) : 0
}

function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${round(value)}%`
}

function formatCount(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return String(value)
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!filtered.length) return undefined
  return round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length)
}

function ensureGradeSettings(
  grades: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
    targetDistRate: number | null
    gradeOrder: number
  }>
) {
  if (grades.length) {
    return grades
  }

  return [
    { id: 'fallback-s', gradeName: 'S', minScore: 95, maxScore: 100, targetDistRate: null, gradeOrder: 1 },
    { id: 'fallback-a', gradeName: 'A', minScore: 85, maxScore: 94.9, targetDistRate: null, gradeOrder: 2 },
    { id: 'fallback-b', gradeName: 'B', minScore: 75, maxScore: 84.9, targetDistRate: null, gradeOrder: 3 },
    { id: 'fallback-c', gradeName: 'C', minScore: 65, maxScore: 74.9, targetDistRate: null, gradeOrder: 4 },
    { id: 'fallback-d', gradeName: 'D', minScore: 0, maxScore: 64.9, targetDistRate: null, gradeOrder: 5 },
  ]
}

function buildLatestMonthlyRecordMap(records: StatisticsMonthlyRecord[]) {
  const map = new Map<string, StatisticsMonthlyRecord>()
  for (const record of records) {
    const current = map.get(record.personalKpiId)
    if (!current || current.yearMonth < record.yearMonth) {
      map.set(record.personalKpiId, record)
    }
  }
  return map
}

function countAttachmentItems(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) return 0
  return value.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return (
      (typeof record.dataUrl === 'string' && record.dataUrl.trim().length > 0) ||
      (typeof record.url === 'string' && record.url.trim().length > 0) ||
      (typeof record.href === 'string' && record.href.trim().length > 0)
    )
  }).length
}

function resolveGradeName(
  evaluation: { gradeId: string | null; totalScore: number | null },
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
  }>
) {
  if (evaluation.gradeId) {
    const matched = gradeSettings.find((grade) => grade.id === evaluation.gradeId)
    if (matched) return matched.gradeName
  }

  if (typeof evaluation.totalScore !== 'number') {
    return null
  }

  const score = evaluation.totalScore
  return gradeSettings.find((grade) => score >= grade.minScore && score <= grade.maxScore)?.gradeName ?? null
}

function buildGradeDistribution(
  evaluations: Array<{ gradeId: string | null; totalScore: number | null }>,
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
    targetDistRate: number | null
    gradeOrder: number
  }>
) {
  const counts = new Map<string, number>()
  let unclassifiedCount = 0

  for (const evaluation of evaluations) {
    const gradeName = resolveGradeName(evaluation, gradeSettings)
    if (!gradeName) {
      unclassifiedCount += 1
      continue
    }
    counts.set(gradeName, (counts.get(gradeName) ?? 0) + 1)
  }

  const total = evaluations.length
  const rows = gradeSettings
    .slice()
    .sort((left, right) => left.gradeOrder - right.gradeOrder)
    .map((grade) => {
      const count = counts.get(grade.gradeName) ?? 0
      return {
        grade: grade.gradeName,
        count,
        ratio: toPercent(count, total),
        targetRatio: grade.targetDistRate ?? undefined,
      }
    })

  if (unclassifiedCount > 0) {
    rows.push({
      grade: '미분류',
      count: unclassifiedCount,
      ratio: toPercent(unclassifiedCount, total),
      targetRatio: undefined,
    })
  }

  return rows
}

function buildDepartmentOutlierRows(params: {
  effectiveRows: Array<{
    employee: StatisticsEmployeeScope
    evaluation: StatisticsEvaluationRecord
    baseline: StatisticsEvaluationRecord | null
  }>
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
    targetDistRate: number | null
    gradeOrder: number
  }>
  selectedCycleId: string
}) {
  const companyDistribution = buildGradeDistribution(
    params.effectiveRows.map((item) => item.evaluation),
    params.gradeSettings
  )
  const companyRatioMap = new Map(
    companyDistribution.map((row) => [row.grade, row.targetRatio ?? row.ratio] as const)
  )
  const byDepartment = groupBy(params.effectiveRows, (item) => item.employee.deptId)

  return [...byDepartment.entries()].map(([departmentId, rows]) => {
    const grades = buildGradeDistribution(
      rows.map((item) => item.evaluation),
      params.gradeSettings
    )
    const deltaScore = round(
      grades.reduce(
        (sum, grade) => sum + Math.abs((companyRatioMap.get(grade.grade) ?? grade.ratio) - grade.ratio),
        0
      )
    )
    const adjustedCount = rows.filter((item) => {
      if (!item.baseline) return false
      const baselineGrade = resolveGradeName(item.baseline, params.gradeSettings)
      const effectiveGrade = resolveGradeName(item.evaluation, params.gradeSettings)
      if (baselineGrade && effectiveGrade && baselineGrade !== effectiveGrade) {
        return true
      }
      if (typeof item.baseline.totalScore === 'number' && typeof item.evaluation.totalScore === 'number') {
        return Math.abs(item.baseline.totalScore - item.evaluation.totalScore) >= 0.5
      }
      return false
    }).length

    return {
      departmentId,
      departmentName: rows[0]?.employee.department.deptName ?? '미지정 조직',
      averageScore: average(rows.map((item) => item.evaluation.totalScore)),
      highGradeRatio: toPercent(
        rows.filter((item) => ['S', 'A'].includes(resolveGradeName(item.evaluation, params.gradeSettings) ?? '')).length,
        rows.length
      ),
      lowGradeRatio: toPercent(
        rows.filter((item) => ['C', 'D'].includes(resolveGradeName(item.evaluation, params.gradeSettings) ?? '')).length,
        rows.length
      ),
      adjustedRate: toPercent(adjustedCount, rows.length),
      isOutlier: deltaScore >= 18,
      href: buildCeoAdjustHref({
        cycleId: params.selectedCycleId,
        departmentId,
      }),
    }
  })
}

function buildEvaluationStageMatrix(params: {
  cycle: {
    id: string
    status: string
    firstEvalEnd: Date | null
    secondEvalEnd: Date | null
    finalEvalEnd: Date | null
    ceoAdjustEnd: Date | null
  }
  employees: StatisticsEmployeeScope[]
  evaluationsByTarget: Map<string, StatisticsEvaluationRecord[]>
  assignmentsByTarget: Map<string, StatisticsAssignmentRecord[]>
}) {
  const ceoAssigneeExists = params.employees.some((employee) => employee.role === 'ROLE_CEO')
  const stageRows = new Map<
    EvalStage,
    NonNullable<StatisticsPageData['sections']>['evaluationOperations']['stageStatus'][number]
  >()
  const departmentAgg = new Map<
    string,
    {
      departmentName: string
      targetCount: number
      completedEntries: number
      expectedEntries: number
      returnedCount: number
      overdueCount: number
      finalizedCount: number
    }
  >()
  let completedEntries = 0
  let expectedEntries = 0
  let returnedCount = 0
  let overdueCount = 0
  let finalizedCount = 0
  let unassignedCount = 0
  let pendingCalibrationCount = 0

  const now = Date.now()

  for (const employee of params.employees) {
    const evaluations = params.evaluationsByTarget.get(employee.id) ?? []
    const evaluationMap = new Map(evaluations.map((evaluation) => [evaluation.evalStage, evaluation] as const))
    const assignmentMap = new Map(
      (params.assignmentsByTarget.get(employee.id) ?? [])
        .filter((assignment) => assignment.evaluator?.status === 'ACTIVE')
        .map((assignment) => [assignment.evalStage, assignment] as const)
    )

    const hasFirst = Boolean(assignmentMap.get('FIRST')?.evaluatorId ?? employee.teamLeaderId)
    const hasSecond = Boolean(assignmentMap.get('SECOND')?.evaluatorId ?? employee.sectionChiefId)
    const hasFinal = Boolean(assignmentMap.get('FINAL')?.evaluatorId ?? employee.divisionHeadId)
    const hasCeo = Boolean(assignmentMap.get('CEO_ADJUST')?.evaluatorId) || ceoAssigneeExists
    const flow = buildStatisticsStageFlow({
      hasFirst,
      hasSecond,
      hasFinal,
      hasCeo,
    })

    if (!hasFirst) {
      unassignedCount += 1
    } else if (!hasFinal) {
      unassignedCount += 1
    }

    const department = departmentAgg.get(employee.deptId) ?? {
      departmentName: employee.department.deptName,
      targetCount: 0,
      completedEntries: 0,
      expectedEntries: 0,
      returnedCount: 0,
      overdueCount: 0,
      finalizedCount: 0,
    }
    department.targetCount += 1

    const entries: StatisticsStageEntry[] = flow.map((stage) => {
      const evaluation = evaluationMap.get(stage)
      const status = evaluation?.status ?? 'PENDING'
      const dueAt =
        stage === 'FIRST'
          ? params.cycle.firstEvalEnd
          : stage === 'SECOND'
            ? params.cycle.secondEvalEnd
            : stage === 'FINAL'
              ? params.cycle.finalEvalEnd
              : stage === 'CEO_ADJUST'
                ? params.cycle.ceoAdjustEnd
                : null

      return {
        stage,
        status,
        evaluationId: evaluation?.id ?? null,
        dueAt,
        isCompleted: status === 'SUBMITTED' || status === 'CONFIRMED',
      }
    })

    expectedEntries += entries.length
    department.expectedEntries += entries.length

    for (const entry of entries) {
      const current =
        stageRows.get(entry.stage) ??
        {
          stage: entry.stage,
          label: STAGE_LABELS[entry.stage],
          pending: 0,
          inProgress: 0,
          submitted: 0,
          rejected: 0,
          confirmed: 0,
        }
      if (entry.status === 'PENDING') current.pending += 1
      if (entry.status === 'IN_PROGRESS') current.inProgress += 1
      if (entry.status === 'SUBMITTED') current.submitted += 1
      if (entry.status === 'REJECTED') current.rejected += 1
      if (entry.status === 'CONFIRMED') current.confirmed += 1
      stageRows.set(entry.stage, current)

      if (entry.isCompleted) {
        completedEntries += 1
        department.completedEntries += 1
      }

      if (entry.status === 'REJECTED') {
        returnedCount += 1
        department.returnedCount += 1
      }

      if (!entry.isCompleted && entry.dueAt && entry.dueAt.getTime() < now) {
        overdueCount += 1
        department.overdueCount += 1
      }
    }

    const lastEntry = entries[entries.length - 1]
    if (lastEntry?.isCompleted) {
      finalizedCount += 1
      department.finalizedCount += 1
    }

    if (
      ['CEO_ADJUST', 'RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(params.cycle.status) &&
      hasFinal &&
      entries.some((entry) => entry.stage === 'FINAL' && entry.isCompleted) &&
      !entries.some((entry) => entry.stage === 'CEO_ADJUST' && entry.isCompleted)
    ) {
      pendingCalibrationCount += 1
    }

    departmentAgg.set(employee.deptId, department)
  }

  return {
    stageRows: [...stageRows.values()],
    progressRate: toPercent(completedEntries, expectedEntries),
    finalizedRate: toPercent(finalizedCount, params.employees.length),
    returnedCount,
    overdueCount,
    unassignedCount,
    pendingCalibrationCount,
    departmentRows: [...departmentAgg.entries()]
      .map(([departmentId, row]) => ({
        departmentId,
        departmentName: row.departmentName,
        targetCount: row.targetCount,
        progressRate: toPercent(row.completedEntries, row.expectedEntries),
        returnedCount: row.returnedCount,
        overdueCount: row.overdueCount,
        finalizedCount: row.finalizedCount,
        filterHref: buildStatisticsFilterHref({
          cycleId: params.cycle.id,
          departmentId,
        }),
        detailHref: buildPerformanceAssignmentsHref(params.cycle.id),
      }))
      .sort((left, right) => right.overdueCount - left.overdueCount || right.returnedCount - left.returnedCount),
  }
}

function buildPerformanceSummary(params: {
  effectiveOutcomeRows: Array<{
    employee: StatisticsEmployeeScope
    evaluation: StatisticsEvaluationRecord
    baseline: StatisticsEvaluationRecord | null
  }>
  gradeSettings: Array<{
    id: string
    gradeName: string
    minScore: number
    maxScore: number
    targetDistRate: number | null
    gradeOrder: number
  }>
  selectedCycleId: string
  selectedDepartmentId: string
}) {
  const companyDistribution = buildGradeDistribution(
    params.effectiveOutcomeRows.map((item) => item.evaluation),
    params.gradeSettings
  )

  const beforeRows = params.effectiveOutcomeRows
    .map((item) => item.baseline)
    .filter((item): item is StatisticsEvaluationRecord => Boolean(item))
  const beforeDistribution = buildGradeDistribution(beforeRows, params.gradeSettings)
  const beforeAfterDistribution = companyDistribution.map((row) => ({
    grade: row.grade,
    before: beforeDistribution.find((item) => item.grade === row.grade)?.ratio ?? 0,
    after: row.ratio,
  }))

  const departmentRows = buildDepartmentOutlierRows({
    effectiveRows: params.effectiveOutcomeRows,
    gradeSettings: params.gradeSettings,
    selectedCycleId: params.selectedCycleId,
  }).sort((left, right) => Number(right.isOutlier) - Number(left.isOutlier) || right.adjustedRate - left.adjustedRate)

  const adjustedCount = params.effectiveOutcomeRows.filter((item) => {
    if (!item.baseline) return false
    const baselineGrade = resolveGradeName(item.baseline, params.gradeSettings)
    const effectiveGrade = resolveGradeName(item.evaluation, params.gradeSettings)
    if (baselineGrade && effectiveGrade && baselineGrade !== effectiveGrade) {
      return true
    }
    if (typeof item.baseline.totalScore === 'number' && typeof item.evaluation.totalScore === 'number') {
      return Math.abs(item.baseline.totalScore - item.evaluation.totalScore) >= 0.5
    }
    return false
  }).length

  const ceoAdjustRows = params.effectiveOutcomeRows
    .map((item) => item.evaluation)
    .filter((evaluation) => evaluation.evalStage === 'CEO_ADJUST')
  const missingAdjustmentReasonCount = ceoAdjustRows.filter(
    (evaluation) =>
      ![
        evaluation.comment,
        evaluation.strengthComment,
        evaluation.improvementComment,
        evaluation.nextStepGuidance,
      ].some((value) => value?.trim())
  ).length

  const cards: StatisticsMetricCard[] = [
    {
      label: '평균 평가 점수',
      value:
        typeof average(params.effectiveOutcomeRows.map((item) => item.evaluation.totalScore)) === 'number'
          ? `${average(params.effectiveOutcomeRows.map((item) => item.evaluation.totalScore))}점`
          : '-',
      description: '최종 반영 기준 평균 점수',
      tone: 'neutral',
      href: buildEvaluationResultsHref(params.selectedCycleId),
    },
    {
      label: '상위 등급 비율',
      value: formatPercent(
        toPercent(
          params.effectiveOutcomeRows.filter((item) =>
            ['S', 'A'].includes(resolveGradeName(item.evaluation, params.gradeSettings) ?? '')
          ).length,
          params.effectiveOutcomeRows.length
        )
      ),
      description: 'S/A 비율',
      tone: 'neutral',
      href: buildEvaluationResultsHref(params.selectedCycleId),
    },
    {
      label: '하위 등급 비율',
      value: formatPercent(
        toPercent(
          params.effectiveOutcomeRows.filter((item) =>
            ['C', 'D'].includes(resolveGradeName(item.evaluation, params.gradeSettings) ?? '')
          ).length,
          params.effectiveOutcomeRows.length
        )
      ),
      description: 'C/D 비율',
      tone: 'warn',
      href: buildEvaluationResultsHref(params.selectedCycleId),
    },
    {
      label: '보정 적용률',
      value: formatPercent(toPercent(adjustedCount, params.effectiveOutcomeRows.length)),
      description: '대표이사 조정 반영 기준',
      tone: adjustedCount > 0 ? 'warn' : 'neutral',
      href: buildCeoAdjustHref({
        cycleId: params.selectedCycleId,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
      }),
    },
  ]

  return {
    companyDistribution,
    beforeAfterDistribution,
    departmentRows,
    outlierDepartmentCount: departmentRows.filter((row) => row.isOutlier).length,
    missingAdjustmentReasonCount,
    cards,
    notice:
      ceoAdjustRows.length === 0
        ? '보정이 아직 진행되지 않은 주기는 원점수 기준 분포와 최종 분포를 함께 보여줍니다.'
        : undefined,
  }
}

function buildMonthlyExecutionSummary(params: {
  employees: StatisticsEmployeeScope[]
  personalKpis: StatisticsPersonalKpi[]
  orgKpis: StatisticsOrgKpi[]
  monthlyRecords: StatisticsMonthlyRecord[]
  latestMonthlyByKpi: Map<string, StatisticsMonthlyRecord>
  checkIns: StatisticsCheckIn[]
  selectedCycleId: string
  selectedYear: number
  selectedDepartmentId: string
}) {
  const activeEmployeeCount = params.employees.length
  const personalGoalCount = params.personalKpis.length
  const alignedPersonalGoalCount = params.personalKpis.filter((goal) => Boolean(goal.linkedOrgKpiId)).length
  const personalGoalSetupRate = toPercent(personalGoalCount, activeEmployeeCount)
  const alignmentRate = toPercent(alignedPersonalGoalCount, personalGoalCount)
  const completedCheckInRate = toPercent(
    params.checkIns.filter((checkIn) => checkIn.status === 'COMPLETED').length,
    params.checkIns.length
  )

  const evidenceEnabledKpiIds = new Set(
    params.monthlyRecords
      .filter((record) => countAttachmentItems(record.attachments) > 0)
      .map((record) => record.personalKpiId)
  )
  const evidenceCoverageRate = toPercent(evidenceEnabledKpiIds.size, personalGoalCount)
  const averageAchievementRate = average(
    [...params.latestMonthlyByKpi.values()].map((record) => record.achievementRate ?? undefined)
  )
  const trend = buildMonthlyTrend(params.monthlyRecords)

  const activeEmployeesByDept = groupBy(params.employees, (employee) => employee.deptId)
  const personalByDept = groupBy(params.personalKpis, (kpi) => kpi.employee.deptId)
  const orgByDept = groupBy(params.orgKpis, (goal) => goal.deptId)
  const checkInsByOwner = groupBy(params.checkIns, (checkIn) => checkIn.ownerId)
  const orgKpiIdSet = new Set(params.orgKpis.map((goal) => goal.id))

  const departmentRows = [...activeEmployeesByDept.entries()]
    .map(([departmentId, employees]) => {
      const personalGoals = personalByDept.get(departmentId) ?? []
      const orgGoals = orgByDept.get(departmentId) ?? []
      const orphanGoalCount =
        orgGoals.filter((goal) => Boolean(goal.parentOrgKpiId && !orgKpiIdSet.has(goal.parentOrgKpiId))).length +
        personalGoals.filter((goal) => !goal.linkedOrgKpiId || !orgKpiIdSet.has(goal.linkedOrgKpiId)).length

      const ownerCheckIns = employees.flatMap((employee) => checkInsByOwner.get(employee.id) ?? [])
      const averageProgressRate =
        average(
          personalGoals.map((goal) => params.latestMonthlyByKpi.get(goal.id)?.achievementRate ?? undefined)
        ) ?? 0
      const riskCount =
        orphanGoalCount +
        personalGoals.filter(
          (goal) => (params.latestMonthlyByKpi.get(goal.id)?.achievementRate ?? 100) < 70
        ).length

      return {
        departmentId,
        departmentName: employees[0]?.department.deptName ?? '미지정 조직',
        activeEmployeeCount: employees.length,
        personalGoalSetupRate: toPercent(personalGoals.length, employees.length),
        alignmentRate: toPercent(
          personalGoals.filter((goal) => Boolean(goal.linkedOrgKpiId && orgKpiIdSet.has(goal.linkedOrgKpiId))).length,
          personalGoals.length
        ),
        completedCheckInRate: toPercent(
          ownerCheckIns.filter((checkIn) => checkIn.status === 'COMPLETED').length,
          ownerCheckIns.length
        ),
        averageProgressRate,
        riskCount,
        href: buildGoalAlignmentHref({
          cycleId: params.selectedCycleId,
          year: params.selectedYear,
          departmentId,
          status: 'AT_RISK',
        }),
      }
    })
    .sort((left, right) => right.riskCount - left.riskCount || left.departmentName.localeCompare(right.departmentName, 'ko'))

  const cards: StatisticsMetricCard[] = [
    {
      label: '목표 정렬률',
      value: formatPercent(alignmentRate),
      description: '개인 목표 기준 조직 KPI 연결 비율',
      tone: alignmentRate >= 80 ? 'success' : alignmentRate >= 60 ? 'warn' : 'error',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
      }),
    },
    {
      label: '개인 목표 수립 비율',
      value: formatPercent(personalGoalSetupRate),
      description: '대상 인원 기준 개인 목표 수립 비율',
      tone: personalGoalSetupRate >= 90 ? 'success' : personalGoalSetupRate >= 70 ? 'warn' : 'error',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
      }),
    },
    {
      label: '체크인 완료율',
      value: formatPercent(completedCheckInRate),
      description: '전체 체크인 기준 완료 비율',
      tone: completedCheckInRate >= 80 ? 'success' : completedCheckInRate >= 60 ? 'warn' : 'error',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
      }),
    },
    {
      label: '증빙 보유율',
      value: formatPercent(evidenceCoverageRate),
      description: '선택 기간 중 증빙 항목이 확인된 KPI 기준',
      tone: evidenceCoverageRate >= 75 ? 'success' : evidenceCoverageRate >= 50 ? 'warn' : 'error',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
        status: 'AT_RISK',
      }),
    },
  ]

  return {
    averageAchievementRate,
    trend,
    cards,
    departmentRows,
    exceptions: departmentRows.slice(0, 5),
  }
}

function buildMonthlyTrend(records: StatisticsMonthlyRecord[]) {
  const grouped = groupBy(
    records.filter((record) => typeof record.achievementRate === 'number'),
    (record) => record.yearMonth
  )

  return [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([yearMonth, rows]) => ({
      label: yearMonth,
      value: round(
        rows.reduce((sum, row) => sum + (row.achievementRate ?? 0), 0) / rows.length
      ),
    }))
}

function buildRiskSummary(params: {
  departments: StatisticsDepartmentLite[]
  employees: StatisticsEmployeeScope[]
  latestMonthlyByKpi: Map<string, StatisticsMonthlyRecord>
  personalKpis: StatisticsPersonalKpi[]
  evaluations: StatisticsEvaluationRecord[]
  appeals: StatisticsAppeal[]
  selectedCycleId: string
  selectedYear: number
  selectedDepartmentId: string
}) {
  const latestByDept = new Map<string, StatisticsMonthlyRecord[]>()
  for (const goal of params.personalKpis) {
    const latest = params.latestMonthlyByKpi.get(goal.id)
    if (!latest) continue
    const bucket = latestByDept.get(goal.employee.deptId) ?? []
    bucket.push(latest)
    latestByDept.set(goal.employee.deptId, bucket)
  }

  const rejectedByDept = new Map<string, number>()
  for (const evaluation of params.evaluations) {
    if (evaluation.status !== 'REJECTED') continue
    rejectedByDept.set(
      evaluation.target.deptId,
      (rejectedByDept.get(evaluation.target.deptId) ?? 0) + 1
    )
  }

  const activeAppealByDept = new Map<string, number>()
  for (const appeal of params.appeals) {
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(appeal.status)) continue
    const deptId = appeal.evaluation.target.deptId
    activeAppealByDept.set(deptId, (activeAppealByDept.get(deptId) ?? 0) + 1)
  }

  const departmentRows = params.departments
    .filter((department) => params.employees.some((employee) => employee.deptId === department.id))
    .map((department) => {
      const latestRecords = latestByDept.get(department.id) ?? []
      const lowAchievementCount = latestRecords.filter(
        (record) => typeof record.achievementRate === 'number' && record.achievementRate < 80
      ).length
      const missingEvidenceCount = latestRecords.filter(
        (record) => countAttachmentItems(record.attachments) === 0
      ).length
      const rejectedEvaluationCount = rejectedByDept.get(department.id) ?? 0
      const activeAppealCount = activeAppealByDept.get(department.id) ?? 0
      const riskScore =
        lowAchievementCount + missingEvidenceCount + rejectedEvaluationCount + activeAppealCount

      return {
        departmentId: department.id,
        departmentName: department.deptName,
        lowAchievementCount,
        missingEvidenceCount,
        rejectedEvaluationCount,
        activeAppealCount,
        riskScore,
        href:
          activeAppealCount > 0
            ? buildAppealHref(params.selectedCycleId)
            : buildGoalAlignmentHref({
                cycleId: params.selectedCycleId,
                year: params.selectedYear,
                departmentId: department.id,
                status: 'AT_RISK',
              }),
      }
    })
    .sort((left, right) => right.riskScore - left.riskScore || left.departmentName.localeCompare(right.departmentName, 'ko'))

  const lowAchievementCount = departmentRows.reduce((sum, row) => sum + row.lowAchievementCount, 0)
  const missingEvidenceCount = departmentRows.reduce((sum, row) => sum + row.missingEvidenceCount, 0)
  const activeAppealCount = departmentRows.reduce((sum, row) => sum + row.activeAppealCount, 0)

  const cards: StatisticsMetricCard[] = [
    {
      label: '80% 미만 실적 건수',
      value: String(lowAchievementCount),
      description: '최신 월간 실적 기준',
      tone: lowAchievementCount > 0 ? 'warn' : 'success',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
        status: 'AT_RISK',
      }),
    },
    {
      label: '장애 요인 기록',
      value: String(
        [...params.latestMonthlyByKpi.values()].filter((record) => record.obstacles?.trim()).length
      ),
      description: '최신 월간 기록 기준',
      tone:
        [...params.latestMonthlyByKpi.values()].filter((record) => record.obstacles?.trim()).length > 0
          ? 'warn'
          : 'success',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
        status: 'AT_RISK',
      }),
    },
    {
      label: '근거 부족 건수',
      value: String(missingEvidenceCount),
      description: '증빙이 없는 최신 KPI 기록',
      tone: missingEvidenceCount > 0 ? 'warn' : 'success',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
        status: 'AT_RISK',
      }),
    },
    {
      label: '이의제기 건수',
      value: String(activeAppealCount),
      description: '제출 또는 검토 중인 이의제기',
      tone: activeAppealCount > 0 ? 'warn' : 'neutral',
      href: buildAppealHref(params.selectedCycleId),
    },
  ]

  return {
    riskDepartmentCount: departmentRows.filter((row) => row.riskScore > 0).length,
    cards,
    departmentRows: departmentRows.slice(0, 8),
  }
}

function buildStatisticsQualitySummary(records: StatisticsEvaluationRecord[]) {
  const summary = {
    insufficientEvidenceWarningCount: 0,
    biasWarningCount: 0,
    coachingGapCount: 0,
  }

  for (const record of records) {
    const warnings = buildEvaluationQualityWarnings({
      comment: record.comment ?? '',
      evidence: buildStatisticsEvaluationEvidence(record),
      mode: 'draft',
    })

    if (warnings.some((warning) => warning.key === 'missing-evidence')) {
      summary.insufficientEvidenceWarningCount += 1
    }
    if (warnings.some((warning) => warning.key === 'bias-risk' || warning.key === 'emotional-tone')) {
      summary.biasWarningCount += 1
    }
    if (warnings.some((warning) => warning.key === 'missing-action')) {
      summary.coachingGapCount += 1
    }
  }

  return summary
}

function buildStatisticsEvaluationEvidence(record: StatisticsEvaluationRecord) {
  const kpiSummaries = record.items.map((item) => {
    const parts = [
      item.personalKpi.kpiName,
      `가중치 ${item.personalKpi.weight}%`,
      item.personalKpi.linkedOrgKpi
        ? `연결 목표 ${item.personalKpi.linkedOrgKpi.department.deptName} / ${item.personalKpi.linkedOrgKpi.kpiName}`
        : '연결 목표 없음',
    ]

    const latestMonthly = item.personalKpi.monthlyRecords[0]
    if (typeof latestMonthly?.achievementRate === 'number') {
      parts.push(`최근 달성률 ${latestMonthly.achievementRate}%`)
    }

    return parts.join(' / ')
  })

  const monthlySummaries = record.items
    .flatMap((item) =>
      item.personalKpi.monthlyRecords.slice(0, 1).map((monthly) =>
        [
          `${item.personalKpi.kpiName} / ${monthly.yearMonth}`,
          typeof monthly.achievementRate === 'number'
            ? `달성률 ${monthly.achievementRate}%`
            : '달성률 미집계',
          monthly.activities || monthly.obstacles || monthly.efforts || '상세 메모 없음',
        ].join(' / ')
      )
    )
    .slice(0, 6)

  const keyPoints = record.items
    .map((item) => {
      if (item.itemComment?.trim()) {
        return `${item.personalKpi.kpiName}: ${item.itemComment.trim()}`
      }
      const latestMonthly = item.personalKpi.monthlyRecords[0]
      if (latestMonthly?.activities?.trim()) {
        return `${item.personalKpi.kpiName}: ${latestMonthly.activities.trim()}`
      }
      return ''
    })
    .filter(Boolean)
    .slice(0, 6)

  return buildEvaluationAssistEvidenceView({
    kpiSummaries,
    monthlySummaries,
    noteSummaries: [],
    keyPoints,
  })
}

function buildReadinessProxy(params: {
  aiCycleId: string
  passThreshold: number
  aiAssignments: Array<{
    id: string
    employeeId: string
    track: string
    employee: {
      id: string
      position: Position
      department: {
        deptName: string
      }
    }
    result: {
      finalScore: number
      certificationStatus: AiCompetencyCertificationStatus
    } | null
  }>
  aiAttempts: Array<{
    employeeId: string
    status: string
    passStatus: string | null
  }>
  aiResults: Array<{
    employee: {
      id: string
      position: Position
      department: {
        deptName: string
      }
    }
    assignment: {
      track: string
    }
    finalScore: number
    certificationStatus: AiCompetencyCertificationStatus
  }>
  effectiveOutcomeRows: Array<{
    employee: StatisticsEmployeeScope
    evaluation: StatisticsEvaluationRecord
  }>
}) {
  const href = `/evaluation/ai-competency/admin?cycleId=${encodeURIComponent(params.aiCycleId)}`
  if (!params.aiAssignments.length) {
    return buildEmptyReadinessProxy('연결된 AI 역량 평가 결과가 없어 준비도 지표를 표시하지 않습니다.', href)
  }

  const completedFirstRoundCount = params.aiAttempts.filter((attempt) =>
    ['SUBMITTED', 'SCORED'].includes(attempt.status)
  ).length
  const passedFirstRoundCount = params.aiAttempts.filter((attempt) => attempt.passStatus === 'PASSED').length
  const certificationCount = params.aiResults.filter((result) =>
    result.certificationStatus !== 'NOT_CERTIFIED'
  ).length
  const effectiveByEmployee = new Map(params.effectiveOutcomeRows.map((row) => [row.employee.id, row.evaluation] as const))
  const readyTalentCount = params.aiResults.filter((result) => {
    if (result.certificationStatus === 'NOT_CERTIFIED') return false
    const performance = effectiveByEmployee.get(result.employee.id)
    if (!performance) return false
    if (typeof performance.totalScore === 'number' && performance.totalScore >= 90) return true
    return ['S', 'A'].includes(resolveGradeName(performance, ensureGradeSettings([])) ?? '')
  }).length

  const trackDistribution = [...groupBy(params.aiResults, (result) => result.assignment.track).entries()].map(
    ([track, rows]) => ({
      label: track,
      averageScore: round(rows.reduce((sum, row) => sum + row.finalScore, 0) / rows.length),
      count: rows.length,
      passRate: toPercent(
        rows.filter((row) => row.finalScore >= params.passThreshold).length,
        rows.length
      ),
    })
  )
  const departmentRows = [...groupBy(params.aiResults, (result) => result.employee.department.deptName).entries()]
    .map(([departmentName, rows]) => ({
      departmentName,
      averageScore: round(rows.reduce((sum, row) => sum + row.finalScore, 0) / rows.length),
      count: rows.length,
    }))
    .sort((left, right) => right.averageScore - left.averageScore)
  const feederPool = [...groupBy(params.aiResults, (result) => result.employee.position).entries()]
    .map(([position, rows]) => ({
      positionLabel: POSITION_LABELS[position] ?? position,
      count: rows.filter((row) => row.certificationStatus !== 'NOT_CERTIFIED').length,
    }))
    .sort((left, right) => right.count - left.count)

  const cards: StatisticsMetricCard[] = [
    {
      label: 'AI 역량 완료율',
      value: formatPercent(toPercent(completedFirstRoundCount, params.aiAssignments.length)),
      description: '1차 평가 완료 기준',
      tone: completedFirstRoundCount > 0 ? 'success' : 'neutral',
      href,
    },
    {
      label: '합격률',
      value: formatPercent(toPercent(passedFirstRoundCount, params.aiAssignments.length)),
      description: '1차 합격 기준',
      tone: 'neutral',
      href,
    },
    {
      label: '인증률',
      value: formatPercent(toPercent(certificationCount, params.aiAssignments.length)),
      description: '내부/외부 인증 포함',
      tone: certificationCount > 0 ? 'success' : 'warn',
      href,
    },
    {
      label: '고성과·인증 인원',
      value: String(readyTalentCount),
      description: '성과와 인증을 함께 충족한 인원',
      tone: readyTalentCount > 0 ? 'success' : 'neutral',
      href,
    },
  ]

  return {
    readyTalentCount,
    href,
    section: {
      state: 'ready' as const,
      notice: '현재 성과와 AI 역량 결과를 함께 본 준비도 프록시이며, 공식 승계 지표는 아닙니다.',
      cards,
      trackDistribution,
      departmentRows: departmentRows.slice(0, 6),
      feederPool: feederPool.filter((item) => item.count > 0),
      href,
    },
  }
}

function buildEmptyReadinessProxy(message?: string, href = '/evaluation/ai-competency/admin') {
  return {
    readyTalentCount: 0,
    href,
    section: {
      state: 'empty' as const,
      message,
      notice: '현재 성과와 AI 역량 결과를 함께 본 준비도 프록시이며, 공식 승계 지표는 아닙니다.',
      cards: [],
      trackDistribution: [],
      departmentRows: [],
      feederPool: [],
      href,
    },
  }
}

function buildFairnessCards(params: {
  performanceSummary: {
    departmentRows: Array<{ isOutlier: boolean }>
    outlierDepartmentCount: number
    missingAdjustmentReasonCount: number
  }
  qualitySummary: {
    insufficientEvidenceWarningCount: number
    biasWarningCount: number
    coachingGapCount: number
  }
  aiAlignmentSummary: StatisticsAlignmentSummary
  selectedCycleId: string
  selectedDepartmentId: string
}): StatisticsMetricCard[] {
  const detailHref = buildCeoAdjustHref({
    cycleId: params.selectedCycleId,
    departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
  })

  return [
    {
      label: '보정 적용률',
      value: formatPercent(
        toPercent(
          params.performanceSummary.departmentRows.filter((row) => row.isOutlier).length,
          params.performanceSummary.departmentRows.length
        )
      ),
      description: '조직 분포 이상 조직 기준',
      tone: params.performanceSummary.outlierDepartmentCount > 0 ? 'warn' : 'success',
      href: detailHref,
    },
    {
      label: '분포 이상 조직 수',
      value: String(params.performanceSummary.outlierDepartmentCount),
      description: '회사 분포 대비 편차가 큰 조직',
      tone: params.performanceSummary.outlierDepartmentCount > 0 ? 'warn' : 'success',
      href: detailHref,
    },
    {
      label: '조정 사유 미기재',
      value: String(params.performanceSummary.missingAdjustmentReasonCount),
      description: '대표이사 조정 의견 미기재',
      tone: params.performanceSummary.missingAdjustmentReasonCount > 0 ? 'warn' : 'success',
      href: detailHref,
    },
    {
      label: 'AI 정합성 경고',
      value: String(params.aiAlignmentSummary.warningCount),
      description:
        params.aiAlignmentSummary.totalCount > 0
          ? `AI 브리핑 ${params.aiAlignmentSummary.totalCount}건 기준`
          : 'AI 브리핑 미생성',
      tone: params.aiAlignmentSummary.warningCount > 0 ? 'warn' : 'neutral',
      href: detailHref,
    },
  ]
}

function buildStatisticsSummaryCards(params: {
  evaluationProgressRate?: number
  finalizedRate?: number
  averageAchievementRate?: number
  riskDepartmentCount?: number
  fairnessWarningCount?: number
  readinessReadyCount?: number
  selectedCycleId: string
  aiCycleHref: string
  selectedYear: number
  selectedDepartmentId: string
}): StatisticsMetricCard[] {
  return [
    {
      label: '평가 진행률',
      value: formatPercent(params.evaluationProgressRate),
      description: '대상 평가 기준 예상 단계 진행 비율',
      tone:
        typeof params.evaluationProgressRate === 'number'
          ? params.evaluationProgressRate >= 85
            ? 'success'
            : params.evaluationProgressRate >= 60
              ? 'warn'
              : 'error'
          : 'neutral',
      href: buildPerformanceHref(params.selectedCycleId),
    },
    {
      label: '최종 확정률',
      value: formatPercent(params.finalizedRate),
      description: '대상 평가 기준 최종 확정 비율',
      tone:
        typeof params.finalizedRate === 'number'
          ? params.finalizedRate >= 85
            ? 'success'
            : params.finalizedRate >= 60
              ? 'warn'
              : 'error'
          : 'neutral',
      href: buildEvaluationResultsHref(params.selectedCycleId),
    },
    {
      label: '평균 KPI 달성률',
      value: formatPercent(params.averageAchievementRate),
      description: '선택 기간 최신 월간 기록 기준',
      tone:
        typeof params.averageAchievementRate === 'number'
          ? params.averageAchievementRate >= 90
            ? 'success'
            : params.averageAchievementRate >= 75
              ? 'warn'
              : 'error'
          : 'neutral',
      href: buildGoalAlignmentHref({
        cycleId: params.selectedCycleId,
        year: params.selectedYear,
        departmentId: params.selectedDepartmentId === 'ALL' ? undefined : params.selectedDepartmentId,
      }),
    },
    {
      label: '리스크 조직 수',
      value: formatCount(params.riskDepartmentCount),
      description: '성과·근거·이의 신청 신호가 있는 조직 수',
      tone:
        typeof params.riskDepartmentCount === 'number'
          ? params.riskDepartmentCount > 0
            ? 'warn'
            : 'success'
          : 'neutral',
      href: '#risk-section',
    },
    {
      label: '공정성 경고 건수',
      value: formatCount(params.fairnessWarningCount),
      description: '분포·정합성·조정 사유 기준 경고 건수',
      tone:
        typeof params.fairnessWarningCount === 'number'
          ? params.fairnessWarningCount > 0
            ? 'warn'
            : 'success'
          : 'neutral',
      href: '#fairness-section',
    },
    {
      label: '준비도 확보 인원(프록시)',
      value: formatCount(params.readinessReadyCount),
      description: '성과와 인증 동시 충족',
      tone:
        typeof params.readinessReadyCount === 'number'
          ? params.readinessReadyCount > 0
            ? 'success'
            : 'neutral'
          : 'neutral',
      href: params.aiCycleHref,
    },
  ]
}

function buildEvaluationExceptionCards(params: {
  returnedCount: number
  unassignedCount: number
  overdueCount: number
  pendingCalibrationCount: number
  selectedCycleId: string
}): StatisticsMetricCard[] {
  return [
    {
      label: '반려',
      value: String(params.returnedCount),
      description: '재작성 또는 재검토 필요',
      tone: params.returnedCount > 0 ? 'warn' : 'success',
      href: buildPerformanceHref(params.selectedCycleId),
    },
    {
      label: '미배정',
      value: String(params.unassignedCount),
      description: '핵심 승인 단계 기준',
      tone: params.unassignedCount > 0 ? 'error' : 'success',
      href: buildPerformanceAssignmentsHref(params.selectedCycleId),
    },
    {
      label: '지연',
      value: String(params.overdueCount),
      description: '기한이 지난 단계',
      tone: params.overdueCount > 0 ? 'warn' : 'success',
      href: buildPerformanceAssignmentsHref(params.selectedCycleId),
    },
    {
      label: '보정 대기',
      value: String(params.pendingCalibrationCount),
      description: '최종 검토 이후 보정 대기',
      tone: params.pendingCalibrationCount > 0 ? 'warn' : 'neutral',
      href: buildCeoAdjustHref({ cycleId: params.selectedCycleId }),
    },
  ]
}

function buildAlignmentDistributionRows(summary: StatisticsAlignmentSummary) {
  const orderedStatuses: EvaluationPerformanceBriefingAlignmentStatus[] = [
    'MATCHED',
    'MOSTLY_MATCHED',
    'REVIEW_NEEDED',
    'POSSIBLE_OVER_RATING',
    'POSSIBLE_UNDER_RATING',
    'INSUFFICIENT_EVIDENCE',
  ]

  return orderedStatuses.map((status) => ({
    label: getEvaluationPerformanceBriefingAlignmentLabel(status),
    count: summary.counts[status],
  }))
}

async function loadStatisticsOptional<T>(params: {
  alerts: StatisticsPageAlert[]
  title: string
  description: string
  fallback: T
  load: () => Promise<T>
}) {
  try {
    return await params.load()
  } catch (error) {
    console.error('[statistics-page]', params.title, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
      tone: 'warn',
    })
    return params.fallback
  }
}

function buildPerformanceHref(cycleId: string) {
  return `/evaluation/performance?cycleId=${encodeURIComponent(cycleId)}`
}

function buildPerformanceAssignmentsHref(cycleId: string) {
  return `/admin/performance-assignments?cycleId=${encodeURIComponent(cycleId)}`
}

function buildCeoAdjustHref(params: { cycleId: string; departmentId?: string }) {
  const search = new URLSearchParams({ cycleId: params.cycleId })
  if (params.departmentId) {
    search.set('scope', params.departmentId)
  }
  return `/evaluation/ceo-adjust?${search.toString()}`
}

function buildGoalAlignmentHref(params: {
  cycleId: string
  year: number
  departmentId?: string
  status?: 'AT_RISK'
}) {
  const search = new URLSearchParams({
    cycleId: params.cycleId,
    year: String(params.year),
  })
  if (params.departmentId) search.set('departmentId', params.departmentId)
  if (params.status) search.set('status', params.status)
  return `/admin/goal-alignment?${search.toString()}`
}

function buildAppealHref(cycleId: string) {
  return `/evaluation/appeal?cycleId=${encodeURIComponent(cycleId)}`
}

function buildEvaluationResultsHref(cycleId: string) {
  return `/evaluation/results?cycleId=${encodeURIComponent(cycleId)}`
}

function buildStatisticsFilterHref(params: {
  cycleId: string
  departmentId?: string
}) {
  const search = new URLSearchParams({ cycleId: params.cycleId })
  if (params.departmentId) search.set('departmentId', params.departmentId)
  return `/statistics?${search.toString()}`
}
