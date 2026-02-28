from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import json

from llm_service import llm_service

app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class QuestionRequest(BaseModel):
    question: str
    context: Optional[str] = None
    model: Optional[str] = "gpt-3.5-turbo"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: Optional[str] = "gpt-3.5-turbo"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1000

@app.get("/")
async def root():
    return {"status": "Polymath API is running"}

@app.post("/api/ask")
async def ask_llm(request: QuestionRequest):
    """
    Ask a question to the LLM
    
    Example request:
    {
        "question": "What is the capital of France?",
        "context": "You are a helpful geography assistant.",
        "model": "gpt-3.5-turbo"
    }
    """
    try:
        response = await llm_service.ask_question(
            question=request.question,
            context=request.context,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        return {
            "success": True,
            "response": response,
            "model": request.model
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_with_llm(request: ChatRequest):
    """
    Chat with the LLM using conversation history
    
    Example request:
    {
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hi! How can I help you?"},
            {"role": "user", "content": "What's the weather like?"}
        ]
    }
    """
    try:
        response = await llm_service.ask_with_history(
            messages=request.messages,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )
        return {
            "success": True,
            "response": response,
            "model": request.model
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/debate")
async def debate_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive message from frontend
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # This is where the backend will trigger Modal and the Swarm logic
            await websocket.send_text(json.dumps({"type": "status", "message": "Debate started..."}))
            
    except Exception as e:
        print(f"Connection closed: {e}")
