from fastapi import Header, HTTPException, status
from app.core.config import settings


async def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != settings.ai_internal_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal API key",
        )
