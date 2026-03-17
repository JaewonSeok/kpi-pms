'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { COMPENSATION_STATUS_LABELS, formatCurrency, formatDate, getCurrentYear } from '@/lib/utils'

interface RuleRow {
  gradeName: string
  bonusRate: number
  salaryIncreaseRate: number
  description?: string
}

interface CycleRow {
  id: string
  cycleName: string
  evalYear: number
}

interface ScenarioSummary {
  id: string
  scenarioName: string
  versionNo: number
  status: keyof typeof COMPENSATION_STATUS_LABELS
  budgetLimit: number
  totalCost: number
  totalBonus: number
  totalSalaryIncrease: number
  isOverBudget: boolean
  overBudgetAmount: number
  isLocked: boolean
  needsRecalculation: boolean
  publishedAt?: string | null
  evalCycle: {
    id: string
    cycleName: string
    evalYear: number
  }
  ruleSet: {
    id: string
    versionNo: number
    changeReason?: string | null
  }
  employeeCount: number
}

interface ScenarioDetail extends Omit<ScenarioSummary, 'employeeCount' | 'ruleSet'> {
  ruleSet: {
    id: string
    versionNo: number
    changeReason?: string | null
    rules: RuleRow[]
  }
  approvals: Array<{
    id: string
    action: string
    actorId: string
    actorRole: string
    fromStatus: string
    toStatus: string
    comment?: string | null
    createdAt: string
  }>
  employees: Array<{
    id: string
    gradeName: string
    currentSalary: number
    bonusRate: number
    salaryIncreaseRate: number
    bonusAmount: number
    salaryIncreaseAmount: number
    projectedSalary: number
    projectedTotalCompensation: number
    sourceRuleVersionNo: number
    employee: {
      empId: string
      empName: string
      department?: { deptName: string } | null
    }
  }>
}

function parseResponse<T>(json: unknown): T {
  const payload = json as {
    success?: boolean
    data?: T
    error?: { message?: string }
  }

  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리에 실패했습니다.')
  }

  return payload.data as T
}

export function CompensationManageClient({ role }: { role: string }) {
  const queryClient = useQueryClient()
  const [year, setYear] = useState(getCurrentYear())
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [budgetLimit, setBudgetLimit] = useState(20000000)
  const [changeReason, setChangeReason] = useState('')
  const [editedRules, setEditedRules] = useState<RuleRow[]>([])
  const [impactNote, setImpactNote] = useState('')

  const rulesQuery = useQuery({
    queryKey: ['compensation-rules', year],
    queryFn: async () => {
      const res = await fetch(`/api/compensation/rules/${year}`)
      return parseResponse<{
        activeRuleSet: { id: string; versionNo: number; rules: RuleRow[] } | null
        suggestedRules: RuleRow[]
      }>(await res.json())
    },
  })

  const scenariosQuery = useQuery({
    queryKey: ['compensation-scenarios', year],
    queryFn: async () => {
      const res = await fetch(`/api/compensation/scenarios?year=${year}`)
      return parseResponse<{
        cycles: CycleRow[]
        scenarios: ScenarioSummary[]
      }>(await res.json())
    },
  })

  const defaultRules =
    rulesQuery.data?.activeRuleSet?.rules?.length
      ? rulesQuery.data.activeRuleSet.rules
      : (rulesQuery.data?.suggestedRules ?? [])
  const rules = editedRules.length ? editedRules : defaultRules

  const effectiveCycleId = selectedCycleId || scenariosQuery.data?.cycles[0]?.id || ''
  const cycleScenarios = (scenariosQuery.data?.scenarios ?? []).filter(
    (scenario) => !effectiveCycleId || scenario.evalCycle.id === effectiveCycleId
  )
  const effectiveScenarioId = selectedScenarioId || cycleScenarios[0]?.id || ''
  const selectedCycle =
    scenariosQuery.data?.cycles.find((cycle) => cycle.id === effectiveCycleId) ?? null
  const scenarioNameValue = scenarioName || (selectedCycle ? `${selectedCycle.cycleName} 보상안` : '')

  const selectedScenarioQuery = useQuery({
    queryKey: ['compensation-scenario', effectiveScenarioId],
    queryFn: async () => {
      const res = await fetch(`/api/compensation/scenarios/${effectiveScenarioId}`)
      return parseResponse<ScenarioDetail>(await res.json())
    },
    enabled: !!effectiveScenarioId,
  })

  const canEditRules = role === 'ROLE_ADMIN'
  const canCreateScenario = role === 'ROLE_ADMIN'

  const saveRulesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/compensation/rules/${year}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeReason, rules }),
      })
      return parseResponse<{ impact?: { summary?: string; note?: string } }>(await res.json())
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['compensation-rules', year] })
      queryClient.invalidateQueries({ queryKey: ['compensation-scenarios', year] })
      setImpactNote([data.impact?.summary, data.impact?.note].filter(Boolean).join(' '))
      setEditedRules([])
      alert('보상 규칙 새 버전이 저장되었습니다.')
    },
    onError: (error: Error) => alert(error.message),
  })

  const createScenarioMutation = useMutation({
    mutationFn: async (cloneFromScenarioId?: string) => {
      const res = await fetch('/api/compensation/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalCycleId: effectiveCycleId,
          scenarioName: scenarioNameValue,
          budgetLimit,
          cloneFromScenarioId,
        }),
      })
      return parseResponse<ScenarioDetail>(await res.json())
    },
    onSuccess: (scenario) => {
      queryClient.invalidateQueries({ queryKey: ['compensation-scenarios', year] })
      setSelectedScenarioId(scenario.id)
      alert(`시나리오 v${scenario.versionNo} 이 생성되었습니다.`)
    },
    onError: (error: Error) => alert(error.message),
  })

  const workflowMutation = useMutation({
    mutationFn: async ({ action, comment }: { action: string; comment?: string }) => {
      const res = await fetch(`/api/compensation/scenarios/${effectiveScenarioId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      })
      return parseResponse<ScenarioDetail>(await res.json())
    },
    onSuccess: (scenario) => {
      queryClient.invalidateQueries({ queryKey: ['compensation-scenarios', year] })
      queryClient.setQueryData(['compensation-scenario', effectiveScenarioId], scenario)
      alert('워크플로가 반영되었습니다.')
    },
    onError: (error: Error) => alert(error.message),
  })

  const selectedScenario = selectedScenarioQuery.data

  const handleRuleChange = (index: number, field: keyof RuleRow, value: string) => {
    const next = [...rules]
    next[index] = {
      ...next[index],
      [field]: field === 'description' || field === 'gradeName' ? value : Number(value),
    }
    setEditedRules(next)
  }

  const handleWorkflow = (action: string) => {
    let comment = ''
    if (action === 'REJECT') {
      comment = window.prompt('반려 사유를 입력해 주세요.', '예산 또는 규칙 기준 재검토 필요') || ''
      if (!comment) return
    }
    if (action === 'LOCK') {
      comment = window.prompt('잠금 사유를 입력해 주세요.', '검토 기준 고정') || '수동 잠금'
    }
    if (action === 'RECALCULATE') {
      comment = '최신 규칙 반영'
    }
    workflowMutation.mutate({ action, comment })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보상 시뮬레이션/승인</h1>
          <p className="mt-1 text-sm text-gray-500">
            grade-to-compensation rule table, 예산 검증, 시나리오 버전 관리, 승인 워크플로를 운영합니다.
          </p>
        </div>
        <select
          value={year}
          onChange={(event) => {
            setYear(Number(event.target.value))
            setSelectedCycleId('')
            setSelectedScenarioId('')
            setScenarioName('')
            setEditedRules([])
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {[year - 1, year, year + 1].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Compensation Rule Table</h2>
            <p className="text-sm text-gray-500">
              활성 규칙 버전: {rulesQuery.data?.activeRuleSet?.versionNo ?? '없음'}
            </p>
          </div>
          {canEditRules && (
            <button
              onClick={() => saveRulesMutation.mutate()}
              disabled={saveRulesMutation.isPending || !rules.length}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saveRulesMutation.isPending ? '저장 중...' : '새 규칙 버전 저장'}
            </button>
          )}
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[1fr,2fr]">
          <input
            value={changeReason}
            onChange={(event) => setChangeReason(event.target.value)}
            disabled={!canEditRules}
            placeholder="규칙 변경 사유"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {impactNote || '사이클 확정 후 규칙 변경 시 잠금된/최종승인 시나리오와 self-view는 유지되고, 잠금되지 않은 시나리오만 재계산 대상으로 표시됩니다.'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-3">Grade</th>
                <th className="px-3 py-3">Bonus %</th>
                <th className="px-3 py-3">Salary Increase %</th>
                <th className="px-3 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule, index) => (
                <tr key={rule.gradeName}>
                  <td className="px-3 py-2 font-semibold text-gray-900">{rule.gradeName}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={rule.bonusRate}
                      disabled={!canEditRules}
                      onChange={(event) => handleRuleChange(index, 'bonusRate', event.target.value)}
                      className="w-28 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      value={rule.salaryIncreaseRate}
                      disabled={!canEditRules}
                      onChange={(event) => handleRuleChange(index, 'salaryIncreaseRate', event.target.value)}
                      className="w-28 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={rule.description ?? ''}
                      disabled={!canEditRules}
                      onChange={(event) => handleRuleChange(index, 'description', event.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px,1fr]">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Scenario Versioning</h2>
            <p className="text-sm text-gray-500">HR 작성 → 경영진 검토 → 최종승인 흐름을 지원합니다.</p>
          </div>

          <select
            value={effectiveCycleId}
            onChange={(event) => {
              setSelectedCycleId(event.target.value)
              setSelectedScenarioId('')
              setScenarioName('')
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">평가 주기 선택</option>
            {scenariosQuery.data?.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.evalYear} / {cycle.cycleName}
              </option>
            ))}
          </select>

          <input
            value={scenarioNameValue}
            onChange={(event) => setScenarioName(event.target.value)}
            placeholder="시나리오명"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <input
            type="number"
            value={budgetLimit}
            onChange={(event) => setBudgetLimit(Number(event.target.value))}
            placeholder="총예산 한도"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          {canCreateScenario && (
            <button
              onClick={() => createScenarioMutation.mutate(undefined)}
              disabled={!effectiveCycleId || !scenarioNameValue || createScenarioMutation.isPending}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {createScenarioMutation.isPending ? '생성 중...' : '새 시나리오 생성'}
            </button>
          )}

          <div className="space-y-2">
            {cycleScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenarioId(scenario.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  effectiveScenarioId === scenario.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">v{scenario.versionNo}</span>
                  <span className="text-xs text-gray-500">
                    {COMPENSATION_STATUS_LABELS[scenario.status]}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">{scenario.scenarioName}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>rule v{scenario.ruleSet.versionNo}</span>
                  <span>cost {formatCurrency(scenario.totalCost)}</span>
                  <span>{scenario.isOverBudget ? '예산 초과' : '예산 내'}</span>
                  <span>{scenario.isLocked ? 'locked' : 'editable'}</span>
                  {scenario.needsRecalculation && <span>재계산 필요</span>}
                </div>
              </button>
            ))}
            {!cycleScenarios.length && (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                선택된 주기에 시나리오가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {!selectedScenario ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500">
              시나리오를 선택하면 시뮬레이션, 승인 이력, export 기능이 표시됩니다.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedScenario.scenarioName} v{selectedScenario.versionNo}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedScenario.evalCycle.evalYear} / {selectedScenario.evalCycle.cycleName} / rule
                    v{selectedScenario.ruleSet.versionNo}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canCreateScenario && (
                    <button
                      onClick={() => createScenarioMutation.mutate(selectedScenario.id)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      현재안 기준 새 버전
                    </button>
                  )}
                  <button
                    onClick={() => {
                      window.location.href = `/api/compensation/scenarios/${selectedScenario.id}/export`
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    Export
                  </button>
                  {role === 'ROLE_ADMIN' && !selectedScenario.isLocked && (
                    <button
                      onClick={() => handleWorkflow('RECALCULATE')}
                      className="rounded-lg border border-blue-300 px-3 py-2 text-sm text-blue-700"
                    >
                      Recalculate
                    </button>
                  )}
                  {(role === 'ROLE_ADMIN' || role === 'ROLE_CEO') && !selectedScenario.isLocked && (
                    <button
                      onClick={() => handleWorkflow('LOCK')}
                      className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700"
                    >
                      Lock
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="상태" value={COMPENSATION_STATUS_LABELS[selectedScenario.status]} />
                <MetricCard label="총 예산 한도" value={formatCurrency(selectedScenario.budgetLimit)} />
                <MetricCard
                  label="총 비용"
                  value={formatCurrency(selectedScenario.totalCost)}
                  tone={selectedScenario.isOverBudget ? 'red' : 'green'}
                />
                <MetricCard
                  label="예산 초과분"
                  value={formatCurrency(selectedScenario.overBudgetAmount)}
                  tone={selectedScenario.isOverBudget ? 'red' : 'gray'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {role === 'ROLE_ADMIN' &&
                  (selectedScenario.status === 'DRAFT' || selectedScenario.status === 'REJECTED') && (
                    <ActionButton label="경영진 검토 요청" onClick={() => handleWorkflow('SUBMIT')} />
                  )}
                {(role === 'ROLE_DIV_HEAD' || role === 'ROLE_CEO') &&
                  selectedScenario.status === 'UNDER_REVIEW' && (
                    <ActionButton
                      label="검토 승인"
                      onClick={() => handleWorkflow('REVIEW_APPROVE')}
                    />
                  )}
                {role === 'ROLE_CEO' && selectedScenario.status === 'REVIEW_APPROVED' && (
                  <ActionButton
                    label="최종 승인"
                    onClick={() => handleWorkflow('FINAL_APPROVE')}
                  />
                )}
                {(role === 'ROLE_DIV_HEAD' || role === 'ROLE_CEO') &&
                  ['UNDER_REVIEW', 'REVIEW_APPROVED'].includes(selectedScenario.status) && (
                    <button
                      onClick={() => handleWorkflow('REJECT')}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700"
                    >
                      반려
                    </button>
                  )}
                {selectedScenario.needsRecalculation && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    최신 규칙 변경으로 인해 재계산이 필요합니다.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h3 className="font-semibold text-gray-900">Simulation</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-500">
                        <th className="px-3 py-3">사번</th>
                        <th className="px-3 py-3">이름</th>
                        <th className="px-3 py-3">부서</th>
                        <th className="px-3 py-3">Grade</th>
                        <th className="px-3 py-3">Current</th>
                        <th className="px-3 py-3">Bonus</th>
                        <th className="px-3 py-3">Salary Increase</th>
                        <th className="px-3 py-3">Projected Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedScenario.employees.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 text-gray-500">{row.employee.empId}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.employee.empName}</td>
                          <td className="px-3 py-2 text-gray-500">{row.employee.department?.deptName ?? '-'}</td>
                          <td className="px-3 py-2">{row.gradeName}</td>
                          <td className="px-3 py-2">{formatCurrency(row.currentSalary)}</td>
                          <td className="px-3 py-2">
                            {row.bonusRate}% / {formatCurrency(row.bonusAmount)}
                          </td>
                          <td className="px-3 py-2">
                            {row.salaryIncreaseRate}% / {formatCurrency(row.salaryIncreaseAmount)}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {formatCurrency(row.projectedTotalCompensation)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3">
                  <h3 className="font-semibold text-gray-900">Workflow History</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {selectedScenario.approvals.map((approval) => (
                    <div key={approval.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {approval.action} / {approval.actorRole}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(approval.createdAt)}</span>
                      </div>
                      <div className="text-gray-500">
                        {approval.fromStatus} -&gt; {approval.toStatus}
                      </div>
                      {approval.comment && <div className="text-gray-700">{approval.comment}</div>}
                    </div>
                  ))}
                  {!selectedScenario.approvals.length && (
                    <div className="px-4 py-6 text-sm text-gray-500">아직 워크플로 이력이 없습니다.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = 'gray',
}: {
  label: string
  value: string
  tone?: 'gray' | 'green' | 'red'
}) {
  const toneClass =
    tone === 'green'
      ? 'border-green-200 bg-green-50 text-green-700'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-gray-200 bg-gray-50 text-gray-800'

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
    >
      {label}
    </button>
  )
}
