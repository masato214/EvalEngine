'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Brain,
  BarChart3,
  Settings,
  KeyRound,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { label: 'ホーム', href: '/portal', icon: LayoutDashboard, exact: true },
  { label: '評価モデル', href: '/portal/models', icon: Brain },
  { label: '結果・分析', href: '/portal/results', icon: BarChart3 },
  { label: 'API管理', href: '/api-keys', icon: KeyRound },
  { label: '設定', href: '/portal/settings', icon: Settings },
];

interface Props {
  tenantName?: string;
  role?: string;
}

export function PortalSidebar({ tenantName, role }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTenantId = searchParams.get('tenantId');
  const withTenant = (href: string) => (selectedTenantId ? `${href}?tenantId=${encodeURIComponent(selectedTenantId)}` : href);

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-0.5">クライアントポータル</p>
        <span className="font-bold text-gray-900 text-base truncate block">
          {tenantName ?? 'EvalEngine'}
        </span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ label, href, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={withTenant(href)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
      {role === 'SUPER_ADMIN' && (
        <div className="p-3 border-t border-gray-100">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={12} />
            管理ダッシュボードへ
          </Link>
        </div>
      )}
    </aside>
  );
}
