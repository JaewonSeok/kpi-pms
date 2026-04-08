export type EvaluationGroupComparisonMode = 'WITHIN_GROUP' | 'SEPARATE_TRACK' | 'CROSS_GROUP'

export type IndicatorSourceType = 'ORG_KPI' | 'PERSONAL_KPI' | 'MANUAL'

export type IndicatorSelectionStatus = 'KEEP' | 'HOLD' | 'IMPROVE' | 'DELETE' | 'NEW'

export type PerformanceMilestoneKey =
  | 'HANDBOOK_FINALIZED'
  | 'GOAL_FINALIZED'
  | 'MID_CHECK'
  | 'QUALITATIVE_SUBMISSION'
  | 'FINAL_EVALUATION'
  | 'RESULT_FINALIZED'

export type CollaborationCaseStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'SHARED'

export type IndicatorSmartDiagnosis = {
  specific: number
  measurable: number
  achievable: number
  relevant: number
  timeBound: number
  total: number
  note: string
}

export type PerformanceEvaluationGroup = {
  id: string
  name: string
  description: string
  quantitativeWeight: number
  qualitativeWeight: number
  comparisonMode: EvaluationGroupComparisonMode
  comparisonTargetLabel: string
  departmentIds: string[]
}

export type PerformanceSelectionMatrixConfig = {
  strategicWeight: number
  jobWeight: number
  smartWeight: number
  keepThreshold: number
  holdThreshold: number
  improveThreshold: number
}

export type IndicatorRolloverHistoryItem = {
  id: string
  action: IndicatorSelectionStatus
  comment: string
  decidedBy: string
  decidedAt: string
  targetCycleId?: string
  targetCycleName?: string
}

export type PerformanceIndicatorDesign = {
  key: string
  source: IndicatorSourceType
  sourceId?: string
  name: string
  metricType: 'QUANTITATIVE' | 'QUALITATIVE' | 'COLLABORATION'
  departmentId?: string
  departmentName?: string
  ownerLabel?: string
  evaluationGroupId?: string
  strategicAlignmentScore: number
  jobRepresentativenessScore: number
  smartDiagnosis?: IndicatorSmartDiagnosis
  selectionStatus: IndicatorSelectionStatus
  lifecycleAction: IndicatorSelectionStatus
  departmentComment: string
  managerComment: string
  evidenceTemplate: string
  pageLimit: number
  rolloverHistory: IndicatorRolloverHistoryItem[]
  carriedFromCycleId?: string
}

export type NonQuantitativeTemplateSection = {
  id: string
  title: string
  focusPoint: string
  checklist: string[]
}

export type NonQuantitativeTemplate = {
  name: string
  guidance: string
  reportFormat: string
  pageLimit: number
  sections: NonQuantitativeTemplateSection[]
  allowInternalEvidence: boolean
  evidenceGuide: string[]
}

export type NonQuantitativeTemplateBinding = {
  id: string
  evaluationGroupId: string
  pageMin: number
  pageMax: number
  guidanceOverride: string
  reportFormatOverride: string
  evidenceGuideOverride: string[]
}

export type PerformanceMilestone = {
  id: string
  key: PerformanceMilestoneKey
  label: string
  ownerRole: 'HR' | 'MANAGER' | 'DEPARTMENT'
  startAt?: string
  endAt?: string
  description: string
}

export type CollaborationCaseEvaluation = {
  impactScore: number
  executionScore: number
  collaborationScore: number
  spreadScore: number
  comment: string
}

export type CollaborationCase = {
  id: string
  departmentId: string
  departmentName?: string
  title: string
  summary: string
  impact: string
  collaborationPartners: string[]
  evidenceNotes: string
  submittedBy: string
  status: CollaborationCaseStatus
  evaluation: CollaborationCaseEvaluation
  highlighted: boolean
}

export type EnvironmentAdjustmentConfig = {
  enabled: boolean
  effortGuide: string
  targetAdjustmentGuide: string
  fallbackIndicators: string[]
}

export type PerformanceDesignConfig = {
  evaluationGroups: PerformanceEvaluationGroup[]
  indicatorDesigns: PerformanceIndicatorDesign[]
  selectionMatrix: PerformanceSelectionMatrixConfig
  nonQuantitativeTemplate: NonQuantitativeTemplate
  nonQuantitativeTemplateBindings: NonQuantitativeTemplateBinding[]
  milestones: PerformanceMilestone[]
  collaborationCases: CollaborationCase[]
  environmentAdjustment: EnvironmentAdjustmentConfig
}

export type IndicatorHealthStat = {
  key: string
  indicatorName: string
  averageScore: number
  perfectRate: number
  stddev: number
  sampleCount: number
  duplicateReflectionRisk: boolean
  lowBaseRisk: boolean
}

export type IndicatorHealthFinding = {
  key: string
  indicatorName: string
  severity: 'high' | 'medium' | 'low'
  reasons: string[]
  recommendation: string
}

const DEFAULT_EVALUATION_GROUPS: PerformanceEvaluationGroup[] = [
  {
    id: 'group-management',
    name: '경영관리군',
    description: '전사 운영, 재무, 기획, 관리성 KPI를 비교하는 군입니다.',
    quantitativeWeight: 60,
    qualitativeWeight: 40,
    comparisonMode: 'WITHIN_GROUP',
    comparisonTargetLabel: '경영관리군 내 비교',
    departmentIds: [],
  },
  {
    id: 'group-support',
    name: '사업지원군',
    description: '영업/고객/운영 지원 부서의 KPI와 비계량 성과를 함께 비교합니다.',
    quantitativeWeight: 55,
    qualitativeWeight: 45,
    comparisonMode: 'WITHIN_GROUP',
    comparisonTargetLabel: '사업지원군 내 비교',
    departmentIds: [],
  },
  {
    id: 'group-education-research',
    name: '교육/연구군',
    description: '연구, 교육, 전문성 축적 성과를 정성 중심으로 비교합니다.',
    quantitativeWeight: 40,
    qualitativeWeight: 60,
    comparisonMode: 'SEPARATE_TRACK',
    comparisonTargetLabel: '전용 정성 비교군',
    departmentIds: [],
  },
  {
    id: 'group-special',
    name: '별도평가군',
    description: '현장 여건이나 특수 직무를 고려해 별도 관리가 필요한 집합입니다.',
    quantitativeWeight: 50,
    qualitativeWeight: 50,
    comparisonMode: 'SEPARATE_TRACK',
    comparisonTargetLabel: '별도평가군 내 비교',
    departmentIds: [],
  },
]

const DEFAULT_NON_QUANT_TEMPLATE: NonQuantitativeTemplate = {
  name: 'PDCA 기반 비계량 평가 템플릿',
  guidance:
    '정성 성과는 계획-실행-점검-개선의 흐름을 기준으로 작성합니다. 보고서는 핵심 성과, 실행 근거, 재발 방지/확산 계획까지 포함해야 합니다.',
  reportFormat: '실적 개요 → PDCA 서술 → 증빙 첨부 → 리스크 및 차년도 보완안',
  pageLimit: 5,
  sections: [
    {
      id: 'section-plan',
      title: 'Plan',
      focusPoint: '목표 배경, 성공 기준, 주요 이해관계자를 명확히 적습니다.',
      checklist: ['목표 배경이 명확한가', '성공 기준과 목표치가 제시됐는가'],
    },
    {
      id: 'section-do',
      title: 'Do',
      focusPoint: '실행 과정, 협업 구조, 핵심 의사결정 내역을 기록합니다.',
      checklist: ['실행 과정이 시간순으로 정리됐는가', '협업 부서 및 역할이 드러나는가'],
    },
    {
      id: 'section-check',
      title: 'Check',
      focusPoint: '성과 결과와 예상 대비 차이, 실패 요인을 점검합니다.',
      checklist: ['목표 대비 결과가 비교되는가', '이탈 원인을 설명했는가'],
    },
    {
      id: 'section-act',
      title: 'Act',
      focusPoint: '재발 방지, 표준화, 다음 연도 환류 계획을 정리합니다.',
      checklist: ['재발 방지 또는 확산 계획이 있는가', '다음 연도 개선안이 구체적인가'],
    },
  ],
  allowInternalEvidence: true,
  evidenceGuide: ['내부 방침 문서', '실적 보고서', '회의록/승인 메일', '업무 시스템 캡처'],
}

const DEFAULT_SELECTION_MATRIX: PerformanceSelectionMatrixConfig = {
  strategicWeight: 30,
  jobWeight: 30,
  smartWeight: 40,
  keepThreshold: 80,
  holdThreshold: 65,
  improveThreshold: 45,
}

const DEFAULT_MILESTONES: PerformanceMilestone[] = [
  {
    id: 'milestone-handbook',
    key: 'HANDBOOK_FINALIZED',
    label: '편람 확정',
    ownerRole: 'HR',
    description: '평가 편람, 평가군, 비중, 지표 기준을 확정합니다.',
  },
  {
    id: 'milestone-goal',
    key: 'GOAL_FINALIZED',
    label: '목표 확정',
    ownerRole: 'MANAGER',
    description: '조직 KPI와 개인 KPI를 최종 확정합니다.',
  },
  {
    id: 'milestone-mid',
    key: 'MID_CHECK',
    label: '중간점검',
    ownerRole: 'MANAGER',
    description: '지표 건강도와 진행 편차를 중간 점검합니다.',
  },
  {
    id: 'milestone-qual',
    key: 'QUALITATIVE_SUBMISSION',
    label: '비계량 제출',
    ownerRole: 'DEPARTMENT',
    description: '비계량 평가 보고서와 증빙을 제출합니다.',
  },
  {
    id: 'milestone-final',
    key: 'FINAL_EVALUATION',
    label: '최종평가',
    ownerRole: 'MANAGER',
    description: '최종 점수 및 코멘트를 확정합니다.',
  },
  {
    id: 'milestone-result',
    key: 'RESULT_FINALIZED',
    label: '결과 확정',
    ownerRole: 'HR',
    description: '캘리브레이션 및 결과 공유 기준을 확정합니다.',
  },
]

const DEFAULT_ENVIRONMENT_ADJUSTMENT: EnvironmentAdjustmentConfig = {
  enabled: false,
  effortGuide: '조직/현장 특수성으로 목표치를 그대로 비교하기 어렵다면 업무추진 노력도와 장애 요인을 별도로 기록합니다.',
  targetAdjustmentGuide: '현장 제약이 객관적으로 입증된 경우에만 목표치를 조정하고, 동일군 내부 비교 기준은 유지합니다.',
  fallbackIndicators: [],
}

function createDefaultTemplateBinding(evaluationGroupId: string, pageMin: number, pageMax: number): NonQuantitativeTemplateBinding {
  return {
    id: `binding-${evaluationGroupId}`,
    evaluationGroupId,
    pageMin,
    pageMax,
    guidanceOverride: '',
    reportFormatOverride: '',
    evidenceGuideOverride: [],
  }
}

function createDefaultTemplateBindings(groups: PerformanceEvaluationGroup[]) {
  return groups.map((group) => {
    if (group.id === 'group-education-research') {
      return createDefaultTemplateBinding(group.id, 2, 4)
    }
    return createDefaultTemplateBinding(group.id, 1, 2)
  })
}

export function createDefaultPerformanceDesignConfig(): PerformanceDesignConfig {
  const evaluationGroups = DEFAULT_EVALUATION_GROUPS.map((item) => ({ ...item, departmentIds: [...item.departmentIds] }))
  return {
    evaluationGroups,
    indicatorDesigns: [],
    selectionMatrix: { ...DEFAULT_SELECTION_MATRIX },
    nonQuantitativeTemplate: {
      ...DEFAULT_NON_QUANT_TEMPLATE,
      sections: DEFAULT_NON_QUANT_TEMPLATE.sections.map((section) => ({
        ...section,
        checklist: [...section.checklist],
      })),
      evidenceGuide: [...DEFAULT_NON_QUANT_TEMPLATE.evidenceGuide],
    },
    nonQuantitativeTemplateBindings: createDefaultTemplateBindings(evaluationGroups),
    milestones: DEFAULT_MILESTONES.map((item) => ({ ...item })),
    collaborationCases: [],
    environmentAdjustment: {
      ...DEFAULT_ENVIRONMENT_ADJUSTMENT,
      fallbackIndicators: [],
    },
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

export function parsePerformanceDesignConfig(input: unknown): PerformanceDesignConfig {
  const defaults = createDefaultPerformanceDesignConfig()
  if (!isPlainObject(input)) return defaults

  const evaluationGroups: PerformanceEvaluationGroup[] = Array.isArray(input.evaluationGroups)
    ? input.evaluationGroups.filter(isPlainObject).map((item, index): PerformanceEvaluationGroup => ({
        id: typeof item.id === 'string' && item.id ? item.id : `group-${index + 1}`,
        name: typeof item.name === 'string' && item.name ? item.name : `평가군 ${index + 1}`,
        description: typeof item.description === 'string' ? item.description : '',
        quantitativeWeight: Number(item.quantitativeWeight ?? 0) || 0,
        qualitativeWeight: Number(item.qualitativeWeight ?? 0) || 0,
        comparisonMode:
          item.comparisonMode === 'SEPARATE_TRACK' || item.comparisonMode === 'CROSS_GROUP'
            ? item.comparisonMode
            : 'WITHIN_GROUP',
        comparisonTargetLabel: typeof item.comparisonTargetLabel === 'string' ? item.comparisonTargetLabel : '',
        departmentIds: normalizeStringArray(item.departmentIds),
      }))
    : defaults.evaluationGroups

  const indicatorDesigns: PerformanceIndicatorDesign[] = Array.isArray(input.indicatorDesigns)
    ? input.indicatorDesigns.filter(isPlainObject).map((item, index): PerformanceIndicatorDesign => ({
        key: typeof item.key === 'string' && item.key ? item.key : `indicator-${index + 1}`,
        source:
          item.source === 'PERSONAL_KPI' || item.source === 'MANUAL'
            ? item.source
            : 'ORG_KPI',
        sourceId: typeof item.sourceId === 'string' ? item.sourceId : undefined,
        name: typeof item.name === 'string' ? item.name : '지표',
        metricType:
          item.metricType === 'QUALITATIVE' || item.metricType === 'COLLABORATION'
            ? item.metricType
            : 'QUANTITATIVE',
        departmentId: typeof item.departmentId === 'string' ? item.departmentId : undefined,
        departmentName: typeof item.departmentName === 'string' ? item.departmentName : undefined,
        ownerLabel: typeof item.ownerLabel === 'string' ? item.ownerLabel : undefined,
        evaluationGroupId: typeof item.evaluationGroupId === 'string' ? item.evaluationGroupId : undefined,
        strategicAlignmentScore: Number(item.strategicAlignmentScore ?? 3) || 3,
        jobRepresentativenessScore: Number(item.jobRepresentativenessScore ?? 3) || 3,
        smartDiagnosis: isPlainObject(item.smartDiagnosis)
          ? {
              specific: Number(item.smartDiagnosis.specific ?? 0) || 0,
              measurable: Number(item.smartDiagnosis.measurable ?? 0) || 0,
              achievable: Number(item.smartDiagnosis.achievable ?? 0) || 0,
              relevant: Number(item.smartDiagnosis.relevant ?? 0) || 0,
              timeBound: Number(item.smartDiagnosis.timeBound ?? 0) || 0,
              total: Number(item.smartDiagnosis.total ?? 0) || 0,
              note: typeof item.smartDiagnosis.note === 'string' ? item.smartDiagnosis.note : '',
            }
          : undefined,
        selectionStatus:
          item.selectionStatus === 'HOLD' ||
          item.selectionStatus === 'IMPROVE' ||
          item.selectionStatus === 'DELETE' ||
          item.selectionStatus === 'NEW'
            ? item.selectionStatus
            : 'KEEP',
        lifecycleAction:
          item.lifecycleAction === 'HOLD' ||
          item.lifecycleAction === 'IMPROVE' ||
          item.lifecycleAction === 'DELETE' ||
          item.lifecycleAction === 'NEW'
            ? item.lifecycleAction
            : 'KEEP',
        departmentComment: typeof item.departmentComment === 'string' ? item.departmentComment : '',
        managerComment: typeof item.managerComment === 'string' ? item.managerComment : '',
        evidenceTemplate: typeof item.evidenceTemplate === 'string' ? item.evidenceTemplate : '',
        pageLimit: Number(item.pageLimit ?? defaults.nonQuantitativeTemplate.pageLimit) || defaults.nonQuantitativeTemplate.pageLimit,
        rolloverHistory: Array.isArray(item.rolloverHistory)
          ? item.rolloverHistory.filter(isPlainObject).map((history, historyIndex) => ({
              id: typeof history.id === 'string' && history.id ? history.id : `history-${historyIndex + 1}`,
              action:
                history.action === 'HOLD' ||
                history.action === 'IMPROVE' ||
                history.action === 'DELETE' ||
                history.action === 'NEW'
                  ? history.action
                  : 'KEEP',
              comment: typeof history.comment === 'string' ? history.comment : '',
              decidedBy: typeof history.decidedBy === 'string' ? history.decidedBy : '',
              decidedAt: typeof history.decidedAt === 'string' ? history.decidedAt : '',
              targetCycleId: typeof history.targetCycleId === 'string' ? history.targetCycleId : undefined,
              targetCycleName: typeof history.targetCycleName === 'string' ? history.targetCycleName : undefined,
            }))
          : [],
        carriedFromCycleId: typeof item.carriedFromCycleId === 'string' ? item.carriedFromCycleId : undefined,
      }))
    : []

  const selectionMatrix: PerformanceSelectionMatrixConfig = isPlainObject(input.selectionMatrix)
    ? {
        strategicWeight: Number(input.selectionMatrix.strategicWeight ?? DEFAULT_SELECTION_MATRIX.strategicWeight) || DEFAULT_SELECTION_MATRIX.strategicWeight,
        jobWeight: Number(input.selectionMatrix.jobWeight ?? DEFAULT_SELECTION_MATRIX.jobWeight) || DEFAULT_SELECTION_MATRIX.jobWeight,
        smartWeight: Number(input.selectionMatrix.smartWeight ?? DEFAULT_SELECTION_MATRIX.smartWeight) || DEFAULT_SELECTION_MATRIX.smartWeight,
        keepThreshold: Number(input.selectionMatrix.keepThreshold ?? DEFAULT_SELECTION_MATRIX.keepThreshold) || DEFAULT_SELECTION_MATRIX.keepThreshold,
        holdThreshold: Number(input.selectionMatrix.holdThreshold ?? DEFAULT_SELECTION_MATRIX.holdThreshold) || DEFAULT_SELECTION_MATRIX.holdThreshold,
        improveThreshold: Number(input.selectionMatrix.improveThreshold ?? DEFAULT_SELECTION_MATRIX.improveThreshold) || DEFAULT_SELECTION_MATRIX.improveThreshold,
      }
    : { ...DEFAULT_SELECTION_MATRIX }

  const nonQuantitativeTemplate: NonQuantitativeTemplate = isPlainObject(input.nonQuantitativeTemplate)
    ? {
        name: typeof input.nonQuantitativeTemplate.name === 'string' ? input.nonQuantitativeTemplate.name : defaults.nonQuantitativeTemplate.name,
        guidance:
          typeof input.nonQuantitativeTemplate.guidance === 'string'
            ? input.nonQuantitativeTemplate.guidance
            : defaults.nonQuantitativeTemplate.guidance,
        reportFormat:
          typeof input.nonQuantitativeTemplate.reportFormat === 'string'
            ? input.nonQuantitativeTemplate.reportFormat
            : defaults.nonQuantitativeTemplate.reportFormat,
        pageLimit:
          Number(input.nonQuantitativeTemplate.pageLimit ?? defaults.nonQuantitativeTemplate.pageLimit) ||
          defaults.nonQuantitativeTemplate.pageLimit,
        sections: Array.isArray(input.nonQuantitativeTemplate.sections)
          ? input.nonQuantitativeTemplate.sections.filter(isPlainObject).map((section, index) => ({
              id: typeof section.id === 'string' && section.id ? section.id : `section-${index + 1}`,
              title: typeof section.title === 'string' ? section.title : `섹션 ${index + 1}`,
              focusPoint: typeof section.focusPoint === 'string' ? section.focusPoint : '',
              checklist: normalizeStringArray(section.checklist),
            }))
          : defaults.nonQuantitativeTemplate.sections,
        allowInternalEvidence:
          typeof input.nonQuantitativeTemplate.allowInternalEvidence === 'boolean'
            ? input.nonQuantitativeTemplate.allowInternalEvidence
            : defaults.nonQuantitativeTemplate.allowInternalEvidence,
        evidenceGuide: normalizeStringArray(
          input.nonQuantitativeTemplate.evidenceGuide,
          defaults.nonQuantitativeTemplate.evidenceGuide
        ),
      }
    : defaults.nonQuantitativeTemplate

  const nonQuantitativeTemplateBindings: NonQuantitativeTemplateBinding[] = Array.isArray(input.nonQuantitativeTemplateBindings)
    ? input.nonQuantitativeTemplateBindings.filter(isPlainObject).map((binding, index) => ({
        id: typeof binding.id === 'string' && binding.id ? binding.id : `binding-${index + 1}`,
        evaluationGroupId: typeof binding.evaluationGroupId === 'string' ? binding.evaluationGroupId : evaluationGroups[index]?.id ?? '',
        pageMin: Number(binding.pageMin ?? 1) || 1,
        pageMax: Number(binding.pageMax ?? 2) || 2,
        guidanceOverride: typeof binding.guidanceOverride === 'string' ? binding.guidanceOverride : '',
        reportFormatOverride: typeof binding.reportFormatOverride === 'string' ? binding.reportFormatOverride : '',
        evidenceGuideOverride: normalizeStringArray(binding.evidenceGuideOverride),
      }))
    : createDefaultTemplateBindings(evaluationGroups)

  const milestones: PerformanceMilestone[] = Array.isArray(input.milestones)
    ? input.milestones.filter(isPlainObject).map((item, index): PerformanceMilestone => ({
        id: typeof item.id === 'string' && item.id ? item.id : `milestone-${index + 1}`,
        key:
          item.key === 'GOAL_FINALIZED' ||
          item.key === 'MID_CHECK' ||
          item.key === 'QUALITATIVE_SUBMISSION' ||
          item.key === 'FINAL_EVALUATION' ||
          item.key === 'RESULT_FINALIZED'
            ? item.key
            : 'HANDBOOK_FINALIZED',
        label: typeof item.label === 'string' ? item.label : `일정 ${index + 1}`,
        ownerRole:
          item.ownerRole === 'MANAGER' || item.ownerRole === 'DEPARTMENT' ? item.ownerRole : 'HR',
        startAt: typeof item.startAt === 'string' ? item.startAt : undefined,
        endAt: typeof item.endAt === 'string' ? item.endAt : undefined,
        description: typeof item.description === 'string' ? item.description : '',
      }))
    : defaults.milestones

  const collaborationCases: CollaborationCase[] = Array.isArray(input.collaborationCases)
    ? input.collaborationCases.filter(isPlainObject).map((item, index): CollaborationCase => ({
        id: typeof item.id === 'string' && item.id ? item.id : `case-${index + 1}`,
        departmentId: typeof item.departmentId === 'string' ? item.departmentId : '',
        departmentName: typeof item.departmentName === 'string' ? item.departmentName : undefined,
        title: typeof item.title === 'string' ? item.title : '',
        summary: typeof item.summary === 'string' ? item.summary : '',
        impact: typeof item.impact === 'string' ? item.impact : '',
        collaborationPartners: normalizeStringArray(item.collaborationPartners),
        evidenceNotes: typeof item.evidenceNotes === 'string' ? item.evidenceNotes : '',
        submittedBy: typeof item.submittedBy === 'string' ? item.submittedBy : '',
        status:
          item.status === 'SUBMITTED' || item.status === 'REVIEWED' || item.status === 'SHARED'
            ? item.status
            : 'DRAFT',
        evaluation: isPlainObject(item.evaluation)
          ? {
              impactScore: Number(item.evaluation.impactScore ?? 0) || 0,
              executionScore: Number(item.evaluation.executionScore ?? 0) || 0,
              collaborationScore: Number(item.evaluation.collaborationScore ?? 0) || 0,
              spreadScore: Number(item.evaluation.spreadScore ?? 0) || 0,
              comment: typeof item.evaluation.comment === 'string' ? item.evaluation.comment : '',
            }
          : {
              impactScore: 0,
              executionScore: 0,
              collaborationScore: 0,
              spreadScore: 0,
              comment: '',
            },
        highlighted: Boolean(item.highlighted),
      }))
    : []

  const environmentAdjustment: EnvironmentAdjustmentConfig = isPlainObject(input.environmentAdjustment)
    ? {
        enabled: Boolean(input.environmentAdjustment.enabled),
        effortGuide:
          typeof input.environmentAdjustment.effortGuide === 'string'
            ? input.environmentAdjustment.effortGuide
            : defaults.environmentAdjustment.effortGuide,
        targetAdjustmentGuide:
          typeof input.environmentAdjustment.targetAdjustmentGuide === 'string'
            ? input.environmentAdjustment.targetAdjustmentGuide
            : defaults.environmentAdjustment.targetAdjustmentGuide,
        fallbackIndicators: normalizeStringArray(input.environmentAdjustment.fallbackIndicators),
      }
    : defaults.environmentAdjustment

  return {
    evaluationGroups,
    indicatorDesigns,
    selectionMatrix,
    nonQuantitativeTemplate,
    nonQuantitativeTemplateBindings,
    milestones,
    collaborationCases,
    environmentAdjustment,
  }
}

export function buildIndicatorDesignKey(source: IndicatorSourceType, sourceId?: string, name?: string) {
  if (source !== 'MANUAL' && sourceId) return `${source}:${sourceId}`
  return `${source}:${(name ?? 'indicator').trim().toLowerCase().replace(/\s+/g, '-')}`
}

function boundedScore(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)))
}

export function diagnoseSmartIndicator(params: {
  name: string
  definition?: string | null
  formula?: string | null
  targetValue?: number | null
  unit?: string | null
  weight?: number | null
  hasDeadline?: boolean
}): IndicatorSmartDiagnosis {
  const nameLength = params.name.trim().length
  const definitionLength = (params.definition ?? '').trim().length
  const formulaLength = (params.formula ?? '').trim().length

  const specific = boundedScore(nameLength > 10 ? 4 + (definitionLength > 30 ? 1 : 0) : 2)
  const measurable = boundedScore((params.targetValue != null ? 2 : 0) + (params.unit ? 2 : 0) + (formulaLength > 0 ? 1 : 0))
  const achievable = boundedScore((params.weight != null && params.weight <= 60 ? 3 : 2) + (params.targetValue != null ? 1 : 0))
  const relevant = boundedScore((definitionLength > 20 ? 3 : 2) + (nameLength > 6 ? 1 : 0) + (params.weight != null ? 1 : 0))
  const timeBound = boundedScore((params.hasDeadline ? 3 : 1) + (params.targetValue != null ? 1 : 0) + (formulaLength > 0 ? 1 : 0))
  const total = specific + measurable + achievable + relevant + timeBound

  let note = '유지 검토'
  if (total <= 11) note = '삭제 또는 신규 수립 검토'
  else if (total <= 15) note = '보완 필요'
  else if (total <= 19) note = '유보 없이 유지 가능'
  else note = '핵심 KPI로 유지 권장'

  return {
    specific,
    measurable,
    achievable,
    relevant,
    timeBound,
    total,
    note,
  }
}

export function recommendIndicatorStatus(params: {
  smartTotal: number
  strategicAlignmentScore: number
  jobRepresentativenessScore: number
  metricType: 'QUANTITATIVE' | 'QUALITATIVE' | 'COLLABORATION'
  matrixConfig?: PerformanceSelectionMatrixConfig
}) {
  const matrixScore = calculateIndicatorMatrixScore({
    strategicAlignmentScore: params.strategicAlignmentScore,
    jobRepresentativenessScore: params.jobRepresentativenessScore,
    smartTotal: params.smartTotal,
    matrixConfig: params.matrixConfig,
  })
  if (params.metricType === 'COLLABORATION') return 'NEW' as const
  const matrixConfig = params.matrixConfig ?? DEFAULT_SELECTION_MATRIX
  if (matrixScore >= matrixConfig.keepThreshold) return 'KEEP' as const
  if (matrixScore >= matrixConfig.holdThreshold) return 'HOLD' as const
  if (matrixScore >= matrixConfig.improveThreshold) return 'IMPROVE' as const
  if (params.smartTotal <= 11) return 'DELETE' as const
  return 'DELETE' as const
}

export function calculateIndicatorMatrixScore(params: {
  strategicAlignmentScore: number
  jobRepresentativenessScore: number
  smartTotal: number
  matrixConfig?: PerformanceSelectionMatrixConfig
}) {
  const matrixConfig = params.matrixConfig ?? DEFAULT_SELECTION_MATRIX
  const strategic = (params.strategicAlignmentScore / 5) * matrixConfig.strategicWeight
  const job = (params.jobRepresentativenessScore / 5) * matrixConfig.jobWeight
  const smart = (Math.max(0, Math.min(25, params.smartTotal)) / 25) * matrixConfig.smartWeight
  return Math.round((strategic + job + smart) * 10) / 10
}

export function resolveNonQuantitativeTemplateBinding(
  bindings: NonQuantitativeTemplateBinding[],
  evaluationGroupId?: string
) {
  if (!evaluationGroupId) return undefined
  return bindings.find((binding) => binding.evaluationGroupId === evaluationGroupId)
}

export function buildNonQuantitativePageRangeLabel(binding?: NonQuantitativeTemplateBinding) {
  if (!binding) return ''
  if (binding.pageMin === binding.pageMax) return `${binding.pageMax}페이지`
  return `${binding.pageMin}~${binding.pageMax}페이지`
}

export function normalizeTemplateBindings(
  groups: PerformanceEvaluationGroup[],
  bindings: NonQuantitativeTemplateBinding[]
) {
  const defaults = createDefaultTemplateBindings(groups)
  return groups.map((group) => {
    const existing = bindings.find((binding) => binding.evaluationGroupId === group.id)
    return existing ?? defaults.find((binding) => binding.evaluationGroupId === group.id) ?? createDefaultTemplateBinding(group.id, 1, 2)
  })
}

export function getDefaultSelectionMatrix() {
  return { ...DEFAULT_SELECTION_MATRIX }
}

export function getDefaultTemplateBindingForGroup(groupId: string) {
  return groupId === 'group-education-research'
    ? createDefaultTemplateBinding(groupId, 2, 4)
    : createDefaultTemplateBinding(groupId, 1, 2)
}

export function summarizeCollaborationScore(caseItem: CollaborationCase) {
  const total =
    caseItem.evaluation.impactScore +
    caseItem.evaluation.executionScore +
    caseItem.evaluation.collaborationScore +
    caseItem.evaluation.spreadScore
  return Math.round((total / 4) * 10) / 10
}

export function buildIndicatorHealthFindings(stats: IndicatorHealthStat[]): IndicatorHealthFinding[] {
  return stats
    .map((stat) => {
      const reasons: string[] = []
      let severity: IndicatorHealthFinding['severity'] = 'low'

      if (stat.averageScore >= 90) {
        reasons.push(`평균 점수 ${stat.averageScore.toFixed(1)}점으로 과도하게 높습니다.`)
        severity = 'medium'
      }
      if (stat.perfectRate >= 0.5) {
        reasons.push(`만점률이 ${(stat.perfectRate * 100).toFixed(0)}%로 높습니다.`)
        severity = 'high'
      }
      if (stat.sampleCount >= 3 && stat.stddev <= 5) {
        reasons.push(`표준편차 ${stat.stddev.toFixed(1)}로 변별력이 낮습니다.`)
        severity = severity === 'high' ? 'high' : 'medium'
      }
      if (stat.duplicateReflectionRisk) {
        reasons.push('상위 목표/하위 목표에 중복 반영될 가능성이 있습니다.')
        severity = 'high'
      }
      if (stat.lowBaseRisk) {
        reasons.push('적용 대상 저변이 좁아 비교군 대표성이 낮습니다.')
        severity = severity === 'high' ? 'high' : 'medium'
      }

      if (!reasons.length) return null

      let recommendation = '유지'
      if (severity === 'high') recommendation = '비중 축소 또는 폐지 검토'
      else if (reasons.some((reason) => reason.includes('변별력'))) recommendation = '비중 조정 또는 보완'
      else recommendation = '비교군 이동 또는 보완'

      return {
        key: stat.key,
        indicatorName: stat.indicatorName,
        severity,
        reasons,
        recommendation,
      } satisfies IndicatorHealthFinding
    })
    .filter((item): item is IndicatorHealthFinding => item !== null)
}

export const PERFORMANCE_MILESTONE_LABELS: Record<PerformanceMilestoneKey, string> = {
  HANDBOOK_FINALIZED: '편람 확정',
  GOAL_FINALIZED: '목표 확정',
  MID_CHECK: '중간점검',
  QUALITATIVE_SUBMISSION: '비계량 제출',
  FINAL_EVALUATION: '최종평가',
  RESULT_FINALIZED: '결과 확정',
}

export const INDICATOR_SELECTION_LABELS: Record<IndicatorSelectionStatus, string> = {
  KEEP: '유지',
  HOLD: '유보',
  IMPROVE: '보완',
  DELETE: '삭제',
  NEW: '신규',
}
