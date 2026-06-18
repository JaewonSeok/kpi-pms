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
  const performancePageSource = read('src/app/(main)/evaluation/performance/page.tsx')
  const hrOpsSource = read('src/components/evaluation/performance/PerformanceHrOpsDashboard.tsx')
  const navigationSource = read('src/lib/navigation.ts')

  await run('/evaluation/performance renders the HR performance operations dashboard', () => {
    assert.equal(performancePageSource.includes('requireProtectedPageSession'), true)
    assert.equal(performancePageSource.includes('getEvaluationWorkbenchPageData'), true)
    assert.equal(performancePageSource.includes('PerformanceHrOpsDashboard'), true)
    assert.equal(performancePageSource.includes('EvaluationWorkbenchClient'), false)
    assert.equal(performancePageSource.includes('presentationMode="performance-dashboard"'), false)
    assert.equal(performancePageSource.includes("route: '/evaluation/performance'"), true)
    assert.equal(performancePageSource.includes("pathname: '/evaluation/performance'"), true)
  })

  await run('HR operations dashboard contains PPT parity labels', () => {
    const requiredLabels = [
      '업적평가 운영 현황',
      '전체 대상자',
      '팀원 자기평가 제출',
      '팀장 평가 완료',
      'HR 점수 반영 완료',
      '최종 확정 완료',
      '미확정',
      '본부별 현황',
      '대상자',
      '단계별 현황',
      '공지사항',
      '평가 일정',
      '자기평가 기간',
      '팀장 평가 기간',
      'HR 점수 반영 기간',
      '최종 확정 기간',
    ]

    for (const label of requiredLabels) {
      assert.equal(hrOpsSource.includes(label), true, `${label} should render in HR operations dashboard`)
    }
  })

  await run('HR target detail contains required detail, score, and preview-only labels', () => {
    const requiredLabels = [
      '평가 진행 상태',
      '평가 요약',
      '조직목표 평가',
      '개인목표 평가',
      '계산 결과',
      'HR 점수 입력',
      '최종 반영 점수',
      '임시 저장',
      '최종 확정',
      'preview only',
      '공식 저장 없음',
      'Evaluation.totalScore / gradeId 저장 없음',
      'official scoring/grade activation 없음',
    ]

    for (const label of requiredLabels) {
      assert.equal(hrOpsSource.includes(label), true, `${label} should render in HR target detail`)
    }
  })

  await run('HR operations dashboard stays data-driven and avoids fake PPT values', () => {
    const forbiddenFakeValues = [
      '248명',
      '242명',
      '2021001',
      '2024.05.01',
      '2024.06.30',
      '김세희',
      '박지훈',
      '이수민',
      '95.00점',
      '65.25점',
    ]

    for (const value of forbiddenFakeValues) {
      assert.equal(hrOpsSource.includes(value), false, `${value} should not be hard-coded`)
    }

    assert.equal(hrOpsSource.includes('buildTargetProgress'), true)
    assert.equal(hrOpsSource.includes('dashboardData.evaluations'), true)
    assert.equal(hrOpsSource.includes('확인 필요'), true)
    assert.equal(hrOpsSource.includes('공지사항 데이터 없음'), true)
    assert.equal(hrOpsSource.includes('일정 확인 필요'), true)
  })

  await run('write-like HR operations actions are disabled preview-only controls', () => {
    assert.equal(hrOpsSource.includes('<button type="button" disabled'), true)
    assert.equal(hrOpsSource.includes('실제 임시 저장 / 최종 확정 callback은 연결하지 않았습니다.'), true)
    assert.equal(hrOpsSource.includes('onClick={'), true, 'row selection may use client state only')
    assert.equal(hrOpsSource.includes('Evaluation.totalScore'), true)
    assert.equal(hrOpsSource.includes('Evaluation.gradeId write'), false)
    assert.equal(hrOpsSource.includes('공식 점수 반영'), false)
    assert.equal(hrOpsSource.includes('공식 등급 반영'), false)
  })

  await run('navigation keeps performance labels and hides legacy wording', () => {
    assert.equal(navigationSource.includes("label: '업적평가 운영'"), true)
    assert.equal(navigationSource.includes("href: '/evaluation/performance'"), true)
    assert.equal(navigationSource.includes("label: '업적평가'"), true)
    assert.equal(navigationSource.includes("href: '/evaluation/workbench'"), true)
    assert.equal(navigationSource.includes('HR 평가 운영 대시보드'), false)
    assert.equal(navigationSource.includes('평가 워크벤치 미리보기'), false)
  })

  console.log('Evaluation HR operations route tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
