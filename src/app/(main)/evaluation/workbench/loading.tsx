export default function EvaluationWorkbenchLoading() {
  return (
    <div className="space-y-6">
      <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="h-[480px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        <div className="space-y-6">
          <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          <div className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
          <div className="h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
        </div>
      </div>
    </div>
  )
}
