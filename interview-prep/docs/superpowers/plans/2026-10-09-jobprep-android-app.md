# JobPrep Android App Implementation Plan

> **For agentic workers:** Implement this plan task-by-task in the current session. Steps use checkbox syntax for tracking.

**Goal:** Add an independently buildable, installable JobPrep Android application while preserving the Interview Prep website and its backend.

**Architecture:** Keep the existing Next.js/Express/MongoDB system as the shared product backend. Create a separate native Android project with the existing HTTPS Next.js application in a first-party WebView, native navigation, file selection, lifecycle, connectivity and browser OAuth handoff. The current Next.js dynamic route and server API route prevent a complete static Capacitor bundle without changing the website architecture.

**Tech Stack:** Existing Next.js 15 and Express API, native Android Java/Gradle, existing MongoDB and Google OAuth.

**Spec:** User pasted brief at `C:\Users\singh\.codex\attachments\03fb3aca-cd36-4f55-b4bd-2383c152d99f\Pasted text.txt`.

## Global Constraints

- Preserve all existing website routes and behavior.
- Do not change Vercel, Render, DNS, environment variable names/values, APIs, schema, auth rules or business logic without necessity.
- Do not put backend secrets or signing keys in the APK/repository.
- JobPrep app id is independent; Android minimum supported version is Android 14 (API 34).
- Website builds/deploys independently of Android tooling.
- Use existing accounts, AI services, APIs and database.

## Review Focus

- Google sign-in redirects and HttpOnly cookie persistence across app lifecycle.
- Direct API connectivity, CORS and production HTTPS without exposing credentials.
- Resume file picker behavior and unsupported/oversized uploads.
- Back navigation, interrupted interview state and offline retry.
- Android package ID/signing inputs and build-tool availability on Windows.

---

### Task 1: Isolated Android architecture and app identity

**Files:**
- Create: `mobile/` native Android Gradle project.
- Create: mobile-only configuration, icon/splash assets and build documentation.
- Modify: `.gitignore` only for Android outputs/signing files if needed.

**Interfaces:**
- Produces a JobPrep Android package with a unique reverse-domain id, version 1.0.0/code 1, API 34 minimum, HTTPS production origin and untracked local signing configuration.

- [x] Confirm server-rendered frontend delivery and browser OAuth requirements.
- [x] Scaffold Android only under `mobile/`; root web build remains independent.
- [x] Add identity, adaptive icon, splash screen, status/navigation bar and safe-area settings.
- [x] Document package ID and release signing configuration without embedding keys.
- [x] Verify diff excludes Vercel/Render/environment configuration.

### Task 2: App navigation, session, file and network behavior

**Files:**
- Create: `mobile` native bridge and app-specific navigation/error UI.
- Create: mobile integration checks where supported.

**Interfaces:**
- Internal product navigation stays in app; external links are handed to Android browser.
- Resume selection uses Android document picker and preserves existing `.pdf`/`.docx` upload flow.
- Back navigation returns through app history and asks before abandoning an active answer when needed.
- Offline state offers retry and retains existing local practice draft behavior.

- [x] Implement system browser OAuth handoff and existing session cookie exchange.
- [x] Wire Android back, app resume/pause, file picker, external links, and network retry.
- [x] Declare only INTERNET and ACCESS_NETWORK_STATE permissions.
- [ ] Verify mobile touch/keyboard/safe-area behavior without altering desktop styling.

### Task 3: Independent builds and regression verification

**Files:**
- Modify: mobile-only build scripts/configuration.
- Create: `mobile/README.md` with exact Android build/install steps and limitations.

- [x] Run website production build, frontend typecheck, focused mobile auth test, and backend regression suite.
- [x] Verify Vercel/Render/environment files were not edited.
- [x] Build locally signed release APK and verify signature, package metadata, and API 34 floor.
- [ ] Exercise device flows after new frontend/backend code is deployed; no device install was available in this run.
- [x] Record build result, install instructions and remaining limitations in mobile/README.md.

## Self-review gaps

- Live production Google OAuth, AI provider requests and account data synchronization require deployed credentials and a device; local compilation cannot prove them.
- Android 14+ behavior requires an API 34+ emulator/device to verify.
- Package identifier is not supplied by the owner; choose a neutral unique reverse-domain placeholder and make it easy to replace before release.
