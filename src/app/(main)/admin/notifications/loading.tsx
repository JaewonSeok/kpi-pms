function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
      <div className="h-[32rem] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
    </div>
  )
}
