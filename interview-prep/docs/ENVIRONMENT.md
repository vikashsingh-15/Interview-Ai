# Environment variable audit

Dashboard/shell variables take precedence over the ignored local `interview-prep/.env`. `.env.example` contains placeholders only. The frontend reads only BACKEND_API_URL from the shared local file; Next publishes no provider/database/OAuth credentials.

| Variable | Classification | Required/use |
|---|---|---|
| BACKEND_API_URL | Frontend server configuration, public origin | Required on Vercel, HTTPS Render origin with no path/query/credentials. Build-time rewrite; redeploy after changes. Local default http://localhost:3001. |
| FRONTEND_URL | Backend public configuration, production required | Canonical frontend origin, HTTPS in production; CORS, origin checks, OAuth callback and redirects. |
| MONGODB_URI | Backend secret, production required | Existing MongoDB and GridFS connection; local fallback only in development. |
| GOOGLE_CLIENT_ID | Backend provider configuration, production required | Google OAuth web client ID; not bundled. |
| GOOGLE_CLIENT_SECRET | Backend secret, production required | OAuth token exchange only. |
| AI_PROVIDER | Backend configuration, optional | Supported provider selection; retain all configured provider adapters. |
| AI_API_KEY | Backend secret, optional | Required together with AI_MODEL for fresh AI generation. Never supplied by the frontend. |
| AI_MODEL | Backend configuration, optional | Provider-specific model ID, required with key. |
| AI_BASE_URL | Backend configuration, optional | Custom compatible HTTPS provider origin. |
| AI_FALLBACK_PROVIDER | Backend configuration, optional | Automatic provider fallback, defaults to openrouter. |
| AI_FALLBACK_API_KEY | Backend secret, optional | Requires fallback model and a configured primary provider. |
| AI_FALLBACK_MODEL | Backend configuration, optional | Required with fallback key. |
| AI_FALLBACK_BASE_URL | Backend configuration, optional | Custom fallback endpoint. |
| AI_EMBEDDING_MODEL | Backend configuration, optional | Semantic duplicate detection; preserve. |
| SERPAPI_KEY | Backend secret, optional | Paid search; public search alternatives remain supported. |
| NODE_ENV | Backend/framework runtime, production required | production on Render; test set by isolated tests. |
| PORT | Backend runtime configuration | Render supplies it; validated integer 1–65535; local 3001 fallback. Next has its own CLI/runtime PORT. |
| TRUST_PROXY_HOPS | Backend deployment configuration | 0 locally, defaults to 1 in production. Adjust only after verifying ingress path and sanitized forwarded headers. |
| DEV_BACKEND_PORT / DEV_FRONTEND_PORT | Development only, optional | Local launcher port overrides, default 3001/3000. Update Google callback registration when frontend port changes. |
| VERCEL | Hosting-supplied frontend marker | Enables HTTPS backend-origin guard; do not set manually locally. |
| NODE_VERSION | Hosting configuration | Render blueprint pins Node 22; packages require Node 22.x. |

No NEXT_PUBLIC_* variable is required. Browser calls `/api`; authentication cookies are scoped to the frontend through its rewrite. No JWT/session secret is required: random session tokens are stored hashed in MongoDB. No environment values were removed from private user files. Historical variables in private files are potentially unused but retained because credentials/configuration ownership cannot be conclusively ruled out; do not copy them to hosting indiscriminately.

## Commands and configuration

Vercel root: `interview-prep/frontend`; install `npm ci`; build `npm run build`; framework Next.js; Node 22. Set only BACKEND_API_URL to `https://YOUR-API.onrender.com`.

Render root: `interview-prep/backend`; build `npm ci --include=dev && npm run build`; start `npm start`; health `/api/health`. Set NODE_ENV=production, hosted MONGODB_URI, canonical FRONTEND_URL, Google credentials and the existing primary/fallback AI configuration. Render chooses PORT. `render.yaml` at the Git root is an optional blueprint; no database or AI provider is created or changed.

Google authorized redirect: `<FRONTEND_URL>/api/auth/google/callback`; register local and canonical production URLs exactly. Use frontend `/api/auth/google`, so callback/state/session cookies belong to the same browser origin. CORS permits only FRONTEND_URL with credentials; browser mutations from any other origin are rejected. Unconfigured previews intentionally cannot authenticate.

Local: copy the example to `.env`, configure existing services, run `npm run setup` then `npm run dev` in interview-prep. The launcher honors configured MONGODB_URI; it starts managed local mongod only for the default local host/port. It creates the data directory without deleting it. `--skip-db` reuses an externally running database. Backups and legacy uploads remain intact.

Official references checked during this audit: [Vercel external rewrites](https://vercel.com/docs/routing/rewrites), [Render Node/Express deployment](https://render.com/docs/deploy-node-express-app), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/).
