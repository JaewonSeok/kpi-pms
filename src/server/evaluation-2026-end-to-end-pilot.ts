import { EVALUATION_POLICY_2026, type EvaluationPolicyItemCategoryCode } from '@/lib/evaluation-policy-2026'
import type { Evaluation2026FeatureFlags } from '@/lib/feature-flags'
import { calculateGradePreview2026 } from '@/server/evaluation-grade-2026'
import { calculateEvaluationScore2026, type EvaluationScore2026ItemInput } from '@/server/evaluation-scoring-2026'

export type Evaluation2026PilotStepStatus = 'READY' | 'BLOCKED' | 'PREVIEW_ONLY'
export type Evaluation2026PilotDataSource = 'LIVE_READINESS_SAMPLE' | 'SAMPLE_PILOT_FIXTURE'

export type Evaluation2026EndToEndPilotStep = {
  id:
    | 'TARGET_SELECTION'
    | 'KPI_ITEMS'
    | 'SELF_EVALUATION'
    | 'FIRST_REVIEW'
    | 'SECOND_FINAL_REVIEW'
    | 'SCORE_PREVIEW'
    | 'GRADE_PREVIEW'
    | 'CEO_FINAL_CONFIRMATION_PREVIEW'
    | 'SAFETY_CONFIRMATION'
  order: number
  label: string
  status: Evaluation2026PilotStepStatus
  dataUsed: string[]
  officialLater: string
  blockedBy: string[]
  route: string
}

export type Evaluation2026PilotKpi = {
  id: string
  title: string
  category: EvaluationPolicyItemCategoryCode
  weight: number
  achievementLevel: 'TARGET' | 'EXCELLENT' | 'CUSTOM'
  previewScore: number
  source: Evaluation2026PilotDataSource
}

export type Evaluation2026EndToEndPilot = {
  mode: 'PREVIEW_ONLY'
  status: 'AVAILABLE'
  summary: {
    currentDecision: 'PREVIEW_ONLY'
    workflowStepCount: number
    readyStepCount: number
    blockedStepCount: number
    previewOnlyStepCount: number
    pilotDataSource: Evaluation2026PilotDataSource
    pilotEmployeeName: string
    pilotEmployeeDepartment: string
    canSelectPilotEmployeesSafely: boolean
    canPreviewEvaluationPopulationWithoutWrites: boolean
    canPreviewEvaluationItemsWithoutWrites: boolean
    canSimulateSelfEvaluation: boolean
    canSimulateFirstReview: boolean
    canSimulateSecondFinalReview: boolean
    canPreviewScoreCalculation: boolean
    canPreviewGradeCalculation: boolean
    canPreviewCeoFinalConfirmation: boolean
  }
  gapAssessment: Array<{
    question: string
    answer: 'YES_PREVIEW_ONLY' | 'YES_WITH_EXISTING_PREVIEW' | 'BLOCKED_FOR_OFFICIAL' | 'MISSING_OFFICIAL_DATA'
    note: string
  }>
  pilotEmployee: {
    id: string
    employeeNo: string | null
    name: string
    departmentName: string
    confirmedPersonalKpiCount: number
    source: Evaluation2026PilotDataSource
  }
  pilotKpis: Evaluation2026PilotKpi[]
  evaluationItemPreview: Array<{
    personalKpiId: string
    title: string
    category: EvaluationPolicyItemCategoryCode
    wouldCreateEvaluationItem: false
    previewOnly: true
    scoreContributionType: 'ORGANIZATION' | 'PERSONAL'
    weight: number
  }>
  workflowSteps: Evaluation2026EndToEndPilotStep[]
  scorePreview: {
    status: 'READY' | 'BLOCKED'
    organizationPerformanceWeight: 30
    personalPerformanceWeight: 70
    organizationPerformanceScore: number | null
    personalPerformanceScore: number | null
    finalScorePreview: number | null
    formulaVersion: string
    aiExcludedFromAnnualPerformanceScore: true
    categoryContributions: Array<{
      category: EvaluationPolicyItemCategoryCode
      contributionType: 'ORGANIZATION' | 'PERSONAL'
      baseScore: number
      finalScore: number
      weight: number
    }>
    warnings: string[]
  }
  gradePreview: {
    status: 'READY' | 'BLOCKED'
    applicableGroup: string
    thresholdGroupLabel: string | null
    scoreToGradeMapping: string
    gradePreview: string | null
    formulaVersion: string
    teamMemberSalesSuperNotApplicableNote: string
    warnings: string[]
    blockers: string[]
  }
  ceoFinalConfirmationPreview: {
    status: Evaluation2026PilotStepStatus
    finalReviewerStagePreview: 'CEO_ADJUST'
    adjustmentReasonRequired: true
    calibrationFinalizationBlockers: number
    ceoConfirmationBlockers: number
    noFinalizationWrite: true
    notes: string[]
  }
  blockers: string[]
  safety: {
    writesPerformed: false
    dryRunExecuted: false
    backfillExecuted: false
    backfillApplyExecuted: false
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    officialEvaluationsCreated: 0
    officialEvaluationItemsCreated: 0
    emailsSent: false
    notificationsSent: false
    noOfficialActivationButtons: true
    noBackfillApplyButtons: true
    noScoreGradeWriteButtons: true
  }
}

type PopulationInput = {
  activeEmployeeCount?: number | null
  employeesWithConfirmedPersonalKpiCount?: number | null
  employeesMissingConfirmedPersonalKpiCount?: number | null
  wouldCreateSelfEvaluationCount?: number | null
  wouldCreateEvaluationItemCount?: number | null
  policyCategoryMissingCount?: number | null
  employeesWithConfirmedPersonalKpi?: Array<{
    employeeId?: string | null
    employeeNo?: string | null
    employeeName?: string | null
    departmentName?: string | null
    confirmedPersonalKpiCount?: number | null
  }>
  wouldCreateSelfEvaluations?: Array<{
    employeeId?: string | null
    employeeName?: string | null
    departmentName?: string | null
    confirmedPersonalKpiCount?: number | null
    itemTitles?: string[] | null
    missingPolicyCategoryCount?: number | null
  }>
  scorePolicyReadiness?: {
    summary?: {
      violationsCount?: number | null
      aiExcludedConfirmation?: boolean | null
    }
  }
  leaderEvaluationReadiness?: {
    summary?: {
      blockerCount?: number | null
      missingEvaluatorCount?: number | null
      readyForLeaderReviewCount?: number | null
      firstReviewMissingPrerequisitesCount?: number | null
      secondReviewMissingPrerequisitesCount?: number | null
    }
  }
  finalizationCeoReadiness?: {
    summary?: {
      finalizationBlockerCount?: number | null
      calibrationReadinessBlockerCount?: number | null
      ceoConfirmationBlockerCount?: number | null
      gradePolicyBlockerCount?: number | null
    }
  }
}

type GradePolicyInput = {
  gradePolicyExists?: boolean
  gradePolicyGroupsComplete?: boolean
  differsFromPptCount?: number | null
  overlapCount?: number | null
  gapCount?: number | null
  teamMemberSalesAmbiguity?: {
    requiresDecision?: boolean
  }
}

const SAMPLE_PILOT_KPIS: Evaluation2026PilotKpi[] = [
  {
    id: 'pilot-org-goal',
    title: '본부 핵심 매출 목표 기여',
    category: 'ORG_GOAL',
    weight: 50,
    achievementLevel: 'TARGET',
    previewScore: 90,
    source: 'SAMPLE_PILOT_FIXTURE',
  },
  {
    id: 'pilot-project-t',
    title: '전략 프로젝트 T 납기/성과 달성',
    category: 'PROJECT_T',
    weight: 30,
    achievementLevel: 'EXCELLENT',
    previewScore: 100,
    source: 'SAMPLE_PILOT_FIXTURE',
  },
  {
    id: 'pilot-project-k',
    title: '핵심 개선 프로젝트 K 목표 달성',
    category: 'PROJECT_K',
    weight: 30,
    achievementLevel: 'TARGET',
    previewScore: 80,
    source: 'SAMPLE_PILOT_FIXTURE',
  },
  {
    id: 'pilot-daily-work',
    title: '일상업무 품질 및 운영 안정성',
    category: 'DAILY_WORK',
    weight: 40,
    achievementLevel: 'CUSTOM',
    previewScore: 76,
    source: 'SAMPLE_PILOT_FIXTURE',
  },
]

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function statusFromBlockers(blockers: string[]): Evaluation2026PilotStepStatus {
  return blockers.length ? 'BLOCKED' : 'PREVIEW_ONLY'
}

function pickPilotEmployee(population: PopulationInput | null) {
  const live =
    population?.employeesWithConfirmedPersonalKpi?.[0] ??
    population?.wouldCreateSelfEvaluations?.[0] ??
    null
  if (live) {
    return {
      id: live.employeeId ?? 'live-readiness-sample',
      employeeNo: 'employeeNo' in live ? live.employeeNo ?? null : null,
      name: live.employeeName ?? 'readiness sample employee',
      departmentName: live.departmentName ?? 'readiness sample department',
      confirmedPersonalKpiCount: finiteNumber(live.confirmedPersonalKpiCount),
      source: 'LIVE_READINESS_SAMPLE' as const,
      itemTitles: 'itemTitles' in live ? live.itemTitles ?? [] : [],
    }
  }

  return {
    id: 'pilot-sample-employee',
    employeeNo: 'PILOT-001',
    name: '2026 Pilot Sample',
    departmentName: 'Preview Sandbox',
    confirmedPersonalKpiCount: SAMPLE_PILOT_KPIS.length,
    source: 'SAMPLE_PILOT_FIXTURE' as const,
    itemTitles: SAMPLE_PILOT_KPIS.map((item) => item.title),
  }
}

function buildPilotKpis(pilotEmployee: ReturnType<typeof pickPilotEmployee>) {
  if (pilotEmployee.source === 'LIVE_READINESS_SAMPLE' && pilotEmployee.itemTitles.length) {
    return SAMPLE_PILOT_KPIS.map((item, index) => ({
      ...item,
      id: `pilot-live-${index + 1}`,
      title: pilotEmployee.itemTitles[index] ?? item.title,
      source: 'LIVE_READINESS_SAMPLE' as const,
    }))
  }
  return SAMPLE_PILOT_KPIS
}

function buildScoreInput(kpis: Evaluation2026PilotKpi[]): EvaluationScore2026ItemInput[] {
  return kpis.map((item) => ({
    id: item.id,
    category: item.category,
    achievementLevel: item.achievementLevel,
    score: item.previewScore,
    weight: item.weight,
  }))
}

function gradePolicyBlockers(gradePolicy: GradePolicyInput | null) {
  if (!gradePolicy) return ['grade policy readiness not available']
  const blockers: string[] = []
  if (!gradePolicy.gradePolicyExists) blockers.push('grade policy missing')
  if (!gradePolicy.gradePolicyGroupsComplete) blockers.push('grade policy groups incomplete')
  if (finiteNumber(gradePolicy.differsFromPptCount) > 0) blockers.push('grade policy differs from PPT')
  if (finiteNumber(gradePolicy.overlapCount) > 0) blockers.push('grade threshold overlap')
  if (finiteNumber(gradePolicy.gapCount) > 0) blockers.push('grade threshold gap')
  if (gradePolicy.teamMemberSalesAmbiguity?.requiresDecision) blockers.push('TEAM_MEMBER_SALES Super/Outstanding decision required')
  return blockers
}

function buildGapAssessment(params: {
  population: PopulationInput | null
  scoreReady: boolean
  gradeReady: boolean
}): Evaluation2026EndToEndPilot['gapAssessment'] {
  const hasPopulationPreview = Boolean(params.population)
  return [
    {
      question: 'Can we select pilot employees safely?',
      answer: hasPopulationPreview ? 'YES_WITH_EXISTING_PREVIEW' : 'YES_PREVIEW_ONLY',
      note: hasPopulationPreview
        ? 'Use readiness population dry-run sample rows only; do not create official evaluations.'
        : 'Use deterministic sample fixture because live readiness population is unavailable.',
    },
    {
      question: 'Can we preview Evaluation population without writes?',
      answer: 'YES_WITH_EXISTING_PREVIEW',
      note: 'readiness population dry-run exposes wouldCreateSelfEvaluationCount and remains writesPerformed=false.',
    },
    {
      question: 'Can we preview EvaluationItem population without writes?',
      answer: 'YES_WITH_EXISTING_PREVIEW',
      note: 'readiness population dry-run exposes wouldCreateEvaluationItemCount and policyCategory blockers.',
    },
    {
      question: 'Can we simulate self-evaluation?',
      answer: 'YES_PREVIEW_ONLY',
      note: 'Pilot creates in-memory stage state only; route writes remain outside this pilot.',
    },
    {
      question: 'Can we simulate first review?',
      answer: 'YES_PREVIEW_ONLY',
      note: 'Evaluator routing readiness is referenced; no review PATCH is called.',
    },
    {
      question: 'Can we simulate second/final review?',
      answer: 'YES_PREVIEW_ONLY',
      note: 'Second/final stages are modeled as preview states with blockers surfaced from leader readiness.',
    },
    {
      question: 'Can we preview score calculation?',
      answer: params.scoreReady ? 'YES_WITH_EXISTING_PREVIEW' : 'MISSING_OFFICIAL_DATA',
      note: 'Uses evaluation-scoring-2026 pure function and never writes Evaluation.totalScore.',
    },
    {
      question: 'Can we preview grade calculation?',
      answer: params.gradeReady ? 'YES_WITH_EXISTING_PREVIEW' : 'MISSING_OFFICIAL_DATA',
      note: 'Uses evaluation-grade-2026 pure function and never writes Evaluation.gradeId.',
    },
    {
      question: 'Can we preview CEO/final confirmation?',
      answer: 'YES_PREVIEW_ONLY',
      note: 'Shows CEO_ADJUST preview and adjustment reason requirement without finalization writes.',
    },
  ]
}

function buildStep(params: Omit<Evaluation2026EndToEndPilotStep, 'status' | 'blockedBy'> & {
  blockedBy?: string[]
  status?: Evaluation2026PilotStepStatus
}): Evaluation2026EndToEndPilotStep {
  const blockedBy = params.blockedBy ?? []
  return {
    ...params,
    status: params.status ?? statusFromBlockers(blockedBy),
    blockedBy,
  }
}

export function buildEvaluation2026EndToEndPilot(params: {
  populationDryRun: unknown
  gradePolicyReadiness: unknown
  flags: Evaluation2026FeatureFlags
}): Evaluation2026EndToEndPilot {
  const population = params.populationDryRun as PopulationInput | null
  const gradePolicy = params.gradePolicyReadiness as GradePolicyInput | null
  const pilotEmployee = pickPilotEmployee(population)
  const pilotKpis = buildPilotKpis(pilotEmployee)
  const scoreResult = calculateEvaluationScore2026({ items: buildScoreInput(pilotKpis) })
  const scoreWarnings = [
    'AI Pass/Fail is separated from annual performance score.',
    'Preview score is not written to Evaluation.totalScore.',
  ]
  const scorePreview = scoreResult.ok
    ? {
        status: 'READY' as const,
        organizationPerformanceWeight: EVALUATION_POLICY_2026.finalScoreFormula.organizationPerformanceWeight as 30,
        personalPerformanceWeight: EVALUATION_POLICY_2026.finalScoreFormula.personalPerformanceWeight as 70,
        organizationPerformanceScore: scoreResult.value.organizationPerformanceScore,
        personalPerformanceScore: scoreResult.value.personalPerformanceScore,
        finalScorePreview: scoreResult.value.finalScore,
        formulaVersion: scoreResult.value.formulaVersion,
        aiExcludedFromAnnualPerformanceScore: true as const,
        categoryContributions: scoreResult.value.itemScores.map((item) => ({
          category: item.category,
          contributionType: item.contributionType,
          baseScore: item.baseScore,
          finalScore: item.finalScore,
          weight: item.weight ?? 0,
        })),
        warnings: scoreWarnings,
      }
    : {
        status: 'BLOCKED' as const,
        organizationPerformanceWeight: EVALUATION_POLICY_2026.finalScoreFormula.organizationPerformanceWeight as 30,
        personalPerformanceWeight: EVALUATION_POLICY_2026.finalScoreFormula.personalPerformanceWeight as 70,
        organizationPerformanceScore: null,
        personalPerformanceScore: null,
        finalScorePreview: null,
        formulaVersion: EVALUATION_POLICY_2026.version,
        aiExcludedFromAnnualPerformanceScore: true as const,
        categoryContributions: [],
        warnings: [...scoreWarnings, ...scoreResult.errors.map((item) => item.message)],
      }
  const gradeBlockers = gradePolicyBlockers(gradePolicy)
  const gradeResult = scorePreview.finalScorePreview == null
    ? null
    : calculateGradePreview2026({
        formulaVersion: EVALUATION_POLICY_2026.version,
        legacyGrade: 'N/A',
        score: scorePreview.finalScorePreview,
        thresholdGroup: 'TEAM_MEMBER_NON_SALES',
      })
  const gradePreview = gradeResult?.ok && !gradeBlockers.length
    ? {
        status: 'READY' as const,
        applicableGroup: 'TEAM_MEMBER_NON_SALES',
        thresholdGroupLabel: gradeResult.value.result2026?.thresholdGroupLabel ?? null,
        scoreToGradeMapping: `${scorePreview.finalScorePreview} -> ${gradeResult.value.grade}`,
        gradePreview: gradeResult.value.grade,
        formulaVersion: gradeResult.value.formulaVersion,
        teamMemberSalesSuperNotApplicableNote: 'TEAM_MEMBER_NON_SALES pilot에서는 Super 점수 구간이 별도 운영되지 않습니다. TEAM_MEMBER_SALES Super/Outstanding 중첩은 HR 정책 결정 후 별도 preview가 필요합니다.',
        warnings: gradeResult.warnings.map((item) => item.message),
        blockers: [],
      }
    : {
        status: 'BLOCKED' as const,
        applicableGroup: 'TEAM_MEMBER_NON_SALES',
        thresholdGroupLabel: null,
        scoreToGradeMapping: 'blocked until score and grade policy are ready',
        gradePreview: null,
        formulaVersion: EVALUATION_POLICY_2026.version,
        teamMemberSalesSuperNotApplicableNote: 'TEAM_MEMBER_NON_SALES pilot에서는 Super 점수 구간이 별도 운영되지 않습니다. TEAM_MEMBER_SALES Super/Outstanding 중첩은 HR 정책 결정 후 별도 preview가 필요합니다.',
        warnings: gradeResult && !gradeResult.ok ? gradeResult.warnings.map((item) => item.message) : [],
        blockers: [
          ...gradeBlockers,
          ...(gradeResult && !gradeResult.ok ? gradeResult.errors.map((item) => item.message) : []),
        ],
      }

  const kpiBlockers = [
    finiteNumber(population?.employeesMissingConfirmedPersonalKpiCount) > 0 ? 'confirmed PersonalKpi coverage shortage remains' : null,
    finiteNumber(population?.policyCategoryMissingCount) > 0 ? 'policyCategory missing remains' : null,
  ].filter((item): item is string => Boolean(item))
  const scoreBlockers = [
    finiteNumber(population?.scorePolicyReadiness?.summary?.violationsCount) > 0 ? 'score policy blockers remain' : null,
    scorePreview.status === 'BLOCKED' ? 'score preview calculation blocked' : null,
  ].filter((item): item is string => Boolean(item))
  const leaderBlockers = [
    finiteNumber(population?.leaderEvaluationReadiness?.summary?.blockerCount) > 0 ? 'leader evaluation readiness blockers remain' : null,
    finiteNumber(population?.leaderEvaluationReadiness?.summary?.missingEvaluatorCount) > 0 ? 'evaluator routing blockers remain' : null,
  ].filter((item): item is string => Boolean(item))
  const officialFlagBlockers = [
    params.flags.officialScoringEnabled ? 'official scoring flag is enabled outside pilot' : null,
    params.flags.officialGradeEnabled ? 'official grade flag is enabled outside pilot' : null,
    params.flags.aiScoreExclusionEnabled ? 'AI score exclusion flag is enabled outside pilot' : null,
  ].filter((item): item is string => Boolean(item))
  const finalizationBlockers = [
    finiteNumber(population?.finalizationCeoReadiness?.summary?.finalizationBlockerCount) > 0 ? 'finalization/CEO readiness blockers remain' : null,
    finiteNumber(population?.finalizationCeoReadiness?.summary?.calibrationReadinessBlockerCount) > 0 ? 'calibration readiness blockers remain' : null,
    finiteNumber(population?.finalizationCeoReadiness?.summary?.ceoConfirmationBlockerCount) > 0 ? 'CEO confirmation blockers remain' : null,
  ].filter((item): item is string => Boolean(item))
  const ceoFinalConfirmationPreview = {
    status: statusFromBlockers(finalizationBlockers),
    finalReviewerStagePreview: 'CEO_ADJUST' as const,
    adjustmentReasonRequired: true as const,
    calibrationFinalizationBlockers: finiteNumber(population?.finalizationCeoReadiness?.summary?.calibrationReadinessBlockerCount),
    ceoConfirmationBlockers: finiteNumber(population?.finalizationCeoReadiness?.summary?.ceoConfirmationBlockerCount),
    noFinalizationWrite: true as const,
    notes: [
      '대표이사 확정 preview는 final reviewer stage와 조정 사유 requirement만 표시합니다.',
      '공식 finalization, totalScore, gradeId write는 수행하지 않습니다.',
    ],
  }

  const workflowSteps: Evaluation2026EndToEndPilotStep[] = [
    buildStep({
      id: 'TARGET_SELECTION',
      order: 1,
      label: '대상자',
      status: 'PREVIEW_ONLY',
      dataUsed: ['readiness population sample', 'active employee / confirmed KPI count'],
      officialLater: 'HR가 공식 대상자 범위를 확정한 뒤 population apply를 별도 승인합니다.',
      route: '/evaluation/performance',
    }),
    buildStep({
      id: 'KPI_ITEMS',
      order: 2,
      label: 'KPI 항목',
      blockedBy: kpiBlockers,
      dataUsed: ['confirmed PersonalKpi', 'policyCategory', '2026 policy category rules'],
      officialLater: 'EvaluationItem은 backfill/apply 승인 후 별도 생성됩니다.',
      route: '/kpi/personal',
    }),
    buildStep({
      id: 'SELF_EVALUATION',
      order: 3,
      label: '자기평가',
      blockedBy: kpiBlockers,
      dataUsed: ['pilot KPI items', 'sample self comments', 'monthly evidence availability'],
      officialLater: '직원이 Evaluation SELF 단계에서 결과와 근거를 저장/제출합니다.',
      route: '/evaluation/workbench',
    }),
    buildStep({
      id: 'FIRST_REVIEW',
      order: 4,
      label: '1차 평가',
      blockedBy: [...kpiBlockers, ...leaderBlockers],
      dataUsed: ['FIRST evaluator routing readiness', 'SELF stage preview state'],
      officialLater: '1차 평가자가 공식 review route에서 평가를 저장/제출합니다.',
      route: '/evaluation/workbench',
    }),
    buildStep({
      id: 'SECOND_FINAL_REVIEW',
      order: 5,
      label: '2차/최종 평가',
      blockedBy: [...kpiBlockers, ...leaderBlockers],
      dataUsed: ['SECOND/FINAL evaluator routing readiness', 'prior-stage preview chain'],
      officialLater: '상위 평가자가 공식 chain에 따라 2차/최종 평가를 제출합니다.',
      route: '/evaluation/workbench',
    }),
    buildStep({
      id: 'SCORE_PREVIEW',
      order: 6,
      label: '점수 preview',
      blockedBy: scoreBlockers,
      dataUsed: ['2026 scoring pure function', 'organization 30%', 'personal 70%', 'category contributions'],
      officialLater: '공식 scoring flag와 HR 승인 후에만 totalScore write를 별도 수행합니다.',
      route: '/evaluation/performance',
    }),
    buildStep({
      id: 'GRADE_PREVIEW',
      order: 7,
      label: '등급 preview',
      blockedBy: gradePreview.blockers,
      dataUsed: ['2026 grade pure function', 'TEAM_MEMBER_NON_SALES threshold group'],
      officialLater: '공식 grade flag와 finalization 승인 후 gradeId write를 별도 수행합니다.',
      route: '/evaluation/performance',
    }),
    buildStep({
      id: 'CEO_FINAL_CONFIRMATION_PREVIEW',
      order: 8,
      label: '대표이사 확정 preview',
      blockedBy: finalizationBlockers,
      dataUsed: ['finalization/CEO readiness', 'CEO_ADJUST preview stage', 'adjustment reason rule'],
      officialLater: 'CEO/final confirmation은 score/grade 안정화 후 별도 화면에서 확정합니다.',
      route: '/evaluation/ceo-adjust',
    }),
    buildStep({
      id: 'SAFETY_CONFIRMATION',
      order: 9,
      label: '안전 확인',
      status: 'READY',
      dataUsed: ['feature flags', 'pilot safety flags'],
      officialLater: '공식 실행 전에도 pilot 화면은 계속 preview-only 상태를 유지합니다.',
      route: '/evaluation/performance',
    }),
  ]
  const blockers = Array.from(new Set([
    ...kpiBlockers,
    ...scoreBlockers,
    ...gradePreview.blockers,
    ...leaderBlockers,
    ...finalizationBlockers,
    ...officialFlagBlockers,
  ]))
  const readyStepCount = workflowSteps.filter((item) => item.status === 'READY').length
  const blockedStepCount = workflowSteps.filter((item) => item.status === 'BLOCKED').length
  const previewOnlyStepCount = workflowSteps.filter((item) => item.status === 'PREVIEW_ONLY').length
  const scoreReady = scorePreview.status === 'READY'
  const gradeReady = gradePreview.status === 'READY'

  return {
    mode: 'PREVIEW_ONLY',
    status: 'AVAILABLE',
    summary: {
      currentDecision: 'PREVIEW_ONLY',
      workflowStepCount: workflowSteps.length,
      readyStepCount,
      blockedStepCount,
      previewOnlyStepCount,
      pilotDataSource: pilotEmployee.source,
      pilotEmployeeName: pilotEmployee.name,
      pilotEmployeeDepartment: pilotEmployee.departmentName,
      canSelectPilotEmployeesSafely: true,
      canPreviewEvaluationPopulationWithoutWrites: true,
      canPreviewEvaluationItemsWithoutWrites: true,
      canSimulateSelfEvaluation: true,
      canSimulateFirstReview: true,
      canSimulateSecondFinalReview: true,
      canPreviewScoreCalculation: scoreReady,
      canPreviewGradeCalculation: gradeReady,
      canPreviewCeoFinalConfirmation: true,
    },
    gapAssessment: buildGapAssessment({ population, scoreReady, gradeReady }),
    pilotEmployee: {
      id: pilotEmployee.id,
      employeeNo: pilotEmployee.employeeNo,
      name: pilotEmployee.name,
      departmentName: pilotEmployee.departmentName,
      confirmedPersonalKpiCount: pilotEmployee.confirmedPersonalKpiCount,
      source: pilotEmployee.source,
    },
    pilotKpis,
    evaluationItemPreview: pilotKpis.map((item) => ({
      personalKpiId: item.id,
      title: item.title,
      category: item.category,
      wouldCreateEvaluationItem: false,
      previewOnly: true,
      scoreContributionType: item.category === 'ORG_GOAL' ? 'ORGANIZATION' : 'PERSONAL',
      weight: item.weight,
    })),
    workflowSteps,
    scorePreview,
    gradePreview,
    ceoFinalConfirmationPreview,
    blockers,
    safety: {
      writesPerformed: false,
      dryRunExecuted: false,
      backfillExecuted: false,
      backfillApplyExecuted: false,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
      officialAiScoreExclusionEnabled: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      officialEvaluationsCreated: 0,
      officialEvaluationItemsCreated: 0,
      emailsSent: false,
      notificationsSent: false,
      noOfficialActivationButtons: true,
      noBackfillApplyButtons: true,
      noScoreGradeWriteButtons: true,
    },
  }
}
