# Web Search & Preparation Calendar

Two companion features: an on-demand **web search/scraper** for finding interview
questions and answers online, and a **date-wise calendar** that records every
question asked (interview, system design, coding, project) plus every web search,
per day.

---

## 1. Web Search / Scraper

### How it works

```
User query
   |
   v
[1] Cache check (SearchCache, per user + normalized query, TTL-based)
   |  miss
   v
[2] Provider fan-out (auto mode runs these in parallel)
      SerpApi        (best quality, needs SERPAPI_KEY)
      StackExchange  (free Q&A: question body + accepted answer)
      DuckDuckGo     (free HTML scraping fallback)
   |  first provider with results wins (priority: serpapi > stackexchange > ddg)
   v
[3] Optional page scraping (includeScrapedContent=true)
      - fetches top N pages (SEARCH_MAX_SCRAPED_PAGES)
      - strips scripts/styles/nav, prefers <main>/<article>
      - caps bytes per page and total extracted chars
      - blocks non-HTTP(S) and private/loopback hosts (SSRF protection)
   v
[4] Answer synthesis
      - AI mode: OpenAI-compatible chat completion -> JSON summary,
        key points, caveats, confidence (needs OPENAI_API_KEY)
      - Heuristic fallback: query-term-scored sentences from snippets/pages
   v
[5] Persist to SearchCache (upsert per user+query) + record in DailyRecord
```

### Backend files

| File | Purpose |
|---|---|
| `modules/web-search/search-providers.ts` | SerpApi / DuckDuckGo / StackExchange clients, HTML scraper, SSRF-safe URL check |
| `modules/web-search/answer-synthesis.ts` | AI synthesis (openai SDK) + heuristic fallback |
| `modules/web-search/search-cache.model.ts` | `SearchCache` model with TTL index and statics |
| `modules/web-search/web-search.service.ts` | Orchestration: cache -> search -> scrape -> synthesize -> persist -> calendar |
| `modules/web-search/routes.ts` | Express router |
| `modules/web-search/web-search.types.ts` | Shared types |

### API

| Endpoint | Method | Description |
|---|---|---|
| `/api/search` | POST | Run a search. Body: `{ query, limit?, includeScrapedContent?, noCache?, recordInCalendar? }` |
| `/api/search/recent` | GET | Recent distinct searches for the current user (`?limit=10`) |

Search responses include the provider used, `cached` flag, raw `results[]`,
and an optional `answer` with `summary`, `keyPoints[]`, `caveats[]`,
`confidence` (0..1), and `basedOn[]` source URLs.

### Frontend

- `/search` — query form, provider/cached badges, synthesized answer card with
  clickable citations, raw results list, recent-search chips.

### Environment variables

```env
# auto | serpapi | duckduckgo | none   ('auto' = serpapi if key set, else free providers)
SEARCH_PROVIDER=auto
SERPAPI_KEY=

SEARCH_STACKEXCHANGE_ENABLED=true
STACKEXCHANGE_KEY=                     # optional, raises API quota
STACKEXCHANGE_SITE=stackoverflow

SEARCH_MAX_RESULTS=10
SEARCH_MAX_SCRAPED_PAGES=4
SEARCH_SCRAPE_TIMEOUT_MS=10000
SEARCH_MAX_PAGE_BYTES=800000
SEARCH_MAX_CONTENT_CHARS=4000
SEARCH_CACHE_TTL_HOURS=24
SEARCH_RESPECT_ROBOTS=true

# AI synthesis of the final answer (falls back to extract-based summary)
SEARCH_AI_SYNTHESIS=true
OPENAI_API_KEY=                        # already used by other AI features
OPENAI_MODEL=gpt-4
```

Notes:

- **Zero new runtime dependencies** — providers use Node 18+ global `fetch`.
- **Fail-soft** — any provider error yields an empty result set, never a 500.
- **Rate limited** — the POST route uses the existing `aiRateLimiter`.
- **Cost control** — cached responses avoid repeat provider/API spend; the TTL
  index lets MongoDB garbage-collect stale cache entries automatically.

---

## 2. Preparation Calendar (date-wise record)

### What it records

One `DailyRecord` document per user per UTC day, with embedded entries for:

- `technical` — interview questions from the daily technical section
- `system_design` — HLD/LLD design questions
- `coding` — coding/DSA problems (with pattern + difficulty)
- `project` — resume-project defense questions
- `revision` — spaced-repetition revisits
- `search` — web searches performed that day (with top source URL)
- plus `mock_interview`, `behavioral`, `custom` for future use

Entries are denormalized snapshots, so the record stays accurate even if the
underlying question/project data changes later. Totals (`questions`, `answered`,
`skipped`, `correct`, `searches`, `byType`) and `averageScore` are recomputed on
every write.

### Write paths

1. **Session generated** — `sessionService.generateDailySession()` records every
   question in the session with status `presented`.
2. **Answer submitted** — `sessionService.submitAnswer()` adds/updates the entry
   with status `answered`, score, and a truncated answer snapshot.
3. **Web search run** — `webSearchService.search()` logs a `search` entry.
4. **Backfill** — `POST /api/calendar/backfill` rebuilds day records from the
   user's existing `DailySession` history (one-time migration for existing users).

### API

| Endpoint | Method | Description |
|---|---|---|
| `/api/calendar/today` | GET | Today's record (creates an empty one) |
| `/api/calendar/day/:date` | GET | Full record for `YYYY-MM-DD` (UTC) |
| `/api/calendar/month/:year/:month` | GET | Per-day totals for a month (month is 1-12) |
| `/api/calendar/range?start=&end=` | GET | Detailed records for a range (max 93 days) |
| `/api/calendar/backfill` | POST | Rebuild from session history |

### Frontend

- `/calendar` — month grid (Monday-first, UTC) where each cell shows question
  count, search count and colored type dots; a side panel shows the selected
  day's totals and every entry with type badges, difficulty, status and score.
- Navigation links added to the header (desktop + mobile).

### Files

| File | Purpose |
|---|---|
| `modules/calendar/daily-record.model.ts` | `DailyRecord` model, unique `(userId, dateKey)` index, `findOrCreateForDate` |
| `modules/calendar/calendar.service.ts` | `recordEntry`, day/month/range queries, `backfillForUser`, `recordQuestionInDailyCalendar` helper |
| `modules/calendar/routes.ts` | Express router |

---

## 3. Session settings, history & "I knew this" (added later)

- **`GET/PUT /api/profile/preferences`** — user-controlled session composition:
  `dailyQuestions` (1-50), `codingCount` (1-10), `systemDesignCount` (1-10),
  `projectQuestions` (3-10) and a `difficulty` choice of `easy`, `medium`,
  `hard`, `extra_hard` or `mixed`. When a specific difficulty is chosen, the
  session generator requests questions of that difficulty ONLY
  (`extra_hard` maps to the EXPERT tier); `mixed` keeps the legacy 20/50/20/10 blend.
  UI: `/settings`.
- **`GET /api/profile/past-questions`** — past asked questions grouped by day
  with a 0-100 performance score per day (70% answer coverage + 30% answer
  quality). UI: `/history`.
- **`POST /api/profile/past-questions/mark-known`** — the "I already knew this"
  button: flags the daily-record entry with `knewAnswer`, marks it `completed`
  with a perfect score, and recomputes the day's totals.

## 4. Integration summary

| Touchpoint | Change |
|---|---|
| `src/index.ts` | Mounted `/api/search` and `/api/calendar` |
| `modules/profile/routes.ts` | Preferences GET/PUT, past-questions, mark-known |
| `src/config/index.ts` | New `config.search.*` block |
| `modules/sessions/session.service.ts` | Calendar hooks on session generation + answer submission |
| `modules/common/entities/index.ts` | Exports `SearchCache` and `DailyRecord` |
| `frontend/src/types/index.ts` | Search + calendar types |
| `frontend/src/app/search/page.tsx` | Search UI |
| `frontend/src/app/calendar/page.tsx` | Calendar UI |
| `frontend/src/components/layout/Header.tsx` | Nav links |

## 4. Quick start

1. Ensure MongoDB is running and the backend `.env` is configured.
2. Optional keys: `SERPAPI_KEY` (better results) and `OPENAI_API_KEY` (cleaner
   synthesized answers). Without them the feature still works via
   StackExchange + DuckDuckGo and extract-based answers.
3. Start the stack (`npm run dev`), register, and open `/search` or `/calendar`.
4. For accounts with existing session history, call `POST /api/calendar/backfill`
   once to populate past days.
