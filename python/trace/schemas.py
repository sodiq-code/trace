"""Typed data models for Trace.

These mirror the entity schemas in report Section 23.1:
    Asset, Manifest, Verification, Creator.

The models are plain dataclasses (no ORM) so the storage layer (db.py) and the
C2PA layer (stamper.py) stay decoupled and easy to test.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any


class FileType(str, enum.Enum):
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    TEXT = "text"


class VerificationResult(str, enum.Enum):
    VALID = "valid"
    INVALID = "invalid"
    EXPIRED = "expired"
    UNKNOWN = "unknown"


# IPTC digitalSourceType URIs for AI-generated content (C2PA assertion vocab).
# trainedAlgorithmicMedia = output of a trained model (e.g. Midjourney, DALL-E).
# algorithmicMedia        = output of a non-trained algorithm.
DIGITAL_SOURCE_URIS = {
    "image": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    "audio": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    "video": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    "text": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
}


@dataclass(frozen=True)
class Creator:
    creator_id: str
    email: str
    channel_name: str
    created_at: str


@dataclass(frozen=True)
class Asset:
    asset_id: str
    file_path: str
    file_type: FileType
    file_hash: str           # SHA-256 hex digest
    created_at: str
    creator_id: str


@dataclass(frozen=True)
class ManifestRecord:
    manifest_id: str
    asset_id: str
    # The C2PA manifest bytes are embedded in the asset file itself; the
    # claim_chain JSON is mirrored here for fast dashboard lookups.
    claim_chain: str         # JSON-encoded list of assertions
    signed_at: str
    signed_by: str


@dataclass(frozen=True)
class Verification:
    verification_id: str
    asset_id: str
    verifier_ip: str
    verifier_user_agent: str
    verified_at: str
    result: VerificationResult


@dataclass
class Assertion:
    """A single C2PA assertion, rendered creator-readably on the card."""
    name: str
    value: str


@dataclass
class StampResult:
    """Returned by Stamper.stamp() — the green-path result."""
    asset_id: str
    manifest_id: str
    source_path: str
    signed_path: str
    file_type: FileType
    file_hash: str
    assertions: list[Assertion] = field(default_factory=list)
    card_url: str = ""
    validation_state: str = ""


@dataclass
class VerifyResult:
    """Returned by Verifier.verify_file() — the local verification result."""
    asset_path: str
    has_manifest: bool
    validation_state: str           # c2pa validation_state string
    signature_valid: bool
    claim_generator: str
    assertions: list[Assertion] = field(default_factory=list)
    manifest_json: str = ""
    error: str = ""


def assertions_from_manifest_json(manifest_json: str) -> list[Assertion]:
    """Extract a creator-readable list of assertions from a C2PA manifest
    JSON blob (as produced by ``c2pa.Reader.json()``).

    Renders ``c2pa.actions`` and any ``std.trace.*`` custom assertions in
    plain English (report Sec 29.1 principle 3: creator-readable).
    """
    import json

    out: list[Assertion] = []
    if not manifest_json:
        return out
    try:
        doc = json.loads(manifest_json)
    except json.JSONDecodeError:
        return out

    manifests = doc.get("manifests") or {}
    active = doc.get("active_manifest")
    manifest = manifests.get(active) if active else next(iter(manifests.values()), {})
    if not manifest:
        return out

    gen = manifest.get("claim_generator_info") or []
    if gen:
        name = gen[0].get("name", "unknown")
        ver = gen[0].get("version", "")
        out.append(Assertion("Generator", f"{name} {ver}".strip()))

    for a in manifest.get("assertions") or []:
        label = a.get("label", "")
        data = a.get("data") or {}
        if label.startswith("c2pa.actions"):
            for act in data.get("actions") or []:
                action = act.get("action", "c2pa.created")
                agent = act.get("softwareAgent")
                if agent:
                    out.append(Assertion("Generated using", agent))
                src = act.get("digitalSourceType", "")
                if "trainedAlgorithmic" in src:
                    out.append(Assertion("Source type", "AI-generated (trained model)"))
                elif "algorithmic" in src:
                    out.append(Assertion("Source type", "AI-generated (algorithmic)"))
        elif label == "std.trace.creator":
            out.append(Assertion("Creator", str(data.get("creator", ""))))
        elif label == "std.trace.prompt":
            out.append(Assertion("Prompt", str(data.get("prompt", ""))))
        elif label == "std.trace.model":
            out.append(Assertion("Model", str(data.get("model", ""))))
    return out
