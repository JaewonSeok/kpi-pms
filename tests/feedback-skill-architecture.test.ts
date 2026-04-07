import assert from 'node:assert/strict'
import './register-path-aliases'
import {
  DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS,
  DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS,
  parseFeedbackAiCopilotSettings,
  parseFeedbackSkillArchitectureSettings,
  resolveFeedbackRoleGuide,
} from '../src/lib/feedback-skill-architecture'
import { FeedbackSelectionSettingsSchema } from '../src/lib/validations'

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
  await run('skill architecture settings parser falls back to defaults', () => {
    assert.deepEqual(parseFeedbackSkillArchitectureSettings(undefined), DEFAULT_FEEDBACK_SKILL_ARCHITECTURE_SETTINGS)
    assert.deepEqual(parseFeedbackAiCopilotSettings(undefined), DEFAULT_FEEDBACK_AI_COPILOT_SETTINGS)
  })

  await run('feedback selection settings schema accepts skill architecture and AI copilot config', () => {
    const parsed = FeedbackSelectionSettingsSchema.safeParse({
      requireLeaderApproval: false,
      allowPreferredPeers: false,
      excludeLeaderFromPeerSelection: false,
      excludeDirectReportsFromPeerSelection: false,
      skillArchitecture: {
        enabled: true,
        roleProfiles: [
          {
            id: 'profile-1',
            label: 'People Manager / M2',
            jobFamily: 'People',
            level: 'M2',
            guideText: 'Coach through clear expectations and structured feedback.',
            expectedCompetencies: ['Coaching', 'Decision quality'],
            nextLevelExpectations: ['Org-level leadership'],
            goalLibrary: ['Quarterly talent review', '1:1 quality improvement'],
            filters: {
              departmentKeyword: 'People',
              position: 'TEAM_LEADER',
            },
          },
        ],
      },
      aiCopilot: {
        enabled: true,
        allowManagerView: true,
        allowSelfView: false,
        includeGoals: true,
        includeCheckins: true,
        includeFeedback: true,
        includeResults: false,
        disclaimer: 'AI suggestions are support only.',
      },
    })

    assert.equal(parsed.success, true)
  })

  await run('role guide resolution prefers the most specific HR profile match', () => {
    const settings = parseFeedbackSkillArchitectureSettings({
      enabled: true,
      roleProfiles: [
        {
          id: 'general-people',
          label: 'People General',
          jobFamily: 'People',
          level: 'M1',
          guideText: 'General people leadership guide.',
          expectedCompetencies: ['Coaching'],
          nextLevelExpectations: ['Cross-team influence'],
          goalLibrary: ['Monthly skip-level'],
          filters: {
            departmentKeyword: 'People',
          },
        },
        {
          id: 'specific-manager',
          label: 'People Manager / Team Lead',
          jobFamily: 'People',
          level: 'M2',
          guideText: 'Specific manager guide.',
          expectedCompetencies: ['Coaching', 'Feedback quality'],
          nextLevelExpectations: ['Org design'],
          goalLibrary: ['Manager effectiveness'],
          filters: {
            departmentKeyword: 'People',
            roleKeyword: 'Leader',
            position: 'TEAM_LEADER',
          },
        },
      ],
    })

    const guide = resolveFeedbackRoleGuide({
      settings,
      target: {
        departmentName: 'People Operations',
        role: 'Team Leader',
        position: 'TEAM_LEADER',
        jobTitle: 'People Manager',
        teamName: 'People Ops',
      },
    })

    assert.equal(guide?.id, 'specific-manager')
    assert.deepEqual(guide?.expectedCompetencies, ['Coaching', 'Feedback quality'])
    assert.deepEqual(guide?.goalLibrary, ['Manager effectiveness'])
    assert.equal(guide?.matchedFilterCount, 3)
  })

  await run('AI copilot parser preserves governance flags and disclaimer', () => {
    const settings = parseFeedbackAiCopilotSettings({
      enabled: true,
      allowManagerView: false,
      allowSelfView: true,
      includeGoals: false,
      includeCheckins: true,
      includeFeedback: true,
      includeResults: false,
      disclaimer: 'AI is a drafting assistant only.',
    })

    assert.equal(settings.enabled, true)
    assert.equal(settings.allowManagerView, false)
    assert.equal(settings.allowSelfView, true)
    assert.equal(settings.includeGoals, false)
    assert.equal(settings.includeResults, false)
    assert.equal(settings.disclaimer, 'AI is a drafting assistant only.')
  })

  console.log('Feedback skill architecture tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
