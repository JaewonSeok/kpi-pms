function SkeletonCard() {
  return <div className="h-32 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100" />
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="h-3 w-40 rounded bg-slate-200" />
        <div className="mt-4 h-8 w-56 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-2/3 rounded bg-slate-200" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
            <div className="h-28 animate-pulse rounded-[1.5rem] bg-slate-100" />
          </div>
          <div className="h-[420px] animate-pulse rounded-[1.5rem] bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
