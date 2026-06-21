import type { DraftItemState } from '@/components/evaluation/workbench/EvaluationWorkbenchTypes'
export function toneFromCount(count: number): 'success' | 'warn' | 'error' | 'neutral' {
  if (count >= 5) return 'error'
  if (count > 0) return 'warn'
  return 'success'
}

export function labelFromCount(count: number) {
  if (count >= 5) return '검토 집중'
  if (count > 0) return '주의 필요'
  return '정상'
}

export function statusTone(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'CONFIRMED') return 'success'
  if (status === 'REJECTED') return 'error'
  if (status === 'SUBMITTED' || status === 'PENDING') return 'warn'
  return 'neutral'
}

export function formatWeighted(item: {
  type: 'QUANTITATIVE' | 'QUALITATIVE'
  weight: number
  draft: DraftItemState
}) {
  if (item.type === 'QUANTITATIVE') {
    return ((item.draft.quantScore ?? 0) * item.weight) / 100
  }

  const pdca =
    Number(item.draft.planScore ?? 0) * 0.3 +
    Number(item.draft.doScore ?? 0) * 0.4 +
    Number(item.draft.checkScore ?? 0) * 0.2 +
    Number(item.draft.actScore ?? 0) * 0.1
  return (pdca * item.weight) / 100
}

