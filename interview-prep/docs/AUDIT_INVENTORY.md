# Audit inventory

Generated with `node scripts/audit-inventory.mjs`. Private environments, logs, data, binaries and build output are excluded. All source/config/test/script text is read to collect static imports, API surfaces and dependency evidence. Static references are evidence of use, not proof that an unreferenced item is safe to remove.

## Direct dependencies

| App | Dependency | Declared class | Static usage evidence / disposition |
|---|---|---|---|
| backend | cookie-parser | runtime/build | backend/src/index.ts |
| backend | cors | runtime/build | backend/src/index.ts |
| backend | dotenv | runtime/build | backend/src/config/index.ts, backend/tests/setup.live.ts |
| backend | express | runtime/build | backend/src/common/filters/error-filter.ts, backend/src/common/filters/not-found-filter.ts, backend/src/common/middleware/auth.ts, backend/src/common/middleware/request-id.ts |
| backend | express-rate-limit | runtime/build | backend/src/common/middleware/rate-limit.ts |
| backend | express-validator | runtime/build | backend/src/common/middleware/validate.ts |
| backend | google-auth-library | runtime/build | backend/src/modules/auth/google.service.ts |
| backend | helmet | runtime/build | backend/src/index.ts |
| backend | mammoth | runtime/build | backend/src/modules/resume/resume-parser.ts |
| backend | mongoose | runtime/build | backend/src/common/services/resume-storage.ts, backend/src/common/services/structured-ai.ts, backend/src/index.ts, backend/src/modules/analytics/progress-analytics.model.ts |
| backend | morgan | runtime/build | backend/src/index.ts |
| backend | multer | runtime/build | backend/src/modules/resume/resume.controller.ts |
| backend | openai | runtime/build | backend/src/common/services/ai-provider.ts, backend/src/modules/evaluation/answer-evaluation.ts, backend/src/modules/questions/personalized-generator.ts, backend/tests/unit/ai-provider.test.ts |
| backend | pdf-parse | runtime/build | backend/src/modules/resume/resume-parser.ts |
| backend | winston | runtime/build | backend/src/config/logger.ts |
| backend | zod | runtime/build | backend/src/common/services/structured-ai.ts, backend/src/modules/auth/auth.controller.ts, backend/src/modules/evaluation/answer-evaluation.ts, backend/src/modules/mock-interviews/interviewer.routes.ts |
| backend | @types/cookie-parser | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/cors | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/express | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/jest | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/morgan | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/multer | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/node | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/pdf-parse | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @types/supertest | development/test | TypeScript declaration resolution; development/build types, retained |
| backend | @typescript-eslint/eslint-plugin | development/test | package scripts or framework/build/test configuration; retained |
| backend | @typescript-eslint/parser | development/test | package scripts or framework/build/test configuration; retained |
| backend | eslint | development/test | package scripts or framework/build/test configuration; retained |
| backend | jest | development/test | backend/jest.config.js, backend/jest.live.config.js |
| backend | jszip | development/test | backend/tests/helpers/resume-fixtures.ts |
| backend | mongodb | development/test | Config/script/type/plugin or transitive tooling; retained pending conclusive proof |
| backend | mongodb-memory-server | development/test | backend/tests/integration/providers.test.ts, backend/tests/integration/resume-storage.test.ts, backend/tests/integration/source-practice.test.ts, backend/tests/integration/topic-practice-live.test.ts |
| backend | nodemon | development/test | Config/script/type/plugin or transitive tooling; retained pending conclusive proof |
| backend | supertest | development/test | backend/tests/integration/providers.test.ts, backend/tests/integration/source-practice.test.ts, backend/tests/integration/topic-practice-live.test.ts, backend/tests/integration/topic-practice.test.ts |
| backend | ts-jest | development/test | package scripts or framework/build/test configuration; retained |
| backend | ts-node | development/test | package scripts or framework/build/test configuration; retained |
| backend | ts-node-dev | development/test | package scripts or framework/build/test configuration; retained |
| backend | typescript | development/test | package scripts or framework/build/test configuration; retained |
| frontend | @types/node | runtime/build | TypeScript declaration resolution; development/build types, retained |
| frontend | @types/react | runtime/build | TypeScript declaration resolution; development/build types, retained |
| frontend | @types/react-dom | runtime/build | TypeScript declaration resolution; development/build types, retained |
| frontend | autoprefixer | runtime/build | package scripts or framework/build/test configuration; retained |
| frontend | axios | runtime/build | frontend/src/lib/api.ts |
| frontend | clsx | runtime/build | frontend/src/lib/utils.ts |
| frontend | next | runtime/build | frontend/next.config.js, frontend/src/app/dashboard/page.tsx, frontend/src/app/experience/page.tsx, frontend/src/app/layout.tsx |
| frontend | postcss | runtime/build | package scripts or framework/build/test configuration; retained |
| frontend | react | runtime/build | frontend/src/app/calendar/page.tsx, frontend/src/app/dashboard/page.tsx, frontend/src/app/experience/page.tsx, frontend/src/app/history/page.tsx |
| frontend | react-dom | runtime/build | Config/script/type/plugin or transitive tooling; retained pending conclusive proof |
| frontend | react-hot-toast | runtime/build | frontend/src/components/providers/ToastProvider.tsx |
| frontend | tailwind-merge | runtime/build | frontend/src/lib/utils.ts |
| frontend | tailwindcss | runtime/build | frontend/tailwind.config.ts |
| frontend | typescript | runtime/build | package scripts or framework/build/test configuration; retained |
| frontend | @playwright/test | development/test | frontend/playwright.config.ts, frontend/tests/e2e/source-practice.spec.ts |
| frontend | eslint | development/test | package scripts or framework/build/test configuration; retained |
| frontend | eslint-config-next | development/test | package scripts or framework/build/test configuration; retained |

Root workspace mongodb-memory-server is a local tooling install boundary and is retained. Backend uses its separate declared test dependency. Locks are retained and synchronized by npm install.

## Files and API/model surfaces

| File | Lines | Imports | Routes / schema indexes |
|---|---|---|---|
| backend/.eslintrc.cjs | 17 |  |  |
| backend/jest.config.js | 10 | jest |  |
| backend/jest.live.config.js | 10 | jest, ./jest.config.js |  |
| backend/package.json | 75 |  |  |
| backend/src/common/filters/error-filter.ts | 219 | express, ../../config/logger, ../../config |  |
| backend/src/common/filters/index.ts | 8 | ./error-filter, ./not-found-filter |  |
| backend/src/common/filters/not-found-filter.ts | 23 | express, ../../config/logger |  |
| backend/src/common/middleware/auth.ts | 39 | express, crypto, ../../config, ../filters/error-filter, ../../modules/auth/user.model, ../../modules/auth/index.model |  |
| backend/src/common/middleware/index.ts | 5 | ./request-id, ./rate-limit, ./auth, ./validate |  |
| backend/src/common/middleware/rate-limit.ts | 108 | express-rate-limit, ../../config, ../../config/logger |  |
| backend/src/common/middleware/request-id.ts | 10 | express, crypto |  |
| backend/src/common/middleware/validate.ts | 95 | express, express-validator, ../filters/error-filter |  |
| backend/src/common/services/ai-provider.ts | 125 | openai, ../../config, ../../config/logger |  |
| backend/src/common/services/resume-storage.ts | 53 | mongoose, fs/promises, path, stream, stream/promises, ../../config, ../filters/error-filter |  |
| backend/src/common/services/structured-ai.ts | 94 | ./ai-provider, crypto, mongoose, zod, ../../config | ; 1 explicit schema indexes |
| backend/src/config/index.ts | 62 | dotenv, path, os |  |
| backend/src/config/logger.ts | 29 | winston |  |
| backend/src/config/validate.ts | 40 | ./index, ../common/services/ai-provider |  |
| backend/src/index.ts | 195 | express, mongoose, cors, helmet, cookie-parser, morgan, ./config, ./common/middleware/rate-limit, crypto, ./config/validate, ./modules/profile/onboarding.routes, ./config/logger, ./common/filters/error-filter, ./common/filters/not-found-filter, ./modules/auth/routes, ./modules/resume/routes, ./modules/profile/routes, ./modules/skill-graph/routes, ./modules/questions/routes, ./modules/sessions/routes, ./modules/revisions/routes, ./modules/projects/routes, ./modules/coding/routes, ./modules/mock-interviews/interviewer.routes, ./modules/mock-interviews/routes, ./modules/market-calibration/routes, ./modules/analytics/routes, ./modules/web-search/routes, ./modules/calendar/routes, ./modules/topics/routes, ./modules/coding/coding-problem.model, ./modules/projects/project.model, ./modules/mock-interviews/mock-interview.model, ./modules/market-calibration/market-calibration.model, ./modules/analytics/progress-analytics.model, ./modules/questions/feedback.routes, ./modules/questions/admin.routes |  |
| backend/src/modules/analytics/progress-analytics.model.ts | 518 | mongoose | ; 2 explicit schema indexes |
| backend/src/modules/analytics/routes.ts | 54 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET /overview |
| backend/src/modules/auth/auth.controller.ts | 61 | express, zod, ../../common/middleware/auth, ../../config, ../../common/filters/error-filter, ./google.service, ./auth.service, ../../common/middleware/rate-limit | GET /providers; GET /google; GET /google/link; GET /google/callback; POST /logout; GET /me; PUT /me; DELETE /me |
| backend/src/modules/auth/auth.service.ts | 32 | ./user.model, ./index.model, ../../common/middleware/auth, ../../common/filters/error-filter, ./user-data.service |  |
| backend/src/modules/auth/google.service.ts | 61 | google-auth-library, mongoose, crypto, ../../config, ./user.model, ../../common/middleware/auth, ../../common/filters/error-filter | ; 1 explicit schema indexes |
| backend/src/modules/auth/index.model.ts | 63 | ./user.model, mongoose | ; 3 explicit schema indexes |
| backend/src/modules/auth/routes.ts | 4 | ./auth.controller |  |
| backend/src/modules/auth/user-data.service.ts | 23 | mongoose, ../resume/resume.model, ../sessions/daily-session.model, ../questions/question.model, ../../common/services/resume-storage |  |
| backend/src/modules/auth/user.model.ts | 115 | mongoose | ; 1 explicit schema indexes |
| backend/src/modules/calendar/calendar.service.ts | 332 | mongoose, ../../config/logger, ./daily-record.model, ../sessions/daily-session.model, ../../common/filters/error-filter |  |
| backend/src/modules/calendar/daily-record.model.ts | 212 | mongoose | ; 3 explicit schema indexes |
| backend/src/modules/calendar/index.ts | 10 | ./routes, ./calendar.service, ./daily-record.model |  |
| backend/src/modules/calendar/routes.ts | 123 | express, ../../common/middleware/auth, ../../common/filters/error-filter, ./calendar.service | GET /month/:year/:month; GET /day/:date; GET /range; GET /today; POST /backfill |
| backend/src/modules/coding/coding-problem.model.ts | 500 | mongoose | ; 15 explicit schema indexes |
| backend/src/modules/coding/routes.ts | 38 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET / |
| backend/src/modules/common/entities/index.ts | 141 | ../../auth/user.model, ../../auth/index.model, ../../resume/resume.model, ../../resume/resume-profile.model, ../../profile/interview-profile.model, ../../skill-graph/skill-graph.model, ../../questions/question.model, ../../questions/question-history.model, ../../sessions/daily-session.model, ../../revisions/revision.model, ../../projects/project.model, ../../coding/coding-problem.model, ../../mock-interviews/mock-interview.model, ../../market-calibration/market-calibration.model, ../../analytics/progress-analytics.model, ../../web-search/search-cache.model, ../../calendar/daily-record.model |  |
| backend/src/modules/evaluation/answer-evaluation.ts | 349 | zod, ../../common/services/structured-ai, openai, ../../common/services/ai-provider, ../../config/logger, ,  |  |
| backend/src/modules/market-calibration/market-calibration.model.ts | 365 | mongoose | ; 8 explicit schema indexes |
| backend/src/modules/market-calibration/routes.ts | 31 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET /sources |
| backend/src/modules/mock-interviews/interviewer.routes.ts | 83 | express, zod, mongoose, ../../common/middleware/auth, ../../common/filters/error-filter, ./mock-interview.model, ../questions/question.model, ../questions/personalized-generator, ../../common/services/structured-ai, ../evaluation/answer-evaluation, ../../config | POST /start; GET /:id([a-fA-F0-9]{24}); POST /:id/answer |
| backend/src/modules/mock-interviews/mock-interview.model.ts | 440 | mongoose | ; 5 explicit schema indexes |
| backend/src/modules/mock-interviews/routes.ts | 33 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET / |
| backend/src/modules/profile/daily-plan.ts | 153 |  |  |
| backend/src/modules/profile/interview-profile.model.ts | 310 | mongoose | ; 1 explicit schema indexes |
| backend/src/modules/profile/onboarding.routes.ts | 125 | express, zod, mongoose, ../../common/middleware/auth, ../../common/filters/error-filter, ../resume/resume.model, ../resume/resume-profile.model, ./interview-profile.model, ./daily-plan, ../skill-graph/skill-graph.model, ../resume/resume.service, ../resume/resume-parser | GET /onboarding; PUT /review; POST /onboarding |
| backend/src/modules/profile/routes.ts | 363 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter, ../../common/services/ai-provider, ./daily-plan, ../../config, ../../config/logger, ./interview-profile.model | GET /preferences; PUT /preferences; GET /ai-status; GET /past-questions; POST /past-questions/mark-known |
| backend/src/modules/projects/project.model.ts | 512 | mongoose | ; 11 explicit schema indexes |
| backend/src/modules/projects/routes.ts | 33 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET / |
| backend/src/modules/projects/sync-from-resume.ts | 60 | mongoose, ../../config/logger, ./project.model |  |
| backend/src/modules/questions/admin.routes.ts | 24 | express, zod, ../../common/middleware/auth, ../../common/filters/error-filter, ./question.model, ../../common/services/structured-ai | GET /questions; PATCH /questions/:id; GET /ai-usage |
| backend/src/modules/questions/ai-question-generator.service.ts | 15 | ./personalized-generator, ../../common/filters/error-filter |  |
| backend/src/modules/questions/answer.service.ts | 271 | zod, ../../common/services/structured-ai, ../../common/services/ai-provider, ./question.model, ../../common/filters/error-filter |  |
| backend/src/modules/questions/feedback.routes.ts | 40 | express, zod, mongoose, ../../common/middleware/auth, ../../common/filters/error-filter, ../sessions/daily-session.model, ./question-history.model, ./question.model, ../revisions/revision.model | POST /:sessionId/:mappingId |
| backend/src/modules/questions/personalized-generator.ts | 427 | mongoose, crypto, zod, openai, ../../common/services/ai-provider, ../../config, ../../config/logger, ../profile/interview-profile.model, ../resume/resume-profile.model, ../skill-graph/skill-graph.model, ./question-history.model, ./question.model, ../../common/services/structured-ai, ../../common/filters/error-filter | ; 2 explicit schema indexes |
| backend/src/modules/questions/question-history.model.ts | 435 | mongoose, ./question.model | ; 12 explicit schema indexes |
| backend/src/modules/questions/question.model.ts | 587 | mongoose | ; 10 explicit schema indexes |
| backend/src/modules/questions/question.service.ts | 301 | mongoose, ./question.model, ./question-history.model, ../../common/filters/error-filter |  |
| backend/src/modules/questions/routes.ts | 39 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET / |
| backend/src/modules/resume/resume-parser.ts | 192 | mammoth, zod, ../../config, ../../config/logger, ../../common/services/structured-ai, ../../common/filters/error-filter, pdf-parse/lib/pdf-parse.js |  |
| backend/src/modules/resume/resume-profile.model.ts | 315 | mongoose | ; 5 explicit schema indexes |
| backend/src/modules/resume/resume.controller.ts | 382 | express, multer, path, ../../config, ../../common/filters/error-filter, ../../common/middleware/auth, ../../common/middleware/rate-limit, ./resume.service, ./resume.model, ./resume-profile.model, zod, ../../common/services/resume-storage, mongoose | GET /files/:id; POST /upload; POST /parse/:resumeVersionId; GET /; PUT /replace; DELETE /; GET /profile; PUT /profile; POST /regenerate-profile; GET /versions |
| backend/src/modules/resume/resume.model.ts | 156 | mongoose | ; 3 explicit schema indexes |
| backend/src/modules/resume/resume.service.ts | 533 | ../../common/services/resume-storage, ./resume-parser, mongoose, path, crypto, ../../config, ../../config/logger, ./resume.model, ./resume-profile.model, ../profile/interview-profile.model, ../projects/sync-from-resume, ../../common/filters/error-filter |  |
| backend/src/modules/resume/routes.ts | 4 | ./resume.controller |  |
| backend/src/modules/revisions/revision.model.ts | 477 | mongoose | ; 7 explicit schema indexes |
| backend/src/modules/revisions/routes.ts | 118 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET /due; GET /schedule |
| backend/src/modules/sessions/daily-session.model.ts | 501 | mongoose | ; 8 explicit schema indexes |
| backend/src/modules/sessions/routes.ts | 4 | ./session.controller |  |
| backend/src/modules/sessions/session.controller.ts | 501 | express, ../../common/middleware/auth, ../../common/filters/error-filter, ./session.service, ./daily-session.model, mongoose, ../questions/question.model, ../questions/answer.service | POST /generate; GET /today; GET /:sessionId([a-fA-F0-9]{24}); GET /:sessionId/questions/:questionId/answer; POST /:sessionId/questions/:questionId/generate-answer; GET /question/:questionId/answer; POST /question/:questionId/generate-answer; POST /:sessionId/questions/:questionId/review; POST /:sessionId/questions/:questionId/skip; POST /today/regenerate; POST /:sessionId/answers/:questionId; POST /:sessionId/start; POST /:sessionId/complete; GET /history; GET /day/:dayNumber |
| backend/src/modules/sessions/session.service.ts | 1066 | crypto, ../questions/answer.service, ../questions/personalized-generator, mongoose, ../../config/logger, ./daily-session.model, ../questions/question.model, ../questions/question-history.model, ../revisions/revision.model, ../profile/daily-plan, ../profile/interview-profile.model, ../skill-graph/skill-graph.model, ../../common/filters/error-filter, ../calendar/calendar.service, ../calendar/daily-record.model, ../evaluation/answer-evaluation |  |
| backend/src/modules/skill-graph/routes.ts | 30 | mongoose, express, ../../common/middleware/auth, ../../common/filters/error-filter | GET / |
| backend/src/modules/skill-graph/skill-graph.model.ts | 532 | mongoose |  |
| backend/src/modules/topics/practice-source.ts | 64 | mongoose, ../resume/resume-profile.model, ../projects/project.model, ../../common/filters/error-filter |  |
| backend/src/modules/topics/routes.ts | 239 | express, zod, ../../common/middleware/auth, ../../common/filters/error-filter, ./practice-source, ../questions/question.model, ./topic-practice.service | GET /experience; GET /source/:kind/:id; GET /; GET /skills; GET /progress; GET /history; POST /practice; GET /questions/:questionId/answer; POST /questions/:questionId/generate-answer; POST /questions/:questionId/skip; POST /questions/:questionId/feedback |
| backend/src/modules/topics/topic-practice.service.ts | 894 | mongoose, zod, ../../config/logger, ../questions/question.model, ../questions/question-history.model, ../questions/answer.service, ../calendar/calendar.service, ../calendar/daily-record.model, ../../common/filters/error-filter, ../../common/services/ai-provider, ../../common/services/structured-ai, ../questions/personalized-generator, ../resume/resume-profile.model, ../profile/interview-profile.model, ./practice-source |  |
| backend/src/modules/web-search/answer-synthesis.ts | 169 | ../../common/services/ai-provider, ../../config, ../../config/logger, ./web-search.types |  |
| backend/src/modules/web-search/index.ts | 14 | ./routes, ./web-search.service, ./search-cache.model, ./web-search.types, ./search-providers, ./answer-synthesis |  |
| backend/src/modules/web-search/routes.ts | 54 | express, ../../common/middleware/auth, ../../common/filters/error-filter, ../../common/middleware/rate-limit, ./web-search.service | POST /; GET /recent |
| backend/src/modules/web-search/search-cache.model.ts | 181 | mongoose, ./web-search.types | ; 3 explicit schema indexes |
| backend/src/modules/web-search/search-providers.ts | 454 | ../../config, ../../config/logger, ./web-search.types |  |
| backend/src/modules/web-search/web-search.service.ts | 167 | mongoose, ../../config, ../../config/logger, ./search-cache.model, ./search-providers, ./answer-synthesis, ./web-search.types, ../calendar/calendar.service |  |
| backend/src/modules/web-search/web-search.types.ts | 50 |  |  |
| backend/src/scripts/index.ts | 4 |  |  |
| backend/src/scripts/migrate-resume-storage.ts | 40 | mongoose, crypto, ../config, ../modules/resume/resume.model, ../common/services/resume-storage |  |
| backend/src/scripts/migrate.ts | 45 | mongoose, ../config, ../modules/resume/resume.model, ../modules/resume/resume-profile.model, ../modules/profile/interview-profile.model, ../modules/sessions/daily-session.model, ../modules/questions/personalized-generator, ../modules/auth/index.model, ../common/middleware/auth |  |
| backend/src/scripts/seed-coding-questions.ts | 266 | mongoose, ../config, ../modules/coding/coding-problem.model |  |
| backend/src/scripts/seed.ts | 673 | mongoose, ../config, ../modules/skill-graph/skill-graph.model, ../modules/questions/question.model, ../modules/coding/coding-problem.model |  |
| backend/tests/helpers/resume-fixtures.ts | 27 | jszip |  |
| backend/tests/integration/providers.test.ts | 211 | mongoose, mongodb-memory-server, ../../src/config, ../../src/modules/auth/user.model, ../../src/modules/resume/resume-profile.model, ../../src/modules/profile/interview-profile.model, ../../src/modules/auth/google.service, ../../src/common/middleware/auth, ../../src/modules/auth/index.model, ../../src/modules/questions/personalized-generator, ../../src/common/services/structured-ai, ../../src/common/services/ai-provider, zod, supertest, ../../src/index, ../../src/modules/mock-interviews/mock-interview.model, ../../src/modules/questions/question.model |  |
| backend/tests/integration/resume-storage.test.ts | 93 | mongoose, mongodb-memory-server, ../../src/common/services/resume-storage, ../helpers/resume-fixtures, fs/promises, path, crypto, ../../src/config, ../../src/modules/resume/resume.model, ../../src/scripts/migrate-resume-storage, ../../src/modules/resume/resume.service |  |
| backend/tests/integration/source-practice.test.ts | 136 | mongoose, supertest, mongodb-memory-server, ../../src/config, ../../src/index, ../../src/modules/auth/user.model, ../../src/modules/resume/resume-profile.model, ../../src/modules/projects/project.model, ../../src/modules/questions/question.model, ../../src/modules/questions/question-history.model, ../../src/common/middleware/auth, ../../src/modules/projects/sync-from-resume, ../../src/common/services/structured-ai, ../../src/common/services/ai-provider |  |
| backend/tests/integration/topic-practice-live.test.ts | 78 | mongoose, supertest, mongodb-memory-server, ../../src/config, ../../src/index, ../../src/modules/questions/question.model, ../../src/common/middleware/auth, ../../src/modules/auth/user.model |  |
| backend/tests/integration/topic-practice.test.ts | 198 | mongoose, supertest, mongodb-memory-server, ../../src/config, ../../src/index, ../helpers/resume-fixtures, ../../src/modules/questions/question.model, ../../src/common/middleware/auth, ../../src/modules/auth/user.model |  |
| backend/tests/integration/user-journey.test.ts | 330 | mongoose, supertest, mongodb-memory-server, ../../src/config, ../../src/index, ../helpers/resume-fixtures, ../../src/modules/sessions/daily-session.model, ../../src/modules/questions/question.model, ../../src/modules/questions/personalized-generator, ../../src/modules/auth/index.model, ../../src/common/middleware/auth, ../../src/modules/auth/user.model, ../../src/modules/resume/resume.model, ../../src/common/services/resume-storage, ../../src/modules/auth/user-data.service, ../../src/modules/calendar/daily-record.model, ../../src/modules/coding/coding-problem.model |  |
| backend/tests/setup.live.ts | 14 | dotenv, path |  |
| backend/tests/setup.ts | 6 |  |  |
| backend/tests/unit/ai-provider.test.ts | 135 | openai, ../../src/config, ../../src/common/services/ai-provider, ../../src/common/services/structured-ai |  |
| backend/tests/unit/answer-evaluation.test.ts | 149 | ../../src/modules/evaluation/answer-evaluation |  |
| backend/tests/unit/audit-regressions.test.ts | 35 | ../../src/config, ../../src/config/validate, ../../src/modules/analytics/progress-analytics.model, ../../src/modules/profile/onboarding.routes |  |
| backend/tests/unit/personalization.test.ts | 152 | ../../src/modules/questions/personalized-generator, ../../src/modules/resume/resume-parser, ../../src/common/services/structured-ai, ../../src/config, ../helpers/resume-fixtures, ../../src/modules/profile/daily-plan |  |
| backend/tsconfig.json | 25 |  |  |
| docs/ADAPTIVE_LOOP.md | 128 |  |  |
| docs/ARCHITECTURE.md | 16 |  |  |
| docs/backend-dependency-audit.json | 23 |  |  |
| docs/DEPLOYMENT.md | 89 |  |  |
| docs/ENVIRONMENT.md | 42 |  |  |
| docs/frontend-dependency-audit.json | 135 |  |  |
| docs/SECURITY.md | 228 |  |  |
| docs/superpowers/plans/2026-09-29-answer-reveal.md | 58 |  |  |
| docs/superpowers/plans/2026-09-29-google-only-render-vercel.md | 117 |  |  |
| docs/superpowers/plans/2026-09-29-mongodb-resume-storage.md | 66 |  |  |
| docs/superpowers/plans/2026-09-29-project-simplification.md | 52 |  |  |
| docs/superpowers/plans/2026-09-29-real-user-journey.md | 14 |  |  |
| docs/superpowers/plans/2026-10-04-audit-experience-practice.md | 58 |  |  |
| docs/WEB_SEARCH_CALENDAR.md | 198 |  |  |
| frontend/.eslintrc.json | 9 |  |  |
| frontend/next-env.d.ts | 7 |  |  |
| frontend/next.config.js | 24 | node:fs, node:path, next |  |
| frontend/package.json | 45 |  |  |
| frontend/playwright.config.ts | 9 | @playwright/test |  |
| frontend/postcss.config.js | 7 |  |  |
| frontend/public/favicon.svg | 11 |  |  |
| frontend/src/app/calendar/page.tsx | 452 | react, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/lib/api, @/types |  |
| frontend/src/app/dashboard/page.tsx | 492 | react, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Button, @/components/ui/Badge, @/components/ui/Progress, @/lib/api, @/types, @/lib/utils, next/link, next/navigation |  |
| frontend/src/app/experience/page.tsx | 51 | react, next/link, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/lib/api |  |
| frontend/src/app/globals.css | 2 | ../styles/globals.css |  |
| frontend/src/app/history/page.tsx | 327 | react, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/components/ui/Progress, @/lib/api, @/types, @/components/features/AnswerView |  |
| frontend/src/app/layout.tsx | 40 | next, ./globals.css, @/components/providers/AuthProvider, @/components/providers/ToastProvider, @/components/layout/Header |  |
| frontend/src/app/login/page.tsx | 5 | @/components/auth/LoginForm |  |
| frontend/src/app/mock-interview/page.tsx | 33 | react, @/components/providers/AuthProvider, next/navigation, @/lib/api |  |
| frontend/src/app/not-found.tsx | 24 | next/link |  |
| frontend/src/app/onboarding/page.tsx | 162 | react, next/navigation, @/components/providers/AuthProvider, @/lib/api, next/link |  |
| frontend/src/app/page.tsx | 16 | @/components/ui/Card, @/components/auth/LoginForm, @/components/features/HeroSection, @/components/features/FeaturesSection, @/components/features/HowItWorksSection, @/components/features/CTASection |  |
| frontend/src/app/practice/[kind]/[id]/page.tsx | 29 | react, next/navigation, next/link, @/components/providers/AuthProvider, @/components/features/PracticeScreen, @/lib/api |  |
| frontend/src/app/projects/page.tsx | 129 | react, next/link, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/lib/api |  |
| frontend/src/app/search/page.tsx | 261 | react, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/lib/api, @/types, @/lib/utils |  |
| frontend/src/app/sessions/today/page.tsx | 695 | react, next/navigation, next/link, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/components/ui/Progress, @/lib/api, @/components/revision/RevisionSchedule, @/lib/utils |  |
| frontend/src/app/settings/page.tsx | 360 | react, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/lib/api, @/types |  |
| frontend/src/app/topics/page.tsx | 8 | @/components/features/PracticeScreen, @/components/providers/AuthProvider |  |
| frontend/src/components/auth/index.ts | 2 | ./LoginForm |  |
| frontend/src/components/auth/LoginForm.tsx | 18 | react, @/components/ui/Button, @/lib/api |  |
| frontend/src/components/features/AnswerView.tsx | 269 | react |  |
| frontend/src/components/features/CTASection.tsx | 35 |  |  |
| frontend/src/components/features/FeaturesSection.tsx | 146 | next/link, @/components/ui |  |
| frontend/src/components/features/HeroSection.tsx | 109 | next/link, @/components/ui/Button |  |
| frontend/src/components/features/HowItWorksSection.tsx | 91 | next/link |  |
| frontend/src/components/features/index.ts | 5 | ./HeroSection, ./FeaturesSection, ./HowItWorksSection, ./CTASection |  |
| frontend/src/components/features/PracticeConfigDialog.tsx | 279 | react, @/components/ui/Button |  |
| frontend/src/components/features/PracticeScreen.tsx | 998 | react, next/link, @/components/providers/AuthProvider, @/components/ui/Card, @/components/ui/Badge, @/components/ui/Button, @/components/ui/Progress, @/lib/api, @/lib/utils, @/components/features/AnswerView, @/components/features/PracticeConfigDialog |  |
| frontend/src/components/layout/Header.tsx | 337 | next/link, @/components/providers/AuthProvider, @/lib/utils, react |  |
| frontend/src/components/layout/index.ts | 2 | ./Header |  |
| frontend/src/components/providers/AuthProvider.tsx | 81 | react, @/lib/api, @/types |  |
| frontend/src/components/providers/ToastProvider.tsx | 24 | react-hot-toast |  |
| frontend/src/components/revision/RevisionSchedule.tsx | 151 | react, @/components/ui/Card, @/components/ui/Badge, @/lib/api, @/lib/utils |  |
| frontend/src/components/ui/Badge.tsx | 36 | react, @/lib/utils |  |
| frontend/src/components/ui/Button.tsx | 70 | react, @/lib/utils |  |
| frontend/src/components/ui/Card.tsx | 76 | react, @/lib/utils |  |
| frontend/src/components/ui/index.ts | 8 | ./Button, ./Card, ./Badge, ./Input, ./Textarea, ./Progress, ./Select |  |
| frontend/src/components/ui/Input.tsx | 51 | react, @/lib/utils |  |
| frontend/src/components/ui/Progress.tsx | 59 | react, @/lib/utils |  |
| frontend/src/components/ui/Select.tsx | 69 | react, @/lib/utils |  |
| frontend/src/components/ui/Textarea.tsx | 50 | react, @/lib/utils |  |
| frontend/src/lib/api.ts | 23 | axios |  |
| frontend/src/lib/utils.ts | 104 | clsx, tailwind-merge |  |
| frontend/src/styles/globals.css | 249 |  |  |
| frontend/src/types/index.ts | 590 |  |  |
| frontend/tailwind.config.ts | 50 | tailwindcss |  |
| frontend/tests/e2e/source-practice.spec.ts | 54 | @playwright/test |  |
| frontend/tsconfig.json | 42 |  |  |
| frontend/vercel.json | 7 |  |  |
| IMPLEMENTATION_SUMMARY.md | 95 |  |  |
| package.json | 37 |  |  |
| README.md | 71 |  |  |
| scripts/audit-inventory.mjs | 43 | node:fs, node:path, node:url |  |
| scripts/audit-runtime.mjs | 80 | node:module, node:child_process, node:net, node:path, node:url |  |
| scripts/dev.mjs | 190 | node:child_process, node:fs, node:net, node:os, node:path, node:url |  |
| scripts/stop.mjs | 78 | node:child_process, node:path, node:url |  |
