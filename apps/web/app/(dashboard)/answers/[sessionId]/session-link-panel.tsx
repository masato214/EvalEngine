'use client';

import { useState } from 'react';
import { Copy, Link2, Check, ExternalLink } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  isActive: boolean;
}

export function SessionLinkPanel({
  sessionId,
  apiKeys,
}: {
  sessionId: string;
  apiKeys: ApiKey[];
}) {
  const [selectedKeyId, setSelectedKeyId] = useState(apiKeys[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [showRealKey, setShowRealKey] = useState(false);
  const [customKey, setCustomKey] = useState('');

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/respond/${sessionId}` : `/respond/${sessionId}`;
  const keyToUse = customKey || selectedKeyId;
  const fullUrl = keyToUse ? `${baseUrl}?key=${keyToUse}` : baseUrl;

  function copyUrl() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Link2 size={15} className="text-blue-500" />
        <h2 className="text-sm font-semibold text-gray-800">回答URL発行</h2>
        <span className="text-xs text-gray-400">— このURLを回答者に配布してください</span>
      </div>

      {apiKeys.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          APIキーがありません。<span className="font-medium">API管理</span>ページからAPIキーを発行してください。
        </div>
      ) : (
        <div className="space-y-3">
          {/* API key selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">使用するAPIキー</label>
            <select
              value={selectedKeyId}
              onChange={(e) => { setSelectedKeyId(e.target.value); setCustomKey(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {apiKeys.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              ※ ここに表示されるのはAPIキーのIDです。実際のキー値はAPIキー発行時にのみ表示されます。
              実際のキー値を持っている場合は下のフィールドに入力してください。
            </p>
          </div>

          {/* Manual key input */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              APIキー値（任意）
              <span className="text-gray-400 font-normal ml-1">— 発行時に控えた実際のキーを入力</span>
            </label>
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="ek_live_xxxxx..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* URL preview + copy */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">生成された回答URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-gray-700 bg-white border border-gray-200 rounded px-3 py-2 overflow-x-auto whitespace-nowrap">
                {fullUrl}
              </code>
              <button
                onClick={copyUrl}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors flex-shrink-0 ${
                  copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'コピー済' : 'コピー'}
              </button>
              {customKey && (
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0"
                >
                  <ExternalLink size={12} />
                  開く
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
