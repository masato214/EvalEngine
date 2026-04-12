import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAxisDto {
  name: string;
  description?: string;
  weight?: number;
  order?: number;
  parentId?: string;
  idealStateText?: string;
  lowStateText?: string;
}

export interface UpsertRubricLevelDto {
  level: number; // 1–5
  label: string;
  description: string;
}

@Injectable()
export class AxesService {
  private readonly logger = new Logger(AxesService.name);

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
  ) {}

  /** FastAPIのEmbeddingサービスを呼び出してベクトルを生成 */
  private async generateEmbedding(text: string): Promise<Buffer | null> {
    if (!text?.trim()) return null;
    try {
      const { data } = await firstValueFrom(
        this.http.post<{ embedding: number[] }>('/embedding/generate', { text }),
      );
      return Buffer.from(new Float32Array(data.embedding).buffer);
    } catch (err) {
      this.logger.warn(`Embedding generation failed: ${err}`);
      return null;
    }
  }

  async findAll(modelId: string, tenantId: string) {
    const model = await this.prisma.evaluationModel.findFirst({ where: { id: modelId, tenantId } });
    if (!model) throw new NotFoundException('Model not found');

    const axes = await this.prisma.axis.findMany({
      where: { modelId },
      orderBy: { order: 'asc' },
      include: {
        rubricLevels: { orderBy: { level: 'asc' } },
        mappings: {
          include: { question: { select: { id: true, text: true, type: true, order: true } } },
        },
        _count: { select: { children: true, mappings: true } },
      },
    });

    return this.buildTree(axes);
  }

  private buildTree(axes: any[]): any[] {
    const map = new Map(axes.map((a) => [a.id, { ...a, children: [] }]));
    const roots: any[] = [];
    for (const node of map.values()) {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(id: string) {
    const axis = await this.prisma.axis.findUnique({
      where: { id },
      include: {
        rubricLevels: { orderBy: { level: 'asc' } },
        mappings: {
          include: { question: { select: { id: true, text: true, type: true } } },
        },
      },
    });
    if (!axis) throw new NotFoundException('Axis not found');
    return axis;
  }

  async create(modelId: string, tenantId: string, dto: CreateAxisDto) {
    const model = await this.prisma.evaluationModel.findFirst({ where: { id: modelId, tenantId } });
    if (!model) throw new NotFoundException('Model not found');
    return this.prisma.axis.create({ data: { ...dto, modelId } });
  }

  async update(id: string, dto: Partial<CreateAxisDto>) {
    await this.findOne(id);
    return this.prisma.axis.update({ where: { id }, data: dto });
  }

  async upsertRubricLevel(axisId: string, dto: UpsertRubricLevelDto) {
    await this.findOne(axisId);

    // ルーブリックレベルの説明文をベクトル化（スコアリングエンジンがコサイン類似度で使用）
    const embeddingBuf = await this.generateEmbedding(dto.description);

    const data: any = { label: dto.label, description: dto.description };
    if (embeddingBuf) data.embedding = embeddingBuf;

    return this.prisma.axisRubricLevel.upsert({
      where: { axisId_level: { axisId, level: dto.level } },
      create: { axisId, level: dto.level, ...data },
      update: data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.axis.delete({ where: { id } });
  }
}
