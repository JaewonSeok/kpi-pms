import type { EmployeeStatus, Position, SystemRole } from '@prisma/client'
import * as XLSX from 'xlsx'
import { prisma } from '../../lib/prisma'
import {
  assertAllowedGoogleWorkspaceEmail,
  getAllowedGoogleWorkspaceDomain,
  normalizeGoogleWorkspaceEmail,
} from '../../lib/google-workspace'
import { AppError } from '../../lib/utils'

export const EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS = [
  {
    key: 'employeeNumber',
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
    key: 'departmentCode',
    required: true,
    description: '부서 코드입니다. 없으면 새 부서를 생성하고, 있으면 해당 부서를 갱신합니다.',
    example: 'HR-OPS',
  },
  {
    key: 'department',
    required: true,
    description: '부서명입니다.',
    example: '인사운영팀',
  },
  {
    key: 'team',
    required: false,
    description: '팀명입니다. 조직도와 목록 표시용입니다.',
    example: '채용파트',
  },
  {
    key: 'title',
    required: false,
    description: '직책 또는 직위를 입력합니다.',
    example: '매니저',
  },
  {
    key: 'role',
    required: true,
    description:
      'ROLE_MEMBER, ROLE_TEAM_LEADER, ROLE_SECTION_CHIEF, ROLE_DIV_HEAD, ROLE_CEO, ROLE_ADMIN 중 하나를 사용합니다.',
    example: 'ROLE_MEMBER',
  },
  {
    key: 'employmentStatus',
    required: true,
    description: 'ACTIVE, INACTIVE, ON_LEAVE, RESIGNED 중 하나를 사용합니다.',
    example: 'ACTIVE',
  },
  {
    key: 'managerEmployeeNumber',
    required: false,
    description: '직속 상사의 사번입니다. 같은 파일 안 또는 기존 등록 직원이면 참조할 수 있습니다.',
    example: 'E-1000',
  },
  {
    key: 'joinDate',
    required: false,
    description: '입사일입니다. YYYY-MM-DD 형식을 권장합니다.',
    example: '2024-01-15',
  },
  {
    key: 'resignationDate',
    required: false,
    description: '퇴사일입니다. RESIGNED 상태에서만 사용합니다.',
    example: '2025-12-31',
  },
  {
    key: 'sortOrder',
    required: false,
    description: '조직도 표시 순서입니다. 숫자가 작을수록 먼저 표시됩니다.',
    example: '10',
  },
  {
    key: 'notes',
    required: false,
    description: '비고입니다. 운영 메모 용도입니다.',
    example: '겸직 중',
  },
] as const

export const EMPLOYEE_UPLOAD_TEMPLATE_HEADERS = EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS.map(
  (column) => column.key
)
export const EMPLOYEE_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED'] as const

export type EmployeeManagementStatus = (typeof EMPLOYEE_STATUS_VALUES)[number]
export type EmployeeUploadTemplateKey = (typeof EMPLOYEE_UPLOAD_TEMPLATE_COLUMNS)[number]['key']

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
}

export type EmployeeUploadNormalizedRow = {
  rowNumber: number
  employeeNumber: string
  name: string
  googleEmail: string
  departmentCode: string
  department: string
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
  severity: 'error' | 'warning'
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
}

export type DepartmentDirectoryItem = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
  leaderEmployeeId: string | null
  leaderEmployeeNumber: string | null
  leaderEmployeeName: string | null
  excludeLeaderFromEvaluatorAutoAssign: boolean
  memberCount: number
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
}

const HEADER_ALIASES: Record<EmployeeUploadTemplateKey, string[]> = {
  employeeNumber: ['employeeNumber', 'employee_number', 'empId', 'emp_id', '사번'],
  name: ['name', 'employeeName', 'empName', '직원명', '이름'],
  googleEmail: ['googleEmail', 'google_email', 'gwsEmail', 'gws_email', '구글이메일', 'google'],
  departmentCode: ['departmentCode', 'department_code', 'deptCode', 'dept_code', '부서코드'],
  department: ['department', 'departmentName', 'deptName', 'dept_name', '부서명', '부서'],
  team: ['team', 'teamName', 'team_name', '팀', '팀명'],
  title: ['title', 'jobTitle', 'job_title', 'positionTitle', '직책', '직위'],
  role: ['role', 'systemRole', '권한', '직급'],
  employmentStatus: ['employmentStatus', 'employment_status', 'status', '재직상태', '상태'],
  managerEmployeeNumber: [
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
  MEMBER: 'ROLE_MEMBER',
  구성원: 'ROLE_MEMBER',
  ROLE_TEAM_LEADER: 'ROLE_TEAM_LEADER',
  TEAM_LEADER: 'ROLE_TEAM_LEADER',
  팀장: 'ROLE_TEAM_LEADER',
  ROLE_SECTION_CHIEF: 'ROLE_SECTION_CHIEF',
  SECTION_CHIEF: 'ROLE_SECTION_CHIEF',
  SECTIONCHIEF: 'ROLE_SECTION_CHIEF',
  실장: 'ROLE_SECTION_CHIEF',
  부문장: 'ROLE_SECTION_CHIEF',
  ROLE_DIV_HEAD: 'ROLE_DIV_HEAD',
  DIV_HEAD: 'ROLE_DIV_HEAD',
  DIVHEAD: 'ROLE_DIV_HEAD',
  본부장: 'ROLE_DIV_HEAD',
  ROLE_CEO: 'ROLE_CEO',
  CEO: 'ROLE_CEO',
  ROLE_ADMIN: 'ROLE_ADMIN',
  ADMIN: 'ROLE_ADMIN',
  HR: 'ROLE_ADMIN',
  관리자: 'ROLE_ADMIN',
  HR관리자: 'ROLE_ADMIN',
}

const STATUS_INPUT_MAP: Record<string, EmployeeManagementStatus> = {
  ACTIVE: 'ACTIVE',
  재직: 'ACTIVE',
  근무중: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  비활성: 'INACTIVE',
  비활성화: 'INACTIVE',
  휴면: 'INACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  ONLEAVE: 'ON_LEAVE',
  휴직: 'ON_LEAVE',
  RESIGNED: 'RESIGNED',
  퇴사: 'RESIGNED',
  퇴직: 'RESIGNED',
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

function getUploadValue(row: Record<string, unknown>, key: EmployeeUploadTemplateKey) {
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
  severity: 'error' | 'warning' = 'error'
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
    ['employmentStatus', '', 'ACTIVE / INACTIVE / ON_LEAVE / RESIGNED', ''],
    ['role', '', 'ROLE_MEMBER / ROLE_TEAM_LEADER / ROLE_SECTION_CHIEF / ROLE_DIV_HEAD / ROLE_CEO / ROLE_ADMIN', ''],
    [
      'managerEmployeeNumber',
      '',
      '같은 파일 또는 기존 등록 직원의 사번이어야 하며 본인을 지정할 수 없습니다.',
      '',
    ],
    ['resignationDate', '', 'ACTIVE 상태에서는 입력할 수 없습니다.', ''],
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
    const employeeNumber = normalizeTextValue(getUploadValue(rawRow, 'employeeNumber'))
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
    const employeeNumber = normalizeTextValue(getUploadValue(rawRow, 'employeeNumber'))
    const name = normalizeTextValue(getUploadValue(rawRow, 'name'))
    const googleEmailValue = normalizeTextValue(getUploadValue(rawRow, 'googleEmail'))
    const departmentCode = normalizeTextValue(getUploadValue(rawRow, 'departmentCode'))
    const departmentName = normalizeTextValue(getUploadValue(rawRow, 'department'))
    const team = normalizeTextValue(getUploadValue(rawRow, 'team')) || null
    const title = normalizeTextValue(getUploadValue(rawRow, 'title')) || null
    const managerEmployeeNumber =
      normalizeTextValue(getUploadValue(rawRow, 'managerEmployeeNumber')) || null
    const joinDateResult = parseOptionalDate(getUploadValue(rawRow, 'joinDate'))
    const resignationDateResult = parseOptionalDate(getUploadValue(rawRow, 'resignationDate'))
    const sortOrderResult = parseOptionalSortOrder(getUploadValue(rawRow, 'sortOrder'))
    const notes = normalizeTextValue(getUploadValue(rawRow, 'notes')) || null
    const existing = employeeNumber ? existingByEmployeeNumber.get(employeeNumber) : undefined
    const role = normalizeRoleValue(getUploadValue(rawRow, 'role'))
    const employmentStatus = normalizeStatusValue(getUploadValue(rawRow, 'employmentStatus'))

    const row: EmployeeUploadValidationRow = {
      rowNumber,
      employeeNumber,
      name,
      action: existing ? 'update' : 'create',
      valid: false,
      issues: [],
      normalizedRow: null,
    }

    if (!employeeNumber) addIssue(row, 'employeeNumber', '사번은 필수입니다.')
    if (!name) addIssue(row, 'name', '직원명은 필수입니다.')
    if (!googleEmailValue) addIssue(row, 'googleEmail', 'Google 이메일은 필수입니다.')
    if (!departmentCode) addIssue(row, 'departmentCode', '부서 코드는 필수입니다.')
    if (!departmentName) addIssue(row, 'department', '부서명은 필수입니다.')
    if (!role) addIssue(row, 'role', '권한 값이 올바르지 않습니다.')
    if (!employmentStatus) addIssue(row, 'employmentStatus', '재직 상태 값이 올바르지 않습니다.')
    if (joinDateResult.invalid) addIssue(row, 'joinDate', '입사일 형식이 올바르지 않습니다.')
    if (resignationDateResult.invalid) addIssue(row, 'resignationDate', '퇴사일 형식이 올바르지 않습니다.')
    if (sortOrderResult.invalid) addIssue(row, 'sortOrder', '정렬 순서는 0 이상의 정수여야 합니다.')

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

    if (employmentStatus === 'ACTIVE' && resignationDateResult.value) {
      addIssue(row, 'resignationDate', '재직 상태가 ACTIVE이면 퇴사일을 입력할 수 없습니다.')
    }
    if (employmentStatus === 'RESIGNED' && !resignationDateResult.value) {
      addIssue(row, 'resignationDate', '퇴사 상태에는 퇴사일 입력을 권장합니다.', 'warning')
    }
    if (managerEmployeeNumber && employeeNumber && managerEmployeeNumber === employeeNumber) {
      addIssue(row, 'managerEmployeeNumber', '본인을 관리자로 지정할 수 없습니다.')
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
        departmentCode,
        department: departmentName,
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
      addIssue(row, 'managerEmployeeNumber', '지정한 관리자의 사번을 찾을 수 없습니다.')
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
      addIssue(row, 'managerEmployeeNumber', '관리자 연결에 순환 참조가 있습니다.')
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
    },
    rows,
    validRows,
    errors,
  } satisfies EmployeeUploadValidationResult
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

export async function loadEmployeeDirectory(params: {
  query?: string
  status?: string
  departmentId?: string
}) {
  const [departments, employees, uploadHistory] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        deptCode: true,
        deptName: true,
        parentDeptId: true,
        leaderEmployeeId: true,
        excludeLeaderFromEvaluatorAutoAssign: true,
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
        employee.teamName ?? '',
        employee.jobTitle ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return target.includes(normalizedQuery)
    })
    .map((employee) => ({
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      googleEmail: employee.gwsEmail,
      departmentId: employee.department.id,
      departmentCode: employee.department.deptCode,
      departmentName: employee.department.deptName,
      teamName: employee.teamName,
      jobTitle: employee.jobTitle,
      role: employee.role,
      employmentStatus: employee.status as EmployeeManagementStatus,
      joinDate: employee.joinDate.toISOString().slice(0, 10),
      resignationDate: employee.resignationDate ? employee.resignationDate.toISOString().slice(0, 10) : null,
      managerId: employee.managerId,
      managerEmployeeNumber: employee.managerId ? employeeNumberById.get(employee.managerId) ?? null : null,
      managerName: employee.managerId ? employeeNameById.get(employee.managerId) ?? null : null,
      sortOrder: employee.sortOrder,
      notes: employee.notes,
      directReportCount: directReportCountByManagerId.get(employee.id) ?? 0,
      loginEnabled: employee.status === 'ACTIVE',
    }))

  return {
    allowedDomain: getAllowedGoogleWorkspaceDomain(),
    departments: departments.map((department) => ({
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      leaderEmployeeId: department.leaderEmployeeId,
      leaderEmployeeNumber: department.leaderEmployeeId
        ? employeeNumberById.get(department.leaderEmployeeId) ?? null
        : null,
      leaderEmployeeName: department.leaderEmployeeId
        ? employeeNameById.get(department.leaderEmployeeId) ?? null
        : null,
      excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
      memberCount: memberCountByDepartmentId.get(department.id) ?? 0,
    })),
    managerOptions: employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      employmentStatus: employee.status as EmployeeManagementStatus,
      departmentName: employee.department.deptName,
    })),
    summary: {
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

async function resolveDepartmentOrThrow(deptId: string) {
  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: {
      id: true,
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
  deptCode: string
  deptName: string
  parentDeptId?: string | null
  leaderEmployeeId?: string | null
  excludeLeaderFromEvaluatorAutoAssign?: boolean
}) {
  const normalizedCode = params.deptCode.trim().toUpperCase()
  const normalizedName = params.deptName.trim()
  const parentDeptId = params.parentDeptId?.trim() || null
  const leader = await resolveDepartmentLeaderOrThrow(params.leaderEmployeeId)

  const existingDepartment = params.departmentId
    ? await prisma.department.findUnique({
        where: { id: params.departmentId },
        select: { id: true, orgId: true },
      })
    : null

  if (params.departmentId && !existingDepartment) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', '조직 정보를 찾을 수 없습니다.')
  }

  if (parentDeptId && params.departmentId && parentDeptId === params.departmentId) {
    throw new AppError(400, 'DEPARTMENT_PARENT_SELF', '조직의 상위 조직을 자기 자신으로 지정할 수 없습니다.')
  }

  const duplicateCode = await prisma.department.findFirst({
    where: {
      deptCode: normalizedCode,
      NOT: params.departmentId ? { id: params.departmentId } : undefined,
    },
    select: { id: true },
  })

  if (duplicateCode) {
    throw new AppError(409, 'DEPARTMENT_CODE_EXISTS', '이미 사용 중인 조직 코드입니다.')
  }

  let parentDepartment:
    | {
        id: string
        orgId: string
        parentDeptId: string | null
      }
    | null = null

  if (parentDeptId) {
    parentDepartment = await prisma.department.findUnique({
      where: { id: parentDeptId },
      select: { id: true, orgId: true, parentDeptId: true },
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
      leaderEmployeeId: leader?.id ?? null,
      leaderEmployeeNumber: leader?.empId ?? null,
      leaderEmployeeName: leader?.empName ?? null,
      excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
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
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
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

  const employee = params.employeeId
    ? await prisma.employee.update({
        where: { id: params.employeeId },
        data: {
          empId: params.employeeNumber,
          empName: params.name.trim(),
          gwsEmail: normalizedEmail,
          deptId: department.id,
          teamName: params.teamName?.trim() || null,
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
          deptId: department.id,
          teamName: params.teamName?.trim() || null,
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

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
      googleEmail: employee.gwsEmail,
      departmentId: employee.department.id,
      departmentCode: employee.department.deptCode,
      departmentName: employee.department.deptName,
      teamName: employee.teamName,
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
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
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

  return {
    employee: {
      id: updatedEmployee.id,
      employeeNumber: updatedEmployee.empId,
      name: updatedEmployee.empName,
      googleEmail: updatedEmployee.gwsEmail,
      departmentId: updatedEmployee.department.id,
      departmentCode: updatedEmployee.department.deptCode,
      departmentName: updatedEmployee.department.deptName,
      teamName: updatedEmployee.teamName,
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
    },
    impactedDirectReports: directReportCount,
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
  }
}

export async function safeDeleteEmployeeRecord(employeeId: string) {
  const [employee, notificationPreferenceCount, directReportCount] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        empId: true,
        empName: true,
        _count: {
          select: {
            personalKpis: true,
            monthlyRecords: true,
            selfEvaluations: true,
            givenEvaluations: true,
            checkInsAsOwner: true,
            checkInsAsManager: true,
            feedbackGiven: true,
            feedbackReceived: true,
            feedbackNominationTargets: true,
            feedbackNominationReviewers: true,
            feedbackNominationSubmitters: true,
            feedbackNominationApprovers: true,
            feedbackReportTargets: true,
            feedbackReportGenerators: true,
            developmentPlans: true,
            createdDevelopmentPlans: true,
            notifications: true,
            appeals: true,
            compensationSnapshots: true,
            notificationJobs: true,
            notificationDeadLetters: true,
            aiRequestLogs: true,
          },
        },
      },
    }),
    prisma.notificationPreference.count({
      where: {
        employeeId,
      },
    }),
    prisma.employee.count({
      where: {
        OR: [
          { managerId: employeeId },
          { teamLeaderId: employeeId },
          { sectionChiefId: employeeId },
          { divisionHeadId: employeeId },
        ],
      },
    }),
  ])

  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', '직원 정보를 찾을 수 없습니다.')
  }

  const blockers: string[] = []
  if (directReportCount > 0) blockers.push(`직속 또는 리더 참조 ${directReportCount}건`)
  if (employee._count.personalKpis > 0) blockers.push(`개인 KPI ${employee._count.personalKpis}건`)
  if (employee._count.monthlyRecords > 0) blockers.push(`월간 실적 ${employee._count.monthlyRecords}건`)
  if (employee._count.selfEvaluations + employee._count.givenEvaluations > 0) {
    blockers.push(`평가 데이터 ${employee._count.selfEvaluations + employee._count.givenEvaluations}건`)
  }
  if (employee._count.checkInsAsOwner + employee._count.checkInsAsManager > 0) {
    blockers.push(`체크인 데이터 ${employee._count.checkInsAsOwner + employee._count.checkInsAsManager}건`)
  }
  if (employee._count.feedbackGiven + employee._count.feedbackReceived > 0) {
    blockers.push(`360 피드백 ${employee._count.feedbackGiven + employee._count.feedbackReceived}건`)
  }
  if (
    employee._count.feedbackNominationTargets +
      employee._count.feedbackNominationReviewers +
      employee._count.feedbackNominationSubmitters +
      employee._count.feedbackNominationApprovers >
    0
  ) {
    blockers.push('360 피드백 지명 이력')
  }
  if (employee._count.feedbackReportTargets + employee._count.feedbackReportGenerators > 0) {
    blockers.push('360 리포트 캐시')
  }
  if (employee._count.developmentPlans + employee._count.createdDevelopmentPlans > 0) {
    blockers.push('성장 계획')
  }
  if (employee._count.notifications + employee._count.notificationJobs + employee._count.notificationDeadLetters > 0) {
    blockers.push('알림 기록')
  }
  if (employee._count.appeals > 0) blockers.push('이의 신청')
  if (employee._count.compensationSnapshots > 0) blockers.push('보상 시뮬레이션')
  if (employee._count.aiRequestLogs > 0) blockers.push('AI 사용 기록')
  if (notificationPreferenceCount > 0) blockers.push('알림 환경설정')

  if (blockers.length > 0) {
    throw new AppError(
      409,
      'EMPLOYEE_DELETE_BLOCKED',
      `이 직원은 바로 삭제할 수 없습니다. ${blockers.join(', ')}이(가) 남아 있어 비활성화 또는 퇴사 처리 후 정리해 주세요.`
    )
  }

  try {
    await prisma.employee.delete({
      where: { id: employeeId },
    })
  } catch {
    throw new AppError(
      409,
      'EMPLOYEE_DELETE_BLOCKED',
      '다른 데이터와 연결되어 있어 삭제할 수 없습니다. 비활성화 또는 퇴사 처리로 관리해 주세요.'
    )
  }

  const hierarchyResult = await recalculateLeadershipLinks()

  return {
    deletedEmployee: {
      id: employee.id,
      employeeNumber: employee.empId,
      name: employee.empName,
    },
    hierarchyUpdatedCount: hierarchyResult.updatedCount,
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
    },
  })
  const departmentIdByCode = new Map(
    existingDepartments.map((department) => [department.deptCode.toUpperCase(), department.id] as const)
  )

  let createdDepartmentCount = 0
  for (const department of new Map(
    params.rows.map((row) => [
      row.departmentCode.toUpperCase(),
      {
        departmentCode: row.departmentCode,
        departmentName: row.department,
      },
    ])
  ).values()) {
    const departmentCode = department.departmentCode.toUpperCase()
    if (departmentIdByCode.has(departmentCode)) {
      await prisma.department.update({
        where: { id: departmentIdByCode.get(departmentCode)! },
        data: { deptName: department.departmentName },
      })
      continue
    }

    const createdDepartment = await prisma.department.create({
      data: {
        deptCode: department.departmentCode,
        deptName: department.departmentName,
        orgId: organization.id,
      },
      select: {
        id: true,
      },
    })
    departmentIdByCode.set(departmentCode, createdDepartment.id)
    createdDepartmentCount += 1
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
    const departmentId = departmentIdByCode.get(row.departmentCode.toUpperCase())
    if (!departmentId) {
      throw new AppError(500, 'DEPARTMENT_RESOLVE_FAILED', '부서 정보를 반영하는 중 오류가 발생했습니다.')
    }

    const existing = existingByEmployeeNumber.get(row.employeeNumber)
    if (existing) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: {
          empName: row.name,
          gwsEmail: row.googleEmail,
          deptId: departmentId,
          teamName: row.team,
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
        deptId: departmentId,
        teamName: row.team,
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

    if (member.managerId) {
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
}) {
  const employees = await prisma.employee.findMany({
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
  })

  const normalizedQuery = params.query?.trim().toLowerCase() ?? ''
  const requestedStatus = params.status && params.status !== 'ALL' ? params.status : null
  const requestedDepartmentId = params.departmentId?.trim() || null
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
      if (requestedDepartmentId && employee.deptId !== requestedDepartmentId) return false
      if (!normalizedQuery) return true

      const target = [
        employee.empId,
        employee.empName,
        employee.gwsEmail,
        employee.department.deptName,
        employee.department.deptCode,
        employee.teamName ?? '',
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
        teamName: employee.teamName,
        jobTitle: employee.jobTitle,
        role: employee.role,
        employmentStatus: employee.status as EmployeeManagementStatus,
        joinDate: employee.joinDate.toISOString().slice(0, 10),
        resignationDate: employee.resignationDate ? employee.resignationDate.toISOString().slice(0, 10) : null,
        managerId: employee.managerId,
        managerEmployeeNumber: manager?.empId ?? null,
        managerName: manager?.empName ?? null,
        directReportCount: directReportCountByManagerId.get(employee.id) ?? 0,
        sortOrder: employee.sortOrder,
      }
    })

  return buildEmployeeOrgChart(visibleMembers)
}
