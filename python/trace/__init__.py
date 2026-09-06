"""Trace — The Provenance-First AI Content Engine.

Every AI-generated creator asset, provenance-tagged in one click.
aligned with EU AI Act Article 50 transparency workflows in under one second.

Trace wraps the C2PA (Content Provenance and Authenticity) standard in a
creator-friendly command line. It generates cryptographically-verifiable
provenance manifests for AI-generated assets (images, audio, video, text)
and records them in a local SQLite store for compliance reporting.

Public surface :
  - ``trace init``     — provision ~/.trace/ + creator identity
  - ``trace stamp <file>`` — attach a C2PA provenance manifest
  - ``trace verify <file>`` — verify a stamped asset's manifest
  - ``trace list``     — list recently stamped assets
"""

__version__ = "0.1.0"

__all__ = ["__version__"]
