'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type EmployeeListItem = {
  id: string
  empId: string
  empName: string
  role: string
  status: string
  deptName: string
  gwsEmail: string
}

type EmployeeDirectoryResponse = {
  allowedDomain: string
  employees: EmployeeListItem[]
}

type UpdateGoogleAccountResponse = {
  employee: EmployeeListItem
  allowedDomain: string
  loginReady: boolean
}

function parseResponse<T>(json: unknown): T {
  const payload = json as { success?: boolean; data?: T; error?: { message?: string } }
  if (!payload.success) {
    throw new Error(payload.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }

  return payload.data as T
}

export function GoogleAccountRegistrationClient() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [draftEmails, setDraftEmails] = useState<Record<string, string>>({})

  const employeesQuery = useQuery({
    queryKey: ['admin-google-account-directory', submittedSearch],
    queryFn: async () => {
      const query = submittedSearch ? `?q=${encodeURIComponent(submittedSearch)}` : ''
      const res = await fetch(`/api/admin/employees/google-account${query}`)
      return parseResponse<EmployeeDirectoryResponse>(await res.json())
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: { employeeId: string; gwsEmail: string }) => {
      const res = await fetch('/api/admin/employees/google-account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      return parseResponse<UpdateGoogleAccountResponse>(await res.json())
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-google-account-directory'] })
      setDraftEmails((current) => ({
        ...current,
        [data.employee.id]: data.employee.gwsEmail,
      }))
      alert(
        data.loginReady
          ? `${data.employee.empName} 계정에 ${data.employee.gwsEmail} 을(를) 등록했습니다.`
          : `${data.employee.empName} 계정 이메일은 변경됐지만 재직 상태가 ACTIVE가 아니어서 아직 로그인은 제한됩니다.`
      )
    },
    onError: (error: Error) => {
      alert(error.message)
    },
  })

  const employees = employeesQuery.data?.employees ?? []
  const allowedDomain = employeesQuery.data?.allowedDomain ?? 'rsupport.com'
  const savingId = useMemo(
    () => (updateMutation.variables ? updateMutation.variables.employeeId : null),
    [updateMutation.variables]
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h1 className="text-2xl font-bold text-slate-900">Google 계정 등록</h1>
        <p className="mt-2 text-sm text-slate-700">
          직원 데이터의 Google Workspace 이메일을 현재 허용 도메인인
          <span className="ml-1 font-semibold text-blue-700">@{allowedDomain}</span>
          기준으로 등록하거나 수정합니다.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Google 로그인은 등록된 이메일과 직원 상태가 `ACTIVE`일 때만 성공합니다.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="사번, 이름, 현재 Google 이메일로 검색"
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
          <h2 className="text-lg font-semibold text-gray-900">직원 Google 이메일 등록</h2>
        </div>

        {employeesQuery.isLoading && (
          <div className="px-5 py-10 text-center text-sm text-gray-500">직원 목록을 불러오는 중입니다.</div>
        )}

        {!employeesQuery.isLoading && !employees.length && (
          <div className="px-5 py-10 text-center text-sm text-gray-500">검색 결과가 없습니다.</div>
        )}

        {!!employees.length && (
          <div className="divide-y divide-gray-100">
            {employees.map((employee) => {
              const draftEmail = draftEmails[employee.id] ?? employee.gwsEmail
              const isSaving = savingId === employee.id && updateMutation.isPending

              return (
                <div key={employee.id} className="space-y-4 px-5 py-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {employee.empName} ({employee.empId})
                      </div>
                      <div className="text-xs text-gray-500">
                        {employee.deptName} / {employee.role} / {employee.status}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      현재 등록값: {employee.gwsEmail || '미등록'}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row">
                    <input
                      value={draftEmail}
                      onChange={(event) =>
                        setDraftEmails((current) => ({
                          ...current,
                          [employee.id]: event.target.value,
                        }))
                      }
                      placeholder={`name@${allowedDomain}`}
                      className="min-h-11 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm"
                    />
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          employeeId: employee.id,
                          gwsEmail: draftEmail,
                        })
                      }
                      disabled={isSaving}
                      className="min-h-11 rounded-xl border border-blue-300 px-5 py-3 text-sm font-medium text-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? '저장 중...' : '이메일 등록'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
