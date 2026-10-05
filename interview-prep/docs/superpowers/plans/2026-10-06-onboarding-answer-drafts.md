# Resume-Grounded Onboarding Answer Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users generate editable AI answer drafts for onboarding questions using only confirmed resume skills, experience, and projects.

**Architecture:** Add a backend endpoint that accepts the onboarding facts and a bounded list of answer prompts, then returns structured drafts through the existing AI provider. Add deterministic local fill suggestions for fields directly supported by resume facts, and add per-question plus “generate all” controls in the onboarding UI. Generated text remains a draft and never changes confirmation state.

**Tech Stack:** Express, Zod, existing `structuredAI`, Next.js/React, existing onboarding review API.

**Spec:** User request to auto-fill form questions from resume project/experience descriptions and provide an AI button to generate answers for all form questions during resume approval/onboarding.

## Global Constraints

- Resume facts are untrusted data and must be delimited from system instructions.
- AI drafts must not invent employers, responsibilities, metrics, dates, ownership, or achievements.
- Drafts must be editable and visibly labeled as AI-generated suggestions.
- Only user-confirmed resume facts may be sent as grounding context for answer generation.
- Existing onboarding review and confirmation semantics remain unchanged.
- Enforce bounded prompt size and existing per-user AI usage limits.

## Review Focus

- Unconfirmed or rejected resume entries must not ground generated answers.
- Missing evidence must produce a transparent “not enough information” draft, not a fabricated answer.
- “Generate all” must not overwrite user-edited answers without confirmation.
- AI outage or missing configuration must leave the form usable with local suggestions.
- Generated answers must not be stored as verified resume claims.

### Task 1: Define answer-draft schema and backend endpoint

**Files:**
- Modify: `interview-prep/backend/src/modules/profile/onboarding.routes.ts`
- Modify: `interview-prep/backend/src/modules/resume/resume-parser.ts` only if shared schemas need reuse
- Test: `interview-prep/backend/tests/unit/personalization.test.ts` or a new focused onboarding test

**Interfaces:**
- Consumes: authenticated user, active confirmed ResumeProfile facts, `questions: [{id,prompt,kind}]`.
- Produces: `answers: [{id,draft,groundedFactIds,needsReview}]`.

- [ ] Add Zod request/response schemas with strict limits on question count, prompt length, and answer length.
- [ ] Add `POST /api/profile/onboarding/answer-drafts` that loads only the authenticated user’s active resume profile and confirmed, non-removed facts.
- [ ] Use `structuredAI` with a versioned prompt that explicitly forbids invention and returns one draft per input question.
- [ ] Add a deterministic fallback that composes answer starters from confirmed facts or explains that evidence is missing.
- [ ] Test ownership, confirmation filtering, malformed payloads, AI response validation, and fallback behavior.

### Task 2: Add local auto-fill mappings and answer state

**Files:**
- Modify: `interview-prep/frontend/src/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `facts.experience`, `facts.projects`, and current editable form state.
- Produces: editable draft values with source labels and dirty-state protection.

- [ ] Add local suggestions for directly supported fields: current role, dates, companies, project names, technologies, responsibilities, project references, and explicit achievements/claims.
- [ ] Track whether each field is user-edited, locally suggested, or AI-generated.
- [ ] Never replace non-empty user-edited fields automatically.
- [ ] Display “Resume-derived suggestion” and “AI draft - verify before saving” labels.

### Task 3: Add per-question and generate-all controls

**Files:**
- Modify: `interview-prep/frontend/src/app/onboarding/page.tsx`
- Test: frontend onboarding component/e2e coverage if the project’s existing test setup supports it

**Interfaces:**
- Consumes: answer-draft endpoint and confirmed facts.
- Produces: Generate answer buttons beside applicable form questions and a guarded Generate all answers action.

- [ ] Add a per-field Generate answer control for responsibility, achievement, technical-claim, project-description, architecture, performance, security, metrics, and decision fields.
- [ ] Add Generate all answers with progress/error handling and no overwrite of manually edited fields unless the user explicitly chooses replace.
- [ ] Keep Save reviewed facts as the only action that changes confirmation state.
- [ ] Add accessible status text and a clear AI-disabled message when no provider is configured.

### Task 4: Verify end-to-end behavior

- [ ] Run backend focused tests and typecheck.
- [ ] Run frontend typecheck/build.
- [ ] Verify the uploaded resume’s confirmed projects/experience produce drafts grounded in their actual text.
- [ ] Confirm rejected/unconfirmed entries are excluded and generated drafts remain editable.

