'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  createImpersonationSyncPayload,
  IMPERSONATION_SYNC_STORAGE_KEY,
} from '@/lib/impersonation'
import {
  isFixedMasterLoginAccessSource,
  resolveMasterLoginPermissionManagementState,
  resolveMasterLoginPermissionToggleState,
} from '@/lib/master-login'

type EmployeeRole =
  | 'ROLE_MEMBER'
  | 'ROLE_TEAM_LEADER'
  | 'ROLE_SECTION_CHIEF'
  | 'ROLE_DIV_HEAD'
  | 'ROLE_CEO'
  | 'ROLE_ADMIN'

type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RESIGNED'

type MasterLoginAccessSource = 'owner' | 'legacy_admin' | 'granted_hr_admin' | 'none'

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
  masterLoginPermissionGranted: boolean
  masterLoginAccessSource: MasterLoginAccessSource
  masterLoginAvailable: boolean
}

type Props = {
  employees: EmployeeListItem[]
  onFeedback: (feedback: { type: 'success' | 'error'; message: string } | null) => void
  onRefresh: () => Promise<void>
}

type MasterLoginPreviewResponse = {
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
  reason: string
}

type MasterLoginPermissionResponse = {
  targetUserId: string
  permissionKey: string
  enabled: boolean
  accessSource: MasterLoginAccessSource
  effectiveAccess: boolean
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

function accessSourceLabel(source: MasterLoginAccessSource) {
  switch (source) {
    case 'owner':
      return '소유자 기본 권한'
    case 'legacy_admin':
      return '기존 허용 관리자'
    case 'granted_hr_admin':
      return '권한 부여됨'
    case 'none':
    default:
      return '권한 없음'
  }
}

function accessSourceTone(source: MasterLoginAccessSource) {
  switch (source) {
    case 'owner':
      return 'bg-blue-50 text-blue-700'
    case 'legacy_admin':
      return 'bg-violet-50 text-violet-700'
    case 'granted_hr_admin':
      return 'bg-emerald-50 text-emerald-700'
    case 'none':
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function formatActiveMasterLogin(session: ReturnType<typeof useSession>['data']) {
  return session?.user?.masterLogin?.active ? session.user.masterLogin : null
}

export function MasterLoginAdminPanel({ employees, onFeedback, onRefresh }: Props) {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null)
  const [pendingPermissionEmployeeId, setPendingPermissionEmployeeId] = useState<string | null>(
    null
  )
  const [dialogTarget, setDialogTarget] = useState<EmployeeListItem | null>(null)
  const [dialogReason, setDialogReason] = useState('')
  const [dialogError, setDialogError] = useState<string | null>(null)

  const masterLoginAvailable = session?.user?.masterLoginAvailable ?? false
  const activeCount = employees.filter((employee) => employee.employmentStatus === 'ACTIVE').length
  const activeMasterLogin = formatActiveMasterLogin(session)
  const hrAdmins = useMemo(
    () => employees.filter((employee) => employee.role === 'ROLE_ADMIN'),
    [employees]
  )
  const directGrantCount = hrAdmins.filter((employee) => employee.masterLoginPermissionGranted).length
  const availableAdminCount = hrAdmins.filter((employee) => employee.masterLoginAvailable).length
  const permissionManagement = resolveMasterLoginPermissionManagementState({
    isAuthenticated: status === 'authenticated',
    hasActiveMasterLogin: Boolean(activeMasterLogin),
  })
  const permissionManagementBlocked = !permissionManagement.allowed

  const selectedTargetSummary = useMemo(() => {
    if (!dialogTarget) {
      return null
    }

    return `${dialogTarget.name} (${dialogTarget.employeeNumber})`
  }, [dialogTarget])

  function openStartDialog(employee: EmployeeListItem) {
    onFeedback(null)

    if (activeMasterLogin) {
      onFeedback({
        type: 'error',
        message: '이미 마스터 로그인 중입니다. 현재 세션을 종료한 뒤 다른 계정으로 다시 시작해 주세요.',
      })
      return
    }

    setDialogTarget(employee)
    setDialogReason('')
    setDialogError(null)
  }

  function closeDialog() {
    if (pendingEmployeeId) {
      return
    }

    setDialogTarget(null)
    setDialogReason('')
    setDialogError(null)
  }

  async function saveMasterLoginPermission(employee: EmployeeListItem, enabled: boolean) {
    const toggleState = resolveMasterLoginPermissionToggleState({
      isAuthenticated: status === 'authenticated',
      hasActiveMasterLogin: Boolean(activeMasterLogin),
      accessSource: employee.masterLoginAccessSource,
      pending: false,
    })

    if (toggleState.disabled) {
      if (toggleState.message) {
        onFeedback({
          type: 'error',
          message: toggleState.message,
        })
      }
      return
    }

    setPendingPermissionEmployeeId(employee.id)
    onFeedback(null)

    try {
      await fetch('/api/admin/employees/google-account/master-login', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmployeeId: employee.id,
          enabled,
        }),
      }).then(async (response) =>
        parseResponse<MasterLoginPermissionResponse>(await response.json())
      )

      await Promise.all([onRefresh(), update()])

      onFeedback({
        type: 'success',
        message: '권한이 저장되었습니다.',
      })
    } catch (error) {
      onFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : '권한 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      })
    } finally {
      setPendingPermissionEmployeeId(null)
    }
  }

  async function startMasterLogin() {
    if (!dialogTarget) {
      return
    }

    const reason = dialogReason.trim()
    if (reason.length < 10) {
      setDialogError('마스터 로그인 사유를 10자 이상 입력해 주세요.')
      return
    }

    setPendingEmployeeId(dialogTarget.id)
    setDialogError(null)
    onFeedback(null)

    try {
      const previewResponse = await fetch('/api/admin/employees/google-account/master-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmployeeId: dialogTarget.id, reason }),
      })

      const preview = parseResponse<MasterLoginPreviewResponse>(await previewResponse.json())
      const nextSession = await update({
        masterLogin: {
          action: 'start',
          targetEmployeeId: preview.employee.id,
          reason,
        },
      })

      const sessionId =
        nextSession && typeof nextSession === 'object' && 'user' in nextSession
          ? (nextSession.user as { masterLogin?: { sessionId?: string } | null }).masterLogin
              ?.sessionId
          : undefined

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          IMPERSONATION_SYNC_STORAGE_KEY,
          createImpersonationSyncPayload('start', sessionId)
        )
      }

      setDialogTarget(null)
      setDialogReason('')
      onFeedback({
        type: 'success',
        message: `${preview.employee.name}(${preview.employee.employeeNumber}) 계정으로 마스터 로그인을 시작했습니다.`,
      })
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      setDialogError(
        error instanceof Error
          ? error.message
          : '마스터 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      )
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
              소유자 또는 권한이 부여된 HR관리자는 특정 구성원 계정으로 로그인해 동일한 권한 범위의
              화면과 기능을 점검할 수 있습니다. 모든 행동은 감사 로그에 기록되고, 시작 전에 사유 입력과
              확인 절차가 필요합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">전체 {employees.length}명</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">재직 {activeCount}명</span>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
              감사 로그 기록
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">마스터 로그인 권한</h3>
            <p className="mt-1 text-sm text-slate-500">
              특정 구성원 계정으로 로그인해 동일한 권한 범위의 화면과 기능을 점검할 수 있습니다. 모든
              행동은 감사 로그에 기록됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">HR 관리자 {hrAdmins.length}명</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              직접 부여 {directGrantCount}명
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
              사용 가능 {availableAdminCount}명
            </span>
          </div>
        </div>

        {permissionManagementBlocked ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {activeMasterLogin
              ? '마스터 로그인 중에는 권한을 변경할 수 없습니다. 먼저 현재 세션을 종료해 주세요.'
              : '마스터 로그인 권한 관리는 소유자 또는 권한이 부여된 HR관리자만 사용할 수 있습니다.'}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-2">HR 관리자</th>
                <th className="px-3 py-2">소속</th>
                <th className="px-3 py-2">적용 상태</th>
                <th className="px-3 py-2">마스터 로그인 권한</th>
                <th className="px-3 py-2">비고</th>
              </tr>
            </thead>
            <tbody>
              {hrAdmins.map((employee) => {
                const isFixed = isFixedMasterLoginAccessSource(employee.masterLoginAccessSource)
                const isPending = pendingPermissionEmployeeId === employee.id
                const toggleState = resolveMasterLoginPermissionToggleState({
                  isAuthenticated: status === 'authenticated',
                  hasActiveMasterLogin: Boolean(activeMasterLogin),
                  accessSource: employee.masterLoginAccessSource,
                  pending: isPending,
                })

                return (
                  <tr key={employee.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {employee.name} ({employee.employeeNumber})
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{employee.googleEmail}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div>{employee.departmentName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {employee.jobTitle ?? '직책 정보 없음'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accessSourceTone(employee.masterLoginAccessSource)}`}
                      >
                        {accessSourceLabel(employee.masterLoginAccessSource)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={employee.masterLoginPermissionGranted || isFixed}
                          disabled={toggleState.disabled}
                          title={toggleState.message ?? undefined}
                          onChange={(event) => {
                            void saveMasterLoginPermission(employee, event.target.checked)
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 disabled:cursor-not-allowed"
                        />
                        <span>{isPending ? '저장 중...' : '마스터 로그인 권한'}</span>
                      </label>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {employee.masterLoginAccessSource === 'owner'
                        ? '소유자 계정은 기본 정책으로 항상 사용할 수 있습니다.'
                        : employee.masterLoginAccessSource === 'legacy_admin'
                          ? '기존 허용 관리자 정책으로 사용 가능합니다.'
                          : employee.masterLoginPermissionGranted
                            ? '운영자가 직접 부여한 권한입니다.'
                            : '권한이 부여되지 않은 상태입니다.'}
                    </td>
                  </tr>
                )
              })}

              {!hrAdmins.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-500">
                    현재 등록된 HR관리자 계정이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {status === 'authenticated' && !masterLoginAvailable ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          마스터 로그인은 소유자 또는 권한이 부여된 HR관리자만 사용할 수 있습니다. 현재 계정에는 사용
          권한이 없습니다.
        </section>
      ) : null}

      {activeMasterLogin ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          현재 <strong>{activeMasterLogin.targetName}</strong> 계정으로 마스터 로그인 중입니다. 다른
          계정으로 전환하려면 상단 배너에서 먼저 종료해 주세요.
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">구성원 계정 목록</h3>
            <p className="mt-1 text-sm text-slate-500">
              재직 중인 구성원 계정으로만 마스터 로그인을 시작할 수 있습니다.
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
                <th className="px-3 py-2">동작</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const blocked =
                  status !== 'authenticated' ||
                  !masterLoginAvailable ||
                  Boolean(activeMasterLogin) ||
                  employee.employmentStatus !== 'ACTIVE'
                const isPending = pendingEmployeeId === employee.id

                return (
                  <tr key={employee.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {employee.name} ({employee.employeeNumber})
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {employee.jobTitle ? employee.jobTitle : '직책 정보 없음'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{employee.googleEmail}</td>
                    <td className="px-3 py-3 text-slate-700">{employee.departmentName}</td>
                    <td className="px-3 py-3">
                      <div className="text-slate-700">{roleLabel(employee.role)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {statusLabel(employee.employmentStatus)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={blocked || isPending}
                        onClick={() => openStartDialog(employee)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? '시작 준비 중...' : '이 계정으로 시작'}
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

      {dialogTarget ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">마스터 로그인 시작</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    대상자 권한으로 시스템을 사용하게 되는 작업이므로 대상자와 사유를 다시 확인해
                    주세요.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    대상자
                  </div>
                  <p className="mt-1 font-medium text-slate-900">{selectedTargetSummary}</p>
                  <p className="text-xs text-slate-500">{dialogTarget.googleEmail}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    현재 상태
                  </div>
                  <p className="mt-1 font-medium text-slate-900">
                    {roleLabel(dialogTarget.role)} / {statusLabel(dialogTarget.employmentStatus)}
                  </p>
                  <p className="text-xs text-slate-500">{dialogTarget.departmentName}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">다음 내용을 확인해 주세요</p>
                    <p>- 대상자 권한으로 시스템을 사용합니다.</p>
                    <p>- 모든 행동은 감사 로그에 기록됩니다.</p>
                    <p>- 위험 동작에는 추가 확인이 필요합니다.</p>
                  </div>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">마스터 로그인 사유</span>
                <textarea
                  value={dialogReason}
                  onChange={(event) => {
                    setDialogReason(event.target.value)
                    setDialogError(null)
                  }}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  placeholder="예: 특정 구성원 화면에서 제출 경로를 재현해야 하고, 운영 문의 재현이 필요합니다."
                />
                <p className="text-xs text-slate-500">최소 10자 이상 구체적으로 입력해 주세요.</p>
              </label>

              {dialogError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {dialogError}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDialog}
                disabled={Boolean(pendingEmployeeId)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void startMasterLogin()}
                disabled={Boolean(pendingEmployeeId)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingEmployeeId ? '시작 중...' : '마스터 로그인 시작'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
