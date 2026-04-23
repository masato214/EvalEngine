import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModelStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AnalysisService } from '../analysis/analysis.service';
import type { ScoringItem, AxisScoringInfo } from '@evalengine/types';

export interface CreateModelDto {
  name: string;
  description?: string;
  projectId: string;
}

const EXPORTABLE_BASE_COLUMNS = [
  { key: 'answeredAt', label: '回答日時' },
  { key: 'sessionDate', label: 'アンケート日' },
  { key: 'questionGroup', label: '質問グループ' },
  { key: 'respondentId', label: '回答者ID' },
  { key: 'respondentName', label: '回答者名' },
  { key: 'sessionStatus', label: 'ステータス' },
  { key: 'sessionId', label: 'セッションID' },
] as const;

type ExportableBaseColumnKey = (typeof EXPORTABLE_BASE_COLUMNS)[number]['key'];

interface ExportResponsesCsvDto {
  questionGroupIds?: string[];
  dates?: string[];
  columnKeys?: string[];
  questionIds?: string[];
  useDisplayText?: boolean;
}

/** Decode a Bytes-stored Float32 embedding buffer back to number[] */
function decodeEmbedding(buf: unknown): number[] | undefined {
  if (!buf) return undefined;
  try {
    const floats = new Float32Array(Buffer.from(buf as Buffer).buffer);
    return Array.from(floats);
  } catch {
    return undefined;
  }
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function normalizeDateKey(value: Date | string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function optionLabel(option: any, orderIndex: number) {
  const parts = [`${orderIndex + 1}. ${option.label ?? option.value}`];
  if (option.text && option.text !== option.label) parts.push(`(${option.text})`);
  return parts.join(' ');
}

@Injectable()
export class EvaluationModelsService {
  constructor(
    private prisma: PrismaService,
    private analysisService: AnalysisService,
  ) {}

  async findAll(tenantId: string | undefined, pagination: PaginationDto) {
    const { page, pageSize } = pagination;
    const skip = (page - 1) * pageSize;
    const where = tenantId ? { tenantId } : {};

    const [data, total] = await Promise.all([
      this.prisma.evaluationModel.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          project: { select: { id: true, name: true, tenantId: true } },
          _count: { select: { axes: true, answers: true } },
        },
      }),
      this.prisma.evaluationModel.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(id: string, tenantId: string | undefined) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        axes: {
          where: { parentId: null },
          orderBy: { order: 'asc' },
          include: {
            rubricLevels: { orderBy: { level: 'asc' } },
            mappings: {
              include: {
                question: {
                  select: {
                    id: true,
                    text: true,
                    type: true,
                    order: true,
                    scaleMin: true,
                    scaleMax: true,
                    scaleMinLabel: true,
                    scaleMaxLabel: true,
                    required: true,
                    options: { orderBy: { order: 'asc' }, select: { id: true, label: true, value: true, order: true, explicitWeight: true } },
                    criteria: { orderBy: { level: 'asc' } },
                  },
                },
              },
            },
            _count: { select: { children: true, mappings: true } },
            children: {
              orderBy: { order: 'asc' },
              include: {
                rubricLevels: { orderBy: { level: 'asc' } },
                mappings: {
                  include: {
                    question: {
                      select: {
                        id: true,
                        text: true,
                        type: true,
                        order: true,
                        scaleMin: true,
                        scaleMax: true,
                        scaleMinLabel: true,
                        scaleMaxLabel: true,
                        required: true,
                        options: { orderBy: { order: 'asc' }, select: { id: true, label: true, value: true, order: true, explicitWeight: true } },
                        criteria: { orderBy: { level: 'asc' } },
                      },
                    },
                  },
                },
                _count: { select: { children: true, mappings: true } },
                children: {
                  orderBy: { order: 'asc' },
                  include: {
                    rubricLevels: { orderBy: { level: 'asc' } },
                    mappings: {
                      include: {
                        question: {
                          select: {
                            id: true,
                            text: true,
                            type: true,
                            order: true,
                            scaleMin: true,
                            scaleMax: true,
                            scaleMinLabel: true,
                            scaleMaxLabel: true,
                            required: true,
                            options: { orderBy: { order: 'asc' }, select: { id: true, label: true, value: true, order: true, explicitWeight: true } },
                            criteria: { orderBy: { level: 'asc' } },
                          },
                        },
                      },
                    },
                    _count: { select: { children: true, mappings: true } },
                  },
                },
              },
            },
          },
        },
        resultTemplate: true,
        outputFormats: { orderBy: { order: 'asc' } },
        questionGroups: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
              select: {
                questionId: true,
                displayText: true,
                order: true,
                block: true,
                shuffleGroup: true,
                required: true,
                contributionWeight: true,
                metadata: true,
              },
            },
            _count: { select: { items: true, sessions: true } },
          },
        },
      },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');
    return model;
  }

  async getResultTemplate(modelId: string, tenantId: string) {
    await this.findOne(modelId, tenantId);
    return this.prisma.resultTemplate.findUnique({ where: { modelId } });
  }

  async getResponseExportOptions(modelId: string, tenantId: string | undefined) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id: modelId, tenantId } : { id: modelId },
      include: {
        questionGroups: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            groupType: true,
            items: {
              orderBy: { order: 'asc' },
              select: { questionId: true },
            },
            _count: { select: { sessions: true } },
          },
        },
      },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    const sessions = await this.prisma.session.findMany({
      where: {
        modelId,
        ...(tenantId ? { tenantId } : {}),
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const dates = Array.from(
      sessions.reduce((map, session) => {
        const key = normalizeDateKey(session.createdAt);
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    )
      .map(([value, count]) => ({ value, label: value.replace(/-/g, '/'), count }))
      .sort((a, b) => b.value.localeCompare(a.value));

    return {
      dates,
      questionGroups: model.questionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        groupType: group.groupType,
        questionIds: group.items.map((item) => item.questionId),
        sessionCount: group._count.sessions,
      })),
      baseColumns: EXPORTABLE_BASE_COLUMNS,
    };
  }

  async exportResponsesCsv(modelId: string, tenantId: string | undefined, dto: ExportResponsesCsvDto) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id: modelId, tenantId } : { id: modelId },
      include: {
        questionGroups: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { order: 'asc' },
              include: {
                question: {
                  include: {
                    options: { orderBy: { order: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    const allQuestions = await this.prisma.question.findMany({
      where: { modelId },
      include: {
        options: { orderBy: { order: 'asc' } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const questionById = new Map(allQuestions.map((question) => [question.id, question]));
    const selectedGroupIds = [...new Set(dto.questionGroupIds ?? [])];
    const selectedDates = new Set((dto.dates ?? []).filter(Boolean));
    const defaultQuestionIds = selectedGroupIds.length > 0
      ? model.questionGroups
        .filter((group) => selectedGroupIds.includes(group.id))
        .flatMap((group) => group.items.map((item) => item.questionId))
      : allQuestions.map((question) => question.id);
    const requestedQuestionIds = dto.questionIds?.length ? dto.questionIds : defaultQuestionIds;
    const selectedQuestionIds = Array.from(new Set(requestedQuestionIds)).filter((questionId) => questionById.has(questionId));

    if (selectedQuestionIds.length === 0) {
      throw new BadRequestException('CSVに含める質問が選択されていません');
    }

    const selectedColumnKeys = ((dto.columnKeys?.length ? dto.columnKeys : ['answeredAt', 'sessionDate', 'questionGroup', 'respondentId', 'respondentName']) as string[])
      .filter((key): key is ExportableBaseColumnKey => EXPORTABLE_BASE_COLUMNS.some((column) => column.key === key));

    const sessions = await this.prisma.session.findMany({
      where: {
        modelId,
        ...(tenantId ? { tenantId } : {}),
        ...(selectedGroupIds.length > 0 ? { questionGroupId: { in: selectedGroupIds } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        questionGroup: { select: { id: true, name: true } },
        answers: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            respondentRef: true,
            respondentMeta: true,
            status: true,
            createdAt: true,
            items: {
              orderBy: { createdAt: 'asc' },
              select: { questionId: true, value: true },
            },
          },
        },
      },
    });

    const filteredSessions = sessions.filter((session) => {
      if (selectedDates.size === 0) return true;
      return selectedDates.has(normalizeDateKey(session.createdAt));
    });

    const displayTextByQuestionId = new Map<string, string>();
    if (dto.useDisplayText !== false && selectedGroupIds.length === 1) {
      const group = model.questionGroups.find((item) => item.id === selectedGroupIds[0]);
      for (const item of group?.items ?? []) {
        if (item.displayText) displayTextByQuestionId.set(item.questionId, item.displayText);
      }
    }

    const orderedSelectedQuestions = allQuestions
      .filter((question) => selectedQuestionIds.includes(question.id))
      .map((question) => ({
        ...question,
        headerText: displayTextByQuestionId.get(question.id) ?? question.text,
      }));

    const rows = filteredSessions.map((session, index) => {
      const latestAnswer = session.answers[0] ?? null;
      const answerItems = new Map((latestAnswer?.items ?? []).map((item) => [item.questionId, item.value]));
      const respondentName = latestAnswer?.respondentMeta && typeof latestAnswer.respondentMeta === 'object'
        ? (latestAnswer.respondentMeta as Record<string, unknown>).name
        : null;
      const baseValues: Record<ExportableBaseColumnKey, string> = {
        answeredAt: latestAnswer?.createdAt ? new Date(latestAnswer.createdAt).toLocaleString('ja-JP') : '',
        sessionDate: session.createdAt ? new Date(session.createdAt).toLocaleDateString('ja-JP') : '',
        questionGroup: session.questionGroup?.name ?? '',
        respondentId: latestAnswer?.respondentRef ?? session.userExternalId,
        respondentName: respondentName ? String(respondentName) : '',
        sessionStatus: session.status,
        sessionId: session.id,
      };

      const questionValues = orderedSelectedQuestions.map((question) => (
        this.formatCsvAnswerValue(question, answerItems.get(question.id))
      ));

      return [
        String(index + 1),
        ...selectedColumnKeys.map((key) => baseValues[key]),
        ...questionValues,
      ];
    });

    const headerRow = [
      'No',
      ...selectedColumnKeys.map((key) => EXPORTABLE_BASE_COLUMNS.find((column) => column.key === key)?.label ?? key),
      ...orderedSelectedQuestions.map((question) => question.headerText),
    ];

    const csv = [
      headerRow,
      ...rows,
    ]
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n');

    const groupPart = selectedGroupIds.length === 1
      ? model.questionGroups.find((group) => group.id === selectedGroupIds[0])?.name ?? 'filtered'
      : 'all-groups';
    const filename = `responses-${model.name}-${groupPart}-${new Date().toISOString().slice(0, 10)}.csv`
      .replace(/[\\/:*?"<>|]/g, '_');

    return {
      filename,
      csv,
      rowCount: rows.length,
      questionCount: orderedSelectedQuestions.length,
    };
  }

  async upsertResultTemplate(
    modelId: string,
    tenantId: string,
    dto: { name: string; outputType: string; config: any; promptTemplate?: string },
  ) {
    await this.findOne(modelId, tenantId);
    return this.prisma.resultTemplate.upsert({
      where: { modelId },
      create: { modelId, ...dto },
      update: dto,
    });
  }

  private formatCsvAnswerValue(question: any, rawValue: unknown) {
    if (rawValue === null || rawValue === undefined || rawValue === '') return '';

    if (question.type === 'SINGLE_CHOICE') {
      const selected = question.options?.find((option: any) => option.value === String(rawValue));
      if (!selected) return String(rawValue);
      const orderIndex = question.options.findIndex((option: any) => option.id === selected.id);
      return optionLabel(selected, orderIndex >= 0 ? orderIndex : 0);
    }

    if (question.type === 'MULTIPLE_CHOICE') {
      const values = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue)];
      return values
        .map((value) => {
          const selected = question.options?.find((option: any) => option.value === value);
          if (!selected) return value;
          const orderIndex = question.options.findIndex((option: any) => option.id === selected.id);
          return optionLabel(selected, orderIndex >= 0 ? orderIndex : 0);
        })
        .join(' / ');
    }

    if (question.type === 'SCALE') {
      const numericValue = Number(rawValue);
      if (Number.isFinite(numericValue)) {
        if (question.scaleMinLabel && numericValue === question.scaleMin) {
          return `${numericValue} (${question.scaleMinLabel})`;
        }
        if (question.scaleMaxLabel && numericValue === question.scaleMax) {
          return `${numericValue} (${question.scaleMaxLabel})`;
        }
        return String(numericValue);
      }
    }

    return String(rawValue);
  }

  async create(tenantId: string, dto: CreateModelDto) {
    return this.prisma.evaluationModel.create({ data: { ...dto, tenantId } });
  }

  async update(
    id: string,
    tenantId: string,
    dto: { name?: string; description?: string; status?: ModelStatus },
  ) {
    await this.findOne(id, tenantId);
    return this.prisma.evaluationModel.update({ where: { id }, data: dto });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.evaluationModel.delete({ where: { id } });
  }

  async testRun(
    id: string,
    tenantId: string | undefined,
    dto: {
      respondentRef: string;
      questionGroupId?: string;
      outputFormatIds?: string[];
      items: { questionId: string; value: unknown }[];
    },
  ) {
    // ── 1. Load full model: all axes (flat) with rubric embeddings + question options ──
    const model = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        outputFormats: { orderBy: { order: 'asc' } },
        questionGroups: {
          include: {
            items: { orderBy: { order: 'asc' }, select: { questionId: true } },
          },
        },
        axes: {
          orderBy: { order: 'asc' },
          include: {
            rubricLevels: { orderBy: { level: 'asc' } },
            mappings: {
              include: {
                question: {
                  include: {
                    options: { orderBy: { order: 'asc' } },
                    axisMappings: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    const questionGroup = dto.questionGroupId
      ? (model as any).questionGroups.find((group: any) => group.id === dto.questionGroupId)
      : null;
    if (dto.questionGroupId && !questionGroup) {
      throw new BadRequestException('指定された質問グループがこの評価モデルに存在しません');
    }
    const groupQuestionIds = questionGroup
      ? new Set((questionGroup.items ?? []).map((item: any) => item.questionId))
      : null;
    if (groupQuestionIds && dto.items.some((item) => !groupQuestionIds.has(item.questionId))) {
      throw new BadRequestException('指定された質問グループに含まれない質問が送信されています');
    }

    const requestedOutputFormatIds = [...new Set(dto.outputFormatIds ?? [])];
    const outputFormats = requestedOutputFormatIds.length > 0
      ? ((model as any).outputFormats as any[]).filter((fmt) => requestedOutputFormatIds.includes(fmt.id))
      : ((model as any).outputFormats as any[]);
    if (requestedOutputFormatIds.length > 0 && outputFormats.length !== requestedOutputFormatIds.length) {
      throw new BadRequestException('指定された出力形式がこの評価モデルに存在しません');
    }

    const answerMap = new Map(dto.items.map((i) => [i.questionId, i.value]));
    const submittedQuestionIds = new Set(dto.items.map((i) => i.questionId));

    // ── 2. Collect all unique questions across leaf axes ──────────────────────
    const questionMap = new Map<string, any>();
    for (const axis of model.axes) {
      for (const m of axis.mappings) {
        if (!questionMap.has(m.question.id)) {
          questionMap.set(m.question.id, m.question);
        }
      }
    }

    // ── 3. Generate real OpenAI embeddings for FREE_TEXT answers ─────────────
    const embeddingMap = new Map<string, number[]>();
    for (const [qId, q] of questionMap) {
      if (q.type === 'FREE_TEXT') {
        const val = answerMap.get(qId);
        const text = val !== null && val !== undefined ? String(val).trim() : '';
        if (text) {
          try {
            const { embedding } = await this.analysisService.generateEmbedding(text);
            embeddingMap.set(qId, embedding);
          } catch {
            // embedding failed – question scores as 0
          }
        }
      }
    }

    // ── 4. Build ScoringItems (only answered questions) ───────────────────────
    const scoringItems: ScoringItem[] = [];
    for (const [qId, q] of questionMap) {
      const val = answerMap.get(qId);

      // Determine if this question was answered
      const hasValue =
        val !== null &&
        val !== undefined &&
        val !== '' &&
        !(Array.isArray(val) && (val as unknown[]).length === 0);

      if (!hasValue) continue; // unanswered → excluded → axis score stays 0

      let selectedOptionEmbeddings: number[][] | undefined;
      let selectedOptionLabels: string[] = [];
      let selectedOptionScores: number[] = [];
      let exclusiveOptionSelected = false;

      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
        const selected =
          q.type === 'SINGLE_CHOICE'
            ? [String(val)]
            : Array.isArray(val)
              ? (val as unknown[]).map(String)
              : [String(val)];

        const selectedOptions = (q.options as any[]).filter((o) => selected.includes(o.value));
        selectedOptionLabels = selectedOptions.map((o) => o.label ?? o.value);
        selectedOptionScores = selectedOptions
          .map((o) => (o.explicitWeight == null ? undefined : Number(o.explicitWeight)))
          .filter((v): v is number => Number.isFinite(v));

        // Detect exclusive ("none of the above") options: explicitWeight <= 0
        // Convention: set explicitWeight = 0 on "特定のツールは使っていない" style options
        const exclusiveOpts = selectedOptions.filter((o) => o.explicitWeight != null && o.explicitWeight <= 0);
        const nonExclusiveOpts = selectedOptions.filter((o) => o.explicitWeight == null || o.explicitWeight > 0);

        if (exclusiveOpts.length > 0) {
          exclusiveOptionSelected = true;
          if (nonExclusiveOpts.length > 0) {
            // Contradictory: exclusive + other options selected → use only non-exclusive
            // (generous interpretation: user likely has the tools but accidentally checked "none")
            const embeds = nonExclusiveOpts
              .filter((o) => o.embedding)
              .map((o) => decodeEmbedding(o.embedding))
              .filter((v): v is number[] => v !== undefined);
            if (embeds.length > 0) selectedOptionEmbeddings = embeds;
          }
          // exclusive-only: no embeddings → score will be 0 in FastAPI
        } else {
          const embeds = selectedOptions
            .filter((o) => o.embedding)
            .map((o) => decodeEmbedding(o.embedding))
            .filter((v): v is number[] => v !== undefined);
          if (embeds.length > 0) selectedOptionEmbeddings = embeds;
        }
      }

      scoringItems.push({
        questionId: qId,
        questionType: q.type,
        value: val,
        embedding: q.type === 'FREE_TEXT' ? embeddingMap.get(qId) : undefined,
        selectedOptionEmbeddings,
        selectedOptionLabels,
        selectedOptionScores,
        exclusiveOptionSelected,
        scaleMin: q.scaleMin ?? undefined,
        scaleMax: q.scaleMax ?? undefined,
        axisMappings: (q.axisMappings as any[]).map((m) => ({
          axisId: m.axisId,
          contributionWeight: m.contributionWeight,
        })),
      });
    }

    // ── 5. Build AxisScoringInfo for ALL axes (leaf axes carry rubric embeddings) ──
    const axesForScoring: AxisScoringInfo[] = model.axes.map((axis) => ({
      id: axis.id,
      name: axis.name,
      weight: axis.weight,
      rubricLevels: (axis.rubricLevels as any[]).map((rl) => ({
        level: rl.level,
        label: rl.label ?? undefined,
        description: rl.description ?? undefined,
        embedding: decodeEmbedding(rl.embedding),
      })),
    }));

    // ── 6. Call FastAPI for real vector scoring ───────────────────────────────
    let fastApiScoreMap = new Map<string, { normalizedScore: number; rubricLevel: number | null }>();
    let fastApiOverall = 0;
    // questionId → { score, rubricLevel, questionType, detail }
    const questionScoreMap = new Map<string, { score: number; rubricLevel: number | null; questionType: string | null; detail: any }>();

    if (scoringItems.length > 0) {
      const scoringResponse = await this.analysisService.scoreResponse({
        modelId: id,
        tenantId: tenantId ?? 'test',
        answerId: `test-${Date.now()}`,
        items: scoringItems,
        axes: axesForScoring,
      });
      fastApiOverall = scoringResponse.overallScore;
      fastApiScoreMap = new Map(
        scoringResponse.axisScores.map((s) => [
          s.axisId,
          { normalizedScore: s.normalizedScore, rubricLevel: s.rubricLevel ?? null },
        ]),
      );
      // Aggregate item scores: if a question maps to multiple axes, average them
      const qScoreAccum = new Map<string, { sum: number; rlSum: number; count: number; type: string | null; detail: any }>();
      for (const is of (scoringResponse as any).itemScores ?? []) {
        const existing = qScoreAccum.get(is.questionId);
        if (existing) {
          existing.sum += is.rawScore;
          existing.rlSum += is.rubricLevel ?? (1 + is.rawScore * 4);
          existing.count += 1;
          // Keep first detail (primary axis)
        } else {
          qScoreAccum.set(is.questionId, {
            sum: is.rawScore,
            rlSum: is.rubricLevel ?? (1 + is.rawScore * 4),
            count: 1,
            type: is.questionType ?? null,
            detail: is.detail ?? null,
          });
        }
      }
      for (const [qId, acc] of qScoreAccum) {
        questionScoreMap.set(qId, {
          score: acc.sum / acc.count,
          rubricLevel: acc.rlSum / acc.count,
          questionType: acc.type,
          detail: acc.detail,
        });
      }
    }

    // ── 7. Build hierarchical result tree ─────────────────────────────────────
    const buildAxisResult = (axisId: string): any => {
      const axis = model.axes.find((a) => a.id === axisId)!;
      const children = model.axes.filter((a) => a.parentId === axisId);

      if (children.length === 0) {
        // Leaf axis: use FastAPI score
        const fas = fastApiScoreMap.get(axisId);
        const score = fas?.normalizedScore ?? 0;
        const rubricLevel = fas?.rubricLevel ?? (score > 0 ? 1 + score * 4 : 1.0);

        const questionScores = axis.mappings
          .filter((m: any) => submittedQuestionIds.has(m.question.id))
          .map((m: any) => {
          const val = answerMap.get(m.question.id);
          const answered =
            val !== null &&
            val !== undefined &&
            val !== '' &&
            !(Array.isArray(val) && (val as unknown[]).length === 0);
          const qs = questionScoreMap.get(m.question.id);
          return {
            questionId: m.question.id,
            text: m.question.text,
            type: m.question.type,
            answered,
            weight: m.contributionWeight,
            score: qs ? Math.round(qs.score * 1000) / 1000 : null,
            percent: qs ? Math.round(qs.score * 100) : null,
            rubricLevel: qs?.rubricLevel ? Math.round(qs.rubricLevel * 10) / 10 : null,
            detail: qs?.detail ?? null,
          };
        });

        return {
          axisId,
          axisName: axis.name,
          score: Math.round(score * 1000) / 1000,
          rubricLevel: Math.round(rubricLevel * 10) / 10,
          percent: Math.round(score * 100),
          questionScores,
          childScores: [],
        };
      }

      // Parent axis: weighted average of children
      const childResults = children.map((c) => buildAxisResult(c.id));
      const totalWeight = children.reduce((s, c) => s + c.weight, 0) || 1;
      const weightedScore =
        childResults.reduce((s, r) => {
          const childAxis = children.find((c) => c.id === r.axisId)!;
          return s + r.score * (childAxis?.weight ?? 1);
        }, 0) / totalWeight;
      const weightedLevel =
        childResults.reduce((s, r) => {
          const childAxis = children.find((c) => c.id === r.axisId)!;
          return s + r.rubricLevel * (childAxis?.weight ?? 1);
        }, 0) / totalWeight;

      return {
        axisId,
        axisName: axis.name,
        score: Math.round(weightedScore * 1000) / 1000,
        rubricLevel: Math.round(weightedLevel * 10) / 10,
        percent: Math.round(weightedScore * 100),
        questionScores: [],
        childScores: childResults,
      };
    };

    const rootAxes = model.axes.filter((a) => !a.parentId);
    const axisResults = rootAxes.map((a) => buildAxisResult(a.id));

    // Overall from FastAPI (computed from leaf axes' weighted contributions)
    const overallScore = fastApiOverall;
    const overallRubricLevel = overallScore > 0 ? 1 + overallScore * 4 : 1.0;
    const overallPercent = Math.round(overallScore * 100);

    // ── 8. Generate AI-powered output for each output format ──────────────────
    // Flatten axis scores for output generation (all axes including children)
    const flattenAll = (axes: any[]): any[] => {
      const out: any[] = [];
      const walk = (list: any[]) => {
        for (const a of list) {
          out.push(a);
          if (a.childScores?.length) walk(a.childScores);
        }
      };
      walk(axes);
      return out;
    };
    const allAxisResults = flattenAll(axisResults);
    const axisScoresForOutput = allAxisResults.map((a) => ({
      axisName: a.axisName,
      normalizedScore: a.score,
      rubricLevel: a.rubricLevel,
      percent: a.percent,
    }));

    const formattedOutputs: Record<string, any> = {};

    if (scoringItems.length > 0 && outputFormats.length > 0) {
      await Promise.all(
        outputFormats.map(async (fmt) => {
          const result = await this.analysisService.generateFormatOutput({
            respondentRef: dto.respondentRef,
            overallScore,
            overallPercent,
            axisScores: axisScoresForOutput,
            outputType: fmt.outputType,
            formatName: fmt.name,
            config: fmt.config,
            promptTemplate: fmt.promptTemplate,
          });
          if (result) formattedOutputs[fmt.id] = result;
        }),
      );
    }

    return {
      modelId: id,
      modelName: model.name,
      respondentRef: dto.respondentRef,
      questionGroupId: questionGroup?.id ?? null,
      questionGroupName: questionGroup?.name ?? null,
      outputFormatIds: outputFormats.map((fmt) => fmt.id),
      overallScore: Math.round(overallScore * 1000) / 1000,
      overallRubricLevel: Math.round(overallRubricLevel * 10) / 10,
      overallPercent,
      axisScores: axisResults,
      formattedOutputs,
    };
  }

  async snapshot(id: string, tenantId: string | undefined) {
    const original = await this.prisma.evaluationModel.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        axes: {
          include: {
            rubricLevels: true,
            mappings: true,
          },
        },
        questions: {
          include: {
            options: true,
            criteria: true,
            axisMappings: true,
          },
        },
        outputFormats: true,
        resultTemplate: true,
      },
    });
    if (!original) throw new NotFoundException('Evaluation model not found');

    // Create new model
    const newModel = await this.prisma.evaluationModel.create({
      data: {
        name: original.name,
        description: original.description ?? undefined,
        version: original.version + 1,
        status: 'DRAFT',
        projectId: original.projectId,
        tenantId: original.tenantId,
      },
    });

    // Clone axes (two-pass to preserve tree structure)
    const axisIdMap = new Map<string, string>();
    // First pass: create all axes with parentId=null
    for (const axis of original.axes) {
      const newAxis = await this.prisma.axis.create({
        data: {
          name: axis.name,
          description: axis.description ?? undefined,
          weight: axis.weight,
          order: axis.order,
          modelId: newModel.id,
          idealStateText: axis.idealStateText ?? undefined,
          lowStateText: axis.lowStateText ?? undefined,
          rubricLevels: {
            create: axis.rubricLevels.map((rl) => ({
              level: rl.level,
              label: rl.label,
              description: rl.description,
            })),
          },
        },
      });
      axisIdMap.set(axis.id, newAxis.id);
    }
    // Second pass: set parentId using mapped IDs
    for (const axis of original.axes) {
      if (axis.parentId) {
        const newParentId = axisIdMap.get(axis.parentId);
        const newAxisId = axisIdMap.get(axis.id);
        if (newParentId && newAxisId) {
          await this.prisma.axis.update({
            where: { id: newAxisId },
            data: { parentId: newParentId },
          });
        }
      }
    }

    // Clone questions
    const questionIdMap = new Map<string, string>();
    for (const q of original.questions) {
      const newQ = await this.prisma.question.create({
        data: {
          text: q.text,
          type: q.type,
          scaleMin: q.scaleMin ?? undefined,
          scaleMax: q.scaleMax ?? undefined,
          scaleMinLabel: q.scaleMinLabel ?? undefined,
          scaleMaxLabel: q.scaleMaxLabel ?? undefined,
          required: q.required,
          order: q.order,
          modelId: newModel.id,
          options: {
            create: q.options.map((o) => ({
              label: o.label,
              value: o.value,
              text: o.text,
              order: o.order,
              explicitWeight: o.explicitWeight ?? undefined,
            })),
          },
          criteria: {
            create: q.criteria.map((c) => ({
              level: c.level,
              label: c.label,
              description: c.description,
            })),
          },
        },
      });
      questionIdMap.set(q.id, newQ.id);
    }

    // Clone question-axis mappings
    for (const q of original.questions) {
      for (const m of q.axisMappings) {
        const newQId = questionIdMap.get(q.id);
        const newAId = axisIdMap.get(m.axisId);
        if (newQId && newAId) {
          await this.prisma.questionAxisMapping.create({
            data: {
              questionId: newQId,
              axisId: newAId,
              contributionWeight: m.contributionWeight,
            },
          });
        }
      }
    }

    // Clone output formats
    for (const of_ of original.outputFormats) {
      await this.prisma.outputFormat.create({
        data: {
          name: of_.name,
          description: of_.description ?? undefined,
          outputType: of_.outputType,
          config: of_.config as any,
          promptTemplate: of_.promptTemplate ?? undefined,
          axisWeights: of_.axisWeights as any,
          order: of_.order,
          modelId: newModel.id,
        },
      });
    }

    // Clone result template
    if (original.resultTemplate) {
      await this.prisma.resultTemplate.create({
        data: {
          name: original.resultTemplate.name,
          outputType: original.resultTemplate.outputType,
          config: original.resultTemplate.config as any,
          promptTemplate: original.resultTemplate.promptTemplate ?? undefined,
          modelId: newModel.id,
        },
      });
    }

    return newModel;
  }
}
