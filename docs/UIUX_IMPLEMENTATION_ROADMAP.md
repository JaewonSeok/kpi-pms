# UI/UX 개편 구현 로드맵

Last updated: 2026-06-17

## 1. 구현 원칙

- 기능을 한 번에 갈아엎지 않는다.
- production data, schema, official write flow는 건드리지 않는다.
- 먼저 CEO demo와 7/1 MBO 오픈에 필요한 화면부터 pilot한다.
- 각 PR은 route 단위 또는 공통 component 단위로 작게 자른다.
- 기존 저장/제출/검토 workflow는 유지하고, 화면 구조와 안내를 먼저 개선한다.
- AI 기능은 공식 평가/점수/등급 산정처럼 보이지 않게 계속 분리한다.

## 2. 단계별 계획

### Phase 0. UI/UX 설계 확정

| 항목 | 내용 |
| --- | --- |
| 목적 | 이번 문서 4종을 기준으로 제품 방향과 safety boundary를 합의 |
| 범위 | docs only |
| PR 단위 | `docs: add UIUX redesign blueprint` |
| 회귀 위험 | 없음. 다만 현재 branch에 hotfix commit이 있으면 분리 필요 |
| 검증 | 문서 review, `git diff --stat` |

### Phase 1. Pilot 화면: CEO demo와 HR 운영 흐름

대상 route:

- `/evaluation/performance`
- `/admin/evaluation-ops`
- `/admin/evaluation-readiness`
- `/evaluation/workbench`

목표:

- HR이 볼 첫 메시지를 `오늘의 운영 상태`와 `P0 blocker`로 정리한다.
- evaluation process guide를 흐름형으로 압축한다.
- official write guard와 baseline export는 계속 선명하게 보인다.
- 고급 official transition 기능은 접거나 시각적으로 낮춘다.

예상 PR:

1. `refactor: simplify HR performance dashboard hierarchy`
2. `refactor: group evaluation ops links by MBO opening flow`
3. `refactor: clarify readiness baseline and safety lock hierarchy`
4. `refactor: polish evaluation workbench preview flow`

검증:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd run test:evaluation-workbench
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/evaluation-2026-activation-readiness.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
```

수동 smoke:

- `/evaluation/performance`에서 HR 운영 요약과 평가 흐름이 한눈에 보이는지
- `/admin/evaluation-ops`에서 7/1 오픈 링크가 먼저 보이는지
- `/admin/evaluation-readiness`에서 baseline/export/write guard가 보이는지
- `/evaluation/workbench`에서 preview-only와 score/grade preview가 혼동 없이 보이는지

회귀 위험:

- official scoring/grade 버튼이 일반 CTA처럼 보이면 안 된다.
- readiness admin metadata save와 baseline export가 혼동되면 안 된다.

### Phase 2. KPI 영역 개편

대상 route:

- `/kpi/org`
- `/kpi/personal`
- `/kpi/monthly`

목표:

- 조직 KPI 화면의 상단 과밀과 긴 우측 패널을 줄인다.
- 개인 KPI form은 핵심 입력 -> 선택 입력 -> 증빙/메모 순서로 정리한다.
- 월간 실적은 짧고 지속 가능한 입력 경험으로 바꾼다.
- 구성원에게 리더/HR 전용 AI action이 보이지 않게 유지한다.

예상 PR:

1. `refactor: compact organization KPI workspace layout`
2. `refactor: simplify personal KPI form flow`
3. `refactor: reduce monthly result input burden`
4. `refactor: clarify KPI AI assistant placement`

검증:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/personal-kpi-workspace.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-kpi-workspace.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-ai-comment-access.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
```

수동 smoke:

- 구성원: `/kpi/personal`, `/kpi/monthly`
- 팀장: `/kpi/personal?tab=review`, `/kpi/monthly` 관리 범위
- HR: `/kpi/org`, `/admin/evaluation-ops`

회귀 위험:

- 현재 실사용 중인 `/kpi/personal` validation, policyCategory, target cycle 문구는 실제 오류가 있을 때만 수정한다.
- 월간 실적 저장/제출 버튼의 동작을 바꾸지 않는다.
- AI action visibility는 서버 권한 방어와 함께 유지한다.

### Phase 3. 평가 영역 개편

대상 route:

- `/evaluation/performance`
- `/evaluation/workbench`
- `/evaluation/ai-competency`
- `/evaluation/360`
- `/evaluation/upward/respond`
- `/evaluation/upward/results` 또는 현재 결과 route

목표:

- 평가 화면을 팀원/팀장/본부장/HR의 흐름으로 분리한다.
- AI 활용 제출은 연간 평가점수 산정과 분리된 이름과 설명으로 정리한다.
- 360/리더십은 실제 응답 -> 결과 -> 후속 액션 흐름으로 재배치한다.

예상 PR:

1. `refactor: rename and clarify AI usage submission flow`
2. `refactor: reorganize 360 response experience`
3. `refactor: simplify leadership diagnosis results flow`
4. `refactor: improve role-based evaluation task panels`

검증:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd run test:evaluation-workbench
pnpm.cmd run test:ai-competency
pnpm.cmd run test:feedback360
pnpm.cmd run test:wordcloud360
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
```

수동 smoke:

- 구성원 AI 활용 제출
- 360 응답자 화면
- 리더십 결과 조회
- HR demo에서 official score/grade write가 없는지

회귀 위험:

- AI 활용 제출이 2026 연간 평가 점수에 포함되는 것처럼 보이면 안 된다.
- 360/리더십 민감 comment 권한을 넓히면 안 된다.

### Phase 4. 관리자 운영 화면 개편

대상 route:

- `/admin/performance-assignments`
- `/admin/eval-cycle` 또는 `/admin/evaluation-cycles`
- `/admin/evaluation-targets`
- `/admin/grades`
- `/admin/google-access` 또는 `/admin/organization`
- `/admin/department-score-intake`

목표:

- 관리자 설정을 평가 기간, 대상자, 평가자 매칭, 등급 기준, 조직/권한 순서로 정리한다.
- sync/apply/backfill/official transition 성격의 action을 고급 영역에 둔다.
- department score intake는 production migration 상태와 공식 scoring 연결 여부를 명확히 표시한다.

예상 PR:

1. `refactor: group admin evaluation setup navigation`
2. `refactor: simplify evaluator assignment readiness view`
3. `refactor: clarify evaluation cycle edit state`
4. `refactor: isolate advanced official transition controls`

검증:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd run test:operational-pages
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/navigation-integrity.test.ts
```

수동 smoke:

- HR admin만 접근 가능한지
- sync/apply/save 성격 버튼이 일반 CTA처럼 노출되지 않는지
- `/admin/evaluation-readiness`와 `/admin/performance-assignments` 사이의 blocker 흐름이 자연스러운지

회귀 위험:

- route path나 permission mapping 변경은 보호 route regression을 일으킬 수 있다.
- Prisma schema 또는 migration은 이 로드맵의 UI PR에 포함하지 않는다.

## 3. 1차 Pilot 권장 범위

가장 먼저 실행할 pilot은 `/evaluation/performance`와 `/admin/evaluation-ops`이다.

이유:

- CEO demo와 HR 운영 메시지에 바로 영향을 준다.
- production write/API 변경 없이 화면 hierarchy를 개선할 수 있다.
- KPI 입력 실사용 중인 `/kpi/personal`을 직접 건드리지 않고도 제품 인상을 개선한다.
- official write guard와 preview-only 메시지를 유지하면서 전체 평가 흐름을 설명할 수 있다.

권장 branch:

- `feature/uiux-pilot-hr-operations-flow`

예상 변경:

- `src/app/(main)/evaluation/performance/page.tsx`
- `src/app/(main)/admin/evaluation-ops/page.tsx`
- `src/components/evaluation/EvaluationProcessPreviewGuide2026.tsx`
- 필요 시 small shared presentational component under `src/components/evaluation/`

금지:

- API payload 변경
- Prisma schema 변경
- official scoring/grade/write CTA 추가
- `/kpi/personal` validation 변경

## 4. 공통 수동 Smoke Checklist

### HR/Admin

- `/evaluation/performance`에서 오늘 할 일과 blocker가 먼저 보이는가
- `/admin/evaluation-ops`에서 KPI/MBO, 평가자 배정, 평가 일정, readiness가 먼저 보이는가
- `/admin/evaluation-readiness`에서 baseline export와 공식 저장 차단 상태가 보이는가
- official scoring/grade/backfill/apply 버튼이 일반 CTA처럼 보이지 않는가

### 구성원

- `/kpi/personal`에서 KPI 작성 흐름이 자연스러운가
- `/kpi/monthly`에서 월간 실적 입력 부담이 과하지 않은가
- 구성원에게 리더 리뷰 AI가 보이지 않는가

### 직책자

- 팀원 KPI 검토와 월간 점검 대상이 잘 보이는가
- AI 중간 점검 코치가 공식 평가/점수 산정처럼 보이지 않는가
- 관리 범위 밖 구성원 action이 보이지 않는가

### CEO Demo

- 5분 버전: `/evaluation/performance` -> `/kpi/personal` -> `/kpi/monthly` -> `/admin/evaluation-readiness` -> `/evaluation/workbench`
- 15분 버전: 위 흐름에 `/admin/evaluation-ops`, `/admin/performance-assignments`를 추가
- 보여주지 말 것: compensation, raw logs, backfill/apply, feature flag, official scoring/grade activation

## 5. 검증 명령 기준

문서만 바뀐 경우:

```bash
git diff --stat
```

UI component가 바뀐 경우:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
```

KPI 화면이 바뀐 경우:

```bash
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/personal-kpi-workspace.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-kpi-workspace.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-ai-comment-access.test.ts
```

Evaluation readiness/workbench가 바뀐 경우:

```bash
pnpm.cmd run test:evaluation-workbench
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/evaluation-2026-activation-readiness.test.ts
```

Navigation/permission이 바뀐 경우:

```bash
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/navigation-integrity.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
```

## 6. 후속 구현 전 확인해야 할 영역

- `/admin/evaluation-cycles`, `/admin/evaluation-targets`, `/admin/organization`는 현재 route 명과 PPT target IA가 다를 수 있다. 실제 route mapping을 먼저 확인한다.
- `/upward/results`는 현재 App Router path와 결과 화면 존재 여부를 확인한다.
- 조직 KPI 화면의 현재 컴포넌트 구조와 권한 조건을 구현 전에 다시 읽는다.
- `/kpi/personal`은 실사용 중이므로 validation/copy 변경은 실제 오류가 있을 때만 진행한다.
- Department score intake 관련 UI는 migration 적용 상태와 production DB table existence 확인 후에만 다룬다.

