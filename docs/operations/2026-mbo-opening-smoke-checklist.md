# 2026 MBO Opening Smoke Checklist

Last updated: 2026-06-07

## Executive Summary

이 checklist는 7/1 KPI/MBO 오픈 전에 HR/admin, employee, leader, developer/watch가 각자 최소 경로를 확인하기 위한 smoke 절차입니다. production에서는 승인된 test account가 아닌 이상 저장, 제출, 승인, 반려를 실제로 수행하지 않습니다.

성공 기준:

- 핵심 route가 열림
- 사용자 role에 맞는 화면이 보임
- KPI/MBO 작성·검토 흐름이 이해 가능함
- baseline export와 blocker 확인이 가능함
- 공식 점수/등급/write control이 노출되지 않음

## Common Rules

- production data mutation 금지
- migration 금지
- dry-run/backfill/apply 금지
- official scoring/grade/AI activation 금지
- `Evaluation.totalScore` / `Evaluation.gradeId` write 금지
- official `Evaluation` / `EvaluationItem` creation 금지
- feature flag 변경 금지
- production에서 save/submit/confirm/reject는 승인된 test account와 test data일 때만 수행

## HR/Admin Smoke

### Routes

- `/evaluation/performance`
- `/admin/evaluation-readiness`
- `/admin/evaluation-ops`
- `/admin/performance-assignments`
- `/admin/performance-calendar`

### Checklist

| Check | Expected Result |
| --- | --- |
| `/evaluation/performance` opens | HR 운영 dashboard가 보이고 500 오류 없음 |
| dashboard readable | MBO/KPI, readiness, workbench 이동 흐름이 이해됨 |
| `/admin/evaluation-readiness` opens | 공식 데이터 준비 Baseline 영역 표시 |
| baseline export available | `공식 데이터 준비 Baseline 내보내기`, markdown/TSV export 표시 |
| policyCategory mapping route visible | `policyCategory 미분류 처리`, `미분류 항목 보기`, `정책 카테고리 저장` 표시 |
| official write guard visible | `공식 저장 차단 상태`와 각 차단 항목 표시 |
| Team KPI/readiness blockers visible | Team KPI pending, policyCategory missing, official gate blocker 확인 가능 |
| `/admin/evaluation-ops` opens | readiness, workbench, assignments, calendar, KPI, monthly, 360/AI 링크 표시 |
| `/admin/performance-assignments` opens | evaluator routing blocker 확인 경로 표시 |
| `/admin/performance-calendar` opens | 2026 운영 일정/체크리스트가 읽기 전용으로 보임 |
| no official score/grade buttons | 공식 점수 반영, 공식 등급 반영, backfill apply 버튼 없음 |

### HR/Admin P0 Checks

- 2026 target cycle이 goal editing 가능 상태인지 확인
- HR/admin이 readiness와 ops route에 접근 가능
- baseline export가 가능
- `policyCategory missing` 처리 경로가 보임
- Team KPI pending owner/action을 지정할 수 있음
- no official scoring/grade/write controls exposed

## Employee Smoke

### Routes

- `/kpi/personal`
- `/kpi/monthly`

### `/kpi/personal` Checklist

| Check | Expected Result |
| --- | --- |
| route opens | 직원 본인 KPI/MBO workspace 표시 |
| KPI/MBO create form opens | `KPI 추가` 또는 개인 KPI 추가 form 표시 |
| KPI name input | KPI명 입력 가능 |
| definition input | 정의/설명 입력 가능 |
| formula input | 산식 또는 평가 기준 입력 가능 |
| weight input | 가중치 입력 가능 |
| target values | T 필수, E/S optional 목표값 입력 가능 |
| linked org KPI | 필요한 경우 조직 KPI 연결 가능 |
| policyCategory on create | `ORG_GOAL`, `PROJECT_T`, `PROJECT_K`, `DAILY_WORK`, 미분류 선택 가능 |
| validation message | weight, target, required field 오류가 이해 가능 |
| submit flow visible | `승인 요청` 흐름이 보임 |
| no official evaluation action | 공식 평가 저장/점수/등급 버튼 없음 |

Production smoke 주의:

- 실제 저장은 승인된 test account와 test KPI에서만 수행합니다.
- 일반 직원 데이터에서는 화면 확인과 guide 설명까지만 진행합니다.

### `/kpi/monthly` Checklist

| Check | Expected Result |
| --- | --- |
| route opens | 월간 실적 workspace 표시 |
| KPI rows visible | 개인 KPI가 있으면 KPI별 월간 입력 표시 |
| no KPI empty state | 개인 KPI가 없으면 먼저 KPI 작성 안내 표시 |
| evidence/comment flow visible | 실적값, 코멘트, 증빙/근거 입력 흐름 표시 |
| submit flow visible | 월간 실적 제출 흐름이 이해 가능 |
| AI assist visible if allowed | AI 초안/요약은 preview-first로 표시 |
| no official evaluation action | 공식 점수/등급/최종 확정 버튼 없음 |

## Leader Smoke

### Routes

- `/kpi/personal`
- `/kpi/personal?tab=review`

### Checklist

| Check | Expected Result |
| --- | --- |
| leader can open KPI workspace | 리더 계정으로 `/kpi/personal` 접근 가능 |
| review queue visible | `검토 대기` 탭 또는 검토 대기 empty state 표시 |
| submitted KPI detail visible | 제출된 팀원 KPI의 변경 필드와 상세 확인 가능 |
| review memo visible | 검토 메모 입력 영역 또는 안내 표시 |
| review action labels clear | 검토 시작, 승인, 반려, 초안으로 되돌리기 등 의미가 명확 |
| no official scoring | 검토/승인은 KPI/MBO workflow이며 공식 평가 점수 계산이 아님 |
| no grade write | 리더 review 중 등급 반영 또는 `gradeId` write 없음 |

Production smoke 주의:

- 승인된 test KPI가 없으면 실제 승인/반려를 누르지 않습니다.
- 팀원 KPI가 보이지 않으면 manager chain, department scope, role을 HR이 확인합니다.

## Developer/Watch Smoke

### Route Smoke

Unauthenticated shell smoke는 protected route에서 `307` login redirect 또는 `401`이어도 정상입니다.

- `/evaluation/performance`
- `/evaluation/workbench`
- `/admin/evaluation-readiness`
- `/admin/evaluation-ops`
- `/kpi/personal`
- `/kpi/monthly`

Expected:

- no `500`
- no Prisma schema error
- no `P2021`
- no `P2022`
- no `column does not exist`
- no `relation does not exist`

### Production Log Watch

Watch for:

- `500`
- `P2021`
- `P2022`
- `PrismaClientKnownRequestError`
- `column does not exist`
- `relation does not exist`
- `JWT_SESSION_ERROR`
- `Evaluation.totalScore`
- `Evaluation.gradeId`
- `dry-run`
- `backfill`
- `backfill --apply`
- `official scoring`
- `official grade`
- `AI score exclusion`
- `feature flag changes`
- `Evaluation` / `EvaluationItem` creation

### Developer/Watch P0 Checks

- no production runtime/schema/auth error
- no official write controls exposed
- no feature flag change
- no migration/backfill command
- no direct DB write
- no accidental production save/submit/confirm action

## Smoke Result Template

| Role | Route | Result | Issue | Severity | Owner | Next Action |
| --- | --- | --- | --- | --- | --- | --- |
| HR/admin | `/evaluation/performance` | pass/fail |  | P0/P1/P2 | HR/watch |  |
| HR/admin | `/admin/evaluation-readiness` | pass/fail |  | P0/P1/P2 | HR/watch |  |
| Employee | `/kpi/personal` | pass/fail |  | P0/P1/P2 | HR |  |
| Employee | `/kpi/monthly` | pass/fail |  | P0/P1/P2 | HR |  |
| Leader | `/kpi/personal?tab=review` | pass/fail |  | P0/P1/P2 | HR/leader |  |
| Developer/watch | logs | pass/fail |  | P0/P1/P2 | watch |  |

