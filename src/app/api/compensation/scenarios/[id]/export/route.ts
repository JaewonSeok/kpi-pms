import { getServerSession } from 'next-auth'
import * as XLSX from 'xlsx'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageCompensation } from '@/lib/compensation'
import { AppError, formatDate, errorResponse } from '@/lib/utils'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '인증이 필요합니다.')
    if (!canManageCompensation(session.user.role)) {
      throw new AppError(403, 'FORBIDDEN', '보상안 export 권한이 없습니다.')
    }

    const { id } = await params
    const scenario = await prisma.compensationScenario.findUnique({
      where: { id },
      include: {
        evalCycle: true,
        ruleSet: true,
        approvals: {
          orderBy: { createdAt: 'asc' },
        },
        employees: {
          include: {
            employee: {
              include: {
                department: true,
              },
            },
          },
          orderBy: [{ gradeName: 'asc' }, { bonusAmount: 'desc' }],
        },
      },
    })

    if (!scenario) {
      throw new AppError(404, 'SCENARIO_NOT_FOUND', '보상 시나리오를 찾을 수 없습니다.')
    }

    const workbook = XLSX.utils.book_new()

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        cycle: scenario.evalCycle.cycleName,
        year: scenario.evalCycle.evalYear,
        scenario: scenario.scenarioName,
        version: scenario.versionNo,
        status: scenario.status,
        ruleVersion: scenario.ruleSet.versionNo,
        budgetLimit: scenario.budgetLimit,
        totalBonus: scenario.totalBonus,
        totalSalaryIncrease: scenario.totalSalaryIncrease,
        totalCost: scenario.totalCost,
        isOverBudget: scenario.isOverBudget ? 'Y' : 'N',
        overBudgetAmount: scenario.overBudgetAmount,
        isLocked: scenario.isLocked ? 'Y' : 'N',
        publishedAt: scenario.publishedAt ? formatDate(scenario.publishedAt) : '',
      },
    ])

    const employeeSheet = XLSX.utils.json_to_sheet(
      scenario.employees.map((row) => ({
        empId: row.employee.empId,
        employeeName: row.employee.empName,
        department: row.employee.department.deptName,
        grade: row.gradeName,
        currentSalary: row.currentSalary,
        bonusRate: row.bonusRate,
        bonusAmount: row.bonusAmount,
        salaryIncreaseRate: row.salaryIncreaseRate,
        salaryIncreaseAmount: row.salaryIncreaseAmount,
        projectedSalary: row.projectedSalary,
        projectedTotalCompensation: row.projectedTotalCompensation,
        ruleVersion: row.sourceRuleVersionNo,
      }))
    )

    const approvalSheet = XLSX.utils.json_to_sheet(
      scenario.approvals.map((approval) => ({
        action: approval.action,
        actorId: approval.actorId,
        actorRole: approval.actorRole,
        fromStatus: approval.fromStatus,
        toStatus: approval.toStatus,
        comment: approval.comment ?? '',
        createdAt: approval.createdAt.toISOString(),
      }))
    )

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employees')
    XLSX.utils.book_append_sheet(workbook, approvalSheet, 'Workflow')

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="compensation-${scenario.evalCycle.evalYear}-v${scenario.versionNo}.xlsx"`,
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
