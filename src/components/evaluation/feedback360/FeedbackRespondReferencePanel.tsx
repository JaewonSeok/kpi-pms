'use client'

import { useState } from 'react'
import type { Feedback360PageData } from '@/server/feedback-360'

type RespondReference = NonNullable<NonNullable<Feedback360PageData['respond']>['reference']>

type FeedbackRespondReferencePanelProps = {
  reference: RespondReference
}

type ReferenceTab = 'goals' | 'reviews' | 'scores'

export function FeedbackRespondReferencePanel(props: FeedbackRespondReferencePanelProps) {
  const [activeTab, setActiveTab] = useState<ReferenceTab>('goals')
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null)

  const totalScoreSummary = props.reference.totalScoreEnabled
    ? `${props.reference.priorScores.length}건`
    : '미사용'

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">참고 정보</h2>
        <p className="mt-1 text-sm text-slate-500">
          연결 목표, 이전 차수 리뷰, 종합 점수를 같은 문맥에서 확인하며 평가 근거를 정리합니다.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <TabButton
          active={activeTab === 'goals'}
          label={`목표 ${props.reference.goals.length}`}
          onClick={() => setActiveTab('goals')}
        />
        <TabButton
          active={activeTab === 'reviews'}
          label={`리뷰 ${props.reference.groupedResponses.length}`}
          onClick={() => setActiveTab('reviews')}
        />
        <TabButton
          active={activeTab === 'scores'}
          label={`종합 점수 ${totalScoreSummary}`}
          onClick={() => setActiveTab('scores')}
        />
      </div>

      {props.reference.warnings.length ? (
        <div className="mb-4 space-y-2">
          {props.reference.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === 'goals' ? (
        <div className="space-y-3">
          {props.reference.goals.length ? (
            props.reference.goals.map((goal) => {
              const expanded = expandedGoalId === goal.id

              return (
                <div key={goal.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{goal.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {goal.linkedGoalLabel ?? '연결된 상위 목표 없음'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedGoalId(expanded ? null : goal.id)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {expanded ? '접기' : '상세 보기'}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <MetaChip label={goal.progressLabel} tone="blue" />
                    <MetaChip label={goal.approvalStatusLabel} tone="emerald" />
                    <MetaChip label={goal.weightLabel} tone="slate" />
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">기간</div>
                    <div className="mt-1">{goal.periodLabel}</div>
                  </div>

                  {expanded ? (
                    <div className="mt-3 space-y-3">
                      <InfoBlock
                        label="목표 연결"
                        body={
                          goal.hierarchy.length
                            ? goal.hierarchy.join(' → ')
                            : '상·하위 연결 정보가 아직 없습니다.'
                        }
                      />
                      <InfoBlock
                        label="협업한 동료"
                        body={
                          goal.collaborators.length
                            ? goal.collaborators.join(', ')
                            : '협업한 동료 정보가 아직 없습니다.'
                        }
                      />
                      <InfoBlock
                        label="주요 성과 기술"
                        body={goal.achievementSummary?.trim() || '주요 성과 기술이 아직 없습니다.'}
                      />
                      <InfoBlock
                        label="체크인 기록"
                        body={
                          goal.checkinNotes.length
                            ? goal.checkinNotes.join('\n')
                            : '연결된 체크인 기록이 아직 없습니다.'
                        }
                        preserveWhitespace
                      />
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-medium text-slate-900">관련 링크</div>
                        <div className="mt-2 space-y-2">
                          {goal.links.length ? (
                            goal.links.map((link) => (
                              <a
                                key={link.id}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="block rounded-xl border border-slate-200 px-3 py-2 text-sm text-blue-700 transition hover:bg-slate-50"
                              >
                                <span className="font-medium">{link.label}</span>
                                <span className="mt-1 block text-xs text-slate-500">{link.href}</span>
                              </a>
                            ))
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                              연결된 링크가 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })
          ) : (
            <EmptyBlock message="현재 평가 대상자에게 연결된 목표 정보가 없습니다." />
          )}
        </div>
      ) : null}

      {activeTab === 'reviews' ? (
        <div className="space-y-3">
          {props.reference.groupedResponses.length ? (
            props.reference.groupedResponses.map((group) => (
              <div key={group.questionId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {group.category}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{group.questionText}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {group.answers.map((answer, index) => (
                    <div key={`${answer.feedbackId}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">
                          {answer.authorLabel}
                        </span>
                        {typeof answer.ratingValue === 'number' ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                            점수 {answer.ratingValue}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {answer.textValue?.trim() || '텍스트 응답이 없는 문항입니다.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyBlock message="비교할 이전 리뷰 참고 정보가 아직 없습니다." />
          )}
        </div>
      ) : null}

      {activeTab === 'scores' ? (
        <div className="space-y-3">
          {props.reference.totalScoreEnabled ? (
            props.reference.priorScores.length ? (
              props.reference.priorScores.map((score) => (
                <div key={score.feedbackId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{score.authorLabel}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {score.submittedAt ? `제출 ${score.submittedAt}` : '제출 시각 정보 없음'}
                      </div>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                      종합 점수 {score.totalScore}점
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyBlock message="이전 차수 또는 선행 리뷰의 종합 점수가 아직 없습니다." />
            )
          ) : (
            <EmptyBlock message="현재 라운드는 종합 점수를 사용하는 문항 구성이 아닙니다." />
          )}
        </div>
      ) : null}
    </aside>
  )
}

function TabButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        props.active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {props.label}
    </button>
  )
}

function MetaChip(props: { label: string; tone: 'blue' | 'emerald' | 'slate' }) {
  const toneClass =
    props.tone === 'blue'
      ? 'bg-blue-100 text-blue-700'
      : props.tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 font-semibold ${toneClass}`}>{props.label}</span>
}

function InfoBlock(props: { label: string; body: string; preserveWhitespace?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-sm font-medium text-slate-900">{props.label}</div>
      <p className={`mt-2 text-sm leading-6 text-slate-700 ${props.preserveWhitespace ? 'whitespace-pre-line' : ''}`}>
        {props.body}
      </p>
    </div>
  )
}

function EmptyBlock(props: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {props.message}
    </div>
  )
}
