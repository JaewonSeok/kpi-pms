'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WordCloud360PageData } from '@/server/word-cloud-360'
import { WordCloudCloud } from './WordCloudCloud'

type TabKey = 'overview' | 'evaluator' | 'results' | 'admin'

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

function readApiBody(body: unknown) {
  if (!body || typeof body !== 'object') return { success: false, error: { message: '응답 형식이 올바르지 않습니다.' } }
  return body as { success: boolean; data?: unknown; error?: { message?: string } }
}

async function callAction(action: string, payload: unknown) {
  const response = await fetch('/api/evaluation/word-cloud-360/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const deferredAssignmentSearch = useDeferredValue(assignmentSearch)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(data.evaluatorView?.assignments[0]?.assignmentId ?? '')
  const [positiveSelections, setPositiveSelections] = useState<string[]>(
    data.evaluatorView?.assignments[0]?.selectedPositiveKeywordIds ?? []
  )
  const [negativeSelections, setNegativeSelections] = useState<string[]>(
    data.evaluatorView?.assignments[0]?.selectedNegativeKeywordIds ?? []
  )
  const [cycleForm, setCycleForm] = useState({
    cycleId: data.adminView?.cycle?.id ?? '',
    evalCycleId: data.adminView?.cycle?.evalCycleId ?? '',
    cycleName: data.adminView?.cycle?.cycleName ?? '',
    startDate: data.adminView?.cycle?.startDate?.slice(0, 16) ?? '',
    endDate: data.adminView?.cycle?.endDate?.slice(0, 16) ?? '',
    positiveSelectionLimit: data.adminView?.cycle?.positiveSelectionLimit ?? 10,
    negativeSelectionLimit: data.adminView?.cycle?.negativeSelectionLimit ?? 10,
    resultPrivacyThreshold: data.adminView?.cycle?.resultPrivacyThreshold ?? 3,
    evaluatorGroups: data.adminView?.cycle?.evaluatorGroups ?? ['MANAGER', 'PEER', 'SUBORDINATE'],
    notes: data.adminView?.cycle?.notes ?? '',
    status: data.adminView?.cycle?.status ?? 'DRAFT',
  })
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
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : '작업을 처리하지 못했습니다.',
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
              점수형 다면평가와 분리된 키워드 선택 기반 평가입니다. 평가자는 긍정 10개, 부정 10개 키워드를 선택하고,
              피평가자는 공개 시점 이후 워드클라우드와 빈도표 중심으로 결과를 확인합니다.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-2 block text-sm font-medium text-slate-700">주기 선택</label>
            <select className={inputClassName} value={data.selectedCycleId ?? ''} onChange={(event) => updateCycle(event.target.value)}>
              <option value="">주기를 선택해 주세요</option>
              {data.availableCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.year ? `${cycle.year}년 / ` : ''}
                  {cycle.name}
                </option>
              ))}
            </select>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="대상자 수" value={`${data.summary?.targetCount ?? 0}명`} description="이번 주기에 편성된 피평가자 수입니다." />
        <MetricCard label="편성 수" value={`${data.summary?.assignmentCount ?? 0}건`} description="평가자-피평가자 편성 건수입니다." />
        <MetricCard label="제출 응답" value={`${data.summary?.submittedResponseCount ?? 0}건`} description="최종 제출된 응답 수입니다." />
        <MetricCard
          label="공개 상태"
          value={data.summary?.published ? '공개됨' : '비공개'}
          description={`공개 기준 ${data.summary?.privacyThreshold ?? 0}명 / 선택 규칙 ${data.summary?.positiveSelectionLimit ?? 10}+${data.summary?.negativeSelectionLimit ?? 10}`}
        />
      </section>

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
                    disabled={isPending || selectedAssignment.responseStatus === 'SUBMITTED'}
                    className={primaryButtonClassName}
                    onClick={() =>
                      mutate(
                        () =>
                          callAction('saveResponse', {
                            assignmentId: selectedAssignment.assignmentId,
                            positiveKeywordIds: positiveSelections,
                            negativeKeywordIds: negativeSelections,
                            submitFinal: true,
                          }),
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
                  <input className={inputClassName} type="number" min={1} max={20} value={cycleForm.resultPrivacyThreshold} onChange={(event) => setCycleForm((current) => ({ ...current, resultPrivacyThreshold: Number(event.target.value) }))} />
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
                <button
                  type="button"
                  disabled={isPending || !cycleForm.cycleName.trim()}
                  className={primaryButtonClassName}
                  onClick={() =>
                    mutate(
                      () => callAction('upsertCycle', cycleForm),
                      cycleForm.cycleId ? '주기 정보를 수정했습니다.' : '주기를 생성했습니다.'
                    )
                  }
                >
                  저장
                </button>
                {data.selectedCycleId ? (
                  <>
                    <button type="button" disabled={isPending} className={secondaryButtonClassName} onClick={() => mutate(() => callAction('publishResults', { cycleId: data.selectedCycleId, publish: true }), '결과를 공개했습니다.')}>
                      결과 공개
                    </button>
                    <a className={secondaryButtonClassName} href={`/api/evaluation/word-cloud-360/export/${encodeURIComponent(data.selectedCycleId)}?format=xlsx`}>
                      XLSX 내보내기
                    </a>
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
                      () =>
                        callAction('autoAssign', {
                          cycleId: data.selectedCycleId,
                          includeSelf: false,
                          peerLimit: 3,
                          subordinateLimit: 3,
                        }),
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
                    () =>
                      callAction('saveAssignments', {
                        cycleId: data.selectedCycleId,
                        assignments: [
                          {
                            cycleId: data.selectedCycleId,
                            evaluatorId: assignmentForm.evaluatorId,
                            evaluateeId: assignmentForm.evaluateeId,
                            evaluatorGroup: assignmentForm.evaluatorGroup,
                          },
                        ],
                      }),
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
                      <td className="py-2 pr-4 text-slate-500">{assignment.status}</td>
                      <td className="py-2 text-right">
                        <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => mutate(() => callAction('deleteAssignment', { assignmentId: assignment.assignmentId }), '편성을 삭제했습니다.')}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>제출 완료</span><span>{data.adminView?.progress.submittedCount ?? 0}건</span></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>임시 저장</span><span>{data.adminView?.progress.draftCount ?? 0}건</span></div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>미응답</span><span>{data.adminView?.progress.pendingCount ?? 0}건</span></div>
              </div>
            </article>
          </section>

          <section className={cardClassName}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-950">결과 관리</h2>
              {data.selectedCycleId ? (
                <a className={secondaryButtonClassName} href={`/api/evaluation/word-cloud-360/export/${encodeURIComponent(data.selectedCycleId)}?format=csv`}>
                  CSV 내보내기
                </a>
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
    </div>
  )
}
