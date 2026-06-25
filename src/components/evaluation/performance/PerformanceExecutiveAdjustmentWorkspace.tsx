'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Filter,
  Save,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
} from 'lucide-react'
import { PmsDetailPanel, PmsProgressRing, PmsSignalChip } from '@/components/pms-ui'
import type { PmsTone } from '@/components/pms-ui'
import {
  normalizeEvaluationPerformanceBriefingSnapshot,
  type EvaluationPerformanceBriefingSnapshot,
} from '@/lib/evaluation-performance-briefing'
import { EvaluationPerformanceBriefingPanel } from '@/components/evaluation/EvaluationPerformanceBriefingPanel'
import { ExecutiveBriefingA4Modal } from '@/components/evaluation/performance/ExecutiveBriefingA4Modal'

type ExecutiveWorkbenchData = {
  currentUser?: {
    role?: string | null
  } | null
  evaluations?: EvaluationSummary[] | null
  selected?: SelectedEvaluation | null
}

type EvaluationSummary = {
  id: string
  cycleId: string
  targetName: string
  targetDepartment?: string | null
  evalStage?: string | null
  stageLabel?: string | null
  status: string
  statusLabel: string
  totalScore?: number | null
  updatedAt?: string | null
}

type SelectedEvaluation = {
  id: string
  cycle: {
    id?: string | null
    name: string
  }
  target: {
    name: string
    department?: string | null
    position?: string | null
  }
  evalStage?: string | null
  stageLabel?: string | null
  status: string
  statusLabel: string
  totalScore?: number | null
  gradeId?: string | null
  organizationPerformanceScore?: number | null
  personalPerformanceScore?: number | null
  updatedAt: string
  previousStageEvaluation?: {
    stageLabel: string
    evaluatorName: string
    totalScore?: number | null
    updatedAt: string
  } | null
  priorStageEvaluations: Array<{
    id: string
    stageLabel: string
    evaluatorName: string
    evaluatorPosition: string
    totalScore?: number | null
    comment?: string | null
    updatedAt: string
  }>
  gradeOptions: Array<{
    id: string
    gradeName: string
    scoreRange: string
  }>
  items: EvaluationItem[]
  briefing?: {
    canView: boolean
    latestSnapshot?: EvaluationPerformanceBriefingSnapshot | null
  } | null
}

type EvaluationItem = {
  personalKpiId: string
  title: string
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  weight: number
  linkedOrgKpiTitle?: string | null
  linkedOrgKpiId?: string | null
  policyCategory?: string | null
  recentAchievementRate?: number | null
  weightedScore?: number | null
  itemComment?: string | null
  goalContext: {
    weightLabel: string
    linkedGoalLabel?: string | null
    progressLabel: string
  }
}

type ExecutiveTab = 'MEMBER' | 'LEADER'

type ExecutiveRow = {
  id: string
  cycleId?: string | null
  name: string
  team: string
  stageLabel: string
  statusLabel: string
  statusTone: PmsTone
  orgScore: string
  personalScore: string
  finalScore: string
  firstGrade: string
  isSelected: boolean
  tab: ExecutiveTab
}

type GradeBucket = 'A' | 'B' | 'C' | 'D'

const GRADE_BUCKETS: Array<{ grade: GradeBucket; label: string; range: string; tone: PmsTone }> = [
  { grade: 'A', label: 'A', range: '90점 이상', tone: 'info' },
  { grade: 'B', label: 'B', range: '80~89점', tone: 'success' },
  { grade: 'C', label: 'C', range: '70~79점', tone: 'warning' },
  { grade: 'D', label: 'D', range: '70점 미만', tone: 'danger' },
]

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  ORG_GOAL: '조직목표',
  PROJECT_T: '프로젝트T',
  PROJECT_K: '프로젝트K',
  DAILY_WORK: '일상업무',
}

export function PerformanceExecutiveAdjustmentWorkspace({ data }: { data: unknown }) {
  const workspaceData = data as ExecutiveWorkbenchData
  const selected = workspaceData.selected ?? null
  const rows = useMemo(
    () => buildExecutiveRows(workspaceData.evaluations ?? [], selected),
    [workspaceData.evaluations, selected]
  )
  const [activeTab, setActiveTab] = useState<ExecutiveTab>('MEMBER')
  const [query, setQuery] = useState('')
  const [briefing, setBriefing] = useState<EvaluationPerformanceBriefingSnapshot | null>(
    workspaceData.selected?.briefing?.latestSnapshot ?? null
  )
  const [briefingBusy, setBriefingBusy] = useState(false)

  async function handleGenerateBriefing() {
    if (!selected?.briefing?.canView) return
    setBriefingBusy(true)
    try {
      const response = await fetch('/api/ai/evaluation-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId: selected.id }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'AI 성과 브리핑을 생성하지 못했습니다.')
      }
      const nextBriefing = normalizeEvaluationPerformanceBriefingSnapshot(json.data)
      if (!nextBriefing) throw new Error('AI 성과 브리핑 결과 형식을 확인하지 못했습니다.')
      setBriefing(nextBriefing)
    } finally {
      setBriefingBusy(false)
    }
  }
  const normalizedQuery = query.trim().toLowerCase()
  const visibleRows = rows.filter((row) => {
    const matchesTab = row.tab === activeTab
    const matchesQuery =
      !normalizedQuery ||
      row.name.toLowerCase().includes(normalizedQuery) ||
      row.team.toLowerCase().includes(normalizedQuery)
    return matchesTab && matchesQuery
  })
  const selectedRow = rows.find((row) => row.isSelected) ?? rows[0] ?? null
  const totalCount = rows.length
  const gradeReadyRows = rows.filter((row) => row.firstGrade !== '확인 필요' && row.firstGrade !== '-')
  const averageScore = computeAverageScore(rows)
  const averageGrade = averageScore == null ? '확인 필요' : resolveGradeFromScore(averageScore)
  const distribution = buildGradeDistribution(rows)
  const orgScore = resolveOrgScore(selected)
  const personalScore = resolvePersonalScore(selected)
  const finalScore = formatScore(selected?.totalScore)
  const firstGrade = resolveSelectedGrade(selected)

  return (
    <section className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>평가 관리</span>
            <span className="text-slate-300">›</span>
            <span>업적평가(MBO)</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-900">본부장 평가</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">팀원/팀장 평가 현황</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            1차 등급이 확정된 평가 결과를 확인하고 조정할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
            {selected?.cycle.name ?? '평가 기간 미선택'}
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400" aria-disabled="true">
            <Download className="h-4 w-4" />
            엑셀 다운로드 · preview
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-600">
            <Filter className="h-4 w-4" />
            필터
          </span>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(540px,620px)]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.75fr)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ExecutiveSummaryCard icon={<Users className="h-4 w-4" />} label="전체 인원" value={`${totalCount}명`} />
              <ExecutiveSummaryCard icon={<ClipboardCheck className="h-4 w-4" />} label="1차 등급 확정" value={`${gradeReadyRows.length}명`} tone="success" />
              <ExecutiveSummaryCard icon={<BarChart3 className="h-4 w-4" />} label="평균 점수" value={averageScore == null ? '확인 필요' : `${averageScore.toFixed(1)}점`} tone="info" />
              <ExecutiveSummaryCard icon={<Trophy className="h-4 w-4" />} label="평균 1차 등급" value={averageGrade} tone={averageGrade === '확인 필요' ? 'neutral' : 'success'} />
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-950">등급 분포</h2>
                  <p className="mt-1 text-xs text-slate-500">등급 분포 (전체)</p>
                </div>
                <PmsSignalChip tone="locked">preview</PmsSignalChip>
              </div>
              <div className="mt-4 grid grid-cols-4 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50">
                {GRADE_BUCKETS.map((bucket) => {
                  const count = distribution[bucket.grade]
                  const percent = totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0
                  return (
                    <div key={bucket.grade} className="px-3 py-3">
                      <PmsSignalChip tone={bucket.tone}>{bucket.label}</PmsSignalChip>
                      <div className="mt-2 text-[11px] font-semibold text-slate-500">{bucket.range}</div>
                      <div className="mt-2 text-base font-bold text-slate-950">
                        {count ? `${count}명` : totalCount ? '0명' : '확인 필요'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{totalCount ? `${percent}%` : '등급 데이터 없음'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <TabButton active={activeTab === 'MEMBER'} onClick={() => setActiveTab('MEMBER')}>팀원</TabButton>
                <TabButton active={activeTab === 'LEADER'} onClick={() => setActiveTab('LEADER')}>팀장</TabButton>
              </div>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <div className="flex min-h-10 min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 xl:max-w-[300px]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="이름 검색"
                    className="min-h-9 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
                <span className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
                  전체 등급
                </span>
                <span className="inline-flex min-h-10 items-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
                  전체 조직
                </span>
                <span className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                  <SlidersHorizontal className="h-4 w-4" />
                  초기화
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-left">소속 팀</th>
                    <th className="px-4 py-3 text-center">조직목표 점수</th>
                    <th className="px-4 py-3 text-center">개인목표 점수</th>
                    <th className="px-4 py-3 text-center">최종 점수</th>
                    <th className="px-4 py-3 text-center">1차 등급</th>
                    <th className="px-4 py-3 text-center">상태</th>
                    <th className="px-4 py-3 text-center">상세보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleRows.length ? (
                    visibleRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition ${
                          row.isSelected
                            ? 'bg-blue-50/80 outline outline-1 -outline-offset-1 outline-blue-300'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-950">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600">{row.team}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{row.orgScore}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{row.personalScore}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{row.finalScore}</td>
                        <td className="px-4 py-3 text-center">
                          <GradeChip grade={row.firstGrade} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PmsSignalChip tone={row.statusTone}>{row.statusLabel}</PmsSignalChip>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href={buildExecutiveHref(row)}
                            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            상세보기
                            <ChevronRight className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        조건에 맞는 평가 현황 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ExecutiveDetailPanel
          selected={selected}
          selectedRow={selectedRow}
          orgScore={orgScore}
          personalScore={personalScore}
          finalScore={finalScore}
          firstGrade={firstGrade}
          averageScore={averageScore}
          briefing={briefing}
          briefingBusy={briefingBusy}
          onGenerateBriefing={() => void handleGenerateBriefing()}
        />
      </div>
    </section>
  )
}

function ExecutiveDetailPanel({
  selected,
  selectedRow,
  orgScore,
  personalScore,
  finalScore,
  firstGrade,
  averageScore,
  briefing,
  briefingBusy,
  onGenerateBriefing,
}: {
  selected: SelectedEvaluation | null
  selectedRow: ExecutiveRow | null
  orgScore: string
  personalScore: string
  finalScore: string
  firstGrade: string
  averageScore: number | null
  briefing: EvaluationPerformanceBriefingSnapshot | null
  briefingBusy: boolean
  onGenerateBriefing: () => void
}) {
  const [showA4, setShowA4] = useState(false)

  return (
    <PmsDetailPanel
      sticky
      className="2xl:w-[620px]"
      eyebrow={
        <div className="flex flex-wrap items-center gap-2">
          <PmsSignalChip tone="info">본부장 평가 현황</PmsSignalChip>
          <PmsSignalChip tone="locked">공식 저장 없음</PmsSignalChip>
        </div>
      }
      title="등급 조정"
      description={
        selected
          ? `${selected.target.name} · ${displayText(selected.target.department)}`
          : '선택된 평가 대상이 없습니다.'
      }
      status={selectedRow ? <PmsSignalChip tone={selectedRow.statusTone}>{selectedRow.statusLabel}</PmsSignalChip> : null}
      metrics={
        <div className="flex flex-wrap items-center gap-4">
          <PmsProgressRing
            value={averageScore ?? 0}
            valueLabel={finalScore}
            label="최종 점수"
            size="sm"
            tone={averageScore == null ? 'neutral' : averageScore >= 80 ? 'success' : averageScore >= 70 ? 'warning' : 'danger'}
          />
          <div className="grid min-w-[260px] flex-1 gap-2 sm:grid-cols-2">
            <MiniMetric label="조직목표 점수" value={orgScore} />
            <MiniMetric label="개인목표 점수" value={personalScore} />
            <MiniMetric label="최종 점수" value={finalScore} />
            <MiniMetric label="1차 등급" value={firstGrade} />
          </div>
        </div>
      }
      footer={
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              disabled
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-100 px-4 text-sm font-semibold text-blue-400"
            >
              <Save className="h-4 w-4" />
              등급 조정 저장
            </button>
          </div>
          <p className="text-right text-xs text-slate-500">
            preview-only입니다. Evaluation.totalScore / gradeId 저장 없음. 공식 점수/등급 write 없음.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
          <CompactInfo label="평가 대상" value={selected?.target.name ?? '-'} />
          <CompactInfo label="소속 팀" value={selected?.target.department ?? '-'} />
          <CompactInfo label="현재 상태" value={selected?.statusLabel ?? '-'} />
          <CompactInfo label="1차 등급" value={firstGrade} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-bold text-slate-950">등급 조정</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="2차 등급" value={firstGrade === '확인 필요' ? '확인 필요' : `${firstGrade} · preview`} />
            <ReadOnlyField label="조정 사유" value="등급 조정 저장 권한 연결 전까지 preview-only로 표시됩니다." multiline />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-bold text-slate-950">등급 변경 이력</div>
          <div className="mt-3 space-y-2">
            <HistoryRow
              grade={firstGrade}
              label="현재 1차 등급"
              meta={selected?.previousStageEvaluation ? `${selected.previousStageEvaluation.evaluatorName} · ${selected.previousStageEvaluation.updatedAt}` : 'preview-only'}
            />
            {selected?.priorStageEvaluations.length ? (
              selected.priorStageEvaluations.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  grade={resolveGradeFromScore(entry.totalScore)}
                  label={entry.stageLabel}
                  meta={`${entry.evaluatorName} · ${entry.updatedAt}`}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                등급 변경 이력 없음 · preview-only
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <EvaluationAccordion title="조직목표 평가" items={selected?.items.filter(isOrgLinkedItem) ?? []} />
          <EvaluationAccordion title="개인목표 평가" items={selected?.items.filter((item) => !isOrgLinkedItem(item)) ?? []} />
        </div>

        <EvaluationPerformanceBriefingPanel
          targetName={selected?.target.name ?? ''}
          snapshot={briefing}
          busy={briefingBusy}
          canGenerate={selected?.briefing?.canView ?? false}
          onGenerate={onGenerateBriefing}
        />

        {briefing && selected && (
          <button
            type="button"
            onClick={() => setShowA4(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200"
          >
            <FileText className="h-4 w-4" />
            A4 리포트 보기
          </button>
        )}

        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-800">
          preview only / 공식 저장 없음. 등급 조정은 본부장 검토 화면에서만 확인하며 공식 반영은 수행하지 않습니다.
        </div>
      </div>

      {showA4 && briefing && selected && (
        <ExecutiveBriefingA4Modal
          selected={selected}
          snapshot={briefing}
          onClose={() => setShowA4(false)}
        />
      )}
    </PmsDetailPanel>
  )
}

function EvaluationAccordion({ title, items }: { title: string; items: EvaluationItem[] }) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  const score = sumWeightedScore(items)

  return (
    <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white" open>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-950">
        <span>{title}</span>
        <span className="text-xs font-semibold text-slate-500">가중치 {totalWeight}% · 합계 점수 {score}</span>
      </summary>
      <div className="border-t border-slate-100">
        {items.length ? (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.personalKpiId} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_80px_96px] sm:items-center">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{item.title || '-'}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{resolveCategoryLabel(item)} · {item.goalContext.progressLabel}</div>
                </div>
                <div className="text-slate-600">가중치 {item.weight}%</div>
                <div className="font-semibold text-slate-900">{formatScore(item.weightedScore)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-4 text-sm text-slate-500">확인 필요 · 세부 평가 데이터가 없습니다.</div>
        )}
      </div>
    </details>
  )
}

function buildExecutiveRows(evaluations: EvaluationSummary[], selected: SelectedEvaluation | null): ExecutiveRow[] {
  const rows: ExecutiveRow[] = evaluations.map((evaluation) => ({
    id: evaluation.id,
    cycleId: evaluation.cycleId,
    name: evaluation.targetName || '-',
    team: evaluation.targetDepartment || '-',
    stageLabel: evaluation.stageLabel || '-',
    statusLabel: evaluation.statusLabel || '-',
    statusTone: resolveStatusTone(evaluation.status),
    orgScore: '확인 필요',
    personalScore: '확인 필요',
    finalScore: formatScore(evaluation.totalScore),
    firstGrade: resolveGradeFromScore(evaluation.totalScore),
    isSelected: evaluation.id === selected?.id,
    tab: isLeaderStage(evaluation.evalStage, evaluation.stageLabel) ? 'LEADER' : 'MEMBER',
  }))

  if (rows.length || !selected) return rows

  return [
    {
      id: selected.id,
      cycleId: selected.cycle.id,
      name: selected.target.name || '-',
      team: selected.target.department || '-',
      stageLabel: selected.stageLabel || '-',
      statusLabel: selected.statusLabel || '-',
      statusTone: resolveStatusTone(selected.status),
      orgScore: resolveOrgScore(selected),
      personalScore: resolvePersonalScore(selected),
      finalScore: formatScore(selected.totalScore),
      firstGrade: resolveSelectedGrade(selected),
      isSelected: true,
      tab: isLeaderStage(selected.evalStage, selected.stageLabel) ? 'LEADER' : 'MEMBER',
    },
  ]
}

function buildGradeDistribution(rows: ExecutiveRow[]) {
  return rows.reduce<Record<GradeBucket, number>>(
    (acc, row) => {
      if (row.firstGrade === 'A' || row.firstGrade === 'B' || row.firstGrade === 'C' || row.firstGrade === 'D') {
        acc[row.firstGrade] += 1
      }
      return acc
    },
    { A: 0, B: 0, C: 0, D: 0 }
  )
}

function computeAverageScore(rows: ExecutiveRow[]) {
  const scores = rows
    .map((row) => Number(row.finalScore.replace('점', '')))
    .filter((score) => Number.isFinite(score))
  if (!scores.length) return null
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
}

function resolveOrgScore(selected: SelectedEvaluation | null) {
  if (!selected) return '-'
  return sumWeightedScore(selected.items.filter(isOrgLinkedItem))
}

function resolvePersonalScore(selected: SelectedEvaluation | null) {
  if (!selected) return '-'
  return sumWeightedScore(selected.items.filter((item) => !isOrgLinkedItem(item)))
}

function sumWeightedScore(items: EvaluationItem[]) {
  const scores = items
    .map((item) => item.weightedScore)
    .filter((score): score is number => typeof score === 'number')
  if (!scores.length) return '확인 필요'
  return `${Math.round(scores.reduce((sum, score) => sum + score, 0) * 10) / 10}점`
}

function resolveSelectedGrade(selected: SelectedEvaluation | null) {
  if (!selected) return '-'
  const gradeName = selected.gradeOptions.find((grade) => grade.id === selected.gradeId)?.gradeName
  return gradeName ?? resolveGradeFromScore(selected.totalScore)
}

function resolveGradeFromScore(score?: number | null) {
  if (typeof score !== 'number') return '확인 필요'
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  return 'D'
}

function isLeaderStage(stage?: string | null, stageLabel?: string | null) {
  const text = `${stage ?? ''} ${stageLabel ?? ''}`
  return text.includes('FIRST') || text.includes('SECOND') || text.includes('FINAL') || text.includes('팀장')
}

function resolveStatusTone(status: string): PmsTone {
  if (['SUBMITTED', 'CONFIRMED', 'FINALIZED'].includes(status)) return 'success'
  if (['IN_PROGRESS', 'DRAFT', 'REJECTED', 'RETURNED'].includes(status)) return 'warning'
  return 'neutral'
}

function isOrgLinkedItem(item: EvaluationItem) {
  return Boolean(
    item.linkedOrgKpiId ||
      item.linkedOrgKpiTitle ||
      item.policyCategory === 'ORG_GOAL' ||
      item.policyCategory === 'PROJECT_T' ||
      item.policyCategory === 'PROJECT_K'
  )
}

function resolveCategoryLabel(item: EvaluationItem) {
  return (item.policyCategory ? POLICY_CATEGORY_LABELS[item.policyCategory] : null) ?? (item.type === 'QUANTITATIVE' ? '정량' : '정성')
}

function buildExecutiveHref(row: ExecutiveRow) {
  const query = new URLSearchParams()
  query.set('view', 'executive')
  query.set('evaluationId', row.id)
  if (row.cycleId) query.set('cycleId', row.cycleId)
  return `/evaluation/workbench?${query.toString()}`
}

function ExecutiveSummaryCard({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon?: ReactNode
  label: string
  value: string
  tone?: PmsTone
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'info'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`flex min-h-[76px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      {icon ? <span className="rounded-xl bg-white/80 p-2 shadow-sm">{icon}</span> : null}
      <div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="mt-0.5 text-xs font-semibold text-current/70">{label}</div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-xl px-4 text-sm font-bold transition ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

function GradeChip({ grade }: { grade: string }) {
  const tone: PmsTone =
    grade === 'A'
      ? 'info'
      : grade === 'B'
        ? 'success'
        : grade === 'C'
          ? 'warning'
          : grade === 'D'
            ? 'danger'
            : 'neutral'
  return <PmsSignalChip tone={tone}>{grade}</PmsSignalChip>
}

function HistoryRow({ grade, label, meta }: { grade: string; label: string; meta: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <GradeChip grade={grade} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{meta}</div>
      </div>
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  multiline = false,
}: {
  label: string
  value?: string | number | null
  multiline?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-2 text-sm leading-6 text-slate-800 ${multiline ? 'min-h-[64px] whitespace-pre-wrap' : ''}`}>
        {displayText(value)}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold text-slate-900">{displayText(value)}</div>
    </div>
  )
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-800">{displayText(value)}</div>
    </div>
  )
}

function formatScore(score?: number | null) {
  return typeof score === 'number' ? `${Math.round(score * 10) / 10}점` : '확인 필요'
}

function displayText(value?: string | number | null) {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.trim()) return value
  return '-'
}
