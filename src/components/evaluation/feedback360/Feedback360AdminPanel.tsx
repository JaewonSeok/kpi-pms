'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Mail, Settings2, Trash2, X } from 'lucide-react'
import type { Feedback360PageData } from '@/server/feedback-360'
import { MultiRaterTimeline } from './MultiRaterTimeline'
import { ResponseRateCard } from './ResponseRateCard'

type Banner = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type ReminderAction =
  | 'send-review-reminder'
  | 'send-peer-selection-reminder'
  | 'send-result-share'

type VisibilityLevel = 'FULL' | 'ANONYMOUS' | 'PRIVATE'

const DEFAULT_SELECTION_SETTINGS = {
  requireLeaderApproval: false,
  allowPreferredPeers: false,
  excludeLeaderFromPeerSelection: false,
  excludeDirectReportsFromPeerSelection: false,
}

const DEFAULT_VISIBILITY_SETTINGS: Record<string, VisibilityLevel> = {
  SELF: 'FULL',
  SUPERVISOR: 'FULL',
  PEER: 'ANONYMOUS',
  SUBORDINATE: 'ANONYMOUS',
  CROSS_TEAM_PEER: 'ANONYMOUS',
  CROSS_DEPT: 'ANONYMOUS',
}

const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  FULL: '작성자 정보 포함',
  ANONYMOUS: '익명 공개',
  PRIVATE: '운영자만 조회',
}

const REVIEWER_TYPE_LABELS: Record<string, string> = {
  SELF: '셀프',
  SUPERVISOR: '상향 / 리더',
  PEER: '동료',
  SUBORDINATE: '하향',
  CROSS_TEAM_PEER: '타 팀 동료',
  CROSS_DEPT: '타 부서',
}

function getReminderKind(action: ReminderAction) {
  if (action === 'send-peer-selection-reminder') return 'peer-selection-reminder'
  if (action === 'send-result-share') return 'result-share'
  return 'review-reminder'
}

function getReminderTemplate(roundName: string, action: ReminderAction) {
  if (action === 'send-peer-selection-reminder') {
    return {
      subject: `[360 리뷰] ${roundName} 동료 선택 / 승인 확인 요청`,
      body: `안녕하세요.\n\n${roundName}의 동료 선택 또는 승인 단계가 아직 완료되지 않았습니다.\n현재 구성을 확인하고 필요한 수정 또는 승인을 진행해 주세요.\n\n감사합니다.`,
    }
  }

  if (action === 'send-result-share') {
    return {
      subject: `[360 리뷰] ${roundName} 결과 공유 안내`,
      body: `안녕하세요.\n\n${roundName} 결과가 준비되었습니다.\n현재 공개 범위와 익명 기준을 확인한 뒤 결과를 열람해 주세요.\n\n감사합니다.`,
    }
  }

  return {
    subject: `[360 리뷰] ${roundName} 응답 리마인드`,
    body: `안녕하세요.\n\n${roundName}의 리뷰 응답이 아직 제출되지 않았습니다.\n마감 전에 응답을 완료해 주세요.\n\n감사합니다.`,
  }
}

export function Feedback360AdminPanel(props: { data: Feedback360PageData }) {
  const router = useRouter()
  const rounds = props.data.availableRounds
  const admin = props.data.admin

  const [banner, setBanner] = useState<Banner | null>(null)
  const [folderFilter, setFolderFilter] = useState<'ALL' | 'UNCATEGORIZED' | string>('ALL')
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selectedRoundId, setSelectedRoundId] = useState(props.data.selectedRoundId ?? rounds[0]?.id ?? '')
  const [folderDraft, setFolderDraft] = useState({ id: '', name: '', description: '' })
  const [reminderAction, setReminderAction] = useState<ReminderAction>('send-review-reminder')
  const [reminderSearch, setReminderSearch] = useState('')
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const [reminderSubject, setReminderSubject] = useState('')
  const [reminderBody, setReminderBody] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [selectionSettings, setSelectionSettings] = useState(DEFAULT_SELECTION_SETTINGS)
  const [visibilitySettings, setVisibilitySettings] = useState<Record<string, VisibilityLevel>>(DEFAULT_VISIBILITY_SETTINGS)

  const selectedRound = rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null
  const selectedReminderKind = getReminderKind(reminderAction)

  const folderCards = useMemo(
    () => [
      { id: 'ALL', name: '전체 라운드', count: rounds.length },
      { id: 'UNCATEGORIZED', name: '미분류', count: rounds.filter((round) => !round.folderId).length },
      ...(admin?.folders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        count: rounds.filter((round) => round.folderId === folder.id).length,
      })),
    ],
    [admin?.folders, rounds]
  )

  const filteredRounds = useMemo(
    () =>
      rounds.filter((round) => {
        if (folderFilter === 'ALL') return true
        if (folderFilter === 'UNCATEGORIZED') return !round.folderId
        return round.folderId === folderFilter
      }),
    [folderFilter, rounds]
  )

  const filteredReminderTargets = useMemo(
    () =>
      (admin?.reminderTargets ?? []).filter((item) => {
        if (selectedRoundId && item.roundId !== selectedRoundId) return false
        if (item.kind !== selectedReminderKind) return false
        if (!reminderSearch.trim()) return true
        const keyword = reminderSearch.trim()
        return (
          item.recipientName.includes(keyword) ||
          item.roundName.includes(keyword) ||
          item.detail.includes(keyword) ||
          item.departmentName?.includes(keyword)
        )
      }),
    [admin?.reminderTargets, reminderSearch, selectedReminderKind, selectedRoundId]
  )

  const healthSummary = useMemo(() => {
    const source = admin?.roundHealth ?? []
    return {
      lowResponseCount: source.filter((item) => item.responseRate < 60).length,
      riskCount: source.reduce((sum, item) => sum + item.qualityRiskCount, 0),
      pendingCount: source.reduce((sum, item) => sum + item.pendingCount, 0),
    }
  }, [admin?.roundHealth])

  useEffect(() => {
    setBanner(null)
    setFolderDialogOpen(false)
    setSettingsDialogOpen(false)
    setReminderDialogOpen(false)
    setSelectedRoundId(props.data.selectedRoundId ?? rounds[0]?.id ?? '')
  }, [props.data.selectedCycleId, props.data.selectedRoundId, rounds])

  useEffect(() => {
    const nextSelection = selectedRound?.selectionSettings ?? admin?.settings?.selectionSettings ?? DEFAULT_SELECTION_SETTINGS
    const nextVisibility = selectedRound?.visibilitySettings ?? admin?.settings?.visibilitySettings ?? DEFAULT_VISIBILITY_SETTINGS
    setSelectionSettings(nextSelection)
    setVisibilitySettings(nextVisibility)
  }, [admin?.settings?.selectionSettings, admin?.settings?.visibilitySettings, selectedRound])

  useEffect(() => {
    const availableIds = new Set(filteredReminderTargets.map((item) => item.recipientId))
    setSelectedTargetIds((current) => current.filter((item) => availableIds.has(item)))
  }, [filteredReminderTargets])

  useEffect(() => {
    const template = getReminderTemplate(selectedRound?.roundName ?? '360 리뷰', reminderAction)
    setReminderSubject(template.subject)
    setReminderBody(template.body)
  }, [reminderAction, selectedRound])

  function selectAllMatchingTargets() {
    const allIds = Array.from(new Set(filteredReminderTargets.map((item) => item.recipientId)))
    setSelectedTargetIds(allIds)
  }

  function toggleTarget(recipientId: string) {
    setSelectedTargetIds((current) =>
      current.includes(recipientId)
        ? current.filter((item) => item !== recipientId)
        : [...current, recipientId]
    )
  }

  async function refreshWithMessage(message: string) {
    setBanner({ tone: 'success', message })
    router.refresh()
  }

  async function handleAssignFolder(roundId: string, folderId: string) {
    setBusy(true)
    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(roundId)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderId || null }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '폴더를 저장하지 못했습니다.')
      }
      await refreshWithMessage('라운드 폴더를 저장했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '폴더를 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveFolder() {
    setBusy(true)
    try {
      const response = await fetch('/api/feedback/folders', {
        method: folderDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(folderDraft.id ? { id: folderDraft.id } : {}),
          name: folderDraft.name,
          description: folderDraft.description,
          sortOrder: 0,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '폴더를 저장하지 못했습니다.')
      }
      setFolderDialogOpen(false)
      setFolderDraft({ id: '', name: '', description: '' })
      await refreshWithMessage(folderDraft.id ? '폴더를 수정했습니다.' : '폴더를 만들었습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '폴더를 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteFolder(folderId: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/feedback/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '폴더를 삭제하지 못했습니다.')
      }
      if (folderFilter === folderId) {
        setFolderFilter('ALL')
      }
      setFolderDraft({ id: '', name: '', description: '' })
      await refreshWithMessage('폴더를 삭제하고 라운드를 미분류로 되돌렸습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '폴더를 삭제하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSettings() {
    if (!selectedRound) return

    setBusy(true)
    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedRound.folderId ?? null,
          selectionSettings,
          visibilitySettings,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '라운드 설정을 저장하지 못했습니다.')
      }
      setSettingsDialogOpen(false)
      await refreshWithMessage('동료 선택 규칙과 익명 공개 범위를 저장했습니다.')
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '라운드 설정을 저장하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleReminder(mode: 'test' | 'send') {
    if (!selectedRound) return

    setBusy(true)
    try {
      const response = await fetch(`/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode === 'test' ? 'test-send' : reminderAction,
          roundId: selectedRound.id,
          targetIds: selectedTargetIds.length
            ? selectedTargetIds
            : Array.from(new Set(filteredReminderTargets.map((item) => item.recipientId))),
          subject: reminderSubject,
          body: reminderBody,
          testEmail: mode === 'test' ? testEmail : undefined,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        throw new Error(json.error?.message || '리마인드를 발송하지 못했습니다.')
      }
      if (mode === 'test') {
        setBanner({ tone: 'info', message: '테스트 발송을 완료했습니다.' })
      } else {
        setReminderDialogOpen(false)
        await refreshWithMessage(json.data?.message ?? '리마인드 발송을 예약했습니다.')
      }
    } catch (error) {
      setBanner({
        tone: 'error',
        message: error instanceof Error ? error.message : '리마인드를 발송하지 못했습니다.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {banner ? <BannerBox banner={banner} onClose={() => setBanner(null)} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ResponseRateCard
          title="운영 전체 상태"
          responseRate={props.data.summary.averageResponseRate}
          submittedCount={props.data.summary.submittedResponses}
          pendingCount={props.data.summary.pendingResponses}
          description={`활성 라운드 ${props.data.summary.activeRounds}개`}
        />
        <MetricCard label="응답률 주의 라운드" value={`${healthSummary.lowResponseCount}개`} tone="amber" />
        <MetricCard label="품질 위험 응답" value={`${healthSummary.riskCount}건`} tone="rose" />
        <MetricCard label="남은 미응답" value={`${healthSummary.pendingCount}건`} tone="slate" />
      </section>

      <Panel
        title="리뷰 폴더"
        description="상단 폴더 strip으로 라운드를 묶어 보고, 미분류 버킷과 새 폴더 생성을 함께 운영합니다."
        action={
          <button
            type="button"
            onClick={() => {
              setFolderDraft({ id: '', name: '', description: '' })
              setFolderDialogOpen(true)
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderPlus className="h-4 w-4" />
            새 폴더
          </button>
        }
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {folderCards.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setFolderFilter(folder.id)}
              className={`min-w-[180px] rounded-2xl border px-4 py-4 text-left transition ${
                folderFilter === folder.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">Folder</div>
              <div className="mt-2 text-sm font-semibold">{folder.name}</div>
              <div className="mt-3 text-xs opacity-80">라운드 {folder.count}개</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="리뷰 라운드 관리"
        description="폴더 선택 후 라운드를 고르고, 폴더 이동, 동료 설정, 익명 범위 조정, 리마인드 발송을 한 화면에서 처리합니다."
      >
        {filteredRounds.length ? (
          <div className="space-y-4">
            {filteredRounds.map((round) => (
              <div
                key={round.id}
                className={`rounded-2xl border p-4 transition ${
                  selectedRoundId === round.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRoundId(round.id)}
                        className="text-left text-base font-semibold text-slate-900"
                      >
                        {round.roundName}
                      </button>
                      <Badge>{round.roundType}</Badge>
                      <Badge tone={round.status === 'IN_PROGRESS' ? 'emerald' : 'slate'}>{round.status}</Badge>
                      {round.folderName ? <Badge tone="blue">{round.folderName}</Badge> : <Badge>미분류</Badge>}
                    </div>
                    <div className="text-sm text-slate-500">
                      {round.startDate} ~ {round.endDate} · 대상 {round.targetCount}명 · 제출 {round.submittedCount}건
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <MiniStat label="응답률" value={`${round.responseRate}%`} />
                      <MiniStat label="익명 기준" value={`${round.minRaters}명`} />
                      <MiniStat label="현재 폴더" value={round.folderName ?? '미분류'} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    <select
                      value={round.folderId ?? ''}
                      onChange={(event) => void handleAssignFolder(round.id, event.target.value)}
                      className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm text-slate-700"
                    >
                      <option value="">미분류</option>
                      {(admin?.folders ?? []).map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundId(round.id)
                        setSettingsDialogOpen(true)
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Settings2 className="h-4 w-4" />
                      동료 / 익명 설정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundId(round.id)
                        setReminderDialogOpen(true)
                      }}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Mail className="h-4 w-4" />
                      리마인드 발송
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock message="현재 필터에 맞는 라운드가 없습니다. 폴더를 바꾸거나 새 폴더를 만들어 운영 분류를 다시 잡아 보세요." />
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="승인 대기 / 결과 공유 대기"
          description="동료 선택 승인, 결과 공유, 미응답 리마인드 대상을 같은 운영 패널 안에서 빠르게 확인합니다."
        >
          <div className="space-y-3">
            {admin?.nominationQueue?.length ? (
              admin.nominationQueue.map((item) => (
                <div key={`${item.roundId}:${item.targetId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{item.targetName}</div>
                    <Badge>{item.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {item.roundName} · 승인 {item.approvedCount}/{item.totalCount} · 발행 {item.publishedCount}
                  </div>
                </div>
              ))
            ) : (
              <EmptyBlock message="현재 별도로 확인할 nomination 대기 건이 없습니다." />
            )}
          </div>
        </Panel>

        <Panel
          title="운영 알림"
          description="응답률 저하, careless review 의심, 익명 기준 미달 같은 운영 경고를 모아 봅니다."
        >
          <div className="space-y-3">
            {admin?.alerts?.length ? (
              admin.alerts.map((alert) => (
                <div key={alert} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {alert}
                </div>
              ))
            ) : (
              <EmptyBlock message="현재 별도 경고 없이 운영 중입니다." />
            )}
            <div className="grid gap-3">
              <ActionLink href="/evaluation/results" label="평가 결과 확인" />
              <ActionLink href="/evaluation/workbench" label="평가 워크벤치로 이동" />
              <ActionLink href="/admin/notifications" label="알림 운영 화면" />
            </div>
          </div>
        </Panel>
      </section>

      <Panel title="운영 타임라인" description="라운드 상태, 응답률, 마감일 기준으로 운영 이력을 한 줄로 파악합니다.">
        <MultiRaterTimeline items={admin?.timeline ?? []} />
      </Panel>

      {folderDialogOpen ? (
        <ModalFrame title="리뷰 폴더 관리" onClose={() => setFolderDialogOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-3">
              {(admin?.folders ?? []).length ? (
                admin?.folders.map((folder) => (
                  <div key={folder.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{folder.name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {folder.description || '설명이 없습니다.'} · 라운드 {folder.roundCount}개
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFolderDraft({
                              id: folder.id,
                              name: folder.name,
                              description: folder.description ?? '',
                            })
                          }
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFolder(folder.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyBlock message="아직 만든 폴더가 없습니다. 운영 목적에 맞게 라운드를 먼저 묶어 보세요." />
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">
                {folderDraft.id ? '폴더 수정' : '새 폴더 만들기'}
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">이름</span>
                  <input
                    value={folderDraft.name}
                    onChange={(event) => setFolderDraft((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                    placeholder="예: 2026 상반기 / 리더 후보군"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">설명</span>
                  <textarea
                    value={folderDraft.description}
                    onChange={(event) => setFolderDraft((current) => ({ ...current, description: event.target.value }))}
                    className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
                    placeholder="폴더를 어떤 운영 목적에 쓰는지 간단히 남겨두면 찾기 쉽습니다."
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setFolderDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void handleSaveFolder()}
                disabled={busy || !folderDraft.name.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {folderDraft.id ? '폴더 수정' : '폴더 생성'}
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {settingsDialogOpen && selectedRound ? (
        <ModalFrame title={`${selectedRound.roundName} 설정`} onClose={() => setSettingsDialogOpen(false)}>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">동료 선택 방식</div>
              <div className="mt-4 space-y-3">
                <ToggleLine
                  label="리더의 승인 필요"
                  description="동료 선정 초안을 제출한 뒤 리더가 승인해야 다음 단계로 넘어갑니다."
                  checked={selectionSettings.requireLeaderApproval}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, requireLeaderApproval: checked }))
                  }
                />
                <ToggleLine
                  label="리뷰를 써주고 싶은 동료 선택 가능"
                  description="대상자가 협업 빈도가 높은 동료를 직접 추천할 수 있게 합니다."
                  checked={selectionSettings.allowPreferredPeers}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, allowPreferredPeers: checked }))
                  }
                />
                <ToggleLine
                  label="리뷰 대상자는 본인의 리더 선택 불가"
                  description="리더 중복 지정을 막아 peer pool을 더 분명하게 유지합니다."
                  checked={selectionSettings.excludeLeaderFromPeerSelection}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, excludeLeaderFromPeerSelection: checked }))
                  }
                />
                <ToggleLine
                  label="리뷰 대상자는 본인의 팀원 선택 불가"
                  description="리더가 peer reviewer를 고를 때 직접 팀원을 자동 제외합니다."
                  checked={selectionSettings.excludeDirectReportsFromPeerSelection}
                  onChange={(checked) =>
                    setSelectionSettings((current) => ({ ...current, excludeDirectReportsFromPeerSelection: checked }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">진행 중 익명 / 공개 범위</div>
              <p className="mt-1 text-sm text-slate-500">
                리뷰가 진행 중이어도 reviewer type별로 공개 범위를 즉시 조정할 수 있습니다.
              </p>
              <div className="mt-4 space-y-4">
                {Object.entries(visibilitySettings).map(([relationship, value]) => (
                  <div key={relationship} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {REVIEWER_TYPE_LABELS[relationship] ?? relationship}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(VISIBILITY_LABELS) as VisibilityLevel[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setVisibilitySettings((current) => ({ ...current, [relationship]: option }))
                          }
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            value === option
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {VISIBILITY_LABELS[option]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettingsDialogOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void handleSaveSettings()}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                설정 저장
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {reminderDialogOpen && selectedRound ? (
        <ModalFrame title={`${selectedRound.roundName} 리마인드 발송`} onClose={() => setReminderDialogOpen(false)}>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {([
                ['send-review-reminder', '미제출자 리마인드'],
                ['send-peer-selection-reminder', '동료 선택 / 승인 리마인드'],
                ['send-result-share', '결과 공유'],
              ] as Array<[ReminderAction, string]>).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => setReminderAction(action)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    reminderAction === action
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">제목</span>
                <input
                  value={reminderSubject}
                  onChange={(event) => setReminderSubject(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">테스트 발송</span>
                <input
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  placeholder="example@company.com"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">본문</span>
              <textarea
                value={reminderBody}
                onChange={(event) => setReminderBody(event.target.value)}
                className="mt-2 min-h-36 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-700">
                  현재 선택 수 <span className="font-semibold text-slate-900">{selectedTargetIds.length}</span>명
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllMatchingTargets}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                  >
                    전체 {Array.from(new Set(filteredReminderTargets.map((item) => item.recipientId))).length}명 모두 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetIds([])}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <input
                  value={reminderSearch}
                  onChange={(event) => setReminderSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900"
                  placeholder="대상자, 라운드, 부서로 검색"
                />
              </div>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {filteredReminderTargets.length ? (
                  filteredReminderTargets.map((target, index) => {
                    const checked = selectedTargetIds.includes(target.recipientId)
                    return (
                      <label
                        key={`${target.roundId}:${target.recipientId}:${index}`}
                        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTarget(target.recipientId)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{target.recipientName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {target.departmentName ? `${target.departmentName} · ` : ''}
                            {target.detail}
                          </div>
                        </div>
                      </label>
                    )
                  })
                ) : (
                  <EmptyBlock message="현재 조건에 맞는 발송 대상자가 없습니다. 라운드 또는 발송 종류를 바꿔 보세요." />
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleReminder('test')}
                disabled={busy || !testEmail.trim() || !reminderSubject.trim() || !reminderBody.trim()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                테스트 발송
              </button>
              <button
                type="button"
                onClick={() => void handleReminder('send')}
                disabled={
                  busy ||
                  !selectedTargetIds.length ||
                  !reminderSubject.trim() ||
                  !reminderBody.trim()
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                리마인드 발송
              </button>
            </div>
          </div>
        </ModalFrame>
      ) : null}
    </div>
  )
}

function Panel(props: {
  title: string
  description: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{props.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{props.description}</p>
        </div>
        {props.action}
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

function MetricCard(props: { label: string; value: string; tone: 'slate' | 'amber' | 'rose' }) {
  const toneClass =
    props.tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : props.tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{props.label}</div>
      <div className="mt-3 text-2xl font-semibold">{props.value}</div>
    </div>
  )
}

function MiniStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{props.value}</div>
    </div>
  )
}

function Badge(props: { children: ReactNode; tone?: 'slate' | 'blue' | 'emerald' }) {
  const toneClass =
    props.tone === 'blue'
      ? 'bg-blue-100 text-blue-700'
      : props.tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{props.children}</span>
}

function ToggleLine(props: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <div>
        <div className="text-sm font-semibold text-slate-900">{props.label}</div>
        <div className="mt-1 text-sm leading-6 text-slate-500">{props.description}</div>
      </div>
    </label>
  )
}

function BannerBox(props: { banner: Banner; onClose: () => void }) {
  const toneClass =
    props.banner.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : props.banner.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'

  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      <div>{props.banner.message}</div>
      <button type="button" onClick={props.onClose} className="shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ModalFrame(props: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{props.title}</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  )
}
