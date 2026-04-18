import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '@evalengine/config';

export interface CreateSessionDto {
  modelId: string;
  userExternalId: string;
  questionGroupId?: string;
  questionIds?: string[];
  outputFormatIds?: string[];
}

export interface SubmitSessionAnswersDto {
  respondentMeta?: Record<string, unknown>;
  items: Array<{ questionId: string; value: unknown }>;
}

function extractTypeDetails(result: any) {
  const details = result?.typeDetails && typeof result.typeDetails === 'object' ? result.typeDetails : {};
  return {
    typeDetails: result?.typeDetails ?? null,
    formattedOutputs: (details as any).formattedOutputs ?? {},
    outputViews: (details as any).outputViews ?? [],
  };
}

function uniqueStrings(values?: string[]) {
  return [...new Set((values ?? []).filter(Boolean))];
}

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.ANALYSIS) private analysisQueue: Queue,
  ) {}

  /** POST /sessions */
  async create(tenantId: string, dto: CreateSessionDto) {
    const model = await this.prisma.evaluationModel.findFirst({
      where: { id: dto.modelId, tenantId, status: 'PUBLISHED' },
    });
    if (!model) throw new NotFoundException('公開済みの評価モデルが見つかりません');

    let questionGroup: any = null;
    if (dto.questionGroupId) {
      questionGroup = await this.prisma.questionGroup.findFirst({
        where: {
          id: dto.questionGroupId,
          modelId: dto.modelId,
          isActive: true,
        },
        include: { items: { orderBy: { order: 'asc' }, select: { questionId: true } } },
      });
      if (!questionGroup) {
        throw new BadRequestException('指定された質問グループが見つからないか、この評価モデルに属していません');
      }
    }

    const groupQuestionIds = questionGroup ? questionGroup.items.map((item: any) => item.questionId) : [];
    const explicitQuestionIds = uniqueStrings(dto.questionIds);
    const questionIds = groupQuestionIds.length > 0 ? groupQuestionIds : explicitQuestionIds;
    if (questionIds.length > 0) {
      const count = await this.prisma.question.count({
        where: { id: { in: questionIds }, modelId: dto.modelId },
      });
      if (count !== questionIds.length) {
        throw new BadRequestException('指定された質問IDに、この評価モデルへ属していないものがあります');
      }
    }
    if (questionGroup && explicitQuestionIds.length > 0) {
      const allowed = new Set(groupQuestionIds);
      const invalid = explicitQuestionIds.filter((id) => !allowed.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException('questionIdsには、指定された質問グループ内の質問だけを指定できます');
      }
    }

    const outputFormatIds = uniqueStrings(dto.outputFormatIds);
    if (outputFormatIds.length > 0) {
      const count = await this.prisma.outputFormat.count({
        where: { id: { in: outputFormatIds }, modelId: dto.modelId },
      });
      if (count !== outputFormatIds.length) {
        throw new BadRequestException('指定された出力形式IDに、この評価モデルへ属していないものがあります');
      }
    }

    return this.prisma.session.create({
      data: {
        modelId: dto.modelId,
        tenantId,
        userExternalId: dto.userExternalId,
        status: SessionStatus.STARTED,
        questionGroupId: questionGroup?.id ?? null,
        questionIds,
        outputFormatIds,
      },
    });
  }

  /** GET /sessions/:id/questions */
  async getQuestions(sessionId: string, tenantId: string) {
    const session = await this._getSession(sessionId, tenantId);
    const scopedQuestionIds = session.questionIds ?? [];
    const groupItems = session.questionGroupId
      ? await this.prisma.questionGroupItem.findMany({
        where: { groupId: session.questionGroupId },
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
      })
      : [];

    const questions = await this.prisma.question.findMany({
      where: {
        modelId: session.modelId,
        ...(scopedQuestionIds.length > 0 ? { id: { in: scopedQuestionIds } } : {}),
      },
      orderBy: { order: 'asc' },
      include: {
        options: {
          orderBy: { order: 'asc' },
          select: { id: true, label: true, value: true, order: true },
        },
        axisMappings: {
          select: { axisId: true, contributionWeight: true },
        },
      },
    });

    if (scopedQuestionIds.length === 0) return questions;
    const order = new Map(scopedQuestionIds.map((id, index) => [id, index]));
    const itemByQuestion = new Map(groupItems.map((item) => [item.questionId, item]));
    return questions
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((question) => {
        const item = itemByQuestion.get(question.id);
        if (!item) return question;
        return {
          ...question,
          text: item.displayText ?? question.text,
          groupItem: {
            order: item.order,
            block: item.block,
            shuffleGroup: item.shuffleGroup,
            required: item.required,
            contributionWeight: item.contributionWeight,
            metadata: item.metadata,
          },
        };
      });
  }

  /** POST /sessions/:id/answers */
  async submitAnswers(sessionId: string, tenantId: string, dto: SubmitSessionAnswersDto) {
    const session = await this._getSession(sessionId, tenantId);

    if (session.status === SessionStatus.COMPLETED || session.status === SessionStatus.FAILED) {
      throw new BadRequestException(`セッションは既に${session.status}状態です`);
    }

    // セッションを ANSWERING に更新
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ANSWERING },
    });

    if (!dto.items?.length) {
      throw new BadRequestException('回答項目がありません');
    }

    const submittedQuestionIds = uniqueStrings(dto.items.map((item) => item.questionId));
    if (submittedQuestionIds.length !== dto.items.length) {
      throw new BadRequestException('同じ質問IDへの回答が重複しています');
    }
    const scopedQuestionIds = session.questionIds ?? [];
    if (scopedQuestionIds.length > 0) {
      const allowed = new Set(scopedQuestionIds);
      const invalid = submittedQuestionIds.filter((id) => !allowed.has(id));
      if (invalid.length > 0) {
        throw new BadRequestException('このセッションに含まれない質問への回答が含まれています');
      }
      const missing = scopedQuestionIds.filter((id) => !submittedQuestionIds.includes(id));
      if (missing.length > 0) {
        throw new BadRequestException(`未回答の質問があります: ${missing.length}件`);
      }
    } else {
      const count = await this.prisma.question.count({
        where: { id: { in: submittedQuestionIds }, modelId: session.modelId },
      });
      if (count !== submittedQuestionIds.length) {
        throw new BadRequestException('この評価モデルに属していない質問への回答が含まれています');
      }
    }

    const answer = await this.prisma.answer.create({
      data: {
        modelId: session.modelId,
        sessionId,
        tenantId,
        respondentRef: session.userExternalId,
        respondentMeta: (dto.respondentMeta ?? null) as any,
        items: {
          create: dto.items.map((item) => ({
            questionId: item.questionId,
            value: item.value as any,
          })),
        },
      },
    });

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ANALYZING },
    });
    await this.analysisQueue.add('analyze', { answerId: answer.id, tenantId });

    return { answerId: answer.id, status: 'PENDING' };
  }

  /** POST /sessions/:id/analyze */
  async analyze(sessionId: string, tenantId: string) {
    const session = await this._getSession(sessionId, tenantId);

    // 最新の未処理回答を取得
    const answer = await this.prisma.answer.findFirst({
      where: { sessionId, tenantId, status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!answer) {
      // 既に完了している場合は最新結果を返す
      const result = await this.prisma.result.findFirst({
        where: { sessionId, tenantId, isLatest: true },
        include: { scores: { include: { axis: true } } },
      });
      return { status: 'ALREADY_COMPLETED', result };
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ANALYZING },
    });

    await this.analysisQueue.add('analyze', { answerId: answer.id, tenantId });

    return { status: 'PROCESSING', answerId: answer.id };
  }

  /** GET /sessions/:id/result — 最新結果のみ */
  async getResult(sessionId: string, tenantId: string) {
    await this._getSession(sessionId, tenantId);

    const result = await this.prisma.result.findFirst({
      where: { sessionId, tenantId, isLatest: true },
      include: { scores: { include: { axis: { select: { id: true, name: true, weight: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!result) throw new NotFoundException('結果がまだありません');

    return this._formatResult(result);
  }

  /** GET /sessions/:id/results — 全結果履歴 */
  async getResults(sessionId: string, tenantId: string) {
    await this._getSession(sessionId, tenantId);

    const results = await this.prisma.result.findMany({
      where: { sessionId, tenantId },
      include: { scores: { include: { axis: { select: { id: true, name: true, weight: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return results.map((r) => this._formatResult(r));
  }

  /** GET /sessions */
  async findAll(tenantId: string | undefined, modelId?: string, userExternalId?: string) {
    return this.prisma.session.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(modelId ? { modelId } : {}),
        ...(userExternalId ? { userExternalId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        model: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: { select: { id: true, name: true, tenantId: true } },
          },
        },
        questionGroup: { select: { id: true, name: true, groupType: true } },
        answers: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            respondentRef: true,
            respondentMeta: true,
            status: true,
            createdAt: true,
            results: {
              where: { isLatest: true },
              select: { id: true, overallScore: true },
              take: 1,
            },
          },
        },
        _count: { select: { answers: true, results: true } },
      },
    });
  }

  /** GET /sessions/:id */
  async findOne(sessionId: string, tenantId: string) {
    return this._getSession(sessionId, tenantId);
  }

  async findByRespondent(tenantId: string, respondentRef: string, modelId?: string) {
    return this.findAll(tenantId, modelId, respondentRef);
  }

  async remove(sessionId: string, tenantId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.$transaction(async (tx) => {
      const answers = await tx.answer.findMany({
        where: { sessionId, tenantId },
        select: { id: true },
      });
      const answerIds = answers.map((answer) => answer.id);
      const results = await tx.result.findMany({
        where: { sessionId, tenantId },
        select: { id: true },
      });
      const resultIds = results.map((result) => result.id);

      if (resultIds.length > 0) {
        await tx.resultScore.deleteMany({ where: { resultId: { in: resultIds } } });
        await tx.result.deleteMany({ where: { id: { in: resultIds } } });
      }
      if (answerIds.length > 0) {
        await tx.embedding.deleteMany({ where: { answerItem: { answerId: { in: answerIds } } } });
        await tx.answerItem.deleteMany({ where: { answerId: { in: answerIds } } });
        await tx.answer.deleteMany({ where: { id: { in: answerIds } } });
      }
      await tx.session.delete({ where: { id: sessionId } });
    });
  }

  async findRespondentResults(
    tenantId: string,
    respondentRef: string,
    modelId?: string,
    from?: string,
    to?: string,
  ) {
    const createdAt = this._dateRange(from, to);
    const results = await this.prisma.result.findMany({
      where: {
        tenantId,
        respondentRef,
        ...(modelId ? { modelId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        scores: { include: { axis: { select: { id: true, name: true, weight: true } } } },
        model: { select: { id: true, name: true, projectId: true } },
      },
    });

    const latest = results.at(-1) ?? null;
    const first = results[0] ?? null;
    const previous = results.length > 1 ? results[results.length - 2] : null;
    const axisGrowth = this._axisGrowth(first, previous, latest);
    const overallGrowth = {
      first: first?.overallScore ?? null,
      previous: previous?.overallScore ?? null,
      latest: latest?.overallScore ?? null,
      changeFromFirst: results.length > 1 && first && latest ? latest.overallScore - first.overallScore : null,
      changeFromPrevious: previous && latest ? latest.overallScore - previous.overallScore : null,
    };

    return {
      respondentRef,
      modelId: modelId ?? null,
      count: results.length,
      firstResultAt: first?.createdAt ?? null,
      latestResultAt: latest?.createdAt ?? null,
      overall: overallGrowth,
      growth: {
        hasComparison: results.length > 1,
        comparisonCount: Math.max(results.length - 1, 0),
        message: results.length > 1 ? null : '比較対象となる過去結果がまだありません',
        overall: overallGrowth,
        axes: axisGrowth,
      },
      axisGrowth,
      timeline: results.map((r) => this._formatResult(r)),
    };
  }

  async findRespondentProfile(tenantId: string, respondentRef: string, modelId: string) {
    if (!modelId) throw new BadRequestException('modelId is required');
    const model = await this.prisma.evaluationModel.findFirst({
      where: { id: modelId, tenantId },
      include: {
        axes: {
          where: { parentId: { not: null } },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            weight: true,
            parentId: true,
            parent: { select: { id: true, name: true, weight: true, order: true } },
          },
        },
      },
    });
    if (!model) throw new NotFoundException('Evaluation model not found');

    const results = await this.prisma.result.findMany({
      where: { tenantId, modelId, respondentRef },
      orderBy: { createdAt: 'desc' },
      include: {
        scores: { include: { axis: { select: { id: true, name: true, weight: true, parentId: true } } } },
        session: {
          select: {
            id: true,
            questionGroupId: true,
            questionGroup: { select: { id: true, name: true, groupType: true } },
          },
        },
      },
    });

    const latestByAxis = new Map<string, any>();
    for (const result of results) {
      for (const score of result.scores ?? []) {
        if (!latestByAxis.has(score.axisId)) {
          latestByAxis.set(score.axisId, { result, score });
        }
      }
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const axes = model.axes.map((axis) => {
      const evidence = latestByAxis.get(axis.id);
      const normalizedScore = evidence?.score.normalizedScore ?? null;
      if (normalizedScore !== null) {
        weightedSum += normalizedScore * axis.weight;
        totalWeight += axis.weight;
      }
      const groupType = evidence?.result.session?.questionGroup?.groupType ?? null;
      return {
        axisId: axis.id,
        axisName: axis.name,
        parentAxisId: axis.parentId,
        parentAxisName: axis.parent?.name ?? null,
        weight: axis.weight,
        measured: normalizedScore !== null,
        normalizedScore,
        rubricLevel: evidence?.score.rubricLevel ?? null,
        tendency: evidence?.score.tendency ?? null,
        confidence: normalizedScore === null ? 'none' : groupType === 'COMPRESSED' ? 'medium' : 'high',
        source: evidence ? {
          resultId: evidence.result.id,
          sessionId: evidence.result.sessionId,
          questionGroupId: evidence.result.session?.questionGroupId ?? null,
          questionGroupName: evidence.result.session?.questionGroup?.name ?? null,
          questionGroupType: groupType,
          measuredAt: evidence.result.createdAt,
        } : null,
      };
    });

    const measuredAxes = axes.filter((axis) => axis.measured);
    const parentCoverage = new Map<string, { parentAxisId: string; parentAxisName: string; total: number; measured: number }>();
    for (const axis of axes) {
      const key = axis.parentAxisId ?? 'unknown';
      const current = parentCoverage.get(key) ?? {
        parentAxisId: axis.parentAxisId ?? 'unknown',
        parentAxisName: axis.parentAxisName ?? '未分類',
        total: 0,
        measured: 0,
      };
      current.total += 1;
      if (axis.measured) current.measured += 1;
      parentCoverage.set(key, current);
    }

    return {
      respondentRef,
      modelId,
      modelName: model.name,
      resultCount: results.length,
      overallScore: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10000) / 10000 : null,
      coverage: {
        measuredAxes: measuredAxes.length,
        totalAxes: axes.length,
        ratio: axes.length ? Math.round((measuredAxes.length / axes.length) * 10000) / 10000 : 0,
        byParentAxis: [...parentCoverage.values()].map((item) => ({
          ...item,
          ratio: item.total ? Math.round((item.measured / item.total) * 10000) / 10000 : 0,
        })),
      },
      axes,
    };
  }

  async aggregateModelResults(tenantId: string, modelId: string, from?: string, to?: string) {
    const createdAt = this._dateRange(from, to);
    const results = await this.prisma.result.findMany({
      where: {
        tenantId,
        modelId,
        isLatest: true,
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: { scores: { include: { axis: { select: { id: true, name: true, weight: true } } } } },
    });

    const respondentRefs = new Set(results.map((r) => r.respondentRef));
    const overallScores = results.map((r) => r.overallScore);
    const axisMap = new Map<string, { axisId: string; axisName: string; values: number[] }>();

    for (const result of results) {
      for (const score of result.scores ?? []) {
        const axisId = score.axisId;
        const current = axisMap.get(axisId) ?? {
          axisId,
          axisName: score.axis?.name ?? axisId,
          values: [],
        };
        current.values.push(score.normalizedScore);
        axisMap.set(axisId, current);
      }
    }

    return {
      modelId,
      from: from ?? null,
      to: to ?? null,
      resultCount: results.length,
      respondentCount: respondentRefs.size,
      overall: this._distribution(overallScores),
      axes: [...axisMap.values()].map((axis) => ({
        axisId: axis.axisId,
        axisName: axis.axisName,
        ...this._distribution(axis.values),
      })),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async _getSession(sessionId: string, tenantId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        model: { select: { id: true, name: true } },
        questionGroup: {
          select: {
            id: true,
            name: true,
            groupType: true,
            config: true,
          },
        },
        answers: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            respondentRef: true,
            respondentMeta: true,
            status: true,
            createdAt: true,
            items: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, questionId: true, value: true, createdAt: true },
            },
            results: {
              where: { isLatest: true },
              select: { id: true, overallScore: true },
              take: 1,
            },
          },
        },
        _count: { select: { answers: true, results: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private _formatResult(result: any) {
    const typeDetails = extractTypeDetails(result);
    return {
      id: result.id,
      sessionId: result.sessionId,
      answerId: result.answerId,
      modelId: result.modelId,
      tenantId: result.tenantId,
      modelVersion: result.modelVersion,
      respondentRef: result.respondentRef,
      overallScore: result.overallScore,
      isLatest: result.isLatest,
      resultType: result.resultType ?? null,
      ...typeDetails,
      summary: result.summary ?? null,
      explanation: result.explanation ?? null,
      recommendations: result.recommendations ?? [],
      scores: result.scores.map((s: any) => ({
        axisId: s.axisId,
        axisName: s.axis?.name ?? '',
        rawScore: s.rawScore,
        normalizedScore: s.normalizedScore,
        rubricLevel: s.rubricLevel ?? null,
        tendency: s.tendency ?? null,
      })),
      createdAt: result.createdAt,
    };
  }

  private _dateRange(from?: string, to?: string) {
    if (!from && !to) return undefined;
    return {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  private _distribution(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return {
      average: avg == null ? null : Math.round(avg * 10000) / 10000,
      min: sorted.length ? sorted[0] : null,
      max: sorted.length ? sorted[sorted.length - 1] : null,
      p25: this._percentile(sorted, 0.25),
      p50: this._percentile(sorted, 0.5),
      p75: this._percentile(sorted, 0.75),
    };
  }

  private _percentile(sorted: number[], percentile: number) {
    if (sorted.length === 0) return null;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * percentile)));
    return Math.round(sorted[index] * 10000) / 10000;
  }

  private _axisGrowth(first: any, previous: any, latest: any) {
    if (!latest) return [];
    const firstByAxis = new Map((first?.scores ?? []).map((s: any) => [s.axisId, s]));
    const previousByAxis = new Map((previous?.scores ?? []).map((s: any) => [s.axisId, s]));
    return (latest.scores ?? []).map((latestScore: any) => {
      const firstScore = firstByAxis.get(latestScore.axisId) as any;
      const previousScore = previousByAxis.get(latestScore.axisId) as any;
      return {
        axisId: latestScore.axisId,
        axisName: latestScore.axis?.name ?? latestScore.axisId,
        first: firstScore?.normalizedScore ?? null,
        previous: previousScore?.normalizedScore ?? null,
        latest: latestScore.normalizedScore,
        changeFromFirst: firstScore ? latestScore.normalizedScore - firstScore.normalizedScore : null,
        changeFromPrevious: previousScore ? latestScore.normalizedScore - previousScore.normalizedScore : null,
      };
    });
  }
}
