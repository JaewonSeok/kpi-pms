import type {
  Evaluation2026IntegratedReadinessBlocker,
  Evaluation2026IntegratedReadinessSnapshot,
} from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type { Evaluation2026ReadinessActionPlan } from '@/server/evaluation-2026-readiness-action-plan'
import type { Evaluation2026ReadinessExecutionBoard } from '@/server/evaluation-2026-readiness-execution-board'
import type { Evaluation2026ReadinessScenarioSimulator } from '@/server/evaluation-2026-readiness-scenario-simulator'
import type {
  Evaluation2026OfficialActivationGate,
  Evaluation2026OfficialActivationRunbook,
} from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026CeoReportPackStatus = 'READY_FOR_REPORT'

export type Evaluation2026CeoReportOfficialActivationStatus =
  | 'BLOCKED'
  | 'READY_FOR_REVIEW'
  | 'READY_LATER'

export type Evaluation2026CeoReportKeyNumber = {
  id: string
  label: string
  value: number | string | null
  note: string
}

export type Evaluation2026CeoReportTopBlocker = {
  code: string
  name: string
  count: number
  route: string
  sourcePanel: string
  impact: string
  nextHrAction: string
}

export type Evaluation2026CeoReportScenarioComparison = {
  scenarioName: string
  expectedImprovement: string
  remainingBlocker: string
  recommendedInterpretation: string
}

export type Evaluation2026CeoReportPack = {
  mode: 'READ_ONLY'
  generatedAt: string
  reportStatus: Evaluation2026CeoReportPackStatus
  summary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: Evaluation2026CeoReportOfficialActivationStatus
    executiveSummaryText: string
  }
  keyNumbers: Evaluation2026CeoReportKeyNumber[]
  topBlockers: Evaluation2026CeoReportTopBlocker[]
  decisionAgenda: {
    decisionsNeededNow: string[]
    decisionsNotYetAppropriate: string[]
    decisionsExplicitlyProhibited: string[]
  }
  scenarioComparison: Evaluation2026CeoReportScenarioComparison[]
  recommendedExecutionOrder: string[]
  prohibitedActions: string[]
  nextCheckpoint: {
    name: string
    requiredExportedData: string[]
    expectedDeltaTable: string[]
    nextReviewCondition: string
  }
  copyPayloads: {
    executiveSummary: string
    markdownReport: string
    topBlockers: string
    decisionAgenda: string
    scenarioComparison: string
    prohibitedActions: string
    tsvSummary: string
  }
  safety: {
    writesPerformed: false
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

const RECOMMENDED_EXECUTION_ORDER = [
  'MBO 작성 1차 독려',
  '평가자 배정 1차 정리',
  'Team KPI / policyCategory 정리',
  'Snapshot v2 확인',
  'Revisit CEO report',
]

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function valueOrUnconfirmed(value: number | string | null) {
  if (value == null) return '화면 값 확인 필요'
  if (typeof value === 'number') return value.toLocaleString()
  return value
}

function activationStatus(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  gates: Evaluation2026OfficialActivationGate[]
  runbook: Evaluation2026OfficialActivationRunbook
  executionBoard: Evaluation2026ReadinessExecutionBoard
}): Evaluation2026CeoReportOfficialActivationStatus {
  if (valueOrZero(params.snapshot.summary.officialActivationGateBlockerCount) > 0) return 'BLOCKED'
  if (params.gates.some((gate) => gate.status === 'BLOCKED')) return 'BLOCKED'
  if (params.executionBoard.summary.officialActivationStatus === 'BLOCKED') return 'BLOCKED'
  if (params.runbook.summary.readyForReviewSectionCount > 0) return 'READY_FOR_REVIEW'
  return 'READY_LATER'
}

function buildExecutiveSummary(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  officialActivationStatus: Evaluation2026CeoReportOfficialActivationStatus
  topBlockers: Evaluation2026CeoReportTopBlocker[]
}) {
  const blockerText = params.topBlockers.length
    ? params.topBlockers.slice(0, 5).map((item) => `${item.name} ${item.count.toLocaleString()}건`).join(', ')
    : '현재 주요 blocker 없음'
  return [
    `현재 2026 공식 전환 readiness는 ${params.snapshot.currentStage} / ${params.snapshot.overallStatus} 상태입니다.`,
    `공식 전환 상태는 ${params.officialActivationStatus}이며, 주요 차단 요인은 ${blockerText}입니다.`,
    '이번 보고에서는 공식 전환 실행이 아니라 HR 운영 blocker 해소 순서를 확정하는 것이 목적입니다.',
  ].join(' ')
}

function keyNumbers(snapshot: Evaluation2026IntegratedReadinessSnapshot): Evaluation2026CeoReportKeyNumber[] {
  return [
    {
      id: 'ACTIVE_EMPLOYEES',
      label: 'active employees',
      value: snapshot.summary.activeEmployeeCount,
      note: '2026 readiness target scope',
    },
    {
      id: 'CONFIRMED_KPI',
      label: 'confirmed KPI',
      value: snapshot.summary.confirmedPersonalKpiCount,
      note: '확정 PersonalKpi count',
    },
    {
      id: 'CONFIRMED_KPI_RATE',
      label: 'confirmed KPI rate',
      value: snapshot.completionRates.mboConfirmedRate == null ? null : `${snapshot.completionRates.mboConfirmedRate}%`,
      note: 'confirmed KPI / active employees',
    },
    {
      id: 'MBO_MISSING',
      label: 'MBO missing',
      value: snapshot.summary.missingMboCount,
      note: 'MBO setup readiness',
    },
    {
      id: 'POLICY_CATEGORY_MISSING',
      label: 'policyCategory missing',
      value: snapshot.summary.policyCategoryMissingCount,
      note: '2026 정책 매핑 관리',
    },
    {
      id: 'EVALUATOR_ROUTING_BLOCKERS',
      label: 'evaluator routing blockers',
      value: snapshot.summary.evaluatorRoutingBlockerCount,
      note: '2026 평가자 배정 readiness QA',
    },
    {
      id: 'OFFICIAL_GATE_BLOCKERS',
      label: 'official gate blockers',
      value: snapshot.summary.officialActivationGateBlockerCount,
      note: '2026 공식 전환 Gate',
    },
    {
      id: 'LEADER_EVALUATION_BLOCKERS',
      label: 'leader evaluation blockers',
      value: snapshot.summary.leaderEvaluationBlockerCount,
      note: '2026 리더 평가 readiness',
    },
    {
      id: 'FEEDBACK_LEADERSHIP_BLOCKERS',
      label: '360/leadership blockers',
      value: snapshot.summary.feedbackLeadershipBlockerCount,
      note: '2026 360/리더십 readiness',
    },
    {
      id: 'TEAM_KPI_PENDING',
      label: 'Team KPI pending',
      value: snapshot.summary.teamKpiPendingCount,
      note: '2026 팀 KPI 검토',
    },
    {
      id: 'SCORE_POLICY_BLOCKERS',
      label: 'score policy blockers',
      value: snapshot.summary.scorePolicyBlockerCount,
      note: '2026 성과점수 정책 readiness',
    },
    {
      id: 'RESULT_WRITING_WARNINGS',
      label: 'result-writing warnings',
      value: snapshot.summary.resultWritingBlockerCount,
      note: '2026 수행결과 작성 readiness',
    },
  ]
}

function blockerImpact(blocker: Evaluation2026IntegratedReadinessBlocker) {
  if (blocker.code === 'OFFICIAL_ACTIVATION_GATE_BLOCKERS') {
    return '공식 전환 실행 논의를 차단합니다.'
  }
  if (blocker.code === 'EVALUATOR_ROUTING_BLOCKERS') {
    return 'FIRST/SECOND/FINAL 평가 흐름 준비를 지연시킵니다.'
  }
  if (blocker.code === 'MISSING_MBO' || blocker.code === 'CONFIRMED_PERSONAL_KPI_COVERAGE_LOW') {
    return 'MBO setup stage를 유지시키는 핵심 blocker입니다.'
  }
  if (blocker.code === 'TEAM_KPI_REVIEW_PENDING' || blocker.code === 'POLICY_CATEGORY_MISSING') {
    return '정책 매핑과 score policy readiness 판단을 지연시킵니다.'
  }
  return '공식 전환 readiness review 전 해소 또는 확인이 필요합니다.'
}

function topBlockers(snapshot: Evaluation2026IntegratedReadinessSnapshot): Evaluation2026CeoReportTopBlocker[] {
  return snapshot.topBlockers.slice(0, 10).map((blocker) => ({
    code: blocker.code,
    name: blocker.name,
    count: blocker.count,
    route: blocker.relatedRoute,
    sourcePanel: blocker.sourcePanel,
    impact: blockerImpact(blocker),
    nextHrAction: blocker.nextHrAction,
  }))
}

function buildScenarioComparison(
  simulator: Evaluation2026ReadinessScenarioSimulator
): Evaluation2026CeoReportScenarioComparison[] {
  return simulator.presetScenarios.map((scenario) => {
    const improved = scenario.improvedAreas.length ? scenario.improvedAreas.join(', ') : '직접 개선 없음'
    const remaining = scenario.remainingBlockers.length
      ? scenario.remainingBlockers.slice(0, 3).map((item) => `${item.name} ${item.count.toLocaleString()}건`).join(', ')
      : '직접 readiness blocker 없음'
    const recommendedInterpretation =
      scenario.id === 'FULL_READINESS_TARGET'
        ? '직접 blocker가 0건이어도 dry-run, DB backup, HR 승인, Runbook 검토 전까지 공식 전환은 실행하지 않습니다.'
        : `${scenario.nextRecommendedHrAction} 실제 blocker count는 운영 데이터 저장 후 다시 산출해야 합니다.`
    return {
      scenarioName: scenario.name,
      expectedImprovement: improved,
      remainingBlocker: remaining,
      recommendedInterpretation,
    }
  })
}

function buildTopBlockersText(blockers: Evaluation2026CeoReportTopBlocker[]) {
  if (!blockers.length) return '현재 CEO report 기준 주요 blocker가 없습니다.'
  return blockers.map((item) =>
    `- ${item.name}: ${item.count.toLocaleString()}건 · ${item.sourcePanel} · ${item.impact} · ${item.nextHrAction} (${item.route})`
  ).join('\n')
}

function buildAgendaText(agenda: Evaluation2026CeoReportPack['decisionAgenda']) {
  return [
    '## Decisions needed now',
    agenda.decisionsNeededNow.map((item) => `- ${item}`).join('\n'),
    '',
    '## Decisions not yet appropriate',
    agenda.decisionsNotYetAppropriate.map((item) => `- ${item}`).join('\n'),
    '',
    '## Decisions explicitly prohibited',
    agenda.decisionsExplicitlyProhibited.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
}

function buildScenarioText(items: Evaluation2026CeoReportScenarioComparison[]) {
  return items.map((item) => [
    `- ${item.scenarioName}`,
    `  expected improvement: ${item.expectedImprovement}`,
    `  remaining blocker: ${item.remainingBlocker}`,
    `  interpretation: ${item.recommendedInterpretation}`,
  ].join('\n')).join('\n')
}

function buildTsv(params: {
  keyNumbers: Evaluation2026CeoReportKeyNumber[]
  topBlockers: Evaluation2026CeoReportTopBlocker[]
  scenarios: Evaluation2026CeoReportScenarioComparison[]
}) {
  const keyNumberRows = params.keyNumbers.map((item) => [
    'key_number',
    item.label,
    valueOrUnconfirmed(item.value),
    item.note,
    '',
  ].join('\t'))
  const blockerRows = params.topBlockers.map((item) => [
    'top_blocker',
    item.name,
    item.count.toLocaleString(),
    item.sourcePanel,
    item.nextHrAction,
  ].join('\t'))
  const scenarioRows = params.scenarios.map((item) => [
    'scenario',
    item.scenarioName,
    item.expectedImprovement,
    item.remainingBlocker,
    item.recommendedInterpretation,
  ].join('\t'))
  return [
    ['section', 'name', 'value_or_improvement', 'source_or_remaining', 'next_action_or_interpretation'].join('\t'),
    ...keyNumberRows,
    ...blockerRows,
    ...scenarioRows,
  ].join('\n')
}

function buildMarkdown(params: {
  summaryText: string
  keyNumbers: Evaluation2026CeoReportKeyNumber[]
  topBlockersText: string
  agendaText: string
  scenarioText: string
  recommendedExecutionOrder: string[]
  prohibitedActions: string[]
  nextCheckpoint: Evaluation2026CeoReportPack['nextCheckpoint']
}) {
  return [
    '# 2026 대표이사 보고 Pack',
    '',
    '## Executive summary',
    params.summaryText,
    '',
    '## Key numbers',
    params.keyNumbers.map((item) => `- ${item.label}: ${valueOrUnconfirmed(item.value)} (${item.note})`).join('\n'),
    '',
    '## Top blockers',
    params.topBlockersText,
    '',
    '## CEO decision agenda',
    params.agendaText,
    '',
    '## Scenario comparison',
    params.scenarioText,
    '',
    '## Recommended execution order',
    params.recommendedExecutionOrder.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    '',
    '## Prohibited actions',
    params.prohibitedActions.map((item) => `- ${item}`).join('\n'),
    '',
    '## Next checkpoint',
    `- name: ${params.nextCheckpoint.name}`,
    `- required exported data: ${params.nextCheckpoint.requiredExportedData.join(', ')}`,
    `- expected delta table: ${params.nextCheckpoint.expectedDeltaTable.join(', ')}`,
    `- next review condition: ${params.nextCheckpoint.nextReviewCondition}`,
  ].join('\n')
}

export function buildEvaluation2026CeoReportPack(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  readinessActionPlan: Evaluation2026ReadinessActionPlan
  readinessExecutionBoard: Evaluation2026ReadinessExecutionBoard
  readinessScenarioSimulator: Evaluation2026ReadinessScenarioSimulator
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
  officialActivationGates: Evaluation2026OfficialActivationGate[]
}): Evaluation2026CeoReportPack {
  const snapshot = params.integratedReadinessSnapshot
  const officialStatus = activationStatus({
    snapshot,
    gates: params.officialActivationGates,
    runbook: params.officialActivationRunbook,
    executionBoard: params.readinessExecutionBoard,
  })
  const blockers = topBlockers(snapshot)
  const summaryText = buildExecutiveSummary({
    snapshot,
    officialActivationStatus: officialStatus,
    topBlockers: blockers,
  })
  const numbers = keyNumbers(snapshot)
  const agenda: Evaluation2026CeoReportPack['decisionAgenda'] = {
    decisionsNeededNow: [
      '공식 전환은 현재 BLOCKED 상태임을 확인합니다.',
      'HR은 MBO completion과 evaluator routing을 우선 처리합니다.',
      'Team KPI / policyCategory 결정은 readiness metadata 정리 범위에서만 진행합니다.',
      '다음 checkpoint는 updated integrated readiness snapshot과 Execution Board export 이후로 설정합니다.',
    ],
    decisionsNotYetAppropriate: [
      'backfill apply 일정 확정',
      'official scoring activation 일정 확정',
      'official grade activation 일정 확정',
      'Evaluation.totalScore 또는 Evaluation.gradeId write 승인',
    ],
    decisionsExplicitlyProhibited: PROHIBITED_ACTIONS,
  }
  const scenarios = buildScenarioComparison(params.readinessScenarioSimulator)
  const nextCheckpoint: Evaluation2026CeoReportPack['nextCheckpoint'] = {
    name: 'Snapshot v2 / CEO report refresh',
    requiredExportedData: [
      '2026 통합 readiness snapshot Markdown',
      '2026 Readiness Execution Board executive weekly report',
      '2026 Readiness Scenario Simulator selected scenario export',
    ],
    expectedDeltaTable: [
      'MBO missing delta',
      'confirmed KPI shortage delta',
      'evaluator routing blocker delta',
      'Team KPI pending delta',
      'policyCategory missing delta',
      'official gate blocker delta',
    ],
    nextReviewCondition: 'MBO 1차 독려, 평가자 배정 1차 정리, Team KPI/policyCategory 정리 후 updated snapshot을 다시 확인합니다.',
  }
  const topBlockersText = buildTopBlockersText(blockers)
  const agendaText = buildAgendaText(agenda)
  const scenarioText = buildScenarioText(scenarios)
  const tsvSummary = buildTsv({
    keyNumbers: numbers,
    topBlockers: blockers,
    scenarios,
  })
  const markdownReport = buildMarkdown({
    summaryText,
    keyNumbers: numbers,
    topBlockersText,
    agendaText,
    scenarioText,
    recommendedExecutionOrder: RECOMMENDED_EXECUTION_ORDER,
    prohibitedActions: PROHIBITED_ACTIONS,
    nextCheckpoint,
  })

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    reportStatus: 'READY_FOR_REPORT',
    summary: {
      currentStage: snapshot.currentStage,
      overallReadinessStatus: snapshot.overallStatus,
      officialActivationStatus: officialStatus,
      executiveSummaryText: summaryText,
    },
    keyNumbers: numbers,
    topBlockers: blockers,
    decisionAgenda: agenda,
    scenarioComparison: scenarios,
    recommendedExecutionOrder: RECOMMENDED_EXECUTION_ORDER,
    prohibitedActions: PROHIBITED_ACTIONS,
    nextCheckpoint,
    copyPayloads: {
      executiveSummary: summaryText,
      markdownReport,
      topBlockers: topBlockersText,
      decisionAgenda: agendaText,
      scenarioComparison: scenarioText,
      prohibitedActions: PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
      tsvSummary,
    },
    safety: {
      writesPerformed: false,
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
      noBackfillExecutionButtons: true,
      noScoreGradeWriteButtons: true,
    },
  }
}
