import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  getPendingAdminRequests,
  resolveAdminRequest,
  supabase,
  type AdminApprovalRequest,
  type Official,
  type UserRole,
} from '@/lib/supabase';

type AdminTab = 'users' | 'officials' | 'requests';
type AdminUser = {
  id: string;
  display_name: string;
  age: number | null;
  gender: string | null;
  phone: string;
  role: UserRole;
  created_at: string;
};

interface AdminConsoleProps {
  onBack: () => void;
}

const EMPTY_USER: Omit<AdminUser, 'id' | 'created_at'> = {
  display_name: '', age: null, gender: null, phone: '', role: 'citizen',
};
const EMPTY_OFFICIAL: Omit<Official, 'id' | 'created_at' | 'order_num'> = {
  name: '', role: 'sarpanch', role_label: 'Sarpanch', phone: '', photo_url: null, jurisdiction: '',
};

export default function AdminConsole({ onBack }: AdminConsoleProps) {
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [officials, setOfficials] = useState<Official[]>([]);
  const [requests, setRequests] = useState<AdminApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [inviteUser, setInviteUser] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [editingOfficial, setEditingOfficial] = useState<Official | null>(null);
  const [officialEditorOpen, setOfficialEditorOpen] = useState(false);
  const [officialForm, setOfficialForm] = useState(EMPTY_OFFICIAL);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [userResult, officialResult, pendingRequests] = await Promise.all([
      supabase.from('profiles').select('id, display_name, age, gender, phone, role, created_at').order('created_at', { ascending: false }),
      supabase.from('officials').select('*').order('order_num', { ascending: true }),
      getPendingAdminRequests(),
    ]);
    if (userResult.error) setError(userResult.error.message);
    else setUsers((userResult.data ?? []) as AdminUser[]);
    if (officialResult.error) setError((previous) => previous || officialResult.error.message);
    else setOfficials((officialResult.data ?? []) as Official[]);
    setRequests(pendingRequests);
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  const resetMessages = () => { setError(null); setSuccess(null); };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    const cleanName = userForm.display_name.trim();
    const cleanPhone = userForm.phone.replace(/\D/g, '');
    if (!cleanName || cleanPhone.length !== 10 || !Number.isInteger(userForm.age) || (userForm.age ?? 0) < 1 || (userForm.age ?? 0) > 120 || !userForm.gender) {
      setError('Enter the name, age, gender, and a valid 10-digit phone number.');
      return;
    }

    setBusy(true);
    if (inviteUser) {
      const { error: inviteError } = await supabase.functions.invoke('admin-manage-user', {
        body: { action: 'create', display_name: cleanName, age: userForm.age, gender: userForm.gender, phone: cleanPhone, role: userForm.role },
      });
      if (inviteError) {
        setError(inviteError.message);
        setBusy(false);
        return;
      }
      setSuccess('Account created. The user must verify this mobile number with OTP before signing in.');
    } else if (editingUser) {
      const { error: updateError } = await supabase.functions.invoke('admin-manage-user', {
        body: {
          action: 'update',
          user_id: editingUser.id,
          display_name: cleanName,
          age: userForm.age,
          gender: userForm.gender,
          phone: cleanPhone,
          role: userForm.role,
        },
      });
      if (updateError) {
        setError(updateError.message);
        setBusy(false);
        return;
      }
      setSuccess('User details and permissions updated.');
    }
    setBusy(false);
    setEditingUser(null);
    setInviteUser(false);
    setUserForm(EMPTY_USER);
    await loadData();
  };

  const removeUser = async (user: AdminUser) => {
    if (!window.confirm(`Remove ${user.display_name || user.phone} and their sign-in account? This cannot be undone.`)) return;
    resetMessages();
    setBusy(true);
    const { error: removeError } = await supabase.functions.invoke('admin-manage-user', {
      body: { action: 'delete', user_id: user.id },
    });
    setBusy(false);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    setSuccess('User account removed.');
    await loadData();
  };

  const saveOfficial = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!officialForm.name.trim() || !officialForm.role_label.trim() || !officialForm.phone.trim()) {
      setError('Name, title, and phone number are required.');
      return;
    }
    setBusy(true);
    const values = {
      name: officialForm.name.trim(),
      role: officialForm.role.trim() || 'official',
      role_label: officialForm.role_label.trim(),
      phone: officialForm.phone.trim(),
      jurisdiction: officialForm.jurisdiction?.trim() || null,
      photo_url: officialForm.photo_url?.trim() || null,
    };
    const result = editingOfficial
      ? await supabase.from('officials').update(values).eq('id', editingOfficial.id)
      : await supabase.from('officials').insert({ ...values, order_num: officials.length + 1 });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSuccess(editingOfficial ? 'Official details updated.' : 'Official added to the village directory.');
    setEditingOfficial(null);
    setOfficialEditorOpen(false);
    setOfficialForm(EMPTY_OFFICIAL);
    await loadData();
  };

  const removeOfficial = async (official: Official) => {
    if (!window.confirm(`Remove ${official.name} from the village directory?`)) return;
    resetMessages();
    const { error: removeError } = await supabase.from('officials').delete().eq('id', official.id);
    if (removeError) setError(removeError.message);
    else {
      setSuccess('Official removed from the directory.');
      await loadData();
    }
  };

  const reviewRequest = async (request: AdminApprovalRequest, approve: boolean) => {
    setBusy(true);
    resetMessages();
    const result = await resolveAdminRequest(request.user_id, approve);
    setBusy(false);
    if (!result.success) setError(result.error || 'Could not update the access request.');
    else {
      setSuccess(approve ? 'Administrator access granted.' : 'Administrator request declined.');
      setRequests(await getPendingAdminRequests());
      if (approve) await loadData();
    }
  };

  const startEditUser = (user: AdminUser) => {
    resetMessages();
    setInviteUser(false);
    setEditingUser(user);
    setUserForm({ display_name: user.display_name, age: user.age, gender: user.gender, phone: user.phone, role: user.role });
  };

  const startInvite = () => {
    resetMessages();
    setEditingUser(null);
    setInviteUser(true);
    setUserForm(EMPTY_USER);
  };

  const startEditOfficial = (official: Official) => {
    resetMessages();
    setEditingOfficial(official);
    setOfficialEditorOpen(true);
    setOfficialForm({ name: official.name, role: official.role, role_label: official.role_label, phone: official.phone, photo_url: official.photo_url, jurisdiction: official.jurisdiction });
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"><ArrowLeft className="h-3.5 w-3.5" /> Back to account</button>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-700" /><p className="text-xs font-bold uppercase tracking-[.14em] text-amber-800">Administrator only</p></div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Manage village access</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Edit user roles and details, maintain the official directory, and review administrator requests.</p>
        </div>
        {tab === 'users' && <button type="button" onClick={startInvite} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add user</button>}
        {tab === 'officials' && <button type="button" onClick={() => { setEditingOfficial(null); setOfficialForm(EMPTY_OFFICIAL); setOfficialEditorOpen(true); resetMessages(); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add official</button>}
      </div>

      {(error || success) && <div role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || success}</div>}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {([
          ['users', `Users · ${users.length}`, UsersRound],
          ['officials', `Officials · ${officials.length}`, Building2],
          ['requests', `Access requests · ${requests.length}`, ShieldCheck],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => { setTab(key); resetMessages(); }} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${tab === key ? 'bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>

      {tab === 'users' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Resident and staff accounts</h2><p className="mt-1 text-xs text-slate-500">Role changes are enforced by the database. Only admins can see contact details.</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500"><tr><th className="px-5 py-3">User</th><th className="px-4 py-3">Age · gender</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => <tr key={user.id} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-900"><UserRound className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{user.display_name || 'No name set'}</span><span className="mt-0.5 block truncate text-slate-500">ID {user.id}</span></span></div></td>
                  <td className="px-4 py-3.5 text-slate-600">{user.age ?? '—'} · {user.gender?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3.5 text-slate-600">{user.phone ? `+91 ${user.phone}` : '—'}</td>
                  <td className="px-4 py-3.5"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold capitalize text-slate-700">{user.role}</span></td>
                  <td className="px-4 py-3.5 text-slate-500">{new Date(user.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><button type="button" title="Edit user" onClick={() => startEditUser(user)} className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-900"><Pencil className="h-4 w-4" /></button><button type="button" title="Remove user" disabled={busy} onClick={() => void removeUser(user)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {users.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No user profiles were found.</p>}
        </section>
      )}

      {tab === 'officials' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Village directory</h2><p className="mt-1 text-xs text-slate-500">Directory information is public. Only admins can change these records.</p></div>
          <div className="divide-y divide-slate-100">
            {officials.map((official) => <div key={official.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-800"><Building2 className="h-4 w-4" /></div>
              <div className="min-w-[180px] flex-1"><p className="text-sm font-semibold text-slate-900">{official.name}</p><p className="mt-0.5 text-xs text-slate-500">{official.role_label}{official.jurisdiction ? ` · ${official.jurisdiction}` : ''}</p></div>
              <a href={`tel:${official.phone}`} className="text-xs font-medium text-slate-600 hover:text-emerald-800">{official.phone}</a>
              <div className="ml-auto flex gap-1"><button type="button" title="Edit official" onClick={() => startEditOfficial(official)} className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-900"><Pencil className="h-4 w-4" /></button><button type="button" title="Remove official" onClick={() => void removeOfficial(official)} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button></div>
            </div>)}
            {officials.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">The directory is empty. Add your verified village contacts.</p>}
          </div>
        </section>
      )}

      {tab === 'requests' && (
        <section className="space-y-3">
          {requests.map((request) => <div key={request.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><ShieldCheck className="h-4 w-4" /></div>
            <div className="min-w-[220px] flex-1"><p className="text-sm font-semibold text-slate-900">{request.display_name || 'Resident'}</p><p className="mt-1 text-xs text-slate-500">{request.phone ? `+91 ${request.phone}` : ''}</p></div>
            <button type="button" disabled={busy} onClick={() => void reviewRequest(request, false)} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Decline</button>
            <button type="button" disabled={busy} onClick={() => void reviewRequest(request, true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Grant admin</button>
          </div>)}
          {requests.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><ShieldCheck className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No pending access requests</p><p className="mt-1 text-xs text-slate-500">New administrator requests will appear here.</p></div>}
        </section>
      )}

      {(inviteUser || editingUser) && (
        <Modal title={inviteUser ? 'Add a user' : 'Edit user access'} onClose={() => { setInviteUser(false); setEditingUser(null); resetMessages(); }}>
          <form onSubmit={(event) => void saveUser(event)} className="space-y-4">
            <Field label="Full name" icon={<UserRound className="h-4 w-4" />}><input value={userForm.display_name} onChange={(event) => setUserForm({ ...userForm, display_name: event.target.value })} placeholder="Full name" className="admin-input" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label">Age</label><input type="number" min={1} max={120} value={userForm.age ?? ''} onChange={(event) => setUserForm({ ...userForm, age: event.target.value ? Number(event.target.value) : null })} className="admin-input mt-2" required /></div><div><label className="field-label">Gender</label><select value={userForm.gender ?? ''} onChange={(event) => setUserForm({ ...userForm, gender: event.target.value || null })} className="admin-input mt-2" required><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></div></div>
            <Field label="Mobile number" icon={<span className="text-xs font-semibold">+91</span>}><input type="tel" maxLength={10} value={userForm.phone} onChange={(event) => setUserForm({ ...userForm, phone: event.target.value.replace(/\D/g, '') })} placeholder="10-digit number" className="admin-input" required /></Field>
            <div><label className="field-label">Account role</label><select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as UserRole })} className="admin-input mt-2"><option value="citizen">Citizen</option><option value="official">Official</option><option value="admin">Administrator</option></select></div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => { setInviteUser(false); setEditingUser(null); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{inviteUser ? 'Create account' : 'Save changes'}</button></div>
          </form>
        </Modal>
      )}

      {officialEditorOpen && (
        <Modal title={editingOfficial ? 'Edit directory entry' : 'Add village official'} onClose={() => { setEditingOfficial(null); setOfficialEditorOpen(false); setOfficialForm(EMPTY_OFFICIAL); }}>
          <form onSubmit={(event) => void saveOfficial(event)} className="space-y-4">
            <Field label="Full name" icon={<UserRound className="h-4 w-4" />}><input value={officialForm.name} onChange={(event) => setOfficialForm({ ...officialForm, name: event.target.value })} placeholder="Official's name" className="admin-input" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Role key" icon={<Building2 className="h-4 w-4" />}><input value={officialForm.role} onChange={(event) => setOfficialForm({ ...officialForm, role: event.target.value })} placeholder="sarpanch" className="admin-input" required /></Field><Field label="Display title" icon={<Building2 className="h-4 w-4" />}><input value={officialForm.role_label} onChange={(event) => setOfficialForm({ ...officialForm, role_label: event.target.value })} placeholder="Sarpanch" className="admin-input" required /></Field></div>
            <Field label="Phone" icon={<span className="text-xs">☎</span>}><input type="tel" value={officialForm.phone} onChange={(event) => setOfficialForm({ ...officialForm, phone: event.target.value })} placeholder="Verified phone number" className="admin-input" required /></Field>
            <Field label="Jurisdiction" icon={<Building2 className="h-4 w-4" />}><input value={officialForm.jurisdiction || ''} onChange={(event) => setOfficialForm({ ...officialForm, jurisdiction: event.target.value })} placeholder="Village, ward, or service area" className="admin-input" /></Field>
            <Field label="Photo URL (optional)" icon={<UserRound className="h-4 w-4" />}><input type="url" value={officialForm.photo_url || ''} onChange={(event) => setOfficialForm({ ...officialForm, photo_url: event.target.value })} placeholder="https://…" className="admin-input" /></Field>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => { setEditingOfficial(null); setOfficialEditorOpen(false); setOfficialForm(EMPTY_OFFICIAL); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editingOfficial ? 'Save details' : 'Add official'}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div><label className="field-label">{label}</label><div className="relative mt-2"><span className="field-icon flex items-center justify-center">{icon}</span>{children}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-xl rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl animate-slide-up sm:rounded-3xl sm:p-7">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button></div>
      {children}
    </section>
  </div>;
}
