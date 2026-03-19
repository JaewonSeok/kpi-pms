export default function OrgKpiLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-4 h-9 w-52 rounded bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-3xl rounded bg-slate-100" />
        <div className="mt-2 h-4 w-full max-w-2xl rounded bg-slate-100" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 rounded bg-slate-100" />
            <div className="mt-4 h-8 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-32 rounded bg-slate-200" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-[420px] rounded-2xl bg-slate-100" />
        </div>
      </section>
    </div>
  )
}
