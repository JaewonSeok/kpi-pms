'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, CheckCircle2, Search } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import { Feedback360RelationshipTemplatePanel } from './ppt/Feedback360RelationshipTemplatePanel'
import { Feedback360VisibilitySettings } from './ppt/Feedback360VisibilitySettings'
import { Feedback360Avatar } from './ppt/Feedback360Avatar'

type NominationData = NonNullable<Feedback360PageData['nomination']>

type ReviewerDraft = {
  employeeId: string
  name: string
  relationship: string
  profileImageUrl?: string | null
  rationale?: string
  fitScore?: number
}

type ReviewerCandidateSummary = {
  employeeId: string
  name: string
  relationship: string
  department: string
  profileImageUrl?: string | null
  groupKey: string
  groupLabel: string
  selectable: boolean
  disabledReason?: string | null
}

type ScoredReviewerCandidate = ReviewerCandidateSummary & {
  relationshipScore: number
  relationshipScoreSources: string[]
  relationshipRationale: string
}

type AiPreview = {
  source: 'ai' | 'fallback' | 'disabled'
  fallbackReason?: string | null
  result: {
    recommendations?: ReviewerDraft[]
    rationale?: string
    watchouts?: string[]
  }
}

type ReviewerSearchFilter =
  | 'ALL'
  | 'SAME_TEAM'
  | 'SAME_DIVISION'
  | 'CROSS_DIVISION'
  | 'KPI_TOUCHPOINT'
  | 'RECENT_COLLABORATION'

type RelationshipUploadRow = {
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
}

const RELATIONSHIP_TEMPLATE_FIELD_KEYS = [
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

type RelationshipTemplateFieldKey = (typeof RELATIONSHIP_TEMPLATE_FIELD_KEYS)[number]

const RELATIONSHIP_TEMPLATE_COLUMNS = [
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

const RELATIONSHIP_UPLOAD_HEADER_ALIASES: Record<RelationshipTemplateFieldKey, readonly string[]> = {
  employeeId: ['사번', 'employeeId'],
  name: ['성명', 'name'],
  division: ['본부', 'division'],
  department: ['실/부서', 'department'],
  team: ['팀', 'team'],
  title: ['직책', 'title'],
  managerEmployeeId: ['상위관리자사번', 'managerEmployeeId'],
  collaboratorEmployeeId: ['협업자사번', 'collaboratorEmployeeId'],
  relationType: ['관계유형', 'relationType'],
  projectCode: ['프로젝트코드', 'projectCode'],
  kpiCode: ['KPI코드', 'kpiCode'],
  collaborationCount: ['협업횟수', 'collaborationCount'],
  checkinCount: ['체크인횟수', 'checkinCount'],
  monthlyWorkCount: ['월간업무건수', 'monthlyWorkCount'],
  lastWorkedAt: ['최근협업일', 'lastWorkedAt'],
  manualRelationScore: ['수동관계점수', 'manualRelationScore'],
  note: ['비고', 'note'],
}

const RELATIONSHIP_TEMPLATE_SAMPLE_ROW = [
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
  '="2026-06-01"',
  '82',
  '최근 협업 이력이 많아 추천 근거로 활용',
] as const

const RELATIONSHIP_UPLOAD_ALLOWED_TYPES = new Set([
  'TEAM',
  'DIVISION',
  'OTHER_DIVISION',
  'PROJECT',
  'KPI',
  'RECENT_COLLAB',
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
  '프로젝트': 'PROJECT',
  '프로젝트 접점': 'PROJECT',
  'KPI': 'KPI',
  'KPI 접점': 'KPI',
  '최근 협업': 'RECENT_COLLAB',
  '최근협업': 'RECENT_COLLAB',
}

const REVIEWER_SEARCH_FILTERS: Array<{ value: ReviewerSearchFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'SAME_TEAM', label: '같은 팀' },
  { value: 'SAME_DIVISION', label: '같은 본부' },
  { value: 'CROSS_DIVISION', label: '타 본부' },
  { value: 'KPI_TOUCHPOINT', label: '프로젝트/KPI 접점' },
  { value: 'RECENT_COLLABORATION', label: '최근 협업' },
]

const RELATIONSHIP_LABELS: Record<string, string> = {
  SELF: '본인',
  SUPERVISOR: '상사',
  PEER: '동료',
  SUBORDINATE: '팀원',
  CROSS_TEAM_PEER: '타팀 동료',
  CROSS_DEPT: '타부서',
}

const VISIBILITY_LABELS: Record<string, string> = {
  FULL: '기명',
  ANONYMOUS: '익명',
  PRIVATE: '익명',
}

const VISIBILITY_ROWS = [
  ['SELF', '본인'],
  ['SUPERVISOR', '상사'],
  ['PEER', '동료'],
  ['SUBORDINATE', '팀원'],
  ['CROSS_TEAM_PEER', '타팀 동료'],
  ['CROSS_DEPT', '타부서'],
] as const

const VISIBILITY_OPTIONS = [
  { value: 'ANONYMOUS', label: '익명' },
  { value: 'FULL', label: '기명' },
] as const

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  SUBMITTED: '승인 요청',
  APPROVED: '승인',
  REJECTED: '반려',
  PUBLISHED: '응답 시작',
}

function getRelationshipLabel(relationship: string) {
  return RELATIONSHIP_LABELS[relationship] ?? relationship
}

function getWorkflowStatusLabel(status?: string | null) {
  if (!status) return '초안'
  return WORKFLOW_STATUS_LABELS[status] ?? status
}

function getVisibilityValueLabel(value?: string | null) {
  return VISIBILITY_LABELS[value ?? 'ANONYMOUS'] ?? '익명'
}

function getUploadRelationTypeLabel(value?: string | null) {
  switch (value) {
    case 'TEAM':
      return '같은 팀'
    case 'DIVISION':
      return '같은 본부'
    case 'OTHER_DIVISION':
      return '타 본부'
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

function buildNominationRowKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? 'none').trim() || 'none')
    .join(':')
}

function getVisibilitySummary(settings: Record<string, string>) {
  const values = VISIBILITY_ROWS.map(([key]) => settings[key] ?? 'ANONYMOUS')
  if (values.every((value) => value !== 'FULL')) return '공개 범위: 전체 익명'
  if (values.every((value) => value === 'FULL')) return '공개 범위: 전체 기명'
  return '공개 범위: 일부 기명 포함'
}

function getRecommendationReason(reviewer: ReviewerDraft) {
  if (reviewer.rationale?.trim()) return reviewer.rationale.trim()

  switch (reviewer.relationship) {
    case 'SELF':
      return '본인 응답과 동료 응답을 비교하기 위한 기준입니다.'
    case 'SUPERVISOR':
      return '관리 관계와 업무 방향 조율 맥락이 있습니다.'
    case 'SUBORDINATE':
      return '팀원 관점에서 함께 일한 경험을 확인할 수 있습니다.'
    case 'PEER':
    case 'CROSS_TEAM_PEER':
    case 'CROSS_DEPT':
      return '같은 조직 또는 협업 범위에서 함께 근무한 후보입니다.'
    default:
      return '평가 대상자와의 업무 접점이 있는 후보입니다.'
  }
}

function getRecommendationFit(reviewer: ReviewerDraft) {
  if (typeof reviewer.fitScore === 'number') {
    return `${Math.max(0, Math.min(100, Math.round(reviewer.fitScore)))}%`
  }

  switch (reviewer.relationship) {
    case 'SUPERVISOR':
      return '높음'
    case 'PEER':
    case 'SUBORDINATE':
      return '보통'
    default:
      return '확인 필요'
  }
}

function getPreviewSourceMessage(preview: AiPreview) {
  if (preview.source === 'ai') return '추천 모델 기준으로 후보를 정리했습니다.'
  if (preview.source === 'disabled') return 'AI 기능이 꺼져 있어 기본 추천 기준으로 후보를 표시합니다.'
  return '기본 추천 기준으로 후보를 표시합니다.'
}

function normalizeReviewerSearchText(value?: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

function getRelationshipPriority(relationship: string) {
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

function buildRelationshipTemplateCsv() {
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

function parseRelationshipUploadCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) {
    return { rows: [] as RelationshipUploadRow[], errors: ['업로드할 CSV 행이 없습니다.'] }
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

    if (!employeeId) errors.push('사번 필수')
    if (!collaboratorEmployeeId && !managerEmployeeId) {
      errors.push('협업자사번 또는 상위관리자사번 필요')
    }
    if (relationType && !RELATIONSHIP_UPLOAD_ALLOWED_TYPES.has(relationType)) {
      errors.push('관계유형 허용값 확인')
    }
    if (Number.isNaN(manualRelationScore) || (manualRelationScore != null && (manualRelationScore < 0 || manualRelationScore > 100))) {
      errors.push('수동관계점수는 0~100 숫자')
    }

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
      lastWorkedAt: normalizeRelationshipUploadDate(getRelationshipUploadCell(data, 'lastWorkedAt')),
      manualRelationScore: Number.isNaN(manualRelationScore) ? null : manualRelationScore,
      note: getRelationshipUploadCell(data, 'note'),
      errors,
    }
  })

  return { rows, errors: globalErrors }
}

function getRelationshipUploadEvidence(
  reviewer: ReviewerCandidateSummary,
  targetEmployeeId: string,
  rows: RelationshipUploadRow[]
) {
  return rows.filter((row) => {
    if (row.errors.length) return false

    const rowEmployeeIds = [row.employeeId, row.collaboratorEmployeeId, row.managerEmployeeId].filter(Boolean)
    return rowEmployeeIds.includes(reviewer.employeeId) && rowEmployeeIds.includes(targetEmployeeId)
  })
}

function scoreReviewerCandidate(
  reviewer: ReviewerCandidateSummary,
  target: { id: string; department: string },
  relationshipRows: RelationshipUploadRow[]
): ScoredReviewerCandidate {
  let score = 0
  const sources: string[] = []
  const sameDepartment = reviewer.department === target.department
  const evidenceRows = getRelationshipUploadEvidence(reviewer, target.id, relationshipRows)

  if (reviewer.relationship === 'SELF') {
    score = 0
    sources.push('본인 응답 기준')
  } else if (sameDepartment && reviewer.relationship === 'PEER') {
    score += 35
    sources.push('조직 정보: 같은 팀')
  } else if (sameDepartment) {
    score += 20
    sources.push('조직 정보: 같은 본부')
  } else {
    score += 15
    sources.push('조직 정보: 타 본부 협업 가능')
  }

  if (reviewer.relationship === 'SUPERVISOR') {
    score += 30
    sources.push('관리 관계')
  }
  if (reviewer.relationship === 'SUBORDINATE') {
    score += 25
    sources.push('팀원 관계')
  }

  for (const row of evidenceRows) {
    if (row.relationType === 'PROJECT') {
      score += 25
      sources.push('프로젝트/KPI 접점')
    }
    if (row.relationType === 'KPI') {
      score += 25
      sources.push('프로젝트/KPI 접점')
    }
    if (row.relationType === 'RECENT_COLLAB') {
      score += 20
      sources.push('최근 협업 기록')
    }
    if (row.relationType === 'TEAM') {
      score += 15
      sources.push('업로드 관계 데이터: 같은 팀')
    }
    if (row.relationType === 'DIVISION') {
      score += 10
      sources.push('업로드 관계 데이터: 같은 본부')
    }
    if (row.relationType === 'OTHER_DIVISION') {
      score += 10
      sources.push('업로드 관계 데이터: 타 본부')
    }
    if (row.manualRelationScore != null) {
      score += row.manualRelationScore * 0.4
      sources.push('업로드 관계 데이터: 수동 관계 점수')
    }
    if ((row.collaborationCount ?? 0) > 0 || (row.checkinCount ?? 0) > 0 || (row.monthlyWorkCount ?? 0) > 0) {
      score += Math.min(20, (row.collaborationCount ?? 0) * 2 + (row.checkinCount ?? 0) * 3 + (row.monthlyWorkCount ?? 0) * 2)
      sources.push('최근 협업 기록')
    }
  }

  const relationshipScore = Math.max(0, Math.min(100, Math.round(score)))
  const uniqueSources = Array.from(new Set(sources))
  const relationshipRationale = uniqueSources.length
    ? `${uniqueSources.slice(0, 3).join(', ')} 기준으로 산정했습니다.`
    : '실제 후보 데이터가 부족해 기본 조직 정보만 확인했습니다.'

  return {
    ...reviewer,
    relationshipScore,
    relationshipScoreSources: uniqueSources,
    relationshipRationale,
  }
}

function matchesReviewerSearchFilter(
  reviewer: {
    relationship: string
    department: string
    relationshipScoreSources?: string[]
  },
  filter: ReviewerSearchFilter,
  targetDepartment: string
) {
  const sameDepartment = reviewer.department === targetDepartment

  switch (filter) {
    case 'SAME_TEAM':
      return reviewer.relationship === 'PEER' && sameDepartment
    case 'SAME_DIVISION':
      return sameDepartment && reviewer.relationship !== 'SELF'
    case 'CROSS_DIVISION':
      return (
        reviewer.relationship === 'CROSS_TEAM_PEER' ||
        reviewer.relationship === 'CROSS_DEPT' ||
        (!sameDepartment && reviewer.relationship !== 'SELF')
      )
    case 'KPI_TOUCHPOINT':
      return reviewer.relationshipScoreSources?.some((source) => source.includes('프로젝트/KPI')) ?? false
    case 'RECENT_COLLABORATION':
      return reviewer.relationshipScoreSources?.some((source) => source.includes('최근 협업')) ?? false
    default:
      return true
  }
}

type ReviewerNominationPanelProps = {
  roundId: string
  nomination: NominationData
}

export function ReviewerNominationPanel(props: ReviewerNominationPanelProps) {
  const router = useRouter()
  const initialSelection = useMemo(
    () =>
      props.nomination.savedDraft?.reviewers.map((reviewer) => reviewer.employeeId) ??
      props.nomination.reviewerGroups.flatMap((group) =>
        group.key === 'self' ? group.reviewers.map((reviewer) => reviewer.employeeId) : []
      ),
    [props.nomination]
  )

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [preview, setPreview] = useState<AiPreview | null>(null)
  const [reviewerSearchQuery, setReviewerSearchQuery] = useState('')
  const [reviewerFilter, setReviewerFilter] = useState<ReviewerSearchFilter>('ALL')
  const [relationshipUploadRows, setRelationshipUploadRows] = useState<RelationshipUploadRow[]>([])
  const [relationshipUploadErrors, setRelationshipUploadErrors] = useState<string[]>([])
  const [relationshipUploadFileName, setRelationshipUploadFileName] = useState('')

  useEffect(() => {
    setSelectedIds(initialSelection)
    setNotice('')
    setErrorNotice('')
    setPreview(null)
    setReviewerSearchQuery('')
    setReviewerFilter('ALL')
    setRelationshipUploadRows([])
    setRelationshipUploadErrors([])
    setRelationshipUploadFileName('')
  }, [initialSelection, props.nomination.targetEmployee.id, props.roundId])

  const reviewerDirectory = useMemo(() => {
    const directory = new Map<string, ReviewerCandidateSummary>()

    for (const group of props.nomination.reviewerGroups) {
      for (const reviewer of group.reviewers) {
        const existing = directory.get(reviewer.employeeId)
        if (existing && getRelationshipPriority(existing.relationship) <= getRelationshipPriority(reviewer.relationship)) {
          continue
        }

        directory.set(reviewer.employeeId, {
          employeeId: reviewer.employeeId,
          name: reviewer.name,
          relationship: reviewer.relationship,
          department: reviewer.department,
          groupKey: group.key,
          groupLabel: group.label,
          selectable: reviewer.selectable !== false,
          disabledReason: reviewer.disabledReason ?? null,
        })
      }
    }

    return directory
  }, [props.nomination.reviewerGroups])

  const selectedReviewers = selectedIds
    .map((id) => reviewerDirectory.get(id))
    .filter((reviewer): reviewer is NonNullable<typeof reviewer> => Boolean(reviewer))
    .map((reviewer) => ({
      employeeId: reviewer.employeeId,
      name: reviewer.name,
      relationship: reviewer.relationship,
      department: reviewer.department,
      groupKey: reviewer.groupKey,
      groupLabel: reviewer.groupLabel,
      selectable: reviewer.selectable,
    }))

  const selectableReviewerIds = useMemo(
    () =>
      new Set(
        props.nomination.reviewerGroups.flatMap((group) =>
          group.reviewers
            .filter((reviewer) => reviewer.selectable !== false)
            .map((reviewer) => reviewer.employeeId)
        )
      ),
    [props.nomination.reviewerGroups]
  )

  const allReviewerCandidates = useMemo(() => {
    const candidateMap = new Map<string, ReviewerCandidateSummary>()

    for (const group of props.nomination.reviewerGroups) {
      for (const reviewer of group.reviewers) {
        const candidate = {
          ...reviewer,
          groupKey: group.key,
          groupLabel: group.label,
          selectable: reviewer.selectable !== false,
          disabledReason: reviewer.disabledReason ?? null,
        }
        const existing = candidateMap.get(reviewer.employeeId)
        if (existing && getRelationshipPriority(existing.relationship) <= getRelationshipPriority(reviewer.relationship)) {
          continue
        }
        candidateMap.set(reviewer.employeeId, candidate)
      }
    }

    return Array.from(candidateMap.values())
  }, [props.nomination.reviewerGroups])

  const scoredReviewerCandidates = useMemo(
    () =>
      allReviewerCandidates
        .map((reviewer) => scoreReviewerCandidate(reviewer, props.nomination.targetEmployee, relationshipUploadRows))
        .sort((left, right) => right.relationshipScore - left.relationshipScore),
    [allReviewerCandidates, props.nomination.targetEmployee, relationshipUploadRows]
  )

  const scoredReviewerDirectory = useMemo(
    () => new Map(scoredReviewerCandidates.map((reviewer) => [reviewer.employeeId, reviewer])),
    [scoredReviewerCandidates]
  )

  const filteredReviewerGroups = useMemo(() => {
    const query = normalizeReviewerSearchText(reviewerSearchQuery)
    const seenReviewerIds = new Set<string>()

    return props.nomination.reviewerGroups.map((group) => ({
      ...group,
      reviewers: group.reviewers.filter((reviewer) => {
        if (seenReviewerIds.has(reviewer.employeeId)) return false
        const scoredReviewer = scoredReviewerDirectory.get(reviewer.employeeId)
        const searchText = normalizeReviewerSearchText(
          [
            reviewer.name,
            reviewer.department,
            getRelationshipLabel(reviewer.relationship),
            group.label,
          ].join(' ')
        )
        const matchesSearch = !query || searchText.includes(query)
        const matchesFilter = matchesReviewerSearchFilter(
          scoredReviewer ?? reviewer,
          reviewerFilter,
          props.nomination.targetEmployee.department
        )

        if (!matchesSearch || !matchesFilter) return false
        seenReviewerIds.add(reviewer.employeeId)
        return true
      }),
    }))
  }, [
    props.nomination.reviewerGroups,
    props.nomination.targetEmployee.department,
    reviewerFilter,
    reviewerSearchQuery,
    scoredReviewerDirectory,
  ])

  const reviewerFilterCounts = useMemo(() => {
    const counts = new Map<ReviewerSearchFilter, number>()

    for (const filter of REVIEWER_SEARCH_FILTERS) {
      const count = scoredReviewerCandidates.filter(
        (reviewer) =>
          reviewer.selectable &&
          matchesReviewerSearchFilter(reviewer, filter.value, props.nomination.targetEmployee.department)
      ).length
      counts.set(filter.value, count)
    }

    return counts
  }, [scoredReviewerCandidates, props.nomination.targetEmployee.department])

  const recommendationSlots = useMemo(() => {
    const usedReviewerIds = new Set<string>()
    const selectedScoredReviewers = selectedReviewers
      .map((reviewer) => scoredReviewerDirectory.get(reviewer.employeeId))
      .filter((reviewer): reviewer is ScoredReviewerCandidate => Boolean(reviewer))
    const selectedByRule = (predicate: (reviewer: ScoredReviewerCandidate) => boolean) =>
      selectedScoredReviewers.find((reviewer) => !usedReviewerIds.has(reviewer.employeeId) && predicate(reviewer))
    const candidateByRule = (predicate: (reviewer: ScoredReviewerCandidate) => boolean) =>
      scoredReviewerCandidates.find(
        (reviewer) =>
          reviewer.selectable &&
          !usedReviewerIds.has(reviewer.employeeId) &&
          reviewer.relationship !== 'SELF' &&
          predicate(reviewer)
      )
    const pickSlot = (
      key: string,
      label: string,
      shortageLabel: string,
      predicate: (reviewer: ScoredReviewerCandidate) => boolean
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
      pickSlot(
        'same-team-1',
        '같은 팀 1명',
        '같은 팀 추천 후보 부족',
        (reviewer) =>
          reviewer.relationship === 'PEER' &&
          reviewer.department === props.nomination.targetEmployee.department
      ),
      pickSlot(
        'same-division-1',
        '같은 본부 1명',
        '같은 본부 추천 후보 부족',
        (reviewer) =>
          reviewer.department === props.nomination.targetEmployee.department &&
          reviewer.relationship !== 'SELF'
      ),
      pickSlot(
        'same-division-2',
        '같은 본부 2명',
        '같은 본부 추천 후보 부족',
        (reviewer) =>
          reviewer.department === props.nomination.targetEmployee.department &&
          reviewer.relationship !== 'SELF'
      ),
      pickSlot(
        'cross-division-1',
        '타 본부 1명',
        '타 본부 추천 후보 부족',
        (reviewer) =>
          reviewer.relationship === 'CROSS_TEAM_PEER' ||
          reviewer.relationship === 'CROSS_DEPT' ||
          reviewer.department !== props.nomination.targetEmployee.department
      ),
      pickSlot(
        'cross-division-2',
        '타 본부 2명',
        '타 본부 추천 후보 부족',
        (reviewer) =>
          reviewer.relationship === 'CROSS_TEAM_PEER' ||
          reviewer.relationship === 'CROSS_DEPT' ||
          reviewer.department !== props.nomination.targetEmployee.department
      ),
    ]
  }, [
    props.nomination.targetEmployee.department,
    scoredReviewerCandidates,
    scoredReviewerDirectory,
    selectedReviewers,
  ])

  function toggleReviewer(employeeId: string, selectable = true) {
    if (!selectable) return

    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    )
  }

  async function handleSave() {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(props.roundId)}/nominations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: props.roundId,
          targetId: props.nomination.targetEmployee.id,
          reviewers: selectedReviewers,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '평가자 매핑 초안 저장에 실패했습니다.')
      }
      setNotice('평가자 매핑 초안을 저장했습니다. 승인 요청 전 구성을 다시 확인해 주세요.')
      router.refresh()
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '평가자 매핑 초안 저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleWorkflow(action: 'submit' | 'approve' | 'reject' | 'publish') {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(props.roundId)}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetId: props.nomination.targetEmployee.id,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '360 평가자 매핑 처리에 실패했습니다.')
      }

      const messages: Record<typeof action, string> = {
        submit: '평가자 매핑을 승인 요청 상태로 제출했습니다.',
        approve: '평가자 매핑을 승인했습니다.',
        reject: '평가자 매핑을 반려했습니다.',
        publish: '승인된 평가자 매핑을 응답 시작 상태로 전환하고 리뷰 요청을 생성했습니다.',
      }

      setNotice(messages[action])
      router.refresh()
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '360 평가자 매핑 처리에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRecommend() {
    setBusy(true)
    setNotice('')
    setErrorNotice('')

    try {
      const response = await fetch('/api/feedback/360/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommend-reviewers',
          payload: {
            targetEmployee: props.nomination.targetEmployee,
            reviewerGroups: props.nomination.reviewerGroups,
            savedDraftCount: props.nomination.savedDraftCount,
            anonymityThreshold: 3,
          },
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '평가자 추천 후보를 생성하지 못했습니다.')
      }
      setPreview(json.data)
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '평가자 추천 후보 생성에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function handleDownloadRelationshipTemplate() {
    const blob = new Blob([buildRelationshipTemplateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'feedback360-관계데이터-양식.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleRelationshipUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseRelationshipUploadCsv(text)
      const rowErrors = parsed.rows.flatMap((row) =>
        row.errors.map((message) => `${row.rowNumber}행: ${message}`)
      )
      setRelationshipUploadRows(parsed.rows)
      setRelationshipUploadErrors([...parsed.errors, ...rowErrors])
      setRelationshipUploadFileName(file.name)
      setNotice('관계 데이터 업로드 미리보기를 갱신했습니다. 저장 없이 추천 점수 계산에만 사용합니다.')
      setErrorNotice('')
    } catch {
      setRelationshipUploadRows([])
      setRelationshipUploadErrors(['CSV 파일을 읽지 못했습니다. 파일 인코딩과 컬럼을 확인해 주세요.'])
      setRelationshipUploadFileName(file.name)
    } finally {
      event.target.value = ''
    }
  }

  function applyAiPreview() {
    if (!preview?.result.recommendations?.length) return

    const nextIds = preview.result.recommendations
      .map((reviewer) => reviewer.employeeId)
      .filter((id) => reviewerDirectory.has(id) && selectableReviewerIds.has(id))

    setSelectedIds(Array.from(new Set(nextIds)))
    setPreview(null)
    setNotice('추천 평가자를 현재 평가자 매핑 초안에 반영했습니다. 저장 전 한 번 더 검토해 주세요.')
  }

  const visibilitySettingRows = VISIBILITY_ROWS.map(([relationship, label]) => {
    const value = props.nomination.visibilitySettings[relationship] === 'FULL' ? 'FULL' : 'ANONYMOUS'
    return {
      key: relationship,
      label,
      value,
    }
  })
  const relationshipUploadPreviewRows = relationshipUploadRows.map((row) => ({
    key: buildNominationRowKey([
      'relationship-upload-row',
      row.rowNumber,
      row.employeeId,
      row.collaboratorEmployeeId,
      row.managerEmployeeId,
    ]),
    title: row.name || row.employeeId || `${row.rowNumber}행`,
    divisionLabel: row.division || '본부 미입력',
    teamLabel: row.team || '팀 미입력',
    collaboratorLabel: row.collaboratorEmployeeId || '없음',
    relationTypeLabel: getUploadRelationTypeLabel(row.relationType),
    manualScoreLabel: row.manualRelationScore == null ? '미입력' : String(row.manualRelationScore),
    validationLabel: row.errors.length ? '확인 필요' : '정상',
    errors: row.errors,
  }))

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Feedback360Avatar
            person={{
              name: props.nomination.targetEmployee.name,
              profileImageUrl: props.nomination.targetEmployee.profileImageUrl,
            }}
            size="lg"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">평가자 매핑 관리</h3>
            <p className="mt-1 truncate text-sm text-slate-500">
              대상자 {props.nomination.targetEmployee.name} · {props.nomination.targetEmployee.department} ·{' '}
              {props.nomination.targetEmployee.position}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              상태: {getWorkflowStatusLabel(props.nomination.workflowStatus)}
            </span>
            {props.nomination.counts ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                승인 {props.nomination.counts.approved}/{props.nomination.counts.total}
              </span>
            ) : null}
            {props.nomination.counts?.published ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                응답 요청 {props.nomination.counts.published}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRecommend}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Bot className="h-4 w-4" />
            {busy ? '추천 후보 확인 중...' : 'AI/관계 점수 추천'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            평가자 매핑 초안 저장
          </button>
          <button
            type="button"
            onClick={() => handleWorkflow('submit')}
            disabled={busy || !selectedReviewers.length}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            승인 요청
          </button>
          {props.nomination.canApprove ? (
            <>
              <button
                type="button"
                onClick={() => handleWorkflow('approve')}
                disabled={busy || !props.nomination.counts?.total}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald-300 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
              >
                승인
              </button>
              <button
                type="button"
                onClick={() => handleWorkflow('reject')}
                disabled={busy || !props.nomination.counts?.total}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
              >
                반려
              </button>
            </>
          ) : null}
          {props.nomination.canPublish ? (
            <button
              type="button"
              onClick={() => handleWorkflow('publish')}
              disabled={busy || !props.nomination.counts?.approved}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-300 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
            >
              응답 시작
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {errorNotice ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorNotice}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">현재 평가자 선정 규칙</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RuleChip active={props.nomination.selectionSettings.requireLeaderApproval} label="리더 승인 필요" />
            <RuleChip active={props.nomination.selectionSettings.allowPreferredPeers} label="선호 평가자 선택 가능" />
            <RuleChip active={props.nomination.selectionSettings.excludeLeaderFromPeerSelection} label="리더 제외" />
            <RuleChip active={props.nomination.selectionSettings.excludeDirectReportsFromPeerSelection} label="팀원 제외" />
          </div>
        </div>
        <Feedback360VisibilitySettings
          title="평가자별 공개 범위 설정"
          summary={getVisibilitySummary(props.nomination.visibilitySettings)}
          description="기본은 익명 응답으로 운영합니다. 평가자별 기명/익명 전환은 상세 설정에서 확인합니다."
          rows={visibilitySettingRows}
          options={VISIBILITY_OPTIONS}
          disabled
          footnote="현재 화면에서는 설정을 확인만 합니다. 변경은 승인된 운영 설정 화면에서 진행합니다."
        />
      </div>

      <Feedback360RelationshipTemplatePanel
        fileName={relationshipUploadFileName}
        validCount={relationshipUploadRows.filter((row) => !row.errors.length).length}
        totalCount={relationshipUploadRows.length}
        errors={relationshipUploadErrors}
        previewRows={relationshipUploadPreviewRows}
        onDownloadTemplate={handleDownloadRelationshipTemplate}
        onUpload={handleRelationshipUpload}
      />

      {preview ? (
        <div
          className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
          role="dialog"
          aria-label="AI 추천 결과 패널"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">AI 추천 결과 패널</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">평가자 추천 후보</div>
              <div className="mt-1 text-xs text-slate-500">평가자 추천 미리보기 · {getPreviewSourceMessage(preview)}</div>
            </div>
            <button
              type="button"
              onClick={applyAiPreview}
              disabled={!preview.result.recommendations?.length}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              추천 후보 적용
            </button>
          </div>
          {preview.result.rationale ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {preview.result.rationale}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {preview.result.recommendations?.length ? (
              preview.result.recommendations.map((reviewer, index) => (
                <div
                  key={buildNominationRowKey([
                    'recommendation',
                    reviewer.employeeId,
                    reviewer.name,
                    reviewer.relationship,
                    index,
                  ])}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Feedback360Avatar
                        person={{
                          name: reviewer.name,
                          profileImageUrl: reviewer.profileImageUrl,
                        }}
                        size="sm"
                      />
                      <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{reviewer.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{getRelationshipLabel(reviewer.relationship)}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      적합도 {getRecommendationFit(reviewer)}
                    </span>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-slate-500">추천 근거</div>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{getRecommendationReason(reviewer)}</p>
                  <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                      익명/기명 설정
                    </summary>
                    <div className="mt-2 text-sm text-slate-600">
                      기본값은 {getVisibilityValueLabel(props.nomination.visibilitySettings[reviewer.relationship])}입니다.
                    </div>
                  </details>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                추천 가능한 평가자가 없습니다
              </div>
            )}
          </div>
          {preview.result.watchouts?.length ? (
            <div className="mt-3 space-y-2">
              {preview.result.watchouts.map((item, index) => (
                <div
                  key={buildNominationRowKey(['watchout', item, index])}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                >
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">평가자 검색</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                이름, 부서, 팀, 직책 검색으로 실제 업무 관계가 있는 평가자를 빠르게 찾습니다.
              </p>
            </div>
            <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              기본 추천 규칙: 같은 팀 1명 / 같은 본부 2명 / 타 본부 2명
            </div>
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={reviewerSearchQuery}
              onChange={(event) => setReviewerSearchQuery(event.target.value)}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="이름, 부서, 팀, 직책 검색"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {REVIEWER_SEARCH_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setReviewerFilter(filter.value)}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition ${
                  reviewerFilter === filter.value
                    ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {filter.label} {reviewerFilterCounts.get(filter.value) ?? 0}
              </button>
            ))}
          </div>
          {reviewerFilter === 'KPI_TOUCHPOINT' || reviewerFilter === 'RECENT_COLLABORATION' ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              현재 평가자 후보 데이터에 {reviewerFilter === 'KPI_TOUCHPOINT' ? '프로젝트/KPI 접점' : '최근 협업'} 근거가 충분하지 않습니다.
              후보를 임의로 만들지 않고 실제 후보 데이터가 있을 때만 표시합니다.
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">5명 추천 슬롯</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            기본은 같은 팀 1명, 같은 본부 2명, 타 본부 2명입니다. 실제 후보가 부족한 슬롯은 부족 상태로 표시합니다.
          </p>
          <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
            <span className="font-semibold">추천 근거</span>
            <span className="ml-1">후보의 소속, 관계, 선택 가능 상태를 기준으로 실제 후보만 표시합니다.</span>
          </div>
          <div className="mt-3 space-y-2">
            {recommendationSlots.map((slot) => (
              <div
                key={buildNominationRowKey(['recommendation-slot', slot.key, slot.reviewer?.employeeId])}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  slot.reviewer ? 'border-slate-200 bg-slate-50' : 'border-dashed border-amber-200 bg-amber-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">{slot.label}</div>
                    <div className="mt-2 flex items-center gap-2">
                      {slot.reviewer ? (
                        <Feedback360Avatar
                          person={{
                            name: slot.reviewer.name,
                            profileImageUrl: slot.reviewer.profileImageUrl,
                          }}
                          size="sm"
                        />
                      ) : null}
                      <div className={`font-semibold ${slot.reviewer ? 'text-slate-900' : 'text-amber-800'}`}>
                        {slot.reviewer ? slot.reviewer.name : slot.shortageLabel}
                      </div>
                    </div>
                    {slot.reviewer ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {slot.reviewer.department} · {getRelationshipLabel(slot.reviewer.relationship)}
                      </div>
                    ) : null}
                    {slot.reviewer ? (
                      <div className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                        <div className="font-semibold text-slate-800">관계 점수 {slot.reviewer.relationshipScore}점</div>
                        <div>{slot.reviewer.relationshipRationale}</div>
                        <div>사용된 데이터: {slot.reviewer.relationshipScoreSources.join(', ') || '조직 정보'}</div>
                      </div>
                    ) : null}
                  </div>
                  {slot.reviewer ? (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${slot.selected ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {slot.selected ? '선택됨' : '후보'}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {filteredReviewerGroups.map((group, groupIndex) => (
          <div
            key={buildNominationRowKey(['group', group.key, group.label, groupIndex])}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="text-sm font-semibold text-slate-900">{group.label}</div>
            <div className="mt-1 text-xs text-slate-500">{group.description}</div>
            {group.helpMessage ? (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
                {group.helpMessage}
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              {group.reviewers.length ? (
                group.reviewers.map((reviewer, reviewerIndex) => {
                  const selectable = reviewer.selectable !== false
                  const checked = selectable && selectedIds.includes(reviewer.employeeId)
                  const scoredReviewer = scoredReviewerDirectory.get(reviewer.employeeId)

                  return (
                    <label
                      key={buildNominationRowKey([
                        'reviewer',
                        group.key,
                        reviewer.employeeId,
                        reviewer.name,
                        reviewer.relationship,
                        reviewerIndex,
                      ])}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm ${
                        selectable
                          ? 'cursor-pointer border-slate-200 bg-white text-slate-700'
                          : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
                      }`}
                      title={reviewer.disabledReason ?? undefined}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!selectable}
                        onChange={() => toggleReviewer(reviewer.employeeId, selectable)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <Feedback360Avatar
                        person={{
                          name: reviewer.name,
                          profileImageUrl: reviewer.profileImageUrl,
                        }}
                        size="sm"
                      />
                      <span>
                        <span className={`font-medium ${selectable ? 'text-slate-900' : 'text-slate-500'}`}>
                          {reviewer.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {reviewer.department} · {getRelationshipLabel(reviewer.relationship)}
                          {scoredReviewer ? ` · 관계 점수 ${scoredReviewer.relationshipScore}점` : ''}
                        </span>
                        {scoredReviewer ? (
                          <span className="mt-2 block text-xs leading-5 text-slate-600">
                            추천 근거: {scoredReviewer.relationshipRationale}
                            <br />
                            사용된 데이터: {scoredReviewer.relationshipScoreSources.join(', ') || '조직 정보'}
                          </span>
                        ) : null}
                        {reviewer.disabledReason ? (
                          <span className="mt-2 block text-xs leading-5 text-amber-700">
                            {reviewer.disabledReason}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  {reviewerFilter === 'SAME_TEAM'
                    ? '같은 팀 추천 후보 부족'
                    : reviewerFilter === 'SAME_DIVISION'
                      ? '같은 본부 추천 후보 부족'
                      : reviewerFilter === 'CROSS_DIVISION'
                        ? '타 본부 추천 후보 부족'
                        : '추천 가능한 평가자가 없습니다.'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">현재 선택된 평가자</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedReviewers.length ? (
            selectedReviewers.map((reviewer, index) => (
              <span
                key={buildNominationRowKey([
                  'selected',
                  reviewer.employeeId,
                  reviewer.name,
                  reviewer.relationship,
                  index,
                ])}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {reviewer.name} · {getRelationshipLabel(reviewer.relationship)}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">아직 선택된 평가자가 없습니다.</span>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {props.nomination.guidance.map((item, index) => (
          <div
            key={buildNominationRowKey(['guidance', item, index])}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

function RuleChip(props: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        props.active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-200 text-slate-500'
      }`}
    >
      {props.label}
    </span>
  )
}
