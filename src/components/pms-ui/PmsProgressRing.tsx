const TONE_COLOR = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#fb7185',
  neutral: '#94a3b8',
}

export function PmsProgressRing({
  value,
  label,
  valueLabel,
  tone = 'success',
  size = 'md',
}: {
  value?: number | null
  label: string
  valueLabel?: string
  tone?: keyof typeof TONE_COLOR | 'good'
  size?: 'sm' | 'md'
}) {
  const normalized = typeof value === 'number' ? Math.min(100, Math.max(0, value)) : 0
  const normalizedTone = tone === 'good' ? 'success' : tone
  const color = typeof value === 'number' ? TONE_COLOR[normalizedTone] : TONE_COLOR.neutral
  const outerClass = size === 'sm' ? 'h-24 w-24' : 'h-32 w-32'
  const innerClass = size === 'sm' ? 'h-16 w-16' : 'h-24 w-24'
  const valueClass = size === 'sm' ? 'text-xl' : 'text-2xl'

  return (
    <div
      className={`grid place-items-center rounded-full shadow-inner ${outerClass}`}
      style={{
        background: `conic-gradient(${color} ${normalized * 3.6}deg, #E2E8F0 0deg)`,
      }}
      aria-label={`${label}: ${valueLabel ?? (typeof value === 'number' ? `${Math.round(value * 10) / 10}%` : '-')}`}
    >
      <div className={`grid place-items-center rounded-full bg-white text-center shadow-sm ${innerClass}`}>
        <div>
          <div className={`font-bold text-slate-950 ${valueClass}`}>
            {valueLabel ?? (typeof value === 'number' ? `${Math.round(value * 10) / 10}%` : '-')}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  )
}
