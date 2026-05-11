# Next Chat Prompt

아래 프롬프트를 새 채팅방에 그대로 붙여 넣으면 됩니다.

```text
저장소 `c:\Users\RSUPPORT\Desktop\성과관리 및 평가시스템\kpi-pms`에서 작업을 이어서 진행해줘.

시작 전에 반드시 아래 문서를 순서대로 읽어줘.
1. docs/operations/working-rules.md
2. docs/operations/current-handoff.md
3. README.md
4. 작업이 auth/login/session/middleware/Google OAuth/master login/access pending에 닿으면:
   - docs/auth-rbac-matrix.md
   - docs/operations/deployment-and-env.md
5. 작업이 AI 기능에 닿으면:
   - docs/ai-assistant-operations.md
6. 작업이 제품 범위/우선순위에 닿으면:
   - docs/product/implementation-backlog.md
   - docs/product/global-benchmark-gap-analysis.md
   - docs/product/implementation-roadmap-world-class.md

그 다음 바로 아래를 실행해서 현재 상태를 먼저 요약해줘.
- git status --short --untracked-files=all
- git log --oneline -n 5

현재 인수인계 기준:
- 브랜치: main
- 최신 확인 커밋: 4974df3 (`실 kpi 추가`)
- 확인 당시 HEAD는 origin/main과 같은 위치였음
- 확인 당시 워크트리는 문서 갱신 전 clean 상태였음

최근 작업 흐름:
- 예전 인수인계의 중심은 로그인/인증 안정화와 calibration session setup hardening이었지만, 현재 코드는 그 이후 크게 진행됨.
- 최신 흐름은 조직 KPI, 특히 division / section(`실 KPI`) / team 스코프와 필터/권한/AI 추천 작업 쪽임.
- 핵심 파일:
  - src/components/kpi/OrgKpiManagementClient.tsx
  - src/lib/org-kpi-hierarchy.ts
  - src/lib/org-kpi-scope.ts
  - src/server/org-kpi-page.ts
  - src/server/org-kpi-access.ts
  - src/server/org-kpi-team-ai.ts
  - src/components/kpi/OrgKpiTeamAiWorkspace.tsx
  - src/app/api/kpi/org/*
  - tests/org-kpi-hierarchy-filters.test.ts
  - tests/org-kpi-section-team-scope.test.ts

우선 남은 일:
1. 최신 `실 KPI` / 조직 KPI 변경 검증
   - pnpm typecheck
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-hierarchy-filters.test.ts
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-section-team-scope.test.ts
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-scope-model.test.ts
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-access.test.ts
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-structure-ui.test.ts

2. /kpi/org 수동 QA
   - division / section(`실 KPI`) / team 필터가 분리되어 보이는지
   - section 선택 시 해당 section 하위 team만 보이는지
   - section 하위 team이 없을 때 직접 division team으로 잘못 fallback하지 않는지
   - section이 없는 조직은 기존 division/team 동작을 유지하는지
   - 생성/수정/삭제/workflow/bulk upload/bulk edit이 권한 범위를 지키는지
   - 긴 KPI 텍스트가 UI를 깨지 않는지

3. 권한 QA
   - admin 전체 관리
   - division head의 division 범위
   - section leader의 section 및 하위 team 범위
   - team leader의 team/lineage 범위
   - member의 read-only 접근
   - master login/impersonation banner와 risk prompt

4. AI 추천 경로를 건드리면 추가 검증
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-team-ai-workspace.test.ts
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-ai-recommendation-modal.test.ts
   - pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-ai-recommendation-upgrade.test.ts
   - OpenAI 사용은 서버 사이드 유지
   - 이름/이메일/사번/평가자ID 등 직접 PII는 AI provider로 보내지 않기
   - AI 결과는 preview-first, approval-based 유지

5. 릴리스 전에는 넓은 검증
   - pnpm lint
   - pnpm typecheck
   - pnpm test
   - pnpm build
   - /api/health/live
   - /api/health/ready
   - /login
   - /dashboard
   - /kpi/org
   - /statistics

6. 로그인/인증은 이전에 안정화됐지만 운영 검증은 남아 있음
   - NEXTAUTH_URL과 AUTH_URL이 같아야 함
   - NEXTAUTH_SECRET과 AUTH_SECRET이 같아야 함
   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET이 placeholder가 아니어야 함
   - ALLOWED_DOMAIN과 Employee.gwsEmail 도메인이 맞아야 함
   - Google Cloud Console callback URL 확인
   - /login Google 로그인, callback, 관리자 fallback, /access-pending 동작 확인

중요 규칙:
- 기존 변경을 임의로 되돌리지 말 것
- 패키지 매니저와 검증 명령은 pnpm 기준
- 공용 UI 문구는 한국어, 코드/주석/테스트는 영어
- write path는 route/server 쪽에 두고 request body는 Zod로 검증
- auth/login 수정 시 same-origin callback과 /login 루프 방지를 반드시 확인
- workflow 화면은 data model, permissions, state transitions, audit log를 같이 볼 것
- 작업 방향이 크게 바뀌면 docs/operations/current-handoff.md와 docs/operations/next-chat-prompt.md를 같이 업데이트할 것
```
