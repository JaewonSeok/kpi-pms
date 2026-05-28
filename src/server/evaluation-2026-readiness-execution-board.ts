import type {
  Evaluation2026IntegratedReadinessBlocker,
  Evaluation2026IntegratedReadinessSnapshot,
} from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type {
  Evaluation2026ReadinessActionItem,
  Evaluation2026ReadinessActionOwner,
  Evaluation2026ReadinessActionPlan,
  Evaluation2026ReadinessActionPriority,
} from '@/server/evaluation-2026-readiness-action-plan'
import type {
  Evaluation2026OfficialActivationGate,
  Evaluation2026OfficialActivationRunbook,
} from '@/server/evaluation-2026-activation-readiness'

export type Evaluation2026ReadinessExecutionStatus =
  | 'NOT_STARTED'
  | 'READY_TO_START'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_DATA'
  | 'BLOCKED'
  | 'WATCH_ONLY'
  | 'DONE'

export type Evaluation2026ReadinessExecutionActionType =
  | 'MBO'
  | 'TEAM_KPI'
  | 'POLICY_CATEGORY'
  | 'EVALUATOR_ROUTING'
  | 'RESULT_WRITING'
  | 'LEADER_REVIEW'
  | 'FINALIZATION'
  | 'SCORE_POLICY'
  | 'GRADE_POLICY'
  | 'AI_READINESS'
  | 'FEEDBACK_LEADERSHIP'
  | 'OFFICIAL_GATE'
  | 'BASELINE'
  | 'WATCH'
  | 'REPORT'

export type Evaluation2026ReadinessExecutionAction = {
  id: string
  priority: Evaluation2026ReadinessActionPriority
  ownerGroup: Evaluation2026ReadinessActionOwner
  actionType: Evaluation2026ReadinessExecutionActionType
  title: string
  reason: string
  relatedBlockerCount: number | null
  sourcePanel: string
  relatedRoute: string
  expectedOutcome: string
  suggestedNextStep: string
  prohibitedActions: string[]
  suggestedCommunicationCopy?: string
  status: Evaluation2026ReadinessExecutionStatus
  ownerNote?: string
  dueDate?: string
  lastReviewedAt?: string
  savedBy?: string
  savedAt?: string
}

export type Evaluation2026ReadinessExecutionBoard = {
  mode: 'READ_ONLY'
  generatedAt: string
  metadataTracking: {
    enabled: false
    saveAvailable: false
    reason: string
    recommendedDesign: string
  }
  summary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    totalOpenActionCount: number
    p0Count: number
    p1Count: number
    p2Count: number
    hrActionCount: number
    leaderActionCount: number
    employeeActionCount: number
    developerWatchActionCount: number
    blockedActionCount: number
    readyToStartActionCount: number
    watchOnlyActionCount: number
    lastBaselineTimestamp: string | null
    lastReviewedTimestamp: string | null
    nextHrAction: string
    nextDeveloperWatchAction: string
    noExecutionButtonsInUi: true
  }
  baselineSnapshot: {
    timestamp: string
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    keyCounts: Evaluation2026IntegratedReadinessSnapshot['summary']
    topBlockers: Evaluation2026IntegratedReadinessBlocker[]
    guidance: string
    deltaFromPreviousBaseline: string[]
  }
  actionGroups: {
    hr: Evaluation2026ReadinessExecutionAction[]
    leader: Evaluation2026ReadinessExecutionAction[]
    employee: Evaluation2026ReadinessExecutionAction[]
    developer: Evaluation2026ReadinessExecutionAction[]
  }
  workstreams: {
    all: Evaluation2026ReadinessExecutionAction[]
    thisWeekFocus: Evaluation2026ReadinessExecutionAction[]
    hr: Evaluation2026ReadinessExecutionAction[]
    leader: Evaluation2026ReadinessExecutionAction[]
    employee: Evaluation2026ReadinessExecutionAction[]
    developer: Evaluation2026ReadinessExecutionAction[]
    completedOrDeferred: Evaluation2026ReadinessExecutionAction[]
  }
  filters: {
    ownerGroups: Evaluation2026ReadinessActionOwner[]
    priorities: Evaluation2026ReadinessActionPriority[]
    statuses: Evaluation2026ReadinessExecutionStatus[]
    relatedRoutes: string[]
    sourcePanels: string[]
    actionTypes: Evaluation2026ReadinessExecutionActionType[]
  }
  communicationTemplates: Array<{
    id: string
    title: string
    ownerGroup: Evaluation2026ReadinessActionOwner
    copy: string
  }>
  hrReportText: string
  executiveWeeklyReportText: string
  prohibitedActions: string[]
  copyPayloads: {
    fullBoard: string
    thisWeekFocus: string
    hrActionList: string
    leaderActionList: string
    employeeActionList: string
    developerWatchList: string
    executiveWeeklyReport: string
    prohibitedActions: string
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

const COMMUNICATION_TEMPLATES: Evaluation2026ReadinessExecutionBoard['communicationTemplates'] = [
  {
    id: 'COMM_MBO_MISSING',
    title: 'MBO 미작성자 작성 요청',
    ownerGroup: 'HR',
    copy: '2026 MBO 작성이 아직 시작되지 않았습니다. /kpi/personal에서 목표, 측정 기준, 수행계획을 작성해 주세요. 공식 점수/등급은 아직 실행되지 않습니다.',
  },
  {
    id: 'COMM_DRAFT_SUBMIT',
    title: '초안 보유자 제출 요청',
    ownerGroup: 'HR',
    copy: '작성 중인 2026 MBO 초안은 제출까지 완료해 주세요. 제출 후 리더 검토가 진행됩니다.',
  },
  {
    id: 'COMM_LEADER_REVIEW',
    title: '리더 검토 요청',
    ownerGroup: 'LEADER',
    copy: '팀원 MBO 제출 현황과 보완 필요 항목을 확인해 주세요. category, 비중, 측정 기준, 수행계획을 중심으로 검토해 주세요.',
  },
  {
    id: 'COMM_TEAM_KPI_REVIEW',
    title: 'Team KPI HR 검토 요청',
    ownerGroup: 'HR',
    copy: 'Team KPI pending 항목을 조직목표 반영, 일상업무, 예외 승인, 논의 필요 중 하나로 검토해 주세요.',
  },
  {
    id: 'COMM_POLICY_CATEGORY',
    title: 'policyCategory 확정 요청',
    ownerGroup: 'HR',
    copy: 'policyCategory 미분류 항목을 ORG_GOAL / PROJECT_T / PROJECT_K / DAILY_WORK 중 하나로 확정해 주세요.',
  },
  {
    id: 'COMM_EVALUATOR_ROUTING',
    title: '평가자 배정 누락 확인 요청',
    ownerGroup: 'HR',
    copy: '평가자 배정 readiness에서 FIRST/SECOND/FINAL 누락, inactive evaluator, 조직 경로 이슈를 확인해 주세요.',
  },
]

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function statusFromAction(item: Evaluation2026ReadinessActionItem): Evaluation2026ReadinessExecutionStatus {
  if (item.status === 'WATCH_ONLY') return 'WATCH_ONLY'
  if (item.status === 'WAITING_FOR_DATA') return 'WAITING_FOR_DATA'
  if (item.status === 'BLOCKED') return 'BLOCKED'
  return 'READY_TO_START'
}

function sourcePanelForAction(item: Evaluation2026ReadinessActionItem): string {
  if (item.id.includes('MBO') || item.id.includes('DRAFT')) return 'MBO setup readiness'
  if (item.id.includes('TEAM_KPI')) return '2026 팀 KPI 검토'
  if (item.id.includes('POLICY')) return '2026 정책 매핑 관리'
  if (item.id.includes('EVALUATOR')) return '2026 평가자 배정 readiness QA'
  if (item.id.includes('RESULT')) return '2026 수행결과 작성 readiness'
  if (item.id.includes('REVIEW_READINESS')) return '2026 리더 평가 readiness'
  if (item.id.includes('FINALIZATION')) return '2026 최종 확정 readiness'
  if (item.id.includes('AI')) return 'AI Pass/Fail readiness'
  if (item.id.includes('FEEDBACK')) return '2026 360/리더십 readiness'
  if (item.id.includes('GATE')) return '2026 공식 전환 Gate'
  if (item.id.includes('LOG') || item.id.includes('WATCH') || item.id.includes('HOTFIX')) return 'Operations watch'
  return '2026 Readiness Action Plan'
}

function actionTypeForAction(item: Evaluation2026ReadinessActionItem): Evaluation2026ReadinessExecutionActionType {
  if (item.id.includes('MBO') || item.id.includes('DRAFT')) return 'MBO'
  if (item.id.includes('TEAM_KPI')) return 'TEAM_KPI'
  if (item.id.includes('POLICY')) return 'POLICY_CATEGORY'
  if (item.id.includes('EVALUATOR')) return 'EVALUATOR_ROUTING'
  if (item.id.includes('RESULT')) return 'RESULT_WRITING'
  if (item.id.includes('REVIEW_READINESS')) return 'LEADER_REVIEW'
  if (item.id.includes('FINALIZATION')) return 'FINALIZATION'
  if (item.id.includes('AI')) return 'AI_READINESS'
  if (item.id.includes('FEEDBACK')) return 'FEEDBACK_LEADERSHIP'
  if (item.id.includes('GATE')) return 'OFFICIAL_GATE'
  if (item.id.includes('LOG') || item.id.includes('WATCH') || item.id.includes('HOTFIX')) return 'WATCH'
  return 'REPORT'
}

function nextStepForAction(item: Evaluation2026ReadinessActionItem): string {
  if (item.suggestedCommunicationCopy) return item.suggestedCommunicationCopy
  if (item.ownerGroup === 'DEV') return '운영 로그와 readiness blocker 일관성을 watch-only로 확인하세요.'
  if (item.ownerGroup === 'LEADER') return '리더가 담당 팀원의 보완 필요 항목을 확인하고 HR 확인 필요 사항을 전달하세요.'
  if (item.ownerGroup === 'EMPLOYEE') return '직원이 본인 MBO/증빙/결과 작성 준비 항목을 보완하세요.'
  return 'HR이 관련 readiness panel에서 blocker 원인을 확인하고 다음 조치를 안내하세요.'
}

function mapActionPlanItem(item: Evaluation2026ReadinessActionItem): Evaluation2026ReadinessExecutionAction {
  return {
    id: item.id,
    priority: item.priority,
    ownerGroup: item.ownerGroup,
    actionType: actionTypeForAction(item),
    title: item.title,
    reason: item.reason,
    relatedBlockerCount: item.relatedBlockerCount,
    sourcePanel: sourcePanelForAction(item),
    relatedRoute: item.relatedRoute,
    expectedOutcome: item.expectedOutcome,
    suggestedNextStep: nextStepForAction(item),
    prohibitedActions: PROHIBITED_ACTIONS,
    suggestedCommunicationCopy: item.suggestedCommunicationCopy,
    status: statusFromAction(item),
  }
}

function createAction(params: Omit<Evaluation2026ReadinessExecutionAction, 'prohibitedActions'>) {
  return {
    ...params,
    prohibitedActions: PROHIBITED_ACTIONS,
  } satisfies Evaluation2026ReadinessExecutionAction
}

function addWhenUseful(target: Evaluation2026ReadinessExecutionAction[], item: Evaluation2026ReadinessExecutionAction) {
  if (item.relatedBlockerCount == null || item.relatedBlockerCount > 0 || item.status === 'WATCH_ONLY') {
    target.push(item)
  }
}

function priorityWeight(priority: Evaluation2026ReadinessActionPriority) {
  if (priority === 'P0') return 0
  if (priority === 'P1') return 1
  return 2
}

function statusWeight(status: Evaluation2026ReadinessExecutionStatus) {
  if (status === 'BLOCKED') return 0
  if (status === 'READY_TO_START') return 1
  if (status === 'NOT_STARTED') return 2
  if (status === 'IN_PROGRESS') return 3
  if (status === 'WAITING_FOR_DATA') return 4
  if (status === 'WATCH_ONLY') return 5
  return 6
}

function sortActions(items: Evaluation2026ReadinessExecutionAction[]) {
  return [...items].sort((a, b) => {
    const priorityDiff = priorityWeight(a.priority) - priorityWeight(b.priority)
    if (priorityDiff !== 0) return priorityDiff
    const statusDiff = statusWeight(a.status) - statusWeight(b.status)
    if (statusDiff !== 0) return statusDiff
    return valueOrZero(b.relatedBlockerCount) - valueOrZero(a.relatedBlockerCount)
  })
}

function countByPriority(items: Evaluation2026ReadinessExecutionAction[], priority: Evaluation2026ReadinessActionPriority) {
  return items.filter((item) => item.priority === priority && item.status !== 'DONE').length
}

function countByOwner(items: Evaluation2026ReadinessExecutionAction[], owner: Evaluation2026ReadinessActionOwner) {
  return items.filter((item) => item.ownerGroup === owner && item.status !== 'DONE').length
}

function countByStatus(items: Evaluation2026ReadinessExecutionAction[], status: Evaluation2026ReadinessExecutionStatus) {
  return items.filter((item) => item.status === status).length
}

function officialActivationStatus(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  gates: Evaluation2026OfficialActivationGate[]
  runbook: Evaluation2026OfficialActivationRunbook
}): Evaluation2026ReadinessExecutionBoard['summary']['officialActivationStatus'] {
  if (valueOrZero(params.snapshot.summary.officialActivationGateBlockerCount) > 0) return 'BLOCKED'
  if (params.gates.some((gate) => gate.status === 'BLOCKED')) return 'BLOCKED'
  if (params.runbook.summary.readyForReviewSectionCount > 0) return 'READY_FOR_REVIEW'
  return 'READY_LATER'
}

function buildActionText(items: Evaluation2026ReadinessExecutionAction[]) {
  if (!items.length) return '현재 표시할 실행 항목이 없습니다.'
  return items.map((item) => [
    `- [${item.priority}] ${item.title}`,
    `  owner: ${item.ownerGroup}`,
    `  status: ${item.status}`,
    `  blocker: ${item.relatedBlockerCount == null ? '미확인' : `${item.relatedBlockerCount}건`}`,
    `  source: ${item.sourcePanel}`,
    `  route: ${item.relatedRoute}`,
    `  next: ${item.suggestedNextStep}`,
  ].join('\n')).join('\n')
}

function buildTsv(items: Evaluation2026ReadinessExecutionAction[]) {
  const header = [
    'id',
    'priority',
    'ownerGroup',
    'status',
    'actionType',
    'title',
    'relatedBlockerCount',
    'sourcePanel',
    'relatedRoute',
    'suggestedNextStep',
    'prohibitedActions',
  ].join('\t')
  const rows = items.map((item) => [
    item.id,
    item.priority,
    item.ownerGroup,
    item.status,
    item.actionType,
    item.title,
    item.relatedBlockerCount == null ? '미확인' : String(item.relatedBlockerCount),
    item.sourcePanel,
    item.relatedRoute,
    item.suggestedNextStep,
    item.prohibitedActions.join(', '),
  ].join('\t'))
  return [header, ...rows].join('\n')
}

function buildExecutiveWeeklyReport(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  boardStatus: Evaluation2026ReadinessExecutionBoard['summary']['officialActivationStatus']
  thisWeekFocus: Evaluation2026ReadinessExecutionAction[]
  developerActions: Evaluation2026ReadinessExecutionAction[]
}) {
  const blockerText = params.snapshot.topBlockers.length
    ? params.snapshot.topBlockers.slice(0, 5).map((item) => `${item.name} ${item.count}건`).join(', ')
    : '현재 주요 blocker 없음'
  const focusText = params.thisWeekFocus.slice(0, 7).map((item) => item.title).join(', ')
  const devText = params.developerActions.slice(0, 4).map((item) => item.title).join(', ')
  const activationText =
    params.boardStatus === 'BLOCKED'
      ? '공식 전환은 여전히 BLOCKED 상태입니다.'
      : '공식 전환은 실행이 아니라 review 단계에서만 검토 가능합니다.'
  return [
    `snapshot timestamp: ${params.snapshot.generatedAt}`,
    `현재 단계: ${params.snapshot.currentStage}`,
    `overall readiness status: ${params.snapshot.overallStatus}`,
    `Top blockers: ${blockerText}`,
    `이번 주 HR action: ${focusText || 'readiness blocker 재확인'}`,
    `Developer/watch action: ${devText || 'read-only watch 유지'}`,
    `Prohibited actions: ${PROHIBITED_ACTIONS.join(', ')}`,
    activationText,
  ].join('\n')
}

function buildHrReport(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  thisWeekFocus: Evaluation2026ReadinessExecutionAction[]
}) {
  return [
    `현재 2026 readiness는 ${params.snapshot.currentStage} 단계이며 ${params.snapshot.overallStatus} 상태입니다.`,
    `이번 주 집중 항목은 ${params.thisWeekFocus.map((item) => item.title).join(', ') || 'readiness blocker 재확인'}입니다.`,
    'baseline은 복사/내보내기로 기록해 주세요. 이 보드는 저장, 알림 발송, 공식 전환 실행을 수행하지 않습니다.',
  ].join(' ')
}

function buildMarkdown(params: {
  board: Pick<Evaluation2026ReadinessExecutionBoard, 'summary' | 'baselineSnapshot' | 'prohibitedActions'>
  thisWeekFocus: Evaluation2026ReadinessExecutionAction[]
  hr: Evaluation2026ReadinessExecutionAction[]
  leader: Evaluation2026ReadinessExecutionAction[]
  employee: Evaluation2026ReadinessExecutionAction[]
  developer: Evaluation2026ReadinessExecutionAction[]
  executiveWeeklyReportText: string
}) {
  return [
    '# 2026 Readiness Execution Board',
    '',
    params.executiveWeeklyReportText,
    '',
    '## Board summary',
    `- current stage: ${params.board.summary.currentStage}`,
    `- overall readiness status: ${params.board.summary.overallReadinessStatus}`,
    `- official activation status: ${params.board.summary.officialActivationStatus}`,
    `- open actions: ${params.board.summary.totalOpenActionCount}`,
    `- P0/P1/P2: ${params.board.summary.p0Count}/${params.board.summary.p1Count}/${params.board.summary.p2Count}`,
    '',
    '## This week focus',
    buildActionText(params.thisWeekFocus),
    '',
    '## HR',
    buildActionText(params.hr),
    '',
    '## Leaders',
    buildActionText(params.leader),
    '',
    '## Employees',
    buildActionText(params.employee),
    '',
    '## Developer / monitoring',
    buildActionText(params.developer),
    '',
    '## Baseline',
    `- timestamp: ${params.board.baselineSnapshot.timestamp}`,
    `- guidance: ${params.board.baselineSnapshot.guidance}`,
    '',
    '## Prohibited actions',
    params.board.prohibitedActions.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
}

function uniqueSorted<T extends string>(items: T[]) {
  return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b))
}

function buildThisWeekFocus(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  actions: Evaluation2026ReadinessExecutionAction[]
}) {
  if (params.snapshot.currentStage !== 'MBO_SETUP_IN_PROGRESS') return params.actions.slice(0, 7)

  const focusIds = [
    'HR_MISSING_MBO_REQUEST',
    'HR_DRAFT_SUBMIT_REQUEST',
    'HR_TEAM_KPI_REVIEW',
    'HR_POLICY_CATEGORY_CONFIRM',
    'HR_EVALUATOR_ROUTING_REVIEW',
    'HR_BASELINE_RECORD',
    'DEV_VERCEL_LOG_WATCH',
  ]
  return focusIds
    .map((id) => params.actions.find((item) => item.id === id))
    .filter((item): item is Evaluation2026ReadinessExecutionAction => Boolean(item))
}

export function buildEvaluation2026ReadinessExecutionBoard(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  readinessActionPlan: Evaluation2026ReadinessActionPlan
  officialActivationRunbook: Evaluation2026OfficialActivationRunbook
  officialActivationGates: Evaluation2026OfficialActivationGate[]
}): Evaluation2026ReadinessExecutionBoard {
  const snapshot = params.integratedReadinessSnapshot
  const plan = params.readinessActionPlan
  const officialStatus = officialActivationStatus({
    snapshot,
    gates: params.officialActivationGates,
    runbook: params.officialActivationRunbook,
  })
  const officialGateBlockerCount = snapshot.summary.officialActivationGateBlockerCount

  const hr = plan.actionGroups.hr.map(mapActionPlanItem)
  addWhenUseful(hr, createAction({
    id: 'HR_OFFICIAL_GATE_BLOCKER_REVIEW',
    priority: 'P0',
    ownerGroup: 'HR',
    actionType: 'OFFICIAL_GATE',
    title: '공식 전환 Gate blocker 확인',
    reason: '공식 gate blocker가 남아 있으면 backfill/scoring/grade 논의가 불가능합니다.',
    relatedBlockerCount: officialGateBlockerCount,
    sourcePanel: '2026 공식 전환 Gate',
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '공식 gate blocker가 HR 실행 항목과 Runbook checklist에 반영됩니다.',
    suggestedNextStep: 'Gate blocker와 Runbook next action을 확인하고 공식 실행 금지 상태를 유지하세요.',
    status: valueOrZero(officialGateBlockerCount) > 0 ? 'BLOCKED' : 'WAITING_FOR_DATA',
  }))
  hr.push(createAction({
    id: 'HR_SCORE_POLICY_REVIEW',
    priority: 'P1',
    ownerGroup: 'HR',
    actionType: 'SCORE_POLICY',
    title: '성과점수 정책 blocker 확인',
    reason: 'score policy blocker는 공식 scoring 이전에 해소되어야 합니다.',
    relatedBlockerCount: snapshot.summary.scorePolicyBlockerCount,
    sourcePanel: '2026 성과점수 정책 readiness',
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'weight cap, category, ORG_GOAL source, adjustment readiness warning이 정리됩니다.',
    suggestedNextStep: '성과점수 정책 readiness simulator의 blocker와 warning을 검토하세요.',
    status: valueOrZero(snapshot.summary.scorePolicyBlockerCount) > 0 ? 'READY_TO_START' : 'WAITING_FOR_DATA',
  }))
  hr.push(createAction({
    id: 'HR_GRADE_POLICY_REVIEW',
    priority: 'P1',
    ownerGroup: 'HR',
    actionType: 'GRADE_POLICY',
    title: '등급 기준 blocker 확인',
    reason: 'grade policy blocker는 official grade activation 이전에 해소되어야 합니다.',
    relatedBlockerCount: snapshot.summary.gradePolicyBlockerCount,
    sourcePanel: '2026 등급 기준 readiness',
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '등급 구간 누락/차이/중첩/TEAM_MEMBER_SALES ambiguity가 정리됩니다.',
    suggestedNextStep: '등급 기준 readiness panel에서 PPT 기준과 저장 기준을 대조하세요.',
    status: valueOrZero(snapshot.summary.gradePolicyBlockerCount) > 0 ? 'READY_TO_START' : 'WAITING_FOR_DATA',
  }))
  addWhenUseful(hr, createAction({
    id: 'HR_BASELINE_RECORD',
    priority: 'P2',
    ownerGroup: 'HR',
    actionType: 'BASELINE',
    title: 'integrated snapshot baseline 기록',
    reason: '이전 baseline과의 delta를 보려면 현재 snapshot을 운영 기록으로 남겨야 합니다.',
    relatedBlockerCount: null,
    sourcePanel: '2026 통합 readiness snapshot',
    relatedRoute: '/evaluation/performance',
    expectedOutcome: '현재 stage, key counts, top blockers가 weekly report 기준선으로 기록됩니다.',
    suggestedNextStep: 'baseline은 복사/내보내기로 기록해 주세요.',
    status: 'READY_TO_START',
  }))

  const leader = plan.actionGroups.leader.map(mapActionPlanItem)
  const employee = plan.actionGroups.employee.map(mapActionPlanItem)
  const developer = plan.actionGroups.developer.map(mapActionPlanItem)
  addWhenUseful(developer, createAction({
    id: 'DEV_SCHEDULE_WATCH',
    priority: 'P2',
    ownerGroup: 'DEV',
    actionType: 'WATCH',
    title: 'schedule-gated readiness watch',
    reason: 'PPT 일정 window와 readiness blocker 표시가 어긋나지 않는지 운영 중 확인합니다.',
    relatedBlockerCount: null,
    sourcePanel: '2026 schedule-gated readiness',
    relatedRoute: '/admin/performance-calendar',
    expectedOutcome: '현재 일정 window와 각 readiness guidance가 read-only로 일관되게 표시됩니다.',
    suggestedNextStep: '운영 일정과 readiness snapshot의 current stage를 watch-only로 대조하세요.',
    status: 'WATCH_ONLY',
  }))
  addWhenUseful(developer, createAction({
    id: 'DEV_WEEKLY_REPORT_EXPORT',
    priority: 'P2',
    ownerGroup: 'DEV',
    actionType: 'REPORT',
    title: 'weekly report export support',
    reason: 'HR executive report는 저장이 아니라 copy/export로 공유합니다.',
    relatedBlockerCount: null,
    sourcePanel: '2026 Readiness Execution Board',
    relatedRoute: '/evaluation/performance',
    expectedOutcome: 'Markdown/TSV export payload가 HR 주간 보고에 사용됩니다.',
    suggestedNextStep: 'runtime error가 없으면 report-only 상태를 유지하세요.',
    status: 'WATCH_ONLY',
  }))

  const sortedHr = sortActions(hr)
  const sortedLeader = sortActions(leader)
  const sortedEmployee = sortActions(employee)
  const sortedDeveloper = sortActions(developer)
  const all = sortActions([...sortedHr, ...sortedLeader, ...sortedEmployee, ...sortedDeveloper])
  const thisWeekFocus = buildThisWeekFocus({ snapshot, actions: all })
  const completedOrDeferred = all.filter((item) => item.status === 'DONE' || item.status === 'BLOCKED')
  const baselineSnapshot: Evaluation2026ReadinessExecutionBoard['baselineSnapshot'] = {
    timestamp: snapshot.generatedAt,
    currentStage: snapshot.currentStage,
    overallReadinessStatus: snapshot.overallStatus,
    officialActivationStatus: officialStatus,
    keyCounts: snapshot.summary,
    topBlockers: snapshot.topBlockers.slice(0, 5),
    guidance: 'baseline은 복사/내보내기로 기록해 주세요.',
    deltaFromPreviousBaseline: ['저장된 이전 baseline이 없어 delta는 export 기록과 수동 비교가 필요합니다.'],
  }
  const summary: Evaluation2026ReadinessExecutionBoard['summary'] = {
    currentStage: snapshot.currentStage,
    overallReadinessStatus: snapshot.overallStatus,
    officialActivationStatus: officialStatus,
    totalOpenActionCount: all.filter((item) => item.status !== 'DONE').length,
    p0Count: countByPriority(all, 'P0'),
    p1Count: countByPriority(all, 'P1'),
    p2Count: countByPriority(all, 'P2'),
    hrActionCount: countByOwner(all, 'HR'),
    leaderActionCount: countByOwner(all, 'LEADER'),
    employeeActionCount: countByOwner(all, 'EMPLOYEE'),
    developerWatchActionCount: countByOwner(all, 'DEV'),
    blockedActionCount: countByStatus(all, 'BLOCKED'),
    readyToStartActionCount: countByStatus(all, 'READY_TO_START'),
    watchOnlyActionCount: countByStatus(all, 'WATCH_ONLY'),
    lastBaselineTimestamp: null,
    lastReviewedTimestamp: null,
    nextHrAction: thisWeekFocus.find((item) => item.ownerGroup === 'HR')?.title ?? 'readiness blocker 재확인',
    nextDeveloperWatchAction: sortedDeveloper[0]?.title ?? 'Vercel logs watch',
    noExecutionButtonsInUi: true,
  }
  const hrReportText = buildHrReport({ snapshot, thisWeekFocus })
  const executiveWeeklyReportText = buildExecutiveWeeklyReport({
    snapshot,
    boardStatus: officialStatus,
    thisWeekFocus,
    developerActions: sortedDeveloper,
  })
  const boardForMarkdown = {
    summary,
    baselineSnapshot,
    prohibitedActions: PROHIBITED_ACTIONS,
  }
  const markdown = buildMarkdown({
    board: boardForMarkdown,
    thisWeekFocus,
    hr: sortedHr,
    leader: sortedLeader,
    employee: sortedEmployee,
    developer: sortedDeveloper,
    executiveWeeklyReportText,
  })

  return {
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    metadataTracking: {
      enabled: false,
      saveAvailable: false,
      reason: '기존 metadata route는 performanceDesignConfig 전체 설계 저장용이며 readinessExecutionBoard 전용 안전 스키마가 없습니다.',
      recommendedDesign: 'EvalCycle.performanceDesignConfig.readinessExecutionBoard에 actionStatus, ownerNote, dueDate, baselineSnapshot, lastReviewedAt을 Zod로 검증하고 audit log를 남기는 별도 admin-only metadata route가 필요합니다.',
    },
    summary,
    baselineSnapshot,
    actionGroups: {
      hr: sortedHr,
      leader: sortedLeader,
      employee: sortedEmployee,
      developer: sortedDeveloper,
    },
    workstreams: {
      all,
      thisWeekFocus,
      hr: sortedHr,
      leader: sortedLeader,
      employee: sortedEmployee,
      developer: sortedDeveloper,
      completedOrDeferred,
    },
    filters: {
      ownerGroups: uniqueSorted(all.map((item) => item.ownerGroup)),
      priorities: uniqueSorted(all.map((item) => item.priority)),
      statuses: uniqueSorted(all.map((item) => item.status)),
      relatedRoutes: uniqueSorted(all.map((item) => item.relatedRoute)),
      sourcePanels: uniqueSorted(all.map((item) => item.sourcePanel)),
      actionTypes: uniqueSorted(all.map((item) => item.actionType)),
    },
    communicationTemplates: COMMUNICATION_TEMPLATES,
    hrReportText,
    executiveWeeklyReportText,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      fullBoard: markdown,
      thisWeekFocus: buildActionText(thisWeekFocus),
      hrActionList: buildActionText(sortedHr),
      leaderActionList: buildActionText(sortedLeader),
      employeeActionList: buildActionText(sortedEmployee),
      developerWatchList: buildActionText(sortedDeveloper),
      executiveWeeklyReport: executiveWeeklyReportText,
      prohibitedActions: PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
      markdown,
      tsv: buildTsv(all),
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
      noBackfillExecutionButtons: true,
      noScoreGradeWriteButtons: true,
    },
  }
}
