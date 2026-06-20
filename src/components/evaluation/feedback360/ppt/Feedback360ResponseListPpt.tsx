'use client'

import Link from 'next/link'
import { Search } from 'lucide-react'
import { Feedback360Avatar, type Feedback360AvatarPerson } from './Feedback360Avatar'
import { Feedback360PptSummaryCards, type Feedback360PptSummaryCard } from './Feedback360PptPrimitives'

export type Feedback360ResponseListPptRow = {
  key: string
  receiverName: string
  receiverDepartment?: string | null
  receiverPosition?: string | null
  periodLabel: string
  statusLabel: string
  dueLabel: string
  progress: number
  actionLabel: string
  href: string
  avatar?: Feedback360AvatarPerson | null
}

export function Feedback360ResponseListPpt(props: {
  title?: string
  rows: Feedback360ResponseListPptRow[]
  summaryCards: Feedback360PptSummaryCard[]
  searchValue: string
  onSearchChange: (value: string) => void
}) {
  return (
    <section className="space-y-4">
      <Feedback360PptSummaryCards cards={props.summaryCards} />
      <div className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">{props.title ?? `내가 평가할 사람 (${props.rows.length})`}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">피평가자, 소속, 마감일을 기준으로 확인합니다.</p>
          </div>
          <label className="flex h-10 min-w-[240px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={props.searchValue}
              onChange={(event) => props.onSearchChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="이름, 부서 검색"
            />
          </label>
        </div>
        <div className="overflow-hidden">
          <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(120px,1fr)_120px_110px_100px_112px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
            <div>피평가자</div>
            <div>소속</div>
            <div>평가 기간</div>
            <div>상태</div>
            <div>진행률</div>
            <div>평가하기</div>
          </div>
          {props.rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(180px,1.4fr)_minmax(120px,1fr)_120px_110px_100px_112px] items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Feedback360Avatar person={{ ...row.avatar, name: row.receiverName }} size="sm" />
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-950">{row.receiverName}</div>
                  <div className="truncate text-xs text-slate-400">{row.receiverPosition ?? '직급 확인 필요'}</div>
                </div>
              </div>
              <div className="truncate text-slate-600">{row.receiverDepartment ?? '소속 확인 필요'}</div>
              <div className="text-xs font-semibold text-slate-500">{row.periodLabel}</div>
              <div>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  {row.statusLabel}
                </span>
                <div className="mt-1 text-[11px] font-semibold text-rose-500">{row.dueLabel}</div>
              </div>
              <div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(row.progress, 100))}%` }} />
                </div>
                <div className="mt-1 text-[11px] font-bold text-slate-500">{row.progress}%</div>
              </div>
              <Link
                href={row.href}
                className="inline-flex min-h-9 items-center justify-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white"
              >
                {row.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
