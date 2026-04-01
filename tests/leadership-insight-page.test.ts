/* eslint-disable @typescript-eslint/no-require-imports */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import Module from 'node:module'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const moduleLoader = Module as unknown as {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown
  ) => string
}
const originalResolveFilename = moduleLoader._resolveFilename
moduleLoader._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.resolve(process.cwd(), 'src', request.slice(2))
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const {
  LEADERSHIP_INSIGHT_ROUTE,
  buildLeadershipInsightPageModel,
} = require('../src/lib/leadership-insight') as typeof import('../src/lib/leadership-insight')
const LeadershipDiagnosisPage =
  require('../src/app/solutions/leadership-diagnosis/page').default as typeof import('../src/app/solutions/leadership-diagnosis/page').default

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function run(name: string, fn: () => Promise<void> | void) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`)
    })
    .catch((error) => {
      console.error(`FAIL ${name}`)
      throw error
    })
}

async function main() {
  await run('leadership diagnosis route renders hero, core sections, and primary CTAs', async () => {
    const element = LeadershipDiagnosisPage()
    const html = renderToStaticMarkup(element)

    assert.equal(existsSync(path.resolve(process.cwd(), 'src/app/solutions/leadership-diagnosis/page.tsx')), true)
    assert.equal(LEADERSHIP_INSIGHT_ROUTE, '/solutions/leadership-diagnosis')
    assert.equal(html.includes('리더십 진단 인사이트 패키지'), true)
    assert.equal(html.includes('소개서 및 보고서 샘플 보기'), true)
    assert.equal(html.includes('상담 문의'), true)
    assert.equal(html.includes('서비스 홈페이지'), true)
  })

  await run('leadership diagnosis page includes package, sample insights, and process structure', async () => {
    const element = LeadershipDiagnosisPage()
    const html = renderToStaticMarkup(element)
    const model = buildLeadershipInsightPageModel()

    assert.equal(model.packageItems.length, 6)
    assert.equal(model.reportSamples.length, 6)
    assert.equal(model.processSteps.length, 5)
    assert.equal(html.includes('패키지 구성'), true)
    assert.equal(html.includes('보고서 샘플과 인사이트 유형을 한눈에 볼 수 있습니다'), true)
    assert.equal(html.includes('진행 프로세스'), true)
    assert.equal(html.includes('진단 문항 설계'), true)
    assert.equal(html.includes('개인 보고서'), true)
    assert.equal(html.includes('HR 대상 디브리핑'), true)
  })

  await run('leadership diagnosis CTA model supports active external links and safe disabled fallbacks', () => {
    const disabledModel = buildLeadershipInsightPageModel({
      contactUrl: null,
      homepageUrl: null,
      sampleDocUrl: null,
    })
    const enabledModel = buildLeadershipInsightPageModel({
      contactUrl: 'https://example.com/contact',
      homepageUrl: 'https://example.com',
      sampleDocUrl: 'https://example.com/sample.pdf',
    })

    assert.equal(disabledModel.links.contact.href, null)
    assert.equal(disabledModel.links.homepage.href, null)
    assert.equal(disabledModel.links.sampleDoc.href, null)
    assert.equal(enabledModel.links.contact.href, 'https://example.com/contact')
    assert.equal(enabledModel.links.contact.external, true)
    assert.equal(enabledModel.links.homepage.href, 'https://example.com')
    assert.equal(enabledModel.links.sampleDoc.href, 'https://example.com/sample.pdf')
  })

  await run('leadership diagnosis page keeps responsive CTA layout and safe external-link attributes', () => {
    const pageSource = read('src/app/solutions/leadership-diagnosis/page.tsx')
    const samplesSource = read('src/components/marketing/LeadershipInsightSamples.tsx')

    assert.equal(pageSource.includes('sm:flex-row'), true)
    assert.equal(pageSource.includes('lg:grid-cols'), true)
    assert.equal(pageSource.includes('target="_blank"'), true)
    assert.equal(pageSource.includes('rel="noreferrer noopener"'), true)
    assert.equal(samplesSource.includes('target="_blank"'), true)
    assert.equal(samplesSource.includes('rel="noreferrer noopener"'), true)
  })

  await run('leadership diagnosis page avoids raw English placeholders in user-facing Korean copy', async () => {
    const element = LeadershipDiagnosisPage()
    const html = renderToStaticMarkup(element).toLowerCase()

    assert.equal(html.includes('lorem ipsum'), false)
    assert.equal(html.includes('placeholder'), false)
    assert.equal(html.includes('todo'), false)
  })

  console.log('Leadership insight page tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
