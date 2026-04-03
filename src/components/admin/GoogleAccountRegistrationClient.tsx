'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EvaluatorAssignmentAdminPanel } from './EvaluatorAssignmentAdminPanel'
import { MasterLoginAdminPanel } from './MasterLoginAdminPanel'
import { OrgMemberManagementPanel } from './OrgMemberManagementPanel'

type EmployeeRole =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'

type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RESIGNED'

type DepartmentOption = {
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

type ManagerOption = {
  id: string
  employeeNumber: string
  name: string
  employmentStatus: EmployeeStatus
  departmentName: string
}

type EmployeeListItem = {
  id: string
  employeeNumber: string
  name: string
  googleEmail: string
  departmentId: string
  departmentCode: string
  departmentName: string
  teamName: string | null
  jobTitle: string | null
  role: EmployeeRole
  employmentStatus: EmployeeStatus
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

type EmployeeDirectoryResponse = {
  allowedDomain: string
  departments: DepartmentOption[]
  managerOptions: ManagerOption[]
  summary: {
    totalEmployees: number
    activeEmployees: number
    inactiveEmployees: number
    resignedEmployees: number
    unassignedManagerCount: number
  }
  uploadHistory: Array<{
    id: string
    fileName: string
    totalRows: number
    successCount: number
    failedCount: number
    createdCount: number
    updatedCount: number
    hierarchyUpdatedCount: number
    uploadedAt: string
    uploaderId: string
  }>
  employees: EmployeeListItem[]
}

type SaveEmployeeResponse = {
  employee: EmployeeListItem
  hierarchyUpdatedCount: number
}

type DeleteEmployeeResponse = {
  deletedEmployee: {
    id: string
    employeeNumber: string
    name: string
  }
  hierarchyUpdatedCount: number
}

type UploadPreviewRow = {
  rowNumber: number
  employeeNumber: string
  name: string
  action: 'create' | 'update'
  valid: boolean
  issues: Array<{
    field: string
    message: string
    severity: 'error' | 'warning'
  }>
}

type UploadResponse = {
  mode: 'preview' | 'apply'
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
  rows: UploadPreviewRow[]
  errors: Array<{
    rowNumber: number
    employeeNumber?: string
    field?: string
    message: string
  }>
  applyResult?: {
    fileName: string
    totalRows: number
    createdDepartmentCount: number
    createdCount: number
    updatedCount: number
    failedCount: number
    hierarchyUpdatedCount: number
  }
}

type OrgChartNode = {
  employee: {
    id: string
    employeeNumber: string
    name: string
    googleEmail: string
    departmentName: string
    departmentCode: string
    teamName: string | null
    jobTitle: string | null
    role: EmployeeRole
    employmentStatus: EmployeeStatus
    joinDate: string
    resignationDate: string | null
    managerEmployeeNumber: string | null
    managerName: string | null
    directReportCount: number
    sortOrder: number | null
  }
  reports: OrgChartNode[]
}

type OrgChartResponse = {
  roots: OrgChartNode[]
  orphanedEmployees: OrgChartNode['employee'][]
  cycleEmployees: OrgChartNode['employee'][]
  summary: {
    totalEmployees: number
    activeEmployees: number
    inactiveEmployees: number
    resignedEmployees: number
    roots: number
    orphanedEmployees: number
    cycleEmployees: number
  }
}

type EmployeeFormState = {
  employeeNumber: string
  name: string
  gwsEmail: string
  deptId: string
  teamName: string
  jobTitle: string
  role: EmployeeRole
  employmentStatus: EmployeeStatus
  managerEmployeeNumber: string
  joinDate: string
  resignationDate: string
  sortOrder: string
  notes: string
}

type FeedbackState =
  | {
      type: 'success' | 'error'
      message: string
    }
  | null

const ROLE_LABELS: Record<EmployeeRole, string> = {
  ROLE_MEMBER: '구성원',
  ROLE_TEAM_LEADER: '팀장',
  ROLE_SECTION_CHIEF: '실장/부문장',
  ROLE_DIV_HEAD: '본부장',
  ROLE_CEO: 'CEO',
  ROLE_ADMIN: 'HR 관리자',
}

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: '재직',
  INACTIVE: '비활성',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴사',
}

const EMPTY_FORM: EmployeeFormState = {
  employeeNumber: '',
  name: '',
  gwsEmail: '',
  deptId: '',
  teamName: '',
  jobTitle: '',
  role: 'ROLE_MEMBER',
  employmentStatus: 'ACTIVE',
  managerEmployeeNumber: '',
  joinDate: '',
  resignationDate: '',
  sortOrder: '',
  notes: '',
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }

  return payload.data as T
}

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildQuery(search: string, status: string, departmentId: string) {
  const params = new URLSearchParams()
  if (search.trim()) params.set('q', search.trim())
  if (status && status !== 'ALL') params.set('status', status)
  if (departmentId) params.set('departmentId', departmentId)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function OrgChartTree({
  nodes,
  onEdit,
}: {
  nodes: OrgChartNode[]
  onEdit: (employeeId: string) => void
}) {
  return (
    <div className="space-y-4">
      {nodes.map((node) => (
        <div key={node.employee.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">
                {node.employee.name} ({node.employee.employeeNumber})
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {node.employee.departmentName}
                {node.employee.teamName ? ` / ${node.employee.teamName}` : ''}
                {node.employee.jobTitle ? ` / ${node.employee.jobTitle}` : ''}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {ROLE_LABELS[node.employee.role]} · {STATUS_LABELS[node.employee.employmentStatus]}
                {node.employee.managerName ? ` · 상위: ${node.employee.managerName}` : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                부하 {node.employee.directReportCount}명
              </span>
              <button
                type="button"
                onClick={() => onEdit(node.employee.id)}
                className="rounded-xl border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700"
              >
                이 직원 수정
              </button>
            </div>
          </div>

          {!!node.reports.length && (
            <div className="mt-4 border-l-2 border-slate-200 pl-4">
              <OrgChartTree nodes={node.reports} onEdit={onEdit} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function GoogleAccountRegistrationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const currentTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    currentTab === 'org-chart' ||
      currentTab === 'upload' ||
      currentTab === 'evaluator' ||
      currentTab === 'master-login'
      ? (currentTab as 'org-chart' | 'upload' | 'evaluator' | 'master-login')
      : 'manage'
  )
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'ALL')
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('departmentId') ?? '')
  const [includeChildDepartments, setIncludeChildDepartments] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [form, setForm] = useState<EmployeeFormState>(EMPTY_FORM)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)

  const querySuffix = buildQuery(search, statusFilter, departmentFilter)
  const orgMemberQuerySuffix = buildQuery(search, statusFilter, '')

  const directoryQuery = useQuery({
    queryKey: ['admin-google-account-directory', querySuffix],
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/google-account${querySuffix}`)
      return parseResponse<EmployeeDirectoryResponse>(await response.json())
    },
  })

  const orgMemberDirectoryQuery = useQuery({
    queryKey: ['admin-google-account-directory-org-member', orgMemberQuerySuffix],
    enabled: activeTab === 'org-chart',
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/google-account${orgMemberQuerySuffix}`)
      return parseResponse<EmployeeDirectoryResponse>(await response.json())
    },
  })

  const orgChartQuery = useQuery({
    queryKey: ['admin-google-account-org-chart', querySuffix],
    enabled: activeTab === 'org-chart',
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/google-account/org-chart${querySuffix}`)
      return parseResponse<OrgChartResponse>(await response.json())
    },
  })

  const refreshQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-google-account-directory'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-google-account-directory-org-member'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-google-account-org-chart'] })
  }

  const saveMutation = useMutation({
    mutationFn: async (input: EmployeeFormState) => {
      const payload = {
        employeeId: editingEmployeeId ?? undefined,
        employeeNumber: input.employeeNumber,
        name: input.name,
        gwsEmail: input.gwsEmail,
        deptId: input.deptId,
        teamName: input.teamName,
        jobTitle: input.jobTitle,
        role: input.role,
        employmentStatus: input.employmentStatus,
        managerEmployeeNumber: input.managerEmployeeNumber,
        joinDate: input.joinDate || undefined,
        resignationDate: input.resignationDate || undefined,
        sortOrder: input.sortOrder ? Number(input.sortOrder) : undefined,
        notes: input.notes,
      }
      const response = await fetch('/api/admin/employees/google-account', {
        method: editingEmployeeId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      return parseResponse<SaveEmployeeResponse>(await response.json())
    },
    onSuccess: async (data) => {
      setFeedback({
        type: 'success',
        message: `${data.employee.name}(${data.employee.employeeNumber}) 정보를 저장했습니다. 조직도 연계 ${data.hierarchyUpdatedCount}건을 재계산했습니다.`,
      })
      setEditingEmployeeId(null)
      setForm(EMPTY_FORM)
      await refreshQueries()
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const lifecycleMutation = useMutation({
    mutationFn: async (input: {
      employeeId: string
      action: 'DEACTIVATE' | 'RESIGN' | 'REACTIVATE'
      resignationDate?: string
    }) => {
      const response = await fetch('/api/admin/employees/google-account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      return parseResponse<SaveEmployeeResponse & { impactedDirectReports: number }>(
        await response.json()
      )
    },
    onSuccess: async (data, variables) => {
      const actionLabel =
        variables.action === 'DEACTIVATE'
          ? '비활성화'
          : variables.action === 'RESIGN'
            ? '퇴사 처리'
            : '재활성화'

      setFeedback({
        type: 'success',
        message:
          data.impactedDirectReports > 0
            ? `${data.employee.name} 직원을 ${actionLabel}했습니다. 직속 구성원 ${data.impactedDirectReports}명의 관리자 연결도 함께 점검해 주세요.`
            : `${data.employee.name} 직원을 ${actionLabel}했습니다.`,
      })
      await refreshQueries()
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const response = await fetch('/api/admin/employees/google-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      })

      return parseResponse<DeleteEmployeeResponse>(await response.json())
    },
    onSuccess: async (data) => {
      setFeedback({
        type: 'success',
        message: `${data.deletedEmployee.name}(${data.deletedEmployee.employeeNumber}) 직원을 삭제했습니다.`,
      })
      if (editingEmployeeId === data.deletedEmployee.id) {
        setEditingEmployeeId(null)
        setForm(EMPTY_FORM)
      }
      await refreshQueries()
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (mode: 'preview' | 'apply') => {
      if (!uploadFile) {
        throw new Error('업로드할 파일을 먼저 선택해 주세요.')
      }

      const body = new FormData()
      body.set('mode', mode)
      body.set('file', uploadFile)

      const response = await fetch('/api/admin/employees/google-account/upload', {
        method: 'POST',
        body,
      })

      return parseResponse<UploadResponse>(await response.json())
    },
    onSuccess: async (data) => {
      setUploadResult(data)
      if (data.mode === 'apply') {
        setFeedback({
          type: data.summary.invalidRows > 0 ? 'error' : 'success',
          message:
            data.summary.invalidRows > 0
              ? `일괄 업로드를 적용했습니다. 유효한 ${data.summary.validRows}건은 반영했고, ${data.summary.invalidRows}건은 오류로 제외했습니다.`
              : `일괄 업로드 ${data.summary.validRows}건을 모두 반영했습니다.`,
        })
        await refreshQueries()
      }
    },
    onError: (error: Error) => {
      setFeedback({ type: 'error', message: error.message })
    },
  })

  const directoryData =
    activeTab === 'org-chart' ? orgMemberDirectoryQuery.data ?? directoryQuery.data : directoryQuery.data
  const departmentOptions = directoryData?.departments ?? []
  const managerOptions = directoryData?.managerOptions ?? []
  const employees = directoryData?.employees ?? []
  const summary = directoryData?.summary

  const uploadRowsToShow = uploadResult?.rows.slice(0, 80) ?? []

  const applyTab = (
    nextTab: 'manage' | 'upload' | 'org-chart' | 'evaluator' | 'master-login',
    nextDepartmentId = departmentFilter
  ) => {
    setActiveTab(nextTab)
    setDepartmentFilter(nextDepartmentId)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', nextTab)
    if (nextDepartmentId) {
      params.set('departmentId', nextDepartmentId)
    } else {
      params.delete('departmentId')
    }
    router.replace(`/admin/google-access?${params.toString()}`)
  }

  const startEdit = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee) {
      return
    }

    setEditingEmployeeId(employee.id)
    setForm({
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      gwsEmail: employee.googleEmail,
      deptId: employee.departmentId,
      teamName: employee.teamName ?? '',
      jobTitle: employee.jobTitle ?? '',
      role: employee.role,
      employmentStatus: employee.employmentStatus,
      managerEmployeeNumber: employee.managerEmployeeNumber ?? '',
      joinDate: employee.joinDate ?? '',
      resignationDate: employee.resignationDate ?? '',
      sortOrder: employee.sortOrder !== null ? String(employee.sortOrder) : '',
      notes: employee.notes ?? '',
    })
    setFeedback(null)
    applyTab('manage', employee.departmentId)
  }

  const resetForm = () => {
    setEditingEmployeeId(null)
    setForm(EMPTY_FORM)
  }

  const handleLifecycle = (employee: EmployeeListItem, action: 'DEACTIVATE' | 'RESIGN' | 'REACTIVATE') => {
    const confirmMessage =
      action === 'DEACTIVATE'
        ? `${employee.name} 직원을 비활성화하시겠습니까? ACTIVE 상태가 아니면 Google 로그인이 차단됩니다.`
        : action === 'RESIGN'
          ? `${employee.name} 직원을 퇴사 처리하시겠습니까?`
          : `${employee.name} 직원을 재활성화하시겠습니까?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    if (action === 'RESIGN') {
      lifecycleMutation.mutate({
        employeeId: employee.id,
        action,
        resignationDate: employee.resignationDate ?? getTodayString(),
      })
      return
    }

    lifecycleMutation.mutate({
      employeeId: employee.id,
      action,
    })
  }

  const canApplyUpload = Boolean(uploadFile && uploadResult && uploadResult.mode === 'preview')

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Google 계정 등록 관리</h1>
            <p className="mt-2 text-sm text-slate-600">
              관리자 전용 화면입니다. 단건 등록/수정, 일괄 업로드, 조직도 확인을 한 곳에서 처리하며,
              Google 로그인 허용 목록은 재직 상태가 ACTIVE인 직원만 유지됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/admin/employees/google-account/template"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              템플릿 다운로드
            </Link>
            <button
              type="button"
              onClick={() => applyTab('upload')}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              일괄 업로드
            </button>
          </div>
        </div>
      </section>

      {summary && (
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">전체 등록 직원</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalEmployees}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">재직</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-700">{summary.activeEmployees}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">비활성/퇴사</div>
            <div className="mt-2 text-2xl font-semibold text-amber-700">
              {summary.inactiveEmployees + summary.resignedEmployees}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">관리자 미지정 재직자</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.unassignedManagerCount}</div>
          </div>
        </section>
      )}

      {feedback && (
        <section
          className={`rounded-2xl border p-4 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {feedback.message}
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        {[
          { key: 'manage' as const, label: '목록 관리' },
          { key: 'upload' as const, label: '일괄 업로드' },
          { key: 'org-chart' as const, label: '조직 · 구성원' },
          { key: 'evaluator' as const, label: '평가권자 관리' },
          { key: 'master-login' as const, label: '마스터 로그인' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => applyTab(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="사번, 이름, 이메일, 부서 검색"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">상태 전체</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">부서 전체</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.deptName} ({department.deptCode})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter('ALL')
              setDepartmentFilter('')
              setIncludeChildDepartments(false)
            }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            필터 초기화
          </button>
        </div>
      </section>

      {activeTab === 'manage' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingEmployeeId ? '직원 정보 수정' : '직원 1건 등록'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  허용 도메인: {directoryQuery.data?.allowedDomain ?? '-'}
                </p>
              </div>
              {editingEmployeeId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  새 등록으로 전환
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={form.employeeNumber}
                onChange={(event) => setForm((current) => ({ ...current, employeeNumber: event.target.value }))}
                placeholder="사번"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="이름"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={form.gwsEmail}
                onChange={(event) => setForm((current) => ({ ...current, gwsEmail: event.target.value }))}
                placeholder="Google 이메일"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={form.deptId}
                onChange={(event) => setForm((current) => ({ ...current, deptId: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">부서 선택</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.deptName} ({department.deptCode})
                  </option>
                ))}
              </select>
              <input
                value={form.teamName}
                onChange={(event) => setForm((current) => ({ ...current, teamName: event.target.value }))}
                placeholder="팀명"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={form.jobTitle}
                onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))}
                placeholder="직책/직위"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as EmployeeRole }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={form.employmentStatus}
                onChange={(event) =>
                  setForm((current) => ({ ...current, employmentStatus: event.target.value as EmployeeStatus }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={form.managerEmployeeNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, managerEmployeeNumber: event.target.value }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">직속 관리자 없음</option>
                {managerOptions.map((manager) => (
                  <option key={manager.id} value={manager.employeeNumber}>
                    {manager.name} ({manager.employeeNumber}) / {manager.departmentName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={form.joinDate}
                onChange={(event) => setForm((current) => ({ ...current, joinDate: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={form.resignationDate}
                onChange={(event) => setForm((current) => ({ ...current, resignationDate: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                placeholder="정렬 순서"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="비고"
              className="mt-3 min-h-24 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saveMutation.isPending ? '저장 중...' : editingEmployeeId ? '수정 저장' : '등록'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                입력 초기화
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">등록 목록</h2>
              <div className="text-sm text-slate-500">총 {employees.length}건 표시</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">직원</th>
                    <th className="px-3 py-2">Google 계정</th>
                    <th className="px-3 py-2">부서/팀</th>
                    <th className="px-3 py-2">권한/상태</th>
                    <th className="px-3 py-2">관리자</th>
                    <th className="px-3 py-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">
                          {employee.name} ({employee.employeeNumber})
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          입사일 {employee.joinDate}
                          {employee.jobTitle ? ` · ${employee.jobTitle}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-700">{employee.googleEmail}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          로그인 {employee.loginEnabled ? '허용' : '차단'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{employee.departmentName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {employee.departmentCode}
                          {employee.teamName ? ` · ${employee.teamName}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{ROLE_LABELS[employee.role]}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {STATUS_LABELS[employee.employmentStatus]}
                          {employee.resignationDate ? ` · ${employee.resignationDate}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div>{employee.managerName ?? '미지정'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {employee.managerEmployeeNumber ?? '관리자 사번 없음'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(employee.id)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            수정
                          </button>
                          {employee.employmentStatus !== 'INACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleLifecycle(employee, 'DEACTIVATE')}
                              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700"
                            >
                              비활성화
                            </button>
                          )}
                          {employee.employmentStatus !== 'RESIGNED' && (
                            <button
                              type="button"
                              onClick={() => handleLifecycle(employee, 'RESIGN')}
                              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700"
                            >
                              퇴사 처리
                            </button>
                          )}
                          {employee.employmentStatus !== 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleLifecycle(employee, 'REACTIVATE')}
                              className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700"
                            >
                              재활성화
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `${employee.name} 직원을 삭제하시겠습니까? 참조 데이터가 있으면 서버에서 자동으로 차단합니다.`
                                )
                              ) {
                                deleteMutation.mutate(employee.id)
                              }
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!employees.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                        조건에 맞는 직원이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">일괄 업로드</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>1. 템플릿을 내려받아 사번, 이름, Google 이메일, 부서 코드를 채워 주세요.</p>
              <p>2. 사번이 이미 있으면 해당 직원을 수정하고, 없으면 신규 등록합니다.</p>
              <p>3. 오류가 있는 행은 제외하고 유효한 행만 반영할 수 있습니다.</p>
              <p>4. ACTIVE 상태에서는 퇴사일을 입력할 수 없고, 관리자 사번은 기존/동일 파일 내 직원이어야 합니다.</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null
                  setUploadFile(nextFile)
                  setUploadResult(null)
                }}
                className="text-sm"
              />
              <button
                type="button"
                onClick={() => uploadMutation.mutate('preview')}
                disabled={!uploadFile || uploadMutation.isPending}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                검증 미리보기
              </button>
              <button
                type="button"
                onClick={() => uploadMutation.mutate('apply')}
                disabled={!canApplyUpload || uploadMutation.isPending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                유효 행 반영
              </button>
            </div>
          </section>

          {uploadResult && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">전체 행</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{uploadResult.summary.totalRows}</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm text-emerald-700">유효 행</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-800">{uploadResult.summary.validRows}</div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm text-rose-700">오류 행</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-800">{uploadResult.summary.invalidRows}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">경고</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{uploadResult.summary.warningCount}</div>
                </div>
              </div>

              {uploadResult.applyResult && (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  부서 생성 {uploadResult.applyResult.createdDepartmentCount}건, 신규 등록 {uploadResult.applyResult.createdCount}건,
                  수정 {uploadResult.applyResult.updatedCount}건, 조직도 재계산 {uploadResult.applyResult.hierarchyUpdatedCount}건
                </div>
              )}

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">행</th>
                      <th className="px-3 py-2">사번</th>
                      <th className="px-3 py-2">이름</th>
                      <th className="px-3 py-2">처리</th>
                      <th className="px-3 py-2">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadRowsToShow.map((row) => (
                      <tr key={`${row.rowNumber}-${row.employeeNumber}`} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3">{row.rowNumber}</td>
                        <td className="px-3 py-3">{row.employeeNumber || '-'}</td>
                        <td className="px-3 py-3">{row.name || '-'}</td>
                        <td className="px-3 py-3">{row.action === 'create' ? '신규 등록' : '기존 수정'}</td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className={row.valid ? 'text-emerald-700' : 'text-rose-700'}>
                              {row.valid ? '반영 가능' : '오류 있음'}
                            </div>
                            {row.issues.map((issue, index) => (
                              <div
                                key={`${row.rowNumber}-${index}`}
                                className={issue.severity === 'warning' ? 'text-amber-700' : 'text-rose-700'}
                              >
                                [{issue.field}] {issue.message}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {!!directoryQuery.data?.uploadHistory.length && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">최근 업로드 이력</h2>
              <div className="mt-4 space-y-3">
                {directoryQuery.data.uploadHistory.map((history) => (
                  <div
                    key={history.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                  >
                    <div className="font-medium text-slate-900">{history.fileName}</div>
                    <div className="mt-1">
                      총 {history.totalRows}행 · 성공 {history.successCount}행 · 실패 {history.failedCount}행 · 신규 {history.createdCount}건 · 수정 {history.updatedCount}건
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{history.uploadedAt.replace('T', ' ').slice(0, 16)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'evaluator' && (
        <EvaluatorAssignmentAdminPanel onFeedback={setFeedback} onRefresh={refreshQueries} />
      )}

      {activeTab === 'master-login' && (
        <MasterLoginAdminPanel employees={employees} onFeedback={setFeedback} />
      )}

      {activeTab === 'org-chart' && (
        <div className="space-y-6">
          <OrgMemberManagementPanel
            departments={departmentOptions}
            managerOptions={managerOptions}
            employees={employees}
            selectedDepartmentId={departmentFilter}
            includeChildDepartments={includeChildDepartments}
            onSelectDepartment={setDepartmentFilter}
            onToggleIncludeChildDepartments={setIncludeChildDepartments}
            onEditEmployee={startEdit}
            onOpenCreateEmployee={() => {
              resetForm()
              applyTab('manage')
            }}
            onOpenUpload={() => applyTab('upload')}
            onRefresh={refreshQueries}
            onFeedback={setFeedback}
          />

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">조직도</h2>
              <div className="text-sm text-slate-500">
                관리자 관계 기준으로 표시하며, 관리자 누락이나 순환 관계는 별도로 분리해 보여 줍니다.
              </div>
            </div>

            {orgChartQuery.data && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">표시 인원</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{orgChartQuery.data.summary.totalEmployees}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">루트 노드</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{orgChartQuery.data.summary.roots}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm text-amber-700">관리자 누락</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-800">
                    {orgChartQuery.data.summary.orphanedEmployees}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm text-rose-700">순환 관계</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-800">
                    {orgChartQuery.data.summary.cycleEmployees}
                  </div>
                </div>
              </div>
            )}
          </section>

          {orgChartQuery.data?.orphanedEmployees.length ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-amber-900">관리자 재지정이 필요한 직원</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {orgChartQuery.data.orphanedEmployees.map((employee) => (
                  <button
                    key={`orphan-${employee.id}`}
                    type="button"
                    onClick={() => startEdit(employee.id)}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800"
                  >
                    {employee.name} ({employee.employeeNumber})
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {orgChartQuery.data?.cycleEmployees.length ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
              <h3 className="text-base font-semibold text-rose-900">순환 관계 감지 직원</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {orgChartQuery.data.cycleEmployees.map((employee) => (
                  <button
                    key={`cycle-${employee.id}`}
                    type="button"
                    onClick={() => startEdit(employee.id)}
                    className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-800"
                  >
                    {employee.name} ({employee.employeeNumber})
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {orgChartQuery.isLoading ? (
              <div className="text-sm text-slate-500">조직도를 불러오는 중입니다...</div>
            ) : orgChartQuery.data?.roots.length ? (
              <OrgChartTree nodes={orgChartQuery.data.roots} onEdit={startEdit} />
            ) : (
              <div className="text-sm text-slate-500">표시할 조직도 데이터가 없습니다.</div>
            )}
          </section>

          <section className="text-sm text-slate-500">
            기존 조직도 전용 경로가 필요하면 <Link href="/admin/org-chart" className="text-blue-700 underline">/admin/org-chart</Link> 로도 접근할 수 있으며, 현재는 같은 관리 모듈로 연결됩니다.
          </section>
        </div>
      )}
    </div>
  )
}
