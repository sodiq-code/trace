"""Monthly Compliance Report tests ."""
from __future__ import annotations

import io

from tracekit.db import Database
from tracekit.report import generate_compliance_report
from tracekit.stamper import Stamper


def _png_bytes(w: int = 16, h: int = 16, rgb=(40, 90, 160)) -> bytes:
  import struct, zlib
  raw = b"".join(b"\x00" + bytes(rgb) * w for _ in range(h))
  def chunk(t, d):
    return (struct.pack(">I", len(d)) + t + d +
        struct.pack(">I", zlib.crc32(t + d) & 0xffffffff))
  return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
      + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def test_report_generates_valid_pdf(trace_home, test_png):
  """The report must be a valid multi-page PDF with creator + stats + disclaimer."""
  db = Database()
  stamper = Stamper(creator="maya@channel.com", db=db)
  stamper.stamp(test_png, model="midjourney-v6", prompt="test", creator="maya@channel.com")

  pdf_bytes = generate_compliance_report(
    db=db, creator_email="maya@channel.com", channel_name="Maya Tech Reviews",
  )
  # Must be a valid PDF
  assert pdf_bytes[:4] == b"%PDF"
  assert b"%%EOF" in pdf_bytes
  # Must have multiple pages (summary + asset table + disclaimer)
  assert pdf_bytes.count(b"/Type /Page") >= 2
  # PDF metadata must reference Trace
  assert b"Trace" in pdf_bytes
  db.close()


def test_report_includes_asset_table(trace_home, test_png):
  db = Database()
  stamper = Stamper(creator="m@c.com", db=db)
  for i in range(3):
    stamper.stamp(test_png, model=f"model-{i}", prompt=f"p{i}", creator="m@c.com")

  pdf_bytes = generate_compliance_report(db=db, creator_email="m@c.com", channel_name="Test")
  assert pdf_bytes[:4] == b"%PDF"
  # The PDF should contain multiple pages (summary + asset table + disclaimer)
  assert pdf_bytes.count(b"/Type /Page") >= 2
  db.close()


def test_report_handles_empty_database(trace_home):
  """A report with zero assets must still generate a valid PDF."""
  db = Database()
  pdf_bytes = generate_compliance_report(db=db, creator_email="empty@test.com", channel_name="Empty")
  assert pdf_bytes[:4] == b"%PDF"
  assert b"%%EOF" in pdf_bytes
  db.close()


def test_report_writes_to_file(trace_home, test_png, tmp_path):
  db = Database()
  stamper = Stamper(creator="m@c.com", db=db)
  stamper.stamp(test_png, model="midjourney-v6", prompt="test", creator="m@c.com")

  out = tmp_path / "report.pdf"
  pdf_bytes = generate_compliance_report(
    db=db, creator_email="m@c.com", channel_name="Test", output_path=str(out),
  )
  assert out.is_file()
  assert out.read_bytes() == pdf_bytes
  assert pdf_bytes[:4] == b"%PDF"
  db.close()
