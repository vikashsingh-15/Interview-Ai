# Audit and experience practice implementation plan

> **For agentic workers:** Execute this plan task by task in the current session. The user explicitly requests implementation, with no rewrite or functionality loss.

**Goal:** Safely clean up the existing application and support scoped project and experience practice on Vercel and Render.

**Architecture:** Retain Next.js same-origin API rewrites, Express, MongoDB/GridFS and configured AI providers. Extend the existing topic practice pipeline with server-resolved source context; reuse answers, history, feedback and calendar.

**Tech Stack:** Next.js 15, React 18, Express 4, Mongoose 8, TypeScript, Zod, Jest.

**Spec:** User attachment `Pasted text.txt`, sections 1–25.

## Global constraints

- Preserve all existing functionality and existing uncommitted work.
- Do not delete anything whose usage cannot conclusively be ruled out.
- Keep local development, authentication, AI providers, tests and data intact.
- Frontend on Vercel; backend on Render; existing database and AI providers.
- No secrets in examples, browser code or reports.

## Review focus

- Same-named sources must retain separate questions and history.
- Another user's source identifiers must never disclose facts or questions.
- Missing AI configuration must return honest partial/empty results.
- Removed resume entries must not be used as confirmed experience.
- Hosted database configuration must remain usable in local development.

### Task 1: Record audit before cleanup

**Files:** `docs/CODEBASE_AUDIT.md`, `docs/ENVIRONMENT.md`.
- [ ] Inventory routes, models, dependencies, environments and infrastructure.
- [ ] Classify removals and retained uncertainty with usage evidence.

### Task 2: Shared source practice

**Files:** topic practice service/routes, question model, new source-context service, project sync, answer service.
**Interfaces:** `loadPracticeSource(userId, {kind,id})` returns owner-validated stored context; `startPracticeSet` accepts optional source. Existing answer/skip/feedback endpoints remain shared.
- [ ] Add integration tests for source ownership, association, filters, prompt grounding, calendar/history and cached answers.
- [ ] Implement source loading from Project and embedded ResumeProfile.experience; persist source IDs and context snapshots on Question.
- [ ] Generate bounded batches through the existing structured AI service, with evidence quotes validated against stored facts.
- [ ] Run regression and source integration tests.

### Task 3: Frontend integration

**Files:** shared Topics practice screen/dialog, projects page, experience page, source practice route, Header.
- [ ] Reuse practice configuration, answers, navigation and feedback for source practice.
- [ ] Show existing source questions and source history; scope resumable state per account/source.
- [ ] Verify typecheck, lint and production build.

### Task 4: Deployment and safe cleanup

**Files:** configuration validation, Next config, dev/stop scripts, package scripts, ESLint config, Render blueprint, example environment and deployment docs.
- [ ] Fix verified deployment/local defects without changing provider or database architecture.
- [ ] Remove only conclusively dead imports/dependencies/artifacts; retain user data and private environment files.
- [ ] Verify installation, backend build/start, frontend build, lint, tests and isolated database health.
- [ ] Report local evidence separately from live provider and hosted verification.
