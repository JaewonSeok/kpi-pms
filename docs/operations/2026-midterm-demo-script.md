# 2026 Midterm Demo Script

Last updated: 2026-06-09

## Executive Summary

다음 주 중간보고에서는 KPI PMS를 “공식 점수 확정 도구”가 아니라 “7/1 MBO/KPI 오픈부터 2027년 1월 공식 평가까지 이어지는 운영 가능한 성과관리 시스템”으로 보여줍니다. 직원 작성, 리더 검토, HR monitoring, 월간 실적 준비, readiness blocker tracking을 안정 화면 중심으로 먼저 보여주고, 평가 workbench는 preview detail panel이 로드된 경우에만 점수·등급·대표이사 조정 흐름을 보여줍니다.

핵심 메시지:

> 오늘은 7/1 MBO/KPI 오픈부터 2027년 1월 공식 평가까지 이어지는 전체 흐름을 보여드립니다. 7월에는 목표 작성, 리더 검토, 월간 증빙 축적을 오픈하고, 점수·등급은 공식 저장 전 미리보기로 확인합니다.

보조 메시지:

> 7/1은 MBO/KPI 작성·검토 오픈이고, 공식 점수/등급 확정은 2027년 1월 전용 안전 절차 후 진행합니다.

## Recommended Demo Order

1. `/evaluation/performance`
2. `/kpi/personal`
3. `/kpi/monthly`
4. `/admin/evaluation-ops`
5. `/admin/evaluation-readiness`
6. `/evaluation/workbench` only after preview details are loaded

## Demo 1. HR Operations Dashboard

| Item | Detail |
| --- | --- |
| Route | `/evaluation/performance` |
| Scenario | HR가 2026 평가 운영 상태를 먼저 확인합니다. |
| Show | 운영 요약, 오늘 할 일, readiness/workbench/ops 이동 흐름 |
| Talking points | HR는 매일 이 화면에서 MBO/KPI coverage, blocker, 다음 action을 확인합니다. |
| Avoid | 고급 진단 패널을 길게 설명하지 않습니다. 공식 실행 버튼처럼 오해될 수 있는 영역은 열지 않습니다. |

Suggested script:

> 이 화면은 HR의 매일 시작점입니다. 7/1 오픈 후에는 미작성 MBO, 미확정 KPI, 평가자 배정, policyCategory 누락 같은 blocker를 여기서 확인하고 필요한 운영 화면으로 이동합니다.

## Demo 2. Employee KPI/MBO Writing And Leader Review

| Item | Detail |
| --- | --- |
| Route | `/kpi/personal` |
| Scenario | 직원이 2026 개인 KPI/MBO를 작성하고, 리더가 같은 흐름에서 검토 대상을 확인합니다. |
| Show | KPI 추가, KPI명, 정의, 산식/평가기준, 목표값, weight, 조직 KPI link, policyCategory, review tab |
| Talking points | 직원은 MBO를 직접 작성하고, 조직목표/프로젝트/일상업무 구분을 선택하거나 HR 검수로 남길 수 있습니다. 리더는 제출된 KPI를 확인하고 보완 요청 또는 승인 흐름으로 관리합니다. |
| Avoid | production 실제 저장, 제출, 승인, 반려는 승인된 test account가 아니면 수행하지 않습니다. |

Suggested script:

> 직원은 KPI명, 정의, 산식, 목표값, 가중치를 작성합니다. 2026 정책에 맞춰 `ORG_GOAL`, `PROJECT_T`, `PROJECT_K`, `DAILY_WORK`를 선택할 수 있고, 확신이 없으면 HR 검수에서 분류하도록 둘 수 있습니다. 7/1 오픈의 핵심은 직원 작성에서 끝나는 것이 아니라 리더 검토까지 닫히는 것입니다.

## Demo 3. Monthly Result / Evidence Readiness

| Item | Detail |
| --- | --- |
| Route | `/kpi/monthly` |
| Scenario | 직원이 월간 실적과 근거를 준비합니다. |
| Show | KPI별 월간 입력, 실적값, 코멘트, 증빙/근거, AI 보조 preview |
| Talking points | 월간 실적은 2027년 평가 시점의 근거 품질을 높이기 위한 준비 흐름입니다. |
| Avoid | 월간 실적을 공식 평가 점수로 즉시 반영한다고 말하지 않습니다. |

Suggested script:

> 월간 실적은 평가 직전에 몰아서 쓰는 것이 아니라 매월 근거를 쌓는 흐름입니다. AI는 코멘트 초안과 근거 정리를 돕지만, 적용 여부는 사람이 결정합니다.

## Demo 4. Evaluation Operations Hub

| Item | Detail |
| --- | --- |
| Route | `/admin/evaluation-ops` |
| Scenario | HR가 평가 운영 관련 화면으로 이동합니다. |
| Show | 7/1 MBO opening links, assignments, calendar, KPI, monthly, readiness, workbench, 360/AI links |
| Talking points | HR가 자주 쓰는 평가 운영 화면을 한 곳에 모았습니다. 고급/공식 전환 준비 화면은 필요할 때만 접어서 확인합니다. |
| Avoid | 이 화면에서 저장/제출/확정을 실행한다고 설명하지 않습니다. |

Suggested script:

> 운영 허브는 HR가 매일 이동하는 화면을 모아 둔 시작점입니다. 7/1 오픈에서는 KPI/MBO 작성, 월간 실적, 리더 검토, readiness 확인이 앞에 오고, 공식 전환 준비 화면은 별도 안전 단계로 분리되어 있습니다.

## Demo 5. Readiness And Guardrails

| Item | Detail |
| --- | --- |
| Route | `/admin/evaluation-readiness` |
| Scenario | HR가 공식 평가 생성 전 blocker와 safety guard를 확인합니다. |
| Show | 공식 데이터 준비 Baseline, `policyCategory 미분류 처리`, Team KPI readiness, `공식 저장 차단 상태` |
| Talking points | 시스템은 준비 상태를 투명하게 보여주며, 위험한 공식 write는 guardrail로 막습니다. |
| Avoid | `정책 카테고리 저장`, `선택 metadata 저장`, backfill, dry-run, official activation, score/grade write 실행을 시도하지 않습니다. |

Suggested script:

> readiness 화면은 지금 공식 평가를 시작해도 되는지 판단하는 화면입니다. 현재는 데이터 blocker가 남아 있기 때문에 공식 평가는 진행 불가이고, 공식 저장 차단 상태가 그 이유를 보여줍니다. `policyCategory missing`은 현재 0으로 확인되어 빠른 운영 개선 사례로 설명할 수 있습니다.

## Demo 6. Evaluation Workbench Preview

| Item | Detail |
| --- | --- |
| Route | `/evaluation/workbench` |
| Scenario | 향후 평가 흐름을 preview로 설명합니다. |
| Show | preview-only shell, KPI table, 자기평가, 1차, 2차/최종, CEO, 점수/등급 preview, safety panel only if loaded |
| Talking points | 이 화면은 향후 평가 흐름을 보여주는 preview입니다. 공식 저장과 점수/등급 반영은 차단되어 있습니다. |
| Avoid | preview detail panel이 로드되지 않은 상태에서 score/grade proof로 길게 설명하지 않습니다. 공식 평가 save/submit/finalize가 지금 열린 것처럼 설명하지 않습니다. |

### Workbench Caution

평가 워크벤치 미리보기는 점수·등급·대표이사 조정 흐름을 보여주는 preview 화면입니다. 데모 전 반드시 점수/등급 preview panel이 로드되어 있는지 확인합니다. 로드되지 않으면 워크벤치는 전체 흐름 소개용으로만 짧게 보여주고, 공식 저장 차단 상태는 `/admin/evaluation-readiness`에서 설명합니다.

Suggested script:

> workbench는 앞으로 평가자가 어떤 흐름으로 근거를 보고 평가할지를 보여주는 preview입니다. 현재는 공식 저장, 공식 점수 반영, 공식 등급 반영이 모두 차단되어 있습니다. 상세 점수·등급 panel이 로드된 경우에만 30:70 구조와 등급 연결을 설명하고, 로드되지 않은 경우에는 preview shell과 안전 잠금 메시지만 짧게 보여줍니다.

## Score And Grade Explanation

점수·등급은 preview입니다. 조직 성과 30%, 개인 성과 70% 구조와 등급 기준이 어떻게 연결되는지 보여주는 목적이며, `Evaluation.totalScore`와 `Evaluation.gradeId`에는 저장하지 않습니다. 공식 점수·등급 확정은 2027년 1월 수행결과 작성 이후 별도 안전 절차에서 진행합니다.

## AI Explanation

AI는 KPI 작성과 월간 코멘트 초안을 돕는 보조 기능입니다. 2026 연간 평가점수에는 연결하지 않고, 2028년 이후 승진요건 Pass/Fail로 분리 운영합니다.

## CEO Expected Questions

| Question | Answer |
| --- | --- |
| 지금 점수 확정 가능한가? | 아닙니다. 현재는 preview이며 공식 저장은 안전 잠금 상태입니다. |
| 7월에 직원들이 실제로 쓰는 범위는? | KPI/MBO 작성, 리더 검토, 월간 증빙 축적입니다. |
| 등급은 자동 확정되나? | 현재는 등급 preview만 제공하고, `gradeId` 저장은 2027년 평가 시점에 별도 승인 후 열 예정입니다. |
| AI가 평가점수에 들어가나? | 아닙니다. AI는 작성 보조이며 연간 평가점수와 분리합니다. |

## What To Avoid Showing Or Clicking

- 저장
- 제출
- 승인
- 반려
- 정책 카테고리 저장
- 선택 metadata 저장
- 평가자 배정 저장
- backfill/apply
- official scoring activation
- official grade activation
- 공식 점수 반영
- 공식 등급 반영
- AI score exclusion activation
- feature flag
- `totalScore` / `gradeId` write
- schema migration
- 공식 `Evaluation` / `EvaluationItem` 생성

## Expected Executive Message

중간보고용 요약:

> 현재 시스템은 7/1 MBO/KPI 작성·검토 오픈을 리허설할 수 있는 수준입니다. 직원은 KPI/MBO를 작성하고, 리더는 검토·반려·확정할 수 있으며, HR은 readiness dashboard로 blocker를 추적할 수 있습니다. 월간 실적과 workbench preview는 2027년 평가 흐름을 준비합니다. 다만 공식 점수 반영, 공식 등급 반영, `totalScore`, `gradeId` write는 아직 차단되어 있으며, schema/migration/rehearsal/HR approval 절차 후 별도로 진행합니다.

## Demo Readiness Checklist

Before demo:

- HR/admin login works
- employee demo account or screenshot path prepared
- leader demo account or screenshot path prepared
- `/evaluation/performance` opens
- `/kpi/personal` opens
- `/kpi/monthly` opens
- `/admin/evaluation-ops` opens
- `/admin/evaluation-readiness` opens
- `/evaluation/workbench` opens
- workbench score/grade preview detail panel is loaded if it will be used for score/grade explanation
- baseline export is available
- `공식 저장 차단 상태` is visible
- no official score/grade/write controls visible

If authenticated demo is blocked:

- show source-verified route screenshots from staging/local only
- state clearly that production protected routes require HR/admin login
- do not bypass auth
