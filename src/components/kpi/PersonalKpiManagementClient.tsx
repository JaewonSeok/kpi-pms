'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  GitBranch,
  History,
  Layers3,
  Link2,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  Wand2,
  X,
} from 'lucide-react'
import type {
  PersonalKpiAiLogItem,
  PersonalKpiPageData,
  PersonalKpiReviewQueueItem,
  PersonalKpiTimelineItem,
  PersonalKpiViewModel,
} from '@/server/personal-kpi-page'
import { DIFFICULTY_LABELS, KPI_TYPE_LABELS } from '@/lib/utils'

type ClientProps = PersonalKpiPageData & {
  initialTab?: string
  initialKpiId?: string
}

type TabKey = 'mine' | 'review' | 'history' | 'ai'

type BannerState = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type FormState = {
  employeeId: string
  evalYear: number
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

type AiAction =
  | 'generate-draft'
  | 'improve-wording'
  | 'smart-check'
  | 'suggest-weight'
  | 'suggest-org-alignment'
  | 'detect-duplicates'
  | 'summarize-review-risks'
  | 'draft-monthly-comment'

type AiPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  result: Record<string, unknown>
  fallbackReason?: string | null
}

const TAB_LABELS: Record<TabKey, string> = {
  mine: '내 KPI',
  review: '검토 대기',
  history: '변경 이력',
  ai: 'AI 보조',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  SUBMITTED: '제출됨',
  MANAGER_REVIEW: '검토 중',
  CONFIRMED: '확정',
  LOCKED: '잠금',
  ARCHIVED: '보관',
  MIXED: '혼합',
}

const INPUT_CLASS =
  'min-h-11 w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400'

function buildEmptyForm(selectedYear: number, employeeId: string): FormState {
  return {
    employeeId,
    evalYear: selectedYear,
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
}

export function PersonalKpiManagementClient({
  initialTab,
  initialKpiId,
  ...props
}: ClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab === 'review' || initialTab === 'history' || initialTab === 'ai' ? initialTab : 'mine'
  )
  const [selectedKpiId, setSelectedKpiId] = useState(initialKpiId ?? props.mine[0]?.id ?? '')
  const [selectedReviewId, setSelectedReviewId] = useState(props.reviewQueue[0]?.id ?? '')
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorSaving, setEditorSaving] = useState(false)
  const [workflowSaving, setWorkflowSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [form, setForm] = useState<FormState>(() =>
    buildEmptyForm(props.selectedYear, props.selectedEmployeeId)
  )
  const [filters, setFilters] = useState({
    status: 'ALL',
    type: 'ALL',
    linkage: 'ALL',
    difficulty: 'ALL',
    rejectedOnly: false,
  })
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'SUBMITTED' | 'MANAGER_REVIEW'>('ALL')

  const selectedEmployee = useMemo(
    () => props.employeeOptions.find((item) => item.id === props.selectedEmployeeId),
    [props.employeeOptions, props.selectedEmployeeId]
  )

  const selectedKpi = useMemo(
    () => props.mine.find((item) => item.id === selectedKpiId) ?? props.mine[0] ?? null,
    [props.mine, selectedKpiId]
  )

  const selectedReview = useMemo(
    () => props.reviewQueue.find((item) => item.id === selectedReviewId) ?? props.reviewQueue[0] ?? null,
    [props.reviewQueue, selectedReviewId]
  )

  const filteredMine = useMemo(() => {
    return props.mine.filter((item) => {
      if (filters.status !== 'ALL' && item.status !== filters.status) return false
      if (filters.type !== 'ALL' && item.type !== filters.type) return false
      if (filters.linkage === 'LINKED' && !item.orgKpiId) return false
      if (filters.linkage === 'UNLINKED' && item.orgKpiId) return false
      if (filters.difficulty !== 'ALL' && item.difficulty !== filters.difficulty) return false
      if (filters.rejectedOnly && !item.hasRejectedRevision) return false
      return true
    })
  }, [filters, props.mine])

  const filteredReviewQueue = useMemo(() => {
    return props.reviewQueue.filter((item) => reviewFilter === 'ALL' || item.status === reviewFilter)
  }, [props.reviewQueue, reviewFilter])

  useEffect(() => {
    if (!selectedKpiId && props.mine[0]) {
      setSelectedKpiId(props.mine[0].id)
    }
  }, [props.mine, selectedKpiId])

  function updateRoute(next: { year?: number; employeeId?: string; cycleId?: string }) {
    const params = new URLSearchParams()
    params.set('year', String(next.year ?? props.selectedYear))
    params.set('employeeId', next.employeeId ?? props.selectedEmployeeId)
    if (next.cycleId ?? props.selectedCycleId) {
      params.set('cycleId', next.cycleId ?? props.selectedCycleId ?? '')
    }
    params.set('tab', activeTab)
    if (selectedKpiId) params.set('kpiId', selectedKpiId)
    startTransition(() => {
      router.push(`/kpi/personal?${params.toString()}`)
    })
  }

  function openCreateModal() {
    setEditorMode('create')
    setForm(buildEmptyForm(props.selectedYear, props.selectedEmployeeId))
    setAiPreview(null)
    setEditorOpen(true)
  }

  function openEditModal(kpi: PersonalKpiViewModel) {
    setEditorMode('edit')
    setForm({
      employeeId: kpi.employeeId,
      evalYear: props.selectedYear,
      kpiType: kpi.type,
      kpiName: kpi.title,
      definition: kpi.definition ?? '',
      formula: kpi.formula ?? '',
      targetValue: kpi.targetValue != null ? String(kpi.targetValue) : '',
      unit: kpi.unit ?? '',
      weight: String(kpi.weight),
      difficulty: (kpi.difficulty ?? 'MEDIUM') as FormState['difficulty'],
      linkedOrgKpiId: kpi.orgKpiId ?? '',
    })
    setAiPreview(null)
    setEditorOpen(true)
  }

  async function saveKpi() {
    try {
      setEditorSaving(true)
      setBanner(null)

      const payload = {
        employeeId: form.employeeId,
        evalYear: form.evalYear,
        kpiType: form.kpiType,
        kpiName: form.kpiName.trim(),
        definition: form.definition.trim() || undefined,
        formula: form.formula.trim() || undefined,
        targetValue: form.targetValue ? Number(form.targetValue) : null,
        unit: form.unit.trim() || undefined,
        weight: Number(form.weight),
        difficulty: form.difficulty,
        linkedOrgKpiId: form.linkedOrgKpiId || null,
      }

      const endpoint =
        editorMode === 'create'
          ? '/api/kpi/personal'
          : `/api/kpi/personal/${encodeURIComponent(selectedKpi?.id ?? '')}`
      const method = editorMode === 'create' ? 'POST' : 'PATCH'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '개인 KPI 저장에 실패했습니다.')
      }

      setBanner({ tone: 'success', message: editorMode === 'create' ? '개인 KPI를 추가했습니다.' : '개인 KPI를 수정했습니다.' })
      setEditorOpen(false)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '개인 KPI 저장 중 문제가 발생했습니다.' })
    } finally {
      setEditorSaving(false)
    }
  }

  async function runWorkflow(action: string, id: string, note?: string) {
    try {
      setWorkflowSaving(true)
      setBanner(null)
      const response = await fetch(`/api/kpi/personal/${encodeURIComponent(id)}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '상태 변경에 실패했습니다.')
      }
      setBanner({ tone: 'success', message: '상태를 업데이트했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '상태 변경 중 문제가 발생했습니다.' })
    } finally {
      setWorkflowSaving(false)
    }
  }

  async function runAi(action: AiAction) {
    try {
      setAiLoading(true)
      setBanner(null)

      const payload = buildAiPayload(action, {
        selectedKpi,
        allKpis: props.mine,
        orgKpiOptions: props.orgKpiOptions,
        selectedEmployeeName: selectedEmployee?.name,
      })

      const response = await fetch('/api/kpi/personal/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: selectedKpi?.id,
          payload,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 보조를 실행하지 못했습니다.')
      }
      setAiPreview(json.data)
      setActiveTab('ai')
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 보조 실행 중 문제가 발생했습니다.' })
    } finally {
      setAiLoading(false)
    }
  }

  async function decideAi(action: 'approve' | 'reject') {
    if (!aiPreview?.requestLogId) return

    try {
      const response = await fetch(`/api/ai/request-logs/${encodeURIComponent(aiPreview.requestLogId)}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? aiPreview.result : undefined,
          rejectionReason: action === 'reject' ? '사용자가 개인 KPI AI 결과를 반려했습니다.' : undefined,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 결과 반영에 실패했습니다.')
      }

      if (action === 'approve') {
        applyAiResultToForm(aiPreview.result)
      }

      setBanner({ tone: 'success', message: action === 'approve' ? 'AI 결과를 반영했습니다.' : 'AI 결과를 반려했습니다.' })
      setAiPreview(null)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 결정 처리 중 문제가 발생했습니다.' })
    }
  }

  function applyAiResultToForm(result: Record<string, unknown>) {
    setEditorMode(selectedKpi ? 'edit' : 'create')
    setForm((current) => ({
      ...current,
      kpiName: stringValue(result.title) || stringValue(result.improvedTitle) || current.kpiName,
      definition: stringValue(result.definition) || stringValue(result.improvedDefinition) || current.definition,
      formula: stringValue(result.formula) || current.formula,
      targetValue: stringValue(result.targetValueSuggestion) || current.targetValue,
      unit: stringValue(result.unit) || current.unit,
      weight: numberValue(result.weightSuggestion) != null ? String(numberValue(result.weightSuggestion)) : current.weight,
      difficulty:
        (stringValue(result.difficultySuggestion) as FormState['difficulty'] | undefined) ?? current.difficulty,
    }))
    setEditorOpen(true)
  }

  const nextActionCards = [
    props.summary.totalWeight < 100
      ? '가중치 100 맞추기'
      : props.summary.totalWeight > 100
        ? '가중치 초과 조정'
        : '가중치 기준 충족',
    props.summary.linkedOrgKpiCount < props.summary.totalCount ? '조직 KPI 연결 누락 확인' : '조직 KPI 연결 상태 양호',
    props.summary.rejectedCount > 0 ? '반려된 KPI 수정' : '반려 건 없음',
    '월간 실적 입력으로 이동',
  ]

  if (props.state !== 'ready') {
    return (
      <div className="space-y-6">
        <PageHeader />
        <HeroSection
          summary={props.summary}
          selectedYear={props.selectedYear}
          years={props.availableYears}
          selectedCycleId={props.selectedCycleId}
          cycleOptions={props.cycleOptions}
          selectedEmployeeId={props.selectedEmployeeId}
          employeeOptions={props.employeeOptions}
          overallStatus={props.summary.overallStatus}
          onYearChange={(year) => updateRoute({ year })}
          onCycleChange={(cycleId) => updateRoute({ cycleId })}
          onEmployeeChange={(employeeId) => updateRoute({ employeeId })}
          onOpenCreate={openCreateModal}
          onOpenAiDraft={() => {
            openCreateModal()
            setActiveTab('ai')
          }}
          onSubmitSelected={() => selectedKpi && runWorkflow('SUBMIT', selectedKpi.id)}
          onOpenHistory={() => setActiveTab('history')}
          onOpenReview={() => setActiveTab('review')}
          canCreate={props.permissions.canCreate}
          canSubmit={props.permissions.canSubmit}
          selectedKpi={selectedKpi}
          workflowSaving={workflowSaving || isPending}
        />
        <StatePanel state={props.state} message={props.message} />
        <QuickLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <HeroSection
        summary={props.summary}
        selectedYear={props.selectedYear}
        years={props.availableYears}
        selectedCycleId={props.selectedCycleId}
        cycleOptions={props.cycleOptions}
        selectedEmployeeId={props.selectedEmployeeId}
        employeeOptions={props.employeeOptions}
        overallStatus={props.summary.overallStatus}
        onYearChange={(year) => updateRoute({ year })}
        onCycleChange={(cycleId) => updateRoute({ cycleId })}
        onEmployeeChange={(employeeId) => updateRoute({ employeeId })}
        onOpenCreate={openCreateModal}
        onOpenAiDraft={() => {
          openCreateModal()
          setActiveTab('ai')
        }}
        onSubmitSelected={() => selectedKpi && runWorkflow('SUBMIT', selectedKpi.id)}
        onOpenHistory={() => setActiveTab('history')}
        onOpenReview={() => setActiveTab('review')}
        canCreate={props.permissions.canCreate}
        canSubmit={props.permissions.canSubmit}
        selectedKpi={selectedKpi}
        workflowSaving={workflowSaving || isPending}
      />

      {banner ? <Banner tone={banner.tone}>{banner.message}</Banner> : null}

      <SummaryCards summary={props.summary} nextActions={nextActionCards} canUseAi={props.permissions.canUseAi} />

      <Tabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'mine' ? (
        <MineSection
          items={filteredMine}
          selectedKpiId={selectedKpi?.id}
          onSelectKpi={setSelectedKpiId}
          detail={
            <DetailPanel
              kpi={selectedKpi}
              canEdit={props.permissions.canEdit}
              canReview={props.permissions.canReview}
              canLock={props.permissions.canLock}
              workflowSaving={workflowSaving}
              onEdit={() => selectedKpi && openEditModal(selectedKpi)}
              onSubmit={() => selectedKpi && runWorkflow('SUBMIT', selectedKpi.id)}
              onStartReview={() => selectedKpi && runWorkflow('START_REVIEW', selectedKpi.id)}
              onApprove={() => selectedKpi && runWorkflow('APPROVE', selectedKpi.id, reviewNote)}
              onReject={() => selectedKpi && runWorkflow('REJECT', selectedKpi.id, reviewNote)}
              onLock={() => selectedKpi && runWorkflow('LOCK', selectedKpi.id)}
              onReopen={() => selectedKpi && runWorkflow('REOPEN', selectedKpi.id)}
              reviewNote={reviewNote}
              onReviewNoteChange={setReviewNote}
            />
          }
          filters={filters}
          onFiltersChange={setFilters}
        />
      ) : null}

      {activeTab === 'review' ? (
        <ReviewQueueSection
          items={filteredReviewQueue}
          selectedId={selectedReview?.id}
          onSelect={setSelectedReviewId}
          filter={reviewFilter}
          onFilterChange={setReviewFilter}
          onApprove={(id, note) => runWorkflow('APPROVE', id, note)}
          onReject={(id, note) => runWorkflow('REJECT', id, note)}
          onStartReview={(id) => runWorkflow('START_REVIEW', id)}
          busy={workflowSaving}
        />
      ) : null}

      {activeTab === 'history' ? (
        <HistorySection
          history={props.history}
          aiLogs={props.aiLogs}
          selectedKpi={selectedKpi}
        />
      ) : null}

      {activeTab === 'ai' ? (
        <AiSection
          enabled={props.permissions.canUseAi}
          logs={props.aiLogs}
          selectedKpi={selectedKpi}
          selectedEmployeeName={selectedEmployee?.name ?? props.actor.name}
          onRun={runAi}
          preview={aiPreview}
          onApply={() => decideAi('approve')}
          onReject={() => decideAi('reject')}
          loading={aiLoading}
        />
      ) : null}

      <QuickLinks />

      {editorOpen ? (
        <EditorModal
          mode={editorMode}
          form={form}
          onChange={setForm}
          onClose={() => setEditorOpen(false)}
          onSubmit={saveKpi}
          saving={editorSaving}
          orgKpiOptions={props.orgKpiOptions}
          totalWeight={props.summary.totalWeight}
          selectedKpi={selectedKpi}
          selectedEmployeeName={selectedEmployee?.name ?? props.actor.name}
          onRequestAiDraft={() => runAi('generate-draft')}
          aiLoading={aiLoading}
        />
      ) : null}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Personal KPI Workspace</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">개인 KPI</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            조직 KPI와 연결된 개인 목표를 작성하고, 상사 검토와 월간 실적·체크인·평가 결과까지 이어지는 기준 레코드를 운영합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function HeroSection(props: {
  summary: ClientProps['summary']
  selectedYear: number
  years: number[]
  selectedCycleId?: string
  cycleOptions: ClientProps['cycleOptions']
  selectedEmployeeId: string
  employeeOptions: ClientProps['employeeOptions']
  overallStatus: string
  onYearChange: (year: number) => void
  onCycleChange: (cycleId: string) => void
  onEmployeeChange: (employeeId: string) => void
  onOpenCreate: () => void
  onOpenAiDraft: () => void
  onSubmitSelected: () => void
  onOpenReview: () => void
  onOpenHistory: () => void
  canCreate: boolean
  canSubmit: boolean
  selectedKpi: PersonalKpiViewModel | null
  workflowSaving: boolean
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-xl shadow-slate-900/10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={props.overallStatus} />
            <InfoPill label="총 KPI 수" value={`${props.summary.totalCount}건`} inverse />
            <InfoPill label="총 가중치" value={`${props.summary.totalWeight}%`} inverse />
            <InfoPill label="남은 가중치" value={`${props.summary.remainingWeight}%`} inverse />
            <InfoPill label="조직 KPI 연결률" value={`${props.summary.totalCount ? Math.round((props.summary.linkedOrgKpiCount / props.summary.totalCount) * 100) : 0}%`} inverse />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SelectorCard
              label="연도"
              value={String(props.selectedYear)}
              options={props.years.map((year) => ({ value: String(year), label: `${year}년` }))}
              onChange={(value) => props.onYearChange(Number(value))}
            />
            <SelectorCard
              label="평가 주기"
              value={props.selectedCycleId ?? ''}
              options={(props.cycleOptions.length ? props.cycleOptions : [{ id: '', name: '주기 없음', year: props.selectedYear, status: 'SETUP' }]).map((item) => ({ value: item.id, label: item.name }))}
              onChange={props.onCycleChange}
            />
            <SelectorCard
              label="대상자"
              value={props.selectedEmployeeId}
              options={props.employeeOptions.map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.departmentName}`,
              }))}
              onChange={props.onEmployeeChange}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
          {props.canCreate ? (
            <ActionButton onClick={props.onOpenCreate} icon={<Plus className="h-4 w-4" />}>
              KPI 추가
            </ActionButton>
          ) : null}
          <ActionButton onClick={props.onOpenAiDraft} icon={<Sparkles className="h-4 w-4" />}>
            AI 초안 생성
          </ActionButton>
          {props.canSubmit ? (
            <ActionButton
              onClick={props.onSubmitSelected}
              disabled={!props.selectedKpi || props.selectedKpi.status !== 'DRAFT' || props.workflowSaving}
              icon={<Save className="h-4 w-4" />}
            >
              제출
            </ActionButton>
          ) : null}
          <ActionButton onClick={props.onOpenReview} icon={<ClipboardList className="h-4 w-4" />}>
            검토 요청
          </ActionButton>
          <ActionButton onClick={props.onOpenHistory} icon={<History className="h-4 w-4" />}>
            이력 보기
          </ActionButton>
        </div>
      </div>
    </section>
  )
}

function SummaryCards(props: {
  summary: ClientProps['summary']
  nextActions: string[]
  canUseAi: boolean
}) {
  const cards = [
    {
      icon: <Target className="h-5 w-5" />,
      label: '총 KPI 수',
      value: `${props.summary.totalCount}건`,
      helper: '개인 목표 포트폴리오',
    },
    {
      icon: <Layers3 className="h-5 w-5" />,
      label: '총 가중치 / 남은 가중치',
      value: `${props.summary.totalWeight}% / ${props.summary.remainingWeight}%`,
      helper: props.summary.totalWeight === 100 ? '가중치 기준 충족' : '가중치 조정 필요',
      tone: props.summary.totalWeight > 100 ? 'warn' : props.summary.totalWeight === 100 ? 'ok' : 'default',
    },
    {
      icon: <Link2 className="h-5 w-5" />,
      label: '연결된 조직 KPI 수',
      value: `${props.summary.linkedOrgKpiCount}건`,
      helper: '조직 목표와 정렬된 개인 KPI',
    },
    {
      icon: <Clock3 className="h-5 w-5" />,
      label: '검토 대기 수',
      value: `${props.summary.reviewPendingCount}건`,
      helper: '리더가 확인해야 할 KPI',
    },
    {
      icon: <ShieldAlert className="h-5 w-5" />,
      label: '반려 건수',
      value: `${props.summary.rejectedCount}건`,
      helper: props.summary.rejectedCount > 0 ? '반려 사유 확인 필요' : '수정 필요 항목 없음',
      tone: props.summary.rejectedCount > 0 ? 'warn' : 'ok',
    },
    {
      icon: <GitBranch className="h-5 w-5" />,
      label: '최근 월간 실적 반영률',
      value: `${props.summary.monthlyCoverageRate}%`,
      helper: '최근 실적과 연결된 KPI 비율',
    },
  ] as const

  return (
    <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">다음 행동</p>
            <p className="mt-1 text-sm text-slate-500">작성, 검토, 월간 실적 연결까지 끊기지 않게 다음 단계를 정리했습니다.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${props.canUseAi ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {props.canUseAi ? 'AI 보조 가능' : 'AI 비활성'}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {props.nextActions.map((item, index) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-500">{index + 1}</span>
              <p className="text-sm font-medium text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Tabs(props: { activeTab: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="overflow-x-auto rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-max gap-2">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => props.onChange(tab)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${
              props.activeTab === tab ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  )
}

function MineSection(props: {
  items: PersonalKpiViewModel[]
  selectedKpiId?: string | null
  onSelectKpi: (id: string) => void
  detail: ReactNode
  filters: {
    status: string
    type: string
    linkage: string
    difficulty: string
    rejectedOnly: boolean
  }
  onFiltersChange: (value: {
    status: string
    type: string
    linkage: string
    difficulty: string
    rejectedOnly: boolean
  }) => void
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">내 KPI</h2>
            <p className="mt-1 text-sm text-slate-500">조직 KPI 연결, 상태, 최근 실적까지 한 번에 확인할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MiniSelect
              value={props.filters.status}
              options={[
                { value: 'ALL', label: '전체 상태' },
                { value: 'DRAFT', label: '초안' },
                { value: 'SUBMITTED', label: '제출됨' },
                { value: 'MANAGER_REVIEW', label: '검토 중' },
                { value: 'CONFIRMED', label: '확정' },
                { value: 'LOCKED', label: '잠금' },
              ]}
              onChange={(status) => props.onFiltersChange({ ...props.filters, status })}
            />
            <MiniSelect
              value={props.filters.type}
              options={[
                { value: 'ALL', label: '전체 유형' },
                { value: 'QUANTITATIVE', label: '정량' },
                { value: 'QUALITATIVE', label: '정성' },
              ]}
              onChange={(type) => props.onFiltersChange({ ...props.filters, type })}
            />
            <MiniSelect
              value={props.filters.linkage}
              options={[
                { value: 'ALL', label: '전체 연결' },
                { value: 'LINKED', label: '조직 KPI 연결' },
                { value: 'UNLINKED', label: '미연결' },
              ]}
              onChange={(linkage) => props.onFiltersChange({ ...props.filters, linkage })}
            />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={props.filters.rejectedOnly}
                onChange={(event) => props.onFiltersChange({ ...props.filters, rejectedOnly: event.target.checked })}
              />
              반려만 보기
            </label>
          </div>
        </div>

        {!props.items.length ? (
          <EmptyState title="조건에 맞는 개인 KPI가 없습니다." description="필터를 조정하거나 새 KPI를 추가해보세요." />
        ) : (
          <div className="mt-5 space-y-3">
            {props.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onSelectKpi(item.id)}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                  props.selectedKpiId === item.id
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{item.title}</p>
                      <StatusBadge status={item.status} compact />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {KPI_TYPE_LABELS[item.type]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {item.orgKpiTitle ? `상위 조직 KPI: ${item.orgKpiTitle}` : '연결된 조직 KPI가 없습니다.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <InfoPill label="목표값" value={item.targetValue != null ? `${item.targetValue}${item.unit ? ` ${item.unit}` : ''}` : '-'} />
                      <InfoPill label="가중치" value={`${item.weight}%`} />
                      <InfoPill label="난이도" value={DIFFICULTY_LABELS[item.difficulty ?? 'MEDIUM']} />
                      <InfoPill label="최근 달성률" value={item.monthlyAchievementRate != null ? `${item.monthlyAchievementRate}%` : '-'} />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-sm font-semibold text-slate-700">{item.departmentName}</p>
                    {item.hasRejectedRevision ? <p className="text-xs font-semibold text-amber-600">반려 후 수정 필요</p> : null}
                    {item.riskFlags.length ? <p className="text-xs text-amber-700">{item.riskFlags[0]}</p> : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {props.detail}
    </section>
  )
}

function ReviewQueueSection(props: {
  items: PersonalKpiReviewQueueItem[]
  selectedId?: string | null
  onSelect: (id: string) => void
  filter: 'ALL' | 'SUBMITTED' | 'MANAGER_REVIEW'
  onFilterChange: (value: 'ALL' | 'SUBMITTED' | 'MANAGER_REVIEW') => void
  onApprove: (id: string, note?: string) => void
  onReject: (id: string, note?: string) => void
  onStartReview: (id: string) => void
  busy: boolean
}) {
  const selected = props.items.find((item) => item.id === props.selectedId) ?? props.items[0] ?? null
  const [note, setNote] = useState('')

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">검토 대기</h2>
            <p className="mt-1 text-sm text-slate-500">팀장과 리더가 지금 확인해야 할 개인 KPI를 빠르게 검토할 수 있습니다.</p>
          </div>
          <MiniSelect
            value={props.filter}
            options={[
              { value: 'ALL', label: '전체' },
              { value: 'SUBMITTED', label: '제출됨' },
              { value: 'MANAGER_REVIEW', label: '검토 중' },
            ]}
            onChange={(value) => props.onFilterChange(value as typeof props.filter)}
          />
        </div>

        {!props.items.length ? (
          <EmptyState title="검토 대기 중인 개인 KPI가 없습니다." description="제출 또는 검토 중 상태의 KPI가 여기에 표시됩니다." />
        ) : (
          <div className="mt-5 space-y-3">
            {props.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => props.onSelect(item.id)}
                className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                  selected?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
                      <StatusBadge status={item.status} compact />
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.departmentName} · 제출일 {formatDateTime(item.submittedAt)}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        {!selected ? (
          <EmptyState title="검토할 KPI를 선택하세요." description="선택한 항목의 변경 요약과 승인/반려 액션이 여기에 표시됩니다." />
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold text-slate-900">{selected.title}</p>
                <StatusBadge status={selected.status} compact />
              </div>
              <p className="mt-1 text-sm text-slate-500">{selected.employeeName} · {selected.departmentName}</p>
            </div>

            <div className="grid gap-3">
              <CompareCard title="변경 전" content={selected.previousValueSummary ?? '비교할 이전 변경 정보가 없습니다.'} />
              <CompareCard title="현재안" content={selected.currentValueSummary ?? '현재 제출 요약이 없습니다.'} highlight />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">검토 코멘트</p>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={5}
                className="w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                placeholder="승인 또는 반려 사유를 남겨주세요."
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {selected.status === 'SUBMITTED' ? (
                <button type="button" onClick={() => props.onStartReview(selected.id)} disabled={props.busy} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                  검토 시작
                </button>
              ) : null}
              <button type="button" onClick={() => props.onApprove(selected.id, note)} disabled={props.busy} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                승인
              </button>
              <button type="button" onClick={() => props.onReject(selected.id, note)} disabled={props.busy} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50">
                반려
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function HistorySection(props: { history: PersonalKpiTimelineItem[]; aiLogs: PersonalKpiAiLogItem[]; selectedKpi: PersonalKpiViewModel | null }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">변경 이력</h2>
            <p className="mt-1 text-sm text-slate-500">생성, 제출, 반려, 재제출, 확정, 잠금까지 감사 가능한 흐름으로 남깁니다.</p>
          </div>
          {props.selectedKpi ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{props.selectedKpi.title}</span> : null}
        </div>
        {!props.history.length ? (
          <EmptyState title="아직 기록된 변경 이력이 없습니다." description="개인 KPI를 생성하거나 상태를 변경하면 이력이 표시됩니다." />
        ) : (
          <div className="mt-5 space-y-4">
            {props.history.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="flex w-8 flex-col items-center">
                  <span className="mt-1 h-3 w-3 rounded-full bg-slate-900" />
                  <span className="mt-2 h-full w-px bg-slate-200" />
                </div>
                <div className="flex-1 rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge>{item.action}</ActionBadge>
                    <p className="text-sm font-semibold text-slate-900">{item.actor}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(item.at)}</p>
                  </div>
                  {(item.fromStatus || item.toStatus) ? <p className="mt-2 text-sm text-slate-600">{item.fromStatus ?? '-'} → {item.toStatus ?? '-'}</p> : null}
                  {item.note ? <p className="mt-2 text-sm text-slate-700">{item.note}</p> : null}
                  {item.detail ? <p className="mt-2 text-xs text-slate-500">{item.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">AI 사용 로그</h2>
            <p className="mt-1 text-sm text-slate-500">생성, 적용, 반려 이력이 투명하게 남습니다.</p>
          </div>
        </div>
        {!props.aiLogs.length ? (
          <EmptyState title="아직 AI 사용 로그가 없습니다." description="AI 초안 생성, SMART 점검, 검토 포인트 생성 등을 실행하면 이곳에 남습니다." />
        ) : (
          <div className="mt-5 space-y-3">
            {props.aiLogs.map((item) => (
              <div key={item.id} className="rounded-[1.25rem] border border-slate-200 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBadge>{item.sourceType}</ActionBadge>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.requestStatus}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.approvalStatus}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">{item.requesterName} · {formatDateTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function AiSection(props: {
  enabled: boolean
  logs: PersonalKpiAiLogItem[]
  selectedKpi: PersonalKpiViewModel | null
  selectedEmployeeName: string
  onRun: (action: AiAction) => void
  preview: AiPreview | null
  onApply: () => void
  onReject: () => void
  loading: boolean
}) {
  const tools: Array<{ action: AiAction; label: string; description: string }> = [
    { action: 'generate-draft', label: '개인 KPI 초안 생성', description: '직무/상위 목표/기대성과를 바탕으로 KPI 초안을 만듭니다.' },
    { action: 'improve-wording', label: 'KPI 문장 개선', description: '모호한 KPI 문장을 더 명확하고 측정 가능하게 다듬습니다.' },
    { action: 'smart-check', label: 'SMART 점검', description: 'Specific, Measurable, Achievable, Relevant, Time-bound 기준으로 진단합니다.' },
    { action: 'suggest-weight', label: '가중치 조정 제안', description: '현재 KPI 묶음을 보고 가중치 배분을 추천합니다.' },
    { action: 'suggest-org-alignment', label: '조직 KPI 연결 추천', description: '어떤 조직 KPI와 연결하는 것이 자연스러운지 제안합니다.' },
    { action: 'detect-duplicates', label: '중복/유사 KPI 탐지', description: '현재 KPI 목록과 비교해 겹치는 KPI 후보를 찾습니다.' },
    { action: 'summarize-review-risks', label: '검토 포인트 생성', description: '리더 관점에서 위험한 KPI와 검토 포인트를 요약합니다.' },
    { action: 'draft-monthly-comment', label: '월간 실적 코멘트 초안', description: '최근 실적 흐름을 바탕으로 실행 코멘트와 다음 액션을 제안합니다.' },
  ]

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">AI 보조</h2>
            <p className="mt-1 text-sm text-slate-500">{props.selectedKpi ? `${props.selectedKpi.title}` : props.selectedEmployeeName} 기준으로 KPI 초안, 문장 개선, SMART 점검, 검토 포인트를 지원합니다.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${props.enabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {props.enabled ? 'AI 사용 가능' : 'AI 비활성'}
          </span>
        </div>

        {!props.enabled ? (
          <EmptyState title="AI 기능이 현재 비활성화되어 있습니다." description="AI가 비활성 상태여도 개인 KPI 페이지는 정상적으로 작성·검토·이력 추적이 가능합니다." />
        ) : (
          <div className="mt-5 grid gap-3">
            {tools.map((tool) => (
              <button
                key={tool.action}
                type="button"
                onClick={() => props.onRun(tool.action)}
                disabled={props.loading}
                className="rounded-[1.5rem] border border-slate-200 px-4 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-blue-100 p-2 text-blue-700">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{tool.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">AI 결과 Preview</h2>
            <p className="mt-1 text-sm text-slate-500">자동 반영되지 않으며, 사용자가 미리 보고 직접 적용해야 합니다.</p>
          </div>
          {props.preview?.source ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{props.preview.source}</span> : null}
        </div>

        {!props.preview ? (
          <EmptyState title="아직 생성된 AI 결과가 없습니다." description="왼쪽에서 원하는 AI 도구를 실행하면 결과 preview가 표시됩니다." />
        ) : (
          <div className="mt-5 space-y-4">
            {Object.entries(props.preview.result).map(([key, value]) => (
              <div key={key} className="rounded-[1.25rem] bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{key}</p>
                <div className="mt-2 text-sm text-slate-700">{renderPreviewValue(value)}</div>
              </div>
            ))}
            {props.preview.fallbackReason ? (
              <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                AI 연결이 어려워 fallback 결과를 보여주고 있습니다: {props.preview.fallbackReason}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={props.onApply} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                Preview 적용
              </button>
              <button type="button" onClick={props.onReject} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                반려
              </button>
            </div>
          </div>
        )}

        {props.logs.length ? (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-900">최근 AI 요청</p>
            <div className="mt-3 space-y-2">
              {props.logs.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge>{item.sourceType}</ActionBadge>
                    <span className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function DetailPanel(props: {
  kpi: PersonalKpiViewModel | null
  canEdit: boolean
  canReview: boolean
  canLock: boolean
  workflowSaving: boolean
  onEdit: () => void
  onSubmit: () => void
  onStartReview: () => void
  onApprove: () => void
  onReject: () => void
  onLock: () => void
  onReopen: () => void
  reviewNote: string
  onReviewNoteChange: (value: string) => void
}) {
  if (!props.kpi) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <EmptyState title="개인 KPI를 선택하세요." description="선택한 KPI의 상세, 검토 코멘트, 최근 월간 실적, 승인/반려 이력을 이 패널에서 확인할 수 있습니다." />
      </div>
    )
  }

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-semibold text-slate-900">{props.kpi.title}</p>
        <StatusBadge status={props.kpi.status} compact />
      </div>
      <p className="mt-1 text-sm text-slate-500">{props.kpi.departmentName} · {props.kpi.employeeName}</p>

      <div className="mt-4 grid gap-3">
        <InfoPill label="KPI 유형" value={KPI_TYPE_LABELS[props.kpi.type]} />
        <InfoPill label="가중치" value={`${props.kpi.weight}%`} />
        <InfoPill label="난이도" value={DIFFICULTY_LABELS[props.kpi.difficulty ?? 'MEDIUM']} />
        <InfoPill label="최근 달성률" value={props.kpi.monthlyAchievementRate != null ? `${props.kpi.monthlyAchievementRate}%` : '-'} />
      </div>

      <div className="mt-5 space-y-4">
        <Block title="정의">{props.kpi.definition || '정의가 아직 입력되지 않았습니다.'}</Block>
        <Block title="산식">{props.kpi.formula || '정량 KPI가 아니거나 산식이 없습니다.'}</Block>
        <Block title="목표값">{props.kpi.targetValue != null ? `${props.kpi.targetValue}${props.kpi.unit ? ` ${props.kpi.unit}` : ''}` : '목표값 없음'}</Block>
        <Block title="조직 KPI 연결">
          {props.kpi.orgKpiTitle ? (
            <div>
              <p className="font-semibold text-slate-900">{props.kpi.orgKpiTitle}</p>
              {props.kpi.orgKpiCategory ? <p className="mt-1 text-xs text-slate-500">{props.kpi.orgKpiCategory}</p> : null}
              {props.kpi.orgKpiDefinition ? <p className="mt-2 text-sm text-slate-600">{props.kpi.orgKpiDefinition}</p> : null}
            </div>
          ) : (
            '연결된 조직 KPI가 없습니다.'
          )}
        </Block>
        <Block title="최근 월간 실적">
          {!props.kpi.recentMonthlyRecords.length ? (
            '최근 월간 실적이 없습니다.'
          ) : (
            <div className="space-y-2">
              {props.kpi.recentMonthlyRecords.map((record) => (
                <div key={record.id} className="rounded-xl bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{record.month}</p>
                    <p className="text-xs font-semibold text-slate-600">
                      {record.achievementRate != null ? `${record.achievementRate}%` : '달성률 없음'}
                    </p>
                  </div>
                  {record.activities ? <p className="mt-2 text-sm text-slate-600">{record.activities}</p> : null}
                  {record.obstacles ? <p className="mt-1 text-xs text-amber-700">이슈: {record.obstacles}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Block>
        {props.kpi.riskFlags.length ? (
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">주의 포인트</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.kpi.riskFlags.map((flag) => (
                <span key={flag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm font-semibold text-slate-900">승인 / 반려 메모</p>
        <textarea
          rows={4}
          value={props.reviewNote}
          onChange={(event) => props.onReviewNoteChange(event.target.value)}
          className="w-full rounded-[1.25rem] border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400"
          placeholder="검토 의견이나 반려 사유를 입력하세요."
        />
      </div>

      <div className="mt-5 grid gap-2">
        {props.canEdit ? <button type="button" onClick={props.onEdit} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">수정</button> : null}
        {props.kpi.status === 'DRAFT' ? <button type="button" onClick={props.onSubmit} disabled={props.workflowSaving} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">제출</button> : null}
        {props.canReview && props.kpi.status === 'SUBMITTED' ? <button type="button" onClick={props.onStartReview} disabled={props.workflowSaving} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">검토 시작</button> : null}
        {props.canReview && (props.kpi.status === 'SUBMITTED' || props.kpi.status === 'MANAGER_REVIEW') ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={props.onApprove} disabled={props.workflowSaving} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">승인</button>
            <button type="button" onClick={props.onReject} disabled={props.workflowSaving} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50">반려</button>
          </div>
        ) : null}
        {props.canLock && props.kpi.status === 'CONFIRMED' ? <button type="button" onClick={props.onLock} disabled={props.workflowSaving} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">잠금</button> : null}
        {(props.kpi.status === 'SUBMITTED' || props.kpi.status === 'MANAGER_REVIEW' || props.kpi.status === 'CONFIRMED' || props.kpi.status === 'LOCKED') ? <button type="button" onClick={props.onReopen} disabled={props.workflowSaving} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">재오픈</button> : null}
      </div>
    </div>
  )
}

function EditorModal(props: {
  mode: 'create' | 'edit'
  form: FormState
  onChange: (value: FormState | ((current: FormState) => FormState)) => void
  onClose: () => void
  onSubmit: () => void
  saving: boolean
  orgKpiOptions: ClientProps['orgKpiOptions']
  totalWeight: number
  selectedKpi: PersonalKpiViewModel | null
  selectedEmployeeName: string
  onRequestAiDraft: () => void
  aiLoading: boolean
}) {
  const linkedOrgKpi = props.orgKpiOptions.find((item) => item.id === props.form.linkedOrgKpiId)
  const nextTotal =
    props.mode === 'edit' && props.selectedKpi
      ? props.totalWeight - props.selectedKpi.weight + Number(props.form.weight || 0)
      : props.totalWeight + Number(props.form.weight || 0)
  const isWeightOverflow = Number.isFinite(nextTotal) && nextTotal > 100

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-5xl items-start justify-center">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">{props.mode === 'create' ? 'Create Personal KPI' : 'Edit Personal KPI'}</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{props.mode === 'create' ? '개인 KPI 추가' : '개인 KPI 수정'}</h2>
              <p className="mt-1 text-sm text-slate-500">{props.selectedEmployeeName} 기준으로 목표를 작성하거나 수정합니다.</p>
            </div>
            <button type="button" onClick={props.onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid flex-1 gap-0 overflow-hidden xl:grid-cols-[1fr_360px]">
            <div className="overflow-y-auto px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="KPI 유형">
                  <select value={props.form.kpiType} onChange={(event) => props.onChange((current) => ({ ...current, kpiType: event.target.value as FormState['kpiType'] }))} className={INPUT_CLASS}>
                    <option value="QUANTITATIVE">정량</option>
                    <option value="QUALITATIVE">정성</option>
                  </select>
                </Field>
                <Field label="난이도">
                  <select value={props.form.difficulty} onChange={(event) => props.onChange((current) => ({ ...current, difficulty: event.target.value as FormState['difficulty'] }))} className={INPUT_CLASS}>
                    <option value="HIGH">상</option>
                    <option value="MEDIUM">중</option>
                    <option value="LOW">하</option>
                  </select>
                </Field>
              </div>

              <div className="mt-4">
                <Field label="KPI명">
                  <input value={props.form.kpiName} onChange={(event) => props.onChange((current) => ({ ...current, kpiName: event.target.value }))} className={INPUT_CLASS} placeholder="예: 핵심 고객 과제 납기 준수율 향상" />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="정의">
                  <textarea value={props.form.definition} onChange={(event) => props.onChange((current) => ({ ...current, definition: event.target.value }))} rows={5} className={`${INPUT_CLASS} resize-none`} placeholder="이 KPI가 왜 중요한지, 무엇을 달성해야 하는지 설명하세요." />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="목표값">
                  <input value={props.form.targetValue} onChange={(event) => props.onChange((current) => ({ ...current, targetValue: event.target.value }))} className={INPUT_CLASS} placeholder={props.form.kpiType === 'QUANTITATIVE' ? '100' : '예: 기준 충족'} />
                </Field>
                <Field label="단위">
                  <input value={props.form.unit} onChange={(event) => props.onChange((current) => ({ ...current, unit: event.target.value }))} className={INPUT_CLASS} placeholder={props.form.kpiType === 'QUANTITATIVE' ? '%' : '건 / 점 / 단계'} />
                </Field>
                <Field label="가중치">
                  <input value={props.form.weight} onChange={(event) => props.onChange((current) => ({ ...current, weight: event.target.value }))} className={INPUT_CLASS} placeholder="25" />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="산식 / 평가 기준">
                  <textarea value={props.form.formula} onChange={(event) => props.onChange((current) => ({ ...current, formula: event.target.value }))} rows={4} className={`${INPUT_CLASS} resize-none`} placeholder={props.form.kpiType === 'QUANTITATIVE' ? '예: 실적 / 목표 x 100' : '정성 KPI라면 평가 기준, 체크리스트, 기대 행동을 적어주세요.'} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="연결 조직 KPI">
                  <select value={props.form.linkedOrgKpiId} onChange={(event) => props.onChange((current) => ({ ...current, linkedOrgKpiId: event.target.value }))} className={INPUT_CLASS}>
                    <option value="">조직 KPI를 선택하세요</option>
                    {props.orgKpiOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.departmentName} · {item.title}</option>
                    ))}
                  </select>
                </Field>
                {linkedOrgKpi ? (
                  <div className="mt-3 rounded-[1.25rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <p className="font-semibold">{linkedOrgKpi.title}</p>
                    <p className="mt-1 text-xs text-blue-700">{linkedOrgKpi.departmentName} · {linkedOrgKpi.category}</p>
                    {linkedOrgKpi.description ? <p className="mt-2 text-sm text-blue-800">{linkedOrgKpi.description}</p> : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">조직 KPI 연결이 없으면 정렬 수준이 낮아지고 검토 시 보완 요청이 늘어날 수 있습니다.</p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-6 xl:border-l xl:border-t-0">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-semibold text-slate-900">AI 초안 보조</p>
                </div>
                <p className="mt-2 text-sm text-slate-500">조직 KPI, 기대성과, 현재 문장을 기반으로 초안 또는 문장 개선을 제안합니다.</p>
                <button type="button" onClick={props.onRequestAiDraft} disabled={props.aiLoading} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                  {props.aiLoading ? 'AI 생성 중...' : 'AI 초안 생성'}
                </button>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">작성 체크</p>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>총 가중치 기준: {props.totalWeight}%</p>
                  <p>저장 후 예상 가중치: {Number.isFinite(nextTotal) ? `${Math.round(nextTotal * 10) / 10}%` : '-'}</p>
                  {isWeightOverflow ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">가중치 합계가 100을 초과합니다.</div> : null}
                  {!props.form.linkedOrgKpiId ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">조직 KPI 연결이 없으면 리더 검토 시 보완 요청이 늘 수 있습니다.</div> : null}
                </div>
              </div>

              <div className="mt-6 grid gap-2">
                <button type="button" onClick={props.onSubmit} disabled={props.saving || !props.form.kpiName.trim()} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
                  {props.saving ? '저장 중...' : props.mode === 'create' ? '개인 KPI 추가' : '변경사항 저장'}
                </button>
                <button type="button" onClick={props.onClose} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickLinks() {
  const links = [
    ['/kpi/org', '조직 KPI'],
    ['/kpi/monthly', '월간 실적'],
    ['/evaluation/results', '평가 결과'],
    ['/evaluation/assistant', 'AI 보조 작성'],
    ['/checkin', '체크인'],
  ] as const

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <ArrowRight className="h-5 w-5 text-blue-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">연결된 화면</h2>
          <p className="mt-1 text-sm text-slate-500">개인 KPI 작성 이후 월간 실적, 평가, 체크인 흐름으로 자연스럽게 이어집니다.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function Banner(props: { tone: BannerState['tone']; children: ReactNode }) {
  const className =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : props.tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${className}`}>{props.children}</div>
}

function StatePanel(props: { state: ClientProps['state']; message?: string }) {
  const content =
    props.state === 'permission-denied'
      ? {
          title: '이 개인 KPI를 조회할 권한이 없습니다.',
          description: props.message ?? '본인 또는 권한 범위에 포함된 직원의 KPI만 볼 수 있습니다.',
        }
      : props.state === 'empty'
        ? {
            title: '아직 등록된 개인 KPI가 없습니다.',
            description: props.message ?? '올해의 개인 목표를 작성하고 조직 KPI와 연결해보세요.',
          }
        : {
            title: '개인 KPI 화면을 준비하는 중 문제가 발생했습니다.',
            description: props.message ?? '잠시 후 다시 시도해주세요.',
          }

  return <EmptyState title={content.title} description={content.description} />
}

function MetricCard(props: { icon: ReactNode; label: string; value: string; helper: string; tone?: 'default' | 'warn' | 'ok' }) {
  return (
    <div className={`rounded-[1.75rem] border p-5 shadow-sm ${
      props.tone === 'warn' ? 'border-amber-200 bg-amber-50' : props.tone === 'ok' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
    }`}>
      <div className={`inline-flex rounded-full p-2 ${
        props.tone === 'warn' ? 'bg-amber-100 text-amber-700' : props.tone === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
      }`}>
        {props.icon}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{props.value}</p>
      <p className="mt-2 text-sm text-slate-500">{props.helper}</p>
    </div>
  )
}

function SelectorCard(props: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="rounded-[1.5rem] border border-white/15 bg-white/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{props.label}</p>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/30 px-3 text-sm font-medium text-white outline-none">
        {props.options.map((option) => (
          <option key={option.value} value={option.value} className="text-slate-900">{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function StatusBadge(props: { status: string; compact?: boolean }) {
  const tone =
    props.status === 'CONFIRMED'
      ? 'bg-emerald-100 text-emerald-700'
      : props.status === 'LOCKED'
        ? 'bg-slate-200 text-slate-700'
        : props.status === 'SUBMITTED' || props.status === 'MANAGER_REVIEW'
          ? 'bg-blue-100 text-blue-700'
          : props.status === 'ARCHIVED'
            ? 'bg-slate-100 text-slate-600'
            : props.status === 'MIXED'
              ? 'bg-violet-100 text-violet-700'
              : 'bg-amber-100 text-amber-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{STATUS_LABELS[props.status] ?? props.status}</span>
}

function InfoPill(props: { label: string; value: string; inverse?: boolean }) {
  return (
    <div className={`rounded-full px-3 py-2 text-sm ${props.inverse ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>
      <span className={`font-medium ${props.inverse ? 'text-slate-200' : 'text-slate-500'}`}>{props.label}</span>
      <span className="ml-2 font-semibold">{props.value}</span>
    </div>
  )
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <p className="mb-2 text-sm font-semibold text-slate-800">{props.label}</p>
      {props.children}
    </label>
  )
}

function Block(props: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{props.title}</p>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.children}</div>
    </div>
  )
}

function CompareCard(props: { title: string; content: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[1.25rem] px-4 py-4 ${props.highlight ? 'border border-blue-200 bg-blue-50' : 'border border-slate-200 bg-slate-50'}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.title}</p>
      <p className="mt-2 text-sm text-slate-700">{props.content}</p>
    </div>
  )
}

function ActionBadge(props: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{props.children}</span>
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
      <FileText className="h-8 w-8 text-slate-300" />
      <h3 className="mt-4 text-base font-semibold text-slate-900">{props.title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{props.description}</p>
    </div>
  )
}

function MiniSelect(props: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <select value={props.value} onChange={(event) => props.onChange(event.target.value)} className="min-h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400">
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

function ActionButton(props: { children: ReactNode; onClick: () => void; disabled?: boolean; icon?: ReactNode }) {
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50">
      {props.icon}
      {props.children}
    </button>
  )
}

function buildAiPayload(action: AiAction, params: { selectedKpi: PersonalKpiViewModel | null; allKpis: PersonalKpiViewModel[]; orgKpiOptions: ClientProps['orgKpiOptions']; selectedEmployeeName?: string }) {
  const selected = params.selectedKpi
  switch (action) {
    case 'generate-draft':
      return { roleName: params.selectedEmployeeName, orgKpiName: selected?.orgKpiTitle, goal: selected?.title, summary: selected?.definition, kpiType: selected?.type ?? 'QUANTITATIVE' }
    case 'improve-wording':
    case 'smart-check':
    case 'draft-monthly-comment':
      return { kpiName: selected?.title, definition: selected?.definition, formula: selected?.formula, targetValue: selected?.targetValue, unit: selected?.unit, summary: selected?.recentMonthlyRecords[0]?.activities ?? selected?.definition, orgKpiName: selected?.orgKpiTitle, kpiType: selected?.type }
    case 'suggest-weight':
      return {
        currentTotal: params.allKpis.reduce((sum, item) => sum + item.weight, 0),
        items: params.allKpis.map((item) => ({ id: item.id, title: item.title, weight: item.weight, linkedOrgKpi: item.orgKpiTitle, achievementRate: item.monthlyAchievementRate })),
      }
    case 'suggest-org-alignment':
      return {
        kpiName: selected?.title,
        definition: selected?.definition,
        orgKpiName: selected?.orgKpiTitle,
        candidates: params.orgKpiOptions.map((item) => ({ id: item.id, title: item.title, category: item.category, departmentName: item.departmentName, description: item.description })),
      }
    case 'detect-duplicates':
      return {
        kpiName: selected?.title,
        candidates: params.allKpis.map((item) => ({ id: item.id, title: item.title, definition: item.definition, linkedOrgKpi: item.orgKpiTitle })),
      }
    case 'summarize-review-risks':
      return {
        summary: `${params.selectedEmployeeName ?? ''} 개인 KPI 검토 포인트`,
        items: params.allKpis.map((item) => ({ title: item.title, status: item.status, linkedOrgKpi: item.orgKpiTitle, achievementRate: item.monthlyAchievementRate, riskFlags: item.riskFlags })),
      }
  }
  return {}
}

function renderPreviewValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    return <div className="space-y-2">{value.map((item, index) => <div key={index} className="rounded-xl bg-white px-3 py-2">{renderPreviewValue(item)}</div>)}</div>
  }
  if (value && typeof value === 'object') {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
          <div key={key}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{key}</p>
            <div className="mt-1 text-sm text-slate-700">{renderPreviewValue(nestedValue)}</div>
          </div>
        ))}
      </div>
    )
  }
  return <span>{String(value ?? '-')}</span>
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

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : null
}
