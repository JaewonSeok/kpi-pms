'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  buildImpersonationRiskHeaders,
  createImpersonationRiskCancelledError,
  IMPERSONATION_RISK_REASON_MIN_LENGTH,
  type ImpersonationRiskActionName,
} from '@/lib/impersonation'

type RiskRequestOptions = {
  actionName: ImpersonationRiskActionName
  actionLabel: string
  targetLabel?: string
  detail?: string
  confirmationText?: string
}

type PendingRiskRequest = RiskRequestOptions & {
  riskReason: string
  typedConfirmation: string
  errorMessage: string | null
}

function formatDateTime(value?: string) {
  if (!value) return '미정'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '미정'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function useImpersonationRiskAction() {
  const { data: session } = useSession()
  const resolverRef = useRef<((headers: Record<string, string> | null) => void) | null>(null)
  const [pendingRequest, setPendingRequest] = useState<PendingRiskRequest | null>(null)

  const masterLogin = session?.user?.masterLogin?.active ? session.user.masterLogin : null

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(null)
        resolverRef.current = null
      }
    }
  }, [])

  async function requestRiskConfirmation(options: RiskRequestOptions) {
    if (!masterLogin) {
      return {} as Record<string, string>
    }

    return await new Promise<Record<string, string> | null>((resolve) => {
      resolverRef.current = resolve
      setPendingRequest({
        ...options,
        riskReason: '',
        typedConfirmation: '',
        errorMessage: null,
      })
    })
  }

  function closeDialog(headers: Record<string, string> | null) {
    resolverRef.current?.(headers)
    resolverRef.current = null
    setPendingRequest(null)
  }

  function handleCancel() {
    closeDialog(null)
  }

  function handleConfirm() {
    if (!masterLogin || !pendingRequest) {
      closeDialog(null)
      return
    }

    const trimmedReason = pendingRequest.riskReason.trim()
    if (trimmedReason.length < IMPERSONATION_RISK_REASON_MIN_LENGTH) {
      setPendingRequest((current) =>
        current
          ? {
              ...current,
              errorMessage: `위험 동작 사유를 ${IMPERSONATION_RISK_REASON_MIN_LENGTH}자 이상 입력해 주세요.`,
            }
          : current
      )
      return
    }

    if (
      pendingRequest.confirmationText &&
      pendingRequest.typedConfirmation.trim() !== pendingRequest.confirmationText
    ) {
      setPendingRequest((current) =>
        current
          ? {
              ...current,
              errorMessage: `확인 문구 "${pendingRequest.confirmationText}"를 정확히 입력해 주세요.`,
            }
          : current
      )
      return
    }

    closeDialog(
      buildImpersonationRiskHeaders(masterLogin, pendingRequest.actionName, {
        riskReason: trimmedReason,
        confirmationText: pendingRequest.confirmationText
          ? pendingRequest.typedConfirmation.trim()
          : undefined,
      })
    )
  }

  const riskDialog =
    !masterLogin || !pendingRequest ? null : (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
        <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">현재 마스터 로그인 상태에서 위험 동작을 진행합니다.</h2>
                <p className="mt-1 text-sm text-slate-500">
                  현재 대상 유저 권한으로 실제 데이터를 변경하거나 내보내는 작업입니다.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">원래 관리자</div>
                <p className="mt-1 font-medium text-slate-900">
                  {masterLogin.actorName} ({masterLogin.actorEmail})
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">현재 대상 유저</div>
                <p className="mt-1 font-medium text-slate-900">
                  {masterLogin.targetName} ({masterLogin.targetEmail})
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">시작 사유</div>
                <p className="mt-1 text-slate-700">{masterLogin.reason}</p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">만료 예정</div>
                <p className="mt-1 text-slate-700">{formatDateTime(masterLogin.expiresAt)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">{pendingRequest.actionLabel}</p>
                  {pendingRequest.targetLabel ? <p>대상: {pendingRequest.targetLabel}</p> : null}
                  <p>이 작업은 실제 데이터에 반영되며, 원래 관리자와 현재 대상 유저 정보가 모두 감사 로그에 기록됩니다.</p>
                  {pendingRequest.detail ? <p>{pendingRequest.detail}</p> : null}
                </div>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">위험 동작 사유</span>
              <textarea
                value={pendingRequest.riskReason}
                onChange={(event) =>
                  setPendingRequest((current) =>
                    current
                      ? {
                          ...current,
                          riskReason: event.target.value,
                          errorMessage: null,
                        }
                      : current
                  )
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                placeholder="왜 이 위험 동작이 필요한지 구체적으로 입력해 주세요."
              />
              <p className="text-xs text-slate-500">
                최소 {IMPERSONATION_RISK_REASON_MIN_LENGTH}자 이상 입력해야 합니다.
              </p>
            </label>

            {pendingRequest.confirmationText ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">
                  확인 문구 입력: {pendingRequest.confirmationText}
                </span>
                <input
                  value={pendingRequest.typedConfirmation}
                  onChange={(event) =>
                    setPendingRequest((current) =>
                      current
                        ? {
                            ...current,
                            typedConfirmation: event.target.value,
                            errorMessage: null,
                          }
                        : current
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  placeholder={pendingRequest.confirmationText}
                />
              </label>
            ) : null}

            {pendingRequest.errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {pendingRequest.errorMessage}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              계속 진행
            </button>
          </div>
        </div>
      </div>
    )

  return {
    isImpersonating: Boolean(masterLogin),
    requestRiskConfirmation,
    riskDialog,
    createCancelledError: createImpersonationRiskCancelledError,
  }
}
