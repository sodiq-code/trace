"""Trace command-line interface.

Surface (report Sec 25.2):
    trace init   [--email X --channel Y]         provision ~/.trace/
    trace stamp  <file> [--model --prompt --creator --out]
    trace verify <file>                          verify a stamped asset
    trace list   [--limit N]                     list recently stamped assets
    trace --version

Day 1 delivers ``init`` / ``stamp`` / ``verify`` / ``list``.
``stamp-dir`` (batch) is a Day 2 Should-Work item.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__, config, keys
from .db import Database
from .stamper import Stamper, StamperError, classify_file
from .verifier import Verifier


# ---------------------------------------------------------------------------
# Output helpers (plain stdout, machine-parseable where useful)
# ---------------------------------------------------------------------------

def _ok(msg: str) -> None:
    print(msg)


def _err(msg: str) -> None:
    print(f"trace: error: {msg}", file=sys.stderr)


def _box(title: str, lines: list[str]) -> None:
    width = max(len(title), *(len(l) for l in lines)) if lines else len(title)
    width = min(width + 4, 88)
    print("┌" + "─" * (width - 2) + "┐")
    print("│ " + title.ljust(width - 4) + " │")
    print("├" + "─" * (width - 2) + "┤")
    for l in lines:
        print("│ " + l.ljust(width - 4) + " │")
    print("└" + "─" * (width - 2) + "┘")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> int:
    home = keys.init_trace_home(args.email, args.channel, force=args.force)
    _box(
        "Trace initialized",
        [
            f"home:     {home}",
            f"keys:     {config.keys_path()}  (0600)",
            f"certs:    {config.certs_path()}  (0600)",
            f"database: {config.db_path()}",
            f"creator:  {args.email}  ({args.channel})",
            "",
            "Next: trace stamp <your-asset.png> --model midjourney-v6 --prompt \"...\"",
        ],
    )
    return 0


def cmd_stamp(args: argparse.Namespace) -> int:
    # Resolve creator identity: flag > config > default.
    creator = args.creator
    if not creator:
        cfg = keys.load_creator_config()
        creator = (cfg or {}).get("creator_email", "unknown@trace.local")

    src = Path(args.file).expanduser()
    if not src.is_file():
        _err(f"file not found: {src}")
        return 2

    db = Database()
    try:
        stamper = Stamper(creator=creator, db=db)
        result = stamper.stamp(
            src,
            model=args.model,
            prompt=args.prompt,
            creator=creator,
            dest_dir=args.out,
        )
    except StamperError as exc:
        _err(str(exc))
        return 1
    finally:
        db.close()

    _box(
        f"Provenance manifest attached  [{result.validation_state}]",
        [
            f"asset_id:   {result.asset_id}",
            f"manifest:   {result.manifest_id}",
            f"file_type:  {result.file_type.value}",
            f"sha256:     {result.file_hash[:24]}…",
            f"source:     {result.source_path}",
            f"signed:     {result.signed_path}",
            f"card_url:   {result.card_url}",
            "",
            "Assertions (creator-readable):",
            *(f"  • {a.name}: {a.value}" for a in result.assertions),
        ],
    )
    # Machine-parseable line for pipelines (report Sec 18.3).
    print(json.dumps({
        "asset_id": result.asset_id,
        "manifest_id": result.manifest_id,
        "signed_path": result.signed_path,
        "card_url": result.card_url,
        "validation_state": result.validation_state,
    }))
    return 0


def cmd_verify(args: argparse.Namespace) -> int:
    src = Path(args.file).expanduser()
    if not src.is_file():
        _err(f"file not found: {src}")
        return 2

    result = Verifier().verify_file(src)
    if not result.has_manifest:
        _err(f"no C2PA manifest found in {src}" +
             (f" ({result.error})" if result.error else ""))
        return 1

    status = "VALID" if result.signature_valid else "INVALID"
    _box(
        f"C2PA manifest verified  —  signature {status}",
        [
            f"file:              {result.asset_path}",
            f"validation_state:  {result.validation_state}",
            f"signature_valid:   {result.signature_valid}",
            f"generator:         {result.claim_generator or '-'}",
            "",
            "Claim chain:",
            *(f"  • {a.name}: {a.value}" for a in result.assertions),
        ],
    )
    if args.json:
        print(result.manifest_json)
    return 0 if result.signature_valid else 1


def cmd_list(args: argparse.Namespace) -> int:
    db = Database()
    try:
        rows = db.recent_assets(limit=args.limit)
        total = db.count_assets()
        verifs = db.count_verifications()
    finally:
        db.close()

    if not rows:
        _ok("No assets stamped yet. Run: trace stamp <file> --model ... --prompt ...")
        return 0

    _box(
        f"Compliance dashboard  —  {total} asset(s) stamped, {verifs} verification(s)",
        [
            f"{r['created_at']}  {r['file_type']:<5}  {r['file_hash'][:12]}…  {Path(r['file_path']).name}"
            for r in rows
        ],
    )
    return 0


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="trace",
        description=(
            "Trace — The Provenance-First AI Content Engine. "
            "Stamp AI-generated assets with C2PA provenance manifests."
        ),
    )
    p.add_argument("--version", action="version", version=f"trace {__version__}")
    sub = p.add_subparsers(dest="command", required=True, metavar="<command>")

    # init
    p_init = sub.add_parser("init", help="provision ~/.trace/ + creator identity")
    p_init.add_argument("--email", default="demo@trace.local", help="creator email")
    p_init.add_argument("--channel", default="Trace Demo", help="creator channel name")
    p_init.add_argument("--force", action="store_true", help="overwrite existing credentials")
    p_init.set_defaults(func=cmd_init)

    # stamp
    p_stamp = sub.add_parser("stamp", help="attach a C2PA provenance manifest to <file>")
    p_stamp.add_argument("file", help="path to the asset (PNG, JPEG, WEBP, WAV, MP3, MP4, ...)")
    p_stamp.add_argument("--model", default="unknown-ai-model", help="generator model (e.g. midjourney-v6)")
    p_stamp.add_argument("--prompt", default="", help="generation prompt (max 2KB)")
    p_stamp.add_argument("--creator", default=None, help="creator identity (default: ~/.trace/config.json)")
    p_stamp.add_argument("--out", default=None, help="output directory for the signed asset")
    p_stamp.set_defaults(func=cmd_stamp)

    # verify
    p_verify = sub.add_parser("verify", help="verify a stamped asset's manifest integrity")
    p_verify.add_argument("file", help="path to the (possibly stamped) asset")
    p_verify.add_argument("--json", action="store_true", help="emit the raw C2PA manifest JSON")
    p_verify.set_defaults(func=cmd_verify)

    # list
    p_list = sub.add_parser("list", help="list recently stamped assets")
    p_list.add_argument("--limit", type=int, default=20, help="max rows (default 20)")
    p_list.set_defaults(func=cmd_list)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        _err("interrupted")
        return 130
    except Exception as exc:  # pragma: no cover - last-resort guard
        _err(f"unexpected: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
