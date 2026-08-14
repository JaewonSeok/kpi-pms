import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog, getClientInfo } from '@/lib/audit'
import { AppError, errorResponse, successResponse } from '@/lib/utils'
import { ManualNotificationSendSchema } from '@/lib/validations'
import { NotificationType } from '@prisma/client'
import { dispatchDueNotificationJobs, queueNotification } from '@/lib/notification-service'

export const maxDuration = 300

type Stage = 'goal' | 'checkpoint' | 'self' | 'first' | 'second' | 'final' | 'ceo'

const STAGE_MAP: Record<Stage, { type: NotificationType; link: string }> = {
  goal:       { type: NotificationType.GOAL_REMINDER,       link: '/kpi/personal' },
  checkpoint: { type: NotificationType.CHECKPOINT_REMINDER, link: '/kpi/monthly' },
  self:       { type: NotificationType.EVALUATION_REMINDER, link: '/evaluation/self' },
  first:      { type: NotificationType.EVALUATION_REMINDER, link: '/evaluation/performance' },
  second:     { type: NotificationType.EVALUATION_REMINDER, link: '/evaluation/performance' },
  final:      { type: NotificationType.EVALUATION_REMINDER, link: '/evaluation/performance' },
  ceo:        { type: NotificationType.EVALUATION_REMINDER, link: '/evaluation/ceo-adjust' },
}

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

    const { employeeIds, stage, subject, body: bodyText } = validated.data

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

    const { type: notificationType, link } = STAGE_MAP[stage]
    // employeeName 은 queueNotification 내부(L678)에서 자동 채워짐
    const payload: Record<string, string> = { link }

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
          subjectOverride: subject,
          bodyOverride: bodyText,
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
      newValue: { stage, subject, employeeIds, dedupeToken, queuedCount, dispatchedCount, dispatchSummary },
      ...getClientInfo(request),
    })

    // ⑦ 반환
    return successResponse({ queuedCount, suppressedCount, duplicateCount, dispatchedCount, dispatchSummary })
  } catch (error) {
    return errorResponse(error)
  }
}
