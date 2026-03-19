export default function EvaluationCeoAdjustLoading() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="h-3 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-44 rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-96 max-w-full rounded-xl bg-slate-100" />
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="h-3 w-20 rounded-full bg-slate-200" />
              <div className="mt-4 h-9 w-24 rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-20 rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-24 rounded-xl bg-slate-200" />
            <div className="mt-3 h-4 w-32 rounded-xl bg-slate-100" />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-10 w-full rounded-2xl bg-slate-100" />
      </section>
    </div>
  )
}
