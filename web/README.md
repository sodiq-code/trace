# Trace Web Dashboard

The Next.js dashboard for Trace — drag-and-drop C2PA provenance stamping,
the compliance dashboard, and the public Provenance Card page.

## Architecture

```
Browser ──► Next.js (port 3000) ──rewrite──► FastAPI (port 8000)
              /                       /api/v1/*          /v1/*
              /card/[id]              /api/card/*        /card/*
```

The browser only ever makes same-origin requests to `/api/v1/*`. Next.js
rewrites those to the FastAPI service on `localhost:8000` (see
`next.config.ts`). This keeps the frontend free of absolute URLs and works
identically in local dev and behind a reverse proxy.

## Routes

| Route | Description |
| --- | --- |
| `/` | Dashboard — drag-and-drop stamping + compliance stats + recent assets |
| `/card/[id]` | Provenance Card — public URL rendering the asset's source chain |

## Quickstart

```bash
# 1. Start the FastAPI service (from the repo root)
make setup
trace serve --port 8000

# 2. In another terminal, start the dashboard
cd web
npm install
npm run dev    # opens http://localhost:3000
```

## Design system

Per report Section 29.5:
- **Navy** `#1F3A5F` — primary (headers, buttons)
- **Blue** `#2E5C8A` — secondary (hover states)
- **Green** `#2E8B57` — compliance success (the signature VALID badge)
- **Red** `#C0392B` — compliance failure
- **Gray** `#7A7A7A` — tertiary text

The green compliance checkmark is the largest visual element on every screen
(report Sec 29.1 principle 1: compliance-first hierarchy).
