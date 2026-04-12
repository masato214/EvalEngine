from __future__ import annotations
import numpy as np
from app.models.similarity import SimilarityRequest, SimilarityResponse, SimilarityResult


class SimilarityService:
    """
    Computes cosine similarity between a query embedding and stored embeddings.
    In production, this would query pgvector directly via asyncpg.
    For now, returns empty results (embeddings are stored in DB by NestJS).
    """

    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        va = np.array(a, dtype=np.float32)
        vb = np.array(b, dtype=np.float32)
        norm_a = np.linalg.norm(va)
        norm_b = np.linalg.norm(vb)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(va, vb) / (norm_a * norm_b))

    async def search(self, request: SimilarityRequest) -> SimilarityResponse:
        # TODO: Query embeddings table via asyncpg for model_id + tenant_id
        # and return top-k most similar by cosine similarity
        return SimilarityResponse(results=[])
