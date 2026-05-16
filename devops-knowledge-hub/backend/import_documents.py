"""
Bulk import script — copies files from a local directory into the Knowledge Hub
storage and registers them in SQLite. Does NOT require the backend to be running.

Usage:
    python import_documents.py
"""

import hashlib
import json
import shutil
import sqlite3
import sys
import uuid
from pathlib import Path

SOURCE_ROOT = Path.home() / "Downloads" / "Shell Scripting"
DEST_ROOT = Path.home() / "devops-knowledge-hub" / "documents"
DB_PATH = Path.home() / "devops-knowledge-hub" / "metadata.db"

# Map source folder (case-insensitive) → domain taxonomy key
FOLDER_TO_DOMAIN = {
    "api":                          "platform-engineering",
    "aws":                          "cloud-platforms",
    "aws project":                  "cloud-platforms",
    "ansible":                      "infrastructure-as-code",
    "ansible project":              "infrastructure-as-code",
    "argocd":                       "cicd-gitops",
    "azure devops":                 "cicd-gitops",
    "azure-devops":                 "cicd-gitops",
    "bash scripting":               "linux-systems",
    "shell scripting":              "linux-systems",
    "cloud":                        "cloud-platforms",
    "devops project":               "general-devops",
    "devops basics":                "general-devops",
    "docker":                       "kubernetes-containers",
    "forward proxy vs reverse proxy": "networking-service-mesh",
    "general topics":               "general-devops",
    "git":                          "cicd-gitops",
    "github action":                "cicd-gitops",
    "grafana+prometheus":           "observability",
    "prometheus+grafana":           "observability",
    "interview ouestions":          "general-devops",   # root level
    "aws":                          "cloud-platforms",
    "azure devops":                 "cicd-gitops",
    "devops":                       "general-devops",
    "docker":                       "kubernetes-containers",
    "jenkins":                      "cicd-gitops",
    "kubernetes":                   "kubernetes-containers",
    "linux":                        "linux-systems",
    "python":                       "general-devops",
    "terraform":                    "infrastructure-as-code",
    "kafka":                        "databases-storage",
    "networking":                   "networking-service-mesh",
    "networking and load balancing": "networking-service-mesh",
    "sonarqube":                    "security-devsecops",
    "sql":                          "databases-storage",
    "yaml":                         "general-devops",
    "new folder":                   "general-devops",
}

# Interview Questions sub-folder overrides
INTERVIEW_SUBFOLDER_MAP = {
    "aws":          "cloud-platforms",
    "azure devops": "cicd-gitops",
    "devops":       "general-devops",
    "docker":       "kubernetes-containers",
    "jenkins":      "cicd-gitops",
    "kubernetes":   "kubernetes-containers",
    "linux":        "linux-systems",
    "python":       "general-devops",
    "terraform":    "infrastructure-as-code",
}

SKIP_EXTENSIONS = {".ds_store", ".zip"}
SKIP_FILENAMES  = {".DS_Store"}

EXT_TO_TYPE = {
    ".pdf":  "pdf",
    ".pptx": "pptx",
    ".ppt":  "ppt",
    ".docx": "docx",
    ".doc":  "doc",
    ".xlsx": "xlsx",
    ".xls":  "xls",
    ".jpg":  "jpg",
    ".jpeg": "jpeg",
    ".png":  "png",
    ".gif":  "gif",
}


def get_domain(rel_parts: list[str]) -> str:
    """Derive domain from path components relative to SOURCE_ROOT."""
    if not rel_parts:
        return "general-devops"

    top = rel_parts[0].lower()

    if top == "interview ouestions" and len(rel_parts) >= 2:
        sub = rel_parts[1].lower()
        return INTERVIEW_SUBFOLDER_MAP.get(sub, "general-devops")

    return FOLDER_TO_DOMAIN.get(top, "general-devops")


def get_title(rel_parts: list[str], stem: str) -> str:
    """Produce a human-readable title: 'Folder > stem' or just stem."""
    if not rel_parts:
        return stem
    folder = " > ".join(rel_parts)
    return f"[{folder}] {stem}"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def init_db(conn: sqlite3.Connection):
    conn.executescript("""
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
    """)
    conn.commit()


def main():
    if not SOURCE_ROOT.exists():
        print(f"Source not found: {SOURCE_ROOT}", file=sys.stderr)
        sys.exit(1)

    DEST_ROOT.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    init_db(conn)

    # Collect all existing hashes to skip duplicates
    existing_hashes = {
        r[0] for r in conn.execute("SELECT hash FROM documents").fetchall()
    }

    stats = {"imported": 0, "skipped_dup": 0, "skipped_type": 0, "errors": 0}

    all_files = sorted(SOURCE_ROOT.rglob("*"))
    files = [f for f in all_files if f.is_file()]

    print(f"Found {len(files)} files under {SOURCE_ROOT}")
    print(f"Destination: {DEST_ROOT}")
    print()

    for src in files:
        if src.name in SKIP_FILENAMES:
            continue

        ext = src.suffix.lower()
        if ext in SKIP_EXTENSIONS:
            stats["skipped_type"] += 1
            continue

        file_type = EXT_TO_TYPE.get(ext)
        if file_type is None:
            print(f"  SKIP  (unknown type {ext}): {src.name}")
            stats["skipped_type"] += 1
            continue

        try:
            file_hash = sha256(src)
        except Exception as e:
            print(f"  ERROR reading {src}: {e}")
            stats["errors"] += 1
            continue

        if file_hash in existing_hashes:
            print(f"  DUP   {src.name}")
            stats["skipped_dup"] += 1
            continue

        # Compute relative path parts (folder structure without filename)
        rel = src.relative_to(SOURCE_ROOT)
        rel_parts = list(rel.parts[:-1])  # exclude filename

        domain = get_domain(rel_parts)
        title = get_title(rel_parts, src.stem)

        dest = DEST_ROOT / f"{file_hash}{ext}"
        try:
            shutil.copy2(src, dest)
        except Exception as e:
            print(f"  ERROR copying {src}: {e}")
            stats["errors"] += 1
            continue

        doc_id = str(uuid.uuid4())
        file_size = src.stat().st_size

        try:
            conn.execute(
                """
                INSERT INTO documents
                    (id, hash, title, filename, file_path, file_type, file_size,
                     source_url, author, linkedin_post_url, domain, tags, summary,
                     read_status, raw_text)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, '[]', NULL, 'unread', NULL)
                """,
                (doc_id, file_hash, title, src.name, str(dest),
                 file_type, file_size, domain),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Hash constraint hit — another process inserted concurrently
            dest.unlink(missing_ok=True)
            stats["skipped_dup"] += 1
            continue

        existing_hashes.add(file_hash)
        stats["imported"] += 1
        print(f"  OK    [{domain:30s}] {title[:70]}")

    conn.close()

    print()
    print("=" * 60)
    print(f"Imported  : {stats['imported']}")
    print(f"Duplicates: {stats['skipped_dup']}")
    print(f"Skipped   : {stats['skipped_type']}")
    print(f"Errors    : {stats['errors']}")
    print("=" * 60)
    print(f"\nDone. Start the backend and visit http://localhost:3000")


if __name__ == "__main__":
    main()
