'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BriefcaseBusiness, FilePenLine, Link2, Plus, Target, Weight } from 'lucide-react'
import { DIFFICULTY_LABELS, formatDate, getCurrentYear, KPI_TYPE_LABELS } from '@/lib/utils'

type DepartmentOption = {
  id: string
  deptCode: string
  deptName: string
  orgId: string
  organization: {
    name: string
  }
}

type KpiStatus = 'DRAFT' | 'CONFIRMED' | 'ARCHIVED'

type LinkedPersonalKpi = {
  id: string
  kpiName: string
  status: KpiStatus
  employee: {
    empId: string
    empName: string
  }
}

type OrgKpiAuditLog = {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  timestamp: string
}

type OrgKpiItem = {
  id: string
  deptId: string
  evalYear: number
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiCategory: string
  kpiName: string
  definition: string | null
  formula: string | null
  targetValue: number | null
  unit: string | null
  weight: number
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
  status: KpiStatus
  createdAt: string
  updatedAt: string
  department: {
    deptName: string
    deptCode: string
  }
  personalKpis: LinkedPersonalKpi[]
  _count?: {
    personalKpis: number
  }
}

type OrgKpiDetail = OrgKpiItem & {
  auditLogs: OrgKpiAuditLog[]
}

type OrgKpiFormState = {
  deptId: string
  evalYear: string
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiCategory: string
  kpiName: string
  definition: string
  formula: string
  targetValue: string
  unit: string
  weight: string
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
}

type FeedbackState = {
  tone: 'success' | 'error'
  message: string
} | null

const STATUS_LABELS: Record<KpiStatus, string> = {
  DRAFT: '초안',
  CONFIRMED: '확정',
  ARCHIVED: '보관',
}

const EMPTY_FORM = (departments: DepartmentOption[]): OrgKpiFormState => ({
  deptId: departments[0]?.id || '',
  evalYear: String(getCurrentYear()),
  kpiType: 'QUANTITATIVE',
  kpiCategory: '',
  kpiName: '',
  definition: '',
  formula: '',
  targetValue: '',
  unit: '',
  weight: '',
  difficulty: 'MEDIUM',
})

function buildFormFromKpi(kpi: OrgKpiItem): OrgKpiFormState {
  return {
    deptId: kpi.deptId,
    evalYear: String(kpi.evalYear),
    kpiType: kpi.kpiType,
    kpiCategory: kpi.kpiCategory,
    kpiName: kpi.kpiName,
    definition: kpi.definition ?? '',
    formula: kpi.formula ?? '',
    targetValue: kpi.targetValue !== null ? String(kpi.targetValue) : '',
    unit: kpi.unit ?? '',
    weight: String(kpi.weight),
    difficulty: kpi.difficulty,
  }
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return payload.data as T
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

function difficultyClass(value: OrgKpiItem['difficulty']) {
  if (value === 'HIGH') return 'bg-rose-100 text-rose-700'
  if (value === 'LOW') return 'bg-emerald-100 text-emerald-700'
  return 'bg-amber-100 text-amber-700'
}

function statusClass(status: KpiStatus) {
  if (status === 'CONFIRMED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-700'
  return 'bg-blue-100 text-blue-700'
}

export function OrgKpiManagementClient({
  initialKpis,
  departments,
}: {
  initialKpis: OrgKpiItem[]
  departments: DepartmentOption[]
}) {
  const queryClient = useQueryClient()
  const currentYear = getCurrentYear()
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedDeptId, setSelectedDeptId] = useState<'ALL' | string>('ALL')
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(initialKpis[0]?.id ?? null)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [form, setForm] = useState<OrgKpiFormState>(() => EMPTY_FORM(departments))

  const kpisQuery = useQuery({
    queryKey: ['org-kpis', selectedYear, selectedDeptId],
    queryFn: async () => {
      const params = new URLSearchParams({ evalYear: String(selectedYear) })
      if (selectedDeptId !== 'ALL') params.set('deptId', selectedDeptId)
      const res = await fetch(`/api/kpi/org?${params.toString()}`)
      return parseResponse<OrgKpiItem[]>(await res.json())
    },
    initialData: initialKpis,
  })

  const createMutation = useMutation({
    mutationFn: async (input: OrgKpiFormState) => {
      const res = await fetch('/api/kpi/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: input.deptId,
          evalYear: Number(input.evalYear),
          kpiType: input.kpiType,
          kpiCategory: input.kpiCategory,
          kpiName: input.kpiName,
          definition: input.definition || undefined,
          formula: input.formula || undefined,
          targetValue: input.targetValue ? Number(input.targetValue) : undefined,
          unit: input.unit || undefined,
          weight: Number(input.weight),
          difficulty: input.difficulty,
        }),
      })
      return parseResponse<OrgKpiItem>(await res.json())
    },
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '조직 KPI가 등록되었습니다.' })
      setForm((current) => ({ ...EMPTY_FORM(departments), deptId: current.deptId, evalYear: current.evalYear }))
      setEditingKpiId(null)
      await queryClient.invalidateQueries({ queryKey: ['org-kpis'] })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; form: OrgKpiFormState }) => {
      const res = await fetch(`/api/kpi/org/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: input.form.deptId,
          evalYear: Number(input.form.evalYear),
          kpiType: input.form.kpiType,
          kpiCategory: input.form.kpiCategory,
          kpiName: input.form.kpiName,
          definition: input.form.definition,
          formula: input.form.formula,
          targetValue: input.form.targetValue ? Number(input.form.targetValue) : null,
          unit: input.form.unit,
          weight: Number(input.form.weight),
          difficulty: input.form.difficulty,
        }),
      })
      return parseResponse<OrgKpiItem>(await res.json())
    },
    onSuccess: async () => {
      setFeedback({ tone: 'success', message: '조직 KPI가 수정되었습니다.' })
      setEditingKpiId(null)
      setForm(EMPTY_FORM(departments))
      await queryClient.invalidateQueries({ queryKey: ['org-kpis'] })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: KpiStatus }) => {
      const res = await fetch(`/api/kpi/org/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      })
      return parseResponse<OrgKpiItem>(await res.json())
    },
    onSuccess: async (_, variables) => {
      setFeedback({ tone: 'success', message: `조직 KPI 상태가 ${STATUS_LABELS[variables.status]}로 변경되었습니다.` })
      await queryClient.invalidateQueries({ queryKey: ['org-kpis'] })
    },
    onError: (error: Error) => setFeedback({ tone: 'error', message: error.message }),
  })

  const kpis = useMemo(() => kpisQuery.data ?? [], [kpisQuery.data])
  const selectedKpi = kpis.find((item) => item.id === selectedKpiId) ?? kpis[0] ?? null
  const selectedKpiDetailQuery = useQuery({
    queryKey: ['org-kpi-detail', selectedKpi?.id],
    enabled: !!selectedKpi?.id,
    queryFn: async () => {
      const res = await fetch(`/api/kpi/org/${selectedKpi?.id}`)
      return parseResponse<OrgKpiDetail>(await res.json())
    },
  })

  const metrics = useMemo(() => {
    const totalWeight = kpis.reduce((sum, item) => sum + item.weight, 0)
    const linkedCount = kpis.reduce((sum, item) => sum + (item._count?.personalKpis ?? 0), 0)
    const confirmedCount = kpis.filter((item) => item.status === 'CONFIRMED').length
    return {
      total: kpis.length,
      weight: `${Math.round(totalWeight * 10) / 10}%`,
      confirmed: `${confirmedCount}개`,
      linkedCount,
    }
  }, [kpis])

  const departmentWeightMap = useMemo(() => {
    const map = new Map<string, { deptName: string; weight: number; count: number }>()
    kpis.forEach((item) => {
      const current = map.get(item.deptId)
      if (current) {
        current.weight += item.weight
        current.count += 1
      } else {
        map.set(item.deptId, { deptName: item.department.deptName, weight: item.weight, count: 1 })
      }
    })
    return Array.from(map.values()).sort((a, b) => b.weight - a.weight)
  }, [kpis])

  const yearOptions = useMemo(() => {
    const fromKpis = initialKpis.map((item) => item.evalYear)
    const values = new Set([currentYear - 1, currentYear, currentYear + 1, ...fromKpis])
    return Array.from(values).sort((a, b) => b - a)
  }, [currentYear, initialKpis])

  const selectedKpiForDetail = selectedKpiDetailQuery.data ?? selectedKpi
  const selectedLinkSummary = useMemo(() => {
    if (!selectedKpiForDetail) return { total: 0, confirmed: 0, draft: 0, archived: 0 }
    return selectedKpiForDetail.personalKpis.reduce(
      (summary, item) => {
        summary.total += 1
        if (item.status === 'CONFIRMED') summary.confirmed += 1
        if (item.status === 'DRAFT') summary.draft += 1
        if (item.status === 'ARCHIVED') summary.archived += 1
        return summary
      },
      { total: 0, confirmed: 0, draft: 0, archived: 0 }
    )
  }, [selectedKpiForDetail])

  const formBusy = createMutation.isPending || updateMutation.isPending
  const canEditSelectedKpi = selectedKpiForDetail ? selectedKpiForDetail.status === 'DRAFT' : false
  const canUnlockSelectedKpi = selectedKpiForDetail
    ? selectedKpiForDetail.status === 'ARCHIVED' ||
      (selectedKpiForDetail.status === 'CONFIRMED' && selectedLinkSummary.confirmed === 0)
    : false

  return (
    <div className="space-y-6">
      <section className="touch-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">Organization KPI</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">조직 KPI 관리</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              부서별 KPI를 등록하고, 수정하고, 초안에서 확정까지 상태를 관리합니다. 연결된 개인 KPI 목록도 함께 보여 주어 cascade 상태를 바로 확인할 수 있게 했습니다.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            부서별 총 가중치와 개인 KPI 연결 수를 함께 확인해 cascade 품질을 점검하세요.
          </div>
        </div>
      </section>

      {feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{feedback.message}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Target className="h-5 w-5" />} label="조회 KPI 수" value={`${metrics.total}개`} />
        <MetricCard icon={<Weight className="h-5 w-5" />} label="가중치 합계" value={metrics.weight} />
        <MetricCard icon={<BriefcaseBusiness className="h-5 w-5" />} label="확정 KPI" value={metrics.confirmed} />
        <MetricCard icon={<Link2 className="h-5 w-5" />} label="개인 KPI 연결 수" value={`${metrics.linkedCount}건`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,460px)]">
        <section className="touch-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">조직 KPI 목록</h2>
              <p className="mt-1 text-sm text-slate-500">연도와 부서 기준으로 KPI를 조회하고, 확정 상태와 연결 수를 함께 확인합니다.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                {yearOptions.map((year) => <option key={year} value={year}>{year}년</option>)}
              </select>
              <select value={selectedDeptId} onChange={(event) => setSelectedDeptId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="ALL">전체 부서</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.deptName}</option>)}
              </select>
            </div>
          </div>

          {kpisQuery.isLoading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">조직 KPI를 불러오는 중입니다.</div>
          ) : !kpis.length ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">조건에 맞는 조직 KPI가 없습니다.</div>
          ) : (
            <div className="mt-6 space-y-4">
              {kpis.map((kpi) => (
                <button key={kpi.id} type="button" onClick={() => setSelectedKpiId(kpi.id)} className={`w-full rounded-3xl border p-5 text-left transition ${selectedKpi?.id === kpi.id ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{kpi.kpiName}</h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{KPI_TYPE_LABELS[kpi.kpiType]}</span>
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">{kpi.kpiCategory}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(kpi.status)}`}>{STATUS_LABELS[kpi.status]}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{kpi.department.deptName} ({kpi.department.deptCode})</p>
                    </div>
                    <div className="text-sm text-slate-500">연결 개인 KPI {kpi._count?.personalKpis ?? 0}건</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">목표값</p><p className="mt-1 text-sm font-medium text-slate-800">{kpi.targetValue !== null ? `${kpi.targetValue}${kpi.unit ? ` ${kpi.unit}` : ''}` : '정성 KPI'}</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">가중치</p><p className="mt-1 text-sm font-medium text-slate-800">{kpi.weight}%</p></div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">난이도</p><p className="mt-1"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${difficultyClass(kpi.difficulty)}`}>{DIFFICULTY_LABELS[kpi.difficulty]}</span></p></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="touch-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">부서별 가중치 현황</h2>
            <p className="mt-1 text-sm text-slate-500">현재 조회 조건 내 KPI의 가중치 분포입니다.</p>
            {!departmentWeightMap.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">표시할 부서 데이터가 없습니다.</div>
            ) : (
              <div className="mt-5 space-y-3">
                {departmentWeightMap.map((department) => <div key={department.deptName} className="rounded-2xl bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">{department.deptName}</p><p className="text-xs text-slate-500">KPI {department.count}개</p></div><p className="text-sm font-semibold text-slate-900">{Math.round(department.weight * 10) / 10}%</p></div></div>)}
              </div>
            )}
          </section>

          <section className="touch-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">선택 KPI 상세 / 연결 시각화</h2>
            {!selectedKpi ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">선택된 KPI가 없습니다.</div>
            ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{selectedKpi.kpiName}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{KPI_TYPE_LABELS[selectedKpi.kpiType]}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(selectedKpi.status)}`}>{STATUS_LABELS[selectedKpi.status]}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{selectedKpi.department.deptName} · {selectedKpi.evalYear}년</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!canEditSelectedKpi} onClick={() => {
                    if (!canEditSelectedKpi) {
                      setFeedback({ tone: 'error', message: '확정 또는 보관된 조직 KPI는 먼저 초안으로 전환해야 수정할 수 있습니다.' })
                      return
                    }
                    setEditingKpiId(selectedKpi.id)
                    setForm(buildFormFromKpi(selectedKpi))
                  }} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FilePenLine className="mr-2 h-4 w-4" />이 KPI 편집</button>
                  {(['DRAFT', 'CONFIRMED', 'ARCHIVED'] as KpiStatus[]).map((status) => (
                    <button key={status} type="button" disabled={statusMutation.isPending || selectedKpi.status === status || (status === 'DRAFT' && !canUnlockSelectedKpi)} onClick={() => {
                      if (status === 'DRAFT' && !canUnlockSelectedKpi) {
                        setFeedback({ tone: 'error', message: selectedKpi.status === 'CONFIRMED' ? '연결된 확정 개인 KPI가 있으면 초안으로 되돌릴 수 없습니다.' : '현재 상태에서는 초안으로 되돌릴 수 없습니다.' })
                        return
                      }
                      statusMutation.mutate({ id: selectedKpi.id, status })
                    }} className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium disabled:opacity-60 ${status === 'CONFIRMED' ? 'bg-emerald-600 text-white' : status === 'ARCHIVED' ? 'bg-slate-700 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{status === 'DRAFT' ? '초안으로' : status === 'CONFIRMED' ? '확정' : '보관'}</button>
                  ))}
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><p className="font-medium text-slate-800">정의</p><p className="mt-1">{selectedKpi.definition || '등록된 설명이 없습니다.'}</p></div>
                {selectedKpiForDetail?.status !== 'DRAFT' ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{selectedKpiForDetail?.status === 'CONFIRMED' ? canUnlockSelectedKpi ? '확정된 조직 KPI입니다. 수정하려면 먼저 초안으로 되돌리세요.' : '확정된 조직 KPI이며 연결된 확정 개인 KPI가 있어 초안 해제가 잠겨 있습니다.' : '보관된 조직 KPI입니다. 수정하려면 먼저 초안으로 되돌리세요.'}</div> : null}
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><p className="font-medium text-slate-800">산식 / 기준</p><p className="mt-1">{selectedKpi.formula || '등록된 산식이 없습니다.'}</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">목표값</p><p className="mt-1 text-sm font-semibold text-slate-900">{selectedKpi.targetValue !== null ? `${selectedKpi.targetValue}${selectedKpi.unit ? ` ${selectedKpi.unit}` : ''}` : '정성 KPI'}</p></div>
                  <div className="rounded-2xl border border-slate-200 px-4 py-3"><p className="text-xs text-slate-500">연결 개인 KPI</p><p className="mt-1 text-sm font-semibold text-slate-900">{selectedKpi._count?.personalKpis ?? 0}건</p></div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">연결 시각화</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs text-slate-500">전체</p><p className="mt-1 text-sm font-semibold text-slate-900">{selectedLinkSummary.total}건</p></div>
                    <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs text-slate-500">확정 개인 KPI</p><p className="mt-1 text-sm font-semibold text-emerald-700">{selectedLinkSummary.confirmed}건</p></div>
                    <div className="rounded-2xl bg-white px-4 py-3"><p className="text-xs text-slate-500">초안/보관</p><p className="mt-1 text-sm font-semibold text-slate-900">{selectedLinkSummary.draft + selectedLinkSummary.archived}건</p></div>
                  </div>
                  {!selectedKpiForDetail?.personalKpis.length ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">아직 연결된 개인 KPI가 없습니다.</div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {selectedKpiForDetail?.personalKpis.map((linked) => <div key={linked.id} className="rounded-2xl bg-white px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-slate-900">{linked.employee.empName}</p><p className="mt-1 text-xs text-slate-500">{linked.employee.empId} · {linked.kpiName}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(linked.status)}`}>{STATUS_LABELS[linked.status]}</span></div></div>)}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">확정 이력 / 승인 로그</p>
                  {selectedKpiDetailQuery.isLoading ? (
                    <div className="mt-4 text-sm text-slate-500">이력을 불러오는 중입니다.</div>
                  ) : !selectedKpiDetailQuery.data?.auditLogs?.length ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">기록된 로그가 없습니다.</div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {selectedKpiDetailQuery.data.auditLogs.map((log) => (
                        <div key={log.id} className="rounded-2xl bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{log.action}</p>
                            <p className="text-xs text-slate-500">{formatDate(log.timestamp)}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">사용자 ID: {log.userId}</p>
                          {typeof log.oldValue?.status === 'string' || typeof log.newValue?.status === 'string' ? (
                            <p className="mt-2 text-xs text-slate-600">
                              상태 {String(log.oldValue?.status ?? '-')} {'->'} {String(log.newValue?.status ?? '-')}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400">마지막 수정일 {formatDate(selectedKpi.updatedAt)}</p>
              </div>
            )}
          </section>

          <section className="touch-card p-6">
            <div className="flex items-center gap-2">
              {editingKpiId ? <FilePenLine className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
              <h2 className="text-lg font-semibold text-slate-900">{editingKpiId ? '조직 KPI 편집' : '새 조직 KPI 등록'}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">현재 API가 허용하는 범위에서 기본 KPI 정보와 목표값, 가중치를 등록하거나 수정합니다.</p>
            {!departments.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">등록된 부서가 없어 조직 KPI를 생성할 수 없습니다.</div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={(event) => {
                event.preventDefault()
                setFeedback(null)
                if (!form.deptId) return setFeedback({ tone: 'error', message: '대상 부서를 선택해 주세요.' })
                if (!form.kpiCategory.trim()) return setFeedback({ tone: 'error', message: 'KPI 카테고리를 입력해 주세요.' })
                if (!form.kpiName.trim()) return setFeedback({ tone: 'error', message: 'KPI명을 입력해 주세요.' })
                if (!form.weight) return setFeedback({ tone: 'error', message: '가중치를 입력해 주세요.' })
                if (editingKpiId) return updateMutation.mutate({ id: editingKpiId, form })
                createMutation.mutate(form)
              }}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">부서</span><select value={form.deptId} onChange={(event) => setForm((current) => ({ ...current, deptId: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">{departments.map((department) => <option key={department.id} value={department.id}>{department.deptName}</option>)}</select></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">평가 연도</span><input type="number" value={form.evalYear} onChange={(event) => setForm((current) => ({ ...current, evalYear: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">KPI 유형</span><select value={form.kpiType} onChange={(event) => setForm((current) => ({ ...current, kpiType: event.target.value as OrgKpiFormState['kpiType'] }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="QUANTITATIVE">정량</option><option value="QUALITATIVE">정성</option></select></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">난이도</span><select value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as OrgKpiFormState['difficulty'] }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="HIGH">상</option><option value="MEDIUM">중</option><option value="LOW">하</option></select></label>
                </div>
                <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">KPI 카테고리</span><input value={form.kpiCategory} onChange={(event) => setForm((current) => ({ ...current, kpiCategory: event.target.value }))} placeholder="예: 매출, 품질, 운영 효율" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">KPI명</span><input value={form.kpiName} onChange={(event) => setForm((current) => ({ ...current, kpiName: event.target.value }))} placeholder="예: 핵심 고객 유지율 향상" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">정의</span><textarea value={form.definition} onChange={(event) => setForm((current) => ({ ...current, definition: event.target.value }))} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="KPI의 목적과 해석 기준을 입력합니다." /></label>
                <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">산식 / 기준</span><textarea value={form.formula} onChange={(event) => setForm((current) => ({ ...current, formula: event.target.value }))} rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="예: 유지 고객 수 / 대상 고객 수 * 100" /></label>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">목표값</span><input type="number" value={form.targetValue} onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">단위</span><input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} placeholder="% / 건 / 점" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">가중치</span><input type="number" value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} placeholder="0~100" className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={formBusy} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{formBusy ? '저장 중...' : editingKpiId ? '수정 저장' : '조직 KPI 등록'}</button>
                  {editingKpiId ? <button type="button" onClick={() => { setEditingKpiId(null); setForm(EMPTY_FORM(departments)) }} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50">편집 취소</button> : null}
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
