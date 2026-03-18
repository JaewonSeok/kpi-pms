import Link from 'next/link'

type UnderConstructionProps = {
  requestedPath?: string
}

export function UnderConstruction({ requestedPath }: UnderConstructionProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
          준비 중
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">준비 중인 페이지입니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">현재 해당 기능은 개발 중입니다.</p>
        {requestedPath ? (
          <p className="mt-2 text-xs font-medium text-slate-400">요청 경로: {requestedPath}</p>
        ) : null}
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            대시보드로 이동
          </Link>
        </div>
      </section>
    </div>
  )
}
