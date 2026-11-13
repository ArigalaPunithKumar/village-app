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
  Trash2,
  Crown,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  supabase,
  type Complaint,
  type ComplaintStatus,
  type UserRole,
  CATEGORY_META,
  PRIORITY_META,
  STATUS_META,
  getPendingAdminRequests,
  adminDeleteComplaint,
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

interface ComplaintWithAction extends Complaint {
  latest_action?: string;
  latest_action_by?: string;
  latest_action_at?: string;
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
  const [complaints, setComplaints] = useState<ComplaintWithAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedFilter, setFeedFilter] = useState<'all' | 'urgent' | 'pending' | 'resolved'>('all');
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  // Sarpanch Action Modal
  const [actionModalItem, setActionModalItem] = useState<{ id: number; targetStatus: ComplaintStatus; title: string } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Admin Delete Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pending admin requests count
  const pendingAdminCount = role === 'admin'
    ? getPendingAdminRequests().filter((r) => r.status === 'pending').length
    : 0;

  const loadData = async () => {
    try {
      const [allRes, recentRes, updatesRes] = await Promise.all([
        supabase.from('complaints').select('status, priority'),
        supabase.from('complaints').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('status_updates').select('*').order('created_at', { ascending: false }),
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

      const updates = updatesRes.data ?? [];
      const list = ((recentRes.data ?? []) as Complaint[]).map((c) => {
        const relatedUpdates = updates.filter((u: any) => u.complaint_id === c.id);
        const latest = relatedUpdates[0];
        return {
          ...c,
          latest_action: latest?.note || undefined,
          latest_action_by: latest?.updated_by || undefined,
          latest_action_at: latest?.created_at || undefined,
        } as ComplaintWithAction;
      });

      setComplaints(list);
    } catch (err) {
      console.warn('Dashboard loadData notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick action trigger: opens action modal for Sarpanch / Staff
  const openActionModal = (e: React.MouseEvent, complaint: Complaint, targetStatus: ComplaintStatus) => {
    e.stopPropagation();
    setActionModalItem({ id: complaint.id, targetStatus, title: complaint.title });
    setActionNote(
      targetStatus === 'resolved'
        ? 'Problem inspected and successfully resolved by the Panchayat team.'
        : 'Work order assigned to field team; issue currently in progress.'
    );
  };

  // Submit Sarpanch Action Response
  const handleConfirmAction = async () => {
    if (!actionModalItem) return;
    setSubmittingAction(true);
    const { id: complaintId, targetStatus } = actionModalItem;

    try {
      const { error: updateError } = await supabase
        .from('complaints')
        .update({
          status: targetStatus,
          updated_at: new Date().toISOString(),
          ...(targetStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
        })
        .eq('id', complaintId);

      if (!updateError) {
        const updater = userName || (role === 'sarpanch' ? 'Village Sarpanch' : 'Admin');
        try {
          await supabase.from('status_updates').insert({
            complaint_id: complaintId,
            status: targetStatus,
            note: actionNote.trim() || `Status updated to ${targetStatus} by ${updater}.`,
            updated_by: updater,
          });
        } catch {}

        setComplaints((prev) =>
          prev.map((c) =>
            c.id === complaintId
              ? {
                  ...c,
                  status: targetStatus,
                  latest_action: actionNote.trim(),
                  latest_action_by: updater,
                  latest_action_at: new Date().toISOString(),
                }
              : c
          )
        );
        loadData();
      }
    } finally {
      setSubmittingAction(false);
      setActionModalItem(null);
    }
  };

  // Admin Delete Handler
  const handleDeleteReport = async (e: React.MouseEvent, complaintId: number) => {
    e.stopPropagation();
    setDeleteConfirmId(complaintId);
  };

  const confirmDeleteReport = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    await adminDeleteComplaint(deleteConfirmId);
    setComplaints((prev) => prev.filter((c) => c.id !== deleteConfirmId));
    setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    setDeleting(false);
    setDeleteConfirmId(null);
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
      {/* 1. HERO BANNER WITH SARPANCH PHOTO IN THE BACKGROUND     */}
      {/* ======================================================== */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-emerald-950/25 bg-cover bg-center animate-slide-up"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(8, 45, 28, 0.94) 0%, rgba(10, 50, 75, 0.88) 55%, rgba(10, 35, 60, 0.70) 100%), url('/sarpanch.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
        }}
      >
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-100 backdrop-blur-md">
              <Building2 className="h-3.5 w-3.5 text-amber-300" />
              Tandlam Panchayat
            </span>
            {isStaff && (
              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase text-amber-950 shadow-xs">
                {role === 'sarpanch' ? 'Sarpanch Console' : 'Admin Console'}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-black leading-tight text-white font-serif">
            Palle Nestham
          </h1>
          <p className="text-xs text-emerald-100 font-medium">
            Welcome, <span className="font-extrabold text-amber-300">{userName}</span>
          </p>
          <p className="text-[11px] text-emerald-200/90 leading-relaxed max-w-[320px]">
            {isStaff
              ? 'Review resident complaints feed, record actions taken, and resolve issues.'
              : 'Direct connection to Gram Panchayat. Report village issues with photos & GPS.'}
          </p>

          {/* Quick Action Button for Citizen */}
          {!isStaff && (
            <button
              onClick={() => onNavigate('report')}
              className="mt-2 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-xs font-black text-amber-950 shadow-md shadow-amber-500/30 transition hover:brightness-105 active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Report Grievance</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* FIRST ADMIN NOTIFICATION BANNER (IF PENDING REQUESTS)    */}
      {/* ======================================================== */}
      {role === 'admin' && pendingAdminCount > 0 && (
        <div
          onClick={() => onNavigate('profile')}
          className="cursor-pointer rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 shadow-sm flex items-center justify-between transition hover:bg-amber-100"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-amber-950 font-black">
              <Crown className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                {pendingAdminCount} Pending Admin Approval Request(s)
              </p>
              <p className="text-[10px] text-amber-800">
                New user requested admin privileges. Tap to accept or deny.
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold text-amber-900 underline shrink-0">
            Review &rarr;
          </span>
        </div>
      )}

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

                  {/* ACTION TAKEN BY SARPANCH DISPLAY (Reflected directly to Citizens) */}
                  {complaint.latest_action && (
                    <div className="mt-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Action Taken by Sarpanch / Panchayat:</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 pl-5">
                        "{complaint.latest_action}"
                      </p>
                      {complaint.latest_action_by && (
                        <p className="text-[10px] text-slate-500 pl-5">
                          By {complaint.latest_action_by}{' '}
                          {complaint.latest_action_at
                            ? `• ${new Date(complaint.latest_action_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}`
                            : ''}
                        </p>
                      )}
                    </div>
                  )}

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
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Admin Delete Report Button */}
                      {role === 'admin' ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteReport(e, complaint.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 border border-rose-200"
                          title="Delete this report permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionBusyId === complaint.id || complaint.status === 'in_progress'}
                          onClick={(e) => openActionModal(e, complaint, 'in_progress')}
                          className="inline-flex items-center gap-1 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 active:scale-95 disabled:opacity-40 border border-sky-200"
                        >
                          <Wrench className="h-3 w-3" />
                          <span>In Progress</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionBusyId === complaint.id || complaint.status === 'resolved'}
                          onClick={(e) => openActionModal(e, complaint, 'resolved')}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-40 shadow-xs"
                        >
                          <Check className="h-3 w-3" />
                          <span>Resolve</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ======================================================== */}
      {/* SARPANCH ACTION RECORD MODAL                             */}
      {/* ======================================================== */}
      {actionModalItem && (
        <div
          onClick={() => setActionModalItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl animate-scale-up space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-black">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Action Taken</h3>
                  <p className="text-[10px] text-slate-500">Visible to citizen in real-time</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionModalItem(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-700 line-clamp-1">
              Issue: "{actionModalItem.title}"
            </p>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Action Taken Details:
              </label>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
                placeholder="What action did the Sarpanch / Panchayat take? (e.g., Sanitation team dispatched, light bulb replaced)"
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* Quick action chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Inspected on-site & field team dispatched',
                'Repair work completed & tested',
                'Sanitation and drain cleared',
                'Electrician replaced damaged wire',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActionNote(chip)}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 transition"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionModalItem(null)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction || !actionNote.trim()}
                onClick={handleConfirmAction}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-700 disabled:opacity-50"
              >
                {submittingAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Save Action</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADMIN DELETE CONFIRMATION MODAL                          */}
      {/* ======================================================== */}
      {deleteConfirmId && (
        <div
          onClick={() => setDeleteConfirmId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-scale-up space-y-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">Delete Grievance Report</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                As Admin, are you sure you want to permanently delete this report? This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteReport}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/30 hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Delete Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
