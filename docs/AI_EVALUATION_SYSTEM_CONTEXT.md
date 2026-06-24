# AI Evaluation System Context

Last updated: 2026-06-24

## Overview

The evaluation system combines existing evaluation records with 2026 readiness work. Current official 2026 score/grade writes remain blocked at the route level. The project supports preview/readiness reporting, policy mapping metadata, score policy validation, guard summaries, and — as of 2026-06-24 — a complete production scoring engine (`calculateEvaluationScore2026`) that is implemented but not yet wired to submit/draft routes.

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

Completed score policy work: DAILY_WORK score gate validators, DAILY_WORK 80-point cap enforcement, below-target ORG_GOAL exception scoring, MBO weight-cap policy validators, and adjustment input/scoring preview UI.

These are still readiness/guarded policy surfaces. They do not authorize official score writes.

## 2026 Production Scoring Engine (2026-06-24 추가)

`src/server/evaluation-scoring-2026.ts` 에 다음 함수들이 완성돼 있음:

- `calculateOrganizationPerformanceScore2026()` — ORG_GOAL 항목 기반 조직성과 점수
- `calculatePersonalPerformanceScore2026()` — PERSONAL 항목 기반 개인성과 점수
- `calculateFinalPerformanceScore2026()` — 30:70 합산 최종점수
- `calculateEvaluationScore2026()` — 통합 진입점 (위 세 함수 + belowTarget 예외 포함)

현재 submit/draft 라우트(`src/app/api/evaluation/[id]/submit/route.ts`)는
`applyBelowTargetExceptionForPersistence2026`만 사용하며
`calculateEvaluationScore2026` / 30:70 finalScoreFormula는 **미연결(dormant)**.

Preview 엔진(`src/lib/preview-2026-organization-score.ts`의 `calculateOrganizationPerformanceFromIntake2026`)은
intake(수기 입력) 기반 별개 코드. Production 엔진과 코드 공유 없음.

## Dormant Flag 현황 (2026-06-24 확인)

```
adjustmentRule.active           = false  (dormant)
weightRule.enforced             = false  (dormant)
belowTargetExceptionRule.active = false  (wiring 완료, active flip 한 번으로 즉시 활성화 가능)
dailyWorkScoringRule.active     = false  (dormant)
finalScoreFormula.active        = false  (dormant)
```

## 다음 본 작업

1. **M1-B wiring (1순위)**: `calculateEvaluationScore2026()`을 submit/draft 라우트에 연결.
   ⚠️ production 점수 계산 방식 변경 — **shadow 검증(read-only 시뮬레이션) 선행 필수.**
2. **belowTargetExceptionRule flip (2순위)**: wiring 완료, `active=true` flip 하나.
3. **M1-D intake 통합 (3순위)**: Preview 엔진을 production에 연결하는 더 큰 작업.

## Data Corrections Completed (2026-06-24)

production DB 교정으로 본 작업 전제조건 충족:
- position/role: 289명 전원 정합 (MEMBER 233/TEAM_LEADER 42/SECTION_CHIEF 7/DIV_HEAD 7)
  → `resolveRoleGroup2026` 실데이터 정상 작동 보장
- 부서: 고아 12개 제거, deptName 중복 0, 영업1·2본부 SECTION 교정
  → M1-D `parentLevel` 파라미터 오분류 없음

## Current Cycle 1 Status

Cycle 1 HR 운영 정리는 완료됨. 현재는 2026 평가 엔진 wiring 단계.

Official population readiness 상태는 `/admin/evaluation-readiness`에서 확인.

