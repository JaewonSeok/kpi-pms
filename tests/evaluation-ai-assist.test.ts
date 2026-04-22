import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { readAiAssistEnv } from '../src/lib/ai-env'
import {
  applyEvaluationAssistResult,
  buildEvaluationAssistEvidenceView,
  formatEvaluationAssistPreviewForClipboard,
  getEvaluationAssistDisabledReason,
  getEvaluationAssistModeLabel,
  getEvaluationAssistPublicErrorMessage,
  getEvaluationAssistRequestErrorMessage,
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
const performancePageSource = readProjectFile('src/app/(main)/evaluation/performance/page.tsx')
const workbenchPageSource = readProjectFile('src/app/(main)/evaluation/workbench/page.tsx')
const clientSource = readProjectFile('src/components/evaluation/EvaluationWorkbenchClient.tsx')
const clientBundleSources = [...collectSourceFiles('src/app'), ...collectSourceFiles('src/components')]
const evaluationRouteSources = [
  ...collectSourceFiles('src/app/(main)/evaluation'),
  ...collectSourceFiles('src/components/evaluation'),
]
const legacyAssistantPathRefs = collectSourceEntries('src')
  .filter((entry) => entry.source.includes('/evaluation/assistant'))
  .map((entry) => entry.relativePath)
  .sort()

run('AI assist route rejects unauthenticated access, validates payloads, and masks provider errors', () => {
  assert.match(routeSource, /export const runtime = 'nodejs'/)
  assert.match(routeSource, /getServerSession\(authOptions\)/)
  assert.match(routeSource, /EvaluationAIAssistRequestSchema\.safeParse/)
  assert.match(routeSource, /strengthComment: validated\.data\.strengthComment/)
  assert.match(routeSource, /improvementComment: validated\.data\.improvementComment/)
  assert.match(routeSource, /nextStepGuidance: validated\.data\.nextStepGuidance/)
  assert.match(routeSource, /shouldMaskEvaluationAssistError/)
  assert.match(routeSource, /getEvaluationAssistPublicErrorMessage\(\)/)
  assert.match(routeSource, /\[evaluation-ai-assist\]/)
})

run('AI env helper supports the current production env names and legacy aliases', () => {
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

run('server helper maps each live mode to the intended request type and evidence-based payload', () => {
  assert.match(serverSource, /case 'draft':\s*return AIRequestType\.EVAL_COMMENT_DRAFT/)
  assert.match(serverSource, /case 'bias':\s*return AIRequestType\.BIAS_ANALYSIS/)
  assert.match(serverSource, /case 'growth':\s*return AIRequestType\.GROWTH_PLAN/)
  assert.match(serverSource, /buildEvaluationAssistEvidenceView/)
  assert.match(serverSource, /currentStrengthComment:/)
  assert.match(serverSource, /currentImprovementComment:/)
  assert.match(serverSource, /currentNextStepGuidance:/)
  assert.match(serverSource, /previousStageReview:/)
  assert.match(serverSource, /requestStatus: AIRequestStatus\.DISABLED/)
  assert.match(serverSource, /source: 'disabled' as const/)
  assert.match(serverSource, /evidence: context\.evidenceView/)
  assert.match(serverSource, /throw new AppError\(502,\s*'AI_ASSIST_FAILED'/)
})

run('frontend calls the dedicated evaluation AI route and renders evidence-based preview data', () => {
  assert.match(clientSource, /fetch\('\/api\/ai\/evaluation-assist'/)
  assert.match(clientSource, /strengthComment: draftStrengthComment/)
  assert.match(clientSource, /improvementComment: draftImprovementComment/)
  assert.match(clientSource, /nextStepGuidance: draftNextStepGuidance/)
  assert.match(clientSource, /handleAssistMode\('draft'\)/)
  assert.match(clientSource, /handleAssistMode\('bias'\)/)
  assert.match(clientSource, /handleAssistMode\('growth'\)/)
  assert.match(clientSource, /평가 가이드/)
  assert.match(clientSource, /QualityWarningPanel/)
  assert.match(clientSource, /근거 부족/)
  assert.match(clientSource, /편향 주의/)
  assert.match(clientSource, /normalizeEvaluationAssistEvidenceView/)
  assert.match(clientSource, /buildEvaluationAssistEvidenceView/)
  assert.match(clientSource, /EvidencePanel/)
  assert.match(clientSource, /formatEvaluationAssistPreviewForClipboard/)
  assert.match(clientSource, /getEvaluationAssistEvidenceLevelLabel/)
  assert.doesNotMatch(clientSource, /\/api\/ai\/assist/)
})

run('legacy evaluation assistant route is redirect-only and points to the canonical performance route', () => {
  assert.match(assistantRedirectSource, /export const dynamic = 'force-dynamic'/)
  assert.match(
    assistantRedirectSource,
    /redirect\(params\.size \? `\/evaluation\/performance\?\$\{params\.toString\(\)\}` : '\/evaluation\/performance'\)/
  )
  assert.doesNotMatch(assistantRedirectSource, /getEvaluationWorkbenchPageData/)
  assert.doesNotMatch(assistantRedirectSource, /EvaluationWorkbenchClient/)
  assert.doesNotMatch(assistantRedirectSource, /\/api\/ai\/assist/)
})

run('legacy evaluation workbench route redirects into the canonical performance route', () => {
  assert.match(workbenchPageSource, /export const dynamic = 'force-dynamic'/)
  assert.match(workbenchPageSource, /redirect\(params\.size \? `\$\{base\}\?\$\{params\.toString\(\)\}` : base\)/)
  assert.match(workbenchPageSource, /\/evaluation\/performance/)
  assert.doesNotMatch(workbenchPageSource, /getEvaluationWorkbenchPageData/)
  assert.doesNotMatch(workbenchPageSource, /EvaluationWorkbenchClient/)
})

run('canonical performance page owns the live evaluation AI experience', () => {
  assert.match(performancePageSource, /requireProtectedPageSession/)
  assert.match(performancePageSource, /import \{ getEvaluationWorkbenchPageData \} from '@\/server\/evaluation-workbench'/)
  assert.match(performancePageSource, /import \{ EvaluationWorkbenchClient \} from '@\/components\/evaluation\/EvaluationWorkbenchClient'/)
  assert.match(performancePageSource, /return <EvaluationWorkbenchClient \{\.\.\.data\} \/>/)
  assert.match(performancePageSource, /export const dynamic = 'force-dynamic'/)
  assert.doesNotMatch(performancePageSource, /^'use client'$/m)
})

run('performance detail route exists for direct evaluation deep links', () => {
  const detailPageSource = readProjectFile('src/app/(main)/evaluation/performance/[evaluationId]/page.tsx')

  assert.match(detailPageSource, /requireProtectedPageSession/)
  assert.match(detailPageSource, /const \{ evaluationId \} = await params/)
  assert.match(detailPageSource, /EvaluationWorkbenchClient/)
})

run('evaluation assistant surface no longer treats the workbench route as canonical', () => {
  assert.match(workbenchPageSource, /redirect\(/)
  assert.doesNotMatch(workbenchPageSource, /getEvaluationWorkbenchPageData/)
  assert.doesNotMatch(workbenchPageSource, /return <EvaluationWorkbenchClient \{\.\.\.data\} \/>/)
})

run('evaluation workbench exposes exactly three assist modes on the dedicated route', () => {
  const assistRouteMatches = clientSource.match(/fetch\('\/api\/ai\/evaluation-assist'/g) ?? []
  const assistModeMatches = clientSource.match(/handleAssistMode\('/g) ?? []

  assert.equal(assistRouteMatches.length, 1)
  assert.equal(assistModeMatches.length, 3)
  assert.notEqual(getEvaluationAssistModeLabel('draft'), 'draft')
  assert.notEqual(getEvaluationAssistModeLabel('bias'), 'bias')
  assert.notEqual(getEvaluationAssistModeLabel('growth'), 'growth')
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
    draftText: '이번 반기에는 핵심 KPI를 안정적으로 이행했습니다.',
    strengths: ['중요 과제를 일정 안에 마무리했습니다.'],
    concerns: ['협업 커뮤니케이션을 더 자주 점검할 필요가 있습니다.'],
    coachingPoints: ['다음 1:1에서 우선순위 조정 기준을 먼저 맞춰 보세요.'],
    nextStep: '제출 전 최신 근거를 다시 확인해 주세요.',
  }

  const draftApplied = applyEvaluationAssistResult('draft', result)
  const coachingApplied = applyEvaluationAssistResult('bias', result)
  const growthApplied = applyEvaluationAssistResult('growth', result)

  assert.equal(typeof draftApplied.draftComment, 'string')
  assert.match(draftApplied.draftComment ?? '', /핵심 KPI/)
  assert.equal(draftApplied.growthMemo, null)
  assert.equal(coachingApplied.draftComment, null)
  assert.equal(typeof coachingApplied.growthMemo, 'string')
  assert.match(coachingApplied.growthMemo ?? '', /코칭/)
  assert.equal(growthApplied.draftComment, null)
  assert.equal(typeof growthApplied.growthMemo, 'string')
  assert.match(growthApplied.growthMemo ?? '', /성장/)
  assert.match(clientSource, /handlePreviewDecision\('approve'\)/)
  assert.match(clientSource, /handlePreviewDecision\('reject'\)/)
  assert.match(clientSource, /handleCopyPreview/)
  assert.match(clientSource, /applyEvaluationAssistResult\(preview\.mode, preview\.result\)/)
})

run('disabled and malformed responses degrade safely for the preview UX', () => {
  const normalized = normalizeEvaluationAssistResult({ foo: 'bar' })

  assert.equal(typeof normalized.draftText, 'string')
  assert.equal(Array.isArray(normalized.strengths), true)
  assert.equal(Array.isArray(normalized.coachingPoints), true)
  assert.match(getEvaluationAssistDisabledReason(), /^AI /)
  assert.equal(getEvaluationAssistPublicErrorMessage().includes('관리자'), true)
  assert.equal(getEvaluationAssistRequestErrorMessage().includes('잠시 후 다시 시도'), true)
})

run('evidence view marks weak evidence with warnings and stays strong when multiple sources exist', () => {
  const weak = buildEvaluationAssistEvidenceView({
    keyPoints: ['체크인 메모 한 건만 확인됨'],
  })
  const strong = buildEvaluationAssistEvidenceView({
    kpiSummaries: ['고객 대응 KPI / 가중치 20% / 최신 달성률 98%'],
    monthlySummaries: ['고객 대응 KPI / 2026-03 / 달성률 98% / 주요 이슈 해결'],
    noteSummaries: ['체크인 / 2026-03-10 / 우선순위 조정이 필요합니다.'],
    keyPoints: ['고객 대응 KPI 달성률 98%', '체크인에서 우선순위 조정 언급', '다면 피드백 응답 4건 연결'],
  })

  assert.equal(weak.sufficiency, 'weak')
  assert.equal(weak.warnings.length > 0, true)
  assert.notEqual(strong.sufficiency, 'weak')
  assert.equal(strong.keyPoints.length >= 3, true)
})

run('clipboard formatter includes evidence and warning context for review before apply', () => {
  const evidence = buildEvaluationAssistEvidenceView({
    kpiSummaries: ['신규 사업 KPI / 가중치 30% / 최신 달성률 92%'],
    monthlySummaries: ['신규 사업 KPI / 2026-03 / 달성률 92% / 일정 준수'],
    noteSummaries: ['체크인 / 2026-03-12 / 우선순위 정리가 필요합니다.'],
    keyPoints: ['신규 사업 KPI 달성률 92%'],
    warnings: ['근거를 추가 확인해 주세요.'],
  })

  const clipboardText = formatEvaluationAssistPreviewForClipboard(
    'draft',
    {
      draftText: '신규 사업 KPI를 안정적으로 리드했습니다.',
      strengths: ['일정 준수가 좋았습니다.'],
      concerns: ['후속 전파 전에 우선순위를 다시 정리할 필요가 있습니다.'],
      coachingPoints: ['다음 체크인에서 공유 계획을 먼저 확인해 보세요.'],
      nextStep: '제출 전 근거를 다시 확인해 주세요.',
    },
    evidence
  )

  assert.match(clipboardText, /\[/)
  assert.match(clipboardText, /사용 근거 요약/)
  assert.match(clipboardText, /품질 경고/)
})

run('client bundle does not reference OPENAI_API_KEY directly', () => {
  for (const source of clientBundleSources) {
    assert.doesNotMatch(source, /OPENAI_API_KEY/)
  }
})

run('user-facing mode labels stay operational and avoid raw enum names', () => {
  assert.doesNotMatch(getEvaluationAssistModeLabel('draft'), /^draft$/i)
  assert.doesNotMatch(getEvaluationAssistModeLabel('bias'), /^bias$/i)
  assert.doesNotMatch(getEvaluationAssistModeLabel('growth'), /^growth$/i)
})

run('workbench route includes evaluator guide logging and avoids raw provider text in the UI path', () => {
  assert.match(clientSource, /persistGuideAction/)
  assert.match(clientSource, /\/api\/evaluation\/\$\{selected\.id\}\/guide/)
  assert.match(clientSource, /getEvaluationAssistRequestErrorMessage\(\)/)
  assert.doesNotMatch(clientSource, /response_format 'personal_kpi_draft'/)
})

console.log('Evaluation AI assist tests completed')
