// Lets citizens take part without an account: start a forum topic, reply,
// comment on a consultation, or vote in a poll — with a name and phone number.
// The phone is never stored; only a one-way hash, used for rate limiting and
// one-vote-per-person. Writes use the service role after validation.
//
// Deploy: supabase functions deploy community-action

import { CORS_HEADERS, json } from '../_shared/cors.ts';
import { normalizeUgPhone } from '../_shared/notify.ts';

const MAX_POSTS_PER_HOUR = 6;
const LINK_RE = /(https?:\/\/|www\.)/gi;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const svc = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };
    const db = async (path: string, init: RequestInit = {}) => {
      const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...svc, ...(init.headers || {}) } });
      const text = await r.text();
      let body: unknown = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { ok: r.ok, status: r.status, body, headers: r.headers };
    };

    const { action, name, phone, title, text, description, category, topic_id, consultation_id, poll_option_id } = await req.json();
    const displayName = String(name || '').trim().slice(0, 60);
    const normalized = normalizeUgPhone(phone);
    if (displayName.length < 2) return json({ error: 'Please give your name (it is shown with your post).' }, 400);
    if (!normalized) return json({ error: 'Please enter a valid phone number, e.g. 0772 123456. It is not shown publicly.' }, 400);
    const guestKey = await sha256(`nwsc-guest:${normalized}`);

    // Rate limit across all kinds of posts.
    if (action !== 'poll_vote') {
      const since = new Date(Date.now() - 3_600_000).toISOString();
      let recent = 0;
      for (const table of ['forum_topics', 'forum_posts', 'comments']) {
        const r = await db(`${table}?select=id&guest_key=eq.${guestKey}&created_at=gte.${encodeURIComponent(since)}`, {
          headers: { Prefer: 'count=exact', Range: '0-0' },
        });
        recent += Number((r.headers.get('content-range') || '').split('/')[1] || 0);
      }
      if (recent >= MAX_POSTS_PER_HOUR) return json({ error: 'You have posted a lot in the last hour. Please try again later.' }, 429);
    }

    const cleanText = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
    const tooManyLinks = (v: string) => (v.match(LINK_RE) || []).length > 1;

    if (action === 'forum_topic') {
      const t = cleanText(title, 150);
      const d = cleanText(description, 2000);
      if (t.length < 5) return json({ error: 'Give your topic a title of at least 5 characters.' }, 400);
      if (tooManyLinks(`${t} ${d}`)) return json({ error: 'Please include at most one link.' }, 400);
      const r = await db('forum_topics', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ title: t, description: d || null, category: category || 'General', author_name: displayName, guest_key: guestKey, created_by_guest: true }),
      });
      if (!r.ok) return json({ error: 'Could not start the discussion.' }, 500);
      return json({ ok: true, id: (r.body as { id: string }[])[0]?.id });
    }

    if (action === 'forum_reply') {
      const t = cleanText(text, 2000);
      if (!topic_id || t.length < 2) return json({ error: 'Write a reply first.' }, 400);
      if (tooManyLinks(t)) return json({ error: 'Please include at most one link.' }, 400);
      const r = await db('forum_posts', { method: 'POST', body: JSON.stringify({ topic_id, text: t, author_name: displayName, guest_key: guestKey }) });
      if (!r.ok) return json({ error: 'Could not post your reply.' }, 500);
      const topic = await db(`forum_topics?id=eq.${topic_id}&select=reply_count`);
      const count = ((topic.body as { reply_count: number }[])[0]?.reply_count || 0) + 1;
      await db(`forum_topics?id=eq.${topic_id}`, { method: 'PATCH', body: JSON.stringify({ reply_count: count }) });
      return json({ ok: true });
    }

    if (action === 'comment') {
      const t = cleanText(text, 2000);
      if (!consultation_id || t.length < 2) return json({ error: 'Write a comment first.' }, 400);
      if (tooManyLinks(t)) return json({ error: 'Please include at most one link.' }, 400);
      const r = await db('comments', { method: 'POST', body: JSON.stringify({ consultation_id, text: t, author_name: displayName, guest_key: guestKey }) });
      if (!r.ok) return json({ error: 'Could not post your comment.' }, 500);
      return json({ ok: true });
    }

    if (action === 'poll_vote') {
      if (!poll_option_id) return json({ error: 'Choose an option.' }, 400);
      const r = await db('rpc/cast_guest_vote', { method: 'POST', body: JSON.stringify({ p_option: poll_option_id, p_voter_key: guestKey }) });
      if (!r.ok) {
        const msg = (r.body as { message?: string })?.message || 'Could not record your vote.';
        return json({ error: msg }, r.status === 400 || /already voted/.test(msg) ? 409 : 500);
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('[community-action]', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
