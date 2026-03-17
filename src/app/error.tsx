'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="ko">
      <body className="bg-slate-50">
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">Error</p>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">문제가 발생했습니다</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-slate-400">error id: {error.digest}</p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
