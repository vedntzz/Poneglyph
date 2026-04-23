"""Poneglyph backend — FastAPI service for the multi-agent system.

Session 001: single endpoint (POST /api/hello-agent) that sends a user
message to Opus 4.7 and returns the response. This validates the full
stack round-trip before any real agent logic is added.
"""

from __future__ import annotations

import os
from typing import Any

import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Poneglyph",
    description="Multi-agent institutional memory for development projects",
    version="0.1.0",
)

# CORS: allow the Next.js frontend in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────────────────────

class HelloAgentRequest(BaseModel):
    """User message to send to Opus 4.7."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The user's message to send to the agent.",
    )


class HelloAgentResponse(BaseModel):
    """Response from Opus 4.7."""

    reply: str = Field(description="The model's text response.")
    model: str = Field(description="The model ID that generated the response.")
    usage: dict[str, Any] = Field(description="Token usage for this request.")


# ─────────────────────────────────────────────────────────────
# Anthropic client
# ─────────────────────────────────────────────────────────────

def get_anthropic_client() -> anthropic.Anthropic:
    """Create an Anthropic client using the ANTHROPIC_API_KEY env var.

    Raises:
        ValueError: if the API key is not set.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "Set it in your shell or in a .env file."
        )
    return anthropic.Anthropic(api_key=api_key)


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Simple health check for the backend."""
    return {"status": "ok"}


@app.post("/api/hello-agent", response_model=HelloAgentResponse)
def hello_agent(request: HelloAgentRequest) -> HelloAgentResponse:
    """Send a message to Opus 4.7 and return the response.

    Uses adaptive thinking and high effort. Does NOT set temperature,
    top_p, or top_k — they return 400 on Opus 4.7.
    See CLAUDE.md § Model parameters.

    Args:
        request: The user's message wrapped in a HelloAgentRequest.

    Returns:
        HelloAgentResponse with the model's reply and usage stats.

    Raises:
        HTTPException: on Anthropic API errors.
    """
    try:
        client = get_anthropic_client()

        # Opus 4.7 call with adaptive thinking — see CAPABILITIES.md
        # No temperature/top_p/top_k: they return 400 on 4.7
        response = client.messages.create(
            model="claude-opus-4-7-20250415",
            max_tokens=4096,
            thinking={
                "type": "enabled",
                "budget_tokens": 2048,
            },
            messages=[
                {"role": "user", "content": request.message},
            ],
        )

        # Extract text from response content blocks
        reply_text = ""
        for block in response.content:
            if block.type == "text":
                reply_text += block.text

        return HelloAgentResponse(
            reply=reply_text,
            model=response.model,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )

    except anthropic.APIError as e:
        raise HTTPException(
            status_code=e.status_code if hasattr(e, "status_code") else 500,
            detail=f"Anthropic API error: {e.message if hasattr(e, 'message') else str(e)}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
