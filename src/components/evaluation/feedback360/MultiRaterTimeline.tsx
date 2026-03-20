'use client'

type MultiRaterTimelineItem = {
  title: string
  description: string
  at: string
}

export function MultiRaterTimeline(props: { items: MultiRaterTimelineItem[] }) {
  if (!props.items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        아직 표시할 운영 이력이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {props.items.map((item, index) => (
        <div key={`${item.title}-${item.at}-${index}`} className="flex gap-3">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {index + 1}
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
              <div className="text-xs text-slate-500">{item.at}</div>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
