import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface CreateUserDto {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string | undefined, pagination: PaginationDto) {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const where = tenantId ? { tenantId } : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, tenantId: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email_tenantId: { email: dto.email, tenantId } },
    });
    if (existing) throw new ConflictException('このメールアドレスはすでに使用されています');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name, role: dto.role, tenantId },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    return user;
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('ユーザーが見つかりません');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('ユーザーが見つかりません');
    await this.prisma.user.delete({ where: { id } });
  }
}
