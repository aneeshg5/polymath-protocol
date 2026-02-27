# The Polymath Protocol 🧠⚔️

## 📁 Repository Structure

This is a monorepo containing three distinct environments. **Make sure you are in the correct directory before running any commands.**

- `/frontend` - Next.js/React app with Tailwind (The Swarm UI)
- `/backend` - FastAPI server (The Orchestrator, WebSockets, & Judge API)
- `/modal_inference` - Modal serverless GPU code (The Open-Source LLMs)

---

## 🚀 How to Run the Environments

### 1. Frontend (Next.js)
Your UI development zone. Put v0 components in `src/components`.

# Navigate to the directory
cd frontend

# Install dependencies (only needed the first time)
npm install

# Start the development server
npm run dev

### 2. Backend (FastAPI)

# Navigate to the directory
cd backend

# Create a virtual environment (only needed the first time)
python -m venv venv

# Activate the virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server with auto-reload
uvicorn main:app --reload

### 3. Modal Inference

# Navigate to the directory
cd modal_inference

# Create a virtual environment (only needed the first time)
python -m venv venv

# Activate the virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Authenticate with Modal (you only need to do this once)
modal setup

# Run the test script to ensure it reaches the cloud GPUs
modal run inference.py
