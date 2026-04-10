import type {
  SystemRole,
  WordCloud360CycleStatus,
  WordCloudAssignmentStatus,
  WordCloudEvaluatorGroup,
  WordCloudKeywordCategory,
  WordCloudKeywordPolarity,
  WordCloudKeywordSourceType,
} from '@prisma/client'
import type { Session } from 'next-auth'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { AppError } from '@/lib/utils'
import {
  aggregateWordCloudResponses,
  buildSuggestedWordCloudAssignments,
  DEFAULT_WORD_CLOUD_KEYWORDS,
  validateWordCloudSubmitSelections,
  WORD_CLOUD_CATEGORY_LABELS,
  WORD_CLOUD_GROUP_LABELS,
  WORD_CLOUD_POLARITY_LABELS,
  WORD_CLOUD_SOURCE_TYPE_LABELS,
  type WordCloudAssignmentDraft,
} from '@/lib/word-cloud-360'

type AuthenticatedSession = Session & {
  user: NonNullable<Session['user']> & {
    id: string
    role: SystemRole
  }
}

export type WordCloud360PageState = 'ready' | 'empty' | 'permission-denied' | 'error'

export type AggregateKeywordView = {
  keywordId: string
  keyword: string
  category: WordCloudKeywordCategory
  count: number
  weight: number
}

type KeywordOption = {
  keywordId: string
  keyword: string
  category: WordCloudKeywordCategory
  warningFlag: boolean
}

export type WordCloud360SelectionSnapshot = {
  keywordId: string
  keyword: string
  category: WordCloudKeywordCategory
  polarity: WordCloudKeywordPolarity
  evaluatorGroup: WordCloudEvaluatorGroup
}

export type WordCloud360ResponseHistoryEntry = {
  revisionId: string
  revisionNumber: number
  eventType: 'draft_saved' | 'final_submitted' | 'final_submission_reverted' | 'restored'
  createdAt: string
  actorUserId?: string
  actorName?: string
  previousStatus?: string
  nextStatus?: string
  responseStatus?: 'DRAFT' | 'SUBMITTED'
  positiveCount: number
  negativeCount: number
  positiveSelections: WordCloud360SelectionSnapshot[]
  negativeSelections: WordCloud360SelectionSnapshot[]
  reason?: string
  restoredFromRevisionId?: string
  canRestore: boolean
}

export type WordCloud360PageData = {
  state: WordCloud360PageState
  message?: string
  alerts?: Array<{
    title: string
    description: string
  }>
  currentUser?: {
    id: string
    name: string
    role: SystemRole
    department: string
  }
  permissions?: {
    canManage: boolean
    canEvaluate: boolean
    canViewOwnResult: boolean
  }
  availableCycles: Array<{
    id: string
    name: string
    year?: number
    status: WordCloud360CycleStatus
  }>
  availableEvalCycles?: Array<{
    id: string
    name: string
    year: number
  }>
  selectedCycleId?: string
  summary?: {
    targetCount: number
    assignmentCount: number
    submittedResponseCount: number
    published: boolean
    thresholdMetTargetCount: number
    positiveSelectionLimit: number
    negativeSelectionLimit: number
    privacyThreshold: number
  }
  evaluatorView?: {
    enabledGroups: WordCloudEvaluatorGroup[]
    positiveSelectionLimit: number
    negativeSelectionLimit: number
    keywordPool: {
      positive: KeywordOption[]
      negative: KeywordOption[]
    }
    assignments: Array<{
      assignmentId: string
      evaluateeId: string
      evaluateeName: string
      department: string
      evaluatorGroup: WordCloudEvaluatorGroup
      status: WordCloudAssignmentStatus
      responseStatus?: 'DRAFT' | 'SUBMITTED'
      selectedPositiveKeywordIds: string[]
      selectedNegativeKeywordIds: string[]
      submittedAt?: string
    }>
  }
  evaluateeView?: {
    resultVisible: boolean
    hiddenReason?: string
    availableGroups: Array<'ALL' | WordCloudEvaluatorGroup>
    selectedGroup?: 'ALL' | WordCloudEvaluatorGroup
    responseCount: number
    positiveSelectionCount: number
    negativeSelectionCount: number
    positiveCloud: AggregateKeywordView[]
    negativeCloud: AggregateKeywordView[]
    positiveTopKeywords: AggregateKeywordView[]
    negativeTopKeywords: AggregateKeywordView[]
    categorySummary: Array<{
      polarity: WordCloudKeywordPolarity
      category: WordCloudKeywordCategory
      label: string
      count: number
    }>
    evaluatorGroupSummary: Array<{
      evaluatorGroup: WordCloudEvaluatorGroup
      label: string
      responseCount: number
    }>
  }
  adminView?: {
    cycle?: {
      id: string
      cycleName: string
      status: WordCloud360CycleStatus
      startDate?: string
      endDate?: string
      positiveSelectionLimit: number
      negativeSelectionLimit: number
      resultPrivacyThreshold: number
      evaluatorGroups: WordCloudEvaluatorGroup[]
      publishedAt?: string
      notes?: string
      evalCycleId?: string
    }
    keywordPool: Array<{
      keywordId: string
      keywordCode?: string
      keyword: string
      polarity: WordCloudKeywordPolarity
      polarityLabel: string
      category: WordCloudKeywordCategory
      categoryLabel: string
      sourceType: WordCloudKeywordSourceType
      sourceTypeLabel: string
      active: boolean
      displayOrder: number
      warningFlag: boolean
      note?: string
    }>
    employees: Array<{
      id: string
      employeeNumber: string
      name: string
      department: string
      managerId?: string | null
      status: string
    }>
    assignments: Array<{
      assignmentId: string
      evaluatorId: string
      evaluatorName: string
      evaluateeId: string
      evaluateeName: string
      department: string
      evaluatorGroup: WordCloudEvaluatorGroup
      status: WordCloudAssignmentStatus
      responseId?: string
      responseStatus?: 'DRAFT' | 'SUBMITTED'
      positiveSelectionCount: number
      negativeSelectionCount: number
      history: WordCloud360ResponseHistoryEntry[]
      submittedAt?: string
    }>
    progress: {
      targetCount: number
      assignmentCount: number
      submittedCount: number
      draftCount: number
      pendingCount: number
    }
    results: Array<{
      evaluateeId: string
      evaluateeName: string
      department: string
      responseCount: number
      thresholdMet: boolean
      positiveTopKeywords: AggregateKeywordView[]
      negativeTopKeywords: AggregateKeywordView[]
    }>
  }
}

type SectionAlert = NonNullable<WordCloud360PageData['alerts']>[number]

export type WordCloudKeywordCsvImportIssue = {
  field: string
  message: string
}

export type WordCloudKeywordCsvImportAction = 'create' | 'update' | 'unchanged' | 'deactivate'

export type WordCloudKeywordCsvImportRowResult = {
  rowNumber: number
  keywordCode?: string
  keyword: string
  polarity?: string
  category?: string
  sourceType?: string
  action: WordCloudKeywordCsvImportAction
  valid: boolean
  issues: WordCloudKeywordCsvImportIssue[]
}

export type WordCloudKeywordCsvImportSummary = {
  totalRows: number
  validRows: number
  invalidRows: number
  createCount: number
  updateCount: number
  unchangedCount: number
  deactivateCount: number
}

export type WordCloudKeywordCsvImportResult = {
  mode: 'preview' | 'apply'
  fileName: string
  summary: WordCloudKeywordCsvImportSummary
  rows: WordCloudKeywordCsvImportRowResult[]
  applyResult?: {
    createdCount: number
    updatedCount: number
    unchangedCount: number
    deactivatedCount: number
    failedCount: number
    uploadHistoryId?: string
  }
}

export type WordCloudTargetUploadResult = {
  fileName: string
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
    targetCount: number
    createdAssignmentCount: number
    existingAssignmentCount: number
  }
  rows: Array<{
    rowNumber: number
    employeeNumber: string
    employeeName?: string
    department?: string
    valid: boolean
    issues: WordCloudKeywordCsvImportIssue[]
    createdAssignmentCount: number
    existingAssignmentCount: number
    groups: WordCloudEvaluatorGroup[]
  }>
  uploadHistoryId?: string
}

export type WordCloudComparisonReport = {
  fileName: string
  summary: {
    currentCycleName: string
    baselineDepartmentCount: number
    currentDepartmentCount: number
    comparedDepartmentCount: number
    baselineResponseCount: number
    currentResponseCount: number
    hiddenBaselineRows: number
    hiddenCurrentDepartments: number
    largestResponseChange?: {
      department: string
      delta: number
    }
    largestPositiveShift?: {
      department: string
      keyword: string
      delta: number
    }
    largestNegativeShift?: {
      department: string
      keyword: string
      delta: number
    }
  }
  departments: Array<{
    department: string
    baselineResponseCount: number
    currentResponseCount: number
    responseDelta: number
    baselineTopPositiveKeywords: string[]
    currentTopPositiveKeywords: string[]
    baselineTopNegativeKeywords: string[]
    currentTopNegativeKeywords: string[]
    changedKeywords: Array<{
      keyword: string
      polarity: WordCloudKeywordPolarity
      delta: number
    }>
    insight: string
  }>
}

type ParsedWordCloudKeywordImportRow = {
  rowNumber: number
  keywordCode?: string
  keyword: string
  polarity?: string
  category?: string
  sourceType?: string
  active?: string
  displayOrder?: string
  governanceFlag?: string
  note?: string
}

type ValidatedWordCloudKeywordImportRow = Omit<
  ParsedWordCloudKeywordImportRow,
  'polarity' | 'category' | 'sourceType' | 'active' | 'displayOrder' | 'governanceFlag'
> & {
  normalizedKeyword: string
  normalizedKeywordCode?: string
  polarity: WordCloudKeywordPolarity
  category: WordCloudKeywordCategory
  sourceType: WordCloudKeywordSourceType
  active: boolean
  displayOrder: number
  governanceFlag: boolean
  action: WordCloudKeywordCsvImportAction
  targetKeywordId?: string
}

const WORD_CLOUD_KEYWORD_IMPORT_HEADERS = [
  'keyword_code',
  'keyword',
  'polarity',
  'category',
  'source_type',
  'active',
  'display_order',
  'governance_flag',
  'note',
] as const

const WORD_CLOUD_KEYWORD_REQUIRED_HEADERS = ['keyword', 'polarity', 'active'] as const
export const WORD_CLOUD_KEYWORD_MAX_UPLOAD_SIZE = 5 * 1024 * 1024
export const WORD_CLOUD_TARGET_UPLOAD_MAX_SIZE = 5 * 1024 * 1024
export const WORD_CLOUD_COMPARISON_UPLOAD_MAX_SIZE = 5 * 1024 * 1024

function toIso(value?: Date | null) {
  return value ? value.toISOString() : undefined
}

const WORD_CLOUD_360_HISTORY_ACTIONS = [
  'SAVE_WORD_CLOUD_360_RESPONSE_DRAFT',
  'SUBMIT_WORD_CLOUD_360_RESPONSE',
  'WORD_CLOUD_360_FINAL_SUBMIT_REVERTED',
  'WORD_CLOUD_360_RESPONSE_RESTORED',
] as const

const WORD_CLOUD_360_REOPEN_ACTIONS = ['WORD_CLOUD_360_FINAL_SUBMIT_REVERTED', 'WORD_CLOUD_360_RESPONSE_RESTORED'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isWordCloudPolarity(value: string): value is WordCloudKeywordPolarity {
  return value === 'POSITIVE' || value === 'NEGATIVE'
}

function isWordCloudCategory(value: string): value is WordCloudKeywordCategory {
  return value in WORD_CLOUD_CATEGORY_LABELS
}

function isWordCloudEvaluatorGroup(value: string): value is WordCloudEvaluatorGroup {
  return value in WORD_CLOUD_GROUP_LABELS
}

function buildWordCloud360SelectionSnapshot(params: {
  keywords: Array<{
    id: string
    keyword: string
    category: WordCloudKeywordCategory
    polarity: WordCloudKeywordPolarity
  }>
  positiveKeywordIds: string[]
  negativeKeywordIds: string[]
  evaluatorGroup: WordCloudEvaluatorGroup
}) {
  const keywordById = new Map(params.keywords.map((keyword) => [keyword.id, keyword]))
  const mapSelection = (keywordIds: string[], polarity: WordCloudKeywordPolarity) =>
    keywordIds.flatMap((keywordId) => {
      const keyword = keywordById.get(keywordId)
      if (!keyword || keyword.polarity !== polarity) return []
      return {
        keywordId: keyword.id,
        keyword: keyword.keyword,
        category: keyword.category,
        polarity: keyword.polarity,
        evaluatorGroup: params.evaluatorGroup,
      } satisfies WordCloud360SelectionSnapshot
    })

  return {
    positiveSelections: mapSelection(params.positiveKeywordIds, 'POSITIVE'),
    negativeSelections: mapSelection(params.negativeKeywordIds, 'NEGATIVE'),
  }
}

function buildWordCloud360SelectionSnapshotFromItems(
  items: Array<{
    keywordId: string
    keywordTextSnapshot?: string | null
    category?: WordCloudKeywordCategory | null
    polarity?: WordCloudKeywordPolarity | null
    evaluatorGroup?: WordCloudEvaluatorGroup | null
  }>
) {
  const positiveSelections: WordCloud360SelectionSnapshot[] = []
  const negativeSelections: WordCloud360SelectionSnapshot[] = []

  for (const item of items) {
    if (item.polarity !== 'POSITIVE' && item.polarity !== 'NEGATIVE') continue

    const snapshot = {
      keywordId: item.keywordId,
      keyword: item.keywordTextSnapshot ?? item.keywordId,
      category: item.category ?? 'OTHER',
      polarity: item.polarity,
      evaluatorGroup: item.evaluatorGroup ?? 'PEER',
    } satisfies WordCloud360SelectionSnapshot

    if (item.polarity === 'POSITIVE') positiveSelections.push(snapshot)
    else negativeSelections.push(snapshot)
  }

  return { positiveSelections, negativeSelections }
}

function parseWordCloud360SelectionSnapshotList(value: unknown) {
  if (!Array.isArray(value)) {
    return {
      present: false,
      selections: [] as WordCloud360SelectionSnapshot[],
    }
  }

  const selections = value.flatMap((entry) => {
    if (!isRecord(entry)) return []

    const keywordId = readString(entry.keywordId)
    const keyword = readString(entry.keyword)
    const category = readString(entry.category)
    const polarity = readString(entry.polarity)
    const evaluatorGroup = readString(entry.evaluatorGroup)

    if (!keywordId || !keyword || !category || !polarity || !evaluatorGroup) return []
    if (!isWordCloudCategory(category) || !isWordCloudPolarity(polarity) || !isWordCloudEvaluatorGroup(evaluatorGroup)) return []

    return {
      keywordId,
      keyword,
      category,
      polarity,
      evaluatorGroup,
    } satisfies WordCloud360SelectionSnapshot
  })

  return {
    present: true,
    selections,
  }
}

function mapWordCloud360HistoryEventType(action: string): WordCloud360ResponseHistoryEntry['eventType'] | null {
  switch (action) {
    case 'SAVE_WORD_CLOUD_360_RESPONSE_DRAFT':
      return 'draft_saved'
    case 'SUBMIT_WORD_CLOUD_360_RESPONSE':
      return 'final_submitted'
    case 'WORD_CLOUD_360_FINAL_SUBMIT_REVERTED':
      return 'final_submission_reverted'
    case 'WORD_CLOUD_360_RESPONSE_RESTORED':
      return 'restored'
    default:
      return null
  }
}

function parseWordCloud360HistoryEntry(params: {
  log: {
    id: string
    userId: string
    action: string
    oldValue: unknown
    newValue: unknown
    timestamp: Date
  }
  actorNameById: Map<string, string>
}) {
  const eventType = mapWordCloud360HistoryEventType(params.log.action)
  if (!eventType) return null

  const oldValue = isRecord(params.log.oldValue) ? params.log.oldValue : null
  const newValue = isRecord(params.log.newValue) ? params.log.newValue : null
  const positiveSelections = parseWordCloud360SelectionSnapshotList(newValue?.positiveSelections)
  const negativeSelections = parseWordCloud360SelectionSnapshotList(newValue?.negativeSelections)
  const actorUserId = readString(newValue?.actorUserId) ?? params.log.userId
  const responseStatus = readString(newValue?.responseStatus)
  const positiveCount = readNumber(newValue?.positiveCount) ?? positiveSelections.selections.length
  const negativeCount = readNumber(newValue?.negativeCount) ?? negativeSelections.selections.length

  return {
    revisionId: params.log.id,
    revisionNumber: 0,
    eventType,
    createdAt: params.log.timestamp.toISOString(),
    actorUserId,
    actorName: actorUserId ? params.actorNameById.get(actorUserId) ?? actorUserId : undefined,
    previousStatus: readString(newValue?.previousStatus) ?? readString(oldValue?.previousStatus) ?? readString(oldValue?.status),
    nextStatus: readString(newValue?.nextStatus) ?? readString(newValue?.status),
    responseStatus: responseStatus === 'DRAFT' || responseStatus === 'SUBMITTED' ? responseStatus : undefined,
    positiveCount,
    negativeCount,
    positiveSelections: positiveSelections.selections,
    negativeSelections: negativeSelections.selections,
    reason: readString(newValue?.reason),
    restoredFromRevisionId: readString(newValue?.restoredFromRevisionId),
    canRestore: positiveSelections.present && negativeSelections.present,
  } satisfies WordCloud360ResponseHistoryEntry
}

function mapCloudItems(items: Array<{ keywordId: string; keyword: string; category: WordCloudKeywordCategory; count: number; weight: number }>) {
  return items.map((item) => ({
    keywordId: item.keywordId,
    keyword: item.keyword,
    category: item.category,
    count: item.count,
    weight: item.weight,
  }))
}

function normalizeKeywordText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeKeywordCode(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.toUpperCase() : undefined
}

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function normalizeSpreadsheetHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function readSpreadsheetRows(params: {
  fileName: string
  buffer: Buffer
  requiredHeaders: string[]
  emptyFileMessage: string
  invalidFileMessage: string
}) {
  if (!/\.(csv|xlsx|xls)$/i.test(params.fileName)) {
    throw new AppError(400, 'INVALID_UPLOAD_FILE', params.invalidFileMessage)
  }

  const workbook = XLSX.read(params.buffer, {
    type: 'buffer',
    raw: false,
    codepage: 65001,
  })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined

  if (!sheet) {
    throw new AppError(400, 'EMPTY_UPLOAD_FILE', params.emptyFileMessage)
  }

  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: '',
  })

  const [headerRow, ...dataRows] = rows
  const normalizedHeaders = (headerRow ?? []).map((value) => normalizeSpreadsheetHeader(String(value ?? '')))
  const missingHeaders = params.requiredHeaders.filter((header) => !normalizedHeaders.includes(header))

  if (missingHeaders.length > 0) {
    throw new AppError(
      400,
      'INVALID_UPLOAD_HEADERS',
      `필수 헤더가 누락되었습니다. ${missingHeaders.join(', ')}`
    )
  }

  const headerIndex = new Map<string, number>()
  normalizedHeaders.forEach((header, index) => {
    if (header) headerIndex.set(header, index)
  })

  return dataRows
    .map((row, rowIndex) => {
      const values = Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
      if (!values.some((value) => value !== '')) return null

      const mapped: Record<string, string> = {}
      for (const [header, index] of headerIndex.entries()) {
        mapped[header] = values[index] ?? ''
      }

      return {
        rowNumber: rowIndex + 2,
        values: mapped,
      }
    })
    .filter((row): row is { rowNumber: number; values: Record<string, string> } => Boolean(row))
}

function parseImportBoolean(value: string | undefined, field: string): { value: boolean | undefined; error?: string } {
  const errorMessage = `${field} 값은 TRUE 또는 FALSE로 입력하세요.`
  const normalized = value?.trim().toUpperCase()
  if (!normalized) {
    return {
      value: undefined,
      error: errorMessage,
    }
  }

  if (normalized === 'TRUE') return { value: true }
  if (normalized === 'FALSE') return { value: false }

  return {
    value: undefined,
    error: errorMessage,
  }
}

async function getActorById(actorId: string) {
  return prisma.employee.findUnique({
    where: { id: actorId },
    include: {
      department: {
        include: {
          organization: true,
        },
      },
    },
  })
}

async function getActor(session: AuthenticatedSession) {
  const actor = await getActorById(session.user.id)

  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 로그인 사용자의 직원 정보를 찾을 수 없습니다.')
  }

  return actor
}

async function getWordCloudAdminActor(actorId: string) {
  const actor = await getActorById(actorId)
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 키워드 CSV 업로드를 처리할 수 있습니다.')
  }
  return actor
}

export function buildWordCloudKeywordCsvTemplate() {
  const sampleRows: Array<Record<(typeof WORD_CLOUD_KEYWORD_IMPORT_HEADERS)[number], string>> = [
    {
      keyword_code: 'POS_001',
      keyword: '책임감 있음',
      polarity: 'POSITIVE',
      category: 'ATTITUDE',
      source_type: 'DOCUMENT_FINAL',
      active: 'TRUE',
      display_order: '1',
      governance_flag: 'FALSE',
      note: '문서 확정 키워드 예시',
    },
    {
      keyword_code: 'NEG_001',
      keyword: '책임 회피',
      polarity: 'NEGATIVE',
      category: 'ATTITUDE',
      source_type: 'DOCUMENT_FINAL',
      active: 'TRUE',
      display_order: '101',
      governance_flag: 'FALSE',
      note: '부정 키워드 예시',
    },
    {
      keyword_code: 'GOV_001',
      keyword: '청렴함',
      polarity: 'POSITIVE',
      category: 'ATTITUDE',
      source_type: 'EXTRA_GOVERNANCE',
      active: 'TRUE',
      display_order: '9',
      governance_flag: 'TRUE',
      note: '거버넌스 키워드 예시',
    },
  ]

  const lines = [
    WORD_CLOUD_KEYWORD_IMPORT_HEADERS.join(','),
    ...sampleRows.map((row) =>
      WORD_CLOUD_KEYWORD_IMPORT_HEADERS.map((header) => escapeCsvCell(row[header] ?? '')).join(',')
    ),
  ]

  return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8')
}

function parseWordCloudKeywordCsv(params: { fileName: string; buffer: Buffer }) {
  if (!params.fileName.toLowerCase().endsWith('.csv')) {
    throw new AppError(400, 'INVALID_UPLOAD_FILE', 'CSV 파일만 업로드할 수 있습니다.')
  }

  const csvText = params.buffer.toString('utf8').replace(/^\uFEFF/, '')
  const workbook = XLSX.read(csvText, {
    type: 'string',
    raw: false,
    codepage: 65001,
  })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined

  if (!sheet) {
    throw new AppError(400, 'EMPTY_UPLOAD_FILE', '업로드할 CSV 파일을 선택하세요.')
  }

  const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
    defval: '',
  })
  const [headerRow, ...dataRows] = rows
  const normalizedHeaders = (headerRow ?? []).map((value) => String(value ?? '').trim().toLowerCase())
  const missingHeaders = WORD_CLOUD_KEYWORD_REQUIRED_HEADERS.filter((header) => !normalizedHeaders.includes(header))

  if (missingHeaders.length > 0) {
    throw new AppError(
      400,
      'INVALID_UPLOAD_HEADERS',
      `필수 헤더가 누락되었습니다: ${missingHeaders.join(', ')}`
    )
  }

  const headerIndex = new Map<string, number>()
  normalizedHeaders.forEach((header, index) => {
    if (header) headerIndex.set(header, index)
  })

  const parsedRows: ParsedWordCloudKeywordImportRow[] = []

  dataRows.forEach((row, rowIndex) => {
    const values = Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
    if (!values.some((value) => value !== '')) return

    const read = (header: string) => values[headerIndex.get(header) ?? -1] ?? ''

    parsedRows.push({
      rowNumber: rowIndex + 2,
      keywordCode: read('keyword_code') || undefined,
      keyword: read('keyword'),
      polarity: read('polarity') || undefined,
      category: read('category') || undefined,
      sourceType: read('source_type') || undefined,
      active: read('active') || undefined,
      displayOrder: read('display_order') || undefined,
      governanceFlag: read('governance_flag') || undefined,
      note: read('note') || undefined,
    })
  })

  return {
    fileName: params.fileName,
    rows: parsedRows,
  }
}

function summarizeWordCloudKeywordImportRows(rows: WordCloudKeywordCsvImportRowResult[]): WordCloudKeywordCsvImportSummary {
  return rows.reduce<WordCloudKeywordCsvImportSummary>(
    (summary, row) => {
      summary.totalRows += 1
      if (row.valid) {
        summary.validRows += 1
        if (row.action === 'create') summary.createCount += 1
        else if (row.action === 'update') summary.updateCount += 1
        else if (row.action === 'unchanged') summary.unchangedCount += 1
        else if (row.action === 'deactivate') summary.deactivateCount += 1
      } else {
        summary.invalidRows += 1
      }
      return summary
    },
    {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      createCount: 0,
      updateCount: 0,
      unchangedCount: 0,
      deactivateCount: 0,
    }
  )
}

async function validateWordCloudKeywordCsvImport(params: { actorId: string; fileName: string; buffer: Buffer }) {
  const adminActor = await getWordCloudAdminActor(params.actorId)
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })

  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 이 기능을 사용할 수 있습니다.')
  }

  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 이 기능을 사용할 수 있습니다.')
  }

  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '?꾩옱 ?ъ슜???뺣낫瑜?李얠쓣 ???놁뒿?덈떎.')
  }
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '?대? 湲곕뒫??ъ슜???좏븳???놁뒿?덈떎.')
  }
  const parsed = parseWordCloudKeywordCsv(params)
  const existingKeywords = await prisma.wordCloud360Keyword.findMany({
    where: { orgId: adminActor.department.orgId },
    orderBy: [{ createdAt: 'asc' }],
  })

  const existingByCode = new Map(
    existingKeywords
      .filter((keyword) => normalizeKeywordCode(keyword.keywordCode))
      .map((keyword) => [normalizeKeywordCode(keyword.keywordCode)!, keyword])
  )
  const existingByPair = new Map(
    existingKeywords.map((keyword) => [
      `${keyword.polarity}:${normalizeKeywordText(keyword.keyword).toLocaleLowerCase('ko-KR')}`,
      keyword,
    ])
  )

  const seenCodes = new Map<string, number>()
  const seenPairs = new Map<string, number>()
  const rows: WordCloudKeywordCsvImportRowResult[] = []
  const validRows: ValidatedWordCloudKeywordImportRow[] = []

  for (const row of parsed.rows) {
    const issues: WordCloudKeywordCsvImportIssue[] = []
    const normalizedKeyword = normalizeKeywordText(row.keyword)
    const normalizedKeywordCode = normalizeKeywordCode(row.keywordCode)
    const normalizedPolarity = row.polarity?.trim().toUpperCase()
    const normalizedCategory = row.category?.trim().toUpperCase()
    const normalizedSourceType = row.sourceType?.trim().toUpperCase()

    if (!normalizedKeyword) {
      issues.push({ field: 'keyword', message: '키워드는 비워 둘 수 없습니다.' })
    }

    if (normalizedKeywordCode && !/^[A-Z0-9_-]{2,50}$/.test(normalizedKeywordCode)) {
      issues.push({ field: 'keyword_code', message: 'keyword_code는 영문, 숫자, -, _ 조합으로 입력하세요.' })
    }

    const polarity = normalizedPolarity as WordCloudKeywordPolarity | undefined
    if (!normalizedPolarity || !['POSITIVE', 'NEGATIVE'].includes(normalizedPolarity)) {
      issues.push({ field: 'polarity', message: 'polarity는 POSITIVE 또는 NEGATIVE만 사용할 수 있습니다.' })
    }

    const category = (normalizedCategory || 'OTHER') as WordCloudKeywordCategory
    if (!['ATTITUDE', 'ABILITY', 'BOTH', 'OTHER'].includes(category)) {
      issues.push({ field: 'category', message: 'category는 ATTITUDE, ABILITY, BOTH, OTHER 중 하나여야 합니다.' })
    }

    const sourceType = (normalizedSourceType || 'IMPORTED') as WordCloudKeywordSourceType
    if (!['DOCUMENT_FINAL', 'EXTRA_GOVERNANCE', 'ADMIN_ADDED', 'IMPORTED'].includes(sourceType)) {
      issues.push({
        field: 'source_type',
        message: 'source_type은 DOCUMENT_FINAL, EXTRA_GOVERNANCE, ADMIN_ADDED, IMPORTED 중 하나여야 합니다.',
      })
    }

    const activeResult = parseImportBoolean(row.active, 'active')
    if (activeResult.error) {
      issues.push({ field: 'active', message: activeResult.error })
    }

    const governanceResult = row.governanceFlag?.trim()
      ? parseImportBoolean(row.governanceFlag, 'governance_flag')
      : { value: false as boolean | undefined }
    if (governanceResult.error) {
      issues.push({ field: 'governance_flag', message: governanceResult.error })
    }

    let displayOrder = 0
    if (row.displayOrder?.trim()) {
      const parsedDisplayOrder = Number(row.displayOrder.trim())
      if (!Number.isInteger(parsedDisplayOrder) || parsedDisplayOrder < 0 || parsedDisplayOrder > 9999) {
        issues.push({ field: 'display_order', message: 'display_order는 0 이상 9999 이하 정수만 입력할 수 있습니다.' })
      } else {
        displayOrder = parsedDisplayOrder
      }
    }

    const note = row.note?.trim() || undefined
    if (note && note.length > 500) {
      issues.push({ field: 'note', message: 'note는 500자 이하여야 합니다.' })
    }

    if (normalizedKeywordCode) {
      const firstRow = seenCodes.get(normalizedKeywordCode)
      if (firstRow) {
        issues.push({ field: 'keyword_code', message: `같은 keyword_code가 파일 ${firstRow}행과 중복되었습니다.` })
      } else {
        seenCodes.set(normalizedKeywordCode, row.rowNumber)
      }
    }

    const pairKey =
      polarity && normalizedKeyword
        ? `${polarity}:${normalizedKeyword.toLocaleLowerCase('ko-KR')}`
        : undefined
    if (pairKey) {
      const firstRow = seenPairs.get(pairKey)
      if (firstRow) {
        issues.push({ field: 'keyword', message: `같은 polarity/keyword 조합이 파일 ${firstRow}행과 중복되었습니다.` })
      } else {
        seenPairs.set(pairKey, row.rowNumber)
      }
    }

    const existingByKeywordCode = normalizedKeywordCode ? existingByCode.get(normalizedKeywordCode) : undefined
    const existingByKeywordPair = pairKey ? existingByPair.get(pairKey) : undefined
    if (
      existingByKeywordCode &&
      existingByKeywordPair &&
      existingByKeywordCode.id !== existingByKeywordPair.id
    ) {
      issues.push({
        field: 'keyword_code',
        message: 'keyword_code와 (polarity, keyword)가 서로 다른 기존 키워드를 가리키고 있습니다.',
      })
    }

    const targetKeyword = existingByKeywordCode ?? existingByKeywordPair
    if (
      targetKeyword &&
      normalizedKeywordCode &&
      targetKeyword.keywordCode &&
      normalizeKeywordCode(targetKeyword.keywordCode) !== normalizedKeywordCode
    ) {
      issues.push({
        field: 'keyword_code',
        message: '기존 키워드에 다른 keyword_code가 이미 연결되어 있습니다.',
      })
    }

    const active = activeResult.value ?? false
    const governanceFlag = governanceResult.value ?? false

    let action: WordCloudKeywordCsvImportAction = 'create'
    if (targetKeyword) {
      const nextKeywordCode = normalizedKeywordCode ?? normalizeKeywordCode(targetKeyword.keywordCode)
      const unchanged =
        normalizeKeywordText(targetKeyword.keyword) === normalizedKeyword &&
        targetKeyword.polarity === polarity &&
        targetKeyword.category === category &&
        targetKeyword.sourceType === sourceType &&
        targetKeyword.active === active &&
        targetKeyword.displayOrder === displayOrder &&
        (targetKeyword.note ?? undefined) === note &&
        targetKeyword.warningFlag === governanceFlag &&
        normalizeKeywordCode(targetKeyword.keywordCode) === nextKeywordCode

      if (unchanged) action = 'unchanged'
      else if (targetKeyword.active && !active) action = 'deactivate'
      else action = 'update'
    }

    const rowResult: WordCloudKeywordCsvImportRowResult = {
      rowNumber: row.rowNumber,
      keywordCode: normalizedKeywordCode,
      keyword: normalizedKeyword || row.keyword.trim(),
      polarity: normalizedPolarity,
      category,
      sourceType,
      action,
      valid: issues.length === 0,
      issues,
    }
    rows.push(rowResult)

    if (!issues.length && polarity) {
      validRows.push({
        ...row,
        keyword: normalizedKeyword,
        normalizedKeyword,
        normalizedKeywordCode,
        polarity,
        category,
        sourceType,
        active,
        displayOrder,
        governanceFlag,
        note,
        action,
        targetKeywordId: targetKeyword?.id,
      })
    }
  }

  return {
    actor,
    fileName: parsed.fileName,
    rows,
    validRows,
    summary: summarizeWordCloudKeywordImportRows(rows),
  }
}

export async function previewWordCloudKeywordCsvImport(params: {
  actorId: string
  fileName: string
  buffer: Buffer
}): Promise<WordCloudKeywordCsvImportResult> {
  const validation = await validateWordCloudKeywordCsvImport(params)
  return {
    mode: 'preview',
    fileName: validation.fileName,
    summary: validation.summary,
    rows: validation.rows,
  }
}

export async function applyWordCloudKeywordCsvImport(params: {
  actorId: string
  fileName: string
  buffer: Buffer
}): Promise<WordCloudKeywordCsvImportResult> {
  const validation = await validateWordCloudKeywordCsvImport(params)

  let createdCount = 0
  let updatedCount = 0
  const unchangedCount = validation.summary.unchangedCount
  let deactivatedCount = 0

  if (validation.validRows.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const row of validation.validRows) {
        if (row.action === 'unchanged') continue

        if (row.targetKeywordId) {
          await tx.wordCloud360Keyword.update({
            where: { id: row.targetKeywordId },
            data: {
              keywordCode: row.normalizedKeywordCode ?? null,
              keyword: row.normalizedKeyword,
              polarity: row.polarity,
              category: row.category,
              sourceType: row.sourceType,
              active: row.active,
              displayOrder: row.displayOrder,
              note: row.note ?? null,
              warningFlag: row.governanceFlag,
            },
          })
          if (row.action === 'deactivate') deactivatedCount += 1
          else updatedCount += 1
        } else {
          await tx.wordCloud360Keyword.create({
            data: {
              orgId: validation.actor.department.orgId,
              keywordCode: row.normalizedKeywordCode ?? null,
              keyword: row.normalizedKeyword,
              polarity: row.polarity,
              category: row.category,
              sourceType: row.sourceType,
              active: row.active,
              displayOrder: row.displayOrder,
              note: row.note ?? null,
              warningFlag: row.governanceFlag,
            },
          })
          createdCount += 1
        }
      }
    })
  }

  const uploadHistory = await prisma.uploadHistory.create({
    data: {
      uploadType: 'WORD_CLOUD_360_KEYWORD_CSV',
      uploaderId: validation.actor.id,
      fileName: validation.fileName,
      totalRows: validation.summary.totalRows,
      successCount: createdCount + updatedCount + unchangedCount + deactivatedCount,
      failCount: validation.summary.invalidRows,
      errorDetails: {
        importMode: 'UPSERT',
        createdCount,
        updatedCount,
        unchangedCount,
        deactivatedCount,
        rows: validation.rows.filter((row) => !row.valid).slice(0, 100),
      },
    },
  })

  await createAuditLog({
    userId: validation.actor.id,
    action: 'WORD_CLOUD_360_KEYWORD_CSV_IMPORT',
    entityType: 'WORD_CLOUD_360_KEYWORD',
    entityId: uploadHistory.id,
    newValue: {
      fileName: validation.fileName,
      totalRows: validation.summary.totalRows,
      createdCount,
      updatedCount,
      unchangedCount,
      deactivatedCount,
      failedCount: validation.summary.invalidRows,
    },
  })

  return {
    mode: 'apply',
    fileName: validation.fileName,
    summary: validation.summary,
    rows: validation.rows,
    applyResult: {
      createdCount,
      updatedCount,
      unchangedCount,
      deactivatedCount,
      failedCount: validation.summary.invalidRows,
      uploadHistoryId: uploadHistory.id,
    },
  }
}

const WORD_CLOUD_TARGET_REQUIRED_HEADERS = ['employeenumber'] as const
const WORD_CLOUD_COMPARISON_REQUIRED_HEADERS = [
  'employeenumber',
  'department',
  'responsecount',
  'thresholdmet',
  'polarity',
  'keyword',
  'count',
] as const

function parseThresholdMet(value: string) {
  const normalized = value.trim().toUpperCase()
  return ['Y', 'YES', 'TRUE', '1'].includes(normalized)
}

function buildTopKeywordLabels(
  counts: Map<string, { polarity: WordCloudKeywordPolarity; count: number }>,
  polarity: WordCloudKeywordPolarity
) {
  return Array.from(counts.entries())
    .filter(([, value]) => value.polarity === polarity)
    .sort((left, right) => {
      if (right[1].count !== left[1].count) return right[1].count - left[1].count
      return left[0].localeCompare(right[0], 'ko-KR')
    })
    .slice(0, 3)
    .map(([keyword]) => keyword)
}

function buildComparisonInsight(params: {
  responseDelta: number
  topPositive?: { keyword: string; delta: number }
  topNegative?: { keyword: string; delta: number }
}) {
  const parts: string[] = []

  if (params.responseDelta > 0) {
    parts.push(`응답 수가 ${params.responseDelta}건 늘었습니다.`)
  } else if (params.responseDelta < 0) {
    parts.push(`응답 수가 ${Math.abs(params.responseDelta)}건 줄었습니다.`)
  }

  if (params.topPositive && params.topPositive.delta > 0) {
    parts.push(`긍정 키워드 '${params.topPositive.keyword}' 언급이 증가했습니다.`)
  }

  if (params.topNegative && params.topNegative.delta > 0) {
    parts.push(`부정 키워드 '${params.topNegative.keyword}' 언급이 늘어 확인이 필요합니다.`)
  }

  return parts.join(' ') || '현재 기준으로 두드러진 변화는 크지 않습니다.'
}

async function buildCurrentWordCloudDepartmentReport(params: {
  cycleId: string
  minimumResponses: number
}) {
  const responses = await prisma.wordCloud360Response.findMany({
    where: {
      cycleId: params.cycleId,
      status: 'SUBMITTED',
    },
    include: {
      evaluatee: {
        include: {
          department: true,
        },
      },
      items: true,
    },
  })

  const grouped = new Map<string, typeof responses>()
  for (const response of responses) {
    const department = response.evaluatee.department.deptName
    const bucket = grouped.get(department) ?? []
    bucket.push(response)
    grouped.set(department, bucket)
  }

  return Array.from(grouped.entries())
    .map(([department, departmentResponses]) => {
      const aggregated = aggregateWordCloudResponses({
        responses: departmentResponses.map((response) => ({
          status: response.status,
          evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
          items: response.items.map((item) => ({
            keywordId: item.keywordId,
            keywordTextSnapshot: item.keywordTextSnapshot,
            polarity: item.polarity,
            category: item.category,
            evaluatorGroup: item.evaluatorGroup,
          })),
        })),
        minimumResponses: params.minimumResponses,
      })

      const keywordCounts = new Map<string, { polarity: WordCloudKeywordPolarity; count: number }>()
      for (const item of [...aggregated.positiveKeywords, ...aggregated.negativeKeywords]) {
        keywordCounts.set(item.keyword, {
          polarity: item.polarity,
          count: item.count,
        })
      }

      return {
        department,
        responseCount: aggregated.responseCount,
        thresholdMet: aggregated.thresholdMet,
        keywordCounts,
      }
    })
    .sort((left, right) => left.department.localeCompare(right.department, 'ko-KR'))
}

export async function applyWordCloud360TargetUpload(params: {
  actorId: string
  cycleId: string
  fileName: string
  buffer: Buffer
}): Promise<WordCloudTargetUploadResult> {
  const { actor, cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 대상자 업로드를 처리할 수 있습니다.')
  }

  const parsedRows = readSpreadsheetRows({
    fileName: params.fileName,
    buffer: params.buffer,
    requiredHeaders: [...WORD_CLOUD_TARGET_REQUIRED_HEADERS],
    emptyFileMessage: '업로드할 대상자 파일을 선택해 주세요.',
    invalidFileMessage: 'CSV, XLSX, XLS 형식만 업로드할 수 있습니다.',
  })

  const employees = await prisma.employee.findMany({
    where: {
      department: {
        orgId: actor.department.orgId,
      },
      status: {
        in: ['ACTIVE', 'ON_LEAVE'],
      },
    },
    include: {
      department: true,
    },
    orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
  })

  const employeesByNumber = new Map(
    employees.map((employee) => [employee.empId.trim().toUpperCase(), employee])
  )
  const duplicateTargetNumbers = new Set<string>()
  const seenTargetNumbers = new Set<string>()
  for (const row of parsedRows) {
    const employeeNumber = row.values.employeenumber?.trim().toUpperCase() ?? ''
    if (!employeeNumber) continue
    if (seenTargetNumbers.has(employeeNumber)) duplicateTargetNumbers.add(employeeNumber)
    seenTargetNumbers.add(employeeNumber)
  }

  const cycleGroups = Array.isArray(cycle.evaluatorGroups)
    ? (cycle.evaluatorGroups as WordCloudEvaluatorGroup[])
    : ['MANAGER', 'PEER', 'SUBORDINATE']

  const suggestionPool = buildSuggestedWordCloudAssignments({
    cycleId: cycle.id,
    employees: employees.map((employee) => ({
      id: employee.id,
      deptId: employee.deptId,
      managerId: employee.managerId,
      status: employee.status,
    })),
    includeSelf: cycleGroups.includes('SELF'),
    peerLimit: 3,
    subordinateLimit: 3,
  }).filter((assignment) => cycleGroups.includes(assignment.evaluatorGroup))

  const validTargets: Array<{ rowNumber: number; employee: (typeof employees)[number] }> = []
  const rows = parsedRows.map((row) => {
    const employeeNumber = row.values.employeenumber?.trim().toUpperCase() ?? ''
    const issues: WordCloudKeywordCsvImportIssue[] = []

    if (!employeeNumber) {
      issues.push({ field: 'employee_number', message: '사번을 입력해 주세요.' })
    }
    if (employeeNumber && duplicateTargetNumbers.has(employeeNumber)) {
      issues.push({ field: 'employee_number', message: '같은 사번이 파일에 중복되어 있습니다.' })
    }

    const employee = employeeNumber ? employeesByNumber.get(employeeNumber) : undefined
    if (employeeNumber && !employee) {
      issues.push({ field: 'employee_number', message: '조직 내에서 일치하는 구성원을 찾을 수 없습니다.' })
    }

    if (!issues.length && employee) {
      validTargets.push({ rowNumber: row.rowNumber, employee })
    }

    return {
      rowNumber: row.rowNumber,
      employeeNumber,
      employeeName: employee?.empName,
      department: employee?.department.deptName,
      valid: issues.length === 0,
      issues,
      createdAssignmentCount: 0,
      existingAssignmentCount: 0,
      groups: [] as WordCloudEvaluatorGroup[],
    }
  })

  const uniqueTargetIds = Array.from(new Set(validTargets.map((item) => item.employee.id)))
  const existingAssignments = uniqueTargetIds.length
    ? await prisma.wordCloud360Assignment.findMany({
        where: {
          cycleId: cycle.id,
          evaluateeId: { in: uniqueTargetIds },
        },
        select: {
          evaluatorId: true,
          evaluateeId: true,
          evaluatorGroup: true,
        },
      })
    : []
  const existingKeys = new Set(
    existingAssignments.map(
      (assignment) =>
        `${cycle.id}:${assignment.evaluatorId}:${assignment.evaluateeId}:${assignment.evaluatorGroup}`
    )
  )

  const assignmentsToSave = suggestionPool.filter((assignment) => uniqueTargetIds.includes(assignment.evaluateeId))

  if (assignmentsToSave.length > 0) {
    await saveWordCloud360Assignments({
      actorId: params.actorId,
      cycleId: cycle.id,
      assignments: assignmentsToSave,
    })
  }

  const createdByTarget = new Map<string, number>()
  const existingByTarget = new Map<string, number>()
  const groupsByTarget = new Map<string, Set<WordCloudEvaluatorGroup>>()
  for (const assignment of assignmentsToSave) {
    const key = `${assignment.cycleId}:${assignment.evaluatorId}:${assignment.evaluateeId}:${assignment.evaluatorGroup}`
    const targetMap = existingKeys.has(key) ? existingByTarget : createdByTarget
    targetMap.set(assignment.evaluateeId, (targetMap.get(assignment.evaluateeId) ?? 0) + 1)
    const groupBucket = groupsByTarget.get(assignment.evaluateeId) ?? new Set<WordCloudEvaluatorGroup>()
    groupBucket.add(assignment.evaluatorGroup)
    groupsByTarget.set(assignment.evaluateeId, groupBucket)
  }

  const completedRows = rows.map((row) => {
    const employee = row.employeeNumber ? employeesByNumber.get(row.employeeNumber) : undefined
    if (!row.valid || !employee) return row

    return {
      ...row,
      createdAssignmentCount: createdByTarget.get(employee.id) ?? 0,
      existingAssignmentCount: existingByTarget.get(employee.id) ?? 0,
      groups: Array.from(groupsByTarget.get(employee.id) ?? []),
    }
  })

  const summary = completedRows.reduce(
    (accumulator, row) => {
      accumulator.totalRows += 1
      if (row.valid) {
        accumulator.validRows += 1
        accumulator.targetCount += 1
        accumulator.createdAssignmentCount += row.createdAssignmentCount
        accumulator.existingAssignmentCount += row.existingAssignmentCount
      } else {
        accumulator.invalidRows += 1
      }
      return accumulator
    },
    {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      targetCount: 0,
      createdAssignmentCount: 0,
      existingAssignmentCount: 0,
    }
  )

  const uploadHistory = await prisma.uploadHistory.create({
    data: {
      uploadType: 'WORD_CLOUD_360_TARGET_UPLOAD',
      uploaderId: actor.id,
      fileName: params.fileName,
      totalRows: summary.totalRows,
      successCount: summary.validRows,
      failCount: summary.invalidRows,
      errorDetails: {
        createdAssignmentCount: summary.createdAssignmentCount,
        existingAssignmentCount: summary.existingAssignmentCount,
        rows: completedRows.filter((row) => !row.valid).slice(0, 100),
      },
    },
  })

  await createAuditLog({
    userId: actor.id,
    action: 'WORD_CLOUD_360_TARGET_UPLOAD',
    entityType: 'WORD_CLOUD_360_ASSIGNMENT',
    entityId: cycle.id,
    newValue: {
      fileName: params.fileName,
      targetCount: summary.targetCount,
      createdAssignmentCount: summary.createdAssignmentCount,
      existingAssignmentCount: summary.existingAssignmentCount,
      failedRows: summary.invalidRows,
      uploadHistoryId: uploadHistory.id,
    },
  })

  return {
    fileName: params.fileName,
    summary,
    rows: completedRows,
    uploadHistoryId: uploadHistory.id,
  }
}

export async function generateWordCloudComparisonReport(params: {
  actorId: string
  cycleId: string
  fileName: string
  buffer: Buffer
}): Promise<WordCloudComparisonReport> {
  const { actor, cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 비교 리포트를 만들 수 있습니다.')
  }

  const parsedRows = readSpreadsheetRows({
    fileName: params.fileName,
    buffer: params.buffer,
    requiredHeaders: [...WORD_CLOUD_COMPARISON_REQUIRED_HEADERS],
    emptyFileMessage: '비교할 서베이 결과 파일을 선택해 주세요.',
    invalidFileMessage: 'CSV, XLSX, XLS 형식만 업로드할 수 있습니다.',
  })

  const baselineDepartments = new Map<
    string,
    {
      people: Map<string, number>
      keywordCounts: Map<string, { polarity: WordCloudKeywordPolarity; count: number }>
    }
  >()
  let hiddenBaselineRows = 0

  for (const row of parsedRows) {
    const employeeNumber = row.values.employeenumber?.trim()
    const department = row.values.department?.trim()
    const responseCountText = row.values.responsecount?.trim()
    const thresholdMet = parseThresholdMet(row.values.thresholdmet ?? '')
    const polarity = (row.values.polarity?.trim().toUpperCase() ?? '') as WordCloudKeywordPolarity
    const keyword = row.values.keyword?.trim()
    const countText = row.values.count?.trim()

    if (!employeeNumber || !responseCountText || !keyword || !countText) {
      continue
    }

    if (!thresholdMet || !department) {
      hiddenBaselineRows += 1
      continue
    }

    if (polarity !== 'POSITIVE' && polarity !== 'NEGATIVE') {
      continue
    }

    const responseCount = Number(responseCountText)
    const count = Number(countText)
    if (!Number.isFinite(responseCount) || !Number.isFinite(count)) {
      continue
    }

    const bucket = baselineDepartments.get(department) ?? {
      people: new Map<string, number>(),
      keywordCounts: new Map<string, { polarity: WordCloudKeywordPolarity; count: number }>(),
    }
    if (!bucket.people.has(employeeNumber)) {
      bucket.people.set(employeeNumber, responseCount)
    }
    const keywordBucket = bucket.keywordCounts.get(keyword)
    if (keywordBucket) {
      keywordBucket.count += count
    } else {
      bucket.keywordCounts.set(keyword, { polarity, count })
    }
    baselineDepartments.set(department, bucket)
  }

  const currentDepartmentsRaw = await buildCurrentWordCloudDepartmentReport({
    cycleId: cycle.id,
    minimumResponses: cycle.resultPrivacyThreshold,
  })
  const currentDepartments = new Map(
    currentDepartmentsRaw.map((department) => [department.department, department])
  )

  const allDepartmentNames = Array.from(
    new Set([...baselineDepartments.keys(), ...currentDepartments.keys()])
  ).sort((left, right) => left.localeCompare(right, 'ko-KR'))

  const departments = allDepartmentNames.map((department) => {
    const baseline = baselineDepartments.get(department)
    const current = currentDepartments.get(department)

    const baselineResponseCount = baseline
      ? Array.from(baseline.people.values()).reduce((sum, value) => sum + value, 0)
      : 0
    const currentResponseCount = current?.responseCount ?? 0
    const changedKeywords = Array.from(
      new Set([
        ...Array.from(baseline?.keywordCounts.keys() ?? []),
        ...Array.from(current?.keywordCounts.keys() ?? []),
      ])
    )
      .map((keyword) => {
        const baselineValue = baseline?.keywordCounts.get(keyword)
        const currentValue = current?.keywordCounts.get(keyword)
        const polarity = currentValue?.polarity ?? baselineValue?.polarity ?? 'POSITIVE'
        return {
          keyword,
          polarity,
          delta: (currentValue?.count ?? 0) - (baselineValue?.count ?? 0),
        }
      })
      .filter((item) => item.delta !== 0)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 5)

    const topPositive = changedKeywords.find((item) => item.polarity === 'POSITIVE' && item.delta > 0)
    const topNegative = changedKeywords.find((item) => item.polarity === 'NEGATIVE' && item.delta > 0)

    return {
      department,
      baselineResponseCount,
      currentResponseCount,
      responseDelta: currentResponseCount - baselineResponseCount,
      baselineTopPositiveKeywords: buildTopKeywordLabels(baseline?.keywordCounts ?? new Map(), 'POSITIVE'),
      currentTopPositiveKeywords: buildTopKeywordLabels(current?.keywordCounts ?? new Map(), 'POSITIVE'),
      baselineTopNegativeKeywords: buildTopKeywordLabels(baseline?.keywordCounts ?? new Map(), 'NEGATIVE'),
      currentTopNegativeKeywords: buildTopKeywordLabels(current?.keywordCounts ?? new Map(), 'NEGATIVE'),
      changedKeywords,
      insight: buildComparisonInsight({
        responseDelta: currentResponseCount - baselineResponseCount,
        topPositive,
        topNegative,
      }),
    }
  })

  const responseShift = departments
    .filter((department) => department.responseDelta !== 0)
    .sort((left, right) => Math.abs(right.responseDelta) - Math.abs(left.responseDelta))[0]
  const positiveShift = departments
    .flatMap((department) =>
      department.changedKeywords
        .filter((keyword) => keyword.polarity === 'POSITIVE' && keyword.delta > 0)
        .map((keyword) => ({ department: department.department, keyword: keyword.keyword, delta: keyword.delta }))
    )
    .sort((left, right) => right.delta - left.delta)[0]
  const negativeShift = departments
    .flatMap((department) =>
      department.changedKeywords
        .filter((keyword) => keyword.polarity === 'NEGATIVE' && keyword.delta > 0)
        .map((keyword) => ({ department: department.department, keyword: keyword.keyword, delta: keyword.delta }))
    )
    .sort((left, right) => right.delta - left.delta)[0]

  const report: WordCloudComparisonReport = {
    fileName: params.fileName,
    summary: {
      currentCycleName: cycle.cycleName,
      baselineDepartmentCount: baselineDepartments.size,
      currentDepartmentCount: currentDepartments.size,
      comparedDepartmentCount: departments.length,
      baselineResponseCount: departments.reduce((sum, department) => sum + department.baselineResponseCount, 0),
      currentResponseCount: departments.reduce((sum, department) => sum + department.currentResponseCount, 0),
      hiddenBaselineRows,
      hiddenCurrentDepartments: currentDepartmentsRaw.filter((department) => !department.thresholdMet).length,
      largestResponseChange: responseShift
        ? { department: responseShift.department, delta: responseShift.responseDelta }
        : undefined,
      largestPositiveShift: positiveShift,
      largestNegativeShift: negativeShift,
    },
    departments,
  }

  const uploadHistory = await prisma.uploadHistory.create({
    data: {
      uploadType: 'WORD_CLOUD_360_COMPARISON_UPLOAD',
      uploaderId: actor.id,
      fileName: params.fileName,
      totalRows: parsedRows.length,
      successCount: departments.length,
      failCount: hiddenBaselineRows,
      errorDetails: {
        comparedDepartmentCount: departments.length,
        hiddenBaselineRows,
      },
    },
  })

  await createAuditLog({
    userId: actor.id,
    action: 'GENERATE_WORD_CLOUD_360_COMPARISON_REPORT',
    entityType: 'WORD_CLOUD_360_CYCLE',
    entityId: cycle.id,
    newValue: {
      fileName: params.fileName,
      comparedDepartmentCount: departments.length,
      uploadHistoryId: uploadHistory.id,
    },
  })

  return report
}

async function loadWordCloudSection<T>(params: {
  title: string
  alerts: SectionAlert[]
  fallback: T
  loader: () => Promise<T>
}) {
  try {
    return await params.loader()
  } catch (error) {
    params.alerts.push({
      title: params.title,
      description: error instanceof Error ? error.message : `${params.title} 데이터를 불러오지 못했습니다.`,
    })
    return params.fallback
  }
}

async function ensureCycleAccess(params: { cycleId: string; actorId: string }) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  const cycle = await prisma.wordCloud360Cycle.findUnique({
    where: { id: params.cycleId },
  })
  if (!cycle || cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'CYCLE_NOT_FOUND', '다면평가 주기를 찾을 수 없습니다.')
  }

  return { actor, cycle }
}

async function findLatestWordCloud360ReopenAudit(responseId: string) {
  return prisma.auditLog.findFirst({
    where: {
      entityType: 'WORD_CLOUD_360_RESPONSE',
      entityId: responseId,
      action: {
        in: [...WORD_CLOUD_360_REOPEN_ACTIONS],
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
  })
}

async function buildAdminView(params: {
  actorOrgId: string
  selectedCycle: Awaited<ReturnType<typeof prisma.wordCloud360Cycle.findMany>>[number] | null
  alerts: SectionAlert[]
}) {
  const keywordPool = await loadWordCloudSection({
    title: '키워드 풀',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['keywordPool'],
    loader: async () => {
      const keywords = await prisma.wordCloud360Keyword.findMany({
        where: { orgId: params.actorOrgId },
        orderBy: [{ polarity: 'asc' }, { displayOrder: 'asc' }, { keyword: 'asc' }],
      })

      return keywords.map((keyword) => ({
        keywordId: keyword.id,
        keywordCode: keyword.keywordCode ?? undefined,
        keyword: keyword.keyword,
        polarity: keyword.polarity,
        polarityLabel: WORD_CLOUD_POLARITY_LABELS[keyword.polarity],
        category: keyword.category,
        categoryLabel: WORD_CLOUD_CATEGORY_LABELS[keyword.category],
        sourceType: keyword.sourceType,
        sourceTypeLabel: WORD_CLOUD_SOURCE_TYPE_LABELS[keyword.sourceType],
        active: keyword.active,
        displayOrder: keyword.displayOrder,
        warningFlag: keyword.warningFlag,
        note: keyword.note ?? undefined,
      }))
    },
  })

  const employees = await loadWordCloudSection({
    title: '직원 편성',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['employees'],
    loader: async () => {
      const members = await prisma.employee.findMany({
        where: {
          department: {
            orgId: params.actorOrgId,
          },
        },
        include: {
          department: true,
        },
        orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
      })

      return members.map((employee) => ({
        id: employee.id,
        employeeNumber: employee.empId,
        name: employee.empName,
        department: employee.department.deptName,
        managerId: employee.managerId,
        status: employee.status,
      }))
    },
  })

  if (!params.selectedCycle) {
    return {
      keywordPool,
      employees,
      assignments: [],
      progress: {
        targetCount: 0,
        assignmentCount: 0,
        submittedCount: 0,
        draftCount: 0,
        pendingCount: 0,
      },
      results: [],
    } satisfies NonNullable<WordCloud360PageData['adminView']>
  }

  const selectedCycle = params.selectedCycle

  const assignments = await loadWordCloudSection({
    title: '평가자 편성',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['assignments'],
    loader: async () => {
      const actorNameById = new Map(employees.map((employee) => [employee.id, employee.name]))
      const records = await prisma.wordCloud360Assignment.findMany({
        where: { cycleId: selectedCycle.id },
        include: {
          evaluator: { include: { department: true } },
          evaluatee: { include: { department: true } },
          response: {
            include: {
              items: true,
            },
          },
        },
        orderBy: [{ evaluatee: { empName: 'asc' } }, { evaluatorGroup: 'asc' }, { evaluator: { empName: 'asc' } }],
      })

      const responseIds = records.flatMap((record) => (record.response?.id ? [record.response.id] : []))
      const historyLogs =
        responseIds.length > 0
          ? await prisma.auditLog.findMany({
              where: {
                entityType: 'WORD_CLOUD_360_RESPONSE',
                entityId: {
                  in: responseIds,
                },
                action: {
                  in: [...WORD_CLOUD_360_HISTORY_ACTIONS],
                },
              },
              orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
            })
          : []

      const historyByResponseId = new Map<string, typeof historyLogs>()
      for (const log of historyLogs) {
        if (!log.entityId) continue
        const bucket = historyByResponseId.get(log.entityId) ?? []
        bucket.push(log)
        historyByResponseId.set(log.entityId, bucket)
      }

      return records.map((record) => {
        const currentSnapshot = record.response?.items
          ? buildWordCloud360SelectionSnapshotFromItems(record.response.items)
          : { positiveSelections: [] as WordCloud360SelectionSnapshot[], negativeSelections: [] as WordCloud360SelectionSnapshot[] }
        const parsedHistoryEntries = record.response?.id
          ? ((historyByResponseId.get(record.response.id) ?? [])
              .map((log) =>
                parseWordCloud360HistoryEntry({
                  log,
                  actorNameById,
                })
              )
              .filter(Boolean) as WordCloud360ResponseHistoryEntry[])
          : []
        const historyEntries: WordCloud360ResponseHistoryEntry[] = parsedHistoryEntries
          .map((entry, index) => ({
            ...entry,
            revisionNumber: index + 1,
          }))
          .reverse()

        const history =
          historyEntries.length > 0
            ? historyEntries
            : record.response
              ? [
                  {
                    revisionId: `current-${record.response.id}`,
                    revisionNumber: 1,
                    eventType: record.response.status === 'SUBMITTED' ? 'final_submitted' : 'draft_saved',
                    createdAt:
                      toIso(record.response.submittedAt) ??
                      toIso(record.draftSavedAt) ??
                      toIso(record.submittedAt) ??
                      new Date().toISOString(),
                    actorUserId: record.evaluatorId,
                    actorName: record.evaluator.empName,
                    nextStatus: record.status === 'SUBMITTED' ? 'SUBMITTED' : 'IN_PROGRESS',
                    responseStatus: record.response.status,
                    positiveCount: currentSnapshot.positiveSelections.length,
                    negativeCount: currentSnapshot.negativeSelections.length,
                    positiveSelections: currentSnapshot.positiveSelections,
                    negativeSelections: currentSnapshot.negativeSelections,
                    canRestore: false,
                  } satisfies WordCloud360ResponseHistoryEntry,
                ]
              : []

        return {
          assignmentId: record.id,
          evaluatorId: record.evaluatorId,
          evaluatorName: record.evaluator.empName,
          evaluateeId: record.evaluateeId,
          evaluateeName: record.evaluatee.empName,
          department: record.evaluatee.department.deptName,
          evaluatorGroup: record.evaluatorGroup,
          status: record.status,
          responseId: record.response?.id ?? undefined,
          responseStatus: record.response?.status ?? undefined,
          positiveSelectionCount: currentSnapshot.positiveSelections.length,
          negativeSelectionCount: currentSnapshot.negativeSelections.length,
          history,
          submittedAt: toIso(record.submittedAt),
        }
      })
    },
  })

  const results = await loadWordCloudSection({
    title: '결과 집계',
    alerts: params.alerts,
    fallback: [] as NonNullable<WordCloud360PageData['adminView']>['results'],
    loader: async () => {
      const responses = await prisma.wordCloud360Response.findMany({
        where: {
          cycleId: selectedCycle.id,
          status: 'SUBMITTED',
        },
        include: {
          evaluatee: {
            include: {
              department: true,
            },
          },
          items: true,
        },
      })

      const grouped = new Map<string, typeof responses>()
      for (const response of responses) {
        const bucket = grouped.get(response.evaluateeId) ?? []
        bucket.push(response)
        grouped.set(response.evaluateeId, bucket)
      }

      return Array.from(grouped.entries()).map(([evaluateeId, employeeResponses]) => {
        const evaluatee = employeeResponses[0]?.evaluatee
        const aggregated = aggregateWordCloudResponses({
          responses: employeeResponses.map((response) => ({
            status: response.status,
            evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
            items: response.items.map((item) => ({
              keywordId: item.keywordId,
              keywordTextSnapshot: item.keywordTextSnapshot,
              polarity: item.polarity,
              category: item.category,
              evaluatorGroup: item.evaluatorGroup,
            })),
          })),
          minimumResponses: selectedCycle.resultPrivacyThreshold,
        })

        return {
          evaluateeId,
          evaluateeName: evaluatee?.empName ?? '미지정',
          department: evaluatee?.department.deptName ?? '-',
          responseCount: aggregated.responseCount,
          thresholdMet: aggregated.thresholdMet,
          positiveTopKeywords: mapCloudItems(aggregated.positiveKeywords.slice(0, 10)),
          negativeTopKeywords: mapCloudItems(aggregated.negativeKeywords.slice(0, 10)),
        }
      })
    },
  })

  const responseStatusCounts = assignments.reduce(
    (accumulator, assignment) => {
      if (assignment.status === 'SUBMITTED') accumulator.submittedCount += 1
      else if (assignment.status === 'IN_PROGRESS') accumulator.draftCount += 1
      else accumulator.pendingCount += 1
      return accumulator
    },
    {
      submittedCount: 0,
      draftCount: 0,
      pendingCount: 0,
    }
  )

  return {
    cycle: {
      id: selectedCycle.id,
      cycleName: selectedCycle.cycleName,
      status: selectedCycle.status,
      startDate: toIso(selectedCycle.startDate),
      endDate: toIso(selectedCycle.endDate),
      positiveSelectionLimit: selectedCycle.positiveSelectionLimit,
      negativeSelectionLimit: selectedCycle.negativeSelectionLimit,
      resultPrivacyThreshold: selectedCycle.resultPrivacyThreshold,
      evaluatorGroups: Array.isArray(selectedCycle.evaluatorGroups)
        ? (selectedCycle.evaluatorGroups as WordCloudEvaluatorGroup[])
        : ['MANAGER', 'PEER', 'SUBORDINATE'],
      publishedAt: toIso(selectedCycle.publishedAt),
      notes: selectedCycle.notes ?? undefined,
      evalCycleId: selectedCycle.evalCycleId ?? undefined,
    },
    keywordPool,
    employees,
    assignments,
    progress: {
      targetCount: new Set(assignments.map((assignment) => assignment.evaluateeId)).size,
      assignmentCount: assignments.length,
      submittedCount: responseStatusCounts.submittedCount,
      draftCount: responseStatusCounts.draftCount,
      pendingCount: responseStatusCounts.pendingCount,
    },
    results,
  } satisfies NonNullable<WordCloud360PageData['adminView']>
}

export async function getWordCloud360PageData(params: {
  session: AuthenticatedSession
  cycleId?: string
  evaluatorGroup?: 'ALL' | WordCloudEvaluatorGroup
}): Promise<WordCloud360PageData> {
  try {
    const actor = await getActor(params.session)
    const canManage = actor.role === 'ROLE_ADMIN'
    const alerts: SectionAlert[] = []

    const availableCyclesRaw = await prisma.wordCloud360Cycle.findMany({
      where: { orgId: actor.department.orgId },
      include: {
        evalCycle: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    const availableCycles = availableCyclesRaw.map((cycle) => ({
      id: cycle.id,
      name: cycle.cycleName,
      year: cycle.evalCycle?.evalYear,
      status: cycle.status,
    }))

    const selectedCycle =
      availableCyclesRaw.find((cycle) => cycle.id === params.cycleId) ??
      availableCyclesRaw[0] ??
      null

    const availableEvalCycles = canManage
      ? await loadWordCloudSection({
          title: '평가 주기',
          alerts,
          fallback: [] as NonNullable<WordCloud360PageData['availableEvalCycles']>,
          loader: async () => {
            const evalCycles = await prisma.evalCycle.findMany({
              where: { orgId: actor.department.orgId },
              orderBy: [{ evalYear: 'desc' }, { createdAt: 'desc' }],
            })

            return evalCycles.map((cycle) => ({
              id: cycle.id,
              name: cycle.cycleName,
              year: cycle.evalYear,
            }))
          },
        })
      : undefined

    const keywordPool = await loadWordCloudSection({
      title: '키워드 로딩',
      alerts,
      fallback: { positive: [] as KeywordOption[], negative: [] as KeywordOption[] },
      loader: async () => {
        const keywords = await prisma.wordCloud360Keyword.findMany({
          where: {
            orgId: actor.department.orgId,
            active: true,
          },
          orderBy: [{ displayOrder: 'asc' }, { keyword: 'asc' }],
        })

        return {
          positive: keywords
            .filter((keyword) => keyword.polarity === 'POSITIVE')
            .map((keyword) => ({
              keywordId: keyword.id,
              keyword: keyword.keyword,
              category: keyword.category,
              warningFlag: keyword.warningFlag,
            })),
          negative: keywords
            .filter((keyword) => keyword.polarity === 'NEGATIVE')
            .map((keyword) => ({
              keywordId: keyword.id,
              keyword: keyword.keyword,
              category: keyword.category,
              warningFlag: keyword.warningFlag,
            })),
        }
      },
    })

    if (!selectedCycle) {
      if (canManage) {
        const adminView = await buildAdminView({
          actorOrgId: actor.department.orgId,
          selectedCycle: null,
          alerts,
        })
        return {
          state: 'ready',
          message: '아직 워드클라우드형 다면평가 주기가 없습니다. 운영 개요에서 주기를 먼저 등록해 주세요.',
          alerts,
          currentUser: {
            id: actor.id,
            name: actor.empName,
            role: actor.role,
            department: actor.department.deptName,
          },
          permissions: {
            canManage,
            canEvaluate: false,
            canViewOwnResult: true,
          },
          availableCycles,
          availableEvalCycles,
          adminView,
        }
      }

      return {
        state: 'empty',
        message: '현재 진행 중인 워드클라우드형 다면평가 주기가 없습니다.',
        alerts,
        currentUser: {
          id: actor.id,
          name: actor.empName,
          role: actor.role,
          department: actor.department.deptName,
        },
        permissions: {
          canManage,
          canEvaluate: false,
          canViewOwnResult: true,
        },
        availableCycles,
      }
    }

    const cycleGroups: WordCloudEvaluatorGroup[] = Array.isArray(selectedCycle.evaluatorGroups)
      ? (selectedCycle.evaluatorGroups as WordCloudEvaluatorGroup[])
      : ['MANAGER', 'PEER', 'SUBORDINATE']

    const evaluatorAssignments = await loadWordCloudSection({
      title: '평가자 응답',
      alerts,
      fallback: [] as NonNullable<WordCloud360PageData['evaluatorView']>['assignments'],
      loader: async () => {
        const assignments = await prisma.wordCloud360Assignment.findMany({
          where: {
            cycleId: selectedCycle.id,
            evaluatorId: actor.id,
          },
          include: {
            evaluatee: {
              include: {
                department: true,
              },
            },
            response: {
              include: {
                items: true,
              },
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        })

        return assignments.map((assignment) => ({
          assignmentId: assignment.id,
          evaluateeId: assignment.evaluateeId,
          evaluateeName: assignment.evaluatee.empName,
          department: assignment.evaluatee.department.deptName,
          evaluatorGroup: assignment.evaluatorGroup,
          status: assignment.status,
          responseStatus: assignment.response?.status,
          selectedPositiveKeywordIds:
            assignment.response?.items.filter((item) => item.polarity === 'POSITIVE').map((item) => item.keywordId) ?? [],
          selectedNegativeKeywordIds:
            assignment.response?.items.filter((item) => item.polarity === 'NEGATIVE').map((item) => item.keywordId) ?? [],
          submittedAt: toIso(assignment.response?.submittedAt ?? assignment.submittedAt),
        }))
      },
    })

    const evaluateeView = await loadWordCloudSection({
      title: '피평가 결과',
      alerts,
      fallback: {
        resultVisible: false,
        hiddenReason: '결과를 준비 중입니다.',
        availableGroups: ['ALL'] as Array<'ALL' | WordCloudEvaluatorGroup>,
        selectedGroup: params.evaluatorGroup ?? 'ALL',
        responseCount: 0,
        positiveSelectionCount: 0,
        negativeSelectionCount: 0,
        positiveCloud: [],
        negativeCloud: [],
        positiveTopKeywords: [],
        negativeTopKeywords: [],
        categorySummary: [],
        evaluatorGroupSummary: [],
      } satisfies NonNullable<WordCloud360PageData['evaluateeView']>,
      loader: async () => {
        const responses = await prisma.wordCloud360Response.findMany({
          where: {
            cycleId: selectedCycle.id,
            evaluateeId: actor.id,
            status: 'SUBMITTED',
          },
          include: {
            items: true,
          },
        })

        const aggregated = aggregateWordCloudResponses({
          responses: responses.map((response) => ({
            status: response.status,
            evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
            items: response.items.map((item) => ({
              keywordId: item.keywordId,
              keywordTextSnapshot: item.keywordTextSnapshot,
              polarity: item.polarity,
              category: item.category,
              evaluatorGroup: item.evaluatorGroup,
            })),
          })),
          minimumResponses: selectedCycle.resultPrivacyThreshold,
          selectedGroup: params.evaluatorGroup ?? 'ALL',
        })

        const published = selectedCycle.status === 'PUBLISHED'
        const resultVisible = published && aggregated.thresholdMet

        return {
          resultVisible,
          hiddenReason: !published
            ? '결과가 아직 공개되지 않았습니다.'
            : aggregated.thresholdMet
              ? undefined
              : `응답 수가 공개 기준(${selectedCycle.resultPrivacyThreshold}명)보다 적어 결과를 숨깁니다.`,
          availableGroups: ['ALL', ...cycleGroups] as Array<'ALL' | WordCloudEvaluatorGroup>,
          selectedGroup: params.evaluatorGroup ?? 'ALL',
          responseCount: aggregated.responseCount,
          positiveSelectionCount: aggregated.positiveSelectionCount,
          negativeSelectionCount: aggregated.negativeSelectionCount,
          positiveCloud: mapCloudItems(aggregated.positiveKeywords.slice(0, 30)),
          negativeCloud: mapCloudItems(aggregated.negativeKeywords.slice(0, 30)),
          positiveTopKeywords: mapCloudItems(aggregated.positiveKeywords.slice(0, 10)),
          negativeTopKeywords: mapCloudItems(aggregated.negativeKeywords.slice(0, 10)),
          categorySummary: aggregated.categorySummary.map((item) => ({
            polarity: item.polarity,
            category: item.category,
            label: `${WORD_CLOUD_POLARITY_LABELS[item.polarity]} / ${WORD_CLOUD_CATEGORY_LABELS[item.category]}`,
            count: item.count,
          })),
          evaluatorGroupSummary: aggregated.evaluatorGroupSummary.map((item) => ({
            evaluatorGroup: item.evaluatorGroup,
            label: WORD_CLOUD_GROUP_LABELS[item.evaluatorGroup],
            responseCount: item.responseCount,
          })),
        }
      },
    })

    const adminView = canManage
      ? await buildAdminView({
          actorOrgId: actor.department.orgId,
          selectedCycle,
          alerts,
        })
      : undefined

    const assignmentCount = adminView?.progress.assignmentCount ?? evaluatorAssignments.length
    const submittedResponseCount =
      adminView?.progress.submittedCount ?? evaluatorAssignments.filter((item) => item.status === 'SUBMITTED').length
    const targetCount = adminView?.progress.targetCount ?? new Set(evaluatorAssignments.map((item) => item.evaluateeId)).size
    const thresholdMetTargetCount = adminView
      ? adminView.results.filter((item) => item.thresholdMet).length
      : evaluateeView.resultVisible
        ? 1
        : 0
    const published = selectedCycle.status === 'PUBLISHED' && thresholdMetTargetCount > 0

    return {
      state: 'ready',
      alerts,
      currentUser: {
        id: actor.id,
        name: actor.empName,
        role: actor.role,
        department: actor.department.deptName,
      },
      permissions: {
        canManage,
        canEvaluate: evaluatorAssignments.length > 0,
        canViewOwnResult: true,
      },
      availableCycles,
      availableEvalCycles,
      selectedCycleId: selectedCycle.id,
      summary: {
        targetCount,
        assignmentCount,
        submittedResponseCount,
        published,
        thresholdMetTargetCount,
        positiveSelectionLimit: selectedCycle.positiveSelectionLimit,
        negativeSelectionLimit: selectedCycle.negativeSelectionLimit,
        privacyThreshold: selectedCycle.resultPrivacyThreshold,
      },
      evaluatorView: {
        enabledGroups: cycleGroups,
        positiveSelectionLimit: selectedCycle.positiveSelectionLimit,
        negativeSelectionLimit: selectedCycle.negativeSelectionLimit,
        keywordPool,
        assignments: evaluatorAssignments,
      },
      evaluateeView,
      adminView,
    }
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) {
      return {
        state: 'permission-denied',
        message: error.message,
        availableCycles: [],
      }
    }

    console.error('Word cloud 360 page load failed:', error)
    return {
      state: 'error',
      message: '워드클라우드형 다면평가 화면을 준비하는 중 오류가 발생했습니다.',
      availableCycles: [],
    }
  }
}

export async function upsertWordCloud360Cycle(params: {
  actorId: string
  input: {
    cycleId?: string
    evalCycleId?: string
    cycleName: string
    startDate?: string
    endDate?: string
    positiveSelectionLimit: number
    negativeSelectionLimit: number
    resultPrivacyThreshold: number
    evaluatorGroups: WordCloudEvaluatorGroup[]
    notes?: string
    status: WordCloud360CycleStatus
  }
}) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  let evalCycleOrgId = actor.department.orgId
  if (params.input.evalCycleId) {
    const evalCycle = await prisma.evalCycle.findUnique({
      where: { id: params.input.evalCycleId },
    })
    if (!evalCycle || evalCycle.orgId !== actor.department.orgId) {
      throw new AppError(400, 'INVALID_EVAL_CYCLE', '연결할 PMS 평가 주기를 찾을 수 없습니다.')
    }
    evalCycleOrgId = evalCycle.orgId
  }

  const data = {
    orgId: evalCycleOrgId,
    evalCycleId: params.input.evalCycleId ?? null,
    cycleName: params.input.cycleName,
    startDate: params.input.startDate ? new Date(params.input.startDate) : null,
    endDate: params.input.endDate ? new Date(params.input.endDate) : null,
    positiveSelectionLimit: params.input.positiveSelectionLimit,
    negativeSelectionLimit: params.input.negativeSelectionLimit,
    resultPrivacyThreshold: params.input.resultPrivacyThreshold,
    evaluatorGroups: params.input.evaluatorGroups,
    notes: params.input.notes ?? null,
    status: params.input.status,
    publishedAt: params.input.status === 'PUBLISHED' ? new Date() : null,
    updatedById: params.actorId,
  }

  const cycle = params.input.cycleId
    ? await prisma.wordCloud360Cycle.update({
        where: { id: params.input.cycleId },
        data,
      })
    : await prisma.wordCloud360Cycle.create({
        data: {
          ...data,
          createdById: params.actorId,
        },
      })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.cycleId ? 'UPDATE_WORD_CLOUD_360_CYCLE' : 'CREATE_WORD_CLOUD_360_CYCLE',
    entityType: 'WORD_CLOUD_360_CYCLE',
    entityId: cycle.id,
    newValue: {
      cycleName: cycle.cycleName,
      status: cycle.status,
    },
  })

  return cycle
}

export async function upsertWordCloud360Keyword(params: {
  actorId: string
  input: {
    keywordId?: string
    keywordCode?: string
    keyword: string
    polarity: WordCloudKeywordPolarity
    category: WordCloudKeywordCategory
    sourceType: WordCloudKeywordSourceType
    active: boolean
    displayOrder: number
    note?: string
    warningFlag: boolean
  }
}) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  const normalizedKeywordCode = normalizeKeywordCode(params.input.keywordCode)

  const keyword = params.input.keywordId
    ? await prisma.wordCloud360Keyword.update({
        where: { id: params.input.keywordId },
        data: {
          keywordCode: normalizedKeywordCode ?? null,
          keyword: params.input.keyword,
          polarity: params.input.polarity,
          category: params.input.category,
          sourceType: params.input.sourceType,
          active: params.input.active,
          displayOrder: params.input.displayOrder,
          note: params.input.note ?? null,
          warningFlag: params.input.warningFlag,
        },
      })
    : await prisma.wordCloud360Keyword.create({
        data: {
          orgId: actor.department.orgId,
          keywordCode: normalizedKeywordCode ?? null,
          keyword: params.input.keyword,
          polarity: params.input.polarity,
          category: params.input.category,
          sourceType: params.input.sourceType,
          active: params.input.active,
          displayOrder: params.input.displayOrder,
          note: params.input.note ?? null,
          warningFlag: params.input.warningFlag,
        },
      })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.keywordId ? 'UPDATE_WORD_CLOUD_360_KEYWORD' : 'CREATE_WORD_CLOUD_360_KEYWORD',
    entityType: 'WORD_CLOUD_360_KEYWORD',
    entityId: keyword.id,
    newValue: {
      keywordCode: keyword.keywordCode,
      keyword: keyword.keyword,
      polarity: keyword.polarity,
      active: keyword.active,
    },
  })

  return keyword
}

export async function seedDefaultWordCloudKeywords(params: { actorId: string }) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }

  const result = await prisma.wordCloud360Keyword.createMany({
    data: DEFAULT_WORD_CLOUD_KEYWORDS.map((keyword) => ({
      orgId: actor.department.orgId,
      keywordCode: keyword.keywordCode ?? null,
      keyword: keyword.keyword,
      polarity: keyword.polarity,
      category: keyword.category,
      sourceType: keyword.sourceType,
      active: true,
      displayOrder: keyword.displayOrder,
      note: keyword.note ?? null,
      warningFlag: keyword.warningFlag ?? false,
    })),
    skipDuplicates: true,
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'SEED_WORD_CLOUD_360_KEYWORDS',
    entityType: 'WORD_CLOUD_360_KEYWORD',
    newValue: {
      insertedCount: result.count,
    },
  })

  return result
}

export async function saveWordCloud360Assignments(params: {
  actorId: string
  cycleId: string
  assignments: Array<WordCloudAssignmentDraft>
}) {
  await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const uniqueAssignments = Array.from(
    new Map(
      params.assignments.map((assignment) => [
        `${assignment.cycleId}:${assignment.evaluatorId}:${assignment.evaluateeId}:${assignment.evaluatorGroup}`,
        assignment,
      ])
    ).values()
  )

  await prisma.$transaction(
    uniqueAssignments.map((assignment) =>
      prisma.wordCloud360Assignment.upsert({
        where: {
          cycleId_evaluatorId_evaluateeId_evaluatorGroup: {
            cycleId: assignment.cycleId,
            evaluatorId: assignment.evaluatorId,
            evaluateeId: assignment.evaluateeId,
            evaluatorGroup: assignment.evaluatorGroup,
          },
        },
        update: {
          evaluatorGroup: assignment.evaluatorGroup,
        },
        create: assignment,
      })
    )
  )

  await createAuditLog({
    userId: params.actorId,
    action: 'UPSERT_WORD_CLOUD_360_ASSIGNMENTS',
    entityType: 'WORD_CLOUD_360_ASSIGNMENT',
    entityId: params.cycleId,
    newValue: {
      count: uniqueAssignments.length,
    },
  })

  return { count: uniqueAssignments.length }
}

export async function autoAssignWordCloud360Participants(params: {
  actorId: string
  cycleId: string
  includeSelf: boolean
  peerLimit: number
  subordinateLimit: number
}) {
  const { actor, cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const employees = await prisma.employee.findMany({
    where: {
      department: {
        orgId: actor.department.orgId,
      },
      status: {
        in: ['ACTIVE', 'ON_LEAVE'],
      },
    },
    select: {
      id: true,
      deptId: true,
      managerId: true,
      status: true,
    },
    orderBy: [{ deptId: 'asc' }, { empName: 'asc' }],
  })

  const suggestions = buildSuggestedWordCloudAssignments({
    cycleId: cycle.id,
    employees,
    includeSelf: params.includeSelf,
    peerLimit: params.peerLimit,
    subordinateLimit: params.subordinateLimit,
  })

  return saveWordCloud360Assignments({
    actorId: params.actorId,
    cycleId: params.cycleId,
    assignments: suggestions,
  })
}

export async function deleteWordCloud360Assignment(params: { actorId: string; assignmentId: string }) {
  const assignment = await prisma.wordCloud360Assignment.findUnique({
    where: { id: params.assignmentId },
  })
  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '삭제할 편성 정보를 찾을 수 없습니다.')
  }

  await ensureCycleAccess({ cycleId: assignment.cycleId, actorId: params.actorId })
  await prisma.wordCloud360Assignment.delete({
    where: { id: params.assignmentId },
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'DELETE_WORD_CLOUD_360_ASSIGNMENT',
    entityType: 'WORD_CLOUD_360_ASSIGNMENT',
    entityId: params.assignmentId,
  })
}

export async function saveWordCloud360Response(params: {
  actorId: string
  input: {
    assignmentId: string
    positiveKeywordIds: string[]
    negativeKeywordIds: string[]
    submitFinal: boolean
  }
}) {
  const assignment = await prisma.wordCloud360Assignment.findUnique({
    where: { id: params.input.assignmentId },
    include: {
      cycle: true,
      response: {
        include: {
          items: true,
        },
      },
    },
  })

  if (!assignment) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '응답 대상 편성을 찾을 수 없습니다.')
  }
  if (assignment.evaluatorId !== params.actorId) {
    throw new AppError(403, 'FORBIDDEN', '본인에게 배정된 평가만 작성할 수 있습니다.')
  }
  const reopenedAudit =
    assignment.cycle.status === 'OPEN' || assignment.response?.status !== 'DRAFT' || !assignment.response?.id
      ? null
      : await findLatestWordCloud360ReopenAudit(assignment.response.id)

  if (assignment.cycle.status !== 'OPEN' && !reopenedAudit) {
    throw new AppError(409, 'CYCLE_CLOSED', '현재 주기는 응답 작성 기간이 아닙니다.')
  }
  if (assignment.response?.status === 'SUBMITTED') {
    throw new AppError(409, 'ALREADY_SUBMITTED', '이미 제출된 응답은 수정할 수 없습니다.')
  }

  if (params.input.submitFinal) {
    const validation = validateWordCloudSubmitSelections({
      positiveKeywordIds: params.input.positiveKeywordIds,
      negativeKeywordIds: params.input.negativeKeywordIds,
      positiveLimit: assignment.cycle.positiveSelectionLimit,
      negativeLimit: assignment.cycle.negativeSelectionLimit,
    })

    if (!validation.isValid) {
      throw new AppError(400, 'INVALID_SELECTION', validation.errors[0] ?? '키워드 선택 규칙이 맞지 않습니다.')
    }
  }

  const selectedKeywordIds = [...params.input.positiveKeywordIds, ...params.input.negativeKeywordIds]
  const keywords = await prisma.wordCloud360Keyword.findMany({
    where: {
      id: { in: selectedKeywordIds },
      orgId: assignment.cycle.orgId,
      active: true,
    },
  })

  if (keywords.length !== selectedKeywordIds.length) {
    throw new AppError(400, 'KEYWORD_NOT_FOUND', '선택한 키워드 중 사용할 수 없는 항목이 있습니다.')
  }

  const positiveIds = new Set(params.input.positiveKeywordIds)
  const negativeIds = new Set(params.input.negativeKeywordIds)
  for (const keyword of keywords) {
    if (positiveIds.has(keyword.id) && keyword.polarity !== 'POSITIVE') {
      throw new AppError(400, 'INVALID_POLARITY', '긍정 영역에는 긍정 키워드만 선택할 수 있습니다.')
    }
    if (negativeIds.has(keyword.id) && keyword.polarity !== 'NEGATIVE') {
      throw new AppError(400, 'INVALID_POLARITY', '부정 영역에는 부정 키워드만 선택할 수 있습니다.')
    }
  }

  const previousSnapshot = assignment.response?.items
    ? buildWordCloud360SelectionSnapshotFromItems(assignment.response.items)
    : { positiveSelections: [] as WordCloud360SelectionSnapshot[], negativeSelections: [] as WordCloud360SelectionSnapshot[] }
  const nextSnapshot = buildWordCloud360SelectionSnapshot({
    keywords,
    positiveKeywordIds: params.input.positiveKeywordIds,
    negativeKeywordIds: params.input.negativeKeywordIds,
    evaluatorGroup: assignment.evaluatorGroup,
  })
  const transitionAt = new Date()
  const nextAssignmentStatus = params.input.submitFinal ? 'SUBMITTED' : 'IN_PROGRESS'
  const nextResponseStatus = params.input.submitFinal ? 'SUBMITTED' : 'DRAFT'

  const saved = await prisma.$transaction(async (tx) => {
    const response =
      assignment.response ??
      (await tx.wordCloud360Response.create({
        data: {
          assignmentId: assignment.id,
          cycleId: assignment.cycleId,
          evaluatorId: assignment.evaluatorId,
          evaluateeId: assignment.evaluateeId,
          status: 'DRAFT',
        },
      }))

    await tx.wordCloud360ResponseItem.deleteMany({
      where: { responseId: response.id },
    })

    if (keywords.length) {
      await tx.wordCloud360ResponseItem.createMany({
        data: keywords.map((keyword) => ({
          responseId: response.id,
          keywordId: keyword.id,
          polarity: keyword.polarity,
          category: keyword.category,
          keywordTextSnapshot: keyword.keyword,
          evaluatorGroup: assignment.evaluatorGroup,
        })),
      })
    }

    const updatedResponse = await tx.wordCloud360Response.update({
      where: { id: response.id },
      data: {
        status: nextResponseStatus,
        submittedAt: params.input.submitFinal ? transitionAt : null,
      },
    })

    await tx.wordCloud360Assignment.update({
      where: { id: assignment.id },
      data: {
        status: nextAssignmentStatus,
        draftSavedAt: params.input.submitFinal ? assignment.draftSavedAt : transitionAt,
        submittedAt: params.input.submitFinal ? transitionAt : null,
      },
    })

    return updatedResponse
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.input.submitFinal ? 'SUBMIT_WORD_CLOUD_360_RESPONSE' : 'SAVE_WORD_CLOUD_360_RESPONSE_DRAFT',
    entityType: 'WORD_CLOUD_360_RESPONSE',
    entityId: saved.id,
    oldValue: {
      previousStatus: assignment.status,
      previousResponseStatus: assignment.response?.status ?? null,
      positiveSelections: previousSnapshot.positiveSelections,
      negativeSelections: previousSnapshot.negativeSelections,
    },
    newValue: {
      eventType: params.input.submitFinal ? 'wordcloud_final_submitted' : 'wordcloud_draft_saved',
      actorUserId: params.actorId,
      targetResponseId: saved.id,
      targetEvaluatorId: assignment.evaluatorId,
      cycleId: assignment.cycleId,
      previousStatus: assignment.status,
      nextStatus: nextAssignmentStatus,
      responseStatus: saved.status,
      positiveCount: nextSnapshot.positiveSelections.length,
      negativeCount: nextSnapshot.negativeSelections.length,
      positiveSelections: nextSnapshot.positiveSelections,
      negativeSelections: nextSnapshot.negativeSelections,
      changedAt: transitionAt.toISOString(),
    },
  })

  return saved
}

export async function revertWordCloud360FinalSubmit(params: {
  actorId: string
  input: {
    assignmentId: string
    reason: string
  }
}) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '최종 제출 취소 권한이 없습니다.')
  }

  const assignment = await prisma.wordCloud360Assignment.findUnique({
    where: { id: params.input.assignmentId },
    include: {
      cycle: true,
      evaluator: true,
      evaluatee: true,
      response: {
        include: {
          items: true,
        },
      },
    },
  })

  if (!assignment || assignment.cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '복원할 응답을 찾을 수 없습니다.')
  }
  if (!assignment.response) {
    throw new AppError(404, 'RESPONSE_NOT_FOUND', '복원할 이력 응답이 없습니다.')
  }

  if (!assignment || assignment.cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '복원할 응답을 찾을 수 없습니다.')
  }
  if (!assignment.response) {
    throw new AppError(404, 'RESPONSE_NOT_FOUND', '복원할 이력 응답이 없습니다.')
  }

  if (!assignment || assignment.cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '최종 제출을 취소할 응답을 찾을 수 없습니다.')
  }

  if (!assignment.response || assignment.status !== 'SUBMITTED' || assignment.response.status !== 'SUBMITTED') {
    throw new AppError(409, 'NOT_SUBMITTED', '최종 제출된 응답만 취소할 수 있습니다.')
  }

  const reopenedAt = new Date()
  const reason = params.input.reason.trim()
  const snapshot = buildWordCloud360SelectionSnapshotFromItems(assignment.response.items)

  const updatedResponse = await prisma.$transaction(async (tx) => {
    const response = await tx.wordCloud360Response.update({
      where: { id: assignment.response!.id },
      data: {
        status: 'DRAFT',
        submittedAt: null,
      },
    })

    await tx.wordCloud360Assignment.update({
      where: { id: assignment.id },
      data: {
        status: 'IN_PROGRESS',
        draftSavedAt: reopenedAt,
        submittedAt: null,
      },
    })

    return response
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'WORD_CLOUD_360_FINAL_SUBMIT_REVERTED',
    entityType: 'WORD_CLOUD_360_RESPONSE',
    entityId: assignment.response.id,
    oldValue: {
      previousStatus: assignment.status,
      previousAssignmentStatus: assignment.status,
      submittedAt: assignment.response.submittedAt?.toISOString() ?? null,
      positiveSelections: snapshot.positiveSelections,
      negativeSelections: snapshot.negativeSelections,
    },
    newValue: {
      eventType: 'wordcloud_final_submit_reverted',
      actorUserId: params.actorId,
      targetResponseId: assignment.response.id,
      targetEvaluatorId: assignment.evaluatorId,
      cycleId: assignment.cycleId,
      previousStatus: assignment.status,
      nextStatus: 'IN_PROGRESS',
      responseStatus: updatedResponse.status,
      positiveCount: snapshot.positiveSelections.length,
      negativeCount: snapshot.negativeSelections.length,
      positiveSelections: snapshot.positiveSelections,
      negativeSelections: snapshot.negativeSelections,
      reason,
      reopenedAt: reopenedAt.toISOString(),
      reopenedBy: actor.empName,
    },
  })

  return {
    assignmentId: assignment.id,
    responseId: updatedResponse.id,
    cycleId: assignment.cycleId,
    evaluatorId: assignment.evaluatorId,
    evaluateeId: assignment.evaluateeId,
    previousStatus: assignment.response.status,
    nextStatus: 'IN_PROGRESS' as const,
    responseStatus: updatedResponse.status,
    reopenedAt: reopenedAt.toISOString(),
  }
}

export async function restoreWordCloud360ResponseFromHistory(params: {
  actorId: string
  input: {
    assignmentId: string
    revisionId: string
    reason: string
  }
}) {
  const actor = await prisma.employee.findUnique({
    where: { id: params.actorId },
    include: { department: true },
  })
  if (!actor) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '현재 사용자 정보를 찾을 수 없습니다.')
  }
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 이 기능을 사용할 수 있습니다.')
  }
  const assignment = await prisma.wordCloud360Assignment.findUnique({
    where: { id: params.input.assignmentId },
    include: {
      cycle: true,
      evaluator: true,
      evaluatee: true,
      response: {
        include: {
          items: true,
        },
      },
    },
  })

  if (!assignment || assignment.cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '蹂듭썝???묐떟???李얠쓣 ???놁뒿?덈떎.')
  }
  if (!assignment.response) {
    throw new AppError(404, 'RESPONSE_NOT_FOUND', '蹂듭썝??댁뼱 ?묐떟 ?대젰???놁뒿?덈떎.')
  }

  if (!assignment || assignment.cycle.orgId !== actor.department.orgId) {
    throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', '복원할 응답을 찾을 수 없습니다.')
  }
  if (!assignment.response) {
    throw new AppError(404, 'RESPONSE_NOT_FOUND', '복원할 이력 응답이 없습니다.')
  }

  const historyLogs = await prisma.auditLog.findMany({
    where: {
      entityType: 'WORD_CLOUD_360_RESPONSE',
      entityId: assignment.response.id,
      action: {
        in: [...WORD_CLOUD_360_HISTORY_ACTIONS],
      },
    },
    orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  })

  const actorNameById = new Map<string, string>([
    [actor.id, actor.empName],
    [assignment.evaluatorId, assignment.evaluator.empName],
    [assignment.evaluateeId, assignment.evaluatee.empName],
  ])
  const revision = historyLogs
    .map((log) =>
      parseWordCloud360HistoryEntry({
        log,
        actorNameById,
      })
    )
    .find((entry) => entry?.revisionId === params.input.revisionId)

  if (!revision) {
    throw new AppError(404, 'HISTORY_NOT_FOUND', '복원할 이력 시점을 찾을 수 없습니다.')
  }
  if (!revision.canRestore) {
    throw new AppError(409, 'HISTORY_NOT_RESTORABLE', '선택한 이력은 복원할 수 없습니다.')
  }

  if (!revision) {
    throw new AppError(404, 'HISTORY_NOT_FOUND', '복원할 이력 시점을 찾을 수 없습니다.')
  }
  if (!revision.canRestore) {
    throw new AppError(409, 'HISTORY_NOT_RESTORABLE', '선택한 이력은 복원할 수 없습니다.')
  }

  if (!revision) {
    throw new AppError(404, 'HISTORY_NOT_FOUND', '蹂듭썝???댁뼱 ?대젰 ???쒖젏??李얠쓣 ???놁뒿?덈떎.')
  }
  if (!revision.canRestore) {
    throw new AppError(409, 'HISTORY_NOT_RESTORABLE', '?좏깮???대젰??蹂듭썝???섏쓣 ???놁뒿?덈떎.')
  }

  if (!revision) {
    throw new AppError(404, 'HISTORY_NOT_FOUND', '복원할 이력 시점을 찾을 수 없습니다.')
  }
  if (!revision.canRestore) {
    throw new AppError(409, 'HISTORY_NOT_RESTORABLE', '선택한 이력은 복원할 수 없습니다.')
  }

  const restoredAt = new Date()
  const reason = params.input.reason.trim()
  const currentSnapshot = buildWordCloud360SelectionSnapshotFromItems(assignment.response.items)
  const restoredSelections = [...revision.positiveSelections, ...revision.negativeSelections]

  const updatedResponse = await prisma.$transaction(async (tx) => {
    await tx.wordCloud360ResponseItem.deleteMany({
      where: { responseId: assignment.response!.id },
    })

    if (restoredSelections.length > 0) {
      await tx.wordCloud360ResponseItem.createMany({
        data: restoredSelections.map((selection) => ({
          responseId: assignment.response!.id,
          keywordId: selection.keywordId,
          polarity: selection.polarity,
          category: selection.category,
          keywordTextSnapshot: selection.keyword,
          evaluatorGroup: selection.evaluatorGroup,
        })),
      })
    }

    const response = await tx.wordCloud360Response.update({
      where: { id: assignment.response!.id },
      data: {
        status: 'DRAFT',
        submittedAt: null,
      },
    })

    await tx.wordCloud360Assignment.update({
      where: { id: assignment.id },
      data: {
        status: 'IN_PROGRESS',
        draftSavedAt: restoredAt,
        submittedAt: null,
      },
    })

    return response
  })

  await createAuditLog({
    userId: params.actorId,
    action: 'WORD_CLOUD_360_RESPONSE_RESTORED',
    entityType: 'WORD_CLOUD_360_RESPONSE',
    entityId: assignment.response.id,
    oldValue: {
      previousStatus: assignment.status,
      previousResponseStatus: assignment.response.status,
      submittedAt: assignment.response.submittedAt?.toISOString() ?? null,
      positiveSelections: currentSnapshot.positiveSelections,
      negativeSelections: currentSnapshot.negativeSelections,
    },
    newValue: {
      eventType: 'wordcloud_response_restored',
      actorUserId: params.actorId,
      targetResponseId: assignment.response.id,
      targetEvaluatorId: assignment.evaluatorId,
      cycleId: assignment.cycleId,
      previousStatus: assignment.status,
      nextStatus: 'IN_PROGRESS',
      responseStatus: updatedResponse.status,
      positiveCount: revision.positiveSelections.length,
      negativeCount: revision.negativeSelections.length,
      positiveSelections: revision.positiveSelections,
      negativeSelections: revision.negativeSelections,
      restoredFromRevisionId: revision.revisionId,
      reason,
      restoredAt: restoredAt.toISOString(),
      restoredBy: actor.empName,
    },
  })

  return {
    assignmentId: assignment.id,
    responseId: updatedResponse.id,
    cycleId: assignment.cycleId,
    evaluatorId: assignment.evaluatorId,
    evaluateeId: assignment.evaluateeId,
    restoredFromRevisionId: revision.revisionId,
    previousStatus: assignment.status,
    nextStatus: 'IN_PROGRESS' as const,
    responseStatus: updatedResponse.status,
    restoredAt: restoredAt.toISOString(),
  }
}

export async function publishWordCloud360Results(params: {
  actorId: string
  cycleId: string
  publish: boolean
}) {
  const { cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })

  const updated = await prisma.wordCloud360Cycle.update({
    where: { id: cycle.id },
    data: {
      status: params.publish ? 'PUBLISHED' : 'CLOSED',
      publishedAt: params.publish ? new Date() : null,
      updatedById: params.actorId,
    },
  })

  await createAuditLog({
    userId: params.actorId,
    action: params.publish ? 'PUBLISH_WORD_CLOUD_360_RESULTS' : 'UNPUBLISH_WORD_CLOUD_360_RESULTS',
    entityType: 'WORD_CLOUD_360_CYCLE',
    entityId: cycle.id,
    newValue: {
      status: updated.status,
    },
  })

  return updated
}

export async function exportWordCloud360Results(params: {
  actorId: string
  cycleId: string
  format: 'csv' | 'xlsx'
}) {
  const { actor, cycle } = await ensureCycleAccess({ cycleId: params.cycleId, actorId: params.actorId })
  if (actor.role !== 'ROLE_ADMIN') {
    throw new AppError(403, 'FORBIDDEN', '관리자만 서베이 결과를 다운로드할 수 있습니다.')
  }

  const responses = await prisma.wordCloud360Response.findMany({
    where: {
      cycleId: cycle.id,
      status: 'SUBMITTED',
    },
    include: {
      evaluatee: {
        include: {
          department: true,
        },
      },
      items: true,
    },
  })

  const grouped = new Map<string, typeof responses>()
  for (const response of responses) {
    const bucket = grouped.get(response.evaluateeId) ?? []
    bucket.push(response)
    grouped.set(response.evaluateeId, bucket)
  }

  const rows = Array.from(grouped.values()).flatMap((employeeResponses) => {
    const evaluatee = employeeResponses[0]?.evaluatee
    const aggregated = aggregateWordCloudResponses({
      responses: employeeResponses.map((response) => ({
        status: response.status,
        evaluatorGroup: response.items[0]?.evaluatorGroup ?? 'PEER',
        items: response.items.map((item) => ({
          keywordId: item.keywordId,
          keywordTextSnapshot: item.keywordTextSnapshot,
          polarity: item.polarity,
          category: item.category,
          evaluatorGroup: item.evaluatorGroup,
        })),
      })),
      minimumResponses: cycle.resultPrivacyThreshold,
    })

    const baseRow = {
      cycleName: cycle.cycleName,
      employeeNumber: evaluatee?.empId ?? '',
      employeeName: evaluatee?.empName ?? '',
      department: aggregated.thresholdMet ? (evaluatee?.department.deptName ?? '') : '',
      responseCount: aggregated.responseCount,
      thresholdMet: aggregated.thresholdMet ? 'Y' : 'N',
    }

    if (!aggregated.thresholdMet) {
      return [
        {
          ...baseRow,
          polarity: '',
          keyword: '',
          category: '',
          count: 0,
        },
      ]
    }

    return [...aggregated.positiveKeywords.slice(0, 10), ...aggregated.negativeKeywords.slice(0, 10)].map((item) => ({
      ...baseRow,
      polarity: WORD_CLOUD_POLARITY_LABELS[item.polarity],
      keyword: item.keyword,
      category: WORD_CLOUD_CATEGORY_LABELS[item.category],
      count: item.count,
    }))
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'WordCloud360')

  if (params.format === 'csv') {
    return {
      body: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      fileName: `word-cloud-360-${cycle.cycleName}.csv`,
    }
  }

  return {
    body: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `word-cloud-360-${cycle.cycleName}.xlsx`,
  }
}
