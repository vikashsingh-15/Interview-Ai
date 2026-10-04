# Dashboard Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add user-owned recurring tracker tasks, daily progress, and reliable progress summaries to the dashboard.

**Architecture:** Add tracker-specific Mongoose models and authenticated Express services/routes. Keep interview activity in `DailyRecord` and calculate interview suggestions from it at read time; persist only the user-confirmed or manually edited tracker progress in a separate entry collection. Reuse the existing dashboard components and API client.

**Tech Stack:** Express, TypeScript, Mongoose, Jest/Supertest, Next.js App Router, React, Tailwind.

**Spec:** `C:\Users\singh\.codex\attachments\1b78c984-3dc2-4fb2-9085-a674520caec5\Pasted text.txt`

## Global Constraints

- Preserve the existing interview session, calendar, analytics, and answer-reveal flows.
- Scope every tracker read/write to the authenticated user.
- Keep real interview activity in `DailyRecord`; do not duplicate it as tracker data.
- Use the app's established UTC `dateKey` convention until user timezone preferences exist.
- Never persist a suggested interview count as user-confirmed actual progress without an explicit user action.
- Do not add dependencies or remove existing infrastructure for this feature.

## Review Focus

- Repeated task initialization must not create duplicate defaults: verify concurrent/repeated `GET /tracker/tasks`.
- Cross-user task or entry IDs must not permit read/update/delete: verify owner isolation on each route.
- Zero-target, custom targets, and boolean units must not produce invalid percentages or completion.
- A `DailyRecord` with multiple question categories must suggest the intended interview count once per actual entry.
- UTC dates at local midnight boundaries must map consistently to the calendar's `YYYY-MM-DD` key.

---

### Task 1: Tracker persistence and task APIs

**Files:**
- Create: `backend/src/modules/tracker/tracker-task.model.ts`
- Create: `backend/src/modules/tracker/daily-tracker-entry.model.ts`
- Create: `backend/src/modules/tracker/tracker.service.ts`
- Create: `backend/src/modules/tracker/routes.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/modules/tracker/__tests__/tracker.service.test.ts`
- Test: `backend/src/modules/tracker/__tests__/tracker.routes.test.ts`

**Interfaces:**
- `TrackerTask`: owner, name, optional description/category, target, unit, frequency, active, order, timestamps.
- `DailyTrackerEntry`: owner, task, UTC `dateKey`, target snapshot, actual, completion override, completedAt, optional notes, timestamps; unique `{ userId, taskId, dateKey }` index.
- `GET /api/tracker/tasks` returns active tasks, initializing the agreed default tasks idempotently when needed.
- `POST /api/tracker/tasks` creates a task; `PUT /api/tracker/tasks/:taskId` updates owner-owned task fields; `DELETE` deactivates it.
- `GET /api/tracker/entries?date=...` and `?start=...&end=...` return owner-owned entries joined with task display data; `POST` upserts by owner/task/date; `DELETE /api/tracker/entries/:entryId` deletes only the owner's entry.

- [x] Test default task initialization, repeat/concurrent creation, valid task CRUD, validation errors, and owner isolation.
- [x] Test entry upsert uniqueness, copied target, actual bounds, boolean completion, and owner isolation.
- [x] Implement schemas, indexes, validation, and service functions using existing auth/error conventions.
- [x] Add authenticated routes and register `/api/tracker` in `backend/src/index.ts`.
- [x] Run targeted Jest tests, backend typecheck, and lint.

### Task 2: Tracker progress and analytics

**Files:**
- Modify: `backend/src/modules/tracker/tracker.service.ts`
- Modify: `backend/src/modules/tracker/routes.ts`
- Test: `backend/src/modules/tracker/__tests__/tracker.analytics.test.ts`

**Interfaces:**
- `GET /api/tracker/analytics/today`, `/week`, and `/month` return completion counts, completion percentage, and current streak.
- `GET /api/tracker/analytics/target-vs-actual?period=month|week&year=...&month=...` returns period buckets and totals.
- Interview-practice suggestions use that day's `DailyRecord` question entries, excluding searches and never writing suggestions as actuals.

- [x] Test streak behavior for daily/weekly/monthly tasks, missing dates, inactive tasks, and incomplete tasks.
- [x] Test target-vs-actual for elapsed and future dates, boolean units, and no-data periods.
- [x] Implement aggregated period queries without per-task N+1 lookups; define one shared completion calculation.
- [x] Implement read-only interview progress suggestions and explicit user-confirmed save behavior.
- [x] Run targeted tests, typecheck, and lint.

### Task 3: Dashboard tracker section

**Files:**
- Create: `frontend/src/components/tracker/TrackerSection.tsx`
- Create: `frontend/src/components/tracker/useTracker.ts` (only if shared fetching logic warrants a hook)
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Tracker section displays today's completed/total tasks and progress; task rows show target, actual, unit, and interview suggestion when available.
- User can accept/edit suggested progress, update manual progress, create/edit/deactivate tasks, and open tracker history.

- [x] Add serializable tracker API types and connect the authenticated dashboard to today's tracker data.
- [x] Implement loading, empty, saving, and error states with existing UI components.
- [x] Ensure suggestions are visually distinct until explicitly saved; preserve mobile stacking.
- [x] Run frontend typecheck, lint, and build.

