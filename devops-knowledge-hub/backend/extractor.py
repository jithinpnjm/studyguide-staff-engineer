"""
Phase 3 — Concept Card Extractor.
Produces clean staff-engineer-level concept cards from raw documents.
"""

import logging
import re
import uuid
from pathlib import Path

import ai_client
import database

log = logging.getLogger(__name__)

CONCEPT_CARD_DIR = Path.home() / "devops-knowledge-hub" / "concept-cards"

EXTRACTION_PROMPT = """You are extracting staff-engineer-level knowledge from a technical document for a Senior DevOps/SRE engineer's personal study portal.

EXTRACT and KEEP:
- Core architectural concepts and mental models
- Why this technology/approach exists (the problem it solves)
- How it actually works internally (not how to install it)
- Production failure modes and what causes them
- Trade-offs vs alternatives (when to use, when not to)
- Best practices at scale (100+ node clusters, high traffic)
- Interview-relevant concepts at staff/principal level
- Key metrics to watch in production

STRIP COMPLETELY — do not include:
- Installation steps, helm install commands
- YAML/config file examples (unless they illustrate a concept)
- Version numbers and release notes
- Getting started tutorials
- Step-by-step how-to guides
- CLI command references

OUTPUT FORMAT — return clean markdown:

# {title} — Concept Card

## What it is and why it exists

## How it works internally

## Mental model

## Production failure modes

## Trade-offs and when to use it

## At scale — what changes

## Interview prep (staff/principal level)
Key questions with strong answers at staff level...

## Key production metrics

---
Source document: {filename}
Domain: {domain}

Document content:
{text}"""


def _slug(title: str) -> str:
    s = re.sub(r"[^\w\s-]", "", title.lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s[:80] or "doc"


def _extract_text(doc: dict) -> str:
    from categorizer import extract_text
    return extract_text(doc)


async def extract_concepts(doc_id: str) -> dict | None:
    if not ai_client.is_configured():
        log.warning("Gemini not configured — cannot extract concepts")
        return None

    doc = database.get_document(doc_id)
    if not doc:
        log.warning("Document not found: %s", doc_id)
        return None

    existing = database.get_concept_card_for_doc(doc_id)
    if existing:
        log.info("Concept card already exists for %s", doc_id)
        return existing

    text = _extract_text(doc)
    if not text:
        log.warning("No extractable text for %s", doc_id)
        return None

    title = doc.get("title") or doc.get("filename", "document")
    prompt = EXTRACTION_PROMPT.format(
        title=title,
        filename=doc.get("filename", ""),
        domain=doc.get("domain", "general-devops"),
        text=text[:15000],
    )

    try:
        content = await ai_client.generate(prompt, task="extract_concepts")
    except Exception as e:
        log.warning("Concept extraction API error for %s: %s", doc_id, e)
        return None

    CONCEPT_CARD_DIR.mkdir(parents=True, exist_ok=True)
    card_filename = f"{_slug(title)}-concept-card.md"
    card_path = CONCEPT_CARD_DIR / card_filename
    card_path.write_text(content, encoding="utf-8")

    card_id = str(uuid.uuid4())
    card_record = {
        "id": card_id,
        "hash": f"concept-{doc_id}",
        "title": f"{title} — Concept Card",
        "filename": card_filename,
        "file_path": str(card_path),
        "file_type": "md",
        "file_size": len(content.encode()),
        "source_url": doc.get("source_url"),
        "author": doc.get("author"),
        "linkedin_post_url": doc.get("linkedin_post_url"),
        "domain": doc.get("domain", "general-devops"),
        "tags": doc.get("tags", []),
        "summary": f"Concept card extracted from: {title}",
        "read_status": "unread",
        "raw_text": content[:8000],
        "doc_type": "concept_card",
        "parent_id": doc_id,
    }

    database.insert_document(card_record)
    log.info("✓ Concept card created for %s → %s", doc_id[:36], card_filename)
    return database.get_document(card_id)
