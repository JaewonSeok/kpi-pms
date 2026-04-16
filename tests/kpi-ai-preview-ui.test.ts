import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildKpiAiPreviewDescriptor,
  type KpiAiPreviewComparison,
} from '../src/lib/kpi-ai-preview'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

const repoRoot = process.cwd()
const orgSource = fs.readFileSync(path.join(repoRoot, 'src/components/kpi/OrgKpiManagementClient.tsx'), 'utf8')
const personalSource = fs.readFileSync(path.join(repoRoot, 'src/components/kpi/PersonalKpiManagementClient.tsx'), 'utf8')
const monthlySource = fs.readFileSync(path.join(repoRoot, 'src/components/kpi/MonthlyKpiManagementClient.tsx'), 'utf8')
const previewPanelSource = fs.readFileSync(path.join(repoRoot, 'src/components/kpi/KpiAiPreviewPanel.tsx'), 'utf8')

void (async () => {
  await run('wording preview becomes a readable summary with comparisons and rationale sections', () => {
    const comparisons: KpiAiPreviewComparison[] = [
      { label: 'KPI명', before: '기존 KPI명', after: 'AI 제안 KPI명' },
      { label: '정의', before: '기존 정의', after: 'AI 제안 정의' },
    ]

    const descriptor = buildKpiAiPreviewDescriptor({
      action: 'improve-wording',
      source: 'ai',
      comparisons,
      result: {
        improvedTitle: 'AI 제안 KPI명',
        improvedDefinition: 'AI 제안 정의',
        rationale: [
          '본부 KPI와 연결성이 더 명확해졌습니다.',
          '측정 방식이 구체화되었습니다.',
        ],
      },
    })

    assert.equal(descriptor.statusLabel, '추천')
    assert.equal(descriptor.comparisons.length, 2)
    assert.equal(descriptor.sections.some((section) => section.title === 'KPI명 제안'), true)
    assert.equal(descriptor.sections.some((section) => section.title === '정의'), true)
    assert.equal(descriptor.sections.some((section) => section.title === '개선 근거'), true)
  })

  await run('SMART preview exposes warning tone and structured criteria cards', () => {
    const descriptor = buildKpiAiPreviewDescriptor({
      action: 'smart-check',
      source: 'ai',
      result: {
        overall: 'WARNING',
        summary: '측정 기준과 통제 가능성을 보완해야 합니다.',
        criteria: [
          {
            name: 'Specific',
            status: 'WARN',
            reason: '대상 범위가 넓습니다.',
            suggestion: '측정 대상을 팀 운영 KPI로 좁혀 보세요.',
          },
        ],
      },
    })

    assert.equal(descriptor.statusLabel, '주의')
    assert.equal(descriptor.sections.some((section) => section.title === 'SMART 점검 결과'), true)
  })

  await run('duplicate preview is rendered as comparable KPI candidates with review tone', () => {
    const descriptor = buildKpiAiPreviewDescriptor({
      action: 'detect-duplicates',
      source: 'ai',
      result: {
        summary: '유사한 KPI가 감지되었습니다.',
        duplicates: [
          {
            id: 'dup-1',
            title: '유사 KPI',
            overlapLevel: 'HIGH',
            similarityReason: '측정 대상과 산식이 거의 같습니다.',
          },
        ],
      },
    })

    assert.equal(descriptor.statusLabel, '검토 필요')
    assert.equal(descriptor.sections.some((section) => section.title === '중복/유사 KPI 후보'), true)
  })

  await run('shared preview panel hides raw JSON behind an explicit disclosure by default', () => {
    assert.equal(previewPanelSource.includes('원본 JSON 보기'), true)
    assert.equal(previewPanelSource.includes('적용 전 마지막 확인'), true)
    assert.equal(previewPanelSource.includes('변경 전 / AI 제안값'), true)
  })

  await run('org personal and monthly KPI screens all use the shared preview panel', () => {
    assert.equal(orgSource.includes('KpiAiPreviewPanel'), true)
    assert.equal(personalSource.includes('KpiAiPreviewPanel'), true)
    assert.equal(monthlySource.includes('KpiAiPreviewPanel'), true)
  })

  await run('org KPI AI preview no longer renders direct JSON.stringify output in the main result body', () => {
    assert.equal(orgSource.includes('JSON.stringify(aiPreview.result, null, 2)'), false)
  })
})()
