export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

export interface TextAnalysisRequest {
  text: string;
  axisContext?: string;
  criteria?: string[];
}

export interface TextAnalysisResponse {
  score: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  keywords: string[];
  summary: string;
  tendency: string;
}

export interface SimilarityRequest {
  embedding: number[];
  topK?: number;
  modelId: string;
  tenantId: string;
}

export interface SimilarityResult {
  respondentRef: string;
  similarity: number;
  resultId: string;
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Rubric level (Lv1–5) for a single axis, with pre-decoded embedding */
export interface RubricLevelInfo {
  level: number;         // 1–5
  label?: string;        // e.g. "エキスパート"
  description?: string;  // full rubric description text (used by LLM scorer)
  embedding?: number[];  // decoded Float32 vector (null = no embedding yet)
}

/** Single axis definition including rubric anchors */
export interface AxisScoringInfo {
  id: string;
  name: string;
  weight: number;
  rubricLevels: RubricLevelInfo[];
  idealEmbedding?: number[]; // fallback when rubricLevels is empty
  lowEmbedding?: number[];   // fallback when rubricLevels is empty
}

/** Many-to-many mapping between one question and one axis */
export interface AxisMappingInfo {
  axisId: string;
  contributionWeight: number;
}

/** One answered question, ready for scoring */
export interface ScoringItem {
  questionId: string;
  questionType: string; // SINGLE_CHOICE | MULTIPLE_CHOICE | SCALE | FREE_TEXT
  value: unknown;       // raw answer value
  // FREE_TEXT: embedding of the answer text
  embedding?: number[];
  // SINGLE_CHOICE / MULTIPLE_CHOICE: embeddings of the selected option(s)
  selectedOptionEmbeddings?: number[][];
  selectedOptionLabels?: string[];    // display labels for selected options
  exclusiveOptionSelected?: boolean;  // "特定のツールは使っていない" style option detected
  scaleMin?: number;
  scaleMax?: number;
  // which axes this question contributes to
  axisMappings: AxisMappingInfo[];
}

export interface ScoringRequest {
  modelId: string;
  tenantId: string;
  answerId: string;
  items: ScoringItem[];
  axes: AxisScoringInfo[];
}

export interface AxisScoreResult {
  axisId: string;
  rawScore: number;
  normalizedScore: number;
  rubricLevel: number | null; // continuous 1.0–5.0
  tendency: string;
}

export interface RubricSimilarity {
  level: number;
  label?: string;
  similarity: number;     // raw cosine similarity
  normalized: number;     // (sim - min) / range
  sharpened: number;      // normalized^2
  weight: number;         // sharpened / sum(sharpened)
}

/** Full internal mechanics for one (question, axis) scoring pair */
export interface ScoreDetail {
  scoreMethod: string;  // "llm_primary" | "embedding_rubric" | "scale_linear" | "fallback_zero" | "exclusive_zero"

  // CHOICE
  selectedOptionLabels?: string[];
  exclusiveOptionSelected?: boolean;
  exclusiveFiltered?: boolean;

  // Embedding rubric
  rubricSimilarities?: RubricSimilarity[];
  meanCos?: number;
  maxCos?: number;
  qualityScore?: number;
  relevanceScore?: number;

  // FREE_TEXT LLM
  llmLevel?: number;
  llmIsRelevant?: boolean;
  llmRationale?: string;
  llmEmbeddingCorrection?: number;

  // SCALE
  rawValue?: number;
  scaleMin?: number;
  scaleMax?: number;
}

export interface ItemScoreResult {
  questionId: string;
  axisId: string;
  rawScore: number;
  rubricLevel: number | null;
  questionType?: string;
  detail?: ScoreDetail;
}

export interface ScoringResponse {
  overallScore: number;
  axisScores: AxisScoreResult[];
  itemScores: ItemScoreResult[];
}
