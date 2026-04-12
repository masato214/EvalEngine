import { Controller, Post, Get, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnswersService } from './answers.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

class AnswerItemDto {
  @ApiProperty() @IsString() questionId!: string;
  @ApiProperty() value!: unknown;
}

class SubmitAnswerBody {
  @ApiProperty() @IsString() modelId!: string;
  @ApiProperty() @IsString() respondentRef!: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() respondentMeta?: Record<string, unknown>;
  @ApiProperty({ type: [AnswerItemDto] }) @IsArray() items!: AnswerItemDto[];
}

@ApiTags('answers')
@Controller('answers')
export class AnswersController {
  constructor(private answersService: AnswersService) {}

  @Post()
  @HttpCode(202)
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: '回答を送信',
    description: `外部アプリからAPIキーを使って回答を送信します。送信された回答は非同期でスコアリングされます。\n\n**ヘッダー**: \`X-Api-Key: <APIキー>\`\n\n送信後、\`answerId\` を使って \`GET /results?answerId=xxx\` でスコアを取得できます。`,
  })
  submit(@CurrentTenant() tenantId: string, @Body() dto: SubmitAnswerBody) {
    return this.answersService.submit(tenantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '回答一覧取得', description: 'テナント内の全回答を取得します。`modelId` クエリで絞り込み可能です。' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
    @Query('modelId') modelId?: string,
  ) {
    return this.answersService.findAll(tenantId, pagination, modelId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '回答詳細取得', description: '指定した回答IDの詳細（回答アイテム含む）を取得します。' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.answersService.findOne(id, tenantId);
  }
}
