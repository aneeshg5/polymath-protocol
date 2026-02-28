import modal
import asyncio
import json
from typing import Dict, List

app = modal.App("polymath-debate-agents")

# Create a Modal image with required dependencies
image = modal.Image.debian_slim().pip_install("openai", "python-dotenv")


@app.function(image=image)
async def query_llm_agent(question: str, api_key: str, base_url: str, context: str = None, agent_id: str = "agent_1") -> Dict:
    """
    Query the Keywords AI LLM service with a specific question
    
    Args:
        question: The question to ask
        api_key: API key for LLM service
        base_url: Base URL for LLM service
        context: Optional system context/role
        agent_id: Identifier for the agent
        
    Returns:
        Dictionary with agent_id, question, and response
    """
    from openai import OpenAI
    
    print(f"[{agent_id}] Processing question: {question}")
    
    try:
        if not api_key:
            raise ValueError("API_KEY not provided")
        
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
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
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )
        
        return {
            "agent_id": agent_id,
            "question": question,
            "response": response.choices[0].message.content,
            "status": "success"
        }
    except Exception as e:
        print(f"[{agent_id}] Error: {str(e)}")
        return {
            "agent_id": agent_id,
            "question": question,
            "response": None,
            "status": "error",
            "error": str(e)
        }


@app.function()
def multiple_parallel_queries(queries: List[Dict[str, str]], api_key: str, base_url: str) -> List[Dict]:
    """
    Execute multiple queries in parallel using different agents
    
    Args:
        queries: List of dicts with 'question' and optional 'context' keys
        api_key: API key for LLM service
        base_url: Base URL for LLM service
        
    Returns:
        List of responses from all agents
    """
    results = []
    
    for idx, query in enumerate(queries):
        agent_id = f"agent_{idx + 1}"
        question = query.get("question", "")
        context = query.get("context", None)
        
        # Call remote Modal function for each query
        result = query_llm_agent.remote(question, api_key, base_url, context, agent_id)
        results.append(result)
    
    return results


@app.local_entrypoint()
def main():
    """
    Main entry point: Generate multiple queries and get responses from agents
    """
    import os
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    # Get API credentials from environment
    api_key = os.getenv("API_KEY")
    base_url = os.getenv("BASE_URL", "https://api.keywordsai.co/api/")
    
    if not api_key:
        raise ValueError("API_KEY not found in .env file")
    
    print("Starting Polymath Debate Agents...")
    
    # Define multiple debate queries
    debate_queries = [
        {
            "question": "What are the main advantages of renewable energy sources?",
            "context": "You are an environmental scientist arguing FOR renewable energy adoption."
        },
        {
            "question": "What are the practical challenges in transitioning to renewable energy?",
            "context": "You are an energy economist presenting practical concerns about renewable energy implementation."
        },
        {
            "question": "How can society balance economic growth with environmental sustainability?",
            "context": "You are a policy expert seeking to synthesize different viewpoints on this complex issue."
        },
        {
            "question": "What role should government play in promoting clean energy?",
            "context": "You are a political analyst examining the role of government intervention in energy markets."
        },
        {
            "question": "What emerging technologies could accelerate the energy transition?",
            "context": "You are a technology innovation expert focused on breakthrough solutions in clean energy."
        }
    ]
    
    print(f"\nQuerying {len(debate_queries)} agents with different perspectives...\n")
    
    # Execute all queries and collect responses
    results = multiple_parallel_queries.remote(debate_queries, api_key, base_url)
    
    # Display results
    print("\n" + "="*80)
    print("DEBATE RESPONSES FROM ALL AGENTS")
    print("="*80 + "\n")
    
    for idx, result in enumerate(results, 1):
        print(f"\n[AGENT {idx}: {result['agent_id'].upper()}]")
        print(f"Question: {result['question']}")
        print(f"Status: {result['status'].upper()}")
        
        if result['status'] == 'success':
            print(f"\nResponse:\n{result['response']}")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}")
        
        print("\n" + "-"*80)
    
    # Summary
    successful = sum(1 for r in results if r['status'] == 'success')
    failed = len(results) - successful
    
    print(f"\n\nSUMMARY")
    print(f"Total queries: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    
    # Return results as JSON for further processing
    return {
        "total_queries": len(results),
        "successful": successful,
        "failed": failed,
        "results": results
    }
