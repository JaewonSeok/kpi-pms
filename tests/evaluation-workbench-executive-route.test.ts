import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

async function run(name: string, fn: () => void | Promise<void>) {
  await fn()
  console.log(`PASS ${name}`)
}

async function main() {
  const workbenchPageSource = read('src/app/(main)/evaluation/workbench/page.tsx')
  const executiveSource = read('src/components/evaluation/performance/PerformanceExecutiveAdjustmentWorkspace.tsx')
  const memberSource = read('src/components/evaluation/performance/PerformanceMemberInputWorkspace.tsx')
  const leaderSource = read('src/components/evaluation/performance/PerformanceLeaderReviewWorkspace.tsx')
  const navigationSource = read('src/lib/navigation.ts')

  await run('/evaluation/workbench exposes the executive performance adjustment view', () => {
    assert.equal(workbenchPageSource.includes('PerformanceMemberInputWorkspace'), true)
    assert.equal(workbenchPageSource.includes('PerformanceLeaderReviewWorkspace'), true)
    assert.equal(workbenchPageSource.includes('PerformanceExecutiveAdjustmentWorkspace'), true)
    assert.equal(workbenchPageSource.includes("type WorkbenchView = 'member' | 'leader' | 'executive'"), true)
    assert.equal(workbenchPageSource.includes('EXECUTIVE_ADJUSTMENT_PREVIEW_ROLES'), true)
    assert.equal(workbenchPageSource.includes("'ROLE_DIV_HEAD'"), true)
    assert.equal(workbenchPageSource.includes("'ROLE_CEO'"), true)
    assert.equal(workbenchPageSource.includes("'ROLE_ADMIN'"), true)
    assert.equal(workbenchPageSource.includes("view: 'executive'"), true)
    assert.equal(workbenchPageSource.includes("activeView === 'executive'"), true)
  })

  await run('executive workspace contains PPT parity labels for HQ review and grade adjustment', () => {
    const requiredLabels = [
      '팀원/팀장 평가 현황',
      '전체 인원',
      '1차 등급 확정',
      '평균 점수',
      '평균 1차 등급',
      '등급 분포',
      '팀원',
      '팀장',
      '조직목표 점수',
      '개인목표 점수',
      '최종 점수',
      '1차 등급',
      '등급 조정',
      '조정 사유',
      '등급 변경 이력',
      '조직목표 평가',
      '개인목표 평가',
      '등급 조정 저장',
    ]

    for (const label of requiredLabels) {
      assert.equal(executiveSource.includes(label), true, `${label} should render in the executive workspace`)
    }
  })

  await run('executive workspace hides HR and leader-only wording', () => {
    const forbiddenLabels = [
      '평가 워크벤치 미리보기',
      '업적평가 모니터링',
      'HR 점수 입력',
      '팀장 가감점 사유',
      '팀장 피드백',
      '증빙자료 링크',
    ]

    for (const label of forbiddenLabels) {
      assert.equal(executiveSource.includes(label), false, `${label} should not render in the executive workspace`)
    }
  })

  await run('executive workspace is data-driven and keeps official grade writes disabled', () => {
    const forbiddenFakeNames = ['김세희', '박지훈', '이수민']

    for (const name of forbiddenFakeNames) {
      assert.equal(executiveSource.includes(name), false, `${name} should not be hard-coded in executive workspace`)
    }

    assert.equal(executiveSource.includes('workspaceData.evaluations'), true)
    assert.equal(executiveSource.includes('workspaceData.selected'), true)
    assert.equal(executiveSource.includes('확인 필요'), true)
    assert.equal(executiveSource.includes('등급 데이터 없음'), true)
    assert.equal(executiveSource.includes('등급 조정 저장'), true)
    assert.equal(executiveSource.includes('disabled'), true)
    assert.equal(executiveSource.includes('Evaluation.totalScore / gradeId 저장 없음'), true)
    assert.equal(executiveSource.includes('공식 점수/등급 write 없음'), true)
  })

  await run('member and leader workspaces remain wired and role-separated', () => {
    assert.equal(memberSource.includes('업적평가 입력'), true)
    assert.equal(memberSource.includes('개인목표 상세'), true)
    assert.equal(memberSource.includes('팀장 가감점'), false)
    assert.equal(leaderSource.includes('팀원 업적평가'), true)
    assert.equal(leaderSource.includes('팀장 피드백'), true)
    assert.equal(leaderSource.includes('등급 조정 저장'), false)
  })

  await run('navigation labels use 업적평가 운영 and do not expose legacy wording', () => {
    assert.equal(navigationSource.includes("label: '업적평가 모니터링'"), true)
    assert.equal(navigationSource.includes("href: '/evaluation/performance'"), true)
    assert.equal(navigationSource.includes("label: '업적평가'"), true)
    assert.equal(navigationSource.includes("href: '/evaluation/workbench'"), true)
    assert.equal(navigationSource.includes('HR 평가 운영 대시보드'), false)
    assert.equal(navigationSource.includes('평가 워크벤치 미리보기'), false)
  })

  console.log('Evaluation workbench executive route tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
