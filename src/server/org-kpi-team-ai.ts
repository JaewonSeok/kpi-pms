/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import 'server-only'

import {
  Difficulty,
  GoalEditMode,
  type BusinessPlanDocument,
  type BusinessPlanSourceType,
  type Department,
  type KpiType,
  type Prisma,
  type SystemRole,
  type TeamKpiRecommendationDecision,
  type TeamKpiReviewVerdict,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildOrgKpiTargetValuePersistence,
  formatOrgKpiTargetValues,
  resolveOrgKpiTargetValues,
} from '@/lib/org-kpi-target-values'
import { AppError } from '@/lib/utils'
import { createAuditLog } from '@/lib/audit'
import { validateOrgParentLink } from '@/server/goal-alignment'
import {
  recommendTeamKpiRecommendations,
  reviewTeamKpiRecommendations,
} from '@/server/ai/org-kpi'

type DepartmentWithContext = Department & {
  organization: {
    id: string
    orgName: string
  }
  leaderEmployee: {
    id: string
    empName: string
    position: string
  } | null
}

type SessionScopeParams = {
  role: SystemRole
  deptId: string
  accessibleDepartmentIds?: string[] | null
}

type OrgKpiDraftInput = {
  kpiType: KpiType
  kpiCategory: string
  kpiName: string
  definition?: string
  formula?: string
  targetValueT: number
  targetValueE: number
  targetValueS: number
  unit?: string
  weight: number
  difficulty: Difficulty
  tags?: string[]
  parentOrgKpiId?: string | null
}

export type OrgKpiBusinessPlanView = {
  id: string
  departmentId: string
  departmentName: string
  evalYear: number
  evalCycleId?: string | null
  title: string
  sourceType: BusinessPlanSourceType
  summaryText?: string | null
  bodyText: string
  createdById: string
  updatedById?: string | null
  createdAt: string
  updatedAt: string
}

export type OrgKpiTeamRecommendationItemView = {
  id: string
  rank: number
  title: string
  definition?: string
  formula?: string
  targetValueT?: number
  targetValueE?: number
  targetValueS?: number
  unit?: string
  weightSuggestion?: number
  difficultySuggestion?: Difficulty
  sourceOrgKpiId?: string | null
  sourceOrgKpiTitle?: string | null
  linkageExplanation: string
  recommendationReason: string
  riskComment?: string | null
  decision: TeamKpiRecommendationDecision
  adoptedOrgKpiId?: string | null
  customizedDraft?: Record<string, unknown> | null
  decidedById?: string | null
  decidedAt?: string | null
}

export type OrgKpiTeamRecommendationSetView = {
  id: string
  sourceDepartmentId: string
  sourceDepartmentName: string
  targetDepartmentId: string
  summaryText?: string | null
  aiRequestLogId?: string | null
  createdAt: string
  items: OrgKpiTeamRecommendationItemView[]
}

export type OrgKpiTeamReviewItemView = {
  id: string
  orgKpiId?: string | null
  kpiTitleSnapshot: string
  verdict: TeamKpiReviewVerdict
  rationale: string
  linkageComment?: string | null
  measurabilityComment?: string | null
  controllabilityComment?: string | null
  challengeComment?: string | null
  externalRiskComment?: string | null
  clarityComment?: string | null
  recommendationText?: string | null
}

export type OrgKpiTeamReviewRunView = {
  id: string
  sourceDepartmentId?: string | null
  sourceDepartmentName?: string | null
  targetDepartmentId: string
  overallVerdict?: TeamKpiReviewVerdict | null
  overallSummary?: string | null
  aiRequestLogId?: string | null
  createdAt: string
  items: OrgKpiTeamReviewItemView[]
}

export type OrgKpiTeamAiContextView = {
  targetDepartmentId: string
  planningDepartmentId: string
  planningDepartmentName: string
  planningSourceLabel: string
  evalYear: number
  evalCycleId?: string | null
  canEditBusinessPlan: boolean
  canRequestRecommendation: boolean
  canRunReview: boolean
  businessPlan: OrgKpiBusinessPlanView | null
  sourceOrgKpis: Array<{
    id: string
    title: string
    category?: string
    targetValuesText: string
    weight?: number
    difficulty?: Difficulty
  }>
  recommendationSets: OrgKpiTeamRecommendationSetView[]
  reviewRuns: OrgKpiTeamReviewRunView[]
}

export function canEditBusinessPlan(role: SystemRole) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD'].includes(role)
}

export function canOperateTeamKpiAi(role: SystemRole) {
  return ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'].includes(
    role
  )
}

export function getOrgKpiScopeDepartmentIds(params: SessionScopeParams) {
  if (params.role === 'ROLE_ADMIN' || params.role === 'ROLE_CEO') {
    return null
  }

  if (params.role === 'ROLE_MEMBER') {
    return [params.deptId]
  }

  return params.accessibleDepartmentIds?.length ? params.accessibleDepartmentIds : [params.deptId]
}

export function resolvePlanningDepartmentIdFromGraph(
  targetDepartmentId: string,
  departmentsById: Map<string, Pick<DepartmentWithContext, 'id' | 'parentDeptId' | 'leaderEmployee'>>
) {
  let currentId: string | null = targetDepartmentId

  while (currentId) {
    const current = departmentsById.get(currentId)
    if (!current) {
      break
    }

    if (current.leaderEmployee?.position === 'DIV_HEAD') {
      return current.id
    }

    currentId = current.parentDeptId
  }

  return targetDepartmentId
}

function mapBusinessPlan(document: BusinessPlanDocument & { department: { deptName: string } }): OrgKpiBusinessPlanView {
  return {
    id: document.id,
    departmentId: document.deptId,
    departmentName: document.department.deptName,
    evalYear: document.evalYear,
    evalCycleId: document.evalCycleId,
    title: document.title,
    sourceType: document.sourceType,
    summaryText: document.summaryText,
    bodyText: document.bodyText,
    createdById: document.createdById,
    updatedById: document.updatedById,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  }
}

function mapRecommendationSet(
  set: Prisma.TeamKpiRecommendationSetGetPayload<{
    include: {
      sourceDepartment: { select: { deptName: true } }
      items: true
    }
  }>
): OrgKpiTeamRecommendationSetView {
  return {
    id: set.id,
    sourceDepartmentId: set.sourceDepartmentId,
    sourceDepartmentName: set.sourceDepartment.deptName,
    targetDepartmentId: set.targetDepartmentId,
    summaryText: set.summaryText,
    aiRequestLogId: set.aiRequestLogId,
    createdAt: set.createdAt.toISOString(),
    items: set.items
      .slice()
      .sort((left, right) => left.rank - right.rank)
      .map((item) => ({
        id: item.id,
        rank: item.rank,
        title: item.title,
        definition: item.definition ?? undefined,
        formula: item.formula ?? undefined,
        targetValueT: item.targetValueT ?? undefined,
        targetValueE: item.targetValueE ?? undefined,
        targetValueS: item.targetValueS ?? undefined,
        unit: item.unit ?? undefined,
        weightSuggestion: item.weightSuggestion ?? undefined,
        difficultySuggestion: item.difficultySuggestion ?? undefined,
        sourceOrgKpiId: item.sourceOrgKpiId,
        sourceOrgKpiTitle: item.sourceOrgKpiTitle,
        linkageExplanation: item.linkageExplanation,
        recommendationReason: item.recommendationReason,
        riskComment: item.riskComment,
        decision: item.decision,
        adoptedOrgKpiId: item.adoptedOrgKpiId,
        customizedDraft:
          item.customizedDraft && typeof item.customizedDraft === 'object'
            ? (item.customizedDraft as Record<string, unknown>)
            : null,
        decidedById: item.decidedById,
        decidedAt: item.decidedAt?.toISOString() ?? null,
      })),
  }
}

function mapReviewRun(
  run: Prisma.TeamKpiReviewRunGetPayload<{
    include: {
      sourceDepartment: { select: { deptName: true } }
      items: true
    }
  }>
): OrgKpiTeamReviewRunView {
  return {
    id: run.id,
    sourceDepartmentId: run.sourceDepartmentId,
    sourceDepartmentName: run.sourceDepartment?.deptName,
    targetDepartmentId: run.targetDepartmentId,
    overallVerdict: run.overallVerdict,
    overallSummary: run.overallSummary,
    aiRequestLogId: run.aiRequestLogId,
    createdAt: run.createdAt.toISOString(),
    items: run.items.map((item) => ({
      id: item.id,
      orgKpiId: item.orgKpiId,
      kpiTitleSnapshot: item.kpiTitleSnapshot,
      verdict: item.verdict,
      rationale: item.rationale,
      linkageComment: item.linkageComment,
      measurabilityComment: item.measurabilityComment,
      controllabilityComment: item.controllabilityComment,
      challengeComment: item.challengeComment,
      externalRiskComment: item.externalRiskComment,
      clarityComment: item.clarityComment,
      recommendationText: item.recommendationText,
    })),
  }
}

async function loadDepartmentGraph() {
  const departments = await prisma.department.findMany({
    include: {
      organization: {
        select: {
          id: true,
          orgName: true,
        },
      },
      leaderEmployee: {
        select: {
          id: true,
          empName: true,
          position: true,
        },
      },
    },
    orderBy: [{ deptName: 'asc' }],
  })

  return {
    departmentsById: new Map(departments.map((department) => [department.id, department])),
  }
}

async function resolveTargetCycle(orgId: string, evalYear: number) {
  return prisma.evalCycle.findFirst({
    where: {
      orgId,
      evalYear,
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      goalEditMode: true,
    },
  })
}

function assertDepartmentScope(scopeDepartmentIds: string[] | null, targetDepartmentId: string) {
  if (scopeDepartmentIds && !scopeDepartmentIds.includes(targetDepartmentId)) {
    throw new AppError(403, 'FORBIDDEN', '권한 범위를 벗어난 조직입니다.')
  }
}

type LoadContextParams = SessionScopeParams & {
  userId: string
  targetDepartmentId: string
  evalYear: number
}

export async function loadOrgKpiTeamAiContext(
  params: LoadContextParams
): Promise<OrgKpiTeamAiContextView> {
  const scopeDepartmentIds = getOrgKpiScopeDepartmentIds(params)
  assertDepartmentScope(scopeDepartmentIds, params.targetDepartmentId)

  const { departmentsById } = await loadDepartmentGraph()
  const targetDepartment = departmentsById.get(params.targetDepartmentId)
  if (!targetDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
  }

  const planningDepartmentId = resolvePlanningDepartmentIdFromGraph(params.targetDepartmentId, departmentsById)
  const planningDepartment = departmentsById.get(planningDepartmentId)
  if (!planningDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '추천 기준 조직 정보를 찾을 수 없습니다.')
  }

  const cycle = await resolveTargetCycle(targetDepartment.organization.id, params.evalYear)

  const [businessPlan, sourceOrgKpis, recommendationSets, reviewRuns] = await Promise.all([
    prisma.businessPlanDocument.findFirst({
      where: {
        deptId: planningDepartmentId,
        evalYear: params.evalYear,
      },
      include: {
        department: {
          select: {
            deptName: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    }),
    prisma.orgKpi.findMany({
      where: {
        deptId: planningDepartmentId,
        evalYear: params.evalYear,
      },
      select: {
        id: true,
        kpiName: true,
        kpiCategory: true,
        targetValue: true,
        targetValueT: true,
        targetValueE: true,
        targetValueS: true,
        unit: true,
        weight: true,
        difficulty: true,
      },
      orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
    }),
    prisma.teamKpiRecommendationSet.findMany({
      where: {
        targetDepartmentId: params.targetDepartmentId,
        evalYear: params.evalYear,
      },
      include: {
        sourceDepartment: {
          select: {
            deptName: true,
          },
        },
        items: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 5,
    }),
    prisma.teamKpiReviewRun.findMany({
      where: {
        targetDepartmentId: params.targetDepartmentId,
        evalYear: params.evalYear,
      },
      include: {
        sourceDepartment: {
          select: {
            deptName: true,
          },
        },
        items: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 5,
    }),
  ])

  return {
    targetDepartmentId: params.targetDepartmentId,
    planningDepartmentId,
    planningDepartmentName: planningDepartment.deptName,
    planningSourceLabel:
      planningDepartmentId === params.targetDepartmentId
        ? '현재 조직 기준'
        : `${planningDepartment.deptName} 사업계획서 기준`,
    evalYear: params.evalYear,
    evalCycleId: cycle?.id ?? null,
    canEditBusinessPlan:
      canEditBusinessPlan(params.role) &&
      (!scopeDepartmentIds || scopeDepartmentIds.includes(planningDepartmentId)),
    canRequestRecommendation: canOperateTeamKpiAi(params.role),
    canRunReview: canOperateTeamKpiAi(params.role),
    businessPlan: businessPlan ? mapBusinessPlan(businessPlan) : null,
    sourceOrgKpis: sourceOrgKpis.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      category: kpi.kpiCategory,
      targetValuesText: formatOrgKpiTargetValues({
        ...resolveOrgKpiTargetValues({
          targetValue: kpi.targetValue ?? undefined,
          targetValueT: kpi.targetValueT ?? undefined,
          targetValueE: kpi.targetValueE ?? undefined,
          targetValueS: kpi.targetValueS ?? undefined,
        }),
        unit: kpi.unit ?? undefined,
      }),
      weight: Number(kpi.weight),
      difficulty: kpi.difficulty,
    })),
    recommendationSets: recommendationSets.map(mapRecommendationSet),
    reviewRuns: reviewRuns.map(mapReviewRun),
  }
}

type SaveBusinessPlanParams = SessionScopeParams & {
  userId: string
  id?: string
  targetDepartmentId: string
  evalYear: number
  evalCycleId?: string | null
  title: string
  sourceType: BusinessPlanSourceType
  summaryText?: string
  bodyText: string
}

export async function saveBusinessPlanDocument(params: SaveBusinessPlanParams) {
  if (!canEditBusinessPlan(params.role)) {
    throw new AppError(403, 'FORBIDDEN', '사업계획서를 저장할 권한이 없습니다.')
  }

  const scopeDepartmentIds = getOrgKpiScopeDepartmentIds(params)
  assertDepartmentScope(scopeDepartmentIds, params.targetDepartmentId)

  const targetDepartment = await prisma.department.findUnique({
    where: { id: params.targetDepartmentId },
    select: {
      id: true,
      deptName: true,
      organization: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!targetDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
  }

  const targetCycle = params.evalCycleId
    ? await prisma.evalCycle.findUnique({
        where: { id: params.evalCycleId },
        select: { id: true, orgId: true, evalYear: true },
      })
    : await resolveTargetCycle(targetDepartment.organization.id, params.evalYear)

  if (
    targetCycle &&
    (targetCycle.orgId !== targetDepartment.organization.id || targetCycle.evalYear !== params.evalYear)
  ) {
    throw new AppError(400, 'INVALID_EVAL_CYCLE', '선택한 평가주기 정보가 조직/연도와 맞지 않습니다.')
  }

  const current = params.id
    ? await prisma.businessPlanDocument.findUnique({
        where: { id: params.id },
        include: {
          department: {
            select: {
              deptName: true,
            },
          },
        },
      })
    : null

  const saved = current
    ? await prisma.businessPlanDocument.update({
        where: { id: current.id },
        data: {
          title: params.title,
          sourceType: params.sourceType,
          summaryText: params.summaryText?.trim() || null,
          bodyText: params.bodyText,
          evalCycleId: targetCycle?.id ?? null,
          updatedById: params.userId,
        },
        include: {
          department: {
            select: {
              deptName: true,
            },
          },
        },
      })
    : await prisma.businessPlanDocument.create({
        data: {
          deptId: params.targetDepartmentId,
          evalYear: params.evalYear,
          evalCycleId: targetCycle?.id ?? null,
          title: params.title,
          sourceType: params.sourceType,
          summaryText: params.summaryText?.trim() || null,
          bodyText: params.bodyText,
          createdById: params.userId,
          updatedById: params.userId,
        },
        include: {
          department: {
            select: {
              deptName: true,
            },
          },
        },
      })

  await createAuditLog({
    userId: params.userId,
    action: current ? 'BUSINESS_PLAN_UPDATED' : 'BUSINESS_PLAN_CREATED',
    entityType: 'BusinessPlanDocument',
    entityId: saved.id,
    oldValue: current
      ? {
          title: current.title,
          summaryText: current.summaryText,
          bodyText: current.bodyText,
          sourceType: current.sourceType,
        }
      : undefined,
    newValue: {
      deptId: saved.deptId,
      evalYear: saved.evalYear,
      evalCycleId: saved.evalCycleId,
      title: saved.title,
      sourceType: saved.sourceType,
      summaryText: saved.summaryText,
      bodyText: saved.bodyText,
    },
  })

  return mapBusinessPlan(saved)
}

type RecommendationGenerationContext = {
  targetDepartment: {
    id: string
    name: string
    organizationName: string
  }
  planningDepartment: {
    id: string
    name: string
    organizationName: string
  }
  evalYear: number
  evalCycleId?: string | null
  businessPlan: BusinessPlanDocument
  sourceOrgKpis: Array<{
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
  }>
  existingTeamKpis: Array<{
    id: string
    kpiName: string
    kpiCategory: string
    definition: string | null
    weight: number
  }>
}

async function loadRecommendationGenerationContext(params: LoadContextParams): Promise<RecommendationGenerationContext> {
  const scopeDepartmentIds = getOrgKpiScopeDepartmentIds(params)
  assertDepartmentScope(scopeDepartmentIds, params.targetDepartmentId)

  const { departmentsById } = await loadDepartmentGraph()
  const targetDepartment = departmentsById.get(params.targetDepartmentId)
  if (!targetDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '팀 정보를 찾을 수 없습니다.')
  }

  const planningDepartmentId = resolvePlanningDepartmentIdFromGraph(params.targetDepartmentId, departmentsById)
  const planningDepartment = departmentsById.get(planningDepartmentId)
  if (!planningDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '본부 기준 조직 정보를 찾을 수 없습니다.')
  }

  const cycle = await resolveTargetCycle(targetDepartment.organization.id, params.evalYear)
  const businessPlan = await prisma.businessPlanDocument.findFirst({
    where: {
      deptId: planningDepartmentId,
      evalYear: params.evalYear,
    },
    orderBy: [{ updatedAt: 'desc' }],
  })

  if (!businessPlan) {
    throw new AppError(
      400,
      'BUSINESS_PLAN_REQUIRED',
      `${planningDepartment.deptName} 사업계획서가 아직 등록되지 않아 AI 추천을 실행할 수 없습니다.`
    )
  }

  const [sourceOrgKpis, existingTeamKpis] = await Promise.all([
    prisma.orgKpi.findMany({
      where: {
        deptId: planningDepartmentId,
        evalYear: params.evalYear,
      },
      orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
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
      },
    }),
    prisma.orgKpi.findMany({
      where: {
        deptId: params.targetDepartmentId,
        evalYear: params.evalYear,
      },
      orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
      select: {
        id: true,
        kpiName: true,
        kpiCategory: true,
        definition: true,
        weight: true,
      },
    }),
  ])

  return {
    targetDepartment: {
      id: targetDepartment.id,
      name: targetDepartment.deptName,
      organizationName: targetDepartment.organization.orgName,
    },
    planningDepartment: {
      id: planningDepartment.id,
      name: planningDepartment.deptName,
      organizationName: planningDepartment.organization.orgName,
    },
    evalYear: params.evalYear,
    evalCycleId: cycle?.id ?? null,
    businessPlan,
    sourceOrgKpis,
    existingTeamKpis,
  }
}

function sanitizeRecommendationItem(
  item: Record<string, unknown>,
  sourceOrgKpis: RecommendationGenerationContext['sourceOrgKpis'],
  rank: number
) {
  const sourceOrgKpiId =
    typeof item.sourceOrgKpiId === 'string' &&
    sourceOrgKpis.some((candidate) => candidate.id === item.sourceOrgKpiId)
      ? item.sourceOrgKpiId
      : null

  const sourceOrgKpiTitle =
    typeof item.sourceOrgKpiTitle === 'string'
      ? item.sourceOrgKpiTitle
      : sourceOrgKpiId
        ? sourceOrgKpis.find((candidate) => candidate.id === sourceOrgKpiId)?.kpiName ?? null
        : null

  return {
    rank,
    title: String(item.title ?? '').trim(),
    definition: typeof item.definition === 'string' ? item.definition.trim() : null,
    formula: typeof item.formula === 'string' ? item.formula.trim() : null,
    targetValueT: typeof item.targetValueT === 'number' ? item.targetValueT : null,
    targetValueE: typeof item.targetValueE === 'number' ? item.targetValueE : null,
    targetValueS: typeof item.targetValueS === 'number' ? item.targetValueS : null,
    unit: typeof item.unit === 'string' ? item.unit.trim() : null,
    weightSuggestion: typeof item.weightSuggestion === 'number' ? item.weightSuggestion : null,
    difficultySuggestion:
      typeof item.difficultySuggestion === 'string' &&
      ['HIGH', 'MEDIUM', 'LOW'].includes(item.difficultySuggestion)
        ? (item.difficultySuggestion as Difficulty)
        : null,
    sourceOrgKpiId,
    sourceOrgKpiTitle,
    linkageExplanation: String(item.linkageExplanation ?? '').trim(),
    recommendationReason: String(item.recommendationReason ?? item.reason ?? '').trim(),
    riskComment: typeof item.riskComment === 'string' ? item.riskComment.trim() : null,
  }
}

type GenerateRecommendationParams = LoadContextParams

export async function generateTeamKpiRecommendationSet(params: GenerateRecommendationParams) {
  if (!canOperateTeamKpiAi(params.role)) {
    throw new AppError(403, 'FORBIDDEN', 'AI KPI 추천을 실행할 권한이 없습니다.')
  }

  const context = await loadRecommendationGenerationContext(params)

  const aiPayload = {
    teamDepartment: {
      id: context.targetDepartment.id,
      name: context.targetDepartment.name,
      organizationName: context.targetDepartment.organizationName,
    },
    planningDepartment: {
      id: context.planningDepartment.id,
      name: context.planningDepartment.name,
      organizationName: context.planningDepartment.organizationName,
    },
    evalYear: context.evalYear,
    businessPlan: {
      title: context.businessPlan.title,
      summaryText: context.businessPlan.summaryText,
      bodyText: context.businessPlan.bodyText,
    },
    sourceOrgKpis: context.sourceOrgKpis.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      category: kpi.kpiCategory,
      definition: kpi.definition,
      formula: kpi.formula,
      targetValueText: formatOrgKpiTargetValues({
        ...resolveOrgKpiTargetValues({
          targetValue: kpi.targetValue ?? undefined,
          targetValueT: kpi.targetValueT ?? undefined,
          targetValueE: kpi.targetValueE ?? undefined,
          targetValueS: kpi.targetValueS ?? undefined,
        }),
        unit: kpi.unit ?? undefined,
      }),
      weight: kpi.weight,
      difficulty: kpi.difficulty,
    })),
    existingTeamKpis: context.existingTeamKpis.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      category: kpi.kpiCategory,
      definition: kpi.definition,
      weight: kpi.weight,
    })),
    recommendationRules: [
      '본부 KPI와의 연결성',
      '팀 역할 적합성',
      '측정 가능성',
      '통제 가능성',
      '도전성',
      '외생 변수 리스크',
      '활동 KPI보다 결과 KPI 우선',
    ],
  }

  const aiPreview = await recommendTeamKpiRecommendations({
    requesterId: params.userId,
    sourceId: context.businessPlan.id,
    payload: aiPayload,
  })

  const resultRecord =
    aiPreview.result && typeof aiPreview.result === 'object'
      ? (aiPreview.result as Record<string, unknown>)
      : {}
  const recommendationItemsRaw = Array.isArray(resultRecord.recommendations)
    ? resultRecord.recommendations
    : []
  const recommendationItems = recommendationItemsRaw
    .slice(0, 5)
    .map((item, index) =>
      sanitizeRecommendationItem(
        item && typeof item === 'object' ? (item as Record<string, unknown>) : {},
        context.sourceOrgKpis,
        index + 1
      )
    )
    .filter((item) => item.title && item.linkageExplanation && item.recommendationReason)

  if (recommendationItems.length < 3) {
    throw new AppError(502, 'AI_RECOMMENDATION_INVALID', 'AI 추천 결과가 충분하지 않아 다시 시도해 주세요.')
  }

  const created = await prisma.teamKpiRecommendationSet.create({
    data: {
      businessPlanId: context.businessPlan.id,
      sourceDepartmentId: context.planningDepartment.id,
      targetDepartmentId: context.targetDepartment.id,
      evalYear: context.evalYear,
      evalCycleId: context.evalCycleId ?? null,
      requesterId: params.userId,
      aiRequestLogId: aiPreview.requestLogId,
      summaryText: typeof resultRecord.summary === 'string' ? resultRecord.summary : null,
      items: {
        create: recommendationItems,
      },
    },
    include: {
      sourceDepartment: {
        select: {
          deptName: true,
        },
      },
      items: true,
    },
  })

  await createAuditLog({
    userId: params.userId,
    action: 'TEAM_KPI_AI_RECOMMENDATION_CREATED',
    entityType: 'TeamKpiRecommendationSet',
    entityId: created.id,
    newValue: {
      targetDepartmentId: created.targetDepartmentId,
      sourceDepartmentId: created.sourceDepartmentId,
      evalYear: created.evalYear,
      itemCount: created.items.length,
      aiRequestLogId: created.aiRequestLogId,
    },
  })

  return mapRecommendationSet(created)
}

function buildDraftFromRecommendationItem(
  item: Prisma.TeamKpiRecommendationItemGetPayload<{
    include: {
      set: true
    }
  }>
): OrgKpiDraftInput {
  return {
    kpiType: 'QUANTITATIVE',
    kpiCategory: 'AI 추천 KPI',
    kpiName: item.title,
    definition: item.definition ?? undefined,
    formula: item.formula ?? undefined,
    targetValueT: item.targetValueT ?? 0,
    targetValueE: item.targetValueE ?? 0,
    targetValueS: item.targetValueS ?? 0,
    unit: item.unit ?? undefined,
    weight: item.weightSuggestion ?? 20,
    difficulty: item.difficultySuggestion ?? 'MEDIUM',
    tags: ['AI추천'],
    parentOrgKpiId: item.sourceOrgKpiId ?? null,
  }
}

type ApplyRecommendationParams = SessionScopeParams & {
  userId: string
  recommendationItemId: string
  decision: TeamKpiRecommendationDecision
  draft?: OrgKpiDraftInput
}

function extractPrismaCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '')
  }

  return ''
}

export async function applyTeamKpiRecommendationDecision(params: ApplyRecommendationParams) {
  if (!canOperateTeamKpiAi(params.role)) {
    throw new AppError(403, 'FORBIDDEN', '추천 KPI를 처리할 권한이 없습니다.')
  }

  const item = await prisma.teamKpiRecommendationItem.findUnique({
    where: { id: params.recommendationItemId },
    include: {
      set: true,
    },
  })

  if (!item) {
    throw new AppError(404, 'TEAM_KPI_RECOMMENDATION_NOT_FOUND', '추천 KPI를 찾을 수 없습니다.')
  }

  const scopeDepartmentIds = getOrgKpiScopeDepartmentIds(params)
  assertDepartmentScope(scopeDepartmentIds, item.set.targetDepartmentId)

  if (item.decision !== 'PENDING') {
    throw new AppError(409, 'TEAM_KPI_RECOMMENDATION_ALREADY_DECIDED', '이미 처리된 추천 KPI입니다.')
  }

  if (params.decision === 'DISMISSED') {
    const dismissed = await prisma.teamKpiRecommendationItem.update({
      where: { id: item.id },
      data: {
        decision: 'DISMISSED',
        decidedById: params.userId,
        decidedAt: new Date(),
      },
    })

    await createAuditLog({
      userId: params.userId,
      action: 'TEAM_KPI_RECOMMENDATION_DISMISSED',
      entityType: 'TeamKpiRecommendationItem',
      entityId: dismissed.id,
      newValue: { decision: dismissed.decision },
    })

    return {
      recommendationItemId: dismissed.id,
      decision: dismissed.decision,
      createdKpi: null,
    }
  }

  const draft = params.decision === 'ADOPT_AS_IS' ? buildDraftFromRecommendationItem(item) : params.draft
  if (!draft) {
    throw new AppError(400, 'TEAM_KPI_DRAFT_REQUIRED', '채택할 KPI 초안이 비어 있습니다.')
  }

  const targetDepartment = await prisma.department.findUnique({
    where: { id: item.set.targetDepartmentId },
    select: {
      orgId: true,
    },
  })

  if (!targetDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
  }

  const targetCycle = await resolveTargetCycle(targetDepartment.orgId, item.set.evalYear)
  if (targetCycle?.goalEditMode === GoalEditMode.CHECKIN_ONLY) {
    throw new AppError(400, 'GOAL_EDIT_LOCKED', '현재 주기는 체크인 전용 모드라 팀 KPI를 채택할 수 없습니다.')
  }

  const related = await prisma.orgKpi.findMany({
    where: {
      deptId: item.set.targetDepartmentId,
      evalYear: item.set.evalYear,
    },
    select: {
      weight: true,
    },
  })

  const totalWeight = related.reduce((sum, current) => sum + current.weight, 0) + draft.weight
  if (totalWeight > 100) {
    throw new AppError(
      400,
      'WEIGHT_EXCEEDED',
      `팀 KPI 가중치 합계가 100을 초과합니다. (변경 후 ${Math.round(totalWeight * 10) / 10})`
    )
  }

  const parentOrgKpiId = await validateOrgParentLink({
    parentOrgKpiId: draft.parentOrgKpiId ?? item.sourceOrgKpiId ?? null,
    targetDeptId: item.set.targetDepartmentId,
    targetEvalYear: item.set.evalYear,
    editableDepartmentIds: scopeDepartmentIds,
  })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.orgKpi.create({
        data: {
          deptId: item.set.targetDepartmentId,
          evalYear: item.set.evalYear,
          kpiType: draft.kpiType,
          kpiCategory: draft.kpiCategory,
          kpiName: draft.kpiName,
          definition: draft.definition ?? null,
          formula: draft.formula ?? null,
          ...buildOrgKpiTargetValuePersistence({
            targetValueT: draft.targetValueT,
            targetValueE: draft.targetValueE,
            targetValueS: draft.targetValueS,
          }),
          unit: draft.unit ?? null,
          weight: draft.weight,
          difficulty: draft.difficulty,
          tags: draft.tags ?? [],
          parentOrgKpiId,
          status: 'DRAFT',
        },
        select: {
          id: true,
          deptId: true,
          evalYear: true,
          kpiName: true,
          kpiCategory: true,
          targetValue: true,
          targetValueT: true,
          targetValueE: true,
          targetValueS: true,
          weight: true,
          difficulty: true,
          parentOrgKpiId: true,
        },
      })

      const updatedItem = await tx.teamKpiRecommendationItem.update({
        where: { id: item.id },
        data: {
          decision: params.decision,
          adoptedOrgKpiId: created.id,
          customizedDraft:
            params.decision === 'ADOPT_AS_IS'
              ? Prisma.JsonNull
              : ({
                  ...draft,
                  parentOrgKpiId,
                } as Prisma.InputJsonValue),
          decidedById: params.userId,
          decidedAt: new Date(),
        },
      })

      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: 'ORG_KPI_CREATED',
          entityType: 'OrgKpi',
          entityId: created.id,
          newValue: {
            source: 'team-kpi-ai',
            recommendationItemId: item.id,
            deptId: created.deptId,
            evalYear: created.evalYear,
            kpiName: created.kpiName,
            kpiCategory: created.kpiCategory,
            weight: created.weight,
            targetValue: created.targetValue,
            targetValueT: created.targetValueT,
            targetValueE: created.targetValueE,
            targetValueS: created.targetValueS,
            difficulty: created.difficulty,
            parentOrgKpiId: created.parentOrgKpiId,
          },
        },
      })

      return {
        created,
        updatedItem,
      }
    })

    await createAuditLog({
      userId: params.userId,
      action: 'TEAM_KPI_RECOMMENDATION_APPLIED',
      entityType: 'TeamKpiRecommendationItem',
      entityId: item.id,
      newValue: {
        decision: params.decision,
        adoptedOrgKpiId: result.created.id,
      },
    })

    return {
      recommendationItemId: result.updatedItem.id,
      decision: result.updatedItem.decision,
      createdKpi: {
        id: result.created.id,
        deptId: result.created.deptId,
        evalYear: result.created.evalYear,
      },
    }
  } catch (error) {
    if (extractPrismaCode(error) === 'P2002') {
      throw new AppError(409, 'ORG_KPI_DUPLICATED', '같은 팀에 같은 이름의 KPI가 이미 존재합니다.')
    }
    throw error
  }
}

type ReviewGenerationContext = {
  targetDepartment: RecommendationGenerationContext['targetDepartment']
  planningDepartment: RecommendationGenerationContext['planningDepartment']
  evalYear: number
  evalCycleId?: string | null
  businessPlan: BusinessPlanDocument
  sourceOrgKpis: RecommendationGenerationContext['sourceOrgKpis']
  teamOrgKpis: Array<{
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
    parentOrgKpiId: string | null
  }>
}

type ReviewGenerationParams = LoadContextParams & {
  orgKpiIds?: string[]
}

async function loadReviewGenerationContext(params: ReviewGenerationParams): Promise<ReviewGenerationContext> {
  const base = await loadRecommendationGenerationContext(params)

  const teamOrgKpis = await prisma.orgKpi.findMany({
    where: {
      deptId: params.targetDepartmentId,
      evalYear: params.evalYear,
      ...(params.orgKpiIds?.length ? { id: { in: params.orgKpiIds } } : {}),
    },
    orderBy: [{ weight: 'desc' }, { kpiName: 'asc' }],
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
      parentOrgKpiId: true,
    },
  })

  if (!teamOrgKpis.length) {
    throw new AppError(400, 'TEAM_KPI_REVIEW_TARGET_REQUIRED', 'AI 검토를 실행할 팀 KPI가 없습니다.')
  }

  return {
    targetDepartment: base.targetDepartment,
    planningDepartment: base.planningDepartment,
    evalYear: base.evalYear,
    evalCycleId: base.evalCycleId,
    businessPlan: base.businessPlan,
    sourceOrgKpis: base.sourceOrgKpis,
    teamOrgKpis,
  }
}

function sanitizeReviewItem(
  item: Record<string, unknown>,
  candidate: ReviewGenerationContext['teamOrgKpis'][number]
) {
  const verdict =
    typeof item.verdict === 'string' && ['ADEQUATE', 'CAUTION', 'INSUFFICIENT'].includes(item.verdict)
      ? (item.verdict as TeamKpiReviewVerdict)
      : 'CAUTION'

  return {
    orgKpiId: candidate.id,
    kpiTitleSnapshot: candidate.kpiName,
    verdict,
    rationale: String(item.rationale ?? '상위 전략과의 연결 방향은 보이지만 세부 측정 기준을 조금 더 명확히 할 필요가 있습니다.').trim(),
    linkageComment:
      typeof item.linkageComment === 'string' ? item.linkageComment.trim() : '상위 KPI 및 사업계획서와의 연결 설명을 한 줄로 분명히 적어 주세요.',
    measurabilityComment:
      typeof item.measurabilityComment === 'string'
        ? item.measurabilityComment.trim()
        : '측정 기준과 데이터 출처를 명확히 적어야 월간 추적이 쉬워집니다.',
    controllabilityComment:
      typeof item.controllabilityComment === 'string'
        ? item.controllabilityComment.trim()
        : '팀이 직접 통제 가능한 결과인지 다시 검토해 보세요.',
    challengeComment:
      typeof item.challengeComment === 'string'
        ? item.challengeComment.trim()
        : '기준선과 목표 상승폭을 함께 적으면 도전성을 판단하기 쉽습니다.',
    externalRiskComment:
      typeof item.externalRiskComment === 'string'
        ? item.externalRiskComment.trim()
        : '외생 변수 영향이 큰 경우 보조 지표나 예외 조건을 함께 두는 편이 안전합니다.',
    clarityComment:
      typeof item.clarityComment === 'string'
        ? item.clarityComment.trim()
        : '대상, 결과, 시점을 포함한 문장으로 다듬으면 더 명확해집니다.',
    recommendationText:
      typeof item.recommendationText === 'string'
        ? item.recommendationText.trim()
        : '상위 KPI 연결 문장과 측정 기준을 보완한 뒤 최종 확정하세요.',
  }
}

export async function generateTeamKpiReviewRun(params: ReviewGenerationParams) {
  if (!canOperateTeamKpiAi(params.role)) {
    throw new AppError(403, 'FORBIDDEN', 'AI 검토를 실행할 권한이 없습니다.')
  }

  const context = await loadReviewGenerationContext(params)

  const aiPayload = {
    teamDepartment: {
      id: context.targetDepartment.id,
      name: context.targetDepartment.name,
      organizationName: context.targetDepartment.organizationName,
    },
    planningDepartment: {
      id: context.planningDepartment.id,
      name: context.planningDepartment.name,
      organizationName: context.planningDepartment.organizationName,
    },
    evalYear: context.evalYear,
    businessPlan: {
      title: context.businessPlan.title,
      summaryText: context.businessPlan.summaryText,
      bodyText: context.businessPlan.bodyText,
    },
    sourceOrgKpis: context.sourceOrgKpis.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      category: kpi.kpiCategory,
      definition: kpi.definition,
      formula: kpi.formula,
      targetValueText: formatOrgKpiTargetValues({
        ...resolveOrgKpiTargetValues({
          targetValue: kpi.targetValue ?? undefined,
          targetValueT: kpi.targetValueT ?? undefined,
          targetValueE: kpi.targetValueE ?? undefined,
          targetValueS: kpi.targetValueS ?? undefined,
        }),
        unit: kpi.unit ?? undefined,
      }),
      weight: kpi.weight,
      difficulty: kpi.difficulty,
    })),
    teamKpis: context.teamOrgKpis.map((kpi) => ({
      id: kpi.id,
      title: kpi.kpiName,
      category: kpi.kpiCategory,
      definition: kpi.definition,
      formula: kpi.formula,
      targetValueText: formatOrgKpiTargetValues({
        ...resolveOrgKpiTargetValues({
          targetValue: kpi.targetValue ?? undefined,
          targetValueT: kpi.targetValueT ?? undefined,
          targetValueE: kpi.targetValueE ?? undefined,
          targetValueS: kpi.targetValueS ?? undefined,
        }),
        unit: kpi.unit ?? undefined,
      }),
      weight: kpi.weight,
      difficulty: kpi.difficulty,
      linkedSourceOrgKpiId: kpi.parentOrgKpiId,
    })),
    reviewCriteria: [
      '본부 KPI와의 연결성',
      '사업계획서와의 연결성',
      '측정 가능성',
      '통제 가능성',
      '도전성',
      '외생 변수 리스크',
      '문장 명확성',
    ],
  }

  const aiPreview = await reviewTeamKpiRecommendations({
    requesterId: params.userId,
    sourceId: context.businessPlan.id,
    payload: aiPayload,
  })

  const resultRecord =
    aiPreview.result && typeof aiPreview.result === 'object'
      ? (aiPreview.result as Record<string, unknown>)
      : {}
  const reviewItemsRaw = Array.isArray(resultRecord.items) ? resultRecord.items : []
  const reviewItemsById = new Map<string, Record<string, unknown>>()

  reviewItemsRaw.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const record = item as Record<string, unknown>
    const key =
      typeof record.orgKpiId === 'string'
        ? record.orgKpiId
        : typeof record.kpiTitle === 'string'
          ? context.teamOrgKpis.find((candidate) => candidate.kpiName === record.kpiTitle)?.id
          : null

    if (key) {
      reviewItemsById.set(key, record)
    }
  })

  const reviewItems = context.teamOrgKpis.map((candidate) =>
    sanitizeReviewItem(reviewItemsById.get(candidate.id) ?? {}, candidate)
  )

  const overallVerdict =
    typeof resultRecord.overallVerdict === 'string' &&
    ['ADEQUATE', 'CAUTION', 'INSUFFICIENT'].includes(resultRecord.overallVerdict)
      ? (resultRecord.overallVerdict as TeamKpiReviewVerdict)
      : null

  const created = await prisma.teamKpiReviewRun.create({
    data: {
      businessPlanId: context.businessPlan.id,
      sourceDepartmentId: context.planningDepartment.id,
      targetDepartmentId: context.targetDepartment.id,
      evalYear: context.evalYear,
      evalCycleId: context.evalCycleId ?? null,
      requesterId: params.userId,
      aiRequestLogId: aiPreview.requestLogId,
      overallVerdict,
      overallSummary: typeof resultRecord.overallSummary === 'string' ? resultRecord.overallSummary : null,
      items: {
        create: reviewItems,
      },
    },
    include: {
      sourceDepartment: {
        select: {
          deptName: true,
        },
      },
      items: true,
    },
  })

  await createAuditLog({
    userId: params.userId,
    action: 'TEAM_KPI_AI_REVIEW_CREATED',
    entityType: 'TeamKpiReviewRun',
    entityId: created.id,
    newValue: {
      targetDepartmentId: created.targetDepartmentId,
      sourceDepartmentId: created.sourceDepartmentId,
      evalYear: created.evalYear,
      overallVerdict: created.overallVerdict,
      itemCount: created.items.length,
      aiRequestLogId: created.aiRequestLogId,
    },
  })

  return mapReviewRun(created)
}
