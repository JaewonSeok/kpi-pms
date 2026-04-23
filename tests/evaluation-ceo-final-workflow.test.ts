import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildCeoFinalDivisionScopeMap,
  requiresCeoFinalAdjustmentReason,
} from '../src/lib/evaluation-ceo-final'
import { CalibrationCandidateUpdateSchema } from '../src/lib/validations'

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
        adjustmentReason: '분포와 근거를 재검토해 조정했습니다.',
      }),
      false
    )
  })

  await run('division scope map keeps headquarters as the grouping key for direct and nested departments', () => {
    const scopeMap = buildCeoFinalDivisionScopeMap([
      { id: 'dept-root', deptName: 'RSUPPORT', parentDeptId: null },
      { id: 'dept-div', deptName: '고객지원본부', parentDeptId: 'dept-root' },
      { id: 'dept-team', deptName: 'CX팀', parentDeptId: 'dept-div' },
      { id: 'dept-pod', deptName: 'VOC 실행셀', parentDeptId: 'dept-team' },
    ])

    assert.deepEqual(scopeMap.get('dept-div'), {
      divisionId: 'dept-div',
      divisionName: '고객지원본부',
    })
    assert.deepEqual(scopeMap.get('dept-team'), {
      divisionId: 'dept-div',
      divisionName: '고객지원본부',
    })
    assert.deepEqual(scopeMap.get('dept-pod'), {
      divisionId: 'dept-div',
      divisionName: '고객지원본부',
    })
  })

  await run('calibration save schema allows blank reason so unchanged-grade final confirmation can pass', () => {
    const parsed = CalibrationCandidateUpdateSchema.safeParse({
      action: 'save',
      cycleId: 'cycle-1',
      targetId: 'target-1',
      gradeId: 'grade-a',
      adjustReason: '',
    })

    assert.equal(parsed.success, true)
  })

  await run('division-head submit path routes to CEO final approval without the generic next-assignee block', () => {
    const submitRouteSource = read('src/app/api/evaluation/[id]/submit/route.ts')

    assert.equal(submitRouteSource.includes('resolveEvaluationStageAssignee'), true)
    assert.equal(submitRouteSource.includes("stage: 'CEO_ADJUST'"), true)
    assert.equal(submitRouteSource.includes('CEO_FINAL_APPROVER_REQUIRED'), true)
    assert.equal(
      submitRouteSource.includes('대표이사 최종 확정자를 찾을 수 없어 본부장 평가를 제출할 수 없습니다.'),
      true
    )
  })

  await run('CEO final approval routes and loader enforce division grouping and changed-grade reason validation', () => {
    const loaderSource = read('src/server/evaluation-calibration.ts')
    const saveRouteSource = read('src/app/api/evaluation/calibration/route.ts')
    const workflowRouteSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(loaderSource.includes('buildCeoFinalDivisionScopeMap'), true)
    assert.equal(loaderSource.includes('divisionId'), true)
    assert.equal(loaderSource.includes('divisionName'), true)
    assert.equal(loaderSource.includes('finalized'), true)
    assert.equal(saveRouteSource.includes('ADJUST_REASON_REQUIRED'), true)
    assert.equal(saveRouteSource.includes('originalDivisionHeadGrade'), true)
    assert.equal(workflowRouteSource.includes('requiresCeoFinalAdjustmentReason'), true)
    assert.equal(
      workflowRouteSource.includes('등급을 변경했지만 조정 사유가 없는 항목이 있어 최종 확정을 완료할 수 없습니다.'),
      true
    )
  })

  await run('CEO calibration client exposes division-based final confirmation wording', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')
    const workbenchSource = read('src/server/evaluation-workbench.ts')

    assert.equal(clientSource.includes('대표이사 확정 대상 필터'), true)
    assert.equal(clientSource.includes('본부장 평가 등급'), true)
    assert.equal(clientSource.includes('대표이사 최종 등급'), true)
    assert.equal(clientSource.includes('최종 확정'), true)
    assert.equal(clientSource.includes('전체 본부'), true)
    assert.equal(
      workbenchSource.includes('대표이사 최종 확정은 대표이사 확정 화면에서 진행해 주세요.'),
      true
    )
  })

  console.log('Evaluation CEO final workflow tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
