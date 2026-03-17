import { successResponse } from '@/lib/utils'
import { getAppEnvironment } from '@/lib/operations'

export async function GET() {
  return successResponse({
    status: 'ok',
    service: 'kpi-pms',
    env: getAppEnvironment(),
    timestamp: new Date().toISOString(),
  })
}
