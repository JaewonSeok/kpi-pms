import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { flattenNavigationItems, NAV_ITEMS } from '../src/lib/navigation'
import {
  buildFeedback360ResponseTargetDedupeKey,
  dedupeFeedback360ResponseTargets,
} from '../src/components/evaluation/feedback360/feedback360-response-targets'

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

async function main() {
  await run('feedback 360 overview route renders the integrated hub', () => {
    const page = read('src/app/(main)/evaluation/360/page.tsx')
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const pptShell = read('src/components/evaluation/feedback360/ppt/Feedback360PptShell.tsx')
    const resultsPpt = read('src/components/evaluation/feedback360/ppt/Feedback360ResultsPpt.tsx')
    const server = read('src/server/feedback-360.ts')
    const tagPool = read('src/components/evaluation/feedback360/feedback360-response-tag-pool.ts')

    assert.equal(page.includes("mode: 'overview'"), true)
    assert.equal(page.includes('Feedback360WorkspaceClient'), true)
    assert.equal(workspace.includes("props.data.mode === 'overview'"), true)
    assert.equal(workspace.includes("props.data.state !== 'ready' && props.data.mode !== 'overview'"), true)

    for (const text of [
      '360 다면평가',
      '개요',
      '응답하기',
      '운영',
      '평가자 매핑',
      '결과',
      '평가 주기',
      '평가 분기',
      '1분기',
      '2분기',
      '3분기',
      '4분기',
      '해시태그',
      '해시태그로 동료 협업 경험 남기기',
      '평가 대상자를 선택한 뒤 긍정 태그와 보완 태그를 골라 주세요',
      '해시태그 예시 미리보기',
      '긍정 태그',
      '보완 태그',
      '선택한 태그',
      '공식 평가 점수나 등급을 자동 산정하지 않습니다',
      '360 다면평가 운영',
      '운영 준비',
      '선택한 분기에 진행 중인 라운드가 없습니다.',
      '라운드 생성',
      '/api/feedback/rounds/quarterly',
      '평가자 매핑 관리',
      '평가자 매핑 현황',
      '실제 매핑 설정은 평가자 매핑 화면에서 진행합니다',
      '평가자 매핑 화면 열기',
      'AI 평가자 추천',
      'AI/관계 점수 추천',
      '관계 데이터 양식 다운로드',
      '관계 데이터 업로드 미리보기',
      '업로드 데이터는 현재 추천 미리보기에만 사용됩니다.',
      '관계 점수',
      '사용된 데이터',
      '피평가자를 잘 아는 사람',
      '동일 조직 KPI',
      '동일 프로젝트 KPI',
      '월간 실적/체크인/댓글/협업 기록',
      '추천 근거',
      '추천 가능한 평가자가 없습니다',
      '선택한 분기',
      '진행 중 라운드 없음',
      '라운드를 먼저 생성해야 평가자 매핑을 진행할 수 있습니다.',
      '익명 기준',
      '단계별 현황',
      '비정기 다면평가',
      '태그 분포 / 결과 요약',
      '아직 결과를 표시할 수 없습니다.',
      '응답 수와 익명 기준이 충족되면 태그 분포와 반복 패턴이 표시됩니다.',
      '반복 관찰된 강점 태그',
      '반복 관찰된 보완 태그',
      '상위 카테고리',
      '협업 강점',
      '보완 필요 행동',
      '후속 액션',
      '리더/HR 참고 메모',
      '결과 공개 준비 상태',
      '익명 기준 충족 여부',
      '현재 배정된 응답 대상자가 없습니다. 라운드가 열리면 이곳에서 동료를 선택하고 해시태그로 응답할 수 있습니다.',
      '해당 분기에 배정된 응답이 없습니다',
      '선택한 분기에 진행 중인 360 다면평가가 없습니다',
      'HR 운영 탭에서 해당 분기 평가자 매핑 상태를 확인할 수 있습니다',
    ]) {
      assert.equal(`${workspace}\n${pptShell}\n${resultsPpt}\n${server}\n${tagPool}`.includes(text), true, `missing ${text}`)
    }

    assert.equal(pptShell.includes('role="tablist"'), true)
    assert.equal(pptShell.includes('role="tab"'), true)
    assert.equal(pptShell.includes('aria-selected={tab.active}'), true)
    assert.equal(workspace.includes("activeHubTab === 'respond'"), true)
    assert.equal(workspace.includes("tab')"), true)
    assert.equal(workspace.includes("quarter')"), true)
    assert.equal(workspace.includes('selectedQuarter'), true)
    assert.equal(workspace.includes('FEEDBACK_360_QUARTER_OPTIONS'), true)
    assert.equal(workspace.includes("activeHubTab === 'mapping'"), true)
    assert.equal(workspace.includes("buildHubHref('mapping')"), true)
    assert.equal(workspace.includes('{selectedQuarterLabel} 라운드 생성'), true)
    assert.equal(workspace.includes('handleCreateQuarterRound'), true)
    assert.equal(workspace.includes("nextParams.set('tab', 'operations')"), true)
    assert.equal(workspace.includes("nextParams.set('quarter', selectedQuarter)"), true)
  })

  await run('feedback 360 phase 6n removes the duplicate ppt sidebar and keeps ppt content surfaces', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const server = read('src/server/feedback-360.ts')
    const appShell = read('src/components/evaluation/feedback360/ppt/Feedback360PptAppShell.tsx')
    const avatar = read('src/components/evaluation/feedback360/ppt/Feedback360Avatar.tsx')
    const responseList = read('src/components/evaluation/feedback360/ppt/Feedback360ResponseListPpt.tsx')
    const responseForm = read('src/components/evaluation/feedback360/ppt/Feedback360ResponseFormPpt.tsx')
    const operations = read('src/components/evaluation/feedback360/ppt/Feedback360OperationsPpt.tsx')
    const mapping = read('src/components/evaluation/feedback360/ppt/Feedback360EvaluatorMappingPpt.tsx')
    const wrappers = [
      'src/components/evaluation/feedback360/ppt/Feedback360PptHeader.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360PptSummaryCards.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360ResultsReportPpt.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360VisibilitySettingsPpt.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360RelationshipTemplatePpt.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360MailDiagnosticsPpt.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360PptEmptyState.tsx',
      'src/components/evaluation/feedback360/ppt/Feedback360PptToastDialog.tsx',
    ].map(read).join('\n')
    const pptLayer = `${workspace}\n${server}\n${appShell}\n${avatar}\n${responseList}\n${responseForm}\n${operations}\n${mapping}\n${wrappers}`

    for (const text of [
      'Feedback360PptAppShell',
      'Feedback360PptHeader',
      'Feedback360PptSummaryCards',
      'Feedback360ResponseListPpt',
      'Feedback360ResponseFormPpt',
      'Feedback360ResultsReportPpt',
      'Feedback360OperationsPpt',
      'Feedback360EvaluatorMappingPpt',
      'Feedback360VisibilitySettingsPpt',
      'Feedback360RelationshipTemplatePpt',
      'Feedback360MailDiagnosticsPpt',
      'Feedback360Avatar',
      'Feedback360PptEmptyState',
      'Feedback360PptToastDialog',
      '내가 평가할 사람',
      '리포트 조회',
      'profileImageUrl',
      'avatarUrl',
      'picture',
      'onError={() => setFailed(true)}',
      'getAvatarInitials',
      '피평가자',
      '소속',
      '평가 기간',
      '진행률',
      '함께 일한 기간',
      '협업 빈도',
      '주요 협업 내용',
      '라운드/대상자 현황',
      '운영 작업',
      '평가자 매핑 화면 열기',
      '평가자 매핑 관리',
      '메일 발송 화면 열기',
    ]) {
      assert.equal(pptLayer.includes(text), true, `missing phase 6m ppt content text ${text}`)
    }

    assert.equal(
      existsSync(path.resolve(process.cwd(), 'src/components/evaluation/feedback360/ppt/Feedback360PptSidebar.tsx')),
      false,
      'duplicate PPT sidebar file should stay removed'
    )
    assert.equal(appShell.includes('Feedback360PptSidebar'), false, 'app shell should not render a duplicate PPT sidebar')
    assert.equal(appShell.includes('lg:grid-cols-[220px_minmax(0,1fr)]'), false, 'app shell should not reserve a duplicate PPT sidebar column')
    assert.equal(appShell.includes('lg:grid-cols-[88px_minmax(0,1fr)]'), false, 'app shell should not keep a collapsed duplicate PPT sidebar column')
    assert.equal(appShell.includes('다면평가 관리'), false, 'app shell should not render the removed internal sidebar title')
    assert.equal(appShell.includes('메뉴 접기'), false, 'app shell should not render the removed sidebar collapse button')
    assert.equal(workspace.includes('다면평가 (360도)'), true, 'workspace should keep the 360 response title')
    assert.equal(workspace.includes('내가 평가할 사람'), true, 'workspace should keep the response entry label')
    assert.equal(workspace.includes('리포트 조회'), true, 'workspace should keep the report entry label')
    assert.equal(appShell.includes('rounded-[28px]'), false, 'removed sidebar area should not remain as a framed blank PPT shell')
    assert.equal(appShell.includes('bg-[#f3f6fb]'), false, 'removed sidebar area should not remain as a gray blank background')
    assert.equal(appShell.includes('max-w-[1360px]'), false, 'main content should not be centered inside an old fixed-width frame')
    assert.equal(appShell.includes('max-w-[1480px]'), false, 'main content should not be constrained to a small centered PPT canvas')
    assert.equal(appShell.includes('max-w-none'), true, 'main content should use the available app canvas width')
    assert.equal(appShell.includes('lg:ml-16'), false, 'main content should not be pushed inward by an artificial left offset')
    assert.equal(appShell.includes('w-[calc(100%_-_4rem)]'), false, 'main content should not shrink itself with calc width offsets')
    assert.equal(appShell.includes('mx-auto'), false, 'main content should not be centered inside an old shell frame')
    assert.equal(workspace.includes('xl:grid-cols-[minmax(0,1fr)_340px]'), false, 'overview body should not keep the old narrow right rail layout')
    assert.equal(workspace.includes('xl:grid-cols-[minmax(0,1fr)_320px]'), false, 'overview body should not keep the old narrow right rail layout')
    assert.equal(workspace.includes('min-w-[980px] xl:min-w-full'), false, 'response table should no longer require horizontal scroll width')
    assert.equal(workspace.includes('min-w-[760px]'), false, 'operations mapping table should no longer require horizontal scroll width')

    for (const forbidden of [
      '워드클라우드 다면평가',
      'fake wordcloud',
      'PDF 다운로드',
      'PDF 열기',
      'AI reviewer recommendation preview',
      'NEEDS_BACKEND_FOLLOWUP',
      'Too small',
      '�',
    ]) {
      assert.equal(`${appShell}\n${responseList}\n${responseForm}\n${operations}\n${mapping}`.includes(forbidden), false, `${forbidden} should stay absent in PPT layer`)
    }
  })

  await run('feedback 360 operations can create a selected quarter round through guarded route', () => {
    const route = read('src/app/api/feedback/rounds/quarterly/route.ts')

    for (const text of [
      'Feedback360QuarterRoundCreateSchema',
      "z.enum(['Q1', 'Q2', 'Q3', 'Q4'])",
      'CreateFeedbackRoundSchema',
      "roundType: 'FULL_360'",
      "status: 'DRAFT'",
      'getFeedbackReviewAdminAccess',
      'canManageAllRounds',
      'canManageCollaboratorRounds',
      'multiFeedbackRound.create',
      'DEFAULT_FEEDBACK_360_QUESTIONS',
      'FEEDBACK_360_QUARTER_ROUND_CREATED',
      "SELF: 'ANONYMOUS'",
      "SUPERVISOR: 'ANONYMOUS'",
    ]) {
      assert.equal(route.includes(text), true, `missing ${text}`)
    }

    assert.equal(route.includes('schema.prisma'), false)
    assert.equal(route.includes('Evaluation.totalScore'), false)
    assert.equal(route.includes('Evaluation.gradeId'), false)
  })

  await run('feedback 360 hub keeps forbidden workbench and official write copy absent', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const adminPanel = read('src/components/evaluation/feedback360/Feedback360AdminPanel.tsx')
    const server = read('src/server/feedback-360.ts')
    const navigation = read('src/lib/navigation.ts')
    const feedback360VisibleSurfaces = `${workspace}\n${adminPanel}`

    for (const forbidden of [
      '평가 워크벤치',
      '평가 워크벤치 미리보기',
      'HR 평가 운영 대시보드',
      '자동 등급 반영',
      'AI 점수 산정',
      '공식 점수 반영',
      'Evaluation.totalScore / gradeId 저장 없음',
      'Evaluation.totalScore 저장',
      'Evaluation.gradeId 저장',
      'NEEDS_BACKEND_FOLLOWUP',
      'callback',
      'backend',
      'API 연결 필요',
      '기존 운영 화면에서 확인',
      '기존 운영 화면으로 이동',
      'PDF 열기',
      'PDF 다운로드',
      '리포트 다운로드',
      'CYCLE',
      'ROUND',
      'label="nomination"',
      '리뷰어 nomination',
      '360 Feedback',
    ]) {
      assert.equal(feedback360VisibleSurfaces.includes(forbidden), false, `${forbidden} should not render in 360 feedback surfaces`)
    }

    assert.equal(server.includes('새로운 라운드를 생성하거나 기존 평가 워크벤치'), false)
    assert.equal(navigation.includes('360 다면평가 운영'), false)
  })

  await run('feedback 360 phase 6e end-to-end cycle scenarios stay connected', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')
    const tagPool = read('src/components/evaluation/feedback360/feedback360-response-tag-pool.ts')
    const route = read('src/app/api/feedback/rounds/quarterly/route.ts')
    const server = read('src/server/feedback-360.ts')
    const navigation = read('src/lib/navigation.ts')
    const packageJson = read('package.json')

    for (const text of [
      'selectedQuarterLabel} 운영 준비',
      '진행 중 라운드 없음',
      '라운드를 먼저 생성해야 평가자 매핑을 진행할 수 있습니다.',
      'selectedQuarterLabel} 라운드 생성',
      '평가자 매핑 화면 열기',
      '공개 범위: 전체 익명',
      '평가자별 공개 범위 설정',
      '추천 가능한 평가자가 없습니다',
    ]) {
      assert.equal(`${workspace}\n${nominationPanel}`.includes(text), true, `missing scenario 1 text ${text}`)
    }

    for (const text of [
      '라운드명',
      '기간',
      '상태',
      '평가자 매핑 화면에서 설정',
      'AI 평가자 추천',
      'AI/관계 점수 추천',
      '관계 데이터 양식 다운로드',
      '관계 데이터 업로드 미리보기',
      '업로드 미리보기',
      '평가자 추천 후보',
      '평가자 추천 미리보기',
      '추천 근거',
      '추천 후보 적용',
      '피평가자를 잘 아는 사람',
      '평가자 검색',
      '이름, 부서, 팀, 직책 검색',
      '같은 팀 1명 / 같은 본부 2명 / 타 본부 2명',
      '5명 추천 슬롯',
      '프로젝트/KPI 접점',
      '최근 협업',
      '타 본부 추천 후보 부족',
    ]) {
      assert.equal(`${workspace}\n${nominationPanel}`.includes(text), true, `missing scenario 2 text ${text}`)
    }

    for (const text of [
      '해시태그로 동료 협업 경험 남기기',
      '긍정 태그',
      '보완 태그',
      '구체적 사례 / 종합 의견',
      '선택한 태그',
      '제출 요약',
      'FEEDBACK_360_TAG_SUMMARY_HEADING',
      '공식 점수/등급',
      '자동 산정 없음',
    ]) {
      assert.equal(workspace.includes(text), true, `missing scenario 3 text ${text}`)
    }
    assert.equal(tagPool.includes("FEEDBACK_360_TAG_SUMMARY_HEADING = '[선택 태그 요약]'"), true)

    for (const text of [
      '태그 분포 / 결과 요약',
      '아직 결과를 표시할 수 없습니다.',
      '반복 관찰된 강점 태그',
      '반복 관찰된 보완 태그',
      '상위 카테고리',
      '협업 강점',
      '보완 필요 행동',
      '후속 액션',
      '리더/HR 참고 메모',
      '익명 기준 충족 여부',
      '결과 공개 준비 상태',
      '임의 점수, 임의 순위, 임의 태그 분포는 표시하지 않습니다.',
    ]) {
      assert.equal(workspace.includes(text), true, `missing scenario 4 text ${text}`)
    }

    assert.equal(navigation.includes('/evaluation/word-cloud-360'), false)
    assert.equal(packageJson.includes('test:wordcloud360'), false)
    assert.equal(route.includes("z.enum(['Q1', 'Q2', 'Q3', 'Q4'])"), true)
    assert.equal(workspace.includes("nextParams.set('quarter', selectedQuarter)"), true)
    assert.equal(workspace.includes('selectedHubRound ? ('), true)
    assert.equal(workspace.includes('dedupeFeedback360ResponseTargets(quarterPendingRequests, {'), true)
    assert.equal(workspace.includes('groupByRound: false'), true)
    assert.equal(workspace.includes('scopeKey: selectedQuarter'), true)
    assert.equal(server.includes('const pendingRequests = Array.from(pendingRequestMap.values())'), true)
    assert.equal(workspace.includes('quarterResponseTargets.map((target) => buildFeedback360ResponseRow(target, quarterRounds))'), true)
    assert.equal(workspace.includes('finalFilteredResponseRows = dedupeFeedback360ResponseTargets(filteredResponseRows, {'), true)
    assert.equal(workspace.includes('key={target.uniqueKey}'), true)
    assert.equal(workspace.includes('formatFeedback360RelationshipLabels(target.relationships)'), true)
    assert.equal(workspace.includes('{respondData.relationship}'), false)
    assert.equal(workspace.includes('{respondData.status}'), false)
    assert.equal(workspace.includes('key={item}'), false)
    assert.equal(nominationPanel.includes('-PEER'), false)
  })

  await run('feedback 360 response tab dedupes duplicate assignees by quarter and receiver', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const requests = [
      {
        feedbackId: 'fb-eunhye-peer-a',
        roundId: 'round-q2',
        roundName: '2분기',
        receiverId: 'emp-park-eunhye',
        receiverName: '박은혜',
        relationship: 'PEER',
        dueDate: '2026.06.30',
        href: '/evaluation/360/respond/fb-eunhye-peer-a',
        status: 'PENDING',
      },
      {
        feedbackId: 'fb-eunhye-peer-b',
        roundId: 'round-q2-duplicate',
        roundName: '2분기 추가 라운드',
        receiverId: 'emp-park-eunhye',
        receiverName: '박은혜',
        relationship: 'PEER',
        dueDate: '2026.06.30',
        href: '/evaluation/360/respond/fb-eunhye-peer-b',
        status: 'PENDING',
      },
      {
        feedbackId: 'fb-jongjin-peer',
        roundId: 'round-q2',
        roundName: '2분기',
        receiverId: 'emp-park-jongjin',
        receiverName: '박종진',
        relationship: 'PEER',
        dueDate: '2026.06.29',
        href: '/evaluation/360/respond/fb-jongjin-peer',
        status: 'PENDING',
      },
      {
        feedbackId: 'fb-jongjin-cross',
        roundId: 'round-q2',
        roundName: '2분기',
        receiverId: 'emp-park-jongjin',
        receiverName: '박종진',
        relationship: 'CROSS_TEAM_PEER',
        dueDate: '2026.06.28',
        href: '/evaluation/360/respond/fb-jongjin-cross',
        status: 'IN_PROGRESS',
        selectedTagCount: 2,
      },
      {
        feedbackId: 'fb-jisu-a',
        roundId: 'round-q2',
        roundName: '2분기',
        receiverId: 'emp-kim-jisu',
        receiverName: '김지수',
        relationship: 'SUBORDINATE',
        dueDate: '2026.06.30',
        href: '/evaluation/360/respond/fb-jisu-a',
        status: 'PENDING',
      },
      {
        feedbackId: 'fb-jisu-b',
        roundId: 'round-q2-duplicate',
        roundName: '2분기 추가 라운드',
        receiverId: 'emp-kim-jisu',
        receiverName: '김지수',
        relationship: 'SUBORDINATE',
        dueDate: '2026.06.30',
        href: '/evaluation/360/respond/fb-jisu-b',
        status: 'PENDING',
      },
    ]

    const targets = dedupeFeedback360ResponseTargets(requests, {
      groupByRound: false,
      scopeKey: 'Q2',
    })
    assert.equal(targets.length, 3)
    assert.equal(targets.filter((target) => target.receiverName === '박은혜').length, 1)
    assert.equal(targets.filter((target) => target.receiverName === '박종진').length, 1)
    assert.equal(targets.filter((target) => target.receiverName === '김지수').length, 1)

    const eunhye = targets.find((target) => target.receiverName === '박은혜')
    assert.deepEqual(eunhye?.relationships, ['PEER'])
    assert.equal(eunhye?.duplicateCount, 2)
    assert.equal(eunhye?.uniqueKey, 'scope:Q2:receiver:emp-park-eunhye')
    assert.equal(eunhye?.uniqueKey.includes('-PEER'), false)

    const jongjin = targets.find((target) => target.receiverName === '박종진')
    assert.deepEqual(jongjin?.relationships, ['PEER', 'CROSS_TEAM_PEER'])
    assert.equal(jongjin?.dueDate, '2026.06.28')
    assert.equal(jongjin?.canonicalFeedbackId, 'fb-jongjin-cross')
    assert.equal(jongjin?.href, '/evaluation/360/respond/fb-jongjin-cross')

    assert.equal(
      buildFeedback360ResponseTargetDedupeKey({
        feedbackId: 'fb-fallback',
        roundId: 'round-q2',
        receiverName: '이름만있는대상',
        receiverDepartmentName: '인사팀',
      }),
      'round:round-q2:name:이름만있는대상:인사팀'
    )
    assert.equal(
      buildFeedback360ResponseTargetDedupeKey(
        {
          feedbackId: 'fb-fallback',
          roundId: 'round-q2-extra',
          receiverName: '이름만있는대상',
          receiverDepartmentName: '인사팀',
        },
        0,
        { groupByRound: false, scopeKey: 'Q2' }
      ),
      'scope:Q2:name:이름만있는대상:인사팀'
    )
    assert.equal(workspace.includes('key={target.uniqueKey}'), true)
    assert.equal(workspace.includes('key={request.feedbackId}'), false)
  })

  await run('feedback 360 nomination panel keeps recommendation and visibility copy usable', () => {
    const nominationPanel = read('src/components/evaluation/feedback360/ReviewerNominationPanel.tsx')
    const relationshipTemplatePanel = read('src/components/evaluation/feedback360/ppt/Feedback360RelationshipTemplatePanel.tsx')
    const visibilitySettingsPanel = read('src/components/evaluation/feedback360/ppt/Feedback360VisibilitySettings.tsx')
    const aiAssist = read('src/lib/ai-assist.ts')
    const analysisView = read('src/components/evaluation/feedback360/FeedbackReportAnalysisView.tsx')
    const nominationSurfaces = `${nominationPanel}\n${relationshipTemplatePanel}\n${visibilitySettingsPanel}\n${aiAssist}`

    for (const text of [
      '공개 범위: 전체 익명',
      '평가자별 공개 범위 설정',
      '평가자 추천 후보',
      '평가자 추천 미리보기',
      'AI 추천 결과 패널',
      'AI/관계 점수 추천',
      '관계 데이터 양식 다운로드',
      '관계 데이터 업로드 미리보기',
      '업로드된 관계 데이터가 없습니다.',
      '수동관계점수는 0~100 숫자',
      'RELATIONSHIP_TEMPLATE_COLUMNS',
      'RELATIONSHIP_UPLOAD_HEADER_ALIASES',
      'RELATIONSHIP_UPLOAD_ALLOWED_TYPES',
      '사번',
      '성명',
      '상위관리자사번',
      '협업자사번',
      '수동관계점수',
      "return `\\uFEFF${[",
      'feedback360-관계데이터-양식.csv',
      'Feedback360RelationshipTemplatePanel',
      'Feedback360VisibilitySettings',
      'scoreReviewerCandidate',
      'relationshipScoreSources',
      '추천 근거',
      '추천 가능한 평가자가 없습니다',
      'reviewerFilterCounts',
      '{filter.label} {reviewerFilterCounts.get(filter.value) ?? 0}',
      '같은 팀 추천 후보 부족',
      '같은 본부 추천 후보 부족',
      '타 본부 추천 후보 부족',
      '추천 후보 적용',
      '응답 시작',
      'AI 기능이 꺼져 있어 기본 추천 기준으로 후보를 표시합니다.',
    ]) {
      assert.equal(nominationSurfaces.includes(text), true, `missing ${text}`)
    }

    for (const forbidden of [
      'AI reviewer recommendation preview',
      'OpenAI 추천',
      'Fallback preview',
      'PDF 열기',
      'PDF 다운로드',
      'PDF로 열기',
      '리포트 다운로드',
      '발행',
    ]) {
      assert.equal(`${nominationPanel}\n${analysisView}`.includes(forbidden), false, `${forbidden} should not render in 360 feedback surfaces`)
    }

    for (const text of [
      'function buildNominationRowKey',
      "key={buildVisibilityRowKey(['visibility-setting'",
      "key={buildRelationshipPreviewKey(['relationship-upload-error'",
      "key={buildNominationRowKey([\n                    'recommendation'",
      "key={buildNominationRowKey([\n                        'reviewer'",
      "key={buildNominationRowKey([\n                  'selected'",
      "key={buildNominationRowKey(['guidance'",
    ]) {
      assert.equal(`${nominationPanel}\n${relationshipTemplatePanel}\n${visibilitySettingsPanel}`.includes(text), true, `missing unique nomination key pattern ${text}`)
    }

    for (const riskyKeyPattern of [
      'key={`${reviewer.employeeId}-${reviewer.relationship}`}',
      'key={reviewer.employeeId}',
      'key={relationship}',
      'key={item}',
      '-PEER',
    ]) {
      assert.equal(nominationPanel.includes(riskyKeyPattern), false, `${riskyKeyPattern} should not be used as a React key`)
    }
  })

  await run('feedback 360 phase 6f ppt visual report and response layout stay wired', () => {
    const workspace = read('src/components/evaluation/feedback360/Feedback360WorkspaceClient.tsx')
    const appShell = read('src/components/evaluation/feedback360/ppt/Feedback360PptAppShell.tsx')
    const primitives = read('src/components/evaluation/feedback360/ppt/Feedback360PptPrimitives.tsx')
    const responseListPpt = read('src/components/evaluation/feedback360/ppt/Feedback360ResponseListPpt.tsx')
    const responseFormPpt = read('src/components/evaluation/feedback360/ppt/Feedback360ResponseFormPpt.tsx')
    const resultsPpt = read('src/components/evaluation/feedback360/ppt/Feedback360ResultsPpt.tsx')
    const workspaceAndResultsPpt = `${workspace}\n${appShell}\n${primitives}\n${responseListPpt}\n${responseFormPpt}\n${resultsPpt}`

    for (const text of [
      '내가 평가할 사람',
      '전체 평가 대상',
      '평가 완료',
      '진행 중',
      '미평가',
      '종료일',
      '이름/부서 검색',
      '전체 상태',
      '전체 팀/본부',
      '마감일 빠른순',
      '피평가자',
      '직급/관계',
      '진행률',
      '평가하기',
      '평가 계속하기',
      '결과 보기',
      '평가 대상자',
      '함께 일한 기간',
      '협업 빈도',
      '주요 협업 내용',
      '해시태그를 선택하면 평가에 반영됩니다.',
      '긍정 태그는 최대 3개, 보완 태그는 최대 2개를 권장합니다.',
      '보완하면 좋을 점',
      '이전 사람',
      '다음 사람',
      '다면평가 리포트',
      'radar chart / 카테고리 밀도',
      '강점 Top 3',
      '보완 Top 3',
      '카테고리별 bar chart',
      '강점 count / 보완 count',
      '태그 클러스터 / 키워드 영역',
      '결과 탭 내부에서만 실제 빈도 기반 chip cluster',
      '리뷰 상세 내역',
      '원문 보기',
      'Feedback360TagBadge',
      'buildFeedback360ResultVisualModel',
      'buildFeedback360ResponseRow',
      'parseFeedback360TagSummaryFromComment(originalText)',
      'card.originalText',
    ]) {
      assert.equal(workspaceAndResultsPpt.includes(text), true, `missing phase 6f visual text ${text}`)
    }

    for (const phase6GText of [
      'minmax(180px,1.35fr)',
      'min-w-0 items-center justify-center gap-1.5',
      'overflow-hidden',
      'w-full max-w-full overflow-x-hidden',
      'truncate whitespace-nowrap',
      '표시 대상 {finalFilteredResponseRows.length}명',
      '같은 피평가자는 렌더링 직전 한 번 더 병합됩니다.',
      '리포트 캐시가 준비되었습니다.',
      '리포트 보기',
      '결과 탭으로 이동',
      '결과 공유 메일 준비',
    ]) {
      assert.equal(`${workspace}\n${appShell}\n${responseListPpt}`.includes(phase6GText), true, `missing phase 6g response layout text ${phase6GText}`)
    }

    assert.equal(workspace.includes('break-all'), false, 'response workspace should not use break-all text layout')
    assert.equal(workspace.includes('min-w-[980px] xl:min-w-full'), false, 'response table should not depend on a forced horizontal scroll width')
    assert.equal(workspace.includes('min-w-[760px]'), false, 'operations mapping table should not depend on a forced horizontal scroll width')

    for (const forbidden of [
      'fake wordcloud',
      'fake ranking',
      'fake score',
      'PDF 열기',
      'PDF 다운로드',
      '워드클라우드 다면평가',
    ]) {
      assert.equal(workspaceAndResultsPpt.includes(forbidden), false, `${forbidden} should stay absent`)
    }
  })

  await run('feedback 360 operations are nested inside the hub navigation', () => {
    const feedback360NavItems = flattenNavigationItems(NAV_ITEMS).filter((item) =>
      item.href.startsWith('/evaluation/360')
    )

    assert.deepEqual(
      feedback360NavItems.map((item) => item.href),
      ['/evaluation/360']
    )
    assert.equal(feedback360NavItems[0].label, '360 다면평가')
    assert.equal(feedback360NavItems[0].menuKey, 'FEEDBACK_360')
  })

  console.log('Feedback 360 hub route tests completed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
