import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  ScoringRequest,
  ScoringResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  TextAnalysisRequest,
  TextAnalysisResponse,
} from '@evalengine/types';

export interface ExplanationRequest {
  respondentRef: string;
  axisScores: Array<{
    axisName: string;
    normalizedScore: number;
    rubricLevel?: number | null;
  }>;
  overallScore: number;
  resultType?: string | null;
  promptTemplate?: string | null;
}

export interface ExplanationResponse {
  explanation: string;
  recommendations: string[];
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private http: HttpService) {}

  async generateEmbedding(text: string, model?: string): Promise<EmbeddingResponse> {
    const body: EmbeddingRequest = { text, model };
    const { data } = await firstValueFrom(
      this.http.post<EmbeddingResponse>('/embedding/generate', body),
    );
    return data;
  }

  async analyzeText(request: TextAnalysisRequest): Promise<TextAnalysisResponse> {
    const { data } = await firstValueFrom(
      this.http.post<TextAnalysisResponse>('/analysis/text', request),
    );
    return data;
  }

  async scoreResponse(request: ScoringRequest): Promise<ScoringResponse> {
    // TypeScript camelCase → Python snake_case に変換
    const body = {
      model_id: request.modelId,
      tenant_id: request.tenantId,
      answer_id: request.answerId,
      items: request.items.map((item) => ({
        question_id: item.questionId,
        question_type: item.questionType,
        value: item.value,
        embedding: item.embedding ?? null,
        selected_option_embeddings: item.selectedOptionEmbeddings ?? null,
        selected_option_labels: (item as any).selectedOptionLabels ?? [],
        exclusive_option_selected: (item as any).exclusiveOptionSelected ?? false,
        scale_min: item.scaleMin ?? null,
        scale_max: item.scaleMax ?? null,
        axis_mappings: item.axisMappings.map((m) => ({
          axis_id: m.axisId,
          contribution_weight: m.contributionWeight,
        })),
      })),
      axes: request.axes.map((axis) => ({
        id: axis.id,
        name: axis.name,
        weight: axis.weight,
        rubric_levels: axis.rubricLevels.map((rl) => ({
          level: rl.level,
          label: (rl as any).label ?? null,
          description: (rl as any).description ?? null,
          embedding: rl.embedding ?? null,
        })),
        ideal_embedding: axis.idealEmbedding ?? null,
        low_embedding: axis.lowEmbedding ?? null,
      })),
    };
    const { data } = await firstValueFrom(
      this.http.post<any>('/scoring/score-response', body),
    );

    // ── snake_case → camelCase ────────────────────────────────────────────────
    const mapDetail = (d: any): any => {
      if (!d) return null;
      return {
        scoreMethod: d.score_method,
        selectedOptionLabels: d.selected_option_labels ?? [],
        exclusiveOptionSelected: d.exclusive_option_selected ?? false,
        exclusiveFiltered: d.exclusive_filtered ?? false,
        rubricSimilarities: (d.rubric_similarities ?? []).map((rs: any) => ({
          level: rs.level,
          label: rs.label ?? null,
          similarity: rs.similarity,
          normalized: rs.normalized,
          sharpened: rs.sharpened,
          weight: rs.weight,
        })),
        meanCos: d.mean_cos ?? null,
        maxCos: d.max_cos ?? null,
        qualityScore: d.quality_score ?? null,
        relevanceScore: d.relevance_score ?? null,
        llmLevel: d.llm_level ?? null,
        llmIsRelevant: d.llm_is_relevant ?? null,
        llmRationale: d.llm_rationale ?? null,
        llmEmbeddingCorrection: d.llm_embedding_correction ?? null,
        rawValue: d.raw_value ?? null,
        scaleMin: d.scale_min ?? null,
        scaleMax: d.scale_max ?? null,
      };
    };

    return {
      overallScore: data.overall_score,
      axisScores: (data.axis_scores ?? []).map((s: any) => ({
        axisId: s.axis_id,
        rawScore: s.raw_score,
        normalizedScore: s.normalized_score,
        rubricLevel: s.rubric_level ?? null,
        tendency: s.tendency,
      })),
      itemScores: (data.item_scores ?? []).map((s: any) => ({
        questionId: s.question_id,
        axisId: s.axis_id,
        rawScore: s.raw_score,
        rubricLevel: s.rubric_level ?? null,
        questionType: s.question_type ?? null,
        detail: mapDetail(s.detail),
      })),
    };
  }

  async generateFormatOutput(request: {
    respondentRef: string;
    overallScore: number;
    overallPercent: number;
    axisScores: Array<{ axisName: string; normalizedScore: number; rubricLevel?: number | null; percent: number }>;
    outputType: string;
    formatName: string;
    config?: any;
    promptTemplate?: string | null;
  }): Promise<any> {
    const body = {
      respondent_ref: request.respondentRef,
      overall_score: request.overallScore,
      overall_percent: request.overallPercent,
      axis_scores: request.axisScores.map((a) => ({
        axis_name: a.axisName,
        normalized_score: a.normalizedScore,
        rubric_level: a.rubricLevel ?? null,
        percent: a.percent,
      })),
      output_type: request.outputType,
      format_name: request.formatName,
      config: request.config ?? null,
      prompt_template: request.promptTemplate ?? null,
    };
    try {
      const { data } = await firstValueFrom(
        this.http.post<any>('/output-format/generate', body),
      );
      return data;
    } catch (err) {
      this.logger.warn(`Output format generation failed: ${err}`);
      return null;
    }
  }

  async generateExplanation(request: ExplanationRequest): Promise<ExplanationResponse> {
    const body = {
      respondent_ref: request.respondentRef,
      overall_score: request.overallScore,
      result_type: request.resultType ?? null,
      prompt_template: request.promptTemplate ?? null,
      axis_scores: request.axisScores.map((s) => ({
        axis_name: s.axisName,
        normalized_score: s.normalizedScore,
        rubric_level: s.rubricLevel ?? null,
      })),
    };
    try {
      const { data } = await firstValueFrom(
        this.http.post<ExplanationResponse>('/explanation/generate', body),
      );
      return data;
    } catch (err) {
      this.logger.warn(`Explanation generation failed: ${err}`);
      return { explanation: '', recommendations: [] };
    }
  }
}
