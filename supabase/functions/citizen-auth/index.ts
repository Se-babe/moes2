// Optional citizen sign-in with a phone number and a one-time SMS code.
// Guests can still do everything without signing in; signing in only
// keeps their profile and requests together across devices.
//
//   { action: 'request', phone }        send a 6-digit code by SMS (UgSMS)
//   { action: 'verify', phone, code }   check it; returns a token the app
//                                       exchanges for a normal session
//   { action: 'device', phone, device_secret }
//                                       sign in again on a remembered device,
//                                       with no new code
//   { action: 'forget_devices' } + JWT  "sign out on all devices"
//   { action: 'delete' } + citizen JWT  delete the citizen's account
//
// After a correct code the device can be remembered (remember: true): it
// gets a random 256-bit secret that only it holds; we keep its hash. A new
// device always needs a code. Devices unused for 180 days need a code again.
//
// Codes are stored hashed, expire after 10 minutes, allow 5 tries, and a
// phone can request at most 4 codes an hour (one a minute).
// Staff never sign in here: staff accounts use email and password.
//
// Deploy: supabase functions deploy citizen-auth --no-verify-jwt

import { CORS_HEADERS, json } from '../_shared/cors.ts';
import { normalizeUgPhone, smsOutcome } from '../_shared/notify.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
const CODE_MINUTES = 10;
const MAX_TRIES = 5;
const DEVICE_DAYS = 180;

// Citizen accounts get an internal address that is never emailed. The
// reserved .invalid domain is preferred; example.com (also reserved, RFC
// 2606) is the fallback if the auth server rejects .invalid.
const digits = (phone: string) => phone.replace(/\D/g, '');
const EMAILS = (phone: string) => [`${digits(phone)}@citizen.nwsc-jinja.invalid`, `${digits(phone)}@citizen.example.com`];

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const hashCode = (phone: string, code: string) => sha256(`${phone}:${code}:${SERVICE}`);
const hashDevice = (secret: string) => sha256(`device:${secret}:${SERVICE}`);
function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** One-time token the app exchanges for a session (no email is sent). */
async function sessionToken(email: string): Promise<string | null> {
  const link = await fetch(`${URL_}/auth/v1/admin/generate_link`, { method: 'POST', headers: svc, body: JSON.stringify({ type: 'magiclink', email }) });
  const lb = await link.json().catch(() => ({}));
  return link.ok ? lb?.hashed_token || lb?.properties?.hashed_token || null : null;
}

async function findCitizen(phone: string) {
  const r = await rest(`users?email=in.(${EMAILS(phone).map((e) => `"${e}"`).join(',')})&select=id,email,role,is_active`);
  return r.data?.[0] as { id: string; email: string; role: string; is_active: boolean } | undefined;
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...svc, ...(init.headers || {}) } });
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
}

async function requestCode(phone: string) {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const recent = await rest(`citizen_otp?phone=eq.${encodeURIComponent(phone)}&created_at=gte.${encodeURIComponent(since)}&select=created_at&order=created_at.desc`);
  const list = (recent.data || []) as { created_at: string }[];
  if (list.length >= 4) return json({ error: 'Too many codes requested. Please wait an hour and try again.' }, 429);
  if (list[0] && Date.now() - new Date(list[0].created_at).getTime() < 60_000) {
    return json({ error: 'Please wait a minute before asking for another code.' }, 429);
  }
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  await rest('citizen_otp', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ phone, code_hash: await hashCode(phone, code), expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString() }),
  });
  const sent = await smsOutcome(phone, `Your NWSC Jinja sign-in code is ${code}. It expires in ${CODE_MINUTES} minutes. Never share it — NWSC staff will never ask for it.`, 'sign_in');
  if (sent.status !== 'sent') return json({ error: 'We could not send the SMS. Check the number and try again, or continue as a guest.' }, 502);
  return json({ ok: true, expires_in: CODE_MINUTES * 60 });
}

async function deviceSignIn(phone: string, secret: string) {
  const nope = json({ error: 'This device is not remembered any more. We will send you a code.', need_code: true }, 401);
  if (!secret || secret.length < 32) return nope;
  const user = await findCitizen(phone);
  if (!user || user.role !== 'citizen' || user.is_active === false) return nope;
  const since = new Date(Date.now() - DEVICE_DAYS * 864e5).toISOString();
  const dev = await rest(`citizen_devices?user_id=eq.${user.id}&secret_hash=eq.${await hashDevice(secret)}&last_used_at=gte.${encodeURIComponent(since)}&select=id`);
  const row = dev.data?.[0];
  if (!row) return nope;
  await rest(`citizen_devices?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_used_at: new Date().toISOString() }) });
  const token = await sessionToken(user.email);
  if (!token) return json({ error: 'Could not sign you in. Please try again.' }, 500);
  return json({ ok: true, token_hash: token });
}

async function verifyCode(phone: string, code: string, remember: boolean, label: string) {
  const now = new Date().toISOString();
  const r = await rest(`citizen_otp?phone=eq.${encodeURIComponent(phone)}&used_at=is.null&expires_at=gt.${encodeURIComponent(now)}&select=id,code_hash,attempts&order=created_at.desc&limit=1`);
  const row = (r.data || [])[0];
  if (!row) return json({ error: 'That code has expired. Ask for a new one.' }, 400);
  if (row.attempts >= MAX_TRIES) return json({ error: 'Too many wrong tries. Ask for a new code.' }, 429);
  if ((await hashCode(phone, code)) !== row.code_hash) {
    await rest(`citizen_otp?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ attempts: row.attempts + 1 }) });
    const left = MAX_TRIES - row.attempts - 1;
    return json({ error: left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Ask for a new code.' }, 400);
  }
  await rest(`citizen_otp?id=eq.${row.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ used_at: now }) });

  // Find or create the citizen's account.
  const candidates = EMAILS(phone);
  const existing = await rest(`users?email=in.(${candidates.map((e) => `"${e}"`).join(',')})&select=id,email,role,is_active`);
  const found = existing.data?.[0];
  let userId: string | undefined = found?.id;
  let email = found?.email || candidates[0];
  if (found && found.role !== 'citizen') {
    return json({ error: 'This number belongs to a staff account. Staff sign in with email and password.' }, 403);
  }
  if (!userId) {
    let body: Record<string, any> = {};
    for (const candidate of candidates) {
      const created = await fetch(`${URL_}/auth/v1/admin/users`, {
        method: 'POST',
        headers: svc,
        body: JSON.stringify({ email: candidate, email_confirm: true, user_metadata: { role: 'citizen', phone } }),
      });
      body = await created.json().catch(() => ({}));
      if (created.ok) { email = candidate; userId = body.id; break; }
      console.error('[citizen-auth] create user failed', candidate, body?.msg || body?.message);
    }
    if (!userId) return json({ error: body?.msg || body?.message || 'Could not create your account.' }, 500);
    const up = await rest('users?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: userId, email, phone, role: 'citizen', is_active: true }),
    });
    if (!up.ok) return json({ error: 'Could not save your account.' }, 500);
  }

  const linked = await rest('rpc/link_citizen', { method: 'POST', body: JSON.stringify({ p_user: userId, p_phone: phone }) });

  // Remember this device: next time the number alone signs in here.
  let deviceSecret: string | null = null;
  if (remember) {
    deviceSecret = newSecret();
    await rest('citizen_devices', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, secret_hash: await hashDevice(deviceSecret), label: label?.slice(0, 80) || null }),
    });
  }

  const tokenHash = await sessionToken(email);
  if (!tokenHash) return json({ error: 'Could not sign you in. Please try again.' }, 500);
  return json({ ok: true, token_hash: tokenHash, device_secret: deviceSecret, linked: linked.data });
}

async function callerCitizen(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const who = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: auth } });
  if (!who.ok) return null;
  const user = await who.json();
  const prof = await rest(`users?id=eq.${user.id}&select=role`);
  return prof.data?.[0]?.role === 'citizen' ? user.id as string : null;
}

async function forgetDevices(req: Request) {
  const id = await callerCitizen(req);
  if (!id) return json({ error: 'Please sign in.' }, 401);
  await rest(`citizen_devices?user_id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return json({ ok: true });
}

async function deleteAccount(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const who = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: auth } });
  if (!who.ok) return json({ error: 'Please sign in.' }, 401);
  const user = await who.json();
  const prof = await rest(`users?id=eq.${user.id}&select=role`);
  if (prof.data?.[0]?.role !== 'citizen') return json({ error: 'Only citizen accounts can be deleted here.' }, 403);
  const f = await rest('rpc/forget_citizen', { method: 'POST', body: JSON.stringify({ p_user: user.id }) });
  if (!f.ok) return json({ error: 'Could not delete your account.' }, 500);
  await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: svc });
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'delete') return await deleteAccount(req);
    if (body.action === 'forget_devices') return await forgetDevices(req);
    const phone = normalizeUgPhone(body.phone);
    if (!phone || !/^\+2567\d{8}$/.test(phone)) return json({ error: 'Enter a Ugandan mobile number, e.g. 0772 123456.' }, 400);
    if (body.action === 'request') return await requestCode(phone);
    if (body.action === 'verify') {
      const code = String(body.code || '').replace(/\D/g, '');
      if (code.length !== 6) return json({ error: 'Enter the 6-digit code from the SMS.' }, 400);
      return await verifyCode(phone, code, body.remember !== false, String(body.label || ''));
    }
    if (body.action === 'device') {
      return await deviceSignIn(phone, String(body.device_secret || ''));
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('[citizen-auth]', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
