'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  FileSearch,
  FolderOpen,
  Gavel,
  Layers3,
  MessageSquareText,
  Scale,
  ShieldAlert,
  Upload,
} from 'lucide-react'
import type { AppealPageData, AppealViewModel, AppealCaseStatus } from '@/server/evaluation-appeal'

type EvaluationAppealClientProps = AppealPageData
type AppealTab = 'form' | 'attachments' | 'timeline' | 'decision' | 'policy'
type DraftAttachment = AppealViewModel['attachments'][number]

const TAB_LABELS: Record<AppealTab, string> = {
  form: '신청서',
  attachments: '첨부/증빙',
  timeline: '처리 이력',
  decision: '결정 내용',
  policy: '정책 안내',
}

const STATUS_LABELS: Record<AppealCaseStatus, string> = {
  DRAFT: '초안',
  SUBMITTED: '제출됨',
  UNDER_REVIEW: '검토 중',
  INFO_REQUESTED: '보완 요청',
  RESOLVED: '처리 완료',
  REJECTED: '기각',
  WITHDRAWN: '철회',
}

const CATEGORY_OPTIONS = ['점수 이의', '코멘트 이의', '절차 이의', '캘리브레이션/등급 이의', '기타']
const REQUESTED_ACTIONS = ['재검토 요청', '설명 요청', '재평가 요청']
const RELATED_TARGET_OPTIONS = ['성과 항목', '역량 항목', '최종 등급']

export function EvaluationAppealClient(props: EvaluationAppealClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AppealTab>('form')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [category, setCategory] = useState('점수 이의')
  const [reason, setReason] = useState('')
  const [requestedAction, setRequestedAction] = useState('재검토 요청')
  const [relatedTargets, setRelatedTargets] = useState<string[]>(['최종 등급'])
  const [agreed, setAgreed] = useState(false)
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [decisionNote, setDecisionNote] = useState('')
  const [resolutionType, setResolutionType] = useState('재검토 반영')

  const viewModel = props.viewModel
  const cycleOptions = props.availableCycles
  const selectedCycle = cycleOptions.find((cycle) => cycle.id === props.selectedCycleId) ?? cycleOptions[0]
  const availableYears = useMemo(
    () => Array.from(new Set(cycleOptions.map((cycle) => cycle.year))).sort((a, b) => b - a),
    [cycleOptions]
  )
  const draftStorageKey = viewModel
    ? `appeal-draft:${viewModel.cycle.id}:${viewModel.resultSummary.resultId}`
    : ''

  useEffect(() => {
    if (!viewModel) return

    const stored = draftStorageKey ? window.localStorage.getItem(draftStorageKey) : null
    const parsed = stored ? safeParseDraft(stored) : null

    setCategory(parsed?.category ?? viewModel.case.category)
    setReason(parsed?.reason ?? viewModel.case.reason)
    setRequestedAction(parsed?.requestedAction ?? viewModel.case.requestedAction ?? '재검토 요청')
    setRelatedTargets(parsed?.relatedTargets ?? viewModel.case.relatedTargets)
    setAttachments(parsed?.attachments ?? viewModel.attachments)
    setAgreed(false)
    setDecisionNote(viewModel.decision?.note ?? viewModel.case.resolutionNote ?? '')
    setResolutionType(viewModel.case.resolutionType ?? '재검토 반영')
  }, [draftStorageKey, viewModel])

  function persistDraft() {
    if (!draftStorageKey) return

    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        category,
        reason,
        requestedAction,
        relatedTargets,
        attachments,
      })
    )
    setNotice('임시저장되었습니다. 같은 브라우저에서 초안이 유지됩니다.')
  }

  function clearDraft() {
    if (draftStorageKey) window.localStorage.removeItem(draftStorageKey)
  }

  async function handleSubmit() {
    if (!viewModel) return
    if (reason.trim().length < 20) {
      setNotice('이의 신청 사유는 20자 이상 입력해 주세요.')
      return
    }
    if (!agreed) {
      setNotice('제출 전 확인 체크를 완료해 주세요.')
      return
    }

    setIsSubmitting(true)
    try {
      if (viewModel.case.id && viewModel.case.status === 'INFO_REQUESTED') {
        await fetch(`/api/appeals/${viewModel.case.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resubmit',
            reason,
            category,
            requestedAction,
            relatedTargets,
            attachments,
          }),
        }).then(assertJsonSuccess)
      } else {
        await fetch('/api/appeals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evaluationId: viewModel.resultSummary.resultId,
            reason,
            category,
            requestedAction,
            relatedTargets,
            attachments,
          }),
        }).then(assertJsonSuccess)
      }

      clearDraft()
      setNotice('이의 신청이 제출되었습니다.')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '이의 신청 제출 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
  }
}

function AppealPageHeader({
  selectedCycle,
}: {
  selectedCycle?: EvaluationAppealClientProps['availableCycles'][number]
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Appeal Case Management</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">이의 신청</h1>
          <p className="mt-2 text-sm text-slate-500">
            평가 결과 확인부터 이의 사유 작성, 증빙 정리, 처리 상태 추적, 결정 확인까지 한 화면에서 이어집니다.
          </p>
        </div>
        {selectedCycle ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            현재 주기: <span className="font-semibold text-slate-900">{selectedCycle.name}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AppealHero({
  viewModel,
  availableYears,
  onYearChange,
  onCycleChange,
  onCaseChange,
  onSaveDraft,
  onSubmit,
  onWithdraw,
  submitting,
}: {
  viewModel: AppealViewModel
  availableYears: number[]
  onYearChange: (year: number) => void
  onCycleChange: (cycleId: string) => void
  onCaseChange: (caseId: string) => void
  onSaveDraft: () => void
  onSubmit: () => void
  onWithdraw: () => void
  submitting: boolean
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectorCard
              label="연도"
              value={String(viewModel.cycle.year)}
              options={availableYears.map((year) => ({ value: String(year), label: `${year}년` }))}
              onChange={(value) => onYearChange(Number(value))}
            />
            <SelectorCard
              label="평가 주기"
              value={viewModel.cycle.id}
              options={[{ value: viewModel.cycle.id, label: viewModel.cycle.name }]}
              onChange={onCycleChange}
            />
            {viewModel.caseOptions?.length ? (
              <SelectorCard
                label="케이스"
                value={viewModel.case.id ?? ''}
                options={viewModel.caseOptions.map((item) => ({
                  value: item.id,
                  label: `${item.caseNumber} / ${item.applicantName}`,
                }))}
                onChange={onCaseChange}
              />
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">접수번호</div>
                <div className="mt-3 text-sm font-semibold text-slate-900">{viewModel.case.caseNumber}</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={viewModel.case.status} />
            <InfoBadge label={viewModel.cycle.appealOpen ? '신청 가능 기간' : '신청 기간 아님'} />
            <InfoBadge label={`처리 SLA ${formatDateTime(viewModel.case.slaDueAt)}`} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="접수번호" value={viewModel.case.caseNumber} />
            <HeroMetric label="현재 상태" value={STATUS_LABELS[viewModel.case.status]} emphasis />
            <HeroMetric label="신청 가능 기간" value={viewModel.cycle.appealDeadline ? `~ ${formatDateTime(viewModel.cycle.appealDeadline)}` : '운영 중'} />
            <HeroMetric label="예상 처리기한" value={formatDateTime(viewModel.case.slaDueAt)} />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <ActionButton icon={<FilePlus2 className="h-4 w-4" />} label="새 이의 신청" onClick={onSaveDraft} disabled={submitting} />
          {viewModel.case.canEdit ? (
            <>
              <ActionButton icon={<FolderOpen className="h-4 w-4" />} label="임시저장" onClick={onSaveDraft} disabled={submitting} />
              <ActionButton icon={<CheckCircle2 className="h-4 w-4" />} label="제출" onClick={onSubmit} disabled={submitting || !viewModel.case.canSubmit} variant="primary" />
            </>
          ) : null}
          {viewModel.case.canWithdraw ? (
            <ActionButton icon={<ShieldAlert className="h-4 w-4" />} label="철회" onClick={onWithdraw} disabled={submitting} />
          ) : null}
          <ActionLink icon={<FileSearch className="h-4 w-4" />} label="결과 보기" href="/evaluation/results" description="평가 결과 리포트로 돌아가 근거와 점수 흐름을 다시 확인합니다." />
        </div>
      </div>
    </section>
  )
}

function AppealSummaryCards({ viewModel }: { viewModel: AppealViewModel }) {
  const nextAction =
    viewModel.actorMode === 'admin'
      ? viewModel.case.status === 'SUBMITTED'
        ? '검토 시작'
        : viewModel.case.status === 'INFO_REQUESTED'
          ? '재제출 확인'
          : '결정 내용 확인'
      : viewModel.case.status === 'INFO_REQUESTED'
        ? '신청 내용 보완하기'
        : viewModel.case.status === 'RESOLVED' || viewModel.case.status === 'REJECTED'
          ? '결정 내용 확인하기'
          : '평가 결과로 돌아가기'

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={<Scale className="h-5 w-5" />} label="연결된 평가 결과" value={`${viewModel.resultSummary.finalGrade} / ${viewModel.resultSummary.totalScore.toFixed(1)}점`} description="최종 공개 평가 결과" />
      <SummaryCard icon={<Layers3 className="h-5 w-5" />} label="현재 상태" value={STATUS_LABELS[viewModel.case.status]} description={`최근 업데이트 ${formatDateTime(viewModel.case.updatedAt)}`} />
      <SummaryCard icon={<CalendarClock className="h-5 w-5" />} label="접수일 / 처리기한" value={`${formatDateTime(viewModel.case.createdAt)} / ${formatDateTime(viewModel.case.slaDueAt)}`} description={viewModel.case.status === 'INFO_REQUESTED' ? '보완 요청이 있습니다.' : 'SLA 기준으로 관리됩니다.'} />
      <NextActionCard label={nextAction} description={viewModel.actorMode === 'admin' ? '운영자 검토 액션이 필요한 상태입니다.' : '다음 행동을 바로 이어서 진행하세요.'} attachmentsCount={viewModel.attachments.length} href={viewModel.case.status === 'INFO_REQUESTED' ? undefined : '/evaluation/results'} />
    </section>
  )
}

function AppealTabs({
  activeTab,
  onChange,
}: {
  activeTab: AppealTab
  onChange: (tab: AppealTab) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {(Object.keys(TAB_LABELS) as AppealTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </div>
  )
}

function AppealFormSection({
  viewModel,
  category,
  setCategory,
  reason,
  setReason,
  requestedAction,
  setRequestedAction,
  relatedTargets,
  setRelatedTargets,
  agreed,
  setAgreed,
}: {
  viewModel: AppealViewModel
  category: string
  setCategory: (value: string) => void
  reason: string
  setReason: (value: string) => void
  requestedAction: string
  setRequestedAction: (value: string) => void
  relatedTargets: string[]
  setRelatedTargets: (value: string[]) => void
  agreed: boolean
  setAgreed: (value: boolean) => void
}) {
  const readOnly = !viewModel.case.canEdit

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="대상 평가 결과 요약" description="신청 대상이 되는 평가 결과를 다시 확인한 뒤 이의를 작성하세요.">
        <div className="grid gap-4 md:grid-cols-2">
          <MiniCard label="평가 주기" value={viewModel.cycle.name} />
          <MiniCard label="최종 등급" value={viewModel.resultSummary.finalGrade} />
          <MiniCard label="총점" value={`${viewModel.resultSummary.totalScore.toFixed(1)}점`} />
          <MiniCard label="평가자 / 공개일" value={`${viewModel.resultSummary.evaluatorName ?? '미기재'} / ${formatDateTime(viewModel.resultSummary.publishedAt)}`} />
        </div>

        <div className="mt-6 grid gap-4">
          <FieldBlock label="이의 유형">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <ChipButton key={option} active={category === option} disabled={readOnly} onClick={() => setCategory(option)}>
                  {option}
                </ChipButton>
              ))}
            </div>
          </FieldBlock>

          <FieldBlock label="신청 사유 본문">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              readOnly={readOnly}
              className="min-h-44 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm text-slate-900"
              placeholder="평가 결과에 이의를 신청하는 이유를 구체적으로 작성해 주세요."
            />
          </FieldBlock>

          <FieldBlock label="기대하는 조치">
            <select
              value={requestedAction}
              onChange={(event) => setRequestedAction(event.target.value)}
              disabled={readOnly}
              className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
            >
              {REQUESTED_ACTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FieldBlock>

          <FieldBlock label="관련 항목 선택">
            <div className="flex flex-wrap gap-2">
              {RELATED_TARGET_OPTIONS.map((option) => {
                const active = relatedTargets.includes(option)
                return (
                  <ChipButton
                    key={option}
                    active={active}
                    disabled={readOnly}
                    onClick={() =>
                      setRelatedTargets(
                        active
                          ? relatedTargets.filter((item) => item !== option)
                          : [...relatedTargets, option]
                      )
                    }
                  >
                    {option}
                  </ChipButton>
                )
              })}
            </div>
          </FieldBlock>
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard title="제출 전 확인" description="구조화된 신청서를 제출하면 읽기 전용으로 전환됩니다.">
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} disabled={readOnly} className="mt-1 h-4 w-4 rounded border-gray-300" />
            <span>작성한 내용과 첨부 증빙이 사실과 다름없음을 확인했으며, 허위 신청 시 운영 정책에 따라 처리될 수 있음을 이해했습니다.</span>
          </label>
        </SectionCard>

        <SectionCard title="현재 신청 상태" description="신청자는 상태에 따라 수정, 재제출, 철회 가능 여부가 달라집니다.">
          <div className="space-y-3">
            <MiniCard label="현재 상태" value={STATUS_LABELS[viewModel.case.status]} />
            <MiniCard label="보완 요청 여부" value={viewModel.case.status === 'INFO_REQUESTED' ? '보완 필요' : '없음'} />
            <MiniCard label="수정 가능" value={viewModel.case.canEdit ? '가능' : '읽기 전용'} />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function AppealAttachmentsSection({
  viewModel,
  attachments,
  onUpload,
  onDelete,
}: {
  viewModel: AppealViewModel
  attachments: DraftAttachment[]
  onUpload: (fileList: FileList | null) => void
  onDelete: (id: string) => void
}) {
  const canDelete = viewModel.case.status === 'DRAFT' || viewModel.case.status === 'INFO_REQUESTED'

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <SectionCard title="첨부된 증빙 자료" description="KPI 근거, 체크인 메모, 피드백 자료, 기타 파일을 함께 관리합니다.">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            업로드
            <input type="file" multiple className="hidden" onChange={(event) => onUpload(event.target.files)} />
          </label>
          <div className="text-sm text-slate-500">첨부 수 {attachments.length}개</div>
        </div>

        <div className="space-y-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{attachment.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {attachment.uploadedBy} / {formatDateTime(attachment.uploadedAt)}
                    {attachment.sizeLabel ? ` / ${attachment.sizeLabel}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <KindBadge kind={attachment.kind} />
                  <button type="button" className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
                    다운로드
                  </button>
                  {canDelete ? (
                    <button type="button" onClick={() => onDelete(attachment.id)} className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700">
                      삭제
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="첨부 제한 안내" description="안정적인 검토를 위해 파일 종류와 크기 제한을 안내합니다.">
        <div className="space-y-3 text-sm text-slate-600">
          <InfoNotice icon={<FileCheck2 className="h-4 w-4" />} title="허용 형식" description="PDF, XLSX, DOCX, PNG, JPG 형식을 권장합니다." />
          <InfoNotice icon={<AlertCircle className="h-4 w-4" />} title="권장 크기" description="파일당 20MB 이하로 정리해 주세요. 큰 파일은 요약본과 함께 제출하는 것이 좋습니다." />
          <InfoNotice icon={<MessageSquareText className="h-4 w-4" />} title="검토 팁" description="체크인 메모, KPI 실적, 피드백 캡처처럼 평가 결과에 직접 연결되는 순서로 정리하면 검토가 빨라집니다." />
        </div>
      </SectionCard>
    </div>
  )
}

function AppealTimelineSection({ viewModel }: { viewModel: AppealViewModel }) {
  return (
    <SectionCard title="처리 이력 / 감사 타임라인" description="케이스 생성부터 최종 결정까지 모든 절차가 순서대로 남습니다.">
      <div className="space-y-4">
        {viewModel.timeline.map((item) => (
          <div key={item.id} className="flex gap-4">
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="font-semibold text-slate-900">{item.action}</div>
                <div className="text-xs text-slate-500">{formatDateTime(item.at)}</div>
              </div>
              <div className="mt-1 text-sm text-slate-500">{item.actor}</div>
              {item.detail ? <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p> : null}
              {(item.fromStatus || item.toStatus) ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {item.fromStatus ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{item.fromStatus}</span> : null}
                  {item.toStatus ? <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{item.toStatus}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function AppealDecisionSection({
  viewModel,
  decisionNote,
  setDecisionNote,
  resolutionType,
  setResolutionType,
  onAdminAction,
  submitting,
}: {
  viewModel: AppealViewModel
  decisionNote: string
  setDecisionNote: (value: string) => void
  resolutionType: string
  setResolutionType: (value: string) => void
  onAdminAction: (action: 'start_review' | 'request_info' | 'resolve' | 'reject') => void
  submitting: boolean
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="결정 내용" description="신청자는 읽기 전용으로, 운영자는 결정 입력 패널로 확인할 수 있습니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <MiniCard label="결정 상태" value={viewModel.decision?.status === 'REJECTED' ? '기각' : viewModel.decision?.status === 'RESOLVED' ? '처리 완료' : '결정 전'} />
          <MiniCard label="결정일" value={formatDateTime(viewModel.decision?.decidedAt)} />
          <MiniCard label="결정자" value={viewModel.decision?.decidedBy ?? '미정'} />
          <MiniCard label="결과 반영 여부" value={viewModel.decision?.status === 'RESOLVED' ? '반영됨 또는 설명 완료' : '미반영'} />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {viewModel.decision?.note ?? viewModel.case.resolutionNote ?? '아직 결정 내용이 등록되지 않았습니다.'}
        </div>

        {viewModel.decision?.scoreChanged || viewModel.decision?.gradeChanged ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MiniCard label="점수 변경" value={`${viewModel.decision.beforeScore ?? '-'} → ${viewModel.decision.afterScore ?? '-'}`} />
            <MiniCard label="등급 변경" value={`${viewModel.decision.beforeGrade ?? '-'} → ${viewModel.decision.afterGrade ?? '-'}`} />
          </div>
        ) : null}

        <div className="mt-5">
          <Link href="/evaluation/results" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            평가 결과 다시 보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </SectionCard>

      <SectionCard title={viewModel.actorMode === 'admin' ? '운영자 결정 입력' : '후속 액션'} description={viewModel.actorMode === 'admin' ? '보완 요청, 검토 시작, 처리 완료/기각을 여기서 관리합니다.' : '결정 확인 후 필요한 다음 행동을 이어서 진행하세요.'}>
        {viewModel.actorMode === 'admin' ? (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">결정 유형</span>
              <select value={resolutionType} onChange={(event) => setResolutionType(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm">
                <option value="재검토 반영">재검토 반영</option>
                <option value="설명 완료">설명 완료</option>
                <option value="기각">기각</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">결정 사유 / 내부 메모</span>
              <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} className="min-h-40 w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm" placeholder="운영자 판단 근거와 결정 사유를 남겨 주세요." />
            </label>
            <div className="grid gap-3">
              <ActionButton icon={<FolderOpen className="h-4 w-4" />} label="검토 시작" onClick={() => onAdminAction('start_review')} disabled={submitting} />
              <ActionButton icon={<MessageSquareText className="h-4 w-4" />} label="보완 요청" onClick={() => onAdminAction('request_info')} disabled={submitting} />
              <ActionButton icon={<Gavel className="h-4 w-4" />} label="처리 완료" onClick={() => onAdminAction('resolve')} disabled={submitting} variant="primary" />
              <ActionButton icon={<ShieldAlert className="h-4 w-4" />} label="기각" onClick={() => onAdminAction('reject')} disabled={submitting} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <InfoNotice icon={<FileSearch className="h-4 w-4" />} title="결정 내용 확인" description="처리 완료 또는 기각 시 결정 사유와 후속 조치를 여기에서 확인하세요." />
            <InfoNotice icon={<Layers3 className="h-4 w-4" />} title="평가 결과 다시 확인" description="결정 이후에는 평가 결과 화면에서 반영 여부를 다시 확인하는 것이 좋습니다." />
            <InfoNotice icon={<MessageSquareText className="h-4 w-4" />} title="AI 보조 작성 연계" description="다음 반기 성장 계획이나 커뮤니케이션 문안은 AI 보조 작성 화면에서 이어서 정리할 수 있습니다." />
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function AppealPolicySection({ viewModel }: { viewModel: AppealViewModel }) {
  const faqs = [
    {
      question: '이의 신청 가능 기간은 언제인가요?',
      answer: viewModel.cycle.appealDeadline
        ? `현재 주기 기준 마감일은 ${formatDateTime(viewModel.cycle.appealDeadline)}입니다. 마감 이후에는 신규 제출이 제한됩니다.`
        : '현재 운영 중인 주기의 정책에 따라 공지된 기간 내에서만 신청할 수 있습니다.',
    },
    {
      question: '어떤 경우에 보완 요청이 발생하나요?',
      answer: '사유가 구체적이지 않거나, 관련 항목과 증빙이 충분히 연결되지 않은 경우 보완 요청이 발생할 수 있습니다.',
    },
    {
      question: '결정 후 평가 결과는 어떻게 반영되나요?',
      answer: '재검토가 수용되면 평가 결과와 후속 보상/기록 화면에 반영될 수 있으며, 설명 완료나 기각인 경우 결정 사유가 기록됩니다.',
    },
  ]

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="이의 신청 정책 안내" description="제출 전 반드시 확인해야 할 기간, 기준, 절차를 정리했습니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <PolicyCard title="이의 신청 가능 기간" description={viewModel.cycle.appealDeadline ? `마감일: ${formatDateTime(viewModel.cycle.appealDeadline)}` : '별도 공지된 운영 기간 내 신청'} />
          <PolicyCard title="처리 기준" description="평가 근거, 절차 적정성, 코멘트 타당성, 캘리브레이션 반영 여부를 중심으로 검토합니다." />
          <PolicyCard title="제출 시 유의사항" description="감정적 표현보다 구체적인 사실, 시점, 근거 자료를 중심으로 작성해야 빠른 검토가 가능합니다." />
          <PolicyCard title="결과 반영 원칙" description="결정 후 결과가 변경되면 관련 평가 결과와 연계 화면에도 같은 기준으로 반영됩니다." />
        </div>
      </SectionCard>

      <SectionCard title="FAQ" description="자주 묻는 질문을 먼저 확인하면 작성 시간을 줄일 수 있습니다.">
        <div className="space-y-3">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer list-none font-semibold text-slate-900">{faq.question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  )
}

function SelectorCard({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{description}</div>
    </div>
  )
}

function NextActionCard({
  label,
  description,
  attachmentsCount,
  href,
}: {
  label: string
  description: string
  attachmentsCount: number
  href?: string
}) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-blue-800">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-semibold">다음 행동</span>
      </div>
      <div className="mt-3 text-lg font-semibold text-blue-900">{label}</div>
      <p className="mt-2 text-sm leading-6 text-blue-900/80">{description}</p>
      <div className="mt-3 text-sm text-blue-800">첨부 {attachmentsCount}개</div>
      {href ? (
        <div className="mt-4">
          <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            바로 이동
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function HeroMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${emphasis ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-2 text-xl font-bold ${emphasis ? 'text-blue-900' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{label}</div>
      {children}
    </div>
  )
}

function ChipButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
      } disabled:opacity-50`}
    >
      {children}
    </button>
  )
}

function KindBadge({ kind }: { kind: DraftAttachment['kind'] }) {
  const label =
    kind === 'KPI' ? 'KPI 근거' : kind === 'CHECKIN' ? '체크인/1:1 기록' : kind === 'FEEDBACK' ? '피드백/메모' : '기타 파일'
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span>
}

function StatusBadge({ status }: { status: AppealCaseStatus }) {
  const className =
    status === 'DRAFT'
      ? 'bg-slate-100 text-slate-700'
      : status === 'SUBMITTED'
        ? 'bg-blue-100 text-blue-700'
        : status === 'UNDER_REVIEW'
          ? 'bg-violet-100 text-violet-700'
          : status === 'INFO_REQUESTED'
            ? 'bg-amber-100 text-amber-800'
            : status === 'RESOLVED'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'REJECTED'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-200 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{STATUS_LABELS[status]}</span>
}

function InfoBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span>
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:opacity-60 ${
        variant === 'primary'
          ? 'bg-slate-900 text-white hover:bg-slate-800'
          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function ActionLink({
  icon,
  label,
  href,
  description,
}: {
  icon: ReactNode
  label: string
  href: string
  description: string
}) {
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {label}
        <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </Link>
  )
}

function InfoNotice({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function PolicyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function AppealStatePanel({
  state,
  message,
}: {
  state: EvaluationAppealClientProps['state']
  message?: string
}) {
  const config =
    state === 'hidden'
      ? { title: '현재는 이의 신청 기간이 아닙니다', tone: 'amber' }
      : state === 'permission-denied'
        ? { title: '이 케이스를 확인할 권한이 없습니다', tone: 'rose' }
        : state === 'error'
          ? { title: '이의 신청 화면을 불러오지 못했습니다', tone: 'rose' }
          : { title: '표시할 이의 신청 케이스가 없습니다', tone: 'slate' }

  const toneClass =
    config.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : config.tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <section className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}>
      <div className="text-lg font-semibold">{config.title}</div>
      <p className="mt-2 text-sm leading-6">{message || '현재 상태를 다시 확인해 주세요.'}</p>
    </section>
  )
}

function RelatedLinks() {
  const links = [
    { href: '/evaluation/results', label: '평가 결과' },
    { href: '/evaluation/assistant', label: 'AI 보조 작성' },
    { href: '/kpi/monthly', label: '월간 실적' },
    { href: '/checkin', label: '체크인' },
    { href: '/notifications', label: '알림' },
  ]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-lg font-semibold text-slate-900">관련 화면 바로가기</div>
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function safeParseDraft(value: string): {
  category: string
  reason: string
  requestedAction: string
  relatedTargets: string[]
  attachments: DraftAttachment[]
} | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function assertJsonSuccess(response: Response) {
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error?.message || '요청 처리 중 오류가 발생했습니다.')
  }
  return json.data
}

function inferAttachmentKind(name: string): DraftAttachment['kind'] {
  const lower = name.toLowerCase()
  if (lower.includes('kpi')) return 'KPI'
  if (lower.includes('check') || lower.includes('1on1')) return 'CHECKIN'
  if (lower.includes('feedback') || lower.includes('memo')) return 'FEEDBACK'
  return 'OTHER'
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDateTime(value?: string) {
  if (!value) return '미정'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

  async function handleWithdraw() {
    if (!viewModel?.case.id) return

    setIsSubmitting(true)
    try {
      await fetch(`/api/appeals/${viewModel.case.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      }).then(assertJsonSuccess)
      clearDraft()
      setNotice('이의 신청을 철회했습니다.')
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '철회 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAdminAction(action: 'start_review' | 'request_info' | 'resolve' | 'reject') {
    if (!viewModel?.case.id) return

    setIsSubmitting(true)
    try {
      await fetch(`/api/appeals/${viewModel.case.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: decisionNote,
          resolutionType,
          beforeScore: viewModel.resultSummary.totalScore,
          afterScore: viewModel.resultSummary.totalScore,
          beforeGrade: viewModel.resultSummary.finalGrade,
          afterGrade: viewModel.resultSummary.finalGrade,
        }),
      }).then(assertJsonSuccess)
      setNotice(
        action === 'start_review'
          ? '검토가 시작되었습니다.'
          : action === 'request_info'
            ? '보완 요청이 등록되었습니다.'
            : action === 'resolve'
              ? '처리 완료로 저장되었습니다.'
              : '기각 처리되었습니다.'
      )
      router.refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '상태 변경 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleYearChange(year: number) {
    const nextCycle = cycleOptions.find((cycle) => cycle.year === year)
    if (!nextCycle) return
    router.push(`/evaluation/appeal?cycleId=${encodeURIComponent(nextCycle.id)}`)
  }

  function handleCycleChange(cycleId: string) {
    router.push(`/evaluation/appeal?cycleId=${encodeURIComponent(cycleId)}`)
  }

  function handleCaseChange(caseId: string) {
    if (!viewModel) return
    router.push(
      `/evaluation/appeal?cycleId=${encodeURIComponent(viewModel.cycle.id)}&caseId=${encodeURIComponent(caseId)}`
    )
  }

  function handleAttachmentUpload(fileList: FileList | null) {
    if (!fileList || !viewModel?.case.canEdit) return
    const next = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      kind: inferAttachmentKind(file.name),
      uploadedAt: new Date().toISOString(),
      uploadedBy: '나',
      sizeLabel: formatFileSize(file.size),
      persisted: false,
    })) satisfies DraftAttachment[]

    setAttachments((current) => [...current, ...next])
    setNotice(`${next.length}개의 첨부 메타데이터를 추가했습니다.`)
  }

  function handleAttachmentDelete(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id))
  }

  if (props.state !== 'ready' || !viewModel) {
    return (
      <div className="space-y-6">
        <AppealPageHeader selectedCycle={selectedCycle} />
        <AppealStatePanel state={props.state} message={props.message} />
        <RelatedLinks />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AppealPageHeader selectedCycle={selectedCycle} />

      <AppealHero
        viewModel={viewModel}
        availableYears={availableYears}
        onYearChange={handleYearChange}
        onCycleChange={handleCycleChange}
        onCaseChange={handleCaseChange}
        onSaveDraft={persistDraft}
        onSubmit={handleSubmit}
        onWithdraw={handleWithdraw}
        submitting={isSubmitting}
      />

      {notice ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      ) : null}

      <AppealSummaryCards viewModel={viewModel} />
      <AppealTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'form' ? (
        <AppealFormSection
          viewModel={viewModel}
          category={category}
          setCategory={setCategory}
          reason={reason}
          setReason={setReason}
          requestedAction={requestedAction}
          setRequestedAction={setRequestedAction}
          relatedTargets={relatedTargets}
          setRelatedTargets={setRelatedTargets}
          agreed={agreed}
          setAgreed={setAgreed}
        />
      ) : null}

      {activeTab === 'attachments' ? (
        <AppealAttachmentsSection
          viewModel={viewModel}
          attachments={attachments}
          onUpload={handleAttachmentUpload}
          onDelete={handleAttachmentDelete}
        />
      ) : null}

      {activeTab === 'timeline' ? <AppealTimelineSection viewModel={viewModel} /> : null}

      {activeTab === 'decision' ? (
        <AppealDecisionSection
          viewModel={viewModel}
          decisionNote={decisionNote}
          setDecisionNote={setDecisionNote}
          resolutionType={resolutionType}
          setResolutionType={setResolutionType}
          onAdminAction={handleAdminAction}
          submitting={isSubmitting}
        />
      ) : null}

      {activeTab === 'policy' ? <AppealPolicySection viewModel={viewModel} /> : null}
    </div>
  )
}
