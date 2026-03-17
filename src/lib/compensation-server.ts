import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'
import {
  getEvaluationStagePriority,
  simulateCompensationScenario,
  type CompensationRuleInput,
  type CompensationTargetInput,
} from '@/lib/compensation'

export async function getOrganizationOrThrow() {
  const org = await prisma.organization.findFirst()
  if (!org) {
    throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
  }

  return org
}

export async function getActiveRuleSetOrThrow(orgId: string, evalYear: number, ruleSetId?: string) {
  const ruleSet = await prisma.compensationRuleSet.findFirst({
    where: ruleSetId
      ? { id: ruleSetId, orgId, evalYear }
      : { orgId, evalYear, isActive: true },
    include: {
      rules: {
        orderBy: { gradeName: 'asc' },
      },
    },
  })

  if (!ruleSet) {
    throw new AppError(404, 'RULE_SET_NOT_FOUND', '보상 규칙 버전을 먼저 등록해 주세요.')
  }

  return ruleSet
}

export async function getGradeSettingsOrThrow(orgId: string, evalYear: number) {
  const grades = await prisma.gradeSetting.findMany({
    where: { orgId, evalYear, isActive: true },
    orderBy: { gradeOrder: 'asc' },
  })

  if (!grades.length) {
    throw new AppError(404, 'GRADE_SETTINGS_NOT_FOUND', '평가 등급 설정을 찾을 수 없습니다.')
  }

  return grades
}

export async function buildScenarioSimulation(params: {
  evalCycleId: string
  budgetLimit: number
  ruleSetId?: string
}) {
  const cycle = await prisma.evalCycle.findUnique({
    where: { id: params.evalCycleId },
    include: {
      organization: true,
    },
  })

  if (!cycle) {
    throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const [grades, ruleSet, evaluations] = await Promise.all([
    getGradeSettingsOrThrow(cycle.orgId, cycle.evalYear),
    getActiveRuleSetOrThrow(cycle.orgId, cycle.evalYear, params.ruleSetId),
    prisma.evaluation.findMany({
      where: {
        evalCycleId: cycle.id,
        status: {
          in: ['SUBMITTED', 'CONFIRMED'],
        },
      },
      include: {
        target: {
          select: {
            id: true,
            empName: true,
            currentSalary: true,
            status: true,
          },
        },
      },
      orderBy: [
        { targetId: 'asc' },
        { submittedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    }),
  ])

  const gradeById = new Map(grades.map((grade) => [grade.id, grade]))
  const latestByTarget = new Map<string, (typeof evaluations)[number]>()

  for (const evaluation of evaluations) {
    if (evaluation.target.status !== 'ACTIVE') continue

    const existing = latestByTarget.get(evaluation.targetId)
    if (!existing) {
      latestByTarget.set(evaluation.targetId, evaluation)
      continue
    }

    const currentPriority = getEvaluationStagePriority(evaluation.evalStage)
    const existingPriority = getEvaluationStagePriority(existing.evalStage)
    if (currentPriority > existingPriority) {
      latestByTarget.set(evaluation.targetId, evaluation)
      continue
    }

    if (
      currentPriority === existingPriority &&
      new Date(evaluation.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
    ) {
      latestByTarget.set(evaluation.targetId, evaluation)
    }
  }

  const targets: CompensationTargetInput[] = []
  for (const evaluation of latestByTarget.values()) {
    const grade =
      (evaluation.gradeId ? gradeById.get(evaluation.gradeId) : undefined) ??
      grades.find((item) => {
        if (evaluation.totalScore == null) return false
        return evaluation.totalScore >= item.minScore && evaluation.totalScore <= item.maxScore
      })

    if (!grade) continue

    targets.push({
      employeeId: evaluation.target.id,
      employeeName: evaluation.target.empName,
      currentSalary: evaluation.target.currentSalary,
      gradeName: grade.gradeName,
      evaluationId: evaluation.id,
    })
  }

  if (!targets.length) {
    throw new AppError(400, 'NO_EVALUATION_RESULTS', '보상 시뮬레이션 대상이 될 확정 평가 결과가 없습니다.')
  }

  const rules: CompensationRuleInput[] = ruleSet.rules.map((rule) => ({
    gradeName: rule.gradeName,
    bonusRate: rule.bonusRate,
    salaryIncreaseRate: rule.salaryIncreaseRate,
    description: rule.description,
    ruleId: rule.id,
  }))

  const simulation = simulateCompensationScenario({
    targets,
    rules,
    budgetLimit: params.budgetLimit,
    ruleVersionNo: ruleSet.versionNo,
  })

  if (simulation.missingGrades.length) {
    throw new AppError(
      400,
      'MISSING_COMPENSATION_RULE',
      `다음 등급의 보상 규칙이 없습니다: ${simulation.missingGrades.join(', ')}`
    )
  }

  return {
    cycle,
    ruleSet,
    simulation,
  }
}

export function getScenarioUpdatePayload(simulation: ReturnType<typeof simulateCompensationScenario>) {
  return {
    totalBonus: simulation.totalBonus,
    totalSalaryIncrease: simulation.totalSalaryIncrease,
    totalCost: simulation.totalCost,
    isOverBudget: simulation.isOverBudget,
    overBudgetAmount: simulation.overBudgetAmount,
    needsRecalculation: false,
  }
}
