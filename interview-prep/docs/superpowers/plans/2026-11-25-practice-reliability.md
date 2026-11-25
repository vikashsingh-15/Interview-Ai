# Practice Reliability Implementation Plan

**Goal:** Improve data integrity, recovery, and visibility of interview preparation.

**Architecture:** Reuse account-owned MongoDB records and existing practice routes. Keep index migration explicit and preserve legacy data. Add bounded queries and per-user ownership checks.

**Tech Stack:** Express, Mongoose, Next.js, TypeScript.

## Work and verification

- Stage resume profiles before publishing versions; verify cleanup paths and existing resume integration tests.
- Use configured AI fallbacks for evaluation; run evaluation unit tests.
- Add owner-scoped question uniqueness and an explicit migration; create the replacement index before dropping the old index. Do not run against user data during development.
- Persist job plans and mock drafts under the authenticated account; preserve local drafts and verify ownership and recovery paths.
- Add revision controls, topic analytics, and an administrator feedback view; check that self-reported understanding does not create a score.
- Record startup timing without moving initialization until actual measurements identify a bottleneck.
- Run frontend and backend typechecks, relevant tests, and production build; record any checks that cannot complete.
