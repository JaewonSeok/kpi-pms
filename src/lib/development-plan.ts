export type DevelopmentPlanActionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'

export type DevelopmentPlanActionItem = {
  id: string
  title: string
  status: DevelopmentPlanActionStatus
  note?: string
  dueDate?: string
}

export type DevelopmentPlanLinkedEvidence = {
  type: 'REVIEW' | 'GOAL' | 'CHECKIN' | 'FEEDBACK' | 'MANUAL'
  label: string
  href?: string
  note?: string
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeDevelopmentPlanActionItems(value: unknown): DevelopmentPlanActionItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item, index) => {
      if (typeof item === 'string' && item.trim()) {
        return {
          id: createId(`action-${index}`),
          title: item.trim(),
          status: 'NOT_STARTED' as const,
        }
      }

      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const title = typeof record.title === 'string' ? record.title.trim() : ''
      if (!title) return null

      const status =
        record.status === 'NOT_STARTED' || record.status === 'IN_PROGRESS' || record.status === 'DONE'
          ? record.status
          : 'NOT_STARTED'

      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : createId(`action-${index}`),
        title,
        status,
        note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined,
        dueDate:
          typeof record.dueDate === 'string' && record.dueDate.trim()
            ? record.dueDate.trim()
            : undefined,
      }
    })
    .filter((item): item is DevelopmentPlanActionItem => Boolean(item))
}

export function normalizeDevelopmentPlanStringArray(value: unknown, max = 10) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max)
}

export function normalizeDevelopmentPlanLinkedEvidence(value: unknown): DevelopmentPlanLinkedEvidence[] {
  if (!Array.isArray(value)) return []

  return value
    .map<DevelopmentPlanLinkedEvidence | null>((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const type =
        record.type === 'REVIEW' ||
        record.type === 'GOAL' ||
        record.type === 'CHECKIN' ||
        record.type === 'FEEDBACK' ||
        record.type === 'MANUAL'
          ? record.type
          : null
      const label = typeof record.label === 'string' ? record.label.trim() : ''
      if (!type || !label) return null

      const normalized: DevelopmentPlanLinkedEvidence = {
        type,
        label,
        href: typeof record.href === 'string' && record.href.trim() ? record.href.trim() : undefined,
        note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined,
      }

      return normalized
    })
    .filter((item): item is DevelopmentPlanLinkedEvidence => Boolean(item))
}

export function calculateDevelopmentPlanProgress(actions: DevelopmentPlanActionItem[]) {
  const totalCount = actions.length
  const completedCount = actions.filter((item) => item.status === 'DONE').length
  const progressRate = totalCount ? Math.round((completedCount / totalCount) * 100) : 0

  return {
    totalCount,
    completedCount,
    progressRate,
  }
}
