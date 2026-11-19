// Sends SMS/email alerts for newly published announcements to matching
// citizen subscribers. Called by the scheduler every 5 minutes and by the
// staff portal right after an announcement is approved. It takes no input
// and only sends alerts that haven't been sent yet (claimed atomically in the
// database), so it is safe to call at any time.
//
// Deploy (no JWT needed — it takes no input and is idempotent):
//   supabase functions deploy announcement-dispatch --no-verify-jwt
// Optional secret for links in messages: SITE_URL=https://your-site

import { CORS_HEADERS, json } from '../_shared/cors.ts';
import { sendSms, sendEmail, escapeHtml } from '../_shared/notify.ts';

type Announcement = {
  id: string; title: string; body: string; category: string; areas: string[];
  notify_sms: boolean; notify_email: boolean;
};
type Recipient = { phone: string | null; email: string | null; language: string; token: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const site = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
    const svc = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
    const rpc = async (fn: string, body: unknown = {}) => {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: svc, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`${fn}: ${await r.text()}`);
      return r.json();
    };

    const claimed: Announcement[] = await rpc('claim_announcements_to_notify');
    const summary: Record<string, number> = {};

    for (const a of claimed) {
      const recipients: Recipient[] = await rpc('announcement_recipients', { p_announcement: a.id });
      const where = a.areas?.length ? ` (${a.areas.join(', ')})` : '';
      const link = site ? ` ${site}/updates/${a.id}` : '';
      const sms = `NWSC ${a.category}${where}: ${a.title}.${link}`.slice(0, 300);
      let sent = 0;

      // Modest concurrency keeps us inside SMS/email provider rate limits.
      const queue = [...recipients];
      const worker = async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
          const stop = site ? `${site}/alerts?unsubscribe=${r.token}` : '';
          const tasks: Promise<boolean>[] = [];
          if (a.notify_sms && r.phone) tasks.push(sendSms(r.phone, sms, 'announcement', null, a.id));
          if (a.notify_email && r.email) {
            tasks.push(sendEmail(
              r.email,
              `NWSC ${a.category}: ${a.title}`,
              `<p style="font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:1px">Official NWSC Jinja service update${escapeHtml(where)}</p>
               <h2 style="margin:4px 0 12px">${escapeHtml(a.title)}</h2>
               <p style="white-space:pre-line">${escapeHtml(a.body)}</p>
               ${site ? `<p><a href="${site}/updates/${a.id}">View on the NWSC e-Participation portal</a></p>` : ''}
               <p>For emergencies call toll-free 0800-200-977.</p>
               ${stop ? `<p style="font-size:12px;color:#94A3B8">You receive these alerts because you subscribed. <a href="${stop}">Stop alerts</a>.</p>` : ''}`,
              'announcement',
              null,
              a.id,
            ));
          }
          const results = await Promise.all(tasks);
          if (results.some(Boolean)) sent += 1;
        }
      };
      await Promise.all(Array.from({ length: 5 }, worker));

      await fetch(`${url}/rest/v1/announcements?id=eq.${a.id}`, {
        method: 'PATCH',
        headers: { ...svc, Prefer: 'return=minimal' },
        body: JSON.stringify({ notify_count: sent }),
      });
      summary[a.id] = sent;
    }
    return json({ ok: true, announcements: claimed.length, delivered: summary });
  } catch (e) {
    console.error('[announcement-dispatch]', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
