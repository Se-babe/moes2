import { supabase } from './supabaseClient';

// Data access for the staff portal and admin console. Row-level security in
// the database decides what each staff member can see; these helpers just
// shape the queries.

export const STAFF_ROLES = ['officer', 'supervisor', 'admin'];
export const isStaffRole = (role) => STAFF_ROLES.includes(role);
export const OPEN_STATUSES = ['Submitted', 'Assigned', 'In Progress', 'Escalated'];
export const ALL_STATUSES = [...OPEN_STATUSES, 'Resolved', 'Closed'];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const REQUEST_COLUMNS =
  'id, reference_no, request_type, category, title, status, priority, created_at, updated_at, due_at, ' +
  'escalation_level, department_id, assigned_to, first_response_at, resolved_at';

/**
 * scope: 'mine' | 'department' | 'all'   status: 'open' | a status | 'all'
 */
export async function fetchQueue({ scope = 'mine', status = 'open', search = '', userId, departmentId, limit = 200 } = {}) {
  let q = supabase.from('feedback').select(REQUEST_COLUMNS).limit(limit);
  if (scope === 'mine' && userId) q = q.eq('assigned_to', userId);
  if (scope === 'department' && departmentId) q = q.eq('department_id', departmentId);
  if (scope === 'unassigned') q = q.is('assigned_to', null);
  if (status === 'open') q = q.in('status', OPEN_STATUSES);
  else if (status === 'overdue') q = q.in('status', OPEN_STATUSES).lt('due_at', new Date().toISOString());
  else if (status !== 'all') q = q.eq('status', status);
  const s = search.trim().replace(/[,()%*\\]/g, ' ').trim();
  if (s) q = q.or(`reference_no.ilike.%${s}%,title.ilike.%${s}%`);
  q = status === 'open' || status === 'overdue'
    ? q.order('due_at', { ascending: true, nullsFirst: false })
    : q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchRequest(id) {
  const { data, error } = await supabase.from('feedback').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchTimeline(requestId) {
  const { data, error } = await supabase
    .from('request_updates')
    .select('id, status, message, is_public, author_id, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchDepartments() {
  const { data, error } = await supabase.from('departments').select('*').order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Staff the caller is allowed to see (their department, or all for admins). */
export async function fetchStaff() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, department_id, job_title, is_active, avatar_url')
    .in('role', STAFF_ROLES)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchWorkload() {
  const { data, error } = await supabase.rpc('staff_workload');
  if (error) throw error;
  return data || [];
}

/** Calls the request-action Edge Function and surfaces its error message. */
export async function performRequestAction(payload) {
  const { data, error } = await supabase.functions.invoke('request-action', { body: payload });
  if (error) {
    const msg = await error.context?.json?.().then((b) => b?.error).catch(() => null);
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchMyNotifications(limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markNotificationsRead(ids) {
  if (!ids.length) return;
  await supabase.from('notifications').update({ read: true }).in('id', ids);
}

// ---- Presentation helpers ----
export const PRIORITY_TONE = { Low: 'neutral', Normal: 'info', High: 'warning', Urgent: 'danger' };

export function dueInfo(due_at, status) {
  if (!due_at || !OPEN_STATUSES.includes(status)) return null;
  const ms = new Date(due_at).getTime() - Date.now();
  const hours = Math.round(Math.abs(ms) / 3_600_000);
  const label = hours >= 48 ? `${Math.round(hours / 24)}d` : `${Math.max(hours, 0)}h`;
  if (ms < 0) return { text: `Overdue ${label}`, tone: 'danger' };
  if (ms < 12 * 3_600_000) return { text: `Due in ${label}`, tone: 'warning' };
  return { text: `Due in ${label}`, tone: 'neutral' };
}

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
