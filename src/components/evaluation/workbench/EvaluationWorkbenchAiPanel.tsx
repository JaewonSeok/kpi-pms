import type { ReactNode } from 'react'
import {
  getEvaluationAssistActionLabel,
  type EvaluationAssistMode,
  type EvaluationAssistResult,
} from '@/lib/evaluation-ai-assist'
import { PreviewList } from '@/components/evaluation/workbench/EvaluationWorkbenchEvidencePanel'
export function AiCard(props: {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        props.active
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 text-slate-900">
        {props.icon}
        <span className="text-sm font-semibold">{props.title}</span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{props.description}</p>
      {props.loading ? <p className="mt-3 text-xs font-semibold text-blue-600">AI 제안을 생성하고 있습니다...</p> : null}
    </button>
  )
}

export function AssistPreviewDetails(props: {
  mode: EvaluationAssistMode
  result: EvaluationAssistResult
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {getEvaluationAssistActionLabel(props.mode)}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{props.result.draftText}</p>
      </div>
      <PreviewList title="강점 포인트" items={props.result.strengths} />
      <PreviewList title="우려 포인트" items={props.result.concerns} />
      <PreviewList title="코칭 포인트" items={props.result.coachingPoints} />
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">다음 단계</div>
        <p className="mt-2 text-sm text-slate-800">{props.result.nextStep}</p>
      </div>
    </div>
  )
}


