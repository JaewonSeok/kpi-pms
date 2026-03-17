import { PrismaClient, Position, SystemRole, EmployeeStatus } from '@prisma/client'
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
