"""
AI-powered question suggestion router.
Generates optimised question text that covers multiple evaluation axes simultaneously.
"""
from __future__ import annotations
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import verify_internal_key
from openai import AsyncOpenAI

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_client = AsyncOpenAI(api_key=settings.openai_api_key)


# ─── Request / Response models ───────────────────────────────────────────────

class RubricLevelInput(BaseModel):
    level: int
    label: Optional[str] = None
    description: Optional[str] = None


class AxisInput(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    rubric_levels: list[RubricLevelInput] = []


class CompressQuestionRequest(BaseModel):
    axes: list[AxisInput]
    question_type: str = "FREE_TEXT"   # FREE_TEXT | SINGLE_CHOICE | MULTIPLE_CHOICE | SCALE
    extra_context: Optional[str] = None


class CompressQuestionResponse(BaseModel):
    question_text: str
    rationale: str


# ─── Prompt template ─────────────────────────────────────────────────────────

_COMPRESS_PROMPT = """\
あなたは人材評価の専門家です。以下の複数の評価軸を1つの質問で同時に評価できる、最適な質問文を作成してください。

## 評価対象の軸と評価基準

{axes_text}

## 質問タイプ
{question_type_label}

## 作成要件
- 1問の質問で上記すべての評価軸に関連する情報を回答者から引き出せること
- 回答者が自分の経験・行動・考えを自然に語れる問いかけにすること
- 誘導的・暗示的にならないこと（「～していますか？」のような閉じた問いより「～についてどのように行いますか？」など）
- 質問は1〜2文で簡潔にまとめること
- 日本語で作成すること{extra_context_section}

## 出力形式（JSON）
{{
  "question_text": "<質問文>",
  "rationale": "<この質問文が複数の軸を評価できる理由（1〜2文）>"
}}"""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _axis_to_text(axis: AxisInput) -> str:
    lines = [f"**{axis.name}**"]
    if axis.description:
        lines.append(f"説明: {axis.description}")
    sorted_levels = sorted(axis.rubric_levels, key=lambda r: r.level, reverse=True)
    for rl in sorted_levels:
        label_part = f"（{rl.label}）" if rl.label else ""
        if rl.description:
            lines.append(f"  Lv{rl.level}{label_part}: {rl.description}")
    return "\n".join(lines)


def _question_type_label(qt: str) -> str:
    return {
        "FREE_TEXT": "自由記述（回答者が文章で自由に記述する形式）",
        "SINGLE_CHOICE": "単一選択（選択肢の中から1つを選ぶ形式）",
        "MULTIPLE_CHOICE": "複数選択（選択肢の中から複数を選ぶ形式）",
        "SCALE": "スケール（1〜5などの数値で回答する形式）",
    }.get(qt.upper(), qt)


# ─── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/compress-question", response_model=CompressQuestionResponse)
async def suggest_compressed_question(
    req: CompressQuestionRequest,
) -> CompressQuestionResponse:
    """
    Suggest a single question that covers all provided evaluation axes.
    Uses GPT-4o-mini with axis rubric descriptions as context.
    """
    if not req.axes:
        raise HTTPException(status_code=400, detail="axes must not be empty")

    axes_text = "\n\n".join(_axis_to_text(a) for a in req.axes)

    extra_section = (
        f"\n- 追加コンテキスト: {req.extra_context}"
        if req.extra_context
        else ""
    )

    prompt = _COMPRESS_PROMPT.format(
        axes_text=axes_text,
        question_type_label=_question_type_label(req.question_type),
        extra_context_section=extra_section,
    )

    try:
        response = await _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=400,
        )
        result = json.loads(response.choices[0].message.content or "{}")
        return CompressQuestionResponse(
            question_text=result.get("question_text", ""),
            rationale=result.get("rationale", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
