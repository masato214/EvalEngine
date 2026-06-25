/**
 * MoonJapan 「中間アンケート」質問グループを追加する。
 *
 * 既存の3つのパルス調査グループ（α / β / γ）の質問を統合した1グループを作成する。
 *   - D「熱量の変化」3問（3グループ共通・重複排除して1回）
 *   - B/C 各セットの14問 × 3 = 42問
 *   → 合計 45問（重複排除後）
 *
 * 生徒には初回アンケート(BASELINE)と同様にスタンドアロン・アンケートとして提示する。
 * moon-shot 側は既知ID(mj-qg-midterm-v1)でこのグループを取得・表示する。
 *
 * 実行: cd packages/db && pnpm ts-node scripts/add-moonjapan-midterm-group.ts
 *      （本番反映は本番の DATABASE_URL を指定して実行する）
 */
import { PrismaClient, QuestionGroupType } from '@prisma/client';

const prisma = new PrismaClient();

const MODEL_ID = 'model-moonjapan-noncognitive-v1';
const MIDTERM_GROUP_ID = 'mj-qg-midterm-v1';
const MIDTERM_GROUP_NAME = '中間アンケート';
// 統合元（パルス調査 α / β / γ）。α→β→γ の順で結合する。
const SOURCE_GROUP_IDS = ['mj-qg-pulse-alpha', 'mj-qg-pulse-beta', 'mj-qg-pulse-gamma'] as const;

async function main() {
  const model = await prisma.evaluationModel.findUnique({ where: { id: MODEL_ID } });
  if (!model) {
    throw new Error(`MoonJapan model not found: ${MODEL_ID}`);
  }

  // 統合元グループの items を順序つきで取得
  const sourceGroups = await prisma.questionGroup.findMany({
    where: { id: { in: SOURCE_GROUP_IDS as unknown as string[] } },
    include: { items: { orderBy: { order: 'asc' } } },
  });
  if (sourceGroups.length !== SOURCE_GROUP_IDS.length) {
    const found = sourceGroups.map((g) => g.id);
    throw new Error(
      `統合元のパルスグループが揃っていません。期待: ${SOURCE_GROUP_IDS.join(', ')} / 実在: ${found.join(', ') || '(なし)'}`,
    );
  }

  // α→β→γ の順で items を並べ、questionId で重複排除（D の共通3問は最初に出た1回だけ残す）
  const orderedSources = SOURCE_GROUP_IDS.map((id) => sourceGroups.find((g) => g.id === id)!);
  const seen = new Set<string>();
  const mergedItems: { questionId: string; displayText: string | null; block: string | null; sourceGroupId: string }[] = [];
  for (const group of orderedSources) {
    for (const item of group.items) {
      if (seen.has(item.questionId)) continue;
      seen.add(item.questionId);
      mergedItems.push({
        questionId: item.questionId,
        displayText: item.displayText,
        block: item.block,
        sourceGroupId: group.id,
      });
    }
  }

  // D ブロックを先頭に、その後 B/C を元の出現順で並べる
  const isDBlock = (block: string | null) => (block || '').startsWith('D');
  mergedItems.sort((a, b) => {
    const da = isDBlock(a.block) ? 0 : 1;
    const db = isDBlock(b.block) ? 0 : 1;
    return da - db; // D を前に。安定ソートで同ブロック内は元順を維持
  });

  const description = `初回アンケート後の中間時点で実施する縦断調査。パルス調査 α/β/γ の3グループを統合し、D「熱量の変化」3問とB/Cの全次元を1回でカバーする（重複排除後 ${mergedItems.length}問）。`;
  const config = {
    purpose: 'midterm',
    mergedFrom: SOURCE_GROUP_IDS,
    questionCount: mergedItems.length,
    coverage: ['B', 'C', 'D'],
  };

  // グループを upsert（再実行安全）
  const existing = await prisma.questionGroup.findUnique({ where: { id: MIDTERM_GROUP_ID } });
  const group = existing
    ? await prisma.questionGroup.update({
        where: { id: MIDTERM_GROUP_ID },
        data: { name: MIDTERM_GROUP_NAME, description, groupType: QuestionGroupType.CUSTOM, order: 6, isActive: true, config },
      })
    : await prisma.questionGroup.create({
        data: {
          id: MIDTERM_GROUP_ID,
          modelId: model.id,
          name: MIDTERM_GROUP_NAME,
          description,
          groupType: QuestionGroupType.CUSTOM,
          order: 6,
          isActive: true,
          config,
        },
      });

  // items を入れ替え
  await prisma.questionGroupItem.deleteMany({ where: { groupId: group.id } });
  for (const [index, item] of mergedItems.entries()) {
    await prisma.questionGroupItem.create({
      data: {
        id: `mj-qgi-midterm-${item.questionId}`,
        groupId: group.id,
        questionId: item.questionId,
        displayText: item.displayText,
        order: index,
        block: item.block,
        required: true,
        metadata: { mergedFrom: item.sourceGroupId, purpose: 'midterm' },
      },
    });
  }

  console.log(`${group.name} (${group.id}): ${mergedItems.length}問を登録しました。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
