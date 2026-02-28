import asyncio
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import os
import uuid
from contextlib import asynccontextmanager

import fitz  # PyMuPDF
import instructor
import modal
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from tavily import TavilyClient

from models import (
    PreProcessorOutput,
    SimulationInitResponse,
    ResearchPhaseRequest,
    ResearchPhaseResponse,
    BriefingDocument,
)

load_dotenv()

# ── Constants ────────────────────────────────────────────────────────────────

INIT_MODEL = "gpt-4o-mini"
PDF_CHAR_LIMIT = 8_000
TAVILY_MAX_RESULTS = 5

SYSTEM_PROMPT = """\
You are a senior judicial analyst preparing a multi-agent adversarial legal simulation.

The simulation jurisdiction is: {jurisdiction}

Given a case document and jurisdictional research, produce:
  1. A dense 3-sentence summary of the core facts.
  2. The most relevant legal precedents surfaced by the web search.
  3. Geographic and demographic biases specific to {jurisdiction} — NOT the location named
     in the case document — that would influence a jury in this type of case.
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
                {"role": "system", "content": SYSTEM_PROMPT.format(jurisdiction=jurisdiction)},
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
        **output.model_dump(),
    )


# ── POST /api/v1/simulation/{sim_id}/research ────────────────────────────────

@app.post("/api/v1/simulation/{sim_id}/research", response_model=ResearchPhaseResponse)
async def execute_research_phase(
    sim_id: str,
    request: ResearchPhaseRequest,
) -> ResearchPhaseResponse:
    """Dispatch all agent personas to Modal in parallel via .map() and collect
    their Internal Legal Briefing Documents.

    Modal's .map() is synchronous and blocking, so it runs in a thread pool to
    avoid freezing the event loop during GPU inference.
    """
    def _run_modal_research() -> list[dict]:
        # from_name() is the Modal v1.x API — Cls.lookup() was removed in v1.0.
        AgentEngine = modal.Cls.from_name("polymath-legal-fleet", "LegalAgentEngine")
        engine = AgentEngine()

        # .map() fans out one call per persona dict concurrently across Modal
        # workers, then yields results as each finishes. list() blocks until all
        # are complete.
        return list(
            engine.execute_research_phase.map(
                [p.model_dump() for p in request.personas],
                kwargs={"core_facts": request.core_facts},
            )
        )

    try:
        raw_results: list[dict] = await asyncio.to_thread(_run_modal_research)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Modal inference failed: {exc}",
        )

    return ResearchPhaseResponse(
        sim_id=sim_id,
        briefings=[BriefingDocument(**r) for r in raw_results],
    )


# ── GET / (health check) ─────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "Polymath API is running"}


# ── WS /ws/debate ─────────────────────────────────────────────────────────────
#
# Expected client payload (single JSON message on connect):
# {
#   "personas":  [{"id": str, "label": str, "system_prompt": str, ...}, ...],
#   "briefings": [{"agent_id": str, "briefing_doc": str}, ...]
# }
#
# Frame types sent to the client:
#   {"type": "status",         "message": str}
#   {"type": "turn_start",     "agent_id": str, "round": int}
#   {"type": "chunk",          "agent_id": str, "content": str}
#   {"type": "turn_end",       "agent_id": str}
#   {"type": "debate_complete"}
#   {"type": "error",          "message": str}

DEBATE_ROUNDS = 3

@app.websocket("/ws/debate")
async def debate_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        # ── 1. Receive debate configuration ──────────────────────────────────
        raw = await websocket.receive_text()
        payload = json.loads(raw)

        personas: list[dict] = payload["personas"]
        briefings: dict[str, str] = {
            b["agent_id"]: b["briefing_doc"]
            for b in payload["briefings"]
        }

        await websocket.send_json(
            {"type": "status", "message": "Connecting to Modal inference fleet..."}
        )

        # ── 2. Resolve the Modal class — from_name() is the Modal v1.x API ─────
        AgentEngine = await asyncio.to_thread(
            modal.Cls.from_name, "polymath-legal-fleet", "LegalAgentEngine"
        )
        engine = AgentEngine()

        await websocket.send_json(
            {"type": "status", "message": f"Debate starting — {DEBATE_ROUNDS} rounds, {len(personas)} agents."}
        )

        # ── 3. Debate loop ────────────────────────────────────────────────────
        debate_history: list[dict] = []

        for round_num in range(1, DEBATE_ROUNDS + 1):
            await websocket.send_json(
                {"type": "status", "message": f"Round {round_num} of {DEBATE_ROUNDS}"}
            )

            for persona in personas:
                agent_id: str = persona["id"]
                briefing_doc: str = briefings.get(agent_id, "")

                await websocket.send_json(
                    {"type": "turn_start", "agent_id": agent_id, "round": round_num}
                )

                # remote_gen() is a synchronous generator — iterate it in a
                # thread pool so the event loop stays free for other coroutines.
                # We pass a snapshot copy of debate_history to avoid race
                # conditions if anything mutates it while the thread runs.
                history_snapshot = list(debate_history)
                chunks: list[str] = await asyncio.to_thread(
                    list,
                    engine.generate_debate_turn.remote_gen(
                        persona, briefing_doc, history_snapshot
                    ),
                )

                # Stream the collected chunks to the frontend one by one.
                full_response = ""
                for chunk in chunks:
                    await websocket.send_json(
                        {"type": "chunk", "agent_id": agent_id, "content": chunk}
                    )
                    full_response += chunk

                # Append completed turn to history for subsequent agents to read.
                debate_history.append({
                    "agent_id": agent_id,
                    "label": persona.get("label", agent_id),
                    "content": full_response.strip(),
                })

                await websocket.send_json({"type": "turn_end", "agent_id": agent_id})

        # ── 4. Signal completion ──────────────────────────────────────────────
        await websocket.send_json({"type": "debate_complete"})

    except Exception as exc:
        print(f"WebSocket debate error: {exc}")
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass  # client already disconnected
