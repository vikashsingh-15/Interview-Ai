# The Adaptive Learning Loop

This document describes how the app turns answers into signal: every submitted
answer is evaluated, weak answers are scheduled for spaced revision, the skill
graph is updated with real scores, and future question generation targets weak
concepts.

```
        ┌──────────────────────────────────────────────────────────┐
        │                                                          │
        ▼                                                          │
  generate session ──► you answer ──► AI evaluation (rubric)       │
        ▲                                  │  │                    │
        │                                  │  └── score < 0.7 ──► Revision (+1 / +7 / +30 days)
        │                                  │
        │                                  ├──► SkillGraph (topic + per-concept mastery)
        │                                  │
        │                                  └──► QuestionHistory (strengths, gaps, concepts)
        │
        └── weak concepts steer the next batch of generated questions
```

## 1. Answer evaluation (`modules/evaluation/answer-evaluation.ts`)

`submitAnswer` grades every answer before persisting it:

- **AI path** — when `OPENAI_API_KEY` is set, the question, the user's answer
  and the reference answer (`detailedAnswer` / `expectedAnswer`) are sent to
  the LLM with a strict rubric prompt. It returns 0–1 subscores
  (technicalCorrectness, completeness, depth, clarity), strengths, weaknesses,
  missing points, improvement suggestions and follow-ups.
- **Heuristic path** (no key, or AI failure) — transparent keyword-coverage
  grading: completeness = share of reference keywords present; depth = length
  + structure signals (reasoning, trade-offs, lists, production vocabulary);
  the two are combined into an overall score. Unmatched reference keywords
  become "missing points" and `keyConceptsToRevise`.

Both paths are normalized into the same `EvaluationResult`, so the rest of the
system does not care which one ran.

## 2. Spaced repetition wired end-to-end

When the evaluation score is **below 0.7**:

1. A `Revision` record is created (+1 / +7 / +30 schedule) unless one is
   already active for that question, in which case its due date is pulled to
   tomorrow.
2. The daily session generator already fetches due revisions, so the question
   resurfaces automatically — no extra UI needed.
3. When a revision question is answered, `submitAnswer` calls the revision's
   `complete()` (attempt history, performance rating, mastery progress) and
   re-queues it for the next spaced pass until `isMastered`
   (mastery ≥ 0.8 after 3+ passes).

Re-answering the same question is safe: `(userId, questionId)` is unique on
`QuestionHistory`, so a second answer updates the existing entry instead of
throwing `E11000`.

## 3. Skill graph with real scores

`submitAnswer` no longer hardcodes `correct=true, score=0.8`:

- **Topic level**: `updateSkill(topic, correct, score, ...)` moves topic
  mastery up or down with the real score.
- **Concept level**: each of the question's concepts (max 6) is updated via
  the new `updateConcept()` method — exposure, mastery, weak/mastered flags.
  Concepts with mastery < 0.4 or a wrong answer are marked weak.
- **History level**: `QuestionHistory` stores the full evaluation, plus
  `conceptsTested` / `conceptsWeak` / `conceptsMastered` and detected
  weaknesses / knowledge gaps.

## 4. AI question generation seeded by weakness

`generateQuestionsWithAI` (used when the curated bank runs dry for a topic) is
no longer a fixed 2-question stub:

1. Weak concepts are read from the skill graph (worst mastery first, max 5).
2. Seen questions are hashed for dedupe (last 500 history entries).
3. With an OpenAI key, the LLM generates questions probing those weak
   concepts, validated against the question-type enum and deduped before use.
   Generated questions carry a `detailedAnswer`, which feeds back into better
   AI evaluation (and the reference-answer UI).
4. Without a key, a set of varied template questions (internals, production
   scenarios, trade-offs, failure modes, fundamentals, scalability) replaces
   the old identical pair, stamped with the user's requested difficulty.

## 5. What the user sees

`/sessions/today` (new page, linked from the dashboard) walks through the day's
questions and after each submission shows:

- the score with color coding, and whether it was AI-graded or keyword-graded
- strengths / weaknesses / missing points / improvement suggestions
- the "scheduled for revision" notice for weak answers
- a collapsible reference answer (`detailedAnswer`)
- a question-dot tracker colored by per-question score

## API additions (behavioral)

`POST /api/sessions/:sessionId/answers/:questionId` now returns:

```json
{
  "sessionQuestionId": "...",
  "score": 0.62,
  "evaluationSource": "ai | heuristic | none",
  "evaluation": {
    "overallScore": 0.62,
    "summary": "...",
    "strengths": ["..."],
    "weaknesses": ["..."],
    "missingPoints": ["..."],
    "improvementSuggestions": ["..."],
    "keyConceptsToRevise": ["..."],
    "strongerAnswerStructure": "..."
  },
  "scheduledForRevision": true,
  "referenceAnswer": "..."
}
```

## Tests

`tests/unit/answer-evaluation.test.ts` covers the heuristic grader (strong vs
weak answers, range safety, missing-point reporting, concept coverage with
plurals) and the revision-evaluation mapper (delta, improved flag,
new/addressed weakness matching). Run with `npm test` in `backend/`.
