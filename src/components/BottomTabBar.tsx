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
    <nav aria-label={`${role} navigation`} className="fixed bottom-0 left-1/2 z-50 w-full max-w-[1100px] -translate-x-1/2 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="mx-auto grid max-w-4xl items-center px-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ key, label, Icon }) => {
          const isActive = active === key;
          const isReport = key === 'report';
          return (
            <button key={key} onClick={() => onChange(key)} aria-current={isActive ? 'page' : undefined} title={label} className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition active:scale-95 ${isReport ? '-mt-4' : ''}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${isReport ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/30' : isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'}`}>
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              </span>
              <span className={`text-[10px] font-bold leading-tight ${isActive ? 'text-emerald-800' : 'text-slate-400'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
