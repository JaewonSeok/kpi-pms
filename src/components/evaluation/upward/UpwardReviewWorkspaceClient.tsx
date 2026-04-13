'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { UpwardReviewPageData } from '@/server/upward-review'

type Notice =
  | {
      tone: 'success' | 'error'
      message: string
    }
  | null

const cardClassName = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-400'
const textareaClassName = `${inputClassName} min-h-[120px] resize-y`
const primaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'
const secondaryButtonClassName =
  'inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400'
const NEW_TEMPLATE_ID = '__new__'
const TARGET_TYPE_LABELS: Record<string, string> = {
  TEAM_LEADER: '팀장',
  SECTION_CHIEF: '실장',
  DIVISION_HEAD: '본부장/부문장',
  PM: 'PM',
  CUSTOM: '직접 지정',
}

function resolveTargetTypeFromLabel(label: string) {
  return (
    Object.entries(TARGET_TYPE_LABELS).find(([, value]) => value === label)?.[0] ??
    'TEAM_LEADER'
  )
}

function ActionLink(props: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={props.href}
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
        props.active
          ? 'bg-slate-950 text-white'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {props.label}
    </Link>
  )
}

function SectionCard(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={cardClassName}>
      <h3 className="text-lg font-semibold text-slate-900">{props.title}</h3>
      {props.description ? <p className="mt-2 text-sm text-slate-500">{props.description}</p> : null}
      <div className="mt-5">{props.children}</div>
    </section>
  )
}

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{props.value}</div>
      {props.hint ? <p className="mt-2 text-sm text-slate-500">{props.hint}</p> : null}
    </div>
  )
}

function formatForDateTimeInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60000)
  return adjusted.toISOString().slice(0, 16)
}

function parseChoiceText(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseStoredChoiceValue(value?: string | null) {
  if (!value) return [] as string[]
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string')
    }
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

async function readApiBody(response: Response) {
  const body = (await response.json()) as {
    success: boolean
    data?: Record<string, unknown>
    error?: { message?: string }
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error?.message ?? '요청을 처리하지 못했습니다.')
  }

  return body.data ?? {}
}

export function UpwardReviewWorkspaceClient(props: { data: UpwardReviewPageData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const adminData = props.data.admin
  const respondData = props.data.respond
  const resultsData = props.data.results

  const [selectedTemplateId, setSelectedTemplateId] = useState(adminData?.selectedTemplateId ?? adminData?.templates[0]?.id ?? NEW_TEMPLATE_ID)
  const [templateDraft, setTemplateDraft] = useState({
    templateId: '',
    name: '',
    description: '',
    isActive: true,
    defaultMinResponses: 3,
    defaultTargetTypes: ['TEAM_LEADER'] as string[],
  })
  const [questionDraft, setQuestionDraft] = useState({
    templateId: '',
    questionId: '',
    category: '리더십',
    questionText: '',
    description: '',
    questionType: 'RATING_SCALE' as 'TEXT' | 'RATING_SCALE' | 'MULTIPLE_CHOICE',
    scaleMin: 1,
    scaleMax: 5,
    isRequired: true,
    isActive: true,
    choiceOptionsText: '',
  })
  const [roundDraft, setRoundDraft] = useState({
    roundId: '',
    evalCycleId: props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? '',
    roundName: '',
    templateId: '',
    startDate: '',
    endDate: '',
    minRaters: 3,
    targetTypes: ['TEAM_LEADER'] as string[],
    resultViewerMode: 'TARGET_ONLY' as 'TARGET_ONLY' | 'TARGET_AND_PRIMARY_MANAGER',
    rawResponsePolicy: 'ADMIN_ONLY' as 'ADMIN_ONLY' | 'REVIEW_ADMIN_CONTENT',
  })
  const [assignmentDraft, setAssignmentDraft] = useState({
    evaluatorId: '',
    evaluateeId: '',
    relationship: 'SUBORDINATE' as 'SUBORDINATE' | 'PEER' | 'CROSS_DEPT',
  })
  const [assignmentFilter, setAssignmentFilter] = useState('')
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED'>('ALL')
  const [overallComment, setOverallComment] = useState(respondData?.overallComment ?? '')
  const [questionState, setQuestionState] = useState<
    Record<string, { ratingValue: number | null; textValue: string; choiceValues: string[] }>
  >({})

  const selectedTemplate = useMemo(
    () => (selectedTemplateId === NEW_TEMPLATE_ID ? null : adminData?.templates.find((template) => template.id === selectedTemplateId) ?? null),
    [adminData?.templates, selectedTemplateId]
  )

  const employeeDirectory = adminData?.employeeDirectory ?? []

  useEffect(() => {
    setNotice(null)
  }, [props.data.mode, props.data.selectedCycleId, props.data.selectedRoundId])

  useEffect(() => {
    if (!adminData) return
    if (selectedTemplateId === NEW_TEMPLATE_ID) return
    if (selectedTemplateId && adminData.templates.some((template) => template.id === selectedTemplateId)) return
    setSelectedTemplateId(adminData.selectedTemplateId ?? adminData.templates[0]?.id ?? NEW_TEMPLATE_ID)
  }, [adminData, selectedTemplateId])

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateDraft({
        templateId: selectedTemplate.id,
        name: selectedTemplate.name,
        description: selectedTemplate.description ?? '',
        isActive: selectedTemplate.isActive,
        defaultMinResponses: selectedTemplate.defaultMinResponses,
        defaultTargetTypes: selectedTemplate.defaultTargetTypes.map(resolveTargetTypeFromLabel),
      })
      setQuestionDraft((current) => ({
        ...current,
        templateId: selectedTemplate.id,
      }))
      return
    }

    setTemplateDraft({
      templateId: '',
      name: '',
      description: '',
      isActive: true,
      defaultMinResponses: 3,
      defaultTargetTypes: ['TEAM_LEADER'],
    })
    setQuestionDraft({
      templateId: '',
      questionId: '',
      category: '리더십',
      questionText: '',
      description: '',
      questionType: 'RATING_SCALE',
      scaleMin: 1,
      scaleMax: 5,
      isRequired: true,
      isActive: true,
      choiceOptionsText: '',
    })
  }, [selectedTemplate])

  useEffect(() => {
    if (!adminData?.selectedRound) {
      setRoundDraft({
        roundId: '',
        evalCycleId: props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? '',
        roundName: '',
        templateId: selectedTemplate?.id ?? '',
        startDate: '',
        endDate: '',
        minRaters: 3,
        targetTypes: ['TEAM_LEADER'],
        resultViewerMode: 'TARGET_ONLY',
        rawResponsePolicy: 'ADMIN_ONLY',
      })
      return
    }

    setRoundDraft({
      roundId: adminData.selectedRound.id,
      evalCycleId: props.data.selectedCycleId ?? props.data.availableCycles[0]?.id ?? '',
      roundName: adminData.selectedRound.roundName,
      templateId: adminData.selectedRound.templateId ?? selectedTemplate?.id ?? '',
      startDate: formatForDateTimeInput(adminData.selectedRound.startDate),
      endDate: formatForDateTimeInput(adminData.selectedRound.endDate),
      minRaters:
        props.data.availableRounds.find((round) => round.id === adminData.selectedRound?.id)?.minRaters ?? 3,
      targetTypes: adminData.selectedRound.targetTypes.map(resolveTargetTypeFromLabel),
      resultViewerMode: adminData.selectedRound.resultViewerMode === '피평가자 + 1차 리더' ? 'TARGET_AND_PRIMARY_MANAGER' : 'TARGET_ONLY',
      rawResponsePolicy: adminData.selectedRound.rawResponsePolicy === '콘텐츠 열람 권한 운영자' ? 'REVIEW_ADMIN_CONTENT' : 'ADMIN_ONLY',
    })
  }, [adminData?.selectedRound, props.data.availableCycles, props.data.availableRounds, props.data.selectedCycleId, selectedTemplate?.id])

  useEffect(() => {
    if (!respondData) return

    setOverallComment(respondData.overallComment)
    setQuestionState(
      Object.fromEntries(
        respondData.questions.map((question) => [
          question.id,
          {
            ratingValue: question.ratingValue ?? null,
            textValue: question.questionType === 'MULTIPLE_CHOICE' ? '' : question.textValue ?? '',
            choiceValues:
              question.questionType === 'MULTIPLE_CHOICE'
                ? parseStoredChoiceValue(question.textValue)
                : [],
          },
        ])
      )
    )
  }, [respondData])

  const filteredAssignments = useMemo(() => {
    const assignments = adminData?.selectedRound?.assignments ?? []
    return assignments.filter((assignment) => {
      const matchesStatus = assignmentStatusFilter === 'ALL' || assignment.status === assignmentStatusFilter
      const haystack = `${assignment.evaluateeName} ${assignment.evaluateeDepartment} ${assignment.evaluatorName} ${assignment.evaluatorDepartment}`.toLowerCase()
      const matchesText = assignmentFilter.trim() ? haystack.includes(assignmentFilter.trim().toLowerCase()) : true
      return matchesStatus && matchesText
    })
  }, [adminData?.selectedRound?.assignments, assignmentFilter, assignmentStatusFilter])

  function updateSearch(params: Record<string, string | undefined>) {
    const search = new URLSearchParams()
    const cycleId = params.cycleId ?? props.data.selectedCycleId
    const roundId = params.roundId ?? props.data.selectedRoundId
    const empId = params.empId ?? resultsData?.selectedTargetId
    if (cycleId) search.set('cycleId', cycleId)
    if (roundId) search.set('roundId', roundId)
    if (empId && props.data.mode === 'results') search.set('empId', empId)
    return search.toString()
  }

  async function runAdminAction(action: string, payload: unknown, successMessage?: string) {
    setBusyKey(action)
    setNotice(null)
    try {
      const result = await readApiBody(
        await fetch('/api/feedback/upward/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        })
      )
      setNotice({
        tone: 'success',
        message: successMessage ?? String(result.message ?? '작업이 저장되었습니다.'),
      })
      return result
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '작업을 처리하지 못했습니다.',
      })
      return null
    } finally {
      setBusyKey(null)
    }
  }

  async function handleSaveTemplate() {
    const payload = {
      ...templateDraft,
      defaultMinResponses: Number(templateDraft.defaultMinResponses),
    }
    const result = await runAdminAction(templateDraft.templateId ? 'updateTemplate' : 'createTemplate', payload)
    if (!result) return
    if (typeof result.templateId === 'string') {
      setSelectedTemplateId(result.templateId)
    }
    startTransition(() => router.refresh())
  }

  async function handleDuplicateTemplate() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const result = await runAdminAction('duplicateTemplate', { templateId: selectedTemplateId })
    if (!result) return
    if (typeof result.templateId === 'string') {
      setSelectedTemplateId(result.templateId)
    }
    startTransition(() => router.refresh())
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const result = await runAdminAction('deleteTemplate', { templateId: selectedTemplateId })
    if (!result) return
    setSelectedTemplateId(NEW_TEMPLATE_ID)
    startTransition(() => router.refresh())
  }

  async function handleSaveQuestion() {
    if (!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID) return
    const payload = {
      ...questionDraft,
      templateId: selectedTemplateId,
      choiceOptions: questionDraft.questionType === 'MULTIPLE_CHOICE' ? parseChoiceText(questionDraft.choiceOptionsText) : [],
    }
    const result = await runAdminAction('saveQuestion', payload)
    if (!result) return
    setQuestionDraft({
      templateId: selectedTemplateId,
      questionId: '',
      category: '리더십',
      questionText: '',
      description: '',
      questionType: 'RATING_SCALE',
      scaleMin: 1,
      scaleMax: 5,
      isRequired: true,
      isActive: true,
      choiceOptionsText: '',
    })
    startTransition(() => router.refresh())
  }

  async function handleRoundSave() {
    const result = await runAdminAction('saveRound', {
      ...roundDraft,
      minRaters: Number(roundDraft.minRaters),
      templateId: roundDraft.templateId || selectedTemplateId,
      startDate: new Date(roundDraft.startDate).toISOString(),
      endDate: new Date(roundDraft.endDate).toISOString(),
    })
    if (!result) return
    if (typeof result.roundId === 'string') {
      router.push(`/evaluation/upward/admin?${updateSearch({ roundId: result.roundId, cycleId: roundDraft.evalCycleId })}`)
      return
    }
    startTransition(() => router.refresh())
  }

  async function handleSaveDraft() {
    if (!respondData) return
    setBusyKey('draft')
    setNotice(null)
    try {
      const responsePayload = {
        overallComment,
        responses: respondData.questions.map((question) => ({
          questionId: question.id,
          ratingValue: questionState[question.id]?.ratingValue ?? null,
          textValue:
            question.questionType === 'MULTIPLE_CHOICE'
              ? JSON.stringify(questionState[question.id]?.choiceValues ?? [])
              : questionState[question.id]?.textValue ?? '',
        })),
      }

      const result = await readApiBody(
        await fetch(`/api/feedback/upward/responses/${encodeURIComponent(respondData.feedbackId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responsePayload),
        })
      )

      setNotice({ tone: 'success', message: String(result.message ?? '초안이 저장되었습니다.') })
      startTransition(() => router.refresh())
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '초안 저장에 실패했습니다.' })
    } finally {
      setBusyKey(null)
    }
  }

  async function handleFinalSubmit() {
    if (!respondData) return
    setBusyKey('submit')
    setNotice(null)
    try {
      const responsePayload = {
        overallComment,
        responses: respondData.questions.map((question) => ({
          questionId: question.id,
          ratingValue: questionState[question.id]?.ratingValue ?? null,
          textValue:
            question.questionType === 'MULTIPLE_CHOICE'
              ? JSON.stringify(questionState[question.id]?.choiceValues ?? [])
              : questionState[question.id]?.textValue ?? '',
        })),
      }

      const result = await readApiBody(
        await fetch(`/api/feedback/upward/responses/${encodeURIComponent(respondData.feedbackId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(responsePayload),
        })
      )

      setNotice({ tone: 'success', message: String(result.message ?? '최종 제출이 완료되었습니다.') })
      startTransition(() => router.refresh())
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : '최종 제출에 실패했습니다.' })
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Upward Review</p>
            <h1 className="text-3xl font-semibold text-slate-950">
              {props.data.mode === 'admin'
                ? '상향 평가 운영'
                : props.data.mode === 'results'
                  ? '상향 평가 결과'
                  : '상향 평가'}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {props.data.mode === 'admin'
                ? '리더십 문항, 평가자-피평가자 매핑, 익명 기준, 공개 정책까지 한 흐름으로 운영합니다.'
                : props.data.mode === 'results'
                  ? '집계 결과와 공개 가능 여부를 확인하고, 관리자 권한에 따라 원문 응답 열람 여부가 달라집니다.'
                  : '배정된 리더별로 초안 저장과 최종 제출을 진행할 수 있습니다.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ActionLink
              href={`/evaluation/upward/respond?${updateSearch({ roundId: undefined, empId: undefined })}`}
              label="내 응답"
              active={props.data.mode === 'overview' || props.data.mode === 'respond'}
            />
            {props.data.mode === 'results' ? (
              <ActionLink
                href={`/evaluation/upward/results?${updateSearch({})}`}
                label="결과 보기"
                active
              />
            ) : null}
            {props.data.permissions?.canViewAdmin ? (
              <ActionLink
                href={`/evaluation/upward/admin?${updateSearch({})}`}
                label="관리자 운영"
                active={props.data.mode === 'admin'}
              />
            ) : null}
          </div>
        </div>
      </section>

      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      {props.data.state !== 'ready' ? (
        <SectionCard title="상태 안내" description={props.data.message}>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="운영 라운드" value={`${props.data.summary.activeRounds}`} />
            <StatCard label="미제출" value={`${props.data.summary.pendingAssignments}`} />
            <StatCard label="제출 완료" value={`${props.data.summary.submittedAssignments}`} />
            <StatCard label="공개 가능 대상" value={`${props.data.summary.releasedTargets}`} />
          </div>
        </SectionCard>
      ) : null}

      {props.data.mode === 'overview' && props.data.overview ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="진행 중 라운드" value={`${props.data.summary.activeRounds}`} />
            <StatCard label="내 미제출" value={`${props.data.overview.assignments.filter((item) => item.status !== 'SUBMITTED').length}건`} />
            <StatCard label="내 제출 완료" value={`${props.data.overview.assignments.filter((item) => item.status === 'SUBMITTED').length}건`} />
            <StatCard label="공개 가능 대상" value={`${props.data.summary.releasedTargets}명`} />
          </section>

          <SectionCard
            title="내 응답 대상"
            description="배정된 리더별로 초안 저장과 최종 제출을 진행할 수 있습니다."
          >
            <div className="space-y-3">
              {props.data.overview.assignments.length ? (
                props.data.overview.assignments.map((assignment) => (
                  <div key={assignment.feedbackId} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-900">{assignment.receiverName}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {assignment.statusLabel}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {assignment.relationship}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {assignment.receiverDepartment} · {assignment.receiverPosition} · 마감 {assignment.dueDate}
                        </p>
                        <p className="text-sm text-slate-500">{assignment.roundName}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Link href={assignment.href} className={primaryButtonClassName}>
                          {assignment.status === 'SUBMITTED' ? '응답 확인' : '응답 작성'}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                  현재 배정된 상향 평가가 없습니다.
                </p>
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {props.data.mode === 'respond' && respondData ? (
        <div className="space-y-6">
          <SectionCard title={respondData.receiverName} description={`${respondData.receiverDepartment} · ${respondData.receiverPosition} · 마감 ${respondData.dueDate}`}>
            <ul className="space-y-2 text-sm text-slate-600">
              {respondData.guidance.map((item) => (
                <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="공통 의견" description="필요하다면 리더십 전반에 대한 종합 의견을 남겨 주세요.">
            <textarea
              className={textareaClassName}
              value={overallComment}
              onChange={(event) => setOverallComment(event.target.value)}
              disabled={respondData.readOnly}
              placeholder="구체적인 행동 사례와 함께 작성해 주세요."
            />
          </SectionCard>

          <SectionCard title="문항 응답" description={`총 ${respondData.questions.length}개 문항`}>
            <div className="space-y-4">
              {respondData.questions.map((question, index) => {
                const currentState = questionState[question.id] ?? { ratingValue: null, textValue: '', choiceValues: [] }
                return (
                  <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{question.category}</span>
                        {question.isRequired ? (
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">필수</span>
                        ) : null}
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">
                        {index + 1}. {question.questionText}
                      </h4>
                      {question.description ? <p className="text-sm text-slate-500">{question.description}</p> : null}
                    </div>

                    <div className="mt-4">
                      {question.questionType === 'RATING_SCALE' ? (
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1 }, (_, offset) => {
                            const value = (question.scaleMin ?? 1) + offset
                            const active = currentState.ratingValue === value
                            return (
                              <button
                                key={value}
                                type="button"
                                className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold transition ${
                                  active
                                    ? 'border-slate-950 bg-slate-950 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                                disabled={respondData.readOnly}
                                onClick={() =>
                                  setQuestionState((current) => ({
                                    ...current,
                                    [question.id]: {
                                      ...currentState,
                                      ratingValue: value,
                                    },
                                  }))
                                }
                              >
                                {value}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      {question.questionType === 'TEXT' ? (
                        <textarea
                          className={textareaClassName}
                          value={currentState.textValue}
                          onChange={(event) =>
                            setQuestionState((current) => ({
                              ...current,
                              [question.id]: {
                                ...currentState,
                                textValue: event.target.value,
                              },
                            }))
                          }
                          disabled={respondData.readOnly}
                          placeholder="사실과 행동, 관찰 중심으로 작성해 주세요."
                        />
                      ) : null}

                      {question.questionType === 'MULTIPLE_CHOICE' ? (
                        <div className="space-y-2">
                          {question.choiceOptions.map((choice) => {
                            const checked = currentState.choiceValues.includes(choice)
                            return (
                              <label key={choice} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={respondData.readOnly}
                                  onChange={(event) =>
                                    setQuestionState((current) => ({
                                      ...current,
                                      [question.id]: {
                                        ...currentState,
                                        choiceValues: event.target.checked
                                          ? [...currentState.choiceValues, choice]
                                          : currentState.choiceValues.filter((item) => item !== choice),
                                      },
                                    }))
                                  }
                                />
                                <span>{choice}</span>
                              </label>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          <div className="flex flex-wrap gap-3">
            {!respondData.readOnly ? (
              <>
                <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={handleSaveDraft}>
                  {busyKey === 'draft' ? '저장 중...' : '초안 저장'}
                </button>
                <button type="button" className={primaryButtonClassName} disabled={busyKey != null} onClick={handleFinalSubmit}>
                  {busyKey === 'submit' ? '제출 중...' : '최종 제출'}
                </button>
              </>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                이 상향 평가는 이미 최종 제출되어 읽기 전용 상태입니다.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {props.data.mode === 'results' && resultsData ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="응답 수" value={`${resultsData.feedbackCount}건`} />
            <StatCard label="익명 기준" value={`${resultsData.minRaters}명`} hint={resultsData.thresholdMet ? '기준 충족' : '기준 미달'} />
            <StatCard label="결과 공개" value={resultsData.released ? '공개됨' : '비공개'} />
            <StatCard label="원문 응답" value={resultsData.canViewRaw ? '열람 가능' : '비공개'} />
          </section>

          <SectionCard title="결과 안내" description="공개용 보기와 관리자용 보기를 권한에 따라 구분합니다.">
            <div className="space-y-3 text-sm text-slate-600">
              <p>상향 평가는 리더의 운영 방식과 개선 방향을 이해하기 위한 참고 자료입니다.</p>
              <p>집계 결과만 제공되며, 개별 평가자 정보는 공개되지 않습니다.</p>
            </div>
          </SectionCard>

          <SectionCard title="대상자 선택" description="권한 범위 안에서 열람 가능한 대상자만 표시됩니다.">
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <select
                className={inputClassName}
                value={resultsData.selectedTargetId}
                onChange={(event) => router.push(`/evaluation/upward/results?${updateSearch({ empId: event.target.value })}`)}
              >
                {resultsData.targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name} · {target.department} · {target.feedbackCount}건 · {target.visible ? '공개 가능' : '비공개'}
                  </option>
                ))}
              </select>
              <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">{resultsData.targetEmployee.name}</div>
                <div className="mt-1">
                  {resultsData.targetEmployee.department} · {resultsData.targetEmployee.position}
                </div>
                <div className="mt-2 text-xs text-slate-500">{resultsData.roundName}</div>
              </div>
            </div>
          </SectionCard>

          {!resultsData.visible ? (
            <SectionCard title="결과 비공개" description={resultsData.hiddenReason}>
              <p className="text-sm text-slate-600">
                결과는 익명 기준과 공개 정책을 충족한 이후에만 확인할 수 있습니다.
              </p>
            </SectionCard>
          ) : (
            <>
              <SectionCard title="강점 및 개선 포인트" description="카테고리별 평균을 기준으로 요약했습니다.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <h4 className="font-semibold text-emerald-800">강점 요약</h4>
                    <ul className="mt-3 space-y-2 text-sm text-emerald-800">
                      {resultsData.strengths.length ? resultsData.strengths.map((item) => <li key={item}>{item}</li>) : <li>아직 강점 요약이 없습니다.</li>}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="font-semibold text-amber-800">개선 포인트</h4>
                    <ul className="mt-3 space-y-2 text-sm text-amber-800">
                      {resultsData.improvements.length ? resultsData.improvements.map((item) => <li key={item}>{item}</li>) : <li>아직 개선 포인트 요약이 없습니다.</li>}
                    </ul>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="문항별 결과" description="척도형은 평균 점수, 서술형은 익명 응답 모음으로 표시합니다.">
                <div className="space-y-4">
                  {resultsData.questionSummaries.map((question) => (
                    <div key={question.questionId} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{question.category}</div>
                          <h4 className="mt-1 text-base font-semibold text-slate-900">{question.questionText}</h4>
                        </div>
                        <div className="text-sm text-slate-500">
                          {question.averageScore != null ? `평균 ${question.averageScore}점 · ` : ''}
                          응답 {question.responseCount}건
                        </div>
                      </div>
                      {question.questionType === 'TEXT' ? (
                        <ul className="mt-4 space-y-2 text-sm text-slate-700">
                          {question.textResponses.map((item, index) => (
                            <li key={`${question.questionId}:${index}`} className="rounded-2xl bg-slate-50 px-4 py-3">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {question.questionType === 'MULTIPLE_CHOICE' ? (
                        <div className="mt-4 grid gap-2 md:grid-cols-2">
                          {question.choiceCounts.map((choice) => (
                            <div key={choice.label} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                              {choice.label} · {choice.count}건
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {resultsData.canViewRaw ? (
            <SectionCard title="관리자용 원문 응답" description="평가자 식별 정보가 포함된 관리자 전용 보기입니다.">
              <div className="space-y-4">
                {resultsData.rawResponses.map((response) => (
                  <div key={`${response.giverId}:${response.relationship}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{response.giverName}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{response.relationship}</span>
                    </div>
                    {response.overallComment ? <p className="mt-3 text-sm text-slate-600">{response.overallComment}</p> : null}
                    <div className="mt-4 space-y-2">
                      {response.answers.map((answer) => (
                        <div key={`${response.giverId}:${answer.questionId}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          <div className="font-medium text-slate-900">{answer.questionText}</div>
                          <div className="mt-1">
                            {answer.ratingValue != null ? `점수 ${answer.ratingValue}` : answer.textValue || '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {props.data.mode === 'admin' && adminData ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            {adminData.selectedRound?.summaryCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} />
            ))}
          </section>

          <SectionCard title="템플릿 라이브러리" description="리더십 문항을 직접 추가, 수정, 삭제, 정렬할 수 있습니다.">
            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-3">
                    <button type="button" className={secondaryButtonClassName} onClick={() => setSelectedTemplateId(NEW_TEMPLATE_ID)}>
                  새 템플릿
                </button>
                <div className="space-y-2">
                  {adminData.templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedTemplateId === template.id
                          ? 'border-slate-950 bg-slate-950 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">{template.name}</div>
                      <div className={`mt-1 text-xs ${selectedTemplateId === template.id ? 'text-slate-200' : 'text-slate-500'}`}>
                        문항 {template.questionCount}개 · 익명 기준 {template.defaultMinResponses}명
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input className={inputClassName} value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="템플릿 이름" />
                  <input className={inputClassName} type="number" min={1} max={10} value={templateDraft.defaultMinResponses} onChange={(event) => setTemplateDraft((current) => ({ ...current, defaultMinResponses: Number(event.target.value) }))} placeholder="익명 기준" />
                </div>
                <textarea className={textareaClassName} value={templateDraft.description} onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))} placeholder="템플릿 설명" />
                <div className="flex flex-wrap gap-2">
                  {['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM', 'CUSTOM'].map((type) => {
                    const active = templateDraft.defaultTargetTypes.includes(type)
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
                          active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'
                        }`}
                        onClick={() =>
                          setTemplateDraft((current) => ({
                            ...current,
                            defaultTargetTypes: active
                              ? current.defaultTargetTypes.filter((item) => item !== type)
                              : [...current.defaultTargetTypes, type],
                          }))
                        }
                      >
                        {TARGET_TYPE_LABELS[type]}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={primaryButtonClassName} disabled={busyKey != null} onClick={handleSaveTemplate}>
                    {busyKey === 'createTemplate' || busyKey === 'updateTemplate' ? '저장 중...' : '템플릿 저장'}
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID || busyKey != null} onClick={handleDuplicateTemplate}>
                    템플릿 복사
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID || busyKey != null} onClick={handleDeleteTemplate}>
                    템플릿 삭제
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="문항 직접 관리" description="질문 추가, 수정, 삭제, 순서 변경, 활성/비활성을 직접 관리합니다.">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                {selectedTemplate?.questions.length ? (
                  selectedTemplate.questions.map((question, index) => (
                    <div key={question.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            {question.category || '리더십'} · {question.questionType}
                          </div>
                          <div className="text-base font-semibold text-slate-900">{question.questionText}</div>
                          {question.description ? <p className="text-sm text-slate-500">{question.description}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={() =>
                              setQuestionDraft({
                                templateId: selectedTemplate.id,
                                questionId: question.id,
                                category: question.category || '',
                                questionText: question.questionText,
                                description: question.description ?? '',
                                questionType: question.questionType,
                                scaleMin: question.scaleMin ?? 1,
                                scaleMax: question.scaleMax ?? 5,
                                isRequired: question.isRequired,
                                isActive: question.isActive,
                                choiceOptionsText: question.choiceOptions.join('\n'),
                              })
                            }
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={busyKey != null}
                            onClick={async () => {
                              const result = await runAdminAction('moveQuestion', {
                                templateId: selectedTemplate.id,
                                questionId: question.id,
                                direction: 'up',
                              })
                              if (!result) return
                              startTransition(() => router.refresh())
                            }}
                          >
                            위로
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={busyKey != null}
                            onClick={async () => {
                              const result = await runAdminAction('moveQuestion', {
                                templateId: selectedTemplate.id,
                                questionId: question.id,
                                direction: 'down',
                              })
                              if (!result) return
                              startTransition(() => router.refresh())
                            }}
                          >
                            아래로
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={busyKey != null}
                            onClick={async () => {
                              const result = await runAdminAction('deleteQuestion', { questionId: question.id })
                              if (!result) return
                              startTransition(() => router.refresh())
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">{question.isRequired ? '필수' : '선택'}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{question.isActive ? '활성' : '비활성'}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">순서 {index + 1}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                    선택한 템플릿에 등록된 문항이 없습니다.
                  </p>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <h4 className="text-base font-semibold text-slate-900">{questionDraft.questionId ? '문항 수정' : '문항 추가'}</h4>
                <input className={inputClassName} value={questionDraft.category} onChange={(event) => setQuestionDraft((current) => ({ ...current, category: event.target.value }))} placeholder="카테고리" />
                <input className={inputClassName} value={questionDraft.questionText} onChange={(event) => setQuestionDraft((current) => ({ ...current, questionText: event.target.value }))} placeholder="문항 내용" />
                <textarea className={textareaClassName} value={questionDraft.description} onChange={(event) => setQuestionDraft((current) => ({ ...current, description: event.target.value }))} placeholder="문항 설명/가이드" />
                <select className={inputClassName} value={questionDraft.questionType} onChange={(event) => setQuestionDraft((current) => ({ ...current, questionType: event.target.value as typeof current.questionType }))}>
                  <option value="RATING_SCALE">5점 척도형</option>
                  <option value="TEXT">서술형</option>
                  <option value="MULTIPLE_CHOICE">선택형</option>
                </select>
                {questionDraft.questionType === 'RATING_SCALE' ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <input className={inputClassName} type="number" min={1} max={5} value={questionDraft.scaleMin} onChange={(event) => setQuestionDraft((current) => ({ ...current, scaleMin: Number(event.target.value) }))} placeholder="최소 점수" />
                    <input className={inputClassName} type="number" min={1} max={10} value={questionDraft.scaleMax} onChange={(event) => setQuestionDraft((current) => ({ ...current, scaleMax: Number(event.target.value) }))} placeholder="최대 점수" />
                  </div>
                ) : null}
                {questionDraft.questionType === 'MULTIPLE_CHOICE' ? (
                  <textarea className={textareaClassName} value={questionDraft.choiceOptionsText} onChange={(event) => setQuestionDraft((current) => ({ ...current, choiceOptionsText: event.target.value }))} placeholder={'선택지를 한 줄에 하나씩 입력해 주세요.'} />
                ) : null}
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={questionDraft.isRequired} onChange={(event) => setQuestionDraft((current) => ({ ...current, isRequired: event.target.checked }))} />
                    필수 문항
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={questionDraft.isActive} onChange={(event) => setQuestionDraft((current) => ({ ...current, isActive: event.target.checked }))} />
                    활성 상태
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={primaryButtonClassName} disabled={!selectedTemplateId || selectedTemplateId === NEW_TEMPLATE_ID || busyKey != null} onClick={handleSaveQuestion}>
                    {busyKey === 'saveQuestion' ? '저장 중...' : questionDraft.questionId ? '문항 저장' : '문항 추가'}
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() =>
                      setQuestionDraft({
                        templateId: selectedTemplateId,
                        questionId: '',
                        category: '리더십',
                        questionText: '',
                        description: '',
                        questionType: 'RATING_SCALE',
                        scaleMin: 1,
                        scaleMax: 5,
                        isRequired: true,
                        isActive: true,
                        choiceOptionsText: '',
                      })
                    }
                  >
                    초기화
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="라운드 설정" description="평가 주기, 응답 기간, 익명 기준, 공개 정책과 템플릿 연결을 관리합니다.">
            <div className="grid gap-4 md:grid-cols-2">
              <select className={inputClassName} value={roundDraft.evalCycleId} onChange={(event) => setRoundDraft((current) => ({ ...current, evalCycleId: event.target.value }))}>
                {props.data.availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
              <select
                className={inputClassName}
                value={props.data.selectedRoundId ?? ''}
                onChange={(event) => router.push(`/evaluation/upward/admin?${updateSearch({ roundId: event.target.value || undefined })}`)}
              >
                <option value="">새 라운드</option>
                {props.data.availableRounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    {round.roundName} · {round.statusLabel}
                  </option>
                ))}
              </select>
              <input className={inputClassName} value={roundDraft.roundName} onChange={(event) => setRoundDraft((current) => ({ ...current, roundName: event.target.value }))} placeholder="상향 평가 라운드명" />
              <select className={inputClassName} value={roundDraft.templateId || selectedTemplateId} onChange={(event) => setRoundDraft((current) => ({ ...current, templateId: event.target.value }))}>
                <option value="">템플릿 선택</option>
                {adminData.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <input className={inputClassName} type="datetime-local" value={roundDraft.startDate} onChange={(event) => setRoundDraft((current) => ({ ...current, startDate: event.target.value }))} />
              <input className={inputClassName} type="datetime-local" value={roundDraft.endDate} onChange={(event) => setRoundDraft((current) => ({ ...current, endDate: event.target.value }))} />
              <input className={inputClassName} type="number" min={1} max={10} value={roundDraft.minRaters} onChange={(event) => setRoundDraft((current) => ({ ...current, minRaters: Number(event.target.value) }))} placeholder="익명 기준" />
              <select className={inputClassName} value={roundDraft.resultViewerMode} onChange={(event) => setRoundDraft((current) => ({ ...current, resultViewerMode: event.target.value as typeof current.resultViewerMode }))}>
                <option value="TARGET_ONLY">피평가자만</option>
                <option value="TARGET_AND_PRIMARY_MANAGER">피평가자 + 1차 리더</option>
              </select>
              <select className={inputClassName} value={roundDraft.rawResponsePolicy} onChange={(event) => setRoundDraft((current) => ({ ...current, rawResponsePolicy: event.target.value as typeof current.rawResponsePolicy }))}>
                <option value="ADMIN_ONLY">관리자만 raw 응답 열람</option>
                <option value="REVIEW_ADMIN_CONTENT">콘텐츠 열람 권한 운영자 허용</option>
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['TEAM_LEADER', 'SECTION_CHIEF', 'DIVISION_HEAD', 'PM', 'CUSTOM'].map((type) => {
                const active = roundDraft.targetTypes.includes(type)
                return (
                  <button
                    key={type}
                    type="button"
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
                      active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'
                    }`}
                    onClick={() =>
                      setRoundDraft((current) => ({
                        ...current,
                        targetTypes: active
                          ? current.targetTypes.filter((item) => item !== type)
                          : [...current.targetTypes, type],
                      }))
                    }
                  >
                    {TARGET_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={primaryButtonClassName} disabled={busyKey != null} onClick={handleRoundSave}>
                {busyKey === 'saveRound' ? '저장 중...' : roundDraft.roundId ? '라운드 저장' : '라운드 생성'}
              </button>
              {adminData.selectedRound ? (
                <>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('syncRoundQuestions', { roundId: adminData.selectedRound?.id }); if (!result) return; startTransition(() => router.refresh()) }}>
                    템플릿 문항 다시 적용
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('updateRoundStatus', { roundId: adminData.selectedRound?.id, action: adminData.selectedRound?.status === 'IN_PROGRESS' ? 'CLOSE' : 'START' }); if (!result) return; startTransition(() => router.refresh()) }}>
                    {adminData.selectedRound.status === 'IN_PROGRESS' ? '라운드 마감' : '라운드 시작'}
                  </button>
                  <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('setRelease', { roundId: adminData.selectedRound?.id, released: !adminData.selectedRound?.released }); if (!result) return; startTransition(() => router.refresh()) }}>
                    {adminData.selectedRound.released ? '결과 비공개 전환' : '결과 공개'}
                  </button>
                </>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="수동 매핑" description="평가자와 피평가자를 직접 연결하고, 상태와 미제출 현황을 관리합니다.">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <input className={inputClassName} value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)} placeholder="대상자/평가자 검색" />
                  <select className={inputClassName} value={assignmentStatusFilter} onChange={(event) => setAssignmentStatusFilter(event.target.value as typeof assignmentStatusFilter)}>
                    <option value="ALL">전체 상태</option>
                    <option value="PENDING">예정</option>
                    <option value="IN_PROGRESS">진행중</option>
                    <option value="SUBMITTED">제출완료</option>
                  </select>
                </div>
                <div className="space-y-3">
                  {filteredAssignments.map((assignment) => (
                    <div key={assignment.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">{assignment.evaluateeName}</span>
                            <span className="text-sm text-slate-500">{assignment.evaluateeDepartment}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{assignment.statusLabel}</span>
                          </div>
                          <p className="text-sm text-slate-600">
                            {assignment.evaluatorName} · {assignment.evaluatorDepartment} · {assignment.relationship}
                          </p>
                          {assignment.submittedAt ? <p className="text-xs text-slate-500">제출 {assignment.submittedAt}</p> : null}
                        </div>
                        <button type="button" className={secondaryButtonClassName} disabled={busyKey != null} onClick={async () => { const result = await runAdminAction('removeAssignment', { assignmentId: assignment.id }); if (!result) return; startTransition(() => router.refresh()) }}>
                          매핑 삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <h4 className="text-base font-semibold text-slate-900">매핑 추가</h4>
                <select className={inputClassName} value={assignmentDraft.evaluateeId} onChange={(event) => setAssignmentDraft((current) => ({ ...current, evaluateeId: event.target.value }))}>
                  <option value="">피평가자 선택</option>
                  {employeeDirectory.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.empName} · {employee.deptName} · {employee.position}
                    </option>
                  ))}
                </select>
                <select className={inputClassName} value={assignmentDraft.evaluatorId} onChange={(event) => setAssignmentDraft((current) => ({ ...current, evaluatorId: event.target.value }))}>
                  <option value="">평가자 선택</option>
                  {employeeDirectory.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.empName} · {employee.deptName} · {employee.position}
                    </option>
                  ))}
                </select>
                <select className={inputClassName} value={assignmentDraft.relationship} onChange={(event) => setAssignmentDraft((current) => ({ ...current, relationship: event.target.value as typeof current.relationship }))}>
                  <option value="SUBORDINATE">상향 평가</option>
                  <option value="PEER">동료 리더 평가</option>
                  <option value="CROSS_DEPT">교차 조직 평가</option>
                </select>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={primaryButtonClassName}
                    disabled={!adminData.selectedRound || busyKey != null}
                    onClick={async () => {
                      if (!adminData.selectedRound) return
                      const result = await runAdminAction('addAssignment', {
                        roundId: adminData.selectedRound.id,
                        evaluatorId: assignmentDraft.evaluatorId,
                        evaluateeId: assignmentDraft.evaluateeId,
                        relationship: assignmentDraft.relationship,
                      })
                      if (!result) return
                      startTransition(() => router.refresh())
                    }}
                  >
                    수동 매핑 추가
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={!adminData.selectedRound || !assignmentDraft.evaluateeId || busyKey != null}
                    onClick={async () => {
                      if (!adminData.selectedRound) return
                      const result = await runAdminAction('addSuggestedAssignments', {
                        roundId: adminData.selectedRound.id,
                        evaluateeId: assignmentDraft.evaluateeId,
                      })
                      if (!result) return
                      startTransition(() => router.refresh())
                    }}
                  >
                    조직도 추천 추가
                  </button>
                </div>
                <div className="border-t border-slate-200 pt-4">
                  <h5 className="font-semibold text-slate-900">추천 미리보기</h5>
                  <div className="mt-3 space-y-2">
                    {adminData.suggestions.slice(0, 6).map((suggestion) => (
                      <div key={`${suggestion.evaluatorId}:${suggestion.evaluateeId}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <div className="font-medium text-slate-900">
                          {suggestion.evaluateeName} ← {suggestion.evaluatorName}
                        </div>
                        <div className="mt-1">{suggestion.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
