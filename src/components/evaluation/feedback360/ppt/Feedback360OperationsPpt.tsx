'use client'

import Link from 'next/link'
import { Feedback360PptSummaryCards, type Feedback360PptSummaryCard } from './Feedback360PptPrimitives'

export type Feedback360OperationsPptRound = {
  key: string
  label: string
  periodLabel: string
  targetCountLabel: string
  mappingStatusLabel: string
  responseStatusLabel: string
  anonymityStatusLabel: string
  statusLabel: string
  href?: string
}

export function Feedback360OperationsPpt(props: {
  summaryCards: Feedback360PptSummaryCard[]
  rounds: Feedback360OperationsPptRound[]
  mappingHref?: string | null
}) {
  return (
    <section className="space-y-4">
      <Feedback360PptSummaryCards cards={props.summaryCards} />
      <div className="space-y-4">
        <div className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4">
            <h2 className="text-base font-bold text-slate-950">라운드/대상자 현황</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {props.rounds.map((round) => (
              <div key={round.key} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.8fr]">
                <div>
                  <div className="font-bold text-slate-950">{round.label}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">{round.periodLabel}</div>
                </div>
                <div className="text-slate-600">{round.targetCountLabel}</div>
                <div className="text-slate-600">{round.mappingStatusLabel}</div>
                <div className="text-slate-600">{round.responseStatusLabel}</div>
                <div className="font-semibold text-slate-900">{round.statusLabel}</div>
              </div>
            ))}
          </div>
        </div>
        <aside className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-base font-bold text-slate-950">운영 작업</h2>
          <div className="mt-4 space-y-2">
            {props.mappingHref ? (
              <Link href={props.mappingHref} className="flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-4 text-sm font-bold text-white">
                평가자 매핑 화면 열기
              </Link>
            ) : (
              <button type="button" disabled className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
                평가자 매핑 화면 연결 필요
              </button>
            )}
            <button type="button" disabled className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
              라운드 생성
            </button>
            <button type="button" disabled className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
              결과 공유 메일 준비
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}
