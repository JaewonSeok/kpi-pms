'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Download,
  FileSearch,
  GitCompareArrows,
  Lock,
  PlayCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Users,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type {
  CompensationManagePageData,
  CompensationManageViewModel,
  CompensationScenarioVisualStatus,
} from '@/server/compensation-manage'

type CompensationManageClientProps = CompensationManagePageData
type CompensationTab = 'overview' | 'rules' | 'employees' | 'approval' | 'publish'
type RuleDraftRow = CompensationManageViewModel['rules'][number]

const TAB_LABELS: Record<CompensationTab, string> = {
  overview: '시나리오 요약',
  rules: '규칙 테이블',
  employees: '직원별 시뮬레이션',
  approval: '승인 이력',
  publish: '공개/배포 준비',
}

const STATUS_LABELS: Record<CompensationScenarioVisualStatus, string> = {
  DRAFT: '초안',
  UNDER_REVIEW: '검토 중',
  REVIEW_APPROVED: '검토 승인',
  REJECTED: '반려',
  FINAL_APPROVED: '최종 승인',
  PUBLISHED: '공개됨',
}

export function CompensationManageClient(props: CompensationManageClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<CompensationTab>('overview')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createBudgetLimit, setCreateBudgetLimit] = useState(0)
  const [ruleChangeReason, setRuleChangeReason] = useState('')
  const [rulesDraft, setRulesDraft] = useState<RuleDraftRow[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [jobGroupFilter, setJobGroupFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'impact' | 'name'>('impact')
  const [excludedOnly, setExcludedOnly] = useState(false)
  const [workflowComment, setWorkflowComment] = useState('')
  const [publishNote, setPublishNote] = useState('')

  const viewModel = props.viewModel
  const cycles = props.availableCycles
  const selectedCycle =
    cycles.find((cycle) => cycle.id === props.selectedCycleId) ?? cycles[0]

  useEffect(() => {
    if (!viewModel) return
    setCreateName(`${viewModel.cycle.name} 보상 시나리오`)
    setCreateBudgetLimit(viewModel.scenario?.budgetLimit ?? 500000000)
    setRulesDraft(viewModel.rules)
    setSelectedEmployeeId(viewModel.employees[0]?.id ?? '')
    setDepartmentFilter('all')
    setJobGroupFilter('all')
    setGradeFilter('all')
    setExcludedOnly(false)
  }, [viewModel])

  const availableYears = useMemo(
    () =>
      Array.from(new Set(cycles.map((cycle) => cycle.year))).sort((a, b) => b - a),
    [cycles]
  )

  const cycleOptions = useMemo(() => {
    const year = props.selectedYear ?? selectedCycle?.year ?? new Date().getFullYear()
    return cycles.filter((cycle) => cycle.year === year)
  }, [cycles, props.selectedYear, selectedCycle?.year])

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>()
    viewModel?.employees.forEach((employee) => {
      if (!map.has(employee.departmentId)) map.set(employee.departmentId, employee.department)
    })
    return [{ id: 'all', label: '전체 조직' }].concat(
      [...map.entries()].map(([id, label]) => ({ id, label }))
    )
  }, [viewModel])

  const jobGroupOptions = useMemo(() => {
    return ['all'].concat(
      Array.from(
        new Set(viewModel?.employees.map((employee) => employee.jobGroup).filter(Boolean) ?? [])
      ) as string[]
    )
  }, [viewModel])

  const gradeOptions = useMemo(() => {
    return ['all'].concat(viewModel?.gradeOptions.map((grade) => grade.grade) ?? [])
  }, [viewModel])

  const rulesChanged = useMemo(() => {
    if (!viewModel) return false
    return JSON.stringify(normalizeRules(rulesDraft)) !== JSON.stringify(normalizeRules(viewModel.rules))
  }, [rulesDraft, viewModel])

  const filteredEmployees = useMemo(() => {
    if (!viewModel) return []
    const rows = viewModel.employees.filter((employee) => {
      if (departmentFilter !== 'all' && employee.departmentId !== departmentFilter) return false
      if (jobGroupFilter !== 'all' && employee.jobGroup !== jobGroupFilter) return false
      if (gradeFilter !== 'all' && employee.finalGrade !== gradeFilter) return false
      if (excludedOnly && !employee.excluded) return false
      return true
    })

    return [...rows].sort((left, right) =>
      sortBy === 'impact'
        ? right.totalDelta - left.totalDelta
        : left.name.localeCompare(right.name, 'ko-KR')
    )
  }, [departmentFilter, excludedOnly, gradeFilter, jobGroupFilter, sortBy, viewModel])

  useEffect(() => {
    if (!filteredEmployees.length) return
    if (!filteredEmployees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(filteredEmployees[0].id)
    }
  }, [filteredEmployees, selectedEmployeeId])

  const selectedEmployee =
    filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ??
    viewModel?.employees.find((employee) => employee.id === selectedEmployeeId) ??
    filteredEmployees[0] ??
    viewModel?.employees[0] ??
    null

  const recalculatedTotals = useMemo(() => {
    if (!viewModel?.employees.length) return { totalCost: 0, totalDelta: 0 }
    const ruleMap = new Map(rulesDraft.map((rule) => [rule.gradeName, rule] as const))
    const totalCost = viewModel.employees.reduce((sum, employee) => {
      const rule = ruleMap.get(employee.finalGrade)
      if (!rule) return sum
      const bonus = employee.currentSalary * (rule.bonusRate / 100)
      const salaryIncrease = employee.currentSalary * (rule.salaryIncreaseRate / 100)
      return sum + bonus + salaryIncrease
    }, 0)

    return {
      totalCost: Math.round(totalCost),
      totalDelta: Math.round(totalCost - viewModel.summary.totalDelta),
    }
  }, [rulesDraft, viewModel])

  function pushQuery(next: { year?: number; cycleId?: string; scenarioId?: string }) {
    const query = new URLSearchParams()
    const year = next.year ?? props.selectedYear ?? selectedCycle?.year
    const cycleId = next.cycleId ?? props.selectedCycleId ?? selectedCycle?.id
    const scenarioId =
      next.scenarioId === ''
        ? undefined
        : next.scenarioId ?? props.selectedScenarioId ?? viewModel?.scenario?.id

    if (year) query.set('year', String(year))
    if (cycleId) query.set('cycleId', cycleId)
    if (scenarioId) query.set('scenarioId', scenarioId)
    router.push(`/compensation/manage?${query.toString()}`)
  }

  async function handleCreateScenario(cloneFromScenarioId?: string) {
    const effectiveCycleId = props.selectedCycleId ?? selectedCycle?.id
    if (!effectiveCycleId) return
    if (!createName.trim()) return setNotice('시나리오 이름을 입력해 주세요.')
    if (!createBudgetLimit || createBudgetLimit <= 0) {
      return setNotice('총예산을 0보다 큰 값으로 입력해 주세요.')
    }

    setIsSubmitting(true)
    try {
      const data = await requestJson<{ id: string }>('/api/compensation/scenarios', {
        method: 'POST',
        body: JSON.stringify({
          evalCycleId: effectiveCycleId,
          scenarioName: createName,
          budgetLimit: createBudgetLimit,
          cloneFromScenarioId,
        }),
      })
      setNotice(cloneFromScenarioId ? '기존 시나리오를 복제해 새 버전을 만들었습니다.' : '새 시나리오를 생성했습니다.')
      pushQuery({ cycleId: effectiveCycleId, scenarioId: data.id })
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '시나리오 생성 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveRules() {
    if (!viewModel) return
    const validationError = validateRules(rulesDraft, viewModel.gradeOptions.map((grade) => grade.grade))
    if (validationError) return setNotice(validationError)

    setIsSubmitting(true)
    try {
      const data = await requestJson<{ impact?: { note?: string } }>(`/api/compensation/rules/${viewModel.cycle.year}`, {
        method: 'PUT',
        body: JSON.stringify({
          changeReason: ruleChangeReason || undefined,
          rules: rulesDraft.map((rule) => ({
            gradeName: rule.gradeName,
            bonusRate: rule.bonusRate,
            salaryIncreaseRate: rule.salaryIncreaseRate,
            description: rule.description,
          })),
        }),
      })
      setNotice(data.impact?.note || '보상 규칙 버전을 저장했습니다. 시나리오별 재계산 상태를 확인해 주세요.')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '보상 규칙 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleWorkflowAction(
    action:
      | 'SUBMIT'
      | 'REVIEW_APPROVE'
      | 'FINAL_APPROVE'
      | 'REJECT'
      | 'RECALCULATE'
      | 'PUBLISH'
  ) {
    if (!viewModel?.scenario) return
    setIsSubmitting(true)
    try {
      await requestJson(`/api/compensation/scenarios/${viewModel.scenario.id}/workflow`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          comment:
            action === 'PUBLISH'
              ? publishNote || undefined
              : workflowComment || undefined,
        }),
      })
      setWorkflowComment('')
      setPublishNote('')
      setNotice('작업을 반영했습니다.')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '워크플로 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleExport() {
    if (!viewModel?.scenario) return
    window.location.assign(`/api/compensation/scenarios/${viewModel.scenario.id}/export`)
  }

  if (props.state !== 'ready' || !viewModel) {
    return (
      <div className="space-y-6">
        <CompensationHeader selectedCycle={selectedCycle} />
        <CompensationStatePanel state={props.state} message={props.message} />
        <RelatedLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CompensationHeader selectedCycle={selectedCycle} />
      <CompensationHero
        viewModel={viewModel}
        selectedYear={props.selectedYear ?? selectedCycle?.year}
        availableYears={availableYears}
        cycleOptions={cycleOptions}
        createName={createName}
        setCreateName={setCreateName}
        createBudgetLimit={createBudgetLimit}
        setCreateBudgetLimit={setCreateBudgetLimit}
        onYearChange={(year) => {
          const nextCycle = cycles.find((cycle) => cycle.year === year)
          pushQuery({ year, cycleId: nextCycle?.id, scenarioId: '' })
        }}
        onCycleChange={(cycleId) => pushQuery({ cycleId, scenarioId: '' })}
        onScenarioChange={(scenarioId) => pushQuery({ scenarioId })}
        onCreateScenario={() => handleCreateScenario(undefined)}
        onCloneScenario={() => handleCreateScenario(viewModel.scenario?.id)}
        onRecalculate={() => handleWorkflowAction('RECALCULATE')}
        onSubmitForReview={() => handleWorkflowAction('SUBMIT')}
        onFinalApprove={() => handleWorkflowAction('FINAL_APPROVE')}
        onExport={handleExport}
        onPublish={() => handleWorkflowAction('PUBLISH')}
        isSubmitting={isSubmitting}
      />
      {notice ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      ) : null}
      <SummaryCards viewModel={viewModel} />
      <CompensationTabs activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === 'overview' ? <OverviewSection viewModel={viewModel} /> : null}
      {activeTab === 'rules' ? (
        <RuleTableSection
          viewModel={viewModel}
          rulesDraft={rulesDraft}
          changeReason={ruleChangeReason}
          setChangeReason={setRuleChangeReason}
          recalculatedTotals={recalculatedTotals}
          rulesChanged={rulesChanged}
          onUpdateRule={(ruleId, patch) =>
            setRulesDraft((current) =>
              current.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule))
            )
          }
          onAddRow={() => {
            const existing = new Set(rulesDraft.map((rule) => rule.gradeName))
            const missing = viewModel.gradeOptions.find((grade) => !existing.has(grade.grade))
            if (!missing) {
              setNotice('이미 모든 등급 규칙이 채워져 있습니다.')
              return
            }
            setRulesDraft((current) => [
              ...current,
              {
                id: `draft-${missing.id}`,
                gradeId: missing.id,
                gradeName: missing.grade,
                salaryIncreaseRate: 0,
                bonusRate: 0,
                active: true,
                description: `${missing.grade} 기본 규칙`,
                targetRatio: missing.targetRatio,
              },
            ])
          }}
          onCloneRow={(ruleId) => {
            const source = rulesDraft.find((rule) => rule.id === ruleId)
            if (!source) return
            const existing = new Set(rulesDraft.map((rule) => rule.gradeName))
            const missing = viewModel.gradeOptions.find((grade) => !existing.has(grade.grade))
            if (!missing) {
              setNotice('복제할 빈 등급이 없습니다.')
              return
            }
            setRulesDraft((current) => [
              ...current,
              {
                ...source,
                id: `clone-${ruleId}-${missing.id}`,
                gradeId: missing.id,
                gradeName: missing.grade,
                description: `${source.gradeName} 규칙 복제`,
                targetRatio: missing.targetRatio,
              },
            ])
          }}
          onReset={() => {
            setRulesDraft(viewModel.rules)
            setNotice('현재 서버 기준 규칙으로 되돌렸습니다.')
          }}
          onSave={handleSaveRules}
          isSubmitting={isSubmitting}
        />
      ) : null}
      {activeTab === 'employees' ? (
        <EmployeesSection
          employees={filteredEmployees}
          selectedEmployee={selectedEmployee}
          departmentOptions={departmentOptions}
          departmentFilter={departmentFilter}
          setDepartmentFilter={setDepartmentFilter}
          jobGroupOptions={jobGroupOptions}
          jobGroupFilter={jobGroupFilter}
          setJobGroupFilter={setJobGroupFilter}
          gradeOptions={gradeOptions}
          gradeFilter={gradeFilter}
          setGradeFilter={setGradeFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          excludedOnly={excludedOnly}
          setExcludedOnly={setExcludedOnly}
          onSelectEmployee={setSelectedEmployeeId}
        />
      ) : null}
      {activeTab === 'approval' ? (
        <ApprovalSection
          viewModel={viewModel}
          workflowComment={workflowComment}
          setWorkflowComment={setWorkflowComment}
          onReviewApprove={() => handleWorkflowAction('REVIEW_APPROVE')}
          onReject={() => handleWorkflowAction('REJECT')}
          isSubmitting={isSubmitting}
        />
      ) : null}
      {activeTab === 'publish' ? (
        <PublishSection
          viewModel={viewModel}
          publishNote={publishNote}
          setPublishNote={setPublishNote}
          onPublish={() => handleWorkflowAction('PUBLISH')}
          onExport={handleExport}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </div>
  )
}

function normalizeRules(rules: RuleDraftRow[]) {
  return [...rules]
    .map((rule) => ({
      gradeName: rule.gradeName,
      salaryIncreaseRate: Number(rule.salaryIncreaseRate.toFixed(3)),
      bonusRate: Number(rule.bonusRate.toFixed(3)),
      description: rule.description ?? '',
    }))
    .sort((left, right) => left.gradeName.localeCompare(right.gradeName, 'ko-KR'))
}

function validateRules(rules: RuleDraftRow[], gradeNames: string[]) {
  const uniqueGrades = new Set(rules.map((rule) => rule.gradeName))
  if (rules.some((rule) => rule.bonusRate < 0 || rule.salaryIncreaseRate < 0)) return '음수 비율은 저장할 수 없습니다.'
  if (rules.some((rule) => rule.bonusRate > 100 || rule.salaryIncreaseRate > 100)) return '100%를 넘는 비율은 저장할 수 없습니다.'
  if (uniqueGrades.size !== gradeNames.length) return '모든 활성 등급에 대해 규칙이 정확히 1행씩 있어야 합니다.'
  if (gradeNames.some((gradeName) => !uniqueGrades.has(gradeName))) return '누락된 등급 규칙이 있습니다.'
  return null
}

async function requestJson<T = unknown>(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const json = await response.json()
  if (!json.success) throw new Error(json.error?.message || '요청 처리 중 오류가 발생했습니다.')
  return json.data as T
}

function signedCurrency(value: number) {
  if (value === 0) return formatCurrency(0)
  return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`
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

function buildRuleWarnings(rules: RuleDraftRow[], gradeNames: string[]) {
  const warnings: string[] = []
  if (rules.some((rule) => rule.bonusRate > 60 || rule.salaryIncreaseRate > 15)) {
    warnings.push('일부 규칙 비율이 높습니다. 예산 영향과 정책 정합성을 함께 점검해 주세요.')
  }
  if (new Set(rules.map((rule) => rule.gradeName)).size !== gradeNames.length) {
    warnings.push('누락되었거나 중복된 등급 규칙이 있습니다.')
  }
  return warnings
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
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
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

function NextActionCard({
  title,
  description,
  countLabel,
}: {
  title: string
  description: string
  countLabel: string
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-blue-800">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold">다음 행동</span>
      </div>
      <div className="mt-3 text-lg font-semibold text-blue-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-blue-900/80">{description}</p>
      <div className="mt-3 text-sm text-blue-800">{countLabel}</div>
    </div>
  )
}

function HeroMetric({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${emphasis ? 'text-blue-900' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function InfoNotice({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
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

function CompareCard({ title, value, tone }: { title: string; value: string; tone: 'neutral' | 'attention' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'attention' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {children}
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
        <span className={`text-xs font-semibold ${done ? 'text-emerald-700' : 'text-amber-800'}`}>{done ? '완료' : '확인 필요'}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{hint}</p>
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
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:opacity-60 ${variant === 'primary' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
      {icon}
      {label}
    </button>
  )
}

function ActionLink({ icon, label, href, description }: { icon: ReactNode; label: string; href: string; description: string }) {
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

function ActionTypeBadge({ type }: { type: CompensationManageViewModel['approvalTimeline'][number]['actionType'] }) {
  const className = type === 'publish' ? 'bg-emerald-100 text-emerald-700' : type === 'workflow' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{type === 'publish' ? 'publish' : type === 'workflow' ? 'workflow' : 'system'}</span>
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: CompensationScenarioVisualStatus }) {
  const config = status === 'DRAFT' ? { label: '초안', className: 'bg-slate-100 text-slate-700' } : status === 'UNDER_REVIEW' ? { label: '검토 중', className: 'bg-blue-100 text-blue-700' } : status === 'REVIEW_APPROVED' ? { label: '검토 승인', className: 'bg-violet-100 text-violet-700' } : status === 'FINAL_APPROVED' ? { label: '최종 승인', className: 'bg-emerald-100 text-emerald-700' } : status === 'PUBLISHED' ? { label: '공개됨', className: 'bg-amber-100 text-amber-800' } : { label: '반려', className: 'bg-rose-100 text-rose-700' }
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>{config.label}</span>
}

function InfoBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span>
}

function CompensationStatePanel({ state, message }: { state: CompensationManageClientProps['state']; message?: string }) {
  const config = state === 'permission-denied' ? { title: '보상 시뮬레이션 관리 화면 접근 권한이 없습니다', tone: 'rose' } : state === 'error' ? { title: '보상 시뮬레이션 화면을 불러오지 못했습니다', tone: 'rose' } : { title: '표시할 보상 시뮬레이션 데이터가 없습니다', tone: 'slate' }
  const toneClass = config.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800'
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
    { href: '/evaluation/ceo-adjust', label: '대표이사 확정' },
    { href: '/admin/grades', label: '등급 설정' },
    { href: '/compensation/my', label: '내 보상 결과' },
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

function CompensationHeader({
  selectedCycle,
}: {
  selectedCycle?: CompensationManageClientProps['availableCycles'][number]
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
            Compensation Simulation Workbench
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            시뮬레이션 관리
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            보상 규칙 확인, 시나리오 생성/복제, 예산 영향 분석, 승인 워크플로, 공개 준비까지 한
            화면에서 운영합니다.
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

function CompensationHero({
  viewModel,
  selectedYear,
  availableYears,
  cycleOptions,
  createName,
  setCreateName,
  createBudgetLimit,
  setCreateBudgetLimit,
  onYearChange,
  onCycleChange,
  onScenarioChange,
  onCreateScenario,
  onCloneScenario,
  onRecalculate,
  onSubmitForReview,
  onFinalApprove,
  onExport,
  onPublish,
  isSubmitting,
}: {
  viewModel: CompensationManageViewModel
  selectedYear?: number
  availableYears: number[]
  cycleOptions: CompensationManageClientProps['availableCycles']
  createName: string
  setCreateName: (value: string) => void
  createBudgetLimit: number
  setCreateBudgetLimit: (value: number) => void
  onYearChange: (year: number) => void
  onCycleChange: (cycleId: string) => void
  onScenarioChange: (scenarioId: string) => void
  onCreateScenario: () => void
  onCloneScenario: () => void
  onRecalculate: () => void
  onSubmitForReview: () => void
  onFinalApprove: () => void
  onExport: () => void
  onPublish: () => void
  isSubmitting: boolean
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectorCard
              label="연도"
              value={String(selectedYear ?? viewModel.cycle.year)}
              options={availableYears.map((year) => ({ value: String(year), label: `${year}년` }))}
              onChange={(value) => onYearChange(Number(value))}
            />
            <SelectorCard
              label="평가 주기"
              value={viewModel.cycle.id}
              options={cycleOptions.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
              onChange={onCycleChange}
            />
            <SelectorCard
              label="시나리오"
              value={viewModel.scenario?.id ?? ''}
              options={
                viewModel.scenarioOptions.length
                  ? viewModel.scenarioOptions.map((scenario) => ({
                      value: scenario.id,
                      label: `${scenario.label} / ${STATUS_LABELS[scenario.status]}`,
                    }))
                  : [{ value: '', label: '생성된 시나리오 없음' }]
              }
              onChange={onScenarioChange}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={viewModel.scenario?.status ?? 'DRAFT'} />
            <InfoBadge label={viewModel.scenario?.isLocked ? '잠금 상태' : '편집 가능 상태'} />
            <InfoBadge label={viewModel.scenario?.approvalStateLabel ?? '시나리오 생성 필요'} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="총예산" value={formatCurrency(viewModel.scenario?.budgetLimit ?? 0)} />
            <HeroMetric label="총예상비용" value={formatCurrency(viewModel.scenario?.totalCost ?? 0)} emphasis />
            <HeroMetric label="예산 대비 차이" value={signedCurrency(viewModel.scenario?.budgetDelta ?? 0)} />
            <HeroMetric label="승인 상태" value={viewModel.scenario?.approvalStateLabel ?? '초안'} />
          </div>

          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-600">
                <div className="mb-2 font-medium text-slate-900">새 시나리오 이름</div>
                <input value={createName} onChange={(event) => setCreateName(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              </label>
              <label className="text-sm text-slate-600">
                <div className="mb-2 font-medium text-slate-900">총예산</div>
                <input type="number" value={createBudgetLimit} onChange={(event) => setCreateBudgetLimit(Number(event.target.value))} className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
              </label>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              규칙 저장과 재계산은 분리되어 있습니다. 저장 후 각 시나리오에서 재계산을 눌러야 비용이 새
              기준으로 반영됩니다.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActionButton icon={<Sparkles className="h-4 w-4" />} label="새 시나리오 생성" onClick={onCreateScenario} disabled={isSubmitting} variant="primary" />
          <ActionButton icon={<Copy className="h-4 w-4" />} label="시나리오 복제" onClick={onCloneScenario} disabled={isSubmitting || !viewModel.scenario} />
          <ActionButton icon={<RefreshCw className="h-4 w-4" />} label="재계산" onClick={onRecalculate} disabled={isSubmitting || !viewModel.scenario || viewModel.actorRole !== 'ROLE_ADMIN'} />
          <ActionButton icon={<PlayCircle className="h-4 w-4" />} label="승인 요청" onClick={onSubmitForReview} disabled={isSubmitting || !viewModel.scenario || viewModel.actorRole !== 'ROLE_ADMIN' || !['DRAFT', 'REJECTED'].includes(viewModel.scenario.status)} />
          <ActionButton icon={<ShieldCheck className="h-4 w-4" />} label="최종 승인" onClick={onFinalApprove} disabled={isSubmitting || !viewModel.scenario || viewModel.actorRole !== 'ROLE_CEO' || viewModel.scenario.status !== 'REVIEW_APPROVED'} />
          <ActionButton icon={<Download className="h-4 w-4" />} label="Export" onClick={onExport} disabled={isSubmitting || !viewModel.scenario} />
          <ActionButton icon={<Lock className="h-4 w-4" />} label="공개" onClick={onPublish} disabled={isSubmitting || !viewModel.scenario || viewModel.actorRole !== 'ROLE_ADMIN' || !viewModel.publishChecklist.readyToPublish} />
        </div>
      </div>
    </section>
  )
}

function SummaryCards({ viewModel }: { viewModel: CompensationManageViewModel }) {
  const nextAction =
    viewModel.risks.staleCalculation
      ? '재계산 필요'
      : viewModel.summary.overBudget
        ? '예산 초과 시나리오 확인'
        : viewModel.publishChecklist.readyToPublish
          ? '공개 전 최종 점검'
          : '승인 요청 전 체크리스트 확인'

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <SummaryCard icon={<Users className="h-5 w-5" />} label="총 인원 수" value={`${viewModel.summary.employeeCount}명`} description="현재 시나리오 계산 대상" />
      <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} label="시뮬레이션 반영 인원" value={`${viewModel.summary.impactedCount}명`} description="보상 증가가 반영된 인원" />
      <SummaryCard icon={<CircleDollarSign className="h-5 w-5" />} label="총보상 증가액" value={formatCurrency(viewModel.summary.totalDelta)} description="연봉 인상 + 성과급 합계" />
      <SummaryCard icon={<GitCompareArrows className="h-5 w-5" />} label="평균 인상률" value={`${viewModel.summary.avgIncreaseRate.toFixed(1)}%`} description="직원별 인상률 평균" />
      <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="예산 잔여/초과" value={viewModel.summary.overBudget ? `-${formatCurrency(viewModel.summary.overBudgetAmount)}` : formatCurrency(viewModel.summary.remainingBudget)} description={viewModel.summary.overBudget ? '예산 초과' : '예산 잔여'} />
      <NextActionCard title={nextAction} description={viewModel.summary.approvalPendingLabel} countLabel={`평가 미완료 ${viewModel.risks.incompleteEvaluationCount}명 / 제외 ${viewModel.risks.excludedCount}명`} />
    </section>
  )
}

function CompensationTabs({ activeTab, onChange }: { activeTab: CompensationTab; onChange: (tab: CompensationTab) => void }) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {(Object.keys(TAB_LABELS) as CompensationTab[]).map((tab) => (
          <button key={tab} type="button" onClick={() => onChange(tab)} className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  )
}

function OverviewSection({ viewModel }: { viewModel: CompensationManageViewModel }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="시나리오 기본 정보" description="버전, 상태, 비교 기준, 기준 시나리오 정보를 한눈에 확인합니다.">
        {viewModel.scenario ? (
          <div className="grid gap-4 md:grid-cols-2">
            <MiniMetric label="이름" value={viewModel.scenario.name} />
            <MiniMetric label="버전" value={`v${viewModel.scenario.version}`} />
            <MiniMetric label="상태" value={STATUS_LABELS[viewModel.scenario.status]} />
            <MiniMetric label="생성자" value={viewModel.scenario.createdBy} />
            <MiniMetric label="생성일" value={formatDateTime(viewModel.scenario.createdAt)} />
            <MiniMetric label="최근 업데이트" value={formatDateTime(viewModel.scenario.updatedAt)} />
            <MiniMetric label="비교 기준" value={viewModel.comparison.baselineLabel} />
            <MiniMetric label="원본 시나리오" value={viewModel.scenario.sourceScenarioLabel ?? '직전 버전 기준'} />
          </div>
        ) : (
          <EmptyCard title="선택된 시나리오가 없습니다" description="새 시나리오를 만들면 버전, 예산, 상태, 비교 정보가 이 영역에 표시됩니다." />
        )}
      </SectionCard>

      <SectionCard title="예산 및 리스크 요약" description="비용 변화, 리스크, 비용 breakdown을 먼저 확인하고 이후 탭으로 내려갑니다.">
        <div className="space-y-4">
          <CompareCard title="기준 시나리오 대비 비용 변화" value={signedCurrency(viewModel.comparison.costDelta)} tone={viewModel.comparison.costDelta > 0 ? 'attention' : 'neutral'} />
          <CompareCard title="기준 시나리오 대비 반영 인원 변화" value={`${viewModel.comparison.headcountDelta > 0 ? '+' : ''}${viewModel.comparison.headcountDelta}명`} tone={viewModel.comparison.headcountDelta !== 0 ? 'attention' : 'neutral'} />
          <InfoNotice icon={<AlertTriangle className="h-4 w-4" />} title="리스크 요약" description={`평가 미완료 ${viewModel.risks.incompleteEvaluationCount}명, 규칙 누락 ${viewModel.risks.missingRuleCount}건, 계산 제외 ${viewModel.risks.excludedCount}명, 재계산 필요 ${viewModel.risks.staleCalculation ? '예' : '아니오'}`} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">총 비용 breakdown</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="기본급 인상" value={formatCurrency(viewModel.summary.totalSalaryIncrease)} />
              <MiniMetric label="성과급" value={formatCurrency(viewModel.summary.totalBonus)} />
              <MiniMetric label="기타 보상" value={formatCurrency(0)} />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function RuleTableSection({
  viewModel,
  rulesDraft,
  changeReason,
  setChangeReason,
  recalculatedTotals,
  rulesChanged,
  onUpdateRule,
  onAddRow,
  onCloneRow,
  onReset,
  onSave,
  isSubmitting,
}: {
  viewModel: CompensationManageViewModel
  rulesDraft: RuleDraftRow[]
  changeReason: string
  setChangeReason: (value: string) => void
  recalculatedTotals: { totalCost: number; totalDelta: number }
  rulesChanged: boolean
  onUpdateRule: (ruleId: string, patch: Partial<RuleDraftRow>) => void
  onAddRow: () => void
  onCloneRow: (ruleId: string) => void
  onReset: () => void
  onSave: () => void
  isSubmitting: boolean
}) {
  const readOnly = viewModel.actorRole !== 'ROLE_ADMIN'
  const warnings = buildRuleWarnings(rulesDraft, viewModel.gradeOptions.map((grade) => grade.grade))

  return (
    <SectionCard title="규칙 테이블" description="저장과 재계산을 분리해 변경 영향과 운영 타이밍을 명확하게 관리합니다.">
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <label className="block text-sm text-slate-600">
            <div className="mb-2 font-medium text-slate-900">변경 사유</div>
            <input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} readOnly={readOnly} placeholder="예: B등급 인상률 조정" className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm" />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            현재 draft 기준으로 총예상비용이 {signedCurrency(recalculatedTotals.totalDelta)} 변합니다. 저장 후에는 시나리오별 재계산이 필요합니다.
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <ActionButton icon={<TableProperties className="h-4 w-4" />} label="행 추가" onClick={onAddRow} disabled={readOnly} />
          <ActionButton icon={<RefreshCw className="h-4 w-4" />} label="초기화" onClick={onReset} disabled={readOnly || !rulesChanged} />
          <ActionButton icon={<Save className="h-4 w-4" />} label="규칙 저장" onClick={onSave} disabled={readOnly || !rulesChanged || isSubmitting} variant="primary" />
        </div>
      </div>

      {warnings.length ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">저장 전 확인이 필요한 항목</div>
          <div className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <div key={warning}>• {warning}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-3 py-3">등급</th>
              <th className="px-3 py-3">보너스율</th>
              <th className="px-3 py-3">연봉인상률</th>
              <th className="px-3 py-3">연결 평가 밴드</th>
              <th className="px-3 py-3">설명</th>
              <th className="px-3 py-3 text-right">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rulesDraft.map((rule) => (
              <tr key={rule.id}>
                <td className="px-3 py-3 font-semibold text-slate-900">{rule.gradeName}</td>
                <td className="px-3 py-3"><input type="number" step="0.1" value={rule.bonusRate} onChange={(event) => onUpdateRule(rule.id, { bonusRate: Number(event.target.value) })} readOnly={readOnly} className="w-28 rounded-lg border border-gray-300 px-3 py-2" /></td>
                <td className="px-3 py-3"><input type="number" step="0.1" value={rule.salaryIncreaseRate} onChange={(event) => onUpdateRule(rule.id, { salaryIncreaseRate: Number(event.target.value) })} readOnly={readOnly} className="w-28 rounded-lg border border-gray-300 px-3 py-2" /></td>
                <td className="px-3 py-3 text-slate-500">{rule.targetRatio !== undefined ? `목표 ${rule.targetRatio}%` : '설정 없음'}</td>
                <td className="px-3 py-3"><input value={rule.description ?? ''} onChange={(event) => onUpdateRule(rule.id, { description: event.target.value })} readOnly={readOnly} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></td>
                <td className="px-3 py-3 text-right"><button type="button" onClick={() => onCloneRow(rule.id)} disabled={readOnly} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">복제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

function EmployeesSection({
  employees,
  selectedEmployee,
  departmentOptions,
  departmentFilter,
  setDepartmentFilter,
  jobGroupOptions,
  jobGroupFilter,
  setJobGroupFilter,
  gradeOptions,
  gradeFilter,
  setGradeFilter,
  sortBy,
  setSortBy,
  excludedOnly,
  setExcludedOnly,
  onSelectEmployee,
}: {
  employees: CompensationManageViewModel['employees']
  selectedEmployee: CompensationManageViewModel['employees'][number] | null
  departmentOptions: Array<{ id: string; label: string }>
  departmentFilter: string
  setDepartmentFilter: (value: string) => void
  jobGroupOptions: string[]
  jobGroupFilter: string
  setJobGroupFilter: (value: string) => void
  gradeOptions: string[]
  gradeFilter: string
  setGradeFilter: (value: string) => void
  sortBy: 'impact' | 'name'
  setSortBy: (value: 'impact' | 'name') => void
  excludedOnly: boolean
  setExcludedOnly: (value: boolean) => void
  onSelectEmployee: (id: string) => void
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="직원별 시뮬레이션" description="예산 영향이 큰 직원부터 보고, 계산 근거를 상세 패널에서 확인합니다.">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SelectorCard label="조직" value={departmentFilter} options={departmentOptions.map((option) => ({ value: option.id, label: option.label }))} onChange={setDepartmentFilter} />
          <SelectorCard label="직군" value={jobGroupFilter} options={jobGroupOptions.map((option) => ({ value: option, label: option === 'all' ? '전체 직군' : option }))} onChange={setJobGroupFilter} />
          <SelectorCard label="등급" value={gradeFilter} options={gradeOptions.map((option) => ({ value: option, label: option === 'all' ? '전체 등급' : option }))} onChange={setGradeFilter} />
          <SelectorCard label="정렬" value={sortBy} options={[{ value: 'impact', label: '예산 영향 큰 순' }, { value: 'name', label: '이름 순' }]} onChange={(value) => setSortBy(value as 'impact' | 'name')} />
          <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">제외 대상만</span>
            <div className="mt-4 flex items-center gap-3">
              <input type="checkbox" checked={excludedOnly} onChange={(event) => setExcludedOnly(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
              <span className="text-sm text-slate-700">제외/예외 인원만 보기</span>
            </div>
          </label>
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-3">이름</th>
                <th className="px-3 py-3">부서</th>
                <th className="px-3 py-3">직군</th>
                <th className="px-3 py-3">최종등급</th>
                <th className="px-3 py-3">현재연봉</th>
                <th className="px-3 py-3">인상률</th>
                <th className="px-3 py-3">인상액</th>
                <th className="px-3 py-3">성과급액</th>
                <th className="px-3 py-3">총증가액</th>
                <th className="px-3 py-3">반영 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((employee) => (
                <tr key={employee.id} onClick={() => onSelectEmployee(employee.id)} className={`cursor-pointer transition hover:bg-slate-50 ${selectedEmployee?.id === employee.id ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-3 font-medium text-slate-900">{employee.name}</td>
                  <td className="px-3 py-3 text-slate-500">{employee.department}</td>
                  <td className="px-3 py-3 text-slate-500">{employee.jobGroup ?? '-'}</td>
                  <td className="px-3 py-3">{employee.finalGrade}</td>
                  <td className="px-3 py-3">{formatCurrency(employee.currentSalary)}</td>
                  <td className="px-3 py-3">{employee.salaryIncreaseRate.toFixed(1)}%</td>
                  <td className="px-3 py-3">{formatCurrency(employee.salaryIncreaseAmount)}</td>
                  <td className="px-3 py-3">{formatCurrency(employee.bonusAmount)}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(employee.totalDelta)}</td>
                  <td className="px-3 py-3">{employee.excluded ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">제외</span> : <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">반영</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 xl:hidden">
          {employees.map((employee) => (
            <button key={employee.id} type="button" onClick={() => onSelectEmployee(employee.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedEmployee?.id === employee.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{employee.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{employee.department} / {employee.jobGroup ?? '-'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">{formatCurrency(employee.totalDelta)}</div>
                  <div className="mt-1 text-xs text-slate-500">{employee.finalGrade}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="직원 상세 패널" description="평가 결과, 계산 근거, rule version, 월간 실적 근거까지 묶어 설명합니다.">
        {selectedEmployee ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <MiniMetric label="현재연봉" value={formatCurrency(selectedEmployee.currentSalary)} />
              <MiniMetric label="예상연봉" value={formatCurrency(selectedEmployee.projectedSalary)} />
              <MiniMetric label="인상액" value={formatCurrency(selectedEmployee.salaryIncreaseAmount)} />
              <MiniMetric label="성과급액" value={formatCurrency(selectedEmployee.bonusAmount)} />
              <MiniMetric label="총증가액" value={formatCurrency(selectedEmployee.totalDelta)} />
              <MiniMetric label="rule version" value={`v${selectedEmployee.ruleVersion}`} />
            </div>
            <InfoNotice icon={<CircleDollarSign className="h-4 w-4" />} title="계산 근거" description={`현재연봉 ${formatCurrency(selectedEmployee.currentSalary)} 기준으로 연봉인상률 ${selectedEmployee.salaryIncreaseRate.toFixed(1)}%, 성과급률 ${selectedEmployee.bonusRate.toFixed(1)}%가 적용되었습니다.${selectedEmployee.calculationNote ? ` 메모: ${selectedEmployee.calculationNote}` : ''}`} />
            <InfoNotice icon={<FileSearch className="h-4 w-4" />} title="평가 결과 요약" description={`${selectedEmployee.finalGrade} / 성과 ${selectedEmployee.performanceScore?.toFixed(1) ?? '-'}점 / 역량 ${selectedEmployee.competencyScore?.toFixed(1) ?? '-'}점 / 평가자 ${selectedEmployee.evaluatorName ?? '미지정'}`} />
            <SubSection title="연결된 KPI 근거">
              {selectedEmployee.kpiHighlights.length ? selectedEmployee.kpiHighlights.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-medium text-slate-900">{item.title}</div>
                  <div className="mt-2 text-sm text-slate-600">목표 {formatMetric(item.target, item.unit)} / 실적 {formatMetric(item.actual, item.unit)} / 달성률 {item.achievementRate !== undefined ? `${item.achievementRate.toFixed(1)}%` : '-'}</div>
                </div>
              )) : <EmptyCard title="표시할 KPI 근거가 없습니다" description="연결된 KPI나 월간 실적 데이터가 아직 없습니다." />}
            </SubSection>
          </div>
        ) : (
          <EmptyCard title="직원을 선택해 주세요" description="왼쪽 목록에서 직원을 선택하면 계산 근거와 평가 정보를 상세하게 볼 수 있습니다." />
        )}
      </SectionCard>
    </div>
  )
}

function ApprovalSection({
  viewModel,
  workflowComment,
  setWorkflowComment,
  onReviewApprove,
  onReject,
  isSubmitting,
}: {
  viewModel: CompensationManageViewModel
  workflowComment: string
  setWorkflowComment: (value: string) => void
  onReviewApprove: () => void
  onReject: () => void
  isSubmitting: boolean
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="승인 이력" description="누가, 언제, 어떤 상태에서 어떤 상태로 바꿨는지 타임라인으로 보여줍니다.">
        <div className="space-y-4">
          {viewModel.approvalTimeline.length ? viewModel.approvalTimeline.map((item, index) => (
            <div key={item.id} className="flex gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">{index + 1}</div>
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2"><ActionTypeBadge type={item.actionType} /><span className="font-semibold text-slate-900">{item.action}</span></div>
                  <span className="text-xs text-slate-500">{formatDateTime(item.at)}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">{item.actor}</div>
                <div className="mt-2 text-sm text-slate-700">{item.fromStatus ? `${item.fromStatus} → ${item.toStatus ?? '-'}` : item.toStatus ?? '-'}</div>
                {item.note ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p> : null}
              </div>
            </div>
          )) : <EmptyCard title="승인 이력이 없습니다" description="시나리오를 생성하고 승인 요청을 보내면 이력이 누적됩니다." />}
        </div>
      </SectionCard>

      <SectionCard title="검토 액션" description="본부장과 CEO는 이 영역에서 승인/반려 코멘트를 남길 수 있습니다.">
        <div className="space-y-4">
          <label className="block text-sm text-slate-600">
            <div className="mb-2 font-medium text-slate-900">검토 코멘트</div>
            <textarea value={workflowComment} onChange={(event) => setWorkflowComment(event.target.value)} className="min-h-32 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" placeholder="승인 또는 반려 판단의 근거를 남겨 두세요." />
          </label>
          <ActionButton icon={<ShieldCheck className="h-4 w-4" />} label="검토 승인" onClick={onReviewApprove} disabled={isSubmitting || viewModel.actorRole === 'ROLE_ADMIN' || !viewModel.scenario || viewModel.scenario.status !== 'UNDER_REVIEW'} variant="primary" />
          <ActionButton icon={<AlertTriangle className="h-4 w-4" />} label="반려" onClick={onReject} disabled={isSubmitting || viewModel.actorRole === 'ROLE_ADMIN' || !viewModel.scenario || !['UNDER_REVIEW', 'REVIEW_APPROVED'].includes(viewModel.scenario.status)} />
        </div>
      </SectionCard>
    </div>
  )
}

function PublishSection({
  viewModel,
  publishNote,
  setPublishNote,
  onPublish,
  onExport,
  isSubmitting,
}: {
  viewModel: CompensationManageViewModel
  publishNote: string
  setPublishNote: (value: string) => void
  onPublish: () => void
  onExport: () => void
  isSubmitting: boolean
}) {
  const checklist = [
    { label: '최종 승인 완료', done: viewModel.publishChecklist.approved, hint: viewModel.publishChecklist.approved ? '최종 승인 단계까지 완료되었습니다.' : '최종 승인 전에는 공개할 수 없습니다.' },
    { label: '재계산 최신 상태', done: viewModel.publishChecklist.recalculated, hint: viewModel.publishChecklist.recalculated ? '최신 규칙 기준으로 계산되었습니다.' : '규칙 저장 이후 재계산이 필요합니다.' },
    { label: '예산 초과 없음 또는 예외 승인 완료', done: viewModel.publishChecklist.budgetReviewed, hint: viewModel.publishChecklist.budgetReviewed ? '예산 상태를 검토했습니다.' : '예산 초과 상태를 먼저 검토해 주세요.' },
    { label: '제외 인원 검토 완료', done: viewModel.publishChecklist.exceptionsReviewed, hint: viewModel.publishChecklist.exceptionsReviewed ? '제외/예외 처리된 인원을 모두 검토했습니다.' : '제외 인원 사유를 먼저 채워 주세요.' },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="공개 전 체크리스트" description="공개 후에는 /compensation/my 에 노출되고 수정이 제한됩니다.">
        <div className="space-y-4">
          {checklist.map((item) => (
            <ChecklistRow key={item.label} label={item.label} done={item.done} hint={item.hint} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="공개 실행" description="공개 note를 남기면 이후 운영 이력과 커뮤니케이션에 활용할 수 있습니다.">
        <div className="space-y-4">
          <label className="block text-sm text-slate-600">
            <div className="mb-2 font-medium text-slate-900">Publish note</div>
            <textarea value={publishNote} onChange={(event) => setPublishNote(event.target.value)} className="min-h-32 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" placeholder="예: 2026 상반기 최종 승인본 기준" />
          </label>
          <ActionButton icon={<Lock className="h-4 w-4" />} label="공개" onClick={onPublish} disabled={isSubmitting || !viewModel.scenario || viewModel.actorRole !== 'ROLE_ADMIN' || !viewModel.publishChecklist.readyToPublish} variant="primary" />
          <ActionButton icon={<Download className="h-4 w-4" />} label="Export" onClick={onExport} disabled={!viewModel.scenario} />
          <ActionLink icon={<FileSearch className="h-4 w-4" />} label="내 보상 결과 보기" href="/compensation/my" description="공개 이후 구성원 화면에서 어떤 모습으로 보일지 확인합니다." />
        </div>
      </SectionCard>
    </div>
  )
}
