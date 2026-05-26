import type { FeedbackRoundStatus, FeedbackRoundType, Prisma, SystemRole } from '@prisma/client'
import { buildAdminGoogleAccessHref } from '@/lib/admin-google-access-tabs'
import { readPolicy2026OfficialReadinessEnabled } from '@/lib/evaluation-policy-2026-preview-metadata'
import {
  EVALUATION_2026_SCHEDULE_STATUS_LABELS,
  getEvaluation2026KoreaDateKey,
  getEvaluation2026ScheduleWindowMap,
  type Evaluation2026ScheduleWindow,
  type Evaluation2026ScheduleWindowKey,
  type Evaluation2026ScheduleWindowStatus,
} from '@/lib/evaluation-2026-schedule-readiness'
import { prisma } from '@/lib/prisma'
import { parsePerformanceDesignConfig } from '@/lib/performance-design'
import {
  getEvaluation2026ReadinessPopulationDryRun,
  type Evaluation2026ReadinessPopulationDryRun,
} from '@/server/evaluation-2026-readiness-population'

type CalendarSession = {
  user?: {
    role?: SystemRole | string | null
  } | null
}

export type PerformanceCalendarEventType =
  | 'goal'
  | 'review'
  | 'survey'
  | 'calibration'
  | 'anniversary'
  | 'milestone'

export type PerformanceCalendarPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type PerformanceCalendarAlert = {
  title: string
  description: string
}

export type PerformanceCalendarEvent = {
  id: string
  type: PerformanceCalendarEventType
  title: string
  subtitle: string
  description: string
  startsAt: string
  endsAt?: string | null
  dateKey: string
  allDay: boolean
  href: string
  hrefLabel: string
  sourceLabel: string
}

export type PerformanceOperationsMilestoneStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'BLOCKED'
  | 'NEEDS_REVIEW'

export type PerformanceOperationsScheduleStatus = Evaluation2026ScheduleWindowStatus

export type PerformanceOperationsOwnerRole =
  | 'HR'
  | 'TEAM_LEADER'
  | 'DIVISION_HEAD'
  | 'EMPLOYEE'
  | 'SYSTEM'

export type PerformanceOperationsReadinessLink =
  | 'MBO_COVERAGE'
  | 'TEAM_KPI_REVIEW'
  | 'GRADE_POLICY_READINESS'
  | 'AI_PASS_FAIL_READINESS'
  | 'ASSIGNMENT_SYNC'
  | 'PERFORMANCE_CALENDAR'

export type PerformanceOperationsChecklistItem = {
  id: string
  name: string
  plannedRangeLabel: string
  scheduleWindowKey: Evaluation2026ScheduleWindowKey | null
  scheduleStatus: PerformanceOperationsScheduleStatus
  scheduleStatusLabel: string
  relativeTimingLabel: string
  ownerRole: PerformanceOperationsOwnerRole
  ownerRoleLabel: string
  status: PerformanceOperationsMilestoneStatus
  statusLabel: string
  readinessLink: PerformanceOperationsReadinessLink
  readinessLinkLabel: string
  href: string
  blockerCount: number
  note: string
  lastUpdated: string | null
  actionGuidance: string[]
}

export type PerformanceOperationsChecklistAction = {
  id: string
  label: string
  description: string
  href: string
  blockerCount: number
}

export type PerformanceOperationsChecklist = {
  policyVersion: '2026-PPT-OPERATIONS-READINESS'
  mode: 'read_only'
  selectedCycleId: string | null
  selectedCycleName: string | null
  selectedCycleIsOfficialReadinessTarget: boolean
  persistence: {
    existing: boolean
    source: 'EvalCycle.performanceDesignConfig.milestones'
    saveImplemented: false
    note: string
  }
  safety: {
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    backfillRun: false
  }
  summary: {
    totalMilestones: number
    blockerCount: number
    statusCounts: Record<PerformanceOperationsMilestoneStatus, number>
    scheduleStatusCounts: Record<PerformanceOperationsScheduleStatus, number>
  }
  schedule: {
    referenceDate: string
    activeWindows: Array<{
      key: Evaluation2026ScheduleWindowKey
      label: string
      recommendedAction: string
      href: string
    }>
  }
  nowActions: PerformanceOperationsChecklistAction[]
  milestones: PerformanceOperationsChecklistItem[]
}

export type PerformanceCalendarPageData = {
  state: PerformanceCalendarPageState
  message?: string
  month: string
  monthLabel: string
  timezone: string
  selectedTypes: PerformanceCalendarEventType[]
  filters: Array<{
    type: PerformanceCalendarEventType
    label: string
    count: number
  }>
  summary: {
    totalCount: number
    monthStart: string
    monthEnd: string
    nextUpcoming?: {
      title: string
      dateLabel: string
      href: string
    }
  }
  events: PerformanceCalendarEvent[]
  alerts: PerformanceCalendarAlert[]
  operationsChecklist: PerformanceOperationsChecklist
}

type CalendarParams = {
  month?: string
  types?: PerformanceCalendarEventType[]
  today?: string
}

type EvalCycleLite = {
  id: string
  cycleName: string
  evalYear: number
  kpiSetupStart: Date | null
  kpiSetupEnd: Date | null
  selfEvalStart: Date | null
  selfEvalEnd: Date | null
  firstEvalStart: Date | null
  firstEvalEnd: Date | null
  secondEvalStart: Date | null
  secondEvalEnd: Date | null
  finalEvalStart: Date | null
  finalEvalEnd: Date | null
  ceoAdjustStart: Date | null
  ceoAdjustEnd: Date | null
  resultOpenStart: Date | null
  resultOpenEnd: Date | null
  appealDeadline: Date | null
  performanceDesignConfig: Prisma.JsonValue | null
  organization: {
    name: string
  }
}

type FeedbackRoundLite = {
  id: string
  roundName: string
  roundType: FeedbackRoundType
  startDate: Date
  endDate: Date
  status: FeedbackRoundStatus
  evalCycle: {
    id: string
    cycleName: string
    organization: {
      name: string
    }
  }
}

type AiCompetencyCycleLite = {
  id: string
  cycleName: string
  submissionOpenAt: Date | null
  submissionCloseAt: Date | null
  reviewOpenAt: Date | null
  reviewCloseAt: Date | null
  resultPublishAt: Date | null
  evalCycle: {
    id: string
    cycleName: string
    organization: {
      name: string
    }
  }
}

type EmployeeLite = {
  id: string
  empName: string
  joinDate: Date
  department: {
    deptName: string
  } | null
}

type PerformanceOperationsAssignmentCoverage = {
  assignmentCount: number
  targetCount: number
  evaluatorCount: number
}

type PerformanceOperationsAiReadiness = {
  cycleExists: boolean
  targetCount: number
  missingSubmissionCount: number
  needsRevisionCount: number
  pendingReviewCount: number
  passedCount: number
  failedCount: number
}

type CalendarDeps = {
  loadEvalCycles: (selectedYear: number) => Promise<EvalCycleLite[]>
  loadFeedbackRounds: (selectedYear: number) => Promise<FeedbackRoundLite[]>
  loadAiCompetencyCycles: (selectedYear: number) => Promise<AiCompetencyCycleLite[]>
  loadEmployees: (monthNumber: number) => Promise<EmployeeLite[]>
  loadReadinessPopulationDryRun?: (evalCycleId: string) => Promise<Evaluation2026ReadinessPopulationDryRun | null>
  loadAssignmentCoverage?: (evalCycleId: string) => Promise<PerformanceOperationsAssignmentCoverage>
  loadAiCompetencyReadiness?: (evalCycleId: string) => Promise<PerformanceOperationsAiReadiness>
}

const TIMEZONE = 'Asia/Seoul'

const FILTER_LABELS: Record<PerformanceCalendarEventType, string> = {
  goal: '목표',
  review: '리뷰',
  survey: '서베이',
  calibration: '캘리브레이션',
  anniversary: '입사일',
  milestone: '운영 일정',
}

const OPERATIONS_STATUS_LABELS: Record<PerformanceOperationsMilestoneStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  BLOCKED: 'blocker 있음',
  NEEDS_REVIEW: '검토 필요',
}

const OPERATIONS_OWNER_LABELS: Record<PerformanceOperationsOwnerRole, string> = {
  HR: 'HR',
  TEAM_LEADER: '팀장',
  DIVISION_HEAD: '본부장',
  EMPLOYEE: '직원',
  SYSTEM: '시스템',
}

const READINESS_LINK_LABELS: Record<PerformanceOperationsReadinessLink, string> = {
  MBO_COVERAGE: 'MBO coverage',
  TEAM_KPI_REVIEW: 'Team KPI review',
  GRADE_POLICY_READINESS: 'Grade policy readiness',
  AI_PASS_FAIL_READINESS: 'AI Pass/Fail readiness',
  ASSIGNMENT_SYNC: 'Assignment sync',
  PERFORMANCE_CALENDAR: '운영 일정',
}

const EMPTY_OPERATIONS_CHECKLIST: PerformanceOperationsChecklist = {
  policyVersion: '2026-PPT-OPERATIONS-READINESS',
  mode: 'read_only',
  selectedCycleId: null,
  selectedCycleName: null,
  selectedCycleIsOfficialReadinessTarget: false,
  persistence: {
    existing: true,
    source: 'EvalCycle.performanceDesignConfig.milestones',
    saveImplemented: false,
    note: '기존 performanceDesignConfig.milestones는 일정 표시용이며 status/note 저장 스키마가 아직 없습니다. 이 체크리스트는 PPT 기준 운영 가이드로 읽기 전용 표시합니다.',
  },
  safety: {
    officialScoringEnabled: false,
    officialGradeEnabled: false,
    officialAiScoreExclusionEnabled: false,
    totalScoreChanged: false,
    gradeIdChanged: false,
    evaluationsCreated: 0,
    evaluationItemsCreated: 0,
    backfillRun: false,
  },
  summary: {
    totalMilestones: 0,
    blockerCount: 0,
    statusCounts: {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      NEEDS_REVIEW: 0,
    },
    scheduleStatusCounts: {
      UPCOMING: 0,
      ACTIVE: 0,
      CLOSED: 0,
      NEEDS_SETUP: 0,
    },
  },
  schedule: {
    referenceDate: getEvaluation2026KoreaDateKey(),
    activeWindows: [],
  },
  nowActions: [],
  milestones: [],
}

function parseMonthKey(input?: string) {
  if (input && /^\d{4}-\d{2}$/.test(input)) {
    const [year, month] = input.split('-').map(Number)
    if (month >= 1 && month <= 12) {
      return { year, month, key: `${year}-${String(month).padStart(2, '0')}` }
    }
  }

  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  }
}

function parseReferenceDate(input?: string) {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(`${input}T12:00:00+09:00`)
  }
  return new Date()
}

function buildMonthRange(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-')
  return `${year}년 ${Number(month)}월`
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('ko-KR', {
    timeZone: TIMEZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatDateKey(date: Date) {
  return date.toLocaleDateString('sv-SE', { timeZone: TIMEZONE })
}

function formatDateTimeLabel(date: Date) {
  return date.toLocaleString('ko-KR', {
    timeZone: TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function overlapsMonth(params: { start: Date | null; end?: Date | null; monthStart: Date; monthEnd: Date }) {
  if (!params.start) return false
  const start = params.start.getTime()
  const end = (params.end ?? params.start).getTime()
  return start < params.monthEnd.getTime() && end >= params.monthStart.getTime()
}

function pushRangeEvent(
  events: PerformanceCalendarEvent[],
  params: {
    id: string
    type: PerformanceCalendarEventType
    title: string
    subtitle: string
    description: string
    startsAt: Date | null
    endsAt?: Date | null
    href: string
    hrefLabel: string
    sourceLabel: string
    monthStart: Date
    monthEnd: Date
  }
) {
  if (!overlapsMonth({ start: params.startsAt, end: params.endsAt ?? null, monthStart: params.monthStart, monthEnd: params.monthEnd })) {
    return
  }

  if (!params.startsAt) return

  events.push({
    id: params.id,
    type: params.type,
    title: params.title,
    subtitle: params.subtitle,
    description: params.description,
    startsAt: params.startsAt.toISOString(),
    endsAt: params.endsAt?.toISOString() ?? null,
    dateKey: formatDateKey(params.startsAt),
    allDay: true,
    href: params.href,
    hrefLabel: params.hrefLabel,
    sourceLabel: params.sourceLabel,
  })
}

async function loadSection<T>(params: {
  title: string
  description: string
  alerts: PerformanceCalendarAlert[]
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`[performance-calendar] ${params.title}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
    })
    return params.fallback
  }
}

function buildDefaultDeps(): CalendarDeps {
  return {
    loadEvalCycles: async (selectedYear) =>
      prisma.evalCycle.findMany({
        where: {
          evalYear: { gte: selectedYear - 1, lte: selectedYear + 1 },
        },
        select: {
          id: true,
          cycleName: true,
          evalYear: true,
          kpiSetupStart: true,
          kpiSetupEnd: true,
          selfEvalStart: true,
          selfEvalEnd: true,
          firstEvalStart: true,
          firstEvalEnd: true,
          secondEvalStart: true,
          secondEvalEnd: true,
          finalEvalStart: true,
          finalEvalEnd: true,
          ceoAdjustStart: true,
          ceoAdjustEnd: true,
          resultOpenStart: true,
          resultOpenEnd: true,
          appealDeadline: true,
          performanceDesignConfig: true,
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      }),
    loadFeedbackRounds: async (selectedYear) =>
      prisma.multiFeedbackRound.findMany({
        where: {
          evalCycle: {
            evalYear: { gte: selectedYear - 1, lte: selectedYear + 1 },
          },
        },
        select: {
          id: true,
          roundName: true,
          roundType: true,
          startDate: true,
          endDate: true,
          status: true,
          evalCycle: {
            select: {
              id: true,
              cycleName: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ startDate: 'asc' }],
      }),
    loadAiCompetencyCycles: async (selectedYear) =>
      prisma.aiCompetencyGateCycle.findMany({
        where: {
          evalCycle: {
            evalYear: { gte: selectedYear - 1, lte: selectedYear + 1 },
          },
        },
        select: {
          id: true,
          cycleName: true,
          submissionOpenAt: true,
          submissionCloseAt: true,
          reviewOpenAt: true,
          reviewCloseAt: true,
          resultPublishAt: true,
          evalCycle: {
            select: {
              id: true,
              cycleName: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    loadEmployees: async (monthNumber) =>
      prisma.employee.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          empName: true,
          joinDate: true,
          department: {
            select: {
              deptName: true,
            },
          },
        },
        orderBy: [{ joinDate: 'asc' }],
      }).then((employees) =>
        employees.filter((employee) => employee.joinDate.getUTCMonth() + 1 === monthNumber)
      ),
    loadReadinessPopulationDryRun: async (evalCycleId) =>
      getEvaluation2026ReadinessPopulationDryRun({
        evalCycleId,
        limit: 20,
      }),
    loadAssignmentCoverage: async (evalCycleId) =>
      prisma.evaluationAssignment.findMany({
        where: { evalCycleId },
        select: {
          targetId: true,
          evaluatorId: true,
        },
      }).then((assignments) => ({
        assignmentCount: assignments.length,
        targetCount: new Set(assignments.map((assignment) => assignment.targetId)).size,
        evaluatorCount: new Set(assignments.map((assignment) => assignment.evaluatorId)).size,
      })),
    loadAiCompetencyReadiness: async (evalCycleId) =>
      prisma.aiCompetencyGateCycle.findUnique({
        where: { evalCycleId },
        select: {
          id: true,
          assignments: {
            select: {
              status: true,
            },
          },
        },
      }).then((cycle) => {
        const assignments = cycle?.assignments ?? []
        return {
          cycleExists: Boolean(cycle),
          targetCount: assignments.length,
          missingSubmissionCount: assignments.filter((assignment) =>
            assignment.status === 'NOT_STARTED' || assignment.status === 'DRAFT'
          ).length,
          needsRevisionCount: assignments.filter((assignment) => assignment.status === 'REVISION_REQUESTED').length,
          pendingReviewCount: assignments.filter((assignment) =>
            assignment.status === 'SUBMITTED' ||
            assignment.status === 'RESUBMITTED' ||
            assignment.status === 'UNDER_REVIEW'
          ).length,
          passedCount: assignments.filter((assignment) => assignment.status === 'PASSED').length,
          failedCount: assignments.filter((assignment) => assignment.status === 'FAILED').length,
        }
      }),
  }
}

function buildEvents(params: {
  monthStart: Date
  monthEnd: Date
  evalCycles: EvalCycleLite[]
  feedbackRounds: FeedbackRoundLite[]
  aiCycles: AiCompetencyCycleLite[]
  employees: EmployeeLite[]
}) {
  const events: PerformanceCalendarEvent[] = []

  for (const cycle of params.evalCycles) {
    pushRangeEvent(events, {
      id: `${cycle.id}:goal`,
      type: 'goal',
      title: `${cycle.cycleName} 목표 수립`,
      subtitle: cycle.organization.name,
      description: 'KPI 수립 및 수정이 가능한 기간입니다.',
      startsAt: cycle.kpiSetupStart,
      endsAt: cycle.kpiSetupEnd,
      href: '/admin/eval-cycle',
      hrefLabel: '평가 주기 관리로 이동',
      sourceLabel: '목표 일정',
      monthStart: params.monthStart,
      monthEnd: params.monthEnd,
    })

    const designConfig = parsePerformanceDesignConfig(cycle.performanceDesignConfig)
    designConfig.milestones.forEach((milestone) =>
      pushRangeEvent(events, {
        id: `${cycle.id}:milestone:${milestone.id}`,
        type: 'milestone',
        title: `${cycle.cycleName} ${milestone.label}`,
        subtitle: cycle.organization.name,
        description: milestone.description,
        startsAt: milestone.startAt ? new Date(milestone.startAt) : null,
        endsAt: milestone.endAt ? new Date(milestone.endAt) : null,
        href: `/admin/performance-design?cycleId=${encodeURIComponent(cycle.id)}`,
        hrefLabel: '성과 설계 화면으로 이동',
        sourceLabel: '운영 일정',
        monthStart: params.monthStart,
        monthEnd: params.monthEnd,
      })
    )

    ;[
      {
        key: 'self',
        title: `${cycle.cycleName} 자기평가`,
        startsAt: cycle.selfEvalStart,
        endsAt: cycle.selfEvalEnd,
      },
      {
        key: 'first',
        title: `${cycle.cycleName} 1차 평가`,
        startsAt: cycle.firstEvalStart,
        endsAt: cycle.firstEvalEnd,
      },
      {
        key: 'second',
        title: `${cycle.cycleName} 2차 평가`,
        startsAt: cycle.secondEvalStart,
        endsAt: cycle.secondEvalEnd,
      },
      {
        key: 'final',
        title: `${cycle.cycleName} 최종 평가`,
        startsAt: cycle.finalEvalStart,
        endsAt: cycle.finalEvalEnd,
      },
      {
        key: 'result',
        title: `${cycle.cycleName} 결과 공개`,
        startsAt: cycle.resultOpenStart,
        endsAt: cycle.resultOpenEnd,
      },
    ].forEach((item) =>
      pushRangeEvent(events, {
        id: `${cycle.id}:${item.key}`,
        type: 'review',
        title: item.title,
        subtitle: cycle.organization.name,
        description: '평가 진행과 공개 일정을 한눈에 확인할 수 있습니다.',
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        href: '/evaluation/results',
        hrefLabel: '평가 결과 화면으로 이동',
        sourceLabel: '리뷰 일정',
        monthStart: params.monthStart,
        monthEnd: params.monthEnd,
      })
    )

    pushRangeEvent(events, {
      id: `${cycle.id}:appeal`,
      type: 'review',
      title: `${cycle.cycleName} 이의 신청 마감`,
      subtitle: cycle.organization.name,
      description: '이의 신청 접수 마감일입니다.',
      startsAt: cycle.appealDeadline,
      href: '/evaluation/appeal',
      hrefLabel: '이의 신청 화면으로 이동',
      sourceLabel: '리뷰 일정',
      monthStart: params.monthStart,
      monthEnd: params.monthEnd,
    })

    pushRangeEvent(events, {
      id: `${cycle.id}:calibration`,
      type: 'calibration',
      title: `${cycle.cycleName} 캘리브레이션`,
      subtitle: cycle.organization.name,
      description: 'CEO 조정 및 캘리브레이션 운영 구간입니다.',
      startsAt: cycle.ceoAdjustStart,
      endsAt: cycle.ceoAdjustEnd,
      href: '/evaluation/ceo-adjust',
      hrefLabel: '캘리브레이션 화면으로 이동',
      sourceLabel: '캘리브레이션',
      monthStart: params.monthStart,
      monthEnd: params.monthEnd,
    })
  }

  for (const round of params.feedbackRounds) {
    pushRangeEvent(events, {
      id: `feedback:${round.id}`,
      type: 'survey',
      title: round.roundName,
      subtitle: `${round.evalCycle.organization.name} · ${round.roundType}`,
      description: `${round.status} 상태의 다면평가/서베이 라운드입니다.`,
      startsAt: round.startDate,
      endsAt: round.endDate,
      href: '/evaluation/360/admin',
      hrefLabel: '다면평가 운영으로 이동',
      sourceLabel: '서베이 일정',
      monthStart: params.monthStart,
      monthEnd: params.monthEnd,
    })
  }

  for (const cycle of params.aiCycles) {
    ;[
      {
        key: 'ai-submission',
        title: `${cycle.cycleName} AI 활용능력 심사`,
        startsAt: cycle.submissionOpenAt,
        endsAt: cycle.submissionCloseAt,
      },
      {
        key: 'ai-calibration',
        title: `${cycle.cycleName} AI 활용능력 보정`,
        startsAt: cycle.reviewOpenAt,
        endsAt: cycle.reviewCloseAt,
      },
      {
        key: 'ai-second-round',
        title: `${cycle.cycleName} 2차 신청`,
        startsAt: null,
        endsAt: null,
      },
      {
        key: 'ai-result',
        title: `${cycle.cycleName} 결과 공개`,
        startsAt: cycle.resultPublishAt,
        endsAt: null,
      },
    ].forEach((item) =>
      pushRangeEvent(events, {
        id: `${cycle.id}:${item.key}`,
        type: 'review',
        title: item.title,
        subtitle: cycle.evalCycle.organization.name,
        description: 'AI 활용능력 평가 운영 일정입니다.',
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        href: '/evaluation/ai-competency',
        hrefLabel: 'AI 활용능력 평가로 이동',
        sourceLabel: item.key === 'ai-calibration' ? '캘리브레이션' : '리뷰 일정',
        monthStart: params.monthStart,
        monthEnd: params.monthEnd,
      })
    )
  }

  for (const employee of params.employees) {
    const anniversary = new Date(Date.UTC(params.monthStart.getUTCFullYear(), employee.joinDate.getUTCMonth(), employee.joinDate.getUTCDate()))
    pushRangeEvent(events, {
      id: `anniversary:${employee.id}:${formatDateKey(anniversary)}`,
      type: 'anniversary',
      title: `${employee.empName} 입사기념일`,
      subtitle: employee.department?.deptName ?? '부서 미지정',
      description: `${employee.empName} 구성원의 입사일/입사기념일입니다.`,
      startsAt: anniversary,
      href: buildAdminGoogleAccessHref('org-chart'),
      hrefLabel: '조직도 관리로 이동',
      sourceLabel: '입사일',
      monthStart: params.monthStart,
      monthEnd: params.monthEnd,
    })
  }

  return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title))
}

function selectOperationsCycle(params: { evalCycles: EvalCycleLite[]; selectedYear: number }) {
  const cycles2026 = params.evalCycles.filter((cycle) => cycle.evalYear === 2026)
  return (
    cycles2026.find((cycle) => readPolicy2026OfficialReadinessEnabled(cycle.performanceDesignConfig)) ??
    cycles2026[0] ??
    params.evalCycles.find((cycle) => cycle.evalYear === params.selectedYear) ??
    null
  )
}

function dateRangeLabel(start?: Date | null, end?: Date | null, fallback = 'HR 일정 입력 필요') {
  if (!start && !end) return fallback
  if (start && end) return `${formatDateLabel(start)} ~ ${formatDateLabel(end)}`
  if (start) return `${formatDateLabel(start)}부터`
  return `${formatDateLabel(end as Date)}까지`
}

function statusForBlockers(blockerCount: number, fallback: PerformanceOperationsMilestoneStatus = 'NOT_STARTED') {
  if (blockerCount > 0) return 'BLOCKED'
  return fallback
}

function makeOperationsMilestone(params: {
  id: string
  name: string
  plannedRangeLabel: string
  scheduleWindow?: Evaluation2026ScheduleWindow | null
  ownerRole: PerformanceOperationsOwnerRole
  status: PerformanceOperationsMilestoneStatus
  readinessLink: PerformanceOperationsReadinessLink
  href: string
  blockerCount?: number
  note: string
  actionGuidance: string[]
}): PerformanceOperationsChecklistItem {
  return {
    id: params.id,
    name: params.name,
    plannedRangeLabel: params.plannedRangeLabel,
    scheduleWindowKey: params.scheduleWindow?.key ?? null,
    scheduleStatus: params.scheduleWindow?.status ?? 'NEEDS_SETUP',
    scheduleStatusLabel:
      params.scheduleWindow?.statusLabel ?? EVALUATION_2026_SCHEDULE_STATUS_LABELS.NEEDS_SETUP,
    relativeTimingLabel: params.scheduleWindow?.relativeTimingLabel ?? 'HR 일정 metadata 확정 필요',
    ownerRole: params.ownerRole,
    ownerRoleLabel: OPERATIONS_OWNER_LABELS[params.ownerRole],
    status: params.status,
    statusLabel: OPERATIONS_STATUS_LABELS[params.status],
    readinessLink: params.readinessLink,
    readinessLinkLabel: READINESS_LINK_LABELS[params.readinessLink],
    href: params.href,
    blockerCount: params.blockerCount ?? 0,
    note: params.note,
    lastUpdated: null,
    actionGuidance: params.actionGuidance,
  }
}

function buildStatusCounts(milestones: PerformanceOperationsChecklistItem[]) {
  const counts: Record<PerformanceOperationsMilestoneStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    BLOCKED: 0,
    NEEDS_REVIEW: 0,
  }
  for (const milestone of milestones) {
    counts[milestone.status] += 1
  }
  return counts
}

function buildScheduleStatusCounts(milestones: PerformanceOperationsChecklistItem[]) {
  const counts: Record<PerformanceOperationsScheduleStatus, number> = {
    UPCOMING: 0,
    ACTIVE: 0,
    CLOSED: 0,
    NEEDS_SETUP: 0,
  }
  for (const milestone of milestones) {
    counts[milestone.scheduleStatus] += 1
  }
  return counts
}

function buildNowActions(milestones: PerformanceOperationsChecklistItem[]) {
  return milestones
    .filter((milestone) => milestone.status === 'BLOCKED' || milestone.status === 'NEEDS_REVIEW')
    .map((milestone) => ({
      id: `action-${milestone.id}`,
      label: milestone.actionGuidance[0] ?? milestone.name,
      description: milestone.note,
      href: milestone.href,
      blockerCount: milestone.blockerCount,
    }))
}

function buildOperationsChecklist(params: {
  selectedYear: number
  evalCycles: EvalCycleLite[]
  feedbackRounds: FeedbackRoundLite[]
  readiness: Evaluation2026ReadinessPopulationDryRun | null
  assignmentCoverage: PerformanceOperationsAssignmentCoverage | null
  aiReadiness: PerformanceOperationsAiReadiness | null
  referenceDate: Date
}): PerformanceOperationsChecklist {
  const cycle = selectOperationsCycle({
    evalCycles: params.evalCycles,
    selectedYear: params.selectedYear,
  })
  const readiness = params.readiness
  const mboMissing = readiness?.mboSetupCoverage.employeesMissingAnyPersonalKpiCount ?? 0
  const confirmedMissing = readiness?.employeesMissingConfirmedPersonalKpiCount ?? 0
  const policyCategoryMissing = readiness?.policyCategoryMissingCount ?? 0
  const teamKpiPending =
    (readiness?.teamKpiHrReviewCoverage.pendingReviewCount ?? 0) +
    (readiness?.teamKpiHrReviewCoverage.needsDiscussionCount ?? 0)
  const gradeBlockers = readiness?.gradePolicyReadiness.blockers.length ?? 0
  const assignmentTargets = params.assignmentCoverage?.targetCount ?? 0
  const aiMissing =
    params.aiReadiness?.cycleExists === false
      ? 1
      : (params.aiReadiness?.missingSubmissionCount ?? 0) +
        (params.aiReadiness?.needsRevisionCount ?? 0) +
        (params.aiReadiness?.pendingReviewCount ?? 0)
  const feedbackRoundCount = params.feedbackRounds.filter((round) => round.evalCycle.id === cycle?.id).length
  const scheduleWindows = getEvaluation2026ScheduleWindowMap(params.referenceDate)

  const milestones: PerformanceOperationsChecklistItem[] = [
    makeOperationsMilestone({
      id: 'member-goal-setup-confirm',
      name: '팀원 업적목표 수립 및 확정',
      plannedRangeLabel: dateRangeLabel(cycle?.kpiSetupStart, cycle?.kpiSetupEnd),
      scheduleWindow: scheduleWindows.MBO_SETUP,
      ownerRole: 'EMPLOYEE',
      status: statusForBlockers(mboMissing + confirmedMissing, confirmedMissing === 0 && mboMissing === 0 ? 'DONE' : 'IN_PROGRESS'),
      readinessLink: 'MBO_COVERAGE',
      href: '/evaluation/performance',
      blockerCount: mboMissing + confirmedMissing,
      note: `MBO 미작성 ${mboMissing}명, 확정 KPI 누락 ${confirmedMissing}명입니다.`,
      actionGuidance: ['MBO 미작성자 확인', '제출 요청 필요', '리더 검토 필요'],
    }),
    makeOperationsMilestone({
      id: 'org-goal-kpi-adjustment',
      name: '2026 조직목표 KPI 조정',
      plannedRangeLabel: dateRangeLabel(cycle?.kpiSetupStart, cycle?.kpiSetupEnd),
      scheduleWindow: scheduleWindows.ORG_KPI_ADJUSTMENT,
      ownerRole: 'DIVISION_HEAD',
      status: teamKpiPending > 0 ? 'NEEDS_REVIEW' : 'IN_PROGRESS',
      readinessLink: 'TEAM_KPI_REVIEW',
      href: '/kpi/org',
      blockerCount: teamKpiPending,
      note: '본부 KPI와 팀 KPI를 먼저 정리해야 개인 MBO의 조직목표 후보가 안정화됩니다.',
      actionGuidance: ['팀 KPI 검토 완료', '본부 KPI 외 팀 KPI 확정'],
    }),
    makeOperationsMilestone({
      id: 'policy-briefing',
      name: '조직장/팀원 설명회',
      plannedRangeLabel: 'PPT 운영 일정 기준',
      scheduleWindow: null,
      ownerRole: 'HR',
      status: 'NEEDS_REVIEW',
      readinessLink: 'PERFORMANCE_CALENDAR',
      href: '/admin/performance-calendar',
      blockerCount: 0,
      note: '2026 정책, MBO category, AI Pass/Fail 분리 운영을 설명해야 합니다.',
      actionGuidance: ['조직장/팀원 설명회 일정 확정'],
    }),
    makeOperationsMilestone({
      id: 'team-kpi-finalization',
      name: '본부 KPI 외 팀 KPI 확정',
      plannedRangeLabel: 'MBO 확정 전',
      scheduleWindow: scheduleWindows.TEAM_KPI_CONFIRMATION,
      ownerRole: 'HR',
      status: teamKpiPending > 0 ? 'BLOCKED' : 'DONE',
      readinessLink: 'TEAM_KPI_REVIEW',
      href: '/evaluation/performance',
      blockerCount: teamKpiPending,
      note: `검토 대기/논의 필요 팀 KPI ${teamKpiPending}건입니다.`,
      actionGuidance: ['팀 KPI 검토 완료', '조직목표 반영/일상업무 처리 결정'],
    }),
    makeOperationsMilestone({
      id: 'personal-goal-card-update',
      name: '팀원 개인업적목표관리카드 수정',
      plannedRangeLabel: '팀 KPI HR 결정 후',
      scheduleWindow: scheduleWindows.MBO_REVISION,
      ownerRole: 'EMPLOYEE',
      status: statusForBlockers(policyCategoryMissing, policyCategoryMissing === 0 ? 'DONE' : 'IN_PROGRESS'),
      readinessLink: 'MBO_COVERAGE',
      href: '/kpi/personal',
      blockerCount: policyCategoryMissing,
      note: `policyCategory 미확정 KPI ${policyCategoryMissing}건입니다.`,
      actionGuidance: ['카테고리 확정 필요', '조직목표/프로젝트/일상업무 중복 확인'],
    }),
    makeOperationsMilestone({
      id: 'mid-review-feedback',
      name: '업무목표 중간 점검/피드백',
      plannedRangeLabel: scheduleWindows.MID_CHECK.plannedRangeLabel,
      scheduleWindow: scheduleWindows.MID_CHECK,
      ownerRole: 'TEAM_LEADER',
      status: 'NOT_STARTED',
      readinessLink: 'PERFORMANCE_CALENDAR',
      href: '/checkin',
      blockerCount: 0,
      note: '목표 변경 전 진행률, 장애요인, 피드백 기록을 확인합니다.',
      actionGuidance: ['중간 점검/피드백 운영 안내'],
    }),
    makeOperationsMilestone({
      id: 'goal-change-request',
      name: '업무목표 변경 신청 기간',
      plannedRangeLabel: scheduleWindows.GOAL_CHANGE_REQUEST.plannedRangeLabel,
      scheduleWindow: scheduleWindows.GOAL_CHANGE_REQUEST,
      ownerRole: 'EMPLOYEE',
      status: 'NOT_STARTED',
      readinessLink: 'PERFORMANCE_CALENDAR',
      href: '/kpi/personal',
      blockerCount: 0,
      note: '업무목표 변경은 공식 scoring 활성화 전 별도 신청/승인 흐름으로 운영해야 합니다.',
      actionGuidance: ['업무목표 변경 신청 안내'],
    }),
    makeOperationsMilestone({
      id: 'performance-result-writing',
      name: '2026 업적목표 수행결과 작성',
      plannedRangeLabel: scheduleWindows.RESULT_WRITING.plannedRangeLabel,
      scheduleWindow: scheduleWindows.RESULT_WRITING,
      ownerRole: 'EMPLOYEE',
      status: assignmentTargets > 0 ? 'NOT_STARTED' : 'BLOCKED',
      readinessLink: 'ASSIGNMENT_SYNC',
      href: '/admin/performance-assignments',
      blockerCount: assignmentTargets > 0 ? 0 : 1,
      note: `평가자/대상자 배정 대상 ${assignmentTargets}명입니다.`,
      actionGuidance: ['평가자 배정 확인', '수행결과 작성 안내'],
    }),
    makeOperationsMilestone({
      id: 'org-evaluation-close',
      name: '2026 조직평가 종료',
      plannedRangeLabel: scheduleWindows.ORG_EVALUATION_CLOSE.plannedRangeLabel,
      scheduleWindow: scheduleWindows.ORG_EVALUATION_CLOSE,
      ownerRole: 'HR',
      status: gradeBlockers > 0 ? 'BLOCKED' : 'NEEDS_REVIEW',
      readinessLink: 'GRADE_POLICY_READINESS',
      href: '/evaluation/performance',
      blockerCount: gradeBlockers,
      note: `등급 기준 readiness blocker ${gradeBlockers}건입니다. 공식 등급은 아직 미적용입니다.`,
      actionGuidance: ['등급 기준 HR 확인', '조직평가 종료 전 blocker 확인'],
    }),
    makeOperationsMilestone({
      id: 'ai-competency-submission',
      name: 'AI 활용 평가 제출',
      plannedRangeLabel: '레벨업/승진 Pass/Fail 별도 운영',
      scheduleWindow: scheduleWindows.AI_EVIDENCE_SUBMISSION,
      ownerRole: 'EMPLOYEE',
      status: statusForBlockers(aiMissing, params.aiReadiness?.targetCount ? 'IN_PROGRESS' : 'BLOCKED'),
      readinessLink: 'AI_PASS_FAIL_READINESS',
      href: '/evaluation/ai-competency/admin',
      blockerCount: aiMissing,
      note: `AI 대상 ${params.aiReadiness?.targetCount ?? 0}명, 미제출/보완/검토 대기 ${aiMissing}건입니다.`,
      actionGuidance: ['AI 활용평가 대상자 배정', 'AI evidence 제출 현황 확인'],
    }),
    makeOperationsMilestone({
      id: 'second-360-review',
      name: '2차 다면평가',
      plannedRangeLabel: 'PPT 운영 일정 기준',
      scheduleWindow: scheduleWindows.SECOND_360_REVIEW,
      ownerRole: 'HR',
      status: feedbackRoundCount > 0 ? 'IN_PROGRESS' : 'NEEDS_REVIEW',
      readinessLink: 'PERFORMANCE_CALENDAR',
      href: '/evaluation/360/admin',
      blockerCount: feedbackRoundCount > 0 ? 0 : 1,
      note: `현재 연결된 다면평가 라운드 ${feedbackRoundCount}건입니다.`,
      actionGuidance: ['2차 다면평가 일정/대상 확인'],
    }),
    makeOperationsMilestone({
      id: 'leadership-diagnosis',
      name: '리더십 진단',
      plannedRangeLabel: '다면평가/조직평가 일정과 연계',
      scheduleWindow: scheduleWindows.LEADERSHIP_DIAGNOSIS,
      ownerRole: 'HR',
      status: 'NEEDS_REVIEW',
      readinessLink: 'PERFORMANCE_CALENDAR',
      href: '/solutions/leadership-diagnosis',
      blockerCount: 0,
      note: '리더십 진단은 별도 운영 일정과 대상자 확정이 필요합니다.',
      actionGuidance: ['리더십 진단 운영 일정 확정'],
    }),
    makeOperationsMilestone({
      id: 'ai-case-accumulation',
      name: 'AI 사례 준비 및 축적',
      plannedRangeLabel: '2026~2027 상시 축적',
      scheduleWindow: null,
      ownerRole: 'EMPLOYEE',
      status: aiMissing > 0 ? 'IN_PROGRESS' : 'DONE',
      readinessLink: 'AI_PASS_FAIL_READINESS',
      href: '/evaluation/ai-competency',
      blockerCount: aiMissing,
      note: 'AI 사례는 단순 사용이 아니라 실제 업무 개선/성과 창출 증빙 중심으로 축적합니다.',
      actionGuidance: ['AI 사례 증빙 준비', '정량 개선/전후 비교 기록'],
    }),
  ]

  const statusCounts = buildStatusCounts(milestones)
  const scheduleStatusCounts = buildScheduleStatusCounts(milestones)
  const activeWindows = Object.values(scheduleWindows)
    .filter((window) => window.status === 'ACTIVE')
    .map((window) => ({
      key: window.key,
      label: window.label,
      recommendedAction: window.recommendedAction,
      href: window.href,
    }))

  return {
    ...EMPTY_OPERATIONS_CHECKLIST,
    selectedCycleId: cycle?.id ?? null,
    selectedCycleName: cycle ? `${cycle.evalYear}년 · ${cycle.cycleName}` : null,
    selectedCycleIsOfficialReadinessTarget: cycle
      ? readPolicy2026OfficialReadinessEnabled(cycle.performanceDesignConfig)
      : false,
    summary: {
      totalMilestones: milestones.length,
      blockerCount: milestones.reduce((sum, milestone) => sum + milestone.blockerCount, 0),
      statusCounts,
      scheduleStatusCounts,
    },
    schedule: {
      referenceDate: getEvaluation2026KoreaDateKey(params.referenceDate),
      activeWindows,
    },
    nowActions: buildNowActions(milestones),
    milestones,
  }
}

export async function getPerformanceCalendarPageData(
  session: CalendarSession,
  params: CalendarParams = {},
  deps: CalendarDeps = buildDefaultDeps()
): Promise<PerformanceCalendarPageData> {
  const referenceDate = parseReferenceDate(params.today)

  if (session.user?.role !== 'ROLE_ADMIN') {
    return {
      state: 'permission-denied',
      message: '관리자만 성과 관리 일정을 확인할 수 있습니다.',
      month: parseMonthKey(params.month).key,
      monthLabel: formatMonthLabel(parseMonthKey(params.month).key),
      timezone: TIMEZONE,
      selectedTypes: params.types?.length ? params.types : Object.keys(FILTER_LABELS) as PerformanceCalendarEventType[],
      filters: [],
      summary: {
        totalCount: 0,
        monthStart: '',
        monthEnd: '',
      },
      events: [],
      alerts: [],
      operationsChecklist: EMPTY_OPERATIONS_CHECKLIST,
    }
  }

  const selectedMonth = parseMonthKey(params.month)
  const { start: monthStart, end: monthEnd } = buildMonthRange(selectedMonth.key)
  const alerts: PerformanceCalendarAlert[] = []

  try {
    const [evalCycles, feedbackRounds, aiCycles, employees] = await Promise.all([
      loadSection({
        title: '평가 주기 일정',
        description: '평가 주기 일정을 모두 불러오지 못해 일부 카드만 표시합니다.',
        alerts,
        fallback: [] as EvalCycleLite[],
        loader: () => deps.loadEvalCycles(selectedMonth.year),
      }),
      loadSection({
        title: '다면평가/서베이 일정',
        description: '다면평가 라운드를 불러오지 못해 서베이 일정 일부가 빠질 수 있습니다.',
        alerts,
        fallback: [] as FeedbackRoundLite[],
        loader: () => deps.loadFeedbackRounds(selectedMonth.year),
      }),
      loadSection({
        title: 'AI 활용능력 일정',
        description: 'AI 활용능력 운영 일정 일부를 불러오지 못했습니다.',
        alerts,
        fallback: [] as AiCompetencyCycleLite[],
        loader: () => deps.loadAiCompetencyCycles(selectedMonth.year),
      }),
      loadSection({
        title: '입사일 데이터',
        description: '입사일 데이터를 일부 불러오지 못했습니다.',
        alerts,
        fallback: [] as EmployeeLite[],
        loader: () => deps.loadEmployees(selectedMonth.month),
      }),
    ])

    const merged = buildEvents({
      monthStart,
      monthEnd,
      evalCycles,
      feedbackRounds,
      aiCycles,
      employees,
    })

    const selectedTypes =
      params.types?.filter((type): type is PerformanceCalendarEventType => type in FILTER_LABELS) ??
      (Object.keys(FILTER_LABELS) as PerformanceCalendarEventType[])

    const filteredEvents = merged.filter((event) => selectedTypes.includes(event.type))
    const operationsCycle = selectOperationsCycle({
      evalCycles,
      selectedYear: selectedMonth.year,
    })
    const [readiness, assignmentCoverage, aiReadiness] = operationsCycle
      ? await Promise.all([
          deps.loadReadinessPopulationDryRun
            ? loadSection({
                title: '2026 readiness dry-run',
                description: '2026 readiness 신호 일부를 불러오지 못해 운영 체크리스트가 부분 데이터로 표시됩니다.',
                alerts,
                fallback: null,
                loader: () => deps.loadReadinessPopulationDryRun?.(operationsCycle.id) ?? Promise.resolve(null),
              })
            : Promise.resolve(null),
          deps.loadAssignmentCoverage
            ? loadSection({
                title: '평가자 배정 현황',
                description: '평가자 배정 현황을 불러오지 못해 assignment milestone이 부분 데이터로 표시됩니다.',
                alerts,
                fallback: null,
                loader: () => deps.loadAssignmentCoverage?.(operationsCycle.id) ?? Promise.resolve(null),
              })
            : Promise.resolve(null),
          deps.loadAiCompetencyReadiness
            ? loadSection({
                title: 'AI 활용평가 readiness',
                description: 'AI 활용평가 readiness를 불러오지 못해 AI milestone이 부분 데이터로 표시됩니다.',
                alerts,
                fallback: null,
                loader: () => deps.loadAiCompetencyReadiness?.(operationsCycle.id) ?? Promise.resolve(null),
              })
            : Promise.resolve(null),
        ])
      : [null, null, null]
    const operationsChecklist = buildOperationsChecklist({
      selectedYear: selectedMonth.year,
      evalCycles,
      feedbackRounds,
      readiness,
      assignmentCoverage,
      aiReadiness,
      referenceDate,
    })

    return {
      state: filteredEvents.length ? 'ready' : 'empty',
      message: filteredEvents.length
        ? undefined
        : '선택한 월과 필터 조건에서 표시할 성과 운영 일정이 없습니다.',
      month: selectedMonth.key,
      monthLabel: formatMonthLabel(selectedMonth.key),
      timezone: TIMEZONE,
      selectedTypes,
      filters: (Object.keys(FILTER_LABELS) as PerformanceCalendarEventType[]).map((type) => ({
        type,
        label: FILTER_LABELS[type],
        count: merged.filter((event) => event.type === type).length,
      })),
      summary: {
        totalCount: filteredEvents.length,
        monthStart: formatDateLabel(monthStart),
        monthEnd: formatDateLabel(new Date(monthEnd.getTime() - 1)),
        nextUpcoming: filteredEvents[0]
          ? {
              title: filteredEvents[0].title,
              dateLabel: filteredEvents[0].allDay
                ? formatDateLabel(new Date(filteredEvents[0].startsAt))
                : formatDateTimeLabel(new Date(filteredEvents[0].startsAt)),
              href: filteredEvents[0].href,
            }
          : undefined,
      },
      events: filteredEvents,
      alerts,
      operationsChecklist,
    }
  } catch (error) {
    console.error('[performance-calendar] fatal loader error', error)
    return {
      state: 'error',
      message: '성과 관리 일정을 준비하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      month: selectedMonth.key,
      monthLabel: formatMonthLabel(selectedMonth.key),
      timezone: TIMEZONE,
      selectedTypes: params.types?.length ? params.types : Object.keys(FILTER_LABELS) as PerformanceCalendarEventType[],
      filters: [],
      summary: {
        totalCount: 0,
        monthStart: formatDateLabel(monthStart),
        monthEnd: formatDateLabel(new Date(monthEnd.getTime() - 1)),
      },
      events: [],
      alerts,
      operationsChecklist: EMPTY_OPERATIONS_CHECKLIST,
    }
  }
}
