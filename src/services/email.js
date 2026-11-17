import { supabase } from './supabaseClient';

// Fire-and-forget: email delivery should never block or fail an admin
// action (e.g. approving a consultation still succeeds even if the
// email can't be sent — a Resend outage or unverified domain shouldn't
// stop NWSC from doing its actual job).
export const sendEmail = async (to, subject, html) => {
  if (!to) return;
  try {
    const { error } = await supabase.functions.invoke('send-email', { body: { to, subject, html } });
    if (error) console.error('[sendEmail] failed:', error);
  } catch (e) {
    console.error('[sendEmail] failed:', e);
  }
};
