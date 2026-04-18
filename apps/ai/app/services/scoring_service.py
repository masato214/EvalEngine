from __future__ import annotations
import asyncio
import json
import math
from collections import defaultdict

from openai import AsyncOpenAI
from app.core.config import settings
from app.models.scoring import (
    ScoringRequest,
    ScoringResponse,
    ScoringItem,
    AxisScoringInfo,
    AxisScoreResult,
    ItemScoreResult,
    RubricSimilarity,
    ScoreDetail,
)

# ─────────────────────────────────────────────────────────────────────────────
# Vector utilities
# ─────────────────────────────────────────────────────────────────────────────

def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def _cosine(a: list[float], b: list[float]) -> float:
    na, nb = _norm(a), _norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return max(0.0, _dot(a, b) / (na * nb))


def _average_embeddings(vecs: list[list[float]]) -> list[float]:
    if not vecs:
        return []
    dim = len(vecs[0])
    result = [0.0] * dim
    for v in vecs:
        for i, x in enumerate(v):
            result[i] += x
    n = len(vecs)
    return [x / n for x in result]


# ─────────────────────────────────────────────────────────────────────────────
# Embedding-based rubric scoring (CHOICE / SCALE / FREE_TEXT fallback)
# ─────────────────────────────────────────────────────────────────────────────

def _score_by_rubric_anchors(
    answer_vec: list[float],
    rubric_levels: list,
    question_type: str = "FREE_TEXT",
) -> tuple[float, float, ScoreDetail]:
    """
    Position answer_vec along the 1–5 rubric scale using cosine similarity.

    PRIMARY USE: SINGLE/MULTIPLE_CHOICE
    For FREE_TEXT: FALLBACK only (when no rubric descriptions for LLM).

    Why 30% can happen for "good" option selections:
      - Option embeddings encode TOOL NAMES (e.g. "CRM tool")
      - Rubric embeddings encode ABILITY DESCRIPTIONS (e.g. "systematically manages priorities")
      - These live in different vector neighborhoods → low cosine = low score
      - Fix: set option `text` field to describe the ABILITY this option implies

    Algorithm:
      1. Cosine similarity to each Lv1–5 rubric anchor
      2. Relative normalization (amplify inter-level differences)
      3. Sharpen (^2) to reward best-matching level
      4. Weighted average → continuous rubric level 1–5
      5. FREE_TEXT: multiply by relevance gate (mean_cos based)
    """
    sims: list[tuple[int, float, str | None]] = []  # (level, sim, label)
    for rl in rubric_levels:
        if rl.embedding:
            sim = _cosine(answer_vec, rl.embedding)
            sims.append((rl.level, sim, rl.label))

    if not sims:
        return 0.0, 1.0, ScoreDetail(score_method="fallback_zero")

    sims_vals = [s for _, s, _ in sims]
    mean_cos = sum(sims_vals) / len(sims_vals)
    max_cos = max(sims_vals)
    min_s = min(sims_vals)
    range_s = max_cos - min_s

    # ── Relative normalized weights ────────────────────────────────────────
    rubric_sim_details: list[RubricSimilarity] = []
    if range_s < 1e-6:
        # All levels equidistant → no signal → default to Lv3
        quality_level = 3.0
        for lv, sim, lbl in sims:
            rubric_sim_details.append(RubricSimilarity(
                level=lv, label=lbl, similarity=round(sim, 4),
                normalized=0.2, sharpened=0.04, weight=1.0 / len(sims),
            ))
    else:
        normed = [(lv, (sim - min_s) / range_s, sim, lbl) for lv, sim, lbl in sims]
        sharpened = [(lv, n ** 2, raw, lbl) for lv, n, raw, lbl in normed]
        total = sum(s for _, s, _, _ in sharpened)
        if total == 0:
            quality_level = 3.0
        else:
            quality_level = sum(lv * s for lv, s, _, _ in sharpened) / total
        for (lv, norm, raw, lbl), (_, sharp, _, _) in zip(normed, sharpened):
            rubric_sim_details.append(RubricSimilarity(
                level=lv, label=lbl, similarity=round(raw, 4),
                normalized=round(norm, 4), sharpened=round(sharp, 4),
                weight=round(sharp / total, 4) if total > 0 else 0.0,
            ))

    quality_score = max(0.0, min(1.0, (quality_level - 1.0) / 4.0))

    # ── Relevance gating (FREE_TEXT fallback only) ─────────────────────────
    #
    # Observed mean_cosine ranges (Japanese, text-embedding-3-small):
    #   Pure noise ("hello world"):              mean_cos ≈ 0.10–0.15
    #   Off-topic JP ("テスト"):                 mean_cos ≈ 0.25–0.27
    #   Vague claim ("ヒアリングが得意"):         mean_cos ≈ 0.28–0.31
    #   Medium answer (2–3 sentence, on-topic):  mean_cos ≈ 0.40–0.50
    #   Expert answer (long, specific):          mean_cos ≈ 0.38–0.50
    #
    # For CHOICE: no gating — options are always on-topic by definition
    relevance_score: float | None = None
    if question_type.upper() == "FREE_TEXT":
        FLOOR = 0.30
        CEIL = 0.40
        relevance_score = max(0.0, min(1.0, (mean_cos - FLOOR) / (CEIL - FLOOR)))
        final_score = relevance_score * quality_score
    else:
        final_score = quality_score

    final_level = 1.0 + final_score * 4.0

    detail = ScoreDetail(
        score_method="embedding_rubric",
        rubric_similarities=sorted(rubric_sim_details, key=lambda r: r.level),
        mean_cos=round(mean_cos, 4),
        max_cos=round(max_cos, 4),
        quality_score=round(quality_score, 4),
        relevance_score=round(relevance_score, 4) if relevance_score is not None else None,
    )
    return final_score, final_level, detail


def _score_by_ideal_low(
    answer_vec: list[float],
    ideal_vec: list[float],
    low_vec: list[float],
) -> float:
    sim_ideal = _cosine(answer_vec, ideal_vec)
    sim_low = _cosine(answer_vec, low_vec)
    total = sim_ideal + sim_low
    if total == 0:
        return 0.0
    return sim_ideal / total


def _score_item_sync(
    item: ScoringItem,
    axis: AxisScoringInfo,
) -> tuple[float, float | None, ScoreDetail]:
    """
    Synchronous scoring for SCALE and CHOICE question types.
    Returns (normalized_score 0–1, rubric_level 1–5 or None, detail).
    """
    q_type = item.question_type.upper()

    # ── SCALE ──────────────────────────────────────────────────────────────
    if q_type == "SCALE":
        try:
            val = float(item.value)  # type: ignore[arg-type]
            lo = float(item.scale_min or 1)
            hi = float(item.scale_max or 5)
            normalized = (val - lo) / (hi - lo) if hi != lo else 0.5
            rubric = 1.0 + normalized * 4.0
            detail = ScoreDetail(
                score_method="scale_linear",
                raw_value=val,
                scale_min=lo,
                scale_max=hi,
            )
            return normalized, rubric, detail
        except (TypeError, ValueError):
            return 0.0, 1.0, ScoreDetail(score_method="fallback_zero")

    # ── SINGLE_CHOICE / MULTIPLE_CHOICE ────────────────────────────────────
    if q_type in ("SINGLE_CHOICE", "MULTIPLE_CHOICE"):
        base_detail = ScoreDetail(
            score_method="embedding_rubric",
            selected_option_labels=item.selected_option_labels,
            selected_option_scores=item.selected_option_scores,
            exclusive_option_selected=item.exclusive_option_selected,
        )

        if item.selected_option_scores:
            valid_scores = [max(0.0, min(1.0, float(s))) for s in item.selected_option_scores]
            if valid_scores:
                normalized = sum(valid_scores) / len(valid_scores)
                rubric = 1.0 + normalized * 4.0
                base_detail.score_method = "explicit_option_weight"
                base_detail.quality_score = round(normalized, 4)
                return normalized, rubric, base_detail

        # Exclusive-only selected → score 0
        if item.exclusive_option_selected and not item.selected_option_embeddings:
            base_detail.score_method = "exclusive_zero"
            return 0.0, 1.0, base_detail

        answer_vec: list[float] | None = None
        if item.selected_option_embeddings:
            answer_vec = _average_embeddings(item.selected_option_embeddings)

        if not answer_vec:
            return 0.0, 1.0, ScoreDetail(score_method="fallback_zero", selected_option_labels=item.selected_option_labels)

        if axis.rubric_levels:
            score, level, detail = _score_by_rubric_anchors(answer_vec, axis.rubric_levels, q_type)
            detail.selected_option_labels = item.selected_option_labels
            detail.exclusive_option_selected = item.exclusive_option_selected
            if item.exclusive_option_selected:
                detail.exclusive_filtered = True
            return score, level, detail

        if axis.ideal_embedding and axis.low_embedding:
            norm = _score_by_ideal_low(answer_vec, axis.ideal_embedding, axis.low_embedding)
            return norm, 1.0 + norm * 4.0, ScoreDetail(
                score_method="embedding_rubric",
                selected_option_labels=item.selected_option_labels,
            )

        if axis.ideal_embedding:
            norm = _cosine(answer_vec, axis.ideal_embedding)
            return norm, None, ScoreDetail(
                score_method="embedding_rubric",
                selected_option_labels=item.selected_option_labels,
            )

    return 0.0, 1.0, ScoreDetail(score_method="fallback_zero")


def _tendency(score: float) -> str:
    if score >= 0.8:
        return "very_high"
    elif score >= 0.6:
        return "high"
    elif score >= 0.4:
        return "moderate"
    elif score >= 0.2:
        return "low"
    else:
        return "very_low"


# ─────────────────────────────────────────────────────────────────────────────
# LLM scoring prompt for FREE_TEXT
# ─────────────────────────────────────────────────────────────────────────────

_FREE_TEXT_EVAL_PROMPT = """\
あなたは人材評価の専門家です。以下の評価軸と評価基準（Lv1〜5）を用いて、回答者の自由記述回答を評価してください。

## 評価軸
{axis_name}

## 評価基準（Lv1〜5）
{rubric_text}

## 回答者の回答
{answer_text}

## 評価手順
1. 回答が評価軸に関連しているかを判断する（関連性チェック）
2. 関連があれば、回答の内容を評価基準と照らし合わせてレベルを判定する
3. レベルは1.0〜5.0の小数で表す（例：2.8、3.5、4.2）
4. 判断根拠を1〜2文で示す

## 重要な判断基準
- 回答が評価軸と無関係（「テスト」「無回答」等）→ is_relevant: false, level: 0
- 行動・経験の具体性が高い → 高スコア
- 曖昧な主張のみ（「得意です」等、証拠なし）→ Lv1〜2程度
- 基本的な行動を説明 → Lv2〜3
- 具体的な経験・工夫を説明 → Lv3〜4
- 高度な実践と成果・パターン認識を説明 → Lv4〜5

JSON形式で回答してください:
{{
  "level": <0または1.0〜5.0の数値>,
  "is_relevant": <true/false>,
  "rationale": "<判断根拠 1〜2文>"
}}"""


# ─────────────────────────────────────────────────────────────────────────────
# Scoring service
# ─────────────────────────────────────────────────────────────────────────────

class ScoringService:
    """
    Hybrid scoring engine: LLM evaluation (primary) + embedding (auxiliary).

    Score pipeline per question type:
      FREE_TEXT:           LLM evaluates Lv1–5 directly (primary)
                           Embedding validates relevance (auxiliary / correction)
      SINGLE/MULTI_CHOICE: Embedding cosine vs rubric level embeddings
                           Exclusive option ("none") handled before scoring
      SCALE:               Linear normalization from scale range to 0–1

    Why MULTIPLE_CHOICE can score low even with "good" options:
      The option embedding encodes the TOOL NAME ("CRM tool"), but the rubric
      embedding encodes the ABILITY ("systematically manages priorities").
      These are different semantic neighborhoods → low cosine → low score.
      Fix: set each option's `text` field to describe the ABILITY the option implies,
      not just the tool name. e.g. "CRM/SFAツールで案件管理" → text = "デジタルツールを
      活用して案件を体系的に管理しており、優先度とスケジュールを明確に把握している"
    """

    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    # ── LLM scoring for FREE_TEXT ─────────────────────────────────────────

    async def _score_free_text_llm(
        self,
        answer_text: str,
        axis: AxisScoringInfo,
        answer_vec: list[float] | None,
    ) -> tuple[float, float, ScoreDetail]:
        """
        LLM-primary scoring for free-text answers.

        1. Embedding pre-check: mean_cos < 0.20 → obvious noise → skip LLM, return 0
        2. LLM evaluates answer against Lv1–5 rubric descriptions
        3. Embedding post-check: if LLM gives high score but embedding shows low relevance
           (mean_cos < 0.30), apply soft correction factor

        Returns (normalized_score 0–1, rubric_level 1.0–5.0, detail).
        """
        detail = ScoreDetail(score_method="llm_primary")

        # ── Step 1: Embedding pre-check ────────────────────────────────────
        embedding_mean_cos: float | None = None
        if answer_vec and axis.rubric_levels:
            sims = [_cosine(answer_vec, rl.embedding)
                    for rl in axis.rubric_levels if rl.embedding]
            if sims:
                embedding_mean_cos = round(sum(sims) / len(sims), 4)
                detail.mean_cos = embedding_mean_cos
                if embedding_mean_cos < 0.20:
                    # Clear noise floor — skip LLM
                    detail.llm_is_relevant = False
                    detail.llm_rationale = "埋め込みベクトルの類似度が非常に低く（mean_cos < 0.20）、明らかに無関係な回答と判断しLLM評価をスキップしました。"
                    return 0.0, 1.0, detail

        # ── Step 2: Build rubric text ──────────────────────────────────────
        rubric_lines = []
        for rl in sorted(axis.rubric_levels, key=lambda r: r.level):
            label_part = f"（{rl.label}）" if rl.label else ""
            desc_part = rl.description or ""
            if label_part or desc_part:
                rubric_lines.append(f"Lv{rl.level}{label_part}: {desc_part}")

        # ── Step 3: LLM evaluation ─────────────────────────────────────────
        if rubric_lines:
            prompt = _FREE_TEXT_EVAL_PROMPT.format(
                axis_name=axis.name,
                rubric_text="\n".join(rubric_lines),
                answer_text=answer_text,
            )
            result = await self._call_llm(prompt)

            if not result.get("error"):
                is_relevant = result.get("is_relevant", False)
                level = float(result.get("level", 0))
                rationale = result.get("rationale", "")

                detail.llm_level = level
                detail.llm_is_relevant = is_relevant
                detail.llm_rationale = rationale

                if not is_relevant or level <= 0:
                    return 0.0, 1.0, detail

                llm_score = max(0.0, min(1.0, (level - 1.0) / 4.0))

                # ── Step 4: Embedding auxiliary correction ─────────────────
                if embedding_mean_cos is not None and embedding_mean_cos < 0.30:
                    correction = max(0.1, embedding_mean_cos / 0.30)
                    detail.llm_embedding_correction = round(correction, 4)
                    llm_score = llm_score * correction
                else:
                    detail.llm_embedding_correction = 1.0

                return llm_score, 1.0 + llm_score * 4.0, detail

        # ── Fallback: embedding-only when no rubric descriptions ──────────
        if answer_vec and axis.rubric_levels:
            score, level, embed_detail = _score_by_rubric_anchors(answer_vec, axis.rubric_levels, "FREE_TEXT")
            embed_detail.score_method = "embedding_rubric"
            embed_detail.llm_rationale = "ルーブリック説明文が未設定のためLLM評価をスキップし、埋め込みベクトルのみで評価しました。"
            return score, level, embed_detail

        return 0.0, 1.0, ScoreDetail(score_method="fallback_zero")

    async def _call_llm(self, prompt: str) -> dict:
        try:
            response = await self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=300,
            )
            return json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return {"error": str(e)}

    # ── Main scoring entry point ──────────────────────────────────────────

    async def score(self, request: ScoringRequest) -> ScoringResponse:
        axis_map = {a.id: a for a in request.axes}

        # axis_id → [(item_score, contribution_weight, rubric_level)]
        axis_contributions: dict[str, list[tuple[float, float, float | None]]] = defaultdict(list)
        item_scores_list: list[ItemScoreResult] = []

        # ── Phase 1: Collect FREE_TEXT for async LLM, score others sync ────
        free_text_jobs: list[tuple[ScoringItem, str, AxisScoringInfo, float]] = []
        sync_results: list[tuple[str, str, float, float | None, str, ScoreDetail]] = []

        for item in request.items:
            for mapping in item.axis_mappings:
                axis = axis_map.get(mapping.axis_id)
                if axis is None:
                    continue

                if item.question_type.upper() == "FREE_TEXT":
                    answer_text = str(item.value) if item.value is not None else ""
                    if not answer_text.strip():
                        detail = ScoreDetail(
                            score_method="fallback_zero",
                            llm_rationale="回答が空欄のためスコアは0です。",
                        )
                        sync_results.append((item.question_id, mapping.axis_id, 0.0, 1.0, item.question_type, detail))
                    else:
                        free_text_jobs.append((item, answer_text, axis, mapping.contribution_weight))
                else:
                    score, rl, detail = _score_item_sync(item, axis)
                    sync_results.append((item.question_id, mapping.axis_id, score, rl, item.question_type, detail))
                    axis_contributions[mapping.axis_id].append((score, mapping.contribution_weight, rl))

        # ── Phase 2: Parallel LLM scoring for FREE_TEXT ────────────────────
        if free_text_jobs:
            llm_tasks = [
                self._score_free_text_llm(
                    answer_text=answer_text,
                    axis=axis,
                    answer_vec=item.embedding,
                )
                for item, answer_text, axis, _ in free_text_jobs
            ]
            llm_scores = await asyncio.gather(*llm_tasks)

            for (item, _, axis, cw), (score, rubric_level, detail) in zip(free_text_jobs, llm_scores):
                axis_contributions[axis.id].append((score, cw, rubric_level))
                sync_results.append((item.question_id, axis.id, score, rubric_level, item.question_type, detail))

        # ── Build item scores list ─────────────────────────────────────────
        for qId, axId, score, rl, qtype, detail in sync_results:
            item_scores_list.append(
                ItemScoreResult(
                    question_id=qId,
                    axis_id=axId,
                    raw_score=round(score, 4),
                    rubric_level=round(rl, 2) if rl is not None else None,
                    question_type=qtype,
                    detail=detail,
                )
            )

        # ── Aggregate per axis ─────────────────────────────────────────────
        axis_scores: list[AxisScoreResult] = []
        weighted_sum = 0.0
        total_weight = 0.0

        for axis in request.axes:
            contributions = axis_contributions.get(axis.id, [])
            if not contributions:
                continue

            w_sum = sum(score * w for score, w, _ in contributions)
            w_total = sum(w for _, w, _ in contributions)
            raw_score = w_sum / w_total if w_total > 0 else 0.0

            rubric_contribs = [(rl, w) for _, w, rl in contributions if rl is not None]
            if rubric_contribs:
                rl_sum = sum(rl * w for rl, w in rubric_contribs)
                rl_total = sum(w for _, w in rubric_contribs)
                avg_rubric: float | None = rl_sum / rl_total if rl_total > 0 else None
            else:
                avg_rubric = None

            axis_scores.append(
                AxisScoreResult(
                    axis_id=axis.id,
                    raw_score=round(raw_score, 4),
                    normalized_score=round(raw_score, 4),
                    rubric_level=round(avg_rubric, 2) if avg_rubric is not None else None,
                    tendency=_tendency(raw_score),
                )
            )

            weighted_sum += raw_score * axis.weight
            total_weight += axis.weight

        overall = (weighted_sum / total_weight) if total_weight > 0 else 0.0

        return ScoringResponse(
            overall_score=round(overall, 4),
            axis_scores=axis_scores,
            item_scores=item_scores_list,
        )
