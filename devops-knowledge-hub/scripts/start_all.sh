#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════"
echo "  DevOps Hub — Starting All Services"
echo "═══════════════════════════════════════════"

# Start backend
echo "▶ Starting backend on :8765..."
(cd backend && python main.py) &
BACKEND_PID=$!

# Wait for backend to be ready
echo "  Waiting for backend..."
for i in {1..20}; do
  if curl -sf http://localhost:8765/api/health > /dev/null 2>&1; then
    echo "  ✓ Backend ready"
    break
  fi
  sleep 1
done

# Start React admin UI
echo "▶ Starting React admin UI on :3000..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Start Docusaurus portal
if [ -d "portal/node_modules" ]; then
  echo "▶ Starting Docusaurus portal on :3002..."
  (cd portal && NODE_NO_WARNINGS=1 npm start -- --port 3002 --no-open) &
  PORTAL_PID=$!
  echo ""
  echo "  Admin UI:  http://localhost:3000"
  echo "  Portal:    http://localhost:3002"
  echo "  Backend:   http://localhost:8765"
else
  echo ""
  echo "  Admin UI:  http://localhost:3000"
  echo "  Backend:   http://localhost:8765"
  echo ""
  echo "  (Docusaurus portal not set up yet — run: cd portal && npm install)"
fi

echo ""
echo "  Press Ctrl+C to stop all services"

trap "kill $BACKEND_PID $FRONTEND_PID ${PORTAL_PID:-} 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait
