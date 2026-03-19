export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-10 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 w-28 animate-pulse rounded-full bg-slate-100" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="h-[420px] animate-pulse rounded-[1.5rem] bg-slate-100" />
          <div className="h-[420px] animate-pulse rounded-[1.5rem] bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
