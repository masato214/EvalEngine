import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class CreateApiKeyBody {
  @ApiProperty({ example: '採用アプリ用キー' })
  @IsString()
  @MinLength(1)
  name!: string;
}

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.apiKeysService.findAll(tenantId);
  }

  @Post()
  create(@CurrentTenant() tenantId: string, @Body() body: CreateApiKeyBody) {
    return this.apiKeysService.create(tenantId, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.apiKeysService.delete(id, tenantId);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.apiKeysService.revoke(id, tenantId);
  }
}
