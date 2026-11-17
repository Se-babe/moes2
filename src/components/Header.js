import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Linking,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import BrandMark from './BrandMark';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { ORG } from '../config/org';
import { COLORS, FONT, RADIUS, SHADOW, LAYOUT } from '../theme';
import { Button, useBreakpoint } from './ui';

export const NAV = [
  {
    label: 'Services',
    items: [
      { label: 'Report a problem', desc: 'Leaks, no water, sewer issues', icon: 'water-outline', screen: 'Feedback', params: { type: 'Complaint' } },
      { label: 'Make an enquiry', desc: 'Billing, connections, questions', icon: 'help-circle-outline', screen: 'Feedback', params: { type: 'Enquiry' } },
      { label: 'Track my request', desc: 'Check progress with your reference', icon: 'search-outline', screen: 'TrackRequest' },
      { label: 'Service updates', desc: 'Interruptions and restorations', icon: 'megaphone-outline', screen: 'Updates' },
    ],
  },
  {
    label: 'Participate',
    items: [
      { label: 'Public consultations', desc: 'Have your say on proposals', icon: 'document-text-outline', screen: 'Consultations' },
      { label: 'Surveys & polls', desc: 'Rate our services', icon: 'stats-chart-outline', screen: 'Surveys' },
      { label: 'Discussion forums', desc: 'Ask and answer questions', icon: 'chatbubbles-outline', screen: 'Forum' },
      { label: 'Community meetings', desc: 'Town halls in your area', icon: 'people-outline', screen: 'TownHalls' },
      { label: 'Share a suggestion', desc: 'Ideas to improve services', icon: 'bulb-outline', screen: 'Feedback', params: { type: 'Suggestion' } },
    ],
  },
  {
    label: 'About',
    items: [
      { label: 'About NWSC Jinja', desc: 'Who we are and our teams', icon: 'business-outline', screen: 'About' },
      { label: 'News & announcements', desc: 'Latest from NWSC', icon: 'newspaper-outline', screen: 'News' },
      { label: 'Media gallery', desc: 'Projects and community events', icon: 'images-outline', screen: 'MediaGallery' },
      { label: 'FAQs', desc: 'Answers to common questions', icon: 'help-buoy-outline', screen: 'FAQs' },
      { label: 'Contact us', desc: 'Offices, phone and email', icon: 'call-outline', screen: 'Contact' },
    ],
  },
];

function NavDropdown({ section, onNavigate }) {
  const [open, setOpen] = useState(false);
  return (
    <View
      style={styles.navItemWrap}
      // web: open on hover, close when the pointer leaves the trigger+panel
      onMouseEnter={Platform.OS === 'web' ? () => setOpen(true) : undefined}
      onMouseLeave={Platform.OS === 'web' ? () => setOpen(false) : undefined}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={({ hovered }) => [styles.navLink, (hovered || open) && styles.navLinkActive]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.navLinkText}>{section.label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.gray600} />
      </Pressable>
      {open && (
        <View style={[styles.dropdown, SHADOW.lg]}>
          {section.items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => { setOpen(false); onNavigate(item.screen, item.params); }}
              style={({ hovered }) => [styles.dropItem, hovered && { backgroundColor: COLORS.primarySoft }]}
              accessibilityRole="link"
            >
              <View style={styles.dropIcon}>
                <Ionicons name={item.icon} size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dropTitle}>{item.label}</Text>
                <Text style={styles.dropDesc}>{item.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Header() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { width } = useBreakpoint();
  const compact = width < LAYOUT.breakpoints.lg;
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [socialLinks, setSocialLinks] = useState([]);

  useEffect(() => {
    supabase
      .from('social_links')
      .select('*')
      .eq('enabled', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => setSocialLinks(data || []));
  }, []);

  const go = (screen, params) => {
    setMenuOpen(false);
    if (screen) navigation.navigate(screen, params);
  };

  const search = () => {
    const q = query.trim();
    if (!q) return;
    setMenuOpen(false);
    navigation.navigate('SearchResults', { query: q });
  };

  const isStaff = user && ['officer', 'supervisor', 'admin'].includes(user.role);
  const tollFree = ORG.phones[0];

  return (
    <View style={styles.wrap}>
      {/* Utility bar */}
      <View style={styles.utility}>
        <View style={styles.inner}>
          <Pressable style={styles.utilItem} onPress={() => Linking.openURL(`tel:${tollFree.value.replace(/\D/g, '')}`)}>
            <Ionicons name="call" size={13} color={COLORS.accent} />
            <Text style={styles.utilText}>
              {compact ? `${tollFree.label}: ${tollFree.value}` : `Emergency or burst pipe? Call ${tollFree.label.toLowerCase()} ${tollFree.value}`}
            </Text>
          </Pressable>
          {!compact && (
            <View style={styles.utilRight}>
              <Pressable style={styles.utilItem} onPress={() => Linking.openURL(`mailto:${ORG.email}`)}>
                <Ionicons name="mail-outline" size={13} color="#93C5FD" />
                <Text style={styles.utilText}>{ORG.email}</Text>
              </Pressable>
              {socialLinks.map((s) => (
                <Pressable key={s.id} onPress={() => s.url && Linking.openURL(s.url)} accessibilityLabel={s.name} style={styles.utilIcon}>
                  <Ionicons name={s.icon_name} size={15} color="#CBD5E1" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Main bar */}
      <View style={styles.main}>
        <View style={[styles.inner, { paddingVertical: 12 }]}>
          <Pressable onPress={() => go('Home')} accessibilityRole="link" accessibilityLabel="Home">
            <BrandMark size={compact ? 'small' : 'large'} />
          </Pressable>

          {!compact && (
            <View style={styles.nav}>
              {NAV.map((section) => (
                <NavDropdown key={section.label} section={section} onNavigate={go} />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {!compact && (
              <View style={styles.search}>
                <Ionicons name="search" size={16} color={COLORS.gray400} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={COLORS.gray400}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  returnKeyType="search"
                  accessibilityLabel="Search the site"
                />
              </View>
            )}
            {!compact && isStaff && (
              <Button
                title={user.role === 'admin' ? 'Admin console' : 'Staff portal'}
                variant="secondary"
                size="sm"
                icon="briefcase-outline"
                onPress={() => go(user.role === 'admin' ? 'AdminDashboard' : 'StaffPortal')}
              />
            )}
            {width >= 420 && (
              <Button title="Report a problem" icon="water" size="sm" onPress={() => go('Feedback', { type: 'Complaint' })} />
            )}
            {compact && (
              <Pressable style={styles.burger} onPress={() => setMenuOpen(true)} accessibilityLabel="Open menu" accessibilityRole="button">
                <Ionicons name="menu" size={24} color={COLORS.primaryDark} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Mobile / tablet drawer */}
      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.drawerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
          <View style={[styles.drawer, SHADOW.lg]}>
            <View style={styles.drawerHead}>
              <BrandMark size="small" />
              <Pressable onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" style={styles.burger}>
                <Ionicons name="close" size={24} color={COLORS.gray700} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={[styles.search, { marginBottom: 16 }]}>
                <Ionicons name="search" size={16} color={COLORS.gray400} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={COLORS.gray400}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  returnKeyType="search"
                />
              </View>
              <Button title="Report a problem" icon="water" full onPress={() => go('Feedback', { type: 'Complaint' })} />
              <Button title="Track my request" icon="search" variant="secondary" full style={{ marginTop: 10 }} onPress={() => go('TrackRequest')} />
              {NAV.map((section) => (
                <View key={section.label} style={{ marginTop: 24 }}>
                  <Text style={styles.drawerSection}>{section.label}</Text>
                  {section.items.map((item) => (
                    <Pressable key={item.label} style={styles.drawerLink} onPress={() => go(item.screen, item.params)}>
                      <Ionicons name={item.icon} size={18} color={COLORS.primary} />
                      <Text style={styles.drawerLinkText}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              {isStaff && (
                <View style={{ marginTop: 24 }}>
                  <Text style={styles.drawerSection}>Staff</Text>
                  <Pressable style={styles.drawerLink} onPress={() => go(user.role === 'admin' ? 'AdminDashboard' : 'StaffPortal')}>
                    <Ionicons name="briefcase-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.drawerLinkText}>Staff area</Text>
                  </Pressable>
                  <Pressable style={styles.drawerLink} onPress={() => { setMenuOpen(false); signOut(); }}>
                    <Ionicons name="log-out-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.drawerLinkText}>Sign out</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 100, backgroundColor: COLORS.white, ...(Platform.OS === 'web' ? { position: 'relative' } : null) },
  inner: {
    width: '100%', maxWidth: LAYOUT.maxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.gutter,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  },
  utility: { backgroundColor: COLORS.primaryDarker, paddingVertical: 7 },
  utilRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  utilItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  utilText: { fontFamily: FONT, color: '#E2E8F0', fontSize: 12.5, fontWeight: '500' },
  utilIcon: { padding: 2 },
  main: { borderBottomWidth: 1, borderBottomColor: COLORS.gray200, backgroundColor: COLORS.white, zIndex: 100 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginLeft: 24 },
  navItemWrap: { position: 'relative', zIndex: 200 },
  navLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.sm },
  navLinkActive: { backgroundColor: COLORS.gray100 },
  navLinkText: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: COLORS.gray800 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, width: 320, backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gray200, padding: 8, zIndex: 300,
  },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: RADIUS.md },
  dropIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dropTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  dropDesc: { fontFamily: FONT, fontSize: 12.5, color: COLORS.gray500, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.pill, paddingHorizontal: 14, height: 40, minWidth: 180,
  },
  searchInput: { fontFamily: FONT, flex: 1, fontSize: 14, color: COLORS.gray900, height: 40 },
  burger: { padding: 8, borderRadius: RADIUS.sm },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(4,31,58,0.5)', flexDirection: 'row', justifyContent: 'flex-end' },
  drawer: { width: '86%', maxWidth: 380, height: '100%', backgroundColor: COLORS.white },
  drawerHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray200,
  },
  drawerSection: { fontFamily: FONT, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: COLORS.gray400, marginBottom: 6 },
  drawerLink: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  drawerLinkText: { fontFamily: FONT, fontSize: 15.5, fontWeight: '600', color: COLORS.gray800 },
});
