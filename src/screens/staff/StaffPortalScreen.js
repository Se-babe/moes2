import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import StaffGate from '../../components/staff/StaffGate';
import RequestQueue from '../../components/staff/RequestQueue';
import NotificationBell from '../../components/staff/NotificationBell';
import AnnouncementsManager from '../../components/staff/AnnouncementsManager';
import { Container, Card, Button, Grid, useBreakpoint } from '../../components/ui';
import { COLORS, FONT, RADIUS, SPACE, TYPE, gradient } from '../../theme';
import { fetchDepartments, fetchStaff, fetchWorkload, OPEN_STATUSES } from '../../services/staff';

function Kpi({ icon, label, value, tone = COLORS.primary }) {
  return (
    <Card style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: tone + '18' }]}>
        <Ionicons name={icon} size={20} color={tone} />
      </View>
      <View>
        <Text style={styles.kpiValue}>{value ?? '—'}</Text>
        <Text style={TYPE.small}>{label}</Text>
      </View>
    </Card>
  );
}

function Portal() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { isDesktop } = useBreakpoint();
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [kpis, setKpis] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [section, setSection] = useState('queue');

  const isSupervisor = user.role === 'supervisor' || user.role === 'admin';
  const myDept = departments.find((d) => d.id === user.department_id);

  const loadKpis = useCallback(async () => {
    const now = new Date().toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const count = async (build) => {
      const { count: c } = await build(supabase.from('feedback').select('id', { count: 'exact', head: true }));
      return c ?? 0;
    };
    const scoped = (q) => (isSupervisor && user.department_id ? q.eq('department_id', user.department_id) : q.eq('assigned_to', user.id));
    const [mine, overdue, escalated, resolved] = await Promise.all([
      count((q) => q.eq('assigned_to', user.id).in('status', OPEN_STATUSES)),
      count((q) => scoped(q).in('status', OPEN_STATUSES).lt('due_at', now)),
      count((q) => scoped(q).eq('status', 'Escalated')),
      count((q) => scoped(q).in('status', ['Resolved', 'Closed']).gte('resolved_at', weekAgo)),
    ]);
    setKpis({ mine, overdue, escalated, resolved });
  }, [isSupervisor, user.department_id, user.id]);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
    if (isSupervisor) fetchWorkload().then(setWorkload).catch(() => {});
  }, [isSupervisor]);

  // Refresh numbers and the queue whenever the portal comes back into view.
  useFocusEffect(useCallback(() => {
    loadKpis();
    setRefreshKey((k) => k + 1);
  }, [loadKpis]));

  const openRequest = (id) => navigation.navigate('StaffRequest', { id });

  const scopes = isSupervisor
    ? [{ key: 'department', label: 'My department' }, { key: 'unassigned', label: 'Unassigned' }, { key: 'mine', label: 'Assigned to me' }]
    : [{ key: 'mine', label: 'Assigned to me' }, { key: 'department', label: 'My department' }, { key: 'unassigned', label: 'Unassigned' }];

  return (
    <ScrollView style={styles.page}>
      <View style={[styles.band, gradient(COLORS.primaryDarker, COLORS.primary, 120)]}>
        <Container style={styles.bandRow}>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.overline, { color: '#7DD3FC' }]}>Staff portal</Text>
            <Text style={[TYPE.h1, { color: '#fff', fontSize: isDesktop ? 30 : 24 }]}>
              Welcome, {(user.full_name || user.email).split(' ')[0]}
            </Text>
            <Text style={styles.bandSub}>
              {user.job_title ? `${user.job_title} · ` : ''}{user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              {myDept ? ` · ${myDept.name}` : user.role !== 'admin' ? ' · No department assigned' : ''}
            </Text>
          </View>
          <View style={styles.bandActions}>
            <NotificationBell onOpenRequest={openRequest} />
            {user.role === 'admin' && (
              <Button title="Admin console" icon="settings-outline" variant="outlineLight" size="sm" onPress={() => navigation.navigate('AdminDashboard')} />
            )}
            <Button title="Sign out" icon="log-out-outline" variant="outlineLight" size="sm" onPress={signOut} />
          </View>
        </Container>
      </View>

      <Container style={{ marginTop: -36 }}>
        {!user.department_id && user.role !== 'admin' && (
          <Card style={styles.warn}>
            <Ionicons name="information-circle" size={20} color={COLORS.warning} />
            <Text style={[TYPE.body, { flex: 1 }]}>
              You are not linked to a department yet, so you'll only see requests assigned directly to you. Ask an administrator to set your department.
            </Text>
          </Card>
        )}
        <Grid columns={4} minItemWidth={200} gap={SPACE.lg}>
          <Kpi icon="person-outline" label="Assigned to me (open)" value={kpis.mine} />
          <Kpi icon="time-outline" label={isSupervisor ? 'Overdue in department' : 'My overdue'} value={kpis.overdue} tone={COLORS.danger} />
          <Kpi icon="alert-circle-outline" label="Escalated" value={kpis.escalated} tone={COLORS.warning} />
          <Kpi icon="checkmark-done-outline" label="Resolved this week" value={kpis.resolved} tone={COLORS.success} />
        </Grid>

        <View style={styles.sections} accessibilityRole="tablist">
          {[['queue', 'Work queue', 'file-tray-full-outline'], ['announcements', 'Announcements', 'megaphone-outline']].map(([k, label, icon]) => (
            <Pressable key={k} onPress={() => setSection(k)} style={[styles.section, section === k && styles.sectionOn]} accessibilityRole="tab" accessibilityState={{ selected: section === k }}>
              <Ionicons name={icon} size={18} color={section === k ? COLORS.primary : COLORS.gray500} />
              <Text style={[styles.sectionText, section === k && { color: COLORS.primary }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {section === 'announcements' ? (
          <View style={{ marginTop: SPACE.xl }}><AnnouncementsManager user={user} /></View>
        ) : (
        <View style={[styles.cols, !isDesktop && { flexDirection: 'column' }]}>
          <View style={{ flex: 3 }}>
            <RequestQueue
              user={user}
              scopes={scopes}
              onOpen={openRequest}
              departments={departments}
              staff={staff}
              refreshKey={refreshKey}
            />
          </View>

          {isSupervisor && workload.length > 0 && (
            <View style={{ flex: 1.2, minWidth: 260 }}>
              <Text style={[TYPE.h2, { marginBottom: SPACE.lg }]}>Team workload</Text>
              <Card padded={false}>
                {workload.map((w, i) => (
                  <View key={w.user_id} style={[styles.wlRow, i > 0 && { borderTopWidth: 1, borderTopColor: COLORS.gray100 }]}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(w.full_name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={TYPE.label}>{w.full_name || 'Unnamed'}</Text>
                      <Text style={TYPE.small}>{w.role}{w.department ? ` · ${w.department}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.wlNum}>{w.open_count}</Text>
                      {Number(w.overdue_count) > 0 && <Text style={styles.wlOver}>{w.overdue_count} overdue</Text>}
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}
        </View>
        )}
      </Container>
      <View style={{ height: 64 }} />
    </ScrollView>
  );
}

export default function StaffPortalScreen() {
  return (
    <StaffGate roles={['officer', 'supervisor', 'admin']}>
      <Portal />
    </StaffGate>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  band: { paddingTop: SPACE.xxl, paddingBottom: 64 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, flexWrap: 'wrap' },
  bandSub: { fontFamily: FONT, color: '#CFE6FA', fontSize: 15, marginTop: 6 },
  bandActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  warn: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: SPACE.lg, backgroundColor: COLORS.warningSoft, borderColor: '#FDE68A' },
  kpi: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: SPACE.lg },
  kpiIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontFamily: FONT, fontSize: 26, fontWeight: '800', color: COLORS.gray900 },
  cols: { flexDirection: 'row', gap: SPACE.xl, marginTop: SPACE.xl, alignItems: 'flex-start' },
  sections: { flexDirection: 'row', gap: 4, marginTop: SPACE.xl, borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  sectionOn: { borderBottomColor: COLORS.primary },
  sectionText: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: COLORS.gray500 },
  wlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONT, fontWeight: '800', color: COLORS.primary, fontSize: 13 },
  wlNum: { fontFamily: FONT, fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  wlOver: { fontFamily: FONT, fontSize: 11.5, fontWeight: '700', color: COLORS.danger },
});
