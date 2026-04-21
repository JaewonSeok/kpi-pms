import assert from 'node:assert/strict'
import {
  buildExecutivePerformanceBriefingPrompt,
  EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT,
  EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT,
  ExecutivePerformanceBriefingSchema,
  getExecutivePerformanceAlignmentLabel,
} from '../src/lib/ai/executive-performance-briefing-prompt'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

run('system prompt forbids final grading and enforces JSON-only evidence-based output', () => {
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT.includes('S/A/B/C'), true)
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT.includes('최종 등급'), true)
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT.includes('출력은 반드시 지정된 JSON 형식만 반환하세요.'), true)
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_SYSTEM_PROMPT.includes('오직 제공된 입력 데이터만 사용해야 합니다.'), true)
})

run('prompt builder renders required sections deterministically without undefined garbage', () => {
  const prompt = buildExecutivePerformanceBriefingPrompt({
    employeeId: 'emp-1',
    employeeName: '석재원',
    departmentName: '인사팀',
    position: '팀장',
    evaluationYear: 2026,
    reviewPeriodStart: '2025-01-01',
    reviewPeriodEnd: '2025-12-31',
    managerRatingLabel: null,
    managerScore: 87.5,
    managerComment: '핵심 KPI를 안정적으로 수행했으나 협업 근거는 추가 확인이 필요합니다.',
    managerStrengthKeywords: ['핵심 KPI', '지속성'],
    managerRiskKeywords: [],
    weightedKpiSummary: ['채용 리드타임 단축: 가중치 35% · 최근 달성률 96%'],
    highWeightKpis: ['채용 리드타임 단축'],
    kpiAchievementTrend: ['채용 리드타임 단축: 최근 달성률 96%, 추이 유지'],
    checkinSummary: ['2025-10-01 체크인: 면접 프로세스 개선안을 공유함'],
    monthlyPerformanceSummary: ['2025-10 채용 리드타임 단축: 채용 파이프라인 자동화 적용'],
    projectSummary: [],
    collaborationSummary: ['다면 피드백: 타 부서와의 조율 속도가 좋다는 의견이 다수 확인됨'],
    orgContributionSummary: ['채용 리드타임 단축 → 인사팀 핵심 운영 목표'],
    peerFeedbackSummary: ['2025 하반기 피드백: 응답 6건 · 평균 4.3'],
    riskEvents: ['협업 성과를 직접 입증하는 프로젝트 자료는 제한적입니다.'],
    missingEvidenceAreas: ['조직 기여를 뒷받침하는 산출물 링크가 부족합니다.'],
    evidenceItems: [
      {
        id: 'kpi:k1',
        sourceType: 'KPI',
        title: '채용 리드타임 단축',
        summary: '최근 달성률 96%를 기록했습니다.',
      },
    ],
  })

  for (const section of ['[평가 대상 기본 정보]', '[팀장 평가 정보]', '[성과 요약 데이터]', '[원천 근거 목록]', '[작성 지시]']) {
    assert.equal(prompt.includes(section), true)
  }
  assert.equal(prompt.includes('undefined'), false)
  assert.equal(prompt.includes('managerRatingLabel: (없음)'), true)
  assert.equal(prompt.includes('"id": "kpi:k1"'), true)
})

run('alignment label mapping remains exact for all supported statuses', () => {
  assert.equal(getExecutivePerformanceAlignmentLabel('MATCHED'), '정합')
  assert.equal(getExecutivePerformanceAlignmentLabel('MOSTLY_MATCHED'), '대체로 정합')
  assert.equal(getExecutivePerformanceAlignmentLabel('REVIEW_NEEDED'), '추가 확인 필요')
  assert.equal(getExecutivePerformanceAlignmentLabel('POSSIBLE_OVER_RATING'), '과대평가 가능성')
  assert.equal(getExecutivePerformanceAlignmentLabel('POSSIBLE_UNDER_RATING'), '과소평가 가능성')
  assert.equal(getExecutivePerformanceAlignmentLabel('INSUFFICIENT_EVIDENCE'), '근거 부족')
})

run('structured schema validates evidence refs as string arrays and rejects extra fields', () => {
  const valid = ExecutivePerformanceBriefingSchema.safeParse({
    headline: '지난 12개월 동안 핵심 KPI 달성은 강점이지만 협업 근거는 일부 보완이 필요합니다.',
    confidence: { level: 'MEDIUM', reason: 'KPI와 월간 실적은 충분하지만 협업 근거는 제한적입니다.' },
    performanceSummary: {
      kpiAchievement: { summary: '핵심 KPI 달성률이 높습니다.', evidenceRefs: ['kpi:k1'] },
      continuity: { summary: '월간 실적 기록이 지속적으로 누적되었습니다.', evidenceRefs: ['monthly:m1'] },
      collaboration: { summary: '체크인과 피드백에서 협업 기여가 확인됩니다.', evidenceRefs: ['checkin:c1'] },
      organizationContribution: { summary: '조직 KPI와의 연결이 명확합니다.', evidenceRefs: ['kpi:k1'] },
    },
    strengths: [{ title: '핵심 KPI 달성', detail: '최근 12개월 동안 목표 달성률을 안정적으로 유지했습니다.', evidenceRefs: ['kpi:k1'] }],
    contributionSummary: [{ title: '조직 기여', detail: '조직 KPI와 연결된 성과가 확인됩니다.', evidenceRefs: ['kpi:k1'] }],
    risks: [
      {
        title: '협업 근거 보완 필요',
        detail: '협업 산출물과 프로젝트 결과 연결 근거는 더 확인이 필요합니다.',
        severity: 'MEDIUM',
        evidenceRefs: ['checkin:c1'],
      },
    ],
    alignment: {
      status: 'REVIEW_NEEDED',
      labelKo: '추가 확인 필요',
      reason: '팀장 코멘트 일부는 근거와 연결되지만 협업 관련 근거는 보완이 필요합니다.',
      matchedPoints: [{ title: 'KPI 달성', detail: '팀장 코멘트와 KPI 달성률이 부합합니다.', evidenceRefs: ['kpi:k1'] }],
      mismatchPoints: [{ title: '협업 근거', detail: '협업 관련 정량 근거는 제한적입니다.', evidenceRefs: ['checkin:c1'] }],
    },
    followUpQuestions: [
      {
        question: '협업 기여를 입증하는 대표 산출물은 무엇입니까?',
        reason: '협업 관련 근거가 제한적입니다.',
        priority: 'HIGH',
        evidenceRefs: ['checkin:c1'],
      },
      {
        question: '조직 KPI와 연결된 실제 파급 효과를 어떤 자료로 확인할 수 있습니까?',
        reason: '조직 기여의 확산 범위를 더 명확히 볼 필요가 있습니다.',
        priority: 'MEDIUM',
        evidenceRefs: ['kpi:k1'],
      },
    ],
    evidenceDigest: [
      {
        id: 'kpi:k1',
        sourceType: 'KPI',
        title: '채용 리드타임 단축',
        summary: '최근 달성률 96%를 기록했습니다.',
      },
    ],
  })

  assert.equal(valid.success, true)
  if (!valid.success) {
    throw new Error('Expected the executive performance briefing schema sample to validate.')
  }
  assert.deepEqual(valid.data.strengths[0]?.evidenceRefs, ['kpi:k1'])

  const invalid = ExecutivePerformanceBriefingSchema.safeParse({
    ...valid.data,
    extraField: true,
  })
  assert.equal(invalid.success, false)
})

run('response format stays strict and named for structured output calls', () => {
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT.type, 'json_schema')
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT.name, 'executive_performance_briefing')
  assert.equal(EXECUTIVE_PERFORMANCE_BRIEFING_RESPONSE_FORMAT.strict, true)
})

run('missing evidence inputs still produce a valid prompt without score recommendation wording', () => {
  const prompt = buildExecutivePerformanceBriefingPrompt({
    employeeId: 'emp-2',
    employeeName: '홍길동',
    departmentName: '경영지원본부',
    position: '매니저',
    evaluationYear: '2026',
    reviewPeriodStart: '2025-01-01',
    reviewPeriodEnd: '2025-12-31',
    managerRatingLabel: null,
    managerScore: null,
    managerComment: null,
    managerStrengthKeywords: [],
    managerRiskKeywords: [],
    weightedKpiSummary: [],
    highWeightKpis: [],
    kpiAchievementTrend: [],
    checkinSummary: [],
    monthlyPerformanceSummary: [],
    projectSummary: [],
    collaborationSummary: [],
    orgContributionSummary: [],
    peerFeedbackSummary: [],
    riskEvents: [],
    missingEvidenceAreas: ['최근 12개월 월간 실적 기록이 부족합니다.'],
    evidenceItems: [],
  })

  assert.equal(prompt.includes('missingEvidenceAreas: ['), true)
  assert.equal(prompt.includes('최종 등급, 점수 상향/하향 제안, 보상 제안은 절대 포함하지 마세요.'), true)
  assert.equal(prompt.includes('S/A/B/C'), false)
})

console.log('Executive performance briefing prompt tests completed')
