import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: { id: true, name: true, isActive: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, name: string) {
    const rawKey = `ek_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: { name, keyHash, tenantId },
      select: { id: true, name: true, createdAt: true },
    });

    // Return raw key only once — never stored in plain text
    return { ...apiKey, key: rawKey };
  }

  async revoke(id: string, tenantId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API key not found');
    return this.prisma.apiKey.update({ where: { id }, data: { isActive: false } });
  }

  async delete(id: string, tenantId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('API key not found');
    return this.prisma.apiKey.delete({ where: { id } });
  }
}
