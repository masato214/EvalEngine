import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AxesService } from './axes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class CreateAxisBody {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: 1.0 }) @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idealStateText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lowStateText?: string;
}

class UpsertRubricLevelBody {
  @ApiProperty({ description: '1–5' }) @IsInt() @Min(1) @Max(5) level!: number;
  @ApiProperty() @IsString() label!: string;
  @ApiProperty() @IsString() description!: string;
}

@ApiTags('axes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluation-models/:modelId/axes')
export class AxesController {
  constructor(private axesService: AxesService) {}

  @Get()
  findAll(@Param('modelId') modelId: string, @CurrentTenant() tenantId: string) {
    return this.axesService.findAll(modelId, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.axesService.findOne(id);
  }

  @Post()
  create(
    @Param('modelId') modelId: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateAxisBody,
  ) {
    return this.axesService.create(modelId, tenantId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateAxisBody>) {
    return this.axesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.axesService.remove(id);
  }

  // ── Rubric levels ────────────────────────────────────────────────────────

  @Post(':id/rubric-levels')
  upsertRubricLevel(
    @Param('id') axisId: string,
    @Body() dto: UpsertRubricLevelBody,
  ) {
    return this.axesService.upsertRubricLevel(axisId, dto);
  }
}
