# One env file: Vercel frontend + Render backend

## Local development

Use Node.js 22 LTS. Edit only interview-prep/.env. The backend loads that file and the frontend reads its API origin; shell/hosting values take precedence. Copy .env.example to .env for local setup. The frontend reads only BACKEND_API_URL; all credentials are backend-only. See ENVIRONMENT.md for the complete variable classification.

```env
MONGODB_URI=mongodb://localhost:27017/interview-prep-dev
FRONTEND_URL=http://localhost:3000
BACKEND_API_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AI_PROVIDER=openrouter
AI_API_KEY=
AI_MODEL=
AI_BASE_URL=
```

Fill Google credentials. Fill AI key/model if you want fresh generated questions; leave BOTH empty for no-AI development. AI_BASE_URL is only for a custom compatible provider. MongoDB also stores resume files. Never commit this private file.

Run npm run setup, then npm run dev from the project root. Open localhost:3000; keep localhost consistently, not a mix of localhost and 127.0.0.1. Health: localhost:3001/api/health.

## Google setup

Create a Google OAuth Web application. Add these exact authorized redirect URIs:

- Local: http://localhost:3000/api/auth/google/callback
- Production: https://YOUR-VERCEL-DOMAIN/api/auth/google/callback

Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Render. Set FRONTEND_URL to your canonical Vercel HTTPS origin. The callback is derived automatically; there is no GOOGLE_CALLBACK_URL variable. Use the frontend Google button, not a direct Render-host login URL.

If the Google consent screen is in testing mode, add the permitted Google test users. Existing password-only accounts are NOT silently merged by email. Link Google from an existing authenticated account using /api/auth/google/link before cutover; otherwise arrange an owner-verified migration. Their data is preserved.

## Vercel settings

- Root directory: interview-prep/frontend (adjust if your Git repository starts at interview-prep).
- Framework: Next.js; Node.js 22.
- Environment: BACKEND_API_URL=https://YOUR-API.onrender.com
- Build: npm run build.

No NEXT_PUBLIC_API_URL and no Google/AI/database secrets belong in the browser. The frontend uses same-origin /api, proxied to Render. Rebuild when BACKEND_API_URL changes. Use a stable authorized production domain rather than unconfigured preview URLs.

## Render settings

- Root directory: interview-prep/backend (adjust to your repository root).
- Runtime: Node.js 22; NODE_ENV=production.
- Build: npm ci --include=dev && npm run build.
- Start: npm start.
- Health check: /api/health.
- Render supplies PORT; production listens on 0.0.0.0.

Enter MONGODB_URI (Atlas/hosted MongoDB), FRONTEND_URL (Vercel origin), GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and optional AI_PROVIDER/AI_API_KEY/AI_MODEL. Choose a model that supports JSON-object chat responses; schema validation also runs locally. Do not use the old fake development key.

AI_PROVIDER endpoints:
- openrouter: https://openrouter.ai/api/v1
- gemini: https://generativelanguage.googleapis.com/v1beta/openai/
- openai: https://api.openai.com/v1
- custom: set AI_BASE_URL to an HTTPS OpenAI-compatible endpoint.

The model ID must match the selected provider's catalog. This does not imply support for every model or native provider-specific API feature. Do not assume an SDK named OpenAI means requests go to OpenAI: the configured endpoint chooses the provider.

## Resume storage on Render

Resumes are stored in MongoDB GridFS (`resumeFiles.files` and `resumeFiles.chunks`) using the existing MONGODB_URI. No AWS account, bucket or separate storage credentials are required. Downloads remain authenticated and owner-only; file references are not public URLs. Include both collections in database backups and monitor MongoDB storage allowance.

New uploads never use Render's local disk. Historical local files remain readable on the original host. Back up the database and uploads, stop uploads during migration, then run `npm run migrate:resume-storage` inside backend on that original host. The command verifies byte length/checksum before updating metadata, leaves originals intact, and can be rerun. Do not move hosts until migration succeeds. Historical cloud files require export/re-upload; the cloud adapter has been removed.

## Historical cleanup before this audit

Earlier project work removed JWT/BCRYPT/password/email settings, Redis, vector-search switches, Swagger credentials, feature flags, logging switches and dozens of provider-specific tuning variables. Logging remains internal for diagnosis. Upload validation, rate limits, AI timeout/retry and request-budget safety defaults remain in code.

Google sign-in still needs a login session. One random cookie token is hashed in MongoDB; HttpOnly, Secure in production, SameSite=Lax and seven-day expiry are fixed. No JWT secret or refresh-token configuration. A temporary state cookie is used only during OAuth.

Optional advanced settings not needed for basic setup: AI_EMBEDDING_MODEL for approximate semantic duplicate detection and SERPAPI_KEY for paid search. Embeddings/search add provider costs; exact question exclusion works without embeddings.

## Release checks

Back up MongoDB/files before migration. Run npm run migrate inside backend to backfill historical ownership/exposures and hash old sessions. This change has not run migration against your real database.

Run builds, lint and backend tests. On actual staging, verify Google login/callback, cookie persistence/reload, logout, two-user isolation, upload/review, questions/answers/history/revisions, fresh-day repeat exclusion and private storage after restart. External providers are mocked in automated tests; live hosting/cookies/credentials still need verification.

Official references: [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Render environment settings](https://render.com/docs/configure-environment-variables), [Render filesystem](https://render.com/docs/disks), [OpenRouter](https://openrouter.ai/docs/quickstart), [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai).

## Audit updates (4 October 2026)

Production Next output is .next-production, separate from local development .next. vercel.json selects that output; normal npm start selects the same production directory. render.yaml provides the optional Render backend blueprint. TRUST_PROXY_HOPS defaults to 1 in production and 0 locally; validate the sanitized forwarding path before changing it. Health checks bypass the browser API rate budget. The launcher honors configured remote MongoDB; stop refuses any process whose workspace ownership cannot be verified.

Use npm run lint and npm run typecheck in interview-prep; npm test runs the backend suite. Frontend browser tests: build, then npm run test:e2e in frontend (Playwright Chromium required). Tests use isolated databases or mocked browser APIs; consult CODEBASE_AUDIT.md for live verification limits.
