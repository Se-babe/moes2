// Shared by every Edge Function that gates a public write behind a
// Cloudflare Turnstile challenge (submit-feedback, propose-consultation).
// Verification MUST happen here, server-side — a client-side-only check is
// trivially bypassed by calling the function directly with no token.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: string | undefined, remoteip?: string): Promise<boolean> {
  if (!token) return false;
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY is not configured on the server');
    return false;
  }
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);

  const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
  const data = await res.json();
  return data.success === true;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
