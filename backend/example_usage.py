"""
Example usage of the LLM service

This file demonstrates how to use the LLM endpoints.

To run the backend server:
    cd backend
    uvicorn main:app --reload --port 8000

Then you can test the endpoints using curl or any HTTP client.
"""

# Example 1: Simple question
# curl -X POST "http://localhost:8000/api/ask" \
#      -H "Content-Type: application/json" \
#      -d '{
#         "question": "What is the capital of France?",
#         "context": "You are a helpful geography assistant."
#      }'

# Example 2: Question with custom parameters
# curl -X POST "http://localhost:8000/api/ask" \
#      -H "Content-Type: application/json" \
#      -d '{
#         "question": "Explain quantum computing in simple terms",
#         "context": "You are a patient teacher who explains complex topics simply.",
#         "model": "gpt-3.5-turbo",
#         "temperature": 0.8,
#         "max_tokens": 500
#      }'

# Example 3: Chat with conversation history
# curl -X POST "http://localhost:8000/api/chat" \
#      -H "Content-Type: application/json" \
#      -d '{
#         "messages": [
#             {"role": "system", "content": "You are a helpful coding assistant."},
#             {"role": "user", "content": "How do I create a list in Python?"},
#             {"role": "assistant", "content": "You can create a list using square brackets: my_list = [1, 2, 3]"},
#             {"role": "user", "content": "How do I add items to it?"}
#         ]
#      }'

# Python example using requests library:
"""
import requests

# Simple question
response = requests.post(
    "http://localhost:8000/api/ask",
    json={
        "question": "What is machine learning?",
        "context": "You are an AI educator."
    }
)
print(response.json())

# Chat with history
response = requests.post(
    "http://localhost:8000/api/chat",
    json={
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Tell me a fun fact about space."}
        ]
    }
)
print(response.json())
"""
