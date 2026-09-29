# MongoDB Resume Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store new resumes in MongoDB GridFS and remove AWS/S3 implementation and configuration.

**Architecture:** Use the existing Mongoose connection and its bundled MongoDB driver with a private `resumeFiles` GridFS bucket. Keep the existing authenticated resume API and parsing flow. Preserve historical files and provide an explicit, non-destructive local-file migration rather than silently deleting or reclassifying old data.

**Tech Stack:** TypeScript, Express, Mongoose 8, MongoDB GridFS, Jest, mongodb-memory-server.

**Spec:** User request: "implement mongo db storage an dremove this s# bucket implementation."

## Global Constraints

- One root `.env`; MongoDB storage uses `MONGODB_URI` without new credentials or configuration.
- Preserve the existing 10 MB PDF/DOCX limit and authenticated owner-only downloads.
- Do not delete existing local files, S3 objects or application data during cutover.
- Preserve unrelated dirty-worktree changes; do not commit automatically.

## Review Focus

- A second user cannot download or delete the first user's files.
- Missing files and disconnected MongoDB produce clear errors without disk fallback.
- Failed uploads/metadata writes do not leave orphaned GridFS files or partial chunks.
- Resume/account deletion removes only the owner's associated GridFS files.
- Legacy local resumes remain accessible and migratable; legacy S3 references fail clearly rather than being treated as MongoDB files.

### Task 1: GridFS storage and resume lifecycle

**Files:** Modify `backend/src/common/services/resume-storage.ts`, `backend/src/modules/resume/resume.model.ts`, `backend/src/modules/resume/resume.service.ts`, `backend/src/modules/resume/resume.controller.ts`, `backend/src/modules/auth/user-data.service.ts`; create `backend/tests/integration/resume-storage.test.ts`.

**Interfaces:** Preserve `resumeStorage.put(key: string, buffer: Buffer, contentType: string): Promise<void>`, `get(key: string, provider?: string): Promise<Buffer>`, and `delete(key: string, provider?: string): Promise<void>`. New versions explicitly identify `gridfs`; legacy versions remain explicitly distinguishable. GridFS filenames use unique generated storage keys and never public URLs.

- [ ] Write integration tests for byte-identical PDF/DOCX round trips, stored MIME metadata, missing files, aborted writes, deletion, authenticated owner isolation and account deletion.
- [ ] Run `npm test -- --runInBand tests/integration/resume-storage.test.ts`; confirm failure against current S3/local implementation.
- [ ] Implement GridFS using `mongoose.mongo.GridFSBucket` and the existing connection, stream error handling, failed-write cleanup and deterministic lookup/deletion by storage key.
- [ ] Update resume save/parse/download/delete flows to use GridFS without creating a local upload directory. Clean up newly stored files if metadata persistence fails.
- [ ] Run the focused suite; require all cases to pass.

### Task 2: Safe legacy-file transition

**Files:** Create `backend/src/scripts/migrate-resume-storage.ts`; modify `backend/package.json` and relevant storage tests.

**Interfaces:** `npm run migrate:resume-storage` copies explicitly local resume versions to GridFS, verifies checksum and byte length, then updates their provider. It does not remove original files. Historical S3 versions are reported as requiring export/re-upload; no AWS adapter remains.

- [ ] Write tests for legacy local reads, path traversal rejection, migration verification, idempotent reruns and clear unsupported legacy-provider errors.
- [ ] Implement validated local compatibility reads/deletes restricted to the existing uploads directory; new uploads never use local storage.
- [ ] Implement the explicit migration command with per-version verification and no automatic production migration.
- [ ] Run focused storage tests; require original files to remain intact after successful migration and failed migrations to preserve metadata.

### Task 3: Configuration cleanup and verification

**Files:** Modify `.env`, `backend/src/config/index.ts`, `backend/src/config/validate.ts`, `backend/tests/setup.ts`, `backend/tests/integration/user-journey.test.ts`, `backend/package.json`, `backend/package-lock.json`, `README.md`, `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `IMPLEMENTATION_SUMMARY.md`.

**Interfaces:** Production requires hosted MongoDB, not S3. MongoDB connection covers both application records and resume files. Document backups/storage allowance and legacy-file migration.

- [ ] Remove S3/AWS settings from the root env without exposing or changing unrelated credentials. Remove AWS SDK using `npm uninstall @aws-sdk/client-s3 --ignore-scripts --no-audit`.
- [ ] Remove S3 startup validation, obsolete test disk cleanup, and current S3 deployment instructions. Retain only local path compatibility required by Task 2.
- [ ] Run backend build, lint and complete Jest suite; run frontend build to detect cross-app regressions.
- [ ] Run `git diff --check` and search active source/configuration for AWS SDK and S3/AWS env consumers; require none.
- [ ] Report actual test results and distinguish isolated MongoDB tests from live Render/MongoDB Atlas verification.

## Plan review

User approved native implementation with "implement". GridFS code, legacy migration command, tests and configuration cleanup are implemented. Both production builds, backend lint and all 45 tests in 6 suites passed. Source/env checks found no S3/AWS configuration consumers or S3 SDK dependency. No migration has been executed against the user's database; live Render/Atlas remains unverified.
