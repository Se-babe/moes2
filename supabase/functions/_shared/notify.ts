// Shared outbound notifications for Edge Functions: SMS (Africa's Talking)
// and email (Resend). Every attempt is written to public.notification_log.
//
// Secrets (set once with `supabase secrets set ...`):
//   RESEND_API_KEY, RESEND_FROM            — email
//   AT_USERNAME, AT_API_KEY, AT_SENDER_ID  — SMS (AT_SENDER_ID optional;
//                                             AT_USERNAME=sandbox uses the AT sandbox)
// A missing secret never throws: the attempt is logged as 'skipped'.

type Purpose = 'acknowledgement' | 'status_update' | 'announcement' | 'reminder' | 'escalation';

interface LogEntry {
  request_id?: string | null;
  channel: 'sms' | 'email';
  recipient: string;
  purpose: Purpose;
  status: 'sent' | 'failed' | 'skipped';
  detail?: string;
}

export async function logNotification(entry: LogEntry) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/notification_log`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ ...entry, detail: entry.detail?.slice(0, 500) ?? null }),
    });
  } catch (e) {
    console.error('[notify] could not write notification_log', e);
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

export async function sendSms(rawTo: string, message: string, purpose: Purpose, requestId?: string | null) {
  const to = normalizeUgPhone(rawTo);
  if (!to) {
    await logNotification({ request_id: requestId, channel: 'sms', recipient: String(rawTo), purpose, status: 'failed', detail: 'invalid phone number' });
    return false;
  }
  const username = Deno.env.get('AT_USERNAME');
  const apiKey = Deno.env.get('AT_API_KEY');
  if (!username || !apiKey) {
    console.log(`[notify] SMS skipped (AT not configured) to ${to}: ${message}`);
    await logNotification({ request_id: requestId, channel: 'sms', recipient: to, purpose, status: 'skipped', detail: 'AT_USERNAME/AT_API_KEY not set' });
    return false;
  }
  const endpoint = username === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';
  const body = new URLSearchParams({ username, to, message });
  const from = Deno.env.get('AT_SENDER_ID');
  if (from) body.set('from', from);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await res.text();
    const ok = res.ok && /"status"\s*:\s*"Success"/.test(text);
    await logNotification({ request_id: requestId, channel: 'sms', recipient: to, purpose, status: ok ? 'sent' : 'failed', detail: text });
    return ok;
  } catch (e) {
    await logNotification({ request_id: requestId, channel: 'sms', recipient: to, purpose, status: 'failed', detail: String(e) });
    return false;
  }
}

export async function sendEmail(to: string, subject: string, html: string, purpose: Purpose, requestId?: string | null) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    await logNotification({ request_id: requestId, channel: 'email', recipient: to, purpose, status: 'skipped', detail: 'RESEND_API_KEY not set' });
    return false;
  }
  const from = Deno.env.get('RESEND_FROM') || 'NWSC e-Participation <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    const text = await res.text();
    await logNotification({ request_id: requestId, channel: 'email', recipient: to, purpose, status: res.ok ? 'sent' : 'failed', detail: text });
    return res.ok;
  } catch (e) {
    await logNotification({ request_id: requestId, channel: 'email', recipient: to, purpose, status: 'failed', detail: String(e) });
    return false;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
