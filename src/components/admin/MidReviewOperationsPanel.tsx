'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, LoaderCircle, RefreshCcw, Sparkles, Users } from 'lucide-react'

type DepartmentOption = {
  id: string
  name: string
}

type MidReviewCycleViewModel = {
  id: string
  name: string
  reviewType: 'ALIGNMENT' | 'RETROSPECTIVE' | 'ASSESSMENT' | 'DEVELOPMENT'
  reviewTypeLabel: string
  workflowMode: 'LEADER_ONLY' | 'SELF_THEN_LEADER'
  workflowModeLabel: string
  scopeTargetKind: 'DEPARTMENT' | 'EMPLOYEE'
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
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
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

type MidReviewCycleFormState = {
  name: string
  reviewType: MidReviewCycleViewModel['reviewType']
  workflowMode: MidReviewCycleViewModel['workflowMode']
  scopeTargetKind: MidReviewCycleViewModel['scopeTargetKind']
  scopeDepartmentId: string
  includeDescendants: boolean
  startsAt: string
  selfDueAt: string
  leaderDueAt: string
  closesAt: string
  status: MidReviewCycleViewModel['status']
  peopleReviewEnabled: boolean
  expectationTemplateEnabled: boolean
}

const REVIEW_TYPE_OPTIONS = [
  { value: 'ALIGNMENT', label: '정렬형' },
  { value: 'RETROSPECTIVE', label: '회고형' },
  { value: 'ASSESSMENT', label: '평가형' },
  { value: 'DEVELOPMENT', label: '발전형' },
] as const

const WORKFLOW_OPTIONS = [
  { value: 'LEADER_ONLY', label: '리더 단독 점검' },
  { value: 'SELF_THEN_LEADER', label: '구성원 작성 후 리더 검토' },
] as const

const SCOPE_OPTIONS = [
  { value: 'DEPARTMENT', label: '조직' },
  { value: 'EMPLOYEE', label: '개인' },
] as const

function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function createInitialForm(cycleName?: string): MidReviewCycleFormState {
  return {
    name: cycleName ? `${cycleName} 중간 점검` : '중간 점검',
    reviewType: 'ALIGNMENT',
    workflowMode: 'LEADER_ONLY',
    scopeTargetKind: 'DEPARTMENT',
    scopeDepartmentId: '',
    includeDescendants: true,
    startsAt: '',
    selfDueAt: '',
    leaderDueAt: '',
    closesAt: '',
    status: 'DRAFT',
    peopleReviewEnabled: false,
    expectationTemplateEnabled: true,
  }
}

export function MidReviewOperationsPanel({
  cycleId,
  cycleName,
  departments,
}: {
  cycleId?: string
  cycleName?: string
  departments: DepartmentOption[]
}) {
  const [cycles, setCycles] = useState<MidReviewCycleViewModel[]>([])
  const [form, setForm] = useState<MidReviewCycleFormState>(() => createInitialForm(cycleName))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')

  useEffect(() => {
    setForm(createInitialForm(cycleName))
  }, [cycleName])

  const loadCycles = useCallback(async () => {
    if (!cycleId) {
      setCycles([])
      return
    }

    try {
      setLoading(true)
      setErrorNotice('')
      const response = await fetch(`/api/admin/performance-design/${encodeURIComponent(cycleId)}/mid-review`)
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json?.error?.message ?? '중간 점검 운영 정보를 불러오지 못했습니다.')
      }
      setCycles(json.data)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '중간 점검 운영 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => {
    void loadCycles()
  }, [loadCycles])

  const canSubmit = useMemo(() => {
    if (!cycleId) return false
    if (!form.name.trim()) return false
    if (form.scopeTargetKind === 'DEPARTMENT' && !form.scopeDepartmentId) return false
    if (form.workflowMode === 'SELF_THEN_LEADER' && !form.selfDueAt) return false
    return true
  }, [cycleId, form])

  async function handleCreate() {
    if (!cycleId || !canSubmit) return

    try {
      setSaving(true)
      setErrorNotice('')
      const response = await fetch(`/api/admin/performance-design/${encodeURIComponent(cycleId)}/mid-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          reviewType: form.reviewType,
          workflowMode: form.workflowMode,
          scopeTargetKind: form.scopeTargetKind,
          scopeDepartmentId: form.scopeDepartmentId || null,
          includeDescendants: form.includeDescendants,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          selfDueAt: form.selfDueAt ? new Date(form.selfDueAt).toISOString() : null,
          leaderDueAt: form.leaderDueAt ? new Date(form.leaderDueAt).toISOString() : null,
          closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
          status: form.status,
          peopleReviewEnabled: form.peopleReviewEnabled,
          expectationTemplateEnabled: form.expectationTemplateEnabled,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json?.error?.message ?? '중간 점검 주기를 생성하지 못했습니다.')
      }

      setCycles(json.data.cycles)
      setForm(createInitialForm(cycleName))
      setNotice('중간 점검 주기를 생성했습니다. 연결된 체크인 배정도 함께 준비되었습니다.')
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '중간 점검 주기를 생성하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(targetId: string, status: MidReviewCycleViewModel['status']) {
    if (!cycleId) return

    try {
      setSaving(true)
      setErrorNotice('')
      const response = await fetch(
        `/api/admin/performance-design/${encodeURIComponent(cycleId)}/mid-review/${encodeURIComponent(targetId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      )
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json?.error?.message ?? '중간 점검 상태를 변경하지 못했습니다.')
      }

      await loadCycles()
      setNotice('중간 점검 운영 상태를 업데이트했습니다.')
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '중간 점검 상태를 변경하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Mid Review Ops</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">중간 점검 운영</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            KPI, 월간 실적, 체크인, 평가 근거를 연결해 목표 유효성 재설계와 기대/판단 기준 합의를 운영합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCycles()}
          disabled={!cycleId || loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          새로고침
        </button>
      </div>

      {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
      {errorNotice ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorNotice}</p> : null}

      {!cycleId ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          먼저 평가 주기를 선택해 주세요.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="중간 점검 이름">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label="중간 점검 유형">
                <select
                  value={form.reviewType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      reviewType: event.target.value as MidReviewCycleFormState['reviewType'],
                      workflowMode:
                        event.target.value === 'ALIGNMENT' || event.target.value === 'RETROSPECTIVE'
                          ? 'LEADER_ONLY'
                          : form.workflowMode,
                      scopeTargetKind:
                        event.target.value === 'ALIGNMENT' || event.target.value === 'RETROSPECTIVE'
                          ? 'DEPARTMENT'
                          : form.scopeTargetKind,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  {REVIEW_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="운영 방식">
                <select
                  value={form.workflowMode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      workflowMode: event.target.value as MidReviewCycleFormState['workflowMode'],
                    })
                  }
                  disabled={form.reviewType === 'ALIGNMENT' || form.reviewType === 'RETROSPECTIVE'}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
                >
                  {WORKFLOW_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="대상 범위">
                <select
                  value={form.scopeTargetKind}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      scopeTargetKind: event.target.value as MidReviewCycleFormState['scopeTargetKind'],
                    })
                  }
                  disabled={form.reviewType === 'ALIGNMENT' || form.reviewType === 'RETROSPECTIVE'}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
                >
                  {SCOPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="기준 조직">
                <select
                  value={form.scopeDepartmentId}
                  onChange={(event) => setForm({ ...form, scopeDepartmentId: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="">조직을 선택해 주세요</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="운영 상태">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as MidReviewCycleFormState['status'] })
                  }
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                >
                  <option value="DRAFT">준비 중</option>
                  <option value="ACTIVE">진행 중</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="시작일">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label="구성원 마감일">
                <input
                  type="datetime-local"
                  value={form.selfDueAt}
                  onChange={(event) => setForm({ ...form, selfDueAt: event.target.value })}
                  disabled={form.workflowMode === 'LEADER_ONLY'}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm disabled:bg-slate-50"
                />
              </Field>
              <Field label="리더 마감일">
                <input
                  type="datetime-local"
                  value={form.leaderDueAt}
                  onChange={(event) => setForm({ ...form, leaderDueAt: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </Field>
              <Field label="종료일">
                <input
                  type="datetime-local"
                  value={form.closesAt}
                  onChange={(event) => setForm({ ...form, closesAt: event.target.value })}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <CheckBoxCard
                title="하위 조직 포함"
                checked={form.includeDescendants}
                onChange={(checked) => setForm({ ...form, includeDescendants: checked })}
                icon={<Users className="h-4 w-4" />}
              />
              <CheckBoxCard
                title="기대 상태/판단 기준 템플릿"
                checked={form.expectationTemplateEnabled}
                onChange={(checked) => setForm({ ...form, expectationTemplateEnabled: checked })}
                icon={<Sparkles className="h-4 w-4" />}
              />
              <CheckBoxCard
                title="사람 리뷰 사용"
                checked={form.peopleReviewEnabled}
                onChange={(checked) => setForm({ ...form, peopleReviewEnabled: checked })}
                icon={<CalendarDays className="h-4 w-4" />}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!canSubmit || saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                중간 점검 주기 생성
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">운영 안내</div>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                <li>정렬형/회고형은 조직 리더 중심으로 운영합니다.</li>
                <li>평가형/발전형은 구성원 작성 후 리더 검토 방식으로 운영할 수 있습니다.</li>
                <li>생성 즉시 연결된 중간 점검 체크인과 assignment가 함께 준비됩니다.</li>
              </ul>
            </div>

            {cycles.length ? (
              cycles.map((cycle) => (
                <div key={cycle.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill>{cycle.reviewTypeLabel}</Pill>
                        <Pill tone={cycle.status === 'ACTIVE' ? 'emerald' : cycle.status === 'CLOSED' ? 'slate' : 'amber'}>
                          {cycle.statusLabel}
                        </Pill>
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{cycle.name}</div>
                      <p className="mt-1 text-sm text-slate-500">
                        {cycle.scopeTargetKindLabel}
                        {cycle.scopeDepartment ? ` · ${cycle.scopeDepartment.name}` : ''}
                        {cycle.includeDescendants ? ' · 하위 조직 포함' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cycle.status !== 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => void updateStatus(cycle.id, 'ACTIVE')}
                          disabled={saving}
                          className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700"
                        >
                          진행 시작
                        </button>
                      ) : null}
                      {cycle.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => void updateStatus(cycle.id, 'CLOSED')}
                          disabled={saving}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          마감
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Metric label="배정 수" value={`${cycle.progress.totalAssignments}건`} />
                    <Metric label="완료율" value={`${cycle.progress.completionRate.toFixed(1)}%`} />
                    <Metric label="목표 수정 필요" value={`${cycle.progress.revisionRequestedCount}건`} />
                    <Metric label="액션 없는 건" value={`${cycle.progress.noActionCount}건`} />
                    <Metric label="고위험 유지 이슈" value={`${cycle.progress.peopleRiskWithoutPlanCount}건`} />
                    <Metric label="지연 건" value={`${cycle.progress.overdueCount}건`} />
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    시작 {formatDateTime(cycle.startsAt)} · 구성원 마감 {formatDateTime(cycle.selfDueAt)} · 리더 마감 {formatDateTime(cycle.leaderDueAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                아직 등록된 중간 점검 주기가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function CheckBoxCard({
  title,
  checked,
  onChange,
  icon,
}: {
  title: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon: React.ReactNode
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        {icon}
        {title}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function Pill({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode
  tone?: 'slate' | 'amber' | 'emerald'
}) {
  const className =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
}
