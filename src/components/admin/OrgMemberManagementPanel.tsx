'use client'

import { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

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
  deptCode: string
  deptName: string
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

const EMPTY_DEPARTMENT_FORM: DepartmentFormState = {
  deptCode: '',
  deptName: '',
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

function DepartmentTreeNode(props: {
  node: DepartmentNode
  selectedDepartmentId: string
  onSelect: (departmentId: string) => void
  onEdit: (departmentId: string) => void
  level?: number
}) {
  const level = props.level ?? 0
  const isSelected = props.selectedDepartmentId === props.node.id

  return (
    <li className="space-y-2">
      <div
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'
        }`}
        style={{ marginLeft: `${level * 12}px` }}
      >
        <button
          type="button"
          onClick={() => props.onSelect(props.node.id)}
          className="flex-1 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-slate-900">{props.node.deptName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {props.node.memberCount}명
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {props.node.deptCode}
            {props.node.leaderEmployeeName ? ` · 리더 ${props.node.leaderEmployeeName}` : ''}
          </div>
        </button>
        <button
          type="button"
          onClick={() => props.onEdit(props.node.id)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
        >
          설정
        </button>
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
      props.employees.filter((employee) =>
        props.selectedDepartmentId ? visibleDepartmentIds.has(employee.departmentId) : true
      ),
    [props.employees, props.selectedDepartmentId, visibleDepartmentIds]
  )

  const selectedDepartment = props.departments.find(
    (department) => department.id === props.selectedDepartmentId
  )
  const editingDepartment = props.departments.find(
    (department) => department.id === departmentForm.departmentId
  )
  const editingDepartmentChildCount = editingDepartment
    ? props.departments.filter((department) => department.parentDeptId === editingDepartment.id).length
    : 0
  const departmentDeleteBlockers = editingDepartment
    ? [
        editingDepartmentChildCount > 0 ? `하위 조직 ${editingDepartmentChildCount}개` : null,
        editingDepartment.memberCount > 0 ? `구성원 ${editingDepartment.memberCount}명` : null,
        editingDepartment.orgKpiCount > 0 ? `조직 KPI ${editingDepartment.orgKpiCount}건` : null,
      ].filter((value): value is string => Boolean(value))
    : []
  const departmentDeleteBlockedReason = departmentDeleteBlockers.length
    ? `${departmentDeleteBlockers.join(', ')}이 남아 있어 삭제할 수 없습니다.`
    : null

  function closeDepartmentModal() {
    setDepartmentDeleteConfirmOpen(false)
    setDepartmentModalOpen(false)
    setDepartmentForm(EMPTY_DEPARTMENT_FORM)
  }

  function openCreateDepartment() {
    setDepartmentDeleteConfirmOpen(false)
    setDepartmentForm({
      ...EMPTY_DEPARTMENT_FORM,
      parentDeptId: props.selectedDepartmentId || '',
    })
    setDepartmentModalOpen(true)
  }

  function openEditDepartment(departmentId: string) {
    const department = props.departments.find((item) => item.id === departmentId)
    if (!department) return

    setDepartmentDeleteConfirmOpen(false)
    setDepartmentForm({
      departmentId: department.id,
      deptCode: department.deptCode,
      deptName: department.deptName,
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
          deptCode: departmentForm.deptCode,
          deptName: departmentForm.deptName,
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
        message: `조직 정보를 저장했습니다. 평가권자 연결 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
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
        message: `${data.deletedDepartment.deptName} 조직을 삭제했습니다. 평가권자 연결 ${data.hierarchyUpdatedCount}건을 다시 계산했습니다.`,
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
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">조직 · 구성원 관리</h2>
            <p className="mt-1 text-sm text-slate-500">
              좌측 조직 트리와 우측 구성원 목록을 함께 보면서 조직 리더와 구성원을 운영할 수
              있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (selectedDepartment ? openEditDepartment(selectedDepartment.id) : openCreateDepartment())}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {selectedDepartment ? '선택 조직 설정' : '조직 추가'}
            </button>
            <button
              type="button"
              onClick={props.onOpenCreateEmployee}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              구성원 추가
            </button>
            <button
              type="button"
              onClick={props.onOpenUpload}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              엑셀 일괄 수정
            </button>
            <button
              type="button"
              onClick={exportVisibleEmployees}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              구성원 엑셀 다운로드
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-slate-900">조직</h3>
              <button
                type="button"
                onClick={openCreateDepartment}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                조직 추가
              </button>
            </div>
            <ul className="space-y-2">
              {departmentTree.map((node) => (
                <DepartmentTreeNode
                  key={node.id}
                  node={node}
                  selectedDepartmentId={props.selectedDepartmentId}
                  onSelect={props.onSelectDepartment}
                  onEdit={openEditDepartment}
                />
              ))}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                        <div className="mt-1 text-xs text-slate-500">{employee.departmentCode}</div>
                      </td>
                      <td className="px-3 py-3">{ROLE_LABELS[employee.role]}</td>
                      <td className="px-3 py-3 text-slate-700">{employee.googleEmail}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {STATUS_LABELS[employee.employmentStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => props.onEditEmployee(employee.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
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
                  {departmentForm.departmentId ? '조직 정보 수정' : '조직 추가'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  조직 리더와 평가권자 자동 지정 제외 옵션을 함께 관리할 수 있습니다.
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
                <span>조직 코드</span>
                <input
                  value={departmentForm.deptCode}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({ ...current, deptCode: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>조직 이름</span>
                <input
                  value={departmentForm.deptName}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({ ...current, deptName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>상위 조직</span>
                <select
                  value={departmentForm.parentDeptId}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({ ...current, parentDeptId: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                >
                  <option value="">최상위 조직</option>
                  {props.departments
                    .filter((department) => department.id !== departmentForm.departmentId)
                    .map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.deptName} ({department.deptCode})
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
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
                이 조직의 리더를 평가권자 일괄 지정 대상에서 제외
                <span className="mt-1 block text-xs text-slate-500">
                  조직 리더 정보는 유지하되, 평가권자 자동 지정 preview와 저장에는 포함하지 않습니다.
                </span>
              </span>
            </label>

            {departmentForm.departmentId ? (
              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                <div className="font-semibold">조직 삭제</div>
                <p className="mt-1">
                  삭제 후에는 되돌릴 수 없습니다. 하위 조직, 구성원, 조직 KPI가 남아 있으면 삭제가 차단됩니다.
                </p>
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
              삭제 후에는 되돌릴 수 없습니다. 삭제할 조직과 연결 상태를 다시 확인한 뒤 진행해 주세요.
            </p>

            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
              <div className="text-sm font-semibold text-red-800">삭제 대상</div>
              <div data-testid="department-delete-name" className="mt-2 text-base font-semibold text-red-900">
                {editingDepartment.deptName} ({editingDepartment.deptCode})
              </div>
              <p className="mt-2 text-sm text-red-700">
                하위 조직이나 구성원이 남아 있으면 삭제가 차단되며, 이 작업은 되돌릴 수 없습니다.
              </p>
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
