import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function collectFiles(relativeDir: string): string[] {
  const absoluteDir = path.resolve(process.cwd(), relativeDir)
  const entries = readdirSync(absoluteDir)
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry)
    const relativePath = path.relative(process.cwd(), absolutePath)
    const stat = statSync(absolutePath)

    if (stat.isDirectory()) {
      files.push(...collectFiles(relativePath))
      continue
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(relativePath)
    }
  }

  return files
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

function assertNoBrokenKorean(source: string) {
  for (const token of [
    '?좉퇋',
    '議곗쭅',
    '媛쒖씤',
    '?깃낵',
    '?됯?',
    '鍮꾧',
    '쨌',
    '珥덉븞',
    '怨듭쑀',
    '濡쒓렇',
    '吏곸썝',
    '由щ뜑',
    '寃곌낵',
    '湲곗?',
    '泥댄겕',
    '蹂듭썝',
    '?꾩옱',
    '?묐떟',
    '?듬챸',
    '?댁쓽',
    '?좎껌',
    '蹂댁셿',
    '寃곗젙',
    '?띿뒪',
    '湲고?',
  ]) {
    assert.equal(source.includes(token), false, `unexpected mojibake token: ${token}`)
  }
  assert.equal(source.includes('�'), false, 'replacement character should not exist')
}

function assertContainsAll(source: string, expected: string[]) {
  for (const text of expected) {
    assert.equal(source.includes(text), true, `missing expected text: ${text}`)
  }
}

async function main() {
  await run('feedback 360 copy sources stay readable', () => {
    const header = read('src/components/evaluation/feedback360/MultiRaterCycleHeader.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const server = read('src/server/feedback-360.ts')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')

    assertContainsAll(header, [
      '360 다면평가',
      '평가자 매핑, 응답 진행률, 익명 기준, 강점/개선 테마, 성장 계획까지 하나의 운영 흐름으로 연결합니다.',
    ])
    assertContainsAll(workspace, [
      '현재 진행 중인 360 평가가 없습니다.',
      '360 다면평가 허브',
      '360 결과',
      '360 운영 관리',
    ])
    assertContainsAll(server, [
      '선택한 분기에 진행 중인 360 다면평가가 없습니다. HR 운영 탭에서 해당 분기 평가자 매핑 상태를 확인할 수 있습니다.',
      '응답 화면에 접근할 권한이 없습니다.',
    ])

    assertNoBrokenKorean(header)
    assertNoBrokenKorean(workspace)
    assertNoBrokenKorean(server)
    assertNoBrokenKorean(adminPanel)
  })

  await run('feedback 360 reviewer recommendation fallback copy stays readable', () => {
    const aiAssist = read('src/lib/ai-assist.ts')
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')
    const recommendationBlock = aiAssist.slice(
      aiAssist.indexOf("sourceType === 'Feedback360ReviewerRecommendation'"),
      aiAssist.indexOf("sourceType === 'Feedback360ThemeSummary'")
    )

    assertContainsAll(`${recommendationBlock}\n${nominationPanel}`, [
      '평가자 후보',
      '익명 기준과 평가자 부담을 함께 고려해 상사, 동료, 팀원 후보를 균형 있게 추천합니다.',
      '소수 조직에서 같은 평가자 조합이 반복되면 익명성이 약해질 수 있습니다.',
      '평가자 추천 후보',
      '평가자 추천 미리보기',
      'AI 기능이 꺼져 있어 관계 점수 기준으로 추천 후보를 표시합니다.',
    ])

    assertNoBrokenKorean(recommendationBlock)
    assert.equal(nominationPanel.includes('AI reviewer recommendation preview'), false)
    assert.equal(nominationPanel.includes('Fallback preview'), false)
    assert.equal(nominationPanel.includes('�'), false)
  })

  await run('appeal and evaluation results copy sources stay readable', () => {
    const appealClient = read('src/components/evaluation/EvaluationAppealClient.tsx')
    const appealServer = read('src/server/evaluation-appeal.ts')
    const appealRoute = read('src/app/api/appeals/[id]/route.ts')
    const resultsClient = read('src/components/evaluation/EvaluationResultsClient.tsx')
    const resultsServer = read('src/server/evaluation-results.ts')

    assertContainsAll(appealClient, [
      '이의 신청 화면을 준비 중입니다.',
      '이의 신청 사유는 20자 이상 입력해 주세요.',
      '현재는 이의 신청 가능 기간이 아닙니다.',
    ])
    assertContainsAll(appealServer, [
      '이의 신청 초안 이력을 불러오지 못했습니다.',
      '현재 주기의 이의 신청 기간이 아닙니다.',
    ])
    assertContainsAll(appealRoute, [
      '신청자만 초안을 저장할 수 있습니다.',
      '보완 요청 상태에서만 다시 제출할 수 있습니다.',
    ])
    assertContainsAll(resultsClient, [
      '확인할 수 있는 결과가 없습니다.',
      '대상자',
      '현재 상태에서는 리포트를 다운로드할 수 없습니다.',
    ])
    assertContainsAll(resultsServer, [
      '평가 결과 조회 대상자 목록을 불러오지 못했습니다.',
      '대상자 본인만 평가 결과를 확인 완료로 처리할 수 있습니다.',
    ])

    assertNoBrokenKorean(appealClient)
    assertNoBrokenKorean(appealServer)
    assertNoBrokenKorean(appealRoute)
    assertNoBrokenKorean(resultsClient)
    assertNoBrokenKorean(resultsServer)
  })

  await run('performance design, KPI org, and calibration copy stay readable', () => {
    const performanceDesignClient = read('src/components/admin/PerformanceDesignClient.tsx')
    const performanceDesignServer = read('src/server/admin/performance-design.ts')
    const orgKpiClient = read('src/components/kpi/OrgKpiManagementClient.tsx')
    const calibrationRoute = read('src/app/api/evaluation/calibration/route.ts')

    assertContainsAll(performanceDesignClient, [
      '성과 설계',
      '평가군, KPI Pool, SMART 진단, 비계량 지표, 협업 BP 사례, 건강도 이상 징후를 설계합니다.',
      'KPI Pool / SMART 진단 및 우선순위 설계',
      '비교 기준을 선택해 주세요',
      '평가군을 선택해 주세요',
    ])
    assertContainsAll(performanceDesignServer, [
      '조직 KPI',
      '개인 KPI',
      '핵심 과제 근거, 목표 정의, 실행 근거, 결과 비교',
    ])
    assertContainsAll(orgKpiClient, [
      '선택한 KPI가 없습니다',
      '조직 KPI 복제',
      '개인 KPI',
    ])
    assertContainsAll(calibrationRoute, [
      '팔로우업 변경 내용을 확인해 주세요.',
      '공유용 코멘트가 없습니다. 팔로우업에서 공유 코멘트를 입력해 주세요.',
      '대표이사 확정 대상자를 찾지 못했습니다.',
    ])

    assertNoBrokenKorean(performanceDesignClient)
    assertNoBrokenKorean(performanceDesignServer)
    assertNoBrokenKorean(orgKpiClient)
    assertNoBrokenKorean(calibrationRoute)
  })

  await run('runtime product source does not contain the broken separator token', () => {
    const runtimeFiles = ['src/components', 'src/server', 'src/lib', 'src/app'].flatMap((relativeDir) => collectFiles(relativeDir))

    for (const relativePath of runtimeFiles) {
      const source = read(relativePath)
      assert.equal(source.includes('쨌'), false, `broken separator token should not exist in ${relativePath}`)
    }
  })

  console.log('Korean copy hotfix tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
