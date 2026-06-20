'use client'

import { Feedback360Avatar, type Feedback360AvatarPerson } from './Feedback360Avatar'
import { Feedback360PptToastDialog } from './Feedback360PptPrimitives'

export type Feedback360ResponseFormPptProfile = Feedback360AvatarPerson & {
  name: string
  department?: string | null
  position?: string | null
  collaborationPeriod?: string | null
  collaborationFrequency?: string | null
  collaborationSummary?: string | null
}

export function Feedback360ResponseFormPpt(props: {
  profile: Feedback360ResponseFormPptProfile
  statusLabel: string
  notice?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Feedback360Avatar person={props.profile} size="xl" />
          <div className="mt-4 text-lg font-bold text-slate-950">{props.profile.name}</div>
          <div className="mt-1 text-sm font-semibold text-slate-500">
            {[props.profile.department, props.profile.position].filter(Boolean).join(' · ') || '소속 확인 필요'}
          </div>
          <span className="mt-3 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {props.statusLabel}
          </span>
        </div>
        <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          <div>
            <div className="text-xs font-bold text-slate-400">함께 일한 기간</div>
            <div className="mt-1 font-semibold text-slate-800">{props.profile.collaborationPeriod ?? '확인 필요'}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">협업 빈도</div>
            <div className="mt-1 font-semibold text-slate-800">{props.profile.collaborationFrequency ?? '확인 필요'}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400">주요 협업 내용</div>
            <div className="mt-1 leading-6 text-slate-600">{props.profile.collaborationSummary ?? '데이터 없음'}</div>
          </div>
        </div>
      </aside>
      <div className="min-w-0 space-y-4">
        {props.notice ? <Feedback360PptToastDialog tone="success" title={props.notice} /> : null}
        {props.error ? <Feedback360PptToastDialog tone="error" title={props.error} /> : null}
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">{props.children}</div>
      </div>
    </section>
  )
}
