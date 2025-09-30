# Twilio Revenue & Expense Negotiation Platform Architecture

## Objectives
- Provide an end-to-end negotiation support platform spanning API, realtime data sync, analytics, and multi-surface clients (web + desktop).
- Ensure fault tolerance through graceful degradation when Supabase or Twilio credentials are absent or network access is unavailable.
- Maintain an explicit set of pre-flight error scenarios (minimum 10) with mitigation strategies prior to executing CLI tools or deployment commands.
- Deliver a React ("liquid glass" aesthetic) UI styled with Tailwind CSS, a FastAPI backend connected to Supabase, and a Rust desktop companion app that mirrors the negotiation insights.

## High-Level Topology
```
+-------------------+          HTTPS           +---------------------------+
| React Frontend    | <----------------------> | FastAPI Backend           |
| (web/)            |                          | (backend/app.py)          |
+-------------------+                          +------------+--------------+
             ^                                               |
             | WebSocket (optional polling fallback)         |
             |                                               v
+-------------------+          Supabase REST           +-----------+
| Rust Desktop App  | <------------------------------> | Supabase  |
| (desktop/)        |                                  | (Postgres) |
+-------------------+                                  +-----------+
             ^                                               |
             | Twilio REST                                  v
             +------------------> Twilio Notify / Studio Flow
```

## Backend Components
| Module | Responsibility |
| ------ | -------------- |
| `backend/config.py` | Centralised settings sourced from environment variables with defaults to ensure graceful degradation. |
| `backend/supabase_gateway.py` | Lazy Supabase client creation with fallback to cached JSON fixtures stored in `backend/sample_data.py`. |
| `backend/twilio_gateway.py` | Safe Twilio notifier that queues notifications in-memory when credentials or network are unavailable. |
| `backend/services.py` | Business logic orchestrating negotiation calculations, invoice rollups, and health reporting. |
| `backend/app.py` | FastAPI application exposing health, negotiation, invoices, and notification endpoints. |

## Frontend Components
- `web/src/lib/api.ts`: Typed client calling backend endpoints with automatic retries and offline caching via IndexedDB (through browser `caches` API fallback when IndexedDB unavailable).
- `web/src/components/LiquidGlassCard.tsx`: Shared container applying glassmorphism to align with the "liquid glass" requirement.
- `web/src/features/NegotiationDashboard`: Feature module rendering revenue vs expense, margin bands, and Twilio send controls.
- Tailwind configured with custom theme tokens for glassmorphism gradients.

## Desktop Components
- `desktop/src/main.rs`: Tokio-based async CLI fetching negotiation envelope and invoices, rendering them in a terminal dashboard using colourful borders.
- `desktop/src/config.rs`: Mirrors backend configuration loading to point at local backend by default.
- `desktop/src/client.rs`: Reuses the same endpoint schema with serde models and automatic retry/backoff.

## Data Flow
1. React UI requests `/api/v1/health`, `/api/v1/negotiation`, and `/api/v1/invoices` from FastAPI.
2. Backend resolves data from Supabase; if unavailable, reads baked-in fixtures.
3. Negotiation envelope computed via `twilio_revenue_and_expense_ngotiation_model` module.
4. Twilio notifications triggered via POST `/api/v1/notifications/demo` and queue locally until Twilio connectivity is restored.
5. Desktop Rust app polls the same endpoints, enabling offline negotiation reviews.

## Pre-flight Error Catalogue & Mitigation (10 scenarios)
| # | Scenario | Mitigation |
| - | -------- | ---------- |
| 1 | Supabase credentials missing | Gateway falls back to fixture data and reports degraded mode via health endpoint. |
| 2 | Supabase returns schema change | Schema validation coerces fields and drops unexpected keys with logged warnings. |
| 3 | Network timeout to Supabase | Retry with exponential backoff (max 3) before switching to cached data. |
| 4 | Twilio credentials absent | Twilio gateway stores pending notifications in queue and surfaces warning banner in UI. |
| 5 | Twilio API error | Automatically retries once and records failure in health diagnostics. |
| 6 | Negotiation payload invalid | Pydantic validation returns 422 with detailed error messaging consumed by frontend form validation. |
| 7 | Desktop app offline | CLI caches last successful payload to `~/.twilio-negotiation/cache.json` and replays on next start. |
| 8 | Frontend fetch failure | API client uses exponential backoff and surfaces toast with retry button; offline mode uses cached data. |
| 9 | Backend computation error | Exceptions captured and converted into structured 500 JSON responses with correlation IDs. |
| 10 | Configuration drift between surfaces | Shared JSON schema version stored at `docs/schema-version.json`; mismatches block deployment via preflight script. |

## Testing Strategy
- Python: `pytest` for negotiation service and FastAPI routes, plus contract tests for fallback behaviour.
- TypeScript: `pnpm test` (vitest) for hooks/components logic; storybook visual tests optional.
- Rust: `cargo test` for configuration loader and HTTP client.
- End-to-end smoke: `docker-compose up` (future) to run Supabase emulator + backend + frontend + desktop via GitHub Actions matrix.

## Deployment Notes
- Backend served via Uvicorn on port 8000; production deployment via container with multi-stage build.
- Frontend deployed to GitHub Pages or Vercel; environment variables injected at build time.
- Desktop app distributed as binary using `cargo dist` pipeline (future work).

