import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
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
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  supabase,
  registerAdminApprovalRequest,
  type UserRole,
} from '@/lib/supabase';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

type AuthMode = 'signin' | 'signup' | 'recovery';
type Method = 'otp' | 'password';

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [method, setMethod] = useState<Method>('otp');
  const [otpSent, setOtpSent] = useState(false);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');

  // Input fields for Sign In / Sign Up
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('citizen');

  // Forgot Password / Recovery fields
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const cleanPhone = (val: string) => val.replace(/\D/g, '').slice(0, 10);

  // -------------------------------------------------------------
  // 1. REAL-TIME OTP SENDING
  // -------------------------------------------------------------
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const rawPhone = cleanPhone(phone);

    // Validation
    if (authMode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (rawPhone.length !== 10) {
        setError('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('Please enter a valid email address to receive your OTP code.');
        return;
      }
    } else {
      // Signin: User can provide Email or Phone
      if (!cleanEmail && rawPhone.length !== 10) {
        setError('Please enter your email or 10-digit mobile number.');
        return;
      }
    }

    setBusy(true);

    try {
      // If email is provided, send real-time 6-digit OTP code to email
      if (cleanEmail && cleanEmail.includes('@')) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            data: {
              display_name: name.trim() || undefined,
              phone: rawPhone || undefined,
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
        setMessage(`Real-time 6-digit OTP code sent to ${cleanEmail}. Please check your inbox.`);
        return;
      }

      // If mobile only was entered in sign-in, attempt Phone OTP
      const fullPhone = `+91${rawPhone}`;
      const { error: phoneOtpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: {
          channel: 'sms',
        },
      });

      setBusy(false);

      if (phoneOtpError) {
        // If phone provider is disabled in Supabase, provide clear resolution
        if (
          phoneOtpError.message.toLowerCase().includes('unsupported phone provider') ||
          phoneOtpError.message.toLowerCase().includes('phone_provider_disabled')
        ) {
          setError(
            'SMS provider is currently unconfigured on this Supabase database. Please enter your Email address above to receive your real-time 6-digit OTP instantly.'
          );
          setChannel('email');
          return;
        }
        setError(phoneOtpError.message);
        return;
      }

      setOtpSent(true);
      setTimer(60);
      setMessage(`SMS OTP code sent to +91 ${rawPhone}`);
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Failed to send OTP.';
      setError(msg);
    }
  };

  // -------------------------------------------------------------
  // 2. REAL-TIME OTP VERIFICATION
  // -------------------------------------------------------------
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanCode = otp.trim();
    if (cleanCode.length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const rawPhone = cleanPhone(phone);
    setBusy(true);

    try {
      let verifyResult;

      if (cleanEmail && cleanEmail.includes('@')) {
        // Verify real Email OTP
        verifyResult = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: 'email',
        });
      } else {
        // Verify SMS OTP
        const fullPhone = `+91${rawPhone}`;
        verifyResult = await supabase.auth.verifyOtp({
          phone: fullPhone,
          token: cleanCode,
          type: 'sms',
        });
      }

      setBusy(false);

      if (verifyResult.error) {
        setError(verifyResult.error.message || 'Invalid or expired OTP code.');
        return;
      }

      const user = verifyResult.data?.user;
      if (user) {
        let actualRole: UserRole = selectedRole;
        let isPendingAdmin = false;

        if (selectedRole === 'admin') {
          actualRole = 'citizen';
          isPendingAdmin = true;
          registerAdminApprovalRequest({
            user_id: user.id,
            display_name: name.trim() || user.user_metadata?.display_name || 'Admin Applicant',
            phone: rawPhone || user.user_metadata?.phone || '',
            email: cleanEmail || user.email || '',
          });
        }

        // Cache profile
        localStorage.setItem(
          `palle_profile_${user.id}`,
          JSON.stringify({
            id: user.id,
            display_name: name.trim() || user.user_metadata?.display_name || '',
            phone: rawPhone || user.user_metadata?.phone || '',
            email: cleanEmail || user.email || '',
            role: actualRole,
            pending_admin_approval: isPendingAdmin,
          })
        );

        // Update database profile
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
      const msg = err instanceof Error ? err.message : 'Could not verify OTP code.';
      setError(msg);
    }
  };

  // -------------------------------------------------------------
  // 3. PASSWORD SIGN IN & SIGN UP
  // -------------------------------------------------------------
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
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
        setMessage('Registration successful! You can now sign in with your email and password.');
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

  // -------------------------------------------------------------
  // 4. FORGOT PASSWORD WORKFLOW (WITH REAL-TIME OTP)
  // -------------------------------------------------------------
  const handleSendRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your registered email address.');
      return;
    }

    setBusy(true);

    try {
      // Send real-time OTP for password recovery
      const { error: resetErr } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
      });

      setBusy(false);

      if (resetErr) {
        setError(resetErr.message || 'Could not send password reset code.');
        return;
      }

      setRecoveryStep(2);
      setTimer(60);
      setMessage(`A 6-digit password reset code has been sent to ${cleanEmail}.`);
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Failed to send recovery code.';
      setError(msg);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanCode = recoveryOtp.trim();
    if (cleanCode.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (recoveryNewPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setBusy(true);

    try {
      // 1. Verify the OTP code
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: recoveryEmail.trim().toLowerCase(),
        token: cleanCode,
        type: 'email',
      });

      if (verifyErr) {
        setBusy(false);
        setError(verifyErr.message || 'Invalid or expired verification code.');
        return;
      }

      // 2. Update the user password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: recoveryNewPassword,
      });

      setBusy(false);

      if (updateErr) {
        setError(updateErr.message || 'Could not update password.');
        return;
      }

      setMessage('Password successfully reset! Signing you in…');
      setTimeout(() => {
        onAuthenticated();
      }, 1000);
    } catch (err: unknown) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : 'Password reset failed.';
      setError(msg);
    }
  };

  // -------------------------------------------------------------
  // 5. GOOGLE SIGN-IN WITH REAL-TIME VALIDATION & TIMEOUT
  // -------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    try {
      setGoogleBusy(true);
      setError(null);
      setMessage(null);

      // Probe Google OAuth endpoint to prevent hangs or 400 errors if unconfigured in Supabase
      const testUrl = `https://flovuwgbaafxjlwndifx.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
        window.location.origin
      )}`;

      const probePromise = fetch(testUrl, { redirect: 'manual' });
      const timeoutPromise = new Promise<{ isTimeout: boolean }>((resolve) =>
        setTimeout(() => resolve({ isTimeout: true }), 4000)
      );

      const probeResult = await Promise.race([probePromise, timeoutPromise]);

      if ('isTimeout' in probeResult && probeResult.isTimeout) {
        // Timed out or offline
        setError('Google sign-in check timed out. Please verify your internet connection or use OTP/Password.');
        setGoogleBusy(false);
        return;
      }

      const res = probeResult as Response;
      if (res.status === 400) {
        const text = await res.text();
        if (text.includes('provider is not enabled') || text.includes('validation_failed')) {
          setGoogleBusy(false);
          setError(
            'Google Sign-In is not enabled yet in this Supabase database (requires Google OAuth Client ID & Secret in Supabase Providers). Please sign in using OTP or Email/Password.'
          );
          return;
        }
      }

      // Proceed with OAuth redirect
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
        {/* Header Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-2 shadow-md ring-2 ring-white">
            <img src="/palle-nestham-logo.png" alt="Palle Nestham" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800">
                Palle Nestham
              </span>
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                తండ్లం
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500">మన ఊరు, మన బాధ్యత • తిరుపతి జిల్లా</p>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW A: FORGOT PASSWORD RECOVERY SCREEN                       */}
        {/* ------------------------------------------------------------- */}
        {authMode === 'recovery' ? (
          <section className="mt-5 rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/5 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError(null);
                setMessage(null);
                setRecoveryStep(1);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Forgot Password?</h2>
                <p className="text-xs text-slate-500">
                  {recoveryStep === 1
                    ? 'Enter your email to receive a 6-digit reset code.'
                    : 'Enter the 6-digit code and choose your new password.'}
                </p>
              </div>
            </div>

            {/* Error & Message Alerts */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}
            {message && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="font-semibold leading-relaxed">{message}</span>
              </div>
            )}

            {/* Recovery Step 1: Request Code */}
            {recoveryStep === 1 && (
              <form onSubmit={handleSendRecoveryCode} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Registered Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || !recoveryEmail.includes('@')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {busy ? 'Sending Reset Code…' : 'Send 6-Digit Reset Code'}
                </button>
              </form>
            )}

            {/* Recovery Step 2: Enter Code & New Password */}
            {recoveryStep === 2 && (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      6-Digit Reset Code <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      disabled={timer > 0 || busy}
                      onClick={handleSendRecoveryCode}
                      className="text-[11px] font-bold text-emerald-700 disabled:opacity-40"
                    >
                      {timer > 0 ? `Resend code in ${timer}s` : 'Resend Code'}
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={recoveryOtp}
                      onChange={(e) => setRecoveryOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-center text-lg font-bold tracking-[0.3em] text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showRecoveryPassword ? 'text' : 'password'}
                      value={recoveryNewPassword}
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400"
                    >
                      {showRecoveryPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showRecoveryPassword ? 'text' : 'password'}
                      value={recoveryConfirmPassword}
                      onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || recoveryOtp.length < 6 || recoveryNewPassword.length < 8}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? 'Resetting Password…' : 'Reset Password & Sign In'}
                </button>
              </form>
            )}
          </section>
        ) : (
          /* ------------------------------------------------------------- */
          /* VIEW B: STANDARD SIGN IN & SIGN UP                            */
          /* ------------------------------------------------------------- */
          <section className="mt-5 rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/5 backdrop-blur-sm">
            {/* Mode Switch: Sign In vs Sign Up */}
            <div className="mb-5 flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setOtpSent(false);
                  setError(null);
                  setMessage(null);
                }}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                  authMode === 'signin'
                    ? 'bg-white text-emerald-800 shadow-sm'
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
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                  authMode === 'signup'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Method Switch: OTP vs Password */}
            <div className="mb-4 flex items-center justify-center gap-4 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => {
                  setMethod('otp');
                  setOtpSent(false);
                  setError(null);
                }}
                className={`flex items-center gap-1.5 pb-1 text-xs font-bold transition border-b-2 ${
                  method === 'otp'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                OTP Verification
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod('password');
                  setOtpSent(false);
                  setError(null);
                }}
                className={`flex items-center gap-1.5 pb-1 text-xs font-bold transition border-b-2 ${
                  method === 'password'
                    ? 'border-emerald-600 text-emerald-800'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <LockKeyhole className="h-3.5 w-3.5" />
                Email & Password
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Success Alert */}
            {message && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="font-semibold leading-relaxed">{message}</span>
              </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* METHOD 1: OTP FLOW                                       */}
            {/* --------------------------------------------------------- */}
            {method === 'otp' && (
              <div>
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3.5">
                    {/* Sign Up Specific Fields */}
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
                          {selectedRole === 'admin' && (
                            <p className="mt-1 text-[10px] text-amber-700">
                              ℹ️ Admin requests require approval from an existing Administrator.
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Email for Real-time OTP */}
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        {authMode === 'signup' ? (
                          <>
                            Email Address <span className="text-rose-500">*</span>
                          </>
                        ) : (
                          <>
                            Email Address or Mobile <span className="text-rose-500">*</span>
                          </>
                        )}
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type={authMode === 'signup' ? 'email' : 'text'}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={authMode === 'signup' ? 'you@example.com (for instant OTP code)' : 'Email or 10-digit mobile'}
                          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                          required
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        ⚡ Real-time 6-digit OTP is delivered instantly to your inbox.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      {busy ? 'Sending Real-Time OTP…' : 'Send OTP Code'}
                    </button>
                  </form>
                ) : (
                  /* Verify OTP Form */
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
                          Change Recipient
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
                          required
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
                      {busy ? 'Verifying…' : authMode === 'signup' ? 'Verify & Create Account' : 'Verify & Sign In'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* METHOD 2: PASSWORD FLOW                                  */}
            {/* --------------------------------------------------------- */}
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('recovery');
                          setRecoveryEmail(email);
                          setError(null);
                          setMessage(null);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                      >
                        <KeyRound className="h-3 w-3" />
                        Forgot Password?
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

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? 'Please wait…' : authMode === 'signup' ? 'Sign Up' : 'Sign In'}
                </button>
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

            {/* Real-time Google Sign-In button with validation */}
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
              {googleBusy ? 'Connecting with Google…' : 'Continue with Google'}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
