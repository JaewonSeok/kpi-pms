'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useImpersonationRiskAction } from '@/components/security/useImpersonationRiskAction'
import { isImpersonationRiskCancelledError } from '@/lib/impersonation'
import type { WordCloud360PageData } from '@/server/word-cloud-360'
import { buildWordCloudCycleFormState, toWordCloudCyclePayload } from '@/lib/word-cloud-360-cycle-form'
import { WordCloudCloud } from './WordCloudCloud'

type TabKey = 'overview' | 'evaluator' | 'results' | 'admin'
type AdminAssignment = NonNullable<NonNullable<WordCloud360PageData['adminView']>['assignments']>[number]
type AdminHistoryEntry = AdminAssignment['history'][number]

type Notice = {
  tone: 'success' | 'error'
  message: string
} | null

type KeywordImportResult = {
  mode: 'preview' | 'apply'
  fileName: string
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
    createCount: number
    updateCount: number
    unchangedCount: number
    deactivateCount: number
  }
  rows: Array<{
    rowNumber: number
    keywordCode?: string
    keyword: string
    polarity?: string
    category?: string
    sourceType?: string
    action: 'create' | 'update' | 'unchanged' | 'deactivate'
    valid: boolean
    issues: Array<{
      field: string
      message: string
    }>
  }>
  applyResult?: {
    createdCount: number
    updatedCount: number
    unchangedCount: number
    deactivatedCount: number
    failedCount: number
    uploadHistoryId?: string
  }
}

type TargetUploadResult = {
  fileName: string
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
    targetCount: number
    createdAssignmentCount: number
    existingAssignmentCount: number
  }
  rows: Array<{
    rowNumber: number
    employeeNumber: string
    employeeName?: string
    department?: string
    valid: boolean
    issues: Array<{
      field: string
      message: string
    }>
    createdAssignmentCount: number
    existingAssignmentCount: number
    groups: string[]
  }>
  uploadHistoryId?: string
}

type ComparisonReport = {
  fileName: string
  summary: {
    currentCycleName: string
    baselineDepartmentCount: number
    currentDepartmentCount: number
    comparedDepartmentCount: number
    baselineResponseCount: number
    currentResponseCount: number
    hiddenBaselineRows: number
    hiddenCurrentDepartments: number
    largestResponseChange?: {
      department: string
      delta: number
    }
    largestPositiveShift?: {
      department: string
      keyword: string
      delta: number
    }
    largestNegativeShift?: {
      department: string
      keyword: string
      delta: number
    }
  }
  departments: Array<{
    department: string
    baselineResponseCount: number
    currentResponseCount: number
    responseDelta: number
    baselineTopPositiveKeywords: string[]
    currentTopPositiveKeywords: string[]
    baselineTopNegativeKeywords: string[]
    currentTopNegativeKeywords: string[]
    changedKeywords: Array<{
      keyword: string
      polarity: 'POSITIVE' | 'NEGATIVE'
      delta: number
    }>
    insight: string
  }>
}

function initialTab(data: WordCloud360PageData): TabKey {
  if (data.permissions?.canManage) return 'admin'
  if (data.permissions?.canEvaluate) return 'evaluator'
  return 'results'
}

const cardClassName = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-400'
const primaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'
const secondaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400'
const groupLabels: Record<string, string> = {
  ALL: '전체',
  MANAGER: '상사',
  PEER: '동료',
  SUBORDINATE: '구성원',
  SELF: '자기평가',
}
const categoryLabels: Record<string, string> = {
  ATTITUDE: '태도',
  ABILITY: '역량',
  BOTH: '태도/역량',
  OTHER: '기타',
}
const sourceTypeLabels: Record<string, string> = {
  DOCUMENT_FINAL: '문서 확정',
  EXTRA_GOVERNANCE: '거버넌스 추가',
  ADMIN_ADDED: '관리자 추가',
  IMPORTED: 'CSV 업로드',
}
const assignmentStatusLabels: Record<string, string> = {
  PENDING: '미응답',
  IN_PROGRESS: '수정 가능',
  SUBMITTED: '최종 제출',
}

assignmentStatusLabels.DRAFT = '임시 저장'

const historyEventLabels: Record<AdminHistoryEntry['eventType'], string> = {
  draft_saved: '임시 저장',
  final_submitted: '최종 제출',
  final_submission_reverted: '최종 제출 취소',
  restored: '이력 복원',
}

function readApiBody(body: unknown) {
  if (!body || typeof body !== 'object') return { success: false, error: { message: '응답 형식이 올바르지 않습니다.' } }
  return body as { success: boolean; data?: unknown; error?: { message?: string } }
}

function toFriendlyErrorMessage(message: string | undefined, fallback: string) {
  const trimmed = message?.trim()
  if (!trimmed) return fallback
  if (trimmed.includes('Too small: expected string to have >=1 characters')) {
    return '선택 가능한 주기가 없습니다. 아래에서 첫 주기를 생성해 주세요.'
  }
  if (trimmed.includes('Invalid ISO datetime')) {
    return '시작일과 종료일 형식을 확인해 주세요.'
  }
  if (trimmed.includes('Invalid datetime')) {
    return '시작일과 종료일 형식을 확인해 주세요.'
  }
  if (/^(Too small|Too big|Invalid input|expected )/i.test(trimmed)) {
    return fallback
  }
  return trimmed
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function selectionPreview(selections: Array<{ keyword: string }>) {
  if (!selections.length) return '-'
  const keywords = selections.map((selection) => selection.keyword)
  const preview = keywords.slice(0, 4).join(', ')
  return keywords.length > 4 ? `${preview} 외 ${keywords.length - 4}개` : preview
}

async function callAction(action: string, payload: unknown, headers?: HeadersInit) {
  const response = await fetch('/api/evaluation/word-cloud-360/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify({ action, payload }),
  })
  const body = readApiBody(await response.json())
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청을 처리하지 못했습니다.')
  }
  return body.data
}

async function uploadKeywordCsv(mode: 'preview' | 'apply', file: File) {
  const formData = new FormData()
  formData.set('mode', mode)
  formData.set('file', file)

  const response = await fetch('/api/evaluation/word-cloud-360/keywords/upload', {
    method: 'POST',
    body: formData,
  })
  const body = readApiBody(await response.json())
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? 'CSV 업로드를 처리하지 못했습니다.')
  }
  return body.data as KeywordImportResult
}

async function uploadWordCloudAdminFile<T>(endpoint: string, cycleId: string, file: File, headers?: HeadersInit) {
  const formData = new FormData()
  formData.set('cycleId', cycleId)
  formData.set('file', file)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: formData,
  })
  const body = readApiBody(await response.json())
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '파일 업로드를 처리하지 못했습니다.')
  }
  return body.data as T
}

async function downloadWordCloudExport(params: {
  cycleId: string
  format: 'csv' | 'xlsx'
  reason: string
  headers?: HeadersInit
}) {
  const searchParams = new URLSearchParams({
    format: params.format,
    reason: params.reason,
  })
  const response = await fetch(
    `/api/evaluation/word-cloud-360/export/${encodeURIComponent(params.cycleId)}?${searchParams.toString()}`,
    { headers: params.headers }
  )

  if (!response.ok) {
    const body = readApiBody(await response.json().catch(() => ({})))
    throw new Error(body.error?.message ?? '서베이 결과를 다운로드하지 못했습니다.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]
  const fallbackName = params.format === 'csv' ? 'word-cloud-360.csv' : 'word-cloud-360.xlsx'
  const fileName = encodedName ? decodeURIComponent(encodedName) : fallbackName

  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}

function StateBox(props: { title: string; description: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{props.title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">{props.description}</p>
    </section>
  )
}

function MetricCard(props: { label: string; value: string; description: string }) {
  return (
    <article className={cardClassName}>
      <div className="text-sm font-medium text-slate-500">{props.label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-950">{props.value}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500">{props.description}</div>
    </article>
  )
}

function TabButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        props.active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {props.label}
    </button>
  )
}

function KeywordTable(props: { title: string; items: NonNullable<WordCloud360PageData['evaluateeView']>['positiveTopKeywords'] }) {
  return (
    <section className={cardClassName}>
      <h3 className="text-lg font-semibold text-slate-950">{props.title}</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2 pr-4">키워드</th>
              <th className="pb-2 pr-4">분류</th>
              <th className="pb-2 text-right">빈도</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((item) => (
              <tr key={`${item.keywordId}-${item.keyword}`} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-900">{item.keyword}</td>
                <td className="py-2 pr-4 text-slate-500">{categoryLabels[item.category] ?? item.category}</td>
                <td className="py-2 text-right text-slate-700">{item.count}</td>
              </tr>
            ))}
            {!props.items.length ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-slate-400">
                  표시할 키워드가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function WordCloud360WorkspaceClient(props: { data: WordCloud360PageData }) {
  const { data } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab(data))
  const [notice, setNotice] = useState<Notice>(null)
  const [isPending, startTransition] = useTransition()
  const { requestRiskConfirmation, riskDialog, createCancelledError } = useImpersonationRiskAction()
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const deferredAssignmentSearch = useDeferredValue(assignmentSearch)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(data.evaluatorView?.assignments[0]?.assignmentId ?? '')
  const [positiveSelections, setPositiveSelections] = useState<string[]>(
    data.evaluatorView?.assignments[0]?.selectedPositiveKeywordIds ?? []
  )
  const [negativeSelections, setNegativeSelections] = useState<string[]>(
    data.evaluatorView?.assignments[0]?.selectedNegativeKeywordIds ?? []
  )
  const [cycleForm, setCycleForm] = useState(() => buildWordCloudCycleFormState(data.adminView?.cycle))
  const [keywordForm, setKeywordForm] = useState({
    keywordId: '',
    keywordCode: '',
    keyword: '',
    polarity: 'POSITIVE',
    category: 'ATTITUDE',
    sourceType: 'ADMIN_ADDED',
    active: true,
    displayOrder: 0,
    warningFlag: false,
    note: '',
  })
  const [keywordUploadFile, setKeywordUploadFile] = useState<File | null>(null)
  const [keywordImportResult, setKeywordImportResult] = useState<KeywordImportResult | null>(null)
  const [targetUploadFile, setTargetUploadFile] = useState<File | null>(null)
  const [targetUploadResult, setTargetUploadResult] = useState<TargetUploadResult | null>(null)
  const [comparisonUploadFile, setComparisonUploadFile] = useState<File | null>(null)
  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('xlsx')
  const [exportReason, setExportReason] = useState('')
  const [revertModalAssignmentId, setRevertModalAssignmentId] = useState('')
  const [revertReason, setRevertReason] = useState('')
  const [historyModalAssignmentId, setHistoryModalAssignmentId] = useState('')
  const [restoreModalAssignmentId, setRestoreModalAssignmentId] = useState('')
  const [restoreModalRevisionId, setRestoreModalRevisionId] = useState('')
  const [restoreReason, setRestoreReason] = useState('')
  const [assignmentForm, setAssignmentForm] = useState({
    evaluatorId: '',
    evaluateeId: '',
    evaluatorGroup: 'PEER',
  })

  const selectedAssignment =
    data.evaluatorView?.assignments.find((assignment) => assignment.assignmentId === selectedAssignmentId) ??
    data.evaluatorView?.assignments[0]

  const filteredAssignments =
    data.evaluatorView?.assignments.filter((assignment) => {
      if (!deferredAssignmentSearch.trim()) return true
      const query = deferredAssignmentSearch.trim().toLowerCase()
      return [assignment.evaluateeName, assignment.department, assignment.evaluatorGroup]
        .join(' ')
        .toLowerCase()
        .includes(query)
    }) ?? []
  const canSubmitFinal = positiveSelections.length >= 1 && negativeSelections.length >= 1

  const categoryChartData = useMemo(
    () =>
      data.evaluateeView?.categorySummary.map((item) => ({
        name: item.label,
        count: item.count,
      })) ?? [],
    [data.evaluateeView?.categorySummary]
  )
  const keywordImportRowsToShow = keywordImportResult?.rows.slice(0, 100) ?? []
  const canApplyKeywordImport = Boolean(keywordUploadFile && keywordImportResult?.mode === 'preview' && keywordImportResult.summary.validRows > 0)
  const targetUploadRowsToShow = targetUploadResult?.rows.slice(0, 100) ?? []
  const comparisonRowsToShow = comparisonReport?.departments.slice(0, 20) ?? []
  const hasSelectedCycle = Boolean(data.selectedCycleId)
  const hasCycleOptions = data.availableCycles.length > 0
  const isCreateMode = Boolean(data.permissions?.canManage && !hasSelectedCycle)
  const selectedCycleName =
    data.availableCycles.find((cycle) => cycle.id === data.selectedCycleId)?.name ??
    data.adminView?.cycle?.cycleName ??
    data.selectedCycleId ??
    ''
  const revertTargetAssignment =
    data.adminView?.assignments.find((assignment) => assignment.assignmentId === revertModalAssignmentId) ?? null
  const historyTargetAssignment =
    data.adminView?.assignments.find((assignment) => assignment.assignmentId === historyModalAssignmentId) ?? null
  const restoreTargetAssignment =
    data.adminView?.assignments.find((assignment) => assignment.assignmentId === restoreModalAssignmentId) ?? null
  const restoreTargetRevision =
    restoreTargetAssignment?.history.find((revision) => revision.revisionId === restoreModalRevisionId) ?? null

  function updateCycle(nextCycleId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextCycleId) params.set('cycleId', nextCycleId)
    else params.delete('cycleId')
    const query = params.toString()
    router.push(query ? `/evaluation/word-cloud-360?${query}` : '/evaluation/word-cloud-360')
  }

  function updateGroup(group: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (group && group !== 'ALL') params.set('group', group)
    else params.delete('group')
    const query = params.toString()
    router.push(query ? `/evaluation/word-cloud-360?${query}` : '/evaluation/word-cloud-360')
  }

  function mutate(task: () => Promise<unknown>, successMessage: string) {
    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          await task()
          setNotice({ tone: 'success', message: successMessage })
          router.refresh()
        } catch (error) {
          if (isImpersonationRiskCancelledError(error)) {
            return
          }
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : '작업을 처리하지 못했습니다.',
          })
        }
      })()
    })
  }

  function saveCycle() {
    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const savedCycle = (await callAction('upsertCycle', toWordCloudCyclePayload(cycleForm))) as { id: string }
          const createdFirstCycle = !cycleForm.cycleId

          setCycleForm((current) => ({ ...current, cycleId: savedCycle.id }))
          setNotice({
            tone: 'success',
            message: createdFirstCycle ? '주기를 생성했습니다.' : '주기 정보를 수정했습니다.',
          })

          if (savedCycle.id !== data.selectedCycleId) {
            updateCycle(savedCycle.id)
            return
          }

          router.refresh()
        } catch (error) {
          setNotice({
            tone: 'error',
            message: toFriendlyErrorMessage(
              error instanceof Error ? error.message : undefined,
              '주기 정보를 저장하지 못했습니다.'
            ),
          })
        }
      })()
    })
  }

  function runKeywordImport(mode: 'preview' | 'apply') {
    if (!keywordUploadFile) {
      setNotice({ tone: 'error', message: '업로드할 CSV 파일을 선택하세요.' })
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const result = await uploadKeywordCsv(mode, keywordUploadFile)
          setKeywordImportResult(result)
          setNotice({
            tone: 'success',
            message:
              mode === 'preview'
                ? '업로드 검증이 완료되었습니다.'
                : result.summary.invalidRows > 0
                  ? '오류가 있는 행은 반영되지 않았습니다.'
                  : '키워드 풀을 성공적으로 반영했습니다.',
          })
          if (mode === 'apply') {
            router.refresh()
          }
        } catch (error) {
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : 'CSV 업로드를 처리하지 못했습니다.',
          })
        }
      })()
    })
  }

  function resetKeywordImport() {
    setKeywordUploadFile(null)
    setKeywordImportResult(null)
  }

  function runTargetUpload() {
    const cycleId = data.selectedCycleId
    if (!cycleId) {
      setNotice({ tone: 'error', message: '대상자를 반영할 서베이 주기를 먼저 선택해 주세요.' })
      return
    }
    if (!targetUploadFile) {
      setNotice({ tone: 'error', message: '업로드할 대상자 파일을 선택해 주세요.' })
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const riskHeaders = await requestRiskConfirmation({
            actionName: 'UPLOAD_APPLY',
            actionLabel: '서베이 대상자 일괄 지정 업로드',
            targetLabel: selectedCycleName || cycleId,
            detail: '현재 마스터 로그인 상태에서 대상자 업로드를 실제 데이터에 반영합니다.',
            confirmationText: '업로드',
          })
          if (riskHeaders === null) {
            throw createCancelledError()
          }
          const result = await uploadWordCloudAdminFile<TargetUploadResult>(
            '/api/evaluation/word-cloud-360/targets/upload',
            cycleId,
            targetUploadFile,
            riskHeaders
          )
          setTargetUploadResult(result)
          setNotice({
            tone: 'success',
            message:
              result.summary.invalidRows > 0
                ? '일부 대상자는 반영되지 않았습니다. 오류 행을 확인해 주세요.'
                : '대상자 일괄 지정이 반영되었습니다.',
          })
          router.refresh()
        } catch (error) {
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : '대상자 업로드를 처리하지 못했습니다.',
          })
        }
      })()
    })
  }

  function resetTargetUpload() {
    setTargetUploadFile(null)
    setTargetUploadResult(null)
  }

  function runComparisonReport() {
    const cycleId = data.selectedCycleId
    if (!cycleId) {
      setNotice({ tone: 'error', message: '비교할 현재 서베이 주기를 먼저 선택해 주세요.' })
      return
    }
    if (!comparisonUploadFile) {
      setNotice({ tone: 'error', message: '비교할 과거 결과 파일을 선택해 주세요.' })
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const riskHeaders = await requestRiskConfirmation({
            actionName: 'UPLOAD_APPLY',
            actionLabel: '서베이 비교 리포트 업로드',
            targetLabel: selectedCycleName || cycleId,
            detail: '현재 마스터 로그인 상태에서 비교 리포트 업로드를 실제 데이터에 반영합니다.',
            confirmationText: '업로드',
          })
          if (riskHeaders === null) {
            throw createCancelledError()
          }
          const report = await uploadWordCloudAdminFile<ComparisonReport>(
            '/api/evaluation/word-cloud-360/comparison/upload',
            cycleId,
            comparisonUploadFile,
            riskHeaders
          )
          setComparisonReport(report)
          setNotice({
            tone: 'success',
            message: '현재 서베이와 업로드한 과거 결과를 비교한 리포트를 생성했습니다.',
          })
        } catch (error) {
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : '비교 리포트를 생성하지 못했습니다.',
          })
        }
      })()
    })
  }

  function openExportModal(format: 'csv' | 'xlsx') {
    setExportFormat(format)
    setExportReason('')
    setExportModalOpen(true)
  }

  function openRevertModal(assignment: AdminAssignment) {
    setRevertModalAssignmentId(assignment.assignmentId)
    setRevertReason('')
  }

  function closeRevertModal() {
    setRevertModalAssignmentId('')
    setRevertReason('')
  }

  function openHistoryModal(assignment: AdminAssignment) {
    setHistoryModalAssignmentId(assignment.assignmentId)
  }

  function closeHistoryModal() {
    setHistoryModalAssignmentId('')
  }

  function openRestoreModal(assignment: AdminAssignment, revision: AdminHistoryEntry) {
    setHistoryModalAssignmentId('')
    setRestoreModalAssignmentId(assignment.assignmentId)
    setRestoreModalRevisionId(revision.revisionId)
    setRestoreReason('')
  }

  function closeRestoreModal() {
    setRestoreModalAssignmentId('')
    setRestoreModalRevisionId('')
    setRestoreReason('')
  }

  function handleExportDownload() {
    const cycleId = data.selectedCycleId
    if (!cycleId) {
      setNotice({ tone: 'error', message: '다운로드할 서베이 주기를 먼저 선택해 주세요.' })
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const riskHeaders = await requestRiskConfirmation({
            actionName: 'DOWNLOAD_EXPORT',
            actionLabel: '서베이 결과 다운로드',
            targetLabel: selectedCycleName || cycleId,
            detail: '현재 마스터 로그인 상태에서 서베이 결과 파일을 다운로드합니다.',
            confirmationText: '다운로드',
          })
          if (riskHeaders === null) {
            throw createCancelledError()
          }
          await downloadWordCloudExport({
            cycleId,
            format: exportFormat,
            reason: exportReason,
            headers: riskHeaders,
          })
          setExportModalOpen(false)
          setExportReason('')
          setNotice({
            tone: 'success',
            message: '다운로드 사유를 기록하고 결과 파일을 준비했습니다.',
          })
        } catch (error) {
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : '서베이 결과 다운로드를 처리하지 못했습니다.',
          })
        }
      })()
    })
  }

  function handleRevertFinalSubmit() {
    if (!revertTargetAssignment) {
      setNotice({ tone: 'error', message: '최종 제출을 취소할 응답을 찾을 수 없습니다.' })
      return
    }

    const trimmedReason = revertReason.trim()
    if (trimmedReason.length < 5) {
      setNotice({ tone: 'error', message: '취소 사유를 5자 이상 입력해 주세요.' })
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const riskHeaders = await requestRiskConfirmation({
            actionName: 'REOPEN_RECORD',
            actionLabel: '워드클라우드 최종 제출 취소',
            targetLabel: `${revertTargetAssignment.evaluateeName} / ${revertTargetAssignment.evaluatorName}`,
            detail: '현재 마스터 로그인 상태에서 최종 제출된 응답을 다시 수정 가능 상태로 되돌립니다.',
            confirmationText: '재개',
          })
          if (riskHeaders === null) {
            throw createCancelledError()
          }

          await callAction(
            'revertFinalSubmit',
            {
              assignmentId: revertTargetAssignment.assignmentId,
              reason: trimmedReason,
            },
            riskHeaders
          )

          closeRevertModal()
          setNotice({
            tone: 'success',
            message: '최종 제출이 취소되었습니다. 평가자가 다시 수정할 수 있습니다.',
          })
          router.refresh()
        } catch (error) {
          if (isImpersonationRiskCancelledError(error)) {
            return
          }
          setNotice({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : '최종 제출 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          })
        }
      })()
    })
  }

  function handleRestoreResponseRevision() {
    if (!restoreTargetAssignment || !restoreTargetRevision) {
      setNotice({ tone: 'error', message: '복원할 이력 시점을 찾을 수 없습니다.' })
      return
    }

    const trimmedReason = restoreReason.trim()
    if (trimmedReason.length < 5) {
      setNotice({ tone: 'error', message: '복원 사유를 5자 이상 입력해 주세요.' })
      return
    }

    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          const riskHeaders = await requestRiskConfirmation({
            actionName: 'REOPEN_RECORD',
            actionLabel: '워드클라우드 응답 이력 복원',
            targetLabel: `${restoreTargetAssignment.evaluateeName} / ${restoreTargetAssignment.evaluatorName}`,
            detail: '선택한 제출 이력 시점의 키워드 선택값으로 응답을 복원하고, 평가자가 다시 수정할 수 있게 엽니다.',
            confirmationText: '재개',
          })
          if (riskHeaders === null) {
            throw createCancelledError()
          }

          await callAction(
            'restoreResponseRevision',
            {
              assignmentId: restoreTargetAssignment.assignmentId,
              revisionId: restoreTargetRevision.revisionId,
              reason: trimmedReason,
            },
            riskHeaders
          )

          closeRestoreModal()
          setNotice({
            tone: 'success',
            message: '선택한 이력 시점으로 응답이 복원되었습니다.',
          })
          router.refresh()
        } catch (error) {
          if (isImpersonationRiskCancelledError(error)) {
            return
          }
          setNotice({
            tone: 'error',
            message:
              error instanceof Error ? error.message : '응답 되돌리기에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          })
        }
      })()
    })
  }

  function toggleSelection(kind: 'positive' | 'negative', keywordId: string, limit: number) {
    const setter = kind === 'positive' ? setPositiveSelections : setNegativeSelections
    setter((current) => {
      if (current.includes(keywordId)) {
        return current.filter((item) => item !== keywordId)
      }
      if (current.length >= limit) {
        setNotice({
          tone: 'error',
          message: `${kind === 'positive' ? '긍정' : '부정'} 키워드는 최대 ${limit}개까지 선택할 수 있습니다.`,
        })
        return current
      }
      return [...current, keywordId]
    })
  }

  const tabs: Array<{ key: TabKey; label: string }> = [{ key: 'overview', label: '운영 개요' }]
  if (data.permissions?.canEvaluate) tabs.push({ key: 'evaluator', label: '평가자 응답' })
  tabs.push({ key: 'results', label: '내 결과' })
  if (data.permissions?.canManage) tabs.push({ key: 'admin', label: '관리자 운영' })

  if (data.state === 'permission-denied') {
    return <StateBox title="접근 권한이 없습니다." description={data.message ?? '권한 설정을 확인해 주세요.'} />
  }
  if (data.state === 'error') {
    return <StateBox title="워드클라우드형 다면평가 화면을 불러오지 못했습니다." description={data.message ?? '잠시 후 다시 시도해 주세요.'} />
  }
  if (data.state === 'empty' && !data.permissions?.canManage) {
    return <StateBox title="현재 진행 중인 워드클라우드형 다면평가가 없습니다." description={data.message ?? '관리자에게 운영 주기 개설 여부를 확인해 주세요.'} />
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">평가관리</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">워드클라우드형 다면평가</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              점수형 다면평가와 분리된 키워드 선택 기반 평가입니다. 평가자는 긍정과 부정 키워드를 각각 1개 이상 선택해 제출할 수 있고,
              피평가자는 공개 시점 이후 워드클라우드와 빈도표 중심으로 결과를 확인합니다.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-sm font-medium text-slate-700">주기 선택</label>
            <select
              className={inputClassName}
              value={data.selectedCycleId ?? ''}
              onChange={(event) => updateCycle(event.target.value)}
              disabled={!hasCycleOptions}
            >
              <option value="">{hasCycleOptions ? '주기를 선택해 주세요' : '선택 가능한 주기가 없습니다.'}</option>
              {data.availableCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.year ? `${cycle.year}년 / ` : ''}
                  {cycle.name}
                </option>
              ))}
            </select>
            {isCreateMode ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                선택 가능한 주기가 없습니다. 아래에서 첫 주기를 생성해 주세요.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {data.alerts?.length ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          <div className="font-semibold">일부 운영 데이터를 기본값으로 표시 중입니다.</div>
          <ul className="mt-2 space-y-1">
            {data.alerts.map((alert) => (
              <li key={`${alert.title}-${alert.description}`}>- {alert.title}: {alert.description}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {notice ? (
        <section
          className={`rounded-3xl border p-4 text-sm shadow-sm ${
            notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {notice.message}
        </section>
      ) : null}

      {hasSelectedCycle ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="대상자 수" value={`${data.summary?.targetCount ?? 0}명`} description="이번 주기에 편성된 피평가자 수입니다." />
        <MetricCard label="편성 수" value={`${data.summary?.assignmentCount ?? 0}건`} description="평가자-피평가자 편성 건수입니다." />
        <MetricCard label="제출 응답" value={`${data.summary?.submittedResponseCount ?? 0}건`} description="최종 제출된 응답 수입니다." />
        <MetricCard
          label="공개 상태"
          value={data.summary?.published ? '공개됨' : '비공개'}
          description={`공개 기준 ${data.summary?.privacyThreshold ?? 0}명 / 기준 충족 대상 ${data.summary?.thresholdMetTargetCount ?? 0}명 / 선택 규칙 ${data.summary?.positiveSelectionLimit ?? 10}+${data.summary?.negativeSelectionLimit ?? 10}`}
        />
      </section> : (
        <section className={cardClassName}>
          <h2 className="text-lg font-semibold text-slate-950">아직 선택된 주기가 없습니다.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            선택 가능한 주기가 없습니다. 아래에서 첫 주기를 생성해 주세요.
          </p>
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <TabButton key={tab.key} active={activeTab === tab.key} label={tab.label} onClick={() => setActiveTab(tab.key)} />
        ))}
      </section>

      {activeTab === 'overview' ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <article className={cardClassName}>
            <h2 className="text-xl font-semibold text-slate-950">운영 원칙</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>- 평가자는 피평가자별로 긍정 키워드와 부정 키워드를 각각 선택합니다.</li>
              <li>- 점수 합산 대신 키워드 빈도와 워드클라우드 중심으로 결과를 해석합니다.</li>
              <li>- 응답 수가 최소 공개 기준보다 적으면 결과를 숨겨 익명성을 보호합니다.</li>
              <li>- 기존 점수형 360 다면평가 화면은 별도 메뉴로 유지됩니다.</li>
            </ul>
          </article>
          <article className={cardClassName}>
            <h2 className="text-xl font-semibold text-slate-950">내 상태</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>평가자 응답 가능: {data.permissions?.canEvaluate ? '예' : '아니오'}</div>
              <div>내 결과 보기: {data.permissions?.canViewOwnResult ? '예' : '아니오'}</div>
              <div>관리자 운영 권한: {data.permissions?.canManage ? '예' : '아니오'}</div>
              <div>현재 부여된 주기: {data.availableCycles.find((cycle) => cycle.id === data.selectedCycleId)?.name ?? '없음'}</div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === 'evaluator' ? (
        <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <article className={cardClassName}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-950">내 응답 대상</h2>
              <span className="text-sm text-slate-500">{filteredAssignments.length}건</span>
            </div>
            <input
              className={`${inputClassName} mt-4`}
              value={assignmentSearch}
              onChange={(event) => setAssignmentSearch(event.target.value)}
              placeholder="이름 또는 부서 검색"
            />
            <div className="mt-4 space-y-3">
              {filteredAssignments.map((assignment) => (
                <button
                  key={assignment.assignmentId}
                  type="button"
                  onClick={() => {
                    setSelectedAssignmentId(assignment.assignmentId)
                    setPositiveSelections(assignment.selectedPositiveKeywordIds)
                    setNegativeSelections(assignment.selectedNegativeKeywordIds)
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    selectedAssignment?.assignmentId === assignment.assignmentId
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-semibold text-slate-900">{assignment.evaluateeName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {assignment.department} / {groupLabels[assignment.evaluatorGroup] ?? assignment.evaluatorGroup}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    상태 {assignment.status} / 긍정 {assignment.selectedPositiveKeywordIds.length} / 부정 {assignment.selectedNegativeKeywordIds.length}
                  </div>
                </button>
              ))}
              {!filteredAssignments.length ? <StateBox title="평가할 대상이 없습니다." description="현재 배정된 응답 대상이 없습니다." /> : null}
            </div>
          </article>

          <article className={cardClassName}>
            {selectedAssignment ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{selectedAssignment.evaluateeName}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedAssignment.department} / {groupLabels[selectedAssignment.evaluatorGroup] ?? selectedAssignment.evaluatorGroup} 그룹 / 제출 상태 {selectedAssignment.responseStatus ?? '미작성'}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    긍정 키워드 {positiveSelections.length} / {data.evaluatorView?.positiveSelectionLimit ?? 10}
                  </div>
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    부정 키워드 {negativeSelections.length} / {data.evaluatorView?.negativeSelectionLimit ?? 10}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p>긍정 키워드와 부정 키워드는 각각 1개 이상 선택해 주세요.</p>
                  <p className="mt-1">최대 선택 가능 개수는 운영 설정을 따릅니다.</p>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-slate-950">긍정 키워드 선택</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.evaluatorView?.keywordPool.positive.map((keyword) => {
                        const selected = positiveSelections.includes(keyword.keywordId)
                        return (
                          <button
                            key={keyword.keywordId}
                            type="button"
                            disabled={selectedAssignment.responseStatus === 'SUBMITTED'}
                            onClick={() =>
                              toggleSelection('positive', keyword.keywordId, data.evaluatorView?.positiveSelectionLimit ?? 10)
                            }
                            className={`rounded-full border px-3 py-2 text-sm transition ${
                              selected ? 'border-emerald-700 bg-emerald-600 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            }`}
                          >
                            {keyword.keyword}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-slate-950">부정 키워드 선택</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.evaluatorView?.keywordPool.negative.map((keyword) => {
                        const selected = negativeSelections.includes(keyword.keywordId)
                        return (
                          <button
                            key={keyword.keywordId}
                            type="button"
                            disabled={selectedAssignment.responseStatus === 'SUBMITTED'}
                            onClick={() =>
                              toggleSelection('negative', keyword.keywordId, data.evaluatorView?.negativeSelectionLimit ?? 10)
                            }
                            className={`rounded-full border px-3 py-2 text-sm transition ${
                              selected ? 'border-rose-700 bg-rose-600 text-white' : 'border-rose-200 bg-rose-50 text-rose-900'
                            }`}
                          >
                            {keyword.keyword}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isPending || selectedAssignment.responseStatus === 'SUBMITTED'}
                    className={secondaryButtonClassName}
                    onClick={() =>
                      mutate(
                        () =>
                          callAction('saveResponse', {
                            assignmentId: selectedAssignment.assignmentId,
                            positiveKeywordIds: positiveSelections,
                            negativeKeywordIds: negativeSelections,
                            submitFinal: false,
                          }),
                        '응답 초안을 저장했습니다.'
                      )
                    }
                  >
                    초안 저장
                  </button>
                  <button
                    type="button"
                    disabled={isPending || selectedAssignment.responseStatus === 'SUBMITTED' || !canSubmitFinal}
                    className={primaryButtonClassName}
                    onClick={() =>
                      mutate(
                        async () => {
                          const riskHeaders = await requestRiskConfirmation({
                            actionName: 'FINAL_SUBMIT',
                            actionLabel: '워드클라우드 360 최종 제출',
                            targetLabel: selectedAssignment.evaluateeName,
                            detail:
                              '현재 마스터 로그인 상태에서 워드클라우드 360 응답을 최종 제출합니다.',
                            confirmationText: '제출',
                          })
                          if (riskHeaders === null) {
                            throw createCancelledError()
                          }
                          return callAction(
                            'saveResponse',
                            {
                              assignmentId: selectedAssignment.assignmentId,
                              positiveKeywordIds: positiveSelections,
                              negativeKeywordIds: negativeSelections,
                              submitFinal: true,
                            },
                            riskHeaders
                          )
                        },
                        '응답을 최종 제출했습니다.'
                      )
                    }
                  >
                    최종 제출
                  </button>
                </div>
              </div>
            ) : (
              <StateBox title="선택된 평가 대상이 없습니다." description="왼쪽 목록에서 응답할 대상을 선택해 주세요." />
            )}
          </article>
        </section>
      ) : null}

      {activeTab === 'results' ? (
        <div className="space-y-6">
          <article className={cardClassName}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">내 결과</h2>
                <p className="mt-2 text-sm text-slate-500">평가자 익명성을 유지한 상태로 워드클라우드와 빈도표를 제공합니다.</p>
              </div>
              <div className="w-full max-w-xs">
                <label className="mb-2 block text-sm font-medium text-slate-700">평가자 그룹 필터</label>
                <select
                  className={inputClassName}
                  value={data.evaluateeView?.selectedGroup ?? 'ALL'}
                  onChange={(event) => updateGroup(event.target.value)}
                >
                  {data.evaluateeView?.availableGroups.map((group) => (
                    <option key={group} value={group}>
                      {groupLabels[group] ?? group}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </article>

          {data.evaluateeView?.resultVisible ? (
            <>
              <section className="grid gap-4 md:grid-cols-3">
                <MetricCard label="총 응답 수" value={`${data.evaluateeView.responseCount}건`} description="공개 기준을 충족한 최종 제출 응답 수입니다." />
                <MetricCard label="긍정 선택 수" value={`${data.evaluateeView.positiveSelectionCount}개`} description="긍정 키워드 총 선택 횟수입니다." />
                <MetricCard label="부정 선택 수" value={`${data.evaluateeView.negativeSelectionCount}개`} description="부정 키워드 총 선택 횟수입니다." />
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <WordCloudCloud title="긍정 워드클라우드" items={data.evaluateeView.positiveCloud} tone="positive" />
                <WordCloudCloud title="부정 워드클라우드" items={data.evaluateeView.negativeCloud} tone="negative" />
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <KeywordTable title="Top 10 긍정 키워드" items={data.evaluateeView.positiveTopKeywords} />
                <KeywordTable title="Top 10 부정 키워드" items={data.evaluateeView.negativeTopKeywords} />
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <article className={cardClassName}>
                  <h3 className="text-lg font-semibold text-slate-950">카테고리 분포</h3>
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={70} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0f172a" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                <article className={cardClassName}>
                  <h3 className="text-lg font-semibold text-slate-950">평가자 그룹별 응답 수</h3>
                  <div className="mt-4 space-y-3">
                    {data.evaluateeView.evaluatorGroupSummary.map((item) => (
                      <div key={item.evaluatorGroup} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="text-slate-950">{item.responseCount}건</span>
                      </div>
                    ))}
                  </div>
                </article>
              </section>
            </>
          ) : (
            <StateBox title="아직 공개할 수 있는 결과가 없습니다." description={data.evaluateeView?.hiddenReason ?? '결과 공개 전이거나 응답 수가 기준에 미달합니다.'} />
          )}
        </div>
      ) : null}

      {activeTab === 'admin' ? (
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className={cardClassName}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-950">운영 개요</h2>
                <button
                  type="button"
                  disabled={isPending}
                  className={secondaryButtonClassName}
                  onClick={() => mutate(() => callAction('seedKeywords', {}), '기본 키워드 예시를 불러왔습니다.')}
                >
                  기본 키워드 불러오기
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">연결 PMS 평가 주기</label>
                  <select
                    className={inputClassName}
                    value={cycleForm.evalCycleId}
                    onChange={(event) => setCycleForm((current) => ({ ...current, evalCycleId: event.target.value }))}
                  >
                    <option value="">선택 안 함</option>
                    {data.availableEvalCycles?.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.year}년 / {cycle.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">주기명</label>
                  <input
                    className={inputClassName}
                    value={cycleForm.cycleName}
                    onChange={(event) => setCycleForm((current) => ({ ...current, cycleName: event.target.value }))}
                    placeholder="예: 2026 상반기 워드클라우드 다면평가"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">시작일</label>
                  <input className={inputClassName} type="datetime-local" value={cycleForm.startDate} onChange={(event) => setCycleForm((current) => ({ ...current, startDate: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">종료일</label>
                  <input className={inputClassName} type="datetime-local" value={cycleForm.endDate} onChange={(event) => setCycleForm((current) => ({ ...current, endDate: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">긍정 선택 수</label>
                  <input className={inputClassName} type="number" min={1} max={30} value={cycleForm.positiveSelectionLimit} onChange={(event) => setCycleForm((current) => ({ ...current, positiveSelectionLimit: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">부정 선택 수</label>
                  <input className={inputClassName} type="number" min={1} max={30} value={cycleForm.negativeSelectionLimit} onChange={(event) => setCycleForm((current) => ({ ...current, negativeSelectionLimit: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">공개 최소 응답 수</label>
                  <input className={inputClassName} type="number" min={3} max={10} value={cycleForm.resultPrivacyThreshold} onChange={(event) => setCycleForm((current) => ({ ...current, resultPrivacyThreshold: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">상태</label>
                  <select className={inputClassName} value={cycleForm.status} onChange={(event) => setCycleForm((current) => ({ ...current, status: event.target.value as typeof current.status }))}>
                    <option value="DRAFT">준비중</option>
                    <option value="OPEN">응답 진행</option>
                    <option value="CLOSED">마감</option>
                    <option value="PUBLISHED">결과 공개</option>
                    <option value="ARCHIVED">보관</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">운영 메모</label>
                <textarea className={`${inputClassName} min-h-24`} value={cycleForm.notes} onChange={(event) => setCycleForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {isCreateMode ? (
                  <button
                    type="button"
                    disabled={isPending || !cycleForm.cycleName.trim()}
                    className={primaryButtonClassName}
                    onClick={saveCycle}
                  >
                    저장
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isPending || !cycleForm.cycleName.trim()}
                  className={isCreateMode ? 'hidden' : primaryButtonClassName}
                  onClick={() =>
                    mutate(
                      () => callAction('upsertCycle', toWordCloudCyclePayload(cycleForm)),
                      cycleForm.cycleId ? '주기 정보를 수정했습니다.' : '주기를 생성했습니다.'
                    )
                  }
                >
                  저장
                </button>
                {data.selectedCycleId ? (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      className={secondaryButtonClassName}
                      onClick={() =>
                        mutate(
                          async () => {
                            const riskHeaders = await requestRiskConfirmation({
                              actionName: 'PUBLISH_RESULT',
                              actionLabel: '워드클라우드 결과 공개',
                              targetLabel: selectedCycleName,
                              detail:
                                '현재 마스터 로그인 상태에서 워드클라우드 결과 공개 상태를 변경합니다.',
                              confirmationText: '공개',
                            })
                            if (riskHeaders === null) {
                              throw createCancelledError()
                            }
                            return callAction(
                              'publishResults',
                              { cycleId: data.selectedCycleId, publish: true },
                              riskHeaders
                            )
                          },
                          '결과를 공개했습니다.'
                        )
                      }
                    >
                      결과 공개
                    </button>
                    <button type="button" className={secondaryButtonClassName} onClick={() => openExportModal('xlsx')}>
                      XLSX 내보내기
                    </button>
                  </>
                ) : null}
              </div>
            </article>

            <article className={cardClassName}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-950">키워드 풀 관리</h2>
                <Link className={secondaryButtonClassName} href="/api/evaluation/word-cloud-360/keywords/template" prefetch={false}>
                  CSV 템플릿 다운로드
                </Link>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className={inputClassName}
                    value={keywordForm.keywordCode}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, keywordCode: event.target.value }))}
                    placeholder="키워드 코드"
                  />
                  <input
                    className={inputClassName}
                    value={keywordForm.keyword}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, keyword: event.target.value }))}
                    placeholder="키워드"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className={inputClassName}
                    value={keywordForm.polarity}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, polarity: event.target.value }))}
                  >
                    <option value="POSITIVE">긍정</option>
                    <option value="NEGATIVE">부정</option>
                  </select>
                  <select
                    className={inputClassName}
                    value={keywordForm.category}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    <option value="ATTITUDE">태도</option>
                    <option value="ABILITY">역량</option>
                    <option value="BOTH">태도/역량</option>
                    <option value="OTHER">기타</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className={inputClassName}
                    value={keywordForm.sourceType}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, sourceType: event.target.value }))}
                  >
                    <option value="DOCUMENT_FINAL">문서 확정</option>
                    <option value="EXTRA_GOVERNANCE">거버넌스 추가</option>
                    <option value="ADMIN_ADDED">관리자 추가</option>
                    <option value="IMPORTED">CSV 업로드</option>
                  </select>
                  <input
                    className={inputClassName}
                    type="number"
                    min={0}
                    value={keywordForm.displayOrder}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))}
                    placeholder="표시 순서"
                  />
                </div>
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={keywordForm.note}
                  onChange={(event) => setKeywordForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="메모"
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={keywordForm.warningFlag}
                    onChange={(event) => setKeywordForm((current) => ({ ...current, warningFlag: event.target.checked }))}
                  />
                  민감 키워드 표시
                </label>
                <button
                  type="button"
                  disabled={isPending || !keywordForm.keyword.trim()}
                  className={primaryButtonClassName}
                  onClick={() => mutate(() => callAction('upsertKeyword', keywordForm), '키워드를 저장했습니다.')}
                >
                  키워드 저장
                </button>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">CSV 업로드</h3>
                    <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                      <p>- UTF-8 BOM CSV를 사용하면 Excel에서 한글이 안정적으로 열립니다.</p>
                      <p>- 필수 컬럼은 `keyword`, `polarity`, `active` 입니다.</p>
                      <p>- 적용 시 유효한 행만 반영되고, 오류가 있는 행은 제외됩니다.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={secondaryButtonClassName} disabled={!keywordImportResult} onClick={resetKeywordImport}>
                      취소
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={isPending || !keywordUploadFile}
                      onClick={() => runKeywordImport('preview')}
                    >
                      업로드 미리보기
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      disabled={isPending || !canApplyKeywordImport}
                      onClick={() => runKeywordImport('apply')}
                    >
                      적용
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className={inputClassName}
                    onChange={(event) => {
                      setKeywordUploadFile(event.target.files?.[0] ?? null)
                      setKeywordImportResult(null)
                    }}
                  />
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    {keywordUploadFile ? `선택 파일: ${keywordUploadFile.name}` : '업로드할 CSV 파일을 선택하세요.'}
                  </div>
                </div>

                {keywordImportResult ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      <MetricCard label="전체 행" value={`${keywordImportResult.summary.totalRows}`} description="빈 행은 자동으로 제외됩니다." />
                      <MetricCard label="유효 행" value={`${keywordImportResult.summary.validRows}`} description="현재 규칙을 통과한 행입니다." />
                      <MetricCard label="오류 행" value={`${keywordImportResult.summary.invalidRows}`} description="오류가 있는 행은 반영되지 않습니다." />
                      <MetricCard label="생성 예정" value={`${keywordImportResult.summary.createCount}`} description="새로 추가될 키워드입니다." />
                      <MetricCard label="수정 예정" value={`${keywordImportResult.summary.updateCount}`} description="기존 키워드를 갱신합니다." />
                      <MetricCard label="비활성화 예정" value={`${keywordImportResult.summary.deactivateCount}`} description="active=FALSE 행입니다." />
                    </div>

                    {keywordImportResult.applyResult ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        생성 {keywordImportResult.applyResult.createdCount}건, 수정 {keywordImportResult.applyResult.updatedCount}건,
                        비활성화 {keywordImportResult.applyResult.deactivatedCount}건, 유지 {keywordImportResult.applyResult.unchangedCount}건을 반영했습니다.
                      </div>
                    ) : null}

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-slate-500">
                          <tr>
                            <th className="px-3 py-2">행</th>
                            <th className="px-3 py-2">keyword_code</th>
                            <th className="px-3 py-2">키워드</th>
                            <th className="px-3 py-2">극성</th>
                            <th className="px-3 py-2">예정 작업</th>
                            <th className="px-3 py-2">결과</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keywordImportRowsToShow.map((row) => (
                            <tr key={`${row.rowNumber}-${row.keywordCode ?? row.keyword}`} className="border-t border-slate-100 align-top">
                              <td className="px-3 py-3 text-slate-700">{row.rowNumber}</td>
                              <td className="px-3 py-3 text-slate-700">{row.keywordCode ?? '-'}</td>
                              <td className="px-3 py-3 font-medium text-slate-900">{row.keyword || '-'}</td>
                              <td className="px-3 py-3 text-slate-700">{row.polarity === 'POSITIVE' ? '긍정' : row.polarity === 'NEGATIVE' ? '부정' : '-'}</td>
                              <td className="px-3 py-3 text-slate-700">
                                {row.action === 'create'
                                  ? '생성'
                                  : row.action === 'update'
                                    ? '수정'
                                    : row.action === 'deactivate'
                                      ? '비활성화'
                                      : '유지'}
                              </td>
                              <td className="px-3 py-3">
                                <div className="space-y-1">
                                  <div className={row.valid ? 'text-emerald-700' : 'text-rose-700'}>
                                    {row.valid ? '반영 가능' : '오류 있음'}
                                  </div>
                                  {row.issues.map((issue, index) => (
                                    <div key={`${row.rowNumber}-${issue.field}-${index}`} className="text-rose-700">
                                      [{issue.field}] {issue.message}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {!keywordImportRowsToShow.length ? (
                            <tr>
                              <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                                유효한 행이 없습니다.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          </section>

          <section className={cardClassName}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950">평가자/피평가자 편성</h2>
              {data.selectedCycleId ? (
                <button
                  type="button"
                  disabled={isPending}
                  className={secondaryButtonClassName}
                  onClick={() =>
                    mutate(
                      async () => {
                        const riskHeaders = await requestRiskConfirmation({
                          actionName: 'UPLOAD_APPLY',
                          actionLabel: '워드클라우드 기본 편성 생성',
                          targetLabel: selectedCycleName,
                          detail:
                            '현재 마스터 로그인 상태에서 기본 편성을 생성하고 실제 데이터에 반영합니다.',
                          confirmationText: '적용',
                        })
                        if (riskHeaders === null) {
                          throw createCancelledError()
                        }
                        return callAction(
                          'autoAssign',
                          {
                            cycleId: data.selectedCycleId,
                            includeSelf: false,
                            peerLimit: 3,
                            subordinateLimit: 3,
                          },
                          riskHeaders
                        )
                      },
                      '기본 편성을 생성했습니다.'
                    )
                  }
                >
                  기본 편성 생성
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
              <select className={inputClassName} value={assignmentForm.evaluatorId} onChange={(event) => setAssignmentForm((current) => ({ ...current, evaluatorId: event.target.value }))}>
                <option value="">평가자 선택</option>
                {data.adminView?.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} / {employee.department}</option>
                ))}
              </select>
              <select className={inputClassName} value={assignmentForm.evaluateeId} onChange={(event) => setAssignmentForm((current) => ({ ...current, evaluateeId: event.target.value }))}>
                <option value="">피평가자 선택</option>
                {data.adminView?.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name} / {employee.department}</option>
                ))}
              </select>
              <select className={inputClassName} value={assignmentForm.evaluatorGroup} onChange={(event) => setAssignmentForm((current) => ({ ...current, evaluatorGroup: event.target.value }))}>
                <option value="MANAGER">상사</option>
                <option value="PEER">동료</option>
                <option value="SUBORDINATE">구성원</option>
                <option value="SELF">자기평가</option>
              </select>
              <button
                type="button"
                disabled={isPending || !data.selectedCycleId || !assignmentForm.evaluatorId || !assignmentForm.evaluateeId}
                className={primaryButtonClassName}
                onClick={() =>
                  mutate(
                      async () => {
                        const riskHeaders = await requestRiskConfirmation({
                          actionName: 'UPLOAD_APPLY',
                          actionLabel: '워드클라우드 평가자 편성 저장',
                          targetLabel: selectedCycleName,
                          detail:
                            '현재 마스터 로그인 상태에서 평가자 편성 변경 내용을 실제 데이터에 반영합니다.',
                          confirmationText: '적용',
                        })
                        if (riskHeaders === null) {
                          throw createCancelledError()
                        }
                        return callAction(
                          'saveAssignments',
                          {
                            cycleId: data.selectedCycleId,
                            assignments: [
                              {
                                cycleId: data.selectedCycleId,
                                evaluatorId: assignmentForm.evaluatorId,
                                evaluateeId: assignmentForm.evaluateeId,
                                evaluatorGroup: assignmentForm.evaluatorGroup,
                              },
                            ],
                          },
                          riskHeaders
                        )
                      },
                    '편성을 저장했습니다.'
                  )
                }
              >
                편성 추가
              </button>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">피평가자</th>
                    <th className="pb-2 pr-4">평가자</th>
                    <th className="pb-2 pr-4">그룹</th>
                    <th className="pb-2 pr-4">상태</th>
                    <th className="pb-2 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {data.adminView?.assignments.map((assignment) => (
                    <tr key={assignment.assignmentId} className="border-t border-slate-100">
                      <td className="py-2 pr-4 text-slate-900">{assignment.evaluateeName}</td>
                      <td className="py-2 pr-4 text-slate-700">{assignment.evaluatorName}</td>
                      <td className="py-2 pr-4 text-slate-700">{groupLabels[assignment.evaluatorGroup] ?? assignment.evaluatorGroup}</td>
                      <td className="py-2 pr-4 text-slate-500">{assignmentStatusLabels[assignment.status] ?? assignment.status}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {assignment.responseId ? (
                            <button
                              type="button"
                              className={secondaryButtonClassName}
                              disabled={isPending}
                              onClick={() => openHistoryModal(assignment)}
                            >
                              제출 이력
                            </button>
                          ) : null}
                          {assignment.status === 'SUBMITTED' ? (
                            <button
                              type="button"
                              className={secondaryButtonClassName}
                              disabled={isPending}
                              onClick={() => openRevertModal(assignment)}
                            >
                              최종 제출 취소
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={isPending}
                            onClick={() =>
                              mutate(
                                async () => {
                                  const riskHeaders = await requestRiskConfirmation({
                                    actionName: 'DELETE_RECORD',
                                    actionLabel: '워드클라우드 평가자 편성 삭제',
                                    targetLabel: `${assignment.evaluateeName} / ${assignment.evaluatorName}`,
                                    detail:
                                      '현재 마스터 로그인 상태에서 평가자 편성을 삭제합니다. 이 작업은 실제 데이터에 반영됩니다.',
                                    confirmationText: '삭제',
                                  })
                                  if (riskHeaders === null) {
                                    throw createCancelledError()
                                  }
                                  return callAction(
                                    'deleteAssignment',
                                    { assignmentId: assignment.assignmentId },
                                    riskHeaders
                                  )
                                },
                                '편성을 삭제했습니다.'
                              )
                            }
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">대상자 엑셀 일괄 지정</h3>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                    <p>- `employee_number` 컬럼이 포함된 CSV, XLSX, XLS 파일을 지원합니다.</p>
                    <p>- 정상 행만 반영하고, 실패한 행은 아래 표에서 확인할 수 있습니다.</p>
                    <p>- 기존 수동 배정은 유지하고, 필요한 배정만 추가로 생성합니다.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondaryButtonClassName} disabled={!targetUploadFile && !targetUploadResult} onClick={resetTargetUpload}>
                    초기화
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={isPending || !targetUploadFile || !data.selectedCycleId}
                    onClick={runTargetUpload}
                  >
                    대상자 업로드
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className={inputClassName}
                  onChange={(event) => {
                    setTargetUploadFile(event.target.files?.[0] ?? null)
                    setTargetUploadResult(null)
                  }}
                />
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {targetUploadFile ? `선택 파일: ${targetUploadFile.name}` : '업로드할 대상자 파일을 선택해 주세요.'}
                </div>
              </div>

              {!hasSelectedCycle ? (
                <p className="mt-3 text-sm text-slate-500">대상자 일괄 업로드는 주기를 생성하거나 선택한 뒤에만 사용할 수 있습니다.</p>
              ) : null}

              {targetUploadResult ? (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <MetricCard label="전체 행" value={`${targetUploadResult.summary.totalRows}`} description="빈 행은 자동으로 제외됩니다." />
                    <MetricCard label="정상 행" value={`${targetUploadResult.summary.validRows}`} description="배정 계산 대상 행입니다." />
                    <MetricCard label="실패 행" value={`${targetUploadResult.summary.invalidRows}`} description="오류가 있는 행은 반영하지 않습니다." />
                    <MetricCard label="대상자 수" value={`${targetUploadResult.summary.targetCount}`} description="중복을 제거한 실제 대상자 수입니다." />
                    <MetricCard label="신규 배정" value={`${targetUploadResult.summary.createdAssignmentCount}`} description="이번 업로드로 새로 만든 배정입니다." />
                    <MetricCard label="기존 유지" value={`${targetUploadResult.summary.existingAssignmentCount}`} description="이미 있던 배정은 그대로 유지합니다." />
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-slate-500">
                        <tr>
                          <th className="px-3 py-2">행</th>
                          <th className="px-3 py-2">사번</th>
                          <th className="px-3 py-2">이름</th>
                          <th className="px-3 py-2">조직</th>
                          <th className="px-3 py-2">신규 배정</th>
                          <th className="px-3 py-2">기존 유지</th>
                          <th className="px-3 py-2">결과</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetUploadRowsToShow.map((row) => (
                          <tr key={`${row.rowNumber}-${row.employeeNumber}`} className="border-t border-slate-100 align-top">
                            <td className="px-3 py-3 text-slate-700">{row.rowNumber}</td>
                            <td className="px-3 py-3 text-slate-700">{row.employeeNumber || '-'}</td>
                            <td className="px-3 py-3 font-medium text-slate-900">{row.employeeName ?? '-'}</td>
                            <td className="px-3 py-3 text-slate-700">{row.department ?? '-'}</td>
                            <td className="px-3 py-3 text-slate-700">{row.createdAssignmentCount}</td>
                            <td className="px-3 py-3 text-slate-700">{row.existingAssignmentCount}</td>
                            <td className="px-3 py-3">
                              <div className="space-y-1">
                                <div className={row.valid ? 'text-emerald-700' : 'text-rose-700'}>
                                  {row.valid ? `반영 완료 (${row.groups.join(', ') || '배정 없음'})` : '오류 있음'}
                                </div>
                                {row.issues.map((issue, index) => (
                                  <div key={`${row.rowNumber}-${issue.field}-${index}`} className="text-rose-700">
                                    [{issue.field}] {issue.message}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!targetUploadRowsToShow.length ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                              표시할 업로드 결과가 없습니다.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">과거/현재 서베이 비교</h3>
                    <div className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                      <p>- 과거 서베이 결과 파일을 업로드하면 현재 주기와 조직별 비교 리포트를 생성합니다.</p>
                      <p>- `employee_number`, `department`, `response_count`, `threshold_met`, `polarity`, `keyword`, `count` 컬럼을 확인합니다.</p>
                      <p>- 익명성 기준을 만족하지 않은 과거/현재 데이터는 비교 인사이트에서 자동으로 제외합니다.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={!comparisonUploadFile && !comparisonReport}
                      onClick={() => {
                        setComparisonUploadFile(null)
                        setComparisonReport(null)
                      }}
                    >
                      초기화
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      disabled={isPending || !comparisonUploadFile || !data.selectedCycleId}
                      onClick={runComparisonReport}
                    >
                      비교 리포트 생성
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className={inputClassName}
                    onChange={(event) => {
                      setComparisonUploadFile(event.target.files?.[0] ?? null)
                      setComparisonReport(null)
                    }}
                  />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {comparisonUploadFile
                      ? `선택 파일: ${comparisonUploadFile.name}`
                      : '비교할 과거 결과 파일을 선택해 주세요.'}
                  </div>
                </div>

                {!hasSelectedCycle ? (
                  <p className="mt-3 text-sm text-slate-500">비교 리포트는 현재 주기를 생성하거나 선택한 뒤에만 생성할 수 있습니다.</p>
                ) : null}

                {comparisonReport ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      <MetricCard
                        label="비교 조직 수"
                        value={`${comparisonReport.summary.comparedDepartmentCount}`}
                        description="과거와 현재를 모두 비교할 수 있는 조직 수입니다."
                      />
                      <MetricCard
                        label="과거 응답 수"
                        value={`${comparisonReport.summary.baselineResponseCount}`}
                        description="업로드한 과거 결과에서 익명성 기준을 통과한 응답 수입니다."
                      />
                      <MetricCard
                        label="현재 응답 수"
                        value={`${comparisonReport.summary.currentResponseCount}`}
                        description="현재 주기에서 비교에 활용한 응답 수입니다."
                      />
                      <MetricCard
                        label="과거 비공개 행"
                        value={`${comparisonReport.summary.hiddenBaselineRows}`}
                        description="익명성 기준을 충족하지 못해 제외한 과거 행 수입니다."
                      />
                      <MetricCard
                        label="현재 비공개 조직"
                        value={`${comparisonReport.summary.hiddenCurrentDepartments}`}
                        description="현재 주기에서 익명성 기준 미달로 제외한 조직 수입니다."
                      />
                      <MetricCard
                        label="응답 변화 최대"
                        value={
                          comparisonReport.summary.largestResponseChange
                            ? `${comparisonReport.summary.largestResponseChange.department} (${comparisonReport.summary.largestResponseChange.delta > 0 ? '+' : ''}${comparisonReport.summary.largestResponseChange.delta})`
                            : '-'
                        }
                        description="응답 수 변화가 가장 큰 조직입니다."
                      />
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-slate-500">
                          <tr>
                            <th className="px-3 py-2">조직</th>
                            <th className="px-3 py-2">과거 응답</th>
                            <th className="px-3 py-2">현재 응답</th>
                            <th className="px-3 py-2">변화</th>
                            <th className="px-3 py-2">긍정 상위 키워드</th>
                            <th className="px-3 py-2">부정 상위 키워드</th>
                            <th className="px-3 py-2">인사이트</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonRowsToShow.map((department) => (
                            <tr key={department.department} className="border-t border-slate-100 align-top">
                              <td className="px-3 py-3 font-medium text-slate-900">{department.department}</td>
                              <td className="px-3 py-3 text-slate-700">{department.baselineResponseCount}</td>
                              <td className="px-3 py-3 text-slate-700">{department.currentResponseCount}</td>
                              <td className="px-3 py-3 text-slate-700">
                                {department.responseDelta > 0 ? '+' : ''}
                                {department.responseDelta}
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                {department.currentTopPositiveKeywords.join(', ') || '-'}
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                {department.currentTopNegativeKeywords.join(', ') || '-'}
                              </td>
                              <td className="px-3 py-3 text-slate-600">{department.insight}</td>
                            </tr>
                          ))}
                          {!comparisonRowsToShow.length ? (
                            <tr>
                              <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                                비교 리포트 결과가 없습니다.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <article className={cardClassName}>
              <h2 className="text-xl font-semibold text-slate-950">키워드 풀 현황</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="pb-2 pr-4">코드</th>
                      <th className="pb-2 pr-4">키워드</th>
                      <th className="pb-2 pr-4">극성</th>
                      <th className="pb-2 pr-4">카테고리</th>
                      <th className="pb-2 pr-4">출처</th>
                      <th className="pb-2 pr-4">상태</th>
                      <th className="pb-2 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.adminView?.keywordPool.map((keyword) => (
                      <tr key={keyword.keywordId} className="border-t border-slate-100">
                        <td className="py-2 pr-4 text-slate-700">{keyword.keywordCode ?? '-'}</td>
                        <td className="py-2 pr-4 text-slate-900">{keyword.keyword}</td>
                        <td className="py-2 pr-4 text-slate-700">{keyword.polarityLabel}</td>
                        <td className="py-2 pr-4 text-slate-700">{keyword.categoryLabel}</td>
                        <td className="py-2 pr-4 text-slate-500">{keyword.sourceTypeLabel ?? sourceTypeLabels[keyword.sourceType] ?? keyword.sourceType}</td>
                        <td className="py-2 pr-4 text-slate-500">{keyword.active ? '활성' : '비활성'}</td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className={secondaryButtonClassName}
                              onClick={() =>
                                setKeywordForm({
                                  keywordId: keyword.keywordId,
                                  keywordCode: keyword.keywordCode ?? '',
                                  keyword: keyword.keyword,
                                  polarity: keyword.polarity,
                                  category: keyword.category,
                                  sourceType: keyword.sourceType,
                                  active: keyword.active,
                                  displayOrder: keyword.displayOrder,
                                  warningFlag: keyword.warningFlag,
                                  note: keyword.note ?? '',
                                })
                              }
                            >
                              편집
                            </button>
                            <button
                              type="button"
                              className={secondaryButtonClassName}
                              onClick={() =>
                                mutate(
                                  () =>
                                    callAction('upsertKeyword', {
                                      keywordId: keyword.keywordId,
                                      keywordCode: keyword.keywordCode ?? '',
                                      keyword: keyword.keyword,
                                      polarity: keyword.polarity,
                                      category: keyword.category,
                                      sourceType: keyword.sourceType,
                                      active: !keyword.active,
                                      displayOrder: keyword.displayOrder,
                                      warningFlag: keyword.warningFlag,
                                      note: keyword.note ?? '',
                                    }),
                                  keyword.active ? '키워드를 비활성화했습니다.' : '키워드를 다시 활성화했습니다.'
                                )
                              }
                            >
                              {keyword.active ? '비활성화' : '활성화'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className={cardClassName}>
              <h2 className="text-xl font-semibold text-slate-950">진행 현황</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>대상자 수</span><span>{data.adminView?.progress.targetCount ?? 0}명</span></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>편성 수</span><span>{data.adminView?.progress.assignmentCount ?? 0}건</span></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>제출 완료 응답</span><span>{data.adminView?.progress.submittedCount ?? 0}건</span></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>임시 저장</span><span>{data.adminView?.progress.draftCount ?? 0}건</span></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>미응답</span><span>{data.adminView?.progress.pendingCount ?? 0}건</span></div>
              </div>
            </article>
          </section>

          <section className={cardClassName}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-950">결과 관리</h2>
              {data.selectedCycleId ? (
                <button type="button" className={secondaryButtonClassName} onClick={() => openExportModal('csv')}>
                  CSV 내보내기
                </button>
              ) : null}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">피평가자</th>
                    <th className="pb-2 pr-4">부서</th>
                    <th className="pb-2 pr-4">응답 수</th>
                    <th className="pb-2 pr-4">공개 가능</th>
                    <th className="pb-2 pr-4">긍정 상위 키워드</th>
                    <th className="pb-2">부정 상위 키워드</th>
                  </tr>
                </thead>
                <tbody>
                  {data.adminView?.results.map((result) => (
                    <tr key={result.evaluateeId} className="border-t border-slate-100 align-top">
                      <td className="py-3 pr-4 font-medium text-slate-900">{result.evaluateeName}</td>
                      <td className="py-3 pr-4 text-slate-700">{result.department}</td>
                      <td className="py-3 pr-4 text-slate-700">{result.responseCount}건</td>
                      <td className="py-3 pr-4 text-slate-700">{result.thresholdMet ? '예' : '아니오'}</td>
                      <td className="py-3 pr-4 text-slate-600">{result.positiveTopKeywords.map((item) => item.keyword).join(', ') || '-'}</td>
                      <td className="py-3 text-slate-600">{result.negativeTopKeywords.map((item) => item.keyword).join(', ') || '-'}</td>
                    </tr>
                  ))}
                  {!data.adminView?.results.length ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        아직 집계된 결과가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {historyTargetAssignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">제출 이력</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  응답 내용은 유지한 채 변경 이력을 확인하고, 필요한 시점으로 다시 열 수 있습니다.
                </p>
              </div>
              <button type="button" className={secondaryButtonClassName} onClick={closeHistoryModal}>
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">평가 응답</div>
                <div className="mt-2 text-slate-900">{historyTargetAssignment.evaluateeName}</div>
                <div className="mt-1 text-xs text-slate-500">평가자 {historyTargetAssignment.evaluatorName}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 주기</div>
                <div className="mt-2 text-slate-900">{data.adminView?.cycle?.cycleName ?? selectedCycleName}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 상태</div>
                <div className="mt-2 text-slate-900">
                  {assignmentStatusLabels[historyTargetAssignment.status] ?? historyTargetAssignment.status}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 선택</div>
                <div className="mt-2 text-slate-900">
                  긍정 {historyTargetAssignment.positiveSelectionCount}개 / 부정 {historyTargetAssignment.negativeSelectionCount}개
                </div>
              </div>
            </div>

            <div className="mt-5 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {historyTargetAssignment.history.map((revision) => (
                <article key={revision.revisionId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        v{revision.revisionNumber}
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">
                        {historyEventLabels[revision.eventType] ?? revision.eventType}
                      </h3>
                      <div className="mt-1 text-sm text-slate-500">
                        {formatDateTime(revision.createdAt)} · {revision.actorName ?? revision.actorUserId ?? '-'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {revision.canRestore ? (
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={isPending}
                          onClick={() => openRestoreModal(historyTargetAssignment, revision)}
                        >
                          이 시점으로 되돌리기
                        </button>
                      ) : (
                        <span className="inline-flex min-h-11 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-400">
                          복원 정보 없음
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">당시 상태</div>
                      <div className="mt-2 text-slate-900">{assignmentStatusLabels[revision.nextStatus ?? ''] ?? revision.nextStatus ?? '-'}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">이전 상태</div>
                      <div className="mt-2 text-slate-900">
                        {assignmentStatusLabels[revision.previousStatus ?? ''] ?? revision.previousStatus ?? '-'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">긍정 선택</div>
                      <div className="mt-2 text-slate-900">{revision.positiveCount}개</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">부정 선택</div>
                      <div className="mt-2 text-slate-900">{revision.negativeCount}개</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">긍정 키워드 미리보기</div>
                      <div className="mt-2 text-slate-900">{selectionPreview(revision.positiveSelections)}</div>
                    </div>
                    <div className="rounded-2xl border border-white bg-white px-4 py-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-700">부정 키워드 미리보기</div>
                      <div className="mt-2 text-slate-900">{selectionPreview(revision.negativeSelections)}</div>
                    </div>
                  </div>

                  {revision.reason ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                      사유: {revision.reason}
                    </div>
                  ) : null}

                  {revision.restoredFromRevisionId ? (
                    <div className="mt-3 text-xs text-slate-500">복원 기준 이력 ID: {revision.restoredFromRevisionId}</div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {restoreTargetAssignment && restoreTargetRevision ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">이 시점으로 되돌리기</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  선택한 이력의 키워드 선택값으로 복원하고, 평가자가 다시 수정할 수 있게 상태를 엽니다.
                </p>
              </div>
              <button type="button" className={secondaryButtonClassName} onClick={closeRestoreModal}>
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">평가 응답</div>
                <div className="mt-2 text-slate-900">{restoreTargetAssignment.evaluateeName}</div>
                <div className="mt-1 text-xs text-slate-500">평가자 {restoreTargetAssignment.evaluatorName}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 주기</div>
                <div className="mt-2 text-slate-900">{data.adminView?.cycle?.cycleName ?? selectedCycleName}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 상태</div>
                <div className="mt-2 text-slate-900">
                  {assignmentStatusLabels[restoreTargetAssignment.status] ?? restoreTargetAssignment.status}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">복원 기준</div>
                <div className="mt-2 text-slate-900">
                  v{restoreTargetRevision.revisionNumber} ·{' '}
                  {historyEventLabels[restoreTargetRevision.eventType] ?? restoreTargetRevision.eventType}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <p>이 작업을 수행하면 평가자가 다시 응답을 수정하고 제출할 수 있습니다.</p>
              <p className="mt-1">기존 응답 내용은 삭제되지 않으며, 변경 이력이 기록됩니다.</p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">긍정 키워드</div>
                <div className="mt-2 text-slate-900">{selectionPreview(restoreTargetRevision.positiveSelections)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">부정 키워드</div>
                <div className="mt-2 text-slate-900">{selectionPreview(restoreTargetRevision.negativeSelections)}</div>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">복원 사유</label>
              <textarea
                className={`${inputClassName} min-h-28`}
                value={restoreReason}
                onChange={(event) => setRestoreReason(event.target.value)}
                placeholder="예: 평가자가 이전 선택값 기준으로 다시 검토할 수 있게 복원합니다."
              />
              <p className="mt-2 text-xs text-slate-500">5자 이상 500자 이하로 입력하면 감사 로그에 함께 남습니다.</p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" className={secondaryButtonClassName} onClick={closeRestoreModal}>
                취소
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={isPending || restoreReason.trim().length < 5}
                onClick={handleRestoreResponseRevision}
              >
                이 시점으로 되돌리기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revertTargetAssignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">최종 제출 취소</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  제출을 되돌리기 전에 대상 응답과 사유를 확인해 주세요.
                </p>
              </div>
              <button type="button" className={secondaryButtonClassName} onClick={closeRevertModal}>
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">평가 응답</div>
                <div className="mt-2 text-slate-900">{revertTargetAssignment.evaluateeName}</div>
                <div className="mt-1 text-xs text-slate-500">평가자: {revertTargetAssignment.evaluatorName}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 주기</div>
                <div className="mt-2 text-slate-900">{data.adminView?.cycle?.cycleName ?? selectedCycleName}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="font-medium text-slate-700">현재 상태</div>
                <div className="mt-2 text-slate-900">
                  {assignmentStatusLabels[revertTargetAssignment.status] ?? revertTargetAssignment.status}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              <p>최종 제출을 취소하면 평가자가 다시 응답을 수정하고 제출할 수 있습니다.</p>
              <p className="mt-1">기존에 선택한 키워드는 유지되며, 최종 제출 상태만 해제됩니다.</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">취소 사유</label>
              <textarea
                className={`${inputClassName} min-h-28`}
                value={revertReason}
                onChange={(event) => setRevertReason(event.target.value)}
                placeholder="예: 평가자 요청으로 응답을 다시 열어 수정할 수 있게 합니다."
              />
              <p className="mt-2 text-xs text-slate-500">5자 이상 500자 이하로 입력하면 감사 로그에 함께 남습니다.</p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" className={secondaryButtonClassName} onClick={closeRevertModal}>
                취소
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={isPending || revertReason.trim().length < 5}
                onClick={handleRevertFinalSubmit}
              >
                최종 제출 취소 실행
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">다운로드 사유 입력</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  주요 데이터를 다운로드하기 전에 사유를 남겨 주세요. 입력한 내용은 감사 로그에 함께 저장됩니다.
                </p>
              </div>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setExportModalOpen(false)
                  setExportReason('')
                }}
              >
                닫기
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              다운로드 형식: <span className="font-semibold text-slate-900">{exportFormat.toUpperCase()}</span>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">다운로드 사유</label>
              <textarea
                className={`${inputClassName} min-h-28`}
                value={exportReason}
                onChange={(event) => setExportReason(event.target.value)}
                placeholder="예: 2026년 상반기 서베이 조직별 비교 보고서 작성"
              />
              <p className="mt-2 text-xs text-slate-500">5자 이상 200자 이하로 입력해 주세요.</p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setExportModalOpen(false)
                  setExportReason('')
                }}
              >
                취소
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={isPending || exportReason.trim().length < 5}
                onClick={handleExportDownload}
              >
                다운로드
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {riskDialog}
    </div>
  )
}
