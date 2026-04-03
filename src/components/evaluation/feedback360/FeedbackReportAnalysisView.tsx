'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FeedbackReportAnalysisSectionKey } from '@/lib/feedback-report-analysis'
import type { Feedback360PageData } from '@/server/feedback-360'

type ResultsData = NonNullable<Feedback360PageData['results']>
type AnalysisData = ResultsData['analysis']
type InsightItem = AnalysisData['questionInsights'][number]

type FeedbackReportAnalysisViewProps = {
  results: ResultsData
}

export function FeedbackReportAnalysisView(props: FeedbackReportAnalysisViewProps) {
  const [selectedInsight, setSelectedInsight] = useState<InsightItem | null>(null)
  const visibleMenu = useMemo(
    () => props.results.analysis.menu.filter((item) => item.visible),
    [props.results.analysis.menu]
  )
  const menuByKey = useMemo(
    () =>
      Object.fromEntries(
        props.results.analysis.menu.map((item) => [item.key, item] as const)
      ) as Record<FeedbackReportAnalysisSectionKey, AnalysisData['menu'][number]>,
    [props.results.analysis.menu]
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</div>
          <div className="mt-4 space-y-1">
            {visibleMenu.map((item) => (
              <a
                key={item.key}
                href={`#report-${item.key}`}
                className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        <div className="space-y-6 p-5 lg:p-7">
          {menuByKey.overview.visible ? (
            <ReportSection
              id="overview"
              title={menuByKey.overview.label}
              description={`${props.results.targetEmployee.name}님의 리포트를 조직 언어에 맞게 해석할 수 있도록 안내 문구를 함께 제공합니다.`}
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_320px]">
                <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-900">회사/조직이 전하는 메시지</div>
                  <p className="text-sm leading-7 text-slate-700">{props.results.analysis.overview.companyMessage}</p>
                </div>
                <div className="space-y-4">
                  <InfoCard
                    title="리포트 활용 취지"
                    body={props.results.analysis.overview.purposeMessage}
                  />
                  <InfoCard
                    title="읽기 가이드"
                    body={props.results.analysis.overview.acceptanceGuide}
                  />
                  <InfoCard
                    title="분석 강도"
                    body={props.results.analysis.strengthDescription}
                    emphasis={props.results.analysis.strength}
                  />
                </div>
              </div>
            </ReportSection>
          ) : null}

          {menuByKey.questionInsights.visible ? (
            <ReportSection
              id="questionInsights"
              title={menuByKey.questionInsights.label}
              description="조직 평균과 비교했을 때 차이가 두드러지는 질문을 먼저 보여줍니다."
            >
              {props.results.analysis.questionInsights.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {props.results.analysis.questionInsights.slice(0, 6).map((item) => (
                    <InsightCard
                      key={`insight-${item.questionId}`}
                      item={item}
                      onOpenDetail={() => setSelectedInsight(item)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyBlock message="질문별 인사이트를 만들 만큼의 평정 문항 데이터가 아직 충분하지 않습니다." />
              )}
            </ReportSection>
          ) : null}

          {menuByKey.relativeComparison.visible ? (
            <ReportSection
              id="relativeComparison"
              title={menuByKey.relativeComparison.label}
              description="질문별로 조직 평균과 얼마나 차이가 나는지 한눈에 확인할 수 있습니다."
            >
              {props.results.analysis.relativeComparisons.length ? (
                <div className="space-y-3">
                  {props.results.analysis.relativeComparisons.slice(0, 10).map((item) => (
                    <div key={`compare-${item.questionId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <CategoryChip>{item.category}</CategoryChip>
                            <StatusChip tone={item.tone}>{item.toneLabel}</StatusChip>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{item.questionText}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedInsight(item)}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          상세 보기
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <MetricTile label="내 평균 점수" value={formatScore(item.targetScore)} />
                        <MetricTile label="조직 평균" value={formatScore(item.benchmarkScore)} />
                        <MetricTile
                          label="차이"
                          value={
                            typeof item.deltaFromBenchmark === 'number'
                              ? `${item.deltaFromBenchmark > 0 ? '+' : ''}${item.deltaFromBenchmark.toFixed(1)}`
                              : '집계 대기'
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock message="상대 비교에 사용할 질문별 점수 데이터가 아직 없습니다." />
              )}
            </ReportSection>
          ) : null}

          {menuByKey.selfAwareness.visible ? (
            <ReportSection
              id="selfAwareness"
              title={menuByKey.selfAwareness.label}
              description="셀프 평가가 있는 경우, 타인 평균과의 간격을 비교해 자기객관화 수준을 보여줍니다."
            >
              {props.results.analysis.selfAwareness.length ? (
                <div className="space-y-3">
                  {props.results.analysis.selfAwareness.slice(0, 8).map((item) => (
                    <div key={`self-${item.questionId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <CategoryChip>{item.category}</CategoryChip>
                            <StatusChip tone={item.tone}>{item.toneLabel}</StatusChip>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{item.questionText}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedInsight(item)}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          상세 보기
                        </button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <MetricTile label="셀프 점수" value={formatScore(item.selfScore)} />
                        <MetricTile label="타인 평균" value={formatScore(item.othersScore)} />
                        <MetricTile
                          label={props.results.analysis.wording.selfAwarenessLabel}
                          value={
                            typeof item.deltaFromOthers === 'number'
                              ? `${item.deltaFromOthers > 0 ? '+' : ''}${item.deltaFromOthers.toFixed(1)}`
                              : '집계 대기'
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock message="셀프 리뷰가 없거나 비교 가능한 점수 문항이 없어 자기객관화 분석을 보여줄 수 없습니다." />
              )}
            </ReportSection>
          ) : null}

          {menuByKey.reviewDetails.visible ? (
            <ReportSection
              id="reviewDetails"
              title={menuByKey.reviewDetails.label}
              description="리뷰어 관계별 코멘트와 총점을 원문 맥락과 함께 확인할 수 있습니다."
            >
              {props.results.analysis.reviewDetails.length ? (
                <div className="space-y-3">
                  {props.results.analysis.reviewDetails.map((item) => (
                    <div key={item.feedbackId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <CategoryChip>{item.relationshipLabel}</CategoryChip>
                            <span className="text-sm font-semibold text-slate-900">{item.reviewerName}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.submittedAt ? `${item.submittedAt} 제출` : '제출 시각 정보 없음'} · 응답 {item.responseCount}개
                          </div>
                        </div>
                        <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                          종합 점수 {formatScore(item.totalScore)}
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                        {item.overallComment?.trim() || '등록된 종합 코멘트가 없습니다.'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock message="리뷰 상세 내역을 표시할 수 있는 제출 리뷰가 없습니다." />
              )}
            </ReportSection>
          ) : null}

          {menuByKey.questionScores.visible ? (
            <ReportSection
              id="questionScores"
              title={menuByKey.questionScores.label}
              description="질문별로 내 점수, 조직 평균, reviewer type별 점수를 비교합니다."
            >
              {props.results.analysis.questionScoreCards.length ? (
                <div className="space-y-4">
                  {props.results.analysis.questionScoreCards.slice(0, 8).map((card) => (
                    <div key={`score-${card.questionId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <CategoryChip>{card.category}</CategoryChip>
                            <span className="text-sm font-semibold text-slate-900">{card.questionText}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>내 평균 점수 {formatScore(card.targetScore)}</span>
                            <span>조직 평균 {formatScore(card.benchmarkScore)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 h-72 rounded-2xl bg-white p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={card.series}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis
                              domain={[0, 100]}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip
                              formatter={(value) =>
                                Array.isArray(value)
                                  ? value.join(', ')
                                  : value == null
                                    ? '-'
                                    : `${value}점`
                              }
                            />
                            <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock message="질문별 점수 시각화에 필요한 평정 문항 데이터가 없습니다." />
              )}
            </ReportSection>
          ) : null}

          {menuByKey.objectiveAnswers.visible ? (
            <ReportSection
              id="objectiveAnswers"
              title={menuByKey.objectiveAnswers.label}
              description="선택형/복수선택형 질문 응답을 전체 참여 비율과 reviewer type별 분포로 보여줍니다."
            >
              {props.results.analysis.objectiveAnswers.length ? (
                <div className="space-y-4">
                  {props.results.analysis.objectiveAnswers.map((item) => (
                    <div key={`choice-${item.questionId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryChip>{item.category}</CategoryChip>
                        <StatusChip tone="BALANCED">
                          {item.selectionMode === 'MULTIPLE' ? '복수 선택' : '1개 선택'}
                        </StatusChip>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{item.questionText}</div>
                      <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                      <div className="mt-4 space-y-3">
                        {item.options.map((option) => (
                          <div key={`${item.questionId}-${option.label}`} className="rounded-xl bg-white p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                              <div className="text-sm text-slate-600">
                                {option.count}명 ({option.ratio}%)
                              </div>
                            </div>
                            <div className="mt-3 flex h-2 rounded-full bg-slate-100">
                              <div className="rounded-full bg-blue-500" style={{ width: `${Math.max(option.ratio, 4)}%` }} />
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {option.reviewerBreakdown.map((breakdown) => (
                                <div
                                  key={`${item.questionId}-${option.label}-${breakdown.relationship}`}
                                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                                >
                                  {breakdown.label} · {breakdown.count}/{breakdown.total} ({breakdown.ratio}%)
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock message="객관식/복수선택형 문항 응답이 없어 별도 분석을 표시하지 않습니다." />
              )}
            </ReportSection>
          ) : null}

          {menuByKey.resultLink.visible ? (
            <ReportSection
              id="resultLink"
              title={menuByKey.resultLink.label}
              description="현재 보고 있는 결과지 버전과 원본 결과 화면, PDF를 같은 흐름에서 이어서 확인할 수 있습니다."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <InfoCard
                  title="현재 결과지 버전"
                  body={`${props.results.analysis.resultLink.profileLabel} · ${props.results.targetEmployee.name}`}
                />
                <InfoCard title="PDF 다운로드" body="현재 결과지 구성을 그대로 PDF로 열거나 내려받을 수 있습니다." />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {props.results.analysis.resultLink.links.map((item) =>
                  item.href.startsWith('/') ? (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                    >
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                    </Link>
                  ) : (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                    >
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                    </a>
                  )
                )}
                <a
                  href={props.results.analysis.resultLink.pdfHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                >
                  <div className="text-sm font-semibold text-slate-900">PDF로 열기</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">브라우저에서 현재 결과지를 바로 열어 확인합니다.</div>
                </a>
              </div>
            </ReportSection>
          ) : null}
        </div>
      </div>

      {selectedInsight ? (
        <InsightDetailModal item={selectedInsight} onClose={() => setSelectedInsight(null)} />
      ) : null}
    </section>
  )
}

function ReportSection(props: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={`report-${props.id}`} className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">{props.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
      {props.children}
    </section>
  )
}

function InfoCard(props: { title: string; body: string; emphasis?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      {props.emphasis ? (
        <div className="mt-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {props.emphasis}
        </div>
      ) : null}
      <p className="mt-3 text-sm leading-7 text-slate-600">{props.body}</p>
    </div>
  )
}

function InsightCard(props: { item: InsightItem; onOpenDetail: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip>{props.item.category}</CategoryChip>
        <StatusChip tone={props.item.tone}>{props.item.toneLabel}</StatusChip>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900">{props.item.questionText}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{props.item.interpretation}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricTile label="내 평균 점수" value={formatScore(props.item.targetScore)} />
        <MetricTile label="조직 평균" value={formatScore(props.item.benchmarkScore)} />
        <MetricTile
          label="차이"
          value={
            typeof props.item.deltaFromBenchmark === 'number'
              ? `${props.item.deltaFromBenchmark > 0 ? '+' : ''}${props.item.deltaFromBenchmark.toFixed(1)}`
              : '집계 대기'
          }
        />
      </div>
      <button
        type="button"
        onClick={props.onOpenDetail}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
      >
        상세 보기
      </button>
    </div>
  )
}

function InsightDetailModal(props: { item: InsightItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip>{props.item.category}</CategoryChip>
              <StatusChip tone={props.item.tone}>{props.item.toneLabel}</StatusChip>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{props.item.questionText}</h3>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricTile label="내 평균 점수" value={formatScore(props.item.targetScore)} />
          <MetricTile label="조직 평균" value={formatScore(props.item.benchmarkScore)} />
          <MetricTile label="셀프 점수" value={formatScore(props.item.selfScore)} />
          <MetricTile label="타인 평균" value={formatScore(props.item.othersScore)} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-900">해석</div>
            <p className="mt-3 text-sm leading-7 text-slate-700">{props.item.interpretation}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <MetricTile
                label="내 점수 차이"
                value={
                  typeof props.item.deltaFromBenchmark === 'number'
                    ? `${props.item.deltaFromBenchmark > 0 ? '+' : ''}${props.item.deltaFromBenchmark.toFixed(1)}`
                    : '집계 대기'
                }
              />
              <MetricTile
                label="타인 평균 차이"
                value={
                  typeof props.item.deltaFromOthers === 'number'
                    ? `${props.item.deltaFromOthers > 0 ? '+' : ''}${props.item.deltaFromOthers.toFixed(1)}`
                    : '집계 대기'
                }
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">reviewer type별 점수</div>
            <div className="mt-4 space-y-2">
              {props.item.reviewerAverages.length ? (
                props.item.reviewerAverages.map((reviewer) => (
                  <div
                    key={`${props.item.questionId}-${reviewer.relationship}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    {reviewer.label} · {formatScore(reviewer.average)} · 응답 {reviewer.count}개
                  </div>
                ))
              ) : (
                <EmptyBlock message="reviewer type별 세부 점수가 아직 없습니다." />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryChip(props: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {props.children}
    </span>
  )
}

function StatusChip(props: { tone: InsightItem['tone']; children: React.ReactNode }) {
  const toneClass =
    props.tone === 'STRENGTH'
      ? 'bg-emerald-100 text-emerald-700'
      : props.tone === 'IMPROVEMENT'
        ? 'bg-rose-100 text-rose-700'
        : 'bg-blue-100 text-blue-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{props.children}</span>
}

function MetricTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function EmptyBlock(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {props.message}
    </div>
  )
}

function formatScore(value: number | null) {
  return typeof value === 'number' ? `${value.toFixed(1)}점` : '집계 대기'
}
