'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Bell,
  ChevronRight,
  Info,
  Search,
  ShieldCheck,
} from 'lucide-react'
import type { UpwardReviewPageData } from '@/server/upward-review'
import { Feedback360Avatar } from '../feedback360/ppt/Feedback360Avatar'

type AdminData = NonNullable<UpwardReviewPageData['admin']>
type SelectedRound = NonNullable<AdminData['selectedRound']>
type Assignment = SelectedRound['assignments'][number]
type DirectoryEmployee = AdminData['employeeDirectory'][number]
type TableTab = 'targets' | 'divisions' | 'teams' | 'results'

const LEADERSHIP_OPS_CATEGORIES = [
  '목표 제시',
  '의사소통',
  '실행 관리',
  '피드백/코칭',
  '협업 촉진',
  '의사결정',
  '심리적 안전감',
  '성장 지원',
] as const

const STATUS_OPTIONS = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'SUBMITTED', label: '제출 완료' },
  { value: 'IN_PROGRESS', label: '작성 중' },
  { value: 'PENDING', label: '미응답' },
] as const

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`
}

function formatCount(value: number, suffix = '명') {
  return `${Math.max(0, value).toLocaleString('ko-KR')}${suffix}`
}

function getStatusLabel(row: { submittedCount: number; inProgressCount: number; totalAssignments: number }) {
  if (row.totalAssignments <= 0) return '데이터 없음'
  if (row.submittedCount >= row.totalAssignments) return '제출 완료'
  if (row.inProgressCount > 0 || row.submittedCount > 0) return '작성 중'
  return '미응답'
}

function getStatusTone(status: string) {
  if (status === '제출 완료') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === '작성 중') return 'border-blue-100 bg-blue-50 text-blue-700'
  if (status === '데이터 없음') return 'border-slate-200 bg-slate-50 text-slate-500'
  return 'border-rose-100 bg-rose-50 text-rose-700'
}

function getResultStatus(row: { thresholdMet: boolean; resultAvailable: boolean; submittedCount: number }) {
  if (row.resultAvailable) return '결과 확인 가능'
  if (row.thresholdMet) return '결과 준비 중'
  if (row.submittedCount > 0) return '응답 기준 미충족'
  return '결과 준비 전'
}

function getResultTone(status: string) {
  if (status === '결과 확인 가능') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === '결과 준비 중') return 'border-blue-100 bg-blue-50 text-blue-700'
  if (status === '응답 기준 미충족') return 'border-amber-100 bg-amber-50 text-amber-700'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

function getEmployeeLabel(employee?: DirectoryEmployee) {
  if (!employee) return { department: '소속 확인', team: '팀 확인', position: '직책 확인' }
  return {
    department: employee.deptName || '소속 확인',
    team: employee.teamName || employee.deptName || '팀 확인',
    position: employee.position || employee.jobTitle || '직책 확인',
  }
}

function buildResultsHref(params: {
  cycleId?: string
  roundId?: string
  targetId?: string
}) {
  const search = new URLSearchParams()
  if (params.cycleId) search.set('cycleId', params.cycleId)
  if (params.roundId) search.set('roundId', params.roundId)
  if (params.targetId) search.set('empId', params.targetId)
  const query = search.toString()
  return `/evaluation/upward/results${query ? `?${query}` : ''}`
}

function groupByKey<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((map, item) => {
    const key = getKey(item)
    const current = map.get(key) ?? []
    current.push(item)
    map.set(key, current)
    return map
  }, new Map<string, T[]>())
}

function ProgressBar(props: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-blue-600" style={{ width: formatPercent(props.value) }} />
    </div>
  )
}

function Chip(props: { children: string; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-extrabold ${props.className ?? ''}`}>
      {props.children}
    </span>
  )
}

function SummaryCard(props: { label: string; value: string; helper: string; tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const toneClassName =
    props.tone === 'emerald'
      ? 'border-emerald-100 bg-emerald-50'
      : props.tone === 'amber'
        ? 'border-amber-100 bg-amber-50'
        : props.tone === 'rose'
          ? 'border-rose-100 bg-rose-50'
          : props.tone === 'slate'
            ? 'border-slate-200 bg-slate-50'
            : 'border-blue-100 bg-blue-50'

  return (
    <article className={`rounded-2xl border p-4 ${toneClassName}`}>
      <div className="text-xs font-extrabold text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{props.value}</div>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{props.helper}</p>
    </article>
  )
}

type TargetRow = {
  targetId: string
  name: string
  department: string
  team: string
  position: string
  assignments: Assignment[]
  totalAssignments: number
  submittedCount: number
  inProgressCount: number
  pendingCount: number
  progress: number
  statusLabel: string
  resultStatus: string
  thresholdMet: boolean
  resultAvailable: boolean
}

function buildTargetRows(params: {
  assignments: Assignment[]
  directoryById: Map<string, DirectoryEmployee>
  minRaters: number
  released: boolean
}) {
  const grouped = groupByKey(params.assignments, (assignment) => assignment.evaluateeId)

  return Array.from(grouped.entries())
    .map(([targetId, assignments]) => {
      const employee = params.directoryById.get(targetId)
      const label = getEmployeeLabel(employee)
      const submittedCount = assignments.filter((assignment) => assignment.status === 'SUBMITTED').length
      const inProgressCount = assignments.filter((assignment) => assignment.status === 'IN_PROGRESS').length
      const pendingCount = Math.max(0, assignments.length - submittedCount - inProgressCount)
      const progress = assignments.length ? (submittedCount / assignments.length) * 100 : 0
      const statusLabel = getStatusLabel({ submittedCount, inProgressCount, totalAssignments: assignments.length })
      const thresholdMet = submittedCount >= params.minRaters
      const resultAvailable = params.released && thresholdMet
      const resultStatus = getResultStatus({ thresholdMet, resultAvailable, submittedCount })

      return {
        targetId,
        name: employee?.empName ?? assignments[0]?.evaluateeName ?? '대상자 확인',
        department: label.department,
        team: label.team,
        position: label.position,
        assignments,
        totalAssignments: assignments.length,
        submittedCount,
        inProgressCount,
        pendingCount,
        progress,
        statusLabel,
        resultStatus,
        thresholdMet,
        resultAvailable,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

function buildOrgRows(targetRows: TargetRow[], scope: 'department' | 'team') {
  const grouped = groupByKey(targetRows, (row) => (scope === 'department' ? row.department : row.team))
  return Array.from(grouped.entries())
    .map(([name, rows]) => {
      const totalAssignments = rows.reduce((sum, row) => sum + row.totalAssignments, 0)
      const submittedCount = rows.reduce((sum, row) => sum + row.submittedCount, 0)
      const inProgressCount = rows.reduce((sum, row) => sum + row.inProgressCount, 0)
      const pendingCount = rows.reduce((sum, row) => sum + row.pendingCount, 0)
      const resultReadyCount = rows.filter((row) => row.thresholdMet).length
      const resultAvailableCount = rows.filter((row) => row.resultAvailable).length
      return {
        name,
        department: scope === 'team' ? rows[0]?.department ?? '본부 확인' : name,
        targetCount: rows.length,
        submittedCount,
        inProgressCount,
        pendingCount,
        progress: totalAssignments ? (submittedCount / totalAssignments) * 100 : 0,
        resultReadyCount,
        resultAvailableCount,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

function ReadinessCard(props: { targetRows: TargetRow[]; canManage: boolean }) {
  const targetCount = props.targetRows.length

  return (
    <aside className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-700">
          <Bell className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-black text-blue-950">리마인드/공유 준비 상태</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-900">
            실제 메일 발송이나 결과 공개 없이, 운영자가 대상과 조건을 확인하는 참고 영역입니다.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ['전체 대상자', formatCount(targetCount)],
          ['앱 알림 가능', '운영 설정 확인'],
          ['이메일 누락', '주소 데이터 확인'],
          ['스킵', '정책 확인'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white px-4 py-3">
            <div className="text-xs font-extrabold text-slate-500">{label}</div>
            <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" className="min-h-11 rounded-xl border border-blue-200 bg-white px-4 text-sm font-extrabold text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400" disabled>
          리마인드 준비
        </button>
        <button type="button" className="min-h-11 rounded-xl border border-blue-200 bg-white px-4 text-sm font-extrabold text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400" disabled>
          결과 공유 준비
        </button>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-blue-800">
        {props.canManage
          ? '운영 설정과 실제 발송은 승인된 운영 절차에서만 진행합니다.'
          : '운영 권한이 있는 사용자만 실제 운영 설정을 변경할 수 있습니다.'}
      </p>
    </aside>
  )
}

function TargetDetailPanel(props: {
  row?: TargetRow
  minRaters: number
  resultHref?: string
}) {
  if (!props.row) {
    return (
      <aside className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm font-semibold leading-6 text-slate-500">
        대상자 또는 조직을 선택하면 응답 현황과 결과 준비 상태가 이 영역에 표시됩니다.
      </aside>
    )
  }

  const lastSubmittedAt = props.row.assignments
    .map((assignment) => assignment.submittedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)

  return (
    <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Feedback360Avatar name={props.row.name} size="lg" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-950">{props.row.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {props.row.department} · {props.row.position}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="text-sm font-black text-slate-950">응답 현황</div>
        <div className="mt-4 grid gap-3">
          {[
            ['전체 응답자', formatCount(props.row.totalAssignments)],
            ['제출 완료', formatCount(props.row.submittedCount)],
            ['미응답', formatCount(props.row.pendingCount)],
            ['마지막 업데이트', lastSubmittedAt ?? '제출 이력 없음'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-slate-500">{label}</span>
              <span className="font-black text-slate-950">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <ProgressBar value={props.row.progress} />
          <div className="mt-2 text-right text-xs font-black text-blue-700">{formatPercent(props.row.progress)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-black text-slate-950">카테고리 현황</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {LEADERSHIP_OPS_CATEGORIES.map((category) => (
            <span key={category} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-600">
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-black text-blue-950">결과 준비 상태</div>
            <p className="mt-1 text-xs font-semibold leading-5 text-blue-900">
              익명 기준 {props.minRaters}명 이상 응답 시 결과 해석이 가능합니다.
            </p>
          </div>
          <Chip className={getResultTone(props.row.resultStatus)}>{props.row.resultStatus}</Chip>
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-blue-900">
          데이터 부족 시 결과 해석이 제한됩니다. 이 화면은 공식 점수나 등급을 자동 산정하지 않습니다.
        </p>
      </div>

      <div className="grid gap-2">
        {props.row.resultAvailable && props.resultHref ? (
          <Link href={props.resultHref} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-black text-white hover:bg-blue-800">
            결과 보기
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        ) : (
          <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400" disabled>
            응답 기준 충족 후 결과를 확인할 수 있습니다.
          </button>
        )}
        <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-400" disabled>
          리마인드 준비
        </button>
        <button type="button" className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-400" disabled>
          결과 공유 준비
        </button>
      </div>
    </aside>
  )
}

export function LeadershipDiagnosisOpsDashboard(props: {
  data: UpwardReviewPageData
  admin: AdminData
}) {
  const [activeTab, setActiveTab] = useState<TableTab>('targets')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('ALL')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [teamFilter, setTeamFilter] = useState('ALL')
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(props.admin.selectedRound?.assignments[0]?.evaluateeId ?? null)

  const selectedRound = props.admin.selectedRound
  const selectedRoundMeta = props.data.availableRounds.find((round) => round.id === selectedRound?.id)
  const minRaters = selectedRoundMeta?.minRaters ?? 3
  const released = Boolean(selectedRound?.released)
  const directoryById = useMemo(() => new Map(props.admin.employeeDirectory.map((employee) => [employee.id, employee])), [props.admin.employeeDirectory])
  const targetRows = useMemo(
    () =>
      selectedRound
        ? buildTargetRows({
            assignments: selectedRound.assignments,
            directoryById,
            minRaters,
            released,
          })
        : [],
    [directoryById, minRaters, released, selectedRound]
  )

  const departments = useMemo(() => Array.from(new Set(targetRows.map((row) => row.department))).sort((a, b) => a.localeCompare(b, 'ko')), [targetRows])
  const teams = useMemo(() => Array.from(new Set(targetRows.map((row) => row.team))).sort((a, b) => a.localeCompare(b, 'ko')), [targetRows])
  const divisionRows = useMemo(() => buildOrgRows(targetRows, 'department'), [targetRows])
  const teamRows = useMemo(() => buildOrgRows(targetRows, 'team'), [targetRows])

  const filteredTargetRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return targetRows.filter((row) => {
      if (departmentFilter !== 'ALL' && row.department !== departmentFilter) return false
      if (teamFilter !== 'ALL' && row.team !== teamFilter) return false
      if (statusFilter !== 'ALL') {
        const bucket =
          row.statusLabel === '제출 완료'
            ? 'SUBMITTED'
            : row.statusLabel === '작성 중'
              ? 'IN_PROGRESS'
              : 'PENDING'
        if (bucket !== statusFilter) return false
      }
      if (!normalizedQuery) return true
      return [row.name, row.department, row.team, row.position]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [departmentFilter, query, statusFilter, targetRows, teamFilter])

  const selectedTarget = targetRows.find((row) => row.targetId === selectedTargetId) ?? filteredTargetRows[0]
  const totalAssignments = targetRows.reduce((sum, row) => sum + row.totalAssignments, 0)
  const submittedAssignments = targetRows.reduce((sum, row) => sum + row.submittedCount, 0)
  const inProgressAssignments = targetRows.reduce((sum, row) => sum + row.inProgressCount, 0)
  const pendingAssignments = targetRows.reduce((sum, row) => sum + row.pendingCount, 0)
  const resultReadyTargets = targetRows.filter((row) => row.thresholdMet).length
  const resultAvailableTargets = targetRows.filter((row) => row.resultAvailable).length
  const progress = totalAssignments ? (submittedAssignments / totalAssignments) * 100 : 0
  const selectedResultHref = selectedTarget
    ? buildResultsHref({
        cycleId: props.data.selectedCycleId,
        roundId: selectedRound?.id,
        targetId: selectedTarget.targetId,
      })
    : undefined

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">리더십 진단 운영</p>
              <Chip className="border-blue-100 bg-blue-50 text-blue-700">HR/Admin</Chip>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">리더십 진단 운영</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              진단 기간, 대상자, 응답 현황, 결과 준비 상태를 확인합니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px]">
            <label className="space-y-2">
              <span className="text-xs font-extrabold text-slate-500">평가 주기</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                value={props.data.selectedCycleId ?? ''}
                onChange={(event) => {
                  const cycleId = event.target.value
                  if (!cycleId) return
                  window.location.href = `/evaluation/upward/admin?cycleId=${encodeURIComponent(cycleId)}`
                }}
              >
                {props.data.availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-extrabold text-slate-500">진단 기간</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                value={selectedRound?.id ?? ''}
                onChange={(event) => {
                  const roundId = event.target.value
                  if (!roundId) return
                  const search = new URLSearchParams()
                  if (props.data.selectedCycleId) search.set('cycleId', props.data.selectedCycleId)
                  search.set('roundId', roundId)
                  window.location.href = `/evaluation/upward/admin?${search.toString()}`
                }}
              >
                {props.data.availableRounds.length ? (
                  props.data.availableRounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      {round.roundName} · {round.statusLabel}
                    </option>
                  ))
                ) : (
                  <option value="">진단 기간 없음</option>
                )}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
            <ShieldCheck className="mr-2 inline h-4 w-4" />
            공식 평가 점수나 등급을 자동 산정하지 않습니다.
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
            <Info className="mr-2 inline h-4 w-4" />
            AI 코칭/결과 요약은 참고용이며 공식 반영은 별도 절차가 필요합니다.
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="전체 대상자" value={formatCount(targetRows.length)} helper="선택한 진단 기간의 리더 수" tone="blue" />
        <SummaryCard label="응답 완료" value={formatCount(submittedAssignments, '건')} helper="제출 완료 응답 수" tone="emerald" />
        <SummaryCard label="작성 중" value={formatCount(inProgressAssignments, '건')} helper="임시 작성 중 응답 수" tone="amber" />
        <SummaryCard label="미응답" value={formatCount(pendingAssignments, '건')} helper="아직 작성하지 않은 응답 수" tone="rose" />
        <SummaryCard label="결과 준비" value={formatCount(resultReadyTargets)} helper="응답 기준을 충족한 대상자" tone="blue" />
        <SummaryCard label="결과 확인 가능" value={formatCount(resultAvailableTargets)} helper="공개 조건까지 충족한 대상자" tone="emerald" />
        <SummaryCard label="응답 기준 충족" value={formatCount(resultReadyTargets)} helper={`기준 ${minRaters}명 이상 응답`} tone="slate" />
        <SummaryCard label="진행률" value={formatPercent(progress)} helper={`${submittedAssignments}/${totalAssignments}건 제출`} tone="blue" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_180px_180px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-300"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="대상자, 소속, 직책 검색"
              />
            </label>
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="ALL">전체 본부</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
              <option value="ALL">전체 팀</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            <select className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200">
            {[
              ['targets', '대상자별 현황'],
              ['divisions', '본부별 현황'],
              ['teams', '팀별 현황'],
              ['results', '결과 준비'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`border-b-2 px-3 py-3 text-sm font-black ${
                  activeTab === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => setActiveTab(value as TableTab)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'targets' ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[minmax(220px,1.4fr)_minmax(140px,0.9fr)_110px_110px_130px_150px_130px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
                <span>대상자</span>
                <span>소속</span>
                <span>직책</span>
                <span>진단 상태</span>
                <span>응답 완료</span>
                <span>진행률</span>
                <span>작업</span>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredTargetRows.length ? (
                  filteredTargetRows.map((row) => {
                    const href = buildResultsHref({ cycleId: props.data.selectedCycleId, roundId: selectedRound?.id, targetId: row.targetId })
                    return (
                      <div
                        key={row.targetId}
                        className="grid w-full cursor-pointer grid-cols-[minmax(220px,1.4fr)_minmax(140px,0.9fr)_110px_110px_130px_150px_130px] items-center gap-3 px-4 py-4 text-left text-sm hover:bg-slate-50"
                        onClick={() => setSelectedTargetId(row.targetId)}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Feedback360Avatar name={row.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-black text-slate-950">{row.name}</span>
                            <span className="block truncate text-xs font-semibold text-slate-500">{row.team}</span>
                          </span>
                        </span>
                        <span className="truncate font-semibold text-slate-600">{row.department}</span>
                        <span className="truncate font-bold text-slate-700">{row.position}</span>
                        <Chip className={getStatusTone(row.statusLabel)}>{row.statusLabel}</Chip>
                        <span className="font-black text-slate-950">
                          {row.submittedCount}/{row.totalAssignments}
                        </span>
                        <span className="space-y-2">
                          <ProgressBar value={row.progress} />
                          <span className="block text-xs font-black text-blue-700">{formatPercent(row.progress)}</span>
                        </span>
                        <span>
                          {row.resultAvailable ? (
                            <Link href={href} className="inline-flex min-h-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700" onClick={(event) => event.stopPropagation()}>
                              결과 보기
                            </Link>
                          ) : (
                            <span className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-400">
                              상세 보기
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    선택한 조건에 해당하는 리더십 진단 대상자가 없습니다.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'divisions' ? (
            <OrgTable rows={divisionRows} type="division" />
          ) : null}

          {activeTab === 'teams' ? (
            <OrgTable rows={teamRows} type="team" />
          ) : null}

          {activeTab === 'results' ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[minmax(220px,1.4fr)_110px_130px_150px_150px_130px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
                <span>대상자</span>
                <span>응답 수</span>
                <span>기준 충족</span>
                <span>결과 생성 상태</span>
                <span>AI 코칭 가능 여부</span>
                <span>결과 조회</span>
              </div>
              <div className="divide-y divide-slate-100">
                {filteredTargetRows.length ? (
                  filteredTargetRows.map((row) => {
                    const href = buildResultsHref({ cycleId: props.data.selectedCycleId, roundId: selectedRound?.id, targetId: row.targetId })
                    return (
                      <div key={row.targetId} className="grid grid-cols-[minmax(220px,1.4fr)_110px_130px_150px_150px_130px] items-center gap-3 px-4 py-4 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <Feedback360Avatar name={row.name} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate font-black text-slate-950">{row.name}</div>
                            <div className="truncate text-xs font-semibold text-slate-500">{row.department}</div>
                          </div>
                        </div>
                        <span className="font-black text-slate-950">{row.submittedCount}명</span>
                        <Chip className={row.thresholdMet ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}>
                          {row.thresholdMet ? '충족' : '미충족'}
                        </Chip>
                        <Chip className={getResultTone(row.resultStatus)}>{row.resultStatus}</Chip>
                        <Chip className={row.thresholdMet ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}>
                          {row.thresholdMet ? '가능' : '대기'}
                        </Chip>
                        {row.resultAvailable ? (
                          <Link href={href} className="inline-flex min-h-9 items-center justify-center rounded-xl bg-blue-700 px-3 text-xs font-black text-white">
                            결과 보기
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">기준 충족 후 확인</span>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    결과 준비 상태를 표시할 대상자가 없습니다.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <TargetDetailPanel row={selectedTarget} minRaters={minRaters} resultHref={selectedResultHref} />
          <ReadinessCard targetRows={targetRows} canManage={Boolean(props.data.permissions?.canManageRounds)} />
        </div>
      </div>
    </section>
  )
}

function OrgTable(props: {
  type: 'division' | 'team'
  rows: Array<{
    name: string
    department: string
    targetCount: number
    submittedCount: number
    inProgressCount: number
    pendingCount: number
    progress: number
    resultReadyCount: number
    resultAvailableCount: number
  }>
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_110px_110px_110px_130px_130px] gap-3 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
        <span>{props.type === 'division' ? '본부' : '팀'}</span>
        <span>{props.type === 'division' ? '대상자 수' : '본부'}</span>
        <span>응답 완료</span>
        <span>작성 중</span>
        <span>미응답</span>
        <span>진행률</span>
        <span>결과 준비</span>
      </div>
      <div className="divide-y divide-slate-100">
        {props.rows.length ? (
          props.rows.map((row) => (
            <div key={`${props.type}:${row.name}`} className="grid grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_110px_110px_110px_130px_130px] items-center gap-3 px-4 py-4 text-sm">
              <span className="font-black text-slate-950">{row.name}</span>
              <span className="font-semibold text-slate-600">{props.type === 'division' ? `${row.targetCount}명` : row.department}</span>
              <span className="font-black text-emerald-700">{row.submittedCount}건</span>
              <span className="font-black text-blue-700">{row.inProgressCount}건</span>
              <span className="font-black text-rose-700">{row.pendingCount}건</span>
              <span className="space-y-2">
                <ProgressBar value={row.progress} />
                <span className="block text-xs font-black text-blue-700">{formatPercent(row.progress)}</span>
              </span>
              <span className="font-black text-slate-950">
                {row.resultAvailableCount}/{row.resultReadyCount}
              </span>
            </div>
          ))
        ) : (
          <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
            운영 대상자 데이터가 준비되면 현황이 표시됩니다.
          </div>
        )}
      </div>
    </div>
  )
}
