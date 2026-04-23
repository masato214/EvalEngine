import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsObject, IsArray, IsBoolean,
} from 'class-validator';
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

class ExportResponsesCsvBody {
  @ApiPropertyOptional({ type: [String], description: '対象の質問グループID。未指定なら全質問グループを対象にする' })
  @IsOptional() @IsArray() @IsString({ each: true }) questionGroupIds?: string[];

  @ApiPropertyOptional({ type: [String], description: '対象の日付（YYYY-MM-DD）。未指定なら全日付を対象にする' })
  @IsOptional() @IsArray() @IsString({ each: true }) dates?: string[];

  @ApiPropertyOptional({ type: [String], description: 'CSVに含める基本列キー' })
  @IsOptional() @IsArray() @IsString({ each: true }) columnKeys?: string[];

  @ApiPropertyOptional({ type: [String], description: 'CSVに含める質問ID。未指定なら対象質問をすべて含める' })
  @IsOptional() @IsArray() @IsString({ each: true }) questionIds?: string[];

  @ApiPropertyOptional({ description: '質問グループの表示文がある場合はヘッダーに優先して使う', default: true })
  @IsOptional() @IsBoolean() useDisplayText?: boolean;
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

  @Get(':id/responses/export-options')
  @ApiOperation({ summary: '回答CSVエクスポート候補取得', description: '回答CSV出力に使う日付候補・質問グループ候補・基本列候補を返します。' })
  getResponseExportOptions(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.getResponseExportOptions(id, tenantId);
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

  @Post(':id/responses/export')
  @ApiOperation({ summary: '回答CSVエクスポート', description: '評価モデルごとの回答を、質問・質問グループ・日付・列選択に応じてCSV化します。' })
  exportResponsesCsv(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body() dto: ExportResponsesCsvBody,
  ) {
    return this.service.exportResponsesCsv(id, tenantId, dto);
  }
}
