import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';
import { Users, KeyRound, ExternalLink, ChevronRight } from 'lucide-react';

export default async function PortalSettingsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken ?? '';
  const role = (session as any)?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  let users: any[] = [];
  let apiKeys: any[] = [];

  await Promise.all([
    apiClient.get('/users', token).then((r) => { users = r.data ?? []; }).catch(() => {}),
    apiClient.get('/api-keys', token).then((r) => { apiKeys = r.data ?? []; }).catch(() => {}),
  ]);

  const activeKeys = apiKeys.filter((k) => k.isActive);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500 mt-1">ユーザー管理・APIキー管理</p>
      </div>

      <div className="space-y-4">
        {/* Users */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">ユーザー管理</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{users.length}人</span>
            </div>
            {isSuperAdmin && (
              <Link href="/users" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                詳細管理 <ExternalLink size={11} />
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {users.slice(0, 5).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-indigo-600">
                    {(u.name ?? u.email ?? '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name ?? u.email}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                  {u.role}
                </span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${u.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
              </div>
            ))}
            {users.length === 0 && (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">ユーザーがいません</div>
            )}
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <KeyRound size={15} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">APIキー</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{activeKeys.length}件有効</span>
            </div>
            {isSuperAdmin && (
              <Link href="/api-keys" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                管理 <ExternalLink size={11} />
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {apiKeys.slice(0, 5).map((k: any) => (
              <div key={k.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-400">
                    作成: {new Date(k.createdAt).toLocaleDateString('ja-JP')}
                    {k.lastUsed && ` · 最終使用: ${new Date(k.lastUsed).toLocaleDateString('ja-JP')}`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {k.isActive ? '有効' : '無効'}
                </span>
              </div>
            ))}
            {apiKeys.length === 0 && (
              <div className="px-5 py-6 text-center text-gray-400 text-sm">
                APIキーがありません<br />
                {isSuperAdmin && (
                  <Link href="/api-keys" className="text-indigo-600 text-xs hover:underline mt-1 inline-block">
                    APIキーを発行する →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">クイックリンク</h2>
          <div className="space-y-2">
            {[
              { label: 'Swagger API ドキュメント', href: 'https://evalengine-api-2aq8.onrender.com/api/docs', external: true },
              { label: 'APIキー管理', href: '/api-keys', external: false },
              ...(isSuperAdmin ? [{ label: 'ユーザー管理', href: '/users', external: false }] : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                <ChevronRight size={13} />
                {item.label}
                {item.external && <ExternalLink size={11} />}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
