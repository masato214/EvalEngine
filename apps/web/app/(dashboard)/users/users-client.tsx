'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Trash2, X, Check, UserPlus, Shield, Eye, BarChart2, Monitor, Copy, CheckCheck } from 'lucide-react';
import { createUser, updateUser, deleteUser } from '@/actions/user.actions';

const ROLES = [
  {
    value: 'TENANT_ADMIN',
    label: '管理者',
    desc: '全機能の設定・管理が可能',
    Icon: Shield,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    value: 'ANALYST',
    label: 'アナリスト',
    desc: '評価モデルの作成・分析が可能',
    Icon: BarChart2,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    value: 'VIEWER',
    label: '閲覧者',
    desc: '結果の閲覧のみ',
    Icon: Eye,
    color: 'text-gray-600 bg-gray-50',
  },
  {
    value: 'CLIENT',
    label: 'クライアント',
    desc: 'クライアントポータルのみ（管理画面アクセス不可）',
    Icon: Monitor,
    color: 'text-indigo-600 bg-indigo-50',
  },
];

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  TENANT_ADMIN: 'bg-purple-100 text-purple-700',
  ANALYST: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-gray-100 text-gray-500',
  CLIENT: 'bg-indigo-100 text-indigo-700',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'スーパー管理者',
  TENANT_ADMIN: '管理者',
  ANALYST: 'アナリスト',
  VIEWER: '閲覧者',
  CLIENT: 'クライアント',
};

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface FormData {
  email: string;
  name: string;
  role: string;
  password: string;
  isActive: boolean;
}

const emptyForm = (): FormData => ({
  email: '',
  name: '',
  role: 'VIEWER',
  password: '',
  isActive: true,
});

const formFromUser = (u: User): FormData => ({
  email: u.email,
  name: u.name ?? '',
  role: u.role,
  password: '',
  isActive: u.isActive,
});

function InviteInfoModal({
  email,
  password,
  tenantId,
  onClose,
}: {
  email: string;
  password: string;
  tenantId: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : '/portal';

  const inviteText = `【クライアントポータル ログイン情報】\nURL: ${portalUrl}\nログインページ: ${loginUrl}\nテナントID: ${tenantId}\nメール: ${email}\nパスワード: ${password}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Monitor size={15} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">クライアントへ共有</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">以下のログイン情報をクライアントに共有してください。</p>

          <div className="space-y-3">
            {[
              { label: 'ポータルURL', value: portalUrl },
              { label: 'ログインページ', value: loginUrl },
              { label: 'テナントID', value: tenantId },
              { label: 'メールアドレス', value: email },
              { label: 'パスワード', value: password },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                  <p className="text-sm font-medium text-gray-900 font-mono">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
            初回ログイン後にパスワードを変更するよう案内してください。
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
              {copied ? 'コピーしました！' : '招待情報をコピー'}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserModal({
  user,
  tenantId,
  onClose,
  onSaved,
}: {
  user?: User;
  tenantId: string;
  onClose: () => void;
  onSaved: (u: User, inviteInfo?: { email: string; password: string }) => void;
}) {
  const isEdit = !!user;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormData>(isEdit ? formFromUser(user!) : emptyForm());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) { setError('メールアドレスは必須です'); return; }
    if (!isEdit && form.password.length < 8) { setError('パスワードは8文字以上必要です'); return; }
    if (isEdit && form.password && form.password.length < 8) {
      setError('パスワードは8文字以上必要です'); return;
    }

    startTransition(async () => {
      try {
        let result: User;
        if (isEdit) {
          const data: any = { name: form.name || undefined, role: form.role, isActive: form.isActive };
          if (form.password) data.password = form.password;
          result = await updateUser(user!.id, data);
          onSaved(result);
        } else {
          result = await createUser({
            email: form.email,
            password: form.password,
            name: form.name || undefined,
            role: form.role,
          });
          // CLIENTロールの場合は招待情報を渡す
          if (form.role === 'CLIENT') {
            onSaved(result, { email: form.email, password: form.password });
          } else {
            onSaved(result);
          }
        }
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
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'ユーザーを編集' : '新しいユーザーを追加'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              メールアドレス{!isEdit && <span className="text-red-500"> *</span>}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              disabled={isEdit}
              required={!isEdit}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">名前（任意）</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              パスワード
              {!isEdit
                ? <span className="text-red-500"> *</span>
                : <span className="text-xs text-gray-400 font-normal"> （変更する場合のみ）</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required={!isEdit}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isEdit ? '変更しない場合は空欄' : '8文字以上'}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">権限</label>
            <div className="space-y-2">
              {ROLES.map(({ value, label, desc, Icon, color }) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    form.role === value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={form.role === value}
                    onChange={() => setForm((p) => ({ ...p, role: value }))}
                    className="sr-only"
                  />
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  {form.role === value && (
                    <Check size={15} className="text-blue-500 flex-shrink-0" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.isActive ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700">
                {form.isActive ? 'アクティブ（ログイン可）' : '無効（ログイン不可）'}
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '保存中...' : isEdit ? '変更を保存' : 'ユーザーを作成'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UsersClient({ initialUsers, tenantId }: { initialUsers: any[]; tenantId: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [deleteError, setDeleteError] = useState('');
  const [inviteInfo, setInviteInfo] = useState<{ email: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSaved(u: User, invite?: { email: string; password: string }) {
    setUsers((prev) => {
      const exists = prev.find((x) => x.id === u.id);
      return exists ? prev.map((x) => (x.id === u.id ? u : x)) : [u, ...prev];
    });
    if (invite) setInviteInfo(invite);
  }

  function openCreate() { setEditingUser(undefined); setShowModal(true); }
  function openEdit(u: User) { setEditingUser(u); setShowModal(true); }

  function handleDelete(u: User) {
    if (!confirm(`「${u.name ?? u.email}」を削除しますか？この操作は取り消せません。`)) return;
    setDeleteError('');
    startTransition(async () => {
      try {
        await deleteUser(u.id);
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
      } catch (e: any) {
        setDeleteError(e.message);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length}名</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <UserPlus size={15} />
          ユーザーを追加
        </button>
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {deleteError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">ユーザーがまだいません</p>
            <p className="text-gray-400 text-xs mt-1">「ユーザーを追加」から登録してください</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">名前 / メール</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">権限</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ステータス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">登録日</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">
                      {u.name ?? <span className="text-gray-400 font-normal">名前未設定</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role] ?? 'bg-gray-100'}`}>
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-gray-400 hover:text-blue-500 p-1.5 rounded"
                        title="編集"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={isPending}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded disabled:opacity-50"
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
        )}
      </div>

      {showModal && (
        <UserModal
          user={editingUser}
          tenantId={tenantId}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      {inviteInfo && (
        <InviteInfoModal
          email={inviteInfo.email}
          password={inviteInfo.password}
          tenantId={tenantId}
          onClose={() => setInviteInfo(null)}
        />
      )}
    </div>
  );
}
