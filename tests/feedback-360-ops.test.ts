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
import { calculateFeedbackResponseTotalScore } from '../src/lib/feedback-score'
import {
  DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS,
  parseFeedbackResultPresentationSettings,
  resolveFeedbackResultPresentationProfile,
} from '../src/lib/feedback-result-presentation'
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
      subject: 'Peer selection reminder',
      body: '<p>Please complete your peer selection this week.</p>',
    })
    const resultShare = FeedbackRoundReminderSchema.safeParse({
      action: 'send-result-share',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: 'Result shared',
      body: '<p>Your review result is ready.</p>',
      shareAudience: 'LEADER_AND_REVIEWEE',
    })
    const missingTestEmail = FeedbackRoundReminderSchema.safeParse({
      action: 'test-send',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: 'Test send',
      body: '<p>Hello</p>',
    })
    const emptyRichText = FeedbackRoundReminderSchema.safeParse({
      action: 'send-review-reminder',
      roundId: 'round-1',
      targetIds: ['emp-1'],
      subject: 'Reminder',
      body: '<p><br></p>',
    })

    assert.equal(send.success, true)
    assert.equal(resultShare.success, true)
    assert.equal(missingTestEmail.success, false)
    assert.equal(emptyRichText.success, false)
  })

  await run('feedback 360 settings schema supports selection visibility and report analysis settings', () => {
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
      reportAnalysisSettings: {
        overview: {
          companyMessage: 'Company message for the report',
          purposeMessage: 'Purpose guidance for using the report',
          acceptanceGuide: 'Acceptance guide for reading the report',
        },
        menu: {
          overview: { label: 'Overview', visible: true },
          questionInsights: { label: 'Question Insights', visible: true },
          relativeComparison: { label: 'Relative Comparison', visible: true },
          selfAwareness: { label: 'Self Awareness', visible: true },
          reviewDetails: { label: 'Review Details', visible: true },
          questionScores: { label: 'Question Scores', visible: true },
          objectiveAnswers: { label: 'Objective Answers', visible: true },
          resultLink: { label: 'Result Link', visible: true },
        },
        wording: {
          strengthLabel: 'Strength',
          improvementLabel: 'Improvement',
          selfAwarenessLabel: 'Self Awareness',
          selfHighLabel: 'Self Higher',
          selfLowLabel: 'Self Lower',
          balancedLabel: 'Balanced',
        },
        strength: 'DEFAULT',
      },
      ratingGuideSettings: {
        distributionQuestionId: 'question-1',
        distributionMode: 'HEADCOUNT',
        distributionScope: 'EVALUATOR',
        scaleEntries: [
          {
            value: 5,
            label: 'S',
            description: '理쒖긽???깃툒',
            targetRatio: 10,
            headcountLimit: 1,
            isNonEvaluative: false,
          },
          {
            value: 4,
            label: 'A',
            description: '?곸쐞 ?깃툒',
            targetRatio: 30,
            headcountLimit: 2,
            isNonEvaluative: false,
          },
        ],
        guideRules: [
          {
            id: 'rule-1',
            label: '팀장 대상',
            headline: '팀장 대상 등급 가이드',
            guidance: '대상자 기준으로 육성과 성과 균형을 함께 확인합니다.',
            filters: {
              departmentKeyword: '팀',
              position: 'TEAM_LEADER',
            },
            gradeDescriptions: {
              '5': '理쒖긽??湲곗?',
            },
          },
        ],
      },
    })

    assert.equal(parsed.success, true)
  })

  await run('feedback result presentation defaults, overrides, and profile resolution stay consistent', () => {
    const parsedDefaults = parseFeedbackResultPresentationSettings(null)
    const parsedOverride = parseFeedbackResultPresentationSettings({
      REVIEWEE: {
        showLeaderComment: false,
        showLeaderScore: true,
      },
    })

    assert.deepEqual(parsedDefaults, DEFAULT_FEEDBACK_RESULT_PRESENTATION_SETTINGS)
    assert.equal(parsedOverride.REVIEWEE.showLeaderComment, false)
    assert.equal(parsedOverride.REVIEWEE.showLeaderScore, true)
    assert.equal(parsedOverride.LEADER.showLeaderComment, true)

    const target = {
      id: 'target-1',
      teamLeaderId: 'leader-1',
      sectionChiefId: 'section-1',
      divisionHeadId: 'division-1',
    }

    assert.equal(
      resolveFeedbackResultPresentationProfile({
        actorId: 'target-1',
        actorRole: 'ROLE_MEMBER',
        target,
        requestedProfile: 'EXECUTIVE',
      }),
      'REVIEWEE'
    )
    assert.equal(
      resolveFeedbackResultPresentationProfile({
        actorId: 'leader-1',
        actorRole: 'ROLE_MEMBER',
        target,
        requestedProfile: 'REVIEWEE',
      }),
      'LEADER'
    )
    assert.equal(
      resolveFeedbackResultPresentationProfile({
        actorId: 'admin-1',
        actorRole: 'ROLE_ADMIN',
        target,
        requestedProfile: 'EXECUTIVE',
      }),
      'EXECUTIVE'
    )
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
    assert.equal(adminPanel.includes('RichTextEmailEditor'), true)
    assert.equal(adminPanel.includes('send-peer-selection-reminder'), true)
    assert.equal(adminPanel.includes('send-result-share'), true)
    assert.equal(adminPanel.includes('excludeDirectReportsFromPeerSelection'), true)
    assert.equal(adminPanel.includes('visibilitySettings'), true)
    assert.equal(adminPanel.includes("body: JSON.stringify({ id: folderId })"), true)

    assert.equal(editorSource.includes("runCommand('bold')"), true)
    assert.equal(editorSource.includes("runCommand('insertUnorderedList')"), true)
    assert.equal(editorSource.includes("runCommand('undo')"), true)
    assert.equal(editorSource.includes("runCommand('redo')"), true)
    assert.equal(editorSource.includes('adjustIndent(24)'), true)
    assert.equal(editorSource.includes('adjustIndent(-24)'), true)
    assert.equal(editorSource.includes('type="color"'), true)
    assert.equal(editorSource.includes("tagName === 'a'"), true)
  })

  await run('feedback 360 admin panel exposes onboarding workflow setup and generated review list controls', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const serviceSource = read('src/server/onboarding-review-workflow.ts')

    assert.equal(adminPanel.includes('/api/feedback/onboarding-workflows'), true)
    assert.equal(adminPanel.includes('/api/feedback/onboarding-workflows/run'), true)
    assert.equal(adminPanel.includes('selectedWorkflowId'), true)
    assert.equal(adminPanel.includes('generatedReviewSearch'), true)
    assert.equal(adminPanel.includes('generatedReviewStatusFilter'), true)
    assert.equal(adminPanel.includes('generatedReviewSort'), true)
    assert.equal(adminPanel.includes('buildOnboardingReviewNamePreview'), true)
    assert.equal(serviceSource.includes('runScheduledOnboardingReviewGeneration'), true)
    assert.equal(serviceSource.includes('OnboardingReviewGeneration'), true)
  })

  await run('feedback 360 source wires anytime review document creation, bulk actions, and admin rendering', () => {
    const validationSource = read('src/lib/validations.ts')
    const roundsRoute = read('src/app/api/feedback/rounds/route.ts')
    const submitRoute = read('src/app/api/feedback/route.ts')
    const loaderSource = read('src/server/feedback-360.ts')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')

    assert.equal(validationSource.includes('CreateFeedbackAnytimeReviewSchema'), true)
    assert.equal(validationSource.includes('FeedbackAnytimeBulkActionSchema'), true)
    assert.equal(roundsRoute.includes("roundType: 'ANYTIME'"), true)
    assert.equal(roundsRoute.includes('documentKind'), true)
    assert.equal(roundsRoute.includes('FEEDBACK_ANYTIME_REVIEW_CREATED'), true)
    assert.equal(roundsRoute.includes('transfer-reviewer'), true)
    assert.equal(roundsRoute.includes('change-due-date'), true)
    assert.equal(roundsRoute.includes('FEEDBACK_ANYTIME_REVIEWER_TRANSFERRED'), true)
    assert.equal(roundsRoute.includes('FEEDBACK_ANYTIME_DUE_DATE_CHANGED'), true)
    assert.equal(roundsRoute.includes('FEEDBACK_ANYTIME_REVIEW_CANCELLED'), true)
    assert.equal(roundsRoute.includes('FEEDBACK_ANYTIME_REVIEW_CLOSED'), true)
    assert.equal(roundsRoute.includes('FEEDBACK_ANYTIME_REVIEW_REOPENED'), true)
    assert.equal(submitRoute.includes("if (round.roundType === 'ANYTIME')"), true)
    assert.equal(loaderSource.includes('anytimeReview:'), true)
    assert.equal(loaderSource.includes('documentKindLabel'), true)
    assert.equal(loaderSource.includes('parseFeedbackAnytimeDocumentSettings'), true)
    assert.equal(adminPanel.includes('수시 리뷰 문서'), true)
    assert.equal(adminPanel.includes('프로젝트 리뷰'), true)
    assert.equal(adminPanel.includes('PIP 문서'), true)
    assert.equal(adminPanel.includes('리뷰어 이관'), true)
    assert.equal(adminPanel.includes('기한 변경'), true)
    assert.equal(adminPanel.includes('handleCreateAnytimeReview'), true)
    assert.equal(adminPanel.includes('handleAnytimeBulkAction'), true)
    assert.equal(adminPanel.includes("/api/feedback/rounds"), true)
  })

  await run('feedback review admin source wires collaborator-scoped permissions through schema, UI, and routes', () => {
    const schemaSource = read('prisma/schema.prisma')
    const validationSource = read('src/lib/validations.ts')
    const accessSource = read('src/server/feedback-360-access.ts')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const settingsRoute = read('src/app/api/feedback/rounds/[id]/settings/route.ts')
    const workflowRoute = read('src/app/api/feedback/rounds/[id]/workflow/route.ts')
    const reportRoute = read('src/app/api/feedback/rounds/[id]/report/route.ts')
    const roundsRoute = read('src/app/api/feedback/rounds/route.ts')
    const adminGroupsRoute = read('src/app/api/feedback/admin-groups/route.ts')
    const loaderSource = read('src/server/feedback-360.ts')

    assert.equal(schemaSource.includes('enum FeedbackAdminReviewScope'), true)
    assert.equal(schemaSource.includes('model FeedbackAdminGroup'), true)
    assert.equal(schemaSource.includes('model FeedbackRoundCollaborator'), true)
    assert.equal(validationSource.includes('FeedbackAdminGroupSchema'), true)
    assert.equal(validationSource.includes('collaboratorIds'), true)
    assert.equal(accessSource.includes('COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT'), true)
    assert.equal(accessSource.includes('canReadCollaboratorContent'), true)
    assert.equal(adminPanel.includes('/api/feedback/admin-groups'), true)
    assert.equal(adminPanel.includes('groupDialogOpen'), true)
    assert.equal(adminPanel.includes('collaboratorIds'), true)
    assert.equal(adminPanel.includes('filteredCollaboratorCandidates'), true)
    assert.equal(adminPanel.includes('selectedCollaborators'), true)
    assert.equal(adminPanel.includes('selectedGroupMembers'), true)
    assert.equal(adminPanel.includes('REVIEW_ADMIN_SCOPE_OPTIONS'), true)
    assert.equal(adminPanel.includes("value: 'ALL_REVIEWS_MANAGE'"), true)
    assert.equal(adminPanel.includes("value: 'ALL_REVIEWS_MANAGE_AND_CONTENT'"), true)
    assert.equal(adminPanel.includes("value: 'COLLABORATOR_REVIEWS_MANAGE'"), true)
    assert.equal(adminPanel.includes("value: 'COLLABORATOR_REVIEWS_MANAGE_AND_CONTENT'"), true)
    assert.equal(settingsRoute.includes('feedbackRoundCollaborator'), true)
    assert.equal(settingsRoute.includes('canManageFeedbackRoundByAccess'), true)
    assert.equal(settingsRoute.includes('collaboratorIds'), true)
    assert.equal(settingsRoute.includes('deleteMany'), true)
    assert.equal(settingsRoute.includes('createMany'), true)
    assert.equal(workflowRoute.includes('getFeedbackReviewAdminAccess'), true)
    assert.equal(workflowRoute.includes('canManageFeedbackRoundByAccess'), true)
    assert.equal(reportRoute.includes('canReadFeedbackRoundContentByAccess'), true)
    assert.equal(roundsRoute.includes('getCollaboratorRoundIds'), true)
    assert.equal(adminGroupsRoute.includes('FEEDBACK_ADMIN_GROUP_CREATED'), true)
    assert.equal(adminGroupsRoute.includes('FEEDBACK_ADMIN_GROUP_UPDATED'), true)
    assert.equal(adminGroupsRoute.includes('FEEDBACK_ADMIN_GROUP_DELETED'), true)
    assert.equal(loaderSource.includes('buildReviewAdminState'), true)
    assert.equal(loaderSource.includes('collaborators:'), true)
    assert.equal(loaderSource.includes('canReadCollaboratorContent'), true)
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
    assert.equal(adminPanel.includes('leaderStatus'), true)
    assert.equal(adminPanel.includes('revieweeStatus'), true)
    assert.equal(
      workspace.includes('/api/feedback/rounds/${encodeURIComponent(props.data.selectedRoundId!)}/result-view'),
      true
    )
    assert.equal(workspace.includes('recordedResultViewKey'), true)
    assert.equal(loaderSource.includes('FEEDBACK_RESULT_SHARED'), true)
    assert.equal(loaderSource.includes('FEEDBACK_RESULT_VIEWED'), true)
    assert.equal(loaderSource.includes('resultShare:'), true)
  })

  await run('feedback result presentation settings are saved and rendered through admin and result workspace flows', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const settingsRoute = read('src/app/api/feedback/rounds/[id]/settings/route.ts')
    const exportRoute = read('src/app/api/feedback/rounds/[id]/results-export/route.ts')

    assert.equal(adminPanel.includes('selectedResultVersionProfile'), true)
    assert.equal(adminPanel.includes('resultPresentationSettings'), true)
    assert.equal(adminPanel.includes('selectedResultShareTargetIds'), true)
    assert.equal(workspace.includes('buildResultVersionHref'), true)
    assert.equal(workspace.includes('pdfHref'), true)
    assert.equal(workspace.includes('FEEDBACK_RESULT_PROFILE_LABELS'), true)
    assert.equal(settingsRoute.includes('resultPresentationSettings'), true)
    assert.equal(exportRoute.includes('buildFeedback360ResultPdf'), true)
    assert.equal(exportRoute.includes("searchParams.get('download') === '1'"), true)
  })

  await run('feedback report analysis settings and personalized report view are wired through admin and results flows', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const reportView = read('src/components/evaluation/feedback360/FeedbackReportAnalysisView.tsx')
    const loaderSource = read('src/server/feedback-360.ts')
    const settingsRoute = read('src/app/api/feedback/rounds/[id]/settings/route.ts')

    assert.equal(adminPanel.includes('reportAnalysisSettings'), true)
    assert.equal(adminPanel.includes('FEEDBACK_REPORT_ANALYSIS_SECTIONS'), true)
    assert.equal(adminPanel.includes('FEEDBACK_ANALYSIS_STRENGTH_LABELS'), true)
    assert.equal(adminPanel.includes('媛쒖씤蹂?由ы룷??/ 遺꾩꽍 ?ㅼ젙'), true)
    assert.equal(workspace.includes('FeedbackReportAnalysisView'), true)
    assert.equal(reportView.includes('selectedInsight'), true)
    assert.equal(reportView.includes('questionInsights'), true)
    assert.equal(reportView.includes('objectiveAnswers'), true)
    assert.equal(reportView.includes('BarChart'), true)
    assert.equal(loaderSource.includes('buildFeedbackReportAnalysis'), true)
    assert.equal(loaderSource.includes('reportAnalysisSettings'), true)
    assert.equal(loaderSource.includes("employee.role === 'ROLE_ADMIN'"), true)
    assert.equal(settingsRoute.includes('parseFeedbackReportAnalysisSettings'), true)
  })

  await run('feedback 360 nomination workflow enforces evaluator and direct-report exclusion in both loader and server validation', () => {
    const loaderSource = read('src/server/feedback-360.ts')
    const workflowSource = read('src/server/feedback-360-workflow.ts')
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')

    assert.equal(loaderSource.includes('excludeDirectReportsFromPeerSelection'), true)
    assert.equal(loaderSource.includes('directReportIds.has(reviewer.id)'), true)
    assert.equal(loaderSource.includes('supervisorIds.includes(reviewer.id)'), true)
    assert.equal(workflowSource.includes('EVALUATOR_PEER_EXCLUDED'), true)
    assert.equal(workflowSource.includes('selectionSettings.excludeDirectReportsFromPeerSelection'), true)
    assert.equal(nominationPanel.includes('selectionSettings.excludeDirectReportsFromPeerSelection'), true)
    assert.equal(nominationPanel.includes('group.helpMessage'), true)
  })

  await run('feedback nomination UI surfaces disabled reviewer reasons and blocks non-selectable candidates', () => {
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')

    assert.equal(nominationPanel.includes('reviewer.disabledReason'), true)
    assert.equal(nominationPanel.includes('disabled={!selectable}'), true)
    assert.equal(nominationPanel.includes('toggleReviewer(reviewer.employeeId, selectable)'), true)
    assert.equal(nominationPanel.includes('cursor-not-allowed'), true)
  })

  await run('feedback reference panel groups repeated questions under one question card and keeps warnings separate', () => {
    const panelSource = read('src/components/evaluation/feedback360/FeedbackReferencePanel.tsx')

    assert.equal(panelSource.includes('groupedResponses: GroupedResponse[]'), true)
    assert.equal(panelSource.includes('key={group.questionId}'), true)
    assert.equal(panelSource.includes('group.answers.map'), true)
    assert.equal(panelSource.includes('props.warnings'), true)
  })

  await run('feedback respond workspace exposes goal context, prior total scores, and stale reset hooks', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const respondPanel = read('src/components/evaluation/feedback360/FeedbackRespondReferencePanel.tsx')
    const loaderSource = read('src/server/feedback-360.ts')

    assert.equal(workspace.includes("import { FeedbackRespondReferencePanel } from './FeedbackRespondReferencePanel'"), true)
    assert.equal(workspace.includes('RespondReferenceSummary'), true)
    assert.equal(workspace.includes('RespondRatingGuideCard'), true)
    assert.equal(workspace.includes('distributionLimitExceeded'), true)
    assert.equal(workspace.includes('DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE'), true)
    assert.equal(workspace.includes('if (distributionLimitExceeded)'), true)
    assert.equal(workspace.includes('disabled={submitBusy || distributionLimitExceeded}'), true)
    assert.equal(
      workspace.includes("if (!distributionLimitExceeded && respondError === DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE)"),
      true
    )
    assert.equal(workspace.includes('setRespondError(DISTRIBUTION_LIMIT_EXCEEDED_MESSAGE)'), true)
    assert.equal(workspace.includes('respondData.reference'), true)
    assert.equal(workspace.includes('[respondFeedbackId, respondOverallComment, respondQuestions]'), true)
    assert.equal(workspace.includes("key={`${respondData.feedbackId}:${props.data.selectedRoundId ?? ''}`}"), true)
    assert.equal(respondPanel.includes("type ReferenceTab = 'goals' | 'reviews' | 'scores'"), true)
    assert.equal(respondPanel.includes('props.reference.priorScores.length'), true)
    assert.equal(respondPanel.includes('target="_blank"'), true)
    assert.equal(loaderSource.includes('employeeId: feedback.receiverId'), true)
    assert.equal(loaderSource.includes('calculateFeedbackResponseTotalScore'), true)
    assert.equal(loaderSource.includes('reference: {'), true)
  })

  await run('feedback rating guide settings and submit route enforce headcount quota in Korean', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const submitRoute = read('src/app/api/feedback/route.ts')
    const loaderSource = read('src/server/feedback-360.ts')

    assert.equal(adminPanel.includes('distributionQuestionId'), true)
    assert.equal(adminPanel.includes('distributionMode'), true)
    assert.equal(adminPanel.includes('distributionScope'), true)
    assert.equal(adminPanel.includes('headcountLimit'), true)
    assert.equal(adminPanel.includes('isNonEvaluative'), true)
    assert.equal(adminPanel.includes('annotateFeedbackRatingScaleEntries'), true)

    assert.equal(submitRoute.includes('parseFeedbackRatingGuideSettings'), true)
    assert.equal(submitRoute.includes('RATING_GUIDE_HEADCOUNT_EXCEEDED'), true)
    assert.equal(submitRoute.includes('submittedDistributionCount + 1 > selectedScaleEntry.headcountLimit'), true)

    assert.equal(loaderSource.includes('priorScoreSummary'), true)
    assert.equal(loaderSource.includes('ratingGuide: {'), true)
    assert.equal(loaderSource.includes('targetProfileLabel'), true)
  })

  await run('manager effectiveness settings are wired through admin, loader, workflow, and nomination routes', () => {
    const schemaSource = read('src/lib/validations.ts')
    const helperSource = read('src/lib/feedback-manager-effectiveness.ts')
    const loaderSource = read('src/server/feedback-360.ts')
    const workflowSource = read('src/server/feedback-360-workflow.ts')
    const nominationRoute = read('src/app/api/feedback/rounds/[id]/nominations/route.ts')
    const publishRoute = read('src/app/api/feedback/rounds/[id]/workflow/route.ts')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')

    assert.equal(schemaSource.includes('FeedbackManagerEffectivenessSettingsSchema'), true)
    assert.equal(helperSource.includes('DEFAULT_FEEDBACK_MANAGER_EFFECTIVENESS_SETTINGS'), true)
    assert.equal(helperSource.includes('buildManagerEffectivenessCoachingPack'), true)
    assert.equal(loaderSource.includes('buildManagerEffectivenessLeaderSummaries'), true)
    assert.equal(loaderSource.includes('managerEffectiveness: managerEffectivenessResult'), true)
    assert.equal(loaderSource.includes('managerEffectiveness: managerEffectivenessAdmin'), true)
    assert.equal(loaderSource.includes('topImprovementThemes'), true)
    assert.equal(workflowSource.includes('MANAGER_EFFECTIVENESS_RELATIONSHIP_DISABLED'), true)
    assert.equal(nominationRoute.includes('MANAGER_TARGET_REQUIRED'), true)
    assert.equal(publishRoute.includes('MANAGER_TARGET_REQUIRED'), true)
    assert.equal(adminPanel.includes('selectionSettings.managerEffectiveness.enabled'), true)
    assert.equal(adminPanel.includes('managerEffectivenessAdmin?.enabled'), true)
    assert.equal(adminPanel.includes('getManagerEffectivenessReviewerSummary'), true)
    assert.equal(workspace.includes('props.data.results.managerEffectiveness?.enabled'), true)
    assert.equal(workspace.includes('coachingPack.nextOneOnOneQuestions'), true)
  })

  await run('manager effectiveness dashboard exposes heatmap, leader coaching packs, and result links', () => {
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')

    assert.equal(adminPanel.includes('managerEffectivenessAdmin.heatmap'), true)
    assert.equal(adminPanel.includes('managerEffectivenessAdmin.topImprovementThemes'), true)
    assert.equal(adminPanel.includes('leader.coachingPack.hrMemo'), true)
    assert.equal(adminPanel.includes('leader.resultHref'), true)
    assert.equal(workspace.includes('managerEffectiveness.benchmarkAverage'), true)
    assert.equal(workspace.includes('managerEffectiveness.riskLevel'), true)
    assert.equal(workspace.includes('managerEffectiveness.coachingPack.growthActions'), true)
  })

  await run('skill architecture and AI copilot settings are wired through admin, loader, results, and respond flows', () => {
    const schemaSource = read('src/lib/validations.ts')
    const helperSource = read('src/lib/feedback-skill-architecture.ts')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const loaderSource = read('src/server/feedback-360.ts')
    const aiRoute = read('src/app/api/feedback/360/ai/route.ts')

    assert.equal(schemaSource.includes('skillArchitecture'), true)
    assert.equal(schemaSource.includes('aiCopilot'), true)
    assert.equal(helperSource.includes('resolveFeedbackRoleGuide'), true)
    assert.equal(helperSource.includes('DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS'), true)
    assert.equal(adminPanel.includes('직무/직급 역할 아키텍처'), true)
    assert.equal(adminPanel.includes('AI 코파일럿'), true)
    assert.equal(adminPanel.includes('selectionSettings.skillArchitecture.enabled'), true)
    assert.equal(adminPanel.includes('selectionSettings.aiCopilot.enabled'), true)
    assert.equal(workspace.includes('GrowthCopilotPanel'), true)
    assert.equal(workspace.includes('RespondRoleGuideCard'), true)
    assert.equal(loaderSource.includes('roleGuide:'), true)
    assert.equal(loaderSource.includes('growthCopilot:'), true)
    assert.equal(loaderSource.includes('allowManagerView'), true)
    assert.equal(loaderSource.includes('allowSelfView'), true)
    assert.equal(aiRoute.includes('suggest-growth-copilot'), true)
  })

  await run('development plan preview supports competencies, linked evidence, progress, and PATCH saves', () => {
    const previewSource = read('src/components/evaluation/feedback360/DevelopmentPlanPreview.tsx')
    const routeSource = read('src/app/api/development-plans/route.ts')

    assert.equal(previewSource.includes('recommendedCompetencies'), true)
    assert.equal(previewSource.includes('linkedEvidence'), true)
    assert.equal(previewSource.includes('progressRate'), true)
    assert.equal(previewSource.includes("method: props.existingPlan?.id ? 'PATCH' : 'POST'"), true)
    assert.equal(routeSource.includes('export async function PATCH'), true)
    assert.equal(routeSource.includes('DEVELOPMENT_PLAN_UPDATED'), true)
  })

  await run('self review goal context is limited to the review target own goals', () => {
    const loaderSource = read('src/server/feedback-360.ts')

    assert.equal(loaderSource.includes('employeeId: feedback.receiverId'), true)
    assert.equal(loaderSource.includes('reviewerId: feedback.receiverId'), false)
  })

  await run('feedback total score helper keeps mixed template calculations consistent by ignoring non-scored items', () => {
    const totalScore = calculateFeedbackResponseTotalScore({
      responses: [
        { ratingValue: 4, question: { questionType: 'RATING_SCALE' } },
        { ratingValue: 5, question: { questionType: 'RATING_SCALE' } },
        { ratingValue: null, question: { questionType: 'TEXT_LONG' } },
      ],
    })

    assert.equal(totalScore, 90)
  })

  await run('feedback round settings support editable question text through admin settings flow', () => {
    const schemaSource = read('src/lib/validations.ts')
    const routeSource = read('src/app/api/feedback/rounds/[id]/settings/route.ts')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')

    assert.equal(schemaSource.includes('questions: z'), true)
    assert.equal(routeSource.includes('feedbackQuestion.update'), true)
    assert.equal(routeSource.includes('INVALID_QUESTION'), true)
    assert.equal(adminPanel.includes('questionDrafts'), true)
    assert.equal(adminPanel.includes('questions: questionDrafts.map'), true)
    assert.equal(adminPanel.includes('/api/feedback/rounds/${encodeURIComponent(selectedRound.id)}/settings'), true)
  })

  await run('review email editor utilities preserve safe formatting and strip unsafe markup', () => {
    const html = plainTextToReviewEmailHtml('Hello\nPlease review the draft.\n\nThank you')
    const content = buildReviewEmailContent(
      `${html}<ul><li><strong>Strength</strong> summarize key points</li></ul><p><a href="https://example.com">Guide</a></p><script>alert(1)</script>`
    )
    const sanitized = sanitizeReviewEmailHtml('<p onclick="bad()">Body</p><a href="javascript:alert(1)">Unsafe</a>')
    const roundTrip = reviewEmailHtmlToText(content.html)

    assert.equal(content.html.includes('<script'), false)
    assert.equal(content.html.includes('<strong>Strength</strong>'), true)
    assert.equal(content.html.includes('href="https://example.com"'), true)
    assert.equal(sanitized.includes('onclick'), false)
    assert.equal(sanitized.includes('javascript:'), false)
    assert.equal(roundTrip.includes('Strength'), true)
    assert.equal(roundTrip.includes('Guide (https://example.com)'), true)
    assert.equal(roundTrip.includes('Please review the draft.'), true)
  })

  console.log('Feedback 360 ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
