# Multi-Resume Context-Aware Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing interview-preparation application to support multiple named resumes per user, one persisted active resume, immutable resume/version context on generated activity, and a reusable context-aware practice flow while preserving unified user-level topics, calendar, history, tracker, and planner behavior.

**Architecture:** Keep the existing Next.js App Router + Express + MongoDB/Mongoose architecture, cookie-session authentication, GridFS/local resume storage, and shared topic/project/experience practice pipeline. Add a user-owned `Resume` container per named resume, retain immutable `ResumeVersion` and `ResumeProfile` records, store both resume and version references on every resume-dependent question/session/history/calendar record, and resolve answer context from the stored question snapshot rather than the current active resume. Use MongoDB transactions where available plus a partial unique active-resume index/guarded update to enforce one active resume per user.

**Tech Stack:** TypeScript, Express, Next.js 15 App Router, React, MongoDB/Mongoose 8, Zod, Jest/Supertest, Playwright, existing provider-neutral structured AI service, GridFS/local resume storage.

**Spec:** User-provided pasted requirements in `C:\Users\singh\.codex\attachments\47041470-2ef2-4415-9d32-b88a8f557e78\Pasted text.txt`

## Global Constraints

- Every backend query must derive ownership from the authenticated session user; never trust a frontend-supplied `userId`.
- A user has exactly one active resume; active state is persisted server-side and switching never deletes or resets historical activity.
- Historical questions and answers retain immutable `resumeId` + `resumeVersionId` context; renames and later uploads cannot rewrite that context.
- Topics, calendar, history, tracker, planner, and analytics remain user-global, with optional resume filtering only.
- Reuse the existing practice and answer services; do not create separate generation engines for topics, projects, experience, and resumes.
- Resume/project/experience facts are untrusted data, not instructions; preserve prompt-injection defenses and structured-output validation.
- Preserve local development and Vercel/Render deployment configuration; backend uses `process.env.PORT`, frontend uses environment-based API configuration, and secrets remain backend-only.
- Do not delete existing data, historical questions, old versions, storage files, or working modules during migration.

## Review Focus

- Concurrent activation/upload: the user must never observe two active resumes or a newly generated record without a version reference. Test in Task 2.
- Legacy records with only `resumeProfileId`: they remain readable and are safely backfilled/resolved without inventing ownership. Test in Task 3.
- Answering an old question after switching and reuploading: the original profile/version facts must be used. Test in Task 5.
- Same global topic across two resumes: both question contexts appear together and filtering is optional, not a separate topic system. Test in Task 6.
- User B probing User A IDs, files, questions, sources, calendar, tracker, and planner: every endpoint returns the existing not-found/unauthorized convention. Test in Task 7.

---

### Task 1: Baseline audit, contracts, and focused fixtures

**Files:**
- Create: `backend/tests/helpers/multi-resume-fixtures.ts`
- Create: `backend/tests/integration/multi-resume-contracts.test.ts`
- Modify: `backend/src/modules/resume/resume.model.ts`
- Modify: `backend/src/modules/resume/resume-profile.model.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: existing `Resume`, `ResumeVersion`, `ResumeProfile`, `QuestionHistory`, `DailyRecord`, auth test helpers, and current API response envelope.
- Produces: typed `ResumeSummary`, `ResumeVersionSummary`, `ActiveResumeContext`, and reusable two-user/two-resume fixtures for later tasks.

- [ ] **Step 1: Write failing contract tests** for two users, two named resume containers, version/profile ownership, active-resume response shape, and question context fields.
- [ ] **Step 2: Run the focused tests** with `npm --prefix backend test -- --runInBand tests/integration/multi-resume-contracts.test.ts`; expected failures identify the missing fields/contracts.
- [ ] **Step 3: Add only the shared TypeScript interfaces and fixture builders**; preserve current API envelopes and existing legacy fields.
- [ ] **Step 4: Run backend and frontend typechecks**; expected PASS for the new contracts and existing code.
- [ ] **Step 5: Commit** `test: define multi-resume contracts and fixtures`.

### Task 2: Multi-resume model and atomic active-resume lifecycle

**Files:**
- Modify: `backend/src/modules/resume/resume.model.ts`
- Modify: `backend/src/modules/auth/user.model.ts`
- Modify: `backend/src/modules/resume/resume.service.ts`
- Modify: `backend/src/modules/resume/resume.controller.ts`
- Modify: `backend/src/modules/resume/routes.ts`
- Create: `backend/tests/integration/resume-management.test.ts`
- Modify: `backend/src/index.ts` only if model registration/import order requires it

**Interfaces:**
- Consumes: authenticated `userId`, existing upload/parse/storage flow, Task 1 types.
- Produces: `listResumes(userId)`, `getActiveResume(userId)`, `activateResume(userId, resumeId)`, `renameResume(userId, resumeId, name, targetRole?)`, upload-new-version scoped to a resume, and owner-only resume/version/profile endpoints.

- [ ] **Step 1: Write failing API tests** covering first upload activation, second named upload, list/summary, rename, activation switch, invalid-owner IDs, and concurrent activation invariant.
- [ ] **Step 2: Run the focused tests** and verify failure on missing multi-resume routes/fields.
- [ ] **Step 3: Extend the resume container** with `name`, optional `targetRole`, `isActive`, soft archive/delete state, current version, and user compound/partial indexes; add the user active-resume pointer only if the existing schema/query pattern needs it.
- [ ] **Step 4: Implement service/controller operations** with ownership filters on every lookup. Activation must use a transaction when supported and a guarded update/unique partial index fallback otherwise; re-read the result before returning.
- [ ] **Step 5: Adapt upload/replace/delete behavior** so a new upload creates a version under the selected resume, first usable resume becomes active, and deleting/archiving an active resume selects the newest remaining usable resume without deleting historical versions.
- [ ] **Step 6: Run the focused management tests**; expected PASS including “at most one active resume per user.”
- [ ] **Step 7: Commit** `feat: add owner-scoped multi-resume lifecycle`.

### Task 3: Immutable context propagation and safe migration

**Files:**
- Modify: `backend/src/modules/questions/question.model.ts`
- Modify: `backend/src/modules/questions/question-history.model.ts`
- Modify: `backend/src/modules/sessions/daily-session.model.ts`
- Modify: `backend/src/modules/calendar/daily-record.model.ts`
- Modify: `backend/src/modules/calendar/calendar.service.ts`
- Modify: `backend/src/modules/projects/project.model.ts` only where context is missing
- Modify: `backend/src/modules/questions/question.service.ts`
- Modify: `backend/src/modules/sessions/session.service.ts`
- Create: `backend/src/scripts/migrate-multi-resume-context.ts`
- Create: `backend/tests/integration/multi-resume-migration.test.ts`

**Interfaces:**
- Consumes: Task 2 resume containers and existing legacy `resumeProfileId` fields.
- Produces: `resumeId`, `resumeVersionId`, and optional immutable `resumeNameSnapshot` on resume-dependent question/session/history/calendar projections; a dry-run/idempotent migration command.

- [ ] **Step 1: Write failing tests** for new records storing both IDs, same-day mixed-resume calendar entries, legacy records remaining readable, and migration idempotency.
- [ ] **Step 2: Run the focused tests** and confirm missing propagation/backfill behavior.
- [ ] **Step 3: Add fields, compound indexes, and serialization helpers** without making old fields required for legacy documents.
- [ ] **Step 4: Update session/calendar/history persistence** to snapshot context at creation time and group only by user/date, never by resume.
- [ ] **Step 5: Implement the migration** to resolve `resumeProfileId -> ResumeVersion -> Resume`, constrain by user ownership, report unresolved rows, never overwrite an existing explicit context, and support `--dry-run`/idempotent reruns.
- [ ] **Step 6: Run migration tests, typecheck, and `git diff --check`**; expected PASS with no live-data mutation.
- [ ] **Step 7: Commit** `feat: persist immutable resume context on activity`.

### Task 4: Shared active-context resolver and resume-aware generation

**Files:**
- Create: `backend/src/modules/resume/resume-context.service.ts`
- Modify: `backend/src/modules/questions/personalized-generator.ts`
- Modify: `backend/src/modules/questions/ai-question-generator.service.ts`
- Modify: `backend/src/modules/topics/topic-practice.service.ts`
- Modify: `backend/src/modules/topics/practice-source.ts`
- Modify: `backend/src/modules/sessions/session.service.ts`
- Create: `backend/tests/unit/resume-context.service.test.ts`
- Modify: `backend/tests/integration/topic-practice.test.ts`
- Modify: `backend/tests/integration/source-practice.test.ts`

**Interfaces:**
- Consumes: `resolveActiveResumeContext(userId)`, `resolveStoredQuestionContext(userId, question)`, immutable profile/version records, existing source facts and AI provider.
- Produces: one reusable practice-engine input containing `sourceType`, `sourceId`, `resumeId`, `resumeVersionId`, source facts, difficulty, question types, count, and exclusions.

- [ ] **Step 1: Write failing unit/integration tests** proving generation uses active SDE then active Data Engineer, source facts are grounded, and no user can substitute another user’s source ID.
- [ ] **Step 2: Implement the context resolver** with owner checks, active resume lookup, profile/version loading, and clear errors for no active/parse-pending context.
- [ ] **Step 3: Refactor existing topic/project/experience/resume generation callers** to pass the shared context object and persist its IDs; keep coding/general curated practice behavior intact.
- [ ] **Step 4: Add previous-question exclusion scoped to the same user/context** without loading unbounded history.
- [ ] **Step 5: Run focused practice tests and provider-mocked tests**; expected PASS with no generic substitution when grounded facts exist.
- [ ] **Step 6: Commit** `feat: unify active resume practice context`.

### Task 5: Historical answer resolution and practice-session context

**Files:**
- Modify: `backend/src/modules/questions/answer.service.ts`
- Modify: `backend/src/modules/questions/routes.ts`
- Modify: `backend/src/modules/questions/question.service.ts`
- Modify: `backend/src/modules/sessions/daily-session.model.ts`
- Modify: `backend/src/modules/sessions/session.service.ts`
- Create: `backend/tests/integration/historical-answer-context.test.ts`

**Interfaces:**
- Consumes: `resolveStoredQuestionContext`, question/history immutable IDs, existing structured answer service.
- Produces: answer generation that accepts a stored question/history context and practice sessions that record the context used for their questions.

- [ ] **Step 1: Write a failing test** that generates a Data Engineer question, switches to SDE, reuploads Data Engineer, then asserts answer prompts use the original Data Engineer version/profile.
- [ ] **Step 2: Update answer lookup** to load the owned question/history and stored version/profile/source snapshot; only fall back to active context for legacy records with no stored context, with an explicit compatibility path.
- [ ] **Step 3: Persist session-level context and question IDs** at generation time; ensure answer regeneration never mutates original provenance.
- [ ] **Step 4: Run the historical-answer test plus existing answer/session suites**; expected PASS.
- [ ] **Step 5: Commit** `fix: answer historical questions from original resume context`.

### Task 6: Unified topics, projects, experience, calendar, history, tracker, planner, and analytics

**Files:**
- Modify: `backend/src/modules/topics/routes.ts`
- Modify: `backend/src/modules/topics/topic-practice.service.ts`
- Modify: `backend/src/modules/projects/routes.ts`
- Modify: `backend/src/modules/calendar/calendar.service.ts`
- Modify: `backend/src/modules/calendar/routes.ts`
- Modify: `backend/src/modules/profile/routes.ts`
- Modify: `backend/src/modules/analytics/routes.ts`
- Modify: `backend/src/modules/tracker/tracker.service.ts`
- Modify: `backend/src/modules/planner/planner.service.ts`
- Modify: `frontend/src/types/index.ts`
- Create: `backend/tests/integration/unified-resume-activity.test.ts`

**Interfaces:**
- Consumes: immutable activity context and shared practice engine from Tasks 3–5.
- Produces: user-global queries with optional `resumeId` filters, topic aggregation across resumes, same-day breakdowns by resume badge, and bounded date-range/paginated responses.

- [ ] **Step 1: Write failing integration tests** for 12 SDE + 10 Data Engineer on one date, global Java questions across resumes, optional resume filtering, unified tracker/planner totals, and bounded history queries.
- [ ] **Step 2: Update aggregation/query filters** to use `userId` plus optional context filters; remove any accidental active-resume filtering from historical reads.
- [ ] **Step 3: Add resume labels/badges and per-resume calendar breakdowns** from stored snapshots/refs while retaining a single daily record.
- [ ] **Step 4: Add indexes and pagination/date-range bounds** for the actual query patterns; avoid N+1 lookups by bulk-loading resume summaries.
- [ ] **Step 5: Run existing calendar/history/tracker/planner/topic suites plus the new integration test**; expected PASS.
- [ ] **Step 6: Commit** `feat: keep activity unified across resume contexts`.

### Task 7: Frontend resume management and active-resume UX

**Files:**
- Create: `frontend/src/app/resumes/page.tsx`
- Create: `frontend/src/components/resume/ResumeManager.tsx`
- Create: `frontend/src/components/resume/ActiveResumeSelector.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/app/onboarding/page.tsx`
- Modify: `frontend/src/app/topics/page.tsx`
- Modify: `frontend/src/components/features/PracticeConfigDialog.tsx`
- Modify: `frontend/src/components/features/PracticeScreen.tsx`
- Modify: `frontend/src/components/calendar/InterviewCalendar.tsx`
- Modify: `frontend/src/app/history/page.tsx`
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/tests/e2e/multi-resume-flow.spec.ts`

**Interfaces:**
- Consumes: resume list/active/rename/version APIs and unified activity responses from Tasks 2 and 6.
- Produces: visible active selector, dedicated management page, upload/rename/activate/version actions, resume badges, optional filters, and refresh behavior that never clears historical data.

- [ ] **Step 1: Write Playwright tests** for management visibility, activation switch, today’s mixed activity, historical badge, and active context after reload using mocked API fixtures where existing E2E conventions require it.
- [ ] **Step 2: Implement typed API calls and query state** using the existing page-local state/request conventions; backend remains source of truth, with cache only for display.
- [ ] **Step 3: Implement management cards and guarded destructive/archive affordances** with parse/status/count summaries and accessible dialogs.
- [ ] **Step 4: Add selector/dashboard/practice integration**; switching refreshes future-generation context and dashboard data but does not reset calendar/history/tracker/planner.
- [ ] **Step 5: Add badges/filter controls** to calendar, history, topic results, project/experience practice results, and answer views.
- [ ] **Step 6: Run frontend typecheck, lint, build, and focused Playwright tests**; expected PASS.
- [ ] **Step 7: Commit** `feat: add multi-resume management and context UI`.

### Task 8: Security, deployment, migration documentation, and full verification

**Files:**
- Modify: `docs/SECURITY.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ENVIRONMENT.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `README.md`
- Modify: `backend/tests/integration/*` only for authorization regressions
- Modify: `scripts/audit-runtime.mjs` if the new routes need inventory coverage

**Interfaces:**
- Consumes: all prior API/model/frontend changes and migration command.
- Produces: documented rollout/backfill steps, deployment compatibility notes, and evidence-based test report.

- [ ] **Step 1: Add cross-user authorization tests** for resume/version/file/question/source/calendar/history/tracker/planner/analytics IDOR attempts and malformed IDs.
- [ ] **Step 2: Audit upload validation, storage downloads, CORS/origin checks, rate limits, AI authorization, environment variables, and Render/Vercel URLs**; change only evidenced defects.
- [ ] **Step 3: Document dry-run migration, backup/rollback, index creation, legacy fallback, and production rollout order** without running the migration against real user data.
- [ ] **Step 4: Run the full verification set:** backend build/typecheck/lint/tests, frontend typecheck/lint/build/E2E, `git diff --check`, and runtime health/unauthenticated smoke checks where safe.
- [ ] **Step 5: Review remaining risks** including transaction support, unresolved legacy rows, AI factual quality, hosted OAuth/database reachability, and browser/live deployment validation.
- [ ] **Step 6: Commit** `docs: document multi-resume rollout and security verification`.

## Self-Review

The plan covers the pasted specification’s main requirements: multi-user ownership, named multi-resume lifecycle, one active resume, immutable version context, grounded shared practice for topics/projects/experience, historical answer provenance, unified calendar/history/tracker/planner/topics, frontend management, security review, migration, performance indexes, deployment preservation, and the exact 12 + 10 same-day scenario. Existing architecture audit evidence shows projects and experiences already reuse `ResumeProfile`, so the plan intentionally extends their context instead of creating duplicate collections or engines. No files are planned for deletion.

The highest-risk compatibility points are legacy records that only have `resumeProfileId`, current `DailyRecord` date/timezone behavior, the existing global question uniqueness index, and whether the configured MongoDB deployment supports transactions. Each is explicitly tested or documented above.
