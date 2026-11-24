import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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

// ---------- Remembered devices ----------
// After the first code, this device keeps a secret for the number, so next
// time the number alone signs in here. Other devices still need a code.
const DEVICES_KEY = 'nwsc_remembered_numbers';
export const normalizePhone = (p) => {
  const d = String(p || '').replace(/[^\d]/g, '');
  if (/^2567\d{8}$/.test(d)) return `+${d}`;
  if (/^07\d{8}$/.test(d)) return `+256${d.slice(1)}`;
  if (/^7\d{8}$/.test(d)) return `+256${d}`;
  return null;
};
async function readDevices() {
  try { return JSON.parse((await AsyncStorage.getItem(DEVICES_KEY)) || '{}'); } catch { return {}; }
}
async function writeDevices(map) { try { await AsyncStorage.setItem(DEVICES_KEY, JSON.stringify(map)); } catch { /* storage off */ } }
/** Numbers this device remembers, most recent first. */
export async function rememberedNumbers() {
  const map = await readDevices();
  return Object.entries(map).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).map(([phone]) => phone);
}
export async function forgetThisDevice(phone) {
  const map = await readDevices();
  if (phone) delete map[normalizePhone(phone) || phone]; else Object.keys(map).forEach((k) => delete map[k]);
  await writeDevices(map);
}
const deviceLabel = () => (Platform.OS === 'web' && typeof navigator !== 'undefined'
  ? (/Android/i.test(navigator.userAgent) ? 'Android phone' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone or iPad' : 'Computer')
  : Platform.OS);

/** Sign in on a remembered device with the number only. Returns false if a code is needed. */
export async function signInRemembered(phone) {
  const key = normalizePhone(phone);
  const map = await readDevices();
  if (!key || !map[key]?.secret) return false;
  try {
    const r = await call({ action: 'device', phone: key, device_secret: map[key].secret });
    const { error } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' });
    if (error) throw error;
    map[key].at = Date.now();
    await writeDevices(map);
    const token = await myProfileToken();
    if (token) await saveProfileToken(token);
    return true;
  } catch {
    delete map[key];
    await writeDevices(map);
    return false;
  }
}

/** Send a 6-digit sign-in code to a Ugandan mobile number. */
export const requestSignInCode = (phone) => call({ action: 'request', phone });

/** Check the code and start a normal session. Returns what was linked. */
export async function verifySignInCode(phone, code, remember = true) {
  const r = await call({ action: 'verify', phone, code, remember, label: deviceLabel() });
  if (r.device_secret) {
    const map = await readDevices();
    map[normalizePhone(phone)] = { secret: r.device_secret, at: Date.now() };
    await writeDevices(map);
  }
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

/** Sign out here and on every other device; every device needs a code next time. */
export async function signOutEverywhere() {
  await call({ action: 'forget_devices' });
  await forgetThisDevice();
  await supabase.auth.signOut({ scope: 'global' });
}

/** Delete the citizen's account (requests stay on record, unnamed). */
export async function deleteMyAccount() {
  await call({ action: 'delete' });
  await forgetThisDevice();
  await supabase.auth.signOut();
}

export const isCitizen = (user) => !!user && user.role === 'citizen';
