import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OutputFormatsService } from './output-formats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class CreateOutputFormatBody {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outputType?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() config?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() promptTemplate?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() axisWeights?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) order?: number;
}

@ApiTags('output-formats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluation-models/:modelId/output-formats')
export class OutputFormatsController {
  constructor(private outputFormatsService: OutputFormatsService) {}

  @Get()
  findAll(@Param('modelId') modelId: string, @CurrentTenant() tenantId: string | undefined) {
    return this.outputFormatsService.findAll(modelId, tenantId);
  }

  @Post()
  create(
    @Param('modelId') modelId: string,
    @Body() dto: CreateOutputFormatBody,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.outputFormatsService.create(modelId, tenantId, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateOutputFormatBody>,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.outputFormatsService.update(id, tenantId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string | undefined) {
    return this.outputFormatsService.remove(id, tenantId);
  }
}
