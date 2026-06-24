# Next Chat Prompt

아래 프롬프트를 새 채팅방에 그대로 붙여 넣으면 됩니다.

```text
저장소 `c:\Users\RSUPPORT\Desktop\성과관리 및 평가시스템\kpi-pms`에서 작업을 이어서 진행해줘.

시작 전에 반드시 아래 문서를 순서대로 읽어줘.
1. docs/operations/working-rules.md
2. docs/operations/current-handoff.md
3. docs/AI_CURRENT_STATUS.md
4. README.md
5. 2026 평가정책 작업 시: docs/AI_EVALUATION_SYSTEM_CONTEXT.md
6. auth/login/session 작업 시: docs/auth-rbac-matrix.md, docs/operations/deployment-and-env.md
7. AI 기능 작업 시: docs/ai-assistant-operations.md

그 다음 바로 아래를 실행해서 현재 상태를 먼저 요약해줘.
- git status --short
- git log --oneline -n 5

현재 인수인계 기준 (2026-06-24):
- 브랜치: main
- 최신 확인 커밋: 9274294 (PR #128 fix/leadership-result-category-dedupe)
- origin/main과 동기화 완료

최근 주요 완료 사항:
- production DB 교정: position/role 289명 전원 정합 (MEMBER 233/TEAM_LEADER 42/SECTION_CHIEF 7/DIV_HEAD 7)
- production DB 교정: 부서 고아 12개 삭제·중복 해소 (75→63개), 영업1·2본부 SECTION 교정
- 보상(Compensation) 모듈 코드 완전 제거 (PR #126) — DB 테이블 5개만 유지
- 360 캐시 자동 재생성 (PR #127)
- Preview 2026 등급 페이지 production 배포 (/admin/preview-2026-grade)
- Leadership Diagnosis (PPT/Ops/AI 코칭) 완성
- UIUX 전면 재설계 완료 (PR #97–107)
- 로컬 브랜치 109개 정리 완료 (30개 잔존)

다음 본 작업 (1순위):
  M1-B wiring — calculateEvaluationScore2026()가 완성돼 있으나 submit/draft 라우트 미연결.
  ⚠️ production 평가 점수 계산 방식 변경 작업이므로 shadow 검증(read-only 시뮬레이션) 먼저.
  shadow 결과 확인 후 라우트 연결 + finalScoreFormula.active = true flip.

Dormant 플래그 현황 (전부 false):
  adjustmentRule.active = false / weightRule.enforced = false /
  belowTargetExceptionRule.active = false (wiring 완료, flip 대기) /
  dailyWorkScoringRule.active = false / finalScoreFormula.active = false

핵심 파일 (2026 평가정책):
  - src/lib/evaluation-policy-2026.ts       (정책 상수·dormant 플래그)
  - src/server/evaluation-scoring-2026.ts   (production 점수 엔진 — calculateEvaluationScore2026)
  - src/lib/preview-2026-organization-score.ts (Preview 엔진 — intake 기반)
  - src/app/api/evaluation/[id]/submit/route.ts (submit 라우트 — wiring 대상)
  - src/app/api/evaluation/[id]/route.ts    (draft 라우트 — wiring 대상)

잔여 정리 과제 (다음 사이클):
  - 워크트리 16개(+ 표시 브랜치) git worktree remove 필요
  - fix/upward-round-save-invalid-date ahead 30 확인
  - feature/koreanize-user-facing-copy-final-pass CRLF 확인
  - feature/ceo-demo-mode WIP (origin 백업됨)
  - DB 보상 테이블 5개 삭제 여부 결정

중요 규칙:
- 패키지 매니저: pnpm (npm/yarn 금지)
- DB 접속: production = Supabase 5432 (DATABASE_URL), 로컬 = Docker 5433
- 코드·주석·테스트: 영어. UI 문구: 한국어.
- write path: route handler / server-side. request body: Zod 검증.
- OpenAI: 서버 사이드, PII 미전달, preview-first.
- 평가 점수·등급 write: shadow 검증 선행 필수 (production impact 높음).
- 기존 변경 임의 되돌리기 금지.
- 작업 방향이 크게 바뀌면 current-handoff.md + next-chat-prompt.md 동시 갱신.
```
