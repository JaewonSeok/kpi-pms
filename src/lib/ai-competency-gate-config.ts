import type {
  AiCompetencyGateDecision,
  AiCompetencyGateStatus,
  AiCompetencyGateTrack,
  AiCompetencyGateTrackApplicability,
} from '@prisma/client'

export const AI_COMPETENCY_GATE_TRACK_LABELS: Record<AiCompetencyGateTrack, string> = {
  AI_PROJECT_EXECUTION: 'AI 기반 프로젝트 수행',
  AI_USE_CASE_EXPANSION: 'AI 활용 사례 확산',
}

export const AI_COMPETENCY_GATE_STATUS_LABELS: Record<AiCompetencyGateStatus, string> = {
  NOT_STARTED: '미시작',
  DRAFT: '작성중',
  SUBMITTED: '제출완료',
  UNDER_REVIEW: '검토중',
  REVISION_REQUESTED: '보완요청',
  RESUBMITTED: '제출완료',
  PASSED: '통과',
  FAILED: '미통과',
  CLOSED: '마감',
}

export const AI_COMPETENCY_GATE_DECISION_LABELS: Record<AiCompetencyGateDecision, string> = {
  PASS: 'Pass',
  REVISION_REQUIRED: '보완 요청',
  FAIL: 'Fail',
}

export type GateVisibleStatus = keyof typeof AI_COMPETENCY_GATE_STATUS_LABELS | 'NOT_ASSIGNED'

export const AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS: Record<GateVisibleStatus, string> = {
  NOT_ASSIGNED: '미대상',
  ...AI_COMPETENCY_GATE_STATUS_LABELS,
}

export const AI_COMPETENCY_GATE_TERMINAL_STATUSES: AiCompetencyGateStatus[] = ['PASSED', 'FAILED', 'CLOSED']

export const AI_COMPETENCY_GATE_ALLOWED_TRANSITIONS: Record<
  AiCompetencyGateStatus,
  AiCompetencyGateStatus[]
> = {
  NOT_STARTED: ['DRAFT', 'CLOSED'],
  DRAFT: ['SUBMITTED', 'CLOSED'],
  SUBMITTED: ['UNDER_REVIEW', 'CLOSED'],
  UNDER_REVIEW: ['REVISION_REQUESTED', 'PASSED', 'FAILED', 'CLOSED'],
  REVISION_REQUESTED: ['RESUBMITTED', 'CLOSED'],
  RESUBMITTED: ['UNDER_REVIEW', 'CLOSED'],
  PASSED: [],
  FAILED: [],
  CLOSED: [],
}

export function canGateStatusTransition(from: AiCompetencyGateStatus, to: AiCompetencyGateStatus) {
  return AI_COMPETENCY_GATE_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

export function canEmployeeEditGateCase(status: GateVisibleStatus) {
  return status === 'NOT_STARTED' || status === 'DRAFT' || status === 'REVISION_REQUESTED'
}

export function canReviewerWriteGateReview(status: AiCompetencyGateStatus) {
  return status === 'SUBMITTED' || status === 'UNDER_REVIEW' || status === 'RESUBMITTED'
}

export function getGateTrackLabel(track?: AiCompetencyGateTrack | null) {
  if (!track) return '트랙 미선택'
  return AI_COMPETENCY_GATE_TRACK_LABELS[track] ?? track
}

export function getGateStatusLabel(status: GateVisibleStatus) {
  return AI_COMPETENCY_GATE_VISIBLE_STATUS_LABELS[status] ?? status
}

export function getGateDecisionLabel(decision?: AiCompetencyGateDecision | null) {
  if (!decision) return '결정 전'
  return AI_COMPETENCY_GATE_DECISION_LABELS[decision] ?? decision
}

export type GateCriterionSeed = {
  criterionCode: string
  criterionName: string
  criterionDescription: string
  trackApplicability: AiCompetencyGateTrackApplicability
  mandatory: boolean
  knockout: boolean
  passGuidance: string
  revisionGuidance: string
  failGuidance: string
}

export const AI_COMPETENCY_GATE_DEFAULT_CRITERIA: GateCriterionSeed[] = [
  {
    criterionCode: 'REAL_BUSINESS_PROBLEM',
    criterionName: '실제 업무 문제 정의',
    criterionDescription: '실제 업무에서 해결하려는 문제와 중요성이 구체적으로 설명되어야 합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '실제 업무 맥락과 문제 정의가 명확하고, 왜 중요한지 설득력 있게 설명됩니다.',
    revisionGuidance: '업무 문제는 있으나 범위나 중요성 설명이 부족합니다.',
    failGuidance: '실제 업무 문제로 보기 어렵거나 개인적 실험 수준에 머뭅니다.',
  },
  {
    criterionCode: 'OWNER_PM_ROLE',
    criterionName: 'Owner/PM 역할',
    criterionDescription: '신청자가 Owner 또는 PM에 준하는 주도 역할을 수행했는지 확인합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '신청자의 주도 역할과 의사결정 책임이 분명하게 드러납니다.',
    revisionGuidance: '참여는 했지만 주도 역할의 범위가 불명확합니다.',
    failGuidance: '본인 주도 역할이 없거나 단순 참여 수준입니다.',
  },
  {
    criterionCode: 'WORKFLOW_CHANGE',
    criterionName: '실제 업무 방식 변화',
    criterionDescription: 'AI 도입으로 기존 업무 방식이 실제로 달라졌는지 확인합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '기존 방식과 AI 적용 후 방식의 차이가 분명하고 재현 가능합니다.',
    revisionGuidance: '변화는 있으나 흐름 설명이 충분하지 않습니다.',
    failGuidance: '실질적인 업무 방식 변화가 확인되지 않습니다.',
  },
  {
    criterionCode: 'BEFORE_AFTER_EVIDENCE',
    criterionName: 'Before/After 근거',
    criterionDescription: '이전 방식과 이후 방식의 차이를 보여주는 근거 자료가 있어야 합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: 'Before/After 근거가 제출되어 차이가 검증 가능합니다.',
    revisionGuidance: '근거가 일부 있으나 비교가 충분하지 않습니다.',
    failGuidance: '비교 근거가 없어 개선 여부를 확인할 수 없습니다.',
  },
  {
    criterionCode: 'MEASURABLE_IMPACT',
    criterionName: '측정 가능 또는 검증 가능한 효과',
    criterionDescription: '정량 또는 명확한 검증 기준으로 효과가 확인되어야 합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '효과가 수치나 명확한 검증 기준으로 확인됩니다.',
    revisionGuidance: '효과는 있으나 측정 근거가 약합니다.',
    failGuidance: '효과가 모호하거나 검증할 수 없습니다.',
  },
  {
    criterionCode: 'TEAM_ORG_ADOPTION',
    criterionName: '팀/조직 적용 및 확산',
    criterionDescription: '개인 사용을 넘어 팀이나 조직으로 재사용 또는 확산된 흔적이 있어야 합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '개인 활용을 넘어 팀/조직 수준의 적용 흔적이 있습니다.',
    revisionGuidance: '공유는 했으나 확산 근거가 부족합니다.',
    failGuidance: '개인 실험에 머물며 확산 근거가 없습니다.',
  },
  {
    criterionCode: 'REUSABLE_ARTIFACT',
    criterionName: '재사용 가능한 산출물 또는 프로세스',
    criterionDescription: '템플릿, 가이드, 문서화된 프로세스 등 재사용 가능한 산출물이 필요합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '재사용 가능한 산출물 또는 프로세스가 명확히 제시됩니다.',
    revisionGuidance: '산출물은 있으나 재사용 가능성이 약합니다.',
    failGuidance: '재사용 가능한 산출물이 없습니다.',
  },
  {
    criterionCode: 'HUMAN_REVIEW_CONTROL',
    criterionName: '사람의 최종 검토 및 판단 통제',
    criterionDescription: 'AI 결과를 사람이 최종 검토하고 책임 있게 판단했는지 확인합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: true,
    passGuidance: '최종 검토와 승인 책임이 사람에게 있음을 명확히 보여줍니다.',
    revisionGuidance: '사람 검토가 있었으나 통제 방식 설명이 부족합니다.',
    failGuidance: 'AI 결과를 사람 검토 없이 최종 판단에 사용했습니다.',
  },
  {
    criterionCode: 'SECURITY_ETHICS_PRIVACY',
    criterionName: '보안/윤리/개인정보 대응',
    criterionDescription: '민감정보, 승인 도구, 윤리/보안 대응이 명확해야 합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: true,
    passGuidance: '보안, 윤리, 개인정보 대응이 구체적으로 설명되고 준수됩니다.',
    revisionGuidance: '보안/윤리 고려는 있으나 구체성이 부족합니다.',
    failGuidance: '보안·윤리 위반 우려가 있거나 민감정보 처리 기준이 불명확합니다.',
  },
  {
    criterionCode: 'SHARING_EXPANSION',
    criterionName: '공유/확산 활동',
    criterionDescription: '세미나, 공유회, 문서 배포 등 확산 활동 근거를 확인합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '공유 또는 확산 활동이 구체적 근거와 함께 제시됩니다.',
    revisionGuidance: '공유는 있었으나 근거가 약합니다.',
    failGuidance: '공유 또는 확산 활동이 확인되지 않습니다.',
  },
  {
    criterionCode: 'EXPLANATION_REPRODUCIBILITY',
    criterionName: '설명 가능성 및 재현 가능성',
    criterionDescription: '제출 내용을 타인이 이해하고 재현할 수 있어야 합니다.',
    trackApplicability: 'COMMON',
    mandatory: true,
    knockout: false,
    passGuidance: '업무 맥락, 실행 방식, 검증 절차가 충분히 설명되어 재현 가능합니다.',
    revisionGuidance: '전반 흐름은 이해되나 재현 정보가 부족합니다.',
    failGuidance: '설명이 부족해 타인이 이해하거나 재현하기 어렵습니다.',
  },
]

export type GateGuideSeed = {
  key: string
  entryType: 'GUIDE' | 'PASS_EXAMPLE' | 'FAIL_EXAMPLE' | 'FAQ'
  trackApplicability: AiCompetencyGateTrackApplicability
  title: string
  summary: string
  body: string
  displayOrder: number
}

export const AI_COMPETENCY_GATE_DEFAULT_GUIDE_ENTRIES: GateGuideSeed[] = [
  {
    key: 'overview-guide',
    entryType: 'GUIDE',
    trackApplicability: 'COMMON',
    title: 'AI 역량평가 안내',
    summary: 'AI를 활용해 실제 업무를 개선하고, 그 효과를 입증했는지 확인하는 승진 필수 요건입니다.',
    body: 'AI 역량평가는 연간 점수를 더하는 항목이 아니라 승진 심사 시 통과 여부를 확인하는 별도 요건입니다.\n\n신청자는 실제 업무 문제를 해결하기 위해 AI를 사용했고, 본인이 Owner/PM 역할을 수행했으며, Before/After 근거와 측정 가능한 효과를 제시해야 합니다. 또한 사람의 최종 검토가 유지되었고, 보안/윤리/개인정보 대응이 적절했으며, 개인 실험을 넘어 팀 또는 조직에 공유되거나 확산된 흔적이 있어야 합니다.',
    displayOrder: 10,
  },
  {
    key: 'track-project-guide',
    entryType: 'GUIDE',
    trackApplicability: 'PROJECT_ONLY',
    title: '트랙 A 작성 가이드',
    summary: '실제 AI 기반 개선 프로젝트를 주도한 경우 선택합니다.',
    body: '트랙 A는 신청자가 실제 프로젝트를 Owner 또는 PM 관점에서 주도했는지 확인합니다.\n\n프로젝트 배경, 이해관계자, 실행 단계, 산출물, 프로젝트 기간, 기여 요약을 구체적으로 작성해 주세요. 단순 참여나 도구 사용 경험만으로는 부족합니다.',
    displayOrder: 20,
  },
  {
    key: 'track-adoption-guide',
    entryType: 'GUIDE',
    trackApplicability: 'ADOPTION_ONLY',
    title: '트랙 B 작성 가이드',
    summary: '개인 활용을 넘어 팀 또는 조직에 재사용 가능한 AI 활용 사례를 확산한 경우 선택합니다.',
    body: '트랙 B는 재사용 가능한 활용 사례를 만들고 실제로 팀/본부 또는 조직에 확산했는지 확인합니다.\n\n반복 사용 사례, 적용 범위, 측정 가능한 효과, 세미나/공유 근거, 조직 확산 내용을 중심으로 작성해 주세요.',
    displayOrder: 30,
  },
  {
    key: 'submission-checklist',
    entryType: 'GUIDE',
    trackApplicability: 'COMMON',
    title: '제출 전 체크리스트',
    summary: '제출 전 반드시 확인해야 할 핵심 항목입니다.',
    body: '1. 실제 업무 문제와 목표가 분명한가?\n2. 본인의 Owner/PM 역할이 드러나는가?\n3. Before/After 근거가 있는가?\n4. 측정 가능한 효과 또는 검증 기준이 있는가?\n5. 사람의 최종 검토 방식이 명시되었는가?\n6. 보안/윤리/개인정보 대응을 설명했는가?\n7. 재사용 가능한 산출물 또는 프로세스가 있는가?\n8. 팀/조직 공유 또는 확산 근거가 있는가?',
    displayOrder: 40,
  },
  {
    key: 'pass-example-hr',
    entryType: 'PASS_EXAMPLE',
    trackApplicability: 'COMMON',
    title: 'HR 채용 운영 개선',
    summary: '채용 공고 응대, 지원자 분류, 면접 일정 조율을 AI로 정리하고 운영 리드타임을 줄인 사례입니다.',
    body: '지원자 문의 분류와 공고별 FAQ 응답 초안을 AI로 자동 정리하고, 채용 담당자가 최종 검토 후 발송하도록 프로세스를 재설계했습니다. 응답 리드타임과 누락 건수를 Before/After로 비교하고, 운영 가이드와 템플릿을 HR팀 전체에 배포해 재사용 가능성을 확보했습니다.',
    displayOrder: 100,
  },
  {
    key: 'pass-example-sales',
    entryType: 'PASS_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '영업 제안서 대응 개선',
    summary: '반복 제안서 작성 업무를 표준 템플릿과 검토 절차로 묶어 제안 대응 속도를 개선한 사례입니다.',
    body: '제안 요청서 요약, 초안 생성, 누락 체크를 AI 기반으로 정리하고 영업 담당자가 최종 수정 및 승인하도록 운영했습니다. 제안 준비 시간과 수주 대응 리드타임을 측정했고, 제안 템플릿과 검수 체크리스트를 조직에 공유했습니다.',
    displayOrder: 110,
  },
  {
    key: 'pass-example-cs',
    entryType: 'PASS_EXAMPLE',
    trackApplicability: 'COMMON',
    title: 'CS/VOC 분석 개선',
    summary: 'VOC 분류와 이슈 패턴 분석을 표준화해 반복 대응 시간을 줄인 사례입니다.',
    body: 'VOC 원문을 AI로 1차 분류하고, 담당자가 최종 분류를 확인한 뒤 리포트에 반영했습니다. 이슈 카테고리 분류 정확도와 보고 준비 시간을 전후 비교했고, 분석 템플릿과 운영 절차를 팀 내 반복 사용하도록 정리했습니다.',
    displayOrder: 120,
  },
  {
    key: 'pass-example-finance',
    entryType: 'PASS_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '재무/경영관리 개선',
    summary: '월간 경영 보고 자료 정리와 코멘트 초안 작성 시간을 줄인 사례입니다.',
    body: '월간 실적 자료 요약과 차이 분석 코멘트 초안을 AI가 생성하고, 재무 담당자가 수치와 해석을 검증한 뒤 최종 보고에 반영했습니다. 보고 준비 시간 단축과 오류 감소를 측정하고, 재사용 가능한 템플릿과 검증 절차를 경영관리팀에 공유했습니다.',
    displayOrder: 130,
  },
  {
    key: 'fail-example-mail',
    entryType: 'FAIL_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '개인적으로 메일 초안만 작성',
    summary: '개인 편의를 위한 단순 활용은 통과 사례로 보기 어렵습니다.',
    body: '개인적으로 메일 초안을 작성해 본 경험만 있고 실제 업무 프로세스 개선, 조직 공유, 측정 가능한 효과가 없다면 AI 역량평가 통과 기준에 해당하지 않습니다.',
    displayOrder: 200,
  },
  {
    key: 'fail-example-no-impact',
    entryType: 'FAIL_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '측정 가능한 효과 없음',
    summary: '효과를 수치나 명확한 검증 방식으로 설명할 수 없다면 부족합니다.',
    body: 'AI를 사용했다고 해도 업무 속도, 품질, 오류 감소 등 효과가 전혀 측정되지 않거나 검증 근거가 없으면 통과하기 어렵습니다.',
    displayOrder: 210,
  },
  {
    key: 'fail-example-not-owner',
    entryType: 'FAIL_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '본인이 owner 아님',
    summary: '주도 역할 없이 보조 참여만 한 경우 기준에 미치지 못합니다.',
    body: '다른 사람이 주도한 프로젝트에 단순 참여만 했고 본인의 Owner/PM 역할을 설명할 수 없다면 보완 또는 미통과 사유가 됩니다.',
    displayOrder: 220,
  },
  {
    key: 'fail-example-no-adoption',
    entryType: 'FAIL_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '팀 적용/확산 없음',
    summary: '개인 사용에 머무르고 팀 또는 조직 적용이 없는 경우입니다.',
    body: '팀이나 조직에 재사용 가능한 형태로 공유되지 않았고 실제 적용 흔적도 없다면 확산 요건을 충족하지 못합니다.',
    displayOrder: 230,
  },
  {
    key: 'fail-example-security',
    entryType: 'FAIL_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '보안/윤리 위반 우려',
    summary: '민감정보 처리와 승인 도구 사용 기준이 불명확하면 통과할 수 없습니다.',
    body: '개인정보, 민감한 경영정보, 외부 반출 금지 데이터를 승인되지 않은 도구에 입력했거나 관련 통제가 설명되지 않으면 미통과 대상입니다.',
    displayOrder: 240,
  },
  {
    key: 'fail-example-no-human-review',
    entryType: 'FAIL_EXAMPLE',
    trackApplicability: 'COMMON',
    title: '인간 검토 없이 AI 판단 사용',
    summary: 'AI를 최종 판단 주체로 사용한 경우는 허용되지 않습니다.',
    body: '채용 합격/불합격, 인사 징계, 법률 판단, 재무 최종 승인과 같이 사람이 최종 판단해야 하는 영역에 AI 결과를 그대로 사용하면 미통과 사유가 됩니다.',
    displayOrder: 250,
  },
]
