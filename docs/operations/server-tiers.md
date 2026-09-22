# 서버군 4단계 매핑

| 항목 | 값 |
|---|---|
| 표준 근거 | AI Native SDLC Requirements §3.2 (서버군 정의와 AI 배포 권한) |
| 수립일 | 2026-09-22 |
| 해소 대상 | 1회차 자가 진단 §3.2 "개발→알파→베타→실서비스 4단계 — 미준수" |

---

## 1. 표준이 정의하는 4단계

| 구분 | 역할 | 접속범위 | 통제 | AI 배포 권한 |
|---|---|---|---|---|
| 개발 | 개발자가 임의로 업데이트·테스트 | 사내 | 개발팀 | AI 자율 배포 |
| 알파 | 기능 검증을 위해 QA가 테스트 | 사내 | 개발팀 | PM 승인 후 AI 실행 |
| 베타 | 통합 테스트용, 실환경과 동일 구성 | 사외 | 품질경영본부 | 인간 승인 후 AI 실행 |
| 실서비스 | 실제 서비스 | 사외 | PM | 인간 승인 후 AI 실행 |

★ 표준은 이 승격 트랙이 **§2.3의 5개 승인 게이트와 별개**임을 명시한다.
게이트④·⑤가 베타·실서비스 지점과 겹칠 뿐이다.

---

## 2. kpi-pms 매핑

| 표준 | kpi-pms | 접속범위 | 통제 | 상태 |
|---|---|---|---|---|
| 개발 | Vercel Development (CLI) + 로컬 | 사내 | 재원 | **실재** |
| 알파 | — | — | — | ★ **없음** |
| 베타 | Vercel Preview | 사외 (Vercel 인증 필요) | 재원 | **실재** |
| 실서비스 | Vercel Production (`main`) | 사외 | 재원 | **실재** |

### 2-1. 베타 = Vercel Preview

Vercel Preview 는 `main` 에 병합되지 않은 모든 브랜치를 추적해 배포를 생성한다.
빌드 구성·런타임·환경변수가 Production 과 동일하므로 표준의 **"실환경과 동일한
구성"** 정의에 부합한다.

접속 통제는 **Deployment Protection — Vercel Authentication (Standard
Protection)** 으로, Vercel 로그인 + 팀 멤버만 접근할 수 있다. 사외 배포이나
익명 접근은 차단된다.

- Password Protection: 미사용
- Trusted IPs: 미사용
- Protection Bypass 시크릿: 미설정
- Deployment Protection Exceptions: 없음

### 2-2. 알파가 없는 이유

알파는 **QA 가 기능을 검증하는 사내 장비**다. kpi-pms 에는 QA 조직이 없으므로
(예외승인 A-4) 이 단계의 수행 주체가 존재하지 않는다.

★ Vercel Custom Environment 1개가 요금제에 포함돼 있어 **환경 생성 자체는 추가
비용 없이 가능**하다. 다만 알파는 사내 전용이어야 하고 마스킹된 데이터가
필요한데, 로컬 DB 에 마이그레이션이 적용돼 있지 않아 데이터 기반이 아직 없다.

**알파 신설은 QA 주체 지정과 데이터 기반 확보가 선행 조건이다. 미조치.**

---

## 3. AI 배포 권한 — 표준보다 엄격하다

표준은 **개발 서버에서 AI 자율 배포를 허용**하고, 알파부터 인간 승인을 요구한다.

kpi-pms 는 **모든 배포가 PR 병합을 거친다.** AI 가 직접 배포하는 경로가 없으며,
`AI_SAFETY_GUARDRAILS.md` 가 프로덕션 마이그레이션과 별칭 전환에 명시적 승인을
요구한다.

| 구분 | 표준 | kpi-pms |
|---|---|---|
| 개발 | AI 자율 배포 | PR 병합 필요 |
| 알파 | PM 승인 후 AI 실행 | (해당 없음) |
| 베타 | 인간 승인 후 AI 실행 | PR 병합 = 인간 승인 |
| 실서비스 | 인간 승인 후 AI 실행 | PR 병합 = 인간 승인 |

★ 표준 요구를 초과한다. 완화할 계획은 없다.

---

## 4. 이번 매핑에서 드러난 것

### 4-1. `stage` 환경은 존재하지 않는다

`docs/operations/deployment-and-env.md` §1 이 `dev` / `stage` / `prod` 3단계를
정의하고 §2 환경 매트릭스도 3열로 구성돼 있으나, **Vercel 에 `stage` 환경이
없다.** Production / Preview / Development 뿐이다.

문서가 실재하지 않는 환경을 정의하고 있었다. 이 문서의 환경 정의를 본 매핑에
맞춰 정정한다.

### 4-2. Preview 가 운영 DB 를 사용한다

`DATABASE_URL` 이 **All Environments** 스코프로 설정돼 있어 Preview 배포가
운영 Supabase 에 접속한다.

표준의 베타 정의는 "실환경과 동일한 **구성**" 이지 실환경 **데이터**가 아니다.
`docs/operations/deployment-and-env.md` 가 `stage` 에 대해 정한 *"masked data
only"* 원칙과도 어긋난다.

- 접속 통제(Standard Protection)가 있어 외부 노출 위험은 없다
- 다만 Preview 배포에서 수행한 쓰기 작업이 **운영 데이터에 반영된다**
- Preview 로그인은 운영 `audit_logs` 에 기록된다

**미조치.** Preview 전용 DB 분리는 로컬 DB 구축(자가 진단 3-10)과 같은 선행
조건을 공유한다.

---

## 5. 미결

- **알파 신설** — QA 주체 지정(예외승인 A-4)과 데이터 기반 확보가 선행
- **Preview DB 분리** — 로컬/운영 접속 분리와 같은 트랙
- **`deployment-and-env.md` 환경 정의 정정** — `stage` 삭제, Preview 반영
- **베타 승격 승인 주체** — 표준은 품질경영본부. 조직 부재로 예외승인 A-1 제출
