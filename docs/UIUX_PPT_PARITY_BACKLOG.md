# UI/UX PPT Parity Backlog

작성일: 2026-06-17  
기준 문서: `docs/UIUX_PPT_SCREEN_MAP.md`, `docs/UIUX_PPT_VISUAL_PATTERNS.md`  

이 문서는 `docs/reference/PMS_UIUX_reference.pptx`와 현재 KPI PMS route를 기준으로, PPT parity를 단계별 구현 backlog로 정리한다. 모든 phase는 기능 안정성과 공식 평가 write 금지선을 우선한다.

## 공통 원칙

- “사용자가 지금 해야 할 일”이 화면 첫 영역에 보여야 한다.
- 큰 안내 box와 반복 summary는 줄이고, compact metric/상태 chip/action card로 재구성한다.
- 입력 화면은 핵심 입력 → 선택 입력 → 증빙/메모 순서로 단계화한다.
- HR/admin 화면은 blocker queue와 운영 action을 우선하고, 고급/공식 transition은 접거나 비강조한다.
- AI 기능은 작성 보조/요약/코칭으로 표현하고, 공식 평가 점수/등급 산정처럼 보이지 않게 한다.
- 새 dependency 없이 `lucide-react`, Tailwind, 기존 `pms-ui`, Recharts가 이미 있는 경우만 활용한다.

## Phase Overview

| Phase | Status | Target route | PPT slides | Goal | Risk |
| --- | --- | --- | --- | --- | --- |
| Phase 1 | 구현/검증 후보 | `/kpi/monthly` | 10, 11 | 월간 실적 입력 부담 축소, 좌측 작업 영역 + 우측 상세 패널 | leader-only AI visibility |
| Phase 2 | 진행 중 | `/kpi/org` | 5, 6, 7 | 조직 KPI를 PPT형 업무 workspace로 재구성 | HR 확정/업로드 action 오해 |
| Phase 3 | 다음 후보 | `/kpi/personal` | 8, 9 | 개인 KPI 작성/수정/제출 흐름을 역할/기간 기준으로 단순화 | 실사용 중인 validation 건드릴 위험 |
| Phase 4 | 다음 후보 | `/evaluation/performance`, `/evaluation/workbench` | 14-19 | 업적평가 운영/작성/검토/최종 preview 흐름 정리 | official write 오해 |
| Phase 5 | 후보 | `/evaluation/ai-competency`, `/evaluation/ai-competency/admin` | 12, 13 | AI 활용 제출 타이틀/흐름 재정의 | 연간 score와 혼동 |
| Phase 6 | 후보 | `/evaluation/360/*` | 20-22 | 360 응답/결과 UX를 wizard/dashboard로 정리 | 익명성/민감정보 |
| Phase 7 | 후보 | `/evaluation/upward/*`, `/solutions/leadership-diagnosis` | 23, 24 | 리더십 진단 응답/결과 UX 정리 | 권한/대상 노출 |
| Phase 8 | 후보 | `/admin/*` 운영/설정 | 2-4, 17, 18 | HR 운영/관리자 설정 통합 UX 정리 | 고위험 admin action |
| Phase 9 | 후보 | navigation/layout | 2 | 메뉴/레이아웃 consistency pass | route/permission regression |

## Phase 1. PMS UI Primitives + `/kpi/monthly` Pilot

| 항목 | 내용 |
| --- | --- |
| 목표 | 월간 실적을 “짧게 기록하고 필요한 것만 보완하는” workspace로 전환 |
| 대상 | `/kpi/monthly`, `src/components/kpi/MonthlyKpiManagementClient.tsx`, `src/components/pms-ui/*` |
| 참고 slide | 10, 11 |
| 구현 범위 | compact status rail, next action, KPI card list, right detail panel, AI 2-column assist |
| 금지 범위 | 저장/제출/승인/반려 동작 변경, AI/OpenAI payload 변경, leader-only AI 노출 |
| 테스트 | `pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-ai-comment-access.test.ts`; `pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-kpi-workspace.test.ts`; `pnpm.cmd lint`; `pnpm.cmd typecheck`; `pnpm.cmd build` |
| Visual smoke | 팀원 화면에서 평가 근거 초안/리더 AI가 숨겨지고, 입력 tab 첫 화면에 KPI list와 상세 panel이 보이는지 확인 |

## Phase 2. `/kpi/org` 조직 KPI Workspace

| 항목 | 내용 |
| --- | --- |
| 목표 | 조직 KPI 화면의 과밀한 상단/긴 우측 panel/빈 공백을 줄이고, HR/직책자 모두 이해 가능한 업무 화면으로 정리 |
| 대상 | `/kpi/org`, `src/components/kpi/OrgKpiManagementClient.tsx` |
| 참고 slide | 5, 6, 7 |
| 구현 범위 | left workspace, right current-scope panel, compact summary/action, list/map/link/history tabs |
| 금지 범위 | 목표 일괄 수정 강조, 목표 확정 권한/상태 변경, DB/API 변경, callback 없는 새 action |
| 테스트 | org 관련 테스트가 있으면 실행; `protected-page-regression`; `navigation-integrity`; `lint`; `typecheck`; `build` |
| Visual smoke | 첫 viewport에 KPI 목록 첫 row/card 일부가 보이고, 우측 panel 높이가 좌측 목록을 밀지 않아야 함 |

## Phase 3. `/kpi/personal` 개인 KPI

| 항목 | 내용 |
| --- | --- |
| 목표 | 실사용 중인 KPI 작성 흐름을 흔들지 않고, 영업/비영업/기간/상태를 더 직관적으로 보여줌 |
| 대상 | `/kpi/personal`, `src/components/kpi/PersonalKpiManagementClient.tsx` |
| 참고 slide | 8, 9 |
| 구현 범위 | 작성 wizard, weight progress, policyCategory/category chip, 제출 상태 timeline, leader review tab 정돈 |
| 금지 범위 | 현재 실사용 validation/policyCategory/target cycle 문구 임의 변경, 제출 workflow 변경 |
| 테스트 | personal KPI workspace/test, protected page regression, lint/typecheck/build |
| Visual smoke | 구성원은 “내 KPI 작성/수정/제출”을 바로 이해하고, 직책자는 review queue를 쉽게 찾을 수 있어야 함 |

## Phase 4. 업적평가 운영 + Workbench

| 항목 | `/evaluation/performance` | `/evaluation/workbench` |
| --- | --- | --- |
| 목표 | HR daily operations와 평가 preview를 연결 | 팀원/팀장/본부장/HR 단계별 평가 흐름 preview |
| 참고 slide | 17, 18 | 14, 15, 16, 19 |
| 구현 범위 | blocker dashboard, readiness CTA, process guide | stage timeline, role panel, score/grade preview, CEO/final preview |
| 금지 범위 | official save/score/grade activation | `Evaluation.totalScore`, `Evaluation.gradeId` write |
| 테스트 | activation-readiness, workbench, protected regression | evaluation-workbench, activation-readiness |
| Visual smoke | 공식 저장 차단 상태가 명확해야 함 | preview-only wording이 점수/등급 저장보다 강하게 보여야 함 |

## Phase 5. AI 활용 제출

| 항목 | 내용 |
| --- | --- |
| 목표 | “AI 역량평가” 타이틀을 2026/2028 정책에 맞게 재정의하고, 제출/인정 흐름으로 보이게 함 |
| 대상 | `/evaluation/ai-competency`, `/evaluation/ai-competency/admin` |
| 참고 slide | 12, 13 |
| 구현 범위 | AI 활용 제출 wizard, evidence/certificate card, HR review queue |
| 금지 범위 | 2026 연간 업적점수 연결, AI score exclusion activation, 자동 grade/pass write |
| 테스트 | `tests/evaluation-ai-assist.test.ts` 또는 AI competency 관련 테스트 확인 |
| Visual smoke | 일반 구성원은 제출 흐름, HR은 검토 queue를 이해해야 함 |

## Phase 6. 360 다면평가

| 항목 | 내용 |
| --- | --- |
| 목표 | 360 응답과 결과를 PPT형 wizard/dashboard로 정리 |
| 대상 | `/evaluation/360`, `/evaluation/360/respond/[feedbackId]`, `/evaluation/360/results`, `/evaluation/360/admin` |
| 참고 slide | 20, 21, 22 |
| 구현 범위 | response progress, anonymity badge, question cards, result chart/dashboard |
| 금지 범위 | 익명성 훼손, 응답자 식별 과노출, 무권한 결과 조회 |
| 테스트 | protected-page-regression, 360 관련 route/test |
| Visual smoke | 응답자는 할 일을 알고, 결과 조회자는 권한 범위 내 요약을 봐야 함 |

## Phase 7. 리더십 진단

| 항목 | 내용 |
| --- | --- |
| 목표 | 팀원 응답 화면과 직책자/HR 결과 화면을 역할별로 분리 |
| 대상 | `/evaluation/upward/respond`, `/evaluation/upward/results`, `/evaluation/upward/admin`, `/solutions/leadership-diagnosis` |
| 참고 slide | 23, 24 |
| 구현 범위 | upward response wizard, leadership result dashboard, development action panel |
| 금지 범위 | 배정되지 않은 응답/결과 접근, 개인 민감 feedback 과노출 |
| 테스트 | upward/feedback route tests, protected regression |
| Visual smoke | 팀원은 응답 흐름, 직책자는 결과/개선 action을 이해해야 함 |

## Phase 8. HR 운영/관리자 설정

| Admin area | Current route | Target |
| --- | --- | --- |
| 평가 운영 허브 | `/admin/evaluation-ops` | 7/1 MBO opening links first, advanced official transition collapsed |
| 공식 readiness | `/admin/evaluation-readiness` | baseline/export/safety lock visible, no official activation |
| 평가자 매칭 | `/admin/performance-assignments` | missing assignment queue, sync/write action guarded |
| 평가 기간 | `/admin/eval-cycle`, `/admin/performance-calendar` | cycle status and schedule readiness |
| 평가 대상자 | `/admin/google-access`, `/admin/org-chart`, `/admin/performance-design` | 대상자/조직/설계 workflow 분리 |
| 등급 기준 | `/admin/grades`, `/admin/preview-2026-grade` | grade policy preview, no official grade write |
| 조직/권한 | `/admin/google-access`, `/admin/org-chart` | organization/role/account readiness |

## Phase 9. Navigation/Layout Consistency Pass

- PPT 메뉴 구조에 맞춰 sidebar/navigation label을 정리한다.
- MVP scope 밖 메뉴는 숨기거나 고급/운영 section으로 이동한다.
- route path/API payload/permission behavior는 변경하지 않는다.
- compensation business logic은 삭제하지 않고 navigation 노출만 scope에 따라 관리한다.

## Ready Definition

각 phase는 아래 조건을 만족해야 `READY_FOR_PR`로 본다.

1. 변경 파일이 phase 대상 route/component에 한정된다.
2. 저장/제출/승인/반려/확정/공식 점수/공식 등급 동작을 변경하지 않는다.
3. 권한 조건과 서버 403 방어를 약화하지 않는다.
4. 새 dependency를 추가하지 않는다.
5. 관련 테스트, `pnpm.cmd lint`, `pnpm.cmd typecheck`, 가능하면 `pnpm.cmd build`가 통과한다.
6. 실제 브라우저 visual smoke에서 PPT parity 개선이 체감된다.
7. official write/scoring/grade/AI activation 금지선이 유지된다.
