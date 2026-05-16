import sqlite3
import json
import uuid
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

DB_PATH = Path(os.getenv("HUB_BASE_DIR", str(Path.home() / "devops-knowledge-hub"))) / "metadata.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS documents (
            id                TEXT PRIMARY KEY,
            hash              TEXT UNIQUE NOT NULL,
            title             TEXT,
            filename          TEXT NOT NULL,
            file_path         TEXT NOT NULL,
            file_type         TEXT NOT NULL,
            file_size         INTEGER NOT NULL,
            source_url        TEXT,
            author            TEXT,
            linkedin_post_url TEXT,
            domain            TEXT NOT NULL DEFAULT 'uncategorized',
            tags              TEXT NOT NULL DEFAULT '[]',
            summary           TEXT,
            read_status       TEXT NOT NULL DEFAULT 'unread',
            saved_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            raw_text          TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
            title, summary, raw_text, tags,
            content=documents,
            content_rowid=rowid
        );

        CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
            INSERT INTO documents_fts(rowid, title, summary, raw_text, tags)
            VALUES (new.rowid, new.title, new.summary, new.raw_text, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
            INSERT INTO documents_fts(documents_fts, rowid, title, summary, raw_text, tags)
            VALUES ('delete', old.rowid, old.title, old.summary, old.raw_text, old.tags);
            INSERT INTO documents_fts(rowid, title, summary, raw_text, tags)
            VALUES (new.rowid, new.title, new.summary, new.raw_text, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
            INSERT INTO documents_fts(documents_fts, rowid, title, summary, raw_text, tags)
            VALUES ('delete', old.rowid, old.title, old.summary, old.raw_text, old.tags);
        END;
    """)
    conn.commit()
    conn.close()
    migrate_db()


def migrate_db():
    """Idempotent schema migration — adds all new columns and tables safely."""
    conn = get_connection()

    new_columns = [
        ("concept_level",        "TEXT DEFAULT 'intermediate'"),
        ("key_topics",           "TEXT"),
        ("categorized_at",       "DATETIME"),
        ("parent_id",            "TEXT"),
        ("doc_type",             "TEXT DEFAULT 'raw'"),
        ("knowledge_fingerprint","TEXT"),
        ("ingest_source",        "TEXT DEFAULT 'manual'"),
        ("dedup_status",         "TEXT DEFAULT 'unchecked'"),
        ("related_doc_ids",      "TEXT DEFAULT '[]'"),
    ]
    for col, definition in new_columns:
        try:
            conn.execute(f"ALTER TABLE documents ADD COLUMN {col} {definition}")
            conn.commit()
        except Exception:
            pass

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS study_guides (
            domain       TEXT PRIMARY KEY,
            content      TEXT NOT NULL,
            generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            doc_count    INTEGER NOT NULL DEFAULT 0,
            version      INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS categorization_errors (
            id           TEXT PRIMARY KEY,
            doc_id       TEXT NOT NULL,
            error_msg    TEXT,
            attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS document_relations (
            id               TEXT PRIMARY KEY,
            source_doc_id    TEXT NOT NULL,
            target_doc_id    TEXT NOT NULL,
            relation_type    TEXT NOT NULL,
            similarity_score REAL,
            overlap_topics   TEXT,
            new_topics       TEXT,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS discovery_sessions (
            id          TEXT PRIMARY KEY,
            query       TEXT NOT NULL,
            search_type TEXT NOT NULL,
            results     TEXT,
            selected    TEXT,
            status      TEXT DEFAULT 'pending',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS study_guide_patches (
            id             TEXT PRIMARY KEY,
            domain         TEXT NOT NULL,
            patch_type     TEXT NOT NULL,
            trigger_doc_id TEXT,
            patch_content  TEXT,
            applied        INTEGER DEFAULT 0,
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS portal_sync_queue (
            id         TEXT PRIMARY KEY,
            domain     TEXT NOT NULL,
            queued_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            status     TEXT DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS watch_folder_log (
            id          TEXT PRIMARY KEY,
            filepath    TEXT NOT NULL,
            status      TEXT NOT NULL,
            doc_id      TEXT,
            error_msg   TEXT,
            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    conn.close()


# ── Row helpers ──────────────────────────────────────────────────────────────

def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    for json_col in ("tags", "key_topics", "related_doc_ids"):
        if d.get(json_col):
            try:
                d[json_col] = json.loads(d[json_col])
            except Exception:
                d[json_col] = []
        else:
            d[json_col] = []
    return d


# ── Document CRUD ────────────────────────────────────────────────────────────

def find_by_hash(file_hash: str) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM documents WHERE hash = ?", (file_hash,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def insert_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(doc)
    for col in ("tags", "key_topics", "related_doc_ids"):
        if isinstance(d.get(col), list):
            d[col] = json.dumps(d[col])
        elif col not in d:
            d[col] = "[]"

    conn = get_connection()
    conn.execute(
        """INSERT INTO documents
            (id, hash, title, filename, file_path, file_type, file_size,
             source_url, author, linkedin_post_url, domain, tags, summary,
             read_status, raw_text, doc_type, parent_id,
             ingest_source, dedup_status)
           VALUES
            (:id, :hash, :title, :filename, :file_path, :file_type, :file_size,
             :source_url, :author, :linkedin_post_url, :domain, :tags, :summary,
             :read_status, :raw_text,
             :doc_type, :parent_id, :ingest_source, :dedup_status)""",
        {
            "doc_type":      d.get("doc_type", "raw"),
            "parent_id":     d.get("parent_id"),
            "ingest_source": d.get("ingest_source", "manual"),
            "dedup_status":  d.get("dedup_status", "unchecked"),
            **d,
        },
    )
    conn.commit()
    conn.close()
    return doc


def get_document(doc_id: str) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def update_document(doc_id: str, fields: Dict[str, Any]) -> Optional[Dict]:
    if not fields:
        return get_document(doc_id)
    fields = dict(fields)
    for col in ("tags", "key_topics", "related_doc_ids"):
        if col in fields and isinstance(fields[col], list):
            fields[col] = json.dumps(fields[col])
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    params = {**fields, "id": doc_id}
    conn = get_connection()
    conn.execute(f"UPDATE documents SET {set_clause} WHERE id = :id", params)
    conn.commit()
    conn.close()
    return get_document(doc_id)


def list_documents(
    domain: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    doc_type: str = "raw",
) -> List[Dict]:
    conn = get_connection()
    if search:
        query = """SELECT d.* FROM documents d
                   INNER JOIN documents_fts fts ON d.rowid = fts.rowid
                   WHERE documents_fts MATCH ?"""
        params: list = [search]
        if domain:
            query += " AND d.domain = ?"
            params.append(domain)
        if doc_type:
            query += " AND d.doc_type = ?"
            params.append(doc_type)
        query += " ORDER BY d.saved_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
    else:
        query = "SELECT * FROM documents WHERE 1=1"
        params = []
        if domain:
            query += " AND domain = ?"
            params.append(domain)
        if doc_type:
            query += " AND doc_type = ?"
            params.append(doc_type)
        query += " ORDER BY saved_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_uncategorized_docs(limit: int = 1000) -> List[Dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT * FROM documents
           WHERE domain = 'uncategorized'
           AND doc_type = 'raw'
           ORDER BY saved_at ASC LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_docs_by_domain(domain: str, doc_type: str = "raw") -> List[Dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM documents WHERE domain = ? AND doc_type = ? ORDER BY saved_at DESC",
        (domain, doc_type),
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_concept_card_for_doc(parent_id: str) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM documents WHERE parent_id = ? AND doc_type = 'concept_card'",
        (parent_id,),
    ).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def log_categorization_error(doc_id: str, error_msg: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO categorization_errors (id, doc_id, error_msg) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), doc_id, error_msg),
    )
    conn.commit()
    conn.close()


# ── Study guides ─────────────────────────────────────────────────────────────

def save_study_guide(domain: str, content: str, doc_count: int):
    conn = get_connection()
    conn.execute(
        """INSERT INTO study_guides (domain, content, generated_at, doc_count, version)
           VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)
           ON CONFLICT(domain) DO UPDATE SET
             content=excluded.content,
             generated_at=excluded.generated_at,
             doc_count=excluded.doc_count,
             version=version+1""",
        (domain, content, doc_count),
    )
    conn.commit()
    conn.close()


def get_study_guide(domain: str) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM study_guides WHERE domain = ?", (domain,)).fetchone()
    conn.close()
    return dict(row) if row else None


def save_study_guide_patch(domain: str, trigger_doc_id: str, patch_type: str, patch_content: str):
    conn = get_connection()
    conn.execute(
        """INSERT INTO study_guide_patches
           (id, domain, patch_type, trigger_doc_id, patch_content)
           VALUES (?, ?, ?, ?, ?)""",
        (str(uuid.uuid4()), domain, patch_type, trigger_doc_id, patch_content),
    )
    conn.commit()
    conn.close()


# ── Document relations (dedup / similarity) ──────────────────────────────────

def save_document_relation(
    source_doc_id: str,
    target_doc_id: str,
    relation_type: str,
    similarity_score: float,
    overlap_topics: list,
    new_topics: list,
):
    conn = get_connection()
    conn.execute(
        """INSERT OR IGNORE INTO document_relations
           (id, source_doc_id, target_doc_id, relation_type,
            similarity_score, overlap_topics, new_topics)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            str(uuid.uuid4()),
            source_doc_id,
            target_doc_id,
            relation_type,
            similarity_score,
            json.dumps(overlap_topics),
            json.dumps(new_topics),
        ),
    )
    conn.commit()
    conn.close()


def get_similar_docs(doc_id: str) -> List[Dict]:
    conn = get_connection()
    rows = conn.execute(
        """SELECT dr.*, d.title, d.domain, d.summary, d.concept_level
           FROM document_relations dr
           JOIN documents d ON (
             CASE WHEN dr.source_doc_id = ? THEN dr.target_doc_id
                  ELSE dr.source_doc_id END = d.id
           )
           WHERE dr.source_doc_id = ? OR dr.target_doc_id = ?
           ORDER BY dr.similarity_score DESC""",
        (doc_id, doc_id, doc_id),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Discovery sessions ───────────────────────────────────────────────────────

def create_discovery_session(query: str, search_type: str) -> str:
    session_id = str(uuid.uuid4())
    conn = get_connection()
    conn.execute(
        "INSERT INTO discovery_sessions (id, query, search_type) VALUES (?, ?, ?)",
        (session_id, query, search_type),
    )
    conn.commit()
    conn.close()
    return session_id


def update_discovery_session(session_id: str, fields: dict):
    conn = get_connection()
    for k, v in fields.items():
        if isinstance(v, (list, dict)):
            fields[k] = json.dumps(v)
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    conn.execute(
        f"UPDATE discovery_sessions SET {set_clause} WHERE id = :id",
        {**fields, "id": session_id},
    )
    conn.commit()
    conn.close()


def get_discovery_session(session_id: str) -> Optional[Dict]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM discovery_sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_discovery_sessions(limit: int = 10) -> List[Dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM discovery_sessions ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Portal sync queue ────────────────────────────────────────────────────────

def queue_portal_sync(domain: str):
    conn = get_connection()
    conn.execute(
        """INSERT OR IGNORE INTO portal_sync_queue (id, domain)
           SELECT ?, ? WHERE NOT EXISTS (
             SELECT 1 FROM portal_sync_queue WHERE domain = ? AND status = 'pending'
           )""",
        (str(uuid.uuid4()), domain, domain),
    )
    conn.commit()
    conn.close()


def get_pending_portal_syncs() -> List[str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT domain FROM portal_sync_queue WHERE status = 'pending'"
    ).fetchall()
    conn.close()
    return [r["domain"] for r in rows]


def mark_portal_sync_done(domain: str):
    conn = get_connection()
    conn.execute(
        "UPDATE portal_sync_queue SET status = 'done' WHERE domain = ? AND status = 'pending'",
        (domain,),
    )
    conn.commit()
    conn.close()


# ── Watch folder log ─────────────────────────────────────────────────────────

def log_watch_event(filepath: str, status: str, doc_id: str = None, error_msg: str = None):
    conn = get_connection()
    conn.execute(
        """INSERT INTO watch_folder_log (id, filepath, status, doc_id, error_msg)
           VALUES (?, ?, ?, ?, ?)""",
        (str(uuid.uuid4()), filepath, status, doc_id, error_msg),
    )
    conn.commit()
    conn.close()


def list_watch_events(limit: int = 20) -> List[Dict]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM watch_folder_log ORDER BY processed_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Stats ────────────────────────────────────────────────────────────────────

def get_stats() -> Dict[str, Any]:
    conn = get_connection()
    total = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE doc_type = 'raw'"
    ).fetchone()[0]
    unread = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE read_status = 'unread' AND doc_type = 'raw'"
    ).fetchone()[0]
    recent = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE saved_at >= datetime('now', '-1 day') AND doc_type = 'raw'"
    ).fetchone()[0]
    uncategorized = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE domain = 'uncategorized' AND doc_type = 'raw'"
    ).fetchone()[0]
    concept_cards = conn.execute(
        "SELECT COUNT(*) FROM documents WHERE doc_type = 'concept_card'"
    ).fetchone()[0]
    study_guides_count = conn.execute("SELECT COUNT(*) FROM study_guides").fetchone()[0]

    domain_rows = conn.execute(
        "SELECT domain, COUNT(*) as cnt FROM documents WHERE doc_type = 'raw' GROUP BY domain"
    ).fetchall()
    domains = {r["domain"]: r["cnt"] for r in domain_rows}

    level_rows = conn.execute(
        "SELECT concept_level, COUNT(*) as cnt FROM documents WHERE doc_type = 'raw' AND concept_level IS NOT NULL GROUP BY concept_level"
    ).fetchall()
    by_level = {r["concept_level"]: r["cnt"] for r in level_rows}

    conn.close()
    return {
        "total_documents": total,
        "unread_count": unread,
        "recent_count": recent,
        "uncategorized": uncategorized,
        "domains": domains,
        "by_level": by_level,
        "with_concept_cards": concept_cards,
        "study_guides_generated": study_guides_count,
    }
