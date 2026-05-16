"""
Phase 3 — AI Semantic Search.
Two-stage: SQLite FTS5 keyword search → Gemini reranking.
"""

import json
import logging
from typing import Optional

import ai_client
import database

log = logging.getLogger(__name__)

RERANK_PROMPT = """Given this search query: "{query}"

Rank the following documents by relevance. Return a JSON array for documents with relevance_score > 0.3:
[
  {{
    "id": "<doc id>",
    "relevance_score": <0.0-1.0>,
    "relevance_reason": "<one sentence why this is relevant>",
    "key_excerpt": "<one key sentence from the summary that answers the query>"
  }}
]

Order by relevance_score descending. Only include documents with score > 0.3.

Query: {query}

Documents:
{docs_json}"""

QA_SYSTEM = """You are an expert SRE/DevOps assistant answering questions for a Staff/Principal engineer.
Give direct, conceptually deep answers. No installation steps.
Reference the provided documents by title. Think at staff level: trade-offs, failure modes, scale considerations."""

QA_PROMPT = """Answer this question using the provided document context:

Question: {question}

Document context:
{context}

Prior conversation:
{history}

Give a direct, technically deep answer. Reference document titles when drawing from them.
End with: Sources: [title1, title2, ...]"""


async def search(query: str, limit: int = 10, domain: Optional[str] = None) -> list:
    candidates = database.list_documents(domain=domain, search=query, limit=20)
    if not candidates:
        candidates = database.list_documents(domain=domain, limit=20)
    if not candidates:
        return []

    if not ai_client.is_configured() or len(candidates) <= 3:
        return [_enrich(d) for d in candidates[:limit]]

    docs_summary = [
        {
            "id": d["id"],
            "title": d.get("title") or d.get("filename"),
            "domain": d.get("domain"),
            "summary": d.get("summary") or "",
            "key_topics": d.get("key_topics") or [],
        }
        for d in candidates
    ]

    prompt = RERANK_PROMPT.format(
        query=query,
        docs_json=json.dumps(docs_summary, indent=2),
    )

    try:
        raw = await ai_client.generate(prompt, task="search_rerank", json_output=True)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip().rstrip("`")
        ranked = json.loads(raw)
    except Exception as e:
        log.warning("Reranking failed (%s) — returning FTS results", e)
        return [_enrich(d) for d in candidates[:limit]]

    doc_map = {d["id"]: d for d in candidates}
    results = []
    for r in ranked[:limit]:
        doc_id = r.get("id")
        if doc_id in doc_map:
            enriched = _enrich(doc_map[doc_id])
            enriched["relevance_score"] = r.get("relevance_score", 0.5)
            enriched["relevance_reason"] = r.get("relevance_reason", "")
            enriched["key_excerpt"] = r.get("key_excerpt", "")
            results.append(enriched)
    return results


async def ask(
    question: str,
    doc_ids: list = None,
    domain: Optional[str] = None,
    history: list = None,
) -> dict:
    if not doc_ids:
        results = await search(question, limit=5, domain=domain)
        doc_ids = [r["id"] for r in results]

    context_parts = []
    sources = []
    for doc_id in doc_ids[:5]:
        card = database.get_concept_card_for_doc(doc_id)
        if card:
            content = (card.get("raw_text") or "")[:3000]
            title = card.get("title") or card.get("filename")
        else:
            doc = database.get_document(doc_id)
            if not doc:
                continue
            content = (doc.get("summary") or "") + "\n" + ", ".join(doc.get("key_topics") or [])
            title = doc.get("title") or doc.get("filename")
        context_parts.append(f"### {title}\nDomain: {card['domain'] if card else ''}\n{content}")
        sources.append({"doc_id": doc_id, "title": title})

    context = "\n\n".join(context_parts) or "No relevant documents found in the knowledge base."
    history_text = "\n".join(
        f"{m['role'].capitalize()}: {m['content']}" for m in (history or [])
    ) or "(none)"

    prompt = f"{QA_SYSTEM}\n\n" + QA_PROMPT.format(
        question=question,
        context=context,
        history=history_text,
    )

    try:
        answer = await ai_client.generate(prompt, task="answer_question")
    except Exception as e:
        log.warning("Q&A generation failed: %s", e)
        answer = f"Could not generate an answer: {e}"

    return {"answer": answer, "sources": sources}


def _enrich(doc: dict) -> dict:
    card = database.get_concept_card_for_doc(doc["id"])
    return {
        "id": doc["id"],
        "title": doc.get("title") or doc.get("filename"),
        "domain": doc.get("domain"),
        "summary": doc.get("summary"),
        "concept_level": doc.get("concept_level"),
        "tags": doc.get("tags", []),
        "key_topics": doc.get("key_topics", []),
        "has_concept_card": card is not None,
        "relevance_score": None,
        "relevance_reason": None,
        "key_excerpt": None,
    }
