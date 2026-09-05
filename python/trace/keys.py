"""Signing-credential management for Trace.

C2PA requires a signing key + certificate chain (the leaf cert must NOT be
self-signed — it must be issued by a CA). Trace ships a known-good ES256
certificate chain as the **default** signing credential so that stamping
produces a ``validation_state: Valid`` manifest out of the box. This is the
same fixture set used by the upstream c2pa-python test suite and the C2PA
reference implementations; it chains to the DigiCert timestamp authority.

``trace init`` provisions ``~/.trace/``:
    - copies the bundled fixtures to ``~/.trace/keys.pem`` + ``certs.pem``
      (mode 0600), and
    - writes ``config.json`` with the creator identity.

Production deployments should replace these with their own CA-issued ES256
credentials (set ``TRACE_SIGN_CERT`` / ``TRACE_SIGN_KEY`` to file paths, or
drop replacements into ``~/.trace/``). See ARCHITECTURE.md > Security.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from . import config


class CredentialError(RuntimeError):
    """Raised when signing credentials cannot be loaded."""


@dataclass(frozen=True)
class SigningCredentials:
    certs_pem: bytes      # certificate chain (PEM)
    key_pem: bytes        # private key (PEM, unencrypted for MVP)
    ta_url: str           # trust anchor / timestamp authority URL
    source: str           # "bundled" | "local" | "env"


def _read(path: Path) -> bytes:
    if not path.is_file():
        raise CredentialError(f"credential file not found: {path}")
    return path.read_bytes()


def _bundled() -> SigningCredentials:
    certs = _read(config.bundled_credentials_dir() / "es256_certs.pem")
    key = _read(config.bundled_credentials_dir() / "es256_private.key")
    return SigningCredentials(certs, key, config.DEFAULT_TA_URL, source="bundled")


def _from_env() -> SigningCredentials | None:
    cert_env = os.environ.get("TRACE_SIGN_CERT")
    key_env = os.environ.get("TRACE_SIGN_KEY")
    if not cert_env or not key_env:
        return None
    ta = os.environ.get("TRACE_TA_URL", config.DEFAULT_TA_URL)
    return SigningCredentials(
        _read(Path(cert_env).expanduser()),
        _read(Path(key_env).expanduser()),
        ta,
        source="env",
    )


def _from_local() -> SigningCredentials | None:
    kp, cp = config.keys_path(), config.certs_path()
    if kp.is_file() and cp.is_file():
        ta = os.environ.get("TRACE_TA_URL", config.DEFAULT_TA_URL)
        return SigningCredentials(_read(cp), _read(kp), ta, source="local")
    return None


def load_credentials() -> SigningCredentials:
    """Resolve signing credentials in priority order:
    1. ``TRACE_SIGN_CERT`` / ``TRACE_SIGN_KEY`` env vars (production override)
    2. ``~/.trace/certs.pem`` + ``~/.trace/keys.pem`` (provisioned by ``trace init``)
    3. bundled default fixtures (works out of the box for the demo)
    """
    return _from_env() or _from_local() or _bundled()


def init_trace_home(email: str, channel_name: str, *, force: bool = False) -> Path:
    """Provision ``~/.trace/`` for first use.

    - Creates the directory (mode 0700).
    - Copies the bundled ES256 fixtures to ``keys.pem`` + ``certs.pem`` (0600).
    - Writes ``config.json`` with the creator identity.

    Returns the path to the provisioned home directory.
    """
    home = config.trace_home()
    home.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(home, 0o700)
    except PermissionError:
        pass  # some filesystems ignore chmod

    # Provision signing credentials.
    bundled = _bundled()
    kp, cp = config.keys_path(), config.certs_path()
    if force or not kp.is_file():
        kp.write_bytes(bundled.key_pem)
        os.chmod(kp, 0o600)
    if force or not cp.is_file():
        cp.write_bytes(bundled.certs_pem)
        os.chmod(cp, 0o600)

    # Provision config.json (creator identity persistence — report Sec 19.2/22.1).
    cfg_path = config.config_path()
    cfg = {
        "creator_email": email,
        "channel_name": channel_name,
        "ta_url": config.DEFAULT_TA_URL,
        "version": config.APP_VERSION,
    }
    cfg_path.write_text(json.dumps(cfg, indent=2) + "\n")
    try:
        os.chmod(cfg_path, 0o600)
    except PermissionError:
        pass

    # Ensure stamped output dir exists.
    config.stamped_dir().mkdir(parents=True, exist_ok=True)
    return home


def load_creator_config() -> dict | None:
    """Load the persisted creator identity (``~/.trace/config.json``)."""
    p = config.config_path()
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text())
    except json.JSONDecodeError:
        return None
