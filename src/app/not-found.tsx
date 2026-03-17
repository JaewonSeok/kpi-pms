import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">404</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          요청하신 주소가 변경되었거나 삭제되었을 수 있습니다. 대시보드에서 다시 이동해 주세요.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            대시보드로 이동
          </Link>
        </div>
      </div>
    </main>
  )
}
