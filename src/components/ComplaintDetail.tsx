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
  Trash2,
} from 'lucide-react';
import {
  supabase,
  CATEGORY_META,
  adminDeleteComplaint,
  type ComplaintWithUpdates,
  type ComplaintStatus,
  type StatusUpdate,
} from '@/lib/supabase';
import CategoryIcon from './CategoryIcon';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

interface ComplaintDetailProps {
  complaintId: number;
  onBack: () => void;
  canUpdate: boolean;
  canReopen: boolean;
  isAdmin?: boolean;
  updatedBy: string;
}

const STATUS_OPTIONS: ComplaintStatus[] = [
  'pending',
  'under_review',
  'in_progress',
  'resolved',
  'rejected',
];

export default function ComplaintDetail({ complaintId, onBack, canUpdate, canReopen, isAdmin = false, updatedBy }: ComplaintDetailProps) {
  const [complaint, setComplaint] = useState<ComplaintWithUpdates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState<ComplaintStatus>('under_review');
  const [newNote, setNewNote] = useState('');
  const [newEvidence, setNewEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [upvoted, setUpvoted] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('complaints')
        .select('*, status_updates(*)')
        .eq('id', complaintId)
        .maybeSingle();

      if (err || !data) {
        setError('Could not find this complaint.');
        setLoading(false);
        return;
      }
      const c = data as ComplaintWithUpdates;
      setComplaint(c);
      setNewStatus(c.status === 'pending' ? 'under_review' : c.status);
      setLoading(false);
    }
    load();
  }, [complaintId]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    if (!updatedBy.trim()) {
      setSubmitError('Your account does not have an official name yet.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const { data, error: insertError } = await supabase
      .from('status_updates')
      .insert({
        complaint_id: complaint.id,
        status: newStatus,
        note: newNote.trim() || null,
        evidence_url: newEvidence || null,
        updated_by: updatedBy.trim(),
      })
      .select('*')
      .single();

    if (insertError || !data) {
      setSubmitError('Failed to add update. Please try again.');
      setSubmitting(false);
      return;
    }

    const update = data as StatusUpdate;
    setComplaint((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: newStatus,
        updated_at: new Date().toISOString(),
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
        status_updates: [...(prev.status_updates ?? []), update].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        ),
      };
    });
    setNewNote('');
    setNewEvidence('');
    setSubmitting(false);
    setShowUpdateForm(false);
  };

  const handleUpvote = async () => {
    if (!complaint || upvoted) return;
    setUpvoted(true);
    const { data: nextCount, error } = await supabase.rpc('increment_complaint_upvote', {
      p_complaint_id: complaint.id,
    });
    if (!error && typeof nextCount === 'number') {
      setComplaint({ ...complaint, upvotes: nextCount });
    } else {
      setUpvoted(false);
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
  const latestActionUpdate = updates.filter((u) => u.note).slice(-1)[0];

  const handleConfirmDelete = async () => {
    if (!complaint) return;
    setDeleting(true);
    const result = await adminDeleteComplaint(complaint.id);
    setDeleting(false);
    if (result.success) {
      setShowDeleteModal(false);
      onBack();
    } else {
      setSubmitError(result.error || 'The complaint could not be archived.');
    }
  };

  const handleReopen = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!complaint) return;
    setReopening(true);
    setReopenError(null);
    const { error: reopenFailure } = await supabase.rpc('reopen_complaint', {
      p_complaint_id: complaint.id,
      p_reason: reopenReason.trim(),
    });
    if (reopenFailure) {
      setReopenError(reopenFailure.message);
      setReopening(false);
      return;
    }
    const { data } = await supabase.from('complaints').select('*, status_updates(*)').eq('id', complaint.id).single();
    if (data) setComplaint(data as ComplaintWithUpdates);
    setReopenReason('');
    setReopening(false);
  };

  const handleEvidence = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setSubmitError('Choose an image file.');
    if (file.size > 1_500_000) return setSubmitError('Choose an image smaller than 1.5 MB.');
    const reader = new FileReader();
    reader.onload = () => setNewEvidence(String(reader.result || ''));
    reader.onerror = () => setSubmitError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Back and Action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Complaints
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition active:scale-95"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Report</span>
          </button>
        )}
      </div>

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
            {canUpdate && <button
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
            </button>}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
            {complaint.description}
          </p>

          {/* ACTION TAKEN BY SARPANCH (Directly reflected to Citizen) */}
          {latestActionUpdate && (
            <div className="mt-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Action Taken by Sarpanch / Panchayat:</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-relaxed pl-5">
                "{latestActionUpdate.note}"
              </p>
              <p className="text-[10px] text-slate-500 pl-5">
                Recorded by {latestActionUpdate.updated_by} on{' '}
                {new Date(latestActionUpdate.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}

          {/* Image */}
          {complaint.image_url && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <img
                src={complaint.image_url}
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
            <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Reported By" value={complaint.reporter_name} />
            {complaint.reporter_phone && (
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
        {canReopen && complaint.status === 'resolved' && (
          <form onSubmit={handleReopen} className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <label className="block text-xs font-bold text-amber-950">Issue still unresolved? Reopen this complaint
              <textarea required minLength={3} maxLength={500} rows={2} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} placeholder="Tell the Sarpanch what remains unresolved" className="mt-1 w-full rounded-lg border border-amber-200 bg-white p-2 text-xs text-slate-900" />
            </label>
            {reopenError && <p role="alert" className="text-xs text-rose-700">{reopenError}</p>}
            <button disabled={reopening || reopenReason.trim().length < 3} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{reopening ? 'Reopening…' : 'Reopen complaint'}</button>
          </form>
        )}
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
                    {u.evidence_url && <img src={u.evidence_url} alt="Official action evidence" className="mt-2 max-h-48 rounded-xl border border-slate-200 object-cover" />}
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
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                Signed-in official
              </label>
              <input
                type="text"
                value={updatedBy}
                readOnly
                placeholder="Official account email"
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-[13px] text-slate-600 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                {newStatus === 'rejected' ? 'Reason for rejection (required)' : 'Update note (optional)'}
              </label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={newStatus === 'rejected' ? 'Explain why this complaint cannot be actioned' : 'Record the action taken...'}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            {newStatus === 'resolved' && <div className="space-y-2"><label className="block text-[11px] font-semibold text-slate-600">Resolution photo (optional, up to 1.5 MB)<input type="file" accept="image/*" onChange={(event) => handleEvidence(event.target.files?.[0])} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2 text-xs" /></label>{newEvidence && <img src={newEvidence} alt="Resolution evidence preview" className="max-h-36 rounded-xl object-cover" />}</div>}
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

      {/* ADMIN DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
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
                Archive ticket #{complaint.ticket_number}? The history will be retained for accountability and removed from active complaint lists.
              </p>
            </div>

            {submitError && <p role="alert" className="rounded-xl bg-rose-50 p-2 text-xs text-rose-700">{submitError}</p>}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
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
