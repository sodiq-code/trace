"""Runtime configuration and path resolution for Trace.

All persistent state lives under ``~/.trace/`` (report Sec 26.3):
    ~/.trace/
        config.json        — creator identity + settings
        keys.pem           — manifest signing private key (0600)
        certs.pem          — manifest signing certificate chain (0600)
        trace.db           — SQLite store (assets, manifests, verifications)

Nothing is transmitted off the local machine in the MVP core path.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Final

# --- Application identity ---------------------------------------------------
APP_NAME: Final[str] = "trace"
APP_VERSION: Final[str] = "0.1.0"
ORG_NAME: Final[str] = "Trace"

# Default trust anchor / timestamp authority used by the bundled ES256 signer.
# This is the DigiCert TSA used by the C2PA reference fixtures; it allows the
# resulting manifests to validate as ``Valid`` out of the box (see ARCHITECTURE.md).
DEFAULT_TA_URL: Final[str] = "http://timestamp.digicert.com"

# --- Filesystem layout ------------------------------------------------------
def trace_home() -> Path:
    """Return the Trace home directory (``~/.trace`` by default).

    Honors ``TRACE_HOME`` for test isolation and self-contained demos.
    """
    override = os.environ.get("TRACE_HOME")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".trace"


def config_path() -> Path:
    return trace_home() / "config.json"


def keys_path() -> Path:
    return trace_home() / "keys.pem"


def certs_path() -> Path:
    return trace_home() / "certs.pem"


def db_path() -> Path:
    override = os.environ.get("TRACE_DB")
    if override:
        return Path(override).expanduser()
    return trace_home() / "trace.db"


def stamped_dir() -> Path:
    """Where stamped output assets are written by default."""
    override = os.environ.get("TRACE_STAMPED_DIR")
    if override:
        return Path(override).expanduser()
    return trace_home() / "stamped"


def bundled_credentials_dir() -> Path:
    """The default ES256 signing fixtures shipped with the package."""
    return Path(__file__).resolve().parent / "credentials"


# --- File-type classification (report Sec 23.1) -----------------------------
# Maps file extensions to Trace's logical file_type enum + C2PA MIME type.
EXT_TO_FILETYPE: Final[dict[str, str]] = {
    # images
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".avif": "image",
    ".heic": "image",
    ".heif": "image",
    ".tiff": "image",
    ".tif": "image",
    ".gif": "image",
    ".svg": "image",
    # audio
    ".wav": "audio",
    ".mp3": "audio",
    ".flac": "audio",
    ".m4a": "audio",
    # video
    ".mp4": "video",
    ".mov": "video",
    ".avi": "video",
    ".m4v": "video",
}

EXT_TO_MIME: Final[dict[str, str]] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".m4v": "video/x-m4v",
}

SUPPORTED_IMAGE_EXTS: Final[tuple[str, ...]] = (
    ".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg",
)
SUPPORTED_AUDIO_EXTS: Final[tuple[str, ...]] = (".wav", ".mp3", ".flac")
SUPPORTED_VIDEO_EXTS: Final[tuple[str, ...]] = (".mp4", ".mov")

# Prompt length cap (report Sec 26.2: "reject strings >2KB").
MAX_PROMPT_BYTES: Final[int] = 2048
MAX_CREATOR_BYTES: Final[int] = 512
MAX_MODEL_BYTES: Final[int] = 256

# Latency targets (report Sec 33.1) — informational; enforced by tests where feasible.
STAMP_LATENCY_TARGET_S: Final[float] = 1.0
STAMP_LATENCY_ACCEPTABLE_S: Final[float] = 2.0
VERIFY_LATENCY_TARGET_S: Final[float] = 0.5
