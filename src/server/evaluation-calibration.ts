import type {
  CheckInStatus,
  CheckInType,
  CycleStatus,
  Position,
  Prisma,
  SystemRole,
} from '@prisma/client'
import { calcPdcaScore } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { loadAiCompetencySyncedResults } from '@/server/ai-competency'

export type CalibrationPageState = 'ready' | 'empty' | 'permission-denied' | 'error'
export type CalibrationStatus = 'READY' | 'CALIBRATING' | 'REVIEW_CONFIRMED' | 'FINAL_LOCKED'

export type CalibrationCandidate = {
  id: string
  employeeId: string
  employeeName: string
  departmentId: string
  department: string
  jobGroup?: string
  rawScore: number
  originalGrade: string
  adjustedGrade?: string
  adjusted: boolean
  reason?: string
  evaluatorName?: string
  reviewerName?: string
  performanceScore?: number
  competencyScore?: number
  evaluationComment?: string
  reviewerComment?: string
  needsAttention: boolean
  reasonMissing: boolean
  suggestedReason?: string
  monthlySummary: Array<{
    month: string
    achievementRate?: number
    comment?: string
  }>
  kpiSummary: Array<{
    id: string
    title: string
    target?: number
    actual?: number
    achievementRate?: number
    unit?: string
  }>
  checkins: Array<{
    date: string
    type: CheckInType
    status: CheckInStatus
    summary: string
  }>
}

export type CalibrationViewModel = {
  actorRole: 'ROLE_ADMIN' | 'ROLE_CEO'
  cycle: {
    id: string
    name: string
    year: number
    status: CalibrationStatus
    rawStatus: CycleStatus
    lockedAt?: string
    organizationName: string
    selectedScopeId: string
  }
  scopeOptions: Array<{
    id: string
    label: string
  }>
  gradeOptions: Array<{
    id: string
    grade: string
    targetRatio?: number
  }>
  summary: {
    totalCount: number
    adjustedCount: number
    pendingCount: number
    adjustedRate: number
    outlierOrgCount?: number
    highGradeRatio: number
    lowGradeRatio: number
    reviewedCount: number
  }
  distributions: {
    company: Array<{ grade: string; count: number; ratio: number; targetRatio?: number }>
    byDepartment: Array<{
      departmentId: string
      department: string
      grades: Array<{ grade: string; count: number; ratio: number; targetRatio?: number }>
      totalCount: number
      deltaScore: number
      isOutlier: boolean
    }>
    byJobGroup: Array<{
      jobGroup: string
      grades: Array<{ grade: string; count: number; ratio: number; targetRatio?: number }>
      totalCount: number
    }>
  }
  candidates: CalibrationCandidate[]
  timeline: Array<{
    id: string
    at: string
    actor: string
    action: string
    employeeName?: string
    fromGrade?: string
    toGrade?: string
    reason?: string
    actionType: 'adjust' | 'lock' | 'reopen' | 'review' | 'system'
  }>
  checklist: {
    missingReasonCount: number
    unresolvedCandidateCount: number
    readyToLock: boolean
  }
}

export type CalibrationPageData = {
  state: CalibrationPageState
  availableCycles: Array<{
    id: string
    name: string
    year: number
    organizationName: string
    status: CycleStatus
  }>
  selectedCycleId?: string
  selectedScopeId?: string
  viewModel?: CalibrationViewModel
  message?: string
}

type EvaluationRecord = Prisma.EvaluationGetPayload<{
  include: {
    target: {
      include: {
        department: true
      }
    }
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

type CheckInRecord = Prisma.CheckInGetPayload<{
  select: {
    ownerId: true
    scheduledDate: true
    actualDate: true
    checkInType: true
    status: true
    keyTakeaways: true
    managerNotes: true
    ownerNotes: true
  }
}>

type AuditLogRecord = Prisma.AuditLogGetPayload<{
  select: {
    id: true
    action: true
    entityType: true
    entityId: true
    userId: true
    oldValue: true
    newValue: true
    timestamp: true
  }
}>

type GradeSettingLite = {
  id: string
  gradeName: string
  minScore: number
  maxScore: number
  targetDistRate: number | null
  gradeOrder: number
}

type CandidateGroup = {
  target: EvaluationRecord['target']
  finalEvaluation: EvaluationRecord | null
  adjustedEvaluation: EvaluationRecord | null
  reviewerEvaluation: EvaluationRecord | null
}

type CalibrationAuditPayload = {
  targetId?: string
  targetName?: string
  department?: string
  fromGrade?: string
  toGrade?: string
  rawScore?: number
  reason?: string
  confirmedBy?: string
}

export async function getEvaluationCalibrationPageData(params: {
  userId: string
  role: SystemRole
  cycleId?: string
  scopeId?: string
}): Promise<CalibrationPageData> {
  try {
    if (!['ROLE_ADMIN', 'ROLE_CEO'].includes(params.role)) {
      return {
        state: 'permission-denied',
        availableCycles: [],
        message: '등급 조정 화면은 관리자 또는 CEO만 접근할 수 있습니다.',
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
        message: '등급 조정 화면을 조회할 직원 정보를 찾지 못했습니다.',
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
        message: '캘리브레이션을 진행할 평가 주기가 아직 없습니다.',
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles.find((cycle) => cycle.status !== 'SETUP') ??
      cycles[0]

    const [gradeSettings, evaluations, checkIns] = await Promise.all([
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
          targetDistRate: true,
          gradeOrder: true,
        },
        orderBy: {
          gradeOrder: 'asc',
        },
      }),
      prisma.evaluation.findMany({
        where: {
          evalCycleId: selectedCycle.id,
          evalStage: {
            in: ['FIRST', 'SECOND', 'FINAL', 'CEO_ADJUST'],
          },
        },
        include: {
          target: {
            include: {
              department: true,
            },
          },
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
        orderBy: [{ evalStage: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.checkIn.findMany({
        where: {
          scheduledDate: {
            gte: new Date(`${selectedCycle.evalYear}-01-01T00:00:00.000Z`),
            lte: new Date(`${selectedCycle.evalYear}-12-31T23:59:59.999Z`),
          },
        },
        select: {
          ownerId: true,
          scheduledDate: true,
          actualDate: true,
          checkInType: true,
          status: true,
          keyTakeaways: true,
          managerNotes: true,
          ownerNotes: true,
        },
      }),
    ])

    if (!evaluations.length) {
      return {
        state: 'empty',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        message: '캘리브레이션을 진행할 평가 결과가 아직 없습니다.',
      }
    }

    const adjustedEvaluationIds = evaluations
      .filter((evaluation) => evaluation.evalStage === 'CEO_ADJUST')
      .map((evaluation) => evaluation.id)

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entityType: 'EvalCycle',
            entityId: selectedCycle.id,
          },
          adjustedEvaluationIds.length
            ? {
                entityType: 'Evaluation',
                entityId: {
                  in: adjustedEvaluationIds,
                },
              }
            : undefined,
        ].filter(Boolean) as Prisma.AuditLogWhereInput[],
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    if (!gradeSettings.length) {
      return {
        state: 'empty',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        message: '활성화된 등급 기준이 없어 캘리브레이션 분포를 계산할 수 없습니다.',
      }
    }

    const groups = groupEvaluationsByTarget(evaluations)
    const scopeOptions = buildScopeOptions(groups)
    const selectedScopeId =
      params.scopeId && (params.scopeId === 'all' || scopeOptions.some((option) => option.id === params.scopeId))
        ? params.scopeId
        : 'all'

    const filteredGroups = filterGroupsByScope(groups, selectedScopeId)
    if (!filteredGroups.length) {
      return {
        state: 'empty',
        availableCycles,
        selectedCycleId: selectedCycle.id,
        selectedScopeId,
        message: '선택한 범위에 표시할 조정 대상이 없습니다.',
      }
    }

    const aiCompetencyResults = await loadAiCompetencySyncedResults({
      evalCycleIds: [selectedCycle.id],
      employeeIds: filteredGroups.map((group) => group.target.id),
    }).catch((error) => {
      console.error('[evaluation-calibration] AI competency sync fallback', error)
      return new Map()
    })

    const checkInMap = buildCheckInMap(checkIns)
    const byDepartment = buildDepartmentDistributions(filteredGroups, gradeSettings)
    const outlierDepartmentIds = new Set(
      byDepartment.filter((department) => department.isOutlier).map((department) => department.departmentId)
    )
    const decoratedCandidates = filteredGroups.map((group) =>
      buildCalibrationCandidate({
        group,
        gradeSettings,
        checkIns: checkInMap.get(group.target.id) ?? [],
        departmentOutlierMap: outlierDepartmentIds,
        aiCompetencyScore: aiCompetencyResults.get(`${selectedCycle.id}:${group.target.id}`)?.finalScore,
      })
    )

    const summary = buildSummary(decoratedCandidates, byDepartment)
    const cycleStatus = resolveCalibrationStatus(selectedCycle, auditLogs, summary.adjustedCount)
    const checklist = buildChecklist(decoratedCandidates)
    const timeline = buildCalibrationTimeline({
      cycle: selectedCycle,
      auditLogs,
      groups: filteredGroups,
      gradeSettings,
    })

    return {
      state: 'ready',
      availableCycles,
      selectedCycleId: selectedCycle.id,
      selectedScopeId,
      viewModel: {
        actorRole: params.role === 'ROLE_CEO' ? 'ROLE_CEO' : 'ROLE_ADMIN',
        cycle: {
          id: selectedCycle.id,
          name: selectedCycle.cycleName,
          year: selectedCycle.evalYear,
          status: cycleStatus,
          rawStatus: selectedCycle.status,
          lockedAt: resolveLockedAt(selectedCycle, auditLogs),
          organizationName: employee.department.organization.name,
          selectedScopeId,
        },
        scopeOptions,
        gradeOptions: gradeSettings.map((grade) => ({
          id: grade.id,
          grade: grade.gradeName,
          targetRatio: grade.targetDistRate ?? undefined,
        })),
        summary,
        distributions: {
          company: buildGradeDistribution(decoratedCandidates, gradeSettings),
          byDepartment,
          byJobGroup: buildJobGroupDistributions(decoratedCandidates, gradeSettings),
        },
        candidates: decoratedCandidates,
        timeline,
        checklist,
      },
    }
  } catch (error) {
    console.error('[evaluation-calibration] failed to build page data', error)
    return {
      state: 'error',
      availableCycles: [],
      message: '등급 조정 화면을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
}

function groupEvaluationsByTarget(evaluations: EvaluationRecord[]) {
  const grouped = new Map<string, CandidateGroup>()

  for (const evaluation of evaluations) {
    const current =
      grouped.get(evaluation.targetId) ??
      ({
        target: evaluation.target,
        finalEvaluation: null,
        adjustedEvaluation: null,
        reviewerEvaluation: null,
      } satisfies CandidateGroup)

    if (evaluation.evalStage === 'FINAL') current.finalEvaluation = evaluation
    if (evaluation.evalStage === 'CEO_ADJUST') current.adjustedEvaluation = evaluation
    if (evaluation.evalStage === 'SECOND') current.reviewerEvaluation = evaluation
    if (!current.finalEvaluation && evaluation.evalStage === 'FIRST') current.finalEvaluation = evaluation

    grouped.set(evaluation.targetId, current)
  }

  return [...grouped.values()].filter((group) => group.finalEvaluation || group.adjustedEvaluation)
}

function buildScopeOptions(groups: CandidateGroup[]) {
  const options = [
    {
      id: 'all',
      label: '전사 전체',
    },
  ]

  const seen = new Set<string>()
  for (const group of groups) {
    if (seen.has(group.target.department.id)) continue
    seen.add(group.target.department.id)
    options.push({
      id: group.target.department.id,
      label: group.target.department.deptName,
    })
  }

  return options
}

function filterGroupsByScope(groups: CandidateGroup[], selectedScopeId: string) {
  if (!selectedScopeId || selectedScopeId === 'all') return groups
  return groups.filter((group) => group.target.department.id === selectedScopeId)
}

function buildCheckInMap(checkIns: CheckInRecord[]) {
  const map = new Map<string, CheckInRecord[]>()
  for (const record of checkIns) {
    const current = map.get(record.ownerId) ?? []
    current.push(record)
    map.set(record.ownerId, current)
  }
  return map
}

function buildCalibrationCandidate(params: {
  group: CandidateGroup
  gradeSettings: GradeSettingLite[]
  checkIns: CheckInRecord[]
  departmentOutlierMap: Set<string>
  aiCompetencyScore?: number
}) {
  const { group, gradeSettings } = params
  const baseEvaluation = group.finalEvaluation ?? group.adjustedEvaluation
  const adjustedEvaluation = group.adjustedEvaluation
  const rawScore = calculateEffectiveEvaluationScore({
    evaluation: baseEvaluation ?? adjustedEvaluation ?? null,
    fallback: baseEvaluation?.totalScore ?? adjustedEvaluation?.totalScore ?? 0,
    syncedCompetencyScore: params.aiCompetencyScore,
  })
  const originalGrade = resolveGradeName(
    group.finalEvaluation?.gradeId ?? null,
    group.finalEvaluation?.totalScore ?? rawScore,
    gradeSettings
  )
  const adjustedGrade = resolveGradeName(
    adjustedEvaluation?.gradeId ?? null,
    adjustedEvaluation?.totalScore ?? rawScore,
    gradeSettings
  )
  const adjusted = Boolean(adjustedEvaluation && adjustedGrade && adjustedGrade !== originalGrade)
  const reason = adjustedEvaluation?.comment?.trim() || undefined
  const reasonMissing = adjusted && !reason
  const performanceScore = calcEvaluationAxisScore(baseEvaluation, 'performance')
  const competencyScore = params.aiCompetencyScore ?? calcEvaluationAxisScore(baseEvaluation, 'competency')
  const monthlySummary = buildMonthlySummary(baseEvaluation)
  const kpiSummary = buildKpiSummary(baseEvaluation)
  const checkins = params.checkIns
    .sort((a, b) => (b.actualDate ?? b.scheduledDate).getTime() - (a.actualDate ?? a.scheduledDate).getTime())
    .slice(0, 3)
    .map((record) => ({
      date: (record.actualDate ?? record.scheduledDate).toISOString(),
      type: record.checkInType,
      status: record.status,
      summary:
        record.keyTakeaways ||
        record.managerNotes ||
        record.ownerNotes ||
        '최근 체크인에 남겨진 요약 메모가 없습니다.',
    }))

  const nearBoundary = isNearGradeBoundary(rawScore, gradeSettings)
  const needsAttention =
    reasonMissing || nearBoundary || params.departmentOutlierMap.has(group.target.department.id)

  return {
    id: group.target.id,
    employeeId: group.target.empId,
    employeeName: group.target.empName,
    departmentId: group.target.department.id,
    department: group.target.department.deptName,
    jobGroup: resolvePositionLabel(group.target.position),
    rawScore: roundToSingle(rawScore),
    originalGrade: originalGrade ?? '미확정',
    adjustedGrade: adjustedGrade ?? originalGrade ?? '미확정',
    adjusted,
    reason,
    evaluatorName: baseEvaluation?.evaluator.empName,
    reviewerName: group.reviewerEvaluation?.evaluator.empName,
    performanceScore,
    competencyScore,
    evaluationComment: baseEvaluation?.comment ?? '최종 평가 코멘트가 아직 없습니다.',
    reviewerComment:
      group.reviewerEvaluation?.comment ??
      adjustedEvaluation?.comment ??
      '상위 평가자의 별도 코멘트가 없습니다.',
    needsAttention,
    reasonMissing,
    suggestedReason: buildSuggestedReason({
      adjusted,
      reasonMissing,
      isOutlier: params.departmentOutlierMap.has(group.target.department.id),
      nearBoundary,
      rawScore,
      originalGrade: originalGrade ?? '미확정',
      adjustedGrade: adjustedGrade ?? originalGrade ?? '미확정',
    }),
    monthlySummary,
    kpiSummary,
    checkins,
  } satisfies CalibrationCandidate
}

function buildSummary(
  candidates: CalibrationCandidate[],
  byDepartment: CalibrationViewModel['distributions']['byDepartment']
) {
  const adjustedCount = candidates.filter((candidate) => candidate.adjusted).length
  const pendingCount = candidates.filter((candidate) => candidate.needsAttention && !candidate.adjusted).length
  const reviewedCount = candidates.length - pendingCount
  const highGradeRatio =
    candidates.length > 0
      ? roundToSingle(
          (candidates.filter((candidate) => ['S', 'A'].includes(candidate.adjustedGrade ?? candidate.originalGrade)).length /
            candidates.length) *
            100
        )
      : 0
  const lowGradeRatio =
    candidates.length > 0
      ? roundToSingle(
          (candidates.filter((candidate) => ['C', 'D'].includes(candidate.adjustedGrade ?? candidate.originalGrade)).length /
            candidates.length) *
            100
        )
      : 0

  return {
    totalCount: candidates.length,
    adjustedCount,
    pendingCount,
    adjustedRate: candidates.length ? roundToSingle((adjustedCount / candidates.length) * 100) : 0,
    outlierOrgCount: byDepartment.filter((department) => department.isOutlier).length,
    highGradeRatio,
    lowGradeRatio,
    reviewedCount,
  }
}

function buildChecklist(candidates: CalibrationCandidate[]) {
  const missingReasonCount = candidates.filter((candidate) => candidate.adjusted && !candidate.reason?.trim()).length
  const unresolvedCandidateCount = candidates.filter(
    (candidate) => candidate.needsAttention && !candidate.adjusted
  ).length

  return {
    missingReasonCount,
    unresolvedCandidateCount,
    readyToLock: missingReasonCount === 0 && unresolvedCandidateCount === 0 && candidates.length > 0,
  }
}

function buildGradeDistribution(candidates: CalibrationCandidate[], gradeSettings: GradeSettingLite[]) {
  return gradeSettings.map((grade) => {
    const count = candidates.filter(
      (candidate) => (candidate.adjustedGrade ?? candidate.originalGrade) === grade.gradeName
    ).length
    const ratio = candidates.length ? roundToSingle((count / candidates.length) * 100) : 0
    return {
      grade: grade.gradeName,
      count,
      ratio,
      targetRatio: grade.targetDistRate ?? undefined,
    }
  })
}

function buildDepartmentDistributions(
  groups: CandidateGroup[],
  gradeSettings: GradeSettingLite[]
): CalibrationViewModel['distributions']['byDepartment'] {
  const departmentMap = new Map<string, CandidateGroup[]>()

  for (const group of groups) {
    const current = departmentMap.get(group.target.department.id) ?? []
    current.push(group)
    departmentMap.set(group.target.department.id, current)
  }

  return [...departmentMap.entries()].map(([departmentId, items]) => {
    const candidates = items.map((group) =>
      buildCalibrationCandidate({
        group,
        gradeSettings,
        checkIns: [],
        departmentOutlierMap: new Set<string>(),
      })
    )
    const grades = buildGradeDistribution(candidates, gradeSettings)
    const deltaScore = roundToSingle(
      grades.reduce((sum, grade) => sum + Math.abs((grade.targetRatio ?? grade.ratio) - grade.ratio), 0)
    )

    return {
      departmentId,
      department: items[0]?.target.department.deptName ?? '미지정',
      grades,
      totalCount: items.length,
      deltaScore,
      isOutlier: deltaScore >= 18,
    }
  })
}

function buildJobGroupDistributions(
  candidates: CalibrationCandidate[],
  gradeSettings: GradeSettingLite[]
) {
  const map = new Map<string, CalibrationCandidate[]>()
  for (const candidate of candidates) {
    const key = candidate.jobGroup ?? '기타'
    const current = map.get(key) ?? []
    current.push(candidate)
    map.set(key, current)
  }

  return [...map.entries()].map(([jobGroup, rows]) => ({
    jobGroup,
    grades: buildGradeDistribution(rows, gradeSettings),
    totalCount: rows.length,
  }))
}

function buildCalibrationTimeline(params: {
  cycle: {
    id: string
    cycleName: string
    ceoAdjustStart: Date | null
    ceoAdjustEnd: Date | null
    resultOpenStart: Date | null
    status: CycleStatus
  }
  auditLogs: AuditLogRecord[]
  groups: CandidateGroup[]
  gradeSettings: GradeSettingLite[]
}) {
  const timeline: CalibrationViewModel['timeline'] = params.auditLogs.map((log) => {
    const payload = parseCalibrationPayload(log.newValue)
    return {
      id: log.id,
      at: log.timestamp.toISOString(),
      actor: payload.confirmedBy ?? payload.targetName ?? log.userId,
      action: humanizeCalibrationAction(log.action),
      employeeName: payload.targetName,
      fromGrade: payload.fromGrade,
      toGrade: payload.toGrade,
      reason: payload.reason,
      actionType: resolveTimelineActionType(log.action),
    }
  })

  if (!timeline.length) {
    const adjustedGroups = params.groups.filter((group) => {
      const originalGrade = resolveGradeName(
        group.finalEvaluation?.gradeId ?? null,
        group.finalEvaluation?.totalScore ?? null,
        params.gradeSettings
      )
      const adjustedGrade = resolveGradeName(
        group.adjustedEvaluation?.gradeId ?? null,
        group.adjustedEvaluation?.totalScore ?? null,
        params.gradeSettings
      )
      return Boolean(group.adjustedEvaluation && adjustedGrade && adjustedGrade !== originalGrade)
    })

    adjustedGroups.forEach((group, index) => {
      timeline.push({
        id: `synthetic-${group.target.id}-${index}`,
        at: (group.adjustedEvaluation?.updatedAt ?? group.finalEvaluation?.updatedAt ?? new Date()).toISOString(),
        actor: group.adjustedEvaluation?.evaluator.empName ?? '캘리브레이션 운영',
        action: '등급 조정 반영',
        employeeName: group.target.empName,
        fromGrade: resolveGradeName(
          group.finalEvaluation?.gradeId ?? null,
          group.finalEvaluation?.totalScore ?? null,
          params.gradeSettings
        ) ?? '미확정',
        toGrade:
          resolveGradeName(
            group.adjustedEvaluation?.gradeId ?? null,
            group.adjustedEvaluation?.totalScore ?? null,
            params.gradeSettings
          ) ?? '미확정',
        reason: group.adjustedEvaluation?.comment ?? undefined,
        actionType: 'adjust',
      })
    })
  }

  return timeline.sort((a, b) => b.at.localeCompare(a.at))
}

function resolveCalibrationStatus(
  cycle: {
    status: CycleStatus
  },
  auditLogs: AuditLogRecord[],
  adjustedCount: number
): CalibrationStatus {
  if (['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(cycle.status)) {
    return 'FINAL_LOCKED'
  }

  const latestCycleAction = [...auditLogs]
    .reverse()
    .find((log) => log.entityType === 'EvalCycle' && log.action.startsWith('CALIBRATION_'))?.action

  if (latestCycleAction === 'CALIBRATION_LOCKED') return 'FINAL_LOCKED'
  if (latestCycleAction === 'CALIBRATION_REVIEW_CONFIRMED') return 'REVIEW_CONFIRMED'
  if (latestCycleAction === 'CALIBRATION_REOPEN_REQUESTED') return 'CALIBRATING'
  if (adjustedCount > 0 || cycle.status === 'CEO_ADJUST') return 'CALIBRATING'
  return 'READY'
}

function resolveLockedAt(
  cycle: {
    status: CycleStatus
    resultOpenStart: Date | null
  },
  auditLogs: AuditLogRecord[]
) {
  if (['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(cycle.status)) {
    return cycle.resultOpenStart?.toISOString()
  }

  const lockedLog = [...auditLogs]
    .reverse()
    .find((log) => log.entityType === 'EvalCycle' && log.action === 'CALIBRATION_LOCKED')

  return lockedLog?.timestamp.toISOString()
}

function calcEvaluationAxisScore(
  evaluation: EvaluationRecord | null,
  axis: 'performance' | 'competency'
) {
  if (!evaluation) return undefined

  const rows = evaluation.items
    .map((item) => {
      const score = getDisplayScore(item)
      return {
        type: item.personalKpi.kpiType,
        score,
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
        score: number
        weight: number
      } => typeof row.score === 'number'
    )

  if (!rows.length) return undefined
  const weightSum = rows.reduce((sum, row) => sum + row.weight, 0)
  if (weightSum <= 0) return roundToSingle(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
  return roundToSingle(rows.reduce((sum, row) => sum + row.score * row.weight, 0) / weightSum)
}

function calculateEffectiveEvaluationScore(params: {
  evaluation: EvaluationRecord | null
  fallback: number
  syncedCompetencyScore?: number
}) {
  if (!params.evaluation || typeof params.syncedCompetencyScore !== 'number') {
    return params.fallback
  }

  const rows = params.evaluation.items.map((item) => {
    const score = getDisplayScore(item)
    return {
      type: item.personalKpi.kpiType,
      score:
        item.personalKpi.kpiType === 'QUALITATIVE' && typeof params.syncedCompetencyScore === 'number'
          ? params.syncedCompetencyScore
          : score,
      weight: item.personalKpi.weight,
    }
  }).filter((row): row is { type: EvaluationRecord['items'][number]['personalKpi']['kpiType']; score: number; weight: number } => typeof row.score === 'number')

  if (!rows.length) return params.fallback

  const weightSum = rows.reduce((sum, row) => sum + row.weight, 0)
  if (weightSum <= 0) {
    return roundToSingle(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
  }

  return roundToSingle(rows.reduce((sum, row) => sum + row.score * row.weight, 0) / weightSum)
}

function getDisplayScore(
  item: EvaluationRecord['items'][number]
) {
  if (item.quantScore !== null) return roundToSingle(item.quantScore)
  if (item.qualScore !== null) return roundToSingle(item.qualScore)
  if ([item.planScore, item.doScore, item.checkScore, item.actScore].some((value) => value !== null)) {
    return roundToSingle(
      calcPdcaScore(item.planScore ?? 0, item.doScore ?? 0, item.checkScore ?? 0, item.actScore ?? 0)
    )
  }
  if (item.weightedScore !== null && item.personalKpi.weight > 0) {
    return roundToSingle((item.weightedScore * 100) / item.personalKpi.weight)
  }
  return null
}

function buildMonthlySummary(evaluation: EvaluationRecord | null) {
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
    .map((item) => ({
      month: item.month,
      achievementRate:
        item.rates.length > 0
          ? roundToSingle(item.rates.reduce((sum, rate) => sum + rate, 0) / item.rates.length)
          : undefined,
      comment: item.comments[0] ?? undefined,
    }))
}

function buildKpiSummary(evaluation: EvaluationRecord | null) {
  if (!evaluation) return []

  return evaluation.items.slice(0, 4).map((item) => {
    const latestRecord = item.personalKpi.monthlyRecords[0]
    return {
      id: item.personalKpi.id,
      title: item.personalKpi.kpiName,
      target: item.personalKpi.targetValue ?? undefined,
      actual: latestRecord?.actualValue ?? undefined,
      achievementRate: latestRecord?.achievementRate ?? undefined,
      unit: item.personalKpi.unit ?? undefined,
    }
  })
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

  if (totalScore === null || totalScore === undefined) return null
  return (
    gradeSettings.find((grade) => totalScore >= grade.minScore && totalScore <= grade.maxScore)?.gradeName ??
    null
  )
}

function isNearGradeBoundary(score: number, gradeSettings: GradeSettingLite[]) {
  return gradeSettings.some((grade) => Math.abs(score - grade.minScore) <= 2 || Math.abs(score - grade.maxScore) <= 2)
}

function buildSuggestedReason(params: {
  adjusted: boolean
  reasonMissing: boolean
  isOutlier: boolean
  nearBoundary: boolean
  rawScore: number
  originalGrade: string
  adjustedGrade: string
}) {
  if (params.reasonMissing) {
    return '조정 사유가 비어 있습니다. 분포 편차 또는 상대 비교 근거를 명확히 남겨 주세요.'
  }

  if (params.adjusted) {
    return `원등급 ${params.originalGrade}에서 ${params.adjustedGrade}로 조정된 근거를 성과/역량/분포 관점으로 남겨 주세요.`
  }

  if (params.isOutlier) {
    return '해당 조직은 기준 분포 대비 편차가 커서 검토 우선순위가 높습니다.'
  }

  if (params.nearBoundary) {
    return '등급 경계 근처 점수입니다. 타 후보와의 형평성을 함께 검토해 주세요.'
  }

  return '조정 필요성이 없다면 원등급 유지 사유를 메모해 두면 잠금 전 검토에 도움이 됩니다.'
}

function parseCalibrationPayload(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as CalibrationAuditPayload
}

function humanizeCalibrationAction(action: string) {
  switch (action) {
    case 'CALIBRATION_UPDATED':
      return '등급 조정 저장'
    case 'CALIBRATION_CLEARED':
      return '조정 해제'
    case 'CALIBRATION_REVIEW_CONFIRMED':
      return '리뷰 확정'
    case 'CALIBRATION_LOCKED':
      return '최종 잠금'
    case 'CALIBRATION_REOPEN_REQUESTED':
      return '재오픈 요청'
    default:
      return action
  }
}

function resolveTimelineActionType(action: string) {
  if (action === 'CALIBRATION_LOCKED') return 'lock'
  if (action === 'CALIBRATION_REOPEN_REQUESTED') return 'reopen'
  if (action === 'CALIBRATION_REVIEW_CONFIRMED') return 'review'
  if (action.startsWith('CALIBRATION_')) return 'adjust'
  return 'system'
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
