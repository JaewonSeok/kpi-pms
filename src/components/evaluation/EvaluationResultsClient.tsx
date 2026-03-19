'use client'

import Link from 'next/link'
import { type ReactNode, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileSearch,
  Flag,
  Layers3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { EvaluationResultPageData, EvaluationResultViewModel } from '@/server/evaluation-results'

type EvaluationResultsClientProps = EvaluationResultPageData
type ResultTab = 'summary' | 'details' | 'evidence' | 'history' | 'growth'

const TAB_LABELS: Record<ResultTab, string> = {
  summary: '요약',
  details: '세부 점수',
  evidence: '근거 자료',
  history: '이력/캘리브레이션',
  growth: '성장 제안',
}

export function EvaluationResultsClient(props: EvaluationResultsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ResultTab>('summary')
  const [acknowledged, setAcknowledged] = useState(false)
  const [localNotice, setLocalNotice] = useState('')
  const [selectedDetailId, setSelectedDetailId] = useState<string>('')

  const viewModel = props.viewModel
  const scopeOptions = props.availableCycles
  const selectedCycle = scopeOptions.find((cycle) => cycle.id === props.selectedCycleId) ?? scopeOptions[0]

  const availableYears = useMemo(
    () => Array.from(new Set(scopeOptions.map((cycle) => cycle.year))).sort((a, b) => b - a),
    [scopeOptions]
  )

  const availableScopes = useMemo(() => {
    return Array.from(
      new Map(
        scopeOptions.map((cycle) => [
          `${cycle.organizationName}__${cycle.departmentName}`,
          {
            key: `${cycle.organizationName}__${cycle.departmentName}`,
            organizationName: cycle.organizationName,
            departmentName: cycle.departmentName,
          },
        ])
      ).values()
    )
  }, [scopeOptions])

  const detailItems = useMemo(() => {
    if (!viewModel) return []
    return [...viewModel.scoreBreakdown.performance, ...viewModel.scoreBreakdown.competency]
  }, [viewModel])

  const selectedDetail =
    detailItems.find((item) => item.id === selectedDetailId) ?? detailItems[0] ?? null

  function handleYearChange(year: number) {
    const nextCycle = scopeOptions.find((cycle) => cycle.year === year)
    if (!nextCycle) return
    router.push(`/evaluation/results?cycleId=${encodeURIComponent(nextCycle.id)}`)
  }

  function handleScopeChange(scopeKey: string) {
    const nextCycle = scopeOptions.find(
      (cycle) => `${cycle.organizationName}__${cycle.departmentName}` === scopeKey
    )
    if (!nextCycle) return
    router.push(`/evaluation/results?cycleId=${encodeURIComponent(nextCycle.id)}`)
  }

  function handleCycleChange(cycleId: string) {
    router.push(`/evaluation/results?cycleId=${encodeURIComponent(cycleId)}`)
  }

  if (props.state !== 'ready' || !viewModel) {
    return (
      <div className="space-y-6">
        <PageHeader cycleOptions={scopeOptions} selectedCycleId={props.selectedCycleId} />
        <ScopeSelectors
          cycleOptions={scopeOptions}
          selectedCycle={selectedCycle}
          availableYears={availableYears}
          availableScopes={availableScopes}
          onYearChange={handleYearChange}
          onScopeChange={handleScopeChange}
          onCycleChange={handleCycleChange}
        />
        <StatePanel state={props.state} message={props.message} />
        <RelatedActionLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader cycleOptions={scopeOptions} selectedCycleId={props.selectedCycleId} />

      <EvaluationResultsHero
        viewModel={viewModel}
        cycleOptions={scopeOptions}
        availableYears={availableYears}
        availableScopes={availableScopes}
        selectedCycle={selectedCycle}
        onYearChange={handleYearChange}
        onScopeChange={handleScopeChange}
        onCycleChange={handleCycleChange}
        onShowEvidence={() => setActiveTab('evidence')}
        onDownloadPdf={() => setLocalNotice('PDF 다운로드 기능은 다음 배포에서 연결됩니다.')}
      />

      {localNotice ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {localNotice}
        </div>
      ) : null}

      <EvaluationResultsSummaryCards
        viewModel={viewModel}
        acknowledged={acknowledged}
        onAcknowledge={() => setAcknowledged(true)}
      />

      <EvaluationResultsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'summary' ? <SummaryTabSection viewModel={viewModel} /> : null}
      {activeTab === 'details' ? (
        <ScoreBreakdownSection
          viewModel={viewModel}
          selectedDetailId={selectedDetail?.id ?? ''}
          onSelectDetail={setSelectedDetailId}
        />
      ) : null}
      {activeTab === 'evidence' ? <EvidenceSection viewModel={viewModel} /> : null}
      {activeTab === 'history' ? <CalibrationTimelineSection viewModel={viewModel} /> : null}
      {activeTab === 'growth' ? <GrowthRecommendationSection viewModel={viewModel} /> : null}

      {activeTab === 'details' && selectedDetail ? (
        <DetailDrawerLikePanel item={selectedDetail} />
      ) : null}
    </div>
  )
}

function PageHeader({
  cycleOptions,
  selectedCycleId,
}: {
  cycleOptions: EvaluationResultsClientProps['availableCycles']
  selectedCycleId?: string
}) {
  const selectedCycle = cycleOptions.find((cycle) => cycle.id === selectedCycleId) ?? cycleOptions[0]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
            Performance Evaluation Report
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">평가 결과</h1>
          <p className="mt-2 text-sm text-slate-500">
            목표, 체크인, 피드백, 평가 이력까지 함께 연결된 성과 결과를 한 화면에서 확인합니다.
          </p>
        </div>
        {selectedCycle ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            현재 조회 주기: <span className="font-semibold text-slate-900">{selectedCycle.name}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ScopeSelectors({
  cycleOptions,
  selectedCycle,
  availableYears,
  availableScopes,
  onYearChange,
  onScopeChange,
  onCycleChange,
}: {
  cycleOptions: EvaluationResultsClientProps['availableCycles']
  selectedCycle?: EvaluationResultsClientProps['availableCycles'][number]
  availableYears: number[]
  availableScopes: Array<{ key: string; organizationName: string; departmentName: string }>
  onYearChange: (year: number) => void
  onScopeChange: (scopeKey: string) => void
  onCycleChange: (cycleId: string) => void
}) {
  const selectedScopeKey = selectedCycle
    ? `${selectedCycle.organizationName}__${selectedCycle.departmentName}`
    : availableScopes[0]?.key ?? ''
  const filteredCycles = cycleOptions.filter(
    (cycle) =>
      cycle.year === selectedCycle?.year &&
      `${cycle.organizationName}__${cycle.departmentName}` === selectedScopeKey
  )

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <SelectorCard
        label="연도"
        value={selectedCycle?.year ? String(selectedCycle.year) : ''}
        options={availableYears.map((year) => ({ value: String(year), label: `${year}년` }))}
        onChange={(value) => onYearChange(Number(value))}
      />
      <SelectorCard
        label="주기"
        value={selectedCycle?.id ?? ''}
        options={(filteredCycles.length ? filteredCycles : selectedCycle ? [selectedCycle] : []).map((cycle) => ({
          value: cycle.id,
          label: cycle.name,
        }))}
        onChange={onCycleChange}
      />
      <SelectorCard
        label="조직"
        value={selectedScopeKey}
        options={availableScopes.map((scope) => ({
          value: scope.key,
          label: `${scope.organizationName} / ${scope.departmentName}`,
        }))}
        onChange={onScopeChange}
      />
    </div>
  )
}

function SelectorCard({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function EvaluationResultsHero({
  viewModel,
  cycleOptions,
  availableYears,
  availableScopes,
  selectedCycle,
  onYearChange,
  onScopeChange,
  onCycleChange,
  onShowEvidence,
  onDownloadPdf,
}: {
  viewModel: EvaluationResultViewModel
  cycleOptions: EvaluationResultsClientProps['availableCycles']
  availableYears: number[]
  availableScopes: Array<{ key: string; organizationName: string; departmentName: string }>
  selectedCycle?: EvaluationResultsClientProps['availableCycles'][number]
  onYearChange: (year: number) => void
  onScopeChange: (scopeKey: string) => void
  onCycleChange: (cycleId: string) => void
  onShowEvidence: () => void
  onDownloadPdf: () => void
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <ScopeSelectors
            cycleOptions={cycleOptions}
            selectedCycle={selectedCycle}
            availableYears={availableYears}
            availableScopes={availableScopes}
            onYearChange={onYearChange}
            onScopeChange={onScopeChange}
            onCycleChange={onCycleChange}
          />

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={viewModel.cycle.status} />
            <InfoPill label={viewModel.summary.calibrationAdjusted ? '캘리브레이션 반영' : '캘리브레이션 없음'} />
            <InfoPill label={`${viewModel.employee.department} / ${viewModel.employee.title}`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="최종 종합등급" value={viewModel.summary.finalGrade} emphasis />
            <HeroMetric label="총점" value={`${viewModel.summary.totalScore.toFixed(1)}점`} />
            <HeroMetric label="성과평가 점수" value={`${viewModel.summary.performanceScore.toFixed(1)}점`} />
            <HeroMetric label="역량평가 점수" value={`${viewModel.summary.competencyScore.toFixed(1)}점`} />
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 md:grid-cols-2">
            <MetaLine label="공개일" value={formatDateTime(viewModel.cycle.publishedAt)} />
            <MetaLine label="최종 확정일" value={formatDateTime(viewModel.cycle.confirmedAt)} />
            <MetaLine label="조직 범위" value={`${viewModel.cycle.organizationName} / ${viewModel.cycle.departmentScope}`} />
            <MetaLine
              label="이의 신청 마감"
              value={viewModel.cycle.appealDeadline ? formatDateTime(viewModel.cycle.appealDeadline) : '마감일 없음'}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActionButton icon={<Download className="h-4 w-4" />} label="PDF 다운로드" onClick={onDownloadPdf} />
          <ActionLink
            icon={<FileSearch className="h-4 w-4" />}
            label="이의 신청하기"
            href="/evaluation/appeal"
            description={viewModel.cycle.status === 'APPEAL_OPEN' ? '현재 이의 신청이 가능합니다.' : '이의 신청 화면으로 이동합니다.'}
          />
          <ActionButton
            icon={<Layers3 className="h-4 w-4" />}
            label="상세 근거 보기"
            onClick={onShowEvidence}
          />
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">결과 해석 한 줄</div>
            <p className="mt-2 leading-6">{viewModel.overview.interpretation}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function EvaluationResultsSummaryCards({
  viewModel,
  acknowledged,
  onAcknowledge,
}: {
  viewModel: EvaluationResultViewModel
  acknowledged: boolean
  onAcknowledge: () => void
}) {
  const deltaLabel =
    viewModel.summary.deltaFromPrevious !== undefined
      ? `${viewModel.summary.deltaFromPrevious > 0 ? '+' : ''}${viewModel.summary.deltaFromPrevious.toFixed(1)}점`
      : '비교 데이터 없음'

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={<Award className="h-5 w-5" />} label="최종 등급" value={viewModel.summary.finalGrade} description="최종 공개 기준 등급" />
      <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label="총점" value={`${viewModel.summary.totalScore.toFixed(1)}점`} description={viewModel.summary.percentileLabel ?? '조직 내 비교 정보 준비 중'} />
      <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="전년 대비" value={deltaLabel} description={viewModel.summary.previousGrade ? `직전 등급 ${viewModel.summary.previousGrade}` : '직전 등급 데이터 없음'} />
      <NextActionCard viewModel={viewModel} acknowledged={acknowledged} onAcknowledge={onAcknowledge} />
    </section>
  )
}

function EvaluationResultsTabs({
  activeTab,
  onChange,
}: {
  activeTab: ResultTab
  onChange: (tab: ResultTab) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {(Object.keys(TAB_LABELS) as ResultTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryTabSection({ viewModel }: { viewModel: EvaluationResultViewModel }) {
  const radarData = [
    { subject: '성과', score: viewModel.summary.performanceScore, fullMark: 100 },
    { subject: '역량', score: viewModel.summary.competencyScore, fullMark: 100 },
    { subject: '목표달성', score: viewModel.overview.achievementRate, fullMark: 120 },
    { subject: '피드백', score: Math.min(viewModel.overview.feedbackCount * 12, 100), fullMark: 100 },
    { subject: '체크인', score: Math.min(viewModel.overview.completedCheckins * 15, 100), fullMark: 100 },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="space-y-6">
        <SectionCard
          title="성과/역량 점수 분해"
          description="총점 아래에 있는 두 축의 점수를 먼저 확인하세요."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreMeter label="성과 점수" value={viewModel.summary.performanceScore} />
            <ScoreMeter label="역량 점수" value={viewModel.summary.competencyScore} />
          </div>
        </SectionCard>

        <SectionCard
          title="목표 달성률 / 체크인 / 피드백 요약"
          description="연간 목표, 월간 기록, 1:1 대화 데이터가 평가 결과의 근거로 연결됩니다."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <MiniStat label="목표 달성률" value={`${viewModel.overview.achievementRate.toFixed(1)}%`} />
            <MiniStat label="완료된 체크인" value={`${viewModel.overview.completedCheckins}회`} />
            <MiniStat label="누적 피드백" value={`${viewModel.overview.feedbackCount}건`} />
          </div>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="font-semibold">평가자 코멘트 미리보기</div>
            <p className="mt-2 leading-6">{viewModel.overview.evaluatorPreview}</p>
          </div>
        </SectionCard>

        <SectionCard title="강점 / 개선 포인트" description="리포트형 결과 해석을 위해 핵심 키워드만 먼저 보여줍니다.">
          <div className="grid gap-4 md:grid-cols-2">
            <ListPanel tone="positive" title="강점 3개" items={viewModel.overview.strengthsPreview} />
            <ListPanel tone="attention" title="개선 포인트 3개" items={viewModel.overview.improvementsPreview} />
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="결과 해석" description="왜 이런 결과가 나왔는지 한 문단으로 요약합니다.">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={20} domain={[0, 120]} tick={{ fontSize: 11 }} />
                <Radar dataKey="score" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.2} />
                <Tooltip formatter={(value) => formatTooltipScore(value)} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {viewModel.overview.interpretation}
          </div>
        </SectionCard>

        {viewModel.cycle.status === 'APPEAL_OPEN' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">이의 신청 가능 기간입니다</div>
            <p className="mt-2 leading-6">
              마감일 전까지 평가 결과에 대한 이의 신청을 등록할 수 있습니다. 필요한 경우 근거 자료를 먼저 검토해 주세요.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ScoreBreakdownSection({
  viewModel,
  selectedDetailId,
  onSelectDetail,
}: {
  viewModel: EvaluationResultViewModel
  selectedDetailId: string
  onSelectDetail: (id: string) => void
}) {
  const chartData = [...viewModel.scoreBreakdown.performance, ...viewModel.scoreBreakdown.competency].slice(0, 8)

  return (
    <div className="space-y-6">
      <SectionCard
        title="총점 → 영역 점수 → 세부 항목"
        description="항목을 클릭하면 우측 패널에서 상세 코멘트와 단계별 점수를 확인할 수 있습니다."
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="title" tick={{ fontSize: 12 }} hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatTooltipScore(value)} />
              <Bar dataKey="score" fill="#2563eb" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="성과평가 항목" description="성과평가 가중치와 단계별 점수를 함께 확인합니다.">
          <div className="space-y-3">
            {viewModel.scoreBreakdown.performance.map((item) => (
              <DetailRowCard key={item.id} item={item} selected={selectedDetailId === item.id} onClick={() => onSelectDetail(item.id)} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="역량평가 항목" description="정성 항목의 최종값과 자기평가 대비 변화를 함께 봅니다.">
          <div className="space-y-3">
            {viewModel.scoreBreakdown.competency.map((item) => (
              <DetailRowCard key={item.id} item={item} selected={selectedDetailId === item.id} onClick={() => onSelectDetail(item.id)} />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function EvidenceSection({ viewModel }: { viewModel: EvaluationResultViewModel }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <SectionCard title="연결된 개인 KPI 요약" description="이 결과에 연결된 KPI의 최신 달성 현황입니다.">
          <div className="space-y-3">
            {viewModel.evidence.kpis.map((kpi) => (
              <div key={kpi.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{kpi.title}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      목표 {formatMetric(kpi.target, kpi.unit)} / 실적 {formatMetric(kpi.actual, kpi.unit)}
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                    달성률 {kpi.achievementRate !== undefined ? `${kpi.achievementRate.toFixed(1)}%` : '미집계'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="이 결과에 가장 큰 영향을 준 근거" description="가장 먼저 확인할 근거만 3개로 압축했습니다.">
          <div className="space-y-3">
            {viewModel.evidence.highlights.map((highlight, index) => (
              <HighlightCard key={`${highlight.title}-${index}`} {...highlight} />
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="월간 실적 요약" description="최근 월간 실적 흐름과 핵심 메모를 확인합니다.">
          <div className="space-y-3">
            {viewModel.evidence.monthlyRecords.map((record) => (
              <div key={record.month} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{record.month}</div>
                  <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {record.achievementRate !== undefined ? `${record.achievementRate.toFixed(1)}%` : '미집계'}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{record.comment || '월간 요약 코멘트가 없습니다.'}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="체크인 / 피드백 / 증빙" description="체크인 메모, 주요 코멘트, 첨부 자료를 함께 살펴보세요.">
          <div className="space-y-4">
            <SubBlock title="체크인 / 1:1 요약">
              {viewModel.evidence.checkins.map((checkin, index) => (
                <TimelineItem key={`${checkin.date}-${index}`} title={formatDateTime(checkin.date)} description={checkin.summary} meta={`${checkin.type} / ${checkin.status}`} />
              ))}
            </SubBlock>
            <SubBlock title="피드백 / 코멘트">
              {viewModel.evidence.feedbacks.map((feedback, index) => (
                <TimelineItem key={`${feedback.date}-${index}`} title={`${feedback.author} · ${formatDateTime(feedback.date)}`} description={feedback.content} />
              ))}
            </SubBlock>
            <SubBlock title="첨부 / 증빙">
              {viewModel.evidence.attachments.length ? (
                viewModel.evidence.attachments.map((attachment, index) => (
                  <TimelineItem key={`${attachment.label}-${index}`} title={attachment.label} description={attachment.source} />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  연결된 증빙 첨부가 없습니다.
                </div>
              )}
            </SubBlock>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function CalibrationTimelineSection({ viewModel }: { viewModel: EvaluationResultViewModel }) {
  return (
    <div className="space-y-6">
      <SectionCard title="조정 전 / 조정 후 비교" description="캘리브레이션이 있었다면 등급 변화와 사유를 한눈에 비교합니다.">
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard icon={<Flag className="h-5 w-5" />} label="초안 등급" value={viewModel.calibration.draftGrade ?? '없음'} description="조정 전 기준" />
          <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="최종 등급" value={viewModel.calibration.finalGrade ?? '없음'} description="최종 확정값" />
          <SummaryCard icon={<ClipboardList className="h-5 w-5" />} label="조정 상태" value={viewModel.calibration.adjusted ? '조정 반영' : '조정 없음'} description={viewModel.calibration.reason ?? '사유 없음'} />
        </div>
      </SectionCard>

      <SectionCard title="공개 / 확정 이력" description="상태 타임라인으로 결과 공개와 조정 흐름을 확인합니다.">
        <div className="space-y-4">
          {viewModel.calibration.logs.map((log, index) => (
            <div key={`${log.date}-${index}`} className="flex gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                {index + 1}
              </div>
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold text-slate-900">{log.action}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(log.date)}</div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{log.actor}</div>
                {log.detail ? <p className="mt-2 text-sm leading-6 text-slate-700">{log.detail}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function GrowthRecommendationSection({ viewModel }: { viewModel: EvaluationResultViewModel }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <SectionCard title="상위 강점 3개" description="다음 반기에도 유지하거나 확장할 강점입니다.">
          <ListPanel tone="positive" title="강점" items={viewModel.growth.strengths} />
        </SectionCard>
        <SectionCard title="보완 필요 역량 3개" description="리더와 우선순위를 맞춰볼 보완 포인트입니다.">
          <ListPanel tone="attention" title="보완 포인트" items={viewModel.growth.improvements} />
        </SectionCard>
        <SectionCard title="추천 액션 아이템" description="짧고 실행 가능한 다음 행동으로 정리했습니다.">
          <ListPanel tone="neutral" title="실천 항목" items={viewModel.growth.actions} />
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="다음 반기 권장 포커스" description="리더와 1:1에서 바로 논의할 질문까지 준비했습니다.">
          <ListPanel tone="neutral" title="1:1 질문" items={viewModel.growth.discussionQuestions} />
        </SectionCard>
        <ActionLink
          icon={<Sparkles className="h-4 w-4" />}
          label="AI 보조 작성으로 이어보기"
          href="/evaluation/assistant"
          description="강점과 개선 포인트를 바탕으로 성장 계획 초안을 이어서 작성할 수 있습니다."
        />
      </div>
    </div>
  )
}

function DetailDrawerLikePanel({
  item,
}: {
  item: EvaluationResultViewModel['scoreBreakdown']['performance'][number]
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">항목 상세 근거</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MiniStat label="자기평가" value={item.selfScore !== undefined ? `${item.selfScore.toFixed(1)}점` : '없음'} />
        <MiniStat label="1차 평가" value={item.managerScore !== undefined ? `${item.managerScore.toFixed(1)}점` : '없음'} />
        <MiniStat label="2차 평가" value={item.reviewerScore !== undefined ? `${item.reviewerScore.toFixed(1)}점` : '없음'} />
        <MiniStat label="최종값" value={item.finalScore !== undefined ? `${item.finalScore.toFixed(1)}점` : '없음'} />
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {item.comment || '세부 코멘트가 아직 등록되지 않았습니다.'}
      </div>
    </section>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{description}</div>
    </div>
  )
}

function NextActionCard({
  viewModel,
  acknowledged,
  onAcknowledge,
}: {
  viewModel: EvaluationResultViewModel
  acknowledged: boolean
  onAcknowledge: () => void
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-blue-800">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold">내가 확인해야 할 다음 행동</span>
      </div>
      <div className="mt-4 space-y-3 text-sm text-blue-900">
        <ActionChecklistRow label="결과 확인 완료" done={acknowledged} action={acknowledged ? '확인 완료' : '확인 체크'} onClick={acknowledged ? undefined : onAcknowledge} />
        <ActionChecklistRow label="이의 신청 가능 여부" done={viewModel.cycle.status === 'APPEAL_OPEN'} href="/evaluation/appeal" action="이동" />
        <ActionChecklistRow label="성장 계획 확인" done={false} href="/evaluation/assistant" action="열기" />
      </div>
    </div>
  )
}

function ActionChecklistRow({
  label,
  done,
  action,
  href,
  onClick,
}: {
  label: string
  done: boolean
  action: string
  href?: string
  onClick?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-3">
      <div className="font-medium">{label}</div>
      {href ? (
        <Link href={href} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
          {action}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
          {done ? '완료' : action}
        </button>
      )}
    </div>
  )
}

function HeroMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${emphasis ? 'text-blue-900' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const percentage = Math.max(0, Math.min(100, value))
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="text-sm font-semibold text-slate-700">{value.toFixed(1)}점</span>
      </div>
      <div className="mt-3 h-3 rounded-full bg-slate-200">
        <div className="h-3 rounded-full bg-slate-900" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function ListPanel({
  tone,
  title,
  items,
}: {
  tone: 'positive' | 'neutral' | 'attention'
  title: string
  items: string[]
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'attention'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <div key={item} className="flex gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailRowCard({
  item,
  selected,
  onClick,
}: {
  item: EvaluationResultViewModel['scoreBreakdown']['performance'][number]
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-sm text-slate-500">가중치 {item.weight?.toFixed(0) ?? '-'}%</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-white px-3 py-1 text-slate-700">최종 {item.finalScore?.toFixed(1) ?? '-'}점</span>
          <span className="rounded-full bg-white px-3 py-1 text-slate-700">자기 {item.selfScore?.toFixed(1) ?? '-'}점</span>
          <span className={`rounded-full px-3 py-1 ${item.deltaFromSelf && item.deltaFromSelf >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            자기평가 대비 {item.deltaFromSelf !== undefined ? `${item.deltaFromSelf > 0 ? '+' : ''}${item.deltaFromSelf.toFixed(1)}` : '-'}
          </span>
        </div>
      </div>
    </button>
  )
}

function HighlightCard({
  title,
  summary,
  tone,
}: {
  title: string
  summary: string
  tone: 'positive' | 'neutral' | 'attention'
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'attention'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6">{summary}</p>
    </div>
  )
}

function SubBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function TimelineItem({
  title,
  description,
  meta,
}: {
  title: string
  description: string
  meta?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="font-medium text-slate-900">{title}</div>
        {meta ? <div className="text-xs text-slate-500">{meta}</div> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
      {icon}
      {label}
    </button>
  )
}

function ActionLink({
  icon,
  label,
  href,
  description,
}: {
  icon: ReactNode
  label: string
  href: string
  description: string
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {label}
        <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </Link>
  )
}

function StatePanel({ state, message }: { state: EvaluationResultPageData['state']; message?: string }) {
  const config =
    state === 'hidden'
      ? { title: '아직 결과가 공개되지 않았습니다', tone: 'amber' }
      : state === 'permission-denied'
        ? { title: '결과를 확인할 권한이 없습니다', tone: 'rose' }
        : state === 'error'
          ? { title: '평가 결과를 불러오지 못했습니다', tone: 'rose' }
          : { title: '표시할 결과가 아직 없습니다', tone: 'slate' }

  const toneClass =
    config.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : config.tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <section className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}>
      <div className="text-lg font-semibold">{config.title}</div>
      <p className="mt-2 text-sm leading-6">{message || '현재 상태를 다시 확인해 주세요.'}</p>
    </section>
  )
}

function StatusPill({ status }: { status: EvaluationResultViewModel['cycle']['status'] }) {
  const label =
    status === 'APPEAL_OPEN'
      ? '이의 신청 가능'
      : status === 'APPEAL_CLOSED'
        ? '이의 신청 마감'
        : status === 'PUBLISHED'
          ? '결과 공개'
          : '비공개'

  const className =
    status === 'APPEAL_OPEN'
      ? 'bg-amber-100 text-amber-800'
      : status === 'APPEAL_CLOSED'
        ? 'bg-slate-200 text-slate-700'
        : status === 'PUBLISHED'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-rose-100 text-rose-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>
}

function InfoPill({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span>
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

function RelatedActionLinks() {
  const links = [
    { href: '/evaluation/appeal', label: '이의 신청' },
    { href: '/evaluation/assistant', label: 'AI 보조 작성' },
    { href: '/kpi/personal', label: '개인 KPI' },
    { href: '/kpi/monthly', label: '월간 실적' },
    { href: '/checkin', label: '체크인 일정' },
    { href: '/compensation/my', label: '내 보상 결과' },
  ]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-lg font-semibold text-slate-900">다음으로 이동할 수 있는 화면</div>
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function formatDateTime(value?: string) {
  if (!value) return '미정'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMetric(value?: number, unit?: string) {
  if (value === undefined) return '미집계'
  return `${value}${unit ? ` ${unit}` : ''}`
}

function formatTooltipScore(
  value: string | number | ReadonlyArray<string | number> | undefined
) {
  if (typeof value === 'number') return `${value.toFixed(1)}점`
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')
  return '-'
}
