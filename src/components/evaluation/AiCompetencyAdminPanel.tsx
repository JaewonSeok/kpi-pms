'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import type {
  AiCompetencyDifficulty,
  AiCompetencyDomain,
  AiCompetencyQuestionType,
  AiCompetencyTrack,
} from '@prisma/client'
import type { AiCompetencyPageData } from '@/server/ai-competency'
import {
  DataTable,
  difficultyLabel,
  DOMAIN_OPTIONS,
  domainLabel,
  EmptyBox,
  Field,
  formatDateTime,
  fromLineText,
  InfoRow,
  inputClassName,
  labelForTrack,
  MetricCard,
  primaryButtonClassName,
  QUESTION_TYPE_OPTIONS,
  questionTypeLabel,
  secondaryButtonClassName,
  SectionCard,
  STATUS_LABELS,
  StatusPill,
  toIsoFromLocal,
  toLineText,
  toLocalDateTimeInput,
  TRACK_OPTIONS,
  DIFFICULTY_OPTIONS,
} from './AiCompetencyShared'

type AdminTabKey =
  | 'cycle'
  | 'assignments'
  | 'question-bank'
  | 'blueprint'
  | 'rubric'
  | 'operations'

type CycleFormState = {
  evalCycleId: string
  cycleName: string
  firstRoundPassThreshold: string
  secondRoundBonusCap: string
  scoreCap: string
  timeLimitMinutes: string
  randomizeQuestions: boolean
  companyEmailDomain: string
  artifactMinCount: string
  artifactMaxCount: string
  firstRoundOpenAt: string
  firstRoundCloseAt: string
  secondRoundApplyOpenAt: string
  secondRoundApplyCloseAt: string
  reviewOpenAt: string
  reviewCloseAt: string
  calibrationOpenAt: string
  calibrationCloseAt: string
  resultPublishAt: string
  policyAcknowledgementText: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'
}

type QuestionFormState = {
  id?: string
  title: string
  prompt: string
  competencyDomain: AiCompetencyDomain
  track: '' | AiCompetencyTrack
  questionType: AiCompetencyQuestionType
  difficulty: AiCompetencyDifficulty
  optionsText: string
  answerKeyText: string
  tagsText: string
  explanation: string
  maxScore: string
  sortOrder: string
  version: string
  isCommon: boolean
  isActive: boolean
  randomizable: boolean
  requiresManualScoring: boolean
}

type AssignmentFormState = {
  employeeId: string
  track: AiCompetencyTrack
  firstRoundRequired: boolean
  secondRoundVolunteer: boolean
  notes: string
}

type BlueprintScope = 'COMMON' | 'TRACK_SPECIFIC'

type BlueprintRowFormState = {
  competencyDomain: AiCompetencyDomain
  itemType: AiCompetencyQuestionType
  difficulty: AiCompetencyDifficulty
  scope: BlueprintScope
  requiredQuestionCount: string
  pointsPerQuestion: string
  requiredTagsText: string
  excludedTagsText: string
  displayOrder: string
}

type BlueprintFormState = {
  id?: string
  blueprintName: string
  blueprintVersion: string
  track: '' | AiCompetencyTrack
  timeLimitMinutes: string
  passScore: string
  randomizationEnabled: boolean
  notes: string
  rows: BlueprintRowFormState[]
}

type RubricBandFormState = {
  score: string
  title: string
  description: string
  guidance: string
  displayOrder: string
}

type RubricCriterionFormState = {
  criterionCode: string
  criterionName: string
  criterionDescription: string
  maxScore: string
  displayOrder: string
  mandatory: boolean
  knockout: boolean
  bands: RubricBandFormState[]
}

type RubricFormState = {
  id?: string
  rubricName: string
  rubricVersion: string
  track: '' | AiCompetencyTrack
  passScore: string
  bonusScoreIfPassed: string
  certificationLabel: string
  notes: string
  criteria: RubricCriterionFormState[]
}

type Props = {
  pageData: AiCompetencyPageData
  isPending: boolean
  callAction: (action: string, payload: unknown) => Promise<unknown>
  runMutation: (task: () => Promise<unknown>, successMessage: string) => void
}

function buildCycleForm(data: AiCompetencyPageData): CycleFormState {
  const cycle = data.adminView?.cycle
  return {
    evalCycleId: cycle?.evalCycleId ?? data.availableEvalCycles?.find((item) => !item.linkedAiCycleId)?.id ?? '',
    cycleName: cycle?.cycleName ?? '',
    firstRoundPassThreshold: String(cycle?.firstRoundPassThreshold ?? 75),
    secondRoundBonusCap: String(cycle?.secondRoundBonusCap ?? 10),
    scoreCap: String(cycle?.scoreCap ?? 100),
    timeLimitMinutes: String(cycle?.timeLimitMinutes ?? 90),
    randomizeQuestions: cycle?.randomizeQuestions ?? false,
    companyEmailDomain: cycle?.companyEmailDomain ?? '',
    artifactMinCount: String(cycle?.artifactMinCount ?? 2),
    artifactMaxCount: String(cycle?.artifactMaxCount ?? 3),
    firstRoundOpenAt: toLocalDateTimeInput(cycle?.firstRoundOpenAt),
    firstRoundCloseAt: toLocalDateTimeInput(cycle?.firstRoundCloseAt),
    secondRoundApplyOpenAt: toLocalDateTimeInput(cycle?.secondRoundApplyOpenAt),
    secondRoundApplyCloseAt: toLocalDateTimeInput(cycle?.secondRoundApplyCloseAt),
    reviewOpenAt: toLocalDateTimeInput(cycle?.reviewOpenAt),
    reviewCloseAt: toLocalDateTimeInput(cycle?.reviewCloseAt),
    calibrationOpenAt: toLocalDateTimeInput(cycle?.calibrationOpenAt),
    calibrationCloseAt: toLocalDateTimeInput(cycle?.calibrationCloseAt),
    resultPublishAt: toLocalDateTimeInput(cycle?.resultPublishAt),
    policyAcknowledgementText: cycle?.policyAcknowledgementText ?? '',
    status: cycle?.status ?? 'DRAFT',
  }
}

function buildQuestionForm(): QuestionFormState {
  return {
    title: '',
    prompt: '',
    competencyDomain: 'AI_FOUNDATION',
    track: '',
    questionType: 'SINGLE_CHOICE',
    difficulty: 'INTERMEDIATE',
    optionsText: '',
    answerKeyText: '',
    tagsText: '',
    explanation: '',
    maxScore: '5',
    sortOrder: '0',
    version: '1',
    isCommon: true,
    isActive: true,
    randomizable: true,
    requiresManualScoring: false,
  }
}

function buildAssignmentForm(data: AiCompetencyPageData): AssignmentFormState {
  return {
    employeeId: data.adminView?.employeeDirectory[0]?.id ?? '',
    track: 'HR_SUPPORT',
    firstRoundRequired: true,
    secondRoundVolunteer: false,
    notes: '',
  }
}

function buildBlueprintRow(scope: BlueprintScope): BlueprintRowFormState {
  return {
    competencyDomain: 'AI_FOUNDATION',
    itemType: 'SINGLE_CHOICE',
    difficulty: 'INTERMEDIATE',
    scope,
    requiredQuestionCount: '2',
    pointsPerQuestion: '5',
    requiredTagsText: '',
    excludedTagsText: '',
    displayOrder: '0',
  }
}

function buildBlueprintForm(): BlueprintFormState {
  return {
    blueprintName: '',
    blueprintVersion: '1',
    track: '',
    timeLimitMinutes: '60',
    passScore: '70',
    randomizationEnabled: true,
    notes: '',
    rows: [buildBlueprintRow('COMMON')],
  }
}

function buildRubricBand(score: string, title: string, displayOrder: string): RubricBandFormState {
  return {
    score,
    title,
    description: '',
    guidance: '',
    displayOrder,
  }
}

function buildRubricCriterion(): RubricCriterionFormState {
  return {
    criterionCode: 'CRITERION_1',
    criterionName: '문제 정의의 명확성',
    criterionDescription: '',
    maxScore: '5',
    displayOrder: '0',
    mandatory: true,
    knockout: false,
    bands: [
      buildRubricBand('5', '매우 우수', '0'),
      buildRubricBand('4', '우수', '1'),
      buildRubricBand('3', '보통', '2'),
      buildRubricBand('2', '미흡', '3'),
      buildRubricBand('1', '매우 미흡', '4'),
    ],
  }
}

function buildRubricForm(): RubricFormState {
  return {
    rubricName: '',
    rubricVersion: '1',
    track: '',
    passScore: '20',
    bonusScoreIfPassed: '5',
    certificationLabel: '',
    notes: '',
    criteria: [buildRubricCriterion()],
  }
}

function mapBlueprintToForm(
  blueprint: NonNullable<AiCompetencyPageData['adminView']>['blueprints'][number]
): BlueprintFormState {
  return {
    id: blueprint.id,
    blueprintName: blueprint.blueprintName,
    blueprintVersion: String(blueprint.blueprintVersion),
    track: blueprint.track ?? '',
    timeLimitMinutes: String(blueprint.timeLimitMinutes),
    passScore: String(blueprint.passScore),
    randomizationEnabled: blueprint.randomizationEnabled,
    notes: blueprint.notes ?? '',
    rows: blueprint.rows.map((row) => ({
      competencyDomain: row.competencyDomain,
      itemType: row.itemType,
      difficulty: row.difficulty,
      scope: row.scope,
      requiredQuestionCount: String(row.requiredQuestionCount),
      pointsPerQuestion: String(row.pointsPerQuestion),
      requiredTagsText: toLineText(row.requiredTags),
      excludedTagsText: toLineText(row.excludedTags),
      displayOrder: String(row.displayOrder),
    })),
  }
}

function mapRubricToForm(
  rubric: NonNullable<AiCompetencyPageData['adminView']>['rubrics'][number]
): RubricFormState {
  return {
    id: rubric.id,
    rubricName: rubric.rubricName,
    rubricVersion: String(rubric.rubricVersion),
    track: rubric.track ?? '',
    passScore: String(rubric.passScore),
    bonusScoreIfPassed: String(rubric.bonusScoreIfPassed),
    certificationLabel: rubric.certificationLabel ?? '',
    notes: rubric.notes ?? '',
    criteria: rubric.criteria.map((criterion) => ({
      criterionCode: criterion.criterionCode,
      criterionName: criterion.criterionName,
      criterionDescription: criterion.criterionDescription ?? '',
      maxScore: String(criterion.maxScore),
      displayOrder: String(criterion.displayOrder),
      mandatory: criterion.mandatory,
      knockout: criterion.knockout,
      bands: criterion.bands.map((band, index) => ({
        score: String(band.score),
        title: band.title,
        description: band.description ?? '',
        guidance: band.guidance ?? '',
        displayOrder: String(index),
      })),
    })),
  }
}

function countBlueprintQuestions(form: BlueprintFormState) {
  return form.rows.reduce((sum, row) => sum + Number(row.requiredQuestionCount || 0), 0)
}

function countBlueprintPoints(form: BlueprintFormState) {
  return form.rows.reduce(
    (sum, row) => sum + Number(row.requiredQuestionCount || 0) * Number(row.pointsPerQuestion || 0),
    0
  )
}

function countRubricTotal(form: RubricFormState) {
  return form.criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0)
}

function groupNumberRows(rows: string[]) {
  const result = new Map<string, number>()
  rows.forEach((label) => {
    result.set(label, (result.get(label) ?? 0) + 1)
  })
  return Array.from(result.entries())
}

function normalizeQuestionFormForType(form: QuestionFormState, nextType: AiCompetencyQuestionType) {
  return {
    ...form,
    questionType: nextType,
    requiresManualScoring: nextType === 'SHORT_ANSWER' || nextType === 'PRACTICAL' ? true : form.requiresManualScoring,
  }
}

function findSelectedSubmission(
  data: AiCompetencyPageData,
  submissionId?: string
) {
  const queue = data.adminView?.secondRoundQueue ?? []
  if (!queue.length) return undefined
  return queue.find((item) => item.submissionId === submissionId) ?? queue[0]
}

function findSelectedClaim(
  data: AiCompetencyPageData,
  claimId?: string
) {
  const claims = data.adminView?.certClaims ?? []
  if (!claims.length) return undefined
  return claims.find((item) => item.claimId === claimId) ?? claims[0]
}

function findSelectedResult(
  data: AiCompetencyPageData,
  resultId?: string
) {
  const results = data.adminView?.results ?? []
  if (!results.length) return undefined
  return results.find((item) => item.resultId === resultId) ?? results[0]
}

export function AiCompetencyAdminPanel(props: Props) {
  const [activeTab, setActiveTab] = useState<AdminTabKey>('cycle')
  const [createMode, setCreateMode] = useState(!props.pageData.selectedCycleId)
  const [cycleForm, setCycleForm] = useState(() => buildCycleForm(props.pageData))
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(() => buildQuestionForm())
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(() => buildAssignmentForm(props.pageData))
  const [blueprintForm, setBlueprintForm] = useState<BlueprintFormState>(() => buildBlueprintForm())
  const [rubricForm, setRubricForm] = useState<RubricFormState>(() => buildRubricForm())
  const [adminSearch, setAdminSearch] = useState('')
  const [manualScore, setManualScore] = useState({
    answerId: props.pageData.adminView?.manualScoringQueue[0]?.answerId ?? '',
    score: '',
    reviewerNote: '',
  })
  const [reviewerAssignmentSubmissionId, setReviewerAssignmentSubmissionId] = useState(
    props.pageData.adminView?.secondRoundQueue[0]?.submissionId ?? ''
  )
  const [reviewerIds, setReviewerIds] = useState<string[]>([])
  const [certDecision, setCertDecision] = useState({
    claimId: props.pageData.adminView?.certClaims[0]?.claimId ?? '',
    rejectionReason: '',
  })
  const [overrideResult, setOverrideResult] = useState({
    resultId: props.pageData.adminView?.results[0]?.resultId ?? '',
    overrideScore: props.pageData.adminView?.results[0]
      ? String(props.pageData.adminView.results[0].finalScore)
      : '',
    overrideReason: '',
  })
  const deferredAdminSearch = useDeferredValue(adminSearch)

  useEffect(() => {
    const nextSelectedSubmission = findSelectedSubmission(props.pageData, reviewerAssignmentSubmissionId)
    const nextSelectedClaim = findSelectedClaim(props.pageData, certDecision.claimId)
    const nextSelectedResult = findSelectedResult(props.pageData, overrideResult.resultId)

    setCreateMode(!props.pageData.selectedCycleId)
    setCycleForm(buildCycleForm(props.pageData))
    setQuestionForm(buildQuestionForm())
    setAssignmentForm(buildAssignmentForm(props.pageData))
    setBlueprintForm(buildBlueprintForm())
    setRubricForm(buildRubricForm())
    setManualScore({
      answerId: props.pageData.adminView?.manualScoringQueue[0]?.answerId ?? '',
      score: '',
      reviewerNote: '',
    })
    setReviewerAssignmentSubmissionId(nextSelectedSubmission?.submissionId ?? '')
    setReviewerIds(nextSelectedSubmission?.reviewerIds ?? [])
    setCertDecision({
      claimId: nextSelectedClaim?.claimId ?? '',
      rejectionReason: '',
    })
    setOverrideResult({
      resultId: nextSelectedResult?.resultId ?? '',
      overrideScore: nextSelectedResult
        ? String(nextSelectedResult.finalScore)
        : '',
      overrideReason: '',
    })
  }, [props.pageData])

  useEffect(() => {
    const selected = findSelectedSubmission(props.pageData, reviewerAssignmentSubmissionId)
    setReviewerIds(selected?.reviewerIds ?? [])
  }, [props.pageData, reviewerAssignmentSubmissionId])

  const filteredAssignments =
    props.pageData.adminView?.assignments.filter((item) => {
      if (!deferredAdminSearch.trim()) return true
      const query = deferredAdminSearch.trim().toLowerCase()
      return [item.employeeNumber, item.name, item.department, item.track].join(' ').toLowerCase().includes(query)
    }) ?? []

  const selectedManualRow = props.pageData.adminView?.manualScoringQueue.find(
    (item) => item.answerId === manualScore.answerId
  )
  const selectedClaim = props.pageData.adminView?.certClaims.find((item) => item.claimId === certDecision.claimId)
  const selectedResult = props.pageData.adminView?.results.find((item) => item.resultId === overrideResult.resultId)
  const selectedSubmission = props.pageData.adminView?.secondRoundQueue.find(
    (item) => item.submissionId === reviewerAssignmentSubmissionId
  )
  const blueprintQuestionTotal = countBlueprintQuestions(blueprintForm)
  const blueprintPointTotal = countBlueprintPoints(blueprintForm)
  const rubricTotalScore = countRubricTotal(rubricForm)

  const adminTabs: Array<{ key: AdminTabKey; label: string }> = [
    { key: 'cycle', label: '주기 운영' },
    { key: 'assignments', label: '대상자 관리' },
    { key: 'question-bank', label: '문항은행' },
    { key: 'blueprint', label: '문항 체계표' },
    { key: 'rubric', label: '루브릭 시트' },
    { key: 'operations', label: '채점/승인/반영' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {adminTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? 'rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cycle' && (
        <SectionCard
          title="주기 운영"
          description="AI 활용능력 평가 주기를 생성하고 일정, 점수 규칙, 공개 일정을 관리합니다."
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setCreateMode((current) => !current)}
            >
              {createMode ? '현재 주기 수정 모드' : '새 주기 생성 모드'}
            </button>
          </div>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              const payload = {
                ...cycleForm,
                firstRoundPassThreshold: Number(cycleForm.firstRoundPassThreshold),
                secondRoundBonusCap: Number(cycleForm.secondRoundBonusCap),
                scoreCap: Number(cycleForm.scoreCap),
                timeLimitMinutes: Number(cycleForm.timeLimitMinutes),
                artifactMinCount: Number(cycleForm.artifactMinCount),
                artifactMaxCount: Number(cycleForm.artifactMaxCount),
                firstRoundOpenAt: toIsoFromLocal(cycleForm.firstRoundOpenAt),
                firstRoundCloseAt: toIsoFromLocal(cycleForm.firstRoundCloseAt),
                secondRoundApplyOpenAt: toIsoFromLocal(cycleForm.secondRoundApplyOpenAt),
                secondRoundApplyCloseAt: toIsoFromLocal(cycleForm.secondRoundApplyCloseAt),
                reviewOpenAt: toIsoFromLocal(cycleForm.reviewOpenAt),
                reviewCloseAt: toIsoFromLocal(cycleForm.reviewCloseAt),
                calibrationOpenAt: toIsoFromLocal(cycleForm.calibrationOpenAt),
                calibrationCloseAt: toIsoFromLocal(cycleForm.calibrationCloseAt),
                resultPublishAt: toIsoFromLocal(cycleForm.resultPublishAt),
              }

              if (createMode || !props.pageData.adminView?.cycle?.id) {
                props.runMutation(
                  () => props.callAction('createCycle', payload),
                  'AI 활용능력 평가 주기를 생성했습니다.'
                )
                return
              }

              props.runMutation(
                () =>
                  props.callAction('updateCycle', {
                    cycleId: props.pageData.adminView!.cycle!.id,
                    ...payload,
                  }),
                '주기 설정을 저장했습니다.'
              )
            }}
          >
            {(createMode || !props.pageData.adminView?.cycle) && (
              <Field label="연결할 PMS 평가 주기">
                <select
                  className={inputClassName}
                  value={cycleForm.evalCycleId}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, evalCycleId: event.target.value }))
                  }
                >
                  <option value="">평가 주기 선택</option>
                  {props.pageData.availableEvalCycles?.map((cycle) => (
                    <option key={cycle.id} value={cycle.id} disabled={Boolean(cycle.linkedAiCycleId)}>
                      {cycle.year}년 {cycle.name} / {cycle.organizationName}
                      {cycle.linkedAiCycleId ? ' (연결됨)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="주기명">
                <input
                  className={inputClassName}
                  value={cycleForm.cycleName}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, cycleName: event.target.value }))
                  }
                />
              </Field>
              <Field label="상태">
                <select
                  className={inputClassName}
                  value={cycleForm.status}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      status: event.target.value as CycleFormState['status'],
                    }))
                  }
                >
                  <option value="DRAFT">초안</option>
                  <option value="PUBLISHED">공개</option>
                  <option value="CLOSED">종료</option>
                </select>
              </Field>
              <Field label="1차 합격 기준">
                <input
                  type="number"
                  className={inputClassName}
                  value={cycleForm.firstRoundPassThreshold}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      firstRoundPassThreshold: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="2차 보너스 상한">
                <input
                  type="number"
                  className={inputClassName}
                  value={cycleForm.secondRoundBonusCap}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, secondRoundBonusCap: event.target.value }))
                  }
                />
              </Field>
              <Field label="총점 상한">
                <input
                  type="number"
                  className={inputClassName}
                  value={cycleForm.scoreCap}
                  onChange={(event) => setCycleForm((current) => ({ ...current, scoreCap: event.target.value }))}
                />
              </Field>
              <Field label="기본 시험 시간(분)">
                <input
                  type="number"
                  className={inputClassName}
                  value={cycleForm.timeLimitMinutes}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, timeLimitMinutes: event.target.value }))
                  }
                />
              </Field>
              <Field label="산출물 최소 개수">
                <input
                  type="number"
                  className={inputClassName}
                  value={cycleForm.artifactMinCount}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, artifactMinCount: event.target.value }))
                  }
                />
              </Field>
              <Field label="산출물 최대 개수">
                <input
                  type="number"
                  className={inputClassName}
                  value={cycleForm.artifactMaxCount}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, artifactMaxCount: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="1차 오픈">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.firstRoundOpenAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, firstRoundOpenAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="1차 마감">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.firstRoundCloseAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, firstRoundCloseAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="2차 신청 오픈">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.secondRoundApplyOpenAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      secondRoundApplyOpenAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="2차 신청 마감">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.secondRoundApplyCloseAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      secondRoundApplyCloseAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="결과 공개">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.resultPublishAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, resultPublishAt: event.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="심사 시작">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.reviewOpenAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, reviewOpenAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="심사 종료">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.reviewCloseAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, reviewCloseAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="캘리브레이션 시작">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.calibrationOpenAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      calibrationOpenAt: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="캘리브레이션 종료">
                <input
                  type="datetime-local"
                  className={inputClassName}
                  value={cycleForm.calibrationCloseAt}
                  onChange={(event) =>
                    setCycleForm((current) => ({
                      ...current,
                      calibrationCloseAt: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="회사 이메일 도메인">
                <input
                  className={inputClassName}
                  value={cycleForm.companyEmailDomain}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, companyEmailDomain: event.target.value }))
                  }
                />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={cycleForm.randomizeQuestions}
                  onChange={(event) =>
                    setCycleForm((current) => ({ ...current, randomizeQuestions: event.target.checked }))
                  }
                />
                객관식/시나리오 문항 순서를 무작위로 구성합니다.
              </label>
            </div>
            <Field label="사내 정책 확인 문구">
              <textarea
                className={`${inputClassName} min-h-24`}
                value={cycleForm.policyAcknowledgementText}
                onChange={(event) =>
                  setCycleForm((current) => ({
                    ...current,
                    policyAcknowledgementText: event.target.value,
                  }))
                }
              />
            </Field>
            <button type="submit" className={primaryButtonClassName} disabled={props.isPending}>
              {createMode || !props.pageData.adminView?.cycle ? '주기 생성' : '주기 저장'}
            </button>
          </form>
        </SectionCard>
      )}

      {activeTab === 'assignments' && (
        <SectionCard
          title="대상자 관리"
          description="대상 직원의 트랙, 1차 필수 여부, 2차 신청 가능 여부를 관리합니다."
        >
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <form
              className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
              onSubmit={(event) => {
                event.preventDefault()
                if (!props.pageData.selectedCycleId) return
                props.runMutation(
                  () =>
                    props.callAction('upsertAssignment', {
                      cycleId: props.pageData.selectedCycleId,
                      ...assignmentForm,
                    }),
                  '대상자 배정을 저장했습니다.'
                )
              }}
            >
              <Field label="직원">
                <select
                  className={inputClassName}
                  value={assignmentForm.employeeId}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, employeeId: event.target.value }))
                  }
                >
                  {props.pageData.adminView?.employeeDirectory.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} / {employee.employeeNumber} / {employee.department}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="트랙">
                <select
                  className={inputClassName}
                  value={assignmentForm.track}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      track: event.target.value as AiCompetencyTrack,
                    }))
                  }
                >
                  {TRACK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={assignmentForm.firstRoundRequired}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      firstRoundRequired: event.target.checked,
                    }))
                  }
                />
                1차 공통평가 필수
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={assignmentForm.secondRoundVolunteer}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      secondRoundVolunteer: event.target.checked,
                    }))
                  }
                />
                2차 실무인증 신청 가능
              </label>
              <Field label="메모">
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={assignmentForm.notes}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </Field>
              <button
                type="submit"
                className={primaryButtonClassName}
                disabled={props.isPending || !props.pageData.selectedCycleId}
              >
                대상자 저장
              </button>
            </form>
            <div className="space-y-4">
              <Field label="대상자 검색">
                <input
                  className={inputClassName}
                  value={adminSearch}
                  onChange={(event) => setAdminSearch(event.target.value)}
                  placeholder="사번, 이름, 부서, 트랙으로 검색"
                />
              </Field>
              <DataTable
                columns={['사번', '이름', '부서', '트랙', '1차', '2차', '최종 결과']}
                rows={filteredAssignments.map((item) => [
                  item.employeeNumber,
                  item.name,
                  item.department,
                  labelForTrack(item.track),
                  STATUS_LABELS[item.firstRoundStatus] ?? item.firstRoundStatus,
                  item.secondRoundVolunteer
                    ? STATUS_LABELS[item.secondRoundStatus ?? 'PENDING'] ?? '신청 가능'
                    : '미대상',
                  item.finalScore ? `${item.finalScore.toFixed(1)}점 / ${item.finalGrade ?? '-'}` : '-',
                ])}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === 'question-bank' && (
        <SectionCard
          title="문항은행"
          description="문항 분류, 난이도, 태그를 포함한 1차 공통평가 문항은행을 관리합니다."
        >
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form
              className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
              onSubmit={(event) => {
                event.preventDefault()
                if (!props.pageData.selectedCycleId) return
                props.runMutation(
                  () =>
                    props.callAction('upsertQuestion', {
                      id: questionForm.id,
                      cycleId: props.pageData.selectedCycleId,
                      title: questionForm.title,
                      prompt: questionForm.prompt,
                      competencyDomain: questionForm.competencyDomain,
                      track: questionForm.track || null,
                      questionType: questionForm.questionType,
                      difficulty: questionForm.difficulty,
                      options: fromLineText(questionForm.optionsText),
                      answerKey: fromLineText(questionForm.answerKeyText),
                      tags: fromLineText(questionForm.tagsText),
                      explanation: questionForm.explanation,
                      maxScore: Number(questionForm.maxScore),
                      sortOrder: Number(questionForm.sortOrder),
                      version: Number(questionForm.version),
                      isCommon: questionForm.isCommon,
                      isActive: questionForm.isActive,
                      randomizable: questionForm.randomizable,
                      requiresManualScoring: questionForm.requiresManualScoring,
                    }),
                  questionForm.id ? '문항을 수정했습니다.' : '문항을 등록했습니다.'
                )
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{questionForm.id ? '문항 수정' : '문항 등록'}</h3>
                <button type="button" className={secondaryButtonClassName} onClick={() => setQuestionForm(buildQuestionForm())}>
                  새 문항
                </button>
              </div>
              <Field label="문항 제목">
                <input
                  className={inputClassName}
                  value={questionForm.title}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </Field>
              <Field label="문항 설명">
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={questionForm.prompt}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, prompt: event.target.value }))
                  }
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="역량 영역">
                  <select
                    className={inputClassName}
                    value={questionForm.competencyDomain}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        competencyDomain: event.target.value as AiCompetencyDomain,
                      }))
                    }
                  >
                    {DOMAIN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="트랙">
                  <select
                    className={inputClassName}
                    value={questionForm.track}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        track: event.target.value as QuestionFormState['track'],
                      }))
                    }
                  >
                    <option value="">공통</option>
                    {TRACK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="문항 유형">
                  <select
                    className={inputClassName}
                    value={questionForm.questionType}
                    onChange={(event) =>
                      setQuestionForm((current) =>
                        normalizeQuestionFormForType(
                          current,
                          event.target.value as AiCompetencyQuestionType
                        )
                      )
                    }
                  >
                    {QUESTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="난이도">
                  <select
                    className={inputClassName}
                    value={questionForm.difficulty}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        difficulty: event.target.value as AiCompetencyDifficulty,
                      }))
                    }
                  >
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="배점">
                  <input
                    type="number"
                    className={inputClassName}
                    value={questionForm.maxScore}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, maxScore: event.target.value }))
                    }
                  />
                </Field>
                <Field label="버전">
                  <input
                    type="number"
                    className={inputClassName}
                    value={questionForm.version}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, version: event.target.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="정렬 순서">
                <input
                  type="number"
                  className={inputClassName}
                  value={questionForm.sortOrder}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                />
              </Field>
              <Field label="선택지">
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={questionForm.optionsText}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, optionsText: event.target.value }))
                  }
                  placeholder="한 줄에 하나씩 입력"
                />
              </Field>
              <Field label="정답">
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={questionForm.answerKeyText}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, answerKeyText: event.target.value }))
                  }
                  placeholder="한 줄에 하나씩 입력"
                />
              </Field>
              <Field label="태그">
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={questionForm.tagsText}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, tagsText: event.target.value }))
                  }
                  placeholder="한 줄에 하나씩 입력"
                />
              </Field>
              <Field label="해설">
                <textarea
                  className={`${inputClassName} min-h-24`}
                  value={questionForm.explanation}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, explanation: event.target.value }))
                  }
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={questionForm.isCommon}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, isCommon: event.target.checked }))
                    }
                  />
                  공통 문항
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={questionForm.isActive}
                    onChange={(event) =>
                      setQuestionForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                  활성 문항
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={questionForm.randomizable}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        randomizable: event.target.checked,
                      }))
                    }
                  />
                  무작위 출제 허용
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={questionForm.requiresManualScoring}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        requiresManualScoring: event.target.checked,
                      }))
                    }
                  />
                  수기 채점 필요
                </label>
              </div>
              <button
                type="submit"
                className={primaryButtonClassName}
                disabled={props.isPending || !props.pageData.selectedCycleId}
              >
                {questionForm.id ? '문항 수정' : '문항 등록'}
              </button>
            </form>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="활성 문항" value={`${props.pageData.adminView?.questionBank.filter((item) => item.isActive).length ?? 0}개`} />
                <MetricCard
                  label="공통 문항"
                  value={`${props.pageData.adminView?.questionBank.filter((item) => item.isCommon).length ?? 0}개`}
                />
                <MetricCard
                  label="수기 채점 문항"
                  value={`${props.pageData.adminView?.questionBank.filter((item) => item.requiresManualScoring).length ?? 0}개`}
                />
              </div>
              <div className="space-y-3">
                {props.pageData.adminView?.questionBank.map((question) => (
                  <div key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h3 className="text-base font-semibold text-slate-900">{question.title}</h3>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill value={question.competencyDomain} customLabel={domainLabel(question.competencyDomain)} />
                          <StatusPill value={question.questionType} customLabel={questionTypeLabel(question.questionType)} />
                          <StatusPill value={question.difficulty} customLabel={difficultyLabel(question.difficulty)} />
                          <StatusPill value={question.isActive ? 'ACTIVE' : 'INACTIVE'} />
                        </div>
                      </div>
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        onClick={() =>
                          setQuestionForm({
                            id: question.id,
                            title: question.title,
                            prompt: question.prompt,
                            competencyDomain: question.competencyDomain,
                            track: question.track ?? '',
                            questionType: question.questionType,
                            difficulty: question.difficulty,
                            optionsText: toLineText(question.options),
                            answerKeyText: toLineText(question.answerKey),
                            tagsText: toLineText(question.tags),
                            explanation: question.explanation ?? '',
                            maxScore: String(question.maxScore),
                            sortOrder: String(question.sortOrder),
                            version: String(question.version),
                            isCommon: question.isCommon,
                            isActive: question.isActive,
                            randomizable: question.randomizable,
                            requiresManualScoring: question.requiresManualScoring,
                          })
                        }
                      >
                        편집
                      </button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{question.prompt}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoRow label="트랙" value={question.track ? labelForTrack(question.track) : '공통'} />
                      <InfoRow label="배점" value={`${question.maxScore}점`} />
                      <InfoRow label="버전" value={`${question.version}`} />
                      <InfoRow label="태그" value={question.tags.length ? question.tags.join(', ') : '태그 없음'} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === 'blueprint' && (
        <SectionCard
          title="문항 체계표"
          description="주기/트랙별 1차 시험 문항 분포 규칙을 정의하고, 활성화 전 문항 부족 여부를 검증합니다."
        >
          <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
            <form
              className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
              onSubmit={(event) => {
                event.preventDefault()
                if (!props.pageData.selectedCycleId) return
                props.runMutation(
                  () =>
                    props.callAction('upsertBlueprint', {
                      id: blueprintForm.id,
                      cycleId: props.pageData.selectedCycleId,
                      blueprintName: blueprintForm.blueprintName,
                      blueprintVersion: Number(blueprintForm.blueprintVersion),
                      track: blueprintForm.track || null,
                      totalQuestionCount: blueprintQuestionTotal,
                      totalPoints: blueprintPointTotal,
                      timeLimitMinutes: Number(blueprintForm.timeLimitMinutes),
                      passScore: Number(blueprintForm.passScore),
                      randomizationEnabled: blueprintForm.randomizationEnabled,
                      notes: blueprintForm.notes,
                      rows: blueprintForm.rows.map((row, index) => ({
                        competencyDomain: row.competencyDomain,
                        itemType: row.itemType,
                        difficulty: row.difficulty,
                        scope: blueprintForm.track ? 'TRACK_SPECIFIC' : 'COMMON',
                        requiredQuestionCount: Number(row.requiredQuestionCount),
                        pointsPerQuestion: Number(row.pointsPerQuestion),
                        requiredTags: fromLineText(row.requiredTagsText),
                        excludedTags: fromLineText(row.excludedTagsText),
                        displayOrder: Number(row.displayOrder || index),
                      })),
                    }),
                  blueprintForm.id ? '문항 체계표를 수정했습니다.' : '문항 체계표를 저장했습니다.'
                )
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{blueprintForm.id ? '체계표 수정' : '체계표 등록'}</h3>
                <button type="button" className={secondaryButtonClassName} onClick={() => setBlueprintForm(buildBlueprintForm())}>
                  새 체계표
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="체계표명">
                  <input className={inputClassName} value={blueprintForm.blueprintName} onChange={(event) => setBlueprintForm((current) => ({ ...current, blueprintName: event.target.value }))} />
                </Field>
                <Field label="체계표 버전">
                  <input type="number" className={inputClassName} value={blueprintForm.blueprintVersion} onChange={(event) => setBlueprintForm((current) => ({ ...current, blueprintVersion: event.target.value }))} />
                </Field>
                <Field label="트랙 범위">
                  <select
                    className={inputClassName}
                    value={blueprintForm.track}
                    onChange={(event) =>
                      setBlueprintForm((current) => ({
                        ...current,
                        track: event.target.value as BlueprintFormState['track'],
                        rows: current.rows.map((row) => ({
                          ...row,
                          scope: event.target.value ? 'TRACK_SPECIFIC' : 'COMMON',
                        })),
                      }))
                    }
                  >
                    <option value="">공통(All)</option>
                    {TRACK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="시험 시간(분)">
                  <input type="number" className={inputClassName} value={blueprintForm.timeLimitMinutes} onChange={(event) => setBlueprintForm((current) => ({ ...current, timeLimitMinutes: event.target.value }))} />
                </Field>
                <Field label="합격 기준">
                  <input type="number" className={inputClassName} value={blueprintForm.passScore} onChange={(event) => setBlueprintForm((current) => ({ ...current, passScore: event.target.value }))} />
                </Field>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={blueprintForm.randomizationEnabled} onChange={(event) => setBlueprintForm((current) => ({ ...current, randomizationEnabled: event.target.checked }))} />
                해당 체계표로 생성되는 시험지는 문항 순서를 무작위로 구성합니다.
              </label>
              <Field label="운영 메모">
                <textarea className={`${inputClassName} min-h-24`} value={blueprintForm.notes} onChange={(event) => setBlueprintForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="총 문항 수" value={`${blueprintQuestionTotal}개`} />
                <MetricCard label="총점" value={`${blueprintPointTotal}점`} />
                <MetricCard label="행 수" value={`${blueprintForm.rows.length}개`} />
                <MetricCard label="범위" value={blueprintForm.track ? labelForTrack(blueprintForm.track) : '공통'} />
              </div>
              <div className="space-y-4">
                {blueprintForm.rows.map((row, rowIndex) => (
                  <div key={`blueprint-row-${rowIndex}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">분포 행 {rowIndex + 1}</p>
                      <button type="button" className={secondaryButtonClassName} onClick={() => setBlueprintForm((current) => ({ ...current, rows: current.rows.filter((_, index) => index !== rowIndex) }))} disabled={blueprintForm.rows.length === 1}>
                        삭제
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="역량 영역">
                        <select className={inputClassName} value={row.competencyDomain} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, competencyDomain: event.target.value as AiCompetencyDomain } : item) }))}>
                          {DOMAIN_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="문항 유형">
                        <select className={inputClassName} value={row.itemType} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, itemType: event.target.value as AiCompetencyQuestionType } : item) }))}>
                          {QUESTION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="난이도">
                        <select className={inputClassName} value={row.difficulty} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, difficulty: event.target.value as AiCompetencyDifficulty } : item) }))}>
                          {DIFFICULTY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="행 범위"><input className={inputClassName} value={row.scope === 'COMMON' ? '공통' : '트랙 전용'} disabled /></Field>
                      <Field label="필수 문항 수"><input type="number" className={inputClassName} value={row.requiredQuestionCount} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, requiredQuestionCount: event.target.value } : item) }))} /></Field>
                      <Field label="문항당 배점"><input type="number" className={inputClassName} value={row.pointsPerQuestion} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, pointsPerQuestion: event.target.value } : item) }))} /></Field>
                      <Field label="표시 순서"><input type="number" className={inputClassName} value={row.displayOrder} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, displayOrder: event.target.value } : item) }))} /></Field>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="필수 태그"><textarea className={`${inputClassName} min-h-24`} value={row.requiredTagsText} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, requiredTagsText: event.target.value } : item) }))} placeholder="한 줄에 하나씩 입력" /></Field>
                      <Field label="제외 태그"><textarea className={`${inputClassName} min-h-24`} value={row.excludedTagsText} onChange={(event) => setBlueprintForm((current) => ({ ...current, rows: current.rows.map((item, index) => index === rowIndex ? { ...item, excludedTagsText: event.target.value } : item) }))} placeholder="한 줄에 하나씩 입력" /></Field>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className={secondaryButtonClassName} onClick={() => setBlueprintForm((current) => ({ ...current, rows: [...current.rows, buildBlueprintRow(current.track ? 'TRACK_SPECIFIC' : 'COMMON')] }))}>
                분포 행 추가
              </button>
              <button type="submit" className={primaryButtonClassName} disabled={props.isPending || !props.pageData.selectedCycleId}>
                {blueprintForm.id ? '체계표 수정' : '체계표 저장'}
              </button>
            </form>
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="등록 체계표" value={`${props.pageData.adminView?.blueprints.length ?? 0}개`} />
                <MetricCard label="활성 체계표" value={`${props.pageData.adminView?.blueprints.filter((item) => item.status === 'ACTIVE').length ?? 0}개`} />
                <MetricCard label="문항 부족 경고" value={`${props.pageData.adminView?.blueprints.reduce((sum, item) => sum + item.shortageCount, 0) ?? 0}건`} />
              </div>
              {props.pageData.adminView?.blueprintLibrary.length ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">이전 주기 체계표 불러오기</h3>
                    <p className="text-sm text-slate-500">선택한 체계표를 현재 주기에 새 버전으로 복제합니다.</p>
                  </div>
                  <div className="space-y-2">
                    {props.pageData.adminView.blueprintLibrary.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-sm text-slate-700">
                          {item.year}년 {item.cycleName} / {item.blueprintName} v{item.blueprintVersion}
                          {item.track ? ` / ${labelForTrack(item.track)}` : ' / 공통'}
                        </div>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={props.isPending || !props.pageData.selectedCycleId}
                          onClick={() =>
                            props.runMutation(
                              () =>
                                props.callAction('duplicateBlueprint', {
                                  templateId: item.id,
                                  cycleId: props.pageData.selectedCycleId,
                                }),
                              '이전 주기 체계표를 복제했습니다.'
                            )
                          }
                        >
                          복제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-3">
                {props.pageData.adminView?.blueprints.map((blueprint) => {
                  const domainTotals = groupNumberRows(blueprint.rows.map((row) => domainLabel(row.competencyDomain)))
                  const typeTotals = groupNumberRows(blueprint.rows.map((row) => questionTypeLabel(row.itemType)))
                  const difficultyTotals = groupNumberRows(blueprint.rows.map((row) => difficultyLabel(row.difficulty)))
                  return (
                    <div key={blueprint.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <StatusPill value={blueprint.status} />
                            <StatusPill value={blueprint.track ?? 'COMMON'} customLabel={blueprint.track ? labelForTrack(blueprint.track) : '공통'} />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900">{blueprint.blueprintName} v{blueprint.blueprintVersion}</h3>
                          <p className="text-sm text-slate-600">총 {blueprint.totalQuestionCount}문항 / {blueprint.totalPoints}점 / {blueprint.timeLimitMinutes}분 / 합격 {blueprint.passScore}점</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a className={secondaryButtonClassName} href={blueprint.exportUrls.csv}>CSV</a>
                          <a className={secondaryButtonClassName} href={blueprint.exportUrls.xlsx}>XLSX</a>
                          <button type="button" className={secondaryButtonClassName} onClick={() => setBlueprintForm(mapBlueprintToForm(blueprint))}>편집</button>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={props.isPending || !blueprint.canActivate}
                            onClick={() =>
                              props.runMutation(
                                () => props.callAction('activateBlueprint', { templateId: blueprint.id }),
                                '문항 체계표를 활성화했습니다.'
                              )
                            }
                          >
                            활성화
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            disabled={props.isPending || blueprint.status === 'ARCHIVED'}
                            onClick={() =>
                              props.runMutation(
                                () => props.callAction('archiveBlueprint', { templateId: blueprint.id }),
                                '문항 체계표를 아카이브했습니다.'
                              )
                            }
                          >
                            아카이브
                          </button>
                        </div>
                      </div>
                      {blueprint.validationErrors.length ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                          {blueprint.validationErrors.join(' / ')}
                        </div>
                      ) : null}
                      {blueprint.shortageCount > 0 ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          문항 부족 경고 {blueprint.shortageCount}건이 있어 활성화 또는 시험 생성이 제한될 수 있습니다.
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <DataTable title="영역별 행 수" columns={['영역', '행 수']} rows={domainTotals.map(([label, count]) => [label, `${count}개`])} />
                        <DataTable title="유형별 행 수" columns={['유형', '행 수']} rows={typeTotals.map(([label, count]) => [label, `${count}개`])} />
                        <DataTable title="난이도별 행 수" columns={['난이도', '행 수']} rows={difficultyTotals.map(([label, count]) => [label, `${count}개`])} />
                      </div>
                      <div className="mt-4">
                        <DataTable
                          title="문항 분포 검증"
                          columns={['영역', '유형', '난이도', '범위', '필수', '가용', '부족', '배점']}
                          rows={blueprint.rows.map((row) => [
                            domainLabel(row.competencyDomain),
                            questionTypeLabel(row.itemType),
                            difficultyLabel(row.difficulty),
                            row.scope === 'COMMON' ? '공통' : '트랙 전용',
                            `${row.requiredQuestionCount}개`,
                            `${row.availableQuestionCount}개`,
                            `${row.shortageCount}개`,
                            `${row.pointsPerQuestion}점`,
                          ])}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === 'rubric' && (
        <SectionCard title="루브릭 시트" description="2차 실무인증 심사 기준, 배점, 합격 기준, 보너스 점수를 표준화합니다.">
          <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
            <form
              className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
              onSubmit={(event) => {
                event.preventDefault()
                if (!props.pageData.selectedCycleId) return
                props.runMutation(
                  () =>
                    props.callAction('upsertRubric', {
                      id: rubricForm.id,
                      cycleId: props.pageData.selectedCycleId,
                      rubricName: rubricForm.rubricName,
                      rubricVersion: Number(rubricForm.rubricVersion),
                      track: rubricForm.track || null,
                      totalScore: rubricTotalScore,
                      passScore: Number(rubricForm.passScore),
                      bonusScoreIfPassed: Number(rubricForm.bonusScoreIfPassed),
                      certificationLabel: rubricForm.certificationLabel,
                      notes: rubricForm.notes,
                      criteria: rubricForm.criteria.map((criterion, index) => ({
                        criterionCode: criterion.criterionCode,
                        criterionName: criterion.criterionName,
                        criterionDescription: criterion.criterionDescription,
                        maxScore: Number(criterion.maxScore),
                        displayOrder: Number(criterion.displayOrder || index),
                        mandatory: criterion.mandatory,
                        knockout: criterion.knockout,
                        bands: criterion.bands.map((band, bandIndex) => ({
                          score: Number(band.score),
                          title: band.title,
                          description: band.description,
                          guidance: band.guidance,
                          displayOrder: Number(band.displayOrder || bandIndex),
                        })),
                      })),
                    }),
                  rubricForm.id ? '루브릭 시트를 수정했습니다.' : '루브릭 시트를 저장했습니다.'
                )
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{rubricForm.id ? '루브릭 수정' : '루브릭 등록'}</h3>
                <button type="button" className={secondaryButtonClassName} onClick={() => setRubricForm(buildRubricForm())}>
                  새 루브릭
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="루브릭명"><input className={inputClassName} value={rubricForm.rubricName} onChange={(event) => setRubricForm((current) => ({ ...current, rubricName: event.target.value }))} /></Field>
                <Field label="루브릭 버전"><input type="number" className={inputClassName} value={rubricForm.rubricVersion} onChange={(event) => setRubricForm((current) => ({ ...current, rubricVersion: event.target.value }))} /></Field>
                <Field label="트랙 범위">
                  <select className={inputClassName} value={rubricForm.track} onChange={(event) => setRubricForm((current) => ({ ...current, track: event.target.value as RubricFormState['track'] }))}>
                    <option value="">공통(All)</option>
                    {TRACK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="합격 기준"><input type="number" className={inputClassName} value={rubricForm.passScore} onChange={(event) => setRubricForm((current) => ({ ...current, passScore: event.target.value }))} /></Field>
                <Field label="합격 시 보너스"><input type="number" className={inputClassName} value={rubricForm.bonusScoreIfPassed} onChange={(event) => setRubricForm((current) => ({ ...current, bonusScoreIfPassed: event.target.value }))} /></Field>
                <Field label="인증 라벨"><input className={inputClassName} value={rubricForm.certificationLabel} onChange={(event) => setRubricForm((current) => ({ ...current, certificationLabel: event.target.value }))} /></Field>
              </div>
              <Field label="운영 메모">
                <textarea className={`${inputClassName} min-h-24`} value={rubricForm.notes} onChange={(event) => setRubricForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="총점" value={`${rubricTotalScore}점`} />
                <MetricCard label="평가기준 수" value={`${rubricForm.criteria.length}개`} />
                <MetricCard label="트랙 범위" value={rubricForm.track ? labelForTrack(rubricForm.track) : '공통'} />
              </div>
              <div className="space-y-4">
                {rubricForm.criteria.map((criterion, criterionIndex) => (
                  <div key={`criterion-${criterionIndex}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">평가기준 {criterionIndex + 1}</p>
                      <button type="button" className={secondaryButtonClassName} onClick={() => setRubricForm((current) => ({ ...current, criteria: current.criteria.filter((_, index) => index !== criterionIndex) }))} disabled={rubricForm.criteria.length === 1}>
                        삭제
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="기준 코드"><input className={inputClassName} value={criterion.criterionCode} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, criterionCode: event.target.value } : item) }))} /></Field>
                      <Field label="기준명"><input className={inputClassName} value={criterion.criterionName} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, criterionName: event.target.value } : item) }))} /></Field>
                      <Field label="배점"><input type="number" className={inputClassName} value={criterion.maxScore} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, maxScore: event.target.value } : item) }))} /></Field>
                      <Field label="표시 순서"><input type="number" className={inputClassName} value={criterion.displayOrder} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, displayOrder: event.target.value } : item) }))} /></Field>
                    </div>
                    <Field label="기준 설명">
                      <textarea className={`${inputClassName} mt-4 min-h-24`} value={criterion.criterionDescription} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, criterionDescription: event.target.value } : item) }))} />
                    </Field>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={criterion.mandatory} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, mandatory: event.target.checked } : item) }))} />필수 기준</label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"><input type="checkbox" checked={criterion.knockout} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, knockout: event.target.checked } : item) }))} />위반 시 자동 불합격 기준</label>
                    </div>
                    <div className="mt-4 space-y-3">
                      {criterion.bands.map((band, bandIndex) => (
                        <div key={`band-${criterionIndex}-${bandIndex}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">점수 밴드 {bandIndex + 1}</p>
                            <button type="button" className={secondaryButtonClassName} onClick={() => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, bands: item.bands.filter((_, idx) => idx !== bandIndex) } : item) }))} disabled={criterion.bands.length === 1}>
                              삭제
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="점수"><input type="number" className={inputClassName} value={band.score} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, bands: item.bands.map((bandItem, idx) => idx === bandIndex ? { ...bandItem, score: event.target.value } : bandItem) } : item) }))} /></Field>
                            <Field label="밴드명"><input className={inputClassName} value={band.title} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, bands: item.bands.map((bandItem, idx) => idx === bandIndex ? { ...bandItem, title: event.target.value } : bandItem) } : item) }))} /></Field>
                            <Field label="설명"><textarea className={`${inputClassName} min-h-24`} value={band.description} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, bands: item.bands.map((bandItem, idx) => idx === bandIndex ? { ...bandItem, description: event.target.value } : bandItem) } : item) }))} /></Field>
                            <Field label="리뷰어 가이드"><textarea className={`${inputClassName} min-h-24`} value={band.guidance} onChange={(event) => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, bands: item.bands.map((bandItem, idx) => idx === bandIndex ? { ...bandItem, guidance: event.target.value } : bandItem) } : item) }))} /></Field>
                          </div>
                        </div>
                      ))}
                      <button type="button" className={secondaryButtonClassName} onClick={() => setRubricForm((current) => ({ ...current, criteria: current.criteria.map((item, index) => index === criterionIndex ? { ...item, bands: [...item.bands, buildRubricBand('0', `밴드 ${item.bands.length + 1}`, String(item.bands.length))] } : item) }))}>
                        점수 밴드 추가
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className={secondaryButtonClassName} onClick={() => setRubricForm((current) => ({ ...current, criteria: [...current.criteria, buildRubricCriterion()] }))}>
                평가기준 추가
              </button>
              <button type="submit" className={primaryButtonClassName} disabled={props.isPending || !props.pageData.selectedCycleId}>
                {rubricForm.id ? '루브릭 수정' : '루브릭 저장'}
              </button>
            </form>
            <div className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="등록 루브릭" value={`${props.pageData.adminView?.rubrics.length ?? 0}개`} />
                <MetricCard label="활성 루브릭" value={`${props.pageData.adminView?.rubrics.filter((item) => item.status === 'ACTIVE').length ?? 0}개`} />
                <MetricCard label="총 평가기준 수" value={`${props.pageData.adminView?.rubrics.reduce((sum, item) => sum + item.criteria.length, 0) ?? 0}개`} />
              </div>
              {props.pageData.adminView?.rubricLibrary.length ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">이전 주기 루브릭 불러오기</h3>
                    <p className="text-sm text-slate-500">선택한 루브릭을 현재 주기에 새 버전으로 복제합니다.</p>
                  </div>
                  <div className="space-y-2">
                    {props.pageData.adminView.rubricLibrary.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-sm text-slate-700">
                          {item.year}년 {item.cycleName} / {item.rubricName} v{item.rubricVersion}
                          {item.track ? ` / ${labelForTrack(item.track)}` : ' / 공통'}
                        </div>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          disabled={props.isPending || !props.pageData.selectedCycleId}
                          onClick={() =>
                            props.runMutation(
                              () =>
                                props.callAction('duplicateRubric', {
                                  templateId: item.id,
                                  cycleId: props.pageData.selectedCycleId,
                                }),
                              '이전 주기 루브릭을 복제했습니다.'
                            )
                          }
                        >
                          복제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-3">
                {props.pageData.adminView?.rubrics.map((rubric) => (
                  <div key={rubric.id} className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill value={rubric.status} />
                          <StatusPill value={rubric.track ?? 'COMMON'} customLabel={rubric.track ? labelForTrack(rubric.track) : '공통'} />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">{rubric.rubricName} v{rubric.rubricVersion}</h3>
                        <p className="text-sm text-slate-600">총점 {rubric.totalScore}점 / 합격 {rubric.passScore}점 / 합격 시 보너스 {rubric.bonusScoreIfPassed}점</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={secondaryButtonClassName} onClick={() => setRubricForm(mapRubricToForm(rubric))}>편집</button>
                        <button type="button" className={secondaryButtonClassName} disabled={props.isPending || !rubric.canActivate} onClick={() => props.runMutation(() => props.callAction('activateRubric', { templateId: rubric.id }), '루브릭 시트를 활성화했습니다.')}>활성화</button>
                        <button type="button" className={secondaryButtonClassName} disabled={props.isPending || rubric.status === 'ARCHIVED'} onClick={() => props.runMutation(() => props.callAction('archiveRubric', { templateId: rubric.id }), '루브릭 시트를 아카이브했습니다.')}>아카이브</button>
                      </div>
                    </div>
                    {rubric.validationErrors.length ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {rubric.validationErrors.join(' / ')}
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <DataTable
                        title="평가기준"
                        columns={['코드', '기준', '배점', '필수', 'Knockout', '밴드 수']}
                        rows={rubric.criteria.map((criterion) => [
                          criterion.criterionCode,
                          criterion.criterionName,
                          `${criterion.maxScore}점`,
                          criterion.mandatory ? '필수' : '선택',
                          criterion.knockout ? '예' : '아니오',
                          `${criterion.bands.length}개`,
                        ])}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === 'operations' && (
        <SectionCard title="채점/승인/반영" description="서술형 수기 채점, 리뷰어 배정, 외부자격 승인, PMS 결과 반영을 처리합니다.">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">서술형/실무형 수기 채점</h3>
                {!props.pageData.adminView?.manualScoringQueue.length ? (
                  <EmptyBox message="현재 수기 채점이 필요한 답안이 없습니다." />
                ) : (
                  <>
                    <select className={`${inputClassName} mt-4`} value={manualScore.answerId} onChange={(event) => setManualScore({ answerId: event.target.value, score: '', reviewerNote: '' })}>
                      {props.pageData.adminView.manualScoringQueue.map((row) => (
                        <option key={row.answerId} value={row.answerId}>{row.employeeName} / {row.questionTitle}</option>
                      ))}
                    </select>
                    {selectedManualRow ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        {selectedManualRow.answerText || '응답 내용이 없습니다.'}
                      </div>
                    ) : null}
                    <div className="mt-4 grid gap-4">
                      <Field label="점수"><input type="number" className={inputClassName} value={manualScore.score} onChange={(event) => setManualScore((current) => ({ ...current, score: event.target.value }))} /></Field>
                      <Field label="채점 메모"><textarea className={`${inputClassName} min-h-24`} value={manualScore.reviewerNote} onChange={(event) => setManualScore((current) => ({ ...current, reviewerNote: event.target.value }))} /></Field>
                      <button
                        type="button"
                        className={primaryButtonClassName}
                        disabled={props.isPending || !manualScore.answerId}
                        onClick={() =>
                          props.runMutation(
                            () =>
                              props.callAction('scoreShortAnswer', {
                                answerId: manualScore.answerId,
                                manualScore: Number(manualScore.score),
                                reviewerNote: manualScore.reviewerNote,
                              }),
                            '답안을 채점했습니다.'
                          )
                        }
                      >
                        채점 저장
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">2차 제출건 리뷰어 배정</h3>
                {!props.pageData.adminView?.secondRoundQueue.length ? (
                  <div className="mt-4">
                    <EmptyBox message="현재 리뷰어를 배정할 2차 제출건이 없습니다." />
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <Field label="제출건 선택">
                      <select className={inputClassName} value={reviewerAssignmentSubmissionId} onChange={(event) => setReviewerAssignmentSubmissionId(event.target.value)}>
                        {props.pageData.adminView?.secondRoundQueue.map((item) => (
                          <option key={item.submissionId} value={item.submissionId}>
                            {item.employeeName} / {labelForTrack(item.track)} / {STATUS_LABELS[item.status] ?? item.status}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {selectedSubmission ? (
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>
                          제출물 {selectedSubmission.artifactCount}건 / 현재 리뷰어 {selectedSubmission.reviewerCount}명 / 제출 {formatDateTime(selectedSubmission.submittedAt)}
                        </p>
                        <p>
                          현재 배정: {selectedSubmission.reviewerNames.length ? selectedSubmission.reviewerNames.join(', ') : '미배정'}
                        </p>
                      </div>
                    ) : null}
                    <div className="max-h-48 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
                      {props.pageData.adminView?.reviewerDirectory.map((reviewer) => (
                        <label key={reviewer.id} className="flex items-start gap-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={reviewerIds.includes(reviewer.id)}
                            onChange={(event) =>
                              setReviewerIds((current) =>
                                event.target.checked ? [...current, reviewer.id] : current.filter((item) => item !== reviewer.id)
                              )
                            }
                          />
                          <span>{reviewer.name} / {reviewer.department} / {reviewer.position}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={props.isPending || !reviewerAssignmentSubmissionId || reviewerIds.length === 0}
                      onClick={() =>
                        props.runMutation(
                          () =>
                            props.callAction('assignReviewers', {
                              submissionId: reviewerAssignmentSubmissionId,
                              reviewerIds,
                            }),
                          '리뷰어를 배정했습니다.'
                        )
                      }
                    >
                      리뷰어 배정
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">외부자격 승인</h3>
                {!props.pageData.adminView?.certClaims.length ? (
                  <div className="mt-4">
                    <EmptyBox message="현재 승인 대기 중인 외부자격 요청이 없습니다." />
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <Field label="승인 대상">
                      <select className={inputClassName} value={certDecision.claimId} onChange={(event) => setCertDecision((current) => ({ ...current, claimId: event.target.value }))}>
                        {props.pageData.adminView?.certClaims.map((claim) => (
                          <option key={claim.claimId} value={claim.claimId}>
                            {claim.employeeName} / {claim.certificateName} / {STATUS_LABELS[claim.status] ?? claim.status}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="반려 사유"><textarea className={`${inputClassName} min-h-24`} value={certDecision.rejectionReason} onChange={(event) => setCertDecision((current) => ({ ...current, rejectionReason: event.target.value }))} /></Field>
                    {selectedClaim ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        인정 점수 {selectedClaim.mappedScoreSnapshot}점 / 제출 {formatDateTime(selectedClaim.submittedAt)} / 증빙 {selectedClaim.proofFileName}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <button type="button" className={secondaryButtonClassName} disabled={props.isPending || !certDecision.claimId} onClick={() => props.runMutation(() => props.callAction('decideCertClaim', { claimId: certDecision.claimId, action: 'APPROVE' }), '외부자격을 승인했습니다.')}>승인</button>
                      <button type="button" className={secondaryButtonClassName} disabled={props.isPending || !certDecision.claimId} onClick={() => props.runMutation(() => props.callAction('decideCertClaim', { claimId: certDecision.claimId, action: 'REJECT', rejectionReason: certDecision.rejectionReason }), '외부자격 요청을 반려했습니다.')}>반려</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">결과 보정 및 PMS 반영</h3>
                <div className="mt-4 space-y-4">
                  {!props.pageData.adminView?.results.length ? (
                    <EmptyBox message="아직 계산된 최종 결과가 없습니다. PMS 결과 반영을 실행하면 결과 행이 생성됩니다." />
                  ) : (
                    <>
                      <Field label="결과 선택">
                        <select className={inputClassName} value={overrideResult.resultId} onChange={(event) => setOverrideResult((current) => ({ ...current, resultId: event.target.value }))}>
                          {props.pageData.adminView?.results.map((result) => (
                            <option key={result.resultId} value={result.resultId}>
                              {result.employeeName} / {result.finalScore.toFixed(1)}점 / {result.finalGrade}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {selectedResult ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          현재 점수 {selectedResult.finalScore.toFixed(1)}점 / 반영 상태 {STATUS_LABELS[selectedResult.syncState] ?? selectedResult.syncState}
                        </div>
                      ) : null}
                      <Field label="보정 점수"><input type="number" className={inputClassName} value={overrideResult.overrideScore} onChange={(event) => setOverrideResult((current) => ({ ...current, overrideScore: event.target.value }))} /></Field>
                      <Field label="보정 사유"><textarea className={`${inputClassName} min-h-24`} value={overrideResult.overrideReason} onChange={(event) => setOverrideResult((current) => ({ ...current, overrideReason: event.target.value }))} /></Field>
                      <button type="button" className={secondaryButtonClassName} disabled={props.isPending || !overrideResult.resultId} onClick={() => props.runMutation(() => props.callAction('overrideResult', { resultId: overrideResult.resultId, overrideScore: Number(overrideResult.overrideScore), overrideReason: overrideResult.overrideReason }), '결과를 보정했습니다.')}>보정 저장</button>
                    </>
                  )}
                  <button type="button" className={primaryButtonClassName} disabled={props.isPending || !props.pageData.selectedCycleId} onClick={() => props.runMutation(() => props.callAction('publishResults', { cycleId: props.pageData.selectedCycleId }), 'AI 활용능력 평가 결과를 PMS에 반영했습니다.')}>PMS 결과 반영</button>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
