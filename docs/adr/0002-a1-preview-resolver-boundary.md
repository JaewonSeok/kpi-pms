# ADR 0002 — A1 미리보기 resolver 의 계산 경계

## 상태

**Accepted**

원문: `docs/A1_설계_미리보기_2026등급.md` §3.2, §3.5
결정 시점: 2026-06-25
구현 확인: 2026-09-18 — `src/lib/preview-2026-organization-score.ts`
`calculateOrganizationPerformanceFromIntake2026` 에서 두 결정 모두 유지됨

> ★ 이 ADR 은 기존 설계 문서에서 **이관**한 것이다. 원문에 결정과 기각
> 사유가 함께 기재돼 있어 옮겼다. 원문에 없는 내용을 추가하지 않았다.

---

## 맥락

2026 평가 등급 미리보기(A1) 화면은 조직 점수와 개인 점수를 합산해 최종
점수를 산출한다. 대상 역할에 따라 가중 구조가 다르다.

- 팀원·팀장: `final = team × 0.20 + parent × 0.10 + personal × 0.70`
- DIV_HEAD: `final = division × 0.30 + personal × 0.70`

코드베이스에는 이미 `calculateFinalPerformanceScore2026({ org, personal })`
이 존재하며 `org × 0.30 + personal × 0.70` 을 적용한다.

또한 조직 점수는 `department_score_intakes` 테이블에 적재되고 있어, resolver
가 이를 직접 조회할 것인지도 결정 대상이었다.

---

## 결정

### 결정 1 — 기존 함수를 재사용하지 않고 자체 식으로 직접 합산한다

A1 resolver 는 `calculateFinalPerformanceScore2026` 을 호출하지 않는다.
`finalScoreFormula` 의 30/70 비율 상수만 참조한다(decoupling).

### 결정 2 — resolver 는 intake DB 를 참조하지 않는다

`prisma.departmentScoreIntake.*` / `prisma.evaluation.*` /
`prisma.employee.*` 를 호출하지 않는다. `parentScore` / `teamScore` /
`personalScore` 는 **호출자가 입력값으로 직접 제공**한다.

---

## 대안과 기각 사유

### 대안 1 — `calculateFinalPerformanceScore2026` 재사용

**기각.** 이중 가중이 발생한다.

기존 함수는 `org` 인자가 **이미 가중 적용된 조직 30% 점수**일 것을 전제한다.
A1 의 "조직 30% 점수" 는 `team × 0.20 + parent × 0.10`(팀원·팀장) 또는
`division × 0.30`(DIV_HEAD) 이다.

이 값을 `org` 로 넘기면 `(team × 0.20 + parent × 0.10) × 0.30` 이 되어
**수치가 어긋난다.**

### 대안 2 — 사이클 intake 연동 (원문의 옵션 b)

**기각.** 본 resolver 의 책임이 아니다.

`prisma.departmentScoreIntake.findMany` 등으로 활성 사이클 점수를 기본
입력으로 자동 채우는 방식을 검토했으나, resolver 는 **read-only · 호출자
입력 의존** 원칙을 유지한다. intake 연동은 별도 server loader 에서 처리한다.

원문은 이 대안을 코드 주석으로만 남기도록 정했다.

---

## 결과

- A1 resolver 는 계산 로직을 자체 보유하며, 비율 상수만 외부에서 참조한다
- 가중 방식이 바뀌면 `calculateFinalPerformanceScore2026` 과 A1 resolver
  **양쪽을 고쳐야 한다.** 중복 로직의 대가다
- resolver 는 DB 를 읽지 않으므로 테스트가 단순하고 부작용이 없다
- 대신 호출자가 점수 조달 책임을 진다. intake 연동이 필요해지면 별도
  loader 추가가 필요하다
- ★ 구현 함수명이 `calculateOrganizationPerformanceFromIntake2026` 이나
  intake DB 를 읽지 않는다. **이름이 결정 2 와 반대로 읽힌다.** 이 함수를
  처음 보는 사람은 DB 조회가 있다고 오해할 수 있다

---

## 레드팀 반론

| # | 반론 | 제기 | 채택 | 처리 |
|---|---|---|---|---|
| — | — | — | — | — |

★ **해당 없음.** 이 결정은 2026-06-25 에 이루어졌고, 레드팀 운영 규약은
2026-09-18(#311)에 수립됐다. 당시 반론 기록이 없으며 **소급 작성하지
않는다.** 반론 절은 규약 수립 이후의 결정부터 실질적으로 채워진다.
