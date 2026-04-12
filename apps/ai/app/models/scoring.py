from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Any


class RubricLevelInfo(BaseModel):
    level: int                        # 1–5
    label: Optional[str] = None       # e.g. "エキスパート"
    description: Optional[str] = None # full rubric description text
    embedding: Optional[list[float]] = None


class AxisScoringInfo(BaseModel):
    id: str
    name: str
    weight: float
    rubric_levels: list[RubricLevelInfo] = []
    ideal_embedding: Optional[list[float]] = None
    low_embedding: Optional[list[float]] = None


class AxisMappingInfo(BaseModel):
    axis_id: str
    contribution_weight: float


class ScoringItem(BaseModel):
    question_id: str
    question_type: str              # SINGLE_CHOICE | MULTIPLE_CHOICE | SCALE | FREE_TEXT
    value: Any
    embedding: Optional[list[float]] = None              # FREE_TEXT answer embedding
    selected_option_embeddings: Optional[list[list[float]]] = None  # choice option embeddings
    selected_option_labels: list[str] = []               # display labels for selected options
    exclusive_option_selected: bool = False              # "not using any tool" style option detected
    scale_min: Optional[int] = None
    scale_max: Optional[int] = None
    axis_mappings: list[AxisMappingInfo] = []


class ScoringRequest(BaseModel):
    model_id: str
    tenant_id: str
    answer_id: str
    items: list[ScoringItem]
    axes: list[AxisScoringInfo]


# ─── Score Detail ─────────────────────────────────────────────────────────────

class RubricSimilarity(BaseModel):
    """Cosine similarity of the answer vector to one rubric level anchor."""
    level: int
    label: Optional[str] = None
    similarity: float               # raw cosine similarity
    normalized: float               # (sim - min) / range  → 0–1
    sharpened: float                # normalized^2
    weight: float                   # sharpened / sum(sharpened) → contribution


class ScoreDetail(BaseModel):
    """
    Full internal scoring mechanics for one (question, axis) pair.
    Shown in the "詳細を見る" panel in the test-run UI.
    """
    score_method: str  # "llm_primary" | "embedding_rubric" | "scale_linear" | "fallback_zero" | "exclusive_zero"

    # ── For SINGLE/MULTIPLE_CHOICE ──────────────────────────────────────────
    selected_option_labels: list[str] = []
    exclusive_option_selected: bool = False
    exclusive_filtered: bool = False   # True if exclusive was present but filtered out

    # ── Embedding rubric scoring (CHOICE + FREE_TEXT fallback) ──────────────
    rubric_similarities: list[RubricSimilarity] = []
    mean_cos: Optional[float] = None     # mean cosine to all rubric anchors
    max_cos: Optional[float] = None
    quality_score: Optional[float] = None    # weighted average level before gating
    relevance_score: Optional[float] = None  # FREE_TEXT fallback: relevance multiplier

    # ── FREE_TEXT LLM scoring ───────────────────────────────────────────────
    llm_level: Optional[float] = None       # LLM assigned level 0–5
    llm_is_relevant: Optional[bool] = None
    llm_rationale: Optional[str] = None
    llm_embedding_correction: Optional[float] = None  # correction factor (if < 1.0, penalty applied)

    # ── SCALE ───────────────────────────────────────────────────────────────
    raw_value: Optional[float] = None
    scale_min: Optional[float] = None
    scale_max: Optional[float] = None


# ─── Results ─────────────────────────────────────────────────────────────────

class AxisScoreResult(BaseModel):
    axis_id: str
    raw_score: float
    normalized_score: float
    rubric_level: Optional[float] = None  # continuous 1.0–5.0
    tendency: str


class ItemScoreResult(BaseModel):
    question_id: str
    axis_id: str
    raw_score: float
    rubric_level: Optional[float] = None
    question_type: Optional[str] = None
    detail: Optional[ScoreDetail] = None  # full internal mechanics


class ScoringResponse(BaseModel):
    overall_score: float
    axis_scores: list[AxisScoreResult]
    item_scores: list[ItemScoreResult] = []
