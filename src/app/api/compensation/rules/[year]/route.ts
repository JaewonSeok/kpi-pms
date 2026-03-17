import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { getGradeSettingsOrThrow, getOrganizationOrThrow } from '@/lib/compensation-server'
import { summarizeRuleChangeImpact } from '@/lib/compensation'
import { UpdateCompensationRulesSchema } from '@/lib/validations'
import { AppError, errorResponse, successResponse } from '@/lib/utils'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')

    const { year: yearParam } = await params
    const evalYear = Number(yearParam)
    if (Number.isNaN(evalYear)) {
      throw new AppError(400, 'INVALID_YEAR', '유효한 연도를 입력해 주세요.')
    }

    const org = await getOrganizationOrThrow()
    const [grades, ruleSets] = await Promise.all([
      getGradeSettingsOrThrow(org.id, evalYear),
      prisma.compensationRuleSet.findMany({
        where: { orgId: org.id, evalYear },
        include: {
          rules: {
            orderBy: { gradeName: 'asc' },
          },
        },
        orderBy: { versionNo: 'desc' },
      }),
    ])

    const activeRuleSet = ruleSets.find((ruleSet) => ruleSet.isActive) ?? null
    const suggestedRules = grades.map((grade) => ({
      gradeName: grade.gradeName,
      bonusRate: 0,
      salaryIncreaseRate: 0,
      description: `${grade.levelName} 등급 기본 보상 규칙`,
    }))

    return successResponse({
      evalYear,
      activeRuleSet,
      versions: ruleSets.map((ruleSet) => ({
        id: ruleSet.id,
        versionNo: ruleSet.versionNo,
        isActive: ruleSet.isActive,
        changeReason: ruleSet.changeReason,
        createdAt: ruleSet.createdAt,
      })),
      suggestedRules,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'HR 관리자만 보상 규칙을 수정할 수 있습니다.')
    }

    const { year: yearParam } = await params
    const evalYear = Number(yearParam)
    if (Number.isNaN(evalYear)) {
      throw new AppError(400, 'INVALID_YEAR', '유효한 연도를 입력해 주세요.')
    }

    const body = await request.json()
    const validated = UpdateCompensationRulesSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0].message)
    }

    const org = await getOrganizationOrThrow()
    const grades = await getGradeSettingsOrThrow(org.id, evalYear)
    const activeGradeNames = new Set(grades.map((grade) => grade.gradeName))
    const incomingGradeNames = new Set(validated.data.rules.map((rule) => rule.gradeName))

    if (activeGradeNames.size !== incomingGradeNames.size) {
      throw new AppError(400, 'RULE_COVERAGE_INVALID', '모든 활성 등급에 대한 보상 규칙을 입력해 주세요.')
    }

    for (const gradeName of activeGradeNames) {
      if (!incomingGradeNames.has(gradeName)) {
        throw new AppError(400, 'RULE_COVERAGE_INVALID', `${gradeName} 등급의 규칙이 누락되었습니다.`)
      }
    }

    const latestRuleSet = await prisma.compensationRuleSet.findFirst({
      where: { orgId: org.id, evalYear },
      include: {
        rules: true,
      },
      orderBy: { versionNo: 'desc' },
    })

    const ruleSet = await prisma.$transaction(async (tx) => {
      await tx.compensationRuleSet.updateMany({
        where: { orgId: org.id, evalYear, isActive: true },
        data: { isActive: false },
      })

      const created = await tx.compensationRuleSet.create({
        data: {
          orgId: org.id,
          evalYear,
          versionNo: (latestRuleSet?.versionNo ?? 0) + 1,
          changeReason: validated.data.changeReason,
          createdById: session.user.id,
          isActive: true,
          rules: {
            create: validated.data.rules.map((rule) => ({
              gradeSettingId: grades.find((grade) => grade.gradeName === rule.gradeName)?.id,
              gradeName: rule.gradeName,
              bonusRate: rule.bonusRate,
              salaryIncreaseRate: rule.salaryIncreaseRate,
              description: rule.description,
            })),
          },
        },
        include: {
          rules: {
            orderBy: { gradeName: 'asc' },
          },
        },
      })

      return created
    })

    const scenarios = await prisma.compensationScenario.findMany({
      where: {
        evalCycle: { evalYear },
      },
      include: {
        employees: {
          select: { id: true },
        },
      },
    })

    const impact = summarizeRuleChangeImpact(
      scenarios.map((scenario) => ({
        id: scenario.id,
        scenarioName: scenario.scenarioName,
        versionNo: scenario.versionNo,
        status: scenario.status,
        isLocked: scenario.isLocked,
        employeeCount: scenario.employees.length,
      }))
    )

    if (impact.recalculationRequiredScenarioIds.length) {
      await prisma.compensationScenario.updateMany({
        where: {
          id: { in: impact.recalculationRequiredScenarioIds },
        },
        data: {
          needsRecalculation: true,
        },
      })
    }

    const clientInfo = getClientInfo(request)
    await createAuditLog({
      userId: session.user.id,
      action: 'COMPENSATION_RULE_SET_CREATE',
      entityType: 'CompensationRuleSet',
      entityId: ruleSet.id,
      oldValue: latestRuleSet
        ? {
            versionNo: latestRuleSet.versionNo,
            rules: latestRuleSet.rules,
          }
        : undefined,
      newValue: {
        versionNo: ruleSet.versionNo,
        rules: ruleSet.rules,
        impact,
      },
      ...clientInfo,
    })

    return successResponse({
      ruleSet,
      impact: {
        ...impact,
        note:
          '사이클 확정 후 잠금된 보상안과 employee self-view는 스냅샷을 유지합니다. 잠금되지 않은 시나리오는 needsRecalculation=true 로 표시되어 재계산 후 다시 제출해야 합니다.',
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
