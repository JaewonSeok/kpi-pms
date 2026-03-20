export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="h-[320px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        <div className="h-[320px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      </div>
    </div>
  )
}
