import { PrismaClient, TenantPlan, UserRole, ModelStatus, QuestionType, QuestionGroupType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const TENANT_ID = 'tenant-moonjapan';
const PROJECT_ID = 'project-moonjapan-noncognitive';
const MODEL_ID = 'model-moonjapan-noncognitive-v1';

const personalityLabels = [
  ['1', '全くあてはまらない'],
  ['2', 'あまりあてはまらない'],
  ['3', 'どちらともいえない'],
  ['4', 'ややあてはまる'],
  ['5', '非常によくあてはまる'],
] as const;

const abilityLabels = [
  ['4', '自信を持って、確実に行える'],
  ['3', '工夫や努力は必要だが、行える'],
  ['2', '意識はしているが、実際には難しい'],
  ['1', 'まだ方法がわからず、行うのが難しい'],
] as const;

const heatLabels = [
  ['4', 'まさに自分にあてはまる'],
  ['3', 'やや自分にあてはまる'],
  ['2', 'あまり自分にはあてはまらない'],
  ['1', '全く自分にはあてはまらない'],
] as const;

type AxisDef = {
  id: string;
  name: string;
  description: string;
  weight: number;
  parent?: string;
  order: number;
  mode?: 'positive' | 'risk';
};

type QuestionDef = {
  axisId: string;
  code: string;
  text: string;
  scale: 'personality' | 'ability' | 'heat';
  reverse?: boolean;
  order: number;
  contributionWeight?: number;
};

let pairedIndex = 0;

const rootAxes: AxisDef[] = [
  {
    id: 'mj-axis-A',
    name: 'A. パーソナリティ',
    description: '静的特性。外向性、協調性、誠実性、神経症傾向、開放性を測定し、P-O Fit の基礎変数とする。',
    weight: 0.2,
    order: 0,
  },
  {
    id: 'mj-axis-B',
    name: 'B. 基盤的な能力',
    description: '動的特性。良質な問いを立て、自分自身を客観的に捉える探究の基盤能力。',
    weight: 0.18,
    order: 1,
  },
  {
    id: 'mj-axis-C',
    name: 'C. 操作的な能力',
    description: '動的特性。情報収集、整理分析、表現、応用、協働を通じて探究を前に進める操作能力。',
    weight: 0.27,
    order: 2,
  },
  {
    id: 'mj-axis-D',
    name: 'D. 熱量の変化',
    description: '高頻度パルスで追う先行指標。活動から得られる心情的変化、可能性の拡張、次の行動意欲を測る。',
    weight: 0.1,
    order: 3,
  },
  {
    id: 'mj-axis-E',
    name: 'E. 現場の適応力',
    description: '目の前の困難を生き抜く力。停滞からのリカバリー、外部資源活用、小さな工夫を測る。',
    weight: 0.15,
    order: 4,
  },
  {
    id: 'mj-axis-F',
    name: 'F. キャリアの適応力',
    description: '人生・自律・環境変化への適応。関心、コントロール、好奇心、自信、協力、相談を測る。',
    weight: 0.15,
    order: 5,
  },
  {
    id: 'mj-axis-G',
    name: 'G. 社会的望ましさ',
    description: '統計的正確性のための妥当性指標。過度な優等生回答や印象操作のリスクを検知する。',
    weight: 0.05,
    order: 6,
    mode: 'risk',
  },
];

const leafAxes: AxisDef[] = [
  { id: 'mj-axis-A-1', parent: 'mj-axis-A', name: '外向性', description: '社交性、活発さ、ポジティブな感情の表出、対人関係や活動への積極性。', weight: 0.04, order: 0 },
  { id: 'mj-axis-A-2', parent: 'mj-axis-A', name: '協調性', description: '他者への思いやり、信頼、協力的な姿勢、対人関係における調和性。', weight: 0.04, order: 1 },
  { id: 'mj-axis-A-3', parent: 'mj-axis-A', name: '誠実性', description: '自己コントロール、計画性、責任感、粘り強さ、目標達成への誠実さ。', weight: 0.04, order: 2 },
  { id: 'mj-axis-A-4', parent: 'mj-axis-A', name: '神経症傾向', description: '不安やストレスへの敏感さ、情緒の揺れやすさ。高いほど情緒的リスクが高い。', weight: 0.04, order: 3, mode: 'risk' },
  { id: 'mj-axis-A-5', parent: 'mj-axis-A', name: '開放性', description: '知的好奇心、想像力、新しい経験への積極性、知的な柔軟性。', weight: 0.04, order: 4 },

  { id: 'mj-axis-B-1-1', parent: 'mj-axis-B', name: '本質把握力', description: '表面的な現象の背後にある背景、原因、構造に気づく力。', weight: 0.03, order: 0 },
  { id: 'mj-axis-B-1-2', parent: 'mj-axis-B', name: '仮説・目的明確化力', description: '活動の目的と仮説を根拠を持って設定する力。', weight: 0.03, order: 1 },
  { id: 'mj-axis-B-1-3', parent: 'mj-axis-B', name: '問い設定力', description: '漠然とした疑問を、自分事として解決可能な問いに変換する力。', weight: 0.03, order: 2 },
  { id: 'mj-axis-B-4-1', parent: 'mj-axis-B', name: '価値観認識力', description: '活動を通じて自分の価値観や判断基準を言語化する力。', weight: 0.03, order: 3 },
  { id: 'mj-axis-B-4-2', parent: 'mj-axis-B', name: '強み・弱み把握力', description: '得意・不得意を把握し、活動設計へ反映する力。', weight: 0.03, order: 4 },
  { id: 'mj-axis-B-4-3', parent: 'mj-axis-B', name: '自己モニタリング', description: '目標、進捗、行動、感情の変化を客観的に振り返る力。', weight: 0.03, order: 5 },

  { id: 'mj-axis-C-2-1', parent: 'mj-axis-C', name: '多角的視点', description: '異なる立場や反対意見を含め、偏りなく情報を検討する力。', weight: 0.018, order: 0 },
  { id: 'mj-axis-C-2-2', parent: 'mj-axis-C', name: '計画力', description: '必要情報を効率的に集める手順、スケジュール、優先順位を設計する力。', weight: 0.018, order: 1 },
  { id: 'mj-axis-C-2-3', parent: 'mj-axis-C', name: '検索・取材力', description: '適切なキーワード、質問設計、一次・二次情報へのアクセスを選ぶ力。', weight: 0.018, order: 2 },
  { id: 'mj-axis-C-3-1', parent: 'mj-axis-C', name: '論理的思考力', description: '根拠を示しながら矛盾のない結論を導き、妥当性を検証する力。', weight: 0.018, order: 3 },
  { id: 'mj-axis-C-3-2', parent: 'mj-axis-C', name: '構造的把握力', description: '情報を分類、比較、関係づけ、全体像として整理する力。', weight: 0.018, order: 4 },
  { id: 'mj-axis-C-3-3', parent: 'mj-axis-C', name: '関連付け・発想力', description: '情報、知識、経験を結びつけ、新しい解釈や意味を見出す力。', weight: 0.018, order: 5 },
  { id: 'mj-axis-C-5-1', parent: 'mj-axis-C', name: '説得・独自性', description: '根拠と結論を明確にし、独自の視点で活動価値を伝える力。', weight: 0.018, order: 6 },
  { id: 'mj-axis-C-5-2', parent: 'mj-axis-C', name: '伝達力', description: '聞き手に合わせて言葉、順序、強調点を調整し伝える力。', weight: 0.018, order: 7 },
  { id: 'mj-axis-C-5-3', parent: 'mj-axis-C', name: '構成・要約力', description: '核心を絞り込み、目的に応じたストーリー構成を設計する力。', weight: 0.018, order: 8 },
  { id: 'mj-axis-C-6-1', parent: 'mj-axis-C', name: '粘り強さ／グリット', description: '困難や予想外の結果に対して、投げ出さずアプローチを変えてやり遂げる力。', weight: 0.018, order: 9 },
  { id: 'mj-axis-C-6-2', parent: 'mj-axis-C', name: '改善・展開力', description: '失敗や結果から改善策、新しい問い、今後の展望を描く力。', weight: 0.018, order: 10 },
  { id: 'mj-axis-C-6-3', parent: 'mj-axis-C', name: '知的好奇心', description: '関連情報へ自ら触れ、活動後も発展的な学習を続ける力。', weight: 0.018, order: 11 },
  { id: 'mj-axis-C-7-1', parent: 'mj-axis-C', name: '役割遂行力', description: '役割とタスクを理解し、期限や約束を守ってやり遂げる力。', weight: 0.018, order: 12 },
  { id: 'mj-axis-C-7-2', parent: 'mj-axis-C', name: '共感的コミュニケーション・支援', description: '他者の意見を聴き、自分の考えを伝え、困りごとを察知して支援・相談する力。', weight: 0.018, order: 13 },
  { id: 'mj-axis-C-7-3', parent: 'mj-axis-C', name: '調整・建設的介入', description: '対立や改善点に対して、建設的な提案を導く力。', weight: 0.018, order: 14 },

  { id: 'mj-axis-D-1', parent: 'mj-axis-D', name: '心の充実', description: '外部との関わりで心が動き、自信や精神的充足が育つ状態。', weight: 0.0333, order: 0 },
  { id: 'mj-axis-D-2', parent: 'mj-axis-D', name: '広がり研がれる自分', description: '新しい視点や感覚が開き、自己基準や可能性が拡張する状態。', weight: 0.0333, order: 1 },
  { id: 'mj-axis-D-3', parent: 'mj-axis-D', name: '活動が呼ぶ活動', description: '活動や他者の姿が次の意欲を喚起し、自発的な意義を見出す状態。', weight: 0.0333, order: 2 },

  { id: 'mj-axis-E-1', parent: 'mj-axis-E', name: '停滞・葛藤時のリカバリー', description: '停滞をメタ認知し、あきらめず立て直す具体的手法を講じる力。', weight: 0.05, order: 0 },
  { id: 'mj-axis-E-2', parent: 'mj-axis-E', name: '外部資源の活用作法', description: '限界を認識し、適切なタイミングで周囲のサポートを戦略的に活用する力。', weight: 0.05, order: 1 },
  { id: 'mj-axis-E-3', parent: 'mj-axis-E', name: '小さな工夫の実行履歴', description: '環境をそのまま受け入れず、役割や進め方を自ら調整するジョブ・クラフティング力。', weight: 0.05, order: 2 },

  { id: 'mj-axis-F-1', parent: 'mj-axis-F', name: '関心', description: '将来への計画的視点を持ち、現在の活動と未来を接続する力。', weight: 0.025, order: 0 },
  { id: 'mj-axis-F-2', parent: 'mj-axis-F', name: 'コントロール', description: '周囲に流されず自己決定し、未来を変えられる信念を持つ力。', weight: 0.025, order: 1 },
  { id: 'mj-axis-F-3', parent: 'mj-axis-F', name: '好奇心', description: '多様な選択肢を調べ、疑問を納得いくまで追求する力。', weight: 0.025, order: 2 },
  { id: 'mj-axis-F-4', parent: 'mj-axis-F', name: '自信', description: '困難や変化に際しても乗り越えられる確信を持って継続する力。', weight: 0.025, order: 3 },
  { id: 'mj-axis-F-5', parent: 'mj-axis-F', name: '協力', description: '多様な他者と協力し、関係形成によって可能性を広げる力。', weight: 0.025, order: 4 },
  { id: 'mj-axis-F-6', parent: 'mj-axis-F', name: '相談', description: '適切な相手に相談し、助言を主体的な意思決定に活かす力。', weight: 0.025, order: 5 },

  { id: 'mj-axis-G-1', parent: 'mj-axis-G', name: '自己保身と誠実さの歪み', description: '自分を良く見せるために非や嘘を認めない傾向の検知。高いほど印象操作リスク。', weight: 0.0167, order: 0, mode: 'risk' },
  { id: 'mj-axis-G-2', parent: 'mj-axis-G', name: '対人関係の清廉さの過剰主張', description: '負の感情や一般的行動を過度に否認する優等生回答の検知。高いほど印象操作リスク。', weight: 0.0167, order: 1, mode: 'risk' },
  { id: 'mj-axis-G-3', parent: 'mj-axis-G', name: '社会的規範遵守の過剰主張', description: '私的状況でも常に完璧に振る舞うという過剰回答の検知。高いほど印象操作リスク。', weight: 0.0167, order: 2, mode: 'risk' },
];

const questions: QuestionDef[] = [
  ...q('mj-axis-A-1', 'A1', 'personality', [
    ['自分から積極的に周りの人に話しかける方だ'],
    ['あまり社交的ではない、または静かな方だ', true],
    ['元気いっぱいで、活動的だ'],
    ['人をぐいぐい引っ張っていく力がある'],
    ['どちらかといえば恥ずかしがり屋だ', true],
    ['周囲に熱意を伝えるのが得意だ'],
    ['集団の中で目立つのは苦手だ', true],
    ['賑やかな場所やイベントが好きだ'],
  ]),
  ...q('mj-axis-A-2', 'A2', 'personality', [
    ['人の欠点を見つけるのが早い方だ', true],
    ['他者に対して思いやりがあり、親切だ'],
    ['人と口論したり、対立したりすることが多い', true],
    ['人を許しやすく、わだかまりを残さない'],
    ['誰に対しても礼儀正しく、丁寧だ'],
    ['他人に対して冷淡だったり、無関心だったりすることがある', true],
    ['人を信じやすく、他人の善意を疑わない'],
    ['他人の気持ちを察して、合わせるのが得意だ'],
    ['自分の意見を通すために、他人を押し切ることがある', true],
  ]),
  ...q('mj-axis-A-3', 'A3', 'personality', [
    ['仕事（勉強や課題）を丁寧かつ確実にこなす'],
    ['どちらかといえば、だらしない方だ', true],
    ['効率よく計画を立てて物事を進めるのが得意だ'],
    ['最後までやり遂げず、途中で投げ出してしまうことがある', true],
    ['自分の持ち物や身の回りを整理整頓している'],
    ['意志が強く、誘惑に負けずに頑張れる'],
    ['ついつい物事を先延ばしにしてしまう', true],
    ['責任感が強く、任されたことは必ずやる'],
  ]),
  ...q('mj-axis-A-4', 'A4', 'personality', [
    ['心配事が多く、不安になりやすい'],
    ['プレッシャーに強く、いつも落ち着いている', true],
    ['気分が沈んだり、落ち込んだりしやすい'],
    ['ストレスが溜まっても、すぐに立ち直れる', true],
    ['感情の起伏が激しく、イライラしやすい'],
    ['人からどう見られているか、ひどく気になる'],
    ['緊張しやすく、リラックスするのが苦手だ'],
    ['小さな失敗でも、自分を責めてしまう'],
  ]),
  ...q('mj-axis-A-5', 'A5', 'personality', [
    ['独創的で、新しいアイデアを出すのが好きだ'],
    ['芸術や自然の美しさに深く感動する'],
    ['複雑なことを考えるより、単純な方が好きだ', true],
    ['知的好奇心が強く、いろいろなことを学びたい'],
    ['想像力が豊かで、空想にふけることがある'],
    ['伝統や決まったやり方を守るのが一番だと思う', true],
    ['抽象的な議論や、哲学的な問いに興味がある'],
    ['自分の知らない未知の世界に触れるのが楽しい'],
    ['物事を多面的に見るのが得意だ'],
    ['変化よりも、いつも通りの安定を好む', true],
    ['自分の感性や直感を大切にしている'],
  ]),

  ...paired('mj-axis-B-1-1', 'B1-1', '本質把握力', '日常の出来事や社会のニュースに対して、「なぜ？」「おかしいな」という違和感や、その裏にある背景に気づくことができますか？', '物事の表面的な現象だけでなく、その裏にある根本的な原因や、全体を貫く構造を見抜く力がありますか？'),
  ...paired('mj-axis-B-1-2', 'B1-2', '仮説・目的明確化力', '活動を通じて「何をどこまで明らかにしたいのか」という、具体的なゴール（目的）を定めることができますか？', '立てた問いに対し、「おそらくこうなるのではないか」という仮の答え（仮説）を、自分なりの根拠を持って立てる力がありますか？'),
  ...paired('mj-axis-B-1-3', 'B1-3', '問い設定力', '漠然とした疑問を、調査やインタビューで解決可能な具体的な「問い」の形に直すことができますか？', '課題を自分事として捉え、周囲の意見に流されずに、自分が本当に解決したいと思える問いを立てる力がありますか？'),
  ...paired('mj-axis-B-4-1', 'B4-1', '価値観認識力', '活動を通じて、自分が大切にしている考え方や、何に心を動かされるのかを自覚できていますか？', '自分がそのテーマや行動を選んだ「理由」を掘り下げ、自分の軸となる判断基準（価値観）を言葉で説明できますか？'),
  ...paired('mj-axis-B-4-2', 'B4-2', '強み・弱み把握力', '活動の中で、自分がスムーズにこなせる「得意な作業」や、苦戦する「苦手な作業」を具体的に挙げられますか？', '自分の得意・不得意がなぜ生じるのかを分析し、それを踏まえてこれからの活動の進め方を工夫できますか？'),
  ...paired('mj-axis-B-4-3', 'B4-3', '自己モニタリング', '立てた目標や計画に対して、今の進み具合や自分の行動が適切かどうかを客観的に振り返ることができますか？', '自分のモチベーションや感情の起伏（焦り、楽しさなど）を把握し、それが活動にどう影響しているかまで含めて自己評価できますか？'),

  ...paired('mj-axis-C-2-1', 'C2-1', '多角的視点', '自分の考えを補強する情報だけでなく、あえて異なる立場や反対意見の情報を意識して探すことができますか？', '一つの意見に偏らないよう、情報の偏りを客観的に評価し、多角的な視点で物事を検討する力がありますか？'),
  ...paired('mj-axis-C-2-2', 'C2-2', '計画力', '必要な情報を集めるために、「いつ・何を・どのような手順で行うか」という具体的なスケジュールや手順を立てることができますか？', '調査の目的に合わせ、限られた時間の中で最も効果的に情報を収集するための「効率的な収集手順」を設計する力がありますか？'),
  ...paired('mj-axis-C-2-3', 'C2-3', '検索・取材力', '文献やインターネット、あるいは人から情報を引き出すために、適切なキーワード設定や、相手に合わせた質問の設計ができますか？', '調査の目的に合わせ、書籍や論文といった「二次情報」と、インタビュー等の「一次情報」のどちらにアクセスすべきかを判断し、実行する力がありますか？'),
  ...paired('mj-axis-C-3-1', 'C3-1', '論理的思考力', '自分の考えを裏付ける具体的な根拠を示しながら、筋道を立てて矛盾のない結論を導き出すことができますか？', '導き出した結論に対して「十分な理由があるか」「論理に飛躍がないか」を客観的に検証し、考えの妥当性を評価する力がありますか？'),
  ...paired('mj-axis-C-3-2', 'C3-2', '構造的把握力', '複数の情報を共通点や相違点でグループ分けしたり、データを比較してその違いや傾向を読み取ったりすることができますか？', '情報同士の関係性（原因と結果、対立、包含など）を捉え、図や表を用いて物事の全体像を分かりやすく整理する力がありますか？'),
  ...paired('mj-axis-C-3-3', 'C3-3', '関連付け・発想力', '調査で得た情報と、自分が持っている知識や過去の経験を結びつけ、考えを深めることができますか？', '一見無関係に見える情報同士をつなぎ合わせ、自分なりの新しい解釈や、課題解決のための新しい意味を見出す力がありますか？'),
  ...paired('mj-axis-C-5-1', 'C5-1', '説得・独自性', '根拠と結論の関係を明確に示し、自分の主張の正当性を他者に納得させることができますか？', '調査の結果に自分なりの解釈や考察を加え、活動の価値や意味を独自の視点で伝える力がありますか？'),
  ...paired('mj-axis-C-5-2', 'C5-2', '伝達力', '聞き手の理解度に合わせて言葉を選び、自信を持って堂々と発表することができますか？', '聞き手の反応を観察しながら、説明の順序や強調するポイントをその場で柔軟に調整して伝える力がありますか？'),
  ...paired('mj-axis-C-5-3', 'C5-3', '構成・要約力', '多くの情報の中から最も伝えたい核心部分を絞り込み、簡潔な内容にまとめることができますか？', '伝える相手や目的に合わせて、図表の配置や全体のストーリー構成を戦略的に設計する力がありますか？'),
  ...paired('mj-axis-C-6-1', 'C6-1', '粘り強さ／グリット', '活動の途中で困難な課題や地道な作業があっても、投げ出さずに最後まで取り組むことができますか？', '大きな壁に突き当たったり、予想外の結果が出たりしても、アプローチを変えるなどして最後までやり遂げる力がありますか？'),
  ...paired('mj-axis-C-6-2', 'C6-2', '改善・展開力', '活動の中での失敗や反省点を分析し、「次はこうすれば良くなる」という具体的な改善策を考えることができますか？', '活動の結果から見つかった「新しい問い」や「課題」を明確にし、それを今後の活動や、他の関心事へとどう繋げていくかという展望を描く力がありますか？'),
  ...paired('mj-axis-C-6-3', 'C6-3', '知的好奇心', '探究のテーマに関連する事柄について、授業の時間以外でも自らニュースや本などの情報に触れ、関心を広げることができますか？', '一つの活動が区切りを迎えた後も、関連する分野やさらに発展的な内容について、自分から進んで調査や学習を続ける力がありますか？'),
  ...paired('mj-axis-C-7-1', 'C7-1', '役割遂行力', 'チーム内で決めた自分の役割やタスクを理解し、期限や約束を守って最後までやり遂げることができますか？', '自分の役割を果たすだけでなく、チーム全体の進み具合を把握し、必要に応じて自ら追加の仕事を引き受けるなどの行動ができますか？'),
  ...paired('mj-axis-C-7-2', 'C7-2', '共感的コミュニケーション・支援', '他者の意見を遮らずに聴き、自分の考えもチームメンバーに分かりやすく伝えることができますか？', 'メンバーの表情や進捗から困っている様子を察し、適切な助言をしたり、逆に自分から助けを求めたりする力がありますか？'),
  ...paired('mj-axis-C-7-3', 'C7-3', '調整・建設的介入', 'チームの成果を高めるために、他者の意見や行動に対して、良かった点や改善すべき点を具体的に伝えることができますか？', '意見が対立した際に、双方の意図を汲み取りながら、全員が納得できる解決策や建設的な提案を導き出す力がありますか？'),

  { axisId: 'mj-axis-D-1', code: 'D1', text: '活動や他者との関わりを通じて、心が動かされたり、自分の中に充実感や自信が湧いてきたりする感覚がありますか？', scale: 'heat', order: 86 },
  { axisId: 'mj-axis-D-2', code: 'D2', text: 'これまでの自分にはなかった新しい視点や感覚が開かれ、自分の可能性が広がっていくような手応えを感じていますか？', scale: 'heat', order: 87 },
  { axisId: 'mj-axis-D-3', code: 'D3', text: '今の活動に自分なりの意味を見出し、誰かに伝えたり、自ら次の動きを起こしたりしたくなるような意欲がありますか？', scale: 'heat', order: 88 },

  ...paired('mj-axis-E-1', 'E1', '停滞・葛藤時のリカバリー', '物事が思い通りに進まなかったり、活動が行き詰まったりした際、あきらめずに別のやり方を試すことができますか？', '自分の活動が止まっていることに自分で気づき、やる気や行動を立て直すための「具体的な方法」を自分の中に持っていますか？', 89),
  ...paired('mj-axis-E-2', 'E2', '外部資源の活用作法', '自分一人では解決できない問題に直面したとき、手遅れになる前の適切なタイミングで、周囲の人に助けを求めることができますか？', '目的を達成するために自分が必要としているサポートの内容を、周囲の人に対して正確に伝えることができますか？', 91),
  ...paired('mj-axis-E-3', 'E3', '小さな工夫の実行履歴', '活動の中で、自分が取り組みやすくなるような「自分なりのちょっとした工夫（やり方の変更など）」を、その都度加えることができますか？', '与えられた環境ややり方にただ従うのではなく、周囲との関わり方や役割を自ら調整して、自分が力を発揮しやすい状況を作る力がありますか？', 93),

  ...paired('mj-axis-F-1', 'F1', '関心', '自分自身の将来について、具体的な見通しを立てたり計画を練ったりする時間を取ることができますか？', '今取り組んでいる活動が自分の未来にどうつながるかを意識して、先を見越した準備を進める力がありますか？', 95),
  ...paired('mj-axis-F-2', 'F2', 'コントロール', '周囲の意見に流されすぎることなく、自分の進路や将来のことを自分自身で決めることができますか？', '将来の出来事は自分の選択や行動で変えられると信じて、自らの決定に責任を持って取り組む力がありますか？', 97),
  ...paired('mj-axis-F-3', 'F3', '好奇心', '一つのやり方や考え方にこだわらず、物事の異なる進め方や多様な選択肢を調べることができますか？', '自分が抱いた疑問や関心のある分野について、納得がいくまで深く突き詰める力がありますか？', 99),
  ...paired('mj-axis-F-4', 'F4', '自信', '将来に関わる難しい課題に直面しても、解決に向けてあきらめずに粘り強く取り組むことができますか？', '社会の変化や予期せぬ出来事が起きても、自分なら乗り越えられるという確信を持って進み続ける力がありますか？', 101),
  ...paired('mj-axis-F-5', 'F5', '協力', '自分の目標を実現するために、普段の人間関係にとらわれず、多様な考えを持つ人々と協力することができますか？', '他者と手を取り合うことが自分の可能性を広げると理解し、社会の中で良い人間関係を築きながら進む力がありますか？', 103),
  ...paired('mj-axis-F-6', 'F6', '相談', '将来の進路に迷いや悩みがあるとき、信頼できる大人や専門家に対して、自分から相談を持ちかけることができますか？', '自分の進むべき道を明確にするために、他者からの助言を自分の判断にうまく活かす力がありますか？', 105),

  ...paired('mj-axis-G-1', 'G1', '自己保身と誠実さ', '自分がミスをしたとき、誰かのせいにしたり言い訳をしたりせず、すぐに自分の非を認めることができますか？', '自分にとって不利な状況であっても、自分を正当化する嘘をつかずに、正直でい続けることができますか？', 107, 'heat'),
  ...paired('mj-axis-G-2', 'G2', '対人関係の清廉さ', 'その場にいない人の悪口や噂話が始まったとき、一度も加わったり同意したりせずにいられますか？', '他人の成功や幸運を、自分と比較して妬むことなく、いつでも心の底から祝福することができますか？', 109, 'heat'),
  ...paired('mj-axis-G-3', 'G3', '社会的規範の遵守', '誰も見ていない場所や、誰にも迷惑がかからないような状況でも、決められたルールやマナーをどんな時でも守ることができますか？', '自分の感情や「楽をしたい」という欲求に流されず、社会的に正しい振る舞いを優先して自分をコントロールすることができますか？', 111, 'heat'),
];

function q(axisId: string, codePrefix: string, scale: QuestionDef['scale'], items: Array<[string, boolean?]>): QuestionDef[] {
  const base = questionsOrderBase(codePrefix);
  return items.map(([text, reverse], index) => ({
    axisId,
    code: `${codePrefix}-${index + 1}`,
    text,
    scale,
    reverse,
    order: base + index,
  }));
}

function questionsOrderBase(codePrefix: string): number {
  const bases: Record<string, number> = { A1: 0, A2: 8, A3: 17, A4: 25, A5: 33 };
  return bases[codePrefix] ?? 0;
}

function paired(
  axisId: string,
  codePrefix: string,
  name: string,
  a: string,
  b: string,
  orderBase?: number,
  scale: QuestionDef['scale'] = 'ability',
): QuestionDef[] {
  const base = orderBase ?? 44 + pairedIndex++;
  if (orderBase == null) pairedIndex += 1;
  return [
    { axisId, code: `${codePrefix}-A`, text: `${name} / 問A（実行能力）：${a}`, scale, order: base },
    { axisId, code: `${codePrefix}-B`, text: `${name} / 問B（認識能力）：${b}`, scale, order: base + 1 },
  ];
}

function optionSet(scale: QuestionDef['scale'], reverse = false) {
  const labels = scale === 'personality' ? personalityLabels : scale === 'heat' ? heatLabels : abilityLabels;
  const max = labels.length;
  return labels.map(([value, label], order) => {
    const numeric = Number(value);
    const score = reverse ? (max - numeric) / (max - 1) : (numeric - 1) / (max - 1);
    return {
      label,
      value,
      text: reverse
        ? `${label}。この逆転項目では、当てはまりが弱いほど評価対象特性が高い。`
        : `${label}。この選択は評価対象特性の水準 ${numeric} を示す。`,
      order,
      explicitWeight: Math.round(score * 10000) / 10000,
    };
  });
}

function questionId(code: string) {
  return `mj-q-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function stripPairedPrefix(text: string) {
  return text.replace(/^.+? \/ 問[AB]（[^）]+）：/, '');
}

function rootCategory(axisId: string) {
  return axisId.match(/^mj-axis-([A-G])/)?.[1] ?? 'unknown';
}

const agefGDisplayText: Record<string, string> = {
  'G1-A': '自分がミスをしたとき、誰かのせいにしたり言い訳をしたりせず、すぐに自分の非を認める方だ。',
  'G1-B': '自分にとって不利な状況であっても、自分を正当化する嘘をつかずに、正直でいられる。',
  'G2-A': 'その場にいない人の悪口や噂話が始まったとき、加わったり同意したりすることは一度もない。',
  'G2-B': '他人の成功や幸運を、自分と比較して妬むことなく、いつでも心の底から祝福できる。',
  'G3-A': '誰も見ていない場所や、誰にも迷惑がかからないような状況でも、決められたルールやマナーを常に守っている。',
  'G3-B': '自分の感情や「楽をしたい」という欲求に流されず、社会的に正しい振る舞いを優先して自分をコントロールできる。',
};

function rubric(axis: AxisDef) {
  if (axis.mode === 'risk') {
    return [
      ['低リスク', '回答は自然で、印象操作や過剰な自己呈示の兆候は小さい。'],
      ['やや低リスク', '概ね自然だが、一部に望ましさを意識した回答の可能性がある。'],
      ['中程度リスク', '自己呈示の影響が一定程度あり、他軸の解釈では慎重な確認が必要。'],
      ['高リスク', '過度に理想的な回答が目立ち、社会的望ましさバイアスが強い可能性がある。'],
      ['非常に高リスク', '人間として自然な揺らぎをほぼ否定しており、印象操作または回答歪みのリスクが非常に高い。'],
    ];
  }
  return [
    ['萌芽', `${axis.name} はまだ未分化で、支援や具体的な場面設定がないと発揮されにくい。`],
    ['形成途上', `${axis.name} を意識し始めているが、実行には迷いや支援を要する。`],
    ['標準', `${axis.name} を日常的な活動場面で概ね発揮できる。`],
    ['発展', `${axis.name} を状況に応じて工夫し、他者や活動成果に結びつけられる。`],
    ['高度', `${axis.name} を自律的・安定的に発揮し、変化や困難の中でも再現性を持って活用できる。`],
  ];
}

async function main() {
  console.log('MoonJapan 評価モデルを投入します...');

  const existingModel = await prisma.evaluationModel.findUnique({ where: { id: MODEL_ID } });
  if (existingModel) {
    await prisma.evaluationModel.delete({ where: { id: MODEL_ID } });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'moonjapan' },
    update: { id: TENANT_ID, name: '株式会社MoonJapan', plan: TenantPlan.PROFESSIONAL, isActive: true },
    create: { id: TENANT_ID, slug: 'moonjapan', name: '株式会社MoonJapan', plan: TenantPlan.PROFESSIONAL },
  });

  const password = 'MoonJapan2026!';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@moon-japan.co.jp', tenantId: tenant.id } },
    update: { passwordHash, name: 'MoonJapan 管理者', role: UserRole.TENANT_ADMIN, isActive: true },
    create: {
      email: 'admin@moon-japan.co.jp',
      passwordHash,
      name: 'MoonJapan 管理者',
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
    },
  });

  const rawKey = 'ek_moonjapan_noncognitive_2026_local';
  await prisma.apiKey.upsert({
    where: { keyHash: crypto.createHash('sha256').update(rawKey).digest('hex') },
    update: { name: 'MoonJapan 非認知能力評価 APIキー', tenantId: tenant.id, isActive: true },
    create: {
      name: 'MoonJapan 非認知能力評価 APIキー',
      keyHash: crypto.createHash('sha256').update(rawKey).digest('hex'),
      tenantId: tenant.id,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: {
      name: '非認知能力評価モデル',
      description: 'MoonJapan 探究プログラム向け。高校生の非認知能力、熱量変化、現場・キャリア適応力、回答妥当性を縦断的に評価するプロジェクト。',
      tenantId: tenant.id,
      isActive: true,
    },
    create: {
      id: PROJECT_ID,
      name: '非認知能力評価モデル',
      description: 'MoonJapan 探究プログラム向け。高校生の非認知能力、熱量変化、現場・キャリア適応力、回答妥当性を縦断的に評価するプロジェクト。',
      tenantId: tenant.id,
    },
  });

  const model = await prisma.evaluationModel.create({
    data: {
      id: MODEL_ID,
      name: 'MoonJapan 非認知能力評価モデル v1',
      description: '20260415MJ 調査項目と分析ロジック案を反映。A-G 全大分類、3セットローテーション、逆転項目、社会的望ましさを含む。',
      projectId: project.id,
      tenantId: tenant.id,
      version: 1,
      status: ModelStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  for (const axis of rootAxes) {
    await prisma.axis.create({
      data: {
        id: axis.id,
        name: axis.name,
        description: axis.description,
        weight: axis.weight,
        order: axis.order,
        modelId: model.id,
        idealStateText: axis.mode === 'risk' ? '回答妥当性のリスクを適切に検知できる。' : `${axis.name} が高く発揮されている。`,
        lowStateText: axis.mode === 'risk' ? '回答妥当性上の懸念が小さい。' : `${axis.name} がまだ十分には発揮されていない。`,
      },
    });
  }

  for (const axis of leafAxes) {
    await prisma.axis.create({
      data: {
        id: axis.id,
        name: axis.name,
        description: axis.description,
        weight: axis.weight,
        order: axis.order,
        parentId: axis.parent,
        modelId: model.id,
        idealStateText: axis.mode === 'risk' ? `${axis.name} が高く、印象操作リスクとして扱う。` : `${axis.name} を自律的・安定的に発揮できる。`,
        lowStateText: axis.mode === 'risk' ? `${axis.name} が低く、回答は自然である。` : `${axis.name} は形成途上で、場面支援が必要。`,
      },
    });
    const levels = rubric(axis);
    for (let i = 0; i < levels.length; i++) {
      await prisma.axisRubricLevel.create({
        data: {
          axisId: axis.id,
          level: i + 1,
          label: levels[i][0],
          description: levels[i][1],
        },
      });
    }
  }

  for (const question of questions) {
    const created = await prisma.question.create({
      data: {
        id: questionId(question.code),
        text: question.text,
        type: QuestionType.SINGLE_CHOICE,
        required: true,
        order: question.order,
        modelId: model.id,
      },
    });

    await prisma.questionAxisMapping.create({
      data: {
        id: `mj-map-${created.id}-${question.axisId}`,
        questionId: created.id,
        axisId: question.axisId,
        contributionWeight: question.contributionWeight ?? 1,
      },
    });

    const options = optionSet(question.scale, question.reverse);
    for (const option of options) {
      await prisma.questionOption.create({
        data: {
          id: `mj-opt-${created.id}-${option.value}`,
          questionId: created.id,
          ...option,
        },
      });
    }

    const criteriaLabels = question.scale === 'personality' ? personalityLabels : question.scale === 'heat' ? heatLabels : abilityLabels;
    for (const [value, label] of criteriaLabels) {
      await prisma.questionCriteria.create({
        data: {
          questionId: created.id,
          level: Number(value),
          label,
          description: question.reverse
            ? `逆転項目。回答値 ${value} は、選択肢スコア上では反転して評価される。`
            : `回答値 ${value} は「${label}」として評価される。`,
        },
      });
    }
  }

  const fullGroup = await prisma.questionGroup.create({
    data: {
      id: 'mj-qg-full-ag',
      modelId: model.id,
      name: '質問グループ1: フル調査 A-G',
      description: 'A-G全体を一度に測定するフル質問グループ。評価モデル本体はこのA-G構造を基準にする。',
      groupType: QuestionGroupType.FULL,
      order: 0,
      config: {
        source: '20260415MJ_調査項目と分析ロジック案.docx',
        coverage: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        scoringPolicy: '各質問はquestion_axis_mappingsに従って評価軸へ配点する',
      },
    },
  });

  for (const [index, question] of questions.entries()) {
    await prisma.questionGroupItem.create({
      data: {
        id: `mj-qgi-full-${questionId(question.code)}`,
        groupId: fullGroup.id,
        questionId: questionId(question.code),
        displayText: question.text,
        order: index,
        block: `大分類${rootCategory(question.axisId)}`,
        shuffleGroup: rootCategory(question.axisId),
        metadata: {
          code: question.code,
          axisId: question.axisId,
          compressed: false,
          rootCategory: rootCategory(question.axisId),
        },
      },
    });
  }

  await prisma.questionGroup.create({
    data: {
      id: 'mj-qg-compressed-v1',
      modelId: model.id,
      name: '質問グループ2: 圧縮調査',
      description: '1問を複数評価軸へ紐づける圧縮質問用グループ。圧縮質問はquestion_axis_mappingsで対象軸と寄与度を明示する。',
      groupType: QuestionGroupType.COMPRESSED,
      order: 1,
      isActive: true,
      config: {
        coverage: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        status: 'ready_for_compressed_questions',
        policy: [
          '質問数削減のために1問へ複数軸を紐づけられる',
          '各質問がどの評価軸に効くかはquestion_axis_mappingsで管理する',
          '圧縮測定ではcoverage/confidenceを出力側で明示する',
        ],
      },
    },
  });

  const agefGroup = await prisma.questionGroup.create({
    data: {
      id: 'mj-qg-baseline-agef',
      modelId: model.id,
      name: '質問グループ3: ベースライン調査 AGEF',
      description: '20260418ベースライン調査_AGEFに基づく初回調査。評価モデルはA-Gのまま、取得対象をA/E/F/Gに限定する。',
      groupType: QuestionGroupType.BASELINE,
      order: 2,
      config: {
        source: '20260418ベースライン調査_AGEF.docx',
        coverage: ['A', 'E', 'F', 'G'],
        excluded: ['B', 'C', 'D'],
        questionCount: 68,
        delivery: [
          { block: 'A/G', shuffleGroup: 'agef-ag', description: 'AパーソナリティとG社会的望ましさを混合してシャッフル' },
          { block: 'E/F 問A', shuffleGroup: 'agef-ef-a', description: 'E/Fの問A（実行）を混合してシャッフル' },
          { block: 'E/F 問B', shuffleGroup: 'agef-ef-b', description: 'E/Fの問B（認識）を混合してシャッフル' },
        ],
        labels: {
          A: personalityLabels,
          E: abilityLabels,
          F: abilityLabels,
          G: heatLabels,
        },
      },
    },
  });

  const agefAG = questions.filter((question) => ['A', 'G'].includes(rootCategory(question.axisId)));
  const agefEFA = questions.filter((question) => ['E', 'F'].includes(rootCategory(question.axisId)) && question.code.endsWith('-A'));
  const agefEFB = questions.filter((question) => ['E', 'F'].includes(rootCategory(question.axisId)) && question.code.endsWith('-B'));
  const agefItems = [
    ...agefAG.map((question, index) => ({ question, order: index, block: 'A/G', shuffleGroup: 'agef-ag' })),
    ...agefEFA.map((question, index) => ({ question, order: 50 + index, block: 'E/F 問A（実行）', shuffleGroup: 'agef-ef-a' })),
    ...agefEFB.map((question, index) => ({ question, order: 59 + index, block: 'E/F 問B（認識）', shuffleGroup: 'agef-ef-b' })),
  ];

  for (const item of agefItems) {
    const displayText = agefGDisplayText[item.question.code]
      ?? (['E', 'F'].includes(rootCategory(item.question.axisId)) ? stripPairedPrefix(item.question.text) : item.question.text);
    await prisma.questionGroupItem.create({
      data: {
        id: `mj-qgi-agef-${questionId(item.question.code)}`,
        groupId: agefGroup.id,
        questionId: questionId(item.question.code),
        displayText,
        order: item.order,
        block: item.block,
        shuffleGroup: item.shuffleGroup,
        metadata: {
          code: item.question.code,
          axisId: item.question.axisId,
          rootCategory: rootCategory(item.question.axisId),
          compressed: false,
          source: '20260418ベースライン調査_AGEF.docx',
        },
      },
    });
  }

  await prisma.resultTemplate.create({
    data: {
      modelId: model.id,
      name: 'MoonJapan 非認知能力評価レポート',
      outputType: 'NONCOGNITIVE_PROFILE',
      config: {
        sourceDocument: '20260415MJ_調査項目と分析ロジック案.docx',
        scoringWeights: {
          A: 0.2,
          B: 0.18,
          C: 0.27,
          D: 0.1,
          E: 0.15,
          F: 0.15,
          G: 0.05,
        },
        rotationSets: {
          alpha: ['本質把握力', '価値観認識力', '多角的視点', '論理的思考力', '説得・独自性', '粘り強さ／グリット', '役割遂行力'],
          beta: ['仮説・目的明確化力', '強み・弱み把握力', '計画力', '構造的把握力', '伝達力', '改善・展開力', '共感的コミュニケーション・支援'],
          gamma: ['問い設定力', '自己モニタリング', '検索・取材力', '関連付け・発想力', '構成・要約力', '知的好奇心', '調整・建設的介入'],
        },
        interpretationPolicy: [
          'Aは静的なP-O Fit基礎変数として期初測定を想定する。',
          'B/C/D/E/Fは動的・縦断的な成長軌跡として解釈する。',
          'Gは能力加点ではなく、回答妥当性と印象操作リスクの補助指標として扱う。',
          '逆転項目は explicitWeight により採点時に反転済み。',
        ],
      },
      promptTemplate: [
        'MoonJapanの非認知能力評価として、A-Gの軸スコアを統合して解釈する。',
        '中間層の3タイプ（凸凹層、潜在層、着実層）を念頭に、強み、成長余白、現場適応、キャリア適応を具体的に記述する。',
        'G.社会的望ましさが高い場合は、他軸スコアの過信を避け、追加確認を推奨する。',
        '企業マッチングでは P-O Fit、プロセス・レジリエンス、オンボーディングの3ロジックで提案する。',
      ].join('\n'),
    },
  });

  const outputFormats = [
    {
      id: 'mj-output-student-growth',
      name: '生徒向け成長プロファイル',
      outputType: 'STUDENT_GROWTH_PROFILE',
      order: 0,
      config: { audience: 'student', sections: ['強み', '成長の余白', '次の一歩', '熱量の変化'] },
    },
    {
      id: 'mj-output-company-matching',
      name: '企業向けマッチング所見',
      outputType: 'COMPANY_MATCHING_REPORT',
      order: 1,
      config: { audience: 'company', logic: ['P-O Fit', 'プロセス・レジリエンス', 'オンボーディング'] },
    },
    {
      id: 'mj-output-validity',
      name: '回答妥当性・社会的望ましさレポート',
      outputType: 'VALIDITY_RISK_REPORT',
      order: 2,
      config: { audience: 'admin', focusAxis: 'G. 社会的望ましさ', caution: '高スコアは能力ではなく印象操作リスクとして扱う' },
    },
  ];

  for (const format of outputFormats) {
    await prisma.outputFormat.create({
      data: {
        ...format,
        modelId: model.id,
        description: `${format.name}を生成するための出力形式。`,
        axisWeights: rootAxes.reduce<Record<string, number>>((acc, axis) => {
          acc[axis.name] = axis.weight;
          return acc;
        }, {}),
      },
    });
  }

  const counts = await Promise.all([
    prisma.axis.count({ where: { modelId: model.id } }),
    prisma.question.count({ where: { modelId: model.id } }),
    prisma.questionOption.count({ where: { question: { modelId: model.id } } }),
    prisma.questionGroup.count({ where: { modelId: model.id } }),
    prisma.questionGroupItem.count({ where: { group: { modelId: model.id } } }),
  ]);

  console.log('MoonJapan 評価モデル投入完了');
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Project: ${project.name} (${project.id})`);
  console.log(`Model: ${model.name} (${model.id})`);
  console.log(`Axes: ${counts[0]}, Questions: ${counts[1]}, Options: ${counts[2]}, QuestionGroups: ${counts[3]}, QuestionGroupItems: ${counts[4]}`);
  console.log('Admin: admin@moon-japan.co.jp / MoonJapan2026! / tenantId=tenant-moonjapan');
  console.log(`API Key: ${rawKey}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
