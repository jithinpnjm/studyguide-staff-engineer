"""
Phase 6 — Unified Ingestion Pipeline.
Every new piece of content goes through this single entry point.
"""

import asyncio
import hashlib
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

import ai_client
import database
from categorizer import categorize_document, extract_text, get_fingerprint

log = logging.getLogger(__name__)

STORAGE_ROOT = Path(os.getenv("HUB_BASE_DIR", str(Path.home() / "devops-knowledge-hub"))) / "documents"

DEDUP_PROMPT = """Compare these two technical documents and return JSON:
{{
  "similarity_score": <0.0-1.0>,
  "relation_type": "duplicate|overlapping|extends|unique",
  "overlap_summary": "<what both cover>",
  "unique_in_new": "<what the new doc adds>",
  "recommendation": "skip|add_as_related|add_new_section|add_independently",
  "recommendation_reason": "<one sentence>"
}}

Existing doc: {existing_title}
Summary: {existing_summary}
Topics: {existing_topics}

New doc: {new_title}
Summary: {new_summary}
Topics: {new_topics}"""


# ── Source acquisition ───────────────────────────────────────────────────────

async def acquire(source_type: str, source_data: str) -> tuple[bytes, str, str]:
    """
    Returns (content_bytes, filename, detected_mime).
    """
    if source_type == "local_file":
        p = Path(source_data).expanduser()
        if not p.exists():
            raise FileNotFoundError(f"File not found: {source_data}")
        return p.read_bytes(), p.name, _guess_mime(p.suffix)

    if source_type in ("url", "web_discovery"):
        return await _fetch_url(source_data)

    raise ValueError(f"Unknown source_type: {source_type}")


async def _fetch_url(url: str) -> tuple[bytes, str, str]:
    try:
        import httpx
    except ImportError:
        raise RuntimeError("httpx not installed — pip install httpx")

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 DevOps-Hub/2.0"})
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "").lower()
    raw = resp.content

    if "text/html" in content_type:
        text = _extract_webpage(raw.decode("utf-8", errors="replace"), url)
        raw = text.encode("utf-8")
        filename = _url_to_filename(url) + ".md"
        return raw, filename, "text/markdown"

    filename = url.rstrip("/").split("/")[-1] or "document"
    if "." not in filename:
        ext = {
            "application/pdf": ".pdf",
            "application/vnd.ms-powerpoint": ".ppt",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        }.get(content_type.split(";")[0].strip(), ".bin")
        filename += ext

    return raw, filename, content_type.split(";")[0].strip()


def _extract_webpage(html: str, url: str) -> str:
    # Try trafilatura first (best quality)
    try:
        import trafilatura
        text = trafilatura.extract(html, include_comments=False, include_tables=True)
        if text and len(text) > 200:
            return f"# Source: {url}\n\n{text}"
    except ImportError:
        pass

    # Fallback: readability-lxml
    try:
        from readability import Document as ReadabilityDoc
        doc = ReadabilityDoc(html)
        import re
        text = re.sub(r"<[^>]+>", " ", doc.summary())
        text = re.sub(r"\s+", " ", text).strip()
        if text and len(text) > 200:
            return f"# {doc.title()}\nSource: {url}\n\n{text}"
    except ImportError:
        pass

    # Last resort: strip tags
    import re
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()[:8000]
    return f"# Source: {url}\n\n{text}"


def _url_to_filename(url: str) -> str:
    import re
    name = url.rstrip("/").split("/")[-1].split("?")[0] or "webpage"
    name = re.sub(r"[^\w-]", "-", name)
    return name[:60]


def _guess_mime(suffix: str) -> str:
    return {
        ".pdf": "application/pdf",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt": "application/vnd.ms-powerpoint",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".md": "text/markdown",
        ".txt": "text/plain",
    }.get(suffix.lower(), "application/octet-stream")


# ── Deduplication ────────────────────────────────────────────────────────────

async def check_duplicates(fingerprint: dict, new_doc: dict) -> dict:
    """
    Returns dedup decision dict:
    { status, similar_docs, action, primary_match }
    """
    probable_domain = fingerprint.get("probable_domain", "")
    new_topics = set(fingerprint.get("core_topics", []) + fingerprint.get("key_technologies", []))

    # Stage A: fast SQLite filter by domain + topic overlap
    candidates = database.get_docs_by_domain(probable_domain, doc_type="raw")
    if not candidates:
        return {"status": "unique", "similar_docs": [], "action": "add_new", "primary_match": None}

    stage_b_candidates = []
    for cand in candidates:
        existing_topics = set(cand.get("key_topics") or []) | set(cand.get("tags") or [])
        if not existing_topics:
            continue
        shared = len(new_topics & existing_topics)
        ratio = shared / max(len(new_topics), len(existing_topics), 1)
        if ratio > 0.35:
            stage_b_candidates.append((ratio, cand))

    if not stage_b_candidates:
        return {"status": "unique", "similar_docs": [], "action": "add_new", "primary_match": None}

    if not ai_client.is_configured():
        # Without AI, use topic overlap ratio as proxy
        stage_b_candidates.sort(key=lambda x: -x[0])
        best_ratio, best_cand = stage_b_candidates[0]
        if best_ratio > 0.8:
            return {"status": "duplicate", "similar_docs": [best_cand], "action": "skip", "primary_match": best_cand}
        return {"status": "overlapping", "similar_docs": [best_cand], "action": "add_as_related", "primary_match": best_cand}

    # Stage B: AI similarity check on top candidates
    similar_docs = []
    action = "add_new"
    primary_match = None
    best_score = 0.0

    new_summary = new_doc.get("summary") or fingerprint.get("summary_one_line", "")
    new_title = new_doc.get("title") or new_doc.get("filename", "")
    new_topics_list = list(new_topics)

    for _, cand in sorted(stage_b_candidates, key=lambda x: -x[0])[:5]:
        prompt = DEDUP_PROMPT.format(
            existing_title=cand.get("title") or cand.get("filename"),
            existing_summary=cand.get("summary") or "",
            existing_topics=", ".join(cand.get("key_topics") or []),
            new_title=new_title,
            new_summary=new_summary,
            new_topics=", ".join(new_topics_list),
        )
        try:
            raw = await ai_client.generate(prompt, task="categorize", json_output=True)
            result = json.loads(raw.strip())
        except Exception as e:
            log.debug("Dedup AI call failed: %s", e)
            continue

        score = result.get("similarity_score", 0.0)
        rel = result.get("relation_type", "unique")
        rec = result.get("recommendation", "add_independently")

        similar_docs.append({
            "id": cand["id"],
            "title": cand.get("title"),
            "similarity_score": score,
            "relation_type": rel,
            "unique_in_new": result.get("unique_in_new", ""),
            "recommendation": rec,
        })

        if score > best_score:
            best_score = score
            primary_match = cand

    if not similar_docs:
        return {"status": "unique", "similar_docs": [], "action": "add_new", "primary_match": None}

    if best_score > 0.85:
        status, action = "duplicate", "skip"
    elif best_score > 0.55:
        status, action = "overlapping", "add_as_related"
    elif best_score > 0.35:
        status, action = "extends", "add_new_section"
    else:
        status, action = "unique", "add_new"

    return {
        "status": status,
        "similar_docs": similar_docs,
        "action": action,
        "primary_match": primary_match,
    }


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def ingest(
    source_type: str,
    source_data: str,
    options: dict = None,
    ingest_source_tag: str = "manual",
) -> dict:
    """
    Unified ingestion pipeline. Returns IngestResult-compatible dict.
    """
    options = options or {}
    force_add = options.get("force_add", False)
    skip_concept_card = options.get("skip_concept_card", False)

    # STEP 1 — ACQUIRE
    try:
        content_bytes, filename, mime = await acquire(source_type, source_data)
    except Exception as e:
        log.error("Acquire failed (%s %s): %s", source_type, source_data, e)
        return {"status": "error", "message": str(e)}

    file_hash = hashlib.sha256(content_bytes).hexdigest()

    # Hash dedup (exact duplicate)
    existing = database.find_by_hash(file_hash)
    if existing and not force_add:
        return {
            "status": "duplicate",
            "doc_id": existing["id"],
            "title": existing.get("title"),
            "domain": existing.get("domain"),
            "action_taken": "skip",
            "message": f"Exact duplicate of '{existing.get('title') or existing['filename']}'",
        }

    # Save file
    suffix = Path(filename).suffix.lower() or _mime_to_ext(mime)
    stored_name = f"{file_hash}{suffix}"
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    dest = STORAGE_ROOT / stored_name
    dest.write_bytes(content_bytes)

    file_type = suffix.lstrip(".")
    doc_id = str(uuid.uuid4())

    # Build preliminary doc record
    new_doc = {
        "id": doc_id,
        "hash": file_hash,
        "title": Path(filename).stem,
        "filename": filename,
        "file_path": str(dest),
        "file_type": file_type,
        "file_size": len(content_bytes),
        "source_url": source_data if source_type == "url" else None,
        "author": None,
        "linkedin_post_url": None,
        "domain": "uncategorized",
        "tags": [],
        "summary": None,
        "read_status": "unread",
        "raw_text": content_bytes.decode("utf-8", errors="replace")[:8000] if file_type in ("md", "txt") else None,
        "doc_type": "raw",
        "ingest_source": ingest_source_tag,
        "dedup_status": "unchecked",
    }

    # STEP 2 — FINGERPRINT
    text_for_fingerprint = new_doc.get("raw_text") or ""
    if not text_for_fingerprint and dest.exists():
        from categorizer import extract_text
        text_for_fingerprint = extract_text(new_doc)

    fingerprint = await get_fingerprint(text_for_fingerprint)
    if fingerprint:
        new_doc["knowledge_fingerprint"] = json.dumps(fingerprint)

    # STEP 3 — DEDUPLICATE (skip if force_add)
    dedup = {"status": "unique", "action": "add_new", "similar_docs": [], "primary_match": None}
    if not force_add and fingerprint:
        dedup = await check_duplicates(fingerprint, new_doc)

    if dedup["action"] == "skip" and not force_add:
        dest.unlink(missing_ok=True)
        pm = dedup.get("primary_match") or {}
        return {
            "status": "duplicate",
            "action_taken": "skip",
            "dedup_decision": dedup,
            "message": f"Duplicate of '{pm.get('title') or pm.get('filename', 'existing doc')}' (AI similarity check)",
        }

    # STEP 4 — SAVE TO DB
    new_doc["dedup_status"] = dedup["status"]
    database.insert_document(new_doc)

    # Record relations
    if dedup["similar_docs"]:
        pm = dedup.get("primary_match") or dedup["similar_docs"][0]
        overlap = list(
            set(fingerprint.get("core_topics", [])) &
            set((pm.get("key_topics") or []) if isinstance(pm, dict) else [])
        )
        new_set = fingerprint.get("core_topics", [])
        database.save_document_relation(
            source_doc_id=doc_id,
            target_doc_id=pm.get("id", "") if isinstance(pm, dict) else "",
            relation_type=dedup["status"],
            similarity_score=dedup["similar_docs"][0].get("similarity_score", 0.0),
            overlap_topics=overlap,
            new_topics=new_set,
        )

    # STEP 5 — CATEGORIZE + CONCEPT CARD
    categorized = await categorize_document(doc_id)
    final_doc = categorized or database.get_document(doc_id)

    if not skip_concept_card and final_doc:
        try:
            from extractor import extract_concepts
            await extract_concepts(doc_id)
        except Exception as e:
            log.debug("Concept card skipped: %s", e)

    # STEP 6 — QUEUE PORTAL SYNC
    domain = (final_doc or {}).get("domain", "uncategorized")
    if domain != "uncategorized":
        database.queue_portal_sync(domain)

    action_map = {
        "add_new": "added as new content",
        "add_as_related": "added as related document",
        "add_new_section": "added — study guide patch queued",
    }

    return {
        "status": dedup["status"],
        "doc_id": doc_id,
        "action_taken": action_map.get(dedup["action"], dedup["action"]),
        "dedup_decision": dedup,
        "title": (final_doc or new_doc).get("title"),
        "domain": domain,
        "message": None,
    }


def _mime_to_ext(mime: str) -> str:
    return {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "application/vnd.ms-powerpoint": ".ppt",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "text/markdown": ".md",
        "text/plain": ".txt",
    }.get(mime, ".bin")
