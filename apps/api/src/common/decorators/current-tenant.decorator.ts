import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    // SUPER_ADMIN はテナント制限なし（全テナントのデータを参照可能）
    if (user?.role === 'SUPER_ADMIN') return undefined;
    return user?.tenantId as string;
  },
);
