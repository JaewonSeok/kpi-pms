'use client'

import { useState } from 'react'

type EvaluatorAssignmentPreviewRow = {
  employeeId: string
  employeeNumber: string
  employeeName: string
  departmentName: string
  role: string
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
}

type EvaluatorAssignmentPreview = {
  summary: {
    changedEmployeeCount: number
    teamLeaderChangedCount: number
    sectionChiefChangedCount: number
    divisionHeadChangedCount: number
  }
  changedEmployees: EvaluatorAssignmentPreviewRow[]
}

type Props = {
  onFeedback: (feedback: { type: 'success' | 'error'; message: string } | null) => void
  onRefresh: () => Promise<void>
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청을 처리하는 중 문제가 발생했습니다.')
  }

  return payload.data as T
}

function roleLabel(role: string) {
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

function fieldLabel(field: 'teamLeader' | 'sectionChief' | 'divisionHead') {
  switch (field) {
    case 'teamLeader':
      return '1차 평가권자'
    case 'sectionChief':
      return '2차 평가권자'
    case 'divisionHead':
      return '3차 평가권자'
  }
}

function formatLeaderName(name: string) {
  return name || '-'
}

export function EvaluatorAssignmentAdminPanel({ onFeedback, onRefresh }: Props) {
  const [preview, setPreview] = useState<EvaluatorAssignmentPreview | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isStaged, setIsStaged] = useState(false)

  async function loadPreview() {
    setIsPending(true)
    onFeedback(null)

    try {
      const response = await fetch('/api/admin/employees/google-account/evaluators', {
        cache: 'no-store',
      })
      const data = parseResponse<EvaluatorAssignmentPreview>(await response.json())
      setPreview(data)
      setIsStaged(true)
      onFeedback({
        type: 'success',
        message:
          data.summary.changedEmployeeCount > 0
            ? `조직 리더 기준으로 평가권자 변경 ${data.summary.changedEmployeeCount}건을 미리 확인했습니다. 저장 버튼을 눌러 실제 반영해 주세요.`
            : '현재 조직 리더 설정 기준으로 변경할 평가권자가 없습니다.',
      })
    } catch (error) {
      onFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '평가권자 미리보기를 불러오지 못했습니다.',
      })
    } finally {
      setIsPending(false)
    }
  }

  async function applyPreview() {
    setIsPending(true)
    onFeedback(null)

    try {
      const response = await fetch('/api/admin/employees/google-account/evaluators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      })
      const data = parseResponse<{ appliedCount: number; hierarchyUpdatedCount: number }>(
        await response.json()
      )

      setPreview(null)
      setIsStaged(false)
      await onRefresh()
      onFeedback({
        type: 'success',
        message: `평가권자 일괄 지정 ${data.appliedCount}건을 반영했습니다. 전체 ${data.hierarchyUpdatedCount}명의 평가권자 연결을 다시 계산했습니다.`,
      })
    } catch (error) {
      onFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : '평가권자 일괄 지정 저장에 실패했습니다.',
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">평가권자 관리</h2>
            <p className="mt-1 text-sm text-slate-600">
              조직 리더를 기준으로 1차, 2차, 3차 평가권자를 일괄 제안하고 저장 전에 변경 내용을
              비교할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadPreview}
              disabled={isPending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && !isStaged ? '미리보기 불러오는 중...' : '조직 리더 기준으로 일괄 지정'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setIsStaged(false)
                onFeedback(null)
              }}
              disabled={!isStaged || isPending}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={applyPreview}
              disabled={!isStaged || !preview?.summary.changedEmployeeCount || isPending}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              저장
            </button>
          </div>
        </div>
      </section>

      {isStaged && preview ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          조직 리더를 기준으로 평가권자가 일괄 지정되었습니다. 저장 버튼을 눌러야 반영됩니다.
        </section>
      ) : null}

      {preview ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">변경 대상</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {preview.summary.changedEmployeeCount}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">1차 변경</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {preview.summary.teamLeaderChangedCount}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">2차 변경</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {preview.summary.sectionChiefChangedCount}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-slate-500">3차 변경</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {preview.summary.divisionHeadChangedCount}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">저장 전 변경 미리보기</h3>
                <p className="mt-1 text-sm text-slate-500">
                  before → after 비교로 평가권자 변경 내용을 확인할 수 있습니다.
                </p>
              </div>
              <div className="text-sm text-slate-500">변경 {preview.changedEmployees.length}건</div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-2">피평가자</th>
                    <th className="px-3 py-2">조직 / 역할</th>
                    <th className="px-3 py-2">1차 평가권자</th>
                    <th className="px-3 py-2">2차 평가권자</th>
                    <th className="px-3 py-2">3차 평가권자</th>
                    <th className="px-3 py-2">변경 항목</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changedEmployees.map((employee) => (
                    <tr key={employee.employeeId} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">
                          {employee.employeeName} ({employee.employeeNumber})
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div>{employee.departmentName}</div>
                        <div className="mt-1 text-xs text-slate-500">{roleLabel(employee.role)}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div>{formatLeaderName(employee.current.teamLeaderName)}</div>
                        <div className="mt-1 text-xs text-blue-700">
                          → {formatLeaderName(employee.next.teamLeaderName)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div>{formatLeaderName(employee.current.sectionChiefName)}</div>
                        <div className="mt-1 text-xs text-blue-700">
                          → {formatLeaderName(employee.next.sectionChiefName)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div>{formatLeaderName(employee.current.divisionHeadName)}</div>
                        <div className="mt-1 text-xs text-blue-700">
                          → {formatLeaderName(employee.next.divisionHeadName)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {employee.changedFields.map((field) => (
                            <span
                              key={`${employee.employeeId}-${field}`}
                              className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
                            >
                              {fieldLabel(field)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!preview.changedEmployees.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                        현재 조직 리더 설정 기준으로 변경할 평가권자가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
