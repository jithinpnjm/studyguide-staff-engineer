import logging
import os

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

_configured = False


def _ensure_configured():
    global _configured
    if _configured:
        return
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        log.warning("GEMINI_API_KEY not set — AI features disabled")
        return
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _configured = True
    except ImportError:
        log.error("google-generativeai not installed — run: pip install google-generativeai")


MODELS = {
    "lite":  os.getenv("GEMINI_MODEL_LITE",  "gemini-2.5-flash-lite"),
    "flash": os.getenv("GEMINI_MODEL_FLASH", "gemini-2.5-flash"),
    "pro":   os.getenv("GEMINI_MODEL_PRO",   "gemini-2.5-pro"),
}

TASK_MODEL_MAP = {
    "categorize":       "lite",
    "extract_concepts": "flash",
    "search_rerank":    "flash",
    "answer_question":  "flash",
    "chat":             "flash",
    "study_guide":      "pro",
    "voice_response":   "flash",
}


TASK_MAX_TOKENS = {
    "study_guide": 65536,
    "extract_concepts": 8192,
}


def get_model(task: str, json_output: bool = False):
    _ensure_configured()
    import google.generativeai as genai
    tier = TASK_MODEL_MAP.get(task, "flash")
    model_name = MODELS[tier]
    config = genai.GenerationConfig(
        temperature=0.2 if json_output else 0.4,
        max_output_tokens=TASK_MAX_TOKENS.get(task, 4096),
        response_mime_type="application/json" if json_output else "text/plain",
    )
    return genai.GenerativeModel(model_name, generation_config=config)


async def generate(prompt: str, task: str = "chat", json_output: bool = False) -> str:
    model = get_model(task, json_output)
    response = model.generate_content(prompt)
    return response.text


def get_chat_session(history: list = None, task: str = "chat"):
    model = get_model(task)
    formatted = [
        {
            "role": "model" if m["role"] == "assistant" else "user",
            "parts": [m["content"]],
        }
        for m in (history or [])
    ]
    return model.start_chat(history=formatted)


def categorize_pdf_native(file_path: str, prompt: str) -> str:
    """Upload PDF directly to Gemini File API for better-quality categorization on image-heavy docs."""
    _ensure_configured()
    import google.generativeai as genai
    uploaded = genai.upload_file(
        path=file_path,
        display_name=os.path.basename(file_path),
    )
    try:
        model = get_model("categorize", json_output=True)
        response = model.generate_content([uploaded, prompt])
        return response.text
    finally:
        try:
            genai.delete_file(uploaded.name)
        except Exception:
            pass


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", ""))
