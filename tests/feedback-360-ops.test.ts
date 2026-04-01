import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  getEligibleReminderRecipientIds,
  resolveFeedbackFolderId,
} from '../src/server/feedback-360-admin'
import { FeedbackRoundReminderSchema, FeedbackRoundSettingsSchema } from '../src/lib/validations'

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
  await run('feedback 360 reminder schema accepts editable send and requires test email for test-send', () => {
    const send = FeedbackRoundReminderSchema.safeParse({
      action: 'send-peer-selection-reminder',
      roundId: 'round-1',
      targetIds: ['emp-1', 'emp-2'],
      subject: '동료 선택 리마인드',
      body: '이번 주 안에 리뷰 작성자를 선택해 주세요.',
    })
    const missingTestEmail = FeedbackRoundReminderSchema.safeParse({
      action: 'test-send',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: '테스트',
      body: '본문',
    })

    assert.equal(send.success, true)
    assert.equal(missingTestEmail.success, false)
  })

  await run('feedback 360 settings schema supports team-member exclusion and reviewer-type visibility groups', () => {
    const parsed = FeedbackRoundSettingsSchema.safeParse({
      roundId: 'round-1',
      selectionSettings: {
        requireLeaderApproval: true,
        allowPreferredPeers: true,
        excludeLeaderFromPeerSelection: true,
        excludeDirectReportsFromPeerSelection: true,
      },
      visibilitySettings: {
        SELF: 'FULL',
        SUPERVISOR: 'FULL',
        PEER: 'ANONYMOUS',
        SUBORDINATE: 'PRIVATE',
        CROSS_TEAM_PEER: 'ANONYMOUS',
        CROSS_DEPT: 'PRIVATE',
      },
    })

    assert.equal(parsed.success, true)
  })

  await run('feedback admin helpers resolve folder ids and bulk reminder recipients from live review state', () => {
    assert.equal(resolveFeedbackFolderId({ searchParamId: 'folder-query' }), 'folder-query')
    assert.equal(resolveFeedbackFolderId({ body: { id: 'folder-body' } }), 'folder-body')
    assert.equal(resolveFeedbackFolderId({ searchParamId: ' ', body: { id: '' } }), '')

    const reviewTargets = getEligibleReminderRecipientIds('send-review-reminder', {
      feedbacks: [
        { giverId: 'reviewer-1', receiverId: 'target-1', status: 'PENDING' },
        { giverId: 'reviewer-1', receiverId: 'target-2', status: 'PENDING' },
        { giverId: 'reviewer-2', receiverId: 'target-1', status: 'SUBMITTED' },
      ],
      nominations: [],
    })
    const peerSelectionTargets = getEligibleReminderRecipientIds('send-peer-selection-reminder', {
      feedbacks: [],
      nominations: [
        { targetId: 'target-1', status: 'DRAFT' },
        { targetId: 'target-1', status: 'SUBMITTED' },
        { targetId: 'target-2', status: 'PUBLISHED' },
      ],
    })
    const resultShareTargets = getEligibleReminderRecipientIds('send-result-share', {
      feedbacks: [
        { giverId: 'reviewer-1', receiverId: 'target-1', status: 'SUBMITTED' },
        { giverId: 'reviewer-2', receiverId: 'target-1', status: 'SUBMITTED' },
        { giverId: 'reviewer-3', receiverId: 'target-2', status: 'PENDING' },
      ],
      nominations: [],
    })

    assert.deepEqual(reviewTargets, ['reviewer-1'])
    assert.deepEqual(peerSelectionTargets, ['target-1'])
    assert.deepEqual(resultShareTargets, ['target-1'])
  })

  await run('feedback 360 admin panel exposes folder strip, editable reminder modal, and live settings entry points', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')

    assert.equal(adminPanel.includes('/api/feedback/folders'), true)
    assert.equal(adminPanel.includes('/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/settings'), true)
    assert.equal(adminPanel.includes('/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/notifications'), true)
    assert.equal(adminPanel.includes('function selectAllMatchingTargets()'), true)
    assert.equal(adminPanel.includes('setSelectedTargetIds(allIds)'), true)
    assert.equal(adminPanel.includes('send-peer-selection-reminder'), true)
    assert.equal(adminPanel.includes('send-result-share'), true)
    assert.equal(adminPanel.includes('excludeDirectReportsFromPeerSelection'), true)
    assert.equal(adminPanel.includes('visibilitySettings'), true)
    assert.equal(adminPanel.includes("body: JSON.stringify({ id: folderId })"), true)
  })

  await run('feedback 360 routes align delete and reminder actions with server-side review ownership checks', () => {
    const foldersRoute = read('src/app/api/feedback/folders/route.ts')
    const notificationsRoute = read('src/app/api/feedback/rounds/[id]/notifications/route.ts')

    assert.equal(foldersRoute.includes('resolveFeedbackFolderId'), true)
    assert.equal(foldersRoute.includes('existing.orgId !== employee.department.orgId'), true)
    assert.equal(notificationsRoute.includes('getEligibleReminderRecipientIds'), true)
    assert.equal(notificationsRoute.includes('INVALID_REMINDER_TARGET'), true)
    assert.equal(notificationsRoute.includes('round.evalCycle.orgId !== employee.department.orgId'), true)
  })

  await run('feedback 360 nomination workflow enforces direct-report exclusion in both loader and server validation', () => {
    const loaderSource = read('src/server/feedback-360.ts')
    const workflowSource = read('src/server/feedback-360-workflow.ts')
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')

    assert.equal(loaderSource.includes('excludeDirectReportsFromPeerSelection'), true)
    assert.equal(loaderSource.includes('directReportIds.has(reviewer.id)'), true)
    assert.equal(workflowSource.includes('selectionSettings.excludeDirectReportsFromPeerSelection'), true)
    assert.equal(nominationPanel.includes('selectionSettings.excludeDirectReportsFromPeerSelection'), true)
  })

  await run('feedback reference panel groups repeated questions under one question card and keeps warnings separate', () => {
    const panelSource = read('src/components/evaluation/feedback360/FeedbackReferencePanel.tsx')

    assert.equal(panelSource.includes('groupedResponses: GroupedResponse[]'), true)
    assert.equal(panelSource.includes('key={group.questionId}'), true)
    assert.equal(panelSource.includes('group.answers.map'), true)
    assert.equal(panelSource.includes('props.warnings'), true)
  })

  console.log('Feedback 360 ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
