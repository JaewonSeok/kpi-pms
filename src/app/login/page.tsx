'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import {
  buildGoogleSignInRequest,
  getLoginErrorMessage,
  resolveClientCallbackUrl,
} from '@/lib/auth-flow'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const requestedCallbackUrl = searchParams.get('callbackUrl')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [googleError, setGoogleError] = useState('')

  const visibleGoogleError = googleError || getLoginErrorMessage(error)

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

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)' }}
    >
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">KPI 성과관리</h1>
          <p className="text-blue-200 mt-2">Continuous Performance Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">로그인</h2>

          {visibleGoogleError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {visibleGoogleError}
            </div>
          )}

          {adminMode && adminError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {adminError}
            </div>
          )}

          {!adminMode ? (
            <>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                  className="text-sm text-gray-400 hover:text-gray-600 underline"
                >
                  관리자 계정으로 로그인(GWS 비활성 대비)
                </button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="admin@company.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
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
                className="mt-4 text-sm text-gray-400 hover:text-gray-600 underline w-full text-center"
              >
                Google 로그인으로 돌아가기
              </button>
            </>
          )}

          <p className="mt-6 text-xs text-gray-400 text-center">
            사내 Google Workspace 계정으로만 접속 가능합니다.
            <br />
            계정 문의: HR 내선 1234
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-blue-700">
          <div className="text-white">로딩 중...</div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
