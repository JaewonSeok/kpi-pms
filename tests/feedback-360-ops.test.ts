import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  getFeedbackResultRecipientRole,
  getEligibleReminderRecipientIds,
  resolveFeedbackResultPrimaryLeaderId,
  resolveFeedbackResultRecipientIds,
  resolveFeedbackFolderId,
} from '../src/server/feedback-360-admin'
import { FeedbackRoundReminderSchema, FeedbackRoundSettingsSchema } from '../src/lib/validations'
import {
  buildReviewEmailContent,
  plainTextToReviewEmailHtml,
  reviewEmailHtmlToText,
  sanitizeReviewEmailHtml,
} from '../src/lib/review-email-editor'

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
    const resultShare = FeedbackRoundReminderSchema.safeParse({
      action: 'send-result-share',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: '결과 공유',
      body: '<p>결과를 확인해 주세요.</p>',
      shareAudience: 'LEADER_AND_REVIEWEE',
    })
    const missingTestEmail = FeedbackRoundReminderSchema.safeParse({
      action: 'test-send',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: '테스트',
      body: '본문',
    })
    const emptyRichText = FeedbackRoundReminderSchema.safeParse({
      action: 'send-review-reminder',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: '리마인드',
      body: '<p><br></p>',
    })

    assert.equal(send.success, true)
    assert.equal(resultShare.success, true)
    assert.equal(missingTestEmail.success, false)
    assert.equal(emptyRichText.success, false)
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

  await run('feedback result share helpers resolve leader and reviewee recipients consistently', () => {
    const target = {
      id: 'target-1',
      teamLeaderId: 'leader-1',
      sectionChiefId: 'section-1',
      divisionHeadId: 'division-1',
    }

    assert.equal(resolveFeedbackResultPrimaryLeaderId(target), 'leader-1')
    assert.equal(getFeedbackResultRecipientRole({ actorId: 'target-1', target }), 'REVIEWEE')
    assert.equal(getFeedbackResultRecipientRole({ actorId: 'leader-1', target }), 'LEADER')
    assert.equal(getFeedbackResultRecipientRole({ actorId: 'section-1', target }), null)
    assert.deepEqual(resolveFeedbackResultRecipientIds({ audience: 'REVIEWEE', target }), ['target-1'])
    assert.deepEqual(resolveFeedbackResultRecipientIds({ audience: 'LEADER', target }), ['leader-1'])
    assert.deepEqual(resolveFeedbackResultRecipientIds({ audience: 'LEADER_AND_REVIEWEE', target }), [
      'target-1',
      'leader-1',
    ])
  })

  await run('feedback 360 admin panel exposes folder strip, editable reminder modal, and live settings entry points', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const editorSource = read('src/components/evaluation/feedback360/RichTextEmailEditor.tsx')

    assert.equal(adminPanel.includes('/api/feedback/folders'), true)
    assert.equal(adminPanel.includes('/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/settings'), true)
    assert.equal(adminPanel.includes('/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/notifications'), true)
    assert.equal(adminPanel.includes('function selectAllMatchingTargets()'), true)
    assert.equal(adminPanel.includes('setSelectedTargetIds(visibleReminderRecipientIds)'), true)
    assert.equal(adminPanel.includes('reminderStatusFilter'), true)
    assert.equal(adminPanel.includes('visibleReminderRecipientIds.length'), true)
    assert.equal(adminPanel.includes('현재 선택'), true)
    assert.equal(adminPanel.includes('상태 전체'), true)
    assert.equal(adminPanel.includes('RichTextEmailEditor'), true)
    assert.equal(adminPanel.includes('send-peer-selection-reminder'), true)
    assert.equal(adminPanel.includes('send-result-share'), true)
    assert.equal(adminPanel.includes('excludeDirectReportsFromPeerSelection'), true)
    assert.equal(adminPanel.includes('visibilitySettings'), true)
    assert.equal(adminPanel.includes("body: JSON.stringify({ id: folderId })"), true)
    assert.equal(editorSource.includes("document.execCommand('bold')"), false)
    assert.equal(editorSource.includes("runCommand('bold')"), true)
    assert.equal(editorSource.includes('글자 크기'), true)
    assert.equal(editorSource.includes('글자 색상'), true)
    assert.equal(editorSource.includes('들여쓰기'), true)
    assert.equal(editorSource.includes('내어쓰기'), true)
    assert.equal(editorSource.includes('링크 삽입'), true)
  })

  await run('feedback 360 admin panel exposes onboarding workflow setup and generated review list controls', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const serviceSource = read('src/server/onboarding-review-workflow.ts')

    assert.equal(adminPanel.includes('/api/feedback/onboarding-workflows'), true)
    assert.equal(adminPanel.includes('/api/feedback/onboarding-workflows/run'), true)
    assert.equal(adminPanel.includes('selectedWorkflowId'), true)
    assert.equal(adminPanel.includes('generatedReviewSearch'), true)
    assert.equal(adminPanel.includes('generatedReviewStatusFilter'), true)
    assert.equal(adminPanel.includes('buildOnboardingReviewNamePreview'), true)
    assert.equal(serviceSource.includes('runScheduledOnboardingReviewGeneration'), true)
    assert.equal(serviceSource.includes('OnboardingReviewGeneration'), true)
  })

  await run('feedback 360 routes align delete and reminder actions with server-side review ownership checks', () => {
    const foldersRoute = read('src/app/api/feedback/folders/route.ts')
    const notificationsRoute = read('src/app/api/feedback/rounds/[id]/notifications/route.ts')
    const resultViewRoute = read('src/app/api/feedback/rounds/[id]/result-view/route.ts')

    assert.equal(foldersRoute.includes('resolveFeedbackFolderId'), true)
    assert.equal(foldersRoute.includes('existing.orgId !== employee.department.orgId'), true)
    assert.equal(notificationsRoute.includes('getEligibleReminderRecipientIds'), true)
    assert.equal(notificationsRoute.includes('INVALID_REMINDER_TARGET'), true)
    assert.equal(notificationsRoute.includes('round.evalCycle.orgId !== employee.department.orgId'), true)
    assert.equal(notificationsRoute.includes('buildReviewEmailContent'), true)
    assert.equal(notificationsRoute.includes('shareAudience'), true)
    assert.equal(notificationsRoute.includes('FEEDBACK_RESULT_SHARED'), true)
    assert.equal(resultViewRoute.includes('FEEDBACK_RESULT_VIEWED'), true)
    assert.equal(resultViewRoute.includes('getFeedbackResultRecipientRole'), true)
  })

  await run('feedback 360 admin and workspace surfaces expose share audience, read receipts, and result-view tracking', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const loaderSource = read('src/server/feedback-360.ts')

    assert.equal(adminPanel.includes('shareAudience'), true)
    assert.equal(adminPanel.includes('resultShare.rows'), true)
    assert.equal(adminPanel.includes('열람 완료'), true)
    assert.equal(adminPanel.includes('결과 보기'), true)
    assert.equal(workspace.includes('/api/feedback/rounds/${encodeURIComponent(props.data.selectedRoundId!)}/result-view'), true)
    assert.equal(workspace.includes('recordedResultViewKey'), true)
    assert.equal(loaderSource.includes('FEEDBACK_RESULT_SHARED'), true)
    assert.equal(loaderSource.includes('FEEDBACK_RESULT_VIEWED'), true)
    assert.equal(loaderSource.includes('resultShare:'), true)
  })

  await run('feedback 360 nomination workflow enforces evaluator and direct-report exclusion in both loader and server validation', () => {
    const loaderSource = read('src/server/feedback-360.ts')
    const workflowSource = read('src/server/feedback-360-workflow.ts')
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')

    assert.equal(loaderSource.includes('excludeDirectReportsFromPeerSelection'), true)
    assert.equal(loaderSource.includes('directReportIds.has(reviewer.id)'), true)
    assert.equal(loaderSource.includes('본인, 본인의 평가권자, 상위 평가권자는 동료 후보에서 자동 제외됩니다.'), true)
    assert.equal(workflowSource.includes('selectionSettings.excludeDirectReportsFromPeerSelection'), true)
    assert.equal(workflowSource.includes('EVALUATOR_PEER_EXCLUDED'), true)
    assert.equal(nominationPanel.includes('selectionSettings.excludeDirectReportsFromPeerSelection'), true)
    assert.equal(nominationPanel.includes('group.helpMessage'), true)
  })

  await run('feedback reference panel groups repeated questions under one question card and keeps warnings separate', () => {
    const panelSource = read('src/components/evaluation/feedback360/FeedbackReferencePanel.tsx')

    assert.equal(panelSource.includes('groupedResponses: GroupedResponse[]'), true)
    assert.equal(panelSource.includes('key={group.questionId}'), true)
    assert.equal(panelSource.includes('group.answers.map'), true)
    assert.equal(panelSource.includes('props.warnings'), true)
  })

  await run('review email editor utilities preserve safe formatting and strip unsafe markup', () => {
    const html = plainTextToReviewEmailHtml('안녕하세요.\n리뷰를 부탁드립니다.\n\n감사합니다.')
    const content = buildReviewEmailContent(
      `${html}<ul><li><strong>강점</strong>을 한 줄로 정리해 주세요.</li></ul><p><a href="https://example.com">가이드</a></p><script>alert(1)</script>`
    )
    const sanitized = sanitizeReviewEmailHtml('<p onclick="bad()">본문</p><a href="javascript:alert(1)">위험</a>')
    const roundTrip = reviewEmailHtmlToText(content.html)

    assert.equal(content.html.includes('<script'), false)
    assert.equal(content.html.includes('<strong>강점</strong>'), true)
    assert.equal(content.html.includes('href="https://example.com"'), true)
    assert.equal(sanitized.includes('onclick'), false)
    assert.equal(sanitized.includes('javascript:'), false)
    assert.equal(roundTrip.includes('강점'), true)
    assert.equal(roundTrip.includes('가이드 (https://example.com)'), true)
    assert.equal(roundTrip.includes('•'), true)
  })

  console.log('Feedback 360 ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
