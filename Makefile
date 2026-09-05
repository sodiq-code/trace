# Trace — Makefile
# One-command quickstart (report Sec 30.5): `make setup && make dev`
# One-command test (report Sec 30.3):       `make test`

PYTHON ?= python3
VENV   ?= .venv
PIP    := $(VENV)/bin/pip
PY     := $(VENV)/bin/python
TRACE  := $(VENV)/bin/trace

.PHONY: help setup venv install dev run test test-cov lint clean init stamp-demo serve serve-start serve-stop serve-status

help:
	@echo "Trace — available targets:"
	@echo "  make setup        — create venv, install deps, install trace in editable mode"
	@echo "  make dev          — provision ~/.trace/ + show quickstart"
	@echo "  make test         — run the pytest suite"
	@echo "  make test-cov     — run tests with coverage on Stamper/Verifier/API"
	@echo "  make stamp-demo   — stamp ./samples/demo.png with a hardcoded manifest"
	@echo "  make serve        — start the FastAPI HTTP API (port 8000) in the foreground"
	@echo "  make serve-start  — start the FastAPI API detached (survives shell exit)"
	@echo "  make serve-stop   — stop the detached FastAPI API"
	@echo "  make serve-status — is the FastAPI API running?"
	@echo "  make clean        — remove build/test artifacts (keeps venv)"

venv:
	$(PYTHON) -m venv $(VENV)

install: venv
	$(PIP) install --upgrade pip
	$(PIP) install -e ".[dev]"

setup: install
	@echo "Trace setup complete. Run 'make dev' to provision ~/.trace/."

dev: install
	$(TRACE) init --email demo@trace.local --channel "Trace Demo"
	@echo "---"
	@echo "Trace is ready. Try:"
	@echo "  trace stamp <your-file.png> --model midjourney-v6 --prompt \"a neon cat\""
	@echo "  trace serve  # start the HTTP API on port 8000"

test: install
	$(VENV)/bin/pytest

test-cov: install
	$(VENV)/bin/pytest --cov=tracekit --cov-report=term-missing --cov-report=html

stamp-demo: install
	$(TRACE) stamp samples/demo.png --model midjourney-v6 --prompt "neon tech review thumbnail"

serve: install
	$(TRACE) serve --host 0.0.0.0 --port 8000

serve-start:
	./scripts/serve.sh start

serve-stop:
	./scripts/serve.sh stop

serve-status:
	./scripts/serve.sh status

clean:
	rm -rf build dist *.egg-info .pytest_cache .coverage htmlcov
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
