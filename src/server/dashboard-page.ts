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

export async function getDashboardPageData(session: Session): Promise<DashboardPageData> {
  const year = getCurrentYear()

  const employee = await prisma.employee.findUnique({
    where: { id: session.user.id },
    include: {
      department: true,
    },
  })

  if (!employee) {
    return {
      role: session.user.role,
      userName: session.user.name,
      year,
      title: '대시보드',
      description: '직원 정보를 찾을 수 없습니다.',
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
    }
  }

  const unreadNotifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id, isRead: false },
    orderBy: { sentAt: 'desc' },
    take: 5,
  })

  const myKpis = await prisma.personalKpi.findMany({
    where: {
      employeeId: session.user.id,
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
  })

  const myTrend = averageTrend(
    myKpis.flatMap((kpi) =>
      kpi.monthlyRecords.map((record) => ({
        yearMonth: record.yearMonth,
        achievementRate: record.achievementRate,
      }))
    )
  )

  const upcomingMine = await prisma.checkIn.findMany({
    where: {
      OR: [{ ownerId: session.user.id }, { managerId: session.user.id }],
      status: { in: ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'] },
    },
    include: {
      owner: { select: { empName: true } },
    },
    orderBy: { scheduledDate: 'asc' },
    take: 5,
  })

  const reviewQueue = await prisma.evaluation.findMany({
    where: {
      evaluatorId: session.user.id,
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
  })

  const accessibleDepartmentIds =
    session.user.role === 'ROLE_MEMBER' ? [session.user.deptId] : session.user.accessibleDepartmentIds

  const teamMembers = await prisma.employee.findMany({
    where: {
      deptId: { in: accessibleDepartmentIds.length ? accessibleDepartmentIds : [session.user.deptId] },
      status: 'ACTIVE',
      id: { not: session.user.id },
    },
    select: {
      id: true,
      empName: true,
      department: { select: { deptName: true } },
    },
    take: 30,
  })

  const teamMemberIds = teamMembers.map((item) => item.id)

  const teamRiskyMonthly = teamMemberIds.length
    ? await prisma.monthlyRecord.count({
        where: {
          employeeId: { in: teamMemberIds },
          achievementRate: { lt: 80 },
        },
      })
    : 0

  const teamUpcomingCheckins = await prisma.checkIn.findMany({
    where: {
      managerId: session.user.id,
      status: { in: ['SCHEDULED', 'IN_PROGRESS', 'RESCHEDULED'] },
    },
    include: {
      owner: { select: { empName: true } },
    },
    orderBy: { scheduledDate: 'asc' },
    take: 6,
  })

  const opsSummary =
    session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO'
      ? await buildOperationsSummary()
      : null

  if (session.user.role === 'ROLE_ADMIN' || session.user.role === 'ROLE_CEO') {
    const title = session.user.role === 'ROLE_CEO' ? '경영 관점 요약' : '운영 관점 요약'
    const description =
      session.user.role === 'ROLE_CEO'
        ? '성과, 조정, 보상, 운영 리스크를 함께 확인합니다.'
        : '평가/보상/운영 이슈를 빠르게 파악하고 바로 조치할 수 있습니다.'

    return {
      role: session.user.role,
      userName: session.user.name,
      year,
      title,
      description,
      statusLabel: opsSummary?.status.label ?? '정상',
      statusTone:
        opsSummary?.status.tone === 'error'
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
          description: '재처리가 필요한 알림 실패',
          tone: toTone(opsSummary?.metrics.notificationDeadLetters ?? 0, 1, 1),
          href: '/admin/notifications',
        },
        {
          label: '예산 초과 시나리오',
          value: String(opsSummary?.metrics.overBudgetScenarios ?? 0),
          description: '보상 시뮬레이션 위험 건',
          tone: toTone(opsSummary?.metrics.overBudgetScenarios ?? 0, 1, 1),
          href: '/compensation/manage',
        },
        {
          label: '진행 중 평가 주기',
          value: String(opsSummary?.metrics.activeEvalCycles ?? 0),
          description: '현재 닫히지 않은 주기',
          tone: toTone(opsSummary?.metrics.delayedEvalCycles ?? 0, 1, 2),
          href: '/admin/eval-cycle',
        },
      ],
      actions: [
        { label: '운영/관제 열기', description: '시스템 상태와 이벤트 로그 확인', href: '/admin/ops' },
        { label: '알림 운영', description: 'dead letter와 템플릿 복구', href: '/admin/notifications' },
        { label: 'Google 계정 등록', description: '로그인 준비 불가 계정 점검', href: '/admin/google-access' },
        { label: '보상 시뮬레이션', description: '예산 초과/승인 상태 확인', href: '/compensation/manage' },
      ],
      trend: myTrend,
      focusItems: [
        {
          title: '로그인 준비 불가 계정',
          description: `${opsSummary?.metrics.loginUnavailableAccounts ?? 0}건의 계정 정합성 이슈가 있습니다.`,
          badge: 'Google access',
          href: '/admin/google-access',
          tone: toTone(opsSummary?.metrics.loginUnavailableAccounts ?? 0, 1, 1),
        },
        {
          title: '미리뷰 월간 실적',
          description: `${opsSummary?.metrics.unreviewedMonthlyRecords ?? 0}건이 검토 대기 중입니다.`,
          badge: 'Monthly review',
          href: '/kpi/monthly',
          tone: toTone(opsSummary?.metrics.unreviewedMonthlyRecords ?? 0, 1, 5),
        },
        {
          title: '조정 미완료 평가',
          description: `${opsSummary?.metrics.unresolvedCalibrationCount ?? 0}개 주기가 조정 단계에 머물러 있습니다.`,
          badge: 'Calibration',
          href: '/evaluation/ceo-adjust',
          tone: toTone(opsSummary?.metrics.unresolvedCalibrationCount ?? 0, 1, 1),
        },
      ],
      reviewQueue: reviewQueue.map((item) => ({
        title: `${item.target.empName} · ${item.evalCycle.cycleName}`,
        description: `${item.target.department.deptName} / ${item.evalStage} / ${item.status}`,
        badge: item.status,
        href: `/evaluation/workbench?cycleId=${encodeURIComponent(item.evalCycleId)}&evaluationId=${encodeURIComponent(item.id)}`,
      })),
      checkins: teamUpcomingCheckins.map((item) => ({
        title: `${item.owner.empName} 체크인`,
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
        tone:
          risk.severity === 'HIGH'
            ? 'error'
            : risk.severity === 'MEDIUM'
              ? 'warn'
              : 'neutral',
      })),
    }
  }

  const memberAverage =
    myTrend.length > 0
      ? Math.round((myTrend.reduce((sum, item) => sum + item.achievementRate, 0) / myTrend.length) * 10) / 10
      : 0

  const title =
    session.user.role === 'ROLE_MEMBER'
      ? '내 성과 흐름 요약'
      : '팀 운영과 나의 성과 흐름'

  const description =
    session.user.role === 'ROLE_MEMBER'
      ? '이번 달 목표, 체크인, 평가 준비에 바로 이어지는 정보만 모았습니다.'
      : '내 목표와 함께 팀 검토/체크인/리스크를 한 화면에서 확인합니다.'

  return {
    role: session.user.role,
    userName: session.user.name,
    year,
    title,
    description,
    statusLabel: reviewQueue.length > 0 || teamRiskyMonthly > 0 ? '주의' : '정상',
    statusTone: reviewQueue.length > 0 || teamRiskyMonthly > 0 ? 'warn' : 'success',
    summary: [
      {
        label: '평균 달성률',
        value: `${memberAverage}%`,
        description: '최근 6개월 평균 기준',
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
        description: '내가 검토하거나 작성할 평가',
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
      { label: '평가 실행', description: '자기평가 또는 팀 평가 작성', href: '/evaluation/workbench' },
      { label: '체크인 일정', description: '이번 주 1:1과 후속 액션 확인', href: '/checkin' },
    ],
    trend: myTrend,
    focusItems: [
      {
        title: '개인 KPI 연결 상태',
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
      description: `${item.target.department.deptName} / ${item.evalStage} / ${item.status}`,
      badge: item.status,
      href: `/evaluation/workbench?cycleId=${encodeURIComponent(item.evalCycleId)}&evaluationId=${encodeURIComponent(item.id)}`,
    })),
    checkins: [...upcomingMine, ...teamUpcomingCheckins].slice(0, 6).map((item) => ({
      title: `${item.owner.empName} 체크인`,
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
        description: `${reviewQueue.length}건이 아직 제출/확정되지 않았습니다.`,
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
        title: '안 읽은 알림',
        description: `${unreadNotifications.length}건의 알림이 남아 있습니다.`,
        badge: 'Inbox',
        href: '/notifications',
        tone: toTone(unreadNotifications.length, 1, 5),
      },
    ],
  }
}
