import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationModelsService } from './evaluation-models.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

class CreateModelBody {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsString() projectId!: string;
}

class TestRunItemDto {
  @ApiProperty({ example: 'question-uuid', description: '質問ID' }) @IsString() questionId!: string;
  @ApiProperty({ description: '回答値（スケール値・選択肢value・テキストなど）' }) value!: unknown;
}

class TestRunBody {
  @ApiProperty({ example: 'test-user-001', description: 'テスト回答者の識別子（任意文字列）' }) @IsString() respondentRef!: string;
  @ApiPropertyOptional({ description: 'この質問グループに含まれる質問だけでテスト実行する' }) @IsOptional() @IsString() questionGroupId?: string;
  @ApiPropertyOptional({ type: [String], description: '生成する出力形式ID。未指定なら全出力形式を生成する' }) @IsOptional() @IsArray() @IsString({ each: true }) outputFormatIds?: string[];
  @ApiProperty({ type: [TestRunItemDto] }) @IsArray() items!: TestRunItemDto[];
}

class UpsertResultTemplateBody {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() outputType!: string;
  @ApiProperty() @IsObject() config!: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() promptTemplate?: string;
}

@ApiTags('evaluation-models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluation-models')
export class EvaluationModelsController {
  constructor(private service: EvaluationModelsService) {}

  @Get()
  @ApiOperation({ summary: '評価モデル一覧', description: 'テナント内の評価モデル一覧を取得します。評価軸数・回答数のカウントも含まれます。' })
  findAll(@CurrentTenant() tenantId: string, @Query() pagination: PaginationDto) {
    return this.service.findAll(tenantId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: '評価モデル詳細', description: '評価軸ツリー・質問・出力形式・ルーブリックレベルを含む全詳細を取得します。' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Post()
  @ApiOperation({ summary: '評価モデル作成', description: '新しい評価モデルを作成します。作成後はステータス `DRAFT` で開始します。評価軸・質問は別途追加してください。' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateModelBody) {
    return this.service.create(tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '評価モデル更新', description: '名前・説明・ステータスを更新します。`PUBLISHED` にすると外部からの回答送信が可能になります。' })
  update(@Param('id') id: string, @CurrentTenant() tenantId: string, @Body() dto: Partial<CreateModelBody>) {
    return this.service.update(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '評価モデル削除', description: '評価モデルを削除します。関連する評価軸・質問・回答・結果もすべて削除されます。この操作は取り消せません。' })
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.remove(id, tenantId);
  }

  @Post(':id/snapshot')
  @ApiOperation({
    summary: 'バージョンスナップショット作成',
    description: '現在のモデルを完全複製して新バージョン（version+1）を作成します。評価軸・質問・ルーブリックレベル・出力形式がすべてコピーされます。新バージョンは `DRAFT` 状態で作成されます。',
  })
  snapshot(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.snapshot(id, tenantId);
  }

  @Post(':id/test-run')
  @ApiOperation({
    summary: 'テスト実行（同期スコアリング）',
    description: 'ステータスに関係なくテスト回答を送信し、即時スコアを算出します。AIエンベディングなしの簡易スコアリングです。本番回答には影響しません。',
  })
  testRun(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: TestRunBody,
  ) {
    return this.service.testRun(id, tenantId, dto);
  }

  @Get(':id/result-template')
  @ApiOperation({ summary: '結果テンプレート取得', description: 'AI結果生成に使うプロンプトテンプレートを取得します。' })
  getResultTemplate(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.getResultTemplate(id, tenantId);
  }

  @Post(':id/result-template')
  @ApiOperation({ summary: '結果テンプレート保存', description: 'AI結果生成に使うプロンプトテンプレートを作成・更新します（Upsert）。' })
  upsertResultTemplate(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpsertResultTemplateBody,
  ) {
    return this.service.upsertResultTemplate(id, tenantId, dto);
  }
}
