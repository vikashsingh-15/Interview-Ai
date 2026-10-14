# Reset Practice Data Implementation Plan

> **For agentic workers:** Native implementation in this session, then review the complete change.

**Goal:** Let a signed-in user clear generated and asked interview activity from Settings while keeping resumes, confirmed resume skills, account data, and preparation settings.

**Architecture:** Keep one authenticated backend reset endpoint as the source of truth for both clients. Give profile reset an explicit activity-data deletion boundary; preserve resume/profile/preference records and stored resume files, while keeping full account deletion on its existing full cleanup path. The Android app is a WebView that opens the same `/settings` page, so the shared page and API provide identical behavior.

**Tech Stack:** Express, Mongoose, Next.js, TypeScript, Android WebView.

**Spec:** This plan captures the user request in this document.

## Global Constraints

- Keep reset scoped to the authenticated user's own records.
- Preserve every resume and resume version, confirmed skills, resume/profile facts, account, and user settings/preferences.
- Delete generated/asked question activity, answers, history, calendar, sessions, analytics/revision/tracker/planner activity, and per-user generated artifacts.
- Keep globally seeded questions and other users' data.
- The reset must remain available through the shared Settings page in web and Android WebView.
- Confirmation copy must describe the retained and deleted data accurately.

## Review Focus

- A reset must not remove resume storage files or the active resume association; verify retained resume records and file metadata.
- A reset must clear calendar records and any derived history/session references; verify every activity collection has no records for the user.
- User-owned generated questions must be removed without deleting global seeded questions or another user's questions.
- Repeated resets must succeed and leave preferences/profile setup intact.
- The Android Settings route must reach the same reset action and confirmation as the website.

---

### Task 1: Define reset data boundary in the backend

**Files:**
- Modify: `backend/src/modules/auth/user-data.service.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`
- Review: user-owned models in `backend/src/modules/**`

**Interfaces:**
- Add `resetUserPracticeData(userId)` for activity-only cleanup; keep `deleteUserData(userId)` as the full account-deletion cleanup.
- `POST /api/auth/me/reset` remains the shared authenticated reset API.

- [ ] Inventory model ownership and explicitly exclude `User`, resume/profile/preference models, and resume storage versions from deletion.
- [ ] Delete user-owned activity records, including dependent session-question rows and owned generated questions, while retaining globally seeded questions.
- [ ] Preserve the user's authentication sessions so reset does not sign them out.
- [ ] Verify the result reports completion only after the cleanup finishes.

### Task 2: Update Settings reset experience

**Files:**
- Modify: `frontend/src/app/settings/page.tsx`
- Review: `mobile/app/src/main/java/com/jobprep/mobile/MainActivity.java`

**Interfaces:**
- Continue calling `POST /api/auth/me/reset` with the existing typed confirmation.

- [ ] Place a clearly labeled **Reset profile** action near the top of Settings, separate from per-resume deletion; say practice history, generated/asked questions, answers, calendar, and progress are cleared while resumes, confirmed skills, and settings remain.
- [ ] Match the confirmation dialog consequence text to that behavior.
- [ ] On success, show a clear restart-ready message and refresh or navigate to the fresh dashboard state.
- [ ] Confirm Android's WebView navigation already exposes `/settings`; add native changes only if the route or success state is unavailable there.

### Task 3: Check the resulting behavior

**Files:**
- Review or add focused coverage in `backend/tests/integration/user-journey.test.ts` and `frontend/tests/e2e/` only if the existing test setup supports it.

- [ ] Check reset preserves user, profile/preferences, confirmed skills, resume documents, and resume version metadata.
- [ ] Check reset deletes the user's sessions, question history, generated questions, calendar, and related progress records.
- [ ] Check globally seeded questions and a second user's records remain.
- [ ] Check the reset route still requires authentication and accepts the confirmation token.
- [ ] Check the Settings route is shared by web and Android WebView.
