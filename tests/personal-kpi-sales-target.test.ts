import assert from 'node:assert/strict'
import { resolveSalesTargetMode, validateSalesKpiTargetAmount } from '../src/lib/personal-kpi-sales-target'
function run(n: string, fn: () => void) { try { fn(); console.log('PASS ' + n) } catch (e) { console.error('FAIL ' + n); throw e } }
run('GENERAL -> manual', () => { assert.equal(resolveSalesTargetMode({ goalType: 'GENERAL', formTargetAmount: '', orgKpiTargetAmount: '1000000000' }), 'manual') })
run('SALES orgKpi=null -> manual', () => { assert.equal(resolveSalesTargetMode({ goalType: 'SALES_REVENUE', formTargetAmount: '', orgKpiTargetAmount: null }), 'manual') })
run('SALES orgKpi + form 비어있음 -> auto', () => { assert.equal(resolveSalesTargetMode({ goalType: 'SALES_REVENUE', formTargetAmount: '', orgKpiTargetAmount: '500000000' }), 'auto') })
run('SALES orgKpi + form 값 -> manual', () => { assert.equal(resolveSalesTargetMode({ goalType: 'SALES_REVENUE', formTargetAmount: '300000000', orgKpiTargetAmount: '500000000' }), 'manual') })
run('SALES orgKpi + form 콤마 -> manual', () => { assert.equal(resolveSalesTargetMode({ goalType: 'SALES_REVENUE', formTargetAmount: '300,000,000', orgKpiTargetAmount: '500000000' }), 'manual') })
run('validate auto -> 통과', () => { assert.equal(validateSalesKpiTargetAmount({ formTargetAmount: '', orgKpiTargetAmount: '1000000000' }), undefined) })
run('validate manual 유효 -> 통과', () => { assert.equal(validateSalesKpiTargetAmount({ formTargetAmount: '500000000', orgKpiTargetAmount: null }), undefined) })
run('validate manual 없음 -> 에러', () => { const r = validateSalesKpiTargetAmount({ formTargetAmount: '', orgKpiTargetAmount: null }); assert.ok(typeof r === 'string'); assert.match(r, /조직 KPI/) })
run('validate 비숫자 -> 에러', () => { const r = validateSalesKpiTargetAmount({ formTargetAmount: 'abc', orgKpiTargetAmount: null }); assert.ok(typeof r === 'string') })
run('validate 0 -> 에러', () => { const r = validateSalesKpiTargetAmount({ formTargetAmount: '0', orgKpiTargetAmount: null }); assert.ok(typeof r === 'string'); assert.match(r, /1 이상/) })
run('validate 콤마 포함 -> 통과', () => { assert.equal(validateSalesKpiTargetAmount({ formTargetAmount: '500,000,000', orgKpiTargetAmount: null }), undefined) })
run('validate 직접 0 orgKpi 있어도 -> 에러', () => { const r = validateSalesKpiTargetAmount({ formTargetAmount: '0', orgKpiTargetAmount: '500000000' }); assert.ok(typeof r === 'string') })
// 왕복 시나리오: SALES_REVENUE → GENERAL → SALES_REVENUE 복귀
// 핸들러가 targetAmount를 빈 문자열로 초기화하면 orgKpiTargetAmount 존재 시 auto 복귀해야 함
run('왕복 복귀: targetAmount 초기화 + orgKpi 있음 -> auto', () => { assert.equal(resolveSalesTargetMode({ goalType: 'SALES_REVENUE', formTargetAmount: '', orgKpiTargetAmount: '1000000000' }), 'auto') })
// 핸들러가 targetAmount를 초기화하지 않으면 직전 입력값이 잔류 -> manual (초기화 없을 때 발생하는 버그)
run('왕복 버그: targetAmount 잔류 시 orgKpi 있어도 manual', () => { assert.equal(resolveSalesTargetMode({ goalType: 'SALES_REVENUE', formTargetAmount: '1000000000', orgKpiTargetAmount: '1000000000' }), 'manual') })
