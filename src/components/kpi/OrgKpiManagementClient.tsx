'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Archive, Bot, Copy, FilePenLine, FileUp, Lock, Plus, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import type { OrgKpiPageData, OrgKpiViewModel } from '@/server/org-kpi-page'
import {
  getOrgKpiDeleteActionState,
  resolveNextOrgKpiSelectionAfterDelete,
} from '@/lib/org-kpi-delete'
import {
  applySavedOrgKpiToList,
  buildOrgKpiServerListSignature,
} from '@/lib/org-kpi-client-state'
import {
  formatOrgKpiTargetValues,
  resolveOrgKpiTargetValues,
} from '@/lib/org-kpi-target-values'
import { buildStrategicTeamRecommendationPayload } from '@/lib/org-kpi-team-ai-recommendation'
import type { KpiAiPreviewComparison } from '@/lib/kpi-ai-preview'
import { OrgKpiBulkUploadModal } from './OrgKpiBulkUploadModal'
import { KpiAiPreviewPanel } from './KpiAiPreviewPanel'

type Props = OrgKpiPageData & {
  initialTab?: string
  initialSelectedKpiId?: string
}

type TabKey = 'map' | 'list' | 'linkage' | 'history' | 'ai'
type Banner = { tone: 'success' | 'error' | 'info'; message: string }
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
  map: '목표 맵',
  list: '목록',
  linkage: '연결 현황',
  history: '이력',
  ai: 'AI 보조',
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

  if (action !== 'generate-draft' || !pageData.teamAi?.businessPlan) {
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
export function OrgKpiManagementClient({ initialTab, initialSelectedKpiId, ...pageData }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canRenderWorkspace = pageData.state === 'ready' || pageData.state === 'empty'
  const isReadOnlyMemberView = pageData.actor.role === 'ROLE_MEMBER'
  const visibleTabs = isReadOnlyMemberView
    ? (['map', 'list', 'linkage', 'history'] as TabKey[])
    : (Object.keys(TAB_LABELS) as TabKey[])
  const defaultTab =
    initialTab && visibleTabs.includes(initialTab as TabKey) ? (initialTab as TabKey) : 'map'
  const defaultDepartmentSelection =
    pageData.departments.length > 1 ? 'ALL' : pageData.selectedDepartmentId
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(defaultDepartmentSelection)
  const [list, setList] = useState(pageData.list)
  const [selectedKpiId, setSelectedKpiId] = useState(initialSelectedKpiId ?? pageData.list[0]?.id ?? '')
  const [showForm, setShowForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showClone, setShowClone] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(buildEmptyForm(pageData.selectedYear, pageData.selectedDepartmentId))
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
  const [search, setSearch] = useState('')
  const loadAlerts = pageData.alerts?.length ? <LoadAlerts alerts={pageData.alerts} /> : null
  const serverListSignature = useMemo(() => buildOrgKpiServerListSignature(pageData.list), [pageData.list])
  const serverContextKey = `${pageData.selectedYear}:${pageData.selectedDepartmentId}:${serverListSignature}:${initialSelectedKpiId ?? ''}:${defaultTab}`
  const previousServerContextKey = useRef(serverContextKey)
  const viewContextKey = `${pageData.selectedYear}:${selectedDepartmentId}`
  const previousViewContextKey = useRef(viewContextKey)

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

  useEffect(() => {
    if (visibleTabs.includes(tab)) {
      return
    }

    setTab(visibleTabs[0] ?? 'map')
  }, [tab, visibleTabs])

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
    setSelectedKpiId(nextSelectedKpiId)
    setShowForm(false)
    setShowBulkUpload(false)
    setShowClone(false)
    setShowBulkEdit(false)
    setShowExport(false)
    setShowDeleteConfirm(false)
    setEditingKpiId(null)
    setForm(buildEmptyForm(pageData.selectedYear, pageData.selectedDepartmentId))
    setCloneForm(buildCloneForm(pageData, pageData.list[0]))
    setBulkEditForm(buildOrgBulkEditForm(pageData, nextDepartmentSelection))
    setExportForm(buildGoalExportForm(pageData, nextDepartmentSelection))
    setBanner(null)
    setAiPreview(null)
    setSearch('')
  }, [
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
    setSelectedKpiId('')
    setShowForm(false)
    setShowBulkUpload(false)
    setShowClone(false)
    setShowBulkEdit(false)
    setShowExport(false)
    setShowDeleteConfirm(false)
    setEditingKpiId(null)
    setBanner(null)
    setAiPreview(null)
    setCloneForm(buildCloneForm(pageData))
    setBulkEditForm(buildOrgBulkEditForm(pageData, selectedDepartmentId))
    setExportForm(buildGoalExportForm(pageData, selectedDepartmentId))
    setTab('map')
  }, [pageData, viewContextKey])

  useEffect(() => {
    if (!filteredList.length) {
      setSelectedKpiId('')
      return
    }
    if (!filteredList.some((item) => item.id === selectedKpiId)) {
      setSelectedKpiId(filteredList[0].id)
    }
  }, [filteredList, selectedKpiId])

  const selectedKpi =
    filteredList.find((item) => item.id === selectedKpiId) ??
    list.find((item) => item.id === selectedKpiId) ??
    filteredList[0] ??
    list[0] ??
    null
  const goalEditLocked =
    pageData.alerts?.some((alert) => alert.title.includes('읽기 전용 모드')) ?? false

  const deleteActionState = getOrgKpiDeleteActionState({
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
  })

  const cloneDisabledReason =
    !selectedKpi
      ? '복제할 조직 KPI를 먼저 선택해 주세요.'
      : !pageData.permissions.canCreate
        ? '현재 권한으로는 조직 KPI를 복제할 수 없습니다.'
        : busy
          ? '다른 작업을 처리하는 중입니다.'
          : undefined
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

    setBusy(true)
    try {
      const saved = await fetchJson<{ id: string; deptId: string }>(editingKpiId ? `/api/kpi/org/${editingKpiId}` : '/api/kpi/org', {
        method: editingKpiId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deptId: form.deptId,
          evalYear: Number(form.evalYear || pageData.selectedYear),
          parentOrgKpiId: form.parentOrgKpiId || null,
          kpiType: form.kpiType,
          kpiCategory: form.kpiCategory.trim(),
          kpiName: form.kpiName.trim(),
          tags: parseTagInput(form.tags),
          definition: form.definition.trim() || undefined,
          formula: form.formula.trim() || undefined,
          targetValueT: parseNumber(form.targetValueT),
          targetValueE: parseNumber(form.targetValueE),
          targetValueS: parseNumber(form.targetValueS),
          unit: form.unit.trim() || undefined,
          weight: Number(form.weight),
          difficulty: form.difficulty,
        }),
      })
      setBanner({
        tone: 'success',
        message: editingKpiId ? '조직 KPI를 수정했습니다.' : '새 조직 KPI를 등록했습니다.',
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
      setSelectedKpiId(saved.id)
      setShowForm(false)
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set('year', String(Number(form.evalYear || pageData.selectedYear)))
      nextParams.set('dept', saved.deptId)
      if (tab !== 'map') {
        nextParams.set('tab', tab)
      } else {
        nextParams.delete('tab')
      }
      nextParams.set('kpiId', saved.id)
      router.replace(`/kpi/org${nextParams.toString() ? `?${nextParams.toString()}` : ''}`)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '조직 KPI 저장에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  async function runWorkflow(action: 'SUBMIT' | 'LOCK' | 'REOPEN') {
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
  }

  async function changeStatus(status: 'DRAFT' | 'CONFIRMED' | 'ARCHIVED') {
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
  }

  async function requestAi(action: AiAction) {
    setBusy(true)
    setAiAction(action)
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
      setAiPreview(data)
      setTab('ai')
      setBanner({
        tone: data.source === 'ai' ? 'success' : 'info',
        message:
          data.source === 'ai'
            ? 'AI 결과를 준비했습니다. 미리보기 후 적용해 주세요.'
            : 'AI fallback 결과를 준비했습니다. 미리보기 후 적용해 주세요.',
      })
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : 'AI 요청에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  function handleOpenClone() {
    if (cloneDisabledReason || !selectedKpi) {
      setBanner({ tone: 'error', message: cloneDisabledReason ?? '복제할 조직 KPI를 먼저 선택해 주세요.' })
      return
    }

    setCloneForm(buildCloneForm(pageData, selectedKpi))
    setShowClone(true)
  }

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
            targetDeptId: cloneForm.targetDeptId,
            targetEvalYear,
            includeProgress: cloneForm.includeProgress,
            includeCheckins: cloneForm.includeCheckins,
          }),
        }
      )

      setBanner({
        tone: 'success',
        message: '조직 KPI를 복제했습니다. 복제본을 바로 이어서 수정할 수 있습니다.',
      })
      setShowClone(false)
      setCloneForm(buildCloneForm(pageData))
      setSelectedDepartmentId((current) => (current === 'ALL' ? current : cloned.deptId))
      setSelectedKpiId(cloned.id)
      setTab('map')
      router.push(`/kpi/org?year=${encodeURIComponent(String(cloned.evalYear))}&tab=map&kpiId=${encodeURIComponent(cloned.id)}`)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '조직 KPI 복제에 실패했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  function handleOpenDeleteConfirm() {
    if (deleteActionState.disabled) {
      setBanner({
        tone: 'error',
        message: deleteActionState.reason ?? '삭제할 조직 KPI를 먼저 선택해 주세요.',
      })
      return
    }

    setShowDeleteConfirm(true)
  }

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
      setSelectedKpiId(nextSelectedId)
      setShowDeleteConfirm(false)
      setShowForm(false)
      setShowClone(false)
      setEditingKpiId((current) => (current === selectedKpi.id ? null : current))
      setAiPreview(null)
      setTab((current) => (current === 'ai' ? 'map' : current))
      setBanner({
        tone: 'success',
        message: `"${selectedKpi.title}" 조직 KPI를 삭제했습니다.`,
      })

      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set('year', String(pageData.selectedYear))
      if (selectedDepartmentId !== 'ALL') {
        nextParams.set('dept', selectedDepartmentId)
      } else {
        nextParams.delete('dept')
      }
      if (tab !== 'map') {
        nextParams.set('tab', tab)
      } else {
        nextParams.delete('tab')
      }
      if (nextSelectedId) {
        nextParams.set('kpiId', nextSelectedId)
      } else {
        nextParams.delete('kpiId')
      }
      router.replace(`/kpi/org${nextParams.toString() ? `?${nextParams.toString()}` : ''}`)
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
        message: `조직 KPI ${data.updatedCount}건을 일괄 수정했습니다.`,
      })
      setShowBulkEdit(false)
      router.refresh()
    } catch (error) {
      setBanner({ tone: 'error', message: error instanceof Error ? error.message : '조직 KPI 일괄 수정에 실패했습니다.' })
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
          setEditingKpiId(null)
          setForm((current) => {
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
          })
          setShowForm(true)
        }

        if (aiAction === 'improve-wording' && selectedKpi) {
          setEditingKpiId(selectedKpi.id)
          setForm({
            ...buildFormFromKpi(selectedKpi),
            kpiName: String(aiPreview.result.improvedTitle ?? selectedKpi.title),
            definition: String(aiPreview.result.improvedDefinition ?? selectedKpi.definition ?? ''),
          })
          setShowForm(true)
        }

        setBanner({ tone: 'success', message: 'AI 제안을 반영했습니다.' })
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
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Goal Alignment</span>
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
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">조직 전략을 KPI 구조로 번역하고, 개인 KPI와 월간 실적, 평가 근거까지 이어지는 기준점을 관리합니다.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroStat label="총 조직 KPI 수" value={`${pageData.summary.totalCount}개`} />
              <HeroStat label="cascade 연결률" value={formatPercent(pageData.summary.cascadeRate)} />
              <HeroStat label="미연결 KPI 수" value={`${pageData.summary.unlinkedCount}개`} />
              <HeroStat label="확정률" value={formatPercent(pageData.summary.confirmedRate)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="연도">
                <select value={pageData.selectedYear} onChange={(event) => router.push(`/kpi/org?year=${encodeURIComponent(event.target.value)}`)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  {pageData.availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
                </select>
              </Field>
              <Field label="조직 범위">
                <select value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                  {pageData.departments.length > 1 ? <option value="ALL">전체 조직</option> : null}
                  {pageData.departments.map((department) => <option key={department.id} value={department.id}>{'- '.repeat(department.level)}{department.name}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {isReadOnlyMemberView ? (
            <MemberReadOnlySummaryCard
              departmentName={pageData.actor.departmentName}
              totalCount={pageData.summary.totalCount}
              linkedPersonalKpiCount={pageData.summary.linkedPersonalKpiCount}
              riskCount={pageData.summary.riskCount}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <ActionButton label="조직 KPI 추가" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditingKpiId(null); setForm(buildEmptyForm(pageData.selectedYear, selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId)); setShowForm(true) }} disabled={!pageData.permissions.canCreate || goalEditLocked} primary />
            <ActionButton label="일괄 업로드" icon={<FileUp className="h-4 w-4" />} onClick={() => setShowBulkUpload(true)} disabled={!pageData.permissions.canCreate} />
            <ActionButton label="목표 일괄 수정" icon={<FilePenLine className="h-4 w-4" />} onClick={handleOpenBulkEdit} disabled={Boolean(bulkEditDisabledReason) || busy} />
            <ActionButton label="엑셀 다운로드" icon={<Archive className="h-4 w-4" />} onClick={handleOpenExport} disabled={Boolean(exportDisabledReason) || busy} />
            <ActionButton label="제출" icon={<Send className="h-4 w-4" />} onClick={() => void runWorkflow('SUBMIT')} disabled={!selectedKpi || !pageData.permissions.canManage || busy} />
            <ActionButton label="확정" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => void changeStatus('CONFIRMED')} disabled={!selectedKpi || !pageData.permissions.canConfirm || busy} />
            <ActionButton label="잠금" icon={<Lock className="h-4 w-4" />} onClick={() => void runWorkflow('LOCK')} disabled={!selectedKpi || !pageData.permissions.canLock || busy} />
            <ActionButton label="이력 보기" icon={<Archive className="h-4 w-4" />} onClick={() => setTab('history')} disabled={false} />
          </div>
          )}
        </div>
      </section>

      {loadAlerts}
      {banner ? <BannerBox tone={banner.tone} message={banner.message} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="확정 KPI 수" value={`${pageData.summary.confirmedCount}개`} helper="확정 또는 잠금 상태 기준" />
        <MetricCard label="개인 KPI 연결 수" value={`${pageData.summary.linkedPersonalKpiCount}개`} helper="연결된 개인 KPI 전체 건수" />
        <MetricCard label="월간 실적 연결률" value={formatPercent(pageData.summary.monthlyCoverageRate)} helper="최근 월간 실적이 있는 KPI 비율" />
        <MetricCard label="위험 KPI 수" value={`${pageData.summary.riskCount}개`} helper="연결 또는 실적 누락 등 위험 신호" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tabKey) => (
            <button key={tabKey} type="button" onClick={() => setTab(tabKey)} className={cls('rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === tabKey ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'ai' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-3">
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="KPI명 또는 부서 검색" />
              {pageData.departments.length > 1 ? (
                <div className="space-y-2">
                  {pageData.departments.map((department) => (
                    <button key={department.id} type="button" onClick={() => setSelectedDepartmentId(department.id)} className={cls('w-full rounded-2xl border px-4 py-3 text-left text-sm transition', selectedDepartmentId === department.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}>
                      {department.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                {filteredList.length ? filteredList.map((kpi) => (
                  <button key={kpi.id} type="button" onClick={() => setSelectedKpiId(kpi.id)} className={cls('w-full rounded-2xl border px-4 py-4 text-left transition', selectedKpi?.id === kpi.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{kpi.title}</span><StatusBadge status={kpi.status} /></div>
                        <p className="mt-1 text-sm text-slate-500">{kpi.departmentName} · {kpi.category ?? '카테고리 미지정'}</p>
                      </div>
                      <div className="text-right text-sm text-slate-600">
                        <div className="font-semibold text-slate-900">
                          {formatOrgKpiTargetValues({
                            targetValue: typeof kpi.targetValue === 'number' ? kpi.targetValue : undefined,
                            targetValueT: kpi.targetValueT,
                            targetValueE: kpi.targetValueE,
                            targetValueS: kpi.targetValueS,
                            unit: kpi.unit,
                          })}
                        </div>
                        <div className="mt-1">가중치 {formatValue(kpi.weight)}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                      <span>개인 KPI {kpi.linkedPersonalKpiCount}개</span>
                      <span>달성률 {formatPercent(kpi.monthlyAchievementRate)}</span>
                      <span>owner {kpi.owner?.name ?? '미지정'}</span>
                    </div>
                    {kpi.riskFlags.length ? <div className="mt-3 flex flex-wrap gap-2">{kpi.riskFlags.map((flag) => <span key={`${kpi.id}-${flag}`} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{flag}</span>)}</div> : null}
                  </button>
                )) : <EmptyState title="표시할 KPI가 없습니다" description="조직 KPI를 추가하거나 검색 조건을 조정해 보세요." />}
              </div>

              <KpiDetailCard
                kpi={selectedKpi}
                permissions={pageData.permissions}
                readOnly={isReadOnlyMemberView}
                goalEditLocked={goalEditLocked}
                busy={busy}
                cloneDisabledReason={cloneDisabledReason}
                deleteActionState={deleteActionState}
                onEdit={(kpi) => {
                  setEditingKpiId(kpi.id)
                  setForm(buildFormFromKpi(kpi))
                  setShowForm(true)
                }}
                onClone={handleOpenClone}
                onDelete={handleOpenDeleteConfirm}
                onWorkflow={(action) => void runWorkflow(action)}
                onStatus={(status) => void changeStatus(status)}
                onAi={(action) => void requestAi(action)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'linkage' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                  <div>개인 KPI 연결 {item.linkedPersonalKpiCount} / {item.targetPopulationCount}</div>
                  <div>coverage {formatPercent(item.coverageRate)}</div>
                  <div>최근 월간 실적 {item.hasRecentMonthlyRecord ? '있음' : '없음'}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/kpi/personal" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">개인 KPI</Link>
                  <Link href="/kpi/monthly" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">월간 실적</Link>
                </div>
              </div>
            )) : <EmptyState title="연결 현황이 없습니다" description="개인 KPI와 월간 실적이 연결되면 coverage와 위험 지표를 확인할 수 있습니다." />}
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-6 xl:grid-cols-2">
            <Timeline title="전체 이력" items={pageData.history} />
            <Timeline title="선택 KPI 이력" items={selectedKpi?.history ?? []} />
          </div>
        </div>
      ) : null}

      {tab === 'ai' ? (
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
              decisionBusy={busy}
            />
          </div>
        </div>
      ) : null}

      <OrgKpiQuickLinks showAdminLinks={pageData.actor.role === 'ROLE_ADMIN'} readOnly={isReadOnlyMemberView} />

      {showForm ? <EditorModal departments={pageData.departments} parentGoalOptions={pageData.parentGoalOptions} editingKpiId={editingKpiId} form={form} onChange={setForm} onClose={() => setShowForm(false)} onSubmit={() => void saveKpi()} busy={busy} editing={Boolean(editingKpiId)} /> : null}
      {showBulkUpload ? <OrgKpiBulkUploadModal departments={pageData.departments} selectedYear={pageData.selectedYear} defaultDepartmentId={selectedDepartmentId === 'ALL' ? pageData.selectedDepartmentId : selectedDepartmentId} onClose={() => setShowBulkUpload(false)} onUploaded={(message, tone = 'success') => { setBanner({ tone, message }); router.refresh() }} /> : null}
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

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div><div className="mt-2 text-xs text-slate-500">{helper}</div></div>
}

function MemberReadOnlySummaryCard(props: {
  departmentName: string
  totalCount: number
  linkedPersonalKpiCount: number
  riskCount: number
}) {
  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 xl:w-[360px]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
        Team Scope
      </div>
      <div className="mt-3 text-lg font-semibold text-slate-900">{props.departmentName}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        이 화면은 소속 팀에 등록된 조직 KPI만 조회할 수 있는 읽기 전용 화면입니다.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <HeroStat label="팀 조직 KPI" value={`${props.totalCount}개`} />
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

function KpiDetailCard(props: {
  kpi: OrgKpiViewModel | null
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
}) {
  const { kpi } = props
  const goalEditLocked = props.goalEditLocked ?? false
  const isReadOnly = props.readOnly ?? false

  if (!kpi) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <EmptyState
          title="선택한 KPI가 없습니다"
          description="목표 맵이나 목록에서 KPI를 선택하면 상세 정보가 표시됩니다."
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
            <div className="text-xs text-slate-500">owner</div>
            <div className="text-sm font-semibold text-slate-900">{kpi.owner?.name ?? '미지정'}</div>
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
          <InfoPill label="개인 KPI 연결" value={`${kpi.linkedPersonalKpiCount}개`} />
          <InfoPill label="최근 달성률" value={formatPercent(kpi.monthlyAchievementRate)} />
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
              : '현재 KPI는 상위 조직 목표와 아직 연결되지 않았습니다.'
          }
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
            <div className="text-sm font-semibold text-red-700">linkage risk warning</div>
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
              승인 완료 {kpi.linkedConfirmedPersonalKpiCount} / 전체 {kpi.linkedPersonalKpiCount}
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
}

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
  departments,
  form,
  onChange,
  onClose,
  onSubmit,
  busy,
  editing,
  parentGoalOptions,
  editingKpiId,
}: {
  departments: OrgKpiPageData['departments']
  form: FormState
  onChange: (value: FormState) => void
  onClose: () => void
  onSubmit: () => void
  busy: boolean
  editing: boolean
  parentGoalOptions: OrgKpiPageData['parentGoalOptions']
  editingKpiId?: string | null
}) {
  const filteredParentOptions = parentGoalOptions.filter(
    (option) => option.evalYear === Number(form.evalYear || new Date().getFullYear()) && option.id !== editingKpiId
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Org KPI Form</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{editing ? '조직 KPI 수정' : '조직 KPI 추가'}</h2>
            <p className="mt-2 text-sm text-slate-500">
              측정 가능한 조직 KPI를 작성하고 개인 KPI와 월간 실적에 연결될 기준 레코드를 만듭니다.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
            닫기
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="부서">
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
          <Field label="상위 조직 목표">
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
          <ActionButton label={busy ? '저장 중...' : editing ? '수정 저장' : '조직 KPI 저장'} icon={<FilePenLine className="h-4 w-4" />} onClick={onSubmit} disabled={busy} primary />
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
