'use client'

import { Feedback360Avatar, type Feedback360AvatarPerson } from './Feedback360Avatar'

export type Feedback360EvaluatorMappingPptCandidate = {
  key: string
  name: string
  department?: string | null
  position?: string | null
  relationshipLabel: string
  scoreLabel?: string | null
  rationale?: string | null
  selected?: boolean
  avatar?: Feedback360AvatarPerson | null
}

export function Feedback360EvaluatorMappingPpt(props: {
  target: Feedback360AvatarPerson & { name: string; department?: string | null; position?: string | null }
  candidates: Feedback360EvaluatorMappingPptCandidate[]
  children?: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Feedback360Avatar person={props.target} size="lg" />
          <div>
            <h2 className="text-base font-bold text-slate-950">평가자 매핑 관리</h2>
            <div className="mt-1 text-sm font-semibold text-slate-500">
              {props.target.name} · {[props.target.department, props.target.position].filter(Boolean).join(' · ') || '소속 확인 필요'}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {props.candidates.map((candidate) => (
            <article key={candidate.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start gap-3">
                <Feedback360Avatar person={{ ...candidate.avatar, name: candidate.name }} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-950">{candidate.name}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {[candidate.department, candidate.position, candidate.relationshipLabel].filter(Boolean).join(' · ')}
                  </div>
                  {candidate.scoreLabel ? <div className="mt-2 text-xs font-bold text-blue-700">{candidate.scoreLabel}</div> : null}
                  {candidate.rationale ? <p className="mt-1 text-xs leading-5 text-slate-600">{candidate.rationale}</p> : null}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${candidate.selected ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {candidate.selected ? '선택됨' : '후보'}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
      <aside className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">{props.children}</aside>
    </section>
  )
}
