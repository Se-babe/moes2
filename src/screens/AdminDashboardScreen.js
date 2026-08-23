import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AdminOverview from './admin/AdminOverview';
import AdminNotifications from './admin/AdminNotifications';
import AdminConsultations from './admin/AdminConsultations';
import AdminFeedback from './admin/AdminFeedback';
import AdminOpportunities from './admin/AdminOpportunities';
import AdminContent from './admin/AdminContent';
import AdminForum from './admin/AdminForum';
import AdminUsers from './admin/AdminUsers';
import { ADMIN_COLORS as COLORS } from './admin/adminTheme';

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'consultations', label: 'Consultations', icon: 'document-text-outline' },
  { key: 'feedback', label: 'Feedback', icon: 'chatbox-outline' },
  { key: 'opportunities', label: 'Opportunities', icon: 'briefcase-outline' },
  { key: 'content', label: 'Content', icon: 'albums-outline' },
  { key: 'forum', label: 'Forum', icon: 'chatbubbles-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
];

// Shared "gate" card used for loading / sign-in-required / access-denied.
function GateCard({ iconName, iconColor, iconBg, title, text, buttonLabel, onPress }) {
  return (
    <View style={styles.centerScreen}>
      <View style={styles.gateCard}>
        <View style={[styles.gateIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={30} color={iconColor} />
        </View>
        <Text style={styles.gateTitle}>{title}</Text>
        <Text style={styles.gateText}>{text}</Text>
        {buttonLabel && (
          <TouchableOpacity style={styles.gateBtn} onPress={onPress} activeOpacity={0.85}>
            <Text style={styles.gateBtnText}>{buttonLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Real access control lives here, not in whether the route exists — the
  // /admin URL always resolves to this screen, but only renders admin
  // content for an authenticated user with role === 'admin'. Every actual
  // write is still enforced server-side via Postgres RLS regardless.
  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <GateCard
        iconName="lock-closed-outline"
        iconColor={COLORS.primary}
        iconBg={COLORS.infoSoft}
        title="Admin sign-in required"
        text="Log in with an admin account to access this page."
        buttonLabel="Go to Login"
        onPress={() => navigation.navigate('Login')}
      />
    );
  }

  if (user.role !== 'admin') {
    return (
      <GateCard
        iconName="shield-outline"
        iconColor={COLORS.danger}
        iconBg={COLORS.dangerSoft}
        title="Access Denied"
        text={`Your account (${user.email}) doesn't have admin access.`}
        buttonLabel="Back to Home"
        onPress={() => navigation.navigate('Home')}
      />
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview onNavigateTab={setActiveTab} />;
      case 'notifications':
        return <AdminNotifications />;
      case 'consultations':
        return <AdminConsultations />;
      case 'feedback':
        return <AdminFeedback />;
      case 'opportunities':
        return <AdminOpportunities />;
      case 'content':
        return <AdminContent />;
      case 'forum':
        return <AdminForum />;
      case 'users':
        return <AdminUsers currentUserId={user.id} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>{user.full_name || user.email}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutBtn} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabChip, activeTab === t.key && styles.tabChipActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.75}
          >
            <Ionicons name={t.icon} size={16} color={activeTab === t.key ? '#fff' : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(252,211,77,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.3)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  tabScroll: {
    flexGrow: 0,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: '#fff' },
  body: { flex: 1 },
  bodyContent: { padding: 20, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  centerScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, padding: 24 },
  gateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    maxWidth: 380,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gateIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  gateTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  gateText: { fontSize: 14, color: COLORS.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  gateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 30,
    marginTop: 24,
  },
  gateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
