# Architecture

One Next.js frontend, one Express API and MongoDB. No Redis, Docker, queue or separate auth service is required.

Both apps load the sole private root .env locally. Production uses Vercel/Render dashboard settings. Vercel forwards same-origin /api requests to Render; the browser sees its own frontend domain.

Google OAuth identifies users. Render verifies state, nonce, PKCE and the signed Google identity, then creates a random token whose hash is stored in MongoDB. One HttpOnly cookie remembers the session for seven days. Every protected request checks expiry/revocation and user ownership. No password authentication, application JWTs, refresh tokens or email delivery.

All AI consumers use provider-neutral settings and a shared OpenAI-compatible transport: OpenRouter, Gemini, OpenAI or custom compatible endpoint. Structured outputs are validated with Zod; bad output is rejected. Model/provider provenance and a bounded usage budget are retained. Schema validation is not factual verification.

The preparation flow remains upload -> genuine text extraction -> user-confirmed resume facts -> goals/daily plan -> curated or validated AI questions -> atomic per-user assignment exposure -> owned answers/evaluation/history/feedback -> labeled revisions.

Exact normalized fresh-question duplicates are blocked by per-user indexes. Near-text and optional semantic checks are approximate. Concepts may repeat. Only explicit revisions intentionally reuse questions.

Resume files use MongoDB GridFS with authenticated owner-only downloads, locally and in production. Legacy local files remain accessible until explicitly copied using `npm run migrate:resume-storage`; original files are retained. AWS/S3 integration is removed. Calendar, coding bank, projects, analytics and search remain; sandboxed coding execution, OCR and complete browser/live deployment validation remain outside this change.
