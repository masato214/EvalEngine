from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.models.similarity import SimilarityRequest, SimilarityResponse
from app.services.similarity_service import SimilarityService

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_service = SimilarityService()


@router.post("/search", response_model=SimilarityResponse)
async def similarity_search(request: SimilarityRequest) -> SimilarityResponse:
    return await _service.search(request)
