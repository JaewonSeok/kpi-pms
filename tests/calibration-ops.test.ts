import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  createEmptyCalibrationWorkspace,
  normalizeCalibrationWorkspace,
} from '../src/lib/calibration-workspace'
import {
  buildCalibrationSetupReadiness,
  createDefaultCalibrationSessionSetup,
} from '../src/lib/calibration-session-setup'
import {
  CalibrationCandidateUpdateSchema,
  CalibrationExportSchema,
  CalibrationWorkflowSchema,
} from '../src/lib/validations'

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
  await run('calibration update schema accepts bulk import, external upload, workspace update, follow-up update, export, and merge/delete workflow payloads', () => {
    const bulkImport = CalibrationCandidateUpdateSchema.safeParse({
      action: 'bulk-import',
      cycleId: 'cycle-1',
      rows: [
        {
          targetId: 'target-1',
          gradeId: 'grade-a',
          adjustReason: '리뷰 근거와 최근 실적을 다시 반영해 최종 등급과 코멘트를 조정합니다.',
          rowNumber: 2,
          identifier: 'EMP-001',
        },
      ],
    })
    const externalUpload = CalibrationCandidateUpdateSchema.safeParse({
      action: 'upload-external-data',
      cycleId: 'cycle-1',
      externalData: {
        columns: [{ key: 'external_1_joblevel', label: 'Job Level' }],
        rows: [
          {
            targetId: 'target-1',
            rowNumber: 2,
            identifier: 'EMP-001',
            values: {
              external_1_joblevel: 'L4',
            },
          },
        ],
      },
    })
    const workspaceUpdate = CalibrationCandidateUpdateSchema.safeParse({
      action: 'update-workspace',
      cycleId: 'cycle-1',
      workspaceCommand: {
        type: 'save-candidate-workspace',
        targetId: 'target-1',
        status: 'ESCALATED',
        shortReason: '추가 논의가 필요합니다.',
        discussionMemo: 'owner 재확인이 필요합니다.',
        privateNote: '비공개 note',
        publicComment: '공유 후보 comment',
      },
    })
    const workflowMerge = CalibrationWorkflowSchema.safeParse({
      cycleId: 'cycle-1',
      action: 'MERGE',
      scopeId: 'dept-1',
    })
    const followUpUpdate = CalibrationCandidateUpdateSchema.safeParse({
      action: 'update-follow-up',
      cycleId: 'cycle-1',
      followUpCommand: {
        type: 'finalize-comment',
        targetId: 'target-1',
        comment: '결과 전달 시 사용할 공개용 코멘트를 확정하고 다음 기대치를 함께 설명합니다.',
      },
    })
    const workflowDelete = CalibrationWorkflowSchema.safeParse({
      cycleId: 'cycle-1',
      action: 'DELETE_SESSION',
    })
    const exportMode = CalibrationExportSchema.safeParse({
      cycleId: 'cycle-1',
      mode: 'all',
      scopeId: 'dept-1',
    })

    assert.equal(bulkImport.success, true)
    assert.equal(externalUpload.success, true)
    assert.equal(workspaceUpdate.success, true)
    assert.equal(followUpUpdate.success, true)
    assert.equal(workflowMerge.success, true)
    assert.equal(workflowDelete.success, true)
    assert.equal(exportMode.success, true)
  })

  await run('calibration route supports partial bulk import failures and external data upload persistence', () => {
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')

    assert.equal(routeSource.includes("body.action === 'bulk-import'"), true)
    assert.equal(routeSource.includes('failedRows'), true)
    assert.equal(routeSource.includes('appliedCount'), true)
    assert.equal(routeSource.includes("body.action === 'upload-external-data'"), true)
    assert.equal(routeSource.includes('CALIBRATION_EXTERNAL_DATA_UPLOADED'), true)
    assert.equal(routeSource.includes('toCalibrationSessionConfigJson'), true)
    assert.equal(routeSource.includes('calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig)'), true)
    assert.equal(routeSource.includes("body.action === 'update-workspace'"), true)
    assert.equal(routeSource.includes('CALIBRATION_DISCUSSION_UPDATED'), true)
    assert.equal(routeSource.includes('CALIBRATION_TIMER_STARTED'), true)
    assert.equal(routeSource.includes('CALIBRATION_TIMER_EXTENDED'), true)
    assert.equal(routeSource.includes('CALIBRATION_FACILITATOR_PROMPT_ADDED'), true)
    assert.equal(routeSource.includes("body.action === 'update-follow-up'"), true)
    assert.equal(routeSource.includes('CALIBRATION_PUBLIC_COMMENT_FINALIZED'), true)
    assert.equal(routeSource.includes('CALIBRATION_COMMUNICATION_PACKET_GENERATED'), true)
    assert.equal(routeSource.includes('CALIBRATION_RETROSPECTIVE_SURVEY_SUBMITTED'), true)
    assert.equal(routeSource.includes('CALIBRATION_LEADER_FEEDBACK_RECORDED'), true)
  })

  await run('calibration workflow route supports merge and session delete with audit-safe handling', () => {
    const workflowSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(workflowSource.includes("action === 'MERGE'"), true)
    assert.equal(workflowSource.includes('CALIBRATION_MERGED'), true)
    assert.equal(workflowSource.includes("action === 'DELETE_SESSION'"), true)
    assert.equal(workflowSource.includes('CALIBRATION_SESSION_DELETED'), true)
    assert.equal(workflowSource.includes('createEmptyCalibrationSessionConfig'), true)
    assert.equal(workflowSource.includes("evalStage: 'CEO_ADJUST'"), true)
  })

  await run('calibration export route and workbook builder exist for xlsx download', () => {
    const routePath = path.resolve(process.cwd(), 'src/app/api/evaluation/calibration/export/route.ts')
    const serverPath = path.resolve(process.cwd(), 'src/server/evaluation-calibration-export.ts')

    assert.equal(existsSync(routePath), true)
    assert.equal(existsSync(serverPath), true)

    const routeSource = read('src/app/api/evaluation/calibration/export/route.ts')
    const serverSource = read('src/server/evaluation-calibration-export.ts')

    assert.equal(routeSource.includes('CalibrationExportSchema'), true)
    assert.equal(routeSource.includes("searchParams.get('disposition') === 'inline'"), true)
    assert.equal(serverSource.includes('buildCalibrationExportWorkbook'), true)
    assert.equal(serverSource.includes("mode === 'all'"), true)
    assert.equal(serverSource.includes('XLSX.write'), true)
  })

  await run('calibration loader exposes merged/session metadata and external data for datasheet/detail rendering', () => {
    const loaderSource = read('src/server/evaluation-calibration.ts')

    assert.equal(loaderSource.includes('externalColumns'), true)
    assert.equal(loaderSource.includes('lastMergeSummary'), true)
    assert.equal(loaderSource.includes('externalData'), true)
    assert.equal(loaderSource.includes('hasMergedCalibration'), true)
    assert.equal(loaderSource.includes('sourceStage'), true)
    assert.equal(loaderSource.includes('CALIBRATION_SESSION_DELETED'), true)
    assert.equal(loaderSource.includes('threeYearHistory'), true)
    assert.equal(loaderSource.includes('feedbackSummary'), true)
    assert.equal(loaderSource.includes('sessionStartedAt'), true)
    assert.equal(loaderSource.includes('buildCalibrationActorCapabilities'), true)
    assert.equal(loaderSource.includes('buildCalibrationFollowUp'), true)
    assert.equal(loaderSource.includes('communicationGuide'), true)
    assert.equal(loaderSource.includes('objections'), true)
    assert.equal(loaderSource.includes('retrospectiveSurveys'), true)
    assert.equal(loaderSource.includes('leaderFeedback'), true)
  })

  await run('calibration session setup schema persists owner facilitator recorder distribution columns and ground rules', () => {
    const parsed = CalibrationCandidateUpdateSchema.safeParse({
      action: 'update-session-config',
      cycleId: 'cycle-1',
      sessionConfig: {
        excludedTargetIds: ['target-1'],
        participantIds: ['person-1', 'person-2'],
        evaluatorIds: ['person-3'],
        observerIds: ['person-4'],
        setup: {
          sessionName: '연간 캘리브레이션 1차',
          sessionType: 'MULTI_TEAM',
          scopeMode: 'LEADER_GROUP',
          scopeDepartmentIds: ['dept-1'],
          scopeLeaderIds: ['leader-1'],
          ownerId: 'owner-1',
          facilitatorId: 'facilitator-1',
          recorderId: 'recorder-1',
          observerIds: ['observer-1'],
          preReadDeadline: '2026-04-09T01:00:00.000Z',
          scheduledStart: '2026-04-10T01:00:00.000Z',
          scheduledEnd: '2026-04-10T03:00:00.000Z',
          timeboxMinutes: 7,
          decisionPolicy: 'CONSENSUS_PREFERRED',
          referenceDistributionUse: 'GUIDELINE_ONLY',
          referenceDistributionVisibility: 'WARNING_ONLY',
          referenceDistributionRatios: [{ gradeId: 'grade-a', gradeLabel: 'A', ratio: 30 }],
          ratingGuideUse: true,
          ratingGuideLinks: [
            { id: 'guide-1', scopeType: 'JOB_GROUP', scopeValue: '경영관리군', memo: '직군 기준' },
          ],
          expectationAlignmentMemo: '최상/최하 기준을 회의 전 공유합니다.',
          visibleDataColumns: ['name', 'department', 'threeYearHistory'],
          memoCommentPolicyPreset: 'OWNER_REVIEW_REQUIRED',
          objectionWindowOpenAt: '2026-04-11T01:00:00.000Z',
          objectionWindowCloseAt: '2026-04-12T01:00:00.000Z',
          followUpOwnerId: 'owner-2',
          groundRules: [
            {
              key: 'LAS_VEGAS_RULE',
              label: 'Las Vegas Rule',
              description: '세션 외부 공유 금지',
              enabled: true,
            },
          ],
          groundRuleAcknowledgementPolicy: 'REQUIRED',
          facilitatorCanFinalize: false,
        },
      },
    })

    assert.equal(parsed.success, true)
  })

  await run('calibration session setup readiness blocks missing required setup and keeps HR finalizer off by default', () => {
    const defaults = createDefaultCalibrationSessionSetup()
    const readiness = buildCalibrationSetupReadiness({
      setup: defaults,
      participantIds: [],
    })

    assert.equal(defaults.facilitatorCanFinalize, false)
    assert.equal(readiness.readyToStart, false)
    assert.equal(readiness.blockingItems.some((item) => item.includes('owner')), true)
    assert.equal(readiness.blockingItems.some((item) => item.includes('participant')), true)
    assert.equal(readiness.blockingItems.some((item) => item.includes('pre-read')), true)
    assert.equal(readiness.blockingItems.some((item) => item.includes('acknowledgement')), true)

    const warningReadiness = buildCalibrationSetupReadiness({
      setup: {
        ...defaults,
        ownerId: 'owner-1',
        facilitatorId: 'owner-1',
        preReadDeadline: '2026-04-09T01:00:00.000Z',
        scheduledStart: '2026-04-10T01:00:00.000Z',
        scheduledEnd: '2026-04-10T03:00:00.000Z',
        groundRuleAcknowledgementPolicy: 'REQUIRED',
        ratingGuideUse: true,
        ratingGuideLinks: [],
      },
      participantIds: ['person-1'],
    })

    assert.equal(warningReadiness.readyToStart, true)
    assert.equal(warningReadiness.warningItems.some((item) => item.includes('등급 가이드')), true)
    assert.equal(warningReadiness.warningItems.some((item) => item.includes('owner') && item.includes('facilitator')), true)
  })

  await run('calibration workflow and client wire session setup hub with start-session completeness handling', () => {
    const workflowSource = read('src/app/api/evaluation/calibration/workflow/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')
    const hubSource = read('src/components/evaluation/CalibrationSessionSetupHub.tsx')

    assert.equal(workflowSource.includes("action === 'START_SESSION'"), true)
    assert.equal(workflowSource.includes('SETUP_INCOMPLETE'), true)
    assert.equal(workflowSource.includes('CALIBRATION_SESSION_STARTED'), true)
    assert.equal(clientSource.includes('CalibrationSessionSetupHub'), true)
    assert.equal(clientSource.includes("handleWorkflow('START_SESSION')"), true)
    assert.equal(hubSource.includes('groundRuleAcknowledgementPolicy'), true)
    assert.equal(hubSource.includes('referenceDistributionVisibility'), true)
    assert.equal(hubSource.includes('visibleDataColumns'), true)
    assert.equal(hubSource.includes('facilitatorCanFinalize'), true)
  })

  await run('calibration workspace schema helpers normalize timer discussion state and custom prompts', () => {
    const empty = createEmptyCalibrationWorkspace(7)
    const normalized = normalizeCalibrationWorkspace(
      {
        currentCandidateId: 'target-1',
        candidateStates: {
          'target-1': {
            status: 'ANYWAY_YES',
            shortReason: '결론 우선',
            discussionMemo: '긴 메모',
            privateNote: '비공개 note',
            publicComment: '공개 comment',
            updatedAt: '2026-04-10T01:00:00.000Z',
            updatedBy: 'user-1',
          },
        },
        timer: {
          candidateId: 'target-1',
          startedAt: '2026-04-10T01:00:00.000Z',
          durationMinutes: 9,
          extendedMinutes: 2,
          startedById: 'user-1',
        },
        customPrompts: ['질문 1', '질문 1', '질문 2'],
      },
      7
    )

    assert.equal(empty.timer?.durationMinutes, 7)
    assert.equal(normalized.currentCandidateId, 'target-1')
    assert.equal(normalized.candidateStates['target-1']?.status, 'ANYWAY_YES')
    assert.equal(normalized.timer?.extendedMinutes, 2)
    assert.deepEqual(normalized.customPrompts, ['질문 1', '질문 2'])
  })

  await run('calibration workspace client renders discussion workspace timer note-comment separation and nudges', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('세션 워크스페이스'), true)
    assert.equal(clientSource.includes('현재 논의 대상'), true)
    assert.equal(clientSource.includes('Parking Lot'), true)
    assert.equal(clientSource.includes('Timebox / Timer'), true)
    assert.equal(clientSource.includes('Final Rating First'), true)
    assert.equal(clientSource.includes('Decision helper'), true)
    assert.equal(clientSource.includes('Note'), true)
    assert.equal(clientSource.includes('Comment'), true)
    assert.equal(clientSource.includes('Visible Data / Decision Context'), true)
    assert.equal(clientSource.includes('ReferenceDistributionNudgeCard'), true)
    assert.equal(clientSource.includes('FacilitatorPromptCard'), true)
    assert.equal(clientSource.includes('No 또는 상위 검토는 짧은 사유'), true)
  })

  await run('calibration follow-up client renders final review communication objection survey and leader feedback flows', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')
    const serverSource = read('src/server/evaluation-calibration.ts')

    assert.equal(clientSource.includes('Post-session Review / Final Check'), true)
    assert.equal(clientSource.includes('Result Communication Guide'), true)
    assert.equal(clientSource.includes('Note-to-Comment Handoff'), true)
    assert.equal(clientSource.includes('Objection Workflow'), true)
    assert.equal(clientSource.includes('Participant Survey / Retrospective'), true)
    assert.equal(clientSource.includes('Leader Feedback'), true)
    assert.equal(clientSource.includes('comment finalized'), true)
    assert.equal(clientSource.includes('communication packet generated'), true)
    assert.equal(clientSource.includes('survey submitted'), true)
    assert.equal(clientSource.includes('leader feedback 저장'), true)
    assert.equal(serverSource.includes('CALIBRATION_PUBLIC_COMMENT_FINALIZED'), true)
    assert.equal(serverSource.includes('CALIBRATION_RETROSPECTIVE_SURVEY_SUBMITTED'), true)
  })

  await run('calibration client renders upload, export, merge, delete, and degraded feedback affordances', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('외부 데이터 업로드'), true)
    assert.equal(clientSource.includes('엑셀 다운로드'), true)
    assert.equal(clientSource.includes('평가 병합'), true)
    assert.equal(clientSource.includes('세션 삭제'), true)
    assert.equal(clientSource.includes('accept=".xlsx,.xls,.csv"'), true)
    assert.equal(clientSource.includes('UploadIssueList'), true)
    assert.equal(clientSource.includes('handleExport(\'inline\')'), true)
    assert.equal(clientSource.includes('handleWorkflow(\'MERGE\''), true)
    assert.equal(clientSource.includes('handleWorkflow(\'DELETE_SESSION\')'), true)
  })

  await run('calibration client resets stale modal and upload state when session data changes', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes("setBulkImportRows([])"), true)
    assert.equal(clientSource.includes("setBulkImportIssues([])"), true)
    assert.equal(clientSource.includes("setExternalUploadOpen(false)"), true)
    assert.equal(clientSource.includes("setExternalUploadRows([])"), true)
    assert.equal(clientSource.includes("setExportOpen(false)"), true)
    assert.equal(clientSource.includes("setMergeOpen(false)"), true)
    assert.equal(clientSource.includes("setDeleteOpen(false)"), true)
    assert.equal(clientSource.includes('key={selectedCandidate.id}'), true)
  })

  await run('calibration detail panel and datasheet expose external data and merged status without losing review/memo tabs', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('외부 참고 데이터'), true)
    assert.equal(clientSource.includes('병합 반영됨'), true)
    assert.equal(clientSource.includes('기준 ${candidate.sourceStage}'), true)
    assert.equal(clientSource.includes("['review', '리뷰']"), true)
    assert.equal(clientSource.includes("['memo', '평가 메모']"), true)
    assert.equal(clientSource.includes('candidate.externalData.length'), true)
  })

  await run('calibration page and route keep unauthorized roles out of live editing paths', () => {
    const pageSource = read('src/app/(main)/evaluation/ceo-adjust/page.tsx')
    const loaderSource = read('src/server/evaluation-calibration.ts')
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')
    const workflowSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(pageSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(loaderSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(params.role)"), true)
    assert.equal(routeSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(workflowSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
  })

  console.log('Calibration ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
