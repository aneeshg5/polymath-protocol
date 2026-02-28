import os
from dotenv import load_dotenv
from openai import OpenAI
from typing import Optional, List, Dict

# Load environment variables from .env file
load_dotenv()

class LLMService:
    """Service for querying LLM with the API key from .env"""
    
    def __init__(self):
        self.api_key = os.getenv("API_KEY")
        if not self.api_key:
            raise ValueError("API_KEY not found in .env file")
        
        # Get base URL from env, default to Keywords AI
        base_url = os.getenv("BASE_URL", "https://api.keywordsai.co/api/")
        
        # Initialize OpenAI-compatible client
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=base_url
        )
    
    async def ask_question(
        self, 
        question: str, 
        context: Optional[str] = None,
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> str:
        """
        Ask a question to the LLM
        
        Args:
            question: The question to ask
            context: Optional context to provide with the question
            model: The model to use (default: gpt-3.5-turbo)
            temperature: Temperature for response randomness (0-1)
            max_tokens: Maximum tokens in response
            
        Returns:
            The LLM's response as a string
        """
        try:
            messages = []
            
            if context:
                messages.append({
                    "role": "system",
                    "content": context
                })
            
            messages.append({
                "role": "user",
                "content": question
            })
            
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"Error querying LLM: {str(e)}")
    
    async def ask_with_history(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> str:
        """
        Ask a question with conversation history
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: The model to use
            temperature: Temperature for response randomness
            max_tokens: Maximum tokens in response
            
        Returns:
            The LLM's response as a string
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"Error querying LLM: {str(e)}")

# Global instance
llm_service = LLMService()
