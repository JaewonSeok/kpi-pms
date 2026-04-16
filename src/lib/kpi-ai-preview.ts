export type KpiAiPreviewSource = 'ai' | 'fallback' | 'disabled'

export type KpiAiPreviewTone = 'recommended' | 'warning' | 'review'

export type KpiAiPreviewComparison = {
  label: string
  before?: string | null
  after?: string | null
}

export type KpiAiPreviewMetric = {
  label: string
  value: string
}

export type KpiAiPreviewCriterion = {
  name: string
  status: string
  reason: string
  suggestion: string
}

export type KpiAiPreviewDuplicate = {
  title: string
  overlapLevel: string
  similarityReason: string
}

export type KpiAiPreviewWeightRecommendation = {
  title: string
  currentWeight: string
  recommendedWeight: string
  reason: string
}

export type KpiAiPreviewSection =
  | { kind: 'text'; key: string; title: string; body: string }
  | { kind: 'list'; key: string; title: string; items: string[] }
  | { kind: 'metrics'; key: string; title: string; items: KpiAiPreviewMetric[] }
  | { kind: 'criteria'; key: string; title: string; items: KpiAiPreviewCriterion[] }
  | { kind: 'duplicates'; key: string; title: string; items: KpiAiPreviewDuplicate[] }
  | { kind: 'weights'; key: string; title: string; items: KpiAiPreviewWeightRecommendation[] }

export type KpiAiPreviewDescriptor = {
  tone: KpiAiPreviewTone
  statusLabel: string
  summary: string
  recommendation: string
  sections: KpiAiPreviewSection[]
  comparisons: KpiAiPreviewComparison[]
}

type JsonRecord = Record<string, unknown>

const RESULT_LABELS: Record<string, string> = {
  rationale: '개선 근거',
  reviewPoints: '검토 포인트',
  managerReviewPoints: '관리자 검토 포인트',
  nextActions: '다음 액션',
  concerns: '주의사항',
  risks: '리스크',
  recommendations: '수정 권고안',
  watchouts: '주의 포인트',
  suggestedLinks: '연결 추천 포인트',
  alternatives: '대안',
  strengths: '강점',
  requests: '리뷰 요청 포인트',
  highlights: '핵심 요약',
  evaluationCriteria: '평가 기준',
  responsePoints: '응답 포인트',
  leaderPrep: '리더 준비 포인트',
  memberPrep: '구성원 준비 포인트',
  agenda: '체크인 안건',
  evaluationPoints: '평가 포인트',
  managerNotes: '관리자 메모',
  smartChecks: 'SMART 점검 결과',
}

function toRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function toNumberString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
  }

  if (typeof value === 'string' && value.trim().length) {
    return value.trim()
  }

  return null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => toStringValue(item)).filter((item): item is string => Boolean(item))
    : []
}

function toObjectArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map((item) => toRecord(item)).filter((item): item is JsonRecord => Boolean(item))
    : []
}

function normalizeStatus(status: string | null | undefined) {
  const value = String(status ?? '').toUpperCase()
  if (['GOOD', 'PASS', 'LOW', 'RECOMMENDED', 'ADEQUATE'].includes(value)) return 'recommended'
  if (['WARNING', 'WARN', 'MEDIUM', 'CAUTION'].includes(value)) return 'warning'
  if (['CRITICAL', 'FAIL', 'HIGH', 'REVIEW', 'INSUFFICIENT'].includes(value)) return 'review'
  return null
}

function dedupeComparisons(items: KpiAiPreviewComparison[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const before = item.before?.trim() ?? ''
    const after = item.after?.trim() ?? ''
    if (!after || before === after) return false
    const key = `${item.label}:${before}:${after}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildTargetMetrics(record: JsonRecord): KpiAiPreviewMetric[] {
  const items: KpiAiPreviewMetric[] = []
  const targetT = toNumberString(record.targetValueT)
  const targetE = toNumberString(record.targetValueE ?? record.targetValueSuggestion)
  const targetS = toNumberString(record.targetValueS)
  const unit = toStringValue(record.unit ?? record.unitSuggestion)
  const weight = toNumberString(record.weightSuggestion)
  const difficulty = toStringValue(record.difficultySuggestion)

  if (targetT) items.push({ label: 'T 목표값', value: targetT })
  if (targetE) items.push({ label: 'E 목표값', value: targetE })
  if (targetS) items.push({ label: 'S 목표값', value: targetS })
  if (!targetT && !targetE && !targetS) {
    const targetValue = toNumberString(record.targetValueSuggestion)
    if (targetValue) items.push({ label: '목표값', value: targetValue })
  }

  if (unit) items.push({ label: '단위', value: unit })
  if (weight) items.push({ label: '권장 가중치', value: `${weight}%` })
  if (difficulty) items.push({ label: '난이도', value: difficulty })

  return items
}

function buildCriteria(items: JsonRecord[]): KpiAiPreviewCriterion[] {
  return items
    .map((item) => {
      const name = toStringValue(item.name)
      const status = toStringValue(item.status)
      const reason = toStringValue(item.reason)
      const suggestion = toStringValue(item.suggestion)
      if (!name || !status || !reason) return null
      return {
        name,
        status,
        reason,
        suggestion: suggestion ?? '구체적인 수정 권고안은 제공되지 않았습니다.',
      }
    })
    .filter((item): item is KpiAiPreviewCriterion => Boolean(item))
}

function buildDuplicates(items: JsonRecord[]): KpiAiPreviewDuplicate[] {
  return items
    .map((item) => {
      const title = toStringValue(item.title)
      const overlapLevel = toStringValue(item.overlapLevel)
      const similarityReason = toStringValue(item.similarityReason)
      if (!title || !overlapLevel || !similarityReason) return null
      return { title, overlapLevel, similarityReason }
    })
    .filter((item): item is KpiAiPreviewDuplicate => Boolean(item))
}

function buildWeightRecommendations(items: JsonRecord[]): KpiAiPreviewWeightRecommendation[] {
  return items
    .map((item) => {
      const title = toStringValue(item.title)
      const currentWeight = toNumberString(item.currentWeight)
      const recommendedWeight = toNumberString(item.recommendedWeight)
      const reason = toStringValue(item.reason)
      if (!title || !currentWeight || !recommendedWeight || !reason) return null
      return { title, currentWeight, recommendedWeight, reason }
    })
    .filter((item): item is KpiAiPreviewWeightRecommendation => Boolean(item))
}

export function inferKpiAiPreviewTone(
  action: string,
  result: Record<string, unknown>,
  source: KpiAiPreviewSource,
): KpiAiPreviewTone {
  if (source !== 'ai') {
    return 'warning'
  }

  const record = toRecord(result) ?? {}
  const directTone =
    normalizeStatus(toStringValue(record.overall)) ??
    normalizeStatus(toStringValue(record.riskLevel)) ??
    normalizeStatus(toStringValue(record.verdict))

  if (directTone) {
    return directTone
  }

  const criteriaTone = buildCriteria(toObjectArray(record.criteria)).reduce<KpiAiPreviewTone | null>((tone, item) => {
    const next = normalizeStatus(item.status)
    if (next === 'review') return 'review'
    if (next === 'warning') return tone === 'review' ? tone : 'warning'
    return tone
  }, null)

  if (criteriaTone) {
    return criteriaTone
  }

  const duplicates = buildDuplicates(toObjectArray(record.duplicates))
  if (duplicates.some((item) => item.overlapLevel.toUpperCase() === 'HIGH')) {
    return 'review'
  }
  if (duplicates.some((item) => item.overlapLevel.toUpperCase() === 'MEDIUM')) {
    return 'warning'
  }

  if (action.includes('smart') || action.includes('duplicate') || action.includes('risk')) {
    return 'warning'
  }

  return 'recommended'
}

export function buildKpiAiPreviewSummary(action: string, result: Record<string, unknown>): string {
  const record = toRecord(result) ?? {}

  if (action.includes('improve') || record.improvedTitle || record.improvedDefinition) {
    return 'KPI명, 정의, 산식처럼 실제 문구가 바뀌는 부분을 빠르게 비교할 수 있도록 정리했습니다.'
  }

  if (action.includes('smart') || record.criteria) {
    return 'SMART 기준별 진단 결과와 보완 제안을 실무 검토 문서처럼 읽기 쉽게 정리했습니다.'
  }

  if (action.includes('duplicate') || record.duplicates) {
    return '중복되거나 유사한 KPI 후보와 그 근거를 비교하기 쉽게 정리했습니다.'
  }

  if (action.includes('alignment') || record.recommendedParentTitle || record.recommendedOrgKpiTitle) {
    return '상위 KPI와의 연결 방향, 정렬 포인트를 빠르게 확인할 수 있도록 정리했습니다.'
  }

  if (action.includes('risk') || record.executiveSummary || record.causeSummary) {
    return '리스크 요인과 검토 포인트를 실무자가 바로 읽을 수 있는 형태로 요약했습니다.'
  }

  if (action.includes('weight') || record.recommendations) {
    return '가중치 조정안과 그 근거를 검토 문서 형태로 정리했습니다.'
  }

  return 'AI 제안의 핵심 내용과 적용 전 검토 포인트를 한 화면에서 읽기 쉽게 정리했습니다.'
}

export function buildKpiAiPreviewRecommendation(action: string, tone: KpiAiPreviewTone): string {
  if (tone === 'review') {
    return '주의사항과 검토 포인트를 먼저 확인한 뒤, 필요한 항목만 선택적으로 적용해 주세요.'
  }

  if (action.includes('smart') || action.includes('duplicate') || action.includes('risk') || action.includes('alignment')) {
    return '진단 결과를 확인하고 필요한 수정 방향만 반영하는 것을 권장합니다.'
  }

  return '변경 내용을 미리보기로 확인한 뒤 적용 여부를 결정해 주세요.'
}

export function buildKpiAiPreviewSections(_action: string, result: Record<string, unknown>): KpiAiPreviewSection[] {
  const record = toRecord(result) ?? {}
  const sections: KpiAiPreviewSection[] = []
  const consumed = new Set<string>()

  const addText = (key: string, title: string, value: unknown) => {
    const body = toStringValue(value)
    if (!body) return
    consumed.add(key)
    sections.push({ kind: 'text', key, title, body })
  }

  const addList = (key: string, title: string, value: unknown) => {
    const items = toStringArray(value)
    if (!items.length) return
    consumed.add(key)
    sections.push({ kind: 'list', key, title, items })
  }

  const targetMetrics = buildTargetMetrics(record)
  if (targetMetrics.length) {
    consumed.add('targetValueSuggestion')
    consumed.add('targetValueT')
    consumed.add('targetValueE')
    consumed.add('targetValueS')
    consumed.add('unit')
    consumed.add('unitSuggestion')
    consumed.add('weightSuggestion')
    consumed.add('difficultySuggestion')
    sections.push({ kind: 'metrics', key: 'suggested-metrics', title: '제안된 목표값', items: targetMetrics })
  }

  addText('title', 'KPI명 제안', record.improvedTitle ?? record.title ?? record.kpiName)
  addText('definition', '정의', record.improvedDefinition ?? record.definition)
  addText('formula', '산식', record.formula)

  const summaryText =
    record.executiveSummary ??
    record.summary ??
    record.comment ??
    record.causeSummary

  addText('summary', '결과 요약', summaryText)

  addList('rationale', RESULT_LABELS.rationale, record.rationale)
  addList('smartChecks', RESULT_LABELS.smartChecks, record.smartChecks)
  addList('reviewPoints', RESULT_LABELS.reviewPoints, record.reviewPoints)
  addList('managerReviewPoints', RESULT_LABELS.managerReviewPoints, record.managerReviewPoints)
  addList('evaluationCriteria', RESULT_LABELS.evaluationCriteria, record.evaluationCriteria)
  addList('highlights', RESULT_LABELS.highlights, record.highlights)
  addList('concerns', RESULT_LABELS.concerns, record.concerns)
  addList('nextActions', RESULT_LABELS.nextActions, record.nextActions)
  addList('risks', RESULT_LABELS.risks, record.risks)
  addList('recommendations', RESULT_LABELS.recommendations, record.recommendations)
  addList('watchouts', RESULT_LABELS.watchouts, record.watchouts)
  addList('suggestedLinks', RESULT_LABELS.suggestedLinks, record.suggestedLinks)
  addList('alternatives', RESULT_LABELS.alternatives, record.alternatives)
  addList('strengths', RESULT_LABELS.strengths, record.strengths)
  addList('requests', RESULT_LABELS.requests, record.requests)
  addList('responsePoints', RESULT_LABELS.responsePoints, record.responsePoints)
  addList('agenda', RESULT_LABELS.agenda, record.agenda)
  addList('leaderPrep', RESULT_LABELS.leaderPrep, record.leaderPrep)
  addList('memberPrep', RESULT_LABELS.memberPrep, record.memberPrep)
  addList('evaluationPoints', RESULT_LABELS.evaluationPoints, record.evaluationPoints)
  addList('managerNotes', RESULT_LABELS.managerNotes, record.managerNotes)

  const criteria = buildCriteria(toObjectArray(record.criteria))
  if (criteria.length) {
    consumed.add('criteria')
    sections.push({ kind: 'criteria', key: 'criteria', title: 'SMART 점검 결과', items: criteria })
  }

  const duplicates = buildDuplicates(toObjectArray(record.duplicates))
  if (duplicates.length) {
    consumed.add('duplicates')
    sections.push({ kind: 'duplicates', key: 'duplicates', title: '중복/유사 KPI 후보', items: duplicates })
  }

  const weights = buildWeightRecommendations(toObjectArray(record.recommendations))
  if (weights.length) {
    consumed.add('recommendations')
    sections.push({ kind: 'weights', key: 'weights', title: '가중치 조정안', items: weights })
  }

  Object.entries(record).forEach(([key, value]) => {
    if (consumed.has(key)) return

    const textValue = toStringValue(value)
    if (textValue) {
      sections.push({
        kind: 'text',
        key,
        title: RESULT_LABELS[key] ?? key,
        body: textValue,
      })
      return
    }

    const listItems = toStringArray(value)
    if (listItems.length) {
      sections.push({
        kind: 'list',
        key,
        title: RESULT_LABELS[key] ?? key,
        items: listItems,
      })
    }
  })

  return sections
}

export function buildKpiAiPreviewDescriptor(params: {
  action: string
  result: Record<string, unknown>
  source: KpiAiPreviewSource
  comparisons?: KpiAiPreviewComparison[]
}): KpiAiPreviewDescriptor {
  const tone = inferKpiAiPreviewTone(params.action, params.result, params.source)
  const statusLabel = tone === 'recommended' ? '추천' : tone === 'warning' ? '주의' : '검토 필요'

  return {
    tone,
    statusLabel,
    summary: buildKpiAiPreviewSummary(params.action, params.result),
    recommendation: buildKpiAiPreviewRecommendation(params.action, tone),
    sections: buildKpiAiPreviewSections(params.action, params.result),
    comparisons: dedupeComparisons(params.comparisons ?? []),
  }
}
