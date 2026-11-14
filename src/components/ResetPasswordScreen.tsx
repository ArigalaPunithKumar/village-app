import { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ResetPasswordScreenProps {
  error: string | null;
  validating: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export default function ResetPasswordScreen({ error: linkError, validating, onComplete, onCancel }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match. Please check and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password could not be updated. Request a new reset link and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="auth-glow auth-glow-one" />
      <div aria-hidden="true" className="auth-glow auth-glow-two" />
      <section className="auth-panel relative z-10 w-full max-w-md rounded-[2rem] px-6 py-8 shadow-2xl sm:px-10 sm:py-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm">
          <KeyRound aria-hidden="true" className="h-7 w-7" />
        </div>
        <div className="mt-5 text-center">
          <p className="auth-eyebrow text-[10px] font-extrabold uppercase tracking-[.2em]">Tandlam Grama Panchayat</p>
          <h1 className="auth-heading mt-2 text-2xl font-black tracking-tight sm:text-3xl">Choose a new password</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Set a new password for your Palle Nestham account.</p>
        </div>

        {validating && (
          <div role="status" className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Checking your secure reset link…
          </div>
        )}

        {(linkError || error) && (
          <div role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error || linkError}</span>
          </div>
        )}

        {complete ? (
          <div className="mt-6 space-y-4 text-center">
            <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
              Your password has been updated.
            </div>
            <button type="button" onClick={onComplete} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[.99]">
              Continue to Palle Nestham
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              New password
              <span className="relative mt-2 block">
                <ShieldCheck aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={validating || Boolean(linkError) || submitting}
                  aria-label="New password"
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? 'Hide new password' : 'Show new password'}>
                  {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Confirm new password
              <span className="relative mt-2 block">
                <KeyRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={validating || Boolean(linkError) || submitting}
                  aria-label="Confirm new password"
                  className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
                  placeholder="Enter the same password again"
                />
                <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>
                  {showConfirmPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <button type="submit" disabled={validating || Boolean(linkError) || submitting || password.length < 8 || password !== confirmPassword} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:opacity-95 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-5 w-5" />}
              {submitting ? 'Updating password…' : 'Update password'}
            </button>
            {linkError && (
              <>
                <p className="text-center text-xs leading-relaxed text-slate-500">This link may have expired. Request a new one from the app’s sign-in screen.</p>
                <button type="button" onClick={onCancel} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
                  Return to Sign In
                </button>
              </>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
