import { Home, FilePlus, ListFilter, Users, UserRound } from 'lucide-react';

export type Tab = 'dashboard' | 'report' | 'complaints' | 'officials' | 'profile';

interface BottomTabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[420px] -translate-x-1/2 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      {/* Floating center Report button */}
      <div
        className="absolute bottom-[calc(100%-8px)] left-1/2 -translate-x-1/2 pointer-events-auto"
      >
        <button
          onClick={() => onChange('report')}
          title="Report Grievance"
          className={`flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-transform active:scale-90 ${
            active === 'report'
              ? 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-orange-500/40 ring-4 ring-white'
              : 'bg-gradient-to-tr from-emerald-600 to-teal-700 shadow-emerald-700/30 ring-4 ring-white'
          }`}
          style={{ width: '52px', height: '52px' }}
        >
          <FilePlus className="h-6 w-6 text-white" />
        </button>
      </div>

      <div className="grid grid-cols-5 items-center px-1">
        {/* Tab 1: Home */}
        <button
          onClick={() => onChange('dashboard')}
          className="flex flex-col items-center gap-0.5 py-2 transition-colors"
        >
          <Home
            className={`h-5 w-5 ${active === 'dashboard' ? 'text-emerald-700' : 'text-slate-400'}`}
            strokeWidth={active === 'dashboard' ? 2.5 : 2}
          />
          <span
            className={`text-[10px] font-bold ${
              active === 'dashboard' ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            Home
          </span>
        </button>

        {/* Tab 2: Complaints */}
        <button
          onClick={() => onChange('complaints')}
          className="flex flex-col items-center gap-0.5 py-2 transition-colors"
        >
          <ListFilter
            className={`h-5 w-5 ${active === 'complaints' ? 'text-emerald-700' : 'text-slate-400'}`}
            strokeWidth={active === 'complaints' ? 2.5 : 2}
          />
          <span
            className={`text-[10px] font-bold ${
              active === 'complaints' ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            Issues
          </span>
        </button>

        {/* Tab 3: Report (Center Spacer) */}
        <div className="flex flex-col items-center pt-5">
          <span
            className={`text-[9px] font-black uppercase tracking-wider ${
              active === 'report' ? 'text-orange-600' : 'text-slate-500'
            }`}
          >
            Report
          </span>
        </div>

        {/* Tab 4: Officials */}
        <button
          onClick={() => onChange('officials')}
          className="flex flex-col items-center gap-0.5 py-2 transition-colors"
        >
          <Users
            className={`h-5 w-5 ${active === 'officials' ? 'text-emerald-700' : 'text-slate-400'}`}
            strokeWidth={active === 'officials' ? 2.5 : 2}
          />
          <span
            className={`text-[10px] font-bold ${
              active === 'officials' ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            Officers
          </span>
        </button>

        {/* Tab 5: Profile */}
        <button
          onClick={() => onChange('profile')}
          className="flex flex-col items-center gap-0.5 py-2 transition-colors"
        >
          <UserRound
            className={`h-5 w-5 ${active === 'profile' ? 'text-emerald-700' : 'text-slate-400'}`}
            strokeWidth={active === 'profile' ? 2.5 : 2}
          />
          <span
            className={`text-[10px] font-bold ${
              active === 'profile' ? 'text-emerald-700' : 'text-slate-400'
            }`}
          >
            Profile
          </span>
        </button>
      </div>
      <div className="h-[env(safe-area-inset-bottom,0px)]" />
    </nav>
  );
}
