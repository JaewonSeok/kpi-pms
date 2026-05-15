import type {
  AiCompetencyGateStatus,
  AiCompetencyGateTrack,
  EvaluationPolicyItemCategory,
  Position,
  SystemRole,
} from '@prisma/client'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { AppError, calcPdcaScore } from '@/lib/utils'
import type { AiCapabilityRecognitionRouteCode } from '@/lib/evaluation-policy-2026'
import {
  resolvePolicy2026PreviewSalesGroup,
  resolvePolicy2026TeamMemberSalesThresholdDecision,
} from '@/lib/evaluation-policy-2026-preview-metadata'
import {
  buildEvaluationPreviewInput2026,
  calculateEvaluationPreview2026,
  type EvaluationPreviewInput2026,
  type EvaluationPreviewRawItem2026,
  type EvaluationPreviewResult2026,
} from '@/server/evaluation-preview-2026'
import type { EvaluationGrade2026RoleGroup, EvaluationGrade2026SalesGroup } from '@/server/evaluation-grade-2026'
import type { AiPolicy2026GateStatus, AiPolicy2026RecognitionEvidence } from '@/server/evaluation-ai-policy-2026'

type EvaluationPreviewDb = Pick<typeof prisma, 'evaluation' | 'aiCompetencyGateAssignment'>

export type EvaluationPreview2026Payload = {
  evaluation: {
    id: string
    evalCycleId: string
    evalYear: number
    targetId: string
    targetName: string
    targetDepartment: string
    evalStage: string
  }
  preview: EvaluationPreviewResult2026
}

type EvaluationPreviewSessionUser = NonNullable<Session['user']> & {
  id: string
  role: SystemRole | string
}

type LoadedEvaluation = NonNullable<Awaited<ReturnType<typeof loadEvaluationForPreview2026>>>
type LoadedAiGateAssignment = Awaited<ReturnType<typeof loadAiGateAssignmentForPreview2026>>

function getSessionUser(session: Session): EvaluationPreviewSessionUser | null {
  const user = session.user as Partial<EvaluationPreviewSessionUser> | undefined
  if (!user?.id || !user.role) return null
  return user as EvaluationPreviewSessionUser
}

export function canAccessEvaluationPreview2026(session: Session) {
  const user = getSessionUser(session)
  return user?.role === 'ROLE_ADMIN'
}

async function loadEvaluationForPreview2026(db: EvaluationPreviewDb, evaluationId: string) {
  return db.evaluation.findUnique({
    where: { id: evaluationId },
    include: {
      evalCycle: true,
      target: {
        include: {
          department: true,
        },
      },
      evaluator: {
        include: {
          department: true,
        },
      },
      items: {
        include: {
          personalKpi: {
            include: {
              linkedOrgKpi: {
                include: {
                  department: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })
}

async function loadAiGateAssignmentForPreview2026(
  db: EvaluationPreviewDb,
  params: {
    evalCycleId: string
    employeeId: string
  }
) {
  return db.aiCompetencyGateAssignment.findFirst({
    where: {
      employeeId: params.employeeId,
      cycle: {
        evalCycleId: params.evalCycleId,
      },
    },
    include: {
      submissionCase: {
        include: {
          metrics: true,
          projectDetail: true,
          adoptionDetail: true,
          evidenceItems: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function firstFiniteNumber(...values: Array<number | null | undefined>) {
  return values.find(isFiniteNumber)
}

function normalizePolicyCategory(
  value: EvaluationPolicyItemCategory | null | undefined
): EvaluationPreviewRawItem2026['policyCategory'] {
  return value ?? null
}

function resolveItemScore(item: LoadedEvaluation['items'][number]) {
  if (isFiniteNumber(item.basePolicyScore)) return item.basePolicyScore
  if (item.personalKpi.kpiType === 'QUANTITATIVE') return item.quantScore ?? null
  if (isFiniteNumber(item.qualScore)) return item.qualScore

  const hasPdca =
    isFiniteNumber(item.planScore) ||
    isFiniteNumber(item.doScore) ||
    isFiniteNumber(item.checkScore) ||
    isFiniteNumber(item.actScore)

  return hasPdca
    ? calcPdcaScore(item.planScore ?? 0, item.doScore ?? 0, item.checkScore ?? 0, item.actScore ?? 0)
    : null
}

function buildRawItemsForPreview2026(evaluation: LoadedEvaluation): EvaluationPreviewRawItem2026[] {
  return evaluation.items.map((item) => ({
    id: item.id,
    title: item.personalKpi.kpiName,
    policyCategory: normalizePolicyCategory(item.policyCategory ?? item.personalKpi.policyCategory),
    targetAchievementLevel: item.targetAchievementLevel,
    score: firstFiniteNumber(resolveItemScore(item), item.quantScore, item.qualScore),
    basePolicyScore: item.basePolicyScore,
    adjustmentScore: item.adjustmentScore,
    adjustmentGroupKey: item.adjustmentGroupKey,
    weight: item.personalKpi.weight,
  }))
}

function resolveRoleGroup2026(params: {
  position?: Position | string | null
  role?: SystemRole | string | null
}): EvaluationGrade2026RoleGroup | null {
  if (params.position === 'DIV_HEAD' || params.role === 'ROLE_DIV_HEAD') return 'DIVISION_HEAD'
  if (
    params.position === 'TEAM_LEADER' ||
    params.position === 'SECTION_CHIEF' ||
    params.role === 'ROLE_TEAM_LEADER' ||
    params.role === 'ROLE_SECTION_CHIEF'
  ) {
    return 'TEAM_SECTION_LEADER'
  }
  if (params.position === 'MEMBER' || params.role === 'ROLE_MEMBER') return 'TEAM_MEMBER'
  return null
}

function isRecognitionRoute(value: unknown): value is AiCapabilityRecognitionRouteCode {
  return (
    value === 'AI_PROJECT_TK' ||
    value === 'ORG_CONTRIBUTION_USE_CASE' ||
    value === 'AI_PRACTICAL_CERTIFICATION'
  )
}

function routeFromTrack(track: AiCompetencyGateTrack | null | undefined): AiCapabilityRecognitionRouteCode | undefined {
  if (track === 'AI_PROJECT_EXECUTION') return 'AI_PROJECT_TK'
  if (track === 'AI_USE_CASE_EXPANSION') return 'ORG_CONTRIBUTION_USE_CASE'
  return undefined
}

function getProjectCategoryFromEvaluationItems(
  items: EvaluationPreviewRawItem2026[]
): 'PROJECT_T' | 'PROJECT_K' | null {
  const item = items.find((candidate) => candidate.policyCategory === 'PROJECT_T' || candidate.policyCategory === 'PROJECT_K')
  return item?.policyCategory === 'PROJECT_T' || item?.policyCategory === 'PROJECT_K'
    ? item.policyCategory
    : null
}

function projectAchievementAtLeastTarget(items: EvaluationPreviewRawItem2026[]) {
  const projectItems = items.filter(
    (item) => item.policyCategory === 'PROJECT_T' || item.policyCategory === 'PROJECT_K'
  )
  if (!projectItems.length) return null

  return projectItems.some((item) => {
    if (item.targetAchievementLevel === 'TARGET' || item.targetAchievementLevel === 'EXCELLENT') {
      return true
    }

    const score = firstFiniteNumber(item.basePolicyScore, item.score)
    if (!isFiniteNumber(score)) return false
    return item.policyCategory === 'PROJECT_K' ? score >= 80 : score >= 90
  })
}

function buildAiEvidenceForPreview2026(
  assignment: LoadedAiGateAssignment,
  rawItems: EvaluationPreviewRawItem2026[]
): AiPolicy2026RecognitionEvidence | null {
  const submissionCase = assignment?.submissionCase
  if (!submissionCase) return null

  const route = isRecognitionRoute(submissionCase.policyRecognitionRoute)
    ? submissionCase.policyRecognitionRoute
    : routeFromTrack(submissionCase.track)
  const evidenceTypes = new Set(submissionCase.evidenceItems.map((item) => item.evidenceType))
  const hasMetricEvidence = submissionCase.metrics.length > 0
  const hasBeforeAfterMetric = submissionCase.metrics.some(
    (metric) => hasText(metric.beforeValue) && hasText(metric.afterValue)
  )
  const linkedProjectCategory = getProjectCategoryFromEvaluationItems(rawItems)
  const achievementAtLeastTarget = projectAchievementAtLeastTarget(rawItems)

  return {
    route: route ?? null,
    gateTrack: submissionCase.track ?? null,
    projectTk: {
      linkedProjectCategory,
      aiContributionDocumented:
        hasText(submissionCase.impactSummary) ||
        hasText(submissionCase.goalStatement) ||
        hasText(submissionCase.toolList),
      achievementAtLeastTarget,
      contributionRoleDocumented:
        hasText(submissionCase.ownerRoleDescription) ||
        hasText(submissionCase.projectDetail?.ownerPmRoleDetail) ||
        hasText(submissionCase.projectDetail?.contributionSummary),
    },
    orgContribution: {
      improvement: {
        time: hasMetricEvidence || hasText(submissionCase.adoptionDetail?.measuredEffectDetail),
        cost: hasText(submissionCase.adoptionDetail?.measuredEffectDetail),
        productivity: hasMetricEvidence || hasText(submissionCase.impactSummary),
      },
      beforeAfterComparison:
        hasBeforeAfterMetric || (hasText(submissionCase.beforeWorkflow) && hasText(submissionCase.afterWorkflow)),
      realWorkApplication:
        hasText(submissionCase.afterWorkflow) || hasText(submissionCase.adoptionDetail?.useCaseDescription),
      teamOrgContribution:
        hasText(submissionCase.teamOrganizationAdoption) ||
        hasText(submissionCase.adoptionDetail?.teamDivisionScope) ||
        hasText(submissionCase.adoptionDetail?.organizationExpansionDetail),
      sharingTrainingReportEvidence:
        hasText(submissionCase.sharingExpansionActivity) ||
        hasText(submissionCase.adoptionDetail?.seminarSharingEvidence) ||
        evidenceTypes.has('SHARING_PROOF') ||
        evidenceTypes.has('ADOPTION_PROOF'),
      surveyAverage: null,
    },
    certification: {
      certificationProofProvided:
        route === 'AI_PRACTICAL_CERTIFICATION' && (submissionCase.evidenceItems.length > 0 || hasText(submissionCase.title)),
      practicalTaskProofProvided: evidenceTypes.has('OTHER'),
      validated: assignment.status === 'PASSED' ? true : null,
    },
  }
}

function mapAiStatus(status: AiCompetencyGateStatus | null | undefined): AiPolicy2026GateStatus {
  return status ?? 'NOT_ASSIGNED'
}

export async function buildEvaluationPreviewInputFromDb2026(params: {
  evaluationId: string
  db?: EvaluationPreviewDb
}): Promise<{
  evaluation: LoadedEvaluation
  input: EvaluationPreviewInput2026
}> {
  const db = params.db ?? prisma
  const evaluation = await loadEvaluationForPreview2026(db, params.evaluationId)

  if (!evaluation) {
    throw new AppError(404, 'EVALUATION_NOT_FOUND', '평가를 찾을 수 없습니다.')
  }

  const rawItems = buildRawItemsForPreview2026(evaluation)
  const aiAssignment = await loadAiGateAssignmentForPreview2026(db, {
    evalCycleId: evaluation.evalCycleId,
    employeeId: evaluation.targetId,
  })

  return {
    evaluation,
    input: buildEvaluationPreviewInput2026({
      evalYear: evaluation.evalCycle.evalYear,
      items: rawItems,
      roleGroup: resolveRoleGroup2026({
        position: evaluation.target.position,
        role: evaluation.target.role,
      }),
      salesGroup: resolvePolicy2026PreviewSalesGroup({
        evalCycleConfig: evaluation.evalCycle.performanceDesignConfig,
        employeeId: evaluation.targetId,
        employee: evaluation.target,
      }) as EvaluationGrade2026SalesGroup | null,
      teamMemberSalesThresholdDecision: resolvePolicy2026TeamMemberSalesThresholdDecision(
        evaluation.evalCycle.performanceDesignConfig
      ),
      employee: {
        position: evaluation.target.position,
        role: evaluation.target.role,
      },
      ai: {
        score: null,
        gateStatus: mapAiStatus(aiAssignment?.status),
        evidence: buildAiEvidenceForPreview2026(aiAssignment, rawItems),
      },
    }),
  }
}

export async function getEvaluationPreview2026ForSession(
  params: {
    session: Session
    evaluationId: string
  },
  options: {
    db?: EvaluationPreviewDb
  } = {}
): Promise<EvaluationPreview2026Payload> {
  if (!getSessionUser(params.session)) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  if (!canAccessEvaluationPreview2026(params.session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 평가 미리보기는 HR 관리자만 확인할 수 있습니다.')
  }

  const { evaluation, input } = await buildEvaluationPreviewInputFromDb2026({
    evaluationId: params.evaluationId,
    db: options.db,
  })
  const preview = calculateEvaluationPreview2026(input)

  return {
    evaluation: {
      id: evaluation.id,
      evalCycleId: evaluation.evalCycleId,
      evalYear: evaluation.evalCycle.evalYear,
      targetId: evaluation.targetId,
      targetName: evaluation.target.empName,
      targetDepartment: evaluation.target.department.deptName,
      evalStage: evaluation.evalStage,
    },
    preview,
  }
}
