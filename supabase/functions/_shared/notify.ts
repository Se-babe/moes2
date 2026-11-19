// Shared outbound notifications for Edge Functions: SMS (UgSMS) and email
// (Resend). Every attempt is written to public.notification_log.
//
// Secrets (set once with `supabase secrets set ...`, never in code):
//   RESEND_API_KEY, RESEND_FROM                        — email
//   UGSMS_API_KEY, UGSMS_SENDER_ID, UGSMS_DEFAULT_COUNTRY — SMS
// A missing secret never throws: the attempt is logged as 'skipped'.

type Purpose = 'acknowledgement' | 'status_update' | 'announcement' | 'reminder' | 'escalation';

interface LogEntry {
  request_id?: string | null;
  announcement_id?: string | null;
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

export async function sendSms(rawTo: string, message: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null) {
  const to = normalizeUgPhone(rawTo);
  if (!to) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'sms', recipient: String(rawTo), purpose, status: 'failed', detail: 'invalid phone number' });
    return false;
  }
  const apiKey = Deno.env.get('UGSMS_API_KEY');
  if (!apiKey) {
    console.log(`[notify] SMS skipped (UGSMS_API_KEY not set) to ${to}: ${message}`);
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'sms', recipient: to, purpose, status: 'skipped', detail: 'UGSMS_API_KEY not set' });
    return false;
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
        numbers: to,
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
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'sms', recipient: to, purpose, status: ok ? 'sent' : 'failed', detail: text });
    return ok;
  } catch (e) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'sms', recipient: to, purpose, status: 'failed', detail: String(e) });
    return false;
  }
}

export async function sendEmail(to: string, subject: string, html: string, purpose: Purpose, requestId?: string | null, announcementId?: string | null) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'email', recipient: to, purpose, status: 'skipped', detail: 'RESEND_API_KEY not set' });
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
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'email', recipient: to, purpose, status: res.ok ? 'sent' : 'failed', detail: text });
    return res.ok;
  } catch (e) {
    await logNotification({ request_id: requestId, announcement_id: announcementId, channel: 'email', recipient: to, purpose, status: 'failed', detail: String(e) });
    return false;
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
