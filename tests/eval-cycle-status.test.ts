import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildEvalCycleSummaryMetrics,
  filterEvalCyclesByYearAndStatus,
  resolveEvalCycleDisplayStatus,
  type EvalCycleStatusSource,
} from '../src/lib/eval-cycle-status'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function createCycle(overrides: Partial<EvalCycleStatusSource> = {}): EvalCycleStatusSource {
  return {
    evalYear: 2026,
    status: 'RESULT_OPEN',
    resultOpenEnd: null,
    appealDeadline: null,
    ...overrides,
  }
}

run('eval cycle display status closes result-open cycles after the appeal deadline passes', () => {
  const cycle = createCycle({
    status: 'RESULT_OPEN',
    resultOpenEnd: '2026-03-31T23:59:59.000Z',
    appealDeadline: '2026-04-10T23:59:59.000Z',
  })

  const status = resolveEvalCycleDisplayStatus(cycle, {
    now: new Date('2026-04-11T00:00:00.000Z'),
  })

  assert.equal(status, 'CLOSED')
})

run('eval cycle display status closes schedule-ended cycles even when the raw DB status is still in progress', () => {
  const cycle = createCycle({
    status: 'FINAL_EVAL',
    resultOpenStart: '2026-03-01T00:00:00.000Z',
    resultOpenEnd: '2026-03-15T23:59:59.000Z',
    appealDeadline: '2026-03-31T23:59:59.000Z',
  })

  const status = resolveEvalCycleDisplayStatus(cycle, {
    now: new Date('2026-04-14T12:00:00.000Z'),
  })

  assert.equal(status, 'CLOSED')
})

run('eval cycle display status keeps publication open while the appeal window is still active', () => {
  const cycle = createCycle({
    status: 'APPEAL',
    appealDeadline: '2026-04-15T23:59:59.000Z',
  })

  const status = resolveEvalCycleDisplayStatus(cycle, {
    now: new Date('2026-04-14T12:00:00.000Z'),
  })

  assert.equal(status, 'APPEAL')
})

run('eval cycle display status keeps manual CLOSED as the highest-priority state', () => {
  const cycle = createCycle({
    status: 'CLOSED',
    appealDeadline: '2099-01-01T00:00:00.000Z',
  })

  const status = resolveEvalCycleDisplayStatus(cycle, {
    now: new Date('2026-04-14T12:00:00.000Z'),
  })

  assert.equal(status, 'CLOSED')
})

run('eval cycle summary metrics use the same derived status rules as the list filter', () => {
  const now = new Date('2026-04-14T12:00:00.000Z')
  const cycles = [
    createCycle({
      evalYear: 2026,
      status: 'FINAL_EVAL',
      resultOpenStart: '2026-03-01T00:00:00.000Z',
      appealDeadline: '2026-04-01T00:00:00.000Z',
    }),
    createCycle({
      evalYear: 2026,
      status: 'SELF_EVAL',
    }),
    createCycle({
      evalYear: 2025,
      status: 'CLOSED',
    }),
  ]

  const metrics = buildEvalCycleSummaryMetrics(cycles, {
    selectedYear: 2026,
    selectedStatus: 'ALL',
    now,
  })

  assert.deepEqual(metrics, {
    total: 2,
    inProgress: 1,
    published: 0,
    closed: 1,
  })
})

run('eval cycle summary metrics count an ended cycle as closed even when the raw status still says final evaluation', () => {
  const now = new Date('2026-04-14T12:00:00.000Z')
  const cycles = [
    createCycle({
      evalYear: 2026,
      status: 'FINAL_EVAL',
      resultOpenStart: '2026-03-01T00:00:00.000Z',
      appealDeadline: '2026-03-31T23:59:59.000Z',
    }),
  ]

  const metrics = buildEvalCycleSummaryMetrics(cycles, {
    selectedYear: 2026,
    now,
  })

  assert.deepEqual(metrics, {
    total: 1,
    inProgress: 0,
    published: 0,
    closed: 1,
  })
})

run('eval cycle list filter uses the derived display status instead of the raw status field', () => {
  const now = new Date('2026-04-14T12:00:00.000Z')
  const cycles = [
    createCycle({
      evalYear: 2026,
      status: 'RESULT_OPEN',
      appealDeadline: '2026-04-01T00:00:00.000Z',
    }),
    createCycle({
      evalYear: 2026,
      status: 'SELF_EVAL',
    }),
  ]

  const closedCycles = filterEvalCyclesByYearAndStatus(cycles, {
    selectedYear: 2026,
    selectedStatus: 'CLOSED',
    now,
  })
  const inProgressCycles = filterEvalCyclesByYearAndStatus(cycles, {
    selectedYear: 2026,
    selectedStatus: 'SELF_EVAL',
    now,
  })

  assert.equal(closedCycles.length, 1)
  assert.equal(resolveEvalCycleDisplayStatus(closedCycles[0], { now }), 'CLOSED')
  assert.equal(inProgressCycles.length, 1)
  assert.equal(inProgressCycles[0]?.status, 'SELF_EVAL')
})

run('admin eval cycle client wires summary cards, list filters, and badges to the shared status helper', () => {
  const source = read('src/components/admin/AdminEvalCycleClient.tsx')

  assert.equal(source.includes("from '@/lib/eval-cycle-status'"), true)
  assert.equal(source.includes('const cycleViews = useMemo<EvalCycleView[]>'), true)
  assert.equal(source.includes('displayStatus: resolveEvalCycleDisplayStatus(cycle)'), true)
  assert.equal(source.includes('filterEvalCyclesByYearAndStatus(cycleViews'), true)
  assert.equal(source.includes('buildEvalCycleSummaryMetrics(cycleViews'), true)
  assert.equal(source.includes('buildEvalCycleSummaryLabel(selectedYear, selectedStatus)'), true)
  assert.equal(source.includes('getStatusBadgeClass(cycle.displayStatus)'), true)
  assert.equal(source.includes('STATUS_LABELS[cycle.displayStatus]'), true)
  assert.equal(source.includes('getStatusBadgeClass(selectedCycle.displayStatus)'), true)
  assert.equal(source.includes('STATUS_LABELS[selectedCycle.displayStatus]'), true)
})

run('admin eval cycle page forces dynamic rendering so closed-cycle data is not served stale', () => {
  const source = read('src/app/(main)/admin/eval-cycle/page.tsx')

  assert.equal(source.includes("export const dynamic = 'force-dynamic'"), true)
  assert.equal(source.includes('export const revalidate = 0'), true)
})

console.log('Eval cycle status tests completed')
