import assert from 'node:assert/strict'
import { readExecutivePerformanceBriefingEnv } from '../src/lib/ai-env'
import { requestExecutivePerformanceBriefingFromOpenAI } from '../src/server/ai/executive-performance-briefing-openai'

async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

const sampleInput = {
  employeeId: 'emp-1',
  employeeName: '석재원',
  departmentName: '인사팀',
  position: '팀장',
  evaluationYear: 2026,
  reviewPeriodStart: '2025-01-01',
  reviewPeriodEnd: '2025-12-31',
  managerRatingLabel: 'A',
  managerScore: 88.5,
  managerComment: '핵심 KPI는 안정적으로 달성했지만 협업 근거는 추가 확인이 필요합니다.',
  managerStrengthKeywords: ['핵심 KPI'],
  managerRiskKeywords: ['협업'],
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
      sourceType: 'KPI' as const,
      title: '채용 리드타임 단축',
      summary: '최근 달성률 96%를 기록했습니다.',
    },
    {
      id: 'checkin:c1',
      sourceType: 'CHECKIN' as const,
      title: '2025-10 체크인',
      summary: '협업 조율 이슈를 확인했습니다.',
    },
  ],
}

const sampleOutput = {
  headline: '지난 12개월 동안 핵심 KPI 달성은 강점이지만 협업 근거는 일부 보완이 필요합니다.',
  confidence: {
    level: 'MEDIUM',
    reason: 'KPI 달성 근거는 충분하지만 협업과 조직 확산 근거는 일부 제한적입니다.',
  },
  performanceSummary: {
    kpiAchievement: {
      summary: '핵심 KPI 달성률은 안정적으로 유지되었습니다.',
      evidenceRefs: ['kpi:k1'],
    },
    continuity: {
      summary: '월간 실적과 체크인이 연결되어 성과 흐름을 추적할 수 있습니다.',
      evidenceRefs: ['checkin:c1'],
    },
    collaboration: {
      summary: '협업 관련 정성 근거는 존재하지만 양은 제한적입니다.',
      evidenceRefs: ['checkin:c1'],
    },
    organizationContribution: {
      summary: '조직 목표와 연결된 KPI는 확인되나 확산 범위는 추가 확인이 필요합니다.',
      evidenceRefs: ['kpi:k1'],
    },
  },
  strengths: [
    {
      title: '핵심 KPI 달성',
      detail: '최근 12개월 동안 핵심 KPI 달성률을 안정적으로 유지했습니다.',
      evidenceRefs: ['kpi:k1'],
    },
  ],
  contributionSummary: [
    {
      title: '조직 기여',
      detail: '조직 KPI와 연결된 성과 흐름은 확인됩니다.',
      evidenceRefs: ['kpi:k1'],
    },
  ],
  risks: [
    {
      title: '협업 근거 보완 필요',
      detail: '협업 성과를 직접 입증하는 자료는 더 확인이 필요합니다.',
      severity: 'MEDIUM',
      evidenceRefs: ['checkin:c1'],
    },
  ],
  alignment: {
    status: 'REVIEW_NEEDED',
    labelKo: '추가 확인 필요',
    reason: '팀장 코멘트 일부는 KPI 근거와 부합하지만 협업 부분은 보완이 필요합니다.',
    matchedPoints: [
      {
        title: 'KPI 달성',
        detail: '팀장 코멘트가 KPI 달성 근거와 부합합니다.',
        evidenceRefs: ['kpi:k1'],
      },
    ],
    mismatchPoints: [
      {
        title: '협업 근거',
        detail: '협업을 직접 보여 주는 추가 근거가 제한적입니다.',
        evidenceRefs: ['checkin:c1'],
      },
    ],
  },
  followUpQuestions: [
    {
      question: '협업 성과를 입증하는 대표 산출물은 무엇입니까?',
      reason: '협업 기여를 직접 보여 줄 추가 근거가 필요합니다.',
      priority: 'HIGH',
      evidenceRefs: ['checkin:c1'],
    },
    {
      question: '조직 KPI와 연결된 실제 파급 효과를 어떤 자료로 확인할 수 있습니까?',
      reason: '조직 확산 범위를 더 구체적으로 볼 필요가 있습니다.',
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
}

async function main() {
  await run('briefing env prefers OPENAI_BRIEFING_MODEL and otherwise falls back to gpt-5.4', () => {
    const explicit = readExecutivePerformanceBriefingEnv({
      AI_ASSIST_ENABLED: 'true',
      OPENAI_API_KEY: 'test-key',
      OPENAI_BRIEFING_MODEL: 'gpt-5.4',
      OPENAI_MODEL: 'gpt-5-mini',
    })
    const defaulted = readExecutivePerformanceBriefingEnv({
      AI_ASSIST_ENABLED: 'true',
      OPENAI_API_KEY: 'test-key',
    })

    assert.equal(explicit.briefingModel, 'gpt-5.4')
    assert.equal(explicit.briefingModelSource, 'OPENAI_BRIEFING_MODEL')
    assert.equal(defaulted.briefingModel, 'gpt-5.4')
    assert.equal(defaulted.briefingModelSource, 'default:gpt-5.4')
  })

  await run('Responses API helper sends system and user prompts with strict structured format', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetcher: typeof fetch = (async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: JSON.stringify(sampleOutput),
          usage: { input_tokens: 123, output_tokens: 45 },
        }),
      } as Response
    }) as typeof fetch

    const result = await requestExecutivePerformanceBriefingFromOpenAI(sampleInput, {
      env: {
        AI_ASSIST_ENABLED: 'true',
        OPENAI_API_KEY: 'test-key',
        OPENAI_BRIEFING_MODEL: 'gpt-5.4',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
      fetcher,
    })

    assert.equal(result.model, 'gpt-5.4')
    assert.equal(result.result.alignment.status, 'REVIEW_NEEDED')
    assert.equal(calls.length, 1)

    const body = JSON.parse(String(calls[0]?.init.body ?? '{}')) as {
      model: string
      input: Array<{ role: string; content: Array<{ text: string }> }>
      text: { format: { name: string; strict: boolean } }
    }

    assert.equal(calls[0]?.url, 'https://api.openai.com/v1/responses')
    assert.equal(body.model, 'gpt-5.4')
    assert.equal(body.text.format.name, 'executive_performance_briefing')
    assert.equal(body.text.format.strict, true)
    assert.equal(body.input[0]?.role, 'system')
    assert.equal(body.input[0]?.content[0]?.text.includes('최종 평가자나 점수 산정기가 아닙니다.'), true)
    assert.equal(body.input[1]?.role, 'user')
    assert.equal(body.input[1]?.content[0]?.text.includes('[평가 대상 기본 정보]'), true)
  })

  await run('Responses API helper supports insufficient evidence output without grading', async () => {
    const fetcher: typeof fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: JSON.stringify({
            ...sampleOutput,
            confidence: {
              level: 'LOW',
              reason: '근거량이 충분하지 않습니다.',
            },
            alignment: {
              ...sampleOutput.alignment,
              status: 'INSUFFICIENT_EVIDENCE',
              labelKo: '근거 부족',
            },
          }),
          usage: { input_tokens: 80, output_tokens: 40 },
        }),
      }) as Response) as typeof fetch

    const result = await requestExecutivePerformanceBriefingFromOpenAI(sampleInput, {
      env: { OPENAI_API_KEY: 'test-key' },
      fetcher,
    })

    assert.equal(result.result.alignment.status, 'INSUFFICIENT_EVIDENCE')
    assert.equal(result.result.alignment.labelKo, '근거 부족')
  })

  await run('Responses API helper raises clean errors for missing API key and invalid JSON', async () => {
    await assert.rejects(
      () =>
        requestExecutivePerformanceBriefingFromOpenAI(sampleInput, {
          env: {},
        }),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'AI_API_KEY_MISSING'
    )

    const invalidJsonFetcher: typeof fetch = (async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: '{invalid-json',
        }),
      }) as Response) as typeof fetch

    await assert.rejects(
      () =>
        requestExecutivePerformanceBriefingFromOpenAI(sampleInput, {
          env: { OPENAI_API_KEY: 'test-key' },
          fetcher: invalidJsonFetcher,
        }),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'AI_INVALID_JSON'
    )
  })

  console.log('Executive performance briefing OpenAI helper tests completed')
}

void main()
