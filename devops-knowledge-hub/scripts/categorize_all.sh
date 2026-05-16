#!/bin/bash
set -euo pipefail

echo "═══════════════════════════════════════════"
echo "  DevOps Hub — Batch Categorization"
echo "═══════════════════════════════════════════"
echo ""

cd "$(dirname "$0")/.."

if ! curl -sf http://localhost:8765/api/health > /dev/null 2>&1; then
  echo "✗ Backend not running. Start it first:"
  echo "  cd backend && python main.py"
  exit 1
fi

echo "▶ Starting batch categorization..."
echo "  Free tier: ~4s/doc. 315 docs ≈ 25 min."
echo ""

python3 - <<'EOF'
import asyncio, httpx, sys, json

async def run():
    async with httpx.AsyncClient(timeout=1800) as c:
        # Start batch
        r = await c.post(
            'http://localhost:8765/api/categorize/batch',
            json={'limit': 1000, 'only_uncategorized': True},
        )
        data = r.json()
        print(f"  Task ID: {data.get('task_id')}")
        print(f"  Status:  {data.get('status')}")

        # Stream progress
        async with c.stream('GET', 'http://localhost:8765/api/categorize/progress') as resp:
            async for line in resp.aiter_lines():
                if line.startswith('data: '):
                    d = json.loads(line[6:])
                    processed = d.get('processed', 0)
                    total = d.get('total', 0)
                    title = d.get('current_title', '')
                    domain = d.get('current_domain', '')
                    if title:
                        bar = '█' * min(int(processed / max(total, 1) * 20), 20)
                        bar = bar.ljust(20)
                        pct = int(processed / max(total, 1) * 100)
                        print(f"\r  [{bar}] {pct:3d}% {processed}/{total}  {title[:40]:<40}", end='', flush=True)
                    if d.get('done'):
                        print()
                        print(f"\n✓ Done: {processed} categorized, {d.get('failed', 0)} failed")
                        break

asyncio.run(run())
EOF
