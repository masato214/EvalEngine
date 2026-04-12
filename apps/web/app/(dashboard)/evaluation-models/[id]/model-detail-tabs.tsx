'use client';

import { useState, useTransition } from 'react';
import { Pencil, Check, X, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AxisTree } from './axis-tree';
import { AxisForm } from './axis-form';
import { OutputFormatsSection } from './output-formats-section';
import { updateModel, snapshotModel } from '@/actions/model-builder.actions';

interface Props {
  modelId: string;
  axes: any[];
  outputFormats: any[];
  model: any;
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: '下書き', color: 'text-gray-500 bg-gray-100' },
  { value: 'REVIEW', label: 'レビュー中', color: 'text-yellow-700 bg-yellow-100' },
  { value: 'PUBLISHED', label: '公開中', color: 'text-green-700 bg-green-100' },
  { value: 'ARCHIVED', label: 'アーカイブ', color: 'text-red-700 bg-red-100' },
];

const TABS = [
  { key: 'axes', label: '評価軸' },
  { key: 'output-formats', label: '出力形式' },
  { key: 'settings', label: '設定' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function SnapshotConfirmModal({
  fromVersion,
  toVersion,
  onConfirm,
  onCancel,
  isPending,
}: {
  fromVersion: number;
  toVersion: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Copy size={18} className="text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              新しいバージョンを作成
            </h2>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            <span className="font-mono font-medium">v{fromVersion}</span> のスナップショットとして{' '}
            <span className="font-mono font-medium">v{toVersion}</span> を作成します。
          </p>
          <ul className="text-xs text-gray-500 space-y-1 mb-5 pl-4 list-disc">
            <li>評価軸・質問・出力形式がすべてコピーされます</li>
            <li>新バージョンはステータス「下書き」で作成されます</li>
            <li>現在の <span className="font-mono">v{fromVersion}</span> はそのまま残ります</li>
          </ul>
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '作成中...' : `v${toVersion} を作成`}
            </button>
            <button
              onClick={onCancel}
              disabled={isPending}
              className="px-5 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ model, modelId }: { model: any; modelId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSnapshotPending, startSnapshotTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [snapshotError, setSnapshotError] = useState('');
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  const [name, setName] = useState(model.name ?? '');
  const [description, setDescription] = useState(model.description ?? '');
  const [status, setStatus] = useState(model.status ?? 'DRAFT');

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === (editing ? status : model.status));

  async function handleSave() {
    if (!name.trim()) { setError('モデル名は必須です'); return; }
    setError('');
    startTransition(async () => {
      try {
        await updateModel(modelId, { name, description: description || undefined, status });
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleCancel() {
    setName(model.name ?? '');
    setDescription(model.description ?? '');
    setStatus(model.status ?? 'DRAFT');
    setError('');
    setEditing(false);
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800">モデル設定</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Pencil size={13} />
              編集
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check size={13} />
                {isPending ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-sm text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={13} />
                キャンセル
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        <dl className="space-y-5">
          {/* 名前 */}
          <div>
            <dt className="text-xs font-medium text-gray-500 mb-1.5">モデル名</dt>
            <dd>
              {editing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-sm text-gray-900">{model.name}</p>
              )}
            </dd>
          </div>

          {/* 説明 */}
          <div>
            <dt className="text-xs font-medium text-gray-500 mb-1.5">説明</dt>
            <dd>
              {editing ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="このモデルの目的・対象を簡潔に"
                />
              ) : (
                <p className="text-sm text-gray-900">{model.description || <span className="text-gray-400">未設定</span>}</p>
              )}
            </dd>
          </div>

          {/* ステータス */}
          <div>
            <dt className="text-xs font-medium text-gray-500 mb-1.5">ステータス</dt>
            <dd>
              {editing ? (
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`border rounded-lg px-3 py-2 cursor-pointer transition-colors text-sm flex items-center gap-2 ${
                        status === opt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        checked={status === opt.value}
                        onChange={() => setStatus(opt.value)}
                        className="sr-only"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${opt.color}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentStatus?.color ?? 'bg-gray-100 text-gray-500'}`}>
                  {currentStatus?.label ?? model.status}
                </span>
              )}
            </dd>
          </div>

          {/* バージョン */}
          <div>
            <dt className="text-xs font-medium text-gray-500 mb-1.5">バージョン</dt>
            <dd className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-900 font-mono">v{model.version}</span>
              {!editing && (
                <button
                  type="button"
                  disabled={isSnapshotPending}
                  onClick={() => setShowSnapshotModal(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <Copy size={11} />
                  {isSnapshotPending ? '作成中...' : `v${model.version + 1} を作成`}
                </button>
              )}
            </dd>
            {snapshotError && (
              <p className="text-xs text-red-600 mt-1">{snapshotError}</p>
            )}
          </div>

          {/* 日時情報 */}
          {model.createdAt && (
            <div>
              <dt className="text-xs font-medium text-gray-500 mb-1">作成日時</dt>
              <dd className="text-sm text-gray-500">
                {new Date(model.createdAt).toLocaleString('ja-JP')}
              </dd>
            </div>
          )}
          {model.updatedAt && (
            <div>
              <dt className="text-xs font-medium text-gray-500 mb-1">最終更新</dt>
              <dd className="text-sm text-gray-500">
                {new Date(model.updatedAt).toLocaleString('ja-JP')}
              </dd>
            </div>
          )}
        </dl>
      </div>
      {showSnapshotModal && (
        <SnapshotConfirmModal
          fromVersion={model.version}
          toVersion={model.version + 1}
          isPending={isSnapshotPending}
          onCancel={() => setShowSnapshotModal(false)}
          onConfirm={() => {
            setSnapshotError('');
            startSnapshotTransition(async () => {
              try {
                const newModel = await snapshotModel(modelId);
                setShowSnapshotModal(false);
                router.push(`/evaluation-models/${newModel.id}`);
              } catch (e: any) {
                setSnapshotError(e.message);
                setShowSnapshotModal(false);
              }
            });
          }}
        />
      )}
    </div>
  );
}

export function ModelDetailTabs({ modelId, axes, outputFormats, model }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('axes');

  const flatten = (list: any[]): any[] =>
    list?.flatMap((a: any) => [{ id: a.id, name: a.name }, ...flatten(a.children ?? [])]) ?? [];
  const allAxes = flatten(axes ?? []);

  return (
    <div>
      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 評価軸タブ */}
      {activeTab === 'axes' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">評価軸構造</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              リーフノードの軸に質問・評価基準を追加できます。行にホバーすると編集・削除ボタンが表示されます。
            </p>
          </div>

          {axes && axes.length > 0 ? (
            <AxisTree axes={axes} modelId={modelId} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
              <p className="text-gray-400 text-sm">評価軸がまだ設定されていません</p>
              <p className="text-gray-400 text-xs mt-1">以下から最初の評価軸を追加してください</p>
            </div>
          )}

          <div className="mt-3">
            <AxisForm modelId={modelId} existingAxes={allAxes} />
          </div>
        </div>
      )}

      {/* 出力形式タブ */}
      {activeTab === 'output-formats' && (
        <OutputFormatsSection modelId={modelId} initialFormats={outputFormats} axes={allAxes} />
      )}

      {/* 設定タブ */}
      {activeTab === 'settings' && (
        <SettingsTab model={model} modelId={modelId} />
      )}
    </div>
  );
}
