import assert from 'node:assert/strict'
import { shouldShowSalesBanner, findSalesLinkedOrgKpiId } from '../src/lib/personal-kpi-sales-banner'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const BASE_ORG_KPI = [{ targetAmount: '100000000' }]

// ── 기본 조건 ──────────────────────────────────────────────────────────────────

run('비SALES 직군 (GENERAL) → 배너 숨김', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'GENERAL',
      createDisabledReason: undefined,
      mineItems: [],
      orgKpiOptions: BASE_ORG_KPI,
    }),
    false
  )
})

run('SALES + 게이트 닫힘 (createDisabledReason 있음) → 배너 숨김', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: '현재 범위에서는 개인 KPI를 추가할 권한이 없습니다.',
      mineItems: [],
      orgKpiOptions: BASE_ORG_KPI,
    }),
    false
  )
})

run('SALES + 활성 SALES_REVENUE KPI 보유 → 배너 숨김', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [{ goalType: 'SALES_REVENUE', persistedStatus: 'SUBMITTED' }],
      orgKpiOptions: BASE_ORG_KPI,
    }),
    false
  )
})

run('SALES + DRAFT 상태 SALES_REVENUE KPI 보유 → 배너 숨김 (ARCHIVED 아님)', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [{ goalType: 'SALES_REVENUE', persistedStatus: 'DRAFT' }],
      orgKpiOptions: BASE_ORG_KPI,
    }),
    false
  )
})

run('SALES + ARCHIVED SALES_REVENUE KPI만 보유 → 배너 표시 (ARCHIVED는 미보유로 취급)', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [{ goalType: 'SALES_REVENUE', persistedStatus: 'ARCHIVED' }],
      orgKpiOptions: BASE_ORG_KPI,
    }),
    true
  )
})

// ── orgKpiOptions targetAmount 변형 ──────────────────────────────────────────

run('SALES + orgKpiOptions 빈 배열 → 배너 숨김', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [],
      orgKpiOptions: [],
    }),
    false
  )
})

run('SALES + orgKpiOptions targetAmount=null → 배너 숨김', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [],
      orgKpiOptions: [{ targetAmount: null }],
    }),
    false
  )
})

run('SALES + orgKpiOptions targetAmount="0" → 배너 숨김 (양수 아님)', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [],
      orgKpiOptions: [{ targetAmount: '0' }],
    }),
    false
  )
})

run('SALES + orgKpiOptions targetAmount="1" → 배너 표시', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [],
      orgKpiOptions: [{ targetAmount: '1' }],
    }),
    true
  )
})

run('SALES + null 혼재, 양수 하나 있음 → 배너 표시', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [],
      orgKpiOptions: [{ targetAmount: null }, { targetAmount: '0' }, { targetAmount: '500000000' }],
    }),
    true
  )
})

// ── 정상 케이스 ──────────────────────────────────────────────────────────────

run('모든 조건 충족 → 배너 표시', () => {
  assert.equal(
    shouldShowSalesBanner({
      jobCategory: 'SALES',
      createDisabledReason: undefined,
      mineItems: [{ goalType: 'GENERAL', persistedStatus: 'DRAFT' }],
      orgKpiOptions: [{ targetAmount: '1000000000' }],
    }),
    true
  )
})

// ── findSalesLinkedOrgKpiId ────────────────────────────────────────────────

run('findSalesLinkedOrgKpiId: 양수 옵션만 있을 때 해당 id 반환', () => {
  assert.equal(
    findSalesLinkedOrgKpiId([
      { id: 'kpi-1', deptId: 'd1', targetAmount: '500000000' },
    ]),
    'kpi-1'
  )
})

run('findSalesLinkedOrgKpiId: 옵션 전무(빈 배열) → 빈 문자열', () => {
  assert.equal(findSalesLinkedOrgKpiId([]), '')
})

run('findSalesLinkedOrgKpiId: null/"0"/양수 혼재 → 첫 양수 id 반환', () => {
  assert.equal(
    findSalesLinkedOrgKpiId([
      { id: 'kpi-null', deptId: 'd1', targetAmount: null },
      { id: 'kpi-zero', deptId: 'd2', targetAmount: '0' },
      { id: 'kpi-pos', deptId: 'd3', targetAmount: '1000000' },
    ]),
    'kpi-pos'
  )
})

run('findSalesLinkedOrgKpiId: null/"0"만 있을 때 → 빈 문자열', () => {
  assert.equal(
    findSalesLinkedOrgKpiId([
      { id: 'kpi-null', deptId: 'd1', targetAmount: null },
      { id: 'kpi-zero', deptId: 'd2', targetAmount: '0' },
    ]),
    ''
  )
})

run('findSalesLinkedOrgKpiId: 자팀(deptId 일치) 양수 우선 → 자팀 id 반환', () => {
  assert.equal(
    findSalesLinkedOrgKpiId(
      [
        { id: 'kpi-other', deptId: 'd1', targetAmount: '300000000' },
        { id: 'kpi-mine', deptId: 'd2', targetAmount: '500000000' },
      ],
      'd2'
    ),
    'kpi-mine'
  )
})

run('findSalesLinkedOrgKpiId: 자팀 무양수 시 첫 양수 폴백', () => {
  assert.equal(
    findSalesLinkedOrgKpiId(
      [
        { id: 'kpi-pos', deptId: 'd1', targetAmount: '300000000' },
        { id: 'kpi-mine-zero', deptId: 'd2', targetAmount: '0' },
      ],
      'd2'
    ),
    'kpi-pos'
  )
})

console.log('Sales KPI banner condition tests completed')
