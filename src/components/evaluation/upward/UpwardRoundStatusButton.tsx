'use client'

export type UpwardRoundStatusActionKind = 'START' | 'CLOSE' | 'REOPEN'

// 상향평가 진단 기간의 상태 버튼. 허용표는 updateRoundStatus 와 같다:
// 시작 전(DRAFT · RATER_SELECTION) → 시작, 진행 중 → 마감, 마감(COMPLETED · CLOSED) → 다시 열기, 취소 → 버튼 꺼짐.
export function resolveUpwardRoundStatusAction(round: { status: string; roundName: string }): {
  action: UpwardRoundStatusActionKind | null
  label: string
  enabled: boolean
  confirmMessage: string | null
} {
  if (round.status === 'DRAFT' || round.status === 'RATER_SELECTION') {
    return { action: 'START', label: '진단 기간 시작', enabled: true, confirmMessage: null }
  }
  if (round.status === 'IN_PROGRESS') {
    return { action: 'CLOSE', label: '진단 기간 마감', enabled: true, confirmMessage: null }
  }
  if (round.status === 'COMPLETED' || round.status === 'CLOSED') {
    return {
      action: 'REOPEN',
      label: '다시 열기',
      enabled: true,
      confirmMessage: `[${round.roundName}] 진단 기간을 다시 엽니다.\n\n결과 공개가 취소됩니다. 진행할까요?`,
    }
  }
  return { action: null, label: '취소된 진단 기간', enabled: false, confirmMessage: null }
}

export function UpwardRoundStatusButton(props: {
  round: { id: string; status: string; roundName: string }
  busy: boolean
  className?: string
  onAction: (action: UpwardRoundStatusActionKind) => void
}) {
  const state = resolveUpwardRoundStatusAction(props.round)
  return (
    <button
      type="button"
      data-round-status-action={state.action ?? 'NONE'}
      className={props.className}
      disabled={props.busy || !state.enabled}
      onClick={() => {
        if (!state.action) return
        if (state.confirmMessage && typeof window !== 'undefined' && !window.confirm(state.confirmMessage)) return
        props.onAction(state.action)
      }}
    >
      {state.label}
    </button>
  )
}
