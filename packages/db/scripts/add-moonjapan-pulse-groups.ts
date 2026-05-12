import { PrismaClient, QuestionGroupType } from '@prisma/client';

const prisma = new PrismaClient();

const MODEL_ID = 'model-moonjapan-noncognitive-v1';

const pulseRotationSets = {
  alpha: ['本質把握力', '価値観認識力', '多角的視点', '論理的思考力', '説得・独自性', '粘り強さ／グリット', '役割遂行力'],
  beta: ['仮説・目的明確化力', '強み・弱み把握力', '計画力', '構造的把握力', '伝達力', '改善・展開力', '共感的コミュニケーション・支援'],
  gamma: ['問い設定力', '自己モニタリング', '検索・取材力', '関連付け・発想力', '構成・要約力', '知的好奇心', '調整・建設的介入'],
} as const;

const pulseGroups = [
  { id: 'mj-qg-pulse-alpha', key: 'alpha', name: '質問グループ4: パルス調査 α', order: 3 },
  { id: 'mj-qg-pulse-beta', key: 'beta', name: '質問グループ5: パルス調査 β', order: 4 },
  { id: 'mj-qg-pulse-gamma', key: 'gamma', name: '質問グループ6: パルス調査 γ', order: 5 },
] as const;

function rootCategory(axisId: string) {
  return axisId.match(/^mj-axis-([A-G])/)?.[1] ?? 'unknown';
}

function stripPairedPrefix(text: string) {
  return text.replace(/^.+? \/ 問[AB]（[^）]+）：/, '');
}

async function main() {
  const model = await prisma.evaluationModel.findUnique({
    where: { id: MODEL_ID },
    include: {
      questionGroups: true,
      questions: {
        include: {
          axisMappings: {
            include: {
              axis: true,
            },
          },
        },
      },
    },
  });

  if (!model) {
    throw new Error(`MoonJapan model not found: ${MODEL_ID}`);
  }

  const dQuestions = model.questions
    .filter((question) => question.axisMappings.some((mapping) => rootCategory(mapping.axisId) === 'D'))
    .sort((a, b) => a.order - b.order);

  const axisQuestions = new Map<string, typeof model.questions>();
  for (const question of model.questions) {
    const primaryAxis = question.axisMappings[0]?.axis;
    if (!primaryAxis) continue;
    const list = axisQuestions.get(primaryAxis.name) ?? [];
    list.push(question);
    axisQuestions.set(primaryAxis.name, list);
  }
  for (const [axisName, list] of axisQuestions.entries()) {
    axisQuestions.set(axisName, [...list].sort((a, b) => a.order - b.order));
  }

  for (const def of pulseGroups) {
    const selectedAxisNames = pulseRotationSets[def.key];
    const bcQuestions = selectedAxisNames.flatMap((axisName) => {
      const found = axisQuestions.get(axisName);
      if (!found || found.length === 0) {
        throw new Error(`Questions not found for axis: ${axisName}`);
      }
      return found;
    });
    const pulseQuestions = [...dQuestions, ...bcQuestions];

    const existing = await prisma.questionGroup.findFirst({
      where: { modelId: model.id, name: def.name },
    });

    const group = existing
      ? await prisma.questionGroup.update({
          where: { id: existing.id },
          data: {
            description: `高頻度・縦断調査用の17問セット。Dの3問を固定し、B/Cの7次元14問を${def.key}セットとしてローテーションする。`,
            groupType: QuestionGroupType.DAILY,
            order: def.order,
            isActive: true,
            config: {
              coverage: ['B', 'C', 'D'],
              questionCount: pulseQuestions.length,
              fixedQuestions: dQuestions.map((question) => question.id),
              rotationAxisNames: selectedAxisNames,
              policy: [
                'D.熱量の変化 3問は毎回固定',
                'B/Cは7次元を2問ずつ、計14問をセット単位でローテーション',
                '合計17問前後で3〜5分のパルス回答を想定',
              ],
            },
          },
        })
      : await prisma.questionGroup.create({
          data: {
            id: def.id,
            modelId: model.id,
            name: def.name,
            description: `高頻度・縦断調査用の17問セット。Dの3問を固定し、B/Cの7次元14問を${def.key}セットとしてローテーションする。`,
            groupType: QuestionGroupType.DAILY,
            order: def.order,
            config: {
              coverage: ['B', 'C', 'D'],
              questionCount: pulseQuestions.length,
              fixedQuestions: dQuestions.map((question) => question.id),
              rotationAxisNames: selectedAxisNames,
              policy: [
                'D.熱量の変化 3問は毎回固定',
                'B/Cは7次元を2問ずつ、計14問をセット単位でローテーション',
                '合計17問前後で3〜5分のパルス回答を想定',
              ],
            },
          },
        });

    await prisma.questionGroupItem.deleteMany({ where: { groupId: group.id } });

    for (const [index, question] of pulseQuestions.entries()) {
      const primaryAxis = question.axisMappings[0]?.axis;
      const category = primaryAxis ? rootCategory(primaryAxis.id) : 'unknown';
      await prisma.questionGroupItem.create({
        data: {
          id: `mj-qgi-pulse-${def.key}-${question.id}`,
          groupId: group.id,
          questionId: question.id,
          displayText: category === 'D' ? question.text : stripPairedPrefix(question.text),
          order: index,
          block: category === 'D' ? 'D. 熱量の変化' : 'B/C ローテーション',
          shuffleGroup: category === 'D' ? `pulse-${def.key}-d` : `pulse-${def.key}-bc`,
          metadata: {
            rootCategory: category,
            axisName: primaryAxis?.name ?? null,
            rotationSet: def.key,
            compressed: false,
            source: '2026-05 調査負荷改善ローテーション設計',
          },
        },
      });
    }

    console.log(`${group.name}: ${pulseQuestions.length}問`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
