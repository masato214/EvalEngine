from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class SimilarityRequest(BaseModel):
    embedding: list[float]
    top_k: int = 5
    model_id: str
    tenant_id: str


class SimilarityResult(BaseModel):
    respondent_ref: str
    similarity: float
    result_id: str


class SimilarityResponse(BaseModel):
    results: list[SimilarityResult]
