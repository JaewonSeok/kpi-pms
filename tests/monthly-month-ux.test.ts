import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('monthly KPI client derives page, list, and detail month context from one source', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('function parseYearMonth('), true)
    assert.equal(source.includes('const monthContext = useMemo('), true)
    assert.equal(source.includes('parseYearMonth(pageData.selectedYear, pageData.selectedMonth)'), true)
    assert.equal(source.includes('{monthContext.screenTitle}'), true)
    assert.equal(source.includes('현재 선택 월: {monthContext.fullLabel}'), true)
    assert.equal(source.includes('{monthContext.fullLabel} KPI별 월간 입력'), true)
    assert.equal(
      source.includes('{selected ? `${selected.kpiTitle} · ${monthContext.fullLabel} 입력 상세` : `${monthContext.fullLabel} 입력 상세`}'),
      true
    )
    assert.equal(source.includes('{monthContext.shortLabel} 실적값'), true)
    assert.equal(source.includes('{monthContext.shortLabel} 활동 내용'), true)
    assert.equal(source.includes('{monthContext.shortLabel} 장애요인'), true)
    assert.equal(source.includes('{monthContext.shortLabel} 극복 노력'), true)
  })

  await run('monthly KPI client exposes synchronized quick month chips and dropdown routing', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('function MonthQuickSwitch({'), true)
    assert.equal(source.includes('getQuickMonthOptions(selectedYear, selectedMonth)'), true)
    assert.equal(source.includes('빠른 월 이동'), true)
    assert.equal(source.includes('aria-pressed={selected}'), true)
    assert.equal(source.includes('value={pageData.selectedMonth}'), true)
    assert.equal(source.includes('selectedMonth={pageData.selectedMonth}'), true)
    assert.equal(source.includes("onChange={(month) => handleRouteSelection({ month, tab: 'entry', recordId: '' })}"), true)
    assert.equal(source.includes("onChange={(event) => handleRouteSelection({ month: event.target.value, tab: 'entry', recordId: '' })}"), true)
  })

  await run('monthly KPI client updates empty states with selected month context', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('{monthContext.fullLabel} 기준 조건에 맞는 월간 실적이 없습니다.'), true)
    assert.equal(source.includes('{monthContext.fullLabel}에 입력할 KPI를 선택해 주세요.'), true)
  })

  await run('monthly KPI client removes the large dashboard summary cards and keeps compact next actions', () => {
    const source = read('src/components/kpi/MonthlyKpiManagementClient.tsx')
    assert.equal(source.includes('function SummaryCard('), false)
    assert.equal(source.includes('<SummaryCard label="이번 달 KPI"'), false)
    assert.equal(source.includes('<SummaryCard label="평균 달성률"'), false)
    assert.equal(source.includes('<SummaryCard label="제출 완료 KPI"'), false)
    assert.equal(source.includes('<SummaryCard label="미입력 KPI"'), false)
    assert.equal(source.includes('<SummaryCard label="위험 신호 KPI"'), false)
    assert.equal(source.includes('<SummaryCard label="상사 리뷰 대기 KPI"'), false)
    assert.equal(source.includes('function CompactActionChip('), true)
    assert.equal(source.includes('다음 행동'), true)
    assert.equal(source.includes('미입력 KPI'), true)
    assert.equal(source.includes('위험 신호 KPI'), true)
    assert.equal(source.includes('상사 리뷰 대기 KPI'), true)
  })

  console.log('Monthly month UX tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
