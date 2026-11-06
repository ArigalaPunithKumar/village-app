import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  FilePlus2,
  LayoutDashboard,
  ListChecks,
  LogOut,
  ShieldCheck,
  UsersRound,
  UserRound,
} from 'lucide-react';
import BottomTabBar, { type Tab } from '@/components/BottomTabBar';
import MobileTopBar from '@/components/MobileTopBar';
import Dashboard from '@/components/Dashboard';
import ReportForm, { ReportSuccess } from '@/components/ReportForm';
import ComplaintList from '@/components/ComplaintList';
import ComplaintDetail from '@/components/ComplaintDetail';
import Officials from '@/components/Officials';
import ProfileScreen from '@/components/ProfileScreen';
import AdminConsole from '@/components/AdminConsole';
import AuthScreen from '@/components/AuthScreen';
import SplashScreen from '@/components/SplashScreen';
import { supabase, fetchCurrentProfile, isSupabaseConfigured, type UserProfile, type UserRole } from '@/lib/supabase';

type Screen =
  | { view: 'dashboard' }
  | { view: 'report' }
  | { view: 'complaints' }
  | { view: 'officials' }
  | { view: 'profile' }
  | { view: 'admin' }
  | { view: 'success'; ticketNumber: string }
  | { view: 'detail'; complaintId: number };

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Community overview',
  report: 'Report a village issue',
  complaints: 'Community reports',
  officials: 'Village directory',
  profile: 'My account',
};

const NAV_ITEMS: { tab: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { tab: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { tab: 'report', label: 'Report an issue', icon: FilePlus2 },
  { tab: 'complaints', label: 'Community reports', icon: ListChecks },
  { tab: 'officials', label: 'Village directory', icon: UsersRound },
  { tab: 'profile', label: 'My account', icon: UserRound },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('citizen');
  const [screen, setScreen] = useState<Screen>({ view: 'dashboard' });

  const loadUserData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) console.error('Could not restore the sign-in session', error.message);
    const nextSession = data.session;
    setSession(nextSession);

    if (nextSession) {
      const profile = await fetchCurrentProfile();
      setUserProfile(profile);
      setRole(profile?.role ?? 'citizen');
    } else {
      setUserProfile(null);
      setRole('citizen');
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    void loadUserData();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setUserProfile(null);
        setRole('citizen');
        setAuthLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        // Supabase auth callbacks run under an internal lock. Defer profile queries
        // until after the callback returns to avoid waiting on the same lock.
        window.setTimeout(() => {
          if (!active) return;
          void fetchCurrentProfile().then((profile) => {
            if (!active) return;
            setUserProfile(profile);
            setRole(profile?.role ?? 'citizen');
            setAuthLoading(false);
          });
        }, 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setRole('citizen');
    setScreen({ view: 'dashboard' });
  };

  const isStaff = role === 'official' || role === 'admin';
  const activeTab: Tab =
    screen.view === 'detail' || screen.view === 'success'
      ? 'complaints'
      : screen.view === 'admin'
        ? 'profile'
        : screen.view;
  const handleTabChange = (tab: Tab) => setScreen({ view: tab });
  const handleSelectComplaint = (id: number) => setScreen({ view: 'detail', complaintId: id });

  const topTitle = screen.view === 'detail'
    ? 'Report details'
    : screen.view === 'success'
      ? 'Report submitted'
      : screen.view === 'admin'
        ? 'Administrator workspace'
        : TAB_TITLES[activeTab];

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f2f5f3] px-5 py-10">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/[.05] sm:p-9">
          <img src="/palle-nestham-logo.png" alt="Palle Nestham" className="h-14 w-14 rounded-2xl bg-white p-1.5 object-contain ring-1 ring-slate-200" />
          <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Project setup required</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Connect this app to Supabase</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the local <code>.env</code> file or the GitHub Actions repository secrets, then rebuild the app.</p>
        </section>
      </main>
    );
  }
  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f4]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          <span className="text-sm font-medium text-slate-600">Restoring your session…</span>
        </div>
      </div>
    );
  }
  if (!session) return <AuthScreen onAuthenticated={() => void loadUserData()} />;

  return (
    <div className="min-h-screen bg-[#f2f5f3] font-sans text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] bg-white shadow-[0_0_80px_rgba(17,35,25,.08)]">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-200 bg-[#fbfcfb] px-4 py-6 md:flex xl:w-[280px] xl:px-5">
          <div className="flex items-center gap-3 px-2">
            <img src="/palle-nestham-logo.png" alt="" className="h-11 w-11 rounded-2xl bg-white p-1.5 object-contain ring-1 ring-slate-200" />
            <div>
              <p className="text-[11px] font-black tracking-[.14em] text-emerald-950">PALLE NESTHAM</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">Thandlam Panchayat</p>
            </div>
          </div>

          <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Community</div>
          <nav aria-label="Main navigation" className="mt-3 space-y-1">
            {NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
              <button key={tab} type="button" onClick={() => handleTabChange(tab)} aria-current={activeTab === tab ? 'page' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${activeTab === tab ? 'bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                <Icon className={`h-[18px] w-[18px] ${activeTab === tab ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={2} />
                <span className="flex-1">{label}</span>
                {tab === 'report' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-700" />}
              </button>
            ))}
            {role === 'admin' && (
              <button type="button" onClick={() => setScreen({ view: 'admin' })} aria-current={screen.view === 'admin' ? 'page' : undefined}
                className={`group mt-5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${screen.view === 'admin' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                <ShieldCheck className={`h-[18px] w-[18px] ${screen.view === 'admin' ? 'text-lime-300' : 'text-amber-600'}`} />
                Administrator workspace
              </button>
            )}
          </nav>

          <div className="mt-auto rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-950"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Village portal</div>
            <p className="mt-2 text-[11px] leading-5 text-emerald-950/65">A shared place to report local issues and follow the response.</p>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{userProfile?.display_name?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">{userProfile?.display_name || 'Resident'}</p>
              <p className="mt-0.5 text-[10px] capitalize text-slate-500">{role}</p>
            </div>
            <button type="button" onClick={handleSignOut} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"><LogOut className="h-4 w-4" /></button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar
            title={topTitle}
            email={userProfile?.email || session.user.email || ''}
            role={role}
            userName={userProfile?.display_name || ''}
            onOpenProfile={() => setScreen({ view: 'profile' })}
            onSignOut={handleSignOut}
          />
          <header className="hidden h-[76px] shrink-0 items-center justify-between border-b border-slate-200 px-8 lg:px-10 md:flex">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Palle Nestham · Thandlam</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{topTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              {isStaff && <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold capitalize text-amber-900"><ShieldCheck className="h-3.5 w-3.5" /> {role} access</span>}
              <button type="button" onClick={() => setScreen({ view: 'profile' })} className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-left transition hover:border-slate-300 hover:bg-slate-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">{userProfile?.display_name?.charAt(0)?.toUpperCase() || 'R'}</span>
                <span className="max-w-36 truncate text-xs font-semibold text-slate-700">{userProfile?.display_name || 'Resident account'}</span>
              </button>
            </div>
          </header>

          <main key={screen.view} className="app-page flex-1 px-4 pb-28 pt-5 sm:px-6 md:px-8 md:pb-8 md:pt-7 lg:px-10">
            <div className="mx-auto w-full max-w-6xl">
              {screen.view === 'dashboard' && (
                <Dashboard onNavigate={handleTabChange} onSelectComplaint={handleSelectComplaint} isStaff={isStaff} role={role} userName={userProfile?.display_name || 'Resident'} />
              )}
              {screen.view === 'report' && <ReportForm onSubmitted={(ticketNumber) => setScreen({ view: 'success', ticketNumber })} />}
              {screen.view === 'success' && <ReportSuccess ticketNumber={screen.ticketNumber} onClose={() => setScreen({ view: 'dashboard' })} />}
              {screen.view === 'complaints' && <ComplaintList onSelectComplaint={handleSelectComplaint} />}
              {screen.view === 'officials' && <Officials />}
              {screen.view === 'profile' && <ProfileScreen onSignOut={handleSignOut} onOpenAdmin={() => setScreen({ view: 'admin' })} />}
              {screen.view === 'admin' && role === 'admin' && <AdminConsole onBack={() => setScreen({ view: 'profile' })} />}
              {screen.view === 'admin' && role !== 'admin' && <ProfileScreen onSignOut={handleSignOut} onOpenAdmin={() => setScreen({ view: 'profile' })} />}
              {screen.view === 'detail' && (
                <ComplaintDetail complaintId={screen.complaintId} onBack={() => setScreen({ view: 'complaints' })} canUpdate={isStaff} role={role} />
              )}
            </div>
          </main>
        </div>
      </div>
      <BottomTabBar active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
