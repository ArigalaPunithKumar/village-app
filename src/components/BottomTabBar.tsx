import { Bell, Building2, FilePlus, Home, ListFilter, Settings, UserRound } from 'lucide-react';
import type { UserRole } from '@/lib/supabase';

export type Tab = 'dashboard' | 'report' | 'complaints' | 'community' | 'officials' | 'profile' | 'settings';

interface BottomTabBarProps {
  active: Tab;
  role: UserRole;
  onChange: (tab: Tab) => void;
}

export default function BottomTabBar({ active, role, onChange }: BottomTabBarProps) {
  const citizen = role === 'citizen';
  const tabs = [
    { key: 'dashboard' as const, label: 'Home', Icon: Home },
    { key: 'complaints' as const, label: citizen ? 'My Reports' : 'Complaints', Icon: ListFilter },
    ...(citizen ? [{ key: 'report' as const, label: 'Report', Icon: FilePlus }] : []),
    { key: 'community' as const, label: citizen ? 'Village' : 'Public notices', Icon: Bell },
    ...(role === 'sarpanch' ? [{ key: 'officials' as const, label: 'Team', Icon: Building2 }] : []),
    ...(role === 'admin' ? [{ key: 'settings' as const, label: 'Settings', Icon: Settings }] : []),
    { key: 'profile' as const, label: role === 'admin' ? 'Accounts' : 'Profile', Icon: UserRound },
  ];

  return (
    <nav aria-label={`${role} navigation`} className="app-menu-bar fixed bottom-0 left-1/2 z-50 w-full max-w-[1100px] -translate-x-1/2 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:sticky lg:top-14 lg:left-auto lg:translate-x-0 lg:border-b lg:border-t-0 lg:pb-0 lg:shadow-[0_5px_18px_rgba(0,0,0,0.04)]">
      <div className="app-menu-list mx-auto grid max-w-5xl items-center px-1 sm:px-3" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const isReport = key === 'report';
          return (
            <button key={key} onClick={() => onChange(key)} aria-current={isActive ? 'page' : undefined} title={label} className={`app-menu-item flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition active:scale-95 lg:min-h-[3.75rem] lg:flex-row lg:gap-2 lg:px-3 ${isActive ? 'is-active' : ''} ${isReport ? '-mt-4 lg:mt-0' : ''}`}>
              <span className={`app-menu-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition lg:h-8 lg:w-8 ${isReport ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/30' : isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'}`}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={`app-menu-label text-[10px] font-bold leading-tight lg:text-xs ${isActive ? 'text-emerald-800' : 'text-slate-400'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
