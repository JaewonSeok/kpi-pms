'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react'
import type {
  UpwardReviewAICoachingPreview,
  UpwardReviewAICoachingRole,
} from '@/lib/upward-review-ai-coaching'
import { isCeoDemoMode, useCeoDemoLocalState } from '@/lib/demo/ceo-demo-mode'

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

function buildDemoLeadershipCoachingPreview(props: Props): UpwardReviewAICoachingPreview {
  return {
    generatedAt: new Date().toISOString(),
    mode: props.mode,
    disclaimer: 'AI 코칭은 참고용 성장 인사이트이며 공식 평가 점수나 등급을 자동 산정하지 않습니다.',
    source: {
      responseCount: Math.max(props.responseCount, props.anonymityThreshold),
      anonymityThreshold: props.anonymityThreshold,
      anonymitySatisfied: true,
      categoryCount: 5,
      commentSummaryCount: 3,
    },
    result: {
      summary: '구성원이 체감하는 리더십 경험을 바탕으로 실행 중심의 성장 코칭 방향을 정리했습니다.',
      confidenceLevel: 'MEDIUM',
      dataLimitations: ['시연 환경에서는 운영 데이터에 반영되지 않습니다.'],
      leadershipStrengths: [
        {
          title: '목표와 우선순위 정렬',
          category: '바른생각 (커뮤니케이션)',
          observedBehavior: '팀 목표를 짧고 명확한 실행 단위로 설명합니다.',
          evidence: ['목표 설명과 정보 공유 관련 긍정 응답'],
          keepDoing: ['회의 시작 시 이번 주 우선순위를 한 문장으로 확인합니다.'],
          teamImpact: '구성원이 같은 기준으로 업무를 선택할 수 있습니다.',
        },
        {
          title: '실행 과정 점검',
          category: '전략적 사고',
          observedBehavior: '중요한 결정에서 리스크와 우선순위를 함께 확인합니다.',
          evidence: ['실행 관리와 의사결정 관련 응답'],
          keepDoing: ['주요 과제마다 다음 점검 시점을 먼저 정합니다.'],
          teamImpact: '진행 중 이슈를 늦기 전에 드러내고 조정할 수 있습니다.',
        },
      ],
      developmentAreas: [
        {
          title: '피드백 루틴 강화',
          category: '피드백/코칭',
          observedPattern: '성과 피드백이 특정 시점에 몰리면 구성원이 개선 방향을 늦게 파악할 수 있습니다.',
          impact: '팀원이 스스로 조정할 시간이 줄어듭니다.',
          recommendedActions: ['매주 1회 짧은 피드백 체크인을 고정합니다.', '칭찬과 개선 요청을 각각 한 문장으로 분리합니다.'],
        },
      ],
      blindSpots: [
        {
          title: '조용한 구성원의 신호',
          whyItMatters: '회의에서 말수가 적은 구성원의 막힘이 늦게 발견될 수 있습니다.',
          signals: ['질문이 줄어드는 경우', '마감 직전에 이슈가 드러나는 경우'],
          suggestedCheck: '다음 1:1에서 가장 막히는 업무 하나를 먼저 묻습니다.',
        },
      ],
      actionPlan30Days: ['팀 목표와 우선순위를 한 페이지로 정리해 공유합니다.', '주간 체크인 질문 2개를 고정합니다.'],
      actionPlan60Days: ['피드백 후 실제 행동 변화가 있었는지 다시 확인합니다.', '반복 이슈를 팀 운영 룰로 바꿉니다.'],
      actionPlan90Days: ['구성원별 성장 목표와 업무 배분을 다시 맞춥니다.', '다음 진단 전 변화 사례를 수집합니다.'],
      coachingQuestions: {
        selfReflection: ['내가 가장 자주 미루는 피드백은 무엇인가요?'],
        teamConversation: ['팀이 더 빨리 도움을 요청하려면 어떤 신호가 필요할까요?'],
        nextCheckIn: ['다음 30일 동안 관찰할 리더십 행동 하나는 무엇인가요?'],
      },
      managerHrGuide: {
        recognize: ['목표를 명확히 설명하는 행동을 구체적으로 인정합니다.'],
        ask: ['구성원이 체감하는 지원 부족 지점을 묻습니다.'],
        agree: ['다음 체크인 전까지 실행할 행동 1개를 합의합니다.'],
        followUp: ['30일 후 같은 질문으로 변화 여부를 확인합니다.'],
      },
      safetyNote: '시연 환경에서는 운영 데이터에 반영되지 않으며 공식 평가 점수나 등급을 산정하지 않습니다.',
    },
  }
}

export function LeadershipDiagnosisAiCoachingPanel(props: Props) {
  const searchParams = useSearchParams()
  const ceoDemoMode = isCeoDemoMode(searchParams)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<UpwardReviewAICoachingPreview | null>(null)
  const [copied, setCopied] = useState<'all' | 'plan' | ''>('')
  const [, setDemoCoachingState] = useCeoDemoLocalState('ceo-demo-leadership-ai-coaching', {
    status: '대기',
    updatedAt: '',
  })

  const disabledReason = useMemo(() => {
    if (ceoDemoMode) {
      return ''
    }
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
    ceoDemoMode,
  ])
  const canGenerate = !disabledReason

  async function handleGenerate() {
    if (!canGenerate || busy) return

    setBusy(true)
    setError('')
    setCopied('')

    try {
      if (ceoDemoMode) {
        setPreview(buildDemoLeadershipCoachingPreview(props))
        setDemoCoachingState({ status: '생성완료', updatedAt: new Date().toISOString() })
        return
      }

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
