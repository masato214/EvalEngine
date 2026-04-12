import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QuestionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalysisService } from './analysis.service';
import { QUEUE_NAMES } from '@evalengine/config';
import type { ScoringRequest, ScoringItem, AxisScoringInfo } from '@evalengine/types';

interface AnalysisJob {
  answerId: string;
  tenantId: string;
}

/** Decode a Bytes-stored Float32 embedding back to number[] */
function decodeEmbedding(buf: Buffer | Uint8Array | null | undefined): number[] | undefined {
  if (!buf) return undefined;
  const floats = new Float32Array(Buffer.from(buf).buffer);
  return Array.from(floats);
}

@Processor(QUEUE_NAMES.ANALYSIS)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private prisma: PrismaService,
    private analysisService: AnalysisService,
  ) {
    super();
  }

  async process(job: Job<AnalysisJob>) {
    const { answerId, tenantId } = job.data;
    this.logger.log(`Processing answer ${answerId}`);

    await this.prisma.answer.update({
      where: { id: answerId },
      data: { status: 'PROCESSING' },
    });

    try {
      // ── Load answer with new schema ────────────────────────────────────────
      const answer = await this.prisma.answer.findUnique({
        where: { id: answerId },
        include: {
          items: {
            include: {
              question: {
                include: {
                  axisMappings: {
                    include: { axis: { include: { rubricLevels: true } } },
                  },
                  options: true,
                },
              },
              embedding: true,
            },
          },
          model: {
            include: {
              axes: { include: { rubricLevels: true } },
            },
          },
        },
      });

      if (!answer) throw new Error(`Answer ${answerId} not found`);

      // ── Generate embeddings for free text items ────────────────────────────
      const embeddingMap = new Map<string, number[]>();

      for (const item of answer.items) {
        if (item.question.type === QuestionType.FREE_TEXT) {
          // Use stored embedding if already computed
          if (item.embedding?.vector) {
            const vec = decodeEmbedding(item.embedding.vector as Buffer);
            if (vec) embeddingMap.set(item.id, vec);
            continue;
          }
          const rawValue = item.value;
          const text = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
          try {
            const { embedding } = await this.analysisService.generateEmbedding(text);
            embeddingMap.set(item.id, embedding);

            await this.prisma.embedding.upsert({
              where: { answerItemId: item.id },
              update: {
                vector: Buffer.from(new Float32Array(embedding).buffer),
                model: 'text-embedding-3-small',
                dimensions: embedding.length,
              },
              create: {
                answerItemId: item.id,
                vector: Buffer.from(new Float32Array(embedding).buffer),
                model: 'text-embedding-3-small',
                dimensions: embedding.length,
              },
            });
          } catch (err) {
            this.logger.warn(`Embedding failed for item ${item.id}: ${err}`);
          }
        }
      }

      // ── Build scoring request ──────────────────────────────────────────────

      // Axes with decoded rubric embeddings
      const axes: AxisScoringInfo[] = answer.model.axes.map((axis) => ({
        id: axis.id,
        name: axis.name,
        weight: axis.weight,
        rubricLevels: axis.rubricLevels.map((rl: any) => ({
          level: rl.level,
          label: rl.label ?? undefined,
          description: rl.description ?? undefined,
          embedding: decodeEmbedding(rl.embedding as Buffer | undefined),
        })),
      }));

      // Items with many-to-many mappings and option embeddings
      const items: ScoringItem[] = answer.items.map((item) => {
        const q = item.question;
        const qType = q.type as string;

        // For choice questions: find selected option embeddings
        let selectedOptionEmbeddings: number[][] | undefined;
        if (qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE') {
          const rawVal = item.value;
          const selected: string[] =
            qType === 'SINGLE_CHOICE'
              ? [String(rawVal)]
              : Array.isArray(rawVal)
                ? (rawVal as unknown[]).map(String)
                : [String(rawVal)];

          const selectedEmbeds = q.options
            .filter((opt) => selected.includes(opt.value) && opt.embedding)
            .map((opt) => decodeEmbedding(opt.embedding as Buffer))
            .filter((v): v is number[] => v !== undefined);

          if (selectedEmbeds.length > 0) selectedOptionEmbeddings = selectedEmbeds;
        }

        return {
          questionId: item.questionId,
          questionType: qType,
          value: item.value,
          embedding: qType === 'FREE_TEXT' ? embeddingMap.get(item.id) : undefined,
          selectedOptionEmbeddings,
          scaleMin: q.scaleMin ?? undefined,
          scaleMax: q.scaleMax ?? undefined,
          axisMappings: q.axisMappings.map((m) => ({
            axisId: m.axisId,
            contributionWeight: m.contributionWeight,
          })),
        };
      });

      const scoringRequest: ScoringRequest = {
        modelId: answer.modelId,
        tenantId,
        answerId,
        items,
        axes,
      };

      const { overallScore, axisScores } = await this.analysisService.scoreResponse(scoringRequest);

      // ── LLM: 自由記述の前処理（summary用） ───────────────────────────────────
      let summary: string | undefined;

      const freeTextItems = answer.items.filter((i) => i.question.type === QuestionType.FREE_TEXT);
      if (freeTextItems.length > 0) {
        try {
          const textAnalysis = await this.analysisService.analyzeText({
            text: freeTextItems.map((i) => String(i.value)).join('\n\n'),
            criteria: answer.model.axes.map((a) => a.name),
          });
          summary = textAnalysis.summary;
        } catch (err) {
          this.logger.warn(`Text analysis failed: ${err}`);
        }
      }

      // ── LLM: スコア → 説明文・推奨アクション生成 ──────────────────────────
      let explanation: string | undefined;
      let recommendations: string[] = [];

      // axisScores に軸名を付与
      const axisNameMap = new Map(answer.model.axes.map((a: any) => [a.id, a.name]));
      const axisScoresWithName = axisScores.map((s) => ({
        axisName: axisNameMap.get(s.axisId) as string ?? s.axisId,
        normalizedScore: s.normalizedScore,
        rubricLevel: s.rubricLevel ?? null,
      }));

      try {
        const explResult = await this.analysisService.generateExplanation({
          respondentRef: answer.respondentRef,
          axisScores: axisScoresWithName,
          overallScore,
        });
        explanation = explResult.explanation || undefined;
        recommendations = explResult.recommendations ?? [];
      } catch (err) {
        this.logger.warn(`Explanation generation failed: ${err}`);
      }

      // ── Mark previous results as not latest ───────────────────────────────
      await this.prisma.result.updateMany({
        where: { answerId, isLatest: true },
        data: { isLatest: false },
      });

      // ── Save new result ────────────────────────────────────────────────────
      await this.prisma.result.create({
        data: {
          answerId,
          sessionId: answer.sessionId ?? undefined,
          modelId: answer.modelId,
          tenantId,
          modelVersion: answer.model.version,
          respondentRef: answer.respondentRef,
          overallScore,
          isLatest: true,
          summary,
          explanation,
          recommendations,
          scores: {
            create: axisScores.map((s) => ({
              axisId: s.axisId,
              rawScore: s.rawScore,
              normalizedScore: s.normalizedScore,
              rubricLevel: s.rubricLevel ?? undefined,
              tendency: s.tendency,
            })),
          },
        },
      });

      await this.prisma.answer.update({
        where: { id: answerId },
        data: { status: 'COMPLETED' },
      });

      // セッションが紐付いている場合は COMPLETED に更新
      if (answer.sessionId) {
        await this.prisma.session.update({
          where: { id: answer.sessionId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }

      this.logger.log(`Answer ${answerId} scored. overallScore=${overallScore}`);
    } catch (err) {
      this.logger.error(`Analysis failed for ${answerId}:`, err);
      await this.prisma.answer.update({
        where: { id: answerId },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }
}
