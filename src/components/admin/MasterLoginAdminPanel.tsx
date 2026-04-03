'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type EmployeeRole =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'

type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RESIGNED'

type EmployeeListItem = {
  id: string
  employeeNumber: string
  name: string
  googleEmail: string
  departmentName: string
  jobTitle: string | null
  role: EmployeeRole
  employmentStatus: EmployeeStatus
  loginEnabled: boolean
}

type Props = {
  employees: EmployeeListItem[]
  onFeedback: (feedback: { type: 'success' | 'error'; message: string } | null) => void
}

type MasterLoginPreviewResponse = {
  readOnly: true
  employee: {
    id: string
    employeeNumber: string
    name: string
    googleEmail: string
    role: EmployeeRole
    employmentStatus: EmployeeStatus
    departmentName: string
    departmentCode: string
    loginEnabled: boolean
  }
  actor: {
    id: string
    name: string
    email: string
  }
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '마스터 로그인 요청을 처리하는 중 문제가 발생했습니다.')
  }

  return payload.data as T
}

function roleLabel(role: EmployeeRole) {
  switch (role) {
    case 'ROLE_TEAM_LEADER':
      return '팀장'
    case 'ROLE_SECTION_CHIEF':
      return '실장/부문장'
    case 'ROLE_DIV_HEAD':
      return '본부장'
    case 'ROLE_CEO':
      return 'CEO'
    case 'ROLE_ADMIN':
      return 'HR 관리자'
    case 'ROLE_MEMBER':
    default:
      return '구성원'
  }
}

function statusLabel(status: EmployeeStatus) {
  switch (status) {
    case 'ACTIVE':
      return '재직'
    case 'INACTIVE':
      return '비활성'
    case 'ON_LEAVE':
      return '휴직'
    case 'RESIGNED':
      return '퇴사'
  }
}

export function MasterLoginAdminPanel({ employees, onFeedback }: Props) {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null)

  const masterLoginAvailable = session?.user?.masterLoginAvailable ?? false
  const activeCount = employees.filter((employee) => employee.employmentStatus === 'ACTIVE').length

  async function startMasterLogin(employee: EmployeeListItem) {
    setPendingEmployeeId(employee.id)
    onFeedback(null)

    try {
      const previewResponse = await fetch('/api/admin/employees/google-account/master-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmployeeId: employee.id }),
      })

      const preview = parseResponse<MasterLoginPreviewResponse>(await previewResponse.json())
      await update({
        masterLogin: {
          action: 'start',
          targetEmployeeId: preview.employee.id,
        },
      })

      onFeedback({
        type: 'success',
        message: `${preview.employee.name}(${preview.employee.employeeNumber}) 계정으로 읽기 전용 마스터 로그인을 시작했습니다.`,
      })
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      onFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : '마스터 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      })
    } finally {
      setPendingEmployeeId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">마스터 로그인</h2>
            <p className="mt-1 text-sm text-slate-600">
              허용된 관리자만 구성원 계정으로 직접 접속해 화면을 읽기 전용으로 확인할 수 있습니다.
              시작 후에는 상단 배너에서 종료할 수 있으며, 쓰기 동작은 모두 차단됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">표시 {employees.length}명</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">재직 {activeCount}명</span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">읽기 전용</span>
          </div>
        </div>
      </section>

      {status === 'authenticated' && !masterLoginAvailable ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          마스터 로그인은 소유자 또는 허용된 관리자만 사용할 수 있습니다. 현재 계정은 이 기능을 사용할 수 없습니다.
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">구성원 계정 목록</h3>
            <p className="mt-1 text-sm text-slate-500">
              현재 필터 결과에서 바로 읽기 전용 접속을 시작할 수 있습니다.
            </p>
          </div>
          <div className="text-sm text-slate-500">현재 표시 {employees.length}명</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-2">구성원</th>
                <th className="px-3 py-2">이메일</th>
                <th className="px-3 py-2">소속</th>
                <th className="px-3 py-2">권한 / 상태</th>
                <th className="px-3 py-2">접속</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const blocked =
                  status !== 'authenticated' ||
                  !masterLoginAvailable ||
                  employee.employmentStatus !== 'ACTIVE'
                const isPending = pendingEmployeeId === employee.id

                return (
                  <tr key={employee.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {employee.name} ({employee.employeeNumber})
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {employee.jobTitle ? employee.jobTitle : '직함 정보 없음'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{employee.googleEmail}</td>
                    <td className="px-3 py-3 text-slate-700">{employee.departmentName}</td>
                    <td className="px-3 py-3">
                      <div className="text-slate-700">{roleLabel(employee.role)}</div>
                      <div className="mt-1 text-xs text-slate-500">{statusLabel(employee.employmentStatus)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={blocked || isPending}
                        onClick={() => startMasterLogin(employee)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? '접속 준비 중...' : '읽기 전용으로 접속'}
                      </button>
                    </td>
                  </tr>
                )
              })}

              {!employees.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">
                    현재 필터 조건에 맞는 구성원이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
