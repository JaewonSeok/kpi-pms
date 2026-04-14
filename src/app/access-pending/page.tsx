import Link from 'next/link'

type AccessPendingPageProps = {
  searchParams?: Promise<{
    reason?: string
  }>
}

function resolvePendingMessage(reason?: string) {
  if (reason === 'AuthenticatedButClaimsMissing' || reason === 'CLAIMS_REHYDRATION_FAILED') {
    return 'Google 로그인은 완료됐지만 사내 권한 정보를 아직 확인하지 못했습니다. 잠시 후 다시 시도하거나 HR 관리자에게 문의해 주세요.'
  }

  return '접근 준비 상태를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.'
}

export default async function AccessPendingPage({ searchParams }: AccessPendingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const reason = resolvedSearchParams.reason ?? null
  const message = resolvePendingMessage(reason ?? undefined)

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold text-blue-700">Access Pending</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">권한 정보를 확인하고 있습니다</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{message}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            로그인 화면으로 이동
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </main>
  )
}
