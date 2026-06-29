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

현재 인수인계 기준 (2026-06-29):
- 브랜치: main
- 최신 확인 커밋: fbc819e (PR #141 fix/review-cards-group-by-question)
- origin/main과 동기화 완료

최근 주요 완료 사항 (#135~#141, 2026-06-25 이후):
- PR #135: 본부장 브리핑 A4 리포트 모달 (화면 전용 — 점수 미연결)
- PR #136: 360 radar 스케일 교정 + 태그 집계 소스 textValue→overallComment 교체
- PR #137: 360 허브 탭 카테고리 bar chart 집계 연결
- PR #138: 360 허브 탭 육각 레이더(강점비율) + 개별 탭 별점분포 + workflow.ts distribution 수정
- PR #139: 별점 분포 가로 막대 디자인 개선
- PR #140: 리뷰 카드 태그 채우기(overallComment 기반) + label 기준 dedupe
- PR #141: 리뷰 카드 질문별 그룹핑 + slice(0,8) 잘림 제거(성장 제안 섹션 복원)

다음 본 작업 (1순위):
  M1-B wiring — calculateEvaluationScore2026()가 완성돼 있으나 submit/draft 라우트 미연결.
  ⚠️ production 평가 점수 계산 방식 변경 작업이므로 shadow 검증(read-only 시뮬레이션) 먼저.
  shadow 결과 확인 후 라우트 연결 + finalScoreFormula.active = true flip.
  ★ A4 팝업 조직/개인 점수 "미산정(30:70 미연결)" 상태 — M1-B wiring 완료 전까지 유지.

Dormant 플래그 현황 (전부 false):
  adjustmentRule.active = false / weightRule.enforced = false /
  belowTargetExceptionRule.active = false (wiring 완료, flip 대기) /
  dailyWorkScoringRule.active = false / finalScoreFormula.active = false (M1-B 후 flip 예정)

핵심 파일 (2026 평가정책):
  - src/lib/evaluation-policy-2026.ts       (정책 상수·dormant 플래그)
  - src/server/evaluation-scoring-2026.ts   (production 점수 엔진 — calculateEvaluationScore2026)
  - src/lib/preview-2026-organization-score.ts (Preview 엔진 — intake 기반)
  - src/app/api/evaluation/[id]/submit/route.ts (submit 라우트 — wiring 대상)
  - src/app/api/evaluation/[id]/route.ts    (draft 라우트 — wiring 대상)

★★★ 360 피드백 작업 시 반드시 알아야 할 함정 ★★★

1. ★ 집계 두 경로 — 반드시 양쪽 수정
   360 집계 로직은 두 파일에 존재:
   - src/server/feedback-360.ts          → 결과 탭 실시간 조회 (라이브)
   - src/server/feedback-360-workflow.ts → feedbackReportCache 저장 (persistFeedback360Report)
   distribution, categoryScores 등 집계 로직 변경 시 두 파일 동시 수정 필수.
   한 쪽만 고치면 "리포트 재생성" 후에도 반영 안 됨 (PR #138에서 실제로 겪음).

2. ★ 캐시 재생성 필요
   feedbackReportCache는 코드 배포만으론 안 바뀜.
   /evaluation/360/results 페이지의 "결과 리포트 다시 준비" 버튼으로 수동 재생성 필요.
   단, PR #127로 신규 제출 시 자동 재생성됨.

3. ★ 태그 풀 중복 라벨 (3개)
   src/components/evaluation/feedback360/feedback360-response-tag-pool.ts 에서
   같은 라벨이 여러 카테고리 improvement/positive에 등록된 케이스:
   - positive: '갈등을 완화하려고 해요'
   - improvement: '마감 관리를 더 안정적으로 하면 좋아요', '감정적 대응을 줄이면 좋아요'
   buildFeedback360ResponseTagsFromLabels() → getSelectedFeedback360ResponseTagLabels()
   파이프라인을 거치면 같은 label의 아이템이 2개 반환됨.
   개별 카드 표시 시 label 기준 dedupe 필수 (React key 충돌 및 중복 표시 방지).
   클러스터(집계)는 tone:category:label 키라 중복 카운트 의도적임 — 건드리지 말 것.

4. ★ 리뷰 카드 구조
   - 질문별(category) 섹션 그룹핑: 협업 / 업무 실행 / 성장 제안 (PR #141)
   - "종합"(RATING_SCALE)은 별점 분포 차트로 분리, 카드에서 제외
   - 카드 태그 소스: overallTagSummaries의 feedbackId → feedbackTagMap 매핑 (PR #140)
   - 카드 키: questionId:feedbackId (질문+평가자 고유)

5. ★ 두 영역 데이터 소스 구분
   - 태그 클러스터 / bar chart / 레이더: overallTagSummaries (evaluator별 overallComment 파싱, 라운드 집계)
   - 리뷰 상세 카드 (텍스트): groupedResponses (질문별 textValue)
   - 별점 분포: categoryScores.distribution (RATING_SCALE 응답 집계)
   이 세 소스를 혼동하지 말 것 — PR #136에서 textValue(태그 없음)→overallComment(태그 있음) 교체로 수정됨.

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
