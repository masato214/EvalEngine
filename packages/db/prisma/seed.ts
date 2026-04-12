import { PrismaClient, UserRole, TenantPlan, QuestionType, AnswerStatus, ModelStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 デモデータを投入中...\n');

  // ─── テナント ───────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'techstart' },
    update: {},
    create: {
      id: 'tenant-techstart-demo',
      slug: 'techstart',
      name: '株式会社テックスタート',
      plan: TenantPlan.PROFESSIONAL,
    },
  });

  // ─── 管理者ユーザー ──────────────────────────────────────
  const passwordHash = await bcrypt.hash('TechStart2024!', 10);
  await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@techstart.co.jp', tenantId: tenant.id } },
    update: {},
    create: {
      email: 'admin@techstart.co.jp',
      passwordHash,
      name: '田中 太郎',
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
    },
  });

  // ─── APIキー ─────────────────────────────────────────────
  const rawKey = 'ek_techstart_demo_key_2024_abc123xyz';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      name: '採用管理システム連携キー',
      keyHash,
      tenantId: tenant.id,
    },
  });

  // ─── プロジェクト ────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: 'project-techstart-recruit' },
    update: {},
    create: {
      id: 'project-techstart-recruit',
      name: 'エンジニア採用2024',
      description: '2024年度エンジニア職の採用アセスメント',
      tenantId: tenant.id,
    },
  });

  // ─── 評価モデル ──────────────────────────────────────────
  const model = await prisma.evaluationModel.upsert({
    where: { id: 'model-techstart-engineer-v1' },
    update: {},
    create: {
      id: 'model-techstart-engineer-v1',
      name: 'エンジニア候補者評価モデル v1',
      description: 'バックエンド・フロントエンドエンジニア向け総合評価',
      projectId: project.id,
      tenantId: tenant.id,
      version: 1,
      status: ModelStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  // ─── 評価軸（ideal/lowテキスト付き）──────────────────────
  const axisTech = await prisma.axis.upsert({
    where: { id: 'axis-tech-skill' },
    update: {},
    create: {
      id: 'axis-tech-skill',
      name: '技術力',
      description: 'プログラミング・設計・問題解決のスキル',
      weight: 1.5,
      order: 0,
      modelId: model.id,
      idealStateText: '深い技術的知見を持ち、複雑な問題を自律的に解決できる。設計・実装・最適化を高いレベルで行い、チームに技術的な貢献をもたらす。',
      lowStateText: '基本的な実装はできるが、設計や最適化は難しく、複雑な問題への対応に指導が必要な状態。',
    },
  });

  const axisComm = await prisma.axis.upsert({
    where: { id: 'axis-communication' },
    update: {},
    create: {
      id: 'axis-communication',
      name: 'コミュニケーション力',
      description: 'チームでの協調・情報共有・説明力',
      weight: 1.0,
      order: 1,
      modelId: model.id,
      idealStateText: '技術的内容を誰にでもわかりやすく伝えられ、チームを積極的にリードし、協調関係を自発的に構築できる。',
      lowStateText: '個人作業が中心で、チームへの情報共有や積極的なコミュニケーションが少なく、連携に課題がある状態。',
    },
  });

  const axisCulture = await prisma.axis.upsert({
    where: { id: 'axis-culture-fit' },
    update: {},
    create: {
      id: 'axis-culture-fit',
      name: 'カルチャーフィット',
      description: '自律性・成長意欲・価値観の一致度',
      weight: 1.0,
      order: 2,
      modelId: model.id,
      idealStateText: '自発的に課題を発見し学習し続ける意欲があり、スタートアップ的な環境・スピード感・裁量の大きさを望み、変化を積極的に楽しめる。',
      lowStateText: '指示待ちの傾向があり、安定志向が強く、急激な変化や高い裁量環境への適応に時間がかかる可能性がある。',
    },
  });

  // ─── ルーブリックレベル（各軸のLv1/3/5）────────────────────
  const rubrics = [
    // 技術力
    { id: 'rubric-tech-lv1', axisId: axisTech.id, level: 1, label: '基礎段階', description: '基本的な構文は理解しているが、実務レベルのコードを独力で書くことは難しい。チュートリアル程度の実装ができる段階。' },
    { id: 'rubric-tech-lv2', axisId: axisTech.id, level: 2, label: '初級', description: '指示があれば実装できる。バグ修正や小機能の追加ができるが、設計判断はサポートが必要。' },
    { id: 'rubric-tech-lv3', axisId: axisTech.id, level: 3, label: '中級', description: '一般的な機能を独力で設計・実装できる。コードレビューで有益なフィードバックができる。' },
    { id: 'rubric-tech-lv4', axisId: axisTech.id, level: 4, label: '上級', description: 'システム全体の設計に貢献できる。パフォーマンスや保守性を意識した高品質なコードを書ける。' },
    { id: 'rubric-tech-lv5', axisId: axisTech.id, level: 5, label: 'エキスパート', description: '複雑なシステムを自律設計し、技術的課題を創造的に解決する。チームのアーキテクチャ決定をリードできる。' },
    // コミュニケーション力
    { id: 'rubric-comm-lv1', axisId: axisComm.id, level: 1, label: '個人志向', description: '個人作業が中心で、チームへの発信や共有が少ない。必要最低限のやり取りにとどまる傾向。' },
    { id: 'rubric-comm-lv2', axisId: axisComm.id, level: 2, label: '受動的', description: '聞かれれば答えられるが、自発的な情報共有は少ない。ミーティングでは発言するが主導はしない。' },
    { id: 'rubric-comm-lv3', axisId: axisComm.id, level: 3, label: '協調的', description: '必要な情報を適切に共有し、チームの議論に積極的に参加する。技術説明も概ねわかりやすい。' },
    { id: 'rubric-comm-lv4', axisId: axisComm.id, level: 4, label: '積極的', description: '先回りして情報共有し、チームの方向性を整理する。非エンジニアへの説明も上手に行える。' },
    { id: 'rubric-comm-lv5', axisId: axisComm.id, level: 5, label: 'リーダーシップ', description: 'チームを巻き込んで課題解決を主導できる。複雑な技術内容を誰にでも明快に伝えられる。' },
    // カルチャーフィット
    { id: 'rubric-culture-lv1', axisId: axisCulture.id, level: 1, label: '安定志向', description: '明確な指示と安定した環境を好む。変化や高い裁量には不安を感じる傾向がある。' },
    { id: 'rubric-culture-lv2', axisId: axisCulture.id, level: 2, label: '適応段階', description: '安定を好むが変化にも対応しようとする。自己学習はするが継続的とは言えない。' },
    { id: 'rubric-culture-lv3', axisId: axisCulture.id, level: 3, label: 'バランス型', description: '裁量と安定のバランスを取れる。継続的な学習習慣があり、適度な変化を楽しめる。' },
    { id: 'rubric-culture-lv4', axisId: axisCulture.id, level: 4, label: '成長志向', description: '自発的に学習し成長機会を求める。スピード感のある環境を好み、裁量に積極的に応える。' },
    { id: 'rubric-culture-lv5', axisId: axisCulture.id, level: 5, label: 'スタートアップ適性', description: '自ら課題を見つけ行動し、変化を成長機会として楽しめる。コミュニティや知識共有への貢献も積極的。' },
  ];

  for (const r of rubrics) {
    await prisma.axisRubricLevel.upsert({
      where: { id: r.id },
      update: {},
      create: r,
    });
  }

  // ─── 質問（新スキーマ: modelId, QuestionOption, QuestionAxisMapping）────

  // 質問1: 実務経験年数（技術力に紐付け）
  const q1 = await prisma.question.upsert({
    where: { id: 'q-tech-exp' },
    update: {},
    create: {
      id: 'q-tech-exp',
      text: 'ソフトウェア開発の実務経験は何年ですか？',
      type: QuestionType.SINGLE_CHOICE,
      order: 0,
      modelId: model.id,
    },
  });
  await seedOptions(q1.id, [
    { id: 'opt-exp-lt1',  label: '1年未満', value: 'lt1',   text: '実務経験が1年未満で、基礎を学んでいる段階' },
    { id: 'opt-exp-1to3', label: '1〜3年',  value: '1to3',  text: '実務経験1〜3年、主要な機能を担当できる段階' },
    { id: 'opt-exp-3to5', label: '3〜5年',  value: '3to5',  text: '実務経験3〜5年、設計や技術判断ができる段階' },
    { id: 'opt-exp-gt5',  label: '5年以上', value: 'gt5',   text: '5年以上の実務経験を持つシニアエンジニア' },
  ]);
  await seedMapping(q1.id, [{ axisId: axisTech.id, weight: 1.0 }]);

  // 質問2: 技術スタック（技術力に紐付け）
  const q2 = await prisma.question.upsert({
    where: { id: 'q-tech-skills' },
    update: {},
    create: {
      id: 'q-tech-skills',
      text: '得意な技術スタックを選んでください（複数可）',
      type: QuestionType.MULTIPLE_CHOICE,
      order: 1,
      modelId: model.id,
    },
  });
  await seedOptions(q2.id, [
    { id: 'opt-ts',    label: 'TypeScript / JavaScript', value: 'ts',    text: 'モダンなフロントエンド・バックエンド開発ができるWeb標準技術' },
    { id: 'opt-py',    label: 'Python',                  value: 'py',    text: 'データ処理・機械学習・スクリプティングに強い汎用言語' },
    { id: 'opt-go',    label: 'Go',                      value: 'go',    text: '高パフォーマンスなサーバーサイド・システム開発言語' },
    { id: 'opt-react', label: 'React / Next.js',         value: 'react', text: 'モダンなUIフレームワーク・SPAおよびSSR開発' },
    { id: 'opt-cloud', label: 'AWS / GCP',               value: 'cloud', text: 'クラウドインフラ・サーバーレス・マネージドサービスの活用' },
  ]);
  await seedMapping(q2.id, [{ axisId: axisTech.id, weight: 0.8 }]);

  // 質問3: 技術的課題（技術力＋カルチャーフィット両方に寄与）
  const q3 = await prisma.question.upsert({
    where: { id: 'q-tech-challenge' },
    update: {},
    create: {
      id: 'q-tech-challenge',
      text: '最近取り組んだ技術的に難しかった課題とその解決方法を教えてください。',
      type: QuestionType.FREE_TEXT,
      order: 2,
      modelId: model.id,
    },
  });
  await seedMapping(q3.id, [
    { axisId: axisTech.id,    weight: 0.7 },
    { axisId: axisCulture.id, weight: 0.3 }, // 課題への向き合い方がカルチャーフィットにも影響
  ]);

  // 質問4: チームでの役割（コミュニケーション力に紐付け）
  const q4 = await prisma.question.upsert({
    where: { id: 'q-comm-team' },
    update: {},
    create: {
      id: 'q-comm-team',
      text: 'チームでの開発において、自分の役割はどちらに近いですか？',
      type: QuestionType.SINGLE_CHOICE,
      order: 3,
      modelId: model.id,
    },
  });
  await seedOptions(q4.id, [
    { id: 'opt-lead',    label: 'リードして引っ張るタイプ', value: 'lead',    text: '主体的にチームをリードし方向性を示す役割' },
    { id: 'opt-flex',    label: '状況に応じて使い分ける',   value: 'flex',    text: 'リードとサポートを状況に応じて柔軟に使い分ける' },
    { id: 'opt-support', label: 'サポートに回るタイプ',     value: 'support', text: 'チームメンバーをサポートし全体を支える役割' },
    { id: 'opt-solo',    label: '個人作業が多い',           value: 'solo',    text: '個人の専門性を活かして独立して作業することが多い' },
  ]);
  await seedMapping(q4.id, [{ axisId: axisComm.id, weight: 1.0 }]);

  // 質問5: 技術説明力（コミュニケーション力に紐付け）
  const q5 = await prisma.question.upsert({
    where: { id: 'q-comm-scale' },
    update: {},
    create: {
      id: 'q-comm-scale',
      text: '技術的な内容を非エンジニアにわかりやすく説明できますか？',
      type: QuestionType.SCALE,
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: '苦手',
      scaleMaxLabel: '得意',
      order: 4,
      modelId: model.id,
    },
  });
  await seedMapping(q5.id, [{ axisId: axisComm.id, weight: 0.8 }]);

  // 質問6: 自己学習（カルチャーフィット＋技術力両方に寄与）
  const q6 = await prisma.question.upsert({
    where: { id: 'q-culture-growth' },
    update: {},
    create: {
      id: 'q-culture-growth',
      text: '自己学習・スキルアップへの取り組みを教えてください。',
      type: QuestionType.FREE_TEXT,
      order: 5,
      modelId: model.id,
    },
  });
  await seedMapping(q6.id, [
    { axisId: axisCulture.id, weight: 0.7 },
    { axisId: axisTech.id,    weight: 0.3 }, // 学習内容が技術力評価にも影響
  ]);

  // 質問7: 理想の職場環境（カルチャーフィットに紐付け）
  const q7 = await prisma.question.upsert({
    where: { id: 'q-culture-env' },
    update: {},
    create: {
      id: 'q-culture-env',
      text: '理想の職場環境はどれに近いですか？',
      type: QuestionType.SINGLE_CHOICE,
      order: 6,
      modelId: model.id,
    },
  });
  await seedOptions(q7.id, [
    { id: 'opt-agile',   label: '裁量が大きくスピード重視', value: 'agile',   text: '高い裁量と素早い意思決定ができるスタートアップ的な環境を好む' },
    { id: 'opt-balance', label: 'バランス重視・安定した環境', value: 'balance', text: 'スピードと安定のバランスが取れた環境を好む' },
    { id: 'opt-corp',    label: '大企業・プロセス重視',     value: 'corp',    text: '明確なプロセスと安定した大企業環境を好む' },
    { id: 'opt-remote',  label: 'リモート・個人裁量重視',   value: 'remote',  text: 'リモートワークと高い個人裁量の環境を好む' },
  ]);
  await seedMapping(q7.id, [{ axisId: axisCulture.id, weight: 0.9 }]);

  // ─── サンプル回答・結果 ──────────────────────────────────

  const respondents = [
    {
      ref: 'applicant-yamada-taro',
      name: '山田 太郎',
      answers: {
        [q1.id]: '3to5',
        [q2.id]: ['ts', 'react', 'cloud'],
        [q3.id]: 'マイクロサービスのレイテンシ問題をGraphQLとRedisキャッシュで解決しました。API応答時間を80%改善できました。',
        [q4.id]: 'flex',
        [q5.id]: 4,
        [q6.id]: 'Udemy・個人OSSプロジェクト・技術ブログを週1で更新しています。最近はRustを学習中です。',
        [q7.id]: 'agile',
      },
      scores: [
        { axisId: axisTech.id,    rawScore: 0.83, normalizedScore: 0.83, tendency: 'high',      rubricLevel: 3.8 },
        { axisId: axisComm.id,    rawScore: 0.88, normalizedScore: 0.88, tendency: 'very_high', rubricLevel: 4.2 },
        { axisId: axisCulture.id, rawScore: 0.90, normalizedScore: 0.90, tendency: 'very_high', rubricLevel: 4.4 },
      ],
      overallScore: 0.86,
      explanation: '技術力・コミュニケーション力・カルチャーフィットすべてにおいて高い適性を示しています。特に自己学習意欲と柔軟性が際立ちます。',
      recommendations: ['早期オファーを推奨', '技術面接でRustの習熟度を確認', 'チームリード候補として育成プランを検討'],
    },
    {
      ref: 'applicant-suzuki-hanako',
      name: '鈴木 花子',
      answers: {
        [q1.id]: '1to3',
        [q2.id]: ['ts', 'py'],
        [q3.id]: 'データ分析基盤の設計でPandasのメモリ問題に直面し、チャンク処理に切り替えることで解決しました。',
        [q4.id]: 'support',
        [q5.id]: 3,
        [q6.id]: '毎日30分コーディング練習をしています。AtCoderで茶色から緑を目指しています。',
        [q7.id]: 'balance',
      },
      scores: [
        { axisId: axisTech.id,    rawScore: 0.62, normalizedScore: 0.62, tendency: 'moderate', rubricLevel: 2.8 },
        { axisId: axisComm.id,    rawScore: 0.70, normalizedScore: 0.70, tendency: 'high',     rubricLevel: 3.3 },
        { axisId: axisCulture.id, rawScore: 0.72, normalizedScore: 0.72, tendency: 'high',     rubricLevel: 3.4 },
      ],
      overallScore: 0.67,
      explanation: '経験は浅いですが着実な成長意欲があります。コミュニケーション力は十分で、育成環境が整えば活躍が期待できます。',
      recommendations: ['ジュニアポジションでの採用を検討', '3ヶ月のオンボーディングプラン必要', 'データエンジニアリング方向で成長支援'],
    },
    {
      ref: 'applicant-tanaka-kenji',
      name: '田中 健二',
      answers: {
        [q1.id]: 'gt5',
        [q2.id]: ['go', 'py', 'cloud'],
        [q3.id]: '数十万ユーザーのリアルタイム通知システムをWebSocketからServer-Sent Eventsに移行し、インフラコストを60%削減しました。',
        [q4.id]: 'lead',
        [q5.id]: 5,
        [q6.id]: 'OSS活動（Goのライブラリをメンテナンス）、社内勉強会の主催、技術顧問として月1回スタートアップを支援しています。',
        [q7.id]: 'agile',
      },
      scores: [
        { axisId: axisTech.id,    rawScore: 0.95, normalizedScore: 0.95, tendency: 'very_high', rubricLevel: 4.9 },
        { axisId: axisComm.id,    rawScore: 0.93, normalizedScore: 0.93, tendency: 'very_high', rubricLevel: 4.7 },
        { axisId: axisCulture.id, rawScore: 0.95, normalizedScore: 0.95, tendency: 'very_high', rubricLevel: 4.9 },
      ],
      overallScore: 0.94,
      explanation: '非常に高いスコアを記録。技術力・リーダーシップ・カルチャーフィットすべてにおいてトップ評価。シニアエンジニアとして即戦力です。',
      recommendations: ['最優先候補としてオファーを準備', 'テックリードポジションを提示', '競合他社の動向を踏まえ給与条件を優遇'],
    },
  ];

  for (const r of respondents) {
    const answerId = `answer-${r.ref}`;
    const resultId = `result-${r.ref}`;

    await prisma.answer.upsert({
      where: { id: answerId },
      update: { status: AnswerStatus.COMPLETED },
      create: {
        id: answerId,
        modelId: model.id,
        respondentRef: r.ref,
        respondentMeta: { name: r.name },
        status: AnswerStatus.COMPLETED,
        tenantId: tenant.id,
      },
    });

    for (const [questionId, value] of Object.entries(r.answers)) {
      const itemId = `item-${r.ref}-${questionId}`;
      await prisma.answerItem.upsert({
        where: { id: itemId },
        update: {},
        create: { id: itemId, answerId, questionId, value: value as any },
      });
    }

    // Result は isLatest で管理（@unique 削除済み）
    const existing = await prisma.result.findFirst({ where: { id: resultId } });
    if (!existing) {
      await prisma.result.create({
        data: {
          id: resultId,
          answerId,
          modelId: model.id,
          tenantId: tenant.id,
          modelVersion: 1,
          respondentRef: r.ref,
          overallScore: r.overallScore,
          isLatest: true,
          explanation: r.explanation,
          recommendations: r.recommendations,
          scores: {
            create: r.scores.map((s) => ({
              axisId: s.axisId,
              rawScore: s.rawScore,
              normalizedScore: s.normalizedScore,
              tendency: s.tendency,
              rubricLevel: s.rubricLevel,
            })),
          },
        },
      });
    }
  }

  console.log('✅ デモデータ投入完了!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 ログイン情報');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`テナントID : ${tenant.id}`);
  console.log('メール     : admin@techstart.co.jp');
  console.log('パスワード : TechStart2024!');
  console.log('');
  console.log('🔑 API キー (外部アプリ向け)');
  console.log(`X-Api-Key   : ${rawKey}`);
  console.log(`X-Tenant-Id : ${tenant.id}`);
  console.log('');
  console.log('👤 サンプル回答者 (3名)');
  console.log('  山田 太郎 — スコア: 86%');
  console.log('  鈴木 花子 — スコア: 67%');
  console.log('  田中 健二 — スコア: 94%');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function seedOptions(
  questionId: string,
  options: { id: string; label: string; value: string; text: string }[],
) {
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    await prisma.questionOption.upsert({
      where: { id: o.id },
      update: {},
      create: { id: o.id, questionId, label: o.label, value: o.value, text: o.text, order: i },
    });
  }
}

async function seedMapping(
  questionId: string,
  mappings: { axisId: string; weight: number }[],
) {
  for (const m of mappings) {
    const id = `map-${questionId}-${m.axisId}`;
    await prisma.questionAxisMapping.upsert({
      where: { id },
      update: {},
      create: { id, questionId, axisId: m.axisId, contributionWeight: m.weight },
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
