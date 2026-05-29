import type { Evaluation2026BackfillDryRunCommandRunbook } from '@/server/evaluation-2026-backfill-dryrun-command-runbook'
import type { Evaluation2026BackfillDryRunPreflightPack } from '@/server/evaluation-2026-backfill-dryrun-preflight'
import type { Evaluation2026DryRunOutputReviewTemplate } from '@/server/evaluation-2026-dryrun-output-review-template'
import type { Evaluation2026DryRunRehearsalGuardrails } from '@/server/evaluation-2026-dryrun-rehearsal-guardrails'
import type { Evaluation2026FastForwardOperationsCockpit } from '@/server/evaluation-2026-fast-forward-operations'
import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'
import type { Evaluation2026ReadinessPopulationDryRun } from '@/server/evaluation-2026-readiness-population'

export type Evaluation2026DryRunGoNoGoStatus = 'NO_GO' | 'READY_FOR_REVIEW' | 'READY_LATER'
export type Evaluation2026DryRunGoNoGoApplyStatus = 'NOT_ALLOWED' | 'BLOCKED' | 'READY_LATER'
export type Evaluation2026DryRunGoConditionStatus = 'READY' | 'BLOCKED' | 'OPEN' | 'READY_LATER'

export type Evaluation2026DryRunGoCondition = {
  id: string
  label: string
  status: Evaluation2026DryRunGoConditionStatus
  blockerCount: number | null
  source: string
  nextAction: string
  blocksDryRunReview: boolean
}

export type Evaluation2026DryRunGoNoGoFreezePack = {
  mode: 'READ_ONLY'
  status: 'AVAILABLE'
  generatedAt: string
  decision: {
    currentDecision: Evaluation2026DryRunGoNoGoStatus
    dryRunReviewStatus: Evaluation2026DryRunGoNoGoStatus
    applyStatus: 'NOT_ALLOWED'
    explanationKo: string
    missingGoConditionsCount: number
    nextCheckpointAction: string
  }
  noGoReasons: Evaluation2026DryRunGoCondition[]
  goConditions: Evaluation2026DryRunGoCondition[]
  unresolvedBlockerSummary: Array<{
    id: string
    label: string
    count: number
    source: string
    nextAction: string
  }>
  requiredEvidencePack: string[]
  hrUnlockActions: string[]
  developerUnlockActions: string[]
  signOffChecklist: string[]
  nextCheckpoint: {
    name: string
    requiredBeforeAfterSnapshot: string
    deltaTableRequired: string[]
    decisionOwner: string
    stillProhibitedActions: string[]
  }
  prohibitedActions: string[]
  copyPayloads: {
    goNoGoSummary: string
    noGoReasons: string
    goConditions: string
    requiredEvidencePack: string
    hrUnlockActions: string
    developerUnlockActions: string
    signOffChecklist: string
    nextCheckpoint: string
    prohibitedActions: string
    markdown: string
    tsv: string
  }
  safety: {
    writesPerformed: false
    dryRunExecuted: false
    backfillExecuted: false
    backfillApplyExecuted: false
    migrationsRun: false
    featureFlagsChanged: false
    totalScoreChanged: false
    gradeIdChanged: false
    evaluationsCreated: 0
    evaluationItemsCreated: 0
    officialScoringEnabled: false
    officialGradeEnabled: false
    officialAiScoreExclusionEnabled: false
    notificationsSent: false
    emailsSent: false
    metadataSaved: false
    noDryRunExecutionButtons: true
    noBackfillExecutionButtons: true
    noApplyButtons: true
    noScoreGradeWriteButtons: true
    noMetadataSaveButtons: true
  }
}

const PROHIBITED_ACTIONS = [
  'dry-run execution from UI',
  'backfill --apply',
  'apply command execution',
  'official scoring activation',
  'official grade activation',
  'AI score exclusion activation',
  'Evaluation.totalScore write',
  'Evaluation.gradeId write',
  'feature flag changes',
  'production data mutation',
  'UI-triggered backfill',
  'UI-triggered score/grade write',
]

const REQUIRED_EVIDENCE_PACK = [
  'integrated readiness snapshot export',
  'execution board export',
  'Fast-Forward cockpit export',
  'Preflight checklist export',
  'Command Runbook export',
  'DB backup proof',
  'HR approval note',
  'Vercel log watch plan',
  'dry-run output archive location',
]

const HR_UNLOCK_ACTIONS = [
  'clear MBO coverage',
  'clear Team KPI pending',
  'clear policyCategory',
  'clear evaluator routing',
  'collect HR approval for dry-run review only',
  'confirm backup owner',
]

const DEVELOPER_UNLOCK_ACTIONS = [
  'verify main commit',
  'verify environment flags',
  'verify dry-run command reference',
  'prepare output archive',
  'prepare log watch',
  'do not run apply',
  'do not toggle flags',
]

const SIGN_OFF_CHECKLIST = [
  'HR sign-off',
  'Developer sign-off',
  'DB backup owner sign-off',
  'Reviewer sign-off',
  'Final dry-run review only acknowledgement',
]

const SAFETY_NOTE =
  '이 export는 읽기 전용 보고용입니다. dry-run, apply, backfill, official scoring/grade, feature flag, Evaluation.totalScore, Evaluation.gradeId는 실행하지 않습니다.'

function valueOrZero(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function statusForCount(count: number | null | undefined): Evaluation2026DryRunGoConditionStatus {
  return valueOrZero(count) > 0 ? 'BLOCKED' : 'READY'
}

function buildCondition(params: {
  id: string
  label: string
  blockerCount: number | null | undefined
  source: string
  nextAction: string
  blocksDryRunReview?: boolean
}): Evaluation2026DryRunGoCondition {
  const count = params.blockerCount == null ? null : valueOrZero(params.blockerCount)
  const status = statusForCount(count)
  return {
    id: params.id,
    label: params.label,
    status,
    blockerCount: count,
    source: params.source,
    nextAction: params.nextAction,
    blocksDryRunReview: params.blocksDryRunReview ?? true,
  }
}

function buildOpenCondition(params: {
  id: string
  label: string
  isReady: boolean
  source: string
  nextAction: string
  readyLater?: boolean
}): Evaluation2026DryRunGoCondition {
  return {
    id: params.id,
    label: params.label,
    status: params.isReady ? 'READY' : params.readyLater ? 'READY_LATER' : 'OPEN',
    blockerCount: params.isReady ? 0 : 1,
    source: params.source,
    nextAction: params.nextAction,
    blocksDryRunReview: !params.isReady,
  }
}

function buildConditions(params: {
  snapshot: Evaluation2026IntegratedReadinessSnapshot
  preflight: Evaluation2026BackfillDryRunPreflightPack
  outputTemplate: Evaluation2026DryRunOutputReviewTemplate
  rehearsal: Evaluation2026DryRunRehearsalGuardrails
  commandRunbook: Evaluation2026BackfillDryRunCommandRunbook
  fastForwardOperationsCockpit: Evaluation2026FastForwardOperationsCockpit
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
}) {
  const summary = params.snapshot.summary
  const activeEmployeeCount = summary.activeEmployeeCount
  const confirmedPersonalKpiCount = summary.confirmedPersonalKpiCount
  const confirmedKpiShortage = params.populationDryRun?.employeesMissingConfirmedPersonalKpiCount
    ?? (activeEmployeeCount != null && confirmedPersonalKpiCount != null
      ? Math.max(activeEmployeeCount - confirmedPersonalKpiCount, 0)
      : null)
  const feedbackLeadershipBlockerCount =
    summary.feedbackLeadershipBlockerCount ?? params.populationDryRun?.finalizationCeoReadiness?.summary.feedbackLeadershipBlockerCount ?? null
  const aiReadinessBlockerCount =
    summary.aiReadinessBlockerCount ?? params.populationDryRun?.finalizationCeoReadiness?.summary.aiReadinessBlockerCount ?? null

  return [
    buildCondition({
      id: 'OFFICIAL_GATE_BLOCKERS_ZERO',
      label: 'official activation gate blockers = 0',
      blockerCount: summary.officialActivationGateBlockerCount ?? params.preflight.preflightSummary.blockerCount,
      source: '2026 공식 전환 Gate',
      nextAction: 'official activation gate blocker를 모두 해소하거나 승인된 예외를 문서화하세요.',
    }),
    buildCondition({
      id: 'MBO_MISSING_ZERO',
      label: 'MBO missing 0 or approved exclusions',
      blockerCount: summary.missingMboCount,
      source: '2026 통합 readiness snapshot',
      nextAction: 'MBO 작성/제출/확정 또는 명시적 제외 대상을 정리하세요.',
    }),
    buildCondition({
      id: 'CONFIRMED_KPI_COVERAGE_SUFFICIENT',
      label: 'confirmed KPI coverage sufficient',
      blockerCount: confirmedKpiShortage,
      source: 'MBO setup readiness',
      nextAction: 'confirmed PersonalKpi coverage 부족분을 해소하세요.',
    }),
    buildCondition({
      id: 'TEAM_KPI_PENDING_ZERO',
      label: 'Team KPI pending 0',
      blockerCount: summary.teamKpiPendingCount,
      source: 'Team KPI HR review',
      nextAction: 'Team KPI pending/discussion 항목을 검토하고 HR 결정이 명확한 건만 처리하세요.',
    }),
    buildCondition({
      id: 'POLICY_CATEGORY_ZERO',
      label: 'policyCategory missing 0',
      blockerCount: summary.policyCategoryMissingCount,
      source: 'policyCategory workbench',
      nextAction: 'policyCategory 미분류 항목을 0건으로 정리하세요.',
    }),
    buildCondition({
      id: 'EVALUATOR_ROUTING_READY',
      label: 'evaluator blockers 0 or approved exceptions',
      blockerCount: summary.evaluatorRoutingBlockerCount,
      source: 'performance assignments',
      nextAction: '평가자 배정 blocker를 해소하거나 승인 예외를 문서화하세요.',
    }),
    buildCondition({
      id: 'SCORE_POLICY_BLOCKERS_ZERO',
      label: 'score policy blockers 0',
      blockerCount: summary.scorePolicyBlockerCount,
      source: 'score policy readiness',
      nextAction: 'score policy blocker와 AI exclusion 정책 확인을 완료하세요.',
    }),
    buildCondition({
      id: 'GRADE_POLICY_BLOCKERS_ZERO',
      label: 'grade policy blockers 0',
      blockerCount: summary.gradePolicyBlockerCount,
      source: 'grade policy readiness',
      nextAction: 'grade policy blocker를 0건으로 정리하세요.',
    }),
    buildCondition({
      id: 'RESULT_WRITING_REVIEWED',
      label: 'result-writing readiness reviewed',
      blockerCount: summary.resultWritingBlockerCount,
      source: 'result-writing readiness',
      nextAction: '수행결과 작성 readiness 경고를 검토하세요.',
    }),
    buildCondition({
      id: 'LEADER_EVALUATION_REVIEWED',
      label: 'leader evaluation readiness reviewed',
      blockerCount: summary.leaderEvaluationBlockerCount,
      source: 'leader evaluation readiness',
      nextAction: '리더 평가 readiness blocker를 검토하고 다음 운영 단계를 정리하세요.',
    }),
    buildCondition({
      id: 'FINALIZATION_CEO_REVIEWED',
      label: 'finalization/CEO readiness reviewed',
      blockerCount: summary.finalizationCeoBlockerCount,
      source: 'finalization/CEO readiness',
      nextAction: 'finalization/CEO readiness blocker를 확인하고 후속 체크리스트를 유지하세요.',
    }),
    buildCondition({
      id: 'AI_360_READINESS_REVIEWED',
      label: 'AI/360 readiness reviewed',
      blockerCount: valueOrZero(feedbackLeadershipBlockerCount) + valueOrZero(aiReadinessBlockerCount),
      source: 'AI Pass/Fail and 360/leadership readiness',
      nextAction: 'AI Pass/Fail, 360/leadership readiness를 annual score와 분리해서 검토하세요.',
    }),
    buildOpenCondition({
      id: 'DB_BACKUP_CONFIRMED',
      label: 'DB backup confirmed',
      isReady: params.preflight.preflightSummary.dbBackupStatus === 'CONFIRMED_EXTERNALLY',
      readyLater: true,
      source: 'Backfill Dry-run Preflight Pack',
      nextAction: 'DB backup owner, timestamp, restore contact, rollback evidence를 수집하세요.',
    }),
    buildOpenCondition({
      id: 'HR_APPROVAL_COLLECTED',
      label: 'HR approval collected',
      isReady: params.preflight.preflightSummary.hrApprovalStatus === 'COLLECTED_EXTERNALLY',
      readyLater: true,
      source: 'Backfill Dry-run Preflight Pack',
      nextAction: 'HR approval note는 dry-run review only 범위로 수집하고 apply 승인은 제외하세요.',
    }),
    buildOpenCondition({
      id: 'OUTPUT_REVIEW_TEMPLATE_READY',
      label: 'dry-run output review template ready',
      isReady: params.outputTemplate.templateStatus === 'AVAILABLE',
      source: 'Dry-run Output Review Template',
      nextAction: 'dry-run output review template availability와 local-only paste helper를 확인하세요.',
    }),
    buildOpenCondition({
      id: 'COMMAND_RUNBOOK_REVIEWED',
      label: 'dry-run command runbook reviewed',
      isReady: params.commandRunbook.status === 'AVAILABLE' && params.commandRunbook.dryRunOnlyCommandReference.executeAvailable === false,
      source: 'Backfill Dry-run Command Runbook',
      nextAction: 'command reference가 text-only이고 apply command가 숨김 상태인지 확인하세요.',
    }),
    buildOpenCondition({
      id: 'FAST_FORWARD_PATH_REVIEWED',
      label: 'Fast-Forward minimum safe path reviewed',
      isReady: params.fastForwardOperationsCockpit.minimumSafePathToBackfillDryRunReview.length > 0,
      source: 'Fast-Forward Operations Cockpit',
      nextAction: 'minimum safe path to backfill dry-run review와 owner action queue를 확인하세요.',
    }),
    buildOpenCondition({
      id: 'OFFICIAL_FLAGS_REMAIN_FALSE',
      label: 'official flags remain false',
      isReady:
        params.rehearsal.safety.officialScoringEnabled === false &&
        params.rehearsal.safety.officialGradeEnabled === false &&
        params.rehearsal.safety.officialAiScoreExclusionEnabled === false,
      source: 'Dry-run Rehearsal & Guardrails',
      nextAction: 'official scoring/grade/AI exclusion flag는 dry-run review 전후 모두 false로 유지하세요.',
    }),
  ]
}

function buildDecision(conditions: Evaluation2026DryRunGoCondition[]) {
  const readinessBlockers = conditions.filter((item) =>
    item.blocksDryRunReview &&
    item.status === 'BLOCKED' &&
    !['DB_BACKUP_CONFIRMED', 'HR_APPROVAL_COLLECTED'].includes(item.id)
  )
  const backupOrApprovalOpen = conditions.some((item) =>
    ['DB_BACKUP_CONFIRMED', 'HR_APPROVAL_COLLECTED'].includes(item.id) &&
    item.status !== 'READY'
  )
  if (readinessBlockers.length > 0) {
    return 'NO_GO' as const
  }
  if (backupOrApprovalOpen) {
    return 'READY_LATER' as const
  }
  return 'READY_FOR_REVIEW' as const
}

function buildExplanation(decision: Evaluation2026DryRunGoNoGoStatus, reasons: Evaluation2026DryRunGoCondition[]) {
  if (decision === 'READY_FOR_REVIEW') {
    return '현재 dry-run review 전제 조건이 충족되어 검토 준비 상태입니다. 단, apply는 여전히 별도 승인 전까지 NOT_ALLOWED입니다.'
  }
  if (decision === 'READY_LATER') {
    return 'readiness blocker는 해소된 상태로 보이나 DB backup 또는 HR dry-run review approval evidence가 아직 필요합니다. apply는 논의 대상이 아닙니다.'
  }
  const topReasons = reasons.slice(0, 4).map((item) => item.label).join(', ')
  return `현재 future dry-run review는 NO-GO입니다. 주요 미충족 조건은 ${topReasons || 'readiness blocker'}이며, dry-run/apply/backfill/공식 점수/등급 실행은 계속 금지됩니다.`
}

function buildTextList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildConditionText(items: Evaluation2026DryRunGoCondition[]) {
  return items.map((item) => [
    `- ${item.label}`,
    `status: ${item.status}`,
    `count: ${item.blockerCount ?? 'n/a'}`,
    `source: ${item.source}`,
    `next: ${item.nextAction}`,
  ].join(' | ')).join('\n')
}

function buildSummaryText(params: {
  decision: Evaluation2026DryRunGoNoGoFreezePack['decision']
}) {
  return [
    `decision: ${params.decision.currentDecision}`,
    `dry-run review status: ${params.decision.dryRunReviewStatus}`,
    `apply status: ${params.decision.applyStatus}`,
    `missing go conditions: ${params.decision.missingGoConditionsCount}`,
    `next checkpoint action: ${params.decision.nextCheckpointAction}`,
    params.decision.explanationKo,
  ].join('\n')
}

function buildMarkdown(params: {
  decision: Evaluation2026DryRunGoNoGoFreezePack['decision']
  noGoReasons: Evaluation2026DryRunGoCondition[]
  goConditions: Evaluation2026DryRunGoCondition[]
  requiredEvidencePack: string[]
  hrUnlockActions: string[]
  developerUnlockActions: string[]
  signOffChecklist: string[]
  nextCheckpoint: Evaluation2026DryRunGoNoGoFreezePack['nextCheckpoint']
}) {
  return [
    '# 2026 Dry-run Go/No-Go Freeze Pack',
    '',
    '## Decision',
    buildSummaryText({ decision: params.decision }),
    '',
    '## No-go reasons',
    buildConditionText(params.noGoReasons),
    '',
    '## Go conditions',
    buildConditionText(params.goConditions),
    '',
    '## Required evidence pack',
    buildTextList(params.requiredEvidencePack),
    '',
    '## HR unlock actions',
    buildTextList(params.hrUnlockActions),
    '',
    '## Developer unlock actions',
    buildTextList(params.developerUnlockActions),
    '',
    '## Sign-off checklist',
    buildTextList(params.signOffChecklist),
    '',
    '## Next checkpoint',
    `- name: ${params.nextCheckpoint.name}`,
    `- before/after snapshot: ${params.nextCheckpoint.requiredBeforeAfterSnapshot}`,
    `- decision owner: ${params.nextCheckpoint.decisionOwner}`,
    buildTextList(params.nextCheckpoint.deltaTableRequired),
    '',
    '## Prohibited actions',
    buildTextList(params.nextCheckpoint.stillProhibitedActions),
    '',
    '## Safety note',
    SAFETY_NOTE,
  ].join('\n')
}

function buildTsv(params: {
  decision: Evaluation2026DryRunGoNoGoFreezePack['decision']
  noGoReasons: Evaluation2026DryRunGoCondition[]
  goConditions: Evaluation2026DryRunGoCondition[]
}) {
  return [
    ['section', 'id', 'label', 'status', 'count', 'source', 'nextAction'].join('\t'),
    ['decision', 'CURRENT_DECISION', 'current decision', params.decision.currentDecision, params.decision.missingGoConditionsCount, 'go/no-go freeze', params.decision.nextCheckpointAction].join('\t'),
    ...params.goConditions.map((item) => [
      'go_condition',
      item.id,
      item.label,
      item.status,
      item.blockerCount ?? '',
      item.source,
      item.nextAction,
    ].join('\t')),
    ...params.noGoReasons.map((item) => [
      'no_go_reason',
      item.id,
      item.label,
      item.status,
      item.blockerCount ?? '',
      item.source,
      item.nextAction,
    ].join('\t')),
    ...PROHIBITED_ACTIONS.map((item) => ['prohibited', item, item, 'FORBIDDEN', '', 'freeze pack', 'do not execute'].join('\t')),
  ].join('\n')
}

export function buildEvaluation2026DryRunGoNoGoFreezePack(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  backfillDryRunPreflightPack: Evaluation2026BackfillDryRunPreflightPack
  dryRunOutputReviewTemplate: Evaluation2026DryRunOutputReviewTemplate
  dryRunRehearsalGuardrails: Evaluation2026DryRunRehearsalGuardrails
  backfillDryRunCommandRunbook: Evaluation2026BackfillDryRunCommandRunbook
  fastForwardOperationsCockpit: Evaluation2026FastForwardOperationsCockpit
  populationDryRun: Evaluation2026ReadinessPopulationDryRun | null
}): Evaluation2026DryRunGoNoGoFreezePack {
  const goConditions = buildConditions({
    snapshot: params.integratedReadinessSnapshot,
    preflight: params.backfillDryRunPreflightPack,
    outputTemplate: params.dryRunOutputReviewTemplate,
    rehearsal: params.dryRunRehearsalGuardrails,
    commandRunbook: params.backfillDryRunCommandRunbook,
    fastForwardOperationsCockpit: params.fastForwardOperationsCockpit,
    populationDryRun: params.populationDryRun,
  })
  const noGoReasons = goConditions.filter((item) => item.status !== 'READY')
  const currentDecision = buildDecision(goConditions)
  const nextOpenCondition = noGoReasons[0]
  const missingGoConditionsCount = noGoReasons.length
  const decision: Evaluation2026DryRunGoNoGoFreezePack['decision'] = {
    currentDecision,
    dryRunReviewStatus: currentDecision,
    applyStatus: 'NOT_ALLOWED',
    explanationKo: buildExplanation(currentDecision, noGoReasons),
    missingGoConditionsCount,
    nextCheckpointAction: nextOpenCondition?.nextAction ?? 'dry-run output review owner, DB backup proof, HR approval note를 최종 확인하세요.',
  }
  const unresolvedBlockerSummary = goConditions
    .filter((item) => valueOrZero(item.blockerCount) > 0)
    .map((item) => ({
      id: item.id,
      label: item.label,
      count: valueOrZero(item.blockerCount),
      source: item.source,
      nextAction: item.nextAction,
    }))
  const nextCheckpoint: Evaluation2026DryRunGoNoGoFreezePack['nextCheckpoint'] = {
    name: 'Dry-run Review Readiness Checkpoint',
    requiredBeforeAfterSnapshot: 'updated integrated readiness snapshot and execution board export after HR blocker cleanup',
    deltaTableRequired: [
      'MBO missing',
      'confirmed KPI shortage',
      'Team KPI pending',
      'policyCategory missing',
      'evaluator routing blockers',
      'score/grade policy blockers',
      'official gate blockers',
    ],
    decisionOwner: 'HR admin + developer watch owner',
    stillProhibitedActions: PROHIBITED_ACTIONS,
  }
  const markdown = buildMarkdown({
    decision,
    noGoReasons,
    goConditions,
    requiredEvidencePack: REQUIRED_EVIDENCE_PACK,
    hrUnlockActions: HR_UNLOCK_ACTIONS,
    developerUnlockActions: DEVELOPER_UNLOCK_ACTIONS,
    signOffChecklist: SIGN_OFF_CHECKLIST,
    nextCheckpoint,
  })
  const tsv = buildTsv({ decision, noGoReasons, goConditions })

  return {
    mode: 'READ_ONLY',
    status: 'AVAILABLE',
    generatedAt: new Date().toISOString(),
    decision,
    noGoReasons,
    goConditions,
    unresolvedBlockerSummary,
    requiredEvidencePack: REQUIRED_EVIDENCE_PACK,
    hrUnlockActions: HR_UNLOCK_ACTIONS,
    developerUnlockActions: DEVELOPER_UNLOCK_ACTIONS,
    signOffChecklist: SIGN_OFF_CHECKLIST,
    nextCheckpoint,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      goNoGoSummary: buildSummaryText({ decision }),
      noGoReasons: buildConditionText(noGoReasons),
      goConditions: buildConditionText(goConditions),
      requiredEvidencePack: buildTextList(REQUIRED_EVIDENCE_PACK),
      hrUnlockActions: buildTextList(HR_UNLOCK_ACTIONS),
      developerUnlockActions: buildTextList(DEVELOPER_UNLOCK_ACTIONS),
      signOffChecklist: buildTextList(SIGN_OFF_CHECKLIST),
      nextCheckpoint: [
        `name: ${nextCheckpoint.name}`,
        `before/after snapshot: ${nextCheckpoint.requiredBeforeAfterSnapshot}`,
        `decision owner: ${nextCheckpoint.decisionOwner}`,
        buildTextList(nextCheckpoint.deltaTableRequired),
      ].join('\n'),
      prohibitedActions: buildTextList(PROHIBITED_ACTIONS),
      markdown,
      tsv,
    },
    safety: {
      writesPerformed: false,
      dryRunExecuted: false,
      backfillExecuted: false,
      backfillApplyExecuted: false,
      migrationsRun: false,
      featureFlagsChanged: false,
      totalScoreChanged: false,
      gradeIdChanged: false,
      evaluationsCreated: 0,
      evaluationItemsCreated: 0,
      officialScoringEnabled: false,
      officialGradeEnabled: false,
      officialAiScoreExclusionEnabled: false,
      notificationsSent: false,
      emailsSent: false,
      metadataSaved: false,
      noDryRunExecutionButtons: true,
      noBackfillExecutionButtons: true,
      noApplyButtons: true,
      noScoreGradeWriteButtons: true,
      noMetadataSaveButtons: true,
    },
  }
}
