import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildOnboardingReviewNamePreview,
  planOnboardingWorkflowGeneration,
} from '../src/lib/onboarding-review-workflow'
import {
  OnboardingReviewWorkflowRunSchema,
  OnboardingReviewWorkflowSchema,
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
  await run('workflow config schema persists hire-date and position conditions with multi-step settings', () => {
    const parsed = OnboardingReviewWorkflowSchema.safeParse({
      evalCycleId: 'cycle-1',
      workflowName: '입사 90일 온보딩 리뷰',
      isActive: true,
      scheduleHourKst: 8,
      targetConditions: [
        {
          id: 'join-date-window',
          field: 'JOIN_DATE',
          operator: 'BETWEEN',
          value: '2026-01-01',
          valueTo: '2026-03-31',
        },
        {
          id: 'job-family',
          field: 'POSITION',
          operator: 'IN',
          values: ['MEMBER', 'TEAM_LEADER'],
        },
      ],
      steps: [
        {
          id: 'step-1',
          stepOrder: 1,
          stepName: '1차 온보딩 리뷰',
          triggerDaysAfterJoin: 30,
          durationDays: 14,
          reviewNameTemplate: '{{evalYear}} {{cycleName}} {{stepName}}',
          includeEmployeeNameInName: true,
          includeHireDateInName: false,
        },
        {
          id: 'step-2',
          stepOrder: 2,
          stepName: '2차 온보딩 리뷰',
          triggerDaysAfterJoin: 90,
          durationDays: 14,
          reviewNameTemplate: '{{evalYear}} {{cycleName}} {{stepName}}',
          includeEmployeeNameInName: true,
          includeHireDateInName: true,
        },
      ],
    })

    assert.equal(parsed.success, true)
    if (!parsed.success) return

    assert.equal(parsed.data.targetConditions[0].field, 'JOIN_DATE')
    assert.equal(parsed.data.targetConditions[1].field, 'POSITION')
    assert.equal(parsed.data.steps.length, 2)
    assert.equal(parsed.data.steps[1]?.includeHireDateInName, true)
  })

  await run('review name preview reflects step template and naming options', () => {
    const preview = buildOnboardingReviewNamePreview({
      evalYear: 2026,
      cycleName: '상반기 리뷰',
      employeeName: '김지은',
      hireDate: new Date('2026-01-05T00:00:00+09:00'),
      step: {
        id: 'step-1',
        stepOrder: 1,
        stepName: '1차 온보딩 리뷰',
        triggerDaysAfterJoin: 30,
        durationDays: 14,
        reviewNameTemplate: '{{evalYear}} {{cycleName}} {{stepName}}',
        includeEmployeeNameInName: true,
        includeHireDateInName: true,
      },
    })

    assert.equal(preview.includes('2026'), true)
    assert.equal(preview.includes('상반기 리뷰'), true)
    assert.equal(preview.includes('1차 온보딩 리뷰'), true)
    assert.equal(preview.includes('김지은'), true)
    assert.equal(preview.includes('2026-01-05'), true)
  })

  await run('auto generation plans only due and eligible employees', () => {
    const plan = planOnboardingWorkflowGeneration({
      workflow: {
        id: 'workflow-1',
        evalCycleId: 'cycle-1',
        workflowName: '입사 30일 리뷰',
        isActive: true,
        scheduleHourKst: 8,
        targetConditions: [
          {
            id: 'join-condition',
            field: 'JOIN_DATE',
            operator: 'ON_OR_AFTER',
            value: '2026-01-01',
          },
          {
            id: 'position-condition',
            field: 'POSITION',
            operator: 'IN',
            values: ['MEMBER'],
          },
        ],
        steps: [
          {
            id: 'step-1',
            stepOrder: 1,
            stepName: '1차 온보딩 리뷰',
            triggerDaysAfterJoin: 30,
            durationDays: 14,
            reviewNameTemplate: '{{evalYear}} {{cycleName}} {{stepName}}',
            includeEmployeeNameInName: true,
            includeHireDateInName: false,
          },
        ],
      },
      evalYear: 2026,
      cycleName: '상반기',
      existingGenerationKeys: new Set<string>(),
      now: new Date('2026-02-10T09:00:00+09:00'),
      employees: [
        {
          id: 'emp-eligible',
          name: '입사자',
          joinDate: new Date('2026-01-05T00:00:00+09:00'),
          position: 'MEMBER',
          departmentName: '성과보상팀',
          managerId: 'leader-1',
        },
        {
          id: 'emp-future',
          name: '아직 생성 전',
          joinDate: new Date('2026-02-01T00:00:00+09:00'),
          position: 'MEMBER',
          departmentName: '성과보상팀',
          managerId: 'leader-1',
        },
        {
          id: 'emp-ineligible',
          name: '직군 불일치',
          joinDate: new Date('2026-01-10T00:00:00+09:00'),
          position: 'TEAM_LEADER',
          departmentName: '성과보상팀',
          managerId: 'leader-1',
        },
      ],
    })

    assert.equal(plan.created.length, 1)
    assert.equal(plan.created[0]?.employeeId, 'emp-eligible')
    assert.equal(plan.scheduledLaterCount, 1)
    assert.equal(plan.ineligibleCount, 1)
  })

  await run('auto generation prevents duplicate workflow-step creation', () => {
    const plan = planOnboardingWorkflowGeneration({
      workflow: {
        id: 'workflow-1',
        evalCycleId: 'cycle-1',
        workflowName: '입사 30일 리뷰',
        isActive: true,
        scheduleHourKst: 8,
        targetConditions: [],
        steps: [
          {
            id: 'step-1',
            stepOrder: 1,
            stepName: '1차 온보딩 리뷰',
            triggerDaysAfterJoin: 7,
            durationDays: 14,
            reviewNameTemplate: '{{evalYear}} {{cycleName}} {{stepName}}',
            includeEmployeeNameInName: false,
            includeHireDateInName: false,
          },
        ],
      },
      evalYear: 2026,
      cycleName: '상반기',
      existingGenerationKeys: new Set(['workflow-1:emp-1:step-1']),
      now: new Date('2026-02-10T09:00:00+09:00'),
      employees: [
        {
          id: 'emp-1',
          name: '기존 생성자',
          joinDate: new Date('2026-01-01T00:00:00+09:00'),
          position: 'MEMBER',
          departmentName: '성과보상팀',
          managerId: 'leader-1',
        },
      ],
    })

    assert.equal(plan.created.length, 0)
    assert.equal(plan.duplicateCount, 1)
  })

  await run('workflow run schema and admin panel expose onboarding workflow controls and generated review list', () => {
    const runSchema = OnboardingReviewWorkflowRunSchema.safeParse({
      cycleId: 'cycle-1',
      workflowId: 'workflow-1',
    })
    const panelSource = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')

    assert.equal(runSchema.success, true)
    assert.equal(panelSource.includes('/api/feedback/onboarding-workflows'), true)
    assert.equal(panelSource.includes('/api/feedback/onboarding-workflows/run'), true)
    assert.equal(panelSource.includes('selectedWorkflowId'), true)
    assert.equal(panelSource.includes('generatedReviewSearch'), true)
    assert.equal(panelSource.includes('generatedReviewStatusFilter'), true)
    assert.equal(panelSource.includes('handleRunOnboardingWorkflow'), true)
  })

  await run('onboarding workflow routes exist for config save, manual run, and scheduled generation', () => {
    const requiredRoutes = [
      'src/app/api/feedback/onboarding-workflows/route.ts',
      'src/app/api/feedback/onboarding-workflows/run/route.ts',
      'src/app/api/cron/feedback-onboarding/route.ts',
    ]

    for (const file of requiredRoutes) {
      assert.equal(existsSync(path.resolve(process.cwd(), file)), true, `${file} should exist`)
    }
  })

  console.log('Onboarding review workflow tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
