import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { EVALUATION_POLICY_2026 } from '@/lib/evaluation-policy-2026'
import { AppError } from '@/lib/utils'
import { calculateEvaluationPreview2026, type EvaluationPreview2026Issue } from '@/server/evaluation-preview-2026'
import {
  buildEvaluationPreviewInputFromDb2026,
  canAccessEvaluationPreview2026,
} from '@/server/evaluation-preview-2026-loader'

type EvaluationPreviewReadinessDb = Pick<typeof prisma, 'evaluation' | 'aiCompetencyGateAssignment'>

export type EvaluationPreviewReadinessSample = {
  evaluationId: string
  evalCycleId: string
  evalYear: number
  targetId: string
  targetName: string
  targetDepartment: string
  issueCode: string
  issueLabel: string
  severity: EvaluationPreview2026Issue['severity']
  source: EvaluationPreview2026Issue['source']
  message: string
  itemId?: string
  itemTitle?: string
}

export type EvaluationPreviewReadinessSummary2026 = {
  policyVersion: string
  generatedAt: string
  filters: {
    year?: number
    cycleId?: string
    limit: number
  }
  totalEvaluationsChecked: number
  canCalculateCount: number
  blockedCount: number
  missingPolicyCategoryCount: number
  manualReviewCount: number
  missingSalesClassificationCount: number
  ambiguousThresholdCount: number
  aiInsufficientDataCount: number
  samples: EvaluationPreviewReadinessSample[]
  activationBlockers: string[]
}

const SAMPLE_LIMIT = 30

function issueLabel(code: string) {
  const labels: Record<string, string> = {
    POLICY_CATEGORY_REQUIRED: '정책 카테고리 미분류',
    CATEGORY_REQUIRED: '정책 카테고리 미분류',
    POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED: 'UNKNOWN/manual-review',
    UNKNOWN_CATEGORY: 'UNKNOWN/manual-review',
    SALES_GROUP_REQUIRED: '영업/비영업 구분 필요',
    GRADE_THRESHOLD_GROUP_REQUIRED: '등급 기준 그룹 부족',
    GRADE_THRESHOLD_GROUP_NOT_FOUND: '등급 기준 그룹 부족',
    POLICY_CONFIRMATION_REQUIRED: '등급 기준 HR 확인 필요',
    AMBIGUOUS_THRESHOLD_MATCH: '등급 기준 HR 확인 필요',
    NO_RECOGNITION_ROUTE_PASSED: 'AI 증빙 부족',
    AI_TARGET_ROLE_REQUIRED: 'AI 대상 직책 정보 부족',
    AI_RECOGNITION_ROUTE_UNKNOWN: 'AI 인정 경로 확인 필요',
  }

  return labels[code] ?? code
}

function isMissingPolicyCategory(issue: EvaluationPreview2026Issue) {
  return issue.source === 'readiness' && issue.code === 'POLICY_CATEGORY_REQUIRED'
}

function isManualReview(issue: EvaluationPreview2026Issue) {
  return issue.source === 'readiness' && issue.code === 'POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED'
}

function isMissingSalesClassification(issue: EvaluationPreview2026Issue) {
  return issue.code === 'SALES_GROUP_REQUIRED'
}

function isAmbiguousThreshold(issue: EvaluationPreview2026Issue) {
  return issue.code === 'POLICY_CONFIRMATION_REQUIRED' || issue.code === 'AMBIGUOUS_THRESHOLD_MATCH'
}

function isAiInsufficientData(issue: EvaluationPreview2026Issue) {
  return (
    issue.code === 'NO_RECOGNITION_ROUTE_PASSED' ||
    issue.code === 'AI_TARGET_ROLE_REQUIRED' ||
    issue.code === 'AI_RECOGNITION_ROUTE_UNKNOWN'
  )
}

function addSample(params: {
  samples: EvaluationPreviewReadinessSample[]
  evaluation: Awaited<ReturnType<typeof buildEvaluationPreviewInputFromDb2026>>['evaluation']
  issue: EvaluationPreview2026Issue
}) {
  if (params.samples.length >= SAMPLE_LIMIT) return
  params.samples.push({
    evaluationId: params.evaluation.id,
    evalCycleId: params.evaluation.evalCycleId,
    evalYear: params.evaluation.evalCycle.evalYear,
    targetId: params.evaluation.targetId,
    targetName: params.evaluation.target.empName,
    targetDepartment: params.evaluation.target.department.deptName,
    issueCode: params.issue.code,
    issueLabel: issueLabel(params.issue.code),
    severity: params.issue.severity,
    source: params.issue.source,
    message: params.issue.message,
    itemId: params.issue.itemId,
    itemTitle: params.issue.itemTitle,
  })
}

function buildActivationBlockers(summary: Pick<
  EvaluationPreviewReadinessSummary2026,
  | 'missingPolicyCategoryCount'
  | 'manualReviewCount'
  | 'missingSalesClassificationCount'
  | 'ambiguousThresholdCount'
  | 'aiInsufficientDataCount'
>) {
  const blockers: string[] = []
  if (summary.missingPolicyCategoryCount > 0) blockers.push('정책 카테고리 미분류 항목을 HR이 확정해야 합니다.')
  if (summary.manualReviewCount > 0) blockers.push('UNKNOWN/manual-review 항목은 자동 backfill 대상에서 제외해야 합니다.')
  if (summary.missingSalesClassificationCount > 0) blockers.push('영업/비영업 구분 정보가 없는 대상자를 정리해야 합니다.')
  if (summary.ambiguousThresholdCount > 0) blockers.push('영업 팀원 Super/Outstanding 등급 기준 중첩은 HR 정책 확인이 필요합니다.')
  if (summary.aiInsufficientDataCount > 0) blockers.push('AI 레벨업 요건 증빙 부족 건은 점수와 별도로 정리해야 합니다.')
  return blockers
}

export async function getEvaluationPreviewReadinessSummary2026(params: {
  db?: EvaluationPreviewReadinessDb
  year?: number
  cycleId?: string
  limit?: number
}): Promise<EvaluationPreviewReadinessSummary2026> {
  const db = params.db ?? prisma
  const limit = Math.max(1, Math.min(params.limit ?? 200, 500))
  const where = params.cycleId
    ? { evalCycleId: params.cycleId }
    : {
        evalCycle: {
          evalYear: params.year ?? EVALUATION_POLICY_2026.year,
        },
      }

  const evaluationRows = await db.evaluation.findMany({
    where,
    select: {
      id: true,
    },
    orderBy: [{ evalCycleId: 'asc' }, { targetId: 'asc' }, { evalStage: 'asc' }],
    take: limit,
  })

  let canCalculateCount = 0
  let blockedCount = 0
  let missingPolicyCategoryCount = 0
  let manualReviewCount = 0
  let missingSalesClassificationCount = 0
  let ambiguousThresholdCount = 0
  let aiInsufficientDataCount = 0
  const samples: EvaluationPreviewReadinessSample[] = []

  for (const row of evaluationRows) {
    const { evaluation, input } = await buildEvaluationPreviewInputFromDb2026({
      evaluationId: row.id,
      db,
    })
    const preview = calculateEvaluationPreview2026(input)
    if (preview.canCalculate) {
      canCalculateCount += 1
    } else {
      blockedCount += 1
    }

    const uniqueIssueKeys = new Set<string>()
    for (const issue of preview.issues) {
      const key = `${issue.code}:${issue.itemId ?? ''}:${issue.source}`
      if (uniqueIssueKeys.has(key)) continue
      uniqueIssueKeys.add(key)

      if (isMissingPolicyCategory(issue)) missingPolicyCategoryCount += 1
      if (isManualReview(issue)) manualReviewCount += 1
      if (isMissingSalesClassification(issue)) missingSalesClassificationCount += 1
      if (isAmbiguousThreshold(issue)) ambiguousThresholdCount += 1
      if (isAiInsufficientData(issue)) aiInsufficientDataCount += 1

      if (
        isMissingPolicyCategory(issue) ||
        isManualReview(issue) ||
        isMissingSalesClassification(issue) ||
        isAmbiguousThreshold(issue) ||
        isAiInsufficientData(issue)
      ) {
        addSample({ samples, evaluation, issue })
      }
    }

    if (preview.grade.requiresPolicyConfirmation && !preview.issues.some(isAmbiguousThreshold)) {
      ambiguousThresholdCount += 1
    }
  }

  const counts = {
    missingPolicyCategoryCount,
    manualReviewCount,
    missingSalesClassificationCount,
    ambiguousThresholdCount,
    aiInsufficientDataCount,
  }

  return {
    policyVersion: EVALUATION_POLICY_2026.version,
    generatedAt: new Date().toISOString(),
    filters: {
      year: params.cycleId ? undefined : params.year ?? EVALUATION_POLICY_2026.year,
      cycleId: params.cycleId,
      limit,
    },
    totalEvaluationsChecked: evaluationRows.length,
    canCalculateCount,
    blockedCount,
    ...counts,
    samples,
    activationBlockers: buildActivationBlockers(counts),
  }
}

export async function getEvaluationPreviewReadinessForSession2026(
  params: {
    session: Session
    year?: number
    cycleId?: string
    limit?: number
  },
  options: {
    db?: EvaluationPreviewReadinessDb
  } = {}
) {
  const sessionUser = params.session.user as { id?: string } | undefined
  if (!sessionUser?.id) {
    throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  }

  if (!canAccessEvaluationPreview2026(params.session)) {
    throw new AppError(403, 'FORBIDDEN', '2026 평가 전환 준비 상태는 HR 관리자만 확인할 수 있습니다.')
  }

  return getEvaluationPreviewReadinessSummary2026({
    db: options.db,
    year: params.year,
    cycleId: params.cycleId,
    limit: params.limit,
  })
}
