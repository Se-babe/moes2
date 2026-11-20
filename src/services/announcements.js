import { supabase } from './supabaseClient';

export const ANNOUNCEMENT_CATEGORIES = [
  { value: 'Planned interruption', icon: 'construct-outline', tone: 'warning' },
  { value: 'Emergency', icon: 'alert-circle-outline', tone: 'danger' },
  { value: 'Restoration', icon: 'checkmark-circle-outline', tone: 'success' },
  { value: 'Service notice', icon: 'information-circle-outline', tone: 'info' },
  { value: 'Tariffs & billing', icon: 'receipt-outline', tone: 'brand' },
  { value: 'General', icon: 'megaphone-outline', tone: 'neutral' },
];
export const categoryMeta = (c) => ANNOUNCEMENT_CATEGORIES.find((x) => x.value === c) || ANNOUNCEMENT_CATEGORIES[5];

export const STATUS_META = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Awaiting approval', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  published: { label: 'Published', tone: 'success' },
  rejected: { label: 'Needs changes', tone: 'danger' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export async function fetchAreas() {
  const { data } = await supabase.from('service_areas').select('name').eq('is_active', true).order('display_order');
  return (data || []).map((a) => a.name);
}

/** Published announcements for the public, optionally filtered. */
export async function fetchPublished({ area, category, limit = 100 } = {}) {
  let q = supabase.from('announcements')
    .select('id, title, body, category, areas, published_at, updated_at, expires_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (category) q = q.eq('category', category);
  if (area) q = q.or(`areas.cs.{"${area.replace(/"/g, '')}"},areas.eq.{}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchAnnouncement(id) {
  const { data, error } = await supabase.from('announcements').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Staff view. filter: 'all' | 'mine' | 'review' | a status. */
export async function fetchStaffAnnouncements(filter, userId) {
  let q = supabase.from('announcements').select('*').order('updated_at', { ascending: false }).limit(200);
  if (filter === 'mine') q = q.eq('author_id', userId);
  else if (filter === 'review') q = q.eq('status', 'pending');
  else if (filter !== 'all') q = q.eq('status', filter);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveAnnouncement(row, userId) {
  const payload = {
    title: row.title.trim(),
    body: row.body.trim(),
    category: row.category,
    areas: row.areas || [],
    publish_at: row.publish_at || null,
    expires_at: row.expires_at || null,
    notify_sms: !!row.notify_sms,
    notify_email: !!row.notify_email,
    notify_whatsapp: !!row.notify_whatsapp,
    notify_social: !!row.notify_social,
    starts_at: row.category === 'Planned interruption' ? row.starts_at || null : null,
    status: row.status,
  };
  const res = row.id
    ? await supabase.from('announcements').update(payload).eq('id', row.id).select('id').single()
    : await supabase.from('announcements').insert({ ...payload, author_id: userId }).select('id').single();
  if (res.error) throw res.error;
  return res.data.id;
}

export async function reviewAnnouncement(id, decision, note) {
  const { data, error } = await supabase.rpc('review_announcement', { p_id: id, p_decision: decision, p_note: note || null });
  if (error) throw error;
  if (data === 'published') dispatchAlerts();
  return data;
}

/** Ask the server to send alerts for anything newly published (fire and forget). */
export function dispatchAlerts() {
  supabase.functions.invoke('announcement-dispatch', { body: {} }).catch(() => {});
}

export async function subscribeAlerts({ name, phone, email, areas, categories, language, whatsapp }) {
  const { data, error } = await supabase.rpc('subscribe_alerts', {
    p_name: name || null, p_phone: phone || null, p_email: email || null,
    p_areas: areas || [], p_categories: categories || [], p_language: language || 'en',
    p_whatsapp: !!whatsapp && !!phone,
  });
  if (error) throw error;
  return data;
}

export async function unsubscribeAlerts(token) {
  const { data, error } = await supabase.rpc('unsubscribe_alerts', { p_token: token });
  if (error) throw error;
  return !!data;
}

export const CHANNELS = {
  sms: { label: 'SMS', icon: 'chatbubble-outline' },
  whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp' },
  email: { label: 'Email', icon: 'mail-outline' },
  telegram: { label: 'Telegram', icon: 'paper-plane-outline' },
  facebook: { label: 'Facebook', icon: 'logo-facebook' },
  x: { label: 'X', icon: 'logo-x' },
};

/** Delivery counts per announcement: { [id]: [{ channel, purpose, queued, sent, failed, skipped, next_at }] } */
export async function fetchDelivery(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('announcement_delivery', { p_ids: ids });
  if (error) return {};
  const out = {};
  for (const r of data || []) (out[r.announcement_id] ||= []).push(r);
  return out;
}

// ---------- Admin: citizen alert channels ----------
export async function fetchNotificationSummary(days = 7) {
  const { data, error } = await supabase.rpc('notification_summary', { p_days: days });
  if (error) throw error;
  return data;
}

export async function fetchChannelStatus() {
  const { data, error } = await supabase.functions.invoke('announcement-dispatch', { body: { action: 'status' } });
  if (error) throw error;
  return data;
}

export async function sendTestAlert(channel) {
  const { data, error } = await supabase.functions.invoke('announcement-dispatch', { body: { action: 'test', channel } });
  if (error) {
    const msg = await error.context?.json?.().then((b) => b?.error).catch(() => null);
    throw new Error(msg || error.message);
  }
  return data;
}

export async function retryFailedAlerts() {
  const { data, error } = await supabase.rpc('retry_failed_notifications');
  if (error) throw error;
  dispatchAlerts();
  return data;
}

export async function fetchRecentProblems(limit = 20) {
  const { data, error } = await supabase.from('notification_outbox')
    .select('id, channel, purpose, recipient, status, attempts, last_error, updated_at, announcement_id')
    .in('status', ['failed', 'skipped'])
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
