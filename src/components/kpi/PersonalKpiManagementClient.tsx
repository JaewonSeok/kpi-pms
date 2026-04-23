'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileDown,
  FilePlus2,
  History,
  Link2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useImpersonationRiskAction } from '@/components/security/useImpersonationRiskAction'
import { KpiAiPreviewPanel } from '@/components/kpi/KpiAiPreviewPanel'
import { MidReviewReferencePanel } from '@/components/mid-review/MidReviewReferencePanel'
import {
  createEvidenceLinkAttachment,
  downloadEvidenceAttachment,
  openEvidenceLink,
  readEvidenceFiles,
} from '@/lib/evidence-attachments-client'
import {
  getPersonalKpiDeleteActionState,
  resolveNextPersonalKpiSelectionAfterDelete,
} from '@/lib/personal-kpi-delete'
import {
  extractKpiAiPreviewRecommendations,
  type KpiAiPreviewComparison,
  type KpiAiPreviewRecommendation,
} from '@/lib/kpi-ai-preview'
import { isAllowedMonthlyEvidenceUrl, type MonthlyAttachmentItem } from '@/lib/monthly-attachments'
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
import { formatCountWithUnit, formatRateBaseCopy, joinInlineParts } from '@/lib/metric-copy'

type Props = PersonalKpiPageData & {
  initialTab?: string
  initialKpiId?: string
}

type Banner = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type EditorMode = 'create' | 'edit'
type BusyAction =
  | 'save-form'
  | 'submit'
  | 'workflow'
  | 'ai'
  | 'ai-decision'
  | 'bulk-edit'
  | 'delete'
  | 'evidence-save'
  | 'evidence-upload'
  | 'midcheck-coach'
  | null

type KpiForm = {
  employeeId: string
  evalYear: number
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiName: string
  tags: string
  definition: string
  formula: string
  targetValue: string
  unit: string
  weight: string
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
  linkedOrgKpiId: string
}

type PersonalCloneForm = {
  targetEmployeeId: string
  targetEvalYear: string
  targetCycleId: string
  includeProgress: boolean
  includeCheckins: boolean
  assignToSelf: boolean
}

type PersonalBulkEditForm = {
  applyAssignee: boolean
  employeeId: string
  applyOrgKpi: boolean
  linkedOrgKpiId: string
  applyDifficulty: boolean
  difficulty: KpiForm['difficulty']
  applyTags: boolean
  tags: string
}

type WeightApprovalView = PersonalKpiViewModel['weightApproval'] | PersonalKpiReviewQueueItem['weightApproval']

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

type AiActionState = {
  disabled: boolean
  reason?: string
}

type EvidenceDraft = {
  recordId?: string
  yearMonth: string
  evidenceComment: string
  attachments: MonthlyAttachmentItem[]
  linkUrlInput: string
  linkCommentInput: string
}

type MidcheckCoachStatus = 'on_track' | 'watch' | 'risk' | 'insufficient_data'

type MidcheckCoachResult = {
  status: MidcheckCoachStatus
  headline: string
  summary: string
  strengths: string[]
  gaps: string[]
  risk_signals: string[]
  next_actions: Array<{
    title: string
    reason: string
    priority: 'high' | 'medium' | 'low'
    due_hint: string
  }>
  coaching_questions: string[]
  employee_update_draft: string
  manager_share_draft: string
  evidence_feedback: {
    sufficiency: 'sufficient' | 'partial' | 'insufficient'
    cited_evidence: string[]
    missing_items: string[]
  }
  disclaimer: string
}

type MidcheckCoachPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: MidcheckCoachResult
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

const PERSONAL_KPI_AI_PREVIEW_ERROR_MESSAGE =
  'AI 초안 생성 중 설정 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.'

const MIDCHECK_STATUS_LABELS: Record<MidcheckCoachStatus, string> = {
  on_track: '순항',
  watch: '주의',
  risk: '리스크',
  insufficient_data: '정보 부족',
}

const MIDCHECK_STATUS_CLASS: Record<MidcheckCoachStatus, string> = {
  on_track: 'bg-emerald-100 text-emerald-700',
  watch: 'bg-amber-100 text-amber-800',
  risk: 'bg-rose-100 text-rose-700',
  insufficient_data: 'bg-slate-100 text-slate-700',
}

const MIDCHECK_PRIORITY_LABELS: Record<MidcheckCoachResult['next_actions'][number]['priority'], string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}

function createEvidenceDraft(kpi?: PersonalKpiViewModel): EvidenceDraft {
  return {
    recordId: kpi?.evidenceRecord.recordId,
    yearMonth:
      kpi?.evidenceRecord.yearMonth ??
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    evidenceComment: kpi?.evidenceRecord.evidenceComment ?? '',
    attachments: kpi?.evidenceRecord.attachments ?? [],
    linkUrlInput: '',
    linkCommentInput: '',
  }
}

function appendCoachDraft(currentValue: string, draft: string) {
  const trimmedCurrent = currentValue.trim()
  const trimmedDraft = draft.trim()

  if (!trimmedDraft) return trimmedCurrent
  if (!trimmedCurrent) return trimmedDraft
  if (trimmedCurrent.includes(trimmedDraft)) return trimmedCurrent

  return `${trimmedCurrent}\n\n[AI 제안]\n${trimmedDraft}`
}

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

function previewRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function previewStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function buildPersonalAiPreviewComparisons(params: {
  preview: AiPreview | null
  selectedKpi: PersonalKpiViewModel | null
  form: KpiForm
}): KpiAiPreviewComparison[] {
  if (!params.preview) return []

  const record = previewRecord(params.preview.result) ?? {}
  const comparisons: KpiAiPreviewComparison[] = []

  const push = (label: string, before?: string | null, after?: string | null) => {
    if (!after || before?.trim() === after.trim()) return
    comparisons.push({ label, before, after })
  }

  push('KPI명', params.selectedKpi?.title ?? params.form.kpiName, previewStringValue(record.improvedTitle ?? record.title))
  push('정의', params.selectedKpi?.definition ?? params.form.definition, previewStringValue(record.improvedDefinition ?? record.definition))
  push('산식', params.selectedKpi?.formula ?? params.form.formula, previewStringValue(record.formula))
  push(
    '목표값',
    typeof params.selectedKpi?.targetValue === 'number' ? String(params.selectedKpi.targetValue) : params.form.targetValue,
    previewStringValue(record.targetValueSuggestion)
  )
  push('가중치', params.selectedKpi ? String(params.selectedKpi.weight) : params.form.weight, previewStringValue(record.weightSuggestion))
  push('연결 조직 KPI', params.selectedKpi?.orgKpiTitle, previewStringValue(record.recommendedOrgKpiTitle))

  return comparisons
}

function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
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

function toPersonalKpiAiPreviewErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return PERSONAL_KPI_AI_PREVIEW_ERROR_MESSAGE
  }

  if (
    error.message.includes('response_format') ||
    error.message.includes('json_schema') ||
    error.message.includes('structured output') ||
    error.message.includes('OpenAI')
  ) {
    return PERSONAL_KPI_AI_PREVIEW_ERROR_MESSAGE
  }

  return error.message
}

function parseAiJsonOrThrow<T>(response: Response) {
  return parseJsonOrThrow<T>(response).catch((error) => {
    throw new Error(toPersonalKpiAiPreviewErrorMessage(error))
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
    tags: '',
    definition: '',
    formula: '',
    targetValue: '',
    unit: '%',
    weight: '',
    difficulty: 'MEDIUM',
    linkedOrgKpiId: '',
  }
}

function buildCloneForm(props: Props, selectedKpi?: PersonalKpiViewModel): PersonalCloneForm {
  return {
    targetEmployeeId: selectedKpi?.employeeId ?? props.selectedEmployeeId,
    targetEvalYear: String(props.selectedYear),
    targetCycleId: props.selectedCycleId ?? props.cycleOptions[0]?.id ?? '',
    includeProgress: false,
    includeCheckins: false,
    assignToSelf: false,
  }
}

function buildBulkEditForm(props: Props): PersonalBulkEditForm {
  return {
    applyAssignee: false,
    employeeId: props.selectedEmployeeId,
    applyOrgKpi: false,
    linkedOrgKpiId: '',
    applyDifficulty: false,
    difficulty: 'MEDIUM',
    applyTags: false,
    tags: '',
  }
}

function getSubmitActionLabel(kpi?: PersonalKpiViewModel) {
  if (!kpi) return '승인 요청'
  return kpi.weightApproval.status === 'REJECTED' || kpi.hasRejectedRevision
    ? '수정 후 승인 재요청'
    : '승인 요청'
}

function buildFormFromKpi(kpi: PersonalKpiViewModel): KpiForm {
  return {
    employeeId: kpi.employeeId,
    evalYear: new Date(kpi.updatedAt ?? Date.now()).getFullYear(),
    kpiType: kpi.type,
    kpiName: kpi.title,
    tags: kpi.tags.join(', '),
    definition: kpi.definition ?? '',
    formula: kpi.formula ?? '',
    targetValue: toNumberString(kpi.targetValue),
    unit: kpi.unit ?? '',
    weight: toNumberString(kpi.weight),
    difficulty: (kpi.difficulty ?? 'MEDIUM') as KpiForm['difficulty'],
    linkedOrgKpiId: kpi.orgKpiId ?? '',
  }
}

function buildAiPayload(
  props: Props,
  selectedKpi: PersonalKpiViewModel | undefined,
  form: KpiForm,
  action: AiAction,
  candidates: PersonalKpiViewModel[]
) {
  const targetEmployeeId = selectedKpi?.employeeId ?? form.employeeId ?? props.selectedEmployeeId
  const selectedEmployee =
    props.employeeOptions.find((item) => item.id === targetEmployeeId) ??
    props.employeeOptions.find((item) => item.id === props.selectedEmployeeId)
  const linkedOrgKpiId = selectedKpi?.orgKpiId ?? form.linkedOrgKpiId
  const linkedOrgKpi = props.orgKpiOptions.find((item) => item.id === linkedOrgKpiId)
  const currentTitle = selectedKpi?.title ?? form.kpiName

  return {
    action,
    selectedYear: props.selectedYear,
    selectedCycleId: props.selectedCycleId ?? null,
    employeeId: targetEmployeeId,
    employeeProfile: {
      displayLabel: selectedEmployee ? `${selectedEmployee.departmentName} ${selectedEmployee.name}` : props.actor.name,
      departmentLabel: selectedEmployee?.departmentName ?? props.actor.departmentName,
      roleLabel: selectedEmployee?.role ?? props.actor.role,
    },
    currentKpiId: selectedKpi?.id ?? null,
    kpiName: currentTitle,
    goal: currentTitle,
    definition: selectedKpi?.definition ?? form.definition,
    formula: selectedKpi?.formula ?? form.formula,
    targetValue: selectedKpi?.targetValue ?? toNumberOrUndefined(form.targetValue) ?? form.targetValue,
    unit: selectedKpi?.unit ?? form.unit,
    weight: selectedKpi?.weight ?? toNumberOrUndefined(form.weight) ?? form.weight,
    kpiType: selectedKpi?.type ?? form.kpiType,
    linkedOrgKpiId,
    orgKpiName: selectedKpi?.orgKpiTitle ?? linkedOrgKpi?.title,
    orgKpiCategory:
      selectedKpi?.orgKpiCategory ??
      linkedOrgKpi?.category,
    reviewComment: selectedKpi?.reviewComment,
    orgLineage: selectedKpi?.orgLineage.map((item) => ({
      id: item.id,
      title: item.title,
      departmentLabel: item.departmentName,
    })) ?? [],
    currentDraft: {
      title: currentTitle,
      definition: selectedKpi?.definition ?? form.definition,
      formula: selectedKpi?.formula ?? form.formula,
      targetValue: selectedKpi?.targetValue ?? toNumberOrUndefined(form.targetValue) ?? form.targetValue,
      unit: selectedKpi?.unit ?? form.unit,
      weight: selectedKpi?.weight ?? toNumberOrUndefined(form.weight) ?? form.weight,
      difficulty: selectedKpi?.difficulty ?? form.difficulty,
      category: selectedKpi?.orgKpiCategory ?? linkedOrgKpi?.category ?? null,
    },
    recentMonthlyRecords: selectedKpi?.recentMonthlyRecords ?? [],
    existingPersonalKpis: candidates.map((item) => ({
      id: item.id,
      title: item.title,
      definition: item.definition,
      formula: item.formula,
      type: item.type,
      weight: item.weight,
      status: item.status,
      orgKpiTitle: item.orgKpiTitle,
      orgLineage: item.orgLineage.map((node) => `${node.departmentName} · ${node.title}`).join(' → '),
    })),
  }
}

function normalizeKpiForm(form: KpiForm) {
  return {
    employeeId: form.employeeId.trim(),
    evalYear: form.evalYear,
    kpiType: form.kpiType,
    kpiName: form.kpiName.trim(),
    tags: form.tags.trim(),
    definition: form.definition.trim(),
    formula: form.formula.trim(),
    targetValue: form.targetValue.trim(),
    unit: form.unit.trim(),
    weight: form.weight.trim(),
    difficulty: form.difficulty,
    linkedOrgKpiId: form.linkedOrgKpiId.trim(),
  }
}

function areKpiFormsEqual(left: KpiForm, right: KpiForm) {
  return JSON.stringify(normalizeKpiForm(left)) === JSON.stringify(normalizeKpiForm(right))
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

function applyRecommendationToForm(
  form: KpiForm,
  recommendation: KpiAiPreviewRecommendation
) {
  const difficulty = toStringValue(recommendation.difficultyLevel, form.difficulty)
  const nextDifficulty = ['HIGH', 'MEDIUM', 'LOW'].includes(difficulty)
    ? (difficulty as KpiForm['difficulty'])
    : form.difficulty

  return {
    ...form,
    kpiName: recommendation.title || form.kpiName,
    definition: recommendation.definition || form.definition,
    formula: recommendation.formula || form.formula,
    targetValue: toStringValue(recommendation.targetValueE ?? recommendation.targetText, form.targetValue),
    unit: toStringValue(recommendation.unit, form.unit),
    weight: toStringValue(recommendation.weightSuggestion, form.weight),
    difficulty: nextDifficulty,
    linkedOrgKpiId:
      recommendation.primaryLinkedOrgKpiId ??
      recommendation.linkedParentKpiId ??
      form.linkedOrgKpiId,
  }
}

function isDraftStatus(status?: PersonalKpiViewModel['status']) {
  return status === 'DRAFT'
}

function buildAiActionState(params: {
  action: AiAction
  canUseAi: boolean
  selectedKpi?: PersonalKpiViewModel
  linkedOrgKpiId?: string
  reviewQueueCount: number
  totalKpiCount: number
}): AiActionState {
  if (!params.canUseAi) {
    return {
      disabled: true,
      reason: '현재 조건에서는 AI 보조를 사용할 수 없습니다.',
    }
    }

  switch (params.action) {
    case 'generate-draft':
      return params.selectedKpi?.orgKpiId || params.selectedKpi?.orgLineage.length || params.linkedOrgKpiId
        ? { disabled: false }
        : {
            disabled: true,
            reason: '연계된 조직 KPI를 선택한 뒤 AI 초안 생성을 실행해 주세요.',
          }
    case 'detect-duplicates':
      return params.totalKpiCount > 0
        ? { disabled: false }
        : {
            disabled: true,
            reason: '비교할 기존 KPI가 있을 때만 중복 점검을 실행할 수 있습니다.',
          }
    case 'summarize-review-risks':
      return params.reviewQueueCount > 0
        ? { disabled: false }
        : {
            disabled: true,
            reason: '검토 대기 KPI가 있을 때만 리뷰 리스크 요약을 실행할 수 있습니다.',
          }
    case 'draft-monthly-comment':
      return params.selectedKpi?.recentMonthlyRecords.length
        ? { disabled: false }
        : {
            disabled: true,
            reason: '월간 실적 기록이 있는 KPI를 선택한 뒤 실행해 주세요.',
          }
    case 'improve-wording':
    case 'smart-check':
    case 'suggest-weight':
    case 'suggest-org-alignment':
      return params.selectedKpi && isDraftStatus(params.selectedKpi.status)
        ? { disabled: false }
        : {
            disabled: true,
            reason: '초안 상태 KPI를 선택한 경우에만 실행할 수 있습니다.',
          }
    default:
      return { disabled: false }
  }
}

function derivePersonalSummary(items: PersonalKpiViewModel[], reviewPendingCount: number): Props['summary'] {
  const totalWeight = Math.round(items.reduce((sum, item) => sum + item.weight, 0) * 10) / 10
  const linkedOrgKpiCount = items.filter((item) => item.orgKpiId).length
  const rejectedCount = items.filter((item) => item.hasRejectedRevision).length
  const monthlyCoverageRate = items.length
    ? Math.round((items.filter((item) => item.linkedMonthlyCount > 0).length / items.length) * 100)
    : 0
  const statuses = Array.from(new Set(items.map((item) => item.status)))
  const overallStatus = items.length ? (statuses.length === 1 ? statuses[0] : 'MIXED') : 'DRAFT'

  return {
    totalCount: items.length,
    totalWeight,
    remainingWeight: Math.round(Math.max(0, 100 - totalWeight) * 10) / 10,
    linkedOrgKpiCount,
    rejectedCount,
    reviewPendingCount,
    monthlyCoverageRate,
    overallStatus,
  }
}

function getReviewActionState(status: PersonalKpiReviewQueueItem['status'], action: 'START_REVIEW' | 'APPROVE' | 'REJECT') {
  if (action === 'START_REVIEW') {
    return status === 'SUBMITTED'
      ? { disabled: false }
      : {
          disabled: true,
          reason: '제출 상태 KPI에서만 검토를 시작할 수 있습니다.',
        }
  }

  return status === 'SUBMITTED' || status === 'MANAGER_REVIEW'
    ? { disabled: false }
    : {
        disabled: true,
        reason: '검토 가능한 KPI에서만 승인 또는 반려할 수 있습니다.',
      }
}

function validateKpiForm(form: KpiForm) {
  if (!form.employeeId.trim()) {
    return '대상자를 먼저 선택한 뒤 KPI를 저장해 주세요.'
  }

  if (!form.kpiName.trim()) {
    return 'KPI명을 입력해 주세요.'
  }

  if (!form.weight.trim()) {
    return '가중치를 입력해 주세요.'
  }

  const weight = Number(form.weight)
  if (!Number.isFinite(weight)) {
    return '가중치는 숫자로 입력해 주세요.'
  }

  if (weight < 0 || weight > 100) {
    return '가중치는 0 이상 100 이하로 입력해 주세요.'
  }

  return undefined
}

export function PersonalKpiManagementClient(props: Props) {
  const router = useRouter()
  const { requestRiskConfirmation, riskDialog } = useImpersonationRiskAction()
  const [activeTabState, setActiveTabState] = useState<PersonalKpiTabKey>(isTabKey(props.initialTab) ? props.initialTab : 'mine')
  const [mineItems, setMineItems] = useState(props.mine)
  const [selectedKpiId, setSelectedKpiId] = useState(props.initialKpiId ?? props.mine[0]?.id ?? '')
  const [selectedReviewId, setSelectedReviewId] = useState(props.reviewQueue[0]?.id ?? '')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('create')
  const [form, setForm] = useState<KpiForm>(buildEmptyForm(props.selectedYear, props.selectedEmployeeId))
  const [formBaseline, setFormBaseline] = useState<KpiForm>(buildEmptyForm(props.selectedYear, props.selectedEmployeeId))
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneForm, setCloneForm] = useState<PersonalCloneForm>(buildCloneForm(props))
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditForm, setBulkEditForm] = useState<PersonalBulkEditForm>(buildBulkEditForm(props))
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [selectedAiRecommendationIndex, setSelectedAiRecommendationIndex] = useState<number | null>(null)
  const [pendingAiRecommendationIndex, setPendingAiRecommendationIndex] = useState<number | null>(null)
  const [showAiRecommendationSwitchConfirm, setShowAiRecommendationSwitchConfirm] = useState(false)
  const [approvedAiRequestLogIds, setApprovedAiRequestLogIds] = useState<string[]>([])
  const [reviewNote, setReviewNote] = useState('')
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, EvidenceDraft>>(() =>
    Object.fromEntries(props.mine.map((item) => [item.id, createEvidenceDraft(item)]))
  )
  const [midcheckCoachPreviews, setMidcheckCoachPreviews] = useState<Record<string, MidcheckCoachPreview | null>>({})
  const [midcheckCoachErrors, setMidcheckCoachErrors] = useState<Record<string, string | null>>({})

  useEffect(() => {
    setMineItems(props.mine)
  }, [props.mine])

  useEffect(() => {
    setEvidenceDrafts(Object.fromEntries(props.mine.map((item) => [item.id, createEvidenceDraft(item)])))
  }, [props.mine])

  useEffect(() => {
    if (!mineItems.length) {
      setSelectedKpiId('')
      return
    }

    const requestedKpiId =
      props.initialKpiId && mineItems.some((item) => item.id === props.initialKpiId)
        ? props.initialKpiId
        : undefined

    if (requestedKpiId && requestedKpiId !== selectedKpiId) {
      setSelectedKpiId(requestedKpiId)
      return
    }

    if (!mineItems.some((item) => item.id === selectedKpiId)) {
      setSelectedKpiId(mineItems[0].id)
    }
  }, [mineItems, props.initialKpiId, selectedKpiId])

  useEffect(() => {
    if (!props.reviewQueue.length) {
      setSelectedReviewId('')
      return
    }
    if (!props.reviewQueue.some((item) => item.id === selectedReviewId)) {
      setSelectedReviewId(props.reviewQueue[0].id)
    }
  }, [props.reviewQueue, selectedReviewId])

  useEffect(() => {
    setActiveTabState('mine')
    setMineItems(props.mine)
    setSelectedKpiId(
      props.initialKpiId && props.mine.some((item) => item.id === props.initialKpiId)
        ? props.initialKpiId
        : props.mine[0]?.id ?? ''
    )
    setSelectedReviewId(props.reviewQueue[0]?.id ?? '')
    const emptyForm = buildEmptyForm(props.selectedYear, props.selectedEmployeeId)
    setForm(emptyForm)
    setFormBaseline(emptyForm)
    setEditorOpen(false)
    setEditorMode('create')
    setCloneOpen(false)
    setCloneForm(buildCloneForm(props))
    setBulkEditOpen(false)
    setBulkEditForm(buildBulkEditForm(props))
    setShowDeleteConfirm(false)
    setAiPreview(null)
    setSelectedAiRecommendationIndex(null)
    setPendingAiRecommendationIndex(null)
    setShowAiRecommendationSwitchConfirm(false)
    setApprovedAiRequestLogIds([])
    setEvidenceDrafts(Object.fromEntries(props.mine.map((item) => [item.id, createEvidenceDraft(item)])))
    setMidcheckCoachPreviews({})
    setMidcheckCoachErrors({})
    setBanner(null)
    setReviewNote('')
  }, [props.selectedEmployeeId, props.selectedYear, props.selectedCycleId])

  const activeTab = activeTabState
  const selectedKpi = useMemo(
    () => mineItems.find((item) => item.id === selectedKpiId) ?? mineItems[0],
    [mineItems, selectedKpiId]
  )
  const selectedReview = useMemo(
    () => props.reviewQueue.find((item) => item.id === selectedReviewId) ?? props.reviewQueue[0],
    [props.reviewQueue, selectedReviewId]
  )
  const bulkTargetIds = useMemo(() => mineItems.map((item) => item.id), [mineItems])
  const goalEditLockedFromAlerts =
    props.alerts?.some((alert) => alert.title.includes('?쎄린 ?꾩슜 紐⑤뱶')) ?? false
  const derivedSummary = useMemo(
    () => derivePersonalSummary(mineItems, props.summary.reviewPendingCount),
    [mineItems, props.summary.reviewPendingCount]
  )
  const deleteActionState = getPersonalKpiDeleteActionState({
    kpi: selectedKpi
      ? {
          id: selectedKpi.id,
          title: selectedKpi.title,
          status: selectedKpi.status,
          linkedMonthlyCount: selectedKpi.linkedMonthlyCount,
        }
      : null,
    canManage: props.permissions.canEdit,
    goalEditLocked: goalEditLockedFromAlerts,
    busy: busyAction === 'delete',
  })
  const canEditSelectedKpi = Boolean(selectedKpi && props.permissions.canEdit && isDraftStatus(selectedKpi.status))
  const selectedEvidenceDraft = selectedKpi
    ? evidenceDrafts[selectedKpi.id] ?? createEvidenceDraft(selectedKpi)
    : null
  const canEditSelectedEvidence = Boolean(
    selectedKpi && (props.actor.id === selectedKpi.employeeId || props.actor.role === 'ROLE_ADMIN')
  )
  const selectedEvidenceEditReason =
    !selectedKpi
      ? '증빙을 관리할 KPI를 먼저 선택해 주세요.'
      : canEditSelectedEvidence
        ? undefined
        : '증빙 자료는 KPI 작성자 또는 관리자만 수정할 수 있습니다.'
  const selectedMidcheckCoachPreview = selectedKpi ? midcheckCoachPreviews[selectedKpi.id] ?? null : null
  const selectedMidcheckCoachError = selectedKpi ? midcheckCoachErrors[selectedKpi.id] ?? null : null
  const selectedKpiEditReason =
    !selectedKpi
      ? '수정할 KPI를 먼저 선택해 주세요.'
      : !props.permissions.canEdit
        ? '현재 범위에서는 KPI를 수정할 권한이 없습니다.'
        : isDraftStatus(selectedKpi.status)
          ? undefined
          : '초안 상태 KPI만 수정할 수 있습니다.'
  const cloneDisabledReason =
    !selectedKpi
      ? '복제할 KPI를 먼저 선택해 주세요.'
      : props.state === 'error'
        ? '개인 KPI 화면이 아직 완전히 준비되지 않아 복제를 시작할 수 없습니다.'
        : props.state === 'no-target'
          ? '대상자를 먼저 선택해야 KPI 복제를 진행할 수 있습니다.'
          : props.state === 'setup-required'
            ? '운영 대상자 또는 주기 설정이 없어 KPI 복제를 진행할 수 없습니다.'
            : !props.permissions.canCreate
              ? '현재 범위에서는 KPI를 복제할 권한이 없습니다.'
              : undefined
  const aiActionStates = Object.fromEntries(
    AI_ACTIONS.map((item) => [
      item.action,
      buildAiActionState({
        action: item.action,
        canUseAi: props.permissions.canUseAi,
        selectedKpi,
        linkedOrgKpiId: form.linkedOrgKpiId,
        reviewQueueCount: props.reviewQueue.length,
        totalKpiCount: mineItems.length,
      }),
    ])
  ) as Record<AiAction, AiActionState>
  const goalEditLocked =
    props.alerts?.some((alert) => alert.title.includes('읽기 전용 모드')) ?? false
  const aiPreviewRecommendations = useMemo(
    () => (aiPreview?.action === 'generate-draft' ? extractKpiAiPreviewRecommendations(aiPreview.result) : []),
    [aiPreview]
  )

  function openEditorWithForm(mode: EditorMode, nextForm: KpiForm) {
    setEditorMode(mode)
    setForm(nextForm)
    setFormBaseline(nextForm)
    setEditorOpen(true)
  }

  function applyAiRecommendationToEditor(recommendationIndex: number) {
    const recommendation = aiPreviewRecommendations[recommendationIndex]
    if (!recommendation) {
      setBanner({ tone: 'error', message: '적용할 AI 초안을 찾지 못했습니다. 다시 생성해 주세요.' })
      return
    }

    const nextForm = applyRecommendationToForm(form, recommendation)
    openEditorWithForm(selectedKpi ? 'edit' : 'create', nextForm)
    setSelectedAiRecommendationIndex(recommendationIndex)
    setPendingAiRecommendationIndex(null)
    setShowAiRecommendationSwitchConfirm(false)
    setBanner({
      tone: 'success',
      message: '선택한 AI 초안을 편집기에 반영했습니다. 저장 전에 내용을 확인해 주세요.',
    })
  }

  async function ensureAiPreviewApproved() {
    if (!aiPreview) {
      throw new Error('AI 미리보기 정보가 없습니다.')
    }

    if (approvedAiRequestLogIds.includes(aiPreview.requestLogId)) {
      return
    }

    try {
      const response = await fetch(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approvedPayload: aiPreview.result }),
      })
      await parseJsonOrThrow(response)
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already been decided')) {
        throw error
      }
    }

    setApprovedAiRequestLogIds((current) =>
      current.includes(aiPreview.requestLogId) ? current : [...current, aiPreview.requestLogId]
    )
  }

  const submitCtaState = goalEditLocked
    ? {
        disabled: true,
        reason: '현재는 목표 읽기 전용 모드로 승인 요청 대신 체크인과 코멘트만 이어갈 수 있습니다.',
      }
    : getPersonalKpiSubmitCtaState({
        canSubmit: props.permissions.canSubmit,
        totalCount: derivedSummary.totalCount,
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

  const bulkEditDisabledReason =
    props.state === 'error'
      ? '개인 KPI 화면이 아직 준비되지 않아 일괄 수정을 진행할 수 없습니다.'
      : props.state === 'no-target'
        ? '대상자를 먼저 선택해야 목표 일괄 수정을 진행할 수 있습니다.'
        : props.state === 'setup-required'
          ? '운영 설정이 없어 목표 일괄 수정을 진행할 수 없습니다.'
          : goalEditLocked
            ? '현재 주기는 체크인과 코멘트만 허용되어 목표 일괄 수정이 잠겨 있습니다.'
            : !bulkTargetIds.length
              ? '일괄 수정할 목표가 없습니다.'
              : !props.permissions.canEdit && !props.permissions.canOverride
                ? '현재 범위에서는 목표 일괄 수정 권한이 없습니다.'
                : undefined
  const submitLabel = getSubmitActionLabel(selectedKpi)

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
    if (next.tab && isTabKey(next.tab)) {
      setActiveTabState(next.tab)
    }
    const query = buildSearch({
      year: next.year ?? String(props.selectedYear),
      employeeId: next.employeeId ?? props.selectedEmployeeId,
      cycleId: next.cycleId ?? props.selectedCycleId,
      tab: next.tab ?? activeTab,
      kpiId: next.kpiId ?? selectedKpiId,
    })
    router.replace(`/kpi/personal?${query}`, { scroll: false })
  }

  function handleOpenCreate() {
    if (createDisabledReason) {
      setBanner({ tone: 'error', message: createDisabledReason })
      return
    }

    const transition = getPersonalKpiHeroCtaTransition('create')
    setActiveTab(transition.nextTab)
    openEditorWithForm('create', buildEmptyForm(props.selectedYear, props.selectedEmployeeId))
    setAiPreview(null)
    setSelectedAiRecommendationIndex(null)
    setPendingAiRecommendationIndex(null)
    setShowAiRecommendationSwitchConfirm(false)
  }

  function handleOpenClone() {
    if (cloneDisabledReason || !selectedKpi) {
      setBanner({ tone: 'error', message: cloneDisabledReason ?? '복제할 KPI를 먼저 선택해 주세요.' })
      return
    }

    setCloneForm(buildCloneForm(props, selectedKpi))
    setCloneOpen(true)
    setBanner(null)
  }

  function handleOpenBulkEdit() {
    if (bulkEditDisabledReason) {
      setBanner({ tone: 'error', message: bulkEditDisabledReason })
      return
    }

    setBulkEditForm(buildBulkEditForm(props))
    setBulkEditOpen(true)
    setBanner(null)
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
    if (reviewDisabledReason) {
      setBanner({ tone: 'info', message: reviewDisabledReason })
      return
    }
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
      const riskHeaders = await requestRiskConfirmation({
        actionName: 'FINAL_SUBMIT',
        actionLabel: '개인 KPI 제출',
        targetLabel: selectedKpi.title,
        detail: '현재 마스터 로그인 상태에서 개인 KPI를 제출합니다.',
        confirmationText: '제출',
      })
      if (riskHeaders === null) return

      const response = await fetch(`/api/kpi/personal/${selectedKpi.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...riskHeaders },
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

  async function handleSaveBulkEdit() {
    if (bulkEditDisabledReason) {
      setBanner({ tone: 'error', message: bulkEditDisabledReason })
      return
    }

    const payload: {
      ids: string[]
      employeeId?: string
      linkedOrgKpiId?: string | null
      difficulty?: PersonalBulkEditForm['difficulty']
      tags?: string[]
    } = {
      ids: bulkTargetIds,
    }

    if (bulkEditForm.applyAssignee) {
      payload.employeeId = bulkEditForm.employeeId
    }
    if (bulkEditForm.applyOrgKpi) {
      payload.linkedOrgKpiId = bulkEditForm.linkedOrgKpiId || null
    }
    if (bulkEditForm.applyDifficulty) {
      payload.difficulty = bulkEditForm.difficulty
    }
    if (bulkEditForm.applyTags) {
      payload.tags = parseTagInput(bulkEditForm.tags)
    }

    if (
      payload.employeeId === undefined &&
      payload.linkedOrgKpiId === undefined &&
      payload.difficulty === undefined &&
      payload.tags === undefined
    ) {
      setBanner({ tone: 'error', message: '일괄 수정할 항목을 하나 이상 선택해 주세요.' })
      return
    }

    setBusyAction('bulk-edit')
    setBanner(null)

    try {
      const response = await fetch('/api/kpi/personal/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await parseJsonOrThrow<{ updatedCount: number }>(response)
      setBulkEditOpen(false)
      setBulkEditForm(buildBulkEditForm(props))
      setBanner({
        tone: 'success',
        message: `개인 목표 ${data.updatedCount}건을 일괄 수정했습니다.`,
      })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '개인 목표 일괄 수정에 실패했습니다.',
      })
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

    const validationMessage = validateKpiForm(form)
    if (validationMessage) {
      setBanner({ tone: 'error', message: validationMessage })
      return
    }

    if (editorMode === 'edit' && selectedKpi && !isDraftStatus(selectedKpi.status)) {
      setBanner({ tone: 'error', message: '초안 상태 KPI만 수정할 수 있습니다.' })
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
        tags: parseTagInput(form.tags),
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

      const saved = await parseJsonOrThrow<{ id: string; employeeId: string }>(response)
      setFormBaseline(form)
      setEditorOpen(false)
      setSelectedKpiId(saved.id)
      handleRouteSelection({
        employeeId: saved.employeeId,
        tab: 'mine',
        kpiId: saved.id,
      })
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

  async function handleCloneKpi() {
    if (!selectedKpi) {
      setBanner({ tone: 'error', message: '복제할 KPI를 먼저 선택해 주세요.' })
      return
    }

    if (cloneDisabledReason) {
      setBanner({ tone: 'error', message: cloneDisabledReason })
      return
    }

    const targetEvalYear = Number(cloneForm.targetEvalYear)
    if (!Number.isInteger(targetEvalYear) || targetEvalYear < 2020 || targetEvalYear > 2100) {
      setBanner({ tone: 'error', message: '복제 대상 연도를 확인해 주세요.' })
      return
    }

    if (!cloneForm.assignToSelf && !cloneForm.targetEmployeeId.trim()) {
      setBanner({ tone: 'error', message: '복제 대상 담당자를 선택해 주세요.' })
      return
    }

    setBusyAction('save-form')
    setBanner(null)

    try {
      const cloned = await parseJsonOrThrow<{
        id: string
        employeeId: string
        evalYear: number
      }>(
        await fetch(`/api/kpi/personal/${selectedKpi.id}/clone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetEmployeeId: cloneForm.assignToSelf ? undefined : cloneForm.targetEmployeeId,
            assignToSelf: cloneForm.assignToSelf,
            targetEvalYear,
            targetCycleId: cloneForm.targetCycleId || undefined,
            includeProgress: cloneForm.includeProgress,
            includeCheckins: cloneForm.includeCheckins,
          }),
        })
      )

      setCloneOpen(false)
      setCloneForm(buildCloneForm(props))
      setSelectedKpiId(cloned.id)
      setBanner({ tone: 'success', message: '개인 KPI 복제본을 생성했습니다.' })
      handleRouteSelection({
        year: String(cloned.evalYear),
        employeeId: cloned.employeeId,
        cycleId: cloneForm.targetCycleId || undefined,
        tab: 'mine',
        kpiId: cloned.id,
      })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '개인 KPI 복제에 실패했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDeleteKpi() {
    if (!selectedKpi) {
      setBanner({ tone: 'error', message: '삭제할 KPI를 먼저 선택해 주세요.' })
      setShowDeleteConfirm(false)
      return
    }

    if (deleteActionState.disabled) {
      setBanner({ tone: 'error', message: deleteActionState.reason ?? '현재 상태에서는 KPI를 삭제할 수 없습니다.' })
      setShowDeleteConfirm(false)
      return
    }

    setBusyAction('delete')
    setBanner(null)

    try {
      const deleted = await parseJsonOrThrow<{ id: string }>(
        await fetch(`/api/kpi/personal/${selectedKpi.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmDelete: true }),
        })
      )

      const nextItems = mineItems.filter((item) => item.id !== deleted.id)
      const nextSelectedId = resolveNextPersonalKpiSelectionAfterDelete({
        currentItems: mineItems,
        deletedId: deleted.id,
      })

      setMineItems(nextItems)
      setSelectedKpiId(nextSelectedId)
      setShowDeleteConfirm(false)
      setAiPreview(null)
      setSelectedAiRecommendationIndex(null)
      setPendingAiRecommendationIndex(null)
      setShowAiRecommendationSwitchConfirm(false)
      setBanner({ tone: 'success', message: '개인 KPI를 삭제했습니다.' })

      const query = buildSearch({
        year: String(props.selectedYear),
        employeeId: props.selectedEmployeeId,
        cycleId: props.selectedCycleId,
        tab: activeTab,
        kpiId: nextSelectedId || undefined,
      })

      router.replace(`/kpi/personal?${query}`, { scroll: false })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '개인 KPI 삭제에 실패했습니다.',
      })
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
      let riskHeaders: Record<string, string> = {}
      if (action === 'APPROVE') {
        const confirmed = await requestRiskConfirmation({
          actionName: 'APPROVE_RECORD',
          actionLabel: '개인 KPI 승인',
          targetLabel: selectedKpi?.title,
          detail: '현재 마스터 로그인 상태에서 개인 KPI를 승인합니다.',
          confirmationText: '승인',
        })
        if (confirmed === null) return
        riskHeaders = confirmed
      } else if (action === 'REJECT') {
        const confirmed = await requestRiskConfirmation({
          actionName: 'REJECT_RECORD',
          actionLabel: '개인 KPI 반려',
          targetLabel: selectedKpi?.title,
          detail: '현재 마스터 로그인 상태에서 개인 KPI를 반려합니다.',
          confirmationText: '반려',
        })
        if (confirmed === null) return
        riskHeaders = confirmed
      } else if (action === 'LOCK') {
        const confirmed = await requestRiskConfirmation({
          actionName: 'LOCK_RECORD',
          actionLabel: '개인 KPI 잠금',
          targetLabel: selectedKpi?.title,
          detail: '현재 마스터 로그인 상태에서 개인 KPI를 잠금 처리합니다.',
          confirmationText: '잠금',
        })
        if (confirmed === null) return
        riskHeaders = confirmed
      } else if (action === 'REOPEN') {
        const confirmed = await requestRiskConfirmation({
          actionName: 'REOPEN_RECORD',
          actionLabel: '개인 KPI 재개',
          targetLabel: selectedKpi?.title,
          detail: '현재 마스터 로그인 상태에서 개인 KPI를 다시 편집 가능한 상태로 되돌립니다.',
          confirmationText: '재개',
        })
        if (confirmed === null) return
        riskHeaders = confirmed
      }

      const response = await fetch(`/api/kpi/personal/${kpiId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...riskHeaders },
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
    const actionState = aiActionStates[action]
    if (actionState?.disabled) {
      setBanner({
        tone: 'info',
        message: actionState.reason || '현재 조건에서는 AI 보조를 실행할 수 없습니다.',
      })
      return
    }

    setBusyAction('ai')
    setBanner(null)
    setActiveTab('ai')

    if (!props.permissions.canUseAi) {
      setAiPreview(null)
      setSelectedAiRecommendationIndex(null)
      setPendingAiRecommendationIndex(null)
      setShowAiRecommendationSwitchConfirm(false)
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
          payload: buildAiPayload(props, selectedKpi, form, action, mineItems),
        }),
      })
      const data = await parseAiJsonOrThrow<{
        requestLogId: string
        source: 'ai' | 'fallback' | 'disabled'
        fallbackReason?: string | null
        result: Record<string, unknown>
      }>(response)

      setAiPreview({ ...data, action })
      setSelectedAiRecommendationIndex(
        action === 'generate-draft' && extractKpiAiPreviewRecommendations(data.result).length ? 0 : null
      )
      setPendingAiRecommendationIndex(null)
      setShowAiRecommendationSwitchConfirm(false)
      setApprovedAiRequestLogIds((current) =>
        current.filter((requestLogId) => requestLogId !== data.requestLogId)
      )
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
    return handleApplyAiPreview()
    /*

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

  async function handleApplyAiPreview() {
    if (!aiPreview) return
    setBusyAction('ai-decision')
    setBanner(null)

    try {
      if (aiPreview.action === 'generate-draft' && aiPreviewRecommendations.length) {
        const recommendationIndex = selectedAiRecommendationIndex ?? 0
        if (editorOpen && !areKpiFormsEqual(form, formBaseline)) {
          setPendingAiRecommendationIndex(recommendationIndex)
          setShowAiRecommendationSwitchConfirm(true)
          return
        }

        await ensureAiPreviewApproved()
        applyAiRecommendationToEditor(recommendationIndex)
      } else {
        await ensureAiPreviewApproved()

        if (aiPreview.action === 'generate-draft' || aiPreview.action === 'improve-wording') {
          openEditorWithForm(selectedKpi ? 'edit' : 'create', applyPreviewToForm(form, aiPreview.result))
        }

        setBanner({
          tone: 'success',
          message: 'AI 제안을 편집기에 반영했습니다. 저장 전에 내용을 확인해 주세요.',
        })
      }
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 제안을 적용하지 못했습니다.' })
    } finally {
      setBusyAction(null)
    }
    */
  }

  async function handleApplyAiPreview() {
    if (!aiPreview) return
    setBusyAction('ai-decision')
    setBanner(null)

    try {
      if (aiPreview.action === 'generate-draft' && aiPreviewRecommendations.length) {
        const recommendationIndex = selectedAiRecommendationIndex ?? 0
        if (editorOpen && !areKpiFormsEqual(form, formBaseline)) {
          setPendingAiRecommendationIndex(recommendationIndex)
          setShowAiRecommendationSwitchConfirm(true)
          return
        }

        await ensureAiPreviewApproved()
        applyAiRecommendationToEditor(recommendationIndex)
      } else {
        await ensureAiPreviewApproved()

        if (aiPreview.action === 'generate-draft' || aiPreview.action === 'improve-wording') {
          openEditorWithForm(selectedKpi ? 'edit' : 'create', applyPreviewToForm(form, aiPreview.result))
        }

        setBanner({
          tone: 'success',
          message: 'AI 제안을 편집기에 반영했습니다. 저장 전에 내용을 확인해 주세요.',
        })
      }
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : 'AI 제안을 적용하지 못했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSelectAiRecommendation(_recommendation: KpiAiPreviewRecommendation, index: number) {
    if (!aiPreview) return

    if (editorOpen && !areKpiFormsEqual(form, formBaseline)) {
      setPendingAiRecommendationIndex(index)
      setShowAiRecommendationSwitchConfirm(true)
      return
    }

    setBusyAction('ai-decision')
    setBanner(null)

    try {
      await ensureAiPreviewApproved()
      applyAiRecommendationToEditor(index)
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 초안을 적용하지 못했습니다.' })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleConfirmAiRecommendationSwitch() {
    if (pendingAiRecommendationIndex === null) {
      setShowAiRecommendationSwitchConfirm(false)
      return
    }

    setBusyAction('ai-decision')
    setBanner(null)

    try {
      await ensureAiPreviewApproved()
      applyAiRecommendationToEditor(pendingAiRecommendationIndex)
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 초안을 적용하지 못했습니다.' })
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
      setSelectedAiRecommendationIndex(null)
      setPendingAiRecommendationIndex(null)
      setShowAiRecommendationSwitchConfirm(false)
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
    if (!isDraftStatus(kpi.status)) {
      setBanner({ tone: 'info', message: '초안 상태 KPI만 수정할 수 있습니다.' })
      return
    }
    setSelectedKpiId(kpi.id)
    openEditorWithForm('edit', buildFormFromKpi(kpi))
    setAiPreview(null)
    setSelectedAiRecommendationIndex(null)
    setPendingAiRecommendationIndex(null)
    setShowAiRecommendationSwitchConfirm(false)
  }

  function updateSelectedEvidenceDraft(patch: Partial<EvidenceDraft>) {
    if (!selectedKpi || !selectedEvidenceDraft) return

    setEvidenceDrafts((current) => ({
      ...current,
      [selectedKpi.id]: {
        ...selectedEvidenceDraft,
        ...patch,
      },
    }))
  }

  function syncEvidenceDraftLocally(kpiId: string, draft: EvidenceDraft, recordId?: string) {
    const nextDraft = {
      ...draft,
      recordId: recordId ?? draft.recordId,
    }

    setEvidenceDrafts((current) => ({
      ...current,
      [kpiId]: nextDraft,
    }))

    setMineItems((current) =>
      current.map((item) =>
        item.id === kpiId
          ? {
              ...item,
              evidenceRecord: {
                recordId: nextDraft.recordId,
                yearMonth: nextDraft.yearMonth,
                evidenceComment: nextDraft.evidenceComment.trim() || undefined,
                attachments: nextDraft.attachments,
              },
              recentMonthlyRecords: item.recentMonthlyRecords.map((record) =>
                record.month === nextDraft.yearMonth
                  ? {
                      ...record,
                      evidenceComment: nextDraft.evidenceComment.trim() || null,
                    }
                  : record
              ),
            }
          : item
      )
    )
  }

  async function handleEvidenceFileUpload(fileList: FileList | null) {
    if (!fileList) return
    if (!selectedKpi || !canEditSelectedEvidence || !selectedEvidenceDraft) {
      setBanner({
        tone: 'info',
        message: selectedEvidenceEditReason ?? '현재 상태에서는 증빙 자료를 추가할 수 없습니다.',
      })
      return
    }

    setBusyAction('evidence-upload')
    setBanner(null)

    try {
      const attachments = await readEvidenceFiles(fileList, props.actor.name)
      updateSelectedEvidenceDraft({
        attachments: [...selectedEvidenceDraft.attachments, ...attachments],
      })
      setBanner({
        tone: 'success',
        message: `${attachments.length}개의 파일 증빙을 추가했습니다. 저장 후 반영됩니다.`,
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '증빙 파일을 불러오지 못했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  function handleAddEvidenceLink() {
    if (!selectedKpi || !selectedEvidenceDraft) return
    if (!canEditSelectedEvidence) {
      setBanner({
        tone: 'info',
        message: selectedEvidenceEditReason ?? '현재 상태에서는 링크 증빙을 추가할 수 없습니다.',
      })
      return
    }

    const trimmedUrl = selectedEvidenceDraft.linkUrlInput.trim()
    if (!trimmedUrl) {
      setBanner({ tone: 'info', message: 'Google Drive 링크를 입력해 주세요.' })
      return
    }

    if (!isAllowedMonthlyEvidenceUrl(trimmedUrl)) {
      setBanner({
        tone: 'info',
        message: 'drive.google.com 또는 docs.google.com 링크만 등록할 수 있습니다.',
      })
      return
    }

    const attachment = createEvidenceLinkAttachment({
      url: trimmedUrl,
      comment: selectedEvidenceDraft.linkCommentInput,
      uploaderName: props.actor.name,
    })

    updateSelectedEvidenceDraft({
      attachments: [...selectedEvidenceDraft.attachments, attachment],
      linkUrlInput: '',
      linkCommentInput: '',
    })
    setBanner({ tone: 'success', message: 'Google Drive 링크 증빙을 추가했습니다. 저장 후 반영됩니다.' })
  }

  async function handleSaveEvidence() {
    if (!selectedKpi || !selectedEvidenceDraft) return
    if (!canEditSelectedEvidence) {
      setBanner({
        tone: 'info',
        message: selectedEvidenceEditReason ?? '현재 상태에서는 증빙을 저장할 수 없습니다.',
      })
      return
    }

    setBusyAction('evidence-save')
    setBanner(null)

    try {
      const saved = await parseJsonOrThrow<{ id: string }>(
        await fetch('/api/kpi/monthly-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalKpiId: selectedKpi.id,
            yearMonth: selectedEvidenceDraft.yearMonth,
            evidenceComment: selectedEvidenceDraft.evidenceComment.trim() || undefined,
            attachments: selectedEvidenceDraft.attachments,
            isDraft: true,
          }),
        })
      )

      syncEvidenceDraftLocally(selectedKpi.id, selectedEvidenceDraft, saved.id)
      setBanner({ tone: 'success', message: '증빙 자료를 저장했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '증빙 자료를 저장하지 못했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRunMidcheckCoach() {
    if (!selectedKpi || !selectedEvidenceDraft) {
      setBanner({ tone: 'info', message: 'AI 코칭을 받을 KPI를 먼저 선택해 주세요.' })
      return
    }

    setBusyAction('midcheck-coach')
    setBanner(null)
    setMidcheckCoachErrors((current) => ({
      ...current,
      [selectedKpi.id]: null,
    }))

    try {
      const data = await parseJsonOrThrow<MidcheckCoachPreview>(
        await fetch(`/api/kpi/personal/${selectedKpi.id}/midcheck-coach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yearMonth: selectedEvidenceDraft.yearMonth,
            evidenceComment: selectedEvidenceDraft.evidenceComment,
            attachments: selectedEvidenceDraft.attachments,
          }),
        })
      )

      setMidcheckCoachPreviews((current) => ({
        ...current,
        [selectedKpi.id]: data,
      }))
      setBanner({
        tone: data.source === 'ai' ? 'success' : 'info',
        message:
          data.source === 'ai'
            ? 'AI 코칭 결과를 불러왔습니다.'
            : data.fallbackReason || '입력된 정보가 충분하지 않아 일반적인 가이드 중심으로 제안했습니다.',
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'AI 코칭을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      setMidcheckCoachErrors((current) => ({
        ...current,
        [selectedKpi.id]: message,
      }))
      setBanner({ tone: 'error', message })
    } finally {
      setBusyAction(null)
    }
  }

  function handleApplyCoachDraft() {
    if (!selectedKpi || !selectedEvidenceDraft || !selectedMidcheckCoachPreview) return

    updateSelectedEvidenceDraft({
      evidenceComment: appendCoachDraft(
        selectedEvidenceDraft.evidenceComment,
        selectedMidcheckCoachPreview.result.employee_update_draft
      ),
    })
    setBanner({
      tone: 'success',
      message: 'AI 업데이트 문안을 증빙 코멘트에 안전하게 추가했습니다. 저장 후 반영됩니다.',
    })
  }

  async function handleCopyManagerShareDraft() {
    if (!selectedMidcheckCoachPreview || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setBanner({ tone: 'error', message: '현재 환경에서는 복사를 지원하지 않습니다.' })
      return
    }

    try {
      await navigator.clipboard.writeText(selectedMidcheckCoachPreview.result.manager_share_draft)
      setBanner({ tone: 'success', message: '관리자 공유용 문안을 복사했습니다.' })
    } catch {
      setBanner({ tone: 'error', message: '관리자 공유용 문안을 복사하지 못했습니다. 다시 시도해 주세요.' })
    }
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
        summary={derivedSummary}
        rejectedCount={derivedSummary.rejectedCount}
        submitState={submitCtaState}
        submitLabel={submitLabel}
        createDisabledReason={createDisabledReason}
        bulkEditDisabledReason={bulkEditDisabledReason}
        aiDisabledReason={aiDisabledReason}
        reviewDisabledReason={reviewDisabledReason}
        historyDisabledReason={historyDisabledReason}
        onChangeYear={(year) => handleRouteSelection({ year, tab: 'mine', kpiId: '' })}
        onChangeCycle={(cycleId) => handleRouteSelection({ cycleId, tab: 'mine', kpiId: '' })}
        onChangeEmployee={(employeeId) => handleRouteSelection({ employeeId, tab: 'mine', kpiId: '' })}
        onOpenCreate={handleOpenCreate}
        onOpenBulkEdit={handleOpenBulkEdit}
        onOpenAiDraft={handleOpenAiDraft}
        onOpenHistory={handleOpenHistory}
        onOpenReview={handleOpenReview}
        onSubmit={handleSubmitSelected}
      />

      {props.alerts?.length ? <LoadAlerts alerts={props.alerts} /> : null}
      {banner ? <BannerMessage tone={banner.tone} message={banner.message} /> : null}

      {props.state === 'ready' ? (
        <>
          <SummaryCards summary={derivedSummary} />
          <Tabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === 'mine' ? (
            <MineSection
              items={mineItems}
              selectedId={selectedKpiId}
              onSelect={handleSelectKpi}
              onEdit={handleEditKpi}
              onClone={handleOpenClone}
              onDelete={() => setShowDeleteConfirm(true)}
              selectedKpi={selectedKpi}
              canEdit={canEditSelectedKpi}
              editDisabledReason={selectedKpiEditReason}
              cloneDisabledReason={cloneDisabledReason}
              deleteActionState={deleteActionState}
              detailChildren={
                <>
                  <PersonalKpiEvidencePanel
                    selectedKpi={selectedKpi}
                    draft={selectedEvidenceDraft}
                    canEdit={canEditSelectedEvidence}
                    editDisabledReason={selectedEvidenceEditReason}
                    busy={busyAction === 'evidence-save' || busyAction === 'evidence-upload'}
                    onDraftChange={updateSelectedEvidenceDraft}
                    onUploadFiles={handleEvidenceFileUpload}
                    onAddLink={handleAddEvidenceLink}
                    onRemoveAttachment={(attachmentId) =>
                      updateSelectedEvidenceDraft({
                        attachments: (selectedEvidenceDraft?.attachments ?? []).filter((item) => item.id !== attachmentId),
                      })
                    }
                    onSave={handleSaveEvidence}
                    onDownload={(attachment) =>
                      downloadEvidenceAttachment(attachment, (message) => setBanner({ tone: 'info', message }))
                    }
                    onOpenLink={openEvidenceLink}
                  />
                  <PersonalKpiMidcheckCoachCard
                    selectedKpi={selectedKpi}
                    draft={selectedEvidenceDraft}
                    preview={selectedMidcheckCoachPreview}
                    errorMessage={selectedMidcheckCoachError}
                    busy={busyAction === 'midcheck-coach'}
                    canRun={Boolean(selectedKpi)}
                    onRun={handleRunMidcheckCoach}
                    onApplyDraft={handleApplyCoachDraft}
                    onCopyManagerShare={handleCopyManagerShareDraft}
                  />
                </>
              }
            />
          ) : null}
          {activeTab === 'review' ? (
            <GoalReviewQueueSection
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
              previewComparisons={buildPersonalAiPreviewComparisons({ preview: aiPreview, selectedKpi, form })}
              logs={props.aiLogs}
              actionStates={aiActionStates}
              onRun={handleRunAi}
              onApprove={handleApproveAiPreview}
              onReject={handleRejectAiPreview}
              onSelectRecommendation={handleSelectAiRecommendation}
              selectedRecommendationIndex={selectedAiRecommendationIndex}
              isRecommendationDraftOpen={editorOpen}
              decisionBusy={busyAction === 'ai-decision'}
            />
          ) : null}
        </>
      ) : (
        <>
          <StatePanel state={props.state} message={props.message} />
          <Tabs activeTab={activeTab} onChange={setActiveTab} />
          {activeTab === 'review' ? (
            <GoalReviewQueueSection
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
              previewComparisons={buildPersonalAiPreviewComparisons({ preview: aiPreview, selectedKpi, form })}
              logs={props.aiLogs}
              actionStates={aiActionStates}
              onRun={handleRunAi}
              onApprove={handleApproveAiPreview}
              onReject={handleRejectAiPreview}
              onSelectRecommendation={handleSelectAiRecommendation}
              selectedRecommendationIndex={selectedAiRecommendationIndex}
              isRecommendationDraftOpen={editorOpen}
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
      {cloneOpen ? (
        <CloneKpiModal
          form={cloneForm}
          employeeOptions={props.employeeOptions}
          cycleOptions={props.cycleOptions}
          actorName={props.actor.name}
          busy={busyAction === 'save-form'}
          onChange={setCloneForm}
          onClose={() => setCloneOpen(false)}
          onSubmit={handleCloneKpi}
        />
      ) : null}
      {bulkEditOpen ? (
        <BulkEditPersonalKpiModal
          targetCount={bulkTargetIds.length}
          form={bulkEditForm}
          employeeOptions={props.employeeOptions}
          orgKpiOptions={props.orgKpiOptions}
          busy={busyAction === 'bulk-edit'}
          onChange={setBulkEditForm}
          onClose={() => setBulkEditOpen(false)}
          onSubmit={handleSaveBulkEdit}
        />
      ) : null}
      {showDeleteConfirm ? (
        <DeletePersonalKpiDialog
          kpi={selectedKpi}
          busy={busyAction === 'delete'}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteKpi}
        />
      ) : null}
      {showAiRecommendationSwitchConfirm ? (
        <AiRecommendationSwitchDialog
          busy={busyAction === 'ai-decision'}
          onClose={() => {
            setPendingAiRecommendationIndex(null)
            setShowAiRecommendationSwitchConfirm(false)
          }}
          onConfirm={handleConfirmAiRecommendationSwitch}
        />
      ) : null}
      {riskDialog}
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
  rejectedCount: number
  submitState: PersonalKpiSubmitCtaState
  submitLabel: string
  createDisabledReason?: string
  bulkEditDisabledReason?: string
  aiDisabledReason?: string
  reviewDisabledReason?: string
  historyDisabledReason?: string
  onChangeYear: (year: string) => void
  onChangeCycle: (cycleId: string) => void
  onChangeEmployee: (employeeId: string) => void
  onOpenCreate: () => void
  onOpenBulkEdit: () => void
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
            <MetricCard label="전체 개인 KPI" value={formatCountWithUnit(props.summary.totalCount, '개')} helper="현재 선택 조건에 포함된 개인 KPI 수" />
            <MetricCard label="총 가중치" value={`${props.summary.totalWeight}%`} helper="현재 개인 KPI 가중치 합계" />
            <MetricCard label="남은 가중치" value={`${props.summary.remainingWeight}%`} helper="100% 대비 추가 배분 가능한 가중치" />
            <MetricCard
              label="조직 KPI 연결 비율"
              value={
                props.summary.totalCount > 0
                  ? `${Math.round((props.summary.linkedOrgKpiCount / props.summary.totalCount) * 100)}%`
                  : '0%'
              }
              helper={formatRateBaseCopy('전체 개인 KPI')}
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
            icon={<ClipboardList className="h-4 w-4" />}
            variant="secondary"
            onClick={props.onOpenBulkEdit}
            disabled={Boolean(props.bulkEditDisabledReason)}
            title={props.bulkEditDisabledReason}
          >
            목표 일괄 수정
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
            label={props.submitLabel}
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
          {props.rejectedCount > 0 ? (
            <p
              data-testid="personal-kpi-rejected-count"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"
            >
              반려된 목표 {props.rejectedCount}개를 수정했다면 바로 승인 요청을 다시 보낼 수 있습니다.
            </p>
          ) : null}
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
      <MetricCard
        label="조직 KPI에 연결된 개인 KPI"
        value={formatCountWithUnit(props.summary.linkedOrgKpiCount, '건')}
        helper="조직 KPI와 연결된 개인 KPI 건수"
      />
      <MetricCard label="검토 대기 KPI" value={formatCountWithUnit(props.summary.reviewPendingCount, '개')} helper="현재 검토 대기 상태의 개인 KPI 수" />
      <MetricCard label="반려 KPI" value={formatCountWithUnit(props.summary.rejectedCount, '개')} helper="보완 후 다시 제출이 필요한 개인 KPI 수" />
      <MetricCard
        label="최근 월간 실적 반영 비율"
        value={`${props.summary.monthlyCoverageRate}%`}
        helper={formatRateBaseCopy('전체 개인 KPI')}
      />
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
  onClone: () => void
  onDelete: () => void
  selectedKpi?: PersonalKpiViewModel
  canEdit: boolean
  editDisabledReason?: string
  cloneDisabledReason?: string
  deleteActionState: ReturnType<typeof getPersonalKpiDeleteActionState>
  detailChildren?: ReactNode
}) {
  if (!props.items.length) {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <EmptyState
          title="아직 작성된 KPI가 없습니다."
          description="상단의 KPI 추가 버튼으로 첫 개인 KPI를 작성해보세요."
        />
        <div className="space-y-6">
          <GoalDetailPanel
            selectedKpi={props.selectedKpi}
            canEdit={props.canEdit}
            editDisabledReason={props.editDisabledReason}
            onEdit={props.onEdit}
            canClone={!props.cloneDisabledReason}
            cloneDisabledReason={props.cloneDisabledReason}
            onClone={props.onClone}
            onDelete={props.onDelete}
            deleteActionState={props.deleteActionState}
          />
          {props.detailChildren}
        </div>
      </div>
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
                  {item.tags.length ? (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <InfoPill key={tag}>{tag}</InfoPill>
                      ))}
                    </div>
                  ) : null}
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

      <div className="space-y-6">
        <GoalDetailPanel
          selectedKpi={props.selectedKpi}
          canEdit={props.canEdit}
          editDisabledReason={props.editDisabledReason}
          onEdit={props.onEdit}
          canClone={!props.cloneDisabledReason}
          cloneDisabledReason={props.cloneDisabledReason}
          onClone={props.onClone}
          onDelete={props.onDelete}
          deleteActionState={props.deleteActionState}
        />
        {props.detailChildren}
      </div>
    </div>
  )
}

function DetailPanel(props: {
  selectedKpi?: PersonalKpiViewModel
  canEdit: boolean
  editDisabledReason?: string
  onEdit: (kpi: PersonalKpiViewModel) => void
  canClone: boolean
  cloneDisabledReason?: string
  onClone: () => void
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
            ) : props.editDisabledReason ? (
              <InfoPill>{props.editDisabledReason}</InfoPill>
            ) : null}
            <ActionButton
              icon={<Copy className="h-4 w-4" />}
              variant="secondary"
              onClick={props.onClone}
              disabled={!props.canClone}
              title={props.cloneDisabledReason}
            >
              복제
            </ActionButton>
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

        {item.tags.length ? (
          <Block title="목표 태그">
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          </Block>
        ) : null}

        {item.orgLineage.length ? (
          <Block title="목표 정렬 경로">
            <div className="flex flex-wrap gap-2">
              {item.orgLineage.map((segment) => (
                <span key={segment.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {joinInlineParts([segment.departmentName, segment.title])}
                </span>
              ))}
            </div>
          </Block>
        ) : null}

        <Block title="정의">{item.definition || '정의가 아직 작성되지 않았습니다.'}</Block>
        <Block title="산식">{item.formula || '산식이 아직 작성되지 않았습니다.'}</Block>
        <Block title="검토 코멘트">{item.reviewComment || '검토 코멘트가 아직 없습니다.'}</Block>

        {item.cloneInfo ? (
          <Block title="복제 정보">
            {`${item.cloneInfo.sourceOwnerName ?? '원본'}의 "${item.cloneInfo.sourceTitle}"에서 복제되었습니다. 진행 snapshot ${item.cloneInfo.progressEntryCount}건, 체크인 snapshot ${item.cloneInfo.checkinEntryCount}건을 이관했습니다.`}
          </Block>
        ) : null}

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
  const startReviewState = selectedItem ? getReviewActionState(selectedItem.status, 'START_REVIEW') : { disabled: true }
  const approveState = selectedItem ? getReviewActionState(selectedItem.status, 'APPROVE') : { disabled: true }
  const rejectState = selectedItem ? getReviewActionState(selectedItem.status, 'REJECT') : { disabled: true }

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
            {selectedItem.tags.length ? (
              <Block title="목표 태그">
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </Block>
            ) : null}
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
              <ActionButton variant="secondary" disabled={!props.canReview || props.busy || startReviewState.disabled} title={startReviewState.reason} onClick={() => props.onAction(selectedItem.id, 'START_REVIEW')}>
                검토 시작
              </ActionButton>
              <ActionButton disabled={!props.canReview || props.busy || approveState.disabled} title={approveState.reason} onClick={() => props.onAction(selectedItem.id, 'APPROVE')}>
                승인
              </ActionButton>
              <ActionButton variant="secondary" disabled={!props.canReview || props.busy || rejectState.disabled} title={rejectState.reason} onClick={() => props.onAction(selectedItem.id, 'REJECT')}>
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

void DetailPanel
void ReviewQueueSection

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
  actionStates: Record<AiAction, AiActionState>
  busy: boolean
  preview: AiPreview | null
  previewComparisons: KpiAiPreviewComparison[]
  logs: PersonalKpiAiLogItem[]
  decisionBusy: boolean
  onRun: (action: AiAction) => void
  onApprove: () => void
  onReject: () => void
  onSelectRecommendation: (item: KpiAiPreviewRecommendation, index: number) => void
  selectedRecommendationIndex: number | null
  isRecommendationDraftOpen: boolean
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
                disabled={props.busy || props.actionStates[item.action]?.disabled}
                title={props.actionStates[item.action]?.reason}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Bot className="h-4 w-4 text-slate-500" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                {props.actionStates[item.action]?.reason ? (
                  <p className="mt-2 text-xs text-slate-500">{props.actionStates[item.action]?.reason}</p>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="AI 미리보기" description="제안을 바로 적용하지 않고, 검토 후 반영 여부를 결정합니다.">
        {props.preview ? (
          <>
          <KpiAiPreviewPanel
            preview={{
              action: props.preview.action,
              actionLabel: props.actions.find((item) => item.action === props.preview!.action)?.title ?? props.preview!.action,
              source: props.preview.source,
              fallbackReason: props.preview.fallbackReason,
              result: props.preview.result,
            }}
            comparisons={props.previewComparisons}
            emptyTitle="AI 제안이 아직 없습니다."
            emptyDescription="왼쪽에서 AI 기능을 실행하면 이 영역에 preview가 표시됩니다."
            onApprove={props.onApprove}
            onReject={props.onReject}
            approveLabel="선택한 초안 적용"
            rejectLabel="제안 반려"
            onRetry={props.preview.action === 'generate-draft' ? () => props.onRun('generate-draft') : undefined}
            retryLabel={props.preview.action === 'generate-draft' ? '다른 관점으로 다시 생성' : '다시 시도'}
            decisionBusy={props.decisionBusy}
            onSelectRecommendation={props.preview.action === 'generate-draft' ? props.onSelectRecommendation : undefined}
            selectedRecommendationIndex={props.selectedRecommendationIndex}
            recommendationActionLabel="이 초안 적용"
            isRecommendationDraftOpen={props.isRecommendationDraftOpen}
          />
          {props.preview ? <div className="hidden space-y-4">
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
          </div> : null}
          </>
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

function CloneKpiModal(props: {
  form: PersonalCloneForm
  employeeOptions: Props['employeeOptions']
  cycleOptions: Props['cycleOptions']
  actorName: string
  busy: boolean
  onChange: (next: PersonalCloneForm | ((current: PersonalCloneForm) => PersonalCloneForm)) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">KPI 복제</h2>
            <p className="mt-1 text-sm text-slate-500">
              목표 진행 snapshot과 체크인 기록을 선택적으로 이관해 다음 주기 운영을 바로 이어갈 수 있습니다.
            </p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">대상 연도</span>
              <input
                type="number"
                value={props.form.targetEvalYear}
                onChange={(event) => props.onChange((current) => ({ ...current, targetEvalYear: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">대상 주기</span>
              <select
                value={props.form.targetCycleId}
                onChange={(event) => props.onChange((current) => ({ ...current, targetCycleId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">주기 미지정</option>
                {props.cycleOptions.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.year} · {cycle.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.form.assignToSelf}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  assignToSelf: event.target.checked,
                  targetEmployeeId: event.target.checked ? current.targetEmployeeId : current.targetEmployeeId,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            <span>
              <span className="block font-semibold text-slate-900">복제 후 담당자를 나 자신으로 설정</span>
              <span className="mt-1 block text-slate-500">{props.actorName} 계정으로 바로 이어서 작성할 수 있습니다.</span>
            </span>
          </label>

          {!props.form.assignToSelf ? (
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">대상 담당자</span>
              <select
                value={props.form.targetEmployeeId}
                onChange={(event) => props.onChange((current) => ({ ...current, targetEmployeeId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                {props.employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.departmentName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={props.form.includeProgress}
                onChange={(event) => props.onChange((current) => ({ ...current, includeProgress: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block font-semibold text-slate-900">진척도 snapshot 포함</span>
                <span className="mt-1 block text-slate-500">최근 월간 실적 기반 진척 메모를 복제 metadata로 이관합니다.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={props.form.includeCheckins}
                onChange={(event) => props.onChange((current) => ({ ...current, includeCheckins: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block font-semibold text-slate-900">체크인 이력 snapshot 포함</span>
                <span className="mt-1 block text-slate-500">연결된 체크인 요약을 carry-over metadata로 남깁니다.</span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton variant="secondary" onClick={props.onClose}>
              취소
            </ActionButton>
            <ActionButton onClick={props.onSubmit} disabled={props.busy}>
              {props.busy ? '복제 중...' : '복제 실행'}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
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

function WeightApprovalSummaryCard(props: {
  approval: WeightApprovalView
  weight?: number
  orgLineage?: PersonalKpiViewModel['orgLineage']
  compact?: boolean
}) {
  const historyStatusLabel = (status: WeightApprovalView['history'][number]['status']) => {
    switch (status) {
      case 'REQUESTED':
        return '승인 요청'
      case 'APPROVED':
        return '승인 완료'
      case 'REJECTED':
        return '반려'
      default:
        return status
    }
  }

  const toneClass =
    props.approval.status === 'APPROVED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.approval.status === 'REJECTED'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : props.approval.status === 'PENDING'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <Block title="가중치 승인">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{props.approval.label}</span>
          <span className="text-xs text-slate-500">
            {typeof props.weight === 'number' ? `현재 가중치 ${props.weight}%` : '가중치 미설정'}
          </span>
          {props.approval.reviewerName ? (
            <span className="text-xs text-slate-500">검토자 {props.approval.reviewerName}</span>
          ) : null}
        </div>

        {props.orgLineage?.length ? (
          <div className="flex flex-wrap gap-2">
            {props.orgLineage.map((segment) => (
              <span key={segment.id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {joinInlineParts([segment.departmentName, segment.title])}
              </span>
            ))}
          </div>
        ) : null}

        {props.approval.reviewNote ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
            {props.approval.reviewNote}
          </div>
        ) : (
          <EmptyInline text="승인 메모가 아직 없습니다." />
        )}

        {props.approval.history.length ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">승인 이력</div>
            {props.approval.history.slice(0, props.compact ? 2 : 4).map((history) => (
              <div key={history.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{historyStatusLabel(history.status)}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(history.at)}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {joinInlineParts([history.actor, history.note])}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Block>
  )
}

function PersonalKpiEvidencePanel(props: {
  selectedKpi?: PersonalKpiViewModel
  draft: EvidenceDraft | null
  canEdit: boolean
  editDisabledReason?: string
  busy: boolean
  onDraftChange: (patch: Partial<EvidenceDraft>) => void
  onUploadFiles: (fileList: FileList | null) => void
  onAddLink: () => void
  onRemoveAttachment: (attachmentId: string) => void
  onSave: () => void
  onDownload: (attachment: MonthlyAttachmentItem) => void
  onOpenLink: (url: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!props.selectedKpi || !props.draft) {
    return (
      <SectionCard
        title="증빙 자료"
        description="파일, Google Drive 링크, 짧은 코멘트를 함께 관리할 수 있습니다."
      >
        <EmptyInline text="KPI를 선택하면 증빙 자료를 바로 정리할 수 있습니다." />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="증빙 자료"
      description="기존 파일 업로드를 유지하면서 Google Drive 링크와 짧은 코멘트를 함께 관리할 수 있습니다."
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          void props.onUploadFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <InfoPill>{`기준 월 ${props.draft.yearMonth}`}</InfoPill>
            {props.draft.attachments.length ? <InfoPill>{`증빙 ${props.draft.attachments.length}건`}</InfoPill> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={<FilePlus2 className="h-4 w-4" />}
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={!props.canEdit || props.busy}
              title={props.editDisabledReason}
            >
              파일 첨부
            </ActionButton>
            <ActionButton
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={props.onSave}
              disabled={!props.canEdit || props.busy}
              title={props.editDisabledReason}
            >
              {props.busy ? '증빙 저장 중...' : '증빙 저장'}
            </ActionButton>
          </div>
        </div>

        {props.editDisabledReason && !props.canEdit ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {props.editDisabledReason}
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">증빙 코멘트</span>
          <textarea
            value={props.draft.evidenceComment}
            onChange={(event) => props.onDraftChange({ evidenceComment: event.target.value })}
            disabled={!props.canEdit}
            rows={4}
            maxLength={1000}
            placeholder="이번 점검에서 함께 볼 증빙 설명을 간단히 적어 주세요."
            className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </label>

        <div className="grid gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.3fr_1fr_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-600">Google Drive 링크</span>
            <input
              value={props.draft.linkUrlInput}
              onChange={(event) => props.onDraftChange({ linkUrlInput: event.target.value })}
              disabled={!props.canEdit}
              placeholder="https://drive.google.com/... 또는 https://docs.google.com/..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold text-slate-600">짧은 설명</span>
            <input
              value={props.draft.linkCommentInput}
              onChange={(event) => props.onDraftChange({ linkCommentInput: event.target.value })}
              disabled={!props.canEdit}
              maxLength={300}
              placeholder="링크 증빙 설명을 간단히 적어 주세요."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
            />
          </label>
          <div className="flex items-end">
            <ActionButton
              icon={<Link2 className="h-4 w-4" />}
              variant="secondary"
              onClick={props.onAddLink}
              disabled={!props.canEdit || props.busy}
              title={props.editDisabledReason}
            >
              링크 추가
            </ActionButton>
          </div>
        </div>

        {props.draft.attachments.length ? (
          <div className="space-y-3">
            {props.draft.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <InfoPill>{attachment.type === 'LINK' ? '링크' : '파일'}</InfoPill>
                      <span className="text-sm font-semibold text-slate-900">{attachment.name}</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <p className="break-all">
                        {attachment.type === 'LINK' ? attachment.url ?? '-' : attachment.sizeLabel ?? '-'}
                      </p>
                      <p>{joinInlineParts([attachment.uploadedBy, attachment.uploadedAt ? formatDateTime(attachment.uploadedAt) : undefined])}</p>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold text-slate-600">증빙 설명</span>
                      <input
                        value={attachment.comment ?? ''}
                        onChange={(event) =>
                          props.onDraftChange({
                            attachments: props.draft!.attachments.map((item) =>
                              item.id === attachment.id ? { ...item, comment: event.target.value } : item
                            ),
                          })
                        }
                        disabled={!props.canEdit}
                        maxLength={300}
                        placeholder="증빙 설명을 간단히 남겨 주세요."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {attachment.type === 'LINK' ? (
                      <ActionButton
                        icon={<Link2 className="h-4 w-4" />}
                        variant="secondary"
                        onClick={() => attachment.url && props.onOpenLink(attachment.url)}
                      >
                        열기
                      </ActionButton>
                    ) : (
                      <ActionButton
                        icon={<FileDown className="h-4 w-4" />}
                        variant="secondary"
                        onClick={() => props.onDownload(attachment)}
                      >
                        다운로드
                      </ActionButton>
                    )}
                    <ActionButton
                      icon={<Trash2 className="h-4 w-4" />}
                      variant="secondary"
                      onClick={() => props.onRemoveAttachment(attachment.id)}
                      disabled={!props.canEdit}
                    >
                      제거
                    </ActionButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyInline text="등록된 증빙 자료가 없습니다. 파일 또는 Google Drive 링크를 추가해 주세요." />
        )}
      </div>
    </SectionCard>
  )
}

function PersonalKpiMidcheckCoachCard(props: {
  selectedKpi?: PersonalKpiViewModel
  draft: EvidenceDraft | null
  preview: MidcheckCoachPreview | null
  errorMessage?: string | null
  busy: boolean
  canRun: boolean
  onRun: () => void
  onApplyDraft: () => void
  onCopyManagerShare: () => void
}) {
  if (!props.selectedKpi || !props.draft) {
    return (
      <SectionCard
        title="AI 중간 점검 코치"
        description="현재 입력된 KPI/진행 현황/증빙 정보를 바탕으로 보완 포인트와 다음 액션을 제안합니다."
      >
        <EmptyInline text="KPI를 선택하면 AI 중간 점검 코치를 바로 사용할 수 있습니다." />
      </SectionCard>
    )
  }

  const preview = props.preview
  const evidenceNeedsMore =
    preview?.result.status === 'insufficient_data' ||
    (preview ? preview.result.evidence_feedback.sufficiency !== 'sufficient' : false)

  return (
    <SectionCard
      title="AI 중간 점검 코치"
      description="현재 입력된 KPI/진행 현황/증빙 정보를 바탕으로 보완 포인트와 다음 액션을 제안합니다."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <InfoPill>{`기준 월 ${props.draft.yearMonth}`}</InfoPill>
            {preview ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MIDCHECK_STATUS_CLASS[preview.result.status]}`}>
                {MIDCHECK_STATUS_LABELS[preview.result.status]}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={<Bot className="h-4 w-4" />}
              onClick={props.onRun}
              disabled={!props.canRun || props.busy}
            >
              {props.busy ? 'AI 코칭 생성 중...' : preview ? '다시 생성' : 'AI 코칭 받기'}
            </ActionButton>
            {preview ? (
              <>
                <ActionButton
                  icon={<Sparkles className="h-4 w-4" />}
                  variant="secondary"
                  onClick={props.onApplyDraft}
                >
                  업데이트 문안 반영
                </ActionButton>
                <ActionButton
                  icon={<Copy className="h-4 w-4" />}
                  variant="secondary"
                  onClick={props.onCopyManagerShare}
                >
                  관리자 공유용 문안 복사
                </ActionButton>
              </>
            ) : null}
          </div>
        </div>

        {props.errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {props.errorMessage || 'AI 코칭을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
          </div>
        ) : null}

        {props.busy ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            현재 입력된 정보로 AI 코칭을 준비하고 있습니다.
          </div>
        ) : !preview ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            아직 생성된 코칭 결과가 없습니다. 현재 입력된 KPI와 증빙 정보를 기준으로 중간 점검 코칭을 받아 보세요.
          </div>
        ) : (
          <div className="space-y-4">
            {preview.source !== 'ai' || evidenceNeedsMore ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {preview.source !== 'ai'
                  ? preview.fallbackReason || '입력된 정보가 충분하지 않아 일반적인 가이드 중심으로 제안했습니다.'
                  : '증빙 자료가 부족하여 보완이 필요한 항목 위주로 안내합니다.'}
              </div>
            ) : null}

            <Block title="한줄 진단">
              <div className="space-y-2">
                <p className="font-semibold text-slate-900">{preview.result.headline}</p>
                <p>{preview.result.summary}</p>
              </div>
            </Block>

            {preview.result.strengths.length ? (
              <Block title="현재 강점">
                <ul className="space-y-2">
                  {preview.result.strengths.map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </Block>
            ) : null}

            {preview.result.gaps.length ? (
              <Block title="보완 필요 사항">
                <ul className="space-y-2">
                  {preview.result.gaps.map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </Block>
            ) : null}

            {preview.result.risk_signals.length ? (
              <Block title="리스크 신호">
                <ul className="space-y-2">
                  {preview.result.risk_signals.map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </Block>
            ) : null}

            {preview.result.next_actions.length ? (
              <Block title="다음 액션">
                <div className="space-y-3">
                  {preview.result.next_actions.map((action, index) => (
                    <div key={`${action.title}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{action.title}</span>
                        <InfoPill>{`우선순위 ${MIDCHECK_PRIORITY_LABELS[action.priority]}`}</InfoPill>
                        {action.due_hint ? <InfoPill>{action.due_hint}</InfoPill> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{action.reason}</p>
                    </div>
                  ))}
                </div>
              </Block>
            ) : null}

            {preview.result.coaching_questions.length ? (
              <Block title="점검 질문">
                <ul className="space-y-2">
                  {preview.result.coaching_questions.map((item, index) => (
                    <li key={`${item}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </Block>
            ) : null}

            <Block title="업데이트 문안 초안">{preview.result.employee_update_draft}</Block>
            <Block title="관리자 공유용 문안">{preview.result.manager_share_draft}</Block>

            <Block title="증빙 피드백">
              <div className="space-y-3">
                <Field
                  label="충분도"
                  value={
                    preview.result.evidence_feedback.sufficiency === 'sufficient'
                      ? '충분'
                      : preview.result.evidence_feedback.sufficiency === 'partial'
                        ? '부분 충족'
                        : '부족'
                  }
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">사용한 증빙</div>
                    {preview.result.evidence_feedback.cited_evidence.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {preview.result.evidence_feedback.cited_evidence.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">직접 인용할 증빙이 부족합니다.</p>
                    )}
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">추가로 필요한 항목</div>
                    {preview.result.evidence_feedback.missing_items.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {preview.result.evidence_feedback.missing_items.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">추가 보완 항목이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </Block>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {preview.result.disclaimer}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function GoalDetailPanel(props: {
  selectedKpi?: PersonalKpiViewModel
  canEdit: boolean
  editDisabledReason?: string
  onEdit: (kpi: PersonalKpiViewModel) => void
  canClone: boolean
  cloneDisabledReason?: string
  onClone: () => void
  onDelete: () => void
  deleteActionState: ReturnType<typeof getPersonalKpiDeleteActionState>
}) {
  if (!props.selectedKpi) {
    return (
      <SectionCard title="KPI 상세" description="선택한 KPI의 정의와 최근 실적, 작업 버튼을 확인합니다.">
        <div className="space-y-4">
          <EmptyState title="선택된 KPI가 없습니다." description="왼쪽 목록에서 KPI를 선택하면 상세 정보가 표시됩니다." />
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <ActionButton
              label="삭제"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={props.onDelete}
              disabled
              variant="destructive"
              title={props.deleteActionState.reason}
              testId="personal-kpi-delete-button"
            />
            <p data-testid="personal-kpi-delete-helper" className="text-xs text-slate-500">
              {props.deleteActionState.reason ?? '삭제할 개인 KPI를 먼저 선택해 주세요.'}
            </p>
          </div>
        </div>
      </SectionCard>
    )
  }

  const item = props.selectedKpi

  return (
    <SectionCard title="KPI 상세" description="정의, 승인 맥락, 최근 월간 실적을 함께 확인합니다.">
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
            ) : props.editDisabledReason ? (
              <InfoPill>{props.editDisabledReason}</InfoPill>
            ) : null}
            <ActionButton
              icon={<Copy className="h-4 w-4" />}
              variant="secondary"
              onClick={props.onClone}
              disabled={!props.canClone}
              title={props.cloneDisabledReason}
            >
              복제
            </ActionButton>
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

        {item.tags.length ? (
          <Block title="목표 태그">
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          </Block>
        ) : null}

        {item.orgLineage.length ? (
          <Block title="목표 정렬 경로">
            <div className="flex flex-wrap gap-2">
              {item.orgLineage.map((segment) => (
                <span key={segment.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {joinInlineParts([segment.departmentName, segment.title])}
                </span>
              ))}
            </div>
          </Block>
        ) : null}

        <MidReviewReferencePanel
          kind="personal-kpi"
          targetId={item.id}
          title="중간 점검"
          helper="최근 중간 점검에서 합의한 목표 유지 여부, 기대 상태, 다음 계획을 확인합니다."
        />

        <WeightApprovalSummaryCard approval={item.weightApproval} weight={item.weight} orgLineage={item.orgLineage} />

        <Block title="정의">{item.definition || '정의가 아직 작성되지 않았습니다.'}</Block>
        <Block title="산식">{item.formula || '산식이 아직 작성되지 않았습니다.'}</Block>
        <Block title="검토 코멘트">{item.reviewComment || '검토 코멘트가 아직 없습니다.'}</Block>

        {item.cloneInfo ? (
          <Block title="복제 정보">
            {`${item.cloneInfo.sourceOwnerName ?? '원본'}의 "${item.cloneInfo.sourceTitle}"에서 복제되었습니다. 진행 snapshot ${item.cloneInfo.progressEntryCount}건, 체크인 snapshot ${item.cloneInfo.checkinEntryCount}건을 포함했습니다.`}
          </Block>
        ) : null}

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

        <div className="space-y-3 border-t border-slate-100 pt-4">
          <ActionButton
            label="삭제"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={props.onDelete}
            disabled={props.deleteActionState.disabled}
            variant="destructive"
            title={props.deleteActionState.reason}
            testId="personal-kpi-delete-button"
          />
          {props.deleteActionState.reason ? (
            <p data-testid="personal-kpi-delete-helper" className="text-xs text-slate-500">
              {props.deleteActionState.reason}
            </p>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}

function DeletePersonalKpiDialog(props: {
  kpi?: PersonalKpiViewModel
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        data-testid="personal-kpi-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">개인 KPI 삭제</h2>
            <p className="mt-1 text-sm text-slate-500">
              삭제 후에는 되돌릴 수 없습니다. 대상 KPI를 다시 확인한 뒤 진행해 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.busy}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <div className="text-sm font-semibold text-red-800">삭제 대상</div>
            <div data-testid="personal-kpi-delete-name" className="mt-2 text-base font-semibold text-slate-900">
              {props.kpi?.title ?? '선택한 개인 KPI'}
            </div>
            <p className="mt-2 text-sm text-red-700">이 작업은 되돌릴 수 없습니다.</p>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              label="취소"
              icon={<X className="h-4 w-4" />}
              onClick={props.onClose}
              disabled={props.busy}
              variant="secondary"
              testId="personal-kpi-delete-cancel"
            />
            <ActionButton
              label={props.busy ? '삭제 중...' : '삭제'}
              icon={<Trash2 className="h-4 w-4" />}
              onClick={props.onConfirm}
              disabled={props.busy}
              variant="destructive"
              testId="personal-kpi-delete-confirm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function AiRecommendationSwitchDialog(props: {
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">다른 AI 초안으로 바꾸기</h2>
            <p className="mt-1 text-sm text-slate-500">
              현재 편집 중인 내용이 있습니다. 선택한 AI 초안으로 바꾸면 아직 저장하지 않은 변경 내용이 사라질 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.busy}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            저장하지 않은 변경 사항이 있으면 먼저 저장하거나, 지금 선택한 AI 초안으로 덮어써 주세요.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              label="현재 내용 유지"
              icon={<X className="h-4 w-4" />}
              onClick={props.onClose}
              disabled={props.busy}
              variant="secondary"
            />
            <ActionButton
              label={props.busy ? '적용 중...' : '이 초안으로 바꾸기'}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={props.onConfirm}
              disabled={props.busy}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function GoalReviewQueueSection(props: {
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
  const startReviewState = selectedItem ? getReviewActionState(selectedItem.status, 'START_REVIEW') : { disabled: true }
  const approveState = selectedItem ? getReviewActionState(selectedItem.status, 'APPROVE') : { disabled: true }
  const rejectState = selectedItem ? getReviewActionState(selectedItem.status, 'REJECT') : { disabled: true }

  if (!props.items.length) {
    return (
      <EmptyState
        title="검토할 KPI가 없습니다."
        description="제출된 KPI가 생기면 여기에서 승인, 반려, 가중치 검토를 이어갈 수 있습니다."
      />
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="검토 대기" description="변경된 항목과 승인 상태를 먼저 확인하고 대상을 선택하세요.">
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

      <SectionCard title="검토 상세" description="가중치 승인 이력과 메모를 보고 다음 단계를 진행합니다.">
        {selectedItem ? (
          <div className="space-y-4">
            <CompareCard label="이전 값" value={selectedItem.previousValueSummary || '이전 기록 없음'} />
            <CompareCard label="현재 값" value={selectedItem.currentValueSummary || '현재 요약 없음'} />
            <Block title="기존 반려 사유">{selectedItem.reviewComment || '반려 또는 검토 메모가 아직 없습니다.'}</Block>
            {selectedItem.tags.length ? (
              <Block title="목표 태그">
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </Block>
            ) : null}
            <WeightApprovalSummaryCard
              approval={selectedItem.weightApproval}
              weight={selectedItem.weight}
              orgLineage={selectedItem.orgLineage}
              compact
            />
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">검토 메모</span>
              <textarea
                value={props.reviewNote}
                onChange={(event) => props.onReviewNoteChange(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="승인 또는 반려 이유를 남기면 구성원이 바로 확인할 수 있습니다."
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <ActionButton variant="secondary" disabled={!props.canReview || props.busy || startReviewState.disabled} title={startReviewState.reason} onClick={() => props.onAction(selectedItem.id, 'START_REVIEW')}>
                검토 시작
              </ActionButton>
              <ActionButton disabled={!props.canReview || props.busy || approveState.disabled} title={approveState.reason} onClick={() => props.onAction(selectedItem.id, 'APPROVE')}>
                승인
              </ActionButton>
              <ActionButton variant="secondary" disabled={!props.canReview || props.busy || rejectState.disabled} title={rejectState.reason} onClick={() => props.onAction(selectedItem.id, 'REJECT')}>
                반려
              </ActionButton>
            </div>
          </div>
        ) : (
          <EmptyInline text="검토 대상을 선택하면 상세와 승인 메모 영역이 표시됩니다." />
        )}
      </SectionCard>
    </div>
  )
}

function BulkEditPersonalKpiModal(props: {
  targetCount: number
  form: PersonalBulkEditForm
  employeeOptions: Props['employeeOptions']
  orgKpiOptions: Props['orgKpiOptions']
  busy: boolean
  onChange: (next: PersonalBulkEditForm | ((current: PersonalBulkEditForm) => PersonalBulkEditForm)) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">목표 일괄 수정</h2>
            <p className="mt-1 text-sm text-slate-500">현재 화면에 표시된 KPI {props.targetCount}건에 같은 메타데이터를 한 번에 반영합니다.</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={props.form.applyAssignee}
                onChange={(event) => props.onChange((current) => ({ ...current, applyAssignee: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">담당자 일괄 변경</span>
                <span className="mt-1 block text-xs text-slate-500">조직 이동이나 담당 변경이 필요한 목표를 한 번에 조정합니다.</span>
              </span>
            </span>
            <select
              value={props.form.employeeId}
              onChange={(event) => props.onChange((current) => ({ ...current, employeeId: event.target.value }))}
              disabled={!props.form.applyAssignee}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              {props.employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {joinInlineParts([employee.name, employee.departmentName])}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={props.form.applyOrgKpi}
                onChange={(event) => props.onChange((current) => ({ ...current, applyOrgKpi: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">상위 조직 KPI 재연결</span>
                <span className="mt-1 block text-xs text-slate-500">평가 참고정보와 연결된 상위 목표 맥락을 함께 정리합니다.</span>
              </span>
            </span>
            <select
              value={props.form.linkedOrgKpiId}
              onChange={(event) => props.onChange((current) => ({ ...current, linkedOrgKpiId: event.target.value }))}
              disabled={!props.form.applyOrgKpi}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">연결 해제</option>
              {props.orgKpiOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {joinInlineParts([option.title, option.departmentName])}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={props.form.applyDifficulty}
                  onChange={(event) => props.onChange((current) => ({ ...current, applyDifficulty: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">난이도 일괄 변경</span>
                  <span className="mt-1 block text-xs text-slate-500">운영 우선순위와 난이도 기준을 맞춥니다.</span>
                </span>
              </span>
              <select
                value={props.form.difficulty}
                onChange={(event) => props.onChange((current) => ({ ...current, difficulty: event.target.value as KpiForm['difficulty'] }))}
                disabled={!props.form.applyDifficulty}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              >
                <option value="HIGH">높음</option>
                <option value="MEDIUM">중간</option>
                <option value="LOW">낮음</option>
              </select>
            </label>

            <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={props.form.applyTags}
                  onChange={(event) => props.onChange((current) => ({ ...current, applyTags: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">태그 일괄 변경</span>
                  <span className="mt-1 block text-xs text-slate-500">쉼표로 구분해 같은 운영 태그를 한 번에 적용합니다.</span>
                </span>
              </span>
              <input
                value={props.form.tags}
                onChange={(event) => props.onChange((current) => ({ ...current, tags: event.target.value }))}
                disabled={!props.form.applyTags}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                placeholder="예: 매출, 고객, 개선"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            저장 전에는 원본 KPI가 바뀌지 않으며, 저장 시 일괄 수정 이력이 함께 기록됩니다.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton variant="secondary" onClick={props.onClose}>
              취소
            </ActionButton>
            <ActionButton onClick={props.onSubmit} disabled={props.busy}>
              {props.busy ? '일괄 수정 중...' : '일괄 수정 저장'}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
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

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-900">목표 태그</span>
            <input
              value={props.form.tags}
              onChange={(event) => props.onChange((current) => ({ ...current, tags: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="예: 매출, 고객, 운영 안정화"
            />
            <p className="text-xs text-slate-500">쉼표로 구분해 입력하면 승인과 검토 화면에서 함께 표시됩니다.</p>
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
                    {joinInlineParts([option.title, option.departmentName])}
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

function MetricCard(props: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{props.value}</p>
      {props.helper ? <p className="mt-2 text-xs text-slate-500">{props.helper}</p> : null}
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
  children?: ReactNode
  label?: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'destructive'
  title?: string
  icon?: ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      data-testid={props.testId}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        props.variant === 'secondary'
          ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          : props.variant === 'destructive'
            ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {props.icon}
      {props.label ?? props.children}
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
