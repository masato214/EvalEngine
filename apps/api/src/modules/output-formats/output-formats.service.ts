import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateOutputFormatDto {
  name: string;
  description?: string;
  outputType?: string;
  config?: Record<string, any>;
  promptTemplate?: string;
  axisWeights?: Record<string, any>;
  order?: number;
}

@Injectable()
export class OutputFormatsService {
  constructor(private prisma: PrismaService) {}

  async findAll(modelId: string, tenantId: string | undefined) {
    // Verify model belongs to tenant
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id: modelId, tenantId } : { id: modelId },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    return this.prisma.outputFormat.findMany({
      where: { modelId },
      orderBy: { order: 'asc' },
    });
  }

  async create(modelId: string, tenantId: string | undefined, dto: CreateOutputFormatDto) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id: modelId, tenantId } : { id: modelId },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    return this.prisma.outputFormat.create({
      data: {
        modelId,
        name: dto.name,
        description: dto.description,
        outputType: dto.outputType ?? 'TYPE_CLASSIFICATION',
        config: dto.config ?? {},
        promptTemplate: dto.promptTemplate,
        axisWeights: dto.axisWeights,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, tenantId: string | undefined, dto: Partial<CreateOutputFormatDto>) {
    const format = await this.prisma.outputFormat.findUnique({
      where: { id },
      include: { model: { select: { tenantId: true } } },
    });
    if (!format) throw new NotFoundException('Output format not found');
    if (tenantId && format.model.tenantId !== tenantId) throw new ForbiddenException();

    return this.prisma.outputFormat.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, tenantId: string | undefined) {
    const format = await this.prisma.outputFormat.findUnique({
      where: { id },
      include: { model: { select: { tenantId: true } } },
    });
    if (!format) throw new NotFoundException('Output format not found');
    if (tenantId && format.model.tenantId !== tenantId) throw new ForbiddenException();

    return this.prisma.outputFormat.delete({ where: { id } });
  }
}
