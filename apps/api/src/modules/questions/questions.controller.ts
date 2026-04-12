import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsOptional, IsNumber, IsBoolean, Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionType } from '@prisma/client';
import { QuestionsService } from './questions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class CreateQuestionBody {
  @ApiProperty() @IsString() text!: string;
  @ApiProperty({ enum: QuestionType }) @IsEnum(QuestionType) type!: QuestionType;
  @ApiPropertyOptional() @IsOptional() @IsNumber() scaleMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() scaleMax?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() scaleMinLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scaleMaxLabel?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) order?: number;
}

class UpsertOptionBody {
  @ApiProperty() @IsString() label!: string;
  @ApiProperty() @IsString() value!: string;
  @ApiProperty() @IsString() text!: string; // semantic text for embedding
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() explicitWeight?: number;
}

class UpsertAxisMappingBody {
  @ApiProperty() @IsString() axisId!: string;
  @ApiPropertyOptional({ default: 1.0 }) @IsOptional() @IsNumber() contributionWeight?: number;
}

class UpsertCriteriaBody {
  @ApiProperty() @IsNumber() level!: number;
  @ApiProperty() @IsString() label!: string;
  @ApiProperty() @IsString() description!: string;
}

@ApiTags('questions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluation-models/:modelId/questions')
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Get()
  findAll(@Param('modelId') modelId: string) {
    return this.questionsService.findAll(modelId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Post()
  create(@Param('modelId') modelId: string, @Body() dto: CreateQuestionBody) {
    return this.questionsService.create(modelId, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateQuestionBody>) {
    return this.questionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }

  // ── Options ─────────────────────────────────────────────────────────────

  @Post(':id/options')
  upsertOption(
    @Param('id') questionId: string,
    @Body() dto: UpsertOptionBody & { optionId?: string },
  ) {
    const { optionId, ...rest } = dto;
    return this.questionsService.upsertOption(questionId, optionId, rest);
  }

  @Delete(':id/options/:optionId')
  removeOption(@Param('optionId') optionId: string) {
    return this.questionsService.removeOption(optionId);
  }

  // ── Axis mappings ────────────────────────────────────────────────────────

  @Post(':id/axis-mappings')
  upsertAxisMapping(
    @Param('id') questionId: string,
    @Body() dto: UpsertAxisMappingBody,
  ) {
    return this.questionsService.upsertAxisMapping(questionId, dto);
  }

  @Delete(':id/axis-mappings/:axisId')
  removeAxisMapping(
    @Param('id') questionId: string,
    @Param('axisId') axisId: string,
  ) {
    return this.questionsService.removeAxisMapping(questionId, axisId);
  }

  // ── Criteria ─────────────────────────────────────────────────────────────

  @Get(':id/criteria')
  findCriteria(@Param('id') questionId: string) {
    return this.questionsService.findCriteria(questionId);
  }

  @Post(':id/criteria')
  upsertCriteria(
    @Param('id') questionId: string,
    @Body() dto: UpsertCriteriaBody,
  ) {
    return this.questionsService.upsertCriteria(questionId, dto);
  }

  @Delete(':id/criteria/:level')
  removeCriteria(
    @Param('id') questionId: string,
    @Param('level', ParseIntPipe) level: number,
  ) {
    return this.questionsService.removeCriteria(questionId, level);
  }
}
