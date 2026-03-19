'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Layers3,
  MessageSquareMore,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Target,
  Users,
} from 'lucide-react'
import type {
  CheckinActionItemViewModel,
  CheckinPageData,
  CheckinPageViewModel,
  CheckinPreparationViewModel,
  CheckinRecordViewModel,
} from '@/server/checkin-page'

type CheckinTab = 'calendar' | 'list' | 'actions' | 'history' | 'prep'

type NewCheckinFormState = {
  ownerId: string
  checkInType: string
  scheduledDate: string
  agendaText: string
  ownerNotes: string
}

type EditCheckinFormState = {
  scheduledDate: string
  agendaText: string
  ownerNotes: string
  managerNotes: string
}

type CompleteCheckinFormState = {
  duration: number
  keyTakeaways: string
  managerNotes: string
  energyLevel: number
  satisfactionLevel: number
  blockerCount: number
  nextCheckInDate: string
  actionItems: Array<{
    action: string
    assignee: string
    dueDate: string
    completed: boolean
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
  }>
}

const TAB_LABELS: Record<CheckinTab, string> = {
  calendar: '캘린더',
  list: '목록',
  actions: '실행 항목',
  history: '지난 기록',
  prep: '준비 자료',
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: '예정',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  CANCELLED: '취소',
  RESCHEDULED: '일정 변경',
}

const TYPE_LABELS: Record<string, string> = {
  WEEKLY: '주간 체크인',
  BIWEEKLY: '격주 체크인',
  MONTHLY: '월간 체크인',
  AD_HOC: '수시 체크인',
  MIDYEAR_REVIEW: '중간 리뷰',
  QUARTERLY: '분기 리뷰',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
}

export function CheckinClient(props: CheckinPageData) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<CheckinTab>('calendar')
  const [selectedRecordId, setSelectedRecordId] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorNotice, setErrorNotice] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const [listFilters, setListFilters] = useState({
    status: 'ALL',
    ownerId: 'ALL',
    department: 'ALL',
    riskOnly: false,
    type: 'ALL',
  })
  const [actionFilters, setActionFilters] = useState({
    assignee: 'ALL',
    ownerId: 'ALL',
    overdueOnly: false,
    incompleteOnly: true,
  })

  const viewModel = props.viewModel

  const initialCreateForm = useMemo<NewCheckinFormState>(() => {
    const defaultOwnerId =
      viewModel?.filters.scope === 'employee'
        ? viewModel.filters.employeeId ?? viewModel.currentUserId
        : viewModel?.permissions.canManageTeam
          ? viewModel.teamMembers[0]?.id ?? viewModel.currentUserId
          : viewModel?.currentUserId ?? ''

    return {
      ownerId: defaultOwnerId,
      checkInType: 'WEEKLY',
      scheduledDate: '',
      agendaText: '',
      ownerNotes: '',
    }
  }, [viewModel])

  const [createForm, setCreateForm] = useState<NewCheckinFormState>(initialCreateForm)

  useEffect(() => {
    setCreateForm(initialCreateForm)
  }, [initialCreateForm])

  useEffect(() => {
    if (!viewModel?.records.length) {
      setSelectedRecordId('')
      return
    }

    if (!selectedRecordId || !viewModel.records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(viewModel.records[0].id)
    }
  }, [selectedRecordId, viewModel?.records])

  const selectedRecord =
    viewModel?.records.find((record) => record.id === selectedRecordId) ?? viewModel?.records[0] ?? null

  const [editForm, setEditForm] = useState<EditCheckinFormState>({
    scheduledDate: '',
    agendaText: '',
    ownerNotes: '',
    managerNotes: '',
  })

  const [completeForm, setCompleteForm] = useState<CompleteCheckinFormState>({
    duration: 30,
    keyTakeaways: '',
    managerNotes: '',
    energyLevel: 3,
    satisfactionLevel: 3,
    blockerCount: 0,
    nextCheckInDate: '',
    actionItems: [],
  })

  useEffect(() => {
    if (!selectedRecord) return
    setEditForm({
      scheduledDate: toDateTimeLocal(selectedRecord.scheduledAt),
      agendaText: selectedRecord.agenda.map((item) => item.topic).join('\n'),
      ownerNotes: selectedRecord.ownerNotes ?? '',
      managerNotes: selectedRecord.managerNotes ?? '',
    })
    setCompleteForm({
      duration: selectedRecord.duration ?? 30,
      keyTakeaways: selectedRecord.summary ?? '',
      managerNotes: selectedRecord.managerNotes ?? '',
      energyLevel: selectedRecord.energyLevel ?? 3,
      satisfactionLevel: selectedRecord.satisfactionLevel ?? 3,
      blockerCount: selectedRecord.blockerCount ?? 0,
      nextCheckInDate: selectedRecord.nextCheckInDate ? toDateTimeLocal(selectedRecord.nextCheckInDate) : '',
      actionItems: selectedRecord.actionItems.map((item) => ({
        action: item.action,
        assignee: item.assignee,
        dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
        completed: Boolean(item.completed),
        priority: item.priority ?? 'MEDIUM',
      })),
    })
  }, [selectedRecord])

  const filteredRecords = useMemo(() => {
    if (!viewModel) return []
    return viewModel.records.filter((record) => {
      if (listFilters.status !== 'ALL' && record.status !== listFilters.status) return false
      if (listFilters.ownerId !== 'ALL' && record.owner.id !== listFilters.ownerId) return false
      if (listFilters.department !== 'ALL' && record.owner.department !== listFilters.department) return false
      if (listFilters.type !== 'ALL' && record.type !== listFilters.type) return false
      if (listFilters.riskOnly && record.riskKpiCount === 0) return false
      return true
    })
  }, [listFilters, viewModel])

  const filteredActions = useMemo(() => {
    if (!viewModel) return []
    return viewModel.actions.filter((action) => {
      if (actionFilters.assignee !== 'ALL' && action.assignee !== actionFilters.assignee) return false
      if (actionFilters.ownerId !== 'ALL' && action.ownerId !== actionFilters.ownerId) return false
      if (actionFilters.overdueOnly && !action.overdue) return false
      if (actionFilters.incompleteOnly && action.completed) return false
      return true
    })
  }, [actionFilters, viewModel])

  const calendarGroups = useMemo(() => groupRecordsByDate(filteredRecords), [filteredRecords])
  const focusPrep = viewModel && selectedRecord
    ? viewModel.prepByEmployee[selectedRecord.owner.id] ?? viewModel.prepByEmployee[viewModel.focusEmployee?.id ?? '']
    : viewModel?.focusEmployee
      ? viewModel.prepByEmployee[viewModel.focusEmployee.id]
      : undefined

  function handleSelectRecord(id: string) {
    setSelectedRecordId(id)
    setIsDrawerOpen(true)
  }

  function updateQuery(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    startTransition(() => {
      router.push(`/checkin?${params.toString()}`)
    })
  }

  async function runMutation(
    request: () => Promise<void>,
    successMessage: string,
    options?: { closeCreate?: boolean }
  ) {
    try {
      setIsMutating(true)
      setErrorNotice('')
      await request()
      setNotice(successMessage)
      if (options?.closeCreate) {
        setIsCreateOpen(false)
      }
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.')
    } finally {
      setIsMutating(false)
    }
  }

  async function createCheckin() {
    if (!createForm.scheduledDate) {
      setErrorNotice('일정을 먼저 선택해 주세요.')
      return
    }

    const agendaItems = createForm.agendaText
      .split('\n')
      .map((topic) => topic.trim())
      .filter(Boolean)
      .map((topic) => ({ topic }))

    await runMutation(
      async () => {
        const response = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerId: createForm.ownerId,
            checkInType: createForm.checkInType,
            scheduledDate: new Date(createForm.scheduledDate).toISOString(),
            agendaItems,
            ownerNotes: createForm.ownerNotes || undefined,
          }),
        })
        const json = await response.json()
        if (!json.success) throw new Error(json.error?.message ?? '체크인을 예약하지 못했습니다.')
      },
      '체크인을 예약했습니다.',
      { closeCreate: true }
    )
  }

  async function saveRecordEdits(record: CheckinRecordViewModel) {
    await runMutation(async () => {
      const response = await fetch(`/api/checkin/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledDate: new Date(editForm.scheduledDate).toISOString(),
          agendaItems: editForm.agendaText
            .split('\n')
            .map((topic) => topic.trim())
            .filter(Boolean)
            .map((topic) => ({ topic })),
          ownerNotes: editForm.ownerNotes || undefined,
          managerNotes: editForm.managerNotes || undefined,
        }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message ?? '체크인 일정을 저장하지 못했습니다.')
    }, '체크인 일정과 메모를 저장했습니다.')
  }

  async function completeRecord(record: CheckinRecordViewModel) {
    await runMutation(async () => {
      const response = await fetch(`/api/checkin/${record.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualDate: new Date().toISOString(),
          duration: completeForm.duration,
          keyTakeaways: completeForm.keyTakeaways || undefined,
          managerNotes: completeForm.managerNotes || undefined,
          actionItems: completeForm.actionItems
            .filter((item) => item.action.trim() && item.assignee.trim())
            .map((item) => ({
              action: item.action.trim(),
              assignee: item.assignee.trim(),
              dueDate: item.dueDate || undefined,
              completed: item.completed,
              priority: item.priority,
            })),
          nextCheckInDate: completeForm.nextCheckInDate
            ? new Date(completeForm.nextCheckInDate).toISOString()
            : undefined,
          energyLevel: completeForm.energyLevel,
          satisfactionLevel: completeForm.satisfactionLevel,
          blockerCount: completeForm.blockerCount,
        }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message ?? '체크인을 완료 처리하지 못했습니다.')
    }, '체크인을 완료 처리했습니다.')
  }

  async function cancelRecord(record: CheckinRecordViewModel) {
    await runMutation(async () => {
      const response = await fetch(`/api/checkin/${record.id}`, {
        method: 'PATCH',
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message ?? '체크인을 취소하지 못했습니다.')
    }, '체크인을 취소했습니다.')
  }

  async function toggleActionItem(action: CheckinActionItemViewModel) {
    await runMutation(async () => {
      const detailResponse = await fetch(`/api/checkin/${action.checkinId}`)
      const detailJson = await detailResponse.json()
      if (!detailJson.success) throw new Error(detailJson.error?.message ?? '체크인 정보를 불러오지 못했습니다.')

      const existingItems = Array.isArray(detailJson.data?.actionItems) ? detailJson.data.actionItems : []
      const nextItems = existingItems.map((item: Record<string, unknown>, index: number) =>
        index === action.sourceIndex
          ? {
              ...item,
              completed: !action.completed,
            }
          : item
      )

      const response = await fetch(`/api/checkin/${action.checkinId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionItems: nextItems,
        }),
      })
      const json = await response.json()
      if (!json.success) throw new Error(json.error?.message ?? '액션아이템 상태를 변경하지 못했습니다.')
    }, action.completed ? '액션아이템을 다시 미완료로 전환했습니다.' : '액션아이템을 완료 처리했습니다.')
  }

  function openNextCheckinFromRecord(record: CheckinRecordViewModel) {
    setIsCreateOpen(true)
    setCreateForm({
      ownerId: record.owner.id,
      checkInType: record.type,
      scheduledDate: record.nextCheckInDate ? toDateTimeLocal(record.nextCheckInDate) : '',
      agendaText: record.agenda.map((item) => item.topic).join('\n'),
      ownerNotes: record.summary ?? '',
    })
  }

  if (props.state !== 'ready' || !viewModel) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <StatePanel state={props.state} message={props.message} />
      </div>
    )
  }

  const summaryCards = [
    {
      label: '이번 주 예정 체크인',
      value: `${viewModel.summary.upcomingCount}건`,
      hint: '예정 + 진행 중 일정 기준',
      icon: Calendar,
    },
    {
      label: '오늘 일정',
      value: `${viewModel.summary.todayCount}건`,
      hint: '오늘 날짜 기준',
      icon: Clock3,
    },
    {
      label: '미완료 체크인',
      value: `${viewModel.summary.incompleteCount}건`,
      hint: '완료/취소 제외',
      icon: ClipboardList,
    },
    {
      label: 'Overdue Action',
      value: `${viewModel.summary.overdueActionCount}건`,
      hint: '완료되지 않은 due date 초과 항목',
      icon: AlertTriangle,
      tone: viewModel.summary.overdueActionCount ? 'warning' : 'neutral',
    },
    {
      label: '위험 KPI 연결',
      value: `${viewModel.summary.riskyKpiLinkedCount}건`,
      hint: '달성률 저하 또는 장애 요인 연계',
      icon: ShieldAlert,
      tone: viewModel.summary.riskyKpiLinkedCount ? 'warning' : 'neutral',
    },
  ] as const

  return (
    <div className="space-y-6">
      <PageHeader />

      <CheckinHero
        viewModel={viewModel}
        selectedRecord={selectedRecord}
        isPending={isPending || isMutating}
        onChangePeriod={(period) => {
          if (period !== 'custom') {
            updateQuery({ period, startDate: undefined, endDate: undefined })
          } else {
            updateQuery({
              period,
              startDate: viewModel.filters.startDate ?? new Date().toISOString().slice(0, 10),
              endDate: viewModel.filters.endDate ?? new Date().toISOString().slice(0, 10),
            })
          }
        }}
        onChangeScope={(scope) => {
          updateQuery({
            scope,
            employeeId: scope === 'employee' ? viewModel.teamMembers[0]?.id : undefined,
          })
        }}
        onChangeEmployee={(employeeId) => updateQuery({ scope: 'employee', employeeId })}
        onChangeCustomRange={(startDate, endDate) => updateQuery({ period: 'custom', startDate, endDate })}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenReschedule={() => {
          if (!selectedRecord) return
          setActiveTab('list')
          setIsDrawerOpen(true)
        }}
        onComplete={() => selectedRecord && void completeRecord(selectedRecord)}
        onOpenNext={() => selectedRecord && openNextCheckinFromRecord(selectedRecord)}
      />

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {errorNotice ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorNotice}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
        <NextActionCard
          viewModel={viewModel}
          onGoToday={() => setActiveTab('calendar')}
          onGoActions={() => setActiveTab('actions')}
          onGoList={() => setActiveTab('list')}
        />
      </section>

      <CheckinTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'calendar' ? (
        <CheckinCalendarSection
          records={filteredRecords}
          groups={calendarGroups}
          selectedRecordId={selectedRecord?.id}
          onSelectRecord={handleSelectRecord}
        />
      ) : null}

      {activeTab === 'list' ? (
        <CheckinListSection
          records={filteredRecords}
          filters={listFilters}
          departments={Array.from(new Set(viewModel.records.map((record) => record.owner.department))).sort()}
          teamMembers={viewModel.teamMembers}
          onChangeFilters={setListFilters}
          onSelectRecord={handleSelectRecord}
          selectedRecordId={selectedRecord?.id}
        />
      ) : null}

      {activeTab === 'actions' ? (
        <CheckinActionsSection
          actions={filteredActions}
          teamMembers={viewModel.teamMembers}
          filters={actionFilters}
          onChangeFilters={setActionFilters}
          onToggleAction={toggleActionItem}
          isPending={isMutating}
        />
      ) : null}

      {activeTab === 'history' ? (
        <CheckinHistorySection history={viewModel.history} onSelectRecord={handleSelectRecord} />
      ) : null}

      {activeTab === 'prep' ? (
        <CheckinPreparationSection
          prep={focusPrep}
          selectedRecord={selectedRecord}
          focusEmployee={viewModel.focusEmployee}
        />
      ) : null}

      <RelatedActionLinks />

      <CheckinDetailDrawer
        record={isDrawerOpen ? selectedRecord : null}
        prep={focusPrep}
        editForm={editForm}
        completeForm={completeForm}
        isPending={isMutating}
        onClose={() => setIsDrawerOpen(false)}
        onChangeEditForm={setEditForm}
        onChangeCompleteForm={setCompleteForm}
        onSave={saveRecordEdits}
        onComplete={completeRecord}
        onCancel={cancelRecord}
        onToggleAction={toggleActionItem}
        onOpenNext={openNextCheckinFromRecord}
      />

      <CreateCheckinModal
        open={isCreateOpen}
        canManageTeam={viewModel.permissions.canManageTeam}
        teamMembers={viewModel.teamMembers}
        form={createForm}
        isPending={isMutating}
        onClose={() => setIsCreateOpen(false)}
        onChange={setCreateForm}
        onSubmit={createCheckin}
      />
    </div>
  )
}

function PageHeader() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">
            Check-in Operations Workbench
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">체크인 일정</h1>
          <p className="mt-2 text-sm text-slate-500">
            예정된 체크인을 확인하고, 준비 자료와 지난 기록을 바탕으로 대화를 운영하며, 실행 항목과 다음 체크인까지
            한 화면에서 이어갑니다.
          </p>
        </div>
      </div>
    </section>
  )
}

function CheckinHero({
  viewModel,
  selectedRecord,
  isPending,
  onChangePeriod,
  onChangeScope,
  onChangeEmployee,
  onChangeCustomRange,
  onOpenCreate,
  onOpenReschedule,
  onComplete,
  onOpenNext,
}: {
  viewModel: CheckinPageViewModel
  selectedRecord: CheckinRecordViewModel | null
  isPending: boolean
  onChangePeriod: (period: 'week' | 'month' | 'custom') => void
  onChangeScope: (scope: 'self' | 'team' | 'employee') => void
  onChangeEmployee: (employeeId: string) => void
  onChangeCustomRange: (startDate: string, endDate: string) => void
  onOpenCreate: () => void
  onOpenReschedule: () => void
  onComplete: () => void
  onOpenNext: () => void
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectorCard
              label="기간"
              value={viewModel.filters.period}
              options={[
                { value: 'week', label: '이번 주' },
                { value: 'month', label: '이번 달' },
                { value: 'custom', label: '사용자 지정' },
              ]}
              onChange={(value) => onChangePeriod(value as 'week' | 'month' | 'custom')}
            />
            <SelectorCard
              label="대상 범위"
              value={viewModel.filters.scope}
              options={[
                { value: 'self', label: '내 일정' },
                ...(viewModel.permissions.canManageTeam ? [{ value: 'team', label: '우리 팀' }] : []),
                ...(viewModel.permissions.canManageTeam ? [{ value: 'employee', label: '특정 구성원' }] : []),
              ]}
              onChange={(value) => onChangeScope(value as 'self' | 'team' | 'employee')}
            />
            <SelectorCard
              label="구성원"
              value={viewModel.filters.employeeId ?? viewModel.teamMembers[0]?.id ?? ''}
              disabled={viewModel.filters.scope !== 'employee'}
              options={viewModel.teamMembers.map((member) => ({
                value: member.id,
                label: `${member.name} · ${member.department}`,
              }))}
              onChange={onChangeEmployee}
            />
          </div>

          {viewModel.filters.period === 'custom' ? (
            <CustomRangeControls
              key={`${viewModel.filters.startDate ?? ''}-${viewModel.filters.endDate ?? ''}`}
              initialStart={viewModel.filters.startDate ?? ''}
              initialEnd={viewModel.filters.endDate ?? ''}
              onApply={onChangeCustomRange}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="이번 주 예정" value={`${viewModel.summary.upcomingCount}건`} />
            <HeroMetric label="미완료 액션" value={`${viewModel.summary.incompleteCount}건`} />
            <HeroMetric
              label="Overdue Action"
              value={`${viewModel.summary.overdueActionCount}건`}
              tone={viewModel.summary.overdueActionCount ? 'warning' : 'default'}
            />
            <HeroMetric label="현재 범위" value={viewModel.filters.rangeLabel} />
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap gap-2">
            {viewModel.summary.heroStatus ? <StatusBadge status={viewModel.summary.heroStatus} /> : null}
            <InfoBadge label={viewModel.focusEmployee ? `${viewModel.focusEmployee.name} 중심` : '범위 전체'} />
            <InfoBadge label={viewModel.permissions.canOperate ? '운영 수정 가능' : '조회/준비 중심'} />
          </div>
          <div>
            <div className="text-sm text-slate-500">이번 주 예정 수</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">{viewModel.summary.upcomingCount}</div>
          </div>
          <div className="space-y-2">
            <ActionButton icon={<Plus className="h-4 w-4" />} onClick={onOpenCreate}>
              체크인 예약
            </ActionButton>
            <ActionButton
              icon={<RefreshCcw className="h-4 w-4" />}
              onClick={onOpenReschedule}
              disabled={!selectedRecord?.canEdit || isPending}
              variant="secondary"
            >
              일정 변경
            </ActionButton>
            <ActionButton
              icon={<CheckCircle2 className="h-4 w-4" />}
              onClick={onComplete}
              disabled={!selectedRecord?.canComplete || isPending}
              variant="secondary"
            >
              완료 처리
            </ActionButton>
            <ActionButton
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={onOpenNext}
              disabled={!selectedRecord || isPending}
              variant="secondary"
            >
              다음 체크인 예약
            </ActionButton>
          </div>
        </div>
      </div>
    </section>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string
  hint: string
  icon: typeof Calendar
  tone?: 'default' | 'warning' | 'neutral'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'neutral'
        ? 'border-slate-200 bg-slate-50'
        : 'border-gray-200 bg-white'

  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </section>
  )
}

function CustomRangeControls({
  initialStart,
  initialEnd,
  onApply,
}: {
  initialStart: string
  initialEnd: string
  onApply: (startDate: string, endDate: string) => void
}) {
  const [customStart, setCustomStart] = useState(initialStart)
  const [customEnd, setCustomEnd] = useState(initialEnd)

  return (
    <div className="grid gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_1fr_auto]">
      <input
        type="date"
        value={customStart}
        onChange={(event) => setCustomStart(event.target.value)}
        className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="date"
        value={customEnd}
        onChange={(event) => setCustomEnd(event.target.value)}
        className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="button"
        onClick={() => onApply(customStart, customEnd)}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
      >
        기간 적용
      </button>
    </div>
  )
}

function NextActionCard({
  viewModel,
  onGoToday,
  onGoActions,
  onGoList,
}: {
  viewModel: CheckinPageViewModel
  onGoToday: () => void
  onGoActions: () => void
  onGoList: () => void
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-slate-900 p-5 text-white shadow-sm xl:col-span-1">
      <div className="text-sm font-medium text-slate-200">다음 행동</div>
      <div className="mt-3 space-y-3 text-sm">
        <button type="button" onClick={onGoToday} className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-3 py-3 text-left">
          <span>오늘 체크인 준비</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onGoActions} className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-3 py-3 text-left">
          <span>액션아이템 완료 처리</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={onGoList} className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-3 py-3 text-left">
          <span>일정 변경 필요 항목 확인</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-4 text-xs text-slate-300">
        현재 범위 내 체크인 {viewModel.records.length}건과 실행 항목 {viewModel.actions.length}건을 기준으로 다음 행동을 추천합니다.
      </p>
    </section>
  )
}

function CheckinTabs({
  activeTab,
  onChange,
}: {
  activeTab: CheckinTab
  onChange: (tab: CheckinTab) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        {Object.entries(TAB_LABELS).map(([value, label]) => {
          const active = activeTab === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value as CheckinTab)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CheckinCalendarSection({
  records,
  groups,
  selectedRecordId,
  onSelectRecord,
}: {
  records: CheckinRecordViewModel[]
  groups: Array<{ date: string; label: string; items: CheckinRecordViewModel[] }>
  selectedRecordId?: string
  onSelectRecord: (id: string) => void
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader
        title="캘린더"
        description="주간 agenda 형식으로 일정을 확인하고, 클릭한 일정의 상세를 바로 확인합니다."
      />
      {!records.length ? (
        <EmptyBlock
          title="선택한 기간에 예정된 체크인이 없습니다."
          description="새 체크인을 예약하거나 범위를 바꿔 다른 일정을 확인해 보세요."
        />
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => (
            <div key={group.date} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{group.label}</div>
                  <div className="text-xs text-slate-500">{group.items.length}건</div>
                </div>
                {isToday(group.date) ? <InfoBadge label="오늘" /> : null}
              </div>
              <div className="mt-3 space-y-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectRecord(item.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedRecordId === item.id
                        ? 'border-slate-900 bg-white shadow-sm'
                        : 'border-transparent bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.owner.name}</div>
                        <div className="text-xs text-slate-500">
                          {TYPE_LABELS[item.type]} · {formatTime(item.scheduledAt)}
                        </div>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      {item.riskKpiCount > 0 ? <WarningChip label={`위험 KPI ${item.riskKpiCount}건`} /> : null}
                      {item.overdueActionCount > 0 ? <WarningChip label={`Overdue ${item.overdueActionCount}건`} /> : null}
                      {item.agenda[0]?.topic ? <InfoBadge label={item.agenda[0].topic} /> : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CheckinListSection({
  records,
  filters,
  departments,
  teamMembers,
  onChangeFilters,
  onSelectRecord,
  selectedRecordId,
}: {
  records: CheckinRecordViewModel[]
  filters: {
    status: string
    ownerId: string
    department: string
    riskOnly: boolean
    type: string
  }
  departments: string[]
  teamMembers: CheckinPageViewModel['teamMembers']
  onChangeFilters: (filters: {
    status: string
    ownerId: string
    department: string
    riskOnly: boolean
    type: string
  }) => void
  onSelectRecord: (id: string) => void
  selectedRecordId?: string
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader
        title="목록"
        description="상태, 대상자, 팀, 위험 KPI 여부로 체크인을 빠르게 좁히고 상세 패널로 이어집니다."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SelectorCard
          label="상태"
          value={filters.status}
          options={[
            { value: 'ALL', label: '전체' },
            ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(value) => onChangeFilters({ ...filters, status: value })}
        />
        <SelectorCard
          label="대상자"
          value={filters.ownerId}
          options={[
            { value: 'ALL', label: '전체' },
            ...teamMembers.map((member) => ({ value: member.id, label: member.name })),
          ]}
          onChange={(value) => onChangeFilters({ ...filters, ownerId: value })}
        />
        <SelectorCard
          label="팀"
          value={filters.department}
          options={[{ value: 'ALL', label: '전체' }, ...departments.map((dept) => ({ value: dept, label: dept }))]}
          onChange={(value) => onChangeFilters({ ...filters, department: value })}
        />
        <SelectorCard
          label="유형"
          value={filters.type}
          options={[
            { value: 'ALL', label: '전체' },
            ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(value) => onChangeFilters({ ...filters, type: value })}
        />
        <label className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-600">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">KPI 위험</span>
          <input
            type="checkbox"
            checked={filters.riskOnly}
            onChange={(event) => onChangeFilters({ ...filters, riskOnly: event.target.checked })}
            className="mr-2 align-middle"
          />
          위험 신호만 보기
        </label>
      </div>

      {!records.length ? (
        <div className="mt-6">
          <EmptyBlock title="조건에 맞는 체크인이 없습니다." description="필터를 완화하거나 다른 기간을 확인해 보세요." />
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto xl:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4 font-medium">일정 일시</th>
                  <th className="py-3 pr-4 font-medium">대상자</th>
                  <th className="py-3 pr-4 font-medium">유형</th>
                  <th className="py-3 pr-4 font-medium">상태</th>
                  <th className="py-3 pr-4 font-medium">준비 상태</th>
                  <th className="py-3 pr-4 font-medium">KPI 위험</th>
                  <th className="py-3 pr-4 font-medium">액션아이템</th>
                  <th className="py-3 font-medium">최근 체크인 요약</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className={`cursor-pointer transition hover:bg-slate-50 ${
                      selectedRecordId === record.id ? 'bg-slate-50' : ''
                    }`}
                    onClick={() => onSelectRecord(record.id)}
                  >
                    <td className="py-4 pr-4 text-slate-700">{formatDateTime(record.scheduledAt)}</td>
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-900">{record.owner.name}</div>
                      <div className="text-xs text-slate-500">{record.owner.department}</div>
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{TYPE_LABELS[record.type]}</td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{record.agenda.length ? '준비됨' : '준비 필요'}</td>
                    <td className="py-4 pr-4">
                      {record.riskKpiCount > 0 ? <WarningChip label={`${record.riskKpiCount}건`} /> : <span className="text-xs text-slate-400">없음</span>}
                    </td>
                    <td className="py-4 pr-4 text-slate-600">{record.actionItemCount}건</td>
                    <td className="py-4 text-slate-600">{record.recentCheckinSummary ?? '지난 기록 없음'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3 xl:hidden">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRecord(record.id)}
                className={`rounded-2xl border p-4 text-left shadow-sm ${
                  selectedRecordId === record.id ? 'border-slate-900 bg-slate-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{record.owner.name}</div>
                    <div className="text-sm text-slate-500">
                      {formatDateTime(record.scheduledAt)} · {TYPE_LABELS[record.type]}
                    </div>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.riskKpiCount > 0 ? <WarningChip label={`위험 KPI ${record.riskKpiCount}건`} /> : null}
                  <InfoBadge label={`액션 ${record.actionItemCount}건`} />
                  <InfoBadge label={record.agenda.length ? '준비됨' : '준비 필요'} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{record.recentCheckinSummary ?? '지난 체크인 요약이 없습니다.'}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function CheckinActionsSection({
  actions,
  teamMembers,
  filters,
  onChangeFilters,
  onToggleAction,
  isPending,
}: {
  actions: CheckinActionItemViewModel[]
  teamMembers: CheckinPageViewModel['teamMembers']
  filters: {
    assignee: string
    ownerId: string
    overdueOnly: boolean
    incompleteOnly: boolean
  }
  onChangeFilters: (filters: {
    assignee: string
    ownerId: string
    overdueOnly: boolean
    incompleteOnly: boolean
  }) => void
  onToggleAction: (action: CheckinActionItemViewModel) => Promise<void>
  isPending: boolean
}) {
  const assigneeOptions = Array.from(new Set(actions.map((item) => item.assignee))).sort()

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader
        title="실행 항목"
        description="체크인이 대화로 끝나지 않고 실제 실행으로 이어지는지, overdue가 어디서 발생하는지 추적합니다."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SelectorCard
          label="담당자"
          value={filters.assignee}
          options={[{ value: 'ALL', label: '전체' }, ...assigneeOptions.map((value) => ({ value, label: value }))]}
          onChange={(value) => onChangeFilters({ ...filters, assignee: value })}
        />
        <SelectorCard
          label="대상자"
          value={filters.ownerId}
          options={[
            { value: 'ALL', label: '전체' },
            ...teamMembers.map((member) => ({ value: member.id, label: member.name })),
          ]}
          onChange={(value) => onChangeFilters({ ...filters, ownerId: value })}
        />
        <label className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-600">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Overdue</span>
          <input
            type="checkbox"
            checked={filters.overdueOnly}
            onChange={(event) => onChangeFilters({ ...filters, overdueOnly: event.target.checked })}
            className="mr-2 align-middle"
          />
          overdue만 보기
        </label>
        <label className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-600">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">완료 여부</span>
          <input
            type="checkbox"
            checked={filters.incompleteOnly}
            onChange={(event) => onChangeFilters({ ...filters, incompleteOnly: event.target.checked })}
            className="mr-2 align-middle"
          />
          미완료만 보기
        </label>
      </div>

      {!actions.length ? (
        <div className="mt-6">
          <EmptyBlock title="실행 항목이 없습니다." description="완료된 체크인에서 등록된 실행 항목이 이곳에 모입니다." />
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`rounded-2xl border p-4 ${action.overdue && !action.completed ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-slate-900">{action.title}</span>
                    <PriorityBadge priority={action.priority} />
                    {action.overdue && !action.completed ? <WarningChip label="Overdue" /> : null}
                  </div>
                  <div className="text-sm text-slate-500">
                    담당자 {action.assignee} · 대상자 {action.ownerName} · 연결 체크인 {formatDateTime(action.checkinDate)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={action.completed}
                      disabled={isPending}
                      onChange={() => void onToggleAction(action)}
                    />
                    완료 처리
                  </label>
                  <Link href={`/checkin/${action.checkinId}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    상세 보기
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CheckinHistorySection({
  history,
  onSelectRecord,
}: {
  history: CheckinPageViewModel['history']
  onSelectRecord: (id: string) => void
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader
        title="지난 기록"
        description="지난 체크인의 흐름과 핵심 논의, 액션 결과를 타임라인처럼 이어서 확인합니다."
      />
      {!history.length ? (
        <EmptyBlock title="지난 체크인 기록이 없습니다." description="완료된 체크인이 쌓이면 이곳에서 맥락을 추적할 수 있습니다." />
      ) : (
        <div className="mt-6 space-y-4">
          {history.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectRecord(item.id)}
              className="flex w-full gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left hover:border-slate-300"
            >
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-slate-900" />
                {index !== history.length - 1 ? <div className="mt-2 h-full w-px bg-gray-200" /> : null}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{item.ownerName}</div>
                    <div className="text-sm text-slate-500">{formatDateTime(item.date)}</div>
                  </div>
                  <InfoBadge label={item.actionSummary ?? '실행 항목 없음'} />
                </div>
                <p className="text-sm text-slate-700">{item.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {item.keyTopics.map((topic) => (
                    <InfoBadge key={topic} label={topic} />
                  ))}
                  {item.kpiDeltaSummary ? <InfoBadge label={item.kpiDeltaSummary} /> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function CheckinPreparationSection({
  prep,
  selectedRecord,
  focusEmployee,
}: {
  prep?: CheckinPreparationViewModel
  selectedRecord: CheckinRecordViewModel | null
  focusEmployee?: CheckinPageViewModel['focusEmployee']
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader
        title="준비 자료"
        description="개인 KPI, 최근 월간 실적, 피드백, 미완료 후속 조치를 연결해서 이번 체크인의 준비 포인트를 정리합니다."
      />
      {!prep ? (
        <EmptyBlock title="준비 자료가 없습니다." description="대상 구성원을 선택하면 KPI와 최근 대화 근거를 이곳에서 확인할 수 있습니다." />
      ) : (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-medium text-slate-500">준비 대상</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">
                  {prep.employeeName}
                  <span className="ml-2 text-sm font-normal text-slate-500">{prep.department}</span>
                </div>
              </div>
              {selectedRecord ? <StatusBadge status={selectedRecord.status} /> : null}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PrepCard title="연결된 개인 KPI 요약" icon={<Target className="h-4 w-4" />}>
              {prep.kpis.length ? (
                <div className="space-y-3">
                  {prep.kpis.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {typeof item.achievementRate === 'number' ? `최근 달성률 ${item.achievementRate.toFixed(1)}%` : '최근 달성률 데이터 없음'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyInline>연결된 KPI가 없습니다.</EmptyInline>
              )}
            </PrepCard>

            <PrepCard title="최근 월간 실적" icon={<CalendarDays className="h-4 w-4" />}>
              {prep.monthlyRecords.length ? (
                <div className="space-y-3">
                  {prep.monthlyRecords.map((item) => (
                    <div key={`${item.month}-${item.comment ?? ''}`} className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">{item.month}</div>
                        {typeof item.achievementRate === 'number' ? <InfoBadge label={`달성률 ${item.achievementRate.toFixed(1)}%`} /> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{item.comment ?? '활동 메모가 없습니다.'}</p>
                      {item.obstacles ? <p className="mt-1 text-xs text-amber-700">장애 요인: {item.obstacles}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyInline>최근 월간 실적 기록이 없습니다.</EmptyInline>
              )}
            </PrepCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PrepCard title="최근 피드백 / 메모" icon={<MessageSquareMore className="h-4 w-4" />}>
              {prep.feedbacks.length ? (
                <div className="space-y-3">
                  {prep.feedbacks.map((item) => (
                    <div key={`${item.date}-${item.author}`} className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-sm font-semibold text-slate-900">{item.author} · {formatDateTime(item.date)}</div>
                      <p className="mt-2 text-sm text-slate-600">{item.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyInline>최근 피드백이 없습니다.</EmptyInline>
              )}
            </PrepCard>

            <PrepCard title="지난 체크인에서 이어진 미완료 항목" icon={<ClipboardList className="h-4 w-4" />}>
              {prep.carryOverActions.length ? (
                <div className="space-y-2">
                  {prep.carryOverActions.map((item) => (
                    <div key={item} className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyInline>이월된 미완료 항목이 없습니다.</EmptyInline>
              )}
            </PrepCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <PrepCard title="이번 체크인에서 다루면 좋은 주제" icon={<Layers3 className="h-4 w-4" />}>
              <ul className="space-y-2 text-sm text-slate-700">
                {prep.suggestedTopics.map((topic) => (
                  <li key={topic} className="rounded-2xl border border-gray-200 bg-white px-3 py-2">{topic}</li>
                ))}
              </ul>
            </PrepCard>
            <PrepCard title="리더 준비 포인트" icon={<Users className="h-4 w-4" />}>
              <ul className="space-y-2 text-sm text-slate-700">
                {prep.leaderPrepPoints.map((topic) => (
                  <li key={topic} className="rounded-2xl border border-gray-200 bg-white px-3 py-2">{topic}</li>
                ))}
              </ul>
            </PrepCard>
            <PrepCard title="구성원 준비 포인트" icon={<CheckCircle2 className="h-4 w-4" />}>
              <ul className="space-y-2 text-sm text-slate-700">
                {prep.memberPrepPoints.map((topic) => (
                  <li key={topic} className="rounded-2xl border border-gray-200 bg-white px-3 py-2">{topic}</li>
                ))}
              </ul>
            </PrepCard>
          </div>

          {focusEmployee && !selectedRecord ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-500">
              현재 선택된 체크인이 없어 {focusEmployee.name} 기준 준비 자료를 보여주고 있습니다.
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function CheckinDetailDrawer({
  record,
  prep,
  editForm,
  completeForm,
  isPending,
  onClose,
  onChangeEditForm,
  onChangeCompleteForm,
  onSave,
  onComplete,
  onCancel,
  onToggleAction,
  onOpenNext,
}: {
  record: CheckinRecordViewModel | null
  prep?: CheckinPreparationViewModel
  editForm: EditCheckinFormState
  completeForm: CompleteCheckinFormState
  isPending: boolean
  onClose: () => void
  onChangeEditForm: (value: EditCheckinFormState) => void
  onChangeCompleteForm: (value: CompleteCheckinFormState) => void
  onSave: (record: CheckinRecordViewModel) => Promise<void>
  onComplete: (record: CheckinRecordViewModel) => Promise<void>
  onCancel: (record: CheckinRecordViewModel) => Promise<void>
  onToggleAction: (action: CheckinActionItemViewModel) => Promise<void>
  onOpenNext: (record: CheckinRecordViewModel) => void
}) {
  if (!record) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-gray-200 bg-white shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={record.status} />
              {record.riskKpiCount > 0 ? <WarningChip label={`위험 KPI ${record.riskKpiCount}건`} /> : null}
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">{record.owner.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {TYPE_LABELS[record.type]} · {formatDateTime(record.scheduledAt)} · 매니저 {record.manager.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-3 py-1 text-sm text-slate-500">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <DrawerCard title="기본 정보">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoRow label="상태" value={STATUS_LABELS[record.status]} />
                <InfoRow label="부서" value={record.owner.department} />
                <InfoRow label="일정" value={formatDateTime(record.scheduledAt)} />
                <InfoRow label="최근 체크인 요약" value={record.recentCheckinSummary ?? '없음'} />
              </div>
            </DrawerCard>

            <DrawerCard title="아젠다 / 메모">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">일정</label>
                  <input type="datetime-local" value={editForm.scheduledDate} disabled={!record.canEdit || isPending} onChange={(event) => onChangeEditForm({ ...editForm, scheduledDate: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">아젠다</label>
                  <textarea rows={4} value={editForm.agendaText} disabled={!record.canEdit || isPending} onChange={(event) => onChangeEditForm({ ...editForm, agendaText: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" placeholder="한 줄에 한 주제로 입력하세요." />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">구성원 메모</label>
                  <textarea rows={3} value={editForm.ownerNotes} disabled={!record.canEdit || isPending} onChange={(event) => onChangeEditForm({ ...editForm, ownerNotes: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">리더 메모</label>
                  <textarea rows={3} value={editForm.managerNotes} disabled={!record.canEdit || isPending} onChange={(event) => onChangeEditForm({ ...editForm, managerNotes: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!record.canEdit || isPending} onClick={() => void onSave(record)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    저장
                  </button>
                  <button type="button" disabled={!record.canCancel || isPending} onClick={() => void onCancel(record)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">
                    취소 처리
                  </button>
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="실행 항목">
              <div className="space-y-3">
                {record.actionItems.length ? (
                  record.actionItems.map((item, index) => (
                    <div key={`${record.id}-${index}`} className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{item.action}</div>
                          <div className="text-sm text-slate-500">
                            {item.assignee} · {item.dueDate ? formatShortDate(item.dueDate) : 'due date 없음'}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed)}
                            disabled={isPending}
                            onChange={() =>
                              void onToggleAction({
                                id: `${record.id}-${index}`,
                                title: item.action,
                                assignee: item.assignee,
                                dueDate: item.dueDate,
                                completed: Boolean(item.completed),
                                priority: item.priority ?? 'MEDIUM',
                                checkinId: record.id,
                                checkinDate: record.actualAt ?? record.scheduledAt,
                                ownerName: record.owner.name,
                                ownerId: record.owner.id,
                                sourceIndex: index,
                                overdue: isOverdueDate(item.dueDate, Boolean(item.completed)),
                              })
                            }
                          />
                          완료
                        </label>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyInline>등록된 실행 항목이 없습니다.</EmptyInline>
                )}
              </div>
            </DrawerCard>

            {record.canComplete ? (
              <DrawerCard title="완료 처리 / 회고">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormNumber label="소요 시간(분)" value={completeForm.duration} onChange={(value) => onChangeCompleteForm({ ...completeForm, duration: value })} />
                    <FormNumber label="장애 요인 수" value={completeForm.blockerCount} onChange={(value) => onChangeCompleteForm({ ...completeForm, blockerCount: value })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">핵심 요약</label>
                    <textarea rows={3} value={completeForm.keyTakeaways} onChange={(event) => onChangeCompleteForm({ ...completeForm, keyTakeaways: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">매니저 회고</label>
                    <textarea rows={3} value={completeForm.managerNotes} onChange={(event) => onChangeCompleteForm({ ...completeForm, managerNotes: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectorCard label="에너지 레벨" value={String(completeForm.energyLevel)} options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}점` }))} onChange={(value) => onChangeCompleteForm({ ...completeForm, energyLevel: Number(value) })} />
                    <SelectorCard label="업무 만족도" value={String(completeForm.satisfactionLevel)} options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}점` }))} onChange={(value) => onChangeCompleteForm({ ...completeForm, satisfactionLevel: Number(value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">다음 체크인 예약</label>
                    <input type="datetime-local" value={completeForm.nextCheckInDate} onChange={(event) => onChangeCompleteForm({ ...completeForm, nextCheckInDate: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <EditableActionItems form={completeForm} onChange={onChangeCompleteForm} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void onComplete(record)} disabled={isPending} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      완료 처리
                    </button>
                    <button type="button" onClick={() => onOpenNext(record)} disabled={isPending} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-slate-700">
                      다음 체크인 예약
                    </button>
                  </div>
                </div>
              </DrawerCard>
            ) : null}

            <DrawerCard title="관련 KPI / 준비 자료">
              {prep ? (
                <div className="space-y-3">
                  {prep.kpis.length ? (
                    prep.kpis.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <div className="text-sm text-slate-500">
                          {typeof item.achievementRate === 'number' ? `최근 달성률 ${item.achievementRate.toFixed(1)}%` : '달성률 데이터 없음'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyInline>관련 KPI가 없습니다.</EmptyInline>
                  )}
                  {prep.suggestedTopics.length ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">이번 체크인에서 다루면 좋은 주제</div>
                      <ul className="mt-2 space-y-2 text-sm text-slate-600">
                        {prep.suggestedTopics.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyInline>관련 준비 자료가 없습니다.</EmptyInline>
              )}
            </DrawerCard>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateCheckinModal({
  open,
  canManageTeam,
  teamMembers,
  form,
  isPending,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean
  canManageTeam: boolean
  teamMembers: CheckinPageViewModel['teamMembers']
  form: NewCheckinFormState
  isPending: boolean
  onClose: () => void
  onChange: (value: NewCheckinFormState) => void
  onSubmit: () => Promise<void>
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <div className="text-sm font-medium text-slate-500">새 일정</div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">체크인 예약</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-3 py-1 text-sm text-slate-500">
            닫기
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectorCard
              label="체크인 유형"
              value={form.checkInType}
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={(value) => onChange({ ...form, checkInType: value })}
            />
            {canManageTeam ? (
              <SelectorCard
                label="대상자"
                value={form.ownerId}
                options={teamMembers.map((member) => ({
                  value: member.id,
                  label: `${member.name} · ${member.department}`,
                }))}
                onChange={(value) => onChange({ ...form, ownerId: value })}
              />
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">일정</label>
            <input type="datetime-local" value={form.scheduledDate} onChange={(event) => onChange({ ...form, scheduledDate: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">아젠다</label>
            <textarea rows={4} value={form.agendaText} onChange={(event) => onChange({ ...form, agendaText: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" placeholder="한 줄에 한 주제로 입력하세요." />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">사전 메모</label>
            <textarea rows={3} value={form.ownerNotes} onChange={(event) => onChange({ ...form, ownerNotes: event.target.value })} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-slate-700">
              취소
            </button>
            <button type="button" disabled={isPending} onClick={() => void onSubmit()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              예약하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditableActionItems({
  form,
  onChange,
}: {
  form: CompleteCheckinFormState
  onChange: (value: CompleteCheckinFormState) => void
}) {
  function updateItem(index: number, key: keyof CompleteCheckinFormState['actionItems'][number], value: string | boolean) {
    const nextItems = form.actionItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    onChange({ ...form, actionItems: nextItems })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">실행 항목</label>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...form,
              actionItems: [...form.actionItems, { action: '', assignee: '', dueDate: '', completed: false, priority: 'MEDIUM' }],
            })
          }
          className="text-sm font-medium text-blue-600"
        >
          + 추가
        </button>
      </div>
      {form.actionItems.length ? (
        <div className="space-y-3">
          {form.actionItems.map((item, index) => (
            <div key={`${item.action}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="grid gap-3">
                <input value={item.action} onChange={(event) => updateItem(index, 'action', event.target.value)} placeholder="실행 항목" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <div className="grid gap-3 md:grid-cols-3">
                  <input value={item.assignee} onChange={(event) => updateItem(index, 'assignee', event.target.value)} placeholder="담당자" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                  <input type="date" value={item.dueDate} onChange={(event) => updateItem(index, 'dueDate', event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                  <SelectorCard
                    label="우선순위"
                    compact
                    value={item.priority}
                    options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                    onChange={(value) => updateItem(index, 'priority', value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyInline>체크인 후 이어갈 실행 항목을 추가하세요.</EmptyInline>
      )}
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function SelectorCard({
  label,
  value,
  options,
  onChange,
  disabled,
  compact = false,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <label className={`rounded-2xl border border-gray-200 bg-gray-50 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      {!compact ? <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</span> : null}
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || options.length === 0} className="w-full bg-transparent text-sm text-slate-700 outline-none disabled:text-slate-400">
        {options.length ? options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : <option value="">{compact ? label : '선택 가능한 항목이 없습니다.'}</option>}
      </select>
    </label>
  )
}

function ActionButton({
  children,
  icon,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: ReactNode
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'primary' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-gray-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function StatePanel({ state, message }: { state: CheckinPageData['state']; message?: string }) {
  const content =
    state === 'permission-denied'
      ? { title: '체크인 정보를 볼 권한이 없습니다.', description: message ?? '권한 범위를 확인해 주세요.' }
      : { title: '체크인 화면을 불러오지 못했습니다.', description: message ?? '잠시 후 다시 시도해 주세요.' }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <AlertTriangle className="h-6 w-6 text-slate-500" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-900">{content.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{content.description}</p>
    </section>
  )
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}

function EmptyInline({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-500">{children}</div>
}

function HeroMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'IN_PROGRESS'
        ? 'bg-amber-100 text-amber-700'
        : status === 'RESCHEDULED'
          ? 'bg-orange-100 text-orange-700'
          : status === 'CANCELLED'
            ? 'bg-slate-100 text-slate-500'
            : 'bg-blue-100 text-blue-700'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{STATUS_LABELS[status] ?? status}</span>
}

function InfoBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{label}</span>
}

function WarningChip({ label }: { label: string }) {
  return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">{label}</span>
}

function PriorityBadge({ priority }: { priority: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const className = priority === 'HIGH' ? 'bg-rose-100 text-rose-700' : priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{PRIORITY_LABELS[priority]}</span>
}

function PrepCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DrawerCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function FormNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
    </label>
  )
}

function RelatedActionLinks() {
  const links = [
    { href: '/kpi/personal', label: '개인 KPI 보기', icon: Target },
    { href: '/kpi/monthly', label: '월간 실적 보기', icon: CalendarDays },
    { href: '/evaluation/results', label: '평가 결과 보기', icon: Layers3 },
    { href: '/notifications', label: '알림 센터', icon: MessageSquareMore },
  ]

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <SectionHeader title="관련 화면 바로가기" description="체크인에서 바로 이어서 확인하면 좋은 KPI, 실적, 평가, 알림 화면입니다." />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-slate-500" />
              {label}
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  )
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatTime(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function toDateTimeLocal(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const normalized = new Date(date.getTime() - offset * 60_000)
  return normalized.toISOString().slice(0, 16)
}

function isToday(value: string) {
  const current = new Date()
  const date = new Date(value)
  return current.getFullYear() === date.getFullYear() && current.getMonth() === date.getMonth() && current.getDate() === date.getDate()
}

function groupRecordsByDate(records: CheckinRecordViewModel[]) {
  const map = new Map<string, CheckinRecordViewModel[]>()
  records.forEach((record) => {
    const dateKey = record.scheduledAt.slice(0, 10)
    const bucket = map.get(dateKey) ?? []
    bucket.push(record)
    map.set(dateKey, bucket)
  })

  return Array.from(map.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, items]) => ({
      date,
      label: new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
      items,
    }))
}

function isOverdueDate(dateString?: string, completed?: boolean) {
  if (!dateString || completed) return false
  const date = new Date(dateString)
  date.setHours(23, 59, 59, 999)
  return date.getTime() < Date.now()
}
