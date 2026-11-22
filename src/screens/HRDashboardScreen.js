import React, { useState, useEffect, useCallback } from 'react';
import AppearancePicker from '../components/AppearancePicker';
import { hasAdminPowers } from '../services/staff';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import StaffGate from '../components/staff/StaffGate';
import { Card, Button, Badge, Grid, Loading, EmptyState, Avatar, useBreakpoint } from '../components/ui';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import { showAlert } from '../utils/alert';
import { downloadCsv } from '../utils/exportFile';
import AdminUsers from './admin/AdminUsers';
import AdminDepartments from './admin/AdminDepartments';
import TrainingAdmin from '../components/staff/TrainingAdmin';

// Human Resources workspace: the workforce (accounts, departments, team
// performance and a record of changes). HR also has every administrator
// power through the admin console, except control of administrator accounts.
const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'staff', label: 'Staff accounts', icon: 'people-outline' },
  { key: 'departments', label: 'Departments & routing', icon: 'git-network-outline' },
  { key: 'performance', label: 'Team performance', icon: 'speedometer-outline' },
  { key: 'training', label: 'Training', icon: 'school-outline' },
  { key: 'changes', label: 'Change log', icon: 'time-outline' },
];
const ROLE_LABEL = { officer: 'Officer', supervisor: 'Supervisor', hr: 'Human Resources', admin: 'Administrator' };
const FIELD_LABEL = { added: 'Added as', role: 'Role', department: 'Department', status: 'Account', 'job title': 'Job title' };
const fmt = (d) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const hours = (h) => (h === null || h === undefined ? '—' : Number(h) < 48 ? `${Number(h).toFixed(1)} h` : `${(Number(h) / 24).toFixed(1)} days`);

function Stat({ icon, label, value, hint, tone = COLORS.primary, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ height: '100%' }}>
      {({ hovered }) => (
        <Card style={[styles.stat, hovered && onPress && { borderColor: COLORS.primaryLight }]}>
          <View style={[styles.statIcon, { backgroundColor: tone + '18' }]}>
            <Ionicons name={icon} size={20} color={tone} />
          </View>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={TYPE.label}>{label}</Text>
          {hint ? <Text style={TYPE.small}>{hint}</Text> : null}
        </Card>
      )}
    </Pressable>
  );
}

function ChangeRow({ c, first }) {
  const what = c.field === 'added'
    ? `added as ${ROLE_LABEL[c.new_value] || c.new_value}`
    : `${FIELD_LABEL[c.field] || c.field}: ${c.old_value ? (ROLE_LABEL[c.old_value] || c.old_value) : '—'} → ${c.new_value ? (ROLE_LABEL[c.new_value] || c.new_value) : '—'}`;
  return (
    <View style={[styles.changeRow, !first && styles.rowBorder]}>
      <Ionicons
        name={c.field === 'status' ? (c.new_value === 'active' ? 'checkmark-circle-outline' : 'remove-circle-outline') : c.field === 'added' ? 'person-add-outline' : 'swap-horizontal-outline'}
        size={18}
        color={c.field === 'status' && c.new_value !== 'active' ? COLORS.danger : COLORS.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={TYPE.body}><Text style={{ fontWeight: '700' }}>{c.user_name || 'A staff member'}</Text> — {what}</Text>
        <Text style={TYPE.small}>by {c.changed_by_name || 'the system'} · {fmt(c.created_at)}</Text>
      </View>
    </View>
  );
}

function Overview({ go }) {
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    const [staff, depts, changes] = await Promise.all([
      supabase.from('users').select('role, is_active, department_id').in('role', ['officer', 'supervisor', 'hr', 'admin']),
      supabase.rpc('department_staffing'),
      supabase.from('staff_changes').select('*').order('created_at', { ascending: false }).limit(6),
    ]);
    if (staff.error || depts.error) showAlert('Could not load', (staff.error || depts.error).message);
    setData({ staff: staff.data || [], depts: depts.data || [], changes: changes.data || [] });
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Loading />;

  const active = data.staff.filter((u) => u.is_active !== false);
  const count = (r) => active.filter((u) => u.role === r).length;
  const gaps = data.depts.filter((d) => d.is_active !== false && Number(d.officers) + Number(d.supervisors) === 0);
  const noSupervisor = data.depts.filter((d) => d.is_active !== false && Number(d.officers) > 0 && Number(d.supervisors) === 0);

  return (
    <View style={{ gap: SPACE.xl }}>
      <Grid columns={4} minItemWidth={140} gap={SPACE.md}>
        <Stat icon="people-outline" label="Active staff" value={active.length} hint={`${count('officer')} officers · ${count('supervisor')} supervisors`} onPress={() => go('staff')} />
        <Stat icon="shield-half-outline" label="HR & administrators" value={count('hr') + count('admin')} hint={`${count('hr')} HR · ${count('admin')} admin`} tone={COLORS.info} />
        <Stat icon="person-remove-outline" label="Deactivated" value={data.staff.length - active.length} tone={COLORS.gray500} onPress={() => go('staff')} />
        <Stat icon="alert-circle-outline" label="Departments with no staff" value={gaps.length} tone={gaps.length ? COLORS.danger : COLORS.success} onPress={() => go('departments')} />
      </Grid>

      {(gaps.length > 0 || noSupervisor.length > 0) && (
        <Card style={styles.attention} status>
          <Text style={[TYPE.h3, { color: '#991B1B' }]}><Ionicons name="warning-outline" size={18} /> Staffing gaps</Text>
          {gaps.map((d) => (
            <Text key={d.department_id} style={TYPE.body}>
              • <Text style={{ fontWeight: '700' }}>{d.department}</Text> has no active officer or supervisor
              {Number(d.open_requests) ? ` — ${d.open_requests} open request${d.open_requests === 1 ? '' : 's'} waiting` : ''}. New requests can't be assigned automatically.
            </Text>
          ))}
          {noSupervisor.map((d) => (
            <Text key={d.department_id} style={TYPE.body}>• <Text style={{ fontWeight: '700' }}>{d.department}</Text> has no supervisor, so overdue requests have nobody to escalate to.</Text>
          ))}
          <Button title="Add staff member" icon="person-add-outline" size="sm" style={{ alignSelf: 'flex-start', marginTop: SPACE.sm }} onPress={() => go('staff')} />
        </Card>
      )}

      <Card padded={false}>
        <Text style={[TYPE.h3, { padding: SPACE.lg }]}>Staffing by department</Text>
        <View style={[styles.tr, styles.thRow]}>
          <Text style={[styles.th, { flex: 3 }]}>Department</Text>
          <Text style={styles.th}>Officers</Text>
          <Text style={styles.th}>Supervisors</Text>
          <Text style={styles.th}>Open requests</Text>
          <Text style={styles.th}>Unassigned</Text>
        </View>
        {data.depts.map((d) => (
          <View key={d.department_id} style={[styles.tr, styles.rowBorder, d.is_active === false && { opacity: 0.5 }]}>
            <Text style={[TYPE.label, { flex: 3 }]}>{d.department}{d.is_active === false ? ' (inactive)' : ''}</Text>
            <Text style={[styles.td, !Number(d.officers) && { color: COLORS.danger }]}>{d.officers}</Text>
            <Text style={[styles.td, !Number(d.supervisors) && { color: COLORS.warning }]}>{d.supervisors}</Text>
            <Text style={styles.td}>{d.open_requests}</Text>
            <Text style={[styles.td, Number(d.unassigned_requests) > 0 && { color: COLORS.danger, fontWeight: '700' }]}>{d.unassigned_requests}</Text>
          </View>
        ))}
      </Card>

      <Card padded={false}>
        <View style={styles.headRow}>
          <Text style={TYPE.h3}>Recent changes</Text>
          <Button title="Full log" size="sm" variant="ghost" iconRight="chevron-forward" onPress={() => go('changes')} />
        </View>
        {data.changes.length === 0
          ? <Text style={[TYPE.small, { padding: SPACE.lg, paddingTop: 0 }]}>No staff changes recorded yet.</Text>
          : data.changes.map((c, i) => <ChangeRow key={c.id} c={c} first={i === 0} />)}
      </Card>
    </View>
  );
}

function Performance() {
  const { isDesktop } = useBreakpoint();
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    supabase.rpc('staff_performance', { p_days: days }).then(({ data, error }) => {
      if (error) showAlert('Could not load', error.message);
      setRows(data || []);
    });
  }, [days]);

  const exportCsv = () => downloadCsv(`nwsc-team-performance-${days}d.csv`, rows, [
    { label: 'Name', key: 'full_name' }, { label: 'Role', key: 'role' }, { label: 'Job title', key: 'job_title' },
    { label: 'Department', key: 'department' }, { label: 'Active', value: (r) => (r.is_active ? 'yes' : 'no') },
    { label: 'Open', key: 'open_count' }, { label: 'Overdue', key: 'overdue_count' }, { label: `Resolved (${days} days)`, key: 'resolved_count' },
    { label: 'Avg first response (h)', key: 'avg_first_response_hours' }, { label: 'Avg time to resolve (h)', key: 'avg_resolution_hours' },
    { label: 'Avg satisfaction (1-5)', key: 'avg_rating' }, { label: 'Ratings', key: 'rated_count' },
  ]);

  return (
    <View style={{ gap: SPACE.lg }}>
      <View style={styles.toolbar}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[30, 90, 365].map((d) => (
            <Pressable key={d} onPress={() => setDays(d)} style={[styles.chip, days === d && styles.chipActive]}>
              <Text style={[styles.chipText, days === d && { color: '#fff' }]}>{d === 365 ? '12 months' : `${d} days`}</Text>
            </Pressable>
          ))}
        </View>
        {rows?.length ? <Button title="Export CSV" icon="download-outline" size="sm" variant="secondary" onPress={exportCsv} /> : null}
      </View>
      <Text style={TYPE.small}>
        Requests currently assigned to each person, and what they resolved in the period. Use it to balance workloads,
        plan training and recognise good service. Customer details are not shown here.
      </Text>
      {rows === null ? <Loading /> : rows.length === 0 ? (
        <Card><EmptyState icon="people-outline" title="No officers or supervisors yet" message="Add staff to see their workload and results." /></Card>
      ) : isDesktop ? (
        <Card padded={false}>
          <View style={[styles.tr, styles.thRow]}>
            <Text style={[styles.th, { flex: 3 }]}>Staff member</Text>
            <Text style={styles.th}>Open</Text>
            <Text style={styles.th}>Overdue</Text>
            <Text style={styles.th}>Resolved</Text>
            <Text style={styles.th}>First reply</Text>
            <Text style={styles.th}>Time to resolve</Text>
            <Text style={styles.th}>Satisfaction</Text>
          </View>
          {rows.map((r) => (
            <View key={r.user_id} style={[styles.tr, styles.rowBorder, !r.is_active && { opacity: 0.5 }]}>
              <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={r.full_name} url={r.avatar_url} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={TYPE.label} numberOfLines={1}>{r.full_name || 'Unnamed'}{!r.is_active ? ' (deactivated)' : ''}</Text>
                  <Text style={TYPE.small} numberOfLines={1}>{ROLE_LABEL[r.role]} · {r.department || 'No department'}</Text>
                </View>
              </View>
              <Text style={styles.td}>{r.open_count}</Text>
              <Text style={[styles.td, Number(r.overdue_count) > 0 && { color: COLORS.danger, fontWeight: '700' }]}>{r.overdue_count}</Text>
              <Text style={styles.td}>{r.resolved_count}</Text>
              <Text style={styles.td}>{hours(r.avg_first_response_hours)}</Text>
              <Text style={styles.td}>{hours(r.avg_resolution_hours)}</Text>
              <Text style={styles.td}>{r.avg_rating ? `${Number(r.avg_rating).toFixed(1)} ★ (${r.rated_count})` : '—'}</Text>
            </View>
          ))}
        </Card>
      ) : rows.map((r) => (
        <Card key={r.user_id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={r.full_name} url={r.avatar_url} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={TYPE.label}>{r.full_name || 'Unnamed'}</Text>
              <Text style={TYPE.small}>{ROLE_LABEL[r.role]} · {r.department || 'No department'}</Text>
            </View>
          </View>
          <Text style={TYPE.small}>
            {r.open_count} open · {r.overdue_count} overdue · {r.resolved_count} resolved · resolves in {hours(r.avg_resolution_hours)}
            {r.avg_rating ? ` · ${Number(r.avg_rating).toFixed(1)} ★` : ''}
          </Text>
        </Card>
      ))}
    </View>
  );
}

function Changes() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from('staff_changes').select('*').order('created_at', { ascending: false }).limit(300)
      .then(({ data, error }) => { if (error) showAlert('Could not load', error.message); setRows(data || []); });
  }, []);
  if (rows === null) return <Loading />;
  return (
    <View style={{ gap: SPACE.lg }}>
      <Text style={TYPE.small}>Every account added, role or department change, job title change, and activation or deactivation — with who made it.</Text>
      <Card padded={false}>
        {rows.length === 0
          ? <EmptyState icon="time-outline" title="No changes yet" message="Changes to staff accounts will be listed here." />
          : rows.map((c, i) => <ChangeRow key={c.id} c={c} first={i === 0} />)}
      </Card>
      {rows.length ? (
        <Button
          title="Export CSV" icon="download-outline" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }}
          onPress={() => downloadCsv('nwsc-staff-changes.csv', rows, [
            { label: 'When', key: 'created_at' }, { label: 'Staff member', key: 'user_name' }, { label: 'Change', key: 'field' },
            { label: 'From', key: 'old_value' }, { label: 'To', key: 'new_value' }, { label: 'Changed by', key: 'changed_by_name' },
          ])}
        />
      ) : null}
    </View>
  );
}

function Workspace() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, signOut } = useAuth();
  const { isDesktop } = useBreakpoint();
  const valid = (k) => SECTIONS.some((s) => s.key === k);
  const [active, setActive] = useState(valid(route.params?.tab) ? route.params.tab : 'overview');
  useEffect(() => { if (valid(route.params?.tab)) setActive(route.params.tab); }, [route.params?.tab]);
  const go = (key) => { setActive(key); navigation.setParams({ tab: key }); };
  const current = SECTIONS.find((s) => s.key === active);

  const body = () => {
    switch (active) {
      case 'overview': return <Overview go={go} />;
      case 'staff': return <AdminUsers currentUserId={user.id} mode={user.role === 'admin' ? 'admin' : 'hr'} />;
      case 'departments': return <AdminDepartments />;
      case 'performance': return <Performance />;
      case 'training': return <TrainingAdmin />;
      case 'changes': return <Changes />;
      default: return null;
    }
  };

  const nav = isDesktop ? (
    <View style={styles.sideNav}>
      <Text style={styles.group}>Human Resources</Text>
      {SECTIONS.map((s) => (
        <Pressable
          key={s.key}
          onPress={() => go(s.key)}
          style={({ hovered }) => [styles.navItem, active === s.key && styles.navItemActive, hovered && active !== s.key && { backgroundColor: COLORS.gray100 }]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === s.key }}
        >
          <Ionicons name={s.icon} size={18} color={active === s.key ? COLORS.primary : COLORS.gray500} />
          <Text style={[styles.navText, active === s.key && styles.navTextActive]}>{s.label}</Text>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      {hasAdminPowers(user.role) && (
        <Pressable style={styles.navItem} onPress={() => navigation.navigate('AdminDashboard')}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.gray500} />
          <Text style={styles.navText}>Admin console</Text>
        </Pressable>
      )}
      <Pressable style={styles.navItem} onPress={() => navigation.navigate('StaffSettings')}>
        <Ionicons name="settings-outline" size={18} color={COLORS.gray500} />
        <Text style={styles.navText}>My settings</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => navigation.navigate('Home')}>
        <Ionicons name="globe-outline" size={18} color={COLORS.gray500} />
        <Text style={styles.navText}>Public website</Text>
      </Pressable>
      <Pressable style={styles.navItem} onPress={() => { signOut(); navigation.navigate('Login'); }}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
        <Text style={[styles.navText, { color: COLORS.danger }]}>Sign out</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.topNav}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: SPACE.lg }}>
        {SECTIONS.map((s) => (
          <Pressable key={s.key} onPress={() => go(s.key)} style={[styles.chip, styles.navChip, active === s.key && styles.chipActive]}>
            <Ionicons name={s.icon} size={15} color={active === s.key ? '#fff' : COLORS.gray600} />
            <Text style={[styles.chipText, active === s.key && { color: '#fff' }]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <View style={styles.badge}><Ionicons name="people-circle" size={20} color={COLORS.primary} /></View>
          <View>
            <Text style={styles.title}>HR dashboard</Text>
            <Text style={TYPE.small}>{user.full_name || user.email}</Text>
          </View>
        </View>
        <View style={styles.topbarRight}>
          <AppearancePicker tone="light" />
          <Pressable onPress={() => navigation.navigate('StaffSettings')} accessibilityRole="link" accessibilityLabel="My profile and settings">
            <Avatar name={user.full_name || user.email} url={user.avatar_url} size={36} />
          </Pressable>
          {!isDesktop && <Button title="Sign out" variant="ghost" size="sm" onPress={() => { signOut(); navigation.navigate('Login'); }} />}
        </View>
      </View>
      <View style={[styles.body, !isDesktop && { flexDirection: 'column' }]}>
        {nav}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.mainContent}>
          <Text style={[TYPE.h1, { fontSize: isDesktop ? 28 : 22, marginBottom: SPACE.xl }]} accessibilityRole="header">{current?.label}</Text>
          {body()}
        </ScrollView>
      </View>
    </View>
  );
}

export default function HRDashboardScreen() {
  return (
    <StaffGate roles={['hr', 'admin']}>
      <Workspace />
    </StaffGate>
  );
}

// Pinned to the visible screen on the web so the content area scrolls.
const FILL_SCREEN = Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } : null;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, ...FILL_SCREEN },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.xl,
    paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray200,
  },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT, fontSize: 17, fontWeight: '800', color: COLORS.gray900 },
  body: { flex: 1, flexDirection: 'row' },
  sideNav: { width: 250, backgroundColor: COLORS.white, borderRightWidth: 1, borderRightColor: COLORS.gray200, padding: SPACE.lg },
  topNav: { paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  group: { fontFamily: FONT, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: COLORS.gray400, marginBottom: 6, marginLeft: 10 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: RADIUS.sm },
  navItemActive: { backgroundColor: COLORS.primarySoft },
  navText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: COLORS.gray700 },
  navTextActive: { color: COLORS.primary },
  mainContent: { padding: SPACE.xl, maxWidth: 1200, width: '100%' },
  stat: { gap: 4, height: '100%' },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontFamily: FONT, fontSize: 26, fontWeight: '800', color: COLORS.gray900 },
  attention: { backgroundColor: COLORS.dangerSoft, borderColor: '#FECACA', gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.lg },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingVertical: 12, gap: 8 },
  thRow: { backgroundColor: COLORS.gray50, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  th: { flex: 1, fontFamily: FONT, fontSize: 12, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { flex: 1, fontFamily: FONT, fontSize: 14, color: COLORS.gray800 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  changeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingHorizontal: SPACE.lg, paddingVertical: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gray200, backgroundColor: COLORS.white },
  navChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
});
