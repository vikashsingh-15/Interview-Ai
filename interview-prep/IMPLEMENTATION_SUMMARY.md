# Implementation report — 2026-09-29

## Current configuration/authentication update

Resume storage now uses MongoDB GridFS via MONGODB_URI. S3/AWS code, dependency and env settings are removed. Legacy local files are retained; explicit migration is available and has not been run against user data.

Storage validation: backend and frontend production builds passed; backend lint passed; final Jest run passed all 6 suites / 45 tests. Tests cover real file bytes, MIME metadata, private downloads, account deletion, stream/metadata failure cleanup, verified local migration, corrupt-file rejection and disconnected storage. Live Render/Atlas verification remains outstanding.

The latest user requirement supersedes the earlier authentication setup below:
- One private `interview-prep/.env` serves both local apps; all env examples/development/production files are removed.
- Google-only sign-in replaces password registration/reset, verification email, JWTs and refresh tokens.
- One random login cookie is hashed in MongoDB, with fixed expiry and secure options. No Redis.
- AI uses `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` for OpenRouter/Gemini/OpenAI/custom compatible endpoints, across all AI consumers.
- Vercel proxies `/api` to Render using server-only `BACKEND_API_URL`; Google callback is derived from `FRONTEND_URL`.
- Twelve obsolete auth-related packages were removed; existing user/resume/question data was not deleted.
- Refer to the updated README and Deployment guide, not earlier env/password/SendGrid instructions below.

The following is the historical core-feature report. Its test counts and email/password instructions describe the previous implementation, not the Google-only update.

## Outcome and product positioning

The core flow is now a generic resume-driven multi-user preparation product, not a default Java/SDE-2 trainer. Arbitrary role/level, actual experience, optional companies, interview date, focus/avoid topics and custom daily categories are supported. Existing broader modules remain in place. The complete 57-section product brief is NOT claimed complete.

## Implemented changes

- Real PDF/DOCX text extraction and schema-validated AI extraction replace sample candidate data. Conservative no-AI parsing does not invent employers, projects or experience.
- Resume facts can be edited, rejected or explicitly confirmed. Unconfirmed claims cannot drive personalized questions. Re-upload invalidates completed onboarding.
- Onboarding connects upload, review, skill/project confirmation, goals, a curriculum outline and the first session.
- Question generation calls a real OpenAI-compatible provider, validates relevance/difficulty/schema/factual references, saves provenance/model/prompt versions and rejects repeated questions. It never pads shortages with template questions.
- Private question bank and per-user exposure history record questions at assignment time. Exact hash checks are atomic; near-text checks run against all prior exposures, including skipped questions. Concepts may repeat.
- A bounded generation plan includes confirmed facts, role/level, measured history, feedback and weaknesses. Session sections are configurable rather than hardcoded.
- Daily generation is same-day idempotent, leased and checkpointed; completed/failed generation states permit safe reuse/retry.
- Owned answer/history/evaluation/revision/feedback paths work. Feedback includes difficulty, relevance, incorrect/duplicate and revision signals.
- Dynamic mock interview route/page asks an answer-dependent follow-up with validated structure and repeat checks. Replayed turns are rejected.
- SendGrid delivers actual HTTP requests; disabled email no longer pretends delivery. Google OAuth adds verified state, nonce, PKCE, explicit linking and replay rejection.
- Private S3-compatible storage, authenticated downloads, retained file versions and local path containment are implemented.
- Persisted session revocation, hashed access/refresh/reset/verification tokens, refresh rotation, strict admin authorization, CSRF-origin checks and safe request IDs/logging improve ownership and security.
- Added migration, real extraction fixtures and isolated-database/provider tests. Removed the build-time Google font download; updated Next.js and backend tooling. Removed unused UUID dependency in favor of Node crypto.

## Important models

Resume/ResumeVersion/ResumeProfile: owned versioned file plus reviewed facts.
InterviewProfile: arbitrary role/level, actual experience and dynamic dailyPlan/curriculum.
Question: canonical private/public curated text, hash, provenance and quality metadata.
QuestionExposure: atomic per-user question/hash assignment history.
QuestionGenerationPlan: bounded confirmed-fact/history plan and generation outcome.
QuestionHistory/QuestionFeedback/Revision: answer evidence, feedback and explicit repetition.
AIUsage/AIRequest: per-user daily request allowance and metadata-only usage records.
DailySession/SessionQuestion: generation state/lease and assigned snapshots.
OAuthState/Session: short-lived OAuth state and revocable hashed authentication.

## New/updated APIs

Authentication: /api/auth/providers, /google, /google/callback, /google/link, /me, /refresh, /logout, /forgot-password, /reset-password and /verify-email.
Onboarding: GET /api/profile/onboarding, PUT /api/profile/review, POST /api/profile/onboarding.
Files: GET /api/resume/files/:versionId (owner only).
Daily practice: /api/sessions/generate, /today, owned session answer/history/completion routes.
Feedback: POST /api/feedback/:sessionId/:mappingId.
Mock interviewer: POST /api/mock-interviews/start, GET /:id, POST /:id/answer.
Admin: protected question quality/review and AI-usage routes under /api/admin.
Existing feature routes are retained.

## Simplification and preserved behavior

Runtime is still frontend + API + MongoDB. Broken/unused Docker Compose configurations and unused dependencies were removed; no Redis, queue, microservices, separate vector store or new orchestration is required. Existing user data/env values were not overwritten. Calendar, coding practice, history, revisions, analytics, projects and search were preserved, with targeted ownership/functional fixes.

Removing Docker has no runtime code dependency here, but cannot honestly promise zero effect on someone's external Docker workflow: those Compose entry points no longer exist. Native Node deployment instructions replace them.

## Validation

- Backend TypeScript production build: passed.
- Next.js production build, lint/type validation and static route generation: passed.
- Backend Jest: 4 suites, 32 tests passed. Actual PDF/DOCX fixtures and isolated MongoDB test registration/upload/review/onboarding, user isolation, concurrent generation, answer/history/revision/feedback, fresh-day repeat exclusion, refresh/logout, budget enforcement and mock follow-ups.
- AI, Google and SendGrid transport responses are mocked. No real credentials were consumed.
- No browser end-to-end test or production deployment validation completed.
- Backend and frontend dependency installs report zero known audit vulnerabilities after targeted updates. The frontend pins a patched PostCSS override for Next's older nested dependency; recheck advisories during future upgrades. An audit result is not a security certification.
- Migration exists but was not run against the user's database. S3 credentials, bucket policy, live Google/SendGrid/AI and deployed cookie behavior remain unverified.

## Remaining limitations and adjustments

1. AI factual correctness is not guaranteed by schema validation. Automated approved status is not human approval. Review content and provenance; disputed questions can be flagged. Independent reference verification and full admin review UI remain future work.
2. Semantic duplicate detection is approximate; exact normalized-text exclusion is stronger. Optional embeddings incur additional calls; no perfect paraphrase detector is claimed.
3. The curriculum is an outline, not a fully scheduled 90-day adaptive coach. Difficulty/context respond through planning preferences and feedback, not a validated learning-outcome engine.
4. Coding uses the curated problem bank; no sandbox executes arbitrary generated code. Test-case judging and AI-created verified coding problems are not implemented.
5. OCR, document antivirus scanning and strict DOCX decompression limits are not implemented. Prefer trusted text-based resumes; do not market uploads as fully hardened.
6. No resend-verification UI, settings Google-link button or dedicated Google-only deletion reauthentication flow yet.
7. Answer resubmissions can run evaluation/mastery updates again. Session completion is concurrency-claimed but progress/session updates are not a database transaction; crash-recovery reconciliation remains needed.
8. Optional legacy search/market/project modules were preserved, not independently end-to-end validated. Search AI and embeddings are not covered by the central generation request budget.
9. No global spend cap, circuit breaker, provider-specific Gemini adapter, full admin/prompt management, background scheduled jobs, payment/subscription or guarantee of free-host uptime.
10. Existing MongoDB indexes/data may need reviewed migration. Deployment must use backups, private durable storage, HTTPS and actual provider checks.

## Configuration and handoff

Follow [step-by-step setup/deployment](docs/DEPLOYMENT.md) and the updated backend/.env.example. Configure MongoDB + JWT for baseline; AI for fresh personalized generation; SendGrid before verification; Google Web OAuth for social sign-in; S3 for production. Keep secrets server-side. Re-test on staging with synthetic data before uploading sensitive resumes.
