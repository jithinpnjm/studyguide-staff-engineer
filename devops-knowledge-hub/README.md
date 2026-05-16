# DevOps Knowledge Hub

A fully local personal document repository and study platform for Senior DevOps/SRE/Cloud Engineers.
Save LinkedIn documents with one click. Browse, search, and study them in a clean local web app.
No data leaves your machine (except AI categorization in Phase 3, which uses the Anthropic API).

## Architecture

```
extension/   Chrome Manifest V3 — detects LinkedIn documents, saves to backend
backend/     FastAPI + SQLite — stores files and metadata at ~/devops-knowledge-hub/
frontend/    React 18 + Vite — browse, search, and view your documents
```

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: copy .env.example to .env and add your Anthropic key (needed for Phase 3 only)
cp .env.example .env

python main.py
# Runs on http://localhost:8765
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens on http://localhost:3000
```

### 3. Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The DevOps Hub icon appears in your toolbar

### 4. Use it

1. Go to `https://www.linkedin.com/feed/`
2. Browse the feed — any post with an attached document will show a **Save to Hub** button
3. Click it — the button turns green ("Saved ✓") when done
4. Open [http://localhost:3000](http://localhost:3000) to browse your library

## Storage

All data is stored locally:

| Path | Contents |
|------|----------|
| `~/devops-knowledge-hub/documents/` | Document files (named by SHA256 hash) |
| `~/devops-knowledge-hub/metadata.db` | SQLite database with all metadata |

## API Reference

The backend exposes a REST API on port 8765:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents/upload` | Upload a document (multipart: `file` + `metadata` JSON) |
| `GET` | `/api/documents` | List documents (`?domain=`, `?search=`, `?limit=`, `?offset=`) |
| `GET` | `/api/documents/{id}` | Get single document metadata |
| `GET` | `/api/documents/{id}/file` | Serve the document file |
| `PATCH` | `/api/documents/{id}/status` | Update read status (`{ "read_status": "read"|"unread" }`) |
| `GET` | `/api/stats` | Total docs, per-domain counts, recent activity |
| `GET` | `/api/health` | Health check |

## Domain Taxonomy

Documents are tagged with one of these domains (auto-categorized in Phase 3):

- `kubernetes-containers`
- `cicd-gitops`
- `observability`
- `cloud-platforms`
- `infrastructure-as-code`
- `security-devsecops`
- `networking-service-mesh`
- `sre-practices`
- `linux-systems`
- `databases-storage`
- `platform-engineering`
- `general-devops`

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **1** | ✅ Built | LinkedIn capture, backend API, local storage, frontend |
| **2** | Planned | Enhanced search, bulk import, PDF text extraction |
| **3** | Planned | Claude API auto-categorization (hook point in `categorizer.py`) |
| **4** | Planned | Study guide generator — synthesizes docs into learning paths |

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLite (FTS5), PyMuPDF, uvicorn
- **Frontend:** React 18, Vite, React Router, plain CSS
- **Extension:** Chrome Manifest V3, vanilla JS
- **AI (Phase 3+):** Anthropic SDK, `claude-sonnet-4-20250514`

## Troubleshooting

**"Backend offline" in extension popup**
→ Make sure `python main.py` is running in the `backend/` directory.

**No "Save to Hub" button on LinkedIn**
→ Refresh the page after installing the extension. The button only appears on posts with attached documents (PDFs, PPTs, carousels).

**Document downloads but file is empty**
→ LinkedIn may require authentication for the download URL. Make sure you're logged in and try again.

**Icons missing in Chrome**
→ Run `python extension/icons/generate_icons.py` (requires `pip install Pillow`).
