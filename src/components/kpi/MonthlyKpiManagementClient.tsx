'use client'

import Link from 'next/link'
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FilePlus2,
  History,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Save,
  Sparkles,
} from 'lucide-react'
import { KpiAiPreviewPanel } from '@/components/kpi/KpiAiPreviewPanel'
import { MidReviewReferencePanel } from '@/components/mid-review/MidReviewReferencePanel'
import {
  PmsActionCard as NextActionCard,
  PmsEmptyIllustration as MonthlyEmptyIllustration,
  PmsMetricRail,
  PmsProgressRing as MonthlyProgressRing,
  PmsWorkspaceSection,
} from '@/components/pms-ui'
import {
  createEvidenceLinkAttachment,
  downloadEvidenceAttachment,
  openEvidenceLink,
  readEvidenceFiles,
} from '@/lib/evidence-attachments-client'
import {
  evaluateMonthlySubmit,
  type MonthlySubmitValidationResult,
} from '@/lib/monthly-submit-validation'
import { isAllowedMonthlyEvidenceUrl } from '@/lib/monthly-attachments'
import { formatCountWithUnit } from '@/lib/metric-copy'
import { calcSalesScore } from '@/lib/sales-score-policy-2026'
import { getMonthlyMidCheckScheduleGuidance } from '@/lib/evaluation-2026-schedule-readiness'
import type {
  MonthlyAttachmentViewModel,
  MonthlyPageData,
  MonthlyRecordViewModel,
} from '@/server/monthly-kpi-page'

type Props = MonthlyPageData & {
  initialTab?: string
  initialRecordId?: string
}

type TabKey = 'entry' | 'trend' | 'review' | 'evidence' | 'ai'
type BusyState =
  | 'save'
  | 'submit'
  | 'upload'
  | 'review'
  | 'request-update'
  | 'ai'
  | 'ai-decision'
  | null

type Banner = { tone: 'success' | 'error' | 'info'; message: string }
type ActionState = { disabled: boolean; reason?: string }
type FilterState = {
  status: string
  risk: string
  type: string
  review: string
  search: string
}
type Draft = {
  actualValue: string
  actualAmount: string
  activityNote: string
  blockerNote: string
  effortNote: string
  evidenceComment: string
  attachments: MonthlyAttachmentViewModel[]
  linkUrlInput: string
  linkCommentInput: string
}

type AiAction =
  | 'generate-summary'
  | 'explain-risk'
  | 'generate-review'
  | 'summarize-evidence'
  | 'generate-retrospective'
  | 'suggest-checkin-agenda'
  | 'summarize-evaluation-evidence'

type AiPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: Record<string, unknown>
}

const TABS: Array<{ key: TabKey; label: string; description: string }> = [
  { key: 'entry', label: '입력', description: 'KPI별 이번 달 진행 상황과 필요한 근거만 빠르게 정리합니다.' },
  { key: 'trend', label: '누적 추이', description: '최근 흐름을 보며 이번 달 상태가 좋아졌는지 확인합니다.' },
  { key: 'review', label: '리뷰/피드백', description: '상사 리뷰와 보완 요청, 제출 이력을 한 곳에서 확인합니다.' },
  { key: 'evidence', label: '증빙 항목', description: '파일과 링크 근거를 모아 평가 시점에 다시 찾기 쉽게 합니다.' },
  { key: 'ai', label: 'AI 보조', description: 'AI는 초안과 요약을 돕습니다. 저장과 제출은 사용자가 직접 결정합니다.' },
]

const TAB_ICONS: Record<TabKey, ReactNode> = {
  entry: <ClipboardList className="h-4 w-4" />,
  trend: <BarChart3 className="h-4 w-4" />,
  review: <MessageSquare className="h-4 w-4" />,
  evidence: <Paperclip className="h-4 w-4" />,
  ai: <Sparkles className="h-4 w-4" />,
}

const STATUS_LABELS: Record<MonthlyRecordViewModel['status'], string> = {
  NOT_STARTED: '미시작',
  DRAFT: '임시저장',
  SUBMITTED: '제출됨',
  REVIEWED: '리뷰 완료',
  LOCKED: '잠금',
}

const STATUS_CLASS: Record<MonthlyRecordViewModel['status'], string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700',
  DRAFT: 'bg-blue-100 text-blue-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  REVIEWED: 'bg-emerald-100 text-emerald-700',
  LOCKED: 'bg-violet-100 text-violet-700',
}

const AI_LABELS: Record<AiAction, string> = {
  'generate-summary': '월간 실적 코멘트 초안',
  'explain-risk': '위험 KPI 설명 보조',
  'generate-review': '상사 리뷰 초안',
  'summarize-evidence': '증빙 요약',
  'generate-retrospective': '월간 회고 요약',
  'suggest-checkin-agenda': '체크인 아젠다 추천',
  'summarize-evaluation-evidence': '평가 근거 초안',
}

const AI_DESCRIPTIONS: Record<AiAction, string> = {
  'generate-summary': '리더가 관리 범위 구성원의 월간 실적 코멘트 초안을 준비할 때 사용합니다.',
  'explain-risk': '위험 신호나 이슈 메모를 더 이해하기 쉬운 표현으로 정리합니다.',
  'generate-review': '제출된 월간 실적에 대한 상사 리뷰 초안을 준비합니다.',
  'summarize-evidence': '첨부된 증빙과 링크 내용을 월간 기록 관점으로 요약합니다.',
  'generate-retrospective': '이번 달 강점, 리스크, 다음 달 우선순위를 회고 형태로 정리합니다.',
  'suggest-checkin-agenda': '다음 체크인에서 확인할 질문과 논의 안건을 제안합니다.',
  'summarize-evaluation-evidence': '직책자가 평가 전 근거를 검토할 때 쓰는 요약 초안입니다.',
}

const LEADER_ONLY_MONTHLY_AI_ACTION_IDS = new Set<AiAction>([
  'generate-summary',
  'generate-review',
  'summarize-evaluation-evidence',
])

const DEFAULT_FILTERS: FilterState = {
  status: 'ALL',
  risk: 'ALL',
  type: 'ALL',
  review: 'ALL',
  search: '',
}

function parseYearMonth(selectedYear: number, selectedMonth: string) {
  const [rawYear, rawMonth] = selectedMonth.split('-')
  const resolvedYear = Number(rawYear) || selectedYear
  const resolvedMonth = Math.min(12, Math.max(1, Number(rawMonth) || 1))
  return {
    year: resolvedYear,
    month: resolvedMonth,
    value: `${resolvedYear}-${String(resolvedMonth).padStart(2, '0')}`,
    fullLabel: `${resolvedYear}년 ${resolvedMonth}월`,
    shortLabel: `${resolvedMonth}월`,
    screenTitle: `${resolvedYear}년 ${resolvedMonth}월 월간 실적`,
  }
}

function getQuickMonthOptions(selectedYear: number, selectedMonth: string) {
  const { month } = parseYearMonth(selectedYear, selectedMonth)
  const start = Math.max(1, month - 2)
  const end = Math.min(12, start + 4)
  const adjustedStart = Math.max(1, end - 4)
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => {
    const monthNumber = adjustedStart + index
    return {
      value: `${selectedYear}-${String(monthNumber).padStart(2, '0')}`,
      label: `${monthNumber}월`,
      monthNumber,
    }
  })
}

function canManageMonthlyScope(role: MonthlyPageData['actor']['role']) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(role)
}

function MonthQuickSwitch({
  selectedYear,
  selectedMonth,
  onChange,
}: {
  selectedYear: number
  selectedMonth: string
  onChange: (month: string) => void
}) {
  const quickMonths = getQuickMonthOptions(selectedYear, selectedMonth)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        빠른 월 이동
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickMonths.map((month) => {
          const selected = month.value === selectedMonth
          return (
            <button
              key={month.value}
              type="button"
              onClick={() => onChange(month.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
              aria-pressed={selected}
            >
              {month.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function hasMeaningfulMonthlyContent(record: MonthlyRecordViewModel | null, draft: Draft | null) {
  if (!record || !draft) return false
  if (record.recordId) return true
  if (draft.actualValue.trim().length > 0) return true
  if (draft.activityNote.trim().length > 0) return true
  if (draft.blockerNote.trim().length > 0) return true
  if (draft.effortNote.trim().length > 0) return true
  if (draft.attachments.length > 0) return true
  if (record.linkedCheckins.length > 0) return true
  return false
}

function getEditBlockedReason(record: MonthlyRecordViewModel | null, canEdit: boolean) {
  if (!record) return '입력할 KPI를 먼저 선택하세요.'
  if (record.isMirror) return '공통 배포 KPI는 직접 실적 입력이 불가합니다. 캐리어 KPI의 실적이 자동 반영됩니다.'
  if (canEdit) return undefined
  if (record.status === 'SUBMITTED') return '제출된 월간 실적은 리뷰 전까지 수정할 수 없습니다.'
  if (record.status === 'REVIEWED') return '리뷰가 완료된 월간 실적은 읽기 전용입니다.'
  if (record.status === 'LOCKED') return '잠금 상태의 월간 실적은 관리자 unlock 후 수정할 수 있습니다.'
  return '현재 상태에서는 월간 실적을 수정할 수 없습니다.'
}

function getSubmitBlockedReason(record: MonthlyRecordViewModel | null, canSubmit: boolean, draft: Draft | null) {
  if (!record) return '제출할 KPI를 먼저 선택하세요.'
  if (!canSubmit) {
    if (record.status === 'SUBMITTED') return '이미 제출된 월간 실적입니다.'
    if (record.status === 'REVIEWED') return '리뷰가 완료된 월간 실적은 다시 제출할 수 없습니다.'
    if (record.status === 'LOCKED') return '잠금 상태의 월간 실적은 제출할 수 없습니다.'
    return '현재 상태에서는 제출할 수 없습니다.'
  }

  if (record.type === 'QUANTITATIVE' && draft?.actualValue.trim() && !Number.isFinite(Number(draft.actualValue))) {
    return '정량 KPI는 숫자 실적값을 입력해야 합니다.'
  }

  return undefined
}

function getSubmitValidationResult(
  record: MonthlyRecordViewModel | null,
  canSubmit: boolean,
  draft: Draft | null
): MonthlySubmitValidationResult {
  const isSalesRevenue = record?.goalType === 'SALES_REVENUE'
  // SALES_REVENUE는 actualAmount로 실적을 입력. evaluateMonthlySubmit의 QUANTITATIVE actualValue
  // 존재 체크에 sentinel(1)로 "값 있음"을 표시. 달성률 재계산·0 체크 등 부작용 없음.
  const actualValueForValidation = isSalesRevenue
    ? (draft?.actualAmount.trim() ? 1 : undefined)
    : (draft?.actualValue ?? record?.actualValue)
  return evaluateMonthlySubmit({
    hasSelection: Boolean(record),
    hasSubmitPermission: canSubmit,
    status: record?.status,
    type: record?.type,
    actualValue: actualValueForValidation,
    activityNote: draft?.activityNote ?? record?.activityNote,
    blockerNote: draft?.blockerNote ?? record?.blockerNote,
    effortNote: draft?.effortNote ?? record?.effortNote,
    evidenceComment: draft?.evidenceComment ?? record?.evidenceComment,
    attachmentsCount: draft?.attachments.length ?? record?.attachments.length ?? 0,
    linkedCheckinCount: record?.linkedCheckins.length ?? 0,
    achievementRate: record?.achievementRate,
  })
}

function getReviewActionState(
  record: MonthlyRecordViewModel | null,
  canReview: boolean,
  action: 'REVIEW' | 'REQUEST_UPDATE'
): ActionState {
  if (!record?.recordId) {
    return { disabled: true, reason: '제출된 월간 실적이 있을 때만 리뷰할 수 있습니다.' }
  }

  if (!canReview) {
    return { disabled: true, reason: '리뷰 권한이 없습니다.' }
  }

  if (!['SUBMITTED', 'REVIEWED'].includes(record.status)) {
    return {
      disabled: true,
      reason:
        action === 'REVIEW'
          ? '제출된 월간 실적만 리뷰 완료 처리할 수 있습니다.'
          : '제출된 월간 실적만 보완 요청할 수 있습니다.',
    }
  }

  return { disabled: false }
}

function buildAiActionState(params: {
  action: AiAction
  canUseAi: boolean
  canUseMonthlyCommentDraft: boolean
  selected: MonthlyRecordViewModel | null
  selectedDraft: Draft | null
  canReview: boolean
}): ActionState {
  const { action, canUseAi, canUseMonthlyCommentDraft, selected, selectedDraft, canReview } = params

  if (!selected || !selectedDraft) {
    return { disabled: true, reason: 'KPI를 먼저 선택하세요.' }
  }

  if (!canUseAi) {
    return { disabled: true, reason: '현재 환경에서는 AI 보조를 사용할 수 없습니다.' }
  }

  const hasContent = hasMeaningfulMonthlyContent(selected, selectedDraft)
  const hasEvidence = selectedDraft.attachments.length > 0

  switch (action) {
    case 'generate-summary':
      if (!canUseMonthlyCommentDraft) {
        return {
          disabled: true,
          reason: '팀장·실장·본부장 등 리뷰 권한이 있는 화면에서만 사용할 수 있습니다.',
        }
      }
      return hasContent
        ? { disabled: false }
        : { disabled: true, reason: '이번 달 실적 입력이나 근거가 있어야 AI 초안을 생성할 수 있습니다.' }
    case 'generate-retrospective':
    case 'summarize-evaluation-evidence':
      return hasContent
        ? { disabled: false }
        : { disabled: true, reason: '이번 달 실적 입력이나 근거가 있어야 AI 초안을 생성할 수 있습니다.' }
    case 'explain-risk':
      return selected.riskFlags.length > 0 || selectedDraft.blockerNote.trim().length > 0
        ? { disabled: false }
        : { disabled: true, reason: '위험 신호나 이슈 메모가 있을 때 사용할 수 있습니다.' }
    case 'generate-review':
      if (!canReview) {
        return { disabled: true, reason: '리뷰 권한이 있는 사용자만 사용할 수 있습니다.' }
      }
      if (!selected.recordId || !['SUBMITTED', 'REVIEWED'].includes(selected.status)) {
        return { disabled: true, reason: '제출된 월간 실적을 선택해야 리뷰 초안을 생성할 수 있습니다.' }
      }
      return { disabled: false }
    case 'summarize-evidence':
      return hasEvidence
        ? { disabled: false }
        : { disabled: true, reason: '증빙 자료가 있을 때만 요약할 수 있습니다.' }
    case 'suggest-checkin-agenda':
      return hasContent || selected.linkedCheckins.length > 0
        ? { disabled: false }
        : { disabled: true, reason: '월간 실적이나 체크인 근거가 있을 때 안건을 제안할 수 있습니다.' }
    default:
      return { disabled: false }
  }
}

function formatDate(value?: string) {
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
  return typeof value === 'number' ? `${Math.round(value * 10) / 10}%` : '-'
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : null)).filter((item): item is string => Boolean(item))
    : []
}

function formatActualAmount(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function createDraft(record: MonthlyRecordViewModel): Draft {
  return {
    actualValue:
      typeof record.actualValue === 'number' || typeof record.actualValue === 'string'
        ? String(record.actualValue)
        : '',
    actualAmount: record.actualAmount ? formatActualAmount(record.actualAmount) : '',
    activityNote: record.activityNote ?? '',
    blockerNote: record.blockerNote ?? '',
    effortNote: record.effortNote ?? '',
    evidenceComment: record.evidenceComment ?? '',
    attachments: record.attachments ?? [],
    linkUrlInput: '',
    linkCommentInput: '',
  }
}

async function parseJsonOrThrow<T>(response: Response) {
  const json = (await response.json()) as {
    success?: boolean
    data?: T
    error?: { message?: string }
  }

  if (!json.success) {
    throw new Error(json.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }

  return json.data as T
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  return search.toString()
}

function Button({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  icon,
  title,
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
  title?: string
  size?: 'sm' | 'md'
}) {
  const sizeClass =
    size === 'sm'
      ? 'min-h-8 rounded-lg px-2.5 text-xs gap-1.5'
      : 'min-h-11 rounded-2xl px-4 text-sm gap-2'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${
        variant === 'primary'
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function StatePanel({ tone, title, message }: { tone: 'neutral' | 'danger'; title: string; message: string }) {
  return (
    <section
      className={`rounded-2xl border p-6 shadow-sm ${
        tone === 'danger'
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-slate-200 bg-slate-50 text-slate-800'
      }`}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </section>
  )
}

function DetailMetricBox({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold text-slate-950">{value || '-'}</div>
      {helper ? <div className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</div> : null}
    </div>
  )
}

function RelatedInfoCard({
  icon,
  label,
  value,
  helper,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  helper: string
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left w-full${onClick ? ' cursor-pointer transition-colors hover:bg-slate-100 hover:border-slate-300' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className="rounded-xl bg-white p-2 text-slate-600 shadow-sm">{icon}</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-0.5 text-sm font-bold text-slate-950">{value}</div>
          <div className="mt-1 text-[11px] leading-4 text-slate-500">{helper}</div>
        </div>
      </div>
    </Tag>
  )
}

function MonthlyWorkspaceTabs({
  tab,
  setTab,
}: {
  tab: TabKey
  setTab: Dispatch<SetStateAction<TabKey>>
}) {
  const activeTab = TABS.find((item) => item.key === tab)

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {TAB_ICONS[item.key]}
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab ? (
        <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-slate-500">
          {activeTab.description}
        </p>
      ) : null}
    </div>
  )
}

function MonthlyWorkspaceHeader({
  monthContext,
  pageData,
  canChangeTargetScope,
  targetContextLabel,
  advancedFiltersOpen,
  setAdvancedFiltersOpen,
  submitValidationSummary,
  submitRecommendationReasons,
  midCheckScheduleGuidance,
  tab,
  setTab,
  setFilters,
  handleRouteSelection,
}: {
  monthContext: ReturnType<typeof parseYearMonth>
  pageData: MonthlyPageData
  canChangeTargetScope: boolean
  targetContextLabel: string
  advancedFiltersOpen: boolean
  setAdvancedFiltersOpen: Dispatch<SetStateAction<boolean>>
  submitValidationSummary?: string
  submitRecommendationReasons: string[]
  midCheckScheduleGuidance: ReturnType<typeof getMonthlyMidCheckScheduleGuidance>
  tab: TabKey
  setTab: Dispatch<SetStateAction<TabKey>>
  setFilters: Dispatch<SetStateAction<FilterState>>
  handleRouteSelection: (next: {
    year?: number
    month?: string
    scope?: string
    employeeId?: string
    tab?: TabKey
    recordId?: string
  }) => void
}) {
  const totalCount = pageData.records.length
  const completedCount = pageData.records.filter((record) => ['SUBMITTED', 'REVIEWED', 'LOCKED'].includes(record.status)).length
  const inputNeededCount = pageData.summary.missingCount
  const riskCount = pageData.summary.riskyCount
  const reviewPendingCount = pageData.summary.reviewPendingCount

  return (
    <PmsWorkspaceSection
      eyebrow={
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
          <ClipboardList className="h-4 w-4" />
          월간 KPI 작업 영역
        </p>
      }
      title={`${monthContext.fullLabel} 월간 실적`}
      description="먼저 이번 달 해야 할 일을 확인하고, 필요한 KPI만 선택해 짧게 기록하세요."
      actions={
        <>
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, status: 'NOT_STARTED' }))}
              className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              입력 필요만 보기
            </button>
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, risk: 'RISK' }))}
              className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
            >
              위험 KPI만 보기
            </button>
        </>
      }
    >

        <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {monthContext.fullLabel}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    pageData.summary.overallStatus === 'MIXED'
                      ? 'bg-slate-100 text-slate-700'
                      : STATUS_CLASS[pageData.summary.overallStatus]
                  }`}
                >
                  {pageData.summary.overallStatus === 'MIXED'
                    ? '혼합 상태'
                    : STATUS_LABELS[pageData.summary.overallStatus]}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {canChangeTargetScope ? `대상: ${targetContextLabel}` : `내 실적 · ${targetContextLabel}`}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  리뷰 대기 {formatCountWithUnit(reviewPendingCount, '개')}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    submitValidationSummary ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {submitValidationSummary ? '제출 전 확인 필요' : '제출 가능 상태'}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                일반 입력 화면은 단순하게 유지하고, 월/대상 설정은 필요할 때만 펼칩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAdvancedFiltersOpen((value) => !value)}
              aria-expanded={advancedFiltersOpen}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {advancedFiltersOpen ? '월/대상 설정 닫기' : '월/대상 설정'}
            </button>
          </div>

          <div className="mt-3">
            <MonthQuickSwitch
              selectedYear={pageData.selectedYear}
              selectedMonth={pageData.selectedMonth}
              onChange={(month) => handleRouteSelection({ month, tab: 'entry', recordId: '' })}
            />
          </div>

          {advancedFiltersOpen ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500">연도</span>
                <select
                  value={String(pageData.selectedYear)}
                  onChange={(event) => handleRouteSelection({ year: Number(event.target.value), tab: 'entry', recordId: '' })}
                  className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {pageData.availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500">월</span>
                <select
                  value={pageData.selectedMonth}
                  onChange={(event) => handleRouteSelection({ month: event.target.value, tab: 'entry', recordId: '' })}
                  className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                >
                  {Array.from({ length: 12 }, (_, index) => {
                    const value = `${pageData.selectedYear}-${String(index + 1).padStart(2, '0')}`
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    )
                  })}
                </select>
              </label>

              {canChangeTargetScope ? (
                <>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">대상 범위</span>
                    <select
                      value={pageData.selectedScope}
                      onChange={(event) => handleRouteSelection({ scope: event.target.value, tab: 'entry', recordId: '' })}
                      className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                    >
                      <option value="self">내 실적</option>
                      <option value="team">우리 팀</option>
                      <option value="employee">특정 구성원</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">대상자</span>
                    <MonthlyEmployeeSearchCombo
                      options={pageData.employeeOptions}
                      value={pageData.selectedEmployeeId}
                      disabled={pageData.selectedScope === 'self'}
                      onChange={(employeeId) =>
                        handleRouteSelection({ scope: 'employee', employeeId, tab: 'entry', recordId: '' })
                      }
                    />
                  </label>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 sm:col-span-2">
                  내 실적 · {targetContextLabel}
                </div>
              )}
            </div>
          ) : null}

          {submitValidationSummary ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
              <span className="font-semibold">제출 차단:</span> {submitValidationSummary}
            </p>
          ) : null}
          {submitRecommendationReasons.length ? (
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              {submitRecommendationReasons.join(' ')}
            </p>
          ) : null}

          <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-700">
              2026 중간 점검 schedule guidance
            </summary>
            <p className="mt-2 leading-5">{midCheckScheduleGuidance.message}</p>
            <p className="mt-1 text-[11px] text-slate-500">
              {midCheckScheduleGuidance.window.plannedRangeLabel} · 저장/제출을 강제하지 않는 안내입니다.
            </p>
          </details>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-950">이번 달 먼저 할 일</h3>
              <p className="text-xs text-slate-500">긴 보고서보다 필요한 KPI부터 짧게 정리합니다.</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
              핵심 행동 4개
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <NextActionCard
              icon={<ClipboardList className="h-4 w-4" />}
              label="미입력 KPI 채우기"
              description="한 줄 진행 요약부터 남깁니다."
              done={inputNeededCount === 0}
              tone={inputNeededCount > 0 ? 'danger' : 'neutral'}
              onClick={() => setFilters((current) => ({ ...current, status: 'NOT_STARTED' }))}
            />
            <NextActionCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="위험 KPI 보완"
              description="리스크 원인과 대응만 정리합니다."
              done={riskCount === 0}
              tone={riskCount > 0 ? 'danger' : 'neutral'}
              onClick={() => setFilters((current) => ({ ...current, risk: 'RISK' }))}
            />
            <NextActionCard
              icon={<Paperclip className="h-4 w-4" />}
              label="증빙 추가"
              description="링크나 짧은 메모부터 연결합니다."
              done={pageData.summary.attachmentCount > 0}
              onClick={() => setTab('evidence')}
            />
            <NextActionCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="상사 리뷰 확인"
              description="리뷰 대기와 보완 요청을 확인합니다."
              done={reviewPendingCount === 0}
              tone={reviewPendingCount > 0 ? 'warning' : 'neutral'}
              onClick={() => setTab('review')}
            />
          </div>
        </div>

        <PmsMetricRail
          className="mt-3"
          items={[
            {
              icon: <ClipboardList className="h-5 w-5" />,
              label: '전체 KPI',
              value: formatCountWithUnit(totalCount, '개'),
              helper: '이번 달 기록 대상 KPI',
              chip: '전체',
            },
            {
              icon: <CheckCircle2 className="h-5 w-5" />,
              label: '입력 완료',
              value: formatCountWithUnit(completedCount, '개'),
              helper: `${pageData.summary.submissionRate}% 제출 기준`,
              chip: '진행',
              tone: completedCount > 0 ? 'good' : 'neutral',
            },
            {
              icon: <ListChecks className="h-5 w-5" />,
              label: '입력 필요',
              value: formatCountWithUnit(inputNeededCount, '개'),
              helper: '한 줄 요약부터 작성',
              chip: inputNeededCount ? '확인 필요' : '완료',
              tone: inputNeededCount ? 'warning' : 'good',
            },
            {
              icon: <AlertTriangle className="h-5 w-5" />,
              label: '위험 KPI',
              value: formatCountWithUnit(riskCount, '개'),
              helper: '원인과 대응만 짧게 보완',
              chip: riskCount ? '리스크' : '안정',
              tone: riskCount ? 'danger' : 'good',
            },
          ]}
        />

      <MonthlyWorkspaceTabs tab={tab} setTab={setTab} />
    </PmsWorkspaceSection>
  )
}

function RecoveryScopeControls(props: {
  pageData: MonthlyPageData
  onChangeYear: (year: number) => void
  onChangeMonth: (month: string) => void
  onChangeScope: (scope: string) => void
  onChangeEmployee: (employeeId: string) => void
}) {
  const monthContext = parseYearMonth(props.pageData.selectedYear, props.pageData.selectedMonth)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">월 선택</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">현재 선택 월: {monthContext.fullLabel}</p>
          <div className="mt-3">
            <MonthQuickSwitch
              selectedYear={props.pageData.selectedYear}
              selectedMonth={props.pageData.selectedMonth}
              onChange={props.onChangeMonth}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500">연도</span>
            <select
              value={String(props.pageData.selectedYear)}
              onChange={(event) => props.onChangeYear(Number(event.target.value))}
              className="min-h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {props.pageData.availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-slate-500">월</span>
            <select
              value={props.pageData.selectedMonth}
              onChange={(event) => props.onChangeMonth(event.target.value)}
              className="min-h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {Array.from({ length: 12 }, (_, index) => {
                const value = `${props.pageData.selectedYear}-${String(index + 1).padStart(2, '0')}`
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                )
              })}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">대상 범위</span>
          <select
            value={props.pageData.selectedScope}
            onChange={(event) => props.onChangeScope(event.target.value)}
            className="min-h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="self">내 실적</option>
            <option value="team">팀 범위</option>
            <option value="employee">특정 직원</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">대상자</span>
          <select
            value={props.pageData.selectedEmployeeId}
            onChange={(event) => props.onChangeEmployee(event.target.value)}
            disabled={props.pageData.selectedScope === 'self'}
            className="min-h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
          >
            <option value="">대상자를 선택해 주세요</option>
            {props.pageData.employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} / {employee.departmentName}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}

function MonthlyEmployeeSearchCombo({
  options,
  value,
  disabled,
  onChange,
}: {
  options: MonthlyPageData['employeeOptions']
  value: string
  disabled: boolean
  onChange: (employeeId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((e) => e.id === value)
  const displayLabel = selected ? `${selected.name} / ${selected.departmentName}` : ''

  const { filtered, hasMore } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? options.filter(
          (e) => e.name.toLowerCase().includes(q) || e.departmentName.toLowerCase().includes(q)
        )
      : options
    return { filtered: base.slice(0, 60), hasMore: base.length > 60 }
  }, [options, query])

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        placeholder={disabled ? '대상 범위를 먼저 선택하세요' : '이름 또는 부서 검색…'}
        value={open ? query : displayLabel}
        onFocus={() => {
          if (!disabled) {
            setQuery('')
            setOpen(true)
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      {open && (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-gray-200 bg-white text-sm shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-400">검색 결과 없음</li>
          ) : (
            <>
              {filtered.map((e) => (
                <li
                  key={e.id}
                  onMouseDown={(evt) => {
                    evt.preventDefault()
                    handleSelect(e.id)
                  }}
                  className={`cursor-pointer px-3 py-2 hover:bg-slate-50 ${e.id === value ? 'font-semibold text-blue-700' : 'text-slate-800'}`}
                >
                  {e.name}
                  <span className="ml-1 text-xs text-slate-400">/ {e.departmentName}</span>
                </li>
              ))}
              {hasMore && (
                <li className="border-t border-gray-100 px-3 py-1.5 text-xs text-slate-400">
                  검색어를 입력하면 더 많은 결과를 볼 수 있습니다
                </li>
              )}
            </>
          )}
        </ul>
      )}
    </div>
  )
}

function LoadAlerts(props: {
  alerts: Array<{
    title: string
    description: string
  }>
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">일부 운영 데이터를 불러오지 못해 기본 화면으로 표시 중입니다.</p>
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

export function MonthlyKpiManagementClient({
  initialTab,
  initialRecordId,
  ...pageData
}: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previousContextRef = useRef<string | null>(null)
  const [tab, setTab] = useState<TabKey>(
    TABS.some((item) => item.key === initialTab) ? (initialTab as TabKey) : 'entry'
  )
  const [selectedId, setSelectedId] = useState(initialRecordId ?? pageData.records[0]?.id ?? '')
  const [busy, setBusy] = useState<BusyState>(null)
  const [banner, setBanner] = useState<Banner | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [lastAiAction, setLastAiAction] = useState<AiAction>('generate-summary')
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(pageData.records.map((record) => [record.id, createDraft(record)]))
  )

  const selected = pageData.records.find((record) => record.id === selectedId) ?? pageData.records[0] ?? null
  const selectedDraft = selected ? drafts[selected.id] ?? createDraft(selected) : null
  const selectedTrend = selected
    ? pageData.trends.find((trend) => trend.personalKpiId === selected.personalKpiId)
    : null

  const canEdit =
    Boolean(selected) &&
    pageData.permissions.canEdit &&
    ['NOT_STARTED', 'DRAFT'].includes(selected.status) &&
    !selected?.isMirror
  const canSubmit =
    Boolean(selected) &&
    pageData.permissions.canSubmit &&
    ['NOT_STARTED', 'DRAFT'].includes(selected.status)
  const contextKey = useMemo(
    () =>
      `${pageData.selectedScope}:${pageData.selectedEmployeeId}:${pageData.selectedYear}:${pageData.selectedMonth}`,
    [pageData.selectedEmployeeId, pageData.selectedMonth, pageData.selectedScope, pageData.selectedYear]
  )
  const monthContext = useMemo(
    () => parseYearMonth(pageData.selectedYear, pageData.selectedMonth),
    [pageData.selectedMonth, pageData.selectedYear]
  )
  const midCheckScheduleGuidance2026 = useMemo(() => getMonthlyMidCheckScheduleGuidance(), [])
  const editDisabledReason = getEditBlockedReason(selected, canEdit)
  const submitValidation = getSubmitValidationResult(selected, canSubmit, selectedDraft)
  const submitDisabledReason = submitValidation.summary
  const canUseMonthlyCommentDraft = pageData.permissions.canReview
  const reviewActionState = getReviewActionState(selected, pageData.permissions.canReview, 'REVIEW')
  const requestUpdateActionState = getReviewActionState(selected, pageData.permissions.canReview, 'REQUEST_UPDATE')
  const aiActionStates = Object.fromEntries(
    (Object.keys(AI_LABELS) as AiAction[]).map((action) => [
      action,
      buildAiActionState({
        action,
        canUseAi: pageData.permissions.canUseAi,
        canUseMonthlyCommentDraft,
        selected,
        selectedDraft,
        canReview: pageData.permissions.canReview,
      }),
    ])
  ) as Record<AiAction, ActionState>
  const visibleAiActions = (Object.keys(AI_LABELS) as AiAction[]).filter(
    (action) => !LEADER_ONLY_MONTHLY_AI_ACTION_IDS.has(action) || canUseMonthlyCommentDraft
  )
  const copyPreviousReason =
    !selected
      ? 'KPI를 먼저 선택하세요.'
      : !selected.previousRecord
        ? '이전 달 실적이 없어 불러올 값이 없습니다.'
        : editDisabledReason
  const uploadDisabledReason = editDisabledReason

  const visibleRecords = pageData.records.filter((record) => {
    const searchTerm = filters.search.trim().toLowerCase()
    if (
      searchTerm &&
      ![record.kpiTitle, record.orgKpiTitle ?? '', record.type === 'QUANTITATIVE' ? '정량' : '정성']
        .join(' ')
        .toLowerCase()
        .includes(searchTerm)
    ) {
      return false
    }
    if (filters.status !== 'ALL' && record.status !== filters.status) return false
    if (filters.risk === 'RISK' && record.riskFlags.length === 0) return false
    if (filters.risk === 'SAFE' && record.riskFlags.length > 0) return false
    if (filters.type !== 'ALL' && record.type !== filters.type) return false
    if (filters.review === 'REVIEWED' && !record.reviewComment) return false
    if (filters.review === 'PENDING' && record.status !== 'SUBMITTED') return false
    return true
  })
  const canChangeTargetScope = canManageMonthlyScope(pageData.actor.role)
  const selectedEmployeeOption = pageData.employeeOptions.find((employee) => employee.id === pageData.selectedEmployeeId)
  const targetContextLabel = selectedEmployeeOption
    ? `${selectedEmployeeOption.name} / ${selectedEmployeeOption.departmentName}`
    : `${pageData.actor.name} / ${pageData.actor.departmentName}`

  useEffect(() => {
    setDrafts(Object.fromEntries(pageData.records.map((record) => [record.id, createDraft(record)])))
    setSelectedId((current) => {
      const recordIds = new Set(pageData.records.map((record) => record.id))
      if (initialRecordId && recordIds.has(initialRecordId)) {
        return initialRecordId
      }
      if (current && recordIds.has(current)) {
        return current
      }
      return pageData.records[0]?.id ?? ''
    })
  }, [initialRecordId, pageData.records])

  useEffect(() => {
    if (previousContextRef.current === contextKey) {
      return
    }
    previousContextRef.current = contextKey
    setTab('entry')
    setSelectedId(() => {
      const recordIds = new Set(pageData.records.map((record) => record.id))
      if (initialRecordId && recordIds.has(initialRecordId)) {
        return initialRecordId
      }
      return pageData.records[0]?.id ?? ''
    })
    setReviewComment('')
    setAiPreview(null)
    setBanner(null)
    setFilters({ ...DEFAULT_FILTERS })
  }, [contextKey, initialRecordId, pageData.records])

  useEffect(() => {
    setReviewComment('')
    setAiPreview(null)
  }, [selected?.id])

  function handleRouteSelection(next: {
    year?: number
    month?: string
    scope?: string
    employeeId?: string
    tab?: TabKey
    recordId?: string
  }) {
    if (next.tab) {
      setTab(next.tab)
    }
    const query = buildQuery({
      year: String(next.year ?? pageData.selectedYear),
      month: next.month ?? pageData.selectedMonth,
      scope: next.scope ?? pageData.selectedScope,
      employeeId:
        (next.scope ?? pageData.selectedScope) === 'employee'
          ? next.employeeId ?? pageData.selectedEmployeeId
          : undefined,
      tab: next.tab ?? tab,
      recordId: next.recordId ?? selected?.id,
    })
    router.push(`/kpi/monthly?${query}`)
  }

  function updateDraft(patch: Partial<Draft>) {
    if (!selected || !selectedDraft) return
    setDrafts((current) => ({
      ...current,
      [selected.id]: {
        ...selectedDraft,
        ...patch,
      },
    }))
  }

  async function handleAttachmentUpload(fileList: FileList | null) {
    if (!fileList) return
    if (!selected || !canEdit) {
      setBanner({ tone: 'info', message: '현재 상태에서는 증빙을 추가할 수 없습니다.' })
      return
    }

    setBusy('upload')
    try {
      const attachments = await readEvidenceFiles(fileList, pageData.actor.name)
      updateDraft({ attachments: [...(selectedDraft?.attachments ?? []), ...attachments] })
      setBanner({ tone: 'success', message: `${attachments.length}개의 증빙을 추가했습니다.` })
      setTab('evidence')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '증빙 첨부에 실패했습니다.',
      })
    } finally {
      setBusy(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleLinkAttachmentCreate() {
    if (!selected || !selectedDraft) return
    if (!canEdit) {
      setBanner({ tone: 'info', message: '현재 상태에서는 링크 증빙을 추가할 수 없습니다.' })
      return
    }

    const nextUrl = selectedDraft.linkUrlInput.trim()
    if (!nextUrl) {
      setBanner({ tone: 'info', message: '구글 드라이브 링크를 입력해 주세요.' })
      return
    }

    if (!isAllowedMonthlyEvidenceUrl(nextUrl)) {
      setBanner({ tone: 'info', message: '구글 드라이브 링크만 등록할 수 있습니다.' })
      return
    }

    const attachment = createEvidenceLinkAttachment({
      url: nextUrl,
      comment: selectedDraft.linkCommentInput,
      uploaderName: pageData.actor.name,
    })

    updateDraft({
      attachments: [...selectedDraft.attachments, attachment],
      linkUrlInput: '',
      linkCommentInput: '',
    })
    setBanner({ tone: 'success', message: '링크 증빙을 추가했습니다.' })
    setTab('evidence')
  }

  async function saveRecord(mode: 'draft' | 'submit') {
    if (!selected || !selectedDraft) return

    if (mode === 'draft' && editDisabledReason) {
      setBanner({ tone: 'info', message: editDisabledReason })
      return
    }

    if (mode === 'submit' && submitDisabledReason) {
      setBanner({ tone: 'info', message: submitDisabledReason })
      return
    }

    if (mode === 'draft' && editDisabledReason) {
      setBanner({ tone: 'info', message: '현재 상태에서는 임시저장을 할 수 없습니다.' })
      return
    }

    if (mode === 'submit' && submitDisabledReason) {
      setBanner({ tone: 'info', message: '현재 상태에서는 제출할 수 없습니다.' })
      return
    }

    setBusy(mode === 'draft' ? 'save' : 'submit')
    try {
      const isSalesRevenue = selected.goalType === 'SALES_REVENUE'
      const actualValue =
        !isSalesRevenue && selected.type === 'QUANTITATIVE' && selectedDraft.actualValue.trim()
          ? Number(selectedDraft.actualValue)
          : undefined
      const actualAmountRaw = isSalesRevenue
        ? selectedDraft.actualAmount.replace(/,/g, '').trim()
        : undefined
      const actualAmount = actualAmountRaw || undefined

      if (
        !isSalesRevenue &&
        selected.type === 'QUANTITATIVE' &&
        selectedDraft.actualValue.trim() &&
        !Number.isFinite(actualValue)
      ) {
        throw new Error('정량 KPI는 숫자 실적값을 입력해야 합니다.')
      }

      const payload = {
        actualValue,
        actualAmount,
        activities: selectedDraft.activityNote.trim() || undefined,
        obstacles: selectedDraft.blockerNote.trim() || undefined,
        efforts: selectedDraft.effortNote.trim() || undefined,
        evidenceComment: selectedDraft.evidenceComment.trim() || undefined,
        attachments: selectedDraft.attachments,
      }

      let recordId = selected.recordId

      if (!recordId) {
        const created = await parseJsonOrThrow<{ id: string }>(
          await fetch('/api/kpi/monthly-record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalKpiId: selected.personalKpiId,
              yearMonth: pageData.selectedMonth,
              ...payload,
              isDraft: mode === 'draft',
            }),
          })
        )
        recordId = created.id
      } else {
        await parseJsonOrThrow(
          await fetch(`/api/kpi/monthly-record/${recordId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              isDraft: true,
            }),
          })
        )
      }

      if (mode === 'submit' && recordId) {
        await parseJsonOrThrow(
          await fetch(`/api/kpi/monthly-record/${recordId}/workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SUBMIT' }),
          })
        )
      }

      setBanner({
        tone: 'success',
        message: mode === 'draft' ? '월간 실적을 임시저장했습니다.' : '월간 실적을 제출했습니다.',
      })
      setSelectedId(recordId)
      handleRouteSelection({ recordId, tab })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '월간 실적 처리에 실패했습니다.',
      })
    } finally {
      setBusy(null)
    }
  }

  async function handleReview(action: 'REVIEW' | 'REQUEST_UPDATE') {
    const actionState = getReviewActionState(selected, pageData.permissions.canReview, action)
    if (actionState.disabled) {
      setBanner({ tone: 'info', message: actionState.reason ?? '현재 상태에서는 리뷰할 수 없습니다.' })
      return
    }

    if (!selected?.recordId) {
      setBanner({ tone: 'info', message: '먼저 제출된 월간 실적이 있어야 합니다.' })
      return
    }

    if (!pageData.permissions.canReview) {
      setBanner({ tone: 'info', message: '리뷰 권한이 없습니다.' })
      return
    }

    setBusy(action === 'REVIEW' ? 'review' : 'request-update')
    try {
      await parseJsonOrThrow(
        await fetch(`/api/kpi/monthly-record/${selected.recordId}/workflow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            comment: reviewComment.trim() || undefined,
          }),
        })
      )
      setBanner({
        tone: 'success',
        message: action === 'REVIEW' ? '리뷰 완료로 처리했습니다.' : '보완 요청을 남겼습니다.',
      })
      setReviewComment('')
      setTab('review')
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '리뷰 처리에 실패했습니다.',
      })
    } finally {
      setBusy(null)
    }
  }

  async function runAi(action: AiAction) {
    const actionState = aiActionStates[action]
    if (actionState?.disabled) {
      setBanner({ tone: 'info', message: actionState.reason ?? '현재 상태에서는 AI 보조를 사용할 수 없습니다.' })
      return
    }

    if (!selected || !selectedDraft) {
      setBanner({ tone: 'info', message: '먼저 KPI를 선택해 주세요.' })
      return
    }

    if (!pageData.permissions.canUseAi) {
      setBanner({ tone: 'info', message: '현재 환경에서는 AI 기능을 사용할 수 없습니다.' })
      return
    }

    setBusy('ai')
    setLastAiAction(action)
    try {
      const preview = await parseJsonOrThrow<AiPreview>(
        await fetch('/api/kpi/monthly-record/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            sourceId: selected.recordId ?? selected.personalKpiId,
            payload: {
              kpiTitle: selected.kpiTitle,
              orgKpiTitle: selected.orgKpiTitle,
              targetValue: selected.targetValue,
              actualValue:
                selected.type === 'QUANTITATIVE' && selectedDraft.actualValue.trim()
                  ? Number(selectedDraft.actualValue)
                  : undefined,
              achievementRate: selected.achievementRate,
              activityNote: selectedDraft.activityNote,
              blockerNote: selectedDraft.blockerNote,
              effortNote: selectedDraft.effortNote,
              riskFlags: selected.riskFlags,
              linkedCheckins: selected.linkedCheckins,
              attachments: selectedDraft.attachments.map((item) => ({
                type: item.type,
                name: item.name,
                kind: item.kind,
                comment: item.comment,
                url: item.type === 'LINK' ? item.url : undefined,
              })),
            },
          }),
        })
      )
      setAiPreview(preview)
      setTab('ai')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : 'AI 요청에 실패했습니다.',
      })
    } finally {
      setBusy(null)
    }
  }

  async function handleAiDecision(action: 'approve' | 'reject') {
    if (!aiPreview) return

    setBusy('ai-decision')
    try {
      await parseJsonOrThrow(
        await fetch(`/api/ai/request-logs/${encodeURIComponent(aiPreview.requestLogId)}/decision`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            approvedPayload: action === 'approve' ? aiPreview.result : undefined,
            rejectionReason:
              action === 'reject' ? 'Monthly KPI AI suggestion dismissed by operator.' : undefined,
          }),
        })
      )

      if (action === 'reject') {
        setAiPreview(null)
        setBanner({ tone: 'info', message: 'AI 제안을 반려했습니다.' })
        return
      }

      if (selectedDraft) {
        if (lastAiAction === 'generate-summary') {
          updateDraft({ activityNote: getString(aiPreview.result.summary, selectedDraft.activityNote) })
        }
        if (lastAiAction === 'explain-risk') {
          updateDraft({
            blockerNote: getString(aiPreview.result.causeSummary, selectedDraft.blockerNote),
            effortNote:
              getStringArray(aiPreview.result.responsePoints).join('\n') || selectedDraft.effortNote,
          })
        }
        if (lastAiAction === 'generate-review') {
          setReviewComment(getString(aiPreview.result.comment, reviewComment))
        }
        if (lastAiAction === 'summarize-evidence') {
          updateDraft({ activityNote: getString(aiPreview.result.summary, selectedDraft.activityNote) })
        }
        if (lastAiAction === 'generate-retrospective') {
          updateDraft({
            effortNote:
              getStringArray(aiPreview.result.nextMonthPriorities).join('\n') ||
              getString(aiPreview.result.summary, selectedDraft.effortNote),
          })
        }
        if (lastAiAction === 'suggest-checkin-agenda') {
          updateDraft({
            effortNote:
              getStringArray(aiPreview.result.agenda).join('\n') || selectedDraft.effortNote,
          })
        }
        if (lastAiAction === 'summarize-evaluation-evidence') {
          updateDraft({
            activityNote: getString(aiPreview.result.summary, selectedDraft.activityNote),
          })
        }
      }

      setAiPreview(null)
      setBanner({ tone: 'success', message: 'AI 미리보기를 화면 초안에 반영했습니다. 저장은 사용자가 직접 진행해야 합니다.' })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : 'AI 결정 처리에 실패했습니다.',
      })
    } finally {
      setBusy(null)
    }
  }

  function handleCopyPreviousMonth() {
    if (!selected || !selected.previousRecord || !canEdit) {
      setBanner({
        tone: 'info',
        message: selected?.previousRecord
          ? '현재 상태에서는 이전월 값을 불러올 수 없습니다.'
          : '불러올 이전월 값이 없습니다.',
      })
      return
    }

    updateDraft({
      actualValue:
        typeof selected.previousRecord.actualValue === 'number' ||
        typeof selected.previousRecord.actualValue === 'string'
          ? String(selected.previousRecord.actualValue)
          : selectedDraft?.actualValue ?? '',
      activityNote: selected.previousRecord.activities ?? selectedDraft?.activityNote ?? '',
    })
    setBanner({ tone: 'success', message: '선택한 KPI에 지난달 값을 불러왔습니다.' })
  }

  const loadAlerts = pageData.alerts?.length ? <LoadAlerts alerts={pageData.alerts} /> : null

  if (pageData.state !== 'ready') {
    if (pageData.state === 'no-target' || pageData.state === 'setup-required') {
      const title =
        pageData.state === 'no-target'
          ? '조회할 대상자를 먼저 선택해 주세요'
          : '월간 실적 운영 설정이 더 필요합니다'

      return (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
              Monthly Performance Operations
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{monthContext.screenTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">{monthContext.fullLabel} 기준 대상을 다시 선택해 월간 실적 화면을 준비합니다.</p>
          </section>
          <RecoveryScopeControls
            pageData={pageData}
            onChangeYear={(year) => handleRouteSelection({ year, tab: 'entry', recordId: '' })}
            onChangeMonth={(month) => handleRouteSelection({ month, tab: 'entry', recordId: '' })}
            onChangeScope={(scope) => handleRouteSelection({ scope, tab: 'entry', recordId: '' })}
            onChangeEmployee={(employeeId) => handleRouteSelection({ scope: 'employee', employeeId, tab: 'entry', recordId: '' })}
          />
          {loadAlerts}
          <StatePanel tone="neutral" title={title} message={pageData.message || '현재 상태를 다시 확인해 주세요.'} />
        </div>
      )
    }

    const title =
      pageData.state === 'permission-denied'
        ? '월간 실적에 접근할 수 없습니다'
        : pageData.state === 'error'
          ? '월간 실적을 불러오지 못했습니다'
          : '월간 실적 데이터가 없습니다'

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
            Monthly Performance Operations
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{monthContext.screenTitle}</h1>
          <p className="mt-2 text-sm text-slate-500">{monthContext.fullLabel} 기준 월간 실적 상태를 확인하고 있습니다.</p>
        </section>
        {loadAlerts}
        <StatePanel
          tone={pageData.state === 'error' || pageData.state === 'permission-denied' ? 'danger' : 'neutral'}
          title={title}
          message={pageData.message || '현재 상태를 다시 확인해 주세요.'}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleAttachmentUpload(event.target.files)}
      />

      {loadAlerts}

      {banner ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            banner.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : banner.tone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          {banner.message}
        </div>
      ) : null}

      <MonthlyWorkspaceHeader
        monthContext={monthContext}
        pageData={pageData}
        canChangeTargetScope={canChangeTargetScope}
        targetContextLabel={targetContextLabel}
        advancedFiltersOpen={advancedFiltersOpen}
        setAdvancedFiltersOpen={setAdvancedFiltersOpen}
        submitValidationSummary={submitValidation.summary}
        submitRecommendationReasons={submitValidation.recommendationReasons}
        midCheckScheduleGuidance={midCheckScheduleGuidance2026}
        tab={tab}
        setTab={setTab}
        setFilters={setFilters}
        handleRouteSelection={handleRouteSelection}
      />

      {tab === 'entry' ? (
        <EntryTab
          monthContext={monthContext}
          pageData={pageData}
          canChangeTargetScope={canChangeTargetScope}
          targetContextLabel={targetContextLabel}
          advancedFiltersOpen={advancedFiltersOpen}
          setAdvancedFiltersOpen={setAdvancedFiltersOpen}
          submitValidationSummary={submitValidation.summary}
          submitRecommendationReasons={submitValidation.recommendationReasons}
          midCheckScheduleGuidance={midCheckScheduleGuidance2026}
          allRecords={pageData.records}
          summary={pageData.summary}
          visibleRecords={visibleRecords}
          filters={filters}
          setFilters={setFilters}
          selected={selected}
          setSelectedId={setSelectedId}
          selectedDraft={selectedDraft}
          canEdit={canEdit}
          editDisabledReason={editDisabledReason}
          submitDisabledReason={submitDisabledReason}
          reviewActionState={reviewActionState}
          requestUpdateActionState={requestUpdateActionState}
          showGenerateSummaryAction={canUseMonthlyCommentDraft}
          generateSummaryActionState={aiActionStates['generate-summary']}
          uploadDisabledReason={uploadDisabledReason}
          busy={busy}
          updateDraft={updateDraft}
          reviewComment={reviewComment}
          setReviewComment={setReviewComment}
          canReview={pageData.permissions.canReview}
          onSaveDraft={() => void saveRecord('draft')}
          onSubmit={() => void saveRecord('submit')}
          onReview={() => void handleReview('REVIEW')}
          onRequestUpdate={() => void handleReview('REQUEST_UPDATE')}
          onCopyPreviousMonth={handleCopyPreviousMonth}
          copyPreviousReason={copyPreviousReason}
          handleRouteSelection={handleRouteSelection}
          onAddLinkAttachment={() => handleLinkAttachmentCreate()}
          onUploadClick={() => {
            if (!canEdit) {
              setBanner({ tone: 'info', message: '현재 상태에서는 증빙을 추가할 수 없습니다.' })
              return
            }
            fileInputRef.current?.click()
          }}
          onAttachmentDownload={(attachment) =>
            downloadEvidenceAttachment(attachment, (message) => setBanner({ tone: 'info', message }))
          }
          onAttachmentRemove={(attachmentId) =>
            updateDraft({
              attachments: (selectedDraft?.attachments ?? []).filter((item) => item.id !== attachmentId),
            })
          }
          onRunAi={() => void runAi('generate-summary')}
          onShowEvidence={() => setTab('evidence')}
          onShowHistory={() => setTab('review')}
          onShowAi={() => setTab('ai')}
        />
      ) : null}

      {tab === 'trend' ? (
        <TrendTab selectedTrend={selectedTrend} selectedMonth={pageData.selectedMonth} monthContext={monthContext} />
      ) : null}

      {tab === 'review' ? (
        <ReviewTab reviews={pageData.reviews} history={selected?.history ?? []} monthContext={monthContext} />
      ) : null}

      {tab === 'evidence' ? (
        <EvidenceTab
          monthContext={monthContext}
          evidence={pageData.evidence}
          onDownload={(attachment) =>
            downloadEvidenceAttachment(attachment, (message) => setBanner({ tone: 'info', message }))
          }
        />
      ) : null}

      {tab === 'ai' ? (
        <AiTab
          aiLogs={pageData.aiLogs}
          aiPreview={aiPreview}
          lastAiAction={lastAiAction}
          monthContext={monthContext}
          visibleActions={visibleAiActions}
          actionStates={aiActionStates}
          busy={busy}
          onRunAi={(action) => void runAi(action)}
          onApprove={() => void handleAiDecision('approve')}
          onReject={() => void handleAiDecision('reject')}
        />
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">관련 화면 바로가기</div>
        <div className="flex flex-wrap gap-3">
          {[
            ['/kpi/personal', '개인 KPI'],
            ['/checkin', '체크인'],
            ['/evaluation/results', '평가 결과'],
            ['/evaluation/workbench', '평가 워크벤치 미리보기'],
            ['/notifications', '알림'],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function EntryTab({
  monthContext,
  pageData,
  canChangeTargetScope,
  targetContextLabel,
  advancedFiltersOpen,
  setAdvancedFiltersOpen,
  submitValidationSummary,
  submitRecommendationReasons,
  midCheckScheduleGuidance,
  allRecords,
  summary,
  visibleRecords,
  filters,
  setFilters,
  selected,
  setSelectedId,
  selectedDraft,
  canEdit,
  editDisabledReason,
  submitDisabledReason,
  reviewActionState,
  requestUpdateActionState,
  showGenerateSummaryAction,
  generateSummaryActionState,
  uploadDisabledReason,
  busy,
  updateDraft,
  reviewComment,
  setReviewComment,
  canReview,
  onSaveDraft,
  onSubmit,
  onReview,
  onRequestUpdate,
  onCopyPreviousMonth,
  copyPreviousReason,
  handleRouteSelection,
  onAddLinkAttachment,
  onUploadClick,
  onAttachmentDownload,
  onAttachmentRemove,
  onRunAi,
  onShowEvidence,
  onShowHistory,
  onShowAi,
}: {
  monthContext: ReturnType<typeof parseYearMonth>
  pageData: MonthlyPageData
  canChangeTargetScope: boolean
  targetContextLabel: string
  advancedFiltersOpen: boolean
  setAdvancedFiltersOpen: Dispatch<SetStateAction<boolean>>
  submitValidationSummary?: string
  submitRecommendationReasons: string[]
  midCheckScheduleGuidance: ReturnType<typeof getMonthlyMidCheckScheduleGuidance>
  allRecords: MonthlyRecordViewModel[]
  summary: MonthlyPageData['summary']
  visibleRecords: MonthlyRecordViewModel[]
  filters: FilterState
  setFilters: Dispatch<SetStateAction<FilterState>>
  selected: MonthlyRecordViewModel | null
  setSelectedId: (id: string) => void
  selectedDraft: Draft | null
  canEdit: boolean
  editDisabledReason?: string
  submitDisabledReason?: string
  reviewActionState: ActionState
  requestUpdateActionState: ActionState
  showGenerateSummaryAction: boolean
  generateSummaryActionState: ActionState
  uploadDisabledReason?: string
  busy: BusyState
  updateDraft: (patch: Partial<Draft>) => void
  reviewComment: string
  setReviewComment: (value: string) => void
  canReview: boolean
  onSaveDraft: () => void
  onSubmit: () => void
  onReview: () => void
  onRequestUpdate: () => void
  onCopyPreviousMonth: () => void
  copyPreviousReason?: string
  handleRouteSelection: (next: {
    year?: number
    month?: string
    scope?: string
    employeeId?: string
    tab?: TabKey
    recordId?: string
  }) => void
  onAddLinkAttachment: () => void
  onUploadClick: () => void
  onAttachmentDownload: (attachment: MonthlyAttachmentViewModel) => void
  onAttachmentRemove: (attachmentId: string) => void
  onRunAi: () => void
  onShowEvidence: () => void
  onShowHistory: () => void
  onShowAi: () => void
}) {
  const totalCount = allRecords.length
  const completedCount = allRecords.filter((record) => ['SUBMITTED', 'REVIEWED', 'LOCKED'].includes(record.status)).length
  const inputNeededCount = summary.missingCount
  const riskCount = summary.riskyCount
  const reviewPendingCount = summary.reviewPendingCount
  const selectedProgress = Math.min(100, Math.max(0, selected?.achievementRate ?? 0))
  const selectedTone: 'good' | 'warning' | 'danger' = selected?.riskFlags.length
    ? 'danger'
    : selectedProgress >= 80
      ? 'good'
      : 'warning'
  const selectedActualValue =
    selected?.goalType === 'SALES_REVENUE'
      ? (() => {
          const draftAmt = selectedDraft?.actualAmount.trim()
          if (draftAmt) return draftAmt + ' 원'
          return selected?.actualAmount ? formatActualAmount(selected.actualAmount) + ' 원' : '-'
        })()
      : selectedDraft?.actualValue.trim() ||
        (typeof selected?.actualValue === 'number' || typeof selected?.actualValue === 'string'
          ? String(selected.actualValue)
          : '-')
  const [detailedFiltersOpen, setDetailedFiltersOpen] = useState(false)
  const detailedFiltersDefaultVisible = canReview || totalCount >= 8
  const showDetailedFilters = detailedFiltersDefaultVisible || detailedFiltersOpen
  const hasDetailedFilters =
    filters.search.trim().length > 0 ||
    filters.status !== 'ALL' ||
    filters.risk !== 'ALL' ||
    filters.type !== 'ALL' ||
    filters.review !== 'ALL'

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.95fr)] xl:items-start">
      <section className="space-y-3">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="hidden border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/60 to-slate-50 px-5 py-5 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                  <ClipboardList className="h-4 w-4" />
                  월간 KPI 작업 영역
                </p>
                <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950">{monthContext.fullLabel} 월간 실적</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  먼저 상태를 훑고, 입력이 필요한 KPI만 선택해 한 줄 진행 요약부터 남기세요.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, status: 'NOT_STARTED' }))}
                  className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50"
                >
                  입력 필요만 보기
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, risk: 'RISK' }))}
                  className="rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                >
                  위험 KPI만 보기
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {monthContext.fullLabel}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        pageData.summary.overallStatus === 'MIXED'
                          ? 'bg-slate-100 text-slate-700'
                          : STATUS_CLASS[pageData.summary.overallStatus]
                      }`}
                    >
                      {pageData.summary.overallStatus === 'MIXED'
                        ? '혼합 상태'
                        : STATUS_LABELS[pageData.summary.overallStatus]}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      {canChangeTargetScope ? `대상: ${targetContextLabel}` : `내 실적 · ${targetContextLabel}`}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      리뷰 대기 {formatCountWithUnit(reviewPendingCount, '개')}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        submitValidationSummary ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {submitValidationSummary ? '제출 전 확인 필요' : '제출 가능 상태'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    월과 대상은 여기서 바꾸고, 세부 조건은 필요할 때만 펼쳐 확인합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvancedFiltersOpen((value) => !value)}
                  aria-expanded={advancedFiltersOpen}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  {advancedFiltersOpen ? '월/대상 설정 닫기' : '월/대상 설정'}
                </button>
              </div>

              <div className="mt-3">
                <MonthQuickSwitch
                  selectedYear={pageData.selectedYear}
                  selectedMonth={pageData.selectedMonth}
                  onChange={(month) => handleRouteSelection({ month, tab: 'entry', recordId: '' })}
                />
              </div>

              {advancedFiltersOpen ? (
                <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">연도</span>
                    <select
                      value={String(pageData.selectedYear)}
                      onChange={(event) => handleRouteSelection({ year: Number(event.target.value), tab: 'entry', recordId: '' })}
                      className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                    >
                      {pageData.availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-500">월</span>
                    <select
                      value={pageData.selectedMonth}
                      onChange={(event) => handleRouteSelection({ month: event.target.value, tab: 'entry', recordId: '' })}
                      className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                    >
                      {Array.from({ length: 12 }, (_, index) => {
                        const value = `${pageData.selectedYear}-${String(index + 1).padStart(2, '0')}`
                        return (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  {canChangeTargetScope ? (
                    <>
                      <label className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">대상 범위</span>
                        <select
                          value={pageData.selectedScope}
                          onChange={(event) => handleRouteSelection({ scope: event.target.value, tab: 'entry', recordId: '' })}
                          className="min-h-9 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                        >
                          <option value="self">내 실적</option>
                          <option value="team">우리 팀</option>
                          <option value="employee">특정 구성원</option>
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[11px] font-medium text-slate-500">대상자</span>
                        <MonthlyEmployeeSearchCombo
                          options={pageData.employeeOptions}
                          value={pageData.selectedEmployeeId}
                          disabled={pageData.selectedScope === 'self'}
                          onChange={(employeeId) =>
                            handleRouteSelection({ scope: 'employee', employeeId, tab: 'entry', recordId: '' })
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 sm:col-span-2">
                      내 실적 · {targetContextLabel}
                    </div>
                  )}
                </div>
              ) : null}

              {submitValidationSummary ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                  <span className="font-semibold">제출 차단:</span> {submitValidationSummary}
                </p>
              ) : null}
              {submitRecommendationReasons.length ? (
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  {submitRecommendationReasons.join(' ')}
                </p>
              ) : null}

              <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-700">
                  2026 중간 점검 schedule guidance
                </summary>
                <p className="mt-2 leading-5">{midCheckScheduleGuidance.message}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {midCheckScheduleGuidance.window.plannedRangeLabel} · 저장/제출을 강제하지 않는 안내입니다.
                </p>
              </details>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">이번 달 먼저 할 일</h3>
                  <p className="text-xs text-slate-500">긴 보고서보다 필요한 KPI부터 짧게 정리합니다.</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                  핵심 행동 4개
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <NextActionCard
                  icon={<ClipboardList className="h-4 w-4" />}
                  label="미입력 KPI 채우기"
                  description="한 줄 진행 요약부터 남깁니다."
                  done={inputNeededCount === 0}
                  tone={inputNeededCount > 0 ? 'danger' : 'neutral'}
                  onClick={() => setFilters((current) => ({ ...current, status: 'NOT_STARTED' }))}
                />
                <NextActionCard
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="위험 KPI 보완"
                  description="리스크 원인과 대응만 정리합니다."
                  done={riskCount === 0}
                  tone={riskCount > 0 ? 'danger' : 'neutral'}
                  onClick={() => setFilters((current) => ({ ...current, risk: 'RISK' }))}
                />
                <NextActionCard
                  icon={<Paperclip className="h-4 w-4" />}
                  label="증빙 추가"
                  description="링크나 짧은 메모부터 연결합니다."
                  done={summary.attachmentCount > 0}
                  onClick={onShowEvidence}
                />
                <NextActionCard
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="상사 리뷰 확인"
                  description="리뷰 대기와 보완 요청을 확인합니다."
                  done={reviewPendingCount === 0}
                  tone={reviewPendingCount > 0 ? 'warning' : 'neutral'}
                  onClick={onShowHistory}
                />
              </div>
            </div>

            <PmsMetricRail
              className="mt-4"
              items={[
                {
                  icon: <ClipboardList className="h-5 w-5" />,
                  label: '전체 KPI',
                  value: formatCountWithUnit(totalCount, '개'),
                  helper: '이번 달 기록 대상 KPI',
                  chip: '전체',
                },
                {
                  icon: <CheckCircle2 className="h-5 w-5" />,
                  label: '입력 완료',
                  value: formatCountWithUnit(completedCount, '개'),
                  helper: `${summary.submissionRate}% 제출 기준`,
                  chip: '진행',
                  tone: completedCount > 0 ? 'good' : 'neutral',
                },
                {
                  icon: <ListChecks className="h-5 w-5" />,
                  label: '입력 필요',
                  value: formatCountWithUnit(inputNeededCount, '개'),
                  helper: '한 줄 요약부터 작성',
                  chip: inputNeededCount ? '확인 필요' : '완료',
                  tone: inputNeededCount ? 'warning' : 'good',
                },
                {
                  icon: <AlertTriangle className="h-5 w-5" />,
                  label: '위험 KPI',
                  value: formatCountWithUnit(riskCount, '개'),
                  helper: '원인과 대응만 짧게 보완',
                  chip: riskCount ? '리스크' : '안정',
                  tone: riskCount ? 'danger' : 'good',
                },
              ]}
            />
          </div>

          {showDetailedFilters ? (
          <div className="border-b border-slate-100 bg-white px-5 py-4 lg:px-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_repeat(4,minmax(120px,0.7fr))_auto] lg:items-end">
              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-500">검색</span>
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="KPI명, 연결 조직 KPI, 유형 검색"
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </label>
              <FilterSelect
                label="상태"
                value={filters.status}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                options={[
                  ['ALL', '전체'],
                  ['NOT_STARTED', '미시작'],
                  ['DRAFT', '임시저장'],
                  ['SUBMITTED', '제출됨'],
                  ['REVIEWED', '리뷰 완료'],
                  ['LOCKED', '잠금'],
                ]}
              />
              <FilterSelect
                label="위험"
                value={filters.risk}
                onChange={(value) => setFilters((current) => ({ ...current, risk: value }))}
                options={[
                  ['ALL', '전체'],
                  ['RISK', '위험만'],
                  ['SAFE', '안정만'],
                ]}
              />
              <FilterSelect
                label="유형"
                value={filters.type}
                onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
                options={[
                  ['ALL', '전체'],
                  ['QUANTITATIVE', '정량'],
                  ['QUALITATIVE', '정성'],
                ]}
              />
              <FilterSelect
                label="리뷰"
                value={filters.review}
                onChange={(value) => setFilters((current) => ({ ...current, review: value }))}
                options={[
                  ['ALL', '전체'],
                  ['PENDING', '리뷰 대기'],
                  ['REVIEWED', '리뷰 있음'],
                ]}
              />
              <Button onClick={() => setFilters({ ...DEFAULT_FILTERS })}>초기화</Button>
            </div>
          </div>
          ) : null}

          <div className="px-5 py-4 lg:px-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-950">월간 KPI 입력 카드</p>
                <p className="text-xs text-slate-500">
                  선택된 KPI는 오른쪽 상세 패널에 바로 표시됩니다.
                  {!detailedFiltersDefaultVisible ? ' 상세 필터는 필요할 때만 펼쳐 사용하세요.' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasDetailedFilters ? (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    필터 초기화
                  </button>
                ) : null}
                {!detailedFiltersDefaultVisible ? (
                  <button
                    type="button"
                    onClick={() => setDetailedFiltersOpen((value) => !value)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {detailedFiltersOpen ? '상세 필터 닫기' : '상세 필터'}
                  </button>
                ) : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  표시 {formatCountWithUnit(visibleRecords.length, '개')}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {visibleRecords.length ? (
                visibleRecords.map((record) => {
                  const isSelected = record.id === selected?.id
                  const progress = Math.min(100, Math.max(0, record.achievementRate ?? 0))
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelectedId(record.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-2 ring-blue-100'
                          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_120px] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[record.status]}`}>
                              {STATUS_LABELS[record.status]}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              {record.type === 'QUANTITATIVE' ? '정량' : '정성'}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                record.riskFlags.length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {record.riskFlags.length ? '위험 KPI' : '안정'}
                            </span>
                          </div>
                          <div className="mt-2 truncate text-sm font-bold text-slate-950">{record.kpiTitle}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>목표 {record.goalType === 'SALES_REVENUE'
                              ? (record.targetAmount ? formatActualAmount(record.targetAmount) + ' 원' : '-')
                              : (record.targetValue ?? '-')
                            }</span>
                            {record.orgKpiTitle ? (
                              <span className="inline-flex items-center gap-1 text-blue-700">
                                <Link2 className="h-3.5 w-3.5" />
                                {record.orgKpiTitle}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>달성률</span>
                            <span className="text-slate-700">{formatPercent(record.achievementRate)}</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${
                                record.riskFlags.length ? 'bg-rose-400' : progress >= 80 ? 'bg-emerald-400' : 'bg-blue-400'
                              }`}
                              style={{ width: `${Math.max(3, progress)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 lg:justify-end">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            증빙 {formatCountWithUnit(record.attachments.length, '건')}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              record.reviewComment ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {record.reviewComment ? '리뷰 있음' : '리뷰 대기'}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center">
                  <MonthlyEmptyIllustration />
                  <p className="mt-3 text-sm font-semibold text-slate-900">{monthContext.fullLabel} 기준 조건에 맞는 월간 실적이 없습니다.</p>
                  <p className="mt-1 text-xs text-slate-500">필터를 초기화하거나 다른 월을 선택해 주세요.</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-4">
              {[
                ['입력 완료', `${completedCount}개`, 'bg-emerald-100 text-emerald-700'],
                ['입력 필요', `${inputNeededCount}개`, 'bg-amber-100 text-amber-800'],
                ['위험 KPI', `${riskCount}개`, 'bg-rose-100 text-rose-700'],
                ['리뷰 대기', `${reviewPendingCount}개`, 'bg-slate-200 text-slate-700'],
              ].map(([label, value, className]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className={`rounded-full px-2 py-0.5 font-bold ${className}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="overflow-hidden rounded-[32px] border border-blue-100 bg-white shadow-lg shadow-blue-100/40 xl:sticky xl:top-3">
        <div className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 px-5 py-5 lg:px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
            <MessageSquare className="h-4 w-4" />
            선택 KPI 월간 입력 상세
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-950">
            {selected ? selected.kpiTitle : `${monthContext.fullLabel} 입력 상세`}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            핵심 입력은 한 줄 진행 요약입니다. 장애요인, 극복 노력, 증빙은 필요한 경우에만 보완하세요.
          </p>
        </div>

        {selected && selectedDraft ? (
          <div className="space-y-4 p-5 lg:p-5">
            <div className="grid gap-4 md:grid-cols-[132px_minmax(0,1fr)] md:items-center xl:grid-cols-1 2xl:grid-cols-[132px_minmax(0,1fr)]">
              <MonthlyProgressRing value={selected.achievementRate} label="달성률" tone={selectedTone} />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selected.riskFlags.length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {selected.riskFlags.length ? '위험 확인' : '안정'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {selected.type === 'QUANTITATIVE' ? '정량 KPI' : '정성 KPI'}
                  </span>
                </div>
                <div className="text-sm leading-6 text-slate-600">
                  {selected.employeeName} / {selected.departmentName} / {monthContext.fullLabel}
                </div>
                {selected.orgKpiTitle ? (
                  <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    <Link2 className="h-3.5 w-3.5" />
                    {selected.orgKpiTitle}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailMetricBox
                label="목표값"
                value={
                  selected.goalType === 'SALES_REVENUE'
                    ? (selected.targetAmount ? formatActualAmount(selected.targetAmount) + ' 원' : '-')
                    : `${selected.targetValue ?? '-'}`
                }
                helper="월간 기록 기준"
              />
              <DetailMetricBox label="실적값" value={`${selectedActualValue}`} helper="저장 전 초안 포함" />
              <DetailMetricBox label="가중치" value="KPI 기준" helper="개인 KPI 설정에서 관리" />
              <DetailMetricBox label="증빙" value={formatCountWithUnit(selectedDraft.attachments.length, '건')} helper="파일/링크 포함" />
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-2xl bg-white p-2 text-blue-700 shadow-sm">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-blue-950">핵심 입력</p>
                  <p className="mt-1 text-xs leading-5 text-blue-900/70">
                    먼저 이번 달 진행 상황을 한 줄로 남겨보세요. 숫자와 핵심 요약만 있어도 초안으로 충분합니다.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4">
                {selected.type === 'QUANTITATIVE' ? (
                  selected.goalType === 'SALES_REVENUE' ? (
                    <div className="space-y-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">{monthContext.shortLabel} 누적 매출액(원)</span>
                        <input
                          value={selectedDraft.actualAmount}
                          onChange={(event) => updateDraft({ actualAmount: formatActualAmount(event.target.value) })}
                          disabled={!canEdit}
                          inputMode="numeric"
                          placeholder="예: 150,000,000"
                          className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                        />
                      </label>
                      {(() => {
                        const raw = selectedDraft.actualAmount.replace(/,/g, '').trim()
                        const target = selected.targetAmount
                        if (!raw || !target || target === '0') return null
                        try {
                          const actualBig = BigInt(raw)
                          const targetBig = BigInt(target)
                          if (targetBig <= BigInt(0)) return null
                          const rate = Number((actualBig * BigInt(10000)) / targetBig) / 100
                          const score = calcSalesScore(targetBig, actualBig)
                          return (
                            <p className="text-xs text-slate-600">
                              달성률 {rate.toFixed(1)}% · 현재 페이스 점수 {score}점
                            </p>
                          )
                        } catch {
                          return null
                        }
                      })()}
                    </div>
                  ) : (
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">{monthContext.shortLabel} 실적값</span>
                      <input
                        value={selectedDraft.actualValue}
                        onChange={(event) => updateDraft({ actualValue: event.target.value })}
                        disabled={!canEdit}
                        inputMode="decimal"
                        className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                      />
                    </label>
                  )
                ) : null}

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {selected.type === 'QUANTITATIVE' ? `${monthContext.shortLabel} 한 줄 진행 요약` : `${monthContext.shortLabel} 진행 수준 메모`}
                  </span>
                  <textarea
                    value={selectedDraft.activityNote}
                    onChange={(event) => updateDraft({ activityNote: event.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    placeholder="예: 주요 고객사 자동화 시나리오 1차 검증을 마쳤고, 다음 달 적용 범위를 확정할 예정입니다."
                    className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-2xl bg-white p-2 text-slate-600 shadow-sm">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-950">선택 보완</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    장애요인과 지원 요청은 필요한 경우에만 보완하세요. 증빙은 링크나 짧은 메모부터 추가해도 됩니다.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">{monthContext.shortLabel} 장애요인</span>
                  <textarea
                    value={selectedDraft.blockerNote}
                    onChange={(event) => updateDraft({ blockerNote: event.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">{monthContext.shortLabel} 극복 노력</span>
                  <textarea
                    value={selectedDraft.effortNote}
                    onChange={(event) => updateDraft({ effortNote: event.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-950">증빙 첨부</p>
                  <p className="mt-1 text-xs text-slate-500">
                    증빙은 링크나 짧은 설명부터 추가해도 됩니다. 증빙 변경 사항은 임시저장 또는 제출 시 반영됩니다.
                  </p>
                </div>
                <Button
                  icon={<FilePlus2 className="h-4 w-4" />}
                  onClick={onUploadClick}
                  disabled={!canEdit}
                  title={uploadDisabledReason}
                >
                  파일 첨부
                </Button>
              </div>
              <label className="mt-4 block space-y-2">
                <span className="text-xs font-semibold text-slate-600">증빙 코멘트</span>
                <textarea
                  value={selectedDraft.evidenceComment}
                  onChange={(event) => updateDraft({ evidenceComment: event.target.value })}
                  disabled={!canEdit}
                  rows={3}
                  maxLength={1000}
                  placeholder={`${monthContext.shortLabel} 점검에 사용할 증빙 설명을 간단히 적어 주세요.`}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
                />
              </label>
              <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1.3fr_1fr_auto] xl:grid-cols-1 2xl:grid-cols-[1.3fr_1fr_auto]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-slate-600">구글 드라이브 링크</span>
                  <input
                    value={selectedDraft.linkUrlInput}
                    onChange={(event) => updateDraft({ linkUrlInput: event.target.value })}
                    disabled={!canEdit}
                    placeholder="https://drive.google.com/... 또는 https://docs.google.com/..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-slate-600">간단 코멘트</span>
                  <input
                    value={selectedDraft.linkCommentInput}
                    onChange={(event) => updateDraft({ linkCommentInput: event.target.value })}
                    disabled={!canEdit}
                    maxLength={300}
                    placeholder={`${monthContext.shortLabel} 링크 설명을 간단히 남겨 주세요.`}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    icon={<Link2 className="h-4 w-4" />}
                    onClick={onAddLinkAttachment}
                    disabled={!canEdit}
                    title={uploadDisabledReason}
                  >
                    링크 추가
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedDraft.attachments.length ? (
                  selectedDraft.attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                attachment.type === 'LINK'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {attachment.type === 'LINK' ? '링크' : '파일'}
                            </span>
                            <p className="text-sm font-semibold text-slate-900">{attachment.name}</p>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p className="break-all">
                              {attachment.kind} /{' '}
                              {attachment.type === 'LINK'
                                ? attachment.url ?? '-'
                                : attachment.sizeLabel ?? '-'}{' '}
                              / {formatDate(attachment.uploadedAt)}
                            </p>
                            {attachment.uploadedBy ? <p>등록자: {attachment.uploadedBy}</p> : null}
                          </div>
                          <label className="mt-3 block space-y-2">
                            <span className="text-xs font-semibold text-slate-600">간단 코멘트</span>
                            <input
                              value={attachment.comment ?? ''}
                              onChange={(event) =>
                                updateDraft({
                                  attachments: selectedDraft.attachments.map((item) =>
                                    item.id === attachment.id ? { ...item, comment: event.target.value } : item
                                  ),
                                })
                              }
                              disabled={!canEdit}
                              maxLength={300}
                              placeholder={`${monthContext.shortLabel} 증빙 설명을 간단히 남겨 주세요.`}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {attachment.type === 'LINK' ? (
                            <Button
                              icon={<Link2 className="h-4 w-4" />}
                              onClick={() => attachment.url && openEvidenceLink(attachment.url)}
                            >
                              열기
                            </Button>
                          ) : (
                            <Button
                              icon={<FileDown className="h-4 w-4" />}
                              onClick={() => onAttachmentDownload(attachment)}
                            >
                              다운로드
                            </Button>
                          )}
                          <Button onClick={() => onAttachmentRemove(attachment.id)} disabled={!canEdit}>
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
                    <Paperclip className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">아직 등록된 증빙이 없습니다.</p>
                    <p className="mt-1 text-xs text-slate-500">파일이나 링크를 나중에 추가해도 됩니다.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <RelatedInfoCard
                icon={<MessageSquare className="h-4 w-4" />}
                label="최근 리뷰"
                value={selected.reviewComment ? '있음' : '없음'}
                helper={selected.reviewComment ? '아래 리뷰 코멘트를 확인하세요.' : '제출 후 리뷰가 쌓입니다.'}
              />
              <RelatedInfoCard
                icon={<Paperclip className="h-4 w-4" />}
                label="증빙 항목"
                value={formatCountWithUnit(selectedDraft.attachments.length, '건')}
                helper="파일/링크 근거를 한 곳에 모읍니다."
              />
              <RelatedInfoCard
                icon={<Sparkles className="h-4 w-4" />}
                label="AI 보조"
                value="초안 보조"
                helper="AI 탭에서 초안을 생성할 수 있습니다."
                onClick={onShowAi}
              />
              <RelatedInfoCard
                icon={<ListChecks className="h-4 w-4" />}
                label="체크인"
                value={formatCountWithUnit(selected.linkedCheckins.length, '건')}
                helper="중간 점검 근거와 연결됩니다."
              />
            </div>

            {selected.personalKpiId ? (
              <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-slate-800">
                  중간 점검 참고 접어보기
                </summary>
                <div className="mt-3">
                  <MidReviewReferencePanel
                    kind="personal-kpi"
                    targetId={selected.personalKpiId}
                    title="중간 점검"
                    helper="이 KPI와 연결된 최근 중간 점검 판단, 기대 상태, 다음 기간 계획을 함께 확인합니다."
                  />
                </div>
              </details>
            ) : null}

            {selected.reviewComment ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">최근 상사 리뷰</div>
                <p className="mt-2 leading-6">{selected.reviewComment}</p>
              </div>
            ) : null}

            {canReview && selected.recordId ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">{monthContext.shortLabel} 리더 리뷰 입력</div>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={onReview}
                    disabled={busy !== null || reviewActionState.disabled}
                    title={reviewActionState.reason}
                  >
                    리뷰 완료
                  </Button>
                  <Button
                    onClick={onRequestUpdate}
                    disabled={busy !== null || requestUpdateActionState.disabled}
                    title={requestUpdateActionState.reason}
                  >
                    보완 요청
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="sticky bottom-4 z-10 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-200/70 backdrop-blur">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  icon={<Save className="h-4 w-4" />}
                  onClick={onSaveDraft}
                  disabled={!canEdit || busy !== null}
                  title={editDisabledReason}
                >
                  임시저장
                </Button>
                <Button
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  variant="primary"
                  onClick={onSubmit}
                  disabled={busy !== null || Boolean(submitDisabledReason)}
                  title={submitDisabledReason}
                >
                  제출
                </Button>
                <Button
                  icon={<History className="h-4 w-4" />}
                  onClick={onCopyPreviousMonth}
                  disabled={busy !== null || Boolean(copyPreviousReason)}
                  title={copyPreviousReason}
                >
                  이전월 값
                </Button>
                <Button
                  icon={<FilePlus2 className="h-4 w-4" />}
                  onClick={onUploadClick}
                  disabled={!canEdit}
                  title={uploadDisabledReason}
                >
                  증빙 첨부
                </Button>
                <Button icon={<History className="h-4 w-4" />} onClick={onShowHistory}>
                  이력 보기
                </Button>
                {showGenerateSummaryAction ? (
                  <Button
                    icon={<Sparkles className="h-4 w-4" />}
                    onClick={onRunAi}
                    disabled={busy !== null || generateSummaryActionState.disabled}
                    title={generateSummaryActionState.reason}
                  >
                    AI 미리보기
                  </Button>
                ) : (
                  <Link
                    href="/checkin"
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    체크인으로 이동
                  </Link>
                )}
              </div>
              {showGenerateSummaryAction ? (
                <Link
                  href="/checkin"
                  className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  체크인으로 이동
                </Link>
              ) : null}
              {submitDisabledReason ? (
                <p className="mt-2 text-xs leading-5 text-rose-700">
                  <span className="font-semibold">제출 차단:</span> {submitDisabledReason}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-5 lg:p-6">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center">
              <MonthlyEmptyIllustration />
              <p className="mt-3 text-sm font-semibold text-slate-900">{monthContext.fullLabel}에 입력할 KPI를 선택해 주세요.</p>
              <p className="mt-1 text-xs text-slate-500">왼쪽 KPI 카드에서 항목을 선택하면 상세 입력 패널이 열립니다.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function TrendTab({
  selectedTrend,
  selectedMonth,
  monthContext,
}: {
  selectedTrend: MonthlyPageData['trends'][number] | null | undefined
  selectedMonth: string
  monthContext: ReturnType<typeof parseYearMonth>
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">누적 추이</h2>
        <p className="mt-1 text-sm text-slate-500">최근 12개월 기준으로 KPI별 달성률 추이를 보여줍니다.</p>
      </div>
      {selectedTrend ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">{selectedTrend.kpiTitle}</div>
          <div className="mt-1 text-xs text-slate-500">
            평균 {formatPercent(selectedTrend.average)} / 최고 {formatPercent(selectedTrend.highest)} / 최저{' '}
            {formatPercent(selectedTrend.lowest)}
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2 lg:grid-cols-12">
            {selectedTrend.points.slice(-12).map((point) => {
              const peak = Math.max(...selectedTrend.points.map((item) => item.achievementRate ?? 0), 100)
              const height = Math.max(10, Math.round(((point.achievementRate ?? 0) / peak) * 100))
              return (
                <div key={point.month} className="flex flex-col items-center gap-2">
                  <div className="flex h-32 items-end">
                    <div
                      className={`w-6 rounded-t-lg ${
                        point.month === selectedMonth ? 'bg-slate-900' : 'bg-slate-300'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">{point.month.split('-')[1]}월</div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-slate-900">추이를 볼 KPI가 없습니다.</p>
        </div>
      )}
    </section>
  )
}

function ReviewTab({
  reviews,
  history,
  monthContext,
}: {
  reviews: MonthlyPageData['reviews']
  history: MonthlyRecordViewModel['history']
  monthContext: ReturnType<typeof parseYearMonth>
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">리뷰 / 피드백</h2>
          <p className="mt-1 text-sm text-slate-500">상사 리뷰와 보완 요청 이력을 확인합니다.</p>
        </div>
        <div className="space-y-3">
          {reviews.length ? (
            reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{review.kpiTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {review.reviewerName} / {formatDate(review.reviewedAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      review.status === 'REQUEST_UPDATE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {review.status === 'REQUEST_UPDATE' ? '보완 요청' : '리뷰 완료'}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{review.comment}</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">이번 달 리뷰 코멘트가 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">변경 / 제출 이력</h2>
          <p className="mt-1 text-sm text-slate-500">선택 KPI 기준 최근 변경 이력을 보여줍니다.</p>
        </div>
        {history.length ? (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div key={item.id} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold text-slate-900">{item.action}</div>
                    <div className="text-xs text-slate-500">{formatDate(item.at)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.actor}</div>
                  {item.detail ? <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">선택한 KPI의 이력이 없습니다.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function EvidenceTab({
  monthContext,
  evidence,
  onDownload,
}: {
  monthContext: ReturnType<typeof parseYearMonth>
  evidence: MonthlyPageData['evidence']
  onDownload: (attachment: MonthlyAttachmentViewModel) => void
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">증빙 항목 / 근거 자료</h2>
        <p className="mt-1 text-sm text-slate-500">
          KPI별 증빙을 한 곳에서 확인하고 파일 또는 링크를 바로 열 수 있습니다.
        </p>
      </div>

      <div className="space-y-3">
        {evidence.length ? (
          evidence.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.type === 'LINK' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.type === 'LINK' ? '링크' : '파일'}
                  </span>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p className="break-all">
                    {item.kpiTitle} / {item.kind} /{' '}
                    {item.type === 'LINK' ? item.url ?? '-' : item.sizeLabel ?? '-'} / {formatDate(item.uploadedAt)}
                  </p>
                  {item.comment ? <p>{item.comment}</p> : null}
                </div>
              </div>
              {item.type === 'LINK' ? (
                <Button icon={<Link2 className="h-4 w-4" />} onClick={() => item.url && openEvidenceLink(item.url)}>
                  열기
                </Button>
              ) : (
                <Button icon={<FileDown className="h-4 w-4" />} onClick={() => onDownload(item)}>
                  다운로드
                </Button>
              )}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">등록된 증빙 항목이 없습니다.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function AiTab({
  aiLogs,
  aiPreview,
  lastAiAction,
  monthContext,
  visibleActions,
  actionStates,
  busy,
  onRunAi,
  onApprove,
  onReject,
}: {
  aiLogs: MonthlyPageData['aiLogs']
  aiPreview: AiPreview | null
  lastAiAction: AiAction
  monthContext: ReturnType<typeof parseYearMonth>
  visibleActions: AiAction[]
  actionStates: Record<AiAction, ActionState>
  busy: BusyState
  onRunAi: (action: AiAction) => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] xl:items-start">
      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
            <Sparkles className="h-4 w-4" />
            월간 실적 AI 보조
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">필요한 초안만 선택하세요</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            구성원에게는 요약과 체크인 준비 중심으로, 직책자에게는 관리 범위 리뷰 보조만 노출됩니다.
            AI 결과는 저장 전 초안이며 공식 평가 점수나 등급을 산정하지 않습니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {visibleActions.map((action) => {
            const leaderOnly = LEADER_ONLY_MONTHLY_AI_ACTION_IDS.has(action)
            return (
              <button
                key={action}
                type="button"
                onClick={() => onRunAi(action)}
                disabled={busy !== null || actionStates[action]?.disabled}
                title={actionStates[action]?.reason}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md disabled:translate-y-0 disabled:opacity-60 disabled:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
                    <Bot className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{AI_LABELS[action]}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          leaderOnly ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {leaderOnly ? '직책자용' : '구성원용'}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{AI_DESCRIPTIONS[action]}</span>
                    {actionStates[action]?.reason ? (
                      <span className="mt-2 block text-xs text-slate-500">{actionStates[action]?.reason}</span>
                    ) : null}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-6 space-y-3">
          {aiLogs.length ? (
            aiLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{log.sourceType}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(log.createdAt)} / {log.requesterName}
                </p>
                <p className="mt-2 text-sm text-slate-700">{log.summary}</p>
              </div>
            ))
          ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">AI 사용 이력이 없습니다.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">필요할 때만 초안을 생성하고, 저장 여부는 사용자가 직접 결정합니다.</p>
          </div>
        )}
      </div>
      </section>

      <section className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm lg:p-6 xl:sticky xl:top-4">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Sparkles className="h-4 w-4" />
            저장 전 초안
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">AI 미리보기</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">결과를 확인한 뒤 화면 초안에 반영하거나 반려할 수 있습니다.</p>
        </div>
        {aiPreview ? (
          <div className="space-y-4">
            {aiPreview.fallbackReason ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                fallback 사유: {aiPreview.fallbackReason}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Bot className="h-4 w-4 text-slate-500" />
                {AI_LABELS[lastAiAction]}
              </div>
              <KpiAiPreviewPanel
                preview={{
                  action: lastAiAction,
                  actionLabel: AI_LABELS[lastAiAction],
                  source: aiPreview.source,
                  fallbackReason: aiPreview.fallbackReason,
                  result: aiPreview.result,
                }}
                emptyTitle="AI 미리보기가 아직 없습니다."
                emptyDescription="AI 보조 기능을 실행하면 이 영역에 미리보기가 표시됩니다."
                onApprove={onApprove}
                onReject={onReject}
                approveLabel="화면 초안에 반영"
                rejectLabel="반려"
                decisionBusy={busy === 'ai-decision'}
              />
            </div>
            <div className="hidden flex-wrap gap-2">
              <Button onClick={onReject} disabled={busy === 'ai-decision'}>
                반려
              </Button>
              <Button variant="primary" onClick={onApprove} disabled={busy === 'ai-decision'}>
                화면 초안에 반영
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-blue-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-10 text-center">
            <MonthlyEmptyIllustration />
            <p className="mt-4 text-sm font-semibold text-slate-900">아직 생성된 AI 미리보기가 없습니다.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              왼쪽에서 필요한 보조 기능을 선택하면 초안을 확인할 수 있습니다. 실제 저장과 제출은 사용자가 직접 진행합니다.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  )
}

