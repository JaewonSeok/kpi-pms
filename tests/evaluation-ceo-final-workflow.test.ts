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

  await run('CEO final loader exposes grouped review data and read-only actor capability rules', () => {
    const loaderSource = read('src/server/evaluation-ceo-final-page.ts')

    assert.equal(loaderSource.includes('buildCeoFinalDivisionGroups'), true)
    assert.equal(loaderSource.includes('buildCeoFinalSummary'), true)
    assert.equal(loaderSource.includes('loadBriefingPreviewMap'), true)
    assert.equal(loaderSource.includes('performanceDetailHref'), true)
    assert.equal(loaderSource.includes("canFinalizeCycle: params.role === 'ROLE_CEO' && !params.isLocked"), true)
    assert.equal(loaderSource.includes("const readOnly = params.role !== 'ROLE_CEO' || params.isLocked"), true)
    assert.equal(loaderSource.includes(CEO_PAGE_LABEL), true)
  })

  await run('CEO final client is review-first and wires save, clear, and final-close interactions', () => {
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
  })

  await run('CEO save route preserves audit fields and restricts final confirmation mutations to the CEO role', () => {
    const saveRouteSource = read('src/app/api/evaluation/calibration/route.ts')

    assert.equal(saveRouteSource.includes("['save', 'clear', 'bulk-import'].includes(body.action)"), true)
    assert.equal(saveRouteSource.includes('CEO_ONLY'), true)
    assert.equal(saveRouteSource.includes('ADJUST_REASON_REQUIRED'), true)
    assert.equal(saveRouteSource.includes('originalDivisionHeadGrade'), true)
    assert.equal(saveRouteSource.includes('confirmedBy'), true)
  })

  await run('CEO workflow route blocks final close until every employee is confirmed and keeps reason enforcement', () => {
    const workflowRouteSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(workflowRouteSource.includes('FINAL_CONFIRMATION_INCOMPLETE'), true)
    assert.equal(workflowRouteSource.includes('pendingFinalConfirmationCount'), true)
    assert.equal(workflowRouteSource.includes('requiresCeoFinalAdjustmentReason'), true)
    assert.equal(workflowRouteSource.includes('MISSING_REASON'), true)
    assert.equal(workflowRouteSource.includes('CEO_ONLY'), true)
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
