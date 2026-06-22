'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react'
import type {
  UpwardReviewAICoachingPreview,
  UpwardReviewAICoachingRole,
} from '@/lib/upward-review-ai-coaching'

type Props = {
  cycleId?: string | null
  roundId?: string | null
  targetEmployeeId?: string | null
  providerConfigured: boolean
  canUseAi: boolean
  disabledReason?: string | null
  criteriaSatisfied: boolean
  anonymitySatisfied: boolean
  responseCount: number
  anonymityThreshold: number
  mode: UpwardReviewAICoachingRole
  showManagerGuide: boolean
}

function Chip(props: { children: React.ReactNode; tone?: 'blue' | 'emerald' | 'amber' | 'slate' }) {
  const tone = props.tone ?? 'slate'
  const className =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>{props.children}</span>
}

function SectionCard(props: {
  title: string
  children: React.ReactNode
  tone?: 'emerald' | 'amber' | 'blue' | 'slate'
}) {
  const tone = props.tone ?? 'slate'
  const className =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50'
          : 'border-slate-200 bg-white'

  return (
    <section className={`rounded-2xl border p-4 ${className}`}>
      <h3 className="text-sm font-bold text-slate-950">{props.title}</h3>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{props.children}</div>
    </section>
  )
}

function BulletList(props: { items: string[]; empty?: string }) {
  if (!props.items.length) {
    return <p className="text-sm text-slate-500">{props.empty ?? '충분한 근거가 확인되면 표시됩니다.'}</p>
  }

  return (
    <ul className="space-y-2">
      {props.items.map((item, index) => (
        <li key={`${index}:${item}`} className="rounded-xl border border-white/60 bg-white/70 px-3 py-2">
          {item}
        </li>
      ))}
    </ul>
  )
}

function formatCoachingForClipboard(preview: UpwardReviewAICoachingPreview) {
  const result = preview.result
  return [
    'AI 리더십 코칭',
    result.summary,
    '',
    '[강점 코칭]',
    ...result.leadershipStrengths.flatMap((item) => [
      `- ${item.title}`,
      `  카테고리: ${item.category}`,
      `  관찰 행동: ${item.observedBehavior}`,
      `  유지 행동: ${item.keepDoing.join(', ') || '추가 확인 필요'}`,
      `  팀 영향: ${item.teamImpact}`,
    ]),
    '',
    '[보완 코칭]',
    ...result.developmentAreas.flatMap((item) => [
      `- ${item.title}`,
      `  카테고리: ${item.category}`,
      `  반복 패턴: ${item.observedPattern}`,
      `  영향: ${item.impact}`,
      `  행동: ${item.recommendedActions.join(', ') || '추가 확인 필요'}`,
    ]),
    '',
    '[30/60/90일 실행 계획]',
    `30일: ${result.actionPlan30Days.join(' / ')}`,
    `60일: ${result.actionPlan60Days.join(' / ')}`,
    `90일: ${result.actionPlan90Days.join(' / ')}`,
    '',
    result.safetyNote,
  ].join('\n')
}

function formatPlanForClipboard(preview: UpwardReviewAICoachingPreview) {
  const result = preview.result
  return [
    '리더십 진단 30/60/90일 실행 계획',
    `30일: ${result.actionPlan30Days.join(' / ')}`,
    `60일: ${result.actionPlan60Days.join(' / ')}`,
    `90일: ${result.actionPlan90Days.join(' / ')}`,
  ].join('\n')
}

function toSafeAiCoachingErrorMessage(error: unknown) {
  const fallback = 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'
  if (!(error instanceof Error)) return fallback

  const message = error.message.trim()
  if (
    message.includes('AI 코칭') ||
    message.includes('응답 수와 익명 기준') ||
    message.includes('로그인이 필요합니다') ||
    message.includes('권한이 없습니다')
  ) {
    return message
  }

  return fallback
}

export function LeadershipDiagnosisAiCoachingPanel(props: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<UpwardReviewAICoachingPreview | null>(null)
  const [copied, setCopied] = useState<'all' | 'plan' | ''>('')

  const disabledReason = useMemo(() => {
    if (!props.providerConfigured) {
      return 'AI 코칭 설정이 완료되지 않아 현재는 결과 요약과 후속 액션만 확인할 수 있습니다.'
    }
    if (!props.roundId || !props.targetEmployeeId) {
      return '리더십 진단 결과 데이터가 준비되면 AI 코칭을 생성할 수 있습니다.'
    }
    if (!props.canUseAi || !props.criteriaSatisfied || !props.anonymitySatisfied) {
      return '응답 수와 익명 기준이 충족되면 AI 코칭을 생성할 수 있습니다.'
    }
    return props.disabledReason ?? ''
  }, [
    props.anonymitySatisfied,
    props.canUseAi,
    props.criteriaSatisfied,
    props.disabledReason,
    props.providerConfigured,
    props.roundId,
    props.targetEmployeeId,
  ])
  const canGenerate = !disabledReason

  async function handleGenerate() {
    if (!canGenerate || busy) return

    setBusy(true)
    setError('')
    setCopied('')

    try {
      const response = await fetch('/api/feedback/upward/results/ai-coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: props.cycleId ?? undefined,
          roundId: props.roundId ?? undefined,
          empId: props.targetEmployeeId ?? undefined,
          mode: props.mode,
        }),
      })
      const json = await response.json()

      if (!json.success) {
        throw new Error(json.error?.message || 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }

      setPreview(json.data as UpwardReviewAICoachingPreview)
    } catch (generateError) {
      setError(toSafeAiCoachingErrorMessage(generateError))
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy(kind: 'all' | 'plan') {
    if (!preview || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(
      kind === 'all' ? formatCoachingForClipboard(preview) : formatPlanForClipboard(preview)
    )
    setCopied(kind)
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <Sparkles className="h-4 w-4" />
            AI 리더십 코칭
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-950">성장 대화와 실행 계획 정리</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            리더십 진단 결과를 바탕으로 성장 대화와 실행 계획을 정리합니다.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            공식 평가 점수나 등급을 자동 산정하지 않습니다.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            개별 응답자를 추정하거나 공개하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={props.criteriaSatisfied ? 'emerald' : 'amber'}>
            응답 기준 {props.criteriaSatisfied ? '충족' : '대기'}
          </Chip>
          <Chip tone={props.anonymitySatisfied ? 'emerald' : 'amber'}>
            익명 기준 {props.anonymitySatisfied ? '충족' : '대기'}
          </Chip>
          <Chip tone={props.providerConfigured ? 'blue' : 'slate'}>
            AI 설정 {props.providerConfigured ? '완료' : '필요'}
          </Chip>
          <Chip>
            응답 {props.responseCount}/{props.anonymityThreshold}
          </Chip>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm leading-6 text-slate-600">
            {disabledReason
              ? disabledReason
              : '익명 기준을 충족한 진단 요약 데이터를 바탕으로 참고용 코칭을 생성할 수 있습니다.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {preview ? (
              <>
                <button
                  type="button"
                  onClick={() => handleCopy('all')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  {copied === 'all' ? '전체 복사됨' : '전체 복사'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('plan')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4" />
                  {copied === 'plan' ? '실행 계획 복사됨' : '실행 계획 복사'}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? '리더십 행동 패턴과 의견을 분석하고 있습니다.' : preview ? '다시 생성' : 'AI 코칭 생성'}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">AI 코칭 생성에 실패했습니다.</div>
            <div>{error}</div>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 space-y-5">
          <SectionCard title="한 줄 요약" tone="blue">
            <p>{preview.result.summary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip tone="blue">신뢰도 {preview.result.confidenceLevel}</Chip>
              <Chip>응답 {preview.source.responseCount}건</Chip>
              <Chip>카테고리 {preview.source.categoryCount}개</Chip>
              <Chip>의견 요약 {preview.source.commentSummaryCount}개</Chip>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title="강점 코칭" tone="emerald">
              {preview.result.leadershipStrengths.length ? (
                preview.result.leadershipStrengths.slice(0, 3).map((item) => (
                  <article key={`${item.category}:${item.title}`} className="rounded-xl bg-white/80 px-3 py-3">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-2 text-xs font-semibold text-emerald-700">근거 카테고리: {item.category}</div>
                    <p className="mt-2">{item.observedBehavior}</p>
                    <BulletList items={item.keepDoing} empty="유지 행동은 추가 생성 후 표시됩니다." />
                    <p className="mt-2 text-slate-600">{item.teamImpact}</p>
                  </article>
                ))
              ) : (
                <BulletList items={[]} />
              )}
            </SectionCard>

            <SectionCard title="보완 코칭" tone="amber">
              {preview.result.developmentAreas.length ? (
                preview.result.developmentAreas.slice(0, 3).map((item) => (
                  <article key={`${item.category}:${item.title}`} className="rounded-xl bg-white/80 px-3 py-3">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-2 text-xs font-semibold text-amber-700">근거 카테고리: {item.category}</div>
                    <p className="mt-2">{item.observedPattern}</p>
                    <p className="mt-2 text-slate-600">{item.impact}</p>
                    <BulletList items={item.recommendedActions} empty="개선 행동은 추가 생성 후 표시됩니다." />
                  </article>
                ))
              ) : (
                <BulletList items={[]} />
              )}
            </SectionCard>
          </div>

          <SectionCard title="Blind spot / 주의 신호">
            {preview.result.blindSpots.length ? (
              preview.result.blindSpots.slice(0, 3).map((item) => (
                <article key={item.title} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-2">{item.whyItMatters}</p>
                  <BulletList items={item.signals} empty="뚜렷한 blind spot은 확인되지 않았습니다." />
                  <p className="mt-2 text-slate-600">{item.suggestedCheck}</p>
                </article>
              ))
            ) : (
              <p>뚜렷한 blind spot은 확인되지 않았습니다.</p>
            )}
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-3">
            <SectionCard title="30일 실행 계획">
              <BulletList items={preview.result.actionPlan30Days} />
            </SectionCard>
            <SectionCard title="60일 실행 계획">
              <BulletList items={preview.result.actionPlan60Days} />
            </SectionCard>
            <SectionCard title="90일 실행 계획">
              <BulletList items={preview.result.actionPlan90Days} />
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title="성장 대화 질문" tone="blue">
              <div className="font-semibold text-slate-900">스스로 점검할 질문</div>
              <BulletList items={preview.result.coachingQuestions.selfReflection} />
              <div className="pt-2 font-semibold text-slate-900">팀원/동료와 나눌 질문</div>
              <BulletList items={preview.result.coachingQuestions.teamConversation} />
              <div className="pt-2 font-semibold text-slate-900">다음 체크인 질문</div>
              <BulletList items={preview.result.coachingQuestions.nextCheckIn} />
            </SectionCard>

            <SectionCard title={props.showManagerGuide ? '팀장/HR 참고용 코칭 가이드' : '리더와 논의하면 좋은 질문'}>
              {props.showManagerGuide ? (
                <>
                  <div className="font-semibold text-slate-900">인정할 점</div>
                  <BulletList items={preview.result.managerHrGuide.recognize} />
                  <div className="pt-2 font-semibold text-slate-900">질문할 점</div>
                  <BulletList items={preview.result.managerHrGuide.ask} />
                  <div className="pt-2 font-semibold text-slate-900">함께 합의할 행동</div>
                  <BulletList items={preview.result.managerHrGuide.agree} />
                  <div className="pt-2 font-semibold text-slate-900">다음 체크인 약속</div>
                  <BulletList items={preview.result.managerHrGuide.followUp} />
                </>
              ) : (
                <BulletList items={preview.result.coachingQuestions.teamConversation} />
              )}
            </SectionCard>
          </div>

          <SectionCard title="안전 안내">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p>{preview.result.safetyNote}</p>
            </div>
            <BulletList items={preview.result.dataLimitations} empty="현재 표시할 추가 데이터 한계가 없습니다." />
          </SectionCard>
        </div>
      ) : null}
    </section>
  )
}
