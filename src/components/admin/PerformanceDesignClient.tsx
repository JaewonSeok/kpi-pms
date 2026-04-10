'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AlertTriangle, ArrowRight, RefreshCcw, Save, Sparkles } from 'lucide-react'
import type {
  CollaborationCase,
  NonQuantitativeTemplateBinding,
  NonQuantitativeTemplate,
  NonQuantitativeTemplateSection,
  PerformanceDesignConfig,
  PerformanceEvaluationGroup,
  PerformanceIndicatorDesign,
  PerformanceMilestone,
  PerformanceSelectionMatrixConfig,
} from '@/lib/performance-design'
import {
  INDICATOR_SELECTION_LABELS,
  PERFORMANCE_MILESTONE_LABELS,
  buildNonQuantitativePageRangeLabel,
  calculateIndicatorMatrixScore,
  createDefaultPerformanceDesignConfig,
  getDefaultTemplateBindingForGroup,
  getDefaultSelectionMatrix,
  normalizeTemplateBindings,
  recommendIndicatorStatus,
  resolveNonQuantitativeTemplateBinding,
} from '@/lib/performance-design'
import type { PerformanceDesignPageData } from '@/server/admin/performance-design'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function toEditableConfig(data: PerformanceDesignPageData): PerformanceDesignConfig {
  const defaults = createDefaultPerformanceDesignConfig()
  return deepClone({
    evaluationGroups: data.evaluationGroups.length ? data.evaluationGroups : defaults.evaluationGroups,
    indicatorDesigns: data.indicators.map<PerformanceIndicatorDesign>((indicator) => ({
      key: indicator.key,
      source: indicator.source,
      sourceId: indicator.sourceId,
      name: indicator.name,
      metricType: indicator.metricType,
      departmentId: indicator.departmentId,
      departmentName: indicator.departmentName,
      ownerLabel: indicator.ownerLabel,
      evaluationGroupId: indicator.evaluationGroupId,
      strategicAlignmentScore: indicator.strategicAlignmentScore,
      jobRepresentativenessScore: indicator.jobRepresentativenessScore,
      smartDiagnosis: indicator.smartDiagnosis,
      selectionStatus: indicator.selectionStatus,
      lifecycleAction: indicator.lifecycleAction,
      departmentComment: indicator.departmentComment,
      managerComment: indicator.managerComment,
      evidenceTemplate: indicator.evidenceTemplate,
      pageLimit: indicator.pageLimit,
      rolloverHistory: indicator.rolloverHistory,
      carriedFromCycleId: indicator.carriedFromCycleId,
    })),
    selectionMatrix: data.selectionMatrix ?? defaults.selectionMatrix,
    nonQuantitativeTemplate: data.nonQuantitativeTemplate,
    nonQuantitativeTemplateBindings:
      data.nonQuantitativeTemplateBindings?.length
        ? normalizeTemplateBindings(
            data.evaluationGroups.length ? data.evaluationGroups : defaults.evaluationGroups,
            data.nonQuantitativeTemplateBindings
          )
        : defaults.nonQuantitativeTemplateBindings,
    milestones: data.milestones,
    collaborationCases: data.collaborationCases,
    environmentAdjustment: data.environmentAdjustment,
  })
}

function buildContextKey(data: PerformanceDesignPageData) {
  return `${data.selectedCycleId ?? 'empty'}:${data.summary.indicatorCount}:${data.summary.groupCount}:${data.summary.collaborationCaseCount}`
}

function normalizeDraftConfig(config: PerformanceDesignConfig): PerformanceDesignConfig {
  return {
    ...config,
    selectionMatrix: config.selectionMatrix ?? getDefaultSelectionMatrix(),
    nonQuantitativeTemplateBindings: normalizeTemplateBindings(
      config.evaluationGroups,
      config.nonQuantitativeTemplateBindings
    ),
  }
}

function formatDateTimeInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

function parseMultilineInput(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinMultilineInput(items: string[]) {
  return items.join('\n')
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message
  }

  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }

  return fallback
}

function sortIndicators(
  left: PerformanceIndicatorDesign,
  right: PerformanceIndicatorDesign,
  matrixConfig: PerformanceSelectionMatrixConfig
) {
  const leftScore = calculateIndicatorMatrixScore({
    strategicAlignmentScore: left.strategicAlignmentScore,
    jobRepresentativenessScore: left.jobRepresentativenessScore,
    smartTotal: left.smartDiagnosis?.total ?? 0,
    matrixConfig,
  })
  const rightScore = calculateIndicatorMatrixScore({
    strategicAlignmentScore: right.strategicAlignmentScore,
    jobRepresentativenessScore: right.jobRepresentativenessScore,
    smartTotal: right.smartDiagnosis?.total ?? 0,
    matrixConfig,
  })
  if (leftScore !== rightScore) return rightScore - leftScore
  return left.name.localeCompare(right.name, 'ko')
}

function updateById<T extends { id: string }>(items: T[], id: string, updater: (item: T) => T) {
  return items.map((item) => (item.id === id ? updater(item) : item))
}

function buildIndicatorInsight(
  indicator: PerformanceIndicatorDesign,
  matrixConfig: PerformanceSelectionMatrixConfig,
  bindings: NonQuantitativeTemplateBinding[]
) {
  const matrixScore = calculateIndicatorMatrixScore({
    strategicAlignmentScore: indicator.strategicAlignmentScore,
    jobRepresentativenessScore: indicator.jobRepresentativenessScore,
    smartTotal: indicator.smartDiagnosis?.total ?? 0,
    matrixConfig,
  })
  const autoRecommendation = recommendIndicatorStatus({
    smartTotal: indicator.smartDiagnosis?.total ?? 0,
    strategicAlignmentScore: indicator.strategicAlignmentScore,
    jobRepresentativenessScore: indicator.jobRepresentativenessScore,
    metricType: indicator.metricType,
    matrixConfig,
  })
  const templateBinding = resolveNonQuantitativeTemplateBinding(bindings, indicator.evaluationGroupId)
  return {
    matrixScore,
    autoRecommendation,
    nonQuantTemplateRange:
      indicator.metricType === 'QUANTITATIVE' ? '' : buildNonQuantitativePageRangeLabel(templateBinding),
  }
}

function getIndicatorSourceLabel(source: PerformanceIndicatorDesign['source']) {
  if (source === 'ORG_KPI') return '조직 KPI'
  if (source === 'PERSONAL_KPI') return '개인 KPI'
  return '수동 등록'
}

export function PerformanceDesignClient({ data }: { data: PerformanceDesignPageData }) {
  const router = useRouter()
  const [isSaving, startSaveTransition] = useTransition()
  const [isRollingOver, startRolloverTransition] = useTransition()
  const [draft, setDraft] = useState<PerformanceDesignConfig>(() => normalizeDraftConfig(toEditableConfig(data)))
  const [message, setMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRolloverKeys, setSelectedRolloverKeys] = useState<string[]>([])
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const contextKey = buildContextKey(data)
  const previousContextKey = useRef(contextKey)

  useEffect(() => {
    if (previousContextKey.current === contextKey) return
    previousContextKey.current = contextKey
    setDraft(normalizeDraftConfig(toEditableConfig(data)))
    setSearchTerm('')
    setDepartmentFilter('ALL')
    setSelectedRolloverKeys([])
    setMessage('')
  }, [contextKey, data])

  const hasCycle = Boolean(data.selectedCycleId)
  const filteredIndicators = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return draft.indicatorDesigns
      .filter((indicator) => (departmentFilter === 'ALL' ? true : indicator.departmentId === departmentFilter))
      .filter((indicator) => {
        if (!keyword) return true
        return (
          indicator.name.toLowerCase().includes(keyword) ||
          indicator.departmentName?.toLowerCase().includes(keyword) ||
          indicator.ownerLabel?.toLowerCase().includes(keyword)
        )
      })
      .sort((left, right) => sortIndicators(left, right, draft.selectionMatrix))
  }, [departmentFilter, draft.indicatorDesigns, draft.selectionMatrix, searchTerm])

  const rolloverCandidates = useMemo(
    () =>
      draft.indicatorDesigns
        .filter((indicator) => indicator.lifecycleAction !== 'KEEP' || indicator.selectionStatus !== 'KEEP')
        .sort((left, right) => sortIndicators(left, right, draft.selectionMatrix)),
    [draft.indicatorDesigns, draft.selectionMatrix]
  )

  function updateConfig(updater: (current: PerformanceDesignConfig) => PerformanceDesignConfig) {
    setDraft((current) => normalizeDraftConfig(updater(deepClone(current))))
  }

  function updateEvaluationGroup(
    groupId: string,
    updater: (group: PerformanceEvaluationGroup) => PerformanceEvaluationGroup
  ) {
    updateConfig((current) => ({
      ...current,
      evaluationGroups: updateById(current.evaluationGroups, groupId, updater),
    }))
  }

  function updateSelectionMatrix(key: keyof PerformanceSelectionMatrixConfig, value: number) {
    updateConfig((current) => ({
      ...current,
      selectionMatrix: {
        ...current.selectionMatrix,
        [key]: value,
      },
    }))
  }

  function updateTemplateBinding(
    evaluationGroupId: string,
    updater: (binding: NonQuantitativeTemplateBinding) => NonQuantitativeTemplateBinding
  ) {
    updateConfig((current) => {
      const existing =
        current.nonQuantitativeTemplateBindings.find((binding) => binding.evaluationGroupId === evaluationGroupId) ??
        getDefaultTemplateBindingForGroup(evaluationGroupId)
      const nextBindings = current.nonQuantitativeTemplateBindings.some(
        (binding) => binding.evaluationGroupId === evaluationGroupId
      )
        ? current.nonQuantitativeTemplateBindings.map((binding) =>
            binding.evaluationGroupId === evaluationGroupId ? updater(binding) : binding
          )
        : [...current.nonQuantitativeTemplateBindings, updater(existing)]
      return {
        ...current,
        nonQuantitativeTemplateBindings: nextBindings,
      }
    })
  }

  function addEvaluationGroup() {
    const newGroupId = `group-${Date.now()}`
    updateConfig((current) => ({
      ...current,
      evaluationGroups: [
        ...current.evaluationGroups,
        {
          id: newGroupId,
          name: '\uC2E0\uADDC \uD3C9\uAC00\uAD70',
          description: '',
          quantitativeWeight: 50,
          qualitativeWeight: 50,
          comparisonMode: 'WITHIN_GROUP',
          comparisonTargetLabel: '\uB3D9\uC77C \uD3C9\uAC00\uAD70 \uB0B4 \uBE44\uAD50',
          departmentIds: [],
        },
      ],
      nonQuantitativeTemplateBindings: [
        ...current.nonQuantitativeTemplateBindings,
        getDefaultTemplateBindingForGroup(newGroupId),
      ],
    }))
  }

  function removeEvaluationGroup(groupId: string) {
    updateConfig((current) => ({
      ...current,
      evaluationGroups: current.evaluationGroups.filter((group) => group.id !== groupId),
      nonQuantitativeTemplateBindings: current.nonQuantitativeTemplateBindings.filter(
        (binding) => binding.evaluationGroupId !== groupId
      ),
      indicatorDesigns: current.indicatorDesigns.map((indicator) => ({
        ...indicator,
        evaluationGroupId: indicator.evaluationGroupId === groupId ? undefined : indicator.evaluationGroupId,
      })),
    }))
  }

  function toggleDepartment(groupId: string, departmentId: string) {
    updateEvaluationGroup(groupId, (group) => ({
      ...group,
      departmentIds: group.departmentIds.includes(departmentId)
        ? group.departmentIds.filter((item) => item !== departmentId)
        : [...group.departmentIds, departmentId],
    }))
  }

  function updateIndicator(
    indicatorKey: string,
    updater: (indicator: PerformanceIndicatorDesign) => PerformanceIndicatorDesign
  ) {
    updateConfig((current) => ({
      ...current,
      indicatorDesigns: current.indicatorDesigns.map((indicator) =>
        indicator.key === indicatorKey ? updater(indicator) : indicator
      ),
    }))
  }

  function addManualIndicator() {
    updateConfig((current) => ({
      ...current,
      indicatorDesigns: [
        {
          key: `MANUAL:indicator-${Date.now()}`,
          source: 'MANUAL',
          name: '신규 지표 후보',
          metricType: 'QUANTITATIVE',
          strategicAlignmentScore: 3,
          jobRepresentativenessScore: 3,
          selectionStatus: 'NEW',
          lifecycleAction: 'NEW',
          departmentComment: '',
          managerComment: '',
          evidenceTemplate: '지표 정의, 제출 근거, 운영 리스크, 개선 방안',
          pageLimit: draft.nonQuantitativeTemplate.pageLimit,
          rolloverHistory: [],
        },
        ...current.indicatorDesigns,
      ],
    }))
  }

  function removeManualIndicator(indicatorKey: string) {
    updateConfig((current) => ({
      ...current,
      indicatorDesigns: current.indicatorDesigns.filter((indicator) => indicator.key !== indicatorKey),
    }))
  }

  function updateTemplate(updater: (template: NonQuantitativeTemplate) => NonQuantitativeTemplate) {
    updateConfig((current) => ({
      ...current,
      nonQuantitativeTemplate: updater(current.nonQuantitativeTemplate),
    }))
  }

  function updateTemplateSection(
    sectionId: string,
    updater: (section: NonQuantitativeTemplateSection) => NonQuantitativeTemplateSection
  ) {
    updateTemplate((template) => ({
      ...template,
      sections: updateById(template.sections, sectionId, updater),
    }))
  }

  function addTemplateSection() {
    updateTemplate((template) => ({
      ...template,
      sections: [
        ...template.sections,
        {
          id: `section-${Date.now()}`,
          title: '신규 평가 항목',
          focusPoint: '',
          checklist: [''],
        },
      ],
    }))
  }

  function removeTemplateSection(sectionId: string) {
    updateTemplate((template) => ({
      ...template,
      sections: template.sections.filter((section) => section.id !== sectionId),
    }))
  }

  function updateMilestone(
    milestoneId: string,
    updater: (milestone: PerformanceMilestone) => PerformanceMilestone
  ) {
    updateConfig((current) => ({
      ...current,
      milestones: updateById(current.milestones, milestoneId, updater),
    }))
  }

  function updateCase(caseId: string, updater: (caseItem: CollaborationCase) => CollaborationCase) {
    updateConfig((current) => ({
      ...current,
      collaborationCases: updateById(current.collaborationCases, caseId, updater),
    }))
  }

  function addCollaborationCase() {
    updateConfig((current) => ({
      ...current,
      collaborationCases: [
        ...current.collaborationCases,
        {
          id: `case-${Date.now()}`,
          departmentId: data.departments[0]?.id ?? '',
          departmentName: data.departments[0]?.name,
          title: '협업 BP 사례',
          summary: '',
          impact: '',
          collaborationPartners: [],
          evidenceNotes: '',
          submittedBy: '',
          status: 'DRAFT',
          evaluation: {
            impactScore: 0,
            executionScore: 0,
            collaborationScore: 0,
            spreadScore: 0,
            comment: '',
          },
          highlighted: false,
        },
      ],
    }))
  }

  function removeCollaborationCase(caseId: string) {
    updateConfig((current) => ({
      ...current,
      collaborationCases: current.collaborationCases.filter((caseItem) => caseItem.id !== caseId),
    }))
  }

  async function handleSave() {
    if (!data.selectedCycleId) {
      setMessage('성과 설계를 저장하려면 먼저 평가 주기를 생성해 주세요.')
      return
    }

    setMessage('')
    startSaveTransition(async () => {
      try {
        const payload: PerformanceDesignConfig = deepClone({
          ...normalizeDraftConfig(draft),
          milestones: draft.milestones.map((milestone) => ({
            ...milestone,
            startAt: milestone.startAt ? toIsoDateTime(milestone.startAt) : undefined,
            endAt: milestone.endAt ? toIsoDateTime(milestone.endAt) : undefined,
          })),
        })
        const response = await fetch(
          `/api/admin/performance-design/${encodeURIComponent(data.selectedCycleId ?? '')}`,
          {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: payload }),
          }
        )
        const json = (await response.json()) as unknown
        if (!response.ok) {
          throw new Error(extractErrorMessage(json, '성과 설계 저장에 실패했습니다.'))
        }
        setMessage('성과 설계가 저장되었습니다.')
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '성과 설계 저장에 실패했습니다.')
      }
    })
  }

  async function handleRollover() {
    if (!data.selectedCycleId || !selectedRolloverKeys.length) {
      setMessage('이월할 지표를 먼저 선택해 주세요.')
      return
    }

    setMessage('')
    startRolloverTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/performance-design/${encodeURIComponent(data.selectedCycleId ?? '')}/rollover`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ indicatorKeys: selectedRolloverKeys }),
          }
        )
        const json = (await response.json()) as unknown
        if (!response.ok) {
          throw new Error(extractErrorMessage(json, '지표 이월 반영에 실패했습니다.'))
        }
        setMessage('선택한 지표를 다음 연도 설계로 이월했습니다.')
        setSelectedRolloverKeys([])
        router.refresh()
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '지표 이월 반영에 실패했습니다.')
      }
    })
  }

  function pushCycle(cycleId: string) {
    const params = new URLSearchParams()
    if (cycleId) params.set('cycleId', cycleId)
    router.push(`/admin/performance-design?${params.toString()}`)
  }

  if (data.state === 'permission-denied' || data.state === 'error') {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-xl font-semibold text-slate-900">
          {data.state === 'permission-denied'
            ? '성과 설계 화면에 접근할 수 없습니다.'
            : '성과 설계 화면을 불러오지 못했습니다.'}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">{data.message}</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Performance Design</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">성과 설계</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              평가군, KPI Pool, SMART 진단, 비계량 지표, 협업 BP 사례, 건강도 이상 징후를 설계합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={data.selectedCycleId ?? ''}
              onChange={(event) => pushCycle(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700"
            >
              {data.cycleOptions.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasCycle || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save className="h-4 w-4" />
              {isSaving ? '저장 중...' : '설계 저장'}
            </button>
            <button
              type="button"
              onClick={handleRollover}
              disabled={!hasCycle || !selectedRolloverKeys.length || isRollingOver}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <ArrowRight className="h-4 w-4" />
              {isRollingOver ? '이월 중...' : '다음 연도 이월'}
            </button>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              새로고침
            </button>
          </div>
        </div>
        {message ? (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>
        ) : null}

        {!hasCycle ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-900">평가 주기가 없습니다.</h2>
            <p className="mt-2 text-sm text-slate-600">
              성과 설계를 적용하려면 먼저 평가 주기를 생성해야 합니다. 평가 주기를 만든 뒤 KPI Pool과 평가군
              설정을 이어서 진행해 주세요.
            </p>
            <Link
              href="/admin/eval-cycle"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
            >
              평가 주기 관리로 이동
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <MetricCard label="평가군" value={`${data.summary.groupCount}개`} />
            <MetricCard label="KPI Pool" value={`${data.summary.indicatorCount}개`} />
            <MetricCard label="비계량 지표" value={`${data.summary.qualitativeIndicatorCount}개`} />
            <MetricCard label="협업 BP 사례" value={`${data.summary.collaborationCaseCount}건`} />
            <MetricCard label="건강도 이상 징후" value={`${data.summary.healthFindingCount}건`} />
          </div>
        )}
      </section>

      {data.alerts.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            일부 설계 데이터를 불러오지 못해 기본값 또는 부분 데이터로 표시하고 있습니다.
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.alerts.map((alert) => (
              <div
                key={alert.title + alert.description}
                className="rounded-2xl border border-amber-200 bg-white/80 p-4"
              >
                <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="평가군 설정" description="비교 기준, 비교 관점, 참여 부서를 함께 설정합니다.">
            <div className="space-y-4">
              {draft.evaluationGroups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-3">
                      <input
                        value={group.name}
                        onChange={(event) =>
                          updateEvaluationGroup(group.id, (current) => ({ ...current, name: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                      />
                      <textarea
                        value={group.description}
                        onChange={(event) =>
                          updateEvaluationGroup(group.id, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEvaluationGroup(group.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <LabelField label="계량 비중">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={group.quantitativeWeight}
                        onChange={(event) =>
                          updateEvaluationGroup(group.id, (current) => ({
                            ...current,
                            quantitativeWeight: Number(event.target.value || 0),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                    <LabelField label="비계량 비중">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={group.qualitativeWeight}
                        onChange={(event) =>
                          updateEvaluationGroup(group.id, (current) => ({
                            ...current,
                            qualitativeWeight: Number(event.target.value || 0),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                    <LabelField label="비교 관점">
                      <select
                        value={group.comparisonMode}
                        onChange={(event) =>
                          updateEvaluationGroup(group.id, (current) => ({
                            ...current,
                            comparisonMode: event.target.value as PerformanceEvaluationGroup['comparisonMode'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        <option value="WITHIN_GROUP">군 내 비교</option>
                        <option value="SEPARATE_TRACK">별도 트랙</option>
                        <option value="CROSS_GROUP">군 간 비교</option>
                      </select>
                    </LabelField>
                  </div>
                  <LabelField label="비교 기준" className="mt-3">
                    <input
                      value={group.comparisonTargetLabel}
                      onChange={(event) =>
                        updateEvaluationGroup(group.id, (current) => ({
                          ...current,
                          comparisonTargetLabel: event.target.value,
                        }))
                      }
                      placeholder="비교 기준을 선택해 주세요"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">참여 부서</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {data.departments.map((department) => {
                        const selected = group.departmentIds.includes(department.id)
                        return (
                          <button
                            key={department.id}
                            type="button"
                            onClick={() => toggleDepartment(group.id, department.id)}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                              selected
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {department.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addEvaluationGroup}
                className="w-full rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                평가군 추가
              </button>
            </div>
          </Panel>
          <Panel title="지표 이월 프로세스" description="유지 / 유보 / 보완 / 삭제 / 신규 상태 지표를 다음 연도로 넘깁니다.">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">다음 연도 연결</div>
              <p className="mt-1">
                {data.nextCycleId
                  ? '선택한 지표를 다음 연도 평가 주기로 이월할 수 있습니다.'
                  : '다음 연도 평가 주기가 아직 없어 이월을 실행할 수 없습니다.'}
              </p>
              {data.nextCycleId ? (
                <p className="mt-2 text-xs text-slate-500">선택한 지표 {selectedRolloverKeys.length}건</p>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {rolloverCandidates.length ? (
                rolloverCandidates.map((indicator) => {
                  const checked = selectedRolloverKeys.includes(indicator.key)
                  return (
                    <label
                      key={indicator.key}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setSelectedRolloverKeys((current) =>
                            event.target.checked
                              ? [...current, indicator.key]
                              : current.filter((item) => item !== indicator.key)
                          )
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900">{indicator.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {INDICATOR_SELECTION_LABELS[indicator.lifecycleAction]} / {indicator.departmentName ?? '부서 미지정'}
                        </div>
                      </div>
                    </label>
                  )
                })
              ) : (
                <EmptyMini description="유지 외 상태의 지표가 없어 이월 대상이 없습니다." />
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="KPI Pool / SMART 진단 및 우선순위 설계"
            description="전략연계성, 직무대표성, SMART 점수를 기준으로 유지 / 유보 / 보완 / 삭제 지표를 구분합니다."
            actions={
              <button
                type="button"
                onClick={addManualIndicator}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                신규 지표 후보 추가
              </button>
            }
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="지표명, 부서, 담당자로 검색"
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
              />
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
              >
                <option value="ALL">전체 조직</option>
                {data.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{'\uC120\uC815 \uB9E4\uD2B8\uB9AD\uC2A4 \uAC00\uC911\uCE58'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {'\uC804\uB7B5\uC5F0\uACC4\uC131, \uC9C1\uBB34\uB300\uD45C\uC131, SMART \uC9C4\uB2E8 \uC810\uC218\uB97C \uD569\uC0B0\uD574 \uC9C0\uD45C \uC120\uC815 \uC6B0\uC120\uC21C\uC704\uB97C \uACC4\uC0B0\uD569\uB2C8\uB2E4.'}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <LabelField label={'\uC804\uB7B5\uC5F0\uACC4\uC131'}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selectionMatrix.strategicWeight}
                      onChange={(event) => updateSelectionMatrix('strategicWeight', Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                  <LabelField label={'\uC9C1\uBB34\uB300\uD45C\uC131'}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selectionMatrix.jobWeight}
                      onChange={(event) => updateSelectionMatrix('jobWeight', Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                  <LabelField label="SMART">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selectionMatrix.smartWeight}
                      onChange={(event) => updateSelectionMatrix('smartWeight', Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{'\uC790\uB3D9 \uAD8C\uACE0 \uAE30\uC900'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {'\uAC00\uC911 \uD569\uC0B0 \uC810\uC218\uB97C \uAE30\uC900\uC73C\uB85C \uC720\uC9C0, \uC720\uBCF4, \uBCF4\uC644 \uAD8C\uACE0\uB97C \uB9CC\uB4ED\uB2C8\uB2E4.'}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <LabelField label={'\uC720\uC9C0 \uAE30\uC900'}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selectionMatrix.keepThreshold}
                      onChange={(event) => updateSelectionMatrix('keepThreshold', Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                  <LabelField label={'\uC720\uBCF4 \uAE30\uC900'}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selectionMatrix.holdThreshold}
                      onChange={(event) => updateSelectionMatrix('holdThreshold', Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                  <LabelField label={'\uBCF4\uC644 \uAE30\uC900'}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.selectionMatrix.improveThreshold}
                      onChange={(event) => updateSelectionMatrix('improveThreshold', Number(event.target.value || 0))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-left">지표</th>
                    <th className="px-3 py-3 text-left">평가군</th>
                    <th className="px-3 py-3 text-left">SMART 점수</th>
                    <th className="px-3 py-3 text-left">선정</th>
                    <th className="px-3 py-3 text-left">이월</th>
                    <th className="px-3 py-3 text-left">부서 의견 / 관리자 의견</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndicators.length ? (
                    filteredIndicators.map((indicator) => {
                      const smartTotal = indicator.smartDiagnosis?.total ?? 0
                      const insight = buildIndicatorInsight(
                        indicator,
                        draft.selectionMatrix,
                        draft.nonQuantitativeTemplateBindings
                      )
                      return (
                        <tr key={indicator.key} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">{indicator.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {getIndicatorSourceLabel(indicator.source)} / {indicator.ownerLabel ?? '담당자 미지정'} / matrix {indicator.strategicAlignmentScore} x{' '}
                              {indicator.jobRepresentativenessScore}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                                {`Matrix ${insight.matrixScore}`}
                              </span>
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                                {`\uC790\uB3D9 \uAD8C\uACE0 ${INDICATOR_SELECTION_LABELS[insight.autoRecommendation]}`}
                              </span>
                              {insight.nonQuantTemplateRange ? (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                                  {`\uBE44\uACC4\uB7C9 ${insight.nonQuantTemplateRange}`}
                                </span>
                              ) : null}
                            </div>
                            {indicator.source === 'MANUAL' ? (
                              <button
                                type="button"
                                onClick={() => removeManualIndicator(indicator.key)}
                                className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700"
                              >
                                수동 지표 삭제
                              </button>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={indicator.evaluationGroupId ?? ''}
                              onChange={(event) =>
                                updateIndicator(indicator.key, (current) => ({
                                  ...current,
                                  evaluationGroupId: event.target.value || undefined,
                                }))
                              }
                              className="w-44 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                                <option value="">평가군을 선택해 주세요</option>
                              {draft.evaluationGroups.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-slate-900">{smartTotal}점</div>
                            <div className="mt-1 text-xs text-slate-500">{indicator.smartDiagnosis?.note ?? 'SMART 정보 없음'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={indicator.selectionStatus}
                              onChange={(event) =>
                                updateIndicator(indicator.key, (current) => ({
                                  ...current,
                                  selectionStatus: event.target.value as PerformanceIndicatorDesign['selectionStatus'],
                                }))
                              }
                              className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                              {Object.entries(INDICATOR_SELECTION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={indicator.lifecycleAction}
                              onChange={(event) =>
                                updateIndicator(indicator.key, (current) => ({
                                  ...current,
                                  lifecycleAction: event.target.value as PerformanceIndicatorDesign['lifecycleAction'],
                                }))
                              }
                              className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                              {Object.entries(INDICATOR_SELECTION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-2 min-w-64">
                              <textarea
                                value={indicator.departmentComment}
                                onChange={(event) =>
                                  updateIndicator(indicator.key, (current) => ({
                                    ...current,
                                    departmentComment: event.target.value,
                                  }))
                                }
                                rows={2}
                                placeholder="부서 의견"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                              <textarea
                                value={indicator.managerComment}
                                onChange={(event) =>
                                  updateIndicator(indicator.key, (current) => ({
                                    ...current,
                                    managerComment: event.target.value,
                                  }))
                                }
                                rows={3}
                                placeholder="관리자 의견"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              />
                              {indicator.rolloverHistory.length ? (
                                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                  {indicator.rolloverHistory.map((history) => (
                                    <div key={history.id}>
                                      {`${history.decidedAt.slice(0, 10)} · ${INDICATOR_SELECTION_LABELS[history.action]} · ${history.decidedBy}`}
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-10">
                        <EmptyMini description="조건에 맞는 KPI Pool 항목이 없습니다." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="비계량 평가 표준화"
            description="PDCA 기반 평가 항목, 체크리스트, 실적보고서 양식과 작성 지침을 통합합니다."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <LabelField label="템플릿 이름">
                <input
                  value={draft.nonQuantitativeTemplate.name}
                  onChange={(event) => updateTemplate((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              </LabelField>
              <LabelField label="페이지 제한">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={draft.nonQuantitativeTemplate.pageLimit}
                  onChange={(event) =>
                    updateTemplate((current) => ({ ...current, pageLimit: Number(event.target.value || 1) }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm"
                />
              </LabelField>
            </div>
            <LabelField label="작성 지침" className="mt-4">
              <textarea
                value={draft.nonQuantitativeTemplate.guidance}
                onChange={(event) => updateTemplate((current) => ({ ...current, guidance: event.target.value }))}
                rows={3}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </LabelField>
            <LabelField label="실적보고서 형식" className="mt-4">
              <textarea
                value={draft.nonQuantitativeTemplate.reportFormat}
                onChange={(event) => updateTemplate((current) => ({ ...current, reportFormat: event.target.value }))}
                rows={2}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </LabelField>
            <LabelField label="증빙 가이드" className="mt-4">
              <textarea
                value={joinMultilineInput(draft.nonQuantitativeTemplate.evidenceGuide)}
                onChange={(event) =>
                  updateTemplate((current) => ({ ...current, evidenceGuide: parseMultilineInput(event.target.value) }))
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </LabelField>
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.nonQuantitativeTemplate.allowInternalEvidence}
                onChange={(event) =>
                  updateTemplate((current) => ({ ...current, allowInternalEvidence: event.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              내부 문서와 방침 문서도 증빙으로 사용
            </label>
            <div className="mt-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{'\uD3C9\uAC00\uAD70\uBCC4 \uD15C\uD50C\uB9BF \uBC14\uC778\uB529'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {'\uAC01 \uD3C9\uAC00\uAD70\uC5D0 \uB9DE\uB294 \uBE44\uACC4\uB7C9 \uC2E4\uC801\uBCF4\uACE0\uC11C \uBD84\uB7C9\uACFC \uC791\uC131 \uC9C0\uCE68\uC744 \uB2EC\uB9AC \uC6B4\uC601\uD569\uB2C8\uB2E4.'}
                </p>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {draft.evaluationGroups.map((group) => {
                  const binding =
                    draft.nonQuantitativeTemplateBindings.find(
                      (item) => item.evaluationGroupId === group.id
                    ) ?? getDefaultTemplateBindingForGroup(group.id)
                  return (
                    <div key={group.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-slate-900">{group.name}</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <LabelField label={'\uCD5C\uC18C \uD398\uC774\uC9C0'}>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={binding.pageMin}
                            onChange={(event) =>
                              updateTemplateBinding(group.id, (current) => ({
                                ...current,
                                pageMin: Number(event.target.value || 1),
                              }))
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          />
                        </LabelField>
                        <LabelField label={'\uCD5C\uB300 \uD398\uC774\uC9C0'}>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={binding.pageMax}
                            onChange={(event) =>
                              updateTemplateBinding(group.id, (current) => ({
                                ...current,
                                pageMax: Number(event.target.value || 1),
                              }))
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          />
                        </LabelField>
                      </div>
                      <LabelField label={'\uC791\uC131 \uC9C0\uCE68 \uC624\uBC84\uB77C\uC774\uB4DC'} className="mt-3">
                        <textarea
                          value={binding.guidanceOverride}
                          onChange={(event) =>
                            updateTemplateBinding(group.id, (current) => ({
                              ...current,
                              guidanceOverride: event.target.value,
                            }))
                          }
                          rows={3}
                          placeholder="메모를 입력해 주세요"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                      <LabelField label={'\uBCF4\uACE0\uC11C \uC591\uC2DD \uC624\uBC84\uB77C\uC774\uB4DC'} className="mt-3">
                        <textarea
                          value={binding.reportFormatOverride}
                          onChange={(event) =>
                            updateTemplateBinding(group.id, (current) => ({
                              ...current,
                              reportFormatOverride: event.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="메모를 입력해 주세요"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                      <LabelField label={'Evidence \uC624\uBC84\uB77C\uC774\uB4DC'} className="mt-3">
                        <textarea
                          value={joinMultilineInput(binding.evidenceGuideOverride)}
                          onChange={(event) =>
                            updateTemplateBinding(group.id, (current) => ({
                              ...current,
                              evidenceGuideOverride: parseMultilineInput(event.target.value),
                            }))
                          }
                          rows={3}
                          placeholder="메모를 입력해 주세요"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {draft.nonQuantitativeTemplate.sections.map((section) => (
                <div key={section.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid flex-1 gap-3 md:grid-cols-2">
                  <LabelField label="평가 항목">
                        <input
                          value={section.title}
                          onChange={(event) =>
                            updateTemplateSection(section.id, (current) => ({ ...current, title: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                      <LabelField label="초점 사항">
                        <input
                          value={section.focusPoint}
                          onChange={(event) =>
                            updateTemplateSection(section.id, (current) => ({
                              ...current,
                              focusPoint: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTemplateSection(section.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      삭제
                    </button>
                  </div>
                  <LabelField label="체크리스트" className="mt-3">
                    <textarea
                      value={joinMultilineInput(section.checklist)}
                      onChange={(event) =>
                        updateTemplateSection(section.id, (current) => ({
                          ...current,
                          checklist: parseMultilineInput(event.target.value),
                        }))
                      }
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                    />
                  </LabelField>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTemplateSection}
              className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              비계량 평가 항목 추가
            </button>
          </Panel>

          <Panel title="운영 일정 로드맵" description="편람 확정, 목표 확정, 중간점검, 결과 확정 일정을 별도 일정으로 관리합니다.">
            <div className="space-y-4">
              {draft.milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <LabelField label="일정명">
                      <input
                        value={milestone.label}
                        onChange={(event) =>
                          updateMilestone(milestone.id, (current) => ({ ...current, label: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                    <LabelField label="분류">
                      <select
                        value={milestone.key}
                        onChange={(event) =>
                          updateMilestone(milestone.id, (current) => ({
                            ...current,
                            key: event.target.value as PerformanceMilestone['key'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      >
                        {Object.entries(PERFORMANCE_MILESTONE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </LabelField>
                    <LabelField label="시작일">
                      <input
                        type="datetime-local"
                        value={formatDateTimeInput(milestone.startAt)}
                        onChange={(event) =>
                          updateMilestone(milestone.id, (current) => ({ ...current, startAt: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                    <LabelField label="종료일">
                      <input
                        type="datetime-local"
                        value={formatDateTimeInput(milestone.endAt)}
                        onChange={(event) =>
                          updateMilestone(milestone.id, (current) => ({ ...current, endAt: event.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                  </div>
                  <LabelField label="설명" className="mt-3">
                      <textarea
                        value={milestone.description}
                        onChange={(event) =>
                          updateMilestone(milestone.id, (current) => ({ ...current, description: event.target.value }))
                        }
                        rows={2}
                        placeholder="메모를 입력해 주세요"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                  </LabelField>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="협업 BP 사례 평가" description="부서간 우수 협업사례를 제출하고 평가위원 정성평가를 기록합니다.">
            <div className="space-y-4">
              {draft.collaborationCases.length ? (
                draft.collaborationCases.map((caseItem) => (
                  <div key={caseItem.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid flex-1 gap-3 md:grid-cols-2">
                        <LabelField label="부서">
                          <select
                            value={caseItem.departmentId}
                            onChange={(event) =>
                              updateCase(caseItem.id, (current) => ({
                                ...current,
                                departmentId: event.target.value,
                                departmentName:
                                  data.departments.find((department) => department.id === event.target.value)?.name ??
                                  current.departmentName,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          >
                            {data.departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                        </LabelField>
                        <LabelField label="상태">
                          <select
                            value={caseItem.status}
                            onChange={(event) =>
                              updateCase(caseItem.id, (current) => ({
                                ...current,
                                status: event.target.value as CollaborationCase['status'],
                              }))
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          >
                            <option value="DRAFT">초안</option>
                            <option value="SUBMITTED">제출</option>
                            <option value="REVIEWED">평가 완료</option>
                            <option value="SHARED">공유 완료</option>
                          </select>
                        </LabelField>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCollaborationCase(caseItem.id)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <LabelField label="사례명">
                        <input
                          value={caseItem.title}
                          onChange={(event) => updateCase(caseItem.id, (current) => ({ ...current, title: event.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                      <LabelField label="제출자">
                        <input
                          value={caseItem.submittedBy}
                          onChange={(event) =>
                            updateCase(caseItem.id, (current) => ({ ...current, submittedBy: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                    </div>
                    <LabelField label="협업 파트너" className="mt-3">
                      <textarea
                        value={joinMultilineInput(caseItem.collaborationPartners)}
                        onChange={(event) =>
                          updateCase(caseItem.id, (current) => ({
                            ...current,
                            collaborationPartners: parseMultilineInput(event.target.value),
                          }))
                        }
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <LabelField label="사례 요약">
                        <textarea
                          value={caseItem.summary}
                          onChange={(event) => updateCase(caseItem.id, (current) => ({ ...current, summary: event.target.value }))}
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                      <LabelField label="성과 영향">
                        <textarea
                          value={caseItem.impact}
                          onChange={(event) => updateCase(caseItem.id, (current) => ({ ...current, impact: event.target.value }))}
                          rows={3}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                        />
                      </LabelField>
                    </div>
                    <LabelField label="근거 / 공유 사유" className="mt-3">
                      <textarea
                        value={caseItem.evidenceNotes}
                        onChange={(event) =>
                          updateCase(caseItem.id, (current) => ({ ...current, evidenceNotes: event.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      <ScoreField
                        label="영향도"
                        value={caseItem.evaluation.impactScore}
                        onChange={(value) =>
                          updateCase(caseItem.id, (current) => ({
                            ...current,
                            evaluation: { ...current.evaluation, impactScore: value },
                          }))
                        }
                      />
                      <ScoreField
                        label="실행력"
                        value={caseItem.evaluation.executionScore}
                        onChange={(value) =>
                          updateCase(caseItem.id, (current) => ({
                            ...current,
                            evaluation: { ...current.evaluation, executionScore: value },
                          }))
                        }
                      />
                      <ScoreField
                        label="협업도"
                        value={caseItem.evaluation.collaborationScore}
                        onChange={(value) =>
                          updateCase(caseItem.id, (current) => ({
                            ...current,
                            evaluation: { ...current.evaluation, collaborationScore: value },
                          }))
                        }
                      />
                      <ScoreField
                        label="확산도"
                        value={caseItem.evaluation.spreadScore}
                        onChange={(value) =>
                          updateCase(caseItem.id, (current) => ({
                            ...current,
                            evaluation: { ...current.evaluation, spreadScore: value },
                          }))
                        }
                      />
                      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={caseItem.highlighted}
                          onChange={(event) =>
                            updateCase(caseItem.id, (current) => ({ ...current, highlighted: event.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        사례 공유
                      </label>
                    </div>
                    <LabelField label="평가위원 코멘트" className="mt-3">
                      <textarea
                        value={caseItem.evaluation.comment}
                        onChange={(event) =>
                          updateCase(caseItem.id, (current) => ({
                            ...current,
                            evaluation: { ...current.evaluation, comment: event.target.value },
                          }))
                        }
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                      />
                    </LabelField>
                  </div>
                ))
              ) : (
                <EmptyMini description="아직 제출된 협업 BP 사례가 없습니다." />
              )}
            </div>
            <button
              type="button"
              onClick={addCollaborationCase}
              className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              협업 사례 추가
            </button>
          </Panel>
          <Panel title="지표 건강도 대시보드" description="평균 점수 과다, 만점률 과다, 분산 부족, 중복 반영 위험을 자동 탐지합니다.">
            {data.healthFindings.length ? (
              <div className="space-y-3">
                {data.healthFindings.map((finding) => (
                  <div key={finding.key} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{finding.indicatorName}</div>
                        <div className="mt-1 text-xs text-slate-500">{finding.recommendation}</div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          finding.severity === 'high'
                            ? 'bg-rose-50 text-rose-700'
                            : finding.severity === 'medium'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {finding.severity === 'high' ? '높음' : finding.severity === 'medium' ? '중간' : '낮음'}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                      {finding.reasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyMini description="현재 지표 건강도 이상 징후가 없습니다." />
            )}
          </Panel>
          <Panel title="조직 / 환경 보정 모델" description="필요한 조직별 현장 환경 차이를 반영할 수 있도록 기준을 설계합니다.">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.environmentAdjustment.enabled}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    environmentAdjustment: { ...current.environmentAdjustment, enabled: event.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              조직 / 환경 보정 모델 사용
            </label>
            <LabelField label="업무추진 노력도 가이드" className="mt-4">
              <textarea
                value={draft.environmentAdjustment.effortGuide}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    environmentAdjustment: { ...current.environmentAdjustment, effortGuide: event.target.value },
                  }))
                }
                rows={3}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </LabelField>
            <LabelField label="목표치 조정 가이드" className="mt-4">
              <textarea
                value={draft.environmentAdjustment.targetAdjustmentGuide}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    environmentAdjustment: {
                      ...current.environmentAdjustment,
                      targetAdjustmentGuide: event.target.value,
                    },
                  }))
                }
                rows={3}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </LabelField>
            <LabelField label="대체 지표 Pool" className="mt-4">
              <textarea
                value={joinMultilineInput(draft.environmentAdjustment.fallbackIndicators)}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    environmentAdjustment: {
                      ...current.environmentAdjustment,
                      fallbackIndicators: parseMultilineInput(event.target.value),
                    },
                  }))
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </LabelField>
          </Panel>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Quick links</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">운영 연결</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkTile href="/admin/eval-cycle" label="평가 주기" />
            <LinkTile href="/admin/performance-calendar" label="운영 일정" />
            <LinkTile href="/admin/goal-alignment" label="목표 연계" />
          </div>
        </div>
      </section>
    </div>
  )
}

function Panel({
  title,
  description,
  children,
  actions,
}: {
  title: string
  description: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function LabelField({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      {children}
    </label>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

function ScoreField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <LabelField label={label}>
      <input
        type="number"
        min={0}
        max={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      />
    </LabelField>
  )
}

function EmptyMini({ description }: { description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {description}
    </div>
  )
}

function LinkTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <Sparkles className="h-4 w-4 text-blue-500" />
      {label}
    </Link>
  )
}

