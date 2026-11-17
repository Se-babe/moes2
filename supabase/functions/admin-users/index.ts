// Admin-only staff account management that needs the service role:
//   { action: 'invite', email, full_name, role, department_id, job_title }
//     -> sends a Supabase invite email and creates/updates the staff profile.
// Role/department changes for existing users are done directly from the
// admin console (RLS allows admins to update users).
//
// Deploy: supabase functions deploy admin-users

import { CORS_HEADERS, json } from '../_shared/cors.ts';

const STAFF_ROLES = ['officer', 'supervisor', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const svc = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };

    // Who is calling, and are they an active admin?
    const auth = req.headers.get('Authorization') || '';
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, Authorization: auth } });
    if (!who.ok) return json({ error: 'Please sign in.' }, 401);
    const caller = await who.json();
    const pr = await fetch(`${url}/rest/v1/users?id=eq.${caller.id}&select=role,is_active`, { headers: svc });
    const [me] = pr.ok ? await pr.json() : [];
    if (!me || me.role !== 'admin' || me.is_active === false) return json({ error: 'Administrators only.' }, 403);

    const { action, email, full_name, role, department_id, job_title, redirect_to } = await req.json();
    if (action !== 'invite') return json({ error: 'Unknown action.' }, 400);

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return json({ error: 'Enter a valid email address.' }, 400);
    if (!STAFF_ROLES.includes(role)) return json({ error: 'Choose officer, supervisor or admin.' }, 400);
    if (role !== 'admin' && !department_id) return json({ error: 'Officers and supervisors need a department.' }, 400);

    // Existing profile? Then just upgrade it.
    const existing = await fetch(`${url}/rest/v1/users?email=eq.${encodeURIComponent(cleanEmail)}&select=id`, { headers: svc });
    const [found] = existing.ok ? await existing.json() : [];
    let userId: string | undefined = found?.id;
    let invited = false;

    if (!userId) {
      const inv = await fetch(`${url}/auth/v1/invite${redirect_to ? `?redirect_to=${encodeURIComponent(redirect_to)}` : ''}`, {
        method: 'POST',
        headers: svc,
        body: JSON.stringify({ email: cleanEmail, data: { full_name, role } }),
      });
      const body = await inv.json().catch(() => ({}));
      if (!inv.ok) return json({ error: body?.msg || body?.message || 'Could not send the invitation.' }, inv.status);
      userId = body?.id;
      invited = true;
    }
    if (!userId) return json({ error: 'Invitation sent, but the account id was not returned.' }, 500);

    const profile = {
      id: userId,
      email: cleanEmail,
      full_name: full_name ? String(full_name).trim() : null,
      role,
      department_id: role === 'admin' ? department_id || null : department_id,
      job_title: job_title ? String(job_title).trim() : null,
      is_active: true,
    };
    const up = await fetch(`${url}/rest/v1/users?on_conflict=id`, {
      method: 'POST',
      headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(profile),
    });
    if (!up.ok) return json({ error: 'Account created, but the staff profile could not be saved: ' + (await up.text()) }, 500);

    return json({ ok: true, invited, user_id: userId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
