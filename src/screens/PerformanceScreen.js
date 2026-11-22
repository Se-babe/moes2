import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PageHeader, Container, Card, Button, Grid, Loading, useBreakpoint } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { supabase } from '../services/supabaseClient';
import { downloadZip, csvText } from '../utils/exportFile';

// Chart colours (validated: lightness, colour-blind separation). The aqua is
// below 3:1 against white, so every chart also has numbers and a table view.
const SERIES = { received: '#2a78d6', resolved: '#1baf7a' };
const BAR = '#2a78d6';

const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
const hours = (h) => (h == null ? '—' : Number(h) < 48 ? `${Number(h).toFixed(1)} h` : `${(Number(h) / 24).toFixed(1)} days`);

function Tile({ icon, label, value, hint }) {
  return (
    <Card style={{ gap: 4, height: '100%' }}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.big}>{value}</Text>
      <Text style={TYPE.label}>{label}</Text>
      {hint ? <Text style={TYPE.small}>{hint}</Text> : null}
    </Card>
  );
}

/** Received vs resolved per month: grouped bars, shared axis, legend, hover values. */
function MonthChart({ data }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...(data || []).flatMap((d) => [d.received, d.resolved]));
  const H = 180;
  return (
    <View>
      <View style={styles.legend}>
        {Object.entries(SERIES).map(([k, c]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: c }]} />
            <Text style={TYPE.small}>{k === 'received' ? 'Received' : 'Resolved'}</Text>
          </View>
        ))}
      </View>
      <View style={styles.plot}>
        <View style={[styles.axis, { height: H }]}>
          <Text style={styles.tick}>{max}</Text>
          <Text style={styles.tick}>{Math.round(max / 2)}</Text>
          <Text style={styles.tick}>0</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.grid, { height: H }]}>
            {[0, 0.5, 1].map((p) => <View key={p} style={[styles.gridLine, { bottom: p * H }]} />)}
            <View style={styles.bars}>
              {data.map((d) => (
                <Pressable
                  key={d.month}
                  onHoverIn={() => setHover(d)} onHoverOut={() => setHover(null)} onPressIn={() => setHover(d)}
                  style={styles.group}
                  accessibilityLabel={`${monthLabel(d.month)}: ${d.received} received, ${d.resolved} resolved`}
                >
                  {['received', 'resolved'].map((k) => (
                    <View key={k} style={[styles.bar, { height: Math.max(d[k] ? 3 : 0, (d[k] / max) * H), backgroundColor: SERIES[k], opacity: hover && hover !== d ? 0.45 : 1 }]} />
                  ))}
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.xLabels}>
            {data.map((d, i) => (
              <Text key={d.month} style={[styles.tick, { flex: 1, textAlign: 'center' }]}>{data.length > 12 && i % 2 ? '' : monthLabel(d.month)}</Text>
            ))}
          </View>
        </View>
      </View>
      <Text style={[TYPE.small, { minHeight: 20, marginTop: 4 }]} accessibilityLiveRegion="polite">
        {hover ? `${new Date(`${hover.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}: ${hover.received} received · ${hover.resolved} resolved` : 'Hover or tap a month to see its numbers.'}
      </Text>
    </View>
  );
}

/** One measure across categories: horizontal bars with the value beside each. */
function Bars({ rows, note }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Text style={TYPE.small}>No data yet.</Text>;
  return (
    <View style={{ gap: 10 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 4 }} accessibilityLabel={`${r.label}: ${r.value}`}>
          <View style={styles.barHead}>
            <Text style={[TYPE.small, { color: COLORS.gray800, flex: 1 }]} numberOfLines={1}>{r.label}</Text>
            <Text style={[TYPE.small, { color: COLORS.gray800, fontWeight: '700' }]}>{r.value}{note ? note(r) : ''}</Text>
          </View>
          <View style={styles.track}><View style={[styles.hbar, { width: `${(r.value / max) * 100}%` }]} /></View>
        </View>
      ))}
    </View>
  );
}

function Table({ head, rows }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tr, { backgroundColor: COLORS.gray50 }]}>
        {head.map((h, i) => <Text key={h} style={[styles.th, i === 0 && { flex: 2 }]}>{h}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[styles.tr, styles.border]}>
          {r.map((c, j) => <Text key={j} style={[styles.td, j === 0 && { flex: 2 }]}>{c}</Text>)}
        </View>
      ))}
    </View>
  );
}

export default function PerformanceScreen() {
  const { isDesktop } = useBreakpoint();
  const [months, setMonths] = useState(12);
  const [data, setData] = useState(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    setData(null);
    supabase.rpc('public_performance', { p_months: months }).then(({ data: d }) => setData(d && !Array.isArray(d) ? d : {}));
  }, [months]);

  const t = data?.totals || {};
  const rate = t.received ? Math.round((100 * t.resolved) / t.received) : null;

  const download = () => downloadZip(`nwsc-jinja-performance-${months}m.zip`, {
    'monthly.csv': csvText((data.by_month || []), [{ label: 'Month', key: 'month' }, { label: 'Received', key: 'received' }, { label: 'Resolved', key: 'resolved' }]),
    'by-type.csv': csvText((data.by_type || []), [{ label: 'Type', key: 'label' }, { label: 'Requests', key: 'value' }]),
    'by-category.csv': csvText((data.by_category || []), [{ label: 'Category', key: 'label' }, { label: 'Requests', key: 'value' }, { label: 'Resolved', key: 'resolved' }]),
    'by-channel.csv': csvText((data.by_channel || []), [{ label: 'Channel', key: 'label' }, { label: 'Requests', key: 'value' }]),
    'satisfaction.csv': csvText((data.ratings || []), [{ label: 'Rating', key: 'label' }, { label: 'Count', key: 'value' }]),
    'summary.json': JSON.stringify({ ...data.totals, participation: data.participation, generated_at: data.generated_at, months }, null, 2),
    'README.txt': 'NWSC Jinja e-Participation — public performance data.\nCounts of customer requests; no personal information.\nOpen the .csv files in Excel, Google Sheets or LibreOffice.\n',
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader overline="Open data" title="How we're doing"
        subtitle="Live figures on customer requests, response times, resolution and satisfaction at NWSC Jinja. No personal information is shown." icon="stats-chart-outline" />
      <Container style={{ marginTop: -24, gap: SPACE.xl }}>
        <Card elevated style={styles.toolbar}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {[6, 12, 24].map((m) => (
              <Pressable key={m} onPress={() => setMonths(m)} style={[styles.chip, months === m && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: months === m }}>
                <Text style={[styles.chipText, months === m && { color: '#fff' }]}>Last {m} months</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button title={asTable ? 'Show charts' : 'Show as tables'} icon={asTable ? 'bar-chart-outline' : 'grid-outline'} size="sm" variant="ghost" onPress={() => setAsTable((v) => !v)} />
            {data ? <Button title="Download data (ZIP)" icon="archive-outline" size="sm" variant="secondary" onPress={download} /> : null}
          </View>
        </Card>

        {data === null ? <Loading /> : (
          <>
            <Grid columns={5} minItemWidth={150} gap={SPACE.md}>
              <Tile icon="file-tray-full-outline" label="Requests received" value={t.received ?? 0} hint={`${t.open ?? 0} still open`} />
              <Tile icon="checkmark-done-outline" label="Resolved" value={rate == null ? '—' : `${rate}%`} hint={`${t.resolved ?? 0} requests`} />
              <Tile icon="flash-outline" label="First response" value={hours(t.avg_first_response_hours)} hint="Average time to first reply" />
              <Tile icon="timer-outline" label="Resolved on time" value={t.on_time_pct == null ? '—' : `${t.on_time_pct}%`} hint={`Average ${hours(t.avg_resolution_hours)} to resolve`} />
              <Tile icon="star-outline" label="Satisfaction" value={t.satisfaction ? `${Number(t.satisfaction).toFixed(1)} / 5` : '—'} hint={`${t.ratings ?? 0} ratings`} />
            </Grid>

            <Card style={{ gap: SPACE.md }}>
              <Text style={TYPE.h3}>Requests received and resolved each month</Text>
              {asTable
                ? <Table head={['Month', 'Received', 'Resolved']} rows={(data.by_month || []).map((d) => [d.month, d.received, d.resolved])} />
                : <MonthChart data={(data.by_month || [])} />}
            </Card>

            <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
              <Card style={styles.col}>
                <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>By category</Text>
                {asTable
                  ? <Table head={['Category', 'Requests', 'Resolved']} rows={(data.by_category || []).map((r) => [r.label, r.value, r.resolved])} />
                  : <Bars rows={(data.by_category || [])} note={(r) => ` · ${r.value ? Math.round((100 * r.resolved) / r.value) : 0}% resolved`} />}
              </Card>
              <Card style={styles.col}>
                <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Enquiries, complaints, suggestions</Text>
                {asTable ? <Table head={['Type', 'Requests']} rows={(data.by_type || []).map((r) => [r.label, r.value])} /> : <Bars rows={(data.by_type || [])} />}
              </Card>
            </View>
            <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
              <Card style={styles.col}>
                <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>How requests reached us</Text>
                {asTable ? <Table head={['Channel', 'Requests']} rows={(data.by_channel || []).map((r) => [r.label, r.value])} /> : <Bars rows={(data.by_channel || [])} />}
              </Card>
              <Card style={styles.col}>
                <Text style={[TYPE.h3, { marginBottom: SPACE.md }]}>Customer satisfaction ratings</Text>
                {asTable ? <Table head={['Rating', 'Count']} rows={(data.ratings || []).map((r) => [r.label, r.value])} /> : <Bars rows={(data.ratings || [])} />}
              </Card>
            </View>

            <Grid columns={4} minItemWidth={150} gap={SPACE.md}>
              <Tile icon="document-text-outline" label="Open consultations" value={data.participation?.consultations_open ?? 0} />
              <Tile icon="clipboard-outline" label="Open surveys" value={data.participation?.surveys_open ?? 0} />
              <Tile icon="notifications-outline" label="Alert subscribers" value={data.participation?.subscribers ?? 0} />
              <Tile icon="megaphone-outline" label="Service notices published" value={data.participation?.announcements ?? 0} />
            </Grid>
            <Text style={TYPE.small}>Updated {new Date(data.generated_at || Date.now()).toLocaleString()}. Figures count requests made in the period shown.</Text>
          </>
        )}
      </Container>
      <View style={{ height: SPACE.xxl }} />
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  big: { fontFamily: FONT, fontSize: 24, fontWeight: '800', color: COLORS.gray900 },
  legend: { flexDirection: 'row', gap: SPACE.lg, marginBottom: SPACE.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  plot: { flexDirection: 'row', gap: 6 },
  axis: { justifyContent: 'space-between', alignItems: 'flex-end', width: 28 },
  tick: { fontFamily: FONT, fontSize: 11, color: COLORS.gray500 },
  grid: { position: 'relative', justifyContent: 'flex-end' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.gray200 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 2 },
  group: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: '100%', paddingHorizontal: 2 },
  bar: { flex: 1, maxWidth: 16, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xLabels: { flexDirection: 'row', gap: 2, marginTop: 4 },
  cols: { flexDirection: 'row', gap: SPACE.xl, alignItems: 'stretch' },
  col: { flex: 1, width: '100%' },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  track: { height: 10, borderRadius: 5, backgroundColor: COLORS.gray100 },
  hbar: { height: '100%', borderRadius: 5, backgroundColor: BAR, minWidth: 2 },
  table: { borderWidth: 1, borderColor: COLORS.gray100, borderRadius: RADIUS.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  border: { borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  th: { flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase' },
  td: { flex: 1, fontFamily: FONT, fontSize: 14, color: COLORS.gray800 },
});
