from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.models.analysis import TextAnalysisRequest, TextAnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_service = AnalysisService()


@router.post("/text", response_model=TextAnalysisResponse)
async def analyze_text(request: TextAnalysisRequest) -> TextAnalysisResponse:
    return await _service.analyze(request)
