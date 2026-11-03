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
  userName = 'Citizen',
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

  // Authority quick action: change status directly from dashboard
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
        // Also log status update
        await supabase.from('status_updates').insert({
          complaint_id: complaintId,
          status: newStatus,
          note: `Status updated to ${newStatus} directly by official console.`,
          updated_by: userName || 'Gram Panchayat Official',
        });

        // Update local state
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
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const resolveRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  // Filter complaints for authority triage
  const displayComplaints = recent.filter((c) => {
    if (actionFilter === 'urgent') return c.priority === 'urgent' || c.priority === 'high';
    if (actionFilter === 'pending') return c.status === 'pending' || c.status === 'under_review';
    return true;
  });

  return (
    <div className="space-y-4 pb-8">
      {/* ======================================================== */}
      {/* 1. AUTHORITY / ADMIN CONSOLE BANNER (When isStaff=true) */}
      {/* ======================================================== */}
      {isStaff ? (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c2e4f] via-[#0b3c66] to-[#124e78] p-5 text-white shadow-xl ring-1 ring-white/20">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-950 shadow-sm">
                <Shield className="h-3.5 w-3.5" />
                {role === 'admin' ? 'Admin Control Center' : 'Official Authority Console'}
              </span>
              <span className="text-[11px] font-semibold text-cyan-200">
                Panchayat Desk · తిరుపతి
              </span>
            </div>

            <h1 className="mt-3 text-xl font-black tracking-tight text-white">
              Grievance Operations Desk
            </h1>
            <p className="mt-1 text-xs text-cyan-100">
              Welcome, <span className="font-bold text-amber-300">{userName}</span>. You have staff
              clearance to inspect complaints, assign priority, and sign off resolutions.
            </p>

            {/* Quick action bar for officials */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setActionFilter(actionFilter === 'urgent' ? 'all' : 'urgent')}
                className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition shadow-sm ${
                  actionFilter === 'urgent'
                    ? 'bg-rose-500 text-white ring-2 ring-white/50'
                    : 'bg-white/15 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                Urgent Escalations ({stats.urgent})
              </button>

              <button
                onClick={() => setActionFilter(actionFilter === 'pending' ? 'all' : 'pending')}
                className={`flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition shadow-sm ${
                  actionFilter === 'pending'
                    ? 'bg-amber-400 text-amber-950 ring-2 ring-white/50'
                    : 'bg-white/15 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-amber-200" />
                Awaiting Review ({stats.pending})
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl" />
        </section>
      ) : (
        /* ======================================================== */
        /* 2. CITIZEN VIBRANT HERO BANNER (When Citizen)             */
        /* ======================================================== */
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-[#0c4774] p-5 text-white shadow-xl shadow-emerald-900/10">
          <div className="relative z-10 flex items-start gap-3.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-md ring-2 ring-white/40">
              <img
                src="/image.png"
                alt="Palle Nestham Services"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100 backdrop-blur-sm">
                  నమస్కారం 🙏
                </span>
                <span className="text-[10px] text-emerald-200 font-semibold truncate">
                  {userName}
                </span>
              </div>
              <h1 className="mt-1 text-lg font-black leading-tight text-white">
                మన ఊరు · మన బాధ్యత
              </h1>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/90">
                Notice an issue with roads, water, or electricity? Report it directly to your village
                panchayat.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('report')}
            className="relative z-10 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-3 text-xs font-black text-amber-950 shadow-lg shadow-orange-500/25 transition-transform active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            Report a Problem Now
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Background decorative glows */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-300/15 blur-xl" />
          <div className="pointer-events-none absolute -bottom-10 left-12 h-28 w-28 rounded-full bg-white/10 blur-lg" />
        </section>
      )}

      {/* ======================================================== */}
      {/* 3. LIVE VILLAGE NOTICE TICKER                           */}
      {/* ======================================================== */}
      <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/60 px-3.5 py-2.5 text-xs text-amber-900 shadow-sm">
        <Megaphone className="h-4 w-4 shrink-0 text-amber-600 animate-bounce" />
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">
          <span className="font-bold text-amber-800">Panchayat Update:</span> Weekly sanitation &
          water pipeline review in progress.
        </p>
      </div>

      {/* ======================================================== */}
      {/* 4. VIBRANT COLORFUL METRICS STATS CARDS                 */}
      {/* ======================================================== */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Village Grievance Metrics
          </h2>
          <span className="text-[11px] font-semibold text-emerald-700">Live Status</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Total card - Indigo */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-3.5 text-white shadow-md shadow-indigo-600/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-100">Total Filed</span>
              <ClipboardList className="h-4 w-4 text-indigo-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.total}</p>
            <p className="mt-0.5 text-[10px] text-indigo-200">Across all wards</p>
          </div>

          {/* Pending card - Amber */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-3.5 text-white shadow-md shadow-amber-600/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-100">Awaiting Action</span>
              <Clock className="h-4 w-4 text-amber-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.pending}</p>
            <p className="mt-0.5 text-[10px] text-amber-200">Needs review</p>
          </div>

          {/* In Progress card - Cyan/Sky */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-600 p-3.5 text-white shadow-md shadow-sky-600/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-100">In Progress</span>
              <Wrench className="h-4 w-4 text-sky-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.inProgress}</p>
            <p className="mt-0.5 text-[10px] text-sky-200">Under repair</p>
          </div>

          {/* Resolved card - Emerald */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 p-3.5 text-white shadow-md shadow-emerald-600/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-100">Resolved</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
            </div>
            <p className="mt-2 text-2xl font-black">{stats.resolved}</p>
            <p className="mt-0.5 text-[10px] text-emerald-200">Successfully closed</p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. RESOLUTION RATE PROGRESS                              */}
      {/* ======================================================== */}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Gram Panchayat Resolution Rate</h3>
              <p className="text-[10px] text-slate-400">
                {stats.resolved} of {stats.total} grievances fixed
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
      {/* 6. TOP CATEGORIES OVERVIEW                              */}
      {/* ======================================================== */}
      {categoryStats.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900">Priority Sectors</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {categoryStats.slice(0, 4).map(({ category, count }) => {
              const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
              return (
                <div
                  key={category}
                  className="flex items-center gap-2.5 rounded-2xl bg-slate-50 p-2.5 border border-slate-100"
                >
                  <CategoryIcon category={category as any} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-bold text-slate-700">
                      {meta?.label ?? category}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">{count} reported</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 7. COMPLAINT LIST (Tailored for Staff vs. Citizen)       */}
      {/* ======================================================== */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isStaff ? 'Official Triage Queue' : 'Recent Village Grievances'}
            </h2>
            {isStaff && actionFilter !== 'all' && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-800">
                Filtered: {actionFilter}
              </span>
            )}
          </div>
          <button
            onClick={() => onNavigate('complaints')}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 hover:underline"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {displayComplaints.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white py-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-400">No complaints found.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayComplaints.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectComplaint(c.id)}
                className="group relative cursor-pointer rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.99]"
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

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span className="font-mono font-bold text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
                        {c.ticket_number}
                      </span>
                      {c.location && (
                        <span className="inline-flex items-center gap-0.5 truncate max-w-[150px]">
                          <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                          {c.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        <ThumbsUp className="h-3 w-3 text-slate-400" />
                        {c.upvotes}
                      </span>
                    </div>

                    {/* OFFICIAL QUICK ACTIONS (Only visible to officials/admins) */}
                    {isStaff && (
                      <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                        <span className="text-[10px] font-bold text-slate-400 mr-1">
                          Official Action:
                        </span>

                        {c.status !== 'in_progress' && c.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={actionBusyId === c.id}
                            onClick={(e) => handleQuickStatusChange(e, c.id, 'in_progress')}
                            className="rounded-xl bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700 hover:bg-sky-100 active:scale-95 disabled:opacity-50"
                          >
                            Mark In Progress
                          </button>
                        )}

                        {c.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={actionBusyId === c.id}
                            onClick={(e) => handleQuickStatusChange(e, c.id, 'resolved')}
                            className="rounded-xl bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 disabled:opacity-50"
                          >
                            Mark Resolved ✓
                          </button>
                        )}

                        <span className="ml-auto inline-flex items-center text-[10px] font-bold text-slate-500">
                          Inspect <ArrowUpRight className="h-3 w-3" />
                        </span>
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
