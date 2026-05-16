#!/usr/bin/env python3
"""
Generate Docusaurus portal — one comprehensive "zero to hero" page per domain.
Each page IS the full AI-written study guide. Source docs listed as references only.
Run after study guide generation: python backend/generate_portal.py
"""

import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import database

PORTAL_DOCS = Path(__file__).parent.parent / "portal" / "docs"

DOMAIN_CONFIG = {
    "kubernetes-containers":   {"label": "Kubernetes & Containers",  "position": 1,  "emoji": "☸️",  "slug": "kubernetes-containers"},
    "cicd-gitops":             {"label": "CI/CD & GitOps",           "position": 2,  "emoji": "🔄",  "slug": "cicd-gitops"},
    "observability":           {"label": "Observability",             "position": 3,  "emoji": "📊",  "slug": "observability"},
    "cloud-platforms":         {"label": "Cloud Platforms",           "position": 4,  "emoji": "☁️",  "slug": "cloud-platforms"},
    "infrastructure-as-code":  {"label": "Infrastructure as Code",    "position": 5,  "emoji": "🏗️",  "slug": "infrastructure-as-code"},
    "security-devsecops":      {"label": "Security & DevSecOps",      "position": 6,  "emoji": "🔐",  "slug": "security-devsecops"},
    "networking-service-mesh": {"label": "Networking & Service Mesh", "position": 7,  "emoji": "🌐",  "slug": "networking-service-mesh"},
    "sre-practices":           {"label": "SRE Practices",             "position": 8,  "emoji": "🎯",  "slug": "sre-practices"},
    "linux-systems":           {"label": "Linux & Systems",           "position": 9,  "emoji": "🐧",  "slug": "linux-systems"},
    "databases-storage":       {"label": "Databases & Storage",       "position": 10, "emoji": "🗄️",  "slug": "databases-storage"},
    "platform-engineering":    {"label": "Platform Engineering",      "position": 11, "emoji": "🛠️",  "slug": "platform-engineering"},
    "ai-mlops":                {"label": "AI & MLOps",                "position": 12, "emoji": "🤖",  "slug": "ai-mlops"},
    "agentic-genai":           {"label": "Agentic & GenAI",           "position": 13, "emoji": "🧠",  "slug": "agentic-genai"},
    "llmops":                  {"label": "LLMOps",                    "position": 14, "emoji": "⚙️",  "slug": "llmops"},
    "scripting-python":        {"label": "Python for DevOps",         "position": 15, "emoji": "🐍",  "slug": "scripting-python"},
    "scripting-bash-shell":    {"label": "Bash & Shell Scripting",    "position": 16, "emoji": "💻",  "slug": "scripting-bash-shell"},
    "scripting-go":            {"label": "Go for DevOps",             "position": 17, "emoji": "🐹",  "slug": "scripting-go"},
    "automation-tooling":      {"label": "Automation & Tooling",      "position": 18, "emoji": "⚡",  "slug": "automation-tooling"},
    "general-devops":          {"label": "General DevOps",            "position": 19, "emoji": "🚀",  "slug": "general-devops"},
}

PLACEHOLDER = """\
:::caution Study guide not yet generated

This domain has **{doc_count}** source documents ingested but the AI study guide hasn't been generated yet.

**To generate:**
1. Open the [Admin UI](http://localhost:3000) → **Study Guides** tab
2. Click **Generate** next to **{label}**
3. Come back and run `python3 backend/generate_portal.py` to refresh this page

The guide will cover everything from fundamentals to staff/principal engineer depth —
concepts, tools, architecture patterns, failure modes, and interview prep.

:::

"""

SOURCE_DOCS_HEADER = """
---

## 📁 Source Documents

> {doc_count} documents ingested in this domain. These are the references the study guide was synthesised from.

| Title | Type | Level |
|-------|------|-------|
"""


def _safe_title(doc: dict) -> str:
    title = doc.get("title") or doc.get("filename") or "Untitled"
    return title.replace("|", "\\|").replace("\n", " ")


def _source_docs_table(docs: list[dict]) -> str:
    if not docs:
        return ""
    rows = []
    for doc in docs:
        title = _safe_title(doc)
        file_type = (doc.get("file_type") or "doc").upper()
        level = doc.get("concept_level") or "intermediate"
        view_url = f"http://localhost:8765/api/documents/{doc['id']}/view"
        rows.append(f"| [{title}]({view_url}) | {file_type} | {level} |")
    return SOURCE_DOCS_HEADER.format(doc_count=len(docs)) + "\n".join(rows) + "\n"


def _domain_page(domain: str, cfg: dict, docs: list[dict], guide: dict | None) -> str:
    label = cfg["label"]
    emoji = cfg["emoji"]
    doc_count = len(docs)

    if guide and guide.get("content"):
        # Trim any leading h1 from the study guide since frontmatter title handles it
        content = guide["content"]
        content = re.sub(r"^#\s+.+\n", "", content, count=1).lstrip("\n")
        body = content
    else:
        body = PLACEHOLDER.format(doc_count=doc_count, label=label)

    source_table = _source_docs_table(docs)

    return f"""---
title: "{emoji} {label}"
sidebar_position: {cfg['position']}
description: "Zero to hero study guide for {label} — concepts, tools, architecture, production operations, and interview prep."
---

import AIChatWidget from '@site/src/components/AIChatWidget';

{body}

{source_table}

<AIChatWidget domain="{domain}" title="Ask AI about {label}" />
"""


def generate():
    database.init_db()
    PORTAL_DOCS.mkdir(parents=True, exist_ok=True)

    # Remove old subdirectories (individual doc pages from previous design)
    for item in PORTAL_DOCS.iterdir():
        if item.is_dir():
            shutil.rmtree(item)
            print(f"  Removed old directory: {item.name}/")

    stats = database.get_stats()
    all_docs = database.list_documents(limit=10000, doc_type="raw")
    by_domain: dict[str, list] = {}
    for doc in all_docs:
        d = doc.get("domain") or "uncategorized"
        by_domain.setdefault(d, []).append(doc)

    generated = 0
    placeholder_count = 0

    for domain, cfg in DOMAIN_CONFIG.items():
        docs = by_domain.get(domain, [])
        if not docs:
            continue

        guide = database.get_study_guide(domain)
        page = _domain_page(domain, cfg, docs, guide)
        out = PORTAL_DOCS / f"{domain}.md"
        out.write_text(page, encoding="utf-8")

        if guide:
            generated += 1
            print(f"  ✓ {cfg['emoji']} {cfg['label']} ({len(docs)} docs, {len(guide['content'])} chars)")
        else:
            placeholder_count += 1
            print(f"  ⏳ {cfg['emoji']} {cfg['label']} ({len(docs)} docs) — study guide pending")

    # intro.md — portal overview
    domain_rows = []
    for domain, cfg in DOMAIN_CONFIG.items():
        docs = by_domain.get(domain, [])
        if not docs:
            continue
        guide = database.get_study_guide(domain)
        status = "✅" if guide else "⏳"
        domain_rows.append(
            f"| {cfg['emoji']} [{cfg['label']}]({domain}) | {len(docs)} | {status} |"
        )

    intro = f"""---
title: DevOps Knowledge Hub
sidebar_position: 0
description: Staff & Principal SRE — Zero to Hero Study Portal
---

import AIChatWidget from '@site/src/components/AIChatWidget';

# DevOps Knowledge Hub

> **{stats['total_documents']} source documents** · **{generated} study guides generated** · Staff/Principal SRE level

_Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}_

This portal is your comprehensive study companion. Each domain page is a **fully written, AI-synthesised
"Zero to Hero" guide** covering concepts, tools, architecture patterns, failure modes, and interview prep —
synthesised from your personal document library.

## 📚 Domains

| Domain | Docs | Guide |
|--------|------|-------|
{chr(10).join(domain_rows)}

**Legend:** ✅ Study guide ready · ⏳ Generate from Admin UI → Study Guides tab

## 🚀 Quick Start

1. Pick a domain below and read the full study guide
2. Use the **🤖 AI chat button** on any page to ask questions
3. Add more documents via [Admin UI](http://localhost:3000) → Add Content
4. Regenerate guides as your library grows: Admin UI → Study Guides → Generate All

---

<AIChatWidget title="Ask AI anything about DevOps" />
"""
    (PORTAL_DOCS / "intro.md").write_text(intro, encoding="utf-8")

    total_domains = generated + placeholder_count
    print(f"\n✓ Portal generated: {total_domains} domain pages ({generated} with guides, {placeholder_count} placeholders)")
    print(f"  Output: {PORTAL_DOCS}")
    if placeholder_count > 0:
        print(f"\n  → Generate study guides: Admin UI → Study Guides → Generate All")
        print(f"  → Then re-run: python3 backend/generate_portal.py")


if __name__ == "__main__":
    generate()
