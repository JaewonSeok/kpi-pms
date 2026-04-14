import Link from 'next/link'
import { buildAdminGoogleAccessHref } from '@/lib/admin-google-access-tabs'
import { ROLE_LABELS } from '@/lib/utils'
import {
  fetchEmployeeOrgChart,
  loadEmployeeDirectory,
  type DepartmentDirectoryItem,
  type EmployeeDirectoryItem,
} from '@/server/admin/google-account-management'

type AdminOrgChartScreenProps = {
  search?: string | null
  status?: string | null
  departmentId?: string | null
}

type DepartmentTreeNode = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
  leaderEmployeeName: string | null
  visibleMemberCount: number
  employees: EmployeeDirectoryItem[]
  children: DepartmentTreeNode[]
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '재직',
  INACTIVE: '비활성',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴사',
}

function compareEmployees(left: EmployeeDirectoryItem, right: EmployeeDirectoryItem) {
  const orderDiff = (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
  if (orderDiff !== 0) {
    return orderDiff
  }

  return left.name.localeCompare(right.name, 'ko')
}

function buildDepartmentTree(
  departments: DepartmentDirectoryItem[],
  employees: EmployeeDirectoryItem[]
): DepartmentTreeNode[] {
  const shouldPruneEmptyDepartments = employees.length > 0
  const employeesByDepartmentId = new Map<string, EmployeeDirectoryItem[]>()
  const childrenByParentId = new Map<string | null, DepartmentDirectoryItem[]>()

  for (const employee of employees) {
    const bucket = employeesByDepartmentId.get(employee.departmentId) ?? []
    bucket.push(employee)
    employeesByDepartmentId.set(employee.departmentId, bucket)
  }

  for (const department of departments) {
    const bucket = childrenByParentId.get(department.parentDeptId) ?? []
    bucket.push(department)
    childrenByParentId.set(department.parentDeptId, bucket)
  }

  const buildNode = (department: DepartmentDirectoryItem): DepartmentTreeNode | null => {
    const childNodes = (childrenByParentId.get(department.id) ?? [])
      .slice()
      .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
      .map(buildNode)
      .filter((node): node is DepartmentTreeNode => Boolean(node))

    const departmentEmployees = (employeesByDepartmentId.get(department.id) ?? [])
      .slice()
      .sort(compareEmployees)

    const visibleMemberCount =
      departmentEmployees.length +
      childNodes.reduce((total, childNode) => total + childNode.visibleMemberCount, 0)

    if (shouldPruneEmptyDepartments && visibleMemberCount === 0) {
      return null
    }

    return {
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      leaderEmployeeName: department.leaderEmployeeName,
      visibleMemberCount,
      employees: departmentEmployees,
      children: childNodes,
    }
  }

  return (childrenByParentId.get(null) ?? [])
    .slice()
    .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
    .map(buildNode)
    .filter((node): node is DepartmentTreeNode => Boolean(node))
}

function countDepartmentNodes(nodes: DepartmentTreeNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countDepartmentNodes(node.children), 0)
}

function buildEmployeeManageHref(
  employee: Pick<EmployeeDirectoryItem, 'employeeNumber' | 'departmentId'>,
  status: string | null
) {
  return buildAdminGoogleAccessHref('manage', {
    search: employee.employeeNumber,
    status,
    departmentId: employee.departmentId,
  })
}

function OrgChartEmployeeCard(props: {
  employee: EmployeeDirectoryItem
  status: string | null
}) {
  const { employee } = props

  return (
    <details
      id={`org-chart-employee-${employee.id}`}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-semibold text-slate-900">
              {employee.name} ({employee.employeeNumber})
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {(ROLE_LABELS[employee.role] ?? employee.role) as string} ·{' '}
              {STATUS_LABELS[employee.employmentStatus] ?? employee.employmentStatus}
            </div>
          </div>
          <div className="text-xs font-medium text-slate-500">상세 보기</div>
        </div>
      </summary>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl bg-white p-3 text-sm">
          <div className="text-slate-500">Google 이메일</div>
          <div className="mt-1 font-medium text-slate-900">{employee.googleEmail || '미등록'}</div>
        </div>
        <div className="rounded-xl bg-white p-3 text-sm">
          <div className="text-slate-500">조직</div>
          <div className="mt-1 font-medium text-slate-900">
            {employee.departmentName} ({employee.departmentCode})
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 text-sm">
          <div className="text-slate-500">입사일</div>
          <div className="mt-1 font-medium text-slate-900">{employee.joinDate || '미등록'}</div>
        </div>
        <div className="rounded-xl bg-white p-3 text-sm">
          <div className="text-slate-500">팀 / 직책</div>
          <div className="mt-1 font-medium text-slate-900">
            {employee.teamName || '미지정'}
            {employee.jobTitle ? ` · ${employee.jobTitle}` : ''}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 text-sm">
          <div className="text-slate-500">직속 관리자</div>
          <div className="mt-1 font-medium text-slate-900">
            {employee.managerName
              ? `${employee.managerName} (${employee.managerEmployeeNumber ?? '-'})`
              : '미지정'}
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 text-sm">
          <div className="text-slate-500">직접 보고 인원</div>
          <div className="mt-1 font-medium text-slate-900">{employee.directReportCount}명</div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={buildEmployeeManageHref(employee, props.status)}
          className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700"
        >
          직원 관리에서 수정
        </Link>
      </div>
    </details>
  )
}

function OrgChartDepartmentSection(props: {
  nodes: DepartmentTreeNode[]
  status: string | null
  level?: number
}) {
  const level = props.level ?? 0

  return (
    <div className={level === 0 ? 'space-y-4' : 'mt-4 space-y-4 pl-4 md:pl-8'}>
      {props.nodes.map((node) => (
        <details
          key={node.id}
          open={level === 0}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {node.deptName}
                  <span className="ml-2 text-sm font-medium text-slate-500">({node.deptCode})</span>
                </div>
                <div className="mt-1 text-sm text-slate-500">표시 인원 {node.visibleMemberCount}명</div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  조직 리더: {node.leaderEmployeeName ?? '미지정'}
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                  하위 조직 {node.children.length}개
                </span>
              </div>
            </div>
          </summary>

          {node.employees.length ? (
            <div className="mt-4 space-y-3">
              {node.employees.map((employee) => (
                <OrgChartEmployeeCard
                  key={employee.id}
                  employee={employee}
                  status={props.status}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              현재 필터 조건에 맞는 직원이 없습니다.
            </div>
          )}

          {node.children.length ? (
            <OrgChartDepartmentSection
              nodes={node.children}
              status={props.status}
              level={level + 1}
            />
          ) : null}
        </details>
      ))}
    </div>
  )
}

export async function AdminOrgChartScreen(props: AdminOrgChartScreenProps) {
  const [directoryData, orgChartData] = await Promise.all([
    loadEmployeeDirectory({
      query: props.search ?? undefined,
      status: props.status ?? undefined,
      departmentId: props.departmentId ?? undefined,
    }),
    fetchEmployeeOrgChart({
      query: props.search ?? undefined,
      status: props.status ?? undefined,
      departmentId: props.departmentId ?? undefined,
    }),
  ])

  const selectedDepartment =
    directoryData.departments.find((department) => department.id === props.departmentId) ?? null
  const departmentTree = buildDepartmentTree(directoryData.departments, directoryData.employees)
  const visibleDepartmentCount = countDepartmentNodes(departmentTree)
  const latestUpload = directoryData.uploadHistory[0] ?? null
  const activeFilters = [
    props.search?.trim() ? `검색: ${props.search.trim()}` : null,
    props.status?.trim() && props.status !== 'ALL'
      ? `상태: ${STATUS_LABELS[props.status] ?? props.status}`
      : null,
    selectedDepartment ? `조직: ${selectedDepartment.deptName}` : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Org Chart</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">조직도 관리</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              기존 조직도 관리 전용 화면입니다. 부서 트리와 직원 상세를 한 번에 보면서
              조직 구조, 리더 지정 상태, 보고 체계 예외를 별도 관리 화면과 분리해서 확인할 수
              있습니다.
            </p>
            {latestUpload ? (
              <p className="mt-3 text-xs text-slate-500">
                최근 업로드: {latestUpload.fileName} ·{' '}
                {latestUpload.uploadedAt.replace('T', ' ').slice(0, 16)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={buildAdminGoogleAccessHref('manage', {
                search: props.search ?? null,
                status: props.status ?? null,
                departmentId: props.departmentId ?? null,
              })}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              직원 관리로 이동
            </Link>
            <Link
              href={buildAdminGoogleAccessHref('upload')}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Google 계정 등록으로 이동
            </Link>
          </div>
        </div>
      </section>

      {activeFilters.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-amber-900">현재 필터</span>
            {activeFilters.map((filter) => (
              <span
                key={filter}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800"
              >
                {filter}
              </span>
            ))}
            <Link
              href={buildAdminGoogleAccessHref('org-chart')}
              className="ml-auto text-sm font-medium text-amber-900 underline"
            >
              필터 초기화
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">표시 조직 수</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{visibleDepartmentCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">표시 직원 수</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {orgChartData.summary.totalEmployees}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="text-sm text-amber-700">관리자 연결 점검 필요</div>
          <div className="mt-2 text-2xl font-semibold text-amber-800">
            {orgChartData.summary.orphanedEmployees}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="text-sm text-rose-700">순환 보고 관계</div>
          <div className="mt-2 text-2xl font-semibold text-rose-800">
            {orgChartData.summary.cycleEmployees}
          </div>
        </div>
      </section>

      {orgChartData.orphanedEmployees.length ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">관리자 연결이 필요한 직원</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {orgChartData.orphanedEmployees.map((employee) => (
              <Link
                key={`orphan-${employee.id}`}
                href={buildAdminGoogleAccessHref('manage', { search: employee.employeeNumber })}
                className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-800"
              >
                {employee.name} ({employee.employeeNumber})
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {orgChartData.cycleEmployees.length ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-rose-900">순환 보고 관계가 있는 직원</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {orgChartData.cycleEmployees.map((employee) => (
              <Link
                key={`cycle-${employee.id}`}
                href={buildAdminGoogleAccessHref('manage', { search: employee.employeeNumber })}
                className="rounded-full border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-800"
              >
                {employee.name} ({employee.employeeNumber})
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">부서 트리 기준 조직도</h2>
          <p className="mt-1 text-sm text-slate-500">
            예전 조직도 관리 전용 페이지처럼 부서별로 직원을 펼쳐 보고, 필요한 경우 직원
            관리 화면으로 바로 이동할 수 있습니다.
          </p>
        </div>

        {departmentTree.length ? (
          <OrgChartDepartmentSection
            nodes={departmentTree}
            status={props.status ?? null}
          />
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            현재 필터 조건에 맞는 조직도 데이터가 없습니다.
          </section>
        )}
      </section>
    </div>
  )
}
