import json
from openai import AsyncOpenAI
from app.core.config import settings
from app.models.analysis import TextAnalysisRequest, TextAnalysisResponse


ANALYSIS_PROMPT = """Analyze the following text response and return a JSON object with these fields:
- score: float between 0 and 1 (overall quality/relevance score)
- sentiment: one of "positive", "neutral", "negative"
- keywords: list of 3-5 key themes or concepts
- summary: one sentence summary
- tendency: a short description of the person's tendency or characteristic shown

{criteria_context}

Text to analyze:
{text}

Return only valid JSON."""


class AnalysisService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def analyze(self, request: TextAnalysisRequest) -> TextAnalysisResponse:
        criteria_context = ""
        if request.criteria:
            criteria_context = f"Evaluate against these criteria: {', '.join(request.criteria)}"
        if request.axis_context:
            criteria_context += f"\nContext: {request.axis_context}"

        prompt = ANALYSIS_PROMPT.format(
            criteria_context=criteria_context,
            text=request.text,
        )

        response = await self._client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)

        return TextAnalysisResponse(
            score=float(data.get("score", 0.5)),
            sentiment=data.get("sentiment", "neutral"),
            keywords=data.get("keywords", []),
            summary=data.get("summary", ""),
            tendency=data.get("tendency", ""),
        )
