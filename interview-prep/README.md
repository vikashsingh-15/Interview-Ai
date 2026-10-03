# Interview Prep

Resume-driven interview practice for any role: confirm your resume facts, choose your target, and create a daily plan.

## One configuration file

The only local env file is [.env](.env) at this project root. Both frontend and backend load it. It is ignored by Git; do not commit credentials. There are no development, production or example env files.

Use Node.js 22 LTS. From this directory:

```powershell
npm run setup
npm run dev
```

`npm run dev` starts all three services in one terminal — MongoDB, the backend API on 3001 and the frontend on 3000 — waits for each to be reachable, prefixes their output, and stops everything on Ctrl+C. A locally cached mongod binary is used automatically; if one is already listening on 27017 it is reused.

```powershell
npm run dev:backend     # API only
npm run dev:frontend    # web app only
npm run stop            # frees 27017, 3000 and 3001
```

Open http://localhost:3000. API health is http://localhost:3001/api/health. Fill the Google credentials in .env first; Google is the only sign-in option. On first sign-in, an account is created automatically. No password, JWT secret, email provider or Redis is required.

### Running the services by hand

Two variables have to be set explicitly, and the backend now refuses to start
without them rather than failing in a confusing way:

| Variable | Why |
| --- | --- |
| `PORT=3001` | Many shells export `PORT=0`. The backend would bind a random port while the frontend rewrites `/api` to a fixed `http://localhost:3001`, so every request fails even though the server "started". |
| `MONGODB_URI="mongodb://localhost:27017/interview-prep-dev"` | `.env` points at an Atlas SRV host that does not resolve locally, which otherwise kills startup with `querySrv ECONNREFUSED`. |

The frontend must run on **port 3000**: Google OAuth is registered with the callback `http://localhost:3000/api/auth/google/callback`, so any other port fails at the consent screen.

```bash
# terminal 1
cd backend
PORT=3001 MONGODB_URI="mongodb://localhost:27017/interview-prep-dev" npm run start:dev

# terminal 2
cd frontend
npx next dev -p 3000
```

If cloning into a fresh directory, create a root .env with the settings listed in [Deployment](docs/DEPLOYMENT.md); the private file is intentionally not in Git.

## AI

Set AI_PROVIDER to openrouter, gemini, openai or custom, then AI_API_KEY and AI_MODEL for that provider. For custom OpenAI-compatible endpoints also set AI_BASE_URL. No separate key/settings for every provider. Without key/model, the app uses conservative resume extraction and available curated questions rather than fake AI output.

Fresh questions are tracked per user at assignment time. Exact normalized repeats are blocked; lexical and optional embedding checks filter near-duplicates. Concepts can repeat. Labeled revisions can reuse earlier questions.

## Deploy

Frontend on Vercel, backend on Render, hosted MongoDB and private durable resume storage. See the [short deployment checklist](docs/DEPLOYMENT.md). Production settings go in the hosting dashboards; no additional env files are needed.

## Checks

```powershell
npm run build
Set-Location backend
npm test -- --runInBand
```

Tests use isolated MongoDB and mocked external providers. They do not prove live Google/AI or deployed cookie behavior. Resumes now use MongoDB GridFS without AWS settings. Existing password accounts need explicit Google linking before cutover; stored user/resume/question data has not been deleted.

On a fresh database, seed the curated content before the first session: `npm run seed:all`. Coding questions draw from that bank, and an unseeded install falls back to AI-generated problems.
