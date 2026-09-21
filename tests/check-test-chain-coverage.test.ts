import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  collectChainReferencedFiles,
  computeUnapproved,
  readExemptList,
} from '../scripts/lib/test-chain-coverage'

async function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function writeTempFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, content, 'utf8')
  return filePath
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-coverage-test-'))

  try {
    await run('readExemptList: 인라인 주석이 잘린다', () => {
      const filePath = writeTempFile(tmpDir, 'exempt-inline.txt', 'a.test.ts # 분류\n')
      const result = readExemptList(filePath)
      assert.equal(result.has('a.test.ts'), true)
      assert.equal(result.has('a.test.ts # 분류'), false)
    })

    await run('readExemptList: 줄 전체 주석(#로 시작)이 무시된다', () => {
      const filePath = writeTempFile(
        tmpDir,
        'exempt-whole-line-comment.txt',
        '# 이 줄은 주석이다\na.test.ts\n'
      )
      const result = readExemptList(filePath)
      assert.equal(result.size, 1)
      assert.equal(result.has('a.test.ts'), true)
    })

    await run('readExemptList: 빈 줄이 무시된다', () => {
      const filePath = writeTempFile(tmpDir, 'exempt-blank-line.txt', 'a.test.ts\n\n\nb.test.ts\n')
      const result = readExemptList(filePath)
      assert.equal(result.size, 2)
      assert.equal(result.has('a.test.ts'), true)
      assert.equal(result.has('b.test.ts'), true)
    })

    await run('readExemptList: 앞뒤 공백이 trim 된다', () => {
      const filePath = writeTempFile(tmpDir, 'exempt-whitespace.txt', '   a.test.ts   \n')
      const result = readExemptList(filePath)
      assert.equal(result.has('a.test.ts'), true)
      assert.equal(result.has('   a.test.ts   '), false)
    })

    await run('readExemptList: 파일이 없으면 빈 Set 이다', () => {
      const filePath = path.join(tmpDir, 'does-not-exist.txt')
      const result = readExemptList(filePath)
      assert.equal(result.size, 0)
    })

    await run('collectChainReferencedFiles: test: 로 시작하는 키만 읽는다', () => {
      const filePath = writeTempFile(
        tmpDir,
        'package-key-filter.json',
        JSON.stringify({
          scripts: {
            build: 'ts-node tests/should-not-count.test.ts',
            lint: 'eslint',
            'test:foo': 'ts-node tests/a.test.ts',
          },
        })
      )
      const result = collectChainReferencedFiles(filePath)
      assert.equal(result.has('a.test.ts'), true)
      assert.equal(result.has('should-not-count.test.ts'), false)
    })

    await run('collectChainReferencedFiles: 한 스크립트에 여러 파일이 있으면 전부 잡는다', () => {
      const filePath = writeTempFile(
        tmpDir,
        'package-multi-file.json',
        JSON.stringify({
          scripts: {
            'test:foo': 'ts-node tests/a.test.ts && ts-node tests/b.test.ts',
          },
        })
      )
      const result = collectChainReferencedFiles(filePath)
      assert.equal(result.has('a.test.ts'), true)
      assert.equal(result.has('b.test.ts'), true)
      assert.equal(result.size, 2)
    })

    await run('collectChainReferencedFiles: && 로 이어진 명령에서도 잡는다', () => {
      const filePath = writeTempFile(
        tmpDir,
        'package-chained-command.json',
        JSON.stringify({
          scripts: {
            'test:chain': 'npm run test:x && npm run test:y',
            'test:x': 'ts-node tests/c.test.ts',
            'test:y': 'ts-node tests/d.test.ts',
          },
        })
      )
      const result = collectChainReferencedFiles(filePath)
      assert.equal(result.has('c.test.ts'), true)
      assert.equal(result.has('d.test.ts'), true)
    })

    await run('computeUnapproved: 체인 밖 + 면제 목록 밖 → unapproved', () => {
      const { orphans, unapproved } = computeUnapproved(
        ['a.test.ts'],
        new Set<string>(),
        new Set<string>()
      )
      assert.equal(orphans.includes('a.test.ts'), true)
      assert.equal(unapproved.includes('a.test.ts'), true)
    })

    await run('computeUnapproved: 체인 밖 + 면제 목록 안 → unapproved 아님', () => {
      const { orphans, unapproved } = computeUnapproved(
        ['a.test.ts'],
        new Set<string>(),
        new Set(['a.test.ts'])
      )
      assert.equal(orphans.includes('a.test.ts'), true)
      assert.equal(unapproved.includes('a.test.ts'), false)
    })

    await run('computeUnapproved: 체인 안 → orphan 아님', () => {
      const { orphans, unapproved } = computeUnapproved(
        ['a.test.ts'],
        new Set(['a.test.ts']),
        new Set<string>()
      )
      assert.equal(orphans.includes('a.test.ts'), false)
      assert.equal(unapproved.includes('a.test.ts'), false)
    })

    console.log('check-test-chain-coverage tests completed')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
