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
  const memberInputSource = read('src/components/evaluation/performance/PerformanceMemberInputWorkspace.tsx')
  const navigationSource = read('src/lib/navigation.ts')

  await run('/evaluation/workbench renders the member performance input workspace', () => {
    assert.equal(workbenchPageSource.includes('requireProtectedPageSession'), true)
    assert.equal(workbenchPageSource.includes('getEvaluationWorkbenchPageData'), true)
    assert.equal(workbenchPageSource.includes('PerformanceMemberInputWorkspace'), true)
    assert.equal(workbenchPageSource.includes('EvaluationWorkbenchClient'), false)
    assert.equal(workbenchPageSource.includes('presentationMode="workbench-pilot"'), false)
    assert.equal(workbenchPageSource.includes('redirect('), false)
  })

  await run('member workspace contains the required performance input labels', () => {
    const requiredLabels = [
      '업적평가 입력',
      '전체 목표',
      '제출 완료',
      '작성 중',
      '미작성',
      '개인목표',
      '수행 계획',
      '비중(%)',
      '자기평가',
      '증빙자료',
      '진행 프로젝트명',
      '개인목표 상세',
      '수행 결과',
      '자기평가 점수',
      '자기평가 의견',
      '증빙자료 링크',
    ]

    for (const label of requiredLabels) {
      assert.equal(memberInputSource.includes(label), true, `${label} should render in the member workspace`)
    }
  })

  await run('member workspace keeps leader HR scoring controls out of the member screen', () => {
    const forbiddenLabels = [
      '평가 워크벤치 미리보기',
      '팀원 평가 상세',
      '팀장 가감점',
      '등급 조정',
      'HR 점수 입력',
      '업적평가 모니터링',
    ]

    for (const label of forbiddenLabels) {
      assert.equal(memberInputSource.includes(label), false, `${label} should not render in the member workspace`)
    }
  })

  await run('admin and master roles can preview the member screen without enabling writes', () => {
    assert.equal(memberInputSource.includes('팀원 업적평가 입력'), true)
    assert.equal(memberInputSource.includes('팀장 평가 화면'), true)
    assert.equal(memberInputSource.includes('본부장 평가 현황'), true)
    assert.equal(memberInputSource.includes('아직 구현 전'), true)
    assert.equal(memberInputSource.includes('관리자 권한에서는 팀원 입력 화면을 preview-only로 확인합니다.'), true)
    assert.equal(memberInputSource.includes('저장/제출 callback을 새로 연결하지 않았습니다.'), true)
    assert.equal(memberInputSource.includes('Evaluation.totalScore 및 Evaluation.gradeId 쓰기는 수행하지 않습니다.'), true)
  })

  await run('sidebar label exposes workbench route as 업적평가', () => {
    assert.equal(navigationSource.includes("label: '업적평가'"), true)
    assert.equal(navigationSource.includes("href: '/evaluation/workbench'"), true)
    assert.equal(navigationSource.includes('평가 워크벤치 미리보기'), false)
  })

  console.log('Evaluation workbench member route tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
