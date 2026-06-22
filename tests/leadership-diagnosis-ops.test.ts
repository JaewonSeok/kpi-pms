import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function main() {
  await run('leadership diagnosis operations dashboard is wired to admin route', () => {
    const componentPath = 'src/components/evaluation/upward/LeadershipDiagnosisOpsDashboard.tsx'
    const client = read('src/components/evaluation/upward/UpwardReviewWorkspaceClient.tsx')
    const route = read('src/app/(main)/evaluation/upward/admin/page.tsx')

    assert.equal(existsSync(path.resolve(process.cwd(), componentPath)), true)
    assert.equal(client.includes("import { LeadershipDiagnosisOpsDashboard } from './LeadershipDiagnosisOpsDashboard'"), true)
    assert.equal(client.includes('<LeadershipDiagnosisOpsDashboard data={props.data} admin={adminData} />'), true)
    assert.equal(route.includes("mode: 'admin'"), true)
    assert.equal(route.includes('/evaluation/upward/admin'), true)
  })

  await run('leadership diagnosis operations dashboard exposes PPT-style monitoring sections', () => {
    const source = read('src/components/evaluation/upward/LeadershipDiagnosisOpsDashboard.tsx')

    for (const text of [
      '리더십 진단 운영',
      '진단 기간, 대상자, 응답 현황, 결과 준비 상태를 확인합니다.',
      '전체 대상자',
      '응답 완료',
      '작성 중',
      '미응답',
      '결과 준비',
      '결과 확인 가능',
      '응답 기준 충족',
      '진행률',
      '대상자별 현황',
      '본부별 현황',
      '팀별 현황',
      '대상자',
      '소속',
      '직책',
      '응답 현황',
      '카테고리 현황',
      '리마인드 준비',
      '결과 공유 준비',
      '결과 보기',
    ]) {
      assert.equal(source.includes(text), true, `${text} should be present`)
    }
  })

  await run('leadership diagnosis operations dashboard keeps official-score and readiness safety copy', () => {
    const source = read('src/components/evaluation/upward/LeadershipDiagnosisOpsDashboard.tsx')

    assert.equal(source.includes('공식 평가 점수나 등급을 자동 산정하지 않습니다.'), true)
    assert.equal(source.includes('AI 코칭/결과 요약은 참고용이며 공식 반영은 별도 절차가 필요합니다.'), true)
    assert.equal(source.includes('실제 메일 발송이나 결과 공개 없이'), true)
    assert.equal(source.includes('운영 설정과 실제 발송은 승인된 운영 절차에서만 진행합니다.'), true)
    assert.equal(source.includes('응답 기준 충족 후 결과를 확인할 수 있습니다.'), true)
  })

  await run('leadership diagnosis operations dashboard avoids unsafe user-facing copy and direct side effects', () => {
    const source = read('src/components/evaluation/upward/LeadershipDiagnosisOpsDashboard.tsx')

    for (const forbidden of [
      'Upward Review',
      'leadership diagnosis',
      'Reviewer Nomination',
      'CYCLE',
      'ROUND',
      'SELF',
      'PEER',
      'SUPERVISOR',
      'SUBORDINATE',
      'ANONYMOUS',
      'FULL',
      'backend',
      'callback',
      'API 연결 필요',
      'NEEDS_BACKEND_FOLLOWUP',
      'PDF 다운로드',
      'PDF 열기',
      '공식 등급 자동 산정',
      '공식 점수 자동 반영',
      '평가 점수 자동 반영',
      '승진 추천',
      '보상 추천',
      'Too small',
      '워드클라우드',
      'wordcloud',
    ]) {
      assert.equal(source.includes(forbidden), false, `${forbidden} should not be user-facing in ops dashboard`)
    }

    assert.equal(source.includes('fetch('), false)
    assert.equal(source.includes('OpenAI'), false)
    assert.equal(source.includes('openai'), false)
    assert.equal(source.includes('prisma'), false)
    assert.equal(source.includes('Evaluation.totalScore'), false)
    assert.equal(source.includes('gradeId'), false)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
