import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLE_LABELS } from '@/lib/utils'

type EmployeeNode = {
  id: string
  empId: string
  empName: string
  gwsEmail: string
  role: string
  status: string
  joinDate: string
  teamLeaderId: string | null
  sectionChiefId: string | null
  divisionHeadId: string | null
}

type OrgNode = {
  id: string
  deptCode: string
  deptName: string
  parentDeptId: string | null
  activeCount: number
  leaders: {
    teamLeader: string | null
    sectionChief: string | null
    divisionHead: string | null
  }
  employees: EmployeeNode[]
  children: OrgNode[]
}

function buildOrgTree(
  departments: Array<{
    id: string
    deptCode: string
    deptName: string
    parentDeptId: string | null
    employees: EmployeeNode[]
  }>
) {
  const nodeMap = new Map<string, OrgNode>()

  for (const department of departments) {
    const activeEmployees = department.employees.filter((employee) => employee.status === 'ACTIVE')
    nodeMap.set(department.id, {
      id: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
      parentDeptId: department.parentDeptId,
      activeCount: activeEmployees.length,
      leaders: {
        teamLeader:
          activeEmployees.find((employee) => employee.role === 'ROLE_TEAM_LEADER')?.empName ?? null,
        sectionChief:
          activeEmployees.find((employee) => employee.role === 'ROLE_SECTION_CHIEF')?.empName ?? null,
        divisionHead:
          activeEmployees.find((employee) => employee.role === 'ROLE_DIV_HEAD')?.empName ?? null,
      },
      employees: department.employees.sort((a, b) => a.empName.localeCompare(b.empName, 'ko')),
      children: [],
    })
  }

  const roots: OrgNode[] = []

  for (const node of nodeMap.values()) {
    if (node.parentDeptId && nodeMap.has(node.parentDeptId)) {
      nodeMap.get(node.parentDeptId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (nodes: OrgNode[]) => {
    nodes.sort((a, b) => a.deptName.localeCompare(b.deptName, 'ko'))
    for (const node of nodes) {
      sortNodes(node.children)
    }
  }

  sortNodes(roots)
  return roots
}

function EmployeeDetailCard({
  employee,
  employeeNameMap,
}: {
  employee: EmployeeNode
  employeeNameMap: Map<string, string>
}) {
  return (
    <details id={`employee-${employee.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium text-slate-900">
              {employee.empName} ({employee.empId})
            </div>
            <div className="text-xs text-slate-500">
              {ROLE_LABELS[employee.role] ?? employee.role} / {employee.status}
            </div>
          </div>
          <div className="text-xs text-slate-500">상세 보기</div>
        </div>
      </summary>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg bg-white p-3 text-sm">
          <div className="text-slate-500">Google 이메일</div>
          <div className="mt-1 font-medium text-slate-900">{employee.gwsEmail || '미등록'}</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-sm">
          <div className="text-slate-500">입사일</div>
          <div className="mt-1 font-medium text-slate-900">{employee.joinDate}</div>
        </div>
        <div className="rounded-lg bg-white p-3 text-sm">
          <div className="text-slate-500">팀장</div>
          <div className="mt-1 font-medium text-slate-900">
            {employee.teamLeaderId ? employeeNameMap.get(employee.teamLeaderId) ?? '미지정' : '미지정'}
          </div>
        </div>
        <div className="rounded-lg bg-white p-3 text-sm">
          <div className="text-slate-500">부서장</div>
          <div className="mt-1 font-medium text-slate-900">
            {employee.sectionChiefId
              ? employeeNameMap.get(employee.sectionChiefId) ?? '미지정'
              : '미지정'}
          </div>
        </div>
        <div className="rounded-lg bg-white p-3 text-sm">
          <div className="text-slate-500">본부장</div>
          <div className="mt-1 font-medium text-slate-900">
            {employee.divisionHeadId
              ? employeeNameMap.get(employee.divisionHeadId) ?? '미지정'
              : '미지정'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Link
          href={`/admin/google-access?q=${encodeURIComponent(employee.empId)}&employeeId=${encodeURIComponent(employee.id)}&returnTo=${encodeURIComponent(`/admin/org-chart#employee-${employee.id}`)}#employee-${employee.id}`}
          className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700"
        >
          이 직원 수정으로 이동
        </Link>
      </div>
    </details>
  )
}

function OrgTreeSection({
  nodes,
  employeeNameMap,
  level = 0,
}: {
  nodes: OrgNode[]
  employeeNameMap: Map<string, string>
  level?: number
}) {
  return (
    <div className={level === 0 ? 'space-y-4' : 'mt-4 space-y-4 pl-4 md:pl-8'}>
      {nodes.map((node) => (
        <details
          key={node.id}
          open={level === 0}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {node.deptName}
                  <span className="ml-2 text-sm font-medium text-slate-500">({node.deptCode})</span>
                </div>
                <div className="mt-1 text-sm text-slate-500">재직 인원 {node.activeCount}명</div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                  팀장: {node.leaders.teamLeader ?? '미지정'}
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                  부서장: {node.leaders.sectionChief ?? '미지정'}
                </span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">
                  본부장: {node.leaders.divisionHead ?? '미지정'}
                </span>
              </div>
            </div>
          </summary>

          {!!node.employees.length && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-800">직원 상세</div>
              <div className="space-y-3">
                {node.employees.map((employee) => (
                  <EmployeeDetailCard
                    key={employee.id}
                    employee={employee}
                    employeeNameMap={employeeNameMap}
                  />
                ))}
              </div>
            </div>
          )}

          {!!node.children.length && (
            <OrgTreeSection
              nodes={node.children}
              employeeNameMap={employeeNameMap}
              level={level + 1}
            />
          )}
        </details>
      ))}
    </div>
  )
}

export default async function AdminOrgChartPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }
  if (session.user.role !== 'ROLE_ADMIN') {
    redirect('/dashboard')
  }

  const [departments, employees, recentUpload] = await Promise.all([
    prisma.department.findMany({
      select: {
        id: true,
        deptCode: true,
        deptName: true,
        parentDeptId: true,
        employees: {
          select: {
            id: true,
            empId: true,
            empName: true,
            gwsEmail: true,
            role: true,
            status: true,
            joinDate: true,
            teamLeaderId: true,
            sectionChiefId: true,
            divisionHeadId: true,
          },
        },
      },
      orderBy: {
        deptName: 'asc',
      },
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        empName: true,
        role: true,
        status: true,
      },
    }),
    prisma.uploadHistory.findFirst({
      where: {
        uploadType: 'EMPLOYEE_BULK',
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    }),
  ])

  const employeeNameMap = new Map(employees.map((employee) => [employee.id, employee.empName]))
  const tree = buildOrgTree(
    departments.map((department) => ({
      ...department,
      employees: department.employees.map((employee) => ({
        ...employee,
        joinDate: employee.joinDate.toISOString().slice(0, 10),
      })),
    }))
  )
  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE')
  const roleCounts = {
    teamLeaders: activeEmployees.filter((employee) => employee.role === 'ROLE_TEAM_LEADER').length,
    sectionChiefs: activeEmployees.filter((employee) => employee.role === 'ROLE_SECTION_CHIEF').length,
    divisionHeads: activeEmployees.filter((employee) => employee.role === 'ROLE_DIV_HEAD').length,
    admins: activeEmployees.filter((employee) => employee.role === 'ROLE_ADMIN').length,
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h1 className="text-2xl font-bold text-slate-900">조직도 관리</h1>
        <p className="mt-2 text-sm text-slate-700">
          직원 일괄업로드와 role 변경 결과가 조직도에 자동 반영됩니다.
        </p>
        {recentUpload && (
          <p className="mt-2 text-sm text-slate-600">
            최근 업로드: {recentUpload.fileName} /{' '}
            {recentUpload.uploadedAt.toISOString().slice(0, 16).replace('T', ' ')}
          </p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">부서 수</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{departments.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">재직 인원</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{activeEmployees.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">{ROLE_LABELS.ROLE_TEAM_LEADER}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{roleCounts.teamLeaders}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">부서장 / 본부장 / 관리자</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {roleCounts.sectionChiefs + roleCounts.divisionHeads + roleCounts.admins}
          </div>
        </div>
      </section>

      {!tree.length ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          등록된 부서와 직원이 아직 없습니다. Google 계정 등록 화면에서 템플릿으로 직원을 업로드하면
          조직도가 자동으로 구성됩니다.
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">현재 조직 구조</h2>
            <p className="mt-1 text-sm text-slate-500">
              부서를 펼치면 해당 부서 직원 목록이 나오고, 직원을 펼치면 이메일과 상위 조직장 체계까지
              상세하게 확인할 수 있습니다.
            </p>
          </div>
          <OrgTreeSection nodes={tree} employeeNameMap={employeeNameMap} />
        </section>
      )}
    </div>
  )
}
