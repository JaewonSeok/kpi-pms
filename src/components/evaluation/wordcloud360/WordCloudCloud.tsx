'use client'

import type { AggregateKeywordView } from '@/server/word-cloud-360'

export function WordCloudCloud(props: {
  title: string
  items: AggregateKeywordView[]
  tone: 'positive' | 'negative'
}) {
  const toneClass =
    props.tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
      : 'border-rose-200 bg-rose-50 text-rose-950'

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{props.title}</h3>
        <span className="text-xs font-medium">{props.items.length}개 키워드</span>
      </div>
      {props.items.length ? (
        <div className="flex min-h-44 flex-wrap items-center justify-center gap-3">
          {props.items.map((item) => (
            <span
              key={`${item.keywordId}-${item.keyword}`}
              className="rounded-full px-3 py-1 font-semibold"
              style={{
                fontSize: `${12 + item.weight * 2}px`,
                lineHeight: 1.15,
                opacity: 0.55 + Math.min(item.weight / 12, 0.35),
              }}
              title={`${item.keyword} (${item.count}회)`}
            >
              {item.keyword}
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-current/20 bg-white/60 px-4 py-12 text-center text-sm opacity-80">
          아직 집계된 키워드가 없습니다.
        </div>
      )}
    </section>
  )
}
