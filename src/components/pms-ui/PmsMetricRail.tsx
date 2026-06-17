import type { ReactNode } from 'react'
import type { PmsTone } from './types'
import { PmsSummaryCard } from './PmsSummaryCard'

export type PmsMetricRailItem = {
  icon?: ReactNode
  label: string
  value: string
  helper?: string
  chip?: string
  tone?: PmsTone | 'good'
}

export function PmsMetricRail({
  items,
  className = '',
}: {
  items: PmsMetricRailItem[]
  className?: string
}) {
  return (
    <div className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {items.map((item) => (
        <PmsSummaryCard key={`${item.label}-${item.value}`} compact {...item} />
      ))}
    </div>
  )
}
