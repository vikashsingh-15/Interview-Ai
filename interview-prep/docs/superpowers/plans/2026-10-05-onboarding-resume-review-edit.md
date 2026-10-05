# Onboarding Resume Review and Edit Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a user review an already-active resume, edit extracted facts, add and confirm projects, and save/start practice without the current entry-ID error or an incorrectly disabled button.

**Architecture:** Keep the existing review-gated resume model and onboarding API. Fix resume selection so review always targets the active resume, normalize embedded entry IDs at the review boundary so old/new entries are unambiguous, and make the frontend state reflect a successful review rather than an initial `userModified` flag alone.

**Tech Stack:** Next.js/React/TypeScript frontend, Express/TypeScript backend, Mongoose, Zod, Jest, Playwright.

**Spec:** User report and screenshots in the task request.

## Global Constraints

- Resume facts remain untrusted until the user explicitly confirms them.
- New projects and experiences must be addable without resume-upload replacement.
- Existing projects must remain editable and confirmable; removed entries must not personalize practice.
- Resume entry IDs must be unique within the submitted resume and owned by that resume profile.
- Do not weaken user scoping or accept IDs from another resume.

## Review Focus

- Active resume differs from the first non-deleted resume: review must use the active resume’s current version.
- Newly added entries have no client ID: the server must assign stable embedded IDs before save.
- A client submits the same existing ID twice: reject with the existing validation error.
- A client submits an ID belonging to another profile: reject with the existing validation error.
- Saving review must enable the final onboarding action immediately, while any later edit disables it until review is saved again.

### Task 1: Backend review targeting and embedded ID normalization

**Files:**
- Modify: `interview-prep/backend/src/modules/profile/onboarding.routes.ts`
- Test: `interview-prep/backend/tests/integration/user-journey.test.ts` or a focused new integration test beside it
- Test: `interview-prep/backend/tests/unit/audit-regressions.test.ts`

**Interfaces:**
- Consumes the authenticated user ID and active resume from `resumeService.getResume`/`Resume`.
- Produces a persisted `ResumeProfile` whose `experience` and `projects` entries each have one unique Mongoose ObjectId.

- [ ] **Step 1: Add failing tests** for review selecting the active resume when another non-deleted resume exists, assigning IDs to new project/experience entries, and rejecting duplicate or foreign IDs.
- [ ] **Step 2: Run the focused backend tests** with `npm test -- --runInBand tests/unit/audit-regressions.test.ts tests/integration/user-journey.test.ts` from `interview-prep/backend`; confirm the new cases fail.
- [ ] **Step 3: Implement the minimal route fix**: query `isActive: true` for review, validate IDs against that profile, generate `new mongoose.Types.ObjectId()` for entries without IDs, and preserve valid owned IDs exactly once before assigning the arrays and saving.
- [ ] **Step 4: Run the focused tests** and confirm they pass, including the existing identifier-preservation regression.

### Task 2: Frontend onboarding review state and editable project UX

**Files:**
- Modify: `interview-prep/frontend/src/app/onboarding/page.tsx`
- Test: `interview-prep/frontend/tests/e2e/source-practice.spec.ts` or a new onboarding E2E test

**Interfaces:**
- Consumes the normalized review response from `PUT /api/profile/review`.
- Produces an enabled “Save profile and start practice” action after a successful review save, and editable/addable project cards while an active resume is loaded.

- [ ] **Step 1: Add a browser test** that loads onboarding with a parsed active resume, edits/adds a project, saves reviewed facts, and asserts the final button becomes enabled; assert editing afterward disables it until review is saved again.
- [ ] **Step 2: Run the focused E2E test** with the frontend’s configured Playwright command and confirm it fails against the current `reviewed` initialization/state behavior.
- [ ] **Step 3: Update onboarding state handling** so the loaded profile’s existing `userModified` state does not incorrectly block a loaded active resume, while every local fact/project/confirmation edit marks review stale; after review save, replace facts with the server-normalized response and set `reviewed` true.
- [ ] **Step 4: Keep the existing project editor/add-project controls** but ensure new entries use complete schema-compatible defaults and stable React keys based on entry ID with an index fallback.
- [ ] **Step 5: Run the focused E2E test and frontend typecheck/build**; confirm the button, edit, add, confirm, and save flow works.

### Task 3: Full regression verification

**Files:**
- No additional source files unless failures from Tasks 1–2 require small fixes.

- [ ] **Step 1: Run the backend test suite** from `interview-prep/backend` with `npm test -- --runInBand`.
- [ ] **Step 2: Run the frontend checks** from `interview-prep/frontend` with the repository’s typecheck/build scripts.
- [ ] **Step 3: Review the diff** for user scoping, accidental data deletion, and unchanged review-gated practice semantics.

## Self-Review

- The plan covers the reported validation error, active-resume targeting, project editing/addition, and disabled final action.
- Backend tests pin both security invariants and ID normalization; frontend coverage pins the user-visible state transition.
- No schema or retention changes are required; new entries remain attached to the current resume profile.
