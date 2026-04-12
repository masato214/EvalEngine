'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  FolderOpen,
  Brain,
  MessageSquare,
  BarChart3,
  Users,
  KeyRound,
  Monitor,
} from 'lucide-react';

const navItems = [
  { label: 'ダッシュボード', href: '/dashboard', icon: LayoutDashboard },
  { label: 'テナント管理', href: '/tenants', icon: Building2 },
  { label: 'プロジェクト', href: '/projects', icon: FolderOpen },
  { label: '評価モデル', href: '/evaluation-models', icon: Brain },
  { label: '回答一覧', href: '/answers', icon: MessageSquare },
  { label: '分析結果', href: '/results', icon: BarChart3 },
  { label: 'ユーザー', href: '/users', icon: Users },
  { label: 'API管理', href: '/api-keys', icon: KeyRound },
  { label: 'クライアントポータル', href: '/portal', icon: Monitor },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <span className="font-bold text-gray-900 text-lg">EvalEngine</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
