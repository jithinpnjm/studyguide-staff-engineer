"""
Phase 6 — Watch Folder Auto-Ingest.
Monitors WATCH_DIR for new files and runs the ingestion pipeline automatically.
"""

import asyncio
import logging
import os
import time
from pathlib import Path

import database

log = logging.getLogger(__name__)

WATCH_DIR = Path(os.getenv("WATCH_DIR", str(Path.home() / "Downloads" / "devops-hub")))
SUPPORTED_EXTENSIONS = {".pdf", ".pptx", ".ppt", ".docx", ".doc", ".md", ".txt"}


class HubFileHandler:
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop
        self._processing: set[str] = set()

    def on_created(self, filepath: str):
        path = Path(filepath)
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return
        if str(filepath) in self._processing:
            return
        self._processing.add(str(filepath))
        asyncio.run_coroutine_threadsafe(self._ingest(filepath), self._loop)

    async def _ingest(self, filepath: str):
        await asyncio.sleep(2.0)  # Wait for file to finish writing
        path = Path(filepath)
        if not path.exists():
            self._processing.discard(str(filepath))
            return

        log.info("Watch folder: new file detected — %s", path.name)
        try:
            from ingestion import ingest
            result = await ingest(
                source_type="local_file",
                source_data=str(path),
                ingest_source_tag="watch_folder",
            )
            status = result.get("status", "unknown")
            doc_id = result.get("doc_id")
            database.log_watch_event(str(filepath), status, doc_id=doc_id)
            log.info("Watch folder ingest: %s → %s (%s)", path.name, status, result.get("domain", ""))
        except Exception as e:
            log.error("Watch folder ingest failed for %s: %s", path.name, e)
            database.log_watch_event(str(filepath), "error", error_msg=str(e))
        finally:
            self._processing.discard(str(filepath))


def start_watcher(loop: asyncio.AbstractEventLoop):
    """Called from main.py startup in a daemon thread."""
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler, FileCreatedEvent
    except ImportError:
        log.warning("watchdog not installed — folder watching disabled. pip install watchdog")
        return

    WATCH_DIR.mkdir(parents=True, exist_ok=True)
    handler_obj = HubFileHandler(loop)

    class _WatchdogBridge(FileSystemEventHandler):
        def on_created(self, event):
            if not event.is_directory:
                handler_obj.on_created(event.src_path)

    observer = Observer()
    observer.schedule(_WatchdogBridge(), str(WATCH_DIR), recursive=False)
    observer.start()
    log.info("Watch folder active: %s", WATCH_DIR)

    try:
        while True:
            time.sleep(5)
    except (KeyboardInterrupt, SystemExit):
        observer.stop()
    observer.join()
