# Deployment and Environment Strategy

## Environment strategy

- `development`: local and Vercel CLI, relaxed secrets, sample data allowed
- `preview`: all non-main branches, production-equivalent build, Vercel
  Authentication required — maps to the standard's 베타 tier
- `production`: customer-facing `main` deployment, audited change control

See [server-tiers.md](./server-tiers.md) for the 4-tier mapping.

## Env matrix

| Variable | dev | stage | prod | Notes |
| --- | --- | --- | --- | --- |
| `APP_ENV` | `dev` | `stage` | `prod` | Required |
| `DATABASE_URL` | local postgres | managed postgres | managed postgres HA | Required |
| `NEXTAUTH_SECRET` | local secret | required | required | Rotate in stage/prod |
| `CRON_SECRET` | optional | required | required | Scheduler protection |
| `OPS_METRICS_TOKEN` | optional | required | required | Metrics endpoint protection |
| `GOOGLE_CLIENT_ID/SECRET` | optional | required if Google login enabled | required | OAuth |
| `AI_ASSIST_ENABLED` | optional | recommended | required | Enables server-side evaluation/KPI AI assist |
| `OPENAI_API_KEY` | optional | required if AI flag enabled | required if AI flag enabled | AI assist |
| `OPENAI_MODEL` | optional | recommended | recommended | Preferred model env name for AI assist |
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

## AI assist env notes

- Preferred env names:
  - `AI_ASSIST_ENABLED`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
- Legacy aliases still supported for compatibility:
  - `FEATURE_AI_ASSIST`
  - `AI_FEATURE_ENABLED`
  - `OPENAI_RESPONSES_MODEL`

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
   - `pnpm run db:generate`
   - `pnpm run db:push`
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

## 스키마 마이그레이션 적용 절차

- **적용 주체**: 사람. AI는 `docs/AI_SAFETY_GUARDRAILS.md`에 따라 프로덕션에
  `prisma migrate deploy`를 실행할 수 없다.
- **적용 순서**: 마이그레이션을 배포보다 **먼저** 적용한다. 컬럼 추가처럼
  nullable한 변경은 구코드가 그 컬럼을 몰라도 무시하고 동작하지만, 순서를
  뒤집어 신코드를 먼저 배포하면 아직 없는 컬럼을 참조하는 요청이 즉시
  실패한다.
- **사전 확인**: `prisma migrate status`로 적용 대기 중인 마이그레이션
  목록을 확인한다.
- **적용**: `DATABASE_URL`을 운영 DB로 지정한 상태에서 `prisma migrate deploy`를
  실행한다.
- ⚠️ **경고 — 별건 개선 과제**: 현재 로컬 `.env`의 `DATABASE_URL`이 운영
  Supabase 인스턴스를 직접 가리키고 있다. 이 상태에서 로컬에서 `prisma
  migrate dev`, `prisma db push`, `prisma migrate reset`을 실행하면 그대로
  운영 DB에 적용된다. 로컬 전용 `DATABASE_URL`(별도 dev/stage DB)로
  분리하는 작업이 별도로 필요하다 — 이번 문서 신설의 범위 밖.
- **로컬/운영 DB 가드**: `db:migrate` / `db:reset` / `db:push` / `db:studio` /
  `db:seed` 스크립트는 `scripts/db-guard.ts`를 거친다. `DATABASE_URL`
  호스트가 로컬(`localhost` / `127.0.0.1` / `::1`)이 아니면 차단된다.
- 운영 적용은 `db:deploy:prod`(`prisma migrate deploy`)를 쓴다.
- ★ 가드는 `package.json`에 등록된 `pnpm db:*` 경로만 막는다. `npx prisma`를
  직접 실행하면 가드를 거치지 않고 우회되므로 여전히 주의가 필요하다.
- **롤백**: Prisma는 자동 롤백을 제공하지 않는다. 되돌려야 하면 역방향
  SQL을 직접 작성해 실행해야 한다. 이번 건(`actorUserId` 컬럼 추가)의
  롤백 예시:
  ```sql
  ALTER TABLE "audit_logs" DROP COLUMN "actorUserId";
  ```

## Migration runbook

1. Freeze schema-changing releases.
2. Confirm database backup completed.
3. Run `pnpm run db:generate`.
4. Run `pnpm run db:push` in stage first.
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
