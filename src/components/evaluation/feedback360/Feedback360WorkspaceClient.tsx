'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Users } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import { MultiRaterCycleHeader } from './MultiRaterCycleHeader'
import { ResponseRateCard } from './ResponseRateCard'
import { ReviewerNominationPanel } from './ReviewerNominationPanel'
import { FeedbackThemesSection } from './FeedbackThemesSection'
import { DevelopmentPlanPreview } from './DevelopmentPlanPreview'
import { Feedback360AdminPanel } from './Feedback360AdminPanel'
import { FeedbackReferencePanel } from './FeedbackReferencePanel'

export function Feedback360WorkspaceClient(props: { data: Feedback360PageData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [submitBusy, setSubmitBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [respondNotice, setRespondNotice] = useState('')
  const [respondError, setRespondError] = useState('')
  const [resultsNotice, setResultsNotice] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [overallComment, setOverallComment] = useState(props.data.respond?.overallComment ?? '')
  const [questionState, setQuestionState] = useState<Record<string, { ratingValue?: number | null; textValue?: string | null }>>(
    Object.fromEntries(
      (props.data.respond?.questions ?? []).map((question) => [
        question.id,
        {
          ratingValue: question.ratingValue ?? null,
          textValue: question.textValue ?? null,
        },
      ])
    )
  )

  useEffect(() => {
    setResultsNotice('')
    setResultsError('')
    setRespondNotice('')
    setRespondError('')
  }, [props.data.mode, props.data.selectedCycleId, props.data.selectedRoundId])

  const resultsAiPayload = useMemo(() => {
    if (!props.data.results) return null
    return {
      targetEmployee: props.data.results.targetEmployee,
      anonymityThreshold: props.data.results.anonymityThreshold,
      feedbackCount: props.data.results.feedbackCount,
      categoryScores: props.data.results.categoryScores,
      textHighlights: props.data.results.textHighlights,
      strengths: props.data.results.strengths,
      improvements: props.data.results.improvements,
    }
  }, [props.data.results])

  async function handleGenerateReportCache() {
    if (!props.data.results || !props.data.selectedRoundId) return
    setReportBusy(true)
    setResultsNotice('')
    setResultsError('')

    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(props.data.selectedRoundId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: props.data.results.targetEmployee.id,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '360 리포트 캐시 생성에 실패했습니다.')
      }

      setResultsNotice(json.data?.message ?? '360 리포트 캐시를 생성했습니다.')
      startTransition(() => router.refresh())
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : '360 리포트 캐시 생성에 실패했습니다.')
    } finally {
      setReportBusy(false)
    }
  }

  const developmentAiPayload = useMemo(() => {
    if (!props.data.results) return null
    return {
      targetEmployee: props.data.results.targetEmployee,
      strengths: props.data.results.strengths,
      improvements: props.data.results.improvements,
      anonymousSummary: props.data.results.anonymousSummary,
      categoryScores: props.data.results.categoryScores,
    }
  }, [props.data.results])

  async function handleSubmitResponse() {
    if (!props.data.respond) return
    setSubmitBusy(true)
    setRespondNotice('')
    setRespondError('')

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: props.data.respond.roundId,
          receiverId: props.data.respond.receiverId,
          relationship: props.data.respond.relationship,
          overallComment,
          responses: props.data.respond.questions.map((question) => ({
            questionId: question.id,
            ratingValue: questionState[question.id]?.ratingValue ?? undefined,
            textValue: questionState[question.id]?.textValue ?? undefined,
          })),
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '다면평가 응답 제출에 실패했습니다.')
      }
      setRespondNotice('다면평가 응답을 제출했습니다.')
      startTransition(() => router.refresh())
    } catch (error) {
      setRespondError(error instanceof Error ? error.message : '다면평가 응답 제출에 실패했습니다.')
    } finally {
      setSubmitBusy(false)
    }
  }

  function updateQuestion(
    questionId: string,
    nextValue: Partial<{ ratingValue?: number | null; textValue?: string | null }>
  ) {
    setQuestionState((current) => ({
      ...current,
      [questionId]: {
        ...current[questionId],
        ...nextValue,
      },
    }))
  }

  if (props.data.state !== 'ready') {
    return (
      <div className="space-y-6">
        <MultiRaterCycleHeader data={props.data} />
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Users className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            {props.data.state === 'permission-denied'
              ? '이 화면을 볼 권한이 없습니다.'
              : props.data.state === 'empty'
                ? '아직 360 다면평가 라운드가 없습니다.'
                : '360 다면평가 데이터를 불러오지 못했습니다.'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{props.data.message ?? '평가 주기와 접근 권한을 확인해 주세요.'}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ActionLink href="/evaluation/workbench" label="평가 워크벤치" />
            <ActionLink href="/evaluation/results" label="평가 결과" />
            <ActionLink href="/checkin" label="체크인 일정" />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MultiRaterCycleHeader data={props.data} />

      {props.data.mode === 'overview' ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ResponseRateCard
              title="평균 응답률"
              responseRate={props.data.summary.averageResponseRate}
              submittedCount={props.data.summary.submittedResponses}
              pendingCount={props.data.summary.pendingResponses}
              description="내가 참여 중인 라운드 기준"
            />
            {props.data.availableRounds.slice(0, 3).map((round) => (
              <ResponseRateCard
                key={round.id}
                title={round.roundName}
                responseRate={round.responseRate}
                submittedCount={round.submittedCount}
                pendingCount={Math.max(round.targetCount - round.submittedCount, 0)}
                thresholdMet={round.submittedCount >= round.minRaters}
                description={`${round.roundType} · 익명 기준 ${round.minRaters}명`}
              />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Panel
              title="내 응답 요청"
              description="내가 리뷰어로 지정된 다면평가 요청입니다. 각 요청에서 바로 응답 화면으로 이동할 수 있습니다."
            >
              <div className="space-y-3">
                {props.data.pendingRequests?.length ? (
                  props.data.pendingRequests.map((request) => (
                    <div key={request.feedbackId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{request.receiverName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {request.roundName} · {request.relationship} · 마감 {request.dueDate}
                          </div>
                        </div>
                        <Link
                          href={request.href}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          응답 작성
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyBlock message="현재 내가 응답해야 하는 360 요청이 없습니다." />
                )}
              </div>
            </Panel>

            <Panel
              title="바로 가기"
              description="다면평가를 평가/성장/운영 흐름에 연결하는 핵심 진입점입니다."
            >
              <div className="space-y-3">
                <ActionLink href={`/evaluation/360/nomination?cycleId=${encodeURIComponent(props.data.selectedCycleId ?? '')}${props.data.selectedRoundId ? `&roundId=${encodeURIComponent(props.data.selectedRoundId)}` : ''}`} label="리뷰어 nomination" />
                <ActionLink href={`/evaluation/360/results?cycleId=${encodeURIComponent(props.data.selectedCycleId ?? '')}${props.data.selectedRoundId ? `&roundId=${encodeURIComponent(props.data.selectedRoundId)}` : ''}`} label="익명 테마 결과" />
                {props.data.permissions?.canViewAdmin ? (
                  <ActionLink href={`/evaluation/360/admin?cycleId=${encodeURIComponent(props.data.selectedCycleId ?? '')}${props.data.selectedRoundId ? `&roundId=${encodeURIComponent(props.data.selectedRoundId)}` : ''}`} label="운영 관리" />
                ) : null}
                <ActionLink href="/evaluation/workbench" label="평가 워크벤치 연결" />
              </div>
            </Panel>
          </section>

          <Panel
            title="현재 라운드 현황"
            description="라운드별 응답률과 익명 기준 충족 여부를 한 눈에 볼 수 있습니다."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {props.data.availableRounds.map((round) => (
                <ResponseRateCard
                  key={round.id}
                  title={round.roundName}
                  responseRate={round.responseRate}
                  submittedCount={round.submittedCount}
                  pendingCount={Math.max(round.targetCount - round.submittedCount, 0)}
                  thresholdMet={round.submittedCount >= round.minRaters}
                  description={`${round.startDate} ~ ${round.endDate}`}
                />
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {props.data.mode === 'nomination' && props.data.nomination && props.data.selectedRoundId ? (
        <ReviewerNominationPanel roundId={props.data.selectedRoundId} nomination={props.data.nomination} />
      ) : null}

      {props.data.mode === 'results' && props.data.results ? (
        <div className="space-y-6">
          <FeedbackThemesSection
            threshold={props.data.results.anonymityThreshold}
            feedbackCount={props.data.results.feedbackCount}
            thresholdMet={props.data.results.thresholdMet}
            anonymousSummary={props.data.results.anonymousSummary}
            strengths={props.data.results.strengths}
            improvements={props.data.results.improvements}
            textHighlights={props.data.results.textHighlights}
            aiPayload={resultsAiPayload ?? undefined}
          />

          <Panel
            title="리포트 캐시 / 저장 상태"
            description="리더나 운영자가 현재 집계 결과를 캐시로 저장하고, 개발 계획을 후속 체크인과 연결할 수 있습니다."
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2 text-sm text-slate-600">
                <div>
                  리포트 캐시: {props.data.results.reportCache ? `생성됨 · ${props.data.results.reportCache.generatedAt}` : '아직 생성되지 않음'}
                </div>
                <div>
                  개발 계획: {props.data.results.developmentPlanRecord ? `${props.data.results.developmentPlanRecord.title} · ${props.data.results.developmentPlanRecord.status}` : '아직 저장되지 않음'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateReportCache}
                disabled={reportBusy || !props.data.selectedRoundId}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {reportBusy ? '리포트 캐시 생성 중..' : props.data.results.reportCache ? '리포트 캐시 재생성' : '리포트 캐시 생성'}
              </button>
            </div>
            {resultsNotice ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {resultsNotice}
              </div>
            ) : null}
            {resultsError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {resultsError}
              </div>
            ) : null}
          </Panel>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="카테고리별 응답 분포"
              description="성과/협업/리더십 등 영역별 평균 점수와 응답 수를 함께 봅니다."
            >
              <div className="space-y-3">
                {props.data.results.categoryScores.length ? (
                  props.data.results.categoryScores.map((item) => (
                    <div key={item.category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{item.category}</div>
                        <div className="text-sm font-medium text-slate-700">
                          평균 {item.average} / 응답 {item.count}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyBlock message="익명 기준을 충족하면 카테고리별 응답 분포가 표시됩니다." />
                )}
              </div>
            </Panel>

            <Panel
              title="결과 연계"
              description="360 결과를 평가, 이의 신청, 체크인, 성장 계획 흐름과 연결합니다."
            >
              <div className="space-y-3">
                {props.data.results.linkage.map((item) => (
                  <div key={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    >
                      이동
                    </Link>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <FeedbackReferencePanel
            groupedResponses={props.data.results.groupedResponses}
            warnings={props.data.results.warnings}
          />

          <DevelopmentPlanPreview
            employeeId={props.data.results.targetEmployee.id}
            sourceId={`${props.data.selectedRoundId ?? 'unknown'}:${props.data.results.targetEmployee.id}`}
            focusArea={props.data.results.developmentPlan.focusArea}
            actions={props.data.results.developmentPlan.actions}
            managerSupport={props.data.results.developmentPlan.managerSupport}
            nextCheckinTopics={props.data.results.developmentPlan.nextCheckinTopics}
            existingPlan={props.data.results.developmentPlanRecord}
            aiPayload={developmentAiPayload ?? undefined}
          />
        </div>
      ) : null}

      {props.data.mode === 'admin' ? (
        <Feedback360AdminPanel data={props.data} />
      ) : null}

      {props.data.mode === 'respond' && props.data.respond ? (
        <div className="space-y-6">
          <Panel
            title="다면평가 응답 작성"
            description={`${props.data.respond.receiverName}에 대한 ${props.data.respond.relationship} 관점 피드백입니다.`}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="라운드" value={props.data.respond.roundName} />
              <StatCard label="문항 수" value={String(props.data.respond.questionCount)} />
              <StatCard label="현재 응답 수" value={String(props.data.respond.answeredCount)} />
              <StatCard label="상태" value={props.data.respond.status} />
            </div>

            <div className="mt-5 space-y-2">
              {props.data.respond.instructions.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {item}
                </div>
              ))}
            </div>

            {respondNotice ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {respondNotice}
              </div>
            ) : null}
            {respondError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {respondError}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {props.data.respond.questions.map((question) => (
                <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {question.category}
                    </span>
                    {question.isRequired ? (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                        필수
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">{question.questionText}</div>

                  {question.questionType === 'RATING_SCALE' ? (
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {Array.from(
                        {
                          length:
                            (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1,
                        },
                        (_, index) => (question.scaleMin ?? 1) + index
                      ).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateQuestion(question.id, { ratingValue: value })}
                          className={`min-h-11 rounded-xl border text-sm font-semibold transition ${
                            questionState[question.id]?.ratingValue === value
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={questionState[question.id]?.textValue ?? ''}
                      onChange={(event) => updateQuestion(question.id, { textValue: event.target.value })}
                      className="mt-4 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                      placeholder="구체적인 행동 사례와 관찰 근거를 중심으로 작성해 주세요."
                    />
                  )}
                </div>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-900">종합 코멘트</span>
              <textarea
                value={overallComment}
                onChange={(event) => setOverallComment(event.target.value)}
                className="mt-3 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                placeholder="강점, 개선 포인트, 협업 관찰을 종합해서 작성해 주세요."
              />
            </label>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSubmitResponse}
                disabled={submitBusy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitBusy ? '응답 제출 중...' : '응답 제출'}
              </button>
              <Link
                href="/evaluation/360"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                360 개요로 돌아가기
              </Link>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  )
}

function Panel(props: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{props.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{props.description}</p>
      </div>
      {props.children}
    </section>
  )
}

function ActionLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {props.label}
    </Link>
  )
}

function EmptyBlock(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {props.message}
    </div>
  )
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}
