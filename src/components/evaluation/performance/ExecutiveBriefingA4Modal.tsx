'use client'

import { useEffect } from 'react'
import { FileText, X } from 'lucide-react'
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EvaluationPerformanceBriefingSnapshot } from '@/lib/evaluation-performance-briefing'
import {
  getEvaluationPerformanceBriefingAlignmentLabel,
  getEvaluationPerformanceBriefingAlignmentTone,
  getEvaluationPerformanceBriefingEvidenceLevelLabel,
} from '@/lib/evaluation-performance-briefing'

// --- Types ---

export type A4ModalItem = {
  personalKpiId: string
  title: string
  weight: number
  recentAchievementRate?: number | null
  policyCategory?: string | null
}

export type A4ModalSelected = {
  target: { name: string; department?: string | null; position?: string | null }
  totalScore?: number | null
  gradeId?: string | null
  organizationPerformanceScore?: number | null
  personalPerformanceScore?: number | null
  gradeOptions: Array<{ id: string; gradeName: string; scoreRange: string }>
  items: A4ModalItem[]
}

type Props = {
  selected: A4ModalSelected
  snapshot: EvaluationPerformanceBriefingSnapshot
  onClose: () => void
}

// --- Helpers ---

const ALIGNMENT_TONE_CLASSES: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  neutral: 'bg-slate-100 text-slate-700',
  warn: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
}

const COVERAGE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#94a3b8']

function getKpiBarColor(rate: number | null): string {
  if (rate == null) return '#cbd5e1'
  if (rate >= 100) return '#16a34a'
  if (rate >= 80) return '#f59e0b'
  return '#ef4444'
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

// --- Sub-components ---

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{children}</h2>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
      {children}
    </div>
  )
}

function ScoreCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-2 py-2.5 text-center">
      <span className="text-[9px] font-medium text-slate-500">{label}</span>
      <span className="mt-0.5 text-base font-bold leading-tight text-slate-900">{value}</span>
      {sub && <span className="mt-0.5 text-[9px] text-slate-400">{sub}</span>}
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.min(100, value)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">
          {value == null ? '—' : `${value.toFixed(1)}점`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        {value != null && (
          <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

// --- Main ---

export function ExecutiveBriefingA4Modal({ selected, snapshot, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const gradeName = selected.gradeOptions.find((g) => g.id === selected.gradeId)?.gradeName ?? '—'

  const kpiData = selected.items.map((item) => ({
    name: truncate(item.title, 15),
    rate: item.recentAchievementRate ?? 0,
    isNull: item.recentAchievementRate == null,
    rawRate: item.recentAchievementRate,
  }))

  const coverageSlices = [
    { name: 'KPI', value: snapshot.evidenceCoverage.kpiCount, color: COVERAGE_COLORS[0] },
    { name: '월간실적', value: snapshot.evidenceCoverage.monthlyRecordCount, color: COVERAGE_COLORS[1] },
    { name: '체크인', value: snapshot.evidenceCoverage.checkinCount, color: COVERAGE_COLORS[2] },
    { name: '다면피드백', value: snapshot.evidenceCoverage.feedbackRoundCount, color: COVERAGE_COLORS[3] },
    { name: '이전평가', value: snapshot.evidenceCoverage.evaluationHistoryCount, color: COVERAGE_COLORS[4] },
  ].filter((d) => d.value > 0)
  const coverageTotal = coverageSlices.reduce((sum, d) => sum + d.value, 0)

  const alignmentTone = getEvaluationPerformanceBriefingAlignmentTone(snapshot.alignment.status)
  const alignmentLabel = getEvaluationPerformanceBriefingAlignmentLabel(snapshot.alignment.status)
  const evidenceLevelLabel = getEvaluationPerformanceBriefingEvidenceLevelLabel(snapshot.evidenceCoverage.evidenceLevel)

  const generatedAt = new Date(snapshot.generatedAt).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const kpiChartHeight = Math.max(100, kpiData.length * 28 + 24)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-4 w-full max-w-[794px] rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400">AI 브리핑 리포트 · {generatedAt}</p>
              <h1 className="text-xl font-bold text-slate-900">{selected.target.name}</h1>
              <p className="text-sm text-slate-500">
                {selected.target.department ?? '—'} · {selected.target.position ?? '—'}
              </p>
            </div>
          </div>

          {/* Section 1: 종합 스코어카드 */}
          <div className="mb-6">
            <SectionTitle>종합 성과 스코어</SectionTitle>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <ScoreCard
                label="종합점수"
                value={selected.totalScore == null ? '미제출' : `${selected.totalScore.toFixed(1)}점`}
              />
              <ScoreCard
                label="등급"
                value={selected.gradeId ? gradeName : '—'}
              />
              <ScoreCard
                label="조직 (30%)"
                value={
                  selected.organizationPerformanceScore == null
                    ? '미산정'
                    : `${selected.organizationPerformanceScore.toFixed(1)}점`
                }
                sub={selected.organizationPerformanceScore == null ? '30:70 미연결' : undefined}
              />
              <ScoreCard
                label="개인 (70%)"
                value={
                  selected.personalPerformanceScore == null
                    ? '미산정'
                    : `${selected.personalPerformanceScore.toFixed(1)}점`
                }
                sub={selected.personalPerformanceScore == null ? '30:70 미연결' : undefined}
              />
            </div>
          </div>

          {/* Section 2+3: KPI 달성률 | 팀장 vs 근거 */}
          <div className="mb-6 grid grid-cols-2 gap-6">
            {/* KPI 달성률 */}
            <div>
              <SectionTitle>KPI 달성률</SectionTitle>
              <div className="mt-2">
                {kpiData.length === 0 ? (
                  <Empty>등록된 KPI 없음</Empty>
                ) : (
                  <ResponsiveContainer width="100%" height={kpiChartHeight}>
                    <BarChart
                      data={kpiData}
                      layout="vertical"
                      margin={{ left: 0, right: 52, top: 4, bottom: 4 }}
                    >
                      <XAxis type="number" domain={[0, 120]} hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={88}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Bar dataKey="rate" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false}>
                        {kpiData.map((entry, i) => (
                          <Cell key={`kpi-cell-${i}`} fill={getKpiBarColor(entry.isNull ? null : (entry.rawRate ?? null))} />
                        ))}
                        <LabelList
                          dataKey="rate"
                          position="right"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          content={(props: any) => {
                            const idx = props.index as number
                            const item = kpiData[idx]
                            if (!item) return null
                            const x = Number(props.x ?? 0)
                            const y = Number(props.y ?? 0)
                            const width = Number(props.width ?? 0)
                            const height = Number(props.height ?? 0)
                            return (
                              <text
                                key={`kpi-label-${idx}`}
                                x={x + width + 4}
                                y={y + height / 2 + 4}
                                fontSize={10}
                                fill={item.isNull ? '#94a3b8' : '#475569'}
                                textAnchor="start"
                              >
                                {item.isNull ? '미입력' : `${item.rawRate!.toFixed(1)}%`}
                              </text>
                            )
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-400">
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-green-600 align-middle" />
                  ≥100%
                </span>
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-amber-400 align-middle" />
                  ≥80%
                </span>
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-red-400 align-middle" />
                  {'<'}80%
                </span>
                <span>
                  <span className="mr-0.5 inline-block h-2 w-2 rounded-sm bg-slate-300 align-middle" />
                  미입력
                </span>
              </div>
            </div>

            {/* 팀장 vs 근거 + 정합성 */}
            <div>
              <SectionTitle>팀장점수 vs 근거점수</SectionTitle>
              <div className="mt-2 space-y-3">
                <ScoreBar label="팀장 평가점수" value={snapshot.managerScore ?? null} />
                <ScoreBar label="근거 기반 점수" value={snapshot.evidenceScore ?? null} />
              </div>
              <div className="mt-5">
                <SectionTitle>정합성</SectionTitle>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ALIGNMENT_TONE_CLASSES[alignmentTone] ?? ALIGNMENT_TONE_CLASSES.neutral}`}
                  >
                    {alignmentLabel}
                  </span>
                </div>
                {snapshot.alignment.reason && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{snapshot.alignment.reason}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4+5: 근거 충실도 | 강점/보완/질문 */}
          <div className="mb-6 grid grid-cols-2 gap-6">
            {/* 근거 충실도 도넛 */}
            <div>
              <SectionTitle>근거 충실도</SectionTitle>
              <div className="mt-2">
                {coverageSlices.length === 0 ? (
                  <Empty>등록된 근거 없음</Empty>
                ) : (
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie
                        data={coverageSlices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={56}
                        paddingAngle={2}
                        isAnimationActive={false}
                      >
                        {coverageSlices.map((entry, i) => (
                          <Cell key={`cov-cell-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-500">
                  {coverageSlices.map((d, i) => (
                    <span key={i}>
                      <span
                        className="mr-0.5 inline-block h-2 w-2 rounded-sm align-middle"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name} {d.value}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      snapshot.evidenceCoverage.evidenceLevel === 'STRONG'
                        ? 'bg-green-100 text-green-700'
                        : snapshot.evidenceCoverage.evidenceLevel === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {evidenceLevelLabel}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    근거 {coverageTotal}건
                  </span>
                </div>
              </div>
            </div>

            {/* 강점 / 보완 / 확인질문 */}
            <div className="space-y-4">
              {snapshot.strengths.length > 0 && (
                <div>
                  <SectionTitle>강점</SectionTitle>
                  <ul className="mt-1.5 space-y-1">
                    {snapshot.strengths.slice(0, 2).map((s, i) => (
                      <li key={i} className="text-xs leading-relaxed text-slate-700">
                        · {s.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {snapshot.risks.length > 0 && (
                <div>
                  <SectionTitle>보완점</SectionTitle>
                  <ul className="mt-1.5 space-y-1">
                    {snapshot.risks.slice(0, 2).map((r, i) => (
                      <li key={i} className="text-xs leading-relaxed text-slate-700">
                        · {r.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {snapshot.questions.length > 0 && (
                <div>
                  <SectionTitle>확인 질문</SectionTitle>
                  <ol className="mt-1.5 list-inside list-decimal space-y-1">
                    {snapshot.questions.slice(0, 3).map((q, i) => (
                      <li key={i} className="text-xs leading-relaxed text-slate-700">
                        {q}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Headline 요약 */}
          {snapshot.headline && (
            <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">AI 종합 요약</p>
              <p className="mt-1 text-sm leading-relaxed text-indigo-900">{snapshot.headline}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] leading-4 text-slate-400">
            {snapshot.disclaimer}
          </div>
        </div>
      </div>
    </div>
  )
}
