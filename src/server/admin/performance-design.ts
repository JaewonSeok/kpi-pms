import type { Prisma, SystemRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildNonQuantitativePageRangeLabel,
  buildIndicatorDesignKey,
  buildIndicatorHealthFindings,
  calculateIndicatorMatrixScore,
  createDefaultPerformanceDesignConfig,
  diagnoseSmartIndicator,
  normalizeTemplateBindings,
  type IndicatorHealthFinding,
  type IndicatorHealthStat,
  type PerformanceDesignConfig,
  type PerformanceEvaluationGroup,
  type PerformanceIndicatorDesign,
  type PerformanceSelectionMatrixConfig,
  parsePerformanceDesignConfig,
  recommendIndicatorStatus,
  resolveNonQuantitativeTemplateBinding,
} from '@/lib/performance-design'

type PerformanceDesignSession = {
  user?: {
    id?: string
    role?: SystemRole | string | null
  } | null
}

export type PerformanceDesignPageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type PerformanceDesignAlert = {
  title: string
  description: string
}

export type PerformanceDesignCycleOption = {
  id: string
  label: string
  year: number
}

export type PerformanceIndicatorView = PerformanceIndicatorDesign & {
  matrixScore: number
  autoRecommendation: PerformanceIndicatorDesign['selectionStatus']
  evaluationGroupName: string
  nonQuantTemplateRange: string
  sourceLabel: string
}

export type PerformanceDesignPageData = {
  state: PerformanceDesignPageState
  message?: string
  selectedCycleId?: string
  selectedCycleName?: string
  selectedYear?: number
  nextCycleId?: string
  cycleOptions: PerformanceDesignCycleOption[]
  evaluationGroups: PerformanceEvaluationGroup[]
  indicators: PerformanceIndicatorView[]
  selectionMatrix: PerformanceSelectionMatrixConfig
  nonQuantitativeTemplate: PerformanceDesignConfig['nonQuantitativeTemplate']
  nonQuantitativeTemplateBindings: PerformanceDesignConfig['nonQuantitativeTemplateBindings']
  milestones: PerformanceDesignConfig['milestones']
  collaborationCases: PerformanceDesignConfig['collaborationCases']
  environmentAdjustment: PerformanceDesignConfig['environmentAdjustment']
  healthFindings: IndicatorHealthFinding[]
  alerts: PerformanceDesignAlert[]
  summary: {
    groupCount: number
    indicatorCount: number
    qualitativeIndicatorCount: number
    collaborationCaseCount: number
    healthFindingCount: number
  }
  departments: Array<{
    id: string
    name: string
  }>
}

type PerformanceDesignParams = {
  cycleId?: string
}

type CycleLite = {
  id: string
  orgId: string
  evalYear: number
  cycleName: string
  performanceDesignConfig: Prisma.JsonValue | null
  organization: {
    name: string
  }
}

type DepartmentLite = {
  id: string
  deptName: string
}

type OrgKpiLite = {
  id: string
  deptId: string
  evalYear: number
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiName: string
  definition: string | null
  formula: string | null
  targetValue: number | null
  unit: string | null
  weight: number
  department: {
    deptName: string
  }
}

type PersonalKpiLite = {
  id: string
  employeeId: string
  evalYear: number
  kpiType: 'QUANTITATIVE' | 'QUALITATIVE'
  kpiName: string
  definition: string | null
  formula: string | null
  targetValue: number | null
  unit: string | null
  weight: number
  linkedOrgKpiId: string | null
  employee: {
    empName: string
    deptId: string
    department: {
      deptName: string
    } | null
  }
}

type EvaluationLite = {
  items: Array<{
    personalKpiId: string
    quantScore: number | null
    qualScore: number | null
    weightedScore: number | null
  }>
}

type PerformanceDesignDeps = {
  loadCycles: () => Promise<CycleLite[]>
  loadDepartments: () => Promise<DepartmentLite[]>
  loadOrgKpis: (year: number) => Promise<OrgKpiLite[]>
  loadPersonalKpis: (year: number) => Promise<PersonalKpiLite[]>
  loadEvaluations: (cycleId: string) => Promise<EvaluationLite[]>
}

function createDeps(): PerformanceDesignDeps {
  return {
    loadCycles: async () =>
      prisma.evalCycle.findMany({
        select: {
          id: true,
          orgId: true,
          evalYear: true,
          cycleName: true,
          performanceDesignConfig: true,
          organization: { select: { name: true } },
        },
        orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
      }) as Promise<CycleLite[]>,
    loadDepartments: async () =>
      prisma.department.findMany({
        select: {
          id: true,
          deptName: true,
        },
        orderBy: { deptName: 'asc' },
      }),
    loadOrgKpis: async (year) =>
      prisma.orgKpi.findMany({
        where: { evalYear: year },
        select: {
          id: true,
          deptId: true,
          evalYear: true,
          kpiType: true,
          kpiName: true,
          definition: true,
          formula: true,
          targetValue: true,
          unit: true,
          weight: true,
          department: { select: { deptName: true } },
        },
      }),
    loadPersonalKpis: async (year) =>
      prisma.personalKpi.findMany({
        where: { evalYear: year },
        select: {
          id: true,
          employeeId: true,
          evalYear: true,
          kpiType: true,
          kpiName: true,
          definition: true,
          formula: true,
          targetValue: true,
          unit: true,
          weight: true,
          linkedOrgKpiId: true,
          employee: {
            select: {
              empName: true,
              deptId: true,
              department: { select: { deptName: true } },
            },
          },
        },
      }),
    loadEvaluations: async (cycleId) =>
      prisma.evaluation.findMany({
        where: { evalCycleId: cycleId },
        select: {
          items: {
            select: {
              personalKpiId: true,
              quantScore: true,
              qualScore: true,
              weightedScore: true,
            },
          },
        },
      }),
  }
}

function isAdmin(session?: PerformanceDesignSession | null) {
  return session?.user?.role === 'ROLE_ADMIN'
}

function loadPerformanceSection<T>(alerts: PerformanceDesignAlert[], title: string, fallback: T, fn: () => Promise<T>) {
  return fn().catch((error) => {
    console.error(`[performance-design] ${title}`, error)
    alerts.push({
      title,
      description: '?쇰? ?ㅺ퀎 ?뺣낫瑜?遺덈윭?ㅼ? 紐삵빐 湲곕낯媛믪쑝濡??쒖떆?⑸땲??',
    })
    return fallback
  })
}

function scoreFromEvaluationItem(item: EvaluationLite['items'][number]) {
  return item.weightedScore ?? item.qualScore ?? item.quantScore ?? null
}

function calculateStddev(values: number[]) {
  if (!values.length) return 0
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function resolveEvaluationGroupId(
  groups: PerformanceEvaluationGroup[],
  deptId: string | undefined,
  metricType: PerformanceIndicatorDesign['metricType']
) {
  const explicit = groups.find((group) => deptId && group.departmentIds.includes(deptId))
  if (explicit) return explicit.id
  if (metricType === 'QUALITATIVE') return groups.find((group) => group.name.includes('援먯쑁') || group.name.includes('?곌뎄'))?.id ?? groups[0]?.id
  if (metricType === 'COLLABORATION') return groups.find((group) => group.name.includes('蹂꾨룄'))?.id ?? groups[0]?.id
  return groups[0]?.id
}

function buildBaseIndicatorFromOrgKpi(
  kpi: OrgKpiLite,
  groups: PerformanceEvaluationGroup[],
  matrixConfig: PerformanceSelectionMatrixConfig,
  overrides?: PerformanceIndicatorDesign
): PerformanceIndicatorDesign {
  const smartDiagnosis =
    overrides?.smartDiagnosis ??
    diagnoseSmartIndicator({
      name: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      weight: kpi.weight,
      hasDeadline: true,
    })
  const strategicAlignmentScore = overrides?.strategicAlignmentScore ?? (kpi.weight >= 30 ? 5 : kpi.weight >= 15 ? 4 : 3)
  const jobRepresentativenessScore = overrides?.jobRepresentativenessScore ?? (kpi.kpiType === 'QUALITATIVE' ? 3 : 4)
  const selectionStatus =
    overrides?.selectionStatus ??
    recommendIndicatorStatus({
      smartTotal: smartDiagnosis.total,
      strategicAlignmentScore,
      jobRepresentativenessScore,
      metricType: kpi.kpiType,
      matrixConfig,
    })

  return {
    key: buildIndicatorDesignKey('ORG_KPI', kpi.id),
    source: 'ORG_KPI',
    sourceId: kpi.id,
    name: overrides?.name ?? kpi.kpiName,
    metricType: overrides?.metricType ?? kpi.kpiType,
    departmentId: kpi.deptId,
    departmentName: kpi.department.deptName,
    ownerLabel: `${kpi.department.deptName} 議곗쭅 KPI`,
    evaluationGroupId: overrides?.evaluationGroupId ?? resolveEvaluationGroupId(groups, kpi.deptId, kpi.kpiType),
    strategicAlignmentScore,
    jobRepresentativenessScore,
    smartDiagnosis,
    selectionStatus,
    lifecycleAction: overrides?.lifecycleAction ?? selectionStatus,
    departmentComment: overrides?.departmentComment ?? '',
    managerComment: overrides?.managerComment ?? '',
    evidenceTemplate: overrides?.evidenceTemplate ?? '?꾨왂 怨쇱젣 洹쇨굅, 紐⑺몴 ?뺤쓽, ?ㅽ뻾 洹쇨굅, 寃곌낵 鍮꾧탳',
    pageLimit: overrides?.pageLimit ?? 5,
    rolloverHistory: overrides?.rolloverHistory ?? [],
    carriedFromCycleId: overrides?.carriedFromCycleId,
  }
}

function buildBaseIndicatorFromPersonalKpi(
  kpi: PersonalKpiLite,
  groups: PerformanceEvaluationGroup[],
  matrixConfig: PerformanceSelectionMatrixConfig,
  overrides?: PerformanceIndicatorDesign
): PerformanceIndicatorDesign {
  const smartDiagnosis =
    overrides?.smartDiagnosis ??
    diagnoseSmartIndicator({
      name: kpi.kpiName,
      definition: kpi.definition,
      formula: kpi.formula,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      weight: kpi.weight,
      hasDeadline: true,
    })
  const strategicAlignmentScore =
    overrides?.strategicAlignmentScore ?? (kpi.linkedOrgKpiId ? 4 : 2)
  const jobRepresentativenessScore =
    overrides?.jobRepresentativenessScore ?? (kpi.kpiType === 'QUALITATIVE' ? 4 : 5)
  const selectionStatus =
    overrides?.selectionStatus ??
    recommendIndicatorStatus({
      smartTotal: smartDiagnosis.total,
      strategicAlignmentScore,
      jobRepresentativenessScore,
      metricType: kpi.kpiType,
      matrixConfig,
    })

  return {
    key: buildIndicatorDesignKey('PERSONAL_KPI', kpi.id),
    source: 'PERSONAL_KPI',
    sourceId: kpi.id,
    name: overrides?.name ?? kpi.kpiName,
    metricType: overrides?.metricType ?? kpi.kpiType,
    departmentId: kpi.employee.deptId,
    departmentName: kpi.employee.department?.deptName,
    ownerLabel: `${kpi.employee.empName} 媛쒖씤 KPI`,
    evaluationGroupId:
      overrides?.evaluationGroupId ??
      resolveEvaluationGroupId(groups, kpi.employee.deptId, kpi.kpiType),
    strategicAlignmentScore,
    jobRepresentativenessScore,
    smartDiagnosis,
    selectionStatus,
    lifecycleAction: overrides?.lifecycleAction ?? selectionStatus,
    departmentComment: overrides?.departmentComment ?? '',
    managerComment: overrides?.managerComment ?? '',
    evidenceTemplate: overrides?.evidenceTemplate ?? '실적 보고서, 부가 기록, 작업 근거, 개선 계획',
    pageLimit: overrides?.pageLimit ?? 5,
    rolloverHistory: overrides?.rolloverHistory ?? [],
    carriedFromCycleId: overrides?.carriedFromCycleId,
  }
}

function buildManualIndicator(overrides: PerformanceIndicatorDesign, groups: PerformanceEvaluationGroup[]) {
  return {
    ...overrides,
    evaluationGroupId:
      overrides.evaluationGroupId ??
      resolveEvaluationGroupId(groups, overrides.departmentId, overrides.metricType),
  }
}

export async function getPerformanceDesignPageData(
  session?: PerformanceDesignSession | null,
  params: PerformanceDesignParams = {},
  deps: PerformanceDesignDeps = createDeps()
): Promise<PerformanceDesignPageData> {
  if (!session?.user) {
    return {
      state: 'permission-denied',
      message: '濡쒓렇?몄씠 ?꾩슂?⑸땲??',
        selectedCycleId: undefined,
        cycleOptions: [],
        evaluationGroups: [],
        indicators: [],
        selectionMatrix: createDefaultPerformanceDesignConfig().selectionMatrix,
        nonQuantitativeTemplate: createDefaultPerformanceDesignConfig().nonQuantitativeTemplate,
        nonQuantitativeTemplateBindings: createDefaultPerformanceDesignConfig().nonQuantitativeTemplateBindings,
        milestones: [],
      collaborationCases: [],
      environmentAdjustment: createDefaultPerformanceDesignConfig().environmentAdjustment,
      healthFindings: [],
      alerts: [],
      summary: {
        groupCount: 0,
        indicatorCount: 0,
        qualitativeIndicatorCount: 0,
        collaborationCaseCount: 0,
        healthFindingCount: 0,
      },
      departments: [],
    }
  }

  if (!isAdmin(session)) {
    return {
      state: 'permission-denied',
      message: '愿由ъ옄 沅뚰븳???꾩슂?⑸땲??',
        selectedCycleId: undefined,
        cycleOptions: [],
        evaluationGroups: [],
        indicators: [],
        selectionMatrix: createDefaultPerformanceDesignConfig().selectionMatrix,
        nonQuantitativeTemplate: createDefaultPerformanceDesignConfig().nonQuantitativeTemplate,
        nonQuantitativeTemplateBindings: createDefaultPerformanceDesignConfig().nonQuantitativeTemplateBindings,
        milestones: [],
      collaborationCases: [],
      environmentAdjustment: createDefaultPerformanceDesignConfig().environmentAdjustment,
      healthFindings: [],
      alerts: [],
      summary: {
        groupCount: 0,
        indicatorCount: 0,
        qualitativeIndicatorCount: 0,
        collaborationCaseCount: 0,
        healthFindingCount: 0,
      },
      departments: [],
    }
  }

  const alerts: PerformanceDesignAlert[] = []

  try {
    const [cycles, departments] = await Promise.all([
      loadPerformanceSection(alerts, '평가 사이클', [] as CycleLite[], () => deps.loadCycles()),
      loadPerformanceSection(alerts, '遺??紐⑸줉', [] as DepartmentLite[], () => deps.loadDepartments()),
    ])

    if (!cycles.length) {
      const defaults = createDefaultPerformanceDesignConfig()
      return {
        state: 'empty',
        message: '?깃낵 ?ㅺ퀎瑜??곸슜???됯? ?ъ씠?댁씠 ?놁뒿?덈떎. 癒쇱? ?됯? ?ъ씠?댁쓣 ?앹꽦??二쇱꽭??',
        selectedCycleId: undefined,
        cycleOptions: [],
        evaluationGroups: defaults.evaluationGroups,
        indicators: [],
        selectionMatrix: defaults.selectionMatrix,
        nonQuantitativeTemplate: defaults.nonQuantitativeTemplate,
        nonQuantitativeTemplateBindings: defaults.nonQuantitativeTemplateBindings,
        milestones: defaults.milestones,
        collaborationCases: [],
        environmentAdjustment: defaults.environmentAdjustment,
        healthFindings: [],
        alerts,
        summary: {
          groupCount: defaults.evaluationGroups.length,
          indicatorCount: 0,
          qualitativeIndicatorCount: 0,
          collaborationCaseCount: 0,
          healthFindingCount: 0,
        },
        departments: departments.map((department) => ({ id: department.id, name: department.deptName })),
      }
    }

    const selectedCycle =
      cycles.find((cycle) => cycle.id === params.cycleId) ??
      cycles[0]
    const cycleOptions = cycles.map((cycle) => ({
      id: cycle.id,
      label: `${cycle.evalYear} 쨌 ${cycle.organization.name} 쨌 ${cycle.cycleName}`,
      year: cycle.evalYear,
    }))

    const nextCycle = cycles.find(
      (cycle) => cycle.orgId === selectedCycle.orgId && cycle.evalYear === selectedCycle.evalYear + 1
    )

    const config = parsePerformanceDesignConfig(selectedCycle.performanceDesignConfig)
    const normalizedTemplateBindings = normalizeTemplateBindings(
      config.evaluationGroups,
      config.nonQuantitativeTemplateBindings
    )
    const [orgKpis, personalKpis, evaluations] = await Promise.all([
      loadPerformanceSection(alerts, '議곗쭅 KPI', [] as OrgKpiLite[], () => deps.loadOrgKpis(selectedCycle.evalYear)),
      loadPerformanceSection(alerts, '媛쒖씤 KPI', [] as PersonalKpiLite[], () => deps.loadPersonalKpis(selectedCycle.evalYear)),
      loadPerformanceSection(alerts, '?됯? ?먯닔', [] as EvaluationLite[], () => deps.loadEvaluations(selectedCycle.id)),
    ])

    const overridesByKey = new Map(config.indicatorDesigns.map((design) => [design.key, design]))
    const indicators: PerformanceIndicatorView[] = []

    for (const orgKpi of orgKpis) {
      const key = buildIndicatorDesignKey('ORG_KPI', orgKpi.id)
      const design = buildBaseIndicatorFromOrgKpi(
        orgKpi,
        config.evaluationGroups,
        config.selectionMatrix,
        overridesByKey.get(key)
      )
      const matrixScore = calculateIndicatorMatrixScore({
        strategicAlignmentScore: design.strategicAlignmentScore,
        jobRepresentativenessScore: design.jobRepresentativenessScore,
        smartTotal: design.smartDiagnosis?.total ?? 0,
        matrixConfig: config.selectionMatrix,
      })
      const templateBinding = resolveNonQuantitativeTemplateBinding(normalizedTemplateBindings, design.evaluationGroupId)
      indicators.push({
        ...design,
        matrixScore,
        autoRecommendation: recommendIndicatorStatus({
          smartTotal: design.smartDiagnosis?.total ?? 0,
          strategicAlignmentScore: design.strategicAlignmentScore,
          jobRepresentativenessScore: design.jobRepresentativenessScore,
          metricType: design.metricType,
          matrixConfig: config.selectionMatrix,
        }),
        evaluationGroupName:
          config.evaluationGroups.find((group) => group.id === design.evaluationGroupId)?.name ?? '\uBBF8\uBD84\uB958',
        nonQuantTemplateRange:
          design.metricType === 'QUANTITATIVE' ? '' : buildNonQuantitativePageRangeLabel(templateBinding),
        sourceLabel: '\uC870\uC9C1 KPI',
      })
    }

    for (const personalKpi of personalKpis) {
      const key = buildIndicatorDesignKey('PERSONAL_KPI', personalKpi.id)
      const design = buildBaseIndicatorFromPersonalKpi(
        personalKpi,
        config.evaluationGroups,
        config.selectionMatrix,
        overridesByKey.get(key)
      )
      const matrixScore = calculateIndicatorMatrixScore({
        strategicAlignmentScore: design.strategicAlignmentScore,
        jobRepresentativenessScore: design.jobRepresentativenessScore,
        smartTotal: design.smartDiagnosis?.total ?? 0,
        matrixConfig: config.selectionMatrix,
      })
      const templateBinding = resolveNonQuantitativeTemplateBinding(normalizedTemplateBindings, design.evaluationGroupId)
      indicators.push({
        ...design,
        matrixScore,
        autoRecommendation: recommendIndicatorStatus({
          smartTotal: design.smartDiagnosis?.total ?? 0,
          strategicAlignmentScore: design.strategicAlignmentScore,
          jobRepresentativenessScore: design.jobRepresentativenessScore,
          metricType: design.metricType,
          matrixConfig: config.selectionMatrix,
        }),
        evaluationGroupName:
          config.evaluationGroups.find((group) => group.id === design.evaluationGroupId)?.name ?? '\uBBF8\uBD84\uB958',
        nonQuantTemplateRange:
          design.metricType === 'QUANTITATIVE' ? '' : buildNonQuantitativePageRangeLabel(templateBinding),
        sourceLabel: '\uAC1C\uC778 KPI',
      })
    }

    for (const design of config.indicatorDesigns.filter((item) => item.source === 'MANUAL')) {
      const builtDesign = buildManualIndicator(design, config.evaluationGroups)
      const matrixScore = calculateIndicatorMatrixScore({
        strategicAlignmentScore: builtDesign.strategicAlignmentScore,
        jobRepresentativenessScore: builtDesign.jobRepresentativenessScore,
        smartTotal: builtDesign.smartDiagnosis?.total ?? 0,
        matrixConfig: config.selectionMatrix,
      })
      const templateBinding = resolveNonQuantitativeTemplateBinding(
        normalizedTemplateBindings,
        builtDesign.evaluationGroupId
      )
      indicators.push({
        ...builtDesign,
        matrixScore,
        autoRecommendation: recommendIndicatorStatus({
          smartTotal: builtDesign.smartDiagnosis?.total ?? 0,
          strategicAlignmentScore: builtDesign.strategicAlignmentScore,
          jobRepresentativenessScore: builtDesign.jobRepresentativenessScore,
          metricType: builtDesign.metricType,
          matrixConfig: config.selectionMatrix,
        }),
        evaluationGroupName:
          config.evaluationGroups.find((group) => group.id === design.evaluationGroupId)?.name ?? '\uBBF8\uBD84\uB958',
        nonQuantTemplateRange:
          builtDesign.metricType === 'QUANTITATIVE' ? '' : buildNonQuantitativePageRangeLabel(templateBinding),
        sourceLabel: '\uC218\uB3D9 \uB4F1\uB85D',
      })
    }

    indicators.sort((left, right) => right.matrixScore - left.matrixScore || left.name.localeCompare(right.name, 'ko'))

    const personalKpiLookup = new Map(personalKpis.map((kpi) => [kpi.id, kpi]))
    const linkedCounts = new Map<string, number>()
    for (const item of personalKpis) {
      if (!item.linkedOrgKpiId) continue
      linkedCounts.set(item.linkedOrgKpiId, (linkedCounts.get(item.linkedOrgKpiId) ?? 0) + 1)
    }

    const statsByIndicator = new Map<string, number[]>()
    for (const evaluation of evaluations) {
      for (const item of evaluation.items) {
        const score = scoreFromEvaluationItem(item)
        if (score == null) continue
        const bucket = statsByIndicator.get(item.personalKpiId) ?? []
        bucket.push(score)
        statsByIndicator.set(item.personalKpiId, bucket)
      }
    }

    const healthStats: IndicatorHealthStat[] = personalKpis.map((kpi) => {
      const values = statsByIndicator.get(kpi.id) ?? []
      const averageScore = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
      const perfectRate = values.length ? values.filter((value) => value >= 95).length / values.length : 0
      return {
        key: buildIndicatorDesignKey('PERSONAL_KPI', kpi.id),
        indicatorName: kpi.kpiName,
        averageScore: Math.round(averageScore * 10) / 10,
        perfectRate,
        stddev: Math.round(calculateStddev(values) * 10) / 10,
        sampleCount: values.length,
        duplicateReflectionRisk: Boolean(kpi.linkedOrgKpiId && (linkedCounts.get(kpi.linkedOrgKpiId) ?? 0) >= 2),
        lowBaseRisk: values.length <= 1,
      }
    })

    const healthFindings = buildIndicatorHealthFindings(healthStats)

    return {
      state: 'ready',
      selectedCycleId: selectedCycle.id,
      selectedCycleName: `${selectedCycle.evalYear} 쨌 ${selectedCycle.cycleName}`,
      selectedYear: selectedCycle.evalYear,
      nextCycleId: nextCycle?.id,
      cycleOptions,
      evaluationGroups: config.evaluationGroups,
      indicators,
      selectionMatrix: config.selectionMatrix,
      nonQuantitativeTemplate: config.nonQuantitativeTemplate,
      nonQuantitativeTemplateBindings: normalizedTemplateBindings,
      milestones: config.milestones,
      collaborationCases: config.collaborationCases.map((caseItem) => ({
        ...caseItem,
        departmentName:
          caseItem.departmentName ??
          departments.find((department) => department.id === caseItem.departmentId)?.deptName,
      })),
      environmentAdjustment: config.environmentAdjustment,
      healthFindings,
      alerts,
      summary: {
        groupCount: config.evaluationGroups.length,
        indicatorCount: indicators.length,
        qualitativeIndicatorCount: indicators.filter((indicator) => indicator.metricType === 'QUALITATIVE').length,
        collaborationCaseCount: config.collaborationCases.length,
        healthFindingCount: healthFindings.length,
      },
      departments: departments.map((department) => ({ id: department.id, name: department.deptName })),
    }
  } catch (error) {
    console.error('[performance-design] fatal', error)
    const defaults = createDefaultPerformanceDesignConfig()
    return {
      state: 'error',
      message: '?깃낵 ?ㅺ퀎 ?붾㈃??遺덈윭?ㅼ? 紐삵뻽?듬땲??',
      selectedCycleId: undefined,
      cycleOptions: [],
      evaluationGroups: defaults.evaluationGroups,
      indicators: [],
      selectionMatrix: defaults.selectionMatrix,
      nonQuantitativeTemplate: defaults.nonQuantitativeTemplate,
      nonQuantitativeTemplateBindings: defaults.nonQuantitativeTemplateBindings,
      milestones: defaults.milestones,
      collaborationCases: [],
      environmentAdjustment: defaults.environmentAdjustment,
      healthFindings: [],
      alerts,
      summary: {
        groupCount: defaults.evaluationGroups.length,
        indicatorCount: 0,
        qualitativeIndicatorCount: 0,
        collaborationCaseCount: 0,
        healthFindingCount: 0,
      },
      departments: [],
    }
  }
}

