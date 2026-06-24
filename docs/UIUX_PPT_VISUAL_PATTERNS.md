# UI/UX PPT Visual Patterns

작성일: 2026-06-17  
참고 PPT: `docs/reference/PMS_UIUX_reference.pptx`  

이 문서는 PPT 캡처에서 반복되는 업무형 UI 패턴을 현재 KPI PMS의 `pms-ui` primitive 및 route별 구현 방향과 연결한다. 목적은 예쁜 장식이 아니라 “지금 해야 할 일과 상태를 더 빨리 이해시키는 시각화”다.

## Pattern Principles

- 시각 요소는 업무 흐름 이해를 돕는 용도여야 한다.
- 큰 card를 반복해 화면을 밀어내지 않는다. 구성원 입력 화면은 compact하게, HR/admin 화면은 고밀도지만 스캔 가능하게 구성한다.
- PPT 이미지는 구현 참고일 뿐이며 앱 asset으로 복사하지 않는다.
- 외부 이미지 dependency를 추가하지 않는다.
- inline SVG, CSS pattern, subtle gradient header, role-based empty illustration은 허용한다.
- 장식용 요소가 CTA, 상태, 입력 field, 권한 경계를 가리면 안 된다.

## Repeated Patterns

| Pattern | PPT usage | Current PMS mapping | Good use | Avoid |
| --- | --- | --- | --- | --- |
| 좌측 list + 우측 detail panel | 조직 KPI, 월간 실적, 업적평가 | `PmsWorkspaceSection`, `PmsDetailPanel` | KPI 선택 후 상세 입력/검토 | 우측 panel 높이가 좌측 list를 밀어내는 grid |
| Summary card / metric rail | KPI 현황, readiness, 운영 요약 | `PmsSummaryCard`, `PmsMetricRail` | HR dashboard, compact 숫자 상태 | 구성원 입력 화면에서 큰 card 4개가 입력 영역을 밀어냄 |
| Progress ring / bar | 진행률, 입력 완료율 | `PmsProgressRing`, Tailwind bar | 월간 입력률, 평가 단계 진행률 | 실제 데이터 없는 fake progress |
| Traffic light | 위험/주의/정상 상태 | `PmsTrafficLight`, `PmsSignalChip` | KPI risk, readiness blocker | 색상만으로 의미 전달 |
| Table-like row | 목록/이력/매칭 관리 | row/card hybrid | HR/admin 고밀도 스캔 | 모바일에서 깨지는 넓은 table |
| Action card | 지금 해야 할 일 | `PmsActionCard` | 미입력 KPI, 증빙 추가, 검토 대기 | callback 없는 가짜 버튼 |
| State legend | 평가 상태/수정 가능 범위 | status chip group | 미시작/작성중/제출완료/반려/확정 | 너무 긴 설명 box |
| Dashboard blocker card | HR readiness/ops | blocker queue card | MBO missing, evaluator routing blockers | 공식 write action과 섞기 |
| Wizard + progress panel | 360/리더십/AI 제출 | stepper + right progress | 응답/제출 흐름 | 모든 질문을 한 화면에 과밀 배치 |
| Role-based view | 팀원/팀장/본부장/HR | permission-gated panels | 역할별 해야 할 일 분리 | 구성원에게 리더/HR 전용 AI/action 노출 |

## PMS UI Primitive Mapping

| Component | Intended use | Routes |
| --- | --- | --- |
| `PmsWorkspaceSection` | 화면의 실제 작업 공간을 감싸는 section. header, summary, tabs, content를 한 흐름으로 묶음 | `/kpi/monthly`, `/kpi/org`, `/kpi/personal` 후보 |
| `PmsDetailPanel` | 선택된 KPI/평가 대상/응답 대상의 상세 정보를 우측에 표시 | `/kpi/monthly`, `/kpi/org`, `/evaluation/workbench` 후보 |
| `PmsMetricRail` | 작은 숫자 상태를 한 줄 strip/pill로 표시 | 구성원 monthly, personal summary, readiness compact |
| `PmsSummaryCard` | HR/admin 또는 데이터가 많은 화면의 요약 card | `/evaluation/performance`, `/admin/evaluation-readiness` |
| `PmsActionCard` | 다음 행동을 짧고 명확하게 제시 | monthly next action, HR ops next action |
| `PmsSignalChip` | 상태/위험/유형/권한 chip | KPI risk, policyCategory, review status |
| `PmsTrafficLight` | 정상/주의/위험 상태를 빠르게 표시 | readiness, KPI risk, submission availability |
| `PmsProgressRing` | 입력률/완료율/진행률을 compact하게 표시 | monthly progress, 360 response progress |
| `PmsEmptyIllustration` | empty state를 덜 딱딱하게 만드는 inline SVG/패턴 | AI preview empty, no KPI, no feedback |

## Route Pattern Recommendations

### `/kpi/org`

- Pattern: 좌측 조직 KPI 작업 영역 + 우측 현재 범위/선택 상세 panel.
- Visual elements: compact metric rail, status chip, selected card highlight, right detail panel.
- Interaction: list/map/link/history tab은 좌측 column 안에 둔다.
- Guardrail: 목표 일괄 수정은 강조하지 않고, 목표 일괄 확정은 기존 권한/상태 조건 유지.

### `/kpi/personal`

- Pattern: 개인 KPI 작성 workspace + 제출/review 상태 timeline.
- Visual elements: weight bar, policyCategory chip, T/E/S target row, status chip, helper empty state.
- Interaction: 일반 AI 보조와 중간 점검 코치 설명을 분리한다.
- Guardrail: 실사용 중인 validation, policyCategory, target cycle 문구는 실사용 오류가 있을 때만 고친다.

### `/kpi/monthly`

- Pattern: 좌측 월간 KPI 작업 영역 + 우측 선택 KPI 상세 입력 panel.
- Visual elements: compact status rail, next action card, KPI card list, progress ring, AI 2-column assist.
- 구성원 screen: 검색/상세 filter는 기본 축소, 입력 필요/위험 quick action 우선.
- 직책자/관리자 screen: 관리 범위가 넓을 때 상세 filter 기본 노출 가능.
- Guardrail: 구성원에게 `generate-summary`, `generate-review`, `summarize-evaluation-evidence`, 평가 근거 초안, 리더 리뷰 AI 노출 금지.

### `/evaluation/performance`

- Pattern: HR 운영 dashboard + blocker queue + process preview.
- Visual elements: blocker count card, daily task card, process timeline, safety lock card.
- Guardrail: official scoring/grade/write control을 추가하지 않는다.

### `/evaluation/workbench`

- Pattern: 평가 과정 preview workspace.
- Visual elements: role/stage timeline, evaluation item table, score preview, grade preview, CEO/final preview.
- Guardrail: preview-only 문구를 유지하고 `Evaluation.totalScore`, `Evaluation.gradeId` write를 하지 않는다.

### `/evaluation/ai-competency`

- Pattern: AI 활용 제출 wizard + evidence panel.
- Visual elements: evidence card, submission stepper, certificate/proof chip, HR review status.
- Guardrail: 2026 연간 업적점수와 분리한다. Pass/Fail은 2028 정책 맥락으로 설명한다.

### `/evaluation/360/*`

- Pattern: 응답 wizard + 익명성/진행 panel, 결과 dashboard + chart panel.
- Visual elements: progress stepper, anonymity badge, response card, theme chart, development plan.
- Guardrail: 응답자 식별/민감 feedback 과노출 금지.

### `/evaluation/upward/*`

- Pattern: 리더십 진단 응답 wizard + 결과/개선 action dashboard.
- Visual elements: role context, progress panel, leadership theme card, action plan.
- Guardrail: 배정 대상과 결과 조회 권한을 엄격히 분리.

### `/admin/*`

- Pattern: HR operating hub + guarded advanced tools.
- Visual elements: grouped action card, blocker queue, readiness baseline, safety lock, import/upload queue.
- Guardrail: migration/backfill/apply/official write와 유사한 action은 기본 접힘 또는 차단 상태로 표시한다.

## Visual Density Rules

| Screen type | Density | Radius | Visual accent |
| --- | --- | --- | --- |
| 구성원 입력 화면 | 낮음-중간 | 12-16px 허용 | soft surface, compact chip, inline empty illustration |
| 직책자 review 화면 | 중간 | 10-14px | status chip, selected row, review queue |
| HR/admin 운영 화면 | 중간-높음 | 8-12px | blocker card, table-like row, compact metric |
| 공식 transition/readiness | 높음이지만 경고 명확 | 8-12px | safety lock, warning chip, guard rail |

## Accessibility And Safety

- 상태는 색상만으로 구분하지 않고 label/icon/text를 함께 제공한다.
- 버튼은 실제 callback이 있는 action만 사용한다.
- destructive/write action은 primary CTA처럼 보이지 않게 한다.
- disabled reason은 한 줄로 짧게 표시하고, 긴 경고 banner는 실제 차단 사유에만 사용한다.
- AI helper는 “초안/요약/코칭”으로 표현하고 “평가 산정/점수 반영/등급 반영”처럼 보이지 않게 한다.
- HR/admin 화면에서도 official score/grade/write는 readiness gate 이후 별도 승인 절차 전까지 노출하거나 활성화하지 않는다.
