'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, X, FolderOpen } from 'lucide-react';
import { updateProject, deleteProject } from '@/actions/project.actions';

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

function ProjectEditModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('プロジェクト名は必須です'); return; }
    startTransition(async () => {
      try {
        await updateProject(project.id, { name, description: description || undefined });
        onSaved({ ...project, name, description: description || undefined });
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
          <h2 className="text-base font-semibold text-gray-900">プロジェクトを編集</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">プロジェクト名 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">説明（任意）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="プロジェクトの概要を入力"
            />
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

export function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSaved(p: Project) {
    setProjects((prev) => prev.map((x) => x.id === p.id ? p : x));
  }

  function handleDelete(p: Project) {
    if (!confirm(`「${p.name}」を削除しますか？この操作は取り消せません。`)) return;
    setDeleteError('');
    startTransition(async () => {
      try {
        await deleteProject(p.id);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div key={p.id} className="group relative bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 transition-colors">
            <Link href={`/projects/${p.id}`} className="block">
              <div className="flex items-start gap-3 mb-2">
                <FolderOpen size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">{new Date(p.createdAt).toLocaleDateString('ja-JP')}</p>
            </Link>
            {/* hover actions */}
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.preventDefault(); setEditingProject(p); }}
                className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-blue-500 hover:border-blue-300 shadow-sm"
                title="編集"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(p); }}
                disabled={isPending}
                className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 shadow-sm disabled:opacity-50"
                title="削除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-gray-400 text-sm col-span-3">プロジェクトがまだありません。</p>
        )}
      </div>

      {editingProject && (
        <ProjectEditModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
