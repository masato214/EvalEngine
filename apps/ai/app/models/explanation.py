from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class AxisScoreInput(BaseModel):
    axis_name: str
    normalized_score: float    # 0.0〜1.0
    rubric_level: Optional[float] = None  # 1.0〜5.0


class ExplanationRequest(BaseModel):
    respondent_ref: str
    axis_scores: list[AxisScoreInput]
    overall_score: float
    result_type: Optional[str] = None
    prompt_template: Optional[str] = None  # ResultTemplateの追加指示
    language: str = "ja"


class ExplanationResponse(BaseModel):
    explanation: str
    recommendations: list[str]
