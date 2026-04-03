import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import {
  CalibrationCandidateUpdateSchema,
  CalibrationExportSchema,
  CalibrationWorkflowSchema,
} from '../src/lib/validations'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

async function main() {
  await run('calibration update schema accepts bulk import, external upload, export, and merge/delete workflow payloads', () => {
    const bulkImport = CalibrationCandidateUpdateSchema.safeParse({
      action: 'bulk-import',
      cycleId: 'cycle-1',
      rows: [
        {
          targetId: 'target-1',
          gradeId: 'grade-a',
          adjustReason: '리뷰 근거와 최근 실적을 다시 반영해 최종 등급과 코멘트를 조정합니다.',
          rowNumber: 2,
          identifier: 'EMP-001',
        },
      ],
    })
    const externalUpload = CalibrationCandidateUpdateSchema.safeParse({
      action: 'upload-external-data',
      cycleId: 'cycle-1',
      externalData: {
        columns: [{ key: 'external_1_joblevel', label: 'Job Level' }],
        rows: [
          {
            targetId: 'target-1',
            rowNumber: 2,
            identifier: 'EMP-001',
            values: {
              external_1_joblevel: 'L4',
            },
          },
        ],
      },
    })
    const workflowMerge = CalibrationWorkflowSchema.safeParse({
      cycleId: 'cycle-1',
      action: 'MERGE',
      scopeId: 'dept-1',
    })
    const workflowDelete = CalibrationWorkflowSchema.safeParse({
      cycleId: 'cycle-1',
      action: 'DELETE_SESSION',
    })
    const exportMode = CalibrationExportSchema.safeParse({
      cycleId: 'cycle-1',
      mode: 'all',
      scopeId: 'dept-1',
    })

    assert.equal(bulkImport.success, true)
    assert.equal(externalUpload.success, true)
    assert.equal(workflowMerge.success, true)
    assert.equal(workflowDelete.success, true)
    assert.equal(exportMode.success, true)
  })

  await run('calibration route supports partial bulk import failures and external data upload persistence', () => {
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')

    assert.equal(routeSource.includes("body.action === 'bulk-import'"), true)
    assert.equal(routeSource.includes('failedRows'), true)
    assert.equal(routeSource.includes('appliedCount'), true)
    assert.equal(routeSource.includes("body.action === 'upload-external-data'"), true)
    assert.equal(routeSource.includes('CALIBRATION_EXTERNAL_DATA_UPLOADED'), true)
    assert.equal(routeSource.includes('toCalibrationSessionConfigJson'), true)
    assert.equal(routeSource.includes('calibrationSessionConfig: toCalibrationSessionConfigJson(nextSessionConfig)'), true)
  })

  await run('calibration workflow route supports merge and session delete with audit-safe handling', () => {
    const workflowSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(workflowSource.includes("action === 'MERGE'"), true)
    assert.equal(workflowSource.includes('CALIBRATION_MERGED'), true)
    assert.equal(workflowSource.includes("action === 'DELETE_SESSION'"), true)
    assert.equal(workflowSource.includes('CALIBRATION_SESSION_DELETED'), true)
    assert.equal(workflowSource.includes('createEmptyCalibrationSessionConfig'), true)
    assert.equal(workflowSource.includes("evalStage: 'CEO_ADJUST'"), true)
  })

  await run('calibration export route and workbook builder exist for xlsx download', () => {
    const routePath = path.resolve(process.cwd(), 'src/app/api/evaluation/calibration/export/route.ts')
    const serverPath = path.resolve(process.cwd(), 'src/server/evaluation-calibration-export.ts')

    assert.equal(existsSync(routePath), true)
    assert.equal(existsSync(serverPath), true)

    const routeSource = read('src/app/api/evaluation/calibration/export/route.ts')
    const serverSource = read('src/server/evaluation-calibration-export.ts')

    assert.equal(routeSource.includes('CalibrationExportSchema'), true)
    assert.equal(routeSource.includes("searchParams.get('disposition') === 'inline'"), true)
    assert.equal(serverSource.includes('buildCalibrationExportWorkbook'), true)
    assert.equal(serverSource.includes("mode === 'all'"), true)
    assert.equal(serverSource.includes('XLSX.write'), true)
  })

  await run('calibration loader exposes merged/session metadata and external data for datasheet/detail rendering', () => {
    const loaderSource = read('src/server/evaluation-calibration.ts')

    assert.equal(loaderSource.includes('externalColumns'), true)
    assert.equal(loaderSource.includes('lastMergeSummary'), true)
    assert.equal(loaderSource.includes('externalData'), true)
    assert.equal(loaderSource.includes('hasMergedCalibration'), true)
    assert.equal(loaderSource.includes('sourceStage'), true)
    assert.equal(loaderSource.includes('CALIBRATION_SESSION_DELETED'), true)
  })

  await run('calibration client renders upload, export, merge, delete, and degraded feedback affordances', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('외부 데이터 업로드'), true)
    assert.equal(clientSource.includes('엑셀 다운로드'), true)
    assert.equal(clientSource.includes('평가 병합'), true)
    assert.equal(clientSource.includes('세션 삭제'), true)
    assert.equal(clientSource.includes('accept=".xlsx,.xls,.csv"'), true)
    assert.equal(clientSource.includes('UploadIssueList'), true)
    assert.equal(clientSource.includes('handleExport(\'inline\')'), true)
    assert.equal(clientSource.includes('handleWorkflow(\'MERGE\''), true)
    assert.equal(clientSource.includes('handleWorkflow(\'DELETE_SESSION\')'), true)
  })

  await run('calibration client resets stale modal and upload state when session data changes', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes("setBulkImportRows([])"), true)
    assert.equal(clientSource.includes("setBulkImportIssues([])"), true)
    assert.equal(clientSource.includes("setExternalUploadOpen(false)"), true)
    assert.equal(clientSource.includes("setExternalUploadRows([])"), true)
    assert.equal(clientSource.includes("setExportOpen(false)"), true)
    assert.equal(clientSource.includes("setMergeOpen(false)"), true)
    assert.equal(clientSource.includes("setDeleteOpen(false)"), true)
    assert.equal(clientSource.includes('key={selectedCandidate.id}'), true)
  })

  await run('calibration detail panel and datasheet expose external data and merged status without losing review/memo tabs', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('외부 참고 데이터'), true)
    assert.equal(clientSource.includes('병합 반영됨'), true)
    assert.equal(clientSource.includes('기준 ${candidate.sourceStage}'), true)
    assert.equal(clientSource.includes("['review', '리뷰']"), true)
    assert.equal(clientSource.includes("['memo', '평가 메모']"), true)
    assert.equal(clientSource.includes('candidate.externalData.length'), true)
  })

  await run('calibration page and route keep unauthorized roles out of live editing paths', () => {
    const pageSource = read('src/app/(main)/evaluation/ceo-adjust/page.tsx')
    const loaderSource = read('src/server/evaluation-calibration.ts')
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')
    const workflowSource = read('src/app/api/evaluation/calibration/workflow/route.ts')

    assert.equal(pageSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(loaderSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(params.role)"), true)
    assert.equal(routeSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(workflowSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
  })

  console.log('Calibration ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
