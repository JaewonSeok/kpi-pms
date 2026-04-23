import { z } from 'zod'
import type { Session } from 'next-auth'
import {
  type MidReviewActionStatus,
  type MidReviewAssignmentStatus,
  type MidReviewCycleStatus,
  type MidReviewScopeTargetKind,
  type MidReviewType,
  type MidReviewWorkflowMode,
  type GoalValidityDecision,
  type RetentionRiskLevel,
  type SystemRole,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'
import {
  MidReviewCycleSchema,
  SaveMidReviewRecordSchema,
  SubmitMidReviewRecordSchema,
} from '@/lib/validations'
import { canAccessDepartment } from '@/server/auth/authorize'
import { getDescendantDeptIds } from '@/server/auth/org-scope'

type SessionUser = NonNullable<Session['user']> & {
  id: string
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
}

type MidReviewCycleInput = z.infer<typeof MidReviewCycleSchema>
type MidReviewRecordSaveInput = z.infer<typeof SaveMidReviewRecordSchema>
type MidReviewRecordSubmitInput = z.infer<typeof SubmitMidReviewRecordSchema>

export const MID_REVIEW_TYPE_LABELS: Record<MidReviewType, string> = {
  ALIGNMENT: '정렬형',
  RETROSPECTIVE: '회고형',
  ASSESSMENT: '평가형',
  DEVELOPMENT: '발전형',
}

export const MID_REVIEW_CYCLE_STATUS_LABELS: Record<MidReviewCycleStatus, string> = {
  DRAFT: '준비 중',
  ACTIVE: '진행 중',
  CLOSED: '마감',
  ARCHIVED: '보관',
}

export const MID_REVIEW_ASSIGNMENT_STATUS_LABELS: Record<MidReviewAssignmentStatus, string> = {
  NOT_STARTED: '미시작',
  SELF_DRAFT: '구성원 작성 중',
  SELF_SUBMITTED: '구성원 제출 완료',
  LEADER_DRAFT: '리더 검토 중',
  LEADER_SUBMITTED: '리더 제출 완료',
  CLOSED: '완료',
}

export const MID_REVIEW_WORKFLOW_LABELS: Record<MidReviewWorkflowMode, string> = {
  LEADER_ONLY: '리더 단독 점검',
  SELF_THEN_LEADER: '구성원 작성 후 리더 검토',
}

export const MID_REVIEW_SCOPE_LABELS: Record<MidReviewScopeTargetKind, string> = {
  DEPARTMENT: '조직',
  EMPLOYEE: '개인',
}

export const GOAL_VALIDITY_LABELS: Record<GoalValidityDecision, string> = {
  KEEP_GOAL: '목표 유지',
  ADJUST_PRIORITY_OR_METHOD: '우선순위·달성 방식 조정',
  REVISE_GOAL: '목표 수정 필요',
}

export const RETENTION_RISK_LABELS: Record<RetentionRiskLevel, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
}

export type MidReviewCycleAdminViewModel = {
  id: string
  name: string
  reviewType: MidReviewType
  reviewTypeLabel: string
  workflowMode: MidReviewWorkflowMode
  workflowModeLabel: string
  scopeTargetKind: MidReviewScopeTargetKind
  scopeTargetKindLabel: string
  scopeDepartment?: {
    id: string
    name: string
  }
  includeDescendants: boolean
  startsAt?: string
  selfDueAt?: string
  leaderDueAt?: string
  closesAt?: string
  status: MidReviewCycleStatus
  statusLabel: string
  peopleReviewEnabled: boolean
  expectationTemplateEnabled: boolean
  progress: {
    totalAssignments: number
    selfCompletedCount: number
    leaderCompletedCount: number
    overdueCount: number
    noActionCount: number
    revisionRequestedCount: number
    peopleRiskWithoutPlanCount: number
    completionRate: number
  }
}

export type MidReviewGoalReviewViewModel = {
  id: string
  orgKpiId?: string
  orgKpiName?: string
  personalKpiId?: string
  personalKpiName?: string
  goalValidityDecision: GoalValidityDecision
  goalValidityLabel: string
  decisionReason?: string
  priorityAdjustmentMemo?: string
  executionAdjustmentMemo?: string
  expectedState?: string
  successScene?: string
  criteriaExceeds?: string
  criteriaMeets?: string
  criteriaBelow?: string
  revisionRequested: boolean
}

export type MidReviewActionItemViewModel = {
  id: string
  actionText: string
  ownerId?: string
  ownerName?: string
  dueDate?: string
  status: MidReviewActionStatus
}

export type MidReviewWorkspaceViewModel = {
  assignmentId: string
  cycle: {
    id: string
    name: string
    reviewType: MidReviewType
    reviewTypeLabel: string
    workflowMode: MidReviewWorkflowMode
    workflowModeLabel: string
    scopeTargetKind: MidReviewScopeTargetKind
    scopeTargetKindLabel: string
    status: MidReviewCycleStatus
    statusLabel: string
    peopleReviewEnabled: boolean
    expectationTemplateEnabled: boolean
    startsAt?: string
    selfDueAt?: string
    leaderDueAt?: string
    closesAt?: string
  }
  assignment: {
    status: MidReviewAssignmentStatus
    statusLabel: string
    scheduledAt?: string
    completedAt?: string
  }
  target: {
    employee?: {
      id: string
      name: string
      department: string
      position: string
    }
    department?: {
      id: string
      name: string
      leaderName?: string
    }
    manager: {
      id: string
      name: string
      department?: string
    }
  }
  permissions: {
    canView: boolean
    canEditSelf: boolean
    canEditLeader: boolean
    canViewSensitivePeopleReview: boolean
    canUseAi: boolean
  }
  record: {
    memberAchievements?: string
    milestoneReview?: string
    issueRiskSummary?: string
    nextPeriodPlan?: string
    agreedContext?: string
    directionClarity?: 'CLEAR' | 'PARTIAL' | 'UNCLEAR' | null
    directionClarityNote?: string
    leaderSummary?: string
    leaderCoachingMemo?: string
    aiFollowUpQuestions: string[]
    aiCommentSupport?: {
      summary?: string
      draftComment?: string
      warnings?: string[]
    }
    goalReviews: MidReviewGoalReviewViewModel[]
    peopleReview?: {
      retentionRiskLevel?: RetentionRiskLevel | null
      retentionRiskLabel?: string
      stayInterviewMemo?: string
      reboundGoal?: string
      supportPlan?: string
      coachingPlan?: string
      nextFollowUpAt?: string
    }
    actionItems: MidReviewActionItemViewModel[]
    memberSubmittedAt?: string
    leaderSubmittedAt?: string
  }
  evidence: {
    orgKpis: Array<{
      id: string
      title: string
      department: string
      status: string
    }>
    personalKpis: Array<{
      id: string
      title: string
      weight: number
      linkedOrgKpi?: string
      averageAchievementRate?: number
    }>
    monthlyRecords: Array<{
      month: string
      kpiTitle: string
      achievementRate?: number
      comment?: string
      obstacles?: string
    }>
    recentCheckins: Array<{
      scheduledDate: string
      summary?: string
      managerName: string
    }>
    latestEvaluation?: {
      stage?: string
      finalScore?: number | null
      summary?: string
    }
    signals: string[]
  }
}

export type MidReviewSummaryViewModel = {
  reviewTypeLabel: string
  goalValidityLabel?: string
  decisionReason?: string
  expectedState?: string
  criteriaMeets?: string
  nextPeriodPlan?: string
  updatedAt?: string
  revisionRequested: boolean
}

export type MidReviewMonitoringViewModel = {
  summary: {
    activeCycleCount: number
    activeAssignmentCount: number
    completedAssignmentCount: number
    progressRate: number
    noActionTeamCount: number
    revisionRequestedCount: number
    peopleRiskWithoutPlanCount: number
    alignmentRiskCount: number
  }
  departments: Array<{
    departmentId: string
    departmentName: string
    totalAssignments: number
    completedAssignments: number
    progressRate: number
    overdueCount: number
    noActionCount: number
    revisionRequestedCount: number
    highRiskWithoutPlanCount: number
    alignmentRiskCount: number
  }>
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined
}

function clampRate(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function getMidReviewStatusSummary(status: MidReviewAssignmentStatus) {
  return MID_REVIEW_ASSIGNMENT_STATUS_LABELS[status]
}

function getSessionUser(session: Session) {
  return session.user as SessionUser
}

function canSeeSensitivePeopleReview(session: Session, managerId: string) {
  const user = getSessionUser(session)
  return user.role === 'ROLE_ADMIN' || user.id === managerId
}

async function getOrgDepartments(orgId: string) {
  return prisma.department.findMany({
    where: { orgId },
    select: {
      id: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
      leaderEmployee: {
        select: {
          id: true,
          empName: true,
        },
      },
    },
  })
}

function resolveScopeDepartmentIds(
  departments: Array<{ id: string; parentDeptId: string | null }>,
  scopeDepartmentId?: string | null,
  includeDescendants = false
) {
  if (!scopeDepartmentId) {
    return [] as string[]
  }

  if (!includeDescendants) {
    return [scopeDepartmentId]
  }

  return [
    scopeDepartmentId,
    ...getDescendantDeptIds(
      scopeDepartmentId,
      departments.map((item) => ({
        id: item.id,
        parentDeptId: item.parentDeptId,
        deptCode: item.id,
      }))
    ),
  ]
}

function resolveEmployeeManagerId(target: {
  managerId?: string | null
  teamLeaderId?: string | null
  sectionChiefId?: string | null
  divisionHeadId?: string | null
  position: string
}) {
  if (target.managerId) {
    return target.managerId
  }

  if (target.position === 'MEMBER') {
    return target.teamLeaderId ?? target.sectionChiefId ?? target.divisionHeadId ?? null
  }

  if (target.position === 'TEAM_LEADER') {
    return target.sectionChiefId ?? target.divisionHeadId ?? null
  }

  if (target.position === 'SECTION_CHIEF') {
    return target.divisionHeadId ?? null
  }

  return null
}

async function resolveEmployeeTargets(params: {
  orgId: string
  scopeDepartmentIds: string[]
}) {
  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      department: { orgId: params.orgId },
      ...(params.scopeDepartmentIds.length ? { deptId: { in: params.scopeDepartmentIds } } : {}),
    },
    select: {
      id: true,
      empName: true,
      deptId: true,
      position: true,
      managerId: true,
      teamLeaderId: true,
      sectionChiefId: true,
      divisionHeadId: true,
      department: {
        select: {
          id: true,
          deptName: true,
        },
      },
    },
    orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
  })

  return employees
    .map((employee) => ({
      ...employee,
      resolvedManagerId: resolveEmployeeManagerId(employee),
    }))
    .filter((employee) => Boolean(employee.resolvedManagerId)) as Array<
      (typeof employees)[number] & { resolvedManagerId: string }
    >
}

async function resolveDepartmentTargets(params: {
  orgId: string
  scopeDepartmentIds: string[]
}) {
  return prisma.department.findMany({
    where: {
      orgId: params.orgId,
      leaderEmployeeId: { not: null },
      ...(params.scopeDepartmentIds.length ? { id: { in: params.scopeDepartmentIds } } : {}),
    },
    select: {
      id: true,
      deptName: true,
      leaderEmployeeId: true,
      leaderEmployee: {
        select: {
          id: true,
          empName: true,
        },
      },
    },
    orderBy: { deptName: 'asc' },
  })
}

function getDefaultScheduleDate(input: MidReviewCycleInput) {
  return input.startsAt ?? input.selfDueAt ?? input.leaderDueAt ?? input.closesAt ?? new Date().toISOString()
}

export async function listMidReviewCyclesForEvalCycle(evalCycleId: string): Promise<MidReviewCycleAdminViewModel[]> {
  const cycles = await prisma.midReviewCycle.findMany({
    where: { evalCycleId },
    include: {
      scopeDepartment: {
        select: {
          id: true,
          deptName: true,
        },
      },
      assignments: {
        include: {
          record: {
            include: {
              goalReviews: {
                select: {
                  revisionRequested: true,
                  goalValidityDecision: true,
                },
              },
              peopleReview: {
                select: {
                  retentionRiskLevel: true,
                  supportPlan: true,
                },
              },
              actionItems: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })

  return cycles.map((cycle) => {
    const totalAssignments = cycle.assignments.length
    const selfCompletedCount = cycle.assignments.filter((item) =>
      ['SELF_SUBMITTED', 'LEADER_DRAFT', 'LEADER_SUBMITTED', 'CLOSED'].includes(item.status)
    ).length
    const leaderCompletedCount = cycle.assignments.filter((item) =>
      ['LEADER_SUBMITTED', 'CLOSED'].includes(item.status)
    ).length
    const now = Date.now()
    const overdueCount = cycle.assignments.filter((item) => {
      if (item.status === 'LEADER_SUBMITTED' || item.status === 'CLOSED') return false
      if (cycle.workflowMode === 'SELF_THEN_LEADER' && cycle.selfDueAt && item.status === 'NOT_STARTED') {
        return cycle.selfDueAt.getTime() < now
      }
      if (cycle.leaderDueAt) {
        return cycle.leaderDueAt.getTime() < now
      }
      return false
    }).length
    const noActionCount = cycle.assignments.filter((item) => {
      if (!item.record) return false
      return ['LEADER_SUBMITTED', 'CLOSED'].includes(item.status) && item.record.actionItems.length === 0
    }).length
    const revisionRequestedCount = cycle.assignments.reduce((sum, item) => {
      const goalReviewCount =
        item.record?.goalReviews.filter(
          (goalReview) =>
            goalReview.revisionRequested || goalReview.goalValidityDecision !== 'KEEP_GOAL'
        ).length ?? 0
      return sum + goalReviewCount
    }, 0)
    const peopleRiskWithoutPlanCount = cycle.assignments.filter((item) => {
      const peopleReview = item.record?.peopleReview
      return (
        peopleReview?.retentionRiskLevel === 'HIGH' && !peopleReview.supportPlan?.trim()
      )
    }).length

    return {
      id: cycle.id,
      name: cycle.name,
      reviewType: cycle.reviewType,
      reviewTypeLabel: MID_REVIEW_TYPE_LABELS[cycle.reviewType],
      workflowMode: cycle.workflowMode,
      workflowModeLabel: MID_REVIEW_WORKFLOW_LABELS[cycle.workflowMode],
      scopeTargetKind: cycle.scopeTargetKind,
      scopeTargetKindLabel: MID_REVIEW_SCOPE_LABELS[cycle.scopeTargetKind],
      scopeDepartment: cycle.scopeDepartment
        ? {
            id: cycle.scopeDepartment.id,
            name: cycle.scopeDepartment.deptName,
          }
        : undefined,
      includeDescendants: cycle.includeDescendants,
      startsAt: toIso(cycle.startsAt),
      selfDueAt: toIso(cycle.selfDueAt),
      leaderDueAt: toIso(cycle.leaderDueAt),
      closesAt: toIso(cycle.closesAt),
      status: cycle.status,
      statusLabel: MID_REVIEW_CYCLE_STATUS_LABELS[cycle.status],
      peopleReviewEnabled: cycle.peopleReviewEnabled,
      expectationTemplateEnabled: cycle.expectationTemplateEnabled,
      progress: {
        totalAssignments,
        selfCompletedCount,
        leaderCompletedCount,
        overdueCount,
        noActionCount,
        revisionRequestedCount,
        peopleRiskWithoutPlanCount,
        completionRate: clampRate(leaderCompletedCount, totalAssignments),
      },
    }
  })
}

export async function createMidReviewCycle(params: {
  actorId: string
  evalCycleId: string
  input: MidReviewCycleInput
}) {
  const evalCycle = await prisma.evalCycle.findUnique({
    where: { id: params.evalCycleId },
    select: {
      id: true,
      evalYear: true,
      orgId: true,
    },
  })

  if (!evalCycle) {
    throw new AppError(404, 'MID_REVIEW_CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const departments = await getOrgDepartments(evalCycle.orgId)
  const scopeDepartmentIds = resolveScopeDepartmentIds(
    departments.map((item) => ({ id: item.id, parentDeptId: item.parentDeptId })),
    params.input.scopeDepartmentId,
    params.input.includeDescendants
  )

  const scheduleDate = new Date(getDefaultScheduleDate(params.input))

  return prisma.$transaction(async (tx) => {
    const cycle = await tx.midReviewCycle.create({
      data: {
        evalCycleId: params.evalCycleId,
        name: params.input.name,
        reviewType: params.input.reviewType,
        workflowMode: params.input.workflowMode,
        scopeTargetKind: params.input.scopeTargetKind,
        scopeDepartmentId: params.input.scopeDepartmentId ?? null,
        includeDescendants: params.input.includeDescendants,
        startsAt: params.input.startsAt ? new Date(params.input.startsAt) : null,
        selfDueAt: params.input.selfDueAt ? new Date(params.input.selfDueAt) : null,
        leaderDueAt: params.input.leaderDueAt ? new Date(params.input.leaderDueAt) : null,
        closesAt: params.input.closesAt ? new Date(params.input.closesAt) : null,
        status: params.input.status,
        peopleReviewEnabled: params.input.peopleReviewEnabled,
        expectationTemplateEnabled: params.input.expectationTemplateEnabled,
      },
    })

    if (params.input.scopeTargetKind === 'DEPARTMENT') {
      const targetDepartments = await resolveDepartmentTargets({
        orgId: evalCycle.orgId,
        scopeDepartmentIds,
      })

      if (!targetDepartments.length) {
        throw new AppError(400, 'MID_REVIEW_NO_TARGETS', '중간 점검 대상 조직을 찾지 못했습니다.')
      }

      for (const department of targetDepartments) {
        if (!department.leaderEmployeeId) continue

        const checkIn = await tx.checkIn.create({
          data: {
            ownerId: department.leaderEmployeeId,
            managerId: department.leaderEmployeeId,
            checkInType: 'MIDYEAR_REVIEW',
            scheduledDate: scheduleDate,
            status: 'SCHEDULED',
            ownerNotes: `${department.deptName} 조직 중간 점검`,
          },
        })

        const assignment = await tx.midReviewAssignment.create({
          data: {
            cycleId: cycle.id,
            targetDepartmentId: department.id,
            managerId: department.leaderEmployeeId,
            relatedCheckInId: checkIn.id,
            scheduledAt: scheduleDate,
            status: 'NOT_STARTED',
          },
        })

        await tx.midReviewRecord.create({
          data: {
            assignmentId: assignment.id,
          },
        })
      }
    } else {
      const targetEmployees = await resolveEmployeeTargets({
        orgId: evalCycle.orgId,
        scopeDepartmentIds,
      })

      if (!targetEmployees.length) {
        throw new AppError(400, 'MID_REVIEW_NO_TARGETS', '중간 점검 대상 직원을 찾지 못했습니다.')
      }

      for (const employee of targetEmployees) {
        const checkIn = await tx.checkIn.create({
          data: {
            ownerId: employee.id,
            managerId: employee.resolvedManagerId,
            checkInType: 'MIDYEAR_REVIEW',
            scheduledDate: scheduleDate,
            status: 'SCHEDULED',
            ownerNotes: `${employee.empName} 중간 점검`,
          },
        })

        const assignment = await tx.midReviewAssignment.create({
          data: {
            cycleId: cycle.id,
            targetEmployeeId: employee.id,
            targetDepartmentId: employee.deptId,
            managerId: employee.resolvedManagerId,
            relatedCheckInId: checkIn.id,
            scheduledAt: scheduleDate,
            status: 'NOT_STARTED',
          },
        })

        await tx.midReviewRecord.create({
          data: {
            assignmentId: assignment.id,
          },
        })
      }
    }

    return cycle
  })
}

export async function updateMidReviewCycle(params: {
  midReviewCycleId: string
  input: Partial<MidReviewCycleInput>
}) {
  const existing = await prisma.midReviewCycle.findUnique({
    where: { id: params.midReviewCycleId },
    select: {
      id: true,
    },
  })

  if (!existing) {
    throw new AppError(404, 'MID_REVIEW_CYCLE_NOT_FOUND', '중간 점검 주기를 찾을 수 없습니다.')
  }

  return prisma.midReviewCycle.update({
    where: { id: params.midReviewCycleId },
    data: {
      ...(params.input.name !== undefined ? { name: params.input.name } : {}),
      ...(params.input.status !== undefined ? { status: params.input.status } : {}),
      ...(params.input.startsAt !== undefined
        ? { startsAt: params.input.startsAt ? new Date(params.input.startsAt) : null }
        : {}),
      ...(params.input.selfDueAt !== undefined
        ? { selfDueAt: params.input.selfDueAt ? new Date(params.input.selfDueAt) : null }
        : {}),
      ...(params.input.leaderDueAt !== undefined
        ? { leaderDueAt: params.input.leaderDueAt ? new Date(params.input.leaderDueAt) : null }
        : {}),
      ...(params.input.closesAt !== undefined
        ? { closesAt: params.input.closesAt ? new Date(params.input.closesAt) : null }
        : {}),
      ...(params.input.peopleReviewEnabled !== undefined
        ? { peopleReviewEnabled: params.input.peopleReviewEnabled }
        : {}),
      ...(params.input.expectationTemplateEnabled !== undefined
        ? { expectationTemplateEnabled: params.input.expectationTemplateEnabled }
        : {}),
    },
  })
}

function getDirectionSignalLabel(value: string | null | undefined) {
  if (value === 'PARTIAL') return '방향 이해에 보완이 필요합니다.'
  if (value === 'UNCLEAR') return '방향 정렬이 다시 필요합니다.'
  return null
}

async function getAssignmentWithContext(checkInId: string) {
  const assignment = await prisma.midReviewAssignment.findUnique({
    where: { relatedCheckInId: checkInId },
    include: {
      cycle: {
        include: {
          scopeDepartment: {
            select: {
              id: true,
              deptName: true,
            },
          },
        },
      },
      targetEmployee: {
        select: {
          id: true,
          empName: true,
          position: true,
          deptId: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
      targetDepartment: {
        select: {
          id: true,
          deptName: true,
          leaderEmployee: {
            select: {
              empName: true,
            },
          },
        },
      },
      manager: {
        select: {
          id: true,
          empName: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
      },
      record: {
        include: {
          goalReviews: {
            include: {
              orgKpi: {
                select: {
                  id: true,
                  kpiName: true,
                },
              },
              personalKpi: {
                select: {
                  id: true,
                  kpiName: true,
                },
              },
            },
            orderBy: {
              updatedAt: 'desc',
            },
          },
          peopleReview: true,
          actionItems: {
            include: {
              owner: {
                select: {
                  id: true,
                  empName: true,
                },
              },
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          },
        },
      },
      relatedCheckIn: {
        include: {
          owner: {
            select: {
              teamLeaderId: true,
              sectionChiefId: true,
              divisionHeadId: true,
            },
          },
        },
      },
    },
  })

  if (!assignment || !assignment.relatedCheckIn) {
    throw new AppError(404, 'MID_REVIEW_NOT_FOUND', '중간 점검 정보를 찾을 수 없습니다.')
  }

  return assignment
}

function getMidReviewPermissions(params: {
  session: Session
  assignment: Awaited<ReturnType<typeof getAssignmentWithContext>>
}) {
  const user = getSessionUser(params.session)
  const assignment = params.assignment
  const isAdmin = user.role === 'ROLE_ADMIN'
  const isTargetEmployee = Boolean(assignment.targetEmployeeId && assignment.targetEmployeeId === user.id)
  const departmentDeptId = assignment.targetDepartmentId ?? assignment.targetEmployee?.deptId ?? ''
  const canView =
    isAdmin ||
    assignment.managerId === user.id ||
    isTargetEmployee ||
    (departmentDeptId ? canAccessDepartment(params.session, departmentDeptId) : false)
  const canEditSelf =
    canView &&
    assignment.cycle.workflowMode === 'SELF_THEN_LEADER' &&
    Boolean(assignment.targetEmployeeId && assignment.targetEmployeeId === user.id) &&
    assignment.status !== 'LEADER_SUBMITTED' &&
    assignment.status !== 'CLOSED'
  const canEditLeader =
    canView &&
    (isAdmin || assignment.managerId === user.id) &&
    assignment.cycle.status !== 'CLOSED' &&
    assignment.cycle.status !== 'ARCHIVED'

  return {
    canView,
    canEditSelf,
    canEditLeader,
    canViewSensitivePeopleReview: canSeeSensitivePeopleReview(params.session, assignment.managerId),
    canUseAi: canView,
  }
}

async function buildWorkspaceEvidence(
  assignment: Awaited<ReturnType<typeof getAssignmentWithContext>>
) {
  if (assignment.targetEmployeeId) {
    const employeeId = assignment.targetEmployeeId
    const evalYear = assignment.cycle.evalCycleId
      ? (
          await prisma.midReviewCycle.findUnique({
            where: { id: assignment.cycleId },
            select: {
              evalCycle: {
                select: {
                  evalYear: true,
                },
              },
            },
          })
        )?.evalCycle.evalYear
      : undefined

    const [personalKpis, recentCheckins, latestEvaluation] = await Promise.all([
      prisma.personalKpi.findMany({
        where: {
          employeeId,
          ...(typeof evalYear === 'number' ? { evalYear } : {}),
        },
        include: {
          linkedOrgKpi: {
            select: {
              kpiName: true,
            },
          },
          monthlyRecords: {
            orderBy: { yearMonth: 'desc' },
            take: 3,
          },
        },
        orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
        take: 8,
      }),
      prisma.checkIn.findMany({
        where: {
          ownerId: employeeId,
          id: { not: assignment.relatedCheckInId ?? '' },
        },
        include: {
          manager: {
            select: {
              empName: true,
            },
          },
        },
        orderBy: { scheduledDate: 'desc' },
        take: 4,
      }),
      prisma.evaluation.findFirst({
        where: {
          targetId: employeeId,
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          evalStage: true,
          totalScore: true,
          comment: true,
        },
      }),
    ])

    const orgKpis = personalKpis
      .filter((item) => item.linkedOrgKpi)
      .map((item) => ({
        id: item.linkedOrgKpiId ?? item.id,
        title: item.linkedOrgKpi?.kpiName ?? item.kpiName,
        department: assignment.targetEmployee?.department.deptName ?? '',
        status: '연결 KPI',
      }))

    const monthlyRecords = personalKpis.flatMap((kpi) =>
      kpi.monthlyRecords.map((record) => ({
        month: record.yearMonth,
        kpiTitle: kpi.kpiName,
        achievementRate: record.achievementRate ?? undefined,
        comment: record.activities ?? undefined,
        obstacles: record.obstacles ?? undefined,
      }))
    )

    const signals = [
      ...personalKpis
        .filter((item) => !item.monthlyRecords.length)
        .slice(0, 2)
        .map((item) => `${item.kpiName}은 최근 월간 실적 기록이 없습니다.`),
      ...recentCheckins
        .filter((item) => !item.keyTakeaways)
        .slice(0, 1)
        .map(() => '최근 체크인 요약이 충분하지 않습니다.'),
    ]

    return {
      orgKpis,
      personalKpis: personalKpis.map((item) => ({
        id: item.id,
        title: item.kpiName,
        weight: item.weight,
        linkedOrgKpi: item.linkedOrgKpi?.kpiName ?? undefined,
        averageAchievementRate: item.monthlyRecords.length
          ? Math.round(
              (item.monthlyRecords.reduce((sum, record) => sum + (record.achievementRate ?? 0), 0) /
                item.monthlyRecords.length) *
                10
            ) / 10
          : undefined,
      })),
      monthlyRecords,
      recentCheckins: recentCheckins.map((item) => ({
        scheduledDate: item.scheduledDate.toISOString(),
        summary: item.keyTakeaways ?? undefined,
        managerName: item.manager.empName,
      })),
      latestEvaluation: latestEvaluation
        ? {
            stage: latestEvaluation.evalStage,
            finalScore: latestEvaluation.totalScore,
            summary: latestEvaluation.comment ?? undefined,
          }
        : undefined,
      signals,
    }
  }

  const departmentId = assignment.targetDepartmentId
  if (!departmentId) {
    return {
      orgKpis: [],
      personalKpis: [],
      monthlyRecords: [],
      recentCheckins: [],
      latestEvaluation: undefined,
      signals: [],
    }
  }

  const orgKpis = await prisma.orgKpi.findMany({
    where: {
      deptId: departmentId,
    },
    orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
    take: 8,
    include: {
      department: {
        select: {
          deptName: true,
        },
      },
      personalKpis: {
        select: {
          id: true,
        },
      },
    },
  })

  return {
    orgKpis: orgKpis.map((item) => ({
      id: item.id,
      title: item.kpiName,
      department: item.department.deptName,
      status: item.personalKpis.length ? `연결된 개인 KPI ${item.personalKpis.length}건` : '개인 KPI 연결 없음',
    })),
    personalKpis: [],
    monthlyRecords: [],
    recentCheckins: [],
    latestEvaluation: undefined,
    signals: orgKpis
      .filter((item) => item.personalKpis.length === 0)
      .slice(0, 3)
      .map((item) => `${item.kpiName}은 연결된 개인 KPI가 없습니다.`),
  }
}

export async function getMidReviewWorkspace(params: {
  session: Session
  checkInId: string
}): Promise<MidReviewWorkspaceViewModel> {
  const assignment = await getAssignmentWithContext(params.checkInId)
  const permissions = getMidReviewPermissions({ session: params.session, assignment })

  if (!permissions.canView) {
    throw new AppError(403, 'FORBIDDEN', '중간 점검에 접근할 권한이 없습니다.')
  }

  const evidence = await buildWorkspaceEvidence(assignment)
  const directionSignal = getDirectionSignalLabel(assignment.record?.directionClarity)
  if (directionSignal) {
    evidence.signals.unshift(directionSignal)
  }

  return {
    assignmentId: assignment.id,
    cycle: {
      id: assignment.cycle.id,
      name: assignment.cycle.name,
      reviewType: assignment.cycle.reviewType,
      reviewTypeLabel: MID_REVIEW_TYPE_LABELS[assignment.cycle.reviewType],
      workflowMode: assignment.cycle.workflowMode,
      workflowModeLabel: MID_REVIEW_WORKFLOW_LABELS[assignment.cycle.workflowMode],
      scopeTargetKind: assignment.cycle.scopeTargetKind,
      scopeTargetKindLabel: MID_REVIEW_SCOPE_LABELS[assignment.cycle.scopeTargetKind],
      status: assignment.cycle.status,
      statusLabel: MID_REVIEW_CYCLE_STATUS_LABELS[assignment.cycle.status],
      peopleReviewEnabled: assignment.cycle.peopleReviewEnabled,
      expectationTemplateEnabled: assignment.cycle.expectationTemplateEnabled,
      startsAt: toIso(assignment.cycle.startsAt),
      selfDueAt: toIso(assignment.cycle.selfDueAt),
      leaderDueAt: toIso(assignment.cycle.leaderDueAt),
      closesAt: toIso(assignment.cycle.closesAt),
    },
    assignment: {
      status: assignment.status,
      statusLabel: getMidReviewStatusSummary(assignment.status),
      scheduledAt: toIso(assignment.scheduledAt),
      completedAt: toIso(assignment.completedAt),
    },
    target: {
      employee: assignment.targetEmployee
        ? {
            id: assignment.targetEmployee.id,
            name: assignment.targetEmployee.empName,
            department: assignment.targetEmployee.department.deptName,
            position: assignment.targetEmployee.position,
          }
        : undefined,
      department: assignment.targetDepartment
        ? {
            id: assignment.targetDepartment.id,
            name: assignment.targetDepartment.deptName,
            leaderName: assignment.targetDepartment.leaderEmployee?.empName ?? undefined,
          }
        : undefined,
      manager: {
        id: assignment.manager.id,
        name: assignment.manager.empName,
        department: assignment.manager.department.deptName,
      },
    },
    permissions,
    record: {
      memberAchievements: assignment.record?.memberAchievements ?? undefined,
      milestoneReview: assignment.record?.milestoneReview ?? undefined,
      issueRiskSummary: assignment.record?.issueRiskSummary ?? undefined,
      nextPeriodPlan: assignment.record?.nextPeriodPlan ?? undefined,
      agreedContext: assignment.record?.agreedContext ?? undefined,
      directionClarity: assignment.record?.directionClarity ?? null,
      directionClarityNote: assignment.record?.directionClarityNote ?? undefined,
      leaderSummary: assignment.record?.leaderSummary ?? undefined,
      leaderCoachingMemo: assignment.record?.leaderCoachingMemo ?? undefined,
      aiFollowUpQuestions: Array.isArray(assignment.record?.aiFollowUpQuestions)
        ? (assignment.record?.aiFollowUpQuestions as string[])
        : [],
      aiCommentSupport:
        assignment.record?.aiCommentSupport &&
        typeof assignment.record.aiCommentSupport === 'object' &&
        !Array.isArray(assignment.record.aiCommentSupport)
          ? (assignment.record.aiCommentSupport as {
              summary?: string
              draftComment?: string
              warnings?: string[]
            })
          : undefined,
      goalReviews: (assignment.record?.goalReviews ?? []).map((item) => ({
        id: item.id,
        orgKpiId: item.orgKpiId ?? undefined,
        orgKpiName: item.orgKpi?.kpiName ?? undefined,
        personalKpiId: item.personalKpiId ?? undefined,
        personalKpiName: item.personalKpi?.kpiName ?? undefined,
        goalValidityDecision: item.goalValidityDecision,
        goalValidityLabel: GOAL_VALIDITY_LABELS[item.goalValidityDecision],
        decisionReason: item.decisionReason ?? undefined,
        priorityAdjustmentMemo: item.priorityAdjustmentMemo ?? undefined,
        executionAdjustmentMemo: item.executionAdjustmentMemo ?? undefined,
        expectedState: item.expectedState ?? undefined,
        successScene: item.successScene ?? undefined,
        criteriaExceeds: item.criteriaExceeds ?? undefined,
        criteriaMeets: item.criteriaMeets ?? undefined,
        criteriaBelow: item.criteriaBelow ?? undefined,
        revisionRequested: item.revisionRequested,
      })),
      peopleReview:
        permissions.canViewSensitivePeopleReview && assignment.record?.peopleReview
          ? {
              retentionRiskLevel: assignment.record.peopleReview.retentionRiskLevel,
              retentionRiskLabel: assignment.record.peopleReview.retentionRiskLevel
                ? RETENTION_RISK_LABELS[assignment.record.peopleReview.retentionRiskLevel]
                : undefined,
              stayInterviewMemo: assignment.record.peopleReview.stayInterviewMemo ?? undefined,
              reboundGoal: assignment.record.peopleReview.reboundGoal ?? undefined,
              supportPlan: assignment.record.peopleReview.supportPlan ?? undefined,
              coachingPlan: assignment.record.peopleReview.coachingPlan ?? undefined,
              nextFollowUpAt: toIso(assignment.record.peopleReview.nextFollowUpAt),
            }
          : undefined,
      actionItems: (assignment.record?.actionItems ?? []).map((item) => ({
        id: item.id,
        actionText: item.actionText,
        ownerId: item.ownerId ?? undefined,
        ownerName: item.owner?.empName ?? undefined,
        dueDate: toIso(item.dueDate),
        status: item.status,
      })),
      memberSubmittedAt: toIso(assignment.record?.memberSubmittedAt),
      leaderSubmittedAt: toIso(assignment.record?.leaderSubmittedAt),
    },
    evidence,
  }
}

function sanitizeGoalReviewsForSave(input: MidReviewRecordSaveInput | MidReviewRecordSubmitInput) {
  return input.goalReviews.map((item) => ({
    id: item.id,
    orgKpiId: item.orgKpiId ?? null,
    personalKpiId: item.personalKpiId ?? null,
    goalValidityDecision: item.goalValidityDecision,
    decisionReason: item.decisionReason?.trim() || null,
    priorityAdjustmentMemo: item.priorityAdjustmentMemo?.trim() || null,
    executionAdjustmentMemo: item.executionAdjustmentMemo?.trim() || null,
    expectedState: item.expectedState?.trim() || null,
    successScene: item.successScene?.trim() || null,
    criteriaExceeds: item.criteriaExceeds?.trim() || null,
    criteriaMeets: item.criteriaMeets?.trim() || null,
    criteriaBelow: item.criteriaBelow?.trim() || null,
    revisionRequested: item.revisionRequested,
  }))
}

export async function saveMidReviewRecord(params: {
  session: Session
  checkInId: string
  input: MidReviewRecordSaveInput | MidReviewRecordSubmitInput
  submit: boolean
}) {
  const assignment = await getAssignmentWithContext(params.checkInId)
  const permissions = getMidReviewPermissions({ session: params.session, assignment })

  if (!permissions.canEditSelf && !permissions.canEditLeader) {
    throw new AppError(403, 'FORBIDDEN', '중간 점검을 수정할 권한이 없습니다.')
  }

  const user = getSessionUser(params.session)
  const actingAsLeader = permissions.canEditLeader && (user.id === assignment.managerId || user.role === 'ROLE_ADMIN')
  const actingAsSelf = permissions.canEditSelf && user.id === assignment.targetEmployeeId

  if (params.submit && actingAsLeader && params.input.goalReviews.length === 0 && !params.input.leaderSummary?.trim()) {
    throw new AppError(400, 'MID_REVIEW_SUBMIT_REQUIRED', '리더 제출 전에는 목표 검토 또는 리더 요약이 필요합니다.')
  }

  const goalReviews = sanitizeGoalReviewsForSave(params.input)
  const actionItems = params.input.actionItems.map((item) => ({
    id: item.id,
    actionText: item.actionText.trim(),
    ownerId: item.ownerId ?? null,
    dueDate: item.dueDate ? new Date(item.dueDate) : null,
    status: item.status,
  }))

  const peopleReviewInput = params.input.peopleReview
  const allowPeopleReview = permissions.canViewSensitivePeopleReview && assignment.cycle.peopleReviewEnabled

  const result = await prisma.$transaction(async (tx) => {
    const record = assignment.record
      ? await tx.midReviewRecord.update({
          where: { id: assignment.record.id },
          data: {
            ...(actingAsSelf || actingAsLeader
              ? {
                  memberAchievements: params.input.memberAchievements?.trim() || null,
                  milestoneReview: params.input.milestoneReview?.trim() || null,
                  issueRiskSummary: params.input.issueRiskSummary?.trim() || null,
                  nextPeriodPlan: params.input.nextPeriodPlan?.trim() || null,
                  agreedContext: params.input.agreedContext?.trim() || null,
                  directionClarity: params.input.directionClarity ?? null,
                  directionClarityNote: params.input.directionClarityNote?.trim() || null,
                }
              : {}),
            ...(actingAsLeader
              ? {
                  leaderSummary: params.input.leaderSummary?.trim() || null,
                  leaderCoachingMemo: params.input.leaderCoachingMemo?.trim() || null,
                  aiFollowUpQuestions: params.input.aiFollowUpQuestions as never,
                  aiCommentSupport: params.input.aiCommentSupport as never,
                  ...(params.submit ? { leaderSubmittedAt: new Date() } : {}),
                }
              : {}),
            ...(actingAsSelf && params.submit ? { memberSubmittedAt: new Date() } : {}),
          },
        })
      : await tx.midReviewRecord.create({
          data: {
            assignmentId: assignment.id,
            memberAchievements: params.input.memberAchievements?.trim() || null,
            milestoneReview: params.input.milestoneReview?.trim() || null,
            issueRiskSummary: params.input.issueRiskSummary?.trim() || null,
            nextPeriodPlan: params.input.nextPeriodPlan?.trim() || null,
            agreedContext: params.input.agreedContext?.trim() || null,
            directionClarity: params.input.directionClarity ?? null,
            directionClarityNote: params.input.directionClarityNote?.trim() || null,
            leaderSummary: actingAsLeader ? params.input.leaderSummary?.trim() || null : null,
            leaderCoachingMemo: actingAsLeader ? params.input.leaderCoachingMemo?.trim() || null : null,
            aiFollowUpQuestions: actingAsLeader ? (params.input.aiFollowUpQuestions as never) : undefined,
            aiCommentSupport: actingAsLeader ? (params.input.aiCommentSupport as never) : undefined,
            memberSubmittedAt: actingAsSelf && params.submit ? new Date() : null,
            leaderSubmittedAt: actingAsLeader && params.submit ? new Date() : null,
          },
        })

    if (actingAsLeader) {
      const existingGoalReviewIds = new Set(
        (
          await tx.midReviewGoalReview.findMany({
            where: { recordId: record.id },
            select: { id: true },
          })
        ).map((item) => item.id)
      )

      const incomingGoalReviewIds = new Set(goalReviews.flatMap((item) => (item.id ? [item.id] : [])))
      const deleteGoalReviewIds = [...existingGoalReviewIds].filter((id) => !incomingGoalReviewIds.has(id))
      if (deleteGoalReviewIds.length) {
        await tx.midReviewGoalReview.deleteMany({ where: { id: { in: deleteGoalReviewIds } } })
      }

      for (const goalReview of goalReviews) {
        if (goalReview.id) {
          await tx.midReviewGoalReview.update({
            where: { id: goalReview.id },
            data: {
              orgKpiId: goalReview.orgKpiId,
              personalKpiId: goalReview.personalKpiId,
              goalValidityDecision: goalReview.goalValidityDecision,
              decisionReason: goalReview.decisionReason,
              priorityAdjustmentMemo: goalReview.priorityAdjustmentMemo,
              executionAdjustmentMemo: goalReview.executionAdjustmentMemo,
              expectedState: goalReview.expectedState,
              successScene: goalReview.successScene,
              criteriaExceeds: goalReview.criteriaExceeds,
              criteriaMeets: goalReview.criteriaMeets,
              criteriaBelow: goalReview.criteriaBelow,
              revisionRequested: goalReview.revisionRequested,
            },
          })
        } else {
          await tx.midReviewGoalReview.create({
            data: {
              recordId: record.id,
              orgKpiId: goalReview.orgKpiId,
              personalKpiId: goalReview.personalKpiId,
              goalValidityDecision: goalReview.goalValidityDecision,
              decisionReason: goalReview.decisionReason,
              priorityAdjustmentMemo: goalReview.priorityAdjustmentMemo,
              executionAdjustmentMemo: goalReview.executionAdjustmentMemo,
              expectedState: goalReview.expectedState,
              successScene: goalReview.successScene,
              criteriaExceeds: goalReview.criteriaExceeds,
              criteriaMeets: goalReview.criteriaMeets,
              criteriaBelow: goalReview.criteriaBelow,
              revisionRequested: goalReview.revisionRequested,
            },
          })
        }
      }

      const existingActionItemIds = new Set(
        (
          await tx.midReviewActionItem.findMany({
            where: { recordId: record.id },
            select: { id: true },
          })
        ).map((item) => item.id)
      )
      const incomingActionItemIds = new Set(actionItems.flatMap((item) => (item.id ? [item.id] : [])))
      const deleteActionItemIds = [...existingActionItemIds].filter((id) => !incomingActionItemIds.has(id))
      if (deleteActionItemIds.length) {
        await tx.midReviewActionItem.deleteMany({ where: { id: { in: deleteActionItemIds } } })
      }

      for (const actionItem of actionItems) {
        if (actionItem.id) {
          await tx.midReviewActionItem.update({
            where: { id: actionItem.id },
            data: {
              actionText: actionItem.actionText,
              ownerId: actionItem.ownerId,
              dueDate: actionItem.dueDate,
              status: actionItem.status,
            },
          })
        } else {
          await tx.midReviewActionItem.create({
            data: {
              recordId: record.id,
              actionText: actionItem.actionText,
              ownerId: actionItem.ownerId,
              dueDate: actionItem.dueDate,
              status: actionItem.status,
            },
          })
        }
      }

      if (allowPeopleReview) {
        if (peopleReviewInput) {
          await tx.midReviewPeopleReview.upsert({
            where: { recordId: record.id },
            update: {
              retentionRiskLevel: peopleReviewInput.retentionRiskLevel ?? null,
              stayInterviewMemo: peopleReviewInput.stayInterviewMemo?.trim() || null,
              reboundGoal: peopleReviewInput.reboundGoal?.trim() || null,
              supportPlan: peopleReviewInput.supportPlan?.trim() || null,
              coachingPlan: peopleReviewInput.coachingPlan?.trim() || null,
              nextFollowUpAt: peopleReviewInput.nextFollowUpAt
                ? new Date(peopleReviewInput.nextFollowUpAt)
                : null,
            },
            create: {
              recordId: record.id,
              retentionRiskLevel: peopleReviewInput.retentionRiskLevel ?? null,
              stayInterviewMemo: peopleReviewInput.stayInterviewMemo?.trim() || null,
              reboundGoal: peopleReviewInput.reboundGoal?.trim() || null,
              supportPlan: peopleReviewInput.supportPlan?.trim() || null,
              coachingPlan: peopleReviewInput.coachingPlan?.trim() || null,
              nextFollowUpAt: peopleReviewInput.nextFollowUpAt
                ? new Date(peopleReviewInput.nextFollowUpAt)
                : null,
            },
          })
        } else {
          await tx.midReviewPeopleReview.deleteMany({ where: { recordId: record.id } })
        }
      }
    }

    const nextAssignmentStatus: MidReviewAssignmentStatus = params.submit
      ? actingAsLeader
        ? 'LEADER_SUBMITTED'
        : 'SELF_SUBMITTED'
      : actingAsLeader
        ? 'LEADER_DRAFT'
        : 'SELF_DRAFT'

    await tx.midReviewAssignment.update({
      where: { id: assignment.id },
      data: {
        status: nextAssignmentStatus,
        openedAt: assignment.openedAt ?? new Date(),
        completedAt: params.submit && actingAsLeader ? new Date() : null,
      },
    })

    await tx.checkIn.update({
      where: { id: params.checkInId },
      data: {
        status: params.submit && actingAsLeader ? 'COMPLETED' : 'IN_PROGRESS',
        actualDate: params.submit && actingAsLeader ? new Date() : undefined,
        keyTakeaways: actingAsLeader
          ? params.input.leaderSummary?.trim() || undefined
          : params.input.memberAchievements?.trim() || undefined,
      },
    })

    return record.id
  })

  return {
    recordId: result,
    assignmentId: assignment.id,
  }
}

function summarizeLatestGoalReview(goalReview: {
  goalValidityDecision: GoalValidityDecision
  decisionReason: string | null
  expectedState: string | null
  criteriaMeets: string | null
  revisionRequested: boolean
  record: {
    nextPeriodPlan: string | null
    updatedAt: Date
    assignment: {
      cycle: {
        reviewType: MidReviewType
      }
    }
  }
}): MidReviewSummaryViewModel {
  return {
    reviewTypeLabel: MID_REVIEW_TYPE_LABELS[goalReview.record.assignment.cycle.reviewType],
    goalValidityLabel: GOAL_VALIDITY_LABELS[goalReview.goalValidityDecision],
    decisionReason: goalReview.decisionReason ?? undefined,
    expectedState: goalReview.expectedState ?? undefined,
    criteriaMeets: goalReview.criteriaMeets ?? undefined,
    nextPeriodPlan: goalReview.record.nextPeriodPlan ?? undefined,
    updatedAt: goalReview.record.updatedAt.toISOString(),
    revisionRequested: goalReview.revisionRequested,
  }
}

export async function getLatestPersonalKpiMidReviewSummaries(personalKpiIds: string[]) {
  if (!personalKpiIds.length) {
    return new Map<string, MidReviewSummaryViewModel>()
  }

  const reviews = await prisma.midReviewGoalReview.findMany({
    where: {
      personalKpiId: { in: personalKpiIds },
      record: {
        assignment: {
          status: { in: ['LEADER_SUBMITTED', 'CLOSED'] },
        },
      },
    },
    include: {
      record: {
        select: {
          nextPeriodPlan: true,
          updatedAt: true,
          assignment: {
            select: {
              cycle: {
                select: {
                  reviewType: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  const map = new Map<string, MidReviewSummaryViewModel>()
  for (const review of reviews) {
    if (!review.personalKpiId || map.has(review.personalKpiId)) continue
    map.set(review.personalKpiId, summarizeLatestGoalReview(review))
  }
  return map
}

export async function getLatestOrgKpiMidReviewSummaries(orgKpiIds: string[]) {
  if (!orgKpiIds.length) {
    return new Map<string, MidReviewSummaryViewModel>()
  }

  const reviews = await prisma.midReviewGoalReview.findMany({
    where: {
      orgKpiId: { in: orgKpiIds },
      record: {
        assignment: {
          status: { in: ['LEADER_SUBMITTED', 'CLOSED'] },
        },
      },
    },
    include: {
      record: {
        select: {
          nextPeriodPlan: true,
          updatedAt: true,
          assignment: {
            select: {
              cycle: {
                select: {
                  reviewType: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  const map = new Map<string, MidReviewSummaryViewModel>()
  for (const review of reviews) {
    if (!review.orgKpiId || map.has(review.orgKpiId)) continue
    map.set(review.orgKpiId, summarizeLatestGoalReview(review))
  }
  return map
}

export async function getLatestEmployeeMidReviewSummary(employeeId: string) {
  const assignment = await prisma.midReviewAssignment.findFirst({
    where: {
      targetEmployeeId: employeeId,
      status: { in: ['SELF_SUBMITTED', 'LEADER_SUBMITTED', 'CLOSED'] },
    },
    include: {
      cycle: {
        select: {
          reviewType: true,
        },
      },
      record: {
        include: {
          goalReviews: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!assignment?.record) return null

  const latestGoalReview = assignment.record.goalReviews[0]
  return {
    reviewTypeLabel: MID_REVIEW_TYPE_LABELS[assignment.cycle.reviewType],
    goalValidityLabel: latestGoalReview
      ? GOAL_VALIDITY_LABELS[latestGoalReview.goalValidityDecision]
      : undefined,
    decisionReason: latestGoalReview?.decisionReason ?? undefined,
    expectedState: latestGoalReview?.expectedState ?? undefined,
    criteriaMeets: latestGoalReview?.criteriaMeets ?? undefined,
    nextPeriodPlan: assignment.record.nextPeriodPlan ?? undefined,
    updatedAt: assignment.record.updatedAt.toISOString(),
    revisionRequested: latestGoalReview?.revisionRequested ?? false,
  } satisfies MidReviewSummaryViewModel
}

export async function getMidReviewMonitoringView(evalCycleId?: string): Promise<MidReviewMonitoringViewModel> {
  const assignments = await prisma.midReviewAssignment.findMany({
    where: {
      cycle: {
        ...(evalCycleId ? { evalCycleId } : {}),
        status: { in: ['ACTIVE', 'CLOSED'] },
      },
    },
    include: {
      targetDepartment: {
        select: {
          id: true,
          deptName: true,
        },
      },
      targetEmployee: {
        select: {
          deptId: true,
          department: {
            select: {
              id: true,
              deptName: true,
            },
          },
        },
      },
      record: {
        select: {
          directionClarity: true,
          goalReviews: {
            select: {
              revisionRequested: true,
              goalValidityDecision: true,
            },
          },
          peopleReview: {
            select: {
              retentionRiskLevel: true,
              supportPlan: true,
            },
          },
          actionItems: {
            select: {
              id: true,
            },
          },
        },
      },
      cycle: {
        select: {
          id: true,
          reviewType: true,
          status: true,
          leaderDueAt: true,
        },
      },
    },
  })

  const byDepartment = new Map<
    string,
    {
      departmentId: string
      departmentName: string
      totalAssignments: number
      completedAssignments: number
      overdueCount: number
      noActionCount: number
      revisionRequestedCount: number
      highRiskWithoutPlanCount: number
      alignmentRiskCount: number
    }
  >()

  const now = Date.now()
  for (const assignment of assignments) {
    const department = assignment.targetDepartment ?? assignment.targetEmployee?.department
    if (!department) continue

    const bucket = byDepartment.get(department.id) ?? {
      departmentId: department.id,
      departmentName: department.deptName,
      totalAssignments: 0,
      completedAssignments: 0,
      overdueCount: 0,
      noActionCount: 0,
      revisionRequestedCount: 0,
      highRiskWithoutPlanCount: 0,
      alignmentRiskCount: 0,
    }

    bucket.totalAssignments += 1
    if (['LEADER_SUBMITTED', 'CLOSED'].includes(assignment.status)) {
      bucket.completedAssignments += 1
    }
    if (
      !['LEADER_SUBMITTED', 'CLOSED'].includes(assignment.status) &&
      assignment.cycle.leaderDueAt &&
      assignment.cycle.leaderDueAt.getTime() < now
    ) {
      bucket.overdueCount += 1
    }
    if (assignment.record?.actionItems.length === 0) {
      bucket.noActionCount += 1
    }
    bucket.revisionRequestedCount +=
      assignment.record?.goalReviews.filter(
        (item) => item.revisionRequested || item.goalValidityDecision !== 'KEEP_GOAL'
      ).length ?? 0
    if (
      assignment.record?.peopleReview?.retentionRiskLevel === 'HIGH' &&
      !assignment.record.peopleReview.supportPlan?.trim()
    ) {
      bucket.highRiskWithoutPlanCount += 1
    }
    if (assignment.record?.directionClarity && assignment.record.directionClarity !== 'CLEAR') {
      bucket.alignmentRiskCount += 1
    }

    byDepartment.set(department.id, bucket)
  }

  const departments = [...byDepartment.values()]
    .map((item) => ({
      ...item,
      progressRate: clampRate(item.completedAssignments, item.totalAssignments),
    }))
    .sort((left, right) => {
      if (right.overdueCount !== left.overdueCount) return right.overdueCount - left.overdueCount
      if (right.noActionCount !== left.noActionCount) return right.noActionCount - left.noActionCount
      return left.departmentName.localeCompare(right.departmentName, 'ko')
    })

  const summary = {
    activeCycleCount: new Set(assignments.map((item) => item.cycle.id)).size,
    activeAssignmentCount: assignments.length,
    completedAssignmentCount: assignments.filter((item) =>
      ['LEADER_SUBMITTED', 'CLOSED'].includes(item.status)
    ).length,
    progressRate: clampRate(
      assignments.filter((item) => ['LEADER_SUBMITTED', 'CLOSED'].includes(item.status)).length,
      assignments.length
    ),
    noActionTeamCount: departments.filter((item) => item.noActionCount > 0).length,
    revisionRequestedCount: departments.reduce((sum, item) => sum + item.revisionRequestedCount, 0),
    peopleRiskWithoutPlanCount: departments.reduce((sum, item) => sum + item.highRiskWithoutPlanCount, 0),
    alignmentRiskCount: departments.reduce((sum, item) => sum + item.alignmentRiskCount, 0),
  }

  return {
    summary,
    departments,
  }
}

export async function buildMidReviewAiPayload(params: {
  session: Session
  checkInId: string
  mode: 'evidence-summary' | 'leader-coach' | 'comment-support'
}) {
  const workspace = await getMidReviewWorkspace({
    session: params.session,
    checkInId: params.checkInId,
  })

  if (!workspace.permissions.canUseAi) {
    throw new AppError(403, 'FORBIDDEN', 'AI 도움을 사용할 권한이 없습니다.')
  }

  return {
    mode: params.mode,
    cycleName: workspace.cycle.name,
    reviewType: workspace.cycle.reviewTypeLabel,
    workflowMode: workspace.cycle.workflowModeLabel,
    targetEmployee: workspace.target.employee
      ? {
          name: workspace.target.employee.name,
          department: workspace.target.employee.department,
          position: workspace.target.employee.position,
        }
      : null,
    targetDepartment: workspace.target.department
      ? {
          name: workspace.target.department.name,
          leaderName: workspace.target.department.leaderName ?? null,
        }
      : null,
    record: {
      memberAchievements: workspace.record.memberAchievements ?? '',
      milestoneReview: workspace.record.milestoneReview ?? '',
      issueRiskSummary: workspace.record.issueRiskSummary ?? '',
      nextPeriodPlan: workspace.record.nextPeriodPlan ?? '',
      agreedContext: workspace.record.agreedContext ?? '',
      directionClarity: workspace.record.directionClarity ?? '',
      directionClarityNote: workspace.record.directionClarityNote ?? '',
      leaderSummary: workspace.record.leaderSummary ?? '',
      leaderCoachingMemo: workspace.record.leaderCoachingMemo ?? '',
      goalReviews: workspace.record.goalReviews.map((item) => ({
        goal: item.personalKpiName ?? item.orgKpiName ?? '',
        decision: item.goalValidityLabel,
        reason: item.decisionReason ?? '',
        expectedState: item.expectedState ?? '',
        criteriaMeets: item.criteriaMeets ?? '',
      })),
      actionItems: workspace.record.actionItems.map((item) => item.actionText),
    },
    evidence: workspace.evidence,
    permissions: {
      canViewSensitivePeopleReview: workspace.permissions.canViewSensitivePeopleReview,
    },
  }
}
