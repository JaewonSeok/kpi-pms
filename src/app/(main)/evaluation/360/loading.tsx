export default function Feedback360Loading() {
  return (
    <div className="space-y-6">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  )
}
