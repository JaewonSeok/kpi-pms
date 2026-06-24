# Current Handoff

Last updated: 2026-06-24
Branch: `main`
Latest commit checked: `9274294` (`Merge pull request #128 from JaewonSeok/fix/leadership-result-category-dedupe`)
Remote state: HEAD → main, origin/main (동기화 완료)

## Must-Read First

1. `docs/operations/working-rules.md`
2. `docs/operations/current-handoff.md` (이 파일)
3. `docs/AI_CURRENT_STATUS.md` — 가장 최신 상태 요약
4. `README.md`
5. auth/login/session/middleware/Google OAuth/master login/pending access 작업 시:
   - `docs/auth-rbac-matrix.md`
   - `docs/operations/deployment-and-env.md`
6. AI 기능 작업 시: `docs/ai-assistant-operations.md`
7. 2026 평가정책 작업 시: `docs/AI_EVALUATION_SYSTEM_CONTEXT.md`

## Current Focus — 2026 평가정책 본 작업 (2026-06-24 기준)

주요 완료 사항:
- position/role 전원 교정 (289명 — MEMBER 233/TEAM_LEADER 42/SECTION_CHIEF 7/DIV_HEAD 7)
- 부서 고아 12개 삭제·중복 해소 (75→63개, deptName 중복 0)
- 영업 1·2본부 level TEAM→SECTION 교정
- 보상(Compensation) 모듈 코드 전면 제거 (PR #126)
- 360 캐시 자동 재생성 (PR #127)
- Preview 2026 등급 페이지 production 배포 (/admin/preview-2026-grade)
- Leadership Diagnosis (PPT·Ops·AI 코칭) 완성
- UIUX 전면 재설계 완료

**다음 본 작업 (1순위):** M1-B wiring
`calculateEvaluationScore2026()`가 완성돼 있으나 submit/draft 라우트 미연결.
⚠️ production 평가 점수 계산 방식 변경 — **shadow 검증(read-only 시뮬레이션) 먼저.**

## Data State (production — 2026-06-24)

| 항목 | 값 |
|---|---|
| Active employees | 289 |
| Departments | 63 (이전 75, 고아 12개 삭제) |
| position 교정 | 완료 (MEMBER 233 / TEAM_LEADER 42 / SECTION_CHIEF 7 / DIV_HEAD 7) |
| deptName 중복 | 0 |
| 보상 모듈 | 코드 제거됨, DB 테이블 5개만 유지 |
| 360 캐시 | 제출 시 자동 재생성 |

## Dormant Flag 현황 (2026-06-24 확인)

```
evaluation-policy-2026.ts:
  adjustmentRule.active           = false  (dormant)
  weightRule.enforced             = false  (dormant)
  belowTargetExceptionRule.active = false  (wiring 완료, flip 대기)
  dailyWorkScoringRule.active     = false  (dormant)
  finalScoreFormula.active        = false  (dormant)
```

## Next Steps (우선순위)

### P0. M1-B wiring (shadow 검증 → 라우트 연결)
1. `calculateEvaluationScore2026()` 로 read-only shadow run (점수 변화 확인)
2. shadow 결과 승인 후 submit/draft 라우트에 연결
3. `finalScoreFormula.active = true` flip

### P1. belowTargetExceptionRule flip
`active = true` 하나로 즉시 활성화. shadow 검증 선행.

### P2. M1-D Preview→production intake 통합
더 큰 설계 작업. 별도 계획 필요.

## Local Branch 잔여 정리

- 워크트리 16개 (`+` 표시 브랜치) — `git worktree remove` 필요
- `fix/upward-round-save-invalid-date`: ahead 30 확인
- `feature/koreanize-user-facing-copy-final-pass`: CRLF 연관 확인
- `feature/ceo-demo-mode`: WIP, origin 백업됨

## Important Completed Context

### Auth/Login
- Google Workspace 로그인이 메인 흐름
- 관리자/master login은 emergency fallback
- `/access-pending` 처리 구현됨
- same-origin callback, `/login` redirect loop 방지 완료

### Compensation Module
- 코드 **완전 제거됨** (PR #126, chore/remove-compensation)
- DB 테이블 5개(schema.prisma 모델) 유지 중 — 삭제 여부 별도 결정
- 보상 관련 코드·라우트·UI 전부 없음

### 360 Feedback
- Leadership Diagnosis 포함 전면 완성
- 360 캐시 자동 재생성 (PR #127)
- PPT 워크스페이스 재설계 완료

### 2026 평가 엔진
- Preview 엔진: `src/lib/preview-2026-organization-score.ts` (완성, 테스트 완비)
- Production 엔진: `src/server/evaluation-scoring-2026.ts` (완성, submit 라우트 미연결)
- 두 엔진 코드 미공유 — 별개

## Non-Negotiable Rules

- 패키지 매니저: `pnpm` (npm/yarn 금지)
- 코드·주석·테스트: 영어. UI 문구: 한국어.
- write path: route handler / server-side. Zod 검증.
- OpenAI: 서버 사이드, PII 미전달, preview-first.
- 평가 점수·등급 write: shadow 검증 선행 필수.
- 기존 변경을 임의로 되돌리지 않음.
- 작업 방향이 바뀌면 `current-handoff.md`와 `next-chat-prompt.md` 동시 갱신.
