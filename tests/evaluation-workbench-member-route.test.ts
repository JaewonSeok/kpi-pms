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
    // conditional redirect: SELF eval found in cycle → /evaluation/self/[id]; runs after auth
    assert.equal(workbenchPageSource.includes('redirect('), true)
    assert.equal(workbenchPageSource.includes('/evaluation/self/'), true)
    assert.equal(workbenchPageSource.includes("evalStage === 'SELF'"), true)
  })

  await run('member workspace contains the required performance input labels', () => {
    const requiredLabels = [
      '자기평가',
      '자기평가 시작',
      '업적평가(MBO)',
      'isPrivilegedPreview',
      '관리자 권한에서는 팀원 입력 화면을 preview-only로 확인합니다.',
      '확정된 KPI가 없거나 자기평가 기간이 아니어서 자기평가를 시작할 수 없습니다.',
    ]

    for (const label of requiredLabels) {
      assert.equal(memberInputSource.includes(label), true, `${label} should render in the member workspace`)
    }

    // disabled dummy buttons and preview-only banners removed
    assert.equal(memberInputSource.includes('임시저장'), false)
    assert.equal(memberInputSource.includes('preview only / 공식 저장 없음'), false)
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
    assert.equal(memberInputSource.includes('관리자 권한에서는 팀원 입력 화면을 preview-only로 확인합니다.'), true)
    assert.equal(memberInputSource.includes('isPrivilegedPreview'), true)
    // removed: disabled dummy 임시저장/제출 buttons and totalScore write guard comments
    assert.equal(memberInputSource.includes('임시저장'), false)
    assert.equal(memberInputSource.includes('저장/제출 callback을 새로 연결하지 않았습니다.'), false)
    assert.equal(memberInputSource.includes('Evaluation.totalScore 및 Evaluation.gradeId 쓰기는 수행하지 않습니다.'), false)
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
