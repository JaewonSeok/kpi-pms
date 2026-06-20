'use client'

export type Feedback360VisibilitySettingsRow = {
  key: string
  label: string
  value: string
}

export type Feedback360VisibilitySettingsOption = {
  value: string
  label: string
}

type Feedback360VisibilitySettingsProps = {
  title?: string
  summary: string
  description?: string
  rows: readonly Feedback360VisibilitySettingsRow[]
  options: readonly Feedback360VisibilitySettingsOption[]
  disabled?: boolean
  footnote?: string
  onChange?: (key: string, value: string) => void
}

function buildVisibilityRowKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? 'none').trim() || 'none')
    .join(':')
}

export function Feedback360VisibilitySettings(props: Feedback360VisibilitySettingsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {props.title ? <div className="text-sm font-semibold text-slate-900">{props.title}</div> : null}
      <div className="text-sm font-semibold text-slate-900">{props.summary}</div>
      {props.description ? <p className="mt-1 text-xs leading-5 text-slate-500">{props.description}</p> : null}
      <div className="mt-3 space-y-2">
        {props.rows.map((row, index) => (
          <label
            key={buildVisibilityRowKey(['visibility-setting', row.key, row.value, index])}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
          >
            <span className="text-sm text-slate-700">{row.label}</span>
            <select
              value={row.value}
              disabled={props.disabled}
              onChange={(event) => props.onChange?.(row.key, event.target.value)}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              aria-label={`${row.label} 공개 범위`}
            >
              {props.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {props.footnote ? <p className="mt-3 text-xs leading-5 text-slate-500">{props.footnote}</p> : null}
    </div>
  )
}
