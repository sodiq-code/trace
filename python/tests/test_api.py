"""FastAPI HTTP API tests — Validation Tests 2 & 3 (, 32.3).

Test 2: GET /v1/verify/<asset_id> returns 200 OK with JSON containing
    {asset_id, file_hash, manifest: {assertions, signature_valid: true}}.
Test 3: GET /card/<asset_id> renders the source chain + green VALID badge.
"""
from __future__ import annotations

import io
import struct
import time
import zlib

import pytest
from fastapi.testclient import TestClient

from tracekit.api.app import create_app
from tracekit.db import Database
from tracekit.stamper import Stamper


@pytest.fixture
def client(trace_home):
  """FastAPI TestClient wired to an isolated TRACE_HOME."""
  app = create_app()
  # Reset the shared DB so each test gets a fresh handle on the tmp home.
  import tracekit.api.app as api_mod
  api_mod._db = None
  with TestClient(app) as c:
    yield c
  api_mod._db = None


def _png_bytes(w: int = 32, h: int = 32, rgb=(40, 90, 160)) -> bytes:
  raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

  def chunk(typ, data):
    return (struct.pack(">I", len(data)) + typ + data +
        struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

  return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
      + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_healthz(client):
  r = client.get("/healthz")
  assert r.status_code == 200
  assert r.json()["status"] == "ok"


def test_openapi_docs_available(client):
  """/docs (technical maturity signal)."""
  r = client.get("/docs")
  assert r.status_code == 200
  r2 = client.get("/openapi.json")
  assert r2.status_code == 200
  paths = r2.json()["paths"]
  assert "/v1/stamp" in paths
  assert "/v1/verify/{asset_id}" in paths
  assert "/card/{asset_id}" in paths


# ---------------------------------------------------------------------------
# POST /v1/stamp
# ---------------------------------------------------------------------------

def test_stamp_endpoint_returns_valid_manifest(client):
  png = _png_bytes()
  r = client.post(
    "/v1/stamp",
    files={"file": ("thumb.png", png, "image/png")},
    data={"model": "midjourney-v6", "prompt": "neon tech thumbnail",
       "creator": "maya@channel.com"},
  )
  assert r.status_code == 201, r.text
  body = r.json()
  assert body["validation_state"].lower() == "valid"
  assert body["file_type"] == "image"
  assert body["asset_id"]
  assert body["card_url"] == f"/card/{body['asset_id']}"
  assert body["verify_url"] == f"/v1/verify/{body['asset_id']}"
  names = {a["name"] for a in body["assertions"]}
  assert "Generated using" in names
  assert "Creator" in names


def test_stamp_endpoint_rejects_unsupported_type(client):
  r = client.post(
    "/v1/stamp",
    files={"file": ("report.pdf", b"%PDF-1.4 fake", "application/pdf")},
    data={"model": "m", "prompt": "p"},
  )
  assert r.status_code == 400
  assert "unsupported" in r.json()["detail"].lower()


def test_stamp_endpoint_enforces_prompt_cap(client):
  r = client.post(
    "/v1/stamp",
    files={"file": ("x.png", _png_bytes(), "image/png")},
    data={"model": "m", "prompt": "x" * 2049},
  )
  assert r.status_code == 400


# ---------------------------------------------------------------------------
# GET /v1/verify/<asset_id> — Validation Test 2
# ---------------------------------------------------------------------------

def test_verify_endpoint_returns_correct_response(client):
  """200 OK with {asset_id, file_hash,
  manifest: {assertions, signature_valid: true}}."""
  # First stamp an asset.
  stamp_r = client.post(
    "/v1/stamp",
    files={"file": ("thumb.png", _png_bytes(), "image/png")},
    data={"model": "midjourney-v6", "prompt": "test",
       "creator": "maya@channel.com"},
  )
  asset_id = stamp_r.json()["asset_id"]

  # Now verify it.
  r = client.get(f"/v1/verify/{asset_id}")
  assert r.status_code == 200
  body = r.json()
  assert body["asset_id"] == asset_id
  assert body["file_hash"]
  assert body["manifest"]["signature_valid"] is True
  assert body["manifest"]["validation_state"].lower() == "valid"
  assert len(body["manifest"]["assertions"]) > 0
  assert body["manifest"]["signed_by"] == "maya@channel.com"

  # The verification call must be logged.
  assert len(body["verifications"]) >= 1
  assert body["verifications"][0]["result"] == "valid"


def test_verify_endpoint_404_for_unknown_asset(client):
  r = client.get("/v1/verify/does-not-exist")
  assert r.status_code == 404


def test_verify_logs_verification_record(client):
  stamp_r = client.post(
    "/v1/stamp",
    files={"file": ("thumb.png", _png_bytes(), "image/png")},
    data={"model": "m", "prompt": "p", "creator": "c@e.com"},
  )
  asset_id = stamp_r.json()["asset_id"]

  db = Database()
  before = db.count_verifications()
  db.close()

  client.get(f"/v1/verify/{asset_id}")
  client.get(f"/v1/verify/{asset_id}")

  db = Database()
  after = db.count_verifications()
  db.close()
  assert after == before + 2


# ---------------------------------------------------------------------------
# GET /v1/manifest/<asset_id>
# ---------------------------------------------------------------------------

def test_manifest_endpoint_returns_raw_manifest(client):
  stamp_r = client.post(
    "/v1/stamp",
    files={"file": ("thumb.png", _png_bytes(), "image/png")},
    data={"model": "midjourney-v6", "prompt": "neon cat", "creator": "m@c.com"},
  )
  asset_id = stamp_r.json()["asset_id"]

  r = client.get(f"/v1/manifest/{asset_id}")
  assert r.status_code == 200
  body = r.json()
  assert body["signature_valid"] is True
  assert body["claim_generator"].startswith("trace")
  assert body["manifest_json"] # raw C2PA JSON
  assert "active_manifest" in body["manifest_json"]


# ---------------------------------------------------------------------------
# GET /card/<asset_id> — Validation Test 3
# ---------------------------------------------------------------------------

def test_card_endpoint_renders_html_with_green_badge(client):
  """+ green VALID badge."""
  stamp_r = client.post(
    "/v1/stamp",
    files={"file": ("thumb.png", _png_bytes(), "image/png")},
    data={"model": "midjourney-v6", "prompt": "neon tech",
       "creator": "maya@channel.com"},
  )
  asset_id = stamp_r.json()["asset_id"]

  r = client.get(f"/card/{asset_id}")
  assert r.status_code == 200
  assert "text/html" in r.headers.get("content-type", "")
  html = r.text
  assert "Provenance Card" in html
  assert "Cryptographic signature: VALID" in html # green badge
  assert "midjourney-v6" in html # creator-readable assertion
  assert "maya@channel.com" in html


def test_card_endpoint_404_for_unknown_asset(client):
  r = client.get("/card/no-such-asset")
  assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /v1/assets + /v1/stats — dashboard data
# ---------------------------------------------------------------------------

def test_assets_endpoint_lists_stamped_assets(client):
  for i in range(3):
    client.post(
      "/v1/stamp",
      files={"file": (f"t{i}.png", _png_bytes(), "image/png")},
      data={"model": "m", "prompt": str(i), "creator": "c@e.com"},
    )
  r = client.get("/v1/assets")
  assert r.status_code == 200
  body = r.json()
  assert body["count"] == 3
  assert all("asset_id" in a for a in body["assets"])


def test_stats_endpoint_returns_counts(client):
  client.post(
    "/v1/stamp",
    files={"file": ("t.png", _png_bytes(), "image/png")},
    data={"model": "m", "prompt": "p", "creator": "c@e.com"},
  )
  r = client.get("/v1/stats")
  assert r.status_code == 200
  body = r.json()
  assert body["total_assets"] == 1
  assert body["compliance_rate"] == 1.0
  assert body["total_verifications"] == 0


# ---------------------------------------------------------------------------
# End-to-end latency — Validation Test 4 (, <3s)
# ---------------------------------------------------------------------------

def test_end_to_end_under_3_seconds(client):
  """→ card → verify in under 3 seconds."""
  t0 = time.perf_counter()

  # 1. Stamp
  stamp_r = client.post(
    "/v1/stamp",
    files={"file": ("latency.png", _png_bytes(), "image/png")},
    data={"model": "midjourney-v6", "prompt": "latency test",
       "creator": "maya@channel.com"},
  )
  asset_id = stamp_r.json()["asset_id"]

  # 2. Fetch the manifest (card data)
  client.get(f"/v1/manifest/{asset_id}")

  # 3. Verify
  verify_r = client.get(f"/v1/verify/{asset_id}")

  elapsed = time.perf_counter() - t0
  assert verify_r.status_code == 200
  assert verify_r.json()["manifest"]["signature_valid"] is True
  assert elapsed < 3.0, f"end-to-end took {elapsed:.2f}s (target <3s)"
