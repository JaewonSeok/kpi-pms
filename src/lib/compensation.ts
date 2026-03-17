export const COMPENSATION_MANAGE_ROLES = ['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'] as const
export const COMPENSATION_REVIEW_ROLES = ['ROLE_DIV_HEAD', 'ROLE_CEO'] as const

export type CompensationManageRole = typeof COMPENSATION_MANAGE_ROLES[number]
export type CompensationUserRole =
  | CompensationManageRole
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'

export type ScenarioStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'REVIEW_APPROVED'
  | 'REJECTED'
  | 'FINAL_APPROVED'

export type ScenarioWorkflowAction =
  | 'SUBMIT'
  | 'REVIEW_APPROVE'
  | 'FINAL_APPROVE'
  | 'REJECT'
  | 'LOCK'
  | 'RECALCULATE'

export interface CompensationRuleInput {
  gradeName: string
  bonusRate: number
  salaryIncreaseRate: number
  description?: string | null
  ruleId?: string | null
}

export interface CompensationTargetInput {
  employeeId: string
  employeeName: string
  currentSalary: number
  gradeName: string
  evaluationId?: string | null
}

export interface CompensationSimulationRow {
  employeeId: string
  employeeName: string
  evaluationId?: string | null
  gradeName: string
  currentSalary: number
  bonusRate: number
  salaryIncreaseRate: number
  bonusAmount: number
  salaryIncreaseAmount: number
  projectedSalary: number
  projectedTotalCompensation: number
  sourceRuleId?: string | null
  sourceRuleVersionNo: number
  calculationNote?: string
}

export interface CompensationSimulationResult {
  rows: CompensationSimulationRow[]
  totalBonus: number
  totalSalaryIncrease: number
  totalCost: number
  budgetLimit: number
  isOverBudget: boolean
  overBudgetAmount: number
  missingGrades: string[]
}

export interface RuleChangeImpactScenario {
  id: string
  scenarioName: string
  versionNo: number
  status: ScenarioStatus
  isLocked: boolean
  employeeCount: number
}

export interface RuleChangeImpactSummary {
  recalculationRequiredScenarioIds: string[]
  recalculationRequiredCount: number
  unaffectedLockedScenarioIds: string[]
  unaffectedLockedCount: number
  unaffectedPublishedEmployeeCount: number
  summary: string
}

export interface WorkflowTransitionResult {
  nextStatus: ScenarioStatus
  shouldLock: boolean
  shouldPublish: boolean
}

const STAGE_PRIORITY: Record<string, number> = {
  CEO_ADJUST: 5,
  FINAL: 4,
  SECOND: 3,
  FIRST: 2,
  SELF: 1,
}

export function getEvaluationStagePriority(stage: string) {
  return STAGE_PRIORITY[stage] ?? 0
}

export function canManageCompensation(role: string): role is CompensationManageRole {
  return COMPENSATION_MANAGE_ROLES.includes(role as CompensationManageRole)
}

export function roundCurrency(value: number) {
  return Math.round(value)
}

export function simulateCompensationScenario(params: {
  targets: CompensationTargetInput[]
  rules: CompensationRuleInput[]
  budgetLimit: number
  ruleVersionNo: number
}): CompensationSimulationResult {
  const ruleMap = new Map(params.rules.map(rule => [rule.gradeName, rule]))
  const missingGrades = new Set<string>()

  const rows = params.targets.map<CompensationSimulationRow>((target) => {
    const rule = ruleMap.get(target.gradeName)
    if (!rule) {
      missingGrades.add(target.gradeName)
      return {
        employeeId: target.employeeId,
        employeeName: target.employeeName,
        evaluationId: target.evaluationId,
        gradeName: target.gradeName,
        currentSalary: roundCurrency(target.currentSalary),
        bonusRate: 0,
        salaryIncreaseRate: 0,
        bonusAmount: 0,
        salaryIncreaseAmount: 0,
        projectedSalary: roundCurrency(target.currentSalary),
        projectedTotalCompensation: roundCurrency(target.currentSalary),
        sourceRuleId: null,
        sourceRuleVersionNo: params.ruleVersionNo,
        calculationNote: `MISSING_RULE:${target.gradeName}`,
      }
    }

    const bonusAmount = roundCurrency(target.currentSalary * (rule.bonusRate / 100))
    const salaryIncreaseAmount = roundCurrency(target.currentSalary * (rule.salaryIncreaseRate / 100))
    const projectedSalary = roundCurrency(target.currentSalary + salaryIncreaseAmount)

    return {
      employeeId: target.employeeId,
      employeeName: target.employeeName,
      evaluationId: target.evaluationId,
      gradeName: target.gradeName,
      currentSalary: roundCurrency(target.currentSalary),
      bonusRate: rule.bonusRate,
      salaryIncreaseRate: rule.salaryIncreaseRate,
      bonusAmount,
      salaryIncreaseAmount,
      projectedSalary,
      projectedTotalCompensation: roundCurrency(projectedSalary + bonusAmount),
      sourceRuleId: rule.ruleId ?? null,
      sourceRuleVersionNo: params.ruleVersionNo,
    }
  })

  const totalBonus = roundCurrency(rows.reduce((sum, row) => sum + row.bonusAmount, 0))
  const totalSalaryIncrease = roundCurrency(rows.reduce((sum, row) => sum + row.salaryIncreaseAmount, 0))
  const totalCost = roundCurrency(totalBonus + totalSalaryIncrease)
  const overBudgetAmount = roundCurrency(Math.max(totalCost - params.budgetLimit, 0))

  return {
    rows,
    totalBonus,
    totalSalaryIncrease,
    totalCost,
    budgetLimit: roundCurrency(params.budgetLimit),
    isOverBudget: totalCost > params.budgetLimit,
    overBudgetAmount,
    missingGrades: [...missingGrades],
  }
}

export function summarizeRuleChangeImpact(scenarios: RuleChangeImpactScenario[]): RuleChangeImpactSummary {
  const recalculationRequiredScenarioIds = scenarios
    .filter((scenario) => !scenario.isLocked && scenario.status !== 'FINAL_APPROVED')
    .map((scenario) => scenario.id)

  const unaffectedLockedScenarios = scenarios.filter(
    (scenario) => scenario.isLocked || scenario.status === 'FINAL_APPROVED'
  )

  const unaffectedPublishedEmployeeCount = unaffectedLockedScenarios.reduce(
    (sum, scenario) => sum + scenario.employeeCount,
    0
  )

  return {
    recalculationRequiredScenarioIds,
    recalculationRequiredCount: recalculationRequiredScenarioIds.length,
    unaffectedLockedScenarioIds: unaffectedLockedScenarios.map((scenario) => scenario.id),
    unaffectedLockedCount: unaffectedLockedScenarios.length,
    unaffectedPublishedEmployeeCount,
    summary: [
      `${recalculationRequiredScenarioIds.length} draft/in-review scenarios need recalculation.`,
      `${unaffectedLockedScenarios.length} locked/finalized scenarios keep their snapshot values.`,
      `${unaffectedPublishedEmployeeCount} employee self-view records stay unchanged.`,
    ].join(' '),
  }
}

export function resolveWorkflowTransition(params: {
  action: ScenarioWorkflowAction
  actorRole: string
  currentStatus: ScenarioStatus
  isLocked: boolean
  isOverBudget: boolean
  needsRecalculation: boolean
}): WorkflowTransitionResult {
  const { action, actorRole, currentStatus, isLocked, isOverBudget, needsRecalculation } = params

  if (needsRecalculation && action !== 'RECALCULATE') {
    throw new Error('LATEST_RULES_NOT_APPLIED')
  }

  if (action === 'RECALCULATE') {
    if (actorRole !== 'ROLE_ADMIN') throw new Error('FORBIDDEN')
    if (isLocked) throw new Error('SCENARIO_LOCKED')
    if (currentStatus !== 'DRAFT' && currentStatus !== 'REJECTED') {
      throw new Error('INVALID_STATUS')
    }

    return { nextStatus: currentStatus, shouldLock: false, shouldPublish: false }
  }

  if (action === 'LOCK') {
    if (actorRole !== 'ROLE_ADMIN' && actorRole !== 'ROLE_CEO') throw new Error('FORBIDDEN')
    if (isLocked) throw new Error('SCENARIO_LOCKED')

    return { nextStatus: currentStatus, shouldLock: true, shouldPublish: false }
  }

  if (action === 'SUBMIT') {
    if (actorRole !== 'ROLE_ADMIN') throw new Error('FORBIDDEN')
    if (isLocked) throw new Error('SCENARIO_LOCKED')
    if (currentStatus !== 'DRAFT' && currentStatus !== 'REJECTED') throw new Error('INVALID_STATUS')
    if (isOverBudget) throw new Error('BUDGET_EXCEEDED')

    return { nextStatus: 'UNDER_REVIEW', shouldLock: false, shouldPublish: false }
  }

  if (action === 'REVIEW_APPROVE') {
    if (actorRole !== 'ROLE_DIV_HEAD' && actorRole !== 'ROLE_CEO') {
      throw new Error('FORBIDDEN')
    }
    if (currentStatus !== 'UNDER_REVIEW') throw new Error('INVALID_STATUS')

    return { nextStatus: 'REVIEW_APPROVED', shouldLock: false, shouldPublish: false }
  }

  if (action === 'FINAL_APPROVE') {
    if (actorRole !== 'ROLE_CEO') throw new Error('FORBIDDEN')
    if (currentStatus !== 'REVIEW_APPROVED') throw new Error('INVALID_STATUS')
    if (isOverBudget) throw new Error('BUDGET_EXCEEDED')

    return { nextStatus: 'FINAL_APPROVED', shouldLock: true, shouldPublish: true }
  }

  if (action === 'REJECT') {
    if (actorRole !== 'ROLE_DIV_HEAD' && actorRole !== 'ROLE_CEO') {
      throw new Error('FORBIDDEN')
    }
    if (currentStatus !== 'UNDER_REVIEW' && currentStatus !== 'REVIEW_APPROVED') {
      throw new Error('INVALID_STATUS')
    }

    return { nextStatus: 'REJECTED', shouldLock: false, shouldPublish: false }
  }

  throw new Error('UNKNOWN_ACTION')
}
