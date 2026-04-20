import assert from 'node:assert/strict'
import {
  canEmployeeEditGateCase,
  canGateStatusTransition,
  canReviewerWriteGateReview,
} from '../src/lib/ai-competency-gate-config'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('employee edit permissions follow the approved gate states', () => {
  assert.equal(canEmployeeEditGateCase('NOT_ASSIGNED'), false)
  assert.equal(canEmployeeEditGateCase('NOT_STARTED'), true)
  assert.equal(canEmployeeEditGateCase('DRAFT'), true)
  assert.equal(canEmployeeEditGateCase('SUBMITTED'), false)
  assert.equal(canEmployeeEditGateCase('UNDER_REVIEW'), false)
  assert.equal(canEmployeeEditGateCase('REVISION_REQUESTED'), true)
  assert.equal(canEmployeeEditGateCase('RESUBMITTED'), false)
  assert.equal(canEmployeeEditGateCase('PASSED'), false)
  assert.equal(canEmployeeEditGateCase('FAILED'), false)
  assert.equal(canEmployeeEditGateCase('CLOSED'), false)
})

run('review writing permissions are limited to submitted and active review states', () => {
  assert.equal(canReviewerWriteGateReview('NOT_STARTED'), false)
  assert.equal(canReviewerWriteGateReview('DRAFT'), false)
  assert.equal(canReviewerWriteGateReview('SUBMITTED'), true)
  assert.equal(canReviewerWriteGateReview('UNDER_REVIEW'), true)
  assert.equal(canReviewerWriteGateReview('REVISION_REQUESTED'), false)
  assert.equal(canReviewerWriteGateReview('RESUBMITTED'), true)
  assert.equal(canReviewerWriteGateReview('PASSED'), false)
  assert.equal(canReviewerWriteGateReview('FAILED'), false)
  assert.equal(canReviewerWriteGateReview('CLOSED'), false)
})

run('status transitions follow the approved server-side state machine', () => {
  assert.equal(canGateStatusTransition('NOT_STARTED', 'DRAFT'), true)
  assert.equal(canGateStatusTransition('DRAFT', 'SUBMITTED'), true)
  assert.equal(canGateStatusTransition('SUBMITTED', 'UNDER_REVIEW'), true)
  assert.equal(canGateStatusTransition('UNDER_REVIEW', 'REVISION_REQUESTED'), true)
  assert.equal(canGateStatusTransition('REVISION_REQUESTED', 'RESUBMITTED'), true)
  assert.equal(canGateStatusTransition('RESUBMITTED', 'UNDER_REVIEW'), true)
  assert.equal(canGateStatusTransition('UNDER_REVIEW', 'PASSED'), true)
  assert.equal(canGateStatusTransition('UNDER_REVIEW', 'FAILED'), true)
  assert.equal(canGateStatusTransition('DRAFT', 'PASSED'), false)
  assert.equal(canGateStatusTransition('SUBMITTED', 'PASSED'), false)
  assert.equal(canGateStatusTransition('REVISION_REQUESTED', 'PASSED'), false)
  assert.equal(canGateStatusTransition('PASSED', 'UNDER_REVIEW'), false)
  assert.equal(canGateStatusTransition('FAILED', 'RESUBMITTED'), false)
})

console.log('AI competency gate status-machine tests completed')
