#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Generating Docusaurus portal content..."
python3 backend/generate_portal.py

echo ""
echo "✓ Done. To view the portal:"
echo "  cd portal && npm start -- --port 3002"
echo ""
echo "  Or if already running, just refresh http://localhost:3002"
