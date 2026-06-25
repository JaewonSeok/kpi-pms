'use client'

import Link from 'next/link'
import { BarChart3, Hash, Target, TrendingUp } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import {
  FEEDBACK_360_RESPONSE_TAG_CATEGORIES,
  FEEDBACK_360_TAG_SUMMARY_HEADING,
  getSelectedFeedback360ResponseTagLabels,
  parseFeedback360TagSummaryFromComment,
  type Feedback360ResponseTagTone,
} from '../feedback360-response-tag-pool'
import { Feedback360Avatar } from './Feedback360Avatar'

type ResultsData = NonNullable<Feedback360PageData['results']>

type Feedback360ResultTagCount = {
  id: string
  label: string
  category: string
  tone: Feedback360ResponseTagTone
  count: number
}

type Feedback360ResultReviewCard = {
  key: string
  category: string
  questionText: string
  relationshipLabel: string
  authorLabel: string
  submittedAtLabel: string
  ratingValue?: number | null
  positiveTags: Feedback360ResultTagCount[]
  improvementTags: Feedback360ResultTagCount[]
  comment: string
  originalText: string
}

function getFeedback360RelationshipLabel(relationship?: string | null) {
  switch (relationship) {
    case 'SELF':
      return '본인'
    case 'SUPERVISOR':
      return '상사'
    case 'PEER':
      return '동료'
    case 'SUBORDINATE':
      return '팀원'
    case 'CROSS_TEAM_PEER':
      return '타팀 동료'
    case 'CROSS_DEPT':
      return '타부서'
    default:
      return '관계 확인 필요'
  }
}

export function buildFeedback360ResultVisualModel(results: ResultsData) {
  const tagMap = new Map<string, Feedback360ResultTagCount>()
  const categoryMap = new Map<string, { category: string; positive: number; improvement: number }>()
  const reviewCards: Feedback360ResultReviewCard[] = []

  const registerTag = (tag: Feedback360ResultTagCount) => {
    const key = `${tag.tone}:${tag.category}:${tag.label}`
    const current = tagMap.get(key)
    tagMap.set(key, current ? { ...current, count: current.count + 1 } : tag)

    const category = categoryMap.get(tag.category) ?? {
      category: tag.category,
      positive: 0,
      improvement: 0,
    }
    if (tag.tone === 'positive') category.positive += 1
    else category.improvement += 1
    categoryMap.set(tag.category, category)
  }

  for (const group of results.groupedResponses) {
    for (const answer of group.answers) {
      const originalText = answer.textValue?.trim() ?? ''
      const parsed = parseFeedback360TagSummaryFromComment(originalText)
      const tags = getSelectedFeedback360ResponseTagLabels(parsed.selectedTags)
      const positiveTags = tags
        .filter((tag) => tag.tone === 'positive')
        .map((tag) => ({ ...tag, count: 1 }))
      const improvementTags = tags
        .filter((tag) => tag.tone === 'improvement')
        .map((tag) => ({ ...tag, count: 1 }))

      for (const tag of [...positiveTags, ...improvementTags]) {
        registerTag(tag)
      }

      if (originalText || typeof answer.ratingValue === 'number') {
        reviewCards.push({
          key: `${group.questionId}:${answer.feedbackId}`,
          category: group.category,
          questionText: group.questionText,
          relationshipLabel: getFeedback360RelationshipLabel(answer.relationship),
          authorLabel: answer.authorLabel,
          submittedAtLabel: '제출일은 운영 데이터 기준',
          ratingValue: answer.ratingValue,
          positiveTags,
          improvementTags,
          comment: parsed.comment.trim(),
          originalText,
        })
      }
    }
  }

  const tagCounts = Array.from(tagMap.values()).sort((left, right) => right.count - left.count)
  const positiveTopTags = tagCounts.filter((tag) => tag.tone === 'positive').slice(0, 3)
  const improvementTopTags = tagCounts.filter((tag) => tag.tone === 'improvement').slice(0, 3)
  const categoryBars = FEEDBACK_360_RESPONSE_TAG_CATEGORIES
    .filter((category) => category.audience !== 'leader')
    .map((category) => categoryMap.get(category.category) ?? {
      category: category.category,
      positive: 0,
      improvement: 0,
    })
  const maxCategoryCount = Math.max(
    1,
    ...categoryBars.map((category) => category.positive + category.improvement)
  )

  return {
    tagCounts,
    positiveTopTags,
    improvementTopTags,
    categoryBars,
    maxCategoryCount,
    reviewCards,
    hasTagData: tagCounts.length > 0,
  }
}

function Feedback360TagBadge(props: { tag: Feedback360ResultTagCount; compact?: boolean }) {
  const toneClassName =
    props.tag.tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
  const label = props.tag.tone === 'positive' ? '강점' : '보완'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold ${toneClassName} ${
        props.compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      <span>{label}</span>
      <span>{props.tag.label}</span>
      {props.tag.count > 1 ? <span className="rounded-full bg-white/70 px-1.5">{props.tag.count}회</span> : null}
    </span>
  )
}

export function Feedback360RadarChart(props: { scores: ResultsData['categoryScores'] }) {
  const scores = props.scores.slice(0, 6)
  const hasScores = scores.length > 0
  const center = 86
  const radius = 68
  const points = scores.map((score, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(scores.length, 1)
    const normalized = Math.max(0, Math.min(1, score.average / 5))
    const x = center + Math.cos(angle) * radius * normalized
    const y = center + Math.sin(angle) * radius * normalized
    return `${x},${y}`
  })
  const guidePoints = scores.map((_, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(scores.length, 1)
    const x = center + Math.cos(angle) * radius
    const y = center + Math.sin(angle) * radius
    return `${x},${y}`
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">radar chart / 카테고리 밀도</div>
          <div className="mt-1 text-xs text-slate-500">실제 응답 집계가 있을 때만 표시합니다.</div>
        </div>
        <GuideBadge tone="slate">공식 점수 아님</GuideBadge>
      </div>
      {hasScores ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
          <svg viewBox="0 0 172 172" className="h-44 w-full">
            <polygon points={guidePoints.join(' ')} fill="white" stroke="#cbd5e1" strokeWidth="1" />
            <polygon points={points.join(' ')} fill="rgba(37, 99, 235, 0.18)" stroke="#2563eb" strokeWidth="2" />
            {scores.map((score, index) => {
              const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(scores.length, 1)
              const x = center + Math.cos(angle) * (radius + 10)
              const y = center + Math.sin(angle) * (radius + 10)
              return (
                <text key={score.category} x={x} y={y} textAnchor="middle" className="fill-slate-500 text-[9px]">
                  {score.category.slice(0, 6)}
                </text>
              )
            })}
          </svg>
          <div className="space-y-2">
            {scores.map((score) => (
              <SummaryRow
                key={score.category}
                label={score.category}
                value={`응답 ${score.count}건 · 평균 ${score.average}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <Feedback360ResultSkeleton label="radar chart 대기" />
      )}
    </div>
  )
}

function Feedback360ResultSkeleton(props: { label: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
      {props.label}: 응답 수와 익명 기준이 충족되면 태그 분포와 반복 패턴이 표시됩니다.
    </div>
  )
}

export function Feedback360PptResultReport(props: {
  results: ResultsData
  visualModel: ReturnType<typeof buildFeedback360ResultVisualModel>
  resultPresentationHighlights: string[]
  reportBusy: boolean
  resultsNotice: string
  resultsError: string
  onGenerateReportCache: () => void
  canGenerateReport: boolean
}) {
  const topStrengths = props.visualModel.positiveTopTags
  const topImprovements = props.visualModel.improvementTopTags

  return (
    <section id="feedback360-results-report" className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <Feedback360Avatar
                person={{
                  name: props.results.targetEmployee.name,
                  profileImageUrl: props.results.targetEmployee.profileImageUrl,
                }}
                size="xl"
              />
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  다면평가 리포트
                </div>
                <h2 className="mt-2 truncate text-2xl font-bold text-slate-950">{props.results.targetEmployee.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {props.results.targetEmployee.department} · {props.results.targetEmployee.position}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <GuideBadge tone={props.results.thresholdMet ? 'emerald' : 'slate'}>
                {props.results.thresholdMet ? '익명성 보장 충족' : '익명 기준 대기'}
              </GuideBadge>
              <GuideBadge tone="slate">공식 평가 점수나 등급을 자동 산정하지 않습니다.</GuideBadge>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Feedback360MetricPill label="평가 기간" value={props.results.roundName} compact />
            <Feedback360MetricPill label="전체 평가자 수" value={`${props.results.feedbackCount}명`} detail="권한 내 결과 데이터" compact />
            <Feedback360MetricPill label="참여자 수" value={`${props.results.feedbackCount}명`} detail="제출 응답 기준" compact />
            <Feedback360MetricPill label="익명성 보장 여부" value={props.results.thresholdMet ? '충족' : '대기'} compact tone={props.results.thresholdMet ? 'slate' : 'amber'} />
          </div>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
            <div className="font-semibold">종합 요약</div>
            <p className="mt-1">
              {props.results.thresholdMet
                ? props.results.anonymousSummary || '익명 기준을 충족한 실제 응답을 기준으로 요약합니다.'
                : '아직 결과를 표시할 수 없습니다. 응답 수와 익명 기준이 충족되면 태그 분포와 반복 패턴이 표시됩니다.'}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <TrendingUp className="h-4 w-4" />
              강점 Top 3
            </div>
            <div className="mt-3 space-y-2">
              {topStrengths.length ? (
                topStrengths.map((tag) => <Feedback360TagBadge key={`top-positive:${tag.label}`} tag={tag} />)
              ) : (
                <Feedback360ResultSkeleton label="강점 Top 3 대기" />
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Target className="h-4 w-4" />
              보완 Top 3
            </div>
            <div className="mt-3 space-y-2">
              {topImprovements.length ? (
                topImprovements.map((tag) => <Feedback360TagBadge key={`top-improvement:${tag.label}`} tag={tag} />)
              ) : (
                <Feedback360ResultSkeleton label="보완 Top 3 대기" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Feedback360RadarChart scores={props.results.categoryScores} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            카테고리별 bar chart
          </div>
          <p className="mt-1 text-sm text-slate-500">강점 count / 보완 count를 실제 태그 선택 빈도로 분리합니다.</p>
          <div className="mt-4 space-y-3">
            {props.visualModel.categoryBars.map((category) => (
              <div key={category.category} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-900">{category.category}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    강점 {category.positive} · 보완 {category.improvement}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <ProgressBar value={(category.positive / props.visualModel.maxCategoryCount) * 100} label={`강점 ${category.positive}`} />
                  <ProgressBar value={(category.improvement / props.visualModel.maxCategoryCount) * 100} label={`보완 ${category.improvement}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Hash className="h-4 w-4 text-blue-600" />
            태그 클러스터 / 키워드 영역
          </div>
          <p className="mt-1 text-sm text-slate-500">결과 탭 내부에서만 실제 빈도 기반 chip cluster로 표시합니다.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {props.visualModel.tagCounts.length ? (
              props.visualModel.tagCounts.map((tag) => (
                <span
                  key={`cluster:${tag.tone}:${tag.category}:${tag.label}`}
                  className={`inline-flex rounded-full border px-3 py-2 font-semibold ${
                    tag.tone === 'positive'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  } ${tag.count >= 3 ? 'text-sm' : 'text-xs'}`}
                >
                  {tag.label} · {tag.count}회
                </span>
              ))
            ) : (
              <Feedback360ResultSkeleton label="태그 분포 대기" />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-950">후속 액션</div>
          <div className="mt-3 space-y-2">
            {[
              ...props.results.developmentPlan.nextCheckinTopics.map((item) => `다음 성장 대화에서 확인할 점: ${item}`),
              ...props.results.developmentPlan.managerSupport.map((item) => `팀장/HR 참고 메모: ${item}`),
              ...props.results.developmentPlan.actions.map((item) => `보완 행동 제안: ${item}`),
            ].slice(0, 6).map((item, index) => (
              <div key={`follow-up:${index}:${item}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">리뷰 상세 내역</h2>
            <p className="mt-1 text-sm text-slate-500">
              긴 {FEEDBACK_360_TAG_SUMMARY_HEADING} 문장은 기본 노출하지 않고, 긍정/보완 chip과 원문 보기로 분리합니다.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {props.visualModel.reviewCards.length}건
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {props.visualModel.reviewCards.length ? (
            props.visualModel.reviewCards.slice(0, 8).map((card) => (
              <article key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <GuideBadge tone="blue">{card.relationshipLabel}</GuideBadge>
                  <GuideBadge tone="slate">{card.submittedAtLabel}</GuideBadge>
                  {typeof card.ratingValue === 'number' ? <GuideBadge tone="slate">참고 점수 {card.ratingValue}</GuideBadge> : null}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{card.category}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{card.questionText}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {card.positiveTags.length ? (
                      card.positiveTags.map((tag) => <Feedback360TagBadge key={`${card.key}:positive:${tag.label}`} tag={tag} compact />)
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">강점 태그 없음</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {card.improvementTags.length ? (
                      card.improvementTags.map((tag) => <Feedback360TagBadge key={`${card.key}:improvement:${tag.label}`} tag={tag} compact />)
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">보완 태그 없음</span>
                    )}
                  </div>
                </div>
                {card.comment ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                    {card.comment}
                  </div>
                ) : null}
                {card.originalText ? (
                  <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">원문 보기</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                      {card.originalText}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))
          ) : (
            <Feedback360ResultSkeleton label="리뷰 상세 내역 대기" />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 text-sm text-slate-600">
            <div>공개 항목: {props.resultPresentationHighlights.join(' · ')}</div>
            <div>결과 리포트는 화면에서 확인합니다. 별도 파일 내보내기는 제공하지 않습니다.</div>
          </div>
          <button
            type="button"
            onClick={props.onGenerateReportCache}
            disabled={props.reportBusy || !props.canGenerateReport}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {props.reportBusy ? '결과 리포트 준비 중...' : props.results.reportCache ? '결과 리포트 다시 준비' : '결과 리포트 준비'}
          </button>
        </div>
        {props.resultsNotice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="font-semibold">리포트 캐시가 준비되었습니다.</div>
            <div className="mt-1">{props.resultsNotice}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionLink href="#feedback360-results-report" label="리포트 보기" />
              <ActionLink href="/evaluation/360?tab=results" label="결과 탭으로 이동" />
              <ActionLink href="/evaluation/360?tab=operations" label="결과 공유 메일 준비" />
            </div>
          </div>
        ) : null}
        {props.resultsError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {props.resultsError}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ActionLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {props.label}
    </Link>
  )
}

function Feedback360MetricPill(props: {
  icon?: React.ReactNode
  label: string
  value: string
  detail?: string
  tone?: 'slate' | 'amber'
  compact?: boolean
}) {
  const toneClassName =
    props.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClassName}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <div className={`${props.compact ? 'mt-1 text-lg' : 'mt-2 text-xl'} font-bold text-slate-950`}>
        {props.value}
      </div>
      {props.detail ? <div className="mt-1 truncate text-xs text-slate-500">{props.detail}</div> : null}
    </div>
  )
}

function ProgressBar(props: { value: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(props.value)))

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>진행률</span>
        <span className="text-slate-800">{props.label}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-700 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{props.label}</span>
      <span className="font-semibold text-slate-950">{props.value}</span>
    </div>
  )
}

function GuideBadge(props: { children: React.ReactNode; tone: 'slate' | 'blue' | 'emerald' }) {
  const toneClassName =
    props.tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-100 text-slate-700'

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassName}`}>
      {props.children}
    </span>
  )
}
