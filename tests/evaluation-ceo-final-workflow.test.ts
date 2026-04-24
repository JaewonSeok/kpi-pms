import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  buildCeoFinalDivisionScopeMap,
  requiresCeoFinalAdjustmentReason,
} from '../src/lib/evaluation-ceo-final'
import { CalibrationCandidateUpdateSchema } from '../src/lib/validations'

const CEO_PAGE_LABEL = '대표이사 확정'
const CEO_REASON_REQUIRED = '등급을 조정한 경우 사유를 입력해 주세요.'
const CEO_REDIRECT_MESSAGE =
  '대표이사 최종 확정은 대표이사 확정 화면에서 진행해 주세요.'
const ADMIN_READ_ONLY_MESSAGE =
  '관리자는 이 화면에서 결과를 조회할 수만 있으며 등급 조정과 최종 확정은 할 수 없습니다.'
const FINAL_REVIEW_READ_ONLY_MESSAGE =
  '현재 화면은 읽기 전용입니다. 최종 등급 수정과 확정은 대표이사만 수행할 수 있습니다.'
const DIVISION_SELECTION_LABEL = '본부별 선택'
const FINAL_GRADE_CONFIRMATION_LABEL = '최종 등급 확정'

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

  await run(
    'division scope map keeps the top-level division for both direct child teams and nested departments',
    () => {
      const scopeMap = buildCeoFinalDivisionScopeMap([
        { id: 'dept-hq', deptName: '경영본부', parentDeptId: null },
        { id: 'dept-biz', deptName: '사업본부', parentDeptId: 'dept-hq' },
        { id: 'dept-hr-team', deptName: 'HR팀', parentDeptId: 'dept-hq' },
        { id: 'dept-dev-office', deptName: '개발실', parentDeptId: 'dept-biz' },
        { id: 'dept-dev-team', deptName: '개발1팀', parentDeptId: 'dept-dev-office' },
      ])

      assert.deepEqual(scopeMap.get('dept-hq'), {
        divisionId: 'dept-hq',
        divisionName: '경영본부',
      })
      assert.deepEqual(scopeMap.get('dept-biz'), {
        divisionId: 'dept-biz',
        divisionName: '사업본부',
      })
      assert.deepEqual(scopeMap.get('dept-hr-team'), {
        divisionId: 'dept-hq',
        divisionName: '경영본부',
      })
      assert.deepEqual(scopeMap.get('dept-dev-office'), {
        divisionId: 'dept-biz',
        divisionName: '사업본부',
      })
      assert.deepEqual(scopeMap.get('dept-dev-team'), {
        divisionId: 'dept-biz',
        divisionName: '사업본부',
      })
    }
  )

  await run('division scope map still recognizes division-named departments in English hierarchies', () => {
    const scopeMap = buildCeoFinalDivisionScopeMap([
      { id: 'dept-root', deptName: 'Corporate', parentDeptId: null },
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
    assert.equal(
      loaderSource.includes(
        "const canManageFinalReview = params.role === 'ROLE_CEO' || params.role === 'ROLE_ADMIN'"
      ),
      true
    )
    assert.equal(loaderSource.includes('selectedScope'), true)
    assert.equal(loaderSource.includes(CEO_PAGE_LABEL), true)
  })

  await run('CEO final client keeps division selection visible and promotes the final grade select as the primary control', () => {
    const clientSource = read('src/components/evaluation/EvaluationCeoFinalClient.tsx')
    const rowCardSection = clientSource.slice(
      clientSource.indexOf('const showInlinePrimaryAction'),
      clientSource.indexOf('function EmployeeDrawer')
    )
    const reviewActionIndex = rowCardSection.indexOf('검토하기')
    const inlineReasonIndex = rowCardSection.indexOf('조정 사유')
    const cancelIndex = rowCardSection.indexOf('취소')
    const saveIndex = rowCardSection.indexOf('변경 저장')

    assert.equal(clientSource.includes('buildDivisionGroups'), true)
    assert.equal(clientSource.includes('buildSummary'), true)
    assert.equal(clientSource.includes('rowDrafts'), true)
    assert.equal(clientSource.includes('handleSave'), true)
    assert.equal(clientSource.includes('handleClear'), true)
    assert.equal(clientSource.includes('handleInlineSave'), true)
    assert.equal(clientSource.includes('handleInlineReset'), true)
    assert.equal(clientSource.includes('handleFinalizeCycle'), true)
    assert.equal(clientSource.includes('selectedGradeId'), true)
    assert.equal(clientSource.includes('showInlineReason'), true)
    assert.equal(clientSource.includes('reasonRequired={gradeChanged}'), true)
    assert.equal(clientSource.includes('/api/evaluation/calibration'), true)
    assert.equal(clientSource.includes('/api/evaluation/calibration/workflow'), true)
    assert.equal(clientSource.includes('summary.readyToLock'), true)
    assert.equal(clientSource.includes(CEO_PAGE_LABEL), true)
    assert.equal(clientSource.includes(CEO_REASON_REQUIRED), true)
    assert.equal(clientSource.includes(DIVISION_SELECTION_LABEL), true)
    assert.equal(clientSource.includes(FINAL_GRADE_CONFIRMATION_LABEL), true)
    assert.equal(clientSource.includes("onClick={() => void handleInlineSave(employee.id)}"), true)
    assert.equal(clientSource.includes('value={rowDraft.gradeId}'), true)
    assert.equal(clientSource.includes('변경 저장'), true)
    assert.equal(clientSource.includes('사유를 입력해 주세요'), true)
    assert.equal(clientSource.includes('선택 본부:'), true)
    assert.equal(clientSource.includes('전사 전체 보기'), true)
    assert.equal(clientSource.includes('selectedScope.isAll'), true)
    assert.equal(clientSource.includes('border-t border-sky-200/80 pt-3'), true)
    assert.equal(clientSource.includes('mt-4 flex justify-end border-t border-slate-100 pt-3'), true)
    assert.equal(clientSource.includes('InfoTile label="최종 등급"'), false)
    assert.equal(clientSource.includes(ADMIN_READ_ONLY_MESSAGE), false)
    assert.equal(clientSource.includes(FINAL_REVIEW_READ_ONLY_MESSAGE), false)
    assert.equal(rowCardSection.length > 0, true)
    assert.equal(reviewActionIndex > -1, true)
    assert.equal(inlineReasonIndex > -1, true)
    assert.equal(cancelIndex > -1, true)
    assert.equal(saveIndex > -1, true)
    assert.equal(reviewActionIndex < inlineReasonIndex, true)
    assert.equal(cancelIndex < saveIndex, true)
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
