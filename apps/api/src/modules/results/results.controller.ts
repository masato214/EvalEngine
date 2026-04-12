import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private resultsService: ResultsService) {}

  @Get()
  @ApiOperation({ summary: 'スコア結果一覧', description: 'テナント内の全スコア結果を取得します。`modelId` で評価モデルを絞り込めます。' })
  findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
    @Query('modelId') modelId?: string,
  ) {
    return this.resultsService.findAll(tenantId, pagination, modelId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'スコア結果詳細', description: '指定した結果IDの詳細（軸ごとのスコア・ルーブリックレベル含む）を取得します。' })
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.resultsService.findOne(id, tenantId);
  }

  @Get('respondent/:ref')
  @ApiOperation({ summary: '回答者別結果取得', description: '外部システムのユーザーID（respondentRef）で結果を絞り込みます。複数回の評価がある場合は全件返ります。' })
  findByRespondent(@Param('ref') ref: string, @CurrentTenant() tenantId: string) {
    return this.resultsService.findByRespondent(ref, tenantId);
  }
}
