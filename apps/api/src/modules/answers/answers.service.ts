import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '@evalengine/config';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface SubmitAnswerDto {
  modelId: string;
  respondentRef: string;
  respondentMeta?: Record<string, unknown>;
  items: Array<{ questionId: string; value: unknown }>;
}

@Injectable()
export class AnswersService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.ANALYSIS) private analysisQueue: Queue,
  ) {}

  async submit(tenantId: string, dto: SubmitAnswerDto) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: { id: dto.modelId, tenantId, status: 'PUBLISHED' },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    const answer = await this.prisma.answer.create({
      data: {
        modelId: dto.modelId,
        respondentRef: dto.respondentRef,
        respondentMeta: (dto.respondentMeta ?? null) as any,
        tenantId,
        items: {
          create: dto.items.map((item) => ({
            questionId: item.questionId,
            value: item.value as any,
          })),
        },
      },
      include: { items: true },
    });

    await this.analysisQueue.add('analyze', { answerId: answer.id, tenantId });

    return { answerId: answer.id, status: 'PENDING' };
  }

  async findAll(tenantId: string, pagination: PaginationDto, modelId?: string) {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const where = { tenantId, ...(modelId ? { modelId } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.answer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.answer.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string, tenantId: string) {
    const answer = await this.prisma.answer.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });
    if (!answer) throw new NotFoundException('Answer not found');
    return answer;
  }
}
