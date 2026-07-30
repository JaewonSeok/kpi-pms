'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Sparkles } from 'lucide-react'

export type PerformanceMemberInputWorkspaceData = {
  currentUser?: {
    id?: string | null
    role?: string | null
  } | null
  selectedCycleId?: string | null
  availableCycles?: Array<{ id: string; name: string }> | null
  evaluations?: Array<{
    id: string
    evalStage: string
    targetId: string
  }> | null
  permissions?: {
    canCreateSelfEvaluation?: boolean | null
  } | null
}

export function PerformanceMemberInputWorkspace({ data }: { data: unknown }) {
  const workspaceData = data as PerformanceMemberInputWorkspaceData
  const currentRole = workspaceData.currentUser?.role ?? 'ROLE_MEMBER'
  const currentUserId = workspaceData.currentUser?.id ?? null
  const isPrivilegedPreview = currentRole === 'ROLE_ADMIN' || currentRole === 'ROLE_MASTER'
  const selectedCycleId = workspaceData.selectedCycleId ?? null
  const canCreateSelfEvaluation = workspaceData.permissions?.canCreateSelfEvaluation ?? false
  const cycles = workspaceData.availableCycles ?? []
  const cycleName = cycles.find((c) => c.id === selectedCycleId)?.name ?? cycles[0]?.name ?? null
  const existingSelfEvaluation =
    (workspaceData.evaluations ?? []).find(
      (ev) => ev.evalStage === 'SELF' && ev.targetId === currentUserId,
    ) ?? null

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selfStartError, setSelfStartError] = useState('')

  async function handleStartSelfEvaluation() {
    setSelfStartError('')
    try {
      const response = await fetch('/api/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalCycleId: selectedCycleId }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message ?? '자기평가를 시작하지 못했습니다.')
      const nextId = json.data?.id as string | undefined
      if (nextId) {
        startTransition(() =>
          router.push(
            `/evaluation/self/${encodeURIComponent(nextId)}${selectedCycleId ? `?cycleId=${encodeURIComponent(selectedCycleId)}` : ''}`
          )
        )
      }
    } catch (err) {
      setSelfStartError(err instanceof Error ? err.message : '자기평가를 시작하지 못했습니다.')
    }
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
      <div className="rounded-[20px] border border-slate-200 bg-white px-5 py-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span>평가 관리</span>
          <span className="text-slate-300">›</span>
          <span>업적평가(MBO)</span>
          <span className="text-slate-300">›</span>
          <span className="text-slate-900">자기평가</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">자기평가</h1>
        {cycleName && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
            <ClipboardCheck className="h-4 w-4 text-blue-500" />
            {cycleName}
          </p>
        )}

        {isPrivilegedPreview ? (
          <p className="mt-4 text-xs leading-5 text-slate-500">
            관리자 권한에서는 팀원 입력 화면을 preview-only로 확인합니다.
          </p>
        ) : (
          <div className="mt-6">
            {existingSelfEvaluation ? (
              <button
                type="button"
                onClick={() =>
                  startTransition(() =>
                    router.push(
                      `/evaluation/self/${encodeURIComponent(existingSelfEvaluation.id)}${selectedCycleId ? `?cycleId=${encodeURIComponent(selectedCycleId)}` : ''}`,
                    )
                  )
                }
                disabled={isPending}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                자기평가 이어서 작성
              </button>
            ) : canCreateSelfEvaluation ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartSelfEvaluation()}
                  disabled={isPending}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  자기평가 시작
                </button>
                {selfStartError && (
                  <span className="text-xs text-rose-600">{selfStartError}</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                확정된 KPI가 없거나 자기평가 기간이 아니어서 자기평가를 시작할 수 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
