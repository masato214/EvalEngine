import {
  Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiSecurity, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class CreateSessionBody {
  @ApiProperty() @IsString() modelId!: string;
  @ApiProperty() @IsString() userExternalId!: string;
  @ApiPropertyOptional({ description: '使用する質問グループID。指定した場合、そのグループに含まれる質問だけを配信します。' })
  @IsOptional() @IsString() questionGroupId?: string;
  @ApiPropertyOptional({ type: [String], description: 'このセッションで出題する質問ID。未指定の場合はモデル内の全質問を使用します。' })
  @IsOptional() @IsArray() @IsString({ each: true }) questionIds?: string[];
  @ApiPropertyOptional({ type: [String], description: 'このセッションで生成する出力形式ID。未指定の場合はモデル内の全出力形式を使用します。' })
  @IsOptional() @IsArray() @IsString({ each: true }) outputFormatIds?: string[];
}

class AnswerItemDto {
  @ApiProperty() @IsString() questionId!: string;
  @ApiProperty() value!: unknown;
}

class SubmitAnswersBody {
  @ApiPropertyOptional() @IsOptional() @IsObject() respondentMeta?: Record<string, unknown>;
  @ApiProperty({ type: [AnswerItemDto] }) @IsArray() items!: AnswerItemDto[];
}

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post()
  @HttpCode(201)
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: 'セッション開始',
    description: '外部アプリからAPIキーでセッションを開始します。`sessionId` を取得し、以後の質問取得・回答送信に使用します。',
  })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateSessionBody) {
    return this.sessionsService.create(tenantId, dto);
  }

  @Get()
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'セッション一覧', description: '管理画面用。テナント内のセッション一覧を取得します。`modelId` で絞り込み可能。' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('modelId') modelId?: string,
  ) {
    return this.sessionsService.findAll(tenantId, modelId);
  }

  @Get('respondents/:ref/results')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '回答者別の結果履歴・成長度取得', description: '外部アプリからAPIキーで、ユーザーごとの時系列結果・前回差分・初回差分を取得します。' })
  findRespondentResults(
    @Param('ref') ref: string,
    @CurrentTenant() tenantId: string,
    @Query('modelId') modelId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sessionsService.findRespondentResults(tenantId, ref, modelId, from, to);
  }

  @Get('respondents/:ref/profile')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '回答者別の統合評価プロフィール取得', description: '複数の質問グループ/調査回の結果を軸単位で統合し、評価モデル全体の最新プロフィールを返します。' })
  findRespondentProfile(
    @Param('ref') ref: string,
    @CurrentTenant() tenantId: string,
    @Query('modelId') modelId: string,
  ) {
    return this.sessionsService.findRespondentProfile(tenantId, ref, modelId);
  }

  @Get('models/:modelId/aggregate')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '評価モデル全体の集計取得', description: '外部アプリからAPIキーで、モデル全体の平均・分布・軸別平均を取得します。' })
  aggregateModelResults(
    @Param('modelId') modelId: string,
    @CurrentTenant() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sessionsService.aggregateModelResults(tenantId, modelId, from, to);
  }

  @Get(':id')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'セッション詳細取得', description: 'セッションの現在ステータスや関連情報を取得します。' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.sessionsService.findOne(id, tenantId);
  }

  @Get(':id/questions')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: '質問一覧取得',
    description: 'セッションに紐づく評価モデルの質問一覧を取得します。外部アプリはこのエンドポイントで質問を取得してUIを構築します。',
  })
  getQuestions(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.sessionsService.getQuestions(id, tenantId);
  }

  @Post(':id/answers')
  @HttpCode(202)
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: '回答送信',
    description: 'セッションに対して回答を送信します。送信後は非同期でスコアリングが開始されます。`POST /:id/analyze` で分析を明示的にトリガーすることもできます。',
  })
  submitAnswers(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: SubmitAnswersBody,
  ) {
    return this.sessionsService.submitAnswers(id, tenantId, dto);
  }

  @Post(':id/analyze')
  @HttpCode(202)
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'スコアリング実行', description: '回答に対してAIスコアリングを実行します。通常は回答送信後に自動で開始されますが、再実行したい場合に使用します。' })
  analyze(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.sessionsService.analyze(id, tenantId);
  }

  @Get(':id/result')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '最新スコア結果取得', description: 'セッションの最新スコア結果（軸ごとのスコア・総合スコア）を取得します。スコアリング完了前は `null` が返ります。' })
  getResult(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.sessionsService.getResult(id, tenantId);
  }

  @Get(':id/results')
  @ApiSecurity('api-key')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '全スコア履歴取得', description: '再計算を含む全スコア結果の履歴を取得します。`isLatest: true` のものが最新結果です。' })
  getResults(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.sessionsService.getResults(id, tenantId);
  }
}
