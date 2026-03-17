'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Target, Wand2, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { DIFFICULTY_LABELS, getCurrentYear, KPI_TYPE_LABELS } from '@/lib/utils'

type OrgKpi = {
  id: string
  kpiName: string
  kpiCategory: string
}

type PersonalKpi = {
  id: string
  kpiName: string
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  targetValue: number | null
  unit: string | null
  weight: number
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
  status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'
  linkedOrgKpi?: { kpiName: string } | null
  monthlyRecords?: Array<{ achievementRate: number | null }>
}

type AiPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  result: {
    kpiName: string
    definition: string
    formula: string
    targetValueSuggestion: string
    unitSuggestion: string
    weightSuggestion: number
    difficultySuggestion: 'HIGH' | 'MEDIUM' | 'LOW'
    smartChecks: string[]
    managerReviewPoints: string[]
  }
  fallbackReason?: string | null
}

type KpiFormState = {
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiName: string
  definition: string
  formula: string
  targetValue: string
  unit: string
  weight: string
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
  linkedOrgKpiId: string
}

const EMPTY_FORM: KpiFormState = {
  kpiType: 'QUANTITATIVE',
  kpiName: '',
  definition: '',
  formula: '',
  targetValue: '',
  unit: '',
  weight: '',
  difficulty: 'MEDIUM',
  linkedOrgKpiId: '',
}

export default function PersonalKpiPage() {
  const { data: session } = useSession()
  const currentYear = getCurrentYear()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: kpis = [], isLoading } = useQuery<PersonalKpi[]>({
    queryKey: ['personal-kpis', currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/kpi/personal?evalYear=${currentYear}`)
      const json = await res.json()
      return json.data || []
    },
  })

  const { data: orgKpis = [] } = useQuery<OrgKpi[]>({
    queryKey: ['org-kpis', currentYear],
    queryFn: async () => {
      const res = await fetch(`/api/kpi/org?evalYear=${currentYear}`)
      const json = await res.json()
      return json.data || []
    },
  })

  const totalWeight = useMemo(
    () => kpis.reduce((sum, kpi) => sum + kpi.weight, 0),
    [kpis]
  )

  const createMutation = useMutation({
    mutationFn: async (data: KpiFormState) => {
      const res = await fetch('/api/kpi/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          employeeId: session?.user.id,
          evalYear: currentYear,
          targetValue: data.targetValue ? Number(data.targetValue) : undefined,
          weight: Number(data.weight),
          linkedOrgKpiId: data.linkedOrgKpiId || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'KPI 생성에 실패했습니다.')
      }
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-kpis'] })
      setShowForm(false)
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  return (
    <div className="space-y-6">
      <section className="touch-card overflow-hidden p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">
              Personal KPI
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">개인 KPI 관리</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              AI 보조 초안과 SMART 체크를 활용해 KPI를 빠르게 작성하고, 모바일에서도 손쉽게
              검토할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="hidden min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:inline-flex"
          >
            KPI 추가
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="총 가중치" value={`${totalWeight}%`} accent={totalWeight === 100 ? 'ok' : totalWeight > 100 ? 'warn' : 'mid'} />
        <SummaryCard label="등록 KPI" value={`${kpis.length}개`} accent="mid" />
        <SummaryCard label="남은 가중치" value={`${Math.max(0, 100 - totalWeight)}%`} accent="ok" />
      </section>

      {isLoading ? (
        <div className="touch-card p-8 text-center text-slate-500">KPI를 불러오는 중입니다.</div>
      ) : !kpis.length ? (
        <div className="touch-card p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Target className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">아직 등록된 KPI가 없습니다.</h2>
          <p className="mt-2 text-sm text-slate-500">
            새 KPI를 추가하거나 AI 보조 초안으로 첫 번째 KPI를 작성해 보세요.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">KPI</th>
                  <th className="px-5 py-4">유형</th>
                  <th className="px-5 py-4">목표</th>
                  <th className="px-5 py-4">가중치</th>
                  <th className="px-5 py-4">난이도</th>
                  <th className="px-5 py-4">최근 달성률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kpis.map((kpi) => {
                  const rate = kpi.monthlyRecords?.[kpi.monthlyRecords.length - 1]?.achievementRate || 0
                  return (
                    <tr key={kpi.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{kpi.kpiName}</div>
                        {kpi.linkedOrgKpi?.kpiName ? (
                          <div className="mt-1 text-xs text-blue-600">연결 조직 KPI: {kpi.linkedOrgKpi.kpiName}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{KPI_TYPE_LABELS[kpi.kpiType]}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {kpi.targetValue ? `${kpi.targetValue} ${kpi.unit || ''}` : '-'}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">{kpi.weight}%</td>
                      <td className="px-5 py-4 text-slate-600">{DIFFICULTY_LABELS[kpi.difficulty]}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${
                                rate >= 100 ? 'bg-emerald-500' : rate >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:hidden">
            {kpis.map((kpi) => {
              const rate = kpi.monthlyRecords?.[kpi.monthlyRecords.length - 1]?.achievementRate || 0
              return (
                <article key={kpi.id} className="touch-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">{kpi.kpiName}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {KPI_TYPE_LABELS[kpi.kpiType]} · {DIFFICULTY_LABELS[kpi.difficulty]}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {kpi.weight}%
                    </span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <p>목표값: {kpi.targetValue ? `${kpi.targetValue} ${kpi.unit || ''}` : '-'}</p>
                    {kpi.linkedOrgKpi?.kpiName ? <p>연결 조직 KPI: {kpi.linkedOrgKpi.kpiName}</p> : null}
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>최근 달성률</span>
                        <span>{rate}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            rate >= 100 ? 'bg-emerald-500' : rate >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-5 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-600/30 transition hover:scale-[1.02] hover:bg-blue-700 sm:hidden"
        aria-label="KPI 추가"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {showForm ? (
        <KpiForm
          orgKpis={orgKpis}
          currentWeight={totalWeight}
          isPending={createMutation.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={(form) => createMutation.mutate(form)}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'ok' | 'mid' | 'warn'
}) {
  const accentClass =
    accent === 'ok'
      ? 'from-emerald-50 to-white text-emerald-700'
      : accent === 'warn'
        ? 'from-amber-50 to-white text-amber-700'
        : 'from-blue-50 to-white text-blue-700'

  return (
    <div className={`touch-card bg-gradient-to-br ${accentClass} p-5`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function KpiForm({
  orgKpis,
  currentWeight,
  isPending,
  onClose,
  onSubmit,
}: {
  orgKpis: OrgKpi[]
  currentWeight: number
  isPending: boolean
  onClose: () => void
  onSubmit: (form: KpiFormState) => void
}) {
  const [form, setForm] = useState<KpiFormState>(EMPTY_FORM)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)

  const selectedOrgKpi = orgKpis.find((item) => item.id === form.linkedOrgKpiId)
  const remainingWeight = Math.max(0, 100 - currentWeight)

  const aiMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'KPI_ASSIST',
          sourceType: 'PersonalKpiDraft',
          sourceId: 'new',
          payload: {
            kpiType: form.kpiType,
            kpiName: form.kpiName,
            definition: form.definition,
            formula: form.formula,
            targetValue: form.targetValue,
            unit: form.unit,
            weight: form.weight,
            difficulty: form.difficulty,
            orgKpiName: selectedOrgKpi?.kpiName,
            orgKpiCategory: selectedOrgKpi?.kpiCategory,
            summary: form.definition || `조직 KPI ${selectedOrgKpi?.kpiName || '미연결'}에 맞춘 KPI 작성 요청`,
          },
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI KPI 초안을 생성하지 못했습니다.')
      }
      return json.data as AiPreview
    },
    onSuccess: (data) => {
      setAiPreview(data)
    },
  })

  const decisionMutation = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!aiPreview?.requestLogId) {
        return null
      }

      const res = await fetch(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? aiPreview.result : undefined,
          rejectionReason: action === 'reject' ? 'User dismissed the generated KPI draft.' : undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 승인 처리에 실패했습니다.')
      }
      return json.data
    },
  })

  const applyAiDraft = async () => {
    if (!aiPreview) return
    await decisionMutation.mutateAsync('approve')
    setForm((current) => ({
      ...current,
      kpiName: aiPreview.result.kpiName || current.kpiName,
      definition: aiPreview.result.definition || current.definition,
      formula: aiPreview.result.formula || current.formula,
      targetValue: aiPreview.result.targetValueSuggestion || current.targetValue,
      unit: aiPreview.result.unitSuggestion || current.unit,
      weight: String(aiPreview.result.weightSuggestion || current.weight),
      difficulty: aiPreview.result.difficultySuggestion || current.difficulty,
    }))
  }

  const rejectAiDraft = async () => {
    if (!aiPreview) return
    await decisionMutation.mutateAsync('reject')
    setAiPreview(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (Number(form.weight || 0) > remainingWeight) {
      alert(`추가 가능한 가중치는 최대 ${remainingWeight}%입니다.`)
      return
    }

    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm">
      <div className="flex h-full items-end justify-center p-0 sm:items-center sm:p-6">
        <div className="mobile-sheet flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden bg-white sm:h-[90vh] sm:rounded-[2rem]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Create KPI</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">KPI 초안 작성</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_380px]">
            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TypeButton
                    active={form.kpiType === 'QUANTITATIVE'}
                    label="정량 KPI"
                    onClick={() => setForm((current) => ({ ...current, kpiType: 'QUANTITATIVE' }))}
                  />
                  <TypeButton
                    active={form.kpiType === 'QUALITATIVE'}
                    label="정성 KPI"
                    onClick={() => setForm((current) => ({ ...current, kpiType: 'QUALITATIVE' }))}
                  />
                </div>

                <Field label="KPI명" required>
                  <input
                    value={form.kpiName}
                    onChange={(event) => setForm((current) => ({ ...current, kpiName: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                    placeholder="예: 핵심 기능 릴리스 적시 완료율"
                    required
                  />
                </Field>

                <Field label="정의">
                  <textarea
                    value={form.definition}
                    onChange={(event) => setForm((current) => ({ ...current, definition: event.target.value }))}
                    className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                    placeholder="성과 의미, 측정 기준, 평가 시 고려할 범위를 입력하세요."
                  />
                </Field>

                <Field label="산식 또는 측정 방식">
                  <textarea
                    value={form.formula}
                    onChange={(event) => setForm((current) => ({ ...current, formula: event.target.value }))}
                    className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                    placeholder="예: 실적 / 목표 x 100"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="목표값">
                    <input
                      value={form.targetValue}
                      onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                      placeholder="예: 95"
                    />
                  </Field>
                  <Field label="단위">
                    <input
                      value={form.unit}
                      onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                      placeholder="예: %, 건, 점수"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={`가중치 (최대 ${remainingWeight}%)`} required>
                    <input
                      type="number"
                      min={1}
                      max={remainingWeight}
                      value={form.weight}
                      onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                      placeholder="예: 20"
                      required
                    />
                  </Field>
                  <Field label="난이도" required>
                    <select
                      value={form.difficulty}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          difficulty: event.target.value as KpiFormState['difficulty'],
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                    >
                      <option value="HIGH">상</option>
                      <option value="MEDIUM">중</option>
                      <option value="LOW">하</option>
                    </select>
                  </Field>
                </div>

                <Field label="연결 조직 KPI">
                  <select
                    value={form.linkedOrgKpiId}
                    onChange={(event) => setForm((current) => ({ ...current, linkedOrgKpiId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400"
                  >
                    <option value="">선택 안 함</option>
                    {orgKpis.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.kpiName}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => aiMutation.mutate()}
                    disabled={aiMutation.isPending}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                  >
                    <Wand2 className="h-4 w-4" />
                    {aiMutation.isPending ? 'AI 초안 생성 중...' : 'AI 초안 만들기'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isPending ? '저장 중...' : 'KPI 저장'}
                  </button>
                </div>
              </form>
            </div>

            <aside className="overflow-y-auto border-t border-slate-100 bg-slate-50/70 px-5 py-5 lg:border-l lg:border-t-0">
              <div className="touch-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Human In The Loop
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">AI 제안 미리보기</h3>
                <p className="mt-2 text-sm text-slate-500">
                  생성된 초안은 자동 저장되지 않습니다. 검토 후 승인해야 폼에 반영됩니다.
                </p>
              </div>

              {aiPreview ? (
                <div className="mt-4 space-y-4">
                  <div
                    className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
                      aiPreview.source === 'ai'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {aiPreview.source === 'ai'
                      ? 'OpenAI Responses API 구조화 출력으로 생성된 초안입니다.'
                      : `AI 비활성화 또는 응답 실패로 기본 제안을 제공합니다. ${
                          aiPreview.fallbackReason ? `(${aiPreview.fallbackReason})` : ''
                        }`}
                  </div>

                  <div className="touch-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-slate-900">{aiPreview.result.kpiName}</h4>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {aiPreview.result.weightSuggestion}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{aiPreview.result.definition}</p>
                    <dl className="mt-4 space-y-3 text-sm text-slate-600">
                      <div>
                        <dt className="font-semibold text-slate-900">산식</dt>
                        <dd className="mt-1">{aiPreview.result.formula}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-900">목표/단위</dt>
                        <dd className="mt-1">
                          {aiPreview.result.targetValueSuggestion} / {aiPreview.result.unitSuggestion}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-900">매니저 검토 포인트</dt>
                        <dd className="mt-2 space-y-2">
                          {aiPreview.result.managerReviewPoints.map((item) => (
                            <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2">
                              {item}
                            </div>
                          ))}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="touch-card p-5">
                    <h4 className="text-sm font-semibold text-slate-900">SMART 체크</h4>
                    <div className="mt-3 space-y-2">
                      {aiPreview.result.smartChecks.map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl bg-blue-50 px-3 py-3 text-sm text-blue-700">
                          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            ✓
                          </span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={applyAiDraft}
                      disabled={decisionMutation.isPending}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      승인 후 반영
                    </button>
                    <button
                      type="button"
                      onClick={rejectAiDraft}
                      disabled={decisionMutation.isPending}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      제안 닫기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 touch-card p-6 text-sm text-slate-500">
                  조직 KPI를 연결하거나 핵심 목표를 입력한 뒤 AI 초안을 생성해 보세요. 기능이 비활성화되어도
                  기본 템플릿 제안이 동일한 위치에 표시됩니다.
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function TypeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-2xl border px-4 text-sm font-semibold transition ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
      }`}
    >
      {label}
    </button>
  )
}
