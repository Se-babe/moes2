import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../services/supabaseClient';
import { Card, Button, Select, Grid, Loading, EmptyState, useBreakpoint } from '../ui';
import BarList, { SERIES } from '../BarList';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../../theme';
import { fetchDepartments } from '../../services/staff';
import { downloadCsv, printReport, escapeHtml } from '../../utils/exportFile';

const RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7, bucket: 'day' },
  { key: '30d', label: 'Last 30 days', days: 30, bucket: 'week' },
  { key: '90d', label: 'Last 90 days', days: 90, bucket: 'week' },
  { key: '12m', label: 'Last 12 months', days: 365, bucket: 'month' },
];
const H = 3_600_000;
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmtH = (h) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function bucketStart(date, bucket) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (bucket === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (bucket === 'month') d.setDate(1);
  return d;
}
const bucketLabel = (d, bucket) =>
  bucket === 'month' ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Grouped bars: received vs resolved per period, with hover details and a table view. */
function TrendChart({ buckets }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...buckets.flatMap((b) => [b.received, b.resolved]));
  const H_PX = 180;
  return (
    <View>
      <View style={styles.chartHead}>
        <View style={styles.legend}>
          {[['Received', SERIES[0]], ['Resolved', SERIES[1]]].map(([l, c]) => (
            <View key={l} style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: c }]} /><Text style={TYPE.small}>{l}</Text></View>
          ))}
        </View>
        <Pressable onPress={() => setAsTable((t) => !t)} accessibilityRole="button">
          <Text style={styles.link}>{asTable ? 'Show chart' : 'Show as table'}</Text>
        </Pressable>
      </View>
      {asTable ? (
        <View>
          <View style={[styles.tr, styles.thRow]}>
            <Text style={[styles.th, { flex: 2 }]}>Period</Text><Text style={[styles.th, styles.num]}>Received</Text><Text style={[styles.th, styles.num]}>Resolved</Text>
          </View>
          {buckets.map((b) => (
            <View key={b.key} style={styles.tr}>
              <Text style={[styles.td, { flex: 2 }]}>{b.label}</Text><Text style={[styles.td, styles.num]}>{b.received}</Text><Text style={[styles.td, styles.num]}>{b.resolved}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View>
          <View style={[styles.plot, { height: H_PX }]}>
            {[0.5, 1].map((g) => <View key={g} style={[styles.grid, { bottom: H_PX * g }]} />)}
            {buckets.map((b, i) => (
              <Pressable
                key={b.key}
                style={styles.group}
                onHoverIn={() => setHover(i)}
                onHoverOut={() => setHover((h) => (h === i ? null : h))}
                onPress={() => setHover(i)}
                accessibilityLabel={`${b.label}: ${b.received} received, ${b.resolved} resolved`}
              >
                <View style={[styles.groupInner, hover === i && { backgroundColor: COLORS.gray100 }]}>
                  <View style={[styles.bar, { height: (b.received / max) * (H_PX - 8), backgroundColor: SERIES[0] }]} />
                  <View style={[styles.bar, { height: (b.resolved / max) * (H_PX - 8), backgroundColor: SERIES[1] }]} />
                </View>
                {hover === i && (
                  <View style={[styles.tip, i > buckets.length / 2 ? { right: 0 } : { left: 0 }]}>
                    <Text style={[TYPE.small, { fontWeight: '700', color: COLORS.gray900 }]}>{b.label}</Text>
                    <Text style={TYPE.small}>Received: <Text style={{ fontWeight: '700', color: COLORS.gray900 }}>{b.received}</Text></Text>
                    <Text style={TYPE.small}>Resolved: <Text style={{ fontWeight: '700', color: COLORS.gray900 }}>{b.resolved}</Text></Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
          <View style={styles.axis}>
            {buckets.map((b, i) => (
              <Text key={b.key} style={styles.tick} numberOfLines={1}>
                {buckets.length <= 14 || i % Math.ceil(buckets.length / 10) === 0 ? b.label : ''}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function ReportsDashboard({ user }) {
  const { isDesktop } = useBreakpoint();
  const isAdmin = user.role === 'admin';
  const [range, setRange] = useState(RANGES[1]);
  const [dept, setDept] = useState(isAdmin ? null : user.department_id);
  const [departments, setDepartments] = useState([]);
  const [rows, setRows] = useState(null);

  useEffect(() => { fetchDepartments().then(setDepartments).catch(() => {}); }, []);
  useEffect(() => {
    setRows(null);
    const from = new Date(Date.now() - range.days * 86_400_000).toISOString();
    let q = supabase.from('feedback')
      .select('reference_no, request_type, category, department_id, status, priority, created_at, first_response_at, resolved_at, escalation_level, satisfaction_rating')
      .gte('created_at', from).order('created_at', { ascending: true }).limit(10000);
    if (dept) q = q.eq('department_id', dept);
    q.then(({ data }) => setRows(data || []));
  }, [range, dept]);

  const deptName = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);

  const r = useMemo(() => {
    if (!rows) return null;
    const resolved = rows.filter((x) => x.resolved_at);
    const firstResp = rows.filter((x) => x.first_response_at).map((x) => (new Date(x.first_response_at) - new Date(x.created_at)) / H);
    const resolveT = resolved.map((x) => (new Date(x.resolved_at) - new Date(x.created_at)) / H);
    const rated = rows.filter((x) => x.satisfaction_rating);
    const avgSat = rated.length ? rated.reduce((s, x) => s + x.satisfaction_rating, 0) / rated.length : null;

    // Trend buckets covering the whole range, empty periods included.
    const buckets = [];
    const start = bucketStart(new Date(Date.now() - range.days * 86_400_000), range.bucket);
    for (let d = new Date(start); d <= new Date(); ) {
      buckets.push({ key: d.toISOString(), start: new Date(d), label: bucketLabel(d, range.bucket), received: 0, resolved: 0 });
      if (range.bucket === 'day') d.setDate(d.getDate() + 1);
      else if (range.bucket === 'week') d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
    }
    const idx = (date) => {
      const k = bucketStart(date, range.bucket).getTime();
      return buckets.findIndex((b) => b.start.getTime() === k);
    };
    rows.forEach((x) => { const i = idx(x.created_at); if (i >= 0) buckets[i].received += 1; });
    resolved.forEach((x) => { const i = idx(x.resolved_at); if (i >= 0) buckets[i].resolved += 1; });

    const group = (keyFn) => {
      const m = {};
      rows.forEach((x) => { const k = keyFn(x) || 'Unassigned'; (m[k] = m[k] || []).push(x); });
      return Object.entries(m).map(([label, xs]) => {
        const res = xs.filter((x) => x.resolved_at);
        const rt = xs.filter((x) => x.satisfaction_rating);
        return {
          label, value: xs.length, resolved: res.length,
          medianResolve: median(res.map((x) => (new Date(x.resolved_at) - new Date(x.created_at)) / H)),
          satisfaction: rt.length ? rt.reduce((s, x) => s + x.satisfaction_rating, 0) / rt.length : null,
        };
      }).sort((a, b) => b.value - a.value);
    };

    return {
      total: rows.length,
      resolved: resolved.length,
      onTime: resolved.filter((x) => x.escalation_level === 0).length,
      escalated: rows.filter((x) => x.escalation_level > 0).length,
      medFirst: median(firstResp),
      medResolve: median(resolveT),
      avgSat, rated: rated.length,
      satDist: [5, 4, 3, 2, 1].map((n) => ({ label: `${n} star${n === 1 ? '' : 's'}`, value: rated.filter((x) => x.satisfaction_rating === n).length })),
      buckets,
      byType: group((x) => x.request_type),
      byCategory: group((x) => x.category),
      byDept: group((x) => deptName[x.department_id]),
    };
  }, [rows, range, deptName]);

  const scopeLabel = dept ? deptName[dept] || 'Department' : 'All departments';

  const exportCsv = () => downloadCsv(`nwsc-requests-${range.key}.csv`, rows, [
    { label: 'Reference', key: 'reference_no' },
    { label: 'Type', key: 'request_type' },
    { label: 'Category', key: 'category' },
    { label: 'Department', value: (x) => deptName[x.department_id] || '' },
    { label: 'Priority', key: 'priority' },
    { label: 'Status', key: 'status' },
    { label: 'Submitted', key: 'created_at' },
    { label: 'First response', key: 'first_response_at' },
    { label: 'Resolved', key: 'resolved_at' },
    { label: 'Hours to resolve', value: (x) => (x.resolved_at ? ((new Date(x.resolved_at) - new Date(x.created_at)) / H).toFixed(1) : '') },
    { label: 'Escalation level', key: 'escalation_level' },
    { label: 'Satisfaction (1-5)', key: 'satisfaction_rating' },
  ]);

  const print = () => {
    const table = (title, list) => `<h2>${title}</h2><table><tr><th></th><th class="num">Received</th><th class="num">Resolved</th><th class="num">Rate</th><th class="num">Median to resolve</th><th class="num">Satisfaction</th></tr>${
      list.map((g) => `<tr><td>${escapeHtml(g.label)}</td><td class="num">${g.value}</td><td class="num">${g.resolved}</td><td class="num">${pct(g.resolved, g.value)}</td><td class="num">${fmtH(g.medianResolve)}</td><td class="num">${g.satisfaction ? g.satisfaction.toFixed(1) + ' / 5' : '—'}</td></tr>`).join('')}</table>`;
    const kpi = (l, v) => `<div class="kpi"><span class="muted">${l}</span><b>${v}</b></div>`;
    const ok = printReport(`NWSC Jinja — Service report`, `
      <h1>NWSC Jinja — Customer service report</h1>
      <div class="muted">${escapeHtml(range.label)} · ${escapeHtml(scopeLabel)}</div>
      <div class="kpis">${kpi('Requests received', r.total)}${kpi('Resolved', `${r.resolved} (${pct(r.resolved, r.total)})`)}${kpi('Median first response', fmtH(r.medFirst))}${kpi('Median time to resolve', fmtH(r.medResolve))}
      ${kpi('Resolved within target', pct(r.onTime, r.resolved))}${kpi('Escalated', r.escalated)}${kpi('Customer satisfaction', r.avgSat ? r.avgSat.toFixed(1) + ' / 5' : '—')}${kpi('Ratings received', r.rated)}</div>
      <h2>Trend</h2><table><tr><th>Period</th><th class="num">Received</th><th class="num">Resolved</th></tr>${r.buckets.map((b) => `<tr><td>${escapeHtml(b.label)}</td><td class="num">${b.received}</td><td class="num">${b.resolved}</td></tr>`).join('')}</table>
      ${table('By type', r.byType)}${table('By category', r.byCategory)}${isAdmin && !dept ? table('By department', r.byDept) : ''}`);
    if (!ok) exportCsv();
  };

  return (
    <View style={{ gap: SPACE.xl }}>
      <View style={[styles.filters, !isDesktop && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={styles.chips}>
          {RANGES.map((x) => (
            <Pressable key={x.key} onPress={() => setRange(x)} style={[styles.chip, range.key === x.key && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: range.key === x.key }}>
              <Text style={[styles.chipText, range.key === x.key && { color: '#fff' }]}>{x.label}</Text>
            </Pressable>
          ))}
        </View>
        {isAdmin && (
          <Select
            style={{ marginBottom: 0, minWidth: 240 }}
            value={dept}
            options={[{ value: null, label: 'All departments' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
            onChange={setDept}
          />
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="CSV" icon="download-outline" size="sm" variant="secondary" disabled={!rows?.length} onPress={exportCsv} />
          {Platform.OS === 'web' && <Button title="Print / PDF" icon="print-outline" size="sm" variant="secondary" disabled={!r} onPress={print} />}
        </View>
      </View>

      {!r ? <Loading label="Building report…" /> : r.total === 0 ? (
        <Card><EmptyState icon="bar-chart-outline" title="No requests in this period" message="Try a longer date range." /></Card>
      ) : (
        <>
          <Grid columns={4} minItemWidth={190} gap={SPACE.lg}>
            {[
              ['Requests received', r.total, 'file-tray-outline'],
              ['Resolved', `${r.resolved} · ${pct(r.resolved, r.total)}`, 'checkmark-done-outline'],
              ['Median first response', fmtH(r.medFirst), 'flash-outline'],
              ['Median time to resolve', fmtH(r.medResolve), 'hourglass-outline'],
              ['Resolved within target', pct(r.onTime, r.resolved), 'ribbon-outline'],
              ['Escalated', r.escalated, 'alert-circle-outline'],
              ['Customer satisfaction', r.avgSat ? `${r.avgSat.toFixed(1)} / 5` : '—', 'happy-outline'],
              [`Ratings received (${pct(r.rated, r.resolved)} of resolved)`, r.rated, 'star-outline'],
            ].map(([label, value, icon]) => (
              <Card key={label} style={styles.kpi}>
                <Ionicons name={icon} size={18} color={COLORS.primary} />
                <Text style={styles.kpiValue}>{value}</Text>
                <Text style={TYPE.small}>{label}</Text>
              </Card>
            ))}
          </Grid>

          <Card>
            <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Requests received vs resolved</Text>
            <TrendChart buckets={r.buckets} />
          </Card>

          <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
            <Card style={styles.col}>
              <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>By type</Text>
              <BarList rows={r.byType.map((g) => ({ label: g.label, value: g.value, note: `· ${pct(g.resolved, g.value)} resolved` }))} />
            </Card>
            <Card style={styles.col}>
              <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Customer satisfaction</Text>
              {r.rated ? <BarList rows={r.satDist} /> : <Text style={TYPE.small}>No ratings yet. Customers can rate a request on the tracking page once it is resolved.</Text>}
            </Card>
          </View>

          <Card>
            <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>By category</Text>
            <BarList rows={r.byCategory.map((g) => ({ label: g.label, value: g.value, note: `· ${pct(g.resolved, g.value)} resolved` }))} />
          </Card>

          {isAdmin && !dept && (
            <Card padded={false}>
              <Text style={[TYPE.h3, { padding: SPACE.lg }]}>By department</Text>
              <View style={[styles.tr, styles.thRow]}>
                <Text style={[styles.th, { flex: 3 }]}>Department</Text>
                <Text style={[styles.th, styles.num]}>Received</Text>
                <Text style={[styles.th, styles.num]}>Resolved</Text>
                {isDesktop && <Text style={[styles.th, styles.num]}>Median resolve</Text>}
                <Text style={[styles.th, styles.num]}>Satisfaction</Text>
              </View>
              {r.byDept.map((g) => (
                <View key={g.label} style={styles.tr}>
                  <Text style={[styles.td, { flex: 3 }]}>{g.label}</Text>
                  <Text style={[styles.td, styles.num]}>{g.value}</Text>
                  <Text style={[styles.td, styles.num]}>{g.resolved} ({pct(g.resolved, g.value)})</Text>
                  {isDesktop && <Text style={[styles.td, styles.num]}>{fmtH(g.medianResolve)}</Text>}
                  <Text style={[styles.td, styles.num]}>{g.satisfaction ? `${g.satisfaction.toFixed(1)} / 5` : '—'}</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray700 },
  kpi: { padding: SPACE.lg, gap: 4, height: '100%' },
  kpiValue: { fontFamily: FONT, fontSize: 22, fontWeight: '800', color: COLORS.gray900, marginTop: 4 },
  cols: { flexDirection: 'row', gap: SPACE.xl },
  col: { flex: 1, width: '100%' },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE.md },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  link: { fontFamily: FONT, color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: COLORS.gray300, position: 'relative' },
  grid: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.gray100 },
  group: { flex: 1, height: '100%', justifyContent: 'flex-end', position: 'relative' },
  groupInner: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: '100%', paddingHorizontal: 2, borderRadius: 4 },
  bar: { flex: 1, maxWidth: 18, minHeight: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tip: {
    position: 'absolute', bottom: '100%', marginBottom: 6, zIndex: 10, minWidth: 130, padding: 8, borderRadius: 8,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200, ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(15,23,42,0.12)' } : null),
  },
  axis: { flexDirection: 'row', marginTop: 6 },
  tick: { flex: 1, fontFamily: FONT, fontSize: 11, color: COLORS.gray500, textAlign: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  thRow: { backgroundColor: COLORS.gray50, borderTopWidth: 0 },
  th: { fontFamily: FONT, fontSize: 11.5, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontFamily: FONT, fontSize: 14, color: COLORS.gray800 },
  num: { flex: 1.3, textAlign: 'right' },
});
