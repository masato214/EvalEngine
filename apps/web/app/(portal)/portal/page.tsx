import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Brain, BarChart3, CheckCircle, Clock, AlertCircle, TrendingUp, Users, ArrowRight } from 'lucide-react';

export default async function PortalHomePage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';

  let models: any[] = [];
  let sessions: any[] = [];
  let results: any[] = [];

  await Promise.all([
    apiClient.get('/evaluation-models?pageSize=100', token).then((r) => { models = r.data ?? []; }).catch(() => {}),
    apiClient.get('/sessions', token).then((r) => { const d = r.data ?? r; sessions = Array.isArray(d) ? d : []; }).catch(() => {}),
    apiClient.get('/results?pageSize=5', token).then((r) => { results = r.data ?? []; }).catch(() => {}),
  ]);

  const publishedModels = models.filter((m) => m.status === 'PUBLISHED');
  const draftModels = models.filter((m) => m.status === 'DRAFT');
  const activeSessions = sessions.filter((s) => s.status === 'STARTED' || s.status === 'ANSWERING');
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');

  return (
    <div className="max-w-5xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">ポータルホーム</h1>
        <p className="text-sm text-gray-500 mt-1">評価モデルの管理、回答状況の確認、結果の閲覧ができます</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="公開中モデル"
          value={publishedModels.length}
          icon={<CheckCircle size={18} className="text-green-500" />}
          color="bg-green-50"
          href="/portal/models"
        />
        <StatCard
          label="下書きモデル"
          value={draftModels.length}
          icon={<Clock size={18} className="text-gray-400" />}
          color="bg-gray-50"
          href="/portal/models"
        />
        <StatCard
          label="受付中セッション"
          value={activeSessions.length}
          icon={<Users size={18} className="text-blue-500" />}
          color="bg-blue-50"
          href="/portal/results"
        />
        <StatCard
          label="完了セッション"
          value={completedSessions.length}
          icon={<TrendingUp size={18} className="text-purple-500" />}
          color="bg-purple-50"
          href="/portal/results"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Models */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">評価モデル</h2>
            </div>
            <Link href="/portal/models" className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              すべて見る <ArrowRight size={11} />
            </Link>
          </div>
          {models.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">評価モデルがありません</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {models.slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={`/evaluation-models/${m.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">v{m.version}</p>
                  </div>
                  <StatusBadge status={m.status} />
                  <ArrowRight size={12} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-50">
            <Link
              href="/evaluation-models/new"
              className="text-xs text-indigo-600 hover:underline"
            >
              + 新規評価モデルを作成
            </Link>
          </div>
        </div>

        {/* Recent results */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-purple-500" />
              <h2 className="text-sm font-semibold text-gray-800">最近の結果</h2>
            </div>
            <Link href="/portal/results" className="text-xs text-purple-600 hover:underline flex items-center gap-1">
              すべて見る <ArrowRight size={11} />
            </Link>
          </div>
          {results.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              まだ結果がありません<br />
              <span className="text-xs">評価モデルを公開して回答を集めましょう</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {results.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.respondentRef}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(r.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{Math.round(r.overallScore * 100)}%</p>
                    <p className="text-xs text-gray-400">総合スコア</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, href }: { label: string; value: number; icon: React.ReactNode; color: string; href: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 transition-colors">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Link>
  );
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '下書き', color: 'bg-gray-100 text-gray-500' },
  REVIEW: { label: 'レビュー中', color: 'bg-yellow-100 text-yellow-700' },
  PUBLISHED: { label: '公開中', color: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: 'アーカイブ', color: 'bg-red-100 text-red-600' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: 'bg-gray-100 text-gray-500' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.color}`}>{s.label}</span>;
}
