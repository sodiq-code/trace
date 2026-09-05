"""Trace HTTP API — FastAPI service exposing the Stamper and Verifier.

Day 2 surface (report Sec 25.1 + Sec 31.2):
    POST /v1/stamp                 — stamp an uploaded asset (multipart)
    GET  /v1/verify/<asset_id>     — JSON: claim chain + signature validity
    GET  /v1/manifest/<asset_id>   — JSON: raw C2PA manifest + assertions
    GET  /v1/assets                — recent assets (dashboard list)
    GET  /v1/stats                 — dashboard stats (counts + compliance rate)
    GET  /card/<asset_id>          — HTML Provenance Card (public URL)
    GET  /healthz                  — liveness probe
    GET  /docs                     — automatic OpenAPI (technical maturity signal)

No auth in the MVP (report Sec 20.3 trade-off 3: "publicly verifiable is the
point"). Rate-limiting and API keys are post-hackathon roadmap items.
"""
from tracekit.api.app import app, create_app

__all__ = ["app", "create_app"]
