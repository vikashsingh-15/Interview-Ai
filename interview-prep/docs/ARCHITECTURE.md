# Architecture Documentation

## Overview

Interview Prep is a full-stack web application for personalized SDE interview preparation. The architecture follows a clean separation between frontend, backend, database, and AI services.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client / Browser                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Next.js   │  │   React     │  │   Tailwind CSS          │ │
│  │  (App Router)│  │ Components  │  │   Responsive Design     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend API (Express)                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Middleware Layer                         ││
│  │  • Request ID  • Rate Limiting  • Auth  • Validation       ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Route Handlers                          ││
│  │  /api/auth  /api/resume  /api/sessions  /api/questions      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Service Layer                           ││
│  │  • AuthService  • ResumeService  • SessionService          ││
│  │  • QuestionService  • RevisionService  • AnalyticsService  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    AI Provider Layer                       ││
│  │  • AIProvider (OpenAI, Gemini, NVIDIA, Custom)             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │   MongoDB    │  │    Redis     │  │  File Storage         │ │
│  │  (Mongoose)  │  │  (Optional)  │  │  (Uploads)            │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Principles

1. **Database is Source of Truth**: All business logic decisions are made by the backend, not AI
2. **AI is a Tool**: AI assists with generation, evaluation, and extraction
3. **Separation of Concerns**: Clear boundaries between modules
4. **Idempotency**: Operations are safe to retry
5. **Security First**: Authentication, authorization, input validation at every layer

## Module Architecture

### Authentication Module
- **Purpose**: User registration, login, session management
- **Components**: 
  - User model (bcrypt hashing, JWT)
  - Session model (active sessions tracking)
  - Auth service (business logic)
  - Auth controller (HTTP handlers)
  - Rate limiting for brute-force protection

### Resume Module
- **Purpose**: Upload, parse, and manage resumes
- **Components**:
  - Resume/RésuméVersion models (versioning)
  - ResumeProfile model (extracted data)
  - Resume service (upload, parse, validate)
  - Parse pipeline (secure file handling)

### Profile Module
- **Purpose**: User's interview preparation profile
- **Components**:
  - InterviewProfile model (target role, companies, preferences)
  - Profile generation from resume data

### Skill Graph Module
- **Purpose**: Track user's skill mastery over time
- **Components**:
  - Topic, Subtopic, Concept models (knowledge hierarchy)
  - SkillGraph model (user progress tracking)
  - Update rules based on answers

### Questions Module
- **Purpose**: Question bank and generation
- **Components**:
  - Question model (full metadata, provenance)
  - QuestionHistory model (user exposure tracking)
  - Question service (selection, generation, validation)
  - Duplicate detection (multiple levels)
  - Quality validation pipeline

### Sessions Module
- **Purpose**: Daily interview session generation
- **Components**:
  - DailySession model (day-wise sessions)
  - SessionQuestion model (question mapping)
  - Session service (generation, progression)
  - Topic selection engine

### Revisions Module
- **Purpose**: Spaced repetition scheduling
- **Components**:
  - Revision model (revision schedule, attempts)
  - Revision service (due tracking, progression)
  - Spaced repetition algorithm

### Projects Module
- **Purpose**: Project interview preparation
- **Components**:
  - Project model (verified projects)
  - ProjectInterviewTree (interview structure)
  - Project interview question generation

### Coding Module
- **Purpose**: Coding/DSA problem tracking
- **Components**:
  - CodingProblem model (problem metadata)
  - CodingHistory model (user attempts)
  - Pattern tracking and progress

### Mock Interview Module
- **Purpose**: Simulated interview sessions
- **Components**:
  - MockInterview model (session tracking)
  - Dynamic follow-up question generation

### Market Calibration Module
- **Purpose**: Company-specific interview calibration
- **Components**:
  - MarketSource model (public sources)
  - MarketCalibrationProfile (user preferences)

### Analytics Module
- **Purpose**: Progress tracking and visualization
- **Components**:
  - UserProgress model (aggregated stats)
  - Analytics service (calculations)

## Data Flow

### Registration Flow
```
User → POST /api/auth/register
    → Validate input
    → Hash password (bcrypt)
    → Create User record
    → (Optional) Generate verification token
    → (Optional) Send verification email
    → Return success response
```

### Resume Upload Flow
```
User → POST /api/resume/upload (file)
    → Validate file (type, size, integrity)
    → Calculate checksum
    → Save file securely
    → Create ResumeVersion record
    → Update Resume record
    → Create initial ResumeProfile (empty)
    → (Async) Start parsing job
    → Return response
```

### Resume Parsing Flow
```
ResumeFile → Parser
    → Extract text (pdf-parse / mammoth)
    → Send to AI with structured prompt
    → AI returns structured data
    → Validate extracted data
    → Update ResumeProfile
    → Mark parse complete
```

### Session Generation Flow
```
Request → POST /api/sessions/generate
    → Check if session exists (idempotency)
    → Load InterviewProfile
    → Load SkillGraph (weak areas)
    → Load DueRevisions
    → Select topic for day
    → Generate sections:
        → Revisions section
        → Technical section (10 questions)
        → System Design section (2 questions)
        → Coding section (2 problems)
        → Project section (5 questions)
    → For each question:
        → Search existing questions
        → Check user history
        → If no suitable: Generate with AI
        → Validate
        → Duplicate check
        → Persist
    → Create DailySession
    → Return session
```

### Answer Submission Flow
```
User → POST /api/sessions/:id/answers/:questionId
    → Find session question
    → Validate answer
    → Record answer
    → (Async) Evaluate with AI
    → Update QuestionHistory
    → Update SkillGraph
    → Check if revision needed
    → Return response
```

## Design Patterns

### Repository Pattern
Each module has its own data access layer through Mongoose models.

### Service Layer
Business logic is isolated in service classes, separate from HTTP handlers.

### Provider Pattern (AI)
AI providers implement a common interface, allowing easy switching.

### Pipeline Pattern (Validation)
Questions pass through multiple validation stages before acceptance.

### Strategy Pattern (Topic Selection)
Different topic selection strategies can be plugged in.

## Scalability Considerations

- **Database Indexes**: All major queries have appropriate indexes
- **Pagination**: Large lists are paginated
- **Caching**: Expensive operations can be cached
- **Background Jobs**: Expensive operations can be offloaded to queues
- **Vector Search**: Semantic search for duplicate detection

## Security Architecture

- **Authentication**: JWT with HTTP-only cookies
- **Authorization**: User ownership checks on all resources
- **Input Validation**: Zod schemas + express-validator
- **Rate Limiting**: Multiple levels (global, auth, upload, AI)
- **File Upload**: Type validation, size limits, secure storage
- **Prompt Injection**: Resume text treated as data, not instructions
- **Secrets**: All API keys, JWT secrets remain server-side

## Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend | Next.js 14 | SSR, file-based routing, React ecosystem |
| Backend | Express.js | Mature, flexible, large ecosystem |
| Database | MongoDB | Flexible schema, good for varied question data |
| ODM | Mongoose | Schema validation, middleware, strong typing |
| AI | OpenAI (primary) | Quality, reliability, ecosystem |
| Auth | JWT + Cookies | Stateless, scalable, secure |
| Styling | Tailwind CSS | Utility-first, responsive, consistent |
| Language | TypeScript | Type safety, maintainability |
