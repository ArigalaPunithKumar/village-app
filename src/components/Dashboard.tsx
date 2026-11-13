import { useEffect, useState } from 'react';
import {
  ClipboardList,
  Clock,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ThumbsUp,
  MapPin,
  Wrench,
  AlertTriangle,
  Shield,
  Sparkles,
  Phone,
  Check,
  X,
  Eye,
  Filter,
  User,
  Building2,
} from 'lucide-react';
import {
  supabase,
  type Complaint,
  type ComplaintStatus,
  type UserRole,
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
  role?: UserRole;
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
  userName = 'Resident',
}: DashboardProps) {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
  });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<'all' | 'urgent' | 'pending' | 'resolved'>('all');
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const [allRes, recentRes] = await Promise.all([
        supabase.from('complaints').select('status, priority'),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }).limit(25),
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

      setComplaints((recentRes.data ?? []) as Complaint[]);
    } catch (err) {
      console.warn('Dashboard loadData notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick status change for Sarpanch & Admin
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
        try {
          await supabase.from('status_updates').insert({
            complaint_id: complaintId,
            status: newStatus,
            note: `Status updated to ${newStatus} by ${userName || role}.`,
            updated_by: userName || (role === 'sarpanch' ? 'Sarpanch' : 'Admin'),
          });
        } catch {}

        setComplaints((prev) =>
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
        <span className="text-xs font-bold text-slate-500">Loading Village Dashboard…</span>
      </div>
    );
  }

  const filteredFeed = complaints.filter((c) => {
    if (feedFilter === 'urgent') return c.priority === 'urgent' || c.priority === 'high';
    if (feedFilter === 'pending') return c.status === 'pending' || c.status === 'under_review';
    if (feedFilter === 'resolved') return c.status === 'resolved';
    return true;
  });

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* ======================================================== */}
      {/* 1. HERO BANNER WITH SARPANCH PHOTO                      */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e4b30] via-[#0d5939] to-[#0c395a] p-5 text-white shadow-xl shadow-emerald-950/20">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-100 backdrop-blur-sm">
                <Building2 className="h-3 w-3" />
                Tandlam Panchayat
              </span>
              {isStaff && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950">
                  {role === 'sarpanch' ? 'Sarpanch Console' : 'Admin Console'}
                </span>
              )}
            </div>

            <h1 className="mt-2 text-xl font-black leading-tight text-white font-serif">
              Palle Nestham
            </h1>
            <p className="mt-1 text-xs text-emerald-100 leading-snug">
              Welcome, <span className="font-extrabold text-amber-300">{userName}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-200/90 leading-tight">
              {isStaff
                ? 'Review complaints feed and take prompt action for village welfare.'
                : 'Report village issues directly to your Gram Panchayat.'}
            </p>

            {/* Quick Action Button for Citizen */}
            {!isStaff && (
              <button
                onClick={() => onNavigate('report')}
                className="mt-3.5 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-black text-amber-950 shadow-md shadow-amber-500/30 transition hover:brightness-105 active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Report Grievance</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sarpanch Portrait */}
          <div className="shrink-0 text-center">
            <div className="relative h-24 w-20 overflow-hidden rounded-2xl border-2 border-white/60 bg-white shadow-lg ring-2 ring-emerald-500/40">
              <img
                src="/sarpanch.jpg"
                alt="Village Sarpanch"
                className="h-full w-full object-cover object-top"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <span className="mt-1 block text-[10px] font-black text-amber-300 tracking-tight">
              Sarpanch
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-emerald-400/15 blur-2xl" />
      </section>

      {/* ======================================================== */}
      {/* 2. STATS OVERVIEW CARDS                                  */}
      {/* ======================================================== */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Village Grievance Metrics
          </h2>
          <span className="text-[10px] font-bold text-emerald-700">Live Status</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-2.5 shadow-2xs">
            <ClipboardList className="mx-auto h-4 w-4 text-indigo-600 mb-1" />
            <p className="text-base font-black text-indigo-900">{stats.total}</p>
            <p className="text-[9px] font-bold text-indigo-600">Total</p>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-2.5 shadow-2xs">
            <Clock className="mx-auto h-4 w-4 text-amber-600 mb-1" />
            <p className="text-base font-black text-amber-900">{stats.pending}</p>
            <p className="text-[9px] font-bold text-amber-600">Review</p>
          </div>

          <div className="rounded-2xl bg-sky-50 border border-sky-100 p-2.5 shadow-2xs">
            <Wrench className="mx-auto h-4 w-4 text-sky-600 mb-1" />
            <p className="text-base font-black text-sky-900">{stats.inProgress}</p>
            <p className="text-[9px] font-bold text-sky-600">Working</p>
          </div>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-2.5 shadow-2xs">
            <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600 mb-1" />
            <p className="text-base font-black text-emerald-900">{stats.resolved}</p>
            <p className="text-[9px] font-bold text-emerald-600">Resolved</p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. NEWS FEED OF COMPLAINTS (FOR SARPANCH, ADMIN, & CITIZEN) */}
      {/* ======================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>{isStaff ? 'Citizens Grievance News Feed' : 'Recent Village Reports'}</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              {isStaff
                ? 'Scroll through citizen issues and update status directly.'
                : 'Public grievances reported in Tandlam Panchayat.'}
            </p>
          </div>

          {/* View All link */}
          <button
            onClick={() => onNavigate('complaints')}
            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFeedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              feedFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFeedFilter('urgent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              feedFilter === 'urgent'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            Urgent ({stats.urgent})
          </button>
          <button
            onClick={() => setFeedFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              feedFilter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Clock className="h-3 w-3" />
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFeedFilter('resolved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              feedFilter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            Resolved ({stats.resolved})
          </button>
        </div>

        {/* News Feed Cards List */}
        {filteredFeed.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">No complaints in this category.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">All clear in Tandlam Panchayat!</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredFeed.map((complaint) => (
              <article
                key={complaint.id}
                onClick={() => onSelectComplaint(complaint.id)}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm transition hover:shadow-md active:scale-[0.99]"
              >
                {/* News Feed Post Header: Reporter Info & Ticket */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                      {complaint.reporter_name ? complaint.reporter_name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {complaint.reporter_name || 'Village Citizen'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Ticket #{complaint.ticket_number}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={complaint.status} />
                    <PriorityBadge priority={complaint.priority} />
                  </div>
                </div>

                {/* News Feed Image (if present) */}
                {complaint.image_url && (
                  <div className="relative h-44 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={complaint.image_url}
                      alt={complaint.title}
                      className="h-full w-full object-cover transition group-hover:scale-105 duration-300"
                    />
                    <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                      Grievance Photo
                    </div>
                  </div>
                )}

                {/* News Feed Content Body */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">
                      <CategoryIcon category={complaint.category} className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 transition">
                      {complaint.title}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {complaint.description}
                  </p>

                  {/* Location & Reporter Mobile info */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1 text-slate-600 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      <span className="truncate max-w-[200px]">{complaint.location || 'Tandlam Panchayat'}</span>
                    </div>

                    {/* Direct Call Button for Sarpanch & Admin */}
                    {complaint.reporter_phone && (
                      <a
                        href={`tel:${complaint.reporter_phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                      >
                        <Phone className="h-3 w-3" />
                        <span>Call: {complaint.reporter_phone}</span>
                      </a>
                    )}
                  </div>

                  {/* Quick Action Buttons for Sarpanch & Admin */}
                  {isStaff && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={actionBusyId === complaint.id || complaint.status === 'in_progress'}
                        onClick={(e) => handleQuickStatusChange(e, complaint.id, 'in_progress')}
                        className="inline-flex items-center gap-1 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 active:scale-95 disabled:opacity-40 border border-sky-200"
                      >
                        <Wrench className="h-3 w-3" />
                        <span>In Progress</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionBusyId === complaint.id || complaint.status === 'resolved'}
                        onClick={(e) => handleQuickStatusChange(e, complaint.id, 'resolved')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-40 shadow-xs"
                      >
                        <Check className="h-3 w-3" />
                        <span>Resolve</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
