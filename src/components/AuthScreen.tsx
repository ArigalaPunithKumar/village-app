import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  Building2,
  ShieldCheck,
  Crown,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import {
  supabase,
  registerAdminApprovalRequest,
  type UserProfile,
  type UserRole,
  type UserGender,
} from '@/lib/supabase';

interface AuthScreenProps {
  onAuthenticated: (profile?: UserProfile) => void;
}

type AuthMode = 'signin' | 'signup';

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Sign In Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register Fields
  const [name, setName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [selectedRole, setSelectedRole] = useState<UserRole>('citizen');

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cleanPhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  // -------------------------------------------------------------
  // 1. SIGN IN (Email & Password)
  // -------------------------------------------------------------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const email = loginEmail.trim().toLowerCase();
    const password = loginPassword;

    if (!email || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setBusy(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setBusy(false);
        const errMsg = signInError.message.toLowerCase();
        if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid credentials')) {
          setError('Invalid email or password. Please verify and try again.');
        } else if (errMsg.includes('email not confirmed')) {
          // Check local stored session for this email
          const stored = localStorage.getItem('palle_current_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.email?.toLowerCase() === email) {
              onAuthenticated(parsed);
              return;
            }
          }
          setError('Email confirmation is pending. Please check your inbox or create a new account.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (data?.user) {
        const user = data.user;
        const meta = user.user_metadata || {};

        // Fetch DB profile if present
        let dbRole: UserRole = (meta.role as UserRole) || 'citizen';
        let dbName = meta.display_name || meta.full_name || '';

        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('display_name, role')
            .eq('id', user.id)
            .maybeSingle();

          if (profileRow) {
            if (profileRow.role) dbRole = profileRow.role as UserRole;
            if (profileRow.display_name) dbName = profileRow.display_name;
          }
        } catch {}

        const profile: UserProfile = {
          id: user.id,
          display_name: dbName || meta.display_name || meta.full_name || email.split('@')[0],
          phone: meta.phone || '',
          email: user.email || email,
          gender: meta.gender || '',
          role: dbRole,
          created_at: user.created_at,
        };

        localStorage.setItem('palle_current_user', JSON.stringify(profile));
        localStorage.setItem(`palle_profile_${user.id}`, JSON.stringify(profile));

        setBusy(false);
        onAuthenticated(profile);
      } else {
        setBusy(false);
        setError('Sign in failed. Please try again.');
      }
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'An error occurred during sign in.';
      setError(msg);
    }
  };

  // -------------------------------------------------------------
  // 2. REGISTER NEW USER (Full Name, Email, Password, Mobile, Gender, Role)
  // -------------------------------------------------------------
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    const rawPhone = cleanPhone(mobile);

    // Validation
    if (trimmedName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setBusy(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: trimmedName,
            full_name: trimmedName,
            phone: rawPhone,
            gender,
            role: selectedRole,
            requested_role: selectedRole,
          },
        },
      });

      if (signUpError) {
        setBusy(false);
        const errMsg = signUpError.message.toLowerCase();
        if (errMsg.includes('already registered') || errMsg.includes('unique constraint') || errMsg.includes('user already exists')) {
          setError('An account with this email already exists. Please switch to Sign In.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      const createdUser = data?.user;
      const resolvedId = createdUser?.id || `user_${Date.now()}`;

      let actualRole: UserRole = selectedRole;
      let isPendingAdmin = false;

      if (selectedRole === 'admin') {
        actualRole = 'citizen';
        isPendingAdmin = true;
        registerAdminApprovalRequest({
          user_id: resolvedId,
          display_name: trimmedName,
          phone: rawPhone,
          email,
        });
      }

      const userProfile: UserProfile = {
        id: resolvedId,
        display_name: trimmedName,
        phone: rawPhone,
        email,
        gender,
        role: actualRole,
        pending_admin_approval: isPendingAdmin,
        created_at: new Date().toISOString(),
      };

      // Store locally so the user transitions immediately into the dashboard
      localStorage.setItem('palle_current_user', JSON.stringify(userProfile));
      localStorage.setItem(`palle_profile_${resolvedId}`, JSON.stringify(userProfile));

      // Sync with Supabase profiles table
      if (createdUser?.id) {
        try {
          await supabase.from('profiles').upsert({
            id: createdUser.id,
            display_name: trimmedName,
            role: actualRole,
          });
        } catch (dbErr) {
          console.warn('Profiles table sync:', dbErr);
        }
      }

      setBusy(false);
      onAuthenticated(userProfile);
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'An error occurred during registration.';
      setError(msg);
    }
  };

  // -------------------------------------------------------------
  // 3. INSTANT DEMO CITIZEN ACCESS
  // -------------------------------------------------------------
  const handleInstantCitizenAccess = () => {
    setBusy(true);
    setError(null);
    const demoUser: UserProfile = {
      id: 'citizen_demo_user',
      display_name: 'Resident Citizen',
      phone: '9848012345',
      email: 'citizen_demo@pallenestam.org',
      gender: 'male',
      role: 'citizen',
    };
    localStorage.setItem('palle_current_user', JSON.stringify(demoUser));
    localStorage.setItem(`palle_profile_${demoUser.id}`, JSON.stringify(demoUser));

    setBusy(false);
    onAuthenticated(demoUser);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e8f7ec] via-white to-[#e8f1f8] px-4 py-8 sm:px-6 animate-fade-in flex flex-col justify-center">
      <div className="mx-auto w-full max-w-[420px]">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-xl shadow-emerald-900/20 ring-4 ring-white">
              <Building2 className="h-8 w-8" />
            </div>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 font-serif">
            Palle Nestham
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Tandlam Grama Panchayat • Tirupati District
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Citizen Grievance & Public Services Portal
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Register */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/80 p-1 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setError(null);
              setMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all ${
              authMode === 'signin'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setError(null);
              setMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-all ${
              authMode === 'signup'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'hover:text-slate-900'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Register</span>
          </button>
        </div>

        {/* Main Card */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm">
          {/* Status Messages */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {message && (
            <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="leading-relaxed font-medium">{message}</div>
            </div>
          )}

          {/* -------------------- TAB 1: SIGN IN -------------------- */}
          {authMode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !loginEmail || !loginPassword}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                {busy ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setError(null);
                  }}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Don't have an account? <span className="font-bold underline">Register here</span>
                </button>
              </div>
            </form>
          ) : (
            /* -------------------- TAB 2: REGISTER -------------------- */
            <form onSubmit={handleRegister} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Punith Kumar"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Password (min 6 characters) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 flex items-center gap-1 text-slate-500">
                    <Phone className="h-4 w-4" />
                    <span className="text-xs font-bold">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9848012345"
                    className="w-full rounded-2xl border border-slate-300 bg-white py-2.5 pl-16 pr-3.5 text-sm font-semibold tracking-wide text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    required
                  />
                </div>
              </div>

              {/* Gender Selection */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                      gender === 'male'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Male</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                      gender === 'female'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Female</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('other')}
                    className={`flex items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold transition-all ${
                      gender === 'other'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Other</span>
                  </button>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {/* Citizen */}
                  <button
                    type="button"
                    onClick={() => setSelectedRole('citizen')}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                      selectedRole === 'citizen'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 ring-2 ring-emerald-600/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <User className="h-4 w-4 text-emerald-700 mb-0.5" />
                    <span className="text-xs font-bold">Citizen</span>
                    <span className="text-[10px] text-slate-500">Resident</span>
                  </button>

                  {/* Official */}
                  <button
                    type="button"
                    onClick={() => setSelectedRole('official')}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                      selectedRole === 'official'
                        ? 'border-blue-600 bg-blue-50/90 text-blue-950 ring-2 ring-blue-600/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4 text-blue-700 mb-0.5" />
                    <span className="text-xs font-bold">Official</span>
                    <span className="text-[10px] text-slate-500">Staff</span>
                  </button>

                  {/* Admin */}
                  <button
                    type="button"
                    onClick={() => setSelectedRole('admin')}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                      selectedRole === 'admin'
                        ? 'border-purple-600 bg-purple-50/90 text-purple-950 ring-2 ring-purple-600/20'
                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Crown className="h-4 w-4 text-purple-700 mb-0.5" />
                    <span className="text-xs font-bold">Admin</span>
                    <span className="text-[10px] text-slate-500">Panchayat</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy || !name.trim() || !registerEmail || registerPassword.length < 6 || mobile.length !== 10}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                {busy ? 'Creating account…' : 'Register & Sign In'}
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setError(null);
                  }}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Already have an account? <span className="font-bold underline">Sign In</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Quick Demo Access Option */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleInstantCitizenAccess}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 py-2.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-700" />
            <span>⚡ Instant Citizen Demo Access</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <p className="text-[11px] text-slate-400">
            Tandlam Grama Panchayat • Tirupati District
          </p>
        </div>
      </div>
    </main>
  );
}
