import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Phone, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

type AuthMode = 'signin' | 'signup';
type Gender = 'female' | 'male' | 'other' | 'prefer_not_to_say';

const cleanPhone = (value: string) => value.replace(/\D/g, '').slice(0, 10);

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
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

  const switchMode = (nextMode: AuthMode) => {
    setAuthMode(nextMode);
    setOtpSent(false);
    setOtp('');
    clearFeedback();
  };

  const handleSendOtp = async (event?: React.FormEvent) => {
    event?.preventDefault();
    clearFeedback();
    const mobile = cleanPhone(phone);

    if (mobile.length !== 10) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (authMode === 'signup') {
      const numericAge = Number(age);
      if (!name.trim()) {
        setError('Enter your full name to create an account.');
        return;
      }
      if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
        setError('Enter an age between 1 and 120.');
        return;
      }
      if (!gender) {
        setError('Select a gender option to continue.');
        return;
      }
    }

    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        phone: `+91${mobile}`,
        options: {
          shouldCreateUser: authMode === 'signup',
          channel: 'sms',
          ...(authMode === 'signup' ? {
            data: {
              display_name: name.trim(),
              age: Number(age),
              gender,
              phone: mobile,
            },
          } : {}),
        },
      });
      if (sendError) throw sendError;
      setOtpSent(true);
      setTimer(60);
      setMessage(`A 6-digit verification code was sent to +91 ${mobile}.`);
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
      setError('Enter the 6-digit code from your SMS.');
      return;
    }

    setBusy(true);
    try {
      const mobile = cleanPhone(phone);
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: `+91${mobile}`,
        token: otp,
        type: 'sms',
      });
      if (verifyError) throw verifyError;

      if (authMode === 'signup' && data.user) {
        const { error: profileError } = await supabase.from('profiles').update({
          display_name: name.trim(),
          phone: mobile,
          age: Number(age),
          gender,
        }).eq('id', data.user.id);
        if (profileError) {
          await supabase.auth.signOut();
          throw new Error(`Your number was verified, but your profile could not be saved: ${profileError.message}`);
        }
      }
      onAuthenticated();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'The code is invalid or expired. Request a new one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page min-h-screen">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        <section className="auth-story relative hidden overflow-hidden px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-28 top-20 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full border border-white/10" />
          <div className="relative z-10 flex items-center gap-3">
            <img src="/palle-nestham-logo.png" alt="" className="h-12 w-12 rounded-2xl bg-white p-1.5 object-contain shadow-lg" />
            <div><p className="text-sm font-black tracking-[.14em]">PALLE NESTHAM</p><p className="mt-0.5 text-xs text-emerald-100/75">Thandlam · Tirupati district</p></div>
          </div>
          <div className="relative z-10 max-w-xl py-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-emerald-50 backdrop-blur"><span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_0_5px_rgba(190,242,100,.12)]" />A clearer way to care for our village</div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">Your village.<br /><span className="text-emerald-200">Your voice.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/75">Report local issues, follow every update, and help your Panchayat turn community concerns into visible action.</p>
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">{[['01', 'Report', 'Share a local issue'], ['02', 'Track', 'Follow its progress'], ['03', 'Resolve', 'See the outcome']].map(([step, title, caption]) => <div key={step} className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm"><span className="text-[10px] font-bold tracking-[.18em] text-lime-200">{step}</span><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-[11px] leading-4 text-emerald-50/60">{caption}</p></div>)}</div>
          </div>
          <div className="relative z-10 flex items-center justify-between text-[11px] text-emerald-50/55"><span>మన ఊరు · మన బాధ్యత</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure phone verification</span></div>
        </section>

        <section className="flex min-h-screen flex-col bg-[#f7f9f6] px-5 py-6 sm:px-8 lg:bg-white lg:px-12 xl:px-20">
          <header className="mx-auto flex w-full max-w-[500px] items-center gap-3 lg:hidden"><img src="/palle-nestham-logo.png" alt="Palle Nestham" className="h-11 w-11 rounded-2xl bg-white p-1.5 object-contain shadow-sm ring-1 ring-slate-200" /><div><p className="text-xs font-black tracking-[.14em] text-emerald-950">PALLE NESTHAM</p><p className="mt-0.5 text-[11px] font-medium text-slate-500">Thandlam · Tirupati district</p></div></header>
          <div className="mx-auto flex w-full max-w-[500px] flex-1 flex-col justify-center py-8 lg:max-w-[460px] lg:py-14">
            <div className="mb-6 lg:mb-8"><div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 lg:hidden"><Sparkles className="h-5 w-5" /></div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">Resident portal</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.1rem]">{authMode === 'signup' ? 'Create your account' : 'Welcome back'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{authMode === 'signup' ? 'Add your details, verify your mobile number, and join your community.' : 'Sign in securely with a one-time code sent to your mobile.'}</p></div>

            {error && <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 animate-fade-in"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
            {message && <div role="status" className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 animate-fade-in"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>}

            <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              <button type="button" onClick={() => switchMode('signin')} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${authMode === 'signin' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Login</button>
              <button type="button" onClick={() => switchMode('signup')} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${authMode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Sign up</button>
            </div>

            <div className="auth-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-900/[.04] sm:p-7">
              {!otpSent ? (
                <form onSubmit={(event) => void handleSendOtp(event)} className="space-y-4">
                  {authMode === 'signup' && <>
                    <div><label htmlFor="full-name" className="field-label">Full name</label><div className="relative mt-2"><UserRound className="field-icon" /><input id="full-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="auth-input" required /></div></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label htmlFor="resident-age" className="field-label">Age</label><input id="resident-age" type="number" min={1} max={120} inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value)} placeholder="Your age" className="auth-input mt-2" required /></div>
                      <div><label htmlFor="resident-gender" className="field-label">Gender</label><select id="resident-gender" value={gender} onChange={(event) => setGender(event.target.value as Gender | '')} className="auth-input mt-2" required><option value="" disabled>Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></div>
                    </div>
                  </>}
                  <div><label htmlFor="login-phone" className="field-label">Mobile number</label><div className="relative mt-2"><Phone className="field-icon" /><span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">+91</span><input id="login-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(event) => setPhone(cleanPhone(event.target.value))} placeholder="10-digit number" className="auth-input pl-[4.6rem]" required /></div><p className="mt-2 text-xs leading-5 text-slate-500">We’ll send a one-time verification code by SMS.</p></div>
                  <button type="submit" disabled={busy} className="primary-auth-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{busy ? 'Sending code…' : 'Send OTP'}</button>
                </form>
              ) : (
                <form onSubmit={(event) => void handleVerifyOtp(event)} className="space-y-4">
                  <div><label htmlFor="verification-code" className="field-label">6-digit OTP</label><input id="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="000000" className="auth-input mt-2 text-center text-xl font-bold tracking-[.4em]" required /><div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>+91 {cleanPhone(phone)}</span><button type="button" disabled={timer > 0 || busy} onClick={() => void handleSendOtp()} className="font-semibold text-emerald-800 disabled:text-slate-400">{timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}</button></div></div>
                  <button type="submit" disabled={busy || otp.length !== 6} className="primary-auth-button">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}{busy ? 'Verifying…' : 'Verify and continue'}</button>
                  <button type="button" onClick={() => { setOtpSent(false); setOtp(''); clearFeedback(); }} className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800">Change mobile number</button>
                </form>
              )}
            </div>

            <p className="mx-auto mt-6 max-w-sm text-center text-[11px] leading-5 text-slate-400">Your phone number is verified by OTP. Profile details are visible only to you and village administrators.</p>
          </div>
          <footer className="mx-auto w-full max-w-[500px] pt-2 text-center text-[10px] font-medium text-slate-400 lg:text-left">Palle Nestham · Thandlam Gram Panchayat</footer>
        </section>
      </div>
    </main>
  );
}
