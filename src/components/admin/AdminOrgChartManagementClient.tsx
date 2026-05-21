'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { buildAdminGoogleAccessHref } from '@/lib/admin-google-access-tabs'
import { OrgMemberManagementPanel } from './OrgMemberManagementPanel'

type OrgKpiScope = 'division' | 'section' | 'team'
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
  scope: OrgKpiScope
  leaderEmployeeId: string | null
  leaderEmployeeNumber: string | null
  leaderEmployeeName: string | null
  excludeLeaderFromEvaluatorAutoAssign: boolean
  memberCount: number
  orgKpiCount: number
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
}

type EmployeeDirectoryResponse = {
  allowedDomain: string
  departments: DepartmentOption[]
  managerOptions: ManagerOption[]
  summary: {
    totalDepartments: number
    divisionCount: number
    sectionCount: number
    teamCount: number
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

type FeedbackState = {
  type: 'success' | 'error'
  message: string
} | null

type Props = {
  initialSearch: string | null
  initialStatus: string | null
  initialDepartmentId: string | null
  initialDirectoryData: EmployeeDirectoryResponse
  initialOrgChartData: OrgChartResponse
}

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

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청을 처리하는 중 문제가 발생했습니다.')
  }

  return payload.data as T
}

function buildQuery(search?: string | null, status?: string | null, departmentId?: string | null) {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('q', search.trim())
  if (status?.trim()) params.set('status', status.trim())
  if (departmentId?.trim()) params.set('departmentId', departmentId.trim())
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
            <div className="min-w-0 flex-1">
              <div className="min-w-0 break-keep text-sm font-semibold leading-tight text-slate-900 sm:text-base">
                {node.employee.name} ({node.employee.employeeNumber})
              </div>
              <div className="mt-1 break-keep text-xs leading-snug text-slate-500 sm:text-sm">
                {node.employee.departmentName}
                {node.employee.teamName ? ` / ${node.employee.teamName}` : ''}
                {node.employee.jobTitle ? ` / ${node.employee.jobTitle}` : ''}
              </div>
              <div className="mt-1 break-keep text-xs leading-snug text-slate-500 sm:text-sm">
                {ROLE_LABELS[node.employee.role]} · {STATUS_LABELS[node.employee.employmentStatus]}
                {node.employee.managerName ? ` · 상위: ${node.employee.managerName}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs leading-none text-slate-700">
                부하 {node.employee.directReportCount}명
              </span>
              <button
                type="button"
                onClick={() => onEdit(node.employee.id)}
                className="shrink-0 whitespace-nowrap rounded-xl border border-blue-300 px-3 py-1.5 text-sm font-medium leading-none text-blue-700"
              >
                직원 수정
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

export function AdminOrgChartManagementClient(props: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [departmentFilter, setDepartmentFilter] = useState(props.initialDepartmentId ?? '')
  const [includeChildDepartments, setIncludeChildDepartments] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const querySuffix = useMemo(
    () => buildQuery(props.initialSearch, props.initialStatus, departmentFilter),
    [departmentFilter, props.initialSearch, props.initialStatus]
  )
  const orgMemberQuerySuffix = useMemo(
    () => buildQuery(props.initialSearch, props.initialStatus, null),
    [props.initialSearch, props.initialStatus]
  )

  const directoryQuery = useQuery({
    queryKey: ['admin-google-account-directory-org-member', orgMemberQuerySuffix],
    initialData: props.initialDirectoryData,
    queryFn: async () => {
      const response = await fetch(`/api/admin/employees/google-account${orgMemberQuerySuffix}`)
      return parseResponse<EmployeeDirectoryResponse>(await response.json())
    },
  })

  const orgChartQuery = useQuery({
    queryKey: ['admin-google-account-org-chart', querySuffix],
    initialData: props.initialOrgChartData,
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

  const selectedDepartment = directoryQuery.data.departments.find(
    (department) => department.id === departmentFilter
  )
  const latestUpload = directoryQuery.data.uploadHistory[0] ?? null

  function moveToEmployeeManage(employeeId: string) {
    const employee = directoryQuery.data.employees.find((item) => item.id === employeeId)
    if (!employee) return

    router.push(
      buildAdminGoogleAccessHref('manage', {
        search: employee.employeeNumber,
        status: props.initialStatus,
        departmentId: employee.departmentId,
      })
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Org Chart</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">조직도 관리</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              조직 트리를 직접 추가, 수정, 이동, 삭제하고 즉시 직원 등록 및 KPI 권한 체계에 반영할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={buildAdminGoogleAccessHref('manage', {
                search: props.initialSearch,
                status: props.initialStatus,
                departmentId: props.initialDepartmentId,
              })}
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium leading-none text-slate-700"
            >
              직원 관리로 이동
            </Link>
            <Link
              href={buildAdminGoogleAccessHref('upload')}
              className="shrink-0 whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium leading-none text-white"
            >
              Google 계정 등록으로 이동
            </Link>
          </div>
        </div>
      </section>

      {feedback ? (
        <section
          className={`rounded-2xl border p-4 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.message}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">조직 단위</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {directoryQuery.data.summary.totalDepartments}
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-500">
            본부 {directoryQuery.data.summary.divisionCount} · 실 {directoryQuery.data.summary.sectionCount} · 팀{' '}
            {directoryQuery.data.summary.teamCount}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">현재 직원 수</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {orgChartQuery.data.summary.totalEmployees}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="text-sm text-amber-700">관리자 연결 필요</div>
          <div className="mt-2 text-2xl font-semibold text-amber-800">
            {orgChartQuery.data.summary.orphanedEmployees}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="text-sm text-rose-700">순환 보고 관계</div>
          <div className="mt-2 text-2xl font-semibold text-rose-800">
            {orgChartQuery.data.summary.cycleEmployees}
          </div>
        </div>
      </section>

      {latestUpload && latestUpload.failedCount > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          최근 직원 마스터 업로드에서 오류 {latestUpload.failedCount}행은 적용되지 않았습니다. 해당 행에만 있는 조직 경로는
          조직 트리에 생성되지 않습니다.
        </section>
      ) : null}

      <OrgMemberManagementPanel
        departments={directoryQuery.data.departments}
        managerOptions={directoryQuery.data.managerOptions}
        employees={directoryQuery.data.employees}
        selectedDepartmentId={departmentFilter}
        includeChildDepartments={includeChildDepartments}
        onSelectDepartment={(departmentId) => {
          setDepartmentFilter(departmentId)
          router.replace(
            buildAdminGoogleAccessHref('org-chart', {
              search: props.initialSearch,
              status: props.initialStatus,
              departmentId: departmentId || null,
            })
          )
        }}
        onToggleIncludeChildDepartments={setIncludeChildDepartments}
        onEditEmployee={moveToEmployeeManage}
        onOpenCreateEmployee={() =>
          router.push(
            buildAdminGoogleAccessHref('manage', {
              search: props.initialSearch,
              status: props.initialStatus,
              departmentId: selectedDepartment?.id ?? null,
            })
          )
        }
        onOpenUpload={() => router.push(buildAdminGoogleAccessHref('upload'))}
        onRefresh={refreshQueries}
        onFeedback={setFeedback}
      />

      {orgChartQuery.data.orphanedEmployees.length ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-amber-900">관리자 연결이 필요한 직원</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {orgChartQuery.data.orphanedEmployees.map((employee) => (
              <button
                key={`orphan-${employee.id}`}
                type="button"
                onClick={() => moveToEmployeeManage(employee.id)}
                className="shrink-0 whitespace-nowrap rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm leading-none text-amber-800"
              >
                {employee.name} ({employee.employeeNumber})
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {orgChartQuery.data.cycleEmployees.length ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-rose-900">순환 보고 관계가 있는 직원</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {orgChartQuery.data.cycleEmployees.map((employee) => (
              <button
                key={`cycle-${employee.id}`}
                type="button"
                onClick={() => moveToEmployeeManage(employee.id)}
                className="shrink-0 whitespace-nowrap rounded-full border border-rose-300 bg-white px-3 py-1.5 text-sm leading-none text-rose-800"
              >
                {employee.name} ({employee.employeeNumber})
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">보고 조직도</h2>
          <div className="text-sm text-slate-500">
            관리자 보고 관계 기준으로 직원 트리를 함께 확인합니다.
          </div>
        </div>

        {orgChartQuery.isLoading ? (
          <div className="text-sm text-slate-500">조직도를 불러오는 중입니다...</div>
        ) : orgChartQuery.data.roots.length ? (
          <OrgChartTree nodes={orgChartQuery.data.roots} onEdit={moveToEmployeeManage} />
        ) : (
          <div className="text-sm text-slate-500">표시할 조직도 데이터가 없습니다.</div>
        )}
      </section>
    </div>
  )
}
