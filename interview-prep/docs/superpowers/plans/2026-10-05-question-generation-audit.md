# Question Generation Reliability Plan

> **For agentic workers:** Use the native implementation workflow in this session; tasks are tracked below.

**Goal:** Make every practice section use its intended curated/AI sources reliably, avoid repeats, and expose accurate per-section failure reasons.

**Architecture:** Audit the daily-session and topic-practice generation paths, provider configuration/fallback selection, curated bank filtering, deduplication, and UI error presentation. Correct shared logic at its source and add regression coverage for each affected generation mode.

**Tech Stack:** TypeScript, Express, Mongoose, Jest, Next.js.

**Spec:** User report: system-design and resume-project sections return zero questions; review all question-generation sections for similar loose ends.

## Global Constraints

- Do not silently repeat previously exposed questions.
- Ground resume-project questions only in confirmed resume facts; hypothetical portfolio prompts must not claim personal experience.
- Keep the backend operational if optional seed initialization fails, but log it.
- Report failure against the section that actually failed.

## Review Focus

- Fallback-only AI configuration must work for technical, system-design, project, and coding generation.
- System-design focus-area aliases must find canonical curated system-design questions.
- Resume projects must generate grounded deep dives when confirmed, and truthful hypotheticals when none are confirmed.
- Regeneration must not strand sections because of stale exposure/section state or inaccurate quotas.
- Curated question eligibility and coding seed initialization must agree with selector filters.

## Tasks

### Task 1: Trace and test provider/source selection

**Files:** `backend/src/modules/questions/personalized-generator.ts`, `backend/src/modules/sessions/session.service.ts`, relevant Jest tests.

- [x] Cover fallback-only AI for personalized generation and test provider selection; coding already iterates configured provider candidates.
- [x] Cover architecture relevance for named system-design focus areas and initialize a 13-question curated bank.
- [x] Fix fallback-provider gating, remove arbitrary 100-question bank truncation, and retain owner/approval/visibility/exposure filters.

### Task 2: Repair daily section and regeneration behavior

**Files:** `backend/src/modules/sessions/session.service.ts`, session tests and generation UI as needed.

- [x] Test project fallback, system-design bank initialization, four-section generation, and coding shortfall diagnostics; keep failures on the affected section.
- [x] Clear stale notes on already-filled sections and keep shortage notes actionable.

### Task 3: Audit other generation entry points and validate

**Files:** `backend/src/modules/topics/topic-practice.service.ts`, question/session UI, relevant tests.

- [x] Fix standalone topic-practice generation to recognize fallback-only provider configuration; reviewed its existing curated-bank and seen-history behavior.
- [x] Add/fix tests; targeted unit/integration suites passed, backend build passed, and `git diff --check` passed.
