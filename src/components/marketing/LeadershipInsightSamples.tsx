'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { LeadershipInsightPageModel } from '@/lib/leadership-insight'

type Props = {
  samples: LeadershipInsightPageModel['reportSamples']
  sampleDoc: LeadershipInsightPageModel['links']['sampleDoc']
}

export function LeadershipInsightSamples({ samples, sampleDoc }: Props) {
  const [activeId, setActiveId] = useState<string>(samples[0]?.id ?? '')
  const [showPreview, setShowPreview] = useState(false)

  const activeSample = useMemo(
    () => samples.find((sample) => sample.id === activeId) ?? samples[0],
    [activeId, samples]
  )

  if (!activeSample) return null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="space-y-3">
        {samples.map((sample, index) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => {
              setActiveId(sample.id)
              setShowPreview(false)
            }}
            className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
              sample.id === activeId
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Insight {index + 1}</div>
            <div className="mt-2 text-base font-semibold">{sample.title}</div>
            <p className={`mt-2 text-sm ${sample.id === activeId ? 'text-slate-200' : 'text-slate-500'}`}>
              {sample.summary}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">샘플 인사이트</div>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{activeSample.title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeSample.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((current) => !current)}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {showPreview ? '예시 닫기' : '예시 보기'}
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {activeSample.details.map((detail) => (
            <div key={detail} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              {detail}
            </div>
          ))}
        </div>

        {showPreview ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview Panel</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">보고서에 담기는 핵심 질문</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li>• 어떤 리더십 축이 전사에서 상대적으로 강하거나 약한가?</li>
                  <li>• 조직/직급/역할 차이가 실제로 유의미한가?</li>
                  <li>• 어떤 집단에 어떤 지원 전략이 먼저 필요한가?</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-slate-900 p-5 text-slate-100 shadow-sm">
                <div className="text-sm font-semibold">실행 연결 포인트</div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  샘플 리포트는 단순 결과 해석에 그치지 않고, 코칭 주안점, 육성 전략, HR 운영 과제를 함께 정리하는 형태로 구성합니다.
                </p>
                <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-xs leading-5 text-slate-200">
                  실제 소개서나 PDF 샘플 문서는 보안 정책과 도입 채널에 맞춰 별도 공유할 수 있습니다.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">{sampleDoc.helper}</p>
          {sampleDoc.href ? (
            <Link
              href={sampleDoc.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {sampleDoc.label}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-400"
            >
              {sampleDoc.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
