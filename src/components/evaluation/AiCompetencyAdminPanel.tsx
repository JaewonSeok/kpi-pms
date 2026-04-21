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
        <MetricCard label="전체 대상자" value={`${pageData.summary.totalCount}명`} />
        <MetricCard label="제출 완료" value={`${pageData.summary.submittedCount}명`} />
        <MetricCard label="검토 중" value={`${pageData.summary.reviewCount}명`} />
        <MetricCard
          label="통과 / 미통과"
          value={`${pageData.summary.passedCount} / ${pageData.summary.failedCount}`}
        />
      </div>

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
          description="직원을 AI 역량평가 대상자로 배정하고 검토자를 지정합니다."
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
            {pageData.assignments.length ? (
              pageData.assignments.map((assignment) => (
                <article
                  key={assignment.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill value={assignment.statusLabel} />
                        {assignment.trackLabel ? <StatusPill value={assignment.trackLabel} /> : null}
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
                title="대기열이 비어 있습니다."
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
