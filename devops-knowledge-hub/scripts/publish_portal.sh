#!/bin/bash
# publish_portal.sh — regenerate portal content and push to GitHub
# GitHub Actions will auto-deploy to Pages on push.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════"
echo "  DevOps Hub — Publish Portal to GitHub"
echo "═══════════════════════════════════════════"
echo ""

# 1. Regenerate portal docs from study guides
echo "▶ Regenerating portal content..."
python3 backend/generate_portal.py

# 2. Build locally to verify no errors before pushing
echo ""
echo "▶ Building Docusaurus (verification)..."
(cd portal && NODE_NO_WARNINGS=1 npm run build 2>&1 | grep -E "(SUCCESS|ERROR|error)" | head -5)

echo ""
echo "▶ Committing portal docs..."
cd "$(git rev-parse --show-toplevel)"
git add devops-knowledge-hub/portal/docs/
git diff --cached --quiet && echo "  Nothing new to commit." && exit 0

COUNT=$(git diff --cached --numstat | wc -l | tr -d ' ')
git commit -m "portal: refresh study guides (${COUNT} pages updated)"

echo ""
echo "▶ Pushing to GitHub..."
git push

echo ""
echo "✓ Done. GitHub Actions will deploy to Pages in ~2 minutes."
echo "  Check status: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')/actions"
