'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, X, Check } from 'lucide-react';
import { updateTenant, deleteTenant } from '@/actions/tenant.actions';

const PLANS = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const;
const planLabels: Record<string, string> = {
  FREE: '無料',
  STARTER: 'スターター',
  PROFESSIONAL: 'プロフェッショナル',
  ENTERPRISE: 'エンタープライズ',
};
const planColors: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-500',
  STARTER: 'bg-blue-100 text-blue-700',
  PROFESSIONAL: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-orange-100 text-orange-700',
};

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
}

function TenantEditModal({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSaved: (t: Tenant) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [name, setName] = useState(tenant.name);
  const [plan, setPlan] = useState(tenant.plan);
  const [isActive, setIsActive] = useState(tenant.isActive);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('テナント名は必須です'); return; }
    startTransition(async () => {
      try {
        await updateTenant(tenant.id, { name, plan, isActive });
        onSaved({ ...tenant, name, plan, isActive });
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
          <h2 className="text-base font-semibold text-gray-900">テナントを編集</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">テナント名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">プラン</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>{planLabels[p]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-700">{isActive ? '有効' : '停止中'}</span>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '保存中...' : '変更を保存'}
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

export function TenantsClient({ initialTenants }: { initialTenants: Tenant[] }) {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSaved(t: Tenant) {
    setTenants((prev) => prev.map((x) => x.id === t.id ? t : x));
  }

  function handleDelete(t: Tenant) {
    if (!confirm(`「${t.name}」を削除しますか？この操作は取り消せません。`)) return;
    setDeleteError('');
    startTransition(async () => {
      try {
        await deleteTenant(t.id);
        setTenants((prev) => prev.filter((x) => x.id !== t.id));
      } catch (e: any) {
        setDeleteError(e.message);
      }
    });
  }

  return (
    <div>
      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{deleteError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tenants.map((t) => (
          <div key={t.id} className="group relative bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 transition-colors">
            <Link href={`/tenants/${t.id}`} className="block">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">@{t.slug}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[t.plan] ?? 'bg-gray-100'}`}>
                  {planLabels[t.plan] ?? t.plan}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className={`flex items-center gap-1 ${t.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  {t.isActive ? '有効' : '停止中'}
                </span>
                <span>{new Date(t.createdAt).toLocaleDateString('ja-JP')}</span>
              </div>
            </Link>
            {/* hover actions */}
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.preventDefault(); setEditingTenant(t); }}
                className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 shadow-sm"
                title="編集"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(t); }}
                disabled={isPending}
                className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 shadow-sm disabled:opacity-50"
                title="削除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {tenants.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <p className="text-lg mb-2">テナントがまだありません</p>
            <p className="text-sm">「新規テナント作成」からクライアント企業を追加してください</p>
          </div>
        )}
      </div>

      {editingTenant && (
        <TenantEditModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
