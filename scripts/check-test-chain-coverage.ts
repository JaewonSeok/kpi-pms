import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')
const testsDir = path.join(repoRoot, 'tests')
const packageJsonPath = path.join(repoRoot, 'package.json')
const exemptListPath = path.join(testsDir, '.chain-exempt.txt')

function collectTestFiles(): string[] {
  return fs
    .readdirSync(testsDir)
    .filter((name) => name.endsWith('.test.ts'))
    .sort()
}

function collectChainReferencedFiles(): Set<string> {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    scripts: Record<string, string>
  }
  const referenced = new Set<string>()
  const pattern = /tests\/([A-Za-z0-9._-]+\.test\.ts)/g

  for (const [key, command] of Object.entries(pkg.scripts)) {
    if (!key.startsWith('test:')) continue
    let match: RegExpExecArray | null
    while ((match = pattern.exec(command))) {
      referenced.add(match[1])
    }
  }

  return referenced
}

function readExemptList(): Set<string> {
  if (!fs.existsSync(exemptListPath)) return new Set()
  return new Set(
    fs
      .readFileSync(exemptListPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
  )
}

function main() {
  const allTestFiles = collectTestFiles()
  const referenced = collectChainReferencedFiles()
  const exempt = readExemptList()

  const orphans = allTestFiles.filter((file) => !referenced.has(file))
  const unapproved = orphans.filter((file) => !exempt.has(file))

  console.log(`tests/ 전체 *.test.ts: ${allTestFiles.length}개`)
  console.log(`package.json test:* 체인이 실행하는 파일: ${referenced.size}개`)
  console.log(`체인 미등록(고아): ${orphans.length}개`)
  console.log(`tests/.chain-exempt.txt 등록: ${exempt.size}개`)

  if (unapproved.length > 0) {
    console.error('')
    console.error('체인에도 없고 tests/.chain-exempt.txt 부채 목록에도 없는 테스트 파일:')
    for (const file of unapproved) console.error(`  - ${file}`)
    console.error('')
    console.error('새 테스트를 추가했다면 test:* 스크립트에 연결하거나,')
    console.error('의도적으로 보류한다면 사유와 함께 tests/.chain-exempt.txt 에 등록할 것.')
    process.exit(1)
  }

  console.log('체인 미등록 테스트는 전부 tests/.chain-exempt.txt 부채 목록에 등록돼 있다.')
}

main()
