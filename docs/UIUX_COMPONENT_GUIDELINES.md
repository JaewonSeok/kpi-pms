# UI/UX 컴포넌트 가이드라인

Last updated: 2026-06-17

## 1. 공통 레이아웃 원칙

- 사용자가 지금 해야 할 일을 첫 화면에서 볼 수 있어야 한다.
- 큰 hero나 설명 card를 반복하지 않는다. 단, 사용자의 현재 상태와 다음 행동을 빠르게 이해시키는 soft gradient header나 compact visual header는 허용한다.
- 상단은 `상태`, `다음 행동`, `마감`, `진행률`을 compact하게 보여준다.
- 본문은 실제 작업 list, 입력 form, review queue를 중심에 둔다.
- 우측 패널은 기본적으로 짧은 summary만 보이고, detail은 접는다.
- page section은 full-width band 또는 unframed layout을 사용한다.
- card 안에 card를 넣지 않는다.
- 시각 요소는 "예쁜 장식"보다 "지금 해야 할 일과 상태를 더 빨리 이해시키는 장치"여야 한다.

## 2. 카드와 패널

| 컴포넌트 | 사용 기준 | 피해야 할 것 |
| --- | --- | --- |
| Summary card | count, status, next action | 장문 설명, 중첩 card |
| Detail panel | 검토 이력, 세부 정책, 고급 설정 | 화면 오른쪽 전체를 길게 차지 |
| Sticky summary | 작성/검토 화면에서 남은 가중치, 제출 가능 여부 | 모바일에서 본문을 가림 |
| Drawer | KPI detail, review detail, evidence detail | 저장 버튼을 너무 아래 숨김 |
| Accordion | 정책 설명, 계산 상세, export detail | 핵심 CTA를 접힌 영역에 숨김 |

카드 radius는 화면 성격에 따라 다르게 쓴다.

| 화면 성격 | 권장 radius |
| --- | --- |
| 구성원 작성 화면 | 12~16px. 부담을 줄이고 친근한 작업감을 준다 |
| 월간 실적/AI 보조 카드 | 12~16px. 가벼운 작성/요약 흐름에 맞춘다 |
| 리더 검토 화면 | 10~14px. card list와 detail drawer의 균형을 맞춘다 |
| HR 고밀도 table/admin 화면 | 8~12px. 정보 밀도와 정렬감을 유지한다 |
| 위험/공식 전환 설정 | 8px 안팎. 차분하고 엄격한 느낌을 유지한다 |

중요한 상태는 card border만으로 전달하지 말고 상태칩, 아이콘, 짧은 보조 문구를 함께 사용한다.

## 3. 탭 규칙

- 탭은 사용자의 과업이 명확히 다를 때만 쓴다.
- 예: `내 KPI`, `팀원 KPI 검토`, `월간 실적`, `AI 보조`.
- 같은 과업의 filter는 탭이 아니라 chip/filter로 처리한다.
- 탭 label은 명사형보다 과업형을 우선한다.
- 구성원에게 리더/HR 전용 탭을 disabled로 보여주지 않는다. 권한이 없으면 숨긴다.

## 4. 상태칩 규칙

평가 상태 흐름의 상태칩은 공통 vocabulary를 사용한다.

| 상태 | 칩 문구 | 사용 색상 방향 |
| --- | --- | --- |
| 미시작 | 미시작 | neutral |
| 작성중 | 작성중 | info |
| 제출완료 | 제출완료 | primary |
| 평가중 | 평가중 | warning |
| 반려 | 반려 | danger |
| HR 반영중 | HR 반영중 | warning |
| 1차확정 | 1차확정 | success |
| 조정중 | 조정중 | warning |
| 최종확정 | 최종확정 | success/locked |

안전 관련 상태는 별도 칩을 쓴다.

- `preview`
- `공식 저장 안 함`
- `안전 잠금`
- `쓰기 금지`
- `관리자 전용`

색상만으로 의미를 전달하지 말고 텍스트를 함께 표시한다.

## 5. CTA 규칙

| CTA 유형 | 예시 | 기준 |
| --- | --- | --- |
| Primary | `KPI 추가`, `제출 요청`, `검토 시작` | 화면당 1개를 원칙으로 한다 |
| Secondary | `임시 저장`, `미리보기`, `내보내기` | primary 옆 또는 section header에 둔다 |
| Destructive | `삭제`, `반려`, `초기화` | confirmation과 사유 입력을 요구한다 |
| Dangerous admin | `sync`, `apply`, `backfill`, `공식 점수 반영` | 기본 화면에 일반 CTA처럼 두지 않는다 |
| Read-only export | `Baseline 내보내기`, `요약 보기` | read-only임을 명확히 한다 |

disabled CTA에는 짧은 이유를 표시한다.

예:

- `작성 기간이 아닙니다`
- `가중치 합계가 100%가 아닙니다`
- `공식 저장은 readiness 승인 전까지 잠겨 있습니다`

## 6. Empty state 규칙

Empty state는 빈 화면을 방치하지 않고 다음 행동을 알려준다.

필수 구성:

1. 현재 비어 있는 이유
2. 다음 행동
3. 문의 또는 권한 필요 여부

예:

- 개인 KPI 없음: `아직 작성된 KPI가 없습니다. 상위 조직 KPI를 확인한 뒤 KPI를 추가하세요.`
- 월간 기록 없음: `이번 달 실적 기록이 없습니다. 진행 요약과 증빙 링크부터 간단히 남기세요.`
- 평가자 누락 없음: `현재 누락된 평가자 배정이 없습니다.`

아이콘은 `lucide-react`를 사용한다. 외부 illustration asset dependency는 추가하지 않는다. 다만 inline SVG, CSS pattern, role-based empty illustration은 허용한다.

## 7. 아이콘과 시각화 사용 기준

- 버튼 아이콘은 직접 SVG보다 `lucide-react`를 우선한다.
- 익숙한 action은 text button보다 icon+label을 쓴다.
- 표가 길어질 때는 미니 bar, progress, count chip을 함께 둔다.
- Recharts는 trend, distribution, readiness count에만 제한적으로 사용한다.
- 업무 흐름을 방해하지 않는 subtle visual accent는 허용한다. 예를 들어 soft gradient header, 얇은 patterned background, section divider accent를 사용할 수 있다.
- 장식용 gradient orb나 bokeh blob이 핵심 정보와 CTA를 밀어내거나 시선을 빼앗으면 사용하지 않는다.
- 단순한 빈 상태 시각화는 CSS pattern 또는 inline SVG를 사용할 수 있다.

권장 시각화 예시:

| 사용 위치 | 시각화 |
| --- | --- |
| 월간 실적 | 월별 입력 완료 mini trend, evidence count chip |
| KPI 목록 | KPI 위험도 chip/bar, 남은 가중치 progress |
| 제출/검토 | 제출 진행 stepper, 상태 timeline |
| 평가 preview | 평가 단계 timeline, score contribution bar |
| readiness | blocker count card, Go/No-Go status strip |
| AI 보조 | AI assist empty illustration, 초안/검토 필요 badge |

## 8. 색상 사용 원칙

- 단일 색상 계열로 화면 전체를 덮지 않는다.
- 부드러운 gradient나 pattern은 상단 header, empty state, section accent처럼 제한된 영역에서만 쓴다.
- 상태 색상은 의미별로 제한한다.
  - success: 완료/확정
  - warning: 검토/주의
  - danger: 반려/차단
  - info: 작성/진행
  - neutral: 미시작/읽기 전용
- official write guard는 과격한 warning만 쓰지 말고 `안전 잠금`이라는 안정적 표현을 함께 사용한다.
- AI 기능은 보라색만 반복하지 말고, `AI 보조` badge와 설명으로 구분한다.

## 9. 정보 밀도 기준

| 화면 유형 | 밀도 기준 |
| --- | --- |
| 구성원 작성 화면 | 낮음. 핵심 입력부터 단계적으로 표시 |
| 리더 검토 화면 | 중간. 팀원별 상태와 detail drawer 조합 |
| HR 운영 화면 | 높음. count, filter, table을 쓰되 next action 우선 |
| CEO demo 화면 | 낮음~중간. 흐름과 메시지가 먼저 보이게 구성 |
| 고급 설정 화면 | 높음 가능. 위험 CTA는 접기/확인 처리 |

## 10. `/kpi/monthly` Pilot Visual Pattern

월간 실적 화면은 사용자가 매월 부담 없이 기록하도록 가볍고 반복 가능한 구조를 우선한다.

| 패턴 | 설명 |
| --- | --- |
| Compact status strip | 선택 월, 작성 상태, 증빙 수, 다음 행동을 한 줄로 보여준다 |
| Next-action cards | `이번 달 진행 요약 작성`, `증빙 링크 추가`, `리더 체크인 준비`처럼 해야 할 일을 작은 카드로 제시한다 |
| KPI monthly card list | KPI별 월간 상태를 card list로 보여주고, 상세 입력은 펼침/drawer로 이동한다 |
| Right detail panel | 선택한 KPI의 월별 이력, 증빙, 코멘트를 짧게 보여주고 긴 내용은 접는다 |
| AI assist card | 구성원에게는 요약/회고/체크인 보조만, 직책자에게는 관리 범위 리뷰 보조만 보여준다 |
| Empty preview state | 월간 기록이 없을 때 inline SVG나 CSS pattern으로 가벼운 빈 상태를 보여주고 첫 입력 CTA를 둔다 |

이 패턴은 월간 실적을 "평가 직전의 무거운 보고서"가 아니라 "매월 짧게 쌓는 수행 근거"로 느끼게 하는 것이 목적이다.

## 11. 모바일/작은 화면 대응

- fixed-width panel을 피하고 responsive grid를 사용한다.
- table은 모바일에서 card list 또는 horizontal scroll을 허용한다.
- action bar는 하단 sticky로 두되 본문을 가리지 않는다.
- 긴 단어와 route/code label은 줄바꿈이 가능해야 한다.
- font-size를 viewport width로 scaling하지 않는다.
- 좁은 화면에서는 우측 패널을 하단 accordion으로 전환한다.

## 12. shadcn/ui, Tailwind, Recharts, lucide-react 사용 원칙

| 도구 | 사용 기준 |
| --- | --- |
| shadcn/ui | Button, Dialog, Tabs, Accordion, Badge, Tooltip 같은 기본 상호작용 |
| Tailwind | layout, spacing, responsive, state color |
| Recharts | readiness trend, score preview, blocker distribution |
| lucide-react | nav icon, CTA icon, empty state icon |

새 dependency는 추가하지 않는다. 현재 stack으로 표현하기 어려운 UI는 먼저 CSS/Tailwind/Recharts/lucide 조합으로 해결한다.

## 13. 접근성 기준

- 버튼은 명확한 accessible label을 가진다.
- icon-only button은 tooltip 또는 `aria-label`을 제공한다.
- 상태는 색상만으로 구분하지 않는다.
- focus ring을 제거하지 않는다.
- modal/drawer는 ESC, focus trap, close affordance를 유지한다.
- form error는 field 근처에 표시한다.
- disabled 사유는 tooltip 또는 helper text로 제공한다.

## 14. AI 기능 UI 기준

AI 기능은 공식 평가/점수 산정처럼 보이면 안 된다.

| AI 기능 | UI label | 금지 표현 |
| --- | --- | --- |
| KPI 작성 보조 | `AI 작성 보조` | `AI 평가`, `AI 점수 산정` |
| 월간 요약 | `AI 요약 초안` | `공식 평가 근거 생성` |
| 중간 점검 코치 | `AI 중간 점검 코치` | 구성원에게 리더 리뷰 AI 노출 |
| 리더 리뷰 초안 | `리더 리뷰 초안` | official grade/score처럼 보이는 문구 |
| AI 활용 제출 | `AI 활용 제출` | 2026 연간 점수 반영처럼 보이는 문구 |

공통 안내:

- `AI 결과는 저장 전 초안입니다. 사용자가 직접 확인해야 합니다.`
- `공식 평가 점수나 등급을 산정하지 않습니다.`
- `관리 범위 밖 구성원에 대한 리더 AI는 사용할 수 없습니다.`

## 15. 위험 기능 노출 기준

아래 기능은 일반 운영 화면의 primary CTA로 노출하지 않는다.

- official scoring activation
- official grade activation
- `Evaluation.totalScore` write
- `Evaluation.gradeId` write
- `Evaluation` / `EvaluationItem` official creation
- backfill/apply/dry-run execution
- feature flag write
- assignment sync/reset/apply

필요할 경우 `고급`, `공식 전환 준비`, `관리자 승인 필요` 영역에 접고, read-only 설명과 confirmation을 요구한다.
