// Replaces the old direct "anyone can propose a consultation" RLS policy
// (removed in migration_abuse_protection.sql). Same reasoning as
// submit-feedback: verifies Turnstile first, then writes with the service
// role key — the client can no longer insert into `consultations` directly.
//
// Deploy: supabase functions deploy propose-consultation
// Secret (shared with submit-feedback):
//   supabase secrets set TURNSTILE_SECRET_KEY=your-real-secret-key

import { verifyTurnstile, CORS_HEADERS } from '../_shared/turnstile.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const {
      title, description, category, closing_date,
      proposer_email, proposer_phone, image_url, turnstileToken,
    } = await req.json();

    if (!title || !String(title).trim() || !proposer_email || !proposer_phone) {
      return new Response(JSON.stringify({ error: 'Title, email, and phone are required.' }), {
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

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/consultations?select=id`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        category: category || null,
        closing_date: closing_date || null,
        proposer_email: String(proposer_email).trim(),
        proposer_phone: String(proposer_phone).trim(),
        image_url: image_url || null,
        is_active: false,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('[propose-consultation] insert failed:', errText);
      return new Response(JSON.stringify({ error: 'Could not save your proposal.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const [row] = await insertRes.json();
    return new Response(JSON.stringify({ ok: true, id: row?.id }), {
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
