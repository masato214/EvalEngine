import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeyStrategy } from '../../modules/auth/strategies/api-key.strategy';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtOrApiKeyAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
    private apiKeyStrategy: ApiKeyStrategy,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearerToken) {
      try {
        const payload = this.jwtService.verify(bearerToken, {
          secret: process.env.JWT_SECRET ?? 'dev-secret',
        });
        request.user = this.jwtStrategy.validate(payload);
        return true;
      } catch {
        throw new UnauthorizedException('Invalid bearer token');
      }
    }

    request.user = await this.apiKeyStrategy.validate(request);
    return true;
  }
}
