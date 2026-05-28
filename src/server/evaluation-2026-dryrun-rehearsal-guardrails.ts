import type { Evaluation2026BackfillDryRunPreflightPack } from '@/server/evaluation-2026-backfill-dryrun-preflight'
import type { Evaluation2026DryRunOutputReviewTemplate } from '@/server/evaluation-2026-dryrun-output-review-template'
import type { Evaluation2026IntegratedReadinessSnapshot } from '@/server/evaluation-2026-integrated-readiness-snapshot'

export type Evaluation2026DryRunScriptSurfaceInventoryItem = {
  scriptName: string
  purpose: string
  dryRunAvailable: boolean
  applyCapable: boolean
  applyTrigger: string
  writesEvaluation: 'yes' | 'no' | 'unknown'
  writesEvaluationItem: 'yes' | 'no' | 'unknown'
  writesEvaluationTotalScore: 'yes' | 'no' | 'unknown'
  writesEvaluationGradeId: 'yes' | 'no' | 'unknown'
  requiresExplicitApply: boolean
  currentGuardrails: string[]
  missingGuardrails: string[]
  recommendedSafeUse: string
}

export type Evaluation2026DryRunFixtureExample = {
  fileName: string
  label: string
  expectedClassification:
    | 'PASS_FOR_REVIEW'
    | 'NEEDS_HR_FIX'
    | 'NEEDS_DEVELOPER_FIX'
    | 'REJECT_DRY_RUN_OUTPUT'
  expectedRedFlags: string[]
  nextAction: string
}

export type Evaluation2026DryRunRehearsalGuardrails = {
  mode: 'READ_ONLY'
  status: 'AVAILABLE'
  generatedAt: string
  summary: {
    currentStage: Evaluation2026IntegratedReadinessSnapshot['currentStage']
    overallReadinessStatus: Evaluation2026IntegratedReadinessSnapshot['overallStatus']
    officialActivationStatus: 'BLOCKED' | 'READY_FOR_REVIEW' | 'READY_LATER'
    scriptInventoryCount: number
    applyCapableScriptCount: number
    fixtureExampleCount: number
    reviewerStatus: 'AVAILABLE'
    localOnlyPasteValidatorStatus: 'LOCAL_ONLY'
    applyStatus: 'PROHIBITED_UNTIL_GATE_READY'
    nextAction: string
  }
  scriptSurfaceInventory: Evaluation2026DryRunScriptSurfaceInventoryItem[]
  applyGuardrailStatus: Array<{
    id: string
    label: string
    status: 'REQUIRED' | 'CONFIRMED_IN_CODE' | 'EXTERNAL_CONFIRMATION_REQUIRED'
    evidence: string
  }>
  fixtureRehearsalExamples: Evaluation2026DryRunFixtureExample[]
  reviewerDecisionGuide: Array<{
    classification: Evaluation2026DryRunFixtureExample['expectedClassification']
    meaning: string
    nextAction: string
  }>
  redFlagMatrix: Array<{
    id: string
    label: string
    severity: 'HR_FIX' | 'DEVELOPER_FIX' | 'REJECT'
    nextAction: string
  }>
  localOnlyPasteValidator: {
    enabled: true
    serverSubmitAvailable: false
    saveAvailable: false
    uploadAvailable: false
    apiCallAvailable: false
    persistenceAvailable: false
    guidance: string
  }
  prohibitedActions: string[]
  copyPayloads: {
    scriptInventory: string
    guardrailChecklist: string
    fixtureRehearsalGuide: string
    redFlagMatrix: string
    reviewerDecisionGuide: string
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
    noExecutionButtons: true
    noDryRunExecutionButtons: true
    noBackfillExecutionButtons: true
    noApplyButtons: true
    noScoreGradeWriteButtons: true
    noServerSubmit: true
    noUpload: true
    noPersistence: true
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

const SCRIPT_SURFACE_INVENTORY: Evaluation2026DryRunScriptSurfaceInventoryItem[] = [
  {
    scriptName: 'scripts/dry-run-backfill-2026-policy-metadata.ts',
    purpose: '2026 policyCategory / AI route metadata backfill 후보를 dry-run report로 산출',
    dryRunAvailable: true,
    applyCapable: false,
    applyTrigger: 'none',
    writesEvaluation: 'no',
    writesEvaluationItem: 'no',
    writesEvaluationTotalScore: 'no',
    writesEvaluationGradeId: 'no',
    requiresExplicitApply: false,
    currentGuardrails: ['dry-run only', 'writesPerformed false', 'report export only'],
    missingGuardrails: ['production execution approval still external'],
    recommendedSafeUse: '나중에 HR 승인 후 reference dry-run report만 생성하고 output review template으로 검토합니다.',
  },
  {
    scriptName: 'scripts/backfill-2026-policy-metadata.ts',
    purpose: 'dry-run default / explicit --apply로 additive policy metadata를 쓰는 apply-capable script',
    dryRunAvailable: true,
    applyCapable: true,
    applyTrigger: '--apply',
    writesEvaluation: 'no',
    writesEvaluationItem: 'yes',
    writesEvaluationTotalScore: 'no',
    writesEvaluationGradeId: 'no',
    requiresExplicitApply: true,
    currentGuardrails: [
      'dry-run default',
      '--apply required',
      'manual-review exclusion check',
      'migration column check',
      'backup before apply',
      '--confirm-2026-production-apply required',
      '--backup-confirmed required',
      '--hr-approved required',
      '--dry-run-output-reviewed required',
      '--target-cycle required',
      'official flags must remain false',
    ],
    missingGuardrails: ['apply remains external runbook only; no UI execution by design'],
    recommendedSafeUse: '공식 gate READY 전까지 apply 금지. 향후에도 backup/HR/dry-run review confirmations를 모두 충족해야 합니다.',
  },
  {
    scriptName: 'scripts/dry-run-classify-2026-evaluation-items.ts',
    purpose: '기존 EvaluationItem을 2026 policy 기준으로 분류하는 read-only classifier',
    dryRunAvailable: true,
    applyCapable: false,
    applyTrigger: 'none',
    writesEvaluation: 'no',
    writesEvaluationItem: 'no',
    writesEvaluationTotalScore: 'no',
    writesEvaluationGradeId: 'no',
    requiresExplicitApply: false,
    currentGuardrails: ['dry-run/read-only classification', 'no write path'],
    missingGuardrails: ['not an apply surface'],
    recommendedSafeUse: 'classification rehearsal and report comparison only.',
  },
  {
    scriptName: 'scripts/dry-run-2026-score-impact.ts',
    purpose: '2026 score policy impact를 read-only로 산출',
    dryRunAvailable: true,
    applyCapable: false,
    applyTrigger: 'none',
    writesEvaluation: 'no',
    writesEvaluationItem: 'no',
    writesEvaluationTotalScore: 'no',
    writesEvaluationGradeId: 'no',
    requiresExplicitApply: false,
    currentGuardrails: ['dry-run/read-only impact', 'does not write totalScore'],
    missingGuardrails: ['not an apply surface'],
    recommendedSafeUse: 'score policy 검토용 preview output으로만 사용합니다.',
  },
  {
    scriptName: 'src/server/evaluation-2026-readiness-population.ts',
    purpose: 'activation readiness 화면에서 population dry-run diagnostics를 read-only로 산출',
    dryRunAvailable: true,
    applyCapable: false,
    applyTrigger: 'none',
    writesEvaluation: 'no',
    writesEvaluationItem: 'no',
    writesEvaluationTotalScore: 'no',
    writesEvaluationGradeId: 'no',
    requiresExplicitApply: false,
    currentGuardrails: ['writesPerformed false', 'isDryRun true', 'wouldCreate counts only'],
    missingGuardrails: ['not a CLI apply path'],
    recommendedSafeUse: 'UI에서 read-only readiness diagnostics로만 확인합니다.',
  },
]

const APPLY_GUARDRAIL_STATUS = [
  {
    id: 'EXPLICIT_CONFIRMATION',
    label: 'apply requires explicit confirmation',
    status: 'CONFIRMED_IN_CODE' as const,
    evidence: '--apply now also requires --confirm-2026-production-apply',
  },
  {
    id: 'BACKUP_CONFIRMATION',
    label: 'backup confirmation',
    status: 'CONFIRMED_IN_CODE' as const,
    evidence: '--backup-confirmed required before apply guard passes',
  },
  {
    id: 'HR_APPROVAL',
    label: 'HR approval',
    status: 'CONFIRMED_IN_CODE' as const,
    evidence: '--hr-approved required before apply guard passes',
  },
  {
    id: 'DRY_RUN_OUTPUT_REVIEWED',
    label: 'dry-run output reviewed',
    status: 'CONFIRMED_IN_CODE' as const,
    evidence: '--dry-run-output-reviewed required before apply guard passes',
  },
  {
    id: 'TARGET_CYCLE_CONFIRMED',
    label: 'target cycle confirmed',
    status: 'CONFIRMED_IN_CODE' as const,
    evidence: '--target-cycle or --target-cycle-id required before apply guard passes',
  },
  {
    id: 'OFFICIAL_FLAGS_FALSE',
    label: 'official flags remain false',
    status: 'CONFIRMED_IN_CODE' as const,
    evidence: 'official scoring/grade/AI exclusion env flags are rejected when true',
  },
  {
    id: 'GATE_READY',
    label: 'apply remains prohibited until gate READY',
    status: 'EXTERNAL_CONFIRMATION_REQUIRED' as const,
    evidence: 'UI exposes read-only status only; final gate approval remains external/manual.',
  },
]

const FIXTURE_EXAMPLES: Evaluation2026DryRunFixtureExample[] = [
  {
    fileName: 'valid-safe-dryrun.json',
    label: 'safe output with writesPerformed false',
    expectedClassification: 'PASS_FOR_REVIEW',
    expectedRedFlags: [],
    nextAction: 'must-pass criteria를 HR/개발이 함께 검토하고 backup/HR approval 논의로만 이동',
  },
  {
    fileName: 'missing-policy-category.json',
    label: 'policyCategory blocker remains',
    expectedClassification: 'NEEDS_HR_FIX',
    expectedRedFlags: ['POLICY_CATEGORY_MISSING'],
    nextAction: 'policyCategory workbench로 되돌아가 미분류를 정리',
  },
  {
    fileName: 'evaluator-blockers.json',
    label: 'evaluator routing blocker remains',
    expectedClassification: 'NEEDS_HR_FIX',
    expectedRedFlags: ['EVALUATOR_MISSING'],
    nextAction: '/admin/performance-assignments에서 blocker 또는 승인 예외 확인',
  },
  {
    fileName: 'writes-performed-red-flag.json',
    label: 'writesPerformed true red flag',
    expectedClassification: 'REJECT_DRY_RUN_OUTPUT',
    expectedRedFlags: ['WRITES_PERFORMED_TRUE'],
    nextAction: '즉시 중단하고 dry-run execution path 조사',
  },
  {
    fileName: 'total-score-changed-red-flag.json',
    label: 'Evaluation.totalScore changed red flag',
    expectedClassification: 'REJECT_DRY_RUN_OUTPUT',
    expectedRedFlags: ['TOTAL_SCORE_CHANGED'],
    nextAction: 'score write 경로 조사 및 activation 금지 유지',
  },
  {
    fileName: 'grade-id-changed-red-flag.json',
    label: 'Evaluation.gradeId changed red flag',
    expectedClassification: 'REJECT_DRY_RUN_OUTPUT',
    expectedRedFlags: ['GRADE_ID_CHANGED'],
    nextAction: 'grade write 경로 조사 및 activation 금지 유지',
  },
  {
    fileName: 'schema-error-red-flag.json',
    label: 'schema/P2021/P2022 red flag',
    expectedClassification: 'REJECT_DRY_RUN_OUTPUT',
    expectedRedFlags: ['PRISMA_SCHEMA_ERROR'],
    nextAction: 'migration 실행 없이 schema/runtime hotfix 필요 여부만 조사',
  },
]

const REVIEWER_DECISION_GUIDE = [
  {
    classification: 'PASS_FOR_REVIEW' as const,
    meaning: 'red flag가 없어 HR/개발 검토 대상으로 접수 가능',
    nextAction: 'backup/HR approval 논의까지만 진행하고 apply는 금지합니다.',
  },
  {
    classification: 'NEEDS_HR_FIX' as const,
    meaning: 'MBO/policyCategory/evaluator/score/grade blocker가 남아 있음',
    nextAction: '해당 HR workstream으로 되돌립니다.',
  },
  {
    classification: 'NEEDS_DEVELOPER_FIX' as const,
    meaning: 'output schema/auth/session/review format 보완 필요',
    nextAction: 'dry-run output format과 log watch 항목을 보완합니다.',
  },
  {
    classification: 'REJECT_DRY_RUN_OUTPUT' as const,
    meaning: 'write, totalScore/gradeId, schema/runtime red flag로 결과 폐기',
    nextAction: '원인 조사 전 다음 단계로 진행하지 않습니다.',
  },
]

const RED_FLAG_MATRIX = [
  { id: 'WRITES_PERFORMED_TRUE', label: 'writesPerformed true', severity: 'REJECT' as const, nextAction: 'dry-run output reject and investigate execution path' },
  { id: 'TOTAL_SCORE_CHANGED', label: 'Evaluation.totalScore changed', severity: 'REJECT' as const, nextAction: 'stop and investigate score write path' },
  { id: 'GRADE_ID_CHANGED', label: 'Evaluation.gradeId changed', severity: 'REJECT' as const, nextAction: 'stop and investigate grade write path' },
  { id: 'FEATURE_FLAG_CHANGED', label: 'feature flag changed', severity: 'REJECT' as const, nextAction: 'verify production feature flag mutation did not occur' },
  { id: 'POLICY_CATEGORY_MISSING', label: 'policyCategory missing > 0', severity: 'HR_FIX' as const, nextAction: 'go to policyCategory workbench' },
  { id: 'EVALUATOR_MISSING', label: 'evaluator missing > 0 without approved exception', severity: 'HR_FIX' as const, nextAction: 'go to performance assignments' },
  { id: 'PRISMA_SCHEMA_ERROR', label: 'P2021/P2022/schema error', severity: 'REJECT' as const, nextAction: 'report schema/runtime issue without migration execution' },
  { id: 'MISSING_REQUIRED_FIELDS', label: 'dry-run output missing required fields', severity: 'DEVELOPER_FIX' as const, nextAction: 'fix output schema before review' },
]

function buildScriptInventoryText(items: Evaluation2026DryRunScriptSurfaceInventoryItem[]) {
  return items.map((item) => [
    `- ${item.scriptName}`,
    `  purpose: ${item.purpose}`,
    `  dry-run available: ${item.dryRunAvailable ? 'yes' : 'no'}`,
    `  apply capable: ${item.applyCapable ? 'yes' : 'no'}`,
    `  apply trigger: ${item.applyTrigger}`,
    `  writes Evaluation: ${item.writesEvaluation}`,
    `  writes EvaluationItem: ${item.writesEvaluationItem}`,
    `  writes Evaluation.totalScore: ${item.writesEvaluationTotalScore}`,
    `  writes Evaluation.gradeId: ${item.writesEvaluationGradeId}`,
    `  current guardrails: ${item.currentGuardrails.join(', ')}`,
    `  missing guardrails: ${item.missingGuardrails.join(', ')}`,
    `  recommended safe use: ${item.recommendedSafeUse}`,
  ].join('\n')).join('\n')
}

function buildGuardrailText(items: Evaluation2026DryRunRehearsalGuardrails['applyGuardrailStatus']) {
  return items.map((item) => `- [${item.status}] ${item.label}: ${item.evidence}`).join('\n')
}

function buildFixtureText(items: Evaluation2026DryRunFixtureExample[]) {
  return items.map((item) =>
    `- ${item.fileName}: ${item.expectedClassification} · redFlags=${item.expectedRedFlags.join(', ') || 'none'} · next=${item.nextAction}`
  ).join('\n')
}

function buildRedFlagText(items: Evaluation2026DryRunRehearsalGuardrails['redFlagMatrix']) {
  return items.map((item) => `- [${item.severity}] ${item.id}: ${item.label} · ${item.nextAction}`).join('\n')
}

function buildDecisionText(items: Evaluation2026DryRunRehearsalGuardrails['reviewerDecisionGuide']) {
  return items.map((item) => `- ${item.classification}: ${item.meaning} · next=${item.nextAction}`).join('\n')
}

function buildMarkdown(params: {
  summary: Evaluation2026DryRunRehearsalGuardrails['summary']
  inventory: Evaluation2026DryRunScriptSurfaceInventoryItem[]
  guardrails: Evaluation2026DryRunRehearsalGuardrails['applyGuardrailStatus']
  fixtures: Evaluation2026DryRunFixtureExample[]
  redFlags: Evaluation2026DryRunRehearsalGuardrails['redFlagMatrix']
  decisions: Evaluation2026DryRunRehearsalGuardrails['reviewerDecisionGuide']
}) {
  return [
    '# 2026 Dry-run Rehearsal & Guardrails',
    '',
    '## Summary',
    `- current stage: ${params.summary.currentStage}`,
    `- overall readiness status: ${params.summary.overallReadinessStatus}`,
    `- official activation status: ${params.summary.officialActivationStatus}`,
    `- apply status: ${params.summary.applyStatus}`,
    `- reviewer status: ${params.summary.reviewerStatus}`,
    `- local-only paste validator: ${params.summary.localOnlyPasteValidatorStatus}`,
    `- next action: ${params.summary.nextAction}`,
    '',
    '## Script surface inventory',
    buildScriptInventoryText(params.inventory),
    '',
    '## Apply guardrail status',
    buildGuardrailText(params.guardrails),
    '',
    '## Fixture rehearsal guide',
    buildFixtureText(params.fixtures),
    '',
    '## Red flag matrix',
    buildRedFlagText(params.redFlags),
    '',
    '## Reviewer decision guide',
    buildDecisionText(params.decisions),
    '',
    '## Prohibited actions',
    PROHIBITED_ACTIONS.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
}

function buildTsv(params: {
  inventory: Evaluation2026DryRunScriptSurfaceInventoryItem[]
  guardrails: Evaluation2026DryRunRehearsalGuardrails['applyGuardrailStatus']
  fixtures: Evaluation2026DryRunFixtureExample[]
  redFlags: Evaluation2026DryRunRehearsalGuardrails['redFlagMatrix']
}) {
  return [
    ['section', 'id', 'label', 'status', 'detail'].join('\t'),
    ...params.inventory.map((item) =>
      ['script_inventory', item.scriptName, item.purpose, item.applyCapable ? 'apply_capable' : 'dry_run_only', item.recommendedSafeUse].join('\t')
    ),
    ...params.guardrails.map((item) =>
      ['apply_guardrail', item.id, item.label, item.status, item.evidence].join('\t')
    ),
    ...params.fixtures.map((item) =>
      ['fixture', item.fileName, item.label, item.expectedClassification, item.expectedRedFlags.join(', ')].join('\t')
    ),
    ...params.redFlags.map((item) =>
      ['red_flag', item.id, item.label, item.severity, item.nextAction].join('\t')
    ),
  ].join('\n')
}

export function buildEvaluation2026DryRunRehearsalGuardrails(params: {
  integratedReadinessSnapshot: Evaluation2026IntegratedReadinessSnapshot
  backfillDryRunPreflightPack: Evaluation2026BackfillDryRunPreflightPack
  dryRunOutputReviewTemplate: Evaluation2026DryRunOutputReviewTemplate
}): Evaluation2026DryRunRehearsalGuardrails {
  const summary: Evaluation2026DryRunRehearsalGuardrails['summary'] = {
    currentStage: params.integratedReadinessSnapshot.currentStage,
    overallReadinessStatus: params.integratedReadinessSnapshot.overallStatus,
    officialActivationStatus: params.backfillDryRunPreflightPack.preflightSummary.officialActivationStatus,
    scriptInventoryCount: SCRIPT_SURFACE_INVENTORY.length,
    applyCapableScriptCount: SCRIPT_SURFACE_INVENTORY.filter((item) => item.applyCapable).length,
    fixtureExampleCount: FIXTURE_EXAMPLES.length,
    reviewerStatus: 'AVAILABLE',
    localOnlyPasteValidatorStatus: 'LOCAL_ONLY',
    applyStatus: 'PROHIBITED_UNTIL_GATE_READY',
    nextAction: 'fixture output과 local-only paste validator로 future dry-run 결과 판독 기준을 리허설하세요. apply는 여전히 금지입니다.',
  }
  const markdown = buildMarkdown({
    summary,
    inventory: SCRIPT_SURFACE_INVENTORY,
    guardrails: APPLY_GUARDRAIL_STATUS,
    fixtures: FIXTURE_EXAMPLES,
    redFlags: RED_FLAG_MATRIX,
    decisions: REVIEWER_DECISION_GUIDE,
  })
  const tsv = buildTsv({
    inventory: SCRIPT_SURFACE_INVENTORY,
    guardrails: APPLY_GUARDRAIL_STATUS,
    fixtures: FIXTURE_EXAMPLES,
    redFlags: RED_FLAG_MATRIX,
  })

  return {
    mode: 'READ_ONLY',
    status: 'AVAILABLE',
    generatedAt: new Date().toISOString(),
    summary,
    scriptSurfaceInventory: SCRIPT_SURFACE_INVENTORY,
    applyGuardrailStatus: APPLY_GUARDRAIL_STATUS,
    fixtureRehearsalExamples: FIXTURE_EXAMPLES,
    reviewerDecisionGuide: REVIEWER_DECISION_GUIDE,
    redFlagMatrix: RED_FLAG_MATRIX,
    localOnlyPasteValidator: {
      enabled: true,
      serverSubmitAvailable: false,
      saveAvailable: false,
      uploadAvailable: false,
      apiCallAvailable: false,
      persistenceAvailable: false,
      guidance: '붙여넣은 dry-run output은 브라우저 local state에서만 판독합니다. 서버 제출, 저장, 업로드, API 호출, persistence는 제공하지 않습니다.',
    },
    prohibitedActions: PROHIBITED_ACTIONS,
    copyPayloads: {
      scriptInventory: buildScriptInventoryText(SCRIPT_SURFACE_INVENTORY),
      guardrailChecklist: buildGuardrailText(APPLY_GUARDRAIL_STATUS),
      fixtureRehearsalGuide: buildFixtureText(FIXTURE_EXAMPLES),
      redFlagMatrix: buildRedFlagText(RED_FLAG_MATRIX),
      reviewerDecisionGuide: buildDecisionText(REVIEWER_DECISION_GUIDE),
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
      noExecutionButtons: true,
      noDryRunExecutionButtons: true,
      noBackfillExecutionButtons: true,
      noApplyButtons: true,
      noScoreGradeWriteButtons: true,
      noServerSubmit: true,
      noUpload: true,
      noPersistence: true,
    },
  }
}
