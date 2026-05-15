'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import type { OrgKpiScope } from '@/lib/org-kpi-scope'

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
  managerEmployeeNumber: string | null
}

type Feedback = { type: 'success' | 'error'; message: string } | null

type DeleteDepartmentResponse = {
  deletedDepartment: {
    id: string
    deptCode: string
    deptName: string
    parentDeptId: string | null
  }
  hierarchyUpdatedCount: number
}

type Props = {
  departments: DepartmentOption[]
  managerOptions: ManagerOption[]
  employees: EmployeeListItem[]
  selectedDepartmentId: string
  includeChildDepartments: boolean
  onSelectDepartment: (departmentId: string) => void
  onToggleIncludeChildDepartments: (next: boolean) => void
  onEditEmployee: (employeeId: string) => void
  onOpenCreateEmployee: () => void
  onOpenUpload: () => void
  onRefresh: () => Promise<void>
  onFeedback: (feedback: Feedback) => void
}

type DepartmentFormState = {
  departmentId?: string
  deptName: string
  departmentType: OrgKpiScope
  parentDeptId: string
  leaderEmployeeId: string
  excludeLeaderFromEvaluatorAutoAssign: boolean
}

type DepartmentNode = DepartmentOption & {
  children: DepartmentNode[]
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

const DEPARTMENT_TYPE_LABELS: Record<OrgKpiScope, string> = {
  division: '본부',
  section: '실',
  team: '팀',
}

const EMPTY_DEPARTMENT_FORM: DepartmentFormState = {
  deptName: '',
  departmentType: 'team',
  parentDeptId: '',
  leaderEmployeeId: '',
  excludeLeaderFromEvaluatorAutoAssign: false,
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청을 처리하는 중 문제가 발생했습니다.')
  }

  return payload.data as T
}

function buildDepartmentTree(departments: DepartmentOption[]) {
  const childrenByParentId = new Map<string | null, DepartmentOption[]>()
  for (const department of departments) {
    const bucket = childrenByParentId.get(department.parentDeptId) ?? []
    bucket.push(department)
    childrenByParentId.set(department.parentDeptId, bucket)
  }

  const buildNode = (department: DepartmentOption): DepartmentNode => ({
    ...department,
    children: (childrenByParentId.get(department.id) ?? [])
      .slice()
      .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
      .map(buildNode),
  })

  return (childrenByParentId.get(null) ?? [])
    .slice()
    .sort((left, right) => left.deptName.localeCompare(right.deptName, 'ko'))
    .map(buildNode)
}

function collectChildDepartmentIds(node: DepartmentNode): string[] {
  return [node.id, ...node.children.flatMap(collectChildDepartmentIds)]
}

function compareEmployees(left: EmployeeListItem, right: EmployeeListItem) {
  return (
    left.name.localeCompare(right.name, 'ko') ||
    left.employeeNumber.localeCompare(right.employeeNumber, 'ko')
  )
}

function DepartmentTreeNode(props: {
  node: DepartmentNode
  selectedDepartmentId: string
  onSelect: (departmentId: string) => void
  onEdit: (departmentId: string) => void
  onAddChild: (departmentId: string) => void
  level?: number
}) {
  const level = props.level ?? 0
  const isSelected = props.selectedDepartmentId === props.node.id

  return (
    <li className="space-y-2">
      <div
        className={`min-w-0 rounded-2xl border px-4 py-3 ${
          isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
        }`}
        style={{ marginLeft: `${level * 8}px` }}
      >
        <button
          type="button"
          onClick={() => props.onSelect(props.node.id)}
          title={props.node.deptName}
          className="block min-w-0 w-full text-left"
        >
          <div className="min-w-0 space-y-2">
            <div className="min-w-0">
              <div className="min-w-0 break-keep text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
                {props.node.deptName}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium leading-none text-blue-700">
                {DEPARTMENT_TYPE_LABELS[props.node.scope]}
              </span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium leading-none text-slate-600">
                {props.node.memberCount}명
              </span>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 break-keep text-[11px] leading-snug text-slate-500 sm:text-xs">
              {props.node.leaderEmployeeName ? (
                <span className="break-keep">리더 {props.node.leaderEmployeeName}</span>
              ) : null}
            </div>
          </div>
        </button>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
          <button
            type="button"
            onClick={() => props.onAddChild(props.node.id)}
            className="shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium leading-none text-slate-700"
          >
            하위 조직 추가
          </button>
          <button
            type="button"
            onClick={() => props.onEdit(props.node.id)}
            className="shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium leading-none text-slate-700"
          >
            수정
          </button>
        </div>
      </div>

      {props.node.children.length ? (
        <ul className="space-y-2">
          {props.node.children.map((child) => (
            <DepartmentTreeNode
              key={child.id}
              node={child}
              selectedDepartmentId={props.selectedDepartmentId}
              onSelect={props.onSelect}
              onEdit={props.onEdit}
              onAddChild={props.onAddChild}
              level={level + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function OrgMemberManagementPanel(props: Props) {
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false)
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(EMPTY_DEPARTMENT_FORM)
  const [isSavingDepartment, setIsSavingDepartment] = useState(false)
  const [departmentDeleteConfirmOpen, setDepartmentDeleteConfirmOpen] = useState(false)
  const [isDeletingDepartment, setIsDeletingDepartment] = useState(false)

  const departmentTree = useMemo(() => buildDepartmentTree(props.departments), [props.departments])

  const departmentNodeById = useMemo(() => {
    const map = new Map<string, DepartmentNode>()

    const walk = (node: DepartmentNode) => {
      map.set(node.id, node)
      node.children.forEach(walk)
    }

    departmentTree.forEach(walk)
    return map
  }, [departmentTree])

  const visibleDepartmentIds = useMemo(() => {
    if (!props.selectedDepartmentId) {
      return new Set(props.departments.map((department) => department.id))
    }

    const selectedNode = departmentNodeById.get(props.selectedDepartmentId)
    if (!selectedNode) {
      return new Set<string>()
    }

    return new Set(
      props.includeChildDepartments
        ? collectChildDepartmentIds(selectedNode)
        : [props.selectedDepartmentId]
    )
  }, [
    departmentNodeById,
    props.departments,
    props.includeChildDepartments,
    props.selectedDepartmentId,
  ])

  const visibleEmployees = useMemo(
    () =>
      props.employees
        .filter((employee) =>
          props.selectedDepartmentId ? visibleDepartmentIds.has(employee.departmentId) : true
        )
        .slice()
        .sort(compareEmployees),
    [props.employees, props.selectedDepartmentId, visibleDepartmentIds]
  )

  const selectedDepartment = props.departments.find(
    (department) => department.id === props.selectedDepartmentId
  )
  const editingDepartment = props.departments.find(
    (department) => department.id === departmentForm.departmentId
  )
  const editingDepartmentNode = editingDepartment
    ? departmentNodeById.get(editingDepartment.id) ?? null
    : null
  const editingDepartmentChildCount = editingDepartmentNode?.children.length ?? 0
  const editingDepartmentDescendantIds = editingDepartmentNode
    ? new Set(collectChildDepartmentIds(editingDepartmentNode))
    : new Set<string>()
  const departmentDeleteBlockers = editingDepartment
    ? [
        editingDepartmentChildCount > 0 ? `하위 조직 ${editingDepartmentChildCount}개` : null,
        editingDepartment.memberCount > 0 ? `소속 직원 ${editingDepartment.memberCount}명` : null,
        editingDepartment.orgKpiCount > 0 ? `조직 KPI ${editingDepartment.orgKpiCount}건` : null,
      ].filter((value): value is string => Boolean(value))
    : []
  const departmentDeleteBlockedReason = departmentDeleteBlockers.length
    ? `${departmentDeleteBlockers.join(', ')}이 남아 있어 삭제할 수 없습니다.`
    : null

  const allowedParentOptions = useMemo(() => {
    return props.departments.filter((department) => {
      if (department.id === departmentForm.departmentId) return false
      if (editingDepartmentDescendantIds.has(department.id)) return false

      if (departmentForm.departmentType === 'division') {
        return false
      }

      if (departmentForm.departmentType === 'section') {
        return department.scope === 'division'
      }

      return department.scope === 'division' || department.scope === 'section'
    })
  }, [departmentForm.departmentId, departmentForm.departmentType, editingDepartmentDescendantIds, props.departments])

  const selectedParentLabel = departmentForm.parentDeptId
    ? props.departments.find((department) => department.id === departmentForm.parentDeptId)?.deptName ?? null
    : null

  function closeDepartmentModal() {
    setDepartmentDeleteConfirmOpen(false)
    setDepartmentModalOpen(false)
    setDepartmentForm(EMPTY_DEPARTMENT_FORM)
  }

  function syncParentForType(nextType: OrgKpiScope, currentParentId: string) {
    if (!currentParentId) {
      return nextType === 'division' ? '' : currentParentId
    }

    const currentParent = props.departments.find((department) => department.id === currentParentId)
    if (!currentParent) {
      return ''
    }

    if (nextType === 'division') {
      return ''
    }

    if (nextType === 'section') {
      return currentParent.scope === 'division' ? currentParentId : ''
    }

    return currentParent.scope === 'division' || currentParent.scope === 'section'
      ? currentParentId
      : ''
  }

  function openCreateDepartment(parentDepartmentId?: string) {
    const parentDepartment = parentDepartmentId
      ? props.departments.find((department) => department.id === parentDepartmentId) ?? null
      : null
    const inferredType: OrgKpiScope =
      parentDepartment?.scope === 'section'
        ? 'team'
        : parentDepartment?.scope === 'division'
          ? 'team'
          : 'division'

    setDepartmentDeleteConfirmOpen(false)
    setDepartmentForm({
      ...EMPTY_DEPARTMENT_FORM,
      departmentType: inferredType,
      parentDeptId: inferredType === 'division' ? '' : parentDepartment?.id ?? '',
    })
    setDepartmentModalOpen(true)
  }

  function openEditDepartment(departmentId: string) {
    const department = props.departments.find((item) => item.id === departmentId)
    if (!department) return

    setDepartmentDeleteConfirmOpen(false)
    setDepartmentForm({
      departmentId: department.id,
      deptName: department.deptName,
      departmentType: department.scope,
      parentDeptId: department.parentDeptId ?? '',
      leaderEmployeeId: department.leaderEmployeeId ?? '',
      excludeLeaderFromEvaluatorAutoAssign: department.excludeLeaderFromEvaluatorAutoAssign,
    })
    setDepartmentModalOpen(true)
  }

  async function submitDepartment() {
    setIsSavingDepartment(true)
    props.onFeedback(null)

    try {
      const response = await fetch('/api/admin/employees/google-account/departments', {
        method: departmentForm.departmentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: departmentForm.departmentId,
          deptName: departmentForm.deptName,
          departmentType: departmentForm.departmentType,
          parentDeptId: departmentForm.parentDeptId || null,
          leaderEmployeeId: departmentForm.leaderEmployeeId || null,
          excludeLeaderFromEvaluatorAutoAssign:
            departmentForm.excludeLeaderFromEvaluatorAutoAssign,
        }),
      })

      const data = parseResponse<{ hierarchyUpdatedCount: number }>(await response.json())
      closeDepartmentModal()
      await props.onRefresh()
      props.onFeedback({
        type: 'success',
        message: `조직 정보를 저장했습니다. 평가 권한 연결 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
      })
    } catch (error) {
      props.onFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '조직 정보를 저장하지 못했습니다.',
      })
    } finally {
      setIsSavingDepartment(false)
    }
  }

  function openDeleteDepartmentConfirm() {
    props.onFeedback(null)

    if (!editingDepartment) {
      props.onFeedback({
        type: 'error',
        message: '삭제할 조직을 먼저 선택해 주세요.',
      })
      return
    }

    if (departmentDeleteBlockedReason) {
      props.onFeedback({
        type: 'error',
        message: departmentDeleteBlockedReason,
      })
      return
    }

    setDepartmentDeleteConfirmOpen(true)
  }

  async function deleteDepartment() {
    if (!editingDepartment || isDeletingDepartment) {
      return
    }

    setIsDeletingDepartment(true)
    props.onFeedback(null)

    try {
      const response = await fetch('/api/admin/employees/google-account/departments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: editingDepartment.id,
          confirmDelete: true,
        }),
      })

      const data = parseResponse<DeleteDepartmentResponse>(await response.json())
      const nextDepartmentId =
        props.selectedDepartmentId === data.deletedDepartment.id
          ? data.deletedDepartment.parentDeptId ?? ''
          : props.selectedDepartmentId

      if (props.selectedDepartmentId === data.deletedDepartment.id) {
        props.onSelectDepartment(nextDepartmentId)
      }

      closeDepartmentModal()
      await props.onRefresh()
      props.onFeedback({
        type: 'success',
        message: `${data.deletedDepartment.deptName} 조직을 삭제했습니다. 평가 권한 연결 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
      })
    } catch (error) {
      props.onFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '조직 삭제에 실패했습니다.',
      })
    } finally {
      setIsDeletingDepartment(false)
    }
  }

  function exportVisibleEmployees() {
    const rows = visibleEmployees.map((employee) => ({
      사번: employee.employeeNumber,
      이름: employee.name,
      조직: employee.departmentName,
      조직코드: employee.departmentCode,
      역할: ROLE_LABELS[employee.role],
      상태: STATUS_LABELS[employee.employmentStatus],
      직속관리자: employee.managerEmployeeNumber ?? '',
      Google계정: employee.googleEmail,
    }))

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, sheet, 'Employees')
    XLSX.writeFile(workbook, 'org-members.xlsx')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">조직 · 구성원 관리</h2>
            <p className="mt-1 text-sm text-slate-500">
              조직 트리를 직접 관리하고, 같은 화면에서 소속 직원과 조직 리더를 함께 정리할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                selectedDepartment ? openEditDepartment(selectedDepartment.id) : openCreateDepartment()
              }
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium leading-none text-slate-700"
            >
              {selectedDepartment ? '선택 조직 수정' : '조직 추가'}
            </button>
            <button
              type="button"
              onClick={props.onOpenCreateEmployee}
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium leading-none text-slate-700"
            >
              구성원 추가
            </button>
            <button
              type="button"
              onClick={props.onOpenUpload}
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium leading-none text-slate-700"
            >
              일괄 업로드
            </button>
            <button
              type="button"
              onClick={exportVisibleEmployees}
              className="shrink-0 whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium leading-none text-white"
            >
              구성원 엑셀 다운로드
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(420px,0.95fr)_minmax(0,1.05fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-medium text-slate-900">조직 트리</h3>
                <button
                  type="button"
                  onClick={() => openCreateDepartment()}
                  className="shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium leading-none text-slate-700"
                >
                  조직 추가
                </button>
            </div>
            <ul className="space-y-3">
              {departmentTree.map((node) => (
                <DepartmentTreeNode
                  key={node.id}
                  node={node}
                  selectedDepartmentId={props.selectedDepartmentId}
                  onSelect={props.onSelectDepartment}
                  onEdit={openEditDepartment}
                  onAddChild={openCreateDepartment}
                />
              ))}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="font-medium text-slate-900">
                  {selectedDepartment ? `${selectedDepartment.deptName} 구성원` : '전체 구성원'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  현재 표시 {visibleEmployees.length}명 / 전체 {props.employees.length}명
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={props.includeChildDepartments}
                  onChange={(event) => props.onToggleIncludeChildDepartments(event.target.checked)}
                />
                하위 조직 포함
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">이름</th>
                    <th className="px-3 py-2">소속 조직</th>
                    <th className="px-3 py-2">역할</th>
                    <th className="px-3 py-2">이메일</th>
                    <th className="px-3 py-2">상태</th>
                    <th className="px-3 py-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">
                          {employee.name} ({employee.employeeNumber})
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {employee.teamName || '팀 미지정'}
                          {employee.jobTitle ? ` · ${employee.jobTitle}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-700">{employee.departmentName}</div>
                      </td>
                      <td className="px-3 py-3">{ROLE_LABELS[employee.role]}</td>
                      <td className="px-3 py-3 text-slate-700">{employee.googleEmail}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs leading-none text-slate-700">
                          {STATUS_LABELS[employee.employmentStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => props.onEditEmployee(employee.id)}
                          className="shrink-0 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium leading-none text-slate-700"
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!visibleEmployees.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                        선택한 조건에 맞는 구성원이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {departmentModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {departmentForm.departmentId ? '조직 수정' : '조직 추가'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  조직명, 조직 유형, 상위 조직, 리더를 함께 관리합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDepartmentModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                닫기
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>조직명</span>
                <input
                  value={departmentForm.deptName}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({ ...current, deptName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>조직 유형</span>
                <select
                  value={departmentForm.departmentType}
                  onChange={(event) => {
                    const nextType = event.target.value as OrgKpiScope
                    setDepartmentForm((current) => ({
                      ...current,
                      departmentType: nextType,
                      parentDeptId: syncParentForType(nextType, current.parentDeptId),
                    }))
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="division">본부</option>
                  <option value="section">실</option>
                  <option value="team">팀</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>상위 조직</span>
                <select
                  value={departmentForm.parentDeptId}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({ ...current, parentDeptId: event.target.value }))
                  }
                  disabled={departmentForm.departmentType === 'division'}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="">
                    {departmentForm.departmentType === 'division' ? '최상위 조직' : '상위 조직 선택'}
                  </option>
                  {allowedParentOptions.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.deptName} · {DEPARTMENT_TYPE_LABELS[department.scope]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
                <span>조직 리더</span>
                <select
                  value={departmentForm.leaderEmployeeId}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      leaderEmployeeId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">조직 리더 미지정</option>
                  {props.managerOptions
                    .filter((manager) => manager.employmentStatus === 'ACTIVE')
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} ({manager.employeeNumber}) / {manager.departmentName}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">이동/저장 전 확인</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                <li>조직 유형과 상위 조직 조합은 서버에서 다시 검증합니다.</li>
                <li>본부는 최상위만 허용됩니다.</li>
                <li>실은 본부 아래만 허용되며, 조직명은 "실"로 끝나야 합니다.</li>
                <li>팀은 본부 또는 실 아래로만 이동할 수 있습니다.</li>
                {selectedParentLabel ? <li>현재 선택한 상위 조직: {selectedParentLabel}</li> : null}
              </ul>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={departmentForm.excludeLeaderFromEvaluatorAutoAssign}
                onChange={(event) =>
                  setDepartmentForm((current) => ({
                    ...current,
                    excludeLeaderFromEvaluatorAutoAssign: event.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>
                이 조직의 리더를 평가 권한 자동 지정 대상에서 제외
                <span className="mt-1 block text-xs text-slate-500">
                  리더 연결은 유지하되, 평가자 자동 지정 미리보기에는 포함하지 않습니다.
                </span>
              </span>
            </label>

            {departmentForm.departmentId ? (
              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                <div className="font-semibold">조직 삭제 안내</div>
                <p className="mt-1">
                  삭제 전 의존성을 확인합니다. 하위 조직, 소속 직원, 조직 KPI가 남아 있으면 서버에서 차단됩니다.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-red-600">
                  <li>하위 조직 수: {editingDepartmentChildCount}</li>
                  <li>소속 직원 수: {editingDepartment?.memberCount ?? 0}</li>
                  <li>연결된 조직 KPI 수: {editingDepartment?.orgKpiCount ?? 0}</li>
                </ul>
                {departmentDeleteBlockedReason ? (
                  <p className="mt-2 text-xs text-red-600">{departmentDeleteBlockedReason}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              {departmentForm.departmentId ? (
                <button
                  type="button"
                  data-testid="department-delete-button"
                  onClick={openDeleteDepartmentConfirm}
                  disabled={isDeletingDepartment || Boolean(departmentDeleteBlockedReason)}
                  title={departmentDeleteBlockedReason ?? undefined}
                  className="mr-auto rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  삭제
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeDepartmentModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitDepartment}
                disabled={isSavingDepartment}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isSavingDepartment ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {departmentDeleteConfirmOpen && editingDepartment ? (
        <div
          data-testid="department-delete-dialog"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">조직 삭제</h3>
            <p className="mt-2 text-sm text-slate-600">
              삭제 전에 하위 조직, 직원, KPI 연결 여부를 다시 확인해 주세요. 이 작업은 되돌릴 수 없습니다.
            </p>

            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
              <div className="text-sm font-semibold text-red-800">삭제 대상</div>
              <div data-testid="department-delete-name" className="mt-2 text-base font-semibold text-red-900">
                {editingDepartment.deptName}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-red-700">
                <li>하위 조직 수: {editingDepartmentChildCount}</li>
                <li>소속 직원 수: {editingDepartment.memberCount}</li>
                <li>연결된 조직 KPI 수: {editingDepartment.orgKpiCount}</li>
              </ul>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                data-testid="department-delete-cancel"
                onClick={() => setDepartmentDeleteConfirmOpen(false)}
                disabled={isDeletingDepartment}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                data-testid="department-delete-confirm"
                onClick={deleteDepartment}
                disabled={isDeletingDepartment}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isDeletingDepartment ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
