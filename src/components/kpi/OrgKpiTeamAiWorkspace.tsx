'use client'

import type { ReactNode } from 'react'
import { Bot, CheckCircle2, FileText, PencilLine, Sparkles, Target, XCircle } from 'lucide-react'
import type {
  OrgKpiBusinessPlanView,
  OrgKpiJobDescriptionView,
  OrgKpiTeamAiContextView,
  OrgKpiTeamRecommendationItemView,
  OrgKpiTeamReviewItemView,
} from '@/server/org-kpi-team-ai'
import { formatOrgKpiTargetValues } from '@/lib/org-kpi-target-values'

export type BusinessPlanFormState = {
  id?: string
  deptId: string
  evalYear: number
  evalCycleId?: string | null
  title: string
  sourceType: 'TEXT' | 'SUMMARY'
  summaryText: string
  bodyText: string
}

export type JobDescriptionFormState = {
  id?: string
  deptId: string
  scope: 'DIVISION' | 'TEAM'
  evalYear: number
  evalCycleId?: string | null
  title: string
  summaryText: string
  bodyText: string
}

export type RecommendationDecisionMode = 'ADOPT_EDITED' | 'REFERENCED_NEW'

type Props = {
  selectedDepartmentId: string
  context: OrgKpiTeamAiContextView | null
  loading: boolean
  busy: boolean
  businessPlanForm: BusinessPlanFormState
  divisionJobDescriptionForm: JobDescriptionFormState
  teamJobDescriptionForm: JobDescriptionFormState
  onBusinessPlanFormChange: (next: BusinessPlanFormState) => void
  onDivisionJobDescriptionFormChange: (next: JobDescriptionFormState) => void
  onTeamJobDescriptionFormChange: (next: JobDescriptionFormState) => void
  onSaveBusinessPlan: () => void
  onSaveDivisionJobDescription: () => void
  onSaveTeamJobDescription: () => void
  onRequestRecommendation: () => void
  onAdoptRecommendationAsIs: (itemId: string) => void
  onDismissRecommendation: (itemId: string) => void
  onOpenRecommendationEditor: (
    item: OrgKpiTeamRecommendationItemView,
    decision: RecommendationDecisionMode
  ) => void
  onRunReview: () => void
}

const cls = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

const decisionLabels: Record<OrgKpiTeamRecommendationItemView['decision'], string> = {
  PENDING: '검토 대기',
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

function EmptyBlock(props: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="text-base font-semibold text-slate-900">{props.title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{props.description}</p>
    </div>
  )
}

function SummaryCard(props: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{props.value}</div>
      {props.helper ? <div className="mt-1 text-xs text-slate-500">{props.helper}</div> : null}
    </div>
  )
}

function StatusBadge(props: {
  label: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return (
    <span
      className={cls(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        props.tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        props.tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
        props.tone === 'danger' && 'border-red-200 bg-red-50 text-red-700',
        props.tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-700',
        (!props.tone || props.tone === 'neutral') && 'border-slate-200 bg-slate-50 text-slate-600'
      )}
    >
      {props.label}
    </span>
  )
}

function SectionCard(props: {
  title: string
  helper?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{props.title}</h3>
          {props.helper ? <p className="mt-1 text-sm text-slate-500">{props.helper}</p> : null}
        </div>
        {props.action}
      </div>
      <div className="mt-5">{props.children}</div>
    </section>
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

function SecondaryButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
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

function DocumentEditorCard(props: {
  title: string
  helper: string
  editable: boolean
  saveLabel: string
  busy: boolean
  form: BusinessPlanFormState | JobDescriptionFormState
  onChange: (next: BusinessPlanFormState | JobDescriptionFormState) => void
  onSave: () => void
}) {
  return (
    <SectionCard
      title={props.title}
      helper={props.helper}
      action={
        props.editable ? (
          <PrimaryButton
            label={props.saveLabel}
            icon={<FileText className="h-4 w-4" />}
            onClick={props.onSave}
            disabled={props.busy}
          />
        ) : null
      }
    >
      <div className="grid gap-4">
        <Field label="제목">
          <input
            value={props.form.title}
            onChange={(event) => props.onChange({ ...props.form, title: event.target.value })}
            disabled={!props.editable || props.busy}
            className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </Field>
        <Field label="요약">
          <textarea
            value={props.form.summaryText}
            onChange={(event) => props.onChange({ ...props.form, summaryText: event.target.value })}
            disabled={!props.editable || props.busy}
            rows={5}
            className="min-h-[8rem] w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </Field>
        <Field label="본문">
          <textarea
            value={props.form.bodyText}
            onChange={(event) => props.onChange({ ...props.form, bodyText: event.target.value })}
            disabled={!props.editable || props.busy}
            rows={10}
            className="min-h-[14rem] w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 disabled:bg-slate-50"
          />
        </Field>
      </div>
    </SectionCard>
  )
}

function InfoLine(props: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{props.label}</div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {props.value?.trim() ? props.value : '-'}
      </div>
    </div>
  )
}

function RecommendationCard(props: {
  item: OrgKpiTeamRecommendationItemView
  busy: boolean
  onAdoptRecommendationAsIs: (itemId: string) => void
  onDismissRecommendation: (itemId: string) => void
  onOpenRecommendationEditor: (
    item: OrgKpiTeamRecommendationItemView,
    decision: RecommendationDecisionMode
  ) => void
}) {
  const isPending = props.item.decision === 'PENDING'

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={props.item.recommendationType === 'TEAM_INDEPENDENT' ? '독립형 KPI' : '연계형 KPI'}
              tone={props.item.recommendationType === 'TEAM_INDEPENDENT' ? 'warning' : 'info'}
            />
            <StatusBadge label={decisionLabels[props.item.decision]} tone={isPending ? 'neutral' : 'success'} />
          </div>
          <h4 className="text-lg font-semibold text-slate-900">{props.item.title}</h4>
          <p className="text-sm leading-6 text-slate-600">{props.item.definition ?? '정의가 아직 없습니다.'}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {formatOrgKpiTargetValues({
            targetValueT: props.item.targetValueT,
            targetValueE: props.item.targetValueE,
            targetValueS: props.item.targetValueS,
            unit: props.item.unit,
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoLine label="연결 본부 KPI" value={props.item.sourceOrgKpiTitle ?? '연결 없음'} />
        <InfoLine label="연결 이유" value={props.item.linkageExplanation} />
        <InfoLine label="추천 이유" value={props.item.recommendationReason} />
        <InfoLine label="품질 근거" value={props.item.whyThisIsHighQuality ?? '추가 근거 없음'} />
        <InfoLine label="산식" value={props.item.formula ?? '산식 없음'} />
        <InfoLine label="데이터 출처" value={props.item.metricSource ?? '데이터 출처 없음'} />
        <InfoLine label="통제 가능성" value={props.item.controllabilityNote ?? '통제 가능성 메모 없음'} />
        <InfoLine label="리스크" value={props.item.riskComment ?? '리스크 메모 없음'} />
        {props.item.recommendationType === 'TEAM_INDEPENDENT' ? (
          <>
            <InfoLine label="직무기술서 근거" value={props.item.jobDescriptionEvidence ?? '직무기술서 근거 없음'} />
            <InfoLine label="팀 역할 적합성" value={props.item.whyThisFitsTeamRole ?? '역할 적합성 설명 없음'} />
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge label={`정렬도 ${props.item.alignmentScore ?? '-'}`} tone="info" />
        <StatusBadge label={`품질 ${props.item.qualityScore ?? '-'}`} tone="success" />
        <StatusBadge label={`난이도 ${props.item.difficultyScore ?? '-'}`} tone="warning" />
        <StatusBadge label={`우선순위 ${props.item.recommendedPriority ?? props.item.rank}`} />
      </div>

      {isPending ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <PrimaryButton
            label="그대로 채택"
            icon={<CheckCircle2 className="h-4 w-4" />}
            onClick={() => props.onAdoptRecommendationAsIs(props.item.id)}
            disabled={props.busy}
          />
          <SecondaryButton
            label="수정 후 채택"
            onClick={() => props.onOpenRecommendationEditor(props.item, 'ADOPT_EDITED')}
            disabled={props.busy}
          />
          <SecondaryButton
            label="참고 신규 작성"
            onClick={() => props.onOpenRecommendationEditor(props.item, 'REFERENCED_NEW')}
            disabled={props.busy}
          />
          <SecondaryButton
            label="제외"
            onClick={() => props.onDismissRecommendation(props.item.id)}
            disabled={props.busy}
          />
        </div>
      ) : null}
    </article>
  )
}

function ReviewItemCard(props: { item: OrgKpiTeamReviewItemView }) {
  const tone =
    props.item.verdict === 'ADEQUATE'
      ? 'success'
      : props.item.verdict === 'CAUTION'
        ? 'warning'
        : 'danger'

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={props.item.recommendationType === 'TEAM_INDEPENDENT' ? '독립형 KPI' : '연계형 KPI'}
              tone={props.item.recommendationType === 'TEAM_INDEPENDENT' ? 'warning' : 'info'}
            />
            <StatusBadge label={verdictLabels[props.item.verdict]} tone={tone} />
          </div>
          <h4 className="mt-2 text-base font-semibold text-slate-900">{props.item.kpiTitleSnapshot}</h4>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoLine label="검토 근거" value={props.item.rationale} />
        <InfoLine label="정렬도" value={props.item.linkageComment ?? '정렬도 코멘트 없음'} />
        <InfoLine label="역할 적합성" value={props.item.roleFitComment ?? '역할 적합성 코멘트 없음'} />
        <InfoLine label="측정 가능성" value={props.item.measurabilityComment ?? '측정 가능성 코멘트 없음'} />
        <InfoLine label="통제 가능성" value={props.item.controllabilityComment ?? '통제 가능성 코멘트 없음'} />
        <InfoLine label="도전성" value={props.item.challengeComment ?? '도전성 코멘트 없음'} />
        <InfoLine label="외생 변수 리스크" value={props.item.externalRiskComment ?? '리스크 코멘트 없음'} />
        <InfoLine label="문장 명확성" value={props.item.clarityComment ?? '문장 명확성 코멘트 없음'} />
        <InfoLine label="중복 여부" value={props.item.duplicationComment ?? '중복 코멘트 없음'} />
        <InfoLine label="강점" value={props.item.strongPoint ?? '강점 코멘트 없음'} />
        <InfoLine label="보완점" value={props.item.weakPoint ?? '보완점 코멘트 없음'} />
        <InfoLine label="수정 권고안" value={props.item.improvementSuggestions ?? props.item.recommendationText} />
      </div>
    </article>
  )
}

function formatDocumentSummary(document: OrgKpiBusinessPlanView | OrgKpiJobDescriptionView | null) {
  if (!document) return '미등록'
  return document.updatedAt.slice(0, 10)
}

export function OrgKpiTeamAiWorkspace(props: Props) {
  if (props.selectedDepartmentId === 'ALL') {
    return (
      <EmptyBlock
        title="팀 범위를 먼저 선택해 주세요"
        description="연계형/독립형 팀 KPI AI 추천과 재검토는 특정 팀을 선택한 뒤에만 실행할 수 있습니다."
      />
    )
  }

  if (props.loading || !props.context) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">팀 KPI AI 워크스페이스를 불러오는 중입니다...</div>
      </div>
    )
  }

  const latestRecommendationSet = props.context.recommendationSets[0] ?? null
  const latestReviewRun = props.context.reviewRuns[0] ?? null
  const alignedItems =
    latestRecommendationSet?.items.filter((item) => item.recommendationType === 'ALIGNED_WITH_DIVISION_KPI') ?? []
  const independentItems =
    latestRecommendationSet?.items.filter((item) => item.recommendationType === 'TEAM_INDEPENDENT') ?? []

  return (
    <div className="space-y-6">
      <SectionCard
        title="팀 KPI AI 워크스페이스"
        helper={`${props.context.planningDepartmentName}의 본부 KPI, 사업계획서, 직무기술서를 기준으로 팀 KPI를 추천하고 재검토합니다.`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="본부 사업계획서" value={formatDocumentSummary(props.context.businessPlan)} />
          <SummaryCard label="본부 직무기술서" value={formatDocumentSummary(props.context.divisionJobDescription)} />
          <SummaryCard label="팀 직무기술서" value={formatDocumentSummary(props.context.teamJobDescription)} />
          <SummaryCard label="연결 본부 KPI" value={`${props.context.sourceOrgKpis.length}개`} />
          <SummaryCard
            label="최근 AI 재검토"
            value={
              latestReviewRun?.overallVerdict ? verdictLabels[latestReviewRun.overallVerdict] : '아직 없음'
            }
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <DocumentEditorCard
          title="본부 사업계획서"
          helper={`${props.context.planningSourceLabel} 기반 요약/본문을 저장합니다.`}
          editable={props.context.canEditBusinessPlan}
          saveLabel={props.context.businessPlan ? '사업계획서 저장' : '사업계획서 등록'}
          busy={props.busy}
          form={props.businessPlanForm}
          onChange={(next) => props.onBusinessPlanFormChange(next as BusinessPlanFormState)}
          onSave={props.onSaveBusinessPlan}
        />
        <DocumentEditorCard
          title="본부 직무기술서"
          helper="연계형 KPI 추천의 전략 정렬과 독립형 KPI 추천의 상위 역할 근거로 사용합니다."
          editable={props.context.canEditDivisionJobDescription}
          saveLabel={props.context.divisionJobDescription ? '본부 직무기술서 저장' : '본부 직무기술서 등록'}
          busy={props.busy}
          form={props.divisionJobDescriptionForm}
          onChange={(next) => props.onDivisionJobDescriptionFormChange(next as JobDescriptionFormState)}
          onSave={props.onSaveDivisionJobDescription}
        />
        <DocumentEditorCard
          title="팀 직무기술서"
          helper="독립형 KPI 추천과 AI 재검토에서 팀 고유 역할 근거로 사용합니다."
          editable={props.context.canEditTeamJobDescription}
          saveLabel={props.context.teamJobDescription ? '팀 직무기술서 저장' : '팀 직무기술서 등록'}
          busy={props.busy}
          form={props.teamJobDescriptionForm}
          onChange={(next) => props.onTeamJobDescriptionFormChange(next as JobDescriptionFormState)}
          onSave={props.onSaveTeamJobDescription}
        />
      </div>

      <SectionCard
        title="상위 본부 KPI 요약"
        helper="연계형 팀 KPI 추천의 1순위 입력 컨텍스트입니다."
        action={
          <PrimaryButton
            label="AI KPI 추천 받기"
            icon={<Sparkles className="h-4 w-4" />}
            onClick={props.onRequestRecommendation}
            disabled={
              props.busy ||
              !props.context.canRequestRecommendation ||
              !props.context.businessPlan ||
              !props.context.divisionJobDescription ||
              !props.context.teamJobDescription
            }
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {props.context.sourceOrgKpis.length ? (
            props.context.sourceOrgKpis.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.category ?? '카테고리 미지정'}</div>
                  </div>
                  <StatusBadge label={item.difficulty ?? 'MEDIUM'} />
                </div>
                <div className="mt-3 text-sm text-slate-600">{item.targetValuesText}</div>
              </div>
            ))
          ) : (
            <EmptyBlock
              title="연결된 본부 KPI가 없습니다"
              description="상위 KPI가 등록되어야 연계형 팀 KPI를 전략적으로 추천할 수 있습니다."
            />
          )}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="연계형 팀 KPI 추천"
          helper="연결된 본부 KPI를 먼저 읽고, 그 KPI 달성에 직접 기여하는 팀 KPI만 추천합니다."
        >
          {latestRecommendationSet && alignedItems.length ? (
            <div className="space-y-4">
              {alignedItems.map((item) => (
                <RecommendationCard
                  key={item.id}
                  item={item}
                  busy={props.busy}
                  onAdoptRecommendationAsIs={props.onAdoptRecommendationAsIs}
                  onDismissRecommendation={props.onDismissRecommendation}
                  onOpenRecommendationEditor={props.onOpenRecommendationEditor}
                />
              ))}
            </div>
          ) : (
            <EmptyBlock
              title="연계형 팀 KPI 추천이 아직 없습니다"
              description="본부 사업계획서와 직무기술서를 저장한 뒤 AI KPI 추천을 실행해 주세요."
            />
          )}
        </SectionCard>

        <SectionCard
          title="독립형 팀 KPI 추천"
          helper="팀 직무기술서와 역할 범위를 기준으로, 팀의 고유 책임에 맞는 독립 KPI를 추천합니다."
        >
          {latestRecommendationSet && independentItems.length ? (
            <div className="space-y-4">
              {independentItems.map((item) => (
                <RecommendationCard
                  key={item.id}
                  item={item}
                  busy={props.busy}
                  onAdoptRecommendationAsIs={props.onAdoptRecommendationAsIs}
                  onDismissRecommendation={props.onDismissRecommendation}
                  onOpenRecommendationEditor={props.onOpenRecommendationEditor}
                />
              ))}
            </div>
          ) : (
            <EmptyBlock
              title="독립형 팀 KPI 추천이 아직 없습니다"
              description="팀 직무기술서를 입력한 뒤 AI KPI 추천을 실행하면 독립형 KPI 2~3개가 함께 제안됩니다."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="채택된 팀 KPI 초안"
        helper="추천 원안과 팀장의 최종 의사결정은 분리 저장됩니다."
        action={
          <PrimaryButton
            label="AI 재검토 실행"
            icon={<Bot className="h-4 w-4" />}
            onClick={props.onRunReview}
            disabled={props.busy || !props.context.canRunReview}
          />
        }
      >
        {latestRecommendationSet ? (
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard
              label="그대로 채택"
              value={`${latestRecommendationSet.items.filter((item) => item.decision === 'ADOPT_AS_IS').length}개`}
            />
            <SummaryCard
              label="수정 후 채택"
              value={`${latestRecommendationSet.items.filter((item) => item.decision === 'ADOPT_EDITED').length}개`}
            />
            <SummaryCard
              label="참고 신규 작성"
              value={`${latestRecommendationSet.items.filter((item) => item.decision === 'REFERENCED_NEW').length}개`}
            />
            <SummaryCard
              label="제외"
              value={`${latestRecommendationSet.items.filter((item) => item.decision === 'DISMISSED').length}개`}
            />
          </div>
        ) : (
          <EmptyBlock
            title="아직 채택된 KPI 초안이 없습니다"
            description="추천안을 그대로 채택하거나 수정 후 채택하면 이 영역의 상태가 누적됩니다."
          />
        )}
      </SectionCard>

      <SectionCard title="AI 재검토 결과" helper="연계형 KPI는 상위 본부 KPI 정렬도를, 독립형 KPI는 팀 역할 적합성을 더 강하게 검토합니다.">
        {latestReviewRun ? (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={latestReviewRun.overallVerdict ? verdictLabels[latestReviewRun.overallVerdict] : '검토 결과'}
                      tone={
                        latestReviewRun.overallVerdict === 'ADEQUATE'
                          ? 'success'
                          : latestReviewRun.overallVerdict === 'CAUTION'
                            ? 'warning'
                            : 'danger'
                      }
                    />
                    <StatusBadge label="FULL_SET" />
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {latestReviewRun.overallSummary ?? '검토 요약이 없습니다.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {latestReviewRun.createdAt.slice(0, 10)}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoLine label="연계형 KPI 커버리지" value={latestReviewRun.linkedParentCoverage ?? '별도 커버리지 설명 없음'} />
                <InfoLine label="독립형 KPI 커버리지" value={latestReviewRun.independentKpiCoverage ?? '별도 커버리지 설명 없음'} />
              </div>
            </div>

            <div className="space-y-4">
              {latestReviewRun.items.map((item) => (
                <ReviewItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ) : (
          <EmptyBlock
            title="AI 재검토 결과가 아직 없습니다"
            description="채택된 팀 KPI 초안을 만든 뒤 AI 재검토를 실행하면 적정/주의/미흡 결과와 수정 권고가 저장됩니다."
          />
        )}
      </SectionCard>
    </div>
  )
}
