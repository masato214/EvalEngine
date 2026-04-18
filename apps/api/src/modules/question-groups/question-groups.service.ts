import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QuestionGroupType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateQuestionGroupDto {
  name: string;
  description?: string;
  groupType?: QuestionGroupType;
  config?: Record<string, unknown>;
  order?: number;
  isActive?: boolean;
}

export interface UpsertQuestionGroupItemDto {
  questionId: string;
  displayText?: string;
  order?: number;
  block?: string;
  shuffleGroup?: string;
  required?: boolean;
  contributionWeight?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class QuestionGroupsService {
  constructor(private prisma: PrismaService) {}

  async findAll(modelId: string, tenantId: string | undefined) {
    await this.ensureModel(modelId, tenantId);
    return this.prisma.questionGroup.findMany({
      where: { modelId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { items: true, sessions: true } },
      },
    });
  }

  async findOne(modelId: string, id: string, tenantId: string | undefined) {
    await this.ensureModel(modelId, tenantId);
    const group = await this.prisma.questionGroup.findFirst({
      where: { id, modelId },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { order: 'asc' } },
                axisMappings: {
                  include: { axis: { select: { id: true, name: true, weight: true, parentId: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Question group not found');
    return group;
  }

  async create(modelId: string, tenantId: string | undefined, dto: CreateQuestionGroupDto) {
    await this.ensureModel(modelId, tenantId);
    return this.prisma.questionGroup.create({
      data: {
        modelId,
        name: dto.name,
        description: dto.description,
        groupType: dto.groupType ?? QuestionGroupType.CUSTOM,
        config: (dto.config ?? {}) as any,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(modelId: string, id: string, tenantId: string | undefined, dto: Partial<CreateQuestionGroupDto>) {
    await this.findOne(modelId, id, tenantId);
    return this.prisma.questionGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.groupType !== undefined ? { groupType: dto.groupType } : {}),
        ...(dto.config !== undefined ? { config: dto.config as any } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(modelId: string, id: string, tenantId: string | undefined) {
    await this.findOne(modelId, id, tenantId);
    return this.prisma.questionGroup.delete({ where: { id } });
  }

  async replaceItems(
    modelId: string,
    groupId: string,
    tenantId: string | undefined,
    items: UpsertQuestionGroupItemDto[],
  ) {
    await this.findOne(modelId, groupId, tenantId);
    const questionIds = [...new Set(items.map((item) => item.questionId))];
    if (questionIds.length !== items.length) {
      throw new BadRequestException('同じ質問IDが重複しています');
    }
    const count = await this.prisma.question.count({
      where: { id: { in: questionIds }, modelId },
    });
    if (count !== questionIds.length) {
      throw new BadRequestException('質問グループには、同じ評価モデルに属する質問だけを追加できます');
    }

    await this.prisma.$transaction([
      this.prisma.questionGroupItem.deleteMany({ where: { groupId } }),
      ...items.map((item, index) => this.prisma.questionGroupItem.create({
        data: {
          groupId,
          questionId: item.questionId,
          displayText: item.displayText,
          order: item.order ?? index,
          block: item.block,
          shuffleGroup: item.shuffleGroup,
          required: item.required ?? true,
          contributionWeight: item.contributionWeight,
          metadata: (item.metadata ?? {}) as any,
        },
      })),
    ]);

    return this.findOne(modelId, groupId, tenantId);
  }

  private async ensureModel(modelId: string, tenantId: string | undefined) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id: modelId, tenantId } : { id: modelId },
      select: { id: true },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');
    return model;
  }
}
