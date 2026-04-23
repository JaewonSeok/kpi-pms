import { AIRequestStatus, AIRequestType, type Difficulty, type PrismaClient, type SystemRole } from '@prisma/client'
import { generateAiAssist } from '@/lib/ai-assist'
import { getPersonalKpiScopeDepartmentIds } from '@/lib/personal-kpi-access'
import {
  buildPersonalKpiDraftFallbackResult,
  normalizePersonalKpiDraftResult,
  type PersonalKpiDraftResult,
} from '@/lib/personal-kpi-ai-draft'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/utils'

type JsonRecord = Record<string, unknown>

type PersonalKpiAiActor = {
  id: string
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
}

export type PersonalKpiAiParams = {
  requesterId: string
  sourceId?: string
  payload: JsonRecord
  actor?: PersonalKpiAiActor
}

type PersonalKpiAiGenerator = typeof generateAiAssist

type PersonalKpiDraftContext = {
  payload: JsonRecord
  sourceKpiId?: string
}

type PersonalKpiDraftOptions = {
  db?: PrismaClient
  executeAiAssist?: PersonalKpiAiGenerator
}

type OrgKpiCascadeNode = {
  id: string
  title: string
  category: string
  definition: string | null
  formula: string | null
  targetValue: number | null
  targetValueT: number | null
  targetValueE: number | null
  targetValueS: number | null
  unit: string | null
  weight: number
  difficulty: Difficulty
  deptId: string
  departmentName: string
  parentOrgKpiId: string | null
}

const POSITION_LABELS: Record<string, string> = {
  MEMBER: '구성원',
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장/부문장',
  DIV_HEAD: '본부장',
  CEO: 'CEO',
}

const ROLE_LABELS: Record<string, string> = {
  ROLE_MEMBER: '구성원',
  ROLE_TEAM_LEADER: '팀장',
  ROLE_SECTION_CHIEF: '실장/부문장',
  ROLE_DIV_HEAD: '본부장',
  ROLE_CEO: 'CEO',
  ROLE_ADMIN: 'HR 관리자',
}

function toRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function toStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function toNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toDifficultyValue(value: unknown): Difficulty | null {
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW' ? value : null
}

function uniqueTextList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim().length))))
}

function buildDepartmentScopedAccessGuard(actor: PersonalKpiAiActor | undefined, targetDepartmentId: string, targetEmployeeId: string) {
  if (!actor) return
  if (actor.id === targetEmployeeId) return

  const scopeDepartmentIds = getPersonalKpiScopeDepartmentIds({
    role: actor.role,
    deptId: actor.deptId,
    accessibleDepartmentIds: actor.accessibleDepartmentIds,
  })

  if (scopeDepartmentIds && !scopeDepartmentIds.includes(targetDepartmentId)) {
    throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 개인 KPI입니다.')
  }
}

async function loadOrgKpiCascade(orgKpiId: string, db: PrismaClient) {
  const visited = new Set<string>()
  const chain: OrgKpiCascadeNode[] = []

  let currentId: string | null = orgKpiId
  let depth = 0

  while (currentId && depth < 8 && !visited.has(currentId)) {
    visited.add(currentId)
    const orgKpi: {
      id: string
      kpiName: string
      kpiCategory: string
      definition: string | null
      formula: string | null
      targetValue: number | null
      targetValueT: number | null
      targetValueE: number | null
      targetValueS: number | null
      unit: string | null
      weight: number
      difficulty: Difficulty
      deptId: string
      parentOrgKpiId: string | null
      department: { deptName: string } | null
    } | null = await db.orgKpi.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        kpiName: true,
        kpiCategory: true,
        definition: true,
        formula: true,
        targetValue: true,
        targetValueT: true,
        targetValueE: true,
        targetValueS: true,
        unit: true,
        weight: true,
        difficulty: true,
        deptId: true,
        parentOrgKpiId: true,
        department: {
          select: {
            deptName: true,
          },
        },
      },
    })

    if (!orgKpi) break

    chain.unshift({
      id: orgKpi.id,
      title: orgKpi.kpiName,
      category: orgKpi.kpiCategory,
      definition: orgKpi.definition,
      formula: orgKpi.formula,
      targetValue: orgKpi.targetValue,
      targetValueT: orgKpi.targetValueT,
      targetValueE: orgKpi.targetValueE,
      targetValueS: orgKpi.targetValueS,
      unit: orgKpi.unit,
      weight: orgKpi.weight,
      difficulty: orgKpi.difficulty,
      deptId: orgKpi.deptId,
      departmentName: orgKpi.department?.deptName ?? '미지정 조직',
      parentOrgKpiId: orgKpi.parentOrgKpiId,
    })

    currentId = orgKpi.parentOrgKpiId
    depth += 1
  }

  return chain
}

function buildOrgKpiSnapshot(
  goal:
    | {
        id: string
        title: string
        category: string
        definition: string | null
        formula: string | null
        targetValue: number | null
        targetValueT: number | null
        targetValueE: number | null
        targetValueS: number | null
        unit: string | null
        departmentName: string
      }
    | null
) {
  if (!goal) return null

  return {
    id: goal.id,
    title: goal.title,
    category: goal.category,
    definition: goal.definition,
    formula: goal.formula,
    targetValue: goal.targetValue,
    targetValueT: goal.targetValueT,
    targetValueE: goal.targetValueE,
    targetValueS: goal.targetValueS,
    unit: goal.unit,
    departmentLabel: goal.departmentName,
  }
}

function resolveTeamGoalFromCascade(params: {
  cascade: OrgKpiCascadeNode[]
  employeeDeptId: string
  divisionGoal: OrgKpiCascadeNode | null
  linkedGoal: OrgKpiCascadeNode | null
}) {
  const closestEmployeeDepartmentGoal =
    [...params.cascade].reverse().find((goal) => goal.deptId === params.employeeDeptId) ?? null

  if (closestEmployeeDepartmentGoal && closestEmployeeDepartmentGoal.id !== params.divisionGoal?.id) {
    return closestEmployeeDepartmentGoal
  }

  if (params.linkedGoal && params.linkedGoal.id !== params.divisionGoal?.id) {
    return params.linkedGoal
  }

  return null
}

function buildRecentMonthlyContext(records: Array<{
  id: string
  yearMonth: string
  achievementRate: number | null
  activities: string | null
  obstacles: string | null
  evidenceComment: string | null
  personalKpi?: { kpiName: string } | null
}>) {
  return records.map((record) => ({
    id: record.id,
    month: record.yearMonth,
    kpiTitle: record.personalKpi?.kpiName,
    achievementRate: record.achievementRate,
    activities: record.activities,
    obstacles: record.obstacles,
    evidenceComment: record.evidenceComment,
  }))
}

export async function loadPersonalKpiDraftContext(
  params: PersonalKpiAiParams,
  db: PrismaClient = prisma
): Promise<PersonalKpiDraftContext> {
  const requestedYear = toNumberValue(params.payload.selectedYear)
  const selectedCycleId = toStringValue(params.payload.selectedCycleId)
  const currentDraft = toRecord(params.payload.currentDraft)
  const sourceKpi =
    params.sourceId
      ? await db.personalKpi.findUnique({
          where: { id: params.sourceId },
          include: {
            employee: {
              include: {
                department: true,
              },
            },
            linkedOrgKpi: {
              include: {
                department: true,
              },
            },
            monthlyRecords: {
              orderBy: {
                yearMonth: 'desc',
              },
              take: 6,
            },
          },
        })
      : null

  if (params.sourceId && !sourceKpi) {
    throw new AppError(404, 'PERSONAL_KPI_NOT_FOUND', '개인 KPI를 찾을 수 없습니다.')
  }

  const targetEmployeeId = toStringValue(params.payload.employeeId) ?? sourceKpi?.employeeId
  if (!targetEmployeeId) {
    throw new AppError(400, 'PERSONAL_KPI_AI_TARGET_REQUIRED', 'AI 초안 생성을 위한 대상 직원 정보가 필요합니다.')
  }

  const employee =
    sourceKpi?.employeeId === targetEmployeeId
      ? sourceKpi.employee
      : await db.employee.findUnique({
          where: { id: targetEmployeeId },
          include: {
            department: true,
          },
        })

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '대상 직원을 찾을 수 없습니다.')
  }

  buildDepartmentScopedAccessGuard(params.actor, employee.deptId, employee.id)

  const selectedYear = requestedYear ?? sourceKpi?.evalYear ?? new Date().getFullYear()
  const linkedOrgKpiId = toStringValue(params.payload.linkedOrgKpiId) ?? sourceKpi?.linkedOrgKpiId ?? null
  if (!linkedOrgKpiId) {
    throw new AppError(
      400,
      'PERSONAL_KPI_AI_ORG_CONTEXT_REQUIRED',
      '연계 조직 KPI를 선택한 뒤 AI 초안 생성을 실행해 주세요.'
    )
  }

  const cascade = await loadOrgKpiCascade(linkedOrgKpiId, db)
  if (!cascade.length) {
    throw new AppError(404, 'ORG_KPI_NOT_FOUND', '연계 조직 KPI 구조를 찾을 수 없습니다.')
  }

  const linkedGoal = cascade[cascade.length - 1] ?? null
  const divisionGoal = cascade[0] ?? linkedGoal
  const teamGoal = resolveTeamGoalFromCascade({
    cascade,
    employeeDeptId: employee.deptId,
    divisionGoal,
    linkedGoal,
  })

  const [existingPersonalKpis, recentMonthlyRecords, businessPlan, divisionJobDescription, teamJobDescription, teamRecommendationSet] =
    await Promise.all([
      db.personalKpi.findMany({
        where: {
          employeeId: employee.id,
          evalYear: selectedYear,
          ...(sourceKpi?.id ? { NOT: { id: sourceKpi.id } } : {}),
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          id: true,
          kpiName: true,
          definition: true,
          formula: true,
          weight: true,
          status: true,
          linkedOrgKpiId: true,
          linkedOrgKpi: {
            select: {
              kpiName: true,
            },
          },
        },
      }),
      sourceKpi?.monthlyRecords?.length
        ? Promise.resolve(
            sourceKpi.monthlyRecords.map((record) => ({
              ...record,
              personalKpi: { kpiName: sourceKpi.kpiName },
            }))
          )
        : db.monthlyRecord.findMany({
            where: {
              employeeId: employee.id,
              personalKpi: {
                is: {
                  evalYear: selectedYear,
                },
              },
            },
            orderBy: [
              {
                yearMonth: 'desc',
              },
              {
                updatedAt: 'desc',
              },
            ],
            take: 6,
            select: {
              id: true,
              yearMonth: true,
              achievementRate: true,
              activities: true,
              obstacles: true,
              evidenceComment: true,
              personalKpi: {
                select: {
                  kpiName: true,
                },
              },
            },
          }),
      db.businessPlanDocument.findFirst({
        where: {
          deptId: divisionGoal.deptId,
          evalYear: selectedYear,
          ...(selectedCycleId ? { evalCycleId: selectedCycleId } : {}),
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      db.jobDescriptionDocument.findFirst({
        where: {
          deptId: divisionGoal.deptId,
          scope: 'DIVISION',
          evalYear: selectedYear,
          ...(selectedCycleId ? { evalCycleId: selectedCycleId } : {}),
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      db.jobDescriptionDocument.findFirst({
        where: {
          deptId: employee.deptId,
          scope: 'TEAM',
          evalYear: selectedYear,
          ...(selectedCycleId ? { evalCycleId: selectedCycleId } : {}),
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      db.teamKpiRecommendationSet.findFirst({
        where: {
          targetDepartmentId: employee.deptId,
          evalYear: selectedYear,
          ...(selectedCycleId ? { evalCycleId: selectedCycleId } : {}),
        },
        include: {
          items: {
            orderBy: {
              rank: 'asc',
            },
            take: 5,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ])

  const currentTitle = toStringValue(params.payload.kpiName) ?? sourceKpi?.kpiName ?? toStringValue(currentDraft?.title) ?? ''
  const payload: JsonRecord = {
    selectedYear,
    selectedCycleId,
    employeeProfile: {
      departmentLabel: employee.department?.deptName ?? '미지정 조직',
      roleLabel: ROLE_LABELS[employee.role] ?? employee.role,
      positionLabel: POSITION_LABELS[employee.position] ?? employee.position,
      jobTitleText: employee.jobTitle ?? null,
      teamLabel: employee.teamName ?? null,
      displayLabel: `${employee.department?.deptName ?? '조직'} ${employee.jobTitle ?? POSITION_LABELS[employee.position] ?? employee.position}`,
    },
    currentSourceKpi: sourceKpi
      ? {
          id: sourceKpi.id,
          title: sourceKpi.kpiName,
          definition: sourceKpi.definition ?? null,
          formula: sourceKpi.formula ?? null,
          targetValue: sourceKpi.targetValue ?? null,
          unit: sourceKpi.unit ?? null,
          weight: sourceKpi.weight,
          difficulty: sourceKpi.difficulty,
          linkedOrgKpiId: sourceKpi.linkedOrgKpiId ?? null,
        }
      : null,
    currentDraft: {
      title: currentTitle,
      definition: toStringValue(params.payload.definition) ?? sourceKpi?.definition ?? toStringValue(currentDraft?.definition) ?? '',
      formula: toStringValue(params.payload.formula) ?? sourceKpi?.formula ?? toStringValue(currentDraft?.formula) ?? '',
      targetValue:
        toNumberValue(params.payload.targetValue) ??
        sourceKpi?.targetValue ??
        toNumberValue(currentDraft?.targetValue) ??
        null,
      unit: toStringValue(params.payload.unit) ?? sourceKpi?.unit ?? toStringValue(currentDraft?.unit) ?? '',
      weight:
        toNumberValue(params.payload.weight) ??
        sourceKpi?.weight ??
        toNumberValue(currentDraft?.weight) ??
        20,
      difficulty:
        toDifficultyValue(params.payload.difficulty) ??
        sourceKpi?.difficulty ??
        toDifficultyValue(currentDraft?.difficulty) ??
        'MEDIUM',
      category:
        toStringValue(params.payload.orgKpiCategory) ??
        linkedGoal.category ??
        toStringValue(currentDraft?.category) ??
        '개인 기여',
    },
    orgKpiName: linkedGoal.title,
    orgKpiCategory: linkedGoal.category,
    orgCascade: {
      pathLabels: cascade.map((goal) => `${goal.departmentName} · ${goal.title}`),
      linkedGoal: buildOrgKpiSnapshot(linkedGoal),
      divisionGoal: buildOrgKpiSnapshot(divisionGoal),
      teamGoal: buildOrgKpiSnapshot(teamGoal),
    },
    existingPersonalKpis: existingPersonalKpis.map((item) => ({
      id: item.id,
      title: item.kpiName,
      definition: item.definition ?? null,
      formula: item.formula ?? null,
      weight: item.weight,
      status: item.status,
      linkedOrgKpiId: item.linkedOrgKpiId ?? null,
      orgKpiTitle: item.linkedOrgKpi?.kpiName ?? null,
    })),
    recentMonthlyRecords: buildRecentMonthlyContext(recentMonthlyRecords),
    businessContext: {
      businessPlanSummaryText: uniqueTextList([businessPlan?.summaryText, businessPlan?.title, businessPlan?.bodyText]).join(' '),
      divisionJobDescriptionSummaryText: uniqueTextList([
        divisionJobDescription?.summaryText,
        divisionJobDescription?.title,
        divisionJobDescription?.bodyText,
      ]).join(' '),
      teamJobDescriptionSummaryText: uniqueTextList([
        teamJobDescription?.summaryText,
        teamJobDescription?.title,
        teamJobDescription?.bodyText,
      ]).join(' '),
    },
    teamRecommendationContext: {
      items:
        teamRecommendationSet?.items.map((item) => ({
          title: item.title,
          sourceOrgKpiTitle: item.sourceOrgKpiTitle ?? null,
          linkageReason: item.linkageExplanation,
          recommendationReason: item.recommendationReason,
          recommendationType: item.recommendationType,
          whyThisIsHighQuality: item.whyThisIsHighQuality ?? null,
        })) ?? [],
    },
    generationRules: [
      '본부 KPI는 전략 방향, 팀 KPI는 팀 실행 초점, 개인 KPI는 개인 기여 표현으로 해석합니다.',
      '서로 다른 관점과 측정 로직을 가진 3~5개의 초안을 생성합니다.',
      '기존 개인 KPI와 제목/정의/공식이 겹치는 초안은 피합니다.',
    ],
  }

  return {
    payload,
    sourceKpiId: sourceKpi?.id,
  }
}

async function runPersonalKpiAiAssist(
  params: PersonalKpiAiParams,
  sourceType: string,
  db: PrismaClient = prisma
) {
  return generateAiAssist(
    {
      requesterId: params.requesterId,
      requestType: AIRequestType.KPI_ASSIST,
      sourceType,
      sourceId: params.sourceId,
      payload: params.payload,
    },
    db
  )
}

async function approveNormalizedDraftResult(params: {
  requestLogId: string
  result: PersonalKpiDraftResult
  previewSource: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  db: PrismaClient
}) {
  const nextStatus =
    params.previewSource === 'disabled'
      ? AIRequestStatus.DISABLED
      : params.previewSource === 'fallback'
        ? AIRequestStatus.FALLBACK
        : AIRequestStatus.SUCCESS

  await params.db.aiRequestLog.update({
    where: { id: params.requestLogId },
    data: {
      requestStatus: nextStatus,
      responsePayload: params.result as never,
      ...(params.previewSource !== 'ai'
        ? {
            errorMessage: params.fallbackReason ?? undefined,
          }
        : {}),
    },
  })
}

export async function generatePersonalKpiDraft(
  params: PersonalKpiAiParams,
  options?: PersonalKpiDraftOptions
) {
  const db = options?.db ?? prisma
  const executeAiAssist = options?.executeAiAssist ?? generateAiAssist
  const context = await loadPersonalKpiDraftContext(params, db)
  const preview = await executeAiAssist(
    {
      requesterId: params.requesterId,
      requestType: AIRequestType.KPI_ASSIST,
      sourceType: 'PersonalKpiDraft',
      sourceId: context.sourceKpiId ?? params.sourceId,
      payload: context.payload,
    },
    db
  )

  try {
    const normalized = normalizePersonalKpiDraftResult({
      rawResult: toRecord(preview.result) ?? {},
      payload: context.payload,
    })

    await approveNormalizedDraftResult({
      requestLogId: preview.requestLogId,
      result: normalized,
      previewSource: preview.source,
      fallbackReason: preview.fallbackReason,
      db,
    })

    return {
      ...preview,
      result: normalized,
    }
  } catch (error) {
    const fallbackResult = buildPersonalKpiDraftFallbackResult(context.payload)
    const errorMessage =
      error instanceof Error
        ? error.message
        : '개인 KPI AI 초안을 정규화하는 중 문제가 발생했습니다.'

    await db.aiRequestLog.update({
      where: { id: preview.requestLogId },
      data: {
        requestStatus: AIRequestStatus.FALLBACK,
        responsePayload: fallbackResult as never,
        errorCode: 'AI_INVALID_SHAPE',
        errorMessage,
      },
    })

    return {
      requestLogId: preview.requestLogId,
      source: 'fallback' as const,
      fallbackReason: errorMessage,
      result: fallbackResult,
    }
  }
}

export async function improvePersonalKpiWording(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiWording', db)
}

export async function evaluatePersonalSmartCriteria(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiSmart', db)
}

export async function suggestWeightAllocation(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiWeight', db)
}

export async function suggestOrgKpiAlignment(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiAlignment', db)
}

export async function detectDuplicatePersonalKpis(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiDuplicate', db)
}

export async function summarizeReviewerRisks(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiReviewerRisk', db)
}

export async function draftPersonalMonthlyComment(params: PersonalKpiAiParams, db: PrismaClient = prisma) {
  return runPersonalKpiAiAssist(params, 'PersonalKpiMonthlyComment', db)
}
