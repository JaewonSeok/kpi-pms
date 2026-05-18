import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Prisma } from '@prisma/client'
import { EVALUATION_POLICY_2026 } from './evaluation-policy-2026'
import type {
  AiCapabilityRecognitionRouteCode,
  EvaluationPolicyItemCategoryCode,
} from './evaluation-policy-2026'
import type { EvaluationPolicyClassification } from './evaluation-policy-2026-classification'

export type PolicyBackfillRecordType = 'PersonalKpi' | 'EvaluationItem'

export type PolicyBackfillPlanRow = {
  recordType: PolicyBackfillRecordType
  id: string
  employeeId?: string
  employeeName?: string
  evaluationId?: string
  evalStage?: string
  title: string
  proposedPolicyCategory: EvaluationPolicyClassification
  proposedContributionType?: 'ORGANIZATION' | 'PERSONAL'
  proposedFormulaVersion?: string
  proposedBaseScore?: number
  proposedPolicyScoreSnapshot?: Prisma.InputJsonValue
  confidence: number
  plannedAction: 'BACKFILL_METADATA' | 'MANUAL_REVIEW_NO_WRITE'
  reasons: string
}

export type AiPolicyRouteBackfillPlanRow = {
  recordType: 'AiCompetencyGateCase' | 'AiCompetencyExternalCertClaim'
  id: string
  employeeId: string
  employeeName: string
  proposedPolicyVersion: string
  proposedRecognitionRoute: AiCapabilityRecognitionRouteCode | 'UNKNOWN'
  plannedAction: 'BACKFILL_METADATA' | 'MANUAL_REVIEW_NO_WRITE'
  reasons: string
}

export type PolicyBackfillPlan = {
  dryRun: boolean
  writesPerformed: boolean
  policyVersion: string
  evalYear: number
  generatedAt: string
  rows: PolicyBackfillPlanRow[]
  aiPolicyRoutes: AiPolicyRouteBackfillPlanRow[]
}

export type PolicyBackfillSummary = {
  byAction: Record<string, number>
  byCategory: Record<string, number>
  aiPolicyRoutes: {
    total: number
    backfillMetadata: number
    manualReview: number
  }
}

export type PolicyBackfillArgs = {
  year: number
  apply: boolean
  excludeManualReview: boolean
  jsonPath?: string
  csvPath?: string
  backupDir: string
}

export type PolicyBackfillApplySafetyOptions = {
  apply: boolean
  excludeManualReview: boolean
}

export function parsePolicyBackfillArgs(argv: string[]): PolicyBackfillArgs {
  const args: PolicyBackfillArgs = {
    year: EVALUATION_POLICY_2026.year,
    apply: false,
    excludeManualReview: false,
    backupDir: 'reports/backfill-2026-policy-metadata',
  }

  for (const arg of argv) {
    if (arg === '--apply') {
      args.apply = true
    } else if (arg === '--exclude-manual-review') {
      args.excludeManualReview = true
    } else if (arg.startsWith('--year=')) {
      const year = Number(arg.slice('--year='.length))
      if (Number.isInteger(year)) args.year = year
    } else if (arg.startsWith('--json=')) {
      args.jsonPath = arg.slice('--json='.length)
    } else if (arg.startsWith('--csv=')) {
      args.csvPath = arg.slice('--csv='.length)
    } else if (arg.startsWith('--backup-dir=')) {
      args.backupDir = arg.slice('--backup-dir='.length)
    }
  }

  return args
}

export function isManualReviewPolicyBackfillRow(row: {
  plannedAction: string
  proposedPolicyCategory?: string
}) {
  return row.plannedAction === 'MANUAL_REVIEW_NO_WRITE' || row.proposedPolicyCategory === 'UNKNOWN'
}

export function getAutoBackfillablePolicyRows(rows: PolicyBackfillPlanRow[]) {
  return rows.filter((row) => !isManualReviewPolicyBackfillRow(row))
}

export function getAutoBackfillableAiRouteRows(rows: AiPolicyRouteBackfillPlanRow[]) {
  return rows.filter((row) => row.plannedAction === 'BACKFILL_METADATA' && row.proposedRecognitionRoute !== 'UNKNOWN')
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

export function summarizePolicyBackfillPlan(plan: Pick<PolicyBackfillPlan, 'rows' | 'aiPolicyRoutes'>) {
  const byAction = new Map<string, number>()
  const byCategory = new Map<string, number>()

  for (const row of plan.rows) {
    increment(byAction, row.plannedAction)
    increment(byCategory, row.proposedPolicyCategory)
  }

  return {
    byAction: Object.fromEntries(byAction),
    byCategory: Object.fromEntries(byCategory),
    aiPolicyRoutes: {
      total: plan.aiPolicyRoutes.length,
      backfillMetadata: getAutoBackfillableAiRouteRows(plan.aiPolicyRoutes).length,
      manualReview: plan.aiPolicyRoutes.filter((row) => row.plannedAction === 'MANUAL_REVIEW_NO_WRITE').length,
    },
  } satisfies PolicyBackfillSummary
}

export function assertPolicyBackfillCanApply(
  plan: Pick<PolicyBackfillPlan, 'rows' | 'aiPolicyRoutes'>,
  options: PolicyBackfillApplySafetyOptions
) {
  if (!options.apply) {
    return
  }

  const manualRows = plan.rows.filter(isManualReviewPolicyBackfillRow)
  const manualAiRoutes = plan.aiPolicyRoutes.filter(
    (row) => row.plannedAction === 'MANUAL_REVIEW_NO_WRITE' || row.proposedRecognitionRoute === 'UNKNOWN'
  )

  if ((manualRows.length || manualAiRoutes.length) && !options.excludeManualReview) {
    throw new Error(
      [
        '--apply refused because manual-review records exist.',
        'Run dry-run, resolve/map them through HR, or rerun with --exclude-manual-review to update only safe auto-backfillable rows.',
        `manualPolicyRows=${manualRows.length}`,
        `manualAiRoutes=${manualAiRoutes.length}`,
      ].join(' ')
    )
  }
}

export function scorePolicySnapshotForCategory(category: EvaluationPolicyClassification) {
  if (category === 'UNKNOWN') return undefined
  const config = EVALUATION_POLICY_2026.categories[category as EvaluationPolicyItemCategoryCode]
  if ('baselineScores' in config && config.baselineScores) {
    return {
      category,
      baselineScores: {
        target: config.baselineScores.target,
        excellent: config.baselineScores.excellent,
      },
      policyVersion: EVALUATION_POLICY_2026.version,
    }
  }
  if ('maxScore' in config && config.maxScore) {
    return {
      category,
      maxScore: config.maxScore,
      policyVersion: EVALUATION_POLICY_2026.version,
    }
  }
  return undefined
}

export function baseScoreForCategory(category: EvaluationPolicyClassification) {
  if (category === 'UNKNOWN') return undefined
  const config = EVALUATION_POLICY_2026.categories[category as EvaluationPolicyItemCategoryCode]
  if ('baselineScores' in config && config.baselineScores) return config.baselineScores.target
  if ('maxScore' in config && config.maxScore) return config.maxScore
  return undefined
}

export function buildPersonalKpiPolicyMetadataUpdate(row: PolicyBackfillPlanRow) {
  if (row.recordType !== 'PersonalKpi' || isManualReviewPolicyBackfillRow(row)) return null
  return {
    policyCategory: row.proposedPolicyCategory as EvaluationPolicyItemCategoryCode,
    policyCategoryConfidence: row.confidence,
    policyCategorySource: '2026_POLICY_BACKFILL_AUTO_V1',
    policyCategoryReviewNote: row.reasons,
  }
}

export function buildEvaluationItemPolicyMetadataUpdate(row: PolicyBackfillPlanRow) {
  if (row.recordType !== 'EvaluationItem' || isManualReviewPolicyBackfillRow(row)) return null
  return {
    policyCategory: row.proposedPolicyCategory as EvaluationPolicyItemCategoryCode,
    scoreContributionType: row.proposedContributionType,
    policyFormulaVersion: row.proposedFormulaVersion,
    basePolicyScore: row.proposedBaseScore,
    adjustmentScore: 0,
    policyScoreSnapshot: row.proposedPolicyScoreSnapshot,
  }
}

export function buildAiGateCasePolicyMetadataUpdate(row: AiPolicyRouteBackfillPlanRow) {
  if (row.recordType !== 'AiCompetencyGateCase') return null
  if (row.plannedAction !== 'BACKFILL_METADATA' || row.proposedRecognitionRoute === 'UNKNOWN') return null
  return {
    policyVersion: row.proposedPolicyVersion,
    policyRecognitionRoute: row.proposedRecognitionRoute,
  }
}

export function ensureParentDir(filePath: string) {
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true })
}

export function writePolicyBackfillBackup(params: {
  backupDir: string
  plan: PolicyBackfillPlan
  summary: PolicyBackfillSummary
  now?: Date
}) {
  const now = params.now ?? new Date()
  mkdirSync(params.backupDir, { recursive: true })
  const filePath = path.join(
    params.backupDir,
    `backup-${params.plan.evalYear}-${now.toISOString().replace(/[:.]/g, '-')}.json`
  )
  const payload = {
    backupCreatedAt: now.toISOString(),
    applyRequiresExplicitFlag: true,
    policyVersion: params.plan.policyVersion,
    evalYear: params.plan.evalYear,
    summary: params.summary,
    plannedPolicyRows: getAutoBackfillablePolicyRows(params.plan.rows),
    manualReviewRows: params.plan.rows.filter(isManualReviewPolicyBackfillRow),
    plannedAiRoutes: getAutoBackfillableAiRouteRows(params.plan.aiPolicyRoutes),
    manualReviewAiRoutes: params.plan.aiPolicyRoutes.filter(
      (row) => row.plannedAction === 'MANUAL_REVIEW_NO_WRITE' || row.proposedRecognitionRoute === 'UNKNOWN'
    ),
  }
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return filePath
}

export function escapePolicyBackfillCsv(value: unknown) {
  const text = String(value ?? '')
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export function policyBackfillRowsToCsv(rows: PolicyBackfillPlanRow[]) {
  const headers: Array<keyof PolicyBackfillPlanRow> = [
    'recordType',
    'id',
    'employeeId',
    'employeeName',
    'evaluationId',
    'evalStage',
    'title',
    'proposedPolicyCategory',
    'proposedContributionType',
    'proposedFormulaVersion',
    'proposedBaseScore',
    'confidence',
    'plannedAction',
    'reasons',
  ]

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapePolicyBackfillCsv(row[header])).join(',')),
  ].join('\n')
}
