from __future__ import annotations
import json
from openai import AsyncOpenAI
from app.core.config import settings
from app.models.explanation import ExplanationRequest, ExplanationResponse

TENDENCY_LABELS = {
    "very_high": "非常に高い",
    "high": "高い",
    "moderate": "普通",
    "low": "低い",
    "very_low": "非常に低い",
}

EXPLANATION_PROMPT = """\
あなたは組織・人材評価の専門家です。
以下の評価スコアを元に、評価対象者への説明文と推奨アクションを生成してください。

## 評価結果
- 総合スコア: {overall_pct}%{result_type_line}
- 軸別スコア:
{axis_lines}

## 出力ルール
1. 説明文（explanation）: 200〜400字。スコアの数字を直接書かず、強みと改善点を自然な文章で表現。ポジティブな語調で。
2. 推奨アクション（recommendations）: 3〜5個のリスト。具体的で実行可能なアクション。

{extra_instructions}

JSON形式で返してください:
{{
  "explanation": "...",
  "recommendations": ["...", "...", "..."]
}}"""


class ExplanationService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate(self, request: ExplanationRequest) -> ExplanationResponse:
        result_type_line = f"\n- タイプ: {request.result_type}" if request.result_type else ""

        axis_lines = "\n".join(
            f"  - {s.axis_name}: {round(s.normalized_score * 100)}%"
            + (f" (Lv{round(s.rubric_level, 1)})" if s.rubric_level else "")
            for s in request.axis_scores
        )

        extra = request.prompt_template or ""

        prompt = EXPLANATION_PROMPT.format(
            overall_pct=round(request.overall_score * 100),
            result_type_line=result_type_line,
            axis_lines=axis_lines,
            extra_instructions=extra,
        )

        try:
            response = await self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.4,
            )
            data = json.loads(response.choices[0].message.content or "{}")
            return ExplanationResponse(
                explanation=data.get("explanation", ""),
                recommendations=data.get("recommendations", []),
            )
        except Exception:
            # LLM失敗時はスコアから簡易テキストを生成（フォールバック）
            top = sorted(request.axis_scores, key=lambda s: s.normalized_score, reverse=True)
            explanation = (
                f"総合スコアは{round(request.overall_score * 100)}%です。"
                + (f"特に「{top[0].axis_name}」が高評価でした。" if top else "")
            )
            return ExplanationResponse(explanation=explanation, recommendations=[])
