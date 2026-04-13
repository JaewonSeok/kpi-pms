# Next Chat Prompt

아래 프롬프트를 새 채팅방에 그대로 붙여 넣으면 됩니다.

```text
저장소 `c:\Users\RSUPPORT\Desktop\성과관리 및 평가시스템\kpi-pms`에서 작업을 이어서 진행해줘.

먼저 반드시 아래 순서대로 읽고 시작해줘.
1. docs/operations/working-rules.md
2. docs/operations/current-handoff.md
3. README.md
4. docs/auth-rbac-matrix.md
5. docs/operations/deployment-and-env.md
6. 인증/로그인 이외 AI 기능을 건드리면 docs/ai-assistant-operations.md도 읽어줘.

그 다음 바로 `git status --short --untracked-files=all`로 워크트리 상태를 확인하고, 현재 상태를 짧게 요약한 뒤 작업을 시작해줘.

현재 인수인계 기준:
- 브랜치: `main`
- 기준 커밋: `c45c116`
- 워크트리: 현재 clean 상태
- 최근 완료 작업:
  - 로그인/인증 안정화
    - `NEXTAUTH_URL` / `AUTH_URL` alias 처리
    - `NEXTAUTH_SECRET` / `AUTH_SECRET` alias 처리
    - shared auth cookie/runtime policy 정리
    - same-origin callback 유지 및 `/login` redirect loop 방지
    - callback 직후 first protected request recovery 보강
    - 로그인 페이지의 Google Workspace 로그인 + 관리자 비상 로그인 fallback 유지
  - calibration session setup hardening도 repo에 반영되어 있음

이번 채팅에서 우선 확인하거나 이어갈 남은 일:
1. `/login` 브라우저 QA
   - Google 로그인 시작
   - callback 이후 `/login` 루프 없는지
   - 관리자 fallback 로그인 동작
   - 한국어 에러 문구 표시
   - callback 직후 첫 보호 페이지 진입이 정상인지
2. 인증 환경값/운영 설정 점검
   - `NEXTAUTH_URL` vs `AUTH_URL`
   - `NEXTAUTH_SECRET` vs `AUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ALLOWED_DOMAIN`
   - Google Cloud Console callback URL
3. release 전 추가 검증 필요 시
   - `pnpm test:auth`
   - `pnpm exec ts-node -P tsconfig.seed.json tests/auth-session.test.ts`
   - `pnpm test:calibration-ops`
   - `pnpm typecheck`
   - 필요하면 `pnpm lint`, `pnpm build`
4. calibration 작업을 다시 이어간다면 setup hub와 `START_SESSION` 흐름을 수동 QA
5. `tmp-session1.pdf`, `tmp-session2.pdf`는 현재 tracked 파일이므로 삭제 전에 용도를 먼저 확인

중요 규칙:
- 기존 변경을 임의로 되돌리지 말 것
- 패키지 매니저와 검증 명령은 `pnpm` 기준으로 볼 것
- 공용 UI 문구는 한국어, 코드/주석/테스트는 영어 유지
- write path는 route/server 쪽에 두고 request body는 Zod로 검증
- auth/login 수정 시 same-origin callback과 로그인 루프 방지를 항상 확인
- 작업 방향이 크게 바뀌면 docs/operations/current-handoff.md와 docs/operations/next-chat-prompt.md도 같이 업데이트해줘
```
