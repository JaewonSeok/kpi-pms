'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  createImpersonationSyncPayload,
  IMPERSONATION_SYNC_STORAGE_KEY,
  parseImpersonationSyncPayload,
} from '@/lib/impersonation'
import type { SessionUserClaims } from '@/types/auth'

type MasterLoginBannerProps = {
  session: {
    user: SessionUserClaims
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '미정'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '미정'
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRemaining(value?: string | null) {
  if (!value) return '만료 시간 확인 불가'
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) return '만료 시간 확인 불가'
  const diffMs = expiresAt.getTime() - Date.now()
  if (diffMs <= 0) return '곧 만료'

  const totalMinutes = Math.ceil(diffMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 남음`
  }

  return `${minutes}분 남음`
}

export function MasterLoginBanner({ session }: MasterLoginBannerProps) {
  const router = useRouter()
  const { data: liveSession, update } = useSession()
  const [isEnding, setIsEnding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const effectiveSession = liveSession ?? session
  const masterLogin = effectiveSession.user.masterLogin?.active
    ? effectiveSession.user.masterLogin
    : null

  const expiryLabel = useMemo(
    () =>
      masterLogin
        ? `${formatDateTime(masterLogin.expiresAt)} · ${formatRemaining(masterLogin.expiresAt)}`
        : '',
    [masterLogin]
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== IMPERSONATION_SYNC_STORAGE_KEY) {
        return
      }

      const payload = parseImpersonationSyncPayload(event.newValue)
      if (!payload) {
        return
      }

      if (
        masterLogin &&
        payload.sessionId &&
        payload.sessionId !== masterLogin.sessionId &&
        payload.type !== 'start'
      ) {
        return
      }

      void update()
      router.refresh()
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [masterLogin, router, update])

  useEffect(() => {
    if (!masterLogin || typeof window === 'undefined') {
      return
    }

    const expiresAt = new Date(masterLogin.expiresAt)
    if (Number.isNaN(expiresAt.getTime())) {
      return
    }

    const timeoutMs = Math.max(0, expiresAt.getTime() - Date.now())
    const timerId = window.setTimeout(() => {
      window.localStorage.setItem(
        IMPERSONATION_SYNC_STORAGE_KEY,
        createImpersonationSyncPayload('expire', masterLogin.sessionId)
      )
      void update()
      router.refresh()
    }, timeoutMs + 250)

    return () => window.clearTimeout(timerId)
  }, [masterLogin, router, update])

  if (!masterLogin) {
    return null
  }

  async function handleStop() {
    if (!masterLogin) {
      return
    }

    setIsEnding(true)
    setErrorMessage(null)

    try {
      await update({
        masterLogin: {
          action: 'stop',
        },
      })

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          IMPERSONATION_SYNC_STORAGE_KEY,
          createImpersonationSyncPayload('stop', masterLogin.sessionId)
        )
      }

      router.push('/admin/google-access?tab=master-login')
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '마스터 로그인을 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      )
    } finally {
      setIsEnding(false)
    }
  }

  return (
    <div className="border-b border-amber-300 bg-amber-500 text-slate-950">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            <span>마스터 로그인 중입니다.</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              원래 관리자 <strong>{masterLogin.actorName}</strong> ({masterLogin.actorEmail})
            </span>
            <span>
              현재 대상자 <strong>{masterLogin.targetName}</strong> ({masterLogin.targetEmail})
            </span>
          </div>
          <div className="text-amber-950/90">
            현재 권한은 대상자 기준으로 적용됩니다. 위험 동작에는 추가 확인이 필요합니다.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-amber-950/80">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              만료 예정 {expiryLabel}
            </span>
            <span className="inline-flex items-center gap-1" title={masterLogin.reason}>
              <AlertTriangle className="h-3.5 w-3.5" />
              사유: {masterLogin.reason}
            </span>
          </div>
          {errorMessage ? <div className="text-sm text-rose-900">{errorMessage}</div> : null}
        </div>

        <button
          type="button"
          onClick={handleStop}
          disabled={isEnding}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-black/15 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isEnding ? '종료 중...' : '종료'}
        </button>
      </div>
    </div>
  )
}
