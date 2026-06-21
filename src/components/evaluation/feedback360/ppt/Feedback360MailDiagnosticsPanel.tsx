'use client'

export type Feedback360MailDiagnosticsResult = {
  tone: 'success' | 'error' | 'info'
  title: string
  recipientsLabel: string
  channelLabel: string
  providerStatus: string
  message: string
  failureReason?: string
}

type Feedback360MailDiagnosticsPanelProps = {
  result: Feedback360MailDiagnosticsResult
  busy: boolean
  onRetry: () => void
  onClose: () => void
}

export function Feedback360MailDiagnosticsPanel(props: Feedback360MailDiagnosticsPanelProps) {
  const toneClass =
    props.result.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : props.result.tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold">{props.result.title}</div>
          <div className="mt-1 text-sm">{props.result.recipientsLabel}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onRetry}
            disabled={props.busy}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-current/25 bg-white/70 px-3 text-xs font-semibold transition hover:bg-white disabled:opacity-60"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-current/25 bg-white/70 px-3 text-xs font-semibold transition hover:bg-white"
          >
            닫기
          </button>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm leading-6">
        {props.result.message}
      </div>
      <div className="mt-2 grid gap-2 text-xs leading-5 md:grid-cols-2">
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <span className="font-semibold">발송 채널</span>
          <span className="ml-2">{props.result.channelLabel}</span>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <span className="font-semibold">발송 설정</span>
          <span className="ml-2">{props.result.providerStatus}</span>
        </div>
      </div>
      {props.result.failureReason ? (
        <div className="mt-2 text-xs leading-5 opacity-80">실패 사유: {props.result.failureReason}</div>
      ) : null}
    </div>
  )
}
