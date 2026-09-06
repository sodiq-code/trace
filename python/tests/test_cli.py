"""CLI tests — exercise the ``trace`` console-script entry points."""
from __future__ import annotations

import json
from pathlib import Path

from tracekit.cli import main


def test_cli_version(capsys):
  with __import__("pytest").raises(SystemExit):
    main(["--version"])
  out = capsys.readouterr().out
  assert "trace" in out


def test_cli_init_provisions_home(trace_home):
  rc = main(["init", "--email", "maya@channel.com", "--channel", "Maya Tech"])
  assert rc == 0
  assert (trace_home / "config.json").is_file()
  assert (trace_home / "keys.pem").is_file()
  assert (trace_home / "certs.pem").is_file()
  cfg = json.loads((trace_home / "config.json").read_text())
  assert cfg["creator_email"] == "maya@channel.com"


def test_cli_stamp_then_verify(trace_home, test_png, capsys):
  main(["init", "--email", "maya@channel.com", "--channel", "Maya"])
  rc = main([
    "stamp", str(test_png),
    "--model", "midjourney-v6",
    "--prompt", "neon tech thumbnail",
    "--creator", "maya@channel.com",
  ])
  assert rc == 0
  out = capsys.readouterr().out
  # The machine-parseable JSON line is the last line.
  last_json = [ln for ln in out.splitlines() if ln.startswith("{")][-1]
  payload = json.loads(last_json)
  assert payload["validation_state"].lower() == "valid"
  assert Path(payload["signed_path"]).is_file()

  # Verify the signed asset via the CLI.
  rc = main(["verify", payload["signed_path"]])
  assert rc == 0
  out2 = capsys.readouterr().out
  assert "VALID" in out2


def test_cli_stamp_missing_file(trace_home, capsys):
  main(["init", "--email", "x@y.z", "--channel", "X"])
  rc = main(["stamp", "/no/such/file.png", "--model", "m", "--prompt", "p"])
  assert rc == 2
  err = capsys.readouterr().err
  assert "not found" in err


def test_cli_list_empty(trace_home, capsys):
  rc = main(["list"])
  assert rc == 0
  out = capsys.readouterr().out
  assert "No assets stamped" in out


def test_cli_list_after_stamp(trace_home, test_png, capsys):
  main(["init", "--email", "m@c.com", "--channel", "M"])
  main(["stamp", str(test_png), "--model", "midjourney-v6", "--prompt", "x"])
  capsys.readouterr() # flush
  rc = main(["list"])
  assert rc == 0
  out = capsys.readouterr().out
  assert "asset(s) stamped" in out
  assert "image" in out


def test_cli_verify_unstamped_file(trace_home, test_png, capsys):
  rc = main(["verify", str(test_png)])
  assert rc == 1
  err = capsys.readouterr().err
  assert "no C2PA manifest" in err
