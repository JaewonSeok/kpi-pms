import './setup-test-env'
import './register-path-aliases'
import assert from 'node:assert/strict'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

type DateField = 'kpiSetupEnd' | 'ceoAdjustStart' | 'resultOpenStart'
type ReminderType = 'GOAL_REMINDER' | 'CALIBRATION_REMINDER' | 'RESULT_CONFIRMATION_REMINDER'
type Window = { gte: Date; lte: Date }
type CycleDates = Partial<Record<DateField, Date | null>>

const DATE_FIELD_BY_TYPE: Record<ReminderType, DateField> = {
  GOAL_REMINDER: 'kpiSetupEnd',
  CALIBRATION_REMINDER: 'ceoAdjustStart',
  RESULT_CONFIRMATION_REMINDER: 'resultOpenStart',
}
const REMINDER_TYPES = Object.keys(DATE_FIELD_BY_TYPE) as ReminderType[]
const DAY_MS = 24 * 60 * 60 * 1000

// evalCycle.findMany 의 where.OR 을 그대로 평가한다. 사이클 선택이 고른 날짜 필드를 함께 돌려준다.
function matchesClause(value: Date | null | undefined, range: Window) {
  return Boolean(value) && value!.getTime() >= range.gte.getTime() && value!.getTime() <= range.lte.getTime()
}

function createDb(buildCycle: (window: Window) => CycleDates) {
  const jobs: Array<{ type: string; recipientId: string; sourceId: string }> = []
  const selection = { window: null as Window | null, selected: false, matchedFields: new Set<DateField>() }

  const db = {
    notificationTemplate: { upsert: async () => ({}) },
    notificationPreference: {
      // 날짜 리마인더 3종을 mute 해 템플릿 렌더링 없이 SUPPRESSED 잡으로 남게 한다. 잡이 생겼는지만 본다.
      upsert: async (args: { where: { employeeId: string } }) => ({
        employeeId: args.where.employeeId,
        inAppEnabled: true,
        emailEnabled: false,
        digestEnabled: false,
        quietHoursEnabled: false,
        timezone: 'Asia/Seoul',
        mutedTypes: REMINDER_TYPES,
      }),
    },
    notificationJob: {
      create: async (args: { data: { type: string; recipientId: string; sourceId: string } }) => {
        jobs.push({ type: args.data.type, recipientId: args.data.recipientId, sourceId: args.data.sourceId })
        return { id: `job-${jobs.length}` }
      },
      findMany: async () => [],
    },
    employee: {
      findMany: async () => [
        { id: 'emp-admin', empName: 'Admin', role: 'ROLE_ADMIN' },
        { id: 'emp-member', empName: 'Member', role: 'ROLE_MEMBER' },
      ],
      findUnique: async (args: { where: { id: string } }) => ({ id: args.where.id, empName: args.where.id, gwsEmail: null }),
    },
    evalCycle: {
      findMany: async (args: { where: { OR: Array<Partial<Record<DateField, Window>>> } }) => {
        const clauses = args.where.OR
        const window = Object.values(clauses[0])[0] as Window
        selection.window = window
        const dates = buildCycle(window)
        for (const clause of clauses) {
          const [field, range] = Object.entries(clause)[0] as [DateField, Window]
          if (matchesClause(dates[field], range)) selection.matchedFields.add(field)
        }
        selection.selected = selection.matchedFields.size > 0
        if (!selection.selected) return []
        return [
          {
            id: 'cycle-1',
            cycleName: '2026 평가',
            status: 'KPI_SETTING',
            kpiSetupEnd: dates.kpiSetupEnd ?? null,
            ceoAdjustStart: dates.ceoAdjustStart ?? null,
            resultOpenStart: dates.resultOpenStart ?? null,
          },
        ]
      },
    },
    checkIn: { findMany: async () => [] },
    evaluation: {
      findMany: async (args: { where: { evalCycleId?: string } }) =>
        args.where.evalCycleId ? [{ targetId: 'emp-member' }] : [],
    },
    personalKpi: { findMany: async () => [] },
  }

  return { db: db as never, jobs, selection }
}

async function main() {
  const { enqueueLifecycleReminders } = await import('../src/lib/notification-service')

  const firedTypes = async (buildCycle: (window: Window) => CycleDates) => {
    const { db, jobs, selection } = createDb(buildCycle)
    await enqueueLifecycleReminders(db)
    return { fired: new Set(jobs.map((job) => job.type)), selection }
  }

  const inside = (window: Window) => new Date(window.gte.getTime() + DAY_MS)
  const outside = (window: Window) => new Date(window.lte.getTime() + 10 * DAY_MS)

  for (const type of REMINDER_TYPES) {
    const ownField = DATE_FIELD_BY_TYPE[type]

    await run(`ⓐ ${type}: 다른 날짜만 창 안이고 자기 날짜(${ownField})는 창 밖이면 만들지 않는다`, async () => {
      const { fired, selection } = await firedTypes((window) => {
        const dates: CycleDates = {}
        for (const field of Object.values(DATE_FIELD_BY_TYPE)) {
          dates[field] = field === ownField ? outside(window) : inside(window)
        }
        return dates
      })
      assert.equal(selection.selected, true)
      assert.equal(fired.has(type), false)
    })

    await run(`ⓑ ${type}: 자기 날짜(${ownField})가 창 안이면 만든다`, async () => {
      const { fired } = await firedTypes((window) => {
        const dates: CycleDates = {}
        for (const field of Object.values(DATE_FIELD_BY_TYPE)) {
          dates[field] = field === ownField ? inside(window) : outside(window)
        }
        return dates
      })
      assert.equal(fired.has(type), true)
    })
  }

  await run('ⓒ 창 경계값에서 사이클 선택과 발화 판정이 같다', async () => {
    const boundaries: Array<[string, (window: Window) => Date]> = [
      ['gte', (window) => new Date(window.gte.getTime())],
      ['gte-1ms', (window) => new Date(window.gte.getTime() - 1)],
      ['lte', (window) => new Date(window.lte.getTime())],
      ['lte+1ms', (window) => new Date(window.lte.getTime() + 1)],
    ]

    for (const type of REMINDER_TYPES) {
      const ownField = DATE_FIELD_BY_TYPE[type]
      for (const [label, at] of boundaries) {
        const { fired, selection } = await firedTypes((window) => ({ [ownField]: at(window) }))
        assert.equal(
          fired.has(type),
          selection.matchedFields.has(ownField),
          `${type} @ ${label}: 선택 ${selection.matchedFields.has(ownField)} · 발화 ${fired.has(type)}`
        )
      }
    }
  })

  console.log('Notification lifecycle reminder window tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
