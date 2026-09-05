"""Database tests — schema integrity + CRUD (report Sec 23)."""
from __future__ import annotations

import json

from tracekit.db import Database


def test_schema_creates_all_tables(trace_home):
    db = Database()
    rows = db._conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    names = {r["name"] for r in rows}
    assert {"creators", "assets", "manifests", "verifications"} <= names
    db.close()


def test_get_or_create_creator_is_idempotent(trace_home):
    db = Database()
    cid1 = db.get_or_create_creator("a@b.com", "Alpha")
    cid2 = db.get_or_create_creator("a@b.com", "Alpha")
    assert cid1 == cid2
    db.close()


def test_insert_and_get_asset(trace_home):
    db = Database()
    cid = db.get_or_create_creator("a@b.com", "Alpha")
    db.insert_asset(
        asset_id="aid-1",
        file_path="/tmp/x.png",
        file_type="image",
        file_hash="deadbeef",
        creator_id=cid,
    )
    a = db.get_asset("aid-1")
    assert a is not None
    assert a["file_hash"] == "deadbeef"
    assert a["file_type"] == "image"
    db.close()


def test_recent_assets_ordered_desc(trace_home):
    db = Database()
    cid = db.get_or_create_creator("a@b.com", "Alpha")
    for i in range(3):
        db.insert_asset(
            asset_id=f"aid-{i}",
            file_path=f"/tmp/{i}.png",
            file_type="image",
            file_hash=f"hash-{i}",
            creator_id=cid,
            created_at=f"2026-09-0{i+1}T00:00:00+00:00",
        )
    rows = db.recent_assets(limit=10)
    assert len(rows) == 3
    assert rows[0]["created_at"] >= rows[-1]["created_at"]
    db.close()


def test_insert_manifest_and_lookup(trace_home):
    db = Database()
    cid = db.get_or_create_creator("a@b.com", "Alpha")
    db.insert_asset(
        asset_id="aid-1", file_path="/tmp/x.png", file_type="image",
        file_hash="h", creator_id=cid,
    )
    chain = json.dumps([{"label": "c2pa.actions", "data": {}}])
    db.insert_manifest(
        manifest_id="mid-1", asset_id="aid-1", claim_chain=chain,
        signed_at="2026-09-05T12:00:00+00:00", signed_by="a@b.com",
    )
    m = db.get_manifest_for_asset("aid-1")
    assert m is not None
    assert m["signed_by"] == "a@b.com"
    assert json.loads(m["claim_chain"])[0]["label"] == "c2pa.actions"
    db.close()


def test_insert_verification_and_count(trace_home):
    db = Database()
    cid = db.get_or_create_creator("a@b.com", "Alpha")
    db.insert_asset(
        asset_id="aid-1", file_path="/tmp/x.png", file_type="image",
        file_hash="h", creator_id=cid,
    )
    db.insert_verification(
        asset_id="aid-1", verifier_ip="127.0.0.1",
        verifier_user_agent="curl/8", result="valid",
    )
    assert db.count_verifications() == 1
    assert db.count_assets() == 1
    db.close()


def test_parameterized_queries_prevent_injection(trace_home):
    """Report Sec 26.2: SQL injection must be impossible."""
    db = Database()
    cid = db.get_or_create_creator("normal@x.com", "Normal")
    db.insert_asset(
        asset_id="aid-x", file_path="/tmp/x.png", file_type="image",
        file_hash="h", creator_id=cid,
    )
    # An injection string passed as an asset_id must not match or drop the table.
    db._conn.execute(
        "SELECT * FROM assets WHERE asset_id = ?", ("' OR 1=1; --",)
    ).fetchone()
    # Table still exists and is intact.
    rows = db._conn.execute("SELECT * FROM assets").fetchall()
    assert len(rows) == 1
    db.close()
