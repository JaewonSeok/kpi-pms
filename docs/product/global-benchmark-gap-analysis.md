# KPI PMS Global Benchmark Gap Analysis

## 목적
이 문서는 현재 KPI 기반 성과관리 및 성과평가 시스템을 글로벌 벤치마크 관점에서 점검하고, 실제 repo 구조에 맞는 점진적 보강 계획과 이번 턴의 실제 구현 범위를 함께 정리한다.

핵심 비교 기준:
- 전략-목표-실행-평가-보상 연결성
- 리더 코칭 및 지속 성과관리
- 평가 실행과 설명 가능성
- 캘리브레이션 공정성
- HR Ops 운영 실무성
- AI copilot 실용성

## Current Product Audit

### 현재 repo 구조 요약
- App Router 기반 visible route가 대부분 구현되어 있으며, 주요 운영 화면은 실제 페이지가 존재한다.
- Prisma 스키마는 KPI, 평가, 체크인, 피드백, 보상, 알림, 운영 관제까지 넓게 커버한다.
- `src/server/*` adapter 계층이 이미 자리잡고 있어, server page + client workbench 패턴으로 확장하기 좋다.
- `AiRequestLog`, `/api/ai/assist`, `/api/ai/request-logs/[id]/decision`이 있어 human-in-the-loop AI 패턴이 공통화돼 있다.

### 현재 visible route / 핵심 도메인 구현 상태
- 강함: 조직 KPI, 개인 KPI, 월간 실적, 결과, 이의 신청, 캘리브레이션, 보상 시뮬레이션, 체크인, Google 계정 등록, 알림 운영, Admin Ops
- 보강 필요: 평가 실행 workbench, role-based dashboard/reporting, workflow state normalization, explainability standardization

### 핵심 진단
- 현재 제품은 visible route 품질은 많이 올라와 있지만, 글로벌 상위권 제품 대비 가장 큰 공백은 `평가 실행`과 `분석/리포팅`이다.
- KPI/월간/결과/캘리브레이션/보상이 각각은 존재하지만, “입력-검토-의사결정” 중심의 end-to-end 흐름은 아직 덜 연결되어 있다.

## Global Benchmark Gap Matrix

| Domain | Current | Gap vs benchmark | Why it matters | Minimum implementation | Ideal implementation | AI potential | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Goals | Partial | Explicit team goal layer, OKR flexibility, stronger cascade governance 부족 | 전략-실행 연결의 출발점 | Org KPI self-relation / framework type / cascade policy | KPI + OKR hybrid governance with alignment score | Draft, SMART, duplicate, cascade risk | P1 |
| Personal KPIs | Partial | Reviewer assignment, SLA, role library, compare governance 부족 | 리더-구성원 합의 품질 | Review queue hardening, template presets | Role-based goal library and approval policy | Draft, weighting, alignment, reviewer risk | P1 |
| Monthly records | Partial | Month close policy, structured evidence quality, review SLA 부족 | 평가 근거 신뢰성 | Monthly lock policy, stronger evidence metadata | Evidence scoring and review cadence | Summary, risk explanation, review draft | P1 |
| Check-ins | Partial | Coaching template, recognition, recurring intelligence 부족 | 지속 성과관리 리듬 | Check-in templates and overdue escalation | Coaching workspace with continuity memory | Agenda, prep, follow-up summary | P1 |
| Reviews | Weak surface | Self/manager/final review execution UI 부족 | 결과/보상 입력 근거 생성 | Review workbench with draft/save/submit/reject | Full review orchestration incl. peer/360 | Draft, bias hints, evidence summary | P0 |
| Results | Partial | Comparative context, richer explanation, drill-through 부족 | 결과 수용성과 transparency | Explainers and distribution context | Employee-facing result narrative/report | Result explanation, growth summary | P1 |
| Appeals | Partial | SLA/assignment/status가 일부 파생 처리 | 절차적 정당성과 운영 통제 | Appeal schema hardening | Full case management dashboard | Resolution draft, SLA notes | P1 |
| Calibration | Partial | Low-headcount exceptions, bias assist, policy simulation 부족 | 공정성과 설명 가능성 | Exception policy and reason completeness | Session support and fairness analytics | Anomaly prioritization, rationale draft | P1 |
| Compensation | Partial | Explainability, exclusion governance, employee disclosure depth 부족 | 평가-보상 연결 신뢰 | Publish note and explanation layer | Multi-scenario governance + statement | Budget narrative, disclosure explanation | P1 |
| Notifications | Partial | User-side digest intelligence / recognition layer 부족 | 행동 유도와 운영 메시징 품질 | Action-required grouping 고도화 | Recognition and delivery intelligence | Ops summary, variable validation | P2 |
| Google access | Partial | Lifecycle reconciliation, issue taxonomy 부족 | 로그인/접근 품질 | Conflict taxonomy and issue dashboard | Workspace sync / reconciliation | Issue clustering, remediation draft | P1 |
| Admin ops | Partial | SLO/history/reporting depth 부족 | 운영 복구 속도 | Risk ownership, stale warnings | Incident timeline + RCA dashboard | Ops summary, prioritization | P2 |
| Analytics / reporting | Weak | Role-based dashboard, trend, comparison, executive summary 부족 | 전체 제품 스토리 연결 | Role-based dashboard adapters | Analytics hub + executive reporting | Executive summary, anomaly explanation | P0 |
| Audit / explainability | Partial | Entity마다 설명 가능성 수준이 불균형 | 신뢰/감사/규정 대응 | Timeline/diff standards | Unified explainability center | Change explanation | P1 |
| AI copilots | Partial | KPI/월간/ops 외 review/calibration/compensation coverage 약함 | AI 가치 체감 확대 | Copilot schema registry 확대 | Cross-domain copilot fabric | All major flows | P1 |

## AI Opportunity Map

### 공통 구조
- Server only OpenAI usage
- Responses API + Structured Outputs
- `AiRequestLog` 저장
- preview 후 approve/reject
- AI 실패 시 deterministic fallback
- sourceType 기반 adapter 분리

### 페이지/도메인별 AI

| Page / Domain | AI functions | Value | Required inputs | Suggested schema | Approval UX | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `/kpi/org` | draft, wording, SMART, duplicate, alignment, risk summary | 목표 품질과 cascade 품질 향상 | 조직명, 전략, 기존 KPI, 월간 실적 요약 | `OrgKpiDraft`, `OrgKpiSmart`, `OrgKpiAlignment`, `OrgKpiRisk` | preview → apply/reject | Rule-based suggestion |
| `/kpi/personal` | draft, wording, SMART, weight allocation, org alignment, reviewer risk | 작성 품질과 리더 검토 속도 향상 | 직무, 상위 목표, 기존 KPI | `PersonalKpiDraft`, `PersonalKpiWeight`, `PersonalKpiAlignment` | preview → form apply | Template-based suggestion |
| `/kpi/monthly` | summary, risk explanation, manager review draft, evidence summary, retrospective, check-in agenda | 보고/리뷰/평가 근거 강화 | KPI, target/actual, notes, attachments | `MonthlySummary`, `MonthlyRisk`, `MonthlyReviewDraft`, `EvidenceSummary` | preview → note apply | Safe narrative builder |
| `/checkin` | agenda, coaching prompt, follow-up summary | 리더 코칭 강화 | KPI trend, monthly records, previous check-ins | `CheckinAgenda`, `CheckinCoachingPrompt`, `CheckinFollowupSummary` | preview only | Rule-based agenda |
| Reviews workbench | review draft, evidence summary, bias hints, competency wording | 핵심 평가 입력 속도/품질 향상 | evaluation items, KPI evidence, feedback, check-ins | `ReviewDraft`, `BiasAnalysis`, `ReviewEvidenceSummary` | preview → editor apply | Evidence summary + hints |
| `/evaluation/results` | result explanation, growth narrative | 결과 수용성 향상 | final score, grade, calibration, evidence | `ResultExplanation`, `GrowthNarrative` | read/preview only | Deterministic summary |
| `/evaluation/appeal` | case summary, response draft | 케이스 처리 속도 향상 | appeal text, evidence, history | `AppealSummary`, `AppealResponseDraft` | operator review required | Template-based response |
| `/evaluation/ceo-adjust` | anomaly prioritization, fairness hints, rationale draft | 공정성/설명력 강화 | distribution, candidates, org size | `CalibrationAnomalySummary`, `CalibrationRationaleDraft` | preview → reason apply | Rule-based ranking |
| `/compensation/manage` | budget narrative, publish note, disclosure explanation | 보상 설명 가능성 강화 | scenario totals, rules, exceptions | `BudgetNarrative`, `PublishNoteDraft`, `CompDisclosureSummary` | preview only | Delta summary |
| `/admin/notifications` | ops summary, dead letter pattern, variable validation | 운영 복구 속도 향상 | templates, executions, failures | `NotificationOpsSummary`, `DeadLetterPatternSummary` | preview only | Ops note |
| `/admin/ops` | ops summary, incident pattern, daily report, risk prioritization | 운영자 판단 속도 향상 | metrics, risks, events | `OpsStatusSummary`, `IncidentPatternSummary`, `DailyOpsReport`, `RiskPriorityList` | preview only | Fallback report |

## Recommended Backlog

### P0
- Review workbench core
- Role-based dashboard / reporting foundation

이 둘이 현재 제품 가치에 가장 큰 영향을 주는 이유:
- 이미 구현된 KPI/월간/결과/캘리브레이션/보상을 하나의 end-to-end 흐름으로 연결한다.
- 글로벌 상위권 제품 대비 가장 눈에 띄는 공백을 메운다.

### P1
- Goal / personal KPI / monthly / check-in 운영 정교화
- Appeals / calibration / compensation schema hardening
- Google access lifecycle hardening
- Review / calibration / compensation AI coverage 확대

### P2
- Notifications user intelligence
- Admin ops reporting/SLO 강화
- Recognition / social feedback

### P3
- Predictive analytics
- Advanced benchmark views
- Policy engine / simulation sophistication

## Actual Changes To Make Now

### 이번 턴에서 실제로 고른 구현 범위
1. 평가 실행 workbench
2. role-based dashboard / reporting foundation
3. 이 문서 기반의 gap analysis와 AI opportunity map 정리

### 왜 이 범위를 골랐는가
- 제품 전체 가치에 큰 영향을 줌
- 다른 화면들의 기반이 됨
- 성과-평가-보상 흐름을 실제로 연결함
- AI 활용 여지가 큼
- visible route 품질 개선 효과가 큼

## Code / Doc Changes Applied

### 실제 반영 코드
- `/evaluation/assistant`를 AI 버튼만 있는 보조 화면에서, 실제 평가 실행 workbench로 확장
- `/dashboard`를 role-based reporting hub 형태로 교체
- 평가 draft 저장 / reject API 추가

### 변경 파일
- `src/app/(main)/evaluation/assistant/page.tsx`
- `src/app/(main)/evaluation/assistant/loading.tsx`
- `src/components/evaluation/EvaluationWorkbenchClient.tsx`
- `src/server/evaluation-workbench.ts`
- `src/app/api/evaluation/[id]/route.ts`
- `src/app/api/evaluation/[id]/review/route.ts`
- `src/app/(main)/dashboard/page.tsx`
- `src/app/(main)/dashboard/loading.tsx`
- `src/components/dashboard/DashboardPageShell.tsx`
- `src/server/dashboard-page.ts`
- `src/lib/validations.ts`

### 실제 연동 vs fallback
- 실제 연동:
  - `Evaluation`, `EvaluationItem`, `EvalCycle`
  - `MonthlyRecord`, `CheckIn`, `MultiFeedbackRound`, `AiRequestLog`, `AuditLog`
  - dashboard용 KPI/체크인/알림/ops summary 집계
- fallback:
  - 일부 설명 문구, guidance, risk text
  - AI unavailable 시 preview 대체 결과
  - dashboard의 일부 narrative text

## Suggested Next Implementation Batches

### Batch 1. Review Workbench Hardening
- 대상:
  - `/evaluation/assistant`
  - review templates
  - peer/360 surface
- 이유:
  - 가장 큰 제품 공백을 더 깊게 메움
- 후보 파일:
  - `src/components/evaluation/*`
  - `src/server/evaluation-workbench.ts`
  - `src/app/api/evaluation/*`
  - `src/app/api/feedback/*`
- 리스크:
  - workflow state와 권한 매핑
- 기대 효과:
  - manager enablement 대폭 향상

### Batch 2. Dashboard & Explainability Expansion
- 대상:
  - `/dashboard`
  - `/evaluation/results`
  - `/compensation/my`
- 이유:
  - 경영진/리더/구성원 관점의 스토리 정리
- 후보 파일:
  - `src/server/dashboard-page.ts`
  - `src/components/dashboard/*`
  - `src/server/evaluation-results.ts`
  - `src/server/compensation-manage.ts`
- 리스크:
  - role-based data leakage
- 기대 효과:
  - executive summary와 운영 판단 속도 향상

## High-Risk Areas To Protect
- workflow state를 audit-log 파생으로 해석하는 페이지들
- RBAC 범위와 메뉴 노출의 불일치
- `CheckIn.actionItems`, `attachments`, `metadata` 등 JSON field drift
- compensation publish semantics
- AI assist 공통 레지스트리와 schema 계약

## Manual Verification Strategy

### 관리자
- 모든 admin route 접근
- review workbench에서 저장/제출/반려/AI preview 확인
- dashboard에서 ops/리스크/팀 상황 요약 확인

### 리더
- review queue와 team check-in / monthly risk 확인
- KPI / monthly / evaluation 연결 흐름 확인

### 구성원
- personal KPI → monthly → check-in → results 흐름 확인
- dashboard가 내 기준 행동 중심으로 보이는지 확인

### 통합 검증
- KPI → 월간 → 체크인 → 평가 → 결과 → 이의 신청 → 보상
- 각 단계의 drill-down과 explainability 유지 여부 확인
