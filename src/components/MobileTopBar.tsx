import { LogOut, Shield, Crown, User } from 'lucide-react';
import type { UserRole } from '@/lib/supabase';

interface MobileTopBarProps {
  title: string;
  email: string;
  role?: UserRole;
  userName?: string;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export default function MobileTopBar({
  title,
  email,
  role = 'citizen',
  userName = '',
  onOpenProfile,
  onSignOut,
}: MobileTopBarProps) {
  const isAuthority = role === 'official' || role === 'admin';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="flex h-14 items-center gap-2.5 px-4">
        {/* App Logo */}
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 shadow-sm ring-1 ring-emerald-600/20">
          <img src="/image.png" alt="Palle Nestham" className="h-full w-full object-contain p-0.5" />
        </div>

        {/* Title & Screen */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-black leading-tight text-slate-900">Palle Nestham</span>
            {isAuthority && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-900 border border-amber-300">
                <Crown className="h-2 w-2" />
                {role}
              </span>
            )}
          </div>
          <div className="truncate text-[10px] font-semibold text-slate-400">{title}</div>
        </div>

        {/* Profile Avatar Button */}
        <button
          onClick={onOpenProfile}
          title="Open Profile"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200 transition hover:bg-emerald-100 active:scale-95 shadow-2xs"
        >
          {userName ? userName.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
        </button>

        {/* Sign Out Button */}
        <button
          onClick={onSignOut}
          title={`Sign out (${email || 'Account'})`}
          aria-label="Sign out"
          className="rounded-xl p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
