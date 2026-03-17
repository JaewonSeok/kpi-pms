import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">403</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">접근 권한이 없습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          현재 계정으로는 요청하신 메뉴나 데이터에 접근할 수 없습니다. 필요한 경우 HR 관리자에게 권한을 문의해 주세요.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            대시보드로 이동
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            다시 로그인
          </Link>
        </div>
      </div>
    </main>
  )
}
