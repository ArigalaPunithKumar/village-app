import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Keep an inert client available so the UI can render a setup message instead
// of crashing when a local build has no project configuration.
export const supabase = createClient(
  supabaseUrl || 'https://configuration-required.supabase.co',
  supabaseAnonKey || 'configuration_required',
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  },
);

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
  reporter_name?: string;
  reporter_phone?: string | null;
  reporter_user_id?: string | null;
  image_url?: string | null;
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
  updated_by_user_id?: string | null;
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

export type UserRole = 'citizen' | 'official' | 'admin';

export interface UserProfile {
  id: string;
  display_name: string;
  age: number | null;
  gender: string | null;
  phone: string;
  email: string;
  role: UserRole;
  admin_access_status?: 'pending' | 'approved' | 'rejected' | null;
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
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return null;

  let profileData: { display_name: string; age: number | null; gender: string | null; phone: string; email: string; role: UserRole } | null = null;
  let adminAccessStatus: UserProfile['admin_access_status'] = null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, age, gender, phone, email, role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      profileData = {
        display_name: data.display_name || '',
        age: data.age ?? null,
        gender: data.gender || null,
        phone: data.phone || '',
        email: data.email || '',
        role: data.role as UserRole,
      };
    }

    const { data: request, error: requestError } = await supabase
      .from('admin_access_requests')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!requestError) adminAccessStatus = request?.status ?? null;
  } catch (err) {
    console.warn('Could not load the account profile from Supabase', err);
  }

  const meta = user.user_metadata || {};
  const resolvedRole = profileData?.role;
  const profile: UserProfile = {
    id: user.id,
    display_name: profileData?.display_name || meta.display_name || meta.full_name || meta.name || '',
    age: profileData?.age ?? (Number.isInteger(Number(meta.age)) ? Number(meta.age) : null),
    gender: profileData?.gender || (typeof meta.gender === 'string' ? meta.gender : null),
    phone: profileData?.phone || meta.phone || user.phone || '',
    email: profileData?.email || user.email || '',
    role: resolvedRole === 'admin' || resolvedRole === 'official' ? resolvedRole : 'citizen',
    admin_access_status: adminAccessStatus,
    created_at: user.created_at,
  };

  // Remove legacy client-side role caches; role is always read from the database.
  localStorage.removeItem(`palle_profile_${user.id}`);
  localStorage.removeItem('palle_admin_approval_queue');
  return profile;
}

export async function saveProfileDetails(
  userId: string,
  updates: { display_name?: string; age?: number | null; gender?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    const profileUpdates: { display_name?: string; age?: number | null; gender?: string | null } = {};
    if (updates.display_name !== undefined) profileUpdates.display_name = updates.display_name;
    if (updates.age !== undefined) profileUpdates.age = updates.age;
    if (updates.gender !== undefined) profileUpdates.gender = updates.gender;

    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        ...(updates.display_name !== undefined ? { display_name: updates.display_name } : {}),
        ...(updates.age !== undefined ? { age: updates.age } : {}),
        ...(updates.gender !== undefined ? { gender: updates.gender } : {}),
      },
    });
    if (metaError) return { success: false, error: metaError.message };

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);
    if (profileError) return { success: false, error: profileError.message };

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Administrator access requests are persisted and reviewed in Supabase.
export async function getPendingAdminRequests(): Promise<AdminApprovalRequest[]> {
  const { data, error } = await supabase
    .from('admin_access_requests')
    .select('id, user_id, display_name, phone, email, requested_at, status')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) {
    console.error('Could not load administrator access requests', error.message);
    return [];
  }
  return (data ?? []) as AdminApprovalRequest[];
}

export async function registerAdminApprovalRequest(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('request_admin_access');
  return error ? { success: false, error: error.message } : { success: true };
}

export async function resolveAdminRequest(
  userId: string,
  approve: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc('review_admin_access_request', {
    p_user_id: userId,
    p_approve: approve,
  });
  return error ? { success: false, error: error.message } : { success: true };
}
