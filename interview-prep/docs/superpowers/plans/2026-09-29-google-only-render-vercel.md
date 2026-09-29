# Google-only authentication and Vercel/Render configuration Implementation Plan

Latest user amendment: implement directly, and use ONE private root `.env` for both apps, with no example/development/production env files. This overrides the earlier file-layout and review-pause notes below. Implementation is proceeding natively; deployment/provider verification remains explicitly separate from local checks.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password/JWT authentication with Google-only sign-in and one opaque session cookie, remove obsolete env files/settings, and support configurable AI on Vercel + Render.

**Architecture:** Browser requests same-origin `/api` on Vercel, which proxies to Render. Render verifies Google OAuth, stores a hashed random session token in the existing MongoDB Session collection, and sets one HttpOnly cookie through the same-origin callback. All AI consumers use one provider-neutral adapter; no Redis, JWT, refresh tokens or additional auth service.

**Tech Stack:** Existing Next.js, Express, MongoDB/Mongoose, Google OAuth library, Node crypto and OpenAI-compatible transport.

**Spec:** This file's User requirements section, from the user's 2026-09-29 request.

## User requirements

- Frontend deployment on Vercel; backend deployment on Render.
- Review every env file and remove unnecessary files/variables.
- Google OAuth only; no password registration/reset/email verification flows.
- Explain/remove unnecessary JWT, cookie configuration and Redis configuration.
- AI must support OpenRouter, Gemini and other providers, not only OpenAI.

## Global Constraints

- Preserve existing workspace changes, database records, owned resumes and question-repeat protections.
- Never print, commit or overwrite real credentials. Existing private local settings must be inspected only by key/presence and migrated safely before obsolete files are removed.
- Keep one backend `.env.example` and one frontend `.env.example`; local secrets use backend `.env` and frontend `.env.local`. Deployment secrets live in dashboards, not `.env.production`.
- Keep necessary security defaults in code: HttpOnly, Secure in production, SameSite=Lax, fixed cookie name, seven-day session expiry, CSRF-origin checks and Google state/nonce/PKCE.
- No automatic merge of an existing password account merely because a Google identity has the same email. Require explicit account linking before cutover or a separately verified owner mapping; preserve data.
- Do not claim live Google/AI/S3 or deployed cookie verification from mocks/builds.
- This plan is awaiting user review; no runtime/auth/env changes have been implemented in this turn.

## Review Focus

1. Vercel callback/proxy must preserve cookies, redirects, uploads and Origin; live staging validation is necessary.
2. Existing password users must not lose owned data or be silently linked to another identity.
3. Expired/revoked/deleted-user sessions must fail even if a cookie remains in the browser.
4. All AI paths, including legacy search and optional embeddings, must use the selected endpoint; incompatible models must fail transparently.
5. Render restart must not lose resumes; keep private S3 configuration rather than pretending ephemeral local disk is durable.

---

### Task 1: Google-only opaque sessions

**Files:** Modify `backend/src/common/middleware/auth.ts`, `backend/src/modules/auth/index.model.ts`, `backend/src/modules/auth/google.service.ts`, `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/auth/auth.service.ts`, `backend/src/modules/auth/user.model.ts`, `backend/src/config/validate.ts`; test `backend/tests/integration/google-session.test.ts`.

**Interfaces:** `createSession(userId, userAgent): Promise<string>` returns a random 32-byte token; `authenticate` looks up its SHA256 hash, active status and expiry, then loads the owned user. `googleAuth.callback(...)` returns `{sessionToken}` rather than access/refresh JWTs.

- [ ] Add failing tests for Google callback success, state/nonce mismatch/replay, expired/revoked sessions, logout, deleted user and admin denial.
- [ ] Replace JWT creation/verification and refresh endpoints with MongoDB-backed opaque sessions; add TTL expiry to the Session collection, with explicit runtime expiry checks.
- [ ] Keep only providers, Google start/callback/link, current-user read/update/delete and logout auth routes. Remove password/email verification/reset code and bcrypt/JWT dependencies when no remaining callers exist.
- [ ] Require a recent Google-authenticated session and explicit deletion confirmation for account deletion; never require a nonexistent Google-user password. Keep file cleanup retryable and owner-scoped.
- [ ] Test existing-account collision refusal and explicit linking; document linking before Google-only cutover. Do not wipe existing sessions/data indiscriminately.
- [ ] Run the new auth suite; expected all tests pass. Do not commit unless the user asks.

### Task 2: Same-origin Vercel proxy and Google-only UI

**Files:** Modify `frontend/next.config.js`, `frontend/src/lib/api.ts`, `frontend/src/components/providers/AuthProvider.tsx`, `frontend/src/components/auth/LoginForm.tsx`, login/register pages, navigation/hero links and auth types. Remove unused register/password/reset/verification components/pages after references are replaced. Test `frontend/e2e/google-login.spec.ts`.

**Interfaces:** Axios base URL `/api`; browser Google redirect `/api/auth/google`; server-only `BACKEND_API_URL` supplies rewrite destination. Google callback is `${FRONTEND_URL}/api/auth/google/callback`, derived on the API.

- [ ] Add failing proxy/config tests and a mocked browser login test covering redirect, `/me`, reload and logout.
- [ ] Add a validated external `/api/:path*` rewrite to Render; remove redundant frontend CORS headers and NEXT_PUBLIC_API_URL.
- [ ] Remove password login/register methods and refresh interceptor; show one Google sign-in button with an honest configuration/error state. Old password routes must not keep functional forms.
- [ ] Derive the Google callback from FRONTEND_URL; document exact Google Console allowlisted Vercel and localhost callbacks. Keep callback cookie options consistent with logout.
- [ ] Verify multipart upload and ordinary authenticated mutations through the proxy without weakening CSRF checks. Prefer production-only domains, not arbitrary preview origins.
- [ ] Run frontend lint/build and isolated browser checks; state any missing browser/live staging verification.

### Task 3: Provider-neutral AI across every consumer

**Files:** Modify `backend/src/config/index.ts`, `backend/src/common/services/structured-ai.ts`, `backend/src/modules/questions/personalized-generator.ts`, `backend/src/modules/resume/resume-parser.ts`, `backend/src/modules/resume/resume.service.ts`, `backend/src/modules/evaluation/answer-evaluation.ts`, `backend/src/modules/mock-interviews/interviewer.routes.ts`, `backend/src/modules/web-search/answer-synthesis.ts`. Create `backend/src/common/services/ai-provider.ts`; test `backend/tests/unit/ai-provider.test.ts` and update provider integration tests.

**Interfaces:** `config.ai` contains provider/key/model/baseURL and bounded operational defaults. `createAIClient()` selects the configured OpenAI-compatible endpoint; `hasAI()` reflects actual key/model configuration. All callers consume these functions, not `config.ai.providers.openai`.

- [ ] Add failing endpoint tests for `openrouter`, `gemini`, `openai`, `custom`; reject unknown provider, missing model or custom URL, malformed output and provider errors.
- [ ] Read `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`; permit `AI_BASE_URL` for custom endpoints only. Defaults: OpenRouter endpoint `https://openrouter.ai/api/v1`, Gemini endpoint `https://generativelanguage.googleapis.com/v1beta/openai/`, OpenAI endpoint `https://api.openai.com/v1`. Do not guess a model when the user has not configured one.
- [ ] Route parsing, questions, evaluation, follow-ups and legacy search synthesis through the selected endpoint; retain JSON/Zod validation, provenance, rate/cost bounds and honest fallback/shortage behavior.
- [ ] Rename optional embedding setting to `AI_EMBEDDING_MODEL`; fail/skip semantic embeddings explicitly if the provider/model does not support them. Exact-repeat protection is always preserved.
- [ ] Record the actual provider/model in usage metadata. Remove stale cached clients that can use a different endpoint after configuration changes.
- [ ] Run provider and no-repeat tests. No real provider API call without user-configured credentials/authority; mocks are not live proof.

### Task 4: Minimal env inventory and safe cleanup

**Files:** Modify `backend/.env.example`, `frontend/.env.example`, `backend/src/config/index.ts`, `.gitignore`; remove `backend/.env.development`, `backend/.env.production` only after necessary private values are safely preserved. Modify existing local env files only if present and scoped credentials are preserved.

**Interfaces:** dotenv loads backend `.env` only; process/dashboard env wins. Constants control upload types/limits, cookie options, retries/timeouts and ordinary rate-limit defaults rather than requiring dozens of env knobs.

- [ ] Add config tests proving no loading of old environment files, dashboard precedence, and rejection of unsafe/missing production values.
- [ ] Backend example core keys: `MONGODB_URI`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`. Optional advanced keys belong in deployment docs, not three competing templates.
- [ ] Render-only keys: `NODE_ENV=production` plus private storage (`S3_BUCKET`, `S3_REGION`, standard AWS credentials if no runtime role). Derive S3 selection in production; retain a documented explicit storage-provider override for compatibility if needed.
- [ ] Frontend example has only `BACKEND_API_URL=http://localhost:3001`; Vercel value is the Render HTTPS origin. Render supplies PORT; host defaults to 0.0.0.0 in production.
- [ ] Remove JWT/BCRYPT/password-email/Redis/vector/Swagger/unused monitoring/provider settings from active config. Keep existing search feature operational defaults in code; document only supported optional external search credentials.
- [ ] Before removing tracked legacy files, detect non-placeholder required secrets and preserve them in ignored private configuration without emitting values. If mappings/providers conflict, stop and ask rather than discard credentials.
- [ ] Re-run config tests and inventory actual env consumers. Confirm no Redis runtime/package dependency is introduced or retained.

### Task 5: Update tests and deployment handoff

**Files:** Modify `backend/tests/setup.ts`, `backend/tests/integration/user-journey.test.ts`, `backend/tests/integration/providers.test.ts`, `backend/src/scripts/migrate.ts`, `README.md`, `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `IMPLEMENTATION_SUMMARY.md`.

**Interfaces:** Test journeys establish identity through mocked Google OAuth plus real opaque sessions, not hidden production password endpoints. Migration preserves ownership/exposure history and never automatically merges identities.

- [ ] Convert existing password-based fixtures to Google-only fixtures; remove obsolete password/refresh assertions and replace with equivalent session revocation and OAuth replay checks.
- [ ] Keep the real upload/review/onboarding, two-user isolation, answer/history/revision, concurrent generation and fresh-question exclusion tests.
- [ ] Document Render/Vercel root directories/build/start/env values and exact localhost/deployed Google callbacks. Separate local development setup from production dashboards.
- [ ] Document existing-password-account linking/migration precautions and the need for private durable resume storage on Render.
- [ ] Run backend lint/build/tests and frontend lint/build. Inspect diff/secret safety and report exact outcomes; do not claim deployment verification.
- [ ] Provide a concise final configuration checklist and list removed files/dependencies, including how tracked templates can be recovered from Git.

## Verified documentation used for this design

- Vercel external rewrites: https://vercel.com/docs/routing/rewrites
- Render dashboard environments: https://render.com/docs/configure-environment-variables
- Render ephemeral filesystem: https://render.com/docs/disks
- OpenRouter compatible client endpoint: https://openrouter.ai/docs/quickstart
- Gemini compatible client endpoint: https://ai.google.dev/gemini-api/docs/openai
- JSON mode and schema validation distinction: https://developers.openai.com/api/docs/guides/structured-outputs
