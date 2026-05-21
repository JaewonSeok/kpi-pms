import { Prisma, type EmployeeStatus, type Position, type SystemRole } from '@prisma/client'
import * as XLSX from 'xlsx'
import { prisma } from '../../lib/prisma'
import {
  assertAllowedGoogleWorkspaceEmail,
  getAllowedGoogleWorkspaceDomain,
  normalizeGoogleWorkspaceEmail,
} from '../../lib/google-workspace'
import {
  buildOrgKpiDepartmentScopeMap,
  type OrgKpiScope,
  resolveOrgKpiScopeFromDepartmentId,
} from '../../lib/org-kpi-scope'
import { normalizeLegacyTeamNameForDepartment } from '../../lib/org-affiliation'
import { resolveMasterLoginAccess } from '../../lib/master-login-shared'
import { AppError } from '../../lib/utils'

export const EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS = [
  {
    key: 'employeeNo',
    required: true,
    description: '사번입니다. 일괄 업로드와 수정 시 기본 식별자로 사용됩니다.',
    example: 'E-1001',
  },
  {
    key: 'name',
    required: true,
    description: '직원명입니다.',
    example: '홍길동',
  },
  {
    key: 'googleEmail',
    required: true,
    description: '회사 Google Workspace 이메일입니다. 허용 도메인만 등록할 수 있습니다.',
    example: 'hong.gildong@company.example.com',
  },
  {
    key: 'division',
    required: true,
    description: '본부명입니다. 조직 경로의 최상위 기준입니다.',
    example: '경영지원본부',
  },
  {
    key: 'section',
    required: false,
    description: '실명입니다. 실이 없는 조직은 비워둘 수 있습니다.',
    example: '인사기획실',
  },
  {
    key: 'team',
    required: true,
    description: '팀명입니다. 직원이 소속될 최종 팀입니다.',
    example: '인사운영팀',
  },
  {
    key: 'title',
    required: true,
    description: '직책 또는 직위를 입력합니다.',
    example: '매니저',
  },
  {
    key: 'role',
    required: true,
    description: 'ROLE_MEMBER, ROLE_LEADER, ROLE_ADMIN 중 하나를 사용합니다.',
    example: 'ROLE_MEMBER',
  },
  {
    key: 'managerEmployeeNo',
    required: false,
    description: '직속 상사의 사번입니다. 없으면 상급자 미지정 warning으로 처리합니다.',
    example: 'E-1000',
  },
] as const

export const EMPLOYEE_UPLOAD_TEMPLATE_HEADERS = EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS.map(
  (column) => column.key
)
export const EMPLOYEE_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED'] as const
export const EMPLOYEE_UPLOAD_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] as const

export type EmployeeManagementStatus = (typeof EMPLOYEE_STATUS_VALUES)[number]
export type EmployeeUploadTemplateKey = (typeof EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS)[number]['key']
type EmployeeUploadFieldKey =
  | EmployeeUploadTemplateKey
  | 'employmentStatus'
  | 'joinDate'
  | 'resignationDate'
  | 'sortOrder'
  | 'notes'
  | 'parentDepartment'
  | 'department'
type MasterLoginAccessSource = ReturnType<typeof resolveMasterLoginAccess>['source']

type ExistingEmployeeSnapshot = {
  id: string
  employeeNumber: string
  name: string
  googleEmail: string
  status: EmployeeManagementStatus
  managerId: string | null
  managerEmployeeNumber: string | null
}

type ExistingDepartmentSnapshot = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
}

export type EmployeeUploadNormalizedRow = {
  rowNumber: number
  employeeNumber: string
  name: string
  googleEmail: string
  division: string
  section: string | null
  department: string
  departmentCode: string | null
  parentDepartment: string | null
  team: string | null
  title: string | null
  role: SystemRole
  employmentStatus: EmployeeManagementStatus
  managerEmployeeNumber: string | null
  joinDate: string | null
  resignationDate: string | null
  sortOrder: number | null
  notes: string | null
}

export type EmployeeUploadIssue = {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export type EmployeeUploadValidationRow = {
  rowNumber: number
  employeeNumber: string
  name: string
  action: 'create' | 'update'
  valid: boolean
  issues: EmployeeUploadIssue[]
  normalizedRow: EmployeeUploadNormalizedRow | null
}

export type EmployeeUploadValidationResult = {
  fileName: string
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
    createCount: number
    updateCount: number
    errorCount: number
    warningCount: number
    infoCount: number
  }
  rows: EmployeeUploadValidationRow[]
  validRows: EmployeeUploadNormalizedRow[]
  errors: Array<{
    rowNumber: number
    employeeNumber?: string
    field?: string
    message: string
  }>
}

export type EmployeeDirectoryItem = {
  id: string
  employeeNumber: string
  name: string
  googleEmail: string
  departmentId: string
  departmentCode: string
  departmentName: string
  teamName: string | null
  jobTitle: string | null
  role: SystemRole
  employmentStatus: EmployeeManagementStatus
  joinDate: string
  resignationDate: string | null
  managerId: string | null
  managerEmployeeNumber: string | null
  managerName: string | null
  sortOrder: number | null
  notes: string | null
  directReportCount: number
  loginEnabled: boolean
  masterLoginPermissionGranted: boolean
  masterLoginAccessSource: MasterLoginAccessSource
  masterLoginAvailable: boolean
}

export type DepartmentDirectoryItem = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
  scope: OrgKpiScope
  leaderEmployeeId: string | null
  leaderEmployeeNumber: string | null
  leaderEmployeeName: string | null
  excludeLeaderFromEvaluatorAutoAssign: boolean
  memberCount: number
  orgKpiCount: number
}

export type EmployeeUploadDepartmentPlanItem = {
  key: string
  path: string[]
  departmentName: string
  parentPath: string[]
  departmentCode: string | null
  scope: OrgKpiScope
}

export type DepartmentScopeSummary = {
  totalDepartments: number
  divisionCount: number
  sectionCount: number
  teamCount: number
}

export type EvaluatorAssignmentPreviewRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string
  role: SystemRole
  changedFields: Array<'teamLeader' | 'sectionChief' | 'divisionHead'>
  current: {
    teamLeaderName: string
    sectionChiefName: string
    divisionHeadName: string
  }
  next: {
    teamLeaderName: string
    sectionChiefName: string
    divisionHeadName: string
  }
}

export type EvaluatorAssignmentPreview = {
  summary: {
    changedEmployeeCount: number
    teamLeaderChangedCount: number
    sectionChiefChangedCount: number
    divisionHeadChangedCount: number
  }
  changedEmployees: EvaluatorAssignmentPreviewRow[]
}

export type EmployeeOrgChartNode = {
  employee: {
    id: string
    employeeNumber: string
    name: string
    googleEmail: string
    departmentName: string
    departmentCode: string
    teamName: string | null
    jobTitle: string | null
    role: SystemRole
    employmentStatus: EmployeeManagementStatus
    joinDate: string
    resignationDate: string | null
    managerEmployeeNumber: string | null
    managerName: string | null
    directReportCount: number
    sortOrder: number | null
  }
  reports: EmployeeOrgChartNode[]
}

export type EmployeeOrgChartMember = EmployeeOrgChartNode['employee'] & {
  id: string
  managerId: string | null
  sortOrder: number | null
  managerExists?: boolean
}

const HEADER_ALIASES: Record<EmployeeUploadFieldKey, string[]> = {
  employeeNo: ['employeeNo', 'employeeNumber', 'employee_number', 'empId', 'emp_id', '사번'],
  name: ['name', 'employeeName', 'empName', '직원명', '이름'],
  googleEmail: ['googleEmail', 'google_email', 'gwsEmail', 'gws_email', '구글이메일', 'google'],
  division: ['division', 'divisionName', 'division_name', '본부', '본부명'],
  section: ['section', 'sectionName', 'section_name', '실', '실명'],
  team: ['team', 'teamName', 'team_name', '팀', '팀명'],
  department: ['department', 'departmentName', 'deptName', 'dept_name', '부서명', '부서'],
  parentDepartment: [
    'parentDepartment',
    'parent_department',
    'parentDeptName',
    'parent_dept_name',
    '상위조직명',
    '상위조직',
    '상위부서명',
  ],
  title: ['title', 'jobTitle', 'job_title', 'positionTitle', '직책', '직위'],
  role: ['role', 'systemRole', '권한', '직급'],
  employmentStatus: ['employmentStatus', 'employment_status', 'status', '재직상태', '상태'],
  managerEmployeeNo: [
    'managerEmployeeNo',
    'managerEmployeeNumber',
    'manager_employee_number',
    'managerEmpId',
    'managerId',
    '상위사번',
    '관리자사번',
    'manager',
  ],
  joinDate: ['joinDate', 'join_date', '입사일', 'startDate'],
  resignationDate: ['resignationDate', 'resignation_date', '퇴사일', 'endDate'],
  sortOrder: ['sortOrder', 'sort_order', '정렬순서', 'displayOrder'],
  notes: ['notes', 'note', 'memo', '비고'],
}

const ROLE_INPUT_MAP: Record<string, SystemRole> = {
  ROLE_MEMBER: 'ROLE_MEMBER',
  ROLE_LEADER: 'ROLE_TEAM_LEADER',
  ROLE_ADMIN: 'ROLE_ADMIN',
}

const STATUS_INPUT_MAP: Record<string, EmployeeManagementStatus> = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ON_LEAVE: 'ON_LEAVE',
}

function normalizeHeaderKey(value: string) {
  return value.replace(/[\s_\-]/g, '').toLowerCase()
}

function normalizeTextValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseOptionalDate(value: unknown) {
  const normalized = normalizeTextValue(value)
  if (!normalized) {
    return { value: null as string | null, invalid: false }
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return { value: null as string | null, invalid: true }
  }

  return { value: parsed.toISOString().slice(0, 10), invalid: false }
}

function parseOptionalSortOrder(value: unknown) {
  const normalized = normalizeTextValue(value)
  if (!normalized) {
    return { value: null as number | null, invalid: false }
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { value: null as number | null, invalid: true }
  }

  return { value: parsed, invalid: false }
}

function normalizeRoleValue(value: unknown) {
  const normalized = normalizeTextValue(value).replace(/\s+/g, '').toUpperCase()
  return ROLE_INPUT_MAP[normalized] ?? null
}

function normalizeStatusValue(value: unknown) {
  const normalized = normalizeTextValue(value).replace(/\s+/g, '').toUpperCase()
  return STATUS_INPUT_MAP[normalized] ?? null
}

function mapRoleToPosition(role: SystemRole): Position {
  switch (role) {
    case 'ROLE_TEAM_LEADER':
      return 'TEAM_LEADER'
    case 'ROLE_SECTION_CHIEF':
      return 'SECTION_CHIEF'
    case 'ROLE_DIV_HEAD':
      return 'DIV_HEAD'
    case 'ROLE_CEO':
      return 'CEO'
    case 'ROLE_ADMIN':
    case 'ROLE_MEMBER':
    default:
      return 'MEMBER'
  }
}

function getUploadValue(row: Record<string, unknown>, key: EmployeeUploadFieldKey) {
  const aliasSet = new Set(HEADER_ALIASES[key].map(normalizeHeaderKey))

  for (const [header, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeaderKey(header))) {
      return value
    }
  }

  return ''
}

function addIssue(
  row: EmployeeUploadValidationRow,
  field: string,
  message: string,
  severity: EmployeeUploadIssue['severity'] = 'error'
) {
  row.issues.push({ field, message, severity })
}

function hasError(row: EmployeeUploadValidationRow) {
  return row.issues.some((issue) => issue.severity === 'error')
}

async function recalculateLeadershipLinks() {
  const hierarchyModule = await import('./employeeHierarchy')
  return hierarchyModule.recalculateEmployeeLeadershipLinks()
}

async function previewLeadershipLinks() {
  const hierarchyModule = await import('./employeeHierarchy')
  return hierarchyModule.previewEmployeeLeadershipLinks()
}

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError | { code: string } {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string')
  )
}

type EmployeeDeleteErrorInfo = {
  code?: string
  message: string
  name: string
}

function extractEmployeeDeleteErrorInfo(error: unknown): EmployeeDeleteErrorInfo {
  let current: unknown = error

  while (current && typeof current === 'object') {
    const currentRecord = current as {
      code?: unknown
      message?: unknown
      name?: unknown
      cause?: unknown
    }

    if (typeof currentRecord.code === 'string') {
      return {
        code: currentRecord.code,
        message: typeof currentRecord.message === 'string' ? currentRecord.message : 'unknown',
        name: typeof currentRecord.name === 'string' ? currentRecord.name : 'UnknownError',
      }
    }

    if ('cause' in currentRecord) {
      current = currentRecord.cause
      continue
    }

    break
  }

  return {
    message: error instanceof Error ? error.message : 'unknown',
    name: error instanceof Error ? error.name : 'UnknownError',
  }
}

function attachEmployeeDeleteStepContext<T extends object>(
  error: T,
  stepName: string
): T & { employeeDeleteStep?: string } {
  ;(error as T & { employeeDeleteStep?: string }).employeeDeleteStep = stepName
  return error as T & { employeeDeleteStep?: string }
}

function readEmployeeDeleteStep(error: unknown) {
  return typeof error === 'object' && error !== null && 'employeeDeleteStep' in error
    ? typeof (error as { employeeDeleteStep?: unknown }).employeeDeleteStep === 'string'
      ? (error as { employeeDeleteStep: string }).employeeDeleteStep
      : undefined
    : undefined
}

function logEmployeeDelete(event: string, payload: Record<string, unknown>) {
  console.info(`[admin-google-account] ${event}`, payload)
}

function compareMembers(
  a: Pick<EmployeeOrgChartMember, 'sortOrder' | 'departmentName' | 'teamName' | 'name'>,
  b: Pick<EmployeeOrgChartMember, 'sortOrder' | 'departmentName' | 'teamName' | 'name'>
) {
  const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
  if (orderDiff !== 0) {
    return orderDiff
  }

  const departmentDiff = a.departmentName.localeCompare(b.departmentName, 'ko')
  if (departmentDiff !== 0) {
    return departmentDiff
  }

  const teamDiff = (a.teamName ?? '').localeCompare(b.teamName ?? '', 'ko')
  if (teamDiff !== 0) {
    return teamDiff
  }

  return a.name.localeCompare(b.name, 'ko')
}

function resolveMasterLoginStateForEmployee(employee: {
  role: SystemRole
  gwsEmail: string
  masterLoginPermissionGranted: boolean
}) {
  return resolveMasterLoginAccess({
    role: employee.role,
    email: employee.gwsEmail,
    masterLoginPermissionGranted: employee.masterLoginPermissionGranted,
  })
}

export function buildEmployeeTemplateWorkbook() {
  const workbook = XLSX.utils.book_new()
  const templateRows = [
    EMPLOYEE_UPLOAD_TEMPLATE_HEADERS,
    EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS.map((column) => column.example),
  ]
  const guideRows = [
    ['column', 'required', 'description', 'example'],
    ...EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS.map((column) => [
      column.key,
      column.required ? 'Y' : 'N',
      column.description,
      column.example,
    ]),
    [],
    ['rules', '', '', ''],
    ['employmentStatus', '', '기존 파일에 있으면 ACTIVE / INACTIVE / ON_LEAVE를 검증합니다. 없으면 ACTIVE로 처리합니다.', ''],
    ['legacy optional columns', '', '기존 파일의 joinDate, resignationDate, sortOrder, notes, parentDepartment, department 컬럼은 계속 읽습니다.', ''],
    ['role', '', 'ROLE_MEMBER / ROLE_LEADER / ROLE_ADMIN', ''],
    [
      'managerEmployeeNo',
      '',
      '없으면 상급자 미지정 warning으로 처리합니다. 입력 시 같은 파일 또는 기존 등록 직원의 사번이어야 합니다.',
      '',
    ],
    ['division/section/team', '', 'parentDepartment/department 없이도 이 3개 컬럼으로 조직 경로를 구성합니다. section은 비워도 됩니다.', ''],
    ['googleEmail', '', `허용 도메인: ${getAllowedGoogleWorkspaceDomain()}`, ''],
  ]

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(templateRows), '직원업로드')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(guideRows), '작성안내')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function parseEmployeeUploadWorkbook(fileName: string, fileBuffer: Buffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined

  if (!sheet) {
    throw new AppError(400, 'EMPTY_UPLOAD_FILE', '업로드 파일에서 읽을 시트를 찾을 수 없습니다.')
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  if (!rows.length) {
    throw new AppError(400, 'EMPTY_UPLOAD_FILE', '업로드 파일에 데이터가 없습니다.')
  }

  return {
    fileName,
    rows,
  }
}

export function validateEmployeeUploadRows(params: {
  fileName: string
  rows: Array<Record<string, unknown>>
  existingEmployees: ExistingEmployeeSnapshot[]
  existingDepartments: ExistingDepartmentSnapshot[]
  allowedDomain?: string
}) {
  const allowedDomain = params.allowedDomain ?? getAllowedGoogleWorkspaceDomain()
  const existingByEmployeeNumber = new Map(
    params.existingEmployees.map((employee) => [employee.employeeNumber, employee] as const)
  )
  const existingByEmail = new Map(
    params.existingEmployees.map((employee) => [
      normalizeGoogleWorkspaceEmail(employee.googleEmail),
      employee,
    ] as const)
  )
  const rawEmployeeNumberCounts = new Map<string, number>()
  const rawEmailCounts = new Map<string, number>()

  for (const rawRow of params.rows) {
    const employeeNumber = normalizeTextValue(getUploadValue(rawRow, 'employeeNo'))
    const email = normalizeTextValue(getUploadValue(rawRow, 'googleEmail'))
    if (employeeNumber) {
      rawEmployeeNumberCounts.set(employeeNumber, (rawEmployeeNumberCounts.get(employeeNumber) ?? 0) + 1)
    }
    if (email) {
      const normalizedEmail = normalizeGoogleWorkspaceEmail(email)
      rawEmailCounts.set(normalizedEmail, (rawEmailCounts.get(normalizedEmail) ?? 0) + 1)
    }
  }

  const rows: EmployeeUploadValidationRow[] = params.rows.map((rawRow, index) => {
    const rowNumber = index + 2
    const employeeNumber = normalizeTextValue(getUploadValue(rawRow, 'employeeNo'))
    const name = normalizeTextValue(getUploadValue(rawRow, 'name'))
    const googleEmailValue = normalizeTextValue(getUploadValue(rawRow, 'googleEmail'))
    const division = normalizeTextValue(getUploadValue(rawRow, 'division'))
    const section = normalizeTextValue(getUploadValue(rawRow, 'section')) || null
    const team = normalizeTextValue(getUploadValue(rawRow, 'team'))
    const legacyDepartmentName = normalizeTextValue(getUploadValue(rawRow, 'department'))
    const legacyDepartmentCode = normalizeTextValue((rawRow as Record<string, unknown>).departmentCode ?? '')
    const departmentCode =
      legacyDepartmentCode ||
      normalizeTextValue((rawRow as Record<string, unknown>).department_code ?? '') ||
      normalizeTextValue((rawRow as Record<string, unknown>).deptCode ?? '') ||
      normalizeTextValue((rawRow as Record<string, unknown>).dept_code ?? '') ||
      null
    const legacyParentDepartment =
      normalizeTextValue(getUploadValue(rawRow, 'parentDepartment')) ||
      normalizeTextValue((rawRow as Record<string, unknown>).parentDepartmentCode ?? '') ||
      normalizeTextValue((rawRow as Record<string, unknown>).parent_department_code ?? '') ||
      normalizeTextValue((rawRow as Record<string, unknown>).parentDeptCode ?? '') ||
      normalizeTextValue((rawRow as Record<string, unknown>).상위조직코드 ?? '') ||
      null
    const departmentName = section || division || legacyDepartmentName
    const parentDepartment = section ? division : legacyParentDepartment
    const title = normalizeTextValue(getUploadValue(rawRow, 'title')) || null
    const managerEmployeeNumber =
      normalizeTextValue(getUploadValue(rawRow, 'managerEmployeeNo')) || null
    const joinDateResult = parseOptionalDate(getUploadValue(rawRow, 'joinDate'))
    const resignationDateResult = parseOptionalDate(getUploadValue(rawRow, 'resignationDate'))
    const sortOrderResult = parseOptionalSortOrder(getUploadValue(rawRow, 'sortOrder'))
    const notes = normalizeTextValue(getUploadValue(rawRow, 'notes')) || null
    const existing = employeeNumber ? existingByEmployeeNumber.get(employeeNumber) : undefined
    const role = normalizeRoleValue(getUploadValue(rawRow, 'role'))
    const employmentStatusInput = normalizeTextValue(getUploadValue(rawRow, 'employmentStatus'))
    const employmentStatus = employmentStatusInput ? normalizeStatusValue(employmentStatusInput) : 'ACTIVE'

    const row: EmployeeUploadValidationRow = {
      rowNumber,
      employeeNumber,
      name,
      action: existing ? 'update' : 'create',
      valid: false,
      issues: [],
      normalizedRow: null,
    }

    if (!employeeNumber) addIssue(row, 'employeeNo', '사번은 필수입니다.')
    if (!name) addIssue(row, 'name', '직원명은 필수입니다.')
    if (!googleEmailValue) addIssue(row, 'googleEmail', 'Google 이메일은 필수입니다.')
    if (!division) addIssue(row, 'division', '본부명은 필수입니다.')
    if (!team) addIssue(row, 'team', '팀명은 필수입니다.')
    if (!title) addIssue(row, 'title', '직책 또는 직위는 필수입니다.')
    if (!role) addIssue(row, 'role', '권한 값은 ROLE_MEMBER, ROLE_LEADER, ROLE_ADMIN 중 하나여야 합니다.')
    if (employmentStatusInput && !employmentStatus) {
      addIssue(row, 'employmentStatus', '재직 상태 값은 ACTIVE, INACTIVE, ON_LEAVE 중 하나여야 합니다.')
    }
    if (!employmentStatusInput) {
      addIssue(row, 'employmentStatus', 'employmentStatus 미입력: ACTIVE로 처리됩니다.', 'info')
    }
    if (joinDateResult.invalid) addIssue(row, 'joinDate', '입사일 형식이 올바르지 않습니다.')
    if (resignationDateResult.invalid) addIssue(row, 'resignationDate', '퇴사일 형식이 올바르지 않습니다.')
    if (sortOrderResult.invalid) addIssue(row, 'sortOrder', '정렬 순서는 0 이상의 정수여야 합니다.')
    if (team && departmentName && !normalizeLegacyTeamNameForDepartment(team, departmentName)) {
      addIssue(row, 'team', '부서명과 같은 팀명은 중복 저장하지 않고 부서 기준으로 표시합니다.', 'warning')
    }
    if (!managerEmployeeNumber) {
      addIssue(row, 'managerEmployeeNo', '상급자 사번이 없어 상급자 미지정으로 처리합니다.', 'warning')
    }

    let normalizedEmail: string | null = null
    if (googleEmailValue) {
      try {
        normalizedEmail = assertAllowedGoogleWorkspaceEmail(googleEmailValue, allowedDomain)
      } catch (error) {
        addIssue(
          row,
          'googleEmail',
          error instanceof AppError ? error.message : 'Google 이메일 형식이 올바르지 않습니다.'
        )
      }
    }

    if (resignationDateResult.value && employmentStatus === 'ACTIVE') {
      addIssue(row, 'resignationDate', 'ACTIVE 상태에서는 퇴사일을 비워도 되며, 업로드 적용 시 저장하지 않습니다.', 'warning')
    }
    if (managerEmployeeNumber && employeeNumber && managerEmployeeNumber === employeeNumber) {
      addIssue(row, 'managerEmployeeNo', '본인을 관리자로 지정할 수 없습니다.')
    }
    if (employeeNumber && (rawEmployeeNumberCounts.get(employeeNumber) ?? 0) > 1) {
      addIssue(row, 'employeeNumber', '파일 내에 동일한 사번이 중복되어 있습니다.')
    }
    if (normalizedEmail && (rawEmailCounts.get(normalizedEmail) ?? 0) > 1) {
      addIssue(row, 'googleEmail', '파일 내에 동일한 Google 이메일이 중복되어 있습니다.')
    }
    if (normalizedEmail) {
      const duplicateByEmail = existingByEmail.get(normalizedEmail)
      if (duplicateByEmail && duplicateByEmail.employeeNumber !== employeeNumber) {
        addIssue(
          row,
          'googleEmail',
          `${normalizedEmail} 이메일은 이미 ${duplicateByEmail.name}(${duplicateByEmail.employeeNumber})에게 연결되어 있습니다.`
        )
      }
    }

    if (!hasError(row) && normalizedEmail && role && employmentStatus) {
      row.normalizedRow = {
        rowNumber,
        employeeNumber,
        name,
        googleEmail: normalizedEmail,
        division,
        section,
        departmentCode,
        department: departmentName,
        parentDepartment,
        team,
        title,
        role,
        employmentStatus,
        managerEmployeeNumber,
        joinDate: joinDateResult.value,
        resignationDate: resignationDateResult.value,
        sortOrder: sortOrderResult.value,
        notes,
      }
    }

    return row
  })

  const knownEmployeeNumbers = new Set(params.existingEmployees.map((employee) => employee.employeeNumber))
  for (const row of rows) {
    if (row.employeeNumber) {
      knownEmployeeNumbers.add(row.employeeNumber)
    }
  }

  for (const row of rows) {
    if (!row.normalizedRow?.managerEmployeeNumber) {
      continue
    }
    if (!knownEmployeeNumbers.has(row.normalizedRow.managerEmployeeNumber)) {
      addIssue(row, 'managerEmployeeNo', '지정한 관리자의 사번을 찾을 수 없습니다.')
      row.normalizedRow = null
    }
  }

  const combinedManagerMap = new Map(
    params.existingEmployees.map((employee) => [
      employee.employeeNumber,
      employee.managerEmployeeNumber,
    ] as const)
  )
  for (const row of rows) {
    if (row.normalizedRow) {
      combinedManagerMap.set(row.normalizedRow.employeeNumber, row.normalizedRow.managerEmployeeNumber)
    }
  }

  const cycleIds = new Set<string>()
  for (const employeeNumber of combinedManagerMap.keys()) {
    const visited = new Map<string, number>()
    const path: string[] = []
    let current: string | null | undefined = employeeNumber

    while (current) {
      const seenIndex = visited.get(current)
      if (seenIndex !== undefined) {
        for (const cycleId of path.slice(seenIndex)) {
          cycleIds.add(cycleId)
        }
        break
      }

      visited.set(current, path.length)
      path.push(current)
      current = combinedManagerMap.get(current)
      if (current && !knownEmployeeNumbers.has(current)) {
        break
      }
    }
  }

  for (const row of rows) {
    if (row.normalizedRow && cycleIds.has(row.normalizedRow.employeeNumber)) {
      addIssue(row, 'managerEmployeeNo', '관리자 연결에 순환 참조가 있습니다.')
      row.normalizedRow = null
    }
    row.valid = !hasError(row)
  }

  const validRows = rows.filter((row) => row.valid && row.normalizedRow).map((row) => row.normalizedRow!)
  const errors = rows.flatMap((row) =>
    row.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => ({
        rowNumber: row.rowNumber,
        employeeNumber: row.employeeNumber || undefined,
        field: issue.field,
        message: issue.message,
      }))
  )
  const warningCount = rows.reduce(
    (count, row) => count + row.issues.filter((issue) => issue.severity === 'warning').length,
    0
  )
  const infoCount = rows.reduce(
    (count, row) => count + row.issues.filter((issue) => issue.severity === 'info').length,
    0
  )

  return {
    fileName: params.fileName,
    summary: {
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: rows.length - validRows.length,
      createCount: rows.filter((row) => row.valid && row.action === 'create').length,
      updateCount: rows.filter((row) => row.valid && row.action === 'update').length,
      errorCount: errors.length,
      warningCount,
      infoCount,
    },
    rows,
    validRows,
    errors,
  } satisfies EmployeeUploadValidationResult
}

function buildUploadDepartmentPlanKey(path: string[]) {
  return path.map((part) => part.trim().toUpperCase()).join('>')
}

export function buildEmployeeUploadDepartmentPlan(rows: EmployeeUploadNormalizedRow[]) {
  const planByKey = new Map<string, EmployeeUploadDepartmentPlanItem>()

  const addPath = (params: {
    path: string[]
    departmentCode?: string | null
    scope: OrgKpiScope
  }) => {
    const path = params.path.map((part) => part.trim()).filter(Boolean)
    const departmentName = path.at(-1)
    if (!departmentName) return

    const key = buildUploadDepartmentPlanKey(path)
    if (planByKey.has(key)) return

    planByKey.set(key, {
      key,
      path,
      departmentName,
      parentPath: path.slice(0, -1),
      departmentCode: params.departmentCode?.trim() || null,
      scope: params.scope,
    })
  }

  for (const row of rows) {
    addPath({
      path: [row.division],
      scope: 'division',
    })

    if (row.section) {
      addPath({
        path: [row.division, row.section],
        scope: 'section',
      })
      addPath({
        path: [row.division, row.section, row.team ?? ''],
        departmentCode: row.departmentCode,
        scope: 'team',
      })
      continue
    }

    addPath({
      path: [row.division, row.team ?? ''],
      departmentCode: row.departmentCode,
      scope: 'team',
    })
  }

  return Array.from(planByKey.values()).sort(
    (left, right) =>
      left.path.length - right.path.length ||
      left.path.join('/').localeCompare(right.path.join('/'), 'ko')
  )
}

export function summarizeDepartmentScopes<TDepartment extends { scope: OrgKpiScope }>(
  departments: TDepartment[]
): DepartmentScopeSummary {
  return {
    totalDepartments: departments.length,
    divisionCount: departments.filter((department) => department.scope === 'division').length,
    sectionCount: departments.filter((department) => department.scope === 'section').length,
    teamCount: departments.filter((department) => department.scope === 'team').length,
  }
}

export function collectDepartmentAndDescendantIds(
  departments: Array<{ id: string; parentDeptId: string | null }>,
  departmentId: string
) {
  const childrenByParentId = new Map<string, string[]>()

  for (const department of departments) {
    if (!department.parentDeptId) continue

    const children = childrenByParentId.get(department.parentDeptId) ?? []
    children.push(department.id)
    childrenByParentId.set(department.parentDeptId, children)
  }

  const departmentIds = new Set([departmentId])
  const queue = [...(childrenByParentId.get(departmentId) ?? [])]

  while (queue.length > 0) {
    const currentDepartmentId = queue.shift()!
    if (departmentIds.has(currentDepartmentId)) continue

    departmentIds.add(currentDepartmentId)
    queue.push(...(childrenByParentId.get(currentDepartmentId) ?? []))
  }

  return departmentIds
}

export async function loadEmployeeValidationContext() {
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        empId: true,
        empName: true,
        gwsEmail: true,
        status: true,
        managerId: true,
      },
    }),
    prisma.department.findMany({
      select: {
        id: true,
        deptCode: true,
        deptName: true,
        parentDeptId: true,
      },
      orderBy: [{ deptName: 'asc' }],
    }),
  ])

  const employeeNumberById = new Map(employees.map((employee) => [employee.id, employee.empId]))

  return {
    existingEmployees: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      googleEmail: employee.gwsEmail,
      status: employee.status as EmployeeManagementStatus,
      managerId: employee.managerId,
      managerEmployeeNumber: employee.managerId ? employeeNumberById.get(employee.managerId) ?? null : null,
    })),
    existingDepartments: departments,
  }
}

function getHistoryNumber(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return 0
  }

  return Number((value as Record<string, unknown>)[key] ?? 0)
}

function looksLikeLegacySectionName(value?: string | null) {
  return typeof value === 'string' && value.trim().endsWith('실')
}

function normalizeLegacyTeamName(value?: string | null) {
  const normalized = value?.trim() ?? ''
  return normalized.length > 0 ? normalized : null
}

function normalizeEmployeeTeamName(value?: string | null, departmentName?: string | null) {
  return normalizeLegacyTeamNameForDepartment(normalizeLegacyTeamName(value), departmentName)
}

function looksLikeLegacyTeamName(value?: string | null) {
  const normalized = normalizeLegacyTeamName(value)
  return Boolean(normalized && !looksLikeLegacySectionName(normalized))
}

function buildGeneratedSectionDepartmentCode(
  parentDepartmentCode: string,
  existingDepartmentCodes: Set<string>,
) {
  let sequence = 1
  while (true) {
    const candidate = `${parentDepartmentCode}-SEC-${sequence}`
    if (!existingDepartmentCodes.has(candidate)) {
      return candidate
    }
    sequence += 1
  }
}

function buildGeneratedTeamDepartmentCode(
  parentDepartmentCode: string,
  existingDepartmentCodes: Set<string>,
) {
  let sequence = 1
  while (true) {
    const candidate = `${parentDepartmentCode}-TEAM-${sequence}`
    if (!existingDepartmentCodes.has(candidate)) {
      return candidate
    }
    sequence += 1
  }
}

function buildGeneratedDivisionDepartmentCode(existingDepartmentCodes: Set<string>) {
  let sequence = 1
  while (true) {
    const candidate = `DIV-${sequence}`
    if (!existingDepartmentCodes.has(candidate)) {
      return candidate
    }
    sequence += 1
  }
}

async function findOrCreateChildDepartment(params: {
  parentDepartment: {
    id: string
    orgId: string
    deptCode: string
  }
  childDepartmentName: string
  existingDepartmentCodes?: Set<string>
  codeBuilder: (parentDepartmentCode: string, existingDepartmentCodes: Set<string>) => string
}) {
  const normalizedChildName = params.childDepartmentName.trim()
  const existingChildDepartment = await prisma.department.findFirst({
    where: {
      parentDeptId: params.parentDepartment.id,
      deptName: normalizedChildName,
    },
    select: {
      id: true,
      orgId: true,
      deptCode: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
    },
  })

  if (existingChildDepartment) {
    return existingChildDepartment
  }

  const existingDepartmentCodes =
    params.existingDepartmentCodes ??
    new Set(
      (
        await prisma.department.findMany({
          select: {
            deptCode: true,
          },
        })
      ).map((department) => department.deptCode),
    )

  const createdDepartment = await prisma.department.create({
    data: {
      orgId: params.parentDepartment.orgId,
      deptCode: params.codeBuilder(params.parentDepartment.deptCode, existingDepartmentCodes),
      deptName: normalizedChildName,
      parentDeptId: params.parentDepartment.id,
    },
    select: {
      id: true,
      orgId: true,
      deptCode: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
    },
  })

  existingDepartmentCodes.add(createdDepartment.deptCode)

  return createdDepartment
}

async function reconcileLegacySectionDepartments() {
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        orgId: true,
        deptCode: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
      },
      orderBy: [{ deptName: 'asc' }],
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        deptId: true,
        teamName: true,
        role: true,
      },
    }),
  ])

  const departmentById = new Map(departments.map((department) => [department.id, department] as const))
  const scopeMap = buildOrgKpiDepartmentScopeMap(departments)
  const existingDepartmentCodes = new Set(departments.map((department) => department.deptCode))
  const childrenByParentId = new Map<string, typeof departments>()

  departments.forEach((department) => {
    const children = childrenByParentId.get(department.parentDeptId ?? '') ?? []
    children.push(department)
    childrenByParentId.set(department.parentDeptId ?? '', children)
  })

  const candidateEmployees = employees.filter((employee) => {
    if (!looksLikeLegacySectionName(employee.teamName)) return false
    const department = departmentById.get(employee.deptId)
    if (!department) return false
    return (scopeMap.get(department.id) ?? 'team') === 'division'
  })

  if (candidateEmployees.length === 0) {
    return { createdDepartmentCount: 0, migratedEmployeeCount: 0 }
  }

  const reconciliationTargets = new Map<
    string,
    {
      divisionDepartment: (typeof departments)[number]
      sectionName: string
      employeeIds: string[]
      sectionLeaderEmployeeId: string | null
    }
  >()

  candidateEmployees.forEach((employee) => {
    const divisionDepartment = departmentById.get(employee.deptId)
    const sectionName = employee.teamName?.trim()
    if (!divisionDepartment || !sectionName) return

    const key = `${divisionDepartment.id}:${sectionName}`
    const existing = reconciliationTargets.get(key)
    if (existing) {
      existing.employeeIds.push(employee.id)
      if (!existing.sectionLeaderEmployeeId && employee.role === 'ROLE_SECTION_CHIEF') {
        existing.sectionLeaderEmployeeId = employee.id
      }
      return
    }

    reconciliationTargets.set(key, {
      divisionDepartment,
      sectionName,
      employeeIds: [employee.id],
      sectionLeaderEmployeeId: employee.role === 'ROLE_SECTION_CHIEF' ? employee.id : null,
    })
  })

  let createdDepartmentCount = 0
  let migratedEmployeeCount = 0

  for (const target of reconciliationTargets.values()) {
    const existingSectionDepartment =
      (childrenByParentId.get(target.divisionDepartment.id) ?? []).find(
        (department) => department.deptName === target.sectionName,
      ) ?? null

    const sectionDepartment =
      existingSectionDepartment ??
      (await prisma.department.create({
        data: {
          orgId: target.divisionDepartment.orgId,
          deptCode: buildGeneratedSectionDepartmentCode(
            target.divisionDepartment.deptCode,
            existingDepartmentCodes,
          ),
          deptName: target.sectionName,
          parentDeptId: target.divisionDepartment.id,
          leaderEmployeeId: target.sectionLeaderEmployeeId,
        },
      }))

    if (!existingSectionDepartment) {
      createdDepartmentCount += 1
      existingDepartmentCodes.add(sectionDepartment.deptCode)
      const siblings = childrenByParentId.get(target.divisionDepartment.id) ?? []
      siblings.push(sectionDepartment)
      childrenByParentId.set(target.divisionDepartment.id, siblings)
    } else if (
      target.sectionLeaderEmployeeId &&
      existingSectionDepartment.leaderEmployeeId !== target.sectionLeaderEmployeeId
    ) {
      await prisma.department.update({
        where: { id: existingSectionDepartment.id },
        data: { leaderEmployeeId: target.sectionLeaderEmployeeId },
      })
    }

    const migrationResult = await prisma.employee.updateMany({
      where: {
        id: { in: target.employeeIds },
        deptId: target.divisionDepartment.id,
        teamName: target.sectionName,
      },
      data: {
        deptId: sectionDepartment.id,
        teamName: null,
      },
    })

    migratedEmployeeCount += migrationResult.count
  }

  if (createdDepartmentCount > 0 || migratedEmployeeCount > 0) {
    await recalculateLeadershipLinks()
  }

  return {
    createdDepartmentCount,
    migratedEmployeeCount,
  }
}

async function reconcileLegacyTeamDepartments() {
  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        orgId: true,
        deptCode: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
      },
      orderBy: [{ deptName: 'asc' }],
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        deptId: true,
        teamName: true,
      },
    }),
  ])

  const departmentById = new Map(departments.map((department) => [department.id, department] as const))
  const scopeMap = buildOrgKpiDepartmentScopeMap(departments)
  const existingDepartmentCodes = new Set(departments.map((department) => department.deptCode))

  const candidateEmployees = employees.filter((employee) => {
    if (!looksLikeLegacyTeamName(employee.teamName)) return false
    const department = departmentById.get(employee.deptId)
    if (!department) return false
    const departmentScope = scopeMap.get(department.id) ?? 'team'
    return departmentScope === 'division' || departmentScope === 'section'
  })

  if (candidateEmployees.length === 0) {
    return { createdDepartmentCount: 0, migratedEmployeeCount: 0 }
  }

  const reconciliationTargets = new Map<
    string,
    {
      parentDepartment: (typeof departments)[number]
      teamName: string
      employeeIds: string[]
    }
  >()

  candidateEmployees.forEach((employee) => {
    const parentDepartment = departmentById.get(employee.deptId)
    const teamName = normalizeLegacyTeamName(employee.teamName)
    if (!parentDepartment || !teamName) return

    const key = `${parentDepartment.id}:${teamName}`
    const existing = reconciliationTargets.get(key)
    if (existing) {
      existing.employeeIds.push(employee.id)
      return
    }

    reconciliationTargets.set(key, {
      parentDepartment,
      teamName,
      employeeIds: [employee.id],
    })
  })

  let createdDepartmentCount = 0
  let migratedEmployeeCount = 0

  for (const target of reconciliationTargets.values()) {
    const existingTeamDepartment = departments.find(
      (department) =>
        department.parentDeptId === target.parentDepartment.id && department.deptName === target.teamName,
    )

    const teamDepartment =
      existingTeamDepartment ??
      (await findOrCreateChildDepartment({
        parentDepartment: target.parentDepartment,
        childDepartmentName: target.teamName,
        existingDepartmentCodes,
        codeBuilder: buildGeneratedTeamDepartmentCode,
      }))

    if (!existingTeamDepartment) {
      createdDepartmentCount += 1
    }

    const migrationResult = await prisma.employee.updateMany({
      where: {
        id: { in: target.employeeIds },
        deptId: target.parentDepartment.id,
        teamName: target.teamName,
      },
      data: {
        deptId: teamDepartment.id,
        teamName: null,
      },
    })

    migratedEmployeeCount += migrationResult.count
  }

  if (createdDepartmentCount > 0 || migratedEmployeeCount > 0) {
    await recalculateLeadershipLinks()
  }

  return {
    createdDepartmentCount,
    migratedEmployeeCount,
  }
}

export async function loadEmployeeDirectory(params: {
  query?: string
  status?: string
  departmentId?: string
}) {
  await reconcileLegacySectionDepartments()
  await reconcileLegacyTeamDepartments()

  const [departments, employees, uploadHistory] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        deptCode: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
        excludeLeaderFromEvaluatorAutoAssign: true,
        _count: {
          select: {
            orgKpis: true,
          },
        },
      },
      orderBy: [{ deptName: 'asc' }],
    }),
    prisma.employee.findMany({
      include: {
        department: {
          select: {
            id: true,
            deptCode: true,
            deptName: true,
          },
        },
      },
      orderBy: [{ empName: 'asc' }],
    }),
    prisma.uploadHistory.findMany({
      where: {
        uploadType: 'EMPLOYEE_BULK',
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      take: 10,
    }),
  ])

  const employeeNumberById = new Map(employees.map((employee) => [employee.id, employee.empId]))
  const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.empName]))
  const directReportCountByManagerId = new Map<string, number>()
  const memberCountByDepartmentId = new Map<string, number>()
  const departmentScopeMap = buildOrgKpiDepartmentScopeMap(departments)

  for (const employee of employees) {
    memberCountByDepartmentId.set(employee.deptId, (memberCountByDepartmentId.get(employee.deptId) ?? 0) + 1)
    if (employee.managerId) {
      directReportCountByManagerId.set(
        employee.managerId,
        (directReportCountByManagerId.get(employee.managerId) ?? 0) + 1
      )
    }
  }

  const normalizedQuery = params.query?.trim().toLowerCase() ?? ''
  const requestedStatus = params.status && params.status !== 'ALL' ? params.status : null
  const requestedDepartmentId = params.departmentId?.trim() || null

  const directoryItems: EmployeeDirectoryItem[] = employees
    .filter((employee) => {
      if (requestedStatus && employee.status !== requestedStatus) return false
      if (requestedDepartmentId && employee.deptId !== requestedDepartmentId) return false
      if (!normalizedQuery) return true

      const target = [
        employee.empId,
        employee.empName,
        employee.gwsEmail,
        employee.department.deptName,
        employee.department.deptCode,
        normalizeEmployeeTeamName(employee.teamName, employee.department.deptName) ?? '',
        employee.jobTitle ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return target.includes(normalizedQuery)
    })
    .map((employee) => {
      const masterLoginAccess = resolveMasterLoginStateForEmployee(employee)

      return {
        id: employee.id,
        employeeNumber: employee.empId,
        name: employee.empName,
        googleEmail: employee.gwsEmail,
        departmentId: employee.department.id,
        departmentCode: employee.department.deptCode,
        departmentName: employee.department.deptName,
        teamName: normalizeEmployeeTeamName(employee.teamName, employee.department.deptName),
        jobTitle: employee.jobTitle,
        role: employee.role,
        employmentStatus: employee.status as EmployeeManagementStatus,
        joinDate: employee.joinDate.toISOString().slice(0, 10),
        resignationDate: employee.resignationDate
          ? employee.resignationDate.toISOString().slice(0, 10)
          : null,
        managerId: employee.managerId,
        managerEmployeeNumber: employee.managerId ? employeeNumberById.get(employee.managerId) ?? null : null,
        managerName: employee.managerId ? employeeNameById.get(employee.managerId) ?? null : null,
        sortOrder: employee.sortOrder,
        notes: employee.notes,
        directReportCount: directReportCountByManagerId.get(employee.id) ?? 0,
        loginEnabled: employee.status === 'ACTIVE',
        masterLoginPermissionGranted: employee.masterLoginPermissionGranted,
        masterLoginAccessSource: masterLoginAccess.source,
        masterLoginAvailable: masterLoginAccess.allowed,
      }
    })

  const directoryDepartments = departments.map((department) => ({
    id: department.id,
    deptCode: department.deptCode,
    deptName: department.deptName,
    parentDeptId: department.parentDeptId,
    scope: departmentScopeMap.get(department.id) ?? 'team',
    leaderEmployeeId: department.leaderEmployeeId,
    leaderEmployeeNumber: department.leaderEmployeeId
      ? employeeNumberById.get(department.leaderEmployeeId) ?? null
      : null,
    leaderEmployeeName: department.leaderEmployeeId
      ? employeeNameById.get(department.leaderEmployeeId) ?? null
      : null,
    excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
    memberCount: memberCountByDepartmentId.get(department.id) ?? 0,
    orgKpiCount: department._count.orgKpis,
  }))
  const departmentSummary = summarizeDepartmentScopes(directoryDepartments)

  return {
    allowedDomain: getAllowedGoogleWorkspaceDomain(),
    departments: directoryDepartments,
    managerOptions: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      employmentStatus: employee.status as EmployeeManagementStatus,
      departmentName: employee.department.deptName,
    })),
    summary: {
      ...departmentSummary,
      totalEmployees: employees.length,
      activeEmployees: employees.filter((employee) => employee.status === 'ACTIVE').length,
      inactiveEmployees: employees.filter((employee) => employee.status === 'INACTIVE').length,
      resignedEmployees: employees.filter((employee) => employee.status === 'RESIGNED').length,
      unassignedManagerCount: employees.filter(
        (employee) => employee.status === 'ACTIVE' && !employee.managerId
      ).length,
    },
    uploadHistory: uploadHistory.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      totalRows: item.totalRows,
      successCount: item.successCount,
      failedCount: item.failCount,
      createdCount: getHistoryNumber(item.errorDetails, 'createdCount'),
      updatedCount: getHistoryNumber(item.errorDetails, 'updatedCount'),
      hierarchyUpdatedCount: getHistoryNumber(item.errorDetails, 'hierarchyUpdatedCount'),
      uploadedAt: item.uploadedAt.toISOString(),
      uploaderId: item.uploaderId,
    })),
    employees: directoryItems,
  }
}

export async function loadMasterLoginTargetPreview(targetEmployeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: {
      id: true,
      empId: true,
      empName: true,
      gwsEmail: true,
      status: true,
      role: true,
      department: {
        select: {
          deptName: true,
          deptCode: true,
        },
      },
    },
  })

  if (!employee) {
    throw new AppError(404, 'MASTER_LOGIN_TARGET_NOT_FOUND', '접속할 구성원 계정을 찾을 수 없습니다.')
  }

  if (employee.status !== 'ACTIVE') {
    throw new AppError(
      409,
      'MASTER_LOGIN_TARGET_INACTIVE',
      '재직 중인 구성원 계정으로만 마스터 로그인을 시작할 수 있습니다.'
    )
  }

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      googleEmail: employee.gwsEmail,
      role: employee.role,
      employmentStatus: employee.status as EmployeeManagementStatus,
      departmentName: employee.department.deptName,
      departmentCode: employee.department.deptCode,
      loginEnabled: true,
    },
  }
}

async function resolveDepartmentOrThrow(deptId: string) {
  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: {
      id: true,
      orgId: true,
      deptCode: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
      excludeLeaderFromEvaluatorAutoAssign: true,
    },
  })

  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '선택한 부서를 찾을 수 없습니다.')
  }

  return department
}

async function resolveDepartmentLeaderOrThrow(leaderEmployeeId?: string | null) {
  if (!leaderEmployeeId) {
    return null
  }

  const leader = await prisma.employee.findUnique({
    where: { id: leaderEmployeeId },
    select: {
      id: true,
      empId: true,
      empName: true,
      deptId: true,
      status: true,
    },
  })

  if (!leader) {
    throw new AppError(404, 'DEPARTMENT_LEADER_NOT_FOUND', '조직 리더를 찾을 수 없습니다.')
  }

  if (leader.status !== 'ACTIVE') {
    throw new AppError(400, 'DEPARTMENT_LEADER_INACTIVE', '재직 중인 구성원만 조직 리더로 지정할 수 있습니다.')
  }

  return leader
}

function validateRequestedDepartmentType(params: {
  departmentType: OrgKpiScope
  deptName: string
  parentDepartment: {
    id: string
    deptName?: string | null
    parentDeptId: string | null
  } | null
  existingChildren: Array<{
    id: string
    deptName?: string | null
    parentDeptId: string | null
  }>
  allDepartments: Array<{
    id: string
    deptName?: string | null
    parentDeptId: string | null
  }>
}) {
  const scopeMap = buildOrgKpiDepartmentScopeMap(params.allDepartments)
  const parentScope = params.parentDepartment
    ? scopeMap.get(params.parentDepartment.id) ?? 'team'
    : null
  const childScopes = params.existingChildren.map((department) => scopeMap.get(department.id) ?? 'team')

  if (params.departmentType === 'division') {
    if (params.parentDepartment) {
      throw new AppError(400, 'DEPARTMENT_TYPE_PARENT_INVALID', '본부 조직은 최상위 조직으로만 생성하거나 이동할 수 있습니다.')
    }

    if (childScopes.some((scope) => scope === 'division')) {
      throw new AppError(409, 'DEPARTMENT_TYPE_CHILD_INVALID', '본부 아래에는 본부를 둘 수 없습니다. 하위 조직 유형을 먼저 정리해 주세요.')
    }

    return
  }

  if (params.departmentType === 'section') {
    if (!params.parentDepartment || parentScope !== 'division') {
      throw new AppError(400, 'DEPARTMENT_TYPE_PARENT_INVALID', '실 조직은 본부 바로 아래에만 생성하거나 이동할 수 있습니다.')
    }

    if (!params.deptName.trim().endsWith('실')) {
      throw new AppError(400, 'DEPARTMENT_SECTION_NAME_INVALID', '실 조직명은 "실"로 끝나야 합니다.')
    }

    if (childScopes.some((scope) => scope !== 'team')) {
      throw new AppError(409, 'DEPARTMENT_TYPE_CHILD_INVALID', '실 아래에는 팀 조직만 둘 수 있습니다. 하위 조직을 먼저 정리해 주세요.')
    }

    return
  }

  if (!params.parentDepartment || (parentScope !== 'division' && parentScope !== 'section')) {
    throw new AppError(400, 'DEPARTMENT_TYPE_PARENT_INVALID', '팀 조직은 본부 또는 실 바로 아래에만 생성하거나 이동할 수 있습니다.')
  }

  if (params.existingChildren.length > 0) {
    throw new AppError(409, 'DEPARTMENT_TYPE_CHILD_INVALID', '팀 조직 아래에는 하위 조직을 둘 수 없습니다. 하위 조직을 먼저 이동하거나 삭제해 주세요.')
  }
}

async function syncSectionLeaderDepartment(params: {
  employeeId: string
  deptId: string
  role: SystemRole
  departments?: Array<{
    id: string
    deptName?: string | null
    parentDeptId: string | null
    leaderEmployeeId: string | null
  }>
}) {
  const departments =
    params.departments ??
    (await prisma.department.findMany({
      select: {
        id: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
      },
    }))
  const scopeMap = buildOrgKpiDepartmentScopeMap(departments)
  const selectedScope = resolveOrgKpiScopeFromDepartmentId(params.deptId, departments)

  if (params.role === 'ROLE_SECTION_CHIEF' && selectedScope !== 'section') {
    throw new AppError(400, 'SECTION_CHIEF_SCOPE_INVALID', '실장은 실 조직에만 지정할 수 있습니다.')
  }

  const currentSectionLeaderDepartmentIds = departments
    .filter(
      (department) =>
        department.leaderEmployeeId === params.employeeId && (scopeMap.get(department.id) ?? 'team') === 'section',
    )
    .map((department) => department.id)

  const shouldLeadSelectedSection = params.role === 'ROLE_SECTION_CHIEF' && selectedScope === 'section'
  const sectionDepartmentIdsToClear = currentSectionLeaderDepartmentIds.filter(
    (departmentId) => departmentId !== params.deptId,
  )

  if (sectionDepartmentIdsToClear.length > 0) {
    await prisma.department.updateMany({
      where: {
        id: { in: sectionDepartmentIdsToClear },
        leaderEmployeeId: params.employeeId,
      },
      data: { leaderEmployeeId: null },
    })
  }

  if (shouldLeadSelectedSection) {
    await prisma.department.update({
      where: { id: params.deptId },
      data: { leaderEmployeeId: params.employeeId },
    })
  } else if (currentSectionLeaderDepartmentIds.includes(params.deptId)) {
    await prisma.department.update({
      where: { id: params.deptId },
      data: { leaderEmployeeId: null },
    })
  }
}

export async function loadEvaluatorAssignmentPreview(): Promise<EvaluatorAssignmentPreview> {
  const preview = await previewLeadershipLinks()

  return {
    summary: preview.summary,
    changedEmployees: preview.changedEmployees.map((item) => ({
      employeeId: item.employeeId,
      employeeNumber: item.empId,
      employeeName: item.empName,
      departmentName: item.deptName,
      role: item.role,
      changedFields: item.changedFields,
      current: item.current,
      next: item.next,
    })),
  }
}

export async function applyEvaluatorAssignments() {
  const preview = await loadEvaluatorAssignmentPreview()
  const hierarchyResult = await recalculateLeadershipLinks()

  return {
    summary: preview.summary,
    appliedCount: preview.summary.changedEmployeeCount,
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

export async function upsertDepartmentRecord(params: {
  departmentId?: string
  deptName: string
  departmentType: OrgKpiScope
  parentDeptId?: string | null
  leaderEmployeeId?: string | null
  excludeLeaderFromEvaluatorAutoAssign?: boolean
}) {
  const normalizedName = params.deptName.trim()
  const parentDeptId = params.parentDeptId?.trim() || null
  const leader = await resolveDepartmentLeaderOrThrow(params.leaderEmployeeId)

  const existingDepartment = params.departmentId
    ? await prisma.department.findUnique({
        where: { id: params.departmentId },
        select: { id: true, orgId: true, deptCode: true },
      })
    : null

  if (params.departmentId && !existingDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
  }

  if (parentDeptId && params.departmentId && parentDeptId === params.departmentId) {
    throw new AppError(400, 'DEPARTMENT_PARENT_SELF', '조직의 상위 조직을 자기 자신으로 지정할 수 없습니다.')
  }

  let parentDepartment:
    | {
        id: string
        orgId: string
        deptCode: string
        deptName: string
        parentDeptId: string | null
      }
    | null = null

  if (parentDeptId) {
    parentDepartment = await prisma.department.findUnique({
      where: { id: parentDeptId },
      select: { id: true, orgId: true, deptName: true, parentDeptId: true, deptCode: true },
    })

    if (!parentDepartment) {
      throw new AppError(404, 'DEPARTMENT_PARENT_NOT_FOUND', '상위 조직을 찾을 수 없습니다.')
    }

    if (existingDepartment && parentDepartment.orgId !== existingDepartment.orgId) {
      throw new AppError(400, 'DEPARTMENT_PARENT_ORG_MISMATCH', '같은 조직 체계 안에서만 상위 조직을 지정할 수 있습니다.')
    }

    if (params.departmentId) {
      const visited = new Set<string>()
      let currentParentId: string | null = parentDepartment.id

      while (currentParentId && !visited.has(currentParentId)) {
        if (currentParentId === params.departmentId) {
          throw new AppError(400, 'DEPARTMENT_PARENT_CYCLE', '조직 상위 관계에 순환이 생기지 않도록 설정해 주세요.')
        }

        visited.add(currentParentId)
        const current: { parentDeptId: string | null } | null = await prisma.department.findUnique({
          where: { id: currentParentId },
          select: { parentDeptId: true },
        })
        currentParentId = current?.parentDeptId ?? null
      }
    }
  }

  const orgId =
    existingDepartment?.orgId ??
    parentDepartment?.orgId ??
    (await prisma.organization.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }))?.id

  if (!orgId) {
    throw new AppError(500, 'ORG_NOT_FOUND', '조직 기준 정보가 없어 조직을 저장할 수 없습니다.')
  }

  const existingDepartmentCodes = new Set(
    (
      await prisma.department.findMany({
        where: { orgId },
        select: { deptCode: true },
      })
    ).map((department) => department.deptCode)
  )

  const hierarchyDepartments = await prisma.department.findMany({
    where: { orgId },
    select: {
      id: true,
      deptName: true,
      parentDeptId: true,
    },
  })
  const existingChildren = params.departmentId
    ? hierarchyDepartments.filter((department) => department.parentDeptId === params.departmentId)
    : []

  validateRequestedDepartmentType({
    departmentType: params.departmentType,
    deptName: normalizedName,
    parentDepartment,
    existingChildren,
    allDepartments: hierarchyDepartments,
  })

  const normalizedCode = existingDepartment?.id
    ? existingDepartment.deptCode
    : params.departmentType === 'division'
      ? buildGeneratedDivisionDepartmentCode(existingDepartmentCodes)
      : parentDepartment
        ? params.departmentType === 'section'
          ? buildGeneratedSectionDepartmentCode(parentDepartment.deptCode, existingDepartmentCodes)
          : buildGeneratedTeamDepartmentCode(parentDepartment.deptCode, existingDepartmentCodes)
        : null

  if (!normalizedCode) {
    throw new AppError(400, 'DEPARTMENT_CODE_GENERATION_FAILED', '조직 코드를 자동 생성할 수 없습니다.')
  }

  const department = params.departmentId
    ? await prisma.department.update({
        where: { id: params.departmentId },
        data: {
          deptCode: normalizedCode,
          deptName: normalizedName,
          parentDeptId,
          leaderEmployeeId: leader?.id ?? null,
          excludeLeaderFromEvaluatorAutoAssign: Boolean(params.excludeLeaderFromEvaluatorAutoAssign),
        },
      })
    : await prisma.department.create({
        data: {
          deptCode: normalizedCode,
          deptName: normalizedName,
          parentDeptId,
          leaderEmployeeId: leader?.id ?? null,
          excludeLeaderFromEvaluatorAutoAssign: Boolean(params.excludeLeaderFromEvaluatorAutoAssign),
          orgId,
        },
      })

  const hierarchyResult = await recalculateLeadershipLinks()

  return {
    department: {
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      scope: params.departmentType,
      leaderEmployeeId: leader?.id ?? null,
      leaderEmployeeNumber: leader?.empId ?? null,
      leaderEmployeeName: leader?.empName ?? null,
      excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
    },
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

export async function deleteDepartmentRecord(
  params: {
    departmentId: string
  },
  deps: {
    prisma?: typeof prisma
    recalculateLeadershipLinks?: typeof recalculateLeadershipLinks
  } = {}
) {
  const db = deps.prisma ?? prisma

  const department = await db.department.findUnique({
    where: { id: params.departmentId },
    select: {
      id: true,
      deptCode: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
      _count: {
        select: {
          childDepts: true,
          employees: true,
          orgKpis: true,
        },
      },
    },
  })

  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '삭제할 조직을 찾을 수 없습니다.')
  }

  const blockers: string[] = []
  if (department._count.childDepts > 0) {
    blockers.push(`하위 조직 ${department._count.childDepts}개`)
  }
  if (department._count.employees > 0) {
    blockers.push(`구성원 ${department._count.employees}명`)
  }
  if (department._count.orgKpis > 0) {
    blockers.push(`조직 KPI ${department._count.orgKpis}건`)
  }

  if (blockers.length > 0) {
    throw new AppError(
      409,
      'DEPARTMENT_DELETE_BLOCKED',
      `${blockers.join(', ')}이 남아 있어 조직을 삭제할 수 없습니다. 먼저 정리해 주세요.`
    )
  }

  try {
    await db.department.delete({
      where: { id: department.id },
    })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : null
    if (code === 'P2003') {
      throw new AppError(
        409,
        'DEPARTMENT_DELETE_REFERENCE_BLOCKED',
        '연결된 데이터를 정리하지 못해 조직을 삭제할 수 없습니다.'
      )
    }
    throw error
  }

  const hierarchyResult = await (deps.recalculateLeadershipLinks ?? recalculateLeadershipLinks)()

  return {
    deletedDepartment: {
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      leaderEmployeeId: department.leaderEmployeeId,
    },
    blockers: {
      childDepartmentCount: department._count.childDepts,
      memberCount: department._count.employees,
      orgKpiCount: department._count.orgKpis,
    },
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

async function resolveManagerOrThrow(managerEmployeeNumber?: string | null) {
  if (!managerEmployeeNumber) {
    return null
  }

  const manager = await prisma.employee.findUnique({
    where: { empId: managerEmployeeNumber },
    select: {
      id: true,
      empId: true,
      empName: true,
    },
  })

  if (!manager) {
    throw new AppError(404, 'MANAGER_NOT_FOUND', '지정한 관리자를 찾을 수 없습니다.')
  }

  return manager
}

export async function upsertEmployeeRecord(params: {
  employeeId?: string
  employeeNumber: string
  name: string
  gwsEmail: string
  deptId: string
  teamName?: string | null
  jobTitle?: string | null
  role: SystemRole
  employmentStatus: EmployeeManagementStatus
  managerEmployeeNumber?: string | null
  joinDate?: string | null
  resignationDate?: string | null
  sortOrder?: number | null
  notes?: string | null
}) {
  const department = await resolveDepartmentOrThrow(params.deptId)
  const leadershipDepartments = await prisma.department.findMany({
    select: {
      id: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
      orgId: true,
      deptCode: true,
    },
  })
  const departmentScope = resolveOrgKpiScopeFromDepartmentId(department.id, leadershipDepartments)
  const normalizedTeamName = normalizeEmployeeTeamName(params.teamName, department.deptName)
  const canonicalDepartment =
    normalizedTeamName &&
    departmentScope === 'division' &&
    looksLikeLegacySectionName(normalizedTeamName)
      ? await findOrCreateChildDepartment({
          parentDepartment: department,
          childDepartmentName: normalizedTeamName,
          codeBuilder: buildGeneratedSectionDepartmentCode,
        })
      : normalizedTeamName && (departmentScope === 'division' || departmentScope === 'section')
        ? await findOrCreateChildDepartment({
            parentDepartment: department,
            childDepartmentName: normalizedTeamName,
            codeBuilder: buildGeneratedTeamDepartmentCode,
          })
      : department
  const canonicalTeamName =
    canonicalDepartment.id === department.id
      ? normalizeEmployeeTeamName(normalizedTeamName, canonicalDepartment.deptName)
      : null
  const normalizedEmail = assertAllowedGoogleWorkspaceEmail(params.gwsEmail)
  const existingTarget = params.employeeId
    ? await prisma.employee.findUnique({
        where: { id: params.employeeId },
        select: {
          id: true,
          empId: true,
          joinDate: true,
          resignationDate: true,
        },
      })
    : null

  if (params.employeeId && !existingTarget) {
    throw new AppError(404, 'EMPLOYEE_DELETE_TARGET_NOT_FOUND', '삭제할 직원을 찾을 수 없습니다.')
  }

  const manager = await resolveManagerOrThrow(params.managerEmployeeNumber)
  if (manager && manager.empId === params.employeeNumber) {
    throw new AppError(400, 'INVALID_MANAGER', '본인을 관리자로 지정할 수 없습니다.')
  }

  const duplicateEmployeeNumber = await prisma.employee.findFirst({
    where: {
      empId: params.employeeNumber,
      NOT: params.employeeId ? { id: params.employeeId } : undefined,
    },
    select: { id: true },
  })

  if (duplicateEmployeeNumber) {
    throw new AppError(409, 'EMPLOYEE_NUMBER_ALREADY_EXISTS', '이미 등록된 사번입니다.')
  }

  const duplicateEmail = await prisma.employee.findFirst({
    where: {
      gwsEmail: normalizedEmail,
      NOT: params.employeeId ? { id: params.employeeId } : undefined,
    },
    select: {
      empId: true,
      empName: true,
    },
  })

  if (duplicateEmail) {
    throw new AppError(
      409,
      'GOOGLE_EMAIL_ALREADY_ASSIGNED',
      `${normalizedEmail} 이메일은 이미 ${duplicateEmail.empName}(${duplicateEmail.empId})에게 연결되어 있습니다.`
    )
  }

  if (params.role === 'ROLE_SECTION_CHIEF') {
    const scope = resolveOrgKpiScopeFromDepartmentId(canonicalDepartment.id, leadershipDepartments)
    if (scope !== 'section') {
      throw new AppError(400, 'SECTION_CHIEF_SCOPE_INVALID', '실장 권한은 실 조직에만 지정할 수 있습니다.')
    }
  }

  const employee = params.employeeId
    ? await prisma.employee.update({
        where: { id: params.employeeId },
        data: {
          empId: params.employeeNumber,
          empName: params.name.trim(),
          gwsEmail: normalizedEmail,
          deptId: canonicalDepartment.id,
          teamName: canonicalTeamName,
          jobTitle: params.jobTitle?.trim() || null,
          role: params.role,
          position: mapRoleToPosition(params.role),
          status: params.employmentStatus as EmployeeStatus,
          managerId: manager?.id ?? null,
          joinDate: params.joinDate ? new Date(params.joinDate) : existingTarget!.joinDate,
          resignationDate:
            params.employmentStatus === 'RESIGNED'
              ? params.resignationDate
                ? new Date(params.resignationDate)
                : existingTarget!.resignationDate
              : null,
          sortOrder: params.sortOrder ?? null,
          notes: params.notes?.trim() || null,
          ...(params.role === 'ROLE_ADMIN' ? {} : { masterLoginPermissionGranted: false }),
        },
        include: {
          department: {
            select: {
              id: true,
              deptCode: true,
              deptName: true,
            },
          },
        },
      })
    : await prisma.employee.create({
        data: {
          empId: params.employeeNumber,
          empName: params.name.trim(),
          gwsEmail: normalizedEmail,
          deptId: canonicalDepartment.id,
          teamName: canonicalTeamName,
          jobTitle: params.jobTitle?.trim() || null,
          role: params.role,
          position: mapRoleToPosition(params.role),
          status: params.employmentStatus as EmployeeStatus,
          managerId: manager?.id ?? null,
          joinDate: params.joinDate ? new Date(params.joinDate) : new Date(),
          resignationDate:
            params.employmentStatus === 'RESIGNED' && params.resignationDate
              ? new Date(params.resignationDate)
              : null,
          sortOrder: params.sortOrder ?? null,
          notes: params.notes?.trim() || null,
          masterLoginPermissionGranted: false,
        },
        include: {
          department: {
            select: {
              id: true,
              deptCode: true,
              deptName: true,
            },
          },
        },
      })

  await syncSectionLeaderDepartment({
    employeeId: employee.id,
    deptId: canonicalDepartment.id,
    role: params.role,
    departments: leadershipDepartments,
  })

  const hierarchyResult = await recalculateLeadershipLinks()
  const employeeMasterLoginAccess = resolveMasterLoginStateForEmployee(employee)

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      googleEmail: employee.gwsEmail,
      departmentId: employee.department.id,
      departmentCode: employee.department.deptCode,
      departmentName: employee.department.deptName,
      teamName: normalizeEmployeeTeamName(employee.teamName, employee.department.deptName),
      jobTitle: employee.jobTitle,
      role: employee.role,
      employmentStatus: employee.status as EmployeeManagementStatus,
      joinDate: employee.joinDate.toISOString().slice(0, 10),
      resignationDate: employee.resignationDate ? employee.resignationDate.toISOString().slice(0, 10) : null,
      managerId: employee.managerId,
      managerEmployeeNumber: manager?.empId ?? null,
      managerName: manager?.empName ?? null,
      sortOrder: employee.sortOrder,
      notes: employee.notes,
      directReportCount: await prisma.employee.count({ where: { managerId: employee.id } }),
      loginEnabled: employee.status === 'ACTIVE',
      masterLoginPermissionGranted: employee.masterLoginPermissionGranted,
      masterLoginAccessSource: employeeMasterLoginAccess.source,
      masterLoginAvailable: employeeMasterLoginAccess.allowed,
    },
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

export async function applyEmployeeLifecycleAction(params: {
  employeeId: string
  action: 'DEACTIVATE' | 'RESIGN' | 'REACTIVATE'
  resignationDate?: string | null
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: params.employeeId },
    include: {
      department: {
        select: {
          id: true,
          deptCode: true,
          deptName: true,
        },
      },
    },
  })

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_DELETE_TARGET_NOT_FOUND', '삭제할 직원을 찾을 수 없습니다.')
  }

  const nextStatus: EmployeeManagementStatus =
    params.action === 'REACTIVATE'
      ? 'ACTIVE'
      : params.action === 'DEACTIVATE'
        ? 'INACTIVE'
        : 'RESIGNED'

  const updatedEmployee = await prisma.employee.update({
    where: { id: employee.id },
    data: {
      status: nextStatus as EmployeeStatus,
      resignationDate:
        nextStatus === 'RESIGNED'
          ? params.resignationDate
            ? new Date(params.resignationDate)
            : new Date()
          : null,
    },
    include: {
      department: {
        select: {
          id: true,
          deptCode: true,
          deptName: true,
        },
      },
    },
  })

  const hierarchyResult = await recalculateLeadershipLinks()
  const [managerReference, directReportCount] = await Promise.all([
    updatedEmployee.managerId
      ? prisma.employee.findUnique({
          where: { id: updatedEmployee.managerId },
          select: {
            empId: true,
            empName: true,
          },
        })
      : null,
    prisma.employee.count({ where: { managerId: updatedEmployee.id } }),
  ])
  const updatedEmployeeMasterLoginAccess = resolveMasterLoginStateForEmployee(updatedEmployee)

  return {
    employee: {
      id: updatedEmployee.id,
      employeeNumber: updatedEmployee.empId,
      name: updatedEmployee.empName,
      googleEmail: updatedEmployee.gwsEmail,
      departmentId: updatedEmployee.department.id,
      departmentCode: updatedEmployee.department.deptCode,
      departmentName: updatedEmployee.department.deptName,
      teamName: normalizeEmployeeTeamName(updatedEmployee.teamName, updatedEmployee.department.deptName),
      jobTitle: updatedEmployee.jobTitle,
      role: updatedEmployee.role,
      employmentStatus: updatedEmployee.status as EmployeeManagementStatus,
      joinDate: updatedEmployee.joinDate.toISOString().slice(0, 10),
      resignationDate: updatedEmployee.resignationDate
        ? updatedEmployee.resignationDate.toISOString().slice(0, 10)
        : null,
      managerId: updatedEmployee.managerId,
      managerEmployeeNumber: managerReference?.empId ?? null,
      managerName: managerReference?.empName ?? null,
      sortOrder: updatedEmployee.sortOrder,
      notes: updatedEmployee.notes,
      directReportCount,
      loginEnabled: updatedEmployee.status === 'ACTIVE',
      masterLoginPermissionGranted: updatedEmployee.masterLoginPermissionGranted,
      masterLoginAccessSource: updatedEmployeeMasterLoginAccess.source,
      masterLoginAvailable: updatedEmployeeMasterLoginAccess.allowed,
    },
    impactedDirectReports: directReportCount,
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

export async function safeDeleteEmployeeRecord(
  employeeId: string,
  deps: {
    prisma?: typeof prisma
    recalculateLeadershipLinks?: typeof recalculateLeadershipLinks
  } = {}
) {
  const db = deps.prisma ?? prisma
  const runLeadershipRecalculation = deps.recalculateLeadershipLinks ?? recalculateLeadershipLinks
  const transactionTimeoutMs = 30_000
  const transactionMaxWaitMs = 10_000

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      empId: true,
      empName: true,
      gwsEmail: true,
      deptId: true,
      role: true,
      status: true,
    },
  })

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_DELETE_TARGET_NOT_FOUND', '삭제할 직원을 찾을 수 없습니다.')
  }

  const withDeleteStep = async <T>(
    stepName: string,
    fn: () => Promise<T>,
    describe?: (result: T) => Record<string, unknown>
  ) => {
    logEmployeeDelete(`EMPLOYEE_DELETE_STEP_${stepName}_START`, {
      employeeId,
      stepName,
    })

    try {
      const result = await fn()
      logEmployeeDelete(`EMPLOYEE_DELETE_STEP_${stepName}_DONE`, {
        employeeId,
        stepName,
        ...(describe ? describe(result) : {}),
      })
      return result
    } catch (error) {
      const errorInfo = extractEmployeeDeleteErrorInfo(error)
      logEmployeeDelete(`EMPLOYEE_DELETE_STEP_${stepName}_FAILED`, {
        employeeId,
        stepName,
        prismaCode: errorInfo.code,
        errorName: errorInfo.name,
        shortMessage: errorInfo.message,
      })
      logEmployeeDelete('EMPLOYEE_DELETE_CAUGHT_ERROR', {
        employeeId,
        stepName,
        errorCode: errorInfo.code,
        errorName: errorInfo.name,
        errorMessage: errorInfo.message,
      })
      throw attachEmployeeDeleteStepContext(
        error instanceof Error ? error : new Error(errorInfo.message),
        stepName
      )
    }
  }

  try {
    logEmployeeDelete('EMPLOYEE_DELETE_TX_BEGIN', {
      employeeId,
      transactionTimeoutMs,
      transactionMaxWaitMs,
    })
    const result = await db.$transaction(async (tx) => {
      const ownedPersonalKpis = await withDeleteStep(
        'loadOwnedPersonalKpis',
        () =>
          tx.personalKpi.findMany({
            where: { employeeId },
            select: { id: true },
          }),
        (items) => ({ itemCount: items.length })
      )
      const ownedPersonalKpiIds = ownedPersonalKpis.map((item) => item.id)

      const relatedEvaluations = await withDeleteStep(
        'loadRelatedEvaluations',
        () =>
          tx.evaluation.findMany({
            where: {
              OR: [{ targetId: employeeId }, { evaluatorId: employeeId }],
            },
            select: { id: true },
          }),
        (items) => ({ itemCount: items.length })
      )
      const relatedEvaluationIds = relatedEvaluations.map((item) => item.id)

      const relatedFeedbacks = await withDeleteStep(
        'loadRelatedFeedbacks',
        () =>
          tx.multiFeedback.findMany({
            where: {
              OR: [{ giverId: employeeId }, { receiverId: employeeId }],
            },
            select: { id: true },
          }),
        (items) => ({ itemCount: items.length })
      )
      const relatedFeedbackIds = relatedFeedbacks.map((item) => item.id)

      const cleanupSummary = {
        clearedManagerReferenceCount: 0,
        clearedLeadershipReferenceCount: 0,
        clearedDepartmentLeaderCount: 0,
        deletedPersonalKpiCount: 0,
        detachedClonedPersonalKpiCount: 0,
        deletedMonthlyRecordCount: 0,
        deletedEvaluationCount: 0,
        deletedEvaluationItemCount: 0,
        deletedAppealCount: 0,
        deletedCheckInCount: 0,
        deletedFeedbackCount: 0,
        deletedFeedbackResponseCount: 0,
        deletedFeedbackNominationCount: 0,
        deletedFeedbackReportCacheCount: 0,
        deletedFeedbackAdminGroupMembershipCount: 0,
        deletedFeedbackRoundCollaborationCount: 0,
        deletedOnboardingReviewGenerationCount: 0,
        deletedDevelopmentPlanCount: 0,
        deletedWordCloudAssignmentCount: 0,
        deletedWordCloudResponseCount: 0,
        deletedCompensationSnapshotCount: 0,
        deletedNotificationCount: 0,
        deletedNotificationPreferenceCount: 0,
        deletedNotificationJobCount: 0,
        deletedNotificationDeadLetterCount: 0,
        deletedAuthAccountCount: 0,
        deletedAuthSessionCount: 0,
        deletedAiRequestLogCount: 0,
        clearedAiRequestApprovalActorCount: 0,
        deletedAiCompetencyAssignmentCount: 0,
        deletedAiCompetencyAttemptCount: 0,
        deletedAiCompetencyGeneratedExamSetCount: 0,
        deletedAiCompetencySecondRoundSubmissionCount: 0,
        deletedAiCompetencyExternalCertClaimCount: 0,
        deletedAiCompetencyResultCount: 0,
        deletedAiCompetencySubmissionReviewCount: 0,
        clearedAiCompetencyAnswerReviewCount: 0,
        clearedAiCompetencyDecisionActorCount: 0,
        clearedAiCompetencyCertApproverCount: 0,
        clearedAiCompetencyResultSyncActorCount: 0,
        clearedAiCompetencyGateReviewerCount: 0,
        deletedAiCompetencyGateAssignmentCount: 0,
        deletedImpersonationSessionCount: 0,
      }

      cleanupSummary.clearedManagerReferenceCount = (
        await withDeleteStep(
          'clearManagerReference',
          () =>
            tx.employee.updateMany({
              where: { managerId: employeeId },
              data: { managerId: null },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      const [teamLeaderReferences, sectionChiefReferences, divisionHeadReferences] = await Promise.all([
        withDeleteStep(
          'clearTeamLeaderReference',
          () =>
            tx.employee.updateMany({
              where: { teamLeaderId: employeeId },
              data: { teamLeaderId: null },
            }),
          (result) => ({ affectedCount: result.count })
        ),
        withDeleteStep(
          'clearSectionChiefReference',
          () =>
            tx.employee.updateMany({
              where: { sectionChiefId: employeeId },
              data: { sectionChiefId: null },
            }),
          (result) => ({ affectedCount: result.count })
        ),
        withDeleteStep(
          'clearDivisionHeadReference',
          () =>
            tx.employee.updateMany({
              where: { divisionHeadId: employeeId },
              data: { divisionHeadId: null },
            }),
          (result) => ({ affectedCount: result.count })
        ),
      ])

      cleanupSummary.clearedLeadershipReferenceCount =
        teamLeaderReferences.count + sectionChiefReferences.count + divisionHeadReferences.count

      cleanupSummary.clearedDepartmentLeaderCount = (
        await withDeleteStep(
          'clearDepartmentLeaderReference',
          () =>
            tx.department.updateMany({
              where: { leaderEmployeeId: employeeId },
              data: { leaderEmployeeId: null },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedFeedbackAdminGroupMembershipCount = (
        await withDeleteStep(
          'deleteFeedbackAdminGroupMemberships',
          () => tx.feedbackAdminGroupMember.deleteMany({ where: { employeeId } }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedFeedbackRoundCollaborationCount = (
        await withDeleteStep(
          'deleteFeedbackRoundCollaborations',
          () => tx.feedbackRoundCollaborator.deleteMany({ where: { employeeId } }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedOnboardingReviewGenerationCount = (
        await withDeleteStep(
          'deleteOnboardingReviewGenerations',
          () => tx.onboardingReviewGeneration.deleteMany({ where: { employeeId } }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.clearedAiCompetencyAnswerReviewCount = (
        await withDeleteStep(
          'clearAiCompetencyAnswerReviewer',
          () =>
            tx.aiCompetencyAnswer.updateMany({
              where: { reviewerId: employeeId },
              data: {
                reviewerId: null,
                reviewerNote: null,
                scoredAt: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencySubmissionReviewCount = (
        await withDeleteStep(
          'deleteAiCompetencySubmissionReviews',
          () => tx.aiCompetencySubmissionReview.deleteMany({ where: { reviewerId: employeeId } }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.clearedAiCompetencyDecisionActorCount = (
        await withDeleteStep(
          'clearAiCompetencyDecisionActor',
          () =>
            tx.aiCompetencySecondRoundSubmission.updateMany({
              where: { finalDecisionById: employeeId },
              data: {
                finalDecisionById: null,
                finalDecisionNote: null,
                decidedAt: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.clearedAiCompetencyCertApproverCount = (
        await withDeleteStep(
          'clearAiCompetencyCertApprover',
          () =>
            tx.aiCompetencyExternalCertClaim.updateMany({
              where: { decidedById: employeeId },
              data: {
                decidedById: null,
                decidedAt: null,
                rejectionReason: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.clearedAiCompetencyResultSyncActorCount = (
        await withDeleteStep(
          'clearAiCompetencyResultSyncActor',
          () =>
            tx.aiCompetencyResult.updateMany({
              where: { syncActorId: employeeId },
              data: {
                syncActorId: null,
                syncedAt: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedWordCloudResponseCount = (
        await withDeleteStep(
          'deleteWordCloudResponses',
          () =>
            tx.wordCloud360Response.deleteMany({
              where: {
                OR: [{ evaluatorId: employeeId }, { evaluateeId: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedWordCloudAssignmentCount = (
        await withDeleteStep(
          'deleteWordCloudAssignments',
          () =>
            tx.wordCloud360Assignment.deleteMany({
              where: {
                OR: [{ evaluatorId: employeeId }, { evaluateeId: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedFeedbackNominationCount = (
        await withDeleteStep(
          'deleteFeedbackNominations',
          () =>
            tx.feedbackNomination.deleteMany({
              where: {
                OR: [
                  { targetId: employeeId },
                  { reviewerId: employeeId },
                  { submittedById: employeeId },
                  { approvedById: employeeId },
                ],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedFeedbackReportCacheCount = (
        await withDeleteStep(
          'deleteFeedbackReportCaches',
          () =>
            tx.feedbackReportCache.deleteMany({
              where: {
                OR: [{ targetId: employeeId }, { generatedById: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedDevelopmentPlanCount = (
        await withDeleteStep(
          'deleteDevelopmentPlans',
          () =>
            tx.developmentPlan.deleteMany({
              where: {
                OR: [{ employeeId }, { createdById: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedCheckInCount = (
        await withDeleteStep(
          'deleteCheckIns',
          () =>
            tx.checkIn.deleteMany({
              where: {
                OR: [{ ownerId: employeeId }, { managerId: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      if (relatedFeedbackIds.length > 0) {
        cleanupSummary.deletedFeedbackResponseCount = (
          await withDeleteStep(
            'deleteFeedbackResponses',
            () =>
              tx.feedbackResponse.deleteMany({
                where: {
                  feedbackId: {
                    in: relatedFeedbackIds,
                  },
                },
              }),
            (result) => ({ affectedCount: result.count })
          )
        ).count
      }

      cleanupSummary.deletedFeedbackCount = (
        await withDeleteStep(
          'deleteFeedbackRecords',
          () =>
            tx.multiFeedback.deleteMany({
              where: {
                OR: [{ giverId: employeeId }, { receiverId: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedMonthlyRecordCount = (
        await withDeleteStep(
          'deleteMonthlyRecords',
          () =>
            tx.monthlyRecord.deleteMany({
              where: {
                OR: [{ employeeId }, { personalKpiId: { in: ownedPersonalKpiIds } }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedEvaluationItemCount = (
        await withDeleteStep(
          'deleteEvaluationItems',
          () =>
            tx.evaluationItem.deleteMany({
              where: {
                OR: [
                  { evaluationId: { in: relatedEvaluationIds } },
                  { personalKpiId: { in: ownedPersonalKpiIds } },
                ],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAppealCount = (
        await withDeleteStep(
          'deleteAppeals',
          () =>
            tx.appeal.deleteMany({
              where: {
                OR: [{ appealerId: employeeId }, { evaluationId: { in: relatedEvaluationIds } }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedEvaluationCount = (
        await withDeleteStep(
          'deleteEvaluations',
          () =>
            tx.evaluation.deleteMany({
              where: {
                OR: [{ targetId: employeeId }, { evaluatorId: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.detachedClonedPersonalKpiCount = (
        await withDeleteStep(
          'detachClonedPersonalKpis',
          () =>
            tx.personalKpi.updateMany({
              where: {
                copiedFromPersonalKpiId: {
                  in: ownedPersonalKpiIds,
                },
              },
              data: {
                copiedFromPersonalKpiId: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedPersonalKpiCount = (
        await withDeleteStep(
          'deletePersonalKpis',
          () => tx.personalKpi.deleteMany({ where: { employeeId } }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedCompensationSnapshotCount = (
        await withDeleteStep(
          'deleteCompensationSnapshots',
          () => tx.compensationScenarioEmployee.deleteMany({ where: { employeeId } }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedNotificationPreferenceCount = (
        await withDeleteStep(
          'deleteNotificationPreferences',
          () =>
            tx.notificationPreference.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedNotificationCount = (
        await withDeleteStep(
          'deleteNotifications',
          () =>
            tx.notification.deleteMany({
              where: { recipientId: employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedNotificationDeadLetterCount = (
        await withDeleteStep(
          'deleteNotificationDeadLetters',
          () =>
            tx.notificationDeadLetter.deleteMany({
              where: { recipientId: employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedNotificationJobCount = (
        await withDeleteStep(
          'deleteNotificationJobs',
          () =>
            tx.notificationJob.deleteMany({
              where: { recipientId: employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAuthSessionCount = (
        await withDeleteStep(
          'deleteAuthSessions',
          () =>
            tx.session.deleteMany({
              where: { userId: employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAuthAccountCount = (
        await withDeleteStep(
          'deleteAuthAccounts',
          () =>
            tx.account.deleteMany({
              where: { userId: employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiRequestLogCount = (
        await withDeleteStep(
          'deleteAiRequestLogs',
          () =>
            tx.aiRequestLog.deleteMany({
              where: { requesterId: employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.clearedAiRequestApprovalActorCount = (
        await withDeleteStep(
          'clearAiRequestApprovalActor',
          () =>
            tx.aiRequestLog.updateMany({
              where: { approvedById: employeeId },
              data: {
                approvedById: null,
                approvedAt: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.clearedAiCompetencyGateReviewerCount = (
        await withDeleteStep(
          'clearAiCompetencyGateReviewer',
          () =>
            tx.aiCompetencyGateAssignment.updateMany({
              where: { reviewerId: employeeId },
              data: {
                reviewerId: null,
                reviewerNameSnapshot: null,
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencyGateAssignmentCount = (
        await withDeleteStep(
          'deleteAiCompetencyGateAssignments',
          () =>
            tx.aiCompetencyGateAssignment.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencyGeneratedExamSetCount = (
        await withDeleteStep(
          'deleteAiCompetencyGeneratedExamSets',
          () =>
            tx.aiCompetencyGeneratedExamSet.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencyResultCount = (
        await withDeleteStep(
          'deleteAiCompetencyResults',
          () =>
            tx.aiCompetencyResult.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencyExternalCertClaimCount = (
        await withDeleteStep(
          'deleteAiCompetencyExternalCertClaims',
          () =>
            tx.aiCompetencyExternalCertClaim.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencySecondRoundSubmissionCount = (
        await withDeleteStep(
          'deleteAiCompetencySecondRoundSubmissions',
          () =>
            tx.aiCompetencySecondRoundSubmission.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencyAttemptCount = (
        await withDeleteStep(
          'deleteAiCompetencyAttempts',
          () =>
            tx.aiCompetencyAttempt.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedAiCompetencyAssignmentCount = (
        await withDeleteStep(
          'deleteAiCompetencyAssignments',
          () =>
            tx.aiCompetencyAssignment.deleteMany({
              where: { employeeId },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      cleanupSummary.deletedImpersonationSessionCount = (
        await withDeleteStep(
          'deleteImpersonationSessions',
          () =>
            tx.impersonationSession.deleteMany({
              where: {
                OR: [{ impersonatorAdminId: employeeId }, { impersonatedUserId: employeeId }],
              },
            }),
          (result) => ({ affectedCount: result.count })
        )
      ).count

      const deletedEmployee = await withDeleteStep(
        'employeeDelete',
        () =>
          tx.employee.delete({
            where: { id: employeeId },
            select: {
              id: true,
              empId: true,
              empName: true,
            },
          }),
        (result) => ({ deletedEmployeeId: result.id })
      )

      logEmployeeDelete('EMPLOYEE_DELETE_EMPLOYEE_DELETE_DONE', {
        employeeId,
        deletedEmployeeId: deletedEmployee.id,
      })

      return {
        deletedEmployee,
        cleanupSummary,
      }
    }, {
      timeout: transactionTimeoutMs,
      maxWait: transactionMaxWaitMs,
    })
    logEmployeeDelete('EMPLOYEE_DELETE_TX_SUCCESS', {
      employeeId,
      deletedEmployeeId: result.deletedEmployee.id,
    })

    let hierarchyUpdatedCount = 0
    logEmployeeDelete('EMPLOYEE_DELETE_POST_STEP_START', {
      employeeId,
      stepName: 'recalculateLeadershipLinks',
    })
    try {
      const hierarchyResult = await runLeadershipRecalculation()
      hierarchyUpdatedCount = hierarchyResult.updatedCount
      logEmployeeDelete('EMPLOYEE_DELETE_POST_STEP_DONE', {
        employeeId,
        stepName: 'recalculateLeadershipLinks',
        updatedCount: hierarchyUpdatedCount,
      })
    } catch (error) {
      const errorInfo = extractEmployeeDeleteErrorInfo(error)
      console.warn('[admin-google-account] EMPLOYEE_DELETE_LEADERSHIP_REFRESH_FAILED', {
        employeeId,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
      })
    }

    return {
      deletedEmployee: {
        id: result.deletedEmployee.id,
        employeeNumber: result.deletedEmployee.empId,
        name: result.deletedEmployee.empName,
      },
      cleanupSummary: result.cleanupSummary,
      hierarchyUpdatedCount,
    }
  } catch (error) {
    const errorInfo = extractEmployeeDeleteErrorInfo(error)
    const failingStep = readEmployeeDeleteStep(error) ?? 'unknown'

    logEmployeeDelete('EMPLOYEE_DELETE_TX_FAILED', {
      employeeId,
      stepName: failingStep,
      prismaCode: errorInfo.code,
      errorName: errorInfo.name,
      shortMessage: errorInfo.message,
    })
    logEmployeeDelete('EMPLOYEE_DELETE_CAUGHT_ERROR', {
      employeeId,
      stepName: failingStep,
      errorCode: errorInfo.code,
      errorName: errorInfo.name,
      errorMessage: errorInfo.message,
    })

    if (error instanceof AppError) {
      throw error
    }

    if (isPrismaKnownRequestError(error) && (error as { code?: string }).code === 'P2003') {
      throw new AppError(
        409,
        'EMPLOYEE_DELETE_CLEANUP_FAILED',
        '?곌껐???곗씠?곕? ?뺣━?섎뒗 以?臾몄젣媛 諛쒖깮??吏곸썝????젣?섏? 紐삵뻽?듬땲??',
        {
          step: failingStep,
          prismaCode: error.code,
        }
      )
    }

    if (isPrismaKnownRequestError(error) && (error as { code?: string }).code === 'P2028') {
      throw new AppError(
        503,
        'EMPLOYEE_DELETE_TX_TIMEOUT',
        '?怨뚭퍙???怨쀬뵠?怨? ?類ｂ봺??롫뮉 餓???볦퍢???λ뜃???뤿연 筌욊낯?????ｇ몴?筌띾뜄龜?귐뗫릭筌?筌륁궢六??щ빍?? ?醫롫뻻 ????쇰뻻 ??뺣즲??雅뚯눘苑??',
        {
          step: failingStep,
          prismaCode: error.code,
        }
      )
    }

    throw new AppError(
      500,
      'EMPLOYEE_DELETE_TX_FAILED',
      '吏곸썝 ??젣 以??덉긽?섏? 紐삵븳 臾몄젣媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??',
      {
        step: failingStep,
        prismaCode: errorInfo.code,
      }
    )

    if (error instanceof AppError) {
      throw error
    }

    if (isPrismaKnownRequestError(error) && (error as { code?: string }).code === 'P2003') {
      throw new AppError(
        409,
        'EMPLOYEE_DELETE_CLEANUP_FAILED',
        '연결된 데이터를 정리하는 중 문제가 발생해 직원을 삭제하지 못했습니다.'
      )
    }

    if (isPrismaKnownRequestError(error) && (error as { code?: string }).code === 'P2028') {
      throw new AppError(
        503,
        'EMPLOYEE_DELETE_TX_TIMEOUT',
        '?곌껐???곗씠?곕? ?뺣━?섎뒗 以??쒓컙??珥덇낵?섏뿬 吏곸썝 ??젣瑜?留덈Т由ы븯吏?紐삵뻽?듬땲?? ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??'
      )
    }

    throw error instanceof AppError
      ? error
      : new AppError(
          500,
          'EMPLOYEE_DELETE_TX_FAILED',
          '직원 삭제 중 예상하지 못한 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'
        )
  }
}

export async function applyEmployeeUpload(params: {
  fileName: string
  rows: EmployeeUploadNormalizedRow[]
}) {
  const organization = await prisma.organization.findFirst({
    select: {
      id: true,
    },
  })

  if (!organization) {
    throw new AppError(404, 'ORG_NOT_FOUND', '조직 정보가 없어 직원을 등록할 수 없습니다.')
  }

  const existingDepartments = await prisma.department.findMany({
    select: {
      id: true,
      deptCode: true,
      deptName: true,
      parentDeptId: true,
    },
  })
  const departmentIdByCode = new Map(
    existingDepartments.map((department) => [department.deptCode.toUpperCase(), department.id] as const)
  )
  const departmentIdByHierarchy = new Map(
    existingDepartments.map((department) => [
      `${department.parentDeptId ?? 'ROOT'}::${department.deptName.trim().toUpperCase()}`,
      department.id,
    ] as const)
  )
  const resolveDepartmentIdByPathParts = (path: string[]) => {
    let parentDeptId: string | null = null

    for (const part of path) {
      const normalizedName = part.trim().toUpperCase()
      if (!normalizedName) return null

      const departmentId = departmentIdByHierarchy.get(`${parentDeptId ?? 'ROOT'}::${normalizedName}`)
      if (!departmentId) return null
      parentDeptId = departmentId
    }

    return parentDeptId
  }
  const resolveDepartmentIdByPath = (departmentName: string, parentDepartmentName: string | null) => {
    if (parentDepartmentName) {
      return resolveDepartmentIdByPathParts([parentDepartmentName, departmentName])
    }

    return resolveDepartmentIdByPathParts([departmentName])
  }
  const resolveUploadRowTeamDepartmentId = (row: EmployeeUploadNormalizedRow) => {
    return resolveDepartmentIdByPathParts(row.section ? [row.division, row.section, row.team ?? ''] : [row.division, row.team ?? ''])
  }

  let createdDepartmentCount = 0
  const departmentRows = buildEmployeeUploadDepartmentPlan(params.rows)
  const pendingDepartmentRows = [...departmentRows]

  while (pendingDepartmentRows.length > 0) {
    const unresolvedBefore = pendingDepartmentRows.length

    for (let index = pendingDepartmentRows.length - 1; index >= 0; index -= 1) {
      const department = pendingDepartmentRows[index]
      const parentDeptId = department.parentPath.length
        ? resolveDepartmentIdByPathParts(department.parentPath)
        : null

      if (department.parentPath.length && !parentDeptId) {
        continue
      }

      const explicitDepartmentCode = department.parentPath.length === 0 ? department.departmentCode : null
      const existingDepartmentId =
        departmentIdByHierarchy.get(
          `${parentDeptId ?? 'ROOT'}::${department.departmentName.trim().toUpperCase()}`
        ) ??
        (explicitDepartmentCode
          ? departmentIdByCode.get(explicitDepartmentCode.toUpperCase())
          : null) ??
        null

      if (existingDepartmentId) {
        await prisma.department.update({
          where: { id: existingDepartmentId },
          data: {
            deptName: department.departmentName,
            parentDeptId,
          },
        })
        departmentIdByHierarchy.set(
          `${parentDeptId ?? 'ROOT'}::${department.departmentName.trim().toUpperCase()}`,
          existingDepartmentId
        )
      } else {
        const generatedCode =
          department.scope === 'division'
            ? buildGeneratedDivisionDepartmentCode(new Set(departmentIdByCode.keys()))
            : department.scope === 'section'
              ? buildGeneratedSectionDepartmentCode(
                  existingDepartments.find((item) => item.id === parentDeptId)?.deptCode ?? 'DIV',
                  new Set(departmentIdByCode.keys()),
                )
              : buildGeneratedTeamDepartmentCode(
                  existingDepartments.find((item) => item.id === parentDeptId)?.deptCode ?? 'DIV',
                  new Set(departmentIdByCode.keys()),
                )
        const createdDepartment = await prisma.department.create({
          data: {
            deptCode: explicitDepartmentCode ?? generatedCode,
            deptName: department.departmentName,
            parentDeptId,
            orgId: organization.id,
          },
          select: {
            id: true,
            deptCode: true,
          },
        })
        departmentIdByCode.set((explicitDepartmentCode ?? createdDepartment.deptCode).toUpperCase(), createdDepartment.id)
        departmentIdByHierarchy.set(
          `${parentDeptId ?? 'ROOT'}::${department.departmentName.trim().toUpperCase()}`,
          createdDepartment.id
        )
        existingDepartments.push({
          id: createdDepartment.id,
          deptCode: createdDepartment.deptCode,
          deptName: department.departmentName,
          parentDeptId,
        })
        createdDepartmentCount += 1
      }

      pendingDepartmentRows.splice(index, 1)
    }

    if (pendingDepartmentRows.length === unresolvedBefore) {
      throw new AppError(
        400,
        'DEPARTMENT_PARENT_RESOLVE_FAILED',
        '상위 조직명을 찾을 수 없는 부서가 있어 업로드 계층을 구성할 수 없습니다.',
      )
    }
  }

  const departmentsForScopeValidation = await prisma.department.findMany({
    select: {
      id: true,
      deptName: true,
      parentDeptId: true,
      leaderEmployeeId: true,
      orgId: true,
      deptCode: true,
    },
  })
  const departmentScopeMap = buildOrgKpiDepartmentScopeMap(departmentsForScopeValidation)

  for (const row of params.rows) {
    if (row.role !== 'ROLE_SECTION_CHIEF') {
      continue
    }

    const departmentId =
      (row.departmentCode ? departmentIdByCode.get(row.departmentCode.toUpperCase()) : null) ??
      resolveDepartmentIdByPath(row.department, row.parentDepartment)
    if (!departmentId) {
      continue
    }

    if ((departmentScopeMap.get(departmentId) ?? 'team') !== 'section') {
      throw new AppError(400, 'SECTION_CHIEF_SCOPE_INVALID', '실장 권한은 실 조직에만 지정할 수 있습니다.')
    }
  }

  const existingEmployees = await prisma.employee.findMany({
    where: {
      empId: {
        in: params.rows.map((row) => row.employeeNumber),
      },
    },
    select: {
      id: true,
      empId: true,
      joinDate: true,
    },
  })
  const existingByEmployeeNumber = new Map(
    existingEmployees.map((employee) => [employee.empId, employee] as const)
  )

  let createdCount = 0
  let updatedCount = 0

  for (const row of params.rows) {
    const departmentId =
      resolveUploadRowTeamDepartmentId(row) ??
      (row.departmentCode ? departmentIdByCode.get(row.departmentCode.toUpperCase()) : null) ??
      resolveDepartmentIdByPath(row.department, row.parentDepartment)
    if (!departmentId) {
      throw new AppError(500, 'DEPARTMENT_RESOLVE_FAILED', '부서 정보를 반영하는 중 오류가 발생했습니다.')
    }

    const baseDepartment = departmentsForScopeValidation.find((department) => department.id === departmentId)
    const normalizedTeamName = normalizeEmployeeTeamName(row.team, baseDepartment?.deptName ?? row.department)
    const baseDepartmentScope = departmentScopeMap.get(departmentId) ?? 'team'
    const canonicalDepartment =
      baseDepartment &&
      normalizedTeamName &&
      baseDepartmentScope === 'division' &&
      looksLikeLegacySectionName(normalizedTeamName)
        ? await findOrCreateChildDepartment({
            parentDepartment: baseDepartment,
            childDepartmentName: normalizedTeamName,
            codeBuilder: buildGeneratedSectionDepartmentCode,
          })
        : baseDepartment &&
            normalizedTeamName &&
            (baseDepartmentScope === 'division' || baseDepartmentScope === 'section')
          ? await findOrCreateChildDepartment({
              parentDepartment: baseDepartment,
              childDepartmentName: normalizedTeamName,
              codeBuilder: buildGeneratedTeamDepartmentCode,
            })
        : baseDepartment
    const targetDepartmentId = canonicalDepartment?.id ?? departmentId
    const canonicalTeamName =
      targetDepartmentId === departmentId
        ? normalizeEmployeeTeamName(normalizedTeamName, canonicalDepartment?.deptName ?? baseDepartment?.deptName)
        : null

    const existing = existingByEmployeeNumber.get(row.employeeNumber)
    if (existing) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: {
          empName: row.name,
          gwsEmail: row.googleEmail,
          deptId: targetDepartmentId,
          teamName: canonicalTeamName,
          jobTitle: row.title,
          role: row.role,
          position: mapRoleToPosition(row.role),
          status: row.employmentStatus as EmployeeStatus,
          joinDate: row.joinDate ? new Date(row.joinDate) : existing.joinDate,
          resignationDate:
            row.employmentStatus === 'RESIGNED' && row.resignationDate
              ? new Date(row.resignationDate)
              : null,
          sortOrder: row.sortOrder,
          notes: row.notes,
          ...(row.role === 'ROLE_ADMIN' ? {} : { masterLoginPermissionGranted: false }),
        },
      })
      updatedCount += 1
      continue
    }

    await prisma.employee.create({
      data: {
        empId: row.employeeNumber,
        empName: row.name,
        gwsEmail: row.googleEmail,
        deptId: targetDepartmentId,
        teamName: canonicalTeamName,
        jobTitle: row.title,
        role: row.role,
        position: mapRoleToPosition(row.role),
        status: row.employmentStatus as EmployeeStatus,
        joinDate: row.joinDate ? new Date(row.joinDate) : new Date(),
        resignationDate:
          row.employmentStatus === 'RESIGNED' && row.resignationDate
            ? new Date(row.resignationDate)
            : null,
        sortOrder: row.sortOrder,
        notes: row.notes,
        masterLoginPermissionGranted: false,
      },
    })
    createdCount += 1
  }

  const referencedEmployeeNumbers = Array.from(
    new Set(
      params.rows.flatMap((row) =>
        row.managerEmployeeNumber ? [row.employeeNumber, row.managerEmployeeNumber] : [row.employeeNumber]
      )
    )
  )
  const employeesForManagerSync = await prisma.employee.findMany({
    where: {
      empId: {
        in: referencedEmployeeNumbers,
      },
    },
    select: {
      id: true,
      empId: true,
    },
  })
  const employeeIdByEmployeeNumber = new Map(
    employeesForManagerSync.map((employee) => [employee.empId, employee.id] as const)
  )

  for (const row of params.rows) {
    const employeeId = employeeIdByEmployeeNumber.get(row.employeeNumber)
    if (!employeeId) {
      continue
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        managerId: row.managerEmployeeNumber
          ? employeeIdByEmployeeNumber.get(row.managerEmployeeNumber) ?? null
          : null,
      },
    })
  }

  const uploadedSectionChiefIds = params.rows
    .filter((row) => row.role === 'ROLE_SECTION_CHIEF')
    .map((row) => employeeIdByEmployeeNumber.get(row.employeeNumber))
    .filter((employeeId): employeeId is string => Boolean(employeeId))

  if (uploadedSectionChiefIds.length > 0) {
    await prisma.department.updateMany({
      where: {
        leaderEmployeeId: { in: uploadedSectionChiefIds },
        id: {
          in: departmentsForScopeValidation
            .filter((department) => (departmentScopeMap.get(department.id) ?? 'team') === 'section')
            .map((department) => department.id),
        },
      },
      data: { leaderEmployeeId: null },
    })

    for (const row of params.rows.filter((item) => item.role === 'ROLE_SECTION_CHIEF')) {
      const employeeId = employeeIdByEmployeeNumber.get(row.employeeNumber)
      const departmentId =
        (row.departmentCode ? departmentIdByCode.get(row.departmentCode.toUpperCase()) : null) ??
        resolveDepartmentIdByPath(row.department, row.parentDepartment)
      if (!employeeId || !departmentId) {
        continue
      }

      await prisma.department.update({
        where: { id: departmentId },
        data: { leaderEmployeeId: employeeId },
      })
    }
  }

  const hierarchyResult = await recalculateLeadershipLinks()

  return {
    fileName: params.fileName,
    totalRows: params.rows.length,
    createdDepartmentCount,
    createdCount,
    updatedCount,
    failedCount: 0,
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

export function buildEmployeeOrgChart(members: EmployeeOrgChartMember[]) {
  const sortedMembers = [...members].sort(compareMembers)
  const memberById = new Map(sortedMembers.map((member) => [member.id, member] as const))
  const cycleIds = new Set<string>()

  for (const member of sortedMembers) {
    const seen = new Map<string, number>()
    const path: string[] = []
    let current: string | null = member.id

    while (current && memberById.has(current)) {
      const seenIndex = seen.get(current)
      if (seenIndex !== undefined) {
        for (const cycleId of path.slice(seenIndex)) {
          cycleIds.add(cycleId)
        }
        break
      }

      seen.set(current, path.length)
      path.push(current)
      current = memberById.get(current)?.managerId ?? null
    }
  }

  const nodeById = new Map<string, EmployeeOrgChartNode>(
    sortedMembers.map((member) => [
      member.id,
      {
        employee: {
          id: member.id,
          employeeNumber: member.employeeNumber,
          name: member.name,
          googleEmail: member.googleEmail,
          departmentName: member.departmentName,
          departmentCode: member.departmentCode,
          teamName: member.teamName,
          jobTitle: member.jobTitle,
          role: member.role,
          employmentStatus: member.employmentStatus,
          joinDate: member.joinDate,
          resignationDate: member.resignationDate,
          managerEmployeeNumber: member.managerEmployeeNumber,
          managerName: member.managerName,
          directReportCount: member.directReportCount,
          sortOrder: member.sortOrder,
        },
        reports: [],
      },
    ])
  )

  const roots: EmployeeOrgChartNode[] = []
  const orphanedEmployees: EmployeeOrgChartNode['employee'][] = []

  for (const member of sortedMembers) {
    const node = nodeById.get(member.id)!

    if (cycleIds.has(member.id)) {
      orphanedEmployees.push(node.employee)
      roots.push(node)
      continue
    }

    if (member.managerId && memberById.has(member.managerId) && !cycleIds.has(member.managerId)) {
      nodeById.get(member.managerId)?.reports.push(node)
      continue
    }

    if (member.managerId && member.managerExists !== true) {
      orphanedEmployees.push(node.employee)
    }
    roots.push(node)
  }

  const sortNodes = (nodes: EmployeeOrgChartNode[]) => {
    nodes.sort((left, right) => compareMembers(left.employee, right.employee))
    for (const node of nodes) {
      sortNodes(node.reports)
    }
  }

  sortNodes(roots)

  return {
    roots,
    orphanedEmployees,
    cycleEmployees: sortedMembers
      .filter((member) => cycleIds.has(member.id))
      .map((member) => nodeById.get(member.id)!.employee),
    summary: {
      totalEmployees: sortedMembers.length,
      activeEmployees: sortedMembers.filter((member) => member.employmentStatus === 'ACTIVE').length,
      inactiveEmployees: sortedMembers.filter((member) => member.employmentStatus === 'INACTIVE').length,
      resignedEmployees: sortedMembers.filter((member) => member.employmentStatus === 'RESIGNED').length,
      roots: roots.length,
      orphanedEmployees: orphanedEmployees.length,
      cycleEmployees: cycleIds.size,
    },
  }
}

export async function fetchEmployeeOrgChart(params: {
  query?: string
  status?: string
  departmentId?: string
  includeDescendants?: boolean
}) {
  const requestedDepartmentId = params.departmentId?.trim() || null
  const shouldIncludeDescendants = Boolean(requestedDepartmentId && params.includeDescendants)
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      include: {
        department: {
          select: {
            id: true,
            deptCode: true,
            deptName: true,
          },
        },
      },
      orderBy: [{ empName: 'asc' }],
    }),
    shouldIncludeDescendants
      ? prisma.department.findMany({
          select: {
            id: true,
            parentDeptId: true,
          },
        })
      : Promise.resolve([]),
  ])

  const normalizedQuery = params.query?.trim().toLowerCase() ?? ''
  const requestedStatus = params.status && params.status !== 'ALL' ? params.status : null
  const requestedDepartmentIds =
    requestedDepartmentId && shouldIncludeDescendants
      ? collectDepartmentAndDescendantIds(departments, requestedDepartmentId)
      : requestedDepartmentId
        ? new Set([requestedDepartmentId])
        : null
  const directReportCountByManagerId = new Map<string, number>()
  const employeeById = new Map(employees.map((employee) => [employee.id, employee] as const))

  for (const employee of employees) {
    if (employee.managerId) {
      directReportCountByManagerId.set(
        employee.managerId,
        (directReportCountByManagerId.get(employee.managerId) ?? 0) + 1
      )
    }
  }

  const visibleMembers: EmployeeOrgChartMember[] = employees
    .filter((employee) => {
      if (requestedStatus && employee.status !== requestedStatus) return false
      if (requestedDepartmentIds && !requestedDepartmentIds.has(employee.deptId)) return false
      if (!normalizedQuery) return true

      const target = [
        employee.empId,
        employee.empName,
        employee.gwsEmail,
        employee.department.deptName,
        employee.department.deptCode,
        normalizeEmployeeTeamName(employee.teamName, employee.department.deptName) ?? '',
        employee.jobTitle ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return target.includes(normalizedQuery)
    })
    .map((employee) => {
      const manager = employee.managerId ? employeeById.get(employee.managerId) : null

      return {
        id: employee.id,
        employeeNumber: employee.empId,
        name: employee.empName,
        googleEmail: employee.gwsEmail,
        departmentName: employee.department.deptName,
        departmentCode: employee.department.deptCode,
        teamName: normalizeEmployeeTeamName(employee.teamName, employee.department.deptName),
        jobTitle: employee.jobTitle,
        role: employee.role,
        employmentStatus: employee.status as EmployeeManagementStatus,
        joinDate: employee.joinDate.toISOString().slice(0, 10),
        resignationDate: employee.resignationDate ? employee.resignationDate.toISOString().slice(0, 10) : null,
        managerId: employee.managerId,
        managerExists: Boolean(manager),
        managerEmployeeNumber: manager?.empId ?? null,
        managerName: manager?.empName ?? null,
        directReportCount: directReportCountByManagerId.get(employee.id) ?? 0,
        sortOrder: employee.sortOrder,
      }
    })

  return buildEmployeeOrgChart(visibleMembers)
}
