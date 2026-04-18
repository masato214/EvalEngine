import {
  Body, Controller, Delete, Get, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, Min,
} from 'class-validator';
import { QuestionGroupType } from '@prisma/client';
import { QuestionGroupsService } from './question-groups.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class CreateQuestionGroupBody {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: QuestionGroupType }) @IsOptional() @IsEnum(QuestionGroupType) groupType?: QuestionGroupType;
  @ApiPropertyOptional() @IsOptional() @IsObject() config?: Record<string, unknown>;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) order?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

class QuestionGroupItemBody {
  @ApiProperty() @IsString() questionId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() displayText?: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() block?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shuffleGroup?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() contributionWeight?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

class ReplaceItemsBody {
  @ApiProperty({ type: [QuestionGroupItemBody] }) @IsArray() items!: QuestionGroupItemBody[];
}

@ApiTags('question-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluation-models/:modelId/question-groups')
export class QuestionGroupsController {
  constructor(private service: QuestionGroupsService) {}

  @Get()
  findAll(@Param('modelId') modelId: string, @CurrentTenant() tenantId: string | undefined) {
    return this.service.findAll(modelId, tenantId);
  }

  @Get(':id')
  findOne(
    @Param('modelId') modelId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.service.findOne(modelId, id, tenantId);
  }

  @Post()
  create(
    @Param('modelId') modelId: string,
    @CurrentTenant() tenantId: string | undefined,
    @Body() dto: CreateQuestionGroupBody,
  ) {
    return this.service.create(modelId, tenantId, dto);
  }

  @Put(':id')
  update(
    @Param('modelId') modelId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string | undefined,
    @Body() dto: Partial<CreateQuestionGroupBody>,
  ) {
    return this.service.update(modelId, id, tenantId, dto);
  }

  @Delete(':id')
  remove(
    @Param('modelId') modelId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string | undefined,
  ) {
    return this.service.remove(modelId, id, tenantId);
  }

  @Put(':id/items')
  replaceItems(
    @Param('modelId') modelId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string | undefined,
    @Body() dto: ReplaceItemsBody,
  ) {
    return this.service.replaceItems(modelId, id, tenantId, dto.items);
  }
}
