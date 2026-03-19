'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileSearch,
  Layers3,
  Lock,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Unlock,
  Users,
} from 'lucide-react'
import type {
  CalibrationCandidate,
  CalibrationPageData,
  CalibrationStatus,
  CalibrationViewModel,
} from '@/server/evaluation-calibration'

type EvaluationCalibrationClientProps = CalibrationPageData
type CalibrationTab = 'distribution' | 'candidates' | 'history' | 'lock' | 'policy'
type CandidateEditState = {
  gradeId: string
  reason: string
}

const TAB_LABELS: Record<CalibrationTab, string> = {
  distribution: '분포 현황',
  candidates: '조정 대상',
  history: '조정 이력',
  lock: '잠금/확정',
  policy: '정책 안내',
}

export function EvaluationCalibrationClient(props: EvaluationCalibrationClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<CalibrationTab>('distribution')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [jobGroupFilter, setJobGroupFilter] = useState('all')
  const [originalGradeFilter, setOriginalGradeFilter] = useState('all')
  const [adjustedGradeFilter, setAdjustedGradeFilter] = useState('all')
  const [adjustmentFilter, setAdjustmentFilter] = useState<'all' | 'adjusted' | 'pending'>('all')
  const [missingReasonOnly, setMissingReasonOnly] = useState(false)
  const [draftEdits, setDraftEdits] = useState<Record<string, CandidateEditState>>({})

  const viewModel = props.viewModel
  const cycleOptions = props.availableCycles
  const selectedCycle = cycleOptions.find((cycle) => cycle.id === props.selectedCycleId) ?? cycleOptions[0]
  const availableYears = useMemo(
    () => Array.from(new Set(cycleOptions.map((cycle) => cycle.year))).sort((a, b) => b - a),
    [cycleOptions]
  )

  useEffect(() => {
    if (!viewModel) return
    setDepartmentFilter(viewModel.cycle.selectedScopeId)
    setSelectedCandidateId(viewModel.candidates[0]?.id ?? '')
    setDraftEdits({})
  }, [viewModel])

  const filteredCandidates = useMemo(() => {
    if (!viewModel) return []

    return viewModel.candidates.filter((candidate) => {
      if (departmentFilter !== 'all' && candidate.departmentId !== departmentFilter) return false
      if (jobGroupFilter !== 'all' && candidate.jobGroup !== jobGroupFilter) return false
      if (originalGradeFilter !== 'all' && candidate.originalGrade !== originalGradeFilter) return false

      const effectiveAdjustedGrade =
        draftEdits[candidate.id]?.gradeId
          ? viewModel.gradeOptions.find((grade) => grade.id === draftEdits[candidate.id]?.gradeId)?.grade
          : candidate.adjustedGrade ?? candidate.originalGrade

      if (adjustedGradeFilter !== 'all' && effectiveAdjustedGrade !== adjustedGradeFilter) return false
      if (adjustmentFilter === 'adjusted' && !candidate.adjusted) return false
      if (adjustmentFilter === 'pending' && !candidate.needsAttention) return false
      if (missingReasonOnly && !candidate.reasonMissing) return false
      return true
    })
  }, [
    adjustmentFilter,
    adjustedGradeFilter,
    departmentFilter,
    draftEdits,
    jobGroupFilter,
    missingReasonOnly,
    originalGradeFilter,
    viewModel,
  ])

  useEffect(() => {
    if (!filteredCandidates.length) return
    if (!filteredCandidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(filteredCandidates[0].id)
    }
  }, [filteredCandidates, selectedCandidateId])

  const selectedCandidate =
    filteredCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    viewModel?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    filteredCandidates[0] ??
    viewModel?.candidates[0] ??
    null

  const unsavedCount = Object.keys(draftEdits).length
  const isLocked = viewModel?.cycle.status === 'FINAL_LOCKED'
  const canLock = viewModel?.actorRole === 'ROLE_CEO'

  function handleYearChange(year: number) {
    const nextCycle = cycleOptions.find((cycle) => cycle.year === year)
    if (!nextCycle) return
    router.push(`/evaluation/ceo-adjust?cycleId=${encodeURIComponent(nextCycle.id)}`)
  }

  function handleCycleChange(cycleId: string) {
    const query = new URLSearchParams()
    query.set('cycleId', cycleId)
    if (departmentFilter !== 'all') query.set('scope', departmentFilter)
    router.push(`/evaluation/ceo-adjust?${query.toString()}`)
  }

  function handleScopeChange(scopeId: string) {
    setDepartmentFilter(scopeId)
    if (!viewModel) return
    const query = new URLSearchParams()
    query.set('cycleId', viewModel.cycle.id)
    if (scopeId !== 'all') query.set('scope', scopeId)
    router.push(`/evaluation/ceo-adjust?${query.toString()}`)
  }

  function updateCandidateEdit(candidateId: string, next: Partial<CandidateEditState>) {
    const candidate = viewModel?.candidates.find((item) => item.id === candidateId)
    if (!candidate || !viewModel) return
    const defaultGrade =
      viewModel.gradeOptions.find((grade) => grade.grade === (candidate.adjustedGrade ?? candidate.originalGrade)) ??
      viewModel.gradeOptions[0]
    const current = draftEdits[candidateId] ?? {
      gradeId: defaultGrade?.id ?? '',
      reason: candidate.reason ?? '',
    }

    setDraftEdits((currentState) => ({
      ...currentState,
      [candidateId]: { ...current, ...next },
    }))
  }

  async function handleSaveCandidate(candidateId: string) {
    if (!viewModel) return
    const candidate = viewModel.candidates.find((item) => item.id === candidateId)
    const draft = draftEdits[candidateId]
    if (!candidate || !draft) return

    setIsSubmitting(true)
    try {
      await fetch('/api/evaluation/calibration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          cycleId: viewModel.cycle.id,
          targetId: candidate.id,
          gradeId: draft.gradeId,
          adjustReason: draft.reason,
        }),
      }).then(assertJsonSuccess)

      setDraftEdits((currentState) => {
        const nextState = { ...currentState }
        delete nextState[candidateId]
        return nextState
      })
      setNotice(`${candidate.employeeName}님의 조정안을 저장했습니다.`)
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '조정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveAll() {
    const candidateIds = Object.keys(draftEdits)
    if (!candidateIds.length) {
      setNotice('저장할 변경사항이 없습니다.')
      return
    }

    setIsSubmitting(true)
    try {
      for (const candidateId of candidateIds) {
        const candidate = viewModel?.candidates.find((item) => item.id === candidateId)
        const draft = draftEdits[candidateId]
        if (!candidate || !draft) continue

        await fetch('/api/evaluation/calibration', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            cycleId: viewModel?.cycle.id,
            targetId: candidate.id,
            gradeId: draft.gradeId,
            adjustReason: draft.reason,
          }),
        }).then(assertJsonSuccess)
      }

      setDraftEdits({})
      setNotice(`${candidateIds.length}건의 조정안을 저장했습니다.`)
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '일괄 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleClearAdjustment(candidateId: string) {
    if (!viewModel) return
    const candidate = viewModel.candidates.find((item) => item.id === candidateId)
    if (!candidate) return

    setIsSubmitting(true)
    try {
      await fetch('/api/evaluation/calibration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          cycleId: viewModel.cycle.id,
          targetId: candidate.id,
        }),
      }).then(assertJsonSuccess)

      setDraftEdits((currentState) => {
        const nextState = { ...currentState }
        delete nextState[candidateId]
        return nextState
      })
      setNotice(`${candidate.employeeName}님의 조정안을 해제했습니다.`)
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '조정 해제 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleWorkflow(action: 'CONFIRM_REVIEW' | 'LOCK' | 'REOPEN_REQUEST') {
    if (!viewModel) return

    setIsSubmitting(true)
    try {
      await fetch('/api/evaluation/calibration/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: viewModel.cycle.id,
          action,
        }),
      }).then(assertJsonSuccess)

      setNotice(
        action === 'CONFIRM_REVIEW'
          ? '리뷰 확정 상태로 전환했습니다.'
          : action === 'LOCK'
            ? '최종 잠금을 완료했습니다.'
            : '재오픈 요청을 등록했습니다.'
      )
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '워크플로 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (props.state !== 'ready' || !viewModel) {
    return (
      <div className="space-y-6">
        <PageHeader selectedCycle={selectedCycle} />
        <CalibrationStatePanel state={props.state} message={props.message} />
        <RelatedLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader selectedCycle={selectedCycle} />
      <CalibrationHero
        viewModel={viewModel}
        cycleOptions={cycleOptions}
        availableYears={availableYears}
        unsavedCount={unsavedCount}
        isSubmitting={isSubmitting}
        canLock={canLock}
        onYearChange={handleYearChange}
        onCycleChange={handleCycleChange}
        onScopeChange={handleScopeChange}
        onSaveAll={handleSaveAll}
        onLock={() => handleWorkflow('LOCK')}
        onReopen={() => handleWorkflow('REOPEN_REQUEST')}
      />

      {notice ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      ) : null}

      <SummaryCards viewModel={viewModel} />
      <Tabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'distribution' ? (
        <DistributionOverviewSection
          viewModel={viewModel}
          onPickDepartment={(departmentId) => {
            setActiveTab('candidates')
            setDepartmentFilter(departmentId)
            setSelectedCandidateId(
              viewModel.candidates.find((candidate) => candidate.departmentId === departmentId)?.id ?? ''
            )
          }}
          onPickGrade={(grade) => {
            setActiveTab('candidates')
            setAdjustedGradeFilter(grade)
          }}
        />
      ) : null}

      {activeTab === 'candidates' ? (
        <CalibrationCandidatesSection
          viewModel={viewModel}
          candidates={filteredCandidates}
          selectedCandidate={selectedCandidate}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          jobGroupFilter={jobGroupFilter}
          setJobGroupFilter={setJobGroupFilter}
          originalGradeFilter={originalGradeFilter}
          setOriginalGradeFilter={setOriginalGradeFilter}
          adjustedGradeFilter={adjustedGradeFilter}
          setAdjustedGradeFilter={setAdjustedGradeFilter}
          adjustmentFilter={adjustmentFilter}
          setAdjustmentFilter={setAdjustmentFilter}
          missingReasonOnly={missingReasonOnly}
          setMissingReasonOnly={setMissingReasonOnly}
          onSelectCandidate={setSelectedCandidateId}
          getDraft={(candidate) => getCandidateDraft(viewModel, draftEdits, candidate)}
          onDraftChange={updateCandidateEdit}
          onSaveCandidate={handleSaveCandidate}
          onClearAdjustment={handleClearAdjustment}
          readOnly={Boolean(isLocked)}
          isSubmitting={isSubmitting}
        />
      ) : null}

      {activeTab === 'history' ? <CalibrationTimelineSection viewModel={viewModel} /> : null}
      {activeTab === 'lock' ? (
        <CalibrationLockSection
          viewModel={viewModel}
          canLock={canLock}
          isSubmitting={isSubmitting}
          onConfirmReview={() => handleWorkflow('CONFIRM_REVIEW')}
          onLock={() => handleWorkflow('LOCK')}
          onReopen={() => handleWorkflow('REOPEN_REQUEST')}
        />
      ) : null}
      {activeTab === 'policy' ? <CalibrationPolicySection /> : null}
    </div>
  )
}

function PageHeader({
  selectedCycle,
}: {
  selectedCycle?: EvaluationCalibrationClientProps['availableCycles'][number]
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
            Calibration Workbench
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">등급 조정</h1>
          <p className="mt-2 text-sm text-slate-500">
            조직별 분포를 먼저 보고, 후보를 조정하고, 사유를 남기고, 최종 잠금까지 연결하는 캘리브레이션 운영
            화면입니다.
          </p>
        </div>
        {selectedCycle ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            현재 주기: <span className="font-semibold text-slate-900">{selectedCycle.name}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function CalibrationHero({
  viewModel,
  cycleOptions,
  availableYears,
  unsavedCount,
  isSubmitting,
  canLock,
  onYearChange,
  onCycleChange,
  onScopeChange,
  onSaveAll,
  onLock,
  onReopen,
}: {
  viewModel: CalibrationViewModel
  cycleOptions: EvaluationCalibrationClientProps['availableCycles']
  availableYears: number[]
  unsavedCount: number
  isSubmitting: boolean
  canLock: boolean
  onYearChange: (year: number) => void
  onCycleChange: (cycleId: string) => void
  onScopeChange: (scopeId: string) => void
  onSaveAll: () => void
  onLock: () => void
  onReopen: () => void
}) {
  const sameYearCycles = cycleOptions.filter((cycle) => cycle.year === viewModel.cycle.year)

  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectorCard
              label="연도"
              value={String(viewModel.cycle.year)}
              options={availableYears.map((year) => ({ value: String(year), label: `${year}년` }))}
              onChange={(value) => onYearChange(Number(value))}
            />
            <SelectorCard
              label="평가 주기"
              value={viewModel.cycle.id}
              options={sameYearCycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
              onChange={onCycleChange}
            />
            <SelectorCard
              label="조직 범위"
              value={viewModel.cycle.selectedScopeId}
              options={viewModel.scopeOptions.map((scope) => ({ value: scope.id, label: scope.label }))}
              onChange={onScopeChange}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={viewModel.cycle.status} />
            <InfoBadge label={viewModel.cycle.lockedAt ? `잠금일 ${formatDateTime(viewModel.cycle.lockedAt)}` : '편집 가능'} />
            <InfoBadge label={`조정 대상 ${viewModel.summary.pendingCount}명`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="최종 잠금 여부" value={viewModel.cycle.status === 'FINAL_LOCKED' ? '잠금됨' : '미잠금'} emphasis />
            <HeroMetric label="조정 대상 인원 수" value={`${viewModel.summary.pendingCount}명`} />
            <HeroMetric label="조정 건수" value={`${viewModel.summary.adjustedCount}건`} />
            <HeroMetric label="조정률" value={`${viewModel.summary.adjustedRate.toFixed(1)}%`} />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActionButton
            icon={<Save className="h-4 w-4" />}
            label={unsavedCount > 0 ? `변경 저장 (${unsavedCount})` : '변경 저장'}
            onClick={onSaveAll}
            disabled={isSubmitting || unsavedCount === 0 || viewModel.cycle.status === 'FINAL_LOCKED'}
            variant="primary"
          />
          <ActionButton
            icon={<Lock className="h-4 w-4" />}
            label="잠금"
            onClick={onLock}
            disabled={isSubmitting || !canLock || viewModel.cycle.status === 'FINAL_LOCKED'}
          />
          <ActionButton
            icon={<Unlock className="h-4 w-4" />}
            label="재오픈 요청"
            onClick={onReopen}
            disabled={isSubmitting || ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(viewModel.cycle.rawStatus)}
          />
          <ActionLink
            icon={<FileSearch className="h-4 w-4" />}
            label="결과 보기"
            href="/evaluation/results"
            description="최종 결과 리포트에서 조정 전후 설명 흐름을 다시 확인합니다."
          />
        </div>
      </div>
    </section>
  )
}

function SummaryCards({ viewModel }: { viewModel: CalibrationViewModel }) {
  const nextAction =
    viewModel.checklist.missingReasonCount > 0
      ? '사유 누락 건 처리'
      : viewModel.checklist.unresolvedCandidateCount > 0
        ? '미조정 후보 검토'
        : viewModel.cycle.status === 'FINAL_LOCKED'
          ? '잠금 상태 확인'
          : '잠금 전 필수 확인'

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <SummaryCard icon={<Users className="h-5 w-5" />} label="전체 인원 수" value={`${viewModel.summary.totalCount}명`} description="현재 범위 기준 최종 평가 완료 인원" />
      <SummaryCard icon={<SlidersHorizontal className="h-5 w-5" />} label="조정 대상 수" value={`${viewModel.summary.pendingCount}명`} description="검토 우선순위가 높은 후보" />
      <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="조정 완료 수" value={`${viewModel.summary.adjustedCount}명`} description="사유와 함께 저장된 조정" />
      <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="상위 등급 비율" value={`${viewModel.summary.highGradeRatio.toFixed(1)}%`} description="S/A 등급 비중" />
      <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="하위 등급 비율" value={`${viewModel.summary.lowGradeRatio.toFixed(1)}%`} description="C/D 등급 비중" />
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-blue-800">
          <Clock3 className="h-5 w-5" />
          <span className="text-sm font-semibold">다음 행동</span>
        </div>
        <div className="mt-3 text-lg font-semibold text-blue-900">{nextAction}</div>
        <div className="mt-2 text-sm leading-6 text-blue-900/80">
          사유 누락 {viewModel.checklist.missingReasonCount}건 · 편차 조직 {viewModel.summary.outlierOrgCount ?? 0}개
        </div>
      </div>
    </section>
  )
}

function Tabs({
  activeTab,
  onChange,
}: {
  activeTab: CalibrationTab
  onChange: (tab: CalibrationTab) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {(Object.keys(TAB_LABELS) as CalibrationTab[]).map((tab) => (
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

function DistributionOverviewSection({
  viewModel,
  onPickDepartment,
  onPickGrade,
}: {
  viewModel: CalibrationViewModel
  onPickDepartment: (departmentId: string) => void
  onPickGrade: (grade: string) => void
}) {
  const companyChartData = viewModel.distributions.company.map((item) => ({
    grade: item.grade,
    actual: item.ratio,
    target: item.targetRatio ?? 0,
  }))

  return (
    <div className="space-y-6">
      <SectionCard title="전사 등급 분포" description="기준 분포와 실제 분포를 비교해 편차가 큰 등급 구간을 먼저 확인합니다.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="actual" radius={[8, 8, 0, 0]} fill="#0f172a" name="실제 비중" />
                <Bar dataKey="target" radius={[8, 8, 0, 0]} fill="#93c5fd" name="기준 비중" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-3">
            {viewModel.distributions.company.map((grade) => (
              <button
                key={grade.grade}
                type="button"
                onClick={() => onPickGrade(grade.grade)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{grade.grade}</div>
                  <GradeDeltaBadge delta={(grade.ratio - (grade.targetRatio ?? grade.ratio)).toFixed(1)} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <MiniMetric label="인원" value={`${grade.count}명`} />
                  <MiniMetric label="실제" value={`${grade.ratio.toFixed(1)}%`} />
                  <MiniMetric label="기준" value={`${(grade.targetRatio ?? 0).toFixed(1)}%`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="조직별 등급 분포" description="편차가 큰 조직을 선택해 바로 후보 테이블로 내려갈 수 있습니다.">
          <div className="space-y-3">
            {viewModel.distributions.byDepartment.map((department) => (
              <button
                key={department.departmentId}
                type="button"
                onClick={() => onPickDepartment(department.departmentId)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{department.department}</span>
                      {department.isOutlier ? <WarningBadge label="편차 주의" /> : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      총 {department.totalCount}명 · 기준 분포 대비 편차 {department.deltaScore.toFixed(1)}pt
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">후보 보기</div>
                </div>
                <div className="mt-4">
                  <SegmentedDistribution grades={department.grades} />
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="직군별 분포" description="직군 기준 편차도 함께 보면서 조정 필요성이 몰린 구간을 파악합니다.">
          <div className="space-y-3">
            {viewModel.distributions.byJobGroup.map((jobGroup) => (
              <div key={jobGroup.jobGroup} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{jobGroup.jobGroup}</div>
                  <div className="text-xs text-slate-500">총 {jobGroup.totalCount}명</div>
                </div>
                <div className="mt-3">
                  <SegmentedDistribution grades={jobGroup.grades} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function CalibrationCandidatesSection({
  viewModel,
  candidates,
  selectedCandidate,
  departmentFilter,
  setDepartmentFilter,
  jobGroupFilter,
  setJobGroupFilter,
  originalGradeFilter,
  setOriginalGradeFilter,
  adjustedGradeFilter,
  setAdjustedGradeFilter,
  adjustmentFilter,
  setAdjustmentFilter,
  missingReasonOnly,
  setMissingReasonOnly,
  onSelectCandidate,
  getDraft,
  onDraftChange,
  onSaveCandidate,
  onClearAdjustment,
  readOnly,
  isSubmitting,
}: {
  viewModel: CalibrationViewModel
  candidates: CalibrationCandidate[]
  selectedCandidate: CalibrationCandidate | null
  departmentFilter: string
  setDepartmentFilter: (value: string) => void
  jobGroupFilter: string
  setJobGroupFilter: (value: string) => void
  originalGradeFilter: string
  setOriginalGradeFilter: (value: string) => void
  adjustedGradeFilter: string
  setAdjustedGradeFilter: (value: string) => void
  adjustmentFilter: 'all' | 'adjusted' | 'pending'
  setAdjustmentFilter: (value: 'all' | 'adjusted' | 'pending') => void
  missingReasonOnly: boolean
  setMissingReasonOnly: (value: boolean) => void
  onSelectCandidate: (candidateId: string) => void
  getDraft: (candidate: CalibrationCandidate) => CandidateEditState
  onDraftChange: (candidateId: string, next: Partial<CandidateEditState>) => void
  onSaveCandidate: (candidateId: string) => void
  onClearAdjustment: (candidateId: string) => void
  readOnly: boolean
  isSubmitting: boolean
}) {
  const departmentOptions = [
    { value: 'all', label: '전체 조직' },
    ...viewModel.scopeOptions.filter((scope) => scope.id !== 'all').map((scope) => ({
      value: scope.id,
      label: scope.label,
    })),
  ]
  const jobGroups = Array.from(new Set(viewModel.candidates.map((candidate) => candidate.jobGroup).filter(Boolean)))
  const originalGrades = Array.from(new Set(viewModel.candidates.map((candidate) => candidate.originalGrade)))
  const adjustedGrades = viewModel.gradeOptions.map((grade) => grade.grade)

  return (
    <div className="space-y-6">
      <SectionCard title="조정 대상 필터" description="조직, 직군, 원등급, 조정등급, 사유 누락 여부로 후보군을 빠르게 좁힙니다.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SelectorCard label="조직" value={departmentFilter} options={departmentOptions} onChange={setDepartmentFilter} />
          <SelectorCard
            label="직군"
            value={jobGroupFilter}
            options={[{ value: 'all', label: '전체 직군' }, ...jobGroups.map((jobGroup) => ({ value: jobGroup ?? '', label: jobGroup ?? '' }))]}
            onChange={setJobGroupFilter}
          />
          <SelectorCard
            label="원등급"
            value={originalGradeFilter}
            options={[{ value: 'all', label: '전체 원등급' }, ...originalGrades.map((grade) => ({ value: grade, label: grade }))]}
            onChange={setOriginalGradeFilter}
          />
          <SelectorCard
            label="조정등급"
            value={adjustedGradeFilter}
            options={[{ value: 'all', label: '전체 조정등급' }, ...adjustedGrades.map((grade) => ({ value: grade, label: grade }))]}
            onChange={setAdjustedGradeFilter}
          />
          <SelectorCard
            label="조정 여부"
            value={adjustmentFilter}
            options={[
              { value: 'all', label: '전체' },
              { value: 'adjusted', label: '조정됨' },
              { value: 'pending', label: '검토 필요' },
            ]}
            onChange={(value) => setAdjustmentFilter(value as 'all' | 'adjusted' | 'pending')}
          />
          <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">사유 누락</span>
            <div className="mt-3 flex min-h-11 items-center justify-between rounded-xl border border-gray-300 px-4 py-3">
              <span className="text-sm text-slate-700">사유 누락만 보기</span>
              <input
                type="checkbox"
                checked={missingReasonOnly}
                onChange={(event) => setMissingReasonOnly(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
          </label>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <SectionCard
          title="조정 대상 목록"
          description={`총 ${candidates.length}명의 후보를 표시합니다. 후보를 선택하면 우측에서 근거와 사유를 함께 관리할 수 있습니다.`}
        >
          {candidates.length ? (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">이름</th>
                      <th className="px-4 py-3 font-medium">부서</th>
                      <th className="px-4 py-3 font-medium">원점수</th>
                      <th className="px-4 py-3 font-medium">원등급</th>
                      <th className="px-4 py-3 font-medium">조정등급</th>
                      <th className="px-4 py-3 font-medium">조정 여부</th>
                      <th className="px-4 py-3 font-medium">사유 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {candidates.map((candidate) => {
                      const draft = getDraft(candidate)
                      const draftGrade =
                        viewModel.gradeOptions.find((grade) => grade.id === draft.gradeId)?.grade ??
                        candidate.adjustedGrade ??
                        candidate.originalGrade

                      return (
                        <tr
                          key={candidate.id}
                          className={`cursor-pointer transition hover:bg-slate-50 ${
                            selectedCandidate?.id === candidate.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => onSelectCandidate(candidate.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{candidate.employeeName}</div>
                            <div className="text-xs text-slate-500">{candidate.employeeId}</div>
                          </td>
                          <td className="px-4 py-3">{candidate.department}</td>
                          <td className="px-4 py-3">{candidate.rawScore.toFixed(1)}</td>
                          <td className="px-4 py-3">{candidate.originalGrade}</td>
                          <td className="px-4 py-3">{draftGrade}</td>
                          <td className="px-4 py-3">
                            {candidate.adjusted ? (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                조정됨
                              </span>
                            ) : candidate.needsAttention ? (
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                검토 필요
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                유지 가능
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {candidate.reasonMissing ? (
                              <WarningBadge label="사유 누락" />
                            ) : (
                              <span className="text-slate-500">{candidate.reason ? '입력됨' : '미입력'}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 lg:hidden">
                {candidates.map((candidate) => {
                  const draft = getDraft(candidate)
                  const draftGrade =
                    viewModel.gradeOptions.find((grade) => grade.id === draft.gradeId)?.grade ??
                    candidate.adjustedGrade ??
                    candidate.originalGrade

                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => onSelectCandidate(candidate.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedCandidate?.id === candidate.id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{candidate.employeeName}</div>
                          <div className="text-xs text-slate-500">
                            {candidate.department} · {candidate.jobGroup}
                          </div>
                        </div>
                        {candidate.needsAttention ? <WarningBadge label="검토 필요" /> : null}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <MiniMetric label="원점수" value={candidate.rawScore.toFixed(1)} />
                        <MiniMetric label="원등급" value={candidate.originalGrade} />
                        <MiniMetric label="조정등급" value={draftGrade} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <EmptyCard title="조건에 맞는 조정 대상이 없습니다" description="필터를 완화하거나 분포 현황 탭에서 다른 조직/등급을 선택해 주세요." />
          )}
        </SectionCard>

        {selectedCandidate ? (
          <CandidateDetailPanel
            candidate={selectedCandidate}
            draft={getDraft(selectedCandidate)}
            gradeOptions={viewModel.gradeOptions}
            onDraftChange={onDraftChange}
            onSaveCandidate={onSaveCandidate}
            onClearAdjustment={onClearAdjustment}
            readOnly={readOnly}
            isSubmitting={isSubmitting}
          />
        ) : null}
      </div>
    </div>
  )
}

function CandidateDetailPanel({
  candidate,
  draft,
  gradeOptions,
  onDraftChange,
  onSaveCandidate,
  onClearAdjustment,
  readOnly,
  isSubmitting,
}: {
  candidate: CalibrationCandidate
  draft: CandidateEditState
  gradeOptions: CalibrationViewModel['gradeOptions']
  onDraftChange: (candidateId: string, next: Partial<CandidateEditState>) => void
  onSaveCandidate: (candidateId: string) => void
  onClearAdjustment: (candidateId: string) => void
  readOnly: boolean
  isSubmitting: boolean
}) {
  const selectedGradeLabel =
    gradeOptions.find((grade) => grade.id === draft.gradeId)?.grade ?? candidate.adjustedGrade ?? candidate.originalGrade

  return (
    <SectionCard title="후보 상세" description="조정 전후 비교, 평가 코멘트, 월간 실적 근거를 함께 보면서 사유를 입력합니다.">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-slate-900">{candidate.employeeName}</div>
              <div className="text-sm text-slate-500">
                {candidate.department} · {candidate.jobGroup} · 평가자 {candidate.evaluatorName ?? '미지정'}
              </div>
            </div>
            {candidate.needsAttention ? <WarningBadge label="검토 우선" /> : <InfoBadge label="안정 구간" />}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MiniMetric label="원점수" value={candidate.rawScore.toFixed(1)} />
            <MiniMetric label="성과 점수" value={candidate.performanceScore?.toFixed(1) ?? '-'} />
            <MiniMetric label="역량 점수" value={candidate.competencyScore?.toFixed(1) ?? '-'} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <CompareCard title="원등급" value={candidate.originalGrade} tone="neutral" />
          <CompareCard title="조정등급" value={selectedGradeLabel} tone={candidate.originalGrade === selectedGradeLabel ? 'neutral' : 'attention'} />
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <FieldLabel>조정 등급</FieldLabel>
            <select
              value={draft.gradeId}
              onChange={(event) => onDraftChange(candidate.id, { gradeId: event.target.value })}
              disabled={readOnly}
              className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-slate-900"
            >
              {gradeOptions.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.grade} {grade.targetRatio !== undefined ? `(기준 ${grade.targetRatio.toFixed(1)}%)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>조정 사유</FieldLabel>
            <textarea
              value={draft.reason}
              onChange={(event) => onDraftChange(candidate.id, { reason: event.target.value })}
              disabled={readOnly}
              className="min-h-36 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-slate-900"
              placeholder={candidate.suggestedReason}
            />
            {candidate.suggestedReason ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">{candidate.suggestedReason}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <ActionButton
              icon={<Save className="h-4 w-4" />}
              label="이 후보 저장"
              onClick={() => onSaveCandidate(candidate.id)}
              disabled={readOnly || isSubmitting}
              variant="primary"
            />
            {candidate.adjusted ? (
              <ActionButton
                icon={<span className="text-base">↺</span>}
                label="조정 해제"
                onClick={() => onClearAdjustment(candidate.id)}
                disabled={readOnly || isSubmitting}
              />
            ) : null}
          </div>
        </div>

        <SubSection title="평가 코멘트">
          <InfoNotice icon={<Layers3 className="h-4 w-4" />} title="최종 평가 코멘트" description={candidate.evaluationComment ?? '최종 평가 코멘트가 없습니다.'} />
          <InfoNotice icon={<BriefcaseBusiness className="h-4 w-4" />} title="상위 평가자 코멘트" description={candidate.reviewerComment ?? '상위 평가자 코멘트가 없습니다.'} />
        </SubSection>

        <SubSection title="월간 실적 / 근거 요약">
          <div className="space-y-3">
            {candidate.kpiSummary.map((kpi) => (
              <div key={kpi.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">{kpi.title}</div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                  <MiniMetric label="목표" value={formatMetric(kpi.target, kpi.unit)} />
                  <MiniMetric label="실적" value={formatMetric(kpi.actual, kpi.unit)} />
                  <MiniMetric label="달성률" value={kpi.achievementRate !== undefined ? `${kpi.achievementRate.toFixed(1)}%` : '-'} />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {candidate.monthlySummary.map((record) => (
              <div key={record.month} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{record.month}</div>
                  <div className="text-sm text-slate-500">
                    {record.achievementRate !== undefined ? `${record.achievementRate.toFixed(1)}%` : '달성률 없음'}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{record.comment ?? '월간 코멘트가 없습니다.'}</p>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title="체크인 / 1:1 요약">
          <div className="space-y-3">
            {candidate.checkins.length ? (
              candidate.checkins.map((checkin, index) => (
                <div key={`${checkin.date}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{formatDateTime(checkin.date)}</div>
                    <div className="text-xs text-slate-500">
                      {checkin.type} / {checkin.status}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{checkin.summary}</p>
                </div>
              ))
            ) : (
              <EmptyCard title="최근 체크인 기록이 없습니다" description="관련 1:1 또는 체크인 기록이 생기면 이곳에 함께 노출됩니다." />
            )}
          </div>
        </SubSection>
      </div>
    </SectionCard>
  )
}

function CalibrationTimelineSection({ viewModel }: { viewModel: CalibrationViewModel }) {
  return (
    <SectionCard title="조정 이력" description="누가, 언제, 누구의 등급을 어떻게 바꿨는지와 잠금/재오픈 이력을 감사 로그 형태로 확인합니다.">
      <div className="space-y-4">
        {viewModel.timeline.length ? (
          viewModel.timeline.map((item, index) => (
            <div key={item.id} className="flex gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                {index + 1}
              </div>
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{item.action}</span>
                    <ActionTypeBadge type={item.actionType} />
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(item.at)}</span>
                </div>
                <div className="mt-1 text-sm text-slate-500">{item.actor}</div>
                {item.employeeName ? <div className="mt-2 text-sm font-medium text-slate-800">대상자: {item.employeeName}</div> : null}
                {(item.fromGrade || item.toGrade) ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <CompareCard title="조정 전" value={item.fromGrade ?? '-'} tone="neutral" />
                    <CompareCard title="조정 후" value={item.toGrade ?? '-'} tone="attention" />
                  </div>
                ) : null}
                {item.reason ? <p className="mt-3 text-sm leading-6 text-slate-700">{item.reason}</p> : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyCard title="아직 조정 이력이 없습니다" description="후보를 저장하거나 잠금을 진행하면 이 탭에 이력이 쌓입니다." />
        )}
      </div>
    </SectionCard>
  )
}

function CalibrationLockSection({
  viewModel,
  canLock,
  isSubmitting,
  onConfirmReview,
  onLock,
  onReopen,
}: {
  viewModel: CalibrationViewModel
  canLock: boolean
  isSubmitting: boolean
  onConfirmReview: () => void
  onLock: () => void
  onReopen: () => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="잠금 전 체크리스트" description="사유 누락, 미검토 후보, 분포 검토 여부를 확인한 뒤 최종 잠금을 진행합니다.">
        <div className="space-y-3">
          <ChecklistRow label="사유 누락 없음" done={viewModel.checklist.missingReasonCount === 0} hint={viewModel.checklist.missingReasonCount > 0 ? `${viewModel.checklist.missingReasonCount}건 남음` : '모든 조정 건에 사유가 있습니다.'} />
          <ChecklistRow label="미검토 후보 없음" done={viewModel.checklist.unresolvedCandidateCount === 0} hint={viewModel.checklist.unresolvedCandidateCount > 0 ? `${viewModel.checklist.unresolvedCandidateCount}명 검토 필요` : '검토 우선 후보가 남아 있지 않습니다.'} />
          <ChecklistRow label="기준 분포 검토 완료" done={viewModel.cycle.status === 'REVIEW_CONFIRMED' || viewModel.cycle.status === 'FINAL_LOCKED'} hint={viewModel.cycle.status === 'REVIEW_CONFIRMED' || viewModel.cycle.status === 'FINAL_LOCKED' ? '리뷰 확정 상태입니다.' : '리뷰 확정 버튼으로 잠금 전 검토 완료를 남겨 주세요.'} />
          <ChecklistRow label="관련 승인자 확인" done={viewModel.actorRole === 'ROLE_CEO'} hint={viewModel.actorRole === 'ROLE_CEO' ? '현재 계정은 최종 잠금 권한이 있습니다.' : 'CEO 계정에서 최종 잠금을 진행해야 합니다.'} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ActionInfoCard title="잠금 후 영향" items={['평가 결과 공개에 반영', '보상 시뮬레이션 기준 확정', '등급 조정 수정 제한']} />
          <ActionInfoCard title="현재 상태" items={[viewModel.cycle.status === 'FINAL_LOCKED' ? '최종 잠금 완료' : '아직 잠금 전', viewModel.cycle.lockedAt ? `잠금 시각 ${formatDateTime(viewModel.cycle.lockedAt)}` : '잠금 기록 없음']} />
        </div>
      </SectionCard>

      <SectionCard title="잠금 / 재오픈 액션" description="리뷰 확정, 최종 잠금, 재오픈 요청을 현재 단계에 맞춰 실행합니다.">
        <div className="space-y-4">
          <ActionButton icon={<CheckCircle2 className="h-4 w-4" />} label="리뷰 확정" onClick={onConfirmReview} disabled={isSubmitting || viewModel.cycle.status === 'FINAL_LOCKED'} variant="primary" />
          <ActionButton icon={<Lock className="h-4 w-4" />} label="최종 잠금" onClick={onLock} disabled={isSubmitting || !canLock || !viewModel.checklist.readyToLock || viewModel.cycle.status === 'FINAL_LOCKED'} />
          <ActionButton icon={<Unlock className="h-4 w-4" />} label="재오픈 요청" onClick={onReopen} disabled={isSubmitting || ['RESULT_OPEN', 'APPEAL', 'CLOSED'].includes(viewModel.cycle.rawStatus)} />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {viewModel.cycle.status === 'FINAL_LOCKED'
              ? '최종 잠금 이후에는 읽기 전용 상태로 전환됩니다. 재오픈 요청 이력을 통해서만 후속 수정이 가능합니다.'
              : '잠금 전에는 분포 현황과 후보 사유를 모두 점검한 뒤 최종 잠금을 진행해 주세요.'}
          </div>

          <div className="grid gap-3">
            <ActionLink icon={<FileSearch className="h-4 w-4" />} label="평가 결과 보기" href="/evaluation/results" description="조정 반영 이후 결과 리포트를 다시 확인합니다." />
            <ActionLink icon={<Sparkles className="h-4 w-4" />} label="보상 시뮬레이션 확인" href="/compensation/manage" description="조정 등급이 보상 시뮬레이션에 미치는 영향을 확인합니다." />
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function CalibrationPolicySection() {
  const faqs = [
    {
      question: '캘리브레이션의 목적은 무엇인가요?',
      answer: '조직 간 점수와 등급 편차를 조정해 평가의 공정성과 설명 가능성을 높이는 단계입니다.',
    },
    {
      question: '조정 사유는 어느 정도로 남겨야 하나요?',
      answer: '최소 30자 이상으로, 성과/역량/분포/상대비교 관점에서 왜 조정했는지 설명 가능하게 남겨야 합니다.',
    },
    {
      question: '잠금 이후에는 무엇이 달라지나요?',
      answer: '결과 공개와 보상 연동의 기준점이 확정되며, 페이지는 읽기 전용 상태에 가깝게 전환됩니다.',
    },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="캘리브레이션 정책 안내" description="운영자가 같은 원칙으로 조정할 수 있도록 목적과 예외 처리 기준을 정리했습니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <PolicyCard title="캘리브레이션 목적" description="평가 기준의 일관성과 조직 간 형평성을 확보하기 위해 최종 등급 분포와 개별 후보를 함께 검토합니다." />
          <PolicyCard title="조정 원칙" description="성과/역량/근거 자료/조직 분포를 함께 보되, 단순 인상이나 임의 조정은 허용하지 않습니다." />
          <PolicyCard title="사유 기록 원칙" description="모든 조정에는 대상자, 전/후 등급, 구체적 이유가 남아야 하며 감사 로그로 추적 가능해야 합니다." />
          <PolicyCard title="예외 조직 처리" description="인원이 적거나 역할 특성이 다른 조직은 편차 경고를 참고하되, 맥락을 남겨 예외 처리할 수 있습니다." />
          <PolicyCard title="잠금 이후 정책" description="잠금 후에는 수정이 제한되며, 재오픈 요청 이력을 통해서만 후속 변경이 가능합니다." />
          <PolicyCard title="연계 화면" description="평가 결과, 평가 주기, 등급 설정, 보상 시뮬레이션 화면과 함께 보면서 운영해 주세요." />
        </div>
      </SectionCard>

      <SectionCard title="FAQ" description="실무 운영에서 자주 나오는 질문을 먼저 확인할 수 있습니다.">
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-900">{faq.question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </SectionCard>
    </div>
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

function HeroMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${emphasis ? 'text-blue-900' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: CalibrationStatus }) {
  const config =
    status === 'READY'
      ? { label: '조정 준비', className: 'bg-slate-100 text-slate-700' }
      : status === 'CALIBRATING'
        ? { label: '조정 중', className: 'bg-blue-100 text-blue-700' }
        : status === 'REVIEW_CONFIRMED'
          ? { label: '리뷰 확정', className: 'bg-violet-100 text-violet-700' }
          : { label: '최종 잠금', className: 'bg-emerald-100 text-emerald-700' }

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>{config.label}</span>
}

function InfoBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span>
}

function WarningBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{label}</span>
}

function GradeDeltaBadge({ delta }: { delta: string }) {
  const numericDelta = Number(delta)
  const className =
    numericDelta > 0
      ? 'bg-rose-100 text-rose-700'
      : numericDelta < 0
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{numericDelta > 0 ? '+' : ''}{numericDelta}pt</span>
}

function SegmentedDistribution({
  grades,
}: {
  grades: Array<{ grade: string; count: number; ratio: number }>
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-200">
        {grades.map((grade) => (
          <div
            key={grade.grade}
            className={getGradeTone(grade.grade)}
            style={{ width: `${Math.max(grade.ratio, 3)}%` }}
            title={`${grade.grade} ${grade.ratio.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {grades.map((grade) => (
          <div key={grade.grade} className="rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-900">{grade.grade}</div>
            <div>
              {grade.count}명 · {grade.ratio.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompareCard({
  title,
  value,
  tone,
}: {
  title: string
  value: string
  tone: 'neutral' | 'attention'
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'attention' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-sm font-semibold text-slate-700">{children}</div>
}

function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {children}
    </div>
  )
}

function InfoNotice({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:opacity-60 ${
        variant === 'primary'
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function ChecklistRow({ label, done, hint }: { label: string; done: boolean; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`h-4 w-4 ${done ? 'text-emerald-600' : 'text-slate-300'}`} />
          <span className="font-medium text-slate-900">{label}</span>
        </div>
        <span className={`text-xs font-semibold ${done ? 'text-emerald-700' : 'text-amber-800'}`}>
          {done ? '완료' : '확인 필요'}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
    </div>
  )
}

function ActionInfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        {items.map((item) => (
          <div key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PolicyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function ActionTypeBadge({
  type,
}: {
  type: CalibrationViewModel['timeline'][number]['actionType']
}) {
  const className =
    type === 'adjust'
      ? 'bg-blue-100 text-blue-700'
      : type === 'lock'
        ? 'bg-emerald-100 text-emerald-700'
        : type === 'reopen'
          ? 'bg-amber-100 text-amber-800'
          : type === 'review'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{type}</span>
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function CalibrationStatePanel({
  state,
  message,
}: {
  state: EvaluationCalibrationClientProps['state']
  message?: string
}) {
  const config =
    state === 'permission-denied'
      ? { title: '등급 조정 화면 접근 권한이 없습니다', tone: 'rose' }
      : state === 'error'
        ? { title: '등급 조정 화면을 불러오지 못했습니다', tone: 'rose' }
        : { title: '표시할 캘리브레이션 데이터가 없습니다', tone: 'slate' }

  const toneClass =
    config.tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <section className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}>
      <div className="text-lg font-semibold">{config.title}</div>
      <p className="mt-2 text-sm leading-6">{message || '현재 상태를 다시 확인해 주세요.'}</p>
    </section>
  )
}

function RelatedLinks() {
  const links = [
    { href: '/evaluation/results', label: '평가 결과' },
    { href: '/admin/grades', label: '등급 설정' },
    { href: '/admin/eval-cycle', label: '평가 주기' },
    { href: '/compensation/manage', label: '보상 시뮬레이션' },
  ]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-lg font-semibold text-slate-900">관련 화면 바로가기</div>
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

function getCandidateDraft(
  viewModel: CalibrationViewModel,
  draftEdits: Record<string, CandidateEditState>,
  candidate: CalibrationCandidate
) {
  const adjustedGrade = candidate.adjustedGrade ?? candidate.originalGrade
  const matchedGrade = viewModel.gradeOptions.find((grade) => grade.grade === adjustedGrade) ?? viewModel.gradeOptions[0]
  return (
    draftEdits[candidate.id] ?? {
      gradeId: matchedGrade?.id ?? '',
      reason: candidate.reason ?? '',
    }
  )
}

function getGradeTone(grade: string) {
  if (grade === 'S') return 'bg-emerald-500'
  if (grade === 'A') return 'bg-blue-500'
  if (grade === 'B') return 'bg-slate-500'
  if (grade === 'C') return 'bg-amber-500'
  return 'bg-rose-500'
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
  if (value === undefined || value === null) return '-'
  return `${value}${unit ? ` ${unit}` : ''}`
}

async function assertJsonSuccess(response: Response) {
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return json.data
}
