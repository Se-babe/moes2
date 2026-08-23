// Sends transactional emails via Resend, keeping the API key server-side
// (same reasoning as chat-completion: never ship a billed/metered key in
// client code). Called directly from admin action handlers right after a
// status-changing DB write succeeds — see AdminConsultations.js (approve/
// reject a proposal) and AdminOpportunities.js (mark an application
// "Contacted").
//
// Deploy: supabase functions deploy send-email
// Set the secret once: supabase secrets set RESEND_API_KEY=your-real-key
//
// Note: until you verify your own sending domain in Resend, the default
// "onboarding@resend.dev" sender can only deliver to the email address
// your Resend account itself is registered with — real citizen emails
// won't arrive until a domain is verified. Set RESEND_FROM as a secret
// once you have a verified domain (e.g. "MoES <noreply@yourdomain.go.ug>").

const RESEND_URL = 'https://api.resend.com/emails';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'to, subject, and html are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured on the server' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const from = Deno.env.get('RESEND_FROM') || 'MoES e-Participation <onboarding@resend.dev>';

    const resendRes = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    const data = await resendRes.json();
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: data?.message || `Resend request failed (${resendRes.status})` }), {
        status: resendRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id: data.id }), {
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
