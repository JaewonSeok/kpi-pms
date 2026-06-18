'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ClipboardCheck,
  FileText,
  FolderKanban,
  Link2,
  LockKeyhole,
  Save,
  Send,
  Target,
} from 'lucide-react'
import { PmsDetailPanel, PmsProgressRing, PmsSignalChip } from '@/components/pms-ui'
import type { PmsTone } from '@/components/pms-ui'

export type PerformanceMemberInputWorkspaceData = {
  currentUser?: {
    role?: string | null
  } | null
  selected?: SelectedEvaluation | null
}

type SelectedEvaluation = {
  cycle: {
    name: string
  }
  target: {
    name: string
  }
  status: string
  statusLabel: string
  updatedAt: string
  items: EvaluationItem[]
}

type EvaluationItem = {
  personalKpiId: string
  title: string
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  weight: number
  linkedOrgKpiTitle?: string | null
  policyCategory?: string | null
  definition?: string | null
  latestMonthlyComment?: string | null
  quantScore?: number | null
  planScore?: number | null
  doScore?: number | null
  checkScore?: number | null
  actScore?: number | null
  itemComment?: string | null
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
type ItemStatus = 'SUBMITTED' | 'IN_PROGRESS' | 'NOT_STARTED'
type FilterKey = 'ALL' | ItemStatus
type MemberEvaluationRow = {
  item: EvaluationItem
  status: ItemStatus
  categoryLabel: string
  categoryTone: PmsTone
  selfScoreLabel: string
  evidenceLabel: string
  projectLabel: string
  resultSummary: string | null
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'ALL', label: '전체' },
  { key: 'SUBMITTED', label: '제출 완료' },
  { key: 'IN_PROGRESS', label: '작성 중' },
  { key: 'NOT_STARTED', label: '미작성' },
]

const POLICY_CATEGORY_LABELS: Record<string, string> = {
  ORG_GOAL: '조직목표',
  PROJECT_T: '프로젝트T',
  PROJECT_K: '프로젝트K',
  DAILY_WORK: '일상업무',
}

const STATUS_LABELS: Record<ItemStatus, string> = {
  SUBMITTED: '제출 완료',
  IN_PROGRESS: '작성 중',
  NOT_STARTED: '미작성',
}

const STATUS_TONES: Record<ItemStatus, PmsTone> = {
  SUBMITTED: 'success',
  IN_PROGRESS: 'warning',
  NOT_STARTED: 'neutral',
}

export function PerformanceMemberInputWorkspace({ data }: { data: unknown }) {
  const workspaceData = data as PerformanceMemberInputWorkspaceData
  const selected = workspaceData.selected ?? null
  const currentRole = workspaceData.currentUser?.role ?? 'ROLE_MEMBER'
  const isPrivilegedPreview = currentRole === 'ROLE_ADMIN' || currentRole === 'ROLE_MASTER'
  const rows = useMemo<MemberEvaluationRow[]>(
    () => (selected?.items ?? []).map((item) => buildMemberEvaluationRow(item, selected)),
    [selected]
  )
  const [selectedKpiId, setSelectedKpiId] = useState(rows[0]?.item.personalKpiId ?? '')
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const selectedRow = rows.find((row) => row.item.personalKpiId === selectedKpiId) ?? rows[0] ?? null
  const filteredRows = filter === 'ALL' ? rows : rows.filter((row) => row.status === filter)
  const totalCount = rows.length
  const submittedCount = rows.filter((row) => row.status === 'SUBMITTED').length
  const inProgressCount = rows.filter((row) => row.status === 'IN_PROGRESS').length
  const notStartedCount = rows.filter((row) => row.status === 'NOT_STARTED').length
  const progress = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0

  return (
    <section className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>평가 관리</span>
            <span className="text-slate-300">›</span>
            <span>업적평가(MBO)</span>
            <span className="text-slate-300">›</span>
            <span className="text-slate-900">업적평가 입력</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">업적평가 입력</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            연말 성과를 정리하고 증빙자료와 함께 제출하세요.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700">
              팀원 업적평가 입력
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-400" aria-disabled="true">
              팀장 평가 화면 · 아직 구현 전
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-400" aria-disabled="true">
              본부장 평가 현황 · 아직 구현 전
            </span>
          </div>
          {isPrivilegedPreview ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              관리자 권한에서는 팀원 입력 화면을 preview-only로 확인합니다. 저장/제출 기능은 열지 않습니다.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
            {selected?.cycle.name ?? '평가 기간 미선택'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
            <FileText className="h-4 w-4" />
            제출 안내: 작성 내용을 확인한 뒤 제출하세요
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-violet-700">
            <LockKeyhole className="h-4 w-4" />
            preview only · 공식 저장 없음
          </span>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(540px,600px)]">
        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MemberSummaryCard icon={<Target className="h-4 w-4" />} label="전체 목표" value={`${totalCount}개`} />
            <MemberSummaryCard icon={<ClipboardCheck className="h-4 w-4" />} label="제출 완료" value={`${submittedCount}개`} tone="success" />
            <MemberSummaryCard icon={<FileText className="h-4 w-4" />} label="작성 중" value={`${inProgressCount}개`} tone="warning" />
            <MemberSummaryCard icon={<FolderKanban className="h-4 w-4" />} label="미작성" value={`${notStartedCount}개`} tone="neutral" />
            <MemberSummaryCard label="평가 진행률" value={`${progress}%`} tone={progress >= 80 ? 'success' : progress > 0 ? 'warning' : 'neutral'} />
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => {
                  const count =
                    item.key === 'ALL'
                      ? totalCount
                      : item.key === 'SUBMITTED'
                        ? submittedCount
                        : item.key === 'IN_PROGRESS'
                          ? inProgressCount
                          : notStartedCount
                  const active = filter === item.key

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
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
              </div>
              <div className="text-xs font-medium text-slate-500">
                구성원 화면은 입력 상태와 증빙 링크 확인에 집중합니다.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left">구분</th>
                    <th className="px-4 py-3 text-left">개인목표</th>
                    <th className="px-4 py-3 text-left">수행 계획</th>
                    <th className="px-4 py-3 text-center">비중(%)</th>
                    <th className="px-4 py-3 text-center">업무수행 직접 역량레벨</th>
                    <th className="px-4 py-3 text-center">자기평가(연말)</th>
                    <th className="px-4 py-3 text-center">업무성과 증빙자료(링크)</th>
                    <th className="px-4 py-3 text-center">진행 프로젝트명</th>
                    <th className="px-4 py-3 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRows.length ? (
                    filteredRows.map((row) => {
                      const active = selectedRow?.item.personalKpiId === row.item.personalKpiId

                      return (
                        <tr
                          key={row.item.personalKpiId}
                          onClick={() => setSelectedKpiId(row.item.personalKpiId)}
                          className={`cursor-pointer transition ${
                            active
                              ? 'bg-blue-50/80 outline outline-1 -outline-offset-1 outline-blue-300'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <PmsSignalChip tone={row.categoryTone}>{row.categoryLabel}</PmsSignalChip>
                          </td>
                          <td className="max-w-[220px] px-4 py-3 font-semibold text-slate-900">
                            <span className="line-clamp-2">{row.item.title || '-'}</span>
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-slate-600">
                            <span className="line-clamp-2">{displayText(row.item.definition)}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">{row.item.weight}%</td>
                          <td className="px-4 py-3 text-center text-slate-500">-</td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-700">{row.selfScoreLabel}</td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-700">{row.evidenceLabel}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{row.projectLabel}</td>
                          <td className="px-4 py-3 text-center">
                            <PmsSignalChip tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</PmsSignalChip>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                        선택한 상태에 해당하는 개인목표가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>총 {totalCount}개 목표</span>
              <span>선택한 행의 세부 내용은 오른쪽 개인목표 상세에서 확인합니다.</span>
            </div>
          </div>
        </div>

        <MemberDetailPanel selected={selected} row={selectedRow} progress={progress} />
      </div>
    </section>
  )
}

function MemberDetailPanel({
  selected,
  row,
  progress,
}: {
  selected: SelectedEvaluation | null
  row: MemberEvaluationRow | null
  progress: number
}) {
  const item = row?.item ?? null

  return (
    <PmsDetailPanel
      sticky
      className="2xl:w-[600px]"
      eyebrow={
        <div className="flex flex-wrap items-center gap-2">
          <PmsSignalChip tone="info">개인목표 상세</PmsSignalChip>
          <PmsSignalChip tone="locked">공식 저장 없음</PmsSignalChip>
        </div>
      }
      title="개인목표 상세"
      description={item ? item.title : '선택된 개인목표가 없습니다.'}
      status={row ? <PmsSignalChip tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</PmsSignalChip> : null}
      metrics={
        <div className="flex flex-wrap items-center gap-4">
          <PmsProgressRing value={progress} label="진행률" size="sm" tone={progress >= 80 ? 'success' : progress > 0 ? 'warning' : 'neutral'} />
          <div className="grid min-w-[220px] flex-1 gap-2 sm:grid-cols-2">
            <MiniMetric label="비중(%)" value={item ? `${item.weight}%` : '-'} />
            <MiniMetric label="자기평가" value={row?.selfScoreLabel ?? '-'} />
          </div>
        </div>
      }
      footer={
        <div className="space-y-2">
          <div className="flex justify-end gap-2">
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
              <Send className="h-4 w-4" />
              제출
            </button>
          </div>
          <p className="text-right text-xs text-slate-500">
            이 화면은 팀원 업적평가 입력 preview입니다. 저장/제출 callback을 새로 연결하지 않았습니다.
          </p>
        </div>
      }
    >
      {item ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-800">
            preview only / 공식 저장 없음. Evaluation.totalScore 및 Evaluation.gradeId 쓰기는 수행하지 않습니다.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="개인목표" value={item.title} required />
            <ReadOnlyField label="비중(%)" value={`${item.weight}%`} />
            <ReadOnlyField label="연결 조직 KPI" value={item.linkedOrgKpiTitle} />
            <ReadOnlyField label="진행 프로젝트명" value={row?.projectLabel ?? '-'} />
          </div>

          <ReadOnlyField label="수행 계획" value={item.definition} multiline />
          <ReadOnlyField label="수행 결과" value={row?.resultSummary ?? null} multiline />

          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnlyField label="자기평가 점수" value={row?.selfScoreLabel ?? '-'} required />
            <ReadOnlyField label="업무수행 직접 역량레벨" value="-" />
          </div>

          <ReadOnlyField label="자기평가 의견" value={item.itemComment} required multiline />

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Link2 className="h-3.5 w-3.5" />
              증빙자료 링크
              <span className="text-rose-500">*</span>
            </div>
            {item.goalContext.links.length ? (
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

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
            <CompactInfo label="평가 대상" value={selected?.target.name ?? '-'} />
            <CompactInfo label="현재 상태" value={selected?.statusLabel ?? '-'} />
            <CompactInfo label="평가 주기" value={selected?.cycle.name ?? '-'} />
            <CompactInfo label="최근 업데이트" value={selected?.updatedAt ?? '-'} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          표시할 개인목표가 없습니다.
        </div>
      )}
    </PmsDetailPanel>
  )
}

function buildMemberEvaluationRow(item: EvaluationItem, selected: SelectedEvaluation | null): MemberEvaluationRow {
  const hasSelfScore =
    typeof item.quantScore === 'number' ||
    typeof item.planScore === 'number' ||
    typeof item.doScore === 'number' ||
    typeof item.checkScore === 'number' ||
    typeof item.actScore === 'number'
  const hasSelfOpinion = Boolean(item.itemComment?.trim())
  const hasEvidence = item.goalContext.links.length > 0
  const hasResult = Boolean(item.latestMonthlyComment?.trim() || item.goalContext.achievementSummary?.trim())
  const status: ItemStatus =
    selected && ['SUBMITTED', 'CONFIRMED'].includes(selected.status) && (hasSelfScore || hasSelfOpinion || hasEvidence)
      ? 'SUBMITTED'
      : hasSelfScore || hasSelfOpinion || hasEvidence || hasResult
        ? 'IN_PROGRESS'
        : 'NOT_STARTED'
  const categoryLabel =
    (item.policyCategory ? POLICY_CATEGORY_LABELS[item.policyCategory] : null) ??
    (item.type === 'QUANTITATIVE' ? '정량' : '정성')
  const categoryTone: PmsTone =
    item.policyCategory === 'ORG_GOAL'
      ? 'danger'
      : item.policyCategory === 'PROJECT_T'
        ? 'warning'
        : item.policyCategory === 'PROJECT_K'
          ? 'info'
          : item.policyCategory === 'DAILY_WORK'
            ? 'neutral'
            : 'neutral'
  const selfScoreLabel =
    typeof item.quantScore === 'number'
      ? `${item.quantScore}점`
      : hasSelfScore
        ? 'PDCA 입력'
        : '-'
  const evidenceLabel = hasEvidence ? `${item.goalContext.links.length}개` : '-'
  const projectLabel = resolveProjectLabel(item)
  const resultSummary =
    item.latestMonthlyComment ??
    item.goalContext.achievementSummary ??
    null

  return {
    item,
    status,
    categoryLabel,
    categoryTone,
    selfScoreLabel,
    evidenceLabel,
    projectLabel,
    resultSummary,
  }
}

function resolveProjectLabel(item: EvaluationItem) {
  if (item.policyCategory === 'PROJECT_T') return item.linkedOrgKpiTitle ?? '프로젝트T'
  if (item.policyCategory === 'PROJECT_K') return item.linkedOrgKpiTitle ?? '프로젝트K'
  const collaborators = item.goalContext.collaborators
  if (collaborators.length) return collaborators.slice(0, 2).join(', ')
  return '-'
}

function MemberSummaryCard({
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
    <div className={`flex min-h-[76px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
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
  required = false,
  multiline = false,
}: {
  label: string
  value?: string | number | null
  required?: boolean
  multiline?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </div>
      <div className={`mt-2 text-sm leading-6 text-slate-800 ${multiline ? 'min-h-[72px] whitespace-pre-wrap' : ''}`}>
        {displayText(value)}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold text-slate-900">{value}</div>
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
