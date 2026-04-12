from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Any


class AxisScoreForOutput(BaseModel):
    axis_name: str
    normalized_score: float   # 0.0–1.0
    rubric_level: Optional[float] = None  # 1.0–5.0
    percent: int              # 0–100


class GenerateOutputRequest(BaseModel):
    respondent_ref: str
    overall_score: float
    overall_percent: int
    axis_scores: list[AxisScoreForOutput]
    output_type: str          # TYPE_CLASSIFICATION | SKILL_GAP | TENDENCY_MAP | CUSTOM
    format_name: str
    config: Optional[Any] = None
    prompt_template: Optional[str] = None


class TypeClassificationOutput(BaseModel):
    type_label: str           # e.g. "ヒアリング特化型（提案弱い）"
    type_description: str     # 2–3行の説明
    strengths: list[str]      # 強み3–4項目
    growth_areas: list[str]   # 改善点2–3項目
    all_types_matched: list[dict]  # [{label, matched, reason}]


class SkillGapOutput(BaseModel):
    gaps: list[dict]          # [{axis, current_pct, target_pct, gap_pct, root_cause, action}]
    priority_action: str      # 最重要改善アクション
    summary: str              # 構造的なギャップ解釈


class TendencyMapOutput(BaseModel):
    pattern_label: str        # e.g. "関係構築型"
    pattern_description: str
    axis_interpretations: list[dict]  # [{axis, score, interpretation}]
    behavioral_implications: str


class CustomOutput(BaseModel):
    hiring_decision: Optional[str] = None   # ◎/○/△/×
    hiring_rationale: Optional[str] = None
    role_fits: list[dict] = []  # [{role, fit_score, reason}]
    development_plan: list[str] = []
    summary: str


class GenerateOutputResponse(BaseModel):
    output_type: str
    type_classification: Optional[TypeClassificationOutput] = None
    skill_gap: Optional[SkillGapOutput] = None
    tendency_map: Optional[TendencyMapOutput] = None
    custom: Optional[CustomOutput] = None
