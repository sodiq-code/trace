FROM python:3.12-slim

# c2pa-python ships a manylinux wheel with a native lib; ensure system deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

# Install the trace package (tracekit)
COPY python/ ./python/
COPY README.md ./
RUN pip install -e .

# Copy samples + credentials
COPY samples/ ./samples/
COPY python/trace/credentials/ ./python/trace/credentials/

# Railway sets PORT; default to 8000
ENV PORT=8000
EXPOSE 8000

# Provision credentials on startup if not present, then run uvicorn
CMD ["sh", "-c", "trace init --email maya@channel.com --channel 'Maya Tech Reviews' --force && trace serve --host 0.0.0.0 --port ${PORT:-8000}"]
