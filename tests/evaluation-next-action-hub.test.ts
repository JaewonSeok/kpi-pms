import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { buildEvaluationNextActionHub } from '../src/lib/evaluation-next-action-hub'

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

function routeExists(href: string) {
  const pathname = new URL(href, 'https://kpi-pms.local').pathname
  return [
    path.resolve(process.cwd(), `src/app${pathname}/page.tsx`),
    path.resolve(process.cwd(), `src/app/(main)${pathname}/page.tsx`),
  ].some((candidate) => existsSync(candidate))
}

run('member next action hub exposes core evaluation work without admin operations', () => {
  const hub = buildEvaluationNextActionHub('ROLE_MEMBER')
  const titles = hub.actions.map((action) => action.title)

  for (const title of ['KPI 작성', '업적평가 작성', '360 다면평가 응답', '리더십 진단 응답', '360 결과 보기', '리더십 진단 결과 보기']) {
    assert.equal(titles.includes(title), true, `${title} should be visible`)
  }

  assert.equal(titles.includes('전체 평가 운영'), false)
  assert.equal(hub.summary.find((item) => item.label === '관리자 운영 항목')?.value, '0')
})

run('admin next action hub includes lower-role actions plus operations cards', () => {
  const hub = buildEvaluationNextActionHub('ROLE_ADMIN')
  const titles = hub.actions.map((action) => action.title)

  for (const title of ['KPI 작성', '팀원 업적평가', '본부 평가 조회', '전체 평가 운영', '대상자·평가자 매칭 관리']) {
    assert.equal(titles.includes(title), true, `${title} should be visible`)
  }

  assert.notEqual(hub.summary.find((item) => item.label === '관리자 운영 항목')?.value, '0')
})

run('next action hub links only to implemented existing routes', () => {
  const roles = ['ROLE_MEMBER', 'ROLE_TEAM_LEADER', 'ROLE_DIV_HEAD', 'ROLE_ADMIN']
  const hrefs = new Set(roles.flatMap((role) => buildEvaluationNextActionHub(role).actions.map((action) => action.href)))

  for (const href of hrefs) {
    assert.equal(routeExists(href), true, `${href} should resolve to an existing page`)
  }
})

run('dashboard renders the evaluation progress home section', () => {
  const source = read('src/components/dashboard/DashboardPageShell.tsx')

  assert.equal(source.includes('평가 진행 홈'), true)
  assert.equal(source.includes('지금 해야 할 평가 작업을 한 화면에서 확인하세요.'), true)
  assert.equal(source.includes('화면 이동 전용'), true)
  assert.equal(source.includes('buildEvaluationNextActionHub(data.role)'), true)
})

run('next action hub avoids forbidden write and demo language', () => {
  const source = [
    read('src/lib/evaluation-next-action-hub.ts'),
    read('src/components/dashboard/DashboardPageShell.tsx'),
  ].join('\n')
  const text = (...parts: string[]) => parts.join('')
  const forbidden = [
    text('발', '행'),
    text('확', '정'),
    text('메일', '발송'),
    text('점수', '반영'),
    text('결과', '반영'),
    text('공식 점수', ' 자동 반영'),
    text('공식 등급', ' 자동 산정'),
    text('승진', ' 추천'),
    text('보상', ' 추천'),
    text('demo', '=ceo'),
    text('Ceo', 'Demo'),
    text('NEXT_PUBLIC', '_CEO_DEMO_MODE'),
    text('PDF', ' 다운로드'),
    text('워드', '클라우드'),
  ]

  for (const text of forbidden) {
    assert.equal(source.includes(text), false, `${text} should not be introduced`)
  }
})

console.log('Evaluation next action hub tests completed')
