import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { ManualNotificationSendSchema } from '@/lib/validations'
import { NotificationType } from '@prisma/client'
import { dispatchDueNotificationJobs, queueNotification } from '@/lib/notification-service'

export const maxDuration = 300

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        empId: true,
        empName: true,
        department: { select: { deptName: true } },
      },
      orderBy: [{ department: { deptName: 'asc' } }, { empName: 'asc' }],
    })

    return successResponse(employees)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) throw new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    if (session.user.role !== 'ROLE_ADMIN') throw new AppError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.')

    const body = await request.json()
    const validated = ManualNotificationSendSchema.safeParse(body)
    if (!validated.success) {
      throw new AppError(400, 'VALIDATION_ERROR', validated.error.issues[0]?.message || '잘못된 요청입니다.')
    }

    const { employeeIds, reminderType } = validated.data

    // ① employeeIds로 employee 조회 (status ACTIVE만). 요청 수와 조회 수가 다르면 방어
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, status: 'ACTIVE' },
      select: { id: true, empName: true },
    })

    if (employees.length !== employeeIds.length) {
      throw new AppError(400, 'INVALID_EMPLOYEE_IDS', '비활성이거나 존재하지 않는 직원 ID가 포함되어 있습니다.')
    }

    // ② dedupeToken — 요청당 1회만 생성
    const dedupeToken = `manual:${Date.now()}`

    // reminderType별 type과 payload 결정
    let notificationType: NotificationType
    let payload: Record<string, string>

    if (reminderType === 'goal') {
      notificationType = NotificationType.GOAL_REMINDER
      const evalCycle = await prisma.evalCycle.findFirst({
        where: { status: { notIn: ['SETUP', 'CLOSED'] } },
        orderBy: { createdAt: 'desc' },
        select: { cycleName: true, kpiSetupEnd: true },
      })
      if (!evalCycle) {
        throw new AppError(400, 'NO_ACTIVE_EVAL_CYCLE', '진행 중인 평가 사이클이 없습니다.')
      }
      payload = {
        cycleName: evalCycle.cycleName,
        dueDate: evalCycle.kpiSetupEnd
          ? evalCycle.kpiSetupEnd.toISOString().slice(0, 10)
          : '',
        link: '/kpi/personal',
      }
    } else {
      notificationType = NotificationType.CHECKPOINT_REMINDER
      payload = {
        yearMonth: new Date().toISOString().slice(0, 7),
        link: '/kpi/monthly',
      }
    }

    // ③④ 직원마다 queueNotification 1회 호출
    // ★ queueNotification 반환 타입은 { created, suppressed, duplicates } — jobId 미포함
    let queuedCount = 0
    let suppressedCount = 0
    let duplicateCount = 0

    for (const employee of employees) {
      const result = await queueNotification(
        {
          recipientId: employee.id,
          type: notificationType,
          sourceType: 'ManualReminder',
          sourceId: employee.id,
          dedupeToken,
          payload,
        },
        prisma
      )
      queuedCount += result.created
      suppressedCount += result.suppressed
      duplicateCount += result.duplicates
    }

    // ⑤ 이 요청이 만든 잡만 발송한다 (dedupeToken 으로 특정)
    let dispatchSummary = null
    let dispatchedCount = 0
    if (queuedCount > 0) {
      const createdJobs = await prisma.notificationJob.findMany({
        where: {
          status: 'QUEUED',
          recipientId: { in: employeeIds },
          idempotencyKey: { endsWith: dedupeToken },
        },
        select: { id: true },
      })
      const jobIds = createdJobs.map((j) => j.id)
      dispatchedCount = jobIds.length
      if (jobIds.length > 0) {
        dispatchSummary = await dispatchDueNotificationJobs(prisma, jobIds)
      }
    }

    // ⑥ auditLog
    await createAuditLog({
      userId: session.user.id,
      action: 'NOTIFICATION_MANUAL_SENT',
      entityType: 'Employee',
      entityId: employeeIds[0],
      newValue: { reminderType, employeeIds, dedupeToken, queuedCount, dispatchedCount, dispatchSummary },
      ...getClientInfo(request),
    })

    // ⑦ 반환
    return successResponse({ queuedCount, suppressedCount, duplicateCount, dispatchedCount, dispatchSummary })
  } catch (error) {
    return errorResponse(error)
  }
}
