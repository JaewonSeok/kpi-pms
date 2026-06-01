export type OfficialWriteGuardStatus = "ALLOW" | "BLOCK" | "READY_LATER" | "NEEDS_APPROVAL"

export type OfficialWriteGuardReason =
  | "SCHEMA_BOUNDARY_NOT_APPLIED"
  | "STAGING_REHEARSAL_NOT_COMPLETE"
  | "PRODUCTION_MIGRATION_NOT_APPROVED"
  | "HR_APPROVAL_MISSING"
  | "MBO_COVERAGE_INSUFFICIENT"
  | "CONFIRMED_KPI_COVERAGE_INSUFFICIENT"
  | "POLICY_CATEGORY_MISSING"
  | "TEAM_KPI_PENDING"
  | "EVALUATOR_ROUTING_BLOCKED"
  | "SCORE_POLICY_BLOCKED"
  | "GRADE_POLICY_BLOCKED"
  | "LEADER_EVALUATION_BLOCKED"
  | "FINALIZATION_CEO_BLOCKED"
  | "OFFICIAL_GATE_BLOCKED"
  | "AI_SCORE_SEPARATION_NOT_CONFIRMED"
  | "DB_BACKUP_NOT_CONFIRMED"
  | "WRITE_ROUTE_NOT_APPROVED"
  | "UNKNOWN"

export type OfficialWriteGuardDecision = {
  status: OfficialWriteGuardStatus
  allowed: boolean
  reasons: OfficialWriteGuardReason[]
  messageKo: string
  nextActions: string[]
}

export type OfficialEvaluationReadinessInput = {
  schemaBoundaryApplied: boolean
  stagingRehearsalComplete: boolean
  productionMigrationApproved: boolean
  hrApprovalCollected: boolean
  dbBackupConfirmed: boolean
  writeRouteApproved?: boolean
  ceoApprovalCollected?: boolean
  priorStagesComplete?: boolean
  scoreWriteComplete?: boolean
  gradeWriteComplete?: boolean
  scoreCalculated?: boolean
  gradeCalculated?: boolean

  activeEmployees?: number
  confirmedKpiCount?: number
  confirmedKpiCoverageRate?: number
  mboMissing?: number
  confirmedKpiShortage?: number
  teamKpiPending?: number
  policyCategoryMissing?: number
  evaluatorRoutingBlockers?: number
  scorePolicyBlockers?: number
  gradePolicyBlockers?: number
  leaderEvaluationBlockers?: number
  finalizationCeoBlockers?: number
  leadership360Blockers?: number
  officialGateBlockers?: number
  aiPassFailBlockers?: number
  aiAnnualScoreExcluded?: boolean

  approvedExceptions?: {
    mboMissing?: boolean
    confirmedKpiShortage?: boolean
    teamKpiPending?: boolean
    policyCategoryMissing?: boolean
    evaluatorRouting?: boolean
    leaderEvaluation?: boolean
    finalizationCeo?: boolean
    leadership360?: boolean
    officialGate?: boolean
  }
}

export type OfficialWriteGuardSummary = {
  officialPopulation: OfficialWriteGuardDecision
  selfStageSave: OfficialWriteGuardDecision
  reviewerStageSave: OfficialWriteGuardDecision
  scoreWrite: OfficialWriteGuardDecision
  gradeWrite: OfficialWriteGuardDecision
  finalization: OfficialWriteGuardDecision
  overall: OfficialWriteGuardDecision
}

const reasonNextActions: Record<OfficialWriteGuardReason, string> = {
  SCHEMA_BOUNDARY_NOT_APPLIED: "schema boundary migration 전략을 승인하고 안전하게 적용하세요.",
  STAGING_REHEARSAL_NOT_COMPLETE: "staging/preview DB rehearsal을 완료하세요.",
  PRODUCTION_MIGRATION_NOT_APPROVED: "production migration 순서를 승인하세요.",
  HR_APPROVAL_MISSING: "HR 승인 증빙을 수집하세요.",
  MBO_COVERAGE_INSUFFICIENT: "MBO 미작성 항목을 해소하거나 승인 예외를 문서화하세요.",
  CONFIRMED_KPI_COVERAGE_INSUFFICIENT: "확정 KPI 부족을 해소하거나 승인 예외를 문서화하세요.",
  POLICY_CATEGORY_MISSING: "policyCategory 미분류를 0건으로 정리하세요.",
  TEAM_KPI_PENDING: "Team KPI pending/discussion을 0건으로 줄이거나 예외를 문서화하세요.",
  EVALUATOR_ROUTING_BLOCKED: "FIRST/SECOND/FINAL 평가자 배정 blocker를 정리하세요.",
  SCORE_POLICY_BLOCKED: "점수 정책 blocker를 정리하세요.",
  GRADE_POLICY_BLOCKED: "등급 정책 blocker를 정리하세요.",
  LEADER_EVALUATION_BLOCKED: "리더 평가 prerequisite blocker를 정리하세요.",
  FINALIZATION_CEO_BLOCKED: "최종/CEO blocker와 승인 조건을 정리하세요.",
  OFFICIAL_GATE_BLOCKED: "official gate blocker를 해소하거나 승인 예외를 문서화하세요.",
  AI_SCORE_SEPARATION_NOT_CONFIRMED: "AI Pass/Fail이 연간 업적점수에서 제외되는지 확인하세요.",
  DB_BACKUP_NOT_CONFIRMED: "production DB backup/restore 담당자와 절차를 확인하세요.",
  WRITE_ROUTE_NOT_APPROVED: "공식 write route 승인과 리뷰를 완료하세요.",
  UNKNOWN: "알 수 없는 blocker를 확인하세요.",
}

const hasCount = (value: number | undefined) => typeof value === "number" && value > 0

const uniqueReasons = (reasons: OfficialWriteGuardReason[]) => Array.from(new Set(reasons))

const buildDecision = (
  reasons: OfficialWriteGuardReason[],
  allowMessageKo: string,
  blockMessageKo: string,
): OfficialWriteGuardDecision => {
  const unique = uniqueReasons(reasons)

  if (unique.length === 0) {
    return {
      status: "ALLOW",
      allowed: true,
      reasons: [],
      messageKo: allowMessageKo,
      nextActions: [],
    }
  }

  return {
    status: "BLOCK",
    allowed: false,
    reasons: unique,
    messageKo: blockMessageKo,
    nextActions: unique.map((reason) => reasonNextActions[reason]),
  }
}

const getInfrastructureBlockers = (input: OfficialEvaluationReadinessInput) => {
  const reasons: OfficialWriteGuardReason[] = []

  if (!input.schemaBoundaryApplied) reasons.push("SCHEMA_BOUNDARY_NOT_APPLIED")
  if (!input.stagingRehearsalComplete) reasons.push("STAGING_REHEARSAL_NOT_COMPLETE")
  if (!input.productionMigrationApproved) reasons.push("PRODUCTION_MIGRATION_NOT_APPROVED")
  if (!input.hrApprovalCollected) reasons.push("HR_APPROVAL_MISSING")
  if (!input.dbBackupConfirmed) reasons.push("DB_BACKUP_NOT_CONFIRMED")
  if (input.writeRouteApproved !== true) reasons.push("WRITE_ROUTE_NOT_APPROVED")

  return reasons
}

const getPopulationDataBlockers = (input: OfficialEvaluationReadinessInput) => {
  const exceptions = input.approvedExceptions ?? {}
  const reasons: OfficialWriteGuardReason[] = []

  if (hasCount(input.mboMissing) && !exceptions.mboMissing) {
    reasons.push("MBO_COVERAGE_INSUFFICIENT")
  }

  if (hasCount(input.confirmedKpiShortage) && !exceptions.confirmedKpiShortage) {
    reasons.push("CONFIRMED_KPI_COVERAGE_INSUFFICIENT")
  }

  if (hasCount(input.teamKpiPending) && !exceptions.teamKpiPending) {
    reasons.push("TEAM_KPI_PENDING")
  }

  if (hasCount(input.policyCategoryMissing) && !exceptions.policyCategoryMissing) {
    reasons.push("POLICY_CATEGORY_MISSING")
  }

  if (hasCount(input.evaluatorRoutingBlockers) && !exceptions.evaluatorRouting) {
    reasons.push("EVALUATOR_ROUTING_BLOCKED")
  }

  if (hasCount(input.officialGateBlockers) && !exceptions.officialGate) {
    reasons.push("OFFICIAL_GATE_BLOCKED")
  }

  return reasons
}

export const evaluateOfficialPopulationGuard = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardDecision =>
  buildDecision(
    [...getInfrastructureBlockers(input), ...getPopulationDataBlockers(input)],
    "공식 평가 생성 조건을 충족했습니다.",
    "공식 평가 생성은 아직 허용되지 않습니다.",
  )

export const evaluateSelfStageSaveGuard = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardDecision =>
  buildDecision(
    evaluateOfficialPopulationGuard(input).reasons,
    "자기평가 공식 저장 조건을 충족했습니다.",
    "자기평가 공식 저장은 아직 허용되지 않습니다.",
  )

export const evaluateReviewerStageSaveGuard = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardDecision => {
  const exceptions = input.approvedExceptions ?? {}
  const reasons: OfficialWriteGuardReason[] = [...evaluateOfficialPopulationGuard(input).reasons]

  if (hasCount(input.evaluatorRoutingBlockers) && !exceptions.evaluatorRouting) {
    reasons.push("EVALUATOR_ROUTING_BLOCKED")
  }

  if (hasCount(input.leaderEvaluationBlockers) && !exceptions.leaderEvaluation) {
    reasons.push("LEADER_EVALUATION_BLOCKED")
  }

  return buildDecision(
    reasons,
    "평가자 공식 저장 조건을 충족했습니다.",
    "평가자 공식 저장은 아직 허용되지 않습니다.",
  )
}

export const evaluateScoreWriteGuard = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardDecision => {
  const reasons: OfficialWriteGuardReason[] = [...evaluateReviewerStageSaveGuard(input).reasons]

  if (hasCount(input.scorePolicyBlockers)) {
    reasons.push("SCORE_POLICY_BLOCKED")
  }

  if (hasCount(input.aiPassFailBlockers) || input.aiAnnualScoreExcluded !== true) {
    reasons.push("AI_SCORE_SEPARATION_NOT_CONFIRMED")
  }

  if (input.priorStagesComplete !== true) {
    reasons.push("OFFICIAL_GATE_BLOCKED")
  }

  return buildDecision(
    reasons,
    "공식 점수 반영 조건을 충족했습니다.",
    "공식 점수 반영은 아직 허용되지 않습니다.",
  )
}

export const evaluateGradeWriteGuard = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardDecision => {
  const reasons: OfficialWriteGuardReason[] = [...evaluateScoreWriteGuard(input).reasons]

  if (hasCount(input.gradePolicyBlockers)) {
    reasons.push("GRADE_POLICY_BLOCKED")
  }

  if (input.scoreWriteComplete !== true && input.scoreCalculated !== true) {
    reasons.push("WRITE_ROUTE_NOT_APPROVED")
  }

  if (hasCount(input.finalizationCeoBlockers) && !input.approvedExceptions?.finalizationCeo) {
    reasons.push("FINALIZATION_CEO_BLOCKED")
  }

  return buildDecision(
    reasons,
    "공식 등급 반영 조건을 충족했습니다.",
    "공식 등급 반영은 아직 허용되지 않습니다.",
  )
}

export const evaluateFinalizationGuard = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardDecision => {
  const reasons: OfficialWriteGuardReason[] = [...evaluateGradeWriteGuard(input).reasons]

  if (input.gradeWriteComplete !== true && input.gradeCalculated !== true) {
    reasons.push("WRITE_ROUTE_NOT_APPROVED")
  }

  if (input.ceoApprovalCollected !== true) {
    reasons.push("FINALIZATION_CEO_BLOCKED")
  }

  return buildDecision(
    reasons,
    "최종 확정 조건을 충족했습니다.",
    "최종 확정은 아직 허용되지 않습니다.",
  )
}

export const summarizeOfficialWriteHold = (
  input: OfficialEvaluationReadinessInput,
): OfficialWriteGuardSummary => {
  const officialPopulation = evaluateOfficialPopulationGuard(input)
  const selfStageSave = evaluateSelfStageSaveGuard(input)
  const reviewerStageSave = evaluateReviewerStageSaveGuard(input)
  const scoreWrite = evaluateScoreWriteGuard(input)
  const gradeWrite = evaluateGradeWriteGuard(input)
  const finalization = evaluateFinalizationGuard(input)
  const allDecisions = [
    officialPopulation,
    selfStageSave,
    reviewerStageSave,
    scoreWrite,
    gradeWrite,
    finalization,
  ]

  return {
    officialPopulation,
    selfStageSave,
    reviewerStageSave,
    scoreWrite,
    gradeWrite,
    finalization,
    overall: buildDecision(
      allDecisions.flatMap((decision) => decision.reasons),
      "2026 공식 평가 쓰기 조건을 모두 충족했습니다.",
      "2026 공식 평가 쓰기는 아직 허용되지 않습니다.",
    ),
  }
}
