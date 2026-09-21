import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const REPO_ROOT = process.cwd()
const TS_NODE_BIN = path.resolve(REPO_ROOT, 'node_modules/ts-node/dist/bin.js')
const GUARD_SCRIPT = path.resolve(REPO_ROOT, 'scripts/db-guard.ts')

function runGuard(overrides: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }

  const result = spawnSync(process.execPath, [TS_NODE_BIN, '-P', 'tsconfig.seed.json', GUARD_SCRIPT], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
  })

  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

async function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('localhost URL → exit 0', () => {
    const { status, stdout } = runGuard({
      DATABASE_URL: 'postgresql://postgres:password@localhost:5433/kpi_pms',
      CONFIRM_PROD_DB: undefined,
    })
    assert.equal(status, 0)
    assert.match(stdout, /로컬 DB 확인: localhost:5433/)
  })

  await run('운영(Supabase) 호스트 URL → exit 1', () => {
    const { status, stderr } = runGuard({
      DATABASE_URL: 'postgresql://postgres:x@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
      CONFIRM_PROD_DB: undefined,
    })
    assert.equal(status, 1)
    assert.match(stderr, /DATABASE_URL 이 로컬이 아닙니다/)
  })

  await run('운영 호스트 URL + CONFIRM_PROD_DB=yes → exit 0', () => {
    const { status, stderr } = runGuard({
      DATABASE_URL: 'postgresql://postgres:x@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
      CONFIRM_PROD_DB: 'yes',
    })
    assert.equal(status, 0)
    assert.match(stderr, /운영 DB 대상으로 실행합니다/)
  })

  await run('DATABASE_URL 미설정 → exit 1', () => {
    // dotenv 는 이미 존재하는 키를 덮어쓰지 않으므로, 빈 문자열로 미리
    // 채워 .env 의 실제 값이 주입되는 것을 막는다 (미설정 상태를 재현).
    const { status, stderr } = runGuard({
      DATABASE_URL: '',
      CONFIRM_PROD_DB: undefined,
    })
    assert.equal(status, 1)
    assert.match(stderr, /DATABASE_URL 미설정/)
  })

  await run('파싱 불가한 DATABASE_URL → exit 1', () => {
    const { status, stderr } = runGuard({
      DATABASE_URL: 'not-a-url',
      CONFIRM_PROD_DB: undefined,
    })
    assert.equal(status, 1)
    assert.match(stderr, /DATABASE_URL 파싱 실패/)
  })

  console.log('db-guard tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
