from fastapi import APIRouter, Depends
from app.core.security import verify_internal_key
from app.models.output_format import GenerateOutputRequest, GenerateOutputResponse
from app.services.output_format_service import OutputFormatService

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_service = OutputFormatService()


@router.post("/generate", response_model=GenerateOutputResponse)
async def generate_output(request: GenerateOutputRequest) -> GenerateOutputResponse:
    return await _service.generate(request)
