export function isAuthorizedCronRequest(
  request: Request,
  sessionRole?: string | null
): boolean {
  const secret = process.env.CRON_SECRET
  if (secret) {
    // Legacy custom header path kept for manual/external callers
    if (request.headers.get('x-cron-secret') === secret) return true
    // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
    if (request.headers.get('authorization') === `Bearer ${secret}`) return true
  }
  // CRON_SECRET unset → external calls always reach here and are rejected
  return sessionRole === 'ROLE_ADMIN'
}
