import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private prisma: PrismaService) {
    super();
  }

  async validate(req: Request) {
    const apiKey = req.headers['x-api-key'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!apiKey || !tenantId) {
      throw new UnauthorizedException('Missing API key or tenant ID');
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const found = await this.prisma.apiKey.findFirst({
      where: { keyHash, isActive: true, tenantId },
    });

    if (!found) throw new UnauthorizedException('Invalid API key');

    await this.prisma.apiKey.update({
      where: { id: found.id },
      data: { lastUsed: new Date() },
    });

    return { tenantId, type: 'api-key' };
  }
}
