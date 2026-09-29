# Project Simplification Plan

> **For agentic workers:** This plan was executed natively in the current session.

**Goal:** Remove unused infrastructure, dependencies, and configuration while preserving the interview-preparation product areas required by the attached brief.

**Architecture:** Keep the Next.js frontend, Express API, MongoDB persistence, and existing feature modules. Remove the nonfunctional Docker path and optional Redis/vector/Swagger placeholders that have no runtime implementation; make setup documentation describe the supported npm workflow.

**Tech Stack:** Next.js, React, TypeScript, Express, MongoDB/Mongoose, npm.

**Spec:** User-provided project brief at `C:/Users/singh/.codex/attachments/28f741a4-92cb-4825-991b-a1dcdd43aac9/Pasted text.txt`.

## Global Constraints

- Keep the web application and its core preparation features.
- Keep MongoDB, authentication, resume/profile, question/session, evaluation/revision, coding, mock interview, analytics, and market-calibration modules.
- Do not remove the user's existing `mongodb-memory-server` package change.
- Do not expose or edit local environment values.

## Review Focus

- Local startup still uses the root npm scripts and a reachable MongoDB instance.
- All retained source imports remain declared after dependency pruning.
- Documentation does not promise a Docker deployment that the repository cannot build.

## File Structure

- `backend/src/config/index.ts`, `backend/src/index.ts`: remove unused infrastructure and Swagger placeholders.
- `backend/package.json`, `frontend/package.json`, their lockfiles: prune packages with no source use.
- `backend/.env.example`, `frontend/.env.example`: keep only active setup values.
- `README.md`, `docs/DEPLOYMENT.md`: document the supported local and non-Docker deployment path.
- Docker compose files: remove the broken, unused path.

## Tasks

### Task 1: Remove inactive infrastructure configuration

- [x] Remove unused Redis, vector-search, Swagger, and logging-format settings and their startup stubs.
- [x] Remove references to those settings from the example environment files and docs.

### Task 2: Prune unused dependencies and Docker scaffolding

- [x] Remove only dependencies with no source references; preserve parser dependencies required by the stated resume feature and the existing memory-server change.
- [x] Remove Compose files that refer to missing Dockerfiles and incorrect relative paths.

### Task 3: Simplify setup documentation and verify

- [x] Make npm plus MongoDB the documented local setup.
- [x] Run frontend and backend TypeScript checks without emitting build files.

---
