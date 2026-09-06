"""Stamper tests — the Validation Test 1 .

'trace stamp test.png --model midjourney-v6 --prompt test' must produce a
manifest that an independent verifier confirms as valid.
"""
from __future__ import annotations

import time
from pathlib import Path

import pytest

from tracekit import config
from tracekit.db import Database
from tracekit.stamper import (
  Stamper,
  StamperError,
  build_manifest_definition,
  classify_file,
  sha256_file,
)
from tracekit.schemas import FileType
from tracekit.verifier import Verifier


# ---------------------------------------------------------------------------
# classify_file / sha256_file / manifest builder
# ---------------------------------------------------------------------------

def test_classify_png(test_png):
  ftype, mime = classify_file(test_png)
  assert ftype is FileType.IMAGE
  assert mime == "image/png"


def test_classify_rejects_unsupported(tmp_path):
  bad = tmp_path / "report.pdf"
  bad.write_bytes(b"%PDF-1.4 not really a pdf")
  with pytest.raises(StamperError, match="unsupported file type"):
    classify_file(bad)


def test_sha256_file_stable(test_png):
  h1 = sha256_file(test_png)
  h2 = sha256_file(test_png)
  assert h1 == h2
  assert len(h1) == 64 # hex digest length


def test_build_manifest_has_required_assertions():
  md = build_manifest_definition(
    file_type=FileType.IMAGE,
    mime_type="image/png",
    model="midjourney-v6",
    prompt="neon cat",
    creator="maya@channel.com",
  )
  labels = [a["label"] for a in md["assertions"]]
  assert "c2pa.actions" in labels
  assert "std.trace.creator" in labels
  assert "std.trace.model" in labels
  assert "std.trace.prompt" in labels
  # digitalSourceType must be the IPTC trainedAlgorithmicMedia URI.
  actions = next(a for a in md["assertions"] if a["label"] == "c2pa.actions")
  assert "trainedAlgorithmicMedia" in actions["data"]["actions"][0]["digitalSourceType"]
  assert actions["data"]["actions"][0]["softwareAgent"] == "midjourney-v6"
  assert md["format"] == "image/png"


def test_prompt_length_cap(test_png):
  """> 2KB."""
  stamper = Stamper(creator="t@e.st")
  with pytest.raises(StamperError, match="exceeds"):
    stamper.stamp(test_png, model="m", prompt="x" * (config.MAX_PROMPT_BYTES + 1))


# ---------------------------------------------------------------------------
# THE VALIDATION TEST 
# ---------------------------------------------------------------------------

def test_stamp_then_verify_roundtrip_valid(trace_home, test_png):
  """Stamp a PNG, then independently verify the signed asset.

  This is Validation Test 1: the manifest c2pa-python verifies as valid.
  """
  db = Database()
  stamper = Stamper(creator="maya@channel.com", db=db)

  result = stamper.stamp(
    test_png,
    model="midjourney-v6",
    prompt="test",
    creator="maya@channel.com",
  )

  # --- Definition of done ---
  assert result.asset_id
  assert result.manifest_id
  assert Path(result.signed_path).is_file()
  assert Path(result.signed_path).read_bytes() != Path(result.source_path).read_bytes()
  assert result.file_hash == sha256_file(test_png)
  assert result.file_type is FileType.IMAGE
  assert result.validation_state.lower() == "valid" # the green path

  # Independent verification via the Verifier (independent verifier).
  verify = Verifier().verify_file(result.signed_path)
  assert verify.has_manifest is True
  assert verify.signature_valid is True
  assert verify.validation_state.lower() == "valid"
  assert verify.claim_generator.startswith("trace")

  # The claim chain must be creator-readable .
  names = {a.name for a in verify.assertions}
  assert "Generated using" in names
  assert "Creator" in names

  # SQLite must have recorded the asset + manifest.
  assert db.count_assets() == 1
  assert db.count_verifications() == 0
  asset = db.get_asset(result.asset_id)
  assert asset is not None
  assert asset["file_hash"] == result.file_hash
  man = db.get_manifest_for_asset(result.asset_id)
  assert man is not None
  assert man["signed_by"] == "maya@channel.com"
  db.close()


def test_stamp_latency_under_target(trace_home, test_png):
  """< 1s, acceptable < 2s."""
  stamper = Stamper(creator="t@e.st")
  t0 = time.perf_counter()
  stamper.stamp(test_png, model="midjourney-v6", prompt="latency test")
  elapsed = time.perf_counter() - t0
  assert elapsed < config.STAMP_LATENCY_ACCEPTABLE_S, (
    f"stamp took {elapsed:.2f}s (acceptable < {config.STAMP_LATENCY_ACCEPTABLE_S}s)"
  )


def test_stamp_writes_to_custom_dest_dir(trace_home, test_png, tmp_path):
  out_dir = tmp_path / "custom_out"
  stamper = Stamper(creator="t@e.st")
  result = stamper.stamp(test_png, model="m", prompt="p", dest_dir=out_dir)
  assert Path(result.signed_path).parent == out_dir.resolve()


def test_stamp_missing_file_raises(trace_home):
  stamper = Stamper(creator="t@e.st")
  with pytest.raises(StamperError, match="source file not found"):
    stamper.stamp("/nonexistent/ghost.png", model="m", prompt="p")


def test_verify_unstamped_file_has_no_manifest(trace_home, test_png):
  """A file that was never stamped must report has_manifest=False."""
  result = Verifier().verify_file(test_png)
  assert result.has_manifest is False
  assert result.signature_valid is False


def test_stamping_same_file_twice_produces_distinct_asset_ids(trace_home, test_png):
  stamper = Stamper(creator="t@e.st")
  r1 = stamper.stamp(test_png, model="m", prompt="first")
  r2 = stamper.stamp(test_png, model="m", prompt="second")
  assert r1.asset_id != r2.asset_id
  assert r1.signed_path != r2.signed_path
