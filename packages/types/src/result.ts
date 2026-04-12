export interface ResultScoreDto {
  axisId: string;
  axisName: string;
  rawScore: number;
  normalizedScore: number;
  rubricLevel: number | null; // 連続値 1.0〜5.0
  tendency: string | null;
  details: Record<string, unknown> | null;
}

export interface ResultDto {
  id: string;
  answerId: string;
  sessionId: string | null;
  modelId: string;
  modelVersion: number;
  respondentRef: string;
  overallScore: number;
  isLatest: boolean;
  scores: ResultScoreDto[];
  summary: string | null;
  explanation: string | null;   // LLMが数値を文章化したもの
  recommendations: string[] | null;
  resultType: string | null;
  typeDetails: Record<string, unknown> | null;
  tenantId: string;
  createdAt: string;
}
