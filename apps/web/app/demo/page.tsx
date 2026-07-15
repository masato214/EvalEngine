import { GraduationCap, BookOpen, ExternalLink } from 'lucide-react';

const MOCK_D = 'eyJtb2RlbE5hbWUiOiLjg6Djg7zjg7Pjgrjjg6Pjg5Hjg7Mg6Z2e6KqN55%2Bl6IO95Yqb6KmV5L6hIHYxIiwib3ZlcmFsbFNjb3JlIjowLjY4NCwib3ZlcmFsbFJ1YnJpY0xldmVsIjozLjcsIm92ZXJhbGxQZXJjZW50Ijo2OCwicmVzcG9uZGVudFJlZiI6IueUsOS4rSDoirHlrZAiLCJ0aW1lc3RhbXAiOjE3Nzg1OTE1Njk4OTQsImF4aXNTY29yZXMiOlt7ImF4aXNJZCI6ImF4MSIsImF4aXNOYW1lIjoi6Ieq5b6L6YGC6KGM5YqbIiwic2NvcmUiOjAuNzIsInJ1YnJpY0xldmVsIjozLjksInBlcmNlbnQiOjcyLCJjaGlsZFNjb3JlcyI6W3siYXhpc0lkIjoiYXgxYSIsImF4aXNOYW1lIjoi6KiI55S744O75q615Y%2BW44KK5YqbIiwic2NvcmUiOjAuNzYsInJ1YnJpY0xldmVsIjo0LCJwZXJjZW50Ijo3NiwiY2hpbGRTY29yZXMiOltdfSx7ImF4aXNJZCI6ImF4MWIiLCJheGlzTmFtZSI6IuiHquW3seeuoeeQhuODu%2BOChOOCiuaKnOOBj%2BWKmyIsInNjb3JlIjowLjY4LCJydWJyaWNMZXZlbCI6My43LCJwZXJjZW50Ijo2OCwiY2hpbGRTY29yZXMiOltdfV19LHsiYXhpc0lkIjoiYXgyIiwiYXhpc05hbWUiOiLlvbnlibLpgYLooYzlipsiLCJzY29yZSI6MC44MSwicnVicmljTGV2ZWwiOjQuMiwicGVyY2VudCI6ODEsImNoaWxkU2NvcmVzIjpbeyJheGlzSWQiOiJheDJhIiwiYXhpc05hbWUiOiLjg4Hjg7zjg6Djgbjjga7osqLnjK4iLCJzY29yZSI6MC44NSwicnVicmljTGV2ZWwiOjQuNCwicGVyY2VudCI6ODUsImNoaWxkU2NvcmVzIjpbXX0seyJheGlzSWQiOiJheDJiIiwiYXhpc05hbWUiOiLosqzku7vmhJ%2Fjg7vntITmnZ%2FpgbXlrogiLCJzY29yZSI6MC43NywicnVicmljTGV2ZWwiOjQuMSwicGVyY2VudCI6NzcsImNoaWxkU2NvcmVzIjpbXX1dfSx7ImF4aXNJZCI6ImF4MyIsImF4aXNOYW1lIjoi44Kz44Of44Ol44OL44Kx44O844K344On44Oz5YqbIiwic2NvcmUiOjAuNjMsInJ1YnJpY0xldmVsIjozLjUsInBlcmNlbnQiOjYzLCJjaGlsZFNjb3JlcyI6W3siYXhpc0lkIjoiYXgzYSIsImF4aXNOYW1lIjoi5YK%2B6IG044O75YWx5oSf5YqbIiwic2NvcmUiOjAuNywicnVicmljTGV2ZWwiOjMuOCwicGVyY2VudCI6NzAsImNoaWxkU2NvcmVzIjpbXX0seyJheGlzSWQiOiJheDNiIiwiYXhpc05hbWUiOiLnmbrkv6Hjg7vooajnj77lipsiLCJzY29yZSI6MC41NiwicnVicmljTGV2ZWwiOjMuMiwicGVyY2VudCI6NTYsImNoaWxkU2NvcmVzIjpbXX1dfSx7ImF4aXNJZCI6ImF4NCIsImF4aXNOYW1lIjoi5ZWP6aGM6Kej5rG644O75oCd6ICD5YqbIiwic2NvcmUiOjAuNTgsInJ1YnJpY0xldmVsIjozLjMsInBlcmNlbnQiOjU4LCJjaGlsZFNjb3JlcyI6W3siYXhpc0lkIjoiYXg0YSIsImF4aXNOYW1lIjoi6Kqy6aGM55m66KaL5YqbIiwic2NvcmUiOjAuNjIsInJ1YnJpY0xldmVsIjozLjUsInBlcmNlbnQiOjYyLCJjaGlsZFNjb3JlcyI6W119LHsiYXhpc0lkIjoiYXg0YiIsImF4aXNOYW1lIjoi6KuW55CG55qE5oCd6ICD44O75pS55ZaE5YqbIiwic2NvcmUiOjAuNTQsInJ1YnJpY0xldmVsIjozLjIsInBlcmNlbnQiOjU0LCJjaGlsZFNjb3JlcyI6W119XX0seyJheGlzSWQiOiJheDUiLCJheGlzTmFtZSI6IuS4u%2BS9k%2BaAp%2BODu%2BaMkeaIpuWKmyIsInNjb3JlIjowLjc0LCJydWJyaWNMZXZlbCI6My45LCJwZXJjZW50Ijo3NCwiY2hpbGRTY29yZXMiOltdfV19';

const studentUrl = `/demo/student?d=${MOCK_D}`;
const teacherUrl = `/demo/teacher?d=${MOCK_D}`;

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            DEMO
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">EvalEngine 評価結果デモ</h1>
          <p className="text-sm text-gray-500">
            ムーンジャパン 非認知能力評価 v1<br />
            回答者：田中 花子 / 総合スコア 68%
          </p>
        </div>

        <div className="space-y-4">
          <a
            href={studentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                <GraduationCap size={22} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-gray-900">生徒用ビュー</h2>
                  <ExternalLink size={13} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  評価結果・キャリアタイプ・進路マッチング・強みと伸びしろを表示。生徒が自分のスコアを確認する画面。
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['レーダーチャート', 'キャリアタイプ判定', '進路先マッチング', '強み・成長ポイント'].map((t) => (
                    <span key={t} className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </a>

          <a
            href={teacherUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                <BookOpen size={22} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base font-bold text-gray-900">先生用ビュー</h2>
                  <ExternalLink size={13} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  指導・支援のための詳細分析。ベンチマーク比較・評価グレード・指導コメント生成ツールを含む教師向け画面。
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['評価グレード（S〜D）', 'ベンチマーク比較', '軸別詳細分析', '指導コメント'].map((t) => (
                    <span key={t} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
