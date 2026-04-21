'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, RefreshCcw, RotateCcw, Save } from 'lucide-react'
import type { PerformanceAssignmentPageData } from '@/server/evaluation-performance-assignments'

type PerformanceAssignmentAdminClientProps = {
  initialData: PerformanceAssignmentPageData
}

type AssignmentRow = NonNullable<PerformanceAssignmentPageData['rows']>[number]

function buildDraftEvaluatorMap(data: PerformanceAssignmentPageData) {
  return Object.fromEntries(
    (data.rows ?? []).map((row) => [`${row.targetId}:${row.evalStage}`, row.evaluatorId ?? ''])
  )
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청을 처리하지 못했습니다.')
  }
  return payload.data as T
}

function formatDateTime(value: string | null) {
  if (!value) return '일정 미설정'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function summaryTone(value: number) {
  if (value <= 0) return 'border-slate-200 bg-slate-50 text-slate-700'
  if (value >= 5) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-blue-200 bg-blue-50 text-blue-800'
}

export function PerformanceAssignmentAdminClient({
  initialData,
}: PerformanceAssignmentAdminClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState(initialData)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<'ALL' | AssignmentRow['evalStage']>('ALL')
  const [sourceFilter, setSourceFilter] = useState<'ALL' | AssignmentRow['assignmentSource']>('ALL')
  const [draftEvaluatorIds, setDraftEvaluatorIds] = useState<Record<string, string>>(
    buildDraftEvaluatorMap(initialData)
  )

  useEffect(() => {
    setData(initialData)
    setDraftEvaluatorIds(buildDraftEvaluatorMap(initialData))
    setNotice('')
    setErrorNotice('')
    setBusyKey(null)
  }, [initialData])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (data.rows ?? []).filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.targetName.toLowerCase().includes(keyword) ||
        row.targetDepartment.toLowerCase().includes(keyword) ||
        row.evaluatorName?.toLowerCase().includes(keyword)

      const matchesStage = stageFilter === 'ALL' || row.evalStage === stageFilter
      const matchesSource = sourceFilter === 'ALL' || row.assignmentSource === sourceFilter
      return matchesKeyword && matchesStage && matchesSource
    })
  }, [data.rows, search, stageFilter, sourceFilter])

  const stageSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of filteredRows) {
      counts.set(row.stageLabel, (counts.get(row.stageLabel) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [filteredRows])

  const optionsByStage = useMemo(() => {
    const map = new Map<AssignmentRow['evalStage'], NonNullable<PerformanceAssignmentPageData['evaluatorOptions']>>()
    for (const option of data.evaluatorOptions ?? []) {
      for (const stage of option.allowedStages) {
        const current = map.get(stage) ?? []
        current.push(option)
        map.set(stage, current)
      }
    }
    return map
  }, [data.evaluatorOptions])

  async function runAction(body: Record<string, unknown>, successMessage: string, nextBusyKey: string) {
    setNotice('')
    setErrorNotice('')
    setBusyKey(nextBusyKey)

    try {
      const response = await fetch('/api/admin/performance-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = parseResponse<{
        page: PerformanceAssignmentPageData
      }>(await response.json().catch(() => null))

      setData(payload.page)
      setDraftEvaluatorIds(buildDraftEvaluatorMap(payload.page))
      setNotice(successMessage)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '배정 작업을 처리하지 못했습니다.')
    } finally {
      setBusyKey(null)
    }
  }

  function moveToCycle(cycleId: string) {
    startTransition(() =>
      router.push(`/admin/performance-assignments?cycleId=${encodeURIComponent(cycleId)}`)
    )
  }

  if (data.state !== 'ready') {
    return (
      <div className="space-y-6">
        <Header selectedCycleId={data.selectedCycleId} />
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {data.state === 'permission-denied'
              ? '접근 권한이 없습니다'
              : data.state === 'empty'
                ? '평가 배정 대상이 없습니다'
                : '배정 현황을 불러오지 못했습니다'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {data.message ?? '평가 주기와 관리자 권한을 확인해 주세요.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/admin/eval-cycle"
              className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              평가 주기 관리
            </Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header selectedCycleId={data.selectedCycleId} />

      {notice ? <Banner tone="success" message={notice} /> : null}
      {errorNotice ? <Banner tone="error" message={errorNotice} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">평가 배정 관리</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                주기별 평가자 배정을 자동 기준으로 동기화하거나, 단계별로 수동 조정할 수 있습니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="전체 배정" value={String(data.summary?.totalCount ?? 0)} />
              <MetricCard label="수동 조정" value={String(data.summary?.manualOverrideCount ?? 0)} />
              <MetricCard label="제출 완료" value={String(data.summary?.submittedCount ?? 0)} />
              <MetricCard label="마감 지연" value={String(data.summary?.overdueCount ?? 0)} />
              <MetricCard label="미배정" value={String(data.summary?.unassignedCount ?? 0)} />
            </div>
          </div>

          <div className="grid w-full gap-3 xl:w-[420px]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">평가 주기</span>
              <select
                value={data.selectedCycleId}
                onChange={(event) => moveToCycle(event.target.value)}
                disabled={isPending}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                {data.availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.year} · {cycle.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  void runAction(
                    {
                      action: 'sync',
                      evalCycleId: data.selectedCycleId,
                    },
                    '자동 배정 기준을 현재 주기에 다시 적용했습니다.',
                    'sync'
                  )
                }
                disabled={!data.selectedCycleId || busyKey !== null}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                자동 동기화
              </button>
              <Link
                href="/admin/eval-cycle"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                주기 관리
              </Link>
              <Link
                href={`/evaluation/performance${data.selectedCycleId ? `?cycleId=${encodeURIComponent(data.selectedCycleId)}` : ''}`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                성과평가 보기
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">검색</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름, 부서, 평가자로 검색"
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">평가 단계</span>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                <option value="ALL">전체 단계</option>
                {[...new Set((data.rows ?? []).map((row) => row.evalStage))].map((stage) => (
                  <option key={stage} value={stage}>
                    {(data.rows ?? []).find((row) => row.evalStage === stage)?.stageLabel ?? stage}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">배정 방식</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
              >
                <option value="ALL">전체 방식</option>
                <option value="AUTO">자동 배정</option>
                <option value="MANUAL">수동 배정</option>
                <option value="UNASSIGNED">미배정</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {stageSummary.map(([label, count]) => (
              <span
                key={label}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${summaryTone(count)}`}
              >
                {label} {count}건
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">대상자</th>
                <th className="px-4 py-3 text-left font-semibold">평가 단계</th>
                <th className="px-4 py-3 text-left font-semibold">평가자 지정</th>
                <th className="px-4 py-3 text-left font-semibold">배정 방식</th>
                <th className="px-4 py-3 text-left font-semibold">평가 상태</th>
                <th className="px-4 py-3 text-left font-semibold">마감 시각</th>
                <th className="px-4 py-3 text-left font-semibold">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const rowKey = `${row.targetId}:${row.evalStage}`
                  const selectedEvaluatorId = draftEvaluatorIds[rowKey] ?? ''
                  const availableOptions = optionsByStage.get(row.evalStage) ?? []
                  const changed = selectedEvaluatorId !== (row.evaluatorId ?? '')

                  return (
                    <tr key={rowKey} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{row.targetName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.targetDepartment} · {row.targetPosition}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {row.stageLabel}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={selectedEvaluatorId}
                          onChange={(event) =>
                            setDraftEvaluatorIds((current) => ({
                              ...current,
                              [rowKey]: event.target.value,
                            }))
                          }
                          className="h-11 w-full min-w-[240px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                        >
                          <option value="">평가자 선택</option>
                          {availableOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name} · {option.department} · {option.position}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 text-xs text-slate-500">
                          현재 배정: {row.evaluatorName ? `${row.evaluatorName} · ${row.evaluatorDepartment}` : '미배정'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            row.assignmentSource === 'MANUAL'
                              ? 'bg-amber-100 text-amber-800'
                              : row.assignmentSource === 'AUTO'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.assignmentSourceLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">{row.evaluationStatusLabel}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.updatedAt ? `최근 변경 ${formatDateTime(row.updatedAt)}` : '평가 단계가 아직 생성되지 않았습니다.'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{formatDateTime(row.dueAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                {
                                  action: 'override',
                                  evalCycleId: data.selectedCycleId,
                                  targetId: row.targetId,
                                  evalStage: row.evalStage,
                                  evaluatorId: selectedEvaluatorId,
                                },
                                '평가자 배정을 저장했습니다.',
                                `save:${rowKey}`
                              )
                            }
                            disabled={!selectedEvaluatorId || !changed || busyKey !== null}
                            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                {
                                  action: 'reset',
                                  evalCycleId: data.selectedCycleId,
                                  targetId: row.targetId,
                                  evalStage: row.evalStage,
                                },
                                '자동 배정 기준으로 되돌렸습니다.',
                                `reset:${rowKey}`
                              )
                            }
                            disabled={row.assignmentSource !== 'MANUAL' || busyKey !== null}
                            className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            자동 기준 복원
                          </button>
                          {row.evaluationId ? (
                            <Link
                              href={`/evaluation/performance/${encodeURIComponent(row.evaluationId)}?cycleId=${encodeURIComponent(data.selectedCycleId ?? '')}`}
                              className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                            >
                              평가 열기
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <span className="inline-flex min-h-10 items-center rounded-2xl bg-slate-100 px-3 text-xs text-slate-500">
                              이전 단계 제출 후 생성
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    조건에 맞는 배정 항목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Header(props: { selectedCycleId?: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
        평가 배정 운영
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">평가 배정 운영</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        평가 단계별 담당자를 관리하고, 실제 성과평가 화면과 연결된 배정 상태를 주기 단위로 점검합니다.
        {props.selectedCycleId ? ` 현재 선택 주기 ID는 ${props.selectedCycleId}입니다.` : ''}
      </p>
    </section>
  )
}

function Banner(props: { tone: 'success' | 'error'; message: string }) {
  const palette =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-rose-200 bg-rose-50 text-rose-800'

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${palette}`}>{props.message}</div>
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {props.label}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}
