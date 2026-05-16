from pydantic import BaseModel, Field
from typing import Optional, List, Any


class DocumentUploadMeta(BaseModel):
    title: Optional[str] = None
    source_url: Optional[str] = None
    author: Optional[str] = None
    linkedin_post_url: Optional[str] = None
    file_type: Optional[str] = None
    raw_text: Optional[str] = None


class DocumentRecord(BaseModel):
    id: str
    hash: str
    title: Optional[str]
    filename: str
    file_path: str
    file_type: str
    file_size: int
    source_url: Optional[str]
    author: Optional[str]
    linkedin_post_url: Optional[str]
    domain: str
    tags: List[str]
    summary: Optional[str]
    read_status: str
    saved_at: str
    raw_text: Optional[str] = None
    concept_level: Optional[str] = None
    key_topics: Optional[List[str]] = None
    categorized_at: Optional[str] = None
    doc_type: Optional[str] = "raw"
    parent_id: Optional[str] = None
    ingest_source: Optional[str] = None
    dedup_status: Optional[str] = None


class DocumentListItem(BaseModel):
    id: str
    title: Optional[str]
    filename: str
    file_type: str
    file_size: int
    author: Optional[str]
    domain: str
    tags: List[str]
    summary: Optional[str]
    read_status: str
    saved_at: str
    linkedin_post_url: Optional[str]
    source_url: Optional[str]
    concept_level: Optional[str] = None
    key_topics: Optional[List[str]] = None
    doc_type: Optional[str] = "raw"


class UploadResponse(BaseModel):
    id: str
    status: str  # "saved" | "duplicate"
    path: str


class StatsResponse(BaseModel):
    total_documents: int
    unread_count: int
    domains: dict
    recent_count: int
    uncategorized: Optional[int] = 0
    by_level: Optional[dict] = None
    with_concept_cards: Optional[int] = 0
    study_guides_generated: Optional[int] = 0


class ReadStatusUpdate(BaseModel):
    read_status: str = Field(..., pattern="^(read|unread)$")


VALID_DOMAINS = {
    "kubernetes-containers", "cicd-gitops", "observability", "cloud-platforms",
    "infrastructure-as-code", "security-devsecops", "networking-service-mesh",
    "sre-practices", "linux-systems", "databases-storage", "platform-engineering",
    "ai-mlops", "agentic-genai", "llmops",
    "scripting-python", "scripting-bash-shell", "scripting-go",
    "automation-tooling", "general-devops", "uncategorized",
}


class DomainUpdate(BaseModel):
    domain: str

    def validate_domain(self):
        if self.domain not in VALID_DOMAINS:
            raise ValueError(f"Unknown domain: {self.domain}")
        return self


class ImageUploadMeta(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    linkedin_post_url: Optional[str] = None
    source_url: Optional[str] = None
    post_text: Optional[str] = None
    page_count: Optional[int] = None


class ImageUploadRequest(BaseModel):
    images: List[str]
    metadata: Optional[ImageUploadMeta] = None


class BatchCategorizeRequest(BaseModel):
    limit: int = 500
    only_uncategorized: bool = True
    domain_filter: str = "uncategorized"


class BatchProgress(BaseModel):
    task_id: str
    status: str
    total: int
    processed: int
    failed: List[str]
    done: bool
    current_title: Optional[str] = None
    current_domain: Optional[str] = None


class IngestRequest(BaseModel):
    source_type: str  # 'local_file' | 'url' | 'web_discovery'
    source_data: str  # filepath or URL
    options: Optional[dict] = None


class IngestResult(BaseModel):
    doc_id: Optional[str] = None
    status: str  # 'saved' | 'duplicate' | 'overlapping' | 'extends' | 'unique' | 'error'
    action_taken: Optional[str] = None
    dedup_decision: Optional[dict] = None
    title: Optional[str] = None
    domain: Optional[str] = None
    message: Optional[str] = None


class DiscoverRequest(BaseModel):
    query: str
    mode: str = "topic"  # 'topic' | 'expand' | 'tools'
    reference_doc_id: Optional[str] = None


class DiscoverDownloadRequest(BaseModel):
    session_id: str
    selected_urls: List[str]
