import type { Evaluation2026BackfillDryRunPreflightPack } from '@/server/evaluation-2026-backfill-dryrun-preflight'
import type { Evaluation2026DryRunOutputReviewTemplate } from '@/server/evaluation-2026-dryrun-output-review-template'
import type { Evaluation2026DryRunRehearsalGuardrails } from '@/server/evaluation-2026-dryrun-rehearsal-guardrails'
import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'

export type Evaluation2026BackfillDryRunCommandRunbook = {
  mode: 'READ_ONLY'
  status: 'AVAILABLE'
  generatedAt: string
  summary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    commandReferenceStatus: 'REFERENCE_ONLY'
    dryRunExecutionStatus: 'NOT_EXECUTED'
    applyStatus: 'PROHIBITED'
    outputReviewTemplateStatus: Evaluation2026DryRunOutputReviewTemplate['templateStatus']
    guardrailStatus: Evaluation2026DryRunRehearsalGuardrails['status']
    nextAction: string
  }
  operatorSummary: {
    purpose: string
    currentStatus: string
    whenThisRunbookCanBeUsed: string
    whyApplyRemainsProhibited: string
  }
  preRunChecklist: string[]
  dryRunOnlyCommandReference: {
    label: string
    commandText: string
    mode: 'TEXT_ONLY'
    copyOnly: true
    executeAvailable: false
    warning: string
  }
  applyCommandWarning: {
    applyCommandExposed: false
    applyIsPartOfThisRunbook: false
    warning: string
    guardrailReminder: string[]
  }
  outputArchiveChecklist: string[]
  logWatchChecklist: string[]
  abortConditions: string[]
  handoffChecklist: string[]
  allowedCommands: string[]
  explicitlyForbiddenCommands: string[]
  prohibitedActions: string[]
  copyPayloads: {
    operatorSummary: string
    preRunChecklist: string
    dryRunCommandReference: string
    logWatchChecklist: string
    abortConditions: string
    handoffChecklist: string
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
    noDryRunExecutionButtons: true
    noBackfillExecutionButtons: true
    noApplyButtons: true
    noScoreGradeWriteButtons: true
    noCommandExecutionButtons: true
    dryRunCommandIsTextOnly: true
    applyCommandHidden: true
  }
}

const DRY_RUN_COMMAND_REFERENCE =
  'pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/dry-run-backfill-2026-policy-metadata.ts --year=2026 --json=reports/backfill-2026-policy-metadata/dry-run.json --csv=reports/backfill-2026-policy-metadata/dry-run.csv'

const PRE_RUN_CHECKLIST = [
  'official activation gate still blocked',
  'HR approval for dry-run review only',
  'DB backup plan documented',
  'production branch/commit identified',
  'target cycle confirmed',
  'target year confirmed',
  'policy version confirmed',
  'output archive location prepared',
  'log watch owner assigned',
  'rollback contact documented',
]

const APPLY_GUARDRAIL_REMINDER = [
  '--apply requires --confirm-2026-production-apply',
  '--apply requires --backup-confirmed',
  '--apply requires --hr-approved',
  '--apply requires --dry-run-output-reviewed',
  '--apply requires --target-cycle=<cycle-id>',
  '--apply requires --year=2026',
  '--apply requires --policy-version=<expected-policy-version>',
  'official scoring/grade/AI exclusion flags must remain false',
]

const OUTPUT_ARCHIVE_CHECKLIST = [
  'save stdout/stderr',
  'save JSON output',
  'record operator',
  'record timestamp',
  'record commit',
  'record environment',
  'attach to HR approval packet',
  'do not store sensitive personal data in public location',
]

const LOG_WATCH_CHECKLIST = [
  '500',
  'P2021',
  'P2022',
  'PrismaClientKnownRequestError',
  'schema errors',
  'JWT_SESSION_ERROR',
  'Evaluation.totalScore',
  'Evaluation.gradeId',
  'feature flag changes',
  'unexpected writes',
]

const ABORT_CONDITIONS = [
  'target cycle mismatch',
  'wrong branch/commit',
  'DB backup not confirmed',
  'HR approval missing',
  'output path not prepared',
  'dry-run command would include --apply',
  'official flags are true',
  'schema/runtime errors appear',
  'writesPerformed true',
  'totalScore/gradeId changes appear',
]

const HANDOFF_CHECKLIST = [
  'paste into local-only output review template',
  'check must-pass criteria',
  'check red flags',
  'produce decision outcome',
  'do not proceed to apply',
  'prepare HR review',
]

const ALLOWED_COMMANDS = [
  'git status --short',
  'git rev-parse HEAD',
  'git log origin/main --oneline -5',
  'vercel.cmd logs <deployment-url-or-id> --project kpi-pms --since 15m --no-follow',
  DRY_RUN_COMMAND_REFERENCE,
]

const EXPLICITLY_FORBIDDEN_COMMANDS = [
  'pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/backfill-2026-policy-metadata.ts --apply',
  'prisma migrate deploy',
  'pnpm.cmd exec prisma migrate deploy',
  'official scoring activation command',
  'official grade activation command',
  'AI score exclusion activation command',
  'feature flag write command',
]

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

function buildTextList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function buildOperatorSummaryText(summary: Evaluation2026BackfillDryRunCommandRunbook['operatorSummary']) {
  return [
    `purpose: ${summary.purpose}`,
    `current status: ${summary.currentStatus}`,
    `when this runbook can be used: ${summary.whenThisRunbookCanBeUsed}`,
    `why apply remains prohibited: ${summary.whyApplyRemainsProhibited}`,
  ].join('\n')
}

function buildCommandReferenceText(command: Evaluation2026BackfillDryRunCommandRunbook['dryRunOnlyCommandReference']) {
  return [
    command.label,
    `mode: ${command.mode}`,
    `copyOnly: ${String(command.copyOnly)}`,
    `executeAvailable: ${String(command.executeAvailable)}`,
    command.commandText,
    `warning: ${command.warning}`,
  ].join('\n')
}

function buildMarkdown(params: {
  summary: Evaluation2026BackfillDryRunCommandRunbook['summary']
  operatorSummary: Evaluation2026BackfillDryRunCommandRunbook['operatorSummary']
  command: Evaluation2026BackfillDryRunCommandRunbook['dryRunOnlyCommandReference']
  applyWarning: Evaluation2026BackfillDryRunCommandRunbook['applyCommandWarning']
}) {
  return [
    '# 2026 Backfill Dry-run Command Runbook',
    '',
    '## Operator summary',
    buildOperatorSummaryText(params.operatorSummary),
    '',
    '## Status',
    `- current stage: ${params.summary.currentStage}`,
    `- overall readiness status: ${params.summary.overallReadinessStatus}`,
    `- official activation status: ${params.summary.officialActivationStatus}`,
    `- command reference status: ${params.summary.commandReferenceStatus}`,
    `- dry-run execution status: ${params.summary.dryRunExecutionStatus}`,
    `- apply status: ${params.summary.applyStatus}`,
    '',
    '## Pre-run checklist',
    buildTextList(PRE_RUN_CHECKLIST),
    '',
    '## Dry-run-only command reference',
    buildCommandReferenceText(params.command),
    '',
    '## Apply command warning',
    `- apply command exposed: ${String(params.applyWarning.applyCommandExposed)}`,
    `- apply is part of this runbook: ${String(params.applyWarning.applyIsPartOfThisRunbook)}`,
    `- warning: ${params.applyWarning.warning}`,
    buildTextList(params.applyWarning.guardrailReminder),
    '',
    '## Output archive checklist',
    buildTextList(OUTPUT_ARCHIVE_CHECKLIST),
    '',
    '## Log watch checklist',
    buildTextList(LOG_WATCH_CHECKLIST),
    '',
    '## Abort conditions',
    buildTextList(ABORT_CONDITIONS),
    '',
    '## Handoff checklist',
    buildTextList(HANDOFF_CHECKLIST),
    '',
    '## Allowed commands',
    buildTextList(ALLOWED_COMMANDS),
    '',
    '## Explicitly forbidden commands',
    buildTextList(EXPLICITLY_FORBIDDEN_COMMANDS),
    '',
    '## Prohibited actions',
    buildTextList(PROHIBITED_ACTIONS),
  ].join('\n')
}

function buildTsv(params: {
  summary: Evaluation2026BackfillDryRunCommandRunbook['summary']
  command: Evaluation2026BackfillDryRunCommandRunbook['dryRunOnlyCommandReference']
}) {
  return [
    ['section', 'id', 'label', 'status', 'detail'].join('\t'),
    ['summary', 'COMMAND_REFERENCE', 'dry-run command reference', params.summary.commandReferenceStatus, params.command.commandText].join('\t'),
    ['summary', 'DRY_RUN_EXECUTION', 'dry-run execution status', params.summary.dryRunExecutionStatus, 'not executed by this UI or PR'].join('\t'),
    ['summary', 'APPLY_STATUS', 'apply status', params.summary.applyStatus, 'apply command hidden and prohibited'].join('\t'),
    ...PRE_RUN_CHECKLIST.map((item) => ['pre_run', item, item, 'check', 'required before future dry-run review'].join('\t')),
    ...OUTPUT_ARCHIVE_CHECKLIST.map((item) => ['archive', item, item, 'check', 'required after future dry-run output exists'].join('\t')),
    ...LOG_WATCH_CHECKLIST.map((item) => ['log_watch', item, item, 'watch', 'abort or investigate if observed'].join('\t')),
    ...ABORT_CONDITIONS.map((item) => ['abort', item, item, 'abort', 'do not continue'].join('\t')),
    ...HANDOFF_CHECKLIST.map((item) => ['handoff', item, item, 'review', 'output review template'].join('\t')),
    ...PROHIBITED_ACTIONS.map((item) => ['prohibited', item, item, 'forbidden', 'not exposed in UI'].join('\t')),
  ].join('\n')
}

export function buildEvaluation2026BackfillDryRunCommandRunbook(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  backfillDryRunPreflightPack: Evaluation2026BackfillDryRunPreflightPack
  dryRunOutputReviewTemplate: Evaluation2026DryRunOutputReviewTemplate
  dryRunRehearsalGuardrails: Evaluation2026DryRunRehearsalGuardrails
}): Evaluation2026BackfillDryRunCommandRunbook {
  const summary: Evaluation2026BackfillDryRunCommandRunbook['summary'] = {
    currentStage: params.integratedReadinessSnapshot.currentStage,
    overallReadinessStatus: params.integratedReadinessSnapshot.overallStatus,
    officialActivationStatus: params.backfillDryRunPreflightPack.preflightSummary.officialActivationStatus,
    commandReferenceStatus: 'REFERENCE_ONLY',
    dryRunExecutionStatus: 'NOT_EXECUTED',
    applyStatus: 'PROHIBITED',
    outputReviewTemplateStatus: params.dryRunOutputReviewTemplate.templateStatus,
    guardrailStatus: params.dryRunRehearsalGuardrails.status,
    nextAction: 'future dry-run-only 실행 전 HR dry-run review approval, DB backup plan, target cycle, branch/commit, output archive 위치를 먼저 확인하세요.',
  }
  const operatorSummary = {
    purpose: '향후 2026 policy metadata dry-run-only 실행 절차를 표준화합니다.',
    currentStatus: '공식 activation은 BLOCKED이며, 이 runbook은 명령 실행이 아니라 operator 절차 문서입니다.',
    whenThisRunbookCanBeUsed: 'Preflight missing 조건이 정리되고 HR이 dry-run review only 범위를 승인한 뒤 참고합니다.',
    whyApplyRemainsProhibited: 'apply는 별도 승인, DB backup, dry-run output review, target-cycle 확인, gate READY 전까지 금지입니다.',
  }
  const dryRunOnlyCommandReference = {
    label: 'Dry-run-only command reference: copy-only / UI 실행 금지',
    commandText: DRY_RUN_COMMAND_REFERENCE,
    mode: 'TEXT_ONLY' as const,
    copyOnly: true as const,
    executeAvailable: false as const,
    warning: '복사 전용입니다. UI에서 실행하지 않으며, preconditions 충족 전에는 실행하지 않습니다. --apply를 추가하지 마세요.',
  }
  const applyCommandWarning = {
    applyCommandExposed: false as const,
    applyIsPartOfThisRunbook: false as const,
    warning: 'apply command is hidden / not provided. apply is prohibited until separate approval and gate readiness.',
    guardrailReminder: APPLY_GUARDRAIL_REMINDER,
  }
  const markdown = buildMarkdown({
    summary,
    operatorSummary,
    command: dryRunOnlyCommandReference,
    applyWarning: applyCommandWarning,
  })
  const tsv = buildTsv({
    summary,
    command: dryRunOnlyCommandReference,
  })

  return {
    mode: 'READ_ONLY',
    status: 'AVAILABLE',
    generatedAt: new Date().toISOString(),
    summary,
    operatorSummary,
    preRunChecklist: PRE_RUN_CHECKLIST,
    dryRunOnlyCommandReference,
    applyCommandWarning,
    outputArchiveChecklist: OUTPUT_ARCHIVE_CHECKLIST,
    logWatchChecklist: LOG_WATCH_CHECKLIST,
    abortConditions: ABORT_CONDITIONS,
    handoffChecklist: HANDOFF_CHECKLIST,
    allowedCommands: ALLOWED_COMMANDS,
    explicitlyForbiddenCommands: EXPLICITLY_FORBIDDEN_COMMANDS,
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      operatorSummary: buildOperatorSummaryText(operatorSummary),
      preRunChecklist: buildTextList(PRE_RUN_CHECKLIST),
      dryRunCommandReference: buildCommandReferenceText(dryRunOnlyCommandReference),
      logWatchChecklist: buildTextList(LOG_WATCH_CHECKLIST),
      abortConditions: buildTextList(ABORT_CONDITIONS),
      handoffChecklist: buildTextList(HANDOFF_CHECKLIST),
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
      noDryRunExecutionButtons: true,
      noBackfillExecutionButtons: true,
      noApplyButtons: true,
      noScoreGradeWriteButtons: true,
      noCommandExecutionButtons: true,
      dryRunCommandIsTextOnly: true,
      applyCommandHidden: true,
    },
  }
}
