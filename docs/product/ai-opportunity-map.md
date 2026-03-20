# AI Opportunity Map

## AI Principles
- Use OpenAI Responses API.
- Prefer structured outputs with JSON schema.
- Keep secrets server-side only.
- Require human approval before any apply step.
- Log request, result, approval, rejection, cost, and fallback state.
- Minimize PII in prompts.
- Always provide fallback-safe results and user-visible loading/error states.

## Capability Map

| Feature | Target Users | Business Value | Inputs | Output | Approval UX | Risks | Fallback | Packaging | Complexity | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Goal Drafting | Admin, leaders, members | Faster high-quality KPI creation | strategy context, existing KPIs, role context | structured KPI draft | preview then apply | strategic internal content | deterministic suggestion | AI Goal Copilot | Medium | P1 |
| Goal Wording Improvement | Leaders, members | Clearer, less ambiguous KPI language | KPI title/definition | improved wording + rationale | preview then apply | vague prompt quality | rewrite template | Included | Low | P1 |
| SMART Check | Leaders, managers | Better review quality | KPI text, target, weight | criteria diagnosis | preview only | overconfidence | rules-based diagnosis | Included | Low | P1 |
| Monthly Summary | Members, managers | Better monthly reporting quality | actuals, notes, blockers, evidence | concise summary + risks | preview then apply | note sensitivity | deterministic summary | AI Performance Notes | Medium | P1 |
| Manager Review Draft | Managers | Faster, more consistent monthly/evaluation reviews | KPI evidence, trends, check-ins | review draft | preview then apply | bias transfer | structured comment template | AI Manager Coach | Medium | P1 |
| Check-in Agenda Suggestion | Managers, members | Higher quality 1:1 discussions | KPI trends, overdue actions, prior notes | agenda and prep points | preview only | context over-summarization | template agenda | AI Coaching Assistant | Medium | P1 |
| Evidence Summary | Managers, admins | Faster evidence-based review | monthly records, check-ins, feedback | evidence digest | preview then apply | missing context | rules-based digest | Included | Medium | P1 |
| Review Comment Draft | Managers, admins | Review productivity | evaluation items, evidence, score context | structured comment draft | preview then apply | evaluator over-reliance | evidence digest fallback | AI Review Writer | High | P0 |
| Bias Hints | Managers, HR | Fairer evaluations | draft comments, score patterns | bias watchouts | preview only | false positives | rule-based bias hints | Fairness Pack | Medium | P1 |
| Calibration Assist | CEO, HR, admin | Faster anomaly prioritization | distributions, candidates, notes | anomaly summary + rationale | preview then apply | unfair AI influence | rules-based outlier summary | Calibration Pro | High | P1 |
| Compensation Explanation | CEO, admin, members | Clearer reward communication | rules, scenario outputs, employee delta | budget or disclosure explanation | preview only | pay/privacy sensitivity | delta narrative | Rewards AI | High | P1 |
| Notification Ops Summary | Admin | Faster ops diagnosis | job executions, dead letters, template payloads | incident summary | preview only | payload exposure | deterministic ops note | Ops AI | Medium | P2 |
| Admin Ops Summary | Admin | Faster executive/ops reporting | metrics, health, risk, events | report draft + risk priority | preview only | operational sensitivity | fallback report | Enterprise Ops AI | Medium | P2 |
| Reviewer Recommendation | Managers, admins | Better 360 reviewer pools | org tree, relationship map, scope | ranked reviewer recommendations | preview then nomination submit | interpersonal sensitivity | rule-based reviewer set | 360 Premium | High | P0 |
| 360 Theme Summarization | Members, managers, HR | Makes anonymous feedback actionable | anonymized comments, scores, categories | themes, strengths, blind spots | preview only | re-identification risk | category-only summary | 360 Premium | High | P0 |
| Careless Review Detection | Admin, HR | Better feedback quality control | response timing, variance, comment length | quality flags + reasons | preview only | over-flagging | heuristic scoring | 360 Premium | Medium | P1 |
| Development Plan Suggestion | Members, managers | Converts feedback into action | 360 themes, evaluation evidence, check-ins | plan draft | preview then create/update | career sensitivity | theme-to-action template | Growth AI | Medium | P1 |

## Implementation Notes
- Keep AI access routed through server adapters such as `src/server/ai/*`.
- Reuse `AiRequestLog` and approve/reject flow.
- Standardize output schemas by domain and feature.
- Prefer one preview object shape per feature family so UI can stay consistent.
