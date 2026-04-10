# Next Chat Prompt

아래 프롬프트를 새 채팅에 그대로 붙여 넣어 이어서 작업한다.

```text
이 저장소의 작업을 이어서 진행해줘.

반드시 아래 순서대로 먼저 읽고 시작해:
1. docs/operations/working-rules.md
2. docs/operations/current-handoff.md
3. README.md
4. docs/ai-assistant-operations.md

읽은 뒤에는 바로 git 상태를 확인하고, 현재 진행 중인 calibration session setup 작업을 이어서 진행해줘.

중요 규칙:
- 기존 변경사항을 되돌리지 말 것
- 공유 UI 문구는 한국어, 코드/주석/테스트는 영어 유지
- write path는 route/server 쪽에 두고 Zod validation 유지
- 작업 전후로 auditability를 항상 고려할 것
- pnpm 기준으로 검증할 것

현재 우선순위:
1. calibration setup hub 브라우저 QA
2. START_SESSION 흐름 실제 동작 점검
3. 남아 있는 eslint warnings 정리 여부 판단 및 필요 시 수정
4. tmp-session1.pdf, tmp-session2.pdf 처리 여부 확인

현재 확인된 상태:
- pnpm test:calibration-ops 통과
- pnpm typecheck 통과
- eslint는 warning 5개, error 0개

진행할 때는 먼저 현재 상태를 짧게 요약하고, 바로 필요한 점검/수정부터 시작해줘.
```
