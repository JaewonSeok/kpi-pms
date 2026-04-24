import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildCeoFinalDivisionScopeMap,
  requiresCeoFinalAdjustmentReason,
} from '../src/lib/evaluation-ceo-final'
import { CalibrationCandidateUpdateSchema } from '../src/lib/validations'

const CEO_PAGE_LABEL = '\uB300\uD45C\uC774\uC0AC \uD655\uC815'
const CEO_REASON_REQUIRED = '\uB4F1\uAE09\uC744 \uC870\uC815\uD55C \uACBD\uC6B0 \uC0AC\uC720\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.'
const CEO_REDIRECT_MESSAGE =
  '\uB300\uD45C\uC774\uC0AC \uCD5C\uC885 \uD655\uC815\uC740 \uB300\uD45C\uC774\uC0AC \uD655\uC815 \uD654\uBA74\uC5D0\uC11C \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.'
const ADMIN_READ_ONLY_MESSAGE =
  '\uAD00\uB9AC\uC790\uB294 \uC774 \uD654\uBA74\uC5D0\uC11C \uACB0\uACFC\uB97C \uC870\uD68C\uD560 \uC218\uB9CC \uC788\uC73C\uBA70 \uB4F1\uAE09 \uC870\uC815\uACFC \uCD5C\uC885 \uD655\uC815\uC740 \uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'
const FINAL_REVIEW_READ_ONLY_MESSAGE =
  '\uD604\uC7AC \uD654\uBA74\uC740 \uC77D\uAE30 \uC804\uC6A9\uC785\uB2C8\uB2E4. \uCD5C\uC885 \uB4F1\uAE09 \uC218\uC815\uACFC \uD655\uC815\uC740 \uB300\uD45C\uC774\uC0AC\uB9CC \uC218\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'
const DIVISION_SELECTION_LABEL = '\uBCF8\uBD80\uBCC4 \uC120\uD0DD'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('CEO final reason helper only requires a reason when the grade changes', () => {
    assert.equal(
      requiresCeoFinalAdjustmentReason({
        originalDivisionHeadGradeId: 'grade-a',
        finalCeoGradeId: 'grade-a',
        adjustmentReason: '',
      }),
      false
    )
    assert.equal(
      requiresCeoFinalAdjustmentReason({
        originalDivisionHeadGradeId: 'grade-a',
        finalCeoGradeId: 'grade-b',
        adjustmentReason: '',
      }),
      true
    )
    assert.equal(
      requiresCeoFinalAdjustmentReason({
        originalDivisionHeadGradeId: 'grade-a',
        finalCeoGradeId: 'grade-b',
        adjustmentReason: 'Adjusted after reviewing additional evidence.',
      }),
      false
    )
  })

  await run('division scope map keeps headquarters as the grouping key for nested departments', () => {
    const scopeMap = buildCeoFinalDivisionScopeMap([
      { id: 'dept-root', deptName: 'RSUPPORT', parentDeptId: null },
      { id: 'dept-div', deptName: 'Customer Division', parentDeptId: 'dept-root' },
      { id: 'dept-team', deptName: 'CX Team', parentDeptId: 'dept-div' },
      { id: 'dept-pod', deptName: 'VOC Pod', parentDeptId: 'dept-team' },
    ])

    assert.deepEqual(scopeMap.get('dept-div'), {
      divisionId: 'dept-div',
      divisionName: 'Customer Division',
    })
    assert.deepEqual(scopeMap.get('dept-team'), {
      divisionId: 'dept-div',
      divisionName: 'Customer Division',
    })
    assert.deepEqual(scopeMap.get('dept-pod'), {
      divisionId: 'dept-div',
      divisionName: 'Customer Division',
    })
  })

  await run('save schema still allows blank reason so unchanged-grade final confirmation can pass', () => {
    const parsed = CalibrationCandidateUpdateSchema.safeParse({
      action: 'save',
      cycleId: 'cycle-1',
      targetId: 'target-1',
      gradeId: 'grade-a',
      adjustReason: '',
    })

    assert.equal(parsed.success, true)
  })

  await run('division-head submit route resolves CEO final approver without falling back to the generic next-stage block', () => {
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(submitRouteSource.includes('resolveEvaluationStageAssignee'), true)
    assert.equal(submitRouteSource.includes("stage: 'CEO_ADJUST'"), true)
    assert.equal(submitRouteSource.includes('CEO_FINAL_APPROVER_REQUIRED'), true)
    assert.equal(submitRouteSource.includes("evaluation.evalStage !== 'CEO_ADJUST'"), true)
  })

  await run('CEO final page route now uses the dedicated loader and client', () => {
    const pageSource = read('src/app/(main)/evaluation/ceo-adjust/page.tsx')

    assert.equal(pageSource.includes('getEvaluationCeoFinalPageData'), true)
    assert.equal(pageSource.includes('EvaluationCeoFinalClient'), true)
    assert.equal(pageSource.includes('getEvaluationCalibrationPageData'), false)
    assert.equal(pageSource.includes('EvaluationCalibrationClient'), false)
  })

  await run('CEO final loader exposes grouped review data and editable actor capability rules for CEO and admin', () => {
    const loaderSource = read('src/server/evaluation-ceo-final-page.ts')

    assert.equal(loaderSource.includes('buildCeoFinalDivisionGroups'), true)
    assert.equal(loaderSource.includes('buildCeoFinalSummary'), true)
    assert.equal(loaderSource.includes('loadBriefingPreviewMap'), true)
    assert.equal(loaderSource.includes('performanceDetailHref'), true)
    assert.equal(loaderSource.includes('const canManageFinalReview = params.role === \'ROLE_CEO\' || params.role === \'ROLE_ADMIN\''), true)
    assert.equal(loaderSource.includes('selectedScope'), true)
    assert.equal(loaderSource.includes(CEO_PAGE_LABEL), true)
  })

  await run('CEO final client is review-first, keeps division selection visible, and removes the old admin read-only copy', () => {
    const clientSource = read('src/components/evaluation/EvaluationCeoFinalClient.tsx')

    assert.equal(clientSource.includes('buildDivisionGroups'), true)
    assert.equal(clientSource.includes('buildSummary'), true)
    assert.equal(clientSource.includes('handleSave'), true)
    assert.equal(clientSource.includes('handleClear'), true)
    assert.equal(clientSource.includes('handleFinalizeCycle'), true)
    assert.equal(clientSource.includes('selectedGradeId'), true)
    assert.equal(clientSource.includes('reasonRequired={gradeChanged}'), true)
    assert.equal(clientSource.includes('/api/evaluation/calibration'), true)
    assert.equal(clientSource.includes('/api/evaluation/calibration/workflow'), true)
    assert.equal(clientSource.includes('summary.readyToLock'), true)
    assert.equal(clientSource.includes(CEO_PAGE_LABEL), true)
    assert.equal(clientSource.includes(CEO_REASON_REQUIRED), true)
    assert.equal(clientSource.includes(DIVISION_SELECTION_LABEL), true)
    assert.equal(clientSource.includes('선택 본부:'), true)
    assert.equal(clientSource.includes('전사 전체 보기'), true)
    assert.equal(clientSource.includes('selectedScope.isAll'), true)
    assert.equal(clientSource.includes(ADMIN_READ_ONLY_MESSAGE), false)
    assert.equal(clientSource.includes(FINAL_REVIEW_READ_ONLY_MESSAGE), false)
  })

  await run('CEO save route preserves audit fields while allowing admin and CEO final confirmation mutations', () => {
    const saveRouteSource = read('src/app/api/evaluation/calibration/route.ts')

    assert.equal(saveRouteSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(saveRouteSource.includes('대표이사만 최종 등급을 조정하거나 확정할 수 있습니다.'), false)
    assert.equal(saveRouteSource.includes('ADJUST_REASON_REQUIRED'), true)
    assert.equal(saveRouteSource.includes('originalDivisionHeadGrade'), true)
    assert.equal(saveRouteSource.includes('confirmedBy'), true)
  })

  await run('CEO workflow route blocks final close until every employee is confirmed while allowing admin and CEO actions', () => {
    const workflowRouteSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(workflowRouteSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(workflowRouteSource.includes('FINAL_CONFIRMATION_INCOMPLETE'), true)
    assert.equal(workflowRouteSource.includes('pendingFinalConfirmationCount'), true)
    assert.equal(workflowRouteSource.includes('requiresCeoFinalAdjustmentReason'), true)
    assert.equal(workflowRouteSource.includes('MISSING_REASON'), true)
    assert.equal(workflowRouteSource.includes('대표이사만 최종 확정 단계를 진행할 수 있습니다.'), false)
    assert.equal(workflowRouteSource.includes('최종 잠금은 CEO만 수행할 수 있습니다.'), false)
  })

  await run('workbench and cross-links point to the CEO final workspace', () => {
    const workbenchSource = read('src/server/evaluation-workbench.ts')
    const adminOpsSource = read('src/components/ops/AdminOpsClient.tsx')
    const compensationSource = read('src/components/compensation/CompensationManageClient.tsx')

    assert.equal(workbenchSource.includes(CEO_REDIRECT_MESSAGE), true)
    assert.equal(adminOpsSource.includes(CEO_PAGE_LABEL), true)
    assert.equal(compensationSource.includes(CEO_PAGE_LABEL), true)
  })

  console.log('Evaluation CEO final workflow tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
