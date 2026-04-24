import type { CycleStatus, SystemRole } from '@prisma/client'
import {
  getEvaluationPerformanceBriefingAlignmentLabel,
  getEvaluationPerformanceBriefingAlignmentTone,
  getEvaluationPerformanceBriefingEvidenceLevelLabel,
  getEvaluationPerformanceBriefingSourceLabel,
  normalizeEvaluationPerformanceBriefingSnapshot,
} from '@/lib/evaluation-performance-briefing'
import { prisma } from '@/lib/prisma'
import type { CalibrationPageData, CalibrationCandidate } from '@/server/evaluation-calibration'
import { getEvaluationCalibrationPageData } from '@/server/evaluation-calibration'

export type CeoFinalPageState = CalibrationPageData['state']

export type CeoFinalBriefingPreview = {
  headline: string
  alignmentLabel: string
  alignmentTone: 'success' | 'warn' | 'error' | 'neutral'
  evidenceLevelLabel: string
  sourceLabel: string
  generatedAt: string
  stale: boolean
}

export type CeoFinalEmployeeDetail = {
  rawScore: number
  evaluationComment?: string
  reviewerComment?: string
  kpiSummary: CalibrationCandidate['kpiSummary']
  monthlySummary: CalibrationCandidate['monthlySummary']
  checkins: CalibrationCandidate['checkins']
  threeYearHistory: CalibrationCandidate['threeYearHistory']
  performanceDetailHref?: string
  briefing?: CeoFinalBriefingPreview | null
}

export type CeoFinalEmployeeRow = {
  id: string
  employeeId: string
  employeeName: string
  positionLabel?: string
  divisionId: string
  divisionName: string
  departmentId: string
  departmentName: string
  originalDivisionHeadRatingId?: string | null
  originalDivisionHeadRating: string
  finalCeoRatingId?: string | null
  finalCeoRating: string
  isAdjusted: boolean
  adjustmentReason?: string
  finalized: boolean
  finalizedAt?: string
  finalizedBy?: string
  finalEvaluationId?: string | null
  adjustedEvaluationId?: string | null
  detailEvaluationId?: string | null
  detail: CeoFinalEmployeeDetail
}

export type CeoFinalDivisionGroup = {
  divisionId: string
  divisionName: string
  totalCount: number
  pendingCount: number
  adjustedCount: number
  finalizedCount: number
  employees: CeoFinalEmployeeRow[]
}

export type CeoFinalSummary = {
  totalCount: number
  pendingCount: number
  adjustedCount: number
  divisionCount: number
  finalizedCount: number
  readyToLock: boolean
}

export type CeoFinalViewModel = {
  actor: {
    userId: string
    displayName: string
    role: SystemRole
    canEdit: boolean
    canFinalizeCycle: boolean
    canReopenCycle: boolean
    readOnly: boolean
  }
  cycle: {
    id: string
    name: string
    year: number
    rawStatus: CycleStatus
    visualStatus: string
    isLocked: boolean
    isReviewConfirmed: boolean
    selectedScopeId: string
  }
  scopeOptions: Array<{
    id: string
    label: string
  }>
  selectedScope: {
    id: string
    label: string
    isAll: boolean
  }
  gradeOptions: Array<{
    id: string
    grade: string
    targetRatio?: number
  }>
  summary: CeoFinalSummary
  groups: CeoFinalDivisionGroup[]
}

export type CeoFinalPageData = {
  state: CeoFinalPageState
  availableCycles: CalibrationPageData['availableCycles']
  selectedCycleId?: string
  message?: string
  viewModel?: CeoFinalViewModel
}

type BriefingLogPreview = {
  headline: string
  alignmentLabel: string
  alignmentTone: 'success' | 'warn' | 'error' | 'neutral'
  evidenceLevelLabel: string
  sourceLabel: string
  generatedAt: string
  loggedAt: string
}

function compareEmployees(left: CeoFinalEmployeeRow, right: CeoFinalEmployeeRow) {
  if (left.finalized !== right.finalized) {
    return left.finalized ? 1 : -1
  }

  if (left.isAdjusted !== right.isAdjusted) {
    return left.isAdjusted ? -1 : 1
  }

  return left.employeeName.localeCompare(right.employeeName, 'ko-KR')
}

export function buildCeoFinalDivisionGroups(rows: CeoFinalEmployeeRow[]) {
  const grouped = new Map<string, CeoFinalDivisionGroup>()

  for (const row of rows) {
    const current = grouped.get(row.divisionId) ?? {
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      totalCount: 0,
      pendingCount: 0,
      adjustedCount: 0,
      finalizedCount: 0,
      employees: [],
    }

    current.employees.push(row)
    grouped.set(row.divisionId, current)
  }

  return [...grouped.values()]
    .map((group) => {
      const employees = [...group.employees].sort(compareEmployees)
      const totalCount = employees.length
      const pendingCount = employees.filter((employee) => !employee.finalized).length
      const adjustedCount = employees.filter((employee) => employee.isAdjusted).length
      const finalizedCount = employees.filter((employee) => employee.finalized).length

      return {
        ...group,
        employees,
        totalCount,
        pendingCount,
        adjustedCount,
        finalizedCount,
      }
    })
    .sort((left, right) => left.divisionName.localeCompare(right.divisionName, 'ko-KR'))
}

export function buildCeoFinalSummary(groups: CeoFinalDivisionGroup[]): CeoFinalSummary {
  const totalCount = groups.reduce((sum, group) => sum + group.totalCount, 0)
  const pendingCount = groups.reduce((sum, group) => sum + group.pendingCount, 0)
  const adjustedCount = groups.reduce((sum, group) => sum + group.adjustedCount, 0)
  const finalizedCount = groups.reduce((sum, group) => sum + group.finalizedCount, 0)

  return {
    totalCount,
    pendingCount,
    adjustedCount,
    divisionCount: groups.length,
    finalizedCount,
    readyToLock: totalCount > 0 && pendingCount === 0,
  }
}

export function buildCeoFinalActorCapabilities(params: {
  userId: string
  displayName: string
  role: SystemRole
  isLocked: boolean
  rawStatus: CycleStatus
}) {
  const canManageFinalReview = params.role === 'ROLE_CEO' || params.role === 'ROLE_ADMIN'
  const readOnly = !canManageFinalReview || params.isLocked
  const canReopenCycle =
    canManageFinalReview &&
    params.isLocked &&
    !['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(params.rawStatus)

  return {
    userId: params.userId,
    displayName: params.displayName,
    role: params.role,
    canEdit: canManageFinalReview && !params.isLocked,
    canFinalizeCycle: canManageFinalReview && !params.isLocked,
    canReopenCycle,
    readOnly,
  }
}

function createPerformanceDetailHref(cycleId: string, evaluationId?: string | null) {
  if (!evaluationId) return undefined
  return `/evaluation/performance/${encodeURIComponent(evaluationId)}?cycleId=${encodeURIComponent(cycleId)}`
}

async function loadBriefingPreviewMap(candidates: CalibrationCandidate[]) {
  const evaluationIds = Array.from(
    new Set(
      candidates.flatMap((candidate) =>
        [candidate.finalEvaluationId, candidate.adjustedEvaluationId].filter(
          (value): value is string => Boolean(value)
        )
      )
    )
  )

  if (!evaluationIds.length) {
    return new Map<string, BriefingLogPreview>()
  }

  const logs = await prisma.aiRequestLog.findMany({
    where: {
      requestType: 'EVAL_PERFORMANCE_BRIEFING',
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

  const previewMap = new Map<string, BriefingLogPreview>()

  for (const log of logs) {
    if (!log.sourceId || previewMap.has(log.sourceId)) continue

    const snapshot = normalizeEvaluationPerformanceBriefingSnapshot(log.responsePayload)
    if (!snapshot) continue

    previewMap.set(log.sourceId, {
      headline: snapshot.headline,
      alignmentLabel: getEvaluationPerformanceBriefingAlignmentLabel(snapshot.alignment.status),
      alignmentTone: getEvaluationPerformanceBriefingAlignmentTone(snapshot.alignment.status),
      evidenceLevelLabel: getEvaluationPerformanceBriefingEvidenceLevelLabel(
        snapshot.evidenceCoverage.evidenceLevel
      ),
      sourceLabel: getEvaluationPerformanceBriefingSourceLabel(snapshot.source),
      generatedAt: snapshot.generatedAt,
      loggedAt: log.createdAt.toISOString(),
    })
  }

  return previewMap
}

function createRowFromCandidate(params: {
  cycleId: string
  candidate: CalibrationCandidate
  briefingPreviewByEvaluationId: Map<string, BriefingLogPreview>
}) {
  const preview =
    (params.candidate.adjustedEvaluationId
      ? params.briefingPreviewByEvaluationId.get(params.candidate.adjustedEvaluationId)
      : undefined) ??
    (params.candidate.finalEvaluationId
      ? params.briefingPreviewByEvaluationId.get(params.candidate.finalEvaluationId)
      : undefined)

  const detailUpdatedAt = params.candidate.detailEvaluationUpdatedAt
    ? new Date(params.candidate.detailEvaluationUpdatedAt)
    : null
  const previewLoggedAt = preview?.loggedAt ? new Date(preview.loggedAt) : null

  return {
    id: params.candidate.id,
    employeeId: params.candidate.employeeId,
    employeeName: params.candidate.employeeName,
    positionLabel: params.candidate.jobGroup,
    divisionId: params.candidate.divisionId,
    divisionName: params.candidate.divisionName,
    departmentId: params.candidate.departmentId,
    departmentName: params.candidate.department,
    originalDivisionHeadRatingId: params.candidate.originalGradeId ?? null,
    originalDivisionHeadRating: params.candidate.originalGrade,
    finalCeoRatingId: params.candidate.finalGradeId ?? params.candidate.originalGradeId ?? null,
    finalCeoRating: params.candidate.adjustedGrade ?? params.candidate.originalGrade,
    isAdjusted: params.candidate.adjusted,
    adjustmentReason: params.candidate.reason,
    finalized: params.candidate.finalized,
    finalizedAt: params.candidate.finalizedAt,
    finalizedBy: params.candidate.finalizedBy,
    finalEvaluationId: params.candidate.finalEvaluationId ?? null,
    adjustedEvaluationId: params.candidate.adjustedEvaluationId ?? null,
    detailEvaluationId: params.candidate.detailEvaluationId ?? null,
    detail: {
      rawScore: params.candidate.rawScore,
      evaluationComment: params.candidate.evaluationComment,
      reviewerComment: params.candidate.reviewerComment,
      kpiSummary: params.candidate.kpiSummary,
      monthlySummary: params.candidate.monthlySummary,
      checkins: params.candidate.checkins,
      threeYearHistory: params.candidate.threeYearHistory,
      performanceDetailHref: createPerformanceDetailHref(
        params.cycleId,
        params.candidate.detailEvaluationId ?? null
      ),
      briefing: preview
        ? {
            headline: preview.headline,
            alignmentLabel: preview.alignmentLabel,
            alignmentTone: preview.alignmentTone,
            evidenceLevelLabel: preview.evidenceLevelLabel,
            sourceLabel: preview.sourceLabel,
            generatedAt: preview.generatedAt,
            stale: Boolean(detailUpdatedAt && previewLoggedAt && previewLoggedAt < detailUpdatedAt),
          }
        : null,
    },
  } satisfies CeoFinalEmployeeRow
}

export async function getEvaluationCeoFinalPageData(params: {
  userId: string
  userName?: string | null
  role: SystemRole
  cycleId?: string
  scopeId?: string
}): Promise<CeoFinalPageData> {
  const calibrationData = await getEvaluationCalibrationPageData({
    userId: params.userId,
    role: params.role,
    cycleId: params.cycleId,
    scopeId: params.scopeId,
  })

  if (calibrationData.state !== 'ready' || !calibrationData.viewModel) {
    return {
      state: calibrationData.state,
      availableCycles: calibrationData.availableCycles,
      selectedCycleId: calibrationData.selectedCycleId,
      message: calibrationData.message,
    }
  }

  const briefingPreviewByEvaluationId = await loadBriefingPreviewMap(
    calibrationData.viewModel.candidates
  )
  const groups = buildCeoFinalDivisionGroups(
    calibrationData.viewModel.candidates.map((candidate) =>
      createRowFromCandidate({
        cycleId: calibrationData.viewModel!.cycle.id,
        candidate,
        briefingPreviewByEvaluationId,
      })
    )
  )
  const summary = buildCeoFinalSummary(groups)
  const isLocked = calibrationData.viewModel.cycle.status === 'FINAL_LOCKED'
  const isReviewConfirmed =
    calibrationData.viewModel.cycle.status === 'REVIEW_CONFIRMED' || isLocked
  const selectedScope =
    calibrationData.viewModel.scopeOptions.find(
      (option) => option.id === calibrationData.viewModel!.cycle.selectedScopeId
    ) ?? {
      id: 'all',
      label: '전사 전체',
    }

  if (!groups.length) {
    return {
      state: 'empty',
      availableCycles: calibrationData.availableCycles,
      selectedCycleId: calibrationData.selectedCycleId,
      message: '대표이사 확정 대상이 없습니다.',
    }
  }

  return {
    state: 'ready',
    availableCycles: calibrationData.availableCycles,
    selectedCycleId: calibrationData.selectedCycleId,
    viewModel: {
      actor: buildCeoFinalActorCapabilities({
        userId: params.userId,
        displayName:
          params.userName?.trim() || (params.role === 'ROLE_CEO' ? '대표이사' : '관리자'),
        role: params.role,
        isLocked,
        rawStatus: calibrationData.viewModel.cycle.rawStatus,
      }),
      cycle: {
        id: calibrationData.viewModel.cycle.id,
        name: calibrationData.viewModel.cycle.name,
        year: calibrationData.viewModel.cycle.year,
        rawStatus: calibrationData.viewModel.cycle.rawStatus,
        visualStatus: calibrationData.viewModel.cycle.status,
        isLocked,
        isReviewConfirmed,
        selectedScopeId: calibrationData.viewModel.cycle.selectedScopeId,
      },
      scopeOptions: calibrationData.viewModel.scopeOptions,
      selectedScope: {
        id: selectedScope.id,
        label: selectedScope.label,
        isAll: selectedScope.id === 'all',
      },
      gradeOptions: calibrationData.viewModel.gradeOptions,
      summary,
      groups,
    },
  }
}
