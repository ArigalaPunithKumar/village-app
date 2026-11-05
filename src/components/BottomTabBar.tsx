import { Home, FilePlus, ListFilter, Users, UserRound } from 'lucide-react';

export type Tab = 'dashboard' | 'report' | 'complaints' | 'officials' | 'profile';

interface BottomTabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[420px] -translate-x-1/2 border-t border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {/* Floating Center Report Button with Pulsating Glow */}
      <div className="absolute bottom-[calc(100%-12px)] left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          onClick={() => onChange('report')}
          title="సమస్యను నివేదించండి • Report Issue"
          className={`flex flex-col items-center justify-center rounded-full shadow-xl transition-all duration-300 active:scale-90 animate-pulse-glow ${
            active === 'report'
              ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 shadow-orange-500/40 ring-4 ring-white scale-105'
              : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-700/35 ring-4 ring-white hover:scale-105'
          }`}
          style={{ width: '56px', height: '56px' }}
        >
          <FilePlus className="h-6 w-6 text-white" />
        </button>
      </div>

      <div className="grid grid-cols-5 items-center px-1">
        {/* Tab 1: Home */}
        <button
          onClick={() => onChange('dashboard')}
          className="flex flex-col items-center gap-0.5 py-2.5 transition-all duration-200 active:scale-95"
        >
          <Home
            className={`h-5 w-5 transition-transform ${
              active === 'dashboard' ? 'text-emerald-700 scale-110' : 'text-slate-400'
            }`}
            strokeWidth={active === 'dashboard' ? 2.5 : 2}
          />
          <span
            className={`text-[9px] font-black leading-tight ${
              active === 'dashboard' ? 'text-emerald-800' : 'text-slate-400'
            }`}
          >
            హోమ్
          </span>
        </button>

        {/* Tab 2: Complaints */}
        <button
          onClick={() => onChange('complaints')}
          className="flex flex-col items-center gap-0.5 py-2.5 transition-all duration-200 active:scale-95"
        >
          <ListFilter
            className={`h-5 w-5 transition-transform ${
              active === 'complaints' ? 'text-emerald-700 scale-110' : 'text-slate-400'
            }`}
            strokeWidth={active === 'complaints' ? 2.5 : 2}
          />
          <span
            className={`text-[9px] font-black leading-tight ${
              active === 'complaints' ? 'text-emerald-800' : 'text-slate-400'
            }`}
          >
            సమస్యలు
          </span>
        </button>

        {/* Tab 3: Report (Center Spacer) */}
        <div className="flex flex-col items-center pt-5">
          <span
            className={`text-[9px] font-black uppercase tracking-wider ${
              active === 'report' ? 'text-orange-600' : 'text-slate-500'
            }`}
          >
            ఫిర్యాదు
          </span>
        </div>

        {/* Tab 4: Officials */}
        <button
          onClick={() => onChange('officials')}
          className="flex flex-col items-center gap-0.5 py-2.5 transition-all duration-200 active:scale-95"
        >
          <Users
            className={`h-5 w-5 transition-transform ${
              active === 'officials' ? 'text-emerald-700 scale-110' : 'text-slate-400'
            }`}
            strokeWidth={active === 'officials' ? 2.5 : 2}
          />
          <span
            className={`text-[9px] font-black leading-tight ${
              active === 'officials' ? 'text-emerald-800' : 'text-slate-400'
            }`}
          >
            అధికారులు
          </span>
        </button>

        {/* Tab 5: Profile */}
        <button
          onClick={() => onChange('profile')}
          className="flex flex-col items-center gap-0.5 py-2.5 transition-all duration-200 active:scale-95"
        >
          <UserRound
            className={`h-5 w-5 transition-transform ${
              active === 'profile' ? 'text-emerald-700 scale-110' : 'text-slate-400'
            }`}
            strokeWidth={active === 'profile' ? 2.5 : 2}
          />
          <span
            className={`text-[9px] font-black leading-tight ${
              active === 'profile' ? 'text-emerald-800' : 'text-slate-400'
            }`}
          >
            ప్రొఫైల్
          </span>
        </button>
      </div>
    </nav>
  );
}
