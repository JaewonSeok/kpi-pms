import { OperationalEventLevel, Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { getFeatureFlagSnapshot, isFeatureEnabled } from './feature-flags'

type OperationalEventInput = {
  level: OperationalEventLevel
  component: string
  eventType: string
  message: string
  metadata?: Record<string, unknown>
}

type HealthCheck = {
  name: string
  status: 'ok' | 'warn' | 'error'
  detail: string
}

type SecretCheck = {
  name: string
  requiredIn: Array<'dev' | 'stage' | 'prod'>
  configured: boolean
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

async function buildHealthChecks(db: PrismaClient) {
  const checks: HealthCheck[] = []

  try {
    await db.$queryRawUnsafe('SELECT 1')
    checks.push({ name: 'database', status: 'ok', detail: 'Database connection succeeded.' })
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Database connection failed.',
    })
  }

  const secretChecks = buildSecretChecks()
  const missingRequiredSecrets = secretChecks.filter((check) => check.isRequired && !check.configured)
  checks.push({
    name: 'secrets',
    status: missingRequiredSecrets.length ? 'error' : 'ok',
    detail: missingRequiredSecrets.length
      ? `Missing required secrets: ${missingRequiredSecrets.map((item) => item.name).join(', ')}`
      : 'Required secrets are configured.',
  })

  checks.push({
    name: 'feature-flags',
    status: 'ok',
    detail: `${getFeatureFlagSnapshot().filter((item) => item.enabled).length} feature flags enabled.`,
  })

  return checks
}

export async function buildOperationsSummary(db: PrismaClient = prisma) {
  const now = Date.now()
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const env = getAppEnvironment()
  const featureFlags = getFeatureFlagSnapshot()
  const healthChecks = await buildHealthChecks(db)
  const secretChecks = buildSecretChecks()

  const [
    employeeCount,
    notificationDeadLetters,
    failedJobs24h,
    aiFallback24h,
    aiDisabled24h,
    aiSuccess24h,
    overBudgetScenarios,
    operationalErrors24h,
    recentEvents,
  ] = await Promise.all([
    db.employee.count(),
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
      where: {
        isOverBudget: true,
      },
    }),
    db.operationalEvent.count({
      where: {
        createdAt: { gte: twentyFourHoursAgo },
        level: 'ERROR',
      },
    }),
    db.operationalEvent.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ])

  return {
    environment: {
      appEnv: env,
      nodeEnv: process.env.NODE_ENV || 'development',
      appVersion: process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      deploymentTarget: process.env.DEPLOY_TARGET || 'docker',
      errorTrackingConfigured: Boolean(process.env.SENTRY_DSN || process.env.ERROR_WEBHOOK_URL),
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
    },
    recentEvents,
  }
}

export async function buildReadinessStatus(db: PrismaClient = prisma) {
  const checks = await buildHealthChecks(db)
  const isReady = !checks.some((check) => check.status === 'error')

  return {
    status: isReady ? 'ready' : 'not_ready',
    checks,
  }
}
