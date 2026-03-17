# Deployment and Environment Strategy

## Environment strategy

- `dev`: local developer environment, relaxed secrets, sample data allowed
- `stage`: production-like validation environment, masked data only, release candidate validation
- `prod`: customer-facing environment, strict secret rotation, audited change control

## Env matrix

| Variable | dev | stage | prod | Notes |
| --- | --- | --- | --- | --- |
| `APP_ENV` | `dev` | `stage` | `prod` | Required |
| `DATABASE_URL` | local postgres | managed postgres | managed postgres HA | Required |
| `NEXTAUTH_SECRET` | local secret | required | required | Rotate in stage/prod |
| `CRON_SECRET` | optional | required | required | Scheduler protection |
| `OPS_METRICS_TOKEN` | optional | required | required | Metrics endpoint protection |
| `GOOGLE_CLIENT_ID/SECRET` | optional | required if Google login enabled | required | OAuth |
| `OPENAI_API_KEY` | optional | required if AI flag enabled | required if AI flag enabled | AI assist |
| `SMTP_PASS` | optional | required if email enabled | required if email enabled | Notification email |
| `SENTRY_DSN` | optional | recommended | recommended | Error tracking hook |
| `BACKUP_BUCKET_URI` | optional | required | required | Backup destination |

## Secret management

- Never commit `.env` files.
- Use platform-native secret stores:
  - Docker: injected runtime envs from secret manager or CI variables
  - Vercel: project environment variables with separate dev/stage/prod scopes
- Rotate these first on staff change or incident:
  - `NEXTAUTH_SECRET`
  - `GOOGLE_CLIENT_SECRET`
  - `CRON_SECRET`
  - `OPS_METRICS_TOKEN`
  - `OPENAI_API_KEY`
  - `SMTP_PASS`

## Google OAuth secret rotation

1. In Google Cloud Console, select the production OAuth client used by this application.
2. Generate or reveal the new trusted client secret for that client.
3. Update `GOOGLE_CLIENT_SECRET` in every active runtime:
   - local developer `.env`
   - stage / preview environment secrets
   - production environment secrets
4. If the Google OAuth client was recreated instead of only rotating the secret, update both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Confirm `NEXTAUTH_URL` still matches the deployed public base URL for each environment.
6. Restart or redeploy every environment after secret updates so the new values are loaded.
7. Run a smoke test on `/login`:
   - Google redirect opens successfully
   - no `The OAuth client was not found`
   - no `401: invalid_client`
8. If the error persists, verify the correct Google Cloud project, client type `Web application`, and registered callback URL.

## Docker deployment procedure

1. Build image
   - `docker build -t kpi-pms:release .`
2. Run database migration
   - `npm run db:generate`
   - `npm run db:push`
3. Start stack
   - `docker compose -f docker-compose.prod.yml up -d --build`
4. Verify health
   - `GET /api/health/live`
   - `GET /api/health/ready`
   - admin opens `/admin/ops`

## Vercel deployment option

If the team prefers Vercel:

1. Connect repository to Vercel project.
2. Set environment variables for `development`, `preview`, and `production`.
3. Run migrations from CI or a controlled job before switching traffic.
4. Use `/api/health/ready` and `/api/admin/ops/summary` as smoke-check endpoints after deploy.

## Migration runbook

1. Freeze schema-changing releases.
2. Confirm database backup completed.
3. Run `npm run db:generate`.
4. Run `npm run db:push` in stage first.
5. Validate:
   - auth
   - KPI create
   - evaluation submit
   - compensation manage
   - notifications cron
   - AI assist preview
6. Repeat in prod during approved maintenance window.
7. If post-check fails:
   - stop rollout
   - restore from last backup if data corruption risk exists
   - record incident in ops log/runbook
