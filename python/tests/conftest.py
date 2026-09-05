"""Shared pytest fixtures for Trace.

Isolation strategy: every test gets a fresh ``TRACE_HOME`` under tmp_path so
no test ever touches the developer's real ``~/.trace/``.
"""
from __future__ import annotations

import os
import struct
import zlib
from pathlib import Path

import pytest


def _make_png(path: Path, w: int = 32, h: int = 32, rgb: tuple = (40, 90, 160)) -> Path:
    """Create a minimal valid PNG (stdlib only — no PIL dependency)."""
    raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))

    def chunk(typ: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(raw)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    path.write_bytes(png)
    return path


@pytest.fixture
def trace_home(tmp_path, monkeypatch):
    """A fresh, isolated TRACE_HOME for each test."""
    home = tmp_path / "tracehome"
    home.mkdir()
    monkeypatch.setenv("TRACE_HOME", str(home))
    monkeypatch.setenv("TRACE_DB", str(home / "trace.db"))
    monkeypatch.setenv("TRACE_STAMPED_DIR", str(home / "stamped"))
    return home


@pytest.fixture
def test_png(tmp_path) -> Path:
    """A small valid PNG to stamp."""
    p = tmp_path / "asset.png"
    return _make_png(p)


@pytest.fixture
def make_png(tmp_path):
    """Factory for additional PNGs in a test."""
    def _make(name: str = "extra.png", w: int = 16, h: int = 16) -> Path:
        return _make_png(tmp_path / name, w=w, h=h)
    return _make
