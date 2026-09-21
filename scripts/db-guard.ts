import * as dotenv from 'dotenv'

dotenv.config()

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    fail('DATABASE_URL 미설정')
  }

  let url: URL
  try {
    url = new URL(databaseUrl)
  } catch {
    fail('DATABASE_URL 파싱 실패')
  }

  const host = url.hostname
  const target = url.port ? `${host}:${url.port}` : host

  if (LOCAL_HOSTS.has(host)) {
    console.log(`로컬 DB 확인: ${target}`)
    return
  }

  if (process.env.CONFIRM_PROD_DB === 'yes') {
    console.warn(`★ 운영 DB 대상으로 실행합니다: ${host}`)
    return
  }

  fail(`★ DATABASE_URL 이 로컬이 아닙니다: ${host}
이 명령은 데이터를 파괴할 수 있습니다.

로컬에서 실행하려면:
  $env:DATABASE_URL="postgresql://postgres:password@localhost:5433/kpi_pms"

운영에 실행해야 한다면(사람만, AI_SAFETY_GUARDRAILS 참조):
  $env:CONFIRM_PROD_DB="yes"`)
}

main()
