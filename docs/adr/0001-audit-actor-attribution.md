# 0001. 감사 로그에 대행 실행자(actor) 컬럼 추가

## 상태

Accepted

## 맥락

`audit_logs.userId`는 마스터 로그인(대행) 중에 발생한 일반 업무 액션에 대해
**대행 대상 직원의 ID**로 기록된다. `session.user.id`가 대행 시작 시
`applyAuthClaimsToToken(token, targetClaims)`로 대상 직원의 claims로
치환되기 때문이다(`src/lib/auth.ts`). 대다수 라우트는 `createAuditLog`를
호출할 때 `userId: session.user.id`를 그대로 넘기므로, 실제로 그 액션을
수행한 관리자가 누구인지는 `audit_logs` 한 행만으로는 식별할 수 없다.

대행 자체의 시작/종료/만료(`MASTER_LOGIN_STARTED`/`ENDED`/`EXPIRED`)는
예외적으로 실행 관리자의 ID를 `userId`에 직접 기록하지만(`src/server/impersonation.ts`,
`src/lib/auth.ts`), 대행 중에 이루어진 KPI 승인·평가 제출 같은 *일반 업무
액션*은 이 예외 경로를 타지 않는다.

2026-04-14 이후 118건의 대행(마스터 로그인) 세션이 발생했다. 이 기간 동안
대행 상태에서 수행된 업무 액션들의 `audit_logs`는 실행 관리자를 특정할 수
없는 상태로 누적돼 있다.

## 결정

`AuditLog`에 nullable 컬럼 `actorUserId`를 추가한다.

- `userId`: 기존과 동일하게 "이 행위의 귀속 주체"(대행 중이면 대행 대상,
  아니면 로그인한 본인)를 그대로 유지한다 — 기존 82만+ 건의 의미를 바꾸지
  않는다.
- `actorUserId` (신규, nullable): 대행 중에 기록된 행에 한해 **실제로 이
  액션을 실행한 관리자**의 ID를 담는다. 대행이 아니면 `null`로 남는다.

헬퍼 `resolveAuditActor(session)`을 신설해 `{ userId, actorUserId? }`를
반환하도록 하고, 호출부가 이 헬퍼 하나만 쓰면 `userId`/`actorUserId`를
올바르게 채울 수 있게 만든다. 단, 이번 결정은 스키마·헬퍼까지만이며 실제
호출부 전환은 별도 PR에서 순차 진행한다(기존 82개 호출부를 한 번에
바꾸는 것은 이번 범위가 아니다).

## 대안과 기각 사유

1. **`userId`를 대행 실행자(actor)로 덮어쓰기**
   기각. `userId` 컬럼의 의미가 "행위가 누구 이름으로 귀속되는가"에서
   "누가 버튼을 눌렀는가"로, **레코드 작성 시점의 대행 여부에 따라
   달라지게 된다.** 기존 82만+건은 대상 직원 기준으로 쌓여 있어, 컬럼을
   덮어쓰면 같은 컬럼 안에 서로 다른 의미의 값이 섞여 조회·집계가
   불가능해진다.

2. **`createAuditLog` 내부에서 `getServerSession()`을 직접 호출**
   기각. `createAuditLog`가 매번 세션을 자체 조회하게 만들면, PR #300에서
   고친 증폭 문제와 **동일한 메커니즘**(NextAuth `jwt` 콜백이 세션 조회마다
   재실행되고, 대행 만료 감지·토큰 재기록이 그때마다 함께 도는 구조)이
   감사 로그를 남길 때마다 추가로 발동한다. 감사 로그 1건을 남기기 위해
   세션 재조회·JWT 콜백 재실행이라는 무거운 부수효과를 매번 유발하는
   설계는 채택하지 않는다. 호출부가 이미 들고 있는 `session`을
   `resolveAuditActor(session)`에 넘기는 방식으로 대신한다.

## 결과

- `AuditLog.actorUserId`가 스키마에 추가된다(마이그레이션은 이 PR에서
  생성만 하고 적용하지 않는다).
- `resolveAuditActor(session)` 헬퍼가 `src/lib/audit.ts`에 추가된다.
- 기존 82개 `createAuditLog` 호출부는 이번 PR에서 **하나도 바뀌지
  않는다** — 전환은 별도 PR에서 진행한다.
- `actorUserId`를 실제로 화면에 노출하려면(예: KPI 이력 타임라인의
  `employeeNameMap.get(log.userId) ?? '시스템'` 폴백 로직) 별도 작업이
  필요하다 — 이번 PR 범위 밖.
