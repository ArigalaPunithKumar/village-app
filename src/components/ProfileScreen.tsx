import { useState, useEffect } from 'react';
import {
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Crown,
  Save,
  UserCheck,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  supabase,
  fetchCurrentProfile,
  saveProfileDetails,
  registerAdminApprovalRequest,
  getPendingAdminRequests,
  resolveAdminRequest,
  type UserProfile,
  type AdminApprovalRequest,
} from '@/lib/supabase';

interface ProfileScreenProps {
  onSignOut: () => void;
  onOpenAdmin: () => void;
}

export default function ProfileScreen({ onSignOut, onOpenAdmin }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit details state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Complaints count
  const [complaintCount, setComplaintCount] = useState<number>(0);

  // Admin approval queue (only visible to admins)
  const [adminRequests, setAdminRequests] = useState<AdminApprovalRequest[]>([]);
  const [actionReqId, setActionReqId] = useState<string | null>(null);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);
  const [requestingAdmin, setRequestingAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      const p = await fetchCurrentProfile();
      if (p) {
        if (!active) return;
        setProfile(p);
        setName(p.display_name || '');
        setAge(p.age?.toString() || '');
        setGender(p.gender || '');

        const [{ count }, requests] = await Promise.all([
          supabase
            .from('complaints')
            .select('id', { count: 'exact', head: true })
            .eq('reporter_user_id', p.id),
          p.role === 'admin' ? getPendingAdminRequests() : Promise.resolve([]),
        ]);
        if (!active) return;
        setComplaintCount(count ?? 0);

        setAdminRequests(requests);
      }
      if (active) setLoading(false);
    }
    void loadData();
    return () => { active = false; };
  }, []);

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError(null);
    setDetailsSuccess(null);

    if (!profile) return;

    if (!name.trim()) {
      setDetailsError('Full name is required.');
      return;
    }

    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
      setDetailsError('Enter an age between 1 and 120.');
      return;
    }
    if (!gender) {
      setDetailsError('Select a gender option.');
      return;
    }

    setSavingDetails(true);
    const res = await saveProfileDetails(profile.id, {
      display_name: name.trim(),
      age: numericAge,
      gender,
    });
    setSavingDetails(false);

    if (res.success) {
      setProfile((prev) => (prev ? { ...prev, display_name: name.trim(), age: numericAge, gender } : null));
      setDetailsSuccess('Profile details saved successfully!');
      setTimeout(() => setDetailsSuccess(null), 4000);
    } else {
      setDetailsError(res.error || 'Failed to update details.');
    }
  };

  const handleRequestAdmin = async () => {
    setRequestingAdmin(true);
    setAdminActionError(null);
    const result = await registerAdminApprovalRequest();
    if (!result.success) {
      setAdminActionError(result.error || 'Could not send the request.');
    } else {
      const updated = await fetchCurrentProfile();
      if (updated) setProfile(updated);
    }
    setRequestingAdmin(false);
  };

  const handleResolveRequest = async (userId: string, approve: boolean) => {
    setActionReqId(userId);
    setAdminActionError(null);
    const result = await resolveAdminRequest(userId, approve);
    if (!result.success) {
      setAdminActionError(result.error || 'Could not update this request.');
    } else {
      setAdminRequests(await getPendingAdminRequests());
    }
    setActionReqId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const role = profile?.role || 'citizen';
  const isAdmin = role === 'admin';
  const isAuthority = role === 'official' || role === 'admin';

  return (
    <div className="space-y-4 pb-12">
      {/* Profile Header Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-[#0c4774] p-5 text-white shadow-xl">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black text-white shadow-inner backdrop-blur-md ring-2 ring-white/40">
            {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold">{profile?.display_name || 'Resident'}</h1>
              {isAuthority && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950 shadow-sm">
                  <Crown className="h-2.5 w-2.5" />
                  {role}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-emerald-100/90">Mobile verified account</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-100">
              <span className="rounded-md bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                +91 {profile?.phone || 'Not registered'}
              </span>
            </div>
          </div>
        </div>

        {/* Pending admin notification if user applied */}
        {profile?.admin_access_status === 'pending' && (
          <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-amber-400/20 border border-amber-300/40 p-2.5 text-xs font-semibold text-amber-100 backdrop-blur-sm">
            <Clock className="h-4 w-4 shrink-0 text-amber-300" />
            <span>Your administrator access request is awaiting review.</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3">
          <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-sm">
            <span className="text-[10px] font-semibold text-emerald-200">Grievances Filed</span>
            <p className="mt-0.5 text-base font-bold">{complaintCount}</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-sm">
            <span className="text-[10px] font-semibold text-emerald-200">Current Role</span>
            <p className="mt-0.5 text-base font-bold capitalize">{role}</p>
          </div>
        </div>
      </section>

      {adminActionError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{adminActionError}</div>}

      {!isAdmin && profile?.admin_access_status !== 'pending' && (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Are you a village administrator?</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Send an access request. An existing administrator must review it.</p>
          </div>
          <button type="button" onClick={() => void handleRequestAdmin()} disabled={requestingAdmin} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
            {requestingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Request admin access
          </button>
        </section>
      )}

      {isAdmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-800"><ShieldCheck className="h-4 w-4" /></div>
            <div><h2 className="text-sm font-semibold text-amber-950">Administrator workspace</h2><p className="mt-1 text-xs text-amber-950/65">Manage user access, village officials, and directory details.</p></div>
          </div>
          <button type="button" onClick={onOpenAdmin} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-950"><span>Open workspace</span><ArrowRight className="h-3.5 w-3.5" /></button>
        </section>
      )}

      {/* ADMIN ONLY: Pending Admin Approvals */}
      {isAdmin && adminRequests.filter((r) => r.status === 'pending').length > 0 && (
        <section className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-700" />
              <h2 className="text-xs font-bold text-indigo-950">Pending Admin Approvals</h2>
            </div>
            <span className="rounded-full bg-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-950">
              {adminRequests.filter((r) => r.status === 'pending').length} Requests
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-900/80">
            Review and grant administrator permissions to applicants.
          </p>

          <div className="mt-3 space-y-2">
            {adminRequests
              .filter((r) => r.status === 'pending')
              .map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{req.display_name}</p>
                      <p className="text-[10px] text-slate-500">+91 {req.phone}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      Awaiting Action
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={actionReqId === req.user_id}
                      onClick={() => handleResolveRequest(req.user_id, true)}
                      className="flex-1 rounded-xl bg-emerald-600 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition"
                    >
                      Approve as Admin
                    </button>
                    <button
                      type="button"
                      disabled={actionReqId === req.user_id}
                      onClick={() => handleResolveRequest(req.user_id, false)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Edit Personal Details */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Personal Details</h2>
        </div>

        {detailsSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {detailsSuccess}
          </div>
        )}

        {detailsError && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            {detailsError}
          </div>
        )}

        <form onSubmit={handleUpdateDetails} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-2xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-age" className="mb-1 block text-xs font-semibold text-slate-700">Age</label>
              <input id="profile-age" type="number" min={1} max={120} value={age} onChange={(event) => setAge(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" required />
            </div>
            <div>
              <label htmlFor="profile-gender" className="mb-1 block text-xs font-semibold text-slate-700">Gender</label>
              <select id="profile-gender" value={gender} onChange={(event) => setGender(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" required>
                <option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Verified mobile number</label>
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-600"><Phone className="h-4 w-4 text-slate-400" />+91 {profile?.phone || 'Not registered'}</div>
            <p className="mt-1 text-[11px] text-slate-500">To change your number, complete OTP verification with the new number.</p>
          </div>

          <button
            type="submit"
            disabled={savingDetails || !name.trim() || !age || !gender}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingDetails ? 'Saving…' : 'Save Details'}
          </button>
        </form>
      </section>

      {/* Sign Out */}
      <section className="pt-2">
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </section>
    </div>
  );
}
