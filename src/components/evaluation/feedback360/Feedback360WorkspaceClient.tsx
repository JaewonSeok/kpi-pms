'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2, Download, ExternalLink, Info, Sparkles, Users } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import { FEEDBACK_RESULT_PROFILE_LABELS } from '@/lib/feedback-result-presentation'
import { MultiRaterCycleHeader } from './MultiRaterCycleHeader'
import { ResponseRateCard } from './ResponseRateCard'
import { ReviewerNominationPanel } from './ReviewerNominationPanel'
import { FeedbackThemesSection } from './FeedbackThemesSection'
import { DevelopmentPlanPreview } from './DevelopmentPlanPreview'
import { Feedback360AdminPanel } from './Feedback360AdminPanel'
import { FeedbackReferencePanel } from './FeedbackReferencePanel'
import { FeedbackReportAnalysisView } from './FeedbackReportAnalysisView'
import { FeedbackRespondReferencePanel } from './FeedbackRespondReferencePanel'

type RespondData = NonNullable<Feedback360PageData['respond']>
type RespondRatingGuide = NonNullable<RespondData['ratingGuide']>
type RespondPriorScoreSummary = NonNullable<RespondData['priorScoreSummary']>

const DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE =
  '등급 배분 가이드의 제한 인원을 초과했습니다. 가이드를 확인해 주세요.'

function buildRespondQuestionState(
  questions: RespondData['questions'] | undefined
) {
  return Object.fromEntries(
    (questions ?? []).map((question) => [
      question.id,
      {
        ratingValue: question.ratingValue ?? null,
        textValue: question.textValue ?? null,
      },
    ])
  )
}

export function Feedback360WorkspaceClient(props: { data: Feedback360PageData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [submitBusy, setSubmitBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [respondNotice, setRespondNotice] = useState('')
  const [respondError, setRespondError] = useState('')
  const [resultsNotice, setResultsNotice] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [recordedResultViewKey, setRecordedResultViewKey] = useState('')
  const respondData = props.data.mode === 'respond' ? props.data.respond : undefined
  const respondFeedbackId = respondData?.feedbackId ?? ''
  const respondOverallComment = respondData?.overallComment ?? ''
  const respondQuestions = respondData?.questions
  const [overallComment, setOverallComment] = useState(respondOverallComment)
  const [questionState, setQuestionState] = useState<Record<string, { ratingValue?: number | null; textValue?: string | null }>>(
    buildRespondQuestionState(respondQuestions)
  )

  useEffect(() => {
    setResultsNotice('')
    setResultsError('')
    setRespondNotice('')
    setRespondError('')
  }, [props.data.mode, props.data.selectedCycleId, props.data.selectedRoundId])

  useEffect(() => {
    setOverallComment(respondOverallComment)
    setQuestionState(buildRespondQuestionState(respondQuestions))
  }, [respondFeedbackId, respondOverallComment, respondQuestions])

  const respondRatingGuide = respondData?.ratingGuide
  const selectedDistributionValue =
    respondRatingGuide?.questionId != null
      ? (questionState[respondRatingGuide.questionId]?.ratingValue ?? null)
      : null
  const respondRatingGuideEntries = useMemo(() => {
    if (!respondRatingGuide) return []

    return respondRatingGuide.scaleEntries.map((entry) => ({
      ...entry,
      displayCurrentCount: entry.currentCount + (selectedDistributionValue === entry.value ? 1 : 0),
    }))
  }, [respondRatingGuide, selectedDistributionValue])
  const selectedDistributionEntry = useMemo(() => {
    if (selectedDistributionValue == null) return null
    return respondRatingGuideEntries.find((entry) => entry.value === selectedDistributionValue) ?? null
  }, [respondRatingGuideEntries, selectedDistributionValue])
  const distributionLimitExceeded = Boolean(
    respondRatingGuide?.distributionMode === 'HEADCOUNT' &&
      selectedDistributionEntry &&
      !selectedDistributionEntry.isNonEvaluative &&
      selectedDistributionEntry.headcountLimit != null &&
      selectedDistributionEntry.displayCurrentCount > selectedDistributionEntry.headcountLimit
  )

  useEffect(() => {
    if (!distributionLimitExceeded && respondError === DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE) {
      setRespondError('')
    }
  }, [distributionLimitExceeded, respondError])

  const resultTargetId = props.data.mode === 'results' ? props.data.results?.targetEmployee.id ?? '' : ''
  const resultViewContextKey =
    resultTargetId && props.data.selectedRoundId
      ? `${props.data.selectedRoundId}:${resultTargetId}`
      : ''

  useEffect(() => {
    if (!resultViewContextKey || recordedResultViewKey === resultViewContextKey) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(
          `/api/feedback/rounds/${encodeURIComponent(props.data.selectedRoundId!)}/result-view`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetId: resultTargetId,
            }),
          }
        )

        if (!response.ok) {
          return
        }

        if (!cancelled) {
          setRecordedResultViewKey(resultViewContextKey)
        }
      } catch {
        // Result view receipt failures should not block the live results flow.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    recordedResultViewKey,
    resultTargetId,
    resultViewContextKey,
    props.data.selectedRoundId,
  ])

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

  const resultPresentationHighlights = useMemo(() => {
    if (!props.data.results) return []

    return [
      props.data.results.presentationSettings.showLeaderComment ? '팀장 평가 코멘트 공개' : '팀장 평가 코멘트 비공개',
      props.data.results.presentationSettings.showLeaderScore ? '팀장 평가 등급 공개' : '팀장 평가 등급 비공개',
      props.data.results.presentationSettings.showExecutiveComment ? '상위 평가 코멘트 공개' : '상위 평가 코멘트 비공개',
      props.data.results.presentationSettings.showExecutiveScore ? '상위 평가 등급 공개' : '상위 평가 등급 비공개',
      props.data.results.presentationSettings.showFinalScore ? '최종 결과 등급 공개' : '최종 결과 등급 비공개',
      props.data.results.presentationSettings.showFinalComment ? '최종 결과 코멘트 공개' : '최종 결과 코멘트 비공개',
    ]
  }, [props.data.results])

  function buildResultVersionHref(version: NonNullable<Feedback360PageData['results']>['recipientProfile']) {
    const search = new URLSearchParams()
    if (props.data.selectedCycleId) search.set('cycleId', props.data.selectedCycleId)
    if (props.data.selectedRoundId) search.set('roundId', props.data.selectedRoundId)
    if (props.data.results?.targetEmployee.id) search.set('empId', props.data.results.targetEmployee.id)
    search.set('version', version)
    return `/evaluation/360/results?${search.toString()}`
  }

  async function handleSubmitResponse() {
    if (!respondData) return

    if (distributionLimitExceeded) {
      setRespondNotice('')
      setRespondError(DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE)
      return
    }

    setSubmitBusy(true)
    setRespondNotice('')
    setRespondError('')

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: respondData.roundId,
          receiverId: respondData.receiverId,
          relationship: respondData.relationship,
          overallComment,
          responses: respondData.questions.map((question) => ({
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
          <Panel
            title="결과지 버전 / 공유 구성"
            description={`${props.data.results.roundName} 결과를 현재 수신자 기준으로 구성해 보여줍니다.`}
          >
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <StatCard
                      label="현재 결과지"
                      value={FEEDBACK_RESULT_PROFILE_LABELS[props.data.results.recipientProfile]}
                    />
                    <StatCard label="대상자" value={props.data.results.targetEmployee.name} />
                    <StatCard label="최종 반영 가중치" value={`${props.data.results.roundWeight}%`} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {props.data.results.availableProfiles.map((profile) => {
                      const active = profile.value === props.data.results!.recipientProfile
                      return (
                        <Link
                          key={profile.value}
                          href={buildResultVersionHref(profile.value)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {profile.label}
                        </Link>
                      )
                    })}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {props.data.results.summaryCards.length ? (
                      props.data.results.summaryCards.map((card) => (
                        <div key={card.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {card.relationshipLabel}
                          </div>
                          <div className="mt-2 text-base font-semibold text-slate-900">{card.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{card.reviewerName ?? '평가자 정보 없음'}</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div>
                              총점:{' '}
                              <span className="font-semibold text-slate-900">
                                {card.showScore && typeof card.totalScore === 'number'
                                  ? `${card.totalScore.toFixed(1)}점`
                                  : '비공개'}
                              </span>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 text-sm leading-6 text-slate-600">
                              {card.showComment
                                ? card.comment?.trim() || '등록된 코멘트가 없습니다.'
                                : '비공개 설정으로 코멘트를 표시하지 않습니다.'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyBlock message="현재 결과지 버전에서 공개되는 요약 카드가 없습니다." />
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">공개 항목 요약</div>
                  <div className="space-y-2">
                    {resultPresentationHighlights.map((item) => (
                      <div key={item} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2 pt-2">
                    <a
                      href={props.data.results.pdfHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      PDF 열기
                    </a>
                    <a
                      href={`${props.data.results.pdfHref}&download=1`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4" />
                      PDF 다운로드
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <FeedbackReportAnalysisView
            key={`${props.data.selectedRoundId ?? 'round'}:${props.data.results.targetEmployee.id}:${props.data.results.recipientProfile}`}
            results={props.data.results}
          />

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

      {props.data.mode === 'respond' && respondData ? (
        <div className="space-y-6">
          <Panel
            title="다면평가 응답 작성"
            description={`${respondData.receiverName}에 대한 ${respondData.relationship} 관점 피드백입니다.`}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="라운드" value={respondData.roundName} />
              <StatCard label="문항 수" value={String(respondData.questionCount)} />
              <StatCard label="현재 응답 수" value={String(respondData.answeredCount)} />
              <StatCard label="상태" value={respondData.status} />
            </div>

            <div className="mt-5 space-y-2">
              {respondData.instructions.map((item) => (
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

            <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-5">
                {respondData.priorScoreSummary || respondData.ratingGuide ? (
                  <RespondReferenceSummary
                    targetProfile={respondData.targetProfile}
                    priorScoreSummary={respondData.priorScoreSummary}
                  />
                ) : null}

                <div className="space-y-4">
                  {respondData.questions.map((question) => (
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

                      {respondData.ratingGuide?.questionId === question.id ? (
                        <RespondRatingGuideCard
                          ratingGuide={respondData.ratingGuide}
                          priorScoreSummary={respondData.priorScoreSummary}
                          targetProfile={respondData.targetProfile}
                          scaleEntries={respondRatingGuideEntries}
                          limitExceeded={distributionLimitExceeded}
                        />
                      ) : null}

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

                <label className="block">
                  <span className="text-sm font-semibold text-slate-900">종합 코멘트</span>
                  <textarea
                    value={overallComment}
                    onChange={(event) => setOverallComment(event.target.value)}
                    className="mt-3 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400"
                    placeholder="강점, 개선 포인트, 협업 관찰을 종합해서 작성해 주세요."
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitResponse}
                    disabled={submitBusy || distributionLimitExceeded}
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
              </div>

              <FeedbackRespondReferencePanel
                key={`${respondData.feedbackId}:${props.data.selectedRoundId ?? ''}`}
                reference={respondData.reference}
              />
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

function RespondReferenceSummary(props: {
  targetProfile: RespondData['targetProfile']
  priorScoreSummary?: RespondPriorScoreSummary
}) {
  const profileItems = [
    props.targetProfile.departmentName,
    props.targetProfile.role,
    props.targetProfile.position,
    props.targetProfile.jobTitle,
    props.targetProfile.teamName,
  ].filter(Boolean)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Info className="h-4 w-4 text-blue-500" />
          대상자 인사 정보
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {profileItems.length ? (
            profileItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                {item}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">등급 가이드를 매칭할 인사 정보가 아직 없습니다.</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-amber-500" />
          이전 차수 종합 점수 참고
        </div>
        {props.priorScoreSummary ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {props.priorScoreSummary.authorLabel}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  {props.priorScoreSummary.totalScore.toFixed(1)}점
                </div>
              </div>
              {props.priorScoreSummary.submittedAt ? (
                <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  {props.priorScoreSummary.submittedAt}
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              앞선 차수 또는 선행 평가자의 종합 점수를 참고해 현재 등급과 코멘트를 더 일관되게 작성할 수 있습니다.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            현재 라운드에서 참고할 이전 종합 점수가 아직 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}

function RespondRatingGuideCard(props: {
  ratingGuide: RespondRatingGuide
  priorScoreSummary?: RespondPriorScoreSummary
  targetProfile: RespondData['targetProfile']
  scaleEntries: Array<RespondRatingGuide['scaleEntries'][number] & { displayCurrentCount: number }>
  limitExceeded: boolean
}) {
  const profileSummary =
    props.ratingGuide.targetProfileLabel ||
    [
      props.targetProfile.departmentName,
      props.targetProfile.position,
      props.targetProfile.jobTitle,
      props.targetProfile.teamName,
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-amber-500" />
            등급 가이드
          </div>
          <p className="mt-1 text-sm text-slate-500">{props.ratingGuide.distributionModeDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GuideBadge tone="blue">{props.ratingGuide.distributionModeLabel}</GuideBadge>
          <GuideBadge tone="slate">{props.ratingGuide.distributionScopeLabel}</GuideBadge>
        </div>
      </div>

      {props.ratingGuide.matchedRule ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">{props.ratingGuide.matchedRule.headline}</div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-amber-900/90">
            {props.ratingGuide.matchedRule.guidance}
          </p>
          <div className="mt-3 text-xs font-medium text-amber-700">
            적용 가이드: {props.ratingGuide.matchedRule.label}
            {profileSummary ? ` · ${profileSummary}` : ''}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          대상자의 조직/역할 정보에 맞는 별도 가이드가 없어서 기본 등급 설명을 보여드립니다.
        </div>
      )}

      {props.priorScoreSummary ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">앞선 차수 종합 점수</div>
          <div className="mt-2 text-sm font-semibold text-slate-900">
            {props.priorScoreSummary.authorLabel} · {props.priorScoreSummary.totalScore.toFixed(1)}점
          </div>
        </div>
      ) : null}

      {props.limitExceeded ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            등급 배분 가이드의 제한 인원을 초과했습니다. 가이드를 확인해 주세요.
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">등급명</th>
              {props.ratingGuide.distributionMode === 'RATIO' ? (
                <th className="px-4 py-3 text-left font-semibold">배분 비율</th>
              ) : null}
              {props.ratingGuide.distributionMode === 'RATIO' ? (
                <th className="px-4 py-3 text-left font-semibold">권장 인원</th>
              ) : null}
              {props.ratingGuide.distributionMode === 'HEADCOUNT' ? (
                <th className="px-4 py-3 text-left font-semibold">제한 인원</th>
              ) : null}
              <th className="px-4 py-3 text-left font-semibold">현재 인원</th>
            </tr>
          </thead>
          <tbody>
            {props.scaleEntries.map((entry) => {
              const exceedsLimit =
                props.ratingGuide.distributionMode === 'HEADCOUNT' &&
                entry.headcountLimit != null &&
                !entry.isNonEvaluative &&
                entry.displayCurrentCount > entry.headcountLimit

              return (
                <tr key={entry.value} className="border-t border-slate-200">
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{entry.label}</span>
                      {entry.isHighest ? <GuideBadge tone="emerald">가장 높은 등급</GuideBadge> : null}
                      {entry.isLowest ? <GuideBadge tone="blue">가장 낮은 등급</GuideBadge> : null}
                      {entry.isNonEvaluative ? <GuideBadge tone="slate">비평가 등급</GuideBadge> : null}
                    </div>
                    {entry.description ? (
                      <div className="mt-2 whitespace-pre-line text-xs leading-5 text-slate-500">
                        {entry.description}
                      </div>
                    ) : null}
                  </td>
                  {props.ratingGuide.distributionMode === 'RATIO' ? (
                    <td className="px-4 py-3 text-slate-700">
                      {entry.targetRatio != null ? `${entry.targetRatio}%` : '-'}
                    </td>
                  ) : null}
                  {props.ratingGuide.distributionMode === 'RATIO' ? (
                    <td className="px-4 py-3 text-slate-700">
                      {entry.recommendedCount != null ? `${entry.recommendedCount}명` : '-'}
                    </td>
                  ) : null}
                  {props.ratingGuide.distributionMode === 'HEADCOUNT' ? (
                    <td className="px-4 py-3 text-slate-700">
                      {entry.isNonEvaluative ? '-' : entry.headcountLimit != null ? `${entry.headcountLimit}명` : '-'}
                    </td>
                  ) : null}
                  <td className={`px-4 py-3 font-semibold ${exceedsLimit ? 'text-rose-600' : 'text-slate-700'}`}>
                    {entry.displayCurrentCount}명
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GuideBadge(props: { children: React.ReactNode; tone: 'slate' | 'blue' | 'emerald' }) {
  const toneClassName =
    props.tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : props.tone === 'blue'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-100 text-slate-700'

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClassName}`}>
      {props.children}
    </span>
  )
}
