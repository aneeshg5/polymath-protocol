from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "Polymath API is running"}

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
