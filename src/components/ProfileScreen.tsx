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
  Building2,
  Crown,
  Save,
  Check,
  CreditCard,
  UserCheck,
  Clock,
  ShieldCheck,
  X,
  Pencil,
  Ban,
  RotateCcw,
  Users,
} from 'lucide-react';
import {
  supabase,
  fetchCurrentProfile,
  saveProfileDetails,
  getPendingAdminRequests,
  resolveAdminRequest,
  fetchAllUsersForAdmin,
  adminToggleBlockUser,
  adminResetUserPassword,
  type UserProfile,
  type UserRole,
  type AdminApprovalRequest,
} from '@/lib/supabase';

interface ProfileScreenProps {
  profile?: UserProfile;
  onSignOut: () => void;
  onRoleChange: (newRole: UserRole) => void;
}

export default function ProfileScreen({ profile: initialProfile, onSignOut, onRoleChange }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);

  // Edit details state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialProfile?.display_name || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [aadhaar, setAadhaar] = useState(initialProfile?.aadhaar || '');
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

  // Admin User Directory & Controls
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userStatusBusy, setUserStatusBusy] = useState<string | null>(null);
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [adminActionMsg, setAdminActionMsg] = useState<string | null>(null);

  // Logout confirmation modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      const p = await fetchCurrentProfile();
      if (p) {
        setProfile(p);
        setName(p.display_name || '');
        setPhone(p.phone || '');
        setAadhaar(p.aadhaar || '');

        if (p.phone || p.display_name) {
          const { count } = await supabase
            .from('complaints')
            .select('*', { count: 'exact', head: true })
            .or(`reporter_phone.eq.${p.phone},reporter_name.eq.${p.display_name}`);
          setComplaintCount(count ?? 0);
        }

        if (p.role === 'admin') {
          setAdminRequests(getPendingAdminRequests());
          loadAdminUsers();
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const loadAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await fetchAllUsersForAdmin();
      setAllUsers(users);
    } finally {
      setLoadingUsers(false);
    }
  };

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

    const cleanAadhaar = aadhaar.replace(/\D/g, '');
    if (cleanAadhaar && cleanAadhaar.length !== 12) {
      setDetailsError('Aadhaar number must be exactly 12 digits.');
      return;
    }

    setSavingDetails(true);
    const res = await saveProfileDetails(profile.id, {
      display_name: name.trim(),
      phone: cleanPhone,
      aadhaar: cleanAadhaar,
    });
    setSavingDetails(false);

    if (res.success) {
      const updated: UserProfile = {
        ...profile,
        display_name: name.trim(),
        phone: cleanPhone,
        aadhaar: cleanAadhaar,
      };
      setProfile(updated);
      localStorage.setItem('palle_current_user', JSON.stringify(updated));
      localStorage.setItem(`palle_profile_${profile.id}`, JSON.stringify(updated));

      setIsEditing(false);
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

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
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

  const handleRoleToggle = (newRole: UserRole) => {
    onRoleChange(newRole);
    if (profile) {
      const updated = { ...profile, role: newRole };
      setProfile(updated);
      localStorage.setItem('palle_current_user', JSON.stringify(updated));
    }
  };

  const handleResolveAdmin = (requestId: string, approve: boolean) => {
    setActionReqId(requestId);
    try {
      const updated = resolveAdminRequest(requestId, approve);
      setAdminRequests(updated);
      loadAdminUsers();
      setAdminActionMsg(approve ? 'Admin access approved!' : 'Admin request rejected.');
      setTimeout(() => setAdminActionMsg(null), 4000);
    } finally {
      setActionReqId(null);
    }
  };

  // Admin: Block / Unblock User
  const handleToggleBlock = async (targetUser: UserProfile) => {
    setUserStatusBusy(targetUser.id);
    const newStatus = !targetUser.blocked;
    const res = await adminToggleBlockUser(targetUser.id, targetUser.email, newStatus);
    setUserStatusBusy(null);

    if (res.success) {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, blocked: newStatus } : u))
      );
      setAdminActionMsg(`User ${targetUser.display_name} is now ${newStatus ? 'Blocked' : 'Active'}.`);
      setTimeout(() => setAdminActionMsg(null), 4000);
    }
  };

  // Admin: Reset User or Sarpanch Password
  const handleAdminResetPassword = async () => {
    if (!resetModalUser || !adminNewPassword.trim()) return;
    setResettingPassword(true);

    const res = await adminResetUserPassword(resetModalUser.id, resetModalUser.email, adminNewPassword.trim());
    setResettingPassword(false);

    if (res.success) {
      setAdminActionMsg(`Password for ${resetModalUser.display_name} has been reset to "${adminNewPassword}".`);
      setResetModalUser(null);
      setAdminNewPassword('');
      setTimeout(() => setAdminActionMsg(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-2">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold text-slate-500">Loading profile…</span>
      </div>
    );
  }

  const role = profile?.role || 'citizen';
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* Header Profile Card */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-5 text-white shadow-xl shadow-emerald-950/20">
        <div className="relative z-10 flex items-start gap-3.5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black text-white backdrop-blur-md ring-2 ring-white/30 shadow-md">
            {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : <User className="h-8 w-8" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-black tracking-tight text-white truncate">
                {profile?.display_name || 'Resident Citizen'}
              </h1>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950 shadow-xs">
                {role}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-emerald-100/90">{profile?.email || 'Registered Citizen'}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-emerald-100">
              <span className="rounded-md bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                +91 {profile?.phone || 'Not registered'}
              </span>
              {profile?.aadhaar && (
                <span className="rounded-md bg-white/15 px-2 py-0.5 backdrop-blur-sm">
                  Aadhaar: •••• •••• {profile.aadhaar.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-3">
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
              <h2 className="text-xs font-bold text-amber-950">Role Switcher (Admin Power)</h2>
            </div>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-900">
              Active: {role.toUpperCase()}
            </span>
          </div>

          <p className="mt-1 text-[11px] text-amber-800">
            Preview the application under different village roles instantly:
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleRoleToggle('citizen')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 font-bold transition active:scale-95 ${
                role === 'citizen'
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span className="text-[10px]">Citizen</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleToggle('sarpanch')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 font-bold transition active:scale-95 ${
                role === 'sarpanch'
                  ? 'border-emerald-700 bg-emerald-700 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span className="text-[10px]">Sarpanch</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleToggle('admin')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 font-bold transition active:scale-95 ${
                role === 'admin'
                  ? 'border-amber-500 bg-amber-500 text-amber-950 shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Crown className="h-3.5 w-3.5" />
              <span className="text-[10px]">Admin</span>
            </button>
          </div>
        </section>
      )}

      {/* ADMIN ONLY: Global Action Alert */}
      {adminActionMsg && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200 animate-slide-up">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{adminActionMsg}</span>
        </div>
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

          <div className="mt-3 space-y-2">
            {adminRequests
              .filter((r) => r.status === 'pending')
              .map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-2xs space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{req.display_name}</p>
                      <p className="text-[10px] text-slate-500">+91 {req.phone} • {req.email}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">
                      Pending
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={actionReqId === req.id}
                      onClick={() => handleResolveAdmin(req.id, true)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" />
                      Approve Admin
                    </button>
                    <button
                      type="button"
                      disabled={actionReqId === req.id}
                      onClick={() => handleResolveAdmin(req.id, false)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ADMIN ONLY: All Users Management Directory */}
      {isAdmin && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900">User Management & Controls</h2>
            </div>
            <button
              type="button"
              onClick={loadAdminUsers}
              className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            As Admin, you can view all registered citizens & Sarpanch, block/unblock accounts, and reset passwords.
          </p>

          {loadingUsers ? (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-600" />
              <span className="text-[11px] text-slate-400 mt-1 block">Loading users…</span>
            </div>
          ) : allUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
              No registered users found.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {allUsers.map((u) => {
                const isSelf = u.id === profile?.id;
                return (
                  <div
                    key={u.id}
                    className={`rounded-2xl border p-3 space-y-2 transition ${
                      u.blocked
                        ? 'border-rose-200 bg-rose-50/40'
                        : 'border-slate-100 bg-slate-50/70 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-slate-900">{u.display_name}</p>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                              u.role === 'admin'
                                ? 'bg-amber-100 text-amber-900'
                                : u.role === 'sarpanch'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {u.role}
                          </span>
                          {u.blocked && (
                            <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                              Blocked
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {u.email} {u.phone ? `• +91 ${u.phone}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Admin Action buttons for this user */}
                    {!isSelf && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                        {/* Block/Unblock toggle */}
                        <button
                          type="button"
                          disabled={userStatusBusy === u.id}
                          onClick={() => handleToggleBlock(u)}
                          className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold transition active:scale-95 ${
                            u.blocked
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                        >
                          <Ban className="h-3 w-3" />
                          <span>{u.blocked ? 'Unblock User' : 'Block User'}</span>
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          onClick={() => {
                            setResetModalUser(u);
                            setAdminNewPassword('Palle@123');
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 active:scale-95"
                        >
                          <KeyRound className="h-3 w-3 text-slate-500" />
                          <span>Reset Password</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Edit Profile Details & Aadhaar (Editable ONLY after clicking Edit button) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Personal Details</h2>
          </div>

          {/* EDIT BUTTON TOGGLE */}
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition active:scale-95"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit Profile</span>
            </button>
          )}
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
          {/* Full Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={name}
                disabled={!isEditing}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name"
                className={`w-full rounded-2xl border py-2.5 pl-10 pr-3.5 text-sm font-medium outline-none transition ${
                  isEditing
                    ? 'border-emerald-500 bg-white text-slate-900 ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                }`}
                required
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Mobile Number</label>
            <div className="flex items-center gap-2">
              <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-600">
                +91
              </span>
              <div className="relative flex-1">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  disabled={!isEditing}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit mobile number"
                  className={`w-full rounded-2xl border py-2.5 pl-10 pr-3.5 text-sm font-medium outline-none transition ${
                    isEditing
                      ? 'border-emerald-500 bg-white text-slate-900 ring-2 ring-emerald-100'
                      : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                  }`}
                  required
                />
              </div>
            </div>
          </div>

          {/* Aadhaar Number (Update after login) */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Aadhaar Number (12 Digits)
            </label>
            <div className="relative">
              <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                maxLength={14}
                value={aadhaar}
                disabled={!isEditing}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                  const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                  setAadhaar(formatted);
                }}
                placeholder="XXXX XXXX XXXX"
                className={`w-full rounded-2xl border py-2.5 pl-10 pr-3.5 text-sm font-semibold tracking-wider outline-none transition ${
                  isEditing
                    ? 'border-emerald-500 bg-white text-slate-900 ring-2 ring-emerald-100'
                    : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                }`}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Used for resident record verification in Tandlam Panchayat.
            </p>
          </div>

          {/* Email (Read Only) */}
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

          {/* SAVE & CANCEL BUTTONS (Visible ONLY during editing) */}
          {isEditing && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setName(profile?.display_name || '');
                  setPhone(profile?.phone || '');
                  setAadhaar(profile?.aadhaar || '');
                  setIsEditing(false);
                  setDetailsError(null);
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition active:scale-95"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDetails || !name.trim() || phone.length !== 10}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-md transition hover:bg-emerald-800 active:scale-95 disabled:opacity-50"
              >
                {savingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Changes</span>
              </button>
            </div>
          )}
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
                placeholder="At least 6 characters"
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
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-2xl border border-slate-200 py-2.5 px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={updatingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {updatingPassword ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* Logout Card */}
      <section className="rounded-3xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-rose-950">Log Out of App</h2>
            <p className="mt-0.5 text-xs text-rose-800/80">Sign out of your resident account</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-rose-600/30 transition hover:bg-rose-700 active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </section>

      {/* ADMIN RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div
          onClick={() => setResetModalUser(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl animate-scale-up space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-black">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Admin Reset Password</h3>
                  <p className="text-[10px] text-slate-500">For {resetModalUser.display_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                New Password for User:
              </label>
              <input
                type="text"
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs font-mono font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Default suggested: Palle@123. The user can log in with this new password immediately.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resettingPassword || adminNewPassword.length < 6}
                onClick={handleAdminResetPassword}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-amber-950 shadow-md shadow-amber-500/30 hover:bg-amber-600 disabled:opacity-50"
              >
                {resettingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Set Password</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
