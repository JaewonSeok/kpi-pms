export type EvalCycleStatus =
  | 'SETUP'
  | 'KPI_SETTING'
  | 'IN_PROGRESS'
  | 'SELF_EVAL'
  | 'FIRST_EVAL'
  | 'SECOND_EVAL'
  | 'FINAL_EVAL'
  | 'CEO_ADJUST'
  | 'RESULT_OPEN'
  | 'APPEAL'
  | 'CLOSED'

export type EvalCycleStatusFilter = 'ALL' | EvalCycleStatus
export type EvalCycleYearFilter = 'ALL' | number

export type EvalCycleStatusSource = {
  evalYear: number
  status: EvalCycleStatus
  kpiSetupStart?: string | Date | null
  kpiSetupEnd?: string | Date | null
  selfEvalStart?: string | Date | null
  selfEvalEnd?: string | Date | null
  firstEvalStart?: string | Date | null
  firstEvalEnd?: string | Date | null
  secondEvalStart?: string | Date | null
  secondEvalEnd?: string | Date | null
  finalEvalStart?: string | Date | null
  finalEvalEnd?: string | Date | null
  ceoAdjustStart?: string | Date | null
  ceoAdjustEnd?: string | Date | null
  resultOpenStart?: string | Date | null
  resultOpenEnd?: string | Date | null
  appealDeadline?: string | Date | null
}

export type EvalCycleSummaryMetrics = {
  total: number
  inProgress: number
  published: number
  closed: number
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function hasPassed(value: string | Date | null | undefined, now: Date) {
  const date = toDate(value)
  return date ? date.getTime() < now.getTime() : false
}

function isInRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  now: Date
) {
  const startDate = toDate(start)
  const endDate = toDate(end)
  if (!startDate || !endDate) return false
  return startDate.getTime() <= now.getTime() && now.getTime() <= endDate.getTime()
}

export function resolveEvalCycleDisplayStatus(
  cycle: EvalCycleStatusSource,
  options?: { now?: Date }
): EvalCycleStatus {
  const now = options?.now ?? new Date()

  if (cycle.status === 'CLOSED') return 'CLOSED'

  if (isInRange(cycle.kpiSetupStart, cycle.kpiSetupEnd, now)) return 'KPI_SETTING'
  if (isInRange(cycle.selfEvalStart, cycle.selfEvalEnd, now)) return 'SELF_EVAL'
  if (isInRange(cycle.firstEvalStart, cycle.firstEvalEnd, now)) return 'FIRST_EVAL'
  if (isInRange(cycle.secondEvalStart, cycle.secondEvalEnd, now)) return 'SECOND_EVAL'
  if (isInRange(cycle.finalEvalStart, cycle.finalEvalEnd, now)) return 'FINAL_EVAL'
  if (isInRange(cycle.ceoAdjustStart, cycle.ceoAdjustEnd, now)) return 'CEO_ADJUST'

  if (hasPassed(cycle.appealDeadline, now)) return 'CLOSED'
  if (!cycle.appealDeadline && hasPassed(cycle.resultOpenEnd, now)) return 'CLOSED'
  const resultOpenStart = toDate(cycle.resultOpenStart)
  if (resultOpenStart && resultOpenStart.getTime() <= now.getTime()) {
    if (cycle.appealDeadline) return 'APPEAL'
    return 'RESULT_OPEN'
  }

  const kpiSetupStart = toDate(cycle.kpiSetupStart)
  if (kpiSetupStart && kpiSetupStart.getTime() > now.getTime()) return 'SETUP'

  return cycle.status
}

export function filterEvalCyclesByYearAndStatus<T extends EvalCycleStatusSource>(
  cycles: T[],
  filters: {
    selectedYear: EvalCycleYearFilter
    selectedStatus: EvalCycleStatusFilter
    now?: Date
  }
) {
  const { selectedYear, selectedStatus, now } = filters

  return cycles.filter((cycle) => {
    if (selectedYear !== 'ALL' && cycle.evalYear !== selectedYear) return false
    if (selectedStatus === 'ALL') return true
    return resolveEvalCycleDisplayStatus(cycle, { now }) === selectedStatus
  })
}

export function buildEvalCycleSummaryMetrics<T extends EvalCycleStatusSource>(
  cycles: T[],
  options: {
    selectedYear: EvalCycleYearFilter
    selectedStatus?: EvalCycleStatusFilter
    now?: Date
  }
): EvalCycleSummaryMetrics {
  const { selectedYear, selectedStatus = 'ALL', now } = options
  const scopedCycles = filterEvalCyclesByYearAndStatus(cycles, {
    selectedYear,
    selectedStatus,
    now,
  })

  return scopedCycles.reduce<EvalCycleSummaryMetrics>(
    (metrics, cycle) => {
      const status = resolveEvalCycleDisplayStatus(cycle, { now })
      metrics.total += 1

      if (status === 'CLOSED') {
        metrics.closed += 1
        return metrics
      }

      if (status === 'RESULT_OPEN' || status === 'APPEAL') {
        metrics.published += 1
        return metrics
      }

      metrics.inProgress += 1
      return metrics
    },
    {
      total: 0,
      inProgress: 0,
      published: 0,
      closed: 0,
    }
  )
}

export function buildEvalCycleSummaryLabel(
  selectedYear: EvalCycleYearFilter,
  selectedStatus: EvalCycleStatusFilter = 'ALL'
) {
  if (selectedStatus !== 'ALL') return '현재 필터 주기 수'
  if (selectedYear === 'ALL') return '전체 주기 수'
  return `${selectedYear}년 주기 수`
}
