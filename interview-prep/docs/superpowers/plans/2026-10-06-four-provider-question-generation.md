# Four-Provider Question Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a strict four-provider AI fallback chain with safe structured diagnostics, resilient question validation, concise prompting, and frontend failure logging.

**Architecture:** Extend the existing centralized `ai-provider` and `structured-ai` services to model up to four ordered provider candidates and emit one structured request/result event per attempt. Question generation will call that shared service once, so malformed responses also fall through. The frontend will use a small logging/error-normalization helper at the question-generation call sites.

**Tech Stack:** TypeScript, Express, OpenAI-compatible SDK, Zod, Winston, Jest, Next.js/React, Axios.

**Spec:** User-pasted requirements in `C:\Users\singh\.codex\attachments\2f21ec66-ef3a-4e46-a4b4-ce8bb8208648\Pasted text.txt`.

## Global Constraints

- Always try Provider 1 first, then Provider 2, Provider 3, Provider 4.
- Do not expose API keys, tokens, full prompts, resume contents, or sensitive data in logs.
- Treat empty, malformed, truncated, or schema-invalid responses as provider failures.
- Return a simple user-facing failure message after all providers fail.
- Preserve existing abstractions and unrelated product behavior.

## Review Focus

- A provider returns HTTP 429/500/503 or times out: the next provider is attempted and the event includes status/timeout/rate-limit metadata.
- A provider returns malformed or empty JSON: it is logged as validation failure and falls through.
- All four providers fail: the original per-provider causes remain in logs while the API response is generic.
- A configured provider is missing credentials or duplicated: configuration validation rejects it without changing fallback order.
- Frontend receives non-JSON, 4xx/5xx, network, timeout, or auth failure: Vercel-visible structured logging occurs and the UI clears its loading state.

### Task 1: Four-provider configuration and fallback executor

**Files:**
- Modify: `backend/src/config/index.ts`
- Modify: `backend/src/config/validate.ts`
- Modify: `backend/src/common/services/ai-provider.ts`
- Modify: `backend/tests/unit/ai-provider.test.ts`

**Interfaces:**
- Produce `AIProviderCandidate[]` in strict configured order and `withAIFallback` that attempts each candidate exactly once.
- Add `AI_FALLBACK_2_*` and `AI_FALLBACK_3_*` environment configuration while preserving existing `AI_FALLBACK_*` as Provider 2.

- [ ] Add failing tests for four ordered candidates, primary-first behavior after previous fallback success, and one-attempt-per-provider behavior.
- [ ] Implement ordered configuration, remove sticky reordering, and attach attempt metadata to fallback callbacks without logging secrets.
- [ ] Validate partial provider configuration and duplicate provider/model credentials clearly.
- [ ] Run `npm test -- --runInBand tests/unit/ai-provider.test.ts` from `backend` and confirm pass.

### Task 2: Structured per-attempt AI logging and validation fallback

**Files:**
- Modify: `backend/src/common/services/structured-ai.ts`
- Modify: `backend/src/modules/questions/personalized-generator.ts`
- Modify: `backend/tests/unit/logging.test.ts`
- Modify: `backend/tests/integration/providers.test.ts`

**Interfaces:**
- `structuredAIMeta` remains the shared typed entry point and records provider/model/operation/attempt/total attempts/status/code/duration/fallback outcome.
- Question generation uses the shared chain once; provider response parsing and Zod validation throw classified failures that trigger the next attempt.

- [ ] Add tests covering success at attempts 1–4, all-fail preservation, status 429/5xx, timeout, empty output, malformed JSON, and schema-invalid/empty question lists.
- [ ] Emit `[AI_REQUEST]`, `[AI_SUCCESS]`, `[AI_FAILURE]`, and `[AI_FALLBACK]` structured log messages with redacted metadata.
- [ ] Replace the verbose question prompt with a concise role-agnostic prompt retaining only grounding, framing, diversity, difficulty, and output-shape requirements.
- [ ] Map exhausted backend failures to the existing generic API-safe error while retaining diagnostics in Render logs.
- [ ] Run focused provider/logging/integration tests and backend typecheck.

### Task 3: Frontend question-generation error logging and safe UX

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/src/app/settings/page.tsx`
- Modify: `frontend/src/app/sessions/today/page.tsx`
- Modify: `frontend/src/components/features/PracticeScreen.tsx`
- Modify: `frontend/src/components/calendar/InterviewCalendar.tsx`
- Modify: `frontend/src/app/history/page.tsx`

**Interfaces:**
- Produce a shared `logQuestionGenerationError(operation, error)` helper that logs safe status/code/category/request-id metadata and never prompt or response bodies.

- [ ] Add/adjust call-site handling so every question-generation request logs failures and uses the generic message, including malformed responses and auth/network/timeouts.
- [ ] Ensure all loading flags are cleared in `finally` blocks and no raw provider message is rendered.
- [ ] Run frontend typecheck and production build.

### Task 4: End-to-end verification and documentation

**Files:**
- Modify: `backend/.env.example`
- Modify: `interview-prep/README.md` or relevant AI configuration documentation

- [ ] Document all four provider variable groups, order, and restart/deployment requirements without including credentials.
- [ ] Run backend focused tests, full backend test suite where feasible, frontend typecheck/build, and `git diff --check`.
- [ ] Review logs and responses for secret/prompt/resume leakage and record any environment-limited verification.

---
