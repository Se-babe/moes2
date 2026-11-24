import { supabase } from './supabaseClient';
import { saveProfileToken } from './announcements';

async function call(body) {
  const { data, error } = await supabase.functions.invoke('citizen-auth', { body });
  if (error) {
    const msg = await error.context?.json?.().then((b) => b?.error).catch(() => null);
    throw new Error(msg || 'Could not reach the server. Check your connection and try again.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Send a 6-digit sign-in code to a Ugandan mobile number. */
export const requestSignInCode = (phone) => call({ action: 'request', phone });

/** Check the code and start a normal session. Returns what was linked. */
export async function verifySignInCode(phone, code) {
  const r = await call({ action: 'verify', phone, code });
  const { error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' });
  if (error) throw new Error('Could not sign you in. Please ask for a new code.');
  const token = await myProfileToken();
  if (token) await saveProfileToken(token);
  return r.linked || {};
}

export async function myProfileToken() {
  const { data } = await supabase.rpc('my_profile_token');
  return data || null;
}

export async function claimProfile(token) {
  const { data } = await supabase.rpc('claim_profile', { p_token: token });
  return !!data;
}

export async function mySignedInRequests() {
  const { data } = await supabase.rpc('my_requests');
  return data || [];
}

/** Delete the citizen's account (requests stay on record, unnamed). */
export async function deleteMyAccount() {
  await call({ action: 'delete' });
  await supabase.auth.signOut();
}

export const isCitizen = (user) => !!user && user.role === 'citizen';
