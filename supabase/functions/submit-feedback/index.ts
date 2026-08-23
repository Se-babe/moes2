// Replaces the old direct "anyone can submit feedback" RLS policy (removed
// in migration_abuse_protection.sql). Verifies a Turnstile token first, then
// writes with the service role key — this is the only way into the
// `feedback` table now, so a bot skipping the UI and hitting the REST API
// directly (the actual threat model here) gets nothing without a real token.
//
// Deploy: supabase functions deploy submit-feedback
// Secret (shared with propose-consultation):
//   supabase secrets set TURNSTILE_SECRET_KEY=your-real-secret-key

import { verifyTurnstile, CORS_HEADERS } from '../_shared/turnstile.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { title, description, category, image_url, latitude, longitude, turnstileToken } = await req.json();

    if (!title || !String(title).trim()) {
      return new Response(JSON.stringify({ error: 'Title is required.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const remoteip = req.headers.get('cf-connecting-ip') || undefined;
    const verified = await verifyTurnstile(turnstileToken, remoteip);
    if (!verified) {
      return new Response(JSON.stringify({ error: 'Verification failed. Please try again.' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        category: category || 'General',
        image_url: image_url || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        status: 'Submitted',
        user_id: 'anonymous',
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('[submit-feedback] insert failed:', errText);
      return new Response(JSON.stringify({ error: 'Could not save feedback.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
