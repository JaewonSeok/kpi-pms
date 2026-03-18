# KPI 기반 성과관리 및 성과평가 시스템 PRD

## 1. 문서 목적

이 문서는 현재 시스템의 visible route 중 비어 있거나 정의가 약한 페이지를 실제 구현 가능한 수준의 제품 문서로 정리한다.

대상 범위:
- KPI 관리
- 월간 실적
- 평가 결과 / 이의 신청 / 등급 조정
- 체크인
- 보상 시뮬레이션 / 보상 결과
- 알림 / 알림 운영
- 관리자 운영 설정

## 2. 제품 비전

이 시스템은 연간 KPI 설정으로 시작해 월간 실적과 체크인 데이터를 누적하고, 누적 데이터를 평가 결과와 보상 의사결정까지 연결하는 지속형 성과관리 SaaS다.

핵심 원칙:
- 조직 목표와 개인 목표의 상하위 연결
- 월간 실적과 체크인 데이터의 누적
- 평가 결과, 이의 신청, 등급 조정의 감사 가능성
- HR 운영 친화적 관리 화면
- 모바일에서도 입력, 확인, 승인 가능

## 3. 핵심 사용자

### 구성원
- 개인 KPI 설정
- 월간 실적 입력
- 평가 결과 / 보상 결과 확인
- 이의 신청

### 리더
- 팀원 KPI/실적 모니터링
- 체크인 진행
- 평가 코멘트 작성

### 관리자 / HR
- 조직도, 평가 주기, 등급, Google 계정, 알림 운영 관리
- 평가/보상 정책 운영

### 본부장 / CEO
- 등급 조정
- 보상 시나리오 검토 및 승인

## 4. 현재 visible route

- `/dashboard`
- `/kpi/org`
- `/kpi/personal`
- `/kpi/monthly`
- `/evaluation/assistant`
- `/evaluation/results`
- `/evaluation/appeal`
- `/evaluation/ceo-adjust`
- `/checkin`
- `/compensation/manage`
- `/compensation/my`
- `/notifications`
- `/admin/org-chart`
- `/admin/grades`
- `/admin/eval-cycle`
- `/admin/google-access`
- `/admin/notifications`
- `/admin/ops`

## 5. 우선순위 인벤토리

### P1
- 조직 KPI
- 개인 KPI
- 월간 실적
- 평가 결과
- 이의 신청
- 등급 조정
- 체크인 일정
- 시뮬레이션 관리
- 조직도 관리
- 평가 주기

### P2
- AI 보조 작성
- 내 보상 결과
- 알림
- 등급 설정
- Google 계정 등록
- 알림 운영

### P3
- 운영 / 관제

## 6. 페이지별 제품 정의

### 6.1 조직 KPI `/kpi/org`

- 목적: 조직 KPI 작성, 확정, cascade, 개인 KPI 연결 관리
- 사용자: 관리자, CEO, 본부장
- 핵심 데이터: 연도, 조직, KPI명, 정의, 산식, 목표값, 단위, 가중치, 난이도, 상태, 연결된 개인 KPI 수, 변경 이력
- 주요 액션: 생성, 복제, 제출, 확정, 잠금, 하위 조직 배포, 연결 현황 보기
- 필터: 연도, 조직 레벨, 부서, 상태, 연결 여부
- 탭: 목표 맵 / 목록 / 이력
- 검증: 부서+연도+KPI명 중복 금지, 상위 KPI 조직 유효성, 가중치 경고
- 상태: `DRAFT > SUBMITTED > CONFIRMED > LOCKED > ARCHIVED`
- 권한: Admin full, CEO confirm, 본부장은 scope 내 편집
- 성공 기준: 조직 KPI가 개인 KPI의 상위 기준과 상태 이력을 제공해야 함

### 6.2 개인 KPI `/kpi/personal`

- 목적: 개인 목표 설정, 조직 KPI 연결, 상사 검토
- 사용자: 구성원, 리더, 관리자
- 핵심 데이터: KPI명, 유형, 정의, 산식, 목표값, 단위, 가중치, 난이도, linked org KPI, 상태, 최근 달성률
- 주요 액션: 생성, AI 초안 생성, 임시저장, 제출, 수정, 검토 반려 대응
- 필터: 연도, 상태, KPI 유형, 연결 여부
- 탭: 내 KPI / 검토 대기 / 변경 이력
- 검증: 총 가중치 100, 정량 KPI 목표값, 정성 KPI 측정 기준
- 상태: `DRAFT > SUBMITTED > MANAGER_REVIEW > CONFIRMED > LOCKED`
- 권한: 본인 작성, 리더 검토, 관리자 override
- 성공 기준: KPI가 월간 실적과 평가의 기준 레코드가 되어야 함

### 6.3 월간 실적 `/kpi/monthly`

- 목적: KPI별 월간 실적, 정성 메모, 증빙 누적
- 사용자: 구성원, 리더, 관리자
- 핵심 데이터: yearMonth, KPI, actualValue, achievementRate, activities, obstacles, efforts, attachments, review comment, status
- 주요 액션: 월 선택, 임시저장, 제출, 이전월 복사, 첨부 업로드
- 필터: 연도, 월, 상태, KPI 유형
- 탭: 입력 / 누적 추이 / 피드백
- 검증: 마감 후 수정 제한, 숫자값 검증, 첨부 제한
- 상태: `NOT_STARTED > DRAFT > SUBMITTED > REVIEWED > LOCKED`
- 권한: 본인 입력, 리더 review, 관리자 unlock
- 성공 기준: 월간 실적이 평가 코멘트의 근거로 사용 가능해야 함

### 6.4 평가 결과 `/evaluation/results`

- 목적: 공개된 평가 결과와 근거를 조회
- 사용자: 구성원, 리더, 관리자, CEO
- 핵심 데이터: 주기, 단계별 점수, 최종등급, KPI별 점수, 평가자 코멘트, calibration 변경 여부, 공개일
- 주요 액션: 상세보기, PDF 저장, 이의 신청, 성장 계획 보기
- 필터: 연도, 주기, 조직
- 탭: 요약 / 세부 점수 / 이력 / 성장 계획
- 검증: 공개 전 접근 차단, scope 제한
- 상태: `HIDDEN > PUBLISHED > APPEAL_OPEN > APPEAL_CLOSED`
- 권한: 구성원 본인, 리더 scope, 관리자 전체, CEO 조직단위 summary
- 성공 기준: 결과와 근거, 후속 행동이 연결돼야 함

### 6.5 이의 신청 `/evaluation/appeal`

- 목적: 평가 결과에 대한 appeal 접수 및 처리
- 사용자: 구성원, HR, 관리자
- 핵심 데이터: 대상 평가, 신청 사유, 첨부, 상태, 담당자, 처리기한, 결정내용
- 주요 액션: 신규 신청, 임시저장, 제출, 철회, 보완자료 제출, 검토 결정
- 필터: 상태, 조직, 마감 여부
- 탭: 내 신청 / 검토함 / 정책 안내
- 검증: 기한 내 제출, 최소 사유 길이, 중복 신청 제한
- 상태: `DRAFT > SUBMITTED > UNDER_REVIEW > INFO_REQUESTED > RESOLVED > REJECTED > WITHDRAWN`
- 권한: 본인 작성, HR/관리자 review
- 성공 기준: 접수부터 결정까지 타임라인이 남아야 함

### 6.6 등급 조정 `/evaluation/ceo-adjust`

- 목적: 분포 편차를 보고 최종 등급을 calibration
- 사용자: CEO, 관리자, HR
- 핵심 데이터: 조직별 분포, 개인 원점수/현재등급/조정등급, 조정사유, 승인 로그
- 주요 액션: 필터링, 등급 변경, 사유 입력, 잠금
- 필터: 주기, 조직, 직군, 원등급
- 탭: 분포 / 대상자 / 조정 이력
- 검증: 사유 없이 변경 불가, 잠금 후 수정 제한
- 상태: `READY > CALIBRATING > REVIEW_CONFIRMED > FINAL_LOCKED`
- 권한: CEO final, 관리자 운영
- 성공 기준: 조정 전후 차이와 근거가 감사 가능해야 함

### 6.7 체크인 일정 `/checkin`

- 목적: 1:1 체크인 예약, 진행, 액션 follow-up
- 사용자: 구성원, 리더, 관리자
- 핵심 데이터: 유형, 대상자, 일정, 상태, 메모, 액션아이템
- 주요 액션: 예약, 일정변경, 완료 처리, 액션 생성/완료
- 필터: 상태, 기간, 대상자
- 탭: 캘린더 / 목록 / 실행항목
- 검증: 시간 충돌, 과거 일정 예약 제한
- 상태: `SCHEDULED > IN_PROGRESS > COMPLETED > CANCELLED > RESCHEDULED`
- 권한: owner/manager 양측
- 성공 기준: 체크인 기록이 성과관리 맥락으로 재활용돼야 함

### 6.8 시뮬레이션 관리 `/compensation/manage`

- 목적: 보상 rule table 관리, scenario versioning, 예산 검증, 승인
- 사용자: 관리자, 본부장, CEO
- 핵심 데이터: rule set, scenario version, budget, total cost, over budget amount, approval history, employee simulation rows
- 주요 액션: 규칙 저장, 시나리오 생성/복제, 재계산, submit, approve, reject, export, publish
- 필터: 연도, 평가 주기, 상태
- 탭: 규칙 / 시나리오 / 시뮬레이션 / 승인 이력
- 검증: 음수 지급률 금지, 예산 필수, publish 전 final approve
- 상태: `DRAFT > UNDER_REVIEW > REVIEW_APPROVED > FINAL_APPROVED > PUBLISHED`
- 권한: Admin edit, 본부장 review, CEO final
- 성공 기준: 규칙과 시나리오 승인 흐름이 한 화면에서 설명 가능해야 함

### 6.9 내 보상 결과 `/compensation/my`

- 목적: 공개된 개인 보상 결과와 산정 기준 제공
- 사용자: 구성원
- 핵심 데이터: 등급, 보상액, 인상액, 총보상, 공개일, 버전 정보
- 주요 액션: 상세 보기, 이력 확인, 결과 확인 완료, 문의
- 탭: 이번 결과 / 이력 / 산정 기준
- 상태: `NOT_PUBLISHED > PUBLISHED > ACKNOWLEDGED`
- 권한: 본인만
- 성공 기준: 수치와 산정 논리를 함께 이해할 수 있어야 함

### 6.10 알림 `/notifications`

- 목적: 업무 알림 수신함과 개인 선호 관리
- 사용자: 전체 사용자
- 핵심 데이터: 제목, 메시지, 유형, 채널, sentAt, isRead, deep link, priority
- 주요 액션: 읽음, 모두 읽음, deep link 이동, 선호 저장
- 탭: 받은 알림 / 할 일 / 설정
- 상태: `UNREAD > READ > ARCHIVED`
- 권한: 본인만
- 성공 기준: 알림이 action inbox 역할을 해야 함

### 6.11 조직도 관리 `/admin/org-chart`

- 목적: 조직 구조 업로드, 검증, 반영
- 사용자: 관리자, HR
- 핵심 데이터: 부서코드, 부서명, 상위부서, 리더, employee count, import status, error row
- 주요 액션: 업로드, 검증, 반영, 실패행 다운로드, 롤백
- 탭: 현재 조직도 / 업로드 / 이력
- 상태: `DRAFT_IMPORT > VALIDATED > APPLIED > ROLLED_BACK`
- 권한: admin only
- 성공 기준: 조직 변경 영향을 검증 후 안전하게 반영해야 함

### 6.12 등급 설정 `/admin/grades`

- 목적: 연도별 grade band와 권장 분포 관리
- 사용자: 관리자, HR
- 핵심 데이터: 연도, gradeName, score range, levelName, description, targetDistRate
- 주요 액션: 수정, 추가, 삭제, 복제, publish
- 탭: 등급 테이블 / 분포 가이드 / 이력
- 상태: `DRAFT > PUBLISHED > RETIRED`
- 권한: admin only
- 성공 기준: 정책 검증과 영향도가 함께 제시돼야 함

### 6.13 평가 주기 `/admin/eval-cycle`

- 목적: 평가 운영의 단계 일정과 공개/마감을 제어
- 사용자: 관리자, HR
- 핵심 데이터: cycleName, evalYear, status, 각 단계 일정, result open, appeal deadline
- 주요 액션: 생성, 수정, 복제, 공개, 마감, 잠금
- 탭: 주기 목록 / 일정 / 연결 영향
- 상태: `SETUP > KPI_SETTING > IN_PROGRESS > SELF_EVAL > FIRST_EVAL > SECOND_EVAL > FINAL_EVAL > CEO_ADJUST > RESULT_OPEN > APPEAL > CLOSED`
- 권한: admin only
- 성공 기준: 운영자가 캘린더 기준으로 전체 흐름을 제어할 수 있어야 함

### 6.14 Google 계정 등록 `/admin/google-access`

- 목적: 직원과 Google Workspace 로그인 계정 매핑 관리
- 사용자: 관리자, HR
- 핵심 데이터: 사번, 이름, 부서, 역할, 상태, gwsEmail, loginReady
- 주요 액션: 검색, 수정, 저장, 이슈 필터링, bulk validation
- 탭: 직원 매핑 / 이슈 / 이력
- 상태: `UNREGISTERED > REGISTERED > LOGIN_READY > BLOCKED`
- 권한: admin only
- 성공 기준: 로그인 준비 상태를 직원 단위로 관리 가능해야 함

### 6.15 알림 운영 `/admin/notifications`

- 목적: 템플릿, 발송 잡, dead letter 운영
- 사용자: 관리자, HR Ops
- 핵심 데이터: template, executions, queue, dead letters
- 주요 액션: 템플릿 저장, 잡 실행, 실패 분석, 재처리
- 탭: 템플릿 / 실행 이력 / 실패함 / 설정
- 상태: template `DRAFT/ACTIVE/PAUSED`, job `QUEUED/RUNNING/SUCCESS/FAILED/RETRIED/DEAD_LETTER`
- 권한: admin only
- 성공 기준: 운영자가 실패 원인과 복구 가능 여부를 즉시 파악할 수 있어야 함

### 6.16 운영 / 관제 `/admin/ops`

- 목적: 기술 운영과 업무 운영 리스크를 함께 모니터링
- 사용자: 관리자
- 핵심 데이터: env, flags, health checks, secrets, recent events, dead letters, AI fallback, over-budget scenarios
- 주요 액션: runbook 진입, 관련 운영 화면 drill-down
- 탭: 서비스 상태 / 업무 리스크 / 이벤트 로그
- 상태: `ok / warn / error`
- 권한: admin only
- 성공 기준: 기술 지표와 업무 지표가 연결돼 보여야 함

## 7. 공통 UX 규칙

- 모든 페이지는 연도, 주기, 조직 범위를 명시한다.
- 상태가 있는 페이지는 공통 status badge와 timeline을 사용한다.
- 구성원 화면은 `내가 해야 할 행동`, 관리자 화면은 `운영 리스크`를 우선 노출한다.
- KPI, 체크인, 평가, 보상은 drill-down 링크를 제공한다.
- 모든 페이지는 Empty / Loading / Error / Permission state를 명시한다.

## 8. 현재 데이터/엔티티 기준

주요 Prisma 모델:
- KPI: `OrgKpi`, `PersonalKpi`, `MonthlyRecord`
- Evaluation: `EvalCycle`, `Evaluation`, `EvaluationItem`, `Appeal`
- Compensation: `CompensationRuleSet`, `CompensationRule`, `CompensationScenario`, `CompensationScenarioEmployee`, `CompensationApproval`
- Ops: `Department`, `Employee`, `Notification`, `NotificationTemplate`, `NotificationPreference`, `NotificationJob`, `NotificationDeadLetter`, `JobExecution`, `AuditLog`

## 9. 구현 우선순위

### Phase 1
- 평가 주기
- 조직 KPI
- 개인 KPI workflow
- 월간 실적 review/evidence
- 조직도 관리

### Phase 2
- 평가 결과
- 이의 신청
- 등급 조정
- 체크인 일정 강화

### Phase 3
- 시뮬레이션 관리 고도화
- 내 보상 결과 설명 UX
- 등급 설정 영향도

### Phase 4
- 알림
- Google 계정 등록
- 알림 운영
- AI 보조 작성 운영 로그

### Phase 5
- 운영 / 관제

