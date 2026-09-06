"""``python -m tracekit`` entry point (avoids the stdlib ``trace`` conflict)."""
from tracekit.cli import main

if __name__ == "__main__":
  raise SystemExit(main())
