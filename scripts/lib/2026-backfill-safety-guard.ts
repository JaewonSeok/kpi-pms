export type BackfillSafetyArgs = {
  apply: boolean
  year?: number
  policyVersion?: string
  targetCycleId?: string
  confirm2026ProductionApply: boolean
  backupConfirmed: boolean
  hrApproved: boolean
  dryRunOutputReviewed: boolean
  expectedYear: number
  expectedPolicyVersion: string
  env: Record<string, string | undefined>
}

export type BackfillSafetyModeSummary = {
  mode: 'DRY_RUN_ONLY' | 'APPLY_REQUIRES_CONFIRMATIONS' | 'APPLY_CONFIRMED'
  apply: boolean
  targetYear: number | null
  targetCycleId: string | null
  policyVersion: string | null
  requiredConfirmations: string[]
  providedConfirmations: string[]
  missingConfirmations: string[]
  officialFlagsRemainFalse: boolean
}

const REQUIRED_CONFIRMATION_FLAGS = [
  '--confirm-2026-production-apply',
  '--backup-confirmed',
  '--hr-approved',
  '--dry-run-output-reviewed',
  '--target-cycle=<cycle-id>',
  '--year=2026',
  '--policy-version=<expected-policy-version>',
]

const OFFICIAL_ACTIVATION_ENV_KEYS = [
  'NEXT_PUBLIC_EVALUATION_2026_OFFICIAL_SCORING_ENABLED',
  'EVALUATION_2026_OFFICIAL_SCORING_ENABLED',
  'NEXT_PUBLIC_EVALUATION_2026_OFFICIAL_GRADE_ENABLED',
  'EVALUATION_2026_OFFICIAL_GRADE_ENABLED',
  'NEXT_PUBLIC_EVALUATION_2026_AI_SCORE_EXCLUSION_ENABLED',
  'EVALUATION_2026_AI_SCORE_EXCLUSION_ENABLED',
]

function parseBooleanEnv(value: string | undefined) {
  if (value == null) return false
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.trim().toLowerCase())
}

function parseNumericOption(argv: string[], name: string) {
  const match = argv.find((arg) => arg.startsWith(`${name}=`))
  if (!match) return undefined
  const value = Number(match.slice(name.length + 1))
  return Number.isInteger(value) ? value : undefined
}

function parseStringOption(argv: string[], names: string[]) {
  for (const name of names) {
    const match = argv.find((arg) => arg.startsWith(`${name}=`))
    if (match) return match.slice(name.length + 1).trim() || undefined
  }
  return undefined
}

export function describeRequiredConfirmations() {
  return [...REQUIRED_CONFIRMATION_FLAGS]
}

export function parseBackfillSafetyArgs(
  argv: string[],
  options: {
    expectedYear?: number
    expectedPolicyVersion?: string
    env?: Record<string, string | undefined>
  } = {}
): BackfillSafetyArgs {
  const expectedYear = options.expectedYear ?? 2026
  const expectedPolicyVersion = options.expectedPolicyVersion ?? '2026-PPT-PHASE0'
  return {
    apply: argv.includes('--apply'),
    year: parseNumericOption(argv, '--year') ?? expectedYear,
    policyVersion: parseStringOption(argv, ['--policy-version', '--version']) ?? expectedPolicyVersion,
    targetCycleId: parseStringOption(argv, ['--target-cycle', '--target-cycle-id', '--cycle-id']),
    confirm2026ProductionApply: argv.includes('--confirm-2026-production-apply'),
    backupConfirmed: argv.includes('--backup-confirmed'),
    hrApproved: argv.includes('--hr-approved'),
    dryRunOutputReviewed: argv.includes('--dry-run-output-reviewed'),
    expectedYear,
    expectedPolicyVersion,
    env: options.env ?? {},
  }
}

export function isApplyMode(args: BackfillSafetyArgs) {
  return args.apply
}

function officialFlagsRemainFalse(args: BackfillSafetyArgs) {
  return OFFICIAL_ACTIVATION_ENV_KEYS.every((key) => !parseBooleanEnv(args.env[key]))
}

function providedConfirmations(args: BackfillSafetyArgs) {
  const provided: string[] = []
  if (args.confirm2026ProductionApply) provided.push('--confirm-2026-production-apply')
  if (args.backupConfirmed) provided.push('--backup-confirmed')
  if (args.hrApproved) provided.push('--hr-approved')
  if (args.dryRunOutputReviewed) provided.push('--dry-run-output-reviewed')
  if (args.targetCycleId) provided.push('--target-cycle=<cycle-id>')
  if (args.year === args.expectedYear) provided.push(`--year=${args.expectedYear}`)
  if (args.policyVersion === args.expectedPolicyVersion) {
    provided.push('--policy-version=<expected-policy-version>')
  }
  return provided
}

export function summarizeBackfillSafetyMode(args: BackfillSafetyArgs): BackfillSafetyModeSummary {
  const requiredConfirmations = describeRequiredConfirmations()
  const provided = providedConfirmations(args)
  const missing = args.apply
    ? requiredConfirmations.filter((flag) => !provided.includes(flag))
    : []
  const flagsRemainFalse = officialFlagsRemainFalse(args)
  return {
    mode: !args.apply
      ? 'DRY_RUN_ONLY'
      : missing.length || !flagsRemainFalse
        ? 'APPLY_REQUIRES_CONFIRMATIONS'
        : 'APPLY_CONFIRMED',
    apply: args.apply,
    targetYear: args.year ?? null,
    targetCycleId: args.targetCycleId ?? null,
    policyVersion: args.policyVersion ?? null,
    requiredConfirmations,
    providedConfirmations: provided,
    missingConfirmations: missing,
    officialFlagsRemainFalse: flagsRemainFalse,
  }
}

export function assertApplyGuardrails(args: BackfillSafetyArgs) {
  if (!args.apply) return

  const summary = summarizeBackfillSafetyMode(args)
  const errors: string[] = []

  if (summary.missingConfirmations.length) {
    errors.push(`missing confirmations: ${summary.missingConfirmations.join(', ')}`)
  }
  if (args.year !== args.expectedYear) {
    errors.push(`target year must be ${args.expectedYear}`)
  }
  if (args.policyVersion !== args.expectedPolicyVersion) {
    errors.push(`policy version must be ${args.expectedPolicyVersion}`)
  }
  if (!args.targetCycleId) {
    errors.push('target cycle must be explicit')
  }
  if (!summary.officialFlagsRemainFalse) {
    errors.push('official scoring/grade/AI exclusion flags must remain false before apply')
  }

  if (errors.length) {
    throw new Error(
      [
        '--apply refused by 2026 backfill safety guard.',
        ...errors,
        'Run dry-run first, archive/review the output, confirm DB backup, collect HR approval, and keep official flags false.',
      ].join(' ')
    )
  }
}
