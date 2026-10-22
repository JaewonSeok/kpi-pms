import './register-path-aliases'
import assert from 'node:assert/strict'
import Module from 'node:module'

process.env.DATABASE_URL ||= 'postgresql://postgres:password@localhost:5432/kpi_pms'
// AI 호출은 하지 않는다. 비활성 경로에서도 AI 입력(requestPayload)은 만들어져 요청 로그에 남는다.
process.env.AI_ASSIST_ENABLED = 'false'

// 한 건이 실패해도 나머지 케이스 결과를 함께 보도록 끝까지 돌고, 실패가 있으면 exit 1 로 끝낸다.
async function run(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

function stubModule(request: string, exports: Record<string, unknown>) {
  const filename = require.resolve(request)
  const stub = new Module(filename)
  stub.filename = filename
  stub.loaded = true
  stub.exports = exports
  require.cache[filename] = stub
}

// ---- 360 라운드 fixture ---------------------------------------------------------------
// 태그는 태그 풀의 실제 라벨이어야 어조(강점 · 보완)가 판정된다.
type Relationship = 'SELF' | 'SUPERVISOR' | 'PEER' | 'SUBORDINATE'
type FeedbackSpec = { giverId: string; relationship: Relationship; rating: number; tags?: string[] }
type RoundSpec = {
  id: string
  roundType: 'FULL_360' | 'UPWARD'
  status: 'IN_PROGRESS' | 'COMPLETED'
  released: boolean
  minRaters: number
  feedbacks: FeedbackSpec[]
}

const responseText = (roundId: string, index: number) => `RESP_${roundId}_${index}_응답 원문입니다`
const commentText = (roundId: string, index: number) => `COMMENT_${roundId}_${index}_종합 의견 원문`

let TAG_SHARED = ''
let TAG_ONCE = ''
let TAG_WITH_SELF = ''

function roundSpecs(): RoundSpec[] {
  return [
    // 진행 중 · 공개 전 · 기준 미달 · 상향평가는 업적평가 쪽에 나오면 안 된다.
    {
      id: 'ROUND_OPEN',
      roundType: 'FULL_360',
      status: 'IN_PROGRESS',
      released: false,
      minRaters: 1,
      feedbacks: [1, 2, 3].map((n) => ({ giverId: `emp-p${n}`, relationship: 'PEER' as const, rating: 1 })),
    },
    {
      id: 'ROUND_UNRELEASED',
      roundType: 'FULL_360',
      status: 'COMPLETED',
      released: false,
      minRaters: 1,
      feedbacks: [1, 2, 3].map((n) => ({ giverId: `emp-p${n}`, relationship: 'PEER' as const, rating: 1 })),
    },
    {
      id: 'ROUND_BELOW',
      roundType: 'FULL_360',
      status: 'COMPLETED',
      released: true,
      minRaters: 3,
      feedbacks: [
        { giverId: 'emp-target', relationship: 'SELF', rating: 1 },
        { giverId: 'emp-p1', relationship: 'PEER', rating: 1, tags: [TAG_SHARED] },
        { giverId: 'emp-p2', relationship: 'PEER', rating: 1, tags: [TAG_SHARED] },
      ],
    },
    {
      id: 'ROUND_UPWARD',
      roundType: 'UPWARD',
      status: 'COMPLETED',
      released: true,
      minRaters: 1,
      feedbacks: [1, 2, 3].map((n) => ({ giverId: `emp-p${n}`, relationship: 'SUBORDINATE' as const, rating: 1 })),
    },
    // 공개됐고 기준을 넘은 라운드: SELF 를 뺀 평균은 (4 + 4 + 5) / 3 = 4.3
    {
      id: 'ROUND_OK',
      roundType: 'FULL_360',
      status: 'COMPLETED',
      released: true,
      minRaters: 3,
      feedbacks: [
        { giverId: 'emp-target', relationship: 'SELF', rating: 1, tags: [TAG_WITH_SELF] },
        { giverId: 'emp-p1', relationship: 'PEER', rating: 4, tags: [TAG_SHARED, TAG_ONCE] },
        { giverId: 'emp-p2', relationship: 'PEER', rating: 4, tags: [TAG_SHARED, TAG_WITH_SELF] },
        { giverId: 'emp-p3', relationship: 'PEER', rating: 5 },
      ],
    },
  ]
}

function feedbackRows(spec: RoundSpec) {
  return spec.feedbacks.map((feedback, index) => ({
    id: `${spec.id}-fb-${index}`,
    roundId: spec.id,
    giverId: feedback.giverId,
    receiverId: 'emp-target',
    relationship: feedback.relationship,
    status: 'SUBMITTED',
    overallComment: feedback.tags?.length
      ? `[선택 태그 요약]\n긍정: ${feedback.tags.join(', ')}\n\n${commentText(spec.id, index)}`
      : commentText(spec.id, index),
    submittedAt: new Date('2026-06-20T00:00:00Z'),
    createdAt: new Date('2026-06-01T00:00:00Z'),
    responses: [
      { ratingValue: feedback.rating, textValue: null, question: { questionType: 'RATING_SCALE', category: '협업', questionText: '협업 점수' } },
      { ratingValue: null, textValue: responseText(spec.id, index), question: { questionType: 'TEXT', category: '성장', questionText: '성장 제안' } },
    ],
    round: { id: spec.id, roundType: spec.roundType, evalCycleId: 'cycle-1' },
  }))
}

function roundRows() {
  return roundSpecs().map((spec) => ({
    id: spec.id,
    evalCycleId: 'cycle-1',
    roundName: `${spec.id}_NAME`,
    roundType: spec.roundType,
    status: spec.status,
    isAnonymous: true,
    minRaters: spec.minRaters,
    startDate: new Date('2026-06-01T00:00:00Z'),
    endDate: new Date('2026-06-30T00:00:00Z'),
    documentSettings: spec.released ? { resultReleasedAt: '2026-07-01T00:00:00.000Z' } : null,
    resultPresentationSettings: null,
    onboardingReviewGeneration: null,
    feedbacks: feedbackRows(spec),
  }))
}

// ---- 평가 · 직원 fixture ----------------------------------------------------------------
const department = { id: 'dept-1', deptName: '영업팀', orgId: 'org-1', parentDeptId: null, organization: { id: 'org-1', name: 'RSUPPORT' } }
const EMPLOYEES: Record<string, Record<string, unknown>> = {
  'emp-admin': { empName: '관리자', role: 'ROLE_ADMIN', position: 'MEMBER' },
  'emp-target': { empName: '대상자', role: 'ROLE_MEMBER', position: 'MEMBER', teamLeaderId: 'emp-leader' },
  'emp-leader': { empName: '팀장', role: 'ROLE_TEAM_LEADER', position: 'TEAM_LEADER' },
}
function employee(id: string) {
  const base = EMPLOYEES[id]
  if (!base) return null
  return {
    id,
    empId: id,
    gwsEmail: `${id}@example.com`,
    jobTitle: null,
    teamName: '영업팀',
    teamLeaderId: null,
    sectionChiefId: null,
    divisionHeadId: null,
    status: 'ACTIVE',
    joinDate: new Date('2020-01-01T00:00:00Z'),
    notes: null,
    profileImageUrl: null,
    deptId: 'dept-1',
    department,
    ...base,
  }
}

function evaluationRow(evalStage: string) {
  return {
    id: `eval-${evalStage.toLowerCase()}`,
    evalCycleId: 'cycle-1',
    targetId: 'emp-target',
    evaluatorId: 'emp-admin',
    evalStage,
    status: 'IN_PROGRESS',
    totalScore: 80,
    gradeId: null,
    comment: '평가 의견입니다.',
    strengthComment: null,
    improvementComment: null,
    nextStepGuidance: null,
    submittedAt: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-02T00:00:00Z'),
    evalCycle: { id: 'cycle-1', orgId: 'org-1', cycleName: '2026 평가', evalYear: 2026, status: 'FINAL_EVAL', calibrationSessionConfig: null, showQuestionWeight: true, showScoreSummary: true, ceoAdjustStart: null, ceoAdjustEnd: null, resultOpenStart: null, organization: { name: 'RSUPPORT' } },
    target: employee('emp-target'),
    evaluator: employee('emp-admin'),
    items: [],
  }
}

// ---- 가짜 DB ---------------------------------------------------------------------------
// 스텁하지 않은 모델 · 메서드에 접근하면 기록하고 즉시 던진다. 실제 Prisma 로는 나가지 않는다.
const unstubbedCalls: string[] = []
const aiRequestPayloads: Record<string, unknown>[] = []
function guardedDb(models: Record<string, Record<string, unknown>>) {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => {
      if (typeof key !== 'string' || key === 'then') return undefined
      if (key === '$transaction') {
        return async (arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(fakeDb) : Promise.all(arg as unknown[]))
      }
      const methods = models[key] ?? {}
      return new Proxy({} as Record<string, unknown>, {
        get: (_inner, method) => {
          if (typeof method !== 'string' || method === 'then') return undefined
          if (methods[method]) return methods[method]
          return () => {
            unstubbedCalls.push(`${key}.${method}`)
            throw new Error(`UNSTUBBED_DB_CALL:${key}.${method}`)
          }
        },
      })
    },
  })
}

type Where = { relationship?: { in?: string[] }; round?: { roundType?: string } }
const fakeDb: Record<string, unknown> = guardedDb({
  employee: {
    findUnique: async (args: { where: { id: string } }) => employee(args.where.id),
    findMany: async (args: { where?: { id?: { in?: string[] } } }) =>
      (args?.where?.id?.in ?? Object.keys(EMPLOYEES)).map(employee).filter(Boolean),
    findFirst: async () => null,
  },
  evalCycle: { findMany: async () => [evaluationRow('FINAL').evalCycle] },
  evaluation: {
    findUnique: async (args: { where: { id?: string } }) =>
      args.where.id ? evaluationRow(args.where.id.replace('eval-', '').toUpperCase()) : null,
    findMany: async () => [evaluationRow('FINAL')],
  },
  multiFeedbackRound: {
    findMany: async () => roundRows(),
    count: async () => roundRows().length,
  },
  // 보정 화면은 응답 행을 바로 읽는다. DB 처럼 관계 조건만 적용한다.
  multiFeedback: {
    findMany: async (args: { where?: Where }) =>
      roundRows()
        .flatMap((round) => round.feedbacks)
        .filter((row) => !args?.where?.relationship?.in || args.where.relationship.in.includes(row.relationship)),
  },
  aiRequestLog: {
    create: async (args: { data: { requestPayload?: Record<string, unknown> } }) => {
      if (args.data.requestPayload) aiRequestPayloads.push(args.data.requestPayload)
      return { id: `ai-log-${aiRequestPayloads.length}` }
    },
    findMany: async () => [],
    findFirst: async () => null,
  },
  operationalEvent: { create: async () => ({}) },
  evaluationAssignment: { findMany: async () => [] },
  personalKpi: { count: async () => 0, findMany: async () => [] },
  monthlyRecord: { findMany: async () => [] },
  checkIn: { findMany: async () => [] },
  gradeSetting: {
    findMany: async () => [{ id: 'grade-a', gradeName: 'A', minScore: 0, maxScore: 100, targetDistRate: null, gradeOrder: 1, levelName: 'A', baseScore: 90 }],
  },
  auditLog: { findMany: async () => [], findFirst: async () => null },
  department: { findMany: async () => [{ ...department, leaderEmployeeId: null, leaderEmployee: null }] },
  appeal: { findMany: async () => [] },
  aiCompetencyGateCycle: { findUnique: async () => null },
  midReviewAssignment: { findFirst: async () => null },
  aiCompetencyResult: { findMany: async () => [] },
})

stubModule('../src/lib/prisma', { prisma: fakeDb })
stubModule('../src/lib/audit', {
  createAuditLog: async () => undefined,
  getClientInfo: () => ({}),
  resolveAuditActor: () => ({ userId: 'emp-admin' }),
})

async function main() {
  const tagPool = await import('../src/components/evaluation/feedback360/feedback360-response-tag-pool')
  const positiveLabels = tagPool.FEEDBACK_360_RESPONSE_TAG_CATEGORIES.flatMap((category) => category.positiveTags.map((tag) => tag.label))
  const uniqueLabels = [...new Set(positiveLabels)].filter(
    (label) => positiveLabels.indexOf(label) === positiveLabels.lastIndexOf(label)
  )
  ;[TAG_SHARED, TAG_ONCE, TAG_WITH_SELF] = uniqueLabels

  const { getEvaluationWorkbenchPageData } = await import('../src/server/evaluation-workbench')
  const { getEvaluationCalibrationPageData } = await import('../src/server/evaluation-calibration')
  const { generateEvaluationPerformanceBriefing } = await import('../src/server/ai/evaluation-performance-briefing')
  const { generateEvaluationAssist } = await import('../src/server/ai/evaluation-assist')

  // 네 경로를 한 번씩 실행해 결과를 모은다.
  const workbench = await getEvaluationWorkbenchPageData({
    session: { user: { id: 'emp-admin', name: '관리자', role: 'ROLE_ADMIN' } } as never,
    cycleId: 'cycle-1',
    evaluationId: 'eval-final',
  })
  const workbenchRounds = workbench.selected?.evidence.feedbackRounds ?? []
  const workbenchJson = JSON.stringify(workbench.selected?.evidence ?? null)

  const calibration = await getEvaluationCalibrationPageData({ userId: 'emp-admin', role: 'ROLE_ADMIN', cycleId: 'cycle-1' })
  const calibrationCandidate = (calibration.viewModel?.candidates as Array<{ id: string; feedbackSummary: Record<string, unknown> }> | undefined)?.find(
    (candidate) => candidate.id === 'emp-target'
  )
  const calibrationJson = JSON.stringify(calibrationCandidate?.feedbackSummary ?? null)

  aiRequestPayloads.length = 0
  await generateEvaluationPerformanceBriefing(
    { actorId: 'emp-admin', actorRole: 'ROLE_ADMIN', auditActor: { userId: 'emp-admin' } as never, evaluationId: 'eval-final' },
    fakeDb as never
  ).catch((error) => {
    console.error('briefing error', error)
  })
  const briefingJson = JSON.stringify(aiRequestPayloads)

  aiRequestPayloads.length = 0
  await generateEvaluationAssist(
    {
      actorId: 'emp-admin',
      actorRole: 'ROLE_ADMIN',
      mode: 'draft',
      evaluationId: 'eval-final',
      draftComment: '',
      strengthComment: '',
      improvementComment: '',
      nextStepGuidance: '',
      growthMemo: '',
      items: [],
    } as never,
    fakeDb as never
  ).catch((error) => {
    console.error('assist error', error)
  })
  const assistJson = JSON.stringify(aiRequestPayloads)

  const surfaces = { workbench: workbenchJson, calibration: calibrationJson, briefing: briefingJson, assist: assistJson }
  const markersOf = (roundId: string) => [
    `${roundId}_NAME`,
    ...[0, 1, 2, 3].flatMap((index) => [responseText(roundId, index), commentText(roundId, index)]),
  ]
  const surfacesContaining = (markers: string[]) =>
    Object.entries(surfaces)
      .filter(([, json]) => markers.some((marker) => json.includes(marker)))
      .map(([name]) => name)

  await run('경로 실행 확인: 네 경로가 모두 결과를 만들었다', () => {
    assert.deepEqual(
      {
        workbenchState: workbench.state,
        calibrationState: calibration.state,
        briefingPayloads: briefingJson !== '[]',
        assistPayloads: assistJson !== '[]',
      },
      { workbenchState: 'ready', calibrationState: 'ready', briefingPayloads: true, assistPayloads: true }
    )
  })

  await run('ⓐ 진행 중이거나 공개 전인 라운드의 응답은 워크벤치 · 보정 화면 · AI 어디에도 나오지 않는다', () => {
    assert.deepEqual(
      {
        workbenchRoundIds: workbenchRounds.map((round) => round.id).filter((id) => ['ROUND_OPEN', 'ROUND_UNRELEASED'].includes(id)),
        surfacesWithOpen: surfacesContaining(markersOf('ROUND_OPEN')),
        surfacesWithUnreleased: surfacesContaining(markersOf('ROUND_UNRELEASED')),
        // 평균 1점짜리 라운드가 섞이면 4.3 이 아니게 된다.
        calibrationMean: calibrationCandidate?.feedbackSummary.peerMean ?? null,
      },
      { workbenchRoundIds: [], surfacesWithOpen: [], surfacesWithUnreleased: [], calibrationMean: 4.3 }
    )
  })

  await run('ⓑ 기준 미달 대상은 평균 · 태그가 나오지 않는다', () => {
    assert.deepEqual(
      {
        workbenchHasBelow: workbenchRounds.some((round) => round.id === 'ROUND_BELOW'),
        surfacesWithBelow: surfacesContaining(markersOf('ROUND_BELOW')),
      },
      { workbenchHasBelow: false, surfacesWithBelow: [] }
    )
  })

  await run('ⓒ UPWARD 응답은 업적평가 쪽 어디에도 나오지 않는다', () => {
    assert.deepEqual(
      {
        workbenchHasUpward: workbenchRounds.some((round) => round.roundType === 'UPWARD'),
        surfacesWithUpward: surfacesContaining(markersOf('ROUND_UPWARD')),
        calibrationMean: calibrationCandidate?.feedbackSummary.peerMean ?? null,
      },
      { workbenchHasUpward: false, surfacesWithUpward: [], calibrationMean: 4.3 }
    )
  })

  await run('ⓓ 응답 원문이 AI 입력에 들어가지 않는다', () => {
    const allRoundIds = roundSpecs().map((spec) => spec.id)
    const rawTexts = allRoundIds.flatMap((roundId) =>
      [0, 1, 2, 3].flatMap((index) => [responseText(roundId, index), commentText(roundId, index)])
    )
    assert.deepEqual(
      {
        briefing: rawTexts.filter((text) => briefingJson.includes(text)),
        assist: rawTexts.filter((text) => assistJson.includes(text)),
      },
      { briefing: [], assist: [] }
    )
  })

  await run('ⓔ 공개됐고 기준을 충족하면 평균과 2회 이상 쓰인 태그가 나온다(SELF 제외)', () => {
    const ok = workbenchRounds.find((round) => round.id === 'ROUND_OK')
    assert.deepEqual(
      {
        workbench: ok ? { averageRating: ok.averageRating, positiveTags: ok.positiveTags, submittedCount: ok.submittedCount } : null,
        calibrationMean: calibrationCandidate?.feedbackSummary.peerMean ?? null,
        // 평가자별 점수는 쓰지 않는다: 본인 · 리더 평균은 비운다.
        calibrationSelfMean: calibrationCandidate?.feedbackSummary.selfMean ?? null,
        briefingHasAverage: briefingJson.includes('4.3'),
        assistHasAverage: assistJson.includes('4.3'),
        aiHasRepeatedTag: [briefingJson, assistJson].every((json) => json.includes(TAG_SHARED)),
        aiHasOnceTag: [briefingJson, assistJson].some((json) => json.includes(TAG_ONCE)),
      },
      {
        workbench: { averageRating: 4.3, positiveTags: [{ label: TAG_SHARED, count: 2 }], submittedCount: 3 },
        calibrationMean: 4.3,
        calibrationSelfMean: null,
        briefingHasAverage: true,
        assistHasAverage: true,
        aiHasRepeatedTag: true,
        aiHasOnceTag: false,
      }
    )
  })

  await run('실제 Prisma 로 나간 호출이 없다(스텁하지 않은 DB 호출 0건)', () => {
    const prismaPath = require.resolve('../src/lib/prisma')
    assert.deepEqual(
      {
        unstubbedCalls: [...new Set(unstubbedCalls)],
        prismaIsFake: (require.cache[prismaPath]?.exports as { prisma?: unknown } | undefined)?.prisma === fakeDb,
      },
      { unstubbedCalls: [], prismaIsFake: true }
    )
  })

  console.log('Feedback 360 evaluation evidence tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
