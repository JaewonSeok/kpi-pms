export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">불러오는 중입니다</h1>
        <p className="mt-2 text-sm text-slate-500">
          화면과 데이터를 안전하게 준비하고 있습니다.
        </p>
      </div>
    </main>
  )
}
