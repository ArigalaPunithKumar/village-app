import { useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 950);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#f7fbf5] px-6 py-12">
      <div className="splash-orb splash-orb-one" />
      <div className="splash-orb splash-orb-two" />
      <section className="relative z-10 flex w-full max-w-[420px] flex-col items-center text-center">
        <div className="splash-logo-wrap">
          <img
            src="/palle-nestham-logo.png"
            alt="Palle Nestham, Tandlam Tirupati"
            className="h-full w-full object-contain"
          />
        </div>
        <p className="mt-7 text-sm font-semibold tracking-[0.18em] text-[#0c4774]">తండ్లం · తిరుపతి</p>
        <p className="mt-2 text-base font-medium text-emerald-700">మన ఊరు, మన బాధ్యత</p>
        <div className="mt-7 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          <span className="h-px w-8 bg-emerald-200" />
          Together for our village
          <span className="h-px w-8 bg-emerald-200" />
        </div>
      </section>
    </main>
  );
}
