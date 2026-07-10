/**
 * seed-mirror-kpi.ts
 * 영업본부 공통 KPI 배포 스크립트.
 *
 * 대상: jobCategory='SALES' AND status='ACTIVE' 직원 전원 + 한상준(캐리어, 상수 id).
 * 한상준 → isMirror=false (캐리어), 나머지 → isMirror=true (미러).
 *
 * DRY_RUN=true(기본): write 0건, 출력만.
 * DRY_RUN=false:      실제 생성 + auditLog 일괄 기록.
 *
 * 실행:
 *   ts-node -P tsconfig.seed.json scripts/seed-mirror-kpi.ts          # dry-run
 *   DRY_RUN=false ts-node -P tsconfig.seed.json scripts/seed-mirror-kpi.ts
 *
 * ⚠️  production DB 직접 실행 금지 — 별도 승인 후 별도 단계에서만.
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

// ─── DB 호스트 추출 (자격증명 제외) ────────────────────────────────────────────

function resolveDbHost(): string {
  const raw = process.env.DATABASE_URL ?? ''
  try {
    return new URL(raw).hostname
  } catch {
    return '(URL parse 실패)'
  }
}

const DB_HOST = resolveDbHost()

// ─── 상수 ──────────────────────────────────────────────────────────────────────

/** 한상준 — production 확정값. 로컬 DB 조회 금지(로컬엔 영업 조직 없음). */
const CARRIER_EMPLOYEE_ID  = 'cmpev9i04000x04jst5idpj33'

/** 국내영업본부 매출 앵커 OrgKpi (targetAmount 21,700,000,000). */
const LINKED_ORG_KPI_ID    = 'cmr0ab87u000004jpeddn6nic'

const EVAL_YEAR            = 2026
const KPI_NAME             = '국내 영업 매출 달성 (본부 공통)'
const KPI_DEFINITION       = '본부 공통 매출목표. 달성률은 국내영업+SaaS+MA 합산 실적 기준으로 자동 반영됩니다.'

/**
 * AuditLog.userId — 스키마에서 Employee FK 없는 단순 String 필드(schema.prisma L2992).
 * 스크립트 실행자 표기용으로 'SEED_SCRIPT' 허용.
 */
const SEED_ACTOR_ID        = 'SEED_SCRIPT'

/**
 * difficulty: Prisma 스키마에서 required, no default(schema.prisma L495).
 * 스펙 "difficulty 미설정" = 컬럼 자체는 채워야 함.
 * 공통 배포 KPI는 개인 난이도 개념이 없으므로 중립값 'MEDIUM' 적용.
 */
const DEFAULT_DIFFICULTY   = 'MEDIUM' as const

/** POST /api/kpi/personal 라우트와 동일하게 재현할 강제 필드 (route.ts 근거 라인):
 *  1. kpiType → 'QUANTITATIVE'  (SALES_REVENUE이면 서버 강제, route.ts L219)
 *  2. targetValue: null          (SALES_REVENUE branch, route.ts L225)
 *  3. status: 'DRAFT'            (항상 하드코딩, route.ts L236)
 *  4. policyCategory 5컬럼 null  (buildPolicyCategoryPersistenceAtCreate2026(null), route.ts L239)
 *  위 4가지 모두 아래 create data에 명시 재현.
 */

const DRY_RUN              = process.env.DRY_RUN !== 'false'
const CONFIRM_PRODUCTION   = process.argv.includes('--confirm-production')

// ─── 타입 ──────────────────────────────────────────────────────────────────────

type PrefightAction = 'CREATE' | 'SKIP-A' | 'SKIP-B'

type ResultRow = {
  employeeId: string
  name:       string
  action:     PrefightAction
  isCarrier:  boolean
  reason?:    string
}

type AuditInput = {
  userId:     string
  action:     string
  entityType: string
  entityId:   string
  newValue:   Record<string, unknown>
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  // 0. 접속 호스트 표시 (항상 출력 — DRY_RUN 무관)
  console.log(`[DB-HOST] ${DB_HOST}  (DRY_RUN=${DRY_RUN})`)

  // DRY_RUN=false 진입 전 production 확인 게이트
  if (!DRY_RUN && !CONFIRM_PRODUCTION) {
    console.error(
      '\n[ABORT] DRY_RUN=false 실행에는 --confirm-production 플래그가 필요합니다.\n' +
      `  접속 호스트: ${DB_HOST}\n` +
      '  위 호스트가 의도한 DB임을 확인했다면:\n' +
      '  DRY_RUN=false ts-node -P tsconfig.seed.json scripts/seed-mirror-kpi.ts --confirm-production\n'
    )
    process.exit(1)
  }

  if (!DRY_RUN) {
    console.log(`[PRODUCTION-WRITE] 접속 호스트: ${DB_HOST}  플래그: --confirm-production 확인됨`)
  }

  // 1. 대상 직원 수집: SALES+ACTIVE + 한상준(상수)
  const salesEmployees = await prisma.employee.findMany({
    where: { jobCategory: 'SALES', status: 'ACTIVE' },
    select: { id: true, empName: true },
  })

  const salesIds = new Set(salesEmployees.map(e => e.id))
  const allTargets: Array<{ id: string; name: string }> = salesEmployees.map(e => ({ id: e.id, name: e.empName }))

  // 한상준이 SALES+ACTIVE 조회에 없는 경우 명시 추가 (첫 위치 = 캐리어 행)
  if (!salesIds.has(CARRIER_EMPLOYEE_ID)) {
    allTargets.unshift({ id: CARRIER_EMPLOYEE_ID, name: '한상준 (상수)' })
  }

  // 2. preflight per 대상
  const rows: ResultRow[] = []

  for (const emp of allTargets) {
    // SKIP-A: 동일 employeeId+evalYear에 goalType='SALES_REVENUE' AND status != 'ARCHIVED' 존재
    const existingSales = await prisma.personalKpi.findFirst({
      where: {
        employeeId: emp.id,
        evalYear:   EVAL_YEAR,
        goalType:   'SALES_REVENUE',
        status:     { not: 'ARCHIVED' },
      },
      select: { id: true },
    })
    if (existingSales) {
      rows.push({
        employeeId: emp.id,
        name:       emp.name,
        action:     'SKIP-A',
        isCarrier:  emp.id === CARRIER_EMPLOYEE_ID,
        reason:     `기존 SALES_REVENUE KPI 존재 (${existingSales.id})`,
      })
      continue
    }

    // SKIP-B: 동명 KPI 존재 (evalYear 포함 unique 조건)
    const existingName = await prisma.personalKpi.findFirst({
      where: {
        employeeId: emp.id,
        evalYear:   EVAL_YEAR,
        kpiName:    KPI_NAME,
      },
      select: { id: true },
    })
    if (existingName) {
      rows.push({
        employeeId: emp.id,
        name:       emp.name,
        action:     'SKIP-B',
        isCarrier:  emp.id === CARRIER_EMPLOYEE_ID,
        reason:     `동명 KPI 존재 (${existingName.id})`,
      })
      continue
    }

    rows.push({
      employeeId: emp.id,
      name:       emp.name,
      action:     'CREATE',
      isCarrier:  emp.id === CARRIER_EMPLOYEE_ID,
    })
  }

  // 3. H-3 양식 출력
  const carrierRow = rows.find(r => r.isCarrier)

  // 캐리어 행 (항상 첫 줄)
  if (!carrierRow || carrierRow.action === 'CREATE') {
    console.log(
      `[CARRIER] ${carrierRow?.name ?? '한상준 (상수)'} (${CARRIER_EMPLOYEE_ID})` +
      ` isMirror=false → 예상 KPI id: (DRY_RUN — 실행 후 출력됨)`
    )
  } else {
    console.log(
      `[CARRIER/${carrierRow.action}] ${carrierRow.name} (${CARRIER_EMPLOYEE_ID})` +
      ` — ${carrierRow.reason}`
    )
  }

  // 나머지 행
  for (const r of rows) {
    if (r.isCarrier) continue  // 이미 위에서 출력
    if (r.action === 'CREATE') {
      console.log(`[CREATE]  ${r.name} (${r.employeeId}) isMirror=true`)
    } else {
      console.log(`[${r.action}] ${r.name} (${r.employeeId}) — ${r.reason}`)
    }
  }

  // FIELD-EXAMPLE: 첫 CREATE 대상의 필드 전체 1회 출력
  const firstCreate = rows.find(r => r.action === 'CREATE')
  if (firstCreate) {
    console.log('\n[FIELD-EXAMPLE] 첫 CREATE 대상 필드 전체:')
    console.log(JSON.stringify({
      // ── 스펙 명시 필드 ──
      employeeId:     firstCreate.employeeId,
      evalYear:       EVAL_YEAR,
      kpiName:        KPI_NAME,
      goalType:       'SALES_REVENUE',
      kpiType:        'QUANTITATIVE',    // ① POST route.ts L219 강제
      status:         'DRAFT',           // ③ POST route.ts L236 강제
      weight:         0,
      targetAmount:   null,
      linkedOrgKpiId: LINKED_ORG_KPI_ID,
      isMirror:       !firstCreate.isCarrier,
      definition:     KPI_DEFINITION,
      difficulty:     DEFAULT_DIFFICULTY,  // required, no default → MEDIUM
      // ── POST 라우트 강제 추가 필드 ──
      targetValue:              null,      // ② POST route.ts L225 강제
      formula:                  null,
      // policyCategory 5컬럼 null ④ (buildPolicyCategoryPersistenceAtCreate2026(null), route.ts L239)
      policyCategory:           null,
      policyCategoryConfidence: null,
      policyCategorySource:     null,
      policyCategoryReviewedAt: null,
      policyCategoryReviewNote: null,
    }, null, 2))
  }

  const createCount = rows.filter(r => r.action === 'CREATE').length
  console.log(`\n[SUMMARY] ${rows.length}명 중 ${createCount} CREATE (DRY_RUN=${DRY_RUN})`)

  if (DRY_RUN) {
    console.log('[DRY_RUN] write 0건. DRY_RUN=false 로 재실행해야 반영됩니다.')
    return
  }

  // 4. 실제 생성 — DRY_RUN=false 경로 (production 별도 승인 후에만 실행할 것)
  const toCreate = rows.filter(r => r.action === 'CREATE')
  const auditRows: AuditInput[] = []

  for (const r of toCreate) {
    const isCarrier = r.employeeId === CARRIER_EMPLOYEE_ID

    const kpi = await prisma.personalKpi.create({
      data: {
        employeeId:     r.employeeId,
        evalYear:       EVAL_YEAR,
        kpiType:        'QUANTITATIVE',   // ① route.ts L219
        kpiName:        KPI_NAME,
        definition:     KPI_DEFINITION,
        formula:        null,
        goalType:       'SALES_REVENUE',
        targetAmount:   null,
        targetValue:    null,             // ② route.ts L225
        weight:         0,
        difficulty:     DEFAULT_DIFFICULTY,
        linkedOrgKpiId: LINKED_ORG_KPI_ID,
        status:         'DRAFT',          // ③ route.ts L236
        isMirror:       !isCarrier,
        // ④ policyCategory 5컬럼 null (route.ts L239 buildPolicyCategoryPersistenceAtCreate2026(null))
        policyCategory:           null,
        policyCategoryConfidence: null,
        policyCategorySource:     null,
        policyCategoryReviewedAt: null,
        policyCategoryReviewNote: null,
      },
    })

    if (isCarrier) {
      console.log(
        `[CARRIER-ID] ${kpi.id}` +
        `  ← mirror-config.ts의 CARRIER_KPI_IDS['${LINKED_ORG_KPI_ID}'] 에 이 값을 입력 후 별도 커밋`
      )
    }

    console.log(`[CREATED] ${r.name} (${r.employeeId}) → kpi.id=${kpi.id} isMirror=${kpi.isMirror}`)

    auditRows.push({
      userId:     SEED_ACTOR_ID,
      action:     'PERSONAL_KPI_CREATED',
      entityType: 'PersonalKpi',
      entityId:   kpi.id,
      newValue: {
        employeeId:    kpi.employeeId,
        evalYear:      kpi.evalYear,
        kpiName:       kpi.kpiName,
        kpiType:       kpi.kpiType,
        goalType:      kpi.goalType,
        targetAmount:  kpi.targetAmount !== null ? kpi.targetAmount.toString() : null,
        targetValue:   kpi.targetValue,
        weight:        kpi.weight,
        difficulty:    kpi.difficulty,
        linkedOrgKpiId: kpi.linkedOrgKpiId,
        status:        kpi.status,
        isMirror:      kpi.isMirror,
        source:        'seed-mirror-kpi',
      },
    })
  }

  // 감사 로그 일괄 기록 (AuditLog.userId = String, FK 없음 — schema.prisma L2992)
  if (auditRows.length > 0) {
    await prisma.auditLog.createMany({
      data: auditRows.map(r => ({
        userId:     r.userId,
        action:     r.action,
        entityType: r.entityType,
        entityId:   r.entityId,
        newValue:   r.newValue as never,
      })),
    })
  }

  console.log(`\n[DONE] ${toCreate.length}건 생성 완료 / 감사로그 ${auditRows.length}건 기록`)
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
