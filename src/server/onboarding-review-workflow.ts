import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError, formatDate } from '@/lib/utils'
import {
  ONBOARDING_REVIEW_DEFAULT_TEMPLATE,
  POSITION_LABELS_KO,
  buildOnboardingReviewNamePreview,
  describeCondition,
  formatScheduleHourLabel,
  matchesOnboardingWorkflowConditions,
  planOnboardingWorkflowGeneration,
  type OnboardingReviewWorkflowCondition,
  type OnboardingReviewWorkflowStep,
  type OnboardingWorkflowTargetEmployee,
} from '@/lib/onboarding-review-workflow'
import {
  OnboardingReviewConditionSchema,
  OnboardingReviewWorkflowStepSchema,
} from '@/lib/validations'

type StoredCondition = Prisma.JsonValue
type StoredStep = Prisma.JsonValue
type ParsedWorkflowCondition = OnboardingReviewWorkflowCondition
type ParsedWorkflowStep = OnboardingReviewWorkflowStep
type UpsertOnboardingReviewWorkflowInput = {
  id?: string
  evalCycleId: string
  workflowName: string
  isActive: boolean
  scheduleHourKst: number
  targetConditions: ParsedWorkflowCondition[]
  steps: ParsedWorkflowStep[]
  createdById?: string | null
}

const DEFAULT_VISIBILITY_SETTINGS = {
  SELF: 'PRIVATE',
  SUPERVISOR: 'FULL',
  PEER: 'PRIVATE',
  SUBORDINATE: 'PRIVATE',
  CROSS_TEAM_PEER: 'PRIVATE',
  CROSS_DEPT: 'PRIVATE',
} as const

function parseStoredConditions(value: StoredCondition) {
  const parsed = OnboardingReviewConditionSchema.array().safeParse(value)
  return parsed.success ? parsed.data : []
}

function parseStoredSteps(value: StoredStep) {
  const parsed = OnboardingReviewWorkflowStepSchema.array().safeParse(value)
  if (!parsed.success) return []
  return [...parsed.data].sort((left, right) => left.stepOrder - right.stepOrder)
}

function resolveManagerId(employee: {
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}) {
  return employee.teamLeaderId ?? employee.sectionChiefId ?? employee.divisionHeadId ?? null
}

function buildDefaultQuestions() {
  return [
    {
      category: '온보딩 적응',
      questionText: '입사 후 현재 역할과 업무 적응 수준을 어떻게 평가하시나요?',
      questionType: 'RATING_SCALE' as const,
      scaleMin: 1,
      scaleMax: 5,
      isRequired: true,
      sortOrder: 1,
    },
    {
      category: '강점',
      questionText: '초기 온보딩 과정에서 확인한 강점이나 기대되는 행동은 무엇인가요?',
      questionType: 'TEXT' as const,
      isRequired: true,
      sortOrder: 2,
    },
    {
      category: '지원 필요',
      questionText: '추가 지원이나 코칭이 필요한 지점은 무엇인가요?',
      questionType: 'TEXT' as const,
      isRequired: true,
      sortOrder: 3,
    },
    {
      category: '성장 과제',
      questionText: '다음 단계에서 권장하는 성장 과제나 실행 행동은 무엇인가요?',
      questionType: 'TEXT' as const,
      isRequired: true,
      sortOrder: 4,
    },
  ]
}

function toPrismaJson(value: unknown) {
  return value as Prisma.InputJsonValue
}

function resolveRoundWindow(scheduleHourKst: number, durationDays: number, now: Date) {
  const normalizedHour = Math.min(Math.max(Math.trunc(scheduleHourKst), 0), 23)
  const startCandidate = new Date(
    `${new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)}T${String(normalizedHour).padStart(2, '0')}:00:00+09:00`
  )
  const startDate = startCandidate.getTime() > now.getTime() ? startCandidate : now
  const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
  return { startDate, endDate }
}

export async function getOnboardingReviewAdminSnapshot(params: { cycleId: string }) {
  const cycle = await prisma.evalCycle.findUnique({
    where: { id: params.cycleId },
    select: {
      id: true,
      orgId: true,
      evalYear: true,
      cycleName: true,
    },
  })

  if (!cycle) {
    throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const [employees, workflows, generations] = await Promise.all([
    prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        department: {
          orgId: cycle.orgId,
        },
      },
      select: {
        id: true,
        empName: true,
        joinDate: true,
        position: true,
        teamLeaderId: true,
        sectionChiefId: true,
        divisionHeadId: true,
        department: {
          select: {
            deptName: true,
          },
        },
      },
      orderBy: [{ joinDate: 'asc' }, { empName: 'asc' }],
    }),
    prisma.onboardingReviewWorkflow.findMany({
      where: {
        evalCycleId: params.cycleId,
      },
      orderBy: [{ updatedAt: 'desc' }, { workflowName: 'asc' }],
    }),
    prisma.onboardingReviewGeneration.findMany({
      where: {
        workflow: {
          evalCycleId: params.cycleId,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            empName: true,
            department: {
              select: {
                deptName: true,
              },
            },
          },
        },
        round: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            feedbacks: {
              select: {
                status: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 120,
    }),
  ])

  const employeeTargets: OnboardingWorkflowTargetEmployee[] = employees.map((employee) => ({
    id: employee.id,
    name: employee.empName,
    joinDate: employee.joinDate,
    position: employee.position,
    departmentName: employee.department.deptName,
    managerId: resolveManagerId(employee),
  }))

  const generationsByWorkflow = generations.reduce<Record<string, number>>((summary, generation) => {
    summary[generation.workflowId] = (summary[generation.workflowId] ?? 0) + 1
    return summary
  }, {})

  return {
    scheduleInfo: formatScheduleHourLabel(8),
    jobFamilyOptions: Object.entries(POSITION_LABELS_KO).map(([value, label]) => ({
      value,
      label,
    })),
    workflows: workflows.map((workflow) => {
      const targetConditions = parseStoredConditions(workflow.targetConditions)
      const steps = parseStoredSteps(workflow.stepConfig)
      const eligibleTargets = employeeTargets.filter((employee) =>
        matchesOnboardingWorkflowConditions({
          employee,
          conditions: targetConditions,
        })
      )
      const sampleEmployee = eligibleTargets[0] ?? employeeTargets[0] ?? null

      return {
        id: workflow.id,
        workflowName: workflow.workflowName,
        isActive: workflow.isActive,
        scheduleHourKst: workflow.scheduleHourKst,
        scheduleInfo: formatScheduleHourLabel(workflow.scheduleHourKst),
        targetConditions,
        targetConditionSummary: targetConditions.map((condition) => describeCondition(condition)),
        steps: steps.map((step) => ({
          ...step,
          reviewNamePreview: sampleEmployee
            ? buildOnboardingReviewNamePreview({
                step: {
                  ...step,
                  reviewNameTemplate: step.reviewNameTemplate || ONBOARDING_REVIEW_DEFAULT_TEMPLATE,
                },
                evalYear: cycle.evalYear,
                cycleName: cycle.cycleName,
                employeeName: sampleEmployee.name,
                hireDate: sampleEmployee.joinDate,
              })
            : step.reviewNameTemplate,
        })),
        eligibleTargetCount: eligibleTargets.length,
        generatedCount: generationsByWorkflow[workflow.id] ?? 0,
      }
    }),
    generatedReviews: generations.map((generation) => ({
      id: generation.id,
      workflowId: generation.workflowId,
      workflowName: workflows.find((workflow) => workflow.id === generation.workflowId)?.workflowName ?? '워크플로우',
      stepId: generation.stepId,
      stepName: generation.stepName,
      roundId: generation.roundId,
      roundName: generation.roundNameSnapshot,
      targetId: generation.employeeId,
      targetName: generation.employee.empName,
      targetDepartment: generation.employee.department.deptName,
      status: generation.round.status,
      feedbackStatus: generation.round.feedbacks[0]?.status ?? 'PENDING',
      createdAt: generation.createdAt.toISOString(),
      createdDateLabel: formatDate(generation.createdAt),
      scheduledDateKey: generation.scheduledDateKey,
    })),
  }
}

export async function upsertOnboardingReviewWorkflow(input: UpsertOnboardingReviewWorkflowInput) {
  const stored = {
    workflowName: input.workflowName,
    isActive: input.isActive,
    scheduleHourKst: input.scheduleHourKst,
    targetConditions: toPrismaJson(input.targetConditions),
    stepConfig: toPrismaJson(input.steps),
  }

  if (input.id) {
    return prisma.onboardingReviewWorkflow.update({
      where: { id: input.id },
      data: stored,
    })
  }

  return prisma.onboardingReviewWorkflow.create({
    data: {
      evalCycleId: input.evalCycleId,
      createdById: input.createdById ?? null,
      ...stored,
    },
  })
}

export async function runOnboardingReviewGeneration(params: {
  cycleId: string
  workflowId?: string
  now?: Date
}) {
  const cycle = await prisma.evalCycle.findUnique({
    where: { id: params.cycleId },
    select: {
      id: true,
      orgId: true,
      evalYear: true,
      cycleName: true,
    },
  })

  if (!cycle) {
    throw new AppError(404, 'CYCLE_NOT_FOUND', '평가 주기를 찾을 수 없습니다.')
  }

  const workflows = await prisma.onboardingReviewWorkflow.findMany({
    where: {
      evalCycleId: params.cycleId,
      ...(params.workflowId ? { id: params.workflowId } : { isActive: true }),
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!workflows.length) {
    return {
      workflowCount: 0,
      createdCount: 0,
      duplicateCount: 0,
      scheduledLaterCount: 0,
      ineligibleCount: 0,
      skippedNoManagerCount: 0,
    }
  }

  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      department: {
        orgId: cycle.orgId,
      },
    },
    select: {
      id: true,
      empName: true,
      joinDate: true,
      position: true,
      teamLeaderId: true,
      sectionChiefId: true,
      divisionHeadId: true,
      department: {
        select: {
          deptName: true,
        },
      },
    },
    orderBy: [{ joinDate: 'asc' }, { empName: 'asc' }],
  })

  const employeeTargets: OnboardingWorkflowTargetEmployee[] = employees.map((employee) => ({
    id: employee.id,
    name: employee.empName,
    joinDate: employee.joinDate,
    position: employee.position,
    departmentName: employee.department.deptName,
    managerId: resolveManagerId(employee),
  }))

  const existingGenerations = await prisma.onboardingReviewGeneration.findMany({
    where: {
      workflowId: {
        in: workflows.map((workflow) => workflow.id),
      },
    },
    select: {
      workflowId: true,
      employeeId: true,
      stepId: true,
    },
  })

  const existingGenerationKeys = new Set(
    existingGenerations.map((generation) => `${generation.workflowId}:${generation.employeeId}:${generation.stepId}`)
  )

  let createdCount = 0
  let duplicateCount = 0
  let scheduledLaterCount = 0
  let ineligibleCount = 0
  let skippedNoManagerCount = 0

  for (const workflow of workflows) {
    const targetConditions = parseStoredConditions(workflow.targetConditions)
    const steps = parseStoredSteps(workflow.stepConfig)
    if (!steps.length) continue

    const plan = planOnboardingWorkflowGeneration({
      workflow: {
        id: workflow.id,
        evalCycleId: workflow.evalCycleId,
        workflowName: workflow.workflowName,
        isActive: workflow.isActive,
        scheduleHourKst: workflow.scheduleHourKst,
        targetConditions,
        steps,
      },
      evalYear: cycle.evalYear,
      cycleName: cycle.cycleName,
      employees: employeeTargets,
      existingGenerationKeys: existingGenerationKeys as Set<string>,
      now: params.now,
    })

    duplicateCount += plan.duplicateCount
    scheduledLaterCount += plan.scheduledLaterCount
    ineligibleCount += plan.ineligibleCount

    for (const item of plan.created) {
      const employee = employeeTargets.find((entry) => entry.id === item.employeeId)
      const managerId = employee?.managerId ?? null
      if (!employee || !managerId) {
        skippedNoManagerCount += 1
        continue
      }

      const step = steps.find((entry) => entry.id === item.stepId)
      if (!step) continue

      const now = params.now ?? new Date()
      const { startDate, endDate } = resolveRoundWindow(workflow.scheduleHourKst, step.durationDays, now)

      try {
        const created = await prisma.$transaction(async (tx) => {
          const round = await tx.multiFeedbackRound.create({
            data: {
              evalCycleId: workflow.evalCycleId,
              roundName: item.roundName,
              roundType: 'FULL_360',
              startDate,
              endDate,
              status: 'IN_PROGRESS',
              isAnonymous: false,
              minRaters: 1,
              maxRaters: 1,
              weightInFinal: 0,
              selectionSettings: toPrismaJson({}),
              visibilitySettings: toPrismaJson(DEFAULT_VISIBILITY_SETTINGS),
              questions: {
                create: buildDefaultQuestions(),
              },
              feedbacks: {
                create: {
                  giverId: managerId,
                  receiverId: employee.id,
                  relationship: 'SUPERVISOR',
                  status: 'PENDING',
                },
              },
            },
          })

          const generation = await tx.onboardingReviewGeneration.create({
            data: {
              workflowId: workflow.id,
              employeeId: employee.id,
              roundId: round.id,
              stepId: item.stepId,
              stepOrder: item.stepOrder,
              stepName: item.stepName,
              roundNameSnapshot: item.roundName,
              scheduledDateKey: item.dueDateKey,
            },
          })

          return { round, generation }
        })

        existingGenerationKeys.add(`${workflow.id}:${employee.id}:${item.stepId}`)
        createdCount += 1
        void created
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('Unique constraint')) {
          duplicateCount += 1
          continue
        }
        throw error
      }
    }
  }

  return {
    workflowCount: workflows.length,
    createdCount,
    duplicateCount,
    scheduledLaterCount,
    ineligibleCount,
    skippedNoManagerCount,
  }
}

export async function runScheduledOnboardingReviewGeneration(params?: { now?: Date }) {
  const workflowCycles = await prisma.onboardingReviewWorkflow.findMany({
    where: {
      isActive: true,
    },
    select: {
      evalCycleId: true,
    },
    distinct: ['evalCycleId'],
  })

  let workflowCount = 0
  let createdCount = 0
  let duplicateCount = 0
  let scheduledLaterCount = 0
  let ineligibleCount = 0
  let skippedNoManagerCount = 0

  for (const cycle of workflowCycles) {
    const result = await runOnboardingReviewGeneration({
      cycleId: cycle.evalCycleId,
      now: params?.now,
    })
    workflowCount += result.workflowCount
    createdCount += result.createdCount
    duplicateCount += result.duplicateCount
    scheduledLaterCount += result.scheduledLaterCount
    ineligibleCount += result.ineligibleCount
    skippedNoManagerCount += result.skippedNoManagerCount
  }

  return {
    cycleCount: workflowCycles.length,
    workflowCount,
    createdCount,
    duplicateCount,
    scheduledLaterCount,
    ineligibleCount,
    skippedNoManagerCount,
  }
}
