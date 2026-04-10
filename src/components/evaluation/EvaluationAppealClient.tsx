'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  FolderClock,
  Gavel,
  Inbox,
  LifeBuoy,
  Paperclip,
  RefreshCcw,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import type { AppealCaseStatus, AppealPageData, AppealViewModel } from '@/server/evaluation-appeal'

type AppealTab = 'form' | 'attachments' | 'timeline' | 'decision' | 'policy'

type DraftAttachment = AppealViewModel['attachments'][number] & {
  dataUrl?: string
}

type DraftSnapshot = {
  category: string
  reason: string
  requestedAction: string
  relatedTargets: string[]
  attachments: DraftAttachment[]
  confirmed: boolean
}

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

type AppealAdminAction = 'start_review' | 'request_info' | 'resolve' | 'reject'
type DisabledState = {
  disabled: boolean
  reason?: string
}

function getDraftSaveState(viewModel: AppealViewModel | undefined, isReady: boolean): DisabledState {
  if (!isReady || !viewModel) {
    return { disabled: true, reason: '이의 신청 화면을 준비 중입니다.' }
  }
  if (viewModel.actorMode === 'admin') {
    return { disabled: true, reason: '운영자는 케이스를 처리만 할 수 있습니다.' }
  }
  if (!viewModel.case.canEdit) {
    return {
      disabled: true,
      reason: viewModel.cycle.appealOpen
        ? '현재 상태에서는 임시저장할 수 없습니다.'
        : '이의 신청 가능 기간이 아니면 초안 저장도 할 수 없습니다.',
    }
  }
  return { disabled: false }
}

function getSubmitState(viewModel: AppealViewModel | undefined, draft: DraftSnapshot | null, isReady: boolean): DisabledState {
  if (!isReady || !viewModel || !draft) {
    return { disabled: true, reason: '이의 신청 화면을 준비 중입니다.' }
  }
  if (viewModel.actorMode === 'admin') {
    return { disabled: true, reason: '운영자는 요청을 제출할 수 없습니다.' }
  }
  if (!viewModel.case.canSubmit) {
    return {
      disabled: true,
      reason: viewModel.cycle.appealOpen
        ? '현재 상태에서는 제출할 수 없습니다.'
        : '이의 신청 가능 기간이 종료되었습니다.',
    }
  }
  if (!draft.reason.trim()) {
    return { disabled: true, reason: '이의 신청 사유를 입력해 주세요.' }
  }
  if (draft.reason.trim().length < 20) {
    return { disabled: true, reason: '이의 신청 사유는 20자 이상 입력해 주세요.' }
  }
  if (!draft.relatedTargets.length) {
    return { disabled: true, reason: '관련 항목을 최소 1개 선택해 주세요.' }
  }
  if (!draft.confirmed) {
    return { disabled: true, reason: '제출 전 확인 체크박스를 선택해 주세요.' }
  }
  return { disabled: false }
}

function getWithdrawState(viewModel: AppealViewModel | undefined, isReady: boolean): DisabledState {
  if (!isReady || !viewModel) {
    return { disabled: true, reason: '이의 신청 화면을 준비 중입니다.' }
  }
  if (viewModel.actorMode === 'admin') {
    return { disabled: true, reason: '운영자는 철회를 실행할 수 없습니다.' }
  }
  if (!viewModel.case.canWithdraw) {
    return { disabled: true, reason: '현재 상태에서는 철회할 수 없습니다.' }
  }
  return { disabled: false }
}

function getAdminActionState(viewModel: AppealViewModel | undefined, action: AppealAdminAction, note: string): DisabledState {
  if (!viewModel || viewModel.actorMode !== 'admin') {
    return { disabled: true, reason: '운영자만 사용할 수 있습니다.' }
  }

  const status = viewModel.case.status
  const noteRequired = action === 'request_info' || action === 'resolve' || action === 'reject'
  if (action === 'start_review' && status !== 'SUBMITTED') {
    return { disabled: true, reason: '제출 상태에서만 검토를 시작할 수 있습니다.' }
  }
  if (action === 'request_info' && !['SUBMITTED', 'UNDER_REVIEW'].includes(status)) {
    return { disabled: true, reason: '제출 또는 검토 중 상태에서만 보완 요청할 수 있습니다.' }
  }
  if ((action === 'resolve' || action === 'reject') && !['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(status)) {
    return { disabled: true, reason: '현재 상태에서는 결정 작업을 할 수 없습니다.' }
  }
  if (noteRequired && note.trim().length < 3) {
    return { disabled: true, reason: '운영 메모를 3자 이상 입력해 주세요.' }
  }
  return { disabled: false }
}

export function EvaluationAppealClient(props: AppealPageData) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AppealTab>('form')
  const [banner, setBanner] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(
    null
  )
  const [busyAction, setBusyAction] = useState<
    'save-draft' | 'submit' | 'withdraw' | 'upload' | 'admin' | 'download' | null
  >(null)
  const [adminNote, setAdminNote] = useState('')
  const [draft, setDraft] = useState<DraftSnapshot | null>(null)

  const availableCycles = props.availableCycles
  const viewModel = props.viewModel
  const loadAlerts = props.alerts?.length ? <LoadAlerts alerts={props.alerts} /> : null

  useEffect(() => {
    if (!viewModel) {
      setDraft(null)
      return
    }

    setDraft(buildInitialDraft(viewModel))
  }, [viewModel])

  useEffect(() => {
    setActiveTab('form')
    setBanner(null)
    setAdminNote('')
  }, [props.state, props.selectedCycleId, props.selectedCaseId, viewModel?.actorMode])

  const readyContext = props.state === 'ready' && viewModel && draft ? { viewModel, draft } : null
  const isReady = Boolean(readyContext)
  const activeViewModel = readyContext?.viewModel
  const activeDraft = readyContext?.draft
  const isAdmin = activeViewModel?.actorMode === 'admin'
  const canEdit = Boolean(activeViewModel && !isAdmin && activeViewModel.case.canEdit)
  const draftSaveState = getDraftSaveState(activeViewModel, isReady)
  const submitState = getSubmitState(activeViewModel, activeDraft ?? null, isReady)
  const withdrawState = getWithdrawState(activeViewModel, isReady)
  const adminActionStates: Record<AppealAdminAction, DisabledState> = {
    start_review: getAdminActionState(activeViewModel, 'start_review', adminNote),
    request_info: getAdminActionState(activeViewModel, 'request_info', adminNote),
    resolve: getAdminActionState(activeViewModel, 'resolve', adminNote),
    reject: getAdminActionState(activeViewModel, 'reject', adminNote),
  }
  const hasOpenCase = Boolean(
    activeViewModel?.case.id &&
      ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(activeViewModel.case.status)
  )

  function handleCycleChange(nextCycleId: string) {
    router.push(`/evaluation/appeal?cycleId=${encodeURIComponent(nextCycleId)}`)
  }

  function handleCaseChange(nextCaseId: string) {
    if (!props.selectedCycleId) return
    router.push(
      `/evaluation/appeal?cycleId=${encodeURIComponent(props.selectedCycleId)}&caseId=${encodeURIComponent(nextCaseId)}`
    )
  }

  function resetDraftState() {
    if (!activeViewModel) return
    const nextDraft = buildInitialDraft({
      ...activeViewModel,
      case: {
        ...activeViewModel.case,
        id: undefined,
        status: 'DRAFT',
        reason: '',
        resolutionNote: undefined,
      },
      attachments: [],
      decision: undefined,
    })
    setDraft(nextDraft)
    setAdminNote('')
  }

  function handleStartNewAppeal() {
    if (!isReady || !activeViewModel) return
    const readyViewModel = activeViewModel

    if (readyViewModel.actorMode === 'admin') {
      setBanner({
        tone: 'info',
        message: '운영자는 케이스 선택기에서 기존 이의 신청을 확인하고 처리할 수 있습니다.',
      })
      return
    }

    if (hasOpenCase) {
      setBanner({
        tone: 'info',
        message: '현재 진행 중인 이의 신청이 있습니다. 기존 케이스를 먼저 확인해 주세요.',
      })
      return
    }

    resetDraftState()
    router.push(`/evaluation/appeal?cycleId=${encodeURIComponent(readyViewModel.cycle.id)}&caseId=new`)
    setBanner({
      tone: 'success',
      message: '새 이의 신청 초안을 시작했습니다. 사유와 관련 항목을 입력해 주세요.',
    })
  }

  async function handleSaveDraft() {
    if (!isReady || !activeViewModel || !activeDraft) return
    const readyViewModel = activeViewModel
    const readyDraft = activeDraft
    if (draftSaveState.disabled) {
      setBanner({
        tone: 'info',
        message: draftSaveState.reason ?? '현재 상태에서는 임시저장할 수 없습니다.',
      })
      return
    }
    setBusyAction('save-draft')
    try {
      const response = await fetch(
        readyViewModel.case.id ? `/api/appeals/${encodeURIComponent(readyViewModel.case.id)}` : '/api/appeals',
        {
          method: readyViewModel.case.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_draft',
            evaluationId: readyViewModel.resultSummary.resultId,
            reason: readyDraft.reason,
            category: readyDraft.category,
            requestedAction: readyDraft.requestedAction,
            relatedTargets: readyDraft.relatedTargets,
            attachments: readyDraft.attachments,
          }),
        }
      )
      await assertJsonSuccess(response, '임시저장 중 오류가 발생했습니다.')
      setBanner({
        tone: 'success',
        message: '임시저장했습니다. 같은 브라우저에서 이어서 작성할 수 있습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '임시저장 중 오류가 발생했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSubmit() {
    if (!isReady || !activeViewModel || !activeDraft) return
    const readyViewModel = activeViewModel
    const readyDraft = activeDraft

    if (submitState.disabled) {
      setBanner({
        tone: 'error',
        message: submitState.reason ?? '현재 상태에서는 제출할 수 없습니다.',
      })
      return
      setBanner({ tone: 'error', message: '제출 전 확인 체크박스를 선택해 주세요.' })
      return
    }

    if (readyDraft.reason.trim().length < 20) {
      setBanner({ tone: 'error', message: '이의 신청 사유는 20자 이상 입력해 주세요.' })
      return
    }

    setBusyAction('submit')
    try {
      if (readyViewModel.case.id && readyViewModel.case.status === 'INFO_REQUESTED') {
        const response = await fetch(`/api/appeals/${encodeURIComponent(readyViewModel.case.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resubmit',
            reason: readyDraft.reason,
            category: readyDraft.category,
            requestedAction: readyDraft.requestedAction,
            relatedTargets: readyDraft.relatedTargets,
            attachments: readyDraft.attachments,
          }),
        })
        await assertJsonSuccess(response, '이의 신청을 다시 제출하지 못했습니다.')
      } else {
        const response = await fetch('/api/appeals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evaluationId: readyViewModel.resultSummary.resultId,
            reason: readyDraft.reason,
            category: readyDraft.category,
            requestedAction: readyDraft.requestedAction,
            relatedTargets: readyDraft.relatedTargets,
            attachments: readyDraft.attachments,
          }),
        })
        const json = await assertJsonSuccess<{ id: string }>(response, '이의 신청을 제출하지 못했습니다.')
        router.push(
          `/evaluation/appeal?cycleId=${encodeURIComponent(readyViewModel.cycle.id)}&caseId=${encodeURIComponent(
            json.id
          )}`
        )
      }

      setBanner({
        tone: 'success',
        message: readyViewModel.case.status === 'INFO_REQUESTED' ? '보완 후 다시 제출했습니다.' : '이의 신청을 제출했습니다.',
      })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '이의 신청 제출 중 오류가 발생했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleWithdraw() {
    if (!isReady || !activeViewModel?.case.id) return
    const readyViewModel = activeViewModel
    const caseId = readyViewModel.case.id!
    if (withdrawState.disabled) {
      setBanner({
        tone: 'info',
        message: withdrawState.reason ?? '현재 상태에서는 철회할 수 없습니다.',
      })
      return
    }
    setBusyAction('withdraw')
    try {
      const response = await fetch(`/api/appeals/${encodeURIComponent(caseId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      })
      await assertJsonSuccess(response, '이의 신청을 철회하지 못했습니다.')
      setBanner({ tone: 'success', message: '이의 신청을 철회했습니다.' })
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '이의 신청 철회 중 오류가 발생했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAdminAction(action: 'start_review' | 'request_info' | 'resolve' | 'reject') {
    if (!isReady || !activeViewModel?.case.id) return
    const readyViewModel = activeViewModel
    const caseId = readyViewModel.case.id!
    const actionState = adminActionStates[action]
    if (actionState.disabled) {
      setBanner({
        tone: 'error',
        message: actionState.reason ?? '현재 상태에서는 처리 작업을 할 수 없습니다.',
      })
      return
    }

    if (['request_info', 'resolve', 'reject'].includes(action) && adminNote.trim().length < 3) {
      setBanner({ tone: 'error', message: '운영 메모 또는 결정 사유를 3자 이상 입력해 주세요.' })
      return
    }

    setBusyAction('admin')
    try {
      const response = await fetch(`/api/appeals/${encodeURIComponent(caseId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: adminNote.trim(),
          resolutionType: action === 'resolve' ? '재검토 반영' : action === 'reject' ? '기각' : undefined,
          beforeScore: readyViewModel.resultSummary.totalScore,
          beforeGrade: readyViewModel.resultSummary.finalGrade,
        }),
      })

      await assertJsonSuccess(
        response,
        action === 'start_review'
          ? '검토 시작 처리에 실패했습니다.'
          : action === 'request_info'
            ? '보완 요청 처리에 실패했습니다.'
            : action === 'resolve'
              ? '처리 완료 저장에 실패했습니다.'
              : '기각 처리에 실패했습니다.'
      )

      setBanner({
        tone: 'success',
        message:
          action === 'start_review'
            ? '검토를 시작했습니다.'
            : action === 'request_info'
              ? '보완 요청을 저장했습니다.'
              : action === 'resolve'
                ? '처리 완료로 저장했습니다.'
                : '기각 처리했습니다.',
      })
      setAdminNote('')
      router.refresh()
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '이의 신청 처리 중 오류가 발생했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAttachmentUpload(files: FileList | null) {
    if (!isReady || !draft || !files?.length) return

    setBusyAction('upload')
    try {
      const nextAttachments = await Promise.all(
        Array.from(files).map(async (file, index) => ({
          id: `local-${Date.now()}-${index}`,
          name: file.name,
          kind: inferAttachmentKind(file.name),
          uploadedAt: new Date().toISOString(),
          uploadedBy: '신청자',
          sizeLabel: formatFileSize(file.size),
          persisted: false,
          dataUrl: await readFileAsDataUrl(file),
        }))
      )

      setDraft((current) =>
        current
          ? {
              ...current,
              attachments: [...current.attachments, ...nextAttachments],
            }
          : current
      )
      setBanner({ tone: 'success', message: `${nextAttachments.length}개 파일을 첨부했습니다.` })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '첨부 업로드 중 오류가 발생했습니다.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  function handleAttachmentDelete(attachmentId: string) {
    setDraft((current) =>
      current
        ? {
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
          }
        : current
    )
    setBanner({ tone: 'success', message: '첨부 파일을 제거했습니다.' })
  }

  async function handleAttachmentDownload(attachment: DraftAttachment) {
    setBusyAction('download')
    try {
      if (!attachment.dataUrl) {
        setBanner({
          tone: 'info',
          message: '이 첨부는 현재 메타데이터만 연결되어 있습니다. 평가 결과의 근거 자료 탭에서 원본 근거를 확인해 주세요.',
        })
        return
      }

      const anchor = document.createElement('a')
      anchor.href = attachment.dataUrl
      anchor.download = attachment.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setBanner({ tone: 'success', message: `${attachment.name} 파일을 다운로드했습니다.` })
    } finally {
      setBusyAction(null)
    }
  }

  if (!readyContext || !activeViewModel || !activeDraft) {
    return (
      <div className="space-y-6">
        <AppealPageHeader availableCycles={availableCycles} selectedCycleId={props.selectedCycleId} />
        {loadAlerts}
        <StatePanel state={props.state} message={props.message} />
        <RelatedLinks />
      </div>
    )
  }

  const readyViewModel = activeViewModel
  const readyDraft = activeDraft

  return (
    <div className="space-y-6">
      <AppealPageHeader availableCycles={availableCycles} selectedCycleId={props.selectedCycleId} />
      {loadAlerts}

      <AppealHero
        viewModel={readyViewModel}
        availableCycles={availableCycles}
        selectedCycleId={props.selectedCycleId}
        selectedCaseId={props.selectedCaseId}
        onCycleChange={handleCycleChange}
        onCaseChange={handleCaseChange}
        onStartNew={handleStartNewAppeal}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        onWithdraw={handleWithdraw}
        busyAction={busyAction}
        canStartNew={!isAdmin && readyViewModel.cycle.appealOpen && !hasOpenCase}
        draftSaveState={draftSaveState}
        submitState={submitState}
        withdrawState={withdrawState}
      />

      {banner ? <Banner tone={banner.tone} message={banner.message} /> : null}

      <AppealSummaryCards
        viewModel={readyViewModel}
        attachmentCount={readyDraft.attachments.length}
        nextActionLabel={
          readyViewModel.case.status === 'INFO_REQUESTED'
            ? '신청 내용 보완하기'
            : readyViewModel.case.status === 'RESOLVED' || readyViewModel.case.status === 'REJECTED'
              ? '결정 내용 확인하기'
              : '평가 결과로 돌아가기'
        }
      />

      <AppealTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'form' ? (
        <AppealFormSection viewModel={readyViewModel} draft={readyDraft} setDraft={setDraft} readOnly={!canEdit} />
      ) : null}
      {activeTab === 'attachments' ? (
        <AppealAttachmentsSection
          attachments={readyDraft.attachments}
          canEdit={canEdit}
          busy={busyAction === 'upload' || busyAction === 'download'}
          onUpload={handleAttachmentUpload}
          onDelete={handleAttachmentDelete}
          onDownload={handleAttachmentDownload}
        />
      ) : null}
      {activeTab === 'timeline' ? <AppealTimelineSection viewModel={readyViewModel} /> : null}
      {activeTab === 'decision' ? (
        <AppealDecisionSection
          viewModel={readyViewModel}
          adminNote={adminNote}
          onAdminNoteChange={setAdminNote}
          onAdminAction={handleAdminAction}
          busy={busyAction === 'admin'}
          actionStates={adminActionStates}
        />
      ) : null}
      {activeTab === 'policy' ? <AppealPolicySection viewModel={readyViewModel} /> : null}

      <RelatedLinks />
    </div>
  )
}

function AppealPageHeader({
  availableCycles,
  selectedCycleId,
}: {
  availableCycles: AppealPageData['availableCycles']
  selectedCycleId?: string
}) {
  const selectedCycle = availableCycles.find((cycle) => cycle.id === selectedCycleId) ?? availableCycles[0]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
            Appeal Case Management
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">이의 신청</h1>
          <p className="mt-2 text-sm text-slate-500">
            평가 결과 확인부터 이의 사유 작성, 처리 상태 추적, 결정 확인까지 한 화면에서 관리합니다.
          </p>
        </div>
        {selectedCycle ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            현재 평가 주기: <span className="font-semibold text-slate-900">{selectedCycle.name}</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function AppealHero({
  viewModel,
  availableCycles,
  selectedCycleId,
  selectedCaseId,
  onCycleChange,
  onCaseChange,
  onStartNew,
  onSaveDraft,
  onSubmit,
  onWithdraw,
  busyAction,
  canStartNew,
  draftSaveState,
  submitState,
  withdrawState,
}: {
  viewModel: AppealViewModel
  availableCycles: AppealPageData['availableCycles']
  selectedCycleId?: string
  selectedCaseId?: string
  onCycleChange: (cycleId: string) => void
  onCaseChange: (caseId: string) => void
  onStartNew: () => void
  onSaveDraft: () => void
  onSubmit: () => void
  onWithdraw: () => void
  busyAction: 'save-draft' | 'submit' | 'withdraw' | 'upload' | 'admin' | 'download' | null
  canStartNew: boolean
  draftSaveState: DisabledState
  submitState: DisabledState
  withdrawState: DisabledState
}) {
  const statusTone =
    viewModel.case.status === 'RESOLVED'
      ? 'success'
      : viewModel.case.status === 'REJECTED'
        ? 'error'
        : viewModel.case.status === 'INFO_REQUESTED'
          ? 'warning'
          : 'neutral'

  return (
    <section className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_45%,#f9fafb_100%)] p-6 shadow-sm lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectorCard
              label="평가 주기"
              value={selectedCycleId ?? ''}
              options={availableCycles.map((cycle) => ({
                value: cycle.id,
                label: `${cycle.year} · ${cycle.name}`,
              }))}
              onChange={onCycleChange}
            />
            {viewModel.caseOptions?.length ? (
              <SelectorCard
                label={viewModel.actorMode === 'admin' ? '케이스 선택' : '내 이의 신청'}
                value={selectedCaseId ?? viewModel.case.id ?? ''}
                options={viewModel.caseOptions.map((option) => ({
                  value: option.id,
                  label: `${option.caseNumber} · ${option.label}`,
                }))}
                onChange={onCaseChange}
              />
            ) : (
              <SelectorCard
                label="접수번호"
                value={viewModel.case.caseNumber}
                options={[{ value: viewModel.case.caseNumber, label: viewModel.case.caseNumber }]}
                onChange={() => undefined}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={viewModel.case.status} tone={statusTone} />
            <InfoPill label={`접수번호 ${viewModel.case.caseNumber}`} />
            <InfoPill label={`처리기한 ${formatDateTime(viewModel.case.slaDueAt)}`} />
            <InfoPill
              label={
                viewModel.cycle.appealDeadline
                  ? `신청 가능 기간 ${formatDateTime(viewModel.cycle.appealDeadline)} 까지`
                  : '신청 가능 기간 별도 마감 없음'
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="최종 등급" value={viewModel.resultSummary.finalGrade} />
            <HeroMetric label="총점" value={`${viewModel.resultSummary.totalScore.toFixed(1)}점`} />
            <HeroMetric label="현재 상태" value={STATUS_LABELS[viewModel.case.status]} />
            <HeroMetric label="예상 SLA" value={formatDateTime(viewModel.case.slaDueAt)} />
          </div>

          {viewModel.queueSummary ? (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 md:grid-cols-3">
              <MetaLine label="열린 케이스" value={`${viewModel.queueSummary.openCount}건`} />
              <MetaLine label="보완 요청" value={`${viewModel.queueSummary.infoRequestedCount}건`} />
              <MetaLine label="SLA 초과" value={`${viewModel.queueSummary.overdueCount}건`} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {viewModel.actorMode === 'applicant' ? (
            <>
          <ActionButton
            icon={<FilePlus2 className="h-4 w-4" />}
            label="새 이의 신청"
            onClick={onStartNew}
            disabled={busyAction !== null || !canStartNew}
            title={
              canStartNew
                ? undefined
                : String(viewModel.actorMode) === 'admin'
                  ? '운영자는 케이스를 검토하고 처리만 할 수 있습니다.'
                  : viewModel.cycle.appealOpen
                    ? '이미 제출된 이의 신청 또는 처리 중인 케이스가 있습니다.'
                    : '이의 신청 가능 기간이 아니면 새로 시작할 수 없습니다.'
            }
          />
          <ActionButton
            icon={<FolderClock className="h-4 w-4" />}
            label={busyAction === 'save-draft' ? '임시저장 중...' : '임시저장'}
            onClick={onSaveDraft}
            disabled={busyAction !== null || draftSaveState.disabled}
            title={draftSaveState.reason}
          />
          <ActionButton
            icon={<Send className="h-4 w-4" />}
            label={busyAction === 'submit' ? '제출 중...' : '제출'}
            onClick={onSubmit}
            disabled={busyAction !== null || submitState.disabled}
            title={submitState.reason}
          />
          <ActionButton
            icon={<XCircle className="h-4 w-4" />}
            label={busyAction === 'withdraw' ? '철회 중...' : '철회'}
            onClick={onWithdraw}
            disabled={busyAction !== null || withdrawState.disabled}
            title={withdrawState.reason}
          />
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              운영자는 케이스를 선택한 뒤 처리 이력과 결정 탭에서 검토, 보완 요청, 처리 완료를 진행합니다.
            </div>
          )}
          <ActionLink
            icon={<ClipboardCheck className="h-4 w-4" />}
            label="결과 보기"
            href={`/evaluation/results?cycleId=${encodeURIComponent(viewModel.cycle.id)}`}
            description="평가 결과 화면으로 돌아가 점수와 근거를 다시 확인합니다."
          />
        </div>
      </div>
    </section>
  )
}

function AppealSummaryCards({
  viewModel,
  attachmentCount,
  nextActionLabel,
}: {
  viewModel: AppealViewModel
  attachmentCount: number
  nextActionLabel: string
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        icon={<Gavel className="h-5 w-5" />}
        label="연결된 평가 결과"
        value={`${viewModel.resultSummary.finalGrade} / ${viewModel.resultSummary.totalScore.toFixed(1)}점`}
        description={`평가자 ${viewModel.resultSummary.evaluatorName ?? '미지정'}`}
      />
      <SummaryCard
        icon={<CalendarClock className="h-5 w-5" />}
        label="현재 상태"
        value={STATUS_LABELS[viewModel.case.status]}
        description={`접수일 ${formatDateTime(viewModel.case.createdAt)}`}
      />
      <SummaryCard
        icon={<Paperclip className="h-5 w-5" />}
        label="첨부 수"
        value={`${attachmentCount}개`}
        description={`최근 업데이트 ${formatDateTime(viewModel.case.updatedAt)}`}
      />
      <SummaryCard
        icon={<ArrowRight className="h-5 w-5" />}
        label="다음 행동"
        value={nextActionLabel}
        description={
          viewModel.case.status === 'INFO_REQUESTED'
            ? '보완 요청 내용을 확인하고 다시 제출하세요.'
            : viewModel.case.status === 'RESOLVED' || viewModel.case.status === 'REJECTED'
              ? '결정 사유와 결과 반영 여부를 확인하세요.'
              : '처리 상태와 일정을 계속 확인하세요.'
        }
      />
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
  draft,
  setDraft,
  readOnly,
}: {
  viewModel: AppealViewModel
  draft: DraftSnapshot
  setDraft: React.Dispatch<React.SetStateAction<DraftSnapshot | null>>
  readOnly: boolean
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <SectionCard title="대상 평가 결과 요약" description="이의 신청은 현재 선택된 평가 결과를 기준으로 작성됩니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <InfoGridCard label="평가 주기" value={`${viewModel.cycle.year} · ${viewModel.cycle.name}`} />
          <InfoGridCard label="최종 등급" value={viewModel.resultSummary.finalGrade} />
          <InfoGridCard label="총점" value={`${viewModel.resultSummary.totalScore.toFixed(1)}점`} />
          <InfoGridCard
            label="평가자 / 공개일"
            value={`${viewModel.resultSummary.evaluatorName ?? '미지정'} / ${formatDateTime(viewModel.resultSummary.publishedAt)}`}
          />
        </div>

        {viewModel.case.resolutionNote ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            최근 운영 메모: {viewModel.case.resolutionNote}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5">
          <FormField label="이의 유형">
            <OptionGrid
              options={CATEGORY_OPTIONS}
              value={draft.category}
              onChange={(value) => setDraftField(setDraft, 'category', value)}
              disabled={readOnly}
            />
          </FormField>

          <FormField label="신청 사유">
            <textarea
              value={draft.reason}
              onChange={(event) => setDraftField(setDraft, 'reason', event.target.value)}
              disabled={readOnly}
              rows={6}
              className="min-h-[150px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              placeholder="왜 이의 신청하는지, 어떤 부분을 다시 확인받고 싶은지 구체적으로 작성해 주세요."
            />
          </FormField>

          <FormField label="기대하는 조치">
            <OptionGrid
              options={REQUESTED_ACTIONS}
              value={draft.requestedAction}
              onChange={(value) => setDraftField(setDraft, 'requestedAction', value)}
              disabled={readOnly}
            />
          </FormField>

          <FormField label="관련 항목 선택">
            <MultiOptionGrid
              options={RELATED_TARGET_OPTIONS}
              values={draft.relatedTargets}
              onToggle={(value) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        relatedTargets: current.relatedTargets.includes(value)
                          ? current.relatedTargets.filter((item) => item !== value)
                          : [...current.relatedTargets, value],
                      }
                    : current
                )
              }
              disabled={readOnly}
            />
          </FormField>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.confirmed}
              onChange={(event) => setDraftField(setDraft, 'confirmed', event.target.checked)}
              disabled={readOnly}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            <span>
              이의 신청 내용은 사실에 기반하며, 제출 후 운영자 검토가 시작되면 수정이 제한될 수 있음을 확인했습니다.
            </span>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="처리 상태 메모" description="현재 상태와 운영자 메모, 읽기 전용 정보를 함께 보여줍니다.">
        <div className="space-y-4">
          <InfoGridCard label="현재 상태" value={STATUS_LABELS[viewModel.case.status]} />
          <InfoGridCard label="처리 기한" value={formatDateTime(viewModel.case.slaDueAt)} />
          <InfoGridCard
            label="담당자"
            value={viewModel.case.assignedTo?.name ?? (viewModel.actorMode === 'admin' ? '내가 처리 중' : '배정 대기')}
          />
          <InfoGridCard
            label="캘리브레이션 반영 여부"
            value={viewModel.resultSummary.calibrationAdjusted ? '반영됨' : '없음'}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {readOnly
              ? '제출된 신청서는 읽기 전용으로 전환됩니다. 처리 이력과 결정 내용을 함께 확인하세요.'
              : '사유와 관련 항목을 충분히 작성한 뒤 제출하세요. 보완 요청 상태에서는 다시 수정할 수 있습니다.'}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function AppealAttachmentsSection({
  attachments,
  canEdit,
  busy,
  onUpload,
  onDelete,
  onDownload,
}: {
  attachments: DraftAttachment[]
  canEdit: boolean
  busy: boolean
  onUpload: (files: FileList | null) => void
  onDelete: (attachmentId: string) => void
  onDownload: (attachment: DraftAttachment) => void
}) {
  return (
    <SectionCard title="첨부 / 증빙" description="근거 자료를 함께 첨부하면 운영자가 더 빠르게 검토할 수 있습니다.">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-500">파일 형식: PDF, 이미지, 문서 / 권장 용량: 10MB 이하</div>
        <label
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold ${
            canEdit ? 'cursor-pointer border-slate-300 text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 text-slate-400'
          }`}
        >
          <Paperclip className="h-4 w-4" />
          {busy ? '업로드 중...' : '업로드'}
          <input
            type="file"
            multiple
            disabled={!canEdit || busy}
            className="hidden"
            onChange={(event) => onUpload(event.target.files)}
          />
        </label>
      </div>

      <div className="space-y-3">
        {attachments.length ? (
          attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{attachment.name}</span>
                  <InfoPill label={attachment.kind} />
                  {attachment.sizeLabel ? <InfoPill label={attachment.sizeLabel} /> : null}
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {attachment.uploadedBy} · {formatDateTime(attachment.uploadedAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onDownload(attachment)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  다운로드
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onDelete(attachment.id)}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyCard
            icon={<Inbox className="h-5 w-5" />}
            title="첨부된 증빙이 없습니다."
            description="KPI 근거, 체크인 메모, 피드백 캡처 등을 첨부하면 이의 신청 검토 품질이 올라갑니다."
          />
        )}
      </div>
    </SectionCard>
  )
}

function AppealTimelineSection({ viewModel }: { viewModel: AppealViewModel }) {
  return (
    <SectionCard title="처리 이력" description="생성부터 제출, 보완 요청, 처리 완료까지의 흐름을 시간순으로 확인합니다.">
      <div className="space-y-4">
        {viewModel.timeline.length ? (
          viewModel.timeline.map((entry, index) => (
            <div key={entry.id} className="flex gap-4">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                {index + 1}
              </div>
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold text-slate-900">{entry.action}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(entry.at)}</div>
                </div>
                <div className="mt-1 text-sm text-slate-500">{entry.actor}</div>
                {entry.detail ? <p className="mt-2 text-sm leading-6 text-slate-700">{entry.detail}</p> : null}
                {entry.fromStatus || entry.toStatus ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {entry.fromStatus ? <InfoPill label={`이전 ${entry.fromStatus}`} /> : null}
                    {entry.toStatus ? <InfoPill label={`이후 ${entry.toStatus}`} /> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <EmptyCard
            icon={<FolderClock className="h-5 w-5" />}
            title="아직 처리 이력이 없습니다."
            description="신청서를 제출하면 생성/제출 이력이 기록됩니다."
          />
        )}
      </div>
    </SectionCard>
  )
}

function AppealDecisionSection({
  viewModel,
  adminNote,
  onAdminNoteChange,
  onAdminAction,
  busy,
  actionStates,
}: {
  viewModel: AppealViewModel
  adminNote: string
  onAdminNoteChange: (value: string) => void
  onAdminAction: (action: 'start_review' | 'request_info' | 'resolve' | 'reject') => void
  busy: boolean
  actionStates: Record<AppealAdminAction, DisabledState>
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SectionCard title="결정 내용" description="신청자에게는 읽기 전용 결과를, 운영자에게는 실제 처리 패널을 제공합니다.">
        {viewModel.decision ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoGridCard label="결정 상태" value={viewModel.decision.status === 'RESOLVED' ? '처리 완료' : '기각'} />
              <InfoGridCard label="결정자" value={viewModel.decision.decidedBy ?? '미기록'} />
              <InfoGridCard label="결정일" value={formatDateTime(viewModel.decision.decidedAt)} />
              <InfoGridCard label="결과 반영" value={viewModel.decision.scoreChanged || viewModel.decision.gradeChanged ? '변경 있음' : '변경 없음'} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {viewModel.decision.note || '결정 메모가 없습니다.'}
            </div>
            {(viewModel.decision.beforeScore !== undefined || viewModel.decision.beforeGrade) && (
              <div className="grid gap-4 md:grid-cols-2">
                <CompareCard
                  title="조정 전"
                  lines={[
                    `점수 ${viewModel.decision.beforeScore?.toFixed(1) ?? '-'}`,
                    `등급 ${viewModel.decision.beforeGrade ?? '-'}`,
                  ]}
                />
                <CompareCard
                  title="조정 후"
                  lines={[
                    `점수 ${viewModel.decision.afterScore?.toFixed(1) ?? viewModel.decision.beforeScore?.toFixed(1) ?? '-'}`,
                    `등급 ${viewModel.decision.afterGrade ?? viewModel.decision.beforeGrade ?? '-'}`,
                  ]}
                />
              </div>
            )}
            <ActionLink
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="평가 결과 다시 보기"
              href={`/evaluation/results?cycleId=${encodeURIComponent(viewModel.cycle.id)}`}
              description="결정 반영 여부를 결과 화면에서 다시 확인합니다."
            />
          </div>
        ) : (
          <EmptyCard
            icon={<AlertCircle className="h-5 w-5" />}
            title="아직 결정된 내용이 없습니다."
            description="운영자가 검토를 완료하면 결정 사유와 결과 반영 여부가 여기에 표시됩니다."
          />
        )}
      </SectionCard>

      <SectionCard
        title={viewModel.actorMode === 'admin' ? '운영자 처리 패널' : '후속 안내'}
        description={
          viewModel.actorMode === 'admin'
            ? '상태 변경, 보완 요청, 처리 완료/기각을 이 패널에서 수행합니다.'
            : '현재 상태에 맞는 후속 행동을 확인하세요.'
        }
      >
        {viewModel.actorMode === 'admin' ? (
          <div className="space-y-4">
            <textarea
              value={adminNote}
              onChange={(event) => onAdminNoteChange(event.target.value)}
              rows={6}
              className="min-h-[150px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              placeholder="보완 요청 사유 또는 결정 메모를 입력해 주세요."
            />
            <div className="grid gap-2">
              <ActionButton
                icon={<RefreshCcw className="h-4 w-4" />}
                label={busy ? '처리 중...' : '검토 시작'}
                onClick={() => onAdminAction('start_review')}
                disabled={busy || actionStates.start_review.disabled}
                title={actionStates.start_review.reason}
              />
              <ActionButton
                icon={<ShieldAlert className="h-4 w-4" />}
                label={busy ? '처리 중...' : '보완 요청'}
                onClick={() => onAdminAction('request_info')}
                disabled={busy || actionStates.request_info.disabled}
                title={actionStates.request_info.reason}
              />
              <ActionButton
                icon={<CheckCircle2 className="h-4 w-4" />}
                label={busy ? '처리 중...' : '처리 완료'}
                onClick={() => onAdminAction('resolve')}
                disabled={busy || actionStates.resolve.disabled}
                title={actionStates.resolve.reason}
              />
              <ActionButton
                icon={<XCircle className="h-4 w-4" />}
                label={busy ? '처리 중...' : '기각'}
                onClick={() => onAdminAction('reject')}
                disabled={busy || actionStates.reject.disabled}
                title={actionStates.reject.reason}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 leading-6">
              {viewModel.case.status === 'INFO_REQUESTED'
                ? '보완 요청 상태입니다. 신청서와 첨부를 수정한 뒤 다시 제출해 주세요.'
                : viewModel.case.status === 'RESOLVED' || viewModel.case.status === 'REJECTED'
                  ? '결정 사유를 확인한 뒤 필요하면 평가 결과 화면에서 반영 내용을 다시 확인해 주세요.'
                  : '현재 상태와 처리 이력을 계속 확인해 주세요. SLA가 가까우면 운영자에게 문의할 수 있습니다.'}
            </div>
            <ActionLink
              icon={<LifeBuoy className="h-4 w-4" />}
              label="알림으로 이동"
              href="/notifications"
              description="처리 상태 변경 알림과 후속 안내를 한곳에서 확인합니다."
            />
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function AppealPolicySection({ viewModel }: { viewModel: AppealViewModel }) {
  const faqs = [
    {
      q: '이의 신청은 언제까지 할 수 있나요?',
      a: viewModel.cycle.appealDeadline
        ? `현재 선택된 주기는 ${formatDateTime(viewModel.cycle.appealDeadline)}까지 신청할 수 있습니다.`
        : '현재 주기는 별도 마감일 없이 운영 기준에 따라 마감됩니다.',
    },
    {
      q: '제출 후 수정할 수 있나요?',
      a: '초안 또는 보완 요청 상태에서만 수정할 수 있습니다. 검토 중 상태에서는 읽기 전용으로 전환됩니다.',
    },
    {
      q: '첨부는 어떤 자료를 넣는 것이 좋나요?',
      a: 'KPI 근거, 체크인/1:1 기록, 피드백 메모, 보고서나 산출물 캡처처럼 결과를 설명하는 자료가 좋습니다.',
    },
  ]

  return (
    <SectionCard title="정책 안내" description="신청 가능 기간, 처리 기준, 제출 시 유의사항과 FAQ를 함께 제공합니다.">
      <div className="grid gap-4 md:grid-cols-2">
        <InfoGridCard label="이의 신청 가능 기간" value={viewModel.cycle.appealDeadline ? formatDateTime(viewModel.cycle.appealDeadline) : '별도 마감 없음'} />
        <InfoGridCard label="처리 기준" value="사실 기반 근거, 평가 절차 적합성, 조정 사유 기록" />
        <InfoGridCard label="접수 후 절차" value="접수 → 검토 시작 → 보완 요청 또는 처리 완료" />
        <InfoGridCard label="결과 반영 원칙" value="승인된 경우에만 점수/등급/설명 내용이 반영됩니다." />
      </div>

      <div className="mt-6 space-y-3">
        {faqs.map((item) => (
          <div key={item.q} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">{item.q}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function Banner({ tone, message }: { tone: 'success' | 'error' | 'info'; message: string }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{message}</div>
}

function LoadAlerts(props: {
  alerts: Array<{
    title: string
    description: string
  }>
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">일부 운영 정보를 불러오지 못해 기본 이의 신청 화면으로 표시 중입니다.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
        {props.alerts.map((alert) => (
          <li key={`${alert.title}:${alert.description}`}>
            {alert.title} {alert.description}
          </li>
        ))}
      </ul>
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
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
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

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-900">{label}</div>
      {children}
    </div>
  )
}

function OptionGrid({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[]
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
            value === option
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function MultiOptionGrid({
  options,
  values,
  onToggle,
  disabled,
}: {
  options: string[]
  values: string[]
  onToggle: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {options.map((option) => {
        const selected = values.includes(option)
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(option)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              selected
                ? 'border-blue-300 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function EmptyCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500">
        {icon}
      </div>
      <div className="mt-4 font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
  icon: React.ReactNode
  label: string
  href: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {label}
        <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </Link>
  )
}

function StatusBadge({
  status,
  tone,
}: {
  status: AppealCaseStatus
  tone: 'success' | 'warning' | 'error' | 'neutral'
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : tone === 'error'
          ? 'bg-rose-100 text-rose-700'
          : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{STATUS_LABELS[status]}</span>
}

function InfoPill({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{label}</span>
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

function InfoGridCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function CompareCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  )
}

function StatePanel({ state, message }: { state: AppealPageData['state']; message?: string }) {
  const config =
    state === 'window-closed'
      ? { title: '현재는 이의 신청 가능 기간이 아닙니다.', tone: 'amber' }
      : state === 'no-result-yet'
        ? { title: '이의 신청 대상 평가 결과가 아직 접수되지 않았습니다.', tone: 'slate' }
      : state === 'hidden'
      ? { title: '현재는 이의 신청 가능 기간이 아닙니다.', tone: 'amber' }
      : state === 'permission-denied'
        ? { title: '이 화면을 볼 권한이 없습니다.', tone: 'rose' }
        : state === 'error'
          ? { title: '이의 신청 정보를 불러오지 못했습니다.', tone: 'rose' }
          : { title: '표시할 이의 신청이 없습니다.', tone: 'slate' }

  const toneClass =
    config.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : config.tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-slate-200 bg-slate-50 text-slate-800'

  return (
    <section className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2 text-lg font-semibold">
        <AlertCircle className="h-5 w-5" />
        {config.title}
      </div>
      <p className="mt-2 text-sm leading-6">{message || '현재 상태를 다시 확인해 주세요.'}</p>
    </section>
  )
}

function RelatedLinks() {
  const links = [
    { href: '/evaluation/results', label: '평가 결과' },
    { href: '/evaluation/workbench', label: '평가 보조 작성' },
    { href: '/kpi/monthly', label: '월간 실적' },
    { href: '/checkin', label: '체크인 일정' },
    { href: '/notifications', label: '알림 센터' },
  ]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-lg font-semibold text-slate-900">관련 화면</div>
      <div className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function buildInitialDraft(viewModel: AppealViewModel): DraftSnapshot {
  return {
    category: viewModel.case.category || CATEGORY_OPTIONS[0],
    reason: viewModel.case.reason || '',
    requestedAction: viewModel.case.requestedAction || REQUESTED_ACTIONS[0],
    relatedTargets: viewModel.case.relatedTargets.length ? viewModel.case.relatedTargets : ['최종 등급'],
    attachments: viewModel.attachments.map((attachment) => ({ ...attachment })),
    confirmed: false,
  }
}

function setDraftField<K extends keyof DraftSnapshot>(
  setDraft: React.Dispatch<React.SetStateAction<DraftSnapshot | null>>,
  key: K,
  value: DraftSnapshot[K]
) {
  setDraft((current) => (current ? { ...current, [key]: value } : current))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function safeParseDraft(input: string | null) {
  if (!input) return null
  try {
    const parsed = JSON.parse(input) as DraftSnapshot
    if (!parsed || typeof parsed !== 'object') return null
    return {
      category: typeof parsed.category === 'string' ? parsed.category : CATEGORY_OPTIONS[0],
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      requestedAction:
        typeof parsed.requestedAction === 'string' ? parsed.requestedAction : REQUESTED_ACTIONS[0],
      relatedTargets: Array.isArray(parsed.relatedTargets)
        ? parsed.relatedTargets.filter((item): item is string => typeof item === 'string')
        : ['최종 등급'],
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter((item): item is DraftAttachment => Boolean(item && typeof item === 'object'))
        : [],
      confirmed: Boolean(parsed.confirmed),
    }
  } catch {
    return null
  }
}

async function assertJsonSuccess<T = { id?: string }>(response: Response, fallbackMessage: string) {
  const json = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: { message?: string } }
    | null
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || fallbackMessage)
  }
  return (json.data ?? ({} as T))
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error(`${file.name} 파일을 읽지 못했습니다.`))
    reader.readAsDataURL(file)
  })
}

function inferAttachmentKind(fileName: string): DraftAttachment['kind'] {
  const lowered = fileName.toLowerCase()
  if (lowered.includes('kpi')) return 'KPI'
  if (lowered.includes('checkin') || lowered.includes('1on1')) return 'CHECKIN'
  if (lowered.includes('feedback') || lowered.includes('memo')) return 'FEEDBACK'
  return 'OTHER'
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
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
