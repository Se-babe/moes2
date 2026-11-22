// Citizen notification sender. Works through the delivery queue
// (public.notification_outbox): announcement alerts and reminders by SMS,
// WhatsApp and email, posts to the NWSC Telegram channel, Facebook page and
// X account, alerts to reviewers, and retries of failed messages.
//
// The database decides WHAT is sent and WHEN (quiet hours, reminders,
// retries); this function only writes the messages and hands them to the
// providers. It is called every minute by the scheduler when something is
// due, and by the staff portal right after an announcement is approved.
// Queue processing takes no input and is safe to call at any time.
//
// Admin-only actions (signed-in administrator's token required):
//   { "action": "status" }            which channels are configured
//   { "action": "test", "channel" }   test message to the admin's own phone/email
//
// Deploy: supabase functions deploy announcement-dispatch --no-verify-jwt
// Secrets: see _shared/notify.ts and _shared/channels.ts; SITE_URL for links.

import { CORS_HEADERS, json } from '../_shared/cors.ts';
import { deliverSms, smsOutcome, emailOutcome, normalizeUgPhone, escapeHtml, type Outcome, type Purpose } from '../_shared/notify.ts';
import { channelStatus, sendWhatsApp, postTelegram, postFacebook, postX } from '../_shared/channels.ts';

type Row = {
  id: string; announcement_id: string | null; request_id: string | null; channel: string; recipient: string | null;
  purpose: Purpose; subject: string | null; body: string | null; html: string | null; token: string | null;
};
type Announcement = { id: string; title: string; body: string; category: string; areas: string[]; starts_at: string | null; status: string };
type Result = { id: string; status: Outcome['status']; error?: string; final?: boolean };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
const HOTLINE = '0800-200-977';
const EMOJI: Record<string, string> = {
  Emergency: '🚨', 'Planned interruption': '🚧', Restoration: '✅', 'Service notice': 'ℹ️', 'Tariffs & billing': '🧾', General: '📢',
};

async function rpc<T>(fn: string, body: unknown = {}): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: svc, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${fn}: ${await r.text()}`);
  return r.json();
}

// ---------- Message writing ----------
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', {
  timeZone: 'Africa/Kampala', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});
const fit = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

function parts(a: Announcement, purpose: Purpose) {
  const urgent = a.category === 'Emergency';
  const reminder = purpose === 'reminder';
  const areas = a.areas?.length ? a.areas.join(', ') : '';
  const starts = a.starts_at ? when(a.starts_at) : '';
  const link = SITE ? `${SITE}/updates/${a.id}` : '';
  const label = reminder ? 'Reminder' : urgent ? 'EMERGENCY' : a.category;
  return { urgent, reminder, areas, starts, link, label };
}

function smsText(a: Announcement, purpose: Purpose) {
  const p = parts(a, purpose);
  const where = p.areas ? ` (${p.areas})` : '';
  let text = p.reminder
    ? `NWSC reminder${where}: ${a.title} starts ${p.starts}.`
    : `NWSC ${p.label}${where}: ${a.title}.${p.starts ? ` Starts ${p.starts}.` : ''}`;
  if (p.urgent) text += ` Emergencies: ${HOTLINE}.`;
  const tail = p.link ? ` ${p.link}` : '';
  return fit(text, 306 - tail.length) + tail; // two SMS parts at most
}

function emailMessage(a: Announcement, purpose: Purpose, token: string | null) {
  const p = parts(a, purpose);
  const stop = SITE && token ? `${SITE}/alerts?unsubscribe=${token}` : '';
  const subject = p.reminder ? `Reminder: ${a.title} — starts ${p.starts}` : `NWSC ${p.label}: ${a.title}`;
  const html = `
    <p style="font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:1px">
      ${p.reminder ? 'Reminder — ' : ''}Official NWSC Jinja service update${p.areas ? ` · ${escapeHtml(p.areas)}` : ''}</p>
    <h2 style="margin:4px 0 12px">${escapeHtml(a.title)}</h2>
    ${p.starts ? `<p><strong>${p.reminder ? 'Starts' : 'Starting'}:</strong> ${escapeHtml(p.starts)}</p>` : ''}
    <p style="white-space:pre-line">${escapeHtml(a.body)}</p>
    ${p.link ? `<p><a href="${p.link}">View on the NWSC e-Participation portal</a></p>` : ''}
    <p>For emergencies call toll-free ${HOTLINE}.</p>
    ${stop ? `<p style="font-size:12px;color:#94A3B8">You receive these alerts because you subscribed. <a href="${stop}">Stop alerts</a>.</p>` : ''}`;
  return { subject, html };
}

function whatsAppParts(a: Announcement, purpose: Purpose) {
  const p = parts(a, purpose);
  const headline = `NWSC Jinja ${p.label}${p.areas ? ` (${p.areas})` : ''}`;
  const details = `${a.title}.${p.starts ? ` ${p.reminder ? 'Starts' : 'Starting'} ${p.starts}.` : ''} ${fit(a.body, 400)}${p.link ? ` ${p.link}` : ''}`;
  return { headline, details };
}

function telegramHtml(a: Announcement, purpose: Purpose) {
  const p = parts(a, purpose);
  const lines = [
    `<b>${p.reminder ? '⏰ Reminder' : `${EMOJI[a.category] || '📢'} ${escapeHtml(a.category)}`}</b>`,
    `<b>${escapeHtml(a.title)}</b>`,
    '',
    p.reminder ? `Starts ${escapeHtml(p.starts)}.` : escapeHtml(fit(a.body, 3000)),
    '',
    `📍 ${escapeHtml(p.areas || 'All areas')}`,
    ...(p.starts && !p.reminder ? [`🕒 Starts ${escapeHtml(p.starts)}`] : []),
    `☎️ Emergencies: ${HOTLINE} (toll-free)`,
    ...(p.link ? [p.link] : []),
  ];
  return lines.join('\n');
}

function facebookText(a: Announcement) {
  const p = parts(a, 'announcement');
  return [
    `${EMOJI[a.category] || '📢'} ${a.category.toUpperCase()}: ${a.title}`,
    '',
    a.body,
    '',
    `📍 Areas: ${p.areas || 'All areas'}`,
    ...(p.starts ? [`🕒 Starts: ${p.starts}`] : []),
    `☎️ Emergencies: ${HOTLINE} (toll-free)`,
    '#NWSC #Jinja',
  ].join('\n');
}

function xText(a: Announcement) {
  const p = parts(a, 'announcement');
  const tag = ' #NWSCJinja';
  const linkCost = p.link ? 24 : 0; // X counts every link as 23 characters + a space
  let text = `${EMOJI[a.category] || '📢'} ${p.label}${p.areas ? ` (${p.areas})` : ''}: ${a.title}.${p.starts ? ` Starts ${p.starts}.` : ''}`;
  text = fit(text, 280 - linkCost - tag.length);
  return `${text}${tag}${p.link ? ` ${p.link}` : ''}`;
}

// ---------- Sending ----------
async function sendOne(row: Row, a: Announcement | undefined): Promise<Outcome> {
  const meta = { purpose: row.purpose, announcementId: row.announcement_id, requestId: row.request_id };
  // Prepared messages: reviewer alerts and retries of direct messages.
  if (row.body || row.html) {
    if (row.channel === 'sms' && row.recipient && row.body) return smsOutcome(row.recipient, row.body, row.purpose, row.request_id, row.announcement_id);
    if (row.channel === 'email' && row.recipient) {
      return emailOutcome(row.recipient, row.subject || 'NWSC Jinja', row.html || `<p>${escapeHtml(row.body || '')}</p>`, row.purpose, row.request_id, row.announcement_id);
    }
  }
  if (!a) return { status: 'skipped', detail: 'announcement removed', final: true };
  switch (row.channel) {
    case 'sms': return smsOutcome(row.recipient!, smsText(a, row.purpose), row.purpose, null, a.id);
    case 'email': {
      const m = emailMessage(a, row.purpose, row.token);
      return emailOutcome(row.recipient!, m.subject, m.html, row.purpose, null, a.id);
    }
    case 'whatsapp': {
      const m = whatsAppParts(a, row.purpose);
      return sendWhatsApp(row.recipient!, m.headline, m.details, meta);
    }
    case 'telegram': return postTelegram(telegramHtml(a, row.purpose), meta);
    case 'facebook': return postFacebook(facebookText(a), parts(a, row.purpose).link || null, meta);
    case 'x': return postX(xText(a), meta);
  }
  return { status: 'failed', detail: `unknown channel ${row.channel}`, final: true };
}

async function sendBatch(rows: Row[]): Promise<Result[]> {
  const ids = [...new Set(rows.map((r) => r.announcement_id).filter(Boolean))];
  const anns = new Map<string, Announcement>();
  if (ids.length) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/announcements?id=in.(${ids.join(',')})&select=id,title,body,category,areas,starts_at,status`, { headers: svc });
    for (const a of (r.ok ? await r.json() : []) as Announcement[]) anns.set(a.id, a);
  }
  const results: Result[] = [];
  const done = (row: Row, o: Outcome) => results.push({ id: row.id, status: o.status, error: o.status === 'sent' ? undefined : o.detail, final: o.final });

  // Announcement taken down since it was queued: don't send (reviewer
  // alerts are about pending notices, so they always go).
  const live = rows.filter((row) => {
    if (row.purpose === 'review' || !row.announcement_id || row.body || row.html) return true;
    const a = anns.get(row.announcement_id);
    if (a && a.status === 'published') return true;
    done(row, { status: 'skipped', detail: 'announcement no longer published', final: true });
    return false;
  });

  // Announcement SMS: the same text to many people, so one UgSMS call per
  // 100 numbers instead of one call each.
  const bulk = new Map<string, Row[]>();
  const single: Row[] = [];
  for (const row of live) {
    if (row.channel === 'sms' && row.announcement_id && !row.body && row.recipient) {
      const to = normalizeUgPhone(row.recipient);
      if (!to) { done(row, { status: 'failed', detail: 'invalid phone number', final: true }); continue; }
      const k = `${row.announcement_id}|${row.purpose}`;
      bulk.set(k, [...(bulk.get(k) || []), { ...row, recipient: to }]);
    } else {
      single.push(row);
    }
  }
  for (const group of bulk.values()) {
    const a = anns.get(group[0].announcement_id!)!;
    for (let i = 0; i < group.length; i += 100) {
      const chunk = group.slice(i, i + 100);
      const o = await deliverSms(chunk.map((r) => r.recipient!), smsText(a, chunk[0].purpose), chunk[0].purpose, null, a.id);
      chunk.forEach((row) => done(row, o));
    }
  }

  // Everything else, a few at a time to stay inside provider rate limits.
  const queue = [...single];
  await Promise.all(Array.from({ length: 5 }, async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      try {
        done(row, await sendOne(row, row.announcement_id ? anns.get(row.announcement_id) : undefined));
      } catch (e) {
        done(row, { status: 'failed', detail: String(e) });
      }
    }
  }));
  return results;
}

async function processQueue() {
  const started = Date.now();
  const totals = { sent: 0, failed: 0, skipped: 0 };
  // Stay well inside the Edge Function time limit; the scheduler picks up
  // whatever is left a minute later.
  while (Date.now() - started < 40_000) {
    const rows = await rpc<Row[]>('claim_outbox', { p_limit: 200 });
    if (!rows.length) break;
    const results = await sendBatch(rows);
    await rpc('finish_outbox', { p_results: results });
    for (const r of results) totals[r.status] += 1;
    if (rows.length < 200) break;
  }
  return totals;
}

// ---------- Admin actions ----------
async function adminAction(req: Request, body: { action: string; channel?: string }) {
  const auth = req.headers.get('Authorization') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!u.ok) return json({ error: 'Please sign in.' }, 401);
  const caller = await u.json();
  const p = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${caller.id}&select=role,is_active,phone,email,full_name`, { headers: svc });
  const [profile] = p.ok ? await p.json() : [];
  if (!profile || !['admin', 'hr'].includes(profile.role) || profile.is_active === false) return json({ error: 'Administrators and HR only.' }, 403);

  if (body.action === 'status') return json({ channels: channelStatus(), site_url: !!SITE });

  const name = (profile.full_name || '').split(' ')[0] || 'there';
  let o: Outcome;
  switch (body.channel) {
    case 'sms':
      if (!profile.phone) return json({ error: 'Add a phone number to your profile first.' }, 400);
      o = await smsOutcome(profile.phone, `NWSC e-Participation: hello ${name}, this is a test. SMS alerts are working.`, 'test');
      break;
    case 'whatsapp':
      if (!profile.phone) return json({ error: 'Add a phone number to your profile first.' }, 400);
      o = await sendWhatsApp(profile.phone, 'NWSC Jinja test', `Hello ${name}, WhatsApp alerts are working.`, { purpose: 'test' });
      break;
    case 'email':
      o = await emailOutcome(profile.email || caller.email, 'NWSC e-Participation: test alert',
        `<p>Hello ${escapeHtml(name)},</p><p>This is a test. Email alerts are working.</p>`, 'test');
      break;
    default:
      return json({ error: 'Choose sms, whatsapp or email.' }, 400);
  }
  return json({ status: o.status, detail: o.detail?.slice(0, 300) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action) return await adminAction(req, body);
    return json({ ok: true, ...(await processQueue()) });
  } catch (e) {
    console.error('[announcement-dispatch]', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
