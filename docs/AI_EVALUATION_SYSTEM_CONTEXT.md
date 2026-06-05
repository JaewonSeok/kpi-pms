# AI Evaluation System Context

Last updated: 2026-06-05

## Overview

The evaluation system combines existing evaluation records with 2026 readiness work. Current official 2026 writes remain blocked. The project currently supports preview/readiness reporting, policy mapping metadata, score policy validation, and pure guard summaries, but not official 2026 population or save-flow activation.

## Existing Evaluation Flow

Current persisted evaluation stages:

1. `SELF`
2. `FIRST`
3. `SECOND`
4. `FINAL`
5. `CEO_ADJUST`

Current persisted statuses include `PENDING`, `IN_PROGRESS`, `SUBMITTED`, `REJECTED`, and `CONFIRMED`.

Important warning: existing draft/save/submit/calibration paths can touch official `Evaluation.totalScore` and `Evaluation.gradeId`. This is why official 2026 save-flow work is held until schema and deployment sequencing are approved.

## 2026 Evaluation Flow

The 2026 work is currently preview/readiness-first:

- Data readiness baseline export
- HR action list and blockers
- Team KPI and `policyCategory` cleanup
- Evaluator routing readiness
- Score policy readiness
- Grade policy readiness
- Official write guard summary
- State-machine and helper tests

Official population, official stage save, official score write, official grade write, and finalization are not enabled.

## Core Routes

| Route | Purpose |
| --- | --- |
| `/evaluation/performance` | HR/operator dashboard for current evaluation operations, top blockers, and navigation |
| `/evaluation/workbench` | Evaluation workbench / pilot flow with KPI table, stage previews, score/grade previews, safety panels |
| `/admin/evaluation-readiness` | Admin readiness hub for official data readiness, baseline exports, policy mapping, score/grade readiness, official write hold status |
| `/admin/evaluation-ops` | Operations hub linking assignments, calendar, KPI, 360/leadership, AI operations |
| `/admin/performance-assignments` | Evaluator assignment and routing blocker review |
| `/kpi/personal` | MBO/personal KPI creation, submission, review, confirmation |
| `/kpi/monthly` | Monthly result evidence/comment readiness |

## Readiness Baseline Flow

The official data readiness baseline is exposed from `/admin/evaluation-readiness`.

The baseline captures active employees, confirmed KPI coverage, MBO missing, confirmed KPI shortage, Team KPI pending/discussion, `policyCategory` missing, evaluator routing blockers, score/grade readiness blockers, result/leader/finalization/CEO/360 blockers, official gate blockers, Go/No-Go, and apply status.

Baseline v1 from Cycle 1:

| Metric | Baseline |
| --- | ---: |
| Active employees | 289 |
| Confirmed KPI count / coverage | 1 / 0.3% |
| MBO missing | 284 |
| Confirmed KPI shortage | 288 |
| Team KPI pending/discussion | 25 |
| `policyCategory` missing | 1 |
| Evaluator routing blockers | 289 |
| Official gate blockers | 1,753 |
| Go/No-Go | 진행 불가 |
| Apply | 허용 안 됨 |

## Official Write Guard Flow

`src/server/evaluation-2026-official-write-guards.ts` is pure and does not import Prisma. It evaluates whether official actions remain blocked:

- Official population
- Self/stage save
- Reviewer stage save
- Score write
- Grade write
- Finalization

Current expected result is `BLOCK` for all official write categories because schema boundary migration strategy, staging rehearsal, production migration order, HR approval, DB backup, and data readiness are not complete.

`/admin/evaluation-readiness` and baseline exports include `공식 저장 차단 상태`.

## policyCategory Mapping Flow

Recommended route: `/admin/evaluation-readiness`.

Relevant UI:

- `policyCategory 미분류 처리`
- `미분류 항목 보기`
- `정책 카테고리 저장`
- `Baseline 다시 내보내기`
- Full panel: `2026 정책 매핑 관리`
- Full panel buttons: `매핑 후보 조회`, `선택 metadata 저장`

Relevant APIs:

- `GET /api/evaluation/preview-2026/mapping-candidates`
- `PATCH /api/evaluation/preview-2026/policy-metadata`

This is metadata-oriented, not official scoring. It can update `PersonalKpi.policyCategory` metadata and, if an existing `EvaluationItem` is attached, existing item policy metadata. It must not create official Evaluation/EvaluationItem rows or write `totalScore`/`gradeId`.

Current operational next step: HR should resolve `policyCategory missing: 1 -> 0` after SELECT-only backup and test-item scope confirmation.

## Score Policy Readiness Flow

Recent score policy work includes DAILY_WORK score gate validators, DAILY_WORK 80-point cap enforcement, below-target ORG_GOAL exception scoring, MBO weight-cap policy validators, and adjustment input/scoring preview UI.

These are still readiness/guarded policy surfaces. They do not authorize official score writes.

## Current Cycle 1 Status

Cycle 1 is an HR-operational cleanup cycle, not scoring or grading.

P0 priorities:

1. MBO/KPI coverage
2. Evaluator routing blockers
3. Team KPI pending/discussion
4. `policyCategory` missing

Official population readiness remains `NOT_READY` unless blockers are cleared or approved exceptions are documented.

