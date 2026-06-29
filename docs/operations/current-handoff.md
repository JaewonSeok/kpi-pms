# Current Handoff

Last updated: 2026-06-29
Branch: `main`
Latest commit checked: `fbc819e` (Merge pull request #141 — fix/review-cards-group-by-question)
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

## Current Focus — 2026 평가정책 본 작업 (2026-06-29 기준)

주요 완료 사항 (전체):
- position/role 전원 교정 (289명)
- 부서 고아 12개 삭제·중복 해소 (75→63개)
- 보상(Compensation) 모듈 코드 전면 제거 (PR #126)
- 360 캐시 자동 재생성 (PR #127)
- Preview 2026 등급 페이지 production 배포
- Leadership Diagnosis (PPT·Ops·AI 코칭) 완성
- UIUX 전면 재설계 완료
- 본부장 브리핑 A4 리포트 모달 (PR #135)
- 360 결과 화면 전면 개선 (PR #136~#141 — 아래 상세)

**다음 본 작업 (1순위):** M1-B wiring
`calculateEvaluationScore2026()`가 완성돼 있으나 submit/draft 라우트 미연결.
⚠️ production 평가 점수 계산 방식 변경 — **shadow 검증(read-only 시뮬레이션) 먼저.**
A4 팝업에서 조직/개인 점수가 "미산정(30:70 미연결)"으로 표시 중.

## 360 결과 화면 현재 구조 (2026-06-29 기준)

### 허브 탭 (`?tab=results` on `/evaluation/360`)
- **카테고리 bar chart**: `categoryTagCounts` (라운드 전체 집계, PR #137)
- **육각 레이더**: `HubRadarChart` — 강점 비율(양수태그/전체태그) 6축 (PR #138)
- 데이터 소스: `overallTagSummaries` → `categoryTagCounts` (서버 집계)

### 개별 결과 탭 (`/evaluation/360/results`)
- **별점 분포 차트** (`Feedback360RatingDistChart`): 카테고리별 1–5★ 가로 막대 (PR #138/#139)
- **카테고리 bar chart**: 강점/보완 건수 (PR #137)
- **강점/보완 Top 3 텍스트** 블록
- **태그 클러스터**: `overallTagSummaries` 기반 (라운드 집계)
- **리뷰 상세 내역**: 질문별 3섹션 (협업 / 업무 실행 / 성장 제안) × 평가자 카드 (PR #141)
  - "종합" RATING_SCALE 카드 제외 (별점 분포로 분리)

### ★ 360 집계 두 경로 — 반드시 양쪽 수정
| 경로 | 파일 | 용도 |
|---|---|---|
| 라이브 (즉시) | `src/server/feedback-360.ts` | 결과 탭 실시간 조회 |
| 캐시 저장 | `src/server/feedback-360-workflow.ts` `persistFeedback360Report()` | feedbackReportCache 테이블 |

집계 로직(distribution 등) 변경 시 **반드시 두 파일 동시 수정**. 한 쪽만 바꾸면 재생성 캐시에 반영 안 됨 (PR #138에서 workflow.ts 누락으로 별점분포 안 뜬 선례).

### ★ 캐시 재생성 버튼
`/evaluation/360/results` 페이지에만 존재 ("결과 리포트 다시 준비"). 코드 배포만으론 기존 캐시 안 바뀜. 단, PR #127로 신규 제출 시 자동 재생성.

### ★ 태그 풀 중복 라벨
`src/components/evaluation/feedback360/feedback360-response-tag-pool.ts`에 같은 라벨이 여러 카테고리에 등록된 케이스 3개:
- positive: `'갈등을 완화하려고 해요'`
- improvement: `'마감 관리를 더 안정적으로 하면 좋아요'`, `'감정적 대응을 줄이면 좋아요'`

카드 단위 표시 시 label 기준 dedupe 필수 (PR #140에서 처리). 클러스터(집계)는 `tone:category:label` 키라 중복 카운트 의도적.

### 360 두 영역 데이터 소스 구분
| 영역 | 소스 |
|---|---|
| 태그 클러스터 / bar chart / 레이더 | `overallTagSummaries` (evaluator별 `overallComment` 파싱) |
| 리뷰 상세 카드 (텍스트) | `groupedResponses` (질문별 `textValue`) |
| 별점 분포 | `categoryScores.distribution` (RATING_SCALE 응답 집계) |

## Data State (production — 2026-06-29)

| 항목 | 값 |
|---|---|
| Active employees | 289 |
| Departments | 63 (이전 75, 고아 12개 삭제) |
| position 교정 | 완료 (MEMBER 233 / TEAM_LEADER 42 / SECTION_CHIEF 7 / DIV_HEAD 7) |
| deptName 중복 | 0 |
| 보상 모듈 | 코드 제거됨, DB 테이블 5개만 유지 |
| 360 캐시 | 제출 시 자동 재생성 (PR #127) |

## Dormant Flag 현황 (2026-06-29 확인)

```
evaluation-policy-2026.ts:
  adjustmentRule.active           = false  (dormant)
  weightRule.enforced             = false  (dormant)
  belowTargetExceptionRule.active = false  (wiring 완료, flip 대기)
  dailyWorkScoringRule.active     = false  (dormant)
  finalScoreFormula.active        = false  (dormant — M1-B wiring 후 flip 예정)
```

## Next Steps (우선순위)

### P0. M1-B wiring (shadow 검증 → 라우트 연결)
1. `calculateEvaluationScore2026()` 로 read-only shadow run (점수 변화 확인)
2. shadow 결과 승인 후 submit/draft 라우트에 연결
3. `finalScoreFormula.active = true` flip
- 관련 파일: `src/server/evaluation-scoring-2026.ts`, `src/app/api/evaluation/[id]/submit/route.ts`

### P1. belowTargetExceptionRule flip
`active = true` 하나로 즉시 활성화. shadow 검증 선행.

### P2. M1-D Preview→production intake 통합
더 큰 설계 작업. 별도 계획 필요.

## Local Branch 잔여 정리

- 워크트리 16개 (`+` 표시 브랜치) — `git worktree remove` 필요
- `fix/upward-round-save-invalid-date`: ahead 30 확인
- `feature/koreanize-user-facing-copy-final-pass`: CRLF 연관 확인
- `feature/ceo-demo-mode`: WIP, origin 백업됨
- DB 보상 테이블 5개 삭제 여부 결정

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

### 360 Feedback (PR #127~#141)
- PR #127: 360 캐시 자동 재생성 (피드백 제출 시 `persistFeedback360Report` 자동 호출)
- PR #135: 본부장 브리핑 A4 리포트 모달 (화면 전용, 점수 미연결)
- PR #136: radar 스케일 교정 + 태그 집계 소스 textValue→overallComment 교체
- PR #137: 허브 탭 카테고리 bar chart 집계 연결 (`categoryTagCounts`)
- PR #138: 허브 탭 육각 레이더(`HubRadarChart`, 강점비율) + 개별 탭 별점분포(`Feedback360RatingDistChart`) + `feedback-360-workflow.ts` distribution 누락 수정
- PR #139: 별점 분포 가로 막대 디자인 개선 (5→1★ 세로 배치, 색상 코딩)
- PR #140: 리뷰 카드 태그 채우기 (`overallTagSummaries`에 `feedbackId` 추가, `feedbackTagMap` 매핑) + label 기준 dedupe (태그풀 중복 라벨 대응)
- PR #141: 리뷰 카드 질문별 그룹핑 (협업/업무실행/성장제안 3섹션), `slice(0,8)` 잘림 제거, "종합" RATING_SCALE 카드 제외

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
