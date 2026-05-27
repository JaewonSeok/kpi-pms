'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { AiCompetencyGateAdminPageData } from '@/server/ai-competency-gate-admin'
import {
  buildAiCompetencyAdminCaseHref,
  buildAiCompetencyAdminListHref,
  resolveSafeReturnTo,
} from '@/lib/ai-competency-gate-navigation'
import {
  toAiCompetencyGateCycleLocalInputValue,
  toAiCompetencyGateCyclePayload,
} from '@/lib/ai-competency-gate-cycle-form'
import {
  EmptyBox,
  Field,
  inputClassName,
  MetricCard,
  NoticeBanner,
  PageShell,
  primaryButtonClassName,
  secondaryButtonClassName,
  SectionCard,
  StateScreen,
  StatusPill,
  textareaClassName,
} from './AiCompetencyShared'

type NoticeState =
  | {
      tone: 'success' | 'error' | 'warning' | 'info'
      title: string
      description?: string
    }
  | null

type CycleFormState = {
  evalCycleId: string
  cycleName: string
  status: 'DRAFT' | 'OPEN' | 'CLOSED'
  submissionOpenAt: string
  submissionCloseAt: string
  reviewOpenAt: string
  reviewCloseAt: string
  resultPublishAt: string
  promotionGateEnabled: boolean
  policyAcknowledgementText: string
}

type AssignmentFormState = {
  employeeId: string
  reviewerId: string
  adminNote: string
}

function buildCycleForm(data: AiCompetencyGateAdminPageData): CycleFormState {
  return {
    evalCycleId: data.selectedCycle?.evalCycleId ?? data.evalCycleOptions[0]?.id ?? '',
    cycleName: data.selectedCycle?.cycleName ?? '',
    status: (data.selectedCycle?.status as CycleFormState['status']) ?? 'DRAFT',
    submissionOpenAt: toAiCompetencyGateCycleLocalInputValue(data.selectedCycle?.submissionOpenAt),
    submissionCloseAt: toAiCompetencyGateCycleLocalInputValue(data.selectedCycle?.submissionCloseAt),
    reviewOpenAt: toAiCompetencyGateCycleLocalInputValue(data.selectedCycle?.reviewOpenAt),
    reviewCloseAt: toAiCompetencyGateCycleLocalInputValue(data.selectedCycle?.reviewCloseAt),
    resultPublishAt: toAiCompetencyGateCycleLocalInputValue(data.selectedCycle?.resultPublishAt),
    promotionGateEnabled: data.selectedCycle?.promotionGateEnabled ?? true,
    policyAcknowledgementText: data.selectedCycle?.policyAcknowledgementText ?? '',
  }
}

function buildAssignmentForm(data: AiCompetencyGateAdminPageData): AssignmentFormState {
  return {
    employeeId: data.employeeOptions[0]?.id ?? '',
    reviewerId: '',
    adminNote: '',
  }
}

function formatCycleOptionLabel(cycle: { year: number; name: string }) {
  return `${cycle.year}년 · ${cycle.name}`
}

function formatEvalCycleOptionLabel(cycle: {
  year: number
  name: string
  organizationName: string
}) {
  return `${cycle.year}년 · ${cycle.name} (${cycle.organizationName})`
}

function formatEmployeeOptionLabel(option: { name: string; departmentName: string }) {
  return `${option.name} · ${option.departmentName}`
}

async function readActionResponse(response: Response) {
  const body = (await response.json()) as { success: boolean; error?: { message?: string } }
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청 처리 중 문제가 발생했습니다.')
  }
}

export function AiCompetencyAdminPanel(props: { pageData: AiCompetencyGateAdminPageData }) {
  const { pageData } = props
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notice, setNotice] = useState<NoticeState>(null)
  const [isPending, startTransition] = useTransition()
  const [cycleForm, setCycleForm] = useState(() => buildCycleForm(pageData))
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(() =>
    buildAssignmentForm(pageData)
  )
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [routeFilter, setRouteFilter] = useState('ALL')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')

  useEffect(() => {
    setCycleForm(buildCycleForm(pageData))
    setAssignmentForm(buildAssignmentForm(pageData))
  }, [pageData])

  const employeeReturnHref = useMemo(
    () => resolveSafeReturnTo(searchParams.get('returnTo')),
    [searchParams]
  )
  const hasSelectedCycle = Boolean(pageData.selectedCycleId)
  const hasCycleOptions = pageData.cycleOptions.length > 0
  const hasEvalCycleOptions = pageData.evalCycleOptions.length > 0
  const hasEmployeeOptions = pageData.employeeOptions.length > 0
  const hasReviewerOptions = pageData.reviewerOptions.length > 0
  const departmentFilterOptions = useMemo(
    () => Array.from(new Set(pageData.assignments.map((item) => item.departmentName))).sort(),
    [pageData.assignments]
  )
  const routeFilterOptions = useMemo(
    () =>
      Array.from(
        new Map(
          pageData.assignments.map((item) => [
            item.recognitionRoute ?? 'UNSELECTED',
            item.recognitionRouteLabel ?? '인정 경로 미선택',
          ])
        ).entries()
      ),
    [pageData.assignments]
  )
  const filteredAssignments = useMemo(
    () =>
      pageData.assignments.filter((assignment) => {
        if (statusFilter !== 'ALL' && assignment.status !== statusFilter) return false
        if (routeFilter !== 'ALL' && (assignment.recognitionRoute ?? 'UNSELECTED') !== routeFilter) return false
        if (departmentFilter !== 'ALL' && assignment.departmentName !== departmentFilter) return false
        return true
      }),
    [departmentFilter, pageData.assignments, routeFilter, statusFilter]
  )

  const runMutation = (work: () => Promise<void>) => {
    startTransition(() => {
      void work().catch((error) => {
        setNotice({
          tone: 'error',
          title: error instanceof Error ? error.message : '처리 중 문제가 발생했습니다.',
        })
      })
    })
  }

  const callJsonAction = async (action: string, payload: unknown) => {
    const response = await fetch('/api/evaluation/ai-competency/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    await readActionResponse(response)
  }

  if (pageData.state === 'permission-denied') {
    return (
      <StateScreen
        title="접근 권한이 없습니다."
        description={pageData.message ?? '검토자 또는 관리자만 접근할 수 있습니다.'}
      />
    )
  }

  if (pageData.state === 'error') {
    return (
      <StateScreen
        title="관리자 화면을 불러오지 못했습니다."
        description={pageData.message ?? '잠시 후 다시 시도해 주세요.'}
      />
    )
  }

  return (
    <PageShell
      title="AI 역량평가 운영"
      description="회차를 관리하고 대상자를 배정하며 제출 및 검토 현황을 확인합니다."
      actions={
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={() => router.push(employeeReturnHref)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          내 AI 역량평가 화면
        </button>
      }
    >
      {notice ? (
        <NoticeBanner
          tone={notice.tone}
          title={notice.title}
          description={notice.description}
        />
      ) : null}
      {pageData.state === 'empty' ? (
        <NoticeBanner
          tone="warning"
          title={pageData.message ?? '등록된 AI 역량평가 회차가 없습니다.'}
          description="먼저 아래 회차 관리에서 평가 주기를 선택해 첫 회차를 생성해 주세요."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="전체 대상 인원" value={`${pageData.summary.totalCount}명`} />
        <MetricCard label="제출 완료 인원" value={`${pageData.summary.submittedCount}명`} />
        <MetricCard label="검토 중 인원" value={`${pageData.summary.reviewCount}명`} />
        <MetricCard
          label="합격 / 미통과 인원"
          value={`합격 ${pageData.summary.passedCount}명 / 미통과 ${pageData.summary.failedCount}명`}
        />
      </div>

      <SectionCard
        title="2026 AI 활용평가 readiness"
        description="연간 업적평가 점수와 별도로 레벨업/승진 Pass/Fail 요건 준비 현황을 확인합니다."
      >
        <NoticeBanner
          tone="info"
          title="AI 활용평가는 2026 업적평가 점수에 반영되지 않습니다."
          description="단순 교육 이수나 도구 사용 경험만으로는 인정되지 않습니다. 실제 업무 개선과 증빙, 검토 결정만 readiness metadata로 관리합니다."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <MetricCard label="미제출" value={`${pageData.summary.unsubmittedCount}명`} />
          <MetricCard label="보완 요청" value={`${pageData.summary.revisionRequestedCount}명`} />
          <MetricCard label="Pass" value={`${pageData.summary.passedCount}명`} />
          <MetricCard label="Fail" value={`${pageData.summary.failedCount}명`} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {pageData.summary.evidencePathDistribution.length ? (
            pageData.summary.evidencePathDistribution.map((item) => (
              <MetricCard key={item.route} label={item.label} value={`${item.count}명`} />
            ))
          ) : (
            <EmptyBox
              title="인정 경로 분포가 없습니다."
              description="대상자를 배정하고 제출서를 저장하면 인정 경로별 현황이 표시됩니다."
            />
          )}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <MetricCard label="증빙 누락" value={`${pageData.summary.readinessBlockers.missingEvidence}건`} />
          <MetricCard
            label="정량 개선 누락"
            value={`${pageData.summary.readinessBlockers.missingQuantitativeImpact}건`}
          />
          <MetricCard
            label="Before/After 누락"
            value={`${pageData.summary.readinessBlockers.missingBeforeAfter}건`}
          />
          <MetricCard
            label="기여 설명 누락"
            value={`${pageData.summary.readinessBlockers.missingContributionClarity}건`}
          />
          <MetricCard
            label="확산 근거 누락"
            value={`${pageData.summary.readinessBlockers.missingAdoptionSharing}건`}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">조직/팀</th>
                <th className="px-4 py-3">대상자</th>
                <th className="px-4 py-3">제출/검토 대기</th>
                <th className="px-4 py-3">Pass</th>
                <th className="px-4 py-3">미제출</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pageData.summary.departmentCoverage.length ? (
                pageData.summary.departmentCoverage.map((item) => (
                  <tr key={item.departmentName}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.departmentName}</td>
                    <td className="px-4 py-3 text-slate-700">{item.totalCount}명</td>
                    <td className="px-4 py-3 text-slate-700">{item.submittedCount}명</td>
                    <td className="px-4 py-3 text-slate-700">{item.passedCount}명</td>
                    <td className="px-4 py-3 text-slate-700">{item.missingCount}명</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    조직별 readiness 현황이 아직 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="회차 선택"
        description="조회할 AI 역량평가 회차를 선택해 주세요."
      >
        {hasCycleOptions ? (
          <select
            className={inputClassName}
            value={pageData.selectedCycleId ?? ''}
            onChange={(event) =>
              router.push(
                buildAiCompetencyAdminListHref({
                  cycleId: event.target.value,
                  returnTo: employeeReturnHref,
                })
              )
            }
          >
            {pageData.cycleOptions.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {formatCycleOptionLabel(cycle)}
              </option>
            ))}
          </select>
        ) : (
          <EmptyBox
            title="선택할 회차가 아직 없습니다."
            description="회차 관리에서 첫 AI 역량평가 회차를 저장하면 이 영역에서 회차를 선택할 수 있습니다."
          />
        )}
      </SectionCard>

      {pageData.canManageCycles ? (
        <SectionCard
          title="회차 관리"
          description="평가 주기와 AI 역량평가 회차를 연결하고 제출 및 검토 일정을 설정합니다."
          action={
            <button
              type="button"
              className={primaryButtonClassName}
              disabled={isPending || !hasEvalCycleOptions || !cycleForm.evalCycleId}
              onClick={() =>
                runMutation(async () => {
                  await callJsonAction('upsertCycle', toAiCompetencyGateCyclePayload(cycleForm))
                  setNotice({ tone: 'success', title: 'AI 역량평가 회차를 저장했습니다.' })
                  router.refresh()
                })
              }
            >
              회차 저장
            </button>
          }
        >
          {hasEvalCycleOptions ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="평가 주기">
                <select
                  className={inputClassName}
                  value={cycleForm.evalCycleId}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, evalCycleId: event.target.value }))
                  }
                >
                  {pageData.evalCycleOptions.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {formatEvalCycleOptionLabel(cycle)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="회차명">
                <input
                  className={inputClassName}
                  value={cycleForm.cycleName}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, cycleName: event.target.value }))
                  }
                />
              </Field>
              <Field label="상태">
                <select
                  className={inputClassName}
                  value={cycleForm.status}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      status: event.target.value as CycleFormState['status'],
                    }))
                  }
                >
                  <option value="DRAFT">준비 중</option>
                  <option value="OPEN">운영 중</option>
                  <option value="CLOSED">마감</option>
                </select>
              </Field>
              <Field label="승진 게이트 사용 여부">
                <label className="flex min-h-[2.75rem] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={cycleForm.promotionGateEnabled}
                    onChange={(event) =>
                      setCycleForm((current) => ({
                        ...current,
                        promotionGateEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>승진 판단 시 AI 역량평가 게이트를 사용합니다.</span>
                </label>
              </Field>
              <Field label="제출 시작">
                <input
                  className={inputClassName}
                  type="datetime-local"
                  value={cycleForm.submissionOpenAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      submissionOpenAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="제출 마감">
                <input
                  className={inputClassName}
                  type="datetime-local"
                  value={cycleForm.submissionCloseAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      submissionCloseAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="검토 시작">
                <input
                  className={inputClassName}
                  type="datetime-local"
                  value={cycleForm.reviewOpenAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, reviewOpenAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="검토 마감">
                <input
                  className={inputClassName}
                  type="datetime-local"
                  value={cycleForm.reviewCloseAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, reviewCloseAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="결과 발표일">
                <input
                  className={inputClassName}
                  type="datetime-local"
                  value={cycleForm.resultPublishAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      resultPublishAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="정책 확인 문구">
                <textarea
                  className={textareaClassName}
                  value={cycleForm.policyAcknowledgementText}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      policyAcknowledgementText: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          ) : (
            <EmptyBox
              title="연결할 평가 주기가 없습니다."
              description="먼저 성과평가 주기를 생성한 뒤 AI 역량평가 회차를 연결해 주세요."
              tone="warning"
            />
          )}
        </SectionCard>
      ) : null}

      {pageData.canAssign ? (
        <SectionCard
          title="대상자 배정"
          description="2026 AI 활용평가 대상자인 팀장/팀원을 배정하고 검토자를 지정합니다. 본부장/실장은 대상에서 제외됩니다."
          action={
            hasSelectedCycle ? (
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={isPending || !assignmentForm.employeeId}
                onClick={() =>
                  runMutation(async () => {
                    await callJsonAction('upsertAssignment', {
                      cycleId: pageData.selectedCycleId,
                      ...assignmentForm,
                    })
                    setNotice({ tone: 'success', title: '대상자 배정을 저장했습니다.' })
                    router.refresh()
                  })
                }
              >
                배정 저장
              </button>
            ) : null
          }
        >
          {hasSelectedCycle ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="직원"
                hint={!hasEmployeeOptions ? '배정 가능한 직원이 없습니다.' : undefined}
              >
                <select
                  className={inputClassName}
                  value={assignmentForm.employeeId}
                  disabled={!hasEmployeeOptions}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      employeeId: event.target.value,
                    }))
                  }
                >
                  {hasEmployeeOptions ? (
                    pageData.employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {formatEmployeeOptionLabel(employee)}
                      </option>
                    ))
                  ) : (
                    <option value="">배정 가능한 직원이 없습니다.</option>
                  )}
                </select>
              </Field>
              <Field
                label="검토자"
                hint={!hasReviewerOptions ? '선택 가능한 검토자가 없습니다.' : undefined}
              >
                <select
                  className={inputClassName}
                  value={assignmentForm.reviewerId}
                  disabled={!hasReviewerOptions}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      reviewerId: event.target.value,
                    }))
                  }
                >
                  <option value="">지정하지 않음</option>
                  {pageData.reviewerOptions.map((reviewer) => (
                    <option key={reviewer.id} value={reviewer.id}>
                      {formatEmployeeOptionLabel(reviewer)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="관리 메모">
                <textarea
                  className={textareaClassName}
                  value={assignmentForm.adminNote}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      adminNote: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          ) : (
            <EmptyBox
              title="먼저 회차를 생성하거나 선택해 주세요."
              description="회차를 선택해야 직원과 검토자를 배정할 수 있습니다."
              tone="warning"
            />
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="제출 및 검토 대기열"
        description="현재 회차의 작성, 제출, 검토 상태를 확인하고 케이스 상세 화면으로 이동합니다."
      >
        {!hasSelectedCycle ? (
          <EmptyBox
            title="선택된 회차가 없습니다."
            description="회차를 생성하거나 선택하면 제출 및 검토 현황을 여기에서 확인할 수 있습니다."
          />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
              <Field label="상태">
                <select
                  className={inputClassName}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">전체 상태</option>
                  <option value="NOT_STARTED">미시작</option>
                  <option value="DRAFT">작성중</option>
                  <option value="SUBMITTED">제출완료</option>
                  <option value="RESUBMITTED">재제출</option>
                  <option value="UNDER_REVIEW">검토중</option>
                  <option value="REVISION_REQUESTED">보완요청</option>
                  <option value="PASSED">Pass</option>
                  <option value="FAILED">Fail</option>
                </select>
              </Field>
              <Field label="인정 경로">
                <select
                  className={inputClassName}
                  value={routeFilter}
                  onChange={(event) => setRouteFilter(event.target.value)}
                >
                  <option value="ALL">전체 인정 경로</option>
                  {routeFilterOptions.map(([route, label]) => (
                    <option key={route} value={route}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="조직/팀">
                <select
                  className={inputClassName}
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                >
                  <option value="ALL">전체 조직</option>
                  {departmentFilterOptions.map((departmentName) => (
                    <option key={departmentName} value={departmentName}>
                      {departmentName}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {filteredAssignments.length ? (
              filteredAssignments.map((assignment) => (
                <article
                  key={assignment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill value={assignment.statusLabel} />
                        <StatusPill value={assignment.recognitionRouteLabel ?? assignment.trackLabel ?? '인정 경로 미선택'} />
                      </div>
                      <h3 className="text-base font-semibold text-slate-950">
                        {assignment.employeeName} · {assignment.departmentName}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {assignment.title ?? '아직 제출서 제목이 없습니다.'}
                      </p>
                      <p className="text-sm text-slate-500">
                        검토자 {assignment.reviewerName ?? '미지정'} · 수정 라운드{' '}
                        {assignment.revisionRound}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {assignment.caseId
                        ? (() => {
                            const caseId = assignment.caseId
                            return (
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                onClick={() =>
                                  router.push(
                                    buildAiCompetencyAdminCaseHref({
                                      caseId,
                                      cycleId: pageData.selectedCycleId ?? '',
                                      returnTo: employeeReturnHref,
                                    })
                                  )
                                }
                              >
                                케이스 상세 보기
                              </button>
                            )
                          })()
                        : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyBox
                title={pageData.assignments.length ? '필터 조건에 맞는 대기열이 없습니다.' : '대기열이 비어 있습니다.'}
                description={
                  pageData.message ??
                  '대상자를 배정하고 제출이 시작되면 이 영역에서 작성 및 검토 상태를 추적할 수 있습니다.'
                }
              />
            )}
          </div>
        )}
      </SectionCard>
    </PageShell>
  )
}
