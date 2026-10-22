'use client'

import type {
  Feedback360RoundActions,
  Feedback360TargetProgressRow,
} from '@/lib/feedback-360-round-operations'

export type Feedback360RoundOperationAction = keyof Feedback360RoundActions

const ACTION_ORDER: Array<{ key: Feedback360RoundOperationAction; label: string; confirm: string }> = [
  { key: 'bulkPublish', label: '일괄 발행', confirm: '기준 인원 이상 승인된 대상의 응답 요청을 한 번에 발행합니다. 진행할까요?' },
  { key: 'close', label: '마감', confirm: '라운드를 마감합니다. 마감 뒤에는 응답을 받을 수 없습니다. 진행할까요?' },
  { key: 'release', label: '결과 공개', confirm: '대상 본인과 리더에게 결과를 공개합니다. 진행할까요?' },
  { key: 'unrelease', label: '공개 취소', confirm: '결과 공개를 취소합니다. 다시 공개할 때까지 본인과 리더는 결과를 볼 수 없습니다. 진행할까요?' },
]

// 확인 창 문구. 어느 라운드에 하는 작업인지 라운드 이름을 앞에 둔다.
export function buildFeedback360RoundActionConfirmMessage(roundName: string, action: Feedback360RoundOperationAction) {
  const item = ACTION_ORDER.find((entry) => entry.key === action)
  return `[${roundName}] ${item?.label ?? ''}\n\n${item?.confirm ?? ''}`
}

// 360 라운드 운영(일괄 발행 · 마감 · 결과 공개 · 공개 취소)과 대상별 현황. 관리 화면(Feedback360AdminPanel)의 Panel 안에 들어간다.
export function Feedback360RoundOperationsPanel(props: {
  // 패널 데이터의 라운드(서버가 고른 라운드)와 목록에서 고른 라운드. 다르면 버튼을 모두 막는다.
  roundId: string
  selectedRoundId?: string | null
  roundName: string
  actions: Feedback360RoundActions
  progress: {
    rows: Feedback360TargetProgressRow[]
    unnominated: Array<{ id: string; name: string; department: string }>
  }
  minRaters?: number
  busy: boolean
  onAction: (action: Feedback360RoundOperationAction) => void
}) {
  const roundMismatch = Boolean(props.selectedRoundId) && props.selectedRoundId !== props.roundId

  return (
    <div className="space-y-5">
      {roundMismatch ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {props.roundName} 라운드 기준입니다. 새로 불러오면 고른 라운드로 바뀝니다.
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACTION_ORDER.map((item) => {
          const state = props.actions[item.key]
          const disabled = props.busy || roundMismatch || !state.enabled
          return (
            <div key={item.key} className="space-y-1">
              <button
                type="button"
                data-round-action={item.key}
                disabled={disabled}
                onClick={() => {
                  if (
                    typeof window !== 'undefined' &&
                    !window.confirm(buildFeedback360RoundActionConfirmMessage(props.roundName, item.key))
                  ) {
                    return
                  }
                  props.onAction(item.key)
                }}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {item.label}
              </button>
              {!state.enabled && state.reason ? <p className="text-xs text-slate-500">{state.reason}</p> : null}
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-3">대상자</th>
              <th className="px-4 py-3">부서</th>
              <th className="px-4 py-3 text-right">초안</th>
              <th className="px-4 py-3 text-right">제출</th>
              <th className="px-4 py-3 text-right">승인</th>
              <th className="px-4 py-3">기준{typeof props.minRaters === 'number' ? `(${props.minRaters}명)` : ''}</th>
              <th className="px-4 py-3">발행</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {props.progress.rows.length ? (
              props.progress.rows.map((row) => (
                <tr key={row.targetId} data-target-row={row.targetId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.department}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.draft}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.submitted}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.approved}</td>
                  <td className="px-4 py-3">{row.meetsMinRaters ? '충족' : '미달'}</td>
                  <td className="px-4 py-3">{row.published ? '발행됨' : '발행 전'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  아직 지명이 있는 대상이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-sm font-semibold text-amber-900">미지명 {props.progress.unnominated.length}명</div>
        <p className="mt-1 text-xs text-amber-800">360 대상(팀원)인데 지명이 하나도 없는 사람입니다.</p>
        {props.progress.unnominated.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {props.progress.unnominated.map((target) => (
              <li
                key={target.id}
                data-unnominated={target.id}
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs text-amber-900"
              >
                {target.name} · {target.department}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
