import { useEffect, useState } from 'react';
import { Loader2, Phone, MapPin, Users, Search } from 'lucide-react';
import { supabase, roleMeta, type Official } from '@/lib/supabase';

export default function Officials() {
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('officials')
        .select('*')
        .order('order_num', { ascending: true });
      if (!error && data) setOfficials(data as Official[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = officials.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.role_label.toLowerCase().includes(q) ||
      (o.jurisdiction ?? '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Village Officials</h1>
        <p className="mt-0.5 text-[12px] text-slate-500">
          Contact your local representatives directly. Tap to call.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or role..."
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white py-14 text-center">
          <Users className="h-10 w-10 text-slate-300" />
          <p className="mt-2.5 text-[13px] font-medium text-slate-600">No officials found</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Try a different search.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((o) => {
            const meta = roleMeta(o.role);
            const initials = o.name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase();

            return (
              <div
                key={o.id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  {o.role === 'sarpanch' ? (
                    <img
                      src="/sarpanch.jpg"
                      alt={o.name}
                      className="h-14 w-14 shrink-0 rounded-full object-cover object-top ring-2 ring-emerald-400 shadow-xs"
                    />
                  ) : o.photo_url ? (
                    <img
                      src={o.photo_url}
                      alt={o.name}
                      className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-slate-100"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-base font-bold text-slate-600 ring-2 ring-slate-100">
                      {initials}
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold text-slate-900">{o.name}</h3>
                    <span
                      className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.bg} ${meta.color}`}
                    >
                      {o.role_label}
                    </span>
                    {o.jurisdiction && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <MapPin className="h-3 w-3" />
                        {o.jurisdiction}
                      </div>
                    )}
                  </div>
                </div>

                {/* Call button */}
                <a
                  href={`tel:${o.phone}`}
                  className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
                >
                  <Phone className="h-4 w-4" />
                  Call {o.phone}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="pt-1 text-center text-[10px] text-slate-400">
        Tap the call button to contact the official directly.
      </p>
    </div>
  );
}
