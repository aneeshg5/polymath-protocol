# The Polymath Protocol 🧠⚔️

## 📁 Repository Structure

This is a monorepo containing three distinct environments. **Make sure you are in the correct directory before running any commands.**

- `/frontend` - Next.js/React app with Tailwind (The Swarm UI)
- `/backend` - FastAPI server (The Orchestrator, WebSockets, & Judge API)
- `/modal_inference` - Modal serverless GPU code (The Open-Source LLMs)

---

## 🛠️ Built With

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion, Recharts |
| **Backend** | Python, FastAPI, WebSockets, Pydantic v2, Uvicorn, Cursor / Copilot |
| **LLM Inference** | Modal Labs (serverless A10G GPUs), vLLM, Llama 3 8B Instruct |
| **AI / Orchestration** | OpenAI GPT-4o (Final Arbiter), GPT-4o-mini (Live Arbiter + preprocessing), OpenAI Structured Outputs, `instructor` |
| **Search** | Tavily API (legal precedent retrieval) |
| **PDF Parsing** | PyMuPDF (fitz) |

---

## 🚀 How to Run the Environments

### 1. Frontend (Next.js)
Your UI development zone. Put v0 components in `src/components`.

# Navigate to the directory
```bash
cd frontend
```

### Install dependencies (only needed the first time)
```bash
npm install
```

### Start the development server
```bash
npm run dev
```

### 2. Backend (FastAPI)

### Navigate to the directory
```bash
cd backend
```

### Create a virtual environment (only needed the first time)
```bash
python -m venv venv
```

### Activate the virtual environment
### On Mac/Linux:
```bash
source venv/bin/activate
```
### On Windows:
```bash
venv\Scripts\activate
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Run the server with auto-reload
```bash
uvicorn main:app --reload
```

### 3. Modal Inference

### Navigate to the directory
```bash
cd modal_inference
```

### Create a virtual environment (only needed the first time)
```bash
python -m venv venv
```

### Activate the virtual environment
### On Mac/Linux:
```bash
source venv/bin/activate
```
### On Windows:
```bash
venv\Scripts\activate
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Authenticate with Modal (you only need to do this once)
```bash
modal setup
```

### Run the test script to ensure it reaches the cloud GPUs
```bash
modal run inference.py
```
