import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface CreateProjectDto {
  name: string;
  description?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string | undefined, pagination: PaginationDto) {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const where = tenantId ? { tenantId } : {};

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { evaluationModels: true } } },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string, tenantId: string | undefined) {
    const project = await this.prisma.project.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: { evaluationModels: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(tenantId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({ data: { ...dto, tenantId } });
  }

  async update(id: string, tenantId: string, dto: Partial<CreateProjectDto> & { isActive?: boolean }) {
    await this.findOne(id, tenantId);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.project.delete({ where: { id } });
  }
}
