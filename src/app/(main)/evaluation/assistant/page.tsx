'use client'

import { type ReactNode, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, CheckCircle2, FileText, Sparkles, ShieldAlert, TrendingUp } from 'lucide-react'
import { EVAL_STAGE_LABELS } from '@/lib/utils'

type EvaluationListItem = {
  id: string
  evalStage: 'SELF' | 'FIRST' | 'SECOND' | 'FINAL' | 'CEO_ADJUST'
  status: string
  totalScore: number | null
  comment: string | null
  items: Array<{
    personalKpi?: {
      kpiName: string
      kpiType: string
      weight: number
    } | null
    quantScore?: number | null
    planScore?: number | null
    doScore?: number | null
    checkScore?: number | null
    actScore?: number | null
    itemComment?: string | null
  }>
  evalCycle?: {
    cycleName: string
    evalYear: number
    status?: string
  }
  target?: {
    empName: string
    position: string
    department?: { deptName: string } | null
  }
  evaluator?: {
    empName: string
    position: string
  }
}

type AssistPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  requestType: 'EVAL_COMMENT_DRAFT' | 'BIAS_ANALYSIS' | 'GROWTH_PLAN'
  result: Record<string, unknown>
}

type AssistCardProps = {
  title: string
  icon: ReactNode
  description: string
  onClick: () => void
  isPending: boolean
}

export default function EvaluationAssistantPage() {
  const [selectedId, setSelectedId] = useState<string>('')
  const [draftComment, setDraftComment] = useState('')
  const [growthPlan, setGrowthPlan] = useState('')
  const [preview, setPreview] = useState<AssistPreview | null>(null)

  const { data: evaluatorEvals = [] } = useQuery<EvaluationListItem[]>({
    queryKey: ['evaluations', 'assistant', 'evaluator'],
    queryFn: async () => {
      const res = await fetch('/api/evaluation?type=evaluator')
      const json = await res.json()
      return json.data || []
    },
  })

  const { data: targetEvals = [] } = useQuery<EvaluationListItem[]>({
    queryKey: ['evaluations', 'assistant', 'target'],
    queryFn: async () => {
      const res = await fetch('/api/evaluation?type=target')
      const json = await res.json()
      return json.data || []
    },
  })

  const evaluations = useMemo(() => {
    const evaluatorView = evaluatorEvals.map((item) => ({ ...item, perspective: 'evaluator' as const }))
    const targetView = targetEvals.map((item) => ({ ...item, perspective: 'target' as const }))
    return [...evaluatorView, ...targetView]
  }, [evaluatorEvals, targetEvals])

  const selectedEvaluation = evaluations.find((item) => item.id === selectedId) || evaluations[0] || null

  const assistMutation = useMutation({
    mutationFn: async (requestType: AssistPreview['requestType']) => {
      if (!selectedEvaluation) {
        throw new Error('선택된 평가가 없습니다.')
      }

      const payload = {
        summary: draftComment || selectedEvaluation.comment || '',
        gradeName: selectedEvaluation.totalScore ? `${selectedEvaluation.totalScore}점` : '',
        stage: selectedEvaluation.evalStage,
        cycleName: selectedEvaluation.evalCycle?.cycleName,
        evalYear: selectedEvaluation.evalCycle?.evalYear,
        items: selectedEvaluation.items.map((item) => ({
          kpiName: item.personalKpi?.kpiName,
          weight: item.personalKpi?.weight,
          quantScore: item.quantScore,
          planScore: item.planScore,
          doScore: item.doScore,
          checkScore: item.checkScore,
          actScore: item.actScore,
          itemComment: item.itemComment,
        })),
        contextSummary:
          selectedEvaluation.target?.department?.deptName || selectedEvaluation.evaluator?.position || '',
      }

      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType,
          sourceType: 'Evaluation',
          sourceId: selectedEvaluation.id,
          payload,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || 'AI 보조 생성에 실패했습니다.')
      }

      return {
        ...json.data,
        requestType,
      } as AssistPreview
    },
    onSuccess: (data) => {
      setPreview(data)
    },
  })

  const decisionMutation = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      if (!preview?.requestLogId) {
        return null
      }

      const res = await fetch(`/api/ai/request-logs/${preview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? preview.result : undefined,
          rejectionReason: action === 'reject' ? 'Suggestion dismissed during review.' : undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) {
        throw new Error(json.error?.message || '승인 상태를 저장하지 못했습니다.')
      }
      return json.data
    },
  })

  const approvePreview = async () => {
    if (!preview) return
    await decisionMutation.mutateAsync('approve')

    if (preview.requestType === 'EVAL_COMMENT_DRAFT') {
      setDraftComment(String(preview.result.draftComment || ''))
    }

    if (preview.requestType === 'BIAS_ANALYSIS') {
      setDraftComment(String(preview.result.balancedRewrite || draftComment))
    }

    if (preview.requestType === 'GROWTH_PLAN') {
      const actions = Array.isArray(preview.result.recommendedActions)
        ? (preview.result.recommendedActions as string[])
        : []
      const supports = Array.isArray(preview.result.supportNeeded)
        ? (preview.result.supportNeeded as string[])
        : []
      setGrowthPlan(
        [
          `집중 영역: ${String(preview.result.focusArea || '')}`,
          `실행 액션: ${actions.join(', ')}`,
          `필요 지원: ${supports.join(', ')}`,
          `마일스톤: ${String(preview.result.milestone || '')}`,
        ].join('\n')
      )
    }
  }

  const rejectPreview = async () => {
    if (!preview) return
    await decisionMutation.mutateAsync('reject')
    setPreview(null)
  }

  const overviewTitle = selectedEvaluation?.target?.empName
    ? `${selectedEvaluation.target.empName} 평가 보조`
    : selectedEvaluation?.evaluator?.empName
      ? `${selectedEvaluation.evaluator.empName} 피드백 보조`
      : '평가 보조'

  return (
    <div className="space-y-6">
      <section className="touch-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-500">AI Evaluation Assist</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">평가 보조 작성</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
          OpenAI 기반 구조화 출력으로 코멘트 초안, 편향 분석, 성장 계획을 생성합니다. 생성 결과는
          자동 제출되지 않으며, 승인 후에만 화면에 반영됩니다.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)_380px]">
        <section className="touch-card p-5">
          <h2 className="text-base font-semibold text-slate-900">대상 평가 선택</h2>
          <div className="mt-4 space-y-3">
            {evaluations.length ? (
              evaluations.map((evaluation) => {
                const selected = (selectedEvaluation?.id || '') === evaluation.id
                const label =
                  evaluation.target?.empName ||
                  evaluation.evaluator?.empName ||
                  evaluation.evalCycle?.cycleName ||
                  evaluation.id

                return (
                  <button
                    key={evaluation.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(evaluation.id)
                      setPreview(null)
                    }}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      selected
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {evaluation.evalCycle?.evalYear} · {EVAL_STAGE_LABELS[evaluation.evalStage]} · {evaluation.status}
                    </p>
                  </button>
                )
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                현재 보조할 평가 데이터가 없습니다.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="touch-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{overviewTitle}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedEvaluation?.evalCycle?.cycleName || '평가 데이터'} ·{' '}
                  {selectedEvaluation ? EVAL_STAGE_LABELS[selectedEvaluation.evalStage] : '-'}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                점수 {selectedEvaluation?.totalScore ?? '-'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <AssistCard
                title="코멘트 초안"
                icon={<FileText className="h-5 w-5" />}
                description="평가 근거를 바탕으로 균형 잡힌 초안을 생성합니다."
                onClick={() => assistMutation.mutate('EVAL_COMMENT_DRAFT')}
                isPending={assistMutation.isPending}
              />
              <AssistCard
                title="편향 분석"
                icon={<ShieldAlert className="h-5 w-5" />}
                description="주관적 표현과 근거 부족 문장을 점검합니다."
                onClick={() => assistMutation.mutate('BIAS_ANALYSIS')}
                isPending={assistMutation.isPending}
              />
              <AssistCard
                title="성장 계획"
                icon={<TrendingUp className="h-5 w-5" />}
                description="성장 액션과 지원 항목을 추천합니다."
                onClick={() => assistMutation.mutate('GROWTH_PLAN')}
                isPending={assistMutation.isPending}
              />
            </div>
          </div>

          <div className="touch-card p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Bot className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">검토용 초안 편집</h3>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">평가 코멘트</span>
                <textarea
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  className="min-h-40 w-full rounded-[1.5rem] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                  placeholder="AI 초안을 승인하면 여기에 반영됩니다."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">성장 계획 메모</span>
                <textarea
                  value={growthPlan}
                  onChange={(event) => setGrowthPlan(event.target.value)}
                  className="min-h-32 w-full rounded-[1.5rem] border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                  placeholder="성장 계획 추천 승인 시 여기에 반영됩니다."
                />
              </label>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="touch-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Approval</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">미리보기와 승인</h2>
            <p className="mt-2 text-sm text-slate-500">
              결과를 검토하고 승인해야만 코멘트 또는 성장 계획 메모에 반영됩니다.
            </p>
          </div>

          {preview ? (
            <>
              <div
                className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
                  preview.source === 'ai'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {preview.source === 'ai'
                  ? 'OpenAI 구조화 출력 결과입니다.'
                  : `AI 기능 비활성화 또는 API 실패로 기본 제안을 표시합니다. ${
                      preview.fallbackReason ? `(${preview.fallbackReason})` : ''
                    }`}
              </div>

              <div className="touch-card p-5">
                <div className="flex items-center gap-2 text-slate-900">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <h3 className="text-base font-semibold">{previewTitle(preview.requestType)}</h3>
                </div>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  {renderPreview(preview)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={approvePreview}
                  disabled={decisionMutation.isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  승인 후 반영
                </button>
                <button
                  type="button"
                  onClick={rejectPreview}
                  disabled={decisionMutation.isPending}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  반려
                </button>
              </div>
            </>
          ) : (
            <div className="touch-card p-6 text-sm text-slate-500">
              초안을 생성하면 이 영역에서 결과를 비교하고 승인할 수 있습니다. AI가 꺼져 있거나 실패해도
              기본 제안이 같은 위치에 나타납니다.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function AssistCard({ title, icon, description, onClick, isPending }: AssistCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60"
    >
      <div className="flex items-center gap-2 text-slate-900">
        {icon}
        <span className="font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </button>
  )
}

function previewTitle(requestType: AssistPreview['requestType']) {
  if (requestType === 'EVAL_COMMENT_DRAFT') return '평가 코멘트 초안'
  if (requestType === 'BIAS_ANALYSIS') return '편향 분석'
  return '성장 계획 추천'
}

function renderPreview(preview: AssistPreview) {
  if (preview.requestType === 'EVAL_COMMENT_DRAFT') {
    const strengths = Array.isArray(preview.result.strengths) ? (preview.result.strengths as string[]) : []
    const improvements = Array.isArray(preview.result.improvements)
      ? (preview.result.improvements as string[])
      : []

    return (
      <>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="font-semibold text-slate-900">요약</p>
          <p className="mt-2">{String(preview.result.summary || '')}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="font-semibold text-slate-900">강점</p>
          <div className="mt-2 space-y-2">
            {strengths.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="font-semibold text-slate-900">개선 포인트</p>
          <div className="mt-2 space-y-2">
            {improvements.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-blue-50 px-3 py-3 text-blue-800">
          <p className="font-semibold">초안</p>
          <p className="mt-2">{String(preview.result.draftComment || '')}</p>
        </div>
      </>
    )
  }

  if (preview.requestType === 'BIAS_ANALYSIS') {
    const findings = Array.isArray(preview.result.findings)
      ? (preview.result.findings as Array<{ severity: string; issue: string; recommendation: string }>)
      : []

    return (
      <>
        <div className="rounded-2xl bg-slate-50 px-3 py-3">
          <p className="font-semibold text-slate-900">리스크 수준</p>
          <p className="mt-2">{String(preview.result.riskLevel || '')}</p>
        </div>
        <div className="space-y-3">
          {findings.map((finding, index) => (
            <div key={`${finding.issue}-${index}`} className="rounded-2xl bg-slate-50 px-3 py-3">
              <p className="font-semibold text-slate-900">
                {finding.severity} · {finding.issue}
              </p>
              <p className="mt-2">{finding.recommendation}</p>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-blue-50 px-3 py-3 text-blue-800">
          <p className="font-semibold">균형 잡힌 재작성</p>
          <p className="mt-2">{String(preview.result.balancedRewrite || '')}</p>
        </div>
      </>
    )
  }

  const actions = Array.isArray(preview.result.recommendedActions)
    ? (preview.result.recommendedActions as string[])
    : []
  const supports = Array.isArray(preview.result.supportNeeded)
    ? (preview.result.supportNeeded as string[])
    : []

  return (
    <>
      <div className="rounded-2xl bg-slate-50 px-3 py-3">
        <p className="font-semibold text-slate-900">집중 영역</p>
        <p className="mt-2">{String(preview.result.focusArea || '')}</p>
      </div>
      <div className="rounded-2xl bg-slate-50 px-3 py-3">
        <p className="font-semibold text-slate-900">실행 액션</p>
        <div className="mt-2 space-y-2">
          {actions.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-slate-50 px-3 py-3">
        <p className="font-semibold text-slate-900">필요 지원</p>
        <div className="mt-2 space-y-2">
          {supports.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-blue-50 px-3 py-3 text-blue-800">
        <p className="font-semibold">마일스톤</p>
        <p className="mt-2">{String(preview.result.milestone || '')}</p>
      </div>
    </>
  )
}
