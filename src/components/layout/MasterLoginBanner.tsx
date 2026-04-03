'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type MasterLoginBannerProps = {
  session: {
    user: {
      name?: string | null
      email?: string | null
      masterLogin?: {
        active: boolean
        readOnly: true
        actorName: string
        actorEmail: string
        startedAt: string
        targetName: string
        targetEmail: string
      } | null
    }
  }
}

export function MasterLoginBanner({ session }: MasterLoginBannerProps) {
  const router = useRouter()
  const { data: liveSession, update } = useSession()
  const [isEnding, setIsEnding] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const effectiveSession = liveSession ?? session
  const masterLogin = effectiveSession.user.masterLogin

  if (!masterLogin?.active) {
    return null
  }

  async function handleStop() {
    setIsEnding(true)
    setErrorMessage(null)

    try {
      await update({
        masterLogin: {
          action: 'stop',
        },
      })
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
    <div className="border-b border-blue-500 bg-blue-600 text-white">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex flex-col gap-1 text-sm">
          <div className="font-semibold">마스터 로그인 중입니다.</div>
          <div>
            로그인한 계정 {effectiveSession.user.name ?? masterLogin.targetName}{' '}
            ({effectiveSession.user.email ?? masterLogin.targetEmail})
          </div>
          <div className="text-blue-100">
            원래 관리자 {masterLogin.actorName} ({masterLogin.actorEmail}) · 권한 읽기 전용
          </div>
          {errorMessage ? <div className="text-rose-100">{errorMessage}</div> : null}
        </div>

        <button
          type="button"
          onClick={handleStop}
          disabled={isEnding}
          className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isEnding ? '종료 중...' : '종료'}
        </button>
      </div>
    </div>
  )
}
