# 2026 MBO Opening Playbook

Last updated: 2026-06-07

## Executive Summary

7/1 오픈의 목적은 직원이 2026 KPI/MBO를 작성하고, 리더가 검토·반려·확정하며, HR이 readiness blocker를 매일 추적할 수 있게 만드는 것입니다. 이 단계는 공식 점수 산정, 공식 등급 확정, `Evaluation.totalScore`/`Evaluation.gradeId` 쓰기, 공식 `Evaluation`/`EvaluationItem` 생성이 아닙니다.

핵심 메시지:

> 7/1은 MBO/KPI 작성·검토 오픈이고, 공식 점수/등급 확정은 2027년 1월 전용 안전 절차 후 진행합니다.

## Purpose

이 문서는 HR/admin이 7/1 KPI/MBO 오픈을 운영하기 위한 실무 playbook입니다. 다음 흐름을 안정적으로 시작하는 데 집중합니다.

- 직원 KPI/MBO 작성
- 리더 검토, 반려, 확정
- HR readiness 및 blocker 모니터링
- 월간 실적/근거 준비
- 향후 평가 workbench preview 설명
- 공식 평가 저장과 공식 점수/등급 write 차단 유지

## Who Uses It

| Role | Uses |
| --- | --- |
| HR/admin | 오픈 전 준비, baseline export, blocker 추적, policyCategory/Team KPI 정리 |
| Employee | 개인 KPI/MBO 작성, 초안 저장, 승인 요청, 월간 실적 준비 |
| Leader/manager | 팀원 KPI 검토, 반려, 확정, 월간 실적 리뷰 |
| Developer/watch | 로그 확인, route smoke, 공식 write 금지 상태 확인 |

## What 7/1 Opening Means

7/1 오픈은 다음을 허용합니다.

- `/kpi/personal`에서 직원 KPI/MBO 작성
- 직원 KPI 초안 저장 및 승인 요청
- 리더의 제출 KPI 검토, 반려, 확정
- `/kpi/monthly`에서 월간 실적, 근거, 코멘트 준비
- HR의 `/evaluation/performance`, `/admin/evaluation-readiness`, `/admin/evaluation-ops` 모니터링
- HR의 metadata-only `policyCategory` 정리
- Team KPI pending/discussion 후속 조치
- 평가 workbench를 향후 흐름 preview로 설명

## In Scope

- 2026 target cycle 작성 가능 여부 확인
- 직원/리더/HR 계정별 접근 smoke
- MBO missing 및 confirmed KPI shortage 추적
- `policyCategory missing` 정리
- Team KPI pending/discussion owner 지정
- evaluator routing blocker 원인 분류
- 월간 실적/근거 준비 안내
- readiness baseline export

## Not In Scope

- 공식 평가 population
- 공식 `Evaluation` 생성
- 공식 `EvaluationItem` 생성
- 공식 점수 반영
- 공식 등급 반영
- `Evaluation.totalScore` write
- `Evaluation.gradeId` write
- schema migration
- dry-run/backfill/apply
- official scoring/grade/AI feature flag activation
- 자동 이메일/알림 발송

## HR Day 0 Checklist

오픈 전날 또는 리허설 전 완료합니다.

| Check | Route | Done Criteria |
| --- | --- | --- |
| 2026 target cycle 작성 가능 상태 확인 | admin cycle settings 또는 운영 담당 확인 | goal editing이 잠겨 있지 않음 |
| HR/admin route 접근 확인 | `/evaluation/performance` | dashboard가 보이고 500 오류 없음 |
| readiness route 접근 확인 | `/admin/evaluation-readiness` | baseline export, write guard, policyCategory resolver 표시 |
| ops hub 접근 확인 | `/admin/evaluation-ops` | KPI, readiness, assignment, calendar 링크 표시 |
| 직원 route 접근 확인 | `/kpi/personal` | KPI 추가 form 접근 가능 |
| 리더 review 접근 확인 | `/kpi/personal?tab=review` | 검토 대기 목록 또는 빈 상태 안내 표시 |
| 월간 실적 route 확인 | `/kpi/monthly` | KPI별 월간 입력 화면 또는 KPI 없음 안내 표시 |
| policyCategory missing 처리 계획 | `/admin/evaluation-readiness` | missing count, 후보 목록, 저장 경로 확인 |
| Team KPI pending owner 지정 | `/admin/evaluation-readiness` | 25건 검토 담당과 처리 기준 지정 |
| baseline export 저장 | `/admin/evaluation-readiness` | 6개 핵심 count 기록 |

Day 0 baseline에서 반드시 기록할 metric:

- MBO missing
- confirmed KPI shortage
- evaluator routing blockers
- Team KPI pending/discussion
- policyCategory missing
- official gate blockers

## HR Day 1 Checklist

오픈 당일에는 기능 설명보다 실제 blocker 추적에 집중합니다.

1. `/evaluation/performance`를 열어 HR 운영 dashboard를 확인합니다.
2. `/admin/evaluation-readiness`에서 baseline을 다시 export합니다.
3. 직원에게 `/kpi/personal` 작성 안내를 배포합니다.
4. 리더에게 검토 대기 목록 확인 방법을 안내합니다.
5. `policyCategory missing`이 남아 있으면 metadata-only resolver로 처리합니다.
6. Team KPI pending/discussion 항목은 owner와 결정 기준을 확정합니다.
7. evaluator routing blockers는 `/admin/performance-assignments`에서 원인 분류를 시작합니다.
8. 문제 발생 시 route, 사용자 role, 화면 메시지, 발생 시각을 기록합니다.

## Daily Monitoring Checklist

매일 같은 시간에 readiness snapshot을 다시 export하고 전일 대비 delta를 기록합니다.

| Metric | Target During Opening | Route |
| --- | --- | --- |
| MBO missing | 감소 추세 | `/admin/evaluation-readiness`, `/evaluation/performance` |
| confirmed KPI shortage | 감소 추세 | `/admin/evaluation-readiness`, `/kpi/personal` |
| evaluator routing blockers | 원인 분류 및 예외 문서화 | `/admin/performance-assignments` |
| Team KPI pending/discussion | 0 또는 승인 예외 | `/admin/evaluation-readiness` |
| policyCategory missing | 0 | `/admin/evaluation-readiness` |
| official gate blockers | 재산출 확인 | `/admin/evaluation-readiness` |

Daily report에 포함할 항목:

- 기준 시각
- route used
- current count
- delta from previous export
- HR action performed
- leader/employee action performed
- metadata save intentionally performed: yes/no
- assignment sync intentionally performed: yes/no
- production log findings
- next action

## Escalation Guide

| Situation | Owner | First Action | Escalate If |
| --- | --- | --- | --- |
| 직원이 `/kpi/personal` 접근 불가 | HR/admin | 계정 role, active employee 상태 확인 | 403/500 반복 |
| KPI 추가 버튼 또는 form이 보이지 않음 | HR/admin | target employee, cycle, role 확인 | goal editing 잠김 의심 |
| 승인 요청이 막힘 | Employee/Leader | KPI 상태가 draft인지 확인 | error message가 불명확 |
| 리더가 팀원 KPI를 못 봄 | HR/admin | 부서 scope, manager chain 확인 | review queue 계속 비어 있음 |
| `policyCategory missing`이 0이 안 됨 | HR | 후보 목록과 test item scope 확인 | 저장 성공 후 count 그대로 |
| Team KPI pending이 줄지 않음 | HR | owner, decision category 지정 | 결정 기준 불명확 |
| monthly result 입력 불가 | HR/Leader | 해당 직원의 confirmed KPI 존재 여부 확인 | route/runtime 오류 |
| 공식 점수/등급 버튼 노출 | Developer/watch | 즉시 사용 중단, screenshot/log 확보 | P0 hotfix 필요 |

## What Not To Do

절대 하지 않습니다.

- 공식 점수 반영
- 공식 등급 반영
- `Evaluation.totalScore` write
- `Evaluation.gradeId` write
- 공식 `Evaluation` 생성
- 공식 `EvaluationItem` 생성
- migration 실행
- `prisma migrate deploy`
- dry-run/backfill/apply
- official scoring/grade/AI feature flag activation
- production에서 승인되지 않은 save/submit/confirm/reject 클릭
- 자동 이메일/알림 발송
- direct DB `UPDATE`/`INSERT`/`DELETE`

## Official Write / Scoring / Grade Prohibition

`/evaluation/workbench`와 `/admin/evaluation-readiness`는 점수/등급 preview와 readiness를 보여줄 수 있지만, 7/1 오픈에서는 다음을 계속 차단합니다.

- 공식 평가 생성
- 자기평가/단계 저장
- 평가자 단계 저장
- 공식 점수 반영
- 공식 등급 반영
- 최종 확정

HR 설명 문구:

> 현재 시스템은 MBO/KPI 작성과 검토를 오픈하는 단계입니다. 점수와 등급은 미리보기와 readiness 확인만 제공하며, 공식 저장은 schema/migration/rehearsal/HR approval 절차가 끝난 뒤 별도 승인으로 진행합니다.

