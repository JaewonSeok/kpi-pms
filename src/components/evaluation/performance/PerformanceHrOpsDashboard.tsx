'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  LockKeyhole,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'
import { PmsSignalChip, PmsSummaryCard } from '@/components/pms-ui'
import type { PmsTone } from '@/components/pms-ui'

type HrOpsData = {
  state?: string
  message?: string
  availableCycles?: Array<{
    id: string
    name: string
    year: number
    status: string
  }> | null
  selectedCycleId?: string
  summary?: {
    totalCount: number
    submittedCount: number
    actionRequiredCount: number
    rejectedCount: number
  }
  currentUser?: {
    id: string
    name: string
    role: string
    department: string
  } | null
  evaluations?: EvaluationSummary[] | null
  selected?: SelectedEvaluation | null
}

type EvaluationSummary = {
  id: string
  cycleId: string
  cycleName: string
  cycleYear: number
  evalStage: string
  stageLabel: string
  status: string
  statusLabel: string
  targetId: string
  targetName: string
  targetDepartment: string
  evaluatorName: string
  totalScore?: number | null
  updatedAt: string
  submittedAt?: string
}

type SelectedEvaluation = {
  id: string
  cycle: {
    id: string
    name: string
    year: number
    status: string
  }
  target: {
    id: string
    name: string
    department: string
    position: string
  }
  status: string
  statusLabel: string
  totalScore?: number | null
  gradeId?: string | null
  updatedAt: string
  stageChain: Array<{
    stage: string
    stageLabel: string
    status?: string | null
    statusLabel: string
    submittedAt?: string
    updatedAt?: string
  }>
  gradeOptions: Array<{
    id: string
    gradeName: string
    scoreRange: string
  }>
  items: EvaluationItem[]
}

type EvaluationItem = {
  personalKpiId: string
  title: string
  weight: number
  linkedOrgKpiTitle?: string | null
  linkedOrgKpiId?: string | null
  policyCategory?: string | null
  weightedScore?: number | null
  itemComment?: string | null
  goalContext: {
    weightLabel: string
    progressLabel: string
    linkedGoalLabel?: string | null
  }
}

type TargetProgress = {
  targetId: string
  name: string
  employeeNo: string
  division: string
  team: string
  position: string
  selfStatus: StageState
  leaderStatus: StageState
  hrStatus: StageState
  finalStatus: StageState
  finalScore: number | null
  finalScoreLabel: string
  grade: string
  selected: boolean
}

type StageState = {
  label: string
  tone: PmsTone
  done: boolean
  source?: EvaluationSummary
}

type DepartmentProgress = {
  name: string
  total: number
  selfSubmitted: number
  leaderDone: number
  hrReflected: number
  finalDone: number
}

type StageDistribution = {
  key: string
  label: string
  count: number
  tone: PmsTone
  color: string
}

const DONE_STATUSES = new Set(['SUBMITTED', 'CONFIRMED'])
const ACTIVE_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'REJECTED'])

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  ORG_GOAL: '조직목표',
  PROJECT_T: '프로젝트T',
  PROJECT_K: '프로젝트K',
  DAILY_WORK: '일상업무',
}

export function PerformanceHrOpsDashboard({ data }: { data: unknown }) {
  const dashboardData = data as HrOpsData
  const selectedCycle = dashboardData.availableCycles?.find((cycle) => cycle.id === dashboardData.selectedCycleId) ?? dashboardData.availableCycles?.[0] ?? null
  const targets = useMemo(
    () => buildTargetProgress(dashboardData.evaluations ?? [], dashboardData.selected ?? null),
    [dashboardData.evaluations, dashboardData.selected]
  )
  const [selectedTargetId, setSelectedTargetId] = useState(() => dashboardData.selected?.target.id ?? targets[0]?.targetId ?? '')
  const [query, setQuery] = useState('')
  const selectedTarget = targets.find((target) => target.targetId === selectedTargetId) ?? targets[0] ?? null
  const selectedDetail = dashboardData.selected?.target.id === selectedTarget?.targetId ? dashboardData.selected : null
  const normalizedQuery = query.trim().toLowerCase()
  const filteredTargets = targets.filter((target) => {
    if (!normalizedQuery) return true
    return [target.name, target.employeeNo, target.division, target.team].some((value) =>
      value.toLowerCase().includes(normalizedQuery)
    )
  })
  const departmentRows = buildDepartmentRows(targets)
  const summary = buildHrSummary(targets)
  const distribution = buildStageDistribution(targets)
  const donutBackground = buildDonutBackground(distribution)
  const orgItems = selectedDetail?.items.filter(isOrgItem) ?? []
  const personalItems = selectedDetail?.items.filter((item) => !isOrgItem(item)) ?? []

  return (
    <section className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>평가 관리</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-900">업적평가 모니터링</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">업적평가 모니터링</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            전체 대상자, 자기평가 제출, 팀장 평가 완료, HR 점수 반영, 최종 확정 상태를 한 화면에서 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            {selectedCycle?.name ?? '평가 기간 확인 필요'}
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Building2 className="h-4 w-4 text-slate-500" />
            전체 본부
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400" aria-disabled="true">
            <Download className="h-4 w-4" />
            엑셀 다운로드 · preview
          </span>
          <PmsSignalChip tone="info" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            HR 관리자
          </PmsSignalChip>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <PmsSummaryCard icon={<Users className="h-4 w-4" />} label="전체 대상자" value={`${summary.total}명`} tone="info" chip={percentage(summary.total, summary.total)} />
        <PmsSummaryCard icon={<UserCheck className="h-4 w-4" />} label="팀원 자기평가 제출" value={`${summary.selfSubmitted}명`} tone="success" chip={percentage(summary.selfSubmitted, summary.total)} />
        <PmsSummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="팀장 평가 완료" value={`${summary.leaderDone}명`} tone="success" chip={percentage(summary.leaderDone, summary.total)} />
        <PmsSummaryCard icon={<FileSpreadsheet className="h-4 w-4" />} label="HR 점수 반영 완료" value={`${summary.hrReflected}명`} tone="warning" chip={percentage(summary.hrReflected, summary.total)} />
        <PmsSummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="최종 확정 완료" value={`${summary.finalDone}명`} tone="success" chip={percentage(summary.finalDone, summary.total)} />
        <PmsSummaryCard icon={<Clock3 className="h-4 w-4" />} label="미확정" value={`${summary.unconfirmed}명`} tone={summary.unconfirmed ? 'danger' : 'neutral'} chip={percentage(summary.unconfirmed, summary.total)} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,480px)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">본부별 현황</h2>
                <p className="mt-0.5 text-xs text-slate-500">평가 단계별 완료율을 본부 단위로 확인합니다.</p>
              </div>
              <PmsSignalChip tone="locked">read-only</PmsSignalChip>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left">본부</th>
                    <th className="px-4 py-3 text-center">전체 대상자</th>
                    <th className="px-4 py-3 text-center">자기평가 제출</th>
                    <th className="px-4 py-3 text-center">팀장 평가 완료</th>
                    <th className="px-4 py-3 text-center">HR 점수 반영</th>
                    <th className="px-4 py-3 text-center">최종 확정</th>
                    <th className="px-4 py-3 text-center">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentRows.length ? (
                    departmentRows.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-950">{row.name}</td>
                        <td className="px-4 py-3 text-center">{row.total}명</td>
                        <td className="px-4 py-3 text-center">{row.selfSubmitted}명 · {percentage(row.selfSubmitted, row.total)}</td>
                        <td className="px-4 py-3 text-center">{row.leaderDone}명 · {percentage(row.leaderDone, row.total)}</td>
                        <td className="px-4 py-3 text-center">{row.hrReflected}명 · {percentage(row.hrReflected, row.total)}</td>
                        <td className="px-4 py-3 text-center">{row.finalDone}명 · {percentage(row.finalDone, row.total)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex min-h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500" aria-disabled="true">
                            상세보기 · read-only
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        본부별 현황 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-950">대상자</h2>
                <p className="mt-0.5 text-xs text-slate-500">대상자를 선택하면 상세 진행 상태와 preview 점수를 확인합니다.</p>
              </div>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <div className="flex min-h-10 min-w-[240px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 xl:max-w-[320px]">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="이름, 사번, 팀명 검색"
                    className="min-h-9 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                  />
                </div>
                <FilterPill>전체 진행 상태</FilterPill>
                <FilterPill>전체 본부</FilterPill>
                <FilterPill>전체 팀</FilterPill>
                <FilterPill icon={<Filter className="h-4 w-4" />}>필터 초기화</FilterPill>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-left">사번</th>
                    <th className="px-4 py-3 text-left">본부</th>
                    <th className="px-4 py-3 text-left">팀</th>
                    <th className="px-4 py-3 text-left">직책</th>
                    <th className="px-4 py-3 text-center">자기평가</th>
                    <th className="px-4 py-3 text-center">팀장 평가</th>
                    <th className="px-4 py-3 text-center">HR 점수 반영</th>
                    <th className="px-4 py-3 text-center">최종 점수</th>
                    <th className="px-4 py-3 text-center">등급</th>
                    <th className="px-4 py-3 text-center">최종 확정 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTargets.length ? (
                    filteredTargets.map((target) => (
                      <tr
                        key={target.targetId}
                        className={`cursor-pointer transition ${
                          target.targetId === selectedTarget?.targetId
                            ? 'bg-blue-50/80 outline outline-1 -outline-offset-1 outline-blue-300'
                            : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedTargetId(target.targetId)}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-950">{target.name}</td>
                        <td className="px-4 py-3 text-slate-500">{target.employeeNo}</td>
                        <td className="px-4 py-3 text-slate-600">{target.division}</td>
                        <td className="px-4 py-3 text-slate-600">{target.team}</td>
                        <td className="px-4 py-3 text-slate-600">{target.position}</td>
                        <td className="px-4 py-3 text-center"><StageChip stage={target.selfStatus} /></td>
                        <td className="px-4 py-3 text-center"><StageChip stage={target.leaderStatus} /></td>
                        <td className="px-4 py-3 text-center"><StageChip stage={target.hrStatus} /></td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">{target.finalScoreLabel}</td>
                        <td className="px-4 py-3 text-center"><GradeChip grade={target.grade} /></td>
                        <td className="px-4 py-3 text-center"><StageChip stage={target.finalStatus} /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                        조건에 맞는 대상자 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">단계별 현황</h2>
                <p className="mt-1 text-xs text-slate-500">전체 대상자 기준</p>
              </div>
              <PmsSignalChip tone="info">전체 {summary.total}명</PmsSignalChip>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)] 2xl:grid-cols-1">
              <div className="grid place-items-center">
                {summary.total ? (
                  <div
                    className="grid h-40 w-40 place-items-center rounded-full shadow-inner"
                    style={{ background: donutBackground }}
                    aria-label="단계별 현황 donut"
                  >
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-sm">
                      <div>
                        <div className="text-xs font-semibold text-slate-500">전체</div>
                        <div className="mt-1 text-2xl font-bold text-slate-950">{summary.total}명</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-40 w-40 place-items-center rounded-full border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-500">
                    단계별 데이터 없음
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {distribution.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.label}
                    </span>
                    <span className="font-bold text-slate-950">{item.count}명</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <InfoPanel
            icon={<Bell className="h-4 w-4" />}
            title="공지사항"
            action="더보기"
            rows={[
              { label: '평가 일정 안내', value: '공지사항 데이터 없음' },
              { label: '등급 기준 조정 안내', value: '관리자 공지 연결 전' },
              { label: '프로젝트 점수 입력 가이드', value: '관리자 공지 연결 전' },
            ]}
          />

          <InfoPanel
            icon={<CalendarDays className="h-4 w-4" />}
            title="평가 일정"
            action="더보기"
            rows={[
              { label: '자기평가 기간', value: '일정 확인 필요' },
              { label: '팀장 평가 기간', value: '일정 확인 필요' },
              { label: 'HR 점수 반영 기간', value: '일정 확인 필요' },
              { label: '최종 확정 기간', value: '일정 확인 필요' },
            ]}
          />

          <TargetDetailPanel
            target={selectedTarget}
            detail={selectedDetail}
            orgItems={orgItems}
            personalItems={personalItems}
          />
        </aside>
      </div>
    </section>
  )
}

function TargetDetailPanel({
  target,
  detail,
  orgItems,
  personalItems,
}: {
  target: TargetProgress | null
  detail: SelectedEvaluation | null
  orgItems: EvaluationItem[]
  personalItems: EvaluationItem[]
}) {
  const orgScore = sumScore(orgItems)
  const personalScore = sumScore(personalItems)

  return (
    <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">평가 대상자 상세</div>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{target?.name ?? '대상자 미선택'}</h2>
            <p className="mt-1 text-sm text-slate-500">{target ? `${target.division} · ${target.team} · ${target.position}` : '대상자를 선택하세요.'}</p>
          </div>
          <PmsSignalChip tone="locked" icon={<LockKeyhole className="h-3.5 w-3.5" />}>
            preview only
          </PmsSignalChip>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
          <CompactInfo label="이름" value={target?.name ?? '-'} />
          <CompactInfo label="사번" value={target?.employeeNo ?? '확인 필요'} />
          <CompactInfo label="부서/팀" value={target ? `${target.division} / ${target.team}` : '-'} />
          <CompactInfo label="직책" value={target?.position ?? '확인 필요'} />
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-slate-950">평가 진행 상태</div>
          <div className="grid gap-2 sm:grid-cols-4">
            <StepChip label="자기평가" stage={target?.selfStatus} />
            <StepChip label="팀장 평가" stage={target?.leaderStatus} />
            <StepChip label="HR 반영" stage={target?.hrStatus} />
            <StepChip label="최종 확정" stage={target?.finalStatus} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-bold text-slate-950">평가 요약</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MiniMetric label="조직목표 점수" value={orgScore} />
            <MiniMetric label="개인목표 점수" value={personalScore} />
            <MiniMetric label="최종 점수" value={target?.finalScoreLabel ?? '확인 필요'} />
            <MiniMetric label="예상 등급" value={target?.grade ?? '확인 필요'} />
          </div>
        </div>

        <EvaluationItemTable title="조직목표 평가" items={orgItems} />
        <EvaluationItemTable title="개인목표 평가" items={personalItems} />

        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
          <div className="text-sm font-bold text-slate-950">계산 결과</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MiniMetric label="조직목표 점수" value={orgScore} />
            <MiniMetric label="개인목표 점수" value={personalScore} />
            <MiniMetric label="최종 반영 점수" value={target?.finalScoreLabel ?? '확인 필요'} />
            <MiniMetric label="등급" value={target?.grade ?? '확인 필요'} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-bold text-slate-950">HR 점수 입력</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="HR 기준 점수" value={target?.finalScoreLabel ?? '확인 필요'} />
            <ReadOnlyField label="최종 반영 점수" value={target?.finalScoreLabel ?? '확인 필요'} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            공식 저장 없음. Evaluation.totalScore / gradeId 저장 없음. official scoring/grade activation 없음.
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
          <div className="text-sm font-bold text-violet-950">최종 확정 preview</div>
          <p className="mt-2 text-xs leading-5 text-violet-800">
            HR 점수 입력과 최종 확정은 preview-only입니다. 실제 임시 저장 / 최종 확정 callback은 연결하지 않았습니다.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" disabled className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-400">
              임시 저장
            </button>
            <button type="button" disabled className="inline-flex min-h-10 items-center rounded-xl bg-blue-100 px-4 text-sm font-semibold text-blue-400">
              최종 확정
            </button>
          </div>
        </div>

        {!detail ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            선택 대상의 세부 평가 항목은 현재 로더가 내려준 선택 평가와 일치할 때만 표시됩니다. 데이터가 없으면 확인 필요로 유지합니다.
          </div>
        ) : null}
      </div>
    </div>
  )
}

function buildTargetProgress(evaluations: EvaluationSummary[], selected: SelectedEvaluation | null): TargetProgress[] {
  const byTarget = new Map<string, EvaluationSummary[]>()
  for (const evaluation of evaluations) {
    const current = byTarget.get(evaluation.targetId) ?? []
    current.push(evaluation)
    byTarget.set(evaluation.targetId, current)
  }

  if (!byTarget.size && selected) {
    byTarget.set(selected.target.id, [
      {
        id: selected.id,
        cycleId: selected.cycle.id,
        cycleName: selected.cycle.name,
        cycleYear: selected.cycle.year,
        evalStage: 'UNKNOWN',
        stageLabel: '현재 선택 평가',
        status: selected.status,
        statusLabel: selected.statusLabel,
        targetId: selected.target.id,
        targetName: selected.target.name,
        targetDepartment: selected.target.department,
        evaluatorName: '-',
        totalScore: selected.totalScore,
        updatedAt: selected.updatedAt,
      },
    ])
  }

  return Array.from(byTarget.entries()).map(([targetId, targetEvaluations]) => {
    const self = findStage(targetEvaluations, ['SELF'])
    const leader = findStage(targetEvaluations, ['FIRST'])
    const hr = findStage(targetEvaluations, ['SECOND', 'FINAL', 'CEO_ADJUST'])
    const final = findStage(targetEvaluations, ['FINAL', 'CEO_ADJUST'])
    const bestScore = resolveFinalScore(targetEvaluations)
    const selectedMatch = selected?.target.id === targetId
    const source = targetEvaluations[0]

    return {
      targetId,
      name: source?.targetName ?? selected?.target.name ?? '-',
      employeeNo: '확인 필요',
      division: source?.targetDepartment ?? selected?.target.department ?? '확인 필요',
      team: selectedMatch ? selected?.target.department ?? '확인 필요' : '확인 필요',
      position: selectedMatch ? selected?.target.position ?? '확인 필요' : '확인 필요',
      selfStatus: resolveStageState(self, '자기평가'),
      leaderStatus: resolveStageState(leader, '팀장 평가'),
      hrStatus: resolveStageState(hr, 'HR 점수 반영'),
      finalStatus: resolveStageState(final, '최종 확정'),
      finalScore: bestScore,
      finalScoreLabel: formatScore(bestScore),
      grade: resolveGrade(bestScore),
      selected: selectedMatch,
    }
  })
}

function buildHrSummary(targets: TargetProgress[]) {
  const total = targets.length
  const selfSubmitted = targets.filter((target) => target.selfStatus.done).length
  const leaderDone = targets.filter((target) => target.leaderStatus.done).length
  const hrReflected = targets.filter((target) => target.hrStatus.done || typeof target.finalScore === 'number').length
  const finalDone = targets.filter((target) => target.finalStatus.done).length

  return {
    total,
    selfSubmitted,
    leaderDone,
    hrReflected,
    finalDone,
    unconfirmed: Math.max(0, total - finalDone),
  }
}

function buildDepartmentRows(targets: TargetProgress[]): DepartmentProgress[] {
  const byDepartment = new Map<string, TargetProgress[]>()
  for (const target of targets) {
    const current = byDepartment.get(target.division) ?? []
    current.push(target)
    byDepartment.set(target.division, current)
  }

  return Array.from(byDepartment.entries())
    .map(([name, rows]) => ({
      name,
      total: rows.length,
      selfSubmitted: rows.filter((target) => target.selfStatus.done).length,
      leaderDone: rows.filter((target) => target.leaderStatus.done).length,
      hrReflected: rows.filter((target) => target.hrStatus.done || typeof target.finalScore === 'number').length,
      finalDone: rows.filter((target) => target.finalStatus.done).length,
    }))
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name))
}

function buildStageDistribution(targets: TargetProgress[]): StageDistribution[] {
  const rows: StageDistribution[] = [
    { key: 'self-missing', label: '자기평가 미제출', count: 0, tone: 'neutral', color: '#94a3b8' },
    { key: 'leader-progress', label: '팀장 평가 진행중', count: 0, tone: 'warning', color: '#f59e0b' },
    { key: 'leader-missing', label: '팀장 평가 미완료', count: 0, tone: 'danger', color: '#fb7185' },
    { key: 'hr-progress', label: 'HR 점수 반영 중', count: 0, tone: 'info', color: '#3b82f6' },
    { key: 'final-complete', label: '최종 확정 완료', count: 0, tone: 'success', color: '#10b981' },
    { key: 'final-pending', label: '최종 확정 대기', count: 0, tone: 'neutral', color: '#cbd5e1' },
  ]

  for (const target of targets) {
    if (!target.selfStatus.done) {
      rows[0]!.count += 1
    }
    if (target.leaderStatus.source && !target.leaderStatus.done) {
      rows[1]!.count += 1
    }
    if (target.selfStatus.done && !target.leaderStatus.done) {
      rows[2]!.count += 1
    }
    if (target.leaderStatus.done && !target.hrStatus.done) {
      rows[3]!.count += 1
    }
    if (target.finalStatus.done) {
      rows[4]!.count += 1
    }
    if (!target.finalStatus.done) {
      rows[5]!.count += 1
    }
  }

  return rows
}

function buildDonutBackground(rows: StageDistribution[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (!total) return '#f1f5f9'

  let cursor = 0
  const segments = rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const start = cursor
      const degrees = (row.count / total) * 360
      cursor += degrees
      return `${row.color} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`
    })

  return `conic-gradient(${segments.join(', ')})`
}

function findStage(evaluations: EvaluationSummary[], stages: string[]) {
  return evaluations.find((evaluation) => stages.includes(evaluation.evalStage)) ?? null
}

function resolveStageState(evaluation: EvaluationSummary | null, fallbackLabel: string): StageState {
  if (!evaluation) {
    return { label: '대기', tone: 'neutral', done: false }
  }

  if (DONE_STATUSES.has(evaluation.status)) {
    return { label: evaluation.statusLabel || '완료', tone: 'success', done: true, source: evaluation }
  }

  if (ACTIVE_STATUSES.has(evaluation.status)) {
    return { label: evaluation.statusLabel || `${fallbackLabel} 중`, tone: evaluation.status === 'REJECTED' ? 'danger' : 'warning', done: false, source: evaluation }
  }

  return { label: evaluation.statusLabel || '확인 필요', tone: 'neutral', done: false, source: evaluation }
}

function resolveFinalScore(evaluations: EvaluationSummary[]) {
  const preferred = [...evaluations]
    .sort((left, right) => stageRank(right.evalStage) - stageRank(left.evalStage))
    .find((evaluation) => typeof evaluation.totalScore === 'number')
  return preferred?.totalScore ?? null
}

function stageRank(stage: string) {
  if (stage === 'CEO_ADJUST') return 5
  if (stage === 'FINAL') return 4
  if (stage === 'SECOND') return 3
  if (stage === 'FIRST') return 2
  if (stage === 'SELF') return 1
  return 0
}

function isOrgItem(item: EvaluationItem) {
  return Boolean(
    item.linkedOrgKpiId ||
      item.linkedOrgKpiTitle ||
      item.policyCategory === 'ORG_GOAL' ||
      item.policyCategory === 'PROJECT_T' ||
      item.policyCategory === 'PROJECT_K'
  )
}

function sumScore(items: EvaluationItem[]) {
  const scores = items.map((item) => item.weightedScore).filter((score): score is number => typeof score === 'number')
  if (!scores.length) return '확인 필요'
  return `${Math.round(scores.reduce((sum, score) => sum + score, 0) * 10) / 10}점`
}

function formatScore(score?: number | null) {
  return typeof score === 'number' ? `${Math.round(score * 10) / 10}점` : '확인 필요'
}

function resolveGrade(score?: number | null) {
  if (typeof score !== 'number') return '확인 필요'
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Good'
  if (score >= 70) return 'Meet'
  return 'Needs Review'
}

function percentage(count: number, total: number) {
  if (!total) return '-'
  return `${Math.round((count / total) * 1000) / 10}%`
}

function displayText(value?: string | number | null) {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.trim()) return value
  return '-'
}

function StageChip({ stage }: { stage: StageState }) {
  return <PmsSignalChip tone={stage.tone}>{stage.label}</PmsSignalChip>
}

function GradeChip({ grade }: { grade: string }) {
  const tone: PmsTone =
    grade === 'Excellent'
      ? 'info'
      : grade === 'Good'
        ? 'success'
        : grade === 'Meet'
          ? 'warning'
          : grade === 'Needs Review'
            ? 'danger'
            : 'neutral'
  return <PmsSignalChip tone={tone}>{grade}</PmsSignalChip>
}

function StepChip({ label, stage }: { label: string; stage?: StageState }) {
  const resolved = stage ?? { label: '대기', tone: 'neutral' as PmsTone, done: false }
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2">
        <StageChip stage={resolved} />
      </div>
    </div>
  )
}

function FilterPill({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
      {icon}
      {children}
    </span>
  )
}

function InfoPanel({
  icon,
  title,
  action,
  rows,
}: {
  icon: ReactNode
  title: string
  action: string
  rows: Array<{ label: string; value: string }>
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-slate-950">
          {icon}
          {title}
        </h2>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
          {action}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{row.label}</span>
            <span className="text-right text-xs font-semibold text-slate-500">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EvaluationItemTable({ title, items }: { title: string; items: EvaluationItem[] }) {
  return (
    <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white" open>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-950">
        <span>{title}</span>
        <span className="text-xs text-slate-500">{items.length ? `${items.length}건` : '확인 필요'}</span>
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
                <div className="text-slate-600">비중 {item.weight}%</div>
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

function resolveCategoryLabel(item: EvaluationItem) {
  return (item.policyCategory ? POLICY_CATEGORY_LABELS[item.policyCategory] : null) ?? displayText(item.linkedOrgKpiTitle) ?? '개인목표'
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-800">{displayText(value)}</div>
    </div>
  )
}
