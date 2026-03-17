import nodemailer from 'nodemailer'
import {
  JobExecutionStatus,
  JobExecutionType,
  NotificationAttemptStatus,
  NotificationDeliveryChannel,
  NotificationJobStatus,
  NotificationType,
  Prisma,
  PrismaClient,
} from '@prisma/client'
import { prisma } from './prisma'
import { isFeatureEnabled } from './feature-flags'

type TemplateSeed = {
  code: string
  name: string
  type: NotificationType
  channel: NotificationDeliveryChannel
  subjectTemplate: string
  bodyTemplate: string
  defaultLink?: string
  isDigestCompatible?: boolean
}

type QueueNotificationInput = {
  recipientId: string
  type: NotificationType
  sourceType: string
  sourceId: string
  payload: Record<string, string | number | boolean | null | undefined>
  dedupeToken: string
  channels?: NotificationDeliveryChannel[]
  scheduledFor?: Date
  priority?: number
}

type QueueNotificationResult = {
  created: number
  suppressed: number
  duplicates: number
}

type DispatchSummary = {
  processedCount: number
  successCount: number
  failedCount: number
  retriedCount: number
  deadLetterCount: number
  suppressedCount: number
}

const DEFAULT_NOTIFICATION_TEMPLATES: TemplateSeed[] = [
  {
    code: 'goal-reminder-in-app',
    name: '목표 설정 리마인더 (앱)',
    type: NotificationType.GOAL_REMINDER,
    channel: NotificationDeliveryChannel.IN_APP,
    subjectTemplate: '{{cycleName}} 목표 설정 마감 안내',
    bodyTemplate: '{{employeeName}}님, {{cycleName}}의 목표/KPI 설정 마감이 {{dueDate}}입니다.',
    defaultLink: '/kpi/personal',
  },
  {
    code: 'goal-reminder-email',
    name: '목표 설정 리마인더 (메일)',
    type: NotificationType.GOAL_REMINDER,
    channel: NotificationDeliveryChannel.EMAIL,
    subjectTemplate: '[성과관리] {{cycleName}} 목표 설정 마감 안내',
    bodyTemplate: '{{employeeName}}님,\n\n{{cycleName}}의 목표/KPI 설정 마감일은 {{dueDate}}입니다.\n지금 접속해 목표를 점검해 주세요.\n\n{{link}}',
    defaultLink: '/kpi/personal',
  },
  {
    code: 'checkpoint-reminder-in-app',
    name: '점검 리마인더 (앱)',
    type: NotificationType.CHECKPOINT_REMINDER,
    channel: NotificationDeliveryChannel.IN_APP,
    subjectTemplate: '{{yearMonth}} 점검 리마인더',
    bodyTemplate: '{{employeeName}}님, {{yearMonth}} 월간 실적/점검 입력을 확인해 주세요.',
    defaultLink: '/kpi/monthly',
  },
  {
    code: 'checkpoint-reminder-email',
    name: '점검 리마인더 (메일)',
    type: NotificationType.CHECKPOINT_REMINDER,
    channel: NotificationDeliveryChannel.EMAIL,
    subjectTemplate: '[성과관리] {{yearMonth}} 점검 리마인더',
    bodyTemplate: '{{employeeName}}님,\n\n{{yearMonth}} 월간 점검/실적 입력이 필요합니다.\n\n{{link}}',
    defaultLink: '/kpi/monthly',
  },
  {
    code: 'evaluation-reminder-in-app',
    name: '평가 리마인더 (앱)',
    type: NotificationType.EVALUATION_REMINDER,
    channel: NotificationDeliveryChannel.IN_APP,
    subjectTemplate: '{{stageLabel}} 평가 리마인더',
    bodyTemplate: '{{employeeName}}님, {{stageLabel}} 평가 대상 {{pendingCount}}건이 남아 있습니다.',
    defaultLink: '/evaluation/results',
  },
  {
    code: 'evaluation-reminder-email',
    name: '평가 리마인더 (메일)',
    type: NotificationType.EVALUATION_REMINDER,
    channel: NotificationDeliveryChannel.EMAIL,
    subjectTemplate: '[성과관리] {{stageLabel}} 평가 리마인더',
    bodyTemplate: '{{employeeName}}님,\n\n{{stageLabel}} 평가 대상 {{pendingCount}}건이 남아 있습니다.\n\n{{link}}',
    defaultLink: '/evaluation/results',
  },
  {
    code: 'calibration-reminder-in-app',
    name: '캘리브레이션 리마인더 (앱)',
    type: NotificationType.CALIBRATION_REMINDER,
    channel: NotificationDeliveryChannel.IN_APP,
    subjectTemplate: '{{cycleName}} 캘리브레이션 준비',
    bodyTemplate: '{{employeeName}}님, {{cycleName}} 캘리브레이션 일정이 곧 시작됩니다.',
    defaultLink: '/compensation/manage',
  },
  {
    code: 'calibration-reminder-email',
    name: '캘리브레이션 리마인더 (메일)',
    type: NotificationType.CALIBRATION_REMINDER,
    channel: NotificationDeliveryChannel.EMAIL,
    subjectTemplate: '[성과관리] {{cycleName}} 캘리브레이션 준비',
    bodyTemplate: '{{employeeName}}님,\n\n{{cycleName}} 캘리브레이션/등급 조정 일정이 곧 시작됩니다.\n\n{{link}}',
    defaultLink: '/compensation/manage',
  },
  {
    code: 'result-confirmation-reminder-in-app',
    name: '결과 확정 리마인더 (앱)',
    type: NotificationType.RESULT_CONFIRMATION_REMINDER,
    channel: NotificationDeliveryChannel.IN_APP,
    subjectTemplate: '{{cycleName}} 결과 확정 안내',
    bodyTemplate: '{{employeeName}}님, {{cycleName}}의 결과 확정/공개가 예정되어 있습니다.',
    defaultLink: '/evaluation/results',
  },
  {
    code: 'result-confirmation-reminder-email',
    name: '결과 확정 리마인더 (메일)',
    type: NotificationType.RESULT_CONFIRMATION_REMINDER,
    channel: NotificationDeliveryChannel.EMAIL,
    subjectTemplate: '[성과관리] {{cycleName}} 결과 확정 안내',
    bodyTemplate: '{{employeeName}}님,\n\n{{cycleName}}의 결과 확정/공개가 예정되어 있습니다.\n\n{{link}}',
    defaultLink: '/evaluation/results',
  },
  {
    code: 'meeting-reminder-in-app',
    name: '미팅 리마인더 (앱)',
    type: NotificationType.MEETING_REMINDER,
    channel: NotificationDeliveryChannel.IN_APP,
    subjectTemplate: '{{meetingType}} 미팅 리마인더',
    bodyTemplate: '{{employeeName}}님, {{scheduledAt}}에 {{meetingType}}이 예정되어 있습니다.',
    defaultLink: '/checkin',
  },
  {
    code: 'meeting-reminder-email',
    name: '미팅 리마인더 (메일)',
    type: NotificationType.MEETING_REMINDER,
    channel: NotificationDeliveryChannel.EMAIL,
    subjectTemplate: '[성과관리] {{meetingType}} 미팅 리마인더',
    bodyTemplate: '{{employeeName}}님,\n\n{{scheduledAt}}에 {{meetingType}}이 예정되어 있습니다.\n\n{{link}}',
    defaultLink: '/checkin',
  },
]

const RETRY_DELAYS_MINUTES = [5, 15, 60]

export function buildNotificationIdempotencyKey(input: {
  recipientId: string
  type: NotificationType
  channel: NotificationDeliveryChannel
  sourceType: string
  sourceId: string
  dedupeToken: string
}) {
  return [
    input.recipientId,
    input.type,
    input.channel,
    input.sourceType,
    input.sourceId,
    input.dedupeToken,
  ].join(':')
}

export function getRetryDelayMinutes(retryCount: number) {
  return RETRY_DELAYS_MINUTES[Math.min(retryCount, RETRY_DELAYS_MINUTES.length - 1)]
}

function getZonedDate(date: Date, timezone: string) {
  return new Date(date.toLocaleString('en-US', { timeZone: timezone }))
}

function parseTimeValue(value?: string | null) {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return { hours, minutes }
}

export function isWithinQuietHours(
  date: Date,
  preference: {
    quietHoursEnabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
    timezone: string
  }
) {
  if (!preference.quietHoursEnabled) return false

  const start = parseTimeValue(preference.quietHoursStart)
  const end = parseTimeValue(preference.quietHoursEnd)
  if (!start || !end) return false

  const zoned = getZonedDate(date, preference.timezone)
  const minutes = zoned.getHours() * 60 + zoned.getMinutes()
  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes = end.hours * 60 + end.minutes

  if (startMinutes === endMinutes) return true
  if (startMinutes < endMinutes) return minutes >= startMinutes && minutes < endMinutes
  return minutes >= startMinutes || minutes < endMinutes
}

export function getNextAllowedNotificationTime(
  date: Date,
  preference: {
    quietHoursEnabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
    timezone: string
  }
) {
  if (!isWithinQuietHours(date, preference)) return date

  const end = parseTimeValue(preference.quietHoursEnd)
  if (!end) return date

  const zoned = getZonedDate(date, preference.timezone)
  const offset = zoned.getTime() - date.getTime()
  const target = new Date(zoned)
  target.setSeconds(0, 0)
  target.setHours(end.hours, end.minutes, 0, 0)

  const start = parseTimeValue(preference.quietHoursStart)
  if (start) {
    const startMinutes = start.hours * 60 + start.minutes
    const endMinutes = end.hours * 60 + end.minutes
    const currentMinutes = zoned.getHours() * 60 + zoned.getMinutes()
    if (startMinutes > endMinutes && currentMinutes >= startMinutes) {
      target.setDate(target.getDate() + 1)
    }
  }

  return new Date(target.getTime() - offset)
}

export function getNextDigestDispatchTime(date: Date, timezone: string) {
  const zoned = getZonedDate(date, timezone)
  const offset = zoned.getTime() - date.getTime()
  const target = new Date(zoned)
  target.setSeconds(0, 0)
  target.setHours(8, 0, 0, 0)
  if (zoned.getHours() >= 8) target.setDate(target.getDate() + 1)
  return new Date(target.getTime() - offset)
}

function renderTemplate(template: string, payload: Record<string, string | number | boolean | null | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = payload[key]
    return value == null ? '' : String(value)
  })
}

function buildTemplateCode(type: NotificationType, channel: NotificationDeliveryChannel) {
  return `${type.toLowerCase().replace(/_/g, '-')}-${channel.toLowerCase().replace(/_/g, '-')}`
}

export async function ensureDefaultNotificationTemplates(db: PrismaClient = prisma) {
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    await db.notificationTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        type: template.type,
        channel: template.channel,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        defaultLink: template.defaultLink,
        isDigestCompatible: template.isDigestCompatible ?? true,
      },
      create: {
        code: template.code,
        name: template.name,
        type: template.type,
        channel: template.channel,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        defaultLink: template.defaultLink,
        isDigestCompatible: template.isDigestCompatible ?? true,
      },
    })
  }
}

export async function ensureNotificationPreference(employeeId: string, db: PrismaClient = prisma) {
  return db.notificationPreference.upsert({
    where: { employeeId },
    update: {},
    create: {
      employeeId,
      inAppEnabled: true,
      emailEnabled: true,
      digestEnabled: false,
      quietHoursEnabled: false,
      timezone: 'Asia/Seoul',
      mutedTypes: [],
    },
  })
}

function parseMutedTypes(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getEmailTransport() {
  if (!isFeatureEnabled('emailDelivery') || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return nodemailer.createTransport({ jsonTransport: true })
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendEmail(params: { to: string; subject: string; text: string }) {
  const transporter = getEmailTransport()
  const result = await transporter.sendMail({
    from: process.env.SMTP_USER || 'noreply@company.com',
    to: params.to,
    subject: params.subject,
    text: params.text,
  })

  return typeof result.messageId === 'string' ? result.messageId : null
}

function getDefaultChannels(preference: Awaited<ReturnType<typeof ensureNotificationPreference>>) {
  const channels: NotificationDeliveryChannel[] = []
  if (preference.inAppEnabled) channels.push(NotificationDeliveryChannel.IN_APP)
  if (preference.emailEnabled) channels.push(NotificationDeliveryChannel.EMAIL)
  return channels
}

async function createNotificationJob(
  db: Prisma.TransactionClient | PrismaClient,
  params: {
    recipientId: string
    type: NotificationType
    templateCode: string
    channel: NotificationDeliveryChannel
    title: string
    message: string
    link?: string
    payload: Prisma.InputJsonValue
    scheduledFor: Date
    availableAt: Date
    priority: number
    digestKey?: string
    isDigestMember?: boolean
    sourceType: string
    sourceId: string
    idempotencyKey: string
    status?: NotificationJobStatus
    suppressReason?: string
  }
) {
  return db.notificationJob.create({
    data: {
      recipientId: params.recipientId,
      type: params.type,
      templateCode: params.templateCode,
      channel: params.channel,
      title: params.title,
      message: params.message,
      link: params.link,
      payload: params.payload,
      scheduledFor: params.scheduledFor,
      availableAt: params.availableAt,
      priority: params.priority,
      digestKey: params.digestKey,
      isDigestMember: params.isDigestMember ?? false,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      idempotencyKey: params.idempotencyKey,
      status: params.status ?? NotificationJobStatus.QUEUED,
      suppressReason: params.suppressReason,
      suppressedAt: params.status === NotificationJobStatus.SUPPRESSED ? new Date() : null,
    },
  })
}

export async function queueNotification(
  input: QueueNotificationInput,
  db: PrismaClient = prisma
): Promise<QueueNotificationResult> {
  await ensureDefaultNotificationTemplates(db)

  const [recipient, preference] = await Promise.all([
    db.employee.findUnique({
      where: { id: input.recipientId },
      select: { id: true, empName: true, gwsEmail: true },
    }),
    ensureNotificationPreference(input.recipientId, db),
  ])

  if (!recipient) {
    return { created: 0, suppressed: 1, duplicates: 0 }
  }

  const mutedTypes = parseMutedTypes(preference.mutedTypes)
  const requestedChannels = input.channels?.length ? input.channels : getDefaultChannels(preference)
  const scheduledFor = input.scheduledFor ?? new Date()
  const payload = {
    employeeName: recipient.empName,
    link: input.payload.link ? String(input.payload.link) : '',
    ...input.payload,
  }

  let created = 0
  let suppressed = 0
  let duplicates = 0

  for (const channel of requestedChannels) {
    const channelEnabled =
      channel === NotificationDeliveryChannel.IN_APP ? preference.inAppEnabled : preference.emailEnabled
    const idempotencyKey = buildNotificationIdempotencyKey({
      recipientId: input.recipientId,
      type: input.type,
      channel,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      dedupeToken: input.dedupeToken,
    })

    if (!channelEnabled || mutedTypes.includes(input.type)) {
      try {
        await createNotificationJob(db, {
          recipientId: input.recipientId,
          type: input.type,
          templateCode: buildTemplateCode(input.type, channel),
          channel,
          title: '',
          message: '',
          payload,
          scheduledFor,
          availableAt: scheduledFor,
          priority: input.priority ?? 0,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          idempotencyKey,
          status: NotificationJobStatus.SUPPRESSED,
          suppressReason: channelEnabled ? 'TYPE_MUTED' : 'CHANNEL_DISABLED',
        })
        suppressed += 1
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          duplicates += 1
          continue
        }
        throw error
      }
      continue
    }

    const templateCode = buildTemplateCode(input.type, channel)
    const template = await db.notificationTemplate.findUnique({ where: { code: templateCode } })
    if (!template || !template.isActive) continue

    let availableAt = getNextAllowedNotificationTime(scheduledFor, preference)
    let digestKey: string | undefined
    let isDigestMember = false

    if (channel === NotificationDeliveryChannel.EMAIL && preference.digestEnabled && template.isDigestCompatible) {
      availableAt = getNextDigestDispatchTime(scheduledFor, preference.timezone)
      digestKey = `${input.recipientId}:${availableAt.toISOString().slice(0, 10)}`
      isDigestMember = true
    }

    const title = renderTemplate(template.subjectTemplate, payload)
    const message = renderTemplate(template.bodyTemplate, {
      ...payload,
      link: payload.link || template.defaultLink || '',
    })

    try {
      await createNotificationJob(db, {
        recipientId: input.recipientId,
        type: input.type,
        templateCode,
        channel,
        title,
        message,
        link:
          typeof payload.link === 'string'
            ? payload.link
            : (template.defaultLink ?? undefined),
        payload,
        scheduledFor,
        availableAt,
        priority: input.priority ?? 0,
        digestKey,
        isDigestMember,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey,
      })
      created += 1
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        duplicates += 1
        continue
      }
      throw error
    }
  }

  return { created, suppressed, duplicates }
}

async function markJobFailure(db: PrismaClient, jobId: string, error: unknown) {
  const job = await db.notificationJob.findUnique({
    where: { id: jobId },
  })
  if (!job) return { deadLetter: false }

  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  const nextRetryCount = job.retryCount + 1
  const shouldDeadLetter = nextRetryCount >= job.maxRetries

  await db.notificationAttempt.create({
    data: {
      notificationJobId: job.id,
      channel: job.channel,
      status: NotificationAttemptStatus.FAILED,
      errorMessage: message,
    },
  })

  if (shouldDeadLetter) {
    await db.$transaction(async (tx) => {
      await tx.notificationJob.update({
        where: { id: job.id },
        data: {
          status: NotificationJobStatus.DEAD_LETTER,
          lastError: message,
          retryCount: nextRetryCount,
        },
      })

      await tx.notificationDeadLetter.upsert({
        where: { notificationJobId: job.id },
        update: {
          reason: message,
          payload: job.payload ?? Prisma.JsonNull,
        },
        create: {
          notificationJobId: job.id,
          recipientId: job.recipientId,
          channel: job.channel,
          type: job.type,
          idempotencyKey: job.idempotencyKey,
          reason: message,
          payload: job.payload ?? Prisma.JsonNull,
        },
      })
    })

    return { deadLetter: true }
  }

  const nextRetryAt = new Date(Date.now() + getRetryDelayMinutes(job.retryCount) * 60 * 1000)
  await db.notificationJob.update({
    where: { id: job.id },
    data: {
      status: NotificationJobStatus.RETRY_PENDING,
      retryCount: nextRetryCount,
      nextRetryAt,
      availableAt: nextRetryAt,
      lastError: message,
    },
  })

  return { deadLetter: false }
}

async function getProcessableJobs(db: PrismaClient) {
  const now = new Date()
  return db.notificationJob.findMany({
    where: {
      status: { in: [NotificationJobStatus.QUEUED, NotificationJobStatus.RETRY_PENDING] },
      availableAt: { lte: now },
    },
    include: {
      recipient: {
        select: { id: true, empName: true, gwsEmail: true },
      },
    },
    orderBy: [{ priority: 'desc' }, { availableAt: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  })
}

async function deliverInAppJob(
  db: PrismaClient,
  job: Awaited<ReturnType<typeof getProcessableJobs>>[number]
) {
  await db.$transaction(async (tx) => {
    await tx.notification.create({
      data: {
        recipientId: job.recipientId,
        type: job.type,
        title: job.title || '',
        message: job.message || '',
        link: job.link,
        channel: 'IN_APP',
        templateCode: job.templateCode,
        jobId: job.id,
        metadata: job.payload ?? Prisma.JsonNull,
      },
    })

    await tx.notificationAttempt.create({
      data: {
        notificationJobId: job.id,
        channel: job.channel,
        status: NotificationAttemptStatus.SUCCESS,
      },
    })

    await tx.notificationJob.update({
      where: { id: job.id },
      data: {
        status: NotificationJobStatus.SENT,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    })
  })
}

async function deliverEmailJob(
  db: PrismaClient,
  job: Awaited<ReturnType<typeof getProcessableJobs>>[number]
) {
  const providerMessageId = await sendEmail({
    to: job.recipient.gwsEmail,
    subject: job.title || '',
    text: job.message || '',
  })

  await db.$transaction(async (tx) => {
    await tx.notificationAttempt.create({
      data: {
        notificationJobId: job.id,
        channel: job.channel,
        status: NotificationAttemptStatus.SUCCESS,
        providerMessageId,
      },
    })

    await tx.notificationJob.update({
      where: { id: job.id },
      data: {
        status: NotificationJobStatus.SENT,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    })
  })
}

async function deliverDigestGroup(
  db: PrismaClient,
  jobs: Awaited<ReturnType<typeof getProcessableJobs>>
) {
  if (!jobs.length) return { processed: 0, success: 0 }

  const firstJob = jobs[0]
  const subject = `[성과관리] ${jobs.length}건의 알림 요약`
  const text = jobs
    .map((job, index) => `${index + 1}. ${job.title}\n${job.message}\n${job.link || ''}`)
    .join('\n\n')

  const providerMessageId = await sendEmail({
    to: firstJob.recipient.gwsEmail,
    subject,
    text,
  })

  await db.$transaction(async (tx) => {
    for (const job of jobs) {
      await tx.notificationAttempt.create({
        data: {
          notificationJobId: job.id,
          channel: job.channel,
          status: NotificationAttemptStatus.SUCCESS,
          providerMessageId,
        },
      })

      await tx.notificationJob.update({
        where: { id: job.id },
        data: {
          status: NotificationJobStatus.SENT,
          sentAt: new Date(),
          deliveredAt: new Date(),
        },
      })
    }
  })

  return { processed: jobs.length, success: jobs.length }
}

export async function dispatchDueNotificationJobs(db: PrismaClient = prisma): Promise<DispatchSummary> {
  const jobs = await getProcessableJobs(db)
  const summary: DispatchSummary = {
    processedCount: jobs.length,
    successCount: 0,
    failedCount: 0,
    retriedCount: 0,
    deadLetterCount: 0,
    suppressedCount: 0,
  }

  const digestGroups = new Map<string, typeof jobs>()
  const immediateJobs: typeof jobs = []

  for (const job of jobs) {
    if (job.channel === NotificationDeliveryChannel.EMAIL && job.isDigestMember && job.digestKey) {
      const bucket = digestGroups.get(job.digestKey) ?? []
      bucket.push(job)
      digestGroups.set(job.digestKey, bucket)
      continue
    }
    immediateJobs.push(job)
  }

  for (const job of immediateJobs) {
    try {
      if (job.channel === NotificationDeliveryChannel.IN_APP) {
        await deliverInAppJob(db, job)
      } else {
        await deliverEmailJob(db, job)
      }
      summary.successCount += 1
    } catch (error) {
      const result = await markJobFailure(db, job.id, error)
      summary.failedCount += 1
      if (result.deadLetter) summary.deadLetterCount += 1
      else summary.retriedCount += 1
    }
  }

  for (const group of digestGroups.values()) {
    try {
      const result = await deliverDigestGroup(db, group)
      summary.successCount += result.success
    } catch (error) {
      for (const job of group) {
        const retry = await markJobFailure(db, job.id, error)
        summary.failedCount += 1
        if (retry.deadLetter) summary.deadLetterCount += 1
        else summary.retriedCount += 1
      }
    }
  }

  return summary
}

function formatDateTime(value: Date) {
  return value.toLocaleString('ko-KR', { hour12: false })
}

function getEvaluationStageLabel(status: string) {
  const map: Record<string, string> = {
    SELF_EVAL: '자기평가',
    FIRST_EVAL: '1차 평가',
    SECOND_EVAL: '2차 평가',
    FINAL_EVAL: '최종 평가',
  }
  return map[status] ?? status
}

export async function enqueueLifecycleReminders(db: PrismaClient = prisma) {
  await ensureDefaultNotificationTemplates(db)

  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [activeEmployees, cycles, checkIns, pendingEvaluations, monthlyKpis] = await Promise.all([
    db.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, empName: true, role: true },
    }),
    db.evalCycle.findMany({
      where: {
        OR: [
          { kpiSetupEnd: { gte: now, lte: threeDaysLater } },
          { resultOpenStart: { gte: now, lte: threeDaysLater } },
          { ceoAdjustStart: { gte: now, lte: threeDaysLater } },
        ],
      },
      select: {
        id: true,
        cycleName: true,
        status: true,
        kpiSetupEnd: true,
        resultOpenStart: true,
        ceoAdjustStart: true,
      },
    }),
    db.checkIn.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: { gte: now, lte: oneDayLater },
      },
      include: {
        owner: { select: { id: true, empName: true } },
        manager: { select: { id: true, empName: true } },
      },
    }),
    db.evaluation.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        evalCycle: {
          status: { in: ['SELF_EVAL', 'FIRST_EVAL', 'SECOND_EVAL', 'FINAL_EVAL'] },
        },
      },
      include: {
        evaluator: { select: { id: true, empName: true } },
        evalCycle: { select: { id: true, status: true } },
      },
    }),
    db.personalKpi.findMany({
      where: { status: { in: ['DRAFT', 'CONFIRMED'] } },
      include: {
        employee: { select: { id: true, empName: true } },
      },
      take: 200,
    }),
  ])

  let created = 0
  let suppressed = 0
  let duplicates = 0

  for (const cycle of cycles) {
    if (cycle.kpiSetupEnd) {
      for (const employee of activeEmployees) {
        const result = await queueNotification(
          {
            recipientId: employee.id,
            type: NotificationType.GOAL_REMINDER,
            sourceType: 'EvalCycle',
            sourceId: cycle.id,
            dedupeToken: `goal:${cycle.kpiSetupEnd.toISOString().slice(0, 10)}`,
            payload: {
              cycleName: cycle.cycleName,
              dueDate: formatDateTime(cycle.kpiSetupEnd),
              link: '/kpi/personal',
            },
          },
          db
        )
        created += result.created
        suppressed += result.suppressed
        duplicates += result.duplicates
      }
    }

    if (cycle.ceoAdjustStart) {
      for (const employee of activeEmployees.filter((item) =>
        ['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'].includes(item.role)
      )) {
        const result = await queueNotification(
          {
            recipientId: employee.id,
            type: NotificationType.CALIBRATION_REMINDER,
            sourceType: 'EvalCycle',
            sourceId: cycle.id,
            dedupeToken: `calibration:${cycle.ceoAdjustStart.toISOString().slice(0, 10)}`,
            payload: {
              cycleName: cycle.cycleName,
              link: '/compensation/manage',
            },
          },
          db
        )
        created += result.created
        suppressed += result.suppressed
        duplicates += result.duplicates
      }
    }

    if (cycle.resultOpenStart) {
      const evaluationTargets = await db.evaluation.findMany({
        where: { evalCycleId: cycle.id },
        distinct: ['targetId'],
        select: { targetId: true },
      })

      for (const target of evaluationTargets) {
        const result = await queueNotification(
          {
            recipientId: target.targetId,
            type: NotificationType.RESULT_CONFIRMATION_REMINDER,
            sourceType: 'EvalCycle',
            sourceId: cycle.id,
            dedupeToken: `result:${cycle.resultOpenStart.toISOString().slice(0, 10)}`,
            payload: {
              cycleName: cycle.cycleName,
              link: '/evaluation/results',
            },
          },
          db
        )
        created += result.created
        suppressed += result.suppressed
        duplicates += result.duplicates
      }
    }
  }

  const yearMonth = now.toISOString().slice(0, 7)
  for (const record of monthlyKpis) {
    const result = await queueNotification(
      {
        recipientId: record.employeeId,
        type: NotificationType.CHECKPOINT_REMINDER,
        sourceType: 'PersonalKpi',
        sourceId: record.id,
        dedupeToken: `checkpoint:${yearMonth}`,
        payload: {
          yearMonth,
          link: '/kpi/monthly',
        },
      },
      db
    )
    created += result.created
    suppressed += result.suppressed
    duplicates += result.duplicates
  }

  const evaluationBuckets = new Map<
    string,
    { evaluatorId: string; stageLabel: string; count: number; cycleId: string }
  >()
  for (const evaluation of pendingEvaluations) {
    const key = `${evaluation.evaluatorId}:${evaluation.evalCycleId}:${evaluation.evalCycle.status}`
    const bucket = evaluationBuckets.get(key) ?? {
      evaluatorId: evaluation.evaluatorId,
      stageLabel: getEvaluationStageLabel(evaluation.evalCycle.status),
      count: 0,
      cycleId: evaluation.evalCycle.id,
    }
    bucket.count += 1
    evaluationBuckets.set(key, bucket)
  }

  for (const bucket of evaluationBuckets.values()) {
    const result = await queueNotification(
      {
        recipientId: bucket.evaluatorId,
        type: NotificationType.EVALUATION_REMINDER,
        sourceType: 'EvaluationCycleStage',
        sourceId: bucket.cycleId,
        dedupeToken: `evaluation:${bucket.stageLabel}:${now.toISOString().slice(0, 10)}`,
        payload: {
          stageLabel: bucket.stageLabel,
          pendingCount: bucket.count,
          link: '/evaluation/results',
        },
      },
      db
    )
    created += result.created
    suppressed += result.suppressed
    duplicates += result.duplicates
  }

  for (const checkIn of checkIns) {
    for (const recipient of [checkIn.owner, checkIn.manager]) {
      const result = await queueNotification(
        {
          recipientId: recipient.id,
          type: NotificationType.MEETING_REMINDER,
          sourceType: 'CheckIn',
          sourceId: checkIn.id,
          dedupeToken: `meeting:${checkIn.scheduledDate.toISOString()}:${recipient.id}`,
          payload: {
            meetingType: checkIn.checkInType,
            scheduledAt: formatDateTime(checkIn.scheduledDate),
            link: '/checkin',
          },
          scheduledFor: checkIn.scheduledDate,
        },
        db
      )
      created += result.created
      suppressed += result.suppressed
      duplicates += result.duplicates
    }
  }

  return {
    processedCount: created + suppressed + duplicates,
    successCount: created,
    failedCount: 0,
    retriedCount: 0,
    deadLetterCount: 0,
    suppressedCount: suppressed + duplicates,
  }
}

export async function runNotificationJob(
  params: {
    mode: 'schedule' | 'dispatch' | 'all'
    triggerSource: string
  },
  db: PrismaClient = prisma
) {
  const execution = await db.jobExecution.create({
    data: {
      jobName: `notification-${params.mode}`,
      jobType: params.mode === 'dispatch' ? JobExecutionType.DISPATCH : JobExecutionType.SCHEDULER,
      status: JobExecutionStatus.RUNNING,
      triggerSource: params.triggerSource,
    },
  })

  try {
    const scheduleSummary =
      params.mode === 'dispatch'
        ? { processedCount: 0, successCount: 0, failedCount: 0, retriedCount: 0, deadLetterCount: 0, suppressedCount: 0 }
        : await enqueueLifecycleReminders(db)

    const dispatchSummary =
      params.mode === 'schedule'
        ? { processedCount: 0, successCount: 0, failedCount: 0, retriedCount: 0, deadLetterCount: 0, suppressedCount: 0 }
        : await dispatchDueNotificationJobs(db)

    const merged = {
      processedCount: scheduleSummary.processedCount + dispatchSummary.processedCount,
      successCount: scheduleSummary.successCount + dispatchSummary.successCount,
      failedCount: scheduleSummary.failedCount + dispatchSummary.failedCount,
      retriedCount: scheduleSummary.retriedCount + dispatchSummary.retriedCount,
      deadLetterCount: scheduleSummary.deadLetterCount + dispatchSummary.deadLetterCount,
      suppressedCount: scheduleSummary.suppressedCount + dispatchSummary.suppressedCount,
    }

    await db.jobExecution.update({
      where: { id: execution.id },
      data: {
        status:
          merged.failedCount > 0 && merged.successCount > 0
            ? JobExecutionStatus.PARTIAL
            : merged.failedCount > 0
              ? JobExecutionStatus.FAILED
              : JobExecutionStatus.SUCCESS,
        finishedAt: new Date(),
        ...merged,
        metadata: {
          scheduleSummary,
          dispatchSummary,
        },
      },
    })

    return { executionId: execution.id, ...merged }
  } catch (error) {
    await db.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: JobExecutionStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      },
    })
    throw error
  }
}
