import type { Prisma, PrismaClient } from '@prisma/client'
import { CARRIER_KPI_IDS } from '@/lib/mirror-config'

type TxClient = Prisma.TransactionClient

/**
 * submit/route.ts 전용 (single record, inside transaction).
 * isMirror=false → 기존과 동일하게 kpi.id 기준 조회.
 * isMirror=true  → CARRIER_KPI_IDS 맵으로 캐리어 id 직조회.
 *   맵 미존재 / 캐리어 ARCHIVED·부재 → null 반환 (→ 409 SALES_REVENUE_RECORD_REQUIRED).
 */
export async function resolveCarrierRecord(
  tx: TxClient,
  kpi: { id: string; isMirror: boolean; linkedOrgKpiId: string | null }
): Promise<{ actualAmount: bigint | null } | null> {
  if (!kpi.isMirror) {
    return tx.monthlyRecord.findFirst({
      where: { personalKpiId: kpi.id, isDraft: false, actualAmount: { not: null } },
      orderBy: { yearMonth: 'desc' },
      select: { actualAmount: true },
    })
  }

  const carrierId = kpi.linkedOrgKpiId ? CARRIER_KPI_IDS[kpi.linkedOrgKpiId] : undefined
  if (!carrierId) return null

  const carrier = await tx.personalKpi.findUnique({
    where: { id: carrierId },
    select: { status: true },
  })
  if (!carrier || carrier.status === 'ARCHIVED') return null

  return tx.monthlyRecord.findFirst({
    where: { personalKpiId: carrierId, isDraft: false, actualAmount: { not: null } },
    orderBy: { yearMonth: 'desc' },
    select: { actualAmount: true },
  })
}

/**
 * 서버 함수(personal-kpi-page, monthly-kpi-page) 전용 배치 버전.
 * 각 mirror KPI에 대해 캐리어의 monthlyRecords를 isDraft:false 조건으로 배치 로드.
 * 결정 2: isDraft:false 고정 — ADMIN draft가 31명 화면에 노출되는 것 차단.
 * 비-mirror KPI는 맵에 포함하지 않음 (호출 측에서 kpi.isMirror로 분기).
 */
export async function buildCarrierRecordsMap(
  db: PrismaClient,
  mirrorKpis: Array<{ id: string; linkedOrgKpiId: string | null }>
): Promise<Map<string, Awaited<ReturnType<PrismaClient['monthlyRecord']['findMany']>>>> {
  const result: Map<string, Awaited<ReturnType<PrismaClient['monthlyRecord']['findMany']>>> = new Map()

  if (mirrorKpis.length === 0) return result

  // 1) mirror → carrier id 매핑 (config 기반, findMany+distinct 미사용)
  const mirrorToCarrier = new Map<string, string>()
  const carrierIds = new Set<string>()
  for (const m of mirrorKpis) {
    if (!m.linkedOrgKpiId) continue
    const carrierId = CARRIER_KPI_IDS[m.linkedOrgKpiId]
    if (!carrierId) continue
    mirrorToCarrier.set(m.id, carrierId)
    carrierIds.add(carrierId)
  }

  if (carrierIds.size === 0) {
    for (const m of mirrorKpis) result.set(m.id, [])
    return result
  }

  // 2) ARCHIVED 캐리어 제외
  const validCarriers = await db.personalKpi.findMany({
    where: { id: { in: [...carrierIds] }, status: { not: 'ARCHIVED' } },
    select: { id: true },
  })
  const validCarrierIds = new Set(validCarriers.map(c => c.id))

  // 3) 유효 캐리어의 monthlyRecords 배치 로드 (isDraft:false 고정)
  const records = await db.monthlyRecord.findMany({
    where: { personalKpiId: { in: [...validCarrierIds] }, isDraft: false },
    orderBy: { yearMonth: 'desc' },
  })

  // 4) mirrorKpiId → records 매핑
  for (const m of mirrorKpis) {
    const carrierId = mirrorToCarrier.get(m.id)
    if (!carrierId || !validCarrierIds.has(carrierId)) {
      result.set(m.id, [])
      continue
    }
    result.set(m.id, records.filter(r => r.personalKpiId === carrierId))
  }

  return result
}
