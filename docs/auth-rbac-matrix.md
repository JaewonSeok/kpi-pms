# Auth / RBAC Matrix

This document supplements the current Auth.js and middleware implementation with the menu-level matrix now encoded in code.

## Session claims

- `role`
- `empId`
- `position`
- `deptId`
- `deptName`
- `departmentCode`
- `managerId`
- `orgPath`
- `accessibleDepartmentIds`

## Menu access summary

| Menu key | Allowed roles |
| --- | --- |
| `ORG_MANAGE` | `ROLE_ADMIN` |
| `GRADE_SETTING` | `ROLE_ADMIN` |
| `EVAL_CYCLE` | `ROLE_ADMIN` |
| `ORG_KPI_UPLOAD` | `ROLE_ADMIN` |
| `PERSONAL_KPI_UPLOAD` | `ROLE_ADMIN`, `ROLE_TEAM_LEADER` |
| `KPI_SETTING` | All authenticated roles |
| `MONTHLY_INPUT` | `ROLE_ADMIN`, `ROLE_TEAM_LEADER`, `ROLE_MEMBER` |
| `GRADE_ADJUST` | `ROLE_ADMIN`, `ROLE_CEO` |
| `COMPENSATION_MANAGE` | `ROLE_ADMIN`, `ROLE_DIV_HEAD`, `ROLE_CEO` |
| `COMPENSATION_SELF` | All authenticated roles |
| `NOTIFICATIONS` | All authenticated roles |
| `SYSTEM_SETTING` | `ROLE_ADMIN` |

## Organization scope defaults

- `ROLE_ADMIN`, `ROLE_CEO`: all departments
- `ROLE_DIV_HEAD`: own department + descendants
- `ROLE_SECTION_CHIEF`: own department + descendants
- `ROLE_TEAM_LEADER`: own department + descendants
- `ROLE_MEMBER`: own employee record only; department scope array remains empty

## Current limits

- Credentials login remains an emergency admin path backed by env credentials, not DB password hash flow.
- Password reset, failed-login lockout, and GWS sync are not yet implemented in code.
- The matrix helpers are available in code and middleware, but older routes still contain some local role checks that should be unified gradually.
