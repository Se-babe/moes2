// WhatsApp and social-media channels for citizen notifications.
// Each one is optional: if its secrets aren't set, sends are 'skipped'.
//
// Secrets (`supabase secrets set NAME=value`, never in code):
//   WhatsApp Cloud API   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//                        WHATSAPP_TEMPLATE (approved template, 2 body
//                        variables: {{1}} headline, {{2}} details/link),
//                        WHATSAPP_TEMPLATE_LANG (default en)
//   Telegram channel     TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (@channel or id;
//                        the bot must be an admin of the channel)
//   Facebook page        FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN
//   X (Twitter)          X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
//   Optional             META_GRAPH_VERSION (default v23.0)

import { logNotification, normalizeUgPhone, type Channel, type Outcome, type Purpose } from './notify.ts';

const env = (k: string) => Deno.env.get(k) || '';
const graph = () => `https://graph.facebook.com/${env('META_GRAPH_VERSION') || 'v23.0'}`;

export function channelStatus(): Record<Channel, boolean> {
  return {
    sms: !!env('UGSMS_API_KEY'),
    email: !!env('RESEND_API_KEY'),
    whatsapp: !!(env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID') && env('WHATSAPP_TEMPLATE')),
    telegram: !!(env('TELEGRAM_BOT_TOKEN') && env('TELEGRAM_CHAT_ID')),
    facebook: !!(env('FACEBOOK_PAGE_ID') && env('FACEBOOK_PAGE_TOKEN')),
    x: !!(env('X_API_KEY') && env('X_API_SECRET') && env('X_ACCESS_TOKEN') && env('X_ACCESS_SECRET')),
  };
}

type Meta = { purpose: Purpose; announcementId?: string | null; requestId?: string | null };

async function finish(channel: Channel, recipient: string, meta: Meta, res: Response | null, error?: unknown): Promise<Outcome> {
  let out: Outcome;
  if (!res) {
    out = { status: 'failed', detail: String(error) };
  } else {
    const text = await res.text();
    let ok = res.ok;
    try {
      const data = JSON.parse(text);
      if (data?.ok === false || data?.error || data?.errors) ok = false;
    } catch { /* not JSON */ }
    // Client errors (bad token, rejected template, not a WhatsApp number…)
    // won't fix themselves; rate limits and server errors are retried.
    out = { status: ok ? 'sent' : 'failed', detail: text, final: !ok && res.status >= 400 && res.status < 500 && res.status !== 429 };
  }
  await logNotification({ channel, recipient, purpose: meta.purpose, status: out.status, detail: out.detail, announcement_id: meta.announcementId, request_id: meta.requestId });
  return out;
}

async function skipped(channel: Channel, recipient: string, meta: Meta, why: string): Promise<Outcome> {
  await logNotification({ channel, recipient, purpose: meta.purpose, status: 'skipped', detail: why, announcement_id: meta.announcementId, request_id: meta.requestId });
  return { status: 'skipped', detail: why };
}

// WhatsApp variables may not contain newlines, tabs or 4+ spaces in a row.
const waText = (s: string, max: number) => s.replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, max);

/** Business-initiated WhatsApp message using the approved template. */
export async function sendWhatsApp(rawTo: string, headline: string, details: string, meta: Meta): Promise<Outcome> {
  const to = normalizeUgPhone(rawTo);
  if (!to) return { ...(await skipped('whatsapp', String(rawTo), meta, 'invalid phone number')), status: 'failed', final: true };
  if (!channelStatus().whatsapp) return skipped('whatsapp', to, meta, 'WhatsApp secrets not set');
  try {
    const res = await fetch(`${graph()}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: env('WHATSAPP_TEMPLATE'),
          language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'en' },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: waText(headline, 200) }, { type: 'text', text: waText(details, 700) }],
          }],
        },
      }),
    });
    return finish('whatsapp', to, meta, res);
  } catch (e) {
    return finish('whatsapp', to, meta, null, e);
  }
}

/** Post to the NWSC Telegram channel. `html` uses Telegram's HTML subset. */
export async function postTelegram(html: string, meta: Meta): Promise<Outcome> {
  const chat = env('TELEGRAM_CHAT_ID');
  if (!channelStatus().telegram) return skipped('telegram', chat || 'telegram channel', meta, 'Telegram secrets not set');
  try {
    const res = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: html.slice(0, 4000), parse_mode: 'HTML', link_preview_options: { is_disabled: false } }),
    });
    return finish('telegram', chat, meta, res);
  } catch (e) {
    return finish('telegram', chat, meta, null, e);
  }
}

/** Post to the NWSC Facebook page. */
export async function postFacebook(message: string, link: string | null, meta: Meta): Promise<Outcome> {
  const page = env('FACEBOOK_PAGE_ID');
  if (!channelStatus().facebook) return skipped('facebook', page || 'facebook page', meta, 'Facebook secrets not set');
  try {
    const res = await fetch(`${graph()}/${page}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, ...(link ? { link } : {}), access_token: env('FACEBOOK_PAGE_TOKEN') }),
    });
    return finish('facebook', `page ${page}`, meta, res);
  } catch (e) {
    return finish('facebook', `page ${page}`, meta, null, e);
  }
}

// ---------- X (OAuth 1.0a user context) ----------
const pct = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export async function oauth1Header(
  method: string, url: string,
  keys: { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string },
  extra: Record<string, string> = {}, nonce = crypto.randomUUID().replace(/-/g, ''), timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: keys.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: keys.token,
    oauth_version: '1.0',
  };
  const all = { ...oauth, ...extra };
  const paramString = Object.keys(all).sort().map((k) => `${pct(k)}=${pct(all[k])}`).join('&');
  const base = `${method.toUpperCase()}&${pct(url)}&${pct(paramString)}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(`${pct(keys.consumerSecret)}&${pct(keys.tokenSecret)}`),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base)));
  oauth.oauth_signature = btoa(String.fromCharCode(...sig));
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${pct(k)}="${pct(oauth[k])}"`).join(', ');
}

/** Post to the NWSC X account. `text` must already fit in 280 characters. */
export async function postX(text: string, meta: Meta): Promise<Outcome> {
  if (!channelStatus().x) return skipped('x', 'x account', meta, 'X secrets not set');
  const url = 'https://api.x.com/2/tweets';
  try {
    const auth = await oauth1Header('POST', url, {
      consumerKey: env('X_API_KEY'), consumerSecret: env('X_API_SECRET'),
      token: env('X_ACCESS_TOKEN'), tokenSecret: env('X_ACCESS_SECRET'),
    });
    const res = await fetch(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    return finish('x', 'x account', meta, res);
  } catch (e) {
    return finish('x', 'x account', meta, null, e);
  }
}
