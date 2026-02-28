import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager

import fitz  # PyMuPDF
import instructor
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from tavily import TavilyClient

from models import PreProcessorOutput, SimulationInitResponse

load_dotenv()

# ── Constants ────────────────────────────────────────────────────────────────

INIT_MODEL = "gpt-4o-mini"
PDF_CHAR_LIMIT = 8_000
TAVILY_MAX_RESULTS = 5

SYSTEM_PROMPT = """\
You are a senior judicial analyst preparing a multi-agent adversarial legal simulation.

Given a case document and jurisdictional research, produce:
  1. A dense 3-sentence summary of the core facts.
  2. The most relevant legal precedents surfaced by the web search.
  3. Geographic and demographic biases specific to the jurisdiction that would influence
     a jury in this type of case.
  4. Between 3 and 5 distinct judicial personas — one per major competing legal argument.
     Each persona must include a detailed system_prompt that instructs an LLM to argue
     exclusively from that legal stance.

Be precise. Cite specific statutes and case names where possible. Ensure personas
represent genuinely adversarial legal philosophies.\
"""

CASE_SUMMARY_SYSTEM_PROMPT = (
    "You are a legal assistant. Read the beginning of this court document and output "
    "a highly concise, 5-to-10 word summary of the core legal issue and the involved "
    "parties. Return ONLY the summary, no other text."
)

# ── Lifespan: initialise shared clients once at startup ──────────────────────

openai_client: AsyncOpenAI | None = None      # raw client — used for the pre-pass
llm: instructor.AsyncInstructor | None = None  # instructor-wrapped — used for structured output
tavily: TavilyClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global openai_client, llm, tavily
    openai_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    llm = instructor.from_openai(openai_client)
    tavily = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    yield


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Sync helpers (offloaded to thread pool via asyncio.to_thread) ─────────────

def _parse_pdf(pdf_bytes: bytes) -> str:
    """Extract plain text from a PDF binary using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    return "\n\n".join(page.get_text() for page in doc)


def _search_tavily(client: TavilyClient, query: str) -> str:
    """Run a Tavily search and return results as a single formatted string.

    Failures are caught and returned as an inline notice so the LLM call
    can still proceed without search context rather than crashing the request.
    """
    try:
        response = client.search(query=query, max_results=TAVILY_MAX_RESULTS)
    except Exception as exc:
        return f"[Tavily search unavailable: {exc}]"

    results = response.get("results", [])
    if not results:
        return "[No relevant web results found.]"

    return "\n\n".join(
        f"SOURCE: {r.get('title', 'Untitled')}\n{r.get('content', '')}"
        for r in results
    )


# ── POST /api/v1/simulation/init ─────────────────────────────────────────────

@app.post("/api/v1/simulation/init", response_model=SimulationInitResponse)
async def initialize_simulation(
    file: UploadFile = File(...),
    jurisdiction: str = Form(...),
) -> SimulationInitResponse:
    # 1. Read and parse the uploaded file
    raw_bytes = await file.read()
    content_type = file.content_type or ""

    if "pdf" in content_type or (file.filename or "").lower().endswith(".pdf"):
        pdf_text = await asyncio.to_thread(_parse_pdf, raw_bytes)
    else:
        pdf_text = raw_bytes.decode("utf-8", errors="replace")

    if not pdf_text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract any text from the uploaded file.",
        )

    # 2. Pre-pass: ask gpt-4o-mini for a clean 5-to-10 word case summary so the
    #    Tavily query is meaningful rather than raw boilerplate from the PDF header.
    try:
        pre_pass = await openai_client.chat.completions.create(
            model=INIT_MODEL,
            messages=[
                {"role": "system", "content": CASE_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": pdf_text[:1500]},
            ],
            max_tokens=30,
            temperature=0,
        )
        case_summary = pre_pass.choices[0].message.content.strip()
    except Exception:
        # Non-fatal: fall back to a simple text slice if the pre-pass fails.
        case_summary = " ".join(pdf_text[:300].split())[:120]

    # 3. Run Tavily search using the high-quality case summary (non-blocking)
    tavily_query = (
        f"Recent legal precedents and cultural judicial leanings regarding "
        f"{case_summary} in {jurisdiction}"
    )
    search_results = await asyncio.to_thread(_search_tavily, tavily, tavily_query)

    # 4. Assemble context for the LLM
    context = (
        f"=== CASE DOCUMENT ===\n{pdf_text[:PDF_CHAR_LIMIT]}\n\n"
        f"=== JURISDICTIONAL RESEARCH: {jurisdiction} ===\n{search_results}"
    )

    # 5–6. Structured LLM call via instructor — auto-retries until Pydantic validates
    try:
        output: PreProcessorOutput = await llm.chat.completions.create(
            model=INIT_MODEL,
            response_model=PreProcessorOutput,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": context},
            ],
            max_tokens=4096,
            temperature=0.3,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    # 7. Return with a freshly generated simulation ID
    return SimulationInitResponse(
        simulation_id=f"SIM-{uuid.uuid4().hex[:8].upper()}",
        preprocessor_output=output,
    )


# ── GET / (health check) ─────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "Polymath API is running"}


# ── WS /ws/debate (stub — debate orchestration goes here) ────────────────────

@app.websocket("/ws/debate")
async def debate_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            _payload = json.loads(data)
            # TO-DO: trigger Modal inference and swarm logic here
            await websocket.send_text(
                json.dumps({"type": "status", "message": "Debate started..."})
            )
    except Exception as e:
        print(f"Connection closed: {e}")
