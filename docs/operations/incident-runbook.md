# Incident Response Runbook

## Severity guide

- Sev1: login outage, database unavailable, major data corruption, widespread 5xx
- Sev2: AI assist unavailable, notification pipeline stalled, admin workflows blocked
- Sev3: single feature degraded, minor UI issue, non-blocking integration failure

## First 15 minutes

1. Confirm incident scope and affected environment.
2. Check `/api/health/live` and `/api/health/ready`.
3. Open `/admin/ops`.
4. Review:
   - health checks
   - secret readiness
   - failed jobs in last 24h
   - recent operational events
5. Decide rollback vs hotfix.

## Common playbooks

### Database issue

1. Stop schema changes.
2. Verify connection string and DB health.
3. Fail traffic over only if platform supports it.
4. If data risk exists, initiate restore drill.

### Notification issue

1. Check `FEATURE_NOTIFICATIONS_SCHEDULER`.
2. Review dead-letter count and recent `JobExecution`.
3. Re-run cron manually after root cause is fixed.

### AI issue

1. Check `FEATURE_AI_ASSIST`.
2. Confirm `OPENAI_API_KEY`.
3. Review `AiRequestLog` fallback/error counts in admin ops.
4. Leave feature disabled if fallback UI is sufficient during outage.

### Secret leak

1. Rotate leaked secret immediately.
2. Invalidate old sessions/tokens if applicable.
3. Re-deploy with new secret.
4. Record blast radius and follow-up actions.

## Communication template

- Environment:
- Start time:
- User impact:
- Current mitigation:
- Next update time:
- Owner:
