# Unified History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring interview, tracker, and planner activity into one History destination while retaining the existing interview-question history behavior.

**Architecture:** Keep the current `DailyRecord`-backed interview history and answer-reveal flow intact. Add lazy-loaded Tracker and Planner tabs that consume their own authenticated APIs and the existing tracker/planner models. Share small presentational date/month navigation pieces only when they make the existing layouts clearer.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, existing UI components and API client.

**Spec:** `C:\Users\singh\.codex\attachments\1b78c984-3dc2-4fb2-9085-a674520caec5\Pasted text.txt`

## Global Constraints

- Preserve interview question history, answer reveal/regeneration, known marking, and existing API semantics.
- Fetch tracker/planner history only when selected and limit requests to the visible month/date range.
- Keep all user-specific authorization in backend services; frontend tabs are not a security boundary.
- Reuse the existing UTC `DailyRecord.dateKey` behavior consistently.
- Responsive calendar and day detail must work on narrow screens without hiding controls.

## Review Focus

- Switching tabs or months must not show stale data from the previously selected period.
- Empty tracker/planner ranges must render as empty states, not as zero-completion days.
- Tracker date filters and task filters must affect both detail and analytics consistently.
- Carry-forward must refresh the correct planner month/week without duplicating its task.
- Existing Interview history answer controls and old-data ID recovery must remain available.

---

### Task 1: History navigation and lazy data loading

**Files:**
- Modify: `frontend/src/app/history/page.tsx`
- Create: `frontend/src/components/history/HistoryTabs.tsx` (if it keeps the page maintainable)
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Tabs: `Interview`, `Tracker`, `Planner`; Interview remains the initial/default tab.
- Tab switch loads the selected data only and reports tab-specific loading/error state.

- [x] Preserve existing Interview history rendering and verify answer reveal/generation and known marking still work.
- [x] Add accessible tabs with URL-independent local selection unless current app navigation establishes another pattern.
- [x] Add lazy fetch lifecycle, cancellation/stale-response protection, and retry UI.
- [x] Run frontend typecheck and lint.

### Task 2: Tracker history calendar and detail

**Files:**
- Create: `frontend/src/components/tracker/TrackerHistory.tsx`
- Create: `frontend/src/components/tracker/TrackerCalendarView.tsx`
- Create: `frontend/src/components/tracker/TrackerDayDetail.tsx`

**Interfaces:**
- Month navigation, day completion colors (complete/partial/incomplete/no data), selected-day task detail, date-range and task filters, completion/streak/target-vs-actual summary.
- The component consumes tracker task, entry, and analytics endpoints from the Tracker implementation plan.

- [x] Implement month and date-range controls and selected-day detail.
- [x] Render analytics from backend results and distinguish no-data dates from zero progress.
- [x] Check desktop and narrow-screen layout and verify filter/date consistency.
- [x] Run frontend typecheck, lint, and build.

### Task 3: Planner history and weekly review

**Files:**
- Create: `frontend/src/components/planner/PlannerHistory.tsx`
- Create: `frontend/src/components/planner/PlannerMonthView.tsx`
- Create: `frontend/src/components/planner/WeeklyReview.tsx`

**Interfaces:**
- Month navigator, tasks grouped by actual week, completion state, week review, and explicit carry-forward destination week.
- The component consumes the planner API from the Monthly Planner implementation plan.

- [x] Implement month navigation and grouped task presentation.
- [x] Implement weekly review and carry-forward; update the visible month after mutations.
- [x] Check desktop and narrow-screen layout, empty months, and destination week behavior.
- [x] Run frontend typecheck, lint, and build.

