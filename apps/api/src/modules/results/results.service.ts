import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ResultsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string | undefined, pagination: PaginationDto, modelId?: string, latestOnly = true) {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const where = {
      ...(tenantId ? { tenantId } : {}),
      ...(modelId ? { modelId } : {}),
      ...(latestOnly ? { isLatest: true } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.result.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          model: {
            select: {
              id: true,
              name: true,
              projectId: true,
              project: { select: { id: true, name: true, tenantId: true } },
            },
          },
          answer: { select: { respondentMeta: true } },
          scores: { include: { axis: { select: { id: true, name: true } } } },
        },
      }),
      this.prisma.result.count({ where }),
    ]);

    return {
      data: data.map((r) => this._format(r)),
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string, tenantId: string | undefined) {
    const result = await this.prisma.result.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        scores: { include: { axis: { select: { id: true, name: true } } } },
        answer: { include: { items: true } },
      },
    });
    if (!result) throw new NotFoundException('Result not found');
    return this._format(result);
  }

  async findByRespondent(respondentRef: string, tenantId: string | undefined) {
    const results = await this.prisma.result.findMany({
      where: { respondentRef, ...(tenantId ? { tenantId } : {}), isLatest: true },
      orderBy: { createdAt: 'desc' },
      include: {
        answer: { select: { respondentMeta: true } },
        scores: { include: { axis: { select: { id: true, name: true } } } },
      },
    });
    return results.map((r) => this._format(r));
  }

  private _format(result: any) {
    const details = result.typeDetails && typeof result.typeDetails === 'object' ? result.typeDetails : {};
    return {
      id: result.id,
      answerId: result.answerId,
      sessionId: result.sessionId ?? null,
      modelId: result.modelId,
      modelVersion: result.modelVersion ?? 1,
      respondentRef: result.respondentRef,
      respondentName: result.answer?.respondentMeta?.name ?? null,
      overallScore: result.overallScore,
      isLatest: result.isLatest,
      resultType: result.resultType ?? null,
      typeDetails: result.typeDetails ?? null,
      formattedOutputs: (details as any).formattedOutputs ?? {},
      outputViews: (details as any).outputViews ?? [],
      summary: result.summary ?? null,
      explanation: result.explanation ?? null,
      recommendations: result.recommendations ?? [],
      scores: (result.scores ?? []).map((s: any) => ({
        axisId: s.axisId,
        axisName: s.axis?.name ?? '',
        rawScore: s.rawScore,
        normalizedScore: s.normalizedScore,
        rubricLevel: s.rubricLevel ?? null,
        tendency: s.tendency ?? null,
        details: s.details ?? null,
      })),
      tenantId: result.tenantId,
      tenant: result.tenant ?? null,
      model: result.model ?? null,
      createdAt: result.createdAt,
    };
  }
}
