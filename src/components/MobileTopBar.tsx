import { useEffect, useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  FileText,
  Home,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ComplaintStatus, UserRole } from '@/lib/supabase';
import type { Tab } from './BottomTabBar';

interface MobileTopBarProps {
  title: string;
  email: string;
  role?: UserRole;
  userName?: string;
  active: Tab;
  activeStatusFilter?: ComplaintStatus;
  onOpenProfile: () => void;
  onNavigate: (tab: Tab, statusFilter?: ComplaintStatus) => void;
  onSignOut: () => void;
}

interface MenuItem {
  tab: Tab;
  label: string;
  description: string;
  Icon: LucideIcon;
  statusFilter?: ComplaintStatus;
}

export default function MobileTopBar({
  title,
  email,
  role = 'citizen',
  userName = '',
  active,
  activeStatusFilter,
  onOpenProfile,
  onNavigate,
  onSignOut,
}: MobileTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthority = role === 'sarpanch' || role === 'admin';
  const isCitizen = role === 'citizen';

  const menuItems: MenuItem[] = [
    { tab: 'dashboard', label: 'Home', description: 'Village overview and recent updates', Icon: Home },
    {
      tab: 'complaints',
      label: isCitizen ? 'My reports' : 'All complaints',
      description: isCitizen ? 'Track your submitted complaints' : 'Review village complaints',
      Icon: FileText,
    },
    {
      tab: 'complaints',
      statusFilter: 'resolved',
      label: 'Resolved cases',
      description: isCitizen ? 'Your resolved complaints' : 'Browse resolved village cases',
      Icon: CheckCircle2,
    },
    ...(isCitizen
      ? [{ tab: 'report' as const, label: 'Report an issue', description: 'Send a complaint to the Panchayat', Icon: PlusCircle }]
      : []),
    {
      tab: 'community',
      label: isCitizen ? 'Village & polls' : 'Notices, polls & events',
      description: 'Public information and community updates',
      Icon: Bell,
    },
    ...(role === 'sarpanch'
      ? [{ tab: 'officials' as const, label: 'Panchayat team', description: 'View village officials', Icon: Building2 }]
      : []),
    { tab: 'settings', label: 'Settings', description: 'Appearance, language and notifications', Icon: Settings },
    {
      tab: 'profile',
      label: role === 'admin' ? 'Accounts & administration' : 'Profile & password',
      description: role === 'admin' ? 'Manage users and review activity' : 'Update your details and password',
      Icon: role === 'admin' ? Users : UserRound,
    },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const navigate = (item: MenuItem) => {
    onNavigate(item.tab, item.statusFilter);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-[60] border-b border-slate-200/80 bg-white/95 shadow-2xs backdrop-blur-md">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 shadow-xs ring-2 ring-white">
          <img src="/palle-nestham-logo.png" alt="Palle Nestham" className="h-full w-full object-contain" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-black leading-tight text-slate-900 font-serif">Palle Nestham</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800">Tandlam</span>
            {isAuthority ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-900">
                <Building2 className="h-2 w-2" />
                {role}
              </span>
            ) : (
              <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-sky-800">Citizen</span>
            )}
          </div>
          <div className="truncate text-[10px] font-semibold text-slate-500">{title}</div>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          title="Open profile"
          aria-label="Open profile"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-black text-emerald-800 shadow-2xs transition hover:bg-emerald-100 active:scale-95"
        >
          {userName ? userName.charAt(0).toUpperCase() : <UserRound className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="palle-navigation-menu"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${menuOpen ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800'}`}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[70] cursor-default bg-slate-950/35 backdrop-blur-[2px] animate-fade-in"
          />
          <section
            id="palle-navigation-menu"
            role="dialog"
            aria-modal="true"
            aria-label={`${role} navigation menu`}
            className="fixed right-3 top-16 z-[71] flex max-h-[calc(100dvh-5rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-slide-up"
          >
            <div className="bg-gradient-to-r from-emerald-900 to-teal-800 px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-200">{role} menu</p>
                  <h2 className="mt-1 text-lg font-black">Village services</h2>
                  <p className="mt-0.5 truncate text-xs text-emerald-100">{userName || email}</p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-xl p-2 text-emerald-100 transition hover:bg-white/15 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <nav aria-label={`${role} menu options`} className="overflow-y-auto p-3">
              <div className="space-y-1">
                {menuItems.map(({ tab, statusFilter, label, description, Icon }) => {
                  const isActive = active === tab && (tab !== 'complaints' || (statusFilter || 'all') === (activeStatusFilter || 'all'));
                  return (
                    <button
                      key={`${tab}-${statusFilter ?? label}`}
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => navigate({ tab, statusFilter, label, description, Icon })}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${isActive ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">{label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-slate-100 p-3">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-rose-700 transition hover:bg-rose-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                  <LogOut className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold">Sign out</span>
                  <span className="block text-[11px] text-rose-600">Leave your Palle Nestham account</span>
                </span>
              </button>
            </div>
          </section>
        </>
      ) : null}
    </header>
  );
}
