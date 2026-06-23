'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react'
import type {
  Feedback360AiCoachingResult,
  Feedback360AiCoachingRole,
} from './feedback360AiCoachingPrompt'
import { isCeoDemoMode, useCeoDemoLocalState } from '@/lib/demo/ceo-demo-mode'

type Feedback360AiCoachingPreview = {
  generatedAt: string
  mode: Feedback360AiCoachingRole
  result: Feedback360AiCoachingResult
  source: {
    responseCount: number
    anonymityThreshold: number
    anonymitySatisfied: boolean
    categoryCount: number
    positiveTagCount: number
    improvementTagCount: number
  }
  disclaimer: string
}

type Props = {
  cycleId?: string | null
  roundId?: string | null
  targetEmployeeId?: string | null
  providerConfigured: boolean
  canUseAi: boolean
  disabledReason?: string | null
  anonymitySatisfied: boolean
  responseCount: number
  anonymityThreshold: number
  mode: Feedback360AiCoachingRole
  showManagerGuide: boolean
  compact?: boolean
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

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{props.children}</span>
}

function SectionCard(props: { title: string; children: React.ReactNode; tone?: 'emerald' | 'amber' | 'blue' | 'slate' }) {
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

function formatCoachingForClipboard(preview: Feedback360AiCoachingPreview) {
  const result = preview.result
  return [
    'AI 코칭 인사이트',
    result.summary,
    '',
    '[강점 코칭]',
    ...result.strengths.flatMap((item) => [
      `- ${item.title}`,
      `  근거: ${item.evidence.join(', ') || '반복 패턴 확인 필요'}`,
      `  코칭: ${item.coaching}`,
      `  유지 행동: ${item.keepDoing.join(', ') || '추가 확인 필요'}`,
    ]),
    '',
    '[보완 코칭]',
    ...result.developmentAreas.flatMap((item) => [
      `- ${item.title}`,
      `  근거: ${item.evidence.join(', ') || '반복 패턴 확인 필요'}`,
      `  영향: ${item.impact}`,
      `  행동: ${item.recommendedActions.join(', ') || '추가 확인 필요'}`,
    ]),
    '',
    '[30/60/90 실행 계획]',
    `30일: ${result.actionPlan30Days.join(' / ')}`,
    `60일: ${result.actionPlan60Days.join(' / ')}`,
    `90일: ${result.actionPlan90Days.join(' / ')}`,
    '',
    result.safetyNote,
  ].join('\n')
}

function toSafeAiCoachingErrorMessage(error: unknown) {
  const fallback = 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.'
  if (!(error instanceof Error)) return fallback

  const message = error.message.trim()
  if (
    message.includes('AI 코칭') ||
    message.includes('응답 수와 익명 기준') ||
    message.includes('로그인이 필요합니다')
  ) {
    return message
  }

  return fallback
}

function buildDemoFeedback360CoachingPreview(props: Props): Feedback360AiCoachingPreview {
  return {
    generatedAt: new Date().toISOString(),
    mode: props.mode,
    disclaimer: 'AI 코칭은 참고용 성장 인사이트이며 공식 평가 점수나 등급을 자동 산정하지 않습니다.',
    source: {
      responseCount: Math.max(props.responseCount, props.anonymityThreshold),
      anonymityThreshold: props.anonymityThreshold,
      anonymitySatisfied: true,
      categoryCount: 5,
      positiveTagCount: 8,
      improvementTagCount: 4,
    },
    result: {
      summary: '다면평가 태그와 의견 흐름을 바탕으로 협업 강점과 다음 실행 계획을 정리했습니다.',
      confidenceLevel: 'MEDIUM',
      dataLimitations: ['시연 환경에서는 운영 데이터에 반영되지 않습니다.'],
      strengths: [
        {
          title: '협업 요청에 빠르게 대응',
          evidence: ['빠른 대응', '정보 공유'],
          coaching: '협업 요청을 받은 뒤 필요한 맥락을 빠르게 정리해 팀의 대기 시간을 줄입니다.',
          keepDoing: ['요청 접수 후 다음 액션과 예상 시점을 바로 공유합니다.'],
        },
        {
          title: '책임감 있는 마무리',
          evidence: ['책임감', '실행력'],
          coaching: '맡은 과제를 끝까지 챙기는 행동이 반복적으로 관찰됩니다.',
          keepDoing: ['마감 전 리스크를 먼저 공유하고 필요한 지원을 요청합니다.'],
        },
      ],
      developmentAreas: [
        {
          title: '의사결정 근거 공유 강화',
          evidence: ['결정 배경 부족', '정보 비대칭'],
          impact: '결정 배경이 늦게 공유되면 협업자가 우선순위를 재조정하기 어렵습니다.',
          recommendedActions: ['결정사항마다 이유와 다음 액션을 함께 남깁니다.', '변경이 생기면 영향받는 사람을 먼저 확인합니다.'],
        },
      ],
      blindSpots: [
        {
          title: '바쁜 시기의 커뮤니케이션 간격',
          whyItMatters: '일정이 촘촘할수록 주변 동료가 진행 상황을 추측하게 될 수 있습니다.',
          signals: ['문의가 반복되는 경우', '마감 직전 확인 요청이 늘어나는 경우'],
          suggestedCheck: '주요 협업 과제에는 중간 공유 시점을 하나 더 둡니다.',
        },
      ],
      actionPlan30Days: ['협업 요청마다 응답 시점과 처리 방향을 한 문장으로 공유합니다.'],
      actionPlan60Days: ['반복 문의가 생기는 업무를 체크리스트로 정리합니다.'],
      actionPlan90Days: ['협업자가 체감한 변화 사례를 모아 다음 다면평가 전 점검합니다.'],
      coachingQuestions: {
        selfReflection: ['최근 협업자가 내 진행 상황을 기다리게 만든 순간은 언제였나요?'],
        managerConversation: ['우선순위 충돌이 생길 때 어떤 기준으로 조정하면 좋을까요?'],
        nextCheckIn: ['다음 30일 동안 커뮤니케이션 간격을 줄일 행동은 무엇인가요?'],
      },
      managerGuide: {
        recognize: ['빠른 대응과 책임감 있는 마무리 행동을 구체적으로 인정합니다.'],
        ask: ['정보 공유가 늦어지는 상황과 원인을 함께 확인합니다.'],
        agree: ['중간 공유 시점과 공유 채널을 합의합니다.'],
        followUp: ['다음 체크인에서 반복 문의가 줄었는지 확인합니다.'],
      },
      safetyNote: '시연 환경에서는 운영 데이터에 반영되지 않으며 공식 평가 점수나 등급을 산정하지 않습니다.',
    },
  }
}

export function Feedback360AiCoachingPanel(props: Props) {
  const searchParams = useSearchParams()
  const ceoDemoMode = isCeoDemoMode(searchParams)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Feedback360AiCoachingPreview | null>(null)
  const [copied, setCopied] = useState(false)
  const [, setDemoCoachingState] = useCeoDemoLocalState('ceo-demo-feedback360-ai-coaching', {
    status: '대기',
    updatedAt: '',
  })

  const disabledReason = useMemo(() => {
    if (ceoDemoMode) return ''
    if (!props.providerConfigured) return 'AI 코칭을 사용하려면 AI 설정이 필요합니다.'
    if (!props.roundId || !props.targetEmployeeId) return '결과 리포트 데이터가 준비되면 AI 코칭을 생성할 수 있습니다.'
    if (!props.anonymitySatisfied || !props.canUseAi) {
      return '응답 수와 익명 기준이 충족되면 AI 코칭을 생성할 수 있습니다.'
    }
    return props.disabledReason ?? ''
  }, [
    props.anonymitySatisfied,
    props.canUseAi,
    props.disabledReason,
    props.providerConfigured,
    props.roundId,
    props.targetEmployeeId,
    ceoDemoMode,
  ])
  const canGenerate = !disabledReason

  async function handleGenerate() {
    if (!canGenerate || busy) return

    setBusy(true)
    setError('')
    setCopied(false)

    try {
      if (ceoDemoMode) {
        setPreview(buildDemoFeedback360CoachingPreview(props))
        setDemoCoachingState({ status: '생성완료', updatedAt: new Date().toISOString() })
        return
      }

      const response = await fetch('/api/feedback/360/ai-coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: props.cycleId ?? undefined,
          roundId: props.roundId ?? undefined,
          targetEmployeeId: props.targetEmployeeId ?? undefined,
          mode: props.mode,
        }),
      })
      const json = await response.json()

      if (!json.success) {
        throw new Error(json.error?.message || 'AI 코칭 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      }

      setPreview(json.data as Feedback360AiCoachingPreview)
    } catch (generateError) {
      setError(toSafeAiCoachingErrorMessage(generateError))
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!preview || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(formatCoachingForClipboard(preview))
    setCopied(true)
  }

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
            <Sparkles className="h-4 w-4" />
            AI 코칭 인사이트
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-950">성장 대화와 실행 계획 정리</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            다면평가 결과를 바탕으로 성장 대화와 실행 계획을 정리합니다.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            공식 평가 점수나 등급을 자동 산정하지 않습니다.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            개별 리뷰어를 추정하거나 공개하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              ? `${disabledReason} 현재는 결과 요약과 후속 액션만 확인할 수 있습니다.`
              : '익명 기준을 충족한 태그와 요약 데이터를 바탕으로 참고용 코칭을 생성할 수 있습니다.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {preview ? (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                {copied ? '복사됨' : '복사'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || busy}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? '다면평가 태그와 의견을 분석하고 있습니다.' : preview ? '다시 생성' : 'AI 코칭 생성'}
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
        <div className={`mt-5 space-y-5 ${props.compact ? 'text-sm' : ''}`}>
          <SectionCard title="한 줄 요약" tone="blue">
            <p>{preview.result.summary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip tone="blue">신뢰도 {preview.result.confidenceLevel}</Chip>
              <Chip>응답 {preview.source.responseCount}건</Chip>
              <Chip>강점 태그 {preview.source.positiveTagCount}개</Chip>
              <Chip>보완 태그 {preview.source.improvementTagCount}개</Chip>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard title="강점 코칭" tone="emerald">
              {preview.result.strengths.length ? (
                preview.result.strengths.slice(0, 3).map((item) => (
                  <article key={item.title} className="rounded-xl bg-white/80 px-3 py-3">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-2 text-xs font-semibold text-emerald-700">
                      근거 태그: {item.evidence.join(', ') || '반복 패턴 확인 필요'}
                    </div>
                    <p className="mt-2">{item.coaching}</p>
                    <BulletList items={item.keepDoing} empty="유지 행동은 추가 생성 후 표시됩니다." />
                  </article>
                ))
              ) : (
                <BulletList items={[]} />
              )}
            </SectionCard>

            <SectionCard title="보완 코칭" tone="amber">
              {preview.result.developmentAreas.length ? (
                preview.result.developmentAreas.slice(0, 3).map((item) => (
                  <article key={item.title} className="rounded-xl bg-white/80 px-3 py-3">
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-2 text-xs font-semibold text-amber-700">
                      근거 태그: {item.evidence.join(', ') || '반복 패턴 확인 필요'}
                    </div>
                    <p className="mt-2">{item.impact}</p>
                    <BulletList items={item.recommendedActions} empty="개선 행동은 추가 생성 후 표시됩니다." />
                  </article>
                ))
              ) : (
                <BulletList items={[]} />
              )}
            </SectionCard>
          </div>

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
              <div className="pt-2 font-semibold text-slate-900">리더와 논의할 질문</div>
              <BulletList items={preview.result.coachingQuestions.managerConversation} />
              <div className="pt-2 font-semibold text-slate-900">다음 체크인 질문</div>
              <BulletList items={preview.result.coachingQuestions.nextCheckIn} />
            </SectionCard>

            <SectionCard title={props.showManagerGuide ? '팀장/HR 참고용 코칭 가이드' : '리더와 함께 논의하면 좋은 질문'}>
              {props.showManagerGuide ? (
                <>
                  <div className="font-semibold text-slate-900">인정할 점</div>
                  <BulletList items={preview.result.managerGuide.recognize} />
                  <div className="pt-2 font-semibold text-slate-900">질문할 점</div>
                  <BulletList items={preview.result.managerGuide.ask} />
                  <div className="pt-2 font-semibold text-slate-900">함께 합의할 행동</div>
                  <BulletList items={preview.result.managerGuide.agree} />
                  <div className="pt-2 font-semibold text-slate-900">다음 체크인 약속</div>
                  <BulletList items={preview.result.managerGuide.followUp} />
                </>
              ) : (
                <BulletList items={preview.result.coachingQuestions.managerConversation} />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
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
            <SectionCard title="주의사항">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p>{preview.result.safetyNote}</p>
              </div>
              <BulletList items={preview.result.dataLimitations} empty="현재 표시할 추가 데이터 한계가 없습니다." />
            </SectionCard>
          </div>
        </div>
      ) : null}
    </section>
  )
}
