"""SQLite persistence for Trace (report Sec 23 / Sec 20.2).

Schema mirrors the four core entities from Section 23.1:
    creators, assets, manifests, verifications.

SQLite is chosen for the MVP (report Sec 20.2): zero-config, single-file,
survives demo restarts, no orchestration overhead. All writes use
parameterized queries (SQL-injection safe — report Sec 26.2).
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import config


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS creators (
    creator_id   TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    channel_name TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    asset_id    TEXT PRIMARY KEY,
    file_path   TEXT NOT NULL,
    file_type   TEXT NOT NULL,
    file_hash   TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    creator_id  TEXT NOT NULL,
    FOREIGN KEY (creator_id) REFERENCES creators(creator_id)
);
CREATE INDEX IF NOT EXISTS idx_assets_creator ON assets(creator_id);
CREATE INDEX IF NOT EXISTS idx_assets_hash    ON assets(file_hash);

CREATE TABLE IF NOT EXISTS manifests (
    manifest_id  TEXT PRIMARY KEY,
    asset_id     TEXT NOT NULL,
    claim_chain  TEXT NOT NULL,   -- JSON list of assertions
    signed_at    TEXT NOT NULL,
    signed_by    TEXT NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
);
CREATE INDEX IF NOT EXISTS idx_manifests_asset ON manifests(asset_id);

CREATE TABLE IF NOT EXISTS verifications (
    verification_id     TEXT PRIMARY KEY,
    asset_id            TEXT NOT NULL,
    verifier_ip         TEXT,
    verifier_user_agent TEXT,
    verified_at         TEXT NOT NULL,
    result              TEXT NOT NULL,   -- valid | invalid | expired | unknown
    FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
);
CREATE INDEX IF NOT EXISTS idx_verif_asset ON verifications(asset_id);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    """Thin SQLite wrapper for Trace's four entities."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.path = str(db_path or config.db_path())
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False so FastAPI (Day 2) can share the handle.
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA_SQL)
        self._conn.commit()

    # -- lifecycle ----------------------------------------------------------

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # -- creators -----------------------------------------------------------

    def get_or_create_creator(self, email: str, channel_name: str) -> str:
        row = self._conn.execute(
            "SELECT creator_id FROM creators WHERE email = ?", (email,)
        ).fetchone()
        if row:
            return row["creator_id"]
        creator_id = str(uuid.uuid4())
        self._conn.execute(
            "INSERT INTO creators(creator_id, email, channel_name, created_at) "
            "VALUES (?, ?, ?, ?)",
            (creator_id, email, channel_name, _now_iso()),
        )
        self._conn.commit()
        return creator_id

    # -- assets -------------------------------------------------------------

    def insert_asset(
        self,
        *,
        asset_id: str,
        file_path: str,
        file_type: str,
        file_hash: str,
        creator_id: str,
        created_at: str | None = None,
    ) -> None:
        self._conn.execute(
            "INSERT INTO assets(asset_id, file_path, file_type, file_hash, "
            "created_at, creator_id) VALUES (?, ?, ?, ?, ?, ?)",
            (asset_id, file_path, file_type, file_hash, created_at or _now_iso(), creator_id),
        )
        self._conn.commit()

    def get_asset(self, asset_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM assets WHERE asset_id = ?", (asset_id,)
        ).fetchone()
        return dict(row) if row else None

    def recent_assets(self, limit: int = 20) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM assets ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def count_assets(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) AS c FROM assets").fetchone()
        return int(row["c"])

    # -- manifests ----------------------------------------------------------

    def insert_manifest(
        self,
        *,
        manifest_id: str,
        asset_id: str,
        claim_chain: str,
        signed_at: str,
        signed_by: str,
    ) -> None:
        self._conn.execute(
            "INSERT INTO manifests(manifest_id, asset_id, claim_chain, "
            "signed_at, signed_by) VALUES (?, ?, ?, ?, ?)",
            (manifest_id, asset_id, claim_chain, signed_at, signed_by),
        )
        self._conn.commit()

    def get_manifest_for_asset(self, asset_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM manifests WHERE asset_id = ?", (asset_id,)
        ).fetchone()
        return dict(row) if row else None

    # -- verifications ------------------------------------------------------

    def insert_verification(
        self,
        *,
        asset_id: str,
        verifier_ip: str,
        verifier_user_agent: str,
        result: str,
    ) -> str:
        vid = str(uuid.uuid4())
        self._conn.execute(
            "INSERT INTO verifications(verification_id, asset_id, verifier_ip, "
            "verifier_user_agent, verified_at, result) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (vid, asset_id, verifier_ip, verifier_user_agent, _now_iso(), result),
        )
        self._conn.commit()
        return vid

    def count_verifications(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) AS c FROM verifications").fetchone()
        return int(row["c"])
