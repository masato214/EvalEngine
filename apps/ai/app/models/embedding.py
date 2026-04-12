from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class EmbeddingRequest(BaseModel):
    text: str
    model: Optional[str] = None


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    model: str
    tokens_used: int
