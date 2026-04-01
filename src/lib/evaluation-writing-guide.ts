import type { EvaluationAssistEvidenceView, EvaluationAssistMode } from '@/lib/evaluation-ai-assist'

export type EvaluationQualityWarningKey =
  | 'short-comment'
  | 'generic-comment'
  | 'missing-evidence'
  | 'bias-risk'
  | 'emotional-tone'
  | 'missing-action'

export type EvaluationQualityWarning = {
  key: EvaluationQualityWarningKey
  title: string
  message: string
}

export type EvaluationGuideSection = {
  id: string
  title: string
  description: string
  items: string[]
}

export type EvaluationGuideExample = {
  id: string
  title: string
  bad: string
  good: string
  takeaway: string
}

const GENERIC_PATTERNS = [
  /전반적으로/i,
  /무난/i,
  /잘했/i,
  /노력했/i,
  /성실/i,
  /문제없/i,
  /괜찮/i,
]

const EMOTIONAL_PATTERNS = [/실망/i, /답답/i, /문제다/i, /태도가/i, /감정적/i, /짜증/i, /게으/i, /불성실/i]
const BIAS_PATTERNS = [/항상/i, /절대/i, /원래/i, /성격상/i, /리더답지/i, /누구보다/i, /타고난/i]
const EVIDENCE_PATTERNS = [/KPI/i, /실적/i, /달성/i, /근거/i, /체크인/i, /월간/i, /피드백/i, /프로젝트/i, /지표/i, /%/]
const ACTION_PATTERNS = [/다음/i, /개선/i, /보완/i, /제안/i, /실행/i, /시도/i, /계획/i, /지원/i, /코칭/i]

export const EVALUATION_GUIDE_SECTIONS: EvaluationGuideSection[] = [
  {
    id: 'checklist',
    title: '목표 명확화 체크리스트',
    description: '평가 문장을 쓰기 전에 목표와 역할, 근거의 연결을 먼저 확인하세요.',
    items: [
      '이 평가는 실제 KPI와 역할 기대 수준에 연결되어 있는가',
      '최근 월간 실적, 체크인, 피드백 등 확인 가능한 근거를 먼저 확인했는가',
      '최근 한두 사례가 아니라 주기 전체 흐름을 함께 보고 있는가',
    ],
  },
  {
    id: 'feedback',
    title: '피드백 상시화 가이드',
    description: '연말성 평가가 아니라 지속 피드백의 연장선에서 코멘트를 정리합니다.',
    items: [
      '월간 실적과 체크인에서 반복적으로 확인된 패턴을 중심으로 정리하세요.',
      '이미 나눈 피드백이 있다면 이번 평가 코멘트와 연결해 일관성을 유지하세요.',
      '평가 결과만 적지 말고 다음 1:1과 후속 지원 방향까지 연결하세요.',
    ],
  },
  {
    id: 'bias',
    title: '평가 오류·편향 주의',
    description: '관대화, 엄격화, 중심화, 최근성, 후광효과를 줄이기 위한 기본 점검입니다.',
    items: [
      '최근 한 사건만으로 전체 성과를 단정하지 않았는지 확인하세요.',
      '개인 호감/비호감이나 커뮤니케이션 스타일을 성과 판단과 섞지 마세요.',
      '항상, 절대, 원래 같은 단정 표현은 근거와 함께 재검토하세요.',
    ],
  },
  {
    id: 'examples',
    title: '좋은 코멘트 / 나쁜 코멘트 예시',
    description: '모호한 칭찬이나 비난보다, 근거와 다음 행동이 함께 들어간 문장이 좋습니다.',
    items: [
      '모호한 칭찬보다 KPI, 실적, 협업 맥락이 드러나는 문장을 우선하세요.',
      '비난형 표현 대신 보완 포인트와 지원 방안을 함께 적으세요.',
      '최종 판단은 사람 책임이며, AI 초안도 같은 기준으로 검토해야 합니다.',
    ],
  },
]

export const EVALUATION_GUIDE_EXAMPLES: EvaluationGuideExample[] = [
  {
    id: 'evidence',
    title: '근거가 보이는 코멘트',
    bad: '전반적으로 잘했습니다.',
    good: '3월까지 핵심 KPI 4건 중 3건을 계획 일정 안에 완료했고, 체크인에서 확인된 우선순위 조정도 빠르게 반영했습니다.',
    takeaway: '무엇을, 어떤 근거로 평가했는지 드러나야 합니다.',
  },
  {
    id: 'coaching',
    title: '코칭형 문장',
    bad: '커뮤니케이션이 부족합니다.',
    good: '프로젝트 공유 타이밍이 늦어 협업 리스크가 생긴 장면이 있었습니다. 다음 분기에는 주간 공유 기준과 체크포인트를 먼저 합의해 보길 권합니다.',
    takeaway: '보완점과 함께 다음 행동을 제안하면 코칭 품질이 높아집니다.',
  },
  {
    id: 'bias',
    title: '편향을 줄이는 표현',
    bad: '원래 꼼꼼하지 않은 편입니다.',
    good: '최근 두 건의 산출물에서 검토 누락이 반복되었습니다. 체크리스트 적용 여부를 다음 체크인에서 확인할 필요가 있습니다.',
    takeaway: '성향 단정 대신 관찰된 사례와 후속 조치를 쓰는 것이 안전합니다.',
  },
]

export function buildEvaluationQualityWarnings(params: {
  comment: string
  evidence: EvaluationAssistEvidenceView
  mode?: EvaluationAssistMode
}) {
  const warnings: EvaluationQualityWarning[] = []
  const comment = params.comment.trim()
  const normalized = comment.replace(/\s+/g, ' ')

  const pushWarning = (warning: EvaluationQualityWarning) => {
    if (!warnings.some((item) => item.key === warning.key)) {
      warnings.push(warning)
    }
  }

  if (comment.length > 0 && comment.length < 80) {
    pushWarning({
      key: 'short-comment',
      title: '코멘트가 짧습니다',
      message: '현재 문장만으로는 평가 근거와 맥락이 충분히 드러나지 않을 수 있습니다. 사례나 근거를 더 보강해 주세요.',
    })
  }

  if (comment.length > 0 && GENERIC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    pushWarning({
      key: 'generic-comment',
      title: '일반론적 표현이 보입니다',
      message: '전반적으로, 무난함, 잘함 같은 표현만으로는 평가 근거가 약해질 수 있습니다. KPI나 실제 사례를 함께 적어 주세요.',
    })
  }

  if (EMOTIONAL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    pushWarning({
      key: 'emotional-tone',
      title: '감정적 표현을 점검해 주세요',
      message: '실망, 답답함처럼 감정이 먼저 드러나는 문장은 수용성을 낮출 수 있습니다. 관찰된 사실 중심으로 바꿔 보세요.',
    })
  }

  if (BIAS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    pushWarning({
      key: 'bias-risk',
      title: '편향 가능성이 있는 표현이 있습니다',
      message: '항상, 절대, 원래 같은 단정 표현은 최근성·후광효과와 결합될 수 있습니다. 실제 사례와 기간을 함께 확인하세요.',
    })
  }

  if (
    params.evidence.sufficiency === 'weak' ||
    params.evidence.warnings.some((item) => item.includes('근거') || item.includes('추가') || item.includes('보강'))
  ) {
    pushWarning({
      key: 'missing-evidence',
      title: '근거가 부족합니다',
      message: '현재 확인 가능한 KPI, 월간 실적, 피드백 근거가 충분하지 않습니다. 추가 자료를 확인한 뒤 최종 코멘트를 다듬어 주세요.',
    })
  }

  if (comment.length > 0 && !EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    pushWarning({
      key: 'missing-evidence',
      title: '근거 연결을 보강해 주세요',
      message: '코멘트 안에 KPI, 실적, 체크인, 피드백 같은 근거 단서가 거의 보이지 않습니다. 무엇을 보고 판단했는지 적어 주세요.',
    })
  }

  if (comment.length > 0 && params.mode !== 'bias' && !ACTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    pushWarning({
      key: 'missing-action',
      title: '다음 행동 제안이 약합니다',
      message: '보완 또는 성장을 위한 다음 행동이 드러나지 않습니다. 다음 체크인이나 1:1에서 다룰 행동을 한 문장이라도 남겨 주세요.',
    })
  }

  return warnings
}
