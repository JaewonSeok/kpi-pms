'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileSearch,
  Layers3,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type { EvaluationResultPageData, EvaluationResultViewModel } from '@/server/evaluation-results'

type ResultTab = 'summary' | 'details' | 'evidence' | 'history' | 'growth'

function buildResultsQuery(params: { cycleId?: string; employeeId?: string }) {
  const query = new URLSearchParams()
  if (params.cycleId) query.set('cycleId', params.cycleId)
  if (params.employeeId) query.set('employeeId', params.employeeId)
  return query.toString()
}

type DetailItem =
  | (EvaluationResultViewModel['scoreBreakdown']['performance'][number] & { group: '성과' | '역량' })
  | null

const TAB_LABELS: Record<ResultTab, string> = {
  summary: '요약',
  details: '세부 점수',
  evidence: '근거 자료',
  history: '이력/캘리브레이션',
  growth: '성장 제안',
}

export function EvaluationResultsClient(props: EvaluationResultPageData) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ResultTab>('summary')
  const [localNotice, setLocalNotice] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [busyAction, setBusyAction] = useState<'download' | 'acknowledge' | null>(null)
  const [acknowledged, setAcknowledged] = useState(props.viewModel?.summary.acknowledged ?? false)
  const [selectedDetailId, setSelectedDetailId] = useState('')

  const viewModel = props.viewModel
  const scopeOptions = props.availableCycles
  const employeeOptions = props.employeeOptions
  const selectedCycle = scopeOptions.find((cycle) => cycle.id === props.selectedCycleId) ?? scopeOptions[0]
  const selectedEmployeeId = props.selectedEmployeeId ?? viewModel?.employee.id ?? ''

  const availableYears = useMemo(
    () => Array.from(new Set(scopeOptions.map((cycle) => cycle.year))).sort((a, b) => b - a),
    [scopeOptions]
  )

  const availableScopes = useMemo(
    () =>
      Array.from(
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
      ),
    [scopeOptions]
  )
  const selectedScopeKey = selectedCycle ? `${selectedCycle.organizationName}__${selectedCycle.departmentName}` : availableScopes[0]?.key ?? ''

  const detailItems = useMemo(() => {
    if (!viewModel) return []
    return [
      ...viewModel.scoreBreakdown.performance.map((item) => ({ ...item, group: '성과' as const })),
      ...viewModel.scoreBreakdown.competency.map((item) => ({ ...item, group: '역량' as const })),
    ]
  }, [viewModel])

  const resultsContextKey = `${props.state}:${props.selectedCycleId ?? ''}:${selectedEmployeeId}`
  const selectedDetail = detailItems.find((item) => item.id === selectedDetailId) ?? detailItems[0] ?? null
  const loadAlerts = props.alerts?.length ? <LoadAlerts alerts={props.alerts} /> : null
  const acknowledgeDisabledReason =
    !viewModel
      ? '?뺤씤?????덈뒗 寃곌낵媛 ?놁뒿?덈떎.'
      : acknowledged
        ? '?대? ?뺤씤 ?꾨즺???됯? 寃곌낵?낅땲??'
        : viewModel.actions.acknowledgeMessage
  const exportDisabledReason = viewModel?.actions.exportMessage

  useEffect(() => {
    setAcknowledged(props.viewModel?.summary.acknowledged ?? false)
  }, [resultsContextKey, props.viewModel?.summary.acknowledged])

  useEffect(() => {
    setActiveTab('summary')
    setSelectedDetailId('')
    setLocalNotice(null)
  }, [resultsContextKey])

  function navigateTo(cycleId?: string, employeeId?: string) {
    const query = buildResultsQuery({ cycleId, employeeId })
    router.push(query ? `/evaluation/results?${query}` : '/evaluation/results')
  }

  function handleYearChange(year: number) {
    const nextCycle =
      scopeOptions.find(
        (cycle) =>
          cycle.year === year &&
          `${cycle.organizationName}__${cycle.departmentName}` === selectedScopeKey
      ) ?? scopeOptions.find((cycle) => cycle.year === year)
    if (!nextCycle) return
    navigateTo(nextCycle.id, selectedEmployeeId || undefined)
  }

  function handleScopeChange(scopeKey: string) {
    const nextCycle =
      scopeOptions.find(
        (cycle) =>
          cycle.year === selectedCycle?.year &&
          `${cycle.organizationName}__${cycle.departmentName}` === scopeKey
      ) ?? scopeOptions.find((cycle) => `${cycle.organizationName}__${cycle.departmentName}` === scopeKey)
    if (!nextCycle) return
    navigateTo(nextCycle.id, selectedEmployeeId || undefined)
  }

  function handleCycleChange(cycleId: string) {
    navigateTo(cycleId, selectedEmployeeId || undefined)
  }

  function handleEmployeeChange(employeeId: string) {
    navigateTo(selectedCycle?.id ?? props.selectedCycleId, employeeId || undefined)
  }

  async function handleDownloadPdf() {
    if (!viewModel || !viewModel.actions.canExport) {
      setLocalNotice({
        tone: 'info',
        message: exportDisabledReason ?? '?꾩옱 ?곹깭?먯꽌??由ы룷?몃? ?ㅼ슫濡쒕뱶?????놁뒿?덈떎.',
      })
      return
    }
    setBusyAction('download')
    try {
      const query = buildResultsQuery({ employeeId: selectedEmployeeId || undefined })
      const response = await fetch(
        `/api/evaluation/results/${encodeURIComponent(viewModel.cycle.id)}/export${query ? `?${query}` : ''}`,
        {
          cache: 'no-store',
        }
      )
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(json?.error?.message || '평가 결과 리포트를 다운로드하지 못했습니다.')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/)
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileNameMatch ? decodeURIComponent(fileNameMatch[1]) : 'evaluation-result.html'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)

      setLocalNotice({
        tone: 'success',
        message: '평가 결과 리포트를 다운로드했습니다. 브라우저에서 열어 PDF로 저장할 수 있습니다.',
      })
    } catch (error) {
      setLocalNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '평가 결과 리포트 다운로드에 실패했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAcknowledge() {
    if (!viewModel || acknowledged || !viewModel.actions.canAcknowledge) {
      setLocalNotice({
        tone: 'info',
        message: acknowledgeDisabledReason ?? '?꾩옱 ?곹깭?먯꽌???뺤씤 ?꾨즺濡?泥섎━?????놁뒿?덈떎.',
      })
      return
    }
    setBusyAction('acknowledge')
    try {
      const response = await fetch(`/api/evaluation/results/${encodeURIComponent(viewModel.cycle.id)}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await response.json()) as { success?: boolean; error?: { message?: string } }
      if (!json.success) {
        throw new Error(json.error?.message || '결과 확인 상태를 저장하지 못했습니다.')
      }
      setAcknowledged(true)
      setLocalNotice({ tone: 'success', message: '평가 결과 확인 상태를 저장했습니다.' })
      router.refresh()
    } catch (error) {
      setLocalNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '결과 확인 상태 저장에 실패했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
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
          employeeOptions={employeeOptions}
          selectedEmployeeId={selectedEmployeeId}
          canSelectEmployee={props.canSelectEmployee}
          onYearChange={handleYearChange}
          onScopeChange={handleScopeChange}
          onCycleChange={handleCycleChange}
          onEmployeeChange={handleEmployeeChange}
        />
        {loadAlerts}
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
        employeeOptions={employeeOptions}
        selectedEmployeeId={selectedEmployeeId}
        canSelectEmployee={props.canSelectEmployee}
        selectedCycle={selectedCycle}
        onYearChange={handleYearChange}
        onScopeChange={handleScopeChange}
        onCycleChange={handleCycleChange}
        onEmployeeChange={handleEmployeeChange}
        onShowEvidence={() => setActiveTab('evidence')}
        onDownloadPdf={handleDownloadPdf}
        downloadPending={busyAction === 'download'}
        downloadDisabledReason={exportDisabledReason}
      />
      {loadAlerts}
      {localNotice ? <Banner tone={localNotice.tone} message={localNotice.message} /> : null}
      <EvaluationResultsSummaryCards
        viewModel={viewModel}
        acknowledged={acknowledged}
        acknowledgePending={busyAction === 'acknowledge'}
        acknowledgeDisabledReason={acknowledgeDisabledReason}
        onAcknowledge={handleAcknowledge}
      />
      <EvaluationResultsTabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'summary' ? <SummaryTabSection viewModel={viewModel} /> : null}
      {activeTab === 'details' ? (
        <ScoreBreakdownSection detailItems={detailItems} selectedDetailId={selectedDetail?.id ?? ''} onSelectDetail={setSelectedDetailId} />
      ) : null}
      {activeTab === 'evidence' ? <EvidenceSection viewModel={viewModel} /> : null}
      {activeTab === 'history' ? <CalibrationTimelineSection viewModel={viewModel} /> : null}
      {activeTab === 'growth' ? <GrowthRecommendationSection viewModel={viewModel} /> : null}
      {activeTab === 'details' ? <DetailPanel item={selectedDetail} /> : null}
      <RelatedActionLinks />
    </div>
  )
}

function PageHeader({ cycleOptions, selectedCycleId }: { cycleOptions: EvaluationResultPageData['availableCycles']; selectedCycleId?: string }) {
  const selectedCycle = cycleOptions.find((cycle) => cycle.id === selectedCycleId) ?? cycleOptions[0]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Performance Evaluation Report</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">평가 결과</h1>
          <p className="mt-2 text-sm text-slate-500">목표, 체크인, 피드백, 캘리브레이션까지 연결된 최종 평가 결과를 설명 가능한 형태로 확인합니다.</p>
        </div>
        {selectedCycle ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">현재 조회 주기: <span className="font-semibold text-slate-900">{selectedCycle.name}</span></div>
        ) : null}
      </div>
    </section>
  )
}

function ScopeSelectors({ cycleOptions, selectedCycle, availableYears, availableScopes, employeeOptions, selectedEmployeeId, canSelectEmployee, onYearChange, onScopeChange, onCycleChange, onEmployeeChange }: { cycleOptions: EvaluationResultPageData['availableCycles']; selectedCycle?: EvaluationResultPageData['availableCycles'][number]; availableYears: number[]; availableScopes: Array<{ key: string; organizationName: string; departmentName: string }>; employeeOptions: EvaluationResultPageData['employeeOptions']; selectedEmployeeId?: string; canSelectEmployee: boolean; onYearChange: (year: number) => void; onScopeChange: (scopeKey: string) => void; onCycleChange: (cycleId: string) => void; onEmployeeChange: (employeeId: string) => void }) {
  const selectedScopeKey = selectedCycle ? `${selectedCycle.organizationName}__${selectedCycle.departmentName}` : availableScopes[0]?.key ?? ''
  const filteredCycles = cycleOptions.filter((cycle) => cycle.year === selectedCycle?.year && `${cycle.organizationName}__${cycle.departmentName}` === selectedScopeKey)
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <SelectorCard label="연도" value={selectedCycle?.year ? String(selectedCycle.year) : ''} options={availableYears.map((year) => ({ value: String(year), label: `${year}년` }))} onChange={(value) => onYearChange(Number(value))} />
      <SelectorCard label="주기" value={selectedCycle?.id ?? ''} options={(filteredCycles.length ? filteredCycles : selectedCycle ? [selectedCycle] : []).map((cycle) => ({ value: cycle.id, label: cycle.name }))} onChange={onCycleChange} />
      <SelectorCard label="조직" value={selectedScopeKey} options={availableScopes.map((scope) => ({ value: scope.key, label: `${scope.organizationName} / ${scope.departmentName}` }))} onChange={onScopeChange} />
      <SelectorCard label="??곸옄" value={selectedEmployeeId ?? ''} options={employeeOptions.map((employee) => ({ value: employee.id, label: `${employee.name} / ${employee.departmentName}` }))} onChange={onEmployeeChange} disabled={!canSelectEmployee || employeeOptions.length <= 1} />
    </div>
  )
}

function EvaluationResultsHero({ viewModel, cycleOptions, availableYears, availableScopes, employeeOptions, selectedEmployeeId, canSelectEmployee, selectedCycle, onYearChange, onScopeChange, onCycleChange, onEmployeeChange, onShowEvidence, onDownloadPdf, downloadPending, downloadDisabledReason }: { viewModel: EvaluationResultViewModel; cycleOptions: EvaluationResultPageData['availableCycles']; availableYears: number[]; availableScopes: Array<{ key: string; organizationName: string; departmentName: string }>; employeeOptions: EvaluationResultPageData['employeeOptions']; selectedEmployeeId?: string; canSelectEmployee: boolean; selectedCycle?: EvaluationResultPageData['availableCycles'][number]; onYearChange: (year: number) => void; onScopeChange: (scopeKey: string) => void; onCycleChange: (cycleId: string) => void; onEmployeeChange: (employeeId: string) => void; onShowEvidence: () => void; onDownloadPdf: () => void; downloadPending?: boolean; downloadDisabledReason?: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <ScopeSelectors cycleOptions={cycleOptions} selectedCycle={selectedCycle} availableYears={availableYears} availableScopes={availableScopes} employeeOptions={employeeOptions} selectedEmployeeId={selectedEmployeeId} canSelectEmployee={canSelectEmployee} onYearChange={onYearChange} onScopeChange={onScopeChange} onCycleChange={onCycleChange} onEmployeeChange={onEmployeeChange} />
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
            <MetaLine label="이의 신청 마감" value={formatDateTime(viewModel.cycle.appealDeadline)} />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActionButton icon={<Download className="h-4 w-4" />} label={downloadPending ? 'PDF 다운로드 중...' : 'PDF 다운로드'} onClick={onDownloadPdf} disabled={downloadPending || !viewModel.actions.canExport} title={!viewModel.actions.canExport ? downloadDisabledReason : undefined} />
          <ActionLink icon={<FileSearch className="h-4 w-4" />} label="이의 신청하기" href="/evaluation/appeal" description={viewModel.cycle.status === 'APPEAL_OPEN' ? '현재 이의 신청이 가능합니다.' : '이의 신청 화면으로 이동합니다.'} />
          <ActionButton icon={<Layers3 className="h-4 w-4" />} label="상세 근거 보기" onClick={onShowEvidence} />
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><div className="font-semibold text-slate-900">결과 해석</div><p className="mt-2 leading-6">{viewModel.overview.interpretation}</p></div>
        </div>
      </div>
    </section>
  )
}

function EvaluationResultsSummaryCards({
  viewModel,
  acknowledged,
  acknowledgePending,
  acknowledgeDisabledReason,
  onAcknowledge,
}: {
  viewModel: EvaluationResultViewModel
  acknowledged: boolean
  acknowledgePending?: boolean
  acknowledgeDisabledReason?: string
  onAcknowledge: () => void
}) {
  const deltaLabel = viewModel.summary.deltaFromPrevious !== undefined ? `${viewModel.summary.deltaFromPrevious > 0 ? '+' : ''}${viewModel.summary.deltaFromPrevious.toFixed(1)}점` : '비교 데이터 없음'
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={<Award className="h-5 w-5" />} label="최종 등급" value={viewModel.summary.finalGrade} description="최종 공개된 등급 기준입니다." />
      <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label="총점" value={`${viewModel.summary.totalScore.toFixed(1)}점`} description={viewModel.summary.percentileLabel ?? '조직 내 비교 정보 준비 중'} />
      <SummaryCard icon={<TrendingUp className="h-5 w-5" />} label="직전 주기 대비" value={deltaLabel} description={viewModel.summary.previousGrade ? `직전 등급 ${viewModel.summary.previousGrade}` : '직전 등급 데이터 없음'} />
      <NextActionCard
        viewModel={viewModel}
        acknowledged={acknowledged}
        acknowledgePending={acknowledgePending}
        acknowledgeDisabledReason={acknowledgeDisabledReason}
        onAcknowledge={onAcknowledge}
      />
    </section>
  )
}

function EvaluationResultsTabs({ activeTab, onChange }: { activeTab: ResultTab; onChange: (tab: ResultTab) => void }) {
  return <div className="overflow-x-auto"><div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{(Object.keys(TAB_LABELS) as ResultTab[]).map((tab) => <button key={tab} type="button" onClick={() => onChange(tab)} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>{TAB_LABELS[tab]}</button>)}</div></div>
}

function SummaryTabSection({ viewModel }: { viewModel: EvaluationResultViewModel }) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-6"><SectionCard title="성과 / 역량 점수 분해" description="총점 아래에 있는 두 축의 결과를 먼저 확인합니다."><div className="grid gap-4 md:grid-cols-2"><ScoreMeter label="성과 점수" value={viewModel.summary.performanceScore} /><ScoreMeter label="역량 점수" value={viewModel.summary.competencyScore} /></div></SectionCard><SectionCard title="목표 달성 / 체크인 / 피드백 요약" description="월간 기록과 대화 데이터가 평가 결과의 근거로 이어집니다."><div className="grid gap-4 md:grid-cols-3"><MiniStat label="목표 달성률" value={`${viewModel.overview.achievementRate.toFixed(1)}%`} /><MiniStat label="완료된 체크인" value={`${viewModel.overview.completedCheckins}회`} /><MiniStat label="누적 피드백" value={`${viewModel.overview.feedbackCount}건`} /></div><div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">평가자 코멘트 미리보기: {viewModel.overview.evaluatorPreview}</div></SectionCard></div><div className="space-y-6"><SectionCard title="강점 3개" description="이번 주기에서 특히 좋은 평가를 받은 포인트입니다."><ListPanel tone="positive" items={viewModel.overview.strengthsPreview} /></SectionCard><SectionCard title="개선 포인트 3개" description="다음 반기에 우선순위를 두고 보완할 영역입니다."><ListPanel tone="attention" items={viewModel.overview.improvementsPreview} /></SectionCard>{viewModel.cycle.status === 'APPEAL_OPEN' ? <SectionCard title="이의 신청 가능 안내" description="현재 결과 공개 이후 이의 신청 기간이 열려 있습니다."><ActionLink icon={<FileSearch className="h-4 w-4" />} label="이의 신청 화면으로 이동" href="/evaluation/appeal" description="사유와 근거를 함께 작성해 이의 신청을 진행할 수 있습니다." /></SectionCard> : null}</div></div> }

function ScoreBreakdownSection({ detailItems, selectedDetailId, onSelectDetail }: { detailItems: DetailItem[]; selectedDetailId: string; onSelectDetail: (id: string) => void }) {
  const performance = detailItems.filter((item): item is NonNullable<DetailItem> => Boolean(item && item.group === '성과'))
  const competency = detailItems.filter((item): item is NonNullable<DetailItem> => Boolean(item && item.group === '역량'))
  return <div className="space-y-6"><SectionCard title="성과평가 항목별 점수" description="항목을 선택하면 아래 상세 패널에서 코멘트와 점수 근거를 확인할 수 있습니다."><div className="space-y-3">{performance.map((item) => <DetailRowCard key={item.id} item={item} selected={selectedDetailId === item.id} onClick={() => onSelectDetail(item.id)} />)}</div></SectionCard><SectionCard title="역량평가 항목별 점수" description="자기평가, 1차, 2차, 최종값을 비교해서 볼 수 있습니다."><div className="space-y-3">{competency.map((item) => <DetailRowCard key={item.id} item={item} selected={selectedDetailId === item.id} onClick={() => onSelectDetail(item.id)} />)}</div></SectionCard></div>
}

function EvidenceSection({ viewModel }: { viewModel: EvaluationResultViewModel }) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-6"><SectionCard title="연결된 개인 KPI 요약" description="조직 목표와 연결된 개인 KPI의 최신 실적입니다."><div className="space-y-3">{viewModel.evidence.kpis.map((kpi) => <div key={kpi.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="font-semibold text-slate-900">{kpi.title}</div><InfoPill label={kpi.status ?? '상태 없음'} /></div><div className="mt-2 text-sm text-slate-600">목표 {formatMetric(kpi.target, kpi.unit)} / 실적 {formatMetric(kpi.actual, kpi.unit)} / 달성률 {kpi.achievementRate !== undefined ? `${kpi.achievementRate.toFixed(1)}%` : '미집계'}</div></div>)}</div></SectionCard><SectionCard title="월간 실적 / 체크인 / 피드백" description="평가 결과에 가장 가까운 실행 근거를 최근 순서대로 보여줍니다."><div className="space-y-4"><SubBlock title="월간 실적 요약">{viewModel.evidence.monthlyRecords.map((record) => <TimelineItem key={record.month} title={record.month} description={record.comment || '월간 코멘트 없음'} meta={record.achievementRate !== undefined ? `${record.achievementRate.toFixed(1)}%` : '미집계'} />)}</SubBlock><SubBlock title="체크인 / 1:1 요약">{viewModel.evidence.checkins.map((checkin, index) => <TimelineItem key={`${checkin.date}-${index}`} title={formatDateTime(checkin.date)} description={checkin.summary} meta={`${checkin.type} / ${checkin.status}`} />)}</SubBlock><SubBlock title="피드백 / 코멘트">{viewModel.evidence.feedbacks.map((feedback, index) => <TimelineItem key={`${feedback.date}-${index}`} title={`${feedback.author} · ${formatDateTime(feedback.date)}`} description={feedback.content} />)}</SubBlock></div></SectionCard></div><div className="space-y-6"><SectionCard title="이번 결과에 가장 큰 영향을 준 근거" description="핵심 근거 3개를 하이라이트로 정리했습니다."><div className="space-y-3">{viewModel.evidence.highlights.map((highlight) => <HighlightCard key={highlight.title} title={highlight.title} summary={highlight.summary} tone={highlight.tone} />)}</div></SectionCard><SectionCard title="첨부 / 증빙" description="평가 결과 설명에 활용된 증빙 목록입니다."><div className="space-y-3">{viewModel.evidence.attachments.length ? viewModel.evidence.attachments.map((attachment, index) => <TimelineItem key={`${attachment.label}-${index}`} title={attachment.label} description={attachment.source} />) : <EmptyCard title="연결된 첨부가 없습니다." description="월간 실적 또는 평가 근거에 등록된 첨부가 있으면 여기에 표시됩니다." />}</div></SectionCard></div></div> }

function CalibrationTimelineSection({ viewModel }: { viewModel: EvaluationResultViewModel }) { return <div className="space-y-6"><SectionCard title="조정 전 / 조정 후 비교" description="캘리브레이션이 있었다면 등급 변화와 사유를 비교해서 보여줍니다."><div className="grid gap-4 md:grid-cols-3"><SummaryCard icon={<ClipboardList className="h-5 w-5" />} label="초안 등급" value={viewModel.calibration.draftGrade ?? '없음'} description="조정 전 기준" /><SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="최종 등급" value={viewModel.calibration.finalGrade ?? '없음'} description="최종 확정 결과" /><SummaryCard icon={<Layers3 className="h-5 w-5" />} label="조정 상태" value={viewModel.calibration.adjusted ? '조정 반영' : '조정 없음'} description={viewModel.calibration.reason ?? '사유 없음'} /></div></SectionCard><SectionCard title="공개 / 확정 이력" description="감사 가능한 형태로 상태 변경 이력을 남깁니다."><div className="space-y-4">{viewModel.calibration.logs.map((log, index) => <div key={`${log.date}-${index}`} className="flex gap-4"><div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">{index + 1}</div><div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between"><div className="font-semibold text-slate-900">{log.action}</div><div className="text-xs text-slate-500">{formatDateTime(log.date)}</div></div><div className="mt-1 text-sm text-slate-500">{log.actor}</div>{log.detail ? <p className="mt-2 text-sm leading-6 text-slate-700">{log.detail}</p> : null}</div></div>)}</div></SectionCard></div> }

function GrowthRecommendationSection({ viewModel }: { viewModel: EvaluationResultViewModel }) { return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="space-y-6"><SectionCard title="상위 강점 3개" description="다음 반기에도 계속 활용할 수 있는 강점입니다."><ListPanel tone="positive" items={viewModel.growth.strengths} /></SectionCard><SectionCard title="보완 필요 역량 3개" description="리더와 우선순위를 맞춰서 보완할 영역입니다."><ListPanel tone="attention" items={viewModel.growth.improvements} /></SectionCard><SectionCard title="추천 액션 아이템" description="바로 실행 가능한 다음 행동을 제안합니다."><ListPanel tone="neutral" items={viewModel.growth.actions} /></SectionCard></div><div className="space-y-6"><SectionCard title="리더와 1:1에서 논의할 질문" description="다음 체크인과 성장 계획 대화에 바로 활용할 수 있습니다."><ListPanel tone="neutral" items={viewModel.growth.discussionQuestions} /></SectionCard><ActionLink icon={<Sparkles className="h-4 w-4" />} label="AI 보조 작성으로 이어보기" href="/evaluation/workbench" description="강점과 보완 포인트를 바탕으로 성장 계획 초안과 평가 보조 작성을 이어갈 수 있습니다." /></div></div> }

function DetailPanel({ item }: { item: DetailItem }) { if (!item) { return <SectionCard title="항목 상세" description="점수 항목을 선택하면 상세 코멘트와 근거를 볼 수 있습니다."><EmptyCard title="선택된 항목이 없습니다." description="세부 점수 탭에서 항목을 선택해 주세요." /></SectionCard> } return <SectionCard title="항목 상세" description="평가 단계별 점수와 최종 코멘트를 함께 확인합니다."><div className="space-y-4"><InfoGridCard label="항목명" value={`${item.group} · ${item.title}`} /><div className="grid gap-3 md:grid-cols-2"><MiniStat label="자기평가" value={item.selfScore !== undefined ? `${item.selfScore.toFixed(1)}점` : '없음'} /><MiniStat label="1차 평가" value={item.managerScore !== undefined ? `${item.managerScore.toFixed(1)}점` : '없음'} /><MiniStat label="2차 평가" value={item.reviewerScore !== undefined ? `${item.reviewerScore.toFixed(1)}점` : '없음'} /><MiniStat label="최종값" value={item.finalScore !== undefined ? `${item.finalScore.toFixed(1)}점` : '없음'} /></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{item.comment || '등록된 상세 코멘트가 없습니다.'}</div></div></SectionCard> }

function NextActionCard({
  viewModel,
  acknowledged,
  acknowledgePending,
  acknowledgeDisabledReason,
  onAcknowledge,
}: {
  viewModel: EvaluationResultViewModel
  acknowledged: boolean
  acknowledgePending?: boolean
  acknowledgeDisabledReason?: string
  onAcknowledge: () => void
}) {
  const acknowledgeBlocked = acknowledged || acknowledgePending || !viewModel.actions.canAcknowledge
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-blue-800">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold">내가 확인해야 할 다음 행동</span>
      </div>
      <div className="mt-4 space-y-3 text-sm text-blue-900">
        <ActionChecklistRow
          label="결과 확인 완료"
          done={acknowledged}
          pending={acknowledgePending}
          action={acknowledged ? '확인 완료' : acknowledgePending ? '확인 중...' : '확인 체크'}
          disabledReason={acknowledgeBlocked ? acknowledgeDisabledReason : undefined}
          onClick={acknowledgeBlocked ? undefined : onAcknowledge}
        />
        <ActionChecklistRow label="이의 신청 가능 여부" done={viewModel.cycle.status === 'APPEAL_OPEN'} href="/evaluation/appeal" action="이동" />
        <ActionChecklistRow label="성장 계획 확인" done={false} href="/evaluation/workbench" action="열기" />
      </div>
    </div>
  )
}

function DetailRowCard({ item, selected, onClick }: { item: NonNullable<DetailItem>; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-sm text-slate-500">{item.group} · 가중치 {item.weight?.toFixed(0) ?? '-'}%</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <InfoPill label={`최종 ${item.finalScore?.toFixed(1) ?? '-'}점`} />
          <InfoPill label={`자기 ${item.selfScore?.toFixed(1) ?? '-'}점`} />
          <InfoPill label={item.deltaFromSelf !== undefined ? `차이 ${item.deltaFromSelf > 0 ? '+' : ''}${item.deltaFromSelf.toFixed(1)}` : '차이 없음'} />
        </div>
      </div>
    </button>
  )
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
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

function SummaryCard({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
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

function Banner({ tone, message }: { tone: 'success' | 'error' | 'info'; message: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{message}</div>
}

function LoadAlerts(props: {
  alerts: Array<{
    title: string
    description: string
  }>
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">일부 평가 근거를 불러오지 못해 기본 결과 화면으로 표시 중입니다.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
        {props.alerts.map((alert) => (
          <li key={`${alert.title}:${alert.description}`}>
            {alert.title} {alert.description}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SelectorCard({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function ActionChecklistRow({
  label,
  done,
  pending,
  action,
  href,
  onClick,
  disabledReason,
}: {
  label: string
  done: boolean
  pending?: boolean
  action: string
  href?: string
  onClick?: () => void
  disabledReason?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-3">
      <div className="font-medium">{label}</div>
      {href ? (
        <Link href={href} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">{action}</Link>
      ) : (
        <button type="button" onClick={onClick} disabled={pending || !onClick} title={disabledReason} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{done ? '완료' : action}</button>
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
      <div className="mt-3 h-3 rounded-full bg-slate-200"><div className="h-3 rounded-full bg-slate-900" style={{ width: `${percentage}%` }} /></div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-xl font-semibold text-slate-900">{value}</div></div> }

function HighlightCard({ title, summary, tone }: { title: string; summary: string; tone: 'positive' | 'neutral' | 'attention' }) {
  const toneClass = tone === 'positive' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : tone === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-800'
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="font-semibold">{title}</div><p className="mt-2 text-sm leading-6">{summary}</p></div>
}

function ListPanel({ tone, items }: { tone: 'positive' | 'neutral' | 'attention'; items: string[] }) {
  const toneClass = tone === 'positive' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : tone === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-800'
  return <div className={`rounded-2xl border p-4 ${toneClass}`}><div className="space-y-2 text-sm">{items.map((item) => <div key={item} className="flex gap-2"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0" /><span>{item}</span></div>)}</div></div>
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) { return <div><div className="mb-3 text-sm font-semibold text-slate-900">{title}</div><div className="space-y-3">{children}</div></div> }

function TimelineItem({ title, description, meta }: { title: string; description: string; meta?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between"><div className="font-medium text-slate-900">{title}</div>{meta ? <div className="text-xs text-slate-500">{meta}</div> : null}</div><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>
}

function ActionButton({ icon, label, onClick, disabled, title }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} title={title} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">{icon}{label}</button>
}

function ActionLink({ icon, label, href, description }: { icon: React.ReactNode; label: string; href: string; description: string }) {
  return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900">{icon}{label}<ArrowRight className="ml-auto h-4 w-4 text-slate-400" /></div><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></Link>
}

function StatePanel({ state, message }: { state: EvaluationResultPageData['state']; message?: string }) {
  const config = state === 'unpublished' ? { title: '아직 결과가 공개되지 않았습니다.', tone: 'amber' } : state === 'permission-denied' ? { title: '결과를 확인할 권한이 없습니다.', tone: 'rose' } : state === 'error' ? { title: '평가 결과를 불러오지 못했습니다.', tone: 'rose' } : { title: '표시할 결과가 없습니다.', tone: 'slate' }
  const toneClass = config.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : config.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800'
  return <section className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}><div className="text-lg font-semibold">{config.title}</div><p className="mt-2 text-sm leading-6">{message || '현재 상태를 다시 확인해 주세요.'}</p></section>
}

function StatusPill({ status }: { status: EvaluationResultViewModel['cycle']['status'] }) {
  const label = status === 'APPEAL_OPEN' ? '이의 신청 가능' : status === 'APPEAL_CLOSED' ? '이의 신청 마감' : status === 'PUBLISHED' ? '결과 공개' : '비공개'
  const className = status === 'APPEAL_OPEN' ? 'bg-amber-100 text-amber-800' : status === 'APPEAL_CLOSED' ? 'bg-slate-200 text-slate-700' : status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>
}

function InfoPill({ label }: { label: string }) { return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span> }

function MetaLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900">{value}</span></div> }

function InfoGridCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 font-semibold text-slate-900">{value}</div></div> }

function EmptyCard({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center"><div className="font-semibold text-slate-900">{title}</div><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div> }

function RelatedActionLinks() {
  const links = [{ href: '/evaluation/appeal', label: '이의 신청' }, { href: '/evaluation/workbench', label: 'AI 보조 작성' }, { href: '/evaluation/360/results', label: '360 다면평가' }, { href: '/kpi/personal', label: '개인 KPI' }, { href: '/kpi/monthly', label: '월간 실적' }, { href: '/checkin', label: '체크인 일정' }, { href: '/compensation/my', label: '내 보상 결과' }]
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="mb-3 text-lg font-semibold text-slate-900">다음으로 이동할 수 있는 화면</div><div className="flex flex-wrap gap-3">{links.map((link) => <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">{link.label}</Link>)}</div></section>
}

function formatDateTime(value?: string) {
  if (!value) return '미정'
  return new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatMetric(value?: number, unit?: string) {
  if (value === undefined) return '미집계'
  return `${value}${unit ? ` ${unit}` : ''}`
}
