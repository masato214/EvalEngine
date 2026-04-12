from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.models.scoring import ScoringRequest, ScoringResponse
from app.services.scoring_service import ScoringService

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_service = ScoringService()


@router.post("/score-response", response_model=ScoringResponse)
async def score_response(request: ScoringRequest) -> ScoringResponse:
    return await _service.score(request)
