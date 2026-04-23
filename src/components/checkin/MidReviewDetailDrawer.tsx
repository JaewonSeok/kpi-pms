'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  LoaderCircle,
  MessageSquareText,
  Save,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import type { CheckinRecordViewModel } from '@/server/checkin-page'

type MidReviewWorkspace = {
  assignmentId: string
  cycle: {
    id: string
    name: string
    reviewType: string
    reviewTypeLabel: string
    workflowMode: string
    workflowModeLabel: string
    scopeTargetKind: string
    scopeTargetKindLabel: string
    status: string
    statusLabel: string
    peopleReviewEnabled: boolean
    expectationTemplateEnabled: boolean
    startsAt?: string
    selfDueAt?: string
    leaderDueAt?: string
    closesAt?: string
  }
  assignment: {
    status: string
    statusLabel: string
    scheduledAt?: string
    completedAt?: string
  }
  target: {
    employee?: {
      id: string
      name: string
      department: string
      position: string
    }
    department?: {
      id: string
      name: string
      leaderName?: string
    }
    manager: {
      id: string
      name: string
      department?: string
    }
  }
  permissions: {
    canView: boolean
    canEditSelf: boolean
    canEditLeader: boolean
    canViewSensitivePeopleReview: boolean
    canUseAi: boolean
  }
  record: {
    memberAchievements?: string
    milestoneReview?: string
    issueRiskSummary?: string
    nextPeriodPlan?: string
    agreedContext?: string
    directionClarity?: 'CLEAR' | 'PARTIAL' | 'UNCLEAR' | null
    directionClarityNote?: string
    leaderSummary?: string
    leaderCoachingMemo?: string
    aiFollowUpQuestions: string[]
    aiCommentSupport?: {
      summary?: string
      draftComment?: string
      warnings?: string[]
    }
    goalReviews: Array<{
      id: string
      orgKpiId?: string
      orgKpiName?: string
      personalKpiId?: string
      personalKpiName?: string
      goalValidityDecision: 'KEEP_GOAL' | 'ADJUST_PRIORITY_OR_METHOD' | 'REVISE_GOAL'
      goalValidityLabel: string
      decisionReason?: string
      priorityAdjustmentMemo?: string
      executionAdjustmentMemo?: string
      expectedState?: string
      successScene?: string
      criteriaExceeds?: string
      criteriaMeets?: string
      criteriaBelow?: string
      revisionRequested: boolean
    }>
    peopleReview?: {
      retentionRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | null
      retentionRiskLabel?: string
      stayInterviewMemo?: string
      reboundGoal?: string
      supportPlan?: string
      coachingPlan?: string
      nextFollowUpAt?: string
    }
    actionItems: Array<{
      id: string
      actionText: string
      ownerId?: string
      ownerName?: string
      dueDate?: string
      status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
    }>
    memberSubmittedAt?: string
    leaderSubmittedAt?: string
  }
  evidence: {
    orgKpis: Array<{
      id: string
      title: string
      department: string
      status: string
    }>
    personalKpis: Array<{
      id: string
      title: string
      weight: number
      linkedOrgKpi?: string
      averageAchievementRate?: number
    }>
    monthlyRecords: Array<{
      month: string
      kpiTitle: string
      achievementRate?: number
      comment?: string
      obstacles?: string
    }>
    recentCheckins: Array<{
      scheduledDate: string
      summary?: string
      managerName: string
    }>
    latestEvaluation?: {
      stage?: string
      finalScore?: number | null
      summary?: string
    }
    signals: string[]
  }
}

type MidReviewFormState = {
  memberAchievements: string
  milestoneReview: string
  issueRiskSummary: string
  nextPeriodPlan: string
  agreedContext: string
  directionClarity: 'CLEAR' | 'PARTIAL' | 'UNCLEAR' | ''
  directionClarityNote: string
  leaderSummary: string
  leaderCoachingMemo: string
  aiFollowUpQuestions: string[]
  aiCommentSupport?: {
    summary?: string
    draftComment?: string
    warnings?: string[]
  }
  goalReviews: Array<{
    id?: string
    orgKpiId?: string | null
    personalKpiId?: string | null
    goalValidityDecision: 'KEEP_GOAL' | 'ADJUST_PRIORITY_OR_METHOD' | 'REVISE_GOAL'
    decisionReason: string
    priorityAdjustmentMemo: string
    executionAdjustmentMemo: string
    expectedState: string
    successScene: string
    criteriaExceeds: string
    criteriaMeets: string
    criteriaBelow: string
    revisionRequested: boolean
  }>
  peopleReview?: {
    retentionRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | null
    stayInterviewMemo: string
    reboundGoal: string
    supportPlan: string
    coachingPlan: string
    nextFollowUpAt: string
  }
  actionItems: Array<{
    id?: string
    actionText: string
    ownerId?: string | null
    dueDate: string
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
  }>
}

type AiMode = 'evidence-summary' | 'leader-coach' | 'comment-support'

const GOAL_VALIDITY_OPTIONS = [
  { value: 'KEEP_GOAL', label: '목표 유지' },
  { value: 'ADJUST_PRIORITY_OR_METHOD', label: '우선순위·달성 방식 조정' },
  { value: 'REVISE_GOAL', label: '목표 수정 필요' },
] as const

const DIRECTION_OPTIONS = [
  { value: 'CLEAR', label: '명확' },
  { value: 'PARTIAL', label: '부분 이해' },
  { value: 'UNCLEAR', label: '재정렬 필요' },
] as const

const RETENTION_OPTIONS = [
  { value: 'LOW', label: '낮음' },
  { value: 'MEDIUM', label: '보통' },
  { value: 'HIGH', label: '높음' },
] as const

const ACTION_STATUS_OPTIONS = [
  { value: 'OPEN', label: '예정' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'DONE', label: '완료' },
] as const

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateInput(value?: string) {
  if (!value) return ''
  return value.slice(0, 10)
}

function createInitialForm(workspace: MidReviewWorkspace): MidReviewFormState {
  return {
    memberAchievements: workspace.record.memberAchievements ?? '',
    milestoneReview: workspace.record.milestoneReview ?? '',
    issueRiskSummary: workspace.record.issueRiskSummary ?? '',
    nextPeriodPlan: workspace.record.nextPeriodPlan ?? '',
    agreedContext: workspace.record.agreedContext ?? '',
    directionClarity: workspace.record.directionClarity ?? '',
    directionClarityNote: workspace.record.directionClarityNote ?? '',
    leaderSummary: workspace.record.leaderSummary ?? '',
    leaderCoachingMemo: workspace.record.leaderCoachingMemo ?? '',
    aiFollowUpQuestions: workspace.record.aiFollowUpQuestions ?? [],
    aiCommentSupport: workspace.record.aiCommentSupport,
    goalReviews: workspace.record.goalReviews.map((item) => ({
      id: item.id,
      orgKpiId: item.orgKpiId ?? null,
      personalKpiId: item.personalKpiId ?? null,
      goalValidityDecision: item.goalValidityDecision,
      decisionReason: item.decisionReason ?? '',
      priorityAdjustmentMemo: item.priorityAdjustmentMemo ?? '',
      executionAdjustmentMemo: item.executionAdjustmentMemo ?? '',
      expectedState: item.expectedState ?? '',
      successScene: item.successScene ?? '',
      criteriaExceeds: item.criteriaExceeds ?? '',
      criteriaMeets: item.criteriaMeets ?? '',
      criteriaBelow: item.criteriaBelow ?? '',
      revisionRequested: item.revisionRequested,
    })),
    peopleReview: workspace.permissions.canViewSensitivePeopleReview
      ? {
          retentionRiskLevel: workspace.record.peopleReview?.retentionRiskLevel ?? null,
          stayInterviewMemo: workspace.record.peopleReview?.stayInterviewMemo ?? '',
          reboundGoal: workspace.record.peopleReview?.reboundGoal ?? '',
          supportPlan: workspace.record.peopleReview?.supportPlan ?? '',
          coachingPlan: workspace.record.peopleReview?.coachingPlan ?? '',
          nextFollowUpAt: toDateInput(workspace.record.peopleReview?.nextFollowUpAt),
        }
      : undefined,
    actionItems: workspace.record.actionItems.map((item) => ({
      id: item.id,
      actionText: item.actionText,
      ownerId: item.ownerId ?? null,
      dueDate: toDateInput(item.dueDate),
      status: item.status,
    })),
  }
}

function buildPayload(form: MidReviewFormState) {
  return {
    memberAchievements: form.memberAchievements,
    milestoneReview: form.milestoneReview,
    issueRiskSummary: form.issueRiskSummary,
    nextPeriodPlan: form.nextPeriodPlan,
    agreedContext: form.agreedContext,
    directionClarity: form.directionClarity || null,
    directionClarityNote: form.directionClarityNote,
    leaderSummary: form.leaderSummary,
    leaderCoachingMemo: form.leaderCoachingMemo,
    aiFollowUpQuestions: form.aiFollowUpQuestions,
    aiCommentSupport: form.aiCommentSupport,
    goalReviews: form.goalReviews.map((item) => ({
      id: item.id,
      orgKpiId: item.orgKpiId || null,
      personalKpiId: item.personalKpiId || null,
      goalValidityDecision: item.goalValidityDecision,
      decisionReason: item.decisionReason,
      priorityAdjustmentMemo: item.priorityAdjustmentMemo,
      executionAdjustmentMemo: item.executionAdjustmentMemo,
      expectedState: item.expectedState,
      successScene: item.successScene,
      criteriaExceeds: item.criteriaExceeds,
      criteriaMeets: item.criteriaMeets,
      criteriaBelow: item.criteriaBelow,
      revisionRequested: item.revisionRequested,
    })),
    peopleReview: form.peopleReview
      ? {
          retentionRiskLevel: form.peopleReview.retentionRiskLevel ?? null,
          stayInterviewMemo: form.peopleReview.stayInterviewMemo,
          reboundGoal: form.peopleReview.reboundGoal,
          supportPlan: form.peopleReview.supportPlan,
          coachingPlan: form.peopleReview.coachingPlan,
          nextFollowUpAt: form.peopleReview.nextFollowUpAt
            ? new Date(`${form.peopleReview.nextFollowUpAt}T00:00:00`).toISOString()
            : null,
        }
      : undefined,
    actionItems: form.actionItems.map((item) => ({
      id: item.id,
      actionText: item.actionText,
      ownerId: item.ownerId || null,
      dueDate: item.dueDate ? new Date(`${item.dueDate}T00:00:00`).toISOString() : null,
      status: item.status,
    })),
  }
}

export function MidReviewDetailDrawer({
  record,
  open,
  onClose,
  onUpdated,
}: {
  record: CheckinRecordViewModel
  open: boolean
  onClose: () => void
  onUpdated?: () => void
}) {
  const [workspace, setWorkspace] = useState<MidReviewWorkspace | null>(null)
  const [form, setForm] = useState<MidReviewFormState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')

  useEffect(() => {
    if (!open) return

    let active = true
    setLoading(true)
    setErrorNotice('')

    fetch(`/api/checkin/${encodeURIComponent(record.id)}/mid-review`)
      .then(async (response) => {
        const json = await response.json()
        if (!response.ok || !json.success) {
          throw new Error(json?.error?.message ?? '중간 점검 정보를 불러오지 못했습니다.')
        }
        if (!active) return
        setWorkspace(json.data)
        setForm(createInitialForm(json.data))
      })
      .catch((error) => {
        if (!active) return
        setErrorNotice(error instanceof Error ? error.message : '중간 점검 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [open, record.id])

  const goalOptions = useMemo(() => {
    if (!workspace) return []
    return [
      ...workspace.evidence.personalKpis.map((item) => ({
        key: `personal:${item.id}`,
        personalKpiId: item.id,
        orgKpiId: null,
        label: `개인 KPI · ${item.title}`,
      })),
      ...workspace.evidence.orgKpis.map((item) => ({
        key: `org:${item.id}`,
        personalKpiId: null,
        orgKpiId: item.id,
        label: `조직 KPI · ${item.title}`,
      })),
    ]
  }, [workspace])

  const actionOwnerOptions = useMemo(() => {
    if (!workspace) return []
    return [
      workspace.target.employee
        ? { value: workspace.target.employee.id, label: `${workspace.target.employee.name} · 구성원` }
        : null,
      { value: workspace.target.manager.id, label: `${workspace.target.manager.name} · 리더` },
    ].filter((item): item is { value: string; label: string } => Boolean(item))
  }, [workspace])

  if (!open) return null

  async function saveDraft() {
    if (!form) return
    try {
      setSaving(true)
      setErrorNotice('')
      const response = await fetch(`/api/checkin/${encodeURIComponent(record.id)}/mid-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json?.error?.message ?? '중간 점검 저장에 실패했습니다.')
      }
      setWorkspace(json.data)
      setForm(createInitialForm(json.data))
      setNotice('중간 점검 초안을 저장했습니다.')
      onUpdated?.()
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '중간 점검 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function submitRecord() {
    if (!form) return
    try {
      setSaving(true)
      setErrorNotice('')
      const response = await fetch(`/api/checkin/${encodeURIComponent(record.id)}/mid-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json?.error?.message ?? '중간 점검 제출에 실패했습니다.')
      }
      setWorkspace(json.data)
      setForm(createInitialForm(json.data))
      setNotice(workspace?.permissions.canEditLeader ? '리더 중간 점검을 제출했습니다.' : '구성원 중간 점검을 제출했습니다.')
      onUpdated?.()
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '중간 점검 제출에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function runAi(mode: AiMode) {
    if (!workspace || !form) return
    try {
      setSaving(true)
      setErrorNotice('')
      const response = await fetch(`/api/checkin/${encodeURIComponent(record.id)}/mid-review/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json?.error?.message ?? 'AI 도움을 실행하지 못했습니다.')
      }

      const aiResult = json.data?.result as
        | {
            performanceSummary?: string
            followUpQuestions?: string[]
            commentDraft?: string
            vagueCommentSignals?: string[]
            lowConfidenceNotice?: string
          }
        | undefined

      if (!aiResult) {
        throw new Error('AI 결과 형식을 확인하지 못했습니다.')
      }

      setForm((current) =>
        current
          ? {
              ...current,
              aiFollowUpQuestions:
                Array.isArray(aiResult.followUpQuestions) && aiResult.followUpQuestions.length
                  ? aiResult.followUpQuestions
                  : current.aiFollowUpQuestions,
              aiCommentSupport: {
                summary: aiResult.performanceSummary ?? current.aiCommentSupport?.summary,
                draftComment: aiResult.commentDraft ?? current.aiCommentSupport?.draftComment,
                warnings: [
                  ...(current.aiCommentSupport?.warnings ?? []),
                  ...(aiResult.vagueCommentSignals ?? []),
                  ...(aiResult.lowConfidenceNotice ? [aiResult.lowConfidenceNotice] : []),
                ].filter(Boolean),
              },
            }
          : current
      )
      setNotice('AI 도움 결과를 화면에 반영했습니다. 검토 후 저장해 주세요.')
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'AI 도움을 실행하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !workspace || !form) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl border-l border-gray-200 bg-white shadow-2xl">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-slate-400" />
            <p className="mt-3 text-sm text-slate-500">중간 점검 정보를 불러오는 중입니다.</p>
            {errorNotice ? <p className="mt-2 text-sm text-rose-600">{errorNotice}</p> : null}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl border-l border-gray-200 bg-white shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="slate">{workspace.cycle.reviewTypeLabel}</Badge>
                <Badge tone={workspace.assignment.status === 'LEADER_SUBMITTED' ? 'emerald' : 'amber'}>
                  {workspace.assignment.statusLabel}
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-900">{workspace.cycle.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {record.owner.name} · {record.owner.department} · {formatDateTime(record.scheduledAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-slate-500"
            >
              닫기
            </button>
          </div>

          {notice ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}
          {errorNotice ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorNotice}</p> : null}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="space-y-6">
              <SectionCard title="운영 정보" icon={<CalendarDays className="h-4 w-4" />}>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow label="유형" value={workspace.cycle.reviewTypeLabel} />
                  <InfoRow label="운영 방식" value={workspace.cycle.workflowModeLabel} />
                  <InfoRow label="대상 범위" value={workspace.cycle.scopeTargetKindLabel} />
                  <InfoRow label="진행 상태" value={workspace.assignment.statusLabel} />
                  <InfoRow
                    label="대상"
                    value={
                      workspace.target.employee
                        ? `${workspace.target.employee.name} · ${workspace.target.employee.department}`
                        : workspace.target.department?.name ?? '-'
                    }
                  />
                  <InfoRow label="리더" value={workspace.target.manager.name} />
                </div>
              </SectionCard>

              <SectionCard title="구성원 입력" icon={<Users className="h-4 w-4" />}>
                <TextAreaField
                  label="주요 성과"
                  value={form.memberAchievements}
                  onChange={(value) => setForm({ ...form, memberAchievements: value })}
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />
                <TextAreaField
                  label="로드맵 대비 마일스톤 달성 현황"
                  value={form.milestoneReview}
                  onChange={(value) => setForm({ ...form, milestoneReview: value })}
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />
                <TextAreaField
                  label="이슈 및 리스크 요인"
                  value={form.issueRiskSummary}
                  onChange={(value) => setForm({ ...form, issueRiskSummary: value })}
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />
                <TextAreaField
                  label="다음 기간 계획"
                  value={form.nextPeriodPlan}
                  onChange={(value) => setForm({ ...form, nextPeriodPlan: value })}
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />
              </SectionCard>

              <SectionCard title="기대 상태와 판단 기준" icon={<Target className="h-4 w-4" />}>
                <TextAreaField
                  label="합의된 맥락"
                  value={form.agreedContext}
                  onChange={(value) => setForm({ ...form, agreedContext: value })}
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />
                <SelectField
                  label="방향 이해"
                  value={form.directionClarity}
                  options={DIRECTION_OPTIONS}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      directionClarity: value as MidReviewFormState['directionClarity'],
                    })
                  }
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />
                <TextAreaField
                  label="방향 이해 메모"
                  value={form.directionClarityNote}
                  onChange={(value) => setForm({ ...form, directionClarityNote: value })}
                  disabled={!workspace.permissions.canEditSelf && !workspace.permissions.canEditLeader}
                />

                {workspace.permissions.canEditLeader ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">목표 유효성 검토</div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            goalReviews: [
                              ...form.goalReviews,
                              {
                                personalKpiId: goalOptions[0]?.personalKpiId ?? null,
                                orgKpiId: goalOptions[0]?.orgKpiId ?? null,
                                goalValidityDecision: 'KEEP_GOAL',
                                decisionReason: '',
                                priorityAdjustmentMemo: '',
                                executionAdjustmentMemo: '',
                                expectedState: '',
                                successScene: '',
                                criteriaExceeds: '',
                                criteriaMeets: '',
                                criteriaBelow: '',
                                revisionRequested: false,
                              },
                            ],
                          })
                        }
                        className="text-sm font-semibold text-blue-600"
                      >
                        + 목표 검토 추가
                      </button>
                    </div>

                    {form.goalReviews.length ? (
                      form.goalReviews.map((goalReview, index) => (
                        <div key={`${goalReview.id ?? 'new'}-${index}`} className="space-y-3 rounded-2xl border border-white bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <GoalTargetSelect
                              value={
                                goalReview.personalKpiId
                                  ? `personal:${goalReview.personalKpiId}`
                                  : goalReview.orgKpiId
                                    ? `org:${goalReview.orgKpiId}`
                                    : ''
                              }
                              options={goalOptions}
                              onChange={(value) => {
                                const nextGoalReviews = [...form.goalReviews]
                                const option = goalOptions.find((item) => item.key === value)
                                nextGoalReviews[index] = {
                                  ...nextGoalReviews[index],
                                  personalKpiId: option?.personalKpiId ?? null,
                                  orgKpiId: option?.orgKpiId ?? null,
                                }
                                setForm({ ...form, goalReviews: nextGoalReviews })
                              }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setForm({
                                  ...form,
                                  goalReviews: form.goalReviews.filter((_, goalIndex) => goalIndex !== index),
                                })
                              }
                              className="text-sm font-semibold text-rose-600"
                            >
                              삭제
                            </button>
                          </div>
                          <SelectField
                            label="목표 판단"
                            value={goalReview.goalValidityDecision}
                            options={GOAL_VALIDITY_OPTIONS}
                            onChange={(value) => {
                              const nextGoalReviews = [...form.goalReviews]
                              nextGoalReviews[index] = {
                                ...nextGoalReviews[index],
                                goalValidityDecision: value as MidReviewFormState['goalReviews'][number]['goalValidityDecision'],
                              }
                              setForm({ ...form, goalReviews: nextGoalReviews })
                            }}
                          />
                          <TextAreaField
                            label="판단 사유"
                            value={goalReview.decisionReason}
                            onChange={(value) => {
                              const nextGoalReviews = [...form.goalReviews]
                              nextGoalReviews[index] = { ...nextGoalReviews[index], decisionReason: value }
                              setForm({ ...form, goalReviews: nextGoalReviews })
                            }}
                          />
                          <TextAreaField
                            label="우선순위 조정 메모"
                            value={goalReview.priorityAdjustmentMemo}
                            onChange={(value) => {
                              const nextGoalReviews = [...form.goalReviews]
                              nextGoalReviews[index] = { ...nextGoalReviews[index], priorityAdjustmentMemo: value }
                              setForm({ ...form, goalReviews: nextGoalReviews })
                            }}
                          />
                          <TextAreaField
                            label="달성 방식 조정 메모"
                            value={goalReview.executionAdjustmentMemo}
                            onChange={(value) => {
                              const nextGoalReviews = [...form.goalReviews]
                              nextGoalReviews[index] = { ...nextGoalReviews[index], executionAdjustmentMemo: value }
                              setForm({ ...form, goalReviews: nextGoalReviews })
                            }}
                          />
                          <TextAreaField
                            label="기대 상태"
                            value={goalReview.expectedState}
                            onChange={(value) => {
                              const nextGoalReviews = [...form.goalReviews]
                              nextGoalReviews[index] = { ...nextGoalReviews[index], expectedState: value }
                              setForm({ ...form, goalReviews: nextGoalReviews })
                            }}
                          />
                          <TextAreaField
                            label="성공의 장면"
                            value={goalReview.successScene}
                            onChange={(value) => {
                              const nextGoalReviews = [...form.goalReviews]
                              nextGoalReviews[index] = { ...nextGoalReviews[index], successScene: value }
                              setForm({ ...form, goalReviews: nextGoalReviews })
                            }}
                          />
                          <div className="grid gap-3 md:grid-cols-3">
                            <TextAreaField
                              label="기대 이상 기준"
                              value={goalReview.criteriaExceeds}
                              onChange={(value) => {
                                const nextGoalReviews = [...form.goalReviews]
                                nextGoalReviews[index] = { ...nextGoalReviews[index], criteriaExceeds: value }
                                setForm({ ...form, goalReviews: nextGoalReviews })
                              }}
                            />
                            <TextAreaField
                              label="기대 충족 기준"
                              value={goalReview.criteriaMeets}
                              onChange={(value) => {
                                const nextGoalReviews = [...form.goalReviews]
                                nextGoalReviews[index] = { ...nextGoalReviews[index], criteriaMeets: value }
                                setForm({ ...form, goalReviews: nextGoalReviews })
                              }}
                            />
                            <TextAreaField
                              label="미달 기준"
                              value={goalReview.criteriaBelow}
                              onChange={(value) => {
                                const nextGoalReviews = [...form.goalReviews]
                                nextGoalReviews[index] = { ...nextGoalReviews[index], criteriaBelow: value }
                                setForm({ ...form, goalReviews: nextGoalReviews })
                              }}
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={goalReview.revisionRequested}
                              onChange={(event) => {
                                const nextGoalReviews = [...form.goalReviews]
                                nextGoalReviews[index] = {
                                  ...nextGoalReviews[index],
                                  revisionRequested: event.target.checked,
                                }
                                setForm({ ...form, goalReviews: nextGoalReviews })
                              }}
                            />
                            목표 수정 요청으로 집계
                          </label>
                        </div>
                      ))
                    ) : (
                      <EmptyState>리더 검토 단계에서 목표 유지/조정/수정 판단을 기록해 주세요.</EmptyState>
                    )}
                  </div>
                ) : null}
              </SectionCard>

              {workspace.permissions.canEditLeader ? (
                <SectionCard title="리더 요약과 후속 계획" icon={<MessageSquareText className="h-4 w-4" />}>
                  <TextAreaField
                    label="리더 요약"
                    value={form.leaderSummary}
                    onChange={(value) => setForm({ ...form, leaderSummary: value })}
                  />
                  <TextAreaField
                    label="코칭 메모"
                    value={form.leaderCoachingMemo}
                    onChange={(value) => setForm({ ...form, leaderCoachingMemo: value })}
                  />

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900">후속 액션</div>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            actionItems: [
                              ...form.actionItems,
                              {
                                actionText: '',
                                ownerId: workspace.target.employee?.id ?? workspace.target.manager.id,
                                dueDate: '',
                                status: 'OPEN',
                              },
                            ],
                          })
                        }
                        className="text-sm font-semibold text-blue-600"
                      >
                        + 액션 추가
                      </button>
                    </div>
                    {form.actionItems.length ? (
                      form.actionItems.map((actionItem, index) => (
                        <div key={`${actionItem.id ?? 'new'}-${index}`} className="grid gap-3 rounded-2xl border border-white bg-white p-4 md:grid-cols-[minmax(0,1fr)_180px_140px_100px]">
                          <input
                            value={actionItem.actionText}
                            onChange={(event) => {
                              const next = [...form.actionItems]
                              next[index] = { ...next[index], actionText: event.target.value }
                              setForm({ ...form, actionItems: next })
                            }}
                            placeholder="후속 지원 또는 코칭 액션을 입력해 주세요."
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                          />
                          <select
                            value={actionItem.ownerId ?? ''}
                            onChange={(event) => {
                              const next = [...form.actionItems]
                              next[index] = { ...next[index], ownerId: event.target.value || null }
                              setForm({ ...form, actionItems: next })
                            }}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="">담당자 선택</option>
                            {actionOwnerOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={actionItem.dueDate}
                            onChange={(event) => {
                              const next = [...form.actionItems]
                              next[index] = { ...next[index], dueDate: event.target.value }
                              setForm({ ...form, actionItems: next })
                            }}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                          />
                          <select
                            value={actionItem.status}
                            onChange={(event) => {
                              const next = [...form.actionItems]
                              next[index] = {
                                ...next[index],
                                status: event.target.value as MidReviewFormState['actionItems'][number]['status'],
                              }
                              setForm({ ...form, actionItems: next })
                            }}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
                          >
                            {ACTION_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))
                    ) : (
                      <EmptyState>아직 등록된 후속 액션이 없습니다.</EmptyState>
                    )}
                  </div>

                  {workspace.cycle.peopleReviewEnabled && workspace.permissions.canViewSensitivePeopleReview && form.peopleReview ? (
                    <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <div className="text-sm font-semibold text-rose-900">사람 리뷰</div>
                      <SelectField
                        label="핵심인재 유지 리스크"
                        value={form.peopleReview.retentionRiskLevel ?? ''}
                        options={RETENTION_OPTIONS}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            peopleReview: {
                              ...form.peopleReview!,
                              retentionRiskLevel: (value || null) as NonNullable<
                                MidReviewFormState['peopleReview']
                              >['retentionRiskLevel'],
                            },
                          })
                        }
                      />
                      <TextAreaField
                        label="Stay Interview 메모"
                        value={form.peopleReview.stayInterviewMemo}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            peopleReview: { ...form.peopleReview!, stayInterviewMemo: value },
                          })
                        }
                      />
                      <TextAreaField
                        label="리바운드 목표"
                        value={form.peopleReview.reboundGoal}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            peopleReview: { ...form.peopleReview!, reboundGoal: value },
                          })
                        }
                      />
                      <TextAreaField
                        label="지원 계획"
                        value={form.peopleReview.supportPlan}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            peopleReview: { ...form.peopleReview!, supportPlan: value },
                          })
                        }
                      />
                      <TextAreaField
                        label="코칭 계획"
                        value={form.peopleReview.coachingPlan}
                        onChange={(value) =>
                          setForm({
                            ...form,
                            peopleReview: { ...form.peopleReview!, coachingPlan: value },
                          })
                        }
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">다음 후속 일정</label>
                        <input
                          type="date"
                          value={form.peopleReview.nextFollowUpAt}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              peopleReview: { ...form.peopleReview!, nextFollowUpAt: event.target.value },
                            })
                          }
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}

              {workspace.permissions.canUseAi ? (
                <SectionCard title="AI 도움" icon={<Brain className="h-4 w-4" />}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <ActionButton icon={<Sparkles className="h-4 w-4" />} onClick={() => void runAi('evidence-summary')} disabled={saving}>
                      근거 요약
                    </ActionButton>
                    <ActionButton icon={<Users className="h-4 w-4" />} onClick={() => void runAi('leader-coach')} disabled={saving}>
                      1:1 질문
                    </ActionButton>
                    <ActionButton icon={<MessageSquareText className="h-4 w-4" />} onClick={() => void runAi('comment-support')} disabled={saving}>
                      코멘트 보강
                    </ActionButton>
                  </div>
                  {form.aiCommentSupport?.summary ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                      <div className="font-semibold">AI 요약</div>
                      <p className="mt-2 whitespace-pre-wrap">{form.aiCommentSupport.summary}</p>
                    </div>
                  ) : null}
                  {form.aiFollowUpQuestions.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">AI 후속 질문</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {form.aiFollowUpQuestions.map((question) => (
                          <li key={question} className="rounded-xl bg-slate-50 px-3 py-2">
                            {question}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {form.aiCommentSupport?.warnings?.length ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <div className="font-semibold">AI 경고</div>
                      <ul className="mt-2 space-y-2">
                        {form.aiCommentSupport.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </SectionCard>
              ) : null}

              <div className="flex flex-wrap gap-2 pb-8">
                {(workspace.permissions.canEditSelf || workspace.permissions.canEditLeader) ? (
                  <ActionButton icon={<Save className="h-4 w-4" />} onClick={() => void saveDraft()} disabled={saving}>
                    임시 저장
                  </ActionButton>
                ) : null}
                {workspace.permissions.canEditSelf ? (
                  <ActionButton
                    icon={saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    onClick={() => void submitRecord()}
                    disabled={saving}
                    primary
                  >
                    구성원 제출
                  </ActionButton>
                ) : null}
                {workspace.permissions.canEditLeader ? (
                  <ActionButton
                    icon={saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                    onClick={() => void submitRecord()}
                    disabled={saving}
                    primary
                  >
                    리더 제출
                  </ActionButton>
                ) : null}
              </div>
            </div>

            <div className="space-y-6">
              <SectionCard title="근거 요약" icon={<AlertTriangle className="h-4 w-4" />}>
                {workspace.evidence.signals.length ? (
                  <ul className="space-y-2 text-sm text-amber-900">
                    {workspace.evidence.signals.map((signal) => (
                      <li key={signal} className="rounded-xl bg-amber-50 px-3 py-2">
                        {signal}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState>현재 눈에 띄는 정렬 리스크는 없습니다.</EmptyState>
                )}
              </SectionCard>

              <SectionCard title="관련 KPI" icon={<Target className="h-4 w-4" />}>
                <div className="space-y-3">
                  {workspace.evidence.personalKpis.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        가중치 {item.weight}%{item.linkedOrgKpi ? ` · 조직 KPI ${item.linkedOrgKpi}` : ''}
                      </div>
                      {typeof item.averageAchievementRate === 'number' ? (
                        <div className="mt-2 text-xs font-semibold text-blue-700">
                          최근 평균 달성률 {item.averageAchievementRate.toFixed(1)}%
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!workspace.evidence.personalKpis.length && workspace.evidence.orgKpis.length ? (
                    workspace.evidence.orgKpis.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {item.department} · {item.status}
                        </div>
                      </div>
                    ))
                  ) : null}
                  {!workspace.evidence.personalKpis.length && !workspace.evidence.orgKpis.length ? (
                    <EmptyState>연결된 KPI 근거가 없습니다.</EmptyState>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard title="월간 실적과 최근 대화" icon={<CalendarDays className="h-4 w-4" />}>
                {workspace.evidence.monthlyRecords.length ? (
                  <div className="space-y-3">
                    {workspace.evidence.monthlyRecords.slice(0, 5).map((item) => (
                      <div key={`${item.month}-${item.kpiTitle}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="font-semibold text-slate-900">
                          {item.month} · {item.kpiTitle}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {typeof item.achievementRate === 'number'
                            ? `달성률 ${item.achievementRate.toFixed(1)}%`
                            : '달성률 기록 없음'}
                        </div>
                        {item.comment ? <p className="mt-2 text-sm text-slate-700">{item.comment}</p> : null}
                        {item.obstacles ? <p className="mt-1 text-xs text-amber-700">리스크: {item.obstacles}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>최근 월간 실적 근거가 없습니다.</EmptyState>
                )}

                {workspace.evidence.recentCheckins.length ? (
                  <div className="mt-4 space-y-3">
                    {workspace.evidence.recentCheckins.map((item) => (
                      <div key={`${item.scheduledDate}-${item.managerName}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="font-semibold text-slate-900">{formatDateTime(item.scheduledDate)}</div>
                        <div className="mt-1 text-sm text-slate-500">매니저 {item.managerName}</div>
                        {item.summary ? <p className="mt-2 text-sm text-slate-700">{item.summary}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm disabled:bg-slate-50"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm disabled:bg-slate-50"
      >
        <option value="">선택해 주세요</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function GoalTargetSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<{
    key: string
    personalKpiId: string | null
    orgKpiId: string | null
    label: string
  }>
  onChange: (value: string) => void
}) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-sm font-medium text-slate-700">검토 대상 목표</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">목표를 선택해 주세요</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'slate' | 'amber' | 'emerald'
}) {
  const className =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
}

function ActionButton({
  icon,
  children,
  onClick,
  disabled,
  primary = false,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        primary ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      {children}
    </div>
  )
}
