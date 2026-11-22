// Staff actions on a citizen request: change status / priority / assignment,
// reply to the citizen, or add an internal note. The database writes are made
// WITH THE CALLER'S OWN TOKEN, so row-level security decides what this staff
// member may touch (their department, or everything for admins). This function
// adds the parts the browser can't do: validation and SMS/email to the citizen.
//
// Deploy: supabase functions deploy request-action

import { CORS_HEADERS, json } from '../_shared/cors.ts';
import { sendSms, sendEmail, escapeHtml } from '../_shared/notify.ts';

const STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json({ error: 'Please sign in.' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const asCaller = { apikey: anonKey, Authorization: auth, 'Content-Type': 'application/json' };

    const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: auth } });
    if (!userRes.ok) return json({ error: 'Your session has expired. Please sign in again.' }, 401);
    const caller = await userRes.json();

    const profileRes = await fetch(`${url}/rest/v1/users?id=eq.${caller.id}&select=id,full_name,role,is_active`, { headers: asCaller });
    const [profile] = profileRes.ok ? await profileRes.json() : [];
    if (!profile || !['officer', 'supervisor', 'admin', 'hr'].includes(profile.role) || profile.is_active === false) {
      return json({ error: 'Only active NWSC staff can update requests.' }, 403);
    }

    const body = await req.json();
    const {
      request_id, status, priority, assigned_to, department_id,
      public_message, internal_note,
    } = body ?? {};
    if (!request_id) return json({ error: 'request_id is required.' }, 400);
    if (status !== undefined && !STATUSES.includes(status)) return json({ error: 'Invalid status.' }, 400);
    if (priority !== undefined && !PRIORITIES.includes(priority)) return json({ error: 'Invalid priority.' }, 400);
    const reply = typeof public_message === 'string' ? public_message.trim().slice(0, 1000) : '';
    const note = typeof internal_note === 'string' ? internal_note.trim().slice(0, 2000) : '';

    // Read the request as the caller — RLS returns nothing if they have no access.
    const reqRes = await fetch(
      `${url}/rest/v1/feedback?id=eq.${encodeURIComponent(request_id)}&select=id,reference_no,title,status,request_type,contact_name,contact_phone,contact_email,first_response_at,department_id,assigned_to`,
      { headers: asCaller },
    );
    const [current] = reqRes.ok ? await reqRes.json() : [];
    if (!current) return json({ error: 'Request not found, or you do not have access to it.' }, 404);

    if ((status === 'Resolved' || status === 'Closed') && !reply && current.status !== status) {
      return json({ error: 'Please write a reply to the customer explaining the outcome before resolving.' }, 400);
    }
    if (department_id !== undefined && department_id !== current.department_id && profile.role === 'officer') {
      return json({ error: 'Only supervisors and administrators can move a request to another department.' }, 403);
    }

    const patch: Record<string, unknown> = {};
    if (status !== undefined && status !== current.status) patch.status = status;
    if (priority !== undefined) patch.priority = priority;
    if (assigned_to !== undefined) patch.assigned_to = assigned_to || null;
    if (department_id !== undefined && department_id !== current.department_id) {
      patch.department_id = department_id;
      if (assigned_to === undefined) patch.assigned_to = null; // new team picks it up
    }
    if (patch.assigned_to && current.status === 'Submitted' && patch.status === undefined) patch.status = 'Assigned';
    if (reply && !current.first_response_at) patch.first_response_at = new Date().toISOString();

    // A department move takes the row out of the caller's own view, which
    // row-level security rejects. The caller's right to move it was checked
    // above (supervisor/admin who can read the request), so that one case is
    // written with the service role; everything else runs as the caller.
    const movingDepartment = patch.department_id !== undefined;
    // The service-role write skips the database's assignment check, so make
    // the same check here: the new officer must be active staff in that team.
    if (movingDepartment && patch.assigned_to) {
      const chk = await fetch(
        `${url}/rest/v1/users?id=eq.${encodeURIComponent(String(patch.assigned_to))}&department_id=eq.${encodeURIComponent(String(patch.department_id))}&is_active=is.true&role=in.(officer,supervisor)&select=id`,
        { headers: asCaller },
      );
      const ok = chk.ok ? ((await chk.json()) as unknown[]).length > 0 : false;
      if (!ok) return json({ error: 'A request can only be assigned to active staff in its own department.' }, 400);
    }
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const writeHeaders = movingDepartment
      ? { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }
      : asCaller;

    if (Object.keys(patch).length > 0) {
      const upd = await fetch(`${url}/rest/v1/feedback?id=eq.${current.id}`, {
        method: 'PATCH',
        headers: { ...writeHeaders, Prefer: 'return=minimal, count=exact' },
        body: JSON.stringify(patch),
      });
      const changed = Number((upd.headers.get('content-range') || '').split('/')[1] || 0);
      if (!upd.ok || changed === 0) {
        const detail = upd.ok ? '' : await upd.text();
        console.error('[request-action] update failed', upd.status, detail || 'no rows');
        // Pass on the database's own explanation (e.g. "Only supervisors and
        // administrators can move a request to another department").
        let reason = '';
        try { reason = (JSON.parse(detail) as { message?: string }).message || ''; } catch { /* not JSON */ }
        return json({ error: reason || 'Could not update this request. You may not have permission.' }, 403);
      }
    }

    const newStatus = (patch.status as string) ?? current.status;
    const timeline: Record<string, unknown>[] = [];
    if (reply) timeline.push({ request_id: current.id, status: newStatus, message: reply, is_public: true, author_id: caller.id });
    if (note) timeline.push({ request_id: current.id, status: null, message: note, is_public: false, author_id: caller.id });
    if (timeline.length) {
      const ins = await fetch(`${url}/rest/v1/request_updates`, {
        method: 'POST',
        headers: { ...writeHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(timeline),
      });
      if (!ins.ok) console.error('[request-action] timeline insert failed', await ins.text());
    }

    // Tell the citizen when there is something for them: a reply, or the request is done.
    const statusWorthTelling = patch.status && ['In Progress', 'Resolved', 'Closed'].includes(newStatus);
    let notified = false;
    if (reply || statusWorthTelling) {
      const ref = current.reference_no;
      const text = reply || `Your request is now ${newStatus.toLowerCase()}.`;
      const site = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
      const rateLink = site && (newStatus === 'Resolved' || newStatus === 'Closed') ? `${site}/track?ref=${ref}` : '';
      const sms = `NWSC ${ref}: ${text.slice(0, 240)}${newStatus === 'Resolved' ? ' (Resolved)' : ''}${rateLink ? ` Rate us: ${rateLink}` : ''}`;
      const results = await Promise.allSettled([
        current.contact_phone ? sendSms(current.contact_phone, sms, 'status_update', current.id) : Promise.resolve(false),
        current.contact_email
          ? sendEmail(
              current.contact_email,
              `Update on your request ${ref} — ${newStatus}`,
              `<p>Dear ${escapeHtml(current.contact_name || 'Customer')},</p>
               <p>There is an update on your ${escapeHtml(String(current.request_type).toLowerCase())}
               <strong>${escapeHtml(current.title)}</strong> (reference <strong>${ref}</strong>).</p>
               <p style="padding:12px 16px;background:#F1F5F9;border-radius:8px">${escapeHtml(text)}</p>
               <p>Current status: <strong>${newStatus}</strong>. You can follow progress any time on the
               <em>Track My Request</em> page using your reference number.</p>
               ${rateLink ? `<p><a href="${rateLink}">Tell us how we did — rate our service</a></p>` : ''}
               <p>— NWSC Jinja Customer Care</p>`,
              'status_update',
              current.id,
            )
          : Promise.resolve(false),
      ]);
      notified = results.some((r) => r.status === 'fulfilled' && r.value === true);
    }

    return json({ ok: true, status: newStatus, citizen_notified: notified });
  } catch (e) {
    console.error('[request-action]', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
