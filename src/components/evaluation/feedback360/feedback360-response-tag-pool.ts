export type Feedback360ResponseTagTone = 'positive' | 'improvement'

export type Feedback360ResponseTag = {
  id: string
  label: string
  tone: Feedback360ResponseTagTone
}

export type Feedback360ResponseTagCategory = {
  id: string
  category: string
  description: string
  audience?: 'all' | 'leader'
  positiveTags: Feedback360ResponseTag[]
  improvementTags: Feedback360ResponseTag[]
}

export type SelectedFeedback360ResponseTags = Record<string, Record<Feedback360ResponseTagTone, string[]>>

export type SelectedFeedback360ResponseTagSummaryItem = Feedback360ResponseTag & {
  category: string
}

export const FEEDBACK_360_TAG_SUMMARY_HEADING = '[선택 태그 요약]'
export const FEEDBACK_360_OVERALL_COMMENT_MAX_LENGTH = 1000

function positive(id: string, label: string): Feedback360ResponseTag {
  return { id, label, tone: 'positive' }
}

function improvement(id: string, label: string): Feedback360ResponseTag {
  return { id, label, tone: 'improvement' }
}

export const FEEDBACK_360_RESPONSE_TAG_CATEGORIES: Feedback360ResponseTagCategory[] = [
  {
    id: 'teamwork',
    category: '팀워크',
    description: '공동 목표를 위해 함께 움직이는 방식이에요.',
    positiveTags: [
      positive('teamwork-positive-01', '공동 목표에 함께 기여해요'),
      positive('teamwork-positive-02', '팀 업무에 자발적으로 참여해요'),
      positive('teamwork-positive-03', '협업 요청에 빠르게 응답해요'),
      positive('teamwork-positive-04', '역할 분담을 명확히 해요'),
      positive('teamwork-positive-05', '동료가 막힐 때 먼저 도와줘요'),
      positive('teamwork-positive-06', '필요한 업무 정보를 잘 공유해요'),
      positive('teamwork-positive-07', '문제를 함께 해결하려고 해요'),
      positive('teamwork-positive-08', '팀 성과를 우선으로 생각해요'),
      positive('teamwork-positive-09', '협업 분위기를 안정적으로 만들어요'),
      positive('teamwork-positive-10', '업무 공백이 생기면 자연스럽게 지원해요'),
    ],
    improvementTags: [
      improvement('teamwork-improvement-01', '업무 공유가 조금 더 필요해요'),
      improvement('teamwork-improvement-02', '협업 요청 응답이 늦어질 때가 있어요'),
      improvement('teamwork-improvement-03', '팀 업무 참여가 더 적극적이면 좋아요'),
      improvement('teamwork-improvement-04', '개인 업무와 공동 업무의 균형이 필요해요'),
      improvement('teamwork-improvement-05', '역할 분담을 더 명확히 하면 좋아요'),
      improvement('teamwork-improvement-06', '도움 요청을 더 편하게 해도 좋아요'),
      improvement('teamwork-improvement-07', '협업 흐름이 끊기지 않게 공유가 필요해요'),
      improvement('teamwork-improvement-08', '공동 책임 의식을 더 보여주면 좋아요'),
      improvement('teamwork-improvement-09', '팀 목표를 더 자주 맞춰보면 좋아요'),
      improvement('teamwork-improvement-10', '업무 인수인계를 더 꼼꼼히 하면 좋아요'),
    ],
  },
  {
    id: 'communication',
    category: '소통',
    description: '필요한 맥락을 서로 이해할 수 있게 전달하는 방식이에요.',
    positiveTags: [
      positive('communication-positive-01', '의견을 명확하게 전달해요'),
      positive('communication-positive-02', '상대 의견을 차분히 경청해요'),
      positive('communication-positive-03', '피드백을 수용하고 반영해요'),
      positive('communication-positive-04', '필요한 정보를 제때 공유해요'),
      positive('communication-positive-05', '질문이 구체적이고 명확해요'),
      positive('communication-positive-06', '업무 맥락을 충분히 설명해요'),
      positive('communication-positive-07', '회의 내용을 잘 정리해요'),
      positive('communication-positive-08', '의사결정 내용을 투명하게 공유해요'),
      positive('communication-positive-09', '오해가 생기지 않게 확인해요'),
      positive('communication-positive-10', '정중한 표현으로 소통해요'),
    ],
    improvementTags: [
      improvement('communication-improvement-01', '필요한 정보 공유가 더 빨라지면 좋아요'),
      improvement('communication-improvement-02', '의견 전달을 조금 더 명확히 하면 좋아요'),
      improvement('communication-improvement-03', '피드백 반영 과정을 더 보여주면 좋아요'),
      improvement('communication-improvement-04', '회의 후속 정리가 더 필요해요'),
      improvement('communication-improvement-05', '상황 공유가 빠지지 않게 해요'),
      improvement('communication-improvement-06', '일방적 전달보다 상호 확인이 필요해요'),
      improvement('communication-improvement-07', '질문 의도를 더 분명히 하면 좋아요'),
      improvement('communication-improvement-08', '업무 맥락 설명을 보강하면 좋아요'),
      improvement('communication-improvement-09', '응답 속도를 조금 더 높이면 좋아요'),
      improvement('communication-improvement-10', '문서화가 조금 더 필요해요'),
    ],
  },
  {
    id: 'ownership',
    category: '책임감',
    description: '맡은 일을 끝까지 확인하고 결과를 책임지는 태도예요.',
    positiveTags: [
      positive('ownership-positive-01', '맡은 일을 끝까지 완수해요'),
      positive('ownership-positive-02', '일정을 지키기 위해 꾸준히 관리해요'),
      positive('ownership-positive-03', '문제가 생기면 해결하려고 움직여요'),
      positive('ownership-positive-04', '맡은 역할을 성실히 수행해요'),
      positive('ownership-positive-05', '결과에 대한 책임감을 보여줘요'),
      positive('ownership-positive-06', '진행 상황을 꾸준히 공유해요'),
      positive('ownership-positive-07', '리스크를 사전에 알려줘요'),
      positive('ownership-positive-08', '업무 품질을 스스로 점검해요'),
      positive('ownership-positive-09', '약속한 후속 조치를 마무리해요'),
      positive('ownership-positive-10', '누락이 없는지 꼼꼼히 확인해요'),
    ],
    improvementTags: [
      improvement('ownership-improvement-01', '완수 책임을 더 분명히 보여주면 좋아요'),
      improvement('ownership-improvement-02', '일정 지연을 더 빨리 공유하면 좋아요'),
      improvement('ownership-improvement-03', '문제 대응이 조금 더 빨라지면 좋아요'),
      improvement('ownership-improvement-04', '후속 조치를 빠뜨리지 않으면 좋아요'),
      improvement('ownership-improvement-05', '리스크 공유가 더 일찍 필요해요'),
      improvement('ownership-improvement-06', '진행 상황을 더 투명하게 알려주면 좋아요'),
      improvement('ownership-improvement-07', '마감 관리를 더 안정적으로 하면 좋아요'),
      improvement('ownership-improvement-08', '품질 점검을 조금 더 꼼꼼히 하면 좋아요'),
      improvement('ownership-improvement-09', '반복되는 누락을 줄이면 좋아요'),
      improvement('ownership-improvement-10', '책임 범위를 더 명확히 하면 좋아요'),
    ],
  },
  {
    id: 'respect',
    category: '존중',
    description: '서로의 의견과 상황을 배려하며 일하는 태도예요.',
    positiveTags: [
      positive('respect-positive-01', '다른 의견을 존중해요'),
      positive('respect-positive-02', '상대의 말을 끝까지 경청해요'),
      positive('respect-positive-03', '배려 있는 표현을 사용해요'),
      positive('respect-positive-04', '회의에서 발언 기회를 존중해요'),
      positive('respect-positive-05', '갈등 상황에서도 차분하게 대화해요'),
      positive('respect-positive-06', '심리적으로 안전한 분위기를 만들어요'),
      positive('respect-positive-07', '공정한 태도로 협업해요'),
      positive('respect-positive-08', '상대의 상황을 고려해요'),
      positive('respect-positive-09', '비난보다 해결을 먼저 생각해요'),
      positive('respect-positive-10', '동료의 기여를 인정해요'),
    ],
    improvementTags: [
      improvement('respect-improvement-01', '다른 의견을 더 들어보면 좋아요'),
      improvement('respect-improvement-02', '발언을 끊지 않고 기다리면 좋아요'),
      improvement('respect-improvement-03', '표현을 조금 더 부드럽게 하면 좋아요'),
      improvement('respect-improvement-04', '상대 상황을 더 고려하면 좋아요'),
      improvement('respect-improvement-05', '회의 태도를 더 안정적으로 유지하면 좋아요'),
      improvement('respect-improvement-06', '비난보다 해결 중심으로 말하면 좋아요'),
      improvement('respect-improvement-07', '다른 의견을 배척하지 않으면 좋아요'),
      improvement('respect-improvement-08', '피드백 표현을 더 정중하게 하면 좋아요'),
      improvement('respect-improvement-09', '불필요한 압박을 줄이면 좋아요'),
      improvement('respect-improvement-10', '질문을 더 편하게 받을 수 있으면 좋아요'),
    ],
  },
  {
    id: 'positive-attitude',
    category: '긍정적 태도',
    description: '어려운 상황에서도 해결 방향을 찾으려는 태도예요.',
    positiveTags: [
      positive('positive-attitude-positive-01', '해결 방안을 함께 제시해요'),
      positive('positive-attitude-positive-02', '어려운 상황에도 차분하게 대응해요'),
      positive('positive-attitude-positive-03', '협업 분위기를 안정적으로 유지해요'),
      positive('positive-attitude-positive-04', '업무에 적극적으로 참여해요'),
      positive('positive-attitude-positive-05', '변화를 받아들이고 시도해요'),
      positive('positive-attitude-positive-06', '개선 기회를 잘 찾아요'),
      positive('positive-attitude-positive-07', '동료를 격려해요'),
      positive('positive-attitude-positive-08', '건설적인 의견을 내요'),
      positive('positive-attitude-positive-09', '팀 사기에 긍정적으로 기여해요'),
      positive('positive-attitude-positive-10', '갈등을 완화하려고 해요'),
    ],
    improvementTags: [
      improvement('positive-attitude-improvement-01', '감정적 대응을 줄이면 좋아요'),
      improvement('positive-attitude-improvement-02', '참여가 조금 더 적극적이면 좋아요'),
      improvement('positive-attitude-improvement-03', '불만보다 해결안을 함께 내면 좋아요'),
      improvement('positive-attitude-improvement-04', '문제 회피를 줄이면 좋아요'),
      improvement('positive-attitude-improvement-05', '변화에 조금 더 열려 있으면 좋아요'),
      improvement('positive-attitude-improvement-06', '개선 의지를 더 보여주면 좋아요'),
      improvement('positive-attitude-improvement-07', '팀 분위기에 미치는 영향을 살피면 좋아요'),
      improvement('positive-attitude-improvement-08', '비판과 제안의 균형이 필요해요'),
      improvement('positive-attitude-improvement-09', '방어적 태도를 줄이면 좋아요'),
      improvement('positive-attitude-improvement-10', '문제 제기 후 다음 행동까지 이어가면 좋아요'),
    ],
  },
  {
    id: 'problem-solving',
    category: '문제해결',
    description: '문제를 구조화하고 실행 가능한 대안을 찾는 방식이에요.',
    positiveTags: [
      positive('problem-solving-positive-01', '문제 원인을 차분히 분석해요'),
      positive('problem-solving-positive-02', '현실적인 대안을 제시해요'),
      positive('problem-solving-positive-03', '이슈를 빠르게 정리해요'),
      positive('problem-solving-positive-04', '데이터를 보고 판단해요'),
      positive('problem-solving-positive-05', '재발 방지까지 고민해요'),
      positive('problem-solving-positive-06', '우선순위를 잘 판단해요'),
      positive('problem-solving-positive-07', '해결책을 실행까지 연결해요'),
      positive('problem-solving-positive-08', '복잡한 문제를 쉽게 구조화해요'),
      positive('problem-solving-positive-09', '리스크를 관리하려고 해요'),
      positive('problem-solving-positive-10', '해결 결과를 끝까지 추적해요'),
    ],
    improvementTags: [
      improvement('problem-solving-improvement-01', '문제 정의를 더 명확히 하면 좋아요'),
      improvement('problem-solving-improvement-02', '원인 분석을 조금 더 보강하면 좋아요'),
      improvement('problem-solving-improvement-03', '대안 선택지를 더 넓히면 좋아요'),
      improvement('problem-solving-improvement-04', '문제 공유가 더 빨라지면 좋아요'),
      improvement('problem-solving-improvement-05', '해결 실행까지 이어가면 좋아요'),
      improvement('problem-solving-improvement-06', '임시방편보다 재발 방지가 필요해요'),
      improvement('problem-solving-improvement-07', '데이터 확인을 더 해보면 좋아요'),
      improvement('problem-solving-improvement-08', '우선순위 혼선을 줄이면 좋아요'),
      improvement('problem-solving-improvement-09', '리스크를 방치하지 않으면 좋아요'),
      improvement('problem-solving-improvement-10', '해결 과정을 더 추적하면 좋아요'),
    ],
  },
  {
    id: 'execution',
    category: '실행력',
    description: '계획을 실제 결과로 옮기는 속도와 안정성이에요.',
    positiveTags: [
      positive('execution-positive-01', '결정 후 빠르게 실행해요'),
      positive('execution-positive-02', '일정을 안정적으로 관리해요'),
      positive('execution-positive-03', '우선순위에 맞게 움직여요'),
      positive('execution-positive-04', '마감을 잘 지켜요'),
      positive('execution-positive-05', '실행 계획이 명확해요'),
      positive('execution-positive-06', '결과를 끝까지 만들어내요'),
      positive('execution-positive-07', '진척 상황을 잘 관리해요'),
      positive('execution-positive-08', '업무 속도가 안정적이에요'),
      positive('execution-positive-09', '장애가 생기면 대안을 실행해요'),
      positive('execution-positive-10', '후속 실행을 꼼꼼히 챙겨요'),
    ],
    improvementTags: [
      improvement('execution-improvement-01', '실행 속도를 조금 높이면 좋아요'),
      improvement('execution-improvement-02', '마감 관리를 더 안정적으로 하면 좋아요'),
      improvement('execution-improvement-03', '우선순위대로 실행하면 좋아요'),
      improvement('execution-improvement-04', '계획을 실행으로 더 빨리 옮기면 좋아요'),
      improvement('execution-improvement-05', '진척 공유가 더 자주 필요해요'),
      improvement('execution-improvement-06', '결과 도출까지 더 밀고 가면 좋아요'),
      improvement('execution-improvement-07', '완료 기준을 더 명확히 하면 좋아요'),
      improvement('execution-improvement-08', '중간 점검을 더 챙기면 좋아요'),
      improvement('execution-improvement-09', '후속 실행 누락을 줄이면 좋아요'),
      improvement('execution-improvement-10', '작업 정리를 더 해두면 좋아요'),
    ],
  },
  {
    id: 'initiative',
    category: '주도성',
    description: '필요한 일을 먼저 발견하고 움직이는 태도예요.',
    positiveTags: [
      positive('initiative-positive-01', '필요한 일을 먼저 제안해요'),
      positive('initiative-positive-02', '자발적으로 개선을 시도해요'),
      positive('initiative-positive-03', '업무에 주도적으로 참여해요'),
      positive('initiative-positive-04', '필요한 업무를 먼저 발견해요'),
      positive('initiative-positive-05', '새로운 시도를 두려워하지 않아요'),
      positive('initiative-positive-06', '업무 개선 아이디어를 내요'),
      positive('initiative-positive-07', '리스크를 먼저 살펴요'),
      positive('initiative-positive-08', '성과 기회를 찾아요'),
      positive('initiative-positive-09', '스스로 학습하고 적용해요'),
      positive('initiative-positive-10', '운영 효율화를 제안해요'),
    ],
    improvementTags: [
      improvement('initiative-improvement-01', '지시를 기다리기보다 먼저 움직이면 좋아요'),
      improvement('initiative-improvement-02', '개선 제안이 조금 더 있으면 좋아요'),
      improvement('initiative-improvement-03', '문제 발견에 더 적극적이면 좋아요'),
      improvement('initiative-improvement-04', '새로운 시도를 조금 더 해보면 좋아요'),
      improvement('initiative-improvement-05', '학습 의지를 더 보여주면 좋아요'),
      improvement('initiative-improvement-06', '리스크 대응을 더 선제적으로 하면 좋아요'),
      improvement('initiative-improvement-07', '참여 태도가 더 주도적이면 좋아요'),
      improvement('initiative-improvement-08', '기회 발굴에 더 관심을 가지면 좋아요'),
      improvement('initiative-improvement-09', '책임 범위를 너무 좁히지 않으면 좋아요'),
      improvement('initiative-improvement-10', '변화에 조금 더 앞장서면 좋아요'),
    ],
  },
  {
    id: 'feedback',
    category: '피드백 수용',
    description: '피드백을 성장 행동으로 연결하는 방식이에요.',
    positiveTags: [
      positive('feedback-positive-01', '피드백을 차분히 경청해요'),
      positive('feedback-positive-02', '피드백을 실제 행동에 반영해요'),
      positive('feedback-positive-03', '개선 속도가 빨라요'),
      positive('feedback-positive-04', '방어적이지 않게 받아들여요'),
      positive('feedback-positive-05', '질문으로 정확히 확인해요'),
      positive('feedback-positive-06', '개선 결과를 공유해요'),
      positive('feedback-positive-07', '성장하려는 태도가 보여요'),
      positive('feedback-positive-08', '수정 요청을 잘 수용해요'),
      positive('feedback-positive-09', '반복적으로 개선해요'),
      positive('feedback-positive-10', '필요할 때 먼저 피드백을 요청해요'),
    ],
    improvementTags: [
      improvement('feedback-improvement-01', '피드백을 덜 방어적으로 받아들이면 좋아요'),
      improvement('feedback-improvement-02', '받은 피드백을 더 반영하면 좋아요'),
      improvement('feedback-improvement-03', '같은 문제가 반복되지 않게 해요'),
      improvement('feedback-improvement-04', '수정 요청 대응이 더 빨라지면 좋아요'),
      improvement('feedback-improvement-05', '오류를 인정하고 바로잡으면 좋아요'),
      improvement('feedback-improvement-06', '피드백을 회피하지 않으면 좋아요'),
      improvement('feedback-improvement-07', '개선 계획을 더 구체화하면 좋아요'),
      improvement('feedback-improvement-08', '코칭을 더 적극적으로 받아들이면 좋아요'),
      improvement('feedback-improvement-09', '행동 변화가 더 잘 보이면 좋아요'),
      improvement('feedback-improvement-10', '피드백 요청을 더 편하게 해도 좋아요'),
    ],
  },
  {
    id: 'conflict-management',
    category: '갈등관리',
    description: '의견 차이를 협업 가능한 상태로 조율하는 방식이에요.',
    positiveTags: [
      positive('conflict-management-positive-01', '갈등을 완화하려고 해요'),
      positive('conflict-management-positive-02', '중립적으로 조율해요'),
      positive('conflict-management-positive-03', '사실 중심으로 대화해요'),
      positive('conflict-management-positive-04', '감정을 잘 조절해요'),
      positive('conflict-management-positive-05', '공통 목표를 다시 확인해요'),
      positive('conflict-management-positive-06', '합의점을 찾으려고 해요'),
      positive('conflict-management-positive-07', '갈등 초기에 대응해요'),
      positive('conflict-management-positive-08', '상대 입장을 이해하려고 해요'),
      positive('conflict-management-positive-09', '오해를 풀기 위해 확인해요'),
      positive('conflict-management-positive-10', '대안 중심으로 협의해요'),
    ],
    improvementTags: [
      improvement('conflict-management-improvement-01', '갈등을 피하기보다 조율하면 좋아요'),
      improvement('conflict-management-improvement-02', '감정적 대응을 줄이면 좋아요'),
      improvement('conflict-management-improvement-03', '갈등이 커지기 전에 공유하면 좋아요'),
      improvement('conflict-management-improvement-04', '일방적 주장보다 합의가 필요해요'),
      improvement('conflict-management-improvement-05', '상대 입장을 더 이해하면 좋아요'),
      improvement('conflict-management-improvement-06', '합의점을 더 적극적으로 찾으면 좋아요'),
      improvement('conflict-management-improvement-07', '오해를 오래 두지 않으면 좋아요'),
      improvement('conflict-management-improvement-08', '중재 시도가 조금 더 필요해요'),
      improvement('conflict-management-improvement-09', '사람보다 문제에 집중하면 좋아요'),
      improvement('conflict-management-improvement-10', '갈등 후 관계 회복을 챙기면 좋아요'),
    ],
  },
  {
    id: 'leadership-coaching',
    category: '리더십/코칭',
    description: '리더나 PM 역할에서 방향 제시와 성장 지원을 보는 항목이에요.',
    audience: 'leader',
    positiveTags: [
      positive('leadership-coaching-positive-01', '방향을 명확히 제시해요'),
      positive('leadership-coaching-positive-02', '구성원을 잘 코칭해요'),
      positive('leadership-coaching-positive-03', '권한을 적절히 위임해요'),
      positive('leadership-coaching-positive-04', '구성원 성장을 지원해요'),
      positive('leadership-coaching-positive-05', '성과 피드백을 구체적으로 해요'),
      positive('leadership-coaching-positive-06', '팀 목표를 잘 정렬해요'),
      positive('leadership-coaching-positive-07', '공정하게 의사결정해요'),
      positive('leadership-coaching-positive-08', '갈등을 차분히 중재해요'),
      positive('leadership-coaching-positive-09', '심리적 안전감을 조성해요'),
      positive('leadership-coaching-positive-10', '협업 장벽을 줄여줘요'),
    ],
    improvementTags: [
      improvement('leadership-coaching-improvement-01', '방향 제시가 더 명확하면 좋아요'),
      improvement('leadership-coaching-improvement-02', '피드백 빈도가 더 늘어나면 좋아요'),
      improvement('leadership-coaching-improvement-03', '코칭이 조금 더 필요해요'),
      improvement('leadership-coaching-improvement-04', '권한 위임이 더 있으면 좋아요'),
      improvement('leadership-coaching-improvement-05', '의사결정을 더 빠르게 하면 좋아요'),
      improvement('leadership-coaching-improvement-06', '우선순위를 더 분명히 해주면 좋아요'),
      improvement('leadership-coaching-improvement-07', '성과 인정을 더 자주 해주면 좋아요'),
      improvement('leadership-coaching-improvement-08', '구성원 성장 지원이 더 보이면 좋아요'),
      improvement('leadership-coaching-improvement-09', '갈등 중재가 더 적극적이면 좋아요'),
      improvement('leadership-coaching-improvement-10', '업무 맥락 설명이 더 있으면 좋아요'),
    ],
  },
]

export function getFeedback360ResponseTagPoolStats(categories = FEEDBACK_360_RESPONSE_TAG_CATEGORIES) {
  return categories.reduce(
    (summary, category) => ({
      categoryCount: summary.categoryCount + 1,
      positiveTagCount: summary.positiveTagCount + category.positiveTags.length,
      improvementTagCount: summary.improvementTagCount + category.improvementTags.length,
    }),
    { categoryCount: 0, positiveTagCount: 0, improvementTagCount: 0 }
  )
}

export function isFeedback360ResponseTagSelected(
  selectedTags: SelectedFeedback360ResponseTags,
  categoryId: string,
  tone: Feedback360ResponseTagTone,
  tagId: string
) {
  return selectedTags[categoryId]?.[tone]?.includes(tagId) ?? false
}

export function getSelectedFeedback360ResponseTagLabels(
  selectedTags: SelectedFeedback360ResponseTags,
  categories: Feedback360ResponseTagCategory[] = FEEDBACK_360_RESPONSE_TAG_CATEGORIES
): SelectedFeedback360ResponseTagSummaryItem[] {
  return categories.flatMap((category) => {
    const selectedPositiveIds = new Set(selectedTags[category.id]?.positive ?? [])
    const selectedImprovementIds = new Set(selectedTags[category.id]?.improvement ?? [])

    return [
      ...category.positiveTags
        .filter((tag) => selectedPositiveIds.has(tag.id))
        .map((tag) => ({ ...tag, category: category.category })),
      ...category.improvementTags
        .filter((tag) => selectedImprovementIds.has(tag.id))
        .map((tag) => ({ ...tag, category: category.category })),
    ]
  })
}

export function buildFeedback360ResponseTagsFromLabels(
  labels: string[],
  categories: Feedback360ResponseTagCategory[] = FEEDBACK_360_RESPONSE_TAG_CATEGORIES
): SelectedFeedback360ResponseTags {
  const labelSet = new Set(labels.map((label) => label.trim()).filter(Boolean))
  const selectedTags: SelectedFeedback360ResponseTags = {}

  for (const category of categories) {
    const positiveTags = category.positiveTags.filter((tag) => labelSet.has(tag.label)).map((tag) => tag.id)
    const improvementTags = category.improvementTags.filter((tag) => labelSet.has(tag.label)).map((tag) => tag.id)

    if (positiveTags.length || improvementTags.length) {
      selectedTags[category.id] = {
        positive: positiveTags,
        improvement: improvementTags,
      }
    }
  }

  return selectedTags
}

export function buildFeedback360TagSummaryText(tags: SelectedFeedback360ResponseTagSummaryItem[]) {
  if (!tags.length) return ''

  const positiveLabels = tags.filter((tag) => tag.tone === 'positive').map((tag) => tag.label)
  const improvementLabels = tags.filter((tag) => tag.tone === 'improvement').map((tag) => tag.label)

  return [
    FEEDBACK_360_TAG_SUMMARY_HEADING,
    positiveLabels.length ? `긍정: ${positiveLabels.join(', ')}` : '',
    improvementLabels.length ? `보완: ${improvementLabels.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function splitFeedback360TagLabels(line: string) {
  return line
    .replace(/^(긍정|보완)\s*:\s*/, '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
}

export function parseFeedback360TagSummaryFromComment(comment?: string | null) {
  const rawComment = comment ?? ''
  const lines = rawComment.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => line.trim() === FEEDBACK_360_TAG_SUMMARY_HEADING)

  if (headingIndex < 0) {
    return {
      comment: rawComment,
      selectedTags: {} as SelectedFeedback360ResponseTags,
    }
  }

  let summaryEndIndex = headingIndex + 1
  while (summaryEndIndex < lines.length && lines[summaryEndIndex].trim().length > 0) {
    summaryEndIndex += 1
  }

  const summaryLabels = lines
    .slice(headingIndex + 1, summaryEndIndex)
    .flatMap(splitFeedback360TagLabels)
  const beforeSummary = lines.slice(0, headingIndex).join('\n').trim()
  const afterSummary = lines.slice(summaryEndIndex + 1).join('\n').trim()

  return {
    comment: [beforeSummary, afterSummary].filter(Boolean).join('\n\n'),
    selectedTags: buildFeedback360ResponseTagsFromLabels(summaryLabels),
  }
}

export function buildFeedback360OverallCommentForSubmit(
  comment: string,
  selectedTags: SelectedFeedback360ResponseTagSummaryItem[]
) {
  const normalizedComment = parseFeedback360TagSummaryFromComment(comment).comment.trim()
  const tagSummary = buildFeedback360TagSummaryText(selectedTags)

  return [tagSummary, normalizedComment].filter(Boolean).join('\n\n')
}
