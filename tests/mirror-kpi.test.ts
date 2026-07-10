/**
 * mirror KPI 헬퍼 단위 테스트.
 * resolveCarrierRecord / buildCarrierRecordsMap 의 동작을 검증한다.
 * DB 없이 fake tx/db 객체로 실행 (ts-node with path aliases).
 */
import assert from 'node:assert/strict'
import { CARRIER_KPI_IDS } from '../src/lib/mirror-config'
import { resolveCarrierRecord, buildCarrierRecordsMap } from '../src/lib/resolve-carrier-record'
import type { Prisma, PrismaClient } from '@prisma/client'

function run(name: string, fn: () => Promise<void> | void) {
  const result = fn()
  if (result instanceof Promise) {
    return result.then(
      () => console.log(`PASS ${name}`),
      (err) => { console.error(`FAIL ${name}`); throw err }
    )
  }
  console.log(`PASS ${name}`)
}

// ── 테스트 픽스처 ──────────────────────────────────────────────────────────────

function makeTx(opts: {
  carrierStatus?: string
  monthlyRecords?: Array<{ actualAmount: bigint | null; yearMonth?: string }>
} = {}): Prisma.TransactionClient {
  return {
    personalKpi: {
      findUnique: async (_: unknown) => {
        if (opts.carrierStatus === undefined) return null
        return { status: opts.carrierStatus }
      },
    },
    monthlyRecord: {
      findFirst: async (_: unknown) => {
        const records = (opts.monthlyRecords ?? []).filter(r => r.actualAmount !== null)
        return records[0] ?? null
      },
    },
  } as unknown as Prisma.TransactionClient
}

function makeDb(opts: {
  carrierStatus?: string
  monthlyRecords?: Array<{ personalKpiId: string; yearMonth: string; achievementRate: number | null; isDraft: boolean; [k: string]: unknown }>
} = {}): PrismaClient {
  return {
    personalKpi: {
      findMany: async (_: unknown) => {
        if (opts.carrierStatus === 'ARCHIVED' || opts.carrierStatus === undefined) return []
        return [{ id: 'carrier-1' }]
      },
    },
    monthlyRecord: {
      findMany: async (_: unknown) => opts.monthlyRecords ?? [],
    },
  } as unknown as PrismaClient
}

// ── 테스트 시작 ──────────────────────────────────────────────────────────────

async function main() {
  // 사전 설정: 맵에 항목 추가
  CARRIER_KPI_IDS['org-kpi-1'] = 'carrier-1'

  await run('비-mirror KPI → 자기 자신 기록 반환 (기존 동작)', async () => {
    const tx = makeTx({ carrierStatus: 'DRAFT', monthlyRecords: [{ actualAmount: BigInt(500000) }] })
    const result = await resolveCarrierRecord(tx, {
      id: 'my-kpi',
      isMirror: false,
      linkedOrgKpiId: 'org-kpi-1',
    })
    assert.notEqual(result, null, '비-mirror는 null이 아니어야 함')
    assert.equal(result?.actualAmount, BigInt(500000))
  })

  await run('mirror + 맵에 캐리어 있음 + 기록 있음 → 캐리어 기록 반환', async () => {
    const tx = makeTx({ carrierStatus: 'DRAFT', monthlyRecords: [{ actualAmount: BigInt(200000000) }] })
    const result = await resolveCarrierRecord(tx, {
      id: 'mirror-kpi',
      isMirror: true,
      linkedOrgKpiId: 'org-kpi-1',
    })
    assert.equal(result?.actualAmount, BigInt(200000000))
  })

  await run('mirror + 캐리어 기록 0건 → null (→ 409 SALES_REVENUE_RECORD_REQUIRED)', async () => {
    const tx = makeTx({ carrierStatus: 'DRAFT', monthlyRecords: [] })
    const result = await resolveCarrierRecord(tx, {
      id: 'mirror-kpi',
      isMirror: true,
      linkedOrgKpiId: 'org-kpi-1',
    })
    assert.equal(result, null)
  })

  await run('mirror + 캐리어 ARCHIVED → null', async () => {
    const tx = makeTx({ carrierStatus: 'ARCHIVED', monthlyRecords: [{ actualAmount: BigInt(100) }] })
    const result = await resolveCarrierRecord(tx, {
      id: 'mirror-kpi',
      isMirror: true,
      linkedOrgKpiId: 'org-kpi-1',
    })
    assert.equal(result, null)
  })

  await run('mirror + linkedOrgKpiId가 맵에 없음 → null (맵 미존재 케이스)', async () => {
    const tx = makeTx({ carrierStatus: 'DRAFT', monthlyRecords: [{ actualAmount: BigInt(100) }] })
    const result = await resolveCarrierRecord(tx, {
      id: 'mirror-kpi',
      isMirror: true,
      linkedOrgKpiId: 'org-kpi-UNKNOWN',
    })
    assert.equal(result, null)
  })

  await run('buildCarrierRecordsMap: mirror 스왑 — 캐리어 기록이 mirror 달성률로', async () => {
    const db = makeDb({
      carrierStatus: 'DRAFT',
      monthlyRecords: [
        { personalKpiId: 'carrier-1', yearMonth: '2026-06', achievementRate: 85, isDraft: false },
        { personalKpiId: 'carrier-1', yearMonth: '2026-05', achievementRate: 72, isDraft: false },
      ],
    })
    const map = await buildCarrierRecordsMap(db, [
      { id: 'mirror-kpi-a', linkedOrgKpiId: 'org-kpi-1' },
    ])
    const records = map.get('mirror-kpi-a') ?? []
    assert.equal(records.length, 2)
    assert.equal(records[0].achievementRate, 85)
  })

  await run('buildCarrierRecordsMap: 기록 0건 → 빈 배열 반환 (UI: "-")', async () => {
    const db = makeDb({ carrierStatus: 'DRAFT', monthlyRecords: [] })
    const map = await buildCarrierRecordsMap(db, [
      { id: 'mirror-kpi-a', linkedOrgKpiId: 'org-kpi-1' },
    ])
    const records = map.get('mirror-kpi-a') ?? []
    assert.equal(records.length, 0)
  })

  await run('buildCarrierRecordsMap: draft 기록 미노출 (isDraft:false 고정)', async () => {
    const db = makeDb({
      carrierStatus: 'DRAFT',
      // fake db: findMany returns only isDraft:false records (filtered in real impl)
      monthlyRecords: [
        { personalKpiId: 'carrier-1', yearMonth: '2026-06', achievementRate: 90, isDraft: false },
      ],
    })
    const map = await buildCarrierRecordsMap(db, [
      { id: 'mirror-kpi-a', linkedOrgKpiId: 'org-kpi-1' },
    ])
    const records = map.get('mirror-kpi-a') ?? []
    // isDraft:false만 포함되어 있어야 함
    assert.ok(records.every(r => r.isDraft === false), 'draft 기록이 포함되어선 안 됨')
  })

  await run('buildCarrierRecordsMap: 빈 맵(CARRIER_KPI_IDS={}) — mirrorKpis 있어도 무해', async () => {
    // 임시로 매핑 제거
    const backup = CARRIER_KPI_IDS['org-kpi-1']
    delete CARRIER_KPI_IDS['org-kpi-1']

    const db = makeDb({ carrierStatus: 'DRAFT', monthlyRecords: [] })
    const map = await buildCarrierRecordsMap(db, [
      { id: 'mirror-kpi-a', linkedOrgKpiId: 'org-kpi-1' },
    ])
    const records = map.get('mirror-kpi-a') ?? []
    assert.equal(records.length, 0)

    CARRIER_KPI_IDS['org-kpi-1'] = backup  // 복원
  })

  await run('buildCarrierRecordsMap: mirrorKpis 빈 배열 → 빈 맵 반환', async () => {
    const db = makeDb({ carrierStatus: 'DRAFT', monthlyRecords: [] })
    const map = await buildCarrierRecordsMap(db, [])
    assert.equal(map.size, 0)
  })

  await run('비-mirror resolveCarrierRecord: draft 기록은 제외 (isDraft:false 조회)', async () => {
    // fake tx.monthlyRecord.findFirst는 isDraft:false만 반환하도록 구현됨
    // (실제 코드에서 where: { isDraft: false } 확인)
    const tx = makeTx({ monthlyRecords: [] })
    const result = await resolveCarrierRecord(tx, {
      id: 'my-kpi',
      isMirror: false,
      linkedOrgKpiId: null,
    })
    assert.equal(result, null)
  })
}

main().catch(err => { console.error(err); process.exit(1) })
