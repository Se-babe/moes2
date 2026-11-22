import { Platform, Share } from 'react-native';

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** rows: array of plain objects; columns: [{ key, label }] */
export function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n');
}

export async function downloadCsv(filename, rows, columns) {
  const csv = '﻿' + toCsv(rows, columns); // BOM so Excel reads UTF-8
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    await Share.share({ title: filename, message: csv });
  }
}

/** Opens a clean, printable report; the browser's print dialog can save it as PDF. */
export function printReport(title, bodyHtml) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;color:#0F172A;margin:32px;font-size:13px}
    h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:24px 0 8px}
    .muted{color:#64748B} table{border-collapse:collapse;width:100%;margin-top:6px}
    th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #E2E8F0} th{background:#F8FAFC;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#475569}
    td.num,th.num{text-align:right} .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
    .kpi{border:1px solid #E2E8F0;border-radius:8px;padding:10px} .kpi b{display:block;font-size:20px}
    @media print{body{margin:12mm}}
  </style></head><body>${bodyHtml}
  <p class="muted" style="margin-top:32px">Generated ${new Date().toLocaleString()} · NWSC Jinja e-Participation</p>
  <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
  return true;
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Several files in one compressed .zip (smaller to download on mobile data).
 * files: { 'name.csv': string | Uint8Array }. The zip library loads on demand.
 */
export async function downloadZip(filename, files) {
  const { zipSync, strToU8 } = await import('fflate');
  const entries = Object.fromEntries(Object.entries(files).map(([name, data]) => [name, typeof data === 'string' ? strToU8(data) : data]));
  const zipped = zipSync(entries, { level: 9 });
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const [first] = Object.entries(files);
    await Share.share({ title: filename, message: typeof first?.[1] === 'string' ? first[1] : filename });
  }
}

/** CSV text with a UTF-8 BOM so spreadsheet programs read it correctly. */
export const csvText = (rows, columns) => '﻿' + toCsv(rows, columns);
