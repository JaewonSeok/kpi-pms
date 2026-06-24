# UI/UX PPT Screen Map

작성일: 2026-06-17  
참고 PPT: `docs/reference/PMS_UIUX_reference.pptx`  
참고 이미지 추출 폴더: `docs/reference/ppt-extracted/`  

이 문서는 PPT 장표의 상단 메뉴명, 역할, 캡처 포함 여부를 현재 KPI PMS route/component와 연결한 화면 인벤토리다. 추출 이미지는 로컬 참고용이며 앱 asset으로 복사하거나 stage/commit하지 않는다.

## 요약

| 항목 | 결과 |
| --- | --- |
| PPT slide 수 | 24 |
| 캡처/이미지 포함 slide | 20 |
| 추출 이미지 수 | 25 |
| 주요 메뉴 그룹 | KPI 관리, 평가 관리, 관리자 설정 |
| route 매핑 수 | 18 |
| 구현 기준 | 실제 평가 흐름, 역할별 해야 할 일, 입력 부담 축소, 공식 scoring/write 안전선 유지 |

## PPT Slide Inventory

| Slide | PPT menu / topic | Role | Image refs | Likely route | Current component/file | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | UX 원칙: 직관적, 입력 필요도 축소, 실제 평가흐름 순서 | 전체 | 없음 | 전체 IA | `docs/UIUX_*` | P0 기준 |
| 2 | 메뉴 구조: KPI 관리, 평가 관리, 관리자 설정 | 전체 | 없음 | 전체 navigation | `src/lib/navigation.ts` | P0 기준 |
| 3 | 역할별 권한: USER, TEAM_MANAGER, HQ_MANAGER, HR_ADMIN | 전체 | 없음 | 권한/노출 정책 | `src/lib/auth/permissions.ts` | P0 기준 |
| 4 | 평가 공통 상태값/수정 가능 범위 | 전체 | 없음 | 평가 상태 UX | evaluation/kpi components | P0 기준 |
| 5 | `1. 1 KPI 관리 > 조직 KPI > 조직 KPI 추가` | HR관리자 | `slide05_image01.png` | `/kpi/org` | `src/components/kpi/OrgKpiManagementClient.tsx` | Phase 2 |
| 6 | `1. 1 KPI 관리 > 조직 KPI > 조직 KPI 추가` | HR관리자 | `slide06_image01.png`, `slide06_image02.png` | `/kpi/org` | `src/components/kpi/OrgKpiManagementClient.tsx` | Phase 2 |
| 7 | `1. 1 KPI 관리 > 조직 KPI > 조직 KPI 추가` | 직책자 | `slide07_image01.png` | `/kpi/org` | `src/components/kpi/OrgKpiManagementClient.tsx` | Phase 2 |
| 8 | `1. 2 KPI 관리 > 개인 KPI > 개인 KPI 추가 (비영업)` | HR관리자 | `slide08_image01.png` | `/kpi/personal` | `src/components/kpi/PersonalKpiManagementClient.tsx` | Phase 3 |
| 9 | `1. 2 KPI 관리 > 개인 KPI > 개인 KPI 추가 (비영업)` | HR관리자 | `slide09_image01.png`, `slide09_image02.png`, `slide09_image03.png` | `/kpi/personal` | `src/components/kpi/PersonalKpiManagementClient.tsx` | Phase 3 |
| 10 | `1. 3 KPI 관리 > 월간 실적` | HR관리자 | `slide10_image01.png` | `/kpi/monthly` | `src/components/kpi/MonthlyKpiManagementClient.tsx` | Phase 1 |
| 11 | `1. 3 KPI 관리 > 월간 실적(+체크인?)` | HR관리자 | `slide11_image01.png` | `/kpi/monthly`, `/checkin` | `MonthlyKpiManagementClient.tsx`, check-in routes | Phase 1 / later |
| 12 | `2. 1 평가 > AI 역량평가(타이틀 변경 필요)` | HR관리자 | `slide12_image01.png`, `slide12_image02.png` | `/evaluation/ai-competency` | `src/components/evaluation/AiCompetencyClient.tsx` | Phase 5 |
| 13 | `2. 1 평가 > AI 역량평가(타이틀 변경 필요)` | HR관리자 | `slide13_image01.png`, `slide13_image02.png` | `/evaluation/ai-competency/admin` | `AiCompetencyAdminPanel.tsx` | Phase 5 |
| 14 | `2. 2 평가 > 업적평가 (팀원/팀장/본부장)` | 팀원 | `slide14_image01.png` | `/evaluation/workbench` | `src/components/evaluation/EvaluationWorkbenchClient.tsx` | Phase 4 |
| 15 | `2. 2 평가 > 업적평가 (팀원/팀장/본부장)` | 팀장 | `slide15_image01.png` | `/evaluation/workbench` | `EvaluationWorkbenchClient.tsx` | Phase 4 |
| 16 | `2. 2 평가 > 업적평가 (팀원/팀장/본부장)` | 팀장 | `slide16_image01.png` | `/evaluation/workbench` | `EvaluationWorkbenchClient.tsx` | Phase 4 |
| 17 | `2. 2 평가 > 업적평가 운영(HR)` | HR 관리자 | `slide17_image01.png` | `/evaluation/performance`, `/admin/evaluation-ops` | `EvaluationPerformanceBriefingPanel.tsx`, `admin/evaluation-ops/page.tsx` | Phase 4 / 8 |
| 18 | `2. 2 평가 > 업적평가 운영(HR)` | HR 관리자 | `slide18_image01.png` | `/admin/evaluation-readiness`, `/admin/performance-assignments` | readiness/assignment pages | Phase 4 / 8 |
| 19 | `2. 2 평가 > 업적평가 (팀원/팀장/본부장)` | 본부장 | `slide19_image01.png` | `/evaluation/workbench`, `/evaluation/ceo-adjust` | `EvaluationWorkbenchClient.tsx`, `EvaluationCeoFinalClient.tsx` | Phase 4 |
| 20 | `2. 2 평가 > 360 다면평가` | 팀원 | `slide20_image01.png` | `/evaluation/360`, `/evaluation/360/respond/[feedbackId]` | `Feedback360WorkspaceClient.tsx` | Phase 6 |
| 21 | `2. 2 평가 > 360 다면평가` | 팀원 | `slide21_image01.png` | `/evaluation/360/respond/[feedbackId]` | `Feedback360WorkspaceClient.tsx` | Phase 6 |
| 22 | `2. 2 평가 > 360 다면평가` | 팀원 | `slide22_image01.png` | `/evaluation/360/results` | `FeedbackReportAnalysisView.tsx` | Phase 6 |
| 23 | `2. 2 평가 > 리더십 평가` | 팀원 | `slide23_image01.png` | `/evaluation/upward/respond`, `/evaluation/upward/respond/[feedbackId]` | `UpwardReviewWorkspaceClient.tsx` | Phase 7 |
| 24 | `2. 2 평가 > 리더십 평가` | 팀/실장/PM/본부장 | `slide24_image01.png` | `/evaluation/upward/results`, `/solutions/leadership-diagnosis` | `UpwardReviewWorkspaceClient.tsx` | Phase 7 |

## Route Mapping

| PPT area | Current route | Current status | Target layout pattern | Required visual elements | Must keep | Forbidden changes |
| --- | --- | --- | --- | --- | --- | --- |
| 조직 KPI | `/kpi/org` | Phase 2 진행 중 | 좌측 작업 영역 + 우측 현재 범위/상세 패널 | metric rail, status chip, selected row highlight, right detail panel | HR 일괄 업로드/확정 권한, 직책자 조회 UX | 목표 일괄 수정 강조, 권한 완화, DB/API 변경 |
| 개인 KPI | `/kpi/personal` | 기존 실사용 중, Phase 3 후보 | 핵심 입력 wizard + KPI card list + review 상태 | stepper, weight bar, category chip, AI helper card | 저장/제출 workflow, policyCategory, target values | validation/policy 문구 임의 변경, 공식 score/grade 연결 |
| 월간 실적 | `/kpi/monthly` | Phase 1 pilot 진행/검증 필요 | 좌측 월간 KPI 작업 영역 + 우측 상세 입력 패널 | compact metric rail, progress ring, AI 2-column, empty illustration | 구성원용 AI/리더용 AI 분리, 저장/제출 동작 | leader-only AI 노출, AI/OpenAI payload 변경 |
| 업적평가 운영 dashboard | `/evaluation/performance` | 운영 dashboard 존재 | 운영 dashboard + blocker queue + process preview | blocker count card, process timeline, route CTA | readiness visibility, official write lock | official write/score/grade activation |
| 업적평가 작성/검토 | `/evaluation/workbench` | preview 중심 | 역할별 평가 workspace + score/grade preview | stage timeline, self/first/final panels, score preview, grade preview | preview-only wording, totalScore/gradeId write 차단 | official save/submit/finalize 추가 |
| AI 활용 제출 | `/evaluation/ai-competency` | 기능 존재, 타이틀 재정의 필요 | 제출 wizard + evidence list + pass/fail readiness | certificate/evidence card, status chip, progress panel | 연간 업적점수와 분리 | 2026 연간 score 반영 |
| AI 활용 운영 | `/evaluation/ai-competency/admin` | admin panel 존재 | HR review queue + evidence decision dashboard | queue card, status table, review drawer | admin-only review | 자동 합격/점수화 |
| 360 다면평가 응답 | `/evaluation/360/respond/[feedbackId]` | 실제 route 존재 | 응답 wizard + progress panel | progress stepper, anonymity badge, question card | 익명성/배정 조건 | 응답자 식별 노출 |
| 360 다면평가 결과 | `/evaluation/360/results` | 결과 route 존재 | 결과 dashboard + chart panel | theme chart, radar/bar, development plan | 권한별 결과 조회 | 원문 민감정보 과노출 |
| 리더십 진단 응답 | `/evaluation/upward/respond` | upward route 존재 | 응답 wizard + 대상/진행 패널 | stepper, role context, response card | 배정 대상만 응답 | 무권한 접근 |
| 리더십 진단 결과 | `/evaluation/upward/results` | upward results 존재 | 결과 dashboard + 리더 코칭 panel | score chart, feedback theme, action plan | 직책자/HR 권한 경계 | 개인 식별 과노출 |
| 평가 운영 허브 | `/admin/evaluation-ops` | route 존재 | HR 운영 허브 + 7/1 우선 링크 | grouped action cards, safety section | 고급/공식 transition 접힘 | backfill/apply 노출 강조 |
| 평가자 매칭 관리 | `/admin/performance-assignments` | route 존재 | blocker queue + assignment table | missing FIRST/SECOND/FINAL chips | sync/write는 승인 필요 | 실수성 sync 버튼 강조 |
| 평가 기간 관리 | `/admin/eval-cycle`, `/admin/performance-calendar` | route 존재 | calendar readiness + cycle settings | timeline, status legend | 기간/상태 권한 | migration/schema 변경 |
| 평가 대상자 관리 | `/admin/google-access`, `/admin/org-chart`, `/admin/performance-design` | 실제 route 분산 | 대상자/조직/설계 통합 운영 view | upload queue, org tree, eligibility chip | HR-only upload/review | 무검증 bulk write |
| 등급 기준 관리 | `/admin/grades`, `/admin/preview-2026-grade` | route 존재 | grade policy editor + preview | threshold card, preview table | official grade write 차단 | gradeId write 활성화 |
| 조직/권한 관리 | `/admin/google-access`, `/admin/org-chart` | route 존재 | 조직 tree + 권한 account panel | org tree, role badge, access status | admin-only | secret/account value 노출 |
| 공식 readiness | `/admin/evaluation-readiness` | route 존재 | readiness baseline + safety lock | blocker count, guard card, export preview | official write guard | official scoring/grade/apply |
| 부서 점수 intake | `/admin/department-score-intake` | schema/API 기반 route 존재 | HR intake table + validation summary | score scale chip, import status | migration applied 후 사용 | migration 전 API/UI 확장 |

## PPT Parity Requirements By Screen

### KPI 관리

- `조직 KPI`: 상단 큰 안내보다 본부/실/팀 KPI 목록과 현재 선택 범위가 먼저 보여야 한다. HR은 일괄 업로드/확정 흐름, 직책자는 본인 조직 KPI처럼 읽히는 흐름이 필요하다.
- `개인 KPI`: 영업/비영업 구분, 수립 기간/평가 기간별 활성 상태, T/E/S 목표값, weight, policyCategory를 사용자가 길을 잃지 않게 단계화한다.
- `월간 실적`: 매월 긴 보고서를 쓰는 느낌을 줄이고, “이번 달 먼저 할 일 → KPI 선택 → 짧은 기록/증빙 보완” 흐름으로 유지한다.

### 평가 관리

- `업적평가`: 팀원/팀장/본부장/HR의 해야 할 일이 같은 화면에 섞이지 않도록 역할별 card/queue를 분리한다.
- `AI 활용 제출`: 타이틀은 “AI 활용 제출” 또는 “AI 지원 평가”로 재검토한다. 2026 연간 업적점수와 분리된 제출/인정 흐름임을 계속 표시한다.
- `360 다면평가`: 응답 wizard와 결과 dashboard를 분리하고, 익명성/대상/진행률을 상단에서 명확히 보여준다.
- `리더십 진단`: 팀원 응답 화면과 직책자/HR 결과 화면을 분리한다.

### 관리자 설정

- HR 운영 화면은 기능 목록보다 “오늘 처리해야 할 blocker”가 먼저 보여야 한다.
- 평가 기간, 대상자, 평가자 매칭, 등급 기준, 조직/권한은 서로 연결되지만 위험도에 따라 고급/공식 transition 영역을 접어 둔다.

## Visual Smoke Checklist

| Route | Smoke 기준 |
| --- | --- |
| `/kpi/org` | 첫 viewport에 KPI 목록 일부가 보이고, 우측 현재 범위 패널이 좌측 목록을 밀지 않는다. |
| `/kpi/personal` | 직원이 개인 KPI 작성/수정/제출 경로를 이해하고, 공식 score/grade처럼 보이는 AI/평가 버튼이 없다. |
| `/kpi/monthly` | 구성원에게 입력 필요/위험 KPI quick action과 KPI list가 먼저 보이고, leader-only AI action은 숨겨진다. |
| `/evaluation/performance` | HR이 blocker/readiness/다음 행동을 한눈에 보고, 공식 저장 잠금이 오해 없이 보인다. |
| `/evaluation/workbench` | preview-only wording, score/grade preview, CEO/final preview가 보이고 official write control은 없다. |
| `/evaluation/ai-competency` | AI 활용 제출이 연간 score 산정이 아니라 별도 인정/제출 흐름으로 보인다. |
| `/evaluation/360/respond/[feedbackId]` | 응답 진행률과 익명성 안내가 보이고 불필요한 admin 정보가 없다. |
| `/evaluation/upward/respond` | 리더십 진단 응답 흐름이 배정 대상에게만 자연스럽게 보인다. |
| `/admin/evaluation-ops` | 7/1 MBO/KPI 운영 링크가 먼저 보이고 고급/공식 transition은 접히거나 비강조된다. |

## 구현 주의사항

- PPT 이미지는 참조용이다. 앱 asset으로 복사하지 않는다.
- 실제 데이터에 없는 수치, 가짜 chart, callback 없는 버튼을 만들지 않는다.
- 저장/제출/승인/반려/확정/동기화/점수 반영/등급 반영 동작은 별도 승인 없이 변경하지 않는다.
- `Evaluation.totalScore`, `Evaluation.gradeId`, `Evaluation`, `EvaluationItem` 공식 write 금지선을 유지한다.
- 구성원 화면에는 리더/HR 전용 AI 기능이 노출되지 않아야 한다.
- HR/admin 화면은 고밀도 정보가 필요하지만, 공식 transition이나 backfill/apply 류 동작은 고급/차단 맥락으로만 보여야 한다.
