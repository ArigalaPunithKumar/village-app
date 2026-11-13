import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// ---- Domain types ----

export type ComplaintCategory =
  | 'roads'
  | 'water'
  | 'electricity'
  | 'sanitation'
  | 'street_light'
  | 'drainage'
  | 'waste'
  | 'other';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ComplaintStatus =
  | 'pending'
  | 'under_review'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export interface Complaint {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  location: string | null;
  reporter_name: string;
  reporter_phone: string | null;
  image_url: string | null;
  upvotes: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface StatusUpdate {
  id: number;
  complaint_id: number;
  status: ComplaintStatus;
  note: string | null;
  updated_by: string;
  created_at: string;
}

export interface ComplaintWithUpdates extends Complaint {
  status_updates: StatusUpdate[];
}

// ---- Display metadata ----

export const CATEGORY_META: Record<
  ComplaintCategory,
  { label: string; icon: string; color: string }
> = {
  roads: { label: 'Roads & Potholes', icon: 'road', color: 'amber' },
  water: { label: 'Water Supply', icon: 'droplet', color: 'sky' },
  electricity: { label: 'Electricity', icon: 'zap', color: 'yellow' },
  sanitation: { label: 'Sanitation', icon: 'sparkles', color: 'emerald' },
  street_light: { label: 'Street Lights', icon: 'lightbulb', color: 'violet' },
  drainage: { label: 'Drainage', icon: 'waves', color: 'cyan' },
  waste: { label: 'Waste Management', icon: 'trash', color: 'lime' },
  other: { label: 'Other', icon: 'flag', color: 'slate' },
};

export const PRIORITY_META: Record<
  ComplaintPriority,
  { label: string; color: string; dot: string }
> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export const STATUS_META: Record<
  ComplaintStatus,
  { label: string; color: string; dot: string; description: string }
> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', description: 'Report received, awaiting review' },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', description: 'Officials are reviewing the report' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', description: 'Work has begun on the issue' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', description: 'The problem has been fixed' },
  rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', description: 'Report could not be actioned' },
};

export const STATUS_FLOW: ComplaintStatus[] = [
  'pending',
  'under_review',
  'in_progress',
  'resolved',
];

// ---- Officials ----

export interface Official {
  id: number;
  name: string;
  role: string;
  role_label: string;
  phone: string;
  photo_url: string | null;
  jurisdiction: string | null;
  order_num: number;
  created_at: string;
}

export const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  sarpanch:    { label: 'Sarpanch',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  up_sarpanch: { label: 'Upa-Sarpanch', color: 'text-teal-700',  bg: 'bg-teal-50 border-teal-200' },
  vro:         { label: 'VRO',         color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  mro:         { label: 'MRO',         color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  zptc:        { label: 'ZPTC',        color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  mptc:        { label: 'MPTC',        color: 'text-cyan-700',  bg: 'bg-cyan-50 border-cyan-200' },
  mpdo:        { label: 'MPDO',        color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  default:     { label: 'Official',    color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200' },
};

export function roleMeta(role: string) {
  return ROLE_META[role] ?? ROLE_META.default;
}

// ---- User Profile ----

export type UserRole = 'citizen' | 'sarpanch' | 'admin';
export type UserGender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  display_name: string;
  phone: string;
  email: string;
  gender?: string;
  aadhaar?: string;
  role: UserRole;
  blocked?: boolean;
  pending_admin_approval?: boolean;
  created_at?: string;
}

export interface AdminApprovalRequest {
  id: string;
  user_id: string;
  display_name: string;
  phone: string;
  email: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export async function fetchCurrentProfile(): Promise<UserProfile | null> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return null;

  // Local cache fallback
  const cachedRaw = localStorage.getItem(`palle_profile_${user.id}`);
  const cached = cachedRaw ? JSON.parse(cachedRaw) : null;

  let dbRole: UserRole = 'citizen';
  let dbName = '';
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      if (data.role) dbRole = data.role as UserRole;
      if (data.display_name) dbName = data.display_name;
    }
  } catch (err) {
    console.warn('Could not query profiles table directly', err);
  }

  const meta = user.user_metadata || {};
  const isPendingAdmin = Boolean(meta.pending_admin_approval || cached?.pending_admin_approval);

  // If role is admin in DB, clear pending
  const resolvedRole = (cached?.role as UserRole) || dbRole;

  const profile: UserProfile = {
    id: user.id,
    display_name: dbName || meta.display_name || meta.full_name || cached?.display_name || '',
    phone: meta.phone || user.phone || cached?.phone || '',
    email: user.email || cached?.email || '',
    gender: meta.gender || cached?.gender || '',
    aadhaar: meta.aadhaar || cached?.aadhaar || '',
    role: resolvedRole,
    pending_admin_approval: isPendingAdmin && resolvedRole !== 'admin',
    created_at: user.created_at,
  };

  localStorage.setItem(`palle_profile_${user.id}`, JSON.stringify(profile));
  return profile;
}

export async function saveProfileDetails(
  userId: string,
  updates: { display_name?: string; phone?: string; aadhaar?: string; role?: UserRole; pending_admin_approval?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update Auth metadata
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        ...(updates.display_name !== undefined ? { display_name: updates.display_name } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
        ...(updates.aadhaar !== undefined ? { aadhaar: updates.aadhaar } : {}),
        ...(updates.pending_admin_approval !== undefined ? { pending_admin_approval: updates.pending_admin_approval } : {}),
      },
    });
    if (metaError) {
      console.warn('Error updating auth user metadata:', metaError.message);
    }

    // 2. Update DB profile if possible
    if (updates.display_name !== undefined) {
      await supabase
        .from('profiles')
        .update({ display_name: updates.display_name })
        .eq('id', userId);
    }

    if (updates.role !== undefined) {
      await supabase
        .from('profiles')
        .update({ role: updates.role })
        .eq('id', userId);
    }

    // 3. Cache locally
    const cachedRaw = localStorage.getItem(`palle_profile_${userId}`);
    const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
    const updatedProfile = {
      ...cached,
      ...updates,
    };
    localStorage.setItem(`palle_profile_${userId}`, JSON.stringify(updatedProfile));

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Admin approval queue helpers
export function getPendingAdminRequests(): AdminApprovalRequest[] {
  try {
    const raw = localStorage.getItem('palle_admin_approval_queue');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function registerAdminApprovalRequest(req: { user_id: string; display_name: string; phone: string; email: string }) {
  const existing = getPendingAdminRequests();
  const filtered = existing.filter((r) => r.user_id !== req.user_id);
  filtered.push({
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    user_id: req.user_id,
    display_name: req.display_name,
    phone: req.phone,
    email: req.email,
    requested_at: new Date().toISOString(),
    status: 'pending',
  });
  localStorage.setItem('palle_admin_approval_queue', JSON.stringify(filtered));
}

export function resolveAdminRequest(userId: string, approve: boolean): { success: boolean } {
  const existing = getPendingAdminRequests();
  const updated = existing.map((r) => {
    if (r.user_id === userId) {
      return { ...r, status: approve ? 'approved' : 'rejected' } as AdminApprovalRequest;
    }
    return r;
  });
  localStorage.setItem('palle_admin_approval_queue', JSON.stringify(updated));

  // If approved, update target user profile role
  if (approve) {
    const cachedRaw = localStorage.getItem(`palle_profile_${userId}`);
    if (cachedRaw) {
      const p = JSON.parse(cachedRaw);
      p.role = 'admin';
      p.pending_admin_approval = false;
      localStorage.setItem(`palle_profile_${userId}`, JSON.stringify(p));
    }
    supabase.from('profiles').update({ role: 'admin' }).eq('id', userId).then(() => {});
  }
  return { success: true };
}

// -------------------------------------------------------------
// Admin Privileges & User Management
// -------------------------------------------------------------

export async function checkIfFirstAdmin(): Promise<boolean> {
  try {
    // Check Supabase profiles for any existing admin
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin');
    
    if (!error && typeof count === 'number') {
      if (count > 0) return false;
    }

    // Check local registry
    const registryRaw = localStorage.getItem('palle_user_registry');
    if (registryRaw) {
      const registry: any[] = JSON.parse(registryRaw);
      const hasAdmin = registry.some((u) => u.role === 'admin');
      if (hasAdmin) return false;
    }

    return true; // No admin exists yet -> this will be the first admin
  } catch {
    return true;
  }
}

export async function fetchAllUsersForAdmin(): Promise<UserProfile[]> {
  const usersMap = new Map<string, UserProfile>();

  // 1. Load from local registry
  try {
    const raw = localStorage.getItem('palle_user_registry');
    if (raw) {
      const list: any[] = JSON.parse(raw);
      list.forEach((u) => {
        usersMap.set(u.email?.toLowerCase() || u.id, {
          id: u.id || `user_${u.email}`,
          display_name: u.display_name || 'Resident',
          phone: u.phone || '',
          email: u.email || '',
          role: u.role || 'citizen',
          gender: u.gender,
          aadhaar: u.aadhaar,
          blocked: Boolean(u.blocked),
          created_at: u.created_at || new Date().toISOString(),
        });
      });
    }
  } catch {}

  // 2. Fetch from Supabase profiles
  try {
    const { data } = await supabase.from('profiles').select('*');
    if (data && Array.isArray(data)) {
      data.forEach((p: any) => {
        const key = p.email?.toLowerCase() || p.id;
        const existing = usersMap.get(key);
        usersMap.set(key, {
          id: p.id,
          display_name: p.display_name || existing?.display_name || 'User',
          phone: p.phone || existing?.phone || '',
          email: p.email || existing?.email || '',
          role: (p.role as UserRole) || existing?.role || 'citizen',
          gender: p.gender || existing?.gender,
          aadhaar: p.aadhaar || existing?.aadhaar,
          blocked: p.blocked !== undefined ? Boolean(p.blocked) : existing?.blocked || false,
          created_at: p.created_at || existing?.created_at,
        });
      });
    }
  } catch (err) {
    console.warn('Could not fetch profiles for admin:', err);
  }

  return Array.from(usersMap.values());
}

export async function adminToggleBlockUser(
  userId: string,
  userEmail: string,
  blocked: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update in local registry
    const raw = localStorage.getItem('palle_user_registry');
    if (raw) {
      const list: any[] = JSON.parse(raw);
      const updated = list.map((u) => {
        if (u.id === userId || u.email?.toLowerCase() === userEmail.toLowerCase()) {
          return { ...u, blocked };
        }
        return u;
      });
      localStorage.setItem('palle_user_registry', JSON.stringify(updated));
    }

    // 2. Update user profile cache
    const cachedRaw = localStorage.getItem(`palle_profile_${userId}`);
    if (cachedRaw) {
      const p = JSON.parse(cachedRaw);
      p.blocked = blocked;
      localStorage.setItem(`palle_profile_${userId}`, JSON.stringify(p));
    }

    // 3. Update Supabase
    try {
      await supabase.from('profiles').update({ blocked }).eq('id', userId);
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update user status';
    return { success: false, error: msg };
  }
}

export async function adminResetUserPassword(
  userId: string,
  userEmail: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // 1. Update in local registry
    const raw = localStorage.getItem('palle_user_registry');
    if (raw) {
      const list: any[] = JSON.parse(raw);
      const updated = list.map((u) => {
        if (u.id === userId || u.email?.toLowerCase() === userEmail.toLowerCase()) {
          return { ...u, password: newPassword };
        }
        return u;
      });
      localStorage.setItem('palle_user_registry', JSON.stringify(updated));
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reset password';
    return { success: false, error: msg };
  }
}

export async function adminDeleteComplaint(
  complaintId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete associated status updates
    try {
      await supabase.from('status_updates').delete().eq('complaint_id', complaintId);
    } catch {}

    // 2. Delete complaint
    const { error } = await supabase.from('complaints').delete().eq('id', complaintId);
    if (error) {
      console.warn('Supabase delete complaint error:', error);
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete report';
    return { success: false, error: msg };
  }
}
