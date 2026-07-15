/* eslint-disable @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import './register-path-aliases'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import {
  buildAdminGoogleAccessHref,
  resolveAdminGoogleAccessTab,
} from '../src/lib/admin-google-access-tabs'
import { resolveEmployeePositionLabel } from '../src/lib/employee-position-label'
import { isNavigationHrefActive } from '../src/lib/navigation'
import {
  AdminDepartmentRecordSchema,
  AdminEmployeeLifecycleActionSchema,
  AdminEvaluatorAssignmentActionSchema,
  CreateAdminEmployeeSchema,
  UpdateGoogleAccountEmployeeSchema,
} from '../src/lib/validations'

process.env.ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'rsupport.com'
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const {
  EMPLOYEE_UPLOAD_TEMPLATE_HEADERS,
  buildEmployeeOrgChart,
  collectDepartmentAndDescendantIds,
  buildEmployeeUploadDepartmentPlan,
  buildEmployeeTemplateWorkbook,
  parseEmployeeUploadWorkbook,
  summarizeDepartmentScopes,
  validateEmployeeUploadRows,
} = require('../src/server/admin/google-account-management') as typeof import('../src/server/admin/google-account-management')

const { buildAssignments } = require('../src/server/admin/employeeHierarchy') as typeof import('../src/server/admin/employeeHierarchy')

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const existingEmployees = [
  {
    id: 'mgr-1',
    employeeNumber: 'E-1000',
    name: '愿由ъ옄',
    googleEmail: 'manager@rsupport.com',
    status: 'ACTIVE' as const,
    managerId: null,
    managerEmployeeNumber: null,
  },
  {
    id: 'emp-1',
    employeeNumber: 'E-1001',
    name: '湲곗〈吏곸썝',
    googleEmail: 'member1@rsupport.com',
    status: 'ACTIVE' as const,
    managerId: 'mgr-1',
    managerEmployeeNumber: 'E-1000',
  },
]

const existingDepartments = [{ id: 'dept-1', deptCode: 'HR', deptName: '?몄궗?', parentDeptId: null }]

function buildWorkbookBuffer(rows: Array<Record<string, unknown>>) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function toEmployeeUploadRow(row: Record<string, unknown>) {
  const employeeNo = row.employeeNo ?? row.employeeNumber
  const managerEmployeeNo = row.managerEmployeeNo ?? row.managerEmployeeNumber
  const rest = { ...row }
  delete rest.employeeNumber
  delete rest.managerEmployeeNumber

  return {
    name: 'Upload User',
    googleEmail: 'upload.user@rsupport.com',
    division: '경영지원본부',
    section: '',
    team: '인사팀',
    title: '매니저',
    role: 'ROLE_MEMBER',
    ...rest,
    employeeNo,
    managerEmployeeNo,
  }
}

function validateRows(rows: Array<Record<string, unknown>>) {
  const workbook = parseEmployeeUploadWorkbook('employees.xlsx', buildWorkbookBuffer(rows.map(toEmployeeUploadRow)))
  return validateEmployeeUploadRows({
    fileName: workbook.fileName,
    rows: workbook.rows,
    existingEmployees,
    existingDepartments,
    allowedDomain: 'rsupport.com',
  })
}

run('template workbook exposes the expected headers', () => {
  const workbook = XLSX.read(buildEmployeeTemplateWorkbook(), { type: 'buffer' })
  const templateSheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Array<string>>(templateSheet, { header: 1 })
  const headerRow: string[] = Array.from(rows[0] ?? []).map((cell) => String(cell))
  assert.equal(headerRow.some((header) => header === 'employmentStatus'), false)
  assert.equal(headerRow.some((header) => header === 'resignationDate'), false)
  assert.deepEqual(headerRow, EMPLOYEE_UPLOAD_TEMPLATE_HEADERS)
  assert.deepEqual(headerRow, [
    'employeeNo',
    'name',
    'googleEmail',
    'division',
    'section',
    'team',
    'title',
    'role',
    'managerEmployeeNo',
  ])
})

run('valid upload row passes preview validation', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-2000',
      name: '?좉퇋吏곸썝',
      googleEmail: 'new.member@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      managerEmployeeNumber: 'E-1000',
      joinDate: '2025-01-10',
    },
  ])

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.rows[0]?.valid, true)
})

run('minimal employee upload columns pass without optional legacy organization fields', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2002',
      name: 'Minimal Upload',
      googleEmail: 'minimal.upload@rsupport.com',
      division: '경영지원본부',
      section: '',
      team: '인사팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
  ])

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.rows[0]?.valid, true)
  assert.equal(result.summary.infoCount, 1)
  assert.equal(result.validRows[0]?.employmentStatus, 'ACTIVE')
  assert.equal(result.validRows[0]?.division, '경영지원본부')
  assert.equal(result.validRows[0]?.section, null)
  assert.equal(result.validRows[0]?.department, '경영지원본부')
  assert.equal(result.validRows[0]?.team, '인사팀')
})

run('optional upload columns can be omitted while manager absence is warning-only', () => {
  const workbook = parseEmployeeUploadWorkbook(
    'employees.xlsx',
    buildWorkbookBuffer([
      {
        employeeNo: 'E-2003',
        name: 'Optional Omitted',
        googleEmail: 'optional.omitted@rsupport.com',
        division: '경영지원본부',
        section: '',
        team: '인사팀',
        title: '매니저',
        role: 'ROLE_MEMBER',
      },
    ])
  )
  const result = validateEmployeeUploadRows({
    fileName: workbook.fileName,
    rows: workbook.rows,
    existingEmployees,
    existingDepartments,
    allowedDomain: 'rsupport.com',
  })

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.summary.warningCount, 1)
  assert.equal(result.summary.infoCount, 1)
  assert.equal(result.validRows[0]?.employmentStatus, 'ACTIVE')
  assert.equal(result.rows[0]?.issues.some((issue) => issue.field === 'managerEmployeeNo'), true)
  assert.equal(
    result.rows[0]?.issues.some((issue) => issue.field === 'employmentStatus' && issue.severity === 'info'),
    true
  )
})

run('valid upload rows produce full division section team department paths', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2101',
      name: 'Finance Upload',
      googleEmail: 'finance.upload@rsupport.com',
      division: '경영지원본부',
      section: '재무관리실',
      team: '회계팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
  ])
  const plan = buildEmployeeUploadDepartmentPlan(result.validRows)
  const keys = new Set(plan.map((item) => item.key))

  assert.equal(result.summary.validRows, 1)
  assert.equal(keys.has('경영지원본부'), true)
  assert.equal(keys.has('경영지원본부>재무관리실'), true)
  assert.equal(keys.has('경영지원본부>재무관리실>회계팀'), true)
  assert.equal(plan.find((item) => item.key === '경영지원본부>재무관리실>회계팀')?.scope, 'team')
})

run('empty section upload rows produce division team department paths', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2102',
      name: 'No Section Upload',
      googleEmail: 'no.section.upload@rsupport.com',
      division: '영업본부',
      section: '',
      team: '파트너영업팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
  ])
  const plan = buildEmployeeUploadDepartmentPlan(result.validRows)
  const keys = new Set(plan.map((item) => item.key))

  assert.equal(result.summary.validRows, 1)
  assert.equal(keys.has('영업본부'), true)
  assert.equal(keys.has('영업본부>파트너영업팀'), true)
  assert.equal(plan.some((item) => item.key === '영업본부>>파트너영업팀'), false)
})

run('same team name under different divisions is not merged in upload department plan', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2103',
      name: 'Support Ops',
      googleEmail: 'support.ops@rsupport.com',
      division: '고객지원본부',
      section: '',
      team: '운영팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
    {
      employeeNo: 'E-2104',
      name: 'Platform Ops',
      googleEmail: 'platform.ops@rsupport.com',
      division: '플랫폼본부',
      section: '',
      team: '운영팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
  ])
  const plan = buildEmployeeUploadDepartmentPlan(result.validRows)
  const teamPaths = plan.filter((item) => item.departmentName === '운영팀')

  assert.equal(result.summary.validRows, 2)
  assert.equal(teamPaths.length, 2)
  assert.equal(teamPaths.some((item) => item.key === '고객지원본부>운영팀'), true)
  assert.equal(teamPaths.some((item) => item.key === '플랫폼본부>운영팀'), true)
})

run('invalid upload rows are excluded from department path creation', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2105',
      name: 'Valid Org Path',
      googleEmail: 'valid.path@rsupport.com',
      division: '전략본부',
      section: '',
      team: '기획팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
    {
      employeeNo: 'E-2106',
      name: 'Invalid Org Path',
      googleEmail: '',
      division: '오류본부',
      section: '',
      team: '오류팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
      managerEmployeeNo: 'E-1000',
    },
  ])
  const plan = buildEmployeeUploadDepartmentPlan(result.validRows)
  const keys = new Set(plan.map((item) => item.key))

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.summary.invalidRows, 1)
  assert.equal(keys.has('전략본부>기획팀'), true)
  assert.equal(keys.has('오류본부'), false)
  assert.equal(keys.has('오류본부>오류팀'), false)
})

run('department scope summary keeps zero-member and leaderless departments countable', () => {
  const summary = summarizeDepartmentScopes([
    { scope: 'division' as const },
    { scope: 'section' as const },
    { scope: 'team' as const },
    { scope: 'team' as const },
  ])

  assert.deepEqual(summary, {
    totalDepartments: 4,
    divisionCount: 1,
    sectionCount: 1,
    teamCount: 2,
  })
})

run('department descendant collection includes selected department and descendants only', () => {
  const departmentIds = collectDepartmentAndDescendantIds(
    [
      { id: 'division-rnd', parentDeptId: null },
      { id: 'team-ai', parentDeptId: 'division-rnd' },
      { id: 'team-web', parentDeptId: 'division-rnd' },
      { id: 'division-sales', parentDeptId: null },
      { id: 'team-sales', parentDeptId: 'division-sales' },
    ],
    'division-rnd'
  )

  assert.equal(departmentIds.has('division-rnd'), true)
  assert.equal(departmentIds.has('team-ai'), true)
  assert.equal(departmentIds.has('team-web'), true)
  assert.equal(departmentIds.has('team-sales'), false)
})

run('googleEmail, division, and team are required for employee upload', () => {
  const missingGoogleEmail = validateRows([
    {
      employeeNo: 'E-2004',
      googleEmail: '',
      division: '경영지원본부',
      team: '인사팀',
    },
  ])
  const missingDivision = validateRows([
    {
      employeeNo: 'E-2005',
      googleEmail: 'missing.division@rsupport.com',
      division: '',
      team: '인사팀',
    },
  ])
  const missingTeam = validateRows([
    {
      employeeNo: 'E-2006',
      googleEmail: 'missing.team@rsupport.com',
      division: '경영지원본부',
      team: '',
    },
  ])

  assert.equal(missingGoogleEmail.summary.validRows, 0)
  assert.ok(missingGoogleEmail.errors.some((error) => error.field === 'googleEmail'))
  assert.equal(missingDivision.summary.validRows, 0)
  assert.ok(missingDivision.errors.some((error) => error.field === 'division'))
  assert.equal(missingTeam.summary.validRows, 0)
  assert.ok(missingTeam.errors.some((error) => error.field === 'team'))
})

run('title is required for employee upload', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2007',
      googleEmail: 'missing.title@rsupport.com',
      division: '경영지원본부',
      team: '인사팀',
      title: '',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.ok(result.errors.some((error) => error.field === 'title'))
})

run('section can be blank and ROLE_LEADER maps to team leader role internally', () => {
  const result = validateRows([
    {
      employeeNo: 'E-2008',
      name: 'Leader Upload',
      googleEmail: 'leader.upload@rsupport.com',
      division: '영업본부',
      section: '',
      team: '영업팀',
      title: '팀장',
      role: 'ROLE_LEADER',
      employmentStatus: 'ACTIVE',
      managerEmployeeNo: 'E-1000',
    },
  ])

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.validRows[0]?.section, null)
  assert.equal(result.validRows[0]?.role, 'ROLE_TEAM_LEADER')
})

run('invalid upload role and employmentStatus fail validation', () => {
  const invalidRole = validateRows([
    {
      employeeNo: 'E-2009',
      googleEmail: 'invalid.role@rsupport.com',
      role: 'ROLE_TEAM_LEADER',
    },
  ])
  const invalidStatus = validateRows([
    {
      employeeNo: 'E-2010',
      googleEmail: 'invalid.status@rsupport.com',
      employmentStatus: 'RESIGNED',
    },
  ])

  assert.equal(invalidRole.summary.validRows, 0)
  assert.ok(invalidRole.errors.some((error) => error.field === 'role'))
  assert.equal(invalidStatus.summary.validRows, 0)
  assert.ok(invalidStatus.errors.some((error) => error.field === 'employmentStatus'))
})

run('legacy employmentStatus values are optional and validated when present', () => {
  const missingStatus = validateRows([
    {
      employeeNo: 'E-2011',
      googleEmail: 'missing.status.default@rsupport.com',
      division: '경영지원본부',
      team: '인사팀',
      title: '매니저',
      role: 'ROLE_MEMBER',
    },
  ])
  const active = validateRows([
    {
      employeeNo: 'E-2012',
      googleEmail: 'active.status@rsupport.com',
      employmentStatus: 'ACTIVE',
    },
  ])
  const inactive = validateRows([
    {
      employeeNo: 'E-2013',
      googleEmail: 'inactive.status@rsupport.com',
      employmentStatus: 'INACTIVE',
    },
  ])
  const onLeave = validateRows([
    {
      employeeNo: 'E-2014',
      googleEmail: 'onleave.status@rsupport.com',
      employmentStatus: 'ON_LEAVE',
    },
  ])

  assert.equal(missingStatus.summary.validRows, 1)
  assert.equal(missingStatus.validRows[0]?.employmentStatus, 'ACTIVE')
  assert.equal(missingStatus.rows[0]?.issues.some((issue) => issue.severity === 'info'), true)
  assert.equal(active.summary.validRows, 1)
  assert.equal(active.validRows[0]?.employmentStatus, 'ACTIVE')
  assert.equal(inactive.summary.validRows, 1)
  assert.equal(inactive.validRows[0]?.employmentStatus, 'INACTIVE')
  assert.equal(onLeave.summary.validRows, 1)
  assert.equal(onLeave.validRows[0]?.employmentStatus, 'ON_LEAVE')
})

run('invalid rows keep row-level errors', () => {
  const result = validateRows([
    {
      employeeNumber: '',
      name: '',
      googleEmail: 'wrong-email',
      departmentCode: '',
      department: '',
      role: 'UNKNOWN',
      employmentStatus: 'UNKNOWN',
    },
  ])

  assert.equal(result.summary.invalidRows, 1)
  assert.ok(result.errors.length >= 4)
})

run('duplicate employee numbers inside the file are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3000',
      name: '吏곸썝A',
      googleEmail: 'a@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
    {
      employeeNumber: 'E-3000',
      name: '吏곸썝B',
      googleEmail: 'b@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.match(result.errors[0]?.message ?? '', /./)
})

run('duplicate google emails inside the file are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3001',
      name: '吏곸썝A',
      googleEmail: 'dup@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
    {
      employeeNumber: 'E-3002',
      name: '吏곸썝B',
      googleEmail: 'dup@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.ok(result.errors.some((error) => error.field === 'googleEmail'))
})

run('existing employee number becomes update instead of create', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-1001',
      name: '湲곗〈吏곸썝?섏젙',
      googleEmail: 'member1@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.rows[0]?.action, 'update')
  assert.equal(result.summary.updateCount, 1)
})

run('inactive status is accepted and RESIGNED is rejected by the simplified upload template', () => {
  const inactive = validateRows([
    {
      employeeNumber: 'E-3100',
      name: 'Inactive Employee',
      googleEmail: 'inactive@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'INACTIVE',
    },
  ])
  const resigned = validateRows([
    {
      employeeNumber: 'E-3101',
      name: 'Resigned Employee',
      googleEmail: 'resigned-upload@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'RESIGNED',
      resignationDate: '2025-12-31',
    },
  ])

  assert.equal(inactive.summary.validRows, 1)
  assert.equal(resigned.summary.validRows, 0)
  assert.ok(resigned.errors.some((error) => error.field === 'employmentStatus'))
})

run('missing manager references are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3200',
      name: '吏곸썝',
      googleEmail: 'member3200@rsupport.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      managerEmployeeNumber: 'NOPE-1',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.ok(result.errors.some((error) => error.field === 'managerEmployeeNo'))
})

run('non-company email domains are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3300',
      name: '?몃?硫붿씪',
      googleEmail: 'user@gmail.com',
      departmentCode: 'HR',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.ok(result.errors.some((error) => error.field === 'googleEmail'))
})

run('single create schema accepts the richer admin employee payload', () => {
  const parsed = CreateAdminEmployeeSchema.safeParse({
    employeeNumber: 'E-4000',
    name: '?④굔?깅줉',
    gwsEmail: 'create@rsupport.com',
    deptId: 'dept-1',
    teamName: '梨꾩슜',
    jobTitle: '留ㅻ땲?',
    role: 'ROLE_MEMBER',
    employmentStatus: 'ACTIVE',
    managerEmployeeNumber: 'E-1000',
    joinDate: '2025-01-01',
    sortOrder: 1,
    notes: '硫붾え',
  })

  assert.equal(parsed.success, true)
})

run('single edit schema requires employeeId and accepts updates', () => {
  const parsed = UpdateGoogleAccountEmployeeSchema.safeParse({
    employeeId: 'emp-1',
    employeeNumber: 'E-1001',
    name: '?섏젙吏곸썝',
    gwsEmail: 'member1@rsupport.com',
    deptId: 'dept-1',
    role: 'ROLE_MEMBER',
    employmentStatus: 'ACTIVE',
  })

  assert.equal(parsed.success, true)
})

run('deactivate action is accepted by lifecycle schema', () => {
  const parsed = AdminEmployeeLifecycleActionSchema.safeParse({
    employeeId: 'emp-1',
    action: 'DEACTIVATE',
  })

  assert.equal(parsed.success, true)
})

run('resign action requires resignation date', () => {
  const invalid = AdminEmployeeLifecycleActionSchema.safeParse({
    employeeId: 'emp-1',
    action: 'RESIGN',
  })
  const valid = AdminEmployeeLifecycleActionSchema.safeParse({
    employeeId: 'emp-1',
    action: 'RESIGN',
    resignationDate: '2025-12-31',
  })

  assert.equal(invalid.success, false)
  assert.equal(valid.success, true)
})

run('reactivation action is accepted by lifecycle schema', () => {
  const parsed = AdminEmployeeLifecycleActionSchema.safeParse({
    employeeId: 'emp-1',
    action: 'REACTIVATE',
  })

  assert.equal(parsed.success, true)
})

run('department admin schema accepts leader assignment and exclusion toggle', () => {
  const parsed = AdminDepartmentRecordSchema.safeParse({
    deptName: '鍮꾩쫰?덉뒪?댁쁺蹂몃?',
    departmentType: 'section',
    parentDeptId: 'dept-root',
    leaderEmployeeId: 'mgr-1',
    excludeLeaderFromEvaluatorAutoAssign: true,
  })

  assert.equal(parsed.success, true)
})

run('upload validation accepts rows without manual department codes', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-2001',
      name: '組織無코드',
      googleEmail: 'nocode.member@rsupport.com',
      department: '?몄궗?',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.rows[0]?.valid, true)
})

run('admin org and employee UI hide organization codes from visible labels', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8'
  )
  const orgMemberPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/OrgMemberManagementPanel.tsx'),
    'utf8'
  )

  assert.doesNotMatch(registrationClientSource, /\{department\.deptName\} \(\{department\.deptCode\}\)/)
  assert.doesNotMatch(orgMemberPanelSource, /\{department\.deptName\} \(\{department\.deptCode\}\)/)
  assert.doesNotMatch(orgMemberPanelSource, /\{editingDepartment\.deptName\} \(\{editingDepartment\.deptCode\}\)/)
})

run('org kpi bulk upload UI uses organization names instead of visible organization codes', () => {
  const bulkUploadModalSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/kpi/OrgKpiBulkUploadModal.tsx'),
    'utf8'
  )

  assert.match(bulkUploadModalSource, /departmentName/)
  assert.match(bulkUploadModalSource, /조직 경로|議곗쭅 寃쎈줈/)
  assert.doesNotMatch(bulkUploadModalSource, /departments .*deptCode|deptCode 값을 그대로 입력/)
})

run('evaluator assignment action schema accepts preview and apply actions', () => {
  assert.equal(
    AdminEvaluatorAssignmentActionSchema.safeParse({ action: 'preview' }).success,
    true
  )
  assert.equal(
    AdminEvaluatorAssignmentActionSchema.safeParse({ action: 'apply' }).success,
    true
  )
})

run('department leader based evaluator assignment skips excluded leaders while keeping leader metadata', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  const assignments = buildAssignments(
    [
      {
        id: 'dept-root',
        deptName: '?꾩궗',
        parentDeptId: null,
        leaderEmployeeId: 'ceo-1',
        excludeLeaderFromEvaluatorAutoAssign: false,
      },
      {
        id: 'dept-a',
        deptName: '?ъ뾽蹂몃?',
        parentDeptId: 'dept-root',
        leaderEmployeeId: 'leader-a',
        excludeLeaderFromEvaluatorAutoAssign: false,
      },
      {
        id: 'dept-b',
        deptName: '吏?먮낯遺',
        parentDeptId: 'dept-root',
        leaderEmployeeId: 'leader-b',
        excludeLeaderFromEvaluatorAutoAssign: true,
      },
    ],
    [
      {
        id: 'ceo-1',
        empId: 'E-9000',
        empName: 'CEO User',
        deptId: 'dept-root',
        role: 'ROLE_DIV_HEAD',
        status: 'ACTIVE',
        joinDate: now,
        createdAt: now,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
      {
        id: 'leader-a',
        empId: 'E-9001',
        empName: '?ъ뾽 由щ뜑',
        deptId: 'dept-a',
        role: 'ROLE_TEAM_LEADER',
        status: 'ACTIVE',
        joinDate: now,
        createdAt: now,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
      {
        id: 'leader-b',
        empId: 'E-9002',
        empName: '吏??由щ뜑',
        deptId: 'dept-b',
        role: 'ROLE_TEAM_LEADER',
        status: 'ACTIVE',
        joinDate: now,
        createdAt: now,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
      {
        id: 'member-a',
        empId: 'E-9003',
        empName: '援ъ꽦?륚',
        deptId: 'dept-a',
        role: 'ROLE_MEMBER',
        status: 'ACTIVE',
        joinDate: now,
        createdAt: now,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
      {
        id: 'member-b',
        empId: 'E-9004',
        empName: '援ъ꽦?륛',
        deptId: 'dept-b',
        role: 'ROLE_MEMBER',
        status: 'ACTIVE',
        joinDate: now,
        createdAt: now,
        teamLeaderId: null,
        sectionChiefId: null,
        divisionHeadId: null,
      },
    ]
  )

  assert.equal(assignments.get('member-a')?.teamLeaderId, 'leader-a')
  assert.equal(assignments.get('member-a')?.sectionChiefId, 'ceo-1')
  assert.equal(assignments.get('member-b')?.teamLeaderId, 'ceo-1')
  assert.notEqual(assignments.get('member-b')?.teamLeaderId, 'leader-b')
})

run('org chart builder returns nested hierarchy for manager relationships', () => {
  const chart = buildEmployeeOrgChart([
    {
      id: 'mgr-1',
      employeeNumber: 'E-1000',
      name: '愿由ъ옄',
      googleEmail: 'manager@rsupport.com',
      departmentName: '?몄궗?',
      departmentCode: 'HR',
      teamName: null,
      jobTitle: 'Team Lead',
      role: 'ROLE_TEAM_LEADER',
      employmentStatus: 'ACTIVE',
      joinDate: '2023-01-01',
      resignationDate: null,
      managerId: null,
      managerEmployeeNumber: null,
      managerName: null,
      directReportCount: 1,
      sortOrder: 1,
    },
    {
      id: 'emp-1',
      employeeNumber: 'E-1001',
      name: 'Member One',
      googleEmail: 'member1@rsupport.com',
      departmentName: '?몄궗?',
      departmentCode: 'HR',
      teamName: '梨꾩슜',
      jobTitle: '?ъ썝',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      joinDate: '2024-01-01',
      resignationDate: null,
      managerId: 'mgr-1',
      managerEmployeeNumber: 'E-1000',
      managerName: '愿由ъ옄',
      directReportCount: 0,
      sortOrder: 2,
    },
  ])

  assert.equal(chart.roots.length, 1)
  assert.equal(chart.roots[0]?.reports.length, 1)
})

run('org chart builder keeps missing manager employees renderable', () => {
  const chart = buildEmployeeOrgChart([
    {
      id: 'emp-x',
      employeeNumber: 'E-5000',
      name: '愿由ъ옄?놁쓬',
      googleEmail: 'orphan@rsupport.com',
      departmentName: '?몄궗?',
      departmentCode: 'HR',
      teamName: null,
      jobTitle: null,
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      joinDate: '2024-01-01',
      resignationDate: null,
      managerId: 'missing',
      managerEmployeeNumber: 'E-9999',
      managerName: null,
      directReportCount: 0,
      sortOrder: 1,
    },
  ])

  assert.equal(chart.roots.length, 1)
  assert.equal(chart.orphanedEmployees.length, 1)
})

run('org chart builder does not mark filtered employees orphaned when their manager exists outside the current slice', () => {
  const chart = buildEmployeeOrgChart([
    {
      id: 'emp-filtered',
      employeeNumber: 'E-5001',
      name: '필터된 구성원',
      googleEmail: 'filtered@rsupport.com',
      departmentName: '재무관리실',
      departmentCode: 'HQ-SEC-1',
      teamName: null,
      jobTitle: '실장',
      role: 'ROLE_SECTION_CHIEF',
      employmentStatus: 'ACTIVE',
      joinDate: '2024-01-01',
      resignationDate: null,
      managerId: 'manager-outside-slice',
      managerExists: true,
      managerEmployeeNumber: 'E-4000',
      managerName: '상위 본부장',
      directReportCount: 1,
      sortOrder: 1,
    },
  ])

  assert.equal(chart.roots.length, 1)
  assert.equal(chart.orphanedEmployees.length, 0)
})

run('org chart summary counts resigned employees separately', () => {
  const chart = buildEmployeeOrgChart([
    {
      id: 'emp-r',
      employeeNumber: 'E-5100',
      name: 'Resigned User',
      googleEmail: 'resigned@rsupport.com',
      departmentName: '?몄궗?',
      departmentCode: 'HR',
      teamName: null,
      jobTitle: null,
      role: 'ROLE_MEMBER',
      employmentStatus: 'RESIGNED',
      joinDate: '2022-01-01',
      resignationDate: '2025-02-01',
      managerId: null,
      managerEmployeeNumber: null,
      managerName: null,
      directReportCount: 0,
      sortOrder: 1,
    },
  ])

  assert.equal(chart.summary.resignedEmployees, 1)
})

run('admin-only employee management routes enforce SYSTEM_SETTING authz', () => {
  const routeSources = [
    'src/app/api/admin/employees/google-account/route.ts',
    'src/app/api/admin/employees/google-account/template/route.ts',
    'src/app/api/admin/employees/google-account/upload/route.ts',
    'src/app/api/admin/employees/google-account/org-chart/route.ts',
    'src/app/api/admin/employees/google-account/departments/route.ts',
    'src/app/api/admin/employees/google-account/evaluators/route.ts',
  ].map((file) => readFileSync(path.resolve(process.cwd(), file), 'utf8'))

  for (const source of routeSources) {
    assert.match(source, /authorizeMenu\('SYSTEM_SETTING'\)/)
  }
})

run('admin employee management API paths still resolve to SYSTEM_SETTING permissions', () => {
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account'), 'SYSTEM_SETTING')
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account/upload'), 'SYSTEM_SETTING')
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account/template'), 'SYSTEM_SETTING')
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account/departments'), 'SYSTEM_SETTING')
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account/evaluators'), 'SYSTEM_SETTING')
})

run('admin org and evaluator panels expose staged banner and exclusion copy in source', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8'
  )
  const evaluatorPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/EvaluatorAssignmentAdminPanel.tsx'),
    'utf8'
  )
  const orgMemberPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/OrgMemberManagementPanel.tsx'),
    'utf8'
  )

  assert.match(registrationClientSource, /EvaluatorAssignmentAdminPanel/)
  assert.match(registrationClientSource, /OrgMemberManagementPanel/)
  assert.match(evaluatorPanelSource, /before/)
  assert.match(evaluatorPanelSource, /after/)
  assert.match(orgMemberPanelSource, /하위 조직 포함/)
  assert.match(orgMemberPanelSource, /이 조직의 리더를 평가 권한 자동 지정 대상에서 제외/)
  assert.match(orgMemberPanelSource, /collectChildDepartmentIds/)
  assert.match(orgMemberPanelSource, /visibleEmployees/)
  assert.match(orgMemberPanelSource, /구성원 엑셀 다운로드/)
})

run('google login lookup still uses gwsEmail with minimal auth select and ACTIVE status regression guard', () => {
  const authSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8')
  const authFlowSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth-flow.ts'), 'utf8')

  assert.match(authSource, /findAuthEmployee\(\{ gwsEmail: normalizedEmail \}\)/)
  assert.match(authSource, /const authEmployeeSelect = \{/)
  assert.match(authSource, /select: authEmployeeSelect/)
  assert.match(authFlowSource, /params\.employeeStatus !== 'ACTIVE'/)
})

run('legacy JSON bulk and preview routes are removed from the evaluation module search path', () => {
  const routeDir = path.resolve(
    process.cwd(),
    'src/app/api/admin/employees/google-account'
  )
  const routeListing = readFileSync(path.resolve(routeDir, 'route.ts'), 'utf8')
  assert.doesNotMatch(routeListing, /\/api\/admin\/employees\/google-account\/bulk/)
  assert.doesNotMatch(routeListing, /\/api\/admin\/employees\/google-account\/preview/)
})

run('master login tab exposes HR admin permission controls and directory permission fields', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8'
  )
  const masterLoginPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/MasterLoginAdminPanel.tsx'),
    'utf8'
  )
  const serverSource = readFileSync(
    path.resolve(process.cwd(), 'src/server/admin/google-account-management.ts'),
    'utf8'
  )

  assert.match(registrationClientSource, /MasterLoginAdminPanel/)
  assert.match(registrationClientSource, /onRefresh=\{refreshQueries\}/)

  assert.match(masterLoginPanelSource, /master/i)
  assert.match(masterLoginPanelSource, /permission/i)
  assert.match(masterLoginPanelSource, /type="checkbox"/)
  assert.match(masterLoginPanelSource, /masterLoginPermissionGranted/)
  assert.match(masterLoginPanelSource, /resolveMasterLoginPermissionToggleState/)
  assert.match(masterLoginPanelSource, /title=\{toggleState\.message \?\? undefined\}/)
  assert.match(masterLoginPanelSource, /toggle/i)

  assert.match(serverSource, /masterLoginPermissionGranted/)
  assert.match(serverSource, /masterLoginAccessSource/)
  assert.match(serverSource, /masterLoginAvailable/)
})

run('admin google access tab parser keeps org-chart and clears invalid fallback', () => {
  assert.equal(resolveAdminGoogleAccessTab('org-chart'), 'org-chart')
  assert.equal(resolveAdminGoogleAccessTab('manage'), 'manage')
  assert.equal(resolveAdminGoogleAccessTab('unknown'), 'manage')
  assert.equal(resolveAdminGoogleAccessTab(null), 'manage')
})

run('admin google access href builder keeps org-chart tab and department filter only when relevant', () => {
  assert.equal(
    buildAdminGoogleAccessHref('org-chart', { departmentId: 'dept-1' }),
    '/admin/google-access?tab=org-chart&departmentId=dept-1'
  )
  assert.equal(
    buildAdminGoogleAccessHref('manage', {
      search: 'Hong',
      status: 'ACTIVE',
      departmentId: 'dept-1',
    }),
    '/admin/google-access?tab=manage&q=Hong&status=ACTIVE&departmentId=dept-1'
  )
  assert.equal(buildAdminGoogleAccessHref('upload', { departmentId: 'dept-1' }), '/admin/google-access?tab=upload')
})

run('sidebar active state separates org-chart from google access management tabs', () => {
  const sidebarSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'),
    'utf8'
  )

  assert.equal(
    isNavigationHrefActive(buildAdminGoogleAccessHref('org-chart'), '/admin/google-access', 'org-chart'),
    true
  )
  assert.equal(
    isNavigationHrefActive(
      buildAdminGoogleAccessHref('org-chart', { departmentId: 'dept-1' }),
      '/admin/google-access',
      'org-chart'
    ),
    true
  )
  assert.equal(isNavigationHrefActive('/admin/google-access', '/admin/google-access', 'org-chart'), false)
  assert.equal(isNavigationHrefActive('/admin/google-access', '/admin/google-access', 'manage'), true)
  assert.equal(isNavigationHrefActive('/admin/google-access', '/admin/google-access', 'master-login'), true)
  assert.equal(
    isNavigationHrefActive(buildAdminGoogleAccessHref('org-chart'), '/admin/org-chart', null),
    true
  )
  assert.match(sidebarSource, /useSearchParams/)
  assert.match(sidebarSource, /const currentTab = searchParams\.get\('tab'\)/)
  assert.match(sidebarSource, /isNavigationHrefActive\(child\.href, pathname, currentTab\)/)
})

run('admin google access page renders a dedicated org-chart screen for tab=org-chart', () => {
  const googleAccessPageSource = readFileSync(
    path.resolve(process.cwd(), 'src/app/(main)/admin/google-access/page.tsx'),
    'utf8'
  )
  const orgChartScreenSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/AdminOrgChartScreen.tsx'),
    'utf8'
  )
  const orgChartClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/AdminOrgChartManagementClient.tsx'),
    'utf8'
  )

  assert.match(googleAccessPageSource, /resolveAdminGoogleAccessTab/)
  assert.match(googleAccessPageSource, /if \(activeTab === 'org-chart'\)/)
  assert.match(googleAccessPageSource, /<AdminOrgChartScreen/)
  assert.match(googleAccessPageSource, /<GoogleAccountRegistrationClient \/>/)
  assert.match(googleAccessPageSource, /resolvedSearchParams\.departmentId/)

  assert.match(orgChartScreenSource, /export async function AdminOrgChartScreen/)
  assert.match(orgChartScreenSource, /loadEmployeeDirectory/)
  assert.match(orgChartScreenSource, /fetchEmployeeOrgChart/)
  assert.match(orgChartScreenSource, /AdminOrgChartManagementClient/)
  assert.match(orgChartClientSource, /OrgMemberManagementPanel/)
  assert.match(orgChartClientSource, /buildAdminGoogleAccessHref\('upload'\)/)
  assert.match(orgChartClientSource, /queryKey: \['admin-google-account-org-chart'/)
  assert.match(orgChartClientSource, /invalidateQueries/)
})

run('org member management shows returned departments without employee or leader filtering', () => {
  const orgMemberPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/OrgMemberManagementPanel.tsx'),
    'utf8'
  )
  const orgChartClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/AdminOrgChartManagementClient.tsx'),
    'utf8'
  )

  assert.match(orgMemberPanelSource, /childrenByParentId\.get\(null\)/)
  assert.doesNotMatch(orgMemberPanelSource, /departments\.filter\([^)]*memberCount\s*>\s*0/)
  assert.match(orgMemberPanelSource, /리더 미지정/)
  assert.match(orgChartClientSource, /divisionCount/)
  assert.match(orgChartClientSource, /sectionCount/)
  assert.match(orgChartClientSource, /teamCount/)
  assert.match(orgChartClientSource, /오류 \{latestUpload\.failedCount\}행은 적용되지 않았습니다/)
})

run('org member management explains descendant member scope for selected divisions', () => {
  const orgMemberPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/OrgMemberManagementPanel.tsx'),
    'utf8'
  )
  const orgChartClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/AdminOrgChartManagementClient.tsx'),
    'utf8'
  )
  const orgChartRouteSource = readFileSync(
    path.resolve(process.cwd(), 'src/app/api/admin/employees/google-account/org-chart/route.ts'),
    'utf8'
  )
  const serverSource = readFileSync(
    path.resolve(process.cwd(), 'src/server/admin/google-account-management.ts'),
    'utf8'
  )

  assert.match(orgMemberPanelSource, /직접 소속 구성원은 없고, 하위 팀에 구성원이 있습니다/)
  assert.match(orgMemberPanelSource, /직접 소속만 표시 중/)
  assert.match(orgMemberPanelSource, /하위 구성원까지 표시 중/)
  assert.match(orgMemberPanelSource, /selectedDescendantMemberCount/)
  assert.match(orgMemberPanelSource, /selectedDescendantTeamCount/)
  assert.match(orgChartClientSource, /includeChildDepartments/)
  assert.match(orgChartClientSource, /includeDescendants/)
  assert.match(orgChartRouteSource, /includeDescendants/)
  assert.match(serverSource, /collectDepartmentAndDescendantIds/)
  assert.match(serverSource, /requestedDepartmentIds/)
})

run('org member management renders duplicate department names with full paths', () => {
  const orgMemberPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/OrgMemberManagementPanel.tsx'),
    'utf8'
  )

  assert.match(orgMemberPanelSource, /hasDuplicateName/)
  assert.match(orgMemberPanelSource, /경로: \{props\.node\.path\.join\(' > '\)\}/)
  assert.match(orgMemberPanelSource, /상위 조직과 같은 이름/)
})

run('org-chart entry points resolve to the org-chart tab instead of falling back to manage', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8'
  )
  const navigationSource = readFileSync(path.resolve(process.cwd(), 'src/lib/navigation.ts'), 'utf8')
  const calendarSource = readFileSync(
    path.resolve(process.cwd(), 'src/server/admin/performance-calendar.ts'),
    'utf8'
  )
  const orgChartPageSource = readFileSync(
    path.resolve(process.cwd(), 'src/app/(main)/admin/org-chart/page.tsx'),
    'utf8'
  )

  assert.match(registrationClientSource, /resolveAdminGoogleAccessTab\(searchParams\.get\('tab'\)\)/)
  assert.match(registrationClientSource, /buildAdminGoogleAccessHref\(nextTab/)
  assert.doesNotMatch(registrationClientSource, /applyTab\('manage', employee\.departmentId\)/)
  assert.doesNotMatch(navigationSource, /buildAdminGoogleAccessHref\('org-chart'\)/) // 사이드바 정리(2026-07)로 nav 진입점 의도 제거 — 재유입 방지 가드
  assert.match(calendarSource, /buildAdminGoogleAccessHref\('org-chart'\)/)
  assert.match(orgChartPageSource, /buildAdminGoogleAccessHref\('org-chart'\)/)
})

run('single employee create mode stays available in manage tab and uses the POST create path', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8'
  )
  const routeSource = readFileSync(
    path.resolve(process.cwd(), 'src/app/api/admin/employees/google-account/route.ts'),
    'utf8'
  )
  const serverSource = readFileSync(
    path.resolve(process.cwd(), 'src/server/admin/google-account-management.ts'),
    'utf8'
  )

  assert.match(registrationClientSource, /const beginCreateMode = \(\) => \{/)
  assert.match(registrationClientSource, /onClick=\{beginCreateMode\}/)
  assert.match(registrationClientSource, /method: editingEmployeeId \? 'PUT' : 'POST'/)
  assert.match(registrationClientSource, /buildDirectorySnapshotAfterCreate/)
  assert.match(registrationClientSource, /queryClient\.setQueryData<EmployeeDirectoryResponse \| undefined>\(\s*\['admin-google-account-directory', querySuffix\]/)

  assert.match(routeSource, /export async function POST\(request: Request\)/)
  assert.match(routeSource, /CreateAdminEmployeeSchema\.safeParse\(body\)/)
  assert.match(routeSource, /await upsertEmployeeRecord\(/)
  assert.match(routeSource, /action: 'EMPLOYEE_MANUAL_CREATE'/)

  assert.match(serverSource, /await prisma\.employee\.create\(\{/)
  assert.match(serverSource, /EMPLOYEE_NUMBER_ALREADY_EXISTS/)
  assert.match(serverSource, /GOOGLE_EMAIL_ALREADY_ASSIGNED/)
})

run('employee registration form uses hierarchy selectors and removes low-value single-form fields', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8',
  )
  const validationSource = readFileSync(
    path.resolve(process.cwd(), 'src/lib/validations.ts'),
    'utf8',
  )
  const routeSource = readFileSync(
    path.resolve(process.cwd(), 'src/app/api/admin/employees/google-account/route.ts'),
    'utf8',
  )

  assert.match(registrationClientSource, /buildDepartmentSelectionState/)
  assert.match(registrationClientSource, /handleDivisionDepartmentChange/)
  assert.match(registrationClientSource, /handleSectionDepartmentChange/)
  assert.match(registrationClientSource, /handleTeamDepartmentChange/)
  assert.match(registrationClientSource, /departmentSelection\.selectedSectionId/)
  assert.doesNotMatch(registrationClientSource, /form\.joinDate/)
  assert.doesNotMatch(registrationClientSource, /form\.resignationDate/)
  assert.doesNotMatch(registrationClientSource, /form\.sortOrder/)
  assert.doesNotMatch(routeSource, /sortOrder: validated\.data\.sortOrder \?\? null/)
  assert.doesNotMatch(
    validationSource,
    /managerEmployeeNumber: EmptyStringToUndefined\(z\.string\(\)\.max\(50\)\),\s*sortOrder: SortOrderSchema,/
  )
})

run('admin employee save path syncs section leader authority through real department leadership', () => {
  const serverSource = readFileSync(
    path.resolve(process.cwd(), 'src/server/admin/google-account-management.ts'),
    'utf8',
  )

  assert.match(serverSource, /syncSectionLeaderDepartment/)
  assert.match(serverSource, /reconcileLegacySectionDepartments/)
  assert.match(serverSource, /reconcileLegacyTeamDepartments/)
  assert.match(serverSource, /buildGeneratedTeamDepartmentCode/)
  assert.match(serverSource, /findOrCreateChildDepartment/)
  assert.match(serverSource, /looksLikeLegacySectionName/)
  assert.match(serverSource, /looksLikeLegacyTeamName/)
  assert.match(serverSource, /async function syncSectionLeaderDepartment[\s\S]*deptName\?: string \| null/)
  assert.match(serverSource, /syncSectionLeaderDepartment[\s\S]*deptName: true/)
  assert.match(serverSource, /teamName: null/)
  assert.match(serverSource, /leaderEmployeeId: params\.employeeId|leaderEmployeeId: employeeId/)
  assert.match(serverSource, /SECTION_CHIEF_SCOPE_INVALID/)
})

run('admin employee position displays resolve personal leadership titles', () => {
  const registrationClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/GoogleAccountRegistrationClient.tsx'),
    'utf8',
  )
  const orgChartClientSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/AdminOrgChartManagementClient.tsx'),
    'utf8',
  )
  const orgMemberPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/OrgMemberManagementPanel.tsx'),
    'utf8',
  )
  const masterLoginPanelSource = readFileSync(
    path.resolve(process.cwd(), 'src/components/admin/MasterLoginAdminPanel.tsx'),
    'utf8',
  )

  assert.equal(
    resolveEmployeePositionLabel({ role: 'ROLE_TEAM_LEADER', position: 'MEMBER', jobTitle: '팀원' }),
    '팀장',
  )
  assert.equal(resolveEmployeePositionLabel({ role: 'ROLE_SECTION_CHIEF', position: 'MEMBER' }), '실장')
  assert.equal(resolveEmployeePositionLabel({ role: 'ROLE_DIV_HEAD', position: 'MEMBER' }), '본부장')
  assert.equal(resolveEmployeePositionLabel({ role: 'ROLE_MEMBER', position: 'MEMBER' }), '팀원')

  assert.equal(
    registrationClientSource.includes(
      'resolveEmployeePositionLabel({ role: employee.role, jobTitle: employee.jobTitle })',
    ),
    true,
  )
  assert.equal(
    registrationClientSource.includes(
      'resolveEmployeePositionLabel({ role: node.employee.role, jobTitle: node.employee.jobTitle })',
    ),
    true,
  )
  assert.equal(
    orgChartClientSource.includes(
      'resolveEmployeePositionLabel({ role: node.employee.role, jobTitle: node.employee.jobTitle })',
    ),
    true,
  )
  assert.equal(
    orgMemberPanelSource.includes(
      'resolveEmployeePositionLabel({ role: employee.role, jobTitle: employee.jobTitle })',
    ),
    true,
  )
  assert.equal(
    masterLoginPanelSource.includes(
      'resolveEmployeePositionLabel({ role: employee.role, jobTitle: employee.jobTitle })',
    ),
    true,
  )
})

console.log('Google account management tests completed')

