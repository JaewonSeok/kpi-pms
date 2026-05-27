import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'

export type Evaluation2026ReadinessActionPriority = 'P0' | 'P1' | 'P2'
export type Evaluation2026ReadinessActionOwner = 'HR' | 'LEADER' | 'EMPLOYEE' | 'DEV'
export type Evaluation2026ReadinessActionStatus =
  | 'BLOCKED'
  | 'READY_TO_START'
  | 'WAITING_FOR_DATA'
  | 'WATCH_ONLY'

export type Evaluation2026ReadinessActionItem = {
  id: string
  priority: Evaluation2026ReadinessActionPriority
  ownerGroup: Evaluation2026ReadinessActionOwner
  title: string
  reason: string
  relatedBlockerCount: number | null
  relatedRoute: string
  expectedOutcome: string
  prohibitedActions: string[]
  suggestedCommunicationCopy?: string
  status: Evaluation2026ReadinessActionStatus
}

export type Evaluation2026ReadinessActionPlan = {
  mode: 'READ_ONLY'
  generatedAt: string
  currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
  overallStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
  actionGroups: {
    hr: Evaluation2026ReadinessActionItem[]
    leader: Evaluation2026ReadinessActionItem[]
    employee: Evaluation2026ReadinessActionItem[]
    developer: Evaluation2026ReadinessActionItem[]
  }
  thisWeekFocus: Evaluation2026ReadinessActionItem[]
  reportText: string
  prohibitedActions: string[]
  copyPayloads: {
    hrActionPlan: string
    leaderActionPlan: string
    employeeActionPlan: string
    developerWatchPlan: string
    fullActionBoard: string
    markdown: string
    tsv: string
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
    noMetadataSaveButtons: true
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
]

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function statusForCount(
  count: number | null | undefined,
  fallback: Evaluation2026ReadinessActionStatus = 'READY_TO_START'
): Evaluation2026ReadinessActionStatus {
  if (count == null) return 'WAITING_FOR_DATA'
  return count > 0 ? fallback : 'WAITING_FOR_DATA'
}

function confirmedKpiMissingCount(snapshot: Evaluation2026IntegratedReadinessSnapshot) {
  const active = snapshot.summary.activeEmployeeCount
  const confirmed = snapshot.summary.confirmedPersonalKpiCount
  if (active == null || confirmed == null) return null
  return Math.max(active - confirmed, 0)
}

function action(params: Omit<Evaluation2026ReadinessActionItem, 'prohibitedActions'>): Evaluation2026ReadinessActionItem {
  return {
    ...params,
    prohibitedActions: PROHIBITED_ACTIONS,
  }
}

function addWhenPresent(target: Evaluation2026ReadinessActionItem[], item: Evaluation2026ReadinessActionItem) {
  if (item.relatedBlockerCount == null || item.relatedBlockerCount > 0 || item.status === 'WATCH_ONLY') {
    target.push(item)
  }
}

function priorityWeight(priority: Evaluation2026ReadinessActionPriority) {
  if (priority === 'P0') return 0
  if (priority === 'P1') return 1
  return 2
}

function sortActions(items: Evaluation2026ReadinessActionItem[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = priorityWeight(a.priority) - priorityWeight(b.priority)
    if (priorityDiff !== 0) return priorityDiff
    return valueOrZero(b.relatedBlockerCount) - valueOrZero(a.relatedBlockerCount)
  })
}

function buildActionText(items: Evaluation2026ReadinessActionItem[]) {
  if (!items.length) return '현재 표시할 action item이 없습니다.'
  return items.map((item) => [
    `- [${item.priority}] ${item.title}`,
    `  owner: ${item.ownerGroup}`,
    `  status: ${item.status}`,
    `  blocker: ${item.relatedBlockerCount == null ? '미확인' : `${item.relatedBlockerCount}건`}`,
    `  route: ${item.relatedRoute}`,
    `  expected: ${item.expectedOutcome}`,
  ].join('\n')).join('\n')
}

function buildTsv(items: Evaluation2026ReadinessActionItem[]) {
  const header = [
    'priority',
    'ownerGroup',
    'status',
    'title',
    'relatedBlockerCount',
    'relatedRoute',
    'expectedOutcome',
    'prohibitedActions',
  ].join('\t')
  const rows = items.map((item) => [
    item.priority,
    item.ownerGroup,
    item.status,
    item.title,
    item.relatedBlockerCount == null ? '미확인' : String(item.relatedBlockerCount),
    item.relatedRoute,
    item.expectedOutcome,
    item.prohibitedActions.join(', '),
  ].join('\t'))
  return [header, ...rows].join('\n')
}

function buildReportText(snapshot: Evaluation2026IntegratedReadinessSnapshot, hrActions: Evaluation2026ReadinessActionItem[]) {
  const priorityText = hrActions.slice(0, 5).map((item) => item.title).join(', ')
  return [
    `현재 2026 readiness는 ${snapshot.currentStage} 단계이며 ${snapshot.overallStatus} 상태입니다.`,
    `우선순위는 ${priorityText || 'readiness blocker 재확인'}입니다.`,
    '공식 전환 관련 실행은 모두 금지 상태입니다.',
  ].join(' ')
}

function buildThisWeekFocus(
  snapshot: Evaluation2026IntegratedReadinessSnapshot,
  actions: Evaluation2026ReadinessActionItem[]
) {
  if (snapshot.currentStage !== 'MBO_SETUP_IN_PROGRESS') return actions.slice(0, 5)

  const focusIds = [
    'HR_MISSING_MBO_REQUEST',
    'HR_DRAFT_SUBMIT_REQUEST',
    'HR_TEAM_KPI_REVIEW',
    'HR_POLICY_CATEGORY_CONFIRM',
    'HR_EVALUATOR_ROUTING_REVIEW',
  ]
  return focusIds
    .map((id) => actions.find((item) => item.id === id))
    .filter((item): item is Evaluation2026ReadinessActionItem => Boolean(item))
}

export function buildEvaluation2026ReadinessActionPlan(
  snapshot: Evaluation2026IntegratedReadinessSnapshot
): Evaluation2026ReadinessActionPlan {
  const missingMboCount = snapshot.summary.missingMboCount
  const missingConfirmedCount = confirmedKpiMissingCount(snapshot)
  const policyCategoryMissingCount = snapshot.summary.policyCategoryMissingCount
  const teamKpiPendingCount = snapshot.summary.teamKpiPendingCount
  const evaluatorRoutingBlockerCount = snapshot.summary.evaluatorRoutingBlockerCount
  const resultWritingBlockerCount = snapshot.summary.resultWritingBlockerCount
  const leaderEvaluationBlockerCount = snapshot.summary.leaderEvaluationBlockerCount
  const finalizationCeoBlockerCount = snapshot.summary.finalizationCeoBlockerCount
  const aiReadinessBlockerCount = snapshot.summary.aiReadinessBlockerCount
  const feedbackLeadershipBlockerCount = snapshot.summary.feedbackLeadershipBlockerCount
  const officialGateBlockerCount = snapshot.summary.officialActivationGateBlockerCount

  const hr: Evaluation2026ReadinessActionItem[] = []
  addWhenPresent(hr, action({
    id: 'HR_MISSING_MBO_REQUEST',
    priority: 'P0',
    ownerGroup: 'HR',
    title: 'MBO 미작성자 작성 요청',
    reason: 'MBO가 없는 직원은 2026 readiness의 첫 번째 blocker입니다.',
    relatedBlockerCount: missingMboCount,
    relatedRoute: '/kpi/personal',
    expectedOutcome: '미작성자가 2026 MBO 초안을 작성합니다.',
    suggestedCommunicationCopy: '2026 MBO 작성이 아직 시작되지 않았습니다. /kpi/personal에서 2026 MBO 초안을 작성해 주세요.',
    status: statusForCount(missingMboCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_DRAFT_SUBMIT_REQUEST',
    priority: 'P0',
    ownerGroup: 'HR',
    title: '초안 보유자 제출 요청',
    reason: '확정 KPI coverage가 낮아 공식 전환 논의가 불가능합니다.',
    relatedBlockerCount: missingConfirmedCount,
    relatedRoute: '/kpi/personal',
    expectedOutcome: '초안 보유자가 MBO를 제출하고 리더 검토 대상으로 이동합니다.',
    suggestedCommunicationCopy: '2026 MBO 초안을 보유한 경우 제출까지 완료해 주세요. 제출 후 리더 검토가 진행됩니다.',
    status: statusForCount(missingConfirmedCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_TEAM_KPI_REVIEW',
    priority: 'P1',
    ownerGroup: 'HR',
    title: 'Team KPI pending 검토',
    reason: 'Team KPI HR review가 남아 있으면 ORG_GOAL source 판정이 불완전합니다.',
    relatedBlockerCount: teamKpiPendingCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '팀 KPI별 조직목표 반영/일상업무/예외/논의 필요 결정이 완료됩니다.',
    suggestedCommunicationCopy: '팀 KPI별로 조직목표 반영, 일상업무 처리, 예외 승인, 논의 필요 여부를 결정해 주세요.',
    status: statusForCount(teamKpiPendingCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_POLICY_CATEGORY_CONFIRM',
    priority: 'P1',
    ownerGroup: 'HR',
    title: 'policyCategory 미분류 확정',
    reason: 'policyCategory 미분류 항목은 score policy와 readiness gate의 blocker입니다.',
    relatedBlockerCount: policyCategoryMissingCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 분류가 HR 확인 상태가 됩니다.',
    suggestedCommunicationCopy: 'policyCategory 미분류 항목을 ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 중 하나로 확정해 주세요.',
    status: statusForCount(policyCategoryMissingCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_EVALUATOR_ROUTING_REVIEW',
    priority: 'P0',
    ownerGroup: 'HR',
    title: '평가자 배정 blocker 확인',
    reason: 'FIRST/SECOND/FINAL evaluator chain이 없으면 공식 평가 준비가 막힙니다.',
    relatedBlockerCount: evaluatorRoutingBlockerCount,
    relatedRoute: '/admin/performance-assignments',
    expectedOutcome: '평가자 누락, inactive evaluator, manager missing, manual review 항목이 정리됩니다.',
    suggestedCommunicationCopy: '평가자 배정 readiness에서 누락된 FIRST/SECOND/FINAL 평가자와 조직 경로 이슈를 확인해 주세요.',
    status: statusForCount(evaluatorRoutingBlockerCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_FEEDBACK_LEADERSHIP_REVIEW',
    priority: 'P2',
    ownerGroup: 'HR',
    title: '360/리더십 readiness 확인',
    reason: '2차 다면평가와 리더십 진단 readiness는 공식 grade/finalization 전 확인 대상입니다.',
    relatedBlockerCount: feedbackLeadershipBlockerCount,
    relatedRoute: '/admin/performance-calendar',
    expectedOutcome: '대상자, reviewer assignment, response readiness 상태가 확인됩니다.',
    status: statusForCount(feedbackLeadershipBlockerCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_AI_READINESS_REVIEW',
    priority: 'P2',
    ownerGroup: 'HR',
    title: 'AI Pass/Fail readiness 확인',
    reason: 'AI 활용평가는 연간 업적점수와 별도 정책으로 readiness를 확인해야 합니다.',
    relatedBlockerCount: aiReadinessBlockerCount,
    relatedRoute: '/evaluation/ai-competency/admin',
    expectedOutcome: 'AI evidence readiness와 Pass/Fail 분리 운영 상태가 확인됩니다.',
    status: statusForCount(aiReadinessBlockerCount),
  }))
  addWhenPresent(hr, action({
    id: 'HR_FINALIZATION_READINESS_REVIEW',
    priority: 'P1',
    ownerGroup: 'HR',
    title: '최종 확정 readiness blocker 확인',
    reason: '최종/CEO readiness blocker는 공식 grade/finalization 논의 전에 확인되어야 합니다.',
    relatedBlockerCount: finalizationCeoBlockerCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'finalization, CEO confirmation, calibration blocker가 action plan에 반영됩니다.',
    status: statusForCount(finalizationCeoBlockerCount),
  }))

  const leader: Evaluation2026ReadinessActionItem[] = []
  addWhenPresent(leader, action({
    id: 'LEADER_MBO_REVIEW',
    priority: 'P0',
    ownerGroup: 'LEADER',
    title: '팀원 MBO 제출/보완 검토',
    reason: 'MBO 미작성 및 확정 coverage 부족은 리더 검토 전 단계의 핵심 blocker입니다.',
    relatedBlockerCount: Math.max(valueOrZero(missingMboCount), valueOrZero(missingConfirmedCount)),
    relatedRoute: '/kpi/personal',
    expectedOutcome: '팀원의 MBO 제출/보완 요청이 정리됩니다.',
    suggestedCommunicationCopy: '팀원 MBO가 제출되면 목표, 비중, 측정 기준, 정책 카테고리 의심 항목을 검토해 주세요.',
    status: 'READY_TO_START',
  }))
  addWhenPresent(leader, action({
    id: 'LEADER_RESULT_EVIDENCE_REVIEW',
    priority: 'P1',
    ownerGroup: 'LEADER',
    title: '수행결과 증빙 확인',
    reason: '결과 작성/evidence blocker는 FIRST/SECOND review readiness를 지연시킵니다.',
    relatedBlockerCount: resultWritingBlockerCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '결과, 증빙, 본인 기여, 산출물/영향이 검토 가능한 상태가 됩니다.',
    status: statusForCount(resultWritingBlockerCount),
  }))
  addWhenPresent(leader, action({
    id: 'LEADER_REVIEW_READINESS_CHECK',
    priority: 'P1',
    ownerGroup: 'LEADER',
    title: '리더 평가 readiness blocker 확인',
    reason: '리더 평가 readiness blocker는 official scoring 이전에 해소되어야 합니다.',
    relatedBlockerCount: leaderEvaluationBlockerCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'FIRST/SECOND review prerequisite blocker가 정리됩니다.',
    status: statusForCount(leaderEvaluationBlockerCount),
  }))
  addWhenPresent(leader, action({
    id: 'LEADER_POLICY_SOURCE_ESCALATION',
    priority: 'P1',
    ownerGroup: 'LEADER',
    title: 'policyCategory/ORG_GOAL source 의심 항목 HR 확인 요청',
    reason: 'ORG_GOAL source 또는 DAILY_WORK duplicate 의심 항목은 HR 확정이 필요합니다.',
    relatedBlockerCount: policyCategoryMissingCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '리더가 HR 확인이 필요한 정책 분류 이슈를 식별합니다.',
    status: statusForCount(policyCategoryMissingCount),
  }))

  const employee: Evaluation2026ReadinessActionItem[] = []
  addWhenPresent(employee, action({
    id: 'EMPLOYEE_WRITE_2026_MBO',
    priority: 'P0',
    ownerGroup: 'EMPLOYEE',
    title: '2026 MBO 작성',
    reason: 'MBO 미작성 상태는 readiness stage를 MBO_SETUP_IN_PROGRESS에 머물게 합니다.',
    relatedBlockerCount: missingMboCount,
    relatedRoute: '/kpi/personal',
    expectedOutcome: '직원이 2026 MBO 초안을 작성합니다.',
    suggestedCommunicationCopy: '2026 MBO를 작성하고 목표, 측정 기준, 수행계획을 입력해 주세요.',
    status: statusForCount(missingMboCount),
  }))
  addWhenPresent(employee, action({
    id: 'EMPLOYEE_SUBMIT_DRAFT',
    priority: 'P0',
    ownerGroup: 'EMPLOYEE',
    title: '초안 제출',
    reason: '초안이 제출되지 않으면 리더 검토와 확정 KPI coverage가 진행되지 않습니다.',
    relatedBlockerCount: missingConfirmedCount,
    relatedRoute: '/kpi/personal',
    expectedOutcome: '초안이 제출되어 리더 검토 대상으로 이동합니다.',
    suggestedCommunicationCopy: '작성한 MBO 초안을 제출해 주세요. 제출 후 리더 검토가 진행됩니다.',
    status: statusForCount(missingConfirmedCount),
  }))
  addWhenPresent(employee, action({
    id: 'EMPLOYEE_RESULT_PREP',
    priority: 'P1',
    ownerGroup: 'EMPLOYEE',
    title: '수행결과 작성 준비',
    reason: '결과 작성 readiness는 공식 평가 전 선행 점검 대상입니다.',
    relatedBlockerCount: resultWritingBlockerCount,
    relatedRoute: '/kpi/monthly',
    expectedOutcome: '결과, 본인 기여, 산출물, 증빙 링크/코멘트가 준비됩니다.',
    status: statusForCount(resultWritingBlockerCount),
  }))
  addWhenPresent(employee, action({
    id: 'EMPLOYEE_AI_EVIDENCE_PREP',
    priority: 'P2',
    ownerGroup: 'EMPLOYEE',
    title: 'AI 활용평가 증빙 준비',
    reason: 'AI Pass/Fail readiness는 annual score와 분리해서 증빙을 확인해야 합니다.',
    relatedBlockerCount: aiReadinessBlockerCount,
    relatedRoute: '/evaluation/ai-competency',
    expectedOutcome: 'AI 활용평가 증빙이 연간 업적점수와 분리된 상태로 준비됩니다.',
    status: statusForCount(aiReadinessBlockerCount),
  }))

  const developer: Evaluation2026ReadinessActionItem[] = []
  addWhenPresent(developer, action({
    id: 'DEV_VERCEL_LOG_WATCH',
    priority: 'P2',
    ownerGroup: 'DEV',
    title: 'Vercel logs watch',
    reason: 'readiness 화면은 production smoke 중 schema/runtime error 감시가 필요합니다.',
    relatedBlockerCount: null,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'P2022/P2021/JWT/runtime error가 발견되면 hotfix 여부를 판단합니다.',
    status: 'WATCH_ONLY',
  }))
  addWhenPresent(developer, action({
    id: 'DEV_ACTIVATION_GATE_CONSISTENCY',
    priority: 'P0',
    ownerGroup: 'DEV',
    title: 'activation gate blocker consistency check',
    reason: '공식 전환 gate blocker가 존재하면 실행 버튼 없이 blocker 일관성만 감시해야 합니다.',
    relatedBlockerCount: officialGateBlockerCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'gate, runbook, snapshot blocker count가 같은 방향으로 표시됩니다.',
    status: valueOrZero(officialGateBlockerCount) > 0 ? 'WATCH_ONLY' : 'WAITING_FOR_DATA',
  }))
  addWhenPresent(developer, action({
    id: 'DEV_NO_WRITE_WATCH',
    priority: 'P0',
    ownerGroup: 'DEV',
    title: 'no backfill/scoring/grade/feature flag writes',
    reason: '공식 전환 전에는 모든 activation/write path가 금지입니다.',
    relatedBlockerCount: officialGateBlockerCount,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'backfill, scoring, grade, totalScore, gradeId, feature flag write가 실행되지 않습니다.',
    status: 'WATCH_ONLY',
  }))
  addWhenPresent(developer, action({
    id: 'DEV_HOTFIX_ONLY_RUNTIME_ERROR',
    priority: 'P2',
    ownerGroup: 'DEV',
    title: 'hotfix only if runtime error appears',
    reason: '운영 readiness 화면은 report-only 상태를 유지하고 runtime defect만 hotfix합니다.',
    relatedBlockerCount: null,
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '실제 runtime/schema/auth 오류가 있을 때만 코드 hotfix를 준비합니다.',
    status: 'WATCH_ONLY',
  }))

  const sortedHr = sortActions(hr)
  const sortedLeader = sortActions(leader)
  const sortedEmployee = sortActions(employee)
  const sortedDeveloper = sortActions(developer)
  const allActions = [...sortedHr, ...sortedLeader, ...sortedEmployee, ...sortedDeveloper]
  const thisWeekFocus = buildThisWeekFocus(snapshot, allActions)
  const reportText = buildReportText(snapshot, sortedHr)
  const markdown = [
    '# 2026 Readiness Action Plan',
    '',
    reportText,
    '',
    '## This week focus',
    buildActionText(thisWeekFocus),
    '',
    '## HR actions',
    buildActionText(sortedHr),
    '',
    '## Leader actions',
    buildActionText(sortedLeader),
    '',
    '## Employee actions',
    buildActionText(sortedEmployee),
    '',
    '## Developer / operations watcher actions',
    buildActionText(sortedDeveloper),
    '',
    '## Prohibited actions',
    PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
  ].join('\n')

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    currentStage: snapshot.currentStage,
    overallStatus: snapshot.overallStatus,
    actionGroups: {
      hr: sortedHr,
      leader: sortedLeader,
      employee: sortedEmployee,
      developer: sortedDeveloper,
    },
    thisWeekFocus,
    reportText,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      hrActionPlan: buildActionText(sortedHr),
      leaderActionPlan: buildActionText(sortedLeader),
      employeeActionPlan: buildActionText(sortedEmployee),
      developerWatchPlan: buildActionText(sortedDeveloper),
      fullActionBoard: markdown,
      markdown,
      tsv: buildTsv(allActions),
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
      noMetadataSaveButtons: true,
    },
  }
}
