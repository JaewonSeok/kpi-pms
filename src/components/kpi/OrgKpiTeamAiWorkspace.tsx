/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client'

import type { ReactNode } from 'react'
import { Bot, CheckCircle2, FileText, Sparkles, Wand2 } from 'lucide-react'
import type {
  OrgKpiTeamAiContextView,
  OrgKpiTeamRecommendationItemView,
} from '@/server/org-kpi-team-ai'
import { formatOrgKpiTargetValues } from '@/lib/org-kpi-target-values'

type BusinessPlanFormState = {
  id?: string
  deptId: string
  evalYear: number
  evalCycleId?: string | null
  title: string
  sourceType: 'TEXT' | 'SUMMARY'
  summaryText: string
  bodyText: string
}

type RecommendationDecisionMode = 'ADOPT_EDITED' | 'REFERENCED_NEW'

type Props = {
  selectedDepartmentId: string
  context: OrgKpiTeamAiContextView | null
  loading: boolean
  busy: boolean
  businessPlanForm: BusinessPlanFormState
  onBusinessPlanFormChange: (next: BusinessPlanFormState) => void
  onSaveBusinessPlan: () => void
  onRequestRecommendation: () => void
  onAdoptRecommendationAsIs: (itemId: string) => void
  onDismissRecommendation: (itemId: string) => void
  onOpenRecommendationEditor: (item: OrgKpiTeamRecommendationItemView, decision: RecommendationDecisionMode) => void
  onRunReview: () => void
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

const decisionLabels: Record<OrgKpiTeamRecommendationItemView['decision'], string> = {
  PENDING: '대기',
  ADOPT_AS_IS: '그대로 채택',
  ADOPT_EDITED: '수정 후 채택',
  DISMISSED: '제외',
  REFERENCED_NEW: '참고 신규 작성',
}

const verdictLabels = {
  ADEQUATE: '적정',
  CAUTION: '주의',
  INSUFFICIENT: '미흡',
} as const

function verdictClass(verdict?: keyof typeof verdictLabels | null) {
  if (verdict === 'ADEQUATE') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (verdict === 'CAUTION') return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-red-200 bg-red-50 text-red-700'
}

function decisionClass(decision: OrgKpiTeamRecommendationItemView['decision']) {
  if (decision === 'PENDING') return 'border-slate-200 bg-slate-50 text-slate-600'
  if (decision === 'DISMISSED') return 'border-slate-200 bg-white text-slate-500'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function EmptyBlock(props: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <div className="font-semibold text-slate-900">{props.title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{props.description}</p>
    </div>
  )
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm text-slate-700">
      <div className="font-medium">{props.label}</div>
      {props.children}
    </label>
  )
}

function PrimaryButton(props: {
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {props.icon}
      {props.label}
    </button>
  )
}

function SecondaryButton(props: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {props.label}
    </button>
  )
}

export function OrgKpiTeamAiWorkspace(props: Props) {
  if (props.selectedDepartmentId === 'ALL') {
    return (
      <EmptyBlock
        title="팀을 먼저 선택해 주세요"
        description="사업계획서 기반 팀 KPI 추천과 AI 재검토는 특정 팀 범위에서만 실행할 수 있습니다."
      />
    )
  }

  if (props.loading || !props.context) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">팀 KPI AI 워크스페이스를 불러오는 중입니다...</div>
      </div>
    )
  }

  const latestRecommendationSet = props.context.recommendationSets[0] ?? null
  const latestReviewRun = props.context.reviewRuns[0] ?? null

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Team KPI AI Workspace
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">
              {props.context.planningDepartmentName} 사업계획서 기반 팀 KPI 추천
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              상위 사업계획서와 본부 KPI를 기준으로 팀 KPI 초안을 추천하고, 팀장이 채택/수정한 결과를 다시 AI가 검토합니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="기준 사업계획서" value={props.context.businessPlan ? '연결됨' : '미등록'} />
            <SummaryCard label="상위 KPI" value={`${props.context.sourceOrgKpis.length}개`} />
            <SummaryCard label="최근 AI 검토" value={latestReviewRun ? verdictLabels[latestReviewRun.overallVerdict ?? 'CAUTION'] : '없음'} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">본부 사업계획서</h4>
              <p className="mt-1 text-sm text-slate-500">{props.context.planningSourceLabel}</p>
            </div>
            {props.context.canEditBusinessPlan ? (
              <PrimaryButton
                label={props.context.businessPlan ? '사업계획서 저장' : '사업계획서 등록'}
                icon={<FileText className="h-4 w-4" />}
                onClick={props.onSaveBusinessPlan}
                disabled={props.busy}
              />
            ) : null}
          </div>

          <div className="mt-5 grid gap-4">
            <Field label="제목">
              <input
                value={props.businessPlanForm.title}
                onChange={(event) =>
                  props.onBusinessPlanFormChange({ ...props.businessPlanForm, title: event.target.value })
                }
                disabled={!props.context.canEditBusinessPlan || props.busy}
                className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 disabled:bg-slate-50"
              />
            </Field>
            <Field label="요약">
              <textarea
                value={props.businessPlanForm.summaryText}
                onChange={(event) =>
                  props.onBusinessPlanFormChange({ ...props.businessPlanForm, summaryText: event.target.value })
                }
                disabled={!props.context.canEditBusinessPlan || props.busy}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 disabled:bg-slate-50"
              />
            </Field>
            <Field label="본문">
              <textarea
                value={props.businessPlanForm.bodyText}
                onChange={(event) =>
                  props.onBusinessPlanFormChange({ ...props.businessPlanForm, bodyText: event.target.value })
                }
                disabled={!props.context.canEditBusinessPlan || props.busy}
                rows={10}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 disabled:bg-slate-50"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">상위 본부 KPI</h4>
              <p className="mt-1 text-sm text-slate-500">추천 근거로 사용하는 상위 KPI 목록입니다.</p>
            </div>
            <PrimaryButton
              label="AI KPI 추천 받기"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={props.onRequestRecommendation}
              disabled={!props.context.canRequestRecommendation || props.busy || !props.context.businessPlan}
            />
          </div>
          <div className="mt-4 space-y-3">
            {props.context.sourceOrgKpis.length ? (
              props.context.sourceOrgKpis.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.category ?? '카테고리 미지정'} · {item.targetValuesText}
                  </div>
                </div>
              ))
            ) : (
              <EmptyBlock
                title="상위 KPI가 없습니다"
                description="본부 KPI가 준비되어야 AI가 팀 KPI 초안을 더 정확하게 추천할 수 있습니다."
              />
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-slate-900">AI 추천 KPI</h4>
              <p className="mt-1 text-sm text-slate-500">추천 원안과 팀장의 채택/제외 결정이 함께 기록됩니다.</p>
            </div>
            {latestRecommendationSet ? (
              <div className="text-xs text-slate-500">{latestRecommendationSet.createdAt.slice(0, 10)}</div>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            {latestRecommendationSet ? (
              <>
                {latestRecommendationSet.summaryText ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                    {latestRecommendationSet.summaryText}
                  </div>
                ) : null}
                {latestRecommendationSet.items.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-slate-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            추천 {item.rank}
                          </span>
                          <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', decisionClass(item.decision))}>
                            {decisionLabels[item.decision]}
                          </span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.definition ?? '정의 없음'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {formatOrgKpiTargetValues({
                          targetValueT: item.targetValueT,
                          targetValueE: item.targetValueE,
                          targetValueS: item.targetValueS,
                          unit: item.unit,
                        })}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <InfoBlock label="Linked parent KPI" value={item.sourceOrgKpiTitle ?? item.linkedParentKpiTitle ?? 'No parent KPI'} />
                      <InfoBlock label="Linkage reason" value={item.linkageReason ?? item.recommendationReason} />
                      <InfoBlock label="Metric source" value={item.metricSource ?? 'No metric source'} />
                      <InfoBlock label="High-quality reason" value={item.whyThisIsHighQuality ?? 'No quality rationale'} />
                      <InfoBlock label="Controllability" value={item.controllabilityNote ?? 'No controllability note'} />
                      <InfoBlock label="상위 KPI 연결" value={item.linkageExplanation} />
                      <InfoBlock label="추천 이유" value={item.recommendationReason} />
                      <InfoBlock label="측정 방식" value={item.formula ?? '산식 없음'} />
                      <InfoBlock label="운영 리스크" value={item.riskComment ?? '추가 리스크 코멘트 없음'} />
                    </div>

                    {item.decision === 'PENDING' ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <PrimaryButton
                          label="그대로 채택"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                          onClick={() => props.onAdoptRecommendationAsIs(item.id)}
                          disabled={props.busy}
                        />
                        <SecondaryButton
                          label="수정 후 채택"
                          onClick={() => props.onOpenRecommendationEditor(item, 'ADOPT_EDITED')}
                          disabled={props.busy}
                        />
                        <SecondaryButton
                          label="참고하여 신규 작성"
                          onClick={() => props.onOpenRecommendationEditor(item, 'REFERENCED_NEW')}
                          disabled={props.busy}
                        />
                        <SecondaryButton
                          label="제외"
                          onClick={() => props.onDismissRecommendation(item.id)}
                          disabled={props.busy}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        {item.adoptedOrgKpiId
                          ? `최종 반영 KPI ID: ${item.adoptedOrgKpiId}`
                          : '이 추천안은 팀 KPI로 채택되지 않았습니다.'}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <EmptyBlock
                title="AI 추천 이력이 없습니다"
                description="사업계획서와 상위 KPI를 준비한 뒤 AI KPI 추천 받기를 실행해 주세요."
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">AI 재검토</h4>
                <p className="mt-1 text-sm text-slate-500">팀 KPI 최종안을 적정 / 주의 / 미흡으로 다시 검토합니다.</p>
              </div>
              <PrimaryButton
                label="AI 검토 실행"
                icon={<Bot className="h-4 w-4" />}
                onClick={props.onRunReview}
                disabled={!props.context.canRunReview || props.busy}
              />
            </div>

            {latestReviewRun ? (
              <div className="mt-4 space-y-4">
                <div className={cls('rounded-2xl border px-4 py-3', verdictClass(latestReviewRun.overallVerdict))}>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em]">Overall verdict</div>
                  <div className="mt-2 text-lg font-semibold">
                    {verdictLabels[latestReviewRun.overallVerdict ?? 'CAUTION']}
                  </div>
                  <p className="mt-2 text-sm leading-6">{latestReviewRun.overallSummary ?? '검토 요약이 없습니다.'}</p>
                </div>
                <div className="space-y-3">
                  {latestReviewRun.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold text-slate-900">{item.kpiTitleSnapshot}</div>
                        <span className={cls('rounded-full border px-2.5 py-1 text-xs font-semibold', verdictClass(item.verdict))}>
                          {verdictLabels[item.verdict]}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        <p>{item.rationale}</p>
                        <p>연결성: {item.linkageComment}</p>
                        <p>측정 가능성: {item.measurabilityComment}</p>
                        <p>통제 가능성: {item.controllabilityComment}</p>
                        <p>수정 권고: {item.recommendationText}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyBlock
                  title="AI 검토 결과가 없습니다"
                  description="팀 KPI를 작성한 뒤 AI 검토 실행을 눌러 품질 평가와 수정 권고를 받아보세요."
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-base font-semibold text-slate-900">사용 가이드</h4>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <GuideItem icon={<FileText className="h-4 w-4" />} text="본부 사업계획서와 상위 KPI를 먼저 확인합니다." />
              <GuideItem icon={<Sparkles className="h-4 w-4" />} text="AI 추천 KPI 3~5개를 받은 뒤 그대로 채택하거나 수정합니다." />
              <GuideItem icon={<Wand2 className="h-4 w-4" />} text="최종 팀 KPI 저장 후 AI 검토로 정렬도와 측정 가능성을 다시 확인합니다." />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SummaryCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{props.label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function InfoBlock(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{props.label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-700">{props.value}</div>
    </div>
  )
}

function GuideItem(props: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mt-0.5 text-slate-500">{props.icon}</div>
      <div>{props.text}</div>
    </div>
  )
}
