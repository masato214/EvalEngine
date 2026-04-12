import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QuestionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateQuestionDto {
  text: string;
  type: QuestionType;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  required?: boolean;
  order?: number;
}

export interface UpsertOptionDto {
  label: string;
  value: string;
  text: string; // semantic text for embedding
  order?: number;
  explicitWeight?: number;
}

export interface UpsertAxisMappingDto {
  axisId: string;
  contributionWeight?: number;
}

export interface UpsertCriteriaDto {
  level: number;
  label: string;
  description: string;
}

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

  /** FastAPIのEmbeddingサービスを呼び出してベクトルを生成（ベストエフォート） */
  private async generateEmbedding(text: string): Promise<Buffer | null> {
    if (!text?.trim()) return null;
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ embedding: number[] }>('/embedding/generate', { text }),
      );
      return Buffer.from(new Float32Array(data.embedding).buffer);
    } catch (err) {
      this.logger.warn(`Option embedding failed: ${err}`);
      return null;
    }
  }

  async findAll(modelId: string) {
    return this.prisma.question.findMany({
      where: { modelId },
      orderBy: { order: 'asc' },
      include: {
        options: { orderBy: { order: 'asc' } },
        axisMappings: { include: { axis: { select: { id: true, name: true, weight: true } } } },
      },
    });
  }

  async findOne(id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        options: { orderBy: { order: 'asc' } },
        axisMappings: { include: { axis: { select: { id: true, name: true, weight: true } } } },
      },
    });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async create(modelId: string, dto: CreateQuestionDto) {
    const model = await this.prisma.evaluationModel.findUnique({ where: { id: modelId } });
    if (!model) throw new NotFoundException('Evaluation model not found');
    return this.prisma.question.create({ data: { ...dto, modelId } });
  }

  async update(id: string, dto: Partial<CreateQuestionDto>) {
    await this.findOne(id);
    return this.prisma.question.update({ where: { id }, data: dto });
  }

  async upsertOption(questionId: string, optionId: string | undefined, dto: UpsertOptionDto) {
    await this.findOne(questionId);

    // 選択肢の意味テキストをベクトル化（スコアリングエンジンがコサイン類似度で使用）
    const embeddingBuf = await this.generateEmbedding(dto.text || dto.label);
    const data: any = { ...dto };
    if (embeddingBuf) data.embedding = embeddingBuf;

    if (optionId) {
      return this.prisma.questionOption.upsert({
        where: { id: optionId },
        create: { id: optionId, questionId, ...data },
        update: data,
      });
    }
    return this.prisma.questionOption.create({ data: { questionId, ...data } });
  }

  async removeOption(optionId: string) {
    return this.prisma.questionOption.delete({ where: { id: optionId } });
  }

  async upsertAxisMapping(questionId: string, dto: UpsertAxisMappingDto) {
    await this.findOne(questionId);
    const id = `map-${questionId}-${dto.axisId}`;
    return this.prisma.questionAxisMapping.upsert({
      where: { id },
      create: { id, questionId, axisId: dto.axisId, contributionWeight: dto.contributionWeight ?? 1.0 },
      update: { contributionWeight: dto.contributionWeight ?? 1.0 },
    });
  }

  async removeAxisMapping(questionId: string, axisId: string) {
    const id = `map-${questionId}-${axisId}`;
    return this.prisma.questionAxisMapping.delete({ where: { id } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.question.delete({ where: { id } });
  }

  async upsertCriteria(questionId: string, dto: UpsertCriteriaDto) {
    await this.findOne(questionId);
    return this.prisma.questionCriteria.upsert({
      where: { questionId_level: { questionId, level: dto.level } },
      create: { questionId, level: dto.level, label: dto.label, description: dto.description },
      update: { label: dto.label, description: dto.description },
    });
  }

  async removeCriteria(questionId: string, level: number) {
    return this.prisma.questionCriteria.delete({
      where: { questionId_level: { questionId, level } },
    });
  }

  async findCriteria(questionId: string) {
    return this.prisma.questionCriteria.findMany({
      where: { questionId },
      orderBy: { level: 'asc' },
    });
  }
}
