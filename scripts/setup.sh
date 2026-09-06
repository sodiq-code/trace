#!/usr/bin/env bash
# Trace — one-command setup .
# Usage: ./scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PYTHON="${PYTHON:-python3}"

echo "==> Creating virtual environment (.venv)"
"$PYTHON" -m venv .venv

echo "==> Installing dependencies (c2pa-python, cryptography, pytest)"
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e ".[dev]"

echo "==> Provisioning ~/.trace/ (signing keys + creator identity)"
.venv/bin/trace init --email demo@trace.local --channel "Trace Demo"

cat <<'EOF'

==> Trace is ready.

Quickstart:
 trace stamp <your-asset.png> --model midjourney-v6 --prompt "..."
 trace verify <signed-asset.png>
 trace list

Docs: README.md, docs/ARCHITECTURE.md
EOF
