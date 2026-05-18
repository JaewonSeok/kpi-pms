import type { EvaluationPolicyItemCategoryCode } from './evaluation-policy-2026'

export type EvaluationPolicy2026SalesGroup = 'SALES' | 'NON_SALES'
export type EvaluationPolicy2026TeamMemberSalesThresholdDecision =
  | 'UNRESOLVED'
  | 'SUPER_PRIORITY'
  | 'OUTSTANDING_PRIORITY'

export type EvaluationPolicy2026SalesGroupMapping = {
  salesGroup: EvaluationPolicy2026SalesGroup
  note?: string
  updatedAt?: string
  updatedById?: string
}

export type EvaluationPolicy2026ThresholdDecisionMapping = {
  decision: EvaluationPolicy2026TeamMemberSalesThresholdDecision
  note?: string
  updatedAt?: string
  updatedById?: string
}

export type EvaluationPolicy2026PreviewMappings = {
  salesGroupsByEmployeeId: Record<string, EvaluationPolicy2026SalesGroupMapping>
  teamMemberSalesThresholdDecision?: EvaluationPolicy2026ThresholdDecisionMapping
}

const EMPTY_MAPPINGS: EvaluationPolicy2026PreviewMappings = {
  salesGroupsByEmployeeId: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asSalesGroup(value: unknown): EvaluationPolicy2026SalesGroup | null {
  return value === 'SALES' || value === 'NON_SALES' ? value : null
}

function asThresholdDecision(value: unknown): EvaluationPolicy2026TeamMemberSalesThresholdDecision | null {
  return value === 'UNRESOLVED' || value === 'SUPER_PRIORITY' || value === 'OUTSTANDING_PRIORITY' ? value : null
}

export function isEvaluationPolicy2026Category(value: unknown): value is EvaluationPolicyItemCategoryCode {
  return value === 'ORG_GOAL' || value === 'PROJECT_T' || value === 'PROJECT_K' || value === 'DAILY_WORK'
}

export function contributionTypeForPolicyCategory2026(
  category: EvaluationPolicyItemCategoryCode
): 'ORGANIZATION' | 'PERSONAL' {
  return category === 'ORG_GOAL' ? 'ORGANIZATION' : 'PERSONAL'
}

export function readPolicy2026PreviewMappings(value: unknown): EvaluationPolicy2026PreviewMappings {
  if (!isRecord(value)) return { ...EMPTY_MAPPINGS }

  const rawMappings = isRecord(value.policy2026PreviewMappings)
    ? value.policy2026PreviewMappings
    : isRecord(value['2026PolicyPreviewMappings'])
      ? value['2026PolicyPreviewMappings']
      : null

  if (!rawMappings) return { ...EMPTY_MAPPINGS }

  const salesGroupsByEmployeeId: EvaluationPolicy2026PreviewMappings['salesGroupsByEmployeeId'] = {}
  const rawSalesGroups = rawMappings.salesGroupsByEmployeeId
  if (isRecord(rawSalesGroups)) {
    for (const [employeeId, rawMapping] of Object.entries(rawSalesGroups)) {
      if (!isRecord(rawMapping)) continue
      const salesGroup = asSalesGroup(rawMapping.salesGroup)
      if (!salesGroup) continue
      salesGroupsByEmployeeId[employeeId] = {
        salesGroup,
        note: typeof rawMapping.note === 'string' ? rawMapping.note : undefined,
        updatedAt: typeof rawMapping.updatedAt === 'string' ? rawMapping.updatedAt : undefined,
        updatedById: typeof rawMapping.updatedById === 'string' ? rawMapping.updatedById : undefined,
      }
    }
  }

  let teamMemberSalesThresholdDecision: EvaluationPolicy2026ThresholdDecisionMapping | undefined
  if (isRecord(rawMappings.teamMemberSalesThresholdDecision)) {
    const decision = asThresholdDecision(rawMappings.teamMemberSalesThresholdDecision.decision)
    if (decision) {
      teamMemberSalesThresholdDecision = {
        decision,
        note:
          typeof rawMappings.teamMemberSalesThresholdDecision.note === 'string'
            ? rawMappings.teamMemberSalesThresholdDecision.note
            : undefined,
        updatedAt:
          typeof rawMappings.teamMemberSalesThresholdDecision.updatedAt === 'string'
            ? rawMappings.teamMemberSalesThresholdDecision.updatedAt
            : undefined,
        updatedById:
          typeof rawMappings.teamMemberSalesThresholdDecision.updatedById === 'string'
            ? rawMappings.teamMemberSalesThresholdDecision.updatedById
            : undefined,
      }
    }
  }

  return {
    salesGroupsByEmployeeId,
    teamMemberSalesThresholdDecision,
  }
}

export function writePolicy2026PreviewMappingsToConfig(
  currentConfig: unknown,
  mappings: EvaluationPolicy2026PreviewMappings
) {
  const config = isRecord(currentConfig) ? { ...currentConfig } : {}
  return {
    ...config,
    policy2026PreviewMappings: mappings,
  }
}

export function inferPolicy2026SalesGroupFromEmployeeText(employee: {
  department?: { deptName?: string | null } | null
  teamName?: string | null
  jobTitle?: string | null
}): EvaluationPolicy2026SalesGroup | null {
  const text = [employee.department?.deptName, employee.teamName, employee.jobTitle]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()

  if (/(^|[\s/·-])(sales|non-sales)([\s/·-]|$)/i.test(text) || text.includes('비영업')) {
    return text.includes('non-sales') || text.includes('비영업') ? 'NON_SALES' : 'SALES'
  }

  if (text.includes('영업')) return 'SALES'
  return null
}

export function resolvePolicy2026PreviewSalesGroup(params: {
  evalCycleConfig?: unknown
  employeeId: string
  employee: {
    department?: { deptName?: string | null } | null
    teamName?: string | null
    jobTitle?: string | null
  }
}): EvaluationPolicy2026SalesGroup | null {
  const mappings = readPolicy2026PreviewMappings(params.evalCycleConfig)
  return mappings.salesGroupsByEmployeeId[params.employeeId]?.salesGroup
    ?? inferPolicy2026SalesGroupFromEmployeeText(params.employee)
}

export function resolvePolicy2026TeamMemberSalesThresholdDecision(
  evalCycleConfig: unknown
): EvaluationPolicy2026TeamMemberSalesThresholdDecision | null {
  const decision = readPolicy2026PreviewMappings(evalCycleConfig).teamMemberSalesThresholdDecision?.decision
  return decision && decision !== 'UNRESOLVED' ? decision : null
}
