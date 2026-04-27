'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Archive,
  Bot,
  Copy,
  FilePenLine,
  FileUp,
  GitBranchPlus,
  Link2,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type {
  OrgKpiPageData,
  OrgKpiRelationReference,
  OrgKpiScopeTab,
  OrgKpiViewModel,
} from '@/server/org-kpi-page'
import type {
  OrgKpiTeamAiContextView,
  OrgKpiTeamRecommendationItemView,
} from '@/server/org-kpi-team-ai'
import {
  getOrgKpiDeleteActionState,
  resolveNextOrgKpiSelectionAfterDelete,
} from '@/lib/org-kpi-delete'
import {
  applySavedOrgKpiToList,
  buildOrgKpiServerListSignature,
} from '@/lib/org-kpi-client-state'
import type { OrgKpiScope } from '@/lib/org-kpi-scope'
import {
  buildOrgKpiStructureSummary,
  buildOrgKpiHierarchySelectionView,
  buildOrgKpiHierarchyStructure,
  getOrgKpiHierarchyInteractionChangedIds,
  isOrgKpiHierarchyNodeAffected,
  isOrgKpiTopLevelDivisionGoal,
  type OrgKpiHierarchyNode,
} from '@/lib/org-kpi-hierarchy'
import {
  formatOrgKpiTargetValues,
  resolveOrgKpiTargetValues,
} from '@/lib/org-kpi-target-values'
import { formatCountWithUnit, formatExplicitRatio } from '@/lib/metric-copy'
import { buildStrategicTeamRecommendationPayload } from '@/lib/org-kpi-team-ai-recommendation'
import {
  extractKpiAiPreviewRecommendations,
  type KpiAiPreviewComparison,
  type KpiAiPreviewRecommendation,
} from '@/lib/kpi-ai-preview'
import {
  buildOrgKpiAiRecommendationDraftStatusLabel,
  buildOrgKpiAiRecommendationOptionLabel,
  buildOrgKpiAiRecommendationSourceLabel,
  buildOrgKpiFormFromAiRecommendation,
  isOrgKpiAiRecommendationDraftDirty,
} from '@/lib/org-kpi-ai-recommendation-draft'
import { OrgKpiBulkUploadModal } from './OrgKpiBulkUploadModal'
import { KpiAiPreviewPanel } from './KpiAiPreviewPanel'
import {
  OrgKpiTeamAiWorkspace,
  type BusinessPlanFormState,
  type JobDescriptionFormState,
  type RecommendationDecisionMode,
} from './OrgKpiTeamAiWorkspace'
import { MidReviewReferencePanel } from '@/components/mid-review/MidReviewReferencePanel'

type Props = OrgKpiPageData & {
  initialDepartmentFilterId?: string
  initialTab?: string
  initialSelectedKpiId?: string
}

type TabKey = 'map' | 'list' | 'linkage' | 'history' | 'ai'
type Banner = { tone: 'success' | 'error' | 'info'; message: string }
type TeamAiRuntimeState = {
  mode: 'NORMAL_RESULT' | 'TRUE_FALLBACK'
  errorCode?: string | null
  prismaCode?: string | null
  shortMessage?: string | null
}
type FormState = {
  deptId: string
  evalYear: string
  parentOrgKpiId: string
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiCategory: string
  kpiName: string
  tags: string
  definition: string
  formula: string
  targetValueT: string
  targetValueE: string
  targetValueS: string
  unit: string
  weight: string
  difficulty: 'HIGH' | 'MEDIUM' | 'LOW'
}
type OrgCloneForm = {
  targetDeptId: string
  targetEvalYear: string
  includeProgress: boolean
  includeCheckins: boolean
}
type OrgBulkEditForm = {
  applyDepartment: boolean
  deptId: string
  applyCategory: boolean
  kpiCategory: string
  applyParent: boolean
  parentOrgKpiId: string
  applyTags: boolean
  tags: string
}
type GoalExportForm = {
  mode: 'goal' | 'employee'
  departmentId: string
}
type PendingRecommendationDecision = {
  itemId: string
  decision: RecommendationDecisionMode
}
type AiAction =
  | 'generate-draft'
  | 'improve-wording'
  | 'smart-check'
  | 'detect-duplicates'
  | 'suggest-alignment'
  | 'summarize-risk'
  | 'draft-monthly-comment'
type AiPreview = {
  requestLogId: string
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: Record<string, unknown>
}

const TAB_LABELS: Record<TabKey, string> = {
  list: '목록',
  map: '목표맵',
  linkage: '연결 현황',
  history: '이력',
  ai: 'AI 보조',
}

const TAB_ORDER: TabKey[] = ['list', 'map', 'linkage', 'history', 'ai']
const MEMBER_TAB_ORDER: TabKey[] = ['list', 'map', 'linkage', 'history']

const ORG_KPI_SCOPE_LABELS: Record<OrgKpiScope, string> = {
  division: '본부 KPI',
  team: '팀 KPI',
}

function normalizeOrgKpiTab(value?: string | null): TabKey | null {
  if (!value) return null
  if (value === 'map' || value === 'list' || value === 'linkage' || value === 'history' || value === 'ai')
    return value
  return null
}

const STATUS_LABELS: Record<OrgKpiViewModel['status'], string> = {
  DRAFT: '초안',
  SUBMITTED: '제출됨',
  CONFIRMED: '확정',
  LOCKED: '잠금',
  ARCHIVED: '보관',
}

const STATUS_CLASS: Record<OrgKpiViewModel['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  CONFIRMED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  LOCKED: 'bg-violet-100 text-violet-700 border-violet-200',
  ARCHIVED: 'bg-amber-100 text-amber-700 border-amber-200',
}

const AI_LABELS: Record<AiAction, string> = {
  'generate-draft': 'KPI 초안 생성',
  'improve-wording': 'KPI 문장 개선',
  'smart-check': 'SMART 점검',
  'detect-duplicates': '중복/유사 KPI 탐지',
  'suggest-alignment': '상위·하위 정렬 추천',
  'summarize-risk': '운영 리스크 요약',
  'draft-monthly-comment': '월간 실적 코멘트 초안',
}

const ORG_KPI_AI_PREVIEW_ERROR_MESSAGE =
  'AI 결과 형식을 불러오는 중 문제가 발생해 기본 결과로 표시했습니다. 잠시 후 다시 시도해 주세요.'
const DEFAULT_TEAM_AI_RUNTIME_STATE: TeamAiRuntimeState = {
  mode: 'NORMAL_RESULT',
  errorCode: null,
  prismaCode: null,
  shortMessage: null,
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')
const formatPercent = (value?: number | null) => (typeof value === 'number' && !Number.isNaN(value) ? `${Math.round(value * 10) / 10}%` : '-')
const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
const formatValue = (value?: number | string | null, unit?: string | null) =>
  value === undefined || value === null || value === ''
    ? '-'
    : `${typeof value === 'number' ? new Intl.NumberFormat('ko-KR').format(value) : value}${unit ? ` ${unit}` : ''}`

const parseNumber = (value: string) => {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseTagInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      )
  )

function previewRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function previewStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function toOrgKpiAiPreviewErrorMessage(message?: string | null) {
  const trimmed = typeof message === 'string' ? message.trim() : ''
  if (!trimmed) return ORG_KPI_AI_PREVIEW_ERROR_MESSAGE

  const lower = trimmed.toLowerCase()
  if (
    lower.includes('response_format') ||
    lower.includes('json_schema') ||
    lower.includes('structured output') ||
    lower.includes('recommendedparentid') ||
    lower.includes('invalid schema') ||
    lower.includes('could not be parsed') ||
    lower.includes('did not include structured output')
  ) {
    return ORG_KPI_AI_PREVIEW_ERROR_MESSAGE
  }

  return trimmed
}

function logOrgKpiAiResultMode(
  event:
    | 'ORG_KPI_AI_RESULT_MODE_FALLBACK'
    | 'ORG_KPI_AI_RESULT_MODE_NORMAL',
  params: {
    stepName: AiAction
    errorCode?: string | null
    prismaCode?: string | null
  },
) {
  console.info(`[org-kpi-ai] ${event}`, params)
}

function isTeamAiFallbackAlert(alert: { title: string; description: string }) {
  return alert.title.includes('팀 KPI AI 추천')
}

function previewNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
  }

  if (typeof value === 'string' && value.trim().length) {
    return value.trim()
  }

  return null
}

function previewNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function buildOrgAiPreviewComparisons(params: {
  action: AiAction
  result: Record<string, unknown>
  selectedKpi: OrgKpiViewModel | null
  form: FormState
}): KpiAiPreviewComparison[] {
  const record = previewRecord(params.result) ?? {}
  const comparisons: KpiAiPreviewComparison[] = []

  const pushComparison = (label: string, before?: string | null, after?: string | null) => {
    if (!after || before?.trim() === after.trim()) return
    comparisons.push({ label, before, after })
  }

  pushComparison(
    'KPI명',
    params.selectedKpi?.title ?? params.form.kpiName,
    previewStringValue(record.improvedTitle ?? record.title),
  )
  pushComparison(
    '정의',
    params.selectedKpi?.definition ?? params.form.definition,
    previewStringValue(record.improvedDefinition ?? record.definition),
  )
  pushComparison(
    '산식',
    params.selectedKpi?.formula ?? params.form.formula,
    previewStringValue(record.formula),
  )
  pushComparison(
    '목표값',
    formatOrgKpiTargetValues({
      targetValueT: params.selectedKpi?.targetValueT ?? previewNumericValue(params.form.targetValueT),
      targetValueE:
        params.selectedKpi?.targetValueE ??
        previewNumericValue(params.selectedKpi?.targetValue) ??
        previewNumericValue(params.form.targetValueE),
      targetValueS: params.selectedKpi?.targetValueS ?? previewNumericValue(params.form.targetValueS),
    }),
    formatOrgKpiTargetValues({
      targetValueT: previewNumericValue(record.targetValueT),
      targetValueE: previewNumericValue(record.targetValueE ?? record.targetValueSuggestion),
      targetValueS: previewNumericValue(record.targetValueS),
    }),
  )
  pushComparison(
    '가중치',
    params.selectedKpi ? `${params.selectedKpi.weight}%` : params.form.weight,
    previewNumberValue(record.weightSuggestion),
  )
  pushComparison('상위 정렬', params.selectedKpi?.parentOrgKpiTitle, previewStringValue(record.recommendedParentTitle))

  return comparisons
}

function buildEmptyForm(year: number, departmentId: string): FormState {
  return {
    deptId: departmentId,
    evalYear: String(year),
    parentOrgKpiId: '',
    kpiType: 'QUANTITATIVE',
    kpiCategory: '',
    kpiName: '',
    tags: '',
    definition: '',
    formula: '',
    targetValueT: '',
    targetValueE: '',
    targetValueS: '',
    unit: '%',
    weight: '',
    difficulty: 'MEDIUM',
  }
}

function buildFormFromKpi(kpi: OrgKpiViewModel): FormState {
  const resolvedTargetValues = resolveOrgKpiTargetValues({
    targetValue: typeof kpi.targetValue === 'number' ? kpi.targetValue : undefined,
    targetValueT: kpi.targetValueT,
    targetValueE: kpi.targetValueE,
    targetValueS: kpi.targetValueS,
  })

  return {
    deptId: kpi.departmentId,
    evalYear: String(kpi.evalYear),
    parentOrgKpiId: kpi.parentOrgKpiId ?? '',
    kpiType: (kpi.type ?? 'QUANTITATIVE') as FormState['kpiType'],
    kpiCategory: kpi.category ?? '',
    kpiName: kpi.title,
    tags: kpi.tags.join(', '),
    definition: kpi.definition ?? '',
    formula: kpi.formula ?? '',
    targetValueT:
      resolvedTargetValues.targetValueT !== undefined ? String(resolvedTargetValues.targetValueT) : '',
    targetValueE:
      resolvedTargetValues.targetValueE !== undefined ? String(resolvedTargetValues.targetValueE) : '',
    targetValueS:
      resolvedTargetValues.targetValueS !== undefined ? String(resolvedTargetValues.targetValueS) : '',
    unit: kpi.unit ?? '',
    weight: typeof kpi.weight === 'number' ? String(kpi.weight) : '',
    difficulty: (kpi.difficulty ?? 'MEDIUM') as FormState['difficulty'],
  }
}

function buildCloneForm(pageData: Props, selectedKpi?: OrgKpiViewModel): OrgCloneForm {
  return {
    targetDeptId: selectedKpi?.departmentId ?? pageData.selectedDepartmentId,
    targetEvalYear: String(selectedKpi?.evalYear ?? pageData.selectedYear),
    includeProgress: false,
    includeCheckins: false,
  }
}

function buildOrgBulkEditForm(pageData: Props, selectedDepartmentId: string): OrgBulkEditForm {
  return {
    applyDepartment: false,
    deptId: selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId,
    applyCategory: false,
    kpiCategory: '',
    applyParent: false,
    parentOrgKpiId: '',
    applyTags: false,
    tags: '',
  }
}

function buildGoalExportForm(pageData: Props, selectedDepartmentId: string): GoalExportForm {
  return {
    mode: 'goal',
    departmentId: selectedDepartmentId === 'ALL' ? '' : selectedDepartmentId,
  }
}

function buildBusinessPlanForm(
  context: OrgKpiTeamAiContextView | null,
  evalYear: number,
  fallbackDepartmentId: string
): BusinessPlanFormState {
  const document = context?.businessPlan

  return {
    id: document?.id,
    deptId: document?.departmentId ?? context?.planningDepartmentId ?? fallbackDepartmentId,
    evalYear: document?.evalYear ?? context?.evalYear ?? evalYear,
    evalCycleId: document?.evalCycleId ?? context?.evalCycleId ?? null,
    title: document?.title ?? `${context?.planningDepartmentName ?? '본부'} 사업계획서`,
    sourceType: document?.sourceType ?? 'TEXT',
    summaryText: document?.summaryText ?? '',
    bodyText: document?.bodyText ?? '',
  }
}

function buildJobDescriptionForm(
  context: OrgKpiTeamAiContextView | null,
  scope: JobDescriptionFormState['scope'],
  evalYear: number,
  fallbackDepartmentId: string
): JobDescriptionFormState {
  const document = scope === 'DIVISION' ? context?.divisionJobDescription : context?.teamJobDescription
  const departmentId =
    document?.departmentId ??
    (scope === 'DIVISION' ? context?.planningDepartmentId : context?.targetDepartmentId) ??
    fallbackDepartmentId
  const departmentName =
    document?.departmentName ??
    (scope === 'DIVISION' ? context?.planningDepartmentName : null) ??
    '조직'

  return {
    id: document?.id,
    deptId: departmentId,
    scope,
    evalYear: document?.evalYear ?? context?.evalYear ?? evalYear,
    evalCycleId: document?.evalCycleId ?? context?.evalCycleId ?? null,
    title: document?.title ?? `${departmentName} ${scope === 'DIVISION' ? '본부' : '팀'} 직무기술서`,
    summaryText: document?.summaryText ?? '',
    bodyText: document?.bodyText ?? '',
  }
}

function buildFormFromTeamRecommendation(
  item: OrgKpiTeamRecommendationItemView,
  evalYear: number,
  departmentId: string
): FormState {
  return {
    deptId: departmentId,
    evalYear: String(evalYear),
    parentOrgKpiId:
      item.recommendationType === 'ALIGNED_WITH_DIVISION_KPI' ? item.sourceOrgKpiId ?? '' : '',
    kpiType: 'QUANTITATIVE',
    kpiCategory: item.recommendationType === 'TEAM_INDEPENDENT' ? 'AI 독립형 KPI' : 'AI 연계형 KPI',
    kpiName: item.title,
    tags: item.recommendationType === 'TEAM_INDEPENDENT' ? 'AI추천, 독립형KPI' : 'AI추천, 연계형KPI',
    definition: item.definition ?? '',
    formula: item.formula ?? '',
    targetValueT: item.targetValueT !== undefined && item.targetValueT !== null ? String(item.targetValueT) : '',
    targetValueE: item.targetValueE !== undefined && item.targetValueE !== null ? String(item.targetValueE) : '',
    targetValueS: item.targetValueS !== undefined && item.targetValueS !== null ? String(item.targetValueS) : '',
    unit: item.unit ?? '%',
    weight: item.weightSuggestion !== undefined && item.weightSuggestion !== null ? String(item.weightSuggestion) : '20',
    difficulty: (item.difficultySuggestion ?? 'MEDIUM') as FormState['difficulty'],
  }
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init)
  const json = (await response.json()) as {
    success?: boolean
    data?: T
    error?: { message?: string }
  }
  if (!json.success) throw new Error(json.error?.message || '요청을 처리하지 못했습니다.')
  return json.data as T
}

function buildAiPayload(action: AiAction, kpi: OrgKpiViewModel | null, form: FormState, pageData: Props) {
  const departmentName =
    kpi?.departmentName ??
    pageData.departments.find((department) => department.id === form.deptId)?.name ??
    pageData.actor.departmentName
  const formTargetValues = resolveOrgKpiTargetValues({
    targetValueT: parseNumber(form.targetValueT),
    targetValueE: parseNumber(form.targetValueE),
    targetValueS: parseNumber(form.targetValueS),
  })
  const kpiTargetValues = kpi
    ? resolveOrgKpiTargetValues({
        targetValue: typeof kpi.targetValue === 'number' ? kpi.targetValue : undefined,
        targetValueT: kpi.targetValueT,
        targetValueE: kpi.targetValueE,
        targetValueS: kpi.targetValueS,
      })
    : null

  const basePayload = {
    departmentName,
    year: Number(form.evalYear || pageData.selectedYear),
    kpiName: kpi?.title ?? form.kpiName,
    category: kpi?.category ?? form.kpiCategory,
    definition: kpi?.definition ?? form.definition,
    formula: kpi?.formula ?? form.formula,
    targetValue: kpiTargetValues?.targetValue ?? formTargetValues.targetValue,
    targetValueT: kpiTargetValues?.targetValueT ?? formTargetValues.targetValueT,
    targetValueE: kpiTargetValues?.targetValueE ?? formTargetValues.targetValueE,
    targetValueS: kpiTargetValues?.targetValueS ?? formTargetValues.targetValueS,
    unit: kpi?.unit ?? form.unit,
    weight: kpi?.weight ?? parseNumber(form.weight),
    difficulty: kpi?.difficulty ?? form.difficulty,
    linkedPersonalKpiCount: kpi?.linkedPersonalKpiCount ?? 0,
    monthlyAchievementRate: kpi?.monthlyAchievementRate ?? null,
    riskFlags: kpi?.riskFlags ?? [],
    action,
  }

  if (
    pageData.selectedScope !== 'team' ||
    action !== 'generate-draft' ||
    !pageData.teamAi?.businessPlan
  ) {
    return basePayload
  }

  const teamAi = pageData.teamAi
  const businessPlan = teamAi.businessPlan!
  const targetDepartmentId = kpi?.departmentId ?? form.deptId ?? teamAi.targetDepartmentId
  const sourceOrgKpis = teamAi.sourceOrgKpis.map((item) => {
    const full = pageData.list.find((candidate) => candidate.id === item.id)
    return {
      id: item.id,
      kpiName: item.title,
      kpiCategory: item.category ?? full?.category ?? null,
      definition: full?.definition ?? null,
      formula: full?.formula ?? null,
      targetValueText: item.targetValuesText,
      weight: item.weight ?? full?.weight ?? 20,
      difficulty: item.difficulty ?? full?.difficulty ?? 'MEDIUM',
    }
  })
  const existingTeamKpis = pageData.list
    .filter((item) => item.departmentId === targetDepartmentId)
    .map((item) => ({
      id: item.id,
      kpiName: item.title,
      kpiCategory: item.category ?? null,
      definition: item.definition ?? null,
      formula: item.formula ?? null,
      weight: item.weight ?? 0,
      parentOrgKpiId: item.parentOrgKpiId ?? null,
    }))
  const strategicPayload = buildStrategicTeamRecommendationPayload({
    teamDepartment: {
      id: targetDepartmentId,
      name: departmentName,
      organizationName:
        pageData.departments.find((department) => department.id === targetDepartmentId)?.organizationName ??
        teamAi.planningSourceLabel,
    },
    planningDepartment: {
      id: teamAi.planningDepartmentId,
      name: teamAi.planningDepartmentName,
      organizationName:
        pageData.departments.find((department) => department.id === teamAi.planningDepartmentId)
          ?.organizationName ??
        teamAi.planningSourceLabel,
    },
    evalYear: Number(form.evalYear || pageData.selectedYear),
    businessPlan: {
      title: businessPlan.title,
      summaryText: businessPlan.summaryText,
      bodyText: businessPlan.bodyText,
    },
    currentDraft: {
      title: String(basePayload.kpiName ?? ''),
      category: String(basePayload.category ?? ''),
      definition: String(basePayload.definition ?? ''),
      formula: String(basePayload.formula ?? ''),
      unit: String(basePayload.unit ?? '%'),
      weight: typeof basePayload.weight === 'number' ? basePayload.weight : null,
      difficulty: String(basePayload.difficulty ?? 'MEDIUM'),
    },
    sourceOrgKpis,
    existingTeamKpis,
    preferredParentOrgKpiId: kpi?.parentOrgKpiId ?? form.parentOrgKpiId ?? null,
  })

  return {
    ...basePayload,
    ...strategicPayload,
  }
}
export function OrgKpiManagementClient({
  initialDepartmentFilterId,
  initialTab,
  initialSelectedKpiId,
  ...pageData
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canRenderWorkspace = pageData.state === 'ready' || pageData.state === 'empty'
  const isReadOnlyMemberView = pageData.actor.role === 'ROLE_MEMBER'
  const normalizedInitialTab = normalizeOrgKpiTab(initialTab)
  const visibleTabs = isReadOnlyMemberView
    ? MEMBER_TAB_ORDER
    : TAB_ORDER
  const defaultTab =
    normalizedInitialTab && visibleTabs.includes(normalizedInitialTab) ? normalizedInitialTab : visibleTabs[0] ?? 'list'
  const selectedScopeTab =
    pageData.scopeTabs.find((item) => item.key === pageData.selectedScope) ??
    ({
      key: pageData.selectedScope,
      label: ORG_KPI_SCOPE_LABELS[pageData.selectedScope],
      description:
        pageData.selectedScope === 'division'
          ? '본부·실 등 상위 조직이 관리하는 KPI를 확인합니다. 하위 팀 KPI와의 연결 상태도 함께 볼 수 있습니다.'
          : '실제 실행 조직이 운영하는 KPI를 확인합니다. 상위 본부 KPI와의 정렬을 함께 관리합니다.',
      totalCount: pageData.list.length,
      departmentCount: pageData.departments.length,
    } satisfies OrgKpiScopeTab)
  const scopeLabel = selectedScopeTab.label
  const scopeDescription = selectedScopeTab.description
  const scopeCreateLabel = `${scopeLabel} 추가`
  const scopeBulkUploadLabel = `${scopeLabel} 일괄 업로드`
  const scopeListTitle = `${scopeLabel} 목록`
  const scopeMapTitle = `${scopeLabel} 목표맵`
  const scopeHistoryTitle = `${scopeLabel} 이력`
  const allDepartmentLabel = pageData.selectedScope === 'division' ? '전체 본부' : '전체 팀'
  const departmentFilterLabel = pageData.selectedScope === 'division' ? '본부 범위' : '팀 범위'
  const defaultDepartmentSelection =
    initialDepartmentFilterId &&
    pageData.departments.some((department) => department.id === initialDepartmentFilterId)
      ? initialDepartmentFilterId
      : pageData.departments.length > 1
        ? 'ALL'
        : pageData.selectedDepartmentId
  const defaultSelectedKpiId =
    (initialSelectedKpiId && pageData.list.some((item) => item.id === initialSelectedKpiId)
      ? initialSelectedKpiId
      : null) ??
    pageData.list[0]?.id ??
    ''
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(defaultDepartmentSelection)
  const [list, setList] = useState(pageData.list)
  const [selectedKpiId, setSelectedKpiId] = useState(defaultSelectedKpiId)
  const [activeKpiId, setActiveKpiId] = useState(defaultSelectedKpiId)
  const [showForm, setShowForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(buildEmptyForm(pageData.selectedYear, pageData.selectedDepartmentId))
  const [editorBaselineForm, setEditorBaselineForm] = useState<FormState | null>(null)
  const [teamAiContext, setTeamAiContext] = useState<OrgKpiTeamAiContextView | null>(pageData.teamAi)
  const [teamAiRuntimeState, setTeamAiRuntimeState] = useState<TeamAiRuntimeState>(
    pageData.teamAiRuntimeState ?? DEFAULT_TEAM_AI_RUNTIME_STATE
  )
  const [teamAiLoading, setTeamAiLoading] = useState(false)
  const [businessPlanForm, setBusinessPlanForm] = useState<BusinessPlanFormState>(
    buildBusinessPlanForm(pageData.teamAi, pageData.selectedYear, pageData.selectedDepartmentId)
  )
  const [divisionJobDescriptionForm, setDivisionJobDescriptionForm] = useState<JobDescriptionFormState>(
    buildJobDescriptionForm(pageData.teamAi, 'DIVISION', pageData.selectedYear, pageData.selectedDepartmentId)
  )
  const [teamJobDescriptionForm, setTeamJobDescriptionForm] = useState<JobDescriptionFormState>(
    buildJobDescriptionForm(pageData.teamAi, 'TEAM', pageData.selectedYear, pageData.selectedDepartmentId)
  )
  const [pendingRecommendationDecision, setPendingRecommendationDecision] =
    useState<PendingRecommendationDecision | null>(null)
  const activeScopeDepartmentId =
    selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId
  const hasReviewableTeamKpis = list.some((item) => item.departmentId === activeScopeDepartmentId)
  const [cloneForm, setCloneForm] = useState<OrgCloneForm>(buildCloneForm(pageData, pageData.list[0]))
  const [bulkEditForm, setBulkEditForm] = useState<OrgBulkEditForm>(
    buildOrgBulkEditForm(pageData, defaultDepartmentSelection)
  )
  const [exportForm, setExportForm] = useState<GoalExportForm>(
    buildGoalExportForm(pageData, defaultDepartmentSelection)
  )
  const [banner, setBanner] = useState<Banner | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null)
  const [aiAction, setAiAction] = useState<AiAction>('generate-draft')
  const [selectedAiRecommendationIndex, setSelectedAiRecommendationIndex] = useState<number | null>(null)
  const [editorDraftSourceLabel, setEditorDraftSourceLabel] = useState<string | null>(null)
  const [pendingAiRecommendationIndex, setPendingAiRecommendationIndex] = useState<number | null>(null)
  const [showRecommendationSwitchConfirm, setShowRecommendationSwitchConfirm] = useState(false)
  const [showEditorCloseConfirm, setShowEditorCloseConfirm] = useState(false)
  const [showAiRecommendationRetainedNotice, setShowAiRecommendationRetainedNotice] = useState(false)
  const [expandedMapNodeIds, setExpandedMapNodeIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const visibleLoadAlerts = useMemo(
    () => (pageData.alerts ?? []).filter((alert) => !isTeamAiFallbackAlert(alert)),
    [pageData.alerts]
  )
  const loadAlerts = visibleLoadAlerts.length ? <LoadAlerts alerts={visibleLoadAlerts} /> : null
  const serverListSignature = useMemo(() => buildOrgKpiServerListSignature(pageData.list), [pageData.list])
  const serverContextKey = `${pageData.selectedScope}:${pageData.selectedYear}:${pageData.selectedDepartmentId}:${serverListSignature}:${defaultSelectedKpiId}:${defaultTab}:${initialDepartmentFilterId ?? ''}`
  const previousServerContextKey = useRef(serverContextKey)
  const viewContextKey = `${pageData.selectedScope}:${pageData.selectedYear}:${selectedDepartmentId}`
  const previousViewContextKey = useRef(viewContextKey)
  const buildOrgKpiHref = useCallback(
    (overrides?: Partial<Record<'scope' | 'year' | 'dept' | 'tab' | 'kpiId', string | null>>) => {
      const nextParams = new URLSearchParams(searchParams.toString())
      const entries: Array<[
        'scope' | 'year' | 'dept' | 'tab' | 'kpiId',
        string | null | undefined,
      ]> = [
        ['scope', overrides?.scope ?? pageData.selectedScope],
        ['year', overrides?.year ?? String(pageData.selectedYear)],
        ['dept', overrides?.dept],
        ['tab', overrides?.tab],
        ['kpiId', overrides?.kpiId],
      ]

      entries.forEach(([key, value]) => {
        if (value === undefined) return
        if (value === null || value === '') {
          nextParams.delete(key)
          return
        }
        nextParams.set(key, value)
      })

      const query = nextParams.toString()
      return `/kpi/org${query ? `?${query}` : ''}`
    },
    [pageData.selectedScope, pageData.selectedYear, searchParams]
  )

  const replaceOrgKpiUrl = useCallback(
    (overrides?: Partial<Record<'scope' | 'year' | 'dept' | 'tab' | 'kpiId', string | null>>) => {
      if (typeof window === 'undefined') return
      window.history.replaceState(null, '', buildOrgKpiHref(overrides))
    },
    [buildOrgKpiHref]
  )

  const filteredList = useMemo(
    () =>
      list.filter((item) => {
        if (selectedDepartmentId !== 'ALL' && item.departmentId !== selectedDepartmentId) return false
        if (
          search.trim() &&
          !`${item.title} ${item.departmentName} ${item.category ?? ''}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        ) {
          return false
        }
        return true
      }),
    [list, search, selectedDepartmentId]
  )
  const hierarchyStructure = useMemo(
    () =>
      buildOrgKpiHierarchyStructure({
        items: list,
        selectedDepartmentId,
        search,
      }),
    [list, search, selectedDepartmentId]
  )
  const hierarchySelection = useMemo(
    () =>
      buildOrgKpiHierarchySelectionView({
        items: list,
        selectedKpiId,
      }),
    [list, selectedKpiId]
  )
  const hierarchyView = useMemo(
    () => ({
      ...hierarchyStructure,
      ...hierarchySelection,
    }),
    [hierarchySelection, hierarchyStructure]
  )
  const expandedMapNodeIdSet = useMemo(() => new Set(expandedMapNodeIds), [expandedMapNodeIds])
  const aiPreviewRecommendations = useMemo(
    () =>
      aiPreview?.source === 'ai' && aiAction === 'generate-draft'
        ? extractKpiAiPreviewRecommendations(aiPreview.result)
        : [],
    [aiAction, aiPreview]
  )
  const canUseAiRecommendationDraftOptions =
    aiPreview?.source === 'ai' &&
    aiAction === 'generate-draft' &&
    !editingKpiId &&
    !pendingRecommendationDecision &&
    aiPreviewRecommendations.length > 0
  const editorIsDirty = useMemo(
    () => isOrgKpiAiRecommendationDraftDirty(form, editorBaselineForm),
    [editorBaselineForm, form]
  )
  const editorRecommendationStatusLabel = useMemo(() => {
    if (canUseAiRecommendationDraftOptions && selectedAiRecommendationIndex !== null) {
      return buildOrgKpiAiRecommendationDraftStatusLabel(selectedAiRecommendationIndex, editorIsDirty)
    }

    return editorDraftSourceLabel
  }, [
    canUseAiRecommendationDraftOptions,
    editorDraftSourceLabel,
    editorIsDirty,
    selectedAiRecommendationIndex,
  ])
  const commitSelectedKpi = useCallback((kpiId: string) => {
    setActiveKpiId(kpiId)
    setSelectedKpiId(kpiId)
  }, [])
  const handleSelectKpi = useCallback((kpiId: string) => {
    setActiveKpiId((current) => (current === kpiId ? current : kpiId))
    startTransition(() => {
      setSelectedKpiId((current) => (current === kpiId ? current : kpiId))
    })
  }, [])
  const handleOpenRelatedReference = useCallback(
    (reference: OrgKpiRelationReference) => {
      if (reference.scope === pageData.selectedScope) {
        setSelectedDepartmentId((current) =>
          current === reference.departmentId ? current : reference.departmentId
        )
        handleSelectKpi(reference.id)
        setTab('map')
        return
      }

      router.push(
        buildOrgKpiHref({
          scope: reference.scope,
          dept: reference.departmentId,
          tab: 'map',
          kpiId: reference.id,
        })
      )
    },
    [buildOrgKpiHref, handleSelectKpi, pageData.selectedScope, router]
  )

  useEffect(() => {
    if (visibleTabs.includes(tab)) {
      return
    }

    setTab(visibleTabs[0] ?? 'list')
  }, [tab, visibleTabs])

  useEffect(() => {
    if (!canRenderWorkspace) return

    replaceOrgKpiUrl({
      dept: selectedDepartmentId === 'ALL' ? null : selectedDepartmentId,
      tab,
      kpiId: selectedKpiId || null,
    })
  }, [canRenderWorkspace, replaceOrgKpiUrl, selectedDepartmentId, selectedKpiId, tab])

  useEffect(() => {
    setActiveKpiId((current) => (current === selectedKpiId ? current : selectedKpiId))
  }, [selectedKpiId])

  useEffect(() => {
    if (previousServerContextKey.current === serverContextKey) {
      return
    }

    const nextDepartmentSelection =
      selectedDepartmentId === 'ALL'
        ? 'ALL'
        : pageData.departments.some((department) => department.id === selectedDepartmentId)
          ? selectedDepartmentId
          : defaultDepartmentSelection
    const nextSelectedKpiId =
      (selectedKpiId && pageData.list.some((item) => item.id === selectedKpiId) ? selectedKpiId : null) ??
      (initialSelectedKpiId && pageData.list.some((item) => item.id === initialSelectedKpiId)
        ? initialSelectedKpiId
        : null) ??
      pageData.list[0]?.id ??
      ''

    previousServerContextKey.current = serverContextKey
    setTab(defaultTab)
    setSelectedDepartmentId(nextDepartmentSelection)
    setList(pageData.list)
    commitSelectedKpi(nextSelectedKpiId)
    setShowForm(false)
    setShowBulkUpload(false)
    setShowClone(false)
    setShowBulkEdit(false)
    setShowExport(false)
    setShowDeleteConfirm(false)
    setEditingKpiId(null)
    setPendingRecommendationDecision(null)
    setForm(buildEmptyForm(pageData.selectedYear, pageData.selectedDepartmentId))
    setEditorBaselineForm(null)
    setTeamAiContext(pageData.teamAi)
    setTeamAiRuntimeState(pageData.teamAiRuntimeState ?? DEFAULT_TEAM_AI_RUNTIME_STATE)
    setTeamAiLoading(false)
    setBusinessPlanForm(buildBusinessPlanForm(pageData.teamAi, pageData.selectedYear, pageData.selectedDepartmentId))
    setDivisionJobDescriptionForm(
      buildJobDescriptionForm(pageData.teamAi, 'DIVISION', pageData.selectedYear, pageData.selectedDepartmentId)
    )
    setTeamJobDescriptionForm(
      buildJobDescriptionForm(pageData.teamAi, 'TEAM', pageData.selectedYear, pageData.selectedDepartmentId)
    )
    setCloneForm(buildCloneForm(pageData, pageData.list[0]))
    setBulkEditForm(buildOrgBulkEditForm(pageData, nextDepartmentSelection))
    setExportForm(buildGoalExportForm(pageData, nextDepartmentSelection))
    setBanner(null)
    setAiPreview(null)
    setSelectedAiRecommendationIndex(null)
    setEditorDraftSourceLabel(null)
    setPendingAiRecommendationIndex(null)
    setShowRecommendationSwitchConfirm(false)
    setShowEditorCloseConfirm(false)
    setShowAiRecommendationRetainedNotice(false)
    setExpandedMapNodeIds([])
    setSearch('')
  }, [
    commitSelectedKpi,
    selectedDepartmentId,
    selectedKpiId,
    defaultDepartmentSelection,
    defaultTab,
    initialSelectedKpiId,
    pageData.list,
    pageData.selectedDepartmentId,
    pageData.selectedYear,
    serverContextKey,
  ])

  useEffect(() => {
    if (previousViewContextKey.current === viewContextKey) {
      return
    }

    previousViewContextKey.current = viewContextKey
    commitSelectedKpi('')
    setShowForm(false)
    setShowBulkUpload(false)
    setShowClone(false)
    setShowBulkEdit(false)
    setShowExport(false)
    setShowDeleteConfirm(false)
    setEditingKpiId(null)
    setPendingRecommendationDecision(null)
    setEditorBaselineForm(null)
    setBanner(null)
    setAiPreview(null)
    setTeamAiContext(pageData.teamAi)
    setTeamAiRuntimeState(pageData.teamAiRuntimeState ?? DEFAULT_TEAM_AI_RUNTIME_STATE)
    setTeamAiLoading(false)
    setBusinessPlanForm(buildBusinessPlanForm(pageData.teamAi, pageData.selectedYear, pageData.selectedDepartmentId))
    setDivisionJobDescriptionForm(
      buildJobDescriptionForm(pageData.teamAi, 'DIVISION', pageData.selectedYear, pageData.selectedDepartmentId)
    )
    setTeamJobDescriptionForm(
      buildJobDescriptionForm(pageData.teamAi, 'TEAM', pageData.selectedYear, pageData.selectedDepartmentId)
    )
    setCloneForm(buildCloneForm(pageData))
    setBulkEditForm(buildOrgBulkEditForm(pageData, selectedDepartmentId))
    setExportForm(buildGoalExportForm(pageData, selectedDepartmentId))
    setSelectedAiRecommendationIndex(null)
    setEditorDraftSourceLabel(null)
    setPendingAiRecommendationIndex(null)
    setShowRecommendationSwitchConfirm(false)
    setShowEditorCloseConfirm(false)
    setShowAiRecommendationRetainedNotice(false)
    setExpandedMapNodeIds([])
  }, [commitSelectedKpi, pageData, viewContextKey])

  useEffect(() => {
    const selectableItems =
      tab === 'map' ? list.filter((item) => hierarchyStructure.visibleIds.has(item.id)) : filteredList

    if (!selectableItems.length) {
      commitSelectedKpi('')
      return
    }
    if (!selectableItems.some((item) => item.id === selectedKpiId)) {
      commitSelectedKpi(selectableItems[0].id)
    }
  }, [commitSelectedKpi, filteredList, hierarchyStructure.visibleIds, list, selectedKpiId, tab])

  useEffect(() => {
    if (!aiPreview) return

    if (aiPreview.source === 'fallback') {
      logOrgKpiAiResultMode('ORG_KPI_AI_RESULT_MODE_FALLBACK', {
        stepName: aiAction,
        errorCode: 'FALLBACK_RESULT',
        prismaCode: null,
      })
      return
    }

    if (aiPreview.source === 'ai') {
      logOrgKpiAiResultMode('ORG_KPI_AI_RESULT_MODE_NORMAL', {
        stepName: aiAction,
        errorCode: null,
        prismaCode: null,
      })
    }
  }, [aiAction, aiPreview])

  useEffect(() => {
    if (
      pageData.selectedScope !== 'team' ||
      tab !== 'ai' ||
      selectedDepartmentId === 'ALL' ||
      isReadOnlyMemberView
    ) {
      return
    }

    if (
      teamAiContext &&
      teamAiContext.targetDepartmentId === selectedDepartmentId &&
      teamAiContext.evalYear === pageData.selectedYear
    ) {
      return
    }

    void loadTeamAiContext(selectedDepartmentId)
  }, [
    isReadOnlyMemberView,
    pageData.selectedScope,
    pageData.selectedYear,
    selectedDepartmentId,
    tab,
    teamAiContext,
  ])

  const selectedKpi =
    filteredList.find((item) => item.id === selectedKpiId) ??
    list.find((item) => item.id === selectedKpiId) ??
    filteredList[0] ??
    list[0] ??
    null
  const selectedParentReference = selectedKpi?.parentReference ?? null
  const selectedChildReferences = selectedKpi?.childReferences ?? []
  const goalEditLocked =
    pageData.alerts?.some((alert) => alert.title.includes('읽기 전용 모드')) ?? false

  useEffect(() => {
    if (!selectedKpiId) return
    setExpandedMapNodeIds((current) => Array.from(new Set([...current, selectedKpiId, ...hierarchyView.ancestorIds])))
  }, [hierarchyView.ancestorIds, selectedKpiId])

  const deleteActionState = useMemo(
    () =>
      getOrgKpiDeleteActionState({
        kpi: selectedKpi
          ? {
              id: selectedKpi.id,
              title: selectedKpi.title,
              status: selectedKpi.status,
              linkedPersonalKpiCount: selectedKpi.linkedPersonalKpiCount,
            }
          : null,
        canManage: pageData.permissions.canManage,
        goalEditLocked,
        busy,
      }),
    [busy, goalEditLocked, pageData.permissions.canManage, selectedKpi]
  )

  const cloneDisabledReason = useMemo(
    () =>
      !selectedKpi
        ? '복제할 조직 KPI를 먼저 선택해 주세요.'
        : !pageData.permissions.canCreate
          ? '현재 권한으로는 조직 KPI를 복제할 수 없습니다.'
          : busy
            ? '다른 작업을 처리하는 중입니다.'
            : undefined,
    [busy, pageData.permissions.canCreate, selectedKpi]
  )
  const bulkTargetIds = useMemo(() => filteredList.map((item) => item.id), [filteredList])
  const bulkEditDisabledReason =
    goalEditLocked
      ? '읽기 전용 모드에서는 목표 일괄 수정을 진행할 수 없습니다.'
      : !pageData.permissions.canManage
        ? '현재 권한으로는 목표 일괄 수정을 진행할 수 없습니다.'
        : !bulkTargetIds.length
          ? '현재 필터 조건에 맞는 조직 KPI가 없습니다.'
          : undefined
  const exportDisabledReason =
    !pageData.permissions.canManage
      ? '현재 권한으로는 목표 엑셀을 내려받을 수 없습니다.'
      : !bulkTargetIds.length && selectedDepartmentId !== 'ALL'
        ? '현재 필터 조건에 맞는 조직 KPI가 없습니다.'
        : undefined

  async function loadTeamAiContext(targetDepartmentId = selectedDepartmentId) {
    if (targetDepartmentId === 'ALL') {
      setTeamAiContext(pageData.teamAi)
      setTeamAiRuntimeState(DEFAULT_TEAM_AI_RUNTIME_STATE)
      return pageData.teamAi
    }

    setTeamAiLoading(true)
    setTeamAiRuntimeState(DEFAULT_TEAM_AI_RUNTIME_STATE)
    try {
      const next = await fetchJson<OrgKpiTeamAiContextView>(
        `/api/kpi/org/team-ai/context?deptId=${encodeURIComponent(targetDepartmentId)}&evalYear=${encodeURIComponent(
          String(pageData.selectedYear)
        )}`
      )
      setTeamAiContext(next)
      setTeamAiRuntimeState(DEFAULT_TEAM_AI_RUNTIME_STATE)
      setBusinessPlanForm(buildBusinessPlanForm(next, pageData.selectedYear, targetDepartmentId))
      setDivisionJobDescriptionForm(buildJobDescriptionForm(next, 'DIVISION', pageData.selectedYear, targetDepartmentId))
      setTeamJobDescriptionForm(buildJobDescriptionForm(next, 'TEAM', pageData.selectedYear, targetDepartmentId))
      return next
    } catch (error) {
      setTeamAiRuntimeState({
        mode: 'TRUE_FALLBACK',
        errorCode: 'ORG_KPI_TEAM_AI_CONTEXT_LOAD_FAILED',
        prismaCode: null,
        shortMessage: error instanceof Error ? error.message : '팀 KPI AI 정보를 불러오지 못했습니다.',
      })
      return null
    } finally {
      setTeamAiLoading(false)
    }
  }

  async function saveKpi() {
    if (goalEditLocked) {
      setBanner({ tone: 'error', message: '현재는 목표 읽기 전용 모드라 조직 KPI를 저장할 수 없습니다.' })
      return
    }

    if (
      !form.deptId ||
      !form.kpiCategory.trim() ||
      !form.kpiName.trim() ||
      !form.weight.trim() ||
      !form.targetValueT.trim() ||
      !form.targetValueE.trim() ||
      !form.targetValueS.trim()
    ) {
      setBanner({ tone: 'error', message: '부서, 카테고리, KPI명, 가중치를 입력해 주세요.' })
      return
    }

    const parsedTargetValueT = parseNumber(form.targetValueT)
    const parsedTargetValueE = parseNumber(form.targetValueE)
    const parsedTargetValueS = parseNumber(form.targetValueS)

    if (
      parsedTargetValueT === undefined ||
      parsedTargetValueE === undefined ||
      parsedTargetValueS === undefined
    ) {
      setBanner({ tone: 'error', message: 'T / E / S 목표값은 숫자로 입력해 주세요.' })
      return
    }

    if (parsedTargetValueT > parsedTargetValueE || parsedTargetValueE > parsedTargetValueS) {
      setBanner({ tone: 'error', message: '목표값은 T <= E <= S 순서여야 합니다.' })
      return
    }

    const draftPayload = {
      scope: pageData.selectedScope,
      deptId: form.deptId,
      evalYear: Number(form.evalYear || pageData.selectedYear),
      parentOrgKpiId: form.parentOrgKpiId || null,
      kpiType: form.kpiType,
      kpiCategory: form.kpiCategory.trim(),
      kpiName: form.kpiName.trim(),
      tags: parseTagInput(form.tags),
      definition: form.definition.trim() || undefined,
      formula: form.formula.trim() || undefined,
      targetValueT: parsedTargetValueT,
      targetValueE: parsedTargetValueE,
      targetValueS: parsedTargetValueS,
      unit: form.unit.trim() || undefined,
      weight: Number(form.weight),
      difficulty: form.difficulty,
    }

    setBusy(true)
    try {
      const saved = pendingRecommendationDecision
        ? await fetchJson<{ createdKpi: { id: string; deptId: string } | null }>(
            `/api/kpi/org/team-ai/recommendations/${pendingRecommendationDecision.itemId}/decision`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                decision: pendingRecommendationDecision.decision,
                draft: {
                  kpiType: draftPayload.kpiType,
                  kpiCategory: draftPayload.kpiCategory,
                  kpiName: draftPayload.kpiName,
                  definition: draftPayload.definition,
                  formula: draftPayload.formula,
                  targetValueT: draftPayload.targetValueT,
                  targetValueE: draftPayload.targetValueE,
                  targetValueS: draftPayload.targetValueS,
                  unit: draftPayload.unit,
                  weight: draftPayload.weight,
                  difficulty: draftPayload.difficulty,
                  tags: draftPayload.tags,
                  parentOrgKpiId: draftPayload.parentOrgKpiId,
                },
              }),
            }
          ).then((response) => {
            if (!response.createdKpi) {
              throw new Error('추천 KPI 저장 결과를 확인하지 못했습니다.')
            }

            return response.createdKpi
          })
        : await fetchJson<{ id: string; deptId: string }>(
            editingKpiId ? `/api/kpi/org/${editingKpiId}` : '/api/kpi/org',
            {
              method: editingKpiId ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(draftPayload),
            }
          )
      setBanner({
        tone: 'success',
        message: editingKpiId ? `${scopeLabel}를 수정했습니다.` : `${scopeLabel}를 저장했습니다.`,
      })
      setList((current) =>
        applySavedOrgKpiToList({
          currentItems: current,
          savedId: saved.id,
          departments: pageData.departments,
          parentGoalOptions: pageData.parentGoalOptions,
          form,
        })
      )
      setSelectedDepartmentId(saved.deptId)
      commitSelectedKpi(saved.id)
      setShowForm(false)
      setEditingKpiId(null)
      setPendingRecommendationDecision(null)
      setEditorBaselineForm(null)
      setEditorDraftSourceLabel(null)
      setShowRecommendationSwitchConfirm(false)
      setShowEditorCloseConfirm(false)
      setShowAiRecommendationRetainedNotice(false)
      router.replace(
        buildOrgKpiHref({
          year: String(Number(form.evalYear || pageData.selectedYear)),
          dept: saved.deptId,
          tab,
          kpiId: saved.id,
        })
      )
      if (pageData.selectedScope === 'team' && saved.deptId !== 'ALL') {
        await loadTeamAiContext(saved.deptId)
      }
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: `${scopeLabel} 저장 중 문제가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.`,
      })
    } finally {
      setBusy(false)
    }
  }

  const runWorkflow = useCallback(async (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => {
    if (!selectedKpi) return
    setBusy(true)
    try {
      await fetchJson(`/api/kpi/org/${selectedKpi.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setBanner({
        tone: 'success',
        message:
          action === 'SUBMIT'
            ? '조직 KPI를 제출했습니다.'
            : action === 'LOCK'
              ? '조직 KPI를 잠금 처리했습니다.'
              : '조직 KPI를 다시 열었습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }, [router, selectedKpi])

  const changeStatus = useCallback(async (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => {
    if (!selectedKpi) return
    setBusy(true)
    try {
      await fetchJson(`/api/kpi/org/${selectedKpi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setBanner({
        tone: 'success',
        message:
          status === 'CONFIRMED'
            ? '조직 KPI를 확정했습니다.'
            : status === 'ARCHIVED'
              ? '조직 KPI를 보관 처리했습니다.'
              : '조직 KPI를 초안 상태로 되돌렸습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }, [router, selectedKpi])

  const requestAi = useCallback(async (action: AiAction) => {
    setBusy(true)
    setAiAction(action)
    setSelectedAiRecommendationIndex(null)
    setEditorDraftSourceLabel(null)
    setPendingAiRecommendationIndex(null)
    setShowRecommendationSwitchConfirm(false)
    setShowEditorCloseConfirm(false)
    setShowAiRecommendationRetainedNotice(false)
    try {
      const data = await fetchJson<AiPreview>('/api/kpi/org/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceId: selectedKpi?.id ?? editingKpiId ?? 'new-org-kpi',
          payload: buildAiPayload(action, selectedKpi, form, pageData),
        }),
      })
      setAiPreview({
        ...data,
        fallbackReason:
          data.source === 'ai' ? null : toOrgKpiAiPreviewErrorMessage(data.fallbackReason),
      })
      setTab('ai')
      setBanner({
        tone: data.source === 'ai' ? 'success' : 'info',
        message:
          data.source === 'ai'
            ? 'AI 결과를 준비했습니다. 미리보기 후 적용해 주세요.'
            : toOrgKpiAiPreviewErrorMessage(data.fallbackReason),
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message:
          error instanceof Error
            ? toOrgKpiAiPreviewErrorMessage(error.message)
            : ORG_KPI_AI_PREVIEW_ERROR_MESSAGE,
      })
    } finally {
      setBusy(false)
    }
  }, [editingKpiId, form, pageData, selectedKpi])

  const handleOpenClone = useCallback(() => {
    if (cloneDisabledReason || !selectedKpi) {
      setBanner({ tone: 'error', message: cloneDisabledReason ?? '복제할 조직 KPI를 먼저 선택해 주세요.' })
      return
    }

    setCloneForm(buildCloneForm(pageData, selectedKpi))
    setShowClone(true)
  }, [cloneDisabledReason, pageData, selectedKpi])

  async function handleClone() {
    if (!selectedKpi) {
      setBanner({ tone: 'error', message: '복제할 조직 KPI를 먼저 선택해 주세요.' })
      return
    }

    if (cloneDisabledReason) {
      setBanner({ tone: 'error', message: cloneDisabledReason })
      return
    }

    const targetEvalYear = Number(cloneForm.targetEvalYear)
    if (!Number.isInteger(targetEvalYear) || targetEvalYear < 2020 || targetEvalYear > 2100) {
      setBanner({ tone: 'error', message: '복제 대상 연도를 다시 확인해 주세요.' })
      return
    }

    if (!cloneForm.targetDeptId.trim()) {
      setBanner({ tone: 'error', message: '복제 대상 조직을 선택해 주세요.' })
      return
    }

    setBusy(true)
    try {
      const cloned = await fetchJson<{ id: string; deptId: string; evalYear: number }>(
        `/api/kpi/org/${selectedKpi.id}/clone`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: pageData.selectedScope,
            targetDeptId: cloneForm.targetDeptId,
            targetEvalYear,
            includeProgress: cloneForm.includeProgress,
            includeCheckins: cloneForm.includeCheckins,
          }),
        }
      )

      setBanner({
        tone: 'success',
        message: `${scopeLabel}를 복제했습니다. 복제본을 바로 이어서 수정할 수 있습니다.`,
      })
      setShowClone(false)
      setCloneForm(buildCloneForm(pageData))
      setSelectedDepartmentId((current) => (current === 'ALL' ? current : cloned.deptId))
      commitSelectedKpi(cloned.id)
      setTab('map')
      router.push(
        buildOrgKpiHref({
          year: String(cloned.evalYear),
          dept: cloned.deptId,
          tab: 'map',
          kpiId: cloned.id,
        })
      )
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '조직 KPI 복제에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  const handleOpenDeleteConfirm = useCallback(() => {
    if (deleteActionState.disabled) {
      setBanner({
        tone: 'error',
        message: deleteActionState.reason ?? '삭제할 조직 KPI를 먼저 선택해 주세요.',
      })
      return
    }

    setShowDeleteConfirm(true)
  }, [deleteActionState])
  const openEditorWithForm = useCallback((nextForm: FormState, options: {
    recommendationIndex?: number | null
    draftSourceLabel?: string | null
    editingId?: string | null
    pendingDecision?: PendingRecommendationDecision | null
    bannerMessage?: string | null
  }) => {
    setEditingKpiId(options.editingId ?? null)
    setPendingRecommendationDecision(options.pendingDecision ?? null)
    setSelectedAiRecommendationIndex(options.recommendationIndex ?? null)
    setEditorDraftSourceLabel(options.draftSourceLabel ?? null)
    setForm(nextForm)
    setEditorBaselineForm(nextForm)
    setShowForm(true)
    setShowRecommendationSwitchConfirm(false)
    setPendingAiRecommendationIndex(null)
    setShowEditorCloseConfirm(false)
    setShowAiRecommendationRetainedNotice(false)
    if (options.bannerMessage) {
      setBanner({
        tone: 'info',
        message: options.bannerMessage,
      })
    }
  }, [])
  const handleEditKpi = useCallback(
    (kpi: OrgKpiViewModel) => {
      openEditorWithForm(buildFormFromKpi(kpi), {
        editingId: kpi.id,
        recommendationIndex: null,
        draftSourceLabel: null,
      })
    },
    [openEditorWithForm]
  )
  const handleCreateChildGoal = useCallback(
    (parentKpi: OrgKpiViewModel) => {
      const nextForm = {
        ...buildEmptyForm(pageData.selectedYear, parentKpi.departmentId),
        parentOrgKpiId: parentKpi.id,
      }

      openEditorWithForm(nextForm, {
        recommendationIndex: null,
        draftSourceLabel: null,
        bannerMessage: '선택한 상위 목표 아래에 연결할 하위 목표 초안을 작성합니다.',
      })
    },
    [openEditorWithForm, pageData.selectedYear]
  )
  const handleEditParentLink = useCallback(
    (kpi: OrgKpiViewModel) => {
      openEditorWithForm(buildFormFromKpi(kpi), {
        editingId: kpi.id,
        recommendationIndex: null,
        draftSourceLabel: null,
        bannerMessage: '상위 목표 연결을 수정할 수 있는 편집 모드입니다.',
      })
    },
    [openEditorWithForm]
  )
  const handleViewLinkage = useCallback(
    (kpiId: string) => {
      handleSelectKpi(kpiId)
      setTab('linkage')
    },
    [handleSelectKpi]
  )
  const handleWorkflowAction = useCallback(
    (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => {
      void runWorkflow(action)
    },
    [runWorkflow]
  )
  const handleStatusChange = useCallback(
    (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => {
      void changeStatus(status)
    },
    [changeStatus]
  )
  const handleAiAction = useCallback(
    (action: AiAction) => {
      void requestAi(action)
    },
    [requestAi]
  )

  async function handleDeleteKpi() {
    if (!selectedKpi) {
      setBanner({ tone: 'error', message: '삭제할 조직 KPI를 먼저 선택해 주세요.' })
      return
    }

    if (deleteActionState.disabled) {
      setBanner({
        tone: 'error',
        message: deleteActionState.reason ?? '현재 상태에서는 조직 KPI를 삭제할 수 없습니다.',
      })
      return
    }

    if (false) {
      setBanner({ tone: 'error', message: 'T / E / S 목표값은 숫자로 입력해 주세요.' })
      return
    }

    if (false) {
      setBanner({ tone: 'error', message: '목표값은 T <= E <= S 순서여야 합니다.' })
      return
    }

    if (false) {
      setBanner({ tone: 'error', message: 'T / E / S 목표값은 숫자로 입력해 주세요.' })
      return
    }

    if (false) {
      setBanner({ tone: 'error', message: '목표값은 T <= E <= S 순서여야 합니다.' })
      return
    }

    setBusy(true)
    try {
      await fetchJson<{ id: string }>(`/api/kpi/org/${selectedKpi.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmDelete: true }),
      })

      const nextSelectedId = resolveNextOrgKpiSelectionAfterDelete({
        currentItems: filteredList,
        deletedId: selectedKpi.id,
      })

      setList((current) => current.filter((item) => item.id !== selectedKpi.id))
      commitSelectedKpi(nextSelectedId)
      setShowDeleteConfirm(false)
      setShowForm(false)
      setShowClone(false)
      setEditingKpiId((current) => (current === selectedKpi.id ? null : current))
      setAiPreview(null)
      setTab((current) => (current === 'ai' ? 'map' : current))
      setBanner({
        tone: 'success',
        message: `"${selectedKpi.title}" ${scopeLabel}를 삭제했습니다.`,
      })
      router.replace(
        buildOrgKpiHref({
          dept: selectedDepartmentId === 'ALL' ? null : selectedDepartmentId,
          tab,
          kpiId: nextSelectedId || null,
        })
      )
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '조직 KPI 삭제에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleOpenBulkEdit() {
    if (bulkEditDisabledReason) {
      setBanner({ tone: 'error', message: bulkEditDisabledReason })
      return
    }

    setBulkEditForm(buildOrgBulkEditForm(pageData, selectedDepartmentId))
    setShowBulkEdit(true)
  }

  async function handleSaveBulkEdit() {
    if (!bulkTargetIds.length) {
      setBanner({ tone: 'error', message: '일괄 수정할 조직 KPI가 없습니다.' })
      return
    }

    const payload: Record<string, unknown> = {
      scope: pageData.selectedScope,
      ids: bulkTargetIds,
    }

    if (bulkEditForm.applyDepartment) {
      payload.deptId = bulkEditForm.deptId
    }
    if (bulkEditForm.applyCategory) {
      payload.kpiCategory = bulkEditForm.kpiCategory.trim()
    }
    if (bulkEditForm.applyParent) {
      payload.parentOrgKpiId = bulkEditForm.parentOrgKpiId || null
    }
    if (bulkEditForm.applyTags) {
      payload.tags = parseTagInput(bulkEditForm.tags)
    }

    if (Object.keys(payload).length === 1) {
      setBanner({ tone: 'error', message: '최소 한 가지 수정 항목을 선택해 주세요.' })
      return
    }

    setBusy(true)
    try {
      const data = await fetchJson<{ updatedCount: number }>('/api/kpi/org/bulk-edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setBanner({
        tone: 'success',
        message: `${scopeLabel} ${data.updatedCount}건을 일괄 수정했습니다.`,
      })
      setShowBulkEdit(false)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : `${scopeLabel} 일괄 수정에 실패했습니다.` })
    } finally {
      setBusy(false)
    }
  }

  function handleOpenExport() {
    if (exportDisabledReason) {
      setBanner({ tone: 'error', message: exportDisabledReason })
      return
    }

    setExportForm(buildGoalExportForm(pageData, selectedDepartmentId))
    setShowExport(true)
  }

  async function handleExportGoals() {
    setBusy(true)
    try {
      const params = new URLSearchParams({
        mode: exportForm.mode,
        year: String(pageData.selectedYear),
      })

      if (exportForm.departmentId) {
        params.set('departmentId', exportForm.departmentId)
      }

      const response = await fetch(`/api/kpi/export?${params.toString()}`)
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message?: string } }
        throw new Error(json.error?.message || '목표 엑셀 다운로드에 실패했습니다.')
      }

      const blob = await response.blob()
      const href = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `goals-${pageData.selectedYear}-${exportForm.mode}.xlsx`
      anchor.click()
      window.URL.revokeObjectURL(href)
      setBanner({ tone: 'success', message: '목표 엑셀 다운로드를 시작했습니다.' })
      setShowExport(false)
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '목표 엑셀 다운로드에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function decideAi(action: 'approve' | 'reject') {
    if (!aiPreview) return
    setBusy(true)
    try {
      await fetchJson(`/api/ai/request-logs/${aiPreview.requestLogId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approvedPayload: action === 'approve' ? aiPreview.result : undefined,
          rejectionReason: action === 'reject' ? 'User rejected org KPI AI result.' : undefined,
        }),
      })

      if (action === 'approve') {
        if (aiAction === 'generate-draft') {
          const primaryRecommendation = extractKpiAiPreviewRecommendations(aiPreview.result)[0]

          if (primaryRecommendation) {
            openAiPreviewRecommendationEditor(primaryRecommendation, 0)
          } else {
            const nextForm = (() => {
              const current = form
              const suggestedTargetValue = String(
                aiPreview.result.targetValueSuggestion ?? aiPreview.result.targetValueE ?? current.targetValueE
              )

              return {
                ...current,
                kpiCategory: String(aiPreview.result.category ?? current.kpiCategory),
                kpiName: String(aiPreview.result.title ?? current.kpiName),
                definition: String(aiPreview.result.definition ?? current.definition),
                formula: String(aiPreview.result.formula ?? current.formula),
                targetValueT: String(aiPreview.result.targetValueT ?? suggestedTargetValue),
                targetValueE: String(aiPreview.result.targetValueE ?? suggestedTargetValue),
                targetValueS: String(aiPreview.result.targetValueS ?? suggestedTargetValue),
                unit: String(aiPreview.result.unit ?? current.unit),
                weight: String(aiPreview.result.weightSuggestion ?? current.weight),
              }
            })()
            openEditorWithForm(nextForm, {
              recommendationIndex: null,
              draftSourceLabel: 'AI 대표 추천 기반 초안',
            })
          }
        }

        if (aiAction === 'improve-wording' && selectedKpi) {
          openEditorWithForm(
            {
              ...buildFormFromKpi(selectedKpi),
              kpiName: String(aiPreview.result.improvedTitle ?? selectedKpi.title),
              definition: String(aiPreview.result.improvedDefinition ?? selectedKpi.definition ?? ''),
            },
            {
              editingId: selectedKpi.id,
            }
          )
        }

        setBanner({ tone: 'success', message: 'AI 제안을 반영했습니다.' })
        if (aiAction === 'generate-draft') {
          return
        }
      } else {
        setBanner({ tone: 'info', message: 'AI 제안을 반려했습니다.' })
      }

      setAiPreview(null)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 처리에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function saveBusinessPlan() {
    if (!teamAiContext) return

    setBusy(true)
    try {
      await fetchJson('/api/kpi/org/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(businessPlanForm),
      })
      await loadTeamAiContext(teamAiContext.targetDepartmentId)
      setBanner({ tone: 'success', message: '본부 사업계획서를 저장했습니다.' })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '본부 사업계획서 저장에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function saveJobDescription(scope: JobDescriptionFormState['scope']) {
    const formState = scope === 'DIVISION' ? divisionJobDescriptionForm : teamJobDescriptionForm
    const successMessage = scope === 'DIVISION' ? '본부 직무기술서를 저장했습니다.' : '팀 직무기술서를 저장했습니다.'

    setBusy(true)
    try {
      await fetchJson('/api/kpi/org/job-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      })
      await loadTeamAiContext(scope === 'DIVISION' ? selectedDepartmentId : formState.deptId)
      setBanner({ tone: 'success', message: successMessage })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '직무기술서 저장에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function requestTeamRecommendations() {
    const targetDeptId = selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId

    setBusy(true)
    try {
      await fetchJson('/api/kpi/org/team-ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDeptId,
          evalYear: pageData.selectedYear,
        }),
      })
      await loadTeamAiContext(targetDeptId)
      setBanner({ tone: 'success', message: '연계형/독립형 팀 KPI AI 추천을 생성했습니다.' })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '팀 KPI AI 추천 생성에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function applyRecommendationAsIs(itemId: string) {
    setBusy(true)
    try {
      const result = await fetchJson<{ createdKpi: { id: string; deptId: string } | null }>(
        `/api/kpi/org/team-ai/recommendations/${itemId}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'ADOPT_AS_IS' }),
        }
      )

      const createdKpi = result.createdKpi
      if (createdKpi) {
        setSelectedDepartmentId(createdKpi.deptId)
        commitSelectedKpi(createdKpi.id)
      }

      await loadTeamAiContext(createdKpi?.deptId ?? selectedDepartmentId)
      setBanner({ tone: 'success', message: 'AI 추천 KPI를 그대로 채택했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : 'AI 추천 KPI 채택에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function dismissRecommendation(itemId: string) {
    setBusy(true)
    try {
      await fetchJson(`/api/kpi/org/team-ai/recommendations/${itemId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'DISMISSED' }),
      })
      await loadTeamAiContext(selectedDepartmentId)
      setBanner({ tone: 'info', message: '추천 KPI를 제외했습니다.' })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '추천 KPI 제외에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  const closeEditorModal = useCallback(() => {
    setShowForm(false)
    setEditingKpiId(null)
    setPendingRecommendationDecision(null)
    setEditorDraftSourceLabel(null)
    setEditorBaselineForm(null)
    setShowRecommendationSwitchConfirm(false)
    setPendingAiRecommendationIndex(null)
    setShowEditorCloseConfirm(false)
    setForm(buildEmptyForm(pageData.selectedYear, activeScopeDepartmentId))
  }, [activeScopeDepartmentId, pageData.selectedYear])

  const closeEditorModalWithRetentionNotice = useCallback(() => {
    closeEditorModal()
    if (aiPreviewRecommendations.length) {
      setShowAiRecommendationRetainedNotice(true)
    }
  }, [aiPreviewRecommendations.length, closeEditorModal])

  const applyAiPreviewRecommendationSelection = useCallback((index: number) => {
    const item = aiPreviewRecommendations[index]

    if (!item) {
      setBanner({
        tone: 'error',
        message: '선택할 수 있는 AI 추천안이 없습니다. 먼저 추천을 생성해 주세요.',
      })
      return false
    }

    const nextForm = buildOrgKpiFormFromAiRecommendation(item, pageData.selectedYear, activeScopeDepartmentId)
    openEditorWithForm(nextForm, {
      recommendationIndex: index,
      draftSourceLabel: buildOrgKpiAiRecommendationSourceLabel(index),
      bannerMessage: `AI 추천안 ${index + 1}을 초안에 반영했습니다.`,
    })

    return true
  }, [activeScopeDepartmentId, aiPreviewRecommendations, openEditorWithForm, pageData.selectedYear])

  const openAiPreviewRecommendationEditor = useCallback((item: KpiAiPreviewRecommendation, index: number) => {
    const nextForm = buildOrgKpiFormFromAiRecommendation(item, pageData.selectedYear, activeScopeDepartmentId)
    openEditorWithForm(nextForm, {
      recommendationIndex: index,
      draftSourceLabel: buildOrgKpiAiRecommendationSourceLabel(index),
      bannerMessage: `AI 추천안 ${index + 1}을 초안에 반영했습니다.`,
    })
  }, [activeScopeDepartmentId, openEditorWithForm, pageData.selectedYear])

  function handleAiRecommendationSelection(index: number) {
    if (!aiPreviewRecommendations.length) {
      setBanner({
        tone: 'error',
        message: '선택할 수 있는 AI 추천안이 없습니다. 먼저 추천을 생성해 주세요.',
      })
      return
    }

    if (selectedAiRecommendationIndex === index && showForm) {
      return
    }

    if (showForm && editorIsDirty) {
      setPendingAiRecommendationIndex(index)
      setShowRecommendationSwitchConfirm(true)
      return
    }

    applyAiPreviewRecommendationSelection(index)
  }

  function confirmAiRecommendationSwitch() {
    if (pendingAiRecommendationIndex === null) return
    applyAiPreviewRecommendationSelection(pendingAiRecommendationIndex)
  }

  function requestCloseEditorModal() {
    if (editorIsDirty) {
      setShowEditorCloseConfirm(true)
      return
    }

    closeEditorModalWithRetentionNotice()
  }

  const toggleMapNodeExpansion = useCallback((kpiId: string) => {
    setExpandedMapNodeIds((current) =>
      current.includes(kpiId) ? current.filter((item) => item !== kpiId) : [...current, kpiId]
    )
  }, [])

  const openDirectKpiCreate = useCallback(() => {
    const nextForm = buildEmptyForm(pageData.selectedYear, activeScopeDepartmentId)
    openEditorWithForm(nextForm, {
      recommendationIndex: null,
      draftSourceLabel: null,
      bannerMessage:
        pageData.selectedScope === 'division'
          ? '직접 본부 KPI를 작성하는 편집 모드입니다.'
          : '직접 팀 KPI를 작성하는 편집 모드입니다.',
    })
  }, [activeScopeDepartmentId, openEditorWithForm, pageData.selectedScope, pageData.selectedYear])

  function openRecommendationEditor(
    item: OrgKpiTeamRecommendationItemView,
    decision: RecommendationDecisionMode
  ) {
    openEditorWithForm(buildFormFromTeamRecommendation(item, pageData.selectedYear, activeScopeDepartmentId), {
      pendingDecision: { itemId: item.id, decision },
      draftSourceLabel: decision === 'REFERENCED_NEW' ? 'AI 추천 참고 신규 초안' : 'AI 추천 수정 채택 초안',
      bannerMessage:
        decision === 'REFERENCED_NEW'
          ? 'AI 추천을 참고해 새 팀 KPI를 작성합니다.'
          : 'AI 추천을 수정 후 채택하는 편집 모드입니다.',
    })
  }

  async function runTeamAiReview() {
    const targetDeptId = selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId
    const targetOrgKpiIds = list
      .filter((item) => item.departmentId === targetDeptId)
      .map((item) => item.id)

    if (!targetOrgKpiIds.length) {
      setBanner({ tone: 'error', message: 'AI 재검토를 실행할 팀 KPI가 없습니다.' })
      return
    }

    setBusy(true)
    try {
      await fetchJson('/api/kpi/org/team-ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDeptId,
          evalYear: pageData.selectedYear,
          orgKpiIds: targetOrgKpiIds,
        }),
      })
      await loadTeamAiContext(targetDeptId)
      setBanner({ tone: 'success', message: '팀 KPI AI 재검토 결과를 저장했습니다.' })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '팀 KPI AI 재검토에 실패했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  function handleScopeSwitch(nextScope: OrgKpiScope) {
    if (nextScope === pageData.selectedScope) return
    router.push(
      buildOrgKpiHref({
        scope: nextScope,
        dept: null,
        kpiId: null,
      })
    )
  }

  function handleYearChange(nextYear: string) {
    router.push(
      buildOrgKpiHref({
        year: nextYear,
        dept: null,
        kpiId: null,
      })
    )
  }

  if (!canRenderWorkspace) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">조직 KPI</h1>
        {loadAlerts}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {pageData.state === 'permission-denied' ? '권한이 없습니다' : '조직 KPI 화면을 불러오지 못했습니다'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{pageData.message ?? '잠시 후 다시 시도해 주세요.'}</p>
        </div>
        <QuickLinks />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Goal Alignment</span>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{scopeLabel}</span>
              {isReadOnlyMemberView ? (
                <span
                  data-testid="org-kpi-member-readonly-badge"
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  내 팀 조회 전용
                </span>
              ) : null}
              <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_CLASS[pageData.summary.confirmedRate === 100 ? 'CONFIRMED' : pageData.summary.confirmedCount > 0 ? 'SUBMITTED' : 'DRAFT'])}>
                {pageData.summary.confirmedRate === 100 ? '확정' : pageData.summary.confirmedCount > 0 ? '제출됨' : '초안'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">조직 KPI</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{scopeDescription}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {pageData.scopeTabs.map((scopeTab) => (
                  <button
                    key={scopeTab.key}
                    type="button"
                    onClick={() => handleScopeSwitch(scopeTab.key)}
                    className={cls(
                      'rounded-2xl border px-4 py-4 text-left transition',
                      scopeTab.key === pageData.selectedScope
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{scopeTab.label}</div>
                      <div className={cls('rounded-full px-2.5 py-1 text-xs font-semibold', scopeTab.key === pageData.selectedScope ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700')}>
                        {scopeTab.totalCount}개
                      </div>
                    </div>
                    <p className={cls('mt-2 text-xs leading-5', scopeTab.key === pageData.selectedScope ? 'text-slate-200' : 'text-slate-500')}>
                      {scopeTab.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="연도">
                <select value={pageData.selectedYear} onChange={(event) => handleYearChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  {pageData.availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
                </select>
              </Field>
              <Field label={departmentFilterLabel}>
                <select value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  {pageData.departments.length > 1 ? <option value="ALL">{allDepartmentLabel}</option> : null}
                  {pageData.departments.map((department) => <option key={department.id} value={department.id}>{'- '.repeat(department.level)}{department.name}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {isReadOnlyMemberView ? (
            <MemberReadOnlySummaryCard
              scopeLabel={scopeLabel}
              departmentName={pageData.actor.departmentName}
              totalCount={pageData.summary.totalCount}
              linkedPersonalKpiCount={pageData.summary.linkedPersonalKpiCount}
              riskCount={pageData.summary.riskCount}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <ActionButton label={scopeCreateLabel} icon={<Plus className="h-4 w-4" />} onClick={openDirectKpiCreate} disabled={!pageData.permissions.canCreate || goalEditLocked} primary />
            <ActionButton label={scopeBulkUploadLabel} icon={<FileUp className="h-4 w-4" />} onClick={() => setShowBulkUpload(true)} disabled={!pageData.permissions.canCreate} />
            <ActionButton label="목표 일괄 수정" icon={<FilePenLine className="h-4 w-4" />} onClick={handleOpenBulkEdit} disabled={Boolean(bulkEditDisabledReason) || busy} />
            <ActionButton label="엑셀 다운로드" icon={<Archive className="h-4 w-4" />} onClick={handleOpenExport} disabled={Boolean(exportDisabledReason) || busy} />
            <ActionButton label="제출" icon={<Send className="h-4 w-4" />} onClick={() => void runWorkflow('SUBMIT')} disabled={!selectedKpi || !pageData.permissions.canManage || busy} />
            <ActionButton label="확정" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => void changeStatus('CONFIRMED')} disabled={!selectedKpi || !pageData.permissions.canConfirm || busy} />
            <ActionButton label="잠금" icon={<Lock className="h-4 w-4" />} onClick={() => void runWorkflow('LOCK')} disabled={!selectedKpi || !pageData.permissions.canLock || busy} />
            <ActionButton label="이력 보기" icon={<Archive className="h-4 w-4" />} onClick={() => setTab('history')} disabled={false} />
          </div>
          )}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {visibleTabs.map((tabKey) => (
                <button key={tabKey} type="button" onClick={() => setTab(tabKey)} className={cls('rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === tabKey ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                  {TAB_LABELS[tabKey]}
                </button>
              ))}
            </div>
            {tab === 'map' || tab === 'list' ? (
              <div className="w-full lg:w-80 xl:w-96">
                <OrgKpiSearchField
                  value={search}
                  onChange={setSearch}
                  departmentFilterLabel={departmentFilterLabel}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {loadAlerts}
      {banner ? <BannerBox tone={banner.tone} message={banner.message} /> : null}

      {tab === 'map' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-4">
            <h2 className="text-base font-semibold text-slate-900">{scopeMapTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pageData.selectedScope === 'division'
                ? '상위 조직 KPI 구조를 따라가며 하위 팀 KPI와의 연결 흐름, 누락 KPI, 위험 신호를 한눈에 확인합니다.'
                : '팀 KPI를 중심으로 상위 본부 KPI 정렬 상태와 실행 리스크를 구조 관점에서 확인합니다.'}
            </p>
          </div>
          {pageData.departments.length > 1 ? (
            <OrgKpiDepartmentFilterToolbar
              departments={pageData.departments}
              allDepartmentLabel={allDepartmentLabel}
              departmentFilterLabel={departmentFilterLabel}
              selectedDepartmentId={selectedDepartmentId}
              onSelectDepartment={setSelectedDepartmentId}
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-4">
              <OrgKpiHierarchyPanel
                roots={hierarchyView.roots}
                disconnected={hierarchyView.disconnected}
                selectedKpiId={activeKpiId || selectedKpi?.id || null}
                ancestorIds={hierarchyView.ancestorIds}
                descendantIds={hierarchyView.descendantIds}
                expandedIdSet={expandedMapNodeIdSet}
                onToggleExpand={toggleMapNodeExpansion}
                onSelectKpi={handleSelectKpi}
                canCreate={!isReadOnlyMemberView && pageData.permissions.canCreate && !goalEditLocked}
                canManage={pageData.permissions.canManage}
                readOnly={isReadOnlyMemberView}
                goalEditLocked={goalEditLocked}
                onCreateChildGoal={handleCreateChildGoal}
                onEditParentLink={handleEditParentLink}
                onViewLinkage={handleViewLinkage}
              />
            </div>

            <KpiDetailCard
              kpi={selectedKpi}
              parentReference={selectedParentReference}
              childReferences={selectedChildReferences}
              permissions={pageData.permissions}
              readOnly={isReadOnlyMemberView}
              goalEditLocked={goalEditLocked}
              busy={busy}
              cloneDisabledReason={cloneDisabledReason}
              deleteActionState={deleteActionState}
              onEdit={handleEditKpi}
              onClone={handleOpenClone}
              onDelete={handleOpenDeleteConfirm}
              onWorkflow={handleWorkflowAction}
              onStatus={handleStatusChange}
              onAi={handleAiAction}
              onSelectRelatedKpi={handleOpenRelatedReference}
              onCreateChildGoal={handleCreateChildGoal}
              onViewLinkage={handleViewLinkage}
            />
          </div>
        </div>
      ) : null}

      {tab === 'list' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <h2 className="text-base font-semibold text-slate-900">{scopeListTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pageData.selectedScope === 'division'
                ? '본부·실 등 상위 조직 KPI를 검색하고, 연결 상태와 하위 실행 흐름을 운영 관점에서 빠르게 확인합니다.'
                : '팀 KPI를 검색하고, 상위 본부 KPI 정렬 상태와 실행 맥락을 함께 확인합니다.'}
            </p>
          </div>
          {pageData.departments.length > 1 ? (
            <OrgKpiDepartmentFilterToolbar
              departments={pageData.departments}
              allDepartmentLabel={allDepartmentLabel}
              departmentFilterLabel={departmentFilterLabel}
              selectedDepartmentId={selectedDepartmentId}
              onSelectDepartment={setSelectedDepartmentId}
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-3">
              {filteredList.length ? filteredList.map((kpi) => (
                <OrgKpiListItemCard
                  key={kpi.id}
                  kpi={kpi}
                  isSelected={(activeKpiId || selectedKpi?.id || '') === kpi.id}
                  onSelect={handleSelectKpi}
                />
              )) : <EmptyState title={`등록된 ${scopeLabel}가 없습니다`} description={`${scopeCreateLabel}를 등록하거나 검색 조건을 조정해 보세요.`} />}
            </div>

            <KpiDetailCard
              kpi={selectedKpi}
              parentReference={selectedParentReference}
              childReferences={selectedChildReferences}
              permissions={pageData.permissions}
              readOnly={isReadOnlyMemberView}
              goalEditLocked={goalEditLocked}
              busy={busy}
              cloneDisabledReason={cloneDisabledReason}
              deleteActionState={deleteActionState}
              onEdit={handleEditKpi}
              onClone={handleOpenClone}
              onDelete={handleOpenDeleteConfirm}
              onWorkflow={handleWorkflowAction}
              onStatus={handleStatusChange}
              onAi={handleAiAction}
              onSelectRelatedKpi={handleOpenRelatedReference}
              onCreateChildGoal={handleCreateChildGoal}
              onViewLinkage={handleViewLinkage}
            />
          </div>
        </div>
      ) : null}

      {tab === 'linkage' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
            <h2 className="text-base font-semibold text-slate-900">연결 현황</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pageData.selectedScope === 'division'
                ? '본부 KPI를 기준으로 연결된 개인 KPI 건수, 대상 인원 연결률, 최근 실적, 하위 팀 정렬 리스크를 점검합니다.'
                : '팀 KPI를 기준으로 상위 본부 KPI 정렬 여부와 연결된 개인 KPI, 대상 인원 연결률, 월간 실적 상태를 점검합니다.'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageData.linkage.length ? pageData.linkage.map((item) => (
              <div key={item.orgKpiId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', item.riskLevel === 'HIGH' ? 'border-red-200 bg-red-100 text-red-700' : item.riskLevel === 'MEDIUM' ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-emerald-200 bg-emerald-100 text-emerald-700')}>
                    {item.riskLevel === 'HIGH' ? '위험 높음' : item.riskLevel === 'MEDIUM' ? '주의' : '정상'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.departmentName}</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <div>
                    {formatExplicitRatio({
                      numeratorLabel: '연결된 개인 KPI',
                      numeratorValue: item.linkedPersonalKpiCount,
                      numeratorUnit: '건',
                      denominatorLabel: '대상 인원',
                      denominatorValue: item.targetPopulationCount,
                      denominatorUnit: '명',
                    })}
                  </div>
                  <div>대상 인원 연결률 {formatPercent(item.coverageRate)}</div>
                  <div>최근 월간 실적 {item.hasRecentMonthlyRecord ? '있음' : '없음'}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/kpi/personal" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">개인 KPI</Link>
                  <Link href="/kpi/monthly" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">월간 실적</Link>
                </div>
              </div>
            )) : <EmptyState title={`${scopeLabel} 연결 현황이 없습니다`} description="개인 KPI와 월간 실적이 연결되면 연결된 개인 KPI 건수, 대상 인원 연결률, 위험 지표를 확인할 수 있습니다." />}
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-2">
            <Timeline title={`${scopeHistoryTitle} 전체`} items={pageData.history} />
            <Timeline title="선택 KPI 이력" items={selectedKpi?.history ?? []} />
          </div>
        </div>
      ) : null}

      {tab === 'ai' ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {(Object.keys(AI_LABELS) as AiAction[]).map((action) => (
                  <button key={action} type="button" onClick={() => void requestAi(action)} disabled={busy || !pageData.permissions.canUseAi || goalEditLocked} className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                    <div className="flex items-center gap-2 font-semibold text-slate-900"><Bot className="h-4 w-4 text-slate-500" />{AI_LABELS[action]}</div>
                    <p className="mt-2 text-sm text-slate-500">결과는 preview 후 승인해야만 반영됩니다.</p>
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">AI 사용 로그</h3>
                <div className="mt-3 space-y-3">
                  {pageData.aiLogs.length ? pageData.aiLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="font-medium text-slate-900">{log.summary}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)} · {log.requesterName} · {log.requestStatus} · 승인 {log.approvalStatus}</div>
                    </div>
                  )) : <EmptyState title="AI 로그가 없습니다" description="AI 사용 이력이 여기에 남습니다." compact />}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <KpiAiPreviewPanel
                preview={
                  aiPreview
                    ? {
                        action: aiAction,
                        actionLabel: AI_LABELS[aiAction],
                        source: aiPreview.source,
                        fallbackReason: aiPreview.fallbackReason,
                        result: aiPreview.result,
                      }
                    : null
                }
                comparisons={
                  aiPreview
                    ? buildOrgAiPreviewComparisons({
                        action: aiAction,
                        result: aiPreview.result,
                        selectedKpi,
                        form,
                      })
                    : []
                }
                emptyTitle="AI 결과가 아직 없습니다"
                emptyDescription="AI 보조 기능을 실행하면 이 영역에 읽기 쉬운 미리보기가 표시됩니다."
                onReject={aiPreview ? () => void decideAi('reject') : undefined}
                onApprove={aiPreview ? () => void decideAi('approve') : undefined}
                rejectLabel="반려"
                approveLabel="적용"
                onRetry={aiPreview ? () => void requestAi(aiAction) : undefined}
                retryLabel="다시 시도"
                decisionBusy={busy}
                onSelectRecommendation={
                  aiPreview && aiAction === 'generate-draft'
                    ? (_item, index) => handleAiRecommendationSelection(index)
                    : undefined
                }
                selectedRecommendationIndex={aiAction === 'generate-draft' ? selectedAiRecommendationIndex : null}
                recommendationActionLabel="이 추천안으로 작성"
                isRecommendationDraftOpen={showForm}
              />
            </div>
          </div>

          {showAiRecommendationRetainedNotice && aiPreviewRecommendations.length ? (
            <InfoNoticeCard
              title="AI 추천 결과가 유지되고 있습니다."
              description="팝업을 닫아도 추천안은 사라지지 않습니다. 원하는 추천안을 다시 선택해 초안으로 불러올 수 있습니다."
            />
          ) : null}

          {!isReadOnlyMemberView && pageData.selectedScope === 'team' ? (
            <OrgKpiTeamAiWorkspace
              selectedDepartmentId={selectedDepartmentId}
              context={teamAiContext}
              runtimeState={teamAiRuntimeState}
              loading={teamAiLoading}
              busy={busy}
              canCreateKpi={pageData.permissions.canCreate && !goalEditLocked}
              canRunReviewAction={teamAiContext?.canRunReview === true && hasReviewableTeamKpis}
              businessPlanForm={businessPlanForm}
              divisionJobDescriptionForm={divisionJobDescriptionForm}
              teamJobDescriptionForm={teamJobDescriptionForm}
              onBusinessPlanFormChange={setBusinessPlanForm}
              onDivisionJobDescriptionFormChange={setDivisionJobDescriptionForm}
              onTeamJobDescriptionFormChange={setTeamJobDescriptionForm}
              onSaveBusinessPlan={() => void saveBusinessPlan()}
              onSaveDivisionJobDescription={() => void saveJobDescription('DIVISION')}
              onSaveTeamJobDescription={() => void saveJobDescription('TEAM')}
              onRequestRecommendation={() => void requestTeamRecommendations()}
              onAdoptRecommendationAsIs={(itemId) => void applyRecommendationAsIs(itemId)}
              onDismissRecommendation={(itemId) => void dismissRecommendation(itemId)}
              onOpenRecommendationEditor={openRecommendationEditor}
              onRetryRuntimeFallback={() => void loadTeamAiContext(selectedDepartmentId)}
              onContinueWithoutAi={() => setTab('list')}
              onCreateKpi={openDirectKpiCreate}
              onRunReview={() => void runTeamAiReview()}
            />
          ) : !isReadOnlyMemberView ? (
            <InfoNoticeCard
              title="팀 KPI AI 추천은 팀 KPI 탭에서 사용할 수 있습니다."
              description="본부 KPI에서는 상위 조직 KPI 초안과 문장 개선만 사용하고, 팀 실행 KPI 추천/검토는 팀 KPI 탭으로 이동해 진행해 주세요."
              actionLabel="팀 KPI로 이동"
              onAction={() => handleScopeSwitch('team')}
            />
          ) : null}
        </div>
      ) : null}

      <OrgKpiQuickLinks showAdminLinks={pageData.actor.role === 'ROLE_ADMIN'} readOnly={isReadOnlyMemberView} />

      {showForm ? (
        <EditorModal
          scope={pageData.selectedScope}
          scopeLabel={scopeLabel}
          departments={pageData.departments}
          parentGoalOptions={pageData.parentGoalOptions}
          editingKpiId={editingKpiId}
          form={form}
          onChange={setForm}
          onClose={requestCloseEditorModal}
          onSubmit={() => void saveKpi()}
          busy={busy}
          editing={Boolean(editingKpiId)}
          draftSourceLabel={editorRecommendationStatusLabel}
          recommendationOptions={canUseAiRecommendationDraftOptions ? aiPreviewRecommendations : []}
          selectedRecommendationIndex={canUseAiRecommendationDraftOptions ? selectedAiRecommendationIndex : null}
          onSelectRecommendation={canUseAiRecommendationDraftOptions ? handleAiRecommendationSelection : undefined}
        />
      ) : null}
      {showRecommendationSwitchConfirm ? (
        <ConfirmActionDialog
          title="다른 추천안으로 변경하시겠습니까?"
          description="현재 수정 중인 내용이 있습니다. 다른 추천안을 선택하면 지금 입력한 내용이 새 추천안으로 덮어써집니다."
          helperText="저장하지 않은 변경 사항은 복구할 수 없습니다."
          cancelLabel="취소"
          confirmLabel="추천안 변경"
          onCancel={() => {
            setShowRecommendationSwitchConfirm(false)
            setPendingAiRecommendationIndex(null)
          }}
          onConfirm={confirmAiRecommendationSwitch}
        />
      ) : null}
      {showEditorCloseConfirm ? (
        <ConfirmActionDialog
          title="작성 중인 초안을 닫으시겠습니까?"
          description="현재 팝업의 입력 내용은 닫히지만, AI 추천 결과는 화면에 그대로 유지됩니다."
          helperText="다시 열어서 같은 추천안 또는 다른 추천안을 선택할 수 있습니다."
          cancelLabel="계속 작성"
          confirmLabel="닫기"
          onCancel={() => setShowEditorCloseConfirm(false)}
          onConfirm={closeEditorModalWithRetentionNotice}
        />
      ) : null}
      {showBulkUpload ? <OrgKpiBulkUploadModal scope={pageData.selectedScope} scopeLabel={scopeLabel} departments={pageData.departments} selectedYear={pageData.selectedYear} defaultDepartmentId={selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId} onClose={() => setShowBulkUpload(false)} onUploaded={(message, tone = 'success') => { setBanner({ tone, message }); router.refresh() }} /> : null}
      {showClone ? (
        <CloneOrgKpiModal
          form={cloneForm}
          departments={pageData.departments}
          busy={busy}
          onChange={setCloneForm}
          onClose={() => setShowClone(false)}
          onSubmit={() => void handleClone()}
        />
      ) : null}
      {showBulkEdit ? (
        <OrgBulkEditModal
          form={bulkEditForm}
          targetCount={bulkTargetIds.length}
          departments={pageData.departments}
          parentGoalOptions={pageData.parentGoalOptions}
          busy={busy}
          onChange={setBulkEditForm}
          onClose={() => setShowBulkEdit(false)}
          onSubmit={() => void handleSaveBulkEdit()}
        />
      ) : null}
      {showExport ? (
        <GoalExportModal
          form={exportForm}
          year={pageData.selectedYear}
          departments={pageData.departments}
          busy={busy}
          onChange={setExportForm}
          onClose={() => setShowExport(false)}
          onSubmit={() => void handleExportGoals()}
        />
      ) : null}
      {showDeleteConfirm ? (
        <DeleteOrgKpiDialog
          kpi={selectedKpi}
          busy={busy}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => void handleDeleteKpi()}
        />
      ) : null}
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-semibold text-slate-900">{value}</div></div>
}

function MemberReadOnlySummaryCard(props: {
  scopeLabel: string
  departmentName: string
  totalCount: number
  linkedPersonalKpiCount: number
  riskCount: number
}) {
  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 xl:w-[360px]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
        {props.scopeLabel}
      </div>
      <div className="mt-3 text-lg font-semibold text-slate-900">{props.departmentName}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        이 화면은 소속 팀에 등록된 조직 KPI만 조회할 수 있는 읽기 전용 화면입니다.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <HeroStat label={props.scopeLabel} value={`${props.totalCount}개`} />
        <HeroStat label="연결된 개인 KPI" value={`${props.linkedPersonalKpiCount}개`} />
        <HeroStat label="위험 신호 KPI" value={`${props.riskCount}개`} />
      </div>
    </div>
  )
}

function BannerBox({ tone, message }: Banner) {
  return <div className={cls('rounded-2xl border px-4 py-3 text-sm', tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800')}>{message}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2 text-sm text-slate-700"><span className="font-medium">{label}</span>{children}</label>
}

function ActionButton(props: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled: boolean
  primary?: boolean
  destructive?: boolean
  title?: string
  testId?: string
}) {
  return <button type="button" onClick={props.onClick} disabled={props.disabled} title={props.title} data-testid={props.testId} className={cls('inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60', props.primary ? 'bg-slate-900 text-white hover:bg-slate-800' : props.destructive ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>{props.icon}{props.label}</button>
}

function LoadAlerts({ alerts }: { alerts: NonNullable<Props['alerts']> }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
      <div className="font-semibold">일부 운영 데이터를 불러오지 못해 기본 화면으로 표시 중입니다.</div>
      <ul className="mt-2 space-y-1">
        {alerts.map((alert) => (
          <li key={`${alert.title}-${alert.description}`}>
            - {alert.title}: {alert.description}
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatusBadge({ status }: { status: string }) {
  const toneClass = STATUS_CLASS[status as OrgKpiViewModel['status']] ?? 'bg-slate-100 text-slate-700 border-slate-200'
  const label = STATUS_LABELS[status as OrgKpiViewModel['status']] ?? status

  return <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass)}>{label}</span>
}

function EmptyState({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={cls('rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-500', compact ? 'px-4 py-6' : 'px-4 py-10')}><div className="text-sm font-semibold text-slate-900">{title}</div><p className="mt-2 text-sm leading-6">{description}</p></div>
}

type RelationBadgeTone = 'neutral' | 'linked' | 'warning' | 'critical'

function RelationBadge({ tone, children }: { tone: RelationBadgeTone; children: ReactNode }) {
  const toneClass =
    tone === 'linked'
      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-100 text-amber-800'
        : tone === 'critical'
          ? 'border-red-200 bg-red-100 text-red-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'

  return <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass)}>{children}</span>
}

function HierarchySummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1 text-sm text-slate-600">{value}</div>
    </div>
  )
}

function formatOrgKpiOwnerSummary(owner?: OrgKpiViewModel['owner']) {
  if (!owner) return '미지정'
  return owner.position ? `${owner.name} · ${owner.position}` : owner.name
}

function getOrgKpiParentSummaryText(
  kpi: OrgKpiViewModel,
  options: {
    isDisconnected?: boolean
    isOrphan?: boolean
    hasChildren?: boolean
  } = {}
) {
  if (kpi.parentOrgKpiTitle) return kpi.parentOrgKpiTitle
  if (isOrgKpiTopLevelDivisionGoal(kpi) && !options.isOrphan) return '최상위 목표'
  if (options.isDisconnected || options.isOrphan) return '연결 필요'
  if (options.hasChildren) return '최상위 목표'
  return '연결된 상위 목표 없음'
}

function MapInlineActionButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

const OrgKpiListItemCard = memo(function OrgKpiListItemCard(props: {
  kpi: OrgKpiViewModel
  isSelected: boolean
  onSelect: (kpiId: string) => void
}) {
  const structureSummary = useMemo(() => buildOrgKpiStructureSummary(props.kpi), [props.kpi])
  const hasChildren = props.kpi.childOrgKpiCount > 0

  return (
    <button
      type="button"
      onClick={() => props.onSelect(props.kpi.id)}
      className={cls(
        'w-full rounded-2xl border px-4 py-4 text-left transition',
        props.isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{props.kpi.title}</span>
            <RelationBadge tone={structureSummary.tone}>{structureSummary.label}</RelationBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {props.kpi.departmentName} · {props.kpi.category ?? '카테고리 미지정'}
          </p>
          <p className="mt-2 text-sm text-slate-600">{structureSummary.helper}</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <div className="font-semibold text-slate-900">
            {formatOrgKpiTargetValues({
              targetValue: typeof props.kpi.targetValue === 'number' ? props.kpi.targetValue : undefined,
              targetValueT: props.kpi.targetValueT,
              targetValueE: props.kpi.targetValueE,
              targetValueS: props.kpi.targetValueS,
              unit: props.kpi.unit,
            })}
          </div>
          <div className="mt-1">가중치 {formatValue(props.kpi.weight)}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-3">
        <HierarchySummaryField label="담당자" value={formatOrgKpiOwnerSummary(props.kpi.owner)} />
        <HierarchySummaryField
          label="상위 목표"
          value={getOrgKpiParentSummaryText(props.kpi, { hasChildren })}
        />
        <HierarchySummaryField label="하위 목표" value={formatCountWithUnit(props.kpi.childOrgKpiCount, '개')} />
      </div>
    </button>
  )
})

function OrgKpiDepartmentFilterToolbar(props: {
  departments: OrgKpiPageData['departments']
  allDepartmentLabel: string
  departmentFilterLabel: string
  selectedDepartmentId: string
  onSelectDepartment: (value: string) => void
}) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.departmentFilterLabel}</p>
      <OrgKpiDepartmentFilterButtons
        departments={props.departments}
        allDepartmentLabel={props.allDepartmentLabel}
        selectedDepartmentId={props.selectedDepartmentId}
        onSelectDepartment={props.onSelectDepartment}
      />
    </div>
  )
}

function OrgKpiDepartmentFilterButtons(props: {
  departments: OrgKpiPageData['departments']
  allDepartmentLabel: string
  selectedDepartmentId: string
  onSelectDepartment: (value: string) => void
}) {
  if (props.departments.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => props.onSelectDepartment('ALL')}
        className={cls(
          'rounded-full border px-3.5 py-2 text-sm transition',
          props.selectedDepartmentId === 'ALL'
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        {props.allDepartmentLabel}
      </button>
      {props.departments.map((department) => (
        <button
          key={department.id}
          type="button"
          onClick={() => props.onSelectDepartment(department.id)}
          className={cls(
            'rounded-full border px-3.5 py-2 text-sm transition',
            props.selectedDepartmentId === department.id
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {department.name}
        </button>
      ))}
    </div>
  )
}

function OrgKpiSearchField(props: {
  value: string
  onChange: (value: string) => void
  departmentFilterLabel: string
}) {
  return (
    <input
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
      placeholder={`KPI명 또는 ${props.departmentFilterLabel.replace(' 범위', '')} 검색`}
    />
  )
}

type OrgKpiHierarchyNodeCardProps = {
  node: OrgKpiHierarchyNode
  selectedKpiId: string | null
  ancestorIds: Set<string>
  descendantIds: Set<string>
  expandedIdSet: Set<string>
  onToggleExpand: (kpiId: string) => void
  onSelectKpi: (kpiId: string) => void
  onViewLinkage: (kpiId: string) => void
  onCreateChildGoal: (parentKpi: OrgKpiViewModel) => void
  onEditParentLink: (kpi: OrgKpiViewModel) => void
  canCreate: boolean
  canManage: boolean
  readOnly: boolean
  goalEditLocked: boolean
}

type OrgKpiDisconnectedCardProps = {
  kpi: OrgKpiViewModel
  isSelected: boolean
  onSelectKpi: (kpiId: string) => void
  onViewLinkage: (kpiId: string) => void
  onEditParentLink: (kpi: OrgKpiViewModel) => void
  canManage: boolean
  readOnly: boolean
  goalEditLocked: boolean
}

function areOrgKpiHierarchyNodeCardPropsEqual(
  prevProps: Readonly<OrgKpiHierarchyNodeCardProps>,
  nextProps: Readonly<OrgKpiHierarchyNodeCardProps>
) {
  if (prevProps.node !== nextProps.node) return false
  if (prevProps.canCreate !== nextProps.canCreate) return false
  if (prevProps.canManage !== nextProps.canManage) return false
  if (prevProps.readOnly !== nextProps.readOnly) return false
  if (prevProps.goalEditLocked !== nextProps.goalEditLocked) return false
  if (prevProps.onToggleExpand !== nextProps.onToggleExpand) return false
  if (prevProps.onSelectKpi !== nextProps.onSelectKpi) return false
  if (prevProps.onViewLinkage !== nextProps.onViewLinkage) return false
  if (prevProps.onCreateChildGoal !== nextProps.onCreateChildGoal) return false
  if (prevProps.onEditParentLink !== nextProps.onEditParentLink) return false

  const changedIds = getOrgKpiHierarchyInteractionChangedIds(
    {
      selectedKpiId: prevProps.selectedKpiId,
      ancestorIds: prevProps.ancestorIds,
      descendantIds: prevProps.descendantIds,
      expandedIds: prevProps.expandedIdSet,
    },
    {
      selectedKpiId: nextProps.selectedKpiId,
      ancestorIds: nextProps.ancestorIds,
      descendantIds: nextProps.descendantIds,
      expandedIds: nextProps.expandedIdSet,
    }
  )

  if (!changedIds.size) {
    return true
  }

  return !isOrgKpiHierarchyNodeAffected(nextProps.node, changedIds)
}

const OrgKpiDisconnectedCard = memo(function OrgKpiDisconnectedCard(props: OrgKpiDisconnectedCardProps) {
  const structureSummary = useMemo(
    () => buildOrgKpiStructureSummary(props.kpi, { isDisconnected: true }),
    [props.kpi]
  )

  return (
    <div
      className={cls(
        'rounded-2xl border px-4 py-4 transition',
        props.isSelected ? 'border-blue-300 bg-blue-50' : 'border-amber-200 bg-white hover:bg-amber-50'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-slate-900">{props.kpi.title}</div>
            <RelationBadge tone={structureSummary.tone}>{structureSummary.label}</RelationBadge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {props.kpi.departmentName} · {props.kpi.category ?? '카테고리 미지정'}
          </p>
          <p className="mt-2 text-sm text-slate-600">{structureSummary.helper}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
        <HierarchySummaryField label="소속 조직" value={props.kpi.departmentName} />
        <HierarchySummaryField label="담당자" value={formatOrgKpiOwnerSummary(props.kpi.owner)} />
        <HierarchySummaryField label="상위 목표" value={getOrgKpiParentSummaryText(props.kpi, { isDisconnected: true })} />
        <HierarchySummaryField label="하위 목표" value={formatCountWithUnit(props.kpi.childOrgKpiCount, '개')} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <MapInlineActionButton label="상세 보기" onClick={() => props.onSelectKpi(props.kpi.id)} />
        {!props.readOnly && props.canManage && !props.goalEditLocked && props.kpi.status === 'DRAFT' ? (
          <MapInlineActionButton
            label="상위 목표 연결하기"
            onClick={() => props.onEditParentLink(props.kpi)}
          />
        ) : null}
        <MapInlineActionButton label="연결 현황 보기" onClick={() => props.onViewLinkage(props.kpi.id)} />
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.kpi === nextProps.kpi &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.canManage === nextProps.canManage &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.goalEditLocked === nextProps.goalEditLocked &&
    prevProps.onSelectKpi === nextProps.onSelectKpi &&
    prevProps.onViewLinkage === nextProps.onViewLinkage &&
    prevProps.onEditParentLink === nextProps.onEditParentLink
  )
})

function OrgKpiHierarchyPanel(props: {
  roots: OrgKpiHierarchyNode[]
  disconnected: OrgKpiViewModel[]
  selectedKpiId: string | null
  ancestorIds: Set<string>
  descendantIds: Set<string>
  expandedIdSet: Set<string>
  onToggleExpand: (kpiId: string) => void
  onSelectKpi: (kpiId: string) => void
  onViewLinkage: (kpiId: string) => void
  onCreateChildGoal: (parentKpi: OrgKpiViewModel) => void
  onEditParentLink: (kpi: OrgKpiViewModel) => void
  canCreate: boolean
  canManage: boolean
  readOnly: boolean
  goalEditLocked: boolean
}) {
  if (!props.roots.length && !props.disconnected.length) {
    return (
      <EmptyState
        title="표시할 목표 구조가 없습니다"
        description="조직 KPI를 추가하거나 검색 조건을 조정하면 상위·하위 KPI 구조를 이 영역에서 확인할 수 있습니다."
      />
    )
  }

  return (
    <div className="space-y-5" data-testid="org-kpi-hierarchy-panel">
      {props.roots.length ? (
        <section className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">연결된 목표 구조</h3>
            <p className="mt-1 text-sm text-slate-500">
              현재 선택한 목표와 연결된 상위·하위 구조를 간단히 확인할 수 있습니다.
            </p>
          </div>
          {props.roots.map((root) => (
            <OrgKpiHierarchyNodeCard
              key={root.kpi.id}
              node={root}
              selectedKpiId={props.selectedKpiId}
              ancestorIds={props.ancestorIds}
              descendantIds={props.descendantIds}
              expandedIdSet={props.expandedIdSet}
              onToggleExpand={props.onToggleExpand}
              onSelectKpi={props.onSelectKpi}
              onViewLinkage={props.onViewLinkage}
              onCreateChildGoal={props.onCreateChildGoal}
              onEditParentLink={props.onEditParentLink}
              canCreate={props.canCreate}
              canManage={props.canManage}
              readOnly={props.readOnly}
              goalEditLocked={props.goalEditLocked}
            />
          ))}
        </section>
      ) : null}

      {props.disconnected.length ? (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
          data-testid="org-kpi-disconnected-section"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">미연결 KPI</h3>
              <p className="mt-1 text-sm text-slate-600">상위 목표와 아직 연결되지 않은 KPI를 따로 모아 빠르게 확인합니다.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800">
              미연결 {props.disconnected.length}개
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {props.disconnected.map((kpi) => (
              <OrgKpiDisconnectedCard
                key={kpi.id}
                kpi={kpi}
                isSelected={props.selectedKpiId === kpi.id}
                onSelectKpi={props.onSelectKpi}
                onViewLinkage={props.onViewLinkage}
                onEditParentLink={props.onEditParentLink}
                canManage={props.canManage}
                readOnly={props.readOnly}
                goalEditLocked={props.goalEditLocked}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

const OrgKpiHierarchyNodeCard = memo(function OrgKpiHierarchyNodeCard(props: OrgKpiHierarchyNodeCardProps) {
  const { node } = props
  const isSelected = props.selectedKpiId === node.kpi.id
  const isAncestor = props.ancestorIds.has(node.kpi.id)
  const isDescendant = props.descendantIds.has(node.kpi.id)
  const isExpanded = props.expandedIdSet.has(node.kpi.id)
  const totalChildCount = Math.max(node.kpi.childOrgKpiCount, node.children.length)
  const hiddenChildCount = Math.max(totalChildCount - node.children.length, 0)
  const hasVisibleChildren = node.children.length > 0
  const hasChildren = totalChildCount > 0
  const structureSummary = useMemo(
    () =>
      buildOrgKpiStructureSummary(node.kpi, {
        isDisconnected: node.isDisconnected,
        isOrphan: node.isOrphan,
        visibleChildCount: node.children.length,
      }),
    [node]
  )
  const toneClass =
    structureSummary.tone === 'critical'
      ? 'border-red-200 bg-red-50/80'
      : structureSummary.tone === 'warning'
        ? 'border-amber-200 bg-amber-50/80'
        : structureSummary.tone === 'linked'
          ? 'border-emerald-200 bg-white'
          : 'border-slate-200 bg-white'
  const handleViewLinkage = useCallback(() => {
    props.onViewLinkage(node.kpi.id)
  }, [node.kpi.id, props.onViewLinkage])
  const handleCreateChildGoal = useCallback(() => {
    props.onCreateChildGoal(node.kpi)
  }, [node.kpi, props.onCreateChildGoal])

  return (
    <div className={cls('relative', node.depth > 0 ? 'pl-1 sm:pl-2' : '')}>
      <div
        className={cls(
          'rounded-2xl border px-4 py-4 transition',
          toneClass,
          isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : '',
          isAncestor ? 'ring-1 ring-blue-200' : '',
          isDescendant ? 'ring-1 ring-emerald-200' : ''
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{node.kpi.title}</span>
              <RelationBadge tone={structureSummary.tone}>{structureSummary.label}</RelationBadge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {node.kpi.departmentName} · {node.kpi.category ?? '카테고리 미지정'}
            </p>
            <p className="mt-2 text-sm text-slate-600">{structureSummary.helper}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-4">
          <HierarchySummaryField label="소속 조직" value={node.kpi.departmentName} />
          <HierarchySummaryField label="담당자" value={formatOrgKpiOwnerSummary(node.kpi.owner)} />
          <HierarchySummaryField
            label="상위 목표"
            value={getOrgKpiParentSummaryText(node.kpi, {
              isDisconnected: node.isDisconnected,
              isOrphan: node.isOrphan,
              hasChildren,
            })}
          />
          <HierarchySummaryField label="하위 목표" value={formatCountWithUnit(totalChildCount, '개')} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <MapInlineActionButton label="상세 보기" onClick={() => props.onSelectKpi(node.kpi.id)} />
          {hasChildren ? (
            <MapInlineActionButton
              label={isExpanded ? '하위 목표 접기' : '하위 목표 펼치기'}
              onClick={() => props.onToggleExpand(node.kpi.id)}
            />
          ) : null}
          <MapInlineActionButton label="연결 현황 보기" onClick={handleViewLinkage} />
        </div>
      </div>

      {hasChildren && !isExpanded ? (
        <div className="relative ml-5 mt-2 pl-6" data-testid="org-kpi-connector-preview">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 -top-2 h-5 border-l-2 border-dotted border-slate-400"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 w-5 border-t-2 border-dotted border-slate-400"
          />
          <div className="rounded-2xl border border-dotted border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            하위 목표 {totalChildCount}개가 연결되어 있습니다.
          </div>
        </div>
      ) : null}

      {isExpanded ? (
        <div className="relative ml-5 mt-3 pl-6" data-testid="org-kpi-expanded-child-section">
          <span
            aria-hidden="true"
            data-testid="org-kpi-connector-parent-stem"
            className="pointer-events-none absolute left-3 -top-3 h-8 border-l-2 border-dotted border-slate-400"
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">하위 목표</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  이 목표 아래 연결된 하위 목표를 확인할 수 있습니다.
                </p>
              </div>
              <div className="text-sm font-semibold text-slate-500">하위 목표 {totalChildCount}개</div>
            </div>

            {hasVisibleChildren ? (
              <div className="relative mt-4 pl-8" data-testid="org-kpi-connector-branch-group">
                {hiddenChildCount > 0 ? (
                  <p className="mb-3 text-xs leading-5 text-slate-500">
                    현재 필터 조건으로 일부 하위 목표는 숨겨져 있습니다.
                  </p>
                ) : null}
                <span
                  aria-hidden="true"
                  data-testid="org-kpi-connector-trunk"
                  className="pointer-events-none absolute bottom-6 left-2 top-0 border-l-2 border-dotted border-slate-400"
                />
                <div className="space-y-3">
                  {node.children.map((child) => (
                    <div key={child.kpi.id} className="relative pl-6" data-testid="org-kpi-connector-branch">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2 top-10 w-6 border-t-2 border-dotted border-slate-400"
                      />
                      <OrgKpiHierarchyNodeCard
                        node={child}
                        selectedKpiId={props.selectedKpiId}
                        ancestorIds={props.ancestorIds}
                        descendantIds={props.descendantIds}
                        expandedIdSet={props.expandedIdSet}
                        onToggleExpand={props.onToggleExpand}
                        onSelectKpi={props.onSelectKpi}
                        onViewLinkage={props.onViewLinkage}
                        onCreateChildGoal={props.onCreateChildGoal}
                        onEditParentLink={props.onEditParentLink}
                        canCreate={props.canCreate}
                        canManage={props.canManage}
                        readOnly={props.readOnly}
                        goalEditLocked={props.goalEditLocked}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : hiddenChildCount > 0 ? (
              <div
                className="mt-4 rounded-2xl border border-dotted border-slate-300 bg-white px-4 py-4"
                data-testid="org-kpi-filtered-child-hint"
              >
                <div className="text-sm font-semibold text-slate-900">현재 필터 조건에서 보이는 하위 목표가 없습니다</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  검색어나 부서 조건을 조정하면 연결된 하위 목표를 다시 확인할 수 있습니다.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MapInlineActionButton label="연결 현황 보기" onClick={handleViewLinkage} />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4">
                <div className="text-sm font-semibold text-slate-900">표시할 하위 목표가 없습니다</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  이 목표 아래 연결된 하위 목표가 없습니다. 필요한 경우 하위 목표를 추가하거나 연결 상태를 점검해 주세요.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!props.readOnly && props.canCreate ? (
                    <MapInlineActionButton
                      label="하위 목표 추가"
                      onClick={handleCreateChildGoal}
                    />
                  ) : null}
                  <MapInlineActionButton label="연결 현황 보기" onClick={handleViewLinkage} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}, areOrgKpiHierarchyNodeCardPropsEqual)

function InfoNoticeCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-blue-900 shadow-sm">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-blue-800">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function ConfirmActionDialog({
  title,
  description,
  helperText,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  helperText?: string
  cancelLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
          {helperText ? <p className="text-xs leading-5 text-slate-500">{helperText}</p> : null}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ActionButton label={cancelLabel} icon={<Archive className="h-4 w-4" />} onClick={onCancel} disabled={false} />
          <ActionButton
            label={confirmLabel}
            icon={<FilePenLine className="h-4 w-4" />}
            onClick={onConfirm}
            disabled={false}
            primary
          />
        </div>
      </div>
    </div>
  )
}

type KpiDetailCardProps = {
  kpi: OrgKpiViewModel | null
  parentReference: OrgKpiRelationReference | null
  childReferences: OrgKpiRelationReference[]
  permissions: OrgKpiPageData['permissions']
  readOnly?: boolean
  goalEditLocked?: boolean
  busy: boolean
  cloneDisabledReason?: string
  deleteActionState: ReturnType<typeof getOrgKpiDeleteActionState>
  onEdit: (kpi: OrgKpiViewModel) => void
  onClone: () => void
  onDelete: () => void
  onWorkflow: (action: 'SUBMIT' | 'LOCK' | 'REOPEN') => void
  onStatus: (status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') => void
  onAi: (action: AiAction) => void
  onSelectRelatedKpi?: (reference: OrgKpiRelationReference) => void
  onCreateChildGoal?: (parentKpi: OrgKpiViewModel) => void
  onViewLinkage?: (kpiId: string) => void
}

const KpiDetailCard = memo(function KpiDetailCard(props: KpiDetailCardProps) {
  const { kpi } = props
  const goalEditLocked = props.goalEditLocked ?? false
  const isReadOnly = props.readOnly ?? false

  if (!kpi) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EmptyState
          title="선택한 KPI가 없습니다"
          description="목표맵이나 목록에서 KPI를 선택하면 상세 정보와 상위·하위 연결 구조가 표시됩니다."
        />
        {isReadOnly ? null : (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
            <ActionButton
              label="삭제"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={props.onDelete}
              disabled
              destructive
              testId="org-kpi-delete-button"
              title={props.deleteActionState.reason}
            />
            <p data-testid="org-kpi-delete-helper" className="text-xs text-slate-500">
              {props.deleteActionState.reason ?? '삭제할 조직 KPI를 먼저 선택해 주세요.'}
            </p>
          </div>
        )}
      </div>
    )
  }

  const isTopLevelDivisionGoal = isOrgKpiTopLevelDivisionGoal(kpi) && !props.parentReference
  const topLevelDivisionParentCopy = '본부 KPI는 최상위 목표로 관리되며, 별도의 상위 KPI가 없습니다.'
  const relationshipSummaryHelper = isTopLevelDivisionGoal
    ? '현재 목표와 연결된 하위 목표 및 실행 상태를 확인할 수 있습니다.'
    : '상위·하위 구조와 연결 상태를 자세히 확인할 수 있습니다.'
  const missingParentCopy = isTopLevelDivisionGoal
    ? topLevelDivisionParentCopy
    : '현재 KPI는 상위 목표와 아직 연결되지 않았습니다.'
  const actualParentCopy = isTopLevelDivisionGoal
    ? topLevelDivisionParentCopy
    : '현재 KPI는 상위 조직 목표와 아직 연결되지 않았습니다.'

  return (
    <div
      data-testid="org-kpi-detail-scroll-region"
      role="region"
      aria-label={`${kpi.title} KPI 상세`}
      tabIndex={0}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 xl:min-h-0 xl:self-start xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-y-contain"
    >
      <div className="space-y-5">
        <div
          data-testid="org-kpi-detail-sticky-header"
          className="xl:sticky xl:top-0 xl:z-10 xl:-mx-5 xl:-mt-5 xl:border-b xl:border-slate-200 xl:bg-white/95 xl:px-5 xl:pt-5 xl:pb-4 xl:backdrop-blur"
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-slate-900">{kpi.title}</span>
                  <StatusBadge status={kpi.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {kpi.departmentName} · {kpi.category ?? '카테고리 미지정'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                <div className="text-xs text-slate-500">담당자</div>
                <div className="text-sm font-semibold text-slate-900">{formatOrgKpiOwnerSummary(kpi.owner)}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPill
                label="목표값"
                value={formatOrgKpiTargetValues({
                  targetValue: typeof kpi.targetValue === 'number' ? kpi.targetValue : undefined,
                  targetValueT: kpi.targetValueT,
                  targetValueE: kpi.targetValueE,
                  targetValueS: kpi.targetValueS,
                  unit: kpi.unit,
                })}
              />
              <InfoPill label="가중치" value={formatValue(kpi.weight)} />
              <InfoPill label="연결된 개인 KPI" value={formatCountWithUnit(kpi.linkedPersonalKpiCount, '건')} />
              <InfoPill label="최근 달성률" value={formatPercent(kpi.monthlyAchievementRate)} />
            </div>
          </div>
        </div>

        {kpi.tags.length ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">목표 태그</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {kpi.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <InfoBox title="정의" value={kpi.definition ?? '정의가 아직 없습니다.'} />
        <InfoBox title="산식" value={kpi.formula ?? '산식이 아직 없습니다.'} />
        <InfoBox
          title="상위 KPI 추천"
          value={
            kpi.suggestedParent
              ? `${kpi.suggestedParent.departmentName} · ${kpi.suggestedParent.title}`
              : '추천 가능한 상위 KPI가 없습니다.'
          }
        />

        <InfoBox
          title="실제 상위 목표"
          value={
            kpi.parentOrgKpiTitle
              ? `${kpi.parentOrgDepartmentName ?? '상위 조직'} · ${kpi.parentOrgKpiTitle}`
              : actualParentCopy
          }
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="org-kpi-relationship-summary">
          <div>
            <div className="text-sm font-semibold text-slate-900">연결 현황 요약</div>
            <p className="mt-1 text-xs text-slate-500">
              {relationshipSummaryHelper}
            </p>
          </div>

          <div className="mt-4 space-y-4 text-sm text-slate-600">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">상위 목표</div>
              {props.parentReference ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => props.onSelectRelatedKpi?.(props.parentReference!)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Link2 className="h-4 w-4" />
                    {props.parentReference.departmentName} · {props.parentReference.title}
                  </button>
                  <span className="text-xs text-slate-500">
                    {props.parentReference.scope === 'division'
                      ? '상위 본부 KPI로 바로 이동해 cascade 관계를 확인할 수 있습니다.'
                      : '상위 연결 KPI로 바로 이동해 cascade 관계를 확인할 수 있습니다.'}
                  </span>
                </div>
              ) : (
                <p className="mt-2">{missingParentCopy}</p>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">하위 목표</div>
              {props.childReferences.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {props.childReferences.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => props.onSelectRelatedKpi?.(child)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <GitBranchPlus className="h-4 w-4" />
                      {child.departmentName} · {child.title}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">표시할 하위 목표가 없습니다</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    이 목표 아래 연결된 하위 목표가 없습니다. 필요한 경우 하위 목표를 추가하거나 연결 현황을 확인해 주세요.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {props.onCreateChildGoal && !isReadOnly && props.permissions.canCreate ? (
                      <MapInlineActionButton
                        label="하위 목표 추가"
                        onClick={() => props.onCreateChildGoal?.(kpi)}
                      />
                    ) : null}
                    {props.onViewLinkage ? (
                      <MapInlineActionButton
                        label="연결 현황 보기"
                        onClick={() => props.onViewLinkage?.(kpi.id)}
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">개인 KPI 연결</div>
                <div className="mt-2 text-sm text-slate-700">
                  {kpi.linkedPersonalKpiCount > 0
                    ? formatExplicitRatio({
                        numeratorLabel: '연결된 개인 KPI',
                        numeratorValue: kpi.linkedPersonalKpiCount,
                        numeratorUnit: '건',
                        denominatorLabel: '대상 인원',
                        denominatorValue: kpi.targetPopulationCount,
                        denominatorUnit: '명',
                      })
                    : '연결된 개인 KPI가 없습니다'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">대상 인원 연결률</div>
                <div className="mt-2 text-sm text-slate-700">{formatPercent(kpi.coverageRate)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">최근 월간 실적</div>
                <div className="mt-2 text-sm text-slate-700">
                  {kpi.recentMonthlyRecords.length ? '최근 월간 실적 반영' : '최근 월간 실적 없음'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">연결 리스크</div>
                <div className="mt-2 text-sm text-slate-700">
                  {kpi.riskFlags.length ? kpi.riskFlags.join(' / ') : '정상 연결'}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              개인 KPI 연결과 대상 인원 연결률은 하위 KPI 수가 아니라, 이 조직 KPI가 적용되는 대상 인원 기준으로 계산됩니다.
            </p>
          </div>
        </div>

        <MidReviewReferencePanel
          kind="org-kpi"
          targetId={kpi.id}
          title="중간 점검"
          helper="최근 중간 점검에서 이 목표의 방향, 수정 필요 여부, 다음 기간 계획을 확인합니다."
        />
        {kpi.lineage.length ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">정렬 경로</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {kpi.lineage.map((item) => (
                <span key={item.id} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {item.departmentName} · {item.title}
                </span>
              ))}
              <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                {kpi.departmentName} · {kpi.title}
              </span>
            </div>
          </div>
        ) : null}

        {kpi.cloneInfo ? (
          <InfoBox
            title="복제 정보"
            value={`${kpi.cloneInfo.sourceDepartmentName ?? '원본 조직'}의 "${kpi.cloneInfo.sourceTitle}"에서 복제되었습니다. 진행 snapshot ${kpi.cloneInfo.progressEntryCount}건, 체크인 snapshot ${kpi.cloneInfo.checkinEntryCount}건을 이관했습니다.`}
          />
        ) : null}

        {kpi.riskFlags.length ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-700">연결 위험 신호</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {kpi.riskFlags.map((flag) => (
                <span key={flag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-red-700">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">내 팀원 목표 승인 상태</div>
              <p className="mt-1 text-xs text-slate-500">
                조직 KPI에 연결된 팀원 목표의 승인 대기, 승인 완료, 반려 상태를 한 번에 확인할 수 있습니다.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              {formatExplicitRatio({
                numeratorLabel: '승인 완료 개인 KPI',
                numeratorValue: kpi.linkedConfirmedPersonalKpiCount,
                numeratorUnit: '건',
                denominatorLabel: '연결된 개인 KPI',
                denominatorValue: kpi.linkedPersonalKpiCount,
                denominatorUnit: '건',
              })}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {kpi.linkedPersonalKpis.length ? (
              kpi.linkedPersonalKpis.map((personalKpi) => (
                <div
                  key={personalKpi.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{personalKpi.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {personalKpi.employeeName} · {personalKpi.employeeId}
                    </div>
                  </div>
                  <StatusBadge status={personalKpi.status} />
                </div>
              ))
            ) : (
              <EmptyState
                title="연결된 팀원 목표가 없습니다"
                description="개인 KPI와 연결되면 이 영역에서 승인 상태를 바로 확인할 수 있습니다."
                compact
              />
            )}
          </div>
        </div>

        {goalEditLocked ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            현재 주기는 목표 읽기 전용 모드입니다. 목표 생성, 수정, 삭제는 제한되며 체크인과 코멘트 운영에 집중해 주세요.
          </div>
        ) : null}

        {!isReadOnly ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton
              label="수정"
              icon={<FilePenLine className="h-4 w-4" />}
              onClick={() => props.onEdit(kpi)}
              disabled={!props.permissions.canManage || goalEditLocked || kpi.status !== 'DRAFT' || props.busy}
            />
            <ActionButton
              label="복제"
              icon={<Copy className="h-4 w-4" />}
              onClick={props.onClone}
              disabled={Boolean(props.cloneDisabledReason)}
            />
            <ActionButton
              label={kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? '다시 열기' : '제출'}
              icon={<Send className="h-4 w-4" />}
              onClick={() =>
                props.onWorkflow(
                  kpi.status === 'SUBMITTED' || kpi.status === 'LOCKED' ? 'REOPEN' : 'SUBMIT'
                )
              }
              disabled={
                !props.permissions.canManage ||
                props.busy ||
                goalEditLocked ||
                !['DRAFT', 'SUBMITTED', 'LOCKED'].includes(kpi.status)
              }
            />
            <ActionButton
              label="확정"
              icon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => props.onStatus('CONFIRMED')}
              disabled={!props.permissions.canConfirm || props.busy || ['CONFIRMED', 'LOCKED'].includes(kpi.status)}
            />
            <ActionButton
              label="잠금"
              icon={<Lock className="h-4 w-4" />}
              onClick={() => props.onWorkflow('LOCK')}
              disabled={!props.permissions.canLock || props.busy || kpi.status !== 'CONFIRMED'}
            />
            <ActionButton
              label="보관"
              icon={<Archive className="h-4 w-4" />}
              onClick={() => props.onStatus('ARCHIVED')}
              disabled={!props.permissions.canArchive || goalEditLocked || props.busy || kpi.status === 'ARCHIVED'}
            />
            <ActionButton
              label="삭제"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={props.onDelete}
              disabled={props.deleteActionState.disabled}
              destructive
              testId="org-kpi-delete-button"
              title={props.deleteActionState.reason}
            />
            <ActionButton
              label="AI 개선"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => props.onAi('improve-wording')}
              disabled={!props.permissions.canUseAi || goalEditLocked}
            />
          </div>
        ) : null}

        {!isReadOnly && props.cloneDisabledReason ? (
          <p className="text-xs text-slate-500">{props.cloneDisabledReason}</p>
        ) : null}
        {!isReadOnly && props.deleteActionState.reason ? (
          <p data-testid="org-kpi-delete-helper" className="text-xs text-slate-500">
            {props.deleteActionState.reason}
          </p>
        ) : null}

        {isReadOnly ? (
          <div
            data-testid="org-kpi-member-readonly-panel"
            className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900"
          >
            <div className="font-semibold">구성원 조회 전용 화면입니다.</div>
            <p className="mt-2 leading-6 text-blue-800">
              소속 팀의 조직 KPI와 연결된 개인 목표 현황만 확인할 수 있습니다. 목표 등록, 수정, 제출, 확정,
              잠금, 삭제와 같은 운영 작업은 팀장 이상 권한에서만 가능합니다.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/kpi/personal" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">개인 KPI 보기</Link>
          <Link href="/kpi/monthly" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">월간 실적 보기</Link>
          <Link href="/evaluation/results" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">평가 결과 보기</Link>
          {isReadOnly ? null : (
            <Link href="/evaluation/workbench" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">AI 평가 보조</Link>
          )}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.kpi === nextProps.kpi &&
    prevProps.parentReference === nextProps.parentReference &&
    prevProps.childReferences === nextProps.childReferences &&
    prevProps.permissions === nextProps.permissions &&
    (prevProps.readOnly ?? false) === (nextProps.readOnly ?? false) &&
    (prevProps.goalEditLocked ?? false) === (nextProps.goalEditLocked ?? false) &&
    prevProps.busy === nextProps.busy &&
    prevProps.cloneDisabledReason === nextProps.cloneDisabledReason &&
    prevProps.deleteActionState.disabled === nextProps.deleteActionState.disabled &&
    prevProps.deleteActionState.reason === nextProps.deleteActionState.reason &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onClone === nextProps.onClone &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onWorkflow === nextProps.onWorkflow &&
    prevProps.onStatus === nextProps.onStatus &&
    prevProps.onAi === nextProps.onAi &&
    prevProps.onSelectRelatedKpi === nextProps.onSelectRelatedKpi
  )
})

function DeleteOrgKpiDialog(props: {
  kpi: OrgKpiViewModel | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div data-testid="org-kpi-delete-dialog" role="alertdialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">조직 KPI 삭제</h2>
            <p className="mt-1 text-sm text-slate-500">
              삭제 후에는 되돌릴 수 없습니다. 연결 상태를 다시 확인한 뒤 진행해 주세요.
            </p>
          </div>
          <button type="button" onClick={props.onClose} disabled={props.busy} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
            <div className="text-sm font-semibold text-red-800">삭제 대상</div>
            <div data-testid="org-kpi-delete-name" className="mt-2 text-base font-semibold text-slate-900">
              {props.kpi?.title ?? '선택한 조직 KPI'}
            </div>
            <p className="mt-2 text-sm text-red-700">
              이 작업은 되돌릴 수 없습니다.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              label="취소"
              icon={<Archive className="h-4 w-4" />}
              onClick={props.onClose}
              disabled={props.busy}
              testId="org-kpi-delete-cancel"
            />
            <ActionButton
              label={props.busy ? '삭제 중...' : '삭제'}
              icon={<Trash2 className="h-4 w-4" />}
              onClick={props.onConfirm}
              disabled={props.busy}
              destructive
              testId="org-kpi-delete-confirm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function CloneOrgKpiModal(props: {
  form: OrgCloneForm
  departments: Props['departments']
  busy: boolean
  onChange: (next: OrgCloneForm | ((current: OrgCloneForm) => OrgCloneForm)) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">조직 KPI 복제</h2>
            <p className="mt-1 text-sm text-slate-500">
              가중치와 KPI 정의를 그대로 유지하면서, 진행률과 체크인 정보는 선택적으로 다음 연도로 바로 이어갈 수 있습니다.
            </p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">대상 조직</span>
              <select
                value={props.form.targetDeptId}
                onChange={(event) => props.onChange((current) => ({ ...current, targetDeptId: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                {props.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {'- '.repeat(department.level)}
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-900">대상 연도</span>
              <input
                type="number"
                value={props.form.targetEvalYear}
                onChange={(event) => props.onChange((current) => ({ ...current, targetEvalYear: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={props.form.includeProgress}
                onChange={(event) => props.onChange((current) => ({ ...current, includeProgress: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block font-semibold text-slate-900">진행률 snapshot 포함</span>
                <span className="mt-1 block text-slate-500">최근 실적과 달성률 metadata를 carry-over 정보로 남깁니다.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={props.form.includeCheckins}
                onChange={(event) => props.onChange((current) => ({ ...current, includeCheckins: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block font-semibold text-slate-900">체크인 snapshot 포함</span>
                <span className="mt-1 block text-slate-500">연결된 개인 KPI와 최근 discussion snapshot을 기록합니다.</span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton label="취소" icon={<Archive className="h-4 w-4" />} onClick={props.onClose} disabled={false} />
            <ActionButton
              label={props.busy ? '복제 중...' : '복제 실행'}
              icon={<Copy className="h-4 w-4" />}
              onClick={props.onSubmit}
              disabled={props.busy}
              primary
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function OrgBulkEditModal(props: {
  form: OrgBulkEditForm
  targetCount: number
  departments: Props['departments']
  parentGoalOptions: Props['parentGoalOptions']
  busy: boolean
  onChange: (next: OrgBulkEditForm | ((current: OrgBulkEditForm) => OrgBulkEditForm)) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">목표 일괄 수정</h2>
            <p className="mt-1 text-sm text-slate-500">현재 필터 결과 {props.targetCount}건에 같은 메타데이터를 적용합니다.</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={props.form.applyDepartment}
                onChange={(event) => props.onChange((current) => ({ ...current, applyDepartment: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">담당 조직 일괄 변경</span>
                <span className="mt-1 block text-xs text-slate-500">조직 개편 시 같은 묶음의 KPI를 한 번에 이동할 수 있습니다.</span>
              </span>
            </span>
            <select
              value={props.form.deptId}
              onChange={(event) => props.onChange((current) => ({ ...current, deptId: event.target.value }))}
              disabled={!props.form.applyDepartment}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {'- '.repeat(department.level)}
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={props.form.applyCategory}
                  onChange={(event) => props.onChange((current) => ({ ...current, applyCategory: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">카테고리 일괄 변경</span>
                  <span className="mt-1 block text-xs text-slate-500">조직 목표군을 재정리할 때 같은 분류로 맞춥니다.</span>
                </span>
              </span>
              <input
                value={props.form.kpiCategory}
                onChange={(event) => props.onChange((current) => ({ ...current, kpiCategory: event.target.value }))}
                disabled={!props.form.applyCategory}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                placeholder="예: 매출 성장, 고객 경험"
              />
            </label>

            <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={props.form.applyParent}
                  onChange={(event) => props.onChange((current) => ({ ...current, applyParent: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">상위 목표 일괄 정렬</span>
                  <span className="mt-1 block text-xs text-slate-500">정렬 구조를 바꿀 때 같은 parent goal을 일괄 적용합니다.</span>
                </span>
              </span>
              <select
                value={props.form.parentOrgKpiId}
                onChange={(event) => props.onChange((current) => ({ ...current, parentOrgKpiId: event.target.value }))}
                disabled={!props.form.applyParent}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              >
                <option value="">상위 목표 연결 해제</option>
                {props.parentGoalOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.departmentName} · {option.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={props.form.applyTags}
                onChange={(event) => props.onChange((current) => ({ ...current, applyTags: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">태그 일괄 변경</span>
                <span className="mt-1 block text-xs text-slate-500">쉼표로 구분된 태그를 같은 기준으로 반영합니다.</span>
              </span>
            </span>
            <input
              value={props.form.tags}
              onChange={(event) => props.onChange((current) => ({ ...current, tags: event.target.value }))}
              disabled={!props.form.applyTags}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              placeholder="예: 전사, 고객, 개선"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            저장하기 전에는 실제 KPI가 바뀌지 않으며, 저장 후 일괄 수정 이력이 남습니다.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton label="취소" icon={<Archive className="h-4 w-4" />} onClick={props.onClose} disabled={false} />
            <ActionButton
              label={props.busy ? '일괄 수정 중...' : '일괄 수정 저장'}
              icon={<FilePenLine className="h-4 w-4" />}
              onClick={props.onSubmit}
              disabled={props.busy}
              primary
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function GoalExportModal(props: {
  form: GoalExportForm
  year: number
  departments: Props['departments']
  busy: boolean
  onChange: (next: GoalExportForm | ((current: GoalExportForm) => GoalExportForm)) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">모든 목표 엑셀 다운로드</h2>
            <p className="mt-1 text-sm text-slate-500">{props.year}년 목표를 어떤 기준으로 내릴지 선택합니다.</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => props.onChange((current) => ({ ...current, mode: 'goal' }))}
              className={`rounded-2xl border p-4 text-left transition ${
                props.form.mode === 'goal' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm font-semibold text-slate-900">목표 기준</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">조직 목표별 가중치, 승인 상태, 연결된 개인 목표 수를 중심으로 내립니다.</p>
            </button>
            <button
              type="button"
              onClick={() => props.onChange((current) => ({ ...current, mode: 'employee' }))}
              className={`rounded-2xl border p-4 text-left transition ${
                props.form.mode === 'employee' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm font-semibold text-slate-900">구성원 기준</div>
              <p className="mt-2 text-xs leading-5 text-slate-500">구성원별 개인 목표, 연결된 조직 목표, 최근 달성률을 묶어서 내립니다.</p>
            </button>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-900">조직 범위</span>
            <select
              value={props.form.departmentId}
              onChange={(event) => props.onChange((current) => ({ ...current, departmentId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">전체 조직</option>
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {'- '.repeat(department.level)}
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            목표 수가 많으면 다운로드 준비에 1~2분 이상 걸릴 수 있습니다. 브라우저 다운로드가 차단되지 않았는지 함께 확인해 주세요.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton label="취소" icon={<Archive className="h-4 w-4" />} onClick={props.onClose} disabled={false} />
            <ActionButton
              label={props.busy ? '다운로드 준비 중...' : '다운로드'}
              icon={<Archive className="h-4 w-4" />}
              onClick={props.onSubmit}
              disabled={props.busy}
              primary
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function OrgKpiQuickLinks({
  showAdminLinks,
  readOnly = false,
}: {
  showAdminLinks: boolean
  readOnly?: boolean
}) {
  const items = [
    ['/kpi/personal', '개인 KPI'],
    ['/kpi/monthly', '월간 실적'],
    ['/evaluation/results', '평가 결과'],
  ]

  if (!readOnly) {
    items.push(['/evaluation/workbench', 'AI 보조 작성'])
  }

  if (showAdminLinks) {
    items.push(['/admin/eval-cycle', '평가 주기 / 읽기 모드 설정'])
    items.push(['/admin/notifications', '목표 / 체크인 리마인드'])
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">관련 바로가기</h3>
      <p className="mt-2 text-sm text-slate-500">
        조직 KPI를 개인 KPI, 월간 실적, 평가 결과, AI 보조 작성 화면과 이어서 운영할 수 있습니다.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {label}
            <span>→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Timeline({ title, items }: { title: string; items: OrgKpiPageData['history'] }) {
  return <div className="space-y-3"><div className="text-sm font-semibold text-slate-900">{title}</div>{items.length ? items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="font-medium text-slate-900">{item.action}</div><div className="text-xs text-slate-500">{formatDateTime(item.at)}</div></div><div className="mt-1 text-xs text-slate-500">{item.actor}</div>{item.fromStatus || item.toStatus ? <div className="mt-2 text-sm text-slate-600">{item.fromStatus ?? '-'} → {item.toStatus ?? '-'}</div> : null}{item.detail ? <p className="mt-2 text-sm text-slate-600">{item.detail}</p> : null}</div>) : <EmptyState title="이력이 없습니다" description="감사 가능한 변경 이력이 여기에 표시됩니다." compact />}</div>
}

function EditorModal({
  scope,
  scopeLabel,
  departments,
  form,
  onChange,
  onClose,
  onSubmit,
  busy,
  editing,
  parentGoalOptions,
  editingKpiId,
  draftSourceLabel,
  recommendationOptions,
  selectedRecommendationIndex,
  onSelectRecommendation,
}: {
  scope: OrgKpiScope
  scopeLabel: string
  departments: OrgKpiPageData['departments']
  form: FormState
  onChange: (value: FormState) => void
  onClose: () => void
  onSubmit: () => void
  busy: boolean
  editing: boolean
  parentGoalOptions: OrgKpiPageData['parentGoalOptions']
  editingKpiId?: string | null
  draftSourceLabel?: string | null
  recommendationOptions?: KpiAiPreviewRecommendation[]
  selectedRecommendationIndex?: number | null
  onSelectRecommendation?: (index: number) => void
}) {
  const filteredParentOptions = parentGoalOptions.filter(
    (option) => option.evalYear === Number(form.evalYear || new Date().getFullYear()) && option.id !== editingKpiId
  )
  const canChooseRecommendation = Boolean(recommendationOptions?.length && onSelectRecommendation)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Org KPI Form</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{editing ? `${scopeLabel} 수정` : `${scopeLabel} 추가`}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {scope === 'division'
                ? '상위 조직 KPI를 등록합니다. 하위 팀 KPI가 정렬할 기준 목표를 관리합니다.'
                : '팀 실행 KPI를 등록합니다. 가능하면 상위 본부 KPI와 연결해 cascade를 유지하세요.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
            닫기
          </button>
        </div>

        {canChooseRecommendation ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-900">추천안 선택</label>
                <p className="text-sm leading-6 text-slate-600">
                  AI 추천안 중 하나를 선택해 초안에 반영한 뒤 필요한 내용을 수정해 저장하세요.
                </p>
                <select
                  value={selectedRecommendationIndex !== null && selectedRecommendationIndex !== undefined ? String(selectedRecommendationIndex) : ''}
                  onChange={(event) => {
                    if (!event.target.value) return
                    onSelectRecommendation?.(Number(event.target.value))
                  }}
                  className="w-full rounded-2xl border border-blue-200 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="">추천안을 선택해 주세요</option>
                  {recommendationOptions?.map((_, index) => (
                    <option key={`ai-recommendation-${index}`} value={String(index)}>
                      {buildOrgKpiAiRecommendationOptionLabel(index)}
                    </option>
                  ))}
                </select>
              </div>
              {draftSourceLabel ? (
                <div className="space-y-2">
                  <div className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                    {draftSourceLabel}
                  </div>
                  <p className="max-w-xs text-xs leading-5 text-slate-600">
                    현재 선택한 추천안을 기준으로 초안이 채워져 있습니다. 저장 전까지 자유롭게 수정할 수 있습니다.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : draftSourceLabel ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">
              {draftSourceLabel}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              현재 선택한 추천안을 기준으로 초안이 채워져 있습니다. 저장 전까지 자유롭게 수정할 수 있습니다.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label={scope === 'division' ? '본부·실 조직' : '팀 조직'}>
            <select value={form.deptId} onChange={(event) => onChange({ ...form, deptId: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {'- '.repeat(department.level)}
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="평가 연도">
            <input type="number" value={form.evalYear} onChange={(event) => onChange({ ...form, evalYear: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
          </Field>
          <Field label={scope === 'division' ? '연결 가능한 상위 본부 KPI' : '정렬 가능한 상위 본부 KPI'}>
            <select value={form.parentOrgKpiId} onChange={(event) => onChange({ ...form, parentOrgKpiId: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
              <option value="">연결 안 함</option>
              {filteredParentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.departmentName} · {option.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="KPI 유형">
            <select value={form.kpiType} onChange={(event) => onChange({ ...form, kpiType: event.target.value as FormState['kpiType'] })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
              <option value="QUANTITATIVE">정량</option>
              <option value="QUALITATIVE">정성</option>
            </select>
          </Field>
          <Field label="난이도">
            <select value={form.difficulty} onChange={(event) => onChange({ ...form, difficulty: event.target.value as FormState['difficulty'] })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
              <option value="HIGH">높음</option>
              <option value="MEDIUM">중간</option>
              <option value="LOW">낮음</option>
            </select>
          </Field>
        </div>

        <div className="mt-4 grid gap-4">
          <Field label="카테고리">
            <input value={form.kpiCategory} onChange={(event) => onChange({ ...form, kpiCategory: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="예: 매출 성장, 고객 성공" />
          </Field>
          <Field label="KPI명">
            <input value={form.kpiName} onChange={(event) => onChange({ ...form, kpiName: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="예: 핵심 고객군 월간 유지율 향상" />
          </Field>
          <Field label="정의">
            <textarea value={form.definition} onChange={(event) => onChange({ ...form, definition: event.target.value })} rows={5} className="min-h-[8rem] w-full resize-y rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
          </Field>
          <Field label="산식">
            <textarea value={form.formula} onChange={(event) => onChange({ ...form, formula: event.target.value })} rows={4} className="min-h-[6rem] w-full resize-y rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="T 목표값">
            <input
              type="number"
              inputMode="decimal"
              value={form.targetValueT}
              onChange={(event) => onChange({ ...form, targetValueT: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </Field>
          <Field label="E 목표값">
            <input
              type="number"
              inputMode="decimal"
              value={form.targetValueE}
              onChange={(event) => onChange({ ...form, targetValueE: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </Field>
          <Field label="S 목표값">
            <input
              type="number"
              inputMode="decimal"
              value={form.targetValueS}
              onChange={(event) => onChange({ ...form, targetValueS: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="단위">
            <input value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
          </Field>
          <Field label="가중치">
            <input value={form.weight} onChange={(event) => onChange({ ...form, weight: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ActionButton label="취소" icon={<Archive className="h-4 w-4" />} onClick={onClose} disabled={false} />
          <ActionButton label={busy ? '저장 중...' : editing ? '수정 저장' : `${scopeLabel} 저장`} icon={<FilePenLine className="h-4 w-4" />} onClick={onSubmit} disabled={busy} primary />
        </div>
      </div>
    </div>
  )
}

function QuickLinks() {
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">연결 화면</h3><p className="mt-2 text-sm text-slate-500">조직 KPI는 개인 KPI, 월간 실적, 평가 결과와 함께 운영될 때 가장 강력해집니다.</p><div className="mt-5 grid gap-3 md:grid-cols-4">{[['/kpi/personal', '개인 KPI'], ['/kpi/monthly', '월간 실적'], ['/evaluation/results', '평가 결과'], ['/evaluation/workbench', 'AI 평가 보조']].map(([href, label]) => <Link key={href} href={href} className="inline-flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{label}<span>→</span></Link>)}</div></section>
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 px-4 py-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>
}

function InfoBox({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-900">{title}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p></div>
}
