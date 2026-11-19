import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import StaffGate from '../components/staff/StaffGate';
import NotificationBell from '../components/staff/NotificationBell';
import { Button, useBreakpoint } from '../components/ui';
import { COLORS, FONT, RADIUS, SPACE, TYPE } from '../theme';
import AdminOverview from './admin/AdminOverview';
import AdminRequests from './admin/AdminRequests';
import AdminUsers from './admin/AdminUsers';
import AdminDepartments from './admin/AdminDepartments';
import AdminConsultations from './admin/AdminConsultations';
import AdminContent from './admin/AdminContent';
import AdminForum from './admin/AdminForum';
import AdminNotifications from './admin/AdminNotifications';
import AnnouncementsManager from '../components/staff/AnnouncementsManager';
import ReportsDashboard from '../components/staff/ReportsDashboard';
import AdminSurveys from './admin/AdminSurveys';

const SECTIONS = [
  { group: 'Operations', items: [
    { key: 'overview', label: 'Overview', icon: 'grid-outline' },
    { key: 'requests', label: 'All requests', icon: 'file-tray-full-outline' },
    { key: 'announcements', label: 'Announcements', icon: 'megaphone-outline' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
  ] },
  { group: 'Organisation', items: [
    { key: 'users', label: 'Staff & users', icon: 'people-outline' },
    { key: 'departments', label: 'Departments & routing', icon: 'git-network-outline' },
  ] },
  { group: 'Engagement', items: [
    { key: 'consultations', label: 'Consultations', icon: 'document-text-outline' },
    { key: 'surveys', label: 'Surveys', icon: 'clipboard-outline' },
    { key: 'forum', label: 'Forum moderation', icon: 'chatbubbles-outline' },
  ] },
  { group: 'Website', items: [
    { key: 'content', label: 'Content & settings', icon: 'albums-outline' },
    { key: 'notifications', label: 'Inbox', icon: 'mail-outline' },
  ] },
];
const ALL = SECTIONS.flatMap((s) => s.items);

function Console() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, signOut } = useAuth();
  const { isDesktop } = useBreakpoint();
  const [active, setActive] = useState(route.params?.tab && ALL.some((t) => t.key === route.params.tab) ? route.params.tab : 'overview');

  useEffect(() => {
    if (route.params?.tab && ALL.some((t) => t.key === route.params.tab)) setActive(route.params.tab);
  }, [route.params?.tab]);

  const go = (key) => {
    setActive(key);
    navigation.setParams({ tab: key });
  };
  const openRequest = (id) => navigation.navigate('StaffRequest', { id });

  const renderTab = () => {
    switch (active) {
      case 'overview': return <AdminOverview onNavigateTab={go} onOpenRequest={openRequest} />;
      case 'requests': return <AdminRequests onOpenRequest={openRequest} />;
      case 'announcements': return <AnnouncementsManager user={user} />;
      case 'reports': return <ReportsDashboard user={user} />;
      case 'surveys': return <AdminSurveys />;
      case 'users': return <AdminUsers currentUserId={user.id} />;
      case 'departments': return <AdminDepartments />;
      case 'consultations': return <AdminConsultations />;
      case 'forum': return <AdminForum />;
      case 'content': return <AdminContent />;
      case 'notifications': return <AdminNotifications />;
      default: return null;
    }
  };

  const current = ALL.find((t) => t.key === active);

  const nav = (
    <View style={isDesktop ? styles.sideNav : styles.topNav}>
      {isDesktop ? (
        SECTIONS.map((s) => (
          <View key={s.group} style={{ marginBottom: SPACE.lg }}>
            <Text style={styles.group}>{s.group}</Text>
            {s.items.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => go(t.key)}
                style={({ hovered }) => [styles.navItem, active === t.key && styles.navItemActive, hovered && active !== t.key && { backgroundColor: COLORS.gray100 }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active === t.key }}
              >
                <Ionicons name={t.icon} size={18} color={active === t.key ? COLORS.primary : COLORS.gray500} />
                <Text style={[styles.navText, active === t.key && styles.navTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        ))
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: SPACE.lg }}>
          {ALL.map((t) => (
            <Pressable key={t.key} onPress={() => go(t.key)} style={[styles.chip, active === t.key && styles.chipActive]}>
              <Ionicons name={t.icon} size={15} color={active === t.key ? '#fff' : COLORS.gray600} />
              <Text style={[styles.chipText, active === t.key && { color: '#fff' }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {isDesktop && (
        <View style={styles.sideFoot}>
          <Button title="Staff portal" icon="briefcase-outline" variant="secondary" size="sm" full onPress={() => navigation.navigate('StaffPortal')} />
          <Button title="Sign out" icon="log-out-outline" variant="ghost" size="sm" full onPress={signOut} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <View style={styles.badge}><Ionicons name="shield-checkmark" size={18} color={COLORS.primary} /></View>
          <View>
            <Text style={styles.title}>Admin console</Text>
            <Text style={TYPE.small}>{user.full_name || user.email}</Text>
          </View>
        </View>
        <View style={styles.topbarRight}>
          <NotificationBell tone="dark" onOpenRequest={openRequest} />
          {!isDesktop && <Button title="Sign out" variant="ghost" size="sm" onPress={signOut} />}
        </View>
      </View>

      <View style={[styles.body, !isDesktop && { flexDirection: 'column' }]}>
        {nav}
        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          <Text style={[TYPE.h1, { fontSize: isDesktop ? 28 : 22, marginBottom: SPACE.xl }]} accessibilityRole="header">{current?.label}</Text>
          {renderTab()}
        </ScrollView>
      </View>
    </View>
  );
}

export default function AdminDashboardScreen() {
  return (
    <StaffGate roles={['admin']}>
      <Console />
    </StaffGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
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
  navText: { fontFamily: FONT, fontSize: 14.5, fontWeight: '600', color: COLORS.gray700 },
  navTextActive: { color: COLORS.primary },
  sideFoot: { marginTop: 'auto', gap: 6, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.gray100 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontFamily: FONT, fontSize: 13.5, fontWeight: '600', color: COLORS.gray700 },
  main: { flex: 1 },
  mainContent: { padding: SPACE.xl, paddingBottom: 80, maxWidth: 1240, width: '100%' },
});
