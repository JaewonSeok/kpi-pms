'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, Bot, FilePenLine, FileUp, Lock, Plus, Send, ShieldCheck, Sparkles } from 'lucide-react'
import type { OrgKpiPageData, OrgKpiViewModel } from '@/server/org-kpi-page'
import { OrgKpiBulkUploadModal } from './OrgKpiBulkUploadModal'

type Props = OrgKpiPageData & {
  initialTab?: string
  initialSelectedKpiId?: string
}

type TabKey = 'map' | 'list' | 'linkage' | 'history' | 'ai'
type Banner = { tone: 'success' | 'error' | 'info'; message: string }
type FormState = {
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
type AiAction =
  | 'generate-draft'
  | 'improve-wording'
  | 'smart-check'
  | 'detect-duplicates'
  | 'suggest-alignment'
  | 'summarize-risk'
  | 'draft-monthly-comment'
type AiPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: Record<string, unknown>
}

const TAB_LABELS: Record<TabKey, string> = {
  map: '목표 맵',
  list: '목록',
  linkage: '연결 현황',
  history: '이력',
  ai: 'AI 보조',
}

const STATUS_LABELS: Record<OrgKpiViewModel['status'], string> = {
  DRAFT: '초안',
  SUBMITTED: '제출됨',
  CONFIRMED: '확정',
  LOCKED: '잠금',
  ARCHIVED: '보관',
}

const STATUS_CLASS: Record<OrgKpiViewModel['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOCKED: 'bg-violet-100 text-violet-700 border-violet-200',
  ARCHIVED: 'bg-amber-100 text-amber-700 border-amber-200',
}

const AI_LABELS: Record<AiAction, string> = {
  'generate-draft': 'KPI 초안 생성',
  'improve-wording': 'KPI 문장 개선',
  'smart-check': 'SMART 점검',
  'detect-duplicates': '중복/유사 KPI 탐지',
  'suggest-alignment': '상위·하위 정렬 추천',
  'summarize-risk': '운영 리스크 요약',
  'draft-monthly-comment': '월간 실적 코멘트 초안',
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')
const formatPercent = (value?: number | null) => (typeof value === 'number' && !Number.isNaN(value) ? `${Math.round(value * 10) / 10}%` : '-')
const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
const formatValue = (value?: number | string | null, unit?: string | null) =>
  value === undefined || value === null || value === ''
    ? '-'
    : `${typeof value === 'number' ? new Intl.NumberFormat('ko-KR').format(value) : value}${unit ? ` ${unit}` : ''}`

const parseNumber = (value: string) => {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

function buildEmptyForm(year: number, departmentId: string): FormState {
  return {
    deptId: departmentId,
    evalYear: String(year),
    kpiType: 'QUANTITATIVE',
    kpiCategory: '',
    kpiName: '',
    definition: '',
    formula: '',
    targetValue: '',
    unit: '%',
    weight: '',
    difficulty: 'MEDIUM',
  }
}

function buildFormFromKpi(kpi: OrgKpiViewModel): FormState {
  return {
    deptId: kpi.departmentId,
    evalYear: String(kpi.evalYear),
    kpiType: (kpi.type ?? 'QUANTITATIVE') as FormState['kpiType'],
    kpiCategory: kpi.category ?? '',
    kpiName: kpi.title,
    definition: kpi.definition ?? '',
    formula: kpi.formula ?? '',
    targetValue:
      typeof kpi.targetValue === 'number' ? String(kpi.targetValue) : String(kpi.targetValue ?? ''),
    unit: kpi.unit ?? '',
    weight: typeof kpi.weight === 'number' ? String(kpi.weight) : '',
    difficulty: (kpi.difficulty ?? 'MEDIUM') as FormState['difficulty'],
  }
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init)
  const json = (await response.json()) as {
    success?: boolean
    data?: T
    error?: { message?: string }
  }
  if (!json.success) throw new Error(json.error?.message || '요청을 처리하지 못했습니다.')
  return json.data as T
}

function buildAiPayload(action: AiAction, kpi: OrgKpiViewModel | null, form: FormState, pageData: Props) {
  const departmentName =
    kpi?.departmentName ??
    pageData.departments.find((department) => department.id === form.deptId)?.name ??
    pageData.actor.departmentName

  return {
    departmentName,
    year: Number(form.evalYear || pageData.selectedYear),
    kpiName: kpi?.title ?? form.kpiName,
    category: kpi?.category ?? form.kpiCategory,
    definition: kpi?.definition ?? form.definition,
    formula: kpi?.formula ?? form.formula,
    targetValue: kpi?.targetValue ?? parseNumber(form.targetValue),
    unit: kpi?.unit ?? form.unit,
    weight: kpi?.weight ?? parseNumber(form.weight),
    difficulty: kpi?.difficulty ?? form.difficulty,
    linkedPersonalKpiCount: kpi?.linkedPersonalKpiCount ?? 0,
    monthlyAchievementRate: kpi?.monthlyAchievementRate ?? null,
    riskFlags: kpi?.riskFlags ?? [],
    action,
  }
}
export function OrgKpiManagementClient({ initialTab, initialSelectedKpiId, ...pageData }: Props) {
  const router = useRouter()
  const canRenderWorkspace = pageData.state === 'ready' || pageData.state === 'empty'
  const [tab, setTab] = useState<TabKey>(initialTab && initialTab in TAB_LABELS ? (initialTab as TabKey) : 'map')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(
    pageData.departments.length > 1 ? 'ALL' : pageData.selectedDepartmentId
  )
  const [selectedKpiId, setSelectedKpiId] = useState(initialSelectedKpiId ?? pageData.list[0]?.id ?? '')
  const [showForm, setShowForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(buildEmptyForm(pageData.selectedYear, pageData.selectedDepartmentId))
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [aiAction, setAiAction] = useState<AiAction>('generate-draft')
  const [search, setSearch] = useState('')

  const filteredList = useMemo(
    () =>
      pageData.list.filter((item) => {
        if (selectedDepartmentId !== 'ALL' && item.departmentId !== selectedDepartmentId) return false
        if (
          search.trim() &&
          !`${item.title} ${item.departmentName} ${item.category ?? ''}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        ) {
          return false
        }
        return true
      }),
    [pageData.list, search, selectedDepartmentId]
  )

  useEffect(() => {
    if (!filteredList.length) {
      setSelectedKpiId('')
      return
    }
    if (!filteredList.some((item) => item.id === selectedKpiId)) {
      setSelectedKpiId(filteredList[0].id)
    }
  }, [filteredList, selectedKpiId])

  const selectedKpi =
    filteredList.find((item) => item.id === selectedKpiId) ??
    pageData.list.find((item) => item.id === selectedKpiId) ??
    filteredList[0] ??
    pageData.list[0] ??
    null

  async function saveKpi() {
    if (!form.deptId || !form.kpiCategory.trim() || !form.kpiName.trim() || !form.weight.trim()) {
      setBanner({ tone: 'error', message: '부서, 카테고리, KPI명, 가중치를 입력해 주세요.' })
      return
    }

    setBusy(true)
    try {
      await fetchJson(editingKpiId ? `/api/kpi/org/${editingKpiId}` : '/api/kpi/org', {
        method: editingKpiId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: form.deptId,
          evalYear: Number(form.evalYear || pageData.selectedYear),
          kpiType: form.kpiType,
          kpiCategory: form.kpiCategory.trim(),
          kpiName: form.kpiName.trim(),
          definition: form.definition.trim() || undefined,
          formula: form.formula.trim() || undefined,
          targetValue: parseNumber(form.targetValue),
          unit: form.unit.trim() || undefined,
          weight: Number(form.weight),
          difficulty: form.difficulty,
        }),
      })
      setBanner({
        tone: 'success',
        message: editingKpiId ? '조직 KPI를 수정했습니다.' : '새 조직 KPI를 등록했습니다.',
      })
      setShowForm(false)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '조직 KPI 저장에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function runWorkflow(action: 'SUBMIT' | 'LOCK' | 'REOPEN') {
    if (!selectedKpi) return
    setBusy(true)
    try {
      await fetchJson(`/api/kpi/org/${selectedKpi.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setBanner({
        tone: 'success',
        message:
          action === 'SUBMIT'
            ? '조직 KPI를 제출했습니다.'
            : action === 'LOCK'
              ? '조직 KPI를 잠금 처리했습니다.'
              : '조직 KPI를 다시 열었습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') {
    if (!selectedKpi) return
    setBusy(true)
    try {
      await fetchJson(`/api/kpi/org/${selectedKpi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setBanner({
        tone: 'success',
        message:
          status === 'CONFIRMED'
            ? '조직 KPI를 확정했습니다.'
            : status === 'ARCHIVED'
              ? '조직 KPI를 보관 처리했습니다.'
              : '조직 KPI를 초안 상태로 되돌렸습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function requestAi(action: AiAction) {
    setBusy(true)
    setAiAction(action)
    try {
      const data = await fetchJson<AiPreview>('/api/kpi/org/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: selectedKpi?.id ?? editingKpiId ?? 'new-org-kpi',
          payload: buildAiPayload(action, selectedKpi, form, pageData),
        }),
      })
      setAiPreview(data)
      setTab('ai')
      setBanner({
        tone: data.source === 'ai' ? 'success' : 'info',
        message:
          data.source === 'ai'
            ? 'AI 결과를 준비했습니다. 미리보기 후 적용해 주세요.'
            : 'AI fallback 결과를 준비했습니다. 미리보기 후 적용해 주세요.',
      })
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 요청에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function decideAi(action: 'approve' | 'reject') {
    if (!aiPreview) return
    setBusy(true)
    try {
      await fetchJson(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? aiPreview.result : undefined,
          rejectionReason: action === 'reject' ? 'User rejected org KPI AI result.' : undefined,
        }),
      })

      if (action === 'approve') {
        if (aiAction === 'generate-draft') {
          setEditingKpiId(null)
          setForm((current) => ({
            ...current,
            kpiCategory: String(aiPreview.result.category ?? current.kpiCategory),
            kpiName: String(aiPreview.result.title ?? current.kpiName),
            definition: String(aiPreview.result.definition ?? current.definition),
            formula: String(aiPreview.result.formula ?? current.formula),
            targetValue: String(aiPreview.result.targetValueSuggestion ?? current.targetValue),
            unit: String(aiPreview.result.unit ?? current.unit),
            weight: String(aiPreview.result.weightSuggestion ?? current.weight),
          }))
          setShowForm(true)
        }

        if (aiAction === 'improve-wording' && selectedKpi) {
          setEditingKpiId(selectedKpi.id)
          setForm({
            ...buildFormFromKpi(selectedKpi),
            kpiName: String(aiPreview.result.improvedTitle ?? selectedKpi.title),
            definition: String(aiPreview.result.improvedDefinition ?? selectedKpi.definition ?? ''),
          })
          setShowForm(true)
        }

        setBanner({ tone: 'success', message: 'AI 제안을 반영했습니다.' })
      } else {
        setBanner({ tone: 'info', message: 'AI 제안을 반려했습니다.' })
      }

      setAiPreview(null)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 처리에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  if (!canRenderWorkspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">조직 KPI</h1>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {pageData.state === 'permission-denied' ? '권한이 없습니다' : '조직 KPI 화면을 불러오지 못했습니다'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{pageData.message ?? '잠시 후 다시 시도해 주세요.'}</p>
        </div>
        <QuickLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Goal Alignment</span>
              <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_CLASS[pageData.summary.confirmedRate === 100 ? 'CONFIRMED' : pageData.summary.confirmedCount > 0 ? 'SUBMITTED' : 'DRAFT'])}>
                {pageData.summary.confirmedRate === 100 ? '확정' : pageData.summary.confirmedCount > 0 ? '제출됨' : '초안'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">조직 KPI</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">조직 전략을 KPI 구조로 번역하고, 개인 KPI와 월간 실적, 평가 근거까지 이어지는 기준점을 관리합니다.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroStat label="총 조직 KPI 수" value={`${pageData.summary.totalCount}개`} />
              <HeroStat label="cascade 연결률" value={formatPercent(pageData.summary.cascadeRate)} />
              <HeroStat label="미연결 KPI 수" value={`${pageData.summary.unlinkedCount}개`} />
              <HeroStat label="확정률" value={formatPercent(pageData.summary.confirmedRate)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="연도">
                <select value={pageData.selectedYear} onChange={(event) => router.push(`/kpi/org?year=${encodeURIComponent(event.target.value)}`)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  {pageData.availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
                </select>
              </Field>
              <Field label="조직 범위">
                <select value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  {pageData.departments.length > 1 ? <option value="ALL">전체 조직</option> : null}
                  {pageData.departments.map((department) => <option key={department.id} value={department.id}>{'- '.repeat(department.level)}{department.name}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <ActionButton label="조직 KPI 추가" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditingKpiId(null); setForm(buildEmptyForm(pageData.selectedYear, selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId)); setShowForm(true) }} disabled={!pageData.permissions.canCreate} primary />
            <ActionButton label="일괄 업로드" icon={<FileUp className="h-4 w-4" />} onClick={() => setShowBulkUpload(true)} disabled={!pageData.permissions.canCreate} />
            <ActionButton label="제출" icon={<Send className="h-4 w-4" />} onClick={() => void runWorkflow('SUBMIT')} disabled={!selectedKpi || !pageData.permissions.canManage || busy} />
            <ActionButton label="확정" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => void changeStatus('CONFIRMED')} disabled={!selectedKpi || !pageData.permissions.canConfirm || busy} />
            <ActionButton label="잠금" icon={<Lock className="h-4 w-4" />} onClick={() => void runWorkflow('LOCK')} disabled={!selectedKpi || !pageData.permissions.canLock || busy} />
            <ActionButton label="이력 보기" icon={<Archive className="h-4 w-4" />} onClick={() => setTab('history')} disabled={false} />
          </div>
        </div>
      </section>

      {banner ? <BannerBox tone={banner.tone} message={banner.message} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="확정 KPI 수" value={`${pageData.summary.confirmedCount}개`} helper="확정 또는 잠금 상태 기준" />
        <MetricCard label="개인 KPI 연결 수" value={`${pageData.summary.linkedPersonalKpiCount}개`} helper="연결된 개인 KPI 전체 건수" />
        <MetricCard label="월간 실적 연결률" value={formatPercent(pageData.summary.monthlyCoverageRate)} helper="최근 월간 실적이 있는 KPI 비율" />
        <MetricCard label="위험 KPI 수" value={`${pageData.summary.riskCount}개`} helper="연결 또는 실적 누락 등 위험 신호" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tabKey) => (
            <button key={tabKey} type="button" onClick={() => setTab(tabKey)} className={cls('rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === tabKey ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'ai' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="KPI명 또는 부서 검색" />
              {pageData.departments.length > 1 ? (
                <div className="space-y-2">
                  {pageData.departments.map((department) => (
                    <button key={department.id} type="button" onClick={() => setSelectedDepartmentId(department.id)} className={cls('w-full rounded-2xl border px-4 py-3 text-left text-sm transition', selectedDepartmentId === department.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}>
                      {department.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                {filteredList.length ? filteredList.map((kpi) => (
                  <button key={kpi.id} type="button" onClick={() => setSelectedKpiId(kpi.id)} className={cls('w-full rounded-2xl border px-4 py-4 text-left transition', selectedKpi?.id === kpi.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{kpi.title}</span><StatusBadge status={kpi.status} /></div>
                        <p className="mt-1 text-sm text-slate-500">{kpi.departmentName} · {kpi.category ?? '카테고리 미지정'}</p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <div className="font-semibold text-slate-900">{formatValue(kpi.targetValue, kpi.unit)}</div>
                        <div className="mt-1">가중치 {formatValue(kpi.weight)}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                      <span>개인 KPI {kpi.linkedPersonalKpiCount}개</span>
                      <span>달성률 {formatPercent(kpi.monthlyAchievementRate)}</span>
                      <span>owner {kpi.owner?.name ?? '미지정'}</span>
                    </div>
                    {kpi.riskFlags.length ? <div className="mt-3 flex flex-wrap gap-2">{kpi.riskFlags.map((flag) => <span key={`${kpi.id}-${flag}`} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{flag}</span>)}</div> : null}
                  </button>
                )) : <EmptyState title="표시할 KPI가 없습니다" description="조직 KPI를 추가하거나 검색 조건을 조정해 보세요." />}
              </div>

              <KpiDetail kpi={selectedKpi} permissions={pageData.permissions} busy={busy} onEdit={(kpi) => { setEditingKpiId(kpi.id); setForm(buildFormFromKpi(kpi)); setShowForm(true) }} onWorkflow={(action) => void runWorkflow(action)} onStatus={(status) => void changeStatus(status)} onAi={(action) => void requestAi(action)} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'linkage' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageData.linkage.length ? pageData.linkage.map((item) => (
              <div key={item.orgKpiId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', item.riskLevel === 'HIGH' ? 'border-red-200 bg-red-100 text-red-700' : item.riskLevel === 'MEDIUM' ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-emerald-200 bg-emerald-100 text-emerald-700')}>
                    {item.riskLevel === 'HIGH' ? '위험 높음' : item.riskLevel === 'MEDIUM' ? '주의' : '정상'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.departmentName}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>개인 KPI 연결 {item.linkedPersonalKpiCount} / {item.targetPopulationCount}</div>
                  <div>coverage {formatPercent(item.coverageRate)}</div>
                  <div>최근 월간 실적 {item.hasRecentMonthlyRecord ? '있음' : '없음'}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/kpi/personal" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">개인 KPI</Link>
                  <Link href="/kpi/monthly" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">월간 실적</Link>
                </div>
              </div>
            )) : <EmptyState title="연결 현황이 없습니다" description="개인 KPI와 월간 실적이 연결되면 coverage와 위험 지표를 확인할 수 있습니다." />}
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-2">
            <Timeline title="전체 이력" items={pageData.history} />
            <Timeline title="선택 KPI 이력" items={selectedKpi?.history ?? []} />
          </div>
        </div>
      ) : null}

      {tab === 'ai' ? (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-3">
              {(Object.keys(AI_LABELS) as AiAction[]).map((action) => (
                <button key={action} type="button" onClick={() => void requestAi(action)} disabled={busy || !pageData.permissions.canUseAi} className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  <div className="flex items-center gap-2 font-semibold text-slate-900"><Bot className="h-4 w-4 text-slate-500" />{AI_LABELS[action]}</div>
                  <p className="mt-2 text-sm text-slate-500">결과는 preview 후 승인해야만 반영됩니다.</p>
                </button>
              ))}
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">AI 사용 로그</h3>
              <div className="mt-3 space-y-3">
                {pageData.aiLogs.length ? pageData.aiLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="font-medium text-slate-900">{log.summary}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)} · {log.requesterName} · {log.requestStatus} · 승인 {log.approvalStatus}</div>
                  </div>
                )) : <EmptyState title="AI 로그가 없습니다" description="AI 사용 이력이 여기에 남습니다." compact />}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {aiPreview ? (
              <div className="space-y-4">
                {aiPreview.fallbackReason ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">fallback 사유: {aiPreview.fallbackReason}</div> : null}
                <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{JSON.stringify(aiPreview.result, null, 2)}</pre>
                <div className="flex flex-wrap gap-3">
                  <ActionButton label="반려" icon={<Archive className="h-4 w-4" />} onClick={() => void decideAi('reject')} disabled={busy} />
                  <ActionButton label="적용" icon={<Sparkles className="h-4 w-4" />} onClick={() => void decideAi('approve')} disabled={busy} primary />
                </div>
              </div>
            ) : <EmptyState title="AI preview가 없습니다" description="AI 보조 기능을 실행하면 결과가 여기에 표시됩니다." />}
          </div>
        </div>
      ) : null}

      <QuickLinks />

      {showForm ? <EditorModal departments={pageData.departments} form={form} onChange={setForm} onClose={() => setShowForm(false)} onSubmit={() => void saveKpi()} busy={busy} editing={Boolean(editingKpiId)} /> : null}
      {showBulkUpload ? <OrgKpiBulkUploadModal departments={pageData.departments} selectedYear={pageData.selectedYear} defaultDepartmentId={selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId} onClose={() => setShowBulkUpload(false)} onUploaded={(message, tone = 'success') => { setBanner({ tone, message }); router.refresh() }} /> : null}
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold text-slate-900">{value}</div></div>
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div><div className="mt-2 text-xs text-slate-500">{helper}</div></div>
}

function BannerBox({ tone, message }: Banner) {
  return <div className={cls('rounded-2xl border px-4 py-3 text-sm', tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800')}>{message}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">{label}</span>{children}</label>
}

function ActionButton({ label, icon, onClick, disabled, primary = false }: { label: string; icon: ReactNode; onClick: () => void; disabled: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cls('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60', primary ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>{icon}{label}</button>
}

function StatusBadge({ status }: { status: OrgKpiViewModel['status'] }) {
  return <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_CLASS[status])}>{STATUS_LABELS[status]}</span>
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={cls('rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-500', compact ? 'px-4 py-6' : 'px-4 py-10')}><div className="text-sm font-semibold text-slate-900">{title}</div><p className="mt-2 text-sm leading-6">{description}</p></div>
}
function KpiDetail({ kpi, permissions, busy, onEdit, onWorkflow, onStatus, onAi }: { kpi: OrgKpiViewModel | null; permissions: OrgKpiPageData['permissions']; busy: boolean; onEdit: (kpi: OrgKpiViewModel) => void; onWorkflow: (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => void; onStatus: (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => void; onAi: (action: AiAction) => void }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{kpi ? <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="text-xl font-semibold text-slate-900">{kpi.title}</span><StatusBadge status={kpi.status} /></div><p className="mt-1 text-sm text-slate-500">{kpi.departmentName} · {kpi.category ?? '카테고리 미지정'}</p></div><div className="rounded-2xl bg-slate-100 px-4 py-3 text-right"><div className="text-xs text-slate-500">owner</div><div className="text-sm font-semibold text-slate-900">{kpi.owner?.name ?? '미지정'}</div></div></div><div className="grid gap-3 sm:grid-cols-2"><InfoPill label="목표값" value={formatValue(kpi.targetValue, kpi.unit)} /><InfoPill label="가중치" value={formatValue(kpi.weight)} /><InfoPill label="개인 KPI 연결" value={`${kpi.linkedPersonalKpiCount}개`} /><InfoPill label="최근 달성률" value={formatPercent(kpi.monthlyAchievementRate)} /></div><InfoBox title="정의" value={kpi.definition ?? '정의가 아직 없습니다.'} /><InfoBox title="산식" value={kpi.formula ?? '산식이 아직 없습니다.'} /><InfoBox title="상위 KPI 추천" value={kpi.suggestedParent ? `${kpi.suggestedParent.departmentName} · ${kpi.suggestedParent.title}` : '추천 가능한 상위 KPI가 없습니다.'} />{kpi.riskFlags.length ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3"><div className="text-sm font-semibold text-red-700">linkage risk warning</div><div className="mt-3 flex flex-wrap gap-2">{kpi.riskFlags.map((flag) => <span key={flag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700">{flag}</span>)}</div></div> : null}<div className="grid gap-3 sm:grid-cols-2"><ActionButton label="수정" icon={<FilePenLine className="h-4 w-4" />} onClick={() => onEdit(kpi)} disabled={!permissions.canManage || kpi.status !== 'DRAFT' || busy} /><ActionButton label={kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? '다시 열기' : '제출'} icon={<Send className="h-4 w-4" />} onClick={() => onWorkflow(kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? 'REOPEN' : 'SUBMIT')} disabled={!permissions.canManage || busy || !['DRAFT', 'SUBMITTED', 'LOCKED'].includes(kpi.status)} /><ActionButton label="확정" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => onStatus('CONFIRMED')} disabled={!permissions.canConfirm || busy || ['CONFIRMED', 'LOCKED'].includes(kpi.status)} /><ActionButton label="잠금" icon={<Lock className="h-4 w-4" />} onClick={() => onWorkflow('LOCK')} disabled={!permissions.canLock || busy || kpi.status !== 'CONFIRMED'} /><ActionButton label="보관" icon={<Archive className="h-4 w-4" />} onClick={() => onStatus('ARCHIVED')} disabled={!permissions.canArchive || busy || kpi.status === 'ARCHIVED'} /><ActionButton label="AI 개선" icon={<Sparkles className="h-4 w-4" />} onClick={() => onAi('improve-wording')} disabled={!permissions.canUseAi} /></div><div className="grid gap-3 sm:grid-cols-2"><Link href="/kpi/personal" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">개인 KPI 보기</Link><Link href="/kpi/monthly" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">월간 실적 보기</Link><Link href="/evaluation/results" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">평가 결과 보기</Link><Link href="/evaluation/workbench" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">AI 평가 보조</Link></div></div> : <EmptyState title="선택된 KPI가 없습니다" description="목표 맵이나 목록에서 KPI를 선택하면 상세 정보가 표시됩니다." />}</div>
}

function Timeline({ title, items }: { title: string; items: OrgKpiPageData['history'] }) {
  return <div className="space-y-3"><div className="text-sm font-semibold text-slate-900">{title}</div>{items.length ? items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="font-medium text-slate-900">{item.action}</div><div className="text-xs text-slate-500">{formatDateTime(item.at)}</div></div><div className="mt-1 text-xs text-slate-500">{item.actor}</div>{item.fromStatus || item.toStatus ? <div className="mt-2 text-sm text-slate-600">{item.fromStatus ?? '-'} → {item.toStatus ?? '-'}</div> : null}{item.detail ? <p className="mt-2 text-sm text-slate-600">{item.detail}</p> : null}</div>) : <EmptyState title="이력이 없습니다" description="감사 가능한 변경 이력이 여기에 표시됩니다." compact />}</div>
}

function EditorModal({ departments, form, onChange, onClose, onSubmit, busy, editing }: { departments: OrgKpiPageData['departments']; form: FormState; onChange: (value: FormState) => void; onClose: () => void; onSubmit: () => void; busy: boolean; editing: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-sm"><div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Org KPI Form</p><h2 className="mt-2 text-xl font-bold text-slate-900">{editing ? '조직 KPI 수정' : '조직 KPI 추가'}</h2><p className="mt-2 text-sm text-slate-500">측정 가능한 조직 KPI를 작성하고 개인 KPI와 월간 실적에 연결될 기준 레코드를 만듭니다.</p></div><button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">닫기</button></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Field label="부서"><select value={form.deptId} onChange={(event) => onChange({ ...form, deptId: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">{departments.map((department) => <option key={department.id} value={department.id}>{'- '.repeat(department.level)}{department.name}</option>)}</select></Field><Field label="평가 연도"><input type="number" value={form.evalYear} onChange={(event) => onChange({ ...form, evalYear: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field><Field label="KPI 유형"><select value={form.kpiType} onChange={(event) => onChange({ ...form, kpiType: event.target.value as FormState['kpiType'] })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="QUANTITATIVE">정량</option><option value="QUALITATIVE">정성</option></select></Field><Field label="난이도"><select value={form.difficulty} onChange={(event) => onChange({ ...form, difficulty: event.target.value as FormState['difficulty'] })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"><option value="HIGH">높음</option><option value="MEDIUM">중간</option><option value="LOW">낮음</option></select></Field></div><div className="mt-4 grid gap-4"><Field label="카테고리"><input value={form.kpiCategory} onChange={(event) => onChange({ ...form, kpiCategory: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="예: 매출 성장, 고객 성공" /></Field><Field label="KPI명"><input value={form.kpiName} onChange={(event) => onChange({ ...form, kpiName: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="예: 핵심 고객군 월간 유지율 향상" /></Field><Field label="정의"><textarea value={form.definition} onChange={(event) => onChange({ ...form, definition: event.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field><Field label="산식"><textarea value={form.formula} onChange={(event) => onChange({ ...form, formula: event.target.value })} rows={2} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field></div><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="목표값"><input value={form.targetValue} onChange={(event) => onChange({ ...form, targetValue: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field><Field label="단위"><input value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field><Field label="가중치"><input value={form.weight} onChange={(event) => onChange({ ...form, weight: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" /></Field></div><div className="mt-6 flex flex-wrap justify-end gap-3"><ActionButton label="취소" icon={<Archive className="h-4 w-4" />} onClick={onClose} disabled={false} /><ActionButton label={busy ? '저장 중...' : editing ? '수정 저장' : '조직 KPI 저장'} icon={<FilePenLine className="h-4 w-4" />} onClick={onSubmit} disabled={busy} primary /></div></div></div>
}

function QuickLinks() {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">연결 화면</h3><p className="mt-2 text-sm text-slate-500">조직 KPI는 개인 KPI, 월간 실적, 평가 결과와 함께 운영될 때 가장 강력해집니다.</p><div className="mt-5 grid gap-3 md:grid-cols-4">{[['/kpi/personal', '개인 KPI'], ['/kpi/monthly', '월간 실적'], ['/evaluation/results', '평가 결과'], ['/evaluation/workbench', 'AI 평가 보조']].map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{label}<span>→</span></Link>)}</div></section>
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>
}

function InfoBox({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">{title}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p></div>
}
