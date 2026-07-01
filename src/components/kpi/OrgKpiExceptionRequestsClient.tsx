'use client'

import { useState, useCallback } from 'react'

export type ExceptionRequestItem = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason: string
  reviewNote: string | null
  createdAt: string
  resolvedAt: string | null
  orgKpi: { id: string; kpiName: string; evalYear: number; deptId: string; deptName: string }
  requester: { id: string; empName: string }
  reviewer: { id: string; empName: string } | null
}

type Props = {
  initialRequests: ExceptionRequestItem[]
}

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

const STATUS_LABELS: Record<ExceptionRequestItem['status'], string> = {
  PENDING: '검토 대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

const STATUS_BADGE: Record<ExceptionRequestItem['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

async function patchRequest(
  id: string,
  action: 'approve' | 'reject',
  reviewNote: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/kpi/org/exception-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewNote }),
    })
    const data = (await res.json()) as { success?: boolean; error?: { message?: string } }
    if (!res.ok || !data.success) {
      return { ok: false, message: data.error?.message ?? '처리에 실패했습니다.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, message: '네트워크 오류가 발생했습니다.' }
  }
}

function ReviewPanel({
  item,
  onDone,
}: {
  item: ExceptionRequestItem
  onDone: (id: string, result: 'APPROVED' | 'REJECTED', reviewNote: string) => void
}) {
  const [reviewNote, setReviewNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = useCallback(
    async (action: 'approve' | 'reject') => {
      if (action === 'reject' && !reviewNote.trim()) {
        setError('반려 사유를 입력해 주세요.')
        return
      }
      setBusy(true)
      setError(null)
      const result = await patchRequest(item.id, action, reviewNote.trim())
      setBusy(false)
      if (!result.ok) {
        setError(result.message ?? '처리에 실패했습니다.')
        return
      }
      onDone(item.id, action === 'approve' ? 'APPROVED' : 'REJECTED', reviewNote.trim())
    },
    [item.id, reviewNote, onDone]
  )

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <textarea
        rows={2}
        placeholder="검토 의견 (승인 시 선택, 반려 시 필수)"
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        disabled={busy}
        className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handle('approve')}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? '처리 중...' : '승인'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle('reject')}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? '처리 중...' : '반려'}
        </button>
      </div>
    </div>
  )
}

export function OrgKpiExceptionRequestsClient({ initialRequests }: Props) {
  const [requests, setRequests] = useState<ExceptionRequestItem[]>(initialRequests)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING')
  const [openPanelId, setOpenPanelId] = useState<string | null>(null)

  const handleDone = useCallback(
    (id: string, result: 'APPROVED' | 'REJECTED', reviewNote: string) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: result, reviewNote: reviewNote || null, resolvedAt: new Date().toISOString() }
            : r
        )
      )
      setOpenPanelId(null)
    },
    []
  )

  const filtered =
    statusFilter === 'ALL' ? requests : requests.filter((r) => r.status === statusFilter)

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'PENDING', label: `대기 중 (${pendingCount})` },
    { key: 'APPROVED', label: '승인' },
    { key: 'REJECTED', label: '반려' },
    { key: 'ALL', label: '전체' },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">KPI 예외 승인 검토</h1>
        <p className="mt-1 text-sm text-slate-500">
          팀장이 신청한 MBO 예외 승인 요청을 검토하고 승인/반려합니다.
        </p>
      </div>

      {/* 탭 필터 */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'border-b-2 border-blue-600 text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center">
          <p className="text-sm text-slate-500">
            {statusFilter === 'PENDING' ? '검토 대기 중인 신청이 없습니다.' : '해당 상태의 신청이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              {/* 헤더 행 */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>
                    <span className="text-xs text-slate-400">{item.orgKpi.evalYear}년도</span>
                    <span className="text-xs font-medium text-slate-600">{item.orgKpi.deptName}</span>
                  </div>
                  <p className="mt-1 text-base font-semibold text-slate-900 leading-snug">
                    {item.orgKpi.kpiName}
                  </p>
                </div>
                {item.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenPanelId((prev) => (prev === item.id ? null : item.id))
                    }
                    className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {openPanelId === item.id ? '닫기' : '검토'}
                  </button>
                )}
              </div>

              {/* 신청 정보 */}
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-3">
                <div>
                  <span className="font-medium text-slate-700">신청자</span>{' '}
                  {item.requester.empName}
                </div>
                <div>
                  <span className="font-medium text-slate-700">신청일</span>{' '}
                  {formatDate(item.createdAt)}
                </div>
                {item.resolvedAt && (
                  <div>
                    <span className="font-medium text-slate-700">처리일</span>{' '}
                    {formatDate(item.resolvedAt)}
                  </div>
                )}
              </div>

              {/* 신청 사유 */}
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium text-slate-500 mb-1">신청 사유</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {item.reason}
                </p>
              </div>

              {/* 검토 의견 (처리됨) */}
              {item.reviewNote && item.status !== 'PENDING' && (
                <div className="mt-2 rounded-xl bg-slate-100 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500 mb-1">
                    검토 의견 ({item.reviewer?.empName ?? 'HR'})
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {item.reviewNote}
                  </p>
                </div>
              )}

              {/* 인라인 검토 패널 */}
              {openPanelId === item.id && (
                <ReviewPanel item={item} onDone={handleDone} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
