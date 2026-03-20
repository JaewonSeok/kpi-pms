# 360 Feedback PRD

## Product Goal
Add a world-class 360 feedback foundation that fits into the current KPI PMS as:
- structured multi-rater evidence for reviews
- an input to development planning
- a fairness-supporting signal during calibration

In v1, 360 is not a direct compensation formula input.

## Users and Roles
- Employee: nominate reviewers, respond, view own report
- Manager: approve nominations, review reports, use themes in coaching
- Admin / HR Ops: configure rounds, monitor response rates, handle quality flags
- CEO: aggregate visibility only by default

## Cycle Flow
1. Round setup inside an evaluation cycle
2. Reviewer nomination or manager-curated reviewer assignment
3. Reviewer approval and invitation
4. Response collection and reminder cadence
5. Quality checks and anonymity threshold checks
6. Report generation
7. Evaluation linkage
8. Development plan follow-up

## Default Product Decisions
- Default nomination mode: manager-approved nomination
- Default anonymity threshold: 3
- Default round types: `PEER`, `UPWARD`, `CROSS_DEPT`, `FULL_360`
- Default v1 outcome: report + themes + development preview

## Required Routes
- `/evaluation/360`
- `/evaluation/360/nomination`
- `/evaluation/360/results`
- `/evaluation/360/admin`
- `/evaluation/360/respond/[feedbackId]`

## Required Screens

### 360 Hub
- cycle summary
- pending response count
- submitted response count
- response rate cards
- anonymity status
- links to nomination, results, admin, and evaluation workbench

### Nomination
- target employee selector or self context
- reviewer groups: supervisor, peer, subordinate, self
- AI reviewer recommendation preview
- submitted draft preview
- anonymity and minimum response guidance

### Results
- response rate status
- anonymity threshold status
- strengths themes
- blind spots / improvement themes
- anonymous summary
- development plan preview
- placeholders linking to evaluation results, appeal, calibration

### Admin
- round roster
- response rate by round and by relationship group
- low-response and careless-review flags
- round health
- reminder readiness

## Required Schema Backlog
- Extend `MultiFeedbackRound` with nomination and threshold settings
- Add `FeedbackNomination`
- Add report cache or summary persistence
- Add optional quality flags on `MultiFeedback`
- Add `DevelopmentPlan`

## Required API Backlog
- `GET/POST /api/feedback/rounds`
- `GET/PATCH /api/feedback/rounds/[id]`
- `GET/POST /api/feedback/rounds/[id]/nominations`
- `GET/POST /api/feedback/respond/[feedbackId]`
- `GET /api/feedback/report/[empId]`
- `POST /api/feedback/report/[empId]/summarize`
- `POST /api/feedback/rounds/[id]/remind`

## V1 Implementation Strategy
- Reuse current feedback schema for read flows.
- Use `AuditLog` to persist nomination drafts safely before schema expansion.
- Expose 360 routes to all authenticated roles, but filter data by role and relationship.
- Reuse evaluation workbench and results links rather than building an isolated module.

## AI-Augmented 360
- reviewer recommendation
- anonymous theme summarization
- careless review detection
- development plan generation

## Success Criteria
- Users can navigate to a non-empty 360 surface.
- Managers can understand nomination and response state.
- Employees can see a safe, anonymized result shell.
- Admins can monitor rounds even before full schema expansion.
- The repo clearly shows the intended product direction for future iteration.
