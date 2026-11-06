import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { startGoogleSignIn } from '@/lib/nativeAuth';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

type AuthMode = 'signin' | 'signup' | 'recovery';
type LoginMethod = 'otp' | 'password';
type OtpChannel = 'email' | 'phone';

const cleanPhone = (value: string) => value.replace(/\D/g, '').slice(0, 10);

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('otp');
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('email');
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (timer <= 0) return;
    const timeout = window.setTimeout(() => setTimer((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [timer]);

  const clearFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setAuthMode(nextMode);
    setOtpSent(false);
    setOtp('');
    setLoginMethod('otp');
    clearFeedback();
  };

  const handleSendOtp = async (event?: React.FormEvent) => {
    event?.preventDefault();
    clearFeedback();
    const cleanEmail = email.trim().toLowerCase();
    const mobile = cleanPhone(phone);

    if (authMode === 'signup' && !name.trim()) {
      setError('Enter your full name to create an account.');
      return;
    }
    if (authMode === 'signup' && mobile.length !== 10) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (otpChannel === 'email' && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (otpChannel === 'phone' && mobile.length !== 10) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }

    setBusy(true);
    try {
      const options = {
        shouldCreateUser: authMode === 'signup',
        data: {
          ...(authMode === 'signup' ? { display_name: name.trim(), phone: mobile } : {}),
        },
      };
      const result = otpChannel === 'email'
        ? await supabase.auth.signInWithOtp({ email: cleanEmail, options })
        : await supabase.auth.signInWithOtp({
            phone: `+91${mobile}`,
            options: { ...options, channel: 'sms' },
          });

      if (result.error) throw result.error;
      setOtpSent(true);
      setTimer(60);
      setMessage(`A 6-digit verification code was sent to ${otpChannel === 'email' ? cleanEmail : `+91 ${mobile}`}.`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send the verification code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your message.');
      return;
    }

    setBusy(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const mobile = cleanPhone(phone);
      const result = otpChannel === 'email'
        ? await supabase.auth.verifyOtp({ email: cleanEmail, token: otp, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: `+91${mobile}`, token: otp, type: 'sms' });

      if (result.error) throw result.error;
      const user = result.data.user;
      if (user && (name.trim() || authMode === 'signup' || otpChannel === 'phone')) {
        const profileUpdates = {
          ...(name.trim() ? { display_name: name.trim() } : {}),
          ...((authMode === 'signup' || otpChannel === 'phone') && mobile.length === 10 ? { phone: mobile } : {}),
        };
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id);
        if (profileError) console.warn('The account is signed in, but profile details could not be synced.', profileError.message);
      }
      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'The code is invalid or has expired. Request a new code.');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    const cleanEmail = email.trim().toLowerCase();
    const mobile = cleanPhone(phone);
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (authMode === 'signup' && (!name.trim() || mobile.length !== 10)) {
      setError('Enter your full name and a valid 10-digit mobile number.');
      return;
    }

    setBusy(true);
    try {
      if (authMode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim(), phone: mobile } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          onAuthenticated();
        } else {
          setAuthMode('signin');
          setLoginMethod('otp');
          setMessage('Your account is created. Check your email to confirm it, then sign in.');
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (signInError) throw signInError;
      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not sign in. Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendRecoveryCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    clearFeedback();
    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('Enter the email address on your account.');
      return;
    }

    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: false },
      });
      if (sendError) throw sendError;
      setRecoveryStep(2);
      setTimer(60);
      setMessage(`A password reset code was sent to ${cleanEmail}.`);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send a reset code.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    if (!/^\d{6}$/.test(recoveryOtp)) {
      setError('Enter the 6-digit reset code.');
      return;
    }
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setError(newPassword.length < 8 ? 'Use a password with at least 8 characters.' : 'The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: recoveryEmail.trim().toLowerCase(),
        token: recoveryOtp,
        type: 'email',
      });
      if (verifyError) throw verifyError;
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not reset the password. Request a new code.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearFeedback();
    setGoogleBusy(true);
    try {
      await startGoogleSignIn();
    } catch (authError) {
      setGoogleBusy(false);
      setError(authError instanceof Error ? authError.message : 'Google sign-in could not be started.');
    }
  };

  const isRecovery = authMode === 'recovery';

  return (
    <main className="auth-page min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        <section className="auth-story relative hidden overflow-hidden px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-28 top-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full border border-white/10" />
          <div className="relative z-10 flex items-center gap-3">
            <img src="/palle-nestham-logo.png" alt="" className="h-12 w-12 rounded-2xl bg-white p-1.5 object-contain shadow-lg" />
            <div>
              <p className="text-sm font-black tracking-[.14em]">PALLE NESTHAM</p>
              <p className="mt-0.5 text-xs text-emerald-100/75">Thandlam · Tirupati district</p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl py-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-emerald-50 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_0_5px_rgba(190,242,100,.12)]" />
              A clearer way to care for our village
            </div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">
              Your village.<br />
              <span className="text-emerald-200">Your voice.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/75">
              Report local issues, follow every update, and help your Panchayat turn community concerns into visible action.
            </p>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[
                ['01', 'Report', 'Share a local issue'],
                ['02', 'Track', 'Follow its progress'],
                ['03', 'Resolve', 'See the outcome'],
              ].map(([step, title, caption]) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm">
                  <span className="text-[10px] font-bold tracking-[.18em] text-lime-200">{step}</span>
                  <p className="mt-3 text-sm font-bold">{title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-emerald-50/60">{caption}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[11px] text-emerald-50/55">
            <span>మన ఊరు · మన బాధ్యత</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure resident access</span>
          </div>
        </section>

        <section className="flex min-h-screen flex-col bg-[#f7f9f6] px-5 py-6 sm:px-8 lg:bg-white lg:px-12 xl:px-20">
          <header className="mx-auto flex w-full max-w-[500px] items-center gap-3 lg:hidden">
            <img src="/palle-nestham-logo.png" alt="Palle Nestham" className="h-11 w-11 rounded-2xl bg-white p-1.5 object-contain shadow-sm ring-1 ring-slate-200" />
            <div>
              <p className="text-xs font-black tracking-[.14em] text-emerald-950">PALLE NESTHAM</p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Thandlam · Tirupati district</p>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-[500px] flex-1 flex-col justify-center py-8 lg:max-w-[460px] lg:py-14">
            <div className="mb-6 lg:mb-8">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 lg:hidden">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Resident portal</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.1rem]">
                {isRecovery ? 'Reset your password' : authMode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {isRecovery
                  ? 'We’ll send a one-time code to your registered email.'
                  : authMode === 'signup'
                    ? 'Join your community and keep up with local reports.'
                    : 'Sign in to report an issue or follow its progress.'}
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 animate-fade-in">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div role="status" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 animate-fade-in">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {isRecovery ? (
              <div className="auth-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-900/[.04] sm:p-7">
                <button type="button" onClick={() => { setAuthMode('signin'); setRecoveryStep(1); clearFeedback(); }} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-emerald-800">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </button>
                {recoveryStep === 1 ? (
                  <form onSubmit={handleSendRecoveryCode} className="space-y-4">
                    <label htmlFor="recovery-email" className="field-label">Registered email</label>
                    <div className="relative">
                      <Mail className="field-icon" />
                      <input id="recovery-email" type="email" autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder="you@example.com" className="auth-input" required />
                    </div>
                    <button type="submit" disabled={busy} className="primary-auth-button">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Send reset code
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div>
                      <label htmlFor="recovery-code" className="field-label">6-digit reset code</label>
                      <input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={recoveryOtp} onChange={(event) => setRecoveryOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="auth-input mt-2 text-center text-lg font-bold tracking-[.35em]" required />
                      <button type="button" disabled={timer > 0 || busy} onClick={() => void handleSendRecoveryCode()} className="mt-2 text-xs font-semibold text-emerald-800 disabled:text-slate-400">
                        {timer > 0 ? `Resend in ${timer}s` : 'Send another code'}
                      </button>
                    </div>
                    <div>
                      <label htmlFor="new-password" className="field-label">New password</label>
                      <div className="relative mt-2">
                        <LockKeyhole className="field-icon" />
                        <input id="new-password" type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" className="auth-input pr-12" required />
                        <button type="button" aria-label={showNewPassword ? 'Hide password' : 'Show password'} onClick={() => setShowNewPassword((shown) => !shown)} className="field-trailing-button">{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="field-label">Confirm password</label>
                      <input id="confirm-password" type={showNewPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" className="auth-input mt-2" required />
                    </div>
                    <button type="submit" disabled={busy} className="primary-auth-button">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Save new password
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <button type="button" onClick={() => switchMode('signin')} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${authMode === 'signin' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Sign in</button>
                  <button type="button" onClick={() => switchMode('signup')} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${authMode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Create account</button>
                </div>

                <div className="auth-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-900/[.04] sm:p-7">
                  {authMode === 'signup' && (
                    <div className="mb-4">
                      <label htmlFor="full-name" className="field-label">Full name</label>
                      <div className="relative mt-2">
                        <UserRound className="field-icon" />
                        <input id="full-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="auth-input" required />
                      </div>
                    </div>
                  )}

                  <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button type="button" onClick={() => { setLoginMethod('otp'); setOtpSent(false); clearFeedback(); }} className={`rounded-lg py-2 text-xs font-semibold transition ${loginMethod === 'otp' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500'}`}>One-time code</button>
                    <button type="button" onClick={() => { setLoginMethod('password'); setOtpSent(false); clearFeedback(); }} className={`rounded-lg py-2 text-xs font-semibold transition ${loginMethod === 'password' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500'}`}>Password</button>
                  </div>

                  {loginMethod === 'otp' ? (
                    !otpSent ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => { setOtpChannel('email'); clearFeedback(); }} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${otpChannel === 'email' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}><Mail className="h-3.5 w-3.5" /> Email code</button>
                          <button type="button" onClick={() => { setOtpChannel('phone'); clearFeedback(); }} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${otpChannel === 'phone' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}><Phone className="h-3.5 w-3.5" /> SMS code</button>
                        </div>
                        {otpChannel === 'email' ? (
                          <div>
                            <label htmlFor="login-email" className="field-label">Email address</label>
                            <div className="relative mt-2"><Mail className="field-icon" /><input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="auth-input" required /></div>
                          </div>
                        ) : (
                          <div>
                            <label htmlFor="login-phone" className="field-label">Mobile number</label>
                            <div className="relative mt-2"><Phone className="field-icon" /><span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">+91</span><input id="login-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(event) => setPhone(cleanPhone(event.target.value))} placeholder="10-digit number" className="auth-input pl-[4.6rem]" required /></div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">SMS codes require an active phone provider in Supabase.</p>
                          </div>
                        )}
                        {authMode === 'signup' && otpChannel === 'email' && (
                          <div>
                            <label htmlFor="signup-phone" className="field-label">Mobile number</label>
                            <div className="relative mt-2"><Phone className="field-icon" /><span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">+91</span><input id="signup-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(event) => setPhone(cleanPhone(event.target.value))} placeholder="10-digit number" className="auth-input pl-[4.6rem]" required /></div>
                          </div>
                        )}
                        <button type="submit" disabled={busy} className="primary-auth-button">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                          {busy ? 'Sending code…' : 'Send verification code'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div>
                          <label htmlFor="verification-code" className="field-label">6-digit verification code</label>
                          <input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="auth-input mt-2 text-center text-xl font-bold tracking-[.4em]" required />
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span>{otpChannel === 'email' ? email : `+91 ${cleanPhone(phone)}`}</span>
                            <button type="button" disabled={timer > 0 || busy} onClick={() => void handleSendOtp()} className="font-semibold text-emerald-800 disabled:text-slate-400">{timer > 0 ? `Resend in ${timer}s` : 'Resend code'}</button>
                          </div>
                        </div>
                        <button type="submit" disabled={busy || otp.length !== 6} className="primary-auth-button">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Verify and continue
                        </button>
                        <button type="button" onClick={() => { setOtpSent(false); setOtp(''); clearFeedback(); }} className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800">Change destination</button>
                      </form>
                    )
                  ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div>
                        <label htmlFor="password-email" className="field-label">Email address</label>
                        <div className="relative mt-2"><Mail className="field-icon" /><input id="password-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="auth-input" required /></div>
                      </div>
                      {authMode === 'signup' && (
                        <div>
                          <label htmlFor="password-phone" className="field-label">Mobile number</label>
                          <div className="relative mt-2"><Phone className="field-icon" /><span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">+91</span><input id="password-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(event) => setPhone(cleanPhone(event.target.value))} placeholder="10-digit number" className="auth-input pl-[4.6rem]" required /></div>
                        </div>
                      )}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label htmlFor="account-password" className="field-label">Password</label>
                          {authMode === 'signin' && <button type="button" onClick={() => { setAuthMode('recovery'); setRecoveryEmail(email); setRecoveryStep(1); clearFeedback(); }} className="text-xs font-semibold text-emerald-800 hover:text-emerald-950">Forgot password?</button>}
                        </div>
                        <div className="relative"><LockKeyhole className="field-icon" /><input id="account-password" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="auth-input pr-12" required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)} className="field-trailing-button">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                      </div>
                      <button type="submit" disabled={busy} className="primary-auth-button">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        {authMode === 'signup' ? 'Create account' : 'Sign in'}
                      </button>
                    </form>
                  )}

                  <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    or continue with
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <button type="button" onClick={() => void handleGoogleSignIn()} disabled={googleBusy} className="google-auth-button">
                    {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />}
                    Continue with Google
                  </button>
                </div>
              </>
            )}

            <p className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-5 text-slate-400">
              By continuing, you agree to use this portal for genuine community reports. Your contact details are kept private.
            </p>
          </div>

          <footer className="mx-auto w-full max-w-[500px] pt-2 text-center text-[10px] font-medium text-slate-400 lg:text-left">
            Palle Nestham · Thandlam Gram Panchayat
          </footer>
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M23.49 12.27c0-.78-.07-1.53-.2-2.25H12v4.26h6.44a5.5 5.5 0 0 1-2.39 3.6v2.77h3.87c2.26-2.08 3.57-5.15 3.57-8.38Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.87-2.77c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.26v2.85A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.25 14.48a7.2 7.2 0 0 1 0-4.96V6.67H1.26a12 12 0 0 0 0 10.66l3.99-2.85Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.43-3.43A11.47 11.47 0 0 0 12 0 12 12 0 0 0 1.26 6.67l3.99 2.85C6.2 6.89 8.86 4.77 12 4.77Z" />
    </svg>
  );
}
