import type {
  Evaluation2026IntegratedReadinessBlocker,
  Evaluation2026IntegratedReadinessSnapshot,
  Evaluation2026IntegratedReadinessStage,
  Evaluation2026IntegratedReadinessStatus,
} from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type { Evaluation2026ReadinessActionPlan } from '@/server/evaluation-2026-readiness-action-plan'
import type { Evaluation2026ReadinessExecutionBoard } from '@/server/evaluation-2026-readiness-execution-board'
import type { Evaluation2026OfficialActivationRunbook } from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026ReadinessScenarioInput = {
  mboMissingReduction: number
  confirmedKpiIncrease: number
  teamKpiPendingReduction: number
  policyCategoryMissingReduction: number
  evaluatorRoutingBlockerReduction: number
  leaderEvaluationBlockerReduction: number
  resultWritingWarningReduction: number
  scorePolicyBlockerReduction: number
  gradePolicyBlockerReduction: number
  feedbackLeadershipBlockerReduction: number
  finalizationCeoBlockerReduction: number
}

export type Evaluation2026ReadinessScenarioProjectedCounts = {
  activeEmployeeCount: number | null
  confirmedPersonalKpiCount: number | null
  confirmedPersonalKpiShortageCount: number | null
  missingMboCount: number | null
  teamKpiPendingCount: number | null
  policyCategoryMissingCount: number | null
  evaluatorRoutingBlockerCount: number | null
  leaderEvaluationBlockerCount: number | null
  resultWritingWarningCount: number | null
  scorePolicyBlockerCount: number | null
  gradePolicyBlockerCount: number | null
  feedbackLeadershipBlockerCount: number | null
  finalizationCeoBlockerCount: number | null
  officialActivationGateBlockerCount: number | null
  estimatedOfficialGateBlockerCount: number | null
  estimatedOfficialGateImpact: number
}

export type Evaluation2026ReadinessScenarioDelta = {
  blockerCode: string
  label: string
  baselineCount: number | null
  projectedCount: number | null
  delta: number | null
  note: string
}

export type Evaluation2026ReadinessScenarioProjection = {
  id: string
  name: string
  description: string
  input: Evaluation2026ReadinessScenarioInput
  projectedCounts: Evaluation2026ReadinessScenarioProjectedCounts
  deltaByBlocker: Evaluation2026ReadinessScenarioDelta[]
  projectedCurrentStage: Evaluation2026IntegratedReadinessStage
  projectedOverallStatus: Evaluation2026IntegratedReadinessStatus
  officialActivationStatus: 'BLOCKED'
  decisionReadiness: 'READINESS_PLANNING_ONLY' | 'DRY_RUN_BACKUP_HR_APPROVAL_REQUIRED'
  improvedAreas: string[]
  unchangedAreas: string[]
  remainingBlockers: Evaluation2026IntegratedReadinessBlocker[]
  nextRecommendedHrAction: string
  reportText: string
  copyPayloads: {
    scenarioSummary: string
    projectedActionPlan: string
    markdown: string
    tsv: string
  }
}

export type Evaluation2026ReadinessScenarioPreset = {
  id:
    | 'MBO_FIRST_REMINDER'
    | 'TEAM_KPI_POLICY_CATEGORY_CLEANUP'
    | 'EVALUATOR_ROUTING_FIRST_CLEANUP'
    | 'HR_PRIORITY_ACTIONS_COMPLETE'
    | 'FULL_READINESS_TARGET'
  name: string
  description: string
  input: Evaluation2026ReadinessScenarioInput
}

export type Evaluation2026ReadinessScenarioSimulator = {
  mode: 'READ_ONLY'
  generatedAt: string
  disclaimer: string
  baselineCounts: Evaluation2026ReadinessScenarioProjectedCounts
  scenarioInputModel: Evaluation2026ReadinessScenarioInput
  presets: Evaluation2026ReadinessScenarioPreset[]
  presetScenarios: Evaluation2026ReadinessScenarioProjection[]
  defaultScenario: Evaluation2026ReadinessScenarioProjection
  prohibitedActions: string[]
  copyPayloads: {
    baselineSummary: string
    presetSummary: string
    prohibitedActions: string
    markdown: string
    tsv: string
  }
  safety: {
    writesPerformed: false
    metadataSaved: false
    notificationsSent: false
    emailsSent: false
    backfillExecuted: false
    migrationsRun: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    noActivationButtons: true
    noMetadataSaveButtons: true
    noBackfillExecutionButtons: true
    noScoreGradeWriteButtons: true
  }
}

const PROHIBITED_ACTIONS = [
  'backfill --apply',
  'official scoring activation',
  'official grade activation',
  'AI score exclusion activation',
  'Evaluation.totalScore write',
  'Evaluation.gradeId write',
  'feature flag changes',
  'production data mutation',
  'backfill execution from UI',
  'score/grade write from UI',
]

const DISCLAIMER =
  '이 시뮬레이션은 readiness planning용 추정입니다. 실제 blocker count는 운영 데이터 저장 후 다시 산출해야 합니다.'

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function nullableSub(value: number | null, reduction: number) {
  if (value == null) return null
  return Math.max(value - Math.max(reduction, 0), 0)
}

function nullableAddCapped(value: number | null, increase: number, cap: number | null) {
  if (value == null) return null
  const next = value + Math.max(increase, 0)
  return cap == null ? next : Math.min(next, cap)
}

function confirmedKpiShortage(active: number | null, confirmed: number | null) {
  if (active == null || confirmed == null) return null
  return Math.max(active - confirmed, 0)
}

function emptyInput(): Evaluation2026ReadinessScenarioInput {
  return {
    mboMissingReduction: 0,
    confirmedKpiIncrease: 0,
    teamKpiPendingReduction: 0,
    policyCategoryMissingReduction: 0,
    evaluatorRoutingBlockerReduction: 0,
    leaderEvaluationBlockerReduction: 0,
    resultWritingWarningReduction: 0,
    scorePolicyBlockerReduction: 0,
    gradePolicyBlockerReduction: 0,
    feedbackLeadershipBlockerReduction: 0,
    finalizationCeoBlockerReduction: 0,
  }
}

function baselineCounts(snapshot: Evaluation2026IntegratedReadinessSnapshot): Evaluation2026ReadinessScenarioProjectedCounts {
  return {
    activeEmployeeCount: snapshot.summary.activeEmployeeCount,
    confirmedPersonalKpiCount: snapshot.summary.confirmedPersonalKpiCount,
    confirmedPersonalKpiShortageCount: confirmedKpiShortage(
      snapshot.summary.activeEmployeeCount,
      snapshot.summary.confirmedPersonalKpiCount
    ),
    missingMboCount: snapshot.summary.missingMboCount,
    teamKpiPendingCount: snapshot.summary.teamKpiPendingCount,
    policyCategoryMissingCount: snapshot.summary.policyCategoryMissingCount,
    evaluatorRoutingBlockerCount: snapshot.summary.evaluatorRoutingBlockerCount,
    leaderEvaluationBlockerCount: snapshot.summary.leaderEvaluationBlockerCount,
    resultWritingWarningCount: snapshot.summary.resultWritingBlockerCount,
    scorePolicyBlockerCount: snapshot.summary.scorePolicyBlockerCount,
    gradePolicyBlockerCount: snapshot.summary.gradePolicyBlockerCount,
    feedbackLeadershipBlockerCount: snapshot.summary.feedbackLeadershipBlockerCount,
    finalizationCeoBlockerCount: snapshot.summary.finalizationCeoBlockerCount,
    officialActivationGateBlockerCount: snapshot.summary.officialActivationGateBlockerCount,
    estimatedOfficialGateBlockerCount: snapshot.summary.officialActivationGateBlockerCount,
    estimatedOfficialGateImpact: 0,
  }
}

function totalDirectReduction(input: Evaluation2026ReadinessScenarioInput) {
  return Object.values(input).reduce((sum, value) => sum + Math.max(value, 0), 0)
}

function projectCounts(
  base: Evaluation2026ReadinessScenarioProjectedCounts,
  input: Evaluation2026ReadinessScenarioInput
): Evaluation2026ReadinessScenarioProjectedCounts {
  const confirmedPersonalKpiCount = nullableAddCapped(
    base.confirmedPersonalKpiCount,
    input.confirmedKpiIncrease,
    base.activeEmployeeCount
  )
  const estimatedImpact = totalDirectReduction(input)
  return {
    activeEmployeeCount: base.activeEmployeeCount,
    confirmedPersonalKpiCount,
    confirmedPersonalKpiShortageCount: confirmedKpiShortage(base.activeEmployeeCount, confirmedPersonalKpiCount),
    missingMboCount: nullableSub(base.missingMboCount, input.mboMissingReduction),
    teamKpiPendingCount: nullableSub(base.teamKpiPendingCount, input.teamKpiPendingReduction),
    policyCategoryMissingCount: nullableSub(base.policyCategoryMissingCount, input.policyCategoryMissingReduction),
    evaluatorRoutingBlockerCount: nullableSub(base.evaluatorRoutingBlockerCount, input.evaluatorRoutingBlockerReduction),
    leaderEvaluationBlockerCount: nullableSub(base.leaderEvaluationBlockerCount, input.leaderEvaluationBlockerReduction),
    resultWritingWarningCount: nullableSub(base.resultWritingWarningCount, input.resultWritingWarningReduction),
    scorePolicyBlockerCount: nullableSub(base.scorePolicyBlockerCount, input.scorePolicyBlockerReduction),
    gradePolicyBlockerCount: nullableSub(base.gradePolicyBlockerCount, input.gradePolicyBlockerReduction),
    feedbackLeadershipBlockerCount: nullableSub(base.feedbackLeadershipBlockerCount, input.feedbackLeadershipBlockerReduction),
    finalizationCeoBlockerCount: nullableSub(base.finalizationCeoBlockerCount, input.finalizationCeoBlockerReduction),
    officialActivationGateBlockerCount: base.officialActivationGateBlockerCount,
    estimatedOfficialGateBlockerCount: base.officialActivationGateBlockerCount == null
      ? null
      : Math.max(base.officialActivationGateBlockerCount - estimatedImpact, 0),
    estimatedOfficialGateImpact: estimatedImpact,
  }
}

function delta(
  code: string,
  label: string,
  baselineCount: number | null,
  projectedCount: number | null,
  note = '해당 blocker만 보수적으로 감소 가정'
): Evaluation2026ReadinessScenarioDelta {
  return {
    blockerCode: code,
    label,
    baselineCount,
    projectedCount,
    delta: baselineCount == null || projectedCount == null ? null : projectedCount - baselineCount,
    note,
  }
}

function determineProjectedStage(counts: Evaluation2026ReadinessScenarioProjectedCounts): Evaluation2026IntegratedReadinessStage {
  if (valueOrZero(counts.missingMboCount) > 0 || valueOrZero(counts.confirmedPersonalKpiShortageCount) > 0) {
    return 'MBO_SETUP_IN_PROGRESS'
  }
  if (
    valueOrZero(counts.policyCategoryMissingCount) > 0 ||
    valueOrZero(counts.teamKpiPendingCount) > 0 ||
    valueOrZero(counts.scorePolicyBlockerCount) > 0
  ) {
    return 'POLICY_MAPPING_IN_PROGRESS'
  }
  if (valueOrZero(counts.evaluatorRoutingBlockerCount) > 0) return 'REVIEWER_ASSIGNMENT_IN_PROGRESS'
  if (valueOrZero(counts.resultWritingWarningCount) > 0) return 'RESULT_WRITING_NOT_READY'
  if (valueOrZero(counts.officialActivationGateBlockerCount) > 0) return 'OFFICIAL_ACTIVATION_BLOCKED'
  return 'READY_FOR_HR_REVIEW'
}

function remainingBlockers(counts: Evaluation2026ReadinessScenarioProjectedCounts): Evaluation2026IntegratedReadinessBlocker[] {
  const blockers: Evaluation2026IntegratedReadinessBlocker[] = [
    {
      code: 'MISSING_MBO',
      name: 'MBO 없음',
      count: valueOrZero(counts.missingMboCount),
      sourcePanel: 'MBO setup readiness',
      nextHrAction: '미작성자 작성 요청을 계속 진행하세요.',
      relatedRoute: '/kpi/personal',
    },
    {
      code: 'CONFIRMED_PERSONAL_KPI_COVERAGE_LOW',
      name: '확정 PersonalKpi coverage 부족',
      count: valueOrZero(counts.confirmedPersonalKpiShortageCount),
      sourcePanel: 'MBO setup readiness',
      nextHrAction: '초안 제출과 리더 검토/확정을 요청하세요.',
      relatedRoute: '/evaluation/performance',
    },
    {
      code: 'EVALUATOR_ROUTING_BLOCKERS',
      name: '평가자 배정 blocker',
      count: valueOrZero(counts.evaluatorRoutingBlockerCount),
      sourcePanel: '2026 평가자 배정 readiness QA',
      nextHrAction: '평가자 누락/조직 경로 이슈를 확인하세요.',
      relatedRoute: '/admin/performance-assignments',
    },
    {
      code: 'TEAM_KPI_REVIEW_PENDING',
      name: 'Team KPI HR review pending/discussion',
      count: valueOrZero(counts.teamKpiPendingCount),
      sourcePanel: '2026 팀 KPI 검토',
      nextHrAction: 'Team KPI pending/discussion 항목을 검토하세요.',
      relatedRoute: '/evaluation/performance',
    },
    {
      code: 'POLICY_CATEGORY_MISSING',
      name: 'policyCategory 미분류',
      count: valueOrZero(counts.policyCategoryMissingCount),
      sourcePanel: '2026 정책 매핑 관리',
      nextHrAction: '미분류 항목을 HR 기준으로 확정하세요.',
      relatedRoute: '/evaluation/performance',
    },
    {
      code: 'LEADER_EVALUATION_BLOCKERS',
      name: '리더 평가 readiness blocker',
      count: valueOrZero(counts.leaderEvaluationBlockerCount),
      sourcePanel: '2026 리더 평가 readiness',
      nextHrAction: 'FIRST/SECOND review prerequisite을 확인하세요.',
      relatedRoute: '/evaluation/performance',
    },
    {
      code: 'FINALIZATION_CEO_BLOCKERS',
      name: '최종/CEO readiness blocker',
      count: valueOrZero(counts.finalizationCeoBlockerCount),
      sourcePanel: '2026 최종 확정 readiness',
      nextHrAction: '최종/CEO readiness blocker를 확인하세요.',
      relatedRoute: '/evaluation/performance',
    },
    {
      code: 'OFFICIAL_ACTIVATION_GATE_BLOCKERS',
      name: '공식 전환 gate blocker',
      count: valueOrZero(counts.officialActivationGateBlockerCount),
      sourcePanel: '2026 공식 전환 Gate',
      nextHrAction: 'dry-run, DB backup, HR approval, Runbook 단계를 확인하세요.',
      relatedRoute: '/evaluation/performance',
    },
  ]
  return blockers.filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
}

function projectedOverallStatus(stage: Evaluation2026IntegratedReadinessStage): Evaluation2026IntegratedReadinessStatus {
  if (stage === 'READY_FOR_HR_REVIEW') return 'READY_LATER'
  return 'NEEDS_HR_ACTION'
}

function buildScenarioTsv(projection: Evaluation2026ReadinessScenarioProjection) {
  const header = ['blocker', 'baselineCount', 'projectedCount', 'delta', 'note'].join('\t')
  const rows = projection.deltaByBlocker.map((item) => [
    item.label,
    item.baselineCount == null ? '미확인' : String(item.baselineCount),
    item.projectedCount == null ? '미확인' : String(item.projectedCount),
    item.delta == null ? '미확인' : String(item.delta),
    item.note,
  ].join('\t'))
  return [header, ...rows].join('\n')
}

function buildProjection(
  id: string,
  name: string,
  description: string,
  base: Evaluation2026ReadinessScenarioProjectedCounts,
  input: Evaluation2026ReadinessScenarioInput
): Evaluation2026ReadinessScenarioProjection {
  const projectedCounts = projectCounts(base, input)
  const projectedCurrentStage = determineProjectedStage(projectedCounts)
  const remaining = remainingBlockers(projectedCounts)
  const deltaByBlocker = [
    delta('MISSING_MBO', 'MBO 없음', base.missingMboCount, projectedCounts.missingMboCount),
    delta(
      'CONFIRMED_PERSONAL_KPI_COVERAGE_LOW',
      '확정 PersonalKpi coverage 부족',
      base.confirmedPersonalKpiShortageCount,
      projectedCounts.confirmedPersonalKpiShortageCount,
      'confirmed KPI 증가만 반영'
    ),
    delta('TEAM_KPI_REVIEW_PENDING', 'Team KPI pending/discussion', base.teamKpiPendingCount, projectedCounts.teamKpiPendingCount),
    delta('POLICY_CATEGORY_MISSING', 'policyCategory 미분류', base.policyCategoryMissingCount, projectedCounts.policyCategoryMissingCount),
    delta('EVALUATOR_ROUTING_BLOCKERS', '평가자 배정 blocker', base.evaluatorRoutingBlockerCount, projectedCounts.evaluatorRoutingBlockerCount),
    delta('LEADER_EVALUATION_BLOCKERS', '리더 평가 readiness blocker', base.leaderEvaluationBlockerCount, projectedCounts.leaderEvaluationBlockerCount),
    delta('RESULT_WRITING_WARNINGS', '수행결과 작성 warning', base.resultWritingWarningCount, projectedCounts.resultWritingWarningCount),
    delta('SCORE_POLICY_BLOCKERS', 'score policy blocker', base.scorePolicyBlockerCount, projectedCounts.scorePolicyBlockerCount),
    delta('GRADE_POLICY_BLOCKERS', 'grade policy blocker', base.gradePolicyBlockerCount, projectedCounts.gradePolicyBlockerCount),
    delta('FEEDBACK_LEADERSHIP_BLOCKERS', '360/리더십 readiness blocker', base.feedbackLeadershipBlockerCount, projectedCounts.feedbackLeadershipBlockerCount),
    delta('FINALIZATION_CEO_BLOCKERS', '최종/CEO readiness blocker', base.finalizationCeoBlockerCount, projectedCounts.finalizationCeoBlockerCount),
    delta(
      'OFFICIAL_ACTIVATION_GATE_BLOCKERS',
      '공식 전환 gate blocker',
      base.officialActivationGateBlockerCount,
      projectedCounts.officialActivationGateBlockerCount,
      `official gate count는 실제 재산출 전까지 고정 표시합니다. 잠재 영향 추정: -${projectedCounts.estimatedOfficialGateImpact}건`
    ),
  ]
  const improvedAreas = deltaByBlocker
    .filter((item) => typeof item.delta === 'number' && item.delta < 0)
    .map((item) => item.label)
  const unchangedAreas = deltaByBlocker
    .filter((item) => item.delta === 0 || item.delta == null)
    .map((item) => item.label)
  const nextRecommendedHrAction = remaining[0]?.nextHrAction ?? 'dry-run, DB backup, HR approval, Runbook 검토를 준비하세요.'
  const decisionReadiness =
    id === 'FULL_READINESS_TARGET' ? 'DRY_RUN_BACKUP_HR_APPROVAL_REQUIRED' : 'READINESS_PLANNING_ONLY'
  const reportText = [
    `이 시나리오는 ${name}를 가정합니다.`,
    `예상 개선 영역은 ${improvedAreas.join(', ') || '없음'}입니다.`,
    `남는 주요 blocker는 ${remaining.slice(0, 5).map((item) => `${item.name} ${item.count}건`).join(', ') || 'readiness blocker 직접 항목 없음'}입니다.`,
    '공식 전환은 여전히 dry-run, DB backup, HR 승인 전까지 차단됩니다.',
    DISCLAIMER,
  ].join(' ')
  const projectedActionPlan = [
    `시나리오: ${name}`,
    `다음 HR action: ${nextRecommendedHrAction}`,
    `projected stage: ${projectedCurrentStage}`,
    `projected overall status: ${projectedOverallStatus(projectedCurrentStage)}`,
    `official activation status: BLOCKED`,
    `prohibited: ${PROHIBITED_ACTIONS.join(', ')}`,
  ].join('\n')
  const markdown = [
    `# 2026 Readiness Scenario Simulator - ${name}`,
    '',
    reportText,
    '',
    '## Projected counts',
    `- MBO missing: ${projectedCounts.missingMboCount ?? '미확인'}`,
    `- confirmed KPI shortage: ${projectedCounts.confirmedPersonalKpiShortageCount ?? '미확인'}`,
    `- Team KPI pending: ${projectedCounts.teamKpiPendingCount ?? '미확인'}`,
    `- policyCategory missing: ${projectedCounts.policyCategoryMissingCount ?? '미확인'}`,
    `- evaluator routing blockers: ${projectedCounts.evaluatorRoutingBlockerCount ?? '미확인'}`,
    `- official gate blockers: ${projectedCounts.officialActivationGateBlockerCount ?? '미확인'} (estimated potential: ${projectedCounts.estimatedOfficialGateBlockerCount ?? '미확인'})`,
    '',
    '## Delta',
    deltaByBlocker.map((item) => `- ${item.label}: ${item.delta ?? '미확인'} (${item.note})`).join('\n'),
    '',
    '## Prohibited actions',
    PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
  ].join('\n')

  return {
    id,
    name,
    description,
    input,
    projectedCounts,
    deltaByBlocker,
    projectedCurrentStage,
    projectedOverallStatus: projectedOverallStatus(projectedCurrentStage),
    officialActivationStatus: 'BLOCKED',
    decisionReadiness,
    improvedAreas,
    unchangedAreas,
    remainingBlockers: remaining.slice(0, 10),
    nextRecommendedHrAction,
    reportText,
    copyPayloads: {
      scenarioSummary: reportText,
      projectedActionPlan,
      markdown,
      tsv: '', // filled below to avoid repeating delta formatting inputs
    },
  }
}

function withTsv(projection: Evaluation2026ReadinessScenarioProjection): Evaluation2026ReadinessScenarioProjection {
  return {
    ...projection,
    copyPayloads: {
      ...projection.copyPayloads,
      tsv: buildScenarioTsv(projection),
    },
  }
}

function buildPresetInput(
  base: Evaluation2026ReadinessScenarioProjectedCounts,
  kind: Evaluation2026ReadinessScenarioPreset['id']
) {
  const input = emptyInput()
  if (kind === 'MBO_FIRST_REMINDER') {
    input.mboMissingReduction = 50
    input.confirmedKpiIncrease = 50
  } else if (kind === 'TEAM_KPI_POLICY_CATEGORY_CLEANUP') {
    input.teamKpiPendingReduction = valueOrZero(base.teamKpiPendingCount)
    input.policyCategoryMissingReduction = valueOrZero(base.policyCategoryMissingCount)
  } else if (kind === 'EVALUATOR_ROUTING_FIRST_CLEANUP') {
    input.evaluatorRoutingBlockerReduction = 100
  } else if (kind === 'HR_PRIORITY_ACTIONS_COMPLETE') {
    input.mboMissingReduction = 100
    input.confirmedKpiIncrease = 100
    input.teamKpiPendingReduction = valueOrZero(base.teamKpiPendingCount)
    input.policyCategoryMissingReduction = valueOrZero(base.policyCategoryMissingCount)
    input.evaluatorRoutingBlockerReduction = 100
  } else if (kind === 'FULL_READINESS_TARGET') {
    input.mboMissingReduction = valueOrZero(base.missingMboCount)
    input.confirmedKpiIncrease = valueOrZero(base.confirmedPersonalKpiShortageCount)
    input.teamKpiPendingReduction = valueOrZero(base.teamKpiPendingCount)
    input.policyCategoryMissingReduction = valueOrZero(base.policyCategoryMissingCount)
    input.evaluatorRoutingBlockerReduction = valueOrZero(base.evaluatorRoutingBlockerCount)
    input.leaderEvaluationBlockerReduction = valueOrZero(base.leaderEvaluationBlockerCount)
    input.resultWritingWarningReduction = valueOrZero(base.resultWritingWarningCount)
    input.scorePolicyBlockerReduction = valueOrZero(base.scorePolicyBlockerCount)
    input.gradePolicyBlockerReduction = valueOrZero(base.gradePolicyBlockerCount)
    input.feedbackLeadershipBlockerReduction = valueOrZero(base.feedbackLeadershipBlockerCount)
    input.finalizationCeoBlockerReduction = valueOrZero(base.finalizationCeoBlockerCount)
  }
  return input
}

export function buildEvaluation2026ReadinessScenarioSimulator(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  readinessActionPlan: Evaluation2026ReadinessActionPlan
  readinessExecutionBoard: Evaluation2026ReadinessExecutionBoard
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026ReadinessScenarioSimulator {
  const base = baselineCounts(params.integratedReadinessSnapshot)
  const presets: Evaluation2026ReadinessScenarioPreset[] = [
    {
      id: 'MBO_FIRST_REMINDER',
      name: 'MBO 작성 1차 독려',
      description: 'MBO 미작성 50건 감소와 confirmed KPI 50건 증가를 가정합니다.',
      input: buildPresetInput(base, 'MBO_FIRST_REMINDER'),
    },
    {
      id: 'TEAM_KPI_POLICY_CATEGORY_CLEANUP',
      name: 'Team KPI / policyCategory 정리',
      description: 'Team KPI pending과 policyCategory 미분류를 0건으로 정리하는 가정입니다.',
      input: buildPresetInput(base, 'TEAM_KPI_POLICY_CATEGORY_CLEANUP'),
    },
    {
      id: 'EVALUATOR_ROUTING_FIRST_CLEANUP',
      name: '평가자 배정 1차 정리',
      description: '평가자 배정 blocker 100건 감소를 가정합니다.',
      input: buildPresetInput(base, 'EVALUATOR_ROUTING_FIRST_CLEANUP'),
    },
    {
      id: 'HR_PRIORITY_ACTIONS_COMPLETE',
      name: 'HR 우선 조치 완료 가정',
      description: 'MBO, Team KPI, policyCategory, 평가자 배정 1차 조치가 함께 진행되는 가정입니다.',
      input: buildPresetInput(base, 'HR_PRIORITY_ACTIONS_COMPLETE'),
    },
    {
      id: 'FULL_READINESS_TARGET',
      name: 'Full readiness target scenario',
      description: '직접 readiness blocker가 모두 0건이 되는 목표 상태를 가정합니다.',
      input: buildPresetInput(base, 'FULL_READINESS_TARGET'),
    },
  ]
  const presetScenarios = presets.map((preset) =>
    withTsv(buildProjection(preset.id, preset.name, preset.description, base, preset.input))
  )
  const defaultScenario = presetScenarios[0]
  const presetSummary = presetScenarios.map((scenario) =>
    `- ${scenario.name}: ${scenario.reportText}`
  ).join('\n')
  const markdown = [
    '# 2026 Readiness Scenario Simulator',
    '',
    DISCLAIMER,
    '',
    '## Baseline',
    `- current stage: ${params.integratedReadinessSnapshot.currentStage}`,
    `- overall status: ${params.integratedReadinessSnapshot.overallStatus}`,
    `- official activation: BLOCKED`,
    `- MBO missing: ${base.missingMboCount ?? '미확인'}`,
    `- confirmed KPI shortage: ${base.confirmedPersonalKpiShortageCount ?? '미확인'}`,
    `- official gate blockers: ${base.officialActivationGateBlockerCount ?? '미확인'}`,
    '',
    '## Presets',
    presetSummary,
    '',
    '## Prohibited actions',
    PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
  const tsv = [
    'scenario\tprojectedStage\tprojectedStatus\tofficialActivationStatus\tnextHrAction',
    ...presetScenarios.map((scenario) => [
      scenario.name,
      scenario.projectedCurrentStage,
      scenario.projectedOverallStatus,
      scenario.officialActivationStatus,
      scenario.nextRecommendedHrAction,
    ].join('\t')),
  ].join('\n')

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    baselineCounts: base,
    scenarioInputModel: emptyInput(),
    presets,
    presetScenarios,
    defaultScenario,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      baselineSummary: markdown.split('## Presets')[0].trim(),
      presetSummary,
      prohibitedActions: PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
      markdown,
      tsv,
    },
    safety: {
      writesPerformed: false,
      metadataSaved: false,
      notificationsSent: false,
      emailsSent: false,
      backfillExecuted: false,
      migrationsRun: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      noActivationButtons: true,
      noMetadataSaveButtons: true,
      noBackfillExecutionButtons: true,
      noScoreGradeWriteButtons: true,
    },
  }
}
