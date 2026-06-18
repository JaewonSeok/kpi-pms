'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Link2,
  LockKeyhole,
  Save,
  Search,
  SlidersHorizontal,
  Target,
  Users,
} from 'lucide-react'
import { PmsDetailPanel, PmsProgressRing, PmsSignalChip } from '@/components/pms-ui'
import type { PmsTone } from '@/components/pms-ui'

type PerformanceLeaderReviewWorkspaceData = {
  currentUser?: {
    role?: string | null
  } | null
  summary?: {
    totalCount?: number | null
    submittedCount?: number | null
    actionRequiredCount?: number | null
  } | null
  evaluations?: EvaluationSummary[] | null
  selected?: SelectedEvaluation | null
}

type EvaluationSummary = {
  id: string
  cycleId: string
  targetName: string
  targetDepartment?: string | null
  status: string
  statusLabel: string
  stageLabel?: string | null
  totalScore?: number | null
  updatedAt?: string | null
  submittedAt?: string | null
  isActionRequired?: boolean | null
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
  status: string
  statusLabel: string
  stageLabel?: string | null
  totalScore?: number | null
  comment?: string | null
  strengthComment?: string | null
  improvementComment?: string | null
  nextStepGuidance?: string | null
  updatedAt: string
  submittedAt?: string | null
  items: EvaluationItem[]
}

type EvaluationItem = {
  personalKpiId: string
  title: string
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  weight: number
  linkedOrgKpiTitle?: string | null
  linkedOrgKpiId?: string | null
  policyCategory?: string | null
  definition?: string | null
  latestMonthlyComment?: string | null
  quantScore?: number | null
  planScore?: number | null
  doScore?: number | null
  checkScore?: number | null
  actScore?: number | null
  itemComment?: string | null
  weightedScore?: number | null
  goalContext: {
    achievementSummary?: string | null
    collaborators: string[]
    links: Array<{
      id: string
      label: string
      href: string
    }>
  }
}

type LeaderTab = 'ORG' | 'PERSONAL'
type StatusFilter = 'ALL' | 'SUBMITTED' | 'IN_PROGRESS' | 'NOT_SUBMITTED'

type LeaderRow = {
  id: string
  cycleId?: string | null
  teamName: string
  name: string
  status: StatusFilter
  statusLabel: string
  stageLabel: string
  selfScoreLabel: string
  finalScoreLabel: string
  updatedAt: string
  isSelected: boolean
}

type ParticipantRow = {
  id: string
  name: string
  role: string
  selfScore: string
  adjustment: string
  result: string
}

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'ALL', label: '전체' },
  { key: 'SUBMITTED', label: '제출 완료' },
  { key: 'IN_PROGRESS', label: '작성 중' },
  { key: 'NOT_SUBMITTED', label: '미제출' },
]

const STATUS_TONE: Record<StatusFilter, PmsTone> = {
  ALL: 'neutral',
  SUBMITTED: 'success',
  IN_PROGRESS: 'warning',
  NOT_SUBMITTED: 'neutral',
}

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  ORG_GOAL: '조직목표',
  PROJECT_T: '프로젝트T',
  PROJECT_K: '프로젝트K',
  DAILY_WORK: '일상업무',
}

export function PerformanceLeaderReviewWorkspace({ data }: { data: unknown }) {
  const workspaceData = data as PerformanceLeaderReviewWorkspaceData
  const selected = workspaceData.selected ?? null
  const rows = useMemo(
    () => buildLeaderRows(workspaceData.evaluations ?? [], selected),
    [workspaceData.evaluations, selected]
  )
  const selectedRow = rows.find((row) => row.isSelected) ?? rows[0] ?? null
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      !normalizedQuery ||
      row.name.toLowerCase().includes(normalizedQuery) ||
      row.teamName.toLowerCase().includes(normalizedQuery)
    const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter
    return matchesQuery && matchesStatus
  })
  const totalCount = rows.length
  const submittedCount = rows.filter((row) => row.status === 'SUBMITTED').length
  const inProgressCount = rows.filter((row) => row.status === 'IN_PROGRESS').length
  const notSubmittedCount = rows.filter((row) => row.status === 'NOT_SUBMITTED').length
  const progress = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0

  return (
    <section className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
      <div className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>평가 관리</span>
            <span className="text-slate-300">›</span>
            <span>업적평가(MBO)</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-900">팀장 평가 화면</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">팀원 업적평가</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            제출된 팀원 자기평가와 증빙을 확인하고, 팀장 검토 의견을 준비하는 preview 화면입니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
            {selected?.cycle.name ?? '평가 기간 미선택'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
            <Users className="h-4 w-4" />
            팀장/실장 preview
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700">
            <LockKeyhole className="h-4 w-4" />
            공식 저장 없음
          </span>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(540px,620px)]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <LeaderSummaryCard icon={<Users className="h-4 w-4" />} label="전체 팀원" value={`${totalCount}명`} />
            <LeaderSummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="제출 완료" value={`${submittedCount}명`} tone="success" />
            <LeaderSummaryCard icon={<FileText className="h-4 w-4" />} label="작성 중" value={`${inProgressCount}명`} tone="warning" />
            <LeaderSummaryCard icon={<Target className="h-4 w-4" />} label="미제출" value={`${notSubmittedCount}명`} tone="neutral" />
            <LeaderSummaryCard label="검토 진행률" value={`${progress}%`} tone={progress >= 80 ? 'success' : progress > 0 ? 'warning' : 'neutral'} />
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-h-10 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름 검색"
                  className="min-h-9 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((item) => {
                  const active = statusFilter === item.key
                  const count =
                    item.key === 'ALL'
                      ? totalCount
                      : item.key === 'SUBMITTED'
                        ? submittedCount
                        : item.key === 'IN_PROGRESS'
                          ? inProgressCount
                          : notSubmittedCount

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setStatusFilter(item.key)}
                      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
                        active
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px]">{count}</span>
                    </button>
                  )
                })}
                <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                  <SlidersHorizontal className="h-4 w-4" />
                  필터
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left">팀명</th>
                    <th className="px-4 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-center">제출 상태</th>
                    <th className="px-4 py-3 text-center">자기평가 점수(구성원)</th>
                    <th className="px-4 py-3 text-center">자기평가 최종 점수</th>
                    <th className="px-4 py-3 text-center">상세보기</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.length ? (
                    filteredRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition ${
                          row.isSelected
                            ? 'bg-blue-50/80 outline outline-1 -outline-offset-1 outline-blue-300'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-700">{row.teamName}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-950">{row.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{row.stageLabel}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PmsSignalChip tone={STATUS_TONE[row.status]}>{row.statusLabel}</PmsSignalChip>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-blue-700">{row.selfScoreLabel}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800">{row.finalScoreLabel}</td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href={buildEvaluationHref(row)}
                            className="inline-flex min-h-8 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            상세보기
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        조건에 맞는 팀원 업적평가가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>동일 조직목표/프로젝트 진행 인원은 오른쪽 상세 패널에서 확인합니다.</span>
              <span>평가 저장은 preview-only로 잠겨 있습니다.</span>
            </div>
          </div>
        </div>

        <LeaderDetailPanel selected={selected} selectedRow={selectedRow} progress={progress} />
      </div>
    </section>
  )
}

function LeaderDetailPanel({
  selected,
  selectedRow,
  progress,
}: {
  selected: SelectedEvaluation | null
  selectedRow: LeaderRow | null
  progress: number
}) {
  const [tab, setTab] = useState<LeaderTab>('ORG')
  const orgItems = useMemo(() => (selected?.items ?? []).filter(isOrgLinkedItem), [selected])
  const personalItems = selected?.items ?? []
  const activeOrgItem = orgItems[0] ?? personalItems[0] ?? null
  const activePersonalItem = personalItems[0] ?? null

  return (
    <PmsDetailPanel
      sticky
      className="2xl:w-[620px]"
      eyebrow={
        <div className="flex flex-wrap items-center gap-2">
          <PmsSignalChip tone="info">팀원 평가 상세</PmsSignalChip>
          <PmsSignalChip tone="locked">preview only</PmsSignalChip>
        </div>
      }
      title="팀원 평가 상세"
      description={
        selected
          ? `${selected.target.name} · ${displayText(selected.target.department)}`
          : '선택된 평가 대상이 없습니다.'
      }
      status={selectedRow ? <PmsSignalChip tone={STATUS_TONE[selectedRow.status]}>{selectedRow.statusLabel}</PmsSignalChip> : null}
      metrics={
        <div className="flex flex-wrap items-center gap-4">
          <PmsProgressRing value={progress} label="검토율" size="sm" tone={progress >= 80 ? 'success' : progress > 0 ? 'warning' : 'neutral'} />
          <div className="grid min-w-[260px] flex-1 gap-2 sm:grid-cols-2">
            <MiniMetric label="자기평가 점수" value={selectedRow?.selfScoreLabel ?? '-'} />
            <MiniMetric label="자기평가 최종 점수" value={selectedRow?.finalScoreLabel ?? '-'} />
            <MiniMetric label="평가 단계" value={selected?.stageLabel ?? '-'} />
            <MiniMetric label="최근 업데이트" value={selected?.updatedAt ?? '-'} />
          </div>
        </div>
      }
      footer={
        <div className="space-y-2">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
            >
              <Save className="h-4 w-4" />
              임시저장
            </button>
            <button
              type="button"
              disabled
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-100 px-4 text-sm font-semibold text-blue-400"
            >
              <ClipboardCheck className="h-4 w-4" />
              평가 저장
            </button>
          </div>
          <p className="text-right text-xs text-slate-500">
            preview-only 화면입니다. 평가 저장 callback을 새로 연결하지 않았습니다. Evaluation.totalScore 및 Evaluation.gradeId 쓰기는 수행하지 않습니다.
          </p>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
          <CompactInfo label="평가 대상" value={selected?.target.name ?? '-'} />
          <CompactInfo label="소속/직책" value={[selected?.target.department, selected?.target.position].filter(Boolean).join(' · ') || '-'} />
          <CompactInfo label="평가 기간" value={selected?.cycle.name ?? '-'} />
          <CompactInfo label="제출 상태" value={selected?.statusLabel ?? '-'} />
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab('ORG')}
            className={`min-h-10 rounded-xl text-sm font-bold transition ${
              tab === 'ORG' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            조직목표 평가
          </button>
          <button
            type="button"
            onClick={() => setTab('PERSONAL')}
            className={`min-h-10 rounded-xl text-sm font-bold transition ${
              tab === 'PERSONAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            개인목표 평가
          </button>
        </div>

        {tab === 'ORG' ? (
          <OrgGoalReviewSection selected={selected} item={activeOrgItem} />
        ) : (
          <PersonalGoalReviewSection selected={selected} item={activePersonalItem} />
        )}

        <LeaderFeedbackPreview selected={selected} />

        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-800">
          팀장 평가는 preview-only입니다. 공식 점수 반영, 등급 산정, 확정 처리는 이 화면에서 수행하지 않습니다.
        </div>
      </div>
    </PmsDetailPanel>
  )
}

function OrgGoalReviewSection({
  selected,
  item,
}: {
  selected: SelectedEvaluation | null
  item: EvaluationItem | null
}) {
  const participants = buildParticipantRows(selected, item)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          조직목표 선택
        </div>
        <div className="mt-2 text-base font-bold text-slate-950">
          {displayText(item?.linkedOrgKpiTitle ?? item?.title)}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <PmsSignalChip tone="info">{resolveCategoryLabel(item)}</PmsSignalChip>
          <PmsSignalChip tone="neutral">비중 {item ? `${item.weight}%` : '-'}</PmsSignalChip>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-bold text-slate-950">동일 조직목표/프로젝트 진행 인원</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            같은 목표 또는 프로젝트에 연결된 구성원의 자기평가와 증빙 확인 포인트입니다.
          </p>
          <div className="mt-2 text-xs font-bold text-slate-700">참여자 비교 및 팀장 가감점</div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">참여자</th>
                <th className="px-3 py-2 text-left">수행 역할</th>
                <th className="px-3 py-2 text-center">자기평가 점수</th>
                <th className="px-3 py-2 text-center">팀장 가감점</th>
                <th className="px-3 py-2 text-center">반영 결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participants.length ? (
                participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{participant.name}</td>
                    <td className="px-3 py-2 text-slate-600">{participant.role}</td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-700">{participant.selfScore}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{participant.adjustment}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{participant.result}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                    동일 목표 참여자 데이터 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReadOnlyField label="팀장 가감점" value="preview-only" />
        <ReadOnlyField label="팀장 가감점 사유" value="평가 저장 권한 연결 전까지 화면에서만 확인합니다." />
      </div>
    </div>
  )
}

function PersonalGoalReviewSection({
  selected,
  item,
}: {
  selected: SelectedEvaluation | null
  item: EvaluationItem | null
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Target className="h-4 w-4 text-blue-600" />
          개인목표 선택
        </div>
        <div className="mt-2 text-base font-bold text-slate-950">{displayText(item?.title)}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <PmsSignalChip tone="info">{resolveCategoryLabel(item)}</PmsSignalChip>
          <PmsSignalChip tone="neutral">비중 {item ? `${item.weight}%` : '-'}</PmsSignalChip>
        </div>
      </div>

      <ReadOnlyField label="수행 결과" value={item?.latestMonthlyComment ?? item?.goalContext.achievementSummary} multiline />
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadOnlyField label="자기평가 점수" value={resolveSelfScoreLabel(item)} />
        <ReadOnlyField label="자기평가 최종 점수" value={resolveFinalScoreLabel(selected, item)} />
      </div>
      <ReadOnlyField label="자기평가 의견" value={item?.itemComment} multiline />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link2 className="h-3.5 w-3.5" />
          증빙자료 링크
        </div>
        {item?.goalContext.links.length ? (
          <div className="mt-2 space-y-2">
            {item.goalContext.links.map((link) => (
              <a
                key={link.id}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="block truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">-</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReadOnlyField label="팀장 평가 점수" value="preview-only" />
        <ReadOnlyField label="팀장 가감점" value="preview-only" />
      </div>
      <ReadOnlyField label="팀장 가감점 사유" value="저장 callback 연결 전에는 입력하지 않습니다." multiline />

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
        <CompactInfo label="평가 대상" value={selected?.target.name ?? '-'} />
        <CompactInfo label="현재 상태" value={selected?.statusLabel ?? '-'} />
        <CompactInfo label="평가 주기" value={selected?.cycle.name ?? '-'} />
        <CompactInfo label="증빙 수" value={item ? `${item.goalContext.links.length}개` : '-'} />
      </div>
    </div>
  )
}

function LeaderFeedbackPreview({ selected }: { selected: SelectedEvaluation | null }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3">
      <div className="text-xs font-semibold text-blue-700">팀장 피드백</div>
      <div className="mt-2 min-h-[80px] whitespace-pre-wrap rounded-xl border border-blue-100 bg-white/80 px-3 py-3 text-sm leading-6 text-slate-800">
        {resolveLeaderFeedback(selected)}
      </div>
      <p className="mt-2 text-xs leading-5 text-blue-700">
        팀장 평가는 preview-only입니다. 공식 점수/등급 저장은 수행하지 않습니다. Evaluation.totalScore / gradeId 저장 없음.
      </p>
    </div>
  )
}

function buildLeaderRows(evaluations: EvaluationSummary[], selected: SelectedEvaluation | null): LeaderRow[] {
  const rows = evaluations.map((evaluation) => ({
    id: evaluation.id,
    cycleId: evaluation.cycleId,
    teamName: evaluation.targetDepartment || '-',
    name: evaluation.targetName || '-',
    status: resolveLeaderStatus(evaluation.status),
    statusLabel: resolveLeaderStatusLabel(evaluation.status, evaluation.statusLabel),
    stageLabel: evaluation.stageLabel || '-',
    selfScoreLabel: formatScore(evaluation.totalScore),
    finalScoreLabel: formatScore(evaluation.totalScore),
    updatedAt: evaluation.updatedAt || '-',
    isSelected: evaluation.id === selected?.id,
  }))

  if (rows.length || !selected) return rows

  return [
    {
      id: selected.id,
      cycleId: selected.cycle.id,
      teamName: selected.target.department || '-',
      name: selected.target.name || '-',
      status: resolveLeaderStatus(selected.status),
      statusLabel: resolveLeaderStatusLabel(selected.status, selected.statusLabel),
      stageLabel: selected.stageLabel || '-',
      selfScoreLabel: formatScore(selected.totalScore),
      finalScoreLabel: formatScore(selected.totalScore),
      updatedAt: selected.updatedAt || '-',
      isSelected: true,
    },
  ]
}

function buildParticipantRows(selected: SelectedEvaluation | null, item: EvaluationItem | null): ParticipantRow[] {
  if (!selected || !item) return []

  const rows: ParticipantRow[] = [
    {
      id: `${selected.id}-${item.personalKpiId}-self`,
      name: `${selected.target.name} (본인)`,
      role: item.linkedOrgKpiTitle || resolveCategoryLabel(item),
      selfScore: resolveSelfScoreLabel(item),
      adjustment: 'preview-only',
      result: resolveFinalScoreLabel(selected, item),
    },
  ]

  item.goalContext.collaborators.forEach((name, index) => {
    rows.push({
      id: `${selected.id}-${item.personalKpiId}-collaborator-${index}`,
      name,
      role: '협업/증빙 참여',
      selfScore: '-',
      adjustment: '-',
      result: '월간/체크인 근거 확인 필요',
    })
  })

  return rows
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

function resolveLeaderStatus(status: string): StatusFilter {
  if (['SUBMITTED', 'CONFIRMED', 'FINALIZED'].includes(status)) return 'SUBMITTED'
  if (['IN_PROGRESS', 'DRAFT', 'REJECTED', 'RETURNED'].includes(status)) return 'IN_PROGRESS'
  return 'NOT_SUBMITTED'
}

function resolveLeaderStatusLabel(status: string, fallback?: string | null) {
  const resolved = resolveLeaderStatus(status)
  if (fallback?.trim()) return fallback
  if (resolved === 'SUBMITTED') return '제출 완료'
  if (resolved === 'IN_PROGRESS') return '작성 중'
  return '미제출'
}

function buildEvaluationHref(row: LeaderRow) {
  const query = new URLSearchParams()
  query.set('view', 'leader')
  query.set('evaluationId', row.id)
  if (row.cycleId) query.set('cycleId', row.cycleId)
  return `/evaluation/workbench?${query.toString()}`
}

function resolveCategoryLabel(item?: EvaluationItem | null) {
  if (!item) return '-'
  return (item.policyCategory ? POLICY_CATEGORY_LABELS[item.policyCategory] : null) ?? (item.type === 'QUANTITATIVE' ? '정량' : '정성')
}

function resolveSelfScoreLabel(item?: EvaluationItem | null) {
  if (!item) return '-'
  if (typeof item.quantScore === 'number') return `${item.quantScore}점`
  const pdcaScores = [item.planScore, item.doScore, item.checkScore, item.actScore].filter(
    (score): score is number => typeof score === 'number'
  )
  if (!pdcaScores.length) return '-'
  const average = pdcaScores.reduce((sum, score) => sum + score, 0) / pdcaScores.length
  return `${Math.round(average * 10) / 10}점`
}

function resolveFinalScoreLabel(selected: SelectedEvaluation | null, item?: EvaluationItem | null) {
  if (typeof item?.weightedScore === 'number') return `${Math.round(item.weightedScore * 10) / 10}점`
  if (typeof selected?.totalScore === 'number') return `${Math.round(selected.totalScore * 10) / 10}점`
  return '-'
}

function resolveLeaderFeedback(selected: SelectedEvaluation | null) {
  const feedbackSections = [
    selected?.comment ? `종합 의견: ${selected.comment}` : null,
    selected?.strengthComment ? `강점: ${selected.strengthComment}` : null,
    selected?.improvementComment ? `보완점: ${selected.improvementComment}` : null,
    selected?.nextStepGuidance ? `다음 실행: ${selected.nextStepGuidance}` : null,
  ].filter(Boolean)

  if (feedbackSections.length) return feedbackSections.join('\n')
  return '피드백 데이터 없음 · 평가 저장 권한 연결 전까지 preview-only로 표시됩니다.'
}

function formatScore(score?: number | null) {
  return typeof score === 'number' ? `${Math.round(score * 10) / 10}점` : '-'
}

function LeaderSummaryCard({
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
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      {icon ? <span className="rounded-xl bg-white/80 p-2 shadow-sm">{icon}</span> : null}
      <div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="mt-0.5 text-xs font-semibold text-current/70">{label}</div>
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

function displayText(value?: string | number | null) {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.trim()) return value
  return '-'
}
