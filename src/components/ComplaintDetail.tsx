import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Loader2,
  MapPin,
  User,
  Phone,
  Calendar,
  ThumbsUp,
  Send,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Wrench,
} from 'lucide-react';
import {
  supabase,
  CATEGORY_META,
  type ComplaintWithUpdates,
  type ComplaintStatus,
  type StatusUpdate,
  type UserRole,
} from '@/lib/supabase';
import CategoryIcon from './CategoryIcon';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

interface ComplaintDetailProps {
  complaintId: number;
  onBack: () => void;
  canUpdate: boolean;
  role: UserRole;
}

const STATUS_OPTIONS: ComplaintStatus[] = [
  'pending',
  'under_review',
  'in_progress',
  'resolved',
  'rejected',
];

export default function ComplaintDetail({ complaintId, onBack, canUpdate, role }: ComplaintDetailProps) {
  const [complaint, setComplaint] = useState<ComplaintWithUpdates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState<ComplaintStatus>('under_review');
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [upvoted, setUpvoted] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setImagePreviewUrl(null);
    async function load() {
      const { data: publicData, error: publicError } = await supabase
        .from('complaints_public')
        .select('*')
        .eq('id', complaintId)
        .maybeSingle();

      if (publicError || !publicData) {
        if (!active) return;
        setError('Could not find this complaint.');
        setLoading(false);
        return;
      }

      const [privateResult, updateResult, authResult] = await Promise.all([
        supabase.from('complaints').select('reporter_name, reporter_phone, reporter_user_id, image_url').eq('id', complaintId).maybeSingle(),
        supabase.from('status_updates').select('id, complaint_id, status, note, updated_by, created_at').eq('complaint_id', complaintId).order('created_at', { ascending: true }),
        supabase.auth.getUser(),
      ]);
      const privateData = privateResult.data;
      if (!active) return;
      const c = {
        ...publicData,
        ...(privateData ?? {}),
        status_updates: (updateResult.data ?? []) as StatusUpdate[],
      } as ComplaintWithUpdates;
      setComplaint(c);
      setNewStatus(c.status === 'pending' ? 'under_review' : c.status);
      const isOwner = Boolean(privateData?.reporter_user_id && privateData.reporter_user_id === authResult.data.user?.id);
      if (privateData?.image_url) {
        if (privateData.image_url.startsWith('data:')) {
          setImagePreviewUrl(privateData.image_url);
        } else if (isOwner || role === 'admin') {
          const { data: signedImage } = await supabase.storage.from('complaint-evidence').createSignedUrl(privateData.image_url, 300);
          if (active) setImagePreviewUrl(signedImage?.signedUrl ?? null);
        }
      }
      if (authResult.data.user) {
        const { data: vote } = await supabase.from('complaint_upvotes').select('complaint_id').eq('complaint_id', complaintId).eq('user_id', authResult.data.user.id).maybeSingle();
        if (active) setUpvoted(Boolean(vote));
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [complaintId, role]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    setSubmitting(true);
    setSubmitError(null);

    const { error: insertError } = await supabase.rpc('update_complaint_status', {
      p_complaint_id: complaint.id,
      p_status: newStatus,
      p_note: newNote.trim() || null,
    });

    if (insertError) {
      setSubmitError(insertError.message || 'Failed to add update. Please try again.');
      setSubmitting(false);
      return;
    }

    const { data: updates } = await supabase
      .from('status_updates')
      .select('id, complaint_id, status, note, updated_by, created_at')
      .eq('complaint_id', complaint.id)
      .order('created_at', { ascending: true });
    setComplaint((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: newStatus,
        updated_at: new Date().toISOString(),
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
        status_updates: (updates ?? prev.status_updates) as StatusUpdate[],
      };
    });
    setNewNote('');
    setSubmitting(false);
    setShowUpdateForm(false);
  };

  const handleUpvote = async () => {
    if (!complaint || upvoted) return;
    setActionError(null);
    setUpvoted(true);
    const { data: nextCount, error } = await supabase.rpc('increment_complaint_upvote', {
      p_complaint_id: complaint.id,
    });
    if (!error && typeof nextCount === 'number') {
      setComplaint({ ...complaint, upvotes: nextCount });
    } else {
      setUpvoted(false);
      setActionError(error?.message || 'Could not register your support. Try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-slate-300" />
        <p className="mt-3 text-[13px] text-slate-500">{error ?? 'Complaint not found.'}</p>
        <button
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    );
  }

  const catMeta = CATEGORY_META[complaint.category];
  const updates = [...(complaint.status_updates ?? [])].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );

  return (
    <div className="space-y-4">
      {actionError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{actionError}</p>}
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500"
      >
        <ChevronLeft className="h-4 w-4" />
        Complaints
      </button>

      {/* Main card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-start gap-3">
            <CategoryIcon category={complaint.category} size="md" />
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[10px] text-slate-400">{complaint.ticket_number}</span>
              <h1 className="text-[16px] font-bold leading-tight text-slate-900">
                {complaint.title}
              </h1>
              <p className="mt-0.5 text-[11px] text-slate-500">{catMeta.label}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={complaint.status} size="sm" />
            <PriorityBadge priority={complaint.priority} size="sm" />
            <button
              onClick={handleUpvote}
              disabled={upvoted}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                upvoted
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              {complaint.upvotes}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
            {complaint.description}
          </p>

          {/* Image */}
          {imagePreviewUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <img
                src={imagePreviewUrl}
                alt="Complaint"
                className="max-h-60 w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          {/* Meta list */}
          <div className="mt-4 space-y-2">
            {complaint.location && (
              <MetaRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={complaint.location} />
            )}
            {role === 'admin' && complaint.reporter_name && (
              <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Reported By" value={complaint.reporter_name} />
            )}
            {role === 'admin' && complaint.reporter_phone && (
              <div className="flex items-center justify-between">
                <MetaRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={`+91 ${complaint.reporter_phone}`} />
                <a
                  href={`tel:${complaint.reporter_phone}`}
                  className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                >
                  Call Citizen
                </a>
              </div>
            )}
            <MetaRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Reported On"
              value={new Date(complaint.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-[14px] font-semibold text-slate-900">Status Timeline</h2>
        {updates.length === 0 ? (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-400">
            <Clock className="h-4 w-4" />
            No updates yet. Awaiting official review.
          </div>
        ) : (
          <div className="mt-3 space-y-0">
            {updates.map((u, i) => {
              const isLast = i === updates.length - 1;
              return (
                <div key={u.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <StatusDot status={u.status} />
                    {!isLast && <div className="h-full w-px min-h-[32px] bg-slate-200" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={u.status} size="sm" />
                      <span className="text-[10px] text-slate-400">
                        {new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {u.note && <p className="mt-1.5 text-[12px] text-slate-600">{u.note}</p>}
                    <p className="mt-0.5 text-[10px] font-medium text-slate-400">By {u.updated_by}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add update toggle button */}
        {canUpdate && !showUpdateForm ? (
          <button
            onClick={() => setShowUpdateForm(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-[13px] font-semibold text-emerald-700 transition-colors active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5" />
            Add Status Update
          </button>
        ) : canUpdate ? (
          <form
            onSubmit={handleStatusUpdate}
            className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5"
          >
            <h3 className="text-[13px] font-semibold text-slate-700">New Status Update</h3>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">This update will be recorded under your staff account.</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Note (optional)
              </label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Add a note..."
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            {submitError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                <p className="text-[11px] text-rose-700">{submitError}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowUpdateForm(false)}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Add
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

// ---- Helpers ----

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-slate-400">{icon}</div>
      <div className="min-w-0">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}: </span>
        <span className="text-[12px] font-medium text-slate-700">{value}</span>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: ComplaintStatus }) {
  const ICONS: Record<ComplaintStatus, React.ReactNode> = {
    pending: <Clock className="h-3 w-3 text-slate-500" />,
    under_review: <Eye className="h-3 w-3 text-blue-600" />,
    in_progress: <Wrench className="h-3 w-3 text-amber-600" />,
    resolved: <CheckCircle2 className="h-3 w-3 text-emerald-600" />,
    rejected: <XCircle className="h-3 w-3 text-rose-600" />,
  };
  const BG: Record<ComplaintStatus, string> = {
    pending: 'bg-slate-100 ring-slate-200',
    under_review: 'bg-blue-100 ring-blue-200',
    in_progress: 'bg-amber-100 ring-amber-200',
    resolved: 'bg-emerald-100 ring-emerald-200',
    rejected: 'bg-rose-100 ring-rose-200',
  };
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${BG[status]}`}>
      {ICONS[status]}
    </div>
  );
}
