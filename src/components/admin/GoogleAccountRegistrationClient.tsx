'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_LABELS, ROLE_LABELS } from '@/lib/utils'

type EmployeeRole =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'

type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'

type EmployeeListItem = {
  id: string
  empId: string
  empName: string
  role: EmployeeRole
  status: EmployeeStatus
  deptId: string
  deptCode: string
  deptName: string
  gwsEmail: string
  joinDate: string
}

type DepartmentOption = {
  id: string
  deptCode: string
  deptName: string
}

type EmployeeDirectoryResponse = {
  allowedDomain: string
  departments: DepartmentOption[]
  uploadHistory: Array<{
    id: string
    fileName: string
    totalRows: number
    createdCount: number
    updatedCount: number
    failedCount: number
    hierarchyUpdatedCount: number
    userId: string
    timestamp: string
  }>
  employees: EmployeeListItem[]
}

type UpdateGoogleAccountResponse = {
  employee: EmployeeListItem
  allowedDomain: string
  loginReady: boolean
  hierarchyUpdatedCount: number
}

type BulkUploadResponse = {
  fileName: string
  totalRows: number
  createdDepartmentCount: number
  createdCount: number
  updatedCount: number
  failedCount: number
  hierarchyUpdatedCount: number
  errors: Array<{
    rowNumber: number
    empId?: string
    empName?: string
    message: string
  }>
}

type HierarchyPreviewResponse = {
  contextLabel: string
  summary: {
    changedEmployeeCount: number
    teamLeaderChangedCount: number
    sectionChiefChangedCount: number
    divisionHeadChangedCount: number
  }
  changedEmployees: Array<{
    employeeId: string
    empId: string
    empName: string
    deptName: string
    role: EmployeeRole
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
  }>
}

type EmployeeDraft = {
  gwsEmail: string
  role: EmployeeRole
  deptId: string
  status: EmployeeStatus
}

type ManualEmployeeForm = {
  empId: string
  empName: string
  deptId: string
  role: EmployeeRole
  status: EmployeeStatus
  gwsEmail: string
  joinDate: string
}

type BulkRowPreview = {
  empId: string
  empName: string
  deptCode: string
  deptName: string
  parentDeptCode: string
  role: EmployeeRole
  status: EmployeeStatus
  gwsEmail: string
  joinDate: string
}

type FeedbackState =
  | {
      type: 'success' | 'error'
      message: string
    }
  | null

const ROLE_OPTIONS: EmployeeRole[] = [
  'ROLE_MEMBER',
  'ROLE_TEAM_LEADER',
  'ROLE_SECTION_CHIEF',
  'ROLE_DIV_HEAD',
  'ROLE_CEO',
  'ROLE_ADMIN',
]

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: '재직',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴사',
}

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }

  return payload.data as T
}

function normalizeRoleValue(value: unknown): EmployeeRole | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()

  const map: Record<string, EmployeeRole> = {
    ROLE_MEMBER: 'ROLE_MEMBER',
    MEMBER: 'ROLE_MEMBER',
    구성원: 'ROLE_MEMBER',
    ROLE_TEAM_LEADER: 'ROLE_TEAM_LEADER',
    TEAM_LEADER: 'ROLE_TEAM_LEADER',
    팀장: 'ROLE_TEAM_LEADER',
    ROLE_SECTION_CHIEF: 'ROLE_SECTION_CHIEF',
    SECTION_CHIEF: 'ROLE_SECTION_CHIEF',
    SECTIONCHIEF: 'ROLE_SECTION_CHIEF',
    부서장: 'ROLE_SECTION_CHIEF',
    실장: 'ROLE_SECTION_CHIEF',
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

  return map[normalized] ?? null
}

function normalizeStatusValue(value: unknown): EmployeeStatus | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()

  const map: Record<string, EmployeeStatus> = {
    ACTIVE: 'ACTIVE',
    재직: 'ACTIVE',
    ON_LEAVE: 'ON_LEAVE',
    ONLEAVE: 'ON_LEAVE',
    휴직: 'ON_LEAVE',
    RESIGNED: 'RESIGNED',
    퇴사: 'RESIGNED',
  }

  return map[normalized] ?? null
}

function getSpreadsheetValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = row[key]
    if (direct !== undefined && String(direct).trim() !== '') {
      return direct
    }
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.replace(/\s+/g, '').toLowerCase(),
    value,
  ])

  for (const key of keys) {
    const normalizedKey = key.replace(/\s+/g, '').toLowerCase()
    const match = normalizedEntries.find(([entryKey]) => entryKey === normalizedKey)
    if (match && String(match[1]).trim() !== '') {
      return match[1]
    }
  }

  return ''
}

export function GoogleAccountRegistrationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('q')?.trim() ?? ''
  const targetEmployeeId = searchParams.get('employeeId')?.trim() ?? ''
  const returnTo = searchParams.get('returnTo')?.trim() ?? ''
  const queryClient = useQueryClient()
  const [search, setSearch] = useState(initialSearch)
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [showReturnAction, setShowReturnAction] = useState(false)
  const [focusedEmployeeId, setFocusedEmployeeId] = useState(targetEmployeeId)
  const [editingEmployeeId, setEditingEmployeeId] = useState(targetEmployeeId)
  const [drafts, setDrafts] = useState<Record<string, EmployeeDraft>>({})
  const [bulkRows, setBulkRows] = useState<BulkRowPreview[]>([])
  const [bulkSummary, setBulkSummary] = useState<BulkUploadResponse | null>(null)
  const [bulkFileName, setBulkFileName] = useState('')
  const [hierarchyPreview, setHierarchyPreview] = useState<HierarchyPreviewResponse | null>(null)
  const [manualForm, setManualForm] = useState<ManualEmployeeForm>({
    empId: '',
    empName: '',
    deptId: '',
    role: 'ROLE_MEMBER',
    status: 'ACTIVE',
    gwsEmail: '',
    joinDate: getTodayString(),
  })

  const employeesQuery = useQuery({
    queryKey: ['admin-google-account-directory', submittedSearch],
    queryFn: async () => {
      const query = submittedSearch ? `?q=${encodeURIComponent(submittedSearch)}` : ''
      const res = await fetch(`/api/admin/employees/google-account${query}`)
      return parseResponse<EmployeeDirectoryResponse>(await res.json())
    },
  })

  const createMutation = useMutation({
    mutationFn: async (input: ManualEmployeeForm) => {
      const res = await fetch('/api/admin/employees/google-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      return parseResponse<UpdateGoogleAccountResponse>(await res.json())
    },
    onSuccess: (data) => {
      setHierarchyPreview(null)
      setShowReturnAction(false)
      setFeedback({
        type: 'success',
        message: `${data.employee.empName}(${data.employee.empId}) 직원을 등록했습니다. 조직장 체계 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
      })
      setManualForm((current) => ({
        ...current,
        empId: '',
        empName: '',
        role: 'ROLE_MEMBER',
        status: 'ACTIVE',
        gwsEmail: '',
        joinDate: getTodayString(),
      }))
      queryClient.invalidateQueries({ queryKey: ['admin-google-account-directory'] })
    },
    onError: (error: Error) => {
      setShowReturnAction(false)
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: {
      employeeId: string
      gwsEmail: string
      role: EmployeeRole
      deptId: string
      status: EmployeeStatus
    }) => {
      const res = await fetch('/api/admin/employees/google-account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      return parseResponse<UpdateGoogleAccountResponse>(await res.json())
    },
    onSuccess: (data) => {
      setHierarchyPreview(null)
      setShowReturnAction(Boolean(returnTo))
      setFeedback({
        type: 'success',
        message: `${data.employee.empName} 직원 정보를 저장했습니다. 조직장 체계 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
      })
      setDrafts((current) => ({
        ...current,
        [data.employee.id]: {
          gwsEmail: data.employee.gwsEmail,
          role: data.employee.role,
          deptId: data.employee.deptId,
          status: data.employee.status,
        },
      }))
      queryClient.invalidateQueries({ queryKey: ['admin-google-account-directory'] })
    },
    onError: (error: Error) => {
      setShowReturnAction(false)
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: async (input: { fileName: string; rows: BulkRowPreview[] }) => {
      const res = await fetch('/api/admin/employees/google-account/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      return parseResponse<BulkUploadResponse>(await res.json())
    },
    onSuccess: (data) => {
      setHierarchyPreview(null)
      setShowReturnAction(false)
      setBulkSummary(data)
      setFeedback({
        type: data.failedCount > 0 ? 'error' : 'success',
        message:
          data.failedCount > 0
            ? `일괄 업데이트를 완료했지만 ${data.failedCount}건은 실패했습니다. 조직장 체계는 ${data.hierarchyUpdatedCount}건 다시 계산했습니다.`
            : `${data.totalRows}건의 직원을 일괄 반영했습니다. 조직장 체계 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
      })
      queryClient.invalidateQueries({ queryKey: ['admin-google-account-directory'] })
    },
    onError: (error: Error) => {
      setShowReturnAction(false)
      setFeedback({ type: 'error', message: error.message })
      setBulkSummary(null)
    },
  })

  const previewMutation = useMutation({
    mutationFn: async (input: {
      contextLabel: string
      updates?: Array<{
        id: string
        empId: string
        empName: string
        deptId: string
        role: EmployeeRole
        status: EmployeeStatus
        joinDate: string
      }>
      creates?: Array<{
        empId: string
        empName: string
        deptId: string
        role: EmployeeRole
        status: EmployeeStatus
        joinDate: string
      }>
    }) => {
      const res = await fetch('/api/admin/employees/google-account/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      return parseResponse<HierarchyPreviewResponse>(await res.json())
    },
    onSuccess: (data) => {
      setHierarchyPreview(data)
      setShowReturnAction(false)
      setFeedback({
        type: 'success',
        message: `${data.contextLabel} 결과를 불러왔습니다. 변경 대상 ${data.summary.changedEmployeeCount}건입니다.`,
      })
    },
    onError: (error: Error) => {
      setShowReturnAction(false)
      setHierarchyPreview(null)
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const employees = useMemo(() => employeesQuery.data?.employees ?? [], [employeesQuery.data?.employees])
  const departments = useMemo(
    () => employeesQuery.data?.departments ?? [],
    [employeesQuery.data?.departments]
  )
  const uploadHistory = useMemo(
    () => employeesQuery.data?.uploadHistory ?? [],
    [employeesQuery.data?.uploadHistory]
  )
  const allowedDomain = employeesQuery.data?.allowedDomain ?? 'rsupport.com'
  const savingId = useMemo(
    () => (updateMutation.variables ? updateMutation.variables.employeeId : null),
    [updateMutation.variables]
  )

  const previewRows = bulkRows.slice(0, 8)
  const departmentIdByCode = useMemo(
    () =>
      new Map(
        departments.map((department) => [department.deptCode.trim().toUpperCase(), department.id] as const)
      ),
    [departments]
  )
  const employeeByEmpId = useMemo(
    () => new Map(employees.map((employee) => [employee.empId, employee] as const)),
    [employees]
  )

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch)
      setSubmittedSearch(initialSearch)
    }
    if (targetEmployeeId) {
      setFocusedEmployeeId(targetEmployeeId)
      setEditingEmployeeId(targetEmployeeId)
    }
  }, [initialSearch, targetEmployeeId])

  useEffect(() => {
    if (!focusedEmployeeId || employees.length === 0) {
      return
    }

    const targetElement = document.getElementById(`employee-${focusedEmployeeId}`)
    if (!targetElement) {
      return
    }

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focusedEmployeeId, employees])

  useEffect(() => {
    if (!editingEmployeeId) {
      return
    }

    const focusTarget = window.setTimeout(() => {
      const input = document.getElementById(`employee-email-${editingEmployeeId}`) as HTMLInputElement | null
      input?.focus()
    }, 150)

    return () => window.clearTimeout(focusTarget)
  }, [editingEmployeeId, employees])

  function handlePreviewReset() {
    setHierarchyPreview(null)
  }

  async function handleTemplateDownload() {
    const XLSX = await import('xlsx')
    const employeeRows = [
      {
        empId: 'E2026001',
        empName: '홍길동',
        deptCode: 'HR',
        deptName: '인사팀',
        parentDeptCode: '',
        role: 'ROLE_MEMBER',
        status: 'ACTIVE',
        gwsEmail: `hong.gildong@${allowedDomain}`,
        joinDate: getTodayString(),
      },
      {
        empId: 'E2026002',
        empName: '김팀장',
        deptCode: 'HR',
        deptName: '인사팀',
        parentDeptCode: '',
        role: 'ROLE_TEAM_LEADER',
        status: 'ACTIVE',
        gwsEmail: `kim.leader@${allowedDomain}`,
        joinDate: getTodayString(),
      },
    ]
    const guideRows = [
      {
        item: '작성 시트',
        value: 'employees',
        description: '이 시트에 직원 정보를 입력한 뒤 그대로 업로드하세요.',
      },
      {
        item: '필수 컬럼',
        value: 'empId, empName, deptCode, deptName, role, status, gwsEmail, joinDate',
        description: '컬럼명은 그대로 유지해주세요.',
      },
      {
        item: '신규 부서 생성',
        value: 'deptName, parentDeptCode',
        description: 'deptCode가 없으면 새 부서를 만들고, parentDeptCode가 있으면 상위 부서로 연결합니다.',
      },
      {
        item: 'role 허용값',
        value:
          'ROLE_MEMBER, ROLE_TEAM_LEADER, ROLE_SECTION_CHIEF, ROLE_DIV_HEAD, ROLE_CEO, ROLE_ADMIN',
        description: '한국어 역할명도 업로드에서 읽을 수 있지만 템플릿 값 사용을 권장합니다.',
      },
      {
        item: 'status 허용값',
        value: 'ACTIVE, ON_LEAVE, RESIGNED',
        description: '재직, 휴직, 퇴사도 허용되지만 enum 값 사용을 권장합니다.',
      },
      {
        item: 'deptCode',
        value: 'departments 시트 참고',
        description: '반드시 현재 등록된 부서코드를 사용해야 조직도에 자동 반영됩니다.',
      },
      {
        item: 'joinDate 형식',
        value: 'YYYY-MM-DD',
        description: '예: 2026-03-19',
      },
    ]
    const departmentRows = departments.map((department) => ({
      deptCode: department.deptCode,
      deptName: department.deptName,
    }))

    const employeeSheet = XLSX.utils.json_to_sheet(employeeRows)
    const guideSheet = XLSX.utils.json_to_sheet(guideRows)
    const departmentSheet = XLSX.utils.json_to_sheet(departmentRows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'employees')
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'guide')
    XLSX.utils.book_append_sheet(workbook, departmentSheet, 'departments')

    XLSX.writeFile(workbook, 'employee-google-access-template.xlsx')
  }

  async function handleBulkFileChange(file: File | null) {
    if (!file) {
      return
    }

    setBulkFileName(file.name)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
      })

      const mappedRows = rawRows.map((row) => {
        const role = normalizeRoleValue(
          getSpreadsheetValue(row, ['role', '역할', '권한', '직원권한'])
        )
        const status =
          normalizeStatusValue(getSpreadsheetValue(row, ['status', '상태', '재직상태'])) ?? 'ACTIVE'

        if (!role) {
          throw new Error('엑셀의 역할 컬럼 값이 올바르지 않습니다. ROLE_MEMBER 형식을 사용해주세요.')
        }

        return {
          empId: String(getSpreadsheetValue(row, ['empId', 'employeeId', '사번'])).trim(),
          empName: String(getSpreadsheetValue(row, ['empName', 'name', '이름', '직원명'])).trim(),
          deptCode: String(
            getSpreadsheetValue(row, ['deptCode', 'departmentCode', '부서코드'])
          ).trim(),
          deptName: String(getSpreadsheetValue(row, ['deptName', 'departmentName', '부서명'])).trim(),
          parentDeptCode: String(
            getSpreadsheetValue(row, ['parentDeptCode', 'upperDeptCode', '상위부서코드'])
          ).trim(),
          role,
          status,
          gwsEmail: String(
            getSpreadsheetValue(row, ['gwsEmail', 'googleEmail', 'email', '구글이메일', 'Google이메일'])
          ).trim(),
          joinDate:
            String(getSpreadsheetValue(row, ['joinDate', '입사일', '입사일자'])).trim() ||
            getTodayString(),
        } satisfies BulkRowPreview
      })

      setBulkRows(mappedRows)
      setBulkSummary(null)
      setHierarchyPreview(null)
      setFeedback({
        type: 'success',
        message: `${mappedRows.length}건의 업로드 미리보기를 불러왔습니다.`,
      })
    } catch (error) {
      setBulkRows([])
      setBulkSummary(null)
      setBulkFileName('')
      setHierarchyPreview(null)
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '엑셀 파일을 읽는 중 오류가 발생했습니다.',
      })
    }
  }

  function handleManualPreview() {
    if (!manualForm.empId || !manualForm.empName || !manualForm.deptId) {
      setFeedback({
        type: 'error',
        message: '직접 등록 미리보기를 보려면 사번, 이름, 부서를 먼저 입력해주세요.',
      })
      return
    }

    previewMutation.mutate({
      contextLabel: '직접 등록 조직장 체계 미리보기',
      creates: [
        {
          empId: manualForm.empId,
          empName: manualForm.empName,
          deptId: manualForm.deptId,
          role: manualForm.role,
          status: manualForm.status,
          joinDate: manualForm.joinDate,
        },
      ],
    })
  }

  function handleEmployeePreview(employee: EmployeeListItem, draft: EmployeeDraft) {
    previewMutation.mutate({
      contextLabel: `${employee.empName} 조직장 체계 미리보기`,
      updates: [
        {
          id: employee.id,
          empId: employee.empId,
          empName: employee.empName,
          deptId: draft.deptId,
          role: draft.role,
          status: draft.status,
          joinDate: employee.joinDate.slice(0, 10),
        },
      ],
    })
  }

  function handleBulkPreview() {
    const updates: Array<{
      id: string
      empId: string
      empName: string
      deptId: string
      role: EmployeeRole
      status: EmployeeStatus
      joinDate: string
    }> = []
    const creates: Array<{
      empId: string
      empName: string
      deptId: string
      role: EmployeeRole
      status: EmployeeStatus
      joinDate: string
    }> = []

    for (const row of bulkRows) {
      const deptId = departmentIdByCode.get(row.deptCode.trim().toUpperCase())
      if (!deptId) {
        setFeedback({
          type: 'error',
          message: `${row.deptCode} 부서코드를 찾을 수 없어 미리보기를 만들 수 없습니다.`,
        })
        return
      }

      const existingEmployee = employeeByEmpId.get(row.empId)
      if (existingEmployee) {
        updates.push({
          id: existingEmployee.id,
          empId: row.empId,
          empName: row.empName,
          deptId,
          role: row.role,
          status: row.status,
          joinDate: row.joinDate,
        })
      } else {
        creates.push({
          empId: row.empId,
          empName: row.empName,
          deptId,
          role: row.role,
          status: row.status,
          joinDate: row.joinDate,
        })
      }
    }

    previewMutation.mutate({
      contextLabel: '엑셀 일괄 업데이트 조직장 체계 미리보기',
      updates,
      creates,
    })
  }

  async function handleFailedRowsDownload() {
    if (!bulkSummary || bulkSummary.errors.length === 0) {
      return
    }

    const XLSX = await import('xlsx')
    const failedRows = bulkSummary.errors
      .map((error) => {
        const originalRow = bulkRows[error.rowNumber - 2]
        if (!originalRow) {
          return null
        }

        return {
          ...originalRow,
          errorMessage: error.message,
        }
      })
      .filter((row): row is BulkRowPreview & { errorMessage: string } => row !== null)

    const worksheet = XLSX.utils.json_to_sheet(failedRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'failed_rows')
    XLSX.writeFile(workbook, 'employee-bulk-upload-failed-rows.xlsx')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h1 className="text-2xl font-bold text-slate-900">Google 계정 등록</h1>
        <p className="mt-2 text-sm text-slate-700">
          관리자 화면에서 직원을 직접 등록하고, Google Workspace 계정과 역할을 함께 관리할 수
          있습니다.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          허용된 도메인:
          <span className="ml-1 font-semibold text-blue-700">@{allowedDomain}</span>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          일괄업로드 후에는{' '}
          <Link href="/admin/org-chart" className="font-semibold text-blue-700 underline">
            조직도 관리
          </Link>{' '}
          에서 자동 반영 결과를 바로 확인할 수 있습니다.
        </p>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <div>{feedback.message}</div>
          {feedback.type === 'success' && showReturnAction && returnTo ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => router.push(returnTo)}
                className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700"
              >
                조직도로 돌아가기
              </button>
            </div>
          ) : null}
        </div>
      )}

      {hierarchyPreview && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-violet-900">{hierarchyPreview.contextLabel}</h2>
              <p className="mt-1 text-sm text-violet-700">
                저장 시 예상되는 조직장 체계 변경 결과입니다.
              </p>
            </div>
            <button
              onClick={handlePreviewReset}
              className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-medium text-violet-700"
            >
              닫기
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white p-3 text-sm">
              <div className="text-violet-700">변경 대상 직원</div>
              <div className="mt-1 text-lg font-semibold text-violet-900">
                {hierarchyPreview.summary.changedEmployeeCount}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 text-sm">
              <div className="text-violet-700">팀장 변경</div>
              <div className="mt-1 text-lg font-semibold text-violet-900">
                {hierarchyPreview.summary.teamLeaderChangedCount}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 text-sm">
              <div className="text-violet-700">부서장 변경</div>
              <div className="mt-1 text-lg font-semibold text-violet-900">
                {hierarchyPreview.summary.sectionChiefChangedCount}
              </div>
            </div>
            <div className="rounded-xl bg-white p-3 text-sm">
              <div className="text-violet-700">본부장 변경</div>
              <div className="mt-1 text-lg font-semibold text-violet-900">
                {hierarchyPreview.summary.divisionHeadChangedCount}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {!hierarchyPreview.changedEmployees.length && (
              <div className="rounded-xl bg-white px-4 py-5 text-sm text-slate-500">
                예상되는 조직장 체계 변경이 없습니다.
              </div>
            )}

            {hierarchyPreview.changedEmployees.slice(0, 12).map((item) => (
              <div key={item.employeeId} className="rounded-xl bg-white p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">
                  {item.empName} ({item.empId}) / {item.deptName}
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">팀장</div>
                    <div className="mt-1">
                      {item.current.teamLeaderName} → {item.next.teamLeaderName}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">부서장</div>
                    <div className="mt-1">
                      {item.current.sectionChiefName} → {item.next.sectionChiefName}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">본부장</div>
                    <div className="mt-1">
                      {item.current.divisionHeadName} → {item.next.divisionHeadName}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {hierarchyPreview.changedEmployees.length > 12 && (
              <div className="text-sm text-violet-700">
                총 {hierarchyPreview.changedEmployees.length}건 중 12건만 표시했습니다.
              </div>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">직원 직접 등록</h2>
            <p className="mt-1 text-sm text-gray-500">
              신규 직원을 직접 추가하면서 Google 이메일과 역할을 함께 부여합니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-700">사번</span>
              <input
                value={manualForm.empId}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, empId: event.target.value }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                placeholder="예: E2026001"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-700">이름</span>
              <input
                value={manualForm.empName}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, empName: event.target.value }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                placeholder="홍길동"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-700">부서</span>
              <select
                value={manualForm.deptId}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, deptId: event.target.value }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
              >
                <option value="">부서를 선택하세요</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.deptName} ({department.deptCode})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-700">Role</span>
              <select
                value={manualForm.role}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    role: event.target.value as EmployeeRole,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-700">재직 상태</span>
              <select
                value={manualForm.status}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    status: event.target.value as EmployeeStatus,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
              >
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium text-gray-700">입사일</span>
              <input
                type="date"
                value={manualForm.joinDate}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, joinDate: event.target.value }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-gray-700">Google Workspace 이메일</span>
              <input
                value={manualForm.gwsEmail}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, gwsEmail: event.target.value }))
                }
                className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                placeholder={`name@${allowedDomain}`}
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            선택한 role에 따라 기본 직급이 자동 매핑됩니다.
            <div className="mt-2 text-xs text-slate-500">
              예: 팀장 role은 팀장 직급으로, HR 관리자 role은 구성원 직급으로 저장됩니다.
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleManualPreview}
              disabled={previewMutation.isPending}
              className="mr-2 min-h-11 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {previewMutation.isPending ? '미리보기 계산 중...' : '조직장 미리보기'}
            </button>
            <button
              onClick={() => createMutation.mutate(manualForm)}
              disabled={createMutation.isPending}
              className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {createMutation.isPending ? '등록 중...' : '직원 등록'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">엑셀 일괄 업데이트</h2>
              <p className="mt-1 text-sm text-gray-500">
                사번 기준으로 기존 직원을 업데이트하고, 없는 직원은 새로 생성합니다.
              </p>
            </div>
            <button
              onClick={handleTemplateDownload}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              템플릿 다운로드
            </button>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-700">
              업로드 컬럼: `empId`, `empName`, `deptCode`, `deptName`, `parentDeptCode`,
              `role`, `status`, `gwsEmail`, `joinDate`
            </div>
            <div className="mt-1 text-xs text-slate-500">
              없는 `deptCode`는 새 부서로 생성되고, `parentDeptCode`가 있으면 상위 부서 아래에
              자동 연결됩니다.
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => handleBulkFileChange(event.target.files?.[0] ?? null)}
              className="mt-4 block w-full text-sm text-slate-700"
            />
          </div>

          {bulkRows.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-800">
                  업로드 미리보기 {bulkRows.length}건
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setBulkRows([])
                      setBulkSummary(null)
                      setBulkFileName('')
                    }}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700"
                  >
                    비우기
                  </button>
                  <button
                    onClick={handleBulkPreview}
                    disabled={previewMutation.isPending}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    {previewMutation.isPending ? '미리보기 계산 중...' : '재계산 미리보기'}
                  </button>
                  <button
                    onClick={() =>
                      bulkMutation.mutate({
                        fileName: bulkFileName,
                        rows: bulkRows,
                      })
                    }
                    disabled={bulkMutation.isPending}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {bulkMutation.isPending ? '업로드 중...' : '일괄 반영'}
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <div className="grid grid-cols-6 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                  <div>사번</div>
                  <div>이름</div>
                  <div>부서코드</div>
                  <div>부서명</div>
                  <div>Role</div>
                  <div>Google 이메일</div>
                </div>
                {previewRows.map((row, index) => (
                  <div
                    key={`${row.empId}-${index}`}
                    className="grid grid-cols-6 gap-2 border-t border-gray-100 px-4 py-3 text-sm text-slate-700"
                  >
                    <div>{row.empId}</div>
                    <div>{row.empName}</div>
                    <div>{row.deptCode}</div>
                    <div>{row.deptName}</div>
                    <div>{ROLE_LABELS[row.role]}</div>
                    <div className="truncate">{row.gwsEmail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bulkSummary && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-sm text-slate-500">
                업로드 파일: {bulkSummary.fileName || bulkFileName || '이름 없음'}
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="text-slate-500">총 행 수</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {bulkSummary.totalRows}
                  </div>
                </div>
                <div className="rounded-xl bg-violet-50 p-3 text-sm">
                  <div className="text-violet-700">신규 부서</div>
                  <div className="mt-1 text-lg font-semibold text-violet-800">
                    {bulkSummary.createdDepartmentCount}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-sm">
                  <div className="text-emerald-700">신규 등록</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-800">
                    {bulkSummary.createdCount}
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-sm">
                  <div className="text-blue-700">업데이트</div>
                  <div className="mt-1 text-lg font-semibold text-blue-800">
                    {bulkSummary.updatedCount}
                  </div>
                </div>
                <div className="rounded-xl bg-rose-50 p-3 text-sm">
                  <div className="text-rose-700">실패</div>
                  <div className="mt-1 text-lg font-semibold text-rose-800">
                    {bulkSummary.failedCount}
                  </div>
                </div>
              </div>

              {bulkSummary.errors.length > 0 && (
                <div className="mt-4 space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-rose-700">실패한 행</div>
                    <button
                      onClick={handleFailedRowsDownload}
                      className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700"
                    >
                      실패 행 다운로드
                    </button>
                  </div>
                  {bulkSummary.errors.slice(0, 10).map((error) => (
                    <div key={`${error.rowNumber}-${error.empId}`} className="text-sm text-rose-700">
                      {error.rowNumber}행 {error.empName ? `${error.empName} ` : ''}
                      {error.empId ? `(${error.empId}) ` : ''}- {error.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">업로드 이력</h2>
          <p className="mt-1 text-sm text-gray-500">
            최근 일괄 업데이트 이력과 처리 결과를 확인할 수 있습니다.
          </p>
        </div>

        {!uploadHistory.length && (
          <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
            아직 저장된 업로드 이력이 없습니다.
          </div>
        )}

        {!!uploadHistory.length && (
          <div className="space-y-3">
            {uploadHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 px-4 py-4 text-sm text-slate-700"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">
                      {item.fileName || '파일명 없음'}
                    </div>
                    <div className="text-xs text-slate-500">
                      업로드 시각: {item.timestamp.slice(0, 16).replace('T', ' ')} / 수행자 ID:{' '}
                      {item.userId}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      총 {item.totalRows}건
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                      신규 {item.createdCount}건
                    </span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                      업데이트 {item.updatedCount}건
                    </span>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                      실패 {item.failedCount}건
                    </span>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">
                      조직장 재계산 {item.hierarchyUpdatedCount}건
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="사번, 이름, Google 이메일로 검색"
            className="min-h-11 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm"
          />
          <button
            onClick={() => setSubmittedSearch(search.trim())}
            className="min-h-11 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
          >
            검색
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">직원 Google 계정 / Role 관리</h2>
          <p className="mt-1 text-sm text-gray-500">
            기존 직원의 Google 이메일, 부서, role, 재직 상태를 수정할 수 있습니다.
          </p>
        </div>

        {employeesQuery.isLoading && (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            직원 목록을 불러오는 중입니다.
          </div>
        )}

        {!employeesQuery.isLoading && !employees.length && (
          <div className="px-5 py-10 text-center text-sm text-gray-500">검색 결과가 없습니다.</div>
        )}

        {!!employees.length && (
          <div className="divide-y divide-gray-100">
            {employees.map((employee) => {
              const draft = drafts[employee.id] ?? {
                gwsEmail: employee.gwsEmail,
                role: employee.role,
                deptId: employee.deptId,
                status: employee.status,
              }

              const department = departments.find((item) => item.id === draft.deptId)
              const isSaving = savingId === employee.id && updateMutation.isPending
              const isEditing = editingEmployeeId === employee.id
              const mappedPosition =
                draft.role === 'ROLE_TEAM_LEADER'
                  ? 'TEAM_LEADER'
                  : draft.role === 'ROLE_SECTION_CHIEF'
                    ? 'SECTION_CHIEF'
                    : draft.role === 'ROLE_DIV_HEAD'
                      ? 'DIV_HEAD'
                      : draft.role === 'ROLE_CEO'
                        ? 'CEO'
                        : 'MEMBER'

              return (
                <div
                  id={`employee-${employee.id}`}
                  key={employee.id}
                  className={`space-y-4 px-5 py-4 ${
                    focusedEmployeeId === employee.id ? 'bg-amber-50 ring-2 ring-amber-300' : ''
                  }`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {employee.empName} ({employee.empId})
                      </div>
                      <div className="text-xs text-gray-500">
                        현재 부서: {employee.deptName} / 현재 role: {ROLE_LABELS[employee.role]} /
                        상태: {STATUS_LABELS[employee.status]}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                        자동 직급 매핑: {POSITION_LABELS[mappedPosition]}
                      </div>
                      <button
                        onClick={() => {
                          setEditingEmployeeId((current) => (current === employee.id ? '' : employee.id))
                          setFocusedEmployeeId(employee.id)
                        }}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        {isEditing ? '수정 닫기' : '수정 열기'}
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        현재 이 직원의 수정 모드가 열려 있습니다.
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700">Google 이메일</span>
                          <input
                            id={`employee-email-${employee.id}`}
                            value={draft.gwsEmail}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [employee.id]: {
                                  ...draft,
                                  gwsEmail: event.target.value,
                                },
                              }))
                            }
                            placeholder={`name@${allowedDomain}`}
                            className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                          />
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700">Role</span>
                          <select
                            value={draft.role}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [employee.id]: {
                                  ...draft,
                                  role: event.target.value as EmployeeRole,
                                },
                              }))
                            }
                            className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700">부서</span>
                          <select
                            value={draft.deptId}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [employee.id]: {
                                  ...draft,
                                  deptId: event.target.value,
                                },
                              }))
                            }
                            className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                          >
                            {departments.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.deptName} ({item.deptCode})
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-gray-700">재직 상태</span>
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [employee.id]: {
                                  ...draft,
                                  status: event.target.value as EmployeeStatus,
                                },
                              }))
                            }
                            className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3"
                          >
                            {Object.entries(STATUS_LABELS).map(([status, label]) => (
                              <option key={status} value={status}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          선택 부서: {department?.deptName ?? employee.deptName} / 입사일:{' '}
                          {employee.joinDate.slice(0, 10)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEmployeePreview(employee, draft)}
                            disabled={previewMutation.isPending}
                            className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-50"
                          >
                            {previewMutation.isPending ? '미리보기 계산 중...' : '미리보기'}
                          </button>
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                employeeId: employee.id,
                                gwsEmail: draft.gwsEmail,
                                role: draft.role,
                                deptId: draft.deptId,
                                status: draft.status,
                              })
                            }
                            disabled={isSaving}
                            className="min-h-11 rounded-xl border border-blue-300 px-5 py-3 text-sm font-medium text-blue-700 disabled:opacity-50"
                          >
                            {isSaving ? '저장 중...' : '변경 저장'}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-sm text-slate-600">
                        수정 모드가 닫혀 있습니다. `수정 열기`를 누르면 편집 폼이 열립니다.
                      </div>
                      <button
                        onClick={() => {
                          setEditingEmployeeId(employee.id)
                          setFocusedEmployeeId(employee.id)
                        }}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        수정 열기
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
