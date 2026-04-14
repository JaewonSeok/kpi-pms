import type { FeedbackRoundStatus, FeedbackRoundType, Prisma, SystemRole } from '@prisma/client'
import { buildAdminGoogleAccessHref } from '@/lib/admin-google-access-tabs'
import { prisma } from '@/lib/prisma'
import { parsePerformanceDesignConfig } from '@/lib/performance-design'

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
}

type CalendarParams = {
  month?: string
  types?: PerformanceCalendarEventType[]
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
  calibrationOpenAt: Date | null
  calibrationCloseAt: Date | null
  reviewOpenAt: Date | null
  reviewCloseAt: Date | null
  secondRoundApplyOpenAt: Date | null
  secondRoundApplyCloseAt: Date | null
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

type CalendarDeps = {
  loadEvalCycles: (selectedYear: number) => Promise<EvalCycleLite[]>
  loadFeedbackRounds: (selectedYear: number) => Promise<FeedbackRoundLite[]>
  loadAiCompetencyCycles: (selectedYear: number) => Promise<AiCompetencyCycleLite[]>
  loadEmployees: (monthNumber: number) => Promise<EmployeeLite[]>
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
      prisma.aiCompetencyCycle.findMany({
        where: {
          evalCycle: {
            evalYear: { gte: selectedYear - 1, lte: selectedYear + 1 },
          },
        },
        select: {
          id: true,
          cycleName: true,
          calibrationOpenAt: true,
          calibrationCloseAt: true,
          reviewOpenAt: true,
          reviewCloseAt: true,
          secondRoundApplyOpenAt: true,
          secondRoundApplyCloseAt: true,
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
        key: 'ai-review',
        title: `${cycle.cycleName} AI 활용능력 심사`,
        startsAt: cycle.reviewOpenAt,
        endsAt: cycle.reviewCloseAt,
      },
      {
        key: 'ai-calibration',
        title: `${cycle.cycleName} AI 활용능력 보정`,
        startsAt: cycle.calibrationOpenAt,
        endsAt: cycle.calibrationCloseAt,
      },
      {
        key: 'ai-second-round',
        title: `${cycle.cycleName} 2차 신청`,
        startsAt: cycle.secondRoundApplyOpenAt,
        endsAt: cycle.secondRoundApplyCloseAt,
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
        type: item.key === 'ai-calibration' ? 'calibration' : 'review',
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

export async function getPerformanceCalendarPageData(
  session: CalendarSession,
  params: CalendarParams = {},
  deps: CalendarDeps = buildDefaultDeps()
): Promise<PerformanceCalendarPageData> {
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
    }
  }
}
