import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Building2,
  Crown,
} from 'lucide-react';
import {
  supabase,
  registerAdminApprovalRequest,
  type UserRole,
} from '@/lib/supabase';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

type AuthMode = 'signin' | 'signup';
type DeliveryChannel = 'sms' | 'whatsapp';
type Method = 'otp' | 'password';

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [method, setMethod] = useState<Method>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [channel, setChannel] = useState<DeliveryChannel>('sms');

  // Input fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('citizen');

  // Password login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  // Status
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const cleanPhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setMessage(null);

    const rawPhone = cleanPhone(phone);
    if (rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    setBusy(true);
    const fullPhone = `+91${rawPhone}`;

    try {
      // Call Supabase REAL SMS or WhatsApp OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: {
          channel: channel,
          data: {
            display_name: name.trim() || undefined,
            phone: rawPhone,
            requested_role: selectedRole,
          },
        },
      });

      setBusy(false);

      if (otpError) {
        setError(otpError.message);
        return;
      }

      setOtpSent(true);
      setTimer(60);
      setMessage(
        channel === 'whatsapp'
          ? `OTP sent to WhatsApp on +91 ${rawPhone}`
          : `SMS OTP sent to +91 ${rawPhone}`
      );
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Failed to send OTP.';
      setError(msg);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanCode = otp.trim();
    if (cleanCode.length < 6) {
      setError('Enter the complete 6-digit OTP code.');
      return;
    }

    const rawPhone = cleanPhone(phone);
    setBusy(true);
    const fullPhone = `+91${rawPhone}`;

    try {
      // Real OTP verification via Supabase Auth
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: cleanCode,
        type: 'sms',
      });

      setBusy(false);

      if (verifyError) {
        setError(verifyError.message || 'Invalid or expired OTP.');
        return;
      }

      const user = data?.user;
      if (user) {
        // Handle Role assignment
        let actualRole: UserRole = selectedRole;
        let isPendingAdmin = false;

        if (selectedRole === 'admin') {
          // Admin registration needs approval by another admin!
          actualRole = 'citizen';
          isPendingAdmin = true;
          registerAdminApprovalRequest({
            user_id: user.id,
            display_name: name.trim() || user.user_metadata?.display_name || 'Admin Applicant',
            phone: rawPhone,
            email: user.email || `phone_${rawPhone}@pallenestam.org`,
          });
        }

        // Cache profile
        localStorage.setItem(
          `palle_profile_${user.id}`,
          JSON.stringify({
            id: user.id,
            display_name: name.trim() || user.user_metadata?.display_name || '',
            phone: rawPhone,
            email: user.email || '',
            role: actualRole,
            pending_admin_approval: isPendingAdmin,
          })
        );

        // Update DB role
        supabase
          .from('profiles')
          .update({
            display_name: name.trim() || undefined,
            role: actualRole,
          })
          .eq('id', user.id)
          .then(() => {});
      }

      onAuthenticated();
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Could not verify OTP.';
      setError(msg);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    if (isRecovery) {
      setBusy(true);
      const { error: recErr } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      setBusy(false);
      if (recErr) {
        setError(recErr.message || 'Could not send recovery link.');
        return;
      }
      setMessage('Password reset instructions sent to your email.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);

    if (authMode === 'signup') {
      const rawPhone = cleanPhone(phone);
      if (rawPhone.length !== 10) {
        setError('Please enter a valid 10-digit mobile number.');
        setBusy(false);
        return;
      }
      if (!name.trim()) {
        setError('Full name is required.');
        setBusy(false);
        return;
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: name.trim(),
            phone: rawPhone,
            requested_role: selectedRole,
          },
        },
      });

      setBusy(false);

      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }

      const user = data.user;
      if (user) {
        let actualRole: UserRole = selectedRole;
        let isPendingAdmin = false;

        if (selectedRole === 'admin') {
          actualRole = 'citizen';
          isPendingAdmin = true;
          registerAdminApprovalRequest({
            user_id: user.id,
            display_name: name.trim(),
            phone: rawPhone,
            email: cleanEmail,
          });
        }

        localStorage.setItem(
          `palle_profile_${user.id}`,
          JSON.stringify({
            id: user.id,
            display_name: name.trim(),
            phone: rawPhone,
            email: cleanEmail,
            role: actualRole,
            pending_admin_approval: isPendingAdmin,
          })
        );
      }

      if (data.session) {
        onAuthenticated();
      } else {
        setMessage('Account registered! You can now sign in.');
        setAuthMode('signin');
      }
      return;
    }

    // Sign in with password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setBusy(false);

    if (signInErr) {
      setError(signInErr.message || 'Invalid email or password.');
      return;
    }

    onAuthenticated();
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleBusy(true);
      setError(null);
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (googleError) {
        setError(googleError.message);
        setGoogleBusy(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(msg);
      setGoogleBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#e8f7ec] via-white to-[#e8f1f8] px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-[420px] flex-col">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-2 shadow-md ring-2 ring-white">
            <img src="/image.png" alt="Palle Nestham" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800">
                Palle Nestham
              </span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                పల్లె నేస్తం
              </span>
            </div>
            <p className="text-xs text-slate-500">Citizen Grievance Portal · తిరుపతి</p>
          </div>
        </div>

        {/* Auth Card */}
        <section className="mt-5 overflow-hidden rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
          {/* Top Switcher: Sign In vs Sign Up */}
          <div className="mb-4 flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setOtpSent(false);
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                authMode === 'signin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setOtpSent(false);
                setError(null);
                setMessage(null);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                authMode === 'signup'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Heading */}
          <div className="mb-4">
            <h1 className="text-xl font-black text-slate-900">
              {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {authMode === 'signin'
                ? 'Sign in to report or track community issues.'
                : 'Create your account to get started.'}
            </p>
          </div>

          {/* Method tabs: OTP vs Password */}
          <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">
            <button
              type="button"
              onClick={() => {
                setMethod('otp');
                setOtpSent(false);
                setError(null);
              }}
              className={`text-xs font-bold pb-1 transition border-b-2 ${
                method === 'otp'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Mobile OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('password');
                setError(null);
              }}
              className={`text-xs font-bold pb-1 transition border-b-2 ${
                method === 'password'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              Email & Password
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-3.5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="mb-3.5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{message}</span>
            </div>
          )}

          {/* 1. OTP FLOW */}
          {method === 'otp' && (
            <div>
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  {/* If signing up, ask for Name and Role */}
                  {authMode === 'signup' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            required
                          />
                        </div>
                      </div>

                      {/* Role Selector during signup */}
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-700">
                          Account Role <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRole('citizen')}
                            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                              selectedRole === 'citizen'
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-400'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            <UserRound className="h-3.5 w-3.5" />
                            <span className="text-[10px]">Citizen</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRole('official')}
                            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                              selectedRole === 'official'
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-400'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">Official</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRole('admin')}
                            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                              selectedRole === 'admin'
                                ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-400'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            <Crown className="h-3.5 w-3.5" />
                            <span className="text-[10px]">Admin</span>
                          </button>
                        </div>

                        {selectedRole === 'admin' && (
                          <p className="mt-1.5 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900 border border-amber-200">
                            ℹ️ Admin role requires verification & approval by an active Admin before administrative access is granted.
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Phone input */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <span className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                        +91
                      </span>
                      <div className="relative flex-1">
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          value={phone}
                          maxLength={10}
                          onChange={(e) => setPhone(cleanPhone(e.target.value))}
                          placeholder="10-digit mobile number"
                          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm font-semibold tracking-wider text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Channel: SMS vs WhatsApp */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Deliver OTP via
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setChannel('sms')}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                          channel === 'sms'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannel('whatsapp')}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
                          channel === 'whatsapp'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        WhatsApp
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || phone.length !== 10}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {busy ? 'Sending OTP…' : 'Send OTP Code'}
                  </button>
                </form>
              ) : (
                /* Verify OTP */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Enter 6-Digit OTP <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setError(null);
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        Change Number
                      </button>
                    </div>

                    <div className="relative mt-1">
                      <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="• • • • • •"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-3.5 text-center text-lg font-bold tracking-[0.4em] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {timer > 0 ? `Resend code in ${timer}s` : 'Did not receive code?'}
                    </span>
                    <button
                      type="button"
                      disabled={timer > 0 || busy}
                      onClick={() => handleSendOtp()}
                      className="font-bold text-emerald-700 disabled:opacity-40"
                    >
                      Resend OTP
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || otp.length < 6}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {busy ? 'Verifying…' : 'Verify & Continue'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 2. PASSWORD FLOW */}
          {method === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phone}
                        maxLength={10}
                        onChange={(e) => setPhone(cleanPhone(e.target.value))}
                        placeholder="10-digit mobile number"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Account Role <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('citizen')}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                          selectedRole === 'citizen'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-400'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <UserRound className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Citizen</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole('official')}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                          selectedRole === 'official'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-400'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Official</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole('admin')}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                          selectedRole === 'admin'
                            ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-400'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <Crown className="h-3.5 w-3.5" />
                        <span className="text-[10px]">Admin</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    required
                  />
                </div>
              </div>

              {!isRecovery && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => setIsRecovery(true)}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy
                  ? 'Please wait…'
                  : isRecovery
                  ? 'Send Recovery Link'
                  : authMode === 'signup'
                  ? 'Sign Up'
                  : 'Sign In'}
              </button>

              {isRecovery && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRecovery(false)}
                    className="text-xs font-bold text-emerald-700"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Social Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 font-semibold text-slate-400">Or continue with</span>
            </div>
          </div>

          {/* Realtime Google Sign-In button */}
          <button
            type="button"
            disabled={googleBusy}
            onClick={handleGoogleSignIn}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
          >
            {googleBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            Continue with Google
          </button>
        </section>
      </div>
    </main>
  );
}
