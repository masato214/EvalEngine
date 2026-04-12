from __future__ import annotations
import json
from openai import AsyncOpenAI
from app.core.config import settings
from app.models.output_format import (
    GenerateOutputRequest,
    GenerateOutputResponse,
    TypeClassificationOutput,
    SkillGapOutput,
    TendencyMapOutput,
    CustomOutput,
)


def _axis_lines(axis_scores: list) -> str:
    return "\n".join(
        f"  - {a.axis_name}: {a.percent}%"
        + (f" (Lv{round(a.rubric_level, 1)})" if a.rubric_level else "")
        for a in axis_scores
    )


def _compute_pattern(axis_scores: list) -> str:
    """Pre-analyze score patterns to guide LLM interpretation."""
    if not axis_scores:
        return "（スコアデータなし）"

    sorted_axes = sorted(axis_scores, key=lambda a: a.normalized_score, reverse=True)
    highest = sorted_axes[:2] if len(sorted_axes) >= 2 else sorted_axes
    lowest = sorted_axes[-2:] if len(sorted_axes) >= 2 else sorted_axes

    spread = (
        max(a.normalized_score for a in axis_scores)
        - min(a.normalized_score for a in axis_scores)
    )

    pattern_notes = []
    pattern_notes.append(
        f"最高スコア軸: {', '.join(f'{a.axis_name}({a.percent}%)' for a in highest)}"
    )
    pattern_notes.append(
        f"最低スコア軸: {', '.join(f'{a.axis_name}({a.percent}%)' for a in lowest)}"
    )
    pattern_notes.append(
        f"スコア分散: {round(spread * 100)}%pt"
        f"（差が{'大きい＝特徴的なパターン' if spread > 0.25 else '小さい＝バランス型'}）"
    )

    # Detect specific cross-axis patterns
    axis_name_score = {a.axis_name: a.normalized_score for a in axis_scores}
    cross_patterns = []
    for high_axis in highest:
        for low_axis in lowest:
            if high_axis.axis_name != low_axis.axis_name:
                cross_patterns.append(
                    f"「{high_axis.axis_name}は強いが{low_axis.axis_name}が弱い」パターンを検出"
                )
    if cross_patterns:
        pattern_notes.extend(cross_patterns[:2])  # limit to 2 cross-pattern notes

    return "\n".join(pattern_notes)


# ─────────────────────────────────────────────────────────────────────────────
# TYPE CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────

TYPE_PROMPT = """\
あなたは人材評価の専門家です。以下の評価スコアと定義済みタイプ一覧を元に、
この人物の「営業タイプ」を精密に分類してください。

## スコアパターン分析（AI事前解析）
{pattern_analysis}

## 評価スコア（各軸の得点）
{axis_lines}
総合: {overall_pct}%

## 定義済みタイプ一覧
{types_json}

## 分析手順（この順で思考すること）
1. 最高スコア軸と最低スコア軸を明示的に特定する
2. スコアの分散・偏りを計算し「バランス型か特化型か」を判定する
3. 「高X × 低Y」のような交差パターンを検出する
4. 上記パターンを反映したタイプ名を設定する（例：「ヒアリング型（提案弱）」）
5. タイプ説明にスコアの因果関係を含める

## 出力ルール
1. 「type_label」: スコアパターンを反映した具体的タイプ名（例：「ヒアリング型（提案弱）」「関係構築型×収益化弱」）。「バランス型」「成長型」などの曖昧ラベルは禁止
2. 「type_description」: 因果関係を含む説明（例：「ヒアリングはできているが、提案の構造化が弱いため価値伝達できていない」）。3–5文、スコアの組み合わせで具体的に
3. 「strengths」: 行動レベルで表現（例：「顧客の話を引き出し潜在ニーズを発掘できる」であって「ヒアリング力が高い」は不可）。3–4項目
4. 「growth_areas」: 根本原因を含める（例：「提案の構造化・言語化が不足しているため、ヒアリングした内容を価値として伝えきれていない」）。2–3項目
5. 「all_types_matched」: 全タイプについて [{{label, matched: bool, reason: str}}]

{extra}

JSON形式で返してください（日本語）:
{{
  "type_label": "...",
  "type_description": "...",
  "strengths": ["...", "..."],
  "growth_areas": ["...", "..."],
  "all_types_matched": [{{"label": "...", "matched": true/false, "reason": "..."}}]
}}"""

# ─────────────────────────────────────────────────────────────────────────────
# SKILL GAP
# ─────────────────────────────────────────────────────────────────────────────

SKILL_GAP_PROMPT = """\
あなたは人材育成の専門家です。以下の評価スコアと目標値から、構造的なスキルギャップを分析してください。

## スコアパターン分析（AI事前解析）
{pattern_analysis}

## 現在のスコア
{axis_lines}

## 目標値（各軸）
{targets_json}

## 出力ルール
1. 「root_cause」は構造的に記述すること：他軸のスコアを使って「なぜ」を説明する（例：「ヒアリングはできているが提案が弱いのは構造化スキル不足が原因」）。単に「Xが低い」は禁止
2. 「action」は今日から実行可能な具体的アクション（例：「週1回の商談後に提案書テンプレートを使って振り返りを行い、ニーズ→価値→提案の構造を書き出す」）
3. 「priority_action」: 今すぐ取り組むべき最重要1アクション（最もギャップが大きく影響が高い軸に基づく）
4. 「summary」: 診断文として記述（例：「このスコアパターンは〇〇型の課題を示しており、根本的にはXの不足がYとZに連鎖している。優先的にXに介入することで全体スコアの底上げが期待できる」）。100–200字

{extra}

JSON形式で返してください（日本語）:
{{
  "gaps": [
    {{
      "axis": "軸名",
      "current_pct": 45,
      "target_pct": 75,
      "gap_pct": 30,
      "root_cause": "他軸スコアを踏まえた構造的原因",
      "action": "今日から実行可能な具体的アクション"
    }}
  ],
  "priority_action": "...",
  "summary": "..."
}}"""

# ─────────────────────────────────────────────────────────────────────────────
# TENDENCY MAP
# ─────────────────────────────────────────────────────────────────────────────

TENDENCY_MAP_PROMPT = """\
あなたは組織行動の専門家です。以下の評価スコアのパターンから、この人物の行動傾向を分析してください。

## スコアパターン分析（AI事前解析）
{pattern_analysis}

## 評価スコア
{axis_lines}

## 出力ルール
1. 「pattern_label」: 「X型 × Y弱」形式で記述（例：「関係構築型 × 収益化弱」「ヒアリング型 × 提案弱」）。スコアの最高軸と最低軸を必ず反映させること
2. 「pattern_description」: パターンの意味を実務的に説明。なぜこの組み合わせが生まれるか、どんな職務環境で発現するかを含む（3–5文）
3. 「axis_interpretations」: 各軸のスコアが「実務での具体的行動」としてどう現れるかを解釈（「スコアが高い」ではなく「何をする/しない人か」で表現）
4. 「behavioral_implications」: 具体的な商談シナリオで行動を描写（例：「この人は商談でニーズは引き出せるが、それを提案書に落とし込んで顧客に価値として提示するまでが弱く、案件が前に進まないケースが多い」）。抽象的な記述は禁止

{extra}

JSON形式で返してください（日本語）:
{{
  "pattern_label": "...",
  "pattern_description": "...",
  "axis_interpretations": [
    {{"axis": "...", "score_pct": 60, "interpretation": "..."}}
  ],
  "behavioral_implications": "..."
}}"""

# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM
# ─────────────────────────────────────────────────────────────────────────────

CUSTOM_PROMPT = """\
あなたは採用・人材配置の意思決定支援の専門家です。以下の評価スコアを元に、
採用・配置・育成に関する総合的な判断を行ってください。

## スコアパターン分析（AI事前解析）
{pattern_analysis}

## 評価スコア
{axis_lines}
総合: {overall_pct}%

## 判定基準
{config_json}

## 出力ルール
1. 「hiring_decision」: ◎（即採用）/ ○（条件付き採用）/ △（見送り推奨）/ ×（不採用）の4段階のみ使用
2. 「hiring_rationale」: スコアパターンから具体的根拠を示す（どの軸がどう作用しているか）
3. 「role_fits」: 各ロールへの適性。◎/○/△/×を使い、理由は軸スコアの組み合わせで説明すること（例：「既存営業◎ — ヒアリング高({pct}%) + 関係維持強({pct}%)」）。単なる印象評価は禁止
4. 「development_plan」: 採用した場合の具体的3ヶ月育成プラン（月ごとのテーマと施策を記述。「コミュニケーション力を高める」などの抽象的記述は禁止）
5. 「summary」: 診断＋予後形式で記述（「現状: X。課題: Y。可能性: Z。」の3段構成、150–250字）

{extra}

JSON形式で返してください（日本語）:
{{
  "hiring_decision": "◎/○/△/×",
  "hiring_rationale": "...",
  "role_fits": [
    {{"role": "...", "fit": "◎/○/△/×", "reason": "..."}}
  ],
  "development_plan": ["1ヶ月目: ...", "2ヶ月目: ...", "3ヶ月目: ..."],
  "summary": "現状: ...。課題: ...。可能性: ...。"
}}"""


class OutputFormatService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def generate(self, req: GenerateOutputRequest) -> GenerateOutputResponse:
        axis_lines = _axis_lines(req.axis_scores)
        extra = req.prompt_template or ""
        pattern_analysis = _compute_pattern(req.axis_scores)

        if req.output_type == "TYPE_CLASSIFICATION":
            types = req.config.get("types", []) if req.config else []
            prompt = TYPE_PROMPT.format(
                pattern_analysis=pattern_analysis,
                axis_lines=axis_lines,
                overall_pct=req.overall_percent,
                types_json=json.dumps(types, ensure_ascii=False, indent=2),
                extra=extra,
            )
            data = await self._call_llm(prompt)
            out = TypeClassificationOutput(
                type_label=data.get("type_label", "未判定"),
                type_description=data.get("type_description", ""),
                strengths=data.get("strengths", []),
                growth_areas=data.get("growth_areas", []),
                all_types_matched=data.get("all_types_matched", []),
            )
            return GenerateOutputResponse(output_type=req.output_type, type_classification=out)

        if req.output_type == "SKILL_GAP":
            targets = req.config.get("targets", {}) if req.config else {}
            scores_dict = {a.axis_name: a.percent for a in req.axis_scores}
            # Enrich targets with current scores for context
            targets_with_current = {
                k: {"target": int(v * 100), "current": scores_dict.get(k, 0)}
                for k, v in targets.items()
            }
            prompt = SKILL_GAP_PROMPT.format(
                pattern_analysis=pattern_analysis,
                axis_lines=axis_lines,
                targets_json=json.dumps(targets_with_current, ensure_ascii=False, indent=2),
                extra=extra,
            )
            data = await self._call_llm(prompt)
            out = SkillGapOutput(
                gaps=data.get("gaps", []),
                priority_action=data.get("priority_action", ""),
                summary=data.get("summary", ""),
            )
            return GenerateOutputResponse(output_type=req.output_type, skill_gap=out)

        if req.output_type == "TENDENCY_MAP":
            prompt = TENDENCY_MAP_PROMPT.format(
                pattern_analysis=pattern_analysis,
                axis_lines=axis_lines,
                extra=extra,
            )
            data = await self._call_llm(prompt)
            out = TendencyMapOutput(
                pattern_label=data.get("pattern_label", ""),
                pattern_description=data.get("pattern_description", ""),
                axis_interpretations=data.get("axis_interpretations", []),
                behavioral_implications=data.get("behavioral_implications", ""),
            )
            return GenerateOutputResponse(output_type=req.output_type, tendency_map=out)

        if req.output_type == "CUSTOM":
            config_json = json.dumps(req.config or {}, ensure_ascii=False, indent=2)
            prompt = CUSTOM_PROMPT.format(
                pattern_analysis=pattern_analysis,
                axis_lines=axis_lines,
                overall_pct=req.overall_percent,
                config_json=config_json,
                extra=extra,
            )
            data = await self._call_llm(prompt)
            out = CustomOutput(
                hiring_decision=data.get("hiring_decision"),
                hiring_rationale=data.get("hiring_rationale"),
                role_fits=data.get("role_fits", []),
                development_plan=data.get("development_plan", []),
                summary=data.get("summary", ""),
            )
            return GenerateOutputResponse(output_type=req.output_type, custom=out)

        # Unknown type
        return GenerateOutputResponse(output_type=req.output_type)

    async def _call_llm(self, prompt: str) -> dict:
        try:
            response = await self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=2000,
            )
            return json.loads(response.choices[0].message.content or "{}")
        except Exception as e:
            return {"error": str(e)}
