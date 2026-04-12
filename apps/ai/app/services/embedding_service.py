from __future__ import annotations
import hashlib
import numpy as np
from openai import AsyncOpenAI
from app.core.config import settings
from app.models.embedding import EmbeddingResponse

EMBEDDING_DIM = 1536  # text-embedding-3-small と同じ次元数


def _local_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """
    OpenAI不使用のローカルフォールバックembedding。
    文字n-gram頻度ベクトル + 決定論的ノイズで疑似ベクトルを生成。
    意味的類似性はOpenAIには劣るが、パイプラインの動作確認・開発用途には十分。
    本番環境では必ずOpenAI APIキーを設定すること。
    """
    # Step1: 文字bi-gram + tri-gram 頻度ベクトルを構築（ハッシュトリック）
    vec = np.zeros(dim, dtype=np.float64)
    tokens = list(text.lower())  # 文字単位トークン
    ngrams = []
    for n in (2, 3, 4):
        ngrams += ["".join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]
    for ng in ngrams:
        h = int(hashlib.md5(ng.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0

    # Step2: テキスト全体のハッシュで決定論的ノイズを加算（次元の多様性確保）
    seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    vec += rng.normal(0, 0.01, dim)

    # Step3: L2正規化（コサイン類似度計算のために単位ベクトル化）
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec.tolist()


class EmbeddingService:
    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._use_local = settings.openai_api_key.startswith("sk-dummy") or \
                          settings.openai_api_key == "your-openai-api-key"

    async def generate(self, text: str, model: str | None = None) -> EmbeddingResponse:
        model = model or settings.embedding_model

        # OpenAI APIキーがダミーの場合はローカルフォールバックを使用
        if self._use_local:
            return EmbeddingResponse(
                embedding=_local_embedding(text),
                model="local-ngram-fallback",
                tokens_used=len(text),
            )

        try:
            response = await self._client.embeddings.create(input=text, model=model)
            return EmbeddingResponse(
                embedding=response.data[0].embedding,
                model=model,
                tokens_used=response.usage.total_tokens,
            )
        except Exception:
            # OpenAI失敗時もローカルフォールバック
            return EmbeddingResponse(
                embedding=_local_embedding(text),
                model="local-ngram-fallback",
                tokens_used=len(text),
            )
