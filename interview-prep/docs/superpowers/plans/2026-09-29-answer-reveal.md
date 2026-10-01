# Answer Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users study an interview-ready answer for each question without writing a response.

**Architecture:** A session-scoped endpoint returns a saved model answer, generating and caching a stronger answer for older questions when possible. A separate endpoint marks a revealed question reviewed. The page reveals the answer, preserves feedback, and reports review progress without grading.

**Tech Stack:** Express, Mongoose, Next.js, TypeScript, Jest.

**Spec:** User request in this conversation, 2026-09-29.

## Global Constraints

- Only the owning user may access a session question or its answer.
- Never invent resume experience or mark a viewed answer as user mastery.
- Keep existing written-answer APIs compatible for other clients.
- Never repeat a question to fill a short session.

## Review Focus

- Missing question or another user's session returns a safe error.
- Repeated reveals reuse the cached answer.
- A provider failure still returns an existing detailed answer.
- Repeated review clicks do not increment progress twice.
- A reviewed question has no fabricated score.

---

### Task 1: Session answer and review API

**Files:**
- Modify: `backend/src/modules/sessions/session.controller.ts`
- Modify: `backend/src/modules/sessions/session.service.ts`
- Modify: `backend/src/modules/questions/question.model.ts`

**Interfaces:**
- Produces: `GET /api/sessions/:sessionId/questions/:questionId/answer` returning `{answer}`.
- Produces: `POST /api/sessions/:sessionId/questions/:questionId/review` returning progress.

- [ ] Add route ownership and missing-question tests; confirm failure.
- [ ] Add answer loading with one-time AI enhancement and cached result.
- [ ] Add idempotent review status and aggregate update.
- [ ] Run backend typecheck and relevant tests.

### Task 2: Reveal-based study page

**Files:**
- Modify: `frontend/src/app/sessions/today/page.tsx`

**Interfaces:**
- Consumes: Task 1 answer and review routes.

- [ ] Replace textarea and evaluation controls with show-answer and mark-reviewed controls.
- [ ] Update progress and completion copy to say reviewed, without a score.
- [ ] Preserve feedback and question navigation.
- [ ] Run frontend typecheck and inspect the page state.
