#!/usr/bin/env bash
# Trace — demo runner . Stamps a bundled sample asset and
# verifies it end-to-end. Safe to run before a live demo to confirm the
# green path still works.
set -euo pipefail

cd "$(dirname "$0")/.."
.venv/bin/python - <<'PY'
import sys
from tracekit.cli import main
sys.exit(main(["stamp", "samples/demo.png", "--model", "midjourney-v6",
        "--prompt", "neon tech review thumbnail"]))
PY

echo
echo "==> Verifying the stamped asset..."
SIGNED="$(ls -t ~/.trace/stamped/demo__trace_*.png 2>/dev/null | head -1)"
if [ -z "$SIGNED" ]; then
 echo "No stamped asset found — did the stamp succeed?" >&2
 exit 1
fi
.venv/bin/trace verify "$SIGNED"
