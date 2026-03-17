import { buildReadinessStatus } from '@/lib/operations'

export async function GET() {
  const result = await buildReadinessStatus()
  return Response.json(result, {
    status: result.status === 'ready' ? 200 : 503,
  })
}
