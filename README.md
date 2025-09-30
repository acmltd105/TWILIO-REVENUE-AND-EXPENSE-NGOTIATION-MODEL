# TWILIO REVENUE AND EXPENSE NEGOTIATION MODEL

This repository stores sanitized documentation that supports the ongoing revenue and expense negotiation with Twilio, and now ships a full-stack reference implementation spanning FastAPI, a React "liquid glass" dashboard, and a Rust desktop console. All documents and code are redacted to remove sensitive operational or customer information while preserving the context needed for review.

## Repository Structure
- `backend/` — FastAPI service integrating Supabase data, the Python negotiation model, and a Twilio notification queue.
- `desktop/` — Rust desktop console client mirroring the backend insights for offline-ready review.
- `docs/` — Sanitised documentation, timelines, and architecture notes, including `docs/architecture.md` for the new platform.
- `twilio_revenue_and_expense_ngotiation_model/` — Python negotiation model primitives used by the backend.
- `tests/` — Pytest suite covering both the model and API contracts.
- `web/` — React + Tailwind "liquid glass" dashboard consuming backend APIs.

## Development Quickstart

### Backend (FastAPI)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app:app --reload
```

Environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, etc.) control live integrations. When absent, the service falls back to the offline fixtures in `backend/sample_data.py`.

### Frontend (React + Tailwind)
```bash
cd web
pnpm install
pnpm dev
```

The Vite dev server proxies `/api` requests to the FastAPI backend running on `localhost:8000`.

### Desktop Console (Rust)
```bash
cd desktop
cargo run
```

The client reads from `NEGOTIATION_API_BASE` (default `http://localhost:8000/api/v1`).

### Testing
```bash
pytest
```

Additional surface-specific tests can be executed with `pnpm test` (frontend) and `cargo test` (desktop).

## Data Handling
- All monetary figures, identifiers, and customer references are replaced with `[REDACTED]` placeholders where appropriate.
- Source documents remain in secured vault locations referenced within each file.
- Contact the legal or finance owner for access to full, unredacted materials.
