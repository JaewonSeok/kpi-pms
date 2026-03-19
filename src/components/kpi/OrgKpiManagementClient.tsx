'use client'

import Link from 'next/link'
import { startTransition, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  FileUp,
  GitBranch,
  History,
  Layers3,
  Link2,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react'
import type {
  OrgKpiAiLogItem,
  OrgKpiLinkageItem,
  OrgKpiPageData,
  OrgKpiTimelineItem,
  OrgKpiViewModel,
} from '@/server/org-kpi-page'

type OrgKpiManagementClientProps = OrgKpiPageData & {
  initialTab?: string
  initialSelectedKpiId?: string
}

type TabKey = 'map' | 'list' | 'linkage' | 'history' | 'ai'

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

type BannerState = {
  tone: 'success' | 'error' | 'info'
  message: string
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
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  LOCKED: 'bg-violet-100 text-violet-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
}

const RISK_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-rose-100 text-rose-700',
}

const TYPE_LABELS = { QUANTITATIVE: '정량', QUALITATIVE: '정성' } as const
const DIFFICULTY_LABELS = { HIGH: '높음', MEDIUM: '중간', LOW: '낮음' } as const

const AI_ACTION_LABELS: Record<AiAction, string> = {
  'generate-draft': 'KPI 초안 생성',
  'improve-wording': 'KPI 문장 개선',
  'smart-check': 'SMART 점검',
  'detect-duplicates': '중복/유사 KPI 탐지',
  'suggest-alignment': '상위/하위 정렬 추천',
  'summarize-risk': '운영 리스크 요약',
  'draft-monthly-comment': '월간 실적 기반 코멘트',
}

function createEmptyForm(selectedYear: number, departmentId: string): FormState {
  return {
    deptId: departmentId,
    evalYear: String(selectedYear),
    kpiType: 'QUANTITATIVE',
    kpiCategory: '',
    kpiName: '',
    definition: '',
    formula: '',
    targetValue: '',
    unit: '%',
    weight: '20',
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
    targetValue: typeof kpi.targetValue === 'number' ? String(kpi.targetValue) : '',
    unit: kpi.unit ?? '',
    weight: typeof kpi.weight === 'number' ? String(kpi.weight) : '',
    difficulty: (kpi.difficulty ?? 'MEDIUM') as FormState['difficulty'],
  }
}

function getPageStatus(summary: OrgKpiManagementClientProps['summary']) {
  if (!summary.totalCount) return 'DRAFT'
  if (summary.confirmedRate === 100) return 'CONFIRMED'
  if (summary.confirmedCount > 0) return 'SUBMITTED'
  return 'DRAFT'
}

function formatPercent(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return `${Math.round(value * 10) / 10}%`
}

function formatNumber(value?: number | string) {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'number') return new Intl.NumberFormat('ko-KR').format(value)
  return value
}

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

function parseNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : undefined
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function toObjectArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
}

function buildAiPayload(action: AiAction, selectedKpi: OrgKpiViewModel | null, form: FormState, pageData: OrgKpiManagementClientProps) {
  const candidateKpis = pageData.list
    .filter((item) => item.departmentId === (selectedKpi?.departmentId ?? form.deptId))
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      departmentName: item.departmentName,
      targetValue: item.targetValue,
    }))

  const basePayload = {
    departmentName:
      selectedKpi?.departmentName ??
      pageData.departments.find((department) => department.id === form.deptId)?.name ??
      pageData.actor.departmentName,
    year: Number(form.evalYear || pageData.selectedYear),
    kpiName: selectedKpi?.title ?? form.kpiName,
    kpiCategory: selectedKpi?.category ?? form.kpiCategory,
    definition: selectedKpi?.definition ?? form.definition,
    formula: selectedKpi?.formula ?? form.formula,
    targetValue: selectedKpi?.targetValue ?? parseNumber(form.targetValue),
    unit: selectedKpi?.unit ?? form.unit,
    weight: selectedKpi?.weight ?? parseNumber(form.weight),
    difficulty: selectedKpi?.difficulty ?? form.difficulty,
    linkedPersonalKpiCount: selectedKpi?.linkedPersonalKpiCount ?? 0,
    monthlyAchievementRate: selectedKpi?.monthlyAchievementRate ?? null,
    riskFlags: selectedKpi?.riskFlags ?? [],
    candidates: candidateKpis,
    organizationSummary: pageData.summary,
  }

  if (action === 'generate-draft') {
    return {
      ...basePayload,
      goal: form.kpiName || '연간 조직 전략 실행',
      category: form.kpiCategory || '전략 실행',
      strategyDirection: form.definition || '조직 KPI 초안을 만들고 월간 실행 기준까지 연결하려고 합니다.',
    }
  }

  if (action === 'suggest-alignment') {
    return {
      ...basePayload,
      recommendedParentId: selectedKpi?.suggestedParent?.id ?? '',
      recommendedParentTitle: selectedKpi?.suggestedParent?.title ?? '',
    }
  }

  if (action === 'summarize-risk') {
    return {
      ...basePayload,
      linkage: pageData.linkage.slice(0, 12),
    }
  }

  if (action === 'draft-monthly-comment') {
    return {
      ...basePayload,
      recentMonthlyRecords: selectedKpi?.recentMonthlyRecords ?? [],
    }
  }

  return basePayload
}

export function OrgKpiManagementClient({
  initialTab,
  initialSelectedKpiId,
  ...pageData
}: OrgKpiManagementClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab && initialTab in TAB_LABELS ? (initialTab as TabKey) : 'map'
  )
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(pageData.selectedDepartmentId)
  const [selectedKpiId, setSelectedKpiId] = useState(initialSelectedKpiId ?? pageData.list[0]?.id ?? '')
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(createEmptyForm(pageData.selectedYear, pageData.selectedDepartmentId))
  const [filters, setFilters] = useState({ status: 'ALL', linkage: 'ALL', owner: 'ALL', risk: 'ALL', level: 'ALL' })
  const [aiAction, setAiAction] = useState<AiAction>('generate-draft')
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [formBusy, setFormBusy] = useState(false)
  const [decisionBusy, setDecisionBusy] = useState(false)

  const pageStatus = getPageStatus(pageData.summary)
  const departmentLevelMap = useMemo(() => new Map(pageData.departments.map((department) => [department.id, department.level])), [pageData.departments])
  const scopedList = useMemo(() => (selectedDepartmentId === 'ALL' ? pageData.list : pageData.list.filter((item) => item.departmentId === selectedDepartmentId)), [pageData.list, selectedDepartmentId])
  const filteredList = useMemo(
    () =>
      scopedList.filter((item) => {
        if (filters.status !== 'ALL' && item.status !== filters.status) return false
        if (filters.linkage === 'LINKED' && item.linkedPersonalKpiCount === 0) return false
        if (filters.linkage === 'UNLINKED' && item.linkedPersonalKpiCount > 0) return false
        if (filters.owner !== 'ALL' && item.owner?.name !== filters.owner) return false
        if (filters.risk === 'RISK' && item.riskFlags.length === 0) return false
        if (filters.risk === 'SAFE' && item.riskFlags.length > 0) return false
        if (filters.level !== 'ALL' && String(departmentLevelMap.get(item.departmentId) ?? 0) !== filters.level) return false
        return true
      }),
    [departmentLevelMap, filters, scopedList]
  )
  const selectedKpi =
    pageData.list.find((item) => item.id === selectedKpiId) ??
    filteredList[0] ??
    scopedList[0] ??
    pageData.list[0] ??
    null
  const selectedDepartmentNode = useMemo(() => {
    const stack = [...pageData.tree]
    while (stack.length) {
      const current = stack.shift()
      if (!current) continue
      if (current.departmentId === selectedDepartmentId) return current
      stack.push(...current.children)
    }
    return pageData.tree[0] ?? null
  }, [pageData.tree, selectedDepartmentId])
  const availableOwners = useMemo(() => Array.from(new Set(pageData.list.map((item) => item.owner?.name).filter((value): value is string => Boolean(value)))), [pageData.list])

  async function persist(url: string, method: 'POST' | 'PATCH', payload: Record<string, unknown>, successMessage: string) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await response.json()
    if (!json.success) throw new Error(json.error?.message || '요청 처리에 실패했습니다.')
    setBanner({ tone: 'success', message: successMessage })
    router.refresh()
  }

  async function handleSubmitForm() {
    if (!form.deptId || !form.kpiCategory.trim() || !form.kpiName.trim() || !form.weight.trim()) {
      setBanner({ tone: 'error', message: '부서, 카테고리, KPI명, 가중치는 필수입니다.' })
      return
    }
    setFormBusy(true)
    try {
      await persist(
        editingKpiId ? `/api/kpi/org/${editingKpiId}` : '/api/kpi/org',
        editingKpiId ? 'PATCH' : 'POST',
        {
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
        },
        editingKpiId ? '조직 KPI 수정이 반영되었습니다.' : '새 조직 KPI가 등록되었습니다.'
      )
      setShowForm(false)
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '조직 KPI 저장에 실패했습니다.' })
    } finally {
      setFormBusy(false)
    }
  }

  async function runWorkflow(action: 'SUBMIT' | 'LOCK' | 'REOPEN') {
    if (!selectedKpi) return
    setWorkflowBusy(true)
    try {
      await persist(`/api/kpi/org/${selectedKpi.id}/workflow`, 'POST', { action }, action === 'SUBMIT' ? '조직 KPI를 제출했습니다.' : action === 'LOCK' ? '조직 KPI를 잠금 처리했습니다.' : '조직 KPI를 다시 열었습니다.')
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '워크플로 처리에 실패했습니다.' })
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function changePersistedStatus(status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') {
    if (!selectedKpi) return
    setWorkflowBusy(true)
    try {
      await persist(`/api/kpi/org/${selectedKpi.id}`, 'PATCH', { status }, status === 'CONFIRMED' ? '조직 KPI를 확정했습니다.' : status === 'ARCHIVED' ? '조직 KPI를 보관했습니다.' : '조직 KPI를 초안으로 되돌렸습니다.')
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.' })
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function requestAi(action: AiAction) {
    setAiAction(action)
    setAiBusy(true)
    try {
      const response = await fetch('/api/kpi/org/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: selectedKpi?.id ?? editingKpiId ?? 'new',
          payload: buildAiPayload(action, selectedKpi, form, pageData),
        }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message || 'AI 보조 요청에 실패했습니다.')
      setAiPreview(json.data as AiPreview)
      setActiveTab('ai')
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 보조 요청에 실패했습니다.' })
    } finally {
      setAiBusy(false)
    }
  }

  async function decideAi(action: 'approve' | 'reject') {
    if (!aiPreview) return
    setDecisionBusy(true)
    try {
      const response = await fetch(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? aiPreview.result : undefined,
          rejectionReason: action === 'reject' ? 'User dismissed the org KPI AI suggestion.' : undefined,
        }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message || 'AI 요청 로그 처리에 실패했습니다.')
    } finally {
      setDecisionBusy(false)
    }
  }

  async function applyAiResult() {
    if (!aiPreview) return
    try {
      await decideAi('approve')
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
          difficulty: String(aiPreview.result.difficultySuggestion ?? current.difficulty) as FormState['difficulty'],
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
      setAiPreview(null)
      setBanner({ tone: 'success', message: 'AI 제안을 검토 후 화면에 반영했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 결과 적용에 실패했습니다.' })
    }
  }

  async function rejectAiResult() {
    if (!aiPreview) return
    try {
      await decideAi('reject')
      setAiPreview(null)
      setBanner({ tone: 'info', message: 'AI 제안을 반려했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 반려 처리에 실패했습니다.' })
    }
  }

  function handleYearChange(year: number) {
    startTransition(() => {
      router.push(`/kpi/org?year=${encodeURIComponent(String(year))}`)
    })
  }

  if (pageData.state !== 'ready') {
    return (
      <div className="space-y-6">
        <PageHeader actor={pageData.actor} />
        <StatePanel state={pageData.state} message={pageData.message} />
        <QuickLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader actor={pageData.actor} />
      <HeroSection pageStatus={pageStatus} selectedYear={pageData.selectedYear} availableYears={pageData.availableYears} departments={pageData.departments} selectedDepartmentId={selectedDepartmentId} summary={pageData.summary} permissions={pageData.permissions} onYearChange={handleYearChange} onDepartmentChange={setSelectedDepartmentId} onOpenCreate={() => { setEditingKpiId(null); setForm(createEmptyForm(pageData.selectedYear, selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId)); setShowForm(true) }} onSoftUpload={() => setBanner({ tone: 'info', message: '조직 KPI 일괄 업로드는 다음 단계에서 엑셀 템플릿과 연동될 예정입니다.' })} onSubmit={() => runWorkflow('SUBMIT')} onConfirm={() => changePersistedStatus('CONFIRMED')} onLock={() => runWorkflow('LOCK')} onJumpHistory={() => setActiveTab('history')} selectedKpi={selectedKpi} busy={workflowBusy} />
      {banner ? <Banner banner={banner} /> : null}
      <SummaryCards summary={pageData.summary} />
      <Tabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'map' ? <MapSection tree={pageData.tree} selectedDepartmentId={selectedDepartmentId} onDepartmentChange={setSelectedDepartmentId} selectedKpiId={selectedKpi?.id ?? ''} onSelectKpi={setSelectedKpiId} selectedDepartmentNode={selectedDepartmentNode} selectedKpi={selectedKpi} onEdit={(kpi) => { setEditingKpiId(kpi.id); setForm(buildFormFromKpi(kpi)); setShowForm(true) }} onStatusChange={changePersistedStatus} onWorkflow={runWorkflow} onOpenAi={requestAi} permissions={pageData.permissions} busy={workflowBusy} /> : null}
      {activeTab === 'list' ? <ListSection list={filteredList} departments={pageData.departments} availableOwners={availableOwners} departmentLevelMap={departmentLevelMap} filters={filters} setFilters={setFilters} selectedKpiId={selectedKpi?.id ?? ''} onSelectKpi={setSelectedKpiId} selectedKpi={selectedKpi} onEdit={(kpi) => { setEditingKpiId(kpi.id); setForm(buildFormFromKpi(kpi)); setShowForm(true) }} onStatusChange={changePersistedStatus} onWorkflow={runWorkflow} permissions={pageData.permissions} busy={workflowBusy} /> : null}
      {activeTab === 'linkage' ? <LinkageSection linkage={pageData.linkage} selectedKpiId={selectedKpi?.id ?? ''} onSelectKpi={setSelectedKpiId} /> : null}
      {activeTab === 'history' ? <HistorySection history={pageData.history} selectedKpi={selectedKpi} /> : null}
      {activeTab === 'ai' ? <AiSection selectedKpi={selectedKpi} form={form} aiAction={aiAction} aiBusy={aiBusy} aiPreview={aiPreview} aiLogs={pageData.aiLogs} canUseAi={pageData.permissions.canUseAi} onRequest={requestAi} onApply={applyAiResult} onReject={rejectAiResult} decisionBusy={decisionBusy} /> : null}
      {showForm ? <KpiFormModal departments={pageData.departments} form={form} onClose={() => setShowForm(false)} onChange={setForm} onSubmit={handleSubmitForm} editing={Boolean(editingKpiId)} busy={formBusy} /> : null}
      <QuickLinks />
    </div>
  )
}

function PageHeader({ actor }: Pick<OrgKpiManagementClientProps, 'actor'>) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Organization KPI Workspace</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">조직 KPI</h1>
          <p className="mt-2 text-sm text-slate-500">연간 조직 목표를 정의하고, 하위 조직 cascade와 개인 KPI 연결, 월간 실적 추적까지 하나의 운영 화면에서 관리합니다.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          현재 사용자: <span className="font-semibold text-slate-900">{actor.name}</span> · {actor.departmentName}
        </div>
      </div>
    </section>
  )
}

function StatePanel({ state, message }: { state: OrgKpiPageData['state']; message?: string }) {
  const copy =
    state === 'permission-denied'
      ? '이 범위의 조직 KPI를 볼 권한이 없습니다.'
      : state === 'empty'
        ? message || '등록된 조직 KPI가 없습니다.'
        : message || '조직 KPI 화면을 준비하지 못했습니다.'

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Layers3 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">조직 KPI 워크스페이스</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
      </div>
    </section>
  )
}

function HeroSection(props: {
  pageStatus: OrgKpiViewModel['status']
  selectedYear: number
  availableYears: number[]
  departments: OrgKpiPageData['departments']
  selectedDepartmentId: string
  summary: OrgKpiPageData['summary']
  permissions: OrgKpiPageData['permissions']
  onYearChange: (year: number) => void
  onDepartmentChange: (departmentId: string) => void
  onOpenCreate: () => void
  onSoftUpload: () => void
  onSubmit: () => void
  onConfirm: () => void
  onLock: () => void
  onJumpHistory: () => void
  selectedKpi: OrgKpiViewModel | null
  busy: boolean
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={props.pageStatus} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">총 조직 KPI {props.summary.totalCount}개</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">cascade 연결률 {props.summary.cascadeRate}%</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoPill label="미연결 KPI" value={`${props.summary.unlinkedCount}개`} />
            <InfoPill label="확정률" value={`${props.summary.confirmedRate}%`} />
            <InfoPill label="개인 KPI 연결" value={`${props.summary.linkedPersonalKpiCount}건`} />
            <InfoPill label="위험 KPI" value={`${props.summary.riskCount}개`} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="연도">
              <select value={props.selectedYear} onChange={(event) => props.onYearChange(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
                {props.availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
              </select>
            </Field>
            <Field label="조직 범위">
              <select value={props.selectedDepartmentId} onChange={(event) => props.onDepartmentChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">
                <option value="ALL">전체 범위</option>
                {props.departments.map((department) => <option key={department.id} value={department.id}>{'　'.repeat(department.level)}{department.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="grid w-full gap-3 xl:max-w-sm">
          <button type="button" onClick={props.onOpenCreate} disabled={!props.permissions.canCreate} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="mr-2 h-4 w-4" />
            조직 KPI 추가
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton label="일괄 업로드" icon={<FileUp className="h-4 w-4" />} onClick={props.onSoftUpload} disabled={false} />
            <ActionButton label="이력 보기" icon={<History className="h-4 w-4" />} onClick={props.onJumpHistory} disabled={false} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ActionButton label="제출" icon={<Send className="h-4 w-4" />} onClick={props.onSubmit} disabled={!props.selectedKpi || props.selectedKpi.status !== 'DRAFT' || props.busy || !props.permissions.canManage} />
            <ActionButton label="확정" icon={<ShieldCheck className="h-4 w-4" />} onClick={props.onConfirm} disabled={!props.selectedKpi || !['DRAFT', 'SUBMITTED'].includes(props.selectedKpi.status) || props.busy || !props.permissions.canConfirm} />
            <ActionButton label="잠금" icon={<Lock className="h-4 w-4" />} onClick={props.onLock} disabled={!props.selectedKpi || props.selectedKpi.status !== 'CONFIRMED' || props.busy || !props.permissions.canLock} />
          </div>
        </div>
      </div>
    </section>
  )
}

function Banner({ banner }: { banner: BannerState }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${
      banner.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : banner.tone === 'info'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-rose-200 bg-rose-50 text-rose-700'
    }`}>
      {banner.message}
    </div>
  )
}

function SummaryCards({ summary }: { summary: OrgKpiPageData['summary'] }) {
  const cards = [
    { icon: <Target className="h-5 w-5" />, label: '총 KPI 수', value: `${summary.totalCount}개`, helper: '올해 기준 등록된 조직 KPI' },
    { icon: <CheckCircle2 className="h-5 w-5" />, label: '확정 KPI 수', value: `${summary.confirmedCount}개`, helper: `확정률 ${summary.confirmedRate}%` },
    { icon: <Link2 className="h-5 w-5" />, label: '미연결 KPI 수', value: `${summary.unlinkedCount}개`, helper: `월간 실적 연결 ${summary.monthlyCoverageRate}%` },
    { icon: <GitBranch className="h-5 w-5" />, label: '개인 KPI 연결 수', value: `${summary.linkedPersonalKpiCount}건`, helper: `cascade 연결률 ${summary.cascadeRate}%` },
    { icon: <AlertTriangle className="h-5 w-5" />, label: '위험 KPI 수', value: `${summary.riskCount}개`, helper: '연결 누락 / 실적 공백 / 달성률 저하' },
  ]

  return (
    <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <article key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-slate-500">{card.icon}</div>
          <p className="mt-4 text-sm text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{card.value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-400">{card.helper}</p>
        </article>
      ))}
      <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">다음 행동</p>
        <ul className="mt-4 space-y-2 text-sm text-blue-700">
          <li>미확정 KPI를 먼저 검토하세요.</li>
          <li>개인 KPI 연결 누락 항목을 우선 정리하세요.</li>
          <li>부서별 가중치 합과 하위 조직 배포 필요 항목을 확인하세요.</li>
        </ul>
      </article>
    </section>
  )
}

function Tabs({ activeTab, onChange }: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <section className="overflow-x-auto">
      <div className="flex min-w-max gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
          <button key={tab} type="button" onClick={() => onChange(tab)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </section>
  )
}

function MapSection(props: {
  tree: OrgKpiPageData['tree']
  selectedDepartmentId: string
  onDepartmentChange: (departmentId: string) => void
  selectedKpiId: string
  onSelectKpi: (id: string) => void
  selectedDepartmentNode: OrgKpiPageData['tree'][number] | null
  selectedKpi: OrgKpiViewModel | null
  onEdit: (kpi: OrgKpiViewModel) => void
  onStatusChange: (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => void
  onWorkflow: (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => void
  onOpenAi: (action: AiAction) => void
  permissions: OrgKpiPageData['permissions']
  busy: boolean
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <SectionHeading title="조직 트리" description="조직을 선택하면 KPI 카드와 상세 패널이 함께 바뀝니다." />
          {props.tree.map((node) => <DepartmentTreeButton key={node.departmentId} node={node} selectedDepartmentId={props.selectedDepartmentId} onDepartmentChange={props.onDepartmentChange} />)}
        </div>
        <div className="space-y-4">
          <SectionHeading title={props.selectedDepartmentNode?.departmentName ?? '목표 맵'} description="상위 조직 KPI와 하위 cascade 후보, 개인 KPI 연결 수를 함께 봅니다." />
          {!props.selectedDepartmentNode?.kpis.length ? (
            <EmptyPanel title="이 조직에는 아직 KPI가 없습니다." description="새 조직 KPI를 추가하거나 상위 조직 KPI와의 연결 후보를 먼저 확인해 보세요." />
          ) : (
            props.selectedDepartmentNode.kpis.map((kpi) => (
              <button key={kpi.id} type="button" onClick={() => props.onSelectKpi(kpi.id)} className={`w-full rounded-2xl border p-5 text-left transition ${props.selectedKpiId === kpi.id ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{kpi.title}</h3>
                      <StatusBadge status={kpi.status} />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{TYPE_LABELS[(kpi.type ?? 'QUANTITATIVE') as keyof typeof TYPE_LABELS]}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{kpi.category} · 목표 {formatNumber(kpi.targetValue)} {kpi.unit ?? ''}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm">개인 KPI {kpi.linkedPersonalKpiCount}건</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <InfoPill label="가중치" value={`${formatNumber(kpi.weight)}%`} />
                  <InfoPill label="최근 달성률" value={formatPercent(kpi.monthlyAchievementRate)} />
                  <InfoPill label="coverage" value={`${kpi.coverageRate}%`} />
                  <InfoPill label="owner" value={kpi.owner?.name ?? '미지정'} />
                </div>
              </button>
            ))
          )}
        </div>
        <KpiDetailPanel selectedKpi={props.selectedKpi} onEdit={props.onEdit} onStatusChange={props.onStatusChange} onWorkflow={props.onWorkflow} onOpenAi={props.onOpenAi} permissions={props.permissions} busy={props.busy} />
      </div>
    </section>
  )
}

function ListSection(props: {
  list: OrgKpiViewModel[]
  departments: OrgKpiPageData['departments']
  availableOwners: string[]
  departmentLevelMap: Map<string, number>
  filters: { status: string; linkage: string; owner: string; risk: string; level: string }
  setFilters: Dispatch<SetStateAction<{ status: string; linkage: string; owner: string; risk: string; level: string }>>
  selectedKpiId: string
  onSelectKpi: (id: string) => void
  selectedKpi: OrgKpiViewModel | null
  onEdit: (kpi: OrgKpiViewModel) => void
  onStatusChange: (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => void
  onWorkflow: (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => void
  permissions: OrgKpiPageData['permissions']
  busy: boolean
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeading title="KPI 목록" description="조직 레벨, 연결 여부, 위험도 기준으로 KPI를 빠르게 정렬하고 점검합니다." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect label="상태" value={props.filters.status} onChange={(value) => props.setFilters((current) => ({ ...current, status: value }))} options={[['ALL', '전체'], ['DRAFT', '초안'], ['SUBMITTED', '제출됨'], ['CONFIRMED', '확정'], ['LOCKED', '잠금'], ['ARCHIVED', '보관']]} />
          <FilterSelect label="연결 여부" value={props.filters.linkage} onChange={(value) => props.setFilters((current) => ({ ...current, linkage: value }))} options={[['ALL', '전체'], ['LINKED', '연결됨'], ['UNLINKED', '미연결']]} />
          <FilterSelect label="owner" value={props.filters.owner} onChange={(value) => props.setFilters((current) => ({ ...current, owner: value }))} options={[['ALL', '전체'], ...props.availableOwners.map((owner) => [owner, owner])]} />
          <FilterSelect label="위험도" value={props.filters.risk} onChange={(value) => props.setFilters((current) => ({ ...current, risk: value }))} options={[['ALL', '전체'], ['RISK', '위험만'], ['SAFE', '안정만']]} />
          <FilterSelect label="조직 레벨" value={props.filters.level} onChange={(value) => props.setFilters((current) => ({ ...current, level: value }))} options={[['ALL', '전체'], ...Array.from(new Set(props.departments.map((department) => String(department.level)))).map((level) => [level, `${level}레벨`])]} />
        </div>
        {!props.list.length ? (
          <EmptyPanel title="조건에 맞는 KPI가 없습니다." description="필터를 완화하거나 새로운 조직 KPI를 추가해 보세요." className="mt-6" />
        ) : (
          <div className="mt-6 space-y-4">
            {props.list.map((kpi) => (
              <button key={kpi.id} type="button" onClick={() => props.onSelectKpi(kpi.id)} className={`w-full rounded-2xl border p-4 text-left ${props.selectedKpiId === kpi.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{kpi.title}</h3>
                      <StatusBadge status={kpi.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{kpi.departmentName} · {kpi.category} · {TYPE_LABELS[(kpi.type ?? 'QUANTITATIVE') as keyof typeof TYPE_LABELS]}</p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{formatNumber(kpi.targetValue)} {kpi.unit ?? ''}</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatPercent(kpi.monthlyAchievementRate)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <InfoPill label="가중치" value={`${formatNumber(kpi.weight)}%`} />
                  <InfoPill label="owner" value={kpi.owner?.name ?? '미지정'} />
                  <InfoPill label="개인 KPI" value={`${kpi.linkedPersonalKpiCount}건`} />
                  <InfoPill label="조직 레벨" value={`${props.departmentLevelMap.get(kpi.departmentId) ?? 0}레벨`} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      <KpiDetailPanel selectedKpi={props.selectedKpi} onEdit={props.onEdit} onStatusChange={props.onStatusChange} onWorkflow={props.onWorkflow} onOpenAi={() => undefined} permissions={props.permissions} busy={props.busy} />
    </div>
  )
}

function LinkageSection({ linkage, selectedKpiId, onSelectKpi }: { linkage: OrgKpiLinkageItem[]; selectedKpiId: string; onSelectKpi: (id: string) => void }) {
  const riskyItems = linkage.filter((item) => item.riskLevel !== 'LOW')
  const departmentCoverage = Array.from(linkage.reduce((map, item) => {
    const current = map.get(item.departmentName) ?? { total: 0, linked: 0 }
    current.total += 1
    if (item.coverageRate > 0) current.linked += 1
    map.set(item.departmentName, current)
    return map
  }, new Map<string, { total: number; linked: number }>())).map(([departmentName, value]) => ({
    departmentName,
    rate: value.total ? Math.round((value.linked / value.total) * 100) : 0,
  }))

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeading title="연결 현황" description="전략-실행 연결이 끊긴 KPI를 coverage와 위험도로 함께 확인합니다." />
        <div className="mt-6 space-y-4">
          {linkage.map((item) => (
            <button key={item.orgKpiId} type="button" onClick={() => onSelectKpi(item.orgKpiId)} className={`w-full rounded-2xl border p-4 text-left ${selectedKpiId === item.orgKpiId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.departmentName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${RISK_CLASS[item.riskLevel]}`}>{item.riskLevel === 'HIGH' ? '위험 높음' : item.riskLevel === 'MEDIUM' ? '주의' : '안정'}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <InfoPill label="개인 KPI 연결" value={`${item.linkedPersonalKpiCount}/${item.targetPopulationCount}`} />
                <InfoPill label="coverage" value={`${item.coverageRate}%`} />
                <InfoPill label="최근 실적" value={item.hasRecentMonthlyRecord ? '있음' : '없음'} />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-6">
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading title="연결 누락 KPI" description="개인 KPI가 아직 연결되지 않았거나 최근 실적이 없는 항목입니다." />
          <div className="mt-5 space-y-3">
            {!riskyItems.length ? <p className="text-sm text-slate-500">눈에 띄는 연결 위험은 없습니다.</p> : riskyItems.slice(0, 8).map((item) => <button key={item.orgKpiId} type="button" onClick={() => onSelectKpi(item.orgKpiId)} className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-900">{item.title}</span><ChevronRight className="h-4 w-4 text-slate-400" /></div><p className="mt-1 text-xs text-slate-500">{item.departmentName} · coverage {item.coverageRate}%</p></button>)}
          </div>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading title="조직별 cascade율" description="조직 단위로 KPI 연결이 끊긴 지점을 확인합니다." />
          <div className="mt-5 space-y-3">
            {departmentCoverage.map((item) => (
              <div key={item.departmentName} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.departmentName}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.rate}%</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/kpi/personal" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">개인 KPI로 이동</Link>
            <Link href="/kpi/monthly" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">월간 실적으로 이동</Link>
          </div>
        </article>
      </section>
    </div>
  )
}

function HistorySection({ history, selectedKpi }: { history: OrgKpiTimelineItem[]; selectedKpi: OrgKpiViewModel | null }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeading title="감사 이력" description="생성, 수정, 제출, 확정, 잠금, owner 변경까지 감사 가능한 타임라인으로 확인합니다." />
        <div className="mt-6 space-y-4">
          {!history.length ? (
            <EmptyPanel title="이력 데이터가 없습니다." description="아직 기록된 조직 KPI 변경 이력이 없습니다." />
          ) : (
            history.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.action}</span>
                      {item.fromStatus || item.toStatus ? <span className="text-xs text-slate-400">{item.fromStatus ?? '-'} → {item.toStatus ?? '-'}</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.actor}</p>
                    {item.detail ? <p className="mt-2 text-sm text-slate-600">{item.detail}</p> : null}
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(item.at)}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeading title="선택 KPI 이력 요약" description="현재 선택 KPI의 최근 변경 흐름을 먼저 볼 수 있습니다." />
        <div className="mt-5 space-y-3">
          {!selectedKpi?.history.length ? <p className="text-sm text-slate-500">선택된 KPI의 이력이 아직 없습니다.</p> : selectedKpi.history.map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{item.action}</p><p className="text-xs text-slate-500">{formatDateTime(item.at)}</p></div><p className="mt-2 text-sm text-slate-600">{item.actor}</p>{item.fromStatus || item.toStatus ? <p className="mt-2 text-xs text-slate-500">{item.fromStatus ?? '-'} → {item.toStatus ?? '-'}</p> : null}</div>)}
        </div>
      </section>
    </div>
  )
}

function AiSection(props: {
  selectedKpi: OrgKpiViewModel | null
  form: FormState
  aiAction: AiAction
  aiBusy: boolean
  aiPreview: AiPreview | null
  aiLogs: OrgKpiAiLogItem[]
  canUseAi: boolean
  onRequest: (action: AiAction) => void
  onApply: () => void
  onReject: () => void
  decisionBusy: boolean
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SectionHeading title="AI 보조" description="OpenAI Responses API 기반으로 KPI 초안, 문장 개선, 리스크 점검을 보조합니다." />
        {!props.canUseAi ? (
          <EmptyPanel title="AI 보조를 사용할 수 없습니다." description="이 역할에서는 조회만 가능하고 AI 생성은 제한됩니다." className="mt-6" />
        ) : (
          <div className="mt-6 space-y-3">
            {(Object.keys(AI_ACTION_LABELS) as AiAction[]).map((action) => (
              <button key={action} type="button" onClick={() => props.onRequest(action)} disabled={props.aiBusy} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${props.aiAction === action ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'} disabled:opacity-60`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-100 p-2 text-slate-600"><Bot className="h-4 w-4" /></div>
                    <span className="text-sm font-semibold text-slate-900">{AI_ACTION_LABELS[action]}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading title={AI_ACTION_LABELS[props.aiAction]} description={props.selectedKpi ? `${props.selectedKpi.departmentName} · ${props.selectedKpi.title} 기준으로 결과를 생성합니다.` : '현재 입력 중인 초안 정보를 기준으로 결과를 생성합니다.'} />
          {props.aiBusy ? (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-6 text-sm text-blue-700">AI가 조직 KPI 문맥을 분석하고 있습니다. 응답이 실패하더라도 안전한 fallback 제안을 보여줍니다.</div>
          ) : !props.aiPreview ? (
            <EmptyPanel title="AI 결과 미리보기가 없습니다." description="왼쪽에서 원하는 보조 기능을 선택하면 결과를 preview 후 적용/반려할 수 있습니다." className="mt-6" />
          ) : (
            <div className="mt-6 space-y-4">
              <div className={`rounded-2xl border px-4 py-3 text-sm ${props.aiPreview.source === 'ai' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : props.aiPreview.source === 'disabled' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                {props.aiPreview.source === 'ai' ? 'OpenAI Responses API 결과입니다. 반드시 검토 후 적용하세요.' : props.aiPreview.source === 'disabled' ? `AI 기능이 비활성화되어 deterministic fallback을 보여줍니다.${props.aiPreview.fallbackReason ? ` (${props.aiPreview.fallbackReason})` : ''}` : `AI 호출 실패 또는 제한으로 fallback 결과를 보여줍니다.${props.aiPreview.fallbackReason ? ` (${props.aiPreview.fallbackReason})` : ''}`}
              </div>
              <AiPreviewPanel action={props.aiAction} result={props.aiPreview.result} />
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={props.onApply} disabled={props.decisionBusy} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"><Sparkles className="mr-2 h-4 w-4" />{props.aiAction === 'generate-draft' || props.aiAction === 'improve-wording' ? '검토 후 적용' : '확인 완료'}</button>
                <button type="button" onClick={props.onReject} disabled={props.decisionBusy} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">제안 반려</button>
              </div>
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeading title="AI 사용 로그" description="생성, 적용, 반려 흐름을 요청 로그 기준으로 확인합니다." />
          <div className="mt-5 space-y-3">
            {!props.aiLogs.length ? <p className="text-sm text-slate-500">최근 AI 요청 로그가 없습니다.</p> : props.aiLogs.map((log) => <div key={log.id} className="rounded-2xl bg-slate-50 px-4 py-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{log.sourceType}</span><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{log.requestStatus}</span><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{log.approvalStatus}</span></div><p className="mt-2 text-sm font-semibold text-slate-900">{log.summary}</p><p className="mt-1 text-xs text-slate-500">{log.requesterName}</p></div><p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p></div></div>)}
          </div>
        </section>
      </div>
    </div>
  )
}

function KpiDetailPanel(props: {
  selectedKpi: OrgKpiViewModel | null
  onEdit: (kpi: OrgKpiViewModel) => void
  onStatusChange: (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => void
  onWorkflow: (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => void
  onOpenAi: (action: AiAction) => void
  permissions: OrgKpiPageData['permissions']
  busy: boolean
}) {
  if (!props.selectedKpi) {
    return <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><EmptyPanel title="KPI를 선택하세요." description="목표 맵이나 목록에서 KPI를 선택하면 상세 패널이 열립니다." /></section>
  }

  const kpi = props.selectedKpi

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeading title="KPI 상세" description="정의, cascade 후보, 관련 개인 KPI, 월간 실적, 감사 이력을 한 번에 확인합니다." />
      <div className="mt-5 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-slate-900">{kpi.title}</h3><StatusBadge status={kpi.status} /></div>
          <p className="mt-2 text-sm text-slate-500">{kpi.departmentName} · {kpi.category} · {TYPE_LABELS[(kpi.type ?? 'QUANTITATIVE') as keyof typeof TYPE_LABELS]}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoPill label="목표값" value={`${formatNumber(kpi.targetValue)} ${kpi.unit ?? ''}`} />
          <InfoPill label="가중치" value={`${formatNumber(kpi.weight)}%`} />
          <InfoPill label="난이도" value={DIFFICULTY_LABELS[(kpi.difficulty ?? 'MEDIUM') as keyof typeof DIFFICULTY_LABELS]} />
          <InfoPill label="owner" value={kpi.owner?.name ?? '미지정'} />
        </div>
        <InfoBox title="정의" value={kpi.definition || '정의가 아직 작성되지 않았습니다.'} />
        <InfoBox title="산식" value={kpi.formula || '산식이 아직 작성되지 않았습니다.'} />
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">상위 KPI 추천</p>
          {kpi.suggestedParent ? <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{kpi.suggestedParent.departmentName} · {kpi.suggestedParent.title}</div> : <p className="mt-3 text-sm text-slate-500">현재 범위에서 추천 가능한 상위 KPI가 없습니다.</p>}
          <p className="mt-4 text-sm font-semibold text-slate-900">하위 cascade 후보</p>
          <div className="mt-3 space-y-2">
            {!kpi.suggestedChildren.length ? <p className="text-sm text-slate-500">하위 조직 KPI 후보가 아직 없습니다.</p> : kpi.suggestedChildren.map((child) => <div key={child.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{child.departmentName} · {child.title}</div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">관련 개인 KPI</p>
          <div className="mt-3 space-y-2">
            {!kpi.linkedPersonalKpis.length ? <p className="text-sm text-slate-500">아직 연결된 개인 KPI가 없습니다.</p> : kpi.linkedPersonalKpis.map((item) => <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{item.employeeName}</p><p className="mt-1 text-xs text-slate-500">{item.employeeId} · {item.title}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{item.status}</span></div></div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">최근 월간 실적</p>
          <div className="mt-3 space-y-2">
            {!kpi.recentMonthlyRecords.length ? <p className="text-sm text-slate-500">최근 월간 실적 데이터가 없습니다.</p> : kpi.recentMonthlyRecords.map((record) => <div key={record.id} className="rounded-2xl bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{record.employeeName}</p><p className="mt-1 text-xs text-slate-500">{record.month}</p></div><span className="text-sm font-semibold text-slate-900">{formatPercent(record.achievementRate)}</span></div>{record.comment ? <p className="mt-2 text-sm text-slate-600">{record.comment}</p> : null}</div>)}
          </div>
        </div>
        {kpi.riskFlags.length ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"><p className="text-sm font-semibold text-rose-700">linkage risk warning</p><div className="mt-3 flex flex-wrap gap-2">{kpi.riskFlags.map((flag) => <span key={flag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-rose-700">{flag}</span>)}</div></div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionButton label="수정" icon={<FilePenLine className="h-4 w-4" />} onClick={() => props.onEdit(kpi)} disabled={!props.permissions.canManage || kpi.status !== 'DRAFT' || props.busy} />
          <ActionButton label={kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? '재오픈' : '제출'} icon={<Send className="h-4 w-4" />} onClick={() => props.onWorkflow(kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? 'REOPEN' : 'SUBMIT')} disabled={props.busy || !props.permissions.canManage || !['DRAFT', 'SUBMITTED', 'LOCKED'].includes(kpi.status)} />
          <ActionButton label="확정" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => props.onStatusChange('CONFIRMED')} disabled={props.busy || !props.permissions.canConfirm || ['CONFIRMED', 'LOCKED'].includes(kpi.status)} />
          <ActionButton label="잠금" icon={<Lock className="h-4 w-4" />} onClick={() => props.onWorkflow('LOCK')} disabled={props.busy || !props.permissions.canLock || kpi.status !== 'CONFIRMED'} />
          <ActionButton label="보관" icon={<Archive className="h-4 w-4" />} onClick={() => props.onStatusChange('ARCHIVED')} disabled={props.busy || !props.permissions.canArchive || kpi.status === 'ARCHIVED'} />
          <ActionButton label="AI로 다듬기" icon={<Wand2 className="h-4 w-4" />} onClick={() => props.onOpenAi('improve-wording')} disabled={false} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/kpi/personal" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">개인 KPI 보기</Link>
          <Link href="/kpi/monthly" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">월간 실적 보기</Link>
          <Link href="/evaluation/results" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">평가 결과 보기</Link>
          <Link href="/evaluation/assistant" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">AI 보조 작성</Link>
        </div>
      </div>
    </section>
  )
}

function KpiFormModal(props: {
  departments: OrgKpiPageData['departments']
  form: FormState
  onClose: () => void
  onChange: Dispatch<SetStateAction<FormState>>
  onSubmit: () => void
  editing: boolean
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Org KPI Form</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{props.editing ? '조직 KPI 수정' : '조직 KPI 추가'}</h2>
            <p className="mt-2 text-sm text-slate-500">측정 가능한 조직 KPI를 작성하고, 개인 KPI와 월간 실적으로 이어질 수 있는지 함께 점검하세요.</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">닫기</button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="부서"><select value={props.form.deptId} onChange={(event) => props.onChange((current) => ({ ...current, deptId: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">{props.departments.map((department) => <option key={department.id} value={department.id}>{'　'.repeat(department.level)}{department.name}</option>)}</select></Field>
          <Field label="평가 연도"><input type="number" value={props.form.evalYear} onChange={(event) => props.onChange((current) => ({ ...current, evalYear: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
          <Field label="KPI 유형"><select value={props.form.kpiType} onChange={(event) => props.onChange((current) => ({ ...current, kpiType: event.target.value as FormState['kpiType'] }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="QUANTITATIVE">정량</option><option value="QUALITATIVE">정성</option></select></Field>
          <Field label="난이도"><select value={props.form.difficulty} onChange={(event) => props.onChange((current) => ({ ...current, difficulty: event.target.value as FormState['difficulty'] }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="HIGH">높음</option><option value="MEDIUM">중간</option><option value="LOW">낮음</option></select></Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="KPI 카테고리"><input value={props.form.kpiCategory} onChange={(event) => props.onChange((current) => ({ ...current, kpiCategory: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="예: 매출, 고객 성공, 운영 효율" /></Field>
          <Field label="KPI명"><input value={props.form.kpiName} onChange={(event) => props.onChange((current) => ({ ...current, kpiName: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="예: 핵심 고객 유지율 개선" /></Field>
          <Field label="정의"><textarea value={props.form.definition} onChange={(event) => props.onChange((current) => ({ ...current, definition: event.target.value }))} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
          <Field label="산식"><textarea value={props.form.formula} onChange={(event) => props.onChange((current) => ({ ...current, formula: event.target.value }))} rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="목표값"><input value={props.form.targetValue} onChange={(event) => props.onChange((current) => ({ ...current, targetValue: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
          <Field label="단위"><input value={props.form.unit} onChange={(event) => props.onChange((current) => ({ ...current, unit: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
          <Field label="가중치"><input value={props.form.weight} onChange={(event) => props.onChange((current) => ({ ...current, weight: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5" /></Field>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ActionButton label="취소" icon={<ChevronRight className="h-4 w-4 rotate-180" />} onClick={props.onClose} disabled={false} />
          <button type="button" onClick={props.onSubmit} disabled={props.busy} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{props.busy ? '저장 중...' : props.editing ? '수정 저장' : '조직 KPI 저장'}</button>
        </div>
      </div>
    </div>
  )
}

function DepartmentTreeButton({ node, selectedDepartmentId, onDepartmentChange }: { node: OrgKpiPageData['tree'][number]; selectedDepartmentId: string; onDepartmentChange: (departmentId: string) => void }) {
  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onDepartmentChange(node.departmentId)} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${node.departmentId === selectedDepartmentId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-slate-100 p-2 text-slate-600"><Building2 className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-900">{node.departmentName}</p><p className="mt-1 text-xs text-slate-500">{node.kpis.length}개 KPI</p></div></div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
      </button>
      {node.children.length ? <div className="ml-4 space-y-2 border-l border-dashed border-slate-200 pl-3">{node.children.map((child) => <DepartmentTreeButton key={child.departmentId} node={child} selectedDepartmentId={selectedDepartmentId} onDepartmentChange={onDepartmentChange} />)}</div> : null}
    </div>
  )
}

function QuickLinks() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeading title="연결 화면" description="조직 KPI는 개인 KPI, 월간 실적, 평가 결과와 이어집니다." />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {[
          ['/kpi/personal', '개인 KPI'],
          ['/kpi/monthly', '월간 실적'],
          ['/evaluation/results', '평가 결과'],
          ['/evaluation/assistant', 'AI 보조 작성'],
        ].map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{label}<ArrowRight className="h-4 w-4" /></Link>)}
      </div>
    </section>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) { return <div><h2 className="text-lg font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div> }
function EmptyPanel({ title, description, className = '' }: { title: string; description: string; className?: string }) { return <div className={`rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center ${className}`}><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div> }
function StatusBadge({ status }: { status: OrgKpiViewModel['status'] }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}>{STATUS_LABELS[status]}</span> }
function InfoPill({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div> }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></Field> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">{label}</span>{children}</label> }
function ActionButton({ label, icon, onClick, disabled }: { label: string; icon: ReactNode; onClick: () => void; disabled: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><span className="mr-2">{icon}</span>{label}</button> }
function InfoBox({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><p className="font-semibold text-slate-900">{title}</p><p className="mt-2 leading-6">{value}</p></div> }

function AiPreviewPanel({ action, result }: { action: AiAction; result: Record<string, unknown> }) {
  if (action === 'generate-draft') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <p className="text-base font-semibold text-slate-900">{String(result.title ?? '-')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoPill label="카테고리" value={String(result.category ?? '-')} />
          <InfoPill label="목표값" value={String(result.targetValueSuggestion ?? '-')} />
          <InfoPill label="단위" value={String(result.unit ?? '-')} />
          <InfoPill label="가중치 제안" value={String(result.weightSuggestion ?? '-')} />
        </div>
        <div className="mt-4 space-y-4">
          <InfoBox title="정의" value={String(result.definition ?? '-')} />
          <InfoBox title="산식" value={String(result.formula ?? '-')} />
          <SimpleList title="검토 포인트" items={toStringArray(result.reviewPoints)} />
        </div>
      </div>
    )
  }

  if (action === 'improve-wording') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
        <InfoBox title="개선된 KPI명" value={String(result.improvedTitle ?? '-')} />
        <div className="mt-4">
          <InfoBox title="개선된 정의" value={String(result.improvedDefinition ?? '-')} />
        </div>
        <div className="mt-4">
          <SimpleList title="개선 이유" items={toStringArray(result.rationale)} />
        </div>
      </div>
    )
  }

  if (action === 'smart-check') {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoPill label="종합 판단" value={String(result.overall ?? '-')} />
          <InfoPill label="요약" value={String(result.summary ?? '-')} />
        </div>
        {toObjectArray(result.criteria).map((item, index) => (
          <div key={`${String(item.name ?? 'criteria')}-${index}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{String(item.name ?? '-')}</p>
            <p className="mt-1 text-xs text-slate-500">{String(item.status ?? '-')}</p>
            <p className="mt-2">{String(item.reason ?? '-')}</p>
            <p className="mt-2 text-blue-700">제안: {String(item.suggestion ?? '-')}</p>
          </div>
        ))}
      </div>
    )
  }

  if (action === 'detect-duplicates') {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <InfoBox title="요약" value={String(result.summary ?? '-')} />
        {toObjectArray(result.duplicates).map((item, index) => (
          <div key={`${String(item.title ?? 'duplicate')}-${index}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">{String(item.title ?? '-')}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{String(item.overlapLevel ?? '-')}</span>
            </div>
            <p className="mt-2">{String(item.similarityReason ?? '-')}</p>
          </div>
        ))}
      </div>
    )
  }

  if (action === 'suggest-alignment') {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoPill label="추천 상위 KPI" value={String(result.recommendedParentTitle ?? '없음')} />
          <InfoPill label="위험도" value={String(result.riskLevel ?? '-')} />
        </div>
        <InfoBox title="정렬 추천 근거" value={String(result.rationale ?? '-')} />
        <SimpleList title="추천 연결 포인트" items={toStringArray(result.suggestedLinks)} />
      </div>
    )
  }

  if (action === 'summarize-risk') {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <InfoPill label="리스크 수준" value={String(result.riskLevel ?? '-')} />
        <InfoBox title="운영 요약" value={String(result.executiveSummary ?? '-')} />
        <SimpleList title="주요 리스크" items={toStringArray(result.risks)} />
        <SimpleList title="권장 조치" items={toStringArray(result.recommendations)} />
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <InfoBox title="코멘트 초안" value={String(result.comment ?? '-')} />
      <SimpleList title="성과 포인트" items={toStringArray(result.highlights)} />
      <SimpleList title="우려 포인트" items={toStringArray(result.concerns)} />
      <SimpleList title="다음 액션" items={toStringArray(result.nextActions)} />
    </div>
  )
}

function SimpleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">{item}</div>) : <p className="text-sm text-slate-500">표시할 항목이 없습니다.</p>}
      </div>
    </div>
  )
}
