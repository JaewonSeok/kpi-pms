'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Filter } from 'lucide-react'
import type {
  PerformanceCalendarEvent,
  PerformanceCalendarEventType,
  PerformanceCalendarPageData,
} from '@/server/admin/performance-calendar'

type CalendarCell = {
  key: string
  date: Date
  inMonth: boolean
  dateKey: string
}

const TYPE_STYLES: Record<PerformanceCalendarEventType, string> = {
  goal: 'border-blue-200 bg-blue-50 text-blue-700',
  review: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  survey: 'border-violet-200 bg-violet-50 text-violet-700',
  calibration: 'border-amber-200 bg-amber-50 text-amber-700',
  anniversary: 'border-rose-200 bg-rose-50 text-rose-700',
  milestone: 'border-slate-300 bg-slate-100 text-slate-700',
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function buildMonthCells(monthKey: string): CalendarCell[] {
  const [year, month] = monthKey.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  const cells: CalendarCell[] = []
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    cells.push({
      key: date.toISOString(),
      date,
      inMonth: date >= firstDay && date <= lastDay,
      dateKey: date.toLocaleDateString('sv-SE'),
    })
  }
  return cells
}

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function PerformanceCalendarClient({ data }: { data: PerformanceCalendarPageData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedEventId, setSelectedEventId] = useState<string>(data.events[0]?.id ?? '')
  const calendarContextKey = `${data.month}:${data.selectedTypes.join(',')}`
  const previousContextKey = useRef(calendarContextKey)

  useEffect(() => {
    if (previousContextKey.current === calendarContextKey) return
    previousContextKey.current = calendarContextKey
    setSelectedEventId(data.events[0]?.id ?? '')
  }, [calendarContextKey, data.events])

  const cells = useMemo(() => buildMonthCells(data.month), [data.month])
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, PerformanceCalendarEvent[]>()
    for (const event of data.events) {
      const bucket = grouped.get(event.dateKey) ?? []
      bucket.push(event)
      grouped.set(event.dateKey, bucket)
    }
    return grouped
  }, [data.events])

  const selectedEvent = data.events.find((item) => item.id === selectedEventId) ?? data.events[0] ?? null

  function pushQuery(nextMonth: string, nextTypes: PerformanceCalendarEventType[]) {
    const params = new URLSearchParams()
    params.set('month', nextMonth)
    if (nextTypes.length && nextTypes.length < data.filters.length) {
      params.set('types', nextTypes.join(','))
    }
    startTransition(() => router.push(`/admin/performance-calendar?${params.toString()}`))
  }

  function toggleType(type: PerformanceCalendarEventType) {
    const nextTypes = data.selectedTypes.includes(type)
      ? data.selectedTypes.filter((item) => item !== type)
      : [...data.selectedTypes, type]
    pushQuery(data.month, nextTypes.length ? nextTypes : [type])
  }

  if (data.state === 'permission-denied' || data.state === 'error') {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <CalendarDays className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-xl font-semibold text-slate-900">
          {data.state === 'permission-denied' ? '성과 관리 일정에 접근할 수 없습니다.' : '성과 관리 일정을 불러오지 못했습니다.'}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">{data.message}</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Performance Calendar</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">성과 관리 일정</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              리뷰, 목표, 서베이, 캘리브레이션, 입사일을 한 화면에서 확인하고 바로 관련 관리 화면으로 이동할 수 있습니다.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">{data.monthLabel}</div>
            <div className="mt-1">{data.timezone}</div>
            <div className="mt-2 text-xs text-slate-500">
              {data.summary.monthStart} ~ {data.summary.monthEnd}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <MetricCard label="이달 일정" value={`${data.summary.totalCount}건`} />
          <MetricCard
            label="다음 일정"
            value={data.summary.nextUpcoming?.title ?? '예정 없음'}
            detail={data.summary.nextUpcoming?.dateLabel ?? '선택한 월 기준 예정된 일정이 없습니다.'}
          />
          <MetricCard
            label="상세 이동"
            value={selectedEvent?.hrefLabel ?? '선택 대기'}
            detail={selectedEvent ? selectedEvent.title : '오른쪽 패널에서 일정 상세를 확인하세요.'}
          />
        </div>
      </section>

      {data.alerts.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            일부 일정 소스를 불러오지 못해 부분 데이터만 표시하고 있습니다.
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.alerts.map((alert) => (
              <div key={alert.title + alert.description} className="rounded-2xl border border-amber-200 bg-white/80 p-4">
                <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pushQuery(shiftMonth(data.month, -1), data.selectedTypes)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              aria-label="이전 달"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-40 text-center text-base font-semibold text-slate-900">{data.monthLabel}</div>
            <button
              type="button"
              onClick={() => pushQuery(shiftMonth(data.month, 1), data.selectedTypes)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              aria-label="다음 달"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              <Filter className="h-3.5 w-3.5" />
              타입 필터
            </span>
            {data.filters.map((filter) => {
              const active = data.selectedTypes.includes(filter.type)
              return (
                <button
                  key={filter.type}
                  type="button"
                  onClick={() => toggleType(filter.type)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    active ? TYPE_STYLES[filter.type] : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {filter.label} {filter.count}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell) => {
                const cellEvents = eventsByDate.get(cell.dateKey) ?? []
                return (
                  <div
                    key={cell.key}
                    className={`min-h-36 border-b border-r border-slate-200 px-2 py-2 align-top ${
                      cell.inMonth ? 'bg-white' : 'bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        cell.inMonth ? 'text-slate-900' : 'text-slate-400'
                      }`}>
                        {cell.date.getDate()}
                      </span>
                      {cellEvents.length ? (
                        <span className="text-[11px] font-semibold text-slate-400">{cellEvents.length}건</span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {cellEvents.slice(0, 3).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedEventId(event.id)}
                          className={`w-full rounded-xl border px-2.5 py-2 text-left text-[11px] font-semibold transition ${
                            selectedEvent?.id === event.id
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : TYPE_STYLES[event.type]
                          }`}
                        >
                          <div className="truncate">{event.title}</div>
                          <div className={`mt-1 truncate font-normal ${selectedEvent?.id === event.id ? 'text-white/80' : 'text-slate-500'}`}>
                            {event.subtitle}
                          </div>
                        </button>
                      ))}
                      {cellEvents.length > 3 ? (
                        <div className="px-2 text-[11px] font-medium text-slate-400">+{cellEvents.length - 3}건 더 보기</div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            {selectedEvent ? (
              <div className="space-y-5">
                <div>
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${TYPE_STYLES[selectedEvent.type]}`}>
                    {selectedEvent.sourceLabel}
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-900">{selectedEvent.title}</h2>
                  <p className="mt-2 text-sm text-slate-500">{selectedEvent.subtitle}</p>
                </div>

                <dl className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div>
                    <dt className="font-semibold text-slate-900">일정</dt>
                    <dd className="mt-1">
                      {new Date(selectedEvent.startsAt).toLocaleString('ko-KR', {
                        timeZone: data.timezone,
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                      {selectedEvent.endsAt
                        ? ` ~ ${new Date(selectedEvent.endsAt).toLocaleString('ko-KR', {
                            timeZone: data.timezone,
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                          })}`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">설명</dt>
                    <dd className="mt-1">{selectedEvent.description}</dd>
                  </div>
                </dl>

                <Link
                  href={selectedEvent.href}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {selectedEvent.hrefLabel}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <CalendarDays className="h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  {data.state === 'empty' ? '이달에 표시할 일정이 없습니다.' : '일정을 선택해 주세요.'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{data.message ?? '달력에서 일정을 선택하면 상세 정보와 이동 링크를 확인할 수 있습니다.'}</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      {isPending ? <div className="text-sm text-slate-500">일정을 다시 불러오는 중입니다...</div> : null}
    </div>
  )
}

function MetricCard(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{props.value}</div>
      {props.detail ? <div className="mt-2 text-sm text-slate-500">{props.detail}</div> : null}
    </div>
  )
}
