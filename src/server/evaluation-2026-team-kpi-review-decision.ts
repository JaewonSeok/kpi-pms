import type { Session } from 'next-auth'
import { z } from 'zod'
import type { TeamKpiReviewVerdict } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { resolveOrgKpiScopeFromDepartmentId } from '@/lib/org-kpi-scope'
import { AppError } from '@/lib/utils'
import { canAccessEvaluationPreview2026 } from '@/server/evaluation-preview-2026-loader'

export const EVALUATION_2026_TEAM_KPI_HR_REVIEW_DECISIONS = [
  'APPROVED_FOR_ORG_GOAL',
  'EXCLUDED_DAILY_WORK',
  'EXCEPTION_APPROVED',
  'NEEDS_DISCUSSION',
] as const

export const EVALUATION_2026_TEAM_KPI_HR_REASONS = [
  '전년 대비 상향 KPI',
  '핵심 과제',
  '매출/수익/고객 확보 직접 연계',
  '본부 KPI 직접 포함',
  '단순 운영/유지 업무',
  '중복 목표',
  '기타 HR 사유',
] as const

export const Evaluation2026TeamKpiHrReviewDecisionSchema = z.object({
  orgKpiId: z.string().trim().min(1),
  evalCycleId: z.string().trim().min(1).optional(),
  decision: z.enum(EVALUATION_2026_TEAM_KPI_HR_REVIEW_DECISIONS),
  reason: z.enum(EVALUATION_2026_TEAM_KPI_HR_REASONS),
  note: z.string().trim().max(1000, '검토 메모는 1,000자 이내로 입력해 주세요.').default(''),
})

export const Evaluation2026TeamKpiHrReviewBulkDecisionSchema = z.object({
  orgKpiIds: z
    .array(z.string().trim().min(1))
    .min(1, '일괄 저장할 팀 KPI를 선택해 주세요.')
    .max(100, '한 번에 최대 100건까지 저장할 수 있습니다.'),
  evalCycleId: z.string().trim().min(1).optional(),
  decision: z.enum(EVALUATION_2026_TEAM_KPI_HR_REVIEW_DECISIONS),
  reason: z.enum(EVALUATION_2026_TEAM_KPI_HR_REASONS),
  note: z.string().trim().max(1000, '검토 메모는 1,000자 이내로 입력해 주세요.').default(''),
})

export type Evaluation2026TeamKpiHrReviewDecisionInput = z.infer<
  typeof Evaluation2026TeamKpiHrReviewDecisionSchema
>
export type Evaluation2026TeamKpiHrReviewBulkDecisionInput = z.infer<
  typeof Evaluation2026TeamKpiHrReviewBulkDecisionSchema
>

type Evaluation2026TeamKpiHrReviewDecisionDb = Pick<
  typeof prisma,
  'department' | 'evalCycle' | 'orgKpi' | 'teamKpiReviewRun'
>

type AuditWriter = typeof createAuditLog

type ReviewSessionUser = NonNullable<Session['user']> & {
  id: string
  role: string
}

function getSessionUser(session: Session): ReviewSessionUser | null {
  const user = session.user as Partial<ReviewSessionUser> | undefined
  if (!user?.id || !user.role) return null
  return user as ReviewSessionUser
}

export function canManageEvaluation2026TeamKpiHrReview(session: Session) {
  return canAccessEvaluationPreview2026(session)
}

function assertCanManageTeamKpiReview(session: Session) {
  const user = getSessionUser(session)
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }
  if (!canManageEvaluation2026TeamKpiHrReview(session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 팀 KPI HR 검토 저장은 HR 관리자만 사용할 수 있습니다.')
  }
  return user
}

function decisionToVerdict(decision: Evaluation2026TeamKpiHrReviewDecisionInput['decision']): TeamKpiReviewVerdict {
  if (decision === 'EXCLUDED_DAILY_WORK') return 'INSUFFICIENT'
  if (decision === 'NEEDS_DISCUSSION') return 'CAUTION'
  return 'ADEQUATE'
}

function decisionToLabel(decision: Evaluation2026TeamKpiHrReviewDecisionInput['decision']) {
  if (decision === 'APPROVED_FOR_ORG_GOAL') return '조직목표 반영 가능'
  if (decision === 'EXCLUDED_DAILY_WORK') return '일상업무 처리'
  if (decision === 'EXCEPTION_APPROVED') return '예외 승인'
  return '검토 필요'
}

function resolveDivisionId(params: {
  departmentId: string
  departmentsById: Map<string, { id: string; parentDeptId: string | null }>
}) {
  let current = params.departmentsById.get(params.departmentId)
  const visited = new Set<string>()
  while (current?.parentDeptId && !visited.has(current.id)) {
    visited.add(current.id)
    current = params.departmentsById.get(current.parentDeptId)
  }
  return current?.id ?? null
}

export async function saveEvaluation2026TeamKpiHrReviewDecisionForSession(
  params: {
    session: Session
    input: Evaluation2026TeamKpiHrReviewDecisionInput
  },
  options: {
    db?: Evaluation2026TeamKpiHrReviewDecisionDb
    audit?: AuditWriter
    now?: Date
  } = {}
) {
  const actor = assertCanManageTeamKpiReview(params.session)
  const db = options.db ?? prisma
  const audit = options.audit ?? createAuditLog
  const now = options.now ?? new Date()

  const [orgKpi, departments] = await Promise.all([
    db.orgKpi.findUnique({
      where: { id: params.input.orgKpiId },
      select: {
        id: true,
        deptId: true,
        evalYear: true,
        kpiName: true,
        status: true,
        parentOrgKpiId: true,
        mboExceptionApproved: true,
        mboExceptionReason: true,
        mboExceptionApprovedById: true,
        mboExceptionApprovedAt: true,
        department: {
          select: {
            id: true,
            orgId: true,
            deptName: true,
            parentDeptId: true,
          },
        },
      },
    }),
    db.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
      },
    }),
  ])

  if (!orgKpi) {
    throw new AppError(404, 'ORG_KPI_NOT_FOUND', '팀 KPI를 찾을 수 없습니다.')
  }

  const scope = resolveOrgKpiScopeFromDepartmentId(orgKpi.deptId, departments)
  if (scope === 'division') {
    throw new AppError(400, 'TEAM_KPI_REVIEW_TEAM_ONLY', '본부 KPI는 팀 KPI HR 검토 저장 대상이 아닙니다.')
  }

  if (params.input.evalCycleId) {
    const cycle = await db.evalCycle.findUnique({
      where: { id: params.input.evalCycleId },
      select: {
        id: true,
        orgId: true,
        evalYear: true,
      },
    })
    if (!cycle) {
      throw new AppError(404, 'EVAL_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
    }
    if (cycle.evalYear !== orgKpi.evalYear || cycle.orgId !== orgKpi.department.orgId) {
      throw new AppError(400, 'TEAM_KPI_REVIEW_CYCLE_MISMATCH', '팀 KPI와 평가 주기의 조직/연도가 일치하지 않습니다.')
    }
  }

  const departmentsById = new Map(departments.map((department) => [department.id, department]))
  const divisionId = resolveDivisionId({ departmentId: orgKpi.deptId, departmentsById })
  const verdict = decisionToVerdict(params.input.decision)
  const note = params.input.note.trim()
  const oldValue = {
    mboExceptionApproved: orgKpi.mboExceptionApproved,
    mboExceptionReason: orgKpi.mboExceptionReason,
    mboExceptionApprovedById: orgKpi.mboExceptionApprovedById,
    mboExceptionApprovedAt: orgKpi.mboExceptionApprovedAt?.toISOString?.() ?? orgKpi.mboExceptionApprovedAt ?? null,
  }

  const created = await db.teamKpiReviewRun.create({
    data: {
      sourceDepartmentId: divisionId && divisionId !== orgKpi.deptId ? divisionId : null,
      targetDepartmentId: orgKpi.deptId,
      evalYear: orgKpi.evalYear,
      evalCycleId: params.input.evalCycleId ?? null,
      requesterId: actor.id,
      aiRequestLogId: null,
      reviewType: 'FULL_SET',
      overallVerdict: verdict,
      overallSummary: `2026 HR Team KPI decision: ${params.input.decision}`,
      linkedParentCoverage: params.input.reason,
      independentKpiCoverage: note || null,
      items: {
        create: {
          orgKpiId: orgKpi.id,
          reviewType: 'FULL_SET',
          kpiTitleSnapshot: orgKpi.kpiName,
          verdict,
          rationale: params.input.reason,
          linkageComment: params.input.decision,
          recommendationText: note || null,
        },
      },
    },
    include: {
      items: true,
    },
  })

  const exceptionData =
    params.input.decision === 'EXCEPTION_APPROVED'
      ? {
          mboExceptionApproved: true,
          mboExceptionReason: params.input.reason,
          mboExceptionApprovedById: actor.id,
          mboExceptionApprovedAt: now,
        }
      : {
          mboExceptionApproved: false,
          mboExceptionReason: null,
          mboExceptionApprovedById: null,
          mboExceptionApprovedAt: null,
        }

  const updatedOrgKpi = await db.orgKpi.update({
    where: { id: orgKpi.id },
    data: exceptionData,
    select: {
      id: true,
      mboExceptionApproved: true,
      mboExceptionReason: true,
      mboExceptionApprovedById: true,
      mboExceptionApprovedAt: true,
    },
  })

  await audit({
    userId: actor.id,
    action: 'UPDATE_2026_TEAM_KPI_HR_REVIEW_DECISION',
    entityType: 'OrgKpi',
    entityId: orgKpi.id,
    oldValue,
    newValue: {
      decision: params.input.decision,
      decisionLabel: decisionToLabel(params.input.decision),
      reason: params.input.reason,
      note,
      reviewedById: actor.id,
      reviewedAt: now.toISOString(),
      teamKpiReviewRunId: created.id,
      teamKpiReviewItemId: created.items[0]?.id ?? null,
      mboExceptionApproved: updatedOrgKpi.mboExceptionApproved,
      mboExceptionReason: updatedOrgKpi.mboExceptionReason,
      officialScoresChanged: false,
      officialGradesChanged: false,
      evaluationPopulationChanged: false,
    },
  })

  return {
    orgKpiId: orgKpi.id,
    decision: params.input.decision,
    decisionLabel: decisionToLabel(params.input.decision),
    reason: params.input.reason,
    note,
    reviewedById: actor.id,
    reviewedAt: now.toISOString(),
    teamKpiReviewRunId: created.id,
    teamKpiReviewItemId: created.items[0]?.id ?? null,
    verdict,
    hrException: {
      approved: updatedOrgKpi.mboExceptionApproved,
      reason: updatedOrgKpi.mboExceptionReason,
      approvedById: updatedOrgKpi.mboExceptionApprovedById,
      approvedAt: updatedOrgKpi.mboExceptionApprovedAt?.toISOString() ?? null,
    },
    safety: {
      officialScoresChanged: false,
      officialGradesChanged: false,
      aiScoreExclusionChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      backfillApplied: false,
    },
  }
}

export async function saveEvaluation2026TeamKpiHrReviewBulkDecisionForSession(
  params: {
    session: Session
    input: Evaluation2026TeamKpiHrReviewBulkDecisionInput
  },
  options: {
    db?: Evaluation2026TeamKpiHrReviewDecisionDb
    audit?: AuditWriter
    now?: Date
  } = {}
) {
  assertCanManageTeamKpiReview(params.session)

  const uniqueOrgKpiIds = Array.from(new Set(params.input.orgKpiIds.map((id) => id.trim()).filter(Boolean)))
  if (!uniqueOrgKpiIds.length) {
    throw new AppError(400, 'TEAM_KPI_REVIEW_SELECTION_REQUIRED', '일괄 저장할 팀 KPI를 선택해 주세요.')
  }

  const results = []
  for (const orgKpiId of uniqueOrgKpiIds) {
    const parsed = Evaluation2026TeamKpiHrReviewDecisionSchema.parse({
      orgKpiId,
      evalCycleId: params.input.evalCycleId,
      decision: params.input.decision,
      reason: params.input.reason,
      note: params.input.note,
    })
    const result = await saveEvaluation2026TeamKpiHrReviewDecisionForSession(
      {
        session: params.session,
        input: parsed,
      },
      options
    )
    results.push(result)
  }

  return {
    count: results.length,
    decision: params.input.decision,
    decisionLabel: decisionToLabel(params.input.decision),
    reason: params.input.reason,
    note: params.input.note.trim(),
    results,
    safety: {
      officialScoresChanged: false,
      officialGradesChanged: false,
      aiScoreExclusionChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      personalKpiPolicyCategoryChanged: false,
      evaluationItemPolicyCategoryChanged: false,
      backfillApplied: false,
    },
  }
}
