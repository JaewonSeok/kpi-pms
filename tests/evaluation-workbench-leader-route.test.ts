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
  const leaderSource = read('src/components/evaluation/performance/PerformanceLeaderReviewWorkspace.tsx')
  const memberSource = read('src/components/evaluation/performance/PerformanceMemberInputWorkspace.tsx')
  const navigationSource = read('src/lib/navigation.ts')

  await run('/evaluation/workbench exposes member and leader performance views', () => {
    assert.equal(workbenchPageSource.includes('PerformanceMemberInputWorkspace'), true)
    assert.equal(workbenchPageSource.includes('PerformanceLeaderReviewWorkspace'), true)
    assert.equal(workbenchPageSource.includes("type WorkbenchView = 'member' | 'leader' | 'executive'"), true)
    assert.equal(workbenchPageSource.includes('LEADER_REVIEW_PREVIEW_ROLES'), true)
    assert.equal(workbenchPageSource.includes("'ROLE_TEAM_LEADER'"), true)
    assert.equal(workbenchPageSource.includes("'ROLE_SECTION_CHIEF'"), true)
    assert.equal(workbenchPageSource.includes("'ROLE_DIV_HEAD'"), true)
    assert.equal(workbenchPageSource.includes("'ROLE_ADMIN'"), true)
    assert.equal(workbenchPageSource.includes("activeView === 'leader'"), true)
    assert.equal(workbenchPageSource.includes('EvaluationWorkbenchClient'), false)
  })

  await run('leader workspace contains PPT parity labels for team leader review', () => {
    const requiredLabels = [
      '팀원 업적평가',
      '전체 팀원',
      '제출 완료',
      '작성 중',
      '미제출',
      '팀명',
      '이름',
      '제출 상태',
      '자기평가 점수(구성원)',
      '자기평가 최종 점수',
      '팀원 평가 상세',
      '조직목표 평가',
      '개인목표 평가',
      '동일 조직목표/프로젝트 진행 인원',
      '참여자 비교',
      '팀장 가감점',
      '팀장 가감점 사유',
      '팀장 평가 점수',
      '팀장 피드백',
      '피드백 데이터 없음',
      '공식 점수/등급 저장은 수행하지 않습니다.',
      'Evaluation.totalScore / gradeId 저장 없음',
      '평가 저장',
    ]

    for (const label of requiredLabels) {
      assert.equal(leaderSource.includes(label), true, `${label} should render in the leader workspace`)
    }
  })

  await run('leader workspace is preview-only and does not expose official HR controls', () => {
    const forbiddenLabels = [
      '평가 워크벤치 미리보기',
      '업적평가 모니터링',
      'HR 점수 입력',
      '등급 조정 저장',
      '최종 확정',
    ]

    for (const label of forbiddenLabels) {
      assert.equal(leaderSource.includes(label), false, `${label} should not render in the leader workspace`)
    }

    assert.equal(leaderSource.includes('preview-only 화면입니다. 평가 저장 callback을 새로 연결하지 않았습니다.'), true)
    assert.equal(leaderSource.includes('Evaluation.totalScore 및 Evaluation.gradeId 쓰기는 수행하지 않습니다.'), true)
    assert.equal(leaderSource.includes('disabled'), true)
  })

  await run('leader workspace uses actual workbench data instead of PPT fake names', () => {
    const forbiddenFakeNames = ['김세희', '박지훈', '이수민']

    for (const name of forbiddenFakeNames) {
      assert.equal(leaderSource.includes(name), false, `${name} should not be hard-coded in leader workspace`)
    }

    assert.equal(leaderSource.includes('workspaceData.evaluations'), true)
    assert.equal(leaderSource.includes('workspaceData.selected'), true)
    assert.equal(leaderSource.includes('goalContext.collaborators'), true)
  })

  await run('member workspace remains the team member input screen', () => {
    assert.equal(memberSource.includes('업적평가 입력'), true)
    assert.equal(memberSource.includes('개인목표 상세'), true)
    assert.equal(memberSource.includes('Evaluation.totalScore 및 Evaluation.gradeId 쓰기는 수행하지 않습니다.'), true)
    assert.equal(memberSource.includes('팀장 가감점'), false)
  })

  await run('sidebar label remains 업적평가 without old preview wording', () => {
    assert.equal(navigationSource.includes("label: '업적평가'"), true)
    assert.equal(navigationSource.includes("href: '/evaluation/workbench'"), true)
    assert.equal(navigationSource.includes('평가 워크벤치 미리보기'), false)
  })

  console.log('Evaluation workbench leader route tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
