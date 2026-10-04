# Monthly Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let a user create, organize, complete, and review monthly planner goals grouped by calendar week.

**Architecture:** Add a planner-specific owner-scoped model/service/router. A task is assigned to a year, month, and actual calendar week (weeks start Sunday, and week 1 is the first week containing a day of that month). Dashboard and History consume the same month API.

**Tech Stack:** Express, TypeScript, Mongoose, Jest/Supertest, Next.js App Router, React, Tailwind.

**Spec:** `C:\Users\singh\.codex\attachments\1b78c984-3dc2-4fb2-9085-a674520caec5\Pasted text.txt`

## Global Constraints

- Keep planner data separate from interview `DailyRecord` and tracker progress.
- Scope all operations by authenticated user.
- Use existing component/API patterns and add no dependencies.
- Carry-forward creates a new task in the destination week and leaves the source task unchanged.

## Review Focus

- Month boundaries and Sunday-start week grouping must be consistent for every calendar shape.
- Duplicate submissions must not create duplicate carry-forward items.
- Completing/deleting another user's task must be rejected as not found.
- Invalid months, weeks, priorities, and oversized content must be rejected at the API boundary.
- Empty weeks and months with four or six calendar rows must render without invented tasks.

---

### Task 1: Planner model, service, and API

**Files:**
- Create: `backend/src/modules/planner/planner-task.model.ts`
- Create: `backend/src/modules/planner/planner.service.ts`
- Create: `backend/src/modules/planner/routes.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/modules/planner/__tests__/planner.service.test.ts`
- Test: `backend/src/modules/planner/__tests__/planner.routes.test.ts`

**Interfaces:**
- `PlannerTask`: owner, month/year/week, title, optional description/category, priority, completion/completedAt, order, timestamps; indexed by owner/year/month/week.
- `GET /api/planner/tasks?year=YYYY&month=MM` returns that owner's tasks grouped or sortable by week.
- `POST /api/planner/tasks` creates a goal; `PUT /api/planner/tasks/:taskId` updates it; `DELETE` removes it.
- `POST /api/planner/tasks/:taskId/carry-forward` creates an idempotent copy in the selected destination week.

- [x] Test validation, owner isolation, completion timestamps, sort order, and carry-forward idempotency.
- [x] Implement model, indexes, validation, and owner-scoped service methods.
- [x] Add authenticated routes and register `/api/planner` in `backend/src/index.ts`.
- [x] Run targeted Jest tests, backend typecheck, and lint.

### Task 2: Dashboard planner summary

**Files:**
- Create: `frontend/src/components/planner/PlannerSection.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Current-month summary displays actual calendar weeks, goals, completion counts/percentages, and a link to Planner history.
- User can add and complete a goal from the dashboard without leaving existing dashboard flows.

- [x] Add API types and render month/week summary with empty/loading/error states.
- [x] Add create/complete interactions using existing UI components.
- [x] Run frontend typecheck, lint, and build.

