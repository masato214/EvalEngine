from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.models.embedding import EmbeddingRequest, EmbeddingResponse
from app.services.embedding_service import EmbeddingService

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_service = EmbeddingService()


@router.post("/generate", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest) -> EmbeddingResponse:
    return await _service.generate(request.text, request.model)
