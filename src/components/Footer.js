import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { ORG } from '../config/org';
import { COLORS, FONT, LAYOUT } from '../theme';
import { useBreakpoint } from './ui';
import BrandMark from './BrandMark';

const COLUMNS = [
  {
    title: 'Services',
    links: [
      ['Report a problem', 'Feedback', { type: 'Complaint' }],
      ['Make an enquiry', 'Feedback', { type: 'Enquiry' }],
      ['Track my request', 'TrackRequest'],
      ['Service updates', 'Updates'],
    ],
  },
  {
    title: 'Participate',
    links: [
      ['Public consultations', 'Consultations'],
      ['Surveys & polls', 'Surveys'],
      ['Discussion forums', 'Forum'],
      ['Community meetings', 'TownHalls'],
    ],
  },
  {
    title: 'About',
    links: [
      ['About NWSC Jinja', 'About'],
      ['News & announcements', 'News'],
      ['Media gallery', 'MediaGallery'],
      ['FAQs', 'FAQs'],
      ['Sitemap', 'Sitemap'],
    ],
  },
];

function FooterLink({ label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      {({ hovered }) => <Text style={[styles.link, hovered && { color: '#fff' }]}>{label}</Text>}
    </Pressable>
  );
}

export default function Footer() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const isStaff = user && ['officer', 'supervisor', 'admin'].includes(user.role);
  const { isDesktop, isMobile } = useBreakpoint();
  const [socialLinks, setSocialLinks] = useState([]);

  useEffect(() => {
    supabase
      .from('social_links')
      .select('*')
      .eq('enabled', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => setSocialLinks(data || []));
  }, []);

  const goTo = (screen, params) => navigation.navigate(screen, params);

  return (
    <View style={styles.footer} accessibilityRole="contentinfo">
      <View style={[styles.inner, styles.top, !isDesktop && { flexDirection: 'column' }]}>
        <View style={[styles.brandCol, !isDesktop && { maxWidth: '100%' }]}>
          <BrandMark tone="light" />
          <Text style={styles.tagline}>{ORG.tagline}</Text>
          <View style={styles.contactList}>
            {ORG.phones.map((p) => (
              <Pressable key={p.label} style={styles.contactRow} onPress={() => Linking.openURL(`tel:${p.value.replace(/[^\d+]/g, '')}`)}>
                <Ionicons name="call-outline" size={15} color={COLORS.accent} />
                <Text style={styles.contactText}>{p.label}: <Text style={styles.contactStrong}>{p.value}</Text></Text>
              </Pressable>
            ))}
            <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${ORG.email}`)}>
              <Ionicons name="mail-outline" size={15} color={COLORS.accent} />
              <Text style={styles.contactText}>{ORG.email}</Text>
            </Pressable>
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={15} color={COLORS.accent} />
              <Text style={styles.contactText}>{ORG.address}</Text>
            </View>
          </View>
          {socialLinks.length > 0 && (
            <View style={styles.social}>
              {socialLinks.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => s.url && Linking.openURL(s.url)}
                  accessibilityLabel={s.name}
                  style={({ hovered }) => [styles.socialBtn, hovered && { backgroundColor: 'rgba(255,255,255,0.16)' }]}
                >
                  <Ionicons name={s.icon_name} size={18} color="#fff" />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.cols, isMobile && { flexDirection: 'column', gap: 28 }]}>
          {COLUMNS.map((col) => (
            <View key={col.title} style={styles.col}>
              <Text style={styles.colTitle}>{col.title}</Text>
              {col.links.map(([label, screen, params]) => (
                <FooterLink key={label} label={label} onPress={() => goTo(screen, params)} />
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={[styles.inner, styles.bottomRow, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={styles.copy}>{ORG.copyright}</Text>
          <View style={styles.bottomLinks}>
            <FooterLink label="Privacy & terms" onPress={() => goTo('Privacy')} />
            <FooterLink label="Contact" onPress={() => goTo('Contact')} />
            {isStaff && <FooterLink label="Sign out" onPress={signOut} />}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { backgroundColor: COLORS.primaryDarker, marginTop: 64 },
  inner: { width: '100%', maxWidth: LAYOUT.maxWidth, alignSelf: 'center', paddingHorizontal: LAYOUT.gutter },
  top: { flexDirection: 'row', gap: 48, paddingVertical: 56 },
  brandCol: { maxWidth: 380 },
  tagline: { fontFamily: FONT, color: '#94A3B8', fontSize: 14, lineHeight: 22, marginTop: 16 },
  contactList: { marginTop: 20, gap: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { fontFamily: FONT, color: '#CBD5E1', fontSize: 14 },
  contactStrong: { color: '#fff', fontWeight: '700' },
  social: { flexDirection: 'row', gap: 8, marginTop: 20 },
  socialBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  cols: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  col: { gap: 12, minWidth: 160 },
  colTitle: { fontFamily: FONT, color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  link: { fontFamily: FONT, color: '#94A3B8', fontSize: 14 },
  bottom: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, gap: 12 },
  copy: { fontFamily: FONT, color: '#64748B', fontSize: 13 },
  bottomLinks: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
});
