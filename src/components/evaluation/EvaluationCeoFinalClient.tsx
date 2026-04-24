'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  Undo2,
  UserRound,
  X,
} from 'lucide-react'
import type {
  CeoFinalDivisionGroup,
  CeoFinalEmployeeRow,
  CeoFinalPageData,
  CeoFinalViewModel,
} from '@/server/evaluation-ceo-final-page'

type EvaluationCeoFinalClientProps = CeoFinalPageData

type BannerState = {
  tone: 'success' | 'error' | 'info'
  message: string
} | null

type RowDraftState = {
  gradeId: string
  reason: string
  error: string
  saving: boolean
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

function formatDateTime(value?: string) {
  if (!value) return '-'

  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeReason(value: string) {
  return value.trim()
}

function buildPerformanceDetailHref(cycleId: string, evaluationId?: string | null) {
  if (!evaluationId) return undefined
  return `/evaluation/performance/${encodeURIComponent(evaluationId)}?cycleId=${encodeURIComponent(cycleId)}`
}

function canManageFinalReview(role?: CeoFinalViewModel['actor']['role'] | null) {
  return role === 'ROLE_CEO' || role === 'ROLE_ADMIN'
}

function getDisplayCycleStatus(cycle?: CeoFinalViewModel['cycle'] | null) {
  if (!cycle) return { label: '대상 없음', tone: 'slate' as const }
  if (cycle.isLocked) return { label: '최종 확정 완료', tone: 'emerald' as const }
  if (cycle.isReviewConfirmed) return { label: '리뷰 확정', tone: 'blue' as const }
  return { label: '검토 진행 중', tone: 'amber' as const }
}

function compareEmployees(left: CeoFinalEmployeeRow, right: CeoFinalEmployeeRow) {
  if (left.finalized !== right.finalized) {
    return left.finalized ? 1 : -1
  }

  if (left.isAdjusted !== right.isAdjusted) {
    return left.isAdjusted ? -1 : 1
  }

  return left.employeeName.localeCompare(right.employeeName, 'ko-KR')
}

function buildDivisionGroups(rows: CeoFinalEmployeeRow[]): CeoFinalDivisionGroup[] {
  const grouped = new Map<string, CeoFinalDivisionGroup>()

  for (const row of rows) {
    const current = grouped.get(row.divisionId) ?? {
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      totalCount: 0,
      pendingCount: 0,
      adjustedCount: 0,
      finalizedCount: 0,
      employees: [],
    }

    current.employees.push(row)
    grouped.set(row.divisionId, current)
  }

  return [...grouped.values()]
    .map((group) => {
      const employees = [...group.employees].sort(compareEmployees)
      const totalCount = employees.length
      const pendingCount = employees.filter((employee) => !employee.finalized).length
      const adjustedCount = employees.filter((employee) => employee.isAdjusted).length
      const finalizedCount = employees.filter((employee) => employee.finalized).length

      return {
        ...group,
        employees,
        totalCount,
        pendingCount,
        adjustedCount,
        finalizedCount,
      }
    })
    .sort((left, right) => left.divisionName.localeCompare(right.divisionName, 'ko-KR'))
}

function buildSummary(groups: CeoFinalDivisionGroup[]) {
  const totalCount = groups.reduce((sum, group) => sum + group.totalCount, 0)
  const pendingCount = groups.reduce((sum, group) => sum + group.pendingCount, 0)
  const adjustedCount = groups.reduce((sum, group) => sum + group.adjustedCount, 0)
  const finalizedCount = groups.reduce((sum, group) => sum + group.finalizedCount, 0)

  return {
    totalCount,
    pendingCount,
    adjustedCount,
    finalizedCount,
    divisionCount: groups.length,
    readyToLock: totalCount > 0 && pendingCount === 0,
  }
}

function flattenGroups(groups: CeoFinalDivisionGroup[]) {
  return groups.flatMap((group) => group.employees)
}

function normalizeGradeValue(value?: string | null) {
  return value?.trim() ?? ''
}

function getRowCurrentGradeId(row: CeoFinalEmployeeRow) {
  return normalizeGradeValue(row.finalCeoRatingId ?? row.originalDivisionHeadRatingId ?? '')
}

function buildInitialRowDraftState(row: CeoFinalEmployeeRow): RowDraftState {
  return {
    gradeId: getRowCurrentGradeId(row),
    reason: row.adjustmentReason ?? '',
    error: '',
    saving: false,
  }
}

function getRowDraftState(
  row: CeoFinalEmployeeRow,
  drafts: Record<string, RowDraftState>
): RowDraftState {
  return drafts[row.id] ?? buildInitialRowDraftState(row)
}

function isRowDraftAdjusted(row: CeoFinalEmployeeRow, draft: RowDraftState) {
  const originalGradeId = normalizeGradeValue(row.originalDivisionHeadRatingId)
  return Boolean(originalGradeId) && draft.gradeId !== '' && draft.gradeId !== originalGradeId
}

function isRowDraftDirty(row: CeoFinalEmployeeRow, draft: RowDraftState) {
  return (
    draft.gradeId !== getRowCurrentGradeId(row) ||
    normalizeReason(draft.reason) !== normalizeReason(row.adjustmentReason ?? '')
  )
}

function shouldShowInlineReasonField(row: CeoFinalEmployeeRow, draft: RowDraftState) {
  return isRowDraftDirty(row, draft) || Boolean(draft.error)
}

async function requestJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const json = (await response.json()) as {
    success?: boolean
    data?: T
    error?: { message?: string }
  }

  if (!response.ok || !json.success) {
    throw new Error(json.error?.message ?? '요청을 처리하지 못했습니다.')
  }

  return json.data as T
}

export function EvaluationCeoFinalClient(props: EvaluationCeoFinalClientProps) {
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [rows, setRows] = useState<CeoFinalEmployeeRow[]>(flattenGroups(props.viewModel?.groups ?? []))
  const [actor, setActor] = useState(props.viewModel?.actor ?? null)
  const [cycle, setCycle] = useState(props.viewModel?.cycle ?? null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [adjustedOnly, setAdjustedOnly] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedGradeId, setSelectedGradeId] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [formError, setFormError] = useState('')
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraftState>>({})
  const [banner, setBanner] = useState<BannerState>(null)
  const [saving, setSaving] = useState(false)
  const [locking, setLocking] = useState(false)
  const deferredKeyword = useDeferredValue(searchKeyword.trim())

  useEffect(() => {
    setRows(flattenGroups(props.viewModel?.groups ?? []))
    setActor(props.viewModel?.actor ?? null)
    setCycle(props.viewModel?.cycle ?? null)
    setRowDrafts({})
  }, [props.viewModel])

  useEffect(() => {
    if (!rows.length) {
      setSelectedEmployeeId(null)
      return
    }

    if (selectedEmployeeId && !rows.some((row) => row.id === selectedEmployeeId)) {
      setSelectedEmployeeId(null)
    }
  }, [rows, selectedEmployeeId])

  const selectedEmployee = useMemo(
    () => rows.find((row) => row.id === selectedEmployeeId) ?? null,
    [rows, selectedEmployeeId]
  )

  useEffect(() => {
    if (!selectedEmployee) {
      setSelectedGradeId('')
      setAdjustReason('')
      setFormError('')
      return
    }

    const draft = getRowDraftState(selectedEmployee, rowDrafts)
    setSelectedGradeId(draft.gradeId)
    setAdjustReason(draft.reason)
    setFormError(draft.error)
  }, [
    rowDrafts,
    selectedEmployee,
    selectedEmployee?.id,
    selectedEmployee?.finalCeoRatingId,
    selectedEmployee?.originalDivisionHeadRatingId,
    selectedEmployee?.adjustmentReason,
  ])

  const selectedCycle =
    props.availableCycles.find((item) => item.id === props.selectedCycleId) ?? props.availableCycles[0] ?? null
  const selectedYear = selectedCycle?.year ?? props.availableCycles[0]?.year ?? new Date().getFullYear()
  const availableYears = Array.from(new Set(props.availableCycles.map((item) => item.year))).sort((a, b) => b - a)
  const cycleOptions = props.availableCycles.filter((item) => item.year === selectedYear)
  const scopeOptions = props.viewModel?.scopeOptions ?? []
  const selectedScopeId = cycle?.selectedScopeId ?? 'all'
  const selectedScopeOption = scopeOptions.find((item) => item.id === selectedScopeId)
  const selectedScope =
    props.viewModel?.selectedScope ??
    (selectedScopeOption
      ? {
          id: selectedScopeOption.id,
          label: selectedScopeOption.label,
          isAll: selectedScopeOption.id === 'all',
        }
      : {
      id: selectedScopeId,
      label: selectedScopeId === 'all' ? '전사 전체' : '선택 본부',
      isAll: selectedScopeId === 'all',
      })
  const statusChip = getDisplayCycleStatus(cycle)
  const allGroups = useMemo(() => buildDivisionGroups(rows), [rows])
  const summary = useMemo(() => buildSummary(allGroups), [allGroups])
  const scopeHeading = selectedScope.isAll ? '전사 전체 보기' : `선택 본부: ${selectedScope.label}`
  const scopeDescription = selectedScope.isAll
    ? '모든 본부의 결과를 함께 검토합니다. 특정 본부만 집중해서 보려면 본부 필터에서 선택해 주세요.'
    : `${selectedScope.label} 소속 직원 결과만 표시합니다. 다른 본부를 보려면 상단 본부 필터에서 전환해 주세요.`
  const listHeading = selectedScope.isAll ? '본부별 최종 확정' : `${selectedScope.label} 최종 확정`
  const listDescription = selectedScope.isAll
    ? '직원별 본부장 평가 등급과 최종 등급을 나란히 확인하고, 검토가 필요한 직원만 바로 열어 확정할 수 있습니다.'
    : `${selectedScope.label} 소속 직원의 본부장 평가 등급과 최종 등급을 비교하고, 필요한 직원을 바로 열어 확정할 수 있습니다.`
  const emptyStateDescription = selectedScope.isAll
    ? '검색어나 필터를 조정하면 다른 본부 또는 직원을 다시 확인할 수 있습니다.'
    : '현재 선택한 본부에 표시할 대상이 없습니다. 검색어나 필터를 조정하거나 전사 전체로 돌아가 다시 확인해 주세요.'

  const filteredGroups = useMemo(() => {
    const keyword = deferredKeyword.toLocaleLowerCase('ko-KR')
    const filteredRows = rows.filter((row) => {
      if (pendingOnly && row.finalized) return false
      if (adjustedOnly && !row.isAdjusted) return false
      if (!keyword) return true

      const haystack = [
        row.employeeName,
        row.positionLabel,
        row.departmentName,
        row.divisionName,
        row.originalDivisionHeadRating,
        row.finalCeoRating,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ko-KR')

      return haystack.includes(keyword)
    })

    return buildDivisionGroups(filteredRows)
  }, [adjustedOnly, deferredKeyword, pendingOnly, rows])

  const gradeOptions = props.viewModel?.gradeOptions ?? []
  const selectedGrade = gradeOptions.find((item) => item.id === selectedGradeId) ?? null
  const gradeChanged =
    Boolean(selectedEmployee?.originalDivisionHeadRatingId) &&
    selectedGradeId !== '' &&
    selectedEmployee?.originalDivisionHeadRatingId !== selectedGradeId
  const normalizedReason = normalizeReason(adjustReason)
  const formHelper = gradeChanged
    ? '등급이 변경된 경우 조정 사유를 입력해 주세요.'
    : '조정 없음. 동일 등급으로 확정할 수 있습니다.'

  function updateRowDraft(targetId: string, updater: (draft: RowDraftState) => RowDraftState) {
    const targetRow = rows.find((row) => row.id === targetId)
    if (!targetRow) return

    setRowDrafts((current) => ({
      ...current,
      [targetId]: updater(current[targetId] ?? buildInitialRowDraftState(targetRow)),
    }))
  }

  function resetRowDraft(targetId: string) {
    setRowDrafts((current) => {
      if (!(targetId in current)) return current

      const next = { ...current }
      delete next[targetId]
      return next
    })
  }

  function navigate(next: { cycleId?: string; scope?: string }) {
    const params = new URLSearchParams()
    const cycleId = next.cycleId ?? props.selectedCycleId ?? selectedCycle?.id
    const scope = next.scope ?? selectedScopeId

    if (cycleId) params.set('cycleId', cycleId)
    if (scope && scope !== 'all') params.set('scope', scope)

    startNavigation(() => {
      router.push(`/evaluation/ceo-adjust${params.toString() ? `?${params.toString()}` : ''}`)
    })
  }

  function updateRow(targetId: string, updater: (row: CeoFinalEmployeeRow) => CeoFinalEmployeeRow) {
    setRows((current) => current.map((row) => (row.id === targetId ? updater(row) : row)))
  }

  async function handleSave() {
    if (!cycle || !actor || !selectedEmployee) return
    if (!actor.canEdit) return

    if (!selectedGradeId) {
      setFormError('대표이사 최종 등급을 선택해 주세요.')
      return
    }

    if (gradeChanged && !normalizedReason) {
      setFormError('등급을 조정한 경우 사유를 입력해 주세요.')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const data = await requestJson<{
        evaluationId: string
        adjustedGrade: string
      }>('/api/evaluation/calibration', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'save',
          cycleId: cycle.id,
          targetId: selectedEmployee.id,
          gradeId: selectedGradeId,
          adjustReason: adjustReason,
        }),
      })

      const finalizedAt = new Date().toISOString()

      updateRow(selectedEmployee.id, (row) => ({
        ...row,
        finalCeoRatingId: selectedGradeId,
        finalCeoRating: selectedGrade?.grade ?? data.adjustedGrade,
        isAdjusted: selectedGradeId !== row.originalDivisionHeadRatingId,
        adjustmentReason: normalizedReason || undefined,
        finalized: true,
        finalizedAt,
        finalizedBy: actor.displayName,
        adjustedEvaluationId: data.evaluationId,
        detailEvaluationId: data.evaluationId,
        detail: {
          ...row.detail,
          performanceDetailHref: buildPerformanceDetailHref(cycle.id, data.evaluationId),
        },
      }))
      resetRowDraft(selectedEmployee.id)

      setBanner({
        tone: 'success',
        message: '대표이사 최종 등급을 확정했습니다.',
      })

      startNavigation(() => {
        router.refresh()
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '대표이사 최종 확정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!cycle || !actor || !selectedEmployee) return
    if (!actor.canEdit) return

    setSaving(true)
    setFormError('')

    try {
      await requestJson('/api/evaluation/calibration', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'clear',
          cycleId: cycle.id,
          targetId: selectedEmployee.id,
        }),
      })

      updateRow(selectedEmployee.id, (row) => ({
        ...row,
        finalCeoRatingId: row.originalDivisionHeadRatingId ?? null,
        finalCeoRating: row.originalDivisionHeadRating,
        isAdjusted: false,
        adjustmentReason: undefined,
        finalized: false,
        finalizedAt: undefined,
        finalizedBy: undefined,
        adjustedEvaluationId: null,
        detailEvaluationId: row.finalEvaluationId ?? null,
        detail: {
          ...row.detail,
          performanceDetailHref: buildPerformanceDetailHref(cycle.id, row.finalEvaluationId ?? null),
        },
      }))
      resetRowDraft(selectedEmployee.id)

      setBanner({
        tone: 'info',
        message: '원래 등급 기준으로 되돌렸습니다.',
      })

      startNavigation(() => {
        router.refresh()
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '원래 등급으로 되돌리지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInlineSave(targetId: string) {
    if (!cycle || !actor?.canEdit) return

    const targetRow = rows.find((row) => row.id === targetId)
    if (!targetRow) return

    const draft = getRowDraftState(targetRow, rowDrafts)
    const inlineGradeChanged = isRowDraftAdjusted(targetRow, draft)
    const inlineReason = normalizeReason(draft.reason)
    const draftGrade = gradeOptions.find((item) => item.id === draft.gradeId) ?? null

    if (!draft.gradeId) {
      updateRowDraft(targetId, (current) => ({
        ...current,
        error: '대표이사 최종 등급을 선택해 주세요.',
      }))
      return
    }

    if (inlineGradeChanged && !inlineReason) {
      updateRowDraft(targetId, (current) => ({
        ...current,
        error: '등급을 조정한 경우 사유를 입력해 주세요.',
      }))
      return
    }

    updateRowDraft(targetId, (current) => ({
      ...current,
      saving: true,
      error: '',
    }))

    try {
      const data = await requestJson<{
        evaluationId: string
        adjustedGrade: string
      }>('/api/evaluation/calibration', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'save',
          cycleId: cycle.id,
          targetId,
          gradeId: draft.gradeId,
          adjustReason: draft.reason,
        }),
      })

      const finalizedAt = new Date().toISOString()

      updateRow(targetId, (row) => ({
        ...row,
        finalCeoRatingId: draft.gradeId,
        finalCeoRating: draftGrade?.grade ?? data.adjustedGrade,
        isAdjusted: draft.gradeId !== row.originalDivisionHeadRatingId,
        adjustmentReason: inlineReason || undefined,
        finalized: true,
        finalizedAt,
        finalizedBy: actor.displayName,
        adjustedEvaluationId: data.evaluationId,
        detailEvaluationId: data.evaluationId,
        detail: {
          ...row.detail,
          performanceDetailHref: buildPerformanceDetailHref(cycle.id, data.evaluationId),
        },
      }))

      resetRowDraft(targetId)
      setBanner({
        tone: 'success',
        message: '저장 완료',
      })

      startNavigation(() => {
        router.refresh()
      })
    } catch (error) {
      updateRowDraft(targetId, (current) => ({
        ...current,
        saving: false,
        error: error instanceof Error ? error.message : '변경 저장에 실패했습니다.',
      }))
    }
  }

  function handleInlineReset(targetId: string) {
    resetRowDraft(targetId)
  }

  async function handleFinalizeCycle() {
    if (!cycle || !actor || !summary.readyToLock || !actor.canFinalizeCycle) return

    setLocking(true)
    setBanner(null)

    try {
      if (!cycle.isReviewConfirmed) {
        await requestJson('/api/evaluation/calibration/workflow', {
          method: 'POST',
          body: JSON.stringify({
            cycleId: cycle.id,
            action: 'CONFIRM_REVIEW',
          }),
        })
      }

      await requestJson('/api/evaluation/calibration/workflow', {
        method: 'POST',
        body: JSON.stringify({
          cycleId: cycle.id,
          action: 'LOCK',
        }),
      })

      setCycle((current) =>
        current
          ? {
              ...current,
              isLocked: true,
              isReviewConfirmed: true,
              visualStatus: 'FINAL_LOCKED',
            }
          : current
      )
      setActor((current) =>
        current
          ? {
              ...current,
              canEdit: false,
              canFinalizeCycle: false,
              canReopenCycle: true,
              readOnly: true,
            }
          : current
      )
      setBanner({
        tone: 'success',
        message: '대표이사 최종 확정이 완료되었습니다.',
      })

      startNavigation(() => {
        router.refresh()
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '최종 확정을 완료하지 못했습니다.',
      })
    } finally {
      setLocking(false)
    }
  }

  async function handleReopenCycle() {
    if (!cycle || !actor?.canReopenCycle) return

    setLocking(true)
    setBanner(null)

    try {
      await requestJson('/api/evaluation/calibration/workflow', {
        method: 'POST',
        body: JSON.stringify({
          cycleId: cycle.id,
          action: 'REOPEN_REQUEST',
        }),
      })

      setCycle((current) =>
        current
          ? {
              ...current,
              isLocked: false,
              isReviewConfirmed: false,
              visualStatus: 'CALIBRATING',
            }
          : current
      )
      setActor((current) =>
        current
          ? {
              ...current,
              canEdit: canManageFinalReview(current.role),
              canFinalizeCycle: canManageFinalReview(current.role),
              canReopenCycle: false,
              readOnly: false,
            }
          : current
      )
      setBanner({
        tone: 'info',
        message: '대표이사 확정 화면을 다시 열었습니다.',
      })

      startNavigation(() => {
        router.refresh()
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '재오픈에 실패했습니다.',
      })
    } finally {
      setLocking(false)
    }
  }

  return (
    <div className="space-y-6 pb-28">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone={statusChip.tone}>{statusChip.label}</StatusChip>
              {cycle?.isLocked ? <StatusChip tone="emerald">수정 잠금</StatusChip> : null}
              {actor?.readOnly && !cycle?.isLocked ? <StatusChip tone="slate">읽기 전용</StatusChip> : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">CEO Final Review</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">대표이사 확정</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                본부장 평가 결과를 본부별로 검토하고 필요한 경우 등급을 조정한 뒤 최종 확정합니다.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[24rem]">
            <FilterCard label="연도">
              <select
                value={selectedYear}
                onChange={(event) => {
                  const nextYear = Number(event.target.value)
                  const nextCycle = props.availableCycles.find((item) => item.year === nextYear)
                  navigate({ cycleId: nextCycle?.id, scope: 'all' })
                }}
                disabled={isNavigating || props.availableCycles.length === 0}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </select>
            </FilterCard>

            <FilterCard label="평가 주기">
              <select
                value={props.selectedCycleId ?? selectedCycle?.id ?? ''}
                onChange={(event) => navigate({ cycleId: event.target.value, scope: selectedScopeId })}
                disabled={isNavigating || cycleOptions.length === 0}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800"
              >
                {cycleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FilterCard>

            <FilterCard label="본부">
              <select
                value={selectedScopeId}
                onChange={(event) => navigate({ cycleId: props.selectedCycleId ?? selectedCycle?.id, scope: event.target.value })}
                disabled={isNavigating || scopeOptions.length === 0}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800"
              >
                {(scopeOptions.length ? scopeOptions : [{ id: 'all', label: '전사 전체' }]).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </FilterCard>

            <FilterCard label="이름 검색">
              <label className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="이름 또는 조직 검색"
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </label>
            </FilterCard>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ToggleButton
            checked={pendingOnly}
            onClick={() => setPendingOnly((current) => !current)}
            label="미확정만"
          />
          <ToggleButton
            checked={adjustedOnly}
            onClick={() => setAdjustedOnly((current) => !current)}
            label="조정 발생만"
          />
          {isNavigating ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              불러오는 중
            </span>
          ) : null}
        </div>
      </section>

      {banner ? <Banner tone={banner.tone}>{banner.message}</Banner> : null}

      <section className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">본부별 선택</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{scopeHeading}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{scopeDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="blue">총 {summary.totalCount}명</StatusChip>
            <StatusChip tone={summary.pendingCount > 0 ? 'amber' : 'emerald'}>
              미확정 {summary.pendingCount}명
            </StatusChip>
            <StatusChip tone={summary.adjustedCount > 0 ? 'blue' : 'slate'}>
              조정 발생 {summary.adjustedCount}명
            </StatusChip>
          </div>
        </div>
      </section>

      {cycle?.isLocked ? (
        <Banner tone="success">대표이사 최종 확정이 완료되어 수정이 잠겨 있습니다. 필요 시 재오픈 후 다시 검토할 수 있습니다.</Banner>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="총 대상 인원" value={`${summary.totalCount}명`} />
        <SummaryCard label="미확정 인원" value={`${summary.pendingCount}명`} tone={summary.pendingCount > 0 ? 'amber' : 'emerald'} />
        <SummaryCard label="조정 인원" value={`${summary.adjustedCount}명`} />
        <SummaryCard label="본부 수" value={`${summary.divisionCount}개`} />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-slate-900">
            <Building2 className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold">{listHeading}</h2>
          </div>
          <p className="text-sm text-slate-500">{listDescription}</p>
        </div>

        {props.state !== 'ready' || !props.viewModel ? (
          <div className="py-10">
            <EmptyState
              title="대표이사 확정 대상을 불러오지 못했습니다."
              description={props.message ?? '선택한 평가 주기에서 검토할 대상을 찾지 못했습니다.'}
            />
          </div>
        ) : filteredGroups.length ? (
          <div className="mt-6 space-y-6">
            {filteredGroups.map((group) => (
              <article key={group.divisionId} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{group.divisionName}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      총 {group.totalCount}명 · 미확정 {group.pendingCount}명 · 조정 발생 {group.adjustedCount}명
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip tone="slate">확정 완료 {group.finalizedCount}명</StatusChip>
                    <StatusChip tone={group.pendingCount > 0 ? 'amber' : 'emerald'}>
                      미확정 {group.pendingCount}명
                    </StatusChip>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.employees.map((employee) => {
                    const rowDraft = getRowDraftState(employee, rowDrafts)
                    const rowDraftAdjusted = isRowDraftAdjusted(employee, rowDraft)
                    const rowDraftDirty = isRowDraftDirty(employee, rowDraft)
                    const showInlineReason = shouldShowInlineReasonField(employee, rowDraft)
                    const rowDraftGrade =
                      gradeOptions.find((grade) => grade.id === rowDraft.gradeId)?.grade ??
                      employee.finalCeoRating ??
                      '-'
                    const showInlinePrimaryAction = Boolean(actor?.canEdit) && (rowDraftDirty || !employee.finalized)

                    return (
                      <div
                        key={employee.id}
                        className={cls(
                          'rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition',
                          selectedEmployee?.id === employee.id && 'border-sky-300 ring-2 ring-sky-100',
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedEmployeeId(employee.id)}
                                className="text-left text-base font-semibold text-slate-950 hover:text-sky-700"
                              >
                                {employee.employeeName}
                              </button>
                              {employee.positionLabel ? <StatusChip tone="slate">{employee.positionLabel}</StatusChip> : null}
                              {rowDraftDirty ? (
                                <StatusChip tone="amber">변경됨</StatusChip>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              {employee.departmentName} · {employee.divisionName}
                            </p>
                          </div>

                          <div className="flex items-start justify-end lg:shrink-0 lg:pl-6">
                            <button
                              type="button"
                              onClick={() => setSelectedEmployeeId(employee.id)}
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              검토하기
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <RowMetric label="본부장 평가 등급" value={employee.originalDivisionHeadRating} />
                          <div className="rounded-2xl bg-slate-50 px-4 py-3">
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              최종 등급
                            </span>
                            {actor?.canEdit ? (
                              <select
                                value={rowDraft.gradeId}
                                onChange={(event) =>
                                  updateRowDraft(employee.id, (current) => ({
                                    ...current,
                                    gradeId: event.target.value,
                                    error: '',
                                  }))
                                }
                                disabled={rowDraft.saving}
                                className={cls(
                                  'mt-2 h-11 w-full rounded-2xl border bg-white px-3 text-sm font-semibold text-slate-900',
                                  rowDraftAdjusted || rowDraftDirty
                                    ? 'border-sky-300 ring-2 ring-sky-100'
                                    : 'border-slate-200'
                                )}
                              >
                                <option value="">등급을 선택해 주세요.</option>
                                {gradeOptions.map((grade) => (
                                  <option key={grade.id} value={grade.id}>
                                    {grade.grade}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={cls(
                                  'mt-2 block text-sm font-semibold',
                                  rowDraftAdjusted || rowDraftDirty ? 'text-sky-700' : 'text-slate-900'
                                )}
                              >
                                {rowDraftGrade}
                              </span>
                            )}
                          </div>
                          <RowBadgeCell
                            label="조정 여부"
                            badge={
                              <StatusChip tone={rowDraftDirty ? 'amber' : rowDraftAdjusted || employee.isAdjusted ? 'blue' : 'slate'}>
                                {rowDraftDirty ? '변경됨' : rowDraftAdjusted || employee.isAdjusted ? '조정 발생' : '조정 없음'}
                              </StatusChip>
                            }
                          />
                          <RowBadgeCell
                            label="확정 상태"
                            badge={
                              <StatusChip tone={employee.finalized ? 'emerald' : 'amber'}>
                                {employee.finalized ? '확정 완료' : '미확정'}
                              </StatusChip>
                            }
                          />
                        </div>

                        {showInlineReason ? (
                          <div className="mt-4 rounded-[20px] border border-sky-200 bg-sky-50/60 p-4">
                            <div className="space-y-4">
                              <label className="block">
                                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                                  조정 사유
                                  {rowDraftAdjusted ? <span className="text-rose-600">*</span> : null}
                                </span>
                                <textarea
                                  rows={2}
                                  value={rowDraft.reason}
                                  onChange={(event) =>
                                    updateRowDraft(employee.id, (current) => ({
                                      ...current,
                                      reason: event.target.value,
                                      error: '',
                                    }))
                                  }
                                  disabled={!actor?.canEdit || rowDraft.saving}
                                  placeholder="사유를 입력해 주세요"
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 disabled:bg-slate-100"
                                />
                              </label>
                              {rowDraft.error ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                  {rowDraft.error}
                                </div>
                              ) : null}
                              <div className="border-t border-sky-200/80 pt-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                    {rowDraftAdjusted
                                      ? '등급이 변경된 경우 조정 사유를 입력해 주세요.'
                                      : '조정 없음. 동일 등급으로 확정할 수 있습니다.'}
                                  </div>
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleInlineReset(employee.id)}
                                      disabled={rowDraft.saving}
                                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      취소
                                    </button>
                                    {showInlinePrimaryAction ? (
                                      <button
                                        type="button"
                                        onClick={() => void handleInlineSave(employee.id)}
                                        disabled={rowDraft.saving}
                                        className={cls(
                                          'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-sm transition',
                                          rowDraft.saving ? 'cursor-not-allowed bg-slate-300' : 'bg-slate-950 hover:bg-slate-800'
                                        )}
                                      >
                                        {rowDraft.saving ? (
                                          <LoaderCircle className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="h-4 w-4" />
                                        )}
                                        변경 저장
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : showInlinePrimaryAction ? (
                          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              onClick={() => void handleInlineSave(employee.id)}
                              disabled={rowDraft.saving || (employee.finalized && !rowDraftDirty)}
                              className={cls(
                                'inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-sm transition',
                                rowDraft.saving || (employee.finalized && !rowDraftDirty)
                                  ? 'cursor-not-allowed bg-slate-300'
                                  : 'bg-slate-950 hover:bg-slate-800'
                              )}
                            >
                              {rowDraft.saving ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {employee.finalized ? '확정 완료' : '최종 확정'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-10">
            <EmptyState
              title="조건에 맞는 대상이 없습니다."
              description={emptyStateDescription}
            />
          </div>
        )}
      </section>

      {cycle && actor ? (
        <section className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900">
                {selectedScope.isAll
                  ? `총 ${summary.totalCount}명 중 ${summary.finalizedCount}명 확정 완료`
                  : `${selectedScope.label}에서 ${summary.totalCount}명 중 ${summary.finalizedCount}명 확정 완료`}
              </div>
              <p className="text-sm text-slate-500">
                {selectedScope.isAll
                  ? summary.readyToLock
                    ? '모든 대상의 대표이사 확정이 완료되어 최종 확정을 진행할 수 있습니다.'
                    : `아직 ${summary.pendingCount}명이 미확정 상태입니다. 모든 직원을 확정한 뒤 최종 확정을 진행해 주세요.`
                  : '현재 선택한 본부만 표시 중입니다. 사이클 전체 최종 확정 완료는 전사 전체 보기에서 진행해 주세요.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!selectedScope.isAll ? (
                <button
                  type="button"
                  onClick={() => navigate({ cycleId: props.selectedCycleId ?? selectedCycle?.id, scope: 'all' })}
                  disabled={isNavigating}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Building2 className="h-4 w-4" />
                  전사 전체 보기
                </button>
              ) : null}
              {actor.canReopenCycle ? (
                <button
                  type="button"
                  onClick={() => void handleReopenCycle()}
                  disabled={locking}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {locking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  재오픈
                </button>
              ) : null}
              {actor.canFinalizeCycle && selectedScope.isAll ? (
                <button
                  type="button"
                  onClick={() => void handleFinalizeCycle()}
                  disabled={locking || !summary.readyToLock}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {locking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  최종 확정 완료
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <EmployeeDrawer
        employee={selectedEmployee}
        actor={actor}
        cycleId={cycle?.id}
        gradeOptions={gradeOptions}
        selectedGradeId={selectedGradeId}
        onSelectedGradeIdChange={(value) => {
          setSelectedGradeId(value)
          setFormError('')

          if (!selectedEmployee) return

          updateRowDraft(selectedEmployee.id, (current) => ({
            ...current,
            gradeId: value,
            error: '',
          }))
        }}
        adjustReason={adjustReason}
        onAdjustReasonChange={(value) => {
          setAdjustReason(value)
          setFormError('')

          if (!selectedEmployee) return

          updateRowDraft(selectedEmployee.id, (current) => ({
            ...current,
            reason: value,
            error: '',
          }))
        }}
        formHelper={formHelper}
        formError={formError}
        reasonRequired={gradeChanged}
        saving={saving}
        onClose={() => setSelectedEmployeeId(null)}
        onSave={() => void handleSave()}
        onClear={() => void handleClear()}
      />
    </div>
  )
}

function EmployeeDrawer(props: {
  employee: CeoFinalEmployeeRow | null
  actor: CeoFinalViewModel['actor'] | null
  cycleId?: string
  gradeOptions: CeoFinalViewModel['gradeOptions']
  selectedGradeId: string
  onSelectedGradeIdChange: (value: string) => void
  adjustReason: string
  onAdjustReasonChange: (value: string) => void
  formHelper: string
  formError: string
  reasonRequired: boolean
  saving: boolean
  onClose: () => void
  onSave: () => void
  onClear: () => void
}) {
  if (!props.employee) return null

  const editable = Boolean(props.actor?.canEdit)
  const briefing = props.employee.detail.briefing

  return (
    <>
      <button
        type="button"
        aria-label="상세 닫기"
        onClick={props.onClose}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px]"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={props.employee.finalized ? 'emerald' : 'amber'}>
                    {props.employee.finalized ? '확정 완료' : '미확정'}
                  </StatusChip>
                  <StatusChip tone={props.employee.isAdjusted ? 'blue' : 'slate'}>
                    {props.employee.isAdjusted ? '조정 발생' : '조정 없음'}
                  </StatusChip>
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950">{props.employee.employeeName}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {props.employee.positionLabel ?? '직위 정보 없음'} · {props.employee.departmentName} ·{' '}
                  {props.employee.divisionName}
                </p>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <SectionCard title="직원 요약" icon={<UserRound className="h-4 w-4" />}>
              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile label="이름" value={props.employee.employeeName} />
                <InfoTile label="직위" value={props.employee.positionLabel ?? '-'} />
                <InfoTile label="소속" value={props.employee.departmentName} />
                <InfoTile label="본부" value={props.employee.divisionName} />
                <InfoTile label="원점수" value={String(props.employee.detail.rawScore)} />
                <InfoTile
                  label="확정 상태"
                  value={props.employee.finalized ? '확정 완료' : '미확정'}
                />
              </div>
              {props.employee.finalizedAt ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {props.employee.finalizedBy ?? '최종 확정자'} · {formatDateTime(props.employee.finalizedAt)} 확정
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="평가 단계 요약" icon={<CheckCircle2 className="h-4 w-4" />}>
              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile label="본부장 평가 등급" value={props.employee.originalDivisionHeadRating} />
                <InfoTile label="조정 여부" value={props.employee.isAdjusted ? '조정 발생' : '조정 없음'} />
                <InfoTile label="조정 사유" value={props.employee.adjustmentReason || '-'} />
              </div>
              <ReadOnlyText label="본부장 코멘트" value={props.employee.detail.evaluationComment} />
              <ReadOnlyText label="이전 단계 의견" value={props.employee.detail.reviewerComment} />
            </SectionCard>

            <SectionCard title="최종 등급 확정" icon={<Clock3 className="h-4 w-4" />}>
              {!editable ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  현재 화면은 읽기 전용입니다. 잠금 해제 후 다시 최종 등급을 수정하거나 확정해 주세요.
                </div>
              ) : null}
              <div className="grid gap-4">
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  본부장 평가 등급 <span className="font-semibold">{props.employee.originalDivisionHeadRating}</span>을
                  기준으로 최종 등급을 선택해 주세요.
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">최종 등급</span>
                  <select
                    value={props.selectedGradeId}
                    onChange={(event) => props.onSelectedGradeIdChange(event.target.value)}
                    disabled={!editable || props.saving}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 disabled:bg-slate-100"
                  >
                    <option value="">등급을 선택해 주세요.</option>
                    {props.gradeOptions.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {grade.grade}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                    조정 사유
                    {props.reasonRequired ? <span className="text-rose-600">*</span> : null}
                  </span>
                  <textarea
                    rows={4}
                    value={props.adjustReason}
                    onChange={(event) => props.onAdjustReasonChange(event.target.value)}
                    disabled={!editable || props.saving}
                    placeholder="등급을 조정한 경우 사유를 입력해 주세요."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 disabled:bg-slate-100"
                  />
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {props.formHelper}
                </div>
                {props.formError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {props.formError}
                  </div>
                ) : null}

                {editable ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={props.onSave}
                      disabled={props.saving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {props.saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      최종 확정
                    </button>
                    <button
                      type="button"
                      onClick={props.onClear}
                      disabled={props.saving}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Undo2 className="h-4 w-4" />
                      원래 등급으로 되돌리기
                    </button>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard title="근거 자료" icon={<CalendarDays className="h-4 w-4" />}>
              <SubSection title="KPI 요약">
                {props.employee.detail.kpiSummary.length ? (
                  <div className="space-y-3">
                    {props.employee.detail.kpiSummary.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="mt-2 text-sm text-slate-600">
                          목표 {item.target ?? '-'} / 실적 {item.actual ?? '-'}
                          {item.unit ? ` ${item.unit}` : ''}
                          {typeof item.achievementRate === 'number'
                            ? ` · 달성률 ${item.achievementRate.toFixed(1)}%`
                            : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty>등록된 KPI 요약이 없습니다.</InlineEmpty>
                )}
              </SubSection>

              <SubSection title="월간 실적 요약">
                {props.employee.detail.monthlySummary.length ? (
                  <div className="space-y-3">
                    {props.employee.detail.monthlySummary.map((item) => (
                      <div key={`${item.month}-${item.comment ?? 'summary'}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="font-medium text-slate-900">{item.month}</div>
                        <div className="mt-2 text-sm text-slate-600">
                          {typeof item.achievementRate === 'number'
                            ? `달성률 ${item.achievementRate.toFixed(1)}%`
                            : '달성률 정보 없음'}
                        </div>
                        {item.comment ? <p className="mt-2 text-sm leading-6 text-slate-700">{item.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty>월간 실적 요약이 없습니다.</InlineEmpty>
                )}
              </SubSection>

              <SubSection title="체크인 / 1:1 요약">
                {props.employee.detail.checkins.length ? (
                  <div className="space-y-3">
                    {props.employee.detail.checkins.map((item) => (
                      <div key={`${item.date}-${item.type}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusChip tone="slate">{item.type}</StatusChip>
                          <span className="text-sm font-medium text-slate-900">{formatDateTime(item.date)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty>최근 체크인 요약이 없습니다.</InlineEmpty>
                )}
              </SubSection>

              <SubSection title="최근 3년 이력">
                {props.employee.detail.threeYearHistory.length ? (
                  <div className="space-y-3">
                    {props.employee.detail.threeYearHistory.map((item) => (
                      <div key={`${item.year}-${item.cycleName}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="font-medium text-slate-900">
                          {item.year}년 {item.cycleName}
                        </div>
                        <div className="mt-2">
                          등급 {item.grade}
                          {typeof item.score === 'number' ? ` · 점수 ${item.score.toFixed(1)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineEmpty>최근 3년 평가 이력이 없습니다.</InlineEmpty>
                )}
              </SubSection>
            </SectionCard>

            <SectionCard title="AI 성과 브리핑" icon={<Brain className="h-4 w-4" />}>
              {briefing ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <StatusChip tone={briefing.alignmentTone === 'success' ? 'emerald' : briefing.alignmentTone === 'warn' ? 'amber' : briefing.alignmentTone === 'error' ? 'rose' : 'slate'}>
                      {briefing.alignmentLabel}
                    </StatusChip>
                    <StatusChip tone="slate">{briefing.evidenceLevelLabel}</StatusChip>
                    <StatusChip tone="blue">{briefing.sourceLabel}</StatusChip>
                    {briefing.stale ? <StatusChip tone="amber">검토 필요</StatusChip> : null}
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                      <Sparkles className="h-4 w-4" />
                      브리핑 요약
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-800">{briefing.headline}</p>
                    <div className="mt-3 text-xs text-slate-500">
                      생성 시각 {formatDateTime(briefing.generatedAt)}
                    </div>
                  </div>
                </div>
              ) : (
                <InlineEmpty>저장된 AI 성과 브리핑이 없습니다. 아래 상세 화면에서 근거를 직접 확인해 주세요.</InlineEmpty>
              )}
              {props.employee.detail.performanceDetailHref ? (
                <div className="mt-4">
                  <Link
                    href={props.employee.detail.performanceDetailHref}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    성과평가 상세 보기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </SectionCard>

          </div>
        </div>
      </aside>
    </>
  )
}

function FilterCard(props: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{props.label}</div>
      {props.children}
    </div>
  )
}

function SectionCard(props: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-sky-600">{props.icon}</span>
        {props.title}
      </div>
      <div className="space-y-4">{props.children}</div>
    </section>
  )
}

function SubSection(props: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">{props.title}</div>
      {props.children}
    </div>
  )
}

function Banner(props: { tone: 'success' | 'error' | 'info'; children: ReactNode }) {
  const className =
    props.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : props.tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-sky-200 bg-sky-50 text-sky-800'

  return <div className={`rounded-3xl border px-4 py-3 text-sm ${className}`}>{props.children}</div>
}

function SummaryCard(props: { label: string; value: string; tone?: 'slate' | 'amber' | 'emerald' }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{props.label}</div>
      <div
        className={cls(
          'mt-3 text-3xl font-semibold',
          props.tone === 'amber'
            ? 'text-amber-700'
            : props.tone === 'emerald'
              ? 'text-emerald-700'
              : 'text-slate-950'
        )}
      >
        {props.value}
      </div>
    </div>
  )
}

function ToggleButton(props: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cls(
        'inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition',
        props.checked
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      {props.label}
    </button>
  )
}

function StatusChip(props: {
  tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose'
  children: ReactNode
}) {
  const className =
    props.tone === 'blue'
      ? 'bg-sky-100 text-sky-700'
      : props.tone === 'amber'
        ? 'bg-amber-100 text-amber-800'
        : props.tone === 'emerald'
          ? 'bg-emerald-100 text-emerald-700'
          : props.tone === 'rose'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{props.children}</span>
}

function RowMetric(props: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</span>
      <span className={cls('mt-2 text-sm font-semibold', props.accent ? 'text-sky-700' : 'text-slate-900')}>
        {props.value}
      </span>
    </div>
  )
}

function RowBadgeCell(props: { label: string; badge: ReactNode }) {
  return (
    <div className="flex flex-col justify-center rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</span>
      <div className="mt-2">{props.badge}</div>
    </div>
  )
}

function InfoTile(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function ReadOnlyText(props: { label: string; value?: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-900">{props.label}</div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
        {props.value?.trim() || '-'}
      </div>
    </div>
  )
}

function EmptyState(props: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{props.description}</p>
    </div>
  )
}

function InlineEmpty(props: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      {props.children}
    </div>
  )
}
