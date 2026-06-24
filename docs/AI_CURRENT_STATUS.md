# AI Current Status

Last updated: 2026-06-24

## Repository State

- Current branch: `main`
- HEAD: `9274294` — `Merge pull request #128 from JaewonSeok/fix/leadership-result-category-dedupe`
- Previous handoff baseline: `631f432` (2026-06-05, PR #74)
- **45개 PR이 631f432 이후 main에 머지됨** (PR #84 ~ #128)

Production: `https://kpi-pms.vercel.app` — Vercel 배포 상태는 실행 전 반드시 확인.

## Recent PR Summary (631f432 → 9274294, PR #84–#128)

### 2026 평가 관련
| PR | 브랜치 | 내용 |
|---|---|---|
| #88 | feature/2026-evaluation-process-preview-guide | 평가 프로세스 Preview 가이드 |
| #89 | feat/preview-2026-grade | Preview 2026 등급 admin 메뉴·라우트 |
| #90 | feat/preview-2026-grade-ui-polish | Preview 등급 UI polish |
| #84 | feature/2026-mbo-opening-mvp-polish | MBO 오프닝 MVP polish |

### 보상·정리
| PR | 브랜치 | 내용 |
|---|---|---|
| #126 | chore/remove-compensation | **보상(Compensation) 모듈 코드 전면 제거** |
| #120 | chore/remove-evaluation-workbench-legacy | 레거시 workbench 제거 |
| #121 | chore/remove-unused-promote-admins-script | 미사용 스크립트 제거 |
| #110 | refactor/evaluation-workbench-split | workbench 클라이언트 분리 |

### 360 피드백·Leadership Diagnosis
| PR | 브랜치 | 내용 |
|---|---|---|
| #111–#115 | feature/360-* | 360 PPT·운영매핑·알림·평가자매핑·AI코칭 인사이트 |
| #127 | fix/feedback-360-cache-auto-refresh | **360 보고서 캐시 제출 시 자동 재생성** |
| #122–#124, #128 | feature/leadership-diagnosis-* | Leadership Diagnosis PPT/Ops/AI코칭/카테고리 dedupe |

### UIUX 재설계 (PR #97–#107)
월별 입력·org-kpi·personal-kpi·performance workbench·member/leader/executive/hr-ops·AI 제출 PPT 워크스페이스 전면 재설계 완료.

### 기타
fix/upward-round-save-invalid-date (#108/109), fix/personal-kpi-tab-and-guide (#91),
fix/notifications-unread-query (#101), fix/org-kpi-hidden-children-inline (#125), 기타 fix 12건.

## Production Data State (2026-06-24 교정 완료)

### Position 분포 (289명 전원 교정)
| position | 인원 |
|---|---|
| MEMBER | 233 |
| TEAM_LEADER | 42 |
| SECTION_CHIEF | 7 |
| DIV_HEAD | 7 |
| **계** | **289** |

이전 상태("전원 MEMBER") 오기입은 교정 완료. `resolveRoleGroup2026` 실데이터 정상 작동 보장.

### 부서 구조 (교정 완료)
- 부서 수: 75개 → **63개** (고아 중복 12개 삭제)
- deptName 중복: 0 (해소)
- 영업 1·2본부: level TEAM → **SECTION** 교정 완료
- 단독 6팀(자금팀·내부통제팀·법무팀·영업운영기획팀·중국사업팀·UX기획팀): 정상, 교정 대상 아님

### 360 보고서 캐시
- 이전: STALE, 수동 재생성 필요
- 현재: **제출(`POST /api/feedback`)시 자동 재생성** (PR #127, `persistFeedback360Report` 자동 호출)

## Compensation Module — 코드 제거됨 (PR #126)

- 보상 관련 코드(라우트·컴포넌트·서버 로직) **전면 제거**됨.
- DB 테이블 5개는 스키마에 유지(삭제 미결정).
- `schema.prisma` 모델은 보존 상태.
- 보상 관련 기능 일체 없음 — 문서·코드에서 보상 기능 참조 금지.

## 2026 평가정책 엔진 진행 상태

### Preview 2026 등급 (production 배포됨)
- 페이지: `/admin/preview-2026-grade`
- 엔진: `src/lib/preview-2026-organization-score.ts` — `calculateOrganizationPerformanceFromIntake2026()`
- intake(수기 입력) 기반. production 라우트와 코드 공유 없음. 테스트 완비.

### Production Scoring 엔진 (dormant)
- `src/server/evaluation-scoring-2026.ts`
  - `calculateOrganizationPerformanceScore2026()` — EvaluationItem 배열 기반 조직점수
  - `calculatePersonalPerformanceScore2026()` — 개인점수
  - `calculateFinalPerformanceScore2026()` — 30:70 합산
  - `calculateEvaluationScore2026()` — 통합 진입점 (세 함수 모두 호출, **구현 완료**)
- **submit/draft 라우트 미연결** — 현재 라우트는 `applyBelowTargetExceptionForPersistence2026`만 사용

### Dormant 플래그 현황 (2026-06-24 확인)
```
evaluation-policy-2026.ts:
  adjustmentRule.active           = false   ← dormant
  adjustmentRule[두 번째].active  = false   ← dormant
  weightRule.enforced             = false   ← dormant
  belowTargetExceptionRule.active = false   ← wiring 완료, gate=false (flip 한 번으로 즉시 활성화 가능)
  dailyWorkScoringRule.active     = false   ← dormant
  finalScoreFormula.active        = false   ← dormant
```

## 다음 본 작업 (우선순위)

### 1순위: M1-B wiring — 30:70 finalScoreFormula submit 라우트 연결
`calculateEvaluationScore2026()`이 완성돼 있으나 submit/draft 라우트가 연결 안 됨.
**⚠️ 경고: production 평가 점수 계산 방식을 바꾸는 작업.
반드시 shadow 검증(read-only 시뮬레이션으로 30:70 적용 시 점수 변화 확인) 먼저.**
shadow 결과 승인 후 라우트 연결 + `finalScoreFormula.active = true` flip.

### 2순위: belowTargetExceptionRule flip
wiring 완료 상태. `active = true` flip 하나로 즉시 활성화 가능. shadow 검증 선행.

### 3순위: M1-D Preview→production intake 저장 모델
Preview 엔진과 production scoring 엔진이 별개 코드라 통합에 더 큰 설계 작업 필요.

## 잔여 정리 과제 (다음 사이클)

- 워크트리 16개(`C:/tmp/kpi-pms-*` 등) — `git worktree remove` 필요
- `fix/upward-round-save-invalid-date`: ahead 30 확인 (미푸시 커밋 여부)
- `feature/koreanize-user-facing-copy-final-pass`: CRLF 연관 확인 후 정리
- `feature/ceo-demo-mode`: WIP, origin 백업됨 (로컬 유지)
- DB 보상 테이블 5개 삭제 여부 결정

## 불변 운영 규칙

- 패키지 매니저: `pnpm` (npm/yarn 금지)
- DB 포트: PostgreSQL 5433 (로컬 Docker), Supabase production 5432
- 코드·주석·테스트: 영어. UI 문구: 한국어.
- write path: route handler 또는 server-side. Request body: Zod 검증.
- OpenAI: 서버 사이드, PII 미전달, preview-first.
- 평가 점수·등급 write는 high-risk — shadow 검증 선행 필수.
