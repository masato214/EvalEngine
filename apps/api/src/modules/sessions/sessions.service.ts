import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '@evalengine/config';

export interface CreateSessionDto {
  modelId: string;
  userExternalId: string;
}

export interface SubmitSessionAnswersDto {
  respondentMeta?: Record<string, unknown>;
  items: Array<{ questionId: string; value: unknown }>;
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

    return this.prisma.session.create({
      data: {
        modelId: dto.modelId,
        tenantId,
        userExternalId: dto.userExternalId,
        status: SessionStatus.STARTED,
      },
    });
  }

  /** GET /sessions/:id/questions */
  async getQuestions(sessionId: string, tenantId: string) {
    const session = await this._getSession(sessionId, tenantId);

    return this.prisma.question.findMany({
      where: { modelId: session.modelId },
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
  async findAll(tenantId: string, modelId?: string) {
    return this.prisma.session.findMany({
      where: { tenantId, ...(modelId ? { modelId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        model: { select: { id: true, name: true } },
        _count: { select: { answers: true, results: true } },
      },
    });
  }

  /** GET /sessions/:id */
  async findOne(sessionId: string, tenantId: string) {
    return this._getSession(sessionId, tenantId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async _getSession(sessionId: string, tenantId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        model: { select: { id: true, name: true } },
        answers: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            respondentRef: true,
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
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private _formatResult(result: any) {
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
      typeDetails: result.typeDetails ?? null,
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
}
