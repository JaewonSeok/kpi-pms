# Performance and Observability

## Observability stack

- Structured application logs through `recordOperationalEvent`
- Health endpoints:
  - `/api/health/live`
  - `/api/health/ready`
- Metrics endpoint:
  - `/api/ops/metrics` with `x-ops-token`
- Dashboard:
  - `/admin/ops`

## Key metrics

- failed jobs in last 24h
- notification dead letters
- AI success/fallback/disabled counts
- operational error count
- over-budget compensation scenarios

## Error tracking

- Baseline: structured logs + `OperationalEvent` table
- Optional external sink: `SENTRY_DSN` or `ERROR_WEBHOOK_URL`
- Review `/admin/ops` after every deploy and incident

## Performance targets

- dashboard first render under 2.5s in stage baseline
- API p95 under 800ms for common read endpoints
- cron dispatch batch under 2 minutes for 200 queued jobs
- admin ops summary under 1 second on warm database connection

## Load-test scenarios

1. 200 concurrent dashboard loads
2. 100 concurrent KPI list reads
3. 50 concurrent KPI create attempts with weight validation
4. 100 AI assist preview requests with feature disabled fallback
5. 500 queued notification jobs with retry and digest mix
6. 20 admin ops summary calls during active cron execution

## Test outputs to capture

- p50 / p95 / p99 latency
- error ratio
- database CPU and connection count
- dead-letter growth
- event log volume
