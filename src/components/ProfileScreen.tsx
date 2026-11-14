import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Ban, CheckCircle2, Crown, KeyRound, Loader2, LogOut,
  Mail, Pencil, Phone, RotateCcw, Save, ShieldCheck, Trash2, User,
  UserRoundCheck, UserPlus, Settings,
} from 'lucide-react';
import { supabase, saveProfileDetails, fetchAllUsersForAdmin, adminUpdateUser, adminEditUser, adminInviteUser, adminResetUserPassword, type UserProfile, type UserRole } from '@/lib/supabase';

interface ProfileScreenProps {
  profile: UserProfile;
  onSignOut: () => void;
  onOpenSettings: () => void;
}

const roles: UserRole[] = ['citizen', 'sarpanch', 'admin'];

export default function ProfileScreen({ profile: initialProfile, onSignOut, onOpenSettings }: ProfileScreenProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(initialProfile.display_name);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: number; action: string; subject_id: string | null; details: Record<string, unknown>; created_at: string }>>([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [userAction, setUserAction] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('citizen');
  const [inviting, setInviting] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');

  useEffect(() => {
    setProfile(initialProfile);
    setName(initialProfile.display_name);
    setPhone(initialProfile.phone);
  }, [initialProfile]);

  const loadUsers = useCallback(async () => {
    setUsersBusy(true);
    try {
      setUsers(await fetchAllUsersForAdmin());
      const { data: auditData, error: auditError } = await supabase.from('audit_logs').select('id,action,subject_id,details,created_at').order('created_at', { ascending: false }).limit(30);
      if (auditError) throw new Error(auditError.message);
      setAuditLogs((auditData ?? []) as typeof auditLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load user accounts.');
    } finally {
      setUsersBusy(false);
    }
  }, []);

  useEffect(() => {
    if (profile.role === 'admin') void loadUsers();
  }, [profile.role, loadUsers]);

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (cleanPhone.length !== 10) return setError('Enter a valid 10-digit mobile number.');
    setSaving(true);
    const result = await saveProfileDetails(profile.id, { display_name: name.trim(), phone: cleanPhone });
    setSaving(false);
    if (!result.success) return setError(result.error || 'Could not save profile changes.');
    const updated = { ...profile, display_name: name.trim(), phone: cleanPhone };
    setProfile(updated);
    setEditing(false);
    setMessage('Profile updated.');
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    setPasswordBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPasswordBusy(false);
    if (updateError) return setError(updateError.message);
    setPassword('');
    setConfirmPassword('');
    setMessage('Password changed.');
  };

  const updateUser = async (user: UserProfile, updates: { role?: UserRole; blocked?: boolean; is_active?: boolean }) => {
    if (user.id === profile.id && (updates.role || updates.blocked || updates.is_active === false)) return;
    setUserAction(user.id);
    setError('');
    const result = await adminUpdateUser(user.id, updates);
    if (result.success) {
      setUsers((current) => current.map((entry) => entry.id === user.id ? { ...entry, ...updates } : entry));
      setMessage(`${user.display_name}'s account was updated.`);
    } else {
      setError(result.error || 'Account update failed.');
    }
    setUserAction(null);
  };

  const sendPasswordReset = async (user: UserProfile) => {
    setUserAction(user.id);
    const result = await adminResetUserPassword(user.id, user.email);
    if (result.success) setMessage(`Password reset instructions sent to ${user.email}.`);
    else setError(result.error || 'Could not send a reset link.');
    setUserAction(null);
  };

  const inviteUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setInviting(true);
    const result = await adminInviteUser({
      email: inviteEmail.trim().toLowerCase(),
      display_name: inviteName.trim(),
      phone: invitePhone.replace(/\D/g, ''),
      role: inviteRole,
    });
    setInviting(false);
    if (!result.success) return setError(result.error || 'Could not create the account.');
    setShowInvite(false);
    setInviteName('');
    setInvitePhone('');
    setInviteEmail('');
    setMessage(result.message || 'Invitation sent.');
    void loadUsers();
  };

  const saveAdminUserDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editUser) return;
    const cleanPhone = editUserPhone.replace(/\D/g, '');
    if (editUserName.trim().length < 2 || cleanPhone.length !== 10) return setError('Enter a name and a valid 10-digit phone number.');
    setUserAction(editUser.id);
    const result = await adminEditUser(editUser.id, { display_name: editUserName.trim(), phone: cleanPhone });
    setUserAction(null);
    if (!result.success) return setError(result.error || 'Could not update user details.');
    setUsers((current) => current.map((user) => user.id === editUser.id ? { ...user, display_name: editUserName.trim(), phone: cleanPhone } : user));
    setMessage(`${editUserName.trim()}'s details were updated.`);
    setEditUser(null);
  };

  const deleteUser = async (user: UserProfile) => {
    if (user.id === profile.id || !window.confirm(`Deactivate and archive ${user.display_name}'s account?`)) return;
    setUserAction(user.id);
    const { error: deleteError } = await supabase.rpc('admin_soft_delete_user', { p_user_id: user.id });
    if (deleteError) setError(deleteError.message);
    else {
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      setMessage(`${user.display_name}'s account was archived.`);
    }
    setUserAction(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12 animate-fade-in">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900 p-5 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
            <User className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black">{profile.display_name || 'Village resident'}</h1>
              <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-black uppercase text-amber-950">{profile.role}</span>
            </div>
            <p className="mt-1 truncate text-sm text-emerald-100">{profile.email}</p>
            <p className="mt-0.5 text-xs text-emerald-100">+91 {profile.phone || 'Mobile number not added'}</p>
          </div>
          <button onClick={onSignOut} className="rounded-xl bg-white/10 p-2.5 hover:bg-white/20" aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </section>

      {(message || error) && (
        <div className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          {error || message}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-slate-900"><UserRoundCheck className="h-4 w-4 text-emerald-700" />Personal details</h2>
            <button onClick={() => { setEditing((value) => !value); setName(profile.display_name); setPhone(profile.phone); }} className="rounded-lg p-2 text-emerald-800 hover:bg-emerald-50" aria-label="Edit details">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={saveDetails} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">Full name
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!editing} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 disabled:opacity-80" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Mobile number
              <div className="relative mt-1"><Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editing} inputMode="numeric" maxLength={14} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 disabled:opacity-80" /></div>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Email
              <div className="relative mt-1"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={profile.email} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-3 text-sm text-slate-500" /></div>
            </label>
            {editing && <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save details'}</button>}
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-slate-900"><KeyRound className="h-4 w-4 text-emerald-700" />Change password</h2>
          <form onSubmit={changePassword} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">New password
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Confirm password
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
            <button disabled={passwordBusy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
              {passwordBusy && <Loader2 className="h-4 w-4 animate-spin" />}Update password
            </button>
          </form>
        </section>
      </div>

      {profile.role === 'admin' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-900"><Crown className="h-4 w-4 text-amber-600" />Account management</h2>
              <p className="mt-1 text-xs text-slate-500">Manage access and roles for registered accounts.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowInvite(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"><UserPlus className="h-3.5 w-3.5" />Add account</button>
              <button onClick={() => void loadUsers()} disabled={usersBusy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"><RotateCcw className={`h-3.5 w-3.5 ${usersBusy ? 'animate-spin' : ''}`} />Refresh</button>
            </div>
          </div>
          {usersBusy && <div className="flex items-center gap-2 py-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading accounts…</div>}
          {!usersBusy && users.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No registered accounts found.</p>}
          <div className="space-y-3">
            {users.map((user) => (
              <article key={user.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{user.display_name}</p>
                    {user.blocked && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">Blocked</span>}
                    {user.is_active === false && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">Inactive</span>}
                  </div>
                  <p className="truncate text-xs text-slate-500">{user.email} · +91 {user.phone || 'No phone'}</p>
                  <p className="mt-1 text-[10px] text-slate-400">Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'date unavailable'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={userAction === user.id} onClick={() => { setEditUser(user); setEditUserName(user.display_name); setEditUserPhone(user.phone); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />Edit</button>
                  <select value={user.role} disabled={user.id === profile.id || userAction === user.id} onChange={(e) => void updateUser(user, { role: e.target.value as UserRole })} aria-label={`Role for ${user.display_name}`} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700">
                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <button disabled={user.id === profile.id || userAction === user.id} onClick={() => void updateUser(user, { blocked: !user.blocked })} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><Ban className="h-3.5 w-3.5" />{user.blocked ? 'Unblock' : 'Block'}</button>
                  <button disabled={user.id === profile.id || userAction === user.id} onClick={() => void updateUser(user, { is_active: user.is_active === false })} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5" />{user.is_active === false ? 'Activate' : 'Deactivate'}</button>
                  <button disabled={userAction === user.id || !user.email} onClick={() => void sendPasswordReset(user)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"><KeyRound className="h-3.5 w-3.5" />Reset</button>
                  <button disabled={user.id === profile.id || userAction === user.id} onClick={() => void deleteUser(user)} title="Archive account" className="rounded-lg border border-rose-100 p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Invited users receive a private email link to finish account setup. Passwords are reset through a separate email link.</p>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-indigo-700" />Recent account activity</h3>
            {auditLogs.length === 0 ? <p className="text-xs text-slate-500">No access changes recorded yet.</p> : <div className="max-h-64 space-y-2 overflow-y-auto">{auditLogs.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span className="font-semibold text-slate-700">{item.action.replace(/_/g, ' ')}{item.subject_id && ` · ${item.subject_id.slice(0, 8)}`}</span><time className="text-slate-400">{new Date(item.created_at).toLocaleString()}</time></div>)}</div>}
          </div>
        </section>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <form onSubmit={inviteUser} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-2xl">
            <div><h2 className="text-lg font-black text-slate-900">Invite village account</h2><p className="mt-1 text-xs text-slate-500">An email invitation will be sent to the account owner.</p></div>
            <label className="block text-xs font-semibold text-slate-600">Full name<input required minLength={2} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-semibold text-slate-600">Email<input required type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-semibold text-slate-600">Mobile number<input required inputMode="numeric" maxLength={10} value={invitePhone} onChange={(event) => setInvitePhone(event.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-semibold text-slate-600">Role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as UserRole)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="citizen">Citizen</option><option value="sarpanch">Sarpanch</option><option value="admin">Admin</option></select></label>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setShowInvite(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button disabled={inviting || invitePhone.length !== 10} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{inviting && <Loader2 className="h-4 w-4 animate-spin" />}Send invitation</button></div>
          </form>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={() => setEditUser(null)}>
          <form onSubmit={saveAdminUserDetails} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-2xl">
            <div><h2 className="text-lg font-black text-slate-900">Edit account details</h2><p className="mt-1 text-xs text-slate-500">{editUser.email}</p></div>
            <label className="block text-xs font-semibold text-slate-600">Full name<input required minLength={2} value={editUserName} onChange={(event) => setEditUserName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-semibold text-slate-600">Mobile number<input required inputMode="numeric" maxLength={10} value={editUserPhone} onChange={(event) => setEditUserPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditUser(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button disabled={userAction === editUser.id} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Save changes</button></div>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={onOpenSettings} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4" />Settings</button>
        <button onClick={onSignOut} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </div>
  );
}
