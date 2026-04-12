'use client';

import { useState, useTransition } from 'react';
import { createApiKey, revokeApiKey } from '@/actions/tenant.actions';
import { Copy, Key, Plus, X } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
  lastUsed: string | null;
  createdAt: string;
}

interface Props {
  tenantId: string;
  initialKeys: ApiKey[];
}

export function ApiKeySection({ tenantId, initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyData, setNewKeyData] = useState<{ key: string; name: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set('name', name);
    startTransition(async () => {
      try {
        const result = await createApiKey(tenantId, fd);
        if (result?.key) {
          setNewKeyData({ key: result.key, name });
          setKeys((prev) => [{ id: result.id, name, isActive: true, lastUsed: null, createdAt: new Date().toISOString() }, ...prev]);
        }
        setName('');
        setShowForm(false);
      } catch {}
    });
  }

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeApiKey(id, tenantId);
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, isActive: false } : k));
    });
  }

  function copyKey() {
    if (newKeyData) {
      navigator.clipboard.writeText(newKeyData.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-800">APIキー管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">外部アプリから回答を送信するためのキー</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} />
          新規発行
        </button>
      </div>

      {/* 新しいキー表示 */}
      {newKeyData && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-2">
            ✅ 「{newKeyData.name}」が発行されました。このキーは一度だけ表示されます。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-xs font-mono text-gray-800 overflow-x-auto">
              {newKeyData.key}
            </code>
            <button
              onClick={copyKey}
              className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
            >
              <Copy size={12} />
              {copied ? 'コピー済' : 'コピー'}
            </button>
          </div>
          <p className="text-xs text-green-600 mt-2">
            リクエストヘッダーに <code className="bg-green-100 px-1 rounded">X-Api-Key: {newKeyData.key}</code> として設定してください
          </p>
          <button onClick={() => setNewKeyData(null)} className="text-xs text-green-600 underline mt-1">閉じる</button>
        </div>
      )}

      {/* 新規作成フォーム */}
      {showForm && (
        <div className="mb-4 bg-gray-50 rounded-lg p-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="キー名（例: 採用アプリ用）"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? '発行中...' : '発行'}
          </button>
          <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* キー一覧 */}
      {keys.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          <Key size={24} className="mx-auto mb-2 opacity-40" />
          APIキーがまだありません
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${k.isActive ? 'border-gray-100 bg-gray-50' : 'border-gray-100 bg-gray-50 opacity-50'}`}
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{k.name}</p>
                <p className="text-xs text-gray-400">
                  作成: {new Date(k.createdAt).toLocaleDateString('ja-JP')}
                  {k.lastUsed && ` • 最終使用: ${new Date(k.lastUsed).toLocaleDateString('ja-JP')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${k.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {k.isActive ? '有効' : '無効'}
                </span>
                {k.isActive && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    無効化
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
