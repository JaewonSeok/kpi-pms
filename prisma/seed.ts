import {
  PrismaClient,
  Position,
  SystemRole,
  EmployeeStatus,
  AiCompetencyTrack,
  AiCompetencyDomain,
  AiCompetencyDifficulty,
  AiCompetencyQuestionType,
} from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as any)
const allowedDomain = process.env.ALLOWED_DOMAIN?.trim() || 'company.com'

function buildWorkspaceEmail(localPart: string) {
  return `${localPart}@${allowedDomain}`
}

async function main() {
  console.log('🌱 Seeding database...')

  // 1. 조직 생성
  const org = await prisma.organization.upsert({
    where: { id: 'org-1' },
    update: {},
    create: {
      id: 'org-1',
      name: '(주)샘플기업',
      fiscalYear: 2026,
    },
  })
  console.log('✅ Organization created:', org.name)

  // 2. 부서 생성 (본부-실-팀 계층)
  const hqDept = await prisma.department.upsert({
    where: { deptCode: 'HQ' },
    update: {},
    create: { deptCode: 'HQ', deptName: '경영본부', orgId: org.id },
  })

  const bizDiv = await prisma.department.upsert({
    where: { deptCode: 'BIZ-DIV' },
    update: {},
    create: { deptCode: 'BIZ-DIV', deptName: '사업본부', orgId: org.id, parentDeptId: hqDept.id },
  })

  const devDept = await prisma.department.upsert({
    where: { deptCode: 'DEV-SEC' },
    update: {},
    create: { deptCode: 'DEV-SEC', deptName: '개발실', orgId: org.id, parentDeptId: bizDiv.id },
  })

  const devTeam = await prisma.department.upsert({
    where: { deptCode: 'DEV-TEAM-1' },
    update: {},
    create: { deptCode: 'DEV-TEAM-1', deptName: '개발1팀', orgId: org.id, parentDeptId: devDept.id },
  })

  const hrDept = await prisma.department.upsert({
    where: { deptCode: 'HR-TEAM' },
    update: {},
    create: { deptCode: 'HR-TEAM', deptName: 'HR팀', orgId: org.id, parentDeptId: hqDept.id },
  })

  console.log('✅ Departments created')

  // 3. 임직원 생성
  const ceo = await prisma.employee.upsert({
    where: { empId: 'EMP-2020-001' },
    update: {
      gwsEmail: buildWorkspaceEmail('ceo'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2020-001',
      empName: '김대표',
      gwsEmail: buildWorkspaceEmail('ceo'),
      position: Position.CEO,
      role: SystemRole.ROLE_CEO,
      deptId: hqDept.id,
      joinDate: new Date('2020-01-01'),
      currentSalary: 180000000,
      status: EmployeeStatus.ACTIVE,
    },
  })

  const divHead = await prisma.employee.upsert({
    where: { empId: 'EMP-2021-001' },
    update: {
      gwsEmail: buildWorkspaceEmail('divhead'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2021-001',
      empName: '이본부장',
      gwsEmail: buildWorkspaceEmail('divhead'),
      position: Position.DIV_HEAD,
      role: SystemRole.ROLE_DIV_HEAD,
      deptId: bizDiv.id,
      joinDate: new Date('2021-03-01'),
      currentSalary: 130000000,
      status: EmployeeStatus.ACTIVE,
      divisionHeadId: ceo.id,
    },
  })

  const sectionChief = await prisma.employee.upsert({
    where: { empId: 'EMP-2021-002' },
    update: {
      gwsEmail: buildWorkspaceEmail('section'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2021-002',
      empName: '박실장',
      gwsEmail: buildWorkspaceEmail('section'),
      position: Position.SECTION_CHIEF,
      role: SystemRole.ROLE_SECTION_CHIEF,
      deptId: devDept.id,
      joinDate: new Date('2021-06-01'),
      currentSalary: 105000000,
      status: EmployeeStatus.ACTIVE,
      sectionChiefId: divHead.id,
      divisionHeadId: divHead.id,
    },
  })

  const teamLeader = await prisma.employee.upsert({
    where: { empId: 'EMP-2022-001' },
    update: {
      gwsEmail: buildWorkspaceEmail('leader'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2022-001',
      empName: '최팀장',
      gwsEmail: buildWorkspaceEmail('leader'),
      position: Position.TEAM_LEADER,
      role: SystemRole.ROLE_TEAM_LEADER,
      deptId: devTeam.id,
      joinDate: new Date('2022-01-01'),
      currentSalary: 90000000,
      status: EmployeeStatus.ACTIVE,
      teamLeaderId: sectionChief.id,
      sectionChiefId: sectionChief.id,
      divisionHeadId: divHead.id,
    },
  })

  const member1 = await prisma.employee.upsert({
    where: { empId: 'EMP-2023-001' },
    update: {
      gwsEmail: buildWorkspaceEmail('member1'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2023-001',
      empName: '김팀원',
      gwsEmail: buildWorkspaceEmail('member1'),
      position: Position.MEMBER,
      role: SystemRole.ROLE_MEMBER,
      deptId: devTeam.id,
      joinDate: new Date('2023-03-01'),
      currentSalary: 62000000,
      status: EmployeeStatus.ACTIVE,
      teamLeaderId: teamLeader.id,
      sectionChiefId: sectionChief.id,
      divisionHeadId: divHead.id,
    },
  })

  const member2 = await prisma.employee.upsert({
    where: { empId: 'EMP-2023-002' },
    update: {
      gwsEmail: buildWorkspaceEmail('member2'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2023-002',
      empName: '이팀원',
      gwsEmail: buildWorkspaceEmail('member2'),
      position: Position.MEMBER,
      role: SystemRole.ROLE_MEMBER,
      deptId: devTeam.id,
      joinDate: new Date('2023-06-01'),
      currentSalary: 58000000,
      status: EmployeeStatus.ACTIVE,
      teamLeaderId: teamLeader.id,
      sectionChiefId: sectionChief.id,
      divisionHeadId: divHead.id,
    },
  })

  const hrAdmin = await prisma.employee.upsert({
    where: { empId: 'EMP-2022-002' },
    update: {
      gwsEmail: buildWorkspaceEmail('admin'),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      empId: 'EMP-2022-002',
      empName: '정관리자',
      gwsEmail: buildWorkspaceEmail('admin'),
      position: Position.MEMBER,
      role: SystemRole.ROLE_ADMIN,
      deptId: hrDept.id,
      joinDate: new Date('2022-05-01'),
      currentSalary: 70000000,
      status: EmployeeStatus.ACTIVE,
    },
  })

  console.log('✅ Employees created:', [ceo, divHead, sectionChief, teamLeader, member1, member2, hrAdmin].map(e => e.empName).join(', '))

  // 4. 등급 설정 (2026년)
  const gradeSettings = [
    { gradeOrder: 1, gradeName: 'A+', baseScore: 100, minScore: 96, maxScore: 100, levelName: '최우수', description: '목표 대비 월등히 탁월한 성과', targetDistRate: 5 },
    { gradeOrder: 2, gradeName: 'A0', baseScore: 95, minScore: 91, maxScore: 95, levelName: '우수', description: '목표 대비 탁월한 성과', targetDistRate: 10 },
    { gradeOrder: 3, gradeName: 'B+', baseScore: 90, minScore: 86, maxScore: 90, levelName: '현저', description: '목표 대비 상당히 우수한 성과', targetDistRate: 15 },
    { gradeOrder: 4, gradeName: 'B0', baseScore: 85, minScore: 81, maxScore: 85, levelName: '양호', description: '목표를 충실히 달성', targetDistRate: 30 },
    { gradeOrder: 5, gradeName: 'C0', baseScore: 80, minScore: 76, maxScore: 80, levelName: '보통', description: '목표 대비 무난한 성과', targetDistRate: 25 },
    { gradeOrder: 6, gradeName: 'D+', baseScore: 75, minScore: 71, maxScore: 75, levelName: '미흡', description: '목표 대비 다소 부족', targetDistRate: 10 },
    { gradeOrder: 7, gradeName: 'D0', baseScore: 70, minScore: 66, maxScore: 70, levelName: '불량', description: '목표 대비 상당히 부족', targetDistRate: 3 },
    { gradeOrder: 8, gradeName: 'E+', baseScore: 65, minScore: 61, maxScore: 65, levelName: '매우불량', description: '목표 대비 현저히 부족', targetDistRate: 1 },
    { gradeOrder: 9, gradeName: 'E0', baseScore: 60, minScore: 0, maxScore: 60, levelName: '최하', description: '성과가 매우 저조', targetDistRate: 1 },
  ]

  for (const grade of gradeSettings) {
    await prisma.gradeSetting.upsert({
      where: { orgId_evalYear_gradeName: { orgId: org.id, evalYear: 2026, gradeName: grade.gradeName } },
      update: {},
      create: { orgId: org.id, evalYear: 2026, ...grade },
    })
  }
  console.log('✅ Grade settings created for 2026')

  const storedGrades = await prisma.gradeSetting.findMany({
    where: { orgId: org.id, evalYear: 2026 },
    orderBy: { gradeOrder: 'asc' },
  })

  const existingRuleSet = await prisma.compensationRuleSet.findFirst({
    where: { orgId: org.id, evalYear: 2026, versionNo: 1 },
  })

  if (!existingRuleSet) {
    await prisma.compensationRuleSet.create({
      data: {
        orgId: org.id,
        evalYear: 2026,
        versionNo: 1,
        changeReason: 'Initial seeded compensation rule set',
        createdById: hrAdmin.id,
        isActive: true,
        rules: {
          create: [
            { gradeName: 'A+', bonusRate: 28, salaryIncreaseRate: 9, gradeSettingId: storedGrades.find(g => g.gradeName === 'A+')?.id },
            { gradeName: 'A0', bonusRate: 22, salaryIncreaseRate: 7, gradeSettingId: storedGrades.find(g => g.gradeName === 'A0')?.id },
            { gradeName: 'B+', bonusRate: 16, salaryIncreaseRate: 5, gradeSettingId: storedGrades.find(g => g.gradeName === 'B+')?.id },
            { gradeName: 'B0', bonusRate: 10, salaryIncreaseRate: 3, gradeSettingId: storedGrades.find(g => g.gradeName === 'B0')?.id },
            { gradeName: 'C0', bonusRate: 6, salaryIncreaseRate: 1.5, gradeSettingId: storedGrades.find(g => g.gradeName === 'C0')?.id },
            { gradeName: 'D+', bonusRate: 2, salaryIncreaseRate: 0.5, gradeSettingId: storedGrades.find(g => g.gradeName === 'D+')?.id },
            { gradeName: 'D0', bonusRate: 0, salaryIncreaseRate: 0, gradeSettingId: storedGrades.find(g => g.gradeName === 'D0')?.id },
            { gradeName: 'E+', bonusRate: 0, salaryIncreaseRate: 0, gradeSettingId: storedGrades.find(g => g.gradeName === 'E+')?.id },
            { gradeName: 'E0', bonusRate: 0, salaryIncreaseRate: 0, gradeSettingId: storedGrades.find(g => g.gradeName === 'E0')?.id },
          ],
        },
      },
    })
  }
  console.log('✅ Compensation rule set created for 2026')

  // 5. 평가 주기 생성
  const evalCycle = await prisma.evalCycle.upsert({
    where: { id: 'cycle-2026' },
    update: {},
    create: {
      id: 'cycle-2026',
      orgId: org.id,
      evalYear: 2026,
      cycleName: '2026년 연간 성과평가',
      status: 'KPI_SETTING',
      kpiSetupStart: new Date('2026-01-02'),
      kpiSetupEnd: new Date('2026-01-31'),
      selfEvalStart: new Date('2026-12-01'),
      selfEvalEnd: new Date('2026-12-15'),
      firstEvalStart: new Date('2026-12-16'),
      firstEvalEnd: new Date('2026-12-22'),
      secondEvalStart: new Date('2026-12-23'),
      secondEvalEnd: new Date('2026-12-26'),
      finalEvalStart: new Date('2026-12-27'),
      finalEvalEnd: new Date('2026-12-29'),
      ceoAdjustStart: new Date('2026-12-30'),
      ceoAdjustEnd: new Date('2026-12-31'),
      resultOpenStart: new Date('2027-01-15'),
      resultOpenEnd: new Date('2027-01-31'),
      appealDeadline: new Date('2027-02-05'),
    },
  })
  console.log('✅ Eval cycle created:', evalCycle.cycleName)

  const aiCycle = await prisma.aiCompetencyCycle.upsert({
    where: { evalCycleId: evalCycle.id },
    update: {
      cycleName: '2026 AI 활용능력 평가',
      status: 'PUBLISHED',
      firstRoundOpenAt: new Date('2026-03-01T09:00:00+09:00'),
      firstRoundCloseAt: new Date('2026-03-10T18:00:00+09:00'),
      secondRoundApplyOpenAt: new Date('2026-03-11T09:00:00+09:00'),
      secondRoundApplyCloseAt: new Date('2026-03-31T18:00:00+09:00'),
      reviewOpenAt: new Date('2026-03-20T09:00:00+09:00'),
      reviewCloseAt: new Date('2026-04-10T18:00:00+09:00'),
      calibrationOpenAt: new Date('2026-04-11T09:00:00+09:00'),
      calibrationCloseAt: new Date('2026-04-15T18:00:00+09:00'),
      resultPublishAt: new Date('2026-04-20T09:00:00+09:00'),
      firstRoundPassThreshold: 70,
      secondRoundBonusCap: 10,
      scoreCap: 100,
      timeLimitMinutes: 60,
      randomizeQuestions: true,
      companyEmailDomain: allowedDomain,
      artifactMinCount: 2,
      artifactMaxCount: 3,
      policyAcknowledgementText: 'AI 활용능력 평가 운영 정책과 개인정보/보안 지침을 확인했습니다.',
      updatedById: hrAdmin.id,
    },
    create: {
      id: 'ai-cycle-2026',
      evalCycleId: evalCycle.id,
      cycleName: '2026 AI 활용능력 평가',
      status: 'PUBLISHED',
      firstRoundOpenAt: new Date('2026-03-01T09:00:00+09:00'),
      firstRoundCloseAt: new Date('2026-03-10T18:00:00+09:00'),
      secondRoundApplyOpenAt: new Date('2026-03-11T09:00:00+09:00'),
      secondRoundApplyCloseAt: new Date('2026-03-31T18:00:00+09:00'),
      reviewOpenAt: new Date('2026-03-20T09:00:00+09:00'),
      reviewCloseAt: new Date('2026-04-10T18:00:00+09:00'),
      calibrationOpenAt: new Date('2026-04-11T09:00:00+09:00'),
      calibrationCloseAt: new Date('2026-04-15T18:00:00+09:00'),
      resultPublishAt: new Date('2026-04-20T09:00:00+09:00'),
      firstRoundPassThreshold: 70,
      secondRoundBonusCap: 10,
      scoreCap: 100,
      timeLimitMinutes: 60,
      randomizeQuestions: true,
      companyEmailDomain: allowedDomain,
      artifactMinCount: 2,
      artifactMaxCount: 3,
      policyAcknowledgementText: 'AI 활용능력 평가 운영 정책과 개인정보/보안 지침을 확인했습니다.',
      createdById: hrAdmin.id,
      updatedById: hrAdmin.id,
    },
  })
  console.log('✅ AI competency cycle created:', aiCycle.cycleName)

  const aiQuestions = [
    {
      id: 'ai-q-2026-foundation',
      track: null,
      competencyDomain: AiCompetencyDomain.AI_FOUNDATION,
      questionType: AiCompetencyQuestionType.SINGLE_CHOICE,
      difficulty: AiCompetencyDifficulty.BASIC,
      title: '생성형 AI 기본 이해',
      prompt: '생성형 AI 활용 시 가장 먼저 확인해야 하는 항목으로 가장 적절한 것은 무엇인가요?',
      options: ['업무 적합성', '폰트 종류', '회의 시간', '사내 좌석 배치'],
      answerKey: '업무 적합성',
      explanation: '업무 목적과 활용 적합성을 먼저 확인해야 합니다.',
      maxScore: 25,
      sortOrder: 10,
      isCommon: true,
      tags: ['foundation', 'policy'],
    },
    {
      id: 'ai-q-2026-prompt',
      track: null,
      competencyDomain: AiCompetencyDomain.PROMPT_CONTEXT_DESIGN,
      questionType: AiCompetencyQuestionType.SCENARIO_JUDGEMENT,
      difficulty: AiCompetencyDifficulty.INTERMEDIATE,
      title: '프롬프트/맥락 설계',
      prompt: '보고서 초안을 요청할 때 더 좋은 결과를 얻기 위한 방식은 무엇인가요?',
      options: ['맥락 없이 한 줄 요청', '목적/대상/제약조건을 함께 제공', '도구 설명 없이 결과만 요구', '검증 기준 없이 요약만 요청'],
      answerKey: '목적/대상/제약조건을 함께 제공',
      explanation: '맥락 정보와 제약을 함께 제공해야 결과 품질이 높아집니다.',
      maxScore: 25,
      sortOrder: 20,
      isCommon: true,
      tags: ['prompt', 'context'],
    },
    {
      id: 'ai-q-2026-verify',
      track: null,
      competencyDomain: AiCompetencyDomain.VERIFICATION_HALLUCINATION,
      questionType: AiCompetencyQuestionType.MULTIPLE_CHOICE,
      difficulty: AiCompetencyDifficulty.INTERMEDIATE,
      title: '검증과 환각 대응',
      prompt: 'AI 응답을 검증하는 방법으로 적절한 것을 모두 고르세요.',
      options: ['출처 확인', '원문 대조', '이전 결과 그대로 제출', '수치 재계산'],
      answerKey: ['출처 확인', '원문 대조', '수치 재계산'],
      explanation: '출처 확인, 원문 대조, 수치 재계산은 기본 검증 절차입니다.',
      maxScore: 25,
      sortOrder: 30,
      isCommon: true,
      tags: ['verify', 'fact-check'],
    },
    {
      id: 'ai-q-2026-security',
      track: null,
      competencyDomain: AiCompetencyDomain.SECURITY_ETHICS,
      questionType: AiCompetencyQuestionType.SINGLE_CHOICE,
      difficulty: AiCompetencyDifficulty.BASIC,
      title: '보안/윤리 준수',
      prompt: '민감한 고객 정보가 포함된 문서를 외부 AI 서비스에 바로 입력하기 전에 가장 먼저 해야 할 일은 무엇인가요?',
      options: ['즉시 업로드', '비식별화 및 정책 확인', '팀 채팅에 공유', '개인 메일로 전달'],
      answerKey: '비식별화 및 정책 확인',
      explanation: '민감정보는 비식별화와 사내 정책 확인이 우선입니다.',
      maxScore: 25,
      sortOrder: 40,
      isCommon: true,
      tags: ['security', 'ethics'],
    },
  ] as const

  for (const question of aiQuestions) {
    await prisma.aiCompetencyQuestion.upsert({
      where: { id: question.id },
      update: {
        cycleId: aiCycle.id,
        track: question.track,
        competencyDomain: question.competencyDomain,
        questionType: question.questionType,
        difficulty: question.difficulty,
        title: question.title,
        prompt: question.prompt,
        options: question.options as any,
        answerKey: question.answerKey as any,
        tags: question.tags as any,
        explanation: question.explanation,
        maxScore: question.maxScore,
        sortOrder: question.sortOrder,
        isCommon: question.isCommon,
        isActive: true,
        randomizable: true,
        requiresManualScoring: false,
      },
      create: {
        id: question.id,
        cycleId: aiCycle.id,
        track: question.track,
        competencyDomain: question.competencyDomain,
        questionType: question.questionType,
        difficulty: question.difficulty,
        title: question.title,
        prompt: question.prompt,
        options: question.options as any,
        answerKey: question.answerKey as any,
        tags: question.tags as any,
        explanation: question.explanation,
        maxScore: question.maxScore,
        sortOrder: question.sortOrder,
        isCommon: question.isCommon,
        isActive: true,
        randomizable: true,
        requiresManualScoring: false,
      },
    })
  }
  console.log('✅ AI competency questions seeded:', aiQuestions.length)

  const commonBlueprint = await prisma.aiCompetencyExamBlueprint.upsert({
    where: { id: 'ai-blueprint-common-2026' },
    update: {
      cycleId: aiCycle.id,
      blueprintName: '2026 AI 공통 1차 체계표',
      blueprintVersion: 1,
      track: null,
      status: 'ACTIVE',
      totalQuestionCount: 4,
      totalPoints: 100,
      timeLimitMinutes: 60,
      passScore: 70,
      randomizationEnabled: true,
      notes: '기본 공통 평가용 문항 체계표',
      updatedById: hrAdmin.id,
    },
    create: {
      id: 'ai-blueprint-common-2026',
      cycleId: aiCycle.id,
      blueprintName: '2026 AI 공통 1차 체계표',
      blueprintVersion: 1,
      track: null,
      status: 'ACTIVE',
      totalQuestionCount: 4,
      totalPoints: 100,
      timeLimitMinutes: 60,
      passScore: 70,
      randomizationEnabled: true,
      notes: '기본 공통 평가용 문항 체계표',
      createdById: hrAdmin.id,
      updatedById: hrAdmin.id,
    },
  })

  const blueprintRows = [
    {
      id: 'ai-blueprint-row-foundation-2026',
      competencyDomain: AiCompetencyDomain.AI_FOUNDATION,
      itemType: AiCompetencyQuestionType.SINGLE_CHOICE,
      difficulty: AiCompetencyDifficulty.BASIC,
      displayOrder: 10,
    },
    {
      id: 'ai-blueprint-row-prompt-2026',
      competencyDomain: AiCompetencyDomain.PROMPT_CONTEXT_DESIGN,
      itemType: AiCompetencyQuestionType.SCENARIO_JUDGEMENT,
      difficulty: AiCompetencyDifficulty.INTERMEDIATE,
      displayOrder: 20,
    },
    {
      id: 'ai-blueprint-row-verify-2026',
      competencyDomain: AiCompetencyDomain.VERIFICATION_HALLUCINATION,
      itemType: AiCompetencyQuestionType.MULTIPLE_CHOICE,
      difficulty: AiCompetencyDifficulty.INTERMEDIATE,
      displayOrder: 30,
    },
    {
      id: 'ai-blueprint-row-security-2026',
      competencyDomain: AiCompetencyDomain.SECURITY_ETHICS,
      itemType: AiCompetencyQuestionType.SINGLE_CHOICE,
      difficulty: AiCompetencyDifficulty.BASIC,
      displayOrder: 40,
    },
  ] as const

  for (const row of blueprintRows) {
    await prisma.aiCompetencyExamBlueprintRow.upsert({
      where: { id: row.id },
      update: {
        blueprintId: commonBlueprint.id,
        competencyDomain: row.competencyDomain,
        itemType: row.itemType,
        difficulty: row.difficulty,
        scope: 'COMMON',
        requiredQuestionCount: 1,
        pointsPerQuestion: 25,
        rowPoints: 25,
        displayOrder: row.displayOrder,
      },
      create: {
        id: row.id,
        blueprintId: commonBlueprint.id,
        competencyDomain: row.competencyDomain,
        itemType: row.itemType,
        difficulty: row.difficulty,
        scope: 'COMMON',
        requiredQuestionCount: 1,
        pointsPerQuestion: 25,
        rowPoints: 25,
        displayOrder: row.displayOrder,
      },
    })
  }
  console.log('✅ AI competency blueprint seeded')

  const rubric = await prisma.aiCompetencyReviewRubric.upsert({
    where: { id: 'ai-rubric-common-2026' },
    update: {
      cycleId: aiCycle.id,
      rubricName: '2026 AI 실무인증 루브릭',
      rubricVersion: 1,
      track: null,
      status: 'ACTIVE',
      totalScore: 30,
      passScore: 21,
      bonusScoreIfPassed: 5,
      certificationLabel: 'AI 실무인증',
      notes: '2차 실무인증 기본 루브릭',
      updatedById: hrAdmin.id,
    },
    create: {
      id: 'ai-rubric-common-2026',
      cycleId: aiCycle.id,
      rubricName: '2026 AI 실무인증 루브릭',
      rubricVersion: 1,
      track: null,
      status: 'ACTIVE',
      totalScore: 30,
      passScore: 21,
      bonusScoreIfPassed: 5,
      certificationLabel: 'AI 실무인증',
      notes: '2차 실무인증 기본 루브릭',
      createdById: hrAdmin.id,
      updatedById: hrAdmin.id,
    },
  })

  const rubricCriteria = [
    { id: 'ai-rubric-criterion-problem-2026', code: 'PROBLEM', name: '문제 정의의 명확성', description: '업무 과제와 해결 목표를 분명히 설명했는지' },
    { id: 'ai-rubric-criterion-prompt-2026', code: 'PROMPT', name: '프롬프트/맥락 설계', description: '맥락, 제약, 출력 요구사항을 적절히 설계했는지' },
    { id: 'ai-rubric-criterion-verify-2026', code: 'VERIFY', name: '결과 검증 및 수정', description: '응답을 검증하고 오류를 수정했는지' },
    { id: 'ai-rubric-criterion-security-2026', code: 'SECURITY', name: '책임 있는 사용/보안 준수', description: '민감정보와 윤리 이슈를 적절히 통제했는지' },
    { id: 'ai-rubric-criterion-impact-2026', code: 'IMPACT', name: '업무 효과', description: '실제 업무 개선 효과가 있었는지' },
    { id: 'ai-rubric-criterion-repeatability-2026', code: 'REPEAT', name: '재현 가능성', description: '다른 구성원이 따라할 수 있도록 정리됐는지' },
  ] as const

  const rubricBands = [
    { score: 5, title: '매우 우수', description: '기준을 매우 충실히 충족', guidance: '명확한 근거와 재현 가능한 산출물이 있음' },
    { score: 4, title: '우수', description: '대부분의 기준을 충족', guidance: '핵심 품질은 확보되었으나 일부 보완 여지 있음' },
    { score: 3, title: '보통', description: '기준을 부분 충족', guidance: '기본 수준은 충족하나 완성도 보강 필요' },
    { score: 2, title: '미흡', description: '기준 충족이 부족', guidance: '핵심 맥락이나 검증이 충분하지 않음' },
    { score: 1, title: '매우 미흡', description: '기준을 충족하지 못함', guidance: '업무 적용성과 신뢰성이 낮음' },
  ] as const

  for (const [index, criterion] of rubricCriteria.entries()) {
    const storedCriterion = await prisma.aiCompetencyReviewRubricCriterion.upsert({
      where: { id: criterion.id },
      update: {
        rubricId: rubric.id,
        criterionCode: criterion.code,
        criterionName: criterion.name,
        criterionDescription: criterion.description,
        maxScore: 5,
        displayOrder: index + 1,
        mandatory: true,
        knockout: criterion.code === 'SECURITY',
      },
      create: {
        id: criterion.id,
        rubricId: rubric.id,
        criterionCode: criterion.code,
        criterionName: criterion.name,
        criterionDescription: criterion.description,
        maxScore: 5,
        displayOrder: index + 1,
        mandatory: true,
        knockout: criterion.code === 'SECURITY',
      },
    })

    for (const [bandIndex, band] of rubricBands.entries()) {
      await prisma.aiCompetencyReviewRubricBand.upsert({
        where: { id: `${criterion.id}-band-${band.score}` },
        update: {
          criterionId: storedCriterion.id,
          score: band.score,
          title: band.title,
          description: band.description,
          guidance: band.guidance,
          displayOrder: bandIndex + 1,
        },
        create: {
          id: `${criterion.id}-band-${band.score}`,
          criterionId: storedCriterion.id,
          score: band.score,
          title: band.title,
          description: band.description,
          guidance: band.guidance,
          displayOrder: bandIndex + 1,
        },
      })
    }
  }
  console.log('✅ AI competency rubric seeded')

  const member1Assignment = await prisma.aiCompetencyAssignment.upsert({
    where: { cycleId_employeeId: { cycleId: aiCycle.id, employeeId: member1.id } },
    update: {
      track: AiCompetencyTrack.MARKETING_PLANNING,
      firstRoundRequired: true,
      secondRoundVolunteer: true,
      policyAcknowledgedAt: new Date('2026-03-02T09:00:00+09:00'),
      assignedById: hrAdmin.id,
      notes: 'Seeded baseline participant for AI competency flow',
    },
    create: {
      id: 'ai-assignment-member1-2026',
      cycleId: aiCycle.id,
      employeeId: member1.id,
      track: AiCompetencyTrack.MARKETING_PLANNING,
      firstRoundRequired: true,
      secondRoundVolunteer: true,
      policyAcknowledgedAt: new Date('2026-03-02T09:00:00+09:00'),
      assignedById: hrAdmin.id,
      notes: 'Seeded baseline participant for AI competency flow',
    },
  })

  await prisma.aiCompetencyAssignment.upsert({
    where: { cycleId_employeeId: { cycleId: aiCycle.id, employeeId: member2.id } },
    update: {
      track: AiCompetencyTrack.FINANCE_OPERATIONS,
      firstRoundRequired: true,
      secondRoundVolunteer: false,
      policyAcknowledgedAt: new Date('2026-03-02T09:00:00+09:00'),
      assignedById: hrAdmin.id,
      notes: 'Seeded secondary participant for admin overview',
    },
    create: {
      id: 'ai-assignment-member2-2026',
      cycleId: aiCycle.id,
      employeeId: member2.id,
      track: AiCompetencyTrack.FINANCE_OPERATIONS,
      firstRoundRequired: true,
      secondRoundVolunteer: false,
      policyAcknowledgedAt: new Date('2026-03-02T09:00:00+09:00'),
      assignedById: hrAdmin.id,
      notes: 'Seeded secondary participant for admin overview',
    },
  })

  const member1Attempt = await prisma.aiCompetencyAttempt.upsert({
    where: { assignmentId: member1Assignment.id },
    update: {
      cycleId: aiCycle.id,
      employeeId: member1.id,
      status: 'SCORED',
      startedAt: new Date('2026-03-03T09:10:00+09:00'),
      lastSavedAt: new Date('2026-03-03T10:00:00+09:00'),
      submittedAt: new Date('2026-03-03T10:00:00+09:00'),
      dueAt: new Date('2026-03-10T18:00:00+09:00'),
      objectiveScore: 88,
      manualScore: 0,
      totalScore: 88,
      passStatus: 'PASSED',
      questionOrder: aiQuestions.map((question) => question.id) as any,
      timeLimitMinutes: 60,
    },
    create: {
      id: 'ai-attempt-member1-2026',
      cycleId: aiCycle.id,
      assignmentId: member1Assignment.id,
      employeeId: member1.id,
      status: 'SCORED',
      startedAt: new Date('2026-03-03T09:10:00+09:00'),
      lastSavedAt: new Date('2026-03-03T10:00:00+09:00'),
      submittedAt: new Date('2026-03-03T10:00:00+09:00'),
      dueAt: new Date('2026-03-10T18:00:00+09:00'),
      objectiveScore: 88,
      manualScore: 0,
      totalScore: 88,
      passStatus: 'PASSED',
      questionOrder: aiQuestions.map((question) => question.id) as any,
      timeLimitMinutes: 60,
    },
  })

  await prisma.aiCompetencyGeneratedExamSet.upsert({
    where: { assignmentId: member1Assignment.id },
    update: {
      cycleId: aiCycle.id,
      attemptId: member1Attempt.id,
      employeeId: member1.id,
      blueprintSnapshot: {
        blueprints: [{ id: commonBlueprint.id, name: commonBlueprint.blueprintName, version: commonBlueprint.blueprintVersion }],
      } as any,
      questionSet: aiQuestions.map((question) => ({
        questionId: question.id,
        title: question.title,
      })) as any,
    },
    create: {
      id: 'ai-generated-set-member1-2026',
      cycleId: aiCycle.id,
      assignmentId: member1Assignment.id,
      attemptId: member1Attempt.id,
      employeeId: member1.id,
      blueprintSnapshot: {
        blueprints: [{ id: commonBlueprint.id, name: commonBlueprint.blueprintName, version: commonBlueprint.blueprintVersion }],
      } as any,
      questionSet: aiQuestions.map((question) => ({
        questionId: question.id,
        title: question.title,
      })) as any,
    },
  })

  const seededAnswers = [
    { questionId: 'ai-q-2026-foundation', answerPayload: '업무 적합성', objectiveScore: 25, finalScore: 25, isCorrect: true },
    { questionId: 'ai-q-2026-prompt', answerPayload: '목적/대상/제약조건을 함께 제공', objectiveScore: 25, finalScore: 25, isCorrect: true },
    { questionId: 'ai-q-2026-verify', answerPayload: ['출처 확인', '원문 대조', '수치 재계산'], objectiveScore: 25, finalScore: 25, isCorrect: true },
    { questionId: 'ai-q-2026-security', answerPayload: '비식별화 및 정책 확인', objectiveScore: 13, finalScore: 13, isCorrect: true },
  ] as const

  for (const answer of seededAnswers) {
    await prisma.aiCompetencyAnswer.upsert({
      where: { attemptId_questionId: { attemptId: member1Attempt.id, questionId: answer.questionId } },
      update: {
        answerPayload: answer.answerPayload as any,
        isCorrect: answer.isCorrect,
        objectiveScore: answer.objectiveScore,
        finalScore: answer.finalScore,
      },
      create: {
        id: `ai-answer-${answer.questionId.replace('ai-q-', '')}`,
        attemptId: member1Attempt.id,
        questionId: answer.questionId,
        answerPayload: answer.answerPayload as any,
        isCorrect: answer.isCorrect,
        objectiveScore: answer.objectiveScore,
        finalScore: answer.finalScore,
      },
    })
  }

  const secondRoundSubmission = await prisma.aiCompetencySecondRoundSubmission.upsert({
    where: { assignmentId: member1Assignment.id },
    update: {
      cycleId: aiCycle.id,
      employeeId: member1.id,
      rubricId: rubric.id,
      status: 'UNDER_REVIEW',
      taskDescription: '마케팅 콘텐츠 초안 작성과 검증 자동화',
      aiUsagePurpose: '반복 업무 시간을 줄이고 초안 품질을 높이기 위해 활용',
      toolUsed: 'ChatGPT, Google Sheets',
      promptSummary: '캠페인 목적, 타깃 고객, 톤앤매너, 금지 표현을 함께 제공',
      verificationMethod: '사내 가이드라인 대조, 사실관계 확인, 담당자 검토',
      businessImpact: '초안 작성 시간을 40% 단축하고 수정 횟수를 줄임',
      sensitiveDataCheck: '고객 개인정보 제거 후 예시 데이터만 사용',
      submittedAt: new Date('2026-03-21T14:00:00+09:00'),
      aggregatedScore: null,
      aggregatedBonus: null,
      reviewerSummary: null,
      internalCertificationGranted: false,
    },
    create: {
      id: 'ai-second-round-member1-2026',
      cycleId: aiCycle.id,
      assignmentId: member1Assignment.id,
      employeeId: member1.id,
      rubricId: rubric.id,
      status: 'UNDER_REVIEW',
      taskDescription: '마케팅 콘텐츠 초안 작성과 검증 자동화',
      aiUsagePurpose: '반복 업무 시간을 줄이고 초안 품질을 높이기 위해 활용',
      toolUsed: 'ChatGPT, Google Sheets',
      promptSummary: '캠페인 목적, 타깃 고객, 톤앤매너, 금지 표현을 함께 제공',
      verificationMethod: '사내 가이드라인 대조, 사실관계 확인, 담당자 검토',
      businessImpact: '초안 작성 시간을 40% 단축하고 수정 횟수를 줄임',
      sensitiveDataCheck: '고객 개인정보 제거 후 예시 데이터만 사용',
      submittedAt: new Date('2026-03-21T14:00:00+09:00'),
      internalCertificationGranted: false,
    },
  })

  await prisma.aiCompetencySecondRoundArtifact.upsert({
    where: { id: 'ai-artifact-member1-portfolio' },
    update: {
      submissionId: secondRoundSubmission.id,
      fileName: 'member1-portfolio.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24,
      content: Buffer.from('seeded-ai-portfolio-pdf'),
    },
    create: {
      id: 'ai-artifact-member1-portfolio',
      submissionId: secondRoundSubmission.id,
      fileName: 'member1-portfolio.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24,
      content: Buffer.from('seeded-ai-portfolio-pdf'),
    },
  })

  await prisma.aiCompetencySecondRoundArtifact.upsert({
    where: { id: 'ai-artifact-member1-prompt-log' },
    update: {
      submissionId: secondRoundSubmission.id,
      fileName: 'member1-prompt-log.txt',
      mimeType: 'text/plain',
      sizeBytes: 22,
      content: Buffer.from('seeded-prompt-log-data'),
    },
    create: {
      id: 'ai-artifact-member1-prompt-log',
      submissionId: secondRoundSubmission.id,
      fileName: 'member1-prompt-log.txt',
      mimeType: 'text/plain',
      sizeBytes: 22,
      content: Buffer.from('seeded-prompt-log-data'),
    },
  })

  await prisma.aiCompetencySubmissionReview.upsert({
    where: {
      submissionId_reviewerId: {
        submissionId: secondRoundSubmission.id,
        reviewerId: sectionChief.id,
      },
    },
    update: {
      rubricId: rubric.id,
      status: 'ASSIGNED',
      decision: null,
      score: null,
      bonusScore: null,
      notes: null,
      qnaNote: null,
      rubricPayload: {
        rubricId: rubric.id,
        rubricName: rubric.rubricName,
      } as any,
    },
    create: {
      id: 'ai-review-member1-section-2026',
      submissionId: secondRoundSubmission.id,
      reviewerId: sectionChief.id,
      rubricId: rubric.id,
      status: 'ASSIGNED',
      rubricPayload: {
        rubricId: rubric.id,
        rubricName: rubric.rubricName,
      } as any,
    },
  })
  console.log('✅ AI competency assignments, attempt, and reviewer queue seeded')

  const gradeByName = new Map(storedGrades.map((grade) => [grade.gradeName, grade]))

  const seededEvaluations = [
    { id: 'eval-final-member1', targetId: member1.id, evaluatorId: divHead.id, evalStage: 'FINAL', totalScore: 95, gradeName: 'A0' },
    { id: 'eval-final-member2', targetId: member2.id, evaluatorId: divHead.id, evalStage: 'FINAL', totalScore: 88, gradeName: 'B+' },
    { id: 'eval-final-leader', targetId: teamLeader.id, evaluatorId: divHead.id, evalStage: 'FINAL', totalScore: 91, gradeName: 'A0' },
    { id: 'eval-final-section', targetId: sectionChief.id, evaluatorId: ceo.id, evalStage: 'FINAL', totalScore: 86, gradeName: 'B+' },
    { id: 'eval-final-divhead', targetId: divHead.id, evaluatorId: ceo.id, evalStage: 'FINAL', totalScore: 82, gradeName: 'B0' },
  ] as const

  for (const evaluation of seededEvaluations) {
    await prisma.evaluation.upsert({
      where: { id: evaluation.id },
      update: {
        totalScore: evaluation.totalScore,
        gradeId: gradeByName.get(evaluation.gradeName)?.id,
        status: 'CONFIRMED',
        isDraft: false,
        submittedAt: new Date('2026-12-29T12:00:00'),
      },
      create: {
        id: evaluation.id,
        evalCycleId: evalCycle.id,
        targetId: evaluation.targetId,
        evaluatorId: evaluation.evaluatorId,
        evalStage: evaluation.evalStage,
        totalScore: evaluation.totalScore,
        gradeId: gradeByName.get(evaluation.gradeName)?.id,
        comment: 'Seeded final evaluation for compensation simulation',
        status: 'CONFIRMED',
        isDraft: false,
        submittedAt: new Date('2026-12-29T12:00:00'),
      },
    })
  }
  console.log('✅ Final evaluations created for compensation simulation')

  // 6. 조직 KPI 생성
  const orgKpi1 = await prisma.orgKpi.upsert({
    where: { deptId_evalYear_kpiName: { deptId: devTeam.id, evalYear: 2026, kpiName: '소프트웨어 개발 완료율' } },
    update: {},
    create: {
      deptId: devTeam.id,
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '부서고유지표',
      kpiName: '소프트웨어 개발 완료율',
      definition: '계획된 개발 과제 대비 실제 완료된 과제의 비율',
      formula: '완료 과제수 / 계획 과제수 × 100',
      targetValue: 95,
      unit: '%',
      weight: 50,
      difficulty: 'MEDIUM',
    },
  })

  const orgKpi2 = await prisma.orgKpi.upsert({
    where: { deptId_evalYear_kpiName: { deptId: devTeam.id, evalYear: 2026, kpiName: '코드 품질 점수' } },
    update: {},
    create: {
      deptId: devTeam.id,
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiCategory: '내부운영',
      kpiName: '코드 품질 점수',
      definition: '정적 분석 도구 기준 코드 품질 점수',
      targetValue: 85,
      unit: '점',
      weight: 30,
      difficulty: 'MEDIUM',
    },
  })

  const orgKpi3 = await prisma.orgKpi.upsert({
    where: { deptId_evalYear_kpiName: { deptId: devTeam.id, evalYear: 2026, kpiName: '애자일 개발 문화 정착' } },
    update: {},
    create: {
      deptId: devTeam.id,
      evalYear: 2026,
      kpiType: 'QUALITATIVE',
      kpiCategory: '내부운영',
      kpiName: '애자일 개발 문화 정착',
      definition: '스프린트 리뷰, 회고, 스탠드업 미팅 등 애자일 프랙티스 정착',
      weight: 20,
      difficulty: 'MEDIUM',
    },
  })

  console.log('✅ Org KPIs created')

  // 7. 개인 KPI 생성 (김팀원)
  const personalKpi1 = await prisma.personalKpi.upsert({
    where: { employeeId_evalYear_kpiName: { employeeId: member1.id, evalYear: 2026, kpiName: '담당 기능 개발 완료율' } },
    update: {},
    create: {
      employeeId: member1.id,
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiName: '담당 기능 개발 완료율',
      definition: '할당된 기능 개발 완료율',
      targetValue: 95,
      unit: '%',
      weight: 40,
      difficulty: 'MEDIUM',
      linkedOrgKpiId: orgKpi1.id,
      status: 'CONFIRMED',
    },
  })

  const personalKpi2 = await prisma.personalKpi.upsert({
    where: { employeeId_evalYear_kpiName: { employeeId: member1.id, evalYear: 2026, kpiName: '버그 처리율' } },
    update: {},
    create: {
      employeeId: member1.id,
      evalYear: 2026,
      kpiType: 'QUANTITATIVE',
      kpiName: '버그 처리율',
      definition: '접수된 버그 대비 처리 완료된 버그의 비율',
      targetValue: 90,
      unit: '%',
      weight: 30,
      difficulty: 'LOW',
      linkedOrgKpiId: orgKpi2.id,
      status: 'CONFIRMED',
    },
  })

  const personalKpi3 = await prisma.personalKpi.upsert({
    where: { employeeId_evalYear_kpiName: { employeeId: member1.id, evalYear: 2026, kpiName: '기술역량 향상 활동' } },
    update: {},
    create: {
      employeeId: member1.id,
      evalYear: 2026,
      kpiType: 'QUALITATIVE',
      kpiName: '기술역량 향상 활동',
      definition: '사내외 교육, 스터디, 기술 공유 등 역량 향상 활동',
      weight: 30,
      difficulty: 'MEDIUM',
      linkedOrgKpiId: orgKpi3.id,
      status: 'CONFIRMED',
    },
  })

  console.log('✅ Personal KPIs created for member1')

  // 8. 월별 실적 데이터 (1~2월)
  const months = ['2026-01', '2026-02']
  const actuals = [88, 92]

  for (let i = 0; i < months.length; i++) {
    await prisma.monthlyRecord.upsert({
      where: { personalKpiId_yearMonth: { personalKpiId: personalKpi1.id, yearMonth: months[i] } },
      update: {},
      create: {
        personalKpiId: personalKpi1.id,
        employeeId: member1.id,
        yearMonth: months[i],
        actualValue: actuals[i],
        achievementRate: Math.round(actuals[i] / 95 * 100 * 10) / 10,
        isDraft: false,
        submittedAt: new Date(),
      },
    })
  }
  console.log('✅ Monthly records created')

  // 9. 체크인 생성
  await prisma.checkIn.upsert({
    where: { id: 'checkin-1' },
    update: {},
    create: {
      id: 'checkin-1',
      ownerId: member1.id,
      managerId: teamLeader.id,
      checkInType: 'WEEKLY',
      scheduledDate: new Date('2026-03-13T10:00:00'),
      status: 'SCHEDULED',
      ownerNotes: '2월 실적 리뷰 및 3월 계획 논의',
    },
  })

  await prisma.checkIn.upsert({
    where: { id: 'checkin-2' },
    update: {},
    create: {
      id: 'checkin-2',
      ownerId: member1.id,
      managerId: teamLeader.id,
      checkInType: 'WEEKLY',
      scheduledDate: new Date('2026-03-06T10:00:00'),
      actualDate: new Date('2026-03-06T10:00:00'),
      duration: 30,
      status: 'COMPLETED',
      keyTakeaways: '버그 처리 속도 개선 필요. 다음 주까지 테스트 커버리지 80% 달성 목표.',
      energyLevel: 4,
      satisfactionLevel: 4,
      blockerCount: 1,
      actionItems: [
        { action: '테스트 커버리지 80% 달성', assignee: '김팀원', dueDate: '2026-03-13', completed: false },
        { action: '코드 리뷰 가이드라인 작성', assignee: '최팀장', dueDate: '2026-03-10', completed: true },
      ],
    },
  })
  console.log('✅ Check-ins created')

  console.log('\n🎉 Seed completed!')
  console.log('\n📋 테스트 계정:')
  console.log(`  대표이사: ${buildWorkspaceEmail('ceo')}`)
  console.log(`  본부장:   ${buildWorkspaceEmail('divhead')}`)
  console.log(`  실장:     ${buildWorkspaceEmail('section')}`)
  console.log(`  팀장:     ${buildWorkspaceEmail('leader')}`)
  console.log(`  팀원1:    ${buildWorkspaceEmail('member1')}`)
  console.log(`  팀원2:    ${buildWorkspaceEmail('member2')}`)
  console.log(`  관리자:   ${buildWorkspaceEmail('admin')}`)
  console.log(
    `\n⚠️  Google OAuth 미설정 시 관리자 계정(${buildWorkspaceEmail('admin')})으로 로그인하세요.`
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
