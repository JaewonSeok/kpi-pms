import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { EvaluationPreviewResult2026 } from '@/server/evaluation-preview-2026'
import {
  Badge,
  Banner,
  MetricCard,
  Panel,
} from '@/components/evaluation/workbench/EvaluationWorkbenchShell'
import type {
  DryRunOutputPasteReview2026,
  EndToEndPilot2026,
  EvaluationActivationReadiness2026ApiData,
  EvaluationGradePolicyReadiness2026ApiData,
  EvaluationPreviewReadiness2026ApiData,
  GradePolicyTeamMemberSalesResolutionPayload2026,
  InteractivePilotLocalInputs2026,
  InteractivePilotStepId2026,
  OfficialDataReadinessBaselineCounts2026,
  OfficialDataReadinessBaselineExport2026,
  OfficialDataReadinessBaselineRow2026,
  OfficialWriteGuardDisplayRow2026,
  ReadinessExportPreview,
  ReadinessExportPreviewFormat,
  ReadinessScenarioInput2026,
  ReadinessScenarioPreview2026,
  ReadinessScenarioProjectedCounts2026,
  ReadinessScenarioSimulator2026,
  WorkbenchPilotAlignmentStage2026,
  WorkbenchPilotItemDraft2026,
  WorkbenchPilotItemRow2026,
} from '@/components/evaluation/workbench/EvaluationWorkbenchTypes'
export function formatPreviewScore2026(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(1) : '-'
}

export function getAiRequirementStatusLabel2026(status: EvaluationPreviewResult2026['ai']['levelUpRequirementStatus']) {
  if (status === 'passed') return 'Pass'
  if (status === 'failed') return 'Fail'
  if (status === 'pending') return 'Pending'
  if (status === 'insufficient_data') return '증빙 부족'
  return '대상 아님'
}

export function getPreviewIssueLabel2026(code: string) {
  const labels: Record<string, string> = {
    POLICY_CATEGORY_REQUIRED: '정책 카테고리 미분류',
    POLICY_CATEGORY_MANUAL_REVIEW_REQUIRED: '수동 검토 항목',
    MISSING_ORGANIZATION_SCORE: '조직성과 split 부족',
    MISSING_PERSONAL_SCORE: '개인성과 split 부족',
    GRADE_THRESHOLD_GROUP_REQUIRED: '등급 기준 그룹 부족',
    SALES_GROUP_REQUIRED: '영업/비영업 구분 부족',
    POLICY_CONFIRMATION_REQUIRED: '등급 threshold 정책 확인 필요',
    AMBIGUOUS_THRESHOLD_MATCH: '등급 threshold 정책 확인 필요',
    NO_RECOGNITION_ROUTE_PASSED: 'AI 증빙 부족',
    AI_TARGET_ROLE_REQUIRED: 'AI 대상 직책 정보 부족',
  }

  return labels[code] ?? code
}

export function PolicyReadiness2026Panel(props: {
  selectedCycleId: string | null
  readinessData: EvaluationPreviewReadiness2026ApiData | null
  loading: boolean
  error: string
  officialCycleSaving: boolean
  officialCycleError: string
  officialCycleNotice: string
  onLoad: () => void
  onSetOfficialCycle: (enabled: boolean) => void
}) {
  const readiness = props.readinessData
  const blockers = readiness?.activationBlockers ?? []
  const samples = readiness?.samples ?? []
  const selectedCycleIsOfficial =
    Boolean(props.selectedCycleId) &&
    readiness?.cycleScope.selectedCycleId === props.selectedCycleId &&
    readiness.cycleScope.isOfficialReadinessTarget

  return (
    <Panel
      title="2026 평가 전환 준비 상태"
      description="공식 결과에는 반영되지 않습니다. HR/admin이 2026 정책 활성화 전에 보완할 메타데이터와 정책 확인 항목을 점검합니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-indigo-50 p-2 text-indigo-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">준비 상태 전용</Badge>
              <Badge tone={readiness && readiness.blockedCount === 0 ? 'success' : readiness ? 'warn' : 'neutral'}>
                {readiness
                  ? readiness.blockedCount === 0
                    ? '전환 준비 양호'
                    : `${readiness.blockedCount}건 검토 필요`
                  : '미확인'}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              정책 카테고리, 영업/비영업 구분, 등급 기준 HR 확인, AI 증빙 부족 여부를 cycle 단위로 읽기 전용 집계합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onLoad}
          disabled={props.loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {props.loading ? '확인 중...' : readiness ? '다시 확인' : '준비 상태 확인'}
        </button>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}
      {props.officialCycleError ? (
        <div className="mt-4"><Banner tone="error" message={props.officialCycleError} /></div>
      ) : null}
      {props.officialCycleNotice ? (
        <div className="mt-4"><Banner tone="success" message={props.officialCycleNotice} /></div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">공식 준비 상태 대상 주기 지정</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              공식 점수 전환이 아니라 준비 상태 대상 주기 지정입니다. 이 설정은 EvalCycle.performanceDesignConfig 메타데이터만 변경하며,
              공식 점수/등급/AI 제외 기능 활성화 스위치와 저장 점수는 변경하지 않습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => props.onSetOfficialCycle(true)}
              disabled={!props.selectedCycleId || props.officialCycleSaving || selectedCycleIsOfficial}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {props.officialCycleSaving ? '저장 중...' : selectedCycleIsOfficial ? '지정됨' : '이 주기를 준비 상태 대상으로 지정'}
            </button>
            <button
              type="button"
              onClick={() => props.onSetOfficialCycle(false)}
              disabled={!props.selectedCycleId || props.officialCycleSaving || !selectedCycleIsOfficial}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
            >
              준비 상태 대상 해제
            </button>
          </div>
        </div>
        {!props.selectedCycleId ? (
          <p className="mt-3 text-xs text-amber-700">평가 주기를 선택한 뒤 준비 상태 대상 여부를 지정할 수 있습니다.</p>
        ) : null}
      </div>

      {readiness ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={readiness.cycleScope.isOfficialReadinessTarget ? 'success' : 'warn'}>
                {readiness.cycleScope.isOfficialReadinessTarget ? '공식 준비 상태 대상 주기' : '공식 대상 주기 미확정'}
              </Badge>
              <span className="text-sm font-semibold text-slate-900">
                {readiness.cycleScope.selectedCycleName ?? '선택된 공식 평가 주기 없음'}
              </span>
              {readiness.cycleScope.selectedCycleYear ? (
                <span className="text-xs text-slate-400">{readiness.cycleScope.selectedCycleYear}</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              cycleId {readiness.cycleScope.selectedCycleId ?? '미지정'} · 선택 방식 {readiness.cycleScope.selectionMode}
            </p>
            {readiness.cycleScope.warning ? (
              <div className="mt-3">
                <Banner tone="warn" message={readiness.cycleScope.warning} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <MetricCard
              label="평가 확인"
              value={readiness.totalEvaluationsChecked.toLocaleString()}
              help="읽기 전용 점검"
              compact
            />
            <MetricCard
              label="산출 가능"
              value={readiness.canCalculateCount.toLocaleString()}
              help="미리보기 가능"
              compact
              variant={readiness.canCalculateCount > 0 ? 'default' : 'muted'}
            />
            <MetricCard
              label="정책 카테고리 미분류"
              value={(readiness.missingPolicyCategoryCount + readiness.manualReviewCount).toLocaleString()}
              help="UNKNOWN/manual-review 포함"
              compact
              variant={readiness.missingPolicyCategoryCount + readiness.manualReviewCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="영업/비영업 구분 필요"
              value={readiness.missingSalesClassificationCount.toLocaleString()}
              help="자동 기본값 없음"
              compact
              variant={readiness.missingSalesClassificationCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="Division 매핑 필요"
              value={readiness.missingOrgMasterDivisionSalesMappingCount.toLocaleString()}
              help="조직 master 기준"
              compact
              variant={readiness.missingOrgMasterDivisionSalesMappingCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="등급 기준 HR 확인 필요"
              value={readiness.ambiguousThresholdCount.toLocaleString()}
              help="threshold ambiguity"
              compact
              variant={readiness.ambiguousThresholdCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="AI 증빙 부족"
              value={readiness.aiInsufficientDataCount.toLocaleString()}
              help="점수와 별도"
              compact
              variant={readiness.aiInsufficientDataCount > 0 ? 'warning' : 'default'}
            />
          </div>

          {blockers.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">Phase 1-G 전 확인할 항목</h4>
              </div>
              <ul className="mt-3 space-y-2">
                {blockers.map((blocker) => (
                  <li key={blocker} className="text-sm leading-6 text-amber-900">
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              현재 확인 범위에서는 전환 차단 항목이 집계되지 않았습니다.
            </div>
          )}

          {samples.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">검토 샘플</h4>
                <span className="text-xs text-slate-400">최대 30건 중 상위 {samples.slice(0, 6).length}건 표시</span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {samples.slice(0, 6).map((sample, index) => (
                  <li key={`${sample.evaluationId}-${sample.issueCode}-${sample.itemId ?? index}`} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={sample.severity === 'error' ? 'warn' : 'neutral'}>{sample.issueLabel}</Badge>
                      <span className="text-sm font-semibold text-slate-900">{sample.targetName}</span>
                      <span className="text-xs text-slate-400">{sample.targetDepartment}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {sample.itemTitle ? `${sample.itemTitle} · ` : ''}{sample.message}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 현재 평가 주기의 2026 정책 전환 준비 상태를 수동으로 확인할 수 있습니다.
        </div>
      )}
    </Panel>
  )
}

function formatIntegratedSnapshotCount2026(value: unknown) {
  return typeof value === 'number' ? value.toLocaleString() : '미확인'
}

function formatReadinessUiStatus2026(status: string | null | undefined) {
  if (!status) return '미확인'
  const labels: Record<string, string> = {
    READY: '준비됨',
    MBO_SETUP_IN_PROGRESS: 'MBO 작성 진행 중',
    POLICY_MAPPING_IN_PROGRESS: '정책 분류 진행 중',
    REVIEWER_ASSIGNMENT_IN_PROGRESS: '평가자 배정 진행 중',
    RESULT_WRITING_NOT_READY: '수행결과 작성 필요',
    OFFICIAL_ACTIVATION_BLOCKED: '공식 전환 차단 중',
    READY_FOR_HR_REVIEW: 'HR 검토 준비',
    READY_FOR_BACKFILL_DRY_RUN_REVIEW: '사전 실행 검토 준비',
    NOT_APPLICABLE: '해당 없음',
    NOT_READY: '준비 안 됨',
    READY_WITH_APPROVED_EXCEPTIONS: '승인 예외 포함 준비',
    BLOCKED: '차단됨',
    ALLOW: '허용',
    READY_LATER: '추후 가능',
    READY_FOR_REVIEW: '검토 가능',
    NEEDS_APPROVAL: '승인 필요',
    NOT_ALLOWED: '허용 안 됨',
    WATCH_ONLY: '모니터링 전용',
    READ_ONLY: '읽기 전용',
    PREVIEW_ONLY: '미리보기 전용',
    PREVIEW_WITH_BLOCKERS: '미리보기 가능 / 공식 실행 차단',
    SAFETY_CONFIRMED: '안전 확인됨',
    NO_GO: '진행 불가',
    GO: '진행 가능',
    DRY_RUN: '사전 실행 검토',
    DRY_RUN_ONLY: '사전 실행 검토 전용',
    REFERENCE: '참고',
    NEEDS_DATA: '데이터 보완 필요',
    NEEDS_HR_ACTION: '인사 조치 필요',
    NEEDS_INPUT: '입력 필요',
    BLOCKED_BY_REASON: '사유 필요',
    WARNING: '주의',
    READY_TO_START: '시작 가능',
    DONE: '완료',
    NOT_STARTED: '미시작',
    WAITING_FOR_DATA: '데이터 대기',
    IN_PROGRESS: '진행 중',
    REFERENCE_ONLY: '참고 전용',
    LOCAL_ONLY: '로컬 전용',
    COPY_ONLY: '복사 전용',
    TEXT_ONLY: '텍스트 전용',
    AVAILABLE: '사용 가능',
    UNAVAILABLE: '사용 불가',
    PROHIBITED: '금지',
    PROHIBITED_UNTIL_GATE_READY: '공식 전환 조건 충족 전 금지',
    NOT_EXECUTED: '실행 안 함',
    TEMPLATE_READY: '양식 준비됨',
  }
  return labels[status] ?? status
}

function optionalBaselineNumber2026(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatBaselineCount2026(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('ko-KR')
  if (typeof value === 'string' && value.trim()) return value
  return '미확인'
}

function formatBaselineRate2026(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '미확인'
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`
}

function escapeBaselineTsvCell2026(value: string) {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

function buildBaselineTsv2026(rows: OfficialDataReadinessBaselineRow2026[]) {
  const headers = [
    'Item',
    'Current count/status',
    'Required state',
    'Owner',
    'Route',
    'Can be solved now?',
    'Official write needed?',
    'Next action',
  ]
  return [
    headers.join('\t'),
    ...rows.map((row) => [
      row.item,
      row.currentCountStatus,
      row.requiredState,
      row.owner,
      row.route,
      row.canBeSolvedNow,
      row.officialWriteNeeded,
      row.nextAction,
    ].map(escapeBaselineTsvCell2026).join('\t')),
  ].join('\n')
}

function formatOfficialWriteGuardReasonKo2026(reason: string) {
  const labels: Record<string, string> = {
    SCHEMA_BOUNDARY_NOT_APPLIED: 'schema boundary migration 미적용',
    STAGING_REHEARSAL_NOT_COMPLETE: 'staging/preview DB rehearsal 미완료',
    PRODUCTION_MIGRATION_NOT_APPROVED: 'production migration 순서 미승인',
    HR_APPROVAL_MISSING: 'HR 승인 미확인',
    MBO_COVERAGE_INSUFFICIENT: 'MBO/KPI coverage 부족',
    CONFIRMED_KPI_COVERAGE_INSUFFICIENT: '확정 KPI coverage 부족',
    POLICY_CATEGORY_MISSING: 'policyCategory 미분류 남음',
    TEAM_KPI_PENDING: 'Team KPI pending/discussion 남음',
    EVALUATOR_ROUTING_BLOCKED: '평가자 배정 blocker 남음',
    SCORE_POLICY_BLOCKED: '점수 정책 blocker 남음',
    GRADE_POLICY_BLOCKED: '등급 정책 blocker 남음',
    LEADER_EVALUATION_BLOCKED: '리더 평가 blocker 남음',
    FINALIZATION_CEO_BLOCKED: '최종/CEO blocker 남음',
    OFFICIAL_GATE_BLOCKED: '공식 전환 차단 조건 남음',
    AI_SCORE_SEPARATION_NOT_CONFIRMED: 'AI Pass/Fail 점수 분리 미확인',
    DB_BACKUP_NOT_CONFIRMED: 'DB backup 미확인',
    WRITE_ROUTE_NOT_APPROVED: '공식 write route 미승인',
    UNKNOWN: '확인 필요',
  }
  return labels[reason] ?? reason
}

function getOfficialWriteGuardDecisionRows2026(
  summary: EvaluationActivationReadiness2026ApiData['officialWriteGuardSummary']
): OfficialWriteGuardDisplayRow2026[] {
  const rows = [
    ['officialPopulation', '공식 평가 생성', summary.officialPopulation],
    ['selfStageSave', '자기평가/단계 저장', summary.selfStageSave],
    ['reviewerStageSave', '평가자 단계 저장', summary.reviewerStageSave],
    ['scoreWrite', '공식 점수 반영', summary.scoreWrite],
    ['gradeWrite', '공식 등급 반영', summary.gradeWrite],
    ['finalization', '최종 확정', summary.finalization],
  ] as const

  return rows.map(([key, label, decision]) => ({
    key,
    label,
    status: decision.status,
    reasons: decision.reasons.map(formatOfficialWriteGuardReasonKo2026),
    nextAction: decision.nextActions[0] ?? '현재 차단 조건을 계속 모니터링합니다.',
  }))
}

function getOfficialWriteGuardStatusTone2026(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'ALLOW') return 'success'
  if (status === 'NEEDS_APPROVAL' || status === 'READY_LATER') return 'warn'
  if (status === 'BLOCK') return 'error'
  return 'neutral'
}

function buildOfficialDataReadinessBaselineExport2026(
  activation: EvaluationActivationReadiness2026ApiData
): OfficialDataReadinessBaselineExport2026 {
  const snapshot = activation.integratedReadinessSnapshot
  const snapshotSummary = snapshot.summary
  const cycleScope = activation.readiness.cycleScope
  const evaluatorSummary = activation.evaluatorRoutingReadiness?.summary
  const feedbackSummary = activation.feedbackLeadershipReadiness?.summary
  const leaderSummary = activation.leaderEvaluationReadiness?.summary
  const finalizationSummary = activation.finalizationCeoReadiness?.summary
  const gradePolicy = activation.gradePolicyReadiness
  const activeEmployees = optionalBaselineNumber2026(snapshotSummary.activeEmployeeCount)
  const confirmedKpiCount = optionalBaselineNumber2026(snapshotSummary.confirmedPersonalKpiCount)
  const confirmedKpiShortage =
    activeEmployees == null || confirmedKpiCount == null
      ? null
      : Math.max(activeEmployees - confirmedKpiCount, 0)
  const officialGateBlockers = optionalBaselineNumber2026(snapshotSummary.officialActivationGateBlockerCount)
    ?? activation.officialActivationGates.filter((gate) => gate.status !== 'READY' && gate.status !== 'NOT_APPLICABLE').length
  const gradeThresholdBlockers = gradePolicy
    ? gradePolicy.missingRowsCount + gradePolicy.differsFromPptCount + gradePolicy.overlapCount + gradePolicy.gapCount + gradePolicy.missingHrDecisionCount
    : null
  const counts: OfficialDataReadinessBaselineCounts2026 = {
    activeEmployees,
    targetPopulationCount: activeEmployees,
    confirmedKpiCount,
    confirmedKpiCoverageRate: optionalBaselineNumber2026(snapshot.completionRates.mboConfirmedRate),
    mboMissing: optionalBaselineNumber2026(snapshotSummary.missingMboCount),
    confirmedKpiShortage,
    draftKpiHolders: null,
    submittedKpiCount: null,
    teamKpiPending: optionalBaselineNumber2026(snapshotSummary.teamKpiPendingCount),
    policyCategoryMissing: optionalBaselineNumber2026(snapshotSummary.policyCategoryMissingCount),
    orgGoalCount: null,
    projectTCount: null,
    projectKCount: null,
    dailyWorkCount: null,
    evaluatorRoutingBlockers: optionalBaselineNumber2026(snapshotSummary.evaluatorRoutingBlockerCount),
    missingFirstEvaluator: evaluatorSummary?.missingFirstEvaluatorCount ?? null,
    missingSecondEvaluator: evaluatorSummary?.missingSecondEvaluatorCount ?? null,
    missingFinalEvaluator: evaluatorSummary?.missingFinalApproverCount ?? null,
    manualReviewCount: evaluatorSummary?.manualReviewCount ?? null,
    inactiveEvaluatorCount: evaluatorSummary?.inactiveEvaluatorWarningCount ?? null,
    managerMissingCount: evaluatorSummary?.managerEmployeeNoMissingCount ?? null,
    scorePolicyBlockers: optionalBaselineNumber2026(snapshotSummary.scorePolicyBlockerCount),
    gradePolicyBlockers: optionalBaselineNumber2026(snapshotSummary.gradePolicyBlockerCount),
    weightCapWarnings: null,
    categorySourceWarnings: null,
    gradeThresholdBlockers,
    resultWritingWarnings: optionalBaselineNumber2026(snapshotSummary.resultWritingBlockerCount),
    leaderEvaluationBlockers: optionalBaselineNumber2026(snapshotSummary.leaderEvaluationBlockerCount) ?? leaderSummary?.blockerCount ?? null,
    finalizationCeoBlockers: optionalBaselineNumber2026(snapshotSummary.finalizationCeoBlockerCount) ?? finalizationSummary?.finalizationBlockerCount ?? null,
    calibrationBlockers: finalizationSummary?.calibrationReadinessBlockerCount ?? null,
    ceoConfirmationBlockers: finalizationSummary?.ceoConfirmationBlockerCount ?? null,
    leadership360Blockers: optionalBaselineNumber2026(snapshotSummary.feedbackLeadershipBlockerCount) ?? feedbackSummary?.blockedOrNeedsSetupCount ?? null,
    missingReviewerAssignments: feedbackSummary?.missingReviewerAssignmentCount ?? null,
    missingResponses: feedbackSummary?.responseMissingCount ?? null,
    aiPassFailBlockers: optionalBaselineNumber2026(snapshotSummary.aiReadinessBlockerCount),
    officialGateBlockers,
  }
  const requiredBlockerValues = [
    counts.mboMissing,
    counts.confirmedKpiShortage,
    counts.teamKpiPending,
    counts.policyCategoryMissing,
    counts.evaluatorRoutingBlockers,
    counts.scorePolicyBlockers,
    counts.gradePolicyBlockers,
    counts.officialGateBlockers,
  ]
  const officialPopulationReadiness: OfficialDataReadinessBaselineExport2026['officialPopulationReadiness'] =
    requiredBlockerValues.every((value) => value === 0) ? 'READY' : 'NOT_READY'
  const officialWriteGuardRows = getOfficialWriteGuardDecisionRows2026(activation.officialWriteGuardSummary)
  const officialWriteGuardBaselineRows: OfficialDataReadinessBaselineRow2026[] = officialWriteGuardRows.map((row) => ({
    item: `공식 저장 차단 상태 - ${row.label}`,
    currentCountStatus: formatReadinessUiStatus2026(row.status),
    requiredState: '허용 조건 충족',
    owner: 'HR/인사 + 개발/모니터링',
    route: '/admin/evaluation-readiness',
    canBeSolvedNow: 'no',
    officialWriteNeeded: 'yes',
    nextAction: row.nextAction,
  }))
  const baselineRows: OfficialDataReadinessBaselineRow2026[] = [
    {
      item: 'active employees',
      currentCountStatus: formatBaselineCount2026(counts.activeEmployees),
      requiredState: 'HR confirmed official target scope',
      owner: 'HR/인사',
      route: '/admin/evaluation-ops',
      canBeSolvedNow: 'yes',
      officialWriteNeeded: 'no',
      nextAction: '대상자 범위와 제외 기준을 확정합니다.',
    },
    {
      item: 'confirmed KPI count / coverage rate',
      currentCountStatus: `${formatBaselineCount2026(counts.confirmedKpiCount)} / ${formatBaselineRate2026(counts.confirmedKpiCoverageRate)}`,
      requiredState: 'confirmed KPI coverage sufficient or exceptions approved',
      owner: 'HR/인사 + 리더',
      route: '/kpi/personal',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '확정 KPI 부족 대상자를 확인하고 제출/확정 follow-up을 진행합니다.',
    },
    {
      item: 'MBO missing',
      currentCountStatus: formatBaselineCount2026(counts.mboMissing),
      requiredState: '0 or approved exclusions',
      owner: '직원 + 리더',
      route: '/kpi/personal',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: 'MBO 미작성 대상자에게 작성/제출을 요청합니다.',
    },
    {
      item: 'confirmed KPI shortage',
      currentCountStatus: formatBaselineCount2026(counts.confirmedKpiShortage),
      requiredState: '0 or approved exclusions',
      owner: 'HR/인사 + 리더',
      route: '/kpi/personal',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '확정 KPI 부족 대상자와 예외 승인 여부를 정리합니다.',
    },
    {
      item: 'Team KPI pending/discussion',
      currentCountStatus: formatBaselineCount2026(counts.teamKpiPending),
      requiredState: '0 or approved exceptions',
      owner: 'HR/인사',
      route: '/admin/evaluation-ops',
      canBeSolvedNow: 'yes',
      officialWriteNeeded: 'no',
      nextAction: 'Team KPI 검토 대기/논의 필요 건을 확정합니다.',
    },
    {
      item: 'policyCategory missing',
      currentCountStatus: formatBaselineCount2026(counts.policyCategoryMissing),
      requiredState: '0 or approved exceptions',
      owner: 'HR/인사',
      route: '/admin/evaluation-ops',
      canBeSolvedNow: 'yes',
      officialWriteNeeded: 'no',
      nextAction: 'policyCategory 미분류 KPI를 분류합니다.',
    },
    {
      item: 'evaluator routing blockers',
      currentCountStatus: formatBaselineCount2026(counts.evaluatorRoutingBlockers),
      requiredState: '0 or approved exceptions',
      owner: 'HR/인사',
      route: '/admin/performance-assignments',
      canBeSolvedNow: 'yes',
      officialWriteNeeded: 'no',
      nextAction: 'FIRST/SECOND/FINAL 평가자 누락과 수동 검토 건을 정리합니다.',
    },
    {
      item: 'score policy blockers',
      currentCountStatus: formatBaselineCount2026(counts.scorePolicyBlockers),
      requiredState: '0',
      owner: 'HR/인사 + 개발/모니터링',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '점수 정책 경고와 AI Pass/Fail 분리 정책을 검토합니다.',
    },
    {
      item: 'grade policy blockers',
      currentCountStatus: formatBaselineCount2026(counts.gradePolicyBlockers),
      requiredState: '0',
      owner: 'HR/인사',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'yes',
      officialWriteNeeded: 'no',
      nextAction: '등급 기준 누락/차이/경계 조건을 확정합니다.',
    },
    {
      item: 'leader evaluation blockers',
      currentCountStatus: formatBaselineCount2026(counts.leaderEvaluationBlockers),
      requiredState: '0 or approved exceptions',
      owner: '리더 + HR/인사',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '리더 평가 선행 조건과 결과 작성 준비 상태를 확인합니다.',
    },
    {
      item: 'finalization/CEO blockers',
      currentCountStatus: formatBaselineCount2026(counts.finalizationCeoBlockers),
      requiredState: '0 before finalization discussion',
      owner: 'HR/인사 + CEO office',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '최종/대표이사 확정 전 차단 조건과 보정 준비 상태를 확인합니다.',
    },
    {
      item: '360/leadership blockers',
      currentCountStatus: formatBaselineCount2026(counts.leadership360Blockers),
      requiredState: '0 or approved exceptions',
      owner: 'HR/인사',
      route: '/admin/evaluation-ops',
      canBeSolvedNow: 'yes',
      officialWriteNeeded: 'no',
      nextAction: '360/리더십 reviewer 배정과 응답 누락을 정리합니다.',
    },
    {
      item: 'AI Pass/Fail readiness blockers',
      currentCountStatus: `${formatBaselineCount2026(counts.aiPassFailBlockers)} / annual score exclusion ${activation.flags.aiScoreExclusionEnabled ? '활성화됨' : '비활성화'}`,
      requiredState: 'Pass/Fail separated from annual score',
      owner: 'HR/인사 + 개발/모니터링',
      route: '/evaluation/ai-competency/admin',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: 'AI 활용평가가 연간 점수와 분리되어 있는지 확인합니다.',
    },
    {
      item: 'official gate blockers',
      currentCountStatus: formatBaselineCount2026(counts.officialGateBlockers),
      requiredState: '0 before official population',
      owner: 'HR/인사 + 개발/모니터링',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '공식 전환 차단 조건과 승인 증빙을 정리합니다.',
    },
    ...officialWriteGuardBaselineRows,
    {
      item: 'blocked until schema/save-flow',
      currentCountStatus: 'official Evaluation/EvaluationItem creation, totalScore write, gradeId write',
      requiredState: 'schema boundary migration strategy approved',
      owner: '개발/모니터링',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'no',
      officialWriteNeeded: 'yes',
      nextAction: 'staging/preview DB rehearsal과 production migration sequencing 승인 전까지 보류합니다.',
    },
    {
      item: 'unavailable detail fields',
      currentCountStatus: [
        `draft KPI holders ${formatBaselineCount2026(counts.draftKpiHolders)}`,
        `ORG_GOAL ${formatBaselineCount2026(counts.orgGoalCount)}`,
        `PROJECT_T ${formatBaselineCount2026(counts.projectTCount)}`,
        `PROJECT_K ${formatBaselineCount2026(counts.projectKCount)}`,
        `DAILY_WORK ${formatBaselineCount2026(counts.dailyWorkCount)}`,
        `weight/cap warnings ${formatBaselineCount2026(counts.weightCapWarnings)}`,
        `category/source warnings ${formatBaselineCount2026(counts.categorySourceWarnings)}`,
      ].join(' · '),
      requiredState: 'existing export exposes field or HR confirms manually',
      owner: 'HR/인사 + 개발/모니터링',
      route: '/admin/evaluation-readiness',
      canBeSolvedNow: 'partial',
      officialWriteNeeded: 'no',
      nextAction: '현재 읽기 전용 응답에 없는 상세 필드는 미확인으로 표시합니다.',
    },
  ]
  const blockers = snapshot.topBlockers.map((item) => `${item.name}: ${formatBaselineCount2026(item.count)}건`)
  const nextHrActions = snapshot.nextActions.hr.map((item) => `${item.label}: ${item.detail} (${item.route})`)
  const nextDeveloperWatchActions = snapshot.nextActions.developer.map((item) => `${item.label}: ${item.detail} (${item.route})`)
  const prohibitedActions = Array.from(new Set([
    ...snapshot.prohibitedActions,
    ...(activation.dryRunGoNoGoFreezePack?.prohibitedActions ?? []),
  ]))
  const tsv = buildBaselineTsv2026(baselineRows)
  const summaryLines = [
    '2026 Official Data Readiness Baseline v1',
    `snapshot timestamp: ${activation.checkedAt}`,
    `target cycle: ${cycleScope.selectedCycleName ?? '미확인'}`,
    `target year: ${formatBaselineCount2026(cycleScope.selectedCycleYear)}`,
    `official population readiness: ${formatReadinessUiStatus2026(officialPopulationReadiness)}`,
    `active employees: ${formatBaselineCount2026(counts.activeEmployees)}`,
    `confirmed KPI count / coverage rate: ${formatBaselineCount2026(counts.confirmedKpiCount)} / ${formatBaselineRate2026(counts.confirmedKpiCoverageRate)}`,
    `MBO missing: ${formatBaselineCount2026(counts.mboMissing)}`,
    `confirmed KPI shortage: ${formatBaselineCount2026(counts.confirmedKpiShortage)}`,
    `Team KPI pending/discussion: ${formatBaselineCount2026(counts.teamKpiPending)}`,
    `policyCategory missing: ${formatBaselineCount2026(counts.policyCategoryMissing)}`,
    `evaluator routing blockers: ${formatBaselineCount2026(counts.evaluatorRoutingBlockers)}`,
    `official gate blockers: ${formatBaselineCount2026(counts.officialGateBlockers)}`,
    `Go/No-Go status: ${formatReadinessUiStatus2026(activation.dryRunGoNoGoFreezePack?.decision.currentDecision ?? 'NO_GO')}`,
    `apply status: ${formatReadinessUiStatus2026(activation.dryRunGoNoGoFreezePack?.decision.applyStatus ?? 'NOT_ALLOWED')}`,
    '공식 저장 차단 상태:',
    ...officialWriteGuardRows.map((row) => `- ${row.label}: ${formatReadinessUiStatus2026(row.status)} (${row.reasons.slice(0, 3).join(', ') || '사유 없음'})`),
  ]
  const markdown = [
    '# 2026 Official Data Readiness Baseline v1',
    '',
    `- snapshot timestamp: ${activation.checkedAt}`,
    `- target cycle: ${cycleScope.selectedCycleName ?? '미확인'}`,
    `- target year: ${formatBaselineCount2026(cycleScope.selectedCycleYear)}`,
    `- official population readiness: ${formatReadinessUiStatus2026(officialPopulationReadiness)}`,
    `- active employees: ${formatBaselineCount2026(counts.activeEmployees)}`,
    `- confirmed KPI count / coverage rate: ${formatBaselineCount2026(counts.confirmedKpiCount)} / ${formatBaselineRate2026(counts.confirmedKpiCoverageRate)}`,
    `- MBO missing: ${formatBaselineCount2026(counts.mboMissing)}`,
    `- confirmed KPI shortage: ${formatBaselineCount2026(counts.confirmedKpiShortage)}`,
    `- draft KPI holders: ${formatBaselineCount2026(counts.draftKpiHolders)}`,
    `- submitted KPI count: ${formatBaselineCount2026(counts.submittedKpiCount)}`,
    `- Team KPI pending/discussion: ${formatBaselineCount2026(counts.teamKpiPending)}`,
    `- policyCategory missing: ${formatBaselineCount2026(counts.policyCategoryMissing)}`,
    `- ORG_GOAL count: ${formatBaselineCount2026(counts.orgGoalCount)}`,
    `- PROJECT_T count: ${formatBaselineCount2026(counts.projectTCount)}`,
    `- PROJECT_K count: ${formatBaselineCount2026(counts.projectKCount)}`,
    `- DAILY_WORK count: ${formatBaselineCount2026(counts.dailyWorkCount)}`,
    `- evaluator routing blockers: ${formatBaselineCount2026(counts.evaluatorRoutingBlockers)}`,
    `- missing FIRST evaluator: ${formatBaselineCount2026(counts.missingFirstEvaluator)}`,
    `- missing SECOND evaluator: ${formatBaselineCount2026(counts.missingSecondEvaluator)}`,
    `- missing FINAL evaluator: ${formatBaselineCount2026(counts.missingFinalEvaluator)}`,
    `- score policy blockers: ${formatBaselineCount2026(counts.scorePolicyBlockers)}`,
    `- grade policy blockers: ${formatBaselineCount2026(counts.gradePolicyBlockers)}`,
    `- grade threshold blockers: ${formatBaselineCount2026(counts.gradeThresholdBlockers)}`,
    `- TEAM_MEMBER_SALES Super/Outstanding issue: ${gradePolicy?.teamMemberSalesAmbiguity.requiresDecision ? gradePolicy.teamMemberSalesAmbiguity.message : '해당 없음 또는 확정됨'}`,
    `- result-writing warnings: ${formatBaselineCount2026(counts.resultWritingWarnings)}`,
    `- leader evaluation blockers: ${formatBaselineCount2026(counts.leaderEvaluationBlockers)}`,
    `- finalization/CEO blockers: ${formatBaselineCount2026(counts.finalizationCeoBlockers)}`,
    `- calibration blockers: ${formatBaselineCount2026(counts.calibrationBlockers)}`,
    `- CEO confirmation blockers: ${formatBaselineCount2026(counts.ceoConfirmationBlockers)}`,
    `- 360/leadership blockers: ${formatBaselineCount2026(counts.leadership360Blockers)}`,
    `- missing reviewer assignments: ${formatBaselineCount2026(counts.missingReviewerAssignments)}`,
    `- missing responses: ${formatBaselineCount2026(counts.missingResponses)}`,
    `- AI Pass/Fail blockers: ${formatBaselineCount2026(counts.aiPassFailBlockers)}`,
    `- AI annual score exclusion status: ${activation.flags.aiScoreExclusionEnabled ? '활성화됨' : '비활성화'}`,
    `- official gate blockers: ${formatBaselineCount2026(counts.officialGateBlockers)}`,
    `- Go/No-Go status: ${formatReadinessUiStatus2026(activation.dryRunGoNoGoFreezePack?.decision.currentDecision ?? 'NO_GO')}`,
    `- apply status: ${formatReadinessUiStatus2026(activation.dryRunGoNoGoFreezePack?.decision.applyStatus ?? 'NOT_ALLOWED')}`,
    '',
    '## 공식 저장 차단 상태',
    ...officialWriteGuardRows.flatMap((row) => [
      `- ${row.label}: ${formatReadinessUiStatus2026(row.status)}`,
      `  - 주요 사유: ${row.reasons.slice(0, 5).join(', ') || '사유 없음'}`,
      `  - 다음 액션: ${row.nextAction}`,
    ]),
    '',
    '## HR-resolvable blockers',
    '- MBO missing / confirmed KPI shortage',
    '- evaluator routing blockers',
    '- Team KPI pending/discussion',
    '- policyCategory missing',
    '- score policy blockers',
    '- grade policy blockers',
    '',
    '## Leader/employee blockers',
    '- employee MBO 작성/제출',
    '- leader KPI review/confirmation',
    '- result evidence/comment preparation',
    '',
    '## Developer/watch blockers',
    '- production log watch',
    '- schema migration hold',
    '- no feature flag changes',
    '',
    '## Blocked until schema/save-flow',
    '- official Evaluation creation',
    '- official EvaluationItem creation',
    '- official stage save/submit',
    '- official totalScore write',
    '- official gradeId write',
    '- finalization write',
    '',
    '## Cycle 1 P0/P1/P2 plan',
    '- P0: MBO missing / confirmed KPI shortage, evaluator routing blockers, Team KPI pending, policyCategory missing',
    '- P1: score policy blockers, grade policy blockers, result-writing warnings, leader evaluation readiness, finalization/CEO readiness, 360/leadership readiness',
    '- P2/watch: AI Pass/Fail separation, production log watch, schema migration hold, no official writes',
    '',
    '## Data readiness table',
    tsv,
    '',
    '## Top blockers',
    ...(blockers.length ? blockers.map((item) => `- ${item}`) : ['- 미확인']),
    '',
    '## Next HR actions',
    ...(nextHrActions.length ? nextHrActions.map((item) => `- ${item}`) : ['- 미확인']),
    '',
    '## Next developer/watch actions',
    ...(nextDeveloperWatchActions.length ? nextDeveloperWatchActions.map((item) => `- ${item}`) : ['- 미확인']),
    '',
    '## Safety confirmation',
    '- no production data mutation',
    '- no migrations',
    '- no dry-run/backfill/apply',
    '- no official scoring/grade/AI activation',
    '- no Evaluation.totalScore write',
    '- no Evaluation.gradeId write',
    '- no Evaluation/EvaluationItem creation',
    '- no feature flag changes',
  ].join('\n')
  return {
    snapshotTimestamp: activation.checkedAt,
    targetCycleName: cycleScope.selectedCycleName ?? '미확인',
    targetYear: cycleScope.selectedCycleYear,
    officialPopulationReadiness,
    counts,
    blockers,
    nextHrActions,
    nextDeveloperWatchActions,
    prohibitedActions,
    baselineRows,
    copyPayloads: {
      summary: summaryLines.join('\n'),
      markdown,
      tsv,
    },
    safety: {
      productionDataMutation: false,
      migration: false,
      backfillApply: false,
      officialScoring: false,
      officialGrade: false,
      aiScoreExclusion: false,
      totalScoreWrite: false,
      gradeIdWrite: false,
      evaluationCreation: false,
      evaluationItemCreation: false,
      featureFlagChange: false,
    },
  }
}

function getIntegratedReadinessStatusTone2026(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'READY_FOR_REVIEW' || status === 'READY_LATER') return 'success'
  if (status === 'NEEDS_DATA' || status === 'NEEDS_HR_ACTION') return 'warn'
  if (status === 'BLOCKED') return 'error'
  return 'neutral'
}

function getReadinessActionPriorityTone2026(priority: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (priority === 'P0') return 'error'
  if (priority === 'P1') return 'warn'
  return 'neutral'
}

function getReadinessActionStatusTone2026(status: string): 'success' | 'warn' | 'error' | 'neutral' {
  if (status === 'READY_TO_START') return 'success'
  if (status === 'DONE') return 'success'
  if (status === 'WATCH_ONLY') return 'neutral'
  if (status === 'NOT_STARTED') return 'neutral'
  if (status === 'WAITING_FOR_DATA') return 'warn'
  if (status === 'IN_PROGRESS') return 'warn'
  if (status === 'BLOCKED') return 'error'
  return 'neutral'
}

const SCENARIO_INPUT_FIELDS_2026: Array<{
  key: keyof ReadinessScenarioInput2026
  label: string
  help: string
}> = [
  { key: 'mboMissingReduction', label: 'MBO 미작성 감소', help: '미작성 MBO가 줄어드는 가정' },
  { key: 'confirmedKpiIncrease', label: 'confirmed KPI 증가', help: '확정 KPI가 늘어나는 가정' },
  { key: 'teamKpiPendingReduction', label: 'Team KPI 검토 대기 감소', help: '검토 대기/논의 필요 정리' },
  { key: 'policyCategoryMissingReduction', label: 'policyCategory 감소', help: '미분류 확정' },
  { key: 'evaluatorRoutingBlockerReduction', label: '평가자 blocker 감소', help: 'FIRST/SECOND/FINAL 누락 정리' },
  { key: 'leaderEvaluationBlockerReduction', label: '리더 평가 해소 필요 항목 감소', help: '리더 평가 선행조건 정리' },
  { key: 'resultWritingWarningReduction', label: '수행결과 warning 감소', help: '결과/증빙/기여 보완' },
  { key: 'scorePolicyBlockerReduction', label: 'score policy 감소', help: '점수 정책 warning 정리' },
  { key: 'gradePolicyBlockerReduction', label: 'grade policy 감소', help: '등급 기준 blocker 정리' },
  { key: 'feedbackLeadershipBlockerReduction', label: '360/리더십 감소', help: '다면/진단 setup 및 응답 정리' },
  { key: 'finalizationCeoBlockerReduction', label: '최종/CEO 감소', help: '최종 확정 준비 상태 정리' },
]

function numericScenarioValue2026(value: number | null | undefined) {
  return typeof value === 'number' ? value : 0
}

function scenarioSub2026(value: number | null, reduction: number) {
  if (value == null) return null
  return Math.max(value - Math.max(reduction, 0), 0)
}

function scenarioConfirmedShortage2026(active: number | null, confirmed: number | null) {
  if (active == null || confirmed == null) return null
  return Math.max(active - confirmed, 0)
}

function determineScenarioStage2026(
  counts: ReadinessScenarioProjectedCounts2026
): EvaluationActivationReadiness2026ApiData['integratedReadinessSnapshot']['currentStage'] {
  if (numericScenarioValue2026(counts.missingMboCount) > 0 || numericScenarioValue2026(counts.confirmedPersonalKpiShortageCount) > 0) {
    return 'MBO_SETUP_IN_PROGRESS'
  }
  if (
    numericScenarioValue2026(counts.policyCategoryMissingCount) > 0 ||
    numericScenarioValue2026(counts.teamKpiPendingCount) > 0 ||
    numericScenarioValue2026(counts.scorePolicyBlockerCount) > 0
  ) {
    return 'POLICY_MAPPING_IN_PROGRESS'
  }
  if (numericScenarioValue2026(counts.evaluatorRoutingBlockerCount) > 0) return 'REVIEWER_ASSIGNMENT_IN_PROGRESS'
  if (numericScenarioValue2026(counts.resultWritingWarningCount) > 0) return 'RESULT_WRITING_NOT_READY'
  if (numericScenarioValue2026(counts.officialActivationGateBlockerCount) > 0) return 'OFFICIAL_ACTIVATION_BLOCKED'
  return 'READY_FOR_HR_REVIEW'
}

function buildScenarioPreview2026(
  simulator: ReadinessScenarioSimulator2026,
  input: ReadinessScenarioInput2026,
  scenarioName: string
): ReadinessScenarioPreview2026 {
  const base = simulator.baselineCounts
  const confirmedPersonalKpiCount = base.confirmedPersonalKpiCount == null
    ? null
    : Math.min(
        base.confirmedPersonalKpiCount + Math.max(input.confirmedKpiIncrease, 0),
        base.activeEmployeeCount ?? base.confirmedPersonalKpiCount + Math.max(input.confirmedKpiIncrease, 0)
      )
  const estimatedImpact = Object.values(input).reduce((sum, value) => sum + Math.max(value, 0), 0)
  const projectedCounts: ReadinessScenarioProjectedCounts2026 = {
    activeEmployeeCount: base.activeEmployeeCount,
    confirmedPersonalKpiCount,
    confirmedPersonalKpiShortageCount: scenarioConfirmedShortage2026(base.activeEmployeeCount, confirmedPersonalKpiCount),
    missingMboCount: scenarioSub2026(base.missingMboCount, input.mboMissingReduction),
    teamKpiPendingCount: scenarioSub2026(base.teamKpiPendingCount, input.teamKpiPendingReduction),
    policyCategoryMissingCount: scenarioSub2026(base.policyCategoryMissingCount, input.policyCategoryMissingReduction),
    evaluatorRoutingBlockerCount: scenarioSub2026(base.evaluatorRoutingBlockerCount, input.evaluatorRoutingBlockerReduction),
    leaderEvaluationBlockerCount: scenarioSub2026(base.leaderEvaluationBlockerCount, input.leaderEvaluationBlockerReduction),
    resultWritingWarningCount: scenarioSub2026(base.resultWritingWarningCount, input.resultWritingWarningReduction),
    scorePolicyBlockerCount: scenarioSub2026(base.scorePolicyBlockerCount, input.scorePolicyBlockerReduction),
    gradePolicyBlockerCount: scenarioSub2026(base.gradePolicyBlockerCount, input.gradePolicyBlockerReduction),
    feedbackLeadershipBlockerCount: scenarioSub2026(base.feedbackLeadershipBlockerCount, input.feedbackLeadershipBlockerReduction),
    finalizationCeoBlockerCount: scenarioSub2026(base.finalizationCeoBlockerCount, input.finalizationCeoBlockerReduction),
    officialActivationGateBlockerCount: base.officialActivationGateBlockerCount,
    estimatedOfficialGateBlockerCount: base.officialActivationGateBlockerCount == null
      ? null
      : Math.max(base.officialActivationGateBlockerCount - estimatedImpact, 0),
    estimatedOfficialGateImpact: estimatedImpact,
  }
  const deltaRows = [
    ['MBO_MISSING', 'MBO 미작성', base.missingMboCount, projectedCounts.missingMboCount, 'MBO 미작성 감소만 반영'],
    ['CONFIRMED_KPI_SHORTAGE', '확정 KPI 부족', base.confirmedPersonalKpiShortageCount, projectedCounts.confirmedPersonalKpiShortageCount, '확정 KPI 증가만 반영'],
    ['TEAM_KPI_PENDING', 'Team KPI 검토 대기', base.teamKpiPendingCount, projectedCounts.teamKpiPendingCount, 'Team KPI 검토 대기 감소만 반영'],
    ['POLICY_CATEGORY_MISSING', 'policyCategory 미분류', base.policyCategoryMissingCount, projectedCounts.policyCategoryMissingCount, 'policyCategory 미분류 감소만 반영'],
    ['EVALUATOR_ROUTING', '평가자 배정 해소 필요 항목', base.evaluatorRoutingBlockerCount, projectedCounts.evaluatorRoutingBlockerCount, '평가자 배정 해소 필요 항목 감소만 반영'],
    ['LEADER_EVALUATION', '리더 평가 해소 필요 항목', base.leaderEvaluationBlockerCount, projectedCounts.leaderEvaluationBlockerCount, '리더 평가 해소 필요 항목 감소만 반영'],
    ['OFFICIAL_GATE', '공식 전환 해소 필요 항목', base.officialActivationGateBlockerCount, projectedCounts.officialActivationGateBlockerCount, `공식 전환 조건 수는 실제 재산출 전까지 고정, 잠재 영향 -${estimatedImpact}건`],
  ].map(([key, label, baseline, projected, note]) => ({
    key: String(key),
    label: String(label),
    baseline: baseline as number | null,
    projected: projected as number | null,
    delta: baseline == null || projected == null ? null : (projected as number) - (baseline as number),
    note: String(note),
  }))
  const remainingBlockers = [
    ['MBO 미작성', projectedCounts.missingMboCount, '미작성자 작성 요청을 계속 진행하세요.'],
    ['확정 KPI 부족', projectedCounts.confirmedPersonalKpiShortageCount, '초안 제출과 리더 검토/확정을 요청하세요.'],
    ['평가자 배정 해소 필요 항목', projectedCounts.evaluatorRoutingBlockerCount, '평가자 배정 누락/조직 경로를 확인하세요.'],
    ['Team KPI 검토 대기', projectedCounts.teamKpiPendingCount, 'Team KPI 검토 대기/논의 필요 항목을 검토하세요.'],
    ['policyCategory 미분류', projectedCounts.policyCategoryMissingCount, '미분류 항목을 HR 기준으로 확정하세요.'],
    ['공식 전환 차단 조건', projectedCounts.officialActivationGateBlockerCount, '사전 실행 검토, DB 백업, HR 승인, 실행 절차서 단계를 확인하세요.'],
  ]
    .map(([label, count, nextAction]) => ({ label: String(label), count: numericScenarioValue2026(count as number | null), nextAction: String(nextAction) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
  const projectedStage = determineScenarioStage2026(projectedCounts)
  const projectedStatus = projectedStage === 'READY_FOR_HR_REVIEW' ? 'READY_LATER' : 'NEEDS_HR_ACTION'
  const nextHrAction = remainingBlockers[0]?.nextAction ?? '사전 실행 검토, DB 백업, HR 승인, 실행 절차서 검토를 준비하세요.'
  const reportText = [
    `이 시나리오는 ${scenarioName}를 가정합니다.`,
    `예상 단계는 ${projectedStage}, 전체 상태는 ${formatReadinessUiStatus2026(projectedStatus)}입니다.`,
    `남는 주요 해소 필요 항목은 ${remainingBlockers.slice(0, 5).map((item) => `${item.label} ${item.count}건`).join(', ') || '직접 차단 조건 없음'}입니다.`,
    '공식 전환은 여전히 사전 실행 검토, DB 백업, HR 승인 전까지 차단됩니다.',
    simulator.disclaimer,
  ].join(' ')
  const markdown = [
    `# 2026 준비 상태 시나리오 시뮬레이터 - ${scenarioName}`,
    '',
    reportText,
    '',
    '## 변화량',
    deltaRows.map((row) => `- ${row.label}: ${row.delta ?? '미확인'} (${row.note})`).join('\n'),
    '',
    '## 금지 작업',
    simulator.prohibitedActions.map((item) => `- ${item}`).join('\n'),
  ].join('\n')
  const tsv = [
    '해소 필요 항목\t기준값\t예상값\t변화량\t메모',
    ...deltaRows.map((row) => [
      row.label,
      row.baseline == null ? '미확인' : String(row.baseline),
      row.projected == null ? '미확인' : String(row.projected),
      row.delta == null ? '미확인' : String(row.delta),
      row.note,
    ].join('\t')),
  ].join('\n')
  return {
    scenarioName,
    projectedCounts,
    deltaRows,
    remainingBlockers,
    projectedStage,
    projectedStatus,
    nextHrAction,
    reportText,
    markdown,
    tsv,
  }
}

function formatDryRunOutputPasteValue2026(value: unknown) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getDryRunOutputNumber2026(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

function getDryRunOutputBoolean2026(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value > 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['1', 'true', 'yes', 'changed', 'enabled'].includes(normalized)) return true
      if (['0', 'false', 'no', 'unchanged', 'disabled'].includes(normalized)) return false
    }
  }
  return false
}

function getDryRunOutputMessages2026(record: Record<string, unknown>, ...keys: string[]) {
  return keys.flatMap((key) => {
    const value = record[key]
    if (Array.isArray(value)) return value.map((item) => String(item))
    if (typeof value === 'string' && value.trim()) return [value]
    return []
  })
}

function reviewDryRunOutputPasteLocally2026(record: Record<string, unknown>) {
  const redFlags: string[] = []
  const nextActions: string[] = []
  const add = (flag: string, action: string) => {
    redFlags.push(flag)
    nextActions.push(action)
  }
  if (getDryRunOutputBoolean2026(record, 'writesPerformed', 'writes_performed')) {
    add('WRITES_PERFORMED_TRUE', '즉시 중단하고 사전 실행 검토 실행 경로를 조사하세요.')
  }
  if (getDryRunOutputBoolean2026(record, 'totalScoreChangesExpected', 'totalScoreChanged')) {
    add('TOTAL_SCORE_CHANGED', 'Evaluation.totalScore write 경로를 조사하세요.')
  }
  if (getDryRunOutputBoolean2026(record, 'gradeIdChangesExpected', 'gradeIdChanged')) {
    add('GRADE_ID_CHANGED', 'Evaluation.gradeId write 경로를 조사하세요.')
  }
  if (getDryRunOutputBoolean2026(record, 'officialScoringEnabled', 'officialGradeEnabled', 'featureFlagsChanged')) {
    add('FEATURE_FLAG_OR_OFFICIAL_ACTIVATION', '공식 점수/등급/기능 활성화 스위치 상태를 조사하세요.')
  }
  if (getDryRunOutputNumber2026(record, 'policyCategoryMissingCount', 'missingPolicyCategoryCount') > 0) {
    add('POLICY_CATEGORY_MISSING', 'policyCategory workbench에서 미분류를 정리하세요.')
  }
  if (
    getDryRunOutputNumber2026(record, 'evaluatorAssignmentMissingCount', 'evaluatorMissingCount') > 0 &&
    !getDryRunOutputBoolean2026(record, 'approvedEvaluatorExceptions', 'evaluatorExceptionsApproved')
  ) {
    add('EVALUATOR_MISSING', '/admin/performance-assignments에서 blocker 또는 승인 예외를 확인하세요.')
  }
  if (getDryRunOutputNumber2026(record, 'mboMissingCount', 'missingMboCount') > 0) {
    add('MBO_MISSING', '/kpi/personal에서 MBO coverage를 확인하세요.')
  }
  const errors = getDryRunOutputMessages2026(record, 'errors', 'warnings').join(' ')
  if (/(P2021|P2022|PrismaClientKnownRequestError|column does not exist|relation does not exist|schema error)/i.test(errors)) {
    add('PRISMA_SCHEMA_ERROR', 'migration 실행 없이 schema/runtime issue를 조사하세요.')
  }
  if (/JWT_SESSION_ERROR/i.test(errors)) {
    add('JWT_SESSION_ERROR', 'auth/session runtime 상태를 확인하세요.')
  }

  return {
    classification: redFlags.some((flag) =>
      ['WRITES_PERFORMED_TRUE', 'TOTAL_SCORE_CHANGED', 'GRADE_ID_CHANGED', 'FEATURE_FLAG_OR_OFFICIAL_ACTIVATION', 'PRISMA_SCHEMA_ERROR'].includes(flag)
    )
      ? 'REJECT_DRY_RUN_OUTPUT'
      : redFlags.some((flag) => flag === 'JWT_SESSION_ERROR')
        ? 'NEEDS_DEVELOPER_FIX'
        : redFlags.length
          ? 'NEEDS_HR_FIX'
          : 'PASS_FOR_REVIEW',
    redFlags,
    nextActions: nextActions.length
      ? nextActions
      : ['필수 통과 기준을 확인하고 백업/HR 승인 논의로만 이동하세요. 실제 반영은 여전히 금지입니다.'],
  }
}

function inferReadinessExportFormat(key: string, content: string): ReadinessExportPreviewFormat {
  const lowerKey = key.toLowerCase()
  const trimmed = content.trim()

  if (lowerKey.includes('tsv')) return 'tsv'
  if (lowerKey.includes('markdown') || lowerKey.includes('-md')) return 'markdown'
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return 'json'
  if (trimmed.startsWith('# ') || trimmed.includes('\n## ')) return 'markdown'
  if (trimmed.includes('\t')) return 'tsv'
  return 'plain'
}

function getReadinessExportExtension(format: ReadinessExportPreviewFormat) {
  if (format === 'markdown') return 'md'
  if (format === 'tsv') return 'tsv'
  if (format === 'json') return 'json'
  return 'txt'
}

function getReadinessExportTitle(key: string) {
  const labels: Record<string, string> = {
    abort: '중단 조건',
    action: '액션',
    actions: '액션',
    agenda: '안건',
    alignment: '정렬',
    board: '보드',
    blockers: '해소 필요 항목',
    ceo: '대표이사',
    command: '명령',
    compact: '간단',
    conditions: '조건',
    dev: '개발/모니터링',
    developer: '개발/모니터링',
    dryrun: '사전 실행 검토',
    evidence: '증빙',
    export: '내보내기',
    final: '최종',
    freeze: '최종 판정',
    full: '전체',
    go: '진행 가능',
    grade: '등급',
    handoff: '인계',
    hr: 'HR/인사',
    item: '항목',
    later: '추후 가능',
    logs: '로그',
    markdown: '마크다운',
    nogo: '진행 불가',
    owner: '담당자',
    pack: '패키지',
    pilot: '미리보기',
    preview: '미리보기',
    prohibited: '금지 작업',
    readiness: '준비 상태',
    reasons: '사유',
    review: '검토',
    runbook: '절차서',
    safety: '안전',
    scenario: '시나리오',
    score: '점수',
    selected: '선택',
    signoff: '승인 확인',
    snapshot: '준비 상태 요약',
    summary: '요약',
    table: '표',
    tsv: 'TSV',
    watch: '모니터링',
    workbench: '평가 워크벤치',
  }

  return key
    .replace(/^dryrun-/, 'dry-run-')
    .split('-')
    .filter(Boolean)
    .map((word) => labels[word.toLowerCase()] ?? word)
    .join(' ')
}

function createReadinessExportPreview(key: string, content: string): ReadinessExportPreview {
  const format = inferReadinessExportFormat(key, content)
  const extension = getReadinessExportExtension(format)

  return {
    key,
    title: getReadinessExportTitle(key),
    description: '클릭하면 미리보기 후 복사할 수 있습니다. 이 미리보기는 읽기 전용이며 저장이나 실행을 수행하지 않습니다.',
    content,
    format,
    fileName: `2026-${key.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.${extension}`,
  }
}

function createInitialInteractivePilotInputs2026(pilot: EndToEndPilot2026 | null): InteractivePilotLocalInputs2026 {
  const firstKpi = pilot?.pilotKpis[0]
  return {
    selectedKpiId: firstKpi?.id ?? '',
    localAchievementLevel: firstKpi?.achievementLevel === 'EXCELLENT' ? 'EXCELLENT' : firstKpi?.achievementLevel === 'CUSTOM' ? 'CUSTOM' : 'TARGET',
    localBaseScore: firstKpi?.previewScore != null ? String(firstKpi.previewScore) : '90',
    selfResultSummary: 'SAMPLE/PILOT: 목표 대비 주요 산출물과 정량 결과를 요약합니다.',
    selfEvidenceLink: '',
    selfContributionComment: 'SAMPLE/PILOT: 개인 기여도와 협업 기여를 분리해서 작성합니다.',
    selfRiskComment: 'SAMPLE/PILOT: 공식 실행 전 정책 분류/평가자 배정 차단 조건을 확인합니다.',
    firstReviewerComment: 'SAMPLE/PILOT: 1차 평가자는 성과 근거의 충분성과 목표 난이도를 검토합니다.',
    firstReviewerScore: '88',
    firstAdjustmentAmount: '0',
    firstAdjustmentReason: '',
    firstFeedbackToEmployee: 'SAMPLE/PILOT: 보완할 근거와 다음 평가 단계 준비사항을 안내합니다.',
    finalReviewerComment: 'SAMPLE/PILOT: 2차/최종 평가는 조직 기준 정합성과 조정 필요성을 검토합니다.',
    finalReviewerScore: '90',
    finalAdjustmentAmount: '0',
    finalAdjustmentReason: '',
    finalRecommendation: 'SAMPLE/PILOT: 공식 확정 전 캘리브레이션과 대표이사 준비 상태 확인이 필요합니다.',
    ceoAdjustmentAmount: '0',
    ceoAdjustmentReason: '',
    ceoFinalNote: 'SAMPLE/PILOT: 대표이사 조정은 사유와 근거가 있을 때만 별도 승인 대상입니다.',
    ceoChecklistEvidence: true,
    ceoChecklistCalibration: false,
    ceoChecklistNoWrite: true,
  }
}

function createWorkbenchPilotItemDraft2026(
  item: EndToEndPilot2026['pilotKpis'][number],
  index: number
): WorkbenchPilotItemDraft2026 {
  const baseScore = item.previewScore != null ? String(item.previewScore) : String(88 + index)

  return {
    selfResultSummary: `SAMPLE/PILOT: ${item.title} 결과와 산출물을 항목 단위로 요약합니다.`,
    selfEvidenceLink: '',
    selfContribution: `SAMPLE/PILOT: ${item.category} 기여와 협업 맥락을 분리해 작성합니다.`,
    selfScorePreview: baseScore,
    firstReviewerScore: baseScore,
    firstReviewerComment: `SAMPLE/PILOT: 1차 평가자는 ${item.title} 근거 충분성과 난이도를 확인합니다.`,
    firstAdjustmentAmount: '0',
    firstAdjustmentReason: '',
    firstFeedbackToEmployee: 'SAMPLE/PILOT: 다음 단계에서 보완할 근거와 기대 기준을 안내합니다.',
    finalReviewerScore: baseScore,
    finalReviewerComment: `SAMPLE/PILOT: 2차/최종 평가는 ${item.title}의 조직 기준 정합성을 확인합니다.`,
    finalAdjustmentAmount: '0',
    finalAdjustmentReason: '',
    finalRecommendation: 'SAMPLE/PILOT: official execution 전 calibration blocker를 다시 확인합니다.',
    ceoAdjustmentAmount: '0',
    ceoAdjustmentReason: '',
    ceoFinalNote: 'SAMPLE/PILOT: 대표이사 조정은 근거와 사유가 있을 때만 별도 검토합니다.',
    ceoEvidenceConfirmed: true,
    ceoCalibrationReviewed: false,
    ceoNoWriteConfirmed: true,
  }
}

function createInitialWorkbenchPilotItemDrafts2026(pilot: EndToEndPilot2026 | null) {
  const drafts: Record<string, WorkbenchPilotItemDraft2026> = {}
  for (const [index, item] of (pilot?.pilotKpis ?? []).entries()) {
    drafts[item.id] = createWorkbenchPilotItemDraft2026(item, index)
  }
  return drafts
}

function parsePilotNumber2026(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampPilotScore2026(value: number) {
  return Math.max(0, Math.min(120, value))
}

function getInteractivePilotGradeLabel2026(score: number | null, fallback: string | null) {
  if (score == null) return fallback ?? 'PREVIEW_PENDING'
  if (score >= 100) return 'S'
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  return 'D'
}

function formatInteractivePilotMarkdown2026(params: {
  pilot: EndToEndPilot2026
  inputs: InteractivePilotLocalInputs2026
  selectedKpiTitle: string
  localFinalScore: number
  localGrade: string
  completionPercentage: number
  completedStepCount: number
  activeStepLabel: string
}) {
  return [
    '# 2026 단계별 체험 미리보기',
    '',
    '이 내보내기는 로컬 미리보기 보고용입니다. 사전 실행 검토, 실제 반영, 기존 데이터 채우기, 공식 점수/등급 반영, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 실행하지 않습니다.',
    '',
    `- 활성 단계: ${params.activeStepLabel}`,
    `- 파일럿 대상자: ${params.pilot.pilotEmployee.name} / ${params.pilot.pilotEmployee.departmentName}`,
    `- 선택 KPI: ${params.selectedKpiTitle}`,
    `- 로컬 완료율: ${params.completionPercentage}% (${params.completedStepCount}/9)`,
    `- 로컬 점수 미리보기: ${params.localFinalScore.toFixed(1)}`,
    `- 로컬 등급 미리보기: ${params.localGrade}`,
    `- 공식 차단 조건: ${params.pilot.blockers.length ? params.pilot.blockers.join(', ') : '파일럿 화면 기준 없음'}`,
    '',
    '## 자기평가 미리보기',
    params.inputs.selfResultSummary,
    params.inputs.selfContributionComment,
    params.inputs.selfRiskComment,
    '',
    '## 1차 평가 미리보기',
    params.inputs.firstReviewerComment,
    `평가자 점수: ${params.inputs.firstReviewerScore}`,
    `조정값: ${params.inputs.firstAdjustmentAmount}`,
    params.inputs.firstAdjustmentReason ? `조정 사유: ${params.inputs.firstAdjustmentReason}` : '조정값이 0이면 조정 사유가 필요 없습니다',
    '',
    '## 2차/최종 평가 미리보기',
    params.inputs.finalReviewerComment,
    `최종 점수: ${params.inputs.finalReviewerScore}`,
    `최종 조정값: ${params.inputs.finalAdjustmentAmount}`,
    params.inputs.finalAdjustmentReason ? `최종 조정 사유: ${params.inputs.finalAdjustmentReason}` : '조정값이 0이면 조정 사유가 필요 없습니다',
    '',
    '## 대표이사 조정 미리보기',
    `대표이사 조정값: ${params.inputs.ceoAdjustmentAmount}`,
    params.inputs.ceoAdjustmentReason ? `대표이사 조정 사유: ${params.inputs.ceoAdjustmentReason}` : '조정값이 0이면 대표이사 조정 사유가 필요 없습니다',
    params.inputs.ceoFinalNote,
    '',
    '## 안전 확인',
    '- 공식 점수 반영 false',
    '- 공식 등급 반영 false',
    '- AI 제외 활성화 false',
    '- 공식 저장 점수(totalScore) 쓰기 false',
    '- 공식 저장 등급(gradeId) 쓰기 false',
    '- 공식 Evaluation/EvaluationItem 생성 false',
    '- 기존 데이터 채우기/실제 반영 false',
    '- 기능 활성화 스위치 변경 false',
    '- API 쓰기 호출 없음',
  ].join('\n')
}

function formatInteractivePilotTsv2026(params: {
  pilot: EndToEndPilot2026
  selectedKpiTitle: string
  localFinalScore: number
  localGrade: string
  completionPercentage: number
}) {
  return [
    ['항목', '값'].join('\t'),
    ['파일럿 대상자', `${params.pilot.pilotEmployee.name} / ${params.pilot.pilotEmployee.departmentName}`].join('\t'),
    ['선택 KPI', params.selectedKpiTitle].join('\t'),
    ['완료율', `${params.completionPercentage}%`].join('\t'),
    ['로컬 점수 미리보기', params.localFinalScore.toFixed(1)].join('\t'),
    ['로컬 등급 미리보기', params.localGrade].join('\t'),
    ['공식 차단 조건', params.pilot.blockers.length ? params.pilot.blockers.join(', ') : '파일럿 화면 기준 없음'].join('\t'),
    ['공식 저장 점수(totalScore) 쓰기', 'false'].join('\t'),
    ['공식 저장 등급(gradeId) 쓰기', 'false'].join('\t'),
    ['공식 Evaluation/EvaluationItem 생성', 'false'].join('\t'),
  ].join('\n')
}

export function PolicyActivationReadiness2026Panel(props: {
  activationData: EvaluationActivationReadiness2026ApiData | null
  loading: boolean
  error: string
  autoLoadKey: string
  onLoad: () => void
  presentationMode?: 'gate' | 'performance-dashboard' | 'readiness-admin' | 'workbench-pilot'
}) {
  const { activationData: activation, loading, error, autoLoadKey, onLoad } = props
  const blockers = activation?.blockers ?? []
  const warnings = activation?.warnings ?? []
  const gates = activation?.officialActivationGates ?? []
  const runbook = activation?.officialActivationRunbook ?? null
  const snapshot = activation?.integratedReadinessSnapshot ?? null
  const actionPlan = activation?.readinessActionPlan ?? null
  const executionBoard = activation?.readinessExecutionBoard ?? null
  const scenarioSimulator = activation?.readinessScenarioSimulator ?? null
  const ceoReportPack = activation?.ceoReportPack ?? null
  const fastForwardOperationsCockpit = activation?.fastForwardOperationsCockpit ?? null
  const backfillDryRunPreflightPack = activation?.backfillDryRunPreflightPack ?? null
  const dryRunOutputReviewTemplate = activation?.dryRunOutputReviewTemplate ?? null
  const dryRunRehearsalGuardrails = activation?.dryRunRehearsalGuardrails ?? null
  const backfillDryRunCommandRunbook = activation?.backfillDryRunCommandRunbook ?? null
  const dryRunGoNoGoFreezePack = activation?.dryRunGoNoGoFreezePack ?? null
  const endToEndPilot2026 = activation?.endToEndPilot2026 ?? null
  const officialDataReadinessBaseline = useMemo(
    () => (activation ? buildOfficialDataReadinessBaselineExport2026(activation) : null),
    [activation]
  )
  const officialWriteGuardRows = useMemo(
    () => (activation ? getOfficialWriteGuardDecisionRows2026(activation.officialWriteGuardSummary) : []),
    [activation]
  )
  const gatesReady = gates.length > 0 && gates.every((gate) => gate.status === 'READY' || gate.status === 'NOT_APPLICABLE')
  const isPerformanceDashboardMode = props.presentationMode === 'performance-dashboard'
  const isReadinessAdminMode = props.presentationMode === 'readiness-admin'
  const panelTitle = isReadinessAdminMode
    ? '2026 공식 데이터 준비'
    : isPerformanceDashboardMode
      ? '2026 MBO/KPI 운영 대시보드'
      : '2026 공식 전환 차단 조건'
  const panelDescription = isReadinessAdminMode
    ? 'Baseline 내보내기, policyCategory 정리, 공식 저장 차단 상태를 읽기 전용으로 확인합니다. 세부 사전 실행 검토와 runbook은 아래 고급 상세 영역에서 확인하세요.'
    : isPerformanceDashboardMode
      ? 'HR/인사 관리자가 매일 확인할 MBO/KPI 운영 항목만 간결하게 보여줍니다. 공식 점수/등급 확정은 별도 안전 절차 전까지 차단됩니다.'
      : '이 화면은 공식 전환 가능 여부를 읽기 전용으로 점검합니다. 여기서는 기존 데이터 채우기, 점수, 등급, 기능 활성화 스위치를 실행하지 않습니다.'
  const refreshButtonLabel = isPerformanceDashboardMode
    ? activation ? '운영 상태 다시 확인' : '운영 상태 확인'
    : activation ? '공식 전환 상태 다시 확인' : '공식 전환 상태 확인'
  const [copiedRunbookKey, setCopiedRunbookKey] = useState<string | null>(null)
  const [exportPreview, setExportPreview] = useState<ReadinessExportPreview | null>(null)
  const [exportPreviewCopied, setExportPreviewCopied] = useState(false)
  const [executionBoardTab, setExecutionBoardTab] = useState<'ALL' | 'THIS_WEEK' | 'HR' | 'LEADER' | 'EMPLOYEE' | 'DEV' | 'DONE_HOLD'>('THIS_WEEK')
  const [dryRunOutputPasteText, setDryRunOutputPasteText] = useState('')
  const [scenarioState, setScenarioState] = useState<{
    presetId: string
    inputs: ReadinessScenarioInput2026 | null
    sourceKey: string
  }>({
    presetId: 'MBO_FIRST_REMINDER',
    inputs: null,
    sourceKey: '',
  })
  const openExportPreview = useCallback((key: string, text: string) => {
    setExportPreview(createReadinessExportPreview(key, text))
    setExportPreviewCopied(false)
  }, [])
  const copyExportPreviewToClipboard = useCallback(async () => {
    if (!exportPreview || typeof navigator === 'undefined' || !navigator.clipboard) return
    await navigator.clipboard.writeText(exportPreview.content)
    setCopiedRunbookKey(exportPreview.key)
    setExportPreviewCopied(true)
    window.setTimeout(() => setCopiedRunbookKey((current) => (current === exportPreview.key ? null : current)), 1800)
  }, [exportPreview])
  const downloadExportPreview = useCallback(() => {
    if (!exportPreview || typeof document === 'undefined' || typeof URL === 'undefined') return
    const blob = new Blob([exportPreview.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportPreview.fileName
    link.click()
    URL.revokeObjectURL(url)
  }, [exportPreview])
  const autoLoadRequestedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!exportPreview || typeof window === 'undefined') return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExportPreview(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exportPreview])

  useEffect(() => {
    if (activation || loading || error) return
    if (autoLoadRequestedKeyRef.current === autoLoadKey) return

    autoLoadRequestedKeyRef.current = autoLoadKey
    void onLoad()
  }, [activation, autoLoadKey, error, loading, onLoad])
  const selectedScenarioPreset = useMemo(() => {
    if (!scenarioSimulator) return null
    return scenarioSimulator.presets.find((preset) => preset.id === scenarioState.presetId) ?? scenarioSimulator.presets[0] ?? null
  }, [scenarioSimulator, scenarioState.presetId])

  const scenarioInputValues =
    scenarioState.sourceKey === autoLoadKey && scenarioState.inputs
      ? scenarioState.inputs
      : selectedScenarioPreset?.input ?? scenarioSimulator?.scenarioInputModel ?? null
  const scenarioPreview = useMemo(() => {
    if (!scenarioSimulator || !scenarioInputValues) return null
    return buildScenarioPreview2026(
      scenarioSimulator,
      scenarioInputValues,
      selectedScenarioPreset?.name ?? 'Manual scenario'
    )
  }, [scenarioInputValues, scenarioSimulator, selectedScenarioPreset])
  const dryRunOutputPasteReview = useMemo<DryRunOutputPasteReview2026 | null>(() => {
    if (!dryRunOutputReviewTemplate || !dryRunOutputPasteText.trim()) return null
    try {
      const parsed = JSON.parse(dryRunOutputPasteText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          ok: false,
          message: dryRunOutputReviewTemplate.localOnlyPasteHelper.invalidJsonMessage,
          fields: [],
        }
      }
      const record = parsed as Record<string, unknown>
      const fields = dryRunOutputReviewTemplate.localOnlyPasteHelper.knownFields
        .filter((field) => Object.prototype.hasOwnProperty.call(record, field))
        .map((field) => ({
          field,
          value: formatDryRunOutputPasteValue2026(record[field]),
        }))
      const localReview = reviewDryRunOutputPasteLocally2026(record)
      return {
        ok: true,
        message: fields.length
          ? '붙여넣은 결과에서 알려진 필드를 확인했습니다. 서버 제출 없이 브라우저 local state에서만 표시합니다.'
          : '알려진 필드가 없어 수동 검토 템플릿을 사용하세요. 서버 제출, 저장, 업로드는 수행하지 않습니다.',
        classification: localReview.classification,
        redFlags: localReview.redFlags,
        nextActions: localReview.nextActions,
        fields,
      }
    } catch {
      return {
        ok: false,
        message: dryRunOutputReviewTemplate.localOnlyPasteHelper.invalidJsonMessage,
        fields: [],
      }
    }
  }, [dryRunOutputPasteText, dryRunOutputReviewTemplate])
  const executionBoardActions = useMemo(() => {
    if (!executionBoard) return []
    if (executionBoardTab === 'ALL') return executionBoard.workstreams.all
    if (executionBoardTab === 'THIS_WEEK') return executionBoard.workstreams.thisWeekFocus
    if (executionBoardTab === 'HR') return executionBoard.workstreams.hr
    if (executionBoardTab === 'LEADER') return executionBoard.workstreams.leader
    if (executionBoardTab === 'EMPLOYEE') return executionBoard.workstreams.employee
    if (executionBoardTab === 'DEV') return executionBoard.workstreams.developer
    return executionBoard.workstreams.completedOrDeferred
  }, [executionBoard, executionBoardTab])

  if (props.presentationMode === 'workbench-pilot') {
    return (
      <div className="space-y-5">
        <DedicatedWorkbenchPilotRoute2026
          pilot={endToEndPilot2026}
          loading={loading}
          error={error}
          onLoad={onLoad}
          onExportPreview={openExportPreview}
        />

        {exportPreview ? (
          <ReadinessExportPreviewDialog
            open={Boolean(exportPreview)}
            onOpenChange={(open) => {
              if (!open) setExportPreview(null)
            }}
            title={exportPreview.title}
            description={exportPreview.description}
            content={exportPreview.content}
            format={exportPreview.format}
            suggestedFilename={exportPreview.fileName}
            allowDownload
            copied={exportPreviewCopied}
            onCopy={() => void copyExportPreviewToClipboard()}
            onDownload={downloadExportPreview}
          />
        ) : null}
      </div>
    )
  }

  return (
    <Panel
      title={panelTitle}
      description={panelDescription}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-amber-50 p-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">상태 확인 전용</Badge>
              <Badge tone={gatesReady ? 'success' : activation ? 'warn' : 'neutral'}>
                {gatesReady ? '공식 전환 조건 충족' : activation ? '공식 전환 차단' : '미확인'}
              </Badge>
              <Badge tone="neutral">활성화 버튼 없음</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              기존 데이터 채우기 실제 반영, 공식 점수 반영, 공식 등급 반영, AI 점수 제외 활성화,
              공식 저장 점수(totalScore), 공식 저장 등급(gradeId) 쓰기를 켜기 전 차단 조건만 확인합니다.
              저장 점수, 저장 등급, 제출, 확정, 보정 흐름은 변경하지 않습니다.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              클릭하면 내용을 먼저 미리보고 복사/다운로드할 수 있습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
        >
          {loading ? '확인 중...' : refreshButtonLabel}
        </button>
      </div>

      {error ? <div className="mt-4"><Banner tone="error" message={error} /></div> : null}

      {activation ? (
        <div className="mt-5 space-y-4">
          {isReadinessAdminMode && officialDataReadinessBaseline ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">읽기 전용</Badge>
                    <Badge tone={officialDataReadinessBaseline.officialPopulationReadiness === 'READY' ? 'success' : 'warn'}>
                      {formatReadinessUiStatus2026(officialDataReadinessBaseline.officialPopulationReadiness)}
                    </Badge>
                    <Badge tone="neutral">공식 write 없음</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-blue-950">2026 공식 데이터 준비 Baseline</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900">
                    공식 평가 생성 전 필요한 운영 데이터 준비 상태를 한 번에 내보냅니다. 이 내보내기는 읽기 전용이며 공식 저장, 점수 반영,
                    등급 반영, 기존 데이터 채우기를 실행하지 않습니다.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-blue-800">
                    기준 시각 {officialDataReadinessBaseline.snapshotTimestamp} · 대상 주기 {officialDataReadinessBaseline.targetCycleName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openExportPreview('official-data-readiness-baseline-summary', officialDataReadinessBaseline.copyPayloads.summary)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-700 px-3 text-xs font-semibold text-white transition hover:bg-blue-800"
                  >
                    공식 데이터 준비 Baseline 내보내기
                  </button>
                  <button
                    type="button"
                    onClick={() => openExportPreview('official-data-readiness-baseline-markdown', officialDataReadinessBaseline.copyPayloads.markdown)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-800 transition hover:bg-blue-50"
                  >
                    Baseline 마크다운 내보내기
                  </button>
                  <button
                    type="button"
                    onClick={() => openExportPreview('official-data-readiness-baseline-tsv', officialDataReadinessBaseline.copyPayloads.tsv)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-300 bg-white px-3 text-xs font-semibold text-blue-800 transition hover:bg-blue-50"
                  >
                    Baseline TSV 내보내기
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="active employees" value={formatIntegratedSnapshotCount2026(officialDataReadinessBaseline.counts.activeEmployees)} help="대상 범위" compact />
                <MetricCard label="MBO missing" value={formatIntegratedSnapshotCount2026(officialDataReadinessBaseline.counts.mboMissing)} help="P0" compact variant={officialDataReadinessBaseline.counts.mboMissing ? 'warning' : 'default'} />
                <MetricCard label="policyCategory missing" value={formatIntegratedSnapshotCount2026(officialDataReadinessBaseline.counts.policyCategoryMissing)} help="P0" compact variant={officialDataReadinessBaseline.counts.policyCategoryMissing ? 'warning' : 'default'} />
                <MetricCard label="official gate blockers" value={formatIntegratedSnapshotCount2026(officialDataReadinessBaseline.counts.officialGateBlockers)} help="공식 실행 차단" compact variant={officialDataReadinessBaseline.counts.officialGateBlockers ? 'warning' : 'default'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openExportPreview('official-data-readiness-baseline-summary-view', officialDataReadinessBaseline.copyPayloads.summary)}
                  className="inline-flex min-h-9 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-800 transition hover:bg-blue-50"
                >
                  Baseline 요약 보기
                </button>
              </div>
            </div>
          ) : null}

          {isReadinessAdminMode && activation?.officialWriteGuardSummary ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">안전 잠금</Badge>
                    <Badge tone={getOfficialWriteGuardStatusTone2026(activation.officialWriteGuardSummary.overall.status)}>
                      {formatReadinessUiStatus2026(activation.officialWriteGuardSummary.overall.status)}
                    </Badge>
                    <Badge tone="neutral">읽기 전용</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-amber-950">공식 저장 차단 상태</h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
                    공식 평가 생성, 단계 저장, 점수 반영, 등급 반영, 최종 확정이 왜 아직 차단되어 있는지 읽기 전용으로 보여줍니다.
                    이 화면에서는 저장, 제출, 점수 반영, 등급 반영을 실행하지 않습니다.
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800">
                  공식 write API 연결 없음
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {officialWriteGuardRows.map((row) => (
                  <div key={row.key} className="rounded-xl border border-rose-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                      <Badge tone={getOfficialWriteGuardStatusTone2026(row.status)}>{formatReadinessUiStatus2026(row.status)}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      주요 사유: {row.reasons.slice(0, 3).join(', ') || '사유 없음'}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-rose-800">다음 액션: {row.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">인사 운영 요약</Badge>
                  <Badge tone={gatesReady ? 'success' : 'warn'}>{gatesReady ? '공식 전환 준비 확인 필요' : '공식 전환 차단'}</Badge>
                  <Badge tone="neutral">쓰기 없음</Badge>
                </div>
                <h4 className="mt-3 text-lg font-semibold text-emerald-950">2026 평가 운영 요약</h4>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900">
                  HR/인사 관리자가 매일 확인할 항목만 먼저 보여줍니다. 상세 준비 상태, 사전 실행 검토, 실행 절차서, 모니터링 전용 도구는 아래 고급 섹션에 접어 두었습니다.
                </p>
              </div>
              <Link
                href="/evaluation/workbench"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                전용 평가 워크벤치 열기
              </Link>
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-emerald-950">
                2026 연말 평가 · {formatReadinessUiStatus2026(snapshot?.currentStage ?? executionBoard?.summary.currentStage)}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {gatesReady
                  ? '공식 전환 준비 조건 충족 — 사전 검토 진행 가능합니다.'
                  : '공식 전환 차단 조건 있음 — 아래 병목 항목을 먼저 해소하세요.'}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="현재 단계"
                value={formatReadinessUiStatus2026(snapshot?.currentStage ?? executionBoard?.summary.currentStage)}
                help="준비 상태"
                compact
                variant={snapshot?.overallStatus === 'READY_FOR_REVIEW' || snapshot?.overallStatus === 'READY_LATER' ? 'default' : 'warning'}
              />
              <MetricCard
                label="전체 준비 상태"
                value={formatReadinessUiStatus2026(snapshot?.overallStatus ?? executionBoard?.summary.overallReadinessStatus)}
                help="준비 상태 요약"
                compact
                variant={snapshot?.overallStatus === 'READY_FOR_REVIEW' || snapshot?.overallStatus === 'READY_LATER' ? 'default' : 'warning'}
              />
              <MetricCard
                label="진행 판단"
                value={formatReadinessUiStatus2026(dryRunGoNoGoFreezePack?.decision.currentDecision ?? 'NO_GO')}
                help={`실제 반영 ${formatReadinessUiStatus2026(dryRunGoNoGoFreezePack?.decision.applyStatus ?? 'NOT_ALLOWED')}`}
                compact
                variant={dryRunGoNoGoFreezePack?.decision.currentDecision === 'READY_FOR_REVIEW' ? 'default' : 'warning'}
              />
              <MetricCard
                label="공식 전환"
                value={gatesReady ? '준비 확인 필요' : '차단됨'}
                help="실행 버튼 없음"
                compact
                variant={gatesReady ? 'default' : 'warning'}
              />
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="rounded-2xl border border-white/80 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">주요 병목 항목</h5>
                {snapshot?.topBlockers.length ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                      <p className="text-sm font-semibold text-rose-950">{snapshot.topBlockers[0].name} 다수 미해소</p>
                    </div>
                    {snapshot.topBlockers.slice(1, 3).map((blocker) => (
                      <p key={blocker.code} className="text-xs leading-5 text-slate-600">· {blocker.name}</p>
                    ))}
                  </div>
                ) : blockers.length ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                      <p className="text-sm font-semibold text-rose-950">{blockers[0].code} 미해소</p>
                    </div>
                    {blockers.slice(1, 3).map((blocker, index) => (
                      <p key={`${blocker.code}-${index}`} className="text-xs leading-5 text-slate-600">· {blocker.code}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-emerald-800">현재 요약 범위에서는 주요 blocker가 없습니다.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/80 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">관련 화면 바로가기</h5>
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">조치 필요</p>
                  <Link href="/kpi/personal" className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
                    개인 KPI 작성
                  </Link>
                  <Link href="/admin/performance-assignments" className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
                    평가자 배정
                  </Link>
                  <Link href="/kpi/monthly" className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
                    월간 실적
                  </Link>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-500">점검·참조 ▾</summary>
                    <div className="mt-2 grid gap-2">
                      <Link href="/evaluation/workbench" className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
                        전용 평가 워크벤치
                      </Link>
                      <Link href="/admin/evaluation-readiness" className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
                        Baseline / 정책 분류
                      </Link>
                      <Link href="/admin/performance-calendar" className="rounded-xl border border-slate-200 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">
                        평가 일정
                      </Link>
                    </div>
                  </details>
                  <button
                    type="button"
                    onClick={() => snapshot ? void openExportPreview('snapshot-compact-markdown', snapshot.copyPayloads.markdown) : undefined}
                    disabled={!snapshot}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    최신 준비 상태 내보내기
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">다음 액션</h5>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">HR</p>
                    <p>{executionBoard?.summary.nextHrAction ?? snapshot?.nextActions.hr[0]?.detail ?? 'MBO, Team KPI, policyCategory, 평가자 배정을 먼저 확인합니다.'}</p>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">개발/모니터링 ▾</summary>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {executionBoard?.summary.nextDeveloperWatchAction ?? snapshot?.nextActions.developer[0]?.detail ?? '공식 전환/기능 활성화 스위치는 계속 차단 상태로 감시합니다.'}
                    </p>
                  </details>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h5 className="text-sm font-semibold text-amber-950">공식 전환 상태</h5>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-amber-950">
                  진행 판단: {formatReadinessUiStatus2026(dryRunGoNoGoFreezePack?.decision.currentDecision ?? 'NO_GO')}
                </div>
                <div className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-amber-950">
                  실제 반영: {formatReadinessUiStatus2026(dryRunGoNoGoFreezePack?.decision.applyStatus ?? 'NOT_ALLOWED')}
                </div>
                <div className="rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm text-amber-950">
                  공식 전환: {gatesReady ? '준비 확인 필요' : '차단됨'}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-800">
                이 요약에는 사전 실행 검토 실행, 실제 반영, 기존 데이터 채우기, 공식 점수/등급, 기능 활성화 스위치 변경 버튼이 없습니다.
              </p>
            </div>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">기술 용어 참고</h4>
                <Badge tone="neutral">기본 접힘</Badge>
              </div>
            </summary>
            <div className="grid gap-2 border-t border-slate-200 px-4 pb-4 pt-3 text-xs leading-5 text-slate-600 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['공식 저장 점수(totalScore)', '공식 평가 점수 필드'],
                ['공식 저장 등급(gradeId)', '공식 평가 등급 필드'],
                ['기능 활성화 스위치(feature flag)', '공식 기능 켜기/끄기 설정'],
                ['사전 실행 검토(dry-run)', '쓰기 없이 결과를 먼저 확인하는 절차'],
              ].map(([term, meaning]) => (
                <div key={term} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="font-semibold text-slate-900">{term}</span> · {meaning}
                </div>
              ))}
            </div>
          </details>

          <div className="grid gap-3 xl:grid-cols-4">
            {[
              {
                title: '고급 진단 / 준비 상태 상세',
                description: '공식 전환 준비 화면에서 상세 준비 상태를 확인하세요.',
                href: '/admin/evaluation-readiness',
                cta: '상세 준비 상태 열기',
                items: ['통합 준비 상태 스냅샷', '준비 상태 액션 플랜', '실행 보드', '시나리오 시뮬레이터', '등급 기준 준비 상태', '정책 매핑 관리', '평가 미리보기'],
              },
              {
                title: '공식 전환 준비 / 사전 실행 검토 도구',
                description: '공식 전환 준비 화면에서 사전 실행 검토와 사전 점검 도구를 확인하세요.',
                href: '/admin/evaluation-readiness',
                cta: '사전 실행 검토 도구 열기',
                items: ['공식 전환 차단 조건', '준비 상태 대상자 사전 실행 검토', '병렬 운영 현황판', '기존 데이터 채우기 사전 점검', '결과 검토', '리허설 안전장치', '명령 실행 절차서', '진행 가능 여부 판정', '해제 계획'],
              },
              {
                title: '대표/최종 보고',
                description: '공식 전환 준비 화면에서 대표/최종 보고 준비 상태를 확인하세요.',
                href: '/admin/evaluation-readiness',
                cta: '대표/최종 보고 열기',
                items: ['대표이사 보고 패키지', '최종 확정/대표이사 준비 상태', '360/리더십 준비 상태'],
              },
              {
                title: '개발자/모니터링 전용',
                description: '공식 전환 준비 화면에서 모니터링 전용 항목과 금지 작업을 확인하세요.',
                href: '/admin/evaluation-readiness',
                cta: '모니터링 전용 항목 열기',
                items: ['Vercel 로그 감시', '명령 참고 자료', '기능 활성화 스위치 감시', '금지 작업'],
              },
            ].map((group) => (
              <details key={group.title} className="rounded-2xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{group.title}</span>
                    <Badge tone="neutral">기본 접힘</Badge>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                  <p className="text-sm leading-6 text-slate-600">{group.description}</p>
                  <ul className="space-y-1 text-xs leading-5 text-slate-500">
                    {group.items.map((item) => (
                      <li key={`${group.title}-${item}`}>- {item}</li>
                    ))}
                  </ul>
                  <Link href={group.href} className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    {group.cta}
                  </Link>
                </div>
              </details>
            ))}
          </div>

          {!isPerformanceDashboardMode ? (
          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">전체 상세 진단 열기</h4>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    기존 준비 상태, 사전 실행 검토, 실행 절차서, 대표이사 보고, 개발/모니터링 도구는 삭제하지 않고 이 영역 안에 접어 두었습니다.
                  </p>
                </div>
                <Badge tone="neutral">고급 영역 접힘</Badge>
              </div>
            </summary>
            <div className="space-y-4 border-t border-slate-200 bg-white p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={activation.readiness.cycleScope.isOfficialReadinessTarget ? 'success' : 'warn'}>
                {activation.readiness.cycleScope.isOfficialReadinessTarget ? '공식 준비 상태 대상 주기' : '공식 대상 주기 미확정'}
              </Badge>
              <span className="text-sm font-semibold text-slate-900">
                {activation.readiness.cycleScope.selectedCycleName ?? '선택된 공식 평가 주기 없음'}
              </span>
              {activation.readiness.cycleScope.selectedCycleYear ? (
                <span className="text-xs text-slate-400">{activation.readiness.cycleScope.selectedCycleYear}</span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              cycleId {activation.readiness.cycleScope.selectedCycleId ?? '미지정'} · 선택 방식 {activation.readiness.cycleScope.selectionMode}
            </p>
            {activation.readiness.cycleScope.warning ? (
              <div className="mt-3">
                <Banner tone="warn" message={activation.readiness.cycleScope.warning} />
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="공식 전환 차단"
              value={gates.filter((gate) => gate.status === 'BLOCKED').length.toLocaleString()}
              help="공식 실행 전 해소"
              compact
              variant={gates.some((gate) => gate.status === 'BLOCKED') ? 'warning' : 'default'}
            />
            <MetricCard
              label="실행 절차서"
              value={runbook ? runbook.summary.blockedSectionCount.toLocaleString() : '미확인'}
              help={runbook ? `다음 ${runbook.summary.nextExecutableStep}` : '읽기 전용'}
              compact
              variant={(runbook?.summary.blockedSectionCount ?? 1) > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="마이그레이션"
              value={activation.migration.migrationApplied ? '확인' : '미확인'}
              help={activation.migration.requiredSchemaPresent ? '스키마 확인' : '스키마 누락'}
              compact
              variant={activation.migration.migrationApplied ? 'default' : 'warning'}
            />
            <MetricCard
              label="기존 데이터 채우기"
              value={
                activation.flags.backfillApplied
                  ? '적용'
                  : activation.flags.backfillExcluded
                    ? '제외 승인'
                    : '미확인'
              }
              help="명시 flag 필요"
              compact
              variant={activation.flags.backfillApplied || activation.flags.backfillExcluded ? 'default' : 'warning'}
            />
            <MetricCard
              label="공식 기능 스위치"
              value={
                activation.flags.officialScoringEnabled &&
                activation.flags.officialGradeEnabled &&
                activation.flags.aiScoreExclusionEnabled
                  ? '승인'
                  : '대기'
              }
              help="점수/등급/AI"
              compact
              variant={
                activation.flags.officialScoringEnabled &&
                activation.flags.officialGradeEnabled &&
                activation.flags.aiScoreExclusionEnabled
                  ? 'default'
                  : 'warning'
              }
            />
            <MetricCard
              label="HR 승인"
              value={activation.flags.hrApprovalConfirmed ? '확인' : '대기'}
              help="명시 승인 스위치"
              compact
              variant={activation.flags.hrApprovalConfirmed ? 'default' : 'warning'}
            />
            <MetricCard
              label="360/리더십"
              value={activation.feedbackLeadershipReadiness?.summary.blockedOrNeedsSetupCount.toLocaleString() ?? '미확인'}
              help="준비 상태 차단 조건"
              compact
              variant={
                (activation.feedbackLeadershipReadiness?.summary.blockedOrNeedsSetupCount ?? 1) > 0
                  ? 'warning'
                  : 'default'
              }
            />
            <MetricCard
              label="리더 평가"
              value={activation.leaderEvaluationReadiness?.summary.blockerCount.toLocaleString() ?? '미확인'}
              help="준비 상태 차단 조건"
              compact
              variant={(activation.leaderEvaluationReadiness?.summary.blockerCount ?? 1) > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="최종/CEO"
              value={activation.finalizationCeoReadiness?.summary.finalizationBlockerCount.toLocaleString() ?? '미확인'}
              help={`CEO ${activation.finalizationCeoReadiness?.summary.ceoConfirmationBlockerCount.toLocaleString() ?? '미확인'} · calibration ${activation.finalizationCeoReadiness?.summary.calibrationReadinessBlockerCount.toLocaleString() ?? '미확인'}`}
              compact
              variant={(activation.finalizationCeoReadiness?.summary.finalizationBlockerCount ?? 1) > 0 ? 'warning' : 'default'}
            />
            {executionBoard ? (
              <>
                <MetricCard
                  label="열린 액션 보드"
                  value={executionBoard.summary.totalOpenActionCount.toLocaleString()}
                  help={`P0 ${executionBoard.summary.p0Count.toLocaleString()} · 실행 버튼 없음`}
                  compact
                  variant={executionBoard.summary.p0Count > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="다음 인사 액션"
                  value={executionBoard.summary.nextHrAction}
                  help="읽기 전용 추적"
                  compact
                  variant="warning"
                />
                <MetricCard
                  label="다음 개발/모니터링"
                  value={executionBoard.summary.nextDeveloperWatchAction}
                  help={executionBoard.summary.lastBaselineTimestamp ?? '기준선 내보내기 전용'}
                  compact
                  variant="muted"
                />
              </>
            ) : null}
            {ceoReportPack ? (
              <>
                <MetricCard
                  label="대표이사 보고 패키지"
                  value={ceoReportPack.reportStatus}
                  help="읽기 전용 보고"
                  compact
                  variant="default"
                />
                <MetricCard
                  label="대표이사 확인 목표"
                  value="HR blocker order"
                  help={ceoReportPack.summary.officialActivationStatus}
                  compact
                  variant={ceoReportPack.summary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {fastForwardOperationsCockpit ? (
              <>
                <MetricCard
                  label="병렬 운영"
                  value={fastForwardOperationsCockpit.fastForwardSummary.parallelWorkstreamCount.toLocaleString()}
                  help="병렬 작업 흐름"
                  compact
                  variant="default"
                />
                <MetricCard
                  label="핵심 진행 경로"
                  value={fastForwardOperationsCockpit.fastForwardSummary.criticalPathItemCount.toLocaleString()}
                  help={fastForwardOperationsCockpit.fastForwardSummary.nextCheckpointCondition}
                  compact
                  variant={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {backfillDryRunPreflightPack ? (
              <>
                <MetricCard
                  label="기존 데이터 사전 점검"
                  value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus)}
                  help={`실제 반영 ${formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus)}`}
                  compact
                  variant={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus === 'BLOCKED' ? 'warning' : 'default'}
                />
                <MetricCard
                  label="누락된 선행 조건"
                  value={backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount.toLocaleString()}
                  help={backfillDryRunPreflightPack.preflightSummary.nextPreflightAction}
                  compact
                  variant={backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount > 0 ? 'warning' : 'default'}
                />
              </>
            ) : null}
            {dryRunOutputReviewTemplate ? (
              <MetricCard
                label="사전 실행 결과 검토 양식"
                value={formatReadinessUiStatus2026(dryRunOutputReviewTemplate.templateStatus)}
                help={formatReadinessUiStatus2026(dryRunOutputReviewTemplate.templateSummary.localOnlyPasteHelperStatus)}
                compact
                variant="default"
              />
            ) : null}
            {dryRunRehearsalGuardrails ? (
              <MetricCard
                label="사전 실행 리허설"
                value={formatReadinessUiStatus2026(dryRunRehearsalGuardrails.status)}
                help={formatReadinessUiStatus2026(dryRunRehearsalGuardrails.summary.applyStatus)}
                compact
                variant="default"
              />
            ) : null}
            {backfillDryRunCommandRunbook ? (
              <MetricCard
                label="사전 실행 명령 절차서"
                value={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.commandReferenceStatus)}
                help={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.applyStatus)}
                compact
                variant="warning"
              />
            ) : null}
            {dryRunGoNoGoFreezePack ? (
              <MetricCard
                label="사전 실행 진행 판단"
                value={formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.decision.currentDecision)}
                help={`실제 반영 ${formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.decision.applyStatus)}`}
                compact
                variant={dryRunGoNoGoFreezePack.decision.currentDecision === 'READY_FOR_REVIEW' ? 'default' : 'warning'}
              />
            ) : null}
            {endToEndPilot2026 ? (
              <MetricCard
                label="전체 흐름 미리보기"
                value={formatReadinessUiStatus2026(endToEndPilot2026.summary.currentDecision)}
                help={`${endToEndPilot2026.summary.previewCompletenessPercentage}% 미리보기 · ${endToEndPilot2026.summary.hardBlockedStepCount}개 완전 차단`}
                compact
                variant={endToEndPilot2026.summary.hardBlockedStepCount > 0 ? 'warning' : 'default'}
              />
            ) : null}
          </div>

          {snapshot ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 통합 준비 상태 요약</h4>
                    <Badge tone={getIntegratedReadinessStatusTone2026(snapshot.overallStatus)}>
                      {formatReadinessUiStatus2026(snapshot.overallStatus)}
                    </Badge>
                    <Badge tone="neutral">{snapshot.currentStage}</Badge>
                    <Badge tone="neutral">읽기 전용 보고</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 2026 공식 전환 준비 상태를 읽기 전용으로 요약합니다. 기존 데이터 채우기, 공식 점수, 공식 등급, 기능 활성화 스위치는 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['snapshot-executive', '경영요약', snapshot.copyPayloads.executiveSummary],
                    ['snapshot-hr', '인사 액션', snapshot.copyPayloads.hrActionList],
                    ['snapshot-dev', '개발/모니터링 액션', snapshot.copyPayloads.developerActionList],
                    ['snapshot-blockers', '해소 필요 항목 요약', snapshot.copyPayloads.blockerSummary],
                    ['snapshot-prohibited', '금지 목록', snapshot.copyPayloads.prohibitedActions],
                    ['snapshot-markdown', '마크다운 보기', snapshot.copyPayloads.markdown],
                    ['snapshot-tsv', 'TSV 보기', snapshot.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  label="재직자"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.activeEmployeeCount)}
                  help="대상 범위"
                  compact
                />
                <MetricCard
                  label="확정 KPI"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.confirmedPersonalKpiCount)}
                  help={snapshot.completionRates.mboConfirmedRate == null ? 'rate 미확인' : `${snapshot.completionRates.mboConfirmedRate}%`}
                  compact
                />
                <MetricCard
                  label="MBO 미작성"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.missingMboCount)}
                  help="작성 필요"
                  compact
                  variant={(snapshot.summary.missingMboCount ?? 1) > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="정책 분류"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.policyCategoryMissingCount)}
                  help="미분류"
                  compact
                  variant={(snapshot.summary.policyCategoryMissingCount ?? 1) > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="평가자 배정 차단"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.evaluatorRoutingBlockerCount)}
                  help="평가자 배정"
                  compact
                  variant={(snapshot.summary.evaluatorRoutingBlockerCount ?? 1) > 0 ? 'warning' : 'default'}
                />
                <MetricCard
                  label="공식 전환 조건"
                  value={formatIntegratedSnapshotCount2026(snapshot.summary.officialActivationGateBlockerCount)}
                  help="공식 전환"
                  compact
                  variant={(snapshot.summary.officialActivationGateBlockerCount ?? 1) > 0 ? 'warning' : 'default'}
                />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-sm font-semibold text-amber-950">주요 해소 필요 항목</h5>
                  {snapshot.topBlockers.length ? (
                    <ul className="mt-3 space-y-2">
                      {snapshot.topBlockers.slice(0, 8).map((blocker) => (
                        <li key={blocker.code} className="text-sm leading-6 text-amber-950">
                          <span className="font-semibold">{blocker.name}</span> · {blocker.count.toLocaleString()}건
                          <div className="text-xs text-amber-800">{blocker.sourcePanel} · {blocker.relatedRoute}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-emerald-800">현재 통합 요약 기준 주요 해소 필요 항목이 없습니다.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">다음 액션</h5>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">HR</p>
                      <ul className="mt-1 space-y-1">
                        {snapshot.nextActions.hr.slice(0, 4).map((action) => (
                          <li key={`${action.label}-${action.route}`}>- {action.label}: {action.detail}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">개발/모니터링</p>
                      <ul className="mt-1 space-y-1">
                        {snapshot.nextActions.developer.map((action) => (
                          <li key={`${action.label}-${action.route}`}>- {action.label}: {action.detail}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">경영진 요약</h5>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{snapshot.executiveReportText}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">판정 준비 상태</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">판정</th>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">상태</th>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">해소 필요</th>
                          <th className="whitespace-nowrap px-2 py-2 font-semibold">다음 액션</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {snapshot.decisionReadiness.map((decision) => (
                          <tr key={decision.id}>
                            <td className="min-w-44 px-2 py-2 font-semibold text-slate-900">{decision.label}</td>
                            <td className="px-2 py-2">
                              <Badge tone={getIntegratedReadinessStatusTone2026(decision.status)}>{formatReadinessUiStatus2026(decision.status)}</Badge>
                            </td>
                            <td className="px-2 py-2">{decision.blockerCount.toLocaleString()}건</td>
                            <td className="min-w-72 px-2 py-2">{decision.nextAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">공식 전환 상태</h5>
                  <div className="mt-3 grid gap-2">
                    {snapshot.activationState.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                          <Badge tone={getIntegratedReadinessStatusTone2026(item.status)}>{formatReadinessUiStatus2026(item.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          해소 필요 {item.blockerCount.toLocaleString()}건 · {item.nextAction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                <p className="mt-2 text-sm leading-6 text-rose-900">{snapshot.prohibitedActions.join(', ')}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 통합 준비 상태 요약</h4>
                    <Badge tone="neutral">{loading ? '불러오는 중' : '미확인'}</Badge>
                    <Badge tone="neutral">읽기 전용 보고</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    공식 전환 조건 데이터를 불러오면 현재 단계, 전체 준비 상태, 주요 해소 필요 항목,
                    공식 전환 상태, 판정 준비 상태, 금지 작업과 복사/내보내기 버튼이 표시됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLoad}
                  disabled={loading}
                  className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  {loading ? '요약 불러오는 중...' : '요약 다시 불러오기'}
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="현재 단계" value="미확인" help="공식 전환 준비 상태 불러오기 필요" compact variant="muted" />
                <MetricCard label="전체 준비 상태" value="미확인" help="공식 전환 준비 상태 불러오기 필요" compact variant="muted" />
                <MetricCard label="주요 해소 필요 항목" value="미확인" help="요약 대기" compact variant="muted" />
                <MetricCard label="공식 전환 상태" value="미확인" help="읽기 전용 조건 대기" compact variant="muted" />
              </div>
            </div>
          )}

          {actionPlan ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 준비 상태 액션 계획</h4>
                    <Badge tone="neutral">{actionPlan.currentStage}</Badge>
                    <Badge tone={getIntegratedReadinessStatusTone2026(actionPlan.overallStatus)}>
                      {formatReadinessUiStatus2026(actionPlan.overallStatus)}
                    </Badge>
                    <Badge tone="neutral">읽기 전용 보드</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 준비 상태 해소 필요 항목을 실행 항목으로 정리하는 읽기 전용 보드입니다.
                    알림 발송, 저장, 기존 데이터 채우기, 공식 점수/등급 변경은 수행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['action-hr', '인사 계획', actionPlan.copyPayloads.hrActionPlan],
                    ['action-leader', '리더 계획', actionPlan.copyPayloads.leaderActionPlan],
                    ['action-employee', '직원 계획', actionPlan.copyPayloads.employeeActionPlan],
                    ['action-dev', '개발/모니터링', actionPlan.copyPayloads.developerWatchPlan],
                    ['action-full', '전체 보드 보기', actionPlan.copyPayloads.fullActionBoard],
                    ['action-markdown', '마크다운 보기', actionPlan.copyPayloads.markdown],
                    ['action-tsv', 'TSV 보기', actionPlan.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-sm font-semibold text-blue-950">이번 주 집중 항목</h5>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {actionPlan.thisWeekFocus.map((item) => (
                    <div key={item.id} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                        <Badge tone="neutral">{item.ownerGroup}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.relatedBlockerCount == null ? 'blocker 미확인' : `${item.relatedBlockerCount.toLocaleString()}건`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-4">
                {[
                  ['HR', actionPlan.actionGroups.hr],
                  ['리더', actionPlan.actionGroups.leader],
                  ['직원', actionPlan.actionGroups.employee],
                  ['개발/운영', actionPlan.actionGroups.developer],
                ].map(([label, items]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{label as string}</h5>
                    <div className="mt-3 space-y-2">
                      {(items as typeof actionPlan.actionGroups.hr).slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                          <Badge tone={getReadinessActionStatusTone2026(item.status)}>{formatReadinessUiStatus2026(item.status)}</Badge>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {item.relatedBlockerCount == null ? '해소 필요 항목 미확인' : `${item.relatedBlockerCount.toLocaleString()}건`} · {item.relatedRoute}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">액션 보고</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{actionPlan.reportText}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{actionPlan.prohibitedActions.join(', ')}</p>
                </div>
              </div>
            </div>
          ) : null}

          {executionBoard ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 준비 상태 실행 보드</h4>
                    <Badge tone={getIntegratedReadinessStatusTone2026(executionBoard.summary.overallReadinessStatus)}>
                      {formatReadinessUiStatus2026(executionBoard.summary.overallReadinessStatus)}
                    </Badge>
                    <Badge tone={executionBoard.summary.officialActivationStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      {formatReadinessUiStatus2026(executionBoard.summary.officialActivationStatus)}
                    </Badge>
                    <Badge tone="neutral">내보내기 전용</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 준비 상태 실행 항목을 운영 관리하기 위한 보드입니다.
                    공식 점수, 등급, 기존 데이터 채우기, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 변경하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['execution-full', '전체 보드 보기', executionBoard.copyPayloads.fullBoard],
                    ['execution-week', '이번 주 항목 보기', executionBoard.copyPayloads.thisWeekFocus],
                    ['execution-hr', '인사 액션 보기', executionBoard.copyPayloads.hrActionList],
                    ['execution-leader', '리더 액션 보기', executionBoard.copyPayloads.leaderActionList],
                    ['execution-employee', '직원 액션 보기', executionBoard.copyPayloads.employeeActionList],
                    ['execution-dev', '개발/모니터링 보기', executionBoard.copyPayloads.developerWatchList],
                    ['execution-report', '경영진 요약 보기', executionBoard.copyPayloads.executiveWeeklyReport],
                    ['execution-prohibited', '금지 작업 보기', executionBoard.copyPayloads.prohibitedActions],
                    ['execution-markdown', '마크다운 보기', executionBoard.copyPayloads.markdown],
                    ['execution-tsv', 'TSV 보기', executionBoard.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 단계" value={executionBoard.summary.currentStage} help="요약 단계" compact />
                <MetricCard label="열린 액션" value={executionBoard.summary.totalOpenActionCount.toLocaleString()} help="DONE 제외" compact />
                <MetricCard label="P0 / P1 / P2" value={`${executionBoard.summary.p0Count}/${executionBoard.summary.p1Count}/${executionBoard.summary.p2Count}`} help="우선순위" compact variant={executionBoard.summary.p0Count > 0 ? 'warning' : 'default'} />
                <MetricCard label="HR / 리더 / 직원 / DEV" value={`${executionBoard.summary.hrActionCount}/${executionBoard.summary.leaderActionCount}/${executionBoard.summary.employeeActionCount}/${executionBoard.summary.developerWatchActionCount}`} help="owner group" compact />
                <MetricCard label="차단 / 준비 / 모니터링" value={`${executionBoard.summary.blockedActionCount}/${executionBoard.summary.readyToStartActionCount}/${executionBoard.summary.watchOnlyActionCount}`} help="상태" compact variant={executionBoard.summary.blockedActionCount > 0 ? 'warning' : 'default'} />
                <MetricCard label="기준선" value={executionBoard.summary.lastBaselineTimestamp ?? '내보내기 전용'} help={executionBoard.summary.lastReviewedTimestamp ?? '최종 검토 없음'} compact variant="muted" />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold text-blue-950">기준선 요약 지원</h5>
                    <p className="mt-1 text-sm leading-6 text-blue-900">{executionBoard.baselineSnapshot.guidance}</p>
                  </div>
                  <Badge tone="neutral">save button 없음</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">요약 시각</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{executionBoard.baselineSnapshot.timestamp}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">메타데이터 추적</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {executionBoard.metadataTracking.enabled ? '활성' : '내보내기 전용'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">변화량</p>
                    <p className="mt-1 text-sm leading-5 text-slate-700">{executionBoard.baselineSnapshot.deltaFromPreviousBaseline[0]}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ['ALL', '전체'],
                  ['THIS_WEEK', '이번 주 집중'],
                  ['HR', 'HR'],
                  ['LEADER', '리더'],
                  ['EMPLOYEE', '직원'],
                  ['DEV', '개발/모니터링'],
                  ['DONE_HOLD', '완료/보류'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setExecutionBoardTab(key as typeof executionBoardTab)}
                    className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                      executionBoardTab === key
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {executionBoardActions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                      <Badge tone="neutral">{item.ownerGroup}</Badge>
                      <Badge tone={getReadinessActionStatusTone2026(item.status)}>{formatReadinessUiStatus2026(item.status)}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {item.sourcePanel} · {item.relatedRoute}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                    <div className="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-slate-500">해소 필요 항목</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {item.relatedBlockerCount == null ? '미확인' : `${item.relatedBlockerCount.toLocaleString()}건`}
                      </p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{item.suggestedNextStep}</p>
                    {item.suggestedCommunicationCopy ? (
                      <button
                        type="button"
                        onClick={() => void openExportPreview(`execution-copy-${item.id}`, item.suggestedCommunicationCopy ?? '')}
                        className="mt-3 inline-flex min-h-8 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white"
                      >
                        {copiedRunbookKey === `execution-copy-${item.id}` ? '복사됨' : '안내문 복사'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">사용 가능한 필터</h5>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ...executionBoard.filters.ownerGroups,
                      ...executionBoard.filters.priorities,
                      ...executionBoard.filters.statuses,
                      ...executionBoard.filters.actionTypes.slice(0, 8),
                    ].map((filter) => (
                      <Badge key={filter} tone="neutral">{filter}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">인사 안내문 패키지</h5>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {executionBoard.communicationTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => void openExportPreview(`comm-${template.id}`, template.copy)}
                        className="inline-flex min-h-8 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {copiedRunbookKey === `comm-${template.id}` ? '복사됨' : template.title}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">메타데이터 설계 메모</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{executionBoard.metadataTracking.reason}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">경영진 주간 요약</h5>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{executionBoard.executiveWeeklyReportText}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{executionBoard.prohibitedActions.join(', ')}</p>
                </div>
              </div>
            </div>
          ) : null}

          {fastForwardOperationsCockpit ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 병렬 운영 현황판</h4>
                    <Badge tone="neutral">{formatReadinessUiStatus2026(fastForwardOperationsCockpit.mode)}</Badge>
                    <Badge tone={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      {formatReadinessUiStatus2026(fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus)}
                    </Badge>
                    <Badge tone="neutral">복사/내보내기 전용</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 2026 평가 운영을 병렬로 앞당기기 위한 읽기 전용 실행 지도입니다.
                    기존 데이터 채우기, 공식 점수, 공식 등급, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['fast-forward-summary', '병렬 운영 요약', fastForwardOperationsCockpit.copyPayloads.fastForwardSummary],
                    ['fast-forward-critical-path', '핵심 진행 경로', fastForwardOperationsCockpit.copyPayloads.criticalPath],
                    ['fast-forward-quick-wins', '빠른 정리 항목', fastForwardOperationsCockpit.copyPayloads.quickWins],
                    ['fast-forward-owner-queues', '담당자별 액션', fastForwardOperationsCockpit.copyPayloads.ownerActionQueues],
                    ['fast-forward-safe-path', '최소 안전 진행 조건', fastForwardOperationsCockpit.copyPayloads.minimumSafePath],
                    ['fast-forward-prohibited', '금지 작업', fastForwardOperationsCockpit.copyPayloads.prohibitedActions],
                    ['fast-forward-full', '전체 운영 계획', fastForwardOperationsCockpit.copyPayloads.fullOperationsPlan],
                    ['fast-forward-markdown', '마크다운 보기', fastForwardOperationsCockpit.copyPayloads.markdown],
                    ['fast-forward-tsv', 'TSV 보기', fastForwardOperationsCockpit.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 단계" value={fastForwardOperationsCockpit.fastForwardSummary.currentStage} help="준비 상태 단계" compact />
                <MetricCard label="전체 상태" value={formatReadinessUiStatus2026(fastForwardOperationsCockpit.fastForwardSummary.overallReadinessStatus)} help="요약 상태" compact />
                <MetricCard label="공식 전환" value={formatReadinessUiStatus2026(fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus)} help="공식 전환 조건" compact variant={fastForwardOperationsCockpit.fastForwardSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="병렬 / 차단" value={`${fastForwardOperationsCockpit.fastForwardSummary.parallelWorkstreamCount}/${fastForwardOperationsCockpit.fastForwardSummary.blockedWorkstreamCount}`} help="작업 흐름" compact />
                <MetricCard label="빠른 정리 항목" value={fastForwardOperationsCockpit.fastForwardSummary.quickWinCount.toLocaleString()} help={fastForwardOperationsCockpit.fastForwardSummary.fastestSafeNextProcess} compact />
                <MetricCard label="핵심 진행 경로" value={fastForwardOperationsCockpit.fastForwardSummary.criticalPathItemCount.toLocaleString()} help={fastForwardOperationsCockpit.fastForwardSummary.nextCheckpointCondition} compact variant="warning" />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-sm font-semibold text-blue-950">한국어 운영 계획</h5>
                <p className="mt-3 text-sm leading-6 text-blue-900">{fastForwardOperationsCockpit.operationsPlanText}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">현재 병목</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{fastForwardOperationsCockpit.fastForwardSummary.currentBottleneck}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">가장 빠른 안전 다음 단계</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{fastForwardOperationsCockpit.fastForwardSummary.fastestSafeNextProcess}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">병렬 작업 흐름</h5>
                  <div className="mt-3 grid gap-3">
                    {fastForwardOperationsCockpit.parallelWorkstreams.map((workstream) => (
                      <div key={workstream.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{formatReadinessUiStatus2026(workstream.status)}</Badge>
                          {workstream.owners.map((owner) => <Badge key={owner} tone="neutral">{owner}</Badge>)}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{workstream.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{workstream.relatedRoutes.join(', ')}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{workstream.expectedOutput}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {workstream.inputs.slice(0, 3).map((input) => (
                            <span key={`${workstream.id}-${input.label}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                              {input.label}: {typeof input.value === 'number' ? input.value.toLocaleString() : input.value ?? '미확인'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-sm font-semibold text-amber-950">차단 / 추후 진행 작업 흐름</h5>
                  <div className="mt-3 grid gap-3">
                    {fastForwardOperationsCockpit.blockedWorkstreams.map((workstream) => (
                      <div key={workstream.id} className="rounded-xl border border-amber-100 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="warn">{formatReadinessUiStatus2026(workstream.status)}</Badge>
                          {workstream.owners.map((owner) => <Badge key={owner} tone="neutral">{owner}</Badge>)}
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{workstream.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{workstream.blockedReason ?? workstream.expectedOutput}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">핵심 진행 경로</h5>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">순서</th>
                        <th className="px-3 py-2">항목</th>
                        <th className="px-3 py-2">상태</th>
                        <th className="px-3 py-2">담당</th>
                        <th className="px-3 py-2">다음 액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fastForwardOperationsCockpit.criticalPath.map((item) => (
                        <tr key={item.order}>
                          <td className="px-3 py-2 font-semibold text-slate-700">{item.order}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{item.title}</td>
                          <td className="px-3 py-2 text-slate-600">{formatReadinessUiStatus2026(item.status)}</td>
                          <td className="px-3 py-2 text-slate-600">{item.owner}</td>
                          <td className="px-3 py-2 text-slate-600">{item.nextAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">빠른 정리 항목</h5>
                  <div className="mt-3 grid gap-3">
                    {fastForwardOperationsCockpit.quickWins.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <Badge tone="neutral">{item.owner}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          해소 필요 {formatIntegratedSnapshotCount2026(item.blockerCount)} · {item.route}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">사전 실행 검토까지 최소 안전 진행 조건</h5>
                  <div className="mt-3 grid gap-2">
                    {fastForwardOperationsCockpit.minimumSafePathToBackfillDryRunReview.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <Badge tone={item.status === 'DONE' ? 'success' : item.status === 'READY_FOR_REVIEW' ? 'neutral' : 'warn'}>{formatReadinessUiStatus2026(item.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          해소 필요 {formatIntegratedSnapshotCount2026(item.blockerCount)} · {item.nextAction}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-4">
                {[
                  ['HR', fastForwardOperationsCockpit.ownerActionQueues.hr],
                  ['리더', fastForwardOperationsCockpit.ownerActionQueues.leader],
                  ['직원', fastForwardOperationsCockpit.ownerActionQueues.employee],
                  ['개발/모니터링', fastForwardOperationsCockpit.ownerActionQueues.developer],
                ].map(([label, items]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{label as string} 액션 목록</h5>
                    <div className="mt-3 space-y-2">
                      {(items as typeof fastForwardOperationsCockpit.ownerActionQueues.hr).map((item) => (
                        <div key={`${label}-${item.title}`} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getReadinessActionPriorityTone2026(item.priority)}>{item.priority}</Badge>
                            <span className="text-xs text-slate-400">{formatIntegratedSnapshotCount2026(item.blockerCount)}건</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{item.route} · {item.dependency}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">의존 관계 지도</h5>
                  <div className="mt-3 space-y-2">
                    {fastForwardOperationsCockpit.dependencyMap.map((item) => (
                      <div key={`${item.from}-${item.to}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.from} → {item.to}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">화면별 액션 지도</h5>
                  <div className="mt-3 space-y-2">
                    {fastForwardOperationsCockpit.routeActionMap.map((item) => (
                      <div key={item.route} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.route}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.actions.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{fastForwardOperationsCockpit.prohibitedActions.join(', ')}</p>
                  <p className="mt-3 text-xs leading-5 text-rose-800">{fastForwardOperationsCockpit.metadataTracking.reason}</p>
                </div>
              </div>
            </div>
          ) : null}

          {backfillDryRunPreflightPack ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 기존 데이터 채우기 사전 점검</h4>
                    <Badge tone="neutral">{formatReadinessUiStatus2026(backfillDryRunPreflightPack.mode)}</Badge>
                    <Badge tone={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      사전 실행 검토 {formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus)}
                    </Badge>
                    <Badge tone="warn">실제 반영 {formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus)}</Badge>
                    <Badge tone="neutral">텍스트 명령 참고</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 기존 데이터 채우기 사전 실행 검토를 준비하기 위한 읽기 전용 사전 점검입니다.
                    사전 실행 검토, 실제 반영, 공식 점수, 공식 등급, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['backfill-preflight-summary', '사전 점검 요약', backfillDryRunPreflightPack.copyPayloads.preflightSummary],
                    ['backfill-preflight-preconditions', '선행 조건', backfillDryRunPreflightPack.copyPayloads.preconditionsChecklist],
                    ['backfill-preflight-command', '사전 실행 명령 참고', backfillDryRunPreflightPack.copyPayloads.dryRunCommandReference],
                    ['backfill-preflight-output', '예상 결과', backfillDryRunPreflightPack.copyPayloads.expectedOutputChecklist],
                    ['backfill-preflight-backup', 'DB 백업', backfillDryRunPreflightPack.copyPayloads.dbBackupChecklist],
                    ['backfill-preflight-hr', 'HR 승인', backfillDryRunPreflightPack.copyPayloads.hrApprovalChecklist],
                    ['backfill-preflight-dev', '개발자 점검 목록', backfillDryRunPreflightPack.copyPayloads.developerExecutionChecklist],
                    ['backfill-preflight-prohibited', '금지 작업', backfillDryRunPreflightPack.copyPayloads.prohibitedActions],
                    ['backfill-preflight-markdown', '마크다운 보기', backfillDryRunPreflightPack.copyPayloads.markdown],
                    ['backfill-preflight-tsv', 'TSV 보기', backfillDryRunPreflightPack.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 단계" value={backfillDryRunPreflightPack.preflightSummary.currentStage} help="준비 상태 단계" compact />
                <MetricCard label="전체 상태" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.overallReadinessStatus)} help="스냅샷 상태" compact />
                <MetricCard label="공식 전환" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.officialActivationStatus)} help="공식 전환 차단 조건" compact variant={backfillDryRunPreflightPack.preflightSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="사전 실행 검토" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus)} help="사전 점검 상태" compact variant={backfillDryRunPreflightPack.preflightSummary.backfillDryRunReviewStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="실제 반영 상태" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.backfillApplyStatus)} help="실제 반영 차단 유지" compact variant="warning" />
                <MetricCard label="차단/누락" value={`${backfillDryRunPreflightPack.preflightSummary.blockerCount.toLocaleString()}/${backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount.toLocaleString()}`} help="선행 조건" compact variant={backfillDryRunPreflightPack.preflightSummary.missingPreconditionsCount > 0 ? 'warning' : 'default'} />
                <MetricCard label="DB 백업" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.dbBackupStatus)} help="외부 확인 전용" compact variant="warning" />
                <MetricCard label="HR 승인" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.hrApprovalStatus)} help="사전 실행 검토 전용" compact variant="warning" />
                <MetricCard label="공식 스위치" value={formatReadinessUiStatus2026(backfillDryRunPreflightPack.preflightSummary.officialFlagsStatus)} help="false 유지 필요" compact variant="warning" />
                {dryRunOutputReviewTemplate ? (
                  <MetricCard label="검토 양식" value={dryRunOutputReviewTemplate.templateStatus} help="로컬 전용 결과 검토" compact />
                ) : null}
                <MetricCard label="다음 사전 점검 액션" value={backfillDryRunPreflightPack.preflightSummary.nextPreflightAction} help="UI 실행 없음" compact variant="muted" />
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h5 className="text-sm font-semibold text-amber-950">명령 템플릿은 텍스트 참고 전용</h5>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  복사 전용 참고문이며 UI에서 사전 실행 검토, 실제 반영, 기존 데이터 채우기 실제 반영을 실행하지 않습니다.
                  운영 실제 반영 명령은 UI에 배치하지 않습니다.
                </p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {backfillDryRunPreflightPack.commandTemplates.map((command) => (
                    <div key={command.id} className="rounded-xl border border-amber-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{command.label}</p>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(command.mode)}</Badge>
                        <Badge tone={command.executeAvailable ? 'error' : 'neutral'}>
                          실행 가능 {String(command.executeAvailable)}
                        </Badge>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-50">{command.commandText}</pre>
                      <p className="mt-2 text-xs leading-5 text-amber-800">{command.warning}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">선행 조건 점검 목록</h5>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {backfillDryRunPreflightPack.preconditionsChecklist.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={item.status === 'READY_FOR_REVIEW' ? 'success' : item.status === 'READY_LATER' ? 'neutral' : 'warn'}>{formatReadinessUiStatus2026(item.status)}</Badge>
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          해소 필요 {item.sourceBlockerCount == null ? '미확인' : item.sourceBlockerCount.toLocaleString()} · {item.relatedRoute}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">예상 사전 실행 결과 점검 목록</h5>
                    <div className="mt-3 space-y-2">
                      {backfillDryRunPreflightPack.expectedOutputChecklist.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{item.expectedReview}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">필수값: {item.requiredValue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{backfillDryRunPreflightPack.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                {[
                  ['DB 백업 점검 목록', backfillDryRunPreflightPack.backupChecklist],
                  ['HR 승인 점검 목록', backfillDryRunPreflightPack.hrApprovalChecklist],
                  ['개발자 실행 전 점검 목록', backfillDryRunPreflightPack.developerExecutionChecklist],
                  ['사후 점검 목록', backfillDryRunPreflightPack.postCheckChecklist],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{title as string}</h5>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                      {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-semibold text-slate-900">기존 사전 실행/실제 반영 표면 확인</h5>
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">사전 실행 스크립트</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                      {backfillDryRunPreflightPack.existingSurface.existingDryRunScripts.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">실제 반영 표면</p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                      {backfillDryRunPreflightPack.existingSurface.existingApplyScripts.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">안전 분리</p>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      쓰기 없는 사전 실행만 가능: {String(backfillDryRunPreflightPack.existingSurface.dryRunOnlyWithoutWritesAvailable)}
                      <br />
                      실제 반영과 사전 실행 분리: {String(backfillDryRunPreflightPack.existingSurface.applySeparatedFromDryRun)}
                      <br />
                      공식 저장 점수(totalScore) 쓰기: {String(backfillDryRunPreflightPack.existingSurface.writesTotalScore)}
                      <br />
                      공식 저장 등급(gradeId) 쓰기: {String(backfillDryRunPreflightPack.existingSurface.writesGradeId)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {dryRunOutputReviewTemplate ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 사전 실행 결과 검토 양식</h4>
                    <Badge tone="neutral">{formatReadinessUiStatus2026(dryRunOutputReviewTemplate.mode)}</Badge>
                    <Badge tone="neutral">{dryRunOutputReviewTemplate.templateStatus}</Badge>
                    <Badge tone="neutral">로컬 붙여넣기 도구</Badge>
                    <Badge tone="warn">실제 반영 {formatReadinessUiStatus2026(dryRunOutputReviewTemplate.templateSummary.applyStatus)}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 향후 사전 실행 결과를 검토하기 위한 읽기 전용 양식입니다.
                    사전 실행 검토, 실제 반영, 기존 데이터 채우기, 공식 점수, 공식 등급, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['dryrun-output-template', '사전 실행 검토 양식', dryRunOutputReviewTemplate.copyPayloads.reviewTemplate],
                    ['dryrun-output-must-pass', '필수 통과 기준', dryRunOutputReviewTemplate.copyPayloads.mustPassCriteria],
                    ['dryrun-output-red-flags', '위험 신호', dryRunOutputReviewTemplate.copyPayloads.redFlags],
                    ['dryrun-output-hr', 'HR 검토 목록', dryRunOutputReviewTemplate.copyPayloads.hrReviewChecklist],
                    ['dryrun-output-dev', '개발자 검토 목록', dryRunOutputReviewTemplate.copyPayloads.developerReviewChecklist],
                    ['dryrun-output-decision', '판정 결과 가이드', dryRunOutputReviewTemplate.copyPayloads.decisionOutcomeGuide],
                    ['dryrun-output-next-action', '다음 액션 매핑', dryRunOutputReviewTemplate.copyPayloads.nextActionMapping],
                    ['dryrun-output-markdown', '마크다운 보기', dryRunOutputReviewTemplate.copyPayloads.markdown],
                    ['dryrun-output-tsv', 'TSV 보기', dryRunOutputReviewTemplate.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 단계" value={dryRunOutputReviewTemplate.templateSummary.currentStage} help="준비 상태 단계" compact />
                <MetricCard label="전체 상태" value={formatReadinessUiStatus2026(dryRunOutputReviewTemplate.templateSummary.overallReadinessStatus)} help="스냅샷 상태" compact />
                <MetricCard label="공식 전환" value={formatReadinessUiStatus2026(dryRunOutputReviewTemplate.templateSummary.officialActivationStatus)} help="공식 전환 차단 조건" compact variant={dryRunOutputReviewTemplate.templateSummary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="사전 점검 상태" value={formatReadinessUiStatus2026(dryRunOutputReviewTemplate.templateSummary.preflightStatus)} help="사전 실행 결과는 향후 입력" compact variant={dryRunOutputReviewTemplate.templateSummary.preflightStatus === 'BLOCKED' ? 'warning' : 'default'} />
                <MetricCard label="붙여넣기 도구" value={dryRunOutputReviewTemplate.templateSummary.localOnlyPasteHelperStatus} help="서버 제출/업로드 없음" compact />
                <MetricCard label="다음 검토 액션" value={dryRunOutputReviewTemplate.templateSummary.nextReviewAction} help="검토 전용" compact variant="muted" />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <h5 className="text-sm font-semibold text-blue-950">로컬 붙여넣기 도구</h5>
                <p className="mt-2 text-xs leading-5 text-blue-900">
                  {dryRunOutputReviewTemplate.localOnlyPasteHelper.guidance}
                  {' '}서버 제출 가능 {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.serverSubmitAvailable)} ·
                  저장 가능 {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.saveAvailable)} ·
                  업로드 가능 {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.uploadAvailable)} ·
                  API 호출 가능 {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.apiCallAvailable)} ·
                  영속 저장 가능 {String(dryRunOutputReviewTemplate.localOnlyPasteHelper.persistenceAvailable)}
                </p>
                <textarea
                  value={dryRunOutputPasteText}
                  onChange={(event) => setDryRunOutputPasteText(event.target.value)}
                  rows={7}
                  placeholder='{"writesPerformed":false,"totalScoreChangesExpected":false,"gradeIdChangesExpected":false}'
                  className="mt-3 min-h-32 w-full rounded-xl border border-blue-200 bg-white p-3 text-xs leading-5 text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {dryRunOutputPasteReview ? (
                  <div className={`mt-3 rounded-xl border p-3 ${dryRunOutputPasteReview.ok ? 'border-blue-200 bg-white' : 'border-amber-200 bg-amber-50'}`}>
                    <p className={`text-xs font-semibold ${dryRunOutputPasteReview.ok ? 'text-blue-900' : 'text-amber-900'}`}>
                      {dryRunOutputPasteReview.message}
                    </p>
                    {dryRunOutputPasteReview.classification ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-slate-500">로컬 전용 분류</p>
                        <p className="mt-1 text-xs font-semibold text-slate-900">{dryRunOutputPasteReview.classification}</p>
                        {dryRunOutputPasteReview.redFlags?.length ? (
                          <p className="mt-1 text-xs leading-5 text-rose-700">
                            위험 신호: {dryRunOutputPasteReview.redFlags.join(', ')}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs leading-5 text-emerald-700">위험 신호: 로컬에서 감지되지 않음</p>
                        )}
                        {dryRunOutputPasteReview.nextActions?.length ? (
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            다음 액션: {dryRunOutputPasteReview.nextActions.join(' / ')}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {dryRunOutputPasteReview.fields.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {dryRunOutputPasteReview.fields.map((field) => (
                          <div key={field.field} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-slate-500">{field.field}</p>
                            <p className="mt-1 break-words text-xs text-slate-700">{field.value}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-blue-800">
                    JSON 형식 사전 실행 결과를 나중에 붙여넣으면 알려진 필드만 브라우저 로컬 상태에서 표시합니다.
                    붙여넣은 결과는 서버로 전송하지 않습니다.
                  </p>
                )}
              </div>

              {dryRunRehearsalGuardrails ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 사전 실행 리허설 및 안전장치</h5>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(dryRunRehearsalGuardrails.mode)}</Badge>
                        <Badge tone="neutral">{dryRunRehearsalGuardrails.status}</Badge>
                        <Badge tone="warn">{dryRunRehearsalGuardrails.summary.applyStatus}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 사전 실행 결과 판독과 실제 반영 안전장치를 사전 리허설하기 위한 읽기 전용 화면입니다.
                        사전 실행 검토, 실제 반영, 기존 데이터 채우기, 공식 점수/등급, 기능 활성화 스위치 변경은 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['dryrun-rehearsal-inventory', '스크립트 목록', dryRunRehearsalGuardrails.copyPayloads.scriptInventory],
                        ['dryrun-rehearsal-guardrails', '안전장치 점검 목록', dryRunRehearsalGuardrails.copyPayloads.guardrailChecklist],
                        ['dryrun-rehearsal-fixtures', '예시 결과 가이드', dryRunRehearsalGuardrails.copyPayloads.fixtureRehearsalGuide],
                        ['dryrun-rehearsal-red-flags', '위험 신호 표', dryRunRehearsalGuardrails.copyPayloads.redFlagMatrix],
                        ['dryrun-rehearsal-decisions', '검토자 판정 가이드', dryRunRehearsalGuardrails.copyPayloads.reviewerDecisionGuide],
                        ['dryrun-rehearsal-markdown', '마크다운 보기', dryRunRehearsalGuardrails.copyPayloads.markdown],
                        ['dryrun-rehearsal-tsv', 'TSV 보기', dryRunRehearsalGuardrails.copyPayloads.tsv],
                      ].map(([key, label, text]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void openExportPreview(key, text)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-white"
                        >
                          {copiedRunbookKey === key ? '복사됨' : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="스크립트" value={dryRunRehearsalGuardrails.summary.scriptInventoryCount.toLocaleString()} help="표면 목록" compact />
                    <MetricCard label="실제 반영 가능" value={dryRunRehearsalGuardrails.summary.applyCapableScriptCount.toLocaleString()} help="보호된 CLI 전용" compact variant="warning" />
                    <MetricCard label="예시 결과" value={dryRunRehearsalGuardrails.summary.fixtureExampleCount.toLocaleString()} help="안전 예시" compact />
                    <MetricCard label="검토기" value={dryRunRehearsalGuardrails.summary.reviewerStatus} help="순수 파서" compact />
                    <MetricCard label="붙여넣기 검증" value={dryRunRehearsalGuardrails.summary.localOnlyPasteValidatorStatus} help="서버 제출 없음" compact />
                    <MetricCard label="공식 전환" value={formatReadinessUiStatus2026(dryRunRehearsalGuardrails.summary.officialActivationStatus)} help="계속 차단" compact variant="warning" />
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">스크립트 표면 목록</h6>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            <tr>
                              <th className="px-3 py-2">스크립트</th>
                              <th className="px-3 py-2">사전 실행 검토</th>
                              <th className="px-3 py-2">실제 반영</th>
                              <th className="px-3 py-2">쓰기 여부</th>
                              <th className="px-3 py-2">안전 사용</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dryRunRehearsalGuardrails.scriptSurfaceInventory.map((item) => (
                              <tr key={item.scriptName}>
                                <td className="px-3 py-2 font-semibold text-slate-900">{item.scriptName}</td>
                                <td className="px-3 py-2 text-slate-600">{item.dryRunAvailable ? '있음' : '없음'}</td>
                                <td className="px-3 py-2 text-slate-600">{item.applyCapable ? item.applyTrigger : '없음'}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  Evaluation {item.writesEvaluation} · Item {item.writesEvaluationItem} · totalScore {item.writesEvaluationTotalScore} · gradeId {item.writesEvaluationGradeId}
                                </td>
                                <td className="px-3 py-2 text-slate-600">{item.recommendedSafeUse}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <h6 className="text-sm font-semibold text-amber-950">실제 반영 안전장치 상태</h6>
                        <div className="mt-3 grid gap-2">
                          {dryRunRehearsalGuardrails.applyGuardrailStatus.map((item) => (
                            <div key={item.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={item.status === 'CONFIRMED_IN_CODE' ? 'success' : 'warn'}>{formatReadinessUiStatus2026(item.status)}</Badge>
                                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-600">{item.evidence}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <h6 className="text-sm font-semibold text-blue-950">로컬 전용 붙여넣기 검증기</h6>
                        <p className="mt-2 text-xs leading-5 text-blue-900">
                          {dryRunRehearsalGuardrails.localOnlyPasteValidator.guidance}
                          {' '}서버 제출 가능 {String(dryRunRehearsalGuardrails.localOnlyPasteValidator.serverSubmitAvailable)} ·
                          저장 가능 {String(dryRunRehearsalGuardrails.localOnlyPasteValidator.saveAvailable)} ·
                          API 호출 가능 {String(dryRunRehearsalGuardrails.localOnlyPasteValidator.apiCallAvailable)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">예시 결과 리허설</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunRehearsalGuardrails.fixtureRehearsalExamples.map((item) => (
                          <div key={item.fileName} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{item.fileName}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{item.label}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">{item.expectedClassification}</p>
                            <p className="mt-1 text-xs leading-5 text-rose-700">위험 신호: {item.expectedRedFlags.join(', ') || '없음'}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <h6 className="text-sm font-semibold text-rose-950">위험 신호 표</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunRehearsalGuardrails.redFlagMatrix.map((item) => (
                          <div key={item.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={item.severity === 'REJECT' ? 'error' : 'warn'}>{item.severity}</Badge>
                              <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-rose-800">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">검토자 판정 가이드</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunRehearsalGuardrails.reviewerDecisionGuide.map((item) => (
                          <div key={item.classification} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{item.classification}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{item.meaning}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4">
                    <h6 className="text-sm font-semibold text-rose-950">금지 작업</h6>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{dryRunRehearsalGuardrails.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              ) : null}

              {backfillDryRunCommandRunbook ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 기존 데이터 채우기 명령 실행 절차서</h5>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(backfillDryRunCommandRunbook.mode)}</Badge>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(backfillDryRunCommandRunbook.status)}</Badge>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.commandReferenceStatus)}</Badge>
                        <Badge tone="warn">실제 반영 {formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.applyStatus)}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 향후 사전 실행 검토 전용 절차를 문서화합니다. 이 화면에서는 사전 실행 검토, 실제 반영, 기존 데이터 채우기,
                        공식 점수/등급, 기능 활성화 스위치 변경을 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['dryrun-command-summary', '운영자 요약', backfillDryRunCommandRunbook.copyPayloads.operatorSummary],
                        ['dryrun-command-prerun', '사전 점검 목록', backfillDryRunCommandRunbook.copyPayloads.preRunChecklist],
                        ['dryrun-command-reference', '사전 실행 명령 참고', backfillDryRunCommandRunbook.copyPayloads.dryRunCommandReference],
                        ['dryrun-command-logs', '로그 감시 목록', backfillDryRunCommandRunbook.copyPayloads.logWatchChecklist],
                        ['dryrun-command-abort', '중단 조건', backfillDryRunCommandRunbook.copyPayloads.abortConditions],
                        ['dryrun-command-handoff', '인계 목록', backfillDryRunCommandRunbook.copyPayloads.handoffChecklist],
                        ['dryrun-command-markdown', '마크다운 보기', backfillDryRunCommandRunbook.copyPayloads.markdown],
                        ['dryrun-command-tsv', 'TSV 보기', backfillDryRunCommandRunbook.copyPayloads.tsv],
                      ].map(([key, label, text]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void openExportPreview(key, text)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {copiedRunbookKey === key ? '복사됨' : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="현재 단계" value={backfillDryRunCommandRunbook.summary.currentStage} help="준비 상태 단계" compact />
                    <MetricCard label="전체 상태" value={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.overallReadinessStatus)} help="스냅샷 상태" compact />
                    <MetricCard label="공식 전환" value={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.officialActivationStatus)} help="공식 전환 차단 조건" compact variant="warning" />
                    <MetricCard label="사전 실행 명령" value={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.commandReferenceStatus)} help="텍스트 전용" compact />
                    <MetricCard label="사전 실행 여부" value={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.dryRunExecutionStatus)} help="실행 안 함" compact variant="warning" />
                    <MetricCard label="실제 반영" value={formatReadinessUiStatus2026(backfillDryRunCommandRunbook.summary.applyStatus)} help="숨김 / 금지" compact variant="warning" />
                  </div>

                  <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <h6 className="text-sm font-semibold text-blue-950">운영자 요약</h6>
                    <dl className="mt-3 grid gap-3 md:grid-cols-2">
                      {[
                        ['목적', backfillDryRunCommandRunbook.operatorSummary.purpose],
                        ['현재 상태', backfillDryRunCommandRunbook.operatorSummary.currentStatus],
                        ['사용 가능 시점', backfillDryRunCommandRunbook.operatorSummary.whenThisRunbookCanBeUsed],
                        ['실제 반영 금지 이유', backfillDryRunCommandRunbook.operatorSummary.whyApplyRemainsProhibited],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-500">{label}</dt>
                          <dd className="mt-1 text-xs leading-5 text-blue-950">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h6 className="text-sm font-semibold text-slate-900">사전 실행 전 점검 목록</h6>
                      <div className="mt-3 grid gap-2">
                        {backfillDryRunCommandRunbook.preRunChecklist.map((item) => (
                          <div key={item} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">{item}</div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <h6 className="text-sm font-semibold text-amber-950">사전 실행 전용 명령 참고</h6>
                      <p className="mt-2 text-xs leading-5 text-amber-900">
                        {backfillDryRunCommandRunbook.dryRunOnlyCommandReference.warning}
                      </p>
                      <pre className="mt-3 overflow-x-auto rounded-xl border border-amber-100 bg-white p-3 text-xs leading-5 text-slate-700">
                        {backfillDryRunCommandRunbook.dryRunOnlyCommandReference.commandText}
                      </pre>
                      <p className="mt-2 text-xs leading-5 text-amber-900">
                        모드 {formatReadinessUiStatus2026(backfillDryRunCommandRunbook.dryRunOnlyCommandReference.mode)} · 복사 전용 {String(backfillDryRunCommandRunbook.dryRunOnlyCommandReference.copyOnly)} ·
                        실행 가능 {String(backfillDryRunCommandRunbook.dryRunOnlyCommandReference.executeAvailable)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <h6 className="text-sm font-semibold text-rose-950">실제 반영 명령 경고</h6>
                    <p className="mt-2 text-xs leading-5 text-rose-900">
                      {backfillDryRunCommandRunbook.applyCommandWarning.warning}
                      {' '}실제 반영 명령 노출 {String(backfillDryRunCommandRunbook.applyCommandWarning.applyCommandExposed)} ·
                      이 절차서 포함 여부 {String(backfillDryRunCommandRunbook.applyCommandWarning.applyIsPartOfThisRunbook)}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {backfillDryRunCommandRunbook.applyCommandWarning.guardrailReminder.map((item) => (
                        <div key={item} className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs text-rose-800">{item}</div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
                    {[
                      ['결과 보관 점검 목록', backfillDryRunCommandRunbook.outputArchiveChecklist],
                      ['로그 감시 점검 목록', backfillDryRunCommandRunbook.logWatchChecklist],
                      ['중단 조건', backfillDryRunCommandRunbook.abortConditions],
                      ['인계 점검 목록', backfillDryRunCommandRunbook.handoffChecklist],
                    ].map(([title, items]) => (
                      <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h6 className="text-sm font-semibold text-slate-900">{title as string}</h6>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
                          {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <h6 className="text-sm font-semibold text-emerald-950">허용 명령</h6>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-emerald-900">
                        {backfillDryRunCommandRunbook.allowedCommands.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <h6 className="text-sm font-semibold text-rose-950">명시적으로 금지된 명령</h6>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-rose-900">
                        {backfillDryRunCommandRunbook.explicitlyForbiddenCommands.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4">
                    <h6 className="text-sm font-semibold text-rose-950">금지 작업</h6>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{backfillDryRunCommandRunbook.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              ) : null}

              {dryRunGoNoGoFreezePack ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 사전 실행 진행 가능 여부 최종 판정</h5>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.mode)}</Badge>
                        <Badge tone={dryRunGoNoGoFreezePack.decision.currentDecision === 'READY_FOR_REVIEW' ? 'success' : 'warn'}>
                          {formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.decision.currentDecision)}
                        </Badge>
                        <Badge tone="warn">실제 반영 {formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.decision.applyStatus)}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 향후 사전 실행 검토 가능 여부를 읽기 전용으로 판정합니다. 사전 실행 검토, 실제 반영, 기존 데이터 채우기,
                        공식 점수/등급, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">최종 판정 내보내기</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          ['dryrun-freeze-markdown', '마크다운 내보내기', dryRunGoNoGoFreezePack.copyPayloads.markdown],
                          ['dryrun-freeze-tsv', 'TSV 내보내기', dryRunGoNoGoFreezePack.copyPayloads.tsv],
                        ].map(([key, label, text]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => void openExportPreview(key, text)}
                            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                          >
                            {copiedRunbookKey === key ? '복사됨' : label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">최종 판정 복사 항목</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ['dryrun-freeze-summary', '진행 판단 요약 복사', dryRunGoNoGoFreezePack.copyPayloads.goNoGoSummary],
                        ['dryrun-freeze-no-go', '진행 불가 사유 복사', dryRunGoNoGoFreezePack.copyPayloads.noGoReasons],
                        ['dryrun-freeze-go', '진행 조건 복사', dryRunGoNoGoFreezePack.copyPayloads.goConditions],
                        ['dryrun-freeze-evidence', '증빙 패키지 복사', dryRunGoNoGoFreezePack.copyPayloads.requiredEvidencePack],
                        ['dryrun-freeze-hr', 'HR 해제 액션 복사', dryRunGoNoGoFreezePack.copyPayloads.hrUnlockActions],
                        ['dryrun-freeze-dev', '개발자 해제 액션 복사', dryRunGoNoGoFreezePack.copyPayloads.developerUnlockActions],
                        ['dryrun-freeze-signoff', '승인 확인 목록 복사', dryRunGoNoGoFreezePack.copyPayloads.signOffChecklist],
                        ['dryrun-freeze-checkpoint', '다음 점검 지점 복사', dryRunGoNoGoFreezePack.copyPayloads.nextCheckpoint],
                        ['dryrun-freeze-prohibited', '금지 작업 복사', dryRunGoNoGoFreezePack.copyPayloads.prohibitedActions],
                      ].map(([key, label, text]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void openExportPreview(key, text)}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {copiedRunbookKey === key ? '복사됨' : label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={dryRunGoNoGoFreezePack.decision.currentDecision === 'READY_FOR_REVIEW' ? 'success' : 'warn'}>
                        {formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.decision.currentDecision)}
                      </Badge>
                      <Badge tone="warn">실제 반영 {formatReadinessUiStatus2026(dryRunGoNoGoFreezePack.decision.applyStatus)}</Badge>
                      <Badge tone="neutral">누락 조건 {dryRunGoNoGoFreezePack.decision.missingGoConditionsCount}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-amber-950">{dryRunGoNoGoFreezePack.decision.explanationKo}</p>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                      <h6 className="text-sm font-semibold text-rose-950">진행 불가 사유</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunGoNoGoFreezePack.noGoReasons.map((item) => (
                          <div key={item.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-rose-950">{item.label}</p>
                              <Badge tone={item.status === 'READY' ? 'success' : 'warn'}>{formatReadinessUiStatus2026(item.status)}</Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-rose-700">
                              건수 {item.blockerCount ?? 'n/a'} · {item.source}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-rose-800">{item.nextAction}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h6 className="text-sm font-semibold text-slate-900">진행 조건</h6>
                      <div className="mt-3 grid gap-2">
                        {dryRunGoNoGoFreezePack.goConditions.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                              <Badge tone={item.status === 'READY' ? 'success' : item.status === 'READY_LATER' ? 'neutral' : 'warn'}>{formatReadinessUiStatus2026(item.status)}</Badge>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              건수 {item.blockerCount ?? 'n/a'} · {item.source}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
                    {[
                      ['필수 증빙 패키지', dryRunGoNoGoFreezePack.requiredEvidencePack],
                      ['인사 해제 액션', dryRunGoNoGoFreezePack.hrUnlockActions],
                      ['개발자 해제 액션', dryRunGoNoGoFreezePack.developerUnlockActions],
                      ['승인 확인 목록', dryRunGoNoGoFreezePack.signOffChecklist],
                    ].map(([title, items]) => (
                      <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h6 className="text-sm font-semibold text-slate-900">{title as string}</h6>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
                          {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <h6 className="text-sm font-semibold text-blue-950">다음 점검 지점</h6>
                      <p className="mt-2 text-xs leading-5 text-blue-900">{dryRunGoNoGoFreezePack.nextCheckpoint.name}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-900">{dryRunGoNoGoFreezePack.nextCheckpoint.requiredBeforeAfterSnapshot}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-900">담당: {dryRunGoNoGoFreezePack.nextCheckpoint.decisionOwner}</p>
                      <p className="mt-2 text-xs leading-5 text-blue-900">
                        변화표: {dryRunGoNoGoFreezePack.nextCheckpoint.deltaTableRequired.join(', ')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-rose-950">금지 작업</h6>
                      <p className="mt-2 text-sm leading-6 text-rose-900">{dryRunGoNoGoFreezePack.prohibitedActions.join(', ')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">2026 사전 실행 진행 가능 여부 최종 판정</h5>
                  <p className="mt-2 text-sm leading-6 text-slate-600">진행 판단 데이터를 불러오는 중입니다.</p>
                </div>
              )}

              {endToEndPilot2026 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="text-sm font-semibold text-slate-900">2026 평가 전체 흐름 미리보기</h5>
                        <Badge tone="neutral">{formatReadinessUiStatus2026(endToEndPilot2026.mode)}</Badge>
                        <Badge tone={endToEndPilot2026.summary.hardBlockedStepCount > 0 ? 'error' : endToEndPilot2026.summary.previewWithBlockersStepCount > 0 ? 'warn' : 'success'}>
                          {formatReadinessUiStatus2026(endToEndPilot2026.summary.currentDecision)}
                        </Badge>
                        <Badge tone="neutral">{endToEndPilot2026.summary.pilotDataSource}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        이 화면은 2026 평가 전체 흐름을 미리보기/파일럿으로 검증합니다. 공식 평가 생성, 공식 점수,
                        공식 등급, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId), 기존 데이터 채우기는 실행하지 않습니다.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                      <p className="font-semibold">파일럿 대상자</p>
                      <p>{endToEndPilot2026.pilotEmployee.name} · {endToEndPilot2026.pilotEmployee.departmentName}</p>
                      <p>확정 KPI {endToEndPilot2026.pilotEmployee.confirmedPersonalKpiCount}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <MetricCard label="흐름 단계" value={endToEndPilot2026.summary.workflowStepCount.toLocaleString()} help="대상자부터 안전 확인까지" compact />
                    <MetricCard label="미리보기 완성도" value={`${endToEndPilot2026.summary.previewCompletenessPercentage}%`} help={`${endToEndPilot2026.summary.previewAvailableStepCount}개 단계 미리보기 가능`} compact />
                    <MetricCard label="완전 차단 단계" value={endToEndPilot2026.summary.hardBlockedStepCount.toLocaleString()} help="안전한 미리보기 없음" compact variant={endToEndPilot2026.summary.hardBlockedStepCount > 0 ? 'warning' : 'default'} />
                    <MetricCard label="차단 조건 포함" value={endToEndPilot2026.summary.previewWithBlockersStepCount.toLocaleString()} help="미리보기 가능, 공식 실행 차단" compact variant={endToEndPilot2026.summary.previewWithBlockersStepCount > 0 ? 'warning' : 'default'} />
                    <MetricCard label="미리보기 전용 단계" value={endToEndPilot2026.summary.previewOnlyStepCount.toLocaleString()} help="쓰기 없음" compact />
                    <MetricCard label="점수 미리보기" value={formatReadinessUiStatus2026(endToEndPilot2026.scorePreview.status)} help="공식 저장 점수(totalScore) 쓰기 없음" compact variant={endToEndPilot2026.scorePreview.status === 'BLOCKED' ? 'warning' : 'default'} />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                      <p className="font-semibold">미리보기 가능한 부분</p>
                      <p>{endToEndPilot2026.summary.previewAvailableStepCount}개 단계가 메모리/샘플 미리보기로 표시됩니다.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      <p className="font-semibold">공식 실행 전 차단 조건</p>
                      <p>{endToEndPilot2026.blockers.length ? endToEndPilot2026.blockers.join(', ') : '현재 파일럿 기준 공식 차단 조건 없음'}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
                      <p className="font-semibold">실제 저장 금지</p>
                      <p>공식 저장 없음: 저장/제출/확정, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId), Evaluation/EvaluationItem 생성은 실행하지 않습니다.</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h6 className="text-sm font-semibold text-slate-900">흐름 단계</h6>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {endToEndPilot2026.workflowSteps.map((step) => (
                        <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{step.order}. {step.label}</p>
                            <Badge tone={step.status === 'READY' || step.status === 'SAFETY_CONFIRMED' ? 'success' : step.status === 'BLOCKED' ? 'error' : step.status === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : 'neutral'}>
                              {formatReadinessUiStatus2026(step.status)}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">사용 데이터: {step.dataUsed.join(', ')}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">미리보기: {step.whatIsPreviewed.join(', ')}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">공식 진행 시점: {step.officialLater}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">화면/출처: {step.route}</p>
                          {step.blockedBy.length ? (
                            <p className="mt-2 text-xs leading-5 text-amber-800">공식 차단 조건: {step.blockedBy.join(', ')}</p>
                          ) : null}
                          <p className="mt-2 text-xs leading-5 text-emerald-700">{step.safetyNote}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <h6 className="text-sm font-semibold text-slate-900">파일럿 보완 표</h6>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="px-2 py-2 font-semibold">단계</th>
                            <th className="px-2 py-2 font-semibold">현재 미리보기 상태</th>
                            <th className="px-2 py-2 font-semibold">미리보기 내용</th>
                            <th className="px-2 py-2 font-semibold">공식 실행 차단 조건</th>
                            <th className="px-2 py-2 font-semibold">남은 보완</th>
                            <th className="px-2 py-2 font-semibold">안전 메모</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {endToEndPilot2026.pilotGapTable.map((row) => (
                            <tr key={`${row.step}-${row.currentPreviewStatus}`}>
                              <td className="px-2 py-2 font-semibold text-slate-900">{row.step}</td>
                              <td className="px-2 py-2 text-slate-700">{formatReadinessUiStatus2026(row.currentPreviewStatus)}</td>
                              <td className="px-2 py-2 text-slate-600">{row.whatIsPreviewed}</td>
                              <td className="px-2 py-2 text-amber-800">{row.whatBlocksOfficialExecution}</td>
                              <td className="px-2 py-2 text-slate-600">{row.whatRemainsToClose}</td>
                              <td className="px-2 py-2 text-emerald-700">{row.safetyNote}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h6 className="text-sm font-semibold text-slate-900">자기평가 미리보기</h6>
                        <Badge tone={endToEndPilot2026.selfEvaluationPreview.status === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : 'neutral'}>
                          {formatReadinessUiStatus2026(endToEndPilot2026.selfEvaluationPreview.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.selfEvaluationPreview.sampleSelfComment}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.selfEvaluationPreview.contributionFieldPreview}</p>
                      <p className="mt-2 text-xs leading-5 text-amber-800">{endToEndPilot2026.selfEvaluationPreview.missingEvidenceWarnings.join(' ')}</p>
                      <p className="mt-2 text-xs font-semibold text-emerald-700">저장/제출 가능: {String(endToEndPilot2026.selfEvaluationPreview.saveAvailable)} / {String(endToEndPilot2026.selfEvaluationPreview.submitAvailable)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h6 className="text-sm font-semibold text-slate-900">1차 평가 미리보기</h6>
                        <Badge tone={endToEndPilot2026.firstReviewPreview.status === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : 'neutral'}>
                          {formatReadinessUiStatus2026(endToEndPilot2026.firstReviewPreview.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.firstReviewPreview.expectedReviewerSource}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.firstReviewPreview.sampleLeaderFeedback}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">검토 기준: {endToEndPilot2026.firstReviewPreview.reviewCriteriaPreview.join(', ')}</p>
                      {endToEndPilot2026.firstReviewPreview.missingReviewerWarning ? (
                        <p className="mt-2 text-xs leading-5 text-amber-800">{endToEndPilot2026.firstReviewPreview.missingReviewerWarning}</p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h6 className="text-sm font-semibold text-slate-900">2차/최종 평가 미리보기</h6>
                        <Badge tone={endToEndPilot2026.secondFinalReviewPreview.status === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : 'neutral'}>
                          {formatReadinessUiStatus2026(endToEndPilot2026.secondFinalReviewPreview.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.secondFinalReviewPreview.expectedReviewerSource}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.secondFinalReviewPreview.finalReviewerRequirement}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{endToEndPilot2026.secondFinalReviewPreview.sampleFinalFeedback}</p>
                      <p className="mt-2 text-xs leading-5 text-sky-800">{endToEndPilot2026.secondFinalReviewPreview.escalationCeoReadinessDependency}</p>
                      {endToEndPilot2026.secondFinalReviewPreview.missingChainWarning ? (
                        <p className="mt-2 text-xs leading-5 text-amber-800">{endToEndPilot2026.secondFinalReviewPreview.missingChainWarning}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <h6 className="text-sm font-semibold text-blue-950">점수 미리보기</h6>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={endToEndPilot2026.scorePreview.calculationStatus === 'READY' ? 'success' : 'error'}>
                          계산 {formatReadinessUiStatus2026(endToEndPilot2026.scorePreview.calculationStatus)}
                        </Badge>
                        <Badge tone={endToEndPilot2026.scorePreview.officialReadinessStatus === 'READY' ? 'success' : 'warn'}>
                          공식 점수 준비 {formatReadinessUiStatus2026(endToEndPilot2026.scorePreview.officialReadinessStatus)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <MetricCard label="조직 성과" value={endToEndPilot2026.scorePreview.organizationPerformanceScore?.toFixed(1) ?? '-'} help="30%" compact />
                        <MetricCard label="개인 성과" value={endToEndPilot2026.scorePreview.personalPerformanceScore?.toFixed(1) ?? '-'} help="70%" compact />
                        <MetricCard label="기준 점수 미리보기" value={endToEndPilot2026.scorePreview.finalScorePreview?.toFixed(1) ?? '-'} help="저장 안 함" compact />
                      </div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full divide-y divide-blue-100 text-left text-xs">
                          <thead className="text-blue-700">
                            <tr>
                              <th className="px-2 py-2 font-semibold">분류</th>
                              <th className="px-2 py-2 font-semibold">유형</th>
                              <th className="px-2 py-2 font-semibold">기준</th>
                              <th className="px-2 py-2 font-semibold">최종</th>
                              <th className="px-2 py-2 font-semibold">가중치</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {endToEndPilot2026.scorePreview.categoryContributions.map((item) => (
                              <tr key={`${item.category}-${item.weight}`}>
                                <td className="px-2 py-2">{item.category}</td>
                                <td className="px-2 py-2">{item.contributionType}</td>
                                <td className="px-2 py-2">{item.baseScore.toFixed(1)}</td>
                                <td className="px-2 py-2">{item.finalScore.toFixed(1)}</td>
                                <td className="px-2 py-2">{item.weight}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-blue-900">{endToEndPilot2026.scorePreview.warnings.join(' ')}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                        <h6 className="text-sm font-semibold text-violet-950">등급 미리보기</h6>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={endToEndPilot2026.gradePreview.calculationStatus === 'READY' ? 'success' : 'error'}>
                            계산 {formatReadinessUiStatus2026(endToEndPilot2026.gradePreview.calculationStatus)}
                          </Badge>
                          <Badge tone={endToEndPilot2026.gradePreview.officialReadinessStatus === 'READY' ? 'success' : 'warn'}>
                            공식 등급 준비 {formatReadinessUiStatus2026(endToEndPilot2026.gradePreview.officialReadinessStatus)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-violet-900">{endToEndPilot2026.gradePreview.gradePreview ?? endToEndPilot2026.gradePreview.status}</p>
                        <p className="mt-2 text-xs leading-5 text-violet-900">
                          그룹: {endToEndPilot2026.gradePreview.applicableGroup} · 매핑: {endToEndPilot2026.gradePreview.scoreToGradeMapping}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-violet-900">{endToEndPilot2026.gradePreview.teamMemberSalesSuperNotApplicableNote}</p>
                        {endToEndPilot2026.gradePreview.blockers.length ? (
                          <p className="mt-2 text-xs leading-5 text-amber-800">차단: {endToEndPilot2026.gradePreview.blockers.join(', ')}</p>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                        <h6 className="text-sm font-semibold text-sky-950">대표이사/최종 확정 미리보기</h6>
                        <p className="mt-2 text-xs leading-5 text-sky-900">
                          단계: {endToEndPilot2026.ceoFinalConfirmationPreview.finalReviewerStagePreview} · 조정 사유 필수: {String(endToEndPilot2026.ceoFinalConfirmationPreview.adjustmentReasonRequired)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-sky-900">
                          보정 차단 {endToEndPilot2026.ceoFinalConfirmationPreview.calibrationFinalizationBlockers} · 대표이사 차단 {endToEndPilot2026.ceoFinalConfirmationPreview.ceoConfirmationBlockers}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-sky-900">{endToEndPilot2026.ceoFinalConfirmationPreview.notes.join(' ')}</p>
                        <p className="mt-2 text-xs leading-5 text-sky-900">샘플 사유: {endToEndPilot2026.ceoFinalConfirmationPreview.sampleAdjustmentReason}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h6 className="text-sm font-semibold text-slate-900">전체 흐름 보완 지점</h6>
                      <div className="mt-3 space-y-2">
                        {endToEndPilot2026.gapAssessment.map((item) => (
                          <div key={item.question} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-xs font-semibold text-slate-900">{item.question}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.answer} · {item.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <h6 className="text-sm font-semibold text-emerald-950">안전 확인</h6>
                      <div className="mt-3 grid gap-2 text-xs leading-5 text-emerald-900">
                        <p>공식 점수 반영 false: {String(endToEndPilot2026.safety.officialScoringEnabled)}</p>
                        <p>공식 등급 반영 false: {String(endToEndPilot2026.safety.officialGradeEnabled)}</p>
                        <p>AI 제외 활성화 false: {String(endToEndPilot2026.safety.officialAiScoreExclusionEnabled)}</p>
                        <p>공식 저장 점수(totalScore) 쓰기: {String(endToEndPilot2026.safety.totalScoreChanged)}</p>
                        <p>공식 저장 등급(gradeId) 쓰기: {String(endToEndPilot2026.safety.gradeIdChanged)}</p>
                        <p>공식 Evaluation/EvaluationItem 생성: {endToEndPilot2026.safety.officialEvaluationsCreated}/{endToEndPilot2026.safety.officialEvaluationItemsCreated}</p>
                        <p>기존 데이터 채우기/실제 반영 실행: {String(endToEndPilot2026.safety.backfillExecuted)} / {String(endToEndPilot2026.safety.backfillApplyExecuted)}</p>
                        <p>기능 활성화 스위치 변경: {String(endToEndPilot2026.safety.featureFlagsChanged)}</p>
                      </div>
                    </div>
                  </div>

                  <InteractivePilotWalkthrough2026
                    pilot={endToEndPilot2026}
                    onExportPreview={openExportPreview}
                  />
                  <WorkbenchPilotAlignment2026
                    pilot={endToEndPilot2026}
                    onExportPreview={openExportPreview}
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Review template sections</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.reviewTemplateSections.map((section) => (
                      <div key={section.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Expected output fields</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">field</th>
                          <th className="px-3 py-2">required</th>
                          <th className="px-3 py-2">review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...dryRunOutputReviewTemplate.dryRunIdentityFields, ...dryRunOutputReviewTemplate.expectedOutputFields].map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-semibold text-slate-900">{item.label}</td>
                            <td className="px-3 py-2 text-slate-600">{item.requiredValue}</td>
                            <td className="px-3 py-2 text-slate-600">{item.expectedReview}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <h5 className="text-sm font-semibold text-emerald-950">Must-pass criteria</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.mustPassCriteria.map((item) => (
                      <div key={item.id} className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-emerald-800">{item.reviewAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <h5 className="text-sm font-semibold text-rose-950">Red flags</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.redFlagConditions.map((item) => (
                      <div key={item.id} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-rose-800">{item.reviewAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {[
                  ['HR review checklist', dryRunOutputReviewTemplate.hrReviewChecklist],
                  ['Developer review checklist', dryRunOutputReviewTemplate.developerReviewChecklist],
                  ['사전 실행 후 로그 감시 점검 목록', dryRunOutputReviewTemplate.postDryRunLogWatchChecklist],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">{title as string}</h5>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-600">
                      {(items as string[]).map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Decision outcomes</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.decisionOutcomes.map((item) => (
                      <div key={item.code} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.meaning}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Next action mapping</h5>
                  <div className="mt-3 grid gap-2">
                    {dryRunOutputReviewTemplate.nextActionMapping.map((item) => (
                      <div key={`${item.condition}-${item.route}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{item.condition}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.route}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                <p className="mt-2 text-sm leading-6 text-rose-900">{dryRunOutputReviewTemplate.prohibitedActions.join(', ')}</p>
              </div>
            </div>
          ) : null}

          {scenarioSimulator && scenarioPreview && scenarioInputValues ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 준비 상태 시나리오 시뮬레이터</h4>
                    <Badge tone="neutral">읽기 전용</Badge>
                    <Badge tone="warn">공식 전환 차단됨</Badge>
                    <Badge tone="neutral">로컬 UI 상태만</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 해소 필요 항목 감소 효과를 가정해 보는 읽기 전용 시뮬레이터입니다.
                    실제 데이터 저장, 기존 데이터 채우기, 공식 점수/등급, 기능 활성화 스위치 변경은 수행하지 않습니다.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-amber-700">{scenarioSimulator.disclaimer}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['scenario-summary', '시나리오 요약 보기', scenarioPreview.reportText],
                    ['scenario-action', '예상 액션 계획 보기', `다음 HR 액션: ${scenarioPreview.nextHrAction}\n예상 단계: ${scenarioPreview.projectedStage}\n예상 상태: ${formatReadinessUiStatus2026(scenarioPreview.projectedStatus)}\n공식 전환: 차단됨`],
                    ['scenario-markdown', '마크다운 보기', scenarioPreview.markdown],
                    ['scenario-tsv', 'TSV 보기', scenarioPreview.tsv],
                    ['scenario-prohibited', '금지 작업', scenarioSimulator.copyPayloads.prohibitedActions],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 MBO 미작성" value={formatIntegratedSnapshotCount2026(scenarioSimulator.baselineCounts.missingMboCount)} help="현재 요약" compact />
                <MetricCard label="예상 MBO 미작성" value={formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.missingMboCount)} help="시나리오 반영" compact variant={numericScenarioValue2026(scenarioPreview.projectedCounts.missingMboCount) > 0 ? 'warning' : 'default'} />
                <MetricCard label="baseline Team KPI" value={formatIntegratedSnapshotCount2026(scenarioSimulator.baselineCounts.teamKpiPendingCount)} help="pending/discussion" compact />
                <MetricCard label="projected Team KPI" value={formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.teamKpiPendingCount)} help="시나리오 반영" compact />
                <MetricCard label="official gate" value={formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.officialActivationGateBlockerCount)} help={`estimated potential ${formatIntegratedSnapshotCount2026(scenarioPreview.projectedCounts.estimatedOfficialGateBlockerCount)}`} compact variant="warning" />
                <MetricCard label="projected stage" value={scenarioPreview.projectedStage} help={scenarioPreview.projectedStatus} compact />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Scenario presets</h5>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scenarioSimulator.presets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setScenarioState({
                          presetId: preset.id,
                          inputs: preset.input,
                          sourceKey: autoLoadKey,
                        })}
                        className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition ${
                          scenarioState.presetId === preset.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedScenarioPreset?.description ?? 'Manual scenario'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">수동 시나리오 입력</h5>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {SCENARIO_INPUT_FIELDS_2026.map((field) => (
                      <label key={field.key} className="block rounded-xl border border-slate-200 bg-white p-3">
                        <span className="text-xs font-semibold text-slate-600">{field.label}</span>
                        <input
                          type="number"
                          min={0}
                          value={scenarioInputValues[field.key]}
                          onChange={(event) => {
                            const nextValue = Number.isFinite(event.currentTarget.valueAsNumber)
                              ? Math.max(event.currentTarget.valueAsNumber, 0)
                              : 0
                            setScenarioState((current) => ({
                              presetId: current.presetId,
                              sourceKey: autoLoadKey,
                              inputs: {
                                ...((current.sourceKey === autoLoadKey && current.inputs) ? current.inputs : scenarioInputValues),
                                [field.key]: nextValue,
                              },
                            }))
                          }}
                          className="mt-2 h-9 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-900"
                        />
                        <span className="mt-1 block text-xs text-slate-400">{field.help}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">예상 변화</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">blocker</th>
                          <th className="px-3 py-2">baseline</th>
                          <th className="px-3 py-2">projected</th>
                          <th className="px-3 py-2">delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scenarioPreview.deltaRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-3 py-2 font-semibold text-slate-800">{row.label}</td>
                            <td className="px-3 py-2 text-slate-600">{formatIntegratedSnapshotCount2026(row.baseline)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatIntegratedSnapshotCount2026(row.projected)}</td>
                            <td className={`px-3 py-2 font-semibold ${numericScenarioValue2026(row.delta) < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {row.delta == null ? '미확인' : row.delta.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    공식 gate blocker는 실제 운영 데이터 저장 후 재산출되어야 하며, 이 화면에서는 잠재 영향만 참고값으로 표시합니다.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">남은 해소 필요 항목 / 다음 HR 액션</h5>
                  <div className="mt-3 space-y-2">
                    {scenarioPreview.remainingBlockers.slice(0, 6).map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                          <Badge tone={item.count > 0 ? 'warn' : 'success'}>{item.count.toLocaleString()}건</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700">예상 다음 HR 액션</p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">{scenarioPreview.nextHrAction}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Deterministic scenario report</h5>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{scenarioPreview.reportText}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                  <p className="mt-2 text-sm leading-6 text-rose-900">{scenarioSimulator.prohibitedActions.join(', ')}</p>
                </div>
              </div>
            </div>
          ) : null}

          {ceoReportPack ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 대표이사 보고 Pack</h4>
                    <Badge tone="success">{ceoReportPack.reportStatus}</Badge>
                    <Badge tone={ceoReportPack.summary.officialActivationStatus === 'BLOCKED' ? 'warn' : 'neutral'}>
                      {ceoReportPack.summary.officialActivationStatus}
                    </Badge>
                    <Badge tone="neutral">읽기 전용 내보내기</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 대표이사 보고용 준비 상태 요약을 읽기 전용으로 제공합니다.
                    기존 데이터 채우기, 공식 점수, 공식 등급, 기능 활성화 스위치, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId)은 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['ceo-summary', '경영요약 복사', ceoReportPack.copyPayloads.executiveSummary],
                    ['ceo-markdown', '대표이사 보고서 마크다운 복사', ceoReportPack.copyPayloads.markdownReport],
                    ['ceo-blockers', '주요 해소 필요 항목 복사', ceoReportPack.copyPayloads.topBlockers],
                    ['ceo-agenda', '대표이사 의사결정 안건 복사', ceoReportPack.copyPayloads.decisionAgenda],
                    ['ceo-scenarios', '시나리오 비교 복사', ceoReportPack.copyPayloads.scenarioComparison],
                    ['ceo-prohibited', '금지 작업 복사', ceoReportPack.copyPayloads.prohibitedActions],
                    ['ceo-tsv', 'TSV 내보내기', ceoReportPack.copyPayloads.tsvSummary],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricCard label="현재 단계" value={ceoReportPack.summary.currentStage} help="준비 상태 단계" compact />
                <MetricCard label="전체 상태" value={formatReadinessUiStatus2026(ceoReportPack.summary.overallReadinessStatus)} help="준비 상태 요약" compact />
                <MetricCard label="공식 전환" value={formatReadinessUiStatus2026(ceoReportPack.summary.officialActivationStatus)} help="대표이사 보고 상태" compact variant={ceoReportPack.summary.officialActivationStatus === 'BLOCKED' ? 'warning' : 'default'} />
                {ceoReportPack.keyNumbers.slice(0, 3).map((item) => (
                  <MetricCard
                    key={item.id}
                    label={item.label}
                    value={item.value == null ? '확인 필요' : String(item.value)}
                    help={item.note}
                    compact
                    variant={item.id === 'MBO_MISSING' || item.id === 'OFFICIAL_GATE_BLOCKERS' ? 'warning' : 'default'}
                  />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-sm font-semibold text-slate-900">Executive summary</h5>
                <p className="mt-3 text-sm leading-6 text-slate-600">{ceoReportPack.summary.executiveSummaryText}</p>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold text-slate-900">Key numbers</h5>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <tr>
                          <th className="px-3 py-2">metric</th>
                          <th className="px-3 py-2">value</th>
                          <th className="px-3 py-2">source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ceoReportPack.keyNumbers.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 font-semibold text-slate-800">{item.label}</td>
                            <td className="px-3 py-2 text-slate-600">{item.value == null ? '화면 값 확인 필요' : String(item.value)}</td>
                            <td className="px-3 py-2 text-slate-500">{item.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h5 className="text-sm font-semibold text-amber-950">대표이사 의사결정 안건</h5>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-amber-950">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Decisions needed now</p>
                      <ul className="mt-1 space-y-1">
                        {ceoReportPack.decisionAgenda.decisionsNeededNow.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Not yet appropriate</p>
                      <ul className="mt-1 space-y-1">
                        {ceoReportPack.decisionAgenda.decisionsNotYetAppropriate.map((item) => <li key={item}>- {item}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-900">주요 해소 필요 항목</h5>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">blocker</th>
                        <th className="px-3 py-2">건수</th>
                        <th className="px-3 py-2">영향</th>
                        <th className="px-3 py-2">다음 HR 액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ceoReportPack.topBlockers.map((blocker) => (
                        <tr key={blocker.code}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800">{blocker.name}</p>
                            <p className="text-xs text-slate-400">{blocker.sourcePanel} · {blocker.route}</p>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{blocker.count.toLocaleString()}건</td>
                          <td className="px-3 py-2 text-slate-600">{blocker.impact}</td>
                          <td className="px-3 py-2 text-slate-600">{blocker.nextHrAction}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">시나리오 비교</h5>
                  <div className="mt-3 grid gap-3">
                    {ceoReportPack.scenarioComparison.map((scenario) => (
                      <div key={scenario.scenarioName} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900">{scenario.scenarioName}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">improvement: {scenario.expectedImprovement}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">remaining: {scenario.remainingBlocker}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{scenario.recommendedInterpretation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h5 className="text-sm font-semibold text-slate-900">Recommended execution order</h5>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
                      {ceoReportPack.recommendedExecutionOrder.map((item) => <li key={item}>{item}</li>)}
                    </ol>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <h5 className="text-sm font-semibold text-blue-950">다음 점검 지점</h5>
                    <p className="mt-2 text-sm font-semibold text-blue-900">{ceoReportPack.nextCheckpoint.name}</p>
                    <p className="mt-2 text-sm leading-6 text-blue-900">{ceoReportPack.nextCheckpoint.nextReviewCondition}</p>
                    <p className="mt-2 text-xs leading-5 text-blue-800">
                      필요 자료: {ceoReportPack.nextCheckpoint.requiredExportedData.join(', ')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <h5 className="text-sm font-semibold text-rose-950">금지 작업</h5>
                    <p className="mt-2 text-sm leading-6 text-rose-900">{ceoReportPack.prohibitedActions.join(', ')}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {runbook ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">2026 공식 전환 실행 절차서</h4>
                    <Badge tone="neutral">{formatReadinessUiStatus2026(runbook.mode)}</Badge>
                    <Badge tone={runbook.summary.blockedSectionCount > 0 ? 'warn' : 'success'}>
                      해소 필요 항목 {runbook.summary.totalBlockerCount.toLocaleString()}건
                    </Badge>
                    <Badge tone="neutral">UI 실행 버튼 없음</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    이 화면은 공식 전환 실행 순서를 읽기 전용으로 안내합니다. 기존 데이터 채우기, 기능 활성화 스위치, 공식 점수, 공식 등급은 실행하지 않습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['runbook-full', '전체 runbook', runbook.copyPayloads.markdown],
                    ['runbook-blockers', 'blocker 요약', runbook.copyPayloads.blockerSummary],
                    ['runbook-hr', 'HR checklist', runbook.copyPayloads.hrApprovalChecklist],
                    ['runbook-dev', 'Dev checklist', runbook.copyPayloads.developerExecutionChecklist],
                    ['runbook-prohibited', '금지 목록', runbook.copyPayloads.prohibitedActions],
                    ['runbook-tsv', 'TSV', runbook.copyPayloads.tsv],
                  ].map(([key, label, text]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => void openExportPreview(key, text)}
                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {copiedRunbookKey === key ? '복사됨' : label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-900">현재 단계</p>
                  <p className="mt-1 text-sm font-semibold text-amber-950">{runbook.currentPosition.currentStage}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">다음 필요 단계</p>
                  <p className="mt-1 text-sm leading-5 text-slate-700">{runbook.currentPosition.nextRequiredStep}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500">아직 금지</p>
                  <p className="mt-1 text-sm leading-5 text-slate-700">
                    {runbook.currentPosition.prohibitedActions.slice(0, 5).join(', ')}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {runbook.sections.map((section) => (
                  <details
                    key={section.id}
                    open={section.status === 'BLOCKED'}
                    className={`rounded-2xl border ${
                      section.status === 'BLOCKED'
                        ? 'border-amber-200 bg-amber-50/60'
                        : section.status === 'READY_FOR_REVIEW'
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <summary className="cursor-pointer list-none px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={section.status === 'BLOCKED' ? 'warn' : section.status === 'READY_FOR_REVIEW' ? 'success' : 'neutral'}>
                            {section.status}
                          </Badge>
                          <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                        </div>
                        <span className="text-xs text-slate-500">blocker {section.currentBlockerCount.toLocaleString()}건</span>
                      </div>
                    </summary>
                    <div className="border-t border-white/70 px-4 pb-4 pt-3 text-sm leading-6 text-slate-600">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">Required checks</p>
                          <ul className="mt-2 space-y-1">
                            {section.requiredChecks.slice(0, 6).map((check) => (
                              <li key={check}>- {check}</li>
                            ))}
                          </ul>
                          {section.requiredChecks.length > 6 ? (
                            <p className="mt-1 text-xs text-slate-400">+{section.requiredChecks.length - 6}개 check</p>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500">출처 준비 상태 패널</p>
                          <p className="mt-2">{section.sourceReadinessPanels.join(', ')}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">다음 HR 액션</p>
                          <p>{section.nextHrAction}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">다음 개발/모니터링 액션</p>
                          <p>{section.nextDeveloperAction}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">금지 작업</p>
                          <p>{section.prohibitedActions.slice(0, 5).join(', ')}</p>
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">HR 승인 확인 목록</h5>
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                    {runbook.hrApprovalChecklist.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-sm font-semibold text-slate-900">개발자 실행 확인 목록</h5>
                  <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600">
                    {runbook.developerExecutionChecklist.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">2026 공식 전환 조건 확인 목록</h4>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  각 공식 전환 조건은 필요한 조건, 현재 해소 필요 항목 수, 차단 이유, 다음 HR 액션을 표시합니다. 실행 버튼은 제공하지 않습니다.
                </p>
              </div>
              <Badge tone="neutral">읽기 전용 점검 목록</Badge>
            </div>

            {activation.populationDryRunError ? (
              <div className="mt-3">
                <Banner tone="warn" message={activation.populationDryRunError} />
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {gates.map((gate) => (
                <details
                  key={gate.id}
                  open={gate.status === 'BLOCKED'}
                  className={`rounded-2xl border ${
                    gate.status === 'READY'
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : gate.status === 'NOT_APPLICABLE'
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  <summary className="cursor-pointer list-none px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={gate.status === 'READY' ? 'success' : gate.status === 'BLOCKED' ? 'warn' : 'neutral'}>
                            {gate.status}
                          </Badge>
                          <span className="text-sm font-semibold text-slate-900">{gate.title}</span>
                          <span className="text-xs text-slate-500">blocker {gate.currentBlockerCount.toLocaleString()}건</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{gate.nextHrAction}</p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600">
                        {gate.safetyWarning}
                      </div>
                    </div>
                  </summary>
                  <div className="border-t border-white/70 px-4 pb-4 pt-3">
                    {gate.blockedReasons.length ? (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-white px-3 py-2">
                        <p className="text-xs font-semibold text-amber-800">차단 이유</p>
                        <ul className="mt-2 space-y-1">
                          {gate.blockedReasons.slice(0, 6).map((reason) => (
                            <li key={reason} className="text-xs leading-5 text-amber-900">{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">조건</th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">상태</th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">현재값</th>
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">다음 HR 액션</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white/80 text-slate-700">
                          {gate.requiredConditions.map((item) => (
                            <tr key={`${gate.id}-${item.code}`}>
                              <td className="min-w-48 px-2 py-2 align-top font-semibold text-slate-900">{item.label}</td>
                              <td className="px-2 py-2 align-top">
                                <Badge tone={item.status === 'READY' ? 'success' : item.status === 'BLOCKED' ? 'warn' : 'neutral'}>
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="min-w-36 px-2 py-2 align-top">{item.currentValue}</td>
                              <td className="min-w-72 px-2 py-2 align-top">{item.nextHrAction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">Legacy activation blockers</h4>
              </div>
              {blockers.length ? (
                <ul className="mt-3 space-y-2">
                  {blockers.slice(0, 8).map((blocker, index) => (
                    <li key={`${blocker.code}-${index}`} className="text-sm leading-6 text-amber-900">
                      <span className="font-semibold">{blocker.code}</span> · {blocker.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-emerald-800">
                  현재 확인 범위에서는 공식 전환 차단 항목이 없습니다. 이 상태도 전환 실행이 아니라 사전 검증 결과입니다.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-600" />
                <h4 className="text-sm font-semibold text-slate-900">Feature flag 상태</h4>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>미리보기</span>
                  <span className="font-semibold text-slate-900">{activation.flags.previewEnabled ? '활성' : '비활성'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Official scoring</span>
                  <span className="font-semibold text-slate-900">
                    {activation.flags.officialScoringEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Official grade</span>
                  <span className="font-semibold text-slate-900">
                    {activation.flags.officialGradeEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>AI score exclusion</span>
                  <span className="font-semibold text-slate-900">
                    {activation.flags.aiScoreExclusionEnabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
              </div>
              {warnings.length ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Warnings</p>
                  <ul className="mt-2 space-y-1">
                    {warnings.slice(0, 4).map((warning, index) => (
                      <li key={`${warning.code}-${index}`} className="text-xs leading-5 text-slate-600">
                        {warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
            </div>
          </details>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 공식 전환 전에 기존 데이터 채우기, 점수 반영, AI 제외, 등급, 공식 저장 점수/등급 쓰기 조건을 읽기 전용으로 점검할 수 있습니다.
          확인 대상: 기존 데이터 실제 반영 조건, 공식 점수 반영 조건, AI 점수 제외 조건, 공식 등급 반영 조건,
          Evaluation.totalScore 쓰기 조건, Evaluation.gradeId 쓰기 조건.
        </div>
      )}

      {exportPreview ? (
        <ReadinessExportPreviewDialog
          open={Boolean(exportPreview)}
          onOpenChange={(open) => {
            if (!open) setExportPreview(null)
          }}
          title={exportPreview.title}
          description={exportPreview.description}
          content={exportPreview.content}
          format={exportPreview.format}
          suggestedFilename={exportPreview.fileName}
          allowDownload
          copied={exportPreviewCopied}
          onCopy={() => void copyExportPreviewToClipboard()}
          onDownload={downloadExportPreview}
        />
      ) : null}
    </Panel>
  )
}

function DedicatedWorkbenchPilotRoute2026(props: {
  pilot: EndToEndPilot2026 | null
  loading: boolean
  error: string
  onLoad: () => void
  onExportPreview: (key: string, text: string) => void
}) {
  const { pilot, loading, error } = props

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600">
                2026 평가 워크벤치 미리보기
              </p>
              <Badge tone="neutral">전용 화면</Badge>
              <Badge tone="warn">미리보기 전용</Badge>
              <Badge tone="neutral">공식 저장 비활성</Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">2026 평가 워크벤치 미리보기</h1>
            <p className="max-w-4xl text-sm leading-6 text-slate-600">
              이 화면은 실제 평가 워크벤치 흐름을 미리보기로 체험하기 위한 전용 화면입니다. 입력값은 저장되지 않으며,
              공식 저장, 제출, 확정, 점수 반영, 등급 반영은 수행하지 않습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/evaluation/performance"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              준비 상태 화면으로 돌아가기
            </Link>
            <button
              type="button"
              onClick={props.onLoad}
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-cyan-200"
            >
              {loading ? '미리보기 불러오는 중...' : '파일럿 미리보기 다시 불러오기'}
            </button>
          </div>
        </div>
      </section>

      {error ? <Banner tone="error" message={error} /> : null}

      {loading && !pilot ? (
        <section className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50 p-6 text-sm text-cyan-900">
          2026 워크벤치 파일럿 데이터를 불러오는 중입니다. 이 동작은 읽기 전용 조회이며 저장, 제출, 확정을 수행하지 않습니다.
        </section>
      ) : null}

      {!loading && !error && !pilot ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          2026 평가 워크벤치 미리보기 데이터를 아직 확인하지 못했습니다. 위 버튼으로 미리보기 전용 데이터를 다시 조회하세요.
          공식 평가 생성, 공식 저장 점수(totalScore) 쓰기, 공식 저장 등급(gradeId) 쓰기는 수행하지 않습니다.
        </section>
      ) : null}

      {pilot ? (
        <WorkbenchPilotAlignment2026
          pilot={pilot}
          onExportPreview={props.onExportPreview}
          surface="dedicated"
        />
      ) : null}
    </div>
  )
}

function ReadinessExportPreviewDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  content: string
  format: ReadinessExportPreviewFormat
  suggestedFilename: string
  allowDownload: boolean
  copied: boolean
  onCopy: () => void
  onDownload: () => void
}) {
  if (!props.open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="readiness-export-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={() => props.onOpenChange(false)}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 id="readiness-export-preview-title" className="text-base font-semibold text-slate-900">
                {props.title}
              </h4>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {props.format}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                읽기 전용 미리보기
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{props.description}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">파일: {props.suggestedFilename}</p>
          </div>
          <button
            type="button"
            onClick={() => props.onOpenChange(false)}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <textarea
            readOnly
            value={props.content}
            className="h-[52vh] w-full resize-none rounded-2xl border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-50 outline-none"
            aria-label="준비 상태 내보내기 미리보기 내용"
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            저장, 제출, 사전 실행 검토, 실제 반영, 기존 데이터 채우기, 점수/등급 실행 없이 브라우저에서만 미리보고 복사합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={props.onCopy}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {props.copied ? '복사되었습니다.' : '클립보드 복사'}
            </button>
            {props.allowDownload ? (
              <button
                type="button"
                onClick={props.onDownload}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                다운로드
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => props.onOpenChange(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InteractivePilotWalkthrough2026(props: {
  pilot: EndToEndPilot2026
  onExportPreview: (key: string, text: string) => void
}) {
  const { pilot } = props
  const [activeStep, setActiveStep] = useState<InteractivePilotStepId2026>('TARGET')
  const [inputs, setInputs] = useState<InteractivePilotLocalInputs2026>(() => createInitialInteractivePilotInputs2026(pilot))

  const selectedKpi = useMemo(
    () => pilot.pilotKpis.find((item) => item.id === inputs.selectedKpiId) ?? pilot.pilotKpis[0] ?? null,
    [inputs.selectedKpiId, pilot.pilotKpis]
  )
  const selectedBaseScore = clampPilotScore2026(parsePilotNumber2026(inputs.localBaseScore, selectedKpi?.previewScore ?? 90))
  const firstReviewerScore = clampPilotScore2026(parsePilotNumber2026(inputs.firstReviewerScore, selectedBaseScore))
  const finalReviewerScore = clampPilotScore2026(parsePilotNumber2026(inputs.finalReviewerScore, firstReviewerScore))
  const firstAdjustmentAmount = parsePilotNumber2026(inputs.firstAdjustmentAmount, 0)
  const finalAdjustmentAmount = parsePilotNumber2026(inputs.finalAdjustmentAmount, 0)
  const ceoAdjustmentAmount = parsePilotNumber2026(inputs.ceoAdjustmentAmount, 0)
  const firstAdjustmentNeedsReason = firstAdjustmentAmount !== 0 && !inputs.firstAdjustmentReason.trim()
  const finalAdjustmentNeedsReason = finalAdjustmentAmount !== 0 && !inputs.finalAdjustmentReason.trim()
  const ceoAdjustmentNeedsReason = ceoAdjustmentAmount !== 0 && !inputs.ceoAdjustmentReason.trim()

  const localScorePreview = useMemo(() => {
    const rows = pilot.pilotKpis.map((item) => {
      const isSelected = selectedKpi?.id === item.id
      const previewScore = isSelected ? selectedBaseScore : item.previewScore
      return {
        ...item,
        previewScore,
        contributionType: item.category === 'ORG_GOAL' ? 'ORGANIZATION' as const : 'PERSONAL' as const,
      }
    })
    const weightedAverage = (items: typeof rows) => {
      const totalWeight = items.reduce((sum, item) => sum + Math.max(item.weight, 0), 0)
      if (!items.length || totalWeight <= 0) return null
      return items.reduce((sum, item) => sum + item.previewScore * Math.max(item.weight, 0), 0) / totalWeight
    }
    const organizationScore = weightedAverage(rows.filter((item) => item.category === 'ORG_GOAL')) ?? pilot.scorePreview.organizationPerformanceScore ?? selectedBaseScore
    const personalScoreRaw = weightedAverage(rows.filter((item) => item.category !== 'ORG_GOAL')) ?? pilot.scorePreview.personalPerformanceScore ?? selectedBaseScore
    const reviewerInfluence = (firstReviewerScore + finalReviewerScore) / 2
    const personalScore = clampPilotScore2026((personalScoreRaw * 0.7) + (reviewerInfluence * 0.3))
    const baseScore = clampPilotScore2026((organizationScore * 0.3) + (personalScore * 0.7))
    const adjustedScore = clampPilotScore2026(baseScore + firstAdjustmentAmount + finalAdjustmentAmount + ceoAdjustmentAmount)

    return {
      rows,
      organizationScore,
      personalScore,
      baseScore,
      adjustedScore,
    }
  }, [
    ceoAdjustmentAmount,
    finalAdjustmentAmount,
    finalReviewerScore,
    firstAdjustmentAmount,
    firstReviewerScore,
    pilot.pilotKpis,
    pilot.scorePreview.organizationPerformanceScore,
    pilot.scorePreview.personalPerformanceScore,
    selectedBaseScore,
    selectedKpi?.id,
  ])
  const localGradePreview = getInteractivePilotGradeLabel2026(localScorePreview.adjustedScore, pilot.gradePreview.gradePreview)
  const targetStep = pilot.workflowSteps.find((item) => item.id === 'TARGET_SELECTION')
  const kpiStep = pilot.workflowSteps.find((item) => item.id === 'KPI_ITEMS')
  const selfStep = pilot.workflowSteps.find((item) => item.id === 'SELF_EVALUATION')
  const firstStep = pilot.workflowSteps.find((item) => item.id === 'FIRST_REVIEW')
  const secondStep = pilot.workflowSteps.find((item) => item.id === 'SECOND_FINAL_REVIEW')
  const scoreStep = pilot.workflowSteps.find((item) => item.id === 'SCORE_PREVIEW')
  const gradeStep = pilot.workflowSteps.find((item) => item.id === 'GRADE_PREVIEW')
  const ceoStep = pilot.workflowSteps.find((item) => item.id === 'CEO_FINAL_CONFIRMATION_PREVIEW')
  const safetyStep = pilot.workflowSteps.find((item) => item.id === 'SAFETY_CONFIRMATION')
  const stepDefinitions = [
    { id: 'TARGET' as const, order: 1, label: '대상자', source: targetStep, complete: true },
    { id: 'KPI' as const, order: 2, label: 'KPI 항목', source: kpiStep, complete: Boolean(selectedKpi) },
    { id: 'SELF' as const, order: 3, label: '자기평가 미리보기', source: selfStep, complete: Boolean(inputs.selfResultSummary.trim() && inputs.selfContributionComment.trim()) },
    { id: 'FIRST' as const, order: 4, label: '1차 평가 미리보기', source: firstStep, complete: Boolean(inputs.firstReviewerComment.trim()) && !firstAdjustmentNeedsReason },
    { id: 'SECOND_FINAL' as const, order: 5, label: '2차/최종 평가 미리보기', source: secondStep, complete: Boolean(inputs.finalReviewerComment.trim()) && !finalAdjustmentNeedsReason },
    { id: 'SCORE' as const, order: 6, label: '점수 미리보기', source: scoreStep, complete: Number.isFinite(localScorePreview.adjustedScore) },
    { id: 'GRADE' as const, order: 7, label: '등급 미리보기', source: gradeStep, complete: Boolean(localGradePreview) },
    { id: 'CEO' as const, order: 8, label: '대표이사 조정 미리보기', source: ceoStep, complete: inputs.ceoChecklistNoWrite && !ceoAdjustmentNeedsReason },
    { id: 'SAFETY' as const, order: 9, label: '안전 확인', source: safetyStep, complete: true },
  ]
  const completedStepCount = stepDefinitions.filter((item) => item.complete).length
  const completionPercentage = Math.round((completedStepCount / stepDefinitions.length) * 100)
  const activeStepDefinition = stepDefinitions.find((item) => item.id === activeStep) ?? stepDefinitions[0]
  const unresolvedOfficialBlockers = pilot.blockers.length ? pilot.blockers : ['공식 실행 전 차단 조건 없음']
  const markdownExport = formatInteractivePilotMarkdown2026({
    pilot,
    inputs,
    selectedKpiTitle: selectedKpi?.title ?? 'KPI 미리보기 대기',
    localFinalScore: localScorePreview.adjustedScore,
    localGrade: localGradePreview,
    completionPercentage,
    completedStepCount,
    activeStepLabel: activeStepDefinition.label,
  })
  const tsvExport = formatInteractivePilotTsv2026({
    pilot,
    selectedKpiTitle: selectedKpi?.title ?? 'KPI 미리보기 대기',
    localFinalScore: localScorePreview.adjustedScore,
    localGrade: localGradePreview,
    completionPercentage,
  })
  const updateInput = <Key extends keyof InteractivePilotLocalInputs2026>(key: Key, value: InteractivePilotLocalInputs2026[Key]) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }
  const moveToNextStep = () => {
    const currentIndex = stepDefinitions.findIndex((item) => item.id === activeStep)
    const next = stepDefinitions[Math.min(currentIndex + 1, stepDefinitions.length - 1)]
    setActiveStep(next.id)
  }

  const exportItems = [
    {
      key: 'interactive-pilot-summary',
      label: '미리보기 요약 보기',
      text: [
        `2026 단계별 체험 미리보기`,
        `완료율: ${completionPercentage}% (${completedStepCount}/9)`,
        `현재 단계: ${activeStepDefinition.label}`,
        `선택 KPI: ${selectedKpi?.title ?? '대기'}`,
        `점수 미리보기: ${localScorePreview.adjustedScore.toFixed(1)}`,
        `등급 미리보기: ${localGradePreview}`,
        `공식 차단 조건: ${unresolvedOfficialBlockers.join(', ')}`,
        `안전: 공식 저장 없음, API 쓰기 호출 없음`,
      ].join('\n'),
    },
    {
      key: 'interactive-pilot-self-evaluation',
      label: '자기평가 미리보기',
      text: [inputs.selfResultSummary, inputs.selfContributionComment, inputs.selfRiskComment, `증빙: ${inputs.selfEvidenceLink || '누락 주의'}`].join('\n'),
    },
    {
      key: 'interactive-pilot-first-review',
      label: '1차 평가 미리보기',
      text: [inputs.firstReviewerComment, `점수: ${firstReviewerScore}`, `조정값: ${firstAdjustmentAmount}`, inputs.firstAdjustmentReason || '조정값이 0이면 조정 사유가 필요 없습니다', inputs.firstFeedbackToEmployee].join('\n'),
    },
    {
      key: 'interactive-pilot-final-review',
      label: '최종 평가 미리보기',
      text: [inputs.finalReviewerComment, `점수: ${finalReviewerScore}`, `조정값: ${finalAdjustmentAmount}`, inputs.finalAdjustmentReason || '조정값이 0이면 조정 사유가 필요 없습니다', inputs.finalRecommendation].join('\n'),
    },
    {
      key: 'interactive-pilot-score-grade',
      label: '점수/등급 미리보기',
      text: [`점수 미리보기: ${localScorePreview.adjustedScore.toFixed(1)}`, `등급 미리보기: ${localGradePreview}`, '공식 저장 점수(totalScore) 쓰기: false', '공식 저장 등급(gradeId) 쓰기: false'].join('\n'),
    },
    {
      key: 'interactive-pilot-safety-summary',
      label: '안전 확인 요약 보기',
      text: ['공식 점수 반영 false', '공식 등급 반영 false', 'AI 제외 활성화 false', '공식 저장 점수(totalScore) 쓰기 false', '공식 저장 등급(gradeId) 쓰기 false', '공식 Evaluation/EvaluationItem 생성 false', '기존 데이터 채우기/실제 반영 false', '기능 활성화 스위치 변경 false', 'API 쓰기 호출 없음'].join('\n'),
    },
    { key: 'interactive-pilot-export-markdown', label: '마크다운 내보내기', text: markdownExport },
    { key: 'interactive-pilot-export-tsv', label: 'TSV 내보내기', text: tsvExport },
  ]

  return (
    <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-slate-900">2026 단계별 체험 미리보기</h5>
            <Badge tone="neutral">로컬 전용</Badge>
            <Badge tone={pilot.summary.currentDecision === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : 'success'}>
              {formatReadinessUiStatus2026(pilot.summary.currentDecision)}
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            이 화면은 2026 평가 흐름을 로컬 미리보기로 체험하기 위한 화면입니다. 입력값은 저장되지 않으며, 공식 평가 생성,
            공식 점수, 공식 등급, 공식 저장 점수(totalScore), 공식 저장 등급(gradeId), 기존 데이터 채우기는 실행하지 않습니다.
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-white p-3 text-xs leading-5 text-indigo-900">
          <p className="font-semibold">로컬 요약</p>
          <p>{completedStepCount}/9 로컬 단계 · {completionPercentage}% 완료</p>
          <p>공식 차단 조건: {pilot.blockers.length.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="파일럿 완료율" value={`${completionPercentage}%`} help={`${completedStepCount}개 로컬 단계 완료`} compact />
        <MetricCard label="선택 대상자" value={pilot.pilotEmployee.name} help={pilot.pilotEmployee.departmentName} compact />
        <MetricCard label="로컬 점수 미리보기" value={localScorePreview.adjustedScore.toFixed(1)} help="공식 저장 점수(totalScore) 쓰기 false" compact />
        <MetricCard label="로컬 등급 미리보기" value={localGradePreview} help="공식 저장 등급(gradeId) 쓰기 false" compact />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-9">
        {stepDefinitions.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(step.id)}
            className={`rounded-xl border px-3 py-3 text-left text-xs transition ${activeStep === step.id ? 'border-indigo-300 bg-white shadow-sm' : 'border-slate-200 bg-white/70 hover:bg-white'}`}
          >
            <span className="block font-semibold text-slate-900">{step.order}. {step.label}</span>
            <span className="mt-2 flex flex-wrap gap-1">
              <Badge tone={step.source?.status === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : step.source?.status === 'BLOCKED' ? 'error' : 'success'}>
                {formatReadinessUiStatus2026(step.source?.status ?? 'PREVIEW_ONLY')}
              </Badge>
              <Badge tone={step.complete ? 'success' : 'warn'}>{step.complete ? '로컬 완료' : '로컬 입력 가능'}</Badge>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h6 className="text-sm font-semibold text-slate-900">{activeStepDefinition.order}. {activeStepDefinition.label}</h6>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              공식 차단 조건 주의: {activeStepDefinition.source?.blockedBy.length ? activeStepDefinition.source.blockedBy.join(', ') : '현재 단계 미리보기 기준 차단 조건 없음'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              공식 진행 시점: {activeStepDefinition.source?.officialLater ?? '공식 실행은 별도 승인 후에만 가능합니다.'}
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-700">
              안전 메모: {activeStepDefinition.source?.safetyNote ?? '로컬 미리보기 전용, 공식 저장 없음'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputs(createInitialInteractivePilotInputs2026(pilot))
              setActiveStep('TARGET')
            }}
            className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            로컬 입력 초기화
          </button>
        </div>

        {activeStep === 'TARGET' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">파일럿 대상자</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{pilot.pilotEmployee.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{pilot.pilotEmployee.departmentName} · {pilot.pilotEmployee.employeeNo ?? 'employeeNo 미확인'}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">출처: {pilot.pilotEmployee.source}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">확정 KPI 수: {pilot.pilotEmployee.confirmedPersonalKpiCount}</p>
              {pilot.pilotEmployee.source === 'SAMPLE_PILOT_FIXTURE' ? (
                <p className="mt-2 text-xs leading-5 text-amber-800">SAMPLE/PILOT fallback 대상자입니다. 공식 대상자 선정은 아직 수행하지 않습니다.</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-900">선택 방식</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                현재 pilot helper가 제공하는 대상자는 1명입니다. 여러 pilot sample이 제공되면 이 단계에서 대상자를 선택할 수 있습니다.
              </p>
              <p className="mt-2 text-xs leading-5 text-emerald-700">대상자 선택은 로컬 상태만 사용하며 공식 인원 생성 실제 반영을 호출하지 않습니다.</p>
            </div>
          </div>
        ) : null}

        {activeStep === 'KPI' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="text-xs font-semibold text-slate-900" htmlFor="interactive-pilot-kpi-select">KPI 항목 미리보기</label>
              <select
                id="interactive-pilot-kpi-select"
                value={selectedKpi?.id ?? ''}
                onChange={(event) => {
                  const next = pilot.pilotKpis.find((item) => item.id === event.target.value)
                  setInputs((current) => ({
                    ...current,
                    selectedKpiId: event.target.value,
                    localAchievementLevel: next?.achievementLevel === 'EXCELLENT' ? 'EXCELLENT' : next?.achievementLevel === 'CUSTOM' ? 'CUSTOM' : 'TARGET',
                    localBaseScore: next?.previewScore != null ? String(next.previewScore) : current.localBaseScore,
                  }))
                }}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {pilot.pilotKpis.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  달성 수준
                  <select
                    value={inputs.localAchievementLevel}
                    onChange={(event) => updateInput('localAchievementLevel', event.target.value as InteractivePilotLocalInputs2026['localAchievementLevel'])}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="BELOW_TARGET">BELOW_TARGET</option>
                    <option value="TARGET">TARGET</option>
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  로컬 기준 점수
                  <input
                    value={inputs.localBaseScore}
                    onChange={(event) => updateInput('localBaseScore', event.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-emerald-700">EvaluationItem을 생성하지 않습니다. KPI 항목 미리보기는 브라우저 로컬 상태만 변경합니다.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-900">KPI 상세</p>
              {selectedKpi ? (
                <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-600">
                  <p>제목: {selectedKpi.title}</p>
                  <p>분류: {selectedKpi.category}</p>
                  <p>가중치: {selectedKpi.weight}</p>
                  <p>목표: SAMPLE/PILOT 대상 증빙과 결과 요약</p>
                  <p>증빙 기대값: 결과 요약, 월별 증빙, 기여도 코멘트</p>
                  <p className="text-amber-800">정책 분류 주의: {pilot.evaluationItemPreview.find((item) => item.personalKpiId === selectedKpi.id)?.policyCategoryWarning ?? '공식 정책 분류 주의 없음'}</p>
                  <p className="text-amber-800">가중치/상한 주의: 미리보기 점수는 0~120 범위로 제한되며, 준비 상태가 불완전하면 공식 정책은 쓰기를 계속 차단합니다.</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeStep === 'SELF' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-xs font-semibold text-slate-700">
                달성 수준
                <input value={inputs.localAchievementLevel} readOnly className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                결과 요약
                <textarea value={inputs.selfResultSummary} onChange={(event) => updateInput('selfResultSummary', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                증빙 링크
                <input value={inputs.selfEvidenceLink} onChange={(event) => updateInput('selfEvidenceLink', event.target.value)} placeholder="로컬 전용 미리보기 URL 또는 메모" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <label className="block text-xs font-semibold text-slate-700">
                기여도 코멘트
                <textarea value={inputs.selfContributionComment} onChange={(event) => updateInput('selfContributionComment', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                위험/해소 필요 코멘트
                <textarea value={inputs.selfRiskComment} onChange={(event) => updateInput('selfRiskComment', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <p>결과 누락 경고: {inputs.selfResultSummary.trim() ? '로컬 미리보기 기준 통과' : '결과 요약이 비어 있습니다'}</p>
                <p>증빙 누락 경고: {inputs.selfEvidenceLink.trim() ? '로컬 증빙 참고가 입력되었습니다' : '증빙 링크가 비어 있습니다. 이후 수동 증빙 메모가 필요합니다'}</p>
                <p>기여도 누락 경고: {inputs.selfContributionComment.trim() ? '로컬 미리보기 기준 통과' : '기여도 코멘트가 비어 있습니다'}</p>
              </div>
            </div>
          </div>
        ) : null}

        {activeStep === 'FIRST' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-xs font-semibold text-slate-700">
                1차 평가자 코멘트
                <textarea value={inputs.firstReviewerComment} onChange={(event) => updateInput('firstReviewerComment', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  평가자 점수 미리보기
                  <input value={inputs.firstReviewerScore} onChange={(event) => updateInput('firstReviewerScore', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  조정값 미리보기
                  <input value={inputs.firstAdjustmentAmount} onChange={(event) => updateInput('firstAdjustmentAmount', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <label className="block text-xs font-semibold text-slate-700">
                조정 사유
                <textarea value={inputs.firstAdjustmentReason} onChange={(event) => updateInput('firstAdjustmentReason', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                직원 피드백
                <textarea value={inputs.firstFeedbackToEmployee} onChange={(event) => updateInput('firstFeedbackToEmployee', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {firstAdjustmentNeedsReason ? '조정값이 0이 아니면 조정 사유가 필요합니다.' : '로컬 미리보기 기준 조정 사유 검증을 통과했습니다.'} 공식 실행 전 평가자 배정 차단 경고는 계속 표시됩니다.
              </p>
            </div>
          </div>
        ) : null}

        {activeStep === 'SECOND_FINAL' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="block text-xs font-semibold text-slate-700">
                2차/최종 평가자 코멘트
                <textarea value={inputs.finalReviewerComment} onChange={(event) => updateInput('finalReviewerComment', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  최종 평가자 점수 미리보기
                  <input value={inputs.finalReviewerScore} onChange={(event) => updateInput('finalReviewerScore', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  조정값 미리보기
                  <input value={inputs.finalAdjustmentAmount} onChange={(event) => updateInput('finalAdjustmentAmount', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <label className="block text-xs font-semibold text-slate-700">
                조정 사유
                <textarea value={inputs.finalAdjustmentReason} onChange={(event) => updateInput('finalAdjustmentReason', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                최종 권고
                <textarea value={inputs.finalRecommendation} onChange={(event) => updateInput('finalRecommendation', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {finalAdjustmentNeedsReason ? '최종 조정값이 0이 아니면 조정 사유가 필요합니다.' : '로컬 미리보기 기준 최종 조정 검증을 통과했습니다.'} 평가 체인과 이전 단계 의존성은 공식 실행 차단 조건으로 남아 있습니다.
              </p>
            </div>
          </div>
        ) : null}

        {activeStep === 'SCORE' ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard label="조직성과" value={localScorePreview.organizationScore.toFixed(1)} help="30%" compact />
              <MetricCard label="개인성과" value={localScorePreview.personalScore.toFixed(1)} help="70%" compact />
              <MetricCard label="기준 점수 미리보기" value={localScorePreview.baseScore.toFixed(1)} help="로컬 입력" compact />
              <MetricCard label="조정 점수 미리보기" value={localScorePreview.adjustedScore.toFixed(1)} help="저장 안 함" compact />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-left text-xs">
                <thead className="text-blue-700">
                  <tr>
                    <th className="px-2 py-2 font-semibold">분류</th>
                    <th className="px-2 py-2 font-semibold">유형</th>
                    <th className="px-2 py-2 font-semibold">로컬 점수</th>
                    <th className="px-2 py-2 font-semibold">가중치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {localScorePreview.rows.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-2">{item.category}</td>
                      <td className="px-2 py-2">{item.contributionType}</td>
                      <td className="px-2 py-2">{item.previewScore.toFixed(1)}</td>
                      <td className="px-2 py-2">{item.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-blue-900">공식 저장 점수(totalScore) 쓰기: false · 공식 점수 반영 활성화: false · AI는 연간 업적평가 점수에서 제외됩니다.</p>
          </div>
        ) : null}

        {activeStep === 'GRADE' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-semibold text-violet-900">등급 미리보기</p>
              <p className="mt-2 text-2xl font-semibold text-violet-950">{localGradePreview}</p>
              <p className="mt-2 text-xs leading-5 text-violet-900">점수-등급 로컬 매핑: {localScorePreview.adjustedScore.toFixed(1)} -&gt; {localGradePreview}</p>
              <p className="mt-1 text-xs leading-5 text-violet-900">등급 그룹: {pilot.gradePreview.applicableGroup}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              <p className="font-semibold">정책 주의</p>
              <p>{pilot.gradePreview.blockers.length ? pilot.gradePreview.blockers.join(', ') : '등급 정책 미리보기 기준 해소 필요 항목 없음'}</p>
              <p className="mt-2">공식 저장 등급(gradeId) 쓰기: false · 공식 등급 반영 활성화: false.</p>
            </div>
          </div>
        ) : null}

        {activeStep === 'CEO' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <label className="block text-xs font-semibold text-sky-900">
                대표이사 조정 미리보기
                <input value={inputs.ceoAdjustmentAmount} onChange={(event) => updateInput('ceoAdjustmentAmount', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-sky-900">
                조정 사유
                <textarea value={inputs.ceoAdjustmentReason} onChange={(event) => updateInput('ceoAdjustmentReason', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="block text-xs font-semibold text-sky-900">
                최종 메모
                <textarea value={inputs.ceoFinalNote} onChange={(event) => updateInput('ceoFinalNote', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-900">확인 점검 목록</p>
              {[
                ['ceoChecklistEvidence', '증빙 패키지 로컬 검토'],
                ['ceoChecklistCalibration', '캘리브레이션 차단 조건 로컬 검토'],
                ['ceoChecklistNoWrite', '최종 확정 쓰기 없음'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(inputs[key as keyof InteractivePilotLocalInputs2026])}
                    onChange={(event) => updateInput(key as keyof InteractivePilotLocalInputs2026, event.target.checked as never)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {label}
                </label>
              ))}
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {ceoAdjustmentNeedsReason ? '대표이사 조정값이 0이 아니면 사유가 필요합니다.' : '로컬 미리보기 기준 대표이사 조정 검증을 통과했습니다.'} 최종 확정/대표이사 및 캘리브레이션 차단 조건은 공식 차단 조건으로 남아 있습니다.
              </p>
            </div>
          </div>
        ) : null}

        {activeStep === 'SAFETY' ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['공식 점수 반영 false', String(pilot.safety.officialScoringEnabled)],
              ['공식 등급 반영 false', String(pilot.safety.officialGradeEnabled)],
              ['AI 제외 활성화 false', String(pilot.safety.officialAiScoreExclusionEnabled)],
              ['공식 저장 점수(totalScore) 쓰기 false', String(pilot.safety.totalScoreChanged)],
              ['공식 저장 등급(gradeId) 쓰기 false', String(pilot.safety.gradeIdChanged)],
              ['공식 Evaluation 생성 false', String(pilot.safety.officialEvaluationsCreated)],
              ['공식 EvaluationItem 생성 false', String(pilot.safety.officialEvaluationItemsCreated)],
              ['기존 데이터 채우기/실제 반영 false', `${String(pilot.safety.backfillExecuted)} / ${String(pilot.safety.backfillApplyExecuted)}`],
              ['기능 활성화 스위치 변경 false', String(pilot.safety.featureFlagsChanged)],
              ['API 쓰기 호출 없음', 'true'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                <p className="font-semibold">{label}</p>
                <p>{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={moveToNextStep}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white transition hover:bg-indigo-600"
          >
            다음 단계 미리보기
          </button>
          <button
            type="button"
            onClick={moveToNextStep}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-indigo-300 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            미리보기 반영
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h6 className="text-sm font-semibold text-slate-900">단계별 체험 미리보기 내보내기</h6>
            <p className="mt-1 text-xs leading-5 text-slate-500">클릭하면 내용을 먼저 미리보고 복사/다운로드할 수 있습니다.</p>
          </div>
          <Badge tone="neutral">복사/내보내기 전용</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {exportItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => props.onExportPreview(item.key, item.text)}
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function WorkbenchPilotAlignment2026(props: {
  pilot: EndToEndPilot2026
  onExportPreview: (key: string, text: string) => void
  surface?: 'embedded' | 'dedicated'
}) {
  const { pilot } = props
  const [activeStage, setActiveStage] = useState<WorkbenchPilotAlignmentStage2026>(
    props.surface === 'dedicated' ? 'TARGET' : 'SELF'
  )
  const [inputs, setInputs] = useState<InteractivePilotLocalInputs2026>(() => createInitialInteractivePilotInputs2026(pilot))
  const [itemDrafts, setItemDrafts] = useState<Record<string, WorkbenchPilotItemDraft2026>>(() =>
    createInitialWorkbenchPilotItemDrafts2026(pilot)
  )
  const selectedKpi = pilot.pilotKpis.find((item) => item.id === inputs.selectedKpiId) ?? pilot.pilotKpis[0] ?? null
  const selectedItemDraft =
    selectedKpi
      ? itemDrafts[selectedKpi.id] ?? createWorkbenchPilotItemDraft2026(selectedKpi, 0)
      : null
  const selectedBaseScore = clampPilotScore2026(
    parsePilotNumber2026(selectedItemDraft?.selfScorePreview ?? inputs.localBaseScore, selectedKpi?.previewScore ?? 90)
  )
  const firstReviewerScore = clampPilotScore2026(parsePilotNumber2026(selectedItemDraft?.firstReviewerScore ?? inputs.firstReviewerScore, selectedBaseScore))
  const finalReviewerScore = clampPilotScore2026(parsePilotNumber2026(selectedItemDraft?.finalReviewerScore ?? inputs.finalReviewerScore, firstReviewerScore))
  const firstAdjustmentAmount = parsePilotNumber2026(selectedItemDraft?.firstAdjustmentAmount ?? inputs.firstAdjustmentAmount, 0)
  const finalAdjustmentAmount = parsePilotNumber2026(selectedItemDraft?.finalAdjustmentAmount ?? inputs.finalAdjustmentAmount, 0)
  const ceoAdjustmentAmount = parsePilotNumber2026(selectedItemDraft?.ceoAdjustmentAmount ?? inputs.ceoAdjustmentAmount, 0)
  const firstAdjustmentNeedsReason = firstAdjustmentAmount !== 0 && !(selectedItemDraft?.firstAdjustmentReason ?? inputs.firstAdjustmentReason).trim()
  const finalAdjustmentNeedsReason = finalAdjustmentAmount !== 0 && !(selectedItemDraft?.finalAdjustmentReason ?? inputs.finalAdjustmentReason).trim()
  const ceoAdjustmentNeedsReason = ceoAdjustmentAmount !== 0 && !(selectedItemDraft?.ceoAdjustmentReason ?? inputs.ceoAdjustmentReason).trim()
  const organizationScore = pilot.scorePreview.organizationPerformanceScore ?? selectedBaseScore
  const personalScore = clampPilotScore2026(((firstReviewerScore + finalReviewerScore) / 2 * 0.45) + (selectedBaseScore * 0.55))
  const baseScorePreview = clampPilotScore2026((organizationScore * 0.3) + (personalScore * 0.7))
  const adjustedScorePreview = clampPilotScore2026(baseScorePreview + firstAdjustmentAmount + finalAdjustmentAmount + ceoAdjustmentAmount)
  const gradePreview = getInteractivePilotGradeLabel2026(adjustedScorePreview, pilot.gradePreview.gradePreview)
  const selfStep = pilot.workflowSteps.find((item) => item.id === 'SELF_EVALUATION')
  const firstStep = pilot.workflowSteps.find((item) => item.id === 'FIRST_REVIEW')
  const secondStep = pilot.workflowSteps.find((item) => item.id === 'SECOND_FINAL_REVIEW')
  const scoreStep = pilot.workflowSteps.find((item) => item.id === 'SCORE_PREVIEW')
  const gradeStep = pilot.workflowSteps.find((item) => item.id === 'GRADE_PREVIEW')
  const ceoStep = pilot.workflowSteps.find((item) => item.id === 'CEO_FINAL_CONFIRMATION_PREVIEW')
  const safetyStep = pilot.workflowSteps.find((item) => item.id === 'SAFETY_CONFIRMATION')
  const targetStep = pilot.workflowSteps.find((item) => item.id === 'TARGET_SELECTION')
  const kpiStep = pilot.workflowSteps.find((item) => item.id === 'KPI_ITEMS')
  const stageRows = [
    { id: 'TARGET' as const, label: '대상자', source: targetStep, localReady: true },
    { id: 'KPI' as const, label: 'KPI', source: kpiStep, localReady: Boolean(selectedKpi) },
    { id: 'SELF' as const, label: '자기평가', source: selfStep, localReady: Boolean(inputs.selfResultSummary.trim() && inputs.selfContributionComment.trim()) },
    { id: 'FIRST' as const, label: '1차 평가', source: firstStep, localReady: Boolean(inputs.firstReviewerComment.trim()) && !firstAdjustmentNeedsReason },
    { id: 'SECOND' as const, label: '2차 평가', source: secondStep, localReady: Boolean(inputs.finalReviewerComment.trim()) && !finalAdjustmentNeedsReason },
    { id: 'FINAL' as const, label: '최종 평가', source: secondStep, localReady: Boolean(inputs.finalRecommendation.trim()) && !finalAdjustmentNeedsReason },
    { id: 'CEO_ADJUST' as const, label: '대표이사 조정', source: ceoStep, localReady: !ceoAdjustmentNeedsReason },
    { id: 'SCORE_PREVIEW' as const, label: '점수 미리보기', source: scoreStep, localReady: Number.isFinite(adjustedScorePreview) },
    { id: 'GRADE_PREVIEW' as const, label: '등급 미리보기', source: gradeStep, localReady: Boolean(gradePreview) },
    { id: 'SAFETY' as const, label: '안전 확인', source: safetyStep, localReady: true },
  ]
  const activeRow = stageRows.find((item) => item.id === activeStage) ?? stageRows[0]
  const updateInput = <Key extends keyof InteractivePilotLocalInputs2026>(key: Key, value: InteractivePilotLocalInputs2026[Key]) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }
  const updateSelectedItemDraft = <Key extends keyof WorkbenchPilotItemDraft2026>(
    key: Key,
    value: WorkbenchPilotItemDraft2026[Key]
  ) => {
    if (!selectedKpi) return
    setItemDrafts((current) => ({
      ...current,
      [selectedKpi.id]: {
        ...(current[selectedKpi.id] ?? createWorkbenchPilotItemDraft2026(selectedKpi, 0)),
        [key]: value,
      },
    }))
  }
  const resetLocalPreviewState = () => {
    setInputs(createInitialInteractivePilotInputs2026(pilot))
    setItemDrafts(createInitialWorkbenchPilotItemDrafts2026(pilot))
  }
  const itemRows: WorkbenchPilotItemRow2026[] = pilot.pilotKpis.map((item, index) => {
    const draft = itemDrafts[item.id] ?? createWorkbenchPilotItemDraft2026(item, index)
    const policyPreview = pilot.evaluationItemPreview.find((previewItem) => previewItem.personalKpiId === item.id)
    const itemSelfScore = clampPilotScore2026(parsePilotNumber2026(draft.selfScorePreview, item.previewScore ?? 90))
    const itemFirstScore = clampPilotScore2026(parsePilotNumber2026(draft.firstReviewerScore, itemSelfScore))
    const itemFinalScore = clampPilotScore2026(parsePilotNumber2026(draft.finalReviewerScore, itemFirstScore))
    const itemFirstAdjustment = parsePilotNumber2026(draft.firstAdjustmentAmount, 0)
    const itemFinalAdjustment = parsePilotNumber2026(draft.finalAdjustmentAmount, 0)
    const itemCeoAdjustment = parsePilotNumber2026(draft.ceoAdjustmentAmount, 0)
    const firstNeedsReason = itemFirstAdjustment !== 0 && !draft.firstAdjustmentReason.trim()
    const finalNeedsReason = itemFinalAdjustment !== 0 && !draft.finalAdjustmentReason.trim()
    const ceoNeedsReason = itemCeoAdjustment !== 0 && !draft.ceoAdjustmentReason.trim()
    const warnings = [
      draft.selfResultSummary.trim() ? '' : 'SELF result missing',
      draft.selfEvidenceLink.trim() ? '' : 'evidence link missing',
      draft.selfContribution.trim() ? '' : 'contribution missing',
      policyPreview?.policyCategoryWarning ?? '',
      firstNeedsReason ? 'FIRST adjustment reason required' : '',
      finalNeedsReason ? 'SECOND/FINAL adjustment reason required' : '',
      ceoNeedsReason ? 'CEO adjustment reason required' : '',
      itemSelfScore < 0 || itemSelfScore > 120 ? 'self score range warning' : '',
      itemFirstScore < 0 || itemFirstScore > 120 ? 'first score range warning' : '',
      itemFinalScore < 0 || itemFinalScore > 120 ? 'final score range warning' : '',
    ].filter(Boolean)

    return {
      kpi: item,
      draft,
      policyCategoryWarning: policyPreview?.policyCategoryWarning ?? null,
      evidenceStatus: draft.selfEvidenceLink.trim() ? 'READY' : 'WARNING',
      selfStatus: draft.selfResultSummary.trim() && draft.selfContribution.trim() ? 'READY' : 'NEEDS_INPUT',
      firstStatus: firstNeedsReason ? 'BLOCKED_BY_REASON' : draft.firstReviewerComment.trim() ? 'READY' : 'NEEDS_INPUT',
      finalStatus: finalNeedsReason ? 'BLOCKED_BY_REASON' : draft.finalReviewerComment.trim() ? 'READY' : 'NEEDS_INPUT',
      ceoStatus: ceoNeedsReason ? 'BLOCKED_BY_REASON' : draft.ceoNoWriteConfirmed ? 'READY' : 'NEEDS_INPUT',
      localScorePreview: clampPilotScore2026(
        (itemSelfScore * 0.25) + (itemFirstScore * 0.35) + (itemFinalScore * 0.4) +
          itemFirstAdjustment + itemFinalAdjustment + itemCeoAdjustment
      ),
      warnings,
    }
  })
  const selectedItemRow =
    itemRows.find((item) => item.kpi.id === selectedKpi?.id) ?? itemRows[0] ?? null
  const totalPilotWeight = itemRows.reduce((sum, item) => sum + item.kpi.weight, 0) || 100
  const personalItemWeightedScore = itemRows.reduce(
    (sum, item) => sum + (item.localScorePreview * item.kpi.weight) / totalPilotWeight,
    0
  )
  const totalLocalAdjustedPreviewScore = clampPilotScore2026((organizationScore * 0.3) + (personalItemWeightedScore * 0.7))
  const totalLocalGradePreview = getInteractivePilotGradeLabel2026(totalLocalAdjustedPreviewScore, pilot.gradePreview.gradePreview)
  const scoreGradeText = [
    `조직 성과 30%: ${organizationScore.toFixed(1)}`,
    `개인 성과 70%: ${personalItemWeightedScore.toFixed(1)}`,
    `선택 항목 로컬 점수 미리보기: ${selectedItemRow?.localScorePreview.toFixed(1) ?? '-'}`,
    `전체 로컬 조정 점수 미리보기: ${totalLocalAdjustedPreviewScore.toFixed(1)}`,
    `선택 항목 조정 점수 미리보기: ${adjustedScorePreview.toFixed(1)}`,
    `등급 미리보기: ${totalLocalGradePreview}`,
    '공식 저장 점수(totalScore) 쓰기 false',
    '공식 저장 등급(gradeId) 쓰기 false',
  ].join('\n')
  const markdownExport = [
    props.surface === 'dedicated' ? '# 2026 평가 워크벤치 미리보기' : '# 2026 평가 워크벤치 흐름 정렬',
    '',
    '이 내보내기는 실제 평가 워크벤치 흐름을 미리보기로 정렬하기 위한 읽기 전용 자료입니다. 공식 평가 저장, 제출, 확정, 점수 반영, 등급 반영은 수행하지 않습니다.',
    '',
    `- 활성 단계: ${activeRow.label}`,
    `- 파일럿 대상자: ${pilot.pilotEmployee.name}`,
    `- 선택 KPI: ${selectedKpi?.title ?? 'KPI 미리보기 대기'}`,
    `- 선택 항목 점수 미리보기: ${selectedItemRow?.localScorePreview.toFixed(1) ?? '-'}`,
    `- 전체 로컬 조정 점수 미리보기: ${totalLocalAdjustedPreviewScore.toFixed(1)}`,
    `- 로컬 등급 미리보기: ${totalLocalGradePreview}`,
    `- 공식 차단 조건: ${pilot.blockers.length ? pilot.blockers.join(', ') : '파일럿 화면 기준 없음'}`,
    '',
    '## 워크벤치 KPI 항목 표',
    ...itemRows.map((item) =>
      `- ${item.kpi.title} / ${item.kpi.category} / 가중치 ${item.kpi.weight} / 점수 ${item.localScorePreview.toFixed(1)} / 주의 ${item.warnings.join(', ') || '없음'}`
    ),
    '',
    '## SELF',
    selectedItemDraft?.selfResultSummary ?? inputs.selfResultSummary,
    selectedItemDraft?.selfContribution ?? inputs.selfContributionComment,
    '',
    '## FIRST',
    selectedItemDraft?.firstReviewerComment ?? inputs.firstReviewerComment,
    selectedItemDraft?.firstFeedbackToEmployee ?? inputs.firstFeedbackToEmployee,
    '',
    '## SECOND/FINAL',
    selectedItemDraft?.finalReviewerComment ?? inputs.finalReviewerComment,
    selectedItemDraft?.finalRecommendation ?? inputs.finalRecommendation,
    '',
    '## 대표이사 조정',
    selectedItemDraft?.ceoFinalNote ?? inputs.ceoFinalNote,
    '',
    '## SCORE/GRADE',
    scoreGradeText,
    '',
    '## 단계 인계 요약',
    `자기평가 -> 1차 평가: ${selectedItemDraft?.selfResultSummary ?? '미리보기 대기'}`,
    `1차 평가 -> 2차/최종 평가: ${selectedItemDraft?.firstFeedbackToEmployee ?? '미리보기 대기'}`,
    `2차/최종 평가 -> 대표이사 조정: ${selectedItemDraft?.finalRecommendation ?? '미리보기 대기'}`,
    '대표이사 조정 -> 최종 확정 의존성: 별도 승인 전까지 공식 최종 확정은 차단됩니다.',
    '',
    '## 안전 확인',
    '공식 점수 반영 false',
    '공식 등급 반영 false',
    'AI 제외 활성화 false',
    'API 쓰기 호출 false',
    '기존 데이터 채우기/실제 반영 false',
    '기능 활성화 스위치 변경 false',
  ].join('\n')
  const tsvExport = [
    ['항목', '값'].join('\t'),
    ['활성 단계', activeRow.label].join('\t'),
    ['파일럿 대상자', pilot.pilotEmployee.name].join('\t'),
    ['선택 KPI', selectedKpi?.title ?? 'KPI 미리보기 대기'].join('\t'),
    ['선택 항목 로컬 점수 미리보기', selectedItemRow?.localScorePreview.toFixed(1) ?? '-'].join('\t'),
    ['전체 로컬 조정 점수 미리보기', totalLocalAdjustedPreviewScore.toFixed(1)].join('\t'),
    ['등급 미리보기', totalLocalGradePreview].join('\t'),
    ['공식 저장 점수(totalScore) 쓰기', 'false'].join('\t'),
    ['공식 저장 등급(gradeId) 쓰기', 'false'].join('\t'),
    ['API 쓰기 호출', 'false'].join('\t'),
  ].join('\n')
  const exportRows = [
    { key: 'workbench-pilot-alignment-summary', label: '워크벤치 미리보기 요약 보기', text: markdownExport },
    { key: 'workbench-pilot-item-table', label: 'KPI 항목 표 보기', text: itemRows.map((item) => [item.kpi.title, item.kpi.category, item.kpi.weight, item.localScorePreview.toFixed(1), item.warnings.join('; ') || 'none'].join('\t')).join('\n') },
    { key: 'workbench-pilot-selected-item', label: '선택 KPI 항목 미리보기', text: [selectedKpi?.title ?? 'KPI 미리보기 대기', selectedKpi?.category ?? '-', selectedItemRow?.warnings.join('\n') || '경고 없음'].join('\n') },
    { key: 'workbench-pilot-alignment-self', label: '자기평가 항목 미리보기', text: [selectedItemDraft?.selfResultSummary, selectedItemDraft?.selfEvidenceLink || '증빙 경고', selectedItemDraft?.selfContribution, `자기평가 점수 미리보기: ${selectedItemDraft?.selfScorePreview ?? '-'}`].filter(Boolean).join('\n') },
    { key: 'workbench-pilot-alignment-first', label: '1차 평가 항목 미리보기', text: [selectedItemDraft?.firstReviewerComment, `평가자 점수 미리보기: ${firstReviewerScore}`, `조정값: ${firstAdjustmentAmount}`, selectedItemDraft?.firstAdjustmentReason || '조정값이 0이면 사유가 필요 없습니다', selectedItemDraft?.firstFeedbackToEmployee].filter(Boolean).join('\n') },
    { key: 'workbench-pilot-alignment-final', label: '2차/최종 평가 항목 미리보기', text: [selectedItemDraft?.finalReviewerComment, `최종 점수 미리보기: ${finalReviewerScore}`, `최종 조정값: ${finalAdjustmentAmount}`, selectedItemDraft?.finalAdjustmentReason || '조정값이 0이면 사유가 필요 없습니다', selectedItemDraft?.finalRecommendation].filter(Boolean).join('\n') },
    { key: 'workbench-pilot-score-grade-side-panel', label: '점수/등급 보조 패널 보기', text: scoreGradeText },
    { key: 'workbench-pilot-stage-handoff', label: '단계 인계 요약 보기', text: [`자기평가 -> 1차 평가: ${selectedItemDraft?.selfResultSummary ?? '미리보기 대기'}`, `1차 평가 -> 2차/최종 평가: ${selectedItemDraft?.firstFeedbackToEmployee ?? '미리보기 대기'}`, `2차/최종 평가 -> 대표이사 조정: ${selectedItemDraft?.finalRecommendation ?? '미리보기 대기'}`, '대표이사 조정 -> 최종 확정 의존성: 공식 차단 조건 유지'].join('\n') },
    { key: 'workbench-pilot-alignment-ceo', label: '대표이사 조정 항목 미리보기', text: [`대표이사 조정값: ${ceoAdjustmentAmount}`, selectedItemDraft?.ceoAdjustmentReason || '조정값이 0이면 사유가 필요 없습니다', selectedItemDraft?.ceoFinalNote].filter(Boolean).join('\n') },
    { key: 'workbench-pilot-alignment-safety', label: '안전 확인 요약 보기', text: ['공식 점수 반영 false', '공식 등급 반영 false', 'AI 제외 활성화 false', '공식 저장 점수(totalScore) 쓰기 false', '공식 저장 등급(gradeId) 쓰기 false', '공식 Evaluation 생성 false', '공식 EvaluationItem 생성 false', 'API 쓰기 호출 false', '기존 데이터 채우기/실제 반영 false', '기능 활성화 스위치 변경 false'].join('\n') },
    { key: 'workbench-pilot-alignment-markdown', label: '마크다운 내보내기', text: markdownExport },
    { key: 'workbench-pilot-alignment-tsv', label: 'TSV 내보내기', text: tsvExport },
  ]

  return (
    <div className={`${props.surface === 'dedicated' ? '' : 'mt-6'} rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-slate-900">
              {props.surface === 'dedicated' ? '2026 평가 워크벤치 미리보기 화면' : '2026 평가 워크벤치 흐름 정렬'}
            </h5>
            <Badge tone="neutral">워크벤치 미리보기</Badge>
            <Badge tone="warn">공식 저장 없음</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            이 화면은 실제 평가 워크벤치 흐름을 미리보기로 정렬합니다. 입력값은 저장되지 않으며, 공식 평가 저장,
            제출, 확정, 점수 반영, 등급 반영은 수행하지 않습니다.
          </p>
        </div>
        {props.surface === 'dedicated' ? (
          <div className="rounded-2xl border border-cyan-200 bg-white p-3 text-xs leading-5 text-cyan-900">
            <p className="font-semibold">전용 평가 워크벤치 화면</p>
            <p>/evaluation/workbench는 미리보기 전용 화면만 렌더링합니다</p>
            <p>미리보기 입력값은 브라우저 상태에만 남습니다</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan-200 bg-white p-3 text-xs leading-5 text-cyan-900">
            <p className="font-semibold">실제 평가 워크벤치 화면</p>
            <Link href="/evaluation/workbench" className="font-semibold underline-offset-2 hover:underline">
              전용 평가 워크벤치 미리보기 열기
            </Link>
            <p>화면 이동만 수행 · 저장/동기화 없음</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-10">
        {stageRows.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setActiveStage(stage.id)}
            className={`rounded-xl border px-3 py-3 text-left text-xs transition ${activeStage === stage.id ? 'border-cyan-300 bg-white shadow-sm' : 'border-slate-200 bg-white/70 hover:bg-white'}`}
          >
            <span className="block font-semibold text-slate-900">{stage.label}</span>
            <span className="mt-2 flex flex-wrap gap-1">
              <Badge tone={stage.source?.status === 'PREVIEW_WITH_BLOCKERS' ? 'warn' : stage.source?.status === 'BLOCKED' ? 'error' : 'success'}>
                {formatReadinessUiStatus2026(stage.source?.status ?? 'PREVIEW_ONLY')}
              </Badge>
              <Badge tone={stage.localReady ? 'success' : 'warn'}>{stage.localReady ? '로컬 입력 완료' : '입력 필요'}</Badge>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h6 className="text-sm font-semibold text-slate-900">KPI 항목별 평가 표</h6>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              KPI 항목별 평가 표는 로컬 미리보기 상태로만 계산됩니다. 공식 평가 항목 생성은 수행하지 않습니다.
            </p>
          </div>
          <Badge tone="neutral">{itemRows.length}개 미리보기 항목</Badge>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-left font-semibold uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-3 py-2">KPI 제목</th>
                <th className="px-3 py-2">분류</th>
                <th className="px-3 py-2">가중치</th>
                <th className="px-3 py-2">목표</th>
                <th className="px-3 py-2">증빙</th>
                <th className="px-3 py-2">자기평가</th>
                <th className="px-3 py-2">1차 평가</th>
                <th className="px-3 py-2">2차/최종</th>
                <th className="px-3 py-2">대표이사</th>
                <th className="px-3 py-2">로컬 점수</th>
                <th className="px-3 py-2">주의 항목</th>
                <th className="px-3 py-2">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemRows.map((item) => (
                <tr key={item.kpi.id} className={item.kpi.id === selectedKpi?.id ? 'bg-cyan-50/60' : 'bg-white'}>
                  <td className="px-3 py-2 font-semibold text-slate-900">{item.kpi.title}</td>
                  <td className="px-3 py-2 text-slate-600">{item.kpi.category}</td>
                  <td className="px-3 py-2 text-slate-600">{item.kpi.weight}</td>
                  <td className="px-3 py-2 text-slate-600">{item.kpi.achievementLevel}</td>
                  <td className="px-3 py-2"><Badge tone={item.evidenceStatus === 'READY' ? 'success' : 'warn'}>{formatReadinessUiStatus2026(item.evidenceStatus)}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={item.selfStatus === 'READY' ? 'success' : 'warn'}>{formatReadinessUiStatus2026(item.selfStatus)}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={item.firstStatus === 'READY' ? 'success' : item.firstStatus === 'BLOCKED_BY_REASON' ? 'error' : 'warn'}>{formatReadinessUiStatus2026(item.firstStatus)}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={item.finalStatus === 'READY' ? 'success' : item.finalStatus === 'BLOCKED_BY_REASON' ? 'error' : 'warn'}>{formatReadinessUiStatus2026(item.finalStatus)}</Badge></td>
                  <td className="px-3 py-2"><Badge tone={item.ceoStatus === 'READY' ? 'success' : item.ceoStatus === 'BLOCKED_BY_REASON' ? 'error' : 'warn'}>{formatReadinessUiStatus2026(item.ceoStatus)}</Badge></td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{item.localScorePreview.toFixed(1)}</td>
                  <td className="max-w-72 px-3 py-2 text-slate-500">{item.warnings.slice(0, 3).join(', ') || '없음'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => updateInput('selectedKpiId', item.kpi.id)}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-cyan-300 px-2 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-50"
                    >
                      항목 선택
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h6 className="text-sm font-semibold text-slate-900">{activeRow.label}</h6>
              <p className="mt-1 text-xs leading-5 text-slate-500">미리보기 상태: {formatReadinessUiStatus2026(activeRow.source?.status ?? 'PREVIEW_ONLY')}</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                공식 차단 조건: {activeRow.source?.blockedBy.length ? activeRow.source.blockedBy.join(', ') : '현재 미리보기 기준 공식 차단 조건 없음'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">공식 진행 시점: {activeRow.source?.officialLater ?? '별도 공식 승인 후에만 가능합니다.'}</p>
            </div>
            <button
              type="button"
              onClick={resetLocalPreviewState}
              className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              로컬 입력 초기화
            </button>
          </div>

          {activeStage === 'TARGET' ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-900">
                <p className="font-semibold">파일럿 평가 대상자</p>
                <p>{pilot.pilotEmployee.name} · {pilot.pilotEmployee.departmentName}</p>
                <p>출처: {pilot.pilotEmployee.source}</p>
                <p>확정 KPI 수: {pilot.pilotEmployee.confirmedPersonalKpiCount}</p>
                <p>재직자 샘플 출처: {pilot.summary.pilotDataSource}</p>
                {pilot.pilotEmployee.source === 'SAMPLE_PILOT_FIXTURE' ? (
                  <p className="text-amber-800">SAMPLE/PILOT 대체 대상입니다. 공식 대상자 확정 전 미리보기 전용입니다.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeStage === 'KPI' ? (
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-semibold text-slate-700">
                KPI 항목 미리보기
                <select
                  value={inputs.selectedKpiId}
                  onChange={(event) => updateInput('selectedKpiId', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                >
                  {pilot.pilotKpis.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {item.category} · 가중치 {item.weight}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  로컬 달성 수준
                  <select
                    value={inputs.localAchievementLevel}
                    onChange={(event) => updateInput('localAchievementLevel', event.target.value as InteractivePilotLocalInputs2026['localAchievementLevel'])}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  >
                    <option value="BELOW_TARGET">BELOW_TARGET</option>
                    <option value="TARGET">TARGET</option>
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  로컬 기준 점수 미리보기
                  <input
                    value={selectedItemDraft?.selfScorePreview ?? inputs.localBaseScore}
                    onChange={(event) => {
                      updateInput('localBaseScore', event.target.value)
                      updateSelectedItemDraft('selfScorePreview', event.target.value)
                    }}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700"
                  />
                </label>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                <p>정책 분류 주의: {pilot.evaluationItemPreview.find((item) => item.personalKpiId === selectedKpi?.id)?.policyCategoryWarning ?? '선택 항목 기준 주의 없음'}</p>
                <p>가중치/상한 주의: 미리보기 점수와 가중치는 저장되지 않습니다.</p>
                <p>증빙 기대값: 공식 실행 전 월간 실적, 자기평가 증빙, 평가자 근거가 필요합니다.</p>
                <p>공식 평가 항목 생성 false.</p>
              </div>
            </div>
          ) : null}

          {activeStage === 'SELF' ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs leading-5 text-cyan-900">
                <p className="font-semibold">자기평가 항목 미리보기</p>
                <p>선택 KPI 항목 상세: {selectedKpi?.title ?? 'KPI 미리보기 대기'}</p>
                <p>로컬 전용 상태: 브라우저 상태만 사용 · 저장/제출 API 호출 없음</p>
              </div>
              <label className="text-xs font-semibold text-slate-700">
                수행 결과 요약
                <textarea value={selectedItemDraft?.selfResultSummary ?? ''} onChange={(event) => updateSelectedItemDraft('selfResultSummary', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                증빙 링크
                <input value={selectedItemDraft?.selfEvidenceLink ?? ''} onChange={(event) => updateSelectedItemDraft('selfEvidenceLink', event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                기여도 의견
                <textarea value={selectedItemDraft?.selfContribution ?? ''} onChange={(event) => updateSelectedItemDraft('selfContribution', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                자기평가 점수 미리보기
                <input value={selectedItemDraft?.selfScorePreview ?? ''} onChange={(event) => updateSelectedItemDraft('selfScorePreview', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                결과 요약: {selectedItemDraft?.selfResultSummary.trim() ? '확인됨' : '주의'} · 증빙: {selectedItemDraft?.selfEvidenceLink.trim() ? '확인됨' : '주의'} · 기여도: {selectedItemDraft?.selfContribution.trim() ? '확인됨' : '주의'} · MBO/KPI 차단 조건은 공식 실행 전까지 유지됩니다.
              </p>
            </div>
          ) : null}

          {activeStage === 'FIRST' ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                <p className="font-semibold">1차 평가자 항목 미리보기</p>
                <p>{selectedKpi?.title ?? 'KPI 미리보기 대기'} · 자기평가 공식 제출 전 주의가 유지됩니다.</p>
              </div>
              <label className="text-xs font-semibold text-slate-700">
                1차 평가자 의견
                <textarea value={selectedItemDraft?.firstReviewerComment ?? ''} onChange={(event) => updateSelectedItemDraft('firstReviewerComment', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  평가자 점수 미리보기
                  <input value={selectedItemDraft?.firstReviewerScore ?? ''} onChange={(event) => updateSelectedItemDraft('firstReviewerScore', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  조정값
                  <input value={selectedItemDraft?.firstAdjustmentAmount ?? ''} onChange={(event) => updateSelectedItemDraft('firstAdjustmentAmount', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
              </div>
              <label className="text-xs font-semibold text-slate-700">
                조정 사유
                <textarea value={selectedItemDraft?.firstAdjustmentReason ?? ''} onChange={(event) => updateSelectedItemDraft('firstAdjustmentReason', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                직원에게 전달할 피드백
                <textarea value={selectedItemDraft?.firstFeedbackToEmployee ?? ''} onChange={(event) => updateSelectedItemDraft('firstFeedbackToEmployee', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {firstAdjustmentNeedsReason ? '조정값이 0이 아니면 조정 사유가 필요합니다.' : '조정 사유 확인됨.'} 0~120 범위를 벗어나면 점수 범위 주의가 표시됩니다. 평가자 배정 차단 조건은 유지됩니다.
              </p>
            </div>
          ) : null}

          {activeStage === 'SECOND' || activeStage === 'FINAL' ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900">
                <p className="font-semibold">2차/최종 평가 항목 미리보기</p>
                <p>{selectedKpi?.title ?? 'KPI 미리보기 대기'} · 이전 단계 의존성과 평가자 체인 주의가 유지됩니다.</p>
              </div>
              <label className="text-xs font-semibold text-slate-700">
                2차/최종 평가자 의견
                <textarea value={selectedItemDraft?.finalReviewerComment ?? ''} onChange={(event) => updateSelectedItemDraft('finalReviewerComment', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  최종 점수 미리보기
                  <input value={selectedItemDraft?.finalReviewerScore ?? ''} onChange={(event) => updateSelectedItemDraft('finalReviewerScore', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  최종 조정값
                  <input value={selectedItemDraft?.finalAdjustmentAmount ?? ''} onChange={(event) => updateSelectedItemDraft('finalAdjustmentAmount', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
                </label>
              </div>
              <label className="text-xs font-semibold text-slate-700">
                조정 사유
                <textarea value={selectedItemDraft?.finalAdjustmentReason ?? ''} onChange={(event) => updateSelectedItemDraft('finalAdjustmentReason', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                최종 추천 의견
                <textarea value={selectedItemDraft?.finalRecommendation ?? ''} onChange={(event) => updateSelectedItemDraft('finalRecommendation', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {finalAdjustmentNeedsReason ? '조정값이 0이 아니면 조정 사유가 필요합니다.' : '최종 조정 사유 확인됨.'} 이전 단계 의존성, 평가자 체인 차단, 최종 확정 차단 주의가 유지됩니다.
              </p>
            </div>
          ) : null}

          {activeStage === 'CEO_ADJUST' ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                <p className="font-semibold">대표이사 조정 항목 미리보기</p>
                <p>{selectedKpi?.title ?? 'KPI 미리보기 대기'} · 점수/등급이 공식 반영되지 않았다는 주의가 유지됩니다.</p>
              </div>
              <label className="text-xs font-semibold text-slate-700">
                대표이사 조정값
                <input value={selectedItemDraft?.ceoAdjustmentAmount ?? ''} onChange={(event) => updateSelectedItemDraft('ceoAdjustmentAmount', event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                조정 사유
                <textarea value={selectedItemDraft?.ceoAdjustmentReason ?? ''} onChange={(event) => updateSelectedItemDraft('ceoAdjustmentReason', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                최종 메모
                <textarea value={selectedItemDraft?.ceoFinalNote ?? ''} onChange={(event) => updateSelectedItemDraft('ceoFinalNote', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700" />
              </label>
              <div className="grid gap-2 text-xs text-slate-700">
                {[
                  ['ceoEvidenceConfirmed', '증빙 패키지 로컬 검토'],
                  ['ceoCalibrationReviewed', '보정 차단 조건 로컬 검토'],
                  ['ceoNoWriteConfirmed', '최종 확정 쓰기 없음'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedItemDraft?.[key as keyof WorkbenchPilotItemDraft2026])}
                      onChange={(event) => updateSelectedItemDraft(key as keyof WorkbenchPilotItemDraft2026, event.target.checked as never)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                {ceoAdjustmentNeedsReason ? '조정값이 0이 아니면 사유가 필요합니다.' : '대표이사 조정 사유 확인됨.'} 보정 차단 조건, 최종 확정/대표이사 차단 조건, 점수/등급 미반영 주의가 유지됩니다.
              </p>
            </div>
          ) : null}

          {activeStage === 'SCORE_PREVIEW' || activeStage === 'GRADE_PREVIEW' || activeStage === 'SAFETY' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                <p className="font-semibold">점수 미리보기 연결</p>
                <p>조직 성과 30%: {organizationScore.toFixed(1)}</p>
                <p>개인 성과 70%: {personalItemWeightedScore.toFixed(1)}</p>
                <p>선택 항목 로컬 점수: {selectedItemRow?.localScorePreview.toFixed(1) ?? '-'}</p>
                <p>전체 로컬 조정 점수 미리보기: {totalLocalAdjustedPreviewScore.toFixed(1)}</p>
                <p>점수 정책 주의: {pilot.scorePreview.warnings.join(' ')}</p>
                <p>공식 저장 점수(totalScore) 쓰기 false</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-900">
                <p className="font-semibold">등급 미리보기 연결</p>
                <p>등급 정책 그룹: {pilot.gradePreview.applicableGroup}</p>
                <p>등급 매핑: {totalLocalAdjustedPreviewScore.toFixed(1)} -&gt; {totalLocalGradePreview}</p>
                <p>등급 미리보기: {totalLocalGradePreview}</p>
                <p>등급 정책 주의: {pilot.gradePreview.warnings.join(' ') || '미리보기 기준 주의 없음'}</p>
                <p>공식 저장 등급(gradeId) 쓰기 false</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 md:col-span-2">
                <p className="font-semibold">안전 확인 패널</p>
                <p>공식 점수 반영 false · 공식 등급 반영 false · AI 제외 활성화 false</p>
                <p>공식 Evaluation 생성 false · 공식 EvaluationItem 생성 false · API 쓰기 호출 false</p>
                <p>기존 데이터 채우기/실제 반영 false · 기능 활성화 스위치 변경 false</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const currentIndex = stageRows.findIndex((item) => item.id === activeStage)
                setActiveStage(stageRows[Math.min(currentIndex + 1, stageRows.length - 1)].id)
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-600"
            >
              다음 단계 미리보기
            </button>
            <button
              type="button"
              onClick={() => {
                const currentIndex = stageRows.findIndex((item) => item.id === activeStage)
                setActiveStage(stageRows[Math.min(currentIndex + 1, stageRows.length - 1)].id)
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-cyan-300 px-4 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50"
            >
              미리보기 반영
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h6 className="text-sm font-semibold text-slate-900">워크벤치 대상자/KPI 맥락</h6>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <p>대상자: {pilot.pilotEmployee.name} · {pilot.pilotEmployee.departmentName}</p>
              <p>출처: {pilot.pilotEmployee.source}</p>
              <p>선택 KPI: {selectedKpi?.title ?? 'KPI 미리보기 대기'}</p>
              <p>분류 기여도: {selectedKpi?.category ?? 'N/A'} · 가중치 {selectedKpi?.weight ?? 0}</p>
              <p className="text-amber-800">공식 차단 조건: {pilot.blockers.length ? pilot.blockers.join(', ') : '파일럿 화면 기준 없음'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h6 className="text-sm font-semibold text-slate-900">선택 KPI 항목 상세 패널</h6>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-900">{selectedKpi?.title ?? 'KPI 미리보기 대기'}</p>
              <p>분류: {selectedKpi?.category ?? '-'} · 유형: {selectedKpi?.source ?? 'SAMPLE/PILOT'} · 가중치 {selectedKpi?.weight ?? 0}</p>
              <p>목표: {selectedKpi?.achievementLevel ?? 'TARGET'} · 증빙 기대값: 결과, 증빙 링크, 기여도, 평가자 근거</p>
              <p>정책 분류 주의: {selectedItemRow?.policyCategoryWarning ?? '선택 항목 기준 주의 없음'}</p>
              <p>로컬 계산 점수: {selectedItemRow?.localScorePreview.toFixed(1) ?? '-'}</p>
              <p className="text-amber-800">로컬 주의 목록: {selectedItemRow?.warnings.join(', ') || '없음'}</p>
            </div>
          </div>
          <div className="sticky top-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h6 className="text-sm font-semibold text-blue-950">점수/등급 보조 패널</h6>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-blue-900">
              <p>조직 성과 30%: {organizationScore.toFixed(1)}</p>
              <p>개인 성과 70%: {personalItemWeightedScore.toFixed(1)}</p>
              <p>선택 항목 로컬 점수: {selectedItemRow?.localScorePreview.toFixed(1) ?? '-'}</p>
              <p>전체 로컬 조정 점수 미리보기: {totalLocalAdjustedPreviewScore.toFixed(1)}</p>
              <p>분류별 기여도 요약: {itemRows.map((item) => `${item.kpi.category} ${item.localScorePreview.toFixed(1)}@${item.kpi.weight}`).join(' / ')}</p>
              <p>등급 미리보기: {totalLocalGradePreview}</p>
              <p>등급 그룹: {pilot.gradePreview.applicableGroup}</p>
              <p className="text-amber-800">주의: {[...pilot.scorePreview.warnings, ...itemRows.flatMap((item) => item.warnings)].slice(0, 5).join(' ') || '미리보기 기준 주의 없음'}</p>
              <p>공식 저장 점수(totalScore) 쓰기 false</p>
              <p>공식 저장 등급(gradeId) 쓰기 false</p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <h6 className="text-sm font-semibold text-emerald-950">단계 인계 요약</h6>
            <div className="mt-3 grid gap-2 text-xs leading-5 text-emerald-900">
              <p>자기평가 -&gt; 1차 평가 인계 미리보기: {selectedItemDraft?.selfResultSummary ?? '미리보기 대기'}</p>
              <p>1차 평가 -&gt; 2차/최종 평가 인계 미리보기: {selectedItemDraft?.firstFeedbackToEmployee ?? '미리보기 대기'}</p>
              <p>2차/최종 평가 -&gt; 대표이사 조정 인계 미리보기: {selectedItemDraft?.finalRecommendation ?? '미리보기 대기'}</p>
              <p>대표이사 조정 -&gt; 최종 확정 의존성: 별도 승인 전까지 공식 최종 확정은 차단됩니다.</p>
              <p className="text-amber-800">실제 전환을 막는 공식 차단 조건: {activeRow.source?.blockedBy.join(', ') || '별도 HR 승인 필요'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h6 className="text-sm font-semibold text-slate-900">워크벤치 미리보기 내보내기</h6>
            <p className="mt-1 text-xs leading-5 text-slate-500">클릭하면 내용을 먼저 미리보고 복사/다운로드할 수 있습니다.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {exportRows.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.onExportPreview(item.key, item.text)}
                  className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getGradePolicyRowTone2026(status: EvaluationGradePolicyReadiness2026ApiData['groups'][number]['rows'][number]['status']) {
  if (status === 'MATCHES_PPT') return 'success'
  if (status === 'DIFFERS_FROM_PPT') return 'warn'
  return 'error'
}

function getGradePolicyRowLabel2026(status: EvaluationGradePolicyReadiness2026ApiData['groups'][number]['rows'][number]['status']) {
  if (status === 'MATCHES_PPT') return '저장 정책 일치'
  if (status === 'DIFFERS_FROM_PPT') return '차이 있음'
  return 'HR 확인 필요'
}

function getGradePolicyGroupDisplayCode2026(group: EvaluationGradePolicyReadiness2026ApiData['groups'][number]['group']) {
  if (group === 'TEAM_SECTION_LEADER_NON_SALES') return 'LEADER_NON_SALES'
  if (group === 'TEAM_SECTION_LEADER_SALES') return 'LEADER_SALES'
  return group
}

export function PolicyGradeReadiness2026Panel(props: {
  gradePolicyData: EvaluationGradePolicyReadiness2026ApiData | null
  loading: boolean
  saving: boolean
  error: string
  notice: string
  selectedCycleId: string | null
  canSave: boolean
  onLoad: () => void
  onSave: () => void
  onResolveTeamMemberSalesAmbiguity: (payload: GradePolicyTeamMemberSalesResolutionPayload2026) => void
}) {
  const data = props.gradePolicyData
  const topBlockers = data?.blockers.slice(0, 5) ?? []
  const [ambiguityMode, setAmbiguityMode] =
    useState<GradePolicyTeamMemberSalesResolutionPayload2026['decision']>('APPLY_PPT_BASELINE')
  const [customSuperMinScore, setCustomSuperMinScore] = useState('')
  const [customSuperMaxScore, setCustomSuperMaxScore] = useState('')
  const [customOutstandingMinScore, setCustomOutstandingMinScore] = useState('110')
  const [customOutstandingMaxScore, setCustomOutstandingMaxScore] = useState('')
  const [ambiguityNote, setAmbiguityNote] = useState('')
  const [ambiguityLocalError, setAmbiguityLocalError] = useState('')

  function readOptionalScore(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  function saveTeamMemberSalesAmbiguity() {
    setAmbiguityLocalError('')
    const note = ambiguityNote.trim() || undefined
    if (ambiguityMode === 'APPLY_PPT_BASELINE') {
      props.onResolveTeamMemberSalesAmbiguity({
        decision: 'APPLY_PPT_BASELINE',
        note,
      })
      return
    }
    if (ambiguityMode === 'DEFER') {
      props.onResolveTeamMemberSalesAmbiguity({
        decision: 'DEFER',
        note,
      })
      return
    }

    const superMinScore = readOptionalScore(customSuperMinScore)
    const superMaxScore = readOptionalScore(customSuperMaxScore)
    const outstandingMinScore = readOptionalScore(customOutstandingMinScore)
    const outstandingMaxScore = readOptionalScore(customOutstandingMaxScore)
    const hasInvalidScore = [superMinScore, superMaxScore, outstandingMinScore, outstandingMaxScore].some(
      (value) => typeof value === 'number' && Number.isNaN(value)
    )
    if (hasInvalidScore) {
      setAmbiguityLocalError('HR 별도 기준은 숫자 또는 빈 값만 입력할 수 있습니다.')
      return
    }
    if (outstandingMinScore === null && outstandingMaxScore === null) {
      setAmbiguityLocalError('Outstanding 별도 기준에는 minScore 또는 maxScore가 필요합니다.')
      return
    }

    props.onResolveTeamMemberSalesAmbiguity({
      decision: 'CUSTOM_THRESHOLDS',
      superMinScore,
      superMaxScore,
      outstandingMinScore,
      outstandingMaxScore,
      note,
    })
  }

  return (
    <Panel
      title="2026 등급 기준 준비 상태"
      description="PPT 기준 등급 threshold와 현재 저장 정책을 비교합니다. 저장해도 공식 점수/등급은 변경되지 않습니다."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-violet-50 p-2 text-violet-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Grade metadata only</Badge>
              <Badge tone={data && data.blockers.length === 0 ? 'success' : data ? 'warn' : 'neutral'}>
                {data
                  ? data.blockers.length === 0
                    ? 'HR 확인 완료'
                    : `${data.blockers.length}개 확인 필요`
                  : '미확인'}
              </Badge>
              <Badge tone="neutral">공식 등급 미적용</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              이 화면은 2026 등급 기준 준비 상태 확인용입니다. 저장해도 공식 점수/등급은 변경되지 않습니다.
              TEAM_MEMBER_SALES Super/Outstanding 중첩은 HR 결정 전까지 blocker로 남습니다.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={props.onLoad}
            disabled={props.loading || props.saving}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {props.loading ? '확인 중...' : data ? '등급 기준 다시 확인' : '등급 기준 확인'}
          </button>
          <button
            type="button"
            onClick={props.onSave}
            disabled={!props.selectedCycleId || !props.canSave || props.loading || props.saving}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {props.saving ? '저장 중...' : 'PPT 기준 metadata 저장'}
          </button>
        </div>
      </div>

      {props.error ? <div className="mt-4"><Banner tone="error" message={props.error} /></div> : null}
      {props.notice ? <div className="mt-4"><Banner tone="success" message={props.notice} /></div> : null}
      {!props.selectedCycleId ? (
        <div className="mt-4">
          <Banner tone="warn" message="평가 주기를 선택해야 등급 기준 metadata 저장을 할 수 있습니다." />
        </div>
      ) : null}
      {data?.persistence.compatibilityIssue ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            DB compatibility 확인 필요
          </div>
          <p className="mt-2 leading-6">{data.persistence.compatibilityIssue.message}</p>
          <p className="mt-1 text-xs text-amber-800">
            code: {data.persistence.compatibilityIssue.code}
            {data.persistence.compatibilityIssue.prismaCode ? ` / prisma: ${data.persistence.compatibilityIssue.prismaCode}` : ''}
            {data.persistence.compatibilityIssue.objectName ? ` / object: ${data.persistence.compatibilityIssue.objectName}` : ''}
          </p>
        </div>
      ) : null}

      {data ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="저장 정책"
              value={data.gradePolicyExists ? '있음' : '없음'}
              help="evaluation_grade_policies"
              compact
              variant={data.gradePolicyExists ? 'default' : 'warning'}
            />
            <MetricCard
              label="완료 그룹"
              value={`${data.completeGroupCount}/${data.requiredGroupCount}`}
              help="직군별 기준"
              compact
              variant={data.gradePolicyGroupsComplete ? 'default' : 'warning'}
            />
            <MetricCard
              label="누락 행"
              value={data.missingRowsCount.toLocaleString()}
              help={`${data.expectedRowsCount}개 필요`}
              compact
              variant={data.missingRowsCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="PPT 차이"
              value={data.differsFromPptCount.toLocaleString()}
              help="HR 확인 필요"
              compact
              variant={data.differsFromPptCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="중첩/공백"
              value={`${data.overlapCount}/${data.gapCount}`}
              help="overlap/gap"
              compact
              variant={data.overlapCount + data.gapCount > 0 ? 'warning' : 'default'}
            />
            <MetricCard
              label="TEAM_MEMBER_SALES"
              value={data.teamMemberSalesAmbiguity.requiresDecision ? 'HR 확인 필요' : '결정됨'}
              help={data.teamMemberSalesAmbiguity.currentDecision}
              compact
              variant={data.teamMemberSalesAmbiguity.requiresDecision ? 'warning' : 'default'}
            />
          </div>

          {topBlockers.length ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <h4 className="text-sm font-semibold text-amber-900">등급 기준 blocker</h4>
              </div>
              <ul className="mt-3 space-y-1">
                {topBlockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`} className="text-xs leading-5 text-amber-900">
                    <span className="font-semibold">{blocker.code}</span> · {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.teamMemberSalesAmbiguity.requiresDecision ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-violet-700" />
                    <h4 className="text-sm font-semibold text-violet-950">TEAM_MEMBER_SALES 기준 HR 확인</h4>
                    <Badge tone="warn">blocker 해소 필요</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-violet-900">
                    PPT 해석상 팀원 영업 Super는 별도 구간을 운영하지 않고, Outstanding은 110점 이상으로 둡니다.
                    이 저장은 등급 기준 준비 상태 메타데이터만 변경하며 공식 점수/등급은 변경하지 않습니다.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="rounded-2xl border border-white bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="team-member-sales-grade-resolution"
                      checked={ambiguityMode === 'APPLY_PPT_BASELINE'}
                      onChange={() => setAmbiguityMode('APPLY_PPT_BASELINE')}
                    />
                    <span className="font-semibold text-slate-900">PPT 기준 적용</span>
                  </div>
                  <p className="mt-2 leading-5">Super 미운영 / Outstanding 110점 이상</p>
                </label>
                <label className="rounded-2xl border border-white bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="team-member-sales-grade-resolution"
                      checked={ambiguityMode === 'CUSTOM_THRESHOLDS'}
                      onChange={() => setAmbiguityMode('CUSTOM_THRESHOLDS')}
                    />
                    <span className="font-semibold text-slate-900">HR 별도 기준 입력</span>
                  </div>
                  <p className="mt-2 leading-5">Super / Outstanding 점수 구간을 HR이 직접 확정합니다.</p>
                </label>
                <label className="rounded-2xl border border-white bg-white/80 p-3 text-xs text-slate-700 shadow-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="team-member-sales-grade-resolution"
                      checked={ambiguityMode === 'DEFER'}
                      onChange={() => setAmbiguityMode('DEFER')}
                    />
                    <span className="font-semibold text-slate-900">보류</span>
                  </div>
                  <p className="mt-2 leading-5">blocker를 유지하고 추후 HR 결정으로 남깁니다.</p>
                </label>
              </div>

              {ambiguityMode === 'CUSTOM_THRESHOLDS' ? (
                <div className="mt-3 grid gap-3 rounded-2xl border border-violet-100 bg-white/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Super minScore
                    <input
                      type="number"
                      value={customSuperMinScore}
                      onChange={(event) => setCustomSuperMinScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="예: 120"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Super maxScore
                    <input
                      type="number"
                      value={customSuperMaxScore}
                      onChange={(event) => setCustomSuperMaxScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="미입력 가능"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Outstanding minScore
                    <input
                      type="number"
                      value={customOutstandingMinScore}
                      onChange={(event) => setCustomOutstandingMinScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="예: 110"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">
                    Outstanding maxScore
                    <input
                      type="number"
                      value={customOutstandingMaxScore}
                      onChange={(event) => setCustomOutstandingMaxScore(event.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                      placeholder="미입력 가능"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  HR 확인 메모
                  <textarea
                    value={ambiguityNote}
                    onChange={(event) => setAmbiguityNote(event.target.value)}
                    className="min-h-[72px] w-full rounded-2xl border border-violet-100 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-violet-400"
                    placeholder="예: 2026 PPT 기준 해석 확정"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveTeamMemberSalesAmbiguity}
                  disabled={!props.selectedCycleId || !props.canSave || props.loading || props.saving}
                  className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {props.saving ? '저장 중...' : 'TEAM_MEMBER_SALES 기준 저장'}
                </button>
              </div>
              {ambiguityLocalError ? (
                <p className="mt-2 text-xs font-semibold text-rose-700">{ambiguityLocalError}</p>
              ) : null}
              {!props.canSave ? (
                <p className="mt-2 text-xs text-violet-800">ROLE_ADMIN만 HR 확인 metadata를 저장할 수 있습니다.</p>
              ) : null}
            </div>
          ) : data.teamMemberSalesAmbiguity.currentDecision === 'PPT_SUPER_NOT_APPLICABLE' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              TEAM_MEMBER_SALES 기준이 HR 확인되었습니다. Super는 미운영, Outstanding은 110점 이상으로 저장되어 있습니다.
            </div>
          ) : null}

          <div className="space-y-4">
            {data.groups.map((group) => (
              <div key={group.group} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{group.label}</h4>
                      <Badge tone="neutral">{getGradePolicyGroupDisplayCode2026(group.group)}</Badge>
                      {getGradePolicyGroupDisplayCode2026(group.group) !== group.group ? (
                        <span className="text-xs text-slate-400">저장 enum: {group.group}</span>
                      ) : null}
                      <Badge tone={group.complete && !group.requiresHrConfirmation ? 'success' : 'warn'}>
                        {group.complete && !group.requiresHrConfirmation ? '완료' : 'HR 확인 필요'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {group.roleGroup} · {group.salesGroup} · 누락 {group.missingRowsCount} · 차이 {group.differsFromPptCount}
                    </p>
                  </div>
                  {group.requiresHrConfirmation ? (
                    <Badge tone="warn">TEAM_MEMBER_SALES 기준 확인 필요</Badge>
                  ) : null}
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">등급</th>
                        <th className="px-3 py-2 font-semibold">PPT 기준</th>
                        <th className="px-3 py-2 font-semibold">현재 저장 정책</th>
                        <th className="px-3 py-2 font-semibold">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {group.rows.map((row) => (
                        <tr key={`${group.group}:${row.gradeLabel}`}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{row.gradeDisplayName}</td>
                          <td className="px-3 py-2 text-slate-600">
                            <span className="font-semibold text-slate-700">PPT 기준</span> · {row.pptLabel}
                            {row.pptNotes ? <span className="block text-slate-400">{row.pptNotes}</span> : null}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            <span className="font-semibold text-slate-700">현재 저장 정책</span> · {row.storedLabel}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={getGradePolicyRowTone2026(row.status)}>
                              {getGradePolicyRowLabel2026(row.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          HR 관리자가 PPT 기준 등급 threshold와 현재 저장 정책의 차이를 확인하고, 명시적으로 metadata를 저장할 수 있습니다.
        </div>
      )}
    </Panel>
  )
}


