/* eslint-disable @typescript-eslint/no-require-imports */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { resolveMenuFromPath } from '../src/lib/auth/permissions'
import {
  AdminEmployeeLifecycleActionSchema,
  CreateAdminEmployeeSchema,
  UpdateGoogleAccountEmployeeSchema,
} from '../src/lib/validations'

process.env.ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'rsupport.com'
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/kpi_pms_test'

const {
  EMPLOYEE_UPLOAD_TEMPLATE_HEADERS,
  buildEmployeeOrgChart,
  buildEmployeeTemplateWorkbook,
  parseEmployeeUploadWorkbook,
  validateEmployeeUploadRows,
} = require('../src/server/admin/google-account-management') as typeof import('../src/server/admin/google-account-management')

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
    name: '관리자',
    googleEmail: 'manager@rsupport.com',
    status: 'ACTIVE' as const,
    managerId: null,
    managerEmployeeNumber: null,
  },
  {
    id: 'emp-1',
    employeeNumber: 'E-1001',
    name: '기존직원',
    googleEmail: 'member1@rsupport.com',
    status: 'ACTIVE' as const,
    managerId: 'mgr-1',
    managerEmployeeNumber: 'E-1000',
  },
]

const existingDepartments = [{ id: 'dept-1', deptCode: 'HR', deptName: '인사팀' }]

function buildWorkbookBuffer(rows: Array<Record<string, unknown>>) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function validateRows(rows: Array<Record<string, unknown>>) {
  const workbook = parseEmployeeUploadWorkbook('employees.xlsx', buildWorkbookBuffer(rows))
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
  assert.deepEqual(rows[0], EMPLOYEE_UPLOAD_TEMPLATE_HEADERS)
})

run('valid upload row passes preview validation', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-2000',
      name: '신규직원',
      googleEmail: 'new.member@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      managerEmployeeNumber: 'E-1000',
      joinDate: '2025-01-10',
    },
  ])

  assert.equal(result.summary.validRows, 1)
  assert.equal(result.rows[0]?.valid, true)
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
      name: '직원A',
      googleEmail: 'a@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
    {
      employeeNumber: 'E-3000',
      name: '직원B',
      googleEmail: 'b@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.match(result.errors[0]?.message ?? '', /사번/)
})

run('duplicate google emails inside the file are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3001',
      name: '직원A',
      googleEmail: 'dup@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
    {
      employeeNumber: 'E-3002',
      name: '직원B',
      googleEmail: 'dup@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
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
      name: '기존직원수정',
      googleEmail: 'member1@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
    },
  ])

  assert.equal(result.rows[0]?.action, 'update')
  assert.equal(result.summary.updateCount, 1)
})

run('inactive and resigned statuses are accepted while active with resignation date fails', () => {
  const inactive = validateRows([
    {
      employeeNumber: 'E-3100',
      name: '비활성직원',
      googleEmail: 'inactive@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'INACTIVE',
    },
  ])
  const activeWithResignation = validateRows([
    {
      employeeNumber: 'E-3101',
      name: '오류직원',
      googleEmail: 'active-with-end@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      resignationDate: '2025-12-31',
    },
  ])

  assert.equal(inactive.summary.validRows, 1)
  assert.equal(activeWithResignation.summary.validRows, 0)
})

run('missing manager references are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3200',
      name: '직원',
      googleEmail: 'member3200@rsupport.com',
      departmentCode: 'HR',
      department: '인사팀',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      managerEmployeeNumber: 'NOPE-1',
    },
  ])

  assert.equal(result.summary.validRows, 0)
  assert.ok(result.errors.some((error) => error.field === 'managerEmployeeNumber'))
})

run('non-company email domains are rejected', () => {
  const result = validateRows([
    {
      employeeNumber: 'E-3300',
      name: '외부메일',
      googleEmail: 'user@gmail.com',
      departmentCode: 'HR',
      department: '인사팀',
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
    name: '단건등록',
    gwsEmail: 'create@rsupport.com',
    deptId: 'dept-1',
    teamName: '채용',
    jobTitle: '매니저',
    role: 'ROLE_MEMBER',
    employmentStatus: 'ACTIVE',
    managerEmployeeNumber: 'E-1000',
    joinDate: '2025-01-01',
    sortOrder: 1,
    notes: '메모',
  })

  assert.equal(parsed.success, true)
})

run('single edit schema requires employeeId and accepts updates', () => {
  const parsed = UpdateGoogleAccountEmployeeSchema.safeParse({
    employeeId: 'emp-1',
    employeeNumber: 'E-1001',
    name: '수정직원',
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

run('org chart builder returns nested hierarchy for manager relationships', () => {
  const chart = buildEmployeeOrgChart([
    {
      id: 'mgr-1',
      employeeNumber: 'E-1000',
      name: '관리자',
      googleEmail: 'manager@rsupport.com',
      departmentName: '인사팀',
      departmentCode: 'HR',
      teamName: null,
      jobTitle: '팀장',
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
      name: '구성원',
      googleEmail: 'member1@rsupport.com',
      departmentName: '인사팀',
      departmentCode: 'HR',
      teamName: '채용',
      jobTitle: '사원',
      role: 'ROLE_MEMBER',
      employmentStatus: 'ACTIVE',
      joinDate: '2024-01-01',
      resignationDate: null,
      managerId: 'mgr-1',
      managerEmployeeNumber: 'E-1000',
      managerName: '관리자',
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
      name: '관리자없음',
      googleEmail: 'orphan@rsupport.com',
      departmentName: '인사팀',
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

run('org chart summary counts resigned employees separately', () => {
  const chart = buildEmployeeOrgChart([
    {
      id: 'emp-r',
      employeeNumber: 'E-5100',
      name: '퇴사자',
      googleEmail: 'resigned@rsupport.com',
      departmentName: '인사팀',
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
  ].map((file) => readFileSync(path.resolve(process.cwd(), file), 'utf8'))

  for (const source of routeSources) {
    assert.match(source, /authorizeMenu\('SYSTEM_SETTING'\)/)
  }
})

run('admin employee management API paths still resolve to SYSTEM_SETTING permissions', () => {
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account'), 'SYSTEM_SETTING')
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account/upload'), 'SYSTEM_SETTING')
  assert.equal(resolveMenuFromPath('/api/admin/employees/google-account/template'), 'SYSTEM_SETTING')
})

run('google login lookup still uses gwsEmail and ACTIVE status regression guard', () => {
  const authSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth.ts'), 'utf8')
  const authFlowSource = readFileSync(path.resolve(process.cwd(), 'src/lib/auth-flow.ts'), 'utf8')

  assert.match(authSource, /where: \{ gwsEmail: normalizedEmail \}/)
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

console.log('Google account management tests completed')
