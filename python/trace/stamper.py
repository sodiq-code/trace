"""Trace Stamper — wraps c2pa-python to attach C2PA provenance manifests.

This is the core deliverable . The Stamper:

  1. computes a SHA-256 file hash (data integrity + SQLite lookup key),
  2. classifies the asset by file type (image/audio/video),
  3. builds a C2PA V2 manifest with:
     - ``c2pa.actions`` -> ``c2pa.created`` + digitalSourceType
      (trainedAlgorithmicMedia for AI-generated content)
     - ``std.trace.creator`` -> creator identity
     - ``std.trace.model``  -> generator model (e.g. midjourney-v6)
     - ``std.trace.prompt``  -> the generation prompt
  4. signs the manifest with the provisioned ES256 credential, embedding it
    in the asset file via ``c2pa.Builder.sign_file``,
  5. records the Asset + Manifest in SQLite for fast dashboard lookups,
  6. returns a :class:`StampResult` with the future Provenance Card URL.

The stamp operation is deterministic (no LLM in the path — /24)
and runs in well under one second for typical creator assets.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import c2pa
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec

from . import config, schemas
from .keys import SigningCredentials, load_credentials
from .schemas import Assertion, FileType, StampResult


class StamperError(RuntimeError):
  """Raised when stamping fails (file not supported, signing error, ...)."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
  return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: str | os.PathLike) -> str:
  """Stream a file through SHA-256 and return the hex digest."""
  h = hashlib.sha256()
  with open(path, "rb") as f:
    for chunk in iter(lambda: f.read(1 << 16), b""):
      h.update(chunk)
  return h.hexdigest()


def classify_file(path: str | os.PathLike) -> tuple[FileType, str]:
  """Return ``(file_type, mime_type)`` for a path based on its extension.

  Raises :class:`StamperError` if the extension is unsupported.
  """
  ext = Path(path).suffix.lower()
  ftype = config.EXT_TO_FILETYPE.get(ext)
  mime = config.EXT_TO_MIME.get(ext)
  if ftype is None or mime is None:
    raise StamperError(
      f"unsupported file type: '{ext}'. "
      f"Trace MVP supports PNG, JPEG, WEBP, AVIF (image); "
      f"WAV, MP3, FLAC (audio); MP4, MOV (video). "
      f"PDF and TXT support is on the roadmap."
    )
  return FileType(ftype), mime


def _validate_metadata(model: str, prompt: str, creator: str) -> None:
  """Enforce the security caps from (reject >2KB prompt)."""
  if len(prompt.encode("utf-8")) > config.MAX_PROMPT_BYTES:
    raise StamperError(
      f"prompt exceeds {config.MAX_PROMPT_BYTES} byte cap "
      "( prompt-injection mitigation)"
    )
  if len(creator.encode("utf-8")) > config.MAX_CREATOR_BYTES:
    raise StamperError(f"creator exceeds {config.MAX_CREATOR_BYTES} byte cap")
  if len(model.encode("utf-8")) > config.MAX_MODEL_BYTES:
    raise StamperError(f"model exceeds {config.MAX_MODEL_BYTES} byte cap")


def _sanitize_basename(path: str | os.PathLike) -> str:
  """Defend against path traversal in uploaded filenames ."""
  return os.path.basename(str(path))


# ---------------------------------------------------------------------------
# Manifest construction
# ---------------------------------------------------------------------------

def build_manifest_definition(
  *,
  file_type: FileType,
  mime_type: str,
  model: str,
  prompt: str,
  creator: str,
  title: str | None = None,
) -> dict:
  """Construct the C2PA V2 manifest definition (dict form accepted by
  ``c2pa.Builder``).

  Uses the IPTC ``trainedAlgorithmicMedia`` digitalSourceType for AI
  content, plus three Trace-namespaced custom assertions capturing the
  creator, model, and prompt in a creator-readable, machine-verifiable way.
  """
  source_uri = schemas.DIGITAL_SOURCE_URIS[file_type.value]
  name = title or "Trace Provenance Stamp"

  return {
    "claim_generator_info": [
      {"name": "trace", "version": config.APP_VERSION}
    ],
    "format": mime_type,
    "title": name,
    "ingredients": [],
    "assertions": [
      {
        "label": "c2pa.actions",
        "data": {
          "actions": [
            {
              "action": "c2pa.created",
              "digitalSourceType": source_uri,
              "softwareAgent": model or "unknown-ai-model",
              "when": _now_iso(),
            }
          ]
        },
      },
      {"label": "std.trace.creator", "data": {"creator": creator}},
      {"label": "std.trace.model", "data": {"model": model}},
      {"label": "std.trace.prompt", "data": {"prompt": prompt}},
    ],
  }


def _claim_chain_json(manifest_def: dict) -> str:
  """Serialize the human-facing claim chain (the assertions list)."""
  return json.dumps(
    [{"label": a["label"], "data": a.get("data", {})} for a in manifest_def["assertions"]],
    sort_keys=True,
  )


# ---------------------------------------------------------------------------
# Signer
# ---------------------------------------------------------------------------

def _make_callback_signer(key_pem: bytes):
  """Return a c2pa callback signer closure for the ES256 private key."""
  def sign(data: bytes) -> bytes:
    pk = serialization.load_pem_private_key(key_pem, password=None)
    return pk.sign(data, ec.ECDSA(hashes.SHA256()))
  return sign


# ---------------------------------------------------------------------------
# Stamper
# ---------------------------------------------------------------------------

class Stamper:
  """Attaches C2PA provenance manifests to AI-generated creator assets."""

  def __init__(
    self,
    credentials: SigningCredentials | None = None,
    *,
    creator: str = "unknown@trace.local",
    db=None,
  ) -> None:
    self.credentials = credentials or load_credentials()
    self.creator = creator
    self.db = db # optional Database instance (trace.db.Database)

  # -- public API ---------------------------------------------------------

  def stamp(
    self,
    source_path: str | os.PathLike,
    *,
    model: str = "unknown-ai-model",
    prompt: str = "",
    creator: str | None = None,
    dest_dir: str | os.PathLike | None = None,
  ) -> StampResult:
    """Stamp ``source_path`` with a C2PA provenance manifest.

    Writes the signed asset to ``dest_dir`` (default ``~/.trace/stamped``)
    and returns a :class:`StampResult` with the asset_id, manifest_id,
    signed path, and the future Provenance Card URL.
    """
    _validate_metadata(model, prompt, creator or self.creator)
    creator_str = creator or self.creator

    src = Path(source_path).resolve()
    if not src.is_file():
      raise StamperError(f"source file not found: {src}")

    file_type, mime_type = classify_file(src)
    file_hash = sha256_file(src)
    asset_id = str(uuid.uuid4())
    manifest_id = str(uuid.uuid4())
    signed_at = _now_iso()
    created_at = signed_at

    manifest_def = build_manifest_definition(
      file_type=file_type,
      mime_type=mime_type,
      model=model,
      prompt=prompt,
      creator=creator_str,
    )

    # Output path — sanitize basename to prevent path traversal.
    out_dir = Path(dest_dir) if dest_dir else config.stamped_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _sanitize_basename(src.name)
    stem = Path(safe_name).stem
    dest = out_dir / f"{stem}__trace_{asset_id[:8]}{src.suffix.lower()}"

    # Sign + embed the manifest.
    try:
      with c2pa.Context() as context:
        signer = c2pa.Signer.from_callback(
          _make_callback_signer(self.credentials.key_pem),
          c2pa.C2paSigningAlg.ES256,
          self.credentials.certs_pem.decode("utf-8"),
          self.credentials.ta_url,
        )
        with signer:
          with c2pa.Builder(manifest_def, context) as builder:
            builder.sign_file(str(src), str(dest), signer)
    except c2pa.C2paError as exc: # pragma: no cover - defensive
      raise StamperError(f"c2pa signing failed: {exc}") from exc

    # Verify roundtrip immediately (the green-path guarantee).
    from .verifier import Verifier
    verify = Verifier().verify_file(dest)
    validation_state = verify.validation_state or "Unknown"

    # Persist to SQLite (best-effort by design). The signed asset is already
    # on disk with a valid C2PA manifest embedded; the DB record is a
    # convenience for the dashboard and report. If the DB is locked or
    # unavailable, the stamp still succeeds — the manifest is in the file.
    if self.db is not None:
      try:
        creator_id = self.db.get_or_create_creator(creator_str, creator_str)
        self.db.insert_asset(
          asset_id=asset_id,
          file_path=str(dest),
          file_type=file_type.value,
          file_hash=file_hash,
          creator_id=creator_id,
          created_at=created_at,
        )
        self.db.insert_manifest(
          manifest_id=manifest_id,
          asset_id=asset_id,
          claim_chain=_claim_chain_json(manifest_def),
          signed_at=signed_at,
          signed_by=creator_str,
        )
      except Exception: # pragma: no cover - DB write is best-effort by design
        pass

    assertions = [
      Assertion("Generated using", model or "unknown-ai-model"),
      Assertion("Source type", "AI-generated (trained model)"),
      Assertion("Creator", creator_str),
      Assertion("Prompt", prompt),
    ]

    return StampResult(
      asset_id=asset_id,
      manifest_id=manifest_id,
      source_path=str(src),
      signed_path=str(dest),
      file_type=file_type,
      file_hash=file_hash,
      assertions=assertions,
      card_url=f"/card/{asset_id}",
      validation_state=validation_state,
    )
