import { OperationalEventLevel, Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { getFeatureFlagSnapshot, isFeatureEnabled } from './feature-flags'
import { getAllowedGoogleWorkspaceDomain } from './google-workspace'

type OperationalEventInput = {
  level: OperationalEventLevel
  component: string
  eventType: string
  message: string
  metadata?: Record<string, unknown>
}

type HealthStatus = 'ok' | 'warn' | 'error'

type HealthCheck = {
  key: string
  name: string
  status: HealthStatus
  detail: string
  impact?: string
  checkedAt: string
}

type SecretCheck = {
  name: string
  requiredIn: Array<'dev' | 'stage' | 'prod'>
  configured: boolean
}

type OpsRisk = {
  id: string
  label: string
  count: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  relatedUrl?: string
  description: string
}

type MetricsInput = {
  failedJobs24h: number
  notificationDeadLetters: number
  aiFallback24h: number
  overBudgetScenarios: number
  queueBacklog: number
  loginUnavailableAccounts: number
  activeEvalCycles: number
}

export function getAppEnvironment(): 'dev' | 'stage' | 'prod' {
  const value = (process.env.APP_ENV || 'dev').toLowerCase()
  if (value === 'stage') return 'stage'
  if (value === 'prod') return 'prod'
  return 'dev'
}

export async function recordOperationalEvent(
  event: OperationalEventInput,
  db: PrismaClient = prisma
) {
  const payload = {
    timestamp: new Date().toISOString(),
    env: getAppEnvironment(),
    ...event,
  }

  if (event.level === OperationalEventLevel.ERROR) {
    console.error(JSON.stringify(payload))
  } else if (event.level === OperationalEventLevel.WARN) {
    console.warn(JSON.stringify(payload))
  } else {
    console.log(JSON.stringify(payload))
  }

  try {
    await db.operationalEvent.create({
      data: {
        level: event.level,
        component: event.component,
        eventType: event.eventType,
        message: event.message,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.error('Failed to persist operational event', error)
  }
}

function buildSecretChecks() {
  const env = getAppEnvironment()
  const checks: SecretCheck[] = [
    {
      name: 'NEXTAUTH_SECRET',
      requiredIn: ['stage', 'prod'],
      configured: Boolean(process.env.NEXTAUTH_SECRET),
    },
    {
      name: 'CRON_SECRET',
      requiredIn: ['stage', 'prod'],
      configured: Boolean(process.env.CRON_SECRET),
    },
    {
      name: 'DATABASE_URL',
      requiredIn: ['dev', 'stage', 'prod'],
      configured: Boolean(process.env.DATABASE_URL),
    },
    {
      name: 'OPENAI_API_KEY',
      requiredIn: isFeatureEnabled('aiAssist') ? ['stage', 'prod'] : [],
      configured: Boolean(process.env.OPENAI_API_KEY),
    },
    {
      name: 'SMTP_PASS',
      requiredIn: isFeatureEnabled('emailDelivery') ? ['stage', 'prod'] : [],
      configured: Boolean(process.env.SMTP_PASS),
    },
    {
      name: 'OPS_METRICS_TOKEN',
      requiredIn: ['stage', 'prod'],
      configured: Boolean(process.env.OPS_METRICS_TOKEN),
    },
  ]

  return checks.map((check) => ({
    ...check,
    isRequired: check.requiredIn.includes(env),
  }))
}

function evaluateCycleDelay(cycle: {
  status: string
  kpiSetupEnd: Date | null
  selfEvalEnd: Date | null
  firstEvalEnd: Date | null
  secondEvalEnd: Date | null
  finalEvalEnd: Date | null
  ceoAdjustEnd: Date | null
  resultOpenEnd: Date | null
  appealDeadline: Date | null
}) {
  const now = Date.now()
  const getTime = (value: Date | null | undefined) => (value ? value.getTime() : 0)

  switch (cycle.status) {
    case 'KPI_SETTING':
      return getTime(cycle.kpiSetupEnd) > 0 && getTime(cycle.kpiSetupEnd) < now
    case 'SELF_EVAL':
      return getTime(cycle.selfEvalEnd) > 0 && getTime(cycle.selfEvalEnd) < now
    case 'FIRST_EVAL':
      return getTime(cycle.firstEvalEnd) > 0 && getTime(cycle.firstEvalEnd) < now
    case 'SECOND_EVAL':
      return getTime(cycle.secondEvalEnd) > 0 && getTime(cycle.secondEvalEnd) < now
    case 'FINAL_EVAL':
      return getTime(cycle.finalEvalEnd) > 0 && getTime(cycle.finalEvalEnd) < now
    case 'CEO_ADJUST':
      return getTime(cycle.ceoAdjustEnd) > 0 && getTime(cycle.ceoAdjustEnd) < now
    case 'RESULT_OPEN':
      return getTime(cycle.resultOpenEnd) > 0 && getTime(cycle.resultOpenEnd) < now
    case 'APPEAL':
      return getTime(cycle.appealDeadline) > 0 && getTime(cycle.appealDeadline) < now
    default:
      return false
  }
}

function determineOpsStatus(metrics: MetricsInput): {
  label: '정상' | '주의' | '장애'
  tone: 'ok' | 'warn' | 'error'
} {
  if (
    metrics.failedJobs24h > 3 ||
    metrics.notificationDeadLetters > 0 ||
    metrics.overBudgetScenarios > 0
  ) {
    return { label: '장애', tone: 'error' }
  }

  if (
    metrics.aiFallback24h > 0 ||
    metrics.queueBacklog > 0 ||
    metrics.loginUnavailableAccounts > 0 ||
    metrics.activeEvalCycles > 0
  ) {
    return { label: '주의', tone: 'warn' }
  }

  return { label: '정상', tone: 'ok' }
}

async function buildHealthChecks(
  db: PrismaClient,
  context: {
    queueBacklog: number
    notificationDeadLetters: number
    aiFallback24h: number
    loginUnavailableAccounts: number
  }
) {
  const checkedAt = new Date().toISOString()
  const checks: HealthCheck[] = []

  try {
    await db.$queryRawUnsafe('SELECT 1')
    checks.push({
      key: 'db',
      name: 'DB',
      status: 'ok',
      detail: '데이터베이스 연결이 정상입니다.',
      checkedAt,
    })
  } catch (error) {
    checks.push({
      key: 'db',
      name: 'DB',
      status: 'error',
      detail: '데이터베이스 연결에 실패했습니다.',
      impact: error instanceof Error ? error.message : 'DB query failed.',
      checkedAt,
    })
  }

  checks.push({
    key: 'api',
    name: 'API',
    status: 'ok',
    detail: '주요 서버 API 라우트가 응답 가능한 상태입니다.',
    checkedAt,
  })

  const authSecretReady = Boolean(process.env.NEXTAUTH_SECRET)
  checks.push({
    key: 'auth',
    name: 'Auth',
    status: authSecretReady && context.loginUnavailableAccounts === 0 ? 'ok' : authSecretReady ? 'warn' : 'error',
    detail:
      context.loginUnavailableAccounts > 0
        ? `로그인 준비가 안 된 계정 ${context.loginUnavailableAccounts}건이 있습니다.`
        : authSecretReady
          ? '인증 설정이 정상입니다.'
          : 'NEXTAUTH_SECRET 설정이 누락되었습니다.',
    impact: context.loginUnavailableAccounts > 0 ? 'Google 계정 등록 화면에서 대상 계정을 점검해 주세요.' : undefined,
    checkedAt,
  })

  checks.push({
    key: 'notification',
    name: 'Notification',
    status:
      context.notificationDeadLetters > 0
        ? 'error'
        : context.queueBacklog > 0
          ? 'warn'
          : 'ok',
    detail:
      context.notificationDeadLetters > 0
        ? `Dead letter ${context.notificationDeadLetters}건이 남아 있습니다.`
        : context.queueBacklog > 0
          ? `재시도 또는 큐 적체 ${context.queueBacklog}건이 있습니다.`
          : '알림 큐와 발송 상태가 안정적입니다.',
    impact:
      context.notificationDeadLetters > 0
        ? '알림 운영 화면에서 재처리 또는 보관 조치가 필요합니다.'
        : context.queueBacklog > 0
          ? '알림 스케줄러 지연 여부를 확인해 주세요.'
          : undefined,
    checkedAt,
  })

  const aiReady = isFeatureEnabled('aiAssist') && Boolean(process.env.OPENAI_API_KEY)
  checks.push({
    key: 'ai',
    name: 'AI',
    status: !isFeatureEnabled('aiAssist') ? 'warn' : !aiReady ? 'error' : context.aiFallback24h > 0 ? 'warn' : 'ok',
    detail:
      !isFeatureEnabled('aiAssist')
        ? 'AI 기능이 비활성화되어 fallback만 제공합니다.'
        : !aiReady
          ? 'OPENAI_API_KEY가 없어 AI 요청을 처리할 수 없습니다.'
          : context.aiFallback24h > 0
            ? `최근 24시간 fallback ${context.aiFallback24h}건이 발생했습니다.`
            : 'AI 기능이 정상 응답 중입니다.',
    impact:
      context.aiFallback24h > 0
        ? 'AI 요약/보조 품질이 낮아질 수 있으니 장애 패턴을 확인해 주세요.'
        : undefined,
    checkedAt,
  })

  return checks
}

function buildRunbooks() {
  return [
    {
      id: 'login-issue',
      title: '로그인 이슈 대응',
      description: 'Google 계정 누락, 도메인 불일치, 로그인 준비 불가 계정을 점검합니다.',
      severity: 'HIGH',
      relatedUrl: '/admin/google-access',
      docUrl: 'docs/operations/admin-runbook.md',
    },
    {
      id: 'notification-failure',
      title: '알림 실패 복구',
      description: 'Dead letter, 재시도 큐, 템플릿 변수 누락을 복구합니다.',
      severity: 'HIGH',
      relatedUrl: '/admin/notifications',
      docUrl: 'docs/operations/incident-runbook.md',
    },
    {
      id: 'evaluation-publish',
      title: '평가 공개 이슈',
      description: '평가 주기 지연, 결과 공개 차단, 조정 미완료 상태를 점검합니다.',
      severity: 'MEDIUM',
      relatedUrl: '/admin/eval-cycle',
      docUrl: 'docs/product/performance-management-prd.md',
    },
    {
      id: 'compensation-publish',
      title: '보상 공개 이슈',
      description: '예산 초과 시나리오와 공개 전 체크리스트를 점검합니다.',
      severity: 'HIGH',
      relatedUrl: '/compensation/manage',
      docUrl: 'docs/operations/release-readiness.md',
    },
    {
      id: 'ai-fallback',
      title: 'AI fallback 급증 대응',
      description: 'OpenAI 설정, feature flag, fallback 증가 패턴을 점검합니다.',
      severity: 'MEDIUM',
      relatedUrl: '/admin/notifications',
      docUrl: 'docs/operations/performance-observability.md',
    },
  ]
}

export async function buildOperationsSummary(db: PrismaClient = prisma) {
  const now = Date.now()
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const env = getAppEnvironment()
  const featureFlags = getFeatureFlagSnapshot()
  const secretChecks = buildSecretChecks()

  let allowedDomain: string | null = null
  try {
    allowedDomain = getAllowedGoogleWorkspaceDomain()
  } catch {
    allowedDomain = null
  }

  const [employeeCount, activeEmployees, notificationDeadLetters, failedJobs24h, aiFallback24h, aiDisabled24h, aiSuccess24h, overBudgetScenarios, operationalErrors24h, recentEvents, queueSummary, inactiveTemplates, evalCycles, monthlyWorkflowLogs] = await Promise.all([
    db.employee.count(),
    db.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, gwsEmail: true, empName: true },
    }),
    db.notificationDeadLetter.count(),
    db.jobExecution.count({
      where: {
        startedAt: { gte: twentyFourHoursAgo },
        status: { in: ['FAILED', 'PARTIAL'] },
      },
    }),
    db.aiRequestLog.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        requestStatus: 'FALLBACK',
      },
    }),
    db.aiRequestLog.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        requestStatus: 'DISABLED',
      },
    }),
    db.aiRequestLog.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        requestStatus: 'SUCCESS',
      },
    }),
    db.compensationScenario.count({
      where: { isOverBudget: true },
    }),
    db.operationalEvent.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        level: 'ERROR',
      },
    }),
    db.operationalEvent.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    Promise.all([
      db.notificationJob.count({ where: { status: 'QUEUED' } }),
      db.notificationJob.count({ where: { status: 'RETRY_PENDING' } }),
      db.notificationJob.count({ where: { status: 'SUPPRESSED' } }),
    ]),
    db.notificationTemplate.count({ where: { isActive: false } }),
    db.evalCycle.findMany({
      where: { status: { not: 'CLOSED' } },
      select: {
        id: true,
        cycleName: true,
        status: true,
        kpiSetupEnd: true,
        selfEvalEnd: true,
        firstEvalEnd: true,
        secondEvalEnd: true,
        finalEvalEnd: true,
        ceoAdjustEnd: true,
        resultOpenEnd: true,
        appealDeadline: true,
      },
    }),
    db.auditLog.findMany({
      where: {
        entityType: 'MonthlyRecord',
        action: { in: ['MONTHLY_RECORD_SUBMITTED', 'MONTHLY_RECORD_REVIEWED', 'MONTHLY_RECORD_LOCKED'] },
        timestamp: { gte: sevenDaysAgo },
      },
      select: {
        entityId: true,
        action: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'desc' },
    }),
  ])

  const loginUnavailableAccounts = activeEmployees.filter((employee) => {
    const email = employee.gwsEmail?.trim().toLowerCase()
    if (!email) return true
    if (!allowedDomain) return false
    return !email.endsWith(`@${allowedDomain}`)
  }).length

  const activeEvalCycles = evalCycles.filter((cycle) => cycle.status !== 'SETUP').length
  const delayedEvalCycles = evalCycles.filter((cycle) => evaluateCycleDelay(cycle)).length
  const unresolvedCalibrationCount = evalCycles.filter((cycle) => cycle.status === 'CEO_ADJUST').length

  const latestMonthlyStatus = new Map<string, string>()
  for (const log of monthlyWorkflowLogs) {
    if (!log.entityId) continue
    if (latestMonthlyStatus.has(log.entityId)) continue
    latestMonthlyStatus.set(log.entityId, log.action)
  }
  const unreviewedMonthlyRecords = [...latestMonthlyStatus.values()].filter(
    (action) => action === 'MONTHLY_RECORD_SUBMITTED'
  ).length

  const queueBacklog = queueSummary[0] + queueSummary[1]

  const healthChecks = await buildHealthChecks(db, {
    queueBacklog,
    notificationDeadLetters,
    aiFallback24h,
    loginUnavailableAccounts,
  })

  const risks: OpsRisk[] = [
    {
      id: 'login-unavailable',
      label: '로그인 준비 불가 계정',
      count: loginUnavailableAccounts,
      severity: loginUnavailableAccounts > 0 ? 'HIGH' : 'LOW',
      relatedUrl: '/admin/google-access',
      description: 'Google 계정 등록 또는 도메인 불일치로 로그인 준비가 안 된 계정입니다.',
    },
    {
      id: 'delayed-cycles',
      label: '진행 중 평가 주기 지연',
      count: delayedEvalCycles,
      severity: delayedEvalCycles > 0 ? 'HIGH' : 'LOW',
      relatedUrl: '/admin/eval-cycle',
      description: '현재 단계 종료일을 넘겼지만 다음 단계로 이동하지 않은 평가 주기입니다.',
    },
    {
      id: 'monthly-review-pending',
      label: '미리뷰 월간 실적',
      count: unreviewedMonthlyRecords,
      severity: unreviewedMonthlyRecords > 5 ? 'HIGH' : unreviewedMonthlyRecords > 0 ? 'MEDIUM' : 'LOW',
      relatedUrl: '/kpi/monthly',
      description: '제출 후 리뷰 또는 잠금으로 이어지지 않은 월간 실적입니다.',
    },
    {
      id: 'calibration-pending',
      label: '조정 미완료 평가',
      count: unresolvedCalibrationCount,
      severity: unresolvedCalibrationCount > 0 ? 'MEDIUM' : 'LOW',
      relatedUrl: '/evaluation/ceo-adjust',
      description: '캘리브레이션 단계에 머물러 있는 평가 주기입니다.',
    },
    {
      id: 'over-budget',
      label: '예산 초과 보상 시나리오',
      count: overBudgetScenarios,
      severity: overBudgetScenarios > 0 ? 'HIGH' : 'LOW',
      relatedUrl: '/compensation/manage',
      description: '예산 한도를 초과한 보상 시뮬레이션 시나리오입니다.',
    },
    {
      id: 'dead-letters',
      label: 'Dead Letter',
      count: notificationDeadLetters,
      severity: notificationDeadLetters > 0 ? 'HIGH' : 'LOW',
      relatedUrl: '/admin/notifications',
      description: '재처리가 필요한 알림 실패 건입니다.',
    },
  ]

  const derivedEvents = risks
    .filter((risk) => risk.count > 0)
    .slice(0, 6)
    .map((risk) => ({
      id: `derived-${risk.id}`,
      level: risk.severity === 'HIGH' ? 'ERROR' : risk.severity === 'MEDIUM' ? 'WARN' : 'INFO',
      component: 'ops-summary',
      eventType: risk.label,
      message: risk.description,
      createdAt: new Date().toISOString(),
      relatedUrl: risk.relatedUrl,
    }))

  const events = [...recentEvents.map((event) => ({
    ...event,
    relatedUrl:
      event.component === 'notification-service'
        ? '/admin/notifications'
        : event.component === 'google-access'
          ? '/admin/google-access'
          : event.component === 'compensation'
            ? '/compensation/manage'
            : event.component === 'evaluation'
              ? '/evaluation/ceo-adjust'
              : undefined,
  })), ...derivedEvents]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)

  return {
    environment: {
      appEnv: env,
      nodeEnv: process.env.NODE_ENV || 'development',
      appVersion: process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      deploymentTarget: process.env.DEPLOY_TARGET || 'docker',
      errorTrackingConfigured: Boolean(process.env.SENTRY_DSN || process.env.ERROR_WEBHOOK_URL),
      allowedDomain,
    },
    featureFlags,
    healthChecks,
    secretChecks,
    metrics: {
      employeeCount,
      notificationDeadLetters,
      failedJobs24h,
      aiFallback24h,
      aiDisabled24h,
      aiSuccess24h,
      overBudgetScenarios,
      operationalErrors24h,
      loginUnavailableAccounts,
      activeEvalCycles,
      delayedEvalCycles,
      unreviewedMonthlyRecords,
      unresolvedCalibrationCount,
      queueBacklog,
      inactiveTemplates,
    },
    status: determineOpsStatus({
      failedJobs24h,
      notificationDeadLetters,
      aiFallback24h,
      overBudgetScenarios,
      queueBacklog,
      loginUnavailableAccounts,
      activeEvalCycles,
    }),
    risks,
    runbooks: buildRunbooks(),
    recentEvents: events,
  }
}

export async function buildReadinessStatus(db: PrismaClient = prisma) {
  const checks = await buildHealthChecks(db, {
    queueBacklog: 0,
    notificationDeadLetters: 0,
    aiFallback24h: 0,
    loginUnavailableAccounts: 0,
  })
  const isReady = !checks.some((check) => check.status === 'error')

  return {
    status: isReady ? 'ready' : 'not_ready',
    checks,
  }
}
