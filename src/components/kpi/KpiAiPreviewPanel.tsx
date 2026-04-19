'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileJson, Sparkles } from 'lucide-react'
import {
  buildKpiAiPreviewDescriptor,
  type KpiAiPreviewComparison,
  type KpiAiPreviewRecommendation,
  type KpiAiPreviewSection,
  type KpiAiPreviewSource,
} from '@/lib/kpi-ai-preview'

type PreviewPayload = {
  action: string
  actionLabel: string
  source: KpiAiPreviewSource
  fallbackReason?: string | null
  result: Record<string, unknown>
}

type Props = {
  preview: PreviewPayload | null
  comparisons?: KpiAiPreviewComparison[]
  emptyTitle: string
  emptyDescription: string
  onApprove?: () => void
  onReject?: () => void
  approveLabel?: string
  rejectLabel?: string
  onRetry?: () => void
  retryLabel?: string
  decisionBusy?: boolean
  onSelectRecommendation?: (item: KpiAiPreviewRecommendation, index: number) => void
  selectedRecommendationIndex?: number | null
  recommendationActionLabel?: string
  isRecommendationDraftOpen?: boolean
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

const TONE_CLASS: Record<'recommended' | 'warning' | 'review', string> = {
  recommended: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  review: 'border-rose-200 bg-rose-50 text-rose-700',
}

const CRITERION_CLASS: Record<string, string> = {
  PASS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  GOOD: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  WARN: 'border-amber-200 bg-amber-50 text-amber-700',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
  FAIL: 'border-rose-200 bg-rose-50 text-rose-700',
  CRITICAL: 'border-rose-200 bg-rose-50 text-rose-700',
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  HIGH: 'border-rose-200 bg-rose-50 text-rose-700',
  ADEQUATE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CAUTION: 'border-amber-200 bg-amber-50 text-amber-700',
  INSUFFICIENT: 'border-rose-200 bg-rose-50 text-rose-700',
}

function ExpandableText({
  value,
  className = '',
  previewLength = 220,
}: {
  value: string
  className?: string
  previewLength?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const trimmed = value.trim()
  const needsCollapse = trimmed.length > previewLength
  const text = !needsCollapse || expanded ? trimmed : `${trimmed.slice(0, previewLength).trimEnd()}...`

  return (
    <div className={cls('space-y-2', className)}>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{text}</p>
      {needsCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? '접기' : '더보기'}
        </button>
      ) : null}
    </div>
  )
}

function SectionCard({
  title,
  helper,
  children,
}: {
  title: string
  helper?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function FallbackStatePanel({
  preview,
  onRetry,
  retryLabel,
}: {
  preview: PreviewPayload
  onRetry?: () => void
  retryLabel?: string
}) {
  const isDisabled = preview.source === 'disabled'
  const title = isDisabled
    ? 'AI 기능이 현재 준비되지 않았습니다.'
    : 'AI 추천/검토 결과를 불러오는 중 문제가 발생했습니다.'
  const description = isDisabled
    ? '현재는 AI 기능을 사용할 수 없어 기본 KPI 화면에서 계속 작업하실 수 있습니다.'
    : '잠시 후 다시 시도해 주세요. 문제가 반복되면 기본 KPI 화면에서 계속 작업하실 수 있습니다.'
  const toneClass = isDisabled
    ? 'border-slate-200 bg-slate-50 text-slate-700'
    : 'border-amber-200 bg-amber-50 text-amber-900'
  const detailToneClass = isDisabled ? 'text-slate-600' : 'text-amber-800'

  return (
    <section className={cls('rounded-3xl border p-5 shadow-sm', toneClass)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-semibold">
              {preview.actionLabel}
            </span>
            <span className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-xs font-medium">
              {isDisabled ? '기본 화면 안내' : '결과 재시도 필요'}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6">{description}</p>
          </div>
          {preview.fallbackReason ? (
            <p className={cls('text-sm leading-6', detailToneClass)}>{preview.fallbackReason}</p>
          ) : null}
        </div>
        {!isDisabled && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {retryLabel ?? '다시 시도'}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function ComparisonSection({ items }: { items: KpiAiPreviewComparison[] }) {
  if (!items.length) return null

  return (
    <SectionCard title="변경 전 / AI 제안값" helper="무엇이 달라지는지 먼저 비교한 뒤 적용 여부를 결정할 수 있습니다.">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={`${item.label}-${item.after}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">기존 값</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.before?.trim() || '-'}</div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">AI 제안값</div>
                <div className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-900">{item.after?.trim() || '-'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function renderSection(
  section: KpiAiPreviewSection,
  recommendationUi?: {
    onSelectRecommendation?: (item: KpiAiPreviewRecommendation, index: number) => void
    selectedRecommendationIndex?: number | null
    recommendationActionLabel?: string
    isRecommendationDraftOpen?: boolean
  },
) {
  switch (section.kind) {
    case 'text':
      return (
        <SectionCard key={section.key} title={section.title}>
          <ExpandableText value={section.body} />
        </SectionCard>
      )
    case 'list':
      return (
        <SectionCard key={section.key} title={section.title}>
          <ul className="space-y-2">
            {section.items.map((item, index) => (
              <li key={`${section.key}-${index}`} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  {index + 1}
                </span>
                <ExpandableText value={item} previewLength={180} className="flex-1" />
              </li>
            ))}
          </ul>
        </SectionCard>
      )
    case 'metrics':
      return (
        <SectionCard key={section.key} title={section.title}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map((item) => (
              <div key={`${section.key}-${item.label}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )
    case 'criteria':
      return (
        <SectionCard key={section.key} title={section.title}>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={`${section.key}-${item.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                  <span
                    className={cls(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold',
                      CRITERION_CLASS[item.status] ?? 'border-slate-200 bg-white text-slate-700',
                    )}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">판정 근거</div>
                    <ExpandableText value={item.reason} previewLength={180} className="mt-2" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">수정 권고안</div>
                    <ExpandableText value={item.suggestion} previewLength={180} className="mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )
    case 'duplicates':
      return (
        <SectionCard key={section.key} title={section.title}>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={`${section.key}-${item.title}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <span
                    className={cls(
                      'rounded-full border px-2.5 py-1 text-xs font-semibold',
                      CRITERION_CLASS[item.overlapLevel] ?? 'border-slate-200 bg-white text-slate-700',
                    )}
                  >
                    {item.overlapLevel}
                  </span>
                </div>
                <ExpandableText value={item.similarityReason} previewLength={180} className="mt-3" />
              </div>
            ))}
          </div>
        </SectionCard>
      )
    case 'weights':
      return (
        <SectionCard key={section.key} title={section.title}>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={`${section.key}-${item.title}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
                      현재 {item.currentWeight}%
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-200">
                      권장 {item.recommendedWeight}%
                    </span>
                  </div>
                </div>
                <ExpandableText value={item.reason} previewLength={180} className="mt-3" />
              </div>
            ))}
          </div>
        </SectionCard>
      )
    case 'recommendations':
      return (
        <SectionCard key={section.key} title={section.title} helper="상위 본부 KPI와 직접 연결되는 팀 KPI 추천안을 우선순위 순서대로 검토할 수 있습니다.">
          <div className="space-y-3">
            {section.items.map((item, index) => (
              <div key={`${section.key}-${item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                        추천 {item.recommendedPriority ?? String(index + 1)}
                      </span>
                      {item.difficultyLevel ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          난이도 {item.difficultyLevel}
                        </span>
                      ) : null}
                      {recommendationUi?.selectedRecommendationIndex === index ? (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                          선택됨
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-base font-semibold text-slate-900">{item.title}</div>
                    <ExpandableText value={item.definition} previewLength={220} className="mt-2" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs text-slate-500">T / E / S</div>
                    <div className="mt-1 font-semibold text-slate-900">{item.targetText}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">연결된 본부 KPI</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{item.linkedParentKpiTitle}</div>
                    <ExpandableText value={item.linkageReason} previewLength={180} className="mt-2" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">측정 방식 / 데이터</div>
                    <div className="mt-2 text-sm font-medium text-slate-900">{item.formula}</div>
                    <ExpandableText value={item.metricSource} previewLength={180} className="mt-2" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">왜 좋은 KPI인가</div>
                    <ExpandableText value={item.whyThisIsHighQuality} previewLength={180} className="mt-2" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">통제 가능성 / 리스크</div>
                    <ExpandableText value={`${item.controllabilityNote}\n\n${item.riskNote}`} previewLength={200} className="mt-2" />
                  </div>
                </div>

                {(item.alignmentScore || item.qualityScore) ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {item.alignmentScore ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs text-slate-500">상위 KPI 정렬도</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{item.alignmentScore}</div>
                      </div>
                    ) : null}
                    {item.qualityScore ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs text-slate-500">추천 품질 점수</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{item.qualityScore}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {recommendationUi?.onSelectRecommendation ? (
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                    {(() => {
                      const isCurrentRecommendation = recommendationUi.selectedRecommendationIndex === index
                      const buttonLabel = isCurrentRecommendation
                        ? recommendationUi.isRecommendationDraftOpen
                          ? '현재 초안에 반영됨'
                          : '이 추천안으로 다시 채우기'
                        : recommendationUi.selectedRecommendationIndex !== null
                          ? '이 추천안으로 다시 채우기'
                          : recommendationUi.recommendationActionLabel ?? '이 추천안으로 작성'

                      return (
                    <button
                      type="button"
                      onClick={() => recommendationUi.onSelectRecommendation?.(item, index)}
                      disabled={Boolean(isCurrentRecommendation && recommendationUi.isRecommendationDraftOpen)}
                      className={cls(
                        'inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70',
                        isCurrentRecommendation
                          ? 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800',
                      )}
                    >
                      {buttonLabel}
                    </button>
                      )
                    })()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      )
  }
}

export function KpiAiPreviewPanel(props: Props) {
  const [showRawJson, setShowRawJson] = useState(false)

  const descriptor = useMemo(() => {
    if (!props.preview || props.preview.source !== 'ai') return null
    return buildKpiAiPreviewDescriptor({
      action: props.preview.action,
      result: props.preview.result,
      source: props.preview.source,
      comparisons: props.comparisons,
    })
  }, [props.comparisons, props.preview])

  if (!props.preview || !descriptor) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-slate-900">{props.emptyTitle}</p>
        <p className="mt-2 text-sm text-slate-500">{props.emptyDescription}</p>
      </div>
    )
  }

  if (props.preview.source !== 'ai') {
    return (
      <FallbackStatePanel
        preview={props.preview}
        onRetry={props.onRetry}
        retryLabel={props.retryLabel}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f8fafc_100%)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                제안 유형 · {props.preview.actionLabel}
              </span>
              <span className={cls('rounded-full border px-3 py-1 text-xs font-semibold', TONE_CLASS[descriptor.tone])}>
                {descriptor.statusLabel}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                {props.preview.source === 'ai' ? 'AI 응답' : 'Fallback 결과'}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">변경 요약</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{descriptor.summary}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <div className="font-semibold">권장 액션</div>
              <p className="mt-1">{descriptor.recommendation}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[320px] lg:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">미리보기 상태</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                {descriptor.tone === 'recommended' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : descriptor.tone === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                )}
                {descriptor.statusLabel}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">적용 방식</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">미리보기 확인 후 수동 적용</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">검토 포인트</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">변경값과 근거를 함께 확인</div>
            </div>
          </div>
        </div>
      </div>

      {props.preview.fallbackReason ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Fallback 안내
          </div>
          <p className="mt-1">{props.preview.fallbackReason}</p>
        </div>
      ) : null}

      <ComparisonSection items={descriptor.comparisons} />

      <div className="space-y-3">
        {descriptor.sections.map((section) =>
          renderSection(section, {
            onSelectRecommendation: props.onSelectRecommendation,
            selectedRecommendationIndex: props.selectedRecommendationIndex ?? null,
            recommendationActionLabel: props.recommendationActionLabel,
            isRecommendationDraftOpen: props.isRecommendationDraftOpen,
          }),
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowRawJson((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileJson className="h-4 w-4 text-slate-500" />
            원본 JSON 보기
          </div>
          {showRawJson ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>
        {showRawJson ? (
          <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
            {JSON.stringify(props.preview.result, null, 2)}
          </pre>
        ) : null}
      </section>

      {props.onApprove || props.onReject ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-slate-500" />
                적용 전 마지막 확인
              </div>
              <p className="text-sm text-slate-500">현재 미리보기 내용을 검토한 뒤 적용하거나 반려할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {props.onReject ? (
                <button
                  type="button"
                  onClick={props.onReject}
                  disabled={props.decisionBusy}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {props.rejectLabel ?? '반려'}
                </button>
              ) : null}
              {props.onApprove ? (
                <button
                  type="button"
                  onClick={props.onApprove}
                  disabled={props.decisionBusy}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {props.approveLabel ?? '적용'}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
