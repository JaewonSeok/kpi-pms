'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, Download, RefreshCcw } from 'lucide-react'
import type {
  GoalAlignmentOrgNode,
  GoalAlignmentPageData,
  GoalAlignmentPersonalNode,
} from '@/server/goal-alignment'
import { formatRateBaseCopy } from '@/lib/metric-copy'

type SelectedItem =
  | { kind: 'org'; node: GoalAlignmentOrgNode }
  | { kind: 'personal'; node: GoalAlignmentPersonalNode }
  | null

function buildContextKey(data: GoalAlignmentPageData) {
  return `${data.selectedYear}:${data.selectedCycleId ?? ''}:${data.selectedDepartmentId}:${data.selectedStatus}`
}

export function GoalAlignmentClient({ data }: { data: GoalAlignmentPageData }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const contextKey = buildContextKey(data)
  const previousContextKey = useRef(contextKey)

  useEffect(() => {
    if (previousContextKey.current === contextKey) return
    previousContextKey.current = contextKey
    setSelectedId('')
    setActionMessage('')
  }, [contextKey])

  const flatItems = useMemo(() => {
    const items: Array<{ id: string; selected: SelectedItem }> = []
    function walk(node: GoalAlignmentOrgNode) {
      items.push({ id: node.id, selected: { kind: 'org', node } })
      node.personalGoals.forEach((goal) => items.push({ id: goal.id, selected: { kind: 'personal', node: goal } }))
      node.children.forEach(walk)
    }
    data.board.forEach(walk)
    data.orphanPersonalGoals.forEach((goal) => items.push({ id: goal.id, selected: { kind: 'personal', node: goal } }))
    return items
  }, [data.board, data.orphanPersonalGoals])

  const selectedItem = flatItems.find((item) => item.id === selectedId)?.selected ?? flatItems[0]?.selected ?? null

  function pushFilters(next: Partial<{ year: string; cycleId: string; departmentId: string; status: string }>) {
    const params = new URLSearchParams()
    params.set('year', next.year ?? String(data.selectedYear))
    if ((next.cycleId ?? data.selectedCycleId) && (next.cycleId ?? data.selectedCycleId) !== 'ALL') {
      params.set('cycleId', next.cycleId ?? data.selectedCycleId ?? '')
    }
    params.set('departmentId', next.departmentId ?? data.selectedDepartmentId)
    params.set('status', next.status ?? data.selectedStatus)
    startTransition(() => router.push(`/admin/goal-alignment?${params.toString()}`))
  }

  async function handleReminder(reminderType: 'goal' | 'checkpoint') {
    setActionMessage('')
    try {
      const response = await fetch('/api/cron/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'schedule',
          reminderTypes: [reminderType],
        }),
      })
      const json = (await response.json()) as { success?: boolean; error?: { message?: string } }
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? '리마인드 발송에 실패했습니다.')
      }
      setActionMessage(
        reminderType === 'goal'
          ? '목표 수립 리마인드를 전체 대상 기준으로 큐에 등록했습니다.'
          : '체크인 현황 리마인드를 전체 대상 기준으로 큐에 등록했습니다.'
      )
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '리마인드 발송 중 오류가 발생했습니다.')
    }
  }

  if (data.state === 'permission-denied' || data.state === 'error') {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-xl font-semibold text-slate-900">
          {data.state === 'permission-denied' ? '성과 얼라인먼트 화면에 접근할 수 없습니다.' : '성과 얼라인먼트 화면을 불러오지 못했습니다.'}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">{data.message}</p>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Goal Alignment</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{data.selectedYear}년 목표 얼라인먼트</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              전사/조직/개인 목표 연결 구조와 목표 수립 시즌 운영 지표를 같은 화면에서 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="목표 수립 리마인드" onClick={() => void handleReminder('goal')} />
            <ActionButton label="체크인 리마인드" onClick={() => void handleReminder('checkpoint')} />
            <LinkButton href={data.quickLinks.readModeHref} label="읽기 모드 설정" />
            <LinkButton href="/api/admin/goal-alignment/export" label="내보내기" appendQuery={`year=${data.selectedYear}&departmentId=${encodeURIComponent(data.selectedDepartmentId)}&status=${data.selectedStatus}${data.selectedCycleId ? `&cycleId=${encodeURIComponent(data.selectedCycleId)}` : ''}`} icon={<Download className="h-4 w-4" />} />
          </div>
        </div>

        {actionMessage ? <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{actionMessage}</p> : null}

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <MetricCard label="조직 목표" value={`${data.summary.orgGoalCount}개`} helper="현재 선택 조건에 포함된 조직 목표 수" />
          <MetricCard label="개인 목표" value={`${data.summary.personalGoalCount}개`} helper="현재 선택 조건에 포함된 개인 목표 수" />
          <MetricCard label="개인 목표 수립 비율" value={`${data.summary.personalGoalSetupRate}%`} helper={formatRateBaseCopy('대상 인원')} />
          <MetricCard label="체크인 완료 비율" value={`${data.summary.completedCheckInRate}%`} helper={formatRateBaseCopy('전체 체크인')} />
        </div>
      </section>

      {data.alerts.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            일부 데이터 소스를 불러오지 못해 부분 정보만 표시하고 있습니다.
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.alerts.map((alert) => (
              <div key={alert.title + alert.description} className="rounded-2xl border border-amber-200 bg-white/80 p-4">
                <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
                <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FilterField label="연도">
              <select value={String(data.selectedYear)} onChange={(event) => pushFilters({ year: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                {data.availableYears.map((year) => <option key={year} value={year}>{year}년</option>)}
              </select>
            </FilterField>
            <FilterField label="주기">
              <select value={data.selectedCycleId ?? 'ALL'} onChange={(event) => pushFilters({ cycleId: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="ALL">전체 주기</option>
                {data.cycleOptions.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.label}</option>)}
              </select>
            </FilterField>
            <FilterField label="조직">
              <select value={data.selectedDepartmentId} onChange={(event) => pushFilters({ departmentId: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                {data.departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.id === 'ALL' ? department.name : `${'· '.repeat(Math.max(0, department.level - 1))}${department.name}`}</option>)}
              </select>
            </FilterField>
            <FilterField label="상태">
              <select value={data.selectedStatus} onChange={(event) => pushFilters({ status: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm">
                {data.statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">운영 바로가기</div>
            <div className="mt-3 space-y-2">
              <Link href={data.quickLinks.orgKpiHref} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-100">조직 KPI 관리 <ArrowRight className="h-4 w-4" /></Link>
              <Link href={data.quickLinks.reminderHref} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-100">알림 운영 <ArrowRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => startTransition(() => router.refresh())} className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-100">
                새로고침 <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">목표 얼라인먼트 보드</h2>
                <p className="mt-1 text-sm text-slate-500">조직 목표와 연결된 개인 목표를 계층 구조로 정리했습니다.</p>
              </div>
              <div className="text-sm text-slate-500">미연결 개인 목표 {data.orphanPersonalGoals.length}개</div>
            </div>

            {data.board.length ? (
              <div className="mt-6 space-y-5">
                {data.board.map((node) => (
                  <BoardNode key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
                ))}
              </div>
            ) : (
              <EmptyPanel title="표시할 정렬 데이터가 없습니다." description={data.message ?? '선택한 조건에 맞는 목표가 아직 수립되지 않았습니다.'} />
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">운영 모니터링</h2>
            <p className="mt-1 text-sm text-slate-500">조직별 개인 목표 수립 비율, 조직 KPI 연결 비율, 체크인 완료 비율을 한 번에 확인할 수 있습니다.</p>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-left">조직</th>
                    <th className="px-3 py-3 text-right">개인 목표 수립 비율</th>
                    <th className="px-3 py-3 text-right">조직 KPI 연결 비율</th>
                    <th className="px-3 py-3 text-right">체크인 완료 비율</th>
                    <th className="px-3 py-3 text-right">미연결 개인 목표</th>
                    <th className="px-3 py-3 text-right">상세</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departmentSummary.length ? data.departmentSummary.map((item) => (
                    <tr key={item.departmentId} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.departmentName}</div>
                        <div className="text-xs text-slate-500">조직 목표 {item.orgGoalCount}개 · 개인 목표 {item.personalGoalCount}개</div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.personalGoalSetupRate}%</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.alignmentRate}%</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.completedCheckInRate}%</td>
                      <td className="px-3 py-3 text-right font-semibold text-amber-700">{item.orphanGoalCount}</td>
                      <td className="px-3 py-3 text-right"><Link href={item.relatedUrl} className="text-sm font-semibold text-blue-600 hover:text-blue-700">열기</Link></td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-3 py-8"><EmptyPanel title="운영 지표가 없습니다." description="조직별 목표 또는 인원 데이터가 준비되면 여기에서 현황을 확인할 수 있습니다." compact /></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {selectedItem ? <DetailPanel selectedItem={selectedItem} /> : <EmptyPanel title="상세 패널이 비어 있습니다." description="보드에서 목표 카드를 선택하면 연결 경로와 이동 경로를 확인할 수 있습니다." />}
        </aside>
      </section>
    </div>
  )
}

function BoardNode(props: {
  node: GoalAlignmentOrgNode
  depth: number
  selectedId: string
  onSelect: (id: string) => void
}) {
  const isSelected = props.selectedId === props.node.id
  return (
    <div className={props.depth ? 'border-l border-dashed border-slate-200 pl-5' : ''}>
      <button
        type="button"
        onClick={() => props.onSelect(props.node.id)}
        className={`w-full rounded-3xl border px-5 py-4 text-left transition ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">{props.node.departmentName}</div>
            <div className="mt-2 text-lg font-semibold">{props.node.title}</div>
            <div className={`mt-2 text-sm ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
              {props.node.isOrphan ? '상위 목표 미연결' : props.node.lineage.length ? `${props.node.lineage.at(-1)?.departmentName}와 연결` : '상위 목표 없음'}
            </div>
          </div>
          <div className={`rounded-2xl px-4 py-3 text-right text-sm ${isSelected ? 'bg-white/10 text-white' : 'bg-white text-slate-700'}`}>
            <div>진척도 {props.node.progressRate ?? '-'}%</div>
            <div className="mt-1">개인 목표 {props.node.linkedPersonalGoalCount}개</div>
          </div>
        </div>
        {props.node.riskFlags.length ? <div className={`mt-3 flex flex-wrap gap-2 text-xs ${isSelected ? 'text-slate-200' : 'text-amber-700'}`}>{props.node.riskFlags.map((flag) => <span key={flag} className={`rounded-full px-2.5 py-1 ${isSelected ? 'bg-white/10' : 'bg-amber-100'}`}>{flag}</span>)}</div> : null}
      </button>

      {props.node.personalGoals.length ? (
        <div className="mt-3 grid gap-3 pl-4 md:grid-cols-2">
          {props.node.personalGoals.map((goal) => (
            <button key={goal.id} type="button" onClick={() => props.onSelect(goal.id)} className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${props.selectedId === goal.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="font-semibold text-slate-900">{goal.employeeName}</div>
              <div className="mt-1 text-slate-600">{goal.title}</div>
              <div className="mt-2 text-xs text-slate-500">진척도 {goal.progressRate ?? '-'}% · {goal.isOrphan ? '미연결' : '조직 목표 연결'}</div>
            </button>
          ))}
        </div>
      ) : null}

      {props.node.children.length ? (
        <div className="mt-4 space-y-4">
          {props.node.children.map((child) => (
            <BoardNode key={child.id} node={child} depth={props.depth + 1} selectedId={props.selectedId} onSelect={props.onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DetailPanel({ selectedItem }: { selectedItem: SelectedItem }) {
  if (!selectedItem) return null
  if (selectedItem.kind === 'personal') {
    const item = selectedItem.node
    return (
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">개인 목표</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{item.title}</h2>
          <p className="mt-2 text-sm text-slate-500">{item.employeeName} · {item.departmentName}</p>
        </div>
        <dl className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <DetailRow label="상태" value={item.status} />
          <DetailRow label="진척도" value={item.progressRate !== undefined ? `${item.progressRate}%` : '-'} />
          <DetailRow label="연결 상태" value={item.isOrphan ? '미연결' : '조직 목표 연결'} />
        </dl>
        <Link href={item.href} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">원본 화면 열기</Link>
      </div>
    )
  }

  const item = selectedItem.node
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">조직 목표</div>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">{item.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{item.departmentName}</p>
      </div>
      <dl className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <DetailRow label="상태" value={item.status} />
        <DetailRow label="진척도" value={item.progressRate !== undefined ? `${item.progressRate}%` : '-'} />
        <DetailRow label="연결 개인 목표" value={`${item.linkedPersonalGoalCount}개`} />
        <DetailRow label="하위 조직 목표" value={`${item.childGoalCount}개`} />
      </dl>
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-900">상위 경로</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.lineage.length ? item.lineage.map((segment) => (
            <Link key={segment.id} href={segment.href} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
              {segment.departmentName} · {segment.title}
            </Link>
          )) : <span className="text-sm text-slate-500">현재 화면 범위에서 상위 경로가 없습니다.</span>}
        </div>
      </div>
      {item.riskFlags.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{item.riskFlags.join(' / ')}</div> : null}
      <Link href={item.href} className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">원본 화면 열기</Link>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return <div className="rounded-2xl bg-slate-50 px-4 py-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>{helper ? <div className="mt-2 text-xs text-slate-500">{helper}</div> : null}</div>
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-sm font-medium text-slate-900">{label}</span>{children}</label>
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{label}</button>
}

function LinkButton({
  href,
  label,
  appendQuery,
  icon,
}: {
  href: string
  label: string
  appendQuery?: string
  icon?: ReactNode
}) {
  const targetHref = appendQuery ? `${href}?${appendQuery}` : href
  return <Link href={targetHref} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{label}{icon}</Link>
}

function EmptyPanel({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center ${compact ? 'py-6' : 'py-12'}`}><h3 className="text-lg font-semibold text-slate-900">{title}</h3><p className="mt-2 max-w-md text-sm text-slate-500">{description}</p></div>
}
