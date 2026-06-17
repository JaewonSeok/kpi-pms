# 주요 화면별 UI/UX 개편 계획

Last updated: 2026-06-17

## 1. 목적

이 문서는 주요 route별로 현재 문제, 개편 후 화면 구조, 역할별 노출 기준, 시각화 요소, 우선순위를 정리한다. 구현은 별도 PR에서 단계적으로 진행하며, 이 문서는 기능 구현이 아니라 설계 기준이다.

우선순위 기준:

- P0: 7/1 MBO/KPI 오픈 또는 안전 경계를 막는 문제
- P1: 실사용/CEO demo에서 혼동을 줄이는 문제
- P2: polish 또는 이후 확장

## 2. 공통 화면 구조 기준

| 영역 | 개편 기준 |
| --- | --- |
| 상단 | 큰 hero 대신 `현재 상태`, `다음 행동`, `마감`, `진행률` compact summary |
| 본문 | 사용자가 처리할 list/table/card를 중앙에 배치 |
| 우측/하단 | 긴 패널은 접기, 요약 card, sticky summary로 축소 |
| CTA | 1차 CTA 1개, 보조 CTA 1~2개, 위험 CTA는 고급/확인 영역 |
| Empty state | 빈 화면은 `왜 비었는지`, `다음에 할 일`, `문의 대상`을 표시 |
| 상태칩 | 평가 상태, 기간 상태, 권한 상태를 텍스트+색상으로 표시 |
| AI | 작성 보조, 코칭, 요약, AI 활용 제출을 다른 label로 분리 |

## 3. Route별 개편 계획

### `/kpi/org`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 상단 볼륨이 크고 우측 패널이 길며, 조직 KPI와 개인 KPI 연결 맥락이 약하다. |
| 개편 후 구조 | `조직/기간/상태 summary` -> `조직 KPI 목록` -> `연결 현황/검토 이력 접기 패널`. |
| 유지할 기능 | 조직 KPI 조회/작성/검토, HR 반영/제외, 조직 hierarchy context. |
| 숨기거나 접을 기능 | 목표 일괄 수정은 제거 방향. 세부 정책 설명, 긴 이력, 고급 filter는 접기. |
| 역할별 노출 | 팀장은 팀 KPI, 실장은 실/하위 팀, 본부장은 본부/실/팀 overview, HR은 전체 관리. |
| 시각화 | hierarchy breadcrumb, level chip, reflection status chip, 연결 개인 KPI count. |
| Empty/CTA | KPI 없음: `조직 KPI 등록 요청` 또는 `상위 KPI 확인` 안내. |
| 우선순위 | P1 |

### `/kpi/personal`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 작성, 검토, AI 보조, 정책 안내가 한 화면에 밀집될 수 있다. 영업/비영업 맥락이 부족하다. |
| 개편 후 구조 | `내 상태 summary` -> `내 KPI/MBO 목록` -> `작성/수정 drawer` -> `검토 tab`. |
| 유지할 기능 | KPI 생성/수정, T/E/S 목표, 가중치, policyCategory, 조직 KPI 연결, 제출/검토, AI 보조. |
| 숨기거나 접을 기능 | 태그, 보조 메모, 긴 정책 설명은 고급 영역. 리더 전용 AI는 구성원에게 숨김. |
| 역할별 노출 | USER는 본인 KPI와 월간 연결, 리더는 review queue와 팀원 detail, HR은 운영 확인. |
| 시각화 | 남은 가중치 progress, policyCategory chip, status chip, 영업/비영업 guide card. |
| Empty/CTA | 아직 KPI 없음: `KPI 추가`와 `상위 조직 KPI 먼저 확인`을 함께 제공. |
| 우선순위 | P1. 현재 실사용 중 큰 문제는 없으므로 실제 오류 기반으로 수정한다. |

### `/kpi/monthly`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 매월 너무 상세히 쓰는 느낌이 들 수 있고, AI action의 역할 구분이 중요하다. |
| 개편 후 구조 | `이번 달 상태` -> `KPI별 간단 입력` -> `증빙 링크/코멘트` -> `리더 점검 영역`. |
| 유지할 기능 | 월간 실적, 증빙, 코멘트, 링크 metadata, AI 요약/회고/체크인 보조. |
| 숨기거나 접을 기능 | 리더 리뷰 AI와 평가 근거 초안은 직책자만. 상세 이력은 접기. |
| 역할별 노출 | USER는 본인 월간 실적, 리더는 관리 범위 팀원 review/coaching. |
| 시각화 | month chips, 입력 완료율, evidence count, 위험 KPI icon. |
| Empty/CTA | 이번 달 기록 없음: `간단히 진행 요약 작성` 안내. |
| 우선순위 | P1 |

### `/evaluation/performance`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | HR dashboard, process guide, workbench preview 성격이 함께 있어 메시지 우선순위가 중요하다. |
| 개편 후 구조 | `오늘의 운영 상태` -> `P0 blocker` -> `평가 흐름 preview` -> `관련 작업 링크`. |
| 유지할 기능 | HR 운영 요약, readiness navigation, workbench/readiness/ops 진입. |
| 숨기거나 접을 기능 | 고급 official transition 링크, 내부 진단 세부는 접기. |
| 역할별 노출 | HR은 전체 운영, 리더는 본인 관리 범위 진행률, 구성원은 개인 상태 summary 중심. |
| 시각화 | MBO missing, confirmed KPI shortage, blocker trend, process stepper. |
| Empty/CTA | 데이터 없음: `대상 주기 선택 필요` 또는 `HR 설정 필요` 안내. |
| 우선순위 | P1 |

### `/evaluation/workbench`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | preview, score, grade, CEO/final 흐름이 강력하지만 official write와 혼동되면 위험하다. |
| 개편 후 구조 | `preview-only banner` -> `평가 단계 timeline` -> `대상/KPI table` -> `score/grade preview`. |
| 유지할 기능 | 수행결과, self/first/second/final/CEO preview, score/grade preview, official guard. |
| 숨기거나 접을 기능 | 내부 계산 상세, official transition 상태는 고급 설명으로 접기. |
| 역할별 노출 | 구성원은 자기 평가 preview, 리더는 팀원 평가 preview, HR은 전체 flow 검수. |
| 시각화 | evaluation stepper, score contribution bars, grade threshold preview. |
| Empty/CTA | 평가 대상 없음: `공식 population 전 preview 화면` 안내. |
| 우선순위 | P1 |

### `/evaluation/ai-competency`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | `AI 역량평가`라는 제목이 연간 평가점수 반영처럼 보일 수 있다. |
| 개편 후 구조 | `AI 활용 제출` 또는 `AI 활용 실적` 제목 -> `제출 경로 3가지` -> `2028 Pass/Fail 안내`. |
| 유지할 기능 | AI project T/K, 조직 기여 AI 사례, AI 실무 인증 evidence. |
| 숨기거나 접을 기능 | 연간 평가점수와 연결되는 듯한 표현. |
| 역할별 노출 | USER는 본인 제출, HR은 제출 현황/검토. |
| 시각화 | path cards, 제출 상태 chip, 2028 timeline. |
| Empty/CTA | 제출 없음: `AI 활용 사례 준비` 안내. |
| 우선순위 | P1 |

### `/upward/respond` 또는 `/evaluation/upward/respond`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | route 명과 실제 App Router path가 다를 수 있다. 응답자의 해야 할 일이 먼저 보여야 한다. |
| 개편 후 구조 | `내 응답 대상` -> `남은 문항/마감` -> `응답 form` -> `제출 전 확인`. |
| 유지할 기능 | 다면/상향 응답, 익명성 안내, 제출 상태. |
| 숨기거나 접을 기능 | HR 운영 세부, 결과 분석 링크는 응답자에게 숨김. |
| 역할별 노출 | 응답자는 응답만, HR은 운영/결과 관리. |
| 시각화 | progress bar, 익명/활용 방식 info card. |
| Empty/CTA | 응답 대상 없음: `현재 배정된 평가가 없습니다` 안내. |
| 우선순위 | P2 |

### `/upward/results` 또는 `/evaluation/upward/results`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 결과 조회가 HR/본부장/리더에게 같은 형태로 보이면 해석이 어렵다. |
| 개편 후 구조 | `결과 요약` -> `강점/개선점` -> `조직별 비교` -> `후속 액션`. |
| 유지할 기능 | 다면/리더십 결과 조회, word cloud, 조직별 filtering. |
| 숨기거나 접을 기능 | raw comments와 민감 정보는 권한별로 제한. |
| 역할별 노출 | 리더는 본인 개선, 본부장은 조직 summary, HR은 전체 운영. |
| 시각화 | score distribution, word cloud, action checklist. |
| Empty/CTA | 결과 없음: `응답 기간 종료 후 확인 가능` 안내. |
| 우선순위 | P2 |

### `/admin/evaluation-ops`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | HR 운영 허브에 7/1 오픈 기능과 고급 전환 기능이 함께 보이면 실수 위험이 있다. |
| 개편 후 구조 | `7/1 MBO 오픈 작업` -> `일일 모니터링` -> `평가 전환 준비` -> `고급/공식 전환`. |
| 유지할 기능 | KPI/MBO, 평가자 배정, 평가 일정, readiness, workbench links. |
| 숨기거나 접을 기능 | official scoring/grade/backfill/apply, department score intake는 고급. |
| 역할별 노출 | HR_ADMIN 중심. CEO/HQ는 read-only summary만 별도 검토. |
| 시각화 | operation checklist, P0 blocker count, route quick links. |
| Empty/CTA | 설정 미완료: `평가 기간부터 확인` 안내. |
| 우선순위 | P1 |

### `/admin/evaluation-readiness`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | baseline, policyCategory, official guard가 보이지 않거나 접혀 있으면 HR이 blocker를 놓친다. |
| 개편 후 구조 | `Go/No-Go` -> `6대 readiness count` -> `Baseline export` -> `policyCategory resolver` -> `공식 저장 차단 상태`. |
| 유지할 기능 | baseline markdown/TSV export, policyCategory 미분류 처리, official write guard. |
| 숨기거나 접을 기능 | metadata save는 위험하지 않게 분리하고 명확한 설명을 붙인다. |
| 역할별 노출 | HR_ADMIN only. 다른 role은 접근 제한 또는 read-only summary. |
| 시각화 | blocker count cards, gate status chips, export action group. |
| Empty/CTA | 대상 주기 없음: `공식 readiness 대상 주기 지정 필요` 안내. |
| 우선순위 | P0/P1. 안전 잠금과 baseline은 HR demo 핵심. |

### `/admin/performance-assignments`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 평가자 배정 화면은 기술적이고 dense하며 sync/save 같은 위험 행동이 섞일 수 있다. |
| 개편 후 구조 | `누락 요약` -> `FIRST/SECOND/FINAL별 table` -> `수동 검토 drawer` -> `고급 sync`. |
| 유지할 기능 | 평가자 routing blockers, assignment table, manual review. |
| 숨기거나 접을 기능 | sync/reset/apply 성격 버튼은 고급 확인 영역. |
| 역할별 노출 | HR_ADMIN 관리, HQ_MANAGER는 조회 summary 가능. |
| 시각화 | stage chips, missing count, org filter, blocker trend. |
| Empty/CTA | 누락 없음: `평가자 배정 준비 완료` 안내. |
| 우선순위 | P1 |

### `/admin/evaluation-cycles` 또는 `/admin/eval-cycle`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 현재 route는 `/admin/eval-cycle`로 보이며, PPT식 명칭과 route 명이 다르다. |
| 개편 후 구조 | `현재 주기` -> `작성 가능 기간` -> `평가 기간` -> `상태 변경 이력`. |
| 유지할 기능 | EvalCycle 생성/수정, status, goal edit mode, design config. |
| 숨기거나 접을 기능 | 고급 JSON/design config 직접 편집. |
| 역할별 노출 | HR_ADMIN만 쓰기. 나머지는 기간 상태 표시만. |
| 시각화 | timeline, open/closed status chip, calendar preview. |
| Empty/CTA | 주기 없음: `평가 주기 생성` 안내. |
| 우선순위 | P1 |

### `/admin/evaluation-targets`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 현재 명시 route 존재 여부는 코드 확인이 필요하다. 대상자 관리는 HR 오픈 필수 흐름이다. |
| 개편 후 구조 | `대상자 summary` -> `업로드/검증 결과` -> `제외/포함 사유` -> `확정 상태`. |
| 유지할 기능 | 대상자 upload/import가 존재한다면 유지. 없으면 HR 운영 hub에서 연결 필요. |
| 숨기거나 접을 기능 | raw import detail과 technical errors는 detail drawer. |
| 역할별 노출 | HR_ADMIN 관리, 본부장은 자기 조직 대상자 조회. |
| 시각화 | included/excluded count, validation issue chips. |
| Empty/CTA | 대상자 없음: `대상자 업로드 또는 HR 확인 필요`. |
| 우선순위 | P1, route 매핑 확인 필요 |

### `/admin/organization`

| 항목 | 내용 |
| --- | --- |
| 현재 문제 | 현재 route는 `/admin/google-access` 또는 조직 관련 admin route와 연결될 가능성이 있다. |
| 개편 후 구조 | `조직 구조` -> `권한/직책자` -> `동기화 상태` -> `예외/수동 보정`. |
| 유지할 기능 | 직원/조직 관리, Google account/org chart operations, role mapping. |
| 숨기거나 접을 기능 | sync/apply 성격 action은 확인 modal과 고급 영역. |
| 역할별 노출 | HR_ADMIN만 쓰기. 읽기 summary는 필요 시 HQ_MANAGER. |
| 시각화 | organization tree, level chips, role badges. |
| Empty/CTA | 조직 정보 없음: `Google/HR 원장 확인 필요`. |
| 우선순위 | P2, route 매핑 확인 필요 |

## 4. P0/P1/P2 요약

| 우선순위 | 항목 |
| --- | --- |
| P0 | official write/scoring/grade controls가 일반 CTA처럼 노출되지 않도록 유지 |
| P0 | `/admin/evaluation-readiness` baseline/export/write guard 가시성 유지 |
| P0 | 구성원에게 리더/HR 전용 AI action 숨김 |
| P1 | `/kpi/org` 정보 과밀과 긴 패널 축소 |
| P1 | `/kpi/monthly` 입력 부담 완화 |
| P1 | `/admin/evaluation-ops` 고급 기능 접기 |
| P1 | AI 역량평가 명칭/설명 조정 |
| P2 | 360/리더십 결과 화면 시각화 개선 |
| P2 | 관리자 조직/권한 route 명칭 정리 |

