'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, X, Copy, Check, KeyRound, ExternalLink, AlertTriangle, BookOpen, Globe, Lock, Ban } from 'lucide-react';
import { createApiKey, revokeApiKey, deleteApiKey } from '@/actions/api-key.actions';

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  lastUsed?: string;
  createdAt: string;
}

// APIエンドポイントの説明
const API_SECTIONS = [
  {
    title: 'セッション管理',
    color: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/sessions',
        desc: 'セッションを開始する（回答収集の単位）',
        body: '{ "modelId": "xxx", "userExternalId": "user-001" }',
        note: '公開済み（PUBLISHED）の評価モデルIDが必要',
      },
      {
        method: 'GET',
        path: '/api/v1/sessions/:id/questions',
        desc: '質問一覧を取得する',
        note: '回答フォーム表示に使用',
      },
    ],
  },
  {
    title: '回答送信',
    color: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    endpoints: [
      {
        method: 'POST',
        path: '/api/v1/sessions/:id/answers',
        desc: '回答を送信して分析を実行',
        body: '{ "respondentMeta": {...}, "items": [{ "questionId": "xxx", "value": "回答値" }] }',
        note: '送信後、自動的に分析キューに入る',
      },
    ],
  },
  {
    title: '結果取得',
    color: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/sessions/:id/result',
        desc: 'セッションの最新分析結果を取得',
        note: '分析完了（COMPLETED）後に使用可能',
      },
      {
        method: 'GET',
        path: '/api/v1/results/respondent/:ref',
        desc: '回答者IDで過去の結果を検索',
        note: 'userExternalIdで紐付け',
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
      title="コピー"
    >
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

function NewKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: ApiKey & { key: string }) => void }) {
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('キー名は必須です'); return; }
    setError('');
    startTransition(async () => {
      try {
        const result = await createApiKey(name);
        onCreated(result);
        onClose();
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">新しいAPIキーを作成</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              キー名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: 採用管理システム用、Webフォーム用"
              autoFocus
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '作成中...' : '作成'}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KeyRevealModal({ apiKey, tenantId, onClose }: { apiKey: { name: string; key: string }; tenantId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">APIキーが作成されました</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700">このキーは今一度しか表示されません</p>
              <p className="text-xs text-amber-600 mt-1">必ずコピーして安全な場所に保管してください。ページを閉じると二度と確認できません。</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">「{apiKey.name}」のAPIキー</p>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
              <code className="text-green-400 text-sm font-mono flex-1 break-all">{apiKey.key}</code>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors flex-shrink-0 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                }`}
              >
                {copied ? <><Check size={12} /> コピー済み</> : <><Copy size={12} /> コピー</>}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">使い方</p>
            <p className="text-xs text-gray-500 mb-2">APIリクエストのヘッダーに以下を含めてください：</p>
            <pre className="text-xs bg-gray-900 text-green-400 rounded px-3 py-2 block font-mono whitespace-pre-wrap break-words">
{`x-tenant-id: ${tenantId}
x-api-key: ${apiKey.key}`}
            </pre>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            コピーしました、閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApiKeysClient({ initialKeys, tenantId }: { initialKeys: ApiKey[]; tenantId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [showNewModal, setShowNewModal] = useState(false);
  const [revealKey, setRevealKey] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');

  function handleCreated(result: ApiKey & { key: string }) {
    const { key, ...keyRecord } = result;
    setKeys((prev) => [keyRecord, ...prev]);
    setRevealKey({ name: keyRecord.name, key });
  }

  function handleRevoke(id: string, name: string) {
    if (!confirm(`「${name}」を無効化しますか？`)) return;
    setError('');
    startTransition(async () => {
      try {
        await revokeApiKey(id);
        setKeys((prev) => prev.map((k) => k.id === id ? { ...k, isActive: false } : k));
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を完全に削除しますか？この操作は取り消せません。`)) return;
    setError('');
    startTransition(async () => {
      try {
        await deleteApiKey(id);
        setKeys((prev) => prev.filter((k) => k.id !== id));
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API管理</h1>
          <p className="text-sm text-gray-500 mt-1">外部システムからEvalEngineを呼び出すためのAPIキーを管理します</p>
        </div>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0">
          {[
            { key: 'keys', label: 'APIキー', icon: KeyRound },
            { key: 'docs', label: 'APIドキュメント', icon: BookOpen },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* APIキータブ */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              新しいAPIキーを作成
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Lock size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700">APIキーは安全に管理してください</p>
              <p className="text-xs text-amber-600 mt-0.5">
                APIキーは外部アプリからの認証に使用されます。第三者に漏洩しないよう注意し、定期的にローテーションしてください。
              </p>
            </div>
          </div>

          {keys.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
              <KeyRound size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">APIキーがまだありません</p>
              <p className="text-gray-400 text-xs mt-1">「新しいAPIキーを作成」から発行してください</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">キー名</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">最終使用</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">作成日</th>
                    <th className="px-4 py-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <KeyRound size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900">{k.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {k.isActive ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {k.lastUsed
                          ? new Date(k.lastUsed).toLocaleString('ja-JP')
                          : '未使用'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(k.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {k.isActive && (
                            <button
                              onClick={() => handleRevoke(k.id, k.name)}
                              disabled={isPending}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 px-2 py-1 rounded hover:bg-amber-50 transition-colors disabled:opacity-50"
                              title="無効化"
                            >
                              <Ban size={12} />
                              無効化
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(k.id, k.name)}
                            disabled={isPending}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors disabled:opacity-50"
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* APIドキュメントタブ */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          {/* 認証説明 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">認証方法</h2>
            <p className="text-sm text-gray-600 mb-3">
              すべてのAPIリクエストにAPIキーをヘッダーで送信してください。
            </p>
            <div className="bg-gray-900 rounded-xl px-5 py-3 flex items-center gap-3">
              <code className="text-green-400 text-sm font-mono flex-1 whitespace-pre-wrap">
{`x-tenant-id: ${tenantId || 'tenant-moonjapan'}
x-api-key: ek_your_api_key_here`}
              </code>
              <CopyButton text={`x-tenant-id: ${tenantId || 'tenant-moonjapan'}\nx-api-key: ek_your_api_key_here`} />
            </div>
            <p className="text-xs text-gray-500 mt-3">
              ベースURL: <code className="bg-gray-100 px-1.5 py-0.5 rounded">https://evalengine-api-2aq8.onrender.com/api/v1</code>
            </p>
          </div>

          {/* エンドポイント一覧 */}
          {API_SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">{section.title}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {section.endpoints.map((ep, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono flex-shrink-0 mt-0.5 ${METHOD_COLORS[ep.method]}`}>
                        {ep.method}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-gray-900">{ep.path}</code>
                          <CopyButton text={`https://evalengine-api-2aq8.onrender.com/api/v1${ep.path}`} />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{ep.desc}</p>
                        {ep.note && (
                          <p className="text-xs text-gray-400 mt-1">💡 {ep.note}</p>
                        )}
                      </div>
                    </div>
                    {ep.body && (
                      <div className="ml-12 mt-2">
                        <p className="text-xs text-gray-500 mb-1">リクエストボディ（JSON）:</p>
                        <pre className="bg-gray-900 text-green-400 text-xs font-mono rounded-lg px-4 py-3 overflow-x-auto">
                          {ep.body}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Swagger リンク */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">インタラクティブなAPIドキュメント（Swagger）</p>
              <p className="text-xs text-blue-600 mt-1">
                すべてのエンドポイントを試せるSwagger UIを開けます。開発・テスト用途に便利です。
              </p>
            </div>
            <a
              href="https://evalengine-api-2aq8.onrender.com/api/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0 ml-4"
            >
              <Globe size={14} />
              Swaggerを開く
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {showNewModal && (
        <NewKeyModal onClose={() => setShowNewModal(false)} onCreated={handleCreated} />
      )}

      {revealKey && (
        <KeyRevealModal apiKey={revealKey} tenantId={tenantId || 'tenant-moonjapan'} onClose={() => setRevealKey(null)} />
      )}
    </div>
  );
}
