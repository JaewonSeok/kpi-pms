'use client'

type AnonymityStatusBadgeProps = {
  threshold: number
  feedbackCount: number
  thresholdMet: boolean
}

export function AnonymityStatusBadge(props: AnonymityStatusBadgeProps) {
  const className = props.thresholdMet
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-amber-100 text-amber-700'

  const label = props.thresholdMet
    ? `익명 기준 충족 (${props.feedbackCount}/${props.threshold})`
    : `익명 기준 미달 (${props.feedbackCount}/${props.threshold})`

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>
}
