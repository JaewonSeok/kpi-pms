import type { CheckInStatus, CheckInType, Prisma, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { canOperateCheckinRole, getManagedEmployees } from '@/server/checkin-access'

export type CheckinPageState = 'ready' | 'permission-denied' | 'error'
export type CheckinPeriod = 'week' | 'month' | 'custom'
export type CheckinScope = 'self' | 'team' | 'employee'

type AgendaItem = {
  topic: string
  notes?: string
}

type ActionItem = {
  action: string
  assignee: string
  dueDate?: string
  completed?: boolean
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
}

type KpiDiscussion = {
  kpiId: string
  progress?: string
  concern?: string
  support?: string
}

export type CheckinRecordViewModel = {
  id: string
  type: CheckInType
  scheduledAt: string
  actualAt?: string
  status: CheckInStatus
  owner: {
    id: string
    name: string
    department: string
    position: string
  }
  manager: {
    id: string
    name: string
  }
  agenda: AgendaItem[]
  ownerNotes?: string
  managerNotes?: string
  summary?: string
  duration?: number
  energyLevel?: number
  satisfactionLevel?: number
  blockerCount?: number
  nextCheckInDate?: string
  riskKpiCount: number
  actionItemCount: number
  overdueActionCount: number
  recentCheckinSummary?: string
  actionItems: ActionItem[]
  kpiDiscussed: KpiDiscussion[]
  canEdit: boolean
  canComplete: boolean
  canCancel: boolean
}

export type CheckinActionItemViewModel = {
  id: string
  title: string
  assignee: string
  dueDate?: string
  completed: boolean
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  checkinId: string
  checkinDate?: string
  ownerName: string
  ownerId: string
  sourceIndex: number
  overdue: boolean
}

export type CheckinHistoryViewModel = {
  id: string
  date: string
  ownerId: string
  ownerName: string
  summary: string
  keyTopics: string[]
  actionSummary?: string
  kpiDeltaSummary?: string
}

export type CheckinPreparationViewModel = {
  employeeId: string
  employeeName: string
  department: string
  kpis: Array<{
    id: string
    title: string
    achievementRate?: number
    status?: string
  }>
  monthlyRecords: Array<{
    month: string
    achievementRate?: number
    comment?: string
    obstacles?: string
  }>
  feedbacks: Array<{
    date: string
    author: string
    content: string
  }>
  carryOverActions: string[]
  suggestedTopics: string[]
  leaderPrepPoints: string[]
  memberPrepPoints: string[]
}

export type CheckinPageViewModel = {
  currentUserId: string
  currentUserName: string
  currentUserRole: SystemRole
  filters: {
    period: CheckinPeriod
    scope: CheckinScope
    startDate?: string
    endDate?: string
    rangeLabel: string
    employeeId?: string
  }
  permissions: {
    canOperate: boolean
    canManageTeam: boolean
  }
  teamMembers: Array<{
    id: string
    name: string
    department: string
    roleLabel: string
  }>
  focusEmployee?: {
    id: string
    name: string
    department: string
  }
  summary: {
    heroStatus?: CheckInStatus
    upcomingCount: number
    todayCount: number
    overdueActionCount: number
    incompleteCount: number
    riskyKpiLinkedCount: number
  }
  records: CheckinRecordViewModel[]
  actions: CheckinActionItemViewModel[]
  history: CheckinHistoryViewModel[]
  prepByEmployee: Record<string, CheckinPreparationViewModel>
}

export type CheckinPageData = {
  state: CheckinPageState
  message?: string
  viewModel?: CheckinPageViewModel
}

type CheckinPageParams = {
  userId: string
  role: SystemRole
  period?: string
  scope?: string
  employeeId?: string
  startDate?: string
  endDate?: string
}

function parseAgendaItems(value: unknown): AgendaItem[] {
  if (!Array.isArray(value)) return []
  const items: AgendaItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const topic = typeof record.topic === 'string' ? record.topic.trim() : ''
    if (!topic) continue
    items.push({
      topic,
      notes: typeof record.notes === 'string' ? record.notes.trim() : undefined,
    })
  }
  return items
}

function parseActionItems(value: unknown): ActionItem[] {
  if (!Array.isArray(value)) return []
  const items: ActionItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const action = typeof record.action === 'string' ? record.action.trim() : ''
    const assignee = typeof record.assignee === 'string' ? record.assignee.trim() : ''
    if (!action || !assignee) continue
    items.push({
      action,
      assignee,
      dueDate: typeof record.dueDate === 'string' ? record.dueDate : undefined,
      completed: Boolean(record.completed),
      priority:
        record.priority === 'LOW' || record.priority === 'MEDIUM' || record.priority === 'HIGH'
          ? record.priority
          : 'MEDIUM',
    })
  }
  return items
}

function parseKpiDiscussed(value: unknown): KpiDiscussion[] {
  if (!Array.isArray(value)) return []
  const items: KpiDiscussion[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const kpiId = typeof record.kpiId === 'string' ? record.kpiId : ''
    if (!kpiId) continue
    items.push({
      kpiId,
      progress: typeof record.progress === 'string' ? record.progress : undefined,
      concern: typeof record.concern === 'string' ? record.concern : undefined,
      support: typeof record.support === 'string' ? record.support : undefined,
    })
  }
  return items
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function startOfWeek(date: Date) {
  const next = startOfDay(date)
  const offset = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - offset)
  return next
}

function endOfWeek(date: Date) {
  return endOfDay(addDays(startOfWeek(date), 6))
}

function startOfMonth(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), 1)
  return startOfDay(next)
}

function endOfMonth(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return endOfDay(next)
}

function isValidDateInput(value?: string) {
  if (!value) return false
  return !Number.isNaN(new Date(value).getTime())
}

function resolveDateRange(period?: string, startDate?: string, endDate?: string) {
  const now = new Date()

  if (period === 'custom' && isValidDateInput(startDate) && isValidDateInput(endDate)) {
    const start = startOfDay(new Date(startDate!))
    const end = endOfDay(new Date(endDate!))
    if (start.getTime() <= end.getTime()) {
      return {
        period: 'custom' as const,
        start,
        end,
        label: `${start.toLocaleDateString('ko-KR')} - ${end.toLocaleDateString('ko-KR')}`,
      }
    }
  }

  if (period === 'month') {
    const start = startOfMonth(now)
    const end = endOfMonth(now)
    return {
      period: 'month' as const,
      start,
      end,
      label: `${start.getFullYear()}년 ${start.getMonth() + 1}월`,
    }
  }

  const start = startOfWeek(now)
  const end = endOfWeek(now)
  return {
    period: 'week' as const,
    start,
    end,
    label: `${start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`,
  }
}

function getRoleLabel(role: SystemRole) {
  const labels: Record<SystemRole, string> = {
    ROLE_MEMBER: '구성원',
    ROLE_TEAM_LEADER: '팀장',
    ROLE_SECTION_CHIEF: '부서장',
    ROLE_DIV_HEAD: '본부장',
    ROLE_CEO: 'CEO',
    ROLE_ADMIN: '관리자',
  }
  return labels[role]
}

function formatMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value
  const [year, month] = value.split('-')
  return `${year}.${month}`
}

function isOverdue(dateString?: string, completed?: boolean) {
  if (!dateString || completed) return false
  const dueDate = endOfDay(new Date(dateString))
  return dueDate.getTime() < Date.now()
}

function summarizeActionItems(actionItems: CheckinActionItemViewModel[]) {
  if (!actionItems.length) return '실행 항목 없음'
  const completed = actionItems.filter((item) => item.completed).length
  return `${completed}/${actionItems.length}건 완료`
}

function buildSuggestedTopics(input: {
  lowKpis: string[]
  obstacles: string[]
  overdueActions: string[]
  recentFeedbacks: string[]
}) {
  const topics = new Set<string>()

  if (input.lowKpis.length) {
    topics.add(`달성률이 낮은 KPI(${input.lowKpis.slice(0, 2).join(', ')})의 지원 방안을 점검하세요.`)
  }
  if (input.obstacles.length) {
    topics.add(`최근 장애 요인(${input.obstacles[0]})에 대한 해결 계획을 확인하세요.`)
  }
  if (input.overdueActions.length) {
    topics.add(`미완료 액션아이템(${input.overdueActions[0]})의 due date와 지원 필요 여부를 확인하세요.`)
  }
  if (input.recentFeedbacks.length) {
    topics.add(`최근 피드백에서 언급된 주제(${input.recentFeedbacks[0]})를 다시 확인하세요.`)
  }

  if (!topics.size) {
    topics.add('이번 주 목표 진행 상황과 우선순위 재정렬 여부를 점검하세요.')
    topics.add('현재 업무 에너지와 협업 이슈를 가볍게 확인하세요.')
  }

  return Array.from(topics).slice(0, 3)
}

export async function getCheckinPageData(params: CheckinPageParams): Promise<CheckinPageData> {
  try {
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
        message: '체크인 화면을 사용할 직원 정보를 찾을 수 없습니다.',
      }
    }

    const canOperate = canOperateCheckinRole(params.role)
    const managedEmployees = await getManagedEmployees(params.userId, params.role)
    const canManageTeam = managedEmployees.length > 0 || canOperate

    const range = resolveDateRange(params.period, params.startDate, params.endDate)
    const requestedScope = params.scope === 'employee' || params.scope === 'team' || params.scope === 'self' ? params.scope : undefined

    let scope: CheckinScope = 'self'
    if (canManageTeam) {
      scope = requestedScope === 'employee' || requestedScope === 'team' ? requestedScope : 'team'
    }

    const validEmployeeId =
      params.employeeId && managedEmployees.some((member) => member.id === params.employeeId)
        ? params.employeeId
        : undefined

    if (scope === 'employee' && !validEmployeeId) {
      scope = canManageTeam ? 'team' : 'self'
    }

    const focusEmployeeId =
      scope === 'employee'
        ? validEmployeeId
        : scope === 'self'
          ? params.userId
          : managedEmployees[0]?.id ?? params.userId

    const rangeStart = range.start
    const rangeEnd = range.end
    const historyStart = addDays(rangeStart, -120)
    const futureEnd = addDays(rangeEnd, 45)

    let whereClause: Prisma.CheckInWhereInput
    if (scope === 'employee' && focusEmployeeId) {
      whereClause = {
        ownerId: focusEmployeeId,
        scheduledDate: {
          gte: historyStart,
          lte: futureEnd,
        },
      }
    } else if (scope === 'team') {
      const ownerIds = managedEmployees.map((member) => member.id)
      whereClause = {
        ownerId: {
          in: ownerIds.length ? ownerIds : [params.userId],
        },
        scheduledDate: {
          gte: historyStart,
          lte: futureEnd,
        },
      }
    } else {
      whereClause = {
        OR: [{ ownerId: params.userId }, { managerId: params.userId }],
        scheduledDate: {
          gte: historyStart,
          lte: futureEnd,
        },
      }
    }

    const rawCheckins = await prisma.checkIn.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            empName: true,
            position: true,
            department: { select: { deptName: true } },
          },
        },
        manager: {
          select: {
            id: true,
            empName: true,
          },
        },
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    })

    const relevantEmployeeIds = Array.from(
      new Set(
        [focusEmployeeId, ...rawCheckins.map((item) => item.ownerId)]
          .filter((value): value is string => Boolean(value))
          .slice(0, 50)
      )
    )

    const relatedEmployees = await prisma.employee.findMany({
      where: { id: { in: relevantEmployeeIds } },
      include: {
        department: true,
      },
    })
    const employeeMap = new Map(relatedEmployees.map((item) => [item.id, item]))

    const personalKpis = relevantEmployeeIds.length
      ? await prisma.personalKpi.findMany({
          where: {
            employeeId: { in: relevantEmployeeIds },
            evalYear: rangeEnd.getFullYear(),
          },
          orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
        })
      : []

    const monthlyRecords = relevantEmployeeIds.length
      ? await prisma.monthlyRecord.findMany({
          where: {
            employeeId: { in: relevantEmployeeIds },
          },
          include: {
            personalKpi: {
              select: {
                kpiName: true,
              },
            },
          },
          orderBy: [{ yearMonth: 'desc' }, { updatedAt: 'desc' }],
        })
      : []

    const feedbacks = relevantEmployeeIds.length
      ? await prisma.multiFeedback.findMany({
          where: {
            receiverId: { in: relevantEmployeeIds },
            status: 'SUBMITTED',
          },
          include: {
            giver: { select: { empName: true } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 100,
        })
      : []

    const latestCompletedByOwner = new Map<string, typeof rawCheckins[number]>()
    for (const checkin of [...rawCheckins].sort((a, b) => {
      const aTime = new Date(a.actualDate ?? a.scheduledDate).getTime()
      const bTime = new Date(b.actualDate ?? b.scheduledDate).getTime()
      return bTime - aTime
    })) {
      if (checkin.status !== 'COMPLETED') continue
      if (!latestCompletedByOwner.has(checkin.ownerId)) {
        latestCompletedByOwner.set(checkin.ownerId, checkin)
      }
    }

    const lowRiskMap = new Map<string, number>()
    const monthlyByEmployee = new Map<string, typeof monthlyRecords>()
    for (const record of monthlyRecords) {
      const bucket = monthlyByEmployee.get(record.employeeId) ?? []
      bucket.push(record)
      monthlyByEmployee.set(record.employeeId, bucket)
    }

    for (const employeeId of relevantEmployeeIds) {
      const records = monthlyByEmployee.get(employeeId) ?? []
      const riskyCount = records.filter((record) => {
        return (
          (typeof record.achievementRate === 'number' && record.achievementRate < 80) ||
          Boolean(record.obstacles?.trim())
        )
      }).length
      lowRiskMap.set(employeeId, riskyCount)
    }

    const currentRecords = rawCheckins.filter((checkin) => {
      const time = new Date(checkin.scheduledDate).getTime()
      return time >= rangeStart.getTime() && time <= rangeEnd.getTime()
    })

    const records: CheckinRecordViewModel[] = currentRecords.map((checkin) => {
      const actionItems = parseActionItems(checkin.actionItems)
      const overdueActionCount = actionItems.filter((item) => isOverdue(item.dueDate, item.completed)).length
      const recentCompleted = latestCompletedByOwner.get(checkin.ownerId)
      const canEditParticipant = checkin.ownerId === params.userId || canOperate

      return {
        id: checkin.id,
        type: checkin.checkInType,
        scheduledAt: checkin.scheduledDate.toISOString(),
        actualAt: checkin.actualDate?.toISOString(),
        status: checkin.status,
        owner: {
          id: checkin.owner.id,
          name: checkin.owner.empName,
          department: checkin.owner.department.deptName,
          position: checkin.owner.position,
        },
        manager: {
          id: checkin.manager.id,
          name: checkin.manager.empName,
        },
        agenda: parseAgendaItems(checkin.agendaItems),
        ownerNotes: checkin.ownerNotes ?? undefined,
        managerNotes: checkin.managerNotes ?? undefined,
        summary: checkin.keyTakeaways ?? undefined,
        duration: checkin.duration ?? undefined,
        energyLevel: checkin.energyLevel ?? undefined,
        satisfactionLevel: checkin.satisfactionLevel ?? undefined,
        blockerCount: checkin.blockerCount ?? undefined,
        nextCheckInDate: checkin.nextCheckInDate?.toISOString(),
        riskKpiCount: lowRiskMap.get(checkin.ownerId) ?? 0,
        actionItemCount: actionItems.length,
        overdueActionCount,
        recentCheckinSummary:
          recentCompleted && recentCompleted.id !== checkin.id
            ? recentCompleted.keyTakeaways ?? undefined
            : undefined,
        actionItems,
        kpiDiscussed: parseKpiDiscussed(checkin.kpiDiscussed),
        canEdit:
          canEditParticipant && !['COMPLETED', 'CANCELLED'].includes(checkin.status),
        canComplete:
          canOperate && !['COMPLETED', 'CANCELLED'].includes(checkin.status),
        canCancel:
          canEditParticipant && !['COMPLETED', 'CANCELLED'].includes(checkin.status),
      }
    })

    const actions: CheckinActionItemViewModel[] = rawCheckins.flatMap((checkin) => {
      const ownerName = checkin.owner.empName
      return parseActionItems(checkin.actionItems).map((action, index) => ({
        id: `${checkin.id}-${index}`,
        title: action.action,
        assignee: action.assignee,
        dueDate: action.dueDate,
        completed: Boolean(action.completed),
        priority: action.priority ?? 'MEDIUM',
        checkinId: checkin.id,
        checkinDate: checkin.actualDate?.toISOString() ?? checkin.scheduledDate.toISOString(),
        ownerName,
        ownerId: checkin.ownerId,
        sourceIndex: index,
        overdue: isOverdue(action.dueDate, action.completed),
      }))
    })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
        return new Date(a.dueDate ?? a.checkinDate ?? 0).getTime() - new Date(b.dueDate ?? b.checkinDate ?? 0).getTime()
      })

    const history: CheckinHistoryViewModel[] = rawCheckins
      .filter((checkin) => checkin.status === 'COMPLETED')
      .sort((a, b) => new Date(b.actualDate ?? b.scheduledDate).getTime() - new Date(a.actualDate ?? a.scheduledDate).getTime())
      .map((checkin) => {
        const actionItems = parseActionItems(checkin.actionItems)
        const kpiNotes = parseKpiDiscussed(checkin.kpiDiscussed)
        return {
          id: checkin.id,
          date: (checkin.actualDate ?? checkin.scheduledDate).toISOString(),
          ownerId: checkin.ownerId,
          ownerName: checkin.owner.empName,
          summary: checkin.keyTakeaways ?? '체크인 요약이 아직 작성되지 않았습니다.',
          keyTopics: parseAgendaItems(checkin.agendaItems)
            .map((item) => item.topic)
            .slice(0, 3),
          actionSummary: summarizeActionItems(
            actionItems.map((item, index) => ({
              id: `${checkin.id}-${index}`,
              title: item.action,
              assignee: item.assignee,
              dueDate: item.dueDate,
              completed: Boolean(item.completed),
              priority: item.priority ?? 'MEDIUM',
              checkinId: checkin.id,
              ownerName: checkin.owner.empName,
              ownerId: checkin.ownerId,
              sourceIndex: index,
              overdue: isOverdue(item.dueDate, item.completed),
            }))
          ),
          kpiDeltaSummary: kpiNotes.length
            ? `${kpiNotes.length}개 KPI 논의 기록`
            : lowRiskMap.get(checkin.ownerId)
              ? `위험 KPI ${lowRiskMap.get(checkin.ownerId)}건`
              : 'KPI 위험 신호 없음',
        }
      })
      .slice(0, 20)

    const feedbackByEmployee = new Map<string, typeof feedbacks>()
    for (const feedback of feedbacks) {
      const bucket = feedbackByEmployee.get(feedback.receiverId) ?? []
      bucket.push(feedback)
      feedbackByEmployee.set(feedback.receiverId, bucket)
    }

    const prepByEmployee = Object.fromEntries(
      relevantEmployeeIds.map((employeeId) => {
        const employeeDetail = employeeMap.get(employeeId)
        const employeeKpis = personalKpis.filter((item) => item.employeeId === employeeId).slice(0, 5)
        const employeeMonthlyRecords = (monthlyByEmployee.get(employeeId) ?? []).slice(0, 4)
        const employeeFeedbacks = (feedbackByEmployee.get(employeeId) ?? []).slice(0, 3)
        const employeeActions = actions.filter((item) => item.ownerId === employeeId && !item.completed).slice(0, 5)
        const lowKpis = employeeMonthlyRecords
          .filter((record) => typeof record.achievementRate === 'number' && record.achievementRate < 80)
          .map((record) => record.personalKpi.kpiName)
        const obstacles = employeeMonthlyRecords
          .map((record) => record.obstacles?.trim())
          .filter((value): value is string => Boolean(value))
        const overdueActions = employeeActions.filter((item) => item.overdue).map((item) => item.title)
        const recentFeedbackTopics = employeeFeedbacks.map((item) => item.overallComment?.trim()).filter((value): value is string => Boolean(value))

        const suggestedTopics = buildSuggestedTopics({
          lowKpis,
          obstacles,
          overdueActions,
          recentFeedbacks: recentFeedbackTopics,
        })

        const prep: CheckinPreparationViewModel = {
          employeeId,
          employeeName: employeeDetail?.empName ?? '대상자',
          department: employeeDetail?.department.deptName ?? '부서 정보 없음',
          kpis: employeeKpis.map((item) => {
            const latestRecord = employeeMonthlyRecords.find((record) => record.personalKpiId === item.id)
            return {
              id: item.id,
              title: item.kpiName,
              achievementRate: latestRecord?.achievementRate ?? undefined,
              status: item.status,
            }
          }),
          monthlyRecords: employeeMonthlyRecords.map((record) => ({
            month: formatMonth(record.yearMonth),
            achievementRate: record.achievementRate ?? undefined,
            comment: record.activities ?? record.efforts ?? undefined,
            obstacles: record.obstacles ?? undefined,
          })),
          feedbacks: employeeFeedbacks.map((feedback) => ({
            date: (feedback.submittedAt ?? feedback.createdAt).toISOString(),
            author: feedback.giver.empName,
            content: feedback.overallComment ?? '최근 피드백 코멘트가 없습니다.',
          })),
          carryOverActions: employeeActions.map((item) => item.title),
          suggestedTopics,
          leaderPrepPoints: [
            overdueActions.length
              ? `미완료 액션 ${overdueActions.length}건의 원인과 지원 여부를 확인하세요.`
              : '최근 액션아이템의 완료 상태를 짧게 점검하세요.',
            lowKpis.length
              ? `달성률이 낮은 KPI(${lowKpis.slice(0, 2).join(', ')})의 지원 방안을 준비하세요.`
              : '현재 목표의 우선순위와 다음 주 리스크를 확인하세요.',
          ],
          memberPrepPoints: [
            '최근 성과와 막힌 이슈를 한 문장으로 정리해 두세요.',
            employeeActions.length
              ? `지난 체크인 액션 중 아직 끝나지 않은 항목 ${employeeActions.length}건을 먼저 점검하세요.`
              : '지난 체크인에서 약속한 후속 조치가 있었는지 다시 확인하세요.',
          ],
        }

        if (!prep.kpis.length && !prep.monthlyRecords.length && !prep.feedbacks.length) {
          prep.suggestedTopics = [
            '현재 업무 우선순위와 가장 필요한 지원을 공유하세요.',
            '최근 일주일의 에너지 수준과 협업 상황을 짧게 정리하세요.',
          ]
        }

        return [employeeId, prep]
      })
    ) as Record<string, CheckinPreparationViewModel>

    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())
    const upcomingItems = records.filter((item) => ['SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS'].includes(item.status))
    const heroStatus =
      records.find((item) => item.status === 'IN_PROGRESS')?.status ??
      upcomingItems[0]?.status ??
      (history.length ? 'COMPLETED' : undefined)

    const viewModel: CheckinPageViewModel = {
      currentUserId: params.userId,
      currentUserName: employee.empName,
      currentUserRole: params.role,
      filters: {
        period: range.period,
        scope,
        startDate: range.period === 'custom' ? range.start.toISOString().slice(0, 10) : undefined,
        endDate: range.period === 'custom' ? range.end.toISOString().slice(0, 10) : undefined,
        rangeLabel: range.label,
        employeeId: scope === 'employee' ? focusEmployeeId : undefined,
      },
      permissions: {
        canOperate,
        canManageTeam,
      },
      teamMembers: managedEmployees.map((member) => ({
        id: member.id,
        name: member.empName,
        department: member.department.deptName,
        roleLabel: getRoleLabel(member.role),
      })),
      focusEmployee: focusEmployeeId
        ? {
            id: focusEmployeeId,
            name: employeeMap.get(focusEmployeeId)?.empName ?? employee.empName,
            department: employeeMap.get(focusEmployeeId)?.department.deptName ?? employee.department.deptName,
          }
        : undefined,
      summary: {
        heroStatus: heroStatus as CheckInStatus | undefined,
        upcomingCount: upcomingItems.length,
        todayCount: records.filter((item) => {
          const time = new Date(item.scheduledAt).getTime()
          return time >= todayStart.getTime() && time <= todayEnd.getTime()
        }).length,
        overdueActionCount: actions.filter((item) => item.overdue && !item.completed).length,
        incompleteCount: records.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status)).length,
        riskyKpiLinkedCount: records.filter((item) => item.riskKpiCount > 0).length,
      },
      records,
      actions,
      history,
      prepByEmployee,
    }

    return {
      state: 'ready',
      viewModel,
    }
  } catch (error) {
    console.error('Failed to build checkin page data:', error)
    return {
      state: 'error',
      message: '체크인 화면 데이터를 불러오지 못했습니다.',
    }
  }
}
