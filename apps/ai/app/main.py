from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.routers import embedding, analysis, similarity, scoring, explanation, output_format, suggest


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    yield


app = FastAPI(
    title="EvalEngine AI Service",
    description="AI analysis and embedding service for EvalEngine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(embedding.router, prefix="/embedding", tags=["embedding"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
app.include_router(similarity.router, prefix="/similarity", tags=["similarity"])
app.include_router(scoring.router, prefix="/scoring", tags=["scoring"])
app.include_router(explanation.router, prefix="/explanation", tags=["explanation"])
app.include_router(output_format.router, prefix="/output-format", tags=["output-format"])
app.include_router(suggest.router, prefix="/suggest", tags=["suggest"])


@app.get("/health")
async def health():
    return {"status": "ok"}
