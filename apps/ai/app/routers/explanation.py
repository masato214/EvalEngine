from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.models.explanation import ExplanationRequest, ExplanationResponse
from app.services.explanation_service import ExplanationService

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_service = ExplanationService()


@router.post("/generate", response_model=ExplanationResponse)
async def generate_explanation(request: ExplanationRequest) -> ExplanationResponse:
    return await _service.generate(request)
