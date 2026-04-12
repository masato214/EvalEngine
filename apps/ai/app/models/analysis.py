from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Literal


class TextAnalysisRequest(BaseModel):
    text: str
    axis_context: Optional[str] = None
    criteria: Optional[list[str]] = None


class TextAnalysisResponse(BaseModel):
    score: float
    sentiment: Literal["positive", "neutral", "negative"]
    keywords: list[str]
    summary: str
    tendency: str
