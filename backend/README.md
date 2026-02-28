# Backend API Documentation

This backend provides LLM query capabilities using the API key from the `.env` file.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   - Ensure the `.env` file in the root directory contains your API key:
     ```
     API_KEY=your_api_key_here
     ```

3. **Run the server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## API Endpoints

### 1. Health Check
```
  BASE_URL=https://api.keywordsai.co/api/  # Optional, defaults to Keywords AI
GET /
```
Returns the API status.

**Response:**
```json
{
  "status": "Polymath API is running"
}
```

### 2. Ask a Question
```
POST /api/ask
```
Ask a single question to the LLM.

**Request Body:**
```json
{
  "question": "What is the capital of France?",
  "context": "You are a helpful geography assistant.",  // optional
  "model": "gpt-3.5-turbo",  // optional, default: gpt-3.5-turbo
  "temperature": 0.7,  // optional, default: 0.7
  "max_tokens": 1000  // optional, default: 1000
}
```

**Response:**
```json
{
  "success": true,
  "response": "The capital of France is Paris.",
  "model": "gpt-3.5-turbo"
}
```

### 3. Chat with History
```
POST /api/chat
```
Have a conversation with the LLM using message history.

**Request Body:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"},
    {"role": "assistant", "content": "Hi! How can I help you?"},
    {"role": "user", "content": "What's the weather like?"}
  ],
  "model": "gpt-3.5-turbo",  // optional
  "temperature": 0.7,  // optional
  "max_tokens": 1000  // optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "I don't have access to real-time weather data...",
  "model": "gpt-3.5-turbo"
}
```

### 4. WebSocket Debate
```
WS /ws/debate
```
WebSocket endpoint for real-time debate functionality.

## Project Structure

```
backend/
├── main.py              # FastAPI application with endpoints
├── llm_service.py       # LLM service for querying the model
├── requirements.txt     # Python dependencies
├── example_usage.py     # Usage examples
└── README.md           # This file
```

## Environment Variables

- `API_KEY`: Your API key for the LLM provider
- `BASE_URL`: (Optional) The base URL for the LLM API. Defaults to `https://api.keywordsai.co/api/` for Keywords AI. Use `https://api.openai.com/v1/` for OpenAI directly.

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `500`: Server error (check the error message in the response)

## Development

To modify the LLM provider or add custom functionality:
1. Edit `llm_service.py` to customize LLM behavior
2. Add new endpoints in `main.py`
3. Update `requirements.txt` if adding new dependencies

## Testing

See `example_usage.py` for curl and Python examples of how to use the API.
