import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  classifyOrgKpiForPersonalMbo2026,
  detectDailyWorkDuplicateWithOrgGoal2026,
  determineOrgKpiReflectionEligibility2026,
  normalizeOrgKpiHrReflectionState2026,
  summarizeMboPolicyIssues2026,
  validatePersonalKpiMboCategory2026,
} from '../src/server/kpi-alignment-policy-2026'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function divisionOrgKpi(overrides: Record<string, unknown> = {}) {
  return {
    id: 'division-kpi-1',
    title: '본부 매출 성장',
    level: 'DIVISION' as const,
    status: 'CONFIRMED',
    ...overrides,
  }
}

function teamOrgKpi(overrides: Record<string, unknown> = {}) {
  return {
    id: 'team-kpi-1',
    title: '팀 CRM 개선',
    level: 'TEAM' as const,
    status: 'CONFIRMED',
    parentOrgKpiId: null,
    ...overrides,
  }
}

run('linked division KPI becomes organization-goal candidate', () => {
  const result = classifyOrgKpiForPersonalMbo2026(divisionOrgKpi())

  assert.equal(result.category, 'ORG_GOAL')
  assert.equal(result.source, 'DIVISION_KPI')
  assert.equal(result.eligibility.eligibleAsOrgGoal, true)
  assert.equal(result.eligibility.defaultPersonalMboCategory, 'ORG_GOAL')
})

run('reflected team KPI becomes organization-goal candidate', () => {
  const result = classifyOrgKpiForPersonalMbo2026(
    teamOrgKpi({
      latestReviewVerdict: 'ADEQUATE',
    })
  )

  assert.equal(result.category, 'ORG_GOAL')
  assert.equal(result.source, 'TEAM_KPI_REFLECTED')
  assert.equal(result.eligibility.status, 'REFLECTED')
})

run('team KPI review verdicts map to normalized HR reflection states', () => {
  const reflected = normalizeOrgKpiHrReflectionState2026(teamOrgKpi({ latestReviewVerdict: 'ADEQUATE' }))
  const excluded = normalizeOrgKpiHrReflectionState2026(teamOrgKpi({ latestReviewVerdict: 'INSUFFICIENT' }))
  const reviewing = normalizeOrgKpiHrReflectionState2026(teamOrgKpi({ latestReviewVerdict: 'CAUTION' }))
  const exceptionRequired = normalizeOrgKpiHrReflectionState2026(teamOrgKpi())
  const division = normalizeOrgKpiHrReflectionState2026(divisionOrgKpi())

  assert.equal(reflected.state, 'REFLECTED')
  assert.equal(reflected.labelKo, 'HR 반영')
  assert.equal(reflected.eligibleAsOrgGoal, true)
  assert.equal(excluded.state, 'EXCLUDED')
  assert.equal(excluded.defaultPersonalMboCategory, 'DAILY_WORK')
  assert.equal(reviewing.state, 'HR_REVIEWING')
  assert.equal(reviewing.labelKo, '검토 중')
  assert.equal(exceptionRequired.state, 'EXCEPTION_REQUIRED')
  assert.equal(exceptionRequired.requiresHrException, true)
  assert.equal(division.state, 'DIVISION_KPI')
  assert.equal(division.personalMboLabelKo, '조직목표 후보')
})

run('excluded or non-reflected team KPI defaults to daily work', () => {
  const excluded = classifyOrgKpiForPersonalMbo2026(
    teamOrgKpi({
      latestReviewVerdict: 'INSUFFICIENT',
    })
  )
  const pending = classifyOrgKpiForPersonalMbo2026(teamOrgKpi())

  assert.equal(excluded.category, 'DAILY_WORK')
  assert.equal(excluded.eligibility.status, 'EXCLUDED')
  assert.equal(excluded.eligibility.hrReflectionState, 'EXCLUDED')
  assert.equal(pending.category, 'DAILY_WORK')
  assert.equal(pending.eligibility.hrReflectionState, 'EXCEPTION_REQUIRED')
  assert.equal(pending.issues.some((issue) => issue.code === 'TEAM_KPI_NOT_REFLECTED_DEFAULT_DAILY_WORK'), true)
})

run('team KPI exception approved becomes organization-goal candidate', () => {
  const result = determineOrgKpiReflectionEligibility2026(
    teamOrgKpi({
      hrExceptionApproved: true,
      hrExceptionReason: '본부 KPI에는 없지만 2026 핵심 전략 프로젝트로 HR 협의 완료',
    })
  )

  assert.equal(result.status, 'EXCEPTION_APPROVED')
  assert.equal(result.eligibleAsOrgGoal, true)
  assert.equal(result.defaultPersonalMboCategory, 'ORG_GOAL')
})

run('daily work duplicate with organization goal is detected', () => {
  const result = detectDailyWorkDuplicateWithOrgGoal2026({
    dailyWork: {
      id: 'daily-1',
      title: 'CRM 개선 운영',
      definition: '영업 CRM 개선 운영 활동',
    },
    orgGoals: [
      {
        id: 'org-goal-1',
        title: 'CRM 개선 운영',
        definition: '영업 CRM 개선 운영 성과',
      },
    ],
  })

  assert.equal(result.duplicated, true)
  assert.equal(result.matches[0]?.reason, 'NORMALIZED_TITLE_MATCH')
})

run('missing MBO category produces diagnostic', () => {
  const diagnostic = validatePersonalKpiMboCategory2026({
    item: {
      id: 'personal-1',
      title: '분류 안 된 KPI',
    },
  })

  assert.equal(diagnostic.canSubmit, false)
  assert.equal(diagnostic.severity, 'blocker')
  assert.equal(diagnostic.issues.some((issue) => issue.code === 'MISSING_MBO_CATEGORY'), true)
})

run('project T is allowed as personal project category', () => {
  const diagnostic = validatePersonalKpiMboCategory2026({
    item: {
      id: 'project-t-1',
      title: 'AI 기반 자동화 프로젝트',
      policyCategory: 'PROJECT_T',
      weight: 30,
    },
  })

  assert.equal(diagnostic.severity, 'info')
  assert.equal(diagnostic.issues.length, 0)
})

run('project K is allowed as personal project category', () => {
  const diagnostic = validatePersonalKpiMboCategory2026({
    item: {
      id: 'project-k-1',
      title: '고객 리텐션 개선 프로젝트',
      policyCategory: 'PROJECT_K',
      weight: 30,
    },
  })

  assert.equal(diagnostic.severity, 'info')
  assert.equal(diagnostic.issues.length, 0)
})

run('personal daily work without organization link is allowed', () => {
  const diagnostic = validatePersonalKpiMboCategory2026({
    item: {
      id: 'daily-allowed',
      title: '정기 리포트 운영',
      policyCategory: 'DAILY_WORK',
      weight: 20,
    },
  })

  assert.equal(diagnostic.severity, 'info')
  assert.equal(diagnostic.issues.length, 0)
})

run('daily work linked to reflected organization KPI is flagged as duplicate risk', () => {
  const diagnostic = validatePersonalKpiMboCategory2026({
    item: {
      id: 'daily-linked',
      title: '본부 매출 성장 운영',
      policyCategory: 'DAILY_WORK',
      linkedOrgKpiId: 'division-kpi-1',
      linkedOrgKpi: divisionOrgKpi(),
    },
  })

  assert.equal(diagnostic.canSubmit, false)
  assert.equal(diagnostic.issues.some((issue) => issue.code === 'DAILY_WORK_DUPLICATES_ORG_GOAL'), true)
})

run('summary aggregates policy issues without mutating live workflow code', () => {
  const summary = summarizeMboPolicyIssues2026({
    items: [
      {
        id: 'org-goal',
        title: '본부 매출 성장',
        policyCategory: 'ORG_GOAL',
        linkedOrgKpiId: 'division-kpi-1',
        linkedOrgKpi: divisionOrgKpi(),
      },
      {
        id: 'daily-duplicate',
        title: '본부 매출 성장',
        policyCategory: 'DAILY_WORK',
      },
    ],
  })

  assert.equal(summary.canSubmit, false)
  assert.equal(summary.issues.some((issue) => issue.code === 'DAILY_WORK_DUPLICATES_ORG_GOAL'), true)

  const personalWorkflowSource = read('src/server/personal-kpi-workflow.ts')
  const orgWorkflowSource = read('src/server/org-kpi-workflow.ts')
  assert.equal(personalWorkflowSource.includes('kpi-alignment-policy-2026'), false)
  assert.equal(orgWorkflowSource.includes('kpi-alignment-policy-2026'), false)
})

console.log('2026 KPI alignment and MBO policy tests completed')
