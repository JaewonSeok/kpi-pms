# AI Assistant Operations

## Scope

This document covers the step 16 AI assistant feature set:

- KPI writing assistance
- evaluation comment draft
- bias analysis
- growth plan recommendation
- human-in-the-loop approval
- mobile fallback behavior

## OpenAI integration

- API style: OpenAI Responses API
- output mode: Structured Output JSON schema
- request logging table: `AiRequestLog`
- approval model: generate -> preview -> approve/reject -> apply

## PII minimization principle

The application sends only sanitized context to the AI provider.

- Excluded fields: employee names, emails, employee numbers, user ids, target ids, evaluator ids
- Redaction rules: email, employee-id-like strings, phone numbers
- Allowed context examples: KPI titles, sanitized summaries, department-level context, evaluation stage, scores, KPI weights
- Result: the stored outbound payload in `AiRequestLog.requestPayload` is already minimized

## Human approval workflow

AI output is never auto-applied to a persisted evaluation or KPI.

1. User requests an AI suggestion.
2. The server generates AI output or fallback output and stores an `AiRequestLog`.
3. The UI shows a preview panel.
4. The user explicitly approves or rejects the suggestion.
5. Only approved content is copied into the local form state.

Approval is stored in:

- `approvalStatus`
- `approvedPayload`
- `approvedAt`
- `approvedById`

## Cost and error logging

Each request stores:

- provider and model
- input and output token counts when available
- `estimatedCostUsd`
- `errorCode`
- `errorMessage`

Cost is estimated from environment-configurable per-1M token rates:

- `OPENAI_INPUT_COST_PER_1M`
- `OPENAI_OUTPUT_COST_PER_1M`

If rates are not configured, the application still logs token usage and stores cost as `0`.

## Graceful fallback policy

The UI must remain usable when AI is unavailable.

- If `AI_FEATURE_ENABLED=false`, the server returns a deterministic fallback suggestion and logs the request as `DISABLED`.
- If the OpenAI API fails, the server returns a deterministic fallback suggestion and logs the request as `FALLBACK` with error metadata.
- The preview panel clearly labels whether the result came from AI or fallback.
- The same approval flow applies to fallback suggestions.

## Mobile UX policy

- KPI creation uses a FAB entry point on small screens.
- The editor opens as a bottom sheet on mobile.
- Inputs and buttons use touch-friendly heights and spacing.
- Preview and approval remain on-screen in the same flow.
