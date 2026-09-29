# Interview Prep

Resume-driven interview practice for any role: confirm your resume facts, choose your target, and create a daily plan.

## One configuration file

The only local env file is [.env](.env) at this project root. Both frontend and backend load it. It is ignored by Git; do not commit credentials. There are no development, production or example env files.

Use Node.js 22 LTS and MongoDB. From this directory:

```powershell
npm run setup
npm run dev
```

Open http://localhost:3000. API health is http://localhost:3001/api/health. Fill the Google credentials in .env first; Google is the only sign-in option. On first sign-in, an account is created automatically. No password, JWT secret, email provider or Redis is required.

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
