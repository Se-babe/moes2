// Shared outbound notifications for Edge Functions: SMS (UgSMS) and email
// (Resend). Every attempt is written to public.notification_log.
//
// Secrets (set once with `supabase secrets set ...`, never in code):
//   RESEND_API_KEY, RESEND_FROM                        — email
//   UGSMS_API_KEY, UGSMS_SENDER_ID, UGSMS_DEFAULT_COUNTRY — SMS
// A missing secret never throws: the attempt is logged as 'skipped'.
//
// A message that fails at the provider is put on the delivery queue
// (public.notification_outbox) and retried by announcement-dispatch.

export type Purpose = 'acknowledgement' | 'status_update' | 'announcement' | 'reminder' | 'escalation' | 'review' | 'test';
export type Channel = 'sms' | 'email' | 'whatsapp' | 'telegram' | 'facebook' | 'x';
export type Outcome = { status: 'sent' | 'failed' | 'skipped'; detail: string; final?: boolean };

interface LogEntry {
  request_id?: string | null;
  announcement_id?: string | null;
  channel: Channel;
  recipient: string;
  purpose: Purpose;
  status: 'sent' | 'failed' | 'skipped';
  detail?: string;
}

function serviceHeaders() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return key ? { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' } : null;
}

export async function logNotification(entry: LogEntry | LogEntry[]) {
  const url = Deno.env.get('SUPABASE_URL');
  const headers = serviceHeaders();
  if (!url || !headers) return;
  const rows = (Array.isArray(entry) ? entry : [entry]).map((e) => ({ ...e, detail: e.detail?.slice(0, 500) ?? null }));
  if (!rows.length) return;
  try {
    await fetch(`${url}/rest/v1/notification_log`, { method: 'POST', headers, body: JSON.stringify(rows) });
  } catch (e) {
    console.error('[notify] could not write notification_log', e);
  }
}

/** Put a failed direct message on the delivery queue for another try. */
async function queueRetry(row: Record<string, unknown>) {
  const url = Deno.env.get('SUPABASE_URL');
  const headers = serviceHeaders();
  if (!url || !headers) return;
  try {
    await fetch(`${url}/rest/v1/notification_outbox`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...row, attempts: 1, not_before: new Date(Date.now() + 5 * 60_000).toISOString() }),
    });
  } catch (e) {
    console.error('[notify] could not queue retry', e);
  }
}

// Ugandan numbers: 07XXXXXXXX / 7XXXXXXXX / 2567XXXXXXXX / +2567XXXXXXXX -> +2567XXXXXXXX
export function normalizeUgPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  if (/^256\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+256${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits)) return `+256${digits}`;
  return null;
}

/**
 * One UgSMS call for one or many numbers (already normalised). Logs one
 * row per number.
 */
export async function deliverSms(numbers: string[], message: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null): Promise<Outcome> {
  const log = (status: Outcome['status'], detail: string) =>
    logNotification(numbers.map((to) => ({ request_id: requestId, announcement_id: announcementId, channel: 'sms' as const, recipient: to, purpose, status, detail })));
  const apiKey = Deno.env.get('UGSMS_API_KEY');
  if (!apiKey) {
    await log('skipped', 'UGSMS_API_KEY not set');
    return { status: 'skipped', detail: 'UGSMS_API_KEY not set' };
  }
  const senderId = Deno.env.get('UGSMS_SENDER_ID') || undefined;
  try {
    // UgSMS v2: https://ugsms.com/api/v2/sms/send, auth via X-API-Key.
    // `numbers` is confirmed (comma-separated, 07XXXXXXXX or +256XXXXXXXXX).
    // The v2 message/sender field names are undocumented, so the v1 name
    // (message_body) and the common alternative are both sent.
    const res = await fetch('https://ugsms.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numbers: numbers.join(','),
        message_body: message,
        message,
        ...(senderId ? { sender_id: senderId, sender: senderId } : {}),
      }),
    });
    const text = await res.text();
    let ok = res.ok;
    try {
      const data = JSON.parse(text);
      if (data?.success === false || data?.error) ok = false;
    } catch { /* non-JSON body: rely on HTTP status */ }
    await log(ok ? 'sent' : 'failed', text);
    return { status: ok ? 'sent' : 'failed', detail: text };
  } catch (e) {
    await log('failed', String(e));
    return { status: 'failed', detail: String(e) };
  }
}

export async function smsOutcome(rawTo: string, message: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null): Promise<Outcome> {
  const to = normalizeUgPhone(rawTo);
  if (!to) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'sms', recipient: String(rawTo), purpose, status: 'failed', detail: 'invalid phone number' });
    return { status: 'failed', detail: 'invalid phone number', final: true };
  }
  return deliverSms([to], message, purpose, requestId, announcementId);
}

/** Send one SMS now; if the provider fails, it is retried from the queue. */
export async function sendSms(rawTo: string, message: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null) {
  const r = await smsOutcome(rawTo, message, purpose, requestId, announcementId);
  if (r.status === 'failed' && !r.final) {
    await queueRetry({ channel: 'sms', recipient: normalizeUgPhone(rawTo), purpose, request_id: requestId ?? null, body: message, priority: 2 });
  }
  return r.status === 'sent';
}

export async function emailOutcome(to: string, subject: string, html: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null): Promise<Outcome> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'email', recipient: to, purpose, status: 'skipped', detail: 'RESEND_API_KEY not set' });
    return { status: 'skipped', detail: 'RESEND_API_KEY not set' };
  }
  const from = Deno.env.get('RESEND_FROM') || 'NWSC e-Participation <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    const text = await res.text();
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'email', recipient: to, purpose, status: res.ok ? 'sent' : 'failed', detail: text });
    // 4xx other than rate limiting means the address or message is the problem.
    return { status: res.ok ? 'sent' : 'failed', detail: text, final: !res.ok && res.status >= 400 && res.status < 500 && res.status !== 429 };
  } catch (e) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'email', recipient: to, purpose, status: 'failed', detail: String(e) });
    return { status: 'failed', detail: String(e) };
  }
}

/** Send one email now; if the provider fails, it is retried from the queue. */
export async function sendEmail(to: string, subject: string, html: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null) {
  const r = await emailOutcome(to, subject, html, purpose, requestId, announcementId);
  if (r.status === 'failed' && !r.final) {
    await queueRetry({ channel: 'email', recipient: to, purpose, request_id: requestId ?? null, subject, html, priority: 2 });
  }
  return r.status === 'sent';
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
