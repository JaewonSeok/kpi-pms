import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { readAiAssistEnv } from '../src/lib/ai-env'
import {
  applyEvaluationAssistResult,
  getEvaluationAssistDisabledReason,
  normalizeEvaluationAssistResult,
} from '../src/lib/evaluation-ai-assist'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function readProjectFile(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function collectSourceEntries(relativeDir: string): Array<{ relativePath: string; source: string }> {
  const baseDir = path.resolve(process.cwd(), relativeDir)
  const collected: Array<{ relativePath: string; source: string }> = []

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir)) {
      const nextPath = path.join(currentDir, entry)
      const stats = statSync(nextPath)
      if (stats.isDirectory()) {
        walk(nextPath)
        continue
      }

      if (/\.(ts|tsx)$/.test(nextPath)) {
        collected.push({
          relativePath: path.relative(process.cwd(), nextPath).replace(/\\/g, '/'),
          source: readFileSync(nextPath, 'utf8'),
        })
      }
    }
  }

  walk(baseDir)
  return collected
}

function collectSourceFiles(relativeDir: string): string[] {
  return collectSourceEntries(relativeDir).map((entry) => entry.source)
}

const routeSource = readProjectFile('src/app/api/ai/evaluation-assist/route.ts')
const serverSource = readProjectFile('src/server/ai/evaluation-assist.ts')
const assistantRedirectSource = readProjectFile('src/app/(main)/evaluation/assistant/page.tsx')
const workbenchPageSource = readProjectFile('src/app/(main)/evaluation/workbench/page.tsx')
const clientSource = readProjectFile('src/components/evaluation/EvaluationWorkbenchClient.tsx')
const clientBundleSources = [
  ...collectSourceFiles('src/app'),
  ...collectSourceFiles('src/components'),
]
const evaluationRouteSources = [
  ...collectSourceFiles('src/app/(main)/evaluation'),
  ...collectSourceFiles('src/components/evaluation'),
]
const legacyAssistantPathRefs = collectSourceEntries('src')
  .filter((entry) => entry.source.includes('/evaluation/assistant'))
  .map((entry) => entry.relativePath)
  .sort()

run('AI assist route rejects unauthenticated access and validates request payloads', () => {
  assert.match(routeSource, /export const runtime = 'nodejs'/)
  assert.match(routeSource, /getServerSession\(authOptions\)/)
  assert.match(routeSource, /if \(!session\)/)
  assert.match(routeSource, /AppError\(401,\s*'UNAUTHORIZED'/)
  assert.match(routeSource, /EvaluationAIAssistRequestSchema\.safeParse/)
})

run('AI env helper supports the new production env names and legacy aliases', () => {
  const preferred = readAiAssistEnv({
    AI_ASSIST_ENABLED: 'true',
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-5-mini',
  })
  const legacy = readAiAssistEnv({
    FEATURE_AI_ASSIST: 'true',
    OPENAI_RESPONSES_MODEL: 'gpt-5-mini',
  })

  assert.equal(preferred.enabled, true)
  assert.equal(preferred.enabledSource, 'AI_ASSIST_ENABLED')
  assert.equal(preferred.model, 'gpt-5-mini')
  assert.equal(preferred.modelSource, 'OPENAI_MODEL')
  assert.equal(legacy.enabled, true)
  assert.equal(legacy.enabledSource, 'FEATURE_AI_ASSIST')
  assert.equal(legacy.modelSource, 'OPENAI_RESPONSES_MODEL')
})

run('server helper maps each evaluation mode to the correct AI request type and disabled handling', () => {
  assert.match(serverSource, /case 'draft':\s*return AIRequestType\.EVAL_COMMENT_DRAFT/)
  assert.match(serverSource, /case 'bias':\s*return AIRequestType\.BIAS_ANALYSIS/)
  assert.match(serverSource, /case 'growth':\s*return AIRequestType\.GROWTH_PLAN/)
  assert.match(serverSource, /requestStatus: AIRequestStatus\.DISABLED/)
  assert.match(serverSource, /source: 'disabled' as const/)
  assert.match(serverSource, /throw new AppError\(502,\s*'AI_ASSIST_FAILED'/)
})

run('frontend calls the dedicated evaluation AI route and renders structured preview data', () => {
  assert.match(clientSource, /fetch\('\/api\/ai\/evaluation-assist'/)
  assert.match(clientSource, /onClick=\{\(\) => runAssist\('draft'\)\}/)
  assert.match(clientSource, /onClick=\{\(\) => runAssist\('bias'\)\}/)
  assert.match(clientSource, /onClick=\{\(\) => runAssist\('growth'\)\}/)
  assert.match(clientSource, /normalizeEvaluationAssistResult/)
  assert.match(clientSource, /AssistPreviewDetails mode=\{preview\.mode\} result=\{preview\.result\}/)
  assert.doesNotMatch(clientSource, /\/api\/ai\/assist/)
  assert.doesNotMatch(clientSource, /EVAL_COMMENT_DRAFT|BIAS_ANALYSIS|GROWTH_PLAN/)
  assert.doesNotMatch(clientSource, /fallback preview/i)
})

run('legacy evaluation assistant route is redirect-only and points to the canonical workbench route', () => {
  assert.match(assistantRedirectSource, /export const dynamic = 'force-dynamic'/)
  assert.match(assistantRedirectSource, /redirect\(params\.size \? `\/evaluation\/workbench\?\$\{params\.toString\(\)\}` : '\/evaluation\/workbench'\)/)
  assert.doesNotMatch(assistantRedirectSource, /getEvaluationWorkbenchPageData/)
  assert.doesNotMatch(assistantRedirectSource, /EvaluationWorkbenchClient/)
  assert.doesNotMatch(assistantRedirectSource, /\/api\/ai\/assist/)
})

run('canonical evaluation workbench page owns the live evaluation AI experience', () => {
  assert.match(workbenchPageSource, /import \{ getEvaluationWorkbenchPageData \} from '@\/server\/evaluation-workbench'/)
  assert.match(workbenchPageSource, /import \{ EvaluationWorkbenchClient \} from '@\/components\/evaluation\/EvaluationWorkbenchClient'/)
  assert.match(workbenchPageSource, /return <EvaluationWorkbenchClient \{\.\.\.data\} \/>/)
  assert.match(workbenchPageSource, /export const dynamic = 'force-dynamic'/)
  assert.doesNotMatch(workbenchPageSource, /^'use client'$/m)
  assert.doesNotMatch(workbenchPageSource, /\/api\/ai\/assist/)
  assert.doesNotMatch(workbenchPageSource, /assistMutation\.mutate/)
})

run('evaluation workbench exposes exactly three assist actions on the dedicated route', () => {
  const assistRouteMatches = clientSource.match(/fetch\('\/api\/ai\/evaluation-assist'/g) ?? []
  const assistActionMatches = clientSource.match(/onClick=\{\(\) => runAssist\('/g) ?? []

  assert.equal(assistRouteMatches.length, 1)
  assert.equal(assistActionMatches.length, 3)
})

run('no live evaluation page or component references the generic assist API anymore', () => {
  for (const source of evaluationRouteSources) {
    assert.doesNotMatch(source, /\/api\/ai\/assist/)
    assert.doesNotMatch(source, /assistMutation\.mutate/)
    assert.doesNotMatch(source, /source:\s*'fallback'/)
  }
})

run('live evaluation pages no longer link to the legacy evaluation assistant path', () => {
  for (const source of evaluationRouteSources) {
    assert.doesNotMatch(source, /\/evaluation\/assistant/)
  }
})

run('legacy evaluation assistant path only remains as a permission alias in src', () => {
  assert.deepEqual(legacyAssistantPathRefs, ['src/lib/auth/permissions.ts'])
})

run('preview application keeps approval UX and writes to the intended target fields', () => {
  const result = {
    focusArea: 'Performance summary',
    recommendedActions: ['Rewrite the evaluation comment with evidence-based wording.'],
    supportNeeded: ['Confirm one supporting example before submission.'],
    milestone: 'Final review before submit',
  }

  const draftApplied = applyEvaluationAssistResult('draft', result)
  const biasApplied = applyEvaluationAssistResult('bias', result)
  const growthApplied = applyEvaluationAssistResult('growth', result)

  assert.equal(typeof draftApplied.draftComment, 'string')
  assert.match(draftApplied.draftComment ?? '', /Performance summary/)
  assert.equal(growthApplied.draftComment, null)
  assert.equal(typeof growthApplied.growthMemo, 'string')
  assert.match(growthApplied.growthMemo ?? '', /Final review before submit/)
  assert.equal(typeof biasApplied.draftComment, 'string')
  assert.match(clientSource, /handlePreviewDecision\('approve'\)/)
  assert.match(clientSource, /handlePreviewDecision\('reject'\)/)
  assert.match(clientSource, /setPreview\(null\)/)
  assert.match(clientSource, /applyEvaluationAssistResult\(preview\.mode, preview\.result\)/)
})

run('disabled and malformed responses degrade safely for the preview UX', () => {
  const normalized = normalizeEvaluationAssistResult({ foo: 'bar' })

  assert.equal(typeof normalized.focusArea, 'string')
  assert.equal(Array.isArray(normalized.recommendedActions), true)
  assert.match(getEvaluationAssistDisabledReason(), /^AI /)
})

run('client bundle does not reference OPENAI_API_KEY directly', () => {
  for (const source of clientBundleSources) {
    assert.doesNotMatch(source, /OPENAI_API_KEY/)
  }
})

console.log('Evaluation AI assist tests completed')
