# CLAUDE.md — KPI-PMS 프로젝트 컨텍스트

> 이 파일은 새 Claude Code 세션이 시작될 때 자동으로 참조됨.
> 사용자는 ChatGPT 기반 **바이브 코딩(Vibe Coding)** 스타일로 이 프로젝트를 만들어왔고,
> 같은 호흡(빠른 반복, 작은 변경, 한국어 설명)으로 이어가는 것이 목표.
> 마지막 갱신: 2026-05-11

---

## 1. 프로젝트 개요

- **이름**: KPI-PMS (성과관리 및 평가시스템)
- **한 줄 설명**: Next.js 16 + Prisma 7 + PostgreSQL 기반의 사내(Rsupport) 통합 성과관리 플랫폼
- **목적**: 조직/개인 KPI 설정 → 월별 실적 누적 → 다단계 평가(자기/1차/2차/최종/CEO 조정) → 360 피드백/AI 역량평가 → 보상 시뮬레이션까지를 한 시스템에서 처리
- **대상 사용자**: 일반 팀원, 팀장/실장/본부장, CEO, HR 관리자(ROLE_ADMIN)

---

## 2. 기술 스택

| 영역 | 스택 |
|---|---|
| Frontend | Next.js 16.1.6 (App Router, Turbopack), React 19.2, TypeScript strict |
| UI | TailwindCSS 4 (PostCSS 방식), Radix UI, lucide-react, Recharts 3 |
| 상태 | TanStack Query v5, React Hook Form, Zod 4 |
| Backend | Next.js Route Handlers (서버 사이드만 쓰기 경로 허용) |
| DB | PostgreSQL 16 + Prisma 7.4 (`@prisma/adapter-pg` 필수) |
| Auth | NextAuth 4.24 — Google OAuth + CredentialsProvider(관리자 fallback) |
| AI | OpenAI Responses API (`OPENAI_MODEL=gpt-5-mini`), structured output 스키마 |
| 메일 | nodemailer + SMTP |
| 패키지 매니저 | **pnpm 10.17.1** (npm/yarn 금지) |
| 배포 | Docker (`Dockerfile`, `docker-compose.prod.yml`), Vercel(`.vercel/`) |

---

## 3. 디렉토리 구조

```
kpi-pms/
├── prisma/
│   ├── schema.prisma           # ~100개 모델, 2971줄. 도메인 정의의 진실
│   ├── migrations/             # 5개 마이그레이션 (upward review, eval assignments 등)
│   └── seed.ts                 # 시드 데이터 (ALLOWED_DOMAIN 기준으로 이메일 생성)
├── src/
│   ├── app/
│   │   ├── (main)/             # 인증 필수 페이지 그룹 (MainShell 레이아웃)
│   │   │   ├── dashboard/      # 역할별 대시보드
│   │   │   ├── kpi/            # personal / org / monthly
│   │   │   ├── evaluation/     # performance / 360 / upward / ai-competency / appeal / ceo-adjust / workbench / word-cloud-360 / calibration
│   │   │   ├── checkin/        # 중간 점검 (mid-review)
│   │   │   ├── compensation/   # my / manage
│   │   │   ├── statistics/     # 통계 대시보드
│   │   │   ├── notifications/  # 알림 센터
│   │   │   └── admin/          # eval-cycle / grades / org-chart / goal-alignment / google-access / performance-design / performance-assignments / performance-calendar / notifications / ops
│   │   ├── api/                # 121+ 엔드포인트. 도메인별 폴더 (admin, ai, appeals, auth, checkin, compensation, cron, development-plans, employees, evaluation, feedback, health, kpi, mid-review, notifications, ops)
│   │   ├── login/  403/  access-pending/  solutions/
│   ├── lib/                    # 87개 공용 유틸: auth, ai, kpi 계산, 피드백, 보상, 검증, 알림
│   │   └── auth/               # permissions.ts, session.ts (RBAC 메뉴 매트릭스)
│   ├── server/                 # 60개 서버 사이드 데이터 로딩/워크플로 (페이지 로더 패턴)
│   │   ├── ai/                 # 9개. AI 어시스트 서버 함수
│   │   └── auth/               # authorize, org-scope, protected-page
│   ├── components/             # 16개 도메인 폴더로 분리 (admin/checkin/common/compensation/dashboard/evaluation/kpi/layout/marketing/mid-review/notifications/ops/pwa/security/statistics)
│   ├── types/auth.ts           # AuthRole, SessionUserClaims 등 공통 타입
│   ├── modules/                # README만 존재 (계획됐으나 미사용)
│   └── middleware.ts           # 전역 인증/권한 체크 (Next 16 deprecated, proxy 전환 예정)
├── tests/                      # 112개 ts-node 기반 테스트 (Vitest/Jest 없음, 자체 러너)
├── scripts/                    # close-cycle, create-admins, promote-admins, register-google-email, repair-performance-design-korean
├── docs/
│   ├── operations/             # working-rules, current-handoff, runbook, deployment, RBAC matrix
│   └── product/                # PRD, 백로그, 글로벌 벤치마크 갭 분석, 와이어프레임
├── public/                     # 아이콘, manifest, sw.js (PWA)
├── package.json                # pnpm@10, 30+ test 스크립트
├── prisma.config.ts            # Prisma 7 — datasource URL은 여기서 관리
├── next.config.ts              # standalone 출력, auth 경로 no-store 헤더
├── docker-compose.yml          # 로컬 Postgres 16 (포트 5433)
└── .env.example                # 모든 환경변수 샘플
```

---

## 4. 주요 명령어

```bash
# 패키지 매니저는 반드시 pnpm
pnpm install
pnpm dev                # 개발 서버 (http://localhost:3000)
pnpm build              # prisma generate + next build
pnpm lint
pnpm typecheck

# DB (PostgreSQL 5433 포트 주의 — 5432 아님)
docker compose up -d    # 로컬 Postgres 기동
pnpm run db:generate
pnpm run db:push        # 스키마 강제 적용 (개발용)
pnpm run db:seed        # tsconfig.seed.json 으로 Windows JSON 파싱 우회
pnpm run db:studio
pnpm run db:reset       # ⚠️ 초기화

# 테스트 (영역별)
pnpm test               # 전체
pnpm test:auth
pnpm test:evaluation-workbench
pnpm test:feedback360
pnpm test:ai-competency
pnpm test:calibration-ops
# ... package.json 참고 (30개 이상)

# 관리자 유틸
pnpm run register:google-email -- --emp-id=EMP-2022-002 --email=admin@rsupport.com
```

---

## 5. 도메인 모델 (핵심 엔티티)

전체 모델 ~100개. 카테고리별로 묶으면:

### 조직/인사
- `Organization` ─< `Department` (parent-child 계층) ─< `Employee`
- `Employee.position`: `MEMBER | TEAM_LEADER | SECTION_CHIEF | DIV_HEAD | CEO`
- `Employee.role` (`SystemRole`): `ROLE_MEMBER / ROLE_TEAM_LEADER / ROLE_SECTION_CHIEF / ROLE_DIV_HEAD / ROLE_CEO / ROLE_ADMIN`
- `Employee.status`: `ACTIVE | INACTIVE | ON_LEAVE | RESIGNED` — 로그인은 `ACTIVE`만 허용
- 관리 체인 4중: `managerId / teamLeaderId / sectionChiefId / divisionHeadId`

### KPI
- `OrgKpi`: 조직 KPI. `parentOrgKpiId`로 정렬, `copiedFromOrgKpiId`로 복제 추적. `targetValueT/E/S` 3단 목표
- `PersonalKpi`: 개인 KPI. `OrgKpi`와 연결
- `MonthlyRecord`: 월별 실적 (달성률 자동 계산)
- `BusinessPlanDocument`, `JobDescriptionDocument`: AI 추천의 입력 컨텍스트
- `TeamKpiRecommendationSet/Item`, `TeamKpiReviewRun/Item`: AI 기반 팀 KPI 추천/검토 (preview-first 패턴)

### 평가 워크플로
- `EvalCycle`: 평가 사이클 (연/반기/분기, status: `CycleStatus`)
- `Evaluation` + `EvaluationItem`: 평가 본문 + KPI별 점수
- `EvaluationAssignment`: 평가자-피평가자 자동/수동 배정
- **`EvalStage`**: `SELF → FIRST → SECOND → FINAL → CEO_ADJUST`
- **`EvalStatus`**: `PENDING → IN_PROGRESS → SUBMITTED → CONFIRMED` (또는 `REJECTED`로 반려)
- `Appeal`: 이의 신청

### 360 피드백 & 워드클라우드
- `MultiFeedbackRound` ─< `MultiFeedback` ─< `FeedbackResponse`
- `FeedbackNomination`: 피평가자 추천 (4단계: TARGET → REVIEWER → SUBMITTER → APPROVER)
- `UpwardReviewTemplate/Question`: 상향 피드백 템플릿
- `WordCloud360Cycle/Keyword/Assignment/Response`: 360 키워드 분석
- `FeedbackReportCache`: 리포트 캐시

### 체크인 / 중간 리뷰
- `CheckIn`: 수시 1:1 체크인 (`CheckInType`, 번아웃/리텐션 리스크 신호)
- `MidReviewCycle ─< MidReviewAssignment ─< MidReviewRecord` (`GoalReview`, `PeopleReview`, `ActionItem`)

### AI 역량평가 (대규모 서브도메인)
- 1차 시험: `AiCompetencyCycle`, `Question`, `Attempt`, `ExamBlueprint`, `GeneratedExamSet`, `Answer`
- 2차 제출: `SecondRoundSubmission`, `Artifact`, `SubmissionReview`, `ReviewRubric`
- 외부 인증: `ExternalCertMaster`, `ExternalCertClaim`
- 결과: `AiCompetencyResult` + grade (`S/A/B/C/D`)
- 게이트 시스템: `GateCycle / GateCase / GateMetric / GateProjectDetail / GateAdoptionDetail / GateEvidence / GateReview*` (별도 워크플로)

### 보상
- `CompensationRuleSet ─< CompensationRule` (연도별 등급→보상 규칙)
- `CompensationScenario ─< ScenarioEmployee`, `CompensationApproval`

### 알림 / 운영
- `Notification`, `NotificationTemplate`, `NotificationPreference`, `NotificationJob`, `NotificationAttempt`, `NotificationDeadLetter`
- `AuditLog`, `ImpersonationSession`, `JobExecution`, `AiRequestLog`, `OperationalEvent`, `UploadHistory`

### NextAuth
- `Account`, `Session`, `VerificationToken`

---

## 6. 핵심 비즈니스 로직 위치

| 무엇 | 어디 |
|---|---|
| KPI 달성률 | [src/lib/utils.ts:73](src/lib/utils.ts#L73) `calcAchievementRate(actual, target)` |
| PDCA 점수 (P30·D40·C20·A10) | [src/lib/utils.ts:78](src/lib/utils.ts#L78) `calcPdcaScore` |
| 가중치 적용 점수 | [src/lib/utils.ts:87](src/lib/utils.ts#L87) `calcWeightedScore` |
| 평가 가중평균 | [src/server/evaluation-results-scoring.ts:6](src/server/evaluation-results-scoring.ts#L6) `weightedAverage` |
| 성과+역량 최종점수 | [src/server/evaluation-results-scoring.ts:30](src/server/evaluation-results-scoring.ts#L30) `calculateEffectiveTotalScore` |
| AI 역량 최종점수 | [src/lib/ai-competency-scoring.ts:22](src/lib/ai-competency-scoring.ts#L22) `calculateAiCompetencyFinalScore` |
| AI 역량 등급 (S/A/B/C/D) | [src/lib/ai-competency-scoring.ts:37](src/lib/ai-competency-scoring.ts#L37) `calculateAiCompetencyGrade` |
| 피드백 점수 정규화 | [src/lib/feedback-score.ts:3](src/lib/feedback-score.ts#L3) `calculateFeedbackResponseTotalScore` |
| 보상 시뮬레이션 | [src/lib/compensation.ts:115](src/lib/compensation.ts#L115) `simulateCompensationScenario` |
| CEO 최종 조정 판정 | [src/lib/evaluation-ceo-final.ts:19](src/lib/evaluation-ceo-final.ts#L19) `isCeoFinalGradeAdjusted` |
| 평가 보정(Calibration) | [src/server/evaluation-calibration.ts](src/server/evaluation-calibration.ts) |
| 성과지표 매트릭스 | [src/lib/performance-design.ts:699](src/lib/performance-design.ts#L699) |
| NextAuth 설정 진입점 | [src/lib/auth.ts:561](src/lib/auth.ts#L561) (providers), [:668](src/lib/auth.ts#L668) (JWT), [:936](src/lib/auth.ts#L936) (session) |
| 메뉴 RBAC 매트릭스 | [src/lib/auth/permissions.ts](src/lib/auth/permissions.ts) `canAccessMenu`, `resolveMenuFromPath` |
| 전역 미들웨어 | [src/middleware.ts](src/middleware.ts) — 세션 토큰 + 메뉴 권한 + 트레이스 로그 |

---

## 7. 코딩 컨벤션

### 언어 규칙 (`docs/operations/working-rules.md` 기준)
- **UI 표시 문구**: 한국어
- **코드 / 주석 / 테스트 / 변수명**: 영어 (camelCase)
- **DB 컬럼**: camelCase + `@@map("snake_case")` 매핑
- **에러 메시지**: 사용자용은 한국어, 로그는 영어

### 스타일
- Prettier: `semi: false`, `singleQuote: true`, `trailingComma: 'es5'`
- ESLint: `eslint-config-next` + `no-explicit-any: warn`, `prefer-const: warn`
- TS: `strict: true`, path alias `@/* → ./src/*`
- 들여쓰기: 2 space, LF, UTF-8 (`.editorconfig`)

### 패턴
- **쓰기 경로는 반드시 서버 사이드** (route handler 또는 server action)
- **모든 요청 바디는 Zod로 검증** (`.errors`가 아니라 `.issues` — Zod 4.x)
- **감사 로그**: 모든 주요 변경은 `AuditLog`에 기록 (`createAuditLog` 헬퍼)
- **워크플로 API 패턴**: `POST /api/.../[id]/workflow` 로 상태 전이
- **AI 호출은 서버에서만**, `AiRequestLog` 저장, **PII(이름/이메일/사번)는 절대 외부 전송 금지**
- **AI는 preview-first + approval-based**: 결과를 UI에 보여주고 사용자 승인 시에만 반영
- **Next.js 16 동적 라우트**: `params: Promise<{ id: string }>` 후 `const { id } = await params`

### 금기 사항
- npm/yarn 사용 금지 (pnpm 전용)
- `AUTH_GOOGLE_ID/SECRET` 같은 별칭 변수 금지 — `GOOGLE_CLIENT_ID/SECRET`만
- `git push --force`, `prisma migrate reset` 사용 시 반드시 사용자 확인
- AI 폴백이 없으면 안 됨 — AI 장애 시 UI가 멈추면 안 됨 (graceful fallback)

---

## 8. 현재 진행 상태

### 완성
- 인증 (Google OAuth + 관리자 fallback, master-login, access-pending 흐름)
- 조직도 업로드 + RBAC 미들웨어
- 등급 설정, 평가 사이클 CRUD
- 개인/조직 KPI (계층 division/section/team, AI 추천 워크스페이스 포함)
- 월별 실적 입력 (달성률 자동 계산)
- 5단계 평가 워크플로 (SELF → FIRST → SECOND → FINAL → CEO_ADJUST)
- Calibration Session Setup (CEO 등급조정)
- 360 피드백 + 상향 피드백 + 워드클라우드 360
- AI 역량평가 (1차 시험 + 2차 제출 + 외부 인증 + 게이트 시스템)
- 수시 체크인 + 중간 리뷰 (Mid-review)
- 보상 시나리오 시뮬레이션
- 알림 시스템 (템플릿, 선호도, 큐, 데드레터)
- 감사 로그, AI 요청 로그, 운영 메트릭, 헬스체크

### 작업 중 / QA 대기
- 조직 KPI division/section/team 필터 검증
- 권한 매트릭스 수동 QA (admin/div_head/section_chief/team_leader/member)
- 마스터 로그인/임퍼소네이션 배너 검증

### 미구현 또는 구현 미확인
- 평가 캘린더 UI (관리자 페이지는 존재)
- 다면평가 피드백 입력 UI 일부 (응답 페이지는 있음)
- 일부 대시보드 차트 (Recharts)
- KPI Excel 일괄 업로드 UI (API는 있음)
- 일부 페이지의 리포트 PDF 출력 마무리

---

## 9. 알려진 이슈 & TODO

- **middleware.ts 경고**: Next 16에서 `middleware` 파일명이 deprecated → 향후 `proxy.ts`로 변경 필요 (현재 동작은 정상)
- **MEMORY.md (auto-memory) 일부 정보가 오래됨**: "Phase 1 완료" 수준으로 적혀있으나 실제론 AI 역량평가/360/보상까지 들어가 있음 — 메모리는 참고용, **진실의 원천은 코드/스키마**
- **임시 파일이 루트에 다수**: `tmp-session*.pdf/png`, `..kpi-pms.zip`, `.tmp_lx_report.txt` — 정리 여부 사용자 확인 필요
- **루트에 오타 파일**: [scriptspromote-admins.ts](scriptspromote-admins.ts) — 실제 스크립트는 [scripts/promote-admins.ts](scripts/promote-admins.ts) (확인 필요)
- **DATABASE_URL 포트 5433** (5432 아님) — Docker compose가 5432→5433 매핑
- **pnpm-workspace.yaml** 존재 — 단일 패키지인데 workspace 설정. 의도 확인 필요
- **테스트 러너가 ts-node 직접 실행** — Vitest/Jest 아님. 새 테스트 추가 시 동일 패턴 유지
- **PII 누설 위험**: AI 프롬프트 작성 시 직원명/이메일/사번 절대 포함 금지

---

## 10. 바이브 코딩 협업 규칙 ⭐

### 사용자 스타일
- ChatGPT로 빠르게 만들어온 프로젝트. **빠른 반복 > 거창한 설계서**
- 한국어로 대화. 코드 주석은 영어가 컨벤션이지만 설명·커밋 메시지는 한국어 OK
- 변경 전 큰 계획서 X. 작은 단위로 만들고 보여주기 O
- "지금 동작하는 것" 우선. 미래의 가능성을 위한 추상화 금지

### 답변 톤
- 짧고 직접적. 헤더/섹션 남발 X. 변경 요약은 1~2줄
- 파일 참조는 `[파일명:라인](src/path#L42)` markdown 링크 형태
- 어떤 도구를 호출하기 직전 한 줄로 "뭘 할 건지" 알려주기
- 끝맺음은 한두 문장: 무엇이 바뀌었고 다음 뭘 할지

### 작업 흐름
- 새 기능 → 작은 vertical slice (DB 모델 → API → UI 한 페이지 → 테스트)
- 거대한 리팩토링은 사용자가 명시적으로 요청할 때만
- 위험한 작업 (`db:reset`, `git push --force`, 파일 대량 삭제) 전엔 무조건 확인
- 막히면 빨리 보고. 추측으로 채우지 말고 "확인 필요"로 남기기
- 작업 후 검증: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 중 관련된 것

### 메모리 활용
- `~/.claude/.../memory/MEMORY.md`에 사용자 선호/프로젝트 컨텍스트가 누적되고 있음
- 새로운 결정 사항·피드백·금기는 메모리에 저장
- 단, 메모리가 코드와 충돌하면 **현재 코드/스키마가 진실**
