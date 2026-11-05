import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Clock,
  Loader2,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  ThumbsUp,
  MapPin,
  Wrench,
  AlertTriangle,
  Shield,
  Sparkles,
  ArrowUpRight,
  Filter,
  CheckCheck,
  Building2,
  Megaphone,
  Radio,
} from 'lucide-react';
import {
  supabase,
  type Complaint,
  type ComplaintStatus,
  CATEGORY_META,
  PRIORITY_META,
  STATUS_META,
} from '@/lib/supabase';
import CategoryIcon from './CategoryIcon';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import type { Tab } from './BottomTabBar';

interface DashboardProps {
  onNavigate: (tab: Tab) => void;
  onSelectComplaint: (id: number) => void;
  isStaff?: boolean;
  role?: 'citizen' | 'official' | 'admin';
  userName?: string;
}

interface Stats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  urgent: number;
}

export default function Dashboard({
  onNavigate,
  onSelectComplaint,
  isStaff = false,
  role = 'citizen',
  userName = 'గ్రామస్థులు',
}: DashboardProps) {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
  });
  const [categoryStats, setCategoryStats] = useState<{ category: string; count: number }[]>([]);
  const [recent, setRecent] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<'all' | 'urgent' | 'pending'>('all');
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const loadData = async () => {
    const [allRes, catRes, recentRes] = await Promise.all([
      supabase.from('complaints').select('status, priority'),
      supabase.from('complaints').select('category'),
      supabase.from('complaints').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

    const items = allRes.data ?? [];
    setStats({
      total: items.length,
      pending: items.filter((s) => s.status === 'pending' || s.status === 'under_review').length,
      inProgress: items.filter((s) => s.status === 'in_progress').length,
      resolved: items.filter((s) => s.status === 'resolved').length,
      urgent: items.filter(
        (s) =>
          (s.priority === 'urgent' || s.priority === 'high') &&
          s.status !== 'resolved' &&
          s.status !== 'rejected'
      ).length,
    });

    const cats = (catRes.data ?? []).map((r) => r.category);
    const catCounts = Object.entries(
      cats.reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {})
    )
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    setCategoryStats(catCounts);

    setRecent((recentRes.data ?? []) as Complaint[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick status change for staff
  const handleQuickStatusChange = async (
    e: React.MouseEvent,
    complaintId: number,
    newStatus: ComplaintStatus
  ) => {
    e.stopPropagation();
    setActionBusyId(complaintId);

    try {
      const { error: updateError } = await supabase
        .from('complaints')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
        })
        .eq('id', complaintId);

      if (!updateError) {
        await supabase.from('status_updates').insert({
          complaint_id: complaintId,
          status: newStatus,
          note: `Status updated to ${newStatus} directly from official console.`,
          updated_by: userName || 'Gram Panchayat Official',
        });

        setRecent((prev) =>
          prev.map((c) => (c.id === complaintId ? { ...c, status: newStatus } : c))
        );
        loadData();
      }
    } finally {
      setActionBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
        <span className="text-xs font-bold text-slate-500">గ్రామ సమాచారం లోడ్ అవుతోంది…</span>
      </div>
    );
  }

  const resolveRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  const displayComplaints = recent.filter((c) => {
    if (actionFilter === 'urgent') return c.priority === 'urgent' || c.priority === 'high';
    if (actionFilter === 'pending') return c.status === 'pending' || c.status === 'under_review';
    return true;
  });

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* ======================================================== */}
      {/* 1. HERO BANNER: STAFF VS CITIZEN                         */}
      {/* ======================================================== */}
      {isStaff ? (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c2e4f] via-[#0b3c66] to-[#124e78] p-5 text-white shadow-xl ring-1 ring-white/20 animate-slide-up">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-950 shadow-sm">
                <Shield className="h-3.5 w-3.5" />
                {role === 'admin' ? 'అడ్మిన్ కంట్రోల్ డెస్క్' : 'పంచాయతీ అధికార డెస్క్'}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </span>
                తండ్లం పంచాయతీ
              </span>
            </div>

            <h1 className="mt-3 text-lg font-black tracking-tight text-white sm:text-xl">
              గ్రామ సమస్యల పరిష్కార కేంద్రం
            </h1>
            <p className="mt-1 text-xs text-cyan-100 leading-relaxed">
              నమస్కారం, <span className="font-extrabold text-amber-300">{userName}</span> గారు. సమస్యలను పరిశీలించి ప్రాధాన్యత ప్రకారం పరిష్కరించండి.
            </p>

            {/* Quick Action Filters for Officials */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setActionFilter(actionFilter === 'urgent' ? 'all' : 'urgent')}
                className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-2 text-xs font-bold transition-all active:scale-95 shadow-sm ${
                  actionFilter === 'urgent'
                    ? 'bg-rose-500 text-white ring-2 ring-white/50 scale-[1.02]'
                    : 'bg-white/15 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                అత్యవసరం ({stats.urgent})
              </button>

              <button
                onClick={() => setActionFilter(actionFilter === 'pending' ? 'all' : 'pending')}
                className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 px-2 text-xs font-bold transition-all active:scale-95 shadow-sm ${
                  actionFilter === 'pending'
                    ? 'bg-amber-400 text-amber-950 ring-2 ring-white/50 scale-[1.02]'
                    : 'bg-white/15 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-amber-200" />
                పరిశీలించవలసినవి ({stats.pending})
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />
        </section>
      ) : (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-[#0c4774] p-5 text-white shadow-xl shadow-emerald-900/15 animate-slide-up">
          <div className="relative z-10 flex items-start gap-3.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-md ring-2 ring-white/50">
              <img
                src="/palle-nestham-logo.png"
                alt="Palle Nestham"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100 backdrop-blur-sm">
                  నమస్కారం 🙏
                </span>
                <span className="text-[11px] text-emerald-100 font-bold truncate">
                  {userName}
                </span>
              </div>
              <h1 className="mt-1 text-lg font-black leading-tight text-white">
                మన ఊరు · మన బాధ్యత
              </h1>
              <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-100">
                రోడ్లు, తాగునీరు లేదా విద్యుత్ సమస్య ఉంటే నేరుగా గ్రామ పంచాయతీకి తెలియజేయండి.
              </p>
            </div>
          </div>

          {/* Big Action Button */}
          <button
            onClick={() => onNavigate('report')}
            className="relative z-10 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-4 py-3.5 text-xs font-black text-amber-950 shadow-lg shadow-orange-500/30 transition-all duration-200 hover:opacity-95 active:scale-[0.98] animate-pulse-glow"
          >
            <Sparkles className="h-4 w-4" />
            సమస్యను నివేదించండి • Report Issue
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-300/15 blur-xl" />
        </section>
      )}

      {/* ======================================================== */}
      {/* 2. REAL-TIME LIVE CIVIC ANNOUNCEMENT TICKER              */}
      {/* ======================================================== */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 px-3.5 py-2.5 text-xs text-emerald-950 shadow-2xs">
        <div className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
        </div>
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold">
          <span className="text-emerald-800">🔴 లైవ్ సమాచారం:</span> రామాలయం వీధిలో వీధి లైట్లు మరమ్మత్తు పూర్తయింది.
        </p>
      </div>

      {/* ======================================================== */}
      {/* 3. VIBRANT COLORFUL METRICS STATS CARDS                 */}
      {/* ======================================================== */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              గ్రామ సమస్యల స్థితిగతులు • Village Metrics
            </h2>
          </div>
          <span className="text-[10px] font-bold text-emerald-700">Live Status</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Total card - Indigo */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-4 text-white shadow-md shadow-indigo-600/15 transition-transform active:scale-95">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-100">మొత్తం ఫిర్యాదులు</span>
              <ClipboardList className="h-4 w-4 text-indigo-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.total}</p>
            <p className="mt-0.5 text-[10px] text-indigo-200 font-medium">Total Filed</p>
          </div>

          {/* Pending card - Amber */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-md shadow-amber-600/15 transition-transform active:scale-95">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-100">పరిశీలనలో ఉన్నవి</span>
              <Clock className="h-4 w-4 text-amber-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.pending}</p>
            <p className="mt-0.5 text-[10px] text-amber-200 font-medium">Under Review</p>
          </div>

          {/* In Progress card - Cyan/Sky */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-600 p-4 text-white shadow-md shadow-sky-600/15 transition-transform active:scale-95">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-100">పనులు జరుగుతున్నవి</span>
              <Wrench className="h-4 w-4 text-sky-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.inProgress}</p>
            <p className="mt-0.5 text-[10px] text-sky-200 font-medium">In Progress</p>
          </div>

          {/* Resolved card - Emerald */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 p-4 text-white shadow-md shadow-emerald-600/15 transition-transform active:scale-95">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-100">పరిష్కరించినవి</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.resolved}</p>
            <p className="mt-0.5 text-[10px] text-emerald-200 font-medium">Resolved ✓</p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. RESOLUTION RATE PROGRESS BAR                          */}
      {/* ======================================================== */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-2xs">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">గ్రామ పంచాయతీ పరిష్కార శాతం</h3>
              <p className="text-[10px] text-slate-500">
                {stats.resolved} of {stats.total} సమస్యలు పరిష్కరించబడ్డాయి
              </p>
            </div>
          </div>
          <span className="text-xl font-black text-emerald-700">{resolveRate}%</span>
        </div>

        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-1000"
            style={{ width: `${resolveRate}%` }}
          />
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. RECENT GRIEVANCES LIST                                */}
      {/* ======================================================== */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            {isStaff ? 'అధికారుల పరిశీలన లిస్ట్ (Triage)' : 'తాజా ఫిర్యాదులు • Recent Issues'}
          </h2>
          <button
            onClick={() => onNavigate('complaints')}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 hover:underline"
          >
            అన్నీ చూడండి (View all)
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {displayComplaints.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white py-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-400">ప్రస్తుతం సమస్యలు లేవు.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayComplaints.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectComplaint(c.id)}
                className="group relative cursor-pointer rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-400 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <CategoryIcon category={c.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="line-clamp-1 text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition">
                        {c.title}
                      </p>
                      <StatusBadge status={c.status} size="sm" />
                    </div>

                    <p className="line-clamp-1 mt-1 text-[11px] text-slate-500">{c.description}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">
                        {c.ticket_number}
                      </span>
                      {c.location && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[160px] font-semibold text-emerald-800">
                          <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                          {c.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5 ml-auto text-slate-400">
                        <ThumbsUp className="h-3 w-3" />
                        {c.upvotes}
                      </span>
                    </div>

                    {/* Official Quick Action Buttons */}
                    {isStaff && (
                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                        <span className="text-[10px] font-bold text-slate-400">చర్య:</span>

                        {c.status !== 'in_progress' && c.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={actionBusyId === c.id}
                            onClick={(e) => handleQuickStatusChange(e, c.id, 'in_progress')}
                            className="rounded-xl bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 hover:bg-sky-100 active:scale-95 disabled:opacity-50"
                          >
                            పనులు ప్రారంభించు (In Progress)
                          </button>
                        )}

                        {c.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={actionBusyId === c.id}
                            onClick={(e) => handleQuickStatusChange(e, c.id, 'resolved')}
                            className="rounded-xl bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
                          >
                            పరిష్కారమైంది ✓ (Resolve)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
