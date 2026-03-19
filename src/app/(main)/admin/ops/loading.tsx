export default function AdminOpsLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-10 w-64 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 w-24 animate-pulse rounded-full bg-slate-100" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[28rem] animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-[28rem] animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  )
}
