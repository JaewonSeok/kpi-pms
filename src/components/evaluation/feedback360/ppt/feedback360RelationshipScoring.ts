'use client'

export type Feedback360ReviewerSearchFilter =
  | 'ALL'
  | 'SAME_TEAM'
  | 'SAME_DIVISION'
  | 'CROSS_DIVISION'
  | 'KPI_TOUCHPOINT'
  | 'RECENT_COLLABORATION'
  | 'SELECTED'
  | 'NEEDS_REVIEW'

export type Feedback360ReviewerCandidate = {
  employeeId: string
  name: string
  relationship: string
  department: string
  division?: string | null
  team?: string | null
  title?: string | null
  managerEmployeeId?: string | null
  email?: string | null
  profileImageUrl?: string | null
  groupKey: string
  groupLabel: string
  selectable: boolean
  disabledReason?: string | null
}

export type Feedback360RelationshipUploadRow = {
  rowNumber: number
  employeeId: string
  name: string
  division: string
  department: string
  team: string
  title: string
  managerEmployeeId: string
  collaboratorEmployeeId: string
  relationType: string
  projectCode: string
  kpiCode: string
  collaborationCount: number | null
  checkinCount: number | null
  monthlyWorkCount: number | null
  lastWorkedAt: string
  manualRelationScore: number | null
  note: string
  errors: string[]
  warnings: string[]
  validationStatus: 'valid' | 'needs_review' | 'error'
}

export type Feedback360ScoredReviewerCandidate = Feedback360ReviewerCandidate & {
  candidateId: string
  relationLabel: string
  score: number
  relationshipScore: number
  reasons: string[]
  sources: string[]
  relationshipScoreSources: string[]
  relationshipRationale: string
  sourceChips: string[]
  slotRecommendation: 'SAME_TEAM' | 'SAME_DIVISION' | 'CROSS_DIVISION' | 'NEEDS_REVIEW'
  isAlreadySelected: boolean
  isSelf: boolean
  isExcluded: boolean
  exclusionReason?: string | null
}

export type Feedback360RecommendationSlot = {
  key: string
  label: string
  shortageLabel: string
  reviewer?: Feedback360ScoredReviewerCandidate
  selected: boolean
}

export const RELATIONSHIP_TEMPLATE_FIELD_KEYS = [
  'employeeId',
  'name',
  'division',
  'department',
  'team',
  'title',
  'managerEmployeeId',
  'collaboratorEmployeeId',
  'relationType',
  'projectCode',
  'kpiCode',
  'collaborationCount',
  'checkinCount',
  'monthlyWorkCount',
  'lastWorkedAt',
  'manualRelationScore',
  'note',
] as const

export type RelationshipTemplateFieldKey = (typeof RELATIONSHIP_TEMPLATE_FIELD_KEYS)[number]

export const RELATIONSHIP_TEMPLATE_COLUMNS = [
  '사번',
  '성명',
  '본부',
  '실/부서',
  '팀',
  '직책',
  '상위관리자사번',
  '협업자사번',
  '관계유형',
  '프로젝트코드',
  'KPI코드',
  '협업횟수',
  '체크인횟수',
  '월간업무건수',
  '최근협업일',
  '수동관계점수',
  '비고',
] as const

export const RELATIONSHIP_UPLOAD_HEADER_ALIASES: Record<RelationshipTemplateFieldKey, readonly string[]> = {
  employeeId: ['사번', 'employeeId', 'employee_id', 'empId', 'emp_id'],
  name: ['성명', 'name', 'employeeName', 'employee_name'],
  division: ['본부', 'division', 'divisionName', 'division_name'],
  department: ['실/부서', '부서', 'department', 'departmentName', 'department_name'],
  team: ['팀', 'team', 'teamName', 'team_name'],
  title: ['직책', 'title', 'position', 'jobTitle', 'job_title'],
  managerEmployeeId: ['상위관리자사번', 'managerEmployeeId', 'manager_employee_id', 'managerId', 'manager_id'],
  collaboratorEmployeeId: [
    '협업자사번',
    'collaboratorEmployeeId',
    'collaborator_employee_id',
    'collaboratorId',
    'collaborator_id',
    'reviewerEmployeeId',
    'reviewer_employee_id',
  ],
  relationType: ['관계유형', 'relationType', 'relation_type', 'relationshipType', 'relationship_type'],
  projectCode: ['프로젝트코드', 'projectCode', 'project_code'],
  kpiCode: ['KPI코드', 'kpiCode', 'kpi_code'],
  collaborationCount: ['협업횟수', 'collaborationCount', 'collaboration_count'],
  checkinCount: ['체크인횟수', 'checkinCount', 'checkin_count'],
  monthlyWorkCount: ['월간업무건수', 'monthlyWorkCount', 'monthly_work_count'],
  lastWorkedAt: ['최근협업일', 'lastWorkedAt', 'last_worked_at'],
  manualRelationScore: ['수동관계점수', 'manualRelationScore', 'manual_relation_score'],
  note: ['비고', 'note', 'memo'],
}

export const RELATIONSHIP_TEMPLATE_SAMPLE_ROW = [
  'EMP001',
  '홍길동',
  '경영지원본부',
  '인사팀',
  '인사기획팀',
  '구성원',
  'EMP010',
  'EMP020',
  '프로젝트',
  'PRJ-EXAMPLE',
  'KPI-EXAMPLE',
  '4',
  '2',
  '3',
  '2026-06-01',
  '82',
  '최근 협업 이력이 많아 추천 근거로 활용',
] as const

export const RELATIONSHIP_UPLOAD_ALLOWED_TYPES = new Set([
  'TEAM',
  'DIVISION',
  'OTHER_DIVISION',
  'PROJECT',
  'KPI',
  'RECENT_COLLAB',
  'MANAGER',
])

const RELATIONSHIP_UPLOAD_KOREAN_TYPES: Record<string, string> = {
  '같은 팀': 'TEAM',
  '같은팀': 'TEAM',
  '팀': 'TEAM',
  '같은 본부': 'DIVISION',
  '같은본부': 'DIVISION',
  '본부': 'DIVISION',
  '타 본부': 'OTHER_DIVISION',
  '타본부': 'OTHER_DIVISION',
  '다른 본부': 'OTHER_DIVISION',
  '상사': 'MANAGER',
  '관리자': 'MANAGER',
  '프로젝트': 'PROJECT',
  '프로젝트 접점': 'PROJECT',
  'KPI': 'KPI',
  'KPI 접점': 'KPI',
  '최근 협업': 'RECENT_COLLAB',
  '최근협업': 'RECENT_COLLAB',
}

export const REVIEWER_SEARCH_FILTERS: Array<{ value: Feedback360ReviewerSearchFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'SAME_TEAM', label: '같은 팀' },
  { value: 'SAME_DIVISION', label: '같은 본부' },
  { value: 'CROSS_DIVISION', label: '타 본부' },
  { value: 'KPI_TOUCHPOINT', label: '프로젝트/KPI 접점' },
  { value: 'RECENT_COLLABORATION', label: '최근 협업' },
  { value: 'SELECTED', label: '이미 선택됨' },
  { value: 'NEEDS_REVIEW', label: '후보 부족/검토 필요' },
]

const RELATIONSHIP_LABELS: Record<string, string> = {
  SELF: '본인',
  SUPERVISOR: '상사',
  PEER: '동료',
  SUBORDINATE: '팀원',
  CROSS_TEAM_PEER: '타팀 동료',
  CROSS_DEPT: '타부서',
}

export function getRelationshipLabel(relationship: string) {
  return RELATIONSHIP_LABELS[relationship] ?? '관계 확인 필요'
}

export function getUploadRelationTypeLabel(value?: string | null) {
  switch (value) {
    case 'TEAM':
      return '같은 팀'
    case 'DIVISION':
      return '같은 본부'
    case 'OTHER_DIVISION':
      return '타 본부'
    case 'MANAGER':
      return '상사'
    case 'PROJECT':
      return '프로젝트 접점'
    case 'KPI':
      return 'KPI 접점'
    case 'RECENT_COLLAB':
      return '최근 협업'
    default:
      return '관계 유형 확인'
  }
}

export function normalizeReviewerSearchText(value?: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

export function getRelationshipPriority(relationship: string) {
  switch (relationship) {
    case 'SELF':
      return 0
    case 'SUPERVISOR':
      return 1
    case 'SUBORDINATE':
      return 2
    case 'PEER':
      return 3
    case 'CROSS_TEAM_PEER':
      return 4
    case 'CROSS_DEPT':
      return 5
    default:
      return 9
  }
}

function escapeCsvValue(value: string) {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

export function buildRelationshipTemplateCsv() {
  return `\uFEFF${[
    RELATIONSHIP_TEMPLATE_COLUMNS.join(','),
    RELATIONSHIP_TEMPLATE_SAMPLE_ROW.map(escapeCsvValue).join(','),
  ].join('\r\n')}`
}

function splitCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function getRelationshipUploadCell(data: Record<string, string>, key: RelationshipTemplateFieldKey) {
  for (const alias of RELATIONSHIP_UPLOAD_HEADER_ALIASES[key]) {
    const value = data[alias]
    if (value != null) return String(value).trim()
  }
  return ''
}

function normalizeRelationshipUploadType(value: string) {
  const normalized = value.trim()
  if (!normalized) return ''
  const upper = normalized.toUpperCase()
  if (RELATIONSHIP_UPLOAD_ALLOWED_TYPES.has(upper)) return upper
  return RELATIONSHIP_UPLOAD_KOREAN_TYPES[normalized] ?? RELATIONSHIP_UPLOAD_KOREAN_TYPES[normalized.replace(/\s+/g, '')] ?? upper
}

function normalizeRelationshipUploadDate(value: string) {
  const trimmed = value.trim()
  const formulaMatch = trimmed.match(/^="?([^"]+)"?$/)
  return formulaMatch?.[1] ?? trimmed
}

export function parseRelationshipUploadCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) {
    return { rows: [] as Feedback360RelationshipUploadRow[], errors: ['업로드할 CSV 행이 없습니다.'] }
  }

  const headers = splitCsvLine(lines[0])
  const missingColumns = RELATIONSHIP_TEMPLATE_FIELD_KEYS.filter((key) =>
    RELATIONSHIP_UPLOAD_HEADER_ALIASES[key].every((alias) => !headers.includes(alias))
  ).map((key) => RELATIONSHIP_UPLOAD_HEADER_ALIASES[key][0])
  const globalErrors = missingColumns.length
    ? [`필수 컬럼이 없습니다: ${missingColumns.join(', ')}`]
    : []
  const rows = lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line)
    const data = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    const employeeId = getRelationshipUploadCell(data, 'employeeId')
    const managerEmployeeId = getRelationshipUploadCell(data, 'managerEmployeeId')
    const collaboratorEmployeeId = getRelationshipUploadCell(data, 'collaboratorEmployeeId')
    const manualRelationScore = parseOptionalNumber(getRelationshipUploadCell(data, 'manualRelationScore'))
    const collaborationCount = parseOptionalNumber(getRelationshipUploadCell(data, 'collaborationCount'))
    const checkinCount = parseOptionalNumber(getRelationshipUploadCell(data, 'checkinCount'))
    const monthlyWorkCount = parseOptionalNumber(getRelationshipUploadCell(data, 'monthlyWorkCount'))
    const relationType = normalizeRelationshipUploadType(getRelationshipUploadCell(data, 'relationType'))
    const errors: string[] = []
    const warnings: string[] = []

    if (!employeeId) errors.push('사번 누락')
    if (!collaboratorEmployeeId) errors.push('협업자사번 누락')
    if (!collaboratorEmployeeId && !managerEmployeeId) {
      errors.push('상위관리자사번 또는 협업자사번 둘 다 누락')
    }
    if (relationType && !RELATIONSHIP_UPLOAD_ALLOWED_TYPES.has(relationType)) {
      errors.push('알 수 없는 관계유형')
    }
    if (!relationType) {
      warnings.push('관계유형 확인 필요')
    }
    if (Number.isNaN(manualRelationScore) || (manualRelationScore != null && (manualRelationScore < 0 || manualRelationScore > 100))) {
      errors.push('수동관계점수 범위 오류')
    }
    const lastWorkedAt = normalizeRelationshipUploadDate(getRelationshipUploadCell(data, 'lastWorkedAt'))
    if (lastWorkedAt && Number.isNaN(Date.parse(lastWorkedAt))) {
      warnings.push('최근협업일 형식 확인 필요')
    }
    const hasOrganizationHint = Boolean(
      getRelationshipUploadCell(data, 'division') ||
        getRelationshipUploadCell(data, 'department') ||
        getRelationshipUploadCell(data, 'team')
    )
    if (!hasOrganizationHint) {
      warnings.push('조직 매칭 확인 필요')
    }
    const validationStatus: Feedback360RelationshipUploadRow['validationStatus'] = errors.length
      ? 'error'
      : warnings.length
        ? 'needs_review'
        : 'valid'

    return {
      rowNumber: rowIndex + 2,
      employeeId,
      name: getRelationshipUploadCell(data, 'name'),
      division: getRelationshipUploadCell(data, 'division'),
      department: getRelationshipUploadCell(data, 'department'),
      team: getRelationshipUploadCell(data, 'team'),
      title: getRelationshipUploadCell(data, 'title'),
      managerEmployeeId,
      collaboratorEmployeeId,
      relationType,
      projectCode: getRelationshipUploadCell(data, 'projectCode'),
      kpiCode: getRelationshipUploadCell(data, 'kpiCode'),
      collaborationCount: Number.isNaN(collaborationCount) ? null : collaborationCount,
      checkinCount: Number.isNaN(checkinCount) ? null : checkinCount,
      monthlyWorkCount: Number.isNaN(monthlyWorkCount) ? null : monthlyWorkCount,
      lastWorkedAt,
      manualRelationScore: Number.isNaN(manualRelationScore) ? null : manualRelationScore,
      note: getRelationshipUploadCell(data, 'note'),
      errors,
      warnings,
      validationStatus,
    }
  })

  return { rows, errors: globalErrors }
}

function getRelationshipUploadEvidence(
  reviewer: Feedback360ReviewerCandidate,
  targetEmployeeId: string,
  rows: Feedback360RelationshipUploadRow[]
) {
  return rows.filter((row) => {
    if (row.errors.length) return false

    const rowEmployeeIds = [row.employeeId, row.collaboratorEmployeeId, row.managerEmployeeId].filter(Boolean)
    return rowEmployeeIds.includes(reviewer.employeeId) && rowEmployeeIds.includes(targetEmployeeId)
  })
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeManualScore(value: number) {
  return Math.max(0, Math.min(30, Math.round((Math.max(0, Math.min(100, value)) / 100) * 30)))
}

export function scoreReviewerCandidate(params: {
  reviewer: Feedback360ReviewerCandidate
  target: { id: string; department: string; division?: string | null; team?: string | null }
  relationshipRows: Feedback360RelationshipUploadRow[]
  selectedReviewerIds: Set<string>
}): Feedback360ScoredReviewerCandidate {
  const { reviewer, target, relationshipRows, selectedReviewerIds } = params
  let score = 0
  const reasons: string[] = []
  const sources: string[] = []
  const sourceChips: string[] = []
  const sameDepartment = reviewer.department === target.department
  const sameTeam = Boolean(reviewer.team && target.team && reviewer.team === target.team)
  const evidenceRows = getRelationshipUploadEvidence(reviewer, target.id, relationshipRows)
  const isSelf = reviewer.employeeId === target.id || reviewer.relationship === 'SELF'
  const isAlreadySelected = selectedReviewerIds.has(reviewer.employeeId)
  let isExcluded = !reviewer.selectable || isSelf
  let exclusionReason = reviewer.disabledReason ?? null

  if (isSelf) {
    isExcluded = true
    exclusionReason = '본인은 평가자 후보에서 제외합니다.'
    reasons.push('본인 응답 기준')
    sources.push('조직 정보')
    sourceChips.push('본인')
  } else {
    if (sameTeam && reviewer.relationship === 'PEER') {
      score += 35
      reasons.push('같은 팀에서 함께 일한 후보입니다.')
      sources.push('조직 정보: 같은 팀')
      sourceChips.push('같은 팀')
    } else if (sameDepartment) {
      score += 20
      reasons.push('같은 본부/부서 안의 업무 맥락이 있습니다.')
      sources.push('조직 정보: 같은 본부')
      sourceChips.push('같은 본부')
    } else {
      score += 15
      reasons.push('다른 본부 후보로 교차 협업 관점 확인이 가능합니다.')
      sources.push('조직 정보: 타 본부')
      sourceChips.push('타 본부')
    }

    if (reviewer.relationship === 'SUPERVISOR') {
      score += 30
      reasons.push('직접 상사 또는 상위 평가권자입니다.')
      sources.push('관리 관계')
      sourceChips.push('상사')
    }
    if (reviewer.relationship === 'SUBORDINATE') {
      score += 25
      reasons.push('팀원 관점에서 리더십과 협업 방식을 확인할 수 있습니다.')
      sources.push('팀원 관계')
      sourceChips.push('팀원')
    }
  }

  for (const row of evidenceRows) {
    if (row.relationType === 'PROJECT') {
      score += 25
      reasons.push('업로드된 프로젝트 접점이 있습니다.')
      sources.push('프로젝트/KPI 접점')
      sourceChips.push('프로젝트')
    }
    if (row.relationType === 'KPI') {
      score += 25
      reasons.push('업로드된 KPI 접점이 있습니다.')
      sources.push('프로젝트/KPI 접점')
      sourceChips.push('KPI')
    }
    if (row.relationType === 'RECENT_COLLAB') {
      score += 20
      reasons.push('최근 협업 이력이 업로드되었습니다.')
      sources.push('최근 협업')
      sourceChips.push('최근 협업')
    }
    if (row.relationType === 'TEAM') {
      score += 15
      sources.push('업로드 관계 데이터: 같은 팀')
      sourceChips.push('업로드 같은 팀')
    }
    if (row.relationType === 'DIVISION') {
      score += 10
      sources.push('업로드 관계 데이터: 같은 본부')
      sourceChips.push('업로드 같은 본부')
    }
    if (row.relationType === 'OTHER_DIVISION') {
      score += 10
      sources.push('업로드 관계 데이터: 타 본부')
      sourceChips.push('업로드 타 본부')
    }
    if (row.manualRelationScore != null) {
      score += normalizeManualScore(row.manualRelationScore)
      sources.push('업로드 관계 데이터: 수동 관계 점수')
      sourceChips.push('수동 점수')
    }
    if ((row.collaborationCount ?? 0) > 0 || (row.checkinCount ?? 0) > 0 || (row.monthlyWorkCount ?? 0) > 0) {
      score += Math.min(20, (row.collaborationCount ?? 0) * 2 + (row.checkinCount ?? 0) * 3 + (row.monthlyWorkCount ?? 0) * 2)
      reasons.push('협업횟수, 체크인, 월간업무건수 근거가 있습니다.')
      sources.push('최근 협업')
      sourceChips.push('협업 기록')
    }
  }

  const relationshipScore = isSelf ? 0 : Math.max(0, Math.min(100, Math.round(score)))
  const uniqueSources = unique(sources)
  const uniqueReasons = unique(reasons)
  const relationshipRationale = uniqueReasons.length
    ? uniqueReasons.slice(0, 3).join(' ')
    : '실제 후보 데이터가 부족해 기본 조직 정보만 확인했습니다.'
  const peerSlotEligible = reviewer.relationship !== 'SUPERVISOR' && reviewer.relationship !== 'SUBORDINATE'
  const sameTeamForSlot =
    peerSlotEligible && reviewer.relationship === 'PEER' && (sameTeam || (!reviewer.team && !target.team && sameDepartment))
  const slotRecommendation =
    !peerSlotEligible || isExcluded
      ? 'NEEDS_REVIEW'
      : sameTeamForSlot
        ? 'SAME_TEAM'
        : sameDepartment
          ? 'SAME_DIVISION'
          : 'CROSS_DIVISION'

  return {
    ...reviewer,
    candidateId: reviewer.employeeId,
    relationLabel: getRelationshipLabel(reviewer.relationship),
    score: relationshipScore,
    relationshipScore,
    reasons: uniqueReasons,
    sources: uniqueSources,
    relationshipScoreSources: uniqueSources,
    relationshipRationale,
    sourceChips: unique(sourceChips),
    slotRecommendation,
    isAlreadySelected,
    isSelf,
    isExcluded,
    exclusionReason,
  }
}

export function scoreReviewerCandidates(params: {
  reviewers: Feedback360ReviewerCandidate[]
  target: { id: string; department: string; division?: string | null; team?: string | null }
  relationshipRows: Feedback360RelationshipUploadRow[]
  selectedReviewerIds: Set<string>
}) {
  return params.reviewers
    .map((reviewer) =>
      scoreReviewerCandidate({
        reviewer,
        target: params.target,
        relationshipRows: params.relationshipRows,
        selectedReviewerIds: params.selectedReviewerIds,
      })
    )
    .sort((left, right) => right.relationshipScore - left.relationshipScore || left.name.localeCompare(right.name, 'ko'))
}

export function matchesReviewerSearchFilter(
  reviewer: Feedback360ScoredReviewerCandidate,
  filter: Feedback360ReviewerSearchFilter
) {
  switch (filter) {
    case 'SAME_TEAM':
      return reviewer.slotRecommendation === 'SAME_TEAM'
    case 'SAME_DIVISION':
      return reviewer.slotRecommendation === 'SAME_DIVISION'
    case 'CROSS_DIVISION':
      return reviewer.slotRecommendation === 'CROSS_DIVISION'
    case 'KPI_TOUCHPOINT':
      return reviewer.relationshipScoreSources.some((source) => source.includes('프로젝트/KPI'))
    case 'RECENT_COLLABORATION':
      return reviewer.relationshipScoreSources.some((source) => source.includes('최근 협업'))
    case 'SELECTED':
      return reviewer.isAlreadySelected
    case 'NEEDS_REVIEW':
      return reviewer.isExcluded || reviewer.relationshipScore < 30 || reviewer.relationshipScoreSources.length <= 1
    default:
      return !reviewer.isSelf
  }
}

export function buildFeedback360RecommendationSlots(params: {
  scoredReviewers: Feedback360ScoredReviewerCandidate[]
  selectedReviewers: Feedback360ScoredReviewerCandidate[]
}): Feedback360RecommendationSlot[] {
  const usedReviewerIds = new Set<string>()
  const selectedByRule = (predicate: (reviewer: Feedback360ScoredReviewerCandidate) => boolean) =>
    params.selectedReviewers.find((reviewer) => !usedReviewerIds.has(reviewer.employeeId) && predicate(reviewer))
  const candidateByRule = (predicate: (reviewer: Feedback360ScoredReviewerCandidate) => boolean) =>
    params.scoredReviewers.find(
      (reviewer) =>
        reviewer.selectable &&
        !reviewer.isExcluded &&
        !reviewer.isAlreadySelected &&
        !usedReviewerIds.has(reviewer.employeeId) &&
        predicate(reviewer)
    )
  const pickSlot = (
    key: string,
    label: string,
    shortageLabel: string,
    predicate: (reviewer: Feedback360ScoredReviewerCandidate) => boolean
  ) => {
    const selected = selectedByRule(predicate)
    const reviewer = selected ?? candidateByRule(predicate)
    if (reviewer) usedReviewerIds.add(reviewer.employeeId)

    return {
      key,
      label,
      shortageLabel,
      reviewer,
      selected: Boolean(selected),
    }
  }

  return [
    pickSlot('same-team-1', '같은 팀 1명', '같은 팀 추천 후보 부족', (reviewer) => reviewer.slotRecommendation === 'SAME_TEAM'),
    pickSlot(
      'same-division-1',
      '같은 본부 1명',
      '같은 본부 추천 후보 부족',
      (reviewer) => reviewer.slotRecommendation === 'SAME_DIVISION'
    ),
    pickSlot(
      'same-division-2',
      '같은 본부 2명',
      '같은 본부 추천 후보 부족',
      (reviewer) => reviewer.slotRecommendation === 'SAME_DIVISION'
    ),
    pickSlot(
      'cross-division-1',
      '타 본부 1명',
      '타 본부 추천 후보 부족',
      (reviewer) => reviewer.slotRecommendation === 'CROSS_DIVISION'
    ),
    pickSlot(
      'cross-division-2',
      '타 본부 2명',
      '타 본부 추천 후보 부족',
      (reviewer) => reviewer.slotRecommendation === 'CROSS_DIVISION'
    ),
  ]
}
