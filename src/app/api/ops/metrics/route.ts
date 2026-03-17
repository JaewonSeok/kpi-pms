import { buildOperationsSummary } from '@/lib/operations'

function isAuthorized(request: Request) {
  const token = process.env.OPS_METRICS_TOKEN
  if (!token) return false
  return request.headers.get('x-ops-token') === token
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } }, { status: 403 })
  }

  const summary = await buildOperationsSummary()
  return Response.json({
    success: true,
    data: {
      environment: summary.environment,
      healthChecks: summary.healthChecks,
      metrics: summary.metrics,
    },
  })
}
