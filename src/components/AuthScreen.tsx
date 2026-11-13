import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Clock,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import {
  supabase,
  fetchCurrentProfile,
  type UserProfile,
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

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password Modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const cleanPhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  // -------------------------------------------------------------
  // 1. SIGN IN (Email & Password - Direct & Instant)
  // -------------------------------------------------------------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        const errMsg = signInError.message.toLowerCase();
        if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid credentials')) {
          setError('Invalid email or password. Please verify and try again.');
        } else if (errMsg.includes('email not confirmed')) {
          setError('Please confirm your email address before signing in.');
        } else {
          setError(signInError.message);
        }
        setBusy(false);
        return;
      }
      if (!data.session) {
        setError('The sign-in did not create an active session. Please try again.');
        setBusy(false);
        return;
      }
      const profile = await fetchCurrentProfile();
      if (!profile) {
        await supabase.auth.signOut();
        setError('Your account profile could not be loaded. Contact the Panchayat administrator.');
      } else if (profile.blocked || !profile.is_active) {
        await supabase.auth.signOut();
        setError('This account is blocked or inactive. Contact the Gram Panchayat office.');
      } else {
        onAuthenticated(profile);
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------
  // 2. REGISTER NEW USER (No Email Confirmation Block!)
  // -------------------------------------------------------------
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: trimmedName,
            full_name: trimmedName,
            phone: rawPhone,
            gender,
            role: 'citizen',
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (signUpData.session) {
        const profile = await fetchCurrentProfile();
        if (!profile) {
          await supabase.auth.signOut();
          setError('Your account was created, but its profile could not be loaded. Contact support.');
        } else {
          onAuthenticated(profile);
        }
      } else {
        setError('The account was created, but Supabase did not start a session. Disable email confirmations in Supabase Auth settings so email and password sign-in works immediately after registration.');
      }
    } catch {
      setError('Could not create the account. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------
  // FORGOT PASSWORD HANDLER
  // -------------------------------------------------------------
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    const email = forgotEmail.trim().toLowerCase();
    if (!email) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
      if (error) throw error;
      setForgotSuccess('If an account exists for that email, a secure password reset link is on its way.');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Could not send the password reset link. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="auth-screen relative flex min-h-[100svh] items-center justify-center overflow-x-hidden px-3 py-4 sm:px-6 sm:py-8 animate-fade-in">
      <div aria-hidden="true" className="auth-glow auth-glow-one" />
      <div aria-hidden="true" className="auth-glow auth-glow-two" />
      <div className="auth-layout relative z-10 mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] shadow-[0_32px_100px_-38px_rgba(15,48,34,.55)] lg:min-h-[680px] lg:grid-cols-[.92fr_1.08fr]">
        <aside className="auth-hero relative isolate flex min-h-[205px] flex-col justify-between overflow-hidden px-6 py-5 text-white sm:min-h-[235px] sm:px-8 sm:py-7 lg:min-h-full lg:px-10 lg:py-10">
          <img
            src="/sarpanch.jpg"
            alt="Tandlam Panchayat Sarpanch"
            className="auth-hero-photo absolute inset-0 -z-20 h-full w-full object-cover object-[center_20%]"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-br from-[#073b2d]/85 via-[#0c5643]/77 to-[#092c32]/90" />
          <div aria-hidden="true" className="auth-hero-pattern absolute inset-0 -z-10 opacity-40" />

          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/70 bg-white/15 shadow-lg ring-1 ring-white/30">
              <img src="/palle-nestham-logo.png" alt="" className="h-full w-full bg-white object-contain p-0.5" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight">Palle Nestham</p>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-100">Tandlam • Tirupati</p>
            </div>
          </div>

          <div className="relative mt-5 max-w-md lg:mt-auto lg:pb-2">
            <span className="mb-2 inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-50 backdrop-blur-sm">
              Your village, connected
            </span>
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              A better way to care for our community.
            </h1>
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/85 sm:text-sm">
              Raise concerns, follow local updates, and take part in village life—all in one place.
            </p>
            <div className="mt-4 hidden flex-wrap gap-2 sm:flex lg:mt-7">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/95 backdrop-blur-sm">Citizen services</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/95 backdrop-blur-sm">Complaint tracking</span>
            </div>
          </div>
        </aside>

        <section className="auth-panel min-w-0 px-5 py-6 sm:px-9 sm:py-8 lg:flex lg:items-center lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="mb-5 sm:mb-6">
              <p className="auth-eyebrow text-[10px] font-extrabold uppercase tracking-[.2em]">Tandlam Grama Panchayat</p>
              <h2 className="auth-heading mt-1 text-2xl font-black tracking-tight sm:text-[2rem]">
                {authMode === 'signin' ? 'Welcome back' : 'Join your community'}
              </h2>
              <p className="auth-subtitle mt-1 text-sm">
                {authMode === 'signin' ? 'Sign in to follow village services and updates.' : 'Create your citizen account in just a few steps.'}
              </p>
            </div>

        {/* Tab Switcher: Sign In vs Register */}
        <div className="auth-segment mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1 text-xs font-bold">
          <button
            type="button"
            aria-selected={authMode === 'signin'}
            onClick={() => {
              setAuthMode('signin');
              setError(null);
            }}
            className={`auth-segment-button flex items-center justify-center gap-2 rounded-xl py-3 transition-all ${
              authMode === 'signin'
                ? 'is-active'
                : ''
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            aria-selected={authMode === 'signup'}
            onClick={() => {
              setAuthMode('signup');
              setError(null);
            }}
            className={`auth-segment-button flex items-center justify-center gap-2 rounded-xl py-3 transition-all ${
              authMode === 'signup'
                ? 'is-active'
                : ''
            }`}
          >
            <User className="h-4 w-4" />
            <span>Register</span>
          </button>
        </div>

        {/* Main Card */}
        <section className="auth-form-card rounded-[1.65rem] border p-5 shadow-sm sm:p-6">
          {/* Status Messages */}
          {error && (
            error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('too many') ? (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 shadow-sm animate-shake">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Clock className="h-4 w-4 text-amber-700" />
                  <span>Request Rate Limit Reached</span>
                </div>
                <p className="mt-1 text-amber-800 leading-relaxed font-medium">
                  Too many requests have been sent in a short time. Please wait 2-3 minutes before attempting again.
                </p>
              </div>
            ) : (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 animate-shake">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )
          )}

          {/* -------------------- TAB 1: SIGN IN -------------------- */}
          {authMode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="auth-label mb-1.5 block text-xs font-bold">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="auth-input w-full rounded-2xl border py-3.5 pl-10 pr-3.5 text-sm outline-none transition"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="auth-label mb-1.5 block text-xs font-bold">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="auth-input w-full rounded-2xl border py-3.5 pl-10 pr-10 text-sm outline-none transition"
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

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(loginEmail);
                    setForgotSuccess(null);
                    setForgotError(null);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-semibold text-emerald-800 hover:underline"
                >
                  Forgot Password?
                </button>
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
                <label className="auth-label mb-1 block text-xs font-bold">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Punith Kumar"
                    className="auth-input w-full rounded-2xl border py-3 pl-10 pr-3.5 text-sm outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="auth-label mb-1 block text-xs font-bold">
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
                    className="auth-input w-full rounded-2xl border py-3 pl-10 pr-10 text-sm outline-none transition"
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
                <label className="auth-label mb-1 block text-xs font-bold">
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
                    className="auth-input w-full rounded-2xl border py-3 pl-16 pr-3.5 text-sm font-semibold tracking-wide outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Gender Selection */}
              <div>
                <label className="auth-label mb-1.5 block text-xs font-bold">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`auth-choice flex items-center justify-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      gender === 'male'
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <span>Male</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`auth-choice flex items-center justify-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      gender === 'female'
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <span>Female</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('other')}
                    className={`auth-choice flex items-center justify-center gap-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      gender === 'other'
                        ? 'is-selected'
                        : ''
                    }`}
                  >
                    <span>Other</span>
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
                {busy ? 'Creating account…' : 'Create Account'}
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

        {/* Footer */}
        <div className="auth-footer mt-5 text-center">
          <p className="text-[11px]">
            Tandlam Grama Panchayat • Tirupati District
          </p>
        </div>
      </div>
        </section>
      </div>

      {/* ======================================================== */}
      {/* FORGOT PASSWORD MODAL                                    */}
      {/* ======================================================== */}
      {showForgotModal && (
        <div
          onClick={() => setShowForgotModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-up space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-black">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reset Password</h3>
                  <p className="text-[10px] text-slate-500">Quick resident account recovery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {forgotSuccess && (
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotError && (
              <div className="flex items-center gap-2 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800 border border-rose-200">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Your Registered Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-slate-300 p-2.5 text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                We’ll email a one-time secure link so you can choose a new password.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="inline-flex items-center justify-center gap-1 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  <span>Reset Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
