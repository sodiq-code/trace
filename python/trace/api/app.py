"""FastAPI application factory and route handlers for Trace.

Architecture (report Sec 20.1): the FastAPI service wraps the same Stamper
and Verifier modules the CLI uses — one Python process, one SQLite handle.
The dashboard (Next.js) talks to this service via a Next.js rewrite
(`/api/v1/*` → `localhost:8000/v1/*`), so the browser only ever sees
same-origin requests.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from .. import config, schemas
from ..db import Database
from ..keys import load_creator_config
from ..schemas import Assertion, FileType, VerificationResult
from ..stamper import Stamper, StamperError, classify_file, sha256_file
from ..verifier import Verifier

# A single shared SQLite handle for the whole process (report Sec 20.1:
# single Python process). check_same_thread=False is set in Database.__init__.
_db: Database | None = None


def get_db() -> Database:
    """Lazily create / refresh the shared SQLite handle.

    Detects TRACE_HOME / TRACE_DB changes (important for tests and for
    ``trace serve`` restarts) and reconnects transparently.
    """
    global _db
    expected_path = str(config.db_path())
    stale = (
        _db is None
        or _db._conn is None
        or getattr(_db, "path", None) != expected_path
    )
    if stale:
        if _db is not None and _db._conn is not None:
            try:
                _db.close()
            except Exception:  # pragma: no cover - defensive
                pass
        _db = Database()
    return _db


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="Trace — Provenance-First AI Content Engine",
        description=(
            "Every AI-generated creator asset, provenance-tagged in one click. "
            "EU AI Act Article 50 compliant in under one second. "
            "Trace attaches cryptographically-verifiable C2PA provenance "
            "manifests to AI-generated assets."
        ),
        version=config.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # CORS: allow the Next.js dashboard (port 3000) and local dev origins.
    # No auth in MVP — the verifier is *meant* to be publicly callable.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------
    @app.get("/healthz", tags=["meta"])
    def healthz() -> dict:
        return {"status": "ok", "version": config.APP_VERSION}

    # ------------------------------------------------------------------
    # POST /v1/stamp  — stamp an uploaded asset (dashboard drag-and-drop)
    # ------------------------------------------------------------------
    @app.post("/v1/stamp", tags=["stamping"], status_code=201)
    async def stamp_asset(
        file: UploadFile = File(..., description="The AI-generated asset to stamp"),
        model: str = Form("unknown-ai-model", description="Generator model, e.g. midjourney-v6"),
        prompt: str = Form("", description="Generation prompt (max 2KB)"),
        creator: str | None = Form(None, description="Creator identity (default: ~/.trace/config.json)"),
    ) -> dict:
        # Resolve creator identity (report Sec 22.1 persistence).
        creator_str = creator or ""
        if not creator_str:
            cfg = load_creator_config()
            creator_str = (cfg or {}).get("creator_email", "unknown@trace.local")

        # Read the upload into a temp file. Use a unique per-upload subdir so
        # simultaneous uploads of the same filename don't collide, while
        # preserving the original (sanitized) name for the signed output.
        upload_dir = config.stamped_dir() / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = os.path.basename(file.filename or "upload.bin")
        if not safe_name:
            safe_name = "upload.bin"
        upload_subdir = upload_dir / f"u{int(time.time() * 1000)}"
        upload_subdir.mkdir(parents=True, exist_ok=True)
        tmp_path = upload_subdir / safe_name

        try:
            content = await file.read()
            tmp_path.write_bytes(content)
        finally:
            await file.close()

        try:
            db = get_db()
            stamper = Stamper(creator=creator_str, db=db)
            result = stamper.stamp(
                tmp_path,
                model=model,
                prompt=prompt,
                creator=creator_str,
            )
        except StamperError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        finally:
            # Clean up the temp upload; the signed asset is already persisted.
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass

        return {
            "asset_id": result.asset_id,
            "manifest_id": result.manifest_id,
            "file_type": result.file_type.value,
            "file_hash": result.file_hash,
            "signed_path": result.signed_path,
            "card_url": f"/card/{result.asset_id}",
            "verify_url": f"/v1/verify/{result.asset_id}",
            "manifest_url": f"/v1/manifest/{result.asset_id}",
            "validation_state": result.validation_state,
            "assertions": [{"name": a.name, "value": a.value} for a in result.assertions],
        }

    # ------------------------------------------------------------------
    # GET /v1/verify/<asset_id>  — Validation Test 2 (report Sec 32.2)
    # ------------------------------------------------------------------
    @app.get("/v1/verify/{asset_id}", tags=["verification"])
    def verify_asset(asset_id: str, request: Request) -> dict:
        db = get_db()
        asset = db.get_asset(asset_id)
        if asset is None:
            raise HTTPException(status_code=404, detail=f"asset not found: {asset_id}")

        # Run the independent verifier on the signed file.
        verify = Verifier().verify_file(asset["file_path"])

        # Log the verification call (report Sec 23.1 Verification entity).
        client_ip = request.client.host if request.client else "unknown"
        ua = request.headers.get("user-agent", "")
        result_str = "valid" if verify.signature_valid else "invalid"
        db.insert_verification(
            asset_id=asset_id,
            verifier_ip=client_ip,
            verifier_user_agent=ua,
            result=result_str,
        )

        manifest_row = db.get_manifest_for_asset(asset_id)
        claim_chain = []
        if manifest_row and manifest_row["claim_chain"]:
            try:
                claim_chain = json.loads(manifest_row["claim_chain"])
            except json.JSONDecodeError:
                claim_chain = []

        return {
            "asset_id": asset_id,
            "file_hash": asset["file_hash"],
            "file_type": asset["file_type"],
            "created_at": asset["created_at"],
            "creator": manifest_row["signed_by"] if manifest_row else "",
            "manifest": {
                "assertions": [
                    {"name": a.name, "value": a.value} for a in verify.assertions
                ],
                "claim_chain": claim_chain,
                "signed_at": manifest_row["signed_at"] if manifest_row else "",
                "signed_by": manifest_row["signed_by"] if manifest_row else "",
                "signature_valid": verify.signature_valid,
                "validation_state": verify.validation_state,
            },
            "verifications": [
                {"verified_at": v["verified_at"], "result": v["result"]}
                for v in _recent_verifications(db, asset_id)
            ],
        }

    # ------------------------------------------------------------------
    # GET /v1/manifest/<asset_id>  — raw manifest for the Provenance Card
    # ------------------------------------------------------------------
    @app.get("/v1/manifest/{asset_id}", tags=["verification"])
    def get_manifest(asset_id: str) -> dict:
        db = get_db()
        asset = db.get_asset(asset_id)
        if asset is None:
            raise HTTPException(status_code=404, detail=f"asset not found: {asset_id}")

        verify = Verifier().verify_file(asset["file_path"])
        manifest_row = db.get_manifest_for_asset(asset_id)

        return {
            "asset_id": asset_id,
            "file_type": asset["file_type"],
            "file_hash": asset["file_hash"],
            "created_at": asset["created_at"],
            "file_path": asset["file_path"],
            "signed_at": manifest_row["signed_at"] if manifest_row else "",
            "signed_by": manifest_row["signed_by"] if manifest_row else "",
            "signature_valid": verify.signature_valid,
            "validation_state": verify.validation_state,
            "claim_generator": verify.claim_generator,
            "assertions": [
                {"name": a.name, "value": a.value} for a in verify.assertions
            ],
            "manifest_json": verify.manifest_json,
        }

    # ------------------------------------------------------------------
    # GET /v1/assets  — recent assets for the dashboard list
    # ------------------------------------------------------------------
    @app.get("/v1/assets", tags=["dashboard"])
    def list_assets(limit: int = Query(20, ge=1, le=100)) -> dict:
        db = get_db()
        rows = db.recent_assets(limit=limit)
        items = []
        for r in rows:
            man = db.get_manifest_for_asset(r["asset_id"])
            items.append({
                "asset_id": r["asset_id"],
                "file_type": r["file_type"],
                "file_hash": r["file_hash"],
                "created_at": r["created_at"],
                "file_name": Path(r["file_path"]).name,
                "signed_by": man["signed_by"] if man else "",
            })
        return {"assets": items, "count": len(items)}

    # ------------------------------------------------------------------
    # GET /v1/stats  — dashboard summary stats (report Sec 29.2)
    # ------------------------------------------------------------------
    @app.get("/v1/stats", tags=["dashboard"])
    def stats() -> dict:
        db = get_db()
        return {
            "total_assets": db.count_assets(),
            "total_verifications": db.count_verifications(),
            "compliance_rate": 1.0,  # stamped assets are always 100% compliant
        }

    # ------------------------------------------------------------------
    # GET /card/<asset_id>  — HTML Provenance Card (report Sec 29.3 + Sec 25.1)
    # ------------------------------------------------------------------
    @app.get("/card/{asset_id}", tags=["card"], response_class=HTMLResponse)
    def provenance_card(asset_id: str, request: Request) -> HTMLResponse:
        db = get_db()
        asset = db.get_asset(asset_id)
        if asset is None:
            raise HTTPException(status_code=404, detail=f"asset not found: {asset_id}")

        verify = Verifier().verify_file(asset["file_path"])
        manifest_row = db.get_manifest_for_asset(asset_id)
        context = {
            "request": request,
            "asset_id": asset_id,
            "asset": asset,
            "file_name": Path(asset["file_path"]).name,
            "signed_at": manifest_row["signed_at"] if manifest_row else "",
            "signed_by": manifest_row["signed_by"] if manifest_row else "",
            "signature_valid": verify.signature_valid,
            "validation_state": verify.validation_state,
            "assertions": verify.assertions,
            "claim_generator": verify.claim_generator,
            "verify_url": f"/v1/verify/{asset_id}",
        }
        return templates.TemplateResponse(request, "card.html", context)

    return app


def _recent_verifications(db: Database, asset_id: str, limit: int = 10) -> list[dict]:
    rows = db._conn.execute(
        "SELECT verified_at, result FROM verifications WHERE asset_id = ? "
        "ORDER BY verified_at DESC LIMIT ?",
        (asset_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


# Module-level app for `uvicorn tracekit.api.app:app` (report Sec 28.1).
app = create_app()
