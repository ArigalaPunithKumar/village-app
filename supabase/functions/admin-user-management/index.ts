import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in as an administrator' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server configuration is incomplete' }, 500);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Sign in as an administrator' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actor } = await admin.from('profiles').select('role, blocked, is_active, deleted_at')
    .eq('id', authData.user.id).maybeSingle();
  if (!actor || actor.role !== 'admin' || actor.blocked || !actor.is_active || actor.deleted_at) {
    return json({ error: 'Admin role required' }, 403);
  }

  try {
    const body = await request.json();
    const action = body.action;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address' }, 400);

    if (action === 'invite') {
      const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
      const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
      const role = body.role;
      if (displayName.length < 2 || phone.length !== 10 || !['citizen', 'sarpanch', 'admin'].includes(role)) {
        return json({ error: 'Provide a name, a 10-digit phone, and a valid role' }, 400);
      }
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { display_name: displayName, phone },
        redirectTo: getAuthRedirectUrl(request),
      });
      if (error || !data.user) return json({ error: error?.message || 'Could not invite this account' }, 400);
      const { error: profileError } = await admin.from('profiles').update({ display_name: displayName, phone, email, role })
        .eq('id', data.user.id);
      if (profileError) return json({ error: profileError.message }, 500);
      await admin.from('audit_logs').insert({
        actor_id: authData.user.id, action: 'account_invited', subject_id: data.user.id,
        details: { email, role },
      });
      return json({ success: true, message: `Invitation sent to ${email}.` });
    }

    if (action === 'reset-password') {
      const targetId = typeof body.user_id === 'string' ? body.user_id : '';
      const { data: target } = await admin.from('profiles').select('id, email')
        .eq('id', targetId).eq('email', email).is('deleted_at', null).maybeSingle();
      if (!target) return json({ error: 'Account not found' }, 404);
      const { error } = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(request),
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from('audit_logs').insert({
        actor_id: authData.user.id, action: 'password_reset_requested', subject_id: target.id,
      });
      return json({ success: true, message: `Password reset instructions sent to ${email}.` });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getAuthRedirectUrl(request: Request): string {
  const mobileRedirect = 'com.pallenestam.app://auth/reset-password';
  const origin = request.headers.get('origin');
  if (!origin) return mobileRedirect;

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1') {
      return mobileRedirect;
    }
    return `${parsedOrigin.origin}/`;
  } catch {
    return mobileRedirect;
  }
}
