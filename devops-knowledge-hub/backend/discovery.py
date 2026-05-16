"""
Phase 6 — Internet Discovery Engine.
Web search + AI curation for topic-based document finding.
"""

import json
import logging
import os
from typing import Optional

import ai_client
import database

log = logging.getLogger(__name__)

QUERY_EXPANSION_PROMPT = """I am a Senior SRE/DevOps engineer wanting to learn about:
"{query}"

Generate 5 optimized search queries to find:
- Architecture guides and deep-dives (not tutorials)
- PDF cheatsheets and reference cards
- GitHub repos with good documentation
- Official vendor whitepapers
- Production experience writeups

Return JSON only: {{ "queries": ["q1", "q2", "q3", "q4", "q5"] }}"""

CURATION_PROMPT = """Curate these search results for a Staff/Principal SRE engineer studying "{query}".

Score and filter. Return JSON array of best results:
[{{
  "url": "...",
  "title": "...",
  "why_relevant": "one sentence",
  "content_type": "pdf|doc|webpage|github|video",
  "estimated_depth": "surface|intermediate|deep",
  "recommend": true|false
}}]

Prefer: PDFs, GitHub docs, official vendor whitepapers, architecture deep-dives, production experience.
Deprioritize: tutorials, getting-started guides, marketing pages, listicles.

Results to evaluate:
{results_json}"""

EXPAND_PROMPT = """I have a document about: "{doc_title}"
Summary: {doc_summary}
Key topics: {doc_topics}

Generate 5 search queries to find MORE documents that:
- Go deeper on the same topics
- Cover related subtopics not yet addressed
- Provide alternative perspectives or implementations
- Are at staff/principal engineer level

Return JSON only: {{ "queries": ["q1", "q2", "q3", "q4", "q5"] }}"""


_search_error: str = ""  # module-level last error for reporting


async def search_web(query: str) -> list[dict]:
    """Try Google CSE → SerpAPI → DuckDuckGo (no-key fallback)."""
    global _search_error
    google_key = os.getenv("GOOGLE_API_KEY", "")
    google_cse = os.getenv("GOOGLE_CSE_ID", "")
    serpapi_key = os.getenv("SERPAPI_KEY", "")

    if google_key and google_cse:
        try:
            results = await _google_cse_search(query, google_key, google_cse)
            if results:
                return results
            log.warning("Google CSE returned no results, falling back to DuckDuckGo")
        except RuntimeError as e:
            _search_error = str(e)
            log.error("Google CSE failed (%s), falling back to DuckDuckGo", e)

    if serpapi_key:
        results = await _serpapi_search(query, serpapi_key)
        if results:
            return results

    # DuckDuckGo — no API key needed, always available
    log.info("Using DuckDuckGo search for: %s", query)
    return await _ddg_search(query)


async def _ddg_search(query: str) -> list[dict]:
    """DuckDuckGo search — free, no key required."""
    try:
        import asyncio
        from ddgs import DDGS
        loop = asyncio.get_event_loop()

        def _run():
            d = DDGS()
            return list(d.text(query, max_results=8))

        hits = await loop.run_in_executor(None, _run)
        return [
            {
                "url": h.get("href", ""),
                "title": h.get("title", ""),
                "snippet": h.get("body", ""),
            }
            for h in hits if h.get("href")
        ]
    except Exception as e:
        log.error("DuckDuckGo search failed: %s", e)
        return []


async def _google_cse_search(query: str, api_key: str, cse_id: str) -> list[dict]:
    try:
        import httpx
        url = "https://www.googleapis.com/customsearch/v1"
        params = {"key": api_key, "cx": cse_id, "q": query, "num": 5}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
        if resp.status_code != 200:
            err = resp.json().get("error", {})
            log.error("Google CSE API error %s: %s", resp.status_code, err.get("message", resp.text[:200]))
            raise RuntimeError(f"Google CSE {resp.status_code}: {err.get('message', 'unknown error')}")
        items = resp.json().get("items", [])
        return [
            {"url": i["link"], "title": i.get("title", ""), "snippet": i.get("snippet", "")}
            for i in items
        ]
    except RuntimeError:
        raise
    except Exception as e:
        log.warning("Google CSE search failed: %s", e)
        return []


async def _serpapi_search(query: str, api_key: str) -> list[dict]:
    try:
        import httpx
        params = {"engine": "google", "q": query, "api_key": api_key, "num": 5}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get("https://serpapi.com/search", params=params)
            resp.raise_for_status()
        results = resp.json().get("organic_results", [])
        return [
            {"url": r.get("link", ""), "title": r.get("title", ""), "snippet": r.get("snippet", "")}
            for r in results
        ]
    except Exception as e:
        log.warning("SerpAPI search failed: %s", e)
        return []


async def discover(
    query: str,
    mode: str = "topic",
    reference_doc_id: Optional[str] = None,
) -> dict:
    """
    Main discovery function. Returns session_id + curated results.
    """
    session_id = database.create_discovery_session(query, mode)

    # Step 1 — Query expansion
    if mode == "expand" and reference_doc_id:
        ref_doc = database.get_document(reference_doc_id)
        if ref_doc:
            expansion_prompt = EXPAND_PROMPT.format(
                doc_title=ref_doc.get("title") or ref_doc.get("filename"),
                doc_summary=ref_doc.get("summary") or "",
                doc_topics=", ".join(ref_doc.get("key_topics") or []),
            )
        else:
            expansion_prompt = QUERY_EXPANSION_PROMPT.format(query=query)
    else:
        expansion_prompt = QUERY_EXPANSION_PROMPT.format(query=query)

    queries = [query]  # fallback
    if ai_client.is_configured():
        try:
            raw = await ai_client.generate(expansion_prompt, task="answer_question", json_output=True)
            parsed = json.loads(raw.strip())
            queries = parsed.get("queries", [query])[:5]
        except Exception as e:
            log.warning("Query expansion failed: %s", e)

    # Step 2 — Web search (all queries)
    import asyncio
    search_tasks = [search_web(q) for q in queries]
    all_results_nested = await asyncio.gather(*search_tasks, return_exceptions=True)

    raw_results: list[dict] = []
    seen_urls: set[str] = set()
    for batch in all_results_nested:
        if isinstance(batch, list):
            for r in batch:
                url = r.get("url", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    raw_results.append(r)

    database.update_discovery_session(session_id, {"results": raw_results, "status": "searching"})

    if not raw_results:
        database.update_discovery_session(session_id, {"status": "complete"})
        return {
            "session_id": session_id,
            "query": query,
            "results": [],
            "message": _search_error or "Search returned no results for this query.",
        }

    # Step 3 — AI curation
    curated_results = raw_results  # fallback without AI
    if ai_client.is_configured():
        curation_prompt = CURATION_PROMPT.format(
            query=query,
            results_json=json.dumps(raw_results[:25], indent=2),
        )
        try:
            raw = await ai_client.generate(curation_prompt, task="answer_question", json_output=True)
            curated_results = json.loads(raw.strip())
        except Exception as e:
            log.warning("AI curation failed: %s", e)

    # Step 4 — Cross-check against existing docs
    enriched = []
    for r in curated_results:
        if not r.get("recommend", True):
            continue
        already_covered = _check_existing_coverage(r.get("title", ""), r.get("url", ""))
        r["already_covered"] = already_covered is not None
        r["similar_to"] = already_covered
        enriched.append(r)

    database.update_discovery_session(session_id, {
        "results": json.dumps(enriched),
        "status": "complete",
    })

    return {
        "session_id": session_id,
        "query": query,
        "results": enriched,
    }


def _check_existing_coverage(title: str, url: str) -> Optional[dict]:
    """Quick check if we already have a document covering this content."""
    if not title:
        return None
    # Check by source URL match
    conn = database.get_connection()
    row = conn.execute(
        "SELECT id, title FROM documents WHERE source_url = ? AND doc_type = 'raw' LIMIT 1",
        (url,),
    ).fetchone()
    conn.close()
    if row:
        return {"id": row["id"], "title": row["title"]}
    return None


async def download_selected(session_id: str, selected_urls: list[str]) -> list[dict]:
    """Download and ingest selected URLs from a discovery session."""
    from ingestion import ingest

    results = []
    database.update_discovery_session(session_id, {"selected": selected_urls, "status": "downloading"})

    for url in selected_urls:
        log.info("Ingesting discovered URL: %s", url)
        try:
            result = await ingest(
                source_type="web_discovery",
                source_data=url,
                ingest_source_tag="web_discovery",
            )
            result["url"] = url
            results.append(result)
        except Exception as e:
            log.error("Download failed for %s: %s", url, e)
            results.append({"url": url, "status": "error", "message": str(e)})

    database.update_discovery_session(session_id, {"status": "complete"})
    return results
