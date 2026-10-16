# Global Error Reporting Implementation Plan

**Goal:** Capture browser runtime, unhandled promise, React boundary, console, and API errors across pages and write safe structured events to the Interview Prep backend Render logs.

**Architecture:** A shared frontend reporter sends bounded, redacted events to `/api/client-errors`. A backend route validates each event and emits it through the existing Winston logger. Existing request IDs connect browser and backend events.

**Tech Stack:** Next.js App Router, React, Express, Zod, Winston.

## Files

- `frontend/src/lib/client-error-reporting.ts`: event shaping, duplicate/rate control, transport.
- `frontend/src/components/providers/ClientErrorMonitor.tsx`: global browser and console listeners.
- `frontend/src/app/error.tsx`, `global-error.tsx`: report React-render failures.
- `frontend/src/lib/api.ts`: report API failures through the shared reporter.
- `frontend/src/app/api/client-errors/route.ts`: remove frontend-host-only intake.
- `backend/src/modules/diagnostics/client-errors.routes.ts`: validate and log client events.
- `backend/src/index.ts`: mount the diagnostics route.

## Tasks

1. Add the validated backend endpoint and mount it under `/api/client-errors`; log only bounded event metadata, message, and stack, without query strings or request bodies.
2. Add the shared frontend reporter and install browser, promise, and console error listeners globally.
3. Add App Router error boundaries and route API failures through the shared reporter; remove the Next.js route that currently logs only on the frontend host.
4. Review the diff for secret exposure and verify formatting/types without running tests unless requested.
