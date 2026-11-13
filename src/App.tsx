import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import BottomTabBar, { type Tab } from '@/components/BottomTabBar';
import MobileTopBar from '@/components/MobileTopBar';
import Dashboard from '@/components/Dashboard';
import ReportForm, { ReportSuccess } from '@/components/ReportForm';
import ComplaintList from '@/components/ComplaintList';
import ComplaintDetail from '@/components/ComplaintDetail';
import Officials from '@/components/Officials';
import ProfileScreen from '@/components/ProfileScreen';
import AuthScreen from '@/components/AuthScreen';
import SplashScreen from '@/components/SplashScreen';
import { supabase, fetchCurrentProfile, type UserProfile, type UserRole } from '@/lib/supabase';

type Screen =
  | { view: 'dashboard' }
  | { view: 'report' }
  | { view: 'complaints' }
  | { view: 'officials' }
  | { view: 'profile' }
  | { view: 'success'; ticketNumber: string }
  | { view: 'detail'; complaintId: number };

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Village Grievance Portal',
  report: 'Report a Problem',
  complaints: 'All Grievances',
  officials: 'Village Directory',
  profile: 'My Resident Profile',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('palle_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState<UserRole>('citizen');
  const [screen, setScreen] = useState<Screen>({ view: 'dashboard' });

  const loadUserData = useCallback(async () => {
    // Read local resident login first for instant responsiveness
    try {
      const storedRaw = localStorage.getItem('palle_current_user');
      if (storedRaw) {
        const parsed = JSON.parse(storedRaw);
        setUserProfile(parsed);
        setRole(parsed.role || 'citizen');
      }
    } catch (e) {
      console.warn('Error reading stored user', e);
    }

    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      if (data.session) {
        const p = await fetchCurrentProfile();
        if (p) {
          setUserProfile(p);
          setRole(p.role);
        }
      }
    } catch (sessionErr) {
      console.warn('Supabase getSession notice', sessionErr);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    loadUserData();
    const { data: listener } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadUserData();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadUserData]);

  const handleSignOut = async () => {
    localStorage.removeItem('palle_current_user');
    await supabase.auth.signOut();
    setUserProfile(null);
    setRole('citizen');
    setScreen({ view: 'dashboard' });
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setUserProfile((prev) => {
      if (!prev) return null;
      const updated = { ...prev, role: newRole };
      localStorage.setItem('palle_current_user', JSON.stringify(updated));
      return updated;
    });
  };

  const isStaff = role === 'official' || role === 'admin';

  const activeTab: Tab =
    screen.view === 'detail' || screen.view === 'success'
      ? 'complaints'
      : (screen.view as Tab);

  const handleTabChange = (tab: Tab) => setScreen({ view: tab });
  const handleSelectComplaint = (id: number) => setScreen({ view: 'detail', complaintId: id });

  const topTitle =
    screen.view === 'detail'
      ? 'Complaint Details'
      : screen.view === 'success'
      ? 'Report Submitted'
      : TAB_TITLES[activeTab] || 'Palle Nestham';

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#f7fbf5]" />;
  if (!session && !userProfile) {
    return (
      <AuthScreen
        onAuthenticated={(profile?: UserProfile) => {
          if (profile) {
            setUserProfile(profile);
            setRole(profile.role || 'citizen');
          }
          void loadUserData();
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-slate-100 font-sans">
      <div className="relative w-full max-w-[420px] bg-slate-50 shadow-2xl min-h-screen">
        <MobileTopBar
          title={topTitle}
          email={userProfile?.email || session?.user?.email || ''}
          role={role}
          userName={userProfile?.display_name || ''}
          onOpenProfile={() => setScreen({ view: 'profile' })}
          onSignOut={handleSignOut}
        />

        <main className="min-h-[calc(100vh-56px)] px-4 pb-28 pt-4">
          {screen.view === 'dashboard' && (
            <Dashboard
              onNavigate={handleTabChange}
              onSelectComplaint={handleSelectComplaint}
              isStaff={isStaff}
              role={role}
              userName={userProfile?.display_name || 'Resident'}
            />
          )}

          {screen.view === 'report' && (
            <ReportForm
              onSubmitted={(ticketNumber) => setScreen({ view: 'success', ticketNumber })}
            />
          )}

          {screen.view === 'complaints' && (
            <ComplaintList onSelectComplaint={handleSelectComplaint} isStaff={isStaff} />
          )}

          {screen.view === 'officials' && <Officials isStaff={isStaff} />}

          {screen.view === 'profile' && userProfile && (
            <ProfileScreen
              profile={userProfile}
              onRoleChange={handleRoleChange}
              onSignOut={handleSignOut}
            />
          )}

          {screen.view === 'detail' && (
            <ComplaintDetail
              complaintId={screen.complaintId}
              onBack={() => setScreen({ view: 'complaints' })}
              isStaff={isStaff}
              userRole={role}
              userName={userProfile?.display_name || 'Resident'}
            />
          )}

          {screen.view === 'success' && (
            <ReportSuccess
              ticketNumber={screen.ticketNumber}
              onViewAll={() => setScreen({ view: 'complaints' })}
              onNewReport={() => setScreen({ view: 'report' })}
            />
          )}
        </main>

        <BottomTabBar active={activeTab} onChange={handleTabChange} isStaff={isStaff} />
      </div>
    </div>
  );
}
