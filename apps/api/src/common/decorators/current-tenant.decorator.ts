import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    // SUPER_ADMIN はテナント制限なし。x-tenant-id がある場合だけ対象テナントに切り替える。
    if (user?.role === 'SUPER_ADMIN') {
      const selectedTenantId = request.headers['x-tenant-id'];
      return Array.isArray(selectedTenantId) ? selectedTenantId[0] : selectedTenantId;
    }
    return user?.tenantId as string;
  },
);
