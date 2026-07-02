'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import {
  buildGoogleSignInRequest,
  getLoginErrorMessage,
  resolveLoginFeedback,
  resolveClientCallbackUrl,
} from '@/lib/auth-flow'
import { hasAuthenticatedSessionIdentity, hasFullAppSessionUserClaims } from '@/lib/auth-session'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const error = searchParams.get('error')
  const requestedCallbackUrl = searchParams.get('callbackUrl')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const loginFeedback = resolveLoginFeedback(error)
  const hasFullSession = hasFullAppSessionUserClaims(session?.user)
  const hasAuthenticatedShell = hasAuthenticatedSessionIdentity(session)

  const visibleGoogleError = googleError || loginFeedback?.message || getLoginErrorMessage(error)

  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'authenticated') {
      return
    }

    if (hasFullSession) {
      router.replace(
        resolveClientCallbackUrl(requestedCallbackUrl, window.location.origin, '/dashboard')
      )
      return
    }

    if (hasAuthenticatedShell) {
      const reason = session?.authErrorCode ?? 'AuthenticatedButClaimsMissing'
      router.replace(
        resolveClientCallbackUrl(
          `/access-pending?reason=${encodeURIComponent(reason)}`,
          window.location.origin,
          '/access-pending'
        )
      )
    }
  }, [hasAuthenticatedShell, hasFullSession, requestedCallbackUrl, router, session?.authErrorCode, status])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setGoogleError('')

    try {
      const request = buildGoogleSignInRequest(window.location.origin, requestedCallbackUrl)

      await signIn(request.provider, {
        callbackUrl: request.callbackUrl,
      })
    } catch (signInError) {
      console.error('[auth][client] Google sign-in start failed', signInError)
      setLoading(false)
      setGoogleError(
        getLoginErrorMessage('OAuthSignin') ||
          '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.'
      )
    }
  }

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setAdminError('')
    setGoogleError('')

    try {
      const result = await signIn('admin-credentials', {
        email: adminEmail,
        password: adminPassword,
        redirect: false,
        callbackUrl: resolveClientCallbackUrl(
          requestedCallbackUrl,
          window.location.origin,
          '/dashboard'
        ),
      })

      setLoading(false)

      if (result?.ok) {
        router.push(result.url || '/dashboard')
      } else {
        setAdminError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.')
      }
    } catch (signInError) {
      console.error('Admin sign-in failed:', signInError)
      setLoading(false)
      setAdminError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.')
    }
  }

  if (status === 'authenticated' && hasFullSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-medium text-white shadow-2xl backdrop-blur">
          로그인 정보를 확인하고 있습니다...
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-screen overflow-x-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10"
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 18%, rgba(96, 165, 250, 0.38), transparent 28rem), radial-gradient(circle at 82% 12%, rgba(129, 140, 248, 0.28), transparent 26rem), linear-gradient(135deg, #081a4a 0%, #123c96 40%, #312e81 72%, #4c1d95 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.34) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.34) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'linear-gradient(to bottom, black, transparent 78%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" aria-hidden="true" />

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-blue-100 shadow-2xl backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.95)]" />
              사내 성과관리 포털
            </div>
            <h1 className="mt-8 text-5xl font-bold leading-tight tracking-tight text-white xl:text-6xl">
              KPI 성과관리
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-blue-100/[0.88]">
              목표, 실행, 피드백이 자연스럽게 이어지는 성과관리 경험을 제공합니다.
            </p>

            <div className="mt-12 grid max-w-lg grid-cols-2 gap-4" aria-hidden="true">
              <div className="rounded-[1.5rem] border border-white/15 bg-white/[0.12] p-5 shadow-2xl shadow-blue-950/25 backdrop-blur-xl">
                <div className="flex items-center justify-between text-xs font-medium text-blue-100">
                  <span>진행률</span>
                  <span>82%</span>
                </div>
                <div className="mt-5 h-2 rounded-full bg-white/15">
                  <div className="h-2 w-4/5 rounded-full bg-gradient-to-r from-cyan-300 to-blue-300" />
                </div>
                <div className="mt-6 space-y-2">
                  <div className="h-2 w-24 rounded-full bg-white/25" />
                  <div className="h-2 w-32 rounded-full bg-white/15" />
                </div>
              </div>
              <div className="mt-8 rounded-[1.5rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-indigo-950/25 backdrop-blur-xl">
                <div className="flex h-28 items-end gap-2">
                  <span className="h-10 flex-1 rounded-t-xl bg-cyan-200/75" />
                  <span className="h-16 flex-1 rounded-t-xl bg-blue-200/75" />
                  <span className="h-24 flex-1 rounded-t-xl bg-indigo-200/75" />
                  <span className="h-14 flex-1 rounded-t-xl bg-violet-200/75" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[29rem] flex-col">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/30 bg-white/95 shadow-2xl shadow-blue-950/30">
              <svg className="h-9 w-9 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">KPI 성과관리</h1>
            <p className="mt-2 text-sm font-medium text-blue-100">Continuous Performance Management</p>
          </div>

          <div className="rounded-[2rem] border border-white/55 bg-white/[0.92] p-6 text-slate-900 shadow-[0_34px_100px_rgba(15,23,42,0.32)] backdrop-blur-2xl sm:p-8">
            <div className="hidden text-center lg:block">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-white to-blue-50 shadow-xl shadow-blue-900/15 ring-1 ring-blue-100">
                <svg className="h-9 w-9 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">KPI 성과관리</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">Continuous Performance Management</p>
            </div>

            <div className="mt-0 lg:mt-8">
              <h2 className="text-center text-xl font-semibold text-slate-950">로그인</h2>
              <p className="mt-2 text-center text-sm leading-6 text-slate-500">
                사내 계정으로 안전하게 접속해 주세요.
              </p>
            </div>

          {visibleGoogleError && (
            <div
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              data-auth-feedback-kind={googleError ? 'auth' : loginFeedback?.kind ?? 'auth'}
            >
              {visibleGoogleError}
            </div>
          )}

          {adminMode && adminError && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {adminError}
            </div>
          )}

          {!adminMode ? (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="mt-7 flex h-[3.25rem] w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-lg shadow-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-xl hover:shadow-blue-200/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? '로그인 중...' : 'Google Workspace로 로그인'}
              </button>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAdminError('')
                    setAdminMode(true)
                  }}
                  className="rounded-full px-3 py-2 text-sm font-medium text-slate-400 underline-offset-4 transition hover:text-slate-600 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 motion-reduce:transition-none"
                >
                  관리자 계정으로 로그인(GWS 비활성 대비)
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">이메일</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 motion-reduce:transition-none"
                    placeholder="관리자 이메일"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">비밀번호</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 motion-reduce:transition-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[3.25rem] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-900/25 transition duration-200 hover:-translate-y-0.5 hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {loading ? '로그인 중...' : '로그인'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setAdminError('')
                  setAdminMode(false)
                }}
                className="mt-4 w-full rounded-full px-3 py-2 text-center text-sm font-medium text-slate-400 underline-offset-4 transition hover:text-slate-600 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 motion-reduce:transition-none"
              >
                Google 로그인으로 돌아가기
              </button>
            </>
          )}

          <p className="mt-7 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs leading-5 text-slate-500">
            사내 Google Workspace 계정으로만 접속 가능합니다.
            <br />
            계정 문의: HR 내선 1234
          </p>
        </div>
        </section>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-medium text-white shadow-2xl backdrop-blur">
            로딩 중...
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
