# Global Gap Analysis

## Overview
This document captures the highest-priority product gaps between the current KPI PMS implementation and world-class performance management products such as Workday, SAP SuccessFactors, Oracle HCM, Betterworks, Lattice, Leapsome, 15Five, Culture Amp, Lemonbase, INHR+, and CLAP.

The benchmark is capability-level, not UI-level. The goal is to improve:
- strategy-to-execution linkage
- manager enablement
- evidence-based reviews
- calibration fairness
- compensation explainability
- HR/Admin operational control
- AI copilot usefulness inside workflow

## Current Strengths
- Strong route coverage for KPI, evaluation results, appeal, calibration, compensation, notifications, Google access, and admin ops.
- Server-side page adapter structure already exists in `src/server/*`.
- AI governance foundation already exists with `AiRequestLog`, approve/reject flow, and centralized fallback handling.
- Audit logging and admin operations concepts are already present.

## Current Structural Weaknesses
- Review execution depth is still below world-class level.
- Analytics and reporting are thinner than the rest of the product.
- 360 feedback exists in schema and partial API form, but not as a standalone product surface.
- Some workflow richness is inferred from logs rather than strongly modeled in schema.
- HR Ops is functionally represented by `ROLE_ADMIN`, but not modeled explicitly.

## Domain Gap Matrix

| Domain | Current State | Main Gap | Why It Matters | Minimum Fix | Ideal Version | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Goal & Strategy Alignment | Org KPI and Personal KPI pages are strong | Team goal layer, OKR flexibility, explicit cascade governance are weak | Strategy alignment is the backbone of performance management | Add stronger parent-child linkage, cascade policy, framework type | KPI + OKR hybrid with alignment scoring | P1 |
| Continuous Performance | Monthly records and check-ins are in place | Coaching guidance, recognition, recurring follow-up intelligence are weak | Manager enablement depends on continuity, not just records | Add coaching prompts, follow-up tracking, preparation quality | Continuous coaching workspace with continuity memory | P1 |
| Reviews & Evaluation | Workbench exists | Review templates, richer workflow orchestration, peer/360 integration missing | Evaluation quality determines downstream fairness and compensation trust | Add 360 evidence integration and stronger review guidance | Full multi-step orchestration | P0 |
| Results & Appeal | Good service-level screens | Richer transparency, comparative context, stronger SLA model needed | Results must feel explainable and procedurally fair | Add explanation layers and stronger case states | Full explainability and case management | P1 |
| Calibration & Fairness | Distribution and adjustment are implemented | Bias and low-sample safeguards are still light | Calibration is where trust can be lost fastest | Add fairness warnings and exception handling | Fairness analytics with stronger policy engine | P1 |
| Compensation | Scenario and workflow are solid | Employee-facing explanation and exception governance are limited | Pay decisions require strong explanation and controls | Add disclosure explanation and scenario reasoning | End-to-end compensation statement UX | P1 |
| Admin & HR Ops | Strong operational surfaces | Deeper SLO/RCA and role separation are missing | HR/Admin productivity depends on operating confidence | Add more structured risk states and ownership | Full ops control plane | P2 |
| Analytics & Reporting | Dashboard exists | Role-based analytics and executive summaries are thin | Global products win on decision support, not just workflows | Expand role-based dashboards and comparison views | Analytics hub with executive reporting | P0 |
| AI Enablement | AI exists in KPI/monthly/ops | Review, calibration, compensation, and 360 AI still uneven | AI value must appear in core workflows | Add copilot coverage to review and 360 | Cross-domain copilot layer | P1 |
| 360 / Multi-rater Feedback | Schema and partial API exist | No dedicated route, nomination flow, report UX, or AI summary | World-class performance products all support this capability | Add 360 hub, nomination, response, result, admin | Full 360 + development plan system | P0 |

## Recommended Immediate Product Themes
1. Review quality and reviewer productivity
2. 360 multi-rater foundation
3. Role-based reporting and explainability
4. AI inside workflow, not outside workflow

## Implementation Defaults
- Expose 360 to all authenticated roles, but vary what they see by role and relationship.
- Treat 360 as evidence and development input first, not as a direct pay formula input in v1.
- Keep schema migration risk low in the first pass by using existing feedback models and `AuditLog` for provisional nomination persistence.
- Reuse existing evaluation and AI governance patterns rather than introducing a separate architecture.
