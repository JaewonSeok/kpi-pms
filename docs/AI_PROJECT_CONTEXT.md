# AI Project Context

Last updated: 2026-06-05

## Purpose

KPI PMS is an internal performance management system for Rsupport. It supports organization KPI planning, personal MBO/KPI setup, monthly results, multi-stage evaluation, 360 feedback, AI competency evaluation, calibration, compensation planning, admin operations, and 2026 official evaluation readiness.

The system is production-sensitive. Future AI agents must treat evaluation scoring, grade writing, migrations, feature flags, and backfill workflows as high-risk operations.

## Tech Stack

| Area | Stack |
| --- | --- |
| Framework | Next.js App Router, React, TypeScript |
| Package manager | `pnpm` |
| Database | PostgreSQL via Prisma |
| Auth | NextAuth with Google OAuth and admin fallback flows |
| UI | Tailwind CSS, Radix UI, lucide-react, Recharts |
| Validation | Zod |
| AI | Server-side OpenAI usage with logged requests and preview-first UX |
| Tests | `ts-node` scripts under `tests/`, no Jest/Vitest runner |
| Deployment | Vercel and Docker artifacts exist; production alias must be verified before assuming live state |

## Major App Areas

| Area | Purpose |
| --- | --- |
| KPI | Organization KPI, personal KPI, monthly results, AI KPI suggestions, MBO workflow |
| Evaluation | Workbench, performance dashboard, results, appeals, calibration, CEO adjustment |
| 2026 readiness | Preview/readiness dashboards, policy mapping, score/grade readiness, official write guard summaries |
| 360 / leadership | Feedback rounds, nominations, results, word-cloud 360, leadership/onboarding review flows |
| AI competency | AI competency cycles, case review, gates, evidence, pass/fail workflows |
| Admin | Org chart, Google account management, performance design, assignments, calendar, grades, ops |
| Ops | Notifications, audit logs, health checks, job executions, operational dashboards |

## High-Level Architecture

- `src/app/(main)/**` contains authenticated pages.
- `src/app/api/**` contains API route handlers and write boundaries.
- `src/components/**` contains client UI by domain.
- `src/server/**` contains server-only loaders, readiness calculators, workflows, and privileged orchestration.
- `src/lib/**` contains shared policy, auth, scoring, utility, and AI helper logic.
- `prisma/schema.prisma` is the database model source of truth.
- `tests/**` contains direct TypeScript tests using `ts-node`.
- `docs/**` contains operating runbooks, product docs, and 2026 evaluation design docs.

## Production / Deployment Assumptions

- Vercel build runs `prisma generate && next build`.
- Vercel production deployment has previously not run `prisma migrate deploy` automatically.
- A Prisma client that expects columns not present in production DB can cause `P2022 column does not exist`.
- Always verify stable alias `https://kpi-pms.vercel.app` target deployment before claiming a change is live.
- Do not assume latest `origin/main` is automatically serving production.

## Environment And Secrets

- `.env` exists locally and is excluded from this context pack.
- Never print or copy secret values.
- Document environment variable names only when needed, never their values.
- Google auth uses the exact expected variable names documented in `README.md`.

