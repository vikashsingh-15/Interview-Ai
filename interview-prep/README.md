# Interview Prep

**AI-Powered Personalized SDE Interview Preparation Platform**

A production-ready full-stack web application for personalized software engineering interview preparation. The platform creates customized daily interview sessions based on your resume, target role, and weak areas.

## Features

- **Resume Parsing**: Upload PDF/DOCX resumes and extract structured profile information
- **Personalized Curriculum**: Custom curriculum based on your skills, experience, and target role
- **Daily Interview Sessions**: Fresh questions every day across multiple categories
- **Question Bank**: Curated and AI-generated questions with full metadata
- **Spaced Repetition**: Automatic revision scheduling (+1 day, +7 days, +30 days) — weak answers (score < 70%) are queued and resurface in future sessions
- **AI Answer Evaluation**: Every submitted answer is graded against a rubric (AI when an OpenAI key is configured, transparent keyword-coverage heuristic otherwise) with strengths, weaknesses, missing points and a reference answer
- **Project Interview**: Practice defending your actual resume projects
- **System Design**: Practice HLD, LLD, and distributed system design
- **Coding/DSA Tracking**: Track coding problems with patterns and progress
- **Mock Interviews**: Full-length mock sessions with dynamic follow-up questions
- **Web Search / Scraper**: Search the web (SerpApi, Stack Exchange, DuckDuckGo) for interview questions and answers on demand, with page scraping and AI-synthesized answers
- **Preparation Calendar**: Date-wise record of every question asked each day — interview, system design, coding and project — plus a log of web searches, with a month-view calendar UI
- **Weakness Detection**: Automatic weak concept identification and targeted practice
- **Progress Analytics**: Comprehensive analytics dashboard
- **Market Calibration**: Calibrate expectations for target companies

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Custom component library with shadcn/ui patterns
- **State Management**: React Query
- **Notifications**: React Hot Toast

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Zod + express-validator
- **Authentication**: JWT with HTTP-only cookies
- **Rate Limiting**: express-rate-limit
- **Logging**: Winston
- **File Upload**: Multer

### Infrastructure
- **Database**: MongoDB (Atlas or self-hosted)
- **Caching/Queue**: Redis (optional)
- **Vector Search**: MongoDB Atlas Vector Search (optional)
- **Containerization**: Docker
- **Deployment**: Compatible with Vercel, Render, Railway, AWS

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB instance
- npm or yarn

### Local Development

1. **Clone and install dependencies**:
```bash
cd interview-prep
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

2. **Configure environment**:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your configuration
```

3. **Start with Docker Compose (recommended)**:
```bash
docker-compose up -d
```

4. **Or start manually**:
```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

5. **Seed the database**:
```bash
cd backend
npm run seed
```

6. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/api-docs (when enabled)

## Project Structure

```
interview-prep/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           # Authentication
│   │   │   ├── resume/         # Resume upload & parsing
│   │   │   ├── profile/        # Interview profile
│   │   │   ├── skill-graph/    # Skill tracking
│   │   │   ├── questions/      # Question bank
│   │   │   ├── sessions/       # Daily sessions
│   │   │   ├── revisions/      # Spaced repetition
│   │   │   ├── projects/       # Project interview
│   │   │   ├── coding/         # Coding problems
│   │   │   ├── mock-interviews/# Mock interviews
│   │   │   ├── market-calibration/ # Company calibration
│   │   │   ├── analytics/      # Progress analytics
│   │   │   └── common/         # Shared utilities
│   │   ├── config/             # Configuration
│   │   └── scripts/            # Seed scripts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js App Router
│   │   ├── components/         # React components
│   │   ├── lib/                # Utilities
│   │   │   ├── api.ts         # API client
│   │   │   └── utils.ts       # Helpers
│   │   └── types/             # TypeScript types
│   └── package.json
├── docker/
│   ├── docker-compose.yml      # Development
│   └── docker-compose.prod.yml # Production
└── docker-compose.yml
```

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Resume
- `POST /api/resume/upload` - Upload resume
- `GET /api/resume` - Get user's resume
- `PUT /api/resume/replace` - Replace resume
- `DELETE /api/resume` - Delete resume
- `POST /api/resume/parse/:id` - Parse resume
- `GET /api/resume/profile` - Get resume profile
- `PUT /api/resume/profile` - Update resume profile
- `POST /api/resume/regenerate-profile` - Regenerate interview profile

### Sessions
- `POST /api/sessions/generate` - Generate daily session
- `GET /api/sessions/today` - Get today's session
- `GET /api/sessions/:id` - Get session by ID
- `POST /api/sessions/:id/start` - Start session
- `POST /api/sessions/:id/complete` - Complete session
- `POST /api/sessions/:id/answers/:questionId` - Submit answer
- `GET /api/sessions/history` - Get session history
- `GET /api/sessions/day/:dayNumber` - Get specific day

### More APIs
- `POST /api/search` - Web search for Q&A (cached, optional scraping + AI answer)
- `GET /api/search/recent` - Recent searches
- `GET /api/calendar/today` - Today's preparation record
- `GET /api/calendar/day/:date` - Full record for a date (YYYY-MM-DD)
- `GET /api/calendar/month/:year/:month` - Per-day totals for a month
- `GET /api/calendar/range?start=&end=` - Records for a date range
- `POST /api/calendar/backfill` - Rebuild calendar from session history

See the API documentation in `/docs/API.md` for complete endpoint reference, and
`/docs/ADAPTIVE_LOOP.md` for how answer evaluation, spaced repetition and the
skill graph work together.

## Environment Variables

### Backend

```env
# Server
NODE_ENV=development
PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/interview-prep

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Email
EMAIL_PROVIDER=ethereal
EMAIL_FROM=noreply@interviewprep.dev

# AI Providers (optional — powers answer evaluation, answer synthesis and
# question generation; without a key the app falls back to heuristic grading
# and template questions)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
AI_DEFAULT_PROVIDER=openai

# Web Search (optional — free DuckDuckGo/StackExchange fallback if no SerpApi key)
SEARCH_PROVIDER=auto
SERPAPI_KEY=
SEARCH_MAX_RESULTS=10
SEARCH_CACHE_TTL_HOURS=24
SEARCH_AI_SYNTHESIS=true

# File Upload
UPLOAD_MAX_SIZE_MB=10
ALLOWED_FILE_TYPES=pdf,docx
```

See `backend/.env.example` for complete list.

### Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Interview Prep
```

## Development Workflow

1. **Run tests**:
```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e  # Requires Playwright setup
```

2. **Seed database**:
```bash
cd backend
npm run seed
```

3. **Lint**:
```bash
npm run lint
```

4. **Build**:
```bash
npm run build
```

## Production Deployment

### Docker Deployment

1. **Configure production environment**:
```bash
cp docker/.env.example docker/.env
# Edit with production values
```

2. **Start production stack**:
```bash
docker-compose -f docker/docker-compose.prod.yml up -d
```

### Manual Deployment

1. **Build the application**:
```bash
npm run build
```

2. **Start the backend**:
```bash
cd backend
npm start
```

3. **Build and serve frontend**:
```bash
cd frontend
npm run build
npm start
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE.md)
- [API Reference](docs/API.md)
- [AI Architecture](docs/AI_ARCHITECTURE.md)
- [Question Generation](docs/QUESTION_GENERATION.md)
- [Duplicate Detection](docs/QUESTION_UNIQUENESS.md)
- [Curriculum Engine](docs/CURRICULUM_ENGINE.md)
- [Revision Engine](docs/REVISION_ENGINE.md)
- [Resume Pipeline](docs/RESUME_PIPELINE.md)
- [Project Interview](docs/PROJECT_INTERVIEW.md)
- [Market Calibration](docs/MARKET_CALIBRATION.md)
- [Web Search & Calendar](docs/WEB_SEARCH_CALENDAR.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For questions or issues:
- Check the documentation
- Search existing issues
- Create a new issue with details

---

**Built for SDE-2 engineers who want to ace their next interview.**
