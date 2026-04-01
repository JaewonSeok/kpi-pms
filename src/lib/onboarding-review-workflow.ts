import type { Position } from '@prisma/client'

export const ONBOARDING_REVIEW_DEFAULT_TEMPLATE = '{{evalYear}} {{cycleName}} {{stepName}}'

export type OnboardingReviewWorkflowCondition =
  | {
      id: string
      field: 'JOIN_DATE'
      operator: 'ON_OR_AFTER' | 'ON_OR_BEFORE' | 'BETWEEN'
      value: string
      valueTo?: string | null
    }
  | {
      id: string
      field: 'POSITION'
      operator: 'IN'
      values: Position[]
    }

export type OnboardingReviewWorkflowStep = {
  id: string
  stepOrder: number
  stepName: string
  triggerDaysAfterJoin: number
  durationDays: number
  reviewNameTemplate: string
  includeEmployeeNameInName: boolean
  includeHireDateInName: boolean
}

export type OnboardingReviewWorkflowConfig = {
  id: string
  evalCycleId: string
  workflowName: string
  isActive: boolean
  scheduleHourKst: number
  targetConditions: OnboardingReviewWorkflowCondition[]
  steps: OnboardingReviewWorkflowStep[]
}

export type OnboardingWorkflowTargetEmployee = {
  id: string
  name: string
  joinDate: Date
  position: Position
  departmentName: string
  managerId: string | null
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export const ONBOARDING_CONDITION_FIELD_LABELS: Record<
  OnboardingReviewWorkflowCondition['field'],
  string
> = {
  JOIN_DATE: '입사일',
  POSITION: '직군',
}

export const ONBOARDING_DATE_OPERATOR_LABELS: Record<
  Extract<OnboardingReviewWorkflowCondition, { field: 'JOIN_DATE' }>['operator'],
  string
> = {
  ON_OR_AFTER: '이후(당일 포함)',
  ON_OR_BEFORE: '이전(당일 포함)',
  BETWEEN: '기간 사이',
}

export const POSITION_LABELS_KO: Record<Position, string> = {
  MEMBER: '구성원',
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장',
  DIV_HEAD: '본부장',
  CEO: 'CEO',
}

export function formatScheduleHourLabel(hour: number) {
  const normalized = Math.min(Math.max(Math.trunc(hour), 0), 23)
  const suffix = normalized < 12 ? '오전' : '오후'
  const display = normalized % 12 === 0 ? 12 : normalized % 12
  return `한국 시간 기준 ${suffix} ${display}시에 생성`
}

export function toKstDateKey(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

export function parseKstDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`)
}

export function addDaysToKstDateKey(dateKey: string, days: number) {
  const base = parseKstDateKey(dateKey)
  base.setUTCDate(base.getUTCDate() + days)
  return toKstDateKey(base)
}

export function buildOnboardingReviewNamePreview(params: {
  step: OnboardingReviewWorkflowStep
  evalYear: number
  cycleName: string
  employeeName: string
  hireDate: Date
}) {
  const template = params.step.reviewNameTemplate.trim() || ONBOARDING_REVIEW_DEFAULT_TEMPLATE
  const hireDateLabel = toKstDateKey(params.hireDate)

  let preview = template
    .replaceAll('{{evalYear}}', String(params.evalYear))
    .replaceAll('{{cycleName}}', params.cycleName)
    .replaceAll('{{employeeName}}', params.employeeName)
    .replaceAll('{{stepName}}', params.step.stepName)
    .replaceAll('{{hireDate}}', hireDateLabel)

  if (params.step.includeEmployeeNameInName && !preview.includes(params.employeeName)) {
    preview = `${preview} / ${params.employeeName}`
  }

  if (params.step.includeHireDateInName && !preview.includes(hireDateLabel)) {
    preview = `${preview} / 입사일 ${hireDateLabel}`
  }

  return preview.replace(/\s+/g, ' ').trim()
}

export function describeCondition(condition: OnboardingReviewWorkflowCondition) {
  if (condition.field === 'POSITION') {
    const positions = condition.values.map((value) => POSITION_LABELS_KO[value]).join(', ')
    return `${ONBOARDING_CONDITION_FIELD_LABELS[condition.field]}: ${positions || '전체'}`
  }

  if (condition.operator === 'BETWEEN') {
    return `${ONBOARDING_CONDITION_FIELD_LABELS[condition.field]}: ${
      condition.value
    } ~ ${condition.valueTo ?? condition.value}`
  }

  return `${ONBOARDING_CONDITION_FIELD_LABELS[condition.field]} ${
    ONBOARDING_DATE_OPERATOR_LABELS[condition.operator]
  } ${condition.value}`
}

export function matchesOnboardingWorkflowConditions(params: {
  employee: OnboardingWorkflowTargetEmployee
  conditions: OnboardingReviewWorkflowCondition[]
}) {
  if (!params.conditions.length) return true

  const joinDateKey = toKstDateKey(params.employee.joinDate)

  return params.conditions.every((condition) => {
    if (condition.field === 'POSITION') {
      return !condition.values.length || condition.values.includes(params.employee.position)
    }

    if (condition.operator === 'ON_OR_AFTER') {
      return joinDateKey >= condition.value
    }

    if (condition.operator === 'ON_OR_BEFORE') {
      return joinDateKey <= condition.value
    }

    const end = condition.valueTo ?? condition.value
    return joinDateKey >= condition.value && joinDateKey <= end
  })
}

export function planOnboardingWorkflowGeneration(params: {
  workflow: OnboardingReviewWorkflowConfig
  evalYear: number
  cycleName: string
  employees: OnboardingWorkflowTargetEmployee[]
  existingGenerationKeys: Set<string>
  now?: Date
}) {
  const todayKey = toKstDateKey(params.now ?? new Date())
  const created: Array<{
    employeeId: string
    stepId: string
    stepOrder: number
    stepName: string
    dueDateKey: string
    roundName: string
  }> = []
  let duplicateCount = 0
  let scheduledLaterCount = 0
  let ineligibleCount = 0

  for (const employee of params.employees) {
    if (!matchesOnboardingWorkflowConditions({ employee, conditions: params.workflow.targetConditions })) {
      ineligibleCount += 1
      continue
    }

    const joinDateKey = toKstDateKey(employee.joinDate)

    for (const step of params.workflow.steps) {
      const generationKey = `${params.workflow.id}:${employee.id}:${step.id}`
      const dueDateKey = addDaysToKstDateKey(joinDateKey, step.triggerDaysAfterJoin)

      if (dueDateKey > todayKey) {
        scheduledLaterCount += 1
        continue
      }

      if (params.existingGenerationKeys.has(generationKey)) {
        duplicateCount += 1
        continue
      }

      created.push({
        employeeId: employee.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        stepName: step.stepName,
        dueDateKey,
        roundName: buildOnboardingReviewNamePreview({
          step,
          evalYear: params.evalYear,
          cycleName: params.cycleName,
          employeeName: employee.name,
          hireDate: employee.joinDate,
        }),
      })
    }
  }

  return {
    todayKey,
    created,
    duplicateCount,
    scheduledLaterCount,
    ineligibleCount,
  }
}
