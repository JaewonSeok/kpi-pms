import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  calculateDevelopmentPlanProgress,
  normalizeDevelopmentPlanActionItems,
  normalizeDevelopmentPlanLinkedEvidence,
  normalizeDevelopmentPlanStringArray,
} from '../src/lib/development-plan'
import {
  DevelopmentPlanCreateSchema,
  DevelopmentPlanUpdateSchema,
  Feedback360AiActionSchema,
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
  await run('development plan schemas accept competencies, linked evidence, and update payloads', () => {
    const createParsed = DevelopmentPlanCreateSchema.safeParse({
      employeeId: 'emp-1',
      sourceType: 'FEEDBACK_360',
      sourceId: 'feedback-1',
      title: 'Growth plan',
      focusArea: 'Coaching consistency',
      actions: [
        'Prepare coaching notes before 1:1',
        {
          id: 'action-2',
          title: 'Document monthly growth feedback',
          status: 'IN_PROGRESS',
          note: 'Started with direct reports',
          dueDate: '2026-06-01T00:00:00.000Z',
        },
      ],
      recommendedCompetencies: ['Coaching', 'Feedback quality'],
      managerSupport: ['Observe one 1:1 per month'],
      nextCheckinTopics: ['How to close feedback loops'],
      linkedEvidence: [
        {
          type: 'REVIEW',
          label: 'Manager effectiveness result',
          href: '/evaluation/360/results?roundId=round-1',
        },
      ],
      note: 'Focus on follow-through.',
      dueDate: '2026-07-01T00:00:00.000Z',
    })

    const updateParsed = DevelopmentPlanUpdateSchema.safeParse({
      id: 'plan-1',
      status: 'COMPLETED',
      actions: [
        {
          id: 'action-2',
          title: 'Document monthly growth feedback',
          status: 'DONE',
        },
      ],
      recommendedCompetencies: ['Feedback quality'],
      linkedEvidence: [
        {
          type: 'CHECKIN',
          label: 'Monthly 1:1 note',
        },
      ],
      dueDate: null,
    })

    assert.equal(createParsed.success, true)
    assert.equal(updateParsed.success, true)
  })

  await run('development plan helpers normalize actions, evidence, and progress', () => {
    const actions = normalizeDevelopmentPlanActionItems([
      'Clarify coaching expectations',
      {
        id: 'action-2',
        title: 'Follow up on action items',
        status: 'DONE',
        note: 'Shared in 1:1',
      },
      {
        title: 'Run quarterly retrospectives',
        status: 'IN_PROGRESS',
      },
    ])
    const competencies = normalizeDevelopmentPlanStringArray(['Coaching', ' ', 'Feedback'])
    const evidence = normalizeDevelopmentPlanLinkedEvidence([
      { type: 'GOAL', label: 'Manager development goal', href: '/kpi/personal' },
      { type: 'MANUAL', label: 'Observed in calibration' },
    ])
    const progress = calculateDevelopmentPlanProgress(actions)

    assert.equal(actions.length, 3)
    assert.equal(actions[0]?.status, 'NOT_STARTED')
    assert.deepEqual(competencies, ['Coaching', 'Feedback'])
    assert.equal(evidence.length, 2)
    assert.equal(progress.totalCount, 3)
    assert.equal(progress.completedCount, 1)
    assert.equal(progress.progressRate, 33)
  })

  await run('growth copilot schema, route, loader, and workspace wiring stay aligned with governance gates', () => {
    const aiRoute = read('src/app/api/feedback/360/ai/route.ts')
    const aiAssist = read('src/lib/ai-assist.ts')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const resultsLoader = read('src/server/feedback-360.ts')
    const developmentPlanRoute = read('src/app/api/development-plans/route.ts')
    const growthPanel = read('src/components/evaluation/feedback360/GrowthCopilotPanel.tsx')
    const preview = read('src/components/evaluation/feedback360/DevelopmentPlanPreview.tsx')

    const actionParsed = Feedback360AiActionSchema.safeParse({
      action: 'suggest-growth-copilot',
      sourceId: 'round-1:emp-1:growth',
      payload: { employeeId: 'emp-1' },
    })

    assert.equal(actionParsed.success, true)
    assert.equal(aiRoute.includes('suggest-growth-copilot'), true)
    assert.equal(aiAssist.includes('Feedback360GrowthCopilot'), true)
    assert.equal(resultsLoader.includes('allowManagerView'), true)
    assert.equal(resultsLoader.includes('allowSelfView'), true)
    assert.equal(resultsLoader.includes('recentGoals'), true)
    assert.equal(resultsLoader.includes('recentCheckins'), true)
    assert.equal(resultsLoader.includes('feedbackSignals'), true)
    assert.equal(workspace.includes('GrowthCopilotPanel'), true)
    assert.equal(workspace.includes('RespondRoleGuideCard'), true)
    assert.equal(growthPanel.includes('disclaimer'), true)
    assert.equal(developmentPlanRoute.includes('export async function PATCH'), true)
    assert.equal(preview.includes('recommendedCompetencies'), true)
    assert.equal(preview.includes('linkedEvidence'), true)
    assert.equal(preview.includes('progressRate'), true)
  })

  console.log('IDP and growth copilot tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
