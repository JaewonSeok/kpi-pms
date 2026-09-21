import path from 'node:path'
import {
  collectTestFiles,
  collectChainReferencedFiles,
  readExemptList,
  computeUnapproved,
} from './lib/test-chain-coverage'

const repoRoot = path.resolve(__dirname, '..')
const testsDir = path.join(repoRoot, 'tests')
const packageJsonPath = path.join(repoRoot, 'package.json')
const exemptListPath = path.join(testsDir, '.chain-exempt.txt')

function main() {
  const allTestFiles = collectTestFiles(testsDir)
  const referenced = collectChainReferencedFiles(packageJsonPath)
  const exempt = readExemptList(exemptListPath)

  const { orphans, unapproved } = computeUnapproved(allTestFiles, referenced, exempt)

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
