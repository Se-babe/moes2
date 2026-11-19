import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../services/supabaseClient';
import { Card, Button, Badge, Grid, Loading, STATUS_TONE, useBreakpoint } from '../../components/ui';
import { COLORS, FONT, SPACE, TYPE } from '../../theme';
import { showAlert } from '../../utils/alert';
import { fetchDepartments, OPEN_STATUSES, fmtDateTime } from '../../services/staff';

const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 3_600_000;
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const fmtHours = (h) => (h === null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);

function Stat({ icon, label, value, tone = COLORS.primary, onPress, hint }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ height: '100%' }}>
      {({ hovered }) => (
        <Card style={[styles.stat, hovered && onPress && { borderColor: COLORS.primaryLight }]}>
          <View style={[styles.statIcon, { backgroundColor: tone + '18' }]}>
            <Ionicons name={icon} size={20} color={tone} />
          </View>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={TYPE.small}>{label}</Text>
          {hint ? <Text style={[TYPE.small, { fontSize: 12, color: COLORS.gray400 }]}>{hint}</Text> : null}
        </Card>
      )}
    </Pressable>
  );
}

export default function AdminOverview({ onNavigateTab, onOpenRequest }) {
  const { isDesktop } = useBreakpoint();
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [reqRes, depts, proposals, failed, users, staff] = await Promise.all([
      supabase.from('feedback')
        .select('id, reference_no, title, status, department_id, created_at, first_response_at, resolved_at, due_at, escalation_level, escalated_at')
        .order('created_at', { ascending: false }).limit(2000),
      fetchDepartments(),
      supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('is_active', false),
      supabase.from('notification_log').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since7),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).in('role', ['officer', 'supervisor', 'admin']).eq('is_active', true),
    ]);
    const rows = reqRes.data || [];
    const now = Date.now();
    const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
    const recent = rows.filter((r) => r.created_at >= since30);
    const resolved30 = recent.filter((r) => r.resolved_at);
    const firstResp = recent.filter((r) => r.first_response_at).map((r) => hoursBetween(r.created_at, r.first_response_at));
    const resolution = resolved30.map((r) => hoursBetween(r.created_at, r.resolved_at));
    const onTime = resolved30.filter((r) => r.escalation_level === 0).length;

    const perDept = depts.map((d) => {
      const mine = rows.filter((r) => r.department_id === d.id);
      const res = mine.filter((r) => r.resolved_at && r.created_at >= since30);
      return {
        ...d,
        open: mine.filter((r) => OPEN_STATUSES.includes(r.status)).length,
        overdue: mine.filter((r) => OPEN_STATUSES.includes(r.status) && r.due_at && new Date(r.due_at) < now).length,
        resolved: res.length,
        avgRes: avg(res.map((r) => hoursBetween(r.created_at, r.resolved_at))),
      };
    });

    setData({
      total: rows.length,
      open: open.length,
      overdue: open.filter((r) => r.due_at && new Date(r.due_at) < now).length,
      escalated: rows.filter((r) => r.status === 'Escalated'),
      unassigned: open.filter((r) => !r.department_id).length,
      resolved30: resolved30.length,
      received30: recent.length,
      avgFirst: avg(firstResp),
      avgResolution: avg(resolution),
      onTimeRate: resolved30.length ? Math.round((onTime / resolved30.length) * 100) : null,
      perDept,
      proposals: proposals.count || 0,
      failed: failed.count || 0,
      users: users.count || 0,
      staff: staff.count || 0,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const runEscalation = async () => {
    setRunning(true);
    const { data: n, error } = await supabase.rpc('escalate_overdue_requests');
    setRunning(false);
    if (error) showAlert('Escalation check failed', error.message);
    else {
      showAlert('Escalation check complete', n ? `${n} overdue request(s) escalated.` : 'No overdue requests needed escalating.');
      load();
    }
  };

  if (!data) return <Loading label="Loading system overview…" />;

  return (
    <View style={{ gap: SPACE.xl }}>
      <Grid columns={4} minItemWidth={200} gap={SPACE.lg}>
        <Stat icon="file-tray-outline" label="Open requests" value={data.open} onPress={() => onNavigateTab('requests')} />
        <Stat icon="time-outline" label="Overdue" value={data.overdue} tone={COLORS.danger} onPress={() => onNavigateTab('requests')} />
        <Stat icon="alert-circle-outline" label="Escalated" value={data.escalated.length} tone={COLORS.warning} />
        <Stat icon="checkmark-done-outline" label="Resolved (30 days)" value={data.resolved30} tone={COLORS.success} hint={`of ${data.received30} received`} />
        <Stat icon="flash-outline" label="Avg. first response" value={fmtHours(data.avgFirst)} tone={COLORS.info} hint="last 30 days" />
        <Stat icon="hourglass-outline" label="Avg. time to resolve" value={fmtHours(data.avgResolution)} tone={COLORS.info} hint="last 30 days" />
        <Stat icon="ribbon-outline" label="Resolved within target" value={data.onTimeRate === null ? '—' : `${data.onTimeRate}%`} tone={COLORS.success} hint="not escalated" />
        <Stat icon="people-outline" label="Active staff" value={data.staff} onPress={() => onNavigateTab('users')} hint={`${data.users} accounts in total`} />
      </Grid>

      {(data.proposals > 0 || data.failed > 0 || data.unassigned > 0) && (
        <Card style={styles.attention}>
          <Text style={TYPE.h3}>Needs attention</Text>
          {data.proposals > 0 && (
            <Pressable style={styles.attnRow} onPress={() => onNavigateTab('consultations')}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.warning} />
              <Text style={[TYPE.body, { flex: 1 }]}>{data.proposals} consultation proposal(s) waiting for review</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
            </Pressable>
          )}
          {data.failed > 0 && (
            <View style={styles.attnRow}>
              <Ionicons name="warning-outline" size={18} color={COLORS.danger} />
              <Text style={[TYPE.body, { flex: 1 }]}>
                {data.failed} SMS/email message(s) failed in the last 7 days — check the UgSMS and Resend settings (table: notification_log).
              </Text>
            </View>
          )}
          {data.unassigned > 0 && (
            <Pressable style={styles.attnRow} onPress={() => onNavigateTab('departments')}>
              <Ionicons name="git-network-outline" size={18} color={COLORS.warning} />
              <Text style={[TYPE.body, { flex: 1 }]}>{data.unassigned} open request(s) have no department — check your routing rules</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray400} />
            </Pressable>
          )}
        </Card>
      )}

      <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
        <Card padded={false} style={{ flex: 2, width: '100%' }}>
          <View style={styles.cardHead}>
            <Text style={TYPE.h3}>Department performance</Text>
            <Button title="Edit routing" variant="ghost" size="sm" iconRight="arrow-forward" onPress={() => onNavigateTab('departments')} />
          </View>
          <View style={[styles.tr, styles.thRow]}>
            <Text style={[styles.th, { flex: 3 }]}>Department</Text>
            <Text style={[styles.th, styles.num]}>Open</Text>
            <Text style={[styles.th, styles.num]}>Overdue</Text>
            <Text style={[styles.th, styles.num]}>Resolved 30d</Text>
            {isDesktop && <Text style={[styles.th, { flex: 1.5, textAlign: 'right' }]}>Avg. resolve</Text>}
          </View>
          {data.perDept.map((d) => (
            <View key={d.id} style={styles.tr}>
              <View style={{ flex: 3 }}>
                <Text style={TYPE.label}>{d.name}</Text>
                <Text style={[TYPE.small, { fontSize: 12 }]}>{d.sla_hours}h target{d.is_active ? '' : ' · inactive'}</Text>
              </View>
              <Text style={[styles.td, styles.num]}>{d.open}</Text>
              <Text style={[styles.td, styles.num, d.overdue > 0 && { color: COLORS.danger, fontWeight: '800' }]}>{d.overdue}</Text>
              <Text style={[styles.td, styles.num]}>{d.resolved}</Text>
              {isDesktop && <Text style={[styles.td, { flex: 1.5, textAlign: 'right' }]}>{fmtHours(d.avgRes)}</Text>}
            </View>
          ))}
        </Card>

        <Card style={{ flex: 1.3, width: '100%' }}>
          <View style={[styles.cardHead, { padding: 0, borderBottomWidth: 0, marginBottom: SPACE.md }]}>
            <Text style={TYPE.h3}>Escalated</Text>
            <Button title="Run check now" icon="refresh" variant="secondary" size="sm" loading={running} onPress={runEscalation} />
          </View>
          {data.escalated.length === 0 ? (
            <Text style={TYPE.small}>No escalated requests. Overdue requests are checked automatically every 15 minutes.</Text>
          ) : data.escalated.slice(0, 8).map((r) => (
            <Pressable key={r.id} onPress={() => onOpenRequest(r.id)} style={({ hovered }) => [styles.escRow, hovered && { backgroundColor: COLORS.gray50 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.label, { color: COLORS.primary }]}>{r.reference_no}</Text>
                <Text style={TYPE.small} numberOfLines={1}>{r.title}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={`L${r.escalation_level}`} tone={STATUS_TONE.Escalated} />
                <Text style={[TYPE.small, { fontSize: 11.5 }]}>{fmtDateTime(r.escalated_at)}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { padding: SPACE.lg, gap: 4, height: '100%' },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontFamily: FONT, fontSize: 26, fontWeight: '800', color: COLORS.gray900 },
  attention: { gap: 4, borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  attnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  cols: { flexDirection: 'row', gap: SPACE.xl, alignItems: 'flex-start' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  thRow: { backgroundColor: COLORS.gray50, borderTopWidth: 0, paddingVertical: 8 },
  th: { fontFamily: FONT, fontSize: 11.5, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontFamily: FONT, fontSize: 14, color: COLORS.gray800 },
  num: { flex: 1, textAlign: 'right' },
  escRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
});
