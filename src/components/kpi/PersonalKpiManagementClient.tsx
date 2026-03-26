'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, ClipboardList, History, Link2, Plus, Send, Sparkles, X } from 'lucide-react'
import type {
  PersonalKpiAiLogItem,
  PersonalKpiPageData,
  PersonalKpiReviewQueueItem,
  PersonalKpiTimelineItem,
  PersonalKpiViewModel,
} from '@/server/personal-kpi-page'
import {
  PERSONAL_KPI_REVIEW_CTA_LABEL,
  getPersonalKpiHeroCtaTransition,
  getPersonalKpiSubmitCtaState,
  type PersonalKpiSubmitCtaState,
  type PersonalKpiTabKey,
} from '@/lib/personal-kpi-cta'

type Props = PersonalKpiPageData & {
  initialTab?: string
  initialKpiId?: string
}

type Banner = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type EditorMode = 'create' | 'edit'
type BusyAction = 'save-form' | 'submit' | 'workflow' | 'ai' | 'ai-decision' | null

type KpiForm = {
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
  fallbackReason?: string | null
  result: Record<string, unknown>
  action: AiAction
}

const TABS: Array<{ key: PersonalKpiTabKey; label: string }> = [
  { key: 'mine', label: '내 KPI' },
  { key: 'review', label: '검토 대기' },
  { key: 'history', label: '변경 이력' },
  { key: 'ai', label: 'AI 보조' },
]

const KPI_TYPE_LABELS: Record<KpiForm['kpiType'], string> = {
  QUANTITATIVE: '정량',
  QUALITATIVE: '정성',
}

const DIFFICULTY_LABELS: Record<KpiForm['difficulty'], string> = {
  HIGH: '상',
  MEDIUM: '중',
  LOW: '하',
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

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  MANAGER_REVIEW: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  LOCKED: 'bg-violet-100 text-violet-700',
  ARCHIVED: 'bg-slate-200 text-slate-700',
  MIXED: 'bg-slate-100 text-slate-700',
}

const AI_ACTIONS: Array<{ action: AiAction; title: string; description: string }> = [
  { action: 'generate-draft', title: 'AI 초안 생성', description: '역할과 조직 KPI를 기준으로 개인 KPI 초안을 만듭니다.' },
  { action: 'improve-wording', title: '문장 다듬기', description: '모호한 KPI 문장을 더 명확한 표현으로 정리합니다.' },
  { action: 'smart-check', title: 'SMART 점검', description: '측정 가능성과 합의 가능성을 기준으로 점검합니다.' },
  { action: 'suggest-weight', title: '가중치 제안', description: '현재 KPI 묶음을 보고 적절한 가중치 배분을 추천합니다.' },
  { action: 'suggest-org-alignment', title: '조직 KPI 연결 추천', description: '상위 목표와 자연스러운 연결 후보를 제안합니다.' },
  { action: 'detect-duplicates', title: '중복 KPI 탐지', description: '유사하거나 겹칠 가능성이 있는 KPI를 찾아줍니다.' },
  { action: 'summarize-review-risks', title: '검토 포인트 생성', description: '리더가 미리 확인할 리스크와 질문 포인트를 정리합니다.' },
  { action: 'draft-monthly-comment', title: '월간 실적 코멘트 초안', description: '월간 실적과 이어질 코멘트 초안을 제안합니다.' },
]

function isTabKey(value?: string): value is PersonalKpiTabKey {
  return value === 'mine' || value === 'review' || value === 'history' || value === 'ai'
}

function buildSearch(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  return search.toString()
}

function toRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function toNumberString(value?: number | string | null) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10)
  if (typeof value === 'string') return value
  return ''
}

function toNumberOrUndefined(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseJsonOrThrow<T>(response: Response) {
  return response.json().then((json) => {
    const typed = json as { success?: boolean; data?: T; error?: { message?: string } }
    if (!typed.success) {
      throw new Error(typed.error?.message || '요청을 처리하는 중 문제가 발생했습니다.')
    }
    return typed.data as T
  })
}

function formatDateTime(value?: string) {
  if (!value) return '미정'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPercent(value?: number) {
  if (typeof value !== 'number') return '-'
  return `${Math.round(value * 10) / 10}%`
}

function buildEmptyForm(year: number, employeeId: string): KpiForm {
  return {
    employeeId,
    evalYear: year,
    kpiType: 'QUANTITATIVE',
    kpiName: '',
    definition: '',
    formula: '',
    targetValue: '',
    unit: '%',
    weight: '',
    difficulty: 'MEDIUM',
    linkedOrgKpiId: '',
  }
}

function buildFormFromKpi(kpi: PersonalKpiViewModel): KpiForm {
  return {
    employeeId: kpi.employeeId,
    evalYear: new Date(kpi.updatedAt ?? Date.now()).getFullYear(),
    kpiType: kpi.type,
    kpiName: kpi.title,
    definition: kpi.definition ?? '',
    formula: kpi.formula ?? '',
    targetValue: toNumberString(kpi.targetValue),
    unit: kpi.unit ?? '',
    weight: toNumberString(kpi.weight),
    difficulty: (kpi.difficulty ?? 'MEDIUM') as KpiForm['difficulty'],
    linkedOrgKpiId: kpi.orgKpiId ?? '',
  }
}

function buildAiPayload(props: Props, selectedKpi: PersonalKpiViewModel | undefined, form: KpiForm, action: AiAction) {
  return {
    action,
    employeeName: props.actor.name,
    departmentName: props.actor.departmentName,
    role: props.actor.role,
    kpiName: selectedKpi?.title ?? form.kpiName,
    goal: selectedKpi?.title ?? form.kpiName,
    definition: selectedKpi?.definition ?? form.definition,
    formula: selectedKpi?.formula ?? form.formula,
    targetValue: selectedKpi?.targetValue ?? toNumberOrUndefined(form.targetValue) ?? form.targetValue,
    unit: selectedKpi?.unit ?? form.unit,
    weight: selectedKpi?.weight ?? toNumberOrUndefined(form.weight) ?? form.weight,
    kpiType: selectedKpi?.type ?? form.kpiType,
    orgKpiName: selectedKpi?.orgKpiTitle ?? props.orgKpiOptions.find((item) => item.id === form.linkedOrgKpiId)?.title,
    orgKpiCategory:
      selectedKpi?.orgKpiCategory ??
      props.orgKpiOptions.find((item) => item.id === form.linkedOrgKpiId)?.category,
    reviewComment: selectedKpi?.reviewComment,
    recentMonthlyRecords: selectedKpi?.recentMonthlyRecords ?? [],
    candidates: props.mine.map((item) => ({
      id: item.id,
      title: item.title,
      definition: item.definition,
      type: item.type,
      weight: item.weight,
    })),
  }
}

function applyPreviewToForm(form: KpiForm, preview: Record<string, unknown>) {
  const difficulty = toStringValue(preview.difficultySuggestion || preview.difficulty, form.difficulty)
  const nextDifficulty = ['HIGH', 'MEDIUM', 'LOW'].includes(difficulty)
    ? (difficulty as KpiForm['difficulty'])
    : form.difficulty

  return {
    ...form,
    kpiName: toStringValue(preview.title || preview.improvedTitle, form.kpiName),
    definition: toStringValue(preview.definition || preview.improvedDefinition, form.definition),
    formula: toStringValue(preview.formula, form.formula),
    targetValue: toStringValue(preview.targetValueSuggestion, form.targetValue),
    unit: toStringValue(preview.unit || preview.unitSuggestion, form.unit),
    weight: preview.weightSuggestion ? String(preview.weightSuggestion) : form.weight,
    difficulty: nextDifficulty,
  }
}

export function PersonalKpiManagementClient(props: Props) {
  const router = useRouter()
  const [activeTabState, setActiveTabState] = useState<PersonalKpiTabKey>(isTabKey(props.initialTab) ? props.initialTab : 'mine')
  const [selectedKpiId, setSelectedKpiId] = useState(props.initialKpiId ?? props.mine[0]?.id ?? '')
  const [selectedReviewId, setSelectedReviewId] = useState(props.reviewQueue[0]?.id ?? '')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [form, setForm] = useState<KpiForm>(buildEmptyForm(props.selectedYear, props.selectedEmployeeId))
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  useEffect(() => {
    if (!props.mine.length) {
      setSelectedKpiId('')
      return
    }
    if (!props.mine.some((item) => item.id === selectedKpiId)) {
      setSelectedKpiId(props.initialKpiId ?? props.mine[0].id)
    }
  }, [props.mine, props.initialKpiId, selectedKpiId])

  useEffect(() => {
    if (!props.reviewQueue.length) {
      setSelectedReviewId('')
      return
    }
    if (!props.reviewQueue.some((item) => item.id === selectedReviewId)) {
      setSelectedReviewId(props.reviewQueue[0].id)
    }
  }, [props.reviewQueue, selectedReviewId])

  const activeTab = activeTabState
  const selectedKpi = useMemo(
    () => props.mine.find((item) => item.id === selectedKpiId) ?? props.mine[0],
    [props.mine, selectedKpiId]
  )
  const selectedReview = useMemo(
    () => props.reviewQueue.find((item) => item.id === selectedReviewId) ?? props.reviewQueue[0],
    [props.reviewQueue, selectedReviewId]
  )

  const submitCtaState = getPersonalKpiSubmitCtaState({
    canSubmit: props.permissions.canSubmit,
    totalCount: props.summary.totalCount,
    selectedKpiStatus: selectedKpi?.status ?? null,
    hasSelectedKpi: Boolean(selectedKpi),
    workflowSaving: busyAction === 'submit',
  })
  const createDisabledReason =
    props.state === 'error'
      ? '개인 KPI 데이터를 아직 불러오지 못해 추가 기능을 사용할 수 없습니다.'
      : props.state === 'no-target'
        ? '대상자를 먼저 선택해야 KPI를 추가할 수 있습니다.'
        : props.state === 'setup-required'
          ? '조회 가능한 대상자나 운영 설정이 없어 KPI를 추가할 수 없습니다.'
      : props.state === 'permission-denied' || !props.permissions.canCreate
        ? '현재 범위에서는 개인 KPI를 추가할 권한이 없습니다.'
        : undefined
  const aiDisabledReason =
    props.state === 'error'
      ? '개인 KPI 데이터를 아직 불러오지 못해 AI 보조를 시작할 수 없습니다.'
      : props.state === 'no-target'
        ? '대상자를 먼저 선택해야 AI 초안 생성을 사용할 수 있습니다.'
        : props.state === 'setup-required'
          ? '조회 가능한 대상자나 운영 설정이 없어 AI 보조를 사용할 수 없습니다.'
      : !props.permissions.canUseAi
        ? 'AI 기능이 비활성화되어 있거나 현재 계정 권한으로는 사용할 수 없습니다.'
        : undefined
  const reviewDisabledReason =
    props.state === 'error'
      ? '페이지 상태를 복구한 뒤 검토 대기열을 확인해 주세요.'
      : props.state === 'no-target'
        ? '대상자를 먼저 선택해야 검토 대기열을 확인할 수 있습니다.'
        : props.state === 'setup-required'
          ? '조회 가능한 대상자나 운영 설정이 없어 검토 대기열을 확인할 수 없습니다.'
          : !props.permissions.canReview
            ? '현재 범위에서는 검토 대기열을 확인할 권한이 없습니다.'
            : undefined
  const historyDisabledReason =
    props.state === 'error'
      ? '페이지 상태를 복구한 뒤 이력을 확인해 주세요.'
      : props.state === 'no-target'
        ? '대상자를 먼저 선택해야 이력을 확인할 수 있습니다.'
        : props.state === 'setup-required'
          ? '조회 가능한 대상자나 운영 설정이 없어 이력을 확인할 수 없습니다.'
          : undefined

  const setActiveTab = (nextTab: PersonalKpiTabKey) => {
    setActiveTabState(nextTab)
    const query = buildSearch({
      year: String(props.selectedYear),
      employeeId: props.selectedEmployeeId,
      cycleId: props.selectedCycleId,
      tab: nextTab,
      kpiId: selectedKpiId || props.initialKpiId,
    })
    router.replace(`/kpi/personal?${query}`, { scroll: false })
  }

  function handleRouteSelection(next: {
    year?: string
    employeeId?: string
    cycleId?: string
    tab?: string
    kpiId?: string
  }) {
    const query = buildSearch({
      year: next.year ?? String(props.selectedYear),
      employeeId: next.employeeId ?? props.selectedEmployeeId,
      cycleId: next.cycleId ?? props.selectedCycleId,
      tab: next.tab ?? activeTab,
      kpiId: next.kpiId ?? selectedKpiId,
    })
    router.replace(`/kpi/personal?${query}`)
  }

  function handleOpenCreate() {
    if (createDisabledReason) {
      setBanner({ tone: 'error', message: createDisabledReason })
      return
    }

    const transition = getPersonalKpiHeroCtaTransition('create')
    setActiveTab(transition.nextTab)
    setEditorMode('create')
    setForm(buildEmptyForm(props.selectedYear, props.selectedEmployeeId))
    setAiPreview(null)
    setEditorOpen(true)
  }

  function handleOpenAiDraft() {
    if (aiDisabledReason) {
      setBanner({
        tone: 'info',
        message: aiDisabledReason,
      })
      return
    }

    const transition = getPersonalKpiHeroCtaTransition('ai')
    setActiveTab(transition.nextTab)
    setBanner({
      tone: 'info',
      message: 'AI 보조 탭에서 초안 생성과 문장 개선을 바로 시작할 수 있습니다.',
    })
  }

  function handleOpenHistory() {
    if (historyDisabledReason) {
      setBanner({ tone: 'info', message: historyDisabledReason })
      return
    }
    const transition = getPersonalKpiHeroCtaTransition('history')
    setActiveTab(transition.nextTab)
    setBanner(null)
  }

  function handleOpenReview() {
    const transition = getPersonalKpiHeroCtaTransition('review')
    setActiveTab(transition.nextTab)
    setBanner(null)
  }

  async function handleSubmitSelected() {
    if (submitCtaState.disabled || !selectedKpi) {
      setBanner({ tone: 'error', message: submitCtaState.reason || '제출할 KPI를 확인해주세요.' })
      return
    }

    setBusyAction('submit')
    setBanner(null)

    try {
      const response = await fetch(`/api/kpi/personal/${selectedKpi.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SUBMIT' }),
      })
      await parseJsonOrThrow(response)
      setBanner({ tone: 'success', message: '선택한 KPI를 제출했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'KPI 제출에 실패했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSaveForm() {
    if (!props.permissions.canCreate && editorMode === 'create') {
      setBanner({ tone: 'error', message: 'KPI를 추가할 권한이 없습니다.' })
      return
    }
    if (!props.permissions.canEdit && editorMode === 'edit') {
      setBanner({ tone: 'error', message: 'KPI를 수정할 권한이 없습니다.' })
      return
    }

    setBusyAction('save-form')
    setBanner(null)

    try {
      const payload = {
        employeeId: form.employeeId,
        evalYear: props.selectedYear,
        kpiType: form.kpiType,
        kpiName: form.kpiName.trim(),
        definition: form.definition.trim() || undefined,
        formula: form.formula.trim() || undefined,
        targetValue: toNumberOrUndefined(form.targetValue),
        unit: form.unit.trim() || undefined,
        weight: Number(form.weight),
        difficulty: form.difficulty,
        linkedOrgKpiId: form.linkedOrgKpiId || undefined,
      }

      const response =
        editorMode === 'create'
          ? await fetch('/api/kpi/personal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/kpi/personal/${selectedKpiId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...payload,
                targetValue: form.targetValue.trim() ? Number(form.targetValue) : null,
                linkedOrgKpiId: form.linkedOrgKpiId || null,
              }),
            })

      await parseJsonOrThrow(response)
      setEditorOpen(false)
      setBanner({
        tone: 'success',
        message: editorMode === 'create' ? '개인 KPI를 추가했습니다.' : '개인 KPI를 수정했습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'KPI 저장에 실패했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleReviewWorkflow(
    kpiId: string,
    action: 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'LOCK' | 'REOPEN'
  ) {
    setBusyAction('workflow')
    setBanner(null)

    try {
      const response = await fetch(`/api/kpi/personal/${kpiId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: reviewNote.trim() || undefined }),
      })
      await parseJsonOrThrow(response)
      setBanner({
        tone: 'success',
        message:
          action === 'START_REVIEW'
            ? '검토를 시작했습니다.'
            : action === 'APPROVE'
              ? 'KPI를 승인했습니다.'
              : action === 'REJECT'
                ? 'KPI를 반려했습니다.'
                : action === 'LOCK'
                  ? 'KPI를 잠금 처리했습니다.'
                  : 'KPI를 다시 열었습니다.',
      })
      setReviewNote('')
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '검토 처리에 실패했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRunAi(action: AiAction) {
    setBusyAction('ai')
    setBanner(null)
    setActiveTab('ai')

    if (!props.permissions.canUseAi) {
      setAiPreview(null)
      setBanner({
        tone: 'info',
        message: '현재 계정은 AI 보조를 사용할 수 없습니다. 기본 작성 가이드를 확인해주세요.',
      })
      setBusyAction(null)
      return
    }

    try {
      const response = await fetch('/api/kpi/personal/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: selectedKpi?.id,
          payload: buildAiPayload(props, selectedKpi, form, action),
        }),
      })
      const data = await parseJsonOrThrow<{
        requestLogId: string
        source: 'ai' | 'fallback' | 'disabled'
        fallbackReason?: string | null
        result: Record<string, unknown>
      }>(response)

      setAiPreview({ ...data, action })
      setBanner({
        tone: data.source === 'ai' ? 'success' : 'info',
        message:
          data.source === 'ai'
            ? 'AI 제안을 불러왔습니다. 미리보기 후 적용 여부를 결정하세요.'
            : data.fallbackReason || 'AI 기본 제안을 불러왔습니다.',
      })
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 보조 실행에 실패했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleApproveAiPreview() {
    if (!aiPreview) return
    setBusyAction('ai-decision')
    setBanner(null)

    try {
      const response = await fetch(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approvedPayload: aiPreview.result }),
      })
      await parseJsonOrThrow(response)

      if (aiPreview.action === 'generate-draft' || aiPreview.action === 'improve-wording') {
        setEditorMode(selectedKpi ? 'edit' : 'create')
        setForm((current) => applyPreviewToForm(current, aiPreview.result))
        setEditorOpen(true)
      }

      setBanner({
        tone: 'success',
        message: 'AI 제안을 반영할 준비가 되었습니다. 저장 전에 내용을 확인해주세요.',
      })
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 제안을 반영하지 못했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRejectAiPreview() {
    if (!aiPreview) return
    setBusyAction('ai-decision')
    setBanner(null)

    try {
      const response = await fetch(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: '개인 KPI 화면에서 제안을 사용하지 않기로 선택했습니다.',
        }),
      })
      await parseJsonOrThrow(response)
      setAiPreview(null)
      setBanner({ tone: 'info', message: 'AI 제안을 반려했습니다.' })
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 제안을 반려하지 못했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  function handleSelectKpi(kpiId: string) {
    setSelectedKpiId(kpiId)
    handleRouteSelection({ kpiId })
  }

  function handleEditKpi(kpi: PersonalKpiViewModel) {
    if (!props.permissions.canEdit) {
      setBanner({ tone: 'error', message: '현재 범위에서는 KPI를 수정할 권한이 없습니다.' })
      return
    }
    setSelectedKpiId(kpi.id)
    setEditorMode('edit')
    setForm(buildFormFromKpi(kpi))
    setAiPreview(null)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader />
      <HeroSection
        state={props.state}
        actorName={props.actor.name}
        selectedYear={props.selectedYear}
        availableYears={props.availableYears}
        selectedCycleId={props.selectedCycleId}
        cycleOptions={props.cycleOptions}
        selectedEmployeeId={props.selectedEmployeeId}
        employeeOptions={props.employeeOptions}
        summary={props.summary}
        submitState={submitCtaState}
        createDisabledReason={createDisabledReason}
        aiDisabledReason={aiDisabledReason}
        reviewDisabledReason={reviewDisabledReason}
        historyDisabledReason={historyDisabledReason}
        onChangeYear={(year) => handleRouteSelection({ year })}
        onChangeCycle={(cycleId) => handleRouteSelection({ cycleId })}
        onChangeEmployee={(employeeId) => handleRouteSelection({ employeeId })}
        onOpenCreate={handleOpenCreate}
        onOpenAiDraft={handleOpenAiDraft}
        onOpenHistory={handleOpenHistory}
        onOpenReview={handleOpenReview}
        onSubmit={handleSubmitSelected}
      />

      {props.alerts?.length ? <LoadAlerts alerts={props.alerts} /> : null}
      {banner ? <BannerMessage tone={banner.tone} message={banner.message} /> : null}

      {props.state === 'ready' ? (
        <>
          <SummaryCards summary={props.summary} />
          <Tabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === 'mine' ? (
            <MineSection
              items={props.mine}
              selectedId={selectedKpiId}
              onSelect={handleSelectKpi}
              onEdit={handleEditKpi}
              selectedKpi={selectedKpi}
              canEdit={props.permissions.canEdit}
            />
          ) : null}
          {activeTab === 'review' ? (
            <ReviewQueueSection
              items={props.reviewQueue}
              selectedId={selectedReviewId}
              onSelect={setSelectedReviewId}
              selectedItem={selectedReview}
              canReview={props.permissions.canReview}
              busy={busyAction === 'workflow'}
              reviewNote={reviewNote}
              onReviewNoteChange={setReviewNote}
              onAction={handleReviewWorkflow}
            />
          ) : null}
          {activeTab === 'history' ? (
            <HistorySection history={props.history} aiLogs={props.aiLogs} />
          ) : null}
          {activeTab === 'ai' ? (
            <AiSection
              canUseAi={props.permissions.canUseAi}
              actions={AI_ACTIONS}
              busy={busyAction === 'ai'}
              preview={aiPreview}
              logs={props.aiLogs}
              onRun={handleRunAi}
              onApprove={handleApproveAiPreview}
              onReject={handleRejectAiPreview}
              decisionBusy={busyAction === 'ai-decision'}
            />
          ) : null}
        </>
      ) : (
        <>
          <StatePanel state={props.state} message={props.message} />
          <Tabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === 'review' ? (
            <ReviewQueueSection
              items={props.reviewQueue}
              selectedId={selectedReviewId}
              onSelect={setSelectedReviewId}
              selectedItem={selectedReview}
              canReview={props.permissions.canReview}
              busy={busyAction === 'workflow'}
              reviewNote={reviewNote}
              onReviewNoteChange={setReviewNote}
              onAction={handleReviewWorkflow}
            />
          ) : null}
          {activeTab === 'history' ? (
            <HistorySection history={props.history} aiLogs={props.aiLogs} />
          ) : null}
          {activeTab === 'ai' ? (
            <AiSection
              canUseAi={props.permissions.canUseAi}
              actions={AI_ACTIONS}
              busy={busyAction === 'ai'}
              preview={aiPreview}
              logs={props.aiLogs}
              onRun={handleRunAi}
              onApprove={handleApproveAiPreview}
              onReject={handleRejectAiPreview}
              decisionBusy={busyAction === 'ai-decision'}
            />
          ) : null}
        </>
      )}

      <QuickLinks />

      {editorOpen ? (
        <EditorModal
          mode={editorMode}
          form={form}
          orgKpiOptions={props.orgKpiOptions}
          busy={busyAction === 'save-form'}
          onChange={setForm}
          onClose={() => setEditorOpen(false)}
          onSave={handleSaveForm}
        />
      ) : null}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Personal KPI Workspace</p>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">개인 KPI</h1>
        <p className="text-sm text-slate-600">
          조직 목표와 연결된 개인 KPI를 작성하고, 검토와 변경 이력을 한 화면에서 관리합니다.
        </p>
      </div>
    </div>
  )
}

function HeroSection(props: {
  state: Props['state']
  actorName: string
  selectedYear: number
  availableYears: number[]
  selectedCycleId?: string
  cycleOptions: Props['cycleOptions']
  selectedEmployeeId: string
  employeeOptions: Props['employeeOptions']
  summary: Props['summary']
  submitState: PersonalKpiSubmitCtaState
  createDisabledReason?: string
  aiDisabledReason?: string
  reviewDisabledReason?: string
  historyDisabledReason?: string
  onChangeYear: (year: string) => void
  onChangeCycle: (cycleId: string) => void
  onChangeEmployee: (employeeId: string) => void
  onOpenCreate: () => void
  onOpenAiDraft: () => void
  onOpenHistory: () => void
  onOpenReview: () => void
  onSubmit: () => void
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={props.summary.overallStatus} />
            <InfoPill>{props.actorName}</InfoPill>
            <InfoPill>
              {props.state === 'ready'
                ? '운영 중'
                : props.state === 'empty'
                  ? '초안 준비'
                  : props.state === 'no-target'
                    ? '대상 선택 필요'
                    : props.state === 'setup-required'
                      ? '운영 설정 필요'
                      : '확인 필요'}
            </InfoPill>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SelectorCard label="연도">
              <select
                value={String(props.selectedYear)}
                onChange={(event) => props.onChangeYear(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {props.availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
            </SelectorCard>

            <SelectorCard label="평가 주기">
              <select
                value={props.selectedCycleId ?? ''}
                onChange={(event) => props.onChangeCycle(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">전체 주기</option>
                {props.cycleOptions.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
            </SelectorCard>

            <SelectorCard label="대상자">
              <select
                value={props.selectedEmployeeId}
                onChange={(event) => props.onChangeEmployee(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {props.employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.departmentName}
                  </option>
                ))}
              </select>
            </SelectorCard>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="총 KPI 수" value={`${props.summary.totalCount}개`} />
            <MetricCard label="총 가중치" value={`${props.summary.totalWeight}%`} />
            <MetricCard label="남은 가중치" value={`${props.summary.remainingWeight}%`} />
            <MetricCard
              label="조직 KPI 연결률"
              value={
                props.summary.totalCount > 0
                  ? `${Math.round((props.summary.linkedOrgKpiCount / props.summary.totalCount) * 100)}%`
                  : '0%'
              }
            />
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 xl:max-w-md">
          <ActionButton
            icon={<Plus className="h-4 w-4" />}
            onClick={props.onOpenCreate}
            disabled={Boolean(props.createDisabledReason)}
            title={props.createDisabledReason}
          >
            KPI 추가
          </ActionButton>
          <ActionButton
            icon={<Sparkles className="h-4 w-4" />}
            variant="secondary"
            onClick={props.onOpenAiDraft}
            disabled={Boolean(props.aiDisabledReason)}
            title={props.aiDisabledReason}
          >
            AI 초안 생성
          </ActionButton>
          <ActionButton
            icon={<ClipboardList className="h-4 w-4" />}
            variant="secondary"
            onClick={props.onOpenReview}
            title={props.reviewDisabledReason || PERSONAL_KPI_REVIEW_CTA_LABEL}
            disabled={Boolean(props.reviewDisabledReason)}
          >
            검토 대기 보기
          </ActionButton>
          <ActionButton
            icon={<History className="h-4 w-4" />}
            variant="secondary"
            onClick={props.onOpenHistory}
            disabled={Boolean(props.historyDisabledReason)}
            title={props.historyDisabledReason}
          >
            이력 보기
          </ActionButton>
          <ActionButton
            icon={<Send className="h-4 w-4" />}
            variant="secondary"
            onClick={props.onSubmit}
            disabled={props.submitState.disabled}
            title={props.submitState.reason}
          >
            제출
          </ActionButton>
          <p data-testid="personal-kpi-submit-helper" className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {props.submitState.reason}
          </p>
        </div>
      </div>
    </section>
  )
}

function SummaryCards(props: { summary: Props['summary'] }) {
  const nextAction =
    props.summary.remainingWeight !== 0
      ? '가중치가 100%가 되도록 조정하세요.'
      : props.summary.reviewPendingCount > 0
        ? '검토 대기 중인 KPI를 확인하세요.'
        : props.summary.rejectedCount > 0
          ? '반려된 KPI를 수정하고 다시 제출하세요.'
          : '월간 실적 입력과 검토 흐름으로 이어갈 준비가 되었습니다.'

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="연결된 조직 KPI 수" value={`${props.summary.linkedOrgKpiCount}개`} />
      <MetricCard label="검토 대기 수" value={`${props.summary.reviewPendingCount}개`} />
      <MetricCard label="반려 건수" value={`${props.summary.rejectedCount}개`} />
      <MetricCard label="최근 월간 실적 반영률" value={`${props.summary.monthlyCoverageRate}%`} />
      <div className="md:col-span-2 xl:col-span-4">
        <SectionCard title="다음 행동" description={nextAction}>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <InfoPill>가중치 100 맞추기</InfoPill>
            <InfoPill>조직 KPI 연결 누락 확인</InfoPill>
            <InfoPill>반려 KPI 재검토</InfoPill>
            <InfoPill>월간 실적 입력 준비</InfoPill>
          </div>
        </SectionCard>
      </div>
    </section>
  )
}

function Tabs(props: { activeTab: PersonalKpiTabKey; onChange: (tab: PersonalKpiTabKey) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => props.onChange(tab.key)}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              props.activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function MineSection(props: {
  items: PersonalKpiViewModel[]
  selectedId: string
  onSelect: (id: string) => void
  onEdit: (kpi: PersonalKpiViewModel) => void
  selectedKpi?: PersonalKpiViewModel
  canEdit: boolean
}) {
  if (!props.items.length) {
    return (
      <EmptyState
        title="아직 작성된 KPI가 없습니다."
        description="상단의 KPI 추가 버튼으로 첫 개인 KPI를 작성해보세요."
      />
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard title="내 KPI" description="조직 KPI 연결 여부와 최근 달성 흐름을 함께 확인하세요.">
        <div className="space-y-3">
          {props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onSelect(item.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                props.selectedId === item.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{item.title}</span>
                    <StatusBadge status={item.status} />
                    <InfoPill>{KPI_TYPE_LABELS[item.type]}</InfoPill>
                  </div>
                  <p className={`text-xs ${props.selectedId === item.id ? 'text-slate-200' : 'text-slate-500'}`}>
                    {item.orgKpiTitle ? `상위 목표: ${item.orgKpiTitle}` : '연결된 조직 KPI 없음'}
                  </p>
                </div>
                <div className={`text-right text-xs ${props.selectedId === item.id ? 'text-slate-200' : 'text-slate-500'}`}>
                  <div>가중치 {item.weight}%</div>
                  <div>최근 달성률 {formatPercent(item.monthlyAchievementRate)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <DetailPanel selectedKpi={props.selectedKpi} canEdit={props.canEdit} onEdit={props.onEdit} />
    </div>
  )
}

function DetailPanel(props: {
  selectedKpi?: PersonalKpiViewModel
  canEdit: boolean
  onEdit: (kpi: PersonalKpiViewModel) => void
}) {
  if (!props.selectedKpi) {
    return (
      <EmptyState title="선택된 KPI가 없습니다." description="왼쪽 목록에서 KPI를 선택하면 상세 정보를 볼 수 있습니다." />
    )
  }

  const item = props.selectedKpi

  return (
    <SectionCard title="KPI 상세" description="정의, 검토 코멘트, 최근 월간 실적을 함께 확인하세요.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
            <p className="text-sm text-slate-500">{item.departmentName}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={item.status} />
            {props.canEdit ? (
              <ActionButton variant="secondary" onClick={() => props.onEdit(item)}>
                수정
              </ActionButton>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="KPI 유형" value={KPI_TYPE_LABELS[item.type]} />
          <Field label="가중치" value={`${item.weight}%`} />
          <Field label="난이도" value={item.difficulty ? DIFFICULTY_LABELS[item.difficulty as KpiForm['difficulty']] : '-'} />
          <Field label="최근 달성률" value={formatPercent(item.monthlyAchievementRate)} />
          <Field label="목표값" value={item.targetValue ? `${item.targetValue}${item.unit ? ` ${item.unit}` : ''}` : '-'} />
          <Field label="조직 KPI 연결" value={item.orgKpiTitle ?? '미연결'} />
        </div>

        <Block title="정의">{item.definition || '정의가 아직 작성되지 않았습니다.'}</Block>
        <Block title="산식">{item.formula || '산식이 아직 작성되지 않았습니다.'}</Block>
        <Block title="검토 코멘트">{item.reviewComment || '검토 코멘트가 아직 없습니다.'}</Block>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">최근 월간 실적</h4>
          {item.recentMonthlyRecords.length ? (
            <div className="space-y-2">
              {item.recentMonthlyRecords.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{record.month}</span>
                    <span className="text-slate-600">{formatPercent(record.achievementRate)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{record.activities || record.obstacles || '요약 메모 없음'}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInline text="최근 월간 실적이 아직 없습니다." />
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function ReviewQueueSection(props: {
  items: PersonalKpiReviewQueueItem[]
  selectedId: string
  onSelect: (id: string) => void
  selectedItem?: PersonalKpiReviewQueueItem
  canReview: boolean
  busy: boolean
  reviewNote: string
  onReviewNoteChange: (value: string) => void
  onAction: (kpiId: string, action: 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'LOCK' | 'REOPEN') => void
}) {
  const selectedItem = props.selectedItem

  if (!props.items.length) {
    return (
      <EmptyState
        title="검토할 KPI가 없습니다."
        description="검토 대기 목록이 비어 있습니다. 제출된 KPI가 생기면 이 탭에서 바로 확인할 수 있습니다."
      />
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="검토 대기" description="변경 필드와 검토 메모를 확인한 뒤 승인 또는 반려하세요.">
        <div className="space-y-3">
          {props.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => props.onSelect(item.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                props.selectedId === item.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{item.title}</div>
                  <div className={`text-xs ${props.selectedId === item.id ? 'text-slate-200' : 'text-slate-500'}`}>
                    {item.employeeName} · {item.departmentName}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className={`mt-2 flex flex-wrap gap-2 text-xs ${props.selectedId === item.id ? 'text-slate-200' : 'text-slate-500'}`}>
                {item.changedFields.length ? item.changedFields.map((field) => <InfoPill key={field}>{field}</InfoPill>) : <span>변경 필드 정보 없음</span>}
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="검토 상세" description="검토 상태와 코멘트를 남기고 다음 단계를 진행하세요.">
        {selectedItem ? (
          <div className="space-y-4">
            <CompareCard label="이전 값" value={selectedItem.previousValueSummary || '이전 기록 없음'} />
            <CompareCard label="현재 값" value={selectedItem.currentValueSummary || '현재 요약 없음'} />
            <Block title="기존 반려 사유">{selectedItem.reviewComment || '반려 또는 검토 메모가 아직 없습니다.'}</Block>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">검토 메모</span>
              <textarea
                value={props.reviewNote}
                onChange={(event) => props.onReviewNoteChange(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="승인 또는 반려 사유를 남겨두면 구성원이 바로 확인할 수 있습니다."
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <ActionButton variant="secondary" disabled={!props.canReview || props.busy} onClick={() => props.onAction(selectedItem.id, 'START_REVIEW')}>
                검토 시작
              </ActionButton>
              <ActionButton disabled={!props.canReview || props.busy} onClick={() => props.onAction(selectedItem.id, 'APPROVE')}>
                승인
              </ActionButton>
              <ActionButton variant="secondary" disabled={!props.canReview || props.busy} onClick={() => props.onAction(selectedItem.id, 'REJECT')}>
                반려
              </ActionButton>
            </div>
          </div>
        ) : (
          <EmptyInline text="검토 대상을 선택하면 상세와 코멘트 입력 영역이 표시됩니다." />
        )}
      </SectionCard>
    </div>
  )
}

function HistorySection(props: { history: PersonalKpiTimelineItem[]; aiLogs: PersonalKpiAiLogItem[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="변경 이력" description="생성, 제출, 반려, 확정, 잠금 이력을 확인할 수 있습니다.">
        {props.history.length ? (
          <div className="space-y-3">
            {props.history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ActionBadge>{item.action}</ActionBadge>
                    <span className="text-sm font-medium text-slate-900">{item.actor}</span>
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(item.at)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.detail || item.note || '상세 메모가 없습니다.'}</p>
                {item.fromStatus || item.toStatus ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.fromStatus || '-'} → {item.toStatus || '-'}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="이력이 없습니다." description="아직 기록된 변경 이력이 없습니다." />
        )}
      </SectionCard>

      <SectionCard title="AI 사용 로그" description="AI 보조 요청과 승인 여부를 함께 확인할 수 있습니다.">
        {props.aiLogs.length ? (
          <div className="space-y-3">
            {props.aiLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ActionBadge>{log.sourceType}</ActionBadge>
                    <span className="text-sm font-medium text-slate-900">{log.requesterName}</span>
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{log.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  요청 상태: {log.requestStatus} · 승인 상태: {log.approvalStatus}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="AI 로그가 없습니다." description="아직 저장된 AI 보조 요청이 없습니다." />
        )}
      </SectionCard>
    </div>
  )
}

function AiSection(props: {
  canUseAi: boolean
  actions: Array<{ action: AiAction; title: string; description: string }>
  busy: boolean
  preview: AiPreview | null
  logs: PersonalKpiAiLogItem[]
  decisionBusy: boolean
  onRun: (action: AiAction) => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="AI 보조" description="초안 생성부터 SMART 점검, 검토 포인트 생성까지 현재 문맥에서 바로 실행할 수 있습니다.">
        {!props.canUseAi ? (
          <EmptyState
            title="AI 보조를 사용할 수 없습니다."
            description="권한이 없거나 현재 환경에서 AI 기능이 비활성화되어 있습니다. 기본 작성 가이드를 참고해주세요."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {props.actions.map((item) => (
              <button
                key={item.action}
                type="button"
                onClick={() => props.onRun(item.action)}
                disabled={props.busy}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Bot className="h-4 w-4 text-slate-500" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="AI 미리보기" description="제안을 바로 적용하지 않고, 검토 후 반영 여부를 결정합니다.">
        {props.preview ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={props.preview.source === 'ai' ? 'CONFIRMED' : 'DRAFT'} />
                <span className="text-sm font-medium text-slate-900">{props.preview.source === 'ai' ? 'AI 결과' : 'Fallback 제안'}</span>
              </div>
              {props.preview.fallbackReason ? <p className="mt-2 text-xs text-slate-500">{props.preview.fallbackReason}</p> : null}
            </div>

            <div className="space-y-2">
              {Object.entries(props.preview.result).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{key}</p>
                  <div className="mt-2 text-sm text-slate-700">{renderPreviewValue(value)}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton disabled={props.decisionBusy} onClick={props.onApprove}>
                제안 적용
              </ActionButton>
              <ActionButton variant="secondary" disabled={props.decisionBusy} onClick={props.onReject}>
                제안 반려
              </ActionButton>
            </div>
          </div>
        ) : props.logs.length ? (
          <div className="space-y-3">
            {props.logs.slice(0, 4).map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-slate-900">{log.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {log.sourceType} · {formatDateTime(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="AI 제안이 아직 없습니다." description="왼쪽에서 AI 기능을 실행하면 이 영역에 preview가 표시됩니다." />
        )}
      </SectionCard>
    </div>
  )
}

function StatePanel(props: { state: Props['state']; message?: string }) {
  if (props.state === 'no-target') {
    return (
      <EmptyState
        title="조회할 대상자를 먼저 선택해 주세요."
        description={
          props.message ?? '상단 대상자 선택에서 조회할 직원을 다시 선택하면 개인 KPI 작성과 검토를 이어서 진행할 수 있습니다.'
        }
      />
    )
  }

  if (props.state === 'setup-required') {
    return (
      <EmptyState
        title="개인 KPI 운영 설정이 더 필요합니다."
        description={
          props.message ?? '조회 가능한 대상자 범위나 조직 연결 설정이 없어 개인 KPI 화면을 준비할 수 없습니다.'
        }
      />
    )
  }

  const title =
    props.state === 'empty'
      ? '아직 등록된 개인 KPI가 없습니다.'
      : props.state === 'permission-denied'
        ? '이 개인 KPI를 조회할 권한이 없습니다.'
        : '개인 KPI 화면을 준비하는 중 문제가 발생했습니다.'

  const description =
    props.message ||
    (props.state === 'empty'
      ? '상단 CTA로 KPI 추가, AI 초안 생성, 이력 보기, 검토 화면 열기를 계속 사용할 수 있습니다.'
      : props.state === 'permission-denied'
        ? '권한 범위를 조정하거나 다른 대상자를 선택해보세요.'
        : '잠시 후 다시 시도하거나, 이력/AI 탭으로 이동해 현재 상태를 확인하세요.')

  return <EmptyState title={title} description={description} />
}

function QuickLinks() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Link2 className="h-4 w-4 text-slate-500" />
        빠른 이동
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { href: '/kpi/org', label: '조직 KPI' },
          { href: '/kpi/monthly', label: '월간 실적' },
          { href: '/evaluation/results', label: '평가 결과' },
          { href: '/evaluation/workbench', label: '평가 워크벤치' },
          { href: '/checkin', label: '체크인 일정' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function EditorModal(props: {
  mode: EditorMode
  form: KpiForm
  orgKpiOptions: Props['orgKpiOptions']
  busy: boolean
  onChange: (next: KpiForm | ((current: KpiForm) => KpiForm)) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{props.mode === 'create' ? '개인 KPI 추가' : '개인 KPI 수정'}</h2>
            <p className="text-sm text-slate-500">
              조직 KPI 연결, 가중치, 검토 기준을 함께 입력해 이후 월간 실적과 평가까지 연결하세요.
            </p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">KPI명</span>
              <input
                value={props.form.kpiName}
                onChange={(event) => props.onChange((current) => ({ ...current, kpiName: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="예: 주요 고객 이슈 해결 리드타임 단축"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">KPI 유형</span>
              <select
                value={props.form.kpiType}
                onChange={(event) =>
                  props.onChange((current) => ({
                    ...current,
                    kpiType: event.target.value as KpiForm['kpiType'],
                    formula: event.target.value === 'QUALITATIVE' ? '' : current.formula,
                    unit: event.target.value === 'QUALITATIVE' ? '건' : current.unit,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="QUANTITATIVE">정량 KPI</option>
                <option value="QUALITATIVE">정성 KPI</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-900">정의</span>
            <textarea
              value={props.form.definition}
              onChange={(event) => props.onChange((current) => ({ ...current, definition: event.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="무엇을 달성하려는 KPI인지, 왜 중요한지를 명확하게 적어주세요."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">산식 또는 평가 기준</span>
              <textarea
                value={props.form.formula}
                onChange={(event) => props.onChange((current) => ({ ...current, formula: event.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                placeholder={
                  props.form.kpiType === 'QUANTITATIVE'
                    ? '예: 실제 실적 / 목표 x 100'
                    : '예: 핵심 이해관계자 피드백과 프로젝트 리뷰를 기반으로 3단계 기준 평가'
                }
              />
            </label>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-900">목표값</span>
                <input
                  value={props.form.targetValue}
                  onChange={(event) => props.onChange((current) => ({ ...current, targetValue: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={props.form.kpiType === 'QUANTITATIVE' ? '예: 95' : '예: 분기 4건'}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-900">단위</span>
                  <input
                    value={props.form.unit}
                    onChange={(event) => props.onChange((current) => ({ ...current, unit: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="예: %, 건, 점"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-900">가중치</span>
                  <input
                    value={props.form.weight}
                    onChange={(event) => props.onChange((current) => ({ ...current, weight: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="예: 25"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">난이도</span>
              <select
                value={props.form.difficulty}
                onChange={(event) =>
                  props.onChange((current) => ({ ...current, difficulty: event.target.value as KpiForm['difficulty'] }))
                }
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="HIGH">상</option>
                <option value="MEDIUM">중</option>
                <option value="LOW">하</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">연결 조직 KPI</span>
              <select
                value={props.form.linkedOrgKpiId}
                onChange={(event) => props.onChange((current) => ({ ...current, linkedOrgKpiId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">연결 안 함</option>
                {props.orgKpiOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} · {option.departmentName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <ActionButton variant="secondary" onClick={props.onClose}>
            취소
          </ActionButton>
          <ActionButton disabled={props.busy} onClick={props.onSave}>
            {props.busy ? '저장 중...' : props.mode === 'create' ? '개인 KPI 추가' : '변경 저장'}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

function SectionCard(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
        {props.description ? <p className="text-sm text-slate-500">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  )
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{props.value}</p>
    </div>
  )
}

function SelectorCard(props: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</span>
      {props.children}
    </label>
  )
}

function Field(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-sm text-slate-900">{props.value}</p>
    </div>
  )
}

function Block(props: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{props.title}</h4>
      <div className="mt-2 text-sm leading-6 text-slate-700">{props.children}</div>
    </div>
  )
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-lg font-semibold text-slate-900">{props.title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.description}</p>
    </section>
  )
}

function EmptyInline(props: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">{props.text}</p>
}

function InfoPill(props: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{props.children}</span>
}

function StatusBadge(props: { status?: string }) {
  const status = props.status || 'DRAFT'
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[status] || STATUS_CLASS.DRAFT}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function ActionBadge(props: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{props.children}</span>
}

function CompareCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{props.value}</p>
    </div>
  )
}

function BannerMessage(props: Banner) {
  const toneClass =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-sky-200 bg-sky-50 text-sky-700'

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{props.message}</div>
}

function LoadAlerts(props: {
  alerts: Array<{
    title: string
    description: string
  }>
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">일부 운영 정보를 불러오지 못해 기본 화면으로 표시 중입니다.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
        {props.alerts.map((alert) => (
          <li key={`${alert.title}:${alert.description}`}>
            {alert.title} {alert.description}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActionButton(props: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  title?: string
  icon?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        props.variant === 'secondary'
          ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {props.icon}
      {props.children}
    </button>
  )
}

function renderPreviewValue(value: unknown): ReactNode {
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={index} className="rounded-xl bg-slate-50 px-3 py-2">
            {renderPreviewValue(item)}
          </li>
        ))}
      </ul>
    )
  }

  const record = toRecord(value)
  if (record) {
    return (
      <div className="space-y-2">
        {Object.entries(record).map(([key, item]) => (
          <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{key}</p>
            <div className="mt-1">{renderPreviewValue(item)}</div>
          </div>
        ))}
      </div>
    )
  }

  return <span>{String(value ?? '-')}</span>
}
