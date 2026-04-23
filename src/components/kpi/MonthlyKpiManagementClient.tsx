'use client'

import Link from 'next/link'
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  CheckCircle2,
  FileDown,
  FilePlus2,
  History,
  Link2,
  Paperclip,
  Save,
  Sparkles,
} from 'lucide-react'
import { KpiAiPreviewPanel } from '@/components/kpi/KpiAiPreviewPanel'
import { MidReviewReferencePanel } from '@/components/mid-review/MidReviewReferencePanel'
import { getMonthlyLinkDisplayName, isAllowedMonthlyEvidenceUrl } from '@/lib/monthly-attachments'
import { formatCountWithUnit, formatRateBaseCopy } from '@/lib/metric-copy'
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
}
type Draft = {
  actualValue: string
  activityNote: string
  blockerNote: string
  effortNote: string
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

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'entry', label: '입력' },
  { key: 'trend', label: '누적 추이' },
  { key: 'review', label: '리뷰/피드백' },
  { key: 'evidence', label: '증빙 항목' },
  { key: 'ai', label: 'AI 보조' },
]

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

const DEFAULT_FILTERS: FilterState = {
  status: 'ALL',
  risk: 'ALL',
  type: 'ALL',
  review: 'ALL',
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
  selected: MonthlyRecordViewModel | null
  selectedDraft: Draft | null
  canReview: boolean
}): ActionState {
  const { action, canUseAi, selected, selectedDraft, canReview } = params

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

function toRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : null)).filter((item): item is string => Boolean(item))
    : []
}

function createDraft(record: MonthlyRecordViewModel): Draft {
  return {
    actualValue:
      typeof record.actualValue === 'number' || typeof record.actualValue === 'string'
        ? String(record.actualValue)
        : '',
    activityNote: record.activityNote ?? '',
    blockerNote: record.blockerNote ?? '',
    effortNote: record.effortNote ?? '',
    attachments: record.attachments ?? [],
    linkUrlInput: '',
    linkCommentInput: '',
  }
}

async function readFiles(files: FileList, uploaderName: string) {
  return Promise.all(
    Array.from(files).map(
      (file) =>
        new Promise<MonthlyAttachmentViewModel>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`))
          reader.onload = () =>
            resolve({
              id: `${file.name}-${file.lastModified}`,
              type: 'FILE',
              name: file.name,
              kind: file.name.toLowerCase().includes('report')
                ? 'REPORT'
                : file.name.toLowerCase().includes('output')
                  ? 'OUTPUT'
                  : 'OTHER',
              comment: undefined,
              uploadedAt: new Date().toISOString(),
              uploadedBy: uploaderName,
              sizeLabel:
                file.size > 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                  : `${Math.max(1, Math.round(file.size / 1024))}KB`,
              dataUrl: typeof reader.result === 'string' ? reader.result : undefined,
            })
          reader.readAsDataURL(file)
        })
    )
  )
}

function createLinkAttachment(params: {
  url: string
  comment: string
  uploaderName: string
}): MonthlyAttachmentViewModel {
  const trimmedUrl = params.url.trim()
  const trimmedComment = params.comment.trim()

  return {
    id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'LINK',
    name: getMonthlyLinkDisplayName(trimmedUrl),
    kind: 'OTHER',
    comment: trimmedComment || undefined,
    uploadedAt: new Date().toISOString(),
    uploadedBy: params.uploaderName,
    url: trimmedUrl,
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

function downloadAttachment(attachment: MonthlyAttachmentViewModel, onMissing: (message: string) => void) {
  if (!attachment.dataUrl) {
    onMissing('이 증빙은 메타데이터만 남아 있어 브라우저에서 직접 다운로드할 수 없습니다.')
    return
  }

  const anchor = document.createElement('a')
  anchor.href = attachment.dataUrl
  anchor.download = attachment.name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function openLinkAttachment(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
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
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
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

function RecoveryScopeControls(props: {
  pageData: MonthlyPageData
  onChangeYear: (year: number) => void
  onChangeMonth: (month: string) => void
  onChangeScope: (scope: string) => void
  onChangeEmployee: (employeeId: string) => void
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">연도</span>
          <select
            value={String(props.pageData.selectedYear)}
            onChange={(event) => props.onChangeYear(Number(event.target.value))}
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
          >
            {props.pageData.availableYears.map((year) => (
              <option key={year} value={year}>
                {year}년
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">월</span>
          <select
            value={props.pageData.selectedMonth}
            onChange={(event) => props.onChangeMonth(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
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

        <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">대상 범위</span>
          <select
            value={props.pageData.selectedScope}
            onChange={(event) => props.onChangeScope(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
          >
            <option value="self">내 실적</option>
            <option value="team">팀 범위</option>
            <option value="employee">특정 직원</option>
          </select>
        </label>

        <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">대상자</span>
          <select
            value={props.pageData.selectedEmployeeId}
            onChange={(event) => props.onChangeEmployee(event.target.value)}
            disabled={props.pageData.selectedScope === 'self'}
            className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:bg-slate-50"
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
    ['NOT_STARTED', 'DRAFT'].includes(selected.status)
  const canSubmit =
    Boolean(selected) &&
    pageData.permissions.canSubmit &&
    ['NOT_STARTED', 'DRAFT'].includes(selected.status)
  const contextKey = useMemo(
    () =>
      `${pageData.selectedScope}:${pageData.selectedEmployeeId}:${pageData.selectedYear}:${pageData.selectedMonth}`,
    [pageData.selectedEmployeeId, pageData.selectedMonth, pageData.selectedScope, pageData.selectedYear]
  )
  const editDisabledReason = getEditBlockedReason(selected, canEdit)
  const submitDisabledReason = getSubmitBlockedReason(selected, canSubmit, selectedDraft)
  const reviewActionState = getReviewActionState(selected, pageData.permissions.canReview, 'REVIEW')
  const requestUpdateActionState = getReviewActionState(selected, pageData.permissions.canReview, 'REQUEST_UPDATE')
  const aiActionStates = Object.fromEntries(
    (Object.keys(AI_LABELS) as AiAction[]).map((action) => [
      action,
      buildAiActionState({
        action,
        canUseAi: pageData.permissions.canUseAi,
        selected,
        selectedDraft,
        canReview: pageData.permissions.canReview,
      }),
    ])
  ) as Record<AiAction, ActionState>
  const copyPreviousReason =
    !selected
      ? 'KPI를 먼저 선택하세요.'
      : !selected.previousRecord
        ? '이전 달 실적이 없어 불러올 값이 없습니다.'
        : editDisabledReason
  const uploadDisabledReason = editDisabledReason

  const visibleRecords = pageData.records.filter((record) => {
    if (filters.status !== 'ALL' && record.status !== filters.status) return false
    if (filters.risk === 'RISK' && record.riskFlags.length === 0) return false
    if (filters.risk === 'SAFE' && record.riskFlags.length > 0) return false
    if (filters.type !== 'ALL' && record.type !== filters.type) return false
    if (filters.review === 'REVIEWED' && !record.reviewComment) return false
    if (filters.review === 'PENDING' && record.status !== 'SUBMITTED') return false
    return true
  })

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
      const attachments = await readFiles(fileList, pageData.actor.name)
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

    const attachment = createLinkAttachment({
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
      const actualValue =
        selected.type === 'QUANTITATIVE' && selectedDraft.actualValue.trim()
          ? Number(selectedDraft.actualValue)
          : undefined

      if (
        selected.type === 'QUANTITATIVE' &&
        selectedDraft.actualValue.trim() &&
        !Number.isFinite(actualValue)
      ) {
        throw new Error('정량 KPI는 숫자 실적값을 입력해야 합니다.')
      }

      const payload = {
        actualValue,
        activities: selectedDraft.activityNote.trim() || undefined,
        obstacles: selectedDraft.blockerNote.trim() || undefined,
        efforts: selectedDraft.effortNote.trim() || undefined,
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
      setBanner({ tone: 'success', message: 'AI preview를 현재 입력 내용에 반영했습니다.' })
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
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">월간 실적</h1>
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
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">월간 실적</h1>
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

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
          Monthly Performance Operations
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">월간 실적</h1>
        <p className="mt-2 text-sm text-slate-500">
          개인 KPI 기준으로 월간 실적을 기록하고, 리뷰와 증빙을 누적해 평가 근거로 연결합니다.
        </p>
        </section>

      {loadAlerts}
      <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  연도
                </span>
                <select
                  value={String(pageData.selectedYear)}
                  onChange={(event) => handleRouteSelection({ year: Number(event.target.value), tab: 'entry', recordId: '' })}
                  className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
                >
                  {pageData.availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </label>

              <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  월
                </span>
                <select
                  value={pageData.selectedMonth}
                  onChange={(event) => handleRouteSelection({ month: event.target.value, tab: 'entry', recordId: '' })}
                  className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
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

              <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  대상 범위
                </span>
                <select
                  value={pageData.selectedScope}
                  onChange={(event) => handleRouteSelection({ scope: event.target.value, tab: 'entry', recordId: '' })}
                  className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
                >
                  <option value="self">내 실적</option>
                  <option value="team">우리 팀</option>
                  <option value="employee">특정 구성원</option>
                </select>
              </label>

              <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  대상자
                </span>
                <select
                  value={pageData.selectedEmployeeId}
                  onChange={(event) =>
                    handleRouteSelection({
                      scope: 'employee',
                      employeeId: event.target.value,
                      tab: 'entry',
                      recordId: '',
                    })
                  }
                  disabled={pageData.selectedScope === 'self'}
                  className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:bg-slate-50"
                >
                  {pageData.employeeOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} / {employee.departmentName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  pageData.summary.overallStatus === 'MIXED'
                    ? 'bg-slate-100 text-slate-700'
                    : STATUS_CLASS[pageData.summary.overallStatus]
                }`}
              >
                {pageData.summary.overallStatus === 'MIXED'
                  ? '혼합 상태'
                  : STATUS_LABELS[pageData.summary.overallStatus]}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                제출 완료 비율 {pageData.summary.submissionRate}%
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                평균 달성률 {formatPercent(pageData.summary.averageAchievementRate)}
              </span>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                위험 신호 KPI {formatCountWithUnit(pageData.summary.riskyCount, '개')}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                증빙 항목 {formatCountWithUnit(pageData.summary.attachmentCount, '건')}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Button
              icon={<Save className="h-4 w-4" />}
              onClick={() => void saveRecord('draft')}
              disabled={!selected || busy !== null || Boolean(editDisabledReason)}
              title={editDisabledReason}
            >
              임시저장
            </Button>
            <Button
              icon={<CheckCircle2 className="h-4 w-4" />}
              variant="primary"
              onClick={() => void saveRecord('submit')}
              disabled={!selected || busy !== null || Boolean(submitDisabledReason)}
              title={submitDisabledReason}
            >
              제출
            </Button>
            <Button
              icon={<History className="h-4 w-4" />}
              onClick={handleCopyPreviousMonth}
              disabled={busy !== null || Boolean(copyPreviousReason)}
              title={copyPreviousReason}
            >
              이전월 값 불러오기
            </Button>
            <Button
              icon={<Paperclip className="h-4 w-4" />}
              onClick={() => {
                if (!canEdit) {
                  setBanner({ tone: 'info', message: '현재 상태에서는 증빙을 추가할 수 없습니다.' })
                  return
                }
                fileInputRef.current?.click()
              }}
              disabled={!selected || busy !== null || Boolean(uploadDisabledReason)}
              title={uploadDisabledReason}
            >
              증빙 첨부
            </Button>
            <Button icon={<History className="h-4 w-4" />} onClick={() => setTab('review')} disabled={busy !== null}>
              이력 보기
            </Button>
          </div>
        </div>
      </section>

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="이번 달 KPI" value={formatCountWithUnit(pageData.summary.totalKpiCount, '개')} helper="선택한 월에 관리 중인 개인 KPI 수" />
        <SummaryCard label="평균 달성률" value={formatPercent(pageData.summary.averageAchievementRate)} helper={formatRateBaseCopy('선택한 월 KPI')} />
        <SummaryCard label="제출 완료 KPI" value={formatCountWithUnit(pageData.summary.submittedCount, '개')} helper={formatRateBaseCopy('전체 KPI')} />
        <SummaryCard label="미입력 KPI" value={formatCountWithUnit(pageData.summary.missingCount, '개')} helper="아직 월간 기록이 없는 KPI 수" />
        <SummaryCard label="위험 신호 KPI" value={formatCountWithUnit(pageData.summary.riskyCount, '개')} helper="리스크 플래그가 있는 KPI 수" />
        <SummaryCard label="상사 리뷰 대기 KPI" value={formatCountWithUnit(pageData.summary.reviewPendingCount, '개')} helper="제출 후 리뷰 대기 상태인 KPI 수" />
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm md:col-span-2">
          <div className="text-sm font-semibold text-blue-900">다음 행동</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ActionRow label="미입력 KPI 채우기" done={pageData.summary.missingCount === 0} onClick={() => setTab('entry')} />
            <ActionRow label="위험 KPI 코멘트 보완" done={pageData.summary.riskyCount === 0} onClick={() => setTab('entry')} />
            <ActionRow label="증빙 항목 추가" done={pageData.summary.attachmentCount > 0} onClick={() => setTab('evidence')} />
            <ActionRow label="상사 리뷰 확인" done={pageData.summary.reviewPendingCount === 0} onClick={() => setTab('review')} />
          </div>
        </div>
      </section>

      {selected?.personalKpiId ? (
        <MidReviewReferencePanel
          kind="personal-kpi"
          targetId={selected.personalKpiId}
          title="중간 점검"
          helper="이 KPI와 연결된 최근 중간 점검 판단, 기대 상태, 다음 기간 계획을 함께 확인합니다."
        />
      ) : null}

      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === item.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'entry' ? (
        <EntryTab
          visibleRecords={visibleRecords}
          filters={filters}
          setFilters={setFilters}
          selected={selected}
          setSelectedId={setSelectedId}
          selectedDraft={selectedDraft}
          canEdit={canEdit}
          canSubmit={canSubmit}
          editDisabledReason={editDisabledReason}
          submitDisabledReason={submitDisabledReason}
          reviewActionState={reviewActionState}
          requestUpdateActionState={requestUpdateActionState}
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
          onAddLinkAttachment={() => handleLinkAttachmentCreate()}
          onUploadClick={() => {
            if (!canEdit) {
              setBanner({ tone: 'info', message: '현재 상태에서는 증빙을 추가할 수 없습니다.' })
              return
            }
            fileInputRef.current?.click()
          }}
          onAttachmentDownload={(attachment) =>
            downloadAttachment(attachment, (message) => setBanner({ tone: 'info', message }))
          }
          onAttachmentRemove={(attachmentId) =>
            updateDraft({
              attachments: (selectedDraft?.attachments ?? []).filter((item) => item.id !== attachmentId),
            })
          }
          onRunAi={() => void runAi('generate-summary')}
        />
      ) : null}

      {tab === 'trend' ? (
        <TrendTab selectedTrend={selectedTrend} selectedMonth={pageData.selectedMonth} />
      ) : null}

      {tab === 'review' ? (
        <ReviewTab reviews={pageData.reviews} history={selected?.history ?? []} />
      ) : null}

      {tab === 'evidence' ? (
        <EvidenceTab
          evidence={pageData.evidence}
          onDownload={(attachment) =>
            downloadAttachment(attachment, (message) => setBanner({ tone: 'info', message }))
          }
        />
      ) : null}

      {tab === 'ai' ? (
        <AiTab
          aiLogs={pageData.aiLogs}
          aiPreview={aiPreview}
          lastAiAction={lastAiAction}
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
            ['/evaluation/workbench', 'AI 보조 작성'],
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
  visibleRecords,
  filters,
  setFilters,
  selected,
  setSelectedId,
  selectedDraft,
  canEdit,
  canSubmit,
  editDisabledReason,
  submitDisabledReason,
  reviewActionState,
  requestUpdateActionState,
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
  onAddLinkAttachment,
  onUploadClick,
  onAttachmentDownload,
  onAttachmentRemove,
  onRunAi,
}: {
  visibleRecords: MonthlyRecordViewModel[]
  filters: { status: string; risk: string; type: string; review: string }
  setFilters: Dispatch<SetStateAction<{ status: string; risk: string; type: string; review: string }>>
  selected: MonthlyRecordViewModel | null
  setSelectedId: (id: string) => void
  selectedDraft: Draft | null
  canEdit: boolean
  canSubmit: boolean
  editDisabledReason?: string
  submitDisabledReason?: string
  reviewActionState: ActionState
  requestUpdateActionState: ActionState
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
  onAddLinkAttachment: () => void
  onUploadClick: () => void
  onAttachmentDownload: (attachment: MonthlyAttachmentViewModel) => void
  onAttachmentRemove: (attachmentId: string) => void
  onRunAi: () => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">KPI별 월간 입력</h2>
          <p className="mt-1 text-sm text-slate-500">
            개별 KPI 상태와 위험 신호를 확인하고 상세 입력으로 이동하세요.
          </p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-5">
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
            label="위험 여부"
            value={filters.risk}
            onChange={(value) => setFilters((current) => ({ ...current, risk: value }))}
            options={[
              ['ALL', '전체'],
              ['RISK', '위험만'],
              ['SAFE', '안정만'],
            ]}
          />
          <FilterSelect
            label="KPI 유형"
            value={filters.type}
            onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
            options={[
              ['ALL', '전체'],
              ['QUANTITATIVE', '정량'],
              ['QUALITATIVE', '정성'],
            ]}
          />
          <FilterSelect
            label="리뷰 여부"
            value={filters.review}
            onChange={(value) => setFilters((current) => ({ ...current, review: value }))}
            options={[
              ['ALL', '전체'],
              ['PENDING', '리뷰 대기'],
              ['REVIEWED', '리뷰 있음'],
            ]}
          />
          <div className="flex items-end">
            <Button
              onClick={() =>
                setFilters({ ...DEFAULT_FILTERS })
              }
            >
              초기화
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {visibleRecords.length ? (
            visibleRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedId(record.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  record.id === selected?.id
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{record.kpiTitle}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {record.type === 'QUANTITATIVE' ? '정량' : '정성'}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[record.status]}`}>
                        {STATUS_LABELS[record.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">최근 달성률 {formatPercent(record.achievementRate)}</p>
                    {record.orgKpiTitle ? (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700">
                        <Link2 className="h-3.5 w-3.5" />
                        {record.orgKpiTitle}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {record.riskFlags.length ? (
                      record.riskFlags.slice(0, 2).map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700"
                        >
                          {flag}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        안정
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">조건에 맞는 월간 실적이 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {selected ? `${selected.kpiTitle} 입력 상세` : '입력 상세'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            정량 KPI는 숫자 입력과 자동 계산, 정성 KPI는 메모 중심으로 기록합니다.
          </p>
        </div>

        {selected && selectedDraft ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">KPI 개요</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <MetaLine label="목표값" value={`${selected.targetValue ?? '-'} ${selected.unit ?? ''}`.trim()} />
                <MetaLine label="상태" value={STATUS_LABELS[selected.status]} />
                {selected.previousRecord ? (
                  <MetaLine
                    label="지난달 값"
                    value={`${selected.previousRecord.yearMonth} / ${formatPercent(selected.previousRecord.achievementRate)}`}
                  />
                ) : null}
                <MetaLine label="최근 리뷰" value={selected.reviewComment ? '있음' : '없음'} />
              </div>
            </div>

            {selected.type === 'QUANTITATIVE' ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">이번 달 실적값</span>
                <input
                  value={selectedDraft.actualValue}
                  onChange={(event) => updateDraft({ actualValue: event.target.value })}
                  disabled={!canEdit}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                />
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                {selected.type === 'QUANTITATIVE' ? '활동 내용' : '진행 수준 메모'}
              </span>
              <textarea
                value={selectedDraft.activityNote}
                onChange={(event) => updateDraft({ activityNote: event.target.value })}
                disabled={!canEdit}
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">장애요인</span>
                <textarea
                  value={selectedDraft.blockerNote}
                  onChange={(event) => updateDraft({ blockerNote: event.target.value })}
                  disabled={!canEdit}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">극복 노력</span>
                <textarea
                  value={selectedDraft.effortNote}
                  onChange={(event) => updateDraft({ effortNote: event.target.value })}
                  disabled={!canEdit}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-50"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">증빙 첨부</p>
                  <p className="mt-1 text-xs text-slate-500">
                    증빙 변경 사항은 임시저장 또는 제출 시 반영됩니다.
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
              <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1.3fr_1fr_auto]">
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
                    placeholder="링크 설명을 간단히 남겨 주세요."
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
                              placeholder="증빙 설명을 간단히 남겨 주세요."
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
                            />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {attachment.type === 'LINK' ? (
                            <Button
                              icon={<Link2 className="h-4 w-4" />}
                              onClick={() => attachment.url && openLinkAttachment(attachment.url)}
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
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-900">등록된 증빙 항목이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {selected.reviewComment ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">최근 상사 리뷰</div>
                <p className="mt-2 leading-6">{selected.reviewComment}</p>
              </div>
            ) : null}

            {canReview && selected.recordId ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">리더 리뷰 입력</div>
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

            <div className="grid gap-3 sm:grid-cols-2">
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
                disabled={!canSubmit || busy !== null}
                title={submitDisabledReason}
              >
                제출
              </Button>
              <Button
                icon={<Sparkles className="h-4 w-4" />}
                onClick={onRunAi}
                disabled={busy !== null || generateSummaryActionState.disabled}
                title={generateSummaryActionState.reason}
              >
                AI preview
              </Button>
              <Link
                href="/checkin"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                체크인으로 이동
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">상세를 볼 KPI가 없습니다.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function TrendTab({
  selectedTrend,
  selectedMonth,
}: {
  selectedTrend: MonthlyPageData['trends'][number] | null | undefined
  selectedMonth: string
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
}: {
  reviews: MonthlyPageData['reviews']
  history: MonthlyRecordViewModel['history']
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
  evidence,
  onDownload,
}: {
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
                <Button icon={<Link2 className="h-4 w-4" />} onClick={() => item.url && openLinkAttachment(item.url)}>
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
  actionStates,
  busy,
  onRunAi,
  onApprove,
  onReject,
}: {
  aiLogs: MonthlyPageData['aiLogs']
  aiPreview: AiPreview | null
  lastAiAction: AiAction
  actionStates: Record<AiAction, ActionState>
  busy: BusyState
  onRunAi: (action: AiAction) => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">월간 실적 AI 보조</h2>
          <p className="mt-1 text-sm text-slate-500">초안 생성과 요약은 AI가 돕고, 적용 여부는 사람이 직접 결정합니다.</p>
        </div>
        <div className="space-y-3">
          {(Object.keys(AI_LABELS) as AiAction[]).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onRunAi(action)}
              disabled={busy !== null || actionStates[action]?.disabled}
              title={actionStates[action]?.reason}
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50 disabled:opacity-60"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Bot className="h-4 w-4 text-slate-500" />
                {AI_LABELS[action]}
              </div>
              {actionStates[action]?.reason ? (
                <p className="mt-2 text-xs text-slate-500">{actionStates[action]?.reason}</p>
              ) : null}
            </button>
          ))}
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
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-900">AI 사용 이력이 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">AI 미리보기</h2>
          <p className="mt-1 text-sm text-slate-500">결과를 확인한 뒤 적용하거나 반려할 수 있습니다.</p>
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
                emptyTitle="AI preview가 아직 없습니다."
                emptyDescription="AI 보조 기능을 실행하면 이 영역에 preview가 표시됩니다."
                onApprove={onApprove}
                onReject={onReject}
                approveLabel="미리보기 적용"
                rejectLabel="반려"
                decisionBusy={busy === 'ai-decision'}
              />
            </div>
            <div className="hidden flex-wrap gap-2">
              <Button onClick={onReject} disabled={busy === 'ai-decision'}>
                반려
              </Button>
              <Button variant="primary" onClick={onApprove} disabled={busy === 'ai-decision'}>
                preview 적용
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-900">AI preview가 아직 없습니다.</p>
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

function SummaryCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      {helper ? <div className="mt-2 text-xs text-slate-500">{helper}</div> : null}
    </div>
  )
}

function ActionRow({
  label,
  done,
  onClick,
}: {
  label: string
  done: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-3">
      <div className="font-medium text-blue-900">{label}</div>
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700"
      >
        {done ? '완료' : '이동'}
      </button>
    </div>
  )
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || '-'}</span>
    </div>
  )
}

function AiPreviewBlock({
  action,
  result,
}: {
  action: AiAction
  result: Record<string, unknown>
}) {
  const record = toRecord(result) ?? {}
  const lines: string[] = []

  switch (action) {
    case 'generate-summary':
      lines.push(`요약: ${getString(record.summary, '-')}`)
      getStringArray(record.highlights).forEach((item) => lines.push(`강점: ${item}`))
      getStringArray(record.risks).forEach((item) => lines.push(`리스크: ${item}`))
      getStringArray(record.nextActions).forEach((item) => lines.push(`다음 액션: ${item}`))
      break
    case 'explain-risk':
      lines.push(`위험 수준: ${getString(record.riskLevel, '-')}`)
      lines.push(`원인 요약: ${getString(record.causeSummary, '-')}`)
      getStringArray(record.responsePoints).forEach((item) => lines.push(`대응 포인트: ${item}`))
      break
    case 'generate-review':
      lines.push(`리뷰 초안: ${getString(record.comment, '-')}`)
      getStringArray(record.strengths).forEach((item) => lines.push(`강점: ${item}`))
      getStringArray(record.requests).forEach((item) => lines.push(`요청 사항: ${item}`))
      break
    case 'summarize-evidence':
      lines.push(`증빙 요약: ${getString(record.summary, '-')}`)
      getStringArray(record.evidenceHighlights).forEach((item) => lines.push(`근거: ${item}`))
      getStringArray(record.missingEvidence).forEach((item) => lines.push(`보완 필요: ${item}`))
      break
    case 'generate-retrospective':
      getStringArray(record.strengths).forEach((item) => lines.push(`강점: ${item}`))
      getStringArray(record.risks).forEach((item) => lines.push(`리스크: ${item}`))
      getStringArray(record.nextMonthPriorities).forEach((item) => lines.push(`다음달 우선순위: ${item}`))
      lines.push(`요약: ${getString(record.summary, '-')}`)
      break
    case 'suggest-checkin-agenda':
      getStringArray(record.agenda).forEach((item) => lines.push(`아젠다: ${item}`))
      getStringArray(record.leaderPrep).forEach((item) => lines.push(`리더 준비 포인트: ${item}`))
      getStringArray(record.memberPrep).forEach((item) => lines.push(`구성원 준비 포인트: ${item}`))
      break
    case 'summarize-evaluation-evidence':
      lines.push(`평가 근거 요약: ${getString(record.summary, '-')}`)
      getStringArray(record.evaluationPoints).forEach((item) => lines.push(`평가 포인트: ${item}`))
      getStringArray(record.watchouts).forEach((item) => lines.push(`주의 포인트: ${item}`))
      break
  }

  return <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-slate-700">{lines.join('\n')}</pre>
}
