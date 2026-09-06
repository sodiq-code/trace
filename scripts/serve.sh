#!/usr/bin/env bash
# Start / stop / status for the Trace FastAPI service (port 8000).
# Usage:
#  ./scripts/serve.sh start  — launch uvicorn detached (survives shell exit)
#  ./scripts/serve.sh stop  — stop the running service
#  ./scripts/serve.sh status — is it running?
#  ./scripts/serve.sh restart — stop + start
set -euo pipefail

PORT="${TRACE_PORT:-8000}"
HOST="${TRACE_HOST:-127.0.0.1}"
PIDFILE="/tmp/trace-serve.pid"
LOGFILE="/tmp/trace-serve.log"
cd "$(dirname "$0")/.."

is_running() {
 [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

case "${1:-status}" in
 start)
  if is_running; then
   echo "Trace API already running (PID $(cat "$PIDFILE")) on port $PORT"
   exit 0
  fi
  mkdir -p "$(dirname "$LOGFILE")"
  setsid .venv/bin/uvicorn tracekit.api.app:app \
   --host "$HOST" --port "$PORT" --log-level info \
   > "$LOGFILE" 2>&1 < /dev/null &
  echo $! > "$PIDFILE"
  sleep 2
  if is_running; then
   echo "Trace API started (PID $(cat "$PIDFILE")) on http://$HOST:$PORT"
   echo " docs: http://$HOST:$PORT/docs"
   echo " log:  $LOGFILE"
  else
   echo "FAILED to start — see $LOGFILE:" >&2
   tail -20 "$LOGFILE" >&2 || true
   exit 1
  fi
  ;;
 stop)
  if is_running; then
   PID="$(cat "$PIDFILE")"
   kill "$PID" 2>/dev/null || true
   sleep 1
   kill -9 "$PID" 2>/dev/null || true
   rm -f "$PIDFILE"
   echo "Trace API stopped (PID $PID)"
  else
   echo "Trace API not running"
   rm -f "$PIDFILE"
  fi
  ;;
 restart)
  "$0" stop || true
  "$0" start
  ;;
 status)
  if is_running; then
   echo "running (PID $(cat "$PIDFILE")) on port $PORT"
   exit 0
  else
   echo "not running"
   exit 1
  fi
  ;;
 *)
  echo "usage: $0 {start|stop|restart|status}" >&2
  exit 2
  ;;
esac
