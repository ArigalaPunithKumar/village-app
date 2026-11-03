import { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  Building2,
  Crown,
  Save,
  Check,
  XCircle,
  UserCheck,
  Clock,
} from 'lucide-react';
import {
  supabase,
  fetchCurrentProfile,
  saveProfileDetails,
  getPendingAdminRequests,
  resolveAdminRequest,
  type UserProfile,
  type UserRole,
  type AdminApprovalRequest,
} from '@/lib/supabase';

interface ProfileScreenProps {
  onSignOut: () => void;
  onRoleChange: (newRole: UserRole) => void;
}

export default function ProfileScreen({ onSignOut, onRoleChange }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit details state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Complaints count
  const [complaintCount, setComplaintCount] = useState<number>(0);

  // Admin approval queue (only visible to admins)
  const [adminRequests, setAdminRequests] = useState<AdminApprovalRequest[]>([]);
  const [actionReqId, setActionReqId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const p = await fetchCurrentProfile();
      if (p) {
        setProfile(p);
        setName(p.display_name || '');
        setPhone(p.phone || '');

        // Fetch complaints submitted by this user
        if (p.phone || p.display_name) {
          const { count } = await supabase
            .from('complaints')
            .select('*', { count: 'exact', head: true })
            .or(`reporter_phone.eq.${p.phone},reporter_name.eq.${p.display_name}`);
          setComplaintCount(count ?? 0);
        }

        // If admin, load pending admin requests
        if (p.role === 'admin') {
          setAdminRequests(getPendingAdminRequests());
        }
      }
      setLoading(false);
    }
    loadData();
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

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setDetailsError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSavingDetails(true);
    const res = await saveProfileDetails(profile.id, {
      display_name: name.trim(),
      phone: cleanPhone,
    });
    setSavingDetails(false);

    if (res.success) {
      setProfile((prev) => (prev ? { ...prev, display_name: name.trim(), phone: cleanPhone } : null));
      setDetailsSuccess('Profile details saved successfully!');
      setTimeout(() => setDetailsSuccess(null), 4000);
    } else {
      setDetailsError(res.error || 'Failed to update details.');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }

    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);

    if (error) {
      setPasswordError(error.message || 'Could not update password.');
    } else {
      setPasswordSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    }
  };

  // Only admins can switch interface preview modes
  const handleRoleToggle = (targetRole: UserRole) => {
    if (!profile || profile.role !== 'admin') return;
    const updated = { ...profile, role: targetRole };
    setProfile(updated);
    localStorage.setItem(`palle_profile_${profile.id}`, JSON.stringify(updated));
    onRoleChange(targetRole);
  };

  // Admin approves/rejects an applicant
  const handleResolveRequest = (userId: string, approve: boolean) => {
    setActionReqId(userId);
    resolveAdminRequest(userId, approve);
    setAdminRequests(getPendingAdminRequests());
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
            <p className="mt-0.5 text-xs text-emerald-100/90">{profile?.email || 'Registered Citizen'}</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-100">
              <span className="rounded-md bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                +91 {profile?.phone || 'Not registered'}
              </span>
            </div>
          </div>
        </div>

        {/* Pending admin notification if user applied */}
        {profile?.pending_admin_approval && (
          <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-amber-400/20 border border-amber-300/40 p-2.5 text-xs font-semibold text-amber-100 backdrop-blur-sm">
            <Clock className="h-4 w-4 shrink-0 text-amber-300" />
            <span>Admin registration submitted. Awaiting approval from active administrator.</span>
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

      {/* ADMIN ONLY: Interface Mode Switcher */}
      {isAdmin && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-700" />
              <h2 className="text-xs font-bold text-amber-950">Admin Interface Control</h2>
            </div>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-950">
              Admin Only
            </span>
          </div>
          <p className="mt-1 text-[11px] text-amber-900/80">
            As an Administrator, you can preview the interface as Citizen, Official, or Admin. Normal users cannot change their role.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleRoleToggle('citizen')}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-center text-slate-700 hover:bg-slate-50 transition"
            >
              <User className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">Citizen View</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleToggle('official')}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-center text-slate-700 hover:bg-slate-50 transition"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">Official View</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleToggle('admin')}
              className="flex flex-col items-center gap-1 rounded-xl border border-amber-500 bg-amber-100 p-2 text-center text-amber-950 font-bold ring-1 ring-amber-400"
            >
              <Crown className="h-3.5 w-3.5" />
              <span className="text-[10px]">Admin View</span>
            </button>
          </div>
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
                      <p className="text-[10px] text-slate-500">+91 {req.phone} · {req.email}</p>
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

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <span className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600">
                +91
              </span>
              <div className="relative flex-1">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number"
                  className="w-full rounded-2xl border border-slate-200 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full rounded-2xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-3.5 text-sm font-medium text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingDetails || !name.trim() || phone.length !== 10}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingDetails ? 'Saving…' : 'Save Details'}
          </button>
        </form>
      </section>

      {/* Change Password */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Change Password</h2>
        </div>

        {passwordSuccess && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {passwordSuccess}
          </div>
        )}

        {passwordError && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            {passwordError}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-2xl border border-slate-200 py-2.5 pl-3.5 pr-10 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full rounded-2xl border border-slate-200 py-2.5 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={updatingPassword || newPassword.length < 8 || !confirmPassword}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {updatingPassword ? 'Updating…' : 'Update Password'}
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
