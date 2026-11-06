import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !accessToken) {
    return respond(401, { error: 'A valid signed-in administrator session is required.' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return respond(401, { error: 'Your session is invalid or expired.' });

  const { data: caller, error: callerError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (callerError || caller?.role !== 'admin') return respond(403, { error: 'Administrator access is required.' });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return respond(400, { error: 'Request body must be valid JSON.' });
  }

  if (payload.action === 'invite') {
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const displayName = typeof payload.display_name === 'string' ? payload.display_name.trim() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.replace(/\D/g, '') : '';
    const role = payload.role;
    if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || phone.length !== 10 || !['citizen', 'official', 'admin'].includes(String(role))) {
      return respond(400, { error: 'Provide a valid email, name, 10-digit phone number, and account role.' });
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName, phone },
      ...(Deno.env.get('APP_SITE_URL') ? { redirectTo: Deno.env.get('APP_SITE_URL')! } : {}),
    });
    if (error || !data.user) return respond(400, { error: error?.message ?? 'The invitation could not be created.' });

    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: data.user.id,
      display_name: displayName,
      phone,
      email,
      role,
    });
    if (profileError) return respond(500, { error: `Invitation was sent, but profile setup failed: ${profileError.message}` });
    return respond(200, { user_id: data.user.id });
  }

  if (payload.action === 'update') {
    const userId = typeof payload.user_id === 'string' ? payload.user_id : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const displayName = typeof payload.display_name === 'string' ? payload.display_name.trim() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.replace(/\D/g, '') : '';
    const role = payload.role;
    if (!userId || !/^\S+@\S+\.\S+$/.test(email) || !displayName || phone.length !== 10 || !['citizen', 'official', 'admin'].includes(String(role))) {
      return respond(400, { error: 'Provide a user ID, valid email, name, 10-digit phone number, and account role.' });
    }

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (targetError || !target) return respond(404, { error: 'User account not found.' });

    if (target.role === 'admin' && role !== 'admin') {
      const { count, error: countError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (countError) return respond(500, { error: countError.message });
      if ((count ?? 0) <= 1) return respond(409, { error: 'The last administrator cannot be demoted.' });
    }

    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
      email,
      user_metadata: { display_name: displayName, phone },
    });
    if (authUpdateError) return respond(400, { error: authUpdateError.message });

    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ display_name: displayName, phone, email, role })
      .eq('id', userId);
    if (profileUpdateError) return respond(500, { error: `Auth details changed, but profile sync failed: ${profileUpdateError.message}` });
    return respond(200, { user_id: userId, updated: true });
  }

  if (payload.action === 'delete') {
    const userId = typeof payload.user_id === 'string' ? payload.user_id : '';
    if (!userId) return respond(400, { error: 'A user ID is required.' });
    if (userId === authData.user.id) return respond(400, { error: 'You cannot remove your own administrator account.' });

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (targetError || !target) return respond(404, { error: 'User account not found.' });

    if (target.role === 'admin') {
      const { count, error: countError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if (countError) return respond(500, { error: countError.message });
      if ((count ?? 0) <= 1) return respond(409, { error: 'The last administrator account cannot be removed.' });
    }

    const { error: anonymizeError } = await adminClient
      .from('complaints')
      .update({ reporter_name: 'Resident', reporter_phone: null, image_url: null })
      .eq('reporter_user_id', userId);
    if (anonymizeError) return respond(500, { error: `Could not anonymize the user's reports: ${anonymizeError.message}` });

    const { data: evidenceFiles, error: filesError } = await adminClient.storage
      .from('complaint-evidence')
      .list(userId, { limit: 1000 });
    if (filesError) return respond(500, { error: `Could not list the user's evidence files: ${filesError.message}` });
    if (evidenceFiles?.length) {
      const paths = evidenceFiles.filter((file) => file.name).map((file) => `${userId}/${file.name}`);
      const { error: deleteFilesError } = await adminClient.storage.from('complaint-evidence').remove(paths);
      if (deleteFilesError) return respond(500, { error: `Could not remove the user's evidence files: ${deleteFilesError.message}` });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) return respond(400, { error: deleteError.message });
    return respond(200, { user_id: userId, deleted: true });
  }

  return respond(400, { error: 'Unsupported action.' });
});
