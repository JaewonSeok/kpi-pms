import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { buildOperationsSummary } from '@/lib/operations'
import { getCurrentYear } from '@/lib/utils'

export type DashboardTone = 'success' | 'warn' | 'error' | 'neutral'

export type DashboardPageData = {
  role: string
  userName: string
  year: number
  title: string
  description: string
  statusLabel: string
  statusTone: DashboardTone
  summary: Array<{
    label: string
    value: string
    description: string
    tone: DashboardTone
    href?: string
  }>
  actions: Array<{
    label: string
    description: string
    href: string
  }>
  trend: Array<{
    yearMonth: string
    achievementRate: number
    kpiName: string
  }>
  focusItems: Array<{
    title: string
    description: string
    badge?: string
    href?: string
    tone: DashboardTone
  }>
  reviewQueue: Array<{
    title: string
    description: string
    badge?: string
    href?: string
  }>
  checkins: Array<{
    title: string
    description: string
    badge?: string
    href?: string
  }>
  notifications: Array<{
    title: string
    description: string
    href?: string
  }>
  risks: Array<{
    title: string
    description: string
    badge?: string
    href?: string
    tone: DashboardTone
  }>
  alerts: Array<{
    title: string
    description: string
    tone: DashboardTone
  }>
}

type DashboardSessionUser = NonNullable<Session['user']> & {
  id: string
  name: string
  role: string
  deptId: string
  accessibleDepartmentIds?: string[] | null
}

function toTone(count: number, warnThreshold = 1, errorThreshold = 5): DashboardTone {
  if (count >= errorThreshold) return 'error'
  if (count >= warnThreshold) return 'warn'
  return 'success'
}

function averageTrend(records: Array<{ yearMonth: string; achievementRate: number | null }>) {
  const grouped = new Map<string, number[]>()
  for (const record of records) {
    if (typeof record.achievementRate !== 'number') continue
    const existing = grouped.get(record.yearMonth) ?? []
    existing.push(record.achievementRate)
    grouped.set(record.yearMonth, existing)
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([yearMonth, values]) => ({
      yearMonth,
      achievementRate: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
      kpiName: '평균 달성률',
    }))
}

function normalizeAccessibleDepartmentIds(accessibleDepartmentIds?: string[] | null) {
  if (!Array.isArray(accessibleDepartmentIds)) return []
  return accessibleDepartmentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function resolveDashboardScopeDepartmentIds(sessionUser: DashboardSessionUser) {
  if (sessionUser.role === 'ROLE_MEMBER') {
    return sessionUser.deptId ? [sessionUser.deptId] : []
  }

  const accessibleDepartmentIds = normalizeAccessibleDepartmentIds(sessionUser.accessibleDepartmentIds)
  if (accessibleDepartmentIds.length) {
    return accessibleDepartmentIds
  }

  return sessionUser.deptId ? [sessionUser.deptId] : []
}

async function loadDashboardSection<T>(params: {
  key: string
  title: string
  description: string
  fallback: T
  alerts: DashboardPageData['alerts']
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    console.error(`Failed to load dashboard section: ${params.key}`, error)
    params.alerts.push({
      title: params.title,
      description: params.description,
      tone: 'warn',
    })
    return params.fallback
  }
}

function buildMissingEmployeeDashboard(
  sessionUser: DashboardSessionUser,
  year: number,
  alerts: DashboardPageData['alerts']
): DashboardPageData {
  return {
    role: sessionUser.role,
    userName: sessionUser.name,
    year,
    title: '대시보드',
    description: '직원 정보를 찾을 수 없어 기본 요약만 표시합니다.',
    statusLabel: '주의',
    statusTone: 'warn',
    summary: [],
    actions: [],
    trend: [],
    focusItems: [],
    reviewQueue: [],
    checkins: [],
    notifications: [],
    risks: [],
    alerts,
  }
}

export async function getDashboardPageData(session: Session): Promise<DashboardPageData> {
  const year = getCurrentYear()
  const alerts: DashboardPageData['alerts'] = []
  const sessionUser = session.user as DashboardSessionUser

  const employee = await loadDashboardSection({
    key: 'employee-profile',
    title: '기본 프로필 로딩 지연',
    description: '직원 정보를 불러오지 못해 일부 대시보드 항목을 생략했습니다.',
    fallback: null,
    alerts,
    loader: () =>
      prisma.employee.findUnique({
        where: { id: sessionUser.id },
        include: {
          department: true,
        },
      }),
  })

  if (!employee) {
    return buildMissingEmployeeDashboard(sessionUser, year, alerts)
  }

  const [unreadNotifications, myKpis, upcomingMine, reviewQueue] = await Promise.all([
    loadDashboardSection({
      key: 'notifications',
      title: '알림 위젯 일부 생략',
      description: '알림 데이터를 불러오지 못해 받은 알림 목록을 잠시 숨겼습니다.',
      fallback: [],
      alerts,
      loader: () =>
        prisma.notification.findMany({
          where: { recipientId: sessionUser.id, isRead: false },
          orderBy: { sentAt: 'desc' },
          take: 5,
        }),
    }),
    loadDashboardSection({
      key: 'personal-kpis',
      title: '개인 KPI 요약 일부 생략',
      description: '개인 KPI 데이터를 불러오지 못해 성과 추이와 KPI 요약을 기본값으로 표시합니다.',
      fallback: [],
      alerts,
      loader: () =>
        prisma.personalKpi.findMany({
          where: {
            employeeId: sessionUser.id,
            evalYear: year,
          },
          include: {
            monthlyRecords: {
              orderBy: { yearMonth: 'asc' },
            },
            linkedOrgKpi: {
              select: {
                kpiName: true,
              },
            },
          },
        }),
    }),
    loadDashboardSection({
      key: 'my-checkins',
      title: '체크인 일정 일부 생략',
      description: '체크인 일정을 불러오지 못해 일정 카드 일부를 숨겼습니다.',
      fallback: [],
      alerts,
      loader: () =>
        prisma.checkIn.findMany({
          where: {
            OR: [{ ownerId: sessionUser.id }, { managerId: sessionUser.id }],
            status: { in: ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'] },
          },
          include: {
            owner: { select: { empName: true } },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 5,
        }),
    }),
    loadDashboardSection({
      key: 'review-queue',
      title: '평가 대기열 일부 생략',
      description: '평가 대기열을 불러오지 못해 검토 카드 일부를 숨겼습니다.',
      fallback: [],
      alerts,
      loader: () =>
        prisma.evaluation.findMany({
          where: {
            evaluatorId: sessionUser.id,
            status: { in: ['PENDING', 'IN_PROGRESS', 'REJECTED'] },
          },
          include: {
            target: {
              select: {
                empName: true,
                department: { select: { deptName: true } },
              },
            },
            evalCycle: { select: { cycleName: true, evalYear: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 6,
        }),
    }),
  ])

  const myTrend = averageTrend(
    myKpis.flatMap((kpi) =>
      kpi.monthlyRecords.map((record) => ({
        yearMonth: record.yearMonth,
        achievementRate: record.achievementRate,
      }))
    )
  )

  const accessibleDepartmentIds = resolveDashboardScopeDepartmentIds(sessionUser)
  const teamMembers = accessibleDepartmentIds.length
    ? await loadDashboardSection({
        key: 'team-members',
        title: '팀 현황 일부 생략',
        description: '조직 범위 데이터를 불러오지 못해 팀 현황 카드 일부를 숨겼습니다.',
        fallback: [],
        alerts,
        loader: () =>
          prisma.employee.findMany({
            where: {
              deptId: { in: accessibleDepartmentIds },
              status: 'ACTIVE',
              id: { not: sessionUser.id },
            },
            select: {
              id: true,
              empName: true,
              department: { select: { deptName: true } },
            },
            take: 30,
          }),
      })
    : []

  const teamMemberIds = teamMembers.map((item) => item.id)

  const [teamRiskyMonthly, teamUpcomingCheckins, opsSummary] = await Promise.all([
    teamMemberIds.length
      ? loadDashboardSection({
          key: 'team-risk',
          title: '팀 리스크 일부 생략',
          description: '팀 월간 실적 리스크를 집계하지 못해 기본값으로 표시합니다.',
          fallback: 0,
          alerts,
          loader: () =>
            prisma.monthlyRecord.count({
              where: {
                employeeId: { in: teamMemberIds },
                achievementRate: { lt: 80 },
              },
            }),
        })
      : Promise.resolve(0),
    loadDashboardSection({
      key: 'team-checkins',
      title: '팀 체크인 일부 생략',
      description: '팀 체크인 일정을 불러오지 못해 기본 카드만 표시합니다.',
      fallback: [],
      alerts,
      loader: () =>
        prisma.checkIn.findMany({
          where: {
            managerId: sessionUser.id,
            status: { in: ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'] },
          },
          include: {
            owner: { select: { empName: true } },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 6,
        }),
    }),
    sessionUser.role === 'ROLE_ADMIN' || sessionUser.role === 'ROLE_CEO'
      ? loadDashboardSection({
          key: 'operations-summary',
          title: '운영 요약 일부 생략',
          description: '운영 지표를 불러오지 못해 관리자 카드 일부를 기본값으로 표시합니다.',
          fallback: null,
          alerts,
          loader: () => buildOperationsSummary(),
        })
      : Promise.resolve(null),
  ])

  const hasDegradedSections = alerts.length > 0

  if (sessionUser.role === 'ROLE_ADMIN' || sessionUser.role === 'ROLE_CEO') {
    const title = sessionUser.role === 'ROLE_CEO' ? '경영 대시보드' : '운영 대시보드'
    const description =
      sessionUser.role === 'ROLE_CEO'
        ? '성과, 보정, 보상, 운영 리스크를 한 화면에서 빠르게 확인합니다.'
        : '운영 이상 징후와 후속 조치가 필요한 영역을 빠르게 확인합니다.'

    return {
      role: sessionUser.role,
      userName: sessionUser.name,
      year,
      title,
      description,
      statusLabel: hasDegradedSections ? '주의' : opsSummary?.status.label ?? '정상',
      statusTone: hasDegradedSections
        ? 'warn'
        : opsSummary?.status.tone === 'error'
          ? 'error'
          : opsSummary?.status.tone === 'warn'
            ? 'warn'
            : 'success',
      summary: [
        {
          label: '실패 작업 24h',
          value: String(opsSummary?.metrics.failedJobs24h ?? 0),
          description: '실패 또는 부분 실패 배치',
          tone: toTone(opsSummary?.metrics.failedJobs24h ?? 0, 1, 3),
          href: '/admin/ops',
        },
        {
          label: 'Dead Letter',
          value: String(opsSummary?.metrics.notificationDeadLetters ?? 0),
          description: '처리가 필요한 알림 실패',
          tone: toTone(opsSummary?.metrics.notificationDeadLetters ?? 0, 1, 1),
          href: '/admin/notifications',
        },
        {
          label: '예산 초과 시나리오',
          value: String(opsSummary?.metrics.overBudgetScenarios ?? 0),
          description: '보상 시뮬레이션 초과 건',
          tone: toTone(opsSummary?.metrics.overBudgetScenarios ?? 0, 1, 1),
          href: '/compensation/manage',
        },
        {
          label: '진행 중 평가 주기',
          value: String(opsSummary?.metrics.activeEvalCycles ?? 0),
          description: '현재 종료되지 않은 주기',
          tone: toTone(opsSummary?.metrics.delayedEvalCycles ?? 0, 1, 2),
          href: '/admin/eval-cycle',
        },
      ],
      actions: [
        { label: '운영 관제 보기', description: '시스템 상태와 이벤트 로그 확인', href: '/admin/ops' },
        { label: '알림 운영', description: 'dead letter와 재처리 현황 확인', href: '/admin/notifications' },
        { label: 'Google 계정 등록', description: '로그인 계정 매핑과 허용 상태 관리', href: '/admin/google-access' },
        { label: '보상 시뮬레이션', description: '예산 초과와 승인 상태 확인', href: '/compensation/manage' },
      ],
      trend: myTrend,
      focusItems: [
        {
          title: '로그인 준비 미완료 계정',
          description: `${opsSummary?.metrics.loginUnavailableAccounts ?? 0}건의 계정에 로그인 준비 이슈가 있습니다.`,
          badge: 'Google access',
          href: '/admin/google-access',
          tone: toTone(opsSummary?.metrics.loginUnavailableAccounts ?? 0, 1, 1),
        },
        {
          title: '미검토 월간 실적',
          description: `${opsSummary?.metrics.unreviewedMonthlyRecords ?? 0}건이 검토 대기 중입니다.`,
          badge: 'Monthly review',
          href: '/kpi/monthly',
          tone: toTone(opsSummary?.metrics.unreviewedMonthlyRecords ?? 0, 1, 5),
        },
        {
          title: '보정 미완료 평가',
          description: `${opsSummary?.metrics.unresolvedCalibrationCount ?? 0}개 주기가 보정 단계에 머물러 있습니다.`,
          badge: 'Calibration',
          href: '/evaluation/ceo-adjust',
          tone: toTone(opsSummary?.metrics.unresolvedCalibrationCount ?? 0, 1, 1),
        },
      ],
      reviewQueue: reviewQueue.map((item) => ({
        title: `${item.target.empName} · ${item.evalCycle.cycleName}`,
        description: `${item.target.department?.deptName ?? '부서 미지정'} / ${item.evalStage} / ${item.status}`,
        badge: item.status,
        href: `/evaluation/workbench?cycleId=${encodeURIComponent(item.evalCycleId)}&evaluationId=${encodeURIComponent(item.id)}`,
      })),
      checkins: teamUpcomingCheckins.map((item) => ({
        title: `${item.owner?.empName ?? '담당자'} 체크인`,
        description: `${item.scheduledDate.toLocaleString('ko-KR')} / ${item.status}`,
        badge: item.checkInType,
        href: '/checkin',
      })),
      notifications: unreadNotifications.map((item) => ({
        title: item.title,
        description: item.message,
        href: item.link || '/notifications',
      })),
      risks: (opsSummary?.risks ?? []).slice(0, 6).map((risk) => ({
        title: risk.label,
        description: risk.description,
        badge: `${risk.count}건`,
        href: risk.relatedUrl,
        tone: risk.severity === 'HIGH' ? 'error' : risk.severity === 'MEDIUM' ? 'warn' : 'neutral',
      })),
      alerts,
    }
  }

  const memberAverage =
    myTrend.length > 0
      ? Math.round((myTrend.reduce((sum, item) => sum + item.achievementRate, 0) / myTrend.length) * 10) / 10
      : 0

  const title = sessionUser.role === 'ROLE_MEMBER' ? '나의 성과 대시보드' : '팀 운영과 개인 성과 대시보드'
  const description =
    sessionUser.role === 'ROLE_MEMBER'
      ? '이번 해 목표, 체크인, 평가 준비에 바로 이어지는 정보를 모아 보여줍니다.'
      : '팀 목표와 검토, 체크인 리스크를 한 번에 확인합니다.'

  return {
    role: sessionUser.role,
    userName: sessionUser.name,
    year,
    title,
    description,
    statusLabel: hasDegradedSections || reviewQueue.length > 0 || teamRiskyMonthly > 0 ? '주의' : '정상',
    statusTone: hasDegradedSections || reviewQueue.length > 0 || teamRiskyMonthly > 0 ? 'warn' : 'success',
    summary: [
      {
        label: '평균 달성률',
        value: `${memberAverage}%`,
        description: '최근 6개월 기준 평균',
        tone: memberAverage >= 90 ? 'success' : memberAverage >= 75 ? 'warn' : 'error',
        href: '/kpi/monthly',
      },
      {
        label: '확정 KPI',
        value: String(myKpis.filter((item) => item.status === 'CONFIRMED').length),
        description: '현재 연도 개인 KPI',
        tone: myKpis.length > 0 ? 'success' : 'warn',
        href: '/kpi/personal',
      },
      {
        label: '검토 대기 평가',
        value: String(reviewQueue.length),
        description: '내가 검토하거나 작성 중인 평가',
        tone: toTone(reviewQueue.length, 1, 4),
        href: '/evaluation/workbench',
      },
      {
        label: '예정 체크인',
        value: String(upcomingMine.length + teamUpcomingCheckins.length),
        description: '다가오는 체크인 일정',
        tone: 'neutral',
        href: '/checkin',
      },
    ],
    actions: [
      { label: '개인 KPI 관리', description: '가중치와 조직 KPI 연결 상태 확인', href: '/kpi/personal' },
      { label: '월간 실적 입력', description: '이번 달 실적과 증빙 업데이트', href: '/kpi/monthly' },
      { label: '평가 진행', description: '자기평가 또는 팀 평가 작성', href: '/evaluation/workbench' },
      { label: '체크인 일정', description: '이번 주 1:1 일정과 후속 액션 확인', href: '/checkin' },
    ],
    trend: myTrend,
    focusItems: [
      {
        title: '개인 KPI 정렬 상태',
        description: `${myKpis.filter((item) => item.linkedOrgKpiId).length}/${myKpis.length}개 KPI가 조직 목표와 연결되어 있습니다.`,
        badge: 'Alignment',
        href: '/kpi/personal',
        tone: myKpis.some((item) => !item.linkedOrgKpiId) ? 'warn' : 'success',
      },
      {
        title: '최근 실적 리스크',
        description: `${myKpis.filter((item) => (item.monthlyRecords[item.monthlyRecords.length - 1]?.achievementRate ?? 100) < 80).length}개 KPI가 주의 구간입니다.`,
        badge: 'Monthly',
        href: '/kpi/monthly',
        tone: toTone(
          myKpis.filter((item) => (item.monthlyRecords[item.monthlyRecords.length - 1]?.achievementRate ?? 100) < 80).length,
          1,
          3
        ),
      },
      {
        title: '팀 월간 리스크',
        description: `${teamRiskyMonthly}건의 팀 월간 실적이 80% 미만입니다.`,
        badge: 'Team',
        href: '/kpi/monthly',
        tone: toTone(teamRiskyMonthly, 1, 5),
      },
    ],
    reviewQueue: reviewQueue.map((item) => ({
      title: `${item.target.empName} · ${item.evalCycle.cycleName}`,
      description: `${item.target.department?.deptName ?? '부서 미지정'} / ${item.evalStage} / ${item.status}`,
      badge: item.status,
      href: `/evaluation/workbench?cycleId=${encodeURIComponent(item.evalCycleId)}&evaluationId=${encodeURIComponent(item.id)}`,
    })),
    checkins: [...upcomingMine, ...teamUpcomingCheckins].slice(0, 6).map((item) => ({
      title: `${item.owner?.empName ?? '담당자'} 체크인`,
      description: `${item.scheduledDate.toLocaleString('ko-KR')} / ${item.status}`,
      badge: item.checkInType,
      href: '/checkin',
    })),
    notifications: unreadNotifications.map((item) => ({
      title: item.title,
      description: item.message,
      href: item.link || '/notifications',
    })),
    risks: [
      {
        title: '검토 대기 평가',
        description: `${reviewQueue.length}건이 아직 제출 또는 확정되지 않았습니다.`,
        badge: 'Review',
        href: '/evaluation/workbench',
        tone: toTone(reviewQueue.length, 1, 4),
      },
      {
        title: '팀 월간 리스크',
        description: `${teamRiskyMonthly}건이 80% 미만 달성률입니다.`,
        badge: 'Monthly',
        href: '/kpi/monthly',
        tone: toTone(teamRiskyMonthly, 1, 5),
      },
      {
        title: '읽지 않은 알림',
        description: `${unreadNotifications.length}건의 알림이 남아 있습니다.`,
        badge: 'Inbox',
        href: '/notifications',
        tone: toTone(unreadNotifications.length, 1, 5),
      },
    ],
    alerts,
  }
}
