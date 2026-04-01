'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CircleDot, Clock3, FilePenLine, Flag, Layers3, Plus } from 'lucide-react'
import { formatDate, getCurrentYear } from '@/lib/utils'

type OrganizationOption = {
  id: string
  name: string
  fiscalYear: number
}

type CycleStatus =
  | 'SETUP'
  | 'KPI_SETTING'
  | 'IN_PROGRESS'
  | 'SELF_EVAL'
  | 'FIRST_EVAL'
  | 'SECOND_EVAL'
  | 'FINAL_EVAL'
  | 'CEO_ADJUST'
  | 'RESULT_OPEN'
  | 'APPEAL'
  | 'CLOSED'

type EvalCycleItem = {
  id: string
  orgId: string
  evalYear: number
  cycleName: string
  status: CycleStatus
  showQuestionWeight: boolean
  showScoreSummary: boolean
  goalEditMode: 'FULL' | 'CHECKIN_ONLY'
  kpiSetupStart: string | null
  kpiSetupEnd: string | null
  selfEvalStart: string | null
  selfEvalEnd: string | null
  firstEvalStart: string | null
  firstEvalEnd: string | null
  secondEvalStart: string | null
  secondEvalEnd: string | null
  finalEvalStart: string | null
  finalEvalEnd: string | null
  ceoAdjustStart: string | null
  ceoAdjustEnd: string | null
  resultOpenStart: string | null
  resultOpenEnd: string | null
  appealDeadline: string | null
  createdAt: string
  updatedAt: string
  organization: { name: string }
  _count: { evaluations: number }
}

type CycleFormState = {
  orgId: string
  evalYear: string
  cycleName: string
  showQuestionWeight: boolean
  showScoreSummary: boolean
  goalEditMode: 'FULL' | 'CHECKIN_ONLY'
  kpiSetupStart: string
  kpiSetupEnd: string
  selfEvalStart: string
  selfEvalEnd: string
  firstEvalStart: string
  firstEvalEnd: string
  secondEvalStart: string
  secondEvalEnd: string
  finalEvalStart: string
  finalEvalEnd: string
  ceoAdjustStart: string
  ceoAdjustEnd: string
  resultOpenStart: string
  resultOpenEnd: string
  appealDeadline: string
}

type FeedbackState = {
  tone: 'success' | 'error'
  message: string
} | null

type CyclePhaseFieldKey =
  | 'kpiSetupStart'
  | 'kpiSetupEnd'
  | 'selfEvalStart'
  | 'selfEvalEnd'
  | 'firstEvalStart'
  | 'firstEvalEnd'
  | 'secondEvalStart'
  | 'secondEvalEnd'
  | 'finalEvalStart'
  | 'finalEvalEnd'
  | 'ceoAdjustStart'
  | 'ceoAdjustEnd'
  | 'resultOpenStart'
  | 'resultOpenEnd'
  | 'appealDeadline'

const STATUS_LABELS: Record<CycleStatus, string> = {
  SETUP: '설계',
  KPI_SETTING: 'KPI 설정',
  IN_PROGRESS: '진행 중',
  SELF_EVAL: '자기 평가',
  FIRST_EVAL: '1차 평가',
  SECOND_EVAL: '2차 평가',
  FINAL_EVAL: '최종 평가',
  CEO_ADJUST: '등급 조정',
  RESULT_OPEN: '결과 공개',
  APPEAL: '이의 신청',
  CLOSED: '종료',
}

const PHASE_FIELDS: Array<{ key: CyclePhaseFieldKey; label: string }> = [
  { key: 'kpiSetupStart', label: 'KPI 설정 시작' },
  { key: 'kpiSetupEnd', label: 'KPI 설정 종료' },
  { key: 'selfEvalStart', label: '자기 평가 시작' },
  { key: 'selfEvalEnd', label: '자기 평가 종료' },
  { key: 'firstEvalStart', label: '1차 평가 시작' },
  { key: 'firstEvalEnd', label: '1차 평가 종료' },
  { key: 'secondEvalStart', label: '2차 평가 시작' },
  { key: 'secondEvalEnd', label: '2차 평가 종료' },
  { key: 'finalEvalStart', label: '최종 평가 시작' },
  { key: 'finalEvalEnd', label: '최종 평가 종료' },
  { key: 'ceoAdjustStart', label: '등급 조정 시작' },
  { key: 'ceoAdjustEnd', label: '등급 조정 종료' },
  { key: 'resultOpenStart', label: '결과 공개 시작' },
  { key: 'resultOpenEnd', label: '결과 공개 종료' },
  { key: 'appealDeadline', label: '이의 신청 마감' },
]

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return payload.data as T
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

function buildDefaultForm(organizations: OrganizationOption[]): CycleFormState {
  return {
    orgId: organizations[0]?.id || '',
    evalYear: String(getCurrentYear()),
    cycleName: '',
    showQuestionWeight: true,
    showScoreSummary: true,
    goalEditMode: 'FULL',
    kpiSetupStart: '',
    kpiSetupEnd: '',
    selfEvalStart: '',
    selfEvalEnd: '',
    firstEvalStart: '',
    firstEvalEnd: '',
    secondEvalStart: '',
    secondEvalEnd: '',
    finalEvalStart: '',
    finalEvalEnd: '',
    ceoAdjustStart: '',
    ceoAdjustEnd: '',
    resultOpenStart: '',
    resultOpenEnd: '',
    appealDeadline: '',
  }
}

function buildFormFromCycle(cycle: EvalCycleItem): CycleFormState {
  return {
    orgId: cycle.orgId,
    evalYear: String(cycle.evalYear),
    cycleName: cycle.cycleName,
    showQuestionWeight: cycle.showQuestionWeight,
    showScoreSummary: cycle.showScoreSummary,
    goalEditMode: cycle.goalEditMode ?? 'FULL',
    kpiSetupStart: toDateTimeLocalValue(cycle.kpiSetupStart),
    kpiSetupEnd: toDateTimeLocalValue(cycle.kpiSetupEnd),
    selfEvalStart: toDateTimeLocalValue(cycle.selfEvalStart),
    selfEvalEnd: toDateTimeLocalValue(cycle.selfEvalEnd),
    firstEvalStart: toDateTimeLocalValue(cycle.firstEvalStart),
    firstEvalEnd: toDateTimeLocalValue(cycle.firstEvalEnd),
    secondEvalStart: toDateTimeLocalValue(cycle.secondEvalStart),
    secondEvalEnd: toDateTimeLocalValue(cycle.secondEvalEnd),
    finalEvalStart: toDateTimeLocalValue(cycle.finalEvalStart),
    finalEvalEnd: toDateTimeLocalValue(cycle.finalEvalEnd),
    ceoAdjustStart: toDateTimeLocalValue(cycle.ceoAdjustStart),
    ceoAdjustEnd: toDateTimeLocalValue(cycle.ceoAdjustEnd),
    resultOpenStart: toDateTimeLocalValue(cycle.resultOpenStart),
    resultOpenEnd: toDateTimeLocalValue(cycle.resultOpenEnd),
    appealDeadline: toDateTimeLocalValue(cycle.appealDeadline),
  }
}

function buildReadinessChecklist(cycle: EvalCycleItem) {
  return [
    {
      label: 'KPI 설정 일정',
      passed: !!cycle.kpiSetupStart && !!cycle.kpiSetupEnd,
      detail: cycle.kpiSetupStart && cycle.kpiSetupEnd ? '완료' : '시작/종료 일정이 필요합니다.',
    },
    {
      label: '자기 평가 일정',
      passed: !!cycle.selfEvalStart && !!cycle.selfEvalEnd,
      detail: cycle.selfEvalStart && cycle.selfEvalEnd ? '완료' : '시작/종료 일정이 필요합니다.',
    },
    {
      label: '1차 평가 일정',
      passed: !!cycle.firstEvalStart && !!cycle.firstEvalEnd,
      detail: cycle.firstEvalStart && cycle.firstEvalEnd ? '완료' : '시작/종료 일정이 필요합니다.',
    },
    {
      label: '최종 평가 일정',
      passed: !!cycle.finalEvalStart && !!cycle.finalEvalEnd,
      detail: cycle.finalEvalStart && cycle.finalEvalEnd ? '완료' : '시작/종료 일정이 필요합니다.',
    },
    {
      label: '결과 공개 시작일',
      passed: !!cycle.resultOpenStart,
      detail: cycle.resultOpenStart ? formatDate(cycle.resultOpenStart) : '공개 시작일이 필요합니다.',
    },
    {
      label: '이의 신청 마감일',
      passed: !!cycle.appealDeadline,
      detail: cycle.appealDeadline ? formatDate(cycle.appealDeadline) : '마감일이 필요합니다.',
    },
    {
      label: '평가 데이터',
      passed: cycle._count.evaluations > 0,
      detail: cycle._count.evaluations > 0 ? `평가 ${cycle._count.evaluations}건 생성됨` : '생성된 평가 데이터가 없습니다.',
    },
  ]
}

function buildStatusRecommendation(cycle: EvalCycleItem, readinessPassed: boolean) {
  const now = new Date()
  const inRange = (start: string | null, end: string | null) => {
    if (!start || !end) return false
    const startDate = new Date(start)
    const endDate = new Date(end)
    return startDate <= now && now <= endDate
  }

  if (inRange(cycle.kpiSetupStart, cycle.kpiSetupEnd)) {
    return { status: 'KPI_SETTING' as CycleStatus, reason: '현재 KPI 설정 기간 안에 있습니다.' }
  }
  if (inRange(cycle.selfEvalStart, cycle.selfEvalEnd)) {
    return { status: 'SELF_EVAL' as CycleStatus, reason: '현재 자기 평가 기간 안에 있습니다.' }
  }
  if (inRange(cycle.firstEvalStart, cycle.firstEvalEnd)) {
    return { status: 'FIRST_EVAL' as CycleStatus, reason: '현재 1차 평가 기간 안에 있습니다.' }
  }
  if (inRange(cycle.secondEvalStart, cycle.secondEvalEnd)) {
    return { status: 'SECOND_EVAL' as CycleStatus, reason: '현재 2차 평가 기간 안에 있습니다.' }
  }
  if (inRange(cycle.finalEvalStart, cycle.finalEvalEnd)) {
    return { status: 'FINAL_EVAL' as CycleStatus, reason: '현재 최종 평가 기간 안에 있습니다.' }
  }
  if (inRange(cycle.ceoAdjustStart, cycle.ceoAdjustEnd)) {
    return { status: 'CEO_ADJUST' as CycleStatus, reason: '현재 등급 조정 기간 안에 있습니다.' }
  }
  if (cycle.resultOpenStart && new Date(cycle.resultOpenStart) <= now) {
    if (cycle.appealDeadline && new Date(cycle.appealDeadline) >= now) {
      return {
        status: readinessPassed ? ('APPEAL' as CycleStatus) : ('RESULT_OPEN' as CycleStatus),
        reason: readinessPassed
          ? '결과 공개 후 이의 신청 기간에 들어왔습니다.'
          : '결과 공개 직전이지만 readiness 보완이 필요합니다.',
      }
    }

    return {
      status: readinessPassed ? ('RESULT_OPEN' as CycleStatus) : ('FINAL_EVAL' as CycleStatus),
      reason: readinessPassed
        ? '결과 공개 시점에 도달했습니다.'
        : '결과 공개 시점 전 readiness 보완이 필요합니다.',
    }
  }

  if (cycle.kpiSetupStart && new Date(cycle.kpiSetupStart) > now) {
    return { status: 'SETUP' as CycleStatus, reason: '아직 첫 운영 단계가 시작되지 않았습니다.' }
  }

  if (readinessPassed) {
    return { status: 'RESULT_OPEN' as CycleStatus, reason: '모든 준비가 완료되어 결과 공개 단계 진입이 가능합니다.' }
  }

  return { status: cycle.status, reason: '현재 설정된 일정과 상태를 유지하는 것이 안전합니다.' }
}

function getStatusBadgeClass(status: CycleStatus) {
  if (status === 'CLOSED') return 'bg-slate-100 text-slate-700'
  if (status === 'RESULT_OPEN' || status === 'APPEAL') return 'bg-emerald-100 text-emerald-700'
  if (status === 'CEO_ADJUST' || status === 'FINAL_EVAL') return 'bg-amber-100 text-amber-700'
  return 'bg-blue-100 text-blue-700'
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <section className="touch-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </section>
  )
}

export function AdminEvalCycleClient({
  initialCycles,
  organizations,
}: {
  initialCycles: EvalCycleItem[]
  organizations: OrganizationOption[]
}) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [selectedYear, setSelectedYear] = useState<'ALL' | number>(getCurrentYear())
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | CycleStatus>('ALL')
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(initialCycles[0]?.id ?? null)
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState<CycleStatus>(initialCycles[0]?.status ?? 'SETUP')
  const [form, setForm] = useState<CycleFormState>(() => buildDefaultForm(organizations))

  const cyclesQuery = useQuery({
    queryKey: ['admin-eval-cycles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/eval-cycles')
      return parseResponse<EvalCycleItem[]>(await res.json())
    },
    initialData: initialCycles,
  })

  const createMutation = useMutation({
    mutationFn: async (input: CycleFormState) => {
      const res = await fetch('/api/admin/eval-cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: input.orgId,
          evalYear: Number(input.evalYear),
          cycleName: input.cycleName,
          showQuestionWeight: input.showQuestionWeight,
          showScoreSummary: input.showScoreSummary,
          goalEditMode: input.goalEditMode,
          kpiSetupStart: toIso(input.kpiSetupStart),
          kpiSetupEnd: toIso(input.kpiSetupEnd),
          selfEvalStart: toIso(input.selfEvalStart),
          selfEvalEnd: toIso(input.selfEvalEnd),
          firstEvalStart: toIso(input.firstEvalStart),
          firstEvalEnd: toIso(input.firstEvalEnd),
          secondEvalStart: toIso(input.secondEvalStart),
          secondEvalEnd: toIso(input.secondEvalEnd),
          finalEvalStart: toIso(input.finalEvalStart),
          finalEvalEnd: toIso(input.finalEvalEnd),
          ceoAdjustStart: toIso(input.ceoAdjustStart),
          ceoAdjustEnd: toIso(input.ceoAdjustEnd),
          resultOpenStart: toIso(input.resultOpenStart),
          resultOpenEnd: toIso(input.resultOpenEnd),
          appealDeadline: toIso(input.appealDeadline),
        }),
      })

      return parseResponse<EvalCycleItem>(await res.json())
    },
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '평가 주기가 등록되었습니다.' })
      setForm(buildDefaultForm(organizations))
      setEditingCycleId(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-eval-cycles'] })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; form: CycleFormState }) => {
      const res = await fetch(`/api/admin/eval-cycles/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: input.form.orgId,
          evalYear: Number(input.form.evalYear),
          cycleName: input.form.cycleName,
          showQuestionWeight: input.form.showQuestionWeight,
          showScoreSummary: input.form.showScoreSummary,
          goalEditMode: input.form.goalEditMode,
          kpiSetupStart: toIso(input.form.kpiSetupStart),
          kpiSetupEnd: toIso(input.form.kpiSetupEnd),
          selfEvalStart: toIso(input.form.selfEvalStart),
          selfEvalEnd: toIso(input.form.selfEvalEnd),
          firstEvalStart: toIso(input.form.firstEvalStart),
          firstEvalEnd: toIso(input.form.firstEvalEnd),
          secondEvalStart: toIso(input.form.secondEvalStart),
          secondEvalEnd: toIso(input.form.secondEvalEnd),
          finalEvalStart: toIso(input.form.finalEvalStart),
          finalEvalEnd: toIso(input.form.finalEvalEnd),
          ceoAdjustStart: toIso(input.form.ceoAdjustStart),
          ceoAdjustEnd: toIso(input.form.ceoAdjustEnd),
          resultOpenStart: toIso(input.form.resultOpenStart),
          resultOpenEnd: toIso(input.form.resultOpenEnd),
          appealDeadline: toIso(input.form.appealDeadline),
        }),
      })

      return parseResponse<EvalCycleItem>(await res.json())
    },
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '평가 주기 정보가 수정되었습니다.' })
      setEditingCycleId(null)
      setForm(buildDefaultForm(organizations))
      await queryClient.invalidateQueries({ queryKey: ['admin-eval-cycles'] })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: CycleStatus }) => {
      const res = await fetch(`/api/admin/eval-cycles/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      })

      return parseResponse<EvalCycleItem>(await res.json())
    },
    onSuccess: async (_, variables) => {
      setFeedback({
        tone: 'success',
        message: `평가 주기 상태가 ${STATUS_LABELS[variables.status]} 단계로 변경되었습니다.`,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-eval-cycles'] })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const cycles = useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data])

  const visibleCycles = useMemo(() => {
    return cycles.filter((cycle) => {
      if (selectedYear !== 'ALL' && cycle.evalYear !== selectedYear) return false
      if (selectedStatus !== 'ALL' && cycle.status !== selectedStatus) return false
      return true
    })
  }, [cycles, selectedStatus, selectedYear])

  const selectedCycle = visibleCycles.find((cycle) => cycle.id === selectedCycleId) ?? visibleCycles[0] ?? null

  const metrics = useMemo(() => {
    const currentYearCycles = cycles.filter((cycle) => cycle.evalYear === getCurrentYear())
    return {
      total: currentYearCycles.length,
      inProgress: currentYearCycles.filter((cycle) => cycle.status !== 'CLOSED').length,
      published: currentYearCycles.filter((cycle) => cycle.status === 'RESULT_OPEN' || cycle.status === 'APPEAL').length,
      closed: currentYearCycles.filter((cycle) => cycle.status === 'CLOSED').length,
    }
  }, [cycles])

  const yearOptions = useMemo(() => {
    const fromCycles = cycles.map((cycle) => cycle.evalYear)
    const values = new Set([getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1, ...fromCycles])
    return Array.from(values).sort((a, b) => b - a)
  }, [cycles])

  const formBusy = createMutation.isPending || updateMutation.isPending
  const readinessChecklist = selectedCycle ? buildReadinessChecklist(selectedCycle) : []
  const readinessPassed = readinessChecklist.every((item) => item.passed)
  const recommendedStatus = selectedCycle ? buildStatusRecommendation(selectedCycle, readinessPassed) : null

  return (
    <div className="space-y-6">
      <section className="touch-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">
              Evaluation Cycle
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">평가 주기 관리</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              KPI 설정부터 결과 공개, 이의 신청까지의 일정을 한 화면에서 관리합니다. 이번 단계에서는
              주기 편집과 상태 전환까지 직접 처리할 수 있게 확장했습니다.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            공개 전에 일정 누락 여부와 결과 공개 구간을 꼭 확인하세요.
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Layers3 className="h-5 w-5" />} label="올해 주기 수" value={`${metrics.total}개`} />
        <MetricCard icon={<Clock3 className="h-5 w-5" />} label="진행 중" value={`${metrics.inProgress}개`} />
        <MetricCard icon={<Flag className="h-5 w-5" />} label="결과 공개/이의 신청" value={`${metrics.published}개`} />
        <MetricCard icon={<CircleDot className="h-5 w-5" />} label="종료됨" value={`${metrics.closed}개`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,440px)]">
        <section className="touch-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">주기 목록</h2>
              <p className="mt-1 text-sm text-slate-500">
                상태, 공개 일정, 평가 건수를 기준으로 운영 상황을 빠르게 확인합니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">전체 연도</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as 'ALL' | CycleStatus)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="ALL">전체 상태</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cyclesQuery.isLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              평가 주기를 불러오는 중입니다.
            </div>
          ) : visibleCycles.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
              조건에 맞는 평가 주기가 없습니다.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {visibleCycles.map((cycle) => {
                const isActive = cycle.id === selectedCycle?.id
                return (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => {
                      setSelectedCycleId(cycle.id)
                      setStatusDraft(cycle.status)
                    }}
                    className={`w-full rounded-3xl border p-5 text-left transition ${
                      isActive
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{cycle.cycleName}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(cycle.status)}`}>
                            {STATUS_LABELS[cycle.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {cycle.evalYear}년 · {cycle.organization.name}
                        </p>
                      </div>
                      <div className="text-sm text-slate-500">평가 건수 {cycle._count.evaluations}건</div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">KPI 설정</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {cycle.kpiSetupStart && cycle.kpiSetupEnd
                            ? `${formatDate(cycle.kpiSetupStart)} ~ ${formatDate(cycle.kpiSetupEnd)}`
                            : '미정'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">결과 공개</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {cycle.resultOpenStart ? formatDate(cycle.resultOpenStart) : '미정'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-500">이의 신청 마감</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">
                          {cycle.appealDeadline ? formatDate(cycle.appealDeadline) : '미정'}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="touch-card p-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">상세 일정 / 상태 전환</h2>
            </div>

            {!selectedCycle ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                선택된 평가 주기가 없습니다.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{selectedCycle.cycleName}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(selectedCycle.status)}`}>
                      {STATUS_LABELS[selectedCycle.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedCycle.evalYear}년 · {selectedCycle.organization.name}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCycleId(selectedCycle.id)
                      setForm(buildFormFromCycle(selectedCycle))
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FilePenLine className="mr-2 h-4 w-4" />
                    이 주기 편집
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">상태 전환</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as CycleStatus)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={statusMutation.isPending || statusDraft === selectedCycle.status}
                      onClick={() => {
                        const requiresReadiness = ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(statusDraft)
                        if (requiresReadiness && !readinessPassed) {
                          setFeedback({
                            tone: 'error',
                            message: '공개 전 readiness 체크를 먼저 모두 통과해 주세요.',
                          })
                          return
                        }

                        statusMutation.mutate({ id: selectedCycle.id, status: statusDraft })
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {statusMutation.isPending ? '변경 중...' : '상태 적용'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">공개 전 readiness 체크</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        readinessPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {readinessPassed ? '통과' : '보완 필요'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {readinessChecklist.map((item) => (
                      <div key={item.label} className="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {item.passed ? '완료' : '미완료'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {recommendedStatus ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">자동 상태 추천</p>
                        <p className="mt-1 text-xs text-slate-600">{recommendedStatus.reason}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700">
                        {STATUS_LABELS[recommendedStatus.status]}
                      </span>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={statusMutation.isPending || recommendedStatus.status === selectedCycle.status}
                        onClick={() => {
                          if (['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(recommendedStatus.status) && !readinessPassed) {
                            setFeedback({
                              tone: 'error',
                              message: '추천 상태로 이동하기 전에 readiness 체크를 먼저 통과해 주세요.',
                            })
                            return
                          }

                          setStatusDraft(recommendedStatus.status)
                          statusMutation.mutate({ id: selectedCycle.id, status: recommendedStatus.status })
                        }}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-300 bg-white px-4 text-sm font-medium text-blue-700 disabled:opacity-60"
                      >
                        추천 상태 적용
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">질문별 가중치</div>
                    <div className="mt-2 text-sm text-slate-600">
                      {selectedCycle.showQuestionWeight ? '평가권자 화면에 표시' : '평가권자 화면에서 숨김'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">점수 요약 카드</div>
                    <div className="mt-2 text-sm text-slate-600">
                      {selectedCycle.showScoreSummary ? '평가권자 화면에 표시' : '평가권자 화면에서 숨김'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                    <div className="text-sm font-semibold text-slate-900">목표 읽기 모드</div>
                    <div className="mt-2 text-sm text-slate-600">
                      {selectedCycle.goalEditMode === 'CHECKIN_ONLY'
                        ? '목표 생성/수정/삭제는 막고 체크인과 코멘트만 허용합니다.'
                        : '목표 생성/수정/삭제와 체크인을 모두 허용합니다.'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    ['KPI 설정', selectedCycle.kpiSetupStart, selectedCycle.kpiSetupEnd],
                    ['자기 평가', selectedCycle.selfEvalStart, selectedCycle.selfEvalEnd],
                    ['1차 평가', selectedCycle.firstEvalStart, selectedCycle.firstEvalEnd],
                    ['2차 평가', selectedCycle.secondEvalStart, selectedCycle.secondEvalEnd],
                    ['최종 평가', selectedCycle.finalEvalStart, selectedCycle.finalEvalEnd],
                    ['등급 조정', selectedCycle.ceoAdjustStart, selectedCycle.ceoAdjustEnd],
                    ['결과 공개', selectedCycle.resultOpenStart, selectedCycle.resultOpenEnd],
                  ].map(([label, start, end]) => (
                    <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        <p className="text-xs text-slate-500">
                          {start ? `${formatDate(start)}${end ? ` ~ ${formatDate(end)}` : ''}` : '일정 미등록'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p>
                    이의 신청 마감:{' '}
                    <span className="font-semibold text-slate-900">
                      {selectedCycle.appealDeadline ? formatDate(selectedCycle.appealDeadline) : '미정'}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    마지막 수정일 {formatDate(selectedCycle.updatedAt)}
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="touch-card p-6">
            <div className="flex items-center gap-2">
              {editingCycleId ? <FilePenLine className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
              <h2 className="text-lg font-semibold text-slate-900">
                {editingCycleId ? '평가 주기 편집' : '새 평가 주기 등록'}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              기본 정보와 단계별 일정을 함께 입력하면 주기 운영의 기준점이 됩니다.
            </p>

            {!organizations.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                등록된 조직이 없어 평가 주기를 생성할 수 없습니다.
              </div>
            ) : (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  setFeedback(null)

                  if (!form.orgId) {
                    setFeedback({ tone: 'error', message: '대상 조직을 선택해 주세요.' })
                    return
                  }
                  if (!form.cycleName.trim()) {
                    setFeedback({ tone: 'error', message: '주기명을 입력해 주세요.' })
                    return
                  }

                  if (editingCycleId) {
                    updateMutation.mutate({ id: editingCycleId, form })
                    return
                  }

                  createMutation.mutate(form)
                }}
              >
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">평가권자 화면 노출 설정</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      평가 작성 화면에서 질문별 가중치와 점수 요약 카드의 노출 여부를 제어합니다. 계산과 저장, 내보내기는 그대로 유지됩니다.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.showQuestionWeight}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, showQuestionWeight: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">질문별 가중치 표시</span>
                        <span className="mt-1 block text-slate-500">
                          평가권자가 각 KPI 항목의 가중치를 화면에서 바로 확인할 수 있습니다.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.showScoreSummary}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, showScoreSummary: event.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">점수 요약 카드 표시</span>
                        <span className="mt-1 block text-slate-500">
                          초안 총점과 저장 점수 같은 요약 카드를 평가 화면 상단에 노출합니다.
                        </span>
                      </span>
                    </label>
                    <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <span className="block font-semibold text-slate-900">목표 운영 모드</span>
                      <span className="mt-1 block text-slate-500">
                        읽기 전용 모드에서는 목표 생성/수정/삭제를 막고 체크인과 코멘트만 허용합니다.
                      </span>
                      <select
                        value={form.goalEditMode}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            goalEditMode: event.target.value as CycleFormState['goalEditMode'],
                          }))
                        }
                        className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                      >
                        <option value="FULL">전체 편집 허용</option>
                        <option value="CHECKIN_ONLY">체크인 / 코멘트만 허용</option>
                      </select>
                    </label>
                  </div>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">대상 조직</span>
                    <select
                      value={form.orgId}
                      onChange={(event) => setForm((current) => ({ ...current, orgId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">평가 연도</span>
                    <input
                      type="number"
                      value={form.evalYear}
                      onChange={(event) => setForm((current) => ({ ...current, evalYear: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">주기명</span>
                  <input
                    value={form.cycleName}
                    onChange={(event) => setForm((current) => ({ ...current, cycleName: event.target.value }))}
                    placeholder="예: 2026 상반기 평가"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  {PHASE_FIELDS.map((field) => (
                    <label key={field.key} className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">{field.label}</span>
                      <input
                        type="datetime-local"
                        value={form[field.key]}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={formBusy}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {formBusy ? '저장 중...' : editingCycleId ? '수정 저장' : '평가 주기 등록'}
                  </button>
                  {editingCycleId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCycleId(null)
                        setForm(buildDefaultForm(organizations))
                      }}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      편집 취소
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
