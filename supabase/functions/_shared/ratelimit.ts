// Basic abuse protection for the public forms (replaces the old Cloudflare
// Turnstile check): limits how many rows the same phone/email can create in
// a time window. Counts existing rows with the service role key.

export async function countRecent(table: string, column: string, value: string, minutes: number): Promise<number> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const q = `${url}/rest/v1/${table}?select=id&${column}=eq.${encodeURIComponent(value)}&created_at=gte.${encodeURIComponent(since)}`;
  const res = await fetch(q, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = res.headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

/** True if any of the given contact values has hit `max` submissions within `minutes`. */
export async function isRateLimited(
  table: string,
  contacts: Array<[column: string, value: string | null | undefined]>,
  max: number,
  minutes: number,
): Promise<boolean> {
  for (const [column, value] of contacts) {
    if (!value) continue;
    if ((await countRecent(table, column, value, minutes)) >= max) return true;
  }
  return false;
}
