import { useEffect, useState } from 'react';
import { Bell, BookOpenText, CircleHelp, Info, LogOut, Moon, ShieldCheck, Sun, Type, Monitor } from 'lucide-react';
import type { UserRole } from '@/lib/supabase';
import { applyPreferences, readPreferences, type FontSize } from '@/lib/preferences';

interface SettingsScreenProps { role: UserRole; onSignOut: () => void }

export default function SettingsScreen({ role, onSignOut }: SettingsScreenProps) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [openSection, setOpenSection] = useState<string | null>(null);

  useEffect(() => { applyPreferences(preferences); localStorage.setItem('palle_preferences', JSON.stringify(preferences)); }, [preferences]);

  const updateNotification = (key: string, value: boolean) => {
    setPreferences((current) => ({ ...current, notifications: { ...current.notifications, [key]: value } }));
  };

  const disclosures = [
    { id: 'privacy', icon: ShieldCheck, title: 'Privacy policy', body: 'Palle Nestham uses account details to verify your access, route your complaints, and deliver village notifications. Complaint details are visible to you and authorized village officials. Administrators manage account access. Do not include sensitive personal information in a complaint description.' },
    { id: 'terms', icon: BookOpenText, title: 'Terms and conditions', body: 'Use this service to report genuine village matters and share respectful feedback. Emergency situations should be reported to the relevant emergency service. Village complaint records and official status updates are retained for accountability.' },
    { id: 'about', icon: Info, title: 'About Palle Nestham', body: 'Palle Nestham connects residents with Tandlam Grama Panchayat for local complaints, public notices, meetings, polls, and village development suggestions.' },
    { id: 'help', icon: CircleHelp, title: 'Help and support', body: 'For an account or technical issue, contact the Gram Panchayat office. For emergencies call 112, for an ambulance call 108, and for fire assistance call 101.' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12 animate-fade-in">
      <header className="rounded-3xl bg-gradient-to-br from-slate-800 to-emerald-900 p-5 text-white shadow-lg"><h1 className="text-2xl font-black">Settings</h1><p className="mt-1 text-sm text-slate-200">Accessibility, notifications, and account preferences · {role}</p></header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Sun className="h-4 w-4 text-amber-600" />Appearance</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {([{ key: 'light', label: 'Light', icon: Sun }, { key: 'dark', label: 'Dark', icon: Moon }, { key: 'system', label: 'System default', icon: Monitor }] as const).map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setPreferences((current) => ({ ...current, theme: key }))} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${preferences.theme === key ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-600'}`}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Type className="h-4 w-4 text-blue-700" />Reading preferences</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Text size<select value={preferences.fontSize} onChange={(event) => setPreferences((current) => ({ ...current, fontSize: event.target.value as FontSize }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option><option value="extra-large">Extra large</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Language preference<select value={preferences.language} onChange={(event) => setPreferences((current) => ({ ...current, language: event.target.value as 'en' | 'te' }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="en">English</option><option value="te">తెలుగు (Telugu)</option></select></label>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Language preference is saved for future localized notices and screens.</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Bell className="h-4 w-4 text-emerald-700" />Notification preferences</h2>
        <div className="mt-3 divide-y divide-slate-100">{[['complaints', 'Complaint status updates'], ['announcements', 'Village announcements'], ['emergency', 'Emergency notices'], ['polls', 'Polls and public information']].map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 py-3 text-sm text-slate-700"><span>{label}</span><input type="checkbox" checked={preferences.notifications[key] ?? true} onChange={(event) => updateNotification(key, event.target.checked)} className="h-4 w-4 accent-emerald-700" /></label>)}</div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {disclosures.map(({ id, icon: Icon, title, body }) => <div key={id} className="border-b border-slate-100 last:border-0"><button onClick={() => setOpenSection((current) => current === id ? null : id)} className="flex w-full items-center gap-3 px-5 py-4 text-left font-semibold text-slate-800"><Icon className="h-4 w-4 text-emerald-700" />{title}<span className="ml-auto text-slate-400">{openSection === id ? '−' : '+'}</span></button>{openSection === id && <p className="px-5 pb-4 pl-12 text-sm leading-relaxed text-slate-600">{body}</p>}</div>)}
      </section>

      <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"><LogOut className="h-4 w-4" />Sign out</button>
    </div>
  );
}
