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
  | 'infrastructure'
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
  evidence_url?: string | null;
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
  infrastructure: { label: 'Public Infrastructure', icon: 'road', color: 'amber' },
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
  pending: { label: 'Submitted', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', description: 'Report received, awaiting review' },
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
  is_active?: boolean;
  pending_admin_approval?: boolean;
  created_at?: string;
}

export async function fetchCurrentProfile(): Promise<UserProfile | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user || authError) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, role, phone, email, blocked, is_active, deleted_at, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) {
    console.warn('Could not load the authenticated profile:', error?.message);
    return null;
  }

  const profile: UserProfile = {
    id: user.id,
    display_name: data.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name || '',
    phone: data.phone || user.phone || '',
    email: data.email || user.email || '',
    role: data.role as UserRole,
    blocked: Boolean(data.blocked),
    is_active: Boolean(data.is_active) && !data.deleted_at,
    created_at: data.created_at || user.created_at,
  };
  localStorage.setItem(`palle_profile_${user.id}`, JSON.stringify(profile));
  return profile;
}

export async function saveProfileDetails(
  userId: string,
  updates: { display_name?: string; phone?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) return { success: false, error: error.message };
    const cachedRaw = localStorage.getItem(`palle_profile_${userId}`);
    const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
    const updatedProfile = {
      ...cached,
      ...updates,
    };
    localStorage.setItem(`palle_profile_${userId}`, JSON.stringify(updatedProfile));
    localStorage.setItem('palle_current_user', JSON.stringify(updatedProfile));

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export async function fetchAllUsersForAdmin(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, phone, email, role, blocked, is_active, created_at, deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    display_name: row.display_name || 'Resident',
    phone: row.phone || '',
    email: row.email || '',
    role: row.role as UserRole,
    blocked: Boolean(row.blocked),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  }));
}

export async function adminUpdateUser(
  userId: string,
  updates: { role?: UserRole; blocked?: boolean; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_update_user', {
    p_user_id: userId,
    p_role: updates.role ?? null,
    p_blocked: updates.blocked ?? null,
    p_is_active: updates.is_active ?? null,
  });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function adminToggleBlockUser(
  userId: string,
  _userEmail: string,
  blocked: boolean
): Promise<{ success: boolean; error?: string }> {
  return adminUpdateUser(userId, { blocked });
}

export async function adminEditUser(
  userId: string,
  updates: { display_name: string; phone: string }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  return error ? { success: false, error: error.message } : { success: true };
}

export async function adminInviteUser(input: {
  email: string;
  display_name: string;
  phone: string;
  role: UserRole;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action: 'invite', ...input },
  });
  if (error) return { success: false, error: error.message };
  return { success: Boolean(data?.success), message: data?.message, error: data?.error };
}

export async function adminResetUserPassword(
  userId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action: 'reset-password', user_id: userId, email: userEmail },
  });
  if (error) return { success: false, error: error.message };
  return data?.success ? { success: true } : { success: false, error: data?.error || 'Could not send a reset link.' };
}

export async function adminDeleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_soft_delete_user', { p_user_id: userId });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function adminDeleteComplaint(complaintId: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('admin_soft_delete_complaint', { p_complaint_id: complaintId });
  return error ? { success: false, error: error.message } : { success: true };
}
