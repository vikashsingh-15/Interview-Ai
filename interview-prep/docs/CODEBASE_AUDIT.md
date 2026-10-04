# Codebase audit — 4 October 2026

## Architecture and pre-change findings

Next.js App Router frontend calls same-origin `/api`; Next rewrites to Express. Google OAuth redirects back through the frontend origin, allowing HttpOnly SameSite=Lax cookies without third-party cookies. MongoDB stores sessions, users, resume versions/profiles, questions/history, daily sessions, revisions, projects, coding problems/history, mock interviews, skill graphs, analytics, market calibration, web-search cache and calendar records. Resume binaries use GridFS; legacy local storage remains available for migration. OpenAI-compatible configured primary/fallback providers serve structured questions, answers, evaluation, resume extraction and personalization. External search supports DuckDuckGo, Stack Exchange and optional SerpAPI.

Frontend routes: landing, login, onboarding/resume review, dashboard, daily session, topics, projects, mock interview, search, history, calendar and settings. AuthProvider owns authentication; pages own request/UI state. Shared UI, AnswerView and PracticeConfigDialog already exist. No SSR API secrets or browser provider keys are required. Next handles routing and static assets. No application WebSocket server or cron scheduler exists; daily sessions are generated on demand and polled, not scheduled while Render sleeps.

Backend modules are mounted in `src/index.ts`; protected routes use cookie-session authentication, ownership checks and admin authorization where applicable. Helmet, CORS, origin checks, upload/rate limits, request IDs, structured logs, validation and error handling must remain. Health reports MongoDB readiness. Models register indirectly through imports and `mongoose.model()`; indirect references preclude simplistic unused-file deletion.

Existing uncommitted topic/answer/history/calendar work is the baseline and must be preserved. No real database mutations, migrations or seed commands are authorized by cleanup alone.

## Classification before removal

| Classification | Item | Evidence/action |
|---|---|---|
| REFACTOR | Project practice link | Opens generic `/mock-interview`, with no project ID; add source-specific practice using shared pipeline. |
| REFACTOR | Experience | Already embedded in ResumeProfile with company/role/dates/technologies/responsibilities/achievements/claims; reuse, do not duplicate models. |
| DEPLOYMENT CHANGE REQUIRED | Local validation | Rejects every `.mongodb.net` URI without resolving it; remove false failure. Validate ports in all environments. |
| DEPLOYMENT CHANGE REQUIRED | Dev launcher | Overrides database configuration with local MongoDB; respect explicitly configured remote URI. |
| REFACTOR | Lint | Expand the existing backend syntax checks with unused-binding diagnostics; replace frontend Next 15's obsolete `next lint` command. |
| KEEP | Auth/security/error/logging | Active production request paths and tests. |
| KEEP | Seeds/migrations | Explicit package commands and legacy data compatibility; never run against user data as cleanup. |
| KEEP | AI providers, search, embedding | Active runtime configurations, dynamic provider selection and tests. |
| KEEP | Root packages/locks | Separate existing install boundaries; don't collapse or regenerate blindly. |
| KEEP | Local environment/backup/logs | Private local artifacts; ignored, retain secrets/data, exclude deployment. |
| UNCERTAIN — KEEP | Broad model fields/methods/barrel exports | Historical data and dynamic model references cannot conclusively be ruled out. |
| UNCERTAIN — KEEP | Empty docker folder and old plans | No active Docker/CI manifest found; folder itself has no deployment cost. Historical documentation remains useful. |

No destructive cleanup or removal of test/security infrastructure is planned. Dependency and file inventories, final changes and verification results follow after implementation.

## Verified safe code removals

- Duplicate answer schemas/prompts and the exclusively internal `generateDetailedAnswer` method in session.service: all repository call sites traced; session authentication/ownership/state remain in the wrapper and answers now use the same tested service as topic/project/experience practice.
- Unused question-list projection constant: no references and no side effects.
- Duplicate analytics increment: incorrect second increment removed; regression test verifies exactly one total/type increment.
- Unused import bindings: ESLint plus TypeScript binding analysis prove no references; type-only imports have no runtime effect. Keep model registration imports wherever their side effects are needed.
- Unnecessary regex/string escaping: equivalent replacements only, protected by resume parsing and seed build checks.
- Eight redundant schema index declarations: identical field-level indexes remain, including unique constraints. No database index drops or syncIndexes calls were run.

No files, dependencies, user records, credentials, backups or historical uploads were deleted. Production and development build output are separated and ignored. Potentially unused model methods, scalability helpers and local tooling dependencies are retained where their usage/value could not be conclusively ruled out.

## Implemented interview features

- Topics, projects and experience use one PracticeScreen, configuration dialog and backend topic-practice service. Project links carry the project ID; Experience lists existing resume entries with employer, role, dates, technologies, responsibilities, achievements and claims. Unconfirmed entries require resume review before practice.
- Configuration supports Easy/Medium/Hard/Expert and mixed difficulty, question count 5/10/15/20 or custom 1-25, and multiple conceptual/technical/practical/scenario/troubleshooting/system-design/resume-deep-dive types. General topic practice also retains coding.
- The backend loads complete stored source facts after checking ownership; the client cannot substitute another source's facts. Exact evidence strings and a quoted stored fact are required in generated source questions. Prompts prohibit invented personal implementations and label hypothetical design discussion. This grounding reduces hallucination risk; it cannot prove every generated sentence factually correct.
- Questions persist with owner, source kind/ID/label, source context and evidence snapshots. Same-named entries stay separate. General topic lists exclude source-specific questions. Shared answers, answer regeneration, skip, feedback, saved answers, history and calendar continue through existing endpoints and collections.
- Session answer reveal now calls the same answer service. Coding extras and structured conceptual/practical answers remain supported. Viewing/reviewing and "already know" feedback do not fabricate a perfect evaluation score. Source practice resumes are scoped by account and source in browser storage.
- Resume review preserves embedded identifiers; removing all confirmed resume projects hides synchronized projects without deleting historical records. Project role and architecture use their actual stored fields.

## Cleanup report

| Classification | Final action and evidence |
|---|---|
| SAFE TO REMOVE | Duplicate session answer implementation: repository call-site search and passing shared-answer/session tests. |
| SAFE TO REMOVE | Unused imports, private difficultyWeight helper, unused decay/entry-type/question-ID calculations and an unused calendar mapping: no references or side effects; TypeScript and ESLint checks. |
| SAFE TO REMOVE | Discarded day-history session lookup: passed a date to an ObjectId lookup and failed before the actual owner-scoped date query. Removed; day/1 API regression assertion passes. |
| SAFE TO REMOVE | Second analytics count and redundant schema indexes: regression test and identical retained field-level definitions. No database index mutation. |
| REFACTOR | PDF input converted to Uint8Array for legacy PDF.js: the identical real PDF fixture fails with Buffer and parses with Uint8Array; PDF/DOCX tests pass. |
| KEEP | Every dependency and file, security middleware, models, migrations/seeds, tests, configured providers, existing data and ignored private configuration. |
| UNCERTAIN - KEEP | Historical tools, root install boundary, optional exports/models, old plans and unknown topics.html. No destructive changes. |

Files removed: **none**. Dependencies removed: **none**. Configuration files removed: **none**. Private environment entries removed: **none**. No real-data migration, seed, index drop, upload deletion, deployment or account changes were performed. Existing uncommitted changes were preserved. Lockfile package versions are unchanged; metadata records the Node 22 engine requirement.

## Deployment deliverable

The detailed commands and complete variable classifications are in [ENVIRONMENT.md](ENVIRONMENT.md) and [DEPLOYMENT.md](DEPLOYMENT.md). Vercel root is interview-prep/frontend; Render root is interview-prep/backend. Vercel uses npm ci / npm run build; Render uses npm ci --include=dev && npm run build / npm start. render.yaml and frontend/vercel.json are provided.

Frontend BACKEND_API_URL is the HTTPS Render origin. Backend FRONTEND_URL is the canonical HTTPS Vercel origin; MONGODB_URI, Google client credentials and existing AI primary/fallback configuration stay backend-only. CORS allows only FRONTEND_URL with credentials, and mutation origin checks remain active. Register the Google callback on the frontend origin at /api/auth/google/callback. No browser secret variable is required.

Production validation rejects local database hosts, malformed origins, invalid ports/proxy counts and missing required deployment values. Local validation no longer incorrectly rejects Atlas URIs. Health bypasses the API rate budget. Development respects explicitly configured MongoDB; stopping processes requires verified workspace ownership. Development and production Next manifests use separate directories.

## Verification and release limits

| Check | Result |
|---|---|
| Backend npm install and frontend npm install | Passed; dependencies retained. |
| Backend npm run build | Passed. |
| Frontend npm run build | Passed; 16 routes including experience and source practice. |
| Root npm run typecheck | Passed for both apps. |
| Root npm run lint | Passed; final lint rerun recorded below. |
| Backend npm test -- --runInBand | 9 suites passed, 91 tests passed, 1 optional live test skipped. |
| User-journey regression after day-history repair | 10 tests passed, including day/1. |
| Frontend npm run test:e2e | 2 passed against the production build; API fixtures are mocked. Screenshot visually inspected. |
| Compiled npm start smoke | Health 200 with isolated database connected, unauthenticated API 401, untrusted mutation origin 403. |
| Configured database | Read-only ping passed. Existing configured database is local, not a verified hosted deployment. |
| Configured AI | Live minimal JSON response passed through the existing Gemini provider; the opt-in live AWS topic-generation test passed. The new live experience-grounding test is available but was not run after the interruption. |
| Production dependency audit | Backend: 0 reported production vulnerabilities. Frontend: 5 high entries in the Tailwind/glob chain, all stemming from the braces advisory below. |
| git diff --check and launcher syntax | Passed. |

Initial sandbox runs could not terminate test-owned Windows subprocesses reliably. Only verified audit test trees were stopped; reruns outside that restriction completed. The PDF failure was a real compatibility defect and was fixed, rather than hidden. The browser feedback selector was corrected to use the accessible combobox role.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched braces version as of this audit; npm reports braces 3.0.3 and Tailwind 3.4.19 as the current compatible versions. npm's suggested Tailwind 4 upgrade is a major migration, so it was not applied blindly. The traced usage is build/watch tooling reading repository glob patterns; application routes do not accept glob patterns for this tooling. That reduces observed runtime exposure but is not a security clearance. Raw production audit reports are saved alongside this document. Recheck the advisory and address it before release signoff.

Hosted Google login/callback, canonical-domain cookies and forwarded headers, hosted MongoDB reachability, Render cold start and persistence, and live source-question/answer quality remain staging checks. Automated source integration uses isolated databases and mocked AI; browser checks use mocked APIs. No claim of fully verified production readiness or deployed functionality is made.

## Follow-up fixes

The Projects page now also lists confirmed professional experience entries from the existing resume profile, linking into shared experience practice. Historical question IDs are resolved against the signed-in user's daily-session snapshots for the matching date, so older History and Calendar entries can expose Show answer and Generate answer. New session calendar entries store question IDs directly, including when a question is answered before it was first recorded in that day's calendar. History keeps answer access available for questions marked as already known. Backend and frontend builds, frontend typecheck and repository lint passed after these follow-up changes.
