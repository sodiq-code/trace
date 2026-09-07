"""Trace Verifier — reads & validates C2PA manifests from stamped assets.

Provides both local and HTTP verification:

- Local: the ``trace verify <file>`` CLI command confirms a manifest is
  present and cryptographically intact.
- HTTP: the FastAPI service exposes ``GET /v1/verify/<asset_id>`` on top
  of this same reader (see ``api/app.py``).

The signature check looks for ``claimSignature.validated`` in the c2pa-python
Reader's validation results — this confirms the claim signature was verified
against the embedded certificate, regardless of whether the certificate
chains to a configured trust anchor.
"""
from __future__ import annotations

import os
from pathlib import Path

import c2pa

from . import config, schemas
from .schemas import VerifyResult


class Verifier:
  """Reads a C2PA manifest from an asset file and reports its validity."""

  def verify_file(self, file_path: str | os.PathLike) -> VerifyResult:
    src = Path(file_path).resolve()
    if not src.is_file():
      return VerifyResult(
        asset_path=str(src),
        has_manifest=False,
        validation_state="NotFound",
        signature_valid=False,
        claim_generator="",
        error=f"file not found: {src}",
      )

    ext = src.suffix.lower()
    mime = config.EXT_TO_MIME.get(ext)
    if mime is None:
      return VerifyResult(
        asset_path=str(src),
        has_manifest=False,
        validation_state="Unsupported",
        signature_valid=False,
        claim_generator="",
        error=f"unsupported file type: '{ext}'",
      )

    try:
      with c2pa.Context() as context:
        with open(src, "rb") as f:
          with c2pa.Reader(mime, f, context=context) as reader:
            state = reader.get_validation_state() or "Unknown"
            results = reader.get_validation_results()
            manifest_json = reader.json() or ""
            embedded = reader.is_embedded()
    except c2pa.C2paError as exc:
      # No manifest present, or the file is not a C2PA container.
      return VerifyResult(
        asset_path=str(src),
        has_manifest=False,
        validation_state="NoManifest",
        signature_valid=False,
        claim_generator="",
        error=str(exc),
      )

    signature_valid = _signature_is_valid(state, results)
    assertions = schemas.assertions_from_manifest_json(manifest_json)
    claim_generator = _extract_generator(manifest_json)

    return VerifyResult(
      asset_path=str(src),
      has_manifest=bool(embedded),
      validation_state=state,
      signature_valid=signature_valid,
      claim_generator=claim_generator,
      assertions=assertions,
      manifest_json=manifest_json,
    )


def _signature_is_valid(state: str, results: dict | None) -> bool:
  """Determine whether the claim signature itself is cryptographically valid.

  c2pa's ``validation_state`` reflects *trust* (does the cert chain anchor to
  a configured trust anchor?). For Trace's purposes, "signature_valid" means
  the claim signature was verified against the embedded certificate (i.e.
  ``claimSignature.validated`` appears in the validation results), regardless
  of trust state. This matches the report's Test 1 expectation: "manifest
  valid" == the signature is intact and the manifest is parseable.
  """
  if not results:
    return state.lower() == "valid"
  blob = _stringify(results)
  return "claimSignature.validated" in blob or state.lower() == "valid"


def _stringify(obj) -> str:
  import json
  try:
    return json.dumps(obj)
  except (TypeError, ValueError):
    return str(obj)


def _extract_generator(manifest_json: str) -> str:
  import json
  if not manifest_json:
    return ""
  try:
    doc = json.loads(manifest_json)
  except json.JSONDecodeError:
    return ""
  manifests = doc.get("manifests") or {}
  active = doc.get("active_manifest")
  manifest = manifests.get(active) if active else next(iter(manifests.values()), {})
  gen = manifest.get("claim_generator_info") or []
  if not gen:
    return ""
  name = gen[0].get("name", "")
  ver = gen[0].get("version", "")
  return f"{name} {ver}".strip()
