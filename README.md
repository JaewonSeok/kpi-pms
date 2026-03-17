# KPI PMS

Performance management system built with Next.js, Prisma, NextAuth, and PostgreSQL.

## Local run

```bash
docker compose up -d
pnpm install
pnpm run db:generate
pnpm run db:push
pnpm run db:seed
pnpm dev
```

Local PostgreSQL runs from [`docker-compose.yml`](/c:/Users/RSUPPORT/Desktop/성과관리%20및%20평가시스템/kpi-pms/docker-compose.yml) on `localhost:5433`.

## Development rules

- Use `pnpm` as the primary package manager for local and CI workflows.
- Use `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before release.
- Keep write paths in route handlers or server-side code and validate request bodies with Zod.
- Keep shared UI copy in Korean and code/comments/tests in English.

## Google OAuth setup

This project uses these exact environment variable names for Google sign-in:

- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALLOWED_DOMAIN`

Callback URLs:

- local: `http://localhost:3000/api/auth/callback/google`
- production: `https://<your-domain>/api/auth/callback/google`

Local seed data follows `ALLOWED_DOMAIN` when you run `pnpm run db:seed`.
With the current sample config, the seeded Google accounts become:

- `ceo@rsupport.com`
- `divhead@rsupport.com`
- `section@rsupport.com`
- `leader@rsupport.com`
- `member1@rsupport.com`
- `member2@rsupport.com`
- `admin@rsupport.com`

If your own Google account should log in, its exact email must exist in the `Employee.gwsEmail` field and the employee status must be `ACTIVE`.

### Registering a Google account for an employee

Two supported ways:

1. Admin UI: `/admin/google-access`
2. CLI script:

```bash
pnpm run register:google-email -- --emp-id=EMP-2022-002 --email=admin@rsupport.com
```

Rules:

- The email must match `ALLOWED_DOMAIN`.
- The email must be unique across employees.
- The write path is admin-only and stores an audit log entry.
- Login still requires the employee status to be `ACTIVE`.

Important:

- Do not use `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, or custom alias names unless you also change the code.
- Do not leave `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` as placeholder values.
- Placeholder values will cause:
  - `The OAuth client was not found`
  - `401: invalid_client`

Google Cloud Console checklist:

1. Select the correct Google Cloud project.
2. Confirm the OAuth client still exists.
3. Confirm the OAuth client type is `Web application`.
4. Confirm the client ID matches `GOOGLE_CLIENT_ID`.
5. Confirm the client secret matches `GOOGLE_CLIENT_SECRET`.
6. Add authorized JavaScript origins:
   - `http://localhost:3000`
   - your production origin
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-domain>/api/auth/callback/google`
8. Confirm the OAuth consent screen is configured.
9. If the app is in testing mode, add the login account as a test user.

### Google secret rotation

1. Open Google Cloud Console and locate the same OAuth client used by this app.
2. Rotate or replace the exposed client secret.
3. Update `GOOGLE_CLIENT_SECRET` in every runtime environment that serves login traffic:
   - local `.env`
   - stage / preview secrets
   - production secrets
4. If the OAuth client itself was recreated, update both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Restart or redeploy each environment after updating the secret store.
6. Re-test `/login` and confirm Google sign-in reaches the consent screen without `401: invalid_client`.
7. If the error continues, re-check that the callback URL and Google Cloud project match the active runtime config.

## Key scripts

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm run db:generate`
- `pnpm run db:push`
- `pnpm run db:seed`

## Health and ops

- liveness: `/api/health/live`
- readiness: `/api/health/ready`
- metrics: `/api/ops/metrics` with `x-ops-token`
- admin dashboard: `/admin/ops`

## Deployment

- Docker artifacts: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.prod.yml`
- environment sample: `.env.example`
- detailed runbooks: `docs/operations/`

## Runbooks

- `docs/auth-rbac-matrix.md`
- `docs/operations/admin-runbook.md`
- `docs/operations/data-migration-and-launch-plan.md`
- `docs/operations/data-mapping-matrix.csv`
- `docs/operations/admin-training-outline.md`
- `docs/operations/faq-draft.md`
- `docs/operations/deployment-and-env.md`
- `docs/operations/backup-restore-drill.md`
- `docs/operations/incident-runbook.md`
- `docs/operations/performance-observability.md`
- `docs/operations/release-readiness.md`
