import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import './register-path-aliases'
import { CalibrationCandidateUpdateSchema } from '../src/lib/validations'

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
  await run('calibration update schema accepts live session config edits and bulk import rows', () => {
    const sessionConfig = CalibrationCandidateUpdateSchema.safeParse({
      action: 'update-session-config',
      cycleId: 'cycle-1',
      sessionConfig: {
        excludedTargetIds: ['target-1'],
        participantIds: ['emp-1'],
        evaluatorIds: ['emp-2'],
      },
    })
    const bulkImport = CalibrationCandidateUpdateSchema.safeParse({
      action: 'bulk-import',
      cycleId: 'cycle-1',
      rows: [
        {
          targetId: 'target-1',
          gradeId: 'grade-a',
          adjustReason: '리뷰 근거와 최근 실적을 다시 반영해 최종 등급과 코멘트를 조정합니다.',
        },
      ],
    })

    assert.equal(sessionConfig.success, true)
    assert.equal(bulkImport.success, true)
  })

  await run('calibration route supports live session config updates and bulk import persistence paths', () => {
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')

    assert.equal(routeSource.includes("body.action === 'update-session-config'"), true)
    assert.equal(routeSource.includes('calibrationSessionConfig: body.sessionConfig'), true)
    assert.equal(routeSource.includes("body.action === 'bulk-import'"), true)
    assert.equal(routeSource.includes('CALIBRATION_BULK_IMPORTED'), true)
    assert.equal(routeSource.includes('CALIBRATION_SESSION_CONFIG_UPDATED'), true)
  })

  await run('calibration loader exposes session config and session options for active-session editing', () => {
    const loaderSource = read('src/server/evaluation-calibration.ts')

    assert.equal(loaderSource.includes('sessionConfig'), true)
    assert.equal(loaderSource.includes('sessionOptions'), true)
    assert.equal(loaderSource.includes('parseCalibrationSessionConfig'), true)
    assert.equal(loaderSource.includes('excludedTargetIds'), true)
    assert.equal(loaderSource.includes('participantIds'), true)
    assert.equal(loaderSource.includes('evaluatorIds'), true)
  })

  await run('calibration client renders target settings dropdown, people editor, bulk import entry, and review/memo detail tabs', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('CalibrationOpsToolbar'), true)
    assert.equal(clientSource.includes('ConfigModal'), true)
    assert.equal(clientSource.includes('SelectionColumn'), true)
    assert.equal(clientSource.includes('action: \'update-session-config\''), true)
    assert.equal(clientSource.includes("action: 'bulk-import'"), true)
    assert.equal(clientSource.includes('detailTab'), true)
    assert.equal(clientSource.includes("['review', '리뷰']"), true)
    assert.equal(clientSource.includes("['memo', '평가 메모']"), true)
    assert.equal(clientSource.includes('대상자 추가'), true)
    assert.equal(clientSource.includes('대상자 삭제'), true)
    assert.equal(clientSource.includes('평가자 및 참여자'), true)
    assert.equal(clientSource.includes('엑셀로 등급/코멘트 입력'), true)
    assert.equal(clientSource.includes('참고정보'), true)
    assert.equal(clientSource.includes('직속 리더 / 상위 평가자 코멘트'), true)
  })

  await run('calibration client resets stale notice, filters, and selected detail context when session data changes', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes("setNotice('')"), true)
    assert.equal(clientSource.includes("setJobGroupFilter('all')"), true)
    assert.equal(clientSource.includes("setOriginalGradeFilter('all')"), true)
    assert.equal(clientSource.includes("setAdjustedGradeFilter('all')"), true)
    assert.equal(clientSource.includes("setAdjustmentFilter('all')"), true)
    assert.equal(clientSource.includes('key={selectedCandidate.id}'), true)
  })

  await run('calibration datasheet exposes inline final grade and final comment editing alongside save affordances', () => {
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(clientSource.includes('최종 등급'), true)
    assert.equal(clientSource.includes('최종 코멘트'), true)
    assert.equal(clientSource.includes('placeholder={candidate.suggestedReason ??'), true)
    assert.equal(clientSource.includes("void onSaveCandidate(candidate.id)"), true)
  })

  await run('calibration page and route block unauthorized roles before operational editing paths open', () => {
    const pageSource = read('src/app/(main)/evaluation/ceo-adjust/page.tsx')
    const loaderSource = read('src/server/evaluation-calibration.ts')
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')

    assert.equal(pageSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(loaderSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(params.role)"), true)
    assert.equal(routeSource.includes("!['ROLE_ADMIN', 'ROLE_CEO'].includes(session.user.role)"), true)
    assert.equal(loaderSource.includes('관리자 또는 CEO만 접근할 수 있습니다.'), true)
  })

  await run('calibration no-session final result apply path remains available through bulk import by cycle', () => {
    const routeSource = read('src/app/api/evaluation/calibration/route.ts')
    const clientSource = read('src/components/evaluation/EvaluationCalibrationClient.tsx')

    assert.equal(routeSource.includes("body.action === 'bulk-import'"), true)
    assert.equal(routeSource.includes('cycleId: cycle.id'), true)
    assert.equal(routeSource.includes('CALIBRATION_BULK_IMPORTED'), true)
    assert.equal(clientSource.includes('세션을 생성하지 않아도 데이터 시트에서 최종 등급과 코멘트를 일괄 반영할 수 있습니다.'), true)
  })

  console.log('Calibration ops tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
