import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, MapPin, Camera, ShieldCheck } from 'lucide-react';
import BottomTabBar, { type Tab } from '@/components/BottomTabBar';
import MobileTopBar from '@/components/MobileTopBar';
import Dashboard from '@/components/Dashboard';
import ReportForm, { ReportSuccess } from '@/components/ReportForm';
import ComplaintList from '@/components/ComplaintList';
import ComplaintDetail from '@/components/ComplaintDetail';
import Officials from '@/components/Officials';
import ProfileScreen from '@/components/ProfileScreen';
import CommunityScreen from '@/components/CommunityScreen';
import SettingsScreen from '@/components/SettingsScreen';
import { applyStoredPreferences } from '@/lib/preferences';
import AuthScreen from '@/components/AuthScreen';
import SplashScreen from '@/components/SplashScreen';
import { supabase, fetchCurrentProfile, type UserProfile, type UserRole } from '@/lib/supabase';

type Screen =
  | { view: 'dashboard' }
  | { view: 'report' }
  | { view: 'complaints' }
  | { view: 'officials' }
  | { view: 'community' }
  | { view: 'settings' }
  | { view: 'profile' }
  | { view: 'success'; ticketNumber: string }
  | { view: 'detail'; complaintId: number };

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Panchayat Portal',
  report: 'Report Grievance',
  complaints: 'Complaints Feed',
  officials: 'Panchayat Team',
  profile: 'Resident Profile',
  community: 'Village Community',
  settings: 'Settings',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('citizen');
  const [screen, setScreen] = useState<Screen>({ view: 'dashboard' });

  // Confirmation modal state for Logout
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // One-time permission prompt for first-time users
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  useEffect(() => {
    // Remove credentials and elevated-role flags written by the former local-only auth flow.
    localStorage.removeItem('palle_user_registry');
    localStorage.removeItem('palle_current_user');
    localStorage.removeItem('palle_admin_approval_queue');
    applyStoredPreferences();
  }, []);

  const loadUserData = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      if (data.session) {
        const p = await fetchCurrentProfile();
        if (p && !p.blocked && p.is_active) {
          setUserProfile(p);
          setRole(p.role);
        } else {
          localStorage.removeItem('palle_current_user');
          setUserProfile(null);
          setRole('citizen');
          await supabase.auth.signOut();
        }
      } else {
        localStorage.removeItem('palle_current_user');
        setUserProfile(null);
        setRole('citizen');
      }
    } catch (sessionErr) {
      console.warn('Supabase getSession notice', sessionErr);
      setSession(null);
      setUserProfile(null);
      setRole('citizen');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
    const { data: listener } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        void loadUserData();
      } else {
        setUserProfile(null);
        setRole('citizen');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadUserData]);

  // Check one-time permissions after login
  useEffect(() => {
    if (userProfile || session) {
      const asked = localStorage.getItem('palle_permissions_asked');
      if (!asked) {
        setShowPermissionPrompt(true);
      }
    }
  }, [userProfile, session]);

  const handleAllowPermissions = () => {
    localStorage.setItem('palle_permissions_asked', 'true');
    setShowPermissionPrompt(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { timeout: 5000 }
      );
    }
  };

  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
    setUserProfile(null);
    setRole('citizen');
    setScreen({ view: 'dashboard' });
  };

  const isStaff = role === 'sarpanch' || role === 'admin';

  const activeTab: Tab =
    screen.view === 'detail' || screen.view === 'success'
      ? 'complaints'
      : (screen.view as Tab);

  const handleTabChange = (tab: Tab) => {
    if (tab === 'report' && role !== 'citizen') return;
    setScreen({ view: tab });
  };
  const handleSelectComplaint = (id: number) => setScreen({ view: 'detail', complaintId: id });

  const topTitle =
    screen.view === 'detail'
      ? 'Complaint Details'
      : screen.view === 'success'
      ? 'Grievance Submitted'
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
      <div className="relative w-full max-w-[1100px] bg-slate-50 shadow-2xl min-h-screen">
        <MobileTopBar
          title={topTitle}
          email={userProfile?.email || session?.user?.email || ''}
          role={role}
          userName={userProfile?.display_name || ''}
          onOpenProfile={() => setScreen({ view: 'profile' })}
          onSignOut={() => setShowLogoutConfirm(true)}
        />

        <main className="min-h-[calc(100vh-56px)] px-4 pb-28 pt-4 sm:px-6 lg:px-8">
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

          {screen.view === 'officials' && <Officials />}

          {screen.view === 'community' && userProfile && (
            <CommunityScreen userId={userProfile.id} role={role} onOpenOfficials={() => handleTabChange('officials')} />
          )}

          {screen.view === 'settings' && (
            <SettingsScreen role={role} onSignOut={() => setShowLogoutConfirm(true)} />
          )}

          {screen.view === 'profile' && userProfile && (
            <ProfileScreen
              profile={userProfile}
              onSignOut={() => setShowLogoutConfirm(true)}
              onOpenSettings={() => setScreen({ view: 'settings' })}
            />
          )}

          {screen.view === 'detail' && (
            <ComplaintDetail
              complaintId={screen.complaintId}
              onBack={() => setScreen({ view: 'complaints' })}
              canUpdate={isStaff}
              canReopen={role === 'citizen'}
              isAdmin={role === 'admin'}
              updatedBy={userProfile?.display_name || 'Panchayat Team'}
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

        <BottomTabBar active={activeTab} onChange={handleTabChange} role={role} />

        {/* ======================================================== */}
        {/* ONE-TIME FIRST-LOGIN PERMISSIONS PROMPT                 */}
        {/* ======================================================== */}
        {showPermissionPrompt && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl animate-slide-up space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 mx-auto shadow-xs">
                <ShieldCheck className="h-6 w-6" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-black text-slate-900">Enable Device Permissions</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Palle Nestham uses your Location to tag village problem spots in Tandlam Panchayat and Camera/Gallery to attach photos.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
                  <MapPin className="mx-auto h-4 w-4 text-emerald-600 mb-1" />
                  <span className="font-bold text-slate-700">GPS Location</span>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
                  <Camera className="mx-auto h-4 w-4 text-emerald-600 mb-1" />
                  <span className="font-bold text-slate-700">Camera / Media</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('palle_permissions_asked', 'true');
                    setShowPermissionPrompt(false);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Maybe Later
                </button>
                <button
                  type="button"
                  onClick={handleAllowPermissions}
                  className="rounded-2xl bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-700/30 hover:bg-emerald-800"
                >
                  Allow Once
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* LOGOUT CONFIRMATION MODAL                                */}
        {/* ======================================================== */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-up space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mx-auto">
                <LogOut className="h-6 w-6" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-black text-slate-900">Confirm Logout</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to log out of your account? You will need your email and password to log in again.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="rounded-2xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/30 hover:bg-rose-700 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
