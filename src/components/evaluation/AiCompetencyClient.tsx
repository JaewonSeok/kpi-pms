'use client'

import { useDeferredValue, useEffect, useState, useTransition } from 'react'
import type { AiCompetencyReviewDecision } from '@prisma/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { calculateRubricReview } from '@/lib/ai-competency-rubric'
import type { AiCompetencyPageData } from '@/server/ai-competency'
import { AiCompetencyAdminPanel } from './AiCompetencyAdminPanel'
import {
  DataTable,
  difficultyLabel,
  domainLabel,
  EmptyBox,
  Field,
  formatDateTime,
  formatFileSize,
  InfoRow,
  inputClassName,
  labelForTrack,
  MetricCard,
  primaryButtonClassName,
  questionTypeLabel,
  secondaryButtonClassName,
  SectionCard,
  StateScreen,
  StatusPill,
  STATUS_LABELS,
} from './AiCompetencyShared'

type TabKey =
  | 'overview'
  | 'assessment'
  | 'second-round'
  | 'certificate'
  | 'reviewer'
  | 'admin'
  | 'executive'

type NoticeState =
  | {
      tone: 'success' | 'error'
      message: string
    }
  | null

type SecondRoundFormState = {
  taskDescription: string
  aiUsagePurpose: string
  toolUsed: string
  promptSummary: string
  verificationMethod: string
  businessImpact: string
  sensitiveDataCheck: string
}

type CertFormState = {
  certificateId: string
  certificateNumber: string
  issuedAt: string
  expiresAt: string
  policyAcknowledged: boolean
}

type ReviewCriterionDraft = {
  criterionId: string
  score: string
  comment: string
  knockoutTriggered: boolean
}

type ReviewFormState = {
  submissionId: string
  decision: AiCompetencyReviewDecision
  notes: string
  qnaNote: string
  criterionScores: ReviewCriterionDraft[]
}

function initialTabFor(data: AiCompetencyPageData): TabKey {
  if (data.permissions?.canManageCycles) return 'admin'
  if (data.employeeView) return 'assessment'
  if (data.reviewerView?.queue.length) return 'reviewer'
  if (data.executiveView) return 'executive'
  return 'overview'
}

function buildSecondRoundForm(data: AiCompetencyPageData): SecondRoundFormState {
  const application = data.employeeView?.secondRound.application
  return {
    taskDescription: application?.taskDescription ?? '',
    aiUsagePurpose: application?.aiUsagePurpose ?? '',
    toolUsed: application?.toolUsed ?? '',
    promptSummary: application?.promptSummary ?? '',
    verificationMethod: application?.verificationMethod ?? '',
    businessImpact: application?.businessImpact ?? '',
    sensitiveDataCheck: application?.sensitiveDataCheck ?? '',
  }
}

function buildCertForm(data: AiCompetencyPageData): CertFormState {
  return {
    certificateId: data.employeeView?.externalCerts.masters[0]?.id ?? '',
    certificateNumber: '',
    issuedAt: '',
    expiresAt: '',
    policyAcknowledged: false,
  }
}

function buildCriterionDrafts(
  item?: NonNullable<AiCompetencyPageData['reviewerView']>['queue'][number]
): ReviewCriterionDraft[] {
  if (!item?.rubric) return []
  return item.rubric.criteria.map((criterion) => {
    const saved = item.existingCriteriaScores.find((score) => score.criterionId === criterion.criterionId)
    return {
      criterionId: criterion.criterionId,
      score: saved ? String(saved.score) : '',
      comment: saved?.comment ?? '',
      knockoutTriggered: saved?.knockoutTriggered ?? false,
    }
  })
}

function buildReviewForm(data: AiCompetencyPageData): ReviewFormState {
  const first = data.reviewerView?.queue[0]
  return {
    submissionId: first?.submissionId ?? '',
    decision: first?.existingDecision ?? 'PASS',
    notes: first?.existingNote ?? '',
    qnaNote: first?.existingQnaNote ?? '',
    criterionScores: buildCriterionDrafts(first),
  }
}

function normalizeAnswerState(data: AiCompetencyPageData) {
  const result: Record<string, string | string[] | null> = {}
  data.employeeView?.questions.forEach((question) => {
    if (Array.isArray(question.savedAnswer)) {
      result[question.id] = question.savedAnswer.map((item) => String(item))
      return
    }
    if (question.savedAnswer === null || question.savedAnswer === undefined) {
      result[question.id] = question.questionType === 'MULTIPLE_CHOICE' ? [] : ''
      return
    }
    result[question.id] =
      typeof question.savedAnswer === 'string'
        ? question.savedAnswer
        : JSON.stringify(question.savedAnswer)
  })
  return result
}

function isSelectedMultiAnswer(
  answers: Record<string, string | string[] | null>,
  questionId: string,
  option: string
) {
  const value = answers[questionId]
  return Array.isArray(value) ? value.includes(option) : false
}

async function readApiResponse(response: Response) {
  const body = (await response.json()) as {
    success: boolean
    data?: unknown
    error?: { message?: string }
  }
  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청 처리 중 오류가 발생했습니다.')
  }
  return body.data
}

function tabsFor(data: AiCompetencyPageData): Array<{ key: TabKey; label: string }> {
  const tabs: Array<{ key: TabKey; label: string }> = [{ key: 'overview', label: '개요' }]
  if (data.employeeView) {
    tabs.push({ key: 'assessment', label: '1차 공통평가' })
    tabs.push({ key: 'second-round', label: '2차 실무인증' })
    tabs.push({ key: 'certificate', label: '외부자격 인정' })
  }
  if (data.reviewerView?.queue.length) tabs.push({ key: 'reviewer', label: '리뷰어 심사' })
  if (data.permissions?.canManageCycles) tabs.push({ key: 'admin', label: '관리자 운영' })
  if (data.executiveView) tabs.push({ key: 'executive', label: '보고/분포' })
  return tabs
}

export function AiCompetencyClient(data: AiCompetencyPageData) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTabFor(data))
  const [notice, setNotice] = useState<NoticeState>(null)
  const [isPending, startTransition] = useTransition()
  const [answers, setAnswers] = useState<Record<string, string | string[] | null>>(() => normalizeAnswerState(data))
  const [secondRoundForm, setSecondRoundForm] = useState(() => buildSecondRoundForm(data))
  const [secondRoundFiles, setSecondRoundFiles] = useState<File[]>([])
  const [certForm, setCertForm] = useState(() => buildCertForm(data))
  const [certFile, setCertFile] = useState<File | null>(null)
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(() => buildReviewForm(data))
  const [reviewerSearch, setReviewerSearch] = useState('')
  const deferredReviewerSearch = useDeferredValue(reviewerSearch)

  useEffect(() => {
    setAnswers(normalizeAnswerState(data))
    setSecondRoundForm(buildSecondRoundForm(data))
    setSecondRoundFiles([])
    setCertForm(buildCertForm(data))
    setCertFile(null)
    setReviewForm(buildReviewForm(data))
    const allowedTabs = tabsFor(data).map((item) => item.key)
    setActiveTab((current) => (allowedTabs.includes(current) ? current : initialTabFor(data)))
  }, [data])

  async function callAction(action: string, payload: unknown) {
    const response = await fetch('/api/evaluation/ai-competency/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    return readApiResponse(response)
  }

  async function callMultipartAction(
    action: string,
    payload: unknown,
    files: Array<{ field: string; file: File }>
  ) {
    const formData = new FormData()
    formData.append('action', action)
    formData.append('payload', JSON.stringify(payload))
    files.forEach(({ field, file }) => formData.append(field, file))
    const response = await fetch('/api/evaluation/ai-competency/actions', {
      method: 'POST',
      body: formData,
    })
    return readApiResponse(response)
  }

  function runMutation(task: () => Promise<unknown>, successMessage: string) {
    startTransition(() => {
      void (async () => {
        try {
          setNotice(null)
          await task()
          setNotice({ tone: 'success', message: successMessage })
          router.refresh()
        } catch (error) {
          setNotice({
            tone: 'error',
            message: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.',
          })
        }
      })()
    })
  }

  function changeCycle(nextCycleId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nextCycleId) params.set('cycleId', nextCycleId)
    else params.delete('cycleId')
    const query = params.toString()
    router.push(query ? `/evaluation/ai-competency?${query}` : '/evaluation/ai-competency')
  }

  function toggleMultiAnswer(questionId: string, option: string, checked: boolean) {
    setAnswers((current) => {
      const existing = Array.isArray(current[questionId]) ? [...current[questionId]] : []
      const next = checked ? [...existing, option] : existing.filter((item) => item !== option)
      return { ...current, [questionId]: next }
    })
  }

  const filteredReviewerQueue =
    data.reviewerView?.queue.filter((item) => {
      if (!deferredReviewerSearch.trim()) return true
      const query = deferredReviewerSearch.trim().toLowerCase()
      return [item.employeeName, item.department, item.taskDescription].join(' ').toLowerCase().includes(query)
    }) ?? []

  const selectedReviewItem = data.reviewerView?.queue.find((item) => item.submissionId === reviewForm.submissionId)
  const canSubmitSecondRound =
    Boolean(data.employeeView?.assignment?.secondRoundVolunteer) &&
    (data.employeeView?.secondRound.eligible ||
      data.employeeView?.secondRound.application?.status === 'REVISE_REQUESTED')

  if (data.state === 'permission-denied') {
    return <StateScreen title="접근 권한이 없습니다." description={data.message ?? '권한을 확인해 주세요.'} />
  }
  if (data.state === 'error') {
    return <StateScreen title="AI 활용능력 평가 화면을 불러오지 못했습니다." description={data.message ?? '잠시 후 다시 시도해 주세요.'} />
  }
  if (data.state === 'empty' && !data.permissions?.canManageCycles) {
    return <StateScreen title="진행 중인 AI 활용능력 평가 주기가 없습니다." description={data.message ?? '관리자에게 주기 개설을 요청해 주세요.'} />
  }

  const tabs = tabsFor(data)

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">평가관리</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">AI 활용능력 평가</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              1차 공통평가, 2차 실무인증, 외부자격 인정, PMS 결과 반영을 한 화면에서 운영합니다.
            </p>
          </div>
          <Field label="평가 주기 선택">
            <select className={inputClassName} value={data.selectedCycleId ?? ''} onChange={(event) => changeCycle(event.target.value)}>
              <option value="">주기를 선택해 주세요</option>
              {data.availableCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.year}년 {cycle.name} / {STATUS_LABELS[cycle.status] ?? cycle.status}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {notice ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              notice.tone === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {notice.message}
          </div>
        ) : null}
        {data.summary ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="대상자" value={`${data.summary.targetCount}명`} />
            <MetricCard label="1차 완료" value={`${data.summary.completedFirstRoundCount}명`} />
            <MetricCard label="1차 합격" value={`${data.summary.passedFirstRoundCount}명`} />
            <MetricCard label="2차 제출" value={`${data.summary.secondRoundSubmissionCount}건`} />
            <MetricCard label="인증 획득" value={`${data.summary.certificationCount}명`} />
            <MetricCard label="PMS 반영" value={`${data.summary.syncedCount}명`} />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SectionCard title="내 진행 현황" description="배정 상태, 응시 상태, PMS 반영 상태를 확인합니다.">
            {data.employeeView?.assignment ? (
              <div className="grid gap-4 md:grid-cols-2">
                <InfoRow label="트랙" value={labelForTrack(data.employeeView.assignment.track)} />
                <InfoRow label="1차 상태" value={STATUS_LABELS[data.employeeView.attempt?.status ?? 'NOT_STARTED'] ?? '미응시'} />
                <InfoRow label="1차 점수" value={data.employeeView.result?.firstRoundScore ? `${data.employeeView.result.firstRoundScore}점` : '-'} />
                <InfoRow label="2차 보너스" value={`${data.employeeView.result?.secondRoundBonus ?? 0}점`} />
                <InfoRow label="외부자격 점수" value={data.employeeView.result?.externalCertMappedScore ? `${data.employeeView.result.externalCertMappedScore}점` : '-'} />
                <InfoRow label="PMS 반영" value={STATUS_LABELS[data.employeeView.result?.syncState ?? 'PENDING'] ?? '반영 대기'} />
              </div>
            ) : (
              <EmptyBox message="현재 주기에 배정된 AI 활용능력 평가가 없습니다." />
            )}
          </SectionCard>
          <SectionCard title="최종 결과" description="최종 점수, 등급, 인증 상태를 표시합니다.">
            {data.employeeView?.result ? (
              <div className="space-y-3">
                <MetricCard label="최종 점수" value={`${data.employeeView.result.finalScore.toFixed(1)}점`} />
                <MetricCard label="등급" value={data.employeeView.result.finalGrade} />
                <MetricCard label="인증 상태" value={STATUS_LABELS[data.employeeView.result.certificationStatus] ?? data.employeeView.result.certificationStatus} />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  공개 {formatDateTime(data.employeeView.result.publishedAt)} / PMS 반영 {formatDateTime(data.employeeView.result.syncedAt)}
                </div>
              </div>
            ) : (
              <EmptyBox message="아직 계산된 결과가 없습니다." />
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === 'assessment' && (
        <SectionCard title="1차 공통평가" description="저장 후 이어서 응시하거나 최종 제출할 수 있습니다.">
          {!data.employeeView?.assignment ? (
            <EmptyBox message="현재 주기에 배정된 1차 평가가 없습니다." />
          ) : (
            <div className="space-y-6">
              {data.employeeView.assessmentPlan && !data.employeeView.attempt ? (
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard label="예정 문항 수" value={`${data.employeeView.assessmentPlan.totalQuestionCount}개`} />
                  <MetricCard label="예정 총점" value={`${data.employeeView.assessmentPlan.totalPoints}점`} />
                  <MetricCard label="시험 시간" value={`${data.employeeView.assessmentPlan.timeLimitMinutes}분`} />
                  <MetricCard label="합격 기준" value={`${data.employeeView.assessmentPlan.passScore}점`} />
                </div>
              ) : null}
              {data.employeeView.assessmentPlan?.blueprints.length && !data.employeeView.attempt ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  체계표 기준: {data.employeeView.assessmentPlan.blueprints.map((blueprint) => blueprint.blueprintName).join(', ')}. 시험 시작 시 개인별 시험지가 생성되고, 시작 이후에는 문항 구성이 고정됩니다.
                </div>
              ) : null}
              {!data.employeeView.attempt && (
                <button
                  type="button"
                  className={primaryButtonClassName}
                  disabled={isPending}
                  onClick={() =>
                    runMutation(
                      () => callAction('startAttempt', { assignmentId: data.employeeView?.assignment?.id }),
                      '1차 평가 응시를 시작했습니다.'
                    )
                  }
                >
                  응시 시작
                </button>
              )}
              {data.employeeView.questions.map((question, index) => (
                <div key={question.id} className="rounded-2xl border border-slate-200 p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">문항 {index + 1}. {question.title}</span>
                    <StatusPill value={question.competencyDomain} customLabel={domainLabel(question.competencyDomain)} />
                    <StatusPill value={question.questionType} customLabel={questionTypeLabel(question.questionType)} />
                    <StatusPill value={question.difficulty} customLabel={difficultyLabel(question.difficulty)} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.prompt}</p>
                  <div className="mt-4 space-y-3">
                    {(question.questionType === 'SINGLE_CHOICE' || question.questionType === 'SCENARIO_JUDGEMENT') &&
                      question.options.map((option) => (
                        <label key={option} className="flex gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                          <input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />
                          <span>{option}</span>
                        </label>
                      ))}
                    {question.questionType === 'MULTIPLE_CHOICE' &&
                      question.options.map((option) => (
                        <label key={option} className="flex gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                          <input type="checkbox" checked={isSelectedMultiAnswer(answers, question.id, option)} onChange={(event) => toggleMultiAnswer(question.id, option, event.target.checked)} />
                          <span>{option}</span>
                        </label>
                      ))}
                    {(question.questionType === 'SHORT_ANSWER' || question.questionType === 'PRACTICAL' || !question.options.length) && (
                      <textarea className={`${inputClassName} min-h-32`} value={typeof answers[question.id] === 'string' ? answers[question.id] ?? '' : ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
                    )}
                  </div>
                </div>
              ))}
              {data.employeeView.attempt && data.employeeView.attempt.status !== 'SCORED' && (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={isPending}
                    onClick={() =>
                      runMutation(
                        () =>
                          callAction('saveAttempt', {
                            attemptId: data.employeeView!.attempt!.id,
                            submit: false,
                            answers: data.employeeView!.questions.map((question) => ({
                              questionId: question.id,
                              answer: answers[question.id] ?? (question.questionType === 'MULTIPLE_CHOICE' ? [] : ''),
                            })),
                          }),
                        '답안을 저장했습니다.'
                      )
                    }
                  >
                    임시 저장
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={isPending}
                    onClick={() =>
                      runMutation(
                        () =>
                          callAction('saveAttempt', {
                            attemptId: data.employeeView!.attempt!.id,
                            submit: true,
                            answers: data.employeeView!.questions.map((question) => ({
                              questionId: question.id,
                              answer: answers[question.id] ?? (question.questionType === 'MULTIPLE_CHOICE' ? [] : ''),
                            })),
                          }),
                        '1차 공통평가를 제출했습니다.'
                      )
                    }
                  >
                    최종 제출
                  </button>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'second-round' && (
        <SectionCard title="2차 실무인증" description="1차 합격자 중 대상자만 신청할 수 있습니다.">
          {!data.employeeView?.assignment ? (
            <EmptyBox message="현재 주기에 배정된 2차 실무인증 정보가 없습니다." />
          ) : (
            <div className="space-y-6">
              {data.employeeView.secondRound.application ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill value={data.employeeView.secondRound.application.status} />
                    <span className="text-sm text-slate-600">제출물 {data.employeeView.secondRound.application.artifacts.length}건 / 보너스 {data.employeeView.secondRound.application.aggregatedBonus ?? 0}점</span>
                  </div>
                </div>
              ) : null}
              {!canSubmitSecondRound ? (
                <EmptyBox message="1차 합격자 중 신청 가능자로 배정된 경우에만 2차 실무인증을 제출할 수 있습니다." />
              ) : (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!data.employeeView?.assignment) return
                    runMutation(
                      () =>
                        callMultipartAction(
                          'submitSecondRound',
                          { assignmentId: data.employeeView!.assignment!.id, ...secondRoundForm },
                          secondRoundFiles.map((file) => ({ field: 'artifacts', file }))
                        ),
                      '2차 실무인증 신청을 제출했습니다.'
                    )
                  }}
                >
                  <Field label="과제 설명"><textarea className={`${inputClassName} min-h-24`} value={secondRoundForm.taskDescription} onChange={(event) => setSecondRoundForm((current) => ({ ...current, taskDescription: event.target.value }))} /></Field>
                  <Field label="AI 사용 목적"><textarea className={`${inputClassName} min-h-24`} value={secondRoundForm.aiUsagePurpose} onChange={(event) => setSecondRoundForm((current) => ({ ...current, aiUsagePurpose: event.target.value }))} /></Field>
                  <Field label="사용 도구"><input className={inputClassName} value={secondRoundForm.toolUsed} onChange={(event) => setSecondRoundForm((current) => ({ ...current, toolUsed: event.target.value }))} /></Field>
                  <Field label="프롬프트/접근 방식 요약"><textarea className={`${inputClassName} min-h-24`} value={secondRoundForm.promptSummary} onChange={(event) => setSecondRoundForm((current) => ({ ...current, promptSummary: event.target.value }))} /></Field>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="검증 방법"><textarea className={`${inputClassName} min-h-24`} value={secondRoundForm.verificationMethod} onChange={(event) => setSecondRoundForm((current) => ({ ...current, verificationMethod: event.target.value }))} /></Field>
                    <Field label="업무 효과"><textarea className={`${inputClassName} min-h-24`} value={secondRoundForm.businessImpact} onChange={(event) => setSecondRoundForm((current) => ({ ...current, businessImpact: event.target.value }))} /></Field>
                    <Field label="민감정보 점검"><textarea className={`${inputClassName} min-h-24`} value={secondRoundForm.sensitiveDataCheck} onChange={(event) => setSecondRoundForm((current) => ({ ...current, sensitiveDataCheck: event.target.value }))} /></Field>
                  </div>
                  <Field label="제출물 첨부"><input type="file" multiple onChange={(event) => setSecondRoundFiles(Array.from(event.target.files ?? []))} /></Field>
                  <button type="submit" className={primaryButtonClassName} disabled={isPending}>2차 실무인증 제출</button>
                </form>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'certificate' && (
        <SectionCard title="외부자격 인정" description="외부 자격 증빙을 제출하고 승인 상태를 확인합니다.">
          {!data.employeeView?.assignment ? (
            <EmptyBox message="현재 주기에 배정된 대상자 정보가 없습니다." />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-3">
                  {data.employeeView.externalCerts.masters.map((master) => (
                    <div key={master.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                      <p className="font-medium text-slate-900">{master.name}</p>
                      <p className="text-sm text-slate-500">{master.vendor ?? '외부 기관'} / 인정 점수 {master.mappedScore}점</p>
                    </div>
                  ))}
                </div>
                <form
                  className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!data.employeeView?.assignment || !certFile) return
                    runMutation(
                      () =>
                        callMultipartAction(
                          'submitCertClaim',
                          {
                            assignmentId: data.employeeView!.assignment!.id,
                            certificateId: certForm.certificateId,
                            certificateNumber: certForm.certificateNumber,
                            issuedAt: certForm.issuedAt || undefined,
                            expiresAt: certForm.expiresAt || undefined,
                            policyAcknowledged: certForm.policyAcknowledged,
                          },
                          [{ field: 'proof', file: certFile }]
                        ),
                      '외부자격 인정 요청을 제출했습니다.'
                    )
                  }}
                >
                  <Field label="자격명"><select className={inputClassName} value={certForm.certificateId} onChange={(event) => setCertForm((current) => ({ ...current, certificateId: event.target.value }))}>{data.employeeView.externalCerts.masters.map((master) => <option key={master.id} value={master.id}>{master.name}</option>)}</select></Field>
                  <Field label="자격번호"><input className={inputClassName} value={certForm.certificateNumber} onChange={(event) => setCertForm((current) => ({ ...current, certificateNumber: event.target.value }))} /></Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="취득일"><input type="date" className={inputClassName} value={certForm.issuedAt} onChange={(event) => setCertForm((current) => ({ ...current, issuedAt: event.target.value }))} /></Field>
                    <Field label="만료일"><input type="date" className={inputClassName} value={certForm.expiresAt} onChange={(event) => setCertForm((current) => ({ ...current, expiresAt: event.target.value }))} /></Field>
                  </div>
                  <Field label="증빙 파일"><input type="file" onChange={(event) => setCertFile(event.target.files?.[0] ?? null)} /></Field>
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={certForm.policyAcknowledged} onChange={(event) => setCertForm((current) => ({ ...current, policyAcknowledged: event.target.checked }))} />
                    <span>사내 AI 사용 가이드와 민감정보 처리 정책을 확인했습니다.</span>
                  </label>
                  <button type="submit" className={primaryButtonClassName} disabled={isPending}>외부자격 인정 요청</button>
                </form>
              </div>
              <DataTable title="요청 이력" columns={['자격명', '상태', '제출 시각', '인정 점수']} rows={data.employeeView.externalCerts.claims.map((claim) => [claim.certificateName, STATUS_LABELS[claim.status] ?? claim.status, formatDateTime(claim.submittedAt), `${claim.mappedScoreSnapshot}점`])} />
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'reviewer' && (
        <SectionCard title="리뷰어 심사" description="배정된 2차 제출건만 열람하고 루브릭 기준으로 저장 또는 최종 제출합니다.">
          {!data.reviewerView?.queue.length ? (
            <EmptyBox message="현재 배정된 리뷰 작업이 없습니다." />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-4">
                <Field label="심사 대상 검색">
                  <input className={inputClassName} value={reviewerSearch} onChange={(event) => setReviewerSearch(event.target.value)} placeholder="이름, 부서, 과제 설명으로 검색" />
                </Field>
                <div className="space-y-3">
                  {filteredReviewerQueue.map((item) => (
                    <button
                      key={item.reviewId}
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                      onClick={() =>
                        setReviewForm({
                          submissionId: item.submissionId,
                          decision: item.existingDecision ?? 'PASS',
                          notes: item.existingNote ?? '',
                          qnaNote: item.existingQnaNote ?? '',
                          criterionScores: buildCriterionDrafts(item),
                        })
                      }
                    >
                      <div className="flex flex-wrap gap-2">
                        <StatusPill value={item.reviewStatus} />
                        <StatusPill value={item.status} />
                      </div>
                      <p className="mt-2 font-medium text-slate-900">{item.employeeName}</p>
                      <p className="text-sm text-slate-500">{item.department} / {labelForTrack(item.track)}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.taskDescription}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                {selectedReviewItem ? (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedReviewItem.employeeName} 제출건</h3>
                      <p className="mt-1 text-sm text-slate-600">{selectedReviewItem.taskDescription}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedReviewItem.artifacts.map((artifact) => (
                          <a key={artifact.id} className={secondaryButtonClassName} href={`/api/evaluation/ai-competency/artifacts/${artifact.id}`}>
                            {artifact.fileName} ({formatFileSize(artifact.sizeBytes)})
                          </a>
                        ))}
                      </div>
                    </div>
                    {selectedReviewItem.rubric ? (
                      <>
                        <div className="grid gap-3 md:grid-cols-3">
                          <MetricCard label="루브릭 총점" value={`${selectedReviewItem.rubric.totalScore}점`} />
                          <MetricCard label="합격 기준" value={`${selectedReviewItem.rubric.passScore}점`} />
                          <MetricCard label="합격 보너스" value={`${selectedReviewItem.rubric.bonusScoreIfPassed}점`} />
                        </div>
                        <div className="space-y-4">
                          {selectedReviewItem.rubric.criteria.map((criterion) => {
                            const draft = reviewForm.criterionScores.find((item) => item.criterionId === criterion.criterionId)
                            return (
                              <div key={criterion.criterionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-slate-900">{criterion.criterionName}</p>
                                    {criterion.criterionDescription ? <p className="mt-1 text-sm text-slate-600">{criterion.criterionDescription}</p> : null}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <StatusPill value={criterion.mandatory ? 'ACTIVE' : 'INACTIVE'} customLabel={criterion.mandatory ? '필수' : '선택'} />
                                    {criterion.knockout ? <StatusPill value="FAILED" customLabel="Knockout" /> : null}
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {criterion.bands.map((band) => (
                                    <button
                                      key={`${criterion.criterionId}-${band.score}`}
                                      type="button"
                                      className={draft?.score === String(band.score) ? 'rounded-full bg-slate-950 px-3 py-2 text-xs font-medium text-white' : 'rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700'}
                                      onClick={() =>
                                        setReviewForm((current) => ({
                                          ...current,
                                          criterionScores: current.criterionScores.map((item) =>
                                            item.criterionId === criterion.criterionId
                                              ? { ...item, score: String(band.score) }
                                              : item
                                          ),
                                        }))
                                      }
                                    >
                                      {band.score}점 {band.title}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <Field label="점수">
                                    <input
                                      type="number"
                                      className={inputClassName}
                                      value={draft?.score ?? ''}
                                      onChange={(event) =>
                                        setReviewForm((current) => ({
                                          ...current,
                                          criterionScores: current.criterionScores.map((item) =>
                                            item.criterionId === criterion.criterionId
                                              ? { ...item, score: event.target.value }
                                              : item
                                          ),
                                        }))
                                      }
                                    />
                                  </Field>
                                  {criterion.knockout ? (
                                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={draft?.knockoutTriggered ?? false}
                                        onChange={(event) =>
                                          setReviewForm((current) => ({
                                            ...current,
                                            criterionScores: current.criterionScores.map((item) =>
                                              item.criterionId === criterion.criterionId
                                                ? { ...item, knockoutTriggered: event.target.checked }
                                                : item
                                            ),
                                          }))
                                        }
                                      />
                                      Knockout 위반 체크
                                    </label>
                                  ) : <div />}
                                </div>
                                <Field label="평가기준 코멘트">
                                  <textarea
                                    className={`${inputClassName} mt-4 min-h-24`}
                                    value={draft?.comment ?? ''}
                                    onChange={(event) =>
                                      setReviewForm((current) => ({
                                        ...current,
                                        criterionScores: current.criterionScores.map((item) =>
                                          item.criterionId === criterion.criterionId
                                            ? { ...item, comment: event.target.value }
                                            : item
                                        ),
                                      }))
                                    }
                                  />
                                </Field>
                              </div>
                            )
                          })}
                        </div>
                        {(() => {
                          const preview = calculateRubricReview({
                            rubric: {
                              rubricName: selectedReviewItem.rubric.rubricName,
                              rubricVersion: 1,
                              track: selectedReviewItem.track,
                              totalScore: selectedReviewItem.rubric.totalScore,
                              passScore: selectedReviewItem.rubric.passScore,
                              bonusScoreIfPassed: selectedReviewItem.rubric.bonusScoreIfPassed,
                              certificationLabel: selectedReviewItem.rubric.certificationLabel ?? null,
                            },
                            criteria: selectedReviewItem.rubric.criteria.map((criterion) => ({
                              id: criterion.criterionId,
                              criterionCode: criterion.criterionCode,
                              criterionName: criterion.criterionName,
                              criterionDescription: criterion.criterionDescription,
                              maxScore: criterion.maxScore,
                              displayOrder: 0,
                              mandatory: criterion.mandatory,
                              knockout: criterion.knockout,
                              bands: criterion.bands.map((band, index) => ({
                                score: band.score,
                                title: band.title,
                                description: band.description,
                                guidance: band.guidance,
                                displayOrder: index,
                              })),
                            })),
                            criterionScores: reviewForm.criterionScores.map((criterion) => ({
                              criterionId: criterion.criterionId,
                              score: Number(criterion.score || 0),
                              comment: criterion.comment || undefined,
                              knockoutTriggered: criterion.knockoutTriggered,
                            })),
                            decision: reviewForm.decision,
                            submitFinal: false,
                          })
                          return (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                              합계 {preview.totalScore}점 / 예상 판정 {STATUS_LABELS[preview.decision] ?? preview.decision} / 예상 보너스 {preview.bonusScore}점
                              {preview.knockoutTriggered ? <span className="ml-2 text-rose-600">Knockout 조건이 감지되었습니다.</span> : null}
                            </div>
                          )
                        })()}
                        <Field label="종합 심사 의견">
                          <textarea className={`${inputClassName} min-h-24`} value={reviewForm.notes} onChange={(event) => setReviewForm((current) => ({ ...current, notes: event.target.value }))} />
                        </Field>
                        <Field label="Q&A 메모">
                          <textarea className={`${inputClassName} min-h-24`} value={reviewForm.qnaNote} onChange={(event) => setReviewForm((current) => ({ ...current, qnaNote: event.target.value }))} />
                        </Field>
                        <Field label="최종 판정">
                          <select className={inputClassName} value={reviewForm.decision} onChange={(event) => setReviewForm((current) => ({ ...current, decision: event.target.value as AiCompetencyReviewDecision }))}>
                            <option value="PASS">합격</option>
                            <option value="FAIL">불합격</option>
                            <option value="REVISE">재검토 필요</option>
                          </select>
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={isPending}
                            onClick={() =>
                              runMutation(
                                () =>
                                  callAction('reviewSubmission', {
                                    submissionId: reviewForm.submissionId,
                                    criterionScores: reviewForm.criterionScores.map((criterion) => ({
                                      criterionId: criterion.criterionId,
                                      score: Number(criterion.score || 0),
                                      comment: criterion.comment || undefined,
                                      knockoutTriggered: criterion.knockoutTriggered,
                                    })),
                                    notes: reviewForm.notes,
                                    qnaNote: reviewForm.qnaNote,
                                    submitFinal: false,
                                  }),
                                '리뷰 초안을 저장했습니다.'
                              )
                            }
                          >
                            초안 저장
                          </button>
                          <button
                            type="button"
                            className={primaryButtonClassName}
                            disabled={isPending}
                            onClick={() =>
                              runMutation(
                                () =>
                                  callAction('reviewSubmission', {
                                    submissionId: reviewForm.submissionId,
                                    criterionScores: reviewForm.criterionScores.map((criterion) => ({
                                      criterionId: criterion.criterionId,
                                      score: Number(criterion.score || 0),
                                      comment: criterion.comment || undefined,
                                      knockoutTriggered: criterion.knockoutTriggered,
                                    })),
                                    decision: reviewForm.decision,
                                    notes: reviewForm.notes,
                                    qnaNote: reviewForm.qnaNote,
                                    submitFinal: true,
                                  }),
                                '2차 실무인증 심사를 최종 제출했습니다.'
                              )
                            }
                          >
                            최종 제출
                          </button>
                        </div>
                      </>
                    ) : (
                      <EmptyBox message="현재 제출건에는 연결된 활성 루브릭이 없습니다." />
                    )}
                  </>
                ) : (
                  <EmptyBox message="심사할 제출건을 선택해 주세요." />
                )}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'admin' && <AiCompetencyAdminPanel pageData={data} isPending={isPending} callAction={callAction} runMutation={runMutation} />}

      {activeTab === 'executive' && (
        <SectionCard title="보고/분포" description="조직별 분포와 완료율을 확인합니다.">
          {data.executiveView ? (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <a className={secondaryButtonClassName} href={data.executiveView.exportUrls.csv}>CSV 내보내기</a>
                <a className={secondaryButtonClassName} href={data.executiveView.exportUrls.xlsx}>XLSX 내보내기</a>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="완료율" value={`${data.executiveView.completionRate.toFixed(1)}%`} />
                <MetricCard label="합격률" value={`${data.executiveView.passRate.toFixed(1)}%`} />
                <MetricCard label="2차 참여율" value={`${data.executiveView.secondRoundParticipationRate.toFixed(1)}%`} />
                <MetricCard label="인증률" value={`${data.executiveView.certificationRate.toFixed(1)}%`} />
              </div>
              <DataTable title="트랙별 분포" columns={['트랙', '인원', '평균 점수', '합격률']} rows={data.executiveView.trackDistribution.map((row) => [labelForTrack(row.track), `${row.count}명`, `${row.averageScore.toFixed(1)}점`, `${row.passRate.toFixed(1)}%`])} />
              <DataTable title="부서별 평균" columns={['부서', '인원', '평균 점수']} rows={data.executiveView.departmentDistribution.map((row) => [row.department, `${row.count}명`, `${row.averageScore.toFixed(1)}점`])} />
            </div>
          ) : (
            <EmptyBox message="표시할 집계 데이터가 없습니다." />
          )}
        </SectionCard>
      )}
    </div>
  )
}
