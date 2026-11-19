import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Avatar, useBreakpoint } from '../ui';
import NotificationBell from './NotificationBell';
import { COLORS, FONT, RADIUS, SHADOW, SPACE, TYPE, LAYOUT } from '../../theme';

const ROLE_LABEL = { officer: 'Officer', supervisor: 'Supervisor', admin: 'Administrator' };

/** The sections of the staff workspace, filtered by role. */
export function staffSections(role) {
  const supervisor = role === 'supervisor' || role === 'admin';
  return [
    { key: 'queue', label: 'Work queue', icon: 'file-tray-full-outline' },
    { key: 'announcements', label: 'Announcements', icon: 'megaphone-outline' },
    ...(supervisor ? [{ key: 'reports', label: 'Reports', icon: 'bar-chart-outline' }] : []),
    { key: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];
}

function MenuItem({ icon, label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => [styles.menuItem, hovered && { backgroundColor: COLORS.gray50 }]} accessibilityRole="menuitem">
      <Ionicons name={icon} size={18} color={danger ? COLORS.danger : COLORS.gray600} />
      <Text style={[styles.menuText, danger && { color: COLORS.danger }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Top navigation for every staff page: brand, sections, notifications and
 * the signed-in person's menu. `active` is the highlighted section key.
 */
export default function StaffNavbar({ active }) {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { isDesktop } = useBreakpoint();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!user) return null;

  const sections = staffSections(user.role);
  const go = (key) => {
    setMenuOpen(false);
    if (key === 'settings') navigation.navigate('StaffSettings');
    else navigation.navigate('StaffPortal', { tab: key });
  };
  const name = user.full_name || user.email;

  const links = sections.map((s) => {
    const on = active === s.key;
    return (
      <Pressable
        key={s.key}
        onPress={() => go(s.key)}
        style={({ hovered }) => [styles.link, !isDesktop && styles.linkMobile, on && styles.linkOn, hovered && !on && styles.linkHover]}
        accessibilityRole="link"
        accessibilityState={{ selected: on }}
      >
        <Ionicons name={s.icon} size={17} color={on ? '#fff' : '#9CC3E6'} />
        <Text style={[styles.linkText, on && { color: '#fff' }]}>{s.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={styles.bar} accessibilityRole="navigation">
      <View style={styles.row}>
        <Pressable onPress={() => go('queue')} style={styles.brand} accessibilityRole="link" accessibilityLabel="Staff portal home">
          <View style={styles.logo}><Ionicons name="water" size={18} color="#fff" /></View>
          <View>
            <Text style={styles.brandName}>NWSC Staff</Text>
            {isDesktop && <Text style={styles.brandSub}>Jinja Area</Text>}
          </View>
        </Pressable>

        {isDesktop && <View style={styles.links}>{links}</View>}

        <View style={styles.right}>
          {user.role === 'admin' && isDesktop && (
            <Pressable onPress={() => navigation.navigate('AdminDashboard')} style={({ hovered }) => [styles.adminBtn, hovered && styles.linkHover]} accessibilityRole="link">
              <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
              <Text style={styles.adminText}>Admin console</Text>
            </Pressable>
          )}
          <NotificationBell onOpenRequest={(id) => navigation.navigate('StaffRequest', { id })} />
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={({ hovered }) => [styles.me, hovered && styles.linkHover]}
            accessibilityRole="button"
            accessibilityLabel="Your account menu"
          >
            <Avatar name={name} url={user.avatar_url} size={34} />
            {isDesktop && (
              <View style={{ maxWidth: 160 }}>
                <Text style={styles.meName} numberOfLines={1}>{name}</Text>
                <Text style={styles.meRole}>{ROLE_LABEL[user.role] || user.role}</Text>
              </View>
            )}
            <Ionicons name="chevron-down" size={14} color="#9CC3E6" />
          </Pressable>
        </View>
      </View>

      {!isDesktop && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileLinks}>
          {links}
        </ScrollView>
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <Pressable style={[styles.menu, SHADOW.lg]} onPress={() => {}} accessibilityRole="menu">
            <View style={styles.menuHead}>
              <Avatar name={name} url={user.avatar_url} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={TYPE.label} numberOfLines={1}>{name}</Text>
                <Text style={TYPE.small} numberOfLines={1}>{user.email}</Text>
                <Text style={[TYPE.small, { color: COLORS.primary, fontWeight: '700' }]}>
                  {ROLE_LABEL[user.role] || user.role}{user.job_title ? ` · ${user.job_title}` : ''}
                </Text>
              </View>
            </View>
            <MenuItem icon="person-circle-outline" label="My profile" onPress={() => { setMenuOpen(false); navigation.navigate('StaffSettings', { tab: 'profile' }); }} />
            <MenuItem icon="lock-closed-outline" label="Password & security" onPress={() => { setMenuOpen(false); navigation.navigate('StaffSettings', { tab: 'security' }); }} />
            <MenuItem icon="options-outline" label="Preferences" onPress={() => { setMenuOpen(false); navigation.navigate('StaffSettings', { tab: 'preferences' }); }} />
            {user.role === 'admin' && (
              <MenuItem icon="shield-checkmark-outline" label="Admin console" onPress={() => { setMenuOpen(false); navigation.navigate('AdminDashboard'); }} />
            )}
            <MenuItem icon="globe-outline" label="View public website" onPress={() => { setMenuOpen(false); navigation.navigate('Home'); }} />
            <View style={styles.menuDivider} />
            <MenuItem icon="log-out-outline" label="Sign out" danger onPress={() => { setMenuOpen(false); signOut(); navigation.navigate('Login'); }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: COLORS.primaryDarker, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', zIndex: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, height: 64,
    width: '100%', maxWidth: LAYOUT.maxWidth + 80, alignSelf: 'center', paddingHorizontal: LAYOUT.gutter,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontFamily: FONT, color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  brandSub: { fontFamily: FONT, color: '#7DB4E6', fontSize: 11.5, fontWeight: '600' },
  links: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: SPACE.lg, flex: 1 },
  mobileLinks: { gap: 6, paddingHorizontal: LAYOUT.gutter, paddingBottom: 10 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm },
  linkMobile: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: RADIUS.pill, paddingVertical: 7 },
  linkOn: { backgroundColor: 'rgba(56,189,248,0.18)' },
  linkHover: { backgroundColor: 'rgba(255,255,255,0.08)' },
  linkText: { fontFamily: FONT, color: '#C7DDF2', fontSize: 14, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  adminBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  adminText: { fontFamily: FONT, color: '#fff', fontSize: 13, fontWeight: '700' },
  me: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4, paddingRight: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  meName: { fontFamily: FONT, color: '#fff', fontSize: 13.5, fontWeight: '700' },
  meRole: { fontFamily: FONT, color: '#7DB4E6', fontSize: 11.5, fontWeight: '600' },
  overlay: { flex: 1, alignItems: 'flex-end', paddingTop: 60, paddingRight: 16, paddingLeft: 16, backgroundColor: 'rgba(4,31,58,0.15)' },
  menu: { width: '100%', maxWidth: 300, backgroundColor: '#fff', borderRadius: RADIUS.lg, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.gray200 },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray100, marginBottom: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  menuText: { fontFamily: FONT, fontSize: 14.5, fontWeight: '600', color: COLORS.gray800 },
  menuDivider: { height: 1, backgroundColor: COLORS.gray100, marginVertical: 6 },
});
